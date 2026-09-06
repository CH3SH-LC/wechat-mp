// publish.rs —— 微信草稿箱发布（公众号草稿接口）
// 链路：读 settings(wx_appid/wx_secret) → access_token（带缓存/失效重取）→ 扫描正文内嵌
// data:image 图片逐个上传为永久图片素材(得到 mmbiz url) → 组装 draft/add 草稿 JSON → 返回 media_id。
//
// 真实微信接口无法在当前开发环境验证（无测试号/无外网授权），凡需真实验证处标 LIVE-PENDING。

use std::sync::Mutex;
use std::time::Instant;

use base64::Engine as _;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

/// access_token 进程内缓存：Some((token, expires_in, 获取时刻))；lib.rs setup 已 manage。
pub struct WxTokenState(pub Mutex<Option<(String, u64, Instant)>>);

impl Default for WxTokenState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

/// 微信公众号 API 客户端。base 默认官方域名，测试只测纯函数、不联网。
pub struct WeChatClient {
    pub base: String,
}

impl Default for WeChatClient {
    fn default() -> Self {
        Self {
            base: "https://api.weixin.qq.com".into(),
        }
    }
}

// ---------- 纯函数（便于单测，不联网） ----------

/// URL 编码（按 UTF-8 字节百分比编码；保留 RFC3986 unreserved 字符）
pub fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => {
                out.push('%');
                out.push(char::from_digit((b >> 4) as u32, 16).unwrap().to_ascii_uppercase());
                out.push(char::from_digit((b & 0xf) as u32, 16).unwrap().to_ascii_uppercase());
            }
        }
    }
    out
}

fn tag_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?s)<[^>]*>").expect("静态正则合法"))
}

/// 块级标签（含 br）替换为一个空格，用于在去标签后保留词间分隔
fn block_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?is)</?(?:p|div|section|h[1-6]|li|ul|ol|blockquote|pre|table|thead|tbody|tr|br)[^>]*>"#)
            .expect("静态正则合法")
    })
}

/// 从 HTML 抽取纯文本（块级换空白、去其余标签、解少量实体、折叠空白）——用于摘要与标题提取
pub fn plain_text(html: &str) -> String {
    let spaced = block_re().replace_all(html, " ");
    let stripped = tag_re().replace_all(&spaced, "");
    let decoded = stripped
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// 从 HTML 纯文本截取前 max 个字符（digest 摘要用）
fn truncate_plain(html: &str, max: usize) -> String {
    plain_text(html).chars().take(max).collect()
}

/// 匹配 <img ... src="data:image/子类型;base64,数据" ...> 的整段 img。
/// group1 = 图片子类型(png/jpeg/…)，group2 = base64 数据。
fn data_img_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?is)<img[^>]*\bsrc="data:image/([a-z0-9.+-]+);base64,([^"]*)"[^>]*>"#)
            .expect("静态正则合法")
    })
}

/// 解析正文里的 data 图片：返回 (出现序, base64 数据) 列表。纯函数可测。
/// 说明：发布主链路直接按字节偏移重建（见 replace_data_images），本函数供扫描/测试复用。
#[allow(dead_code)]
pub fn extract_data_image(html: &str) -> Vec<(usize, &str)> {
    data_img_re()
        .captures_iter(html)
        .enumerate()
        .filter_map(|(i, caps)| caps.get(2).map(|m| (i, m.as_str())))
        .collect()
}

