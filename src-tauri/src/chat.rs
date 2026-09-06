// chat.rs —— 极简 LLM 客户端：OpenAI 兼容流式对话（SSE），事件推送 delta
// 密钥：env DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml；端点/模型可 env 覆盖。

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

/// 对话消息。content 用 Option 以便承载"assistant 发起 tool_calls 时 content 为空/null"；
/// tool_call_id / tool_calls 仅在工具回合携带（DeepSeek OpenAI 兼容格式）。
#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMsg {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCallWire>,
}

/// 消息内嵌的 tool_calls 项（assistant 请求工具/透传到后续回合）
#[derive(Serialize, Deserialize, Clone)]
pub struct ToolCallWire {
    pub id: String,
    #[serde(rename = "type", default = "default_tool_type")]
    pub tool_type: String,
    pub function: ToolFunctionWire,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolFunctionWire {
    pub name: String,
    pub arguments: String,
}

fn default_tool_type() -> String {
    "function".into()
}

fn read_env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|s| !s.is_empty())
}

/// 从 `~/.dsh/.credentials.yaml` 提取 DEEPSEEK_API_KEY（兼容旧环境，仅本机自用）
fn parse_credentials(content: &str) -> Option<String> {
    for line in content.lines() {
        let l = line.trim();
        if let Some(rest) = l.strip_prefix("DEEPSEEK_API_KEY") {
            let rest = rest.trim_start_matches(':').trim();
            let v = rest.trim_matches(|c| c == '\'' || c == '"');
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    None
}

fn legacy_key_from_dsh() -> Option<String> {
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).ok()?;
    let path = format!("{home}\\.dsh\\.credentials.yaml");
    let content = std::fs::read_to_string(path).ok()?;
    parse_credentials(&content)
}

pub struct LlmConfig {
    pub key: String,
    pub base_url: String,
    pub model: String,
}

/// 密钥优先级（纯函数，可测）：环境变量 > 应用设置 > 旧 ~/.dsh 凭据（空白视为未设置）
fn pick_key(env: Option<&str>, file: &str, legacy: Option<&str>) -> Option<String> {
    let env_trim = env.map(str::trim).filter(|s| !s.is_empty()).map(str::to_string);
    let legacy_trim = legacy.map(str::trim).filter(|s| !s.is_empty()).map(str::to_string);
    env_trim
        .or_else(|| (!file.trim().is_empty()).then(|| file.trim().to_string()))
        .or(legacy_trim)
}

fn pick_text(env: Option<&str>, file: &str, default: &str) -> String {
    env.filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| (!file.is_empty()).then(|| file.to_string()))
        .unwrap_or_else(|| default.to_string())
}

/// 组装最终配置：env > 工作区 settings.json > ~/.dsh 兼容回退
pub fn resolve_config() -> Result<LlmConfig, String> {
    let file = crate::settings::read_settings().unwrap_or_default();
    let key = pick_key(
        read_env("DEEPSEEK_API_KEY").as_deref(),
        &file.api_key,
        legacy_key_from_dsh().as_deref(),
    )
    .ok_or_else(|| "未配置 DEEPSEEK_API_KEY：请在应用「设置」中填写，或设置环境变量 DEEPSEEK_API_KEY".to_string())?;
    let base_url = pick_text(
        read_env("DEEPSEEK_BASE_URL").as_deref(),
        &file.base_url,
        "https://api.deepseek.com",
    );
    let model = pick_text(read_env("DEEPSEEK_MODEL").as_deref(), &file.model, "deepseek-v4-flash");
    Ok(LlmConfig { key, base_url, model })
}

