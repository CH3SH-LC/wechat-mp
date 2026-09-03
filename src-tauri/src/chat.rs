// chat.rs —— 极简 LLM 客户端：OpenAI 兼容流式对话（SSE），事件推送 delta
// 密钥：env DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml；端点/模型可 env 覆盖。

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
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
    let model = pick_text(read_env("DEEPSEEK_MODEL").as_deref(), &file.model, "deepseek-chat");
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

    #[tokio::test]
    #[ignore = "需要真实 DeepSeek API 与密钥（env DEEPSEEK_API_KEY 或 ~/.dsh/.credentials.yaml）"]
    async fn live_deepseek_smoke() {
        let cfg = resolve_config().expect("应能解析到密钥配置");
        let mut got = String::new();
        let reply = stream_chat(
            &cfg,
            vec![ChatMsg {
                role: "user".into(),
                content: "只回复六个字：桌面链路测试通过".into(),
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
                ChatMsg { role: "system".into(), content: system.into() },
                ChatMsg { role: "user".into(), content: user.into() },
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
}