/// 组装微信草稿 articles JSON（draft/add 请求体）：
/// 字段按草稿接口：title/author/digest(纯文本截120)/content/content_source_url:""/
/// thumb_media_id(有则放)/need_open_comment:0/only_fans_can_comment:0
pub fn build_draft_json(title: &str, author: &str, content: &str, thumb_media_id: Option<&str>) -> Value {
    let mut article = serde_json::Map::new();
    article.insert("title".into(), Value::String(title.to_string()));
    article.insert("author".into(), Value::String(author.to_string()));
    article.insert("digest".into(), Value::String(truncate_plain(content, 120)));
    article.insert("content".into(), Value::String(content.to_string()));
    article.insert("content_source_url".into(), Value::String(String::new()));
    if let Some(t) = thumb_media_id.map(str::trim).filter(|s| !s.is_empty()) {
        article.insert("thumb_media_id".into(), Value::String(t.to_string()));
    }
    article.insert("need_open_comment".into(), Value::Number(0.into()));
    article.insert("only_fans_can_comment".into(), Value::Number(0.into()));
    serde_json::json!({ "articles": [Value::Object(article)] })
}

/// 从 html 决定标题：fallback 参数 > 首个 <h1> > <title> > 默认「公众号推文」（截 64 字符）
pub fn resolve_title(html: &str, fallback: Option<&str>) -> String {
    let t = match fallback.map(str::trim).filter(|s| !s.is_empty()) {
        Some(f) => f.to_string(),
        None => extract_tag_text(html, "h1")
            .or_else(|| extract_tag_text(html, "title"))
            .unwrap_or_else(|| "公众号推文".to_string()),
    };
    t.chars().take(64).collect()
}