/// 解析一行 SSE：`data: {...}` → delta.content；`[DONE]` 或空 → None
fn sse_delta(line: &str) -> Option<String> {
    let l = line.trim();
    if !l.starts_with("data:") {
        return None;
    }
    let data = l["data:".len()..].trim();
    if data.is_empty() || data == "[DONE]" {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(data).ok()?;
    v["choices"][0]["delta"]["content"].as_str().map(|s| s.to_string()).filter(|s| !s.is_empty())
}

/// 解析流结束残留 buffer（可无尾部换行）；空 buffer → None（纯函数，可测）
fn sse_tail_delta(buf: &str) -> Option<String> {
    let tail = buf.trim();
    if tail.is_empty() {
        return None;
    }
    sse_delta(tail)
}

/// 流式对话核心：返回完整文本，同时逐段回调（测试可直接调用）
async fn stream_chat(
    cfg: &LlmConfig,
    messages: Vec<ChatMsg>,
    mut on_delta: impl FnMut(String),
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", cfg.base_url);
    let body = serde_json::json!({
        "model": cfg.model,
        "stream": true,
        "reasoning_effort": "max",
        "max_tokens": 64000,
        "messages": messages,
    });
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", cfg.key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败：{e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API 错误 {status}：{text}"));
    }

    let mut stream = res;
    let mut buf = String::new();
    let mut collected = String::new();
    while let Some(chunk) = stream
        .chunk()
        .await
        .map_err(|e| format!("响应流中断：{e}"))?
    {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        loop {
            match buf.find('\n') {
                Some(pos) => {
                    let line: String = buf[..pos].trim().to_string();
                    buf.drain(..=pos);
                    if let Some(delta) = sse_delta(&line) {
                        collected.push_str(&delta);
                        on_delta(delta);
                    }
                }
                None => break,
            }
        }
    }
    // EOF 冲刷（O-8 修复）：流结束后 buffer 残留的末块（无尾部换行）也应解析
    let tail = sse_tail_delta(&buf);
    if let Some(delta) = tail {
        collected.push_str(&delta);
        on_delta(delta);
    }
    Ok(collected)
}

#[tauri::command]
pub async fn chat_stream(app: AppHandle, messages: Vec<ChatMsg>) -> Result<(), String> {
    let cfg = resolve_config()?;
    stream_chat(&cfg, messages, |d| {
        let _ = app.emit("chat-delta", d);
    })
    .await
    .map(|_| ())
}

// ---------- 图像子智能体：gen_svg（一次生成一幅插画 SVG，非流式） ----------

const SVG_SYSTEM_PROMPT: &str = "\
你是公众号插画师，输出可直接内嵌在推文 HTML 里的纯 SVG 插画。要求：\n\
1. 一次只画一张具体可辨认的插画（真实物体/场景/生灵），不要抽象几何剪影；\n\
2. 必须带 viewBox，元素坐标落在其范围内；\n\
3. 可见图形元素（circle/rect/ellipse/line/path/polygon/polyline/image）合计不少于 6 个；\n\
4. SVG 内零文字、零数字、零 emoji（不出现 <text>、数字标注或 emoji 字符）；\n\
5. 背景透明，不要铺满底色块；\n\
6. 低饱和同色系配色，主色不超过 4 种；若用户给定主题/风格词，则按其气质配色；\n\
7. 整段回答只包含从 <svg 到 </svg> 的 SVG 原文：不解释、不用代码围栏（``` 或 markdown）、不加任何前后缀文字。";

/// 按 kind 组装用户消息（纯函数，可测）
fn svg_user_prompt(kind: &str, desc: &str, theme: Option<&str>) -> Result<String, String> {
    let ctx = match kind {
        "wide" => "整行横幅插画（建议 viewBox=\"0 0 750 220\"，横向构图铺满）",
        "inline" => "小节旁的小插画（建议 viewBox=\"0 0 360 240\" 或 \"0 0 300 300\"）",
        "deco" => "推文气泡右下角的小装饰素材——角饰（建议 viewBox=\"0 0 300 300\"，图形集中在右下 1/3，小巧精致，如花簇/枝叶局部）",
        other => return Err(format!("未知图像类型：{other}（应为 wide / inline / deco）")),
    };
    let mut msg = format!("请画一幅插画，用作：{ctx}。画面内容：{}", desc.trim());
    if let Some(t) = theme.map(str::trim).filter(|s| !s.is_empty()) {
        msg.push_str(&format!(" 主题/风格词：{t}，请按其气质配色。"));
    }
    Ok(msg)
}

fn svg_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?is)<svg[\s\S]*?</svg>"#).expect("静态正则应合法"))
}

/// 从一段文本中抽出第一段 <svg>…</svg> 原文（纯函数，可测）
fn extract_svg(text: &str) -> Option<String> {
    svg_re().find(text).map(|m| m.as_str().to_string())
}

/// 解析 DeepSeek 返回体 JSON：choices[0].message.content → 抽出 SVG（纯函数，可测）
fn svg_from_response(body: &str) -> Result<String, String> {
    let v: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("解析响应 JSON 失败：{e}"))?;
    let content = v["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "图像子智能体未返回 SVG".to_string())?;
    let snippet: String = content.chars().take(160).collect();
    extract_svg(content).ok_or_else(|| format!("图像子智能体未返回 SVG（响应片段：{snippet}…）"))
}

/// 图像子智能体专用模型：默认 deepseek-chat（非推理、快、稳），可用 DEEPSEEK_IMAGE_MODEL 覆盖。
/// 实测 deepseek-v4-flash（reasoning_effort max/low）画 SVG 时推理会失控吃光预算、content 为空；
/// deepseek-chat 可直接产出完整 <svg>…</svg>。
fn image_model() -> String {
    read_env("DEEPSEEK_IMAGE_MODEL").unwrap_or_else(|| "deepseek-chat".to_string())
}

/// 非流式请求一次插画生成，返回解析好的 SVG 原文
async fn complete_svg(cfg: &LlmConfig, messages: Vec<ChatMsg>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", cfg.base_url);
    let body = serde_json::json!({
        "model": image_model(),
        "stream": false,
        "max_tokens": 8000,
        "messages": messages,
    });
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", cfg.key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败：{e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API 错误 {status}：{text}"));
    }
    let text = res.text().await.map_err(|e| format!("读取响应失败：{e}"))?;
    svg_from_response(&text)
}

#[tauri::command]
pub async fn gen_svg(
    app: AppHandle,
    kind: String,
    desc: String,
    theme: Option<String>,
) -> Result<String, String> {
    let _ = &app; // 非流式命令暂不需事件推送；保留 AppHandle 便于后续接入进度事件
    let cfg = resolve_config()?;
    let user = svg_user_prompt(&kind, &desc, theme.as_deref())?;
    let messages = vec![
        ChatMsg { role: "system".into(), content: Some(SVG_SYSTEM_PROMPT.to_string()), tool_call_id: None, tool_calls: vec![] },
        ChatMsg { role: "user".into(), content: Some(user), tool_call_id: None, tool_calls: vec![] },
    ];
    complete_svg(&cfg, messages).await
}

// ---------- 创作前置：prep_turn（知识注册表 → 模型按需工具取用，非流式） ----------

/// prep_turn 的返回：assistant 正文（无工具调用时可能是澄清问题或 READY）与请求的工具调用清单
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PrepReply {
    pub text: Option<String>,
    pub calls: Vec<ToolCall>,
}

/// 解析出的工具调用（arguments 是 JSON 字符串，原样透传给前端本地执行）
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: String,
}