fn extract_tag_text(html: &str, name: &str) -> Option<String> {
    let re = Regex::new(&format!(r#"(?is)<{name}[^>]*>(.*?)</{name}>"#)).ok()?;
    let caps = re.captures(html)?;
    let txt = plain_text(caps.get(1)?.as_str());
    if txt.is_empty() {
        None
    } else {
        Some(txt)
    }
}

// ---------- 内部工具 ----------

fn clip(s: &str) -> String {
    let mut chars = s.chars();
    let head: String = chars.by_ref().take(300).collect();
    if chars.next().is_some() {
        format!("{head}…")
    } else {
        head
    }
}

/// 解析微信接口响应体：非 JSON / errcode 非 0 → Err（含 errcode/errmsg 供失效重试判断）
fn parse_wx_json(body: &str) -> Result<Value, String> {
    let v: Value = serde_json::from_str(body)
        .map_err(|e| format!("微信接口返回非 JSON（{e}）：{}", clip(body)))?;
    if let Some(code) = v.get("errcode").and_then(|c| c.as_i64()) {
        if code != 0 {
            let msg = v.get("errmsg").and_then(|m| m.as_str()).unwrap_or("");
            return Err(format!("微信接口错误 errcode={code} errmsg={msg}"));
        }
    }
    Ok(v)
}

/// 微信 access_token 失效的错误码：40001(invalid credential) / 42001(token expired)
fn is_token_error(err: &str) -> bool {
    err.contains("errcode=40001") || err.contains("errcode=42001")
}

fn base64_decode(data: &str) -> Option<Vec<u8>> {
    let clean: String = data.chars().filter(|c| !c.is_whitespace()).collect();
    if clean.is_empty() {
        return None;
    }
    use base64::engine::general_purpose::STANDARD;
    STANDARD.decode(clean).ok()
}

/// 仅替换该 img 标签里 src="..." 的引号内内容，其余属性原样保留
fn swap_src(whole_img: &str, new_src: &str) -> String {
    let marker = "src=\"";
    match whole_img.find(marker) {
        Some(i) => {
            let start = i + marker.len();
            match whole_img[start..].find('"') {
                Some(rel) => {
                    let end = start + rel;
                    format!("{}{}{}", &whole_img[..start], new_src, &whole_img[end..])
                }
                None => whole_img.to_string(),
            }
        }
        None => whole_img.to_string(),
    }
}

fn clear_token_cache(app: &AppHandle) {
    if let Some(state) = app.try_state::<WxTokenState>() {
        if let Ok(mut g) = state.0.lock() {
            *g = None;
        }
    }
}

// ---------- 网络异步（真实微信接口，开发环境不可达；均标 LIVE-PENDING）----------

impl WeChatClient {
    /// GET {base}/cgi-bin/token?grant_type=client_credential&appid=..&secret=..（值 urlencode）
    async fn get_token(&self, appid: &str, secret: &str) -> Result<(String, u64), String> {
        let url = format!(
            "{}/cgi-bin/token?grant_type=client_credential&appid={}&secret={}",
            self.base,
            urlencode(appid),
            urlencode(secret)
        );
        let client = reqwest::Client::new();
        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("请求微信 access_token 失败（LIVE-PENDING，需真实网络/测试号）：{e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("读取微信响应失败：{e}"))?;
        if !status.is_success() {
            return Err(format!("微信 token 接口 HTTP {status}：{}", clip(&text)));
        }
        parse_token(&text)
    }

    /// 上传一张正文图片为永久图片素材（multipart POST material/add_material?type=image）。
    /// 返回可放入正文的 URL（微信 mmbiz.qpic.cn）；若无 url 但有 media_id 则返回 media_id 由调用方降级。
    /// LIVE-PENDING：桌面产物 data 图均由渲染管线输出 data:image/png，故统一按 .png + image/png 上传；
    /// 若后续正文出现 jpeg/webp 的 data 图，需按真实子类型调整文件名与 mime。
    async fn upload_material(&self, token: &str, bytes: Vec<u8>, filename: &str) -> Result<String, String> {
        let url = format!(
            "{}/cgi-bin/material/add_material?access_token={}&type=image",
            self.base, token
        );
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(format!("{filename}.png"))
            .mime_str("image/png")
            .map_err(|e| format!("构造微信上传请求失败：{e}"))?;
        let form = reqwest::multipart::Form::new().part("media", part);
        let res = reqwest::Client::new()
            .post(&url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("请求微信素材上传失败（LIVE-PENDING，需真实网络/测试号）：{e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("读取微信响应失败：{e}"))?;
        if !status.is_success() {
            return Err(format!("微信素材上传 HTTP {status}：{}", clip(&text)));
        }
        let v = parse_wx_json(&text)?;
        let url = v
            .get("url")
            .and_then(|u| u.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let media_id = v
            .get("media_id")
            .and_then(|m| m.as_str())
            .map(str::to_string)
            .unwrap_or_default();
        match url {
            Some(u) => Ok(u),
            None if !media_id.is_empty() => Ok(media_id),
            None => Err("微信素材上传成功但未返回 url/media_id".to_string()),
        }
    }

    /// POST {base}/cgi-bin/draft/add?access_token=..（body = draft JSON）→ media_id
    /// LIVE-PENDING：真实 draft/add 返回体需在微信公众平台/测试号核对（正式接口可能要求 thumb_media_id）。
    async fn draft_add(&self, token: &str, payload: Value) -> Result<String, String> {
        let url = format!("{}/cgi-bin/draft/add?access_token={}", self.base, token);
        let res = reqwest::Client::new()
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("请求微信草稿箱失败（LIVE-PENDING，需真实网络/测试号）：{e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("读取微信响应失败：{e}"))?;
        if !status.is_success() {
            return Err(format!("微信草稿接口 HTTP {status}：{}", clip(&text)));
        }
        let v = parse_wx_json(&text)?;
        v.get("media_id")
            .and_then(|m| m.as_str())
            .map(str::to_string)
            .ok_or_else(|| "草稿接口返回缺少 media_id".to_string())
    }
}

/// 解析 token 接口返回体：`{"access_token":"...","expires_in":7200}`；错误体含 errcode → Err
pub fn parse_token(body: &str) -> Result<(String, u64), String> {
    let v = parse_wx_json(body)?;
    let token = v
        .get("access_token")
        .and_then(|t| t.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "token 响应缺少 access_token".to_string())?;
    let expires = v
        .get("expires_in")
        .and_then(|e| e.as_u64())
        .ok_or_else(|| "token 响应缺少 expires_in".to_string())?;
    Ok((token.to_string(), expires))
}

/// 带进程内缓存取 token：有效期前 60 秒即认为过期重取
async fn cached_token(app: &AppHandle, client: &WeChatClient, appid: &str, secret: &str) -> Result<String, String> {
    let holder = match app.try_state::<WxTokenState>() {
        Some(h) => h,
        None => {
            // 状态未注册（异常环境）→ 退化为直接获取
            let (tok, _) = client.get_token(appid, secret).await?;
            return Ok(tok);
        }
    };
    {
        let g = holder.0.lock().unwrap_or_else(|p| p.into_inner());
        if let Some((tok, expires, at)) = &*g {
            if at.elapsed().as_secs() + 60 < *expires {
                return Ok(tok.clone());
            }
        }
    }
    let (tok, expires) = client.get_token(appid, secret).await?;
    let mut g = holder.0.lock().unwrap_or_else(|p| p.into_inner());
    *g = Some((tok.clone(), expires, Instant::now()));
    Ok(tok)
}

/// 单张 data 图上载：成功拿到 http(s) url → Some(url)；失败/无 url → None 并记 warning；
/// 若为 token 失效错误 → 直接 Err（由 publish_draft 统一重取一次）。
async fn try_upload_one(
    client: &WeChatClient,
    token: &str,
    idx: usize,
    data: &str,
    warnings: &mut Vec<String>,
) -> Result<Option<String>, String> {
    let n = idx + 1;
    let bytes = match base64_decode(data) {
        Some(b) => b,
        None => {
            warnings.push(format!("正文第 {n} 张图 base64 解码失败，已保留原样（发布前请检查图片）"));
            return Ok(None);
        }
    };
    let filename = format!("art_{idx}");
    match client.upload_material(token, bytes, &filename).await {
        Ok(repl) if repl.starts_with("http://") || repl.starts_with("https://") => Ok(Some(repl)),
        Ok(other) => {
            warnings.push(format!(
                "正文第 {n} 张图微信未返回可访问 url（{other}），已保留原样（发布前请在草稿箱核对）"
            ));
            Ok(None)
        }
        Err(e) if is_token_error(&e) => Err(e), // token 失效 → 交由上层整体重试
        Err(e) => {
            warnings.push(format!("正文第 {n} 张图上载失败：{e}，已保留原样"));
            Ok(None)
        }
    }
}

/// 扫描并替换正文内所有 data 图片（按字节偏移重建，避免同名 base64 重复误替换）：
/// 成功 → src 换为微信 url；失败/不可用 → 原文保留并记 warning。
async fn replace_data_images(
    client: &WeChatClient,
    token: &str,
    html: &str,
    warnings: &mut Vec<String>,
) -> Result<String, String> {
    let re = data_img_re();
    let mut out = String::with_capacity(html.len());
    let mut last = 0usize;
    let mut occ = 0usize;
    for caps in re.captures_iter(html) {
        let whole = caps.get(0).expect("group0 必在");
        out.push_str(&html[last..whole.start()]);
        let data = caps.get(2).map(|m| m.as_str()).unwrap_or("");
        match try_upload_one(client, token, occ, data, warnings).await {
            Ok(Some(url)) => out.push_str(&swap_src(whole.as_str(), &url)),
            Ok(None) => out.push_str(whole.as_str()),
            Err(e) => return Err(e),
        }
        last = whole.end();
        occ += 1;
    }
    out.push_str(&html[last..]);
    Ok(out)
}

/// 一次完整发布（不重试）。返回成功中文提示；token 失效会以 40001/42001 错误向上抛。
async fn publish_once(
    app: &AppHandle,
    client: &WeChatClient,
    appid: &str,
    secret: &str,
    html: &str,
    title: Option<&str>,
) -> Result<String, String> {
    let token = cached_token(app, client, appid, secret).await?;
    let ttl = resolve_title(html, title);
    let mut warnings: Vec<String> = Vec::new();
    let content = replace_data_images(client, &token, html, &mut warnings).await?;
    // LIVE-PENDING：thumb_media_id 正式发布前若接口要求封面，需用户先在公众平台上传封面并在此填入 media_id；
    // 当前传 None（不占位），草稿默认取正文首张图或平台默认封面。
    let payload = build_draft_json(&ttl, "", &content, None);
    let media_id = client.draft_add(&token, payload).await?;
    let mut msg = format!("已发布到草稿箱（media_id={media_id}）");
    if !warnings.is_empty() {
        msg.push_str(&format!(
            "\n注意：正文有 {} 张图片未上载成功，已保留原样，请在微信草稿箱核对后再群发。",
            warnings.len()
        ));
    }
    Ok(msg)
}

/// Tauri 命令：把当前正文 HTML 发布到公众号草稿箱。
/// 需要先在「设置」里配置公众号 AppID/AppSecret；返回 media_id 与提示。
/// access_token 若返回 errcode 40001/42001 → 视为过期，清缓存后整体重试一次。
#[tauri::command]
pub async fn publish_draft(app: AppHandle, html: String, title: Option<String>) -> Result<String, String> {
    let settings = crate::settings::read_settings().map_err(|e| format!("读取设置失败：{e}"))?;
    let appid = settings
        .wx_appid_str()
        .ok_or_else(|| "未配置公众号 AppID：请先在「设置 → 公众号配置（草稿箱发布）」中填写".to_string())?;
    let secret = settings
        .wx_secret_str()
        .ok_or_else(|| "未配置公众号 AppSecret：请先在「设置 → 公众号配置（草稿箱发布）」中填写".to_string())?;
    if html.trim().is_empty() {
        return Err("当前没有可发布的推文正文，请先生成一篇推文".to_string());
    }
    let client = WeChatClient::default();
    match publish_once(&app, &client, appid, secret, &html, title.as_deref()).await {
        Ok(m) => Ok(m),
        Err(e) if is_token_error(&e) => {
            // token 失效：清缓存重取一次再整体重试
            clear_token_cache(&app);
            publish_once(&app, &client, appid, secret, &html, title.as_deref()).await
        }
        Err(e) => Err(e),
    }
}

// ---------- 单测（纯函数，不联网） ----------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_token_ok() {
        let body = r#"{"access_token":"ACC_TOK_1","expires_in":7200}"#;
        let (tok, exp) = parse_token(body).expect("ok");
        assert_eq!(tok, "ACC_TOK_1");
        assert_eq!(exp, 7200);
    }

    #[test]
    fn parse_token_error_or_missing_field_errs() {
        let err_body = r#"{"errcode":40013,"errmsg":"invalid appid"}"#;
        let e = parse_token(err_body).expect_err("应报错");
        assert!(e.contains("40013"), "e={e}");
        let missing = r#"{"access_token":"x"}"#;
        assert!(parse_token(missing).is_err(), "缺 expires_in 应报错");
        let missing2 = r#"{"expires_in":7200}"#;
        assert!(parse_token(missing2).is_err(), "缺 access_token 应报错");
        assert!(parse_token("not json").is_err());
    }

    #[test]
    fn extract_data_image_finds_multiple_in_order() {
        let html = r#"<p>头图</p><img src="data:image/png;base64,AAAA" style="width:100%"><p>中间</p><img style="border:0;width:56%" src="data:image/png;base64,BBBB"><img src="data:image/png;base64,CCCC"/>"#;
        let got = extract_data_image(html);
        assert_eq!(got.len(), 3);
        assert_eq!(got[0], (0, "AAAA"));
        assert_eq!(got[1], (1, "BBBB"));
        assert_eq!(got[2], (2, "CCCC"));
    }

    #[test]
    fn extract_data_image_none_when_no_data_uri() {
        let html = r#"<img src="https://example.com/a.png"><p>无内嵌图</p>"#;
        assert!(extract_data_image(html).is_empty());
        assert!(extract_data_image("纯文本，没有图片").is_empty());
    }

    #[test]
    fn build_draft_json_fields_and_digest_truncated() {
        let long = format!("正文开头。{}", "字".repeat(200));
        let content = format!("<section style=\"margin:0\"><p>{long}</p></section>");
        let v = build_draft_json("标题甲", "作者乙", &content, None);
        let art = &v["articles"][0];
        assert_eq!(art["title"], "标题甲");
        assert_eq!(art["author"], "作者乙");
        assert_eq!(art["content_source_url"], "");
        assert_eq!(art["need_open_comment"], 0);
        assert_eq!(art["only_fans_can_comment"], 0);
        assert_eq!(art["content"], content);
        let digest = art["digest"].as_str().unwrap();
        assert_eq!(digest.chars().count(), 120, "digest 应截 120 字");
        assert!(digest.starts_with("正文开头。"), "digest 应来自纯文本去标签");
        assert!(art.get("thumb_media_id").is_none(), "无封面时不应携带 thumb_media_id");
    }

    #[test]
    fn build_draft_json_thumb_media_id_optional() {
        let with = build_draft_json("t", "a", "<p>内容</p>", Some("thumb_abc"));
        assert_eq!(with["articles"][0]["thumb_media_id"], "thumb_abc");
        let empty = build_draft_json("t", "a", "<p>内容</p>", Some("   "));
        assert!(empty["articles"][0].get("thumb_media_id").is_none(), "空白封面应视为无");
    }

    #[test]
    fn build_draft_json_digest_plain_text_short() {
        let v = build_draft_json("t", "a", "<h1>副标题</h1><p>一段&nbsp;正文，<b>加粗</b>。</p>", None);
        let digest = v["articles"][0]["digest"].as_str().unwrap();
        assert_eq!(digest, "副标题 一段 正文，加粗。");
    }

    #[test]
    fn urlencode_special_chars() {
        assert_eq!(urlencode("a b&c/d=e中文"), "a%20b%26c%2Fd%3De%E4%B8%AD%E6%96%87");
        assert_eq!(urlencode("abc-_.~AZ09"), "abc-_.~AZ09");
        assert_eq!(urlencode(""), "");
    }

    #[test]
    fn resolve_title_prefers_param_then_h1_then_title_then_default() {
        let html = r#"<section><h1>H1 主标题</h1><p>正文</p></section><title>页面标题</title>"#;
        assert_eq!(resolve_title(html, Some(" 参数标题 ")), "参数标题");
        assert_eq!(resolve_title(html, None), "H1 主标题");
        let no_h1 = "<html><head><title>页签标题</title></head><body>正文</body></html>";
        assert_eq!(resolve_title(no_h1, None), "页签标题");
        assert_eq!(resolve_title("<p>无标题</p>", None), "公众号推文");
    }

    // ---------- 本地伪造微信服务器：端到端网络契约单测（只走 localhost，不发外网） ----------

    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// 读一个 HTTP 请求：返回 (首行, 请求行路径, 头部文本, body)
    async fn read_req(stream: &mut tokio::net::TcpStream) -> (String, String, String, String) {
        let mut buf: Vec<u8> = Vec::new();
        let mut tmp = [0u8; 8192];
        while !buf.windows(4).any(|w| w == b"\r\n\r\n") && buf.len() < 131_072 {
            let n = stream.read(&mut tmp).await.unwrap_or(0);
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&tmp[..n]);
        }
        let s = String::from_utf8_lossy(&buf).into_owned();
        let (head, rest) = match s.find("\r\n\r\n") {
            Some(p) => (&s[..p], &s[p + 4..]),
            None => (&s[..], ""),
        };
        let first = head.lines().next().unwrap_or("").to_string();
        let path = first.split_whitespace().nth(1).unwrap_or("").to_string();
        let mut cl: u64 = 0;
        for line in head.lines() {
            if let Some(v) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                cl = v.trim().parse().unwrap_or(0);
            }
        }
        let mut body = rest.as_bytes().to_vec();
        while (body.len() as u64) < cl {
            let n = stream.read(&mut tmp).await.unwrap_or(0);
            if n == 0 {
                break;
            }
            body.extend_from_slice(&tmp[..n]);
        }
        let blen = (cl as usize).min(body.len());
        (first, path, head.to_string(), String::from_utf8_lossy(&body[..blen]).into_owned())
    }

    async fn respond(stream: &mut tokio::net::TcpStream, status: &str, json: &str) {
        let body = json.as_bytes();
        let resp = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        let _ = stream.write_all(resp.as_bytes()).await;
        let _ = stream.write_all(body).await;
    }

    /// 完整发布网络链路（token → 素材上传替换 data 图 → draft/add）对着本地假微信服务器跑通，
    /// 校验请求形状与返回解析（消解无真实测试号时的接口契约风险；真实 errcode/字段仍待测试号 LIVE-PENDING）。
    #[tokio::test]
    async fn publish_chain_against_local_fake_wx() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        let server = tokio::spawn(async move {
            let mut token_hits = 0usize;
            let mut material_hits = 0usize;
            let mut draft_body = String::new();
            for _ in 0..3 {
                let (mut sock, _) = listener.accept().await.expect("accept");
                let (_first, path, _head, body) = read_req(&mut sock).await;
                if path.starts_with("/cgi-bin/token") {
                    token_hits += 1;
                    respond(&mut sock, "200 OK", r#"{"access_token":"TOK_TEST","expires_in":7200}"#).await;
                } else if path.starts_with("/cgi-bin/material/add_material") {
                    material_hits += 1;
                    respond(
                        &mut sock,
                        "200 OK",
                        r#"{"url":"https://mmbiz.qpic.cn/mmbiz_png/x/1.png","media_id":"m_1"}"#,
                    )
                    .await;
                } else if path.starts_with("/cgi-bin/draft/add") {
                    draft_body = body.clone();
                    respond(&mut sock, "200 OK", r#"{"media_id":"draft_ok"}"#).await;
                } else {
                    respond(&mut sock, "404 Not Found", r#"{"errcode":-1,"errmsg":"no route"}"#).await;
                }
            }
            (token_hits, material_hits, draft_body)
        });

        let client = WeChatClient { base: format!("http://{addr}") };
        let (tok, exp) = client.get_token("wx_appid_abc", "wx_secret_中文&").await.expect("token 应成功");
        assert_eq!(tok, "TOK_TEST");
        assert_eq!(exp, 7200);

        // 一幅合法极小 PNG 的 base64 作为内嵌 data 图
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        let html = format!(
            "<section><h1>测试标题</h1><p>正文第一段。</p><img src=\"data:image/png;base64,{png}\" style=\"width:100%\"></section>"
        );
        let mut warnings: Vec<String> = Vec::new();
        let content = replace_data_images(&client, &tok, &html, &mut warnings).await.expect("图片替换应成功");
        assert!(warnings.is_empty(), "warnings={warnings:?}");
        assert!(
            content.contains("https://mmbiz.qpic.cn/mmbiz_png/x/1.png"),
            "data 图应被替换为微信 url"
        );
        assert!(!content.contains("data:image/png"), "不应残留 data 图");

        let title = resolve_title(&content, None);
        let payload = build_draft_json(&title, "", &content, None);
        let mid = client.draft_add(&tok, payload).await.expect("草稿接口应成功");
        assert_eq!(mid, "draft_ok");

        let (th, mh, db) = server.await.expect("server join");
        assert_eq!(th, 1, "token 只应请求一次");
        assert_eq!(mh, 1, "应上传 1 张素材图");
        assert!(db.contains("https://mmbiz.qpic.cn"), "draft 请求体应含替换后的微信 url");
        assert!(!db.contains("data:image"), "draft 请求体不应含 data 图");
        assert!(db.contains("测试标题"), "draft 请求体应含标题");
    }
}