/// 知识工具声明（DeepSeek function-calling，OpenAI 格式）：随 prep_turn 请求发送
const PREP_TOOLS: &str = r#"[
  {"type":"function","function":{"name":"load_knowledge","description":"读取三层知识库某点文件的全文（点文件名如 style-guochao / type-promo / comp-banned / module-bubble）。创作前按需取用：内容类型模板、风格色板、合规红线、模块规范。","parameters":{"type":"object","properties":{"name":{"type":"string","description":"点文件名（去 .md 后缀），如 style-guochao"}},"required":["name"]}}},
  {"type":"function","function":{"name":"search_knowledge","description":"按主题检索应取用哪些点文件，返回文件名清单。创作前不确定该读哪些点时使用。","parameters":{"type":"object","properties":{"query":{"type":"string","description":"检索主题，如 促销活动 或 咖啡店开业"}},"required":["query"]}}}
]"#;

/// 解析 DeepSeek 非流式返回体：choices[0].message 的 content 与 tool_calls（纯函数，可测）
fn parse_prep_reply(body: &str) -> Result<PrepReply, String> {
    let v: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("解析响应 JSON 失败：{e}"))?;
    let choices = v
        .get("choices")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "解析响应 JSON 失败：缺少 choices".to_string())?;
    let first = choices
        .first()
        .ok_or_else(|| "解析响应 JSON 失败：choices 为空".to_string())?;
    let msg = first
        .get("message")
        .and_then(|m| m.as_object())
        .ok_or_else(|| "解析响应 JSON 失败：缺少 message".to_string())?;
    let text = msg
        .get("content")
        .and_then(|c| c.as_str())
        .map(str::to_string)
        .filter(|s| !s.trim().is_empty());
    let mut calls: Vec<ToolCall> = Vec::new();
    if let Some(arr) = msg.get("tool_calls").and_then(|t| t.as_array()) {
        for tc in arr {
            calls.push(ToolCall {
                id: tc["id"].as_str().unwrap_or_default().to_string(),
                name: tc["function"]["name"].as_str().unwrap_or_default().to_string(),
                args: tc["function"]["arguments"].as_str().unwrap_or_default().to_string(),
            });
        }
    }
    Ok(PrepReply { text, calls })
}

/// 非流式创作前置请求：携带 tools，让模型决定取用哪些知识点或澄清
async fn request_prep(cfg: &LlmConfig, messages: Vec<ChatMsg>) -> Result<PrepReply, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", cfg.base_url);
    let tools: serde_json::Value = serde_json::from_str(PREP_TOOLS)
        .map_err(|e| format!("工具声明解析失败：{e}"))?;
    let body = serde_json::json!({
        "model": cfg.model,
        "messages": messages,
        "tools": tools,
        "stream": false,
        "max_tokens": 1200,
    });
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", cfg.key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败：{e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API 错误 {status}：{text}"));
    }
    let text = res.text().await.map_err(|e| format!("读取响应失败：{e}"))?;
    parse_prep_reply(&text)
}

#[tauri::command]
pub async fn prep_turn(app: AppHandle, messages: Vec<ChatMsg>) -> Result<PrepReply, String> {
    let _ = &app; // 保留 AppHandle 便于后续接入进度/取消
    let cfg = resolve_config()?;
    request_prep(&cfg, messages).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_key_with_quotes_and_space() {
        let yaml = "# dsh credentials\nDEEPSEEK_API_KEY: 'sk-test-123'\nOTHER: 1\n";
        assert_eq!(parse_credentials(yaml).as_deref(), Some("sk-test-123"));
    }

    #[test]
    fn parse_key_no_quotes() {
        let yaml = "DEEPSEEK_API_KEY: sk-bare-key\n";
        assert_eq!(parse_credentials(yaml).as_deref(), Some("sk-bare-key"));
    }

    #[test]
    fn parse_key_missing() {
        assert_eq!(parse_credentials("OTHER: x\n"), None);
    }

    #[test]
    fn key_precedence_env_over_file_over_legacy() {
        assert_eq!(
            pick_key(Some("env"), "file", Some("legacy")).as_deref(),
            Some("env")
        );
        assert_eq!(pick_key(None, "file", Some("legacy")).as_deref(), Some("file"));
        assert_eq!(pick_key(None, "", Some("legacy")).as_deref(), Some("legacy"));
        assert_eq!(pick_key(None, "", None), None);
        assert_eq!(pick_key(Some("  "), "file", None).as_deref(), Some("file"));
    }

    #[test]
    fn sse_line_extracts_content() {
        let line = r#"data: {"choices":[{"delta":{"content":"你好"}}]}"#;
        assert_eq!(sse_delta(line).as_deref(), Some("你好"));
    }

    #[test]
    fn sse_done_and_non_data_ignored() {
        assert_eq!(sse_delta("data: [DONE]"), None);
        assert_eq!(sse_delta(": keep-alive"), None);
        assert_eq!(sse_delta(""), None);
    }

    #[test]
    fn sse_reasoning_ignored() {
        let line = r#"data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}"#;
        assert_eq!(sse_delta(line), None);
    }

    #[test]
    fn sse_tail_flush_parses_residual_without_newline() {
        let buf = r#"data: {"choices":[{"delta":{"content":"收尾"}}]}"#;
        assert_eq!(sse_tail_delta(buf).as_deref(), Some("收尾"));
        assert_eq!(sse_tail_delta("  \n\t "), None, "空 buffer 不解析");
        assert_eq!(sse_tail_delta("data: [DONE]"), None);
    }

    #[tokio::test]
    #[ignore = "需要真实 DeepSeek API 与密钥（env DEEPSEEK_API_KEY 或 ~/.dsh/.credentials.yaml）"]
    async fn live_deepseek_smoke() {
        let cfg = resolve_config().expect("应能解析到密钥配置");
        let mut got = String::new();
        let reply = stream_chat(
            &cfg,
            vec![ChatMsg {
                role: "user".into(),
                content: Some("只回复六个字：桌面链路测试通过".into()),
                tool_call_id: None,
                tool_calls: vec![],
            }],
            |d| got.push_str(&d),
        )
        .await
        .expect("流式对话应成功");
        assert_eq!(reply, got);
        assert!(!reply.trim().is_empty());
        println!("LIVE REPLY: {reply}");
    }

    #[tokio::test]
    #[ignore = "需要真实 DeepSeek API 与密钥"]
    async fn live_article_sample() {
        // 真实模型整篇输出抽样：按 persona 关键规则直接产出推文 HTML
        let cfg = resolve_config().expect("应能解析到密钥配置");
        let system = "你是公众号推文创作专家。间距：块距16px/行高1.75。审美铁律：零emoji零图标字符、零linear-gradient、零box-shadow、低饱和纯色+细边框；不要<style>/<script>/<html>/<body>标签，全部内联样式；正文15-16px 深灰。只输出一个```html代码块。";
        let user = "写一篇咖啡店新店开业的宣传类推文，日系暖色调，500字左右，直接写";
        let reply = stream_chat(
            &cfg,
            vec![
                ChatMsg { role: "system".into(), content: Some(system.into()), tool_call_id: None, tool_calls: vec![] },
                ChatMsg { role: "user".into(), content: Some(user.into()), tool_call_id: None, tool_calls: vec![] },
            ],
            |_| {},
        )
        .await
        .expect("整篇生成应成功");
        let body = reply.trim();
        assert!(body.len() > 300, "回复过短: {}", body.len());
        assert!(body.contains("<section") || body.contains("<div"), "缺少结构标签");
        let mut issues = Vec::new();
        if body.contains("linear-gradient") {
            issues.push("gradient");
        }
        if body.contains("box-shadow") {
            issues.push("shadow");
        }
        if body.contains("<style") {
            issues.push("style-tag");
        }
        let emoji = body.chars().filter(|c| {
            let cp = *c as u32;
            (0x1F000..=0x1FAFF).contains(&cp) || matches!(cp, 0x2705 | 0x26A0 | 0x2B50)
        }).count();
        if emoji > 0 {
            issues.push("emoji");
        }
        println!("LIVE ARTICLE: len={}, sections={}, issues={:?}", body.len(), body.matches("<section").count(), issues);
        println!("LIVE HEAD: {}", body.chars().take(90).collect::<String>());
    }

    #[test]
    fn svg_prompt_kind_ctx_and_theme() {
        let wide = svg_user_prompt("wide", "咖啡店一角", Some("杂志")).expect("ok");
        assert!(wide.contains("750 220"), "wide 应提示横幅 viewBox");
        assert!(wide.contains("咖啡店一角"));
        assert!(wide.contains("杂志"));
        let deco = svg_user_prompt("deco", "花簇", None).expect("ok");
        assert!(deco.contains("角饰"));
        assert!(deco.contains("右下 1/3"));
        assert!(svg_user_prompt("banner", "x", None).unwrap_err().contains("未知图像类型"));
    }

    #[test]
    fn svg_extracted_from_response_json() {
        let body = r##"{"choices":[{"message":{"content":"好的，这是插画：\n<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 750 220\">\n  <rect x=\"10\" y=\"10\" width=\"100\" height=\"80\" rx=\"12\" fill=\"#d9c9a3\"/>\n</svg>\n以上。"}}]}"##;
        let got = svg_from_response(body).expect("应提取成功");
        assert!(got.starts_with("<svg"));
        assert!(got.ends_with("</svg>"));
        assert!(got.contains("viewBox=\"0 0 750 220\""));
        assert!(!got.contains("好的"));
    }

    #[test]
    fn svg_extract_survives_code_fence() {
        let content = "```xml\n<svg viewBox=\"0 0 300 300\"><rect x=\"0\" y=\"0\" width=\"20\" height=\"20\"/></svg>\n```";
        let got = extract_svg(content).expect("应从代码围栏内取出");
        assert!(got.starts_with("<svg"));
        assert!(got.ends_with("</svg>"));
    }

    #[test]
    fn svg_response_missing_or_bare_returns_err() {
        let bare = r#"{"choices":[{"message":{"content":"抱歉，无法生成。"}}]}"#;
        let err = svg_from_response(bare).expect_err("无 svg 应报错");
        assert!(err.contains("未返回 SVG"));
        let no_content = r#"{"choices":[{"message":{}}]}"#;
        assert!(svg_from_response(no_content).is_err());
        assert!(svg_from_response("not json").is_err());
    }

    // ---------- prep_turn：工具调用响应解析 ----------

    #[test]
    fn prep_parse_tool_calls_from_json() {
        let body = r#"{"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_abc123","type":"function","function":{"name":"load_knowledge","arguments":"{\"name\":\"style-guochao\"}"}},{"id":"call_def456","type":"function","function":{"name":"search_knowledge","arguments":"{\"query\":\"促销活动\"}"}}]}}]}"#;
        let reply = parse_prep_reply(body).expect("应解析成功");
        assert_eq!(reply.text, None, "请求工具时正文应为空");
        assert_eq!(reply.calls.len(), 2);
        assert_eq!(reply.calls[0].id, "call_abc123");
        assert_eq!(reply.calls[0].name, "load_knowledge");
        assert!(reply.calls[0].args.contains("style-guochao"));
        assert_eq!(reply.calls[1].name, "search_knowledge");
    }

    #[test]
    fn prep_parse_plain_text_when_no_tools() {
        let body = r#"{"choices":[{"message":{"role":"assistant","content":"好的，请先告诉我这篇推文是什么类型、想要什么风格？"}}]}"#;
        let reply = parse_prep_reply(body).expect("应解析成功");
        assert!(reply.calls.is_empty());
        let text = reply.text.expect("应有正文");
        assert!(text.contains("什么风格"));
    }

    #[test]
    fn prep_parse_readiness_marker() {
        // 模型取完知识后只输出 READY
        let body = r#"{"choices":[{"message":{"content":"READY"}}]}"#;
        let reply = parse_prep_reply(body).expect("ok");
        assert_eq!(reply.text.as_deref(), Some("READY"));
        assert!(reply.calls.is_empty());
    }

    #[test]
    fn prep_parse_invalid_json_errors() {
        assert!(parse_prep_reply("not json").is_err());
        assert!(parse_prep_reply(r#"{"no_choices":[]}"#).is_err());
    }

    #[test]
    fn chat_msg_roundtrips_tool_messages() {
        // assistant 带 tool_calls（content 为空）与 tool 结果消息应能反序列化并再序列化
        let assistant: ChatMsg = serde_json::from_str(
            r#"{"role":"assistant","content":null,"tool_calls":[{"id":"call_x","type":"function","function":{"name":"load_knowledge","arguments":"{\"name\":\"type-promo\"}"}}]}"#,
        )
        .expect("assistant tool_calls 消息应可解析");
        assert_eq!(assistant.content, None);
        assert_eq!(assistant.tool_calls.len(), 1);
        assert_eq!(assistant.tool_calls[0].function.name, "load_knowledge");
        let tool: ChatMsg = serde_json::from_str(
            r##"{"role":"tool","tool_call_id":"call_x","content":"# type-promo ..."}"##,
        )
        .expect("tool 结果消息应可解析");
        assert_eq!(tool.tool_call_id.as_deref(), Some("call_x"));
        // 序列化应保留 tool_calls（DeepSeek 要求透传）
        let re: serde_json::Value = serde_json::to_value(&assistant).expect("ok");
        assert_eq!(re["tool_calls"][0]["type"], "function");
        assert_eq!(re["content"], serde_json::Value::Null);
    }

    // ---------- 第 23-25 轮 真实模型 live：澄清 → 知识工具 → digest 续写 → 插画 ----------

    fn msg(role: &str, content: &str) -> ChatMsg {
        ChatMsg { role: role.into(), content: Some(content.into()), tool_call_id: None, tool_calls: vec![] }
    }

    /// 与前端 prep.ts PREP_INSTRUCTION 对齐的规约（前端在 TS 中注入，测试在此复刻）
    const PREP_RULE: &str = "你的任务是：若创作需求尚不明确 → 仅输出你的澄清问题（一段话）并结束；若已明确 → 先用知识工具（load_knowledge / search_knowledge）取用本次创作真正需要的点文件，取完只输出 READY（仅此一词），不要撰写正文。稍后会另发指令让你开始撰写正文。";

    #[tokio::test]
    #[ignore = "需要真实 DeepSeek API 与密钥"]
    async fn live_clarify_tools_then_digest_write() {
        let cfg = resolve_config().expect("应能解析到密钥配置");
        let system = "你是公众号推文创作助手，可用知识工具 load_knowledge / search_knowledge。\n知识注册表（目录）：视觉/风格：style-japanese(日系)、style-guochao(国潮)、style-tech(科技)；文本/内容类型：type-promo(促销)、type-tutorial(干货)；文本/文案：copy-tpl-promo(促销模板)；文本/合规：comp-banned(违禁词表)。\n规则：需求尚不明确时只用一段话问清关键问题（含问号），不要写正文；需求已明确时先用知识工具取用相关点文件，取完只输出 READY。";

        // 1) 模糊请求 → 模型应先澄清（第 23 轮 persona v5：需求未齐不产出）
        let vague = request_prep(
            &cfg,
            vec![
                msg("system", system),
                msg("user", "帮我写一篇推文，主题是新书上市"),
                msg("user", PREP_RULE),
            ],
        )
        .await
        .expect("澄清请求应成功");
        let vague_text = vague.text.unwrap_or_default();
        assert!(!vague.calls.is_empty() == false, "模糊请求不应直接取工具: {vague_text}");
        assert!(vague_text.contains('？') || vague_text.contains('?'), "应输出澄清问题: {vague_text}");
        println!("LIVE CLARIFY: {vague_text}");

        // 2) 明确创作 → 模型调用知识工具（第 25 轮）
        let detailed = request_prep(
            &cfg,
            vec![
                msg("system", system),
                msg("user", "写一篇咖啡店开业宣传推文，日系风，800 字左右，直接写"),
                msg("user", PREP_RULE),
            ],
        )
        .await
        .expect("明确请求 prep 应成功");
        assert!(!detailed.calls.is_empty(), "明确创作应触发知识工具");
        let names: Vec<String> = detailed.calls.iter().map(|c| c.name.clone()).collect();
        println!("LIVE TOOL CALLS: {names:?} args={:?}", detailed.calls.iter().map(|c| &c.args).collect::<Vec<_>>());

        // 3) 模拟前端执行工具 → 拼 digest → 不带工具历史的流式续写（验证无 400 风险路径）
        let mut digest = String::from("\n");
        for c in &detailed.calls {
            let body = if c.name.contains("style") {
                "日系风色板：底色#faf3e3、主色#c29b6b、点缀#8fa37a；纸感材质，圆角 12px。"
            } else if c.name.contains("type") {
                "促销类结构：banner → 钩子段 → 2-3 小节（各配组件+素材）→ 1 个关键气泡 → 平实号召。"
            } else if c.name.contains("copy-tpl") {
                "成稿模板骨架：开篇利益点 3 秒钩子；正文 1500-2500 字、短段落+小标题。"
            } else if c.name.contains("comp") {
                "合规红线：禁用 最/第一/国家级/100%/绝对化 措辞与医疗疗效承诺。"
            } else {
                "模块规范：气泡 KEY 用纯色 + 右下角饰。"
            };
            digest.push_str(&format!("\n【{} {}】\n{}\n", c.name, c.args, body));
        }
        let write = format!(
            "{} 开始撰写正文：只输出一个 ```v2 代码块；第一行声明 [[theme:日系]]；正文用 v2 排版语法（banner/steps/气泡/图位 [[img:wide|说明]]），不用 emoji。",
            digest
        );
        let mut got = String::new();
        let reply = stream_chat(
            &cfg,
            vec![msg("system", system), msg("user", "写一篇咖啡店开业宣传推文，日系风，800 字左右，直接写"), msg("user", &write)],
            |d| got.push_str(&d),
        )
        .await
        .expect("带知识摘要的流式续写应成功（验证无工具历史 400）");
        assert_eq!(reply, got);
        assert!(reply.trim().len() > 120, "续写过短: {}", reply.len());
        assert!(reply.contains("```v2"), "应产出 v2 围栏正文");
        assert!(reply.contains("[[theme"), "正文应声明风格 theme");
        println!("LIVE WRITE: len={} v2=true theme=true head={}", reply.len(), reply.chars().take(80).collect::<String>());
    }

    #[tokio::test]
    #[ignore = "需要真实 DeepSeek API 与密钥"]
    async fn live_gen_svg_draws_concrete_illustration() {
        let cfg = resolve_config().expect("应能解析到密钥配置");
        let user = svg_user_prompt("wide", "清晨的咖啡店门头：木质招牌、暖黄灯光、门口一株绿植与花盆", Some("日系"))
            .expect("prompt 应组装成功");
        let svg = complete_svg(
            &cfg,
            vec![msg("system", SVG_SYSTEM_PROMPT), msg("user", &user)],
        )
        .await
        .expect("图像子智能体应生成 SVG");
        assert!(svg.contains("viewBox="), "应带 viewBox");
        let tag_re = Regex::new(r#"(?i)<(circle|rect|ellipse|line|path|polygon|polyline|image)\b"#).expect("ok");
        let n = tag_re.find_iter(&svg).count();
        println!("LIVE SVG: elements={n} len={} head={}", svg.len(), svg.chars().take(60).collect::<String>());
        assert!(n >= 6, "可见图形元素应 ≥6，实际 {n}");
    }
}
