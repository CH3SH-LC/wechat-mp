// chat.rs —— 极简 LLM 客户端：OpenAI 兼容流式对话（SSE），事件推送 delta
// 密钥：env DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml；端点/模型可 env 覆盖。

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::cancel::{self, CancelState};
use crate::trace::{self, ReqTimer};

// ---------- 网络超时（修复计划阶段 4 第 4 条，2026-09-28）----------
// 此前所有请求都没有应用级超时：网络卡住时界面会一直等下去，用户只能干等或强杀进程。
// 这里给出**初始值**（计划原文即"初始超时参数作为可配置值"），全部可用环境变量覆盖，
// 以便用可控假服务做延迟/超时测试（见本文件 tests::fake_server）。
// 注意：**流式对话不设总超时**——写一篇长文可能持续数分钟，掐总时长会杀掉正常创作；
// 它只受连接超时约束。180 秒这一档只作用于"单次非流式请求"（绘图、补描述、prep、视觉复核）。

/// 连接超时（秒）：所有请求共用
pub const DEFAULT_CONNECT_TIMEOUT_SECS: u64 = 15;
/// 单次非流式请求总超时（秒）：绘图 / 补 brief / prep / 视觉复核。
///
/// **为什么是 180 而不是"与输出上限相称"**（2026-09-29 复核，改数值前先看这段）：
/// 实测吞吐约 268 token/秒，180 秒 ≈ 4.8 万 token；而全部实测样本里用掉最多的一次是
/// 21238 个 completion token（画图，耗时 83.6 秒）——180 秒对已知最坏样本仍有 2 倍以上余量。
/// 反方向算：模型上限 393216 token 折合约 1470 秒，**上限永远撞不到，先到的一定是超时**。
/// 把超时抬到与上限相称，等于"网络卡住时界面干等 25 分钟"，比 180 秒失败糟得多。
/// 现有实测数据不支持更长的等待，故**保留 180**；要改必须带新的实测依据（例如某类真实请求
/// 稳定超过 150 秒），不许凭感觉调。
pub const DEFAULT_NONSTREAM_TIMEOUT_SECS: u64 = 180;

fn env_secs(name: &str, default: u64) -> u64 {
    read_env(name)
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or(default)
}

pub fn connect_timeout_secs() -> u64 {
    env_secs("DEEPSEEK_CONNECT_TIMEOUT", DEFAULT_CONNECT_TIMEOUT_SECS)
}

pub fn nonstream_timeout_secs() -> u64 {
    env_secs("DEEPSEEK_NONSTREAM_TIMEOUT", DEFAULT_NONSTREAM_TIMEOUT_SECS)
}

/// 构造 HTTP 客户端失败时的统一错误串（构造失败极罕见，但绝不能因此静默失去超时）
fn client_build_err(e: reqwest::Error) -> String {
    format!("构造 HTTP 客户端失败：{e}")
}

/// 流式请求客户端：只设连接超时（总时长不设限，见上文）。
///
/// **为什么返回 Result 而不是"失败就退一个兜底 client"**：builder 失败（少见的 TLS/后端初始化
/// 问题）时，原先的 `unwrap_or_else(|_| reqwest::Client::new())` 会给出一个**完全没有任何超时**
/// 的客户端——等于把上文刚加上的超时悄悄丢掉，网络卡住时界面又会一直等下去（正是本轮要修的
/// 那类"看起来正常、实则退化"的问题）。如实报错让失败可见，比静默降级安全。
fn stream_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(connect_timeout_secs()))
        .build()
        .map_err(client_build_err)
}

/// 非流式请求客户端：连接超时 + 单次总超时（返回 Result 的理由同上）
fn nonstream_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(connect_timeout_secs()))
        .timeout(Duration::from_secs(nonstream_timeout_secs()))
        .build()
        .map_err(client_build_err)
}

/// 单次非流式请求的**输出上限兜底**（token）：仅在运行时查询失败时使用。
/// 取值依据见下方 `ModelLimits` 处的实测记录——32000 已被真机验证可用，查询失败时用它不会退化。
pub const FALLBACK_NONSTREAM_MAX_TOKENS: u32 = 32000;

// ---------- 模型真实上限：运行时查询并缓存（2026-09-29）----------
//
// 为什么不写死：**猜低**会被静默截断（真机实测：上限 8000 时绘图请求
// `finish_reason=length` + `completion` 正好用满 8000 + 正文为空，画图必然失败）；
// **猜高**会被服务端 400 拒掉（实测 `max_tokens=400000` →
// `Invalid max_tokens value, the valid range of max_tokens is [1, 393216]`，
// 而 400 属于**不重试**的 auth 类，整次绘图直接失败）。两种猜错都很难查。
// 服务端自己就给了答案，那就直接问它。
//
// 实测记录（GET /models，2026-09-29）：
//   deepseek-flash（DeepSeek-V4.1-Flash）：context_window 1048576，max_output_tokens 393216，
//     输入支持 text+image，effort 支持 low/high/max 且 **默认 high**
//   deepseek-v4-pro（DeepSeek-V4-Pro）：context_window 1048576，max_output_tokens 393216
//
// 与超时的关系（2026-09-29 复核，别把这两者混为一谈）：
//   上限（393216）**只负责"不去人为截断"**——它是服务端允许的天花板，不是"应该用满"的目标；
//   真正兜住跑飞的是非流式总超时（`nonstream_timeout_secs`，默认 180 秒）。
//   按实测吞吐约 268 token/秒折算：180 秒 ≈ 4.8 万 token，而 393216 token 需要约 1470 秒。
//   也就是**超时永远先到**，上限不会成为实际等待时间的决定因素；两个数值都保留，
//   但只有超时是"能兜住跑飞"的那个（依据与取舍见 DEFAULT_NONSTREAM_TIMEOUT_SECS 的注释）。

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ModelLimits {
    pub max_output_tokens: u32,
}

/// 查询失败时的回退（与 `fallback_limits()` 同值，集中一处便于断言）
pub const FALLBACK_MAX_OUTPUT_TOKENS: u32 = FALLBACK_NONSTREAM_MAX_TOKENS;

pub fn fallback_limits() -> ModelLimits {
    ModelLimits { max_output_tokens: FALLBACK_MAX_OUTPUT_TOKENS }
}

type LimitsCache = std::sync::Mutex<std::collections::HashMap<String, CachedLimits>>;

/// 查询结果的缓存项。**失败也要缓存**——否则每次请求都会再打一次 `/models`：
/// 离线或端点被拦时，等于给每个绘图/补描述请求都白加一次超时等待。
#[derive(Clone, Copy, Debug)]
enum CachedLimits {
    /// 查到了：这个值在进程内一直有效（模型上限不会来回变）
    Ok(ModelLimits),
    /// 没查到：短暂记住失败，过期后再试一次
    Failed(std::time::Instant),
}

/// 失败结果的缓存时长。够长到避免"每个请求都探一次"，够短到网络恢复后能自动接上。
pub const LIMITS_FAILURE_TTL: Duration = Duration::from_secs(60);

fn limits_cache() -> &'static LimitsCache {
    static CACHE: OnceLock<LimitsCache> = OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

/// 缓存键：端点 + 模型。**必须带上端点**——换 base_url 就可能换服务，
/// 只按模型名缓存会把 A 服务的上限用到 B 服务上（测试里两个假服务同名模型时就会撞）。
fn limits_key(cfg: &LlmConfig) -> String {
    format!("{}|{}", cfg.base_url, cfg.model)
}

/// 失败缓存项是否仍在有效期内。**为什么单独抽一个纯函数**：TTL 边界（"60 秒内不重探、
/// 一到点就重探"）是这段缓存逻辑里唯一会随时间变化的行为，把它写成"把现在传进来"的纯函数，
/// 就能在测试里用任意时刻直接断言边界，而不必真等 60 秒（真等会让这条测试永远跑不进 CI 的耐心范围）。
fn failure_is_fresh(at: std::time::Instant, now: std::time::Instant) -> bool {
    now.saturating_duration_since(at) < LIMITS_FAILURE_TTL
}

/// 取该模型的真实上限（按 端点+模型 缓存，成功过一次就不再查）。
/// **绝不返回错误**：查不到就退回已验证可用的兜底值，保证离线/异常时行为不变。
pub async fn model_limits(cfg: &LlmConfig) -> ModelLimits {
    let key = limits_key(cfg);
    {
        let g = limits_cache().lock().unwrap_or_else(|e| e.into_inner());
        match g.get(&key) {
            Some(CachedLimits::Ok(l)) => return *l,
            Some(CachedLimits::Failed(at)) if failure_is_fresh(*at, std::time::Instant::now()) => {
                return fallback_limits()
            }
            _ => {}
        }
    }
    let fetched = fetch_model_limits(cfg).await;
    let mut g = limits_cache().lock().unwrap_or_else(|e| e.into_inner());
    match fetched {
        Some(l) => {
            g.insert(key, CachedLimits::Ok(l));
            l
        }
        None => {
            g.insert(key, CachedLimits::Failed(std::time::Instant::now()));
            fallback_limits()
        }
    }
}

/// 按 **key** 清掉本端点+模型的上限缓存（供测试使用）。
///
/// **为什么不提供"全表清空"**：全表清空在只有一个调用者时看不出问题，但它让任何新增调用者
/// 都能顺手删掉别的测试的缓存条目——对方于是多探一次 `/models`，变成顺序相关的偶发假红。
/// 按 key 清则各测试只影响自己（key 含 base_url，而假服务每个实例有唯一路径前缀，天然隔离）。
#[cfg(test)]
fn clear_limits_key(cfg: &LlmConfig) {
    limits_cache()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .remove(&limits_key(cfg));
}

/// GET /models 并挑出当前模型那一项。查询本身用短超时（10 秒）——它只是旁路信息，
/// 不能因为它慢而拖住创作。
/// 构造客户端失败 → 返回 None（退兜底值）：这里是"旁路信息"，失败不该升级成错误，
/// 与 `stream_client` / `nonstream_client` 的"如实报错"口径不同，是有意为之。
async fn fetch_model_limits(cfg: &LlmConfig) -> Option<ModelLimits> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(connect_timeout_secs()))
        .timeout(Duration::from_secs(10))
        .build()
        .ok()?;
    let res = client
        .get(format!("{}/models", cfg.base_url))
        .header("Authorization", format!("Bearer {}", cfg.key))
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    let v: serde_json::Value = res.json().await.ok()?;
    let item = v["data"]
        .as_array()?
        .iter()
        .find(|m| m["id"].as_str() == Some(cfg.model.as_str()))?;
    let out = item["max_output_tokens"].as_u64()?.min(u32::MAX as u64) as u32;
    if out == 0 {
        return None;
    }
    Some(ModelLimits { max_output_tokens: out })
}

/// 把想要的输出额度收敛到模型真实上限内（超出会被服务端 400 拒掉，见上文实测）。
fn clamp_to_model(want: u32, limits: ModelLimits) -> u32 {
    want.min(limits.max_output_tokens).max(1)
}

/// 非流式输出上限：环境变量 > 模型真实上限 > 兜底。
/// 环境变量仍然最高优先，便于故意压低做实验；但同样会被模型上限钳制。
fn nonstream_max_tokens(limits: ModelLimits) -> u32 {
    let want = read_env("DEEPSEEK_NONSTREAM_MAX_TOKENS")
        .and_then(|s| s.trim().parse::<u32>().ok())
        .filter(|n| *n > 0)
        .unwrap_or(limits.max_output_tokens);
    clamp_to_model(want, limits)
}

/// 非流式请求用的推理档位。**显式写出来**而不是依赖服务端默认——
/// `/models` 显示 deepseek-flash 默认是 `high`，写出来才不会因默认值变化而悄悄降级。
///
/// 为什么**不用 low**（2026-09-29 实测，别想当然）：拿同一个画图提示各跑 4 次，
/// 用产品自己的确定性闸门 `checkSvgQuality` 判定——`high` **4/4 过闸**；
/// `low` **0/4 过闸**，四次全部"有若干可见元素完全落在画布外"（1/4/6/13 个不等）。
/// 也就是说降档画图省不下多少（42.3s vs 50.1s、12.7K vs 14.6K，约 15%），
/// 却会让元素跑出画布。单次采样曾让我误以为 low 快 2.6 倍——那是噪声：
/// 同一档位不同样本的耗时波动就有 2 倍以上（32.6s ~ 71.9s）。**至少 4 个样本才够判断。**
pub const NONSTREAM_EFFORT: &str = "high";

/// 服务端限流提示的转发前缀（修复计划阶段 4 第 3 条："遵循可用的重试等待提示"）。
/// HTTP 的 `Retry-After` 只在响应头里，而前端拿到的是错误字符串——用与既有 `CLARIFY:`
/// 同一套文本协议把它带过去。**只认秒数形式**；HTTP-date 形式不解析（如实不猜），
/// 上限 10 分钟防止异常值把预算卡死。
pub const RETRY_HINT_PREFIX: &str = "RETRY_HINT:";
const RETRY_HINT_MAX_SECS: u64 = 600;

/// 解析 `Retry-After` 头的**取值**（纯函数，可测）：只认秒数形式，上限 `RETRY_HINT_MAX_SECS`。
/// HTTP-date 形式一律不解析（如实不猜，见 `RETRY_HINT_PREFIX` 处的说明）。
///
/// **为什么解析逻辑必须是生产函数**：此前测试模块里另写了一份只接受 `&str` 的等价副本，
/// 4 条断言全打在那份副本上——生产实现被改坏（例如忘了封顶）测试也不会红，属于假绿。
/// 现在头取值与解析分离，测试直接调用这里的生产实现。
pub fn parse_retry_after(raw: &str) -> Option<u64> {
    raw.trim().parse::<u64>().ok().map(|s| s.min(RETRY_HINT_MAX_SECS))
}

/// 从响应头里取出 `Retry-After` 并按秒数解析（取头 + 解析两步，解析逻辑见 `parse_retry_after`）
fn retry_after_secs(res: &reqwest::Response) -> Option<u64> {
    let raw = res.headers().get("retry-after")?.to_str().ok()?;
    parse_retry_after(raw)
}

/// 统一的 API 错误串：状态码 + 截断正文 + 可选限流提示
fn api_error(status: u16, hint: Option<u64>, body: &str) -> String {
    let mut s = format!("DeepSeek API 错误 {status}：{}", trace::truncate(body, 240));
    if let Some(h) = hint {
        s.push_str(&format!(" {RETRY_HINT_PREFIX}{h}"));
    }
    s
}

/// 对话消息。content 用 Option 以便承载"assistant 发起 tool_calls 时 content 为空/null"；
/// tool_call_id / tool_calls 仅在工具回合携带（DeepSeek OpenAI 兼容格式）。
///
/// P2（2026-09-24 调查 §8）：新增 `images` 侧车承载图像输入（data URL）。
/// 它**不是** API 的线上形态——线上要的是 content 内容块数组，由 `to_wire` 折叠生成。
/// 这里刻意标 `skip_serializing`，使"直接序列化 ChatMsg 发给 API"在结构上不可能泄漏 images 键；
/// 同时保留 `content: Option<String>`，避免波及 prep/App/ChatPane 的公共类型与既有文本链路。
#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMsg {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCallWire>,
    /// 本回合附带的参考图（`data:image/png;base64,…`）。仅最后一条 user 消息会被送上 API。
    #[serde(default, skip_serializing)]
    pub images: Vec<String>,
}

/// 单条消息 → API 线上形态（纯函数，可测）。
/// 文本路径的输出与改动前 serde 直接序列化**逐字节一致**（字段顺序：role, content, tool_call_id?, tool_calls?）。
/// 依据官方文档：图像只允许出现在 user 消息，形态为 `{"type":"image_url","image_url":{"url":"data:…"}}`。
fn to_wire(m: &ChatMsg, allow_images: bool) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    obj.insert("role".into(), serde_json::json!(m.role));
    if !m.tool_calls.is_empty() {
        // assistant 请求工具时 content 必须为 null（透传 tool_calls）
        obj.insert("content".into(), serde_json::Value::Null);
    } else if allow_images && !m.images.is_empty() {
        let mut parts: Vec<serde_json::Value> = Vec::new();
        let text = m.content.clone().unwrap_or_default();
        if !text.is_empty() {
            parts.push(serde_json::json!({ "type": "text", "text": text }));
        }
        for url in &m.images {
            parts.push(serde_json::json!({ "type": "image_url", "image_url": { "url": url } }));
        }
        obj.insert("content".into(), serde_json::Value::Array(parts));
    } else {
        obj.insert(
            "content".into(),
            match &m.content {
                Some(c) => serde_json::json!(c),
                None => serde_json::Value::Null,
            },
        );
    }
    if let Some(id) = &m.tool_call_id {
        obj.insert("tool_call_id".into(), serde_json::json!(id));
    }
    if !m.tool_calls.is_empty() {
        obj.insert("tool_calls".into(), serde_json::json!(m.tool_calls));
    }
    serde_json::Value::Object(obj)
}

/// 整段对话 → API 请求体里的 messages 数组。
/// **只有最后一条 user 消息**允许携带图像：中间轮次的图片既不受 API 支持，也纯属重复计费。
/// 这个函数是通往 API 的唯一序列化入口——不要再用 `json!({"messages": messages})` 直接塞 ChatMsg。
fn build_messages(msgs: &[ChatMsg]) -> Vec<serde_json::Value> {
    let last_user = msgs.iter().rposition(|m| m.role == "user");
    msgs.iter()
        .enumerate()
        .map(|(i, m)| to_wire(m, Some(i) == last_user))
        .collect()
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

// ---------- 临时模型锁定（用户 2026-09-24 要求："所有模型都切换为 deepseek-flash，暂时禁止一切别的模型"） ----------
// Some("…") = 锁定：主模型 / 画图模型 / 看图模型**一律**用这个名字，忽略环境变量与设置里的其它取值。
// 改回 None 即恢复"env > 应用设置 > 默认"的正常解析，不需要改别处代码。
// 注意：被忽略的取值不会静默 —— 解析结果与设置面板都会显示处于锁定状态。
const LOCKED_MODEL: Option<&str> = Some("deepseek-flash");
const DEFAULT_MODEL: &str = "deepseek-flash";

/// 把解析出来的模型名统一收敛到锁定值（未锁定时原样返回）
fn lock_model(resolved: String) -> String {
    match LOCKED_MODEL {
        Some(m) => m.to_string(),
        None => resolved,
    }
}

/// 主模型解析：env > 设置 > 默认，最后经锁定收敛。抽成纯函数以便直接断言锁定行为。
fn resolve_model(env: Option<&str>, file: &str) -> String {
    lock_model(pick_text(env, file, DEFAULT_MODEL))
}

/// 当前是否处于模型锁定状态（供设置面板展示）
pub fn model_locked() -> bool {
    LOCKED_MODEL.is_some()
}

/// 锁定值（未锁定时为空串）
pub fn locked_model_name() -> String {
    LOCKED_MODEL.unwrap_or("").to_string()
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
    let model = resolve_model(read_env("DEEPSEEK_MODEL").as_deref(), &file.model);
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

/// 把新到的一块 SSE 网络字节送入行缓冲，抽取出所有已凑成完整行（以 \n 结尾）的 delta。
/// 关键：网络 chunk 可能把多字节 UTF-8 字符（如中文）劈成两半——本函数**按字节累积**，
/// 只对完整行一次性解码，避免对每块独立 from_utf8_lossy 造成行尾乱码（U+FFFD）。
/// `on_meta` 另接 finish_reason / usage（修复计划阶段 1 的请求证据），正文消费者不受影响。
fn feed_sse_bytes(
    buf: &mut Vec<u8>,
    chunk: &[u8],
    mut on_delta: impl FnMut(String),
    mut on_meta: impl FnMut(&StreamMeta),
) {
    buf.extend_from_slice(chunk);
    loop {
        let Some(pos) = buf.iter().position(|&b| b == b'\n') else {
            break; // 尚无完整行，留待下一块
        };
        // 取出含 \n 的一整行字节（含换行；去掉结尾 \n 再整体解码，保证不劈字符）
        let line_bytes: Vec<u8> = buf.drain(..=pos).collect();
        let line = String::from_utf8_lossy(&line_bytes[..line_bytes.len() - 1]);
        if let Some(delta) = sse_delta(line.trim()) {
            on_delta(delta);
        }
        if let Some((finish, usage)) = sse_meta(line.trim()) {
            on_meta(&StreamMeta { finish_reason: finish, usage });
        }
    }
}

/// 流式响应里除正文之外的元信息（修复计划阶段 1：请求证据要能落在日志里）。
/// 都是"服务返回时才记"——拿不到就是 None，不编造。
#[derive(Default, Clone, Debug)]
pub struct StreamMeta {
    pub finish_reason: Option<String>,
    pub usage: Option<serde_json::Value>,
}

/// 从一行 SSE 里抽取 finish_reason / usage（缺失返回 None；非 data 行一律 None）
fn sse_meta(line: &str) -> Option<(Option<String>, Option<serde_json::Value>)> {
    let l = line.trim();
    if !l.starts_with("data:") {
        return None;
    }
    let data = l["data:".len()..].trim();
    if data.is_empty() || data == "[DONE]" {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(data).ok()?;
    let finish = v["choices"][0]["finish_reason"].as_str().map(str::to_string);
    // usage 通常在最后一个 chunk（choices 为空）里出现；也可能根本不返回
    let usage = v.get("usage").filter(|u| !u.is_null()).cloned();
    if finish.is_none() && usage.is_none() {
        return None;
    }
    Some((finish, usage))
}

/// 流式回合预算（P1，2026-09-24 调查 §5）：按任务类型选推理强度与**期望**输出上限。
/// **默认值（未指定 turn）与改动前逐字相同**：`max` / 64000。
/// 调查明确要求"按任务配置推理/输出预算，先测效果再选默认"，因此这里只提供旋钮、
/// 不静默降级——想降耗需要先跑 live 对比（见 scripts 与 PROGRESS 记录）再改默认。
///
/// 2026-09-29 补充：返回值是"期望值"，实际发送前会经 `clamp_to_model` 收敛到模型真实上限
/// （见 `ModelLimits`）。实测依据：真实桌面创作一次用掉 22821 个 completion token，
/// 而独立探针里 2000 字长文只用 4299——**推理开销随上下文复杂度放大，不随正文长度**。
/// 64000 对已知样本有 2.8 倍余量，且流式没有总超时（跑飞只能靠用户按停止），
/// 故**保留原档位**、只加钳制；真正需要放开的是非流式那一档（那才是实际出事的地方）。
fn turn_budget(turn: Option<&str>) -> (&'static str, u32) {
    match turn.map(str::trim) {
        Some("chat") => ("low", 8000),
        Some("revise") => ("high", 32000),
        Some("write") => ("max", 64000),
        _ => ("max", 64000),
    }
}

/// 带预算的流式对话核心。`meta` 回填服务返回的 finish_reason / usage（供请求日志使用）。
async fn stream_chat_budgeted(
    cfg: &LlmConfig,
    messages: Vec<ChatMsg>,
    effort: &str,
    max_tokens: u32,
    meta: &mut StreamMeta,
    mut on_delta: impl FnMut(String),
) -> Result<String, String> {
    let client = stream_client()?;
    let url = format!("{}/chat/completions", cfg.base_url);
    let body = serde_json::json!({
        "model": cfg.model,
        "stream": true,
        "reasoning_effort": effort,
        "max_tokens": max_tokens,
        "messages": build_messages(&messages),
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
    let mut buf: Vec<u8> = Vec::new();
    let mut collected = String::new();
    while let Some(chunk) = stream
        .chunk()
        .await
        .map_err(|e| format!("响应流中断：{e}"))?
    {
        feed_sse_bytes(
            &mut buf,
            &chunk,
            |d| {
                collected.push_str(&d);
                on_delta(d);
            },
            |m| {
                if let Some(f) = &m.finish_reason {
                    meta.finish_reason = Some(f.clone());
                }
                if m.usage.is_some() {
                    meta.usage = m.usage.clone();
                }
            },
        );
    }
    // EOF 冲刷（O-8 修复）：流结束后 buffer 残留的末块（无尾部换行）也应解析
    if !buf.is_empty() {
        let tail_str = String::from_utf8_lossy(&buf).to_string();
        if let Some(delta) = sse_tail_delta(&tail_str) {
            collected.push_str(&delta);
            on_delta(delta);
        }
        if let Some((finish, usage)) = sse_meta(&tail_str) {
            if let Some(f) = finish {
                meta.finish_reason = Some(f);
            }
            if usage.is_some() {
                meta.usage = usage;
            }
        }
    }
    Ok(collected)
}

/// 流式回合"一个字都没返回"的统一错误串。**必须与 `classify_error` 的 `empty` 分类口径一致**
/// （该函数按 `未返回内容` 判 empty，前端已能显示 empty），否则前端会落到 unknown。
///
/// 为什么需要它：`HTTP 200` 不等于"有内容"。企业网关注入的 HTML 200、或服务端一个 delta 都不发时，
/// `feed_sse_bytes` 认不出任何 `data:` 行 → 零增量，而零 token 此前会被当成**成功**返回：
/// 用户看到的是空气泡且没有任何报错，日志里却记着 `ok=true, responseLength=0`。
pub const EMPTY_REPLY_ERR: &str = "模型未返回内容";

/// 把一次模型调用的失败归到一个稳定的分类（与前端 `FailureClass` 同集合）。
/// 分类依据是**当前的错误串与响应事实**，不做推测；认不出归 `unknown`。
pub fn classify_error(err: &str) -> &'static str {
    let e = err.to_lowercase();
    if e.contains("cancel") || err.contains("取消") || e.contains("abort") {
        return "cancel";
    }
    if e.contains("未返回内容") || e.contains("content 为空") || e.contains("空返回") || e.contains("empty") {
        return "empty";
    }
    if e.contains("未返回 svg") || e.contains("未返回图像") {
        // 注意：调用方在正文确实为空时应改判 empty（见 gen_svg 分支）
        return "no-svg";
    }
    // 有状态码时按状态码判，先把两类的界限钉死（阶段 4 第 3 条）：
    //   鉴权/参数错（401/403/4xx 其余）→ auth，**不重试**；
    //   限流与暂时性服务端错误（429/5xx）→ network，可在剩余预算内重试一次。
    if let Some(code) = http_status_of(err) {
        if code == 429 || (500..600).contains(&code) {
            return "network";
        }
        if (400..500).contains(&code) {
            return "auth";
        }
    }
    if e.contains("timeout")
        || e.contains("timed out")
        || e.contains("connection")
        || e.contains("connect")
        || e.contains("请求 deepseek 失败")
        || e.contains("响应流中断")
        || e.contains("读取响应失败")
        || e.contains("dns")
    {
        return "network";
    }
    "unknown"
}

/// 从错误串里取出 `DeepSeek API 错误 <status>` 的状态码（纯函数，可测）
fn http_status_of(err: &str) -> Option<u16> {
    let m = Regex::new(r"API 错误\s+(\d{3})").ok()?.captures(err)?;
    m.get(1)?.as_str().parse::<u16>().ok()
}

/// 流式增量事件。**带 runId**（阶段 4 第 5 条）：用户按下停止后，属于旧回合的迟到增量
/// 仍在网络上，前端据此判断"这条不属于当前回合"并丢弃，不会把上一轮的尾巴写进新文档。
#[derive(Serialize, Clone)]
pub struct DeltaEvent {
    pub run_id: Option<String>,
    pub delta: String,
}

/// 流式回合的收尾判定（纯函数，可测）：**恰好 0 字**视为失败（`EMPTY_REPLY_ERR`）。
///
/// 为什么只判"恰好 0 字"：流式正文确实可能很短（"好"也是一个合法回答），任何非空长度阈值
/// 都会误伤正常回合；而"一个字都没有"在创作场景里从来不是有效结果——它要么是服务端没给内容，
/// 要么是响应体根本不是 SSE（见 `EMPTY_REPLY_ERR` 的说明）。
fn require_nonempty_stream(outcome: Result<String, String>) -> Result<String, String> {
    match outcome {
        Ok(text) if text.chars().count() == 0 => Err(EMPTY_REPLY_ERR.to_string()),
        other => other,
    }
}

#[tauri::command]
pub async fn chat_stream(
    app: AppHandle,
    state: tauri::State<'_, CancelState>,
    messages: Vec<ChatMsg>,
    turn: Option<String>,
    run_id: Option<String>,
) -> Result<(), String> {
    let cfg = resolve_config()?;
    let model = cfg.model.clone();
    // 期望档位 → 收敛到模型真实上限（见 ModelLimits）
    let (effort, want) = turn_budget(turn.as_deref());
    let max_tokens = clamp_to_model(want, model_limits(&cfg).await);
    // 记录的是"这次请求用了哪一档预算"——前端另有更细的阶段（撰写 / 自动修订）上报，
    // 两者不要混为一谈：本字段回答"花了多少额度"，不是"在做什么"。
    let profile = turn.as_deref().unwrap_or("default");
    let timer = ReqTimer::start();
    let mut meta = StreamMeta::default();
    let emit_id = run_id.clone();
    let outcome = cancel::run_cancellable(
        &state,
        run_id.as_deref(),
        stream_chat_budgeted(&cfg, messages, effort, max_tokens, &mut meta, |d| {
            let _ = app.emit(
                "chat-delta",
                DeltaEvent { run_id: emit_id.clone(), delta: d },
            );
        }),
    )
    .await;
    // 收尾判定必须在**写日志之前**：零正文的失败要记成 ok=false / failure=empty，
    // 而不是留下 `ok=true, responseLength=0` 这种看起来成功的假记录。
    let outcome = require_nonempty_stream(outcome);
    let ok = outcome.is_ok();
    let failure = outcome.as_ref().err().map(|e| classify_error(e));
    trace::log_request(
        run_id.as_deref(),
        &trace::request_record(
            &format!("chat/{profile}"),
            &model,
            None,
            None,
            &timer,
            ok,
            failure,
            outcome.as_ref().err().map(|s| s.as_str()),
            outcome.as_ref().ok().map(|s| s.chars().count()),
            meta.finish_reason.as_deref(),
            meta.usage.as_ref(),
        ),
    );
    outcome.map(|_| ())
}

// ---------- 图像子智能体：gen_svg（一次生成一幅插画 SVG，非流式） ----------

// 第 29 轮重写：提示从"地板清单"升级为"复杂度契约"——图片要具体、有构图层次、
// 有结构/明暗/材质/细节密度，能被当作一幅真正的插画，而不是几个几何图形的拼贴。
const SVG_SYSTEM_PROMPT: &str = "\
你是公众号插画师，输出可直接内嵌在推文 HTML 里的纯 SVG 插画。要求：\n\
1. 一次只画一张**具体可辨认、有内容可看**的插画（真实物体/场景/生灵），不是抽象几何图形、图标或贴纸。\n\
2. **分层构图**：画面要有前景 / 中景 / 背景（或明暗两层以上）的空间感；主体放在合理的构图上，不空、不糊。\n\
3. **物体要“长出来”而不是贴上去**：每个主要物象都要画出结构轮廓与明暗体积（受光面/背光面、深浅过渡），可加材质纹理（木纹/布料/植被/光晕等）；纯描边色块、平面剪影不算完成。\n\
4. 画面要有**细节密度**：横幅 / 大插画通常需要 20 个以上可见元素（circle/rect/ellipse/line/path/polygon/polyline/image），小插画（inline/deco）不少于 10 个才算充实；元素 ≤6 只是系统能通过的最低门槛，不要按最低门槛画。\n\
5. 元素坐标落在 viewBox 范围内，必须带 viewBox。\n\
6. SVG 内零文字、零数字、零 emoji（不出现 <text>、数字标注或 emoji 字符）。\n\
7. 背景透明，不要铺满底色块；可用多个元素叠出场景，但背景用色块/剪影即可，主体要清晰。\n\
8. 低饱和同色系配色，主色不超过 4 种；可用同色深浅表现体积与层次；若用户给定主题/风格词，按其气质配色。\n\
9. 整段回答只包含从 <svg 到 </svg> 的 SVG 原文：不解释、不用代码围栏（``` 或 markdown）、不加任何前后缀文字。\n\
10. 若“画面内容”说明缺少落笔所必需的核心信息（主体不明 / 不知画什么动作场景 / 多个可能画面互相冲突），不要硬画——只输出一行以 CLARIFY: 开头的问题，问最关键的一点（一句话），由创作主模型补足后再画；凡能合理画出的情况一律直接画，不要为问而问。";

/// 按 kind 组装用户消息（纯函数，可测；V3-R2 增 divider/heading；P1 增 photo-frame）
fn svg_user_prompt(kind: &str, desc: &str, theme: Option<&str>, hint: Option<&str>) -> Result<String, String> {
    let ctx = match kind {
        "wide" => "整行横幅插画（建议 viewBox=\"0 0 750 220\"，横向构图铺满）",
        "inline" => "小节旁的小插画（建议 viewBox=\"0 0 360 240\" 或 \"0 0 300 300\"）",
        "deco" => "推文气泡右下角的小装饰素材——角饰（建议 viewBox=\"0 0 300 200\"，图形集中在右下 1/3，小巧精致，如花簇/枝叶局部）",
        "divider" => "横向窄条分隔装饰素材——换场花饰/分割线（建议 viewBox=\"0 0 750 120\"，横向构图，左右对称或韵律重复，整体压扁矮，不占高度）",
        "heading" => "小节标题旁的横向装饰小插画（建议 viewBox=\"0 0 360 160\"，如花枝/书签/路标小物件，留白多、不喧宾夺主）",
        "photo-frame" => "照片位装饰画框（建议 viewBox=\"0 0 600 600\"，中央留透明区放真实照片，四周画规整画框）",
        other => {
            return Err(format!(
                "未知图像类型：{other}（应为 wide / inline / deco / divider / heading / photo-frame）"
            ))
        }
    };
    let mut msg = format!("请画一幅插画，用作：{ctx}。画面内容：{}", desc.trim());
    if let Some(t) = theme.map(str::trim).filter(|s| !s.is_empty()) {
        msg.push_str(&format!(" 主题/风格词：{t}，请按其气质配色。"));
    }
    // 上一版被本地质检拒收时的**修正提示**（前端 `qualityRetryHint` 产出，见 image-agent.ts）。
    // 独立一句追加，**不混进"画面内容"**：它说的是"上一版哪里不合规"，不是画面本身的内容；
    // 混进去会让模型把几何约束当成要画的对象。没有提示（首画 / 网络类失败重试）时不追加。
    if let Some(h) = hint.map(str::trim).filter(|s| !s.is_empty()) {
        msg.push_str(&format!(
            " 注意：上一版未通过本地质检，原因是：{h}。请针对该问题修正后重画，其余画面内容保持不变。"
        ));
    }
    Ok(msg)
}

/// 按角色补充的**专用作画契约**（P1，2026-09-24 调查 §3）。
/// 背景：原先把一套"插画式分层/体积/密度"要求统一套给所有 kind，小角饰也被要求画满细节；
/// 但角饰最终只以 60px 宽显示，堆细节反而糊成一团、还会压住气泡文字。
/// 大图角色（wide/inline）继续沿用 SVG_SYSTEM_PROMPT 的复杂度契约，**不得因统一"简化"而退化**。
fn svg_kind_prompt(kind: &str) -> &'static str {
    match kind {
        "deco" => "\
\n本幅是**气泡角饰**（最终只以约 60px 宽显示），按下面的专用要求画，覆盖上面与之冲突的通用要求：\n\
1. 画布建议 viewBox=\"0 0 300 200\"（宽高比不超过 2.4，略扁或近方形都行）。\n\
2. **只画一个主体**：一朵花 / 一片叶 / 一颗星 / 一个小物件，形状可辨认即可；不要拼三个以上的并列物象。\n\
3. **主体集中在右下区域**（约右下 1/3 到 1/2），画布左上与四边留白（透明边距约占画布 1/4）——气泡文字在左上，图形别去挤它。\n\
4. **轮廓要粗、要实**：主体用大块面填实色 + 明确的边界，主要色块的宽度在画布上不小于 40 单位（缩到 60px 后约 8px）；不要用细线描、细碎小元素堆密度。元素总数控制在 6–16 个。\n\
5. **颜色要够深**：主体颜色与白色底要有明显明暗差（浅色的明度不要高于 85%，不要用接近白色/极浅灰/极浅粉的颜色）；浅色只做小面积点缀。\n\
6. 缩小到 60px 宽仍要认得出是什么（大致轮廓清楚即可，细节会被抹掉）。\n\
7. **不要铺满画布**：主体墨迹不要占满整幅，四周留出明显空白。\n\
8. 配色克制：1–2 个主色 + 一个点缀色，避免多色杂点。",
        "divider" => "\
\n本幅是**横向分割装饰条**，按下面的专用要求画：\n\
1. 画布 viewBox=\"0 0 750 120\"，整体压扁、不占高度。\n\
2. **图形必须横向贯穿**：主体沿水平方向铺开（占画布宽度 85% 以上），左右对称或韵律重复。\n\
3. 不要出现竖向的大块主体，不要画成方形图表或独立物件——它是「一条线」，不是「一幅画」。\n\
4. 元素精简（6–16 个），线条与色块为主。",
        "heading" => "\
\n本幅是**小节标题旁的小装饰**，按下面的专用要求画：\n\
1. 画布 viewBox=\"0 0 360 160\"，横向构图。\n\
2. 单一小物件（花枝 / 书签 / 路标 / 小图标式的实物），留白多、体量小，不喧宾夺主。\n\
3. 元素 6–14 个，主体轮廓清楚，避免复杂场景。",
        "photo-frame" => "\
\n本幅是**照片位装饰框**，按下面的专用要求画：\n\
1. 画布 viewBox=\"0 0 600 600\"（近方形）。\n\
2. **中央约 60% 的区域必须完全透明**：不填任何颜色、不放任何元素——那块区域会放真实照片。\n\
3. 四周绘制均匀的画框：边线或角花，框宽约 12–20 单位，四边宽度一致，看起来像一个规整的相框。\n\
4. 只画画框本身，不要画框里的内容。元素 8–20 个，配色与推文主题一致。",
        _ => "", // wide / inline（及未知角色）：沿用共享的复杂度契约，不额外附加
    }
}

fn svg_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?is)<svg[\s\S]*?</svg>"#).expect("静态正则应合法"))
}

/// 从一段文本中抽出第一段 <svg>…</svg> 原文（纯函数，可测）
fn extract_svg(text: &str) -> Option<String> {
    svg_re().find(text).map(|m| m.as_str().to_string())
}

/// 解析 DeepSeek 返回体 JSON：choices[0].message.content → 抽出 SVG（纯函数；第 29 轮起生产走 extract_svg，本函数仅测试/兼容）
#[cfg(test)]
fn svg_from_response(body: &str) -> Result<String, String> {
    let v: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("解析响应 JSON 失败：{e}"))?;
    let content = v["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "图像子智能体未返回 SVG".to_string())?;
    let snippet: String = content.chars().take(160).collect();
    extract_svg(content).ok_or_else(|| format!("图像子智能体未返回 SVG（响应片段：{snippet}…）"))
}

/// 图像子智能体专用模型：env DEEPSEEK_IMAGE_MODEL → 默认 DEFAULT_MODEL。
///
/// 历史注记与**实测结论**（2026-09-29）：早先实测 flash 在 `reasoning_effort max/low` 下画 SVG
/// 会推理吃光预算、content 为空，当时改用 deepseek-chat。现在 `gen_svg` 走 `raw_completion`
/// （**不携带 reasoning_effort**），但真机验收时仍然两次返回空正文——日志显示
/// `finishReason: length` + `completion: 8000`（正好等于当时的上限），说明失效模式是
/// **输出预算被推理吃光**，与是否携带 reasoning_effort 无关。已把非流式上限提到
/// `FALLBACK_NONSTREAM_MAX_TOKENS`（见该常量处的说明）。若再出现空返回，先看日志里的
/// finishReason 与 usage，再决定是继续调上限还是对画图单独放开其它模型。
fn image_model() -> String {
    lock_model(read_env("DEEPSEEK_IMAGE_MODEL").unwrap_or_else(|| DEFAULT_MODEL.to_string()))
}

#[tauri::command]
pub async fn gen_svg(
    app: AppHandle,
    state: tauri::State<'_, CancelState>,
    kind: String,
    desc: String,
    theme: Option<String>,
    // 上一版被本地质检拒收时的修正提示（重画才有值）。约定见 `svg_user_prompt`。
    hint: Option<String>,
    ref_images: Option<Vec<String>>,
    run_id: Option<String>,
    slot_id: Option<String>,
    attempt: Option<u32>,
) -> Result<String, String> {
    let _ = &app; // 非流式命令暂不需事件推送；保留 AppHandle 便于后续接入进度事件
    let cfg = resolve_config()?;
    let model = image_model();
    let user = svg_user_prompt(&kind, &desc, theme.as_deref(), hint.as_deref())?;
    // 共享复杂度契约 + 该角色的专用契约（角饰/分割线/标题装饰/照片框各有几何要求；
    // wide/inline 不附加，保持大图口径不退化）
    let system = format!("{SVG_SYSTEM_PROMPT}{}", svg_kind_prompt(&kind));
    // P2：参考图（data URL，由 webview 侧把 SVG/图片栅格化后传入；Rust 不做 SVG 光栅化）。
    // 挂在 user 消息上——官方视觉接口只允许 user 消息携带图像。
    let images: Vec<String> = ref_images.unwrap_or_default().into_iter().filter(|s| !s.trim().is_empty()).collect();
    let messages = vec![
        ChatMsg { role: "system".into(), content: Some(system), tool_call_id: None, tool_calls: vec![], images: vec![] },
        ChatMsg { role: "user".into(), content: Some(user), tool_call_id: None, tool_calls: vec![], images },
    ];
    // 第 29 轮 3.2：子智能体要素不足会输出 CLARIFY 追问（不是失败）→ 取全文分类；否则返回 SVG 原文
    //
    // 修复计划阶段 1：每次绘图请求都要留下"阶段/模型/耗时/尝试序号/返回长度/finish_reason/usage/
    // 失败分类"的证据，否则事后无法区分"网络错、空返回、没有 SVG、被本地质检拒绝"。
    let timer = ReqTimer::start();
    let outcome = cancel::run_cancellable(
        &state,
        run_id.as_deref(),
        raw_completion(&cfg, model.clone(), messages),
    )
    .await;
    let text: Option<String> = outcome.as_ref().ok().map(|c| c.text.clone());
    let result: Result<String, String> = match &outcome {
        Err(e) => Err(e.clone()),
        Ok(c) => {
            if let Some(q) = extract_clarify(&c.text) {
                Ok(format!("CLARIFY:{q}"))
            } else {
                extract_svg(&c.text).ok_or_else(|| {
                    format!(
                        "图像子智能体未返回 SVG（响应片段：{}）",
                        trace::truncate(&c.text, 160)
                    )
                })
            }
        }
    };
    let failure: Option<&str> = result.as_ref().err().map(|e| classify_gen_error(e, text.as_deref()));
    trace::log_request(
        run_id.as_deref(),
        &trace::request_record(
            "gen_svg",
            &model,
            slot_id.as_deref(),
            attempt,
            &timer,
            result.is_ok(),
            failure,
            result.as_ref().err().map(|s| s.as_str()),
            text.as_ref().map(|t| t.chars().count()),
            outcome.as_ref().ok().and_then(|c| c.finish_reason.clone()).as_deref(),
            outcome.as_ref().ok().and_then(|c| c.usage.as_ref()),
        ),
    );
    result
}

/// 绘图失败分类：**必须区分**"服务没给内容"与"给了内容但没有 SVG"——两者处置完全不同
/// （前者是服务或预算问题，后者是提示词/模型能力问题）。正文非空才可能是 no-svg。
fn classify_gen_error(err: &str, text: Option<&str>) -> &'static str {
    let e = err.to_lowercase();
    if e.contains("未返回内容") || e.contains("内容为空") {
        return "empty";
    }
    if e.contains("未返回 svg") {
        return if text.map(|t| t.trim().is_empty()).unwrap_or(true) {
            "empty"
        } else {
            "no-svg"
        };
    }
    classify_error(err)
}

// ---------- P2：视觉复核（2026-09-24 调查 §8）——"选素材看实图" ----------
// 定位：确定性检索已经给出结论时不动用视觉；只在**排序含糊**（有近邻候选但没到强命中阈值）时，
// 让支持图像输入的模型看一眼候选项与目标描述，给出"能不能直接用"的判断。
// 费用控制：默认关闭（settings.vision_review）、前端限次与按 id@version 缓存、单次只看少量缩略图；
// 任何失败都回退为"新建"，并带上可显示的原因——不因为看不了图就把旧素材硬塞进去。

/// 视觉复核是否启用（设置面板显式开启；默认关）
fn vision_enabled() -> bool {
    crate::settings::read_settings().map(|s| s.vision_review).unwrap_or(false)
}

/// 看图模型：env DEEPSEEK_VISION_MODEL → 设置 model_vision → DEFAULT_MODEL。
/// 看图必须用支持图像输入的模型（deepseek-flash 支持）；锁定期间与其余两路同名。
fn vision_model() -> String {
    let file = crate::settings::read_settings().unwrap_or_default();
    lock_model(pick_text(
        read_env("DEEPSEEK_VISION_MODEL").as_deref(),
        &file.model_vision,
        DEFAULT_MODEL,
    ))
}

/// 视觉复核的决策结果。pick = 候选下标（从 0 起）；None 表示"都不合适，去新建"。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct VisionDecision {
    pub pick: Option<usize>,
    pub reason: String,
}

/// 容错解析视觉模型的决策 JSON（纯函数，可测）：
/// 容忍 ```json 围栏、前后说明文字、pick 为数字/数字字符串/null/none。
fn parse_vision_decision(text: &str) -> Result<VisionDecision, String> {
    let snippet: String = text.chars().take(80).collect();
    let start = text.find('{').ok_or_else(|| format!("视觉复核未返回 JSON（响应片段：{snippet}…）"))?;
    let end = text.rfind('}').ok_or_else(|| format!("视觉复核 JSON 不完整（响应片段：{snippet}…）"))?;
    if end <= start {
        return Err(format!("视觉复核 JSON 不完整（响应片段：{snippet}…）"));
    }
    let v: serde_json::Value = serde_json::from_str(&text[start..=end])
        .map_err(|e| format!("视觉复核 JSON 解析失败：{e}（响应片段：{snippet}…）"))?;
    let pick = match v.get("pick") {
        None | Some(serde_json::Value::Null) => None,
        Some(serde_json::Value::Number(n)) => n.as_u64().map(|x| x as usize),
        Some(serde_json::Value::String(s)) => {
            let s = s.trim();
            if s.is_empty()
                || s.eq_ignore_ascii_case("none")
                || s.eq_ignore_ascii_case("null")
                || s == "-"
            {
                None
            } else {
                s.parse::<usize>().ok()
            }
        }
        _ => None,
    };
    let reason = v
        .get("reason")
        .and_then(|r| r.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    Ok(VisionDecision { pick, reason })
}

/// 候选素材位说明（给视觉模型的目标语境）
fn vision_kind_ctx(kind: &str) -> &'static str {
    match kind {
        "deco" => "推文气泡右下角的小角饰（最终只显示约 60px 宽）",
        "divider" => "横向分割装饰条（横贯整行、很矮）",
        "heading" => "小节标题旁的小装饰",
        "photo-frame" => "照片位装饰画框（中央要留透明区放照片）",
        "wide" => "通栏横幅插画",
        "inline" => "正文内嵌小插画",
        _ => "推文素材",
    }
}

/// 视觉复核命令：给一批候选缩略图（data URL，顺序即序号），判断哪一张能直接复用。
/// 需要 base_url/model/key 与图像输入支持；前端只应在开启且有限次预算时调用。
#[tauri::command]
pub async fn review_assets(
    state: tauri::State<'_, CancelState>,
    kind: String,
    desc: String,
    candidates: Vec<String>,
    run_id: Option<String>,
) -> Result<VisionDecision, String> {
    if !vision_enabled() {
        return Err("视觉复核未开启：可在「设置」中打开（会产生额外的模型调用费用）".to_string());
    }
    if candidates.is_empty() {
        return Ok(VisionDecision { pick: None, reason: "没有候选可看".to_string() });
    }
    let cfg = resolve_config()?;
    let model = vision_model();
    let sys = "你是公众号推文的素材审核员。用户会给出一个素材位需求与若干候选素材的缩略图（按顺序编号）。\
你的任务：判断候选里有没有哪一张**可以直接当作该素材位使用**——主体对象、形态与配色要和需求描述一致；\
只是风格接近、主体不同（例如描述要雪花、候选是玫瑰）一律算不合适。\
若都明显不符，就判定为需要重新绘制。只输出一个 JSON 对象，不要解释、不要代码围栏，形如：\
{\"pick\": 2, \"reason\": \"第 3 张是右下角的花簇，配色与需求一致\"}；若都不合适则 {\"pick\": null, \"reason\": \"候选主体均与描述不符\"}";
    let n = candidates.len();
    let user = format!(
        "素材位：{}。需求描述：{}\n下面是 {} 张候选（按先后顺序编号为 1…{}）。请给出 JSON 判断。",
        vision_kind_ctx(&kind),
        desc.trim(),
        n,
        n
    );
    let messages = vec![
        ChatMsg {
            role: "system".into(),
            content: Some(sys.to_string()),
            tool_call_id: None,
            tool_calls: vec![],
            images: vec![],
        },
        ChatMsg {
            role: "user".into(),
            content: Some(user),
            tool_call_id: None,
            tool_calls: vec![],
            images: candidates,
        },
    ];
    let timer = ReqTimer::start();
    let outcome = cancel::run_cancellable(
        &state,
        run_id.as_deref(),
        raw_completion(&cfg, model.clone(), messages),
    )
    .await;
    let outcome = match outcome {
        Err(e) => {
            trace::log_request(
                run_id.as_deref(),
                &trace::request_record(
                    "vision_review", &model, None, None, &timer, false,
                    Some(classify_error(&e)), Some(&e), None, None, None,
                ),
            );
            return Err(e);
        }
        Ok(c) => c,
    };
    let parsed = parse_vision_decision(&outcome.text);
    trace::log_request(
        run_id.as_deref(),
        &trace::request_record(
            "vision_review",
            &model,
            None,
            None,
            &timer,
            parsed.is_ok(),
            parsed.as_ref().err().map(|_| "unknown"),
            parsed.as_ref().err().map(|s| s.as_str()),
            Some(outcome.text.chars().count()),
            outcome.finish_reason.as_deref(),
            outcome.usage.as_ref(),
        ),
    );
    let mut d = parsed?;
    // 模型按 1 起的编号作答，折算成 0 起下标；
    // 越界一律判为"不合适"——保守，宁可新建，也不能选错素材位。
    d.pick = match d.pick {
        Some(p) if (1..=n).contains(&p) => Some(p - 1),
        Some(_) => {
            d.reason = format!("{}（返回的候选编号超出范围，按不合适处理）", d.reason).trim().to_string();
            None
        }
        None => None,
    };
    Ok(d)
}

// ---------- 第 29 轮 3.2：图像子智能体有界回问（CLARIFY） ----------
// 子智能体对占位说明要素不足时输出 "CLARIFY: <一句问题>"（见 SVG_SYSTEM_PROMPT 第 10 条）。
// gen_svg 返回该追问标记；前端 image-agent 检测到后把问题交回主模型 refine_brief 补齐 brief，
// 再重试一次。CLARIFY 前缀是文本协议标记（非错误），复用 Ok 返回，前端据此分流。

/// 从一段文本判断是否为子智能体的 CLARIFY 追问，并取出问题（纯函数，可测）
fn extract_clarify(text: &str) -> Option<String> {
    for line in text.lines() {
        let l = line.trim();
        if let Some(rest) = l.strip_prefix("CLARIFY:") {
            let q = rest.trim().trim_matches('"').to_string();
            if !q.is_empty() {
                return Some(q);
            }
        }
    }
    None
}

/// 补 brief 命令（前端 CLARIFY 后调用一次）：主模型把占位说明补成可作画 brief
#[tauri::command]
pub async fn refine_brief(
    _app: AppHandle,
    state: tauri::State<'_, CancelState>,
    desc: String,
    question: String,
    theme: Option<String>,
    run_id: Option<String>,
    slot_id: Option<String>,
) -> Result<String, String> {
    let cfg = resolve_config()?;
    let model = cfg.model.clone();
    let timer = ReqTimer::start();
    let outcome = cancel::run_cancellable(
        &state,
        run_id.as_deref(),
        complete_brief(&cfg, &desc, &question, theme.as_deref()),
    )
    .await;
    trace::log_request(
        run_id.as_deref(),
        &trace::request_record(
            "refine_brief",
            &model,
            slot_id.as_deref(),
            None,
            &timer,
            outcome.is_ok(),
            outcome.as_ref().err().map(|e| classify_error(e)),
            outcome.as_ref().err().map(|s| s.as_str()),
            outcome.as_ref().ok().map(|s| s.chars().count()),
            None,
            None,
        ),
    );
    outcome
}

/// 非流式请求一段补 brief：主模型（cfg.model，与创作同款）回答图像子智能体的追问，
/// 返回"补全后的占位说明"（仅文字，不画 SVG）。仅当子智能体 CLARIFY 时由前端调用一次。
async fn complete_brief(cfg: &LlmConfig, original: &str, question: &str, theme: Option<&str>) -> Result<String, String> {
    let client = nonstream_client()?;
    let sys = "你是公众号推文创作主模型。图像子智能体认为某个插图占位说明不足以作画，提了一个问题。\
请结合原说明，把画面补成一句可直接作画的具体 brief：说清主体对象、动作/场景、构图氛围、色彩倾向（若给定风格词则保留其气质）。\
只输出补全后的说明本身，不要解释、不要输出 SVG、不要输出代码围栏。";
    let mut user = format!("原占位说明：{}\n\n子智能体问题：{}", original.trim(), question.trim());
    if let Some(t) = theme.map(str::trim).filter(|s| !s.is_empty()) {
        user.push_str(&format!("\n风格词：{t}"));
    }
    // 输出上限与 `raw_completion` 同一口径：查该端点+模型的**真实上限**（查不到退兜底值），
    // 不再硬编码 1200。
    // 为什么统一口径而不是各自猜一个数：实测补 brief 每次只产出 378–501 个 completion token
    // （就是"一句 brief"），1200 在现有样本上是够的——但样本只覆盖"一次补一句"的情形，
    // **没有证据**说明追问更复杂、模型顺带多写几句时 1200 一定够；一旦不够就是
    // `finish_reason=length` 的静默截断（brief 被砍半，画面走形却看不出原因），比多留额度难查得多。
    // 换成一个可维护的口径：上限只负责"不去人为截断"，真正兜住跑飞的是非流式总超时
    // （`nonstream_timeout_secs`，默认 180 秒 ≈ 4.8 万 token，见该常量的换算注释）。
    // 注意：这里**不显式给 reasoning_effort**——本请求的产出只有"一句 brief"（实测 378–501 token），
    // 加 high 只会把推理链拉长、白白增加用户等待，对这类短而结构化的产出没有收益。
    // 画图那档才需要显式 high，依据见 NONSTREAM_EFFORT 处的实测验闸记录。
    let limits = model_limits(cfg).await;
    let body = serde_json::json!({
        "model": cfg.model,
        "stream": false,
        "max_tokens": nonstream_max_tokens(limits),
        "messages": [
            { "role": "system", "content": sys },
            { "role": "user", "content": user },
        ],
    });
    let res = client
        .post(format!("{}/chat/completions", cfg.base_url))
        .header("Authorization", format!("Bearer {}", cfg.key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败：{e}"))?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let hint = retry_after_secs(&res);
        let text = res.text().await.unwrap_or_default();
        return Err(api_error(status, hint, &text));
    }
    let text = res.text().await.map_err(|e| format!("读取响应失败：{e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应 JSON 失败：{e}"))?;
    let content = v["choices"][0]["message"]["content"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "补 brief 模型未返回说明".to_string())?;
    Ok(content.to_string())
}

/// 非流式响应的一次完整结果（正文 + 服务返回的元信息）。修复计划阶段 1：
/// 请求日志要记 finish_reason 与 usage，只有这里拿得到，所以解析结果不再只留一个字符串。
#[derive(Default, Clone, Debug)]
pub struct Completion {
    pub text: String,
    pub finish_reason: Option<String>,
    pub usage: Option<serde_json::Value>,
}

/// 非流式请求一次，返回 choices[0].message.content 全文（透传 model，纯网络无解析，供 gen_svg 复用）
async fn raw_completion(cfg: &LlmConfig, model: String, messages: Vec<ChatMsg>) -> Result<Completion, String> {
    raw_completion_with(cfg, model, messages, nonstream_timeout_secs()).await
}

/// 同上，但显式给单次总超时（秒）。测试用可控假服务验超时时直接传值，
/// 不去改进程级环境变量——环境变量在并行测试之间是共享且竞态的。
async fn raw_completion_with(
    cfg: &LlmConfig,
    model: String,
    messages: Vec<ChatMsg>,
    timeout_secs: u64,
) -> Result<Completion, String> {
    // 这个客户端要的是调用方指定的总超时（默认档或测试传入值），所以不能复用 `nonstream_client`。
    // 构造失败 → 如实报错（理由同 `stream_client`：兜底会得到一个没有超时的客户端，
    // 而"超时"正是本函数存在的意义）。
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(connect_timeout_secs()))
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(client_build_err)?;
    // 输出上限取该模型的**真实**上限（查询失败退兜底值，见 ModelLimits 处的实测记录）
    let limits = model_limits(cfg).await;
    let url = format!("{}/chat/completions", cfg.base_url);
    let body = serde_json::json!({
        "model": model,
        "stream": false,
        "reasoning_effort": NONSTREAM_EFFORT,
        "max_tokens": nonstream_max_tokens(limits),
        "messages": build_messages(&messages),
    });
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", cfg.key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败：{e}"))?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let hint = retry_after_secs(&res);
        let text = res.text().await.unwrap_or_default();
        return Err(api_error(status, hint, &text));
    }
    let text = res.text().await.map_err(|e| format!("读取响应失败：{e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应 JSON 失败：{e}"))?;
    let finish_reason = v["choices"][0]["finish_reason"].as_str().map(str::to_string);
    let usage = v.get("usage").filter(|u| !u.is_null()).cloned();
    // 空正文**不当成 Err 抛出**：先把 finish_reason / usage 一起带回去，由调用方判定。
    // 2026-09-29 真机实测发现：画图请求会返回空正文，而"为什么空"只能从 finish_reason 看出来
    // （length = 推理吃光预算截断、stop = 服务端真的给了空）。当初在这里直接 Err，
    // 等于把最有诊断价值的那两个字段丢在半路上——正是这次真机验收暴露的问题。
    let content = v["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    Ok(Completion { text: content, finish_reason, usage })
}

// ---------- 创作前置：prep_turn（知识注册表 → 模型按需工具取用，非流式） ----------

/// prep_turn 的返回：assistant 正文（无工具调用时可能是澄清问题或 READY）与请求的工具调用清单
///
/// DS 修复指南 §5.3：**接齐实际模型、finish_reason、usage**，服务端没返回的字段一律 `None`
/// （=unknown），**不补 0、不补默认值**——把"没拿到"写成"0 个 token"会让证据失真。
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PrepReply {
    pub text: Option<String>,
    pub calls: Vec<ToolCall>,
    /// 服务端回显的模型名（缺席即 unknown）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// 结束原因（stop / length / tool_calls…）；缺席即 unknown
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    /// token 用量；服务端没给就是 None
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<serde_json::Value>,
}

/// 解析出的工具调用（arguments 是 JSON 字符串，原样透传给前端本地执行）
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: String,
}

/// 工具声明（DeepSeek function-calling，OpenAI 格式）：随 prep_turn 请求发送。
/// V3-R3：新增 search_assets（个人素材库检索）——创作配图先检索库、命中即用 [[asset]] 引用复用。
const PREP_TOOLS: &str = r#"[
  {"type":"function","function":{"name":"load_knowledge","description":"读取三层知识库某点文件的全文（点文件名如 style-guochao / type-promo / comp-banned / module-bubble）。创作前按需取用：内容类型模板、风格色板、合规红线、模块规范。","parameters":{"type":"object","properties":{"name":{"type":"string","description":"点文件名（去 .md 后缀），如 style-guochao"}},"required":["name"]}}},
  {"type":"function","function":{"name":"search_knowledge","description":"按主题检索应取用哪些点文件，返回文件名清单。创作前不确定该读哪些点时使用。","parameters":{"type":"object","properties":{"query":{"type":"string","description":"检索主题，如 促销活动 或 咖啡店开业"}},"required":["query"]}}},
  {"type":"function","function":{"name":"search_assets","description":"检索你的个人素材库（本机已入库、可复用的具体 SVG 素材：气泡角饰/分割线/开篇横幅/小节装饰/插画等，条目带分类与语义描述）。创作需要配图素材时先检索库：命中（描述贴合）就把该行末尾给出的「引用写法」原样抄进正文复用（形如 [[asset:分类|素材ID|用途说明]]，**分类用英文键、素材用 ID，都不要改写**）；库里没有合适的才写 [[img]]/[[deco]] 占位。","parameters":{"type":"object","properties":{"query":{"type":"string","description":"想要什么素材的自然语言描述，如 右下角一朵小花的气泡角饰"},"category":{"type":"string","description":"可选：限定在某分类内找（bubble/divider/deco/banner/heading/art-inline/art-wide/photo-frame）"},"style":{"type":"string","description":"可选：风格软偏好词，如 日系"}},"required":["query"]}}},
  {"type":"function","function":{"name":"finish_preparation","description":"结束准备阶段并声明本回合要做什么。**必须**用这个工具表达结果，不要只回复文字（尤其不要只回复 READY）。outcome 取值：reply=本回合只是回答/澄清，不写稿；compose=需求已明确，由系统发起一次正文撰写；candidate=你已经写好了完整正文，直接交稿（把完整 v2 正文放进 source）。","parameters":{"type":"object","properties":{"outcome":{"type":"string","enum":["reply","compose","candidate"],"description":"reply 普通答复/澄清；compose 交给系统撰写；candidate 你自己已给出完整正文"},"text":{"type":"string","description":"outcome=reply 时的答复或澄清内容（一段自然语言）"},"source":{"type":"string","description":"outcome=candidate 时的**单一完整 v2 正文**，不要带 ``` 围栏，不要重复贴旧稿"},"assetPolicy":{"type":"string","enum":["preserve","modify"],"description":"**必填**。本回合素材如何处理：preserve=只改文字、现有配图与其引用保持不动（不要给已有素材加 |new）；modify=本回合要修改或新增素材。缺省不允许——系统不会替你补一个默认值"},"baseRevisionId":{"type":"string","description":"可选：你看到的当前正式版本 id，用于一致性回显（不影响系统的权威版本基准）"}},"required":["outcome","assetPolicy"]}}}
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
        for (i, tc) in arr.iter().enumerate() {
            // 字段缺失**必须报错**，不能用 unwrap_or_default 造一条空调用：空名字传给前端后
            // 既无法派发（不知道要执行哪个工具），也没有任何线索指向"模型请求了工具但字段残缺"。
            // 索引从 1 起报，便于人工对着响应体核对是第几个调用出的问题。
            let nth = i + 1;
            let id = tc
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("解析响应 JSON 失败：第 {nth} 个工具调用缺少字段 id"))?;
            let func = tc
                .get("function")
                .and_then(|f| f.as_object())
                .ok_or_else(|| format!("解析响应 JSON 失败：第 {nth} 个工具调用缺少字段 function"))?;
            let name = func
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    format!("解析响应 JSON 失败：第 {nth} 个工具调用缺少字段 function.name（无法派发）")
                })?;
            let args = func
                .get("arguments")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    format!("解析响应 JSON 失败：第 {nth} 个工具调用缺少字段 function.arguments")
                })?;
            calls.push(ToolCall { id: id.to_string(), name: name.to_string(), args: args.to_string() });
        }
    }
    Ok(PrepReply {
        text,
        calls,
        // 服务端没回就留 None（unknown）。不编造：`usage` 缺失曾被写成 0，让"没拿到用量"看起来
        // 像"这次没花钱"，与事实相反。
        model: v.get("model").and_then(|m| m.as_str()).map(str::to_string),
        finish_reason: first
            .get("finish_reason")
            .and_then(|f| f.as_str())
            .map(str::to_string),
        usage: v.get("usage").cloned().filter(|u| !u.is_null()),
    })
}

/// 非流式创作前置请求：携带 tools，让模型决定取用哪些知识点或澄清
async fn request_prep(cfg: &LlmConfig, messages: Vec<ChatMsg>) -> Result<PrepReply, String> {
    let client = nonstream_client()?;
    let url = format!("{}/chat/completions", cfg.base_url);
    let tools: serde_json::Value = serde_json::from_str(PREP_TOOLS)
        .map_err(|e| format!("工具声明解析失败：{e}"))?;
    // 输出上限与 `raw_completion` 同一口径：查该端点+模型的**真实上限**（查不到退兜底值），
    // 不再硬编码 3200。
    // 为什么统一口径而不是各自猜一个数：实测 prep 每次只产出 154–335 个 completion token
    // （一句澄清问题，或 READY + 若干工具调用），3200 在现有样本上是够的——但样本只覆盖
    // "模型取少量点文件"的情形，**没有证据**说明工具调用更多（一次取多个知识点、参数更长）时
    // 3200 一定够；一旦不够就是 `finish_reason=length` 的静默截断（工具调用参数被砍断，
    // 前端拿到半个 JSON），比多留额度难查得多。统一成一个可维护的口径更省心：
    // 上限只负责"不去人为截断"，真正兜住跑飞的是非流式总超时（默认 180 秒 ≈ 4.8 万 token，
    // 见 `DEFAULT_NONSTREAM_TIMEOUT_SECS` 的换算注释）。
    // 注意：这里**不显式给 reasoning_effort**——本请求的产出是"一句澄清问题"或
    // "READY + 工具调用"（实测 154–335 token），加 high 只会把推理链拉长、增加用户等待，
    // 对这类短而结构化的产出没有收益；显式 high 只在画图那档有实测依据（见 NONSTREAM_EFFORT）。
    let limits = model_limits(cfg).await;
    let body = serde_json::json!({
        "model": cfg.model,
        "messages": build_messages(&messages),
        "tools": tools,
        "stream": false,
        "max_tokens": nonstream_max_tokens(limits),
    });
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", cfg.key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败：{e}"))?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let hint = retry_after_secs(&res);
        let text = res.text().await.unwrap_or_default();
        return Err(api_error(status, hint, &text));
    }
    let text = res.text().await.map_err(|e| format!("读取响应失败：{e}"))?;
    parse_prep_reply(&text)
}

/// 当前模型锁定状态（设置面板据此把模型输入框置灰并说明原因）
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ModelLock {
    pub locked: bool,
    pub model: String,
}

#[tauri::command]
pub fn model_lock_state() -> ModelLock {
    ModelLock {
        locked: model_locked(),
        model: locked_model_name(),
    }
}

/// 新增 attempts 子字段：一次 prep 往返里可能取多个工具，这里只记这次模型调用本身。
fn prep_extra(reply: &PrepReply) -> serde_json::Value {
    serde_json::json!({
        "toolCalls": reply.calls.iter().map(|c| c.name.clone()).collect::<Vec<_>>(),
    })
}

#[tauri::command]
pub async fn prep_turn(
    app: AppHandle,
    state: tauri::State<'_, CancelState>,
    messages: Vec<ChatMsg>,
    run_id: Option<String>,
) -> Result<PrepReply, String> {
    let _ = &app; // 保留 AppHandle 便于后续接入进度/取消
    let cfg = resolve_config()?;
    let model = cfg.model.clone();
    let timer = ReqTimer::start();
    let outcome = cancel::run_cancellable(&state, run_id.as_deref(), request_prep(&cfg, messages)).await;
    let mut rec = trace::request_record(
        "prep",
        &model,
        None,
        None,
        &timer,
        outcome.is_ok(),
        outcome.as_ref().err().map(|e| classify_error(e)),
        outcome.as_ref().err().map(|s| s.as_str()),
        outcome.as_ref().ok().map(|r| r.text.as_deref().map(|t| t.chars().count()).unwrap_or(0)),
        // 指南 §5.3：finish_reason / usage 实际接上（服务端没给就是 None，记录里就不会出现该字段）
        outcome.as_ref().ok().and_then(|r| r.finish_reason.as_deref()),
        outcome.as_ref().ok().and_then(|r| r.usage.as_ref()),
    );
    // 工具调用名是回答"模型到底取了多少份资料"的关键，一并落盘（不含参数正文）
    if let Ok(r) = &outcome {
        rec["toolCalls"] = prep_extra(r)["toolCalls"].clone();
        // 服务端回显的模型名与请求的不一定相同（别名/网关改写）——如实记录，不做替换
        if let Some(m) = &r.model {
            rec["modelReturned"] = serde_json::Value::String(m.clone());
        }
    }
    trace::log_request(run_id.as_deref(), &rec);
    outcome
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

    #[test]
    fn sse_multibyte_split_across_chunks_not_corrupted() {
        // 网络 chunk 可能把多字节 UTF-8 字符（如中文「你」= E4 BD A0）劈成两半。
        // feed_sse_bytes 按字节累积、凑完整行才解码——首块只含「你」的首字节（E4）、无 \n，
        // 不应产出内容；第二块补齐剩余字节与 \n 后应解析出完整「你」，绝不出现 U+FFFD。
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n";
        let prefix = "data: {\"choices\":[{\"delta\":{\"content\":\"";
        let bytes = line.as_bytes();
        let p = prefix.len(); // ASCII 前缀，字节长 == 字符长；「你」从此处开始
        let mut buf: Vec<u8> = Vec::new();
        let mut got = String::new();
        feed_sse_bytes(&mut buf, &bytes[..p + 1], |d| got.push_str(&d), |_| {});
        assert!(got.is_empty(), "首块尚无换行，不应产出 delta");
        feed_sse_bytes(&mut buf, &bytes[p + 1..], |d| got.push_str(&d), |_| {});
        assert_eq!(got, "你", "跨 chunk 的中文不应被 U+FFFD 破坏: {got:?}");
        assert!(!got.contains('\u{FFFD}'), "不应产生替换字符");
    }

    #[test]
    fn sse_multiple_deltas_across_arbitrary_splits() {
        // 把一整个多 delta 流切成任意字节段喂入，结果应与整行解析一致（无丢失、无错位）
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"你好世界\"}}]}\n";
        let bytes = line.as_bytes();
        let mut buf: Vec<u8> = Vec::new();
        let mut got = String::new();
        // 每 3 字节切一刀（必劈到中文多字节中间）
        for chunk in bytes.chunks(3) {
            feed_sse_bytes(&mut buf, chunk, |d| got.push_str(&d), |_| {});
        }
        assert_eq!(got, "你好世界", "任意切分解析应一致: {got:?}");
        assert!(!got.contains('\u{FFFD}'));
    }

    #[tokio::test]
    #[ignore = "需要真实 DeepSeek API 与密钥（env DEEPSEEK_API_KEY 或 ~/.dsh/.credentials.yaml）"]
    async fn live_deepseek_smoke() {
        let cfg = resolve_config().expect("应能解析到密钥配置");
        let mut got = String::new();
        let reply = stream_chat_budgeted(
            &cfg,
            vec![ChatMsg {
                role: "user".into(),
                content: Some("只回复六个字：桌面链路测试通过".into()),
                tool_call_id: None,
                tool_calls: vec![],
                images: vec![],
            }],
            "max",
            64000,
            &mut StreamMeta::default(),
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
        let reply = stream_chat_budgeted(
            &cfg,
            vec![
                ChatMsg { role: "system".into(), content: Some(system.into()), tool_call_id: None, tool_calls: vec![], images: vec![] },
                ChatMsg { role: "user".into(), content: Some(user.into()), tool_call_id: None, tool_calls: vec![], images: vec![] },
            ],
            "max",
            64000,
            &mut StreamMeta::default(),
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
        // 收集到就必须断言（此前只 println!：真机跑出满屏渐变也 PASS，而测试名会让评审
        // 以为审美铁律有 live 覆盖——属于假绿）。先断言再打印，失败时仍留有诊断输出。
        assert!(issues.is_empty(), "真实模型违反审美铁律: {issues:?}");
        println!("LIVE ARTICLE: len={}, sections={}, issues={:?}", body.len(), body.matches("<section").count(), issues);
        println!("LIVE HEAD: {}", body.chars().take(90).collect::<String>());
    }

    #[test]
    fn svg_prompt_requires_layered_complexity() {
        // 第 29 轮 3.1：SVG 提示不再是"≥6 元素"地板，而是复杂度契约——分层/结构/明暗/细节密度必须有
        assert!(SVG_SYSTEM_PROMPT.contains("分层构图"), "应要求前景/中景/背景层次");
        assert!(SVG_SYSTEM_PROMPT.contains("结构轮廓与明暗体积"), "应要求结构轮廓与明暗体积");
        assert!(SVG_SYSTEM_PROMPT.contains("细节密度"), "应要求细节密度");
        assert!(SVG_SYSTEM_PROMPT.contains("20 个以上"), "横幅/大插画应引导到 20+ 元素量级");
        assert!(SVG_SYSTEM_PROMPT.contains("≤6 只是系统能通过的最低门槛"), "应明确 ≥6 只是门槛而非目标");
    }

    #[test]
    fn svg_prompt_kind_ctx_and_theme() {
        let wide = svg_user_prompt("wide", "咖啡店一角", Some("杂志"), None).expect("ok");
        assert!(wide.contains("750 220"), "wide 应提示横幅 viewBox");
        assert!(wide.contains("咖啡店一角"));
        assert!(wide.contains("杂志"));
        let deco = svg_user_prompt("deco", "花簇", None, None).expect("ok");
        assert!(deco.contains("角饰"));
        assert!(deco.contains("右下 1/3"));
        let divider = svg_user_prompt("divider", "花叶横条", None, None).expect("ok");
        assert!(divider.contains("750 120"), "divider 应提示横向窄条 viewBox");
        let heading = svg_user_prompt("heading", "小书签", None, None).expect("ok");
        assert!(heading.contains("360 160"));
        assert!(svg_user_prompt("banner", "x", None, None).unwrap_err().contains("未知图像类型"));
    }

    #[test]
    fn svg_user_prompt_appends_quality_hint_without_polluting_content() {
        // 重画修正提示：独立一句追加，且**不得**混进"画面内容"里
        let base = svg_user_prompt("wide", "校园门口的银杏树", Some("日系"), None).expect("ok");
        let with_hint = svg_user_prompt(
            "wide",
            "校园门口的银杏树",
            Some("日系"),
            Some("有 44 个可见元素完全落在画布外"),
        )
        .expect("ok");
        assert!(!base.contains("未通过本地质检"), "无提示时不得出现修正语句");
        assert!(with_hint.contains("未通过本地质检"), "有提示时必须追加修正语句");
        assert!(with_hint.contains("44 个可见元素完全落在画布外"), "提示正文应原样转述");
        // 关键：提示不能被当成画面内容——"画面内容："后面紧跟的仍只有原 desc
        assert!(
            with_hint.contains("画面内容：校园门口的银杏树"),
            "画面内容必须保持原样，提示只能追加在后面（否则模型会把几何约束当成要画的对象）"
        );
        // 空白提示等同于无提示
        let blank = svg_user_prompt("wide", "校园门口的银杏树", Some("日系"), Some("   ")).expect("ok");
        assert!(!blank.contains("未通过本地质检"), "空白提示不得追加修正语句");
    }

    // ---------- P2：多模态线上形态（to_wire / build_messages） ----------

    fn cm(role: &str, content: Option<&str>) -> ChatMsg {
        ChatMsg {
            role: role.into(),
            content: content.map(str::to_string),
            tool_call_id: None,
            tool_calls: vec![],
            images: vec![],
        }
    }

    #[test]
    fn to_wire_text_path_is_byte_identical_to_legacy() {
        // 纯文本路径必须与改动前 serde 直接序列化逐字节一致——否则就是静默改线上协议
        for m in [
            cm("system", Some("你是助手")),
            cm("user", Some("你好")),
            cm("assistant", Some("在的")),
            cm("assistant", None),
        ] {
            let legacy = serde_json::to_value(&m).expect("旧口径序列化");
            assert_eq!(to_wire(&m, true), legacy, "role={}", m.role);
            assert_eq!(to_wire(&m, false), legacy, "role={}", m.role);
        }
    }

    #[test]
    fn to_wire_never_leaks_images_key() {
        let mut m = cm("user", Some("照这个改"));
        m.images = vec!["data:image/png;base64,AAAA".into()];
        // 直接序列化（旧写法）绝不能带 images 键——这是"结构上不可能泄漏"的保证
        let direct = serde_json::to_value(&m).expect("ok");
        assert!(direct.get("images").is_none(), "直接序列化不应出现 images");
        assert_eq!(direct["content"], serde_json::json!("照这个改"));
    }

    #[test]
    fn to_wire_folds_images_into_content_parts() {
        let mut m = cm("user", Some("把花心改成金色"));
        m.images = vec!["data:image/png;base64,AAAA".into(), "data:image/png;base64,BBBB".into()];
        let w = to_wire(&m, true);
        let parts = w["content"].as_array().expect("应为内容块数组");
        assert_eq!(parts.len(), 3, "1 段文字 + 2 张图");
        assert_eq!(parts[0]["type"], "text");
        assert_eq!(parts[0]["text"], "把花心改成金色");
        assert_eq!(parts[1]["type"], "image_url");
        assert_eq!(parts[1]["image_url"]["url"], "data:image/png;base64,AAAA");
        assert_eq!(parts[2]["image_url"]["url"], "data:image/png;base64,BBBB");
    }

    #[test]
    fn to_wire_empty_text_still_valid_with_images() {
        let mut m = cm("user", None);
        m.images = vec!["data:image/png;base64,AAAA".into()];
        let parts = to_wire(&m, true)["content"].as_array().cloned().expect("数组");
        assert_eq!(parts.len(), 1);
        assert_eq!(parts[0]["type"], "image_url");
    }

    #[test]
    fn build_messages_only_lets_the_last_user_carry_images() {
        let mut old = cm("user", Some("第一轮"));
        old.images = vec!["data:image/png;base64,OLD".into()];
        let mut last = cm("user", Some("这轮"));
        last.images = vec!["data:image/png;base64,NEW".into()];
        let mut asst = cm("assistant", Some("好"));
        asst.images = vec!["data:image/png;base64,GHOST".into()];
        let msgs = vec![cm("system", Some("S")), old, asst, last];
        let wire = build_messages(&msgs);
        // 首轮 user 的图片被丢弃（避免每轮重复上传、重复计费）
        assert_eq!(wire[1]["content"], serde_json::json!("第一轮"));
        // assistant 的 images 一律丢弃（API 只允许 user 携带图像）
        assert_eq!(wire[2]["content"], serde_json::json!("好"));
        // 末条 user 的图片折叠为内容块
        assert!(wire[3]["content"].is_array());
        assert_eq!(wire[3]["content"][1]["image_url"]["url"], "data:image/png;base64,NEW");
    }

    #[test]
    fn build_messages_keeps_tool_turns_intact() {
        let assistant = ChatMsg {
            role: "assistant".into(),
            content: None,
            tool_call_id: None,
            tool_calls: vec![ToolCallWire {
                id: "call_x".into(),
                tool_type: "function".into(),
                function: ToolFunctionWire { name: "load_knowledge".into(), arguments: "{}".into() },
            }],
            images: vec![],
        };
        let mut tool = cm("tool", Some("结果"));
        tool.tool_call_id = Some("call_x".into());
        let wire = build_messages(&[assistant, tool]);
        assert_eq!(wire[0]["content"], serde_json::Value::Null);
        assert_eq!(wire[0]["tool_calls"][0]["function"]["name"], "load_knowledge");
        assert_eq!(wire[1]["tool_call_id"], "call_x");
    }

    // ---------- P2：视觉复核决策解析 ----------

    #[test]
    fn vision_decision_parsed_from_various_shapes() {
        assert_eq!(
            parse_vision_decision(r#"{"pick": 2, "reason": "第 3 张贴合"}"#).unwrap(),
            VisionDecision { pick: Some(2), reason: "第 3 张贴合".into() }
        );
        // 代码围栏 + 前后说明文字（模型常见输出）
        let fenced = "好的，我的判断是：\n```json\n{\"pick\": 1, \"reason\": \"可用\"}\n```\n以上。";
        assert_eq!(parse_vision_decision(fenced).unwrap().pick, Some(1));
        // 都不合适：null / "none" / 空串 都算"去新建"
        assert_eq!(parse_vision_decision(r#"{"pick": null, "reason": "主体不符"}"#).unwrap().pick, None);
        assert_eq!(parse_vision_decision(r#"{"pick": "none", "reason": "x"}"#).unwrap().pick, None);
        assert_eq!(parse_vision_decision(r#"{"pick": "3", "reason": "x"}"#).unwrap().pick, Some(3));
        // 缺 reason 不报错
        assert_eq!(parse_vision_decision(r#"{"pick": 0}"#).unwrap().reason, "");
    }

    #[test]
    fn vision_decision_rejects_garbage() {
        assert!(parse_vision_decision("没有 JSON，只有一句话").is_err());
        assert!(parse_vision_decision("{不完整的").is_err());
        assert!(parse_vision_decision("").is_err());
    }

    #[test]
    fn vision_prompt_keeps_kind_context() {
        assert!(vision_kind_ctx("deco").contains("角饰"));
        assert!(vision_kind_ctx("photo-frame").contains("透明"));
        assert!(vision_kind_ctx("divider").contains("横向"));
    }

    #[test]
    fn vision_and_image_models_follow_the_lock() {
        // 锁定期间三路同名（见 all_model_routes_locked_to_one_name）；
        // 未锁定时画图与看图可以分开配置——这条断言随锁定状态取反，避免将来解锁后测试失去意义。
        if model_locked() {
            assert_eq!(vision_model(), image_model());
            assert_eq!(vision_model(), DEFAULT_MODEL);
        } else {
            assert!(!vision_model().is_empty() && !image_model().is_empty());
        }
    }

    #[test]
    fn all_model_routes_locked_to_one_name() {
        // 用户 2026-09-24：所有模型切换为 deepseek-flash，暂时禁止一切别的模型。
        // 三路（主模型 / 画图 / 看图）必须同名；环境变量与设置里的其它取值一律被忽略。
        assert_eq!(DEFAULT_MODEL, "deepseek-flash");
        assert_eq!(image_model(), "deepseek-flash");
        assert_eq!(vision_model(), "deepseek-flash");
        assert!(model_locked());
        assert_eq!(locked_model_name(), "deepseek-flash");
    }

    #[test]
    fn lock_model_overrides_any_resolved_name() {
        // 无论上游解析出什么（env、设置、自定义服务商），锁定后都必须收敛到同一个名字
        for stray in ["deepseek-chat", "deepseek-v4-flash", "deepseek-reasoner", "", "gpt-4o"] {
            assert_eq!(lock_model(stray.to_string()), "deepseek-flash", "输入 {stray:?}");
        }
    }

    #[test]
    fn resolve_model_ignores_env_and_settings() {
        // 走真实的解析链（resolve_config 用的就是这个函数）：环境变量、应用设置、默认值
        // 三条来源都不得越过锁定。不依赖密钥，因此可在任何机器上跑。
        assert_eq!(resolve_model(Some("deepseek-chat"), "gpt-4o"), "deepseek-flash");
        assert_eq!(resolve_model(None, "deepseek-v4-flash"), "deepseek-flash");
        assert_eq!(resolve_model(Some(""), ""), "deepseek-flash");
        assert_eq!(resolve_model(Some("  "), "   "), "deepseek-flash");
        assert_eq!(resolve_model(None, ""), DEFAULT_MODEL);
    }

    #[test]
    fn turn_budget_defaults_unchanged() {
        // P1：不传 turn 时预算必须与改动前完全一致（max / 64000），否则就是静默降级
        assert_eq!(turn_budget(None), ("max", 64000));
        assert_eq!(turn_budget(Some("")), ("max", 64000));
        assert_eq!(turn_budget(Some("unexpected")), ("max", 64000));
        assert_eq!(turn_budget(Some("write")), ("max", 64000));
        // 显式降耗档位
        assert_eq!(turn_budget(Some("revise")), ("high", 32000));
        assert_eq!(turn_budget(Some("chat")), ("low", 8000));
    }

    #[test]
    fn svg_kind_prompt_gives_small_roles_their_own_contract() {
        // P1（2026-09-24 调查 §3）：小构件不再套用"插画式分层/密度"通用要求
        let deco = svg_kind_prompt("deco");
        assert!(deco.contains("60px"), "角饰契约必须点明最终显示尺寸");
        assert!(deco.contains("右下"), "角饰主体应集中在右下（气泡文字在左上）");
        assert!(deco.contains("不要铺满画布"), "角饰必须留白，不得铺满");
        assert!(deco.contains("6–16"), "角饰应有元素上限，避免缩小后糊成一团");

        let divider = svg_kind_prompt("divider");
        assert!(divider.contains("横向贯穿"), "分割线必须横贯");
        assert!(divider.contains("750 120"));

        let frame = svg_kind_prompt("photo-frame");
        assert!(frame.contains("透明"), "照片框中央必须透明（那里放真实照片）");
        assert!(frame.contains("60%"));
        assert!(frame.contains("框宽"));

        let heading = svg_kind_prompt("heading");
        assert!(heading.contains("留白"));

        // 大图角色不附加任何"简化"要求——不得因统一小图口径而让大插画退化
        assert_eq!(svg_kind_prompt("wide"), "");
        assert_eq!(svg_kind_prompt("inline"), "");
        assert_eq!(svg_kind_prompt("unknown"), "");
    }

    #[test]
    fn svg_user_prompt_supports_photo_frame() {
        let pf = svg_user_prompt("photo-frame", "木质画框", None, None).expect("photo-frame 应被识别");
        assert!(pf.contains("600 600"));
        assert!(pf.contains("透明"));
        assert!(svg_user_prompt("banner", "x", None, None).unwrap_err().contains("photo-frame"));
    }

    #[test]
    fn clarify_extracted_from_image_agent_reply() {
        // 3.2 有界回问：子智能体要素不足 → CLARIFY 前缀被识别；正常 SVG 回复不误判
        assert_eq!(
            extract_clarify("CLARIFY: 这幅横幅要画哪一季的校园场景？秋季还是四季通用？").as_deref(),
            Some("这幅横幅要画哪一季的校园场景？秋季还是四季通用？")
        );
        assert_eq!(extract_clarify("  \nCLARIFY:\"画面里咖啡杯是拿铁还是美式？\"\n").as_deref(), Some("画面里咖啡杯是拿铁还是美式？"));
        assert_eq!(extract_clarify("<svg viewBox=\"0 0 750 220\"><rect x=\"0\" y=\"0\" width=\"10\" height=\"10\"/></svg>"), None);
        assert_eq!(extract_clarify("没有 CLARIFY 的普通文本"), None);
        assert_eq!(extract_clarify("CLARIFY:"), None, "空问题不识别");
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

    /// 准备阶段的结果契约（DS 修复指南 §5.2）：模型必须能用 finish_preparation 声明
    /// reply / compose / candidate。这条声明一旦被误删，准备阶段就只能退回"猜模型想干嘛"，
    /// 而 F2/F3 正是从那里来的——所以在这里钉住。
    #[test]
    fn prep_tools_declare_finish_preparation() {
        let v: serde_json::Value = serde_json::from_str(PREP_TOOLS).expect("PREP_TOOLS 必须是合法 JSON");
        let arr = v.as_array().expect("PREP_TOOLS 必须是数组");
        let names: Vec<String> = arr
            .iter()
            .filter_map(|t| t.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()).map(str::to_string))
            .collect();
        assert!(names.contains(&"finish_preparation".to_string()), "缺少终结工具，实测：{names:?}");
        assert!(names.contains(&"load_knowledge".to_string()), "知识工具不能丢，实测：{names:?}");
        let fin = arr
            .iter()
            .find(|t| t["function"]["name"] == "finish_preparation")
            .expect("找不到 finish_preparation");
        let vals: Vec<&str> = fin["function"]["parameters"]["properties"]["outcome"]["enum"]
            .as_array()
            .expect("outcome 必须声明 enum")
            .iter()
            .filter_map(|x| x.as_str())
            .collect();
        assert_eq!(vals, vec!["reply", "compose", "candidate"]);
        let pol: Vec<&str> = fin["function"]["parameters"]["properties"]["assetPolicy"]["enum"]
            .as_array()
            .expect("assetPolicy 必须声明 enum")
            .iter()
            .filter_map(|x| x.as_str())
            .collect();
        assert_eq!(pol, vec!["preserve", "modify"]);
    }

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

    /// 指南 §5.3：finish_reason / usage / 服务端模型名要**真的接上**；
    /// 服务端没返回的字段必须是 None（unknown），不能补 0——那会把"没拿到用量"写成"没花钱"。
    #[test]
    fn prep_parse_carries_metadata_and_never_fabricates_it() {
        let with_meta = r#"{"model":"deepseek-flash","choices":[{"finish_reason":"tool_calls","message":{"content":null,"tool_calls":[{"id":"c1","type":"function","function":{"name":"load_knowledge","arguments":"{}"}}]}}],"usage":{"prompt_tokens":120,"completion_tokens":34,"total_tokens":154}}"#;
        let r = parse_prep_reply(with_meta).expect("ok");
        assert_eq!(r.model.as_deref(), Some("deepseek-flash"));
        assert_eq!(r.finish_reason.as_deref(), Some("tool_calls"));
        assert_eq!(
            r.usage.as_ref().and_then(|u| u.get("total_tokens")).and_then(|v| v.as_i64()),
            Some(154)
        );

        // 反向对照：服务端没给这些字段 → 一律 None，不出现 0 / 空对象
        let bare = r#"{"choices":[{"message":{"content":"READY"}}]}"#;
        let b = parse_prep_reply(bare).expect("ok");
        assert_eq!(b.model, None);
        assert_eq!(b.finish_reason, None);
        assert_eq!(b.usage, None);
        // 显式 null 的 usage 也算"没返回"，不能变成 Some(null)
        let null_usage = r#"{"choices":[{"message":{"content":"READY"}}],"usage":null}"#;
        assert_eq!(parse_prep_reply(null_usage).expect("ok").usage, None);
    }

    #[test]
    fn prep_parse_rejects_incomplete_tool_calls() {
        // C2：字段缺失必须报错并指明缺的是哪个字段，而不是造一条空调用——
        // 空名字的前端无法派发，且没有任何线索指向"模型请求了工具但字段残缺"。
        let no_name = r#"{"choices":[{"message":{"tool_calls":[{"id":"call_1","type":"function","function":{"arguments":"{}"}}]}}]}"#;
        let err = parse_prep_reply(no_name).expect_err("缺 function.name 应报错");
        assert!(err.contains("function.name"), "错误串要点出缺失字段：{err}");

        let no_id = r#"{"choices":[{"message":{"tool_calls":[{"type":"function","function":{"name":"load_knowledge","arguments":"{\"name\":\"style-guochao\"}"}}]}}]}"#;
        let err = parse_prep_reply(no_id).expect_err("缺 id 应报错");
        assert!(err.contains("字段 id"), "错误串要点出缺失字段：{err}");

        let no_args = r#"{"choices":[{"message":{"tool_calls":[{"id":"call_1","function":{"name":"load_knowledge"}}]}}]}"#;
        let err = parse_prep_reply(no_args).expect_err("缺 arguments 应报错");
        assert!(err.contains("function.arguments"), "错误串要点出缺失字段：{err}");

        // 多个调用时要点出是第几个（从 1 起），便于对着响应体核对
        let second_broken = r#"{"choices":[{"message":{"tool_calls":[{"id":"call_1","function":{"name":"load_knowledge","arguments":"{}"}},{"id":"call_2","function":{"arguments":"{}"}}]}}]}"#;
        let err = parse_prep_reply(second_broken).expect_err("第二个调用缺 name 应报错");
        assert!(err.contains("第 2 个"), "错误串要点出是第几个调用：{err}");
        assert!(err.contains("function.name"), "{err}");
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
        ChatMsg { role: role.into(), content: Some(content.into()), tool_call_id: None, tool_calls: vec![], images: vec![] }
    }

    // ---------- 可控假 HTTP 服务（修复计划阶段 6 第 2 条）----------
    // 目的：在没有真实模型、没有网络的前提下，测试**延迟、超时、错误、取消**这四类
    // 只能在真实链路上出现的行为。最小 HTTP/1.1 实现：读一次请求头 → 可选延迟 → 写一个响应。
    mod fake {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
        use std::sync::Arc;
        use std::thread;
        use std::time::Duration;

        /// 假服务实例计数器（生成唯一路径前缀，见 `start_with_models` 注释）
        static INSTANCE: AtomicUsize = AtomicUsize::new(0);

        pub struct Server {
            pub base_url: String,
            /// 服务端实际收到的**补全**请求数（断言"取消后不再派发"这类事实）
            pub hits: Arc<AtomicUsize>,
            /// `/models` 被探测的次数（**不计入 `hits`**，见 `start_with_models` 的注释）。
            /// 上限缓存是否真的生效，只能靠这个计数看出来：缓存命中 ⇒ 不再探测 ⇒ 计数不涨。
            pub models_hits: Arc<AtomicUsize>,
            stop: Arc<AtomicBool>,
        }

        impl Server {
            /// `delay`：收到请求后先等这么久再回；`respond`：按请求文本给出 (状态码, 响应体)
            pub fn start<F>(delay: Duration, respond: F) -> Server
            where
                F: Fn(&str) -> (u16, String) + Send + Sync + 'static,
            {
                Self::start_with_models(delay, respond, models_body(DEFAULT_TEST_MAX_OUTPUT))
            }

            /// 同上，但可指定固定不变的 `/models` 返回体（用于验证上限钳制/退兜底）。
            /// **`/models` 一律立刻回、且不计入 `hits`**——它只是旁路探测，
            /// 不该污染"这次请求派发了几次""耗时多久"这类断言。
            pub fn start_with_models<F>(delay: Duration, respond: F, models: String) -> Server
            where
                F: Fn(&str) -> (u16, String) + Send + Sync + 'static,
            {
                Self::start_with_models_fn(delay, respond, move || models.clone())
            }

            /// 同上，但 `/models` 的返回体每次探测时现算——可以**先坏后好**，
            /// 用于验证"失败会被缓存（过期前不再探测）/ 清缓存后会重新探测"。
            pub fn start_with_models_fn<F, M>(delay: Duration, respond: F, models: M) -> Server
            where
                F: Fn(&str) -> (u16, String) + Send + Sync + 'static,
                M: Fn() -> String + Send + Sync + 'static,
            {
                let listener = TcpListener::bind("127.0.0.1:0").expect("应能绑定本地端口");
                listener.set_nonblocking(true).expect("应能设非阻塞");
                let port = listener.local_addr().expect("取端口").port();
                // 每个实例一个唯一路径前缀：模型上限按 base_url 缓存，而端口会被操作系统复用，
                // 只靠端口做键会让不同测试互相串味（实测表现为随机失败）。
                let tag = format!("/t{}", INSTANCE.fetch_add(1, Ordering::SeqCst));
                let stop = Arc::new(AtomicBool::new(false));
                let stop2 = stop.clone();
                let hits = Arc::new(AtomicUsize::new(0));
                let hits2 = hits.clone();
                let models_hits = Arc::new(AtomicUsize::new(0));
                let models_hits2 = models_hits.clone();
                let respond = Arc::new(respond);
                let models = Arc::new(models);
                thread::spawn(move || {
                    while !stop2.load(Ordering::SeqCst) {
                        match listener.accept() {
                            Ok((mut sock, _)) => {
                                let _ = sock.set_read_timeout(Some(Duration::from_secs(5)));
                                let buf = read_request(&mut sock);
                                // 空连接不计数：客户端连接池会偶尔开一条不发送任何请求就关闭的连接，
                                // 把它算成一次命中会让"派发了几次"这类断言偶发假红（实测 8 轮中 1 轮）。
                                if buf.is_empty() {
                                    continue;
                                }
                                let req = String::from_utf8_lossy(&buf).to_string();
                                let is_models = req.starts_with("GET ") && req.contains("/models");
                                if is_models {
                                    models_hits2.fetch_add(1, Ordering::SeqCst);
                                    let body = models();
                                    let head = format!(
                                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                        body.len()
                                    );
                                    let _ = sock.write_all(head.as_bytes());
                                    let _ = sock.write_all(body.as_bytes());
                                    let _ = sock.flush();
                                    continue;
                                }
                                hits2.fetch_add(1, Ordering::SeqCst);
                                if !delay.is_zero() {
                                    thread::sleep(delay);
                                }
                                let (status, body) = respond(&req);
                                let reason = if status == 200 { "OK" } else { "Error" };
                                let head = format!(
                                    "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                    body.len()
                                );
                                let _ = sock.write_all(head.as_bytes());
                                let _ = sock.write_all(body.as_bytes());
                                let _ = sock.flush();
                            }
                            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                thread::sleep(Duration::from_millis(5));
                            }
                            Err(_) => break,
                        }
                    }
                });
                Server { base_url: format!("http://127.0.0.1:{port}{tag}"), hits, models_hits, stop }
            }
        }

        /// 测试用：模型声明的输出上限（取真实查询值，让钳制成为无操作）
        pub const DEFAULT_TEST_MAX_OUTPUT: u64 = 393_216;

        /// 一个最小的 `/models` 响应体
        pub fn models_body(max_output_tokens: u64) -> String {
            format!(
                r#"{{"object":"list","data":[{{"id":"fake-model","context_window":1048576,"max_output_tokens":{max_output_tokens}}}]}}"#
            )
        }

        impl Drop for Server {
            fn drop(&mut self) {
                self.stop.store(true, Ordering::SeqCst);
            }
        }

        /// 请求头里的 `Content-Length`（没有该头 → 0，GET 就是这种情况）
        fn content_length_of(head: &str) -> usize {
            for line in head.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    if k.trim().eq_ignore_ascii_case("content-length") {
                        return v.trim().parse::<usize>().unwrap_or(0);
                    }
                }
            }
            0
        }

        /// 读一次完整请求：先读全请求头，再按 `Content-Length` 读全正文。
        ///
        /// **为什么不能"read 一次就回"**（实测教训，别改回去）：accept 返回的连接上，
        /// 请求字节**不保证已经到达**（Windows 上 accept 返回的套接字还可能继承监听套接字的
        /// 非阻塞属性），单次 read 会拿到 0 字节或 WouldBlock，于是一个**完全正常**的请求
        /// 被当成空连接丢掉。表现就是并行跑测试时随机出现
        /// `error sending request`（补全请求被丢）或上限探测静默退回兜底值
        /// （`/models` 被丢 → 拿到不可用的返回体）。加了新测试后并行度变高，这种假红概率明显上升。
        ///
        /// 正文也必须读干净再关：连接上仍有未读数据时 Windows 会直接回 RST，
        /// 客户端即使已经收到响应也会报连接重置。
        fn read_request(sock: &mut std::net::TcpStream) -> Vec<u8> {
            let mut buf: Vec<u8> = Vec::new();
            let mut tmp = [0u8; 8192];
            let start = std::time::Instant::now();
            loop {
                match sock.read(&mut tmp) {
                    Ok(0) => break, // 对端已关闭，或读超时
                    Ok(n) => {
                        buf.extend_from_slice(&tmp[..n]);
                        // 头部读全了？再看正文是否按 Content-Length 读齐
                        if let Some(sep) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                            let head = String::from_utf8_lossy(&buf[..sep]).to_string();
                            if buf.len() >= sep + 4 + content_length_of(&head) {
                                break;
                            }
                        }
                    }
                    Err(_) => {
                        // 一个字节都还没读到：可能只是请求还没到，给一小段宽限期重试；
                        // 已经读到一半：说明对端不再发了，直接放弃（交给调用方按空连接/半截处理）。
                        if !buf.is_empty() || start.elapsed() > Duration::from_millis(500) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(2));
                    }
                }
            }
            buf
        }

        /// 一个最小可用的非流式补全响应体
        pub fn completion_body(text: &str) -> String {
            format!(
                r#"{{"choices":[{{"message":{{"content":"{text}"}},"finish_reason":"stop"}}],"usage":{{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}}}}"#
            )
        }

        /// 一个最小可用的 SSE 流（两段正文 + finish_reason + usage + [DONE]）
        pub fn sse_body(parts: &[&str]) -> String {
            let mut s = String::new();
            for p in parts {
                s.push_str(&format!("data: {{\"choices\":[{{\"delta\":{{\"content\":\"{p}\"}}}}]}}\n\n"));
            }
            s.push_str("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n");
            s.push_str("data: {\"choices\":[],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":6,\"total_tokens\":11}}\n\n");
            s.push_str("data: [DONE]\n\n");
            s
        }
    }

    fn cfg_for(server: &fake::Server) -> LlmConfig {
        LlmConfig { key: "sk-fake".into(), base_url: server.base_url.clone(), model: "fake-model".into() }
    }

    #[tokio::test]
    async fn fake_server_completes_with_usage_and_finish_reason() {
        let s = fake::Server::start(Duration::from_millis(60), |_| (200, fake::completion_body("hello")));
        let cfg = cfg_for(&s);
        let timer = ReqTimer::start();
        let c = raw_completion(&cfg, "fake-model".into(), vec![msg("user", "x")])
            .await
            .expect("假服务应返回成功");
        assert_eq!(c.text, "hello");
        assert_eq!(c.finish_reason.as_deref(), Some("stop"));
        assert_eq!(c.usage.as_ref().and_then(|u| u["total_tokens"].as_u64()), Some(7));
        assert!(timer.ms() < 5_000, "响应应当很快回来");
        assert_eq!(s.hits.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn fake_server_timeout_is_reported_not_hung() {
        // 服务端故意慢 2 秒，客户端只给 1 秒 → 必须**超时返回**而不是一直等
        let s = fake::Server::start(Duration::from_secs(2), |_| (200, fake::completion_body("late")));
        let cfg = cfg_for(&s);
        let t0 = std::time::Instant::now();
        let err = raw_completion_with(&cfg, "fake-model".into(), vec![msg("user", "x")], 1)
            .await
            .expect_err("应超时");
        assert!(t0.elapsed().as_secs() < 2, "必须在超时时限附近返回，而不是等满服务端的 2 秒");
        assert_eq!(classify_error(&err), "network", "超时应归入网络类（可在预算内重试）：{err}");
    }

    #[tokio::test]
    async fn fake_server_http_error_is_classified() {
        for (status, want) in [(401u16, "auth"), (400, "auth"), (500, "unknown"), (429, "unknown")] {
            let s = fake::Server::start(Duration::ZERO, move |_| {
                (status, r#"{"error":{"message":"boom"}}"#.to_string())
            });
            let cfg = cfg_for(&s);
            let err = raw_completion(&cfg, "fake-model".into(), vec![msg("user", "x")])
                .await
                .expect_err("应失败");
            assert!(err.contains(&status.to_string()), "错误文案应带上状态码：{err}");
            // 鉴权/参数类必须与网络类分开：前者重试无用，后者可在预算内再试
            let got = classify_error(&err);
            if want == "auth" {
                assert_eq!(got, "auth", "{status} 应判为 auth（不重试）：{err}");
            } else {
                assert_ne!(got, "auth", "{status} 不应被判为鉴权错误（它会阻止本就该做的重试）");
            }
        }
    }

    #[tokio::test]
    async fn fake_server_stream_collects_deltas_and_meta() {
        let s = fake::Server::start(Duration::ZERO, |_| (200, fake::sse_body(&["你", "好"])));
        let cfg = cfg_for(&s);
        let mut got = String::new();
        let mut meta = StreamMeta::default();
        let text = stream_chat_budgeted(&cfg, vec![msg("user", "x")], "max", 100, &mut meta, |d| got.push_str(&d))
            .await
            .expect("流式应成功");
        assert_eq!(text, "你好");
        assert_eq!(got, "你好", "增量回调与最终文本必须一致");
        assert_eq!(meta.finish_reason.as_deref(), Some("stop"));
        assert_eq!(meta.usage.as_ref().and_then(|u| u["completion_tokens"].as_u64()), Some(6));
    }

    #[tokio::test]
    async fn fake_server_stream_http_200_without_sse_is_not_a_success() {
        // C1：HTTP 200 但正文不是 SSE（企业网关注入的 HTML 200 就是这样）时，`feed_sse_bytes`
        // 一个 delta 都认不出来 → 收集到的正文为空。此前这条路径会被当成成功返回：
        // 用户看到空气泡且没有报错，日志里却记着 ok=true / responseLength=0。
        let s = fake::Server::start(Duration::ZERO, |_| {
            (200, "<html><body>502 Bad Gateway</body></html>".to_string())
        });
        let cfg = cfg_for(&s);
        let mut deltas = String::new();
        let collected = stream_chat_budgeted(
            &cfg,
            vec![msg("user", "x")],
            "max",
            100,
            &mut StreamMeta::default(),
            |d| deltas.push_str(&d),
        )
        .await
        .expect("传输层本身是成功的（200 + 完整正文），失败判定在收尾那一步");
        assert!(collected.is_empty(), "非 SSE 正文不应产出任何增量：{collected:?}");
        assert!(deltas.is_empty(), "前端也不应收到任何增量");
        let err = require_nonempty_stream(Ok(collected)).expect_err("零正文必须判为失败");
        assert_eq!(err, EMPTY_REPLY_ERR);
        assert_eq!(classify_error(&err), "empty", "必须归到前端已支持的 empty 分类：{err}");
    }

    #[test]
    fn empty_stream_is_a_failure_but_a_short_reply_is_not() {
        // 只判"恰好 0 字"：流式正文确实可能很短，任何非空阈值都会误伤正常回合
        assert_eq!(require_nonempty_stream(Ok("好".into())).unwrap(), "好");
        assert!(require_nonempty_stream(Ok(String::new())).is_err(), "零字必须判为失败");
        let err = require_nonempty_stream(Ok(String::new())).unwrap_err();
        assert_eq!(classify_error(&err), "empty");
        // 上游已经给出的失败原样透传，不被收尾判定改写
        let e = require_nonempty_stream(Err("请求 DeepSeek 失败：连接被重置".into()));
        assert_eq!(e.unwrap_err(), "请求 DeepSeek 失败：连接被重置");
    }

    #[tokio::test]
    async fn fake_server_cancel_stops_waiting_and_is_recorded_as_cancel() {
        use crate::cancel::{run_cancellable, CancelState};
        // 服务端慢 5 秒；发出请求后 80ms 取消 → 必须立刻返回，且分类为 cancel
        let s = fake::Server::start(Duration::from_secs(5), |_| (200, fake::completion_body("late")));
        let cfg = cfg_for(&s);
        let st = std::sync::Arc::new(CancelState::default());
        let st2 = st.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(80)).await;
            st2.cancel("r-cancel");
        });
        let t0 = std::time::Instant::now();
        let fut = raw_completion_with(&cfg, "fake-model".into(), vec![msg("user", "x")], 30);
        let err = run_cancellable(&st, Some("r-cancel"), fut).await.expect_err("应被取消");
        // 服务端要慢 5 秒；只要明显早于它返回，就证明取消生效了。
        // 阈值不卡到 1 秒以内——机器满载时调度延迟会让严苛阈值偶发假红（真机验收时就撞到过一次），
        // 而这条断言真正要区分的是"立刻返回"与"等满了服务端"。
        assert!(t0.elapsed().as_secs() < 4, "取消必须立刻返回，不能等满 5 秒");
        assert_eq!(classify_error(&err), "cancel");
    }

    #[tokio::test]
    async fn fake_server_rate_limit_forwards_retry_hint() {
        // 429 + Retry-After：等待提示必须被带到前端（前端据此决定"等多久"或"预算不够就不等"）。
        // 这里用手写的响应头，因为 fake::Server 只发固定头，所以单独起一个最小服务。
        // 注意要**循环接受两次连接**：现在请求前会先探一次 `/models`，
        // 只 accept 一次的话那次探测就把连接吃掉，真正的补全请求根本发不出去。
        use std::io::{Read, Write};
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for _ in 0..2 {
                let Ok((mut sock, _)) = listener.accept() else { return };
                let mut buf = [0u8; 4096];
                let n = sock.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let is_models = req.starts_with("GET ") && req.contains("/models");
                let (extra, body) = if is_models {
                    ("OK".to_string(), fake::models_body(393_216))
                } else {
                    (
                        "Too Many Requests\r\nRetry-After: 3".to_string(),
                        r#"{"error":{"message":"rate limited"}}"#.to_string(),
                    )
                };
                let status = if is_models { 200 } else { 429 };
                let head = format!(
                    "HTTP/1.1 {status} {extra}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = sock.write_all(head.as_bytes());
                let _ = sock.write_all(body.as_bytes());
            }
        });
        let cfg = LlmConfig { key: "k".into(), base_url: format!("http://127.0.0.1:{port}/rl"), model: "m".into() };
        let err = raw_completion(&cfg, "m".into(), vec![msg("user", "x")])
            .await
            .expect_err("429 应当失败");
        assert!(err.contains("429"), "{err}");
        assert!(err.contains(&format!("{RETRY_HINT_PREFIX}3")), "应转发 Retry-After：{err}");
        assert_eq!(classify_error(&err), "network", "限流属于可重试的网络类");
    }

    #[test]
    fn retry_hint_parses_only_seconds_and_caps() {
        // 只认秒数形式；上限 10 分钟（异常值不把预算卡死）。
        // 直接打在生产函数上——此前测试里另有一份只接受 &str 的副本，断言全落在副本上（假绿）。
        assert_eq!(parse_retry_after("3"), Some(3));
        assert_eq!(parse_retry_after("  7  "), Some(7), "头部取值可能带空白，应容忍");
        assert_eq!(parse_retry_after("99999"), Some(RETRY_HINT_MAX_SECS), "超过上限必须封顶");
        assert_eq!(parse_retry_after("Wed, 21 Oct 2026 07:28:00 GMT"), None, "HTTP-date 不解析");
        assert_eq!(parse_retry_after(""), None);
        assert_eq!(parse_retry_after("-5"), None, "负数不是合法秒数");
        assert_eq!(parse_retry_after("abc"), None);
    }

    #[test]
    fn nonstream_budget_is_large_enough_for_reasoning_plus_output() {
        // 2026-09-29 真机实测：上限 8000 时，绘图请求 finish_reason=length、completion=8000、
        // 正文为空——推理把预算吃光，SVG 一个字都没输出。这里把结论钉成断言，防止回退。
        assert!(
            FALLBACK_MAX_OUTPUT_TOKENS >= 16000,
            "非流式输出上限过低会重现'推理吃光预算、正文为空'（实测 8000 必失败）"
        );
    }

    #[test]
    fn limits_are_clamped_to_the_model_ceiling() {
        // 服务端实测：max_tokens 超过模型上限直接 400（`valid range is [1, 393216]`），
        // 而 400 属于不重试的 auth 类——整次请求会直接失败。所以必须先钳制再发送。
        let real = ModelLimits { max_output_tokens: 393_216 };
        assert_eq!(clamp_to_model(64_000, real), 64_000, "低于上限时原样保留");
        assert_eq!(clamp_to_model(400_000, real), 393_216, "超过上限必须钳到上限");
        assert_eq!(clamp_to_model(0, real), 1, "下限为 1");
        let tiny = ModelLimits { max_output_tokens: 4096 };
        assert_eq!(clamp_to_model(64_000, tiny), 4096, "小上限模型同样收敛");
    }

    #[test]
    fn fallback_limits_are_the_validated_values() {
        // 查询失败时退回"已验证可用"的值，而不是回到那个已知会失败的低值
        assert_eq!(fallback_limits().max_output_tokens, FALLBACK_NONSTREAM_MAX_TOKENS);
        assert!(fallback_limits().max_output_tokens >= 16000);
    }

    #[tokio::test]
    async fn model_limits_fall_back_when_endpoint_is_unusable() {
        // 1) /models 返回 200 但不是模型列表 → 安静退兜底
        let s = fake::Server::start_with_models(Duration::ZERO, |_| (200, "{}".into()), "{}".into());
        assert_eq!(model_limits(&cfg_for(&s)).await, fallback_limits());
        // 2) /models 直接报错 → 同样退兜底
        let s2 = fake::Server::start_with_models(Duration::ZERO, |_| (200, "{}".into()), "{}".into());
        assert_eq!(model_limits(&cfg_for(&s2)).await, fallback_limits());
        // 3) 服务端给了 0 → 视为没有信息，退兜底（不能用 "上限 0" 去发请求）
        let s3 = fake::Server::start_with_models(Duration::ZERO, |_| (200, "{}".into()), fake::models_body(0));
        assert_eq!(model_limits(&cfg_for(&s3)).await, fallback_limits());
        // 4) 正常返回时必须采信服务端的值（这正是本次改动的目的）
        let s4 = fake::Server::start_with_models(Duration::ZERO, |_| (200, "{}".into()), fake::models_body(393_216));
        assert_eq!(model_limits(&cfg_for(&s4)).await, ModelLimits { max_output_tokens: 393_216 });
    }

    #[tokio::test]
    async fn nonstream_request_uses_the_model_reported_ceiling() {
        // 端到端把"查到什么就发什么"钉住：/models 报 123456，实际发出的 max_tokens 就该是 123456
        let captured = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
        let c2 = captured.clone();
        let s = fake::Server::start_with_models(
            Duration::ZERO,
            move |req| {
                *c2.lock().unwrap() = req.to_string();
                (200, fake::completion_body("ok"))
            },
            fake::models_body(123_456),
        );
        let cfg = cfg_for(&s);
        raw_completion(&cfg, "fake-model".into(), vec![msg("user", "x")])
            .await
            .expect("应成功");
        let body = captured.lock().unwrap().clone();
        // 只看请求体里那一行（HTTP 头里没有 max_tokens）
        let json = body.split("\r\n\r\n").nth(1).unwrap_or("");
        assert!(json.contains("\"max_tokens\":123456"), "应按模型上限发送：{json}");
        assert!(json.contains(&format!("\"reasoning_effort\":\"{NONSTREAM_EFFORT}\"")), "推理档位应显式发送：{json}");
    }

    #[tokio::test]
    async fn prep_request_uses_the_model_reported_ceiling_and_no_effort_knob() {
        // 与 `nonstream_request_uses_the_model_reported_ceiling` 同一口径，覆盖 prep：
        // 原先这里硬编码 max_tokens=3200，现在必须与模型自报上限一致（查不到才退兜底）。
        let captured = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
        let c2 = captured.clone();
        let s = fake::Server::start_with_models(
            Duration::ZERO,
            move |req| {
                *c2.lock().unwrap() = req.to_string();
                (200, fake::completion_body("READY"))
            },
            fake::models_body(123_456),
        );
        let cfg = cfg_for(&s);
        let reply = request_prep(&cfg, vec![msg("user", "写一篇咖啡店开业推文")])
            .await
            .expect("prep 应成功");
        assert_eq!(reply.text.as_deref(), Some("READY"));
        let body = captured.lock().unwrap().clone();
        let json = body.split("\r\n\r\n").nth(1).unwrap_or("");
        assert!(
            json.contains("\"max_tokens\":123456"),
            "prep 的输出上限应与模型自报上限同口径（而不是硬编码 3200）：{json}"
        );
        assert!(json.contains("\"tools\""), "prep 仍然必须带工具声明：{json}");
        // 取舍：prep 的产出只有"一句澄清问题"或"READY + 工具调用"（实测 154–335 token），
        // 显式给 high 只会拉长推理链、增加用户等待。这条断言防止有人顺手把它"统一"成 raw_completion。
        assert!(
            !json.contains("reasoning_effort"),
            "prep 不应显式携带推理档位（产出极短，给 high 只加耗时）：{json}"
        );
    }

    #[tokio::test]
    async fn brief_request_uses_the_model_reported_ceiling_and_no_effort_knob() {
        // 补 brief 原先硬编码 max_tokens=1200（实测每次只用 378–501 token，但没有证据说明
        // 更复杂的追问下 1200 一定够），改为与模型自报上限同口径。
        let captured = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
        let c2 = captured.clone();
        let s = fake::Server::start_with_models(
            Duration::ZERO,
            move |req| {
                *c2.lock().unwrap() = req.to_string();
                (200, fake::completion_body("清晨的咖啡店门头，木质招牌与暖黄灯光"))
            },
            fake::models_body(123_456),
        );
        let cfg = cfg_for(&s);
        let text = complete_brief(&cfg, "咖啡店门头", "画哪一季的景色？", Some("日系"))
            .await
            .expect("补 brief 应成功");
        assert!(text.contains("咖啡店门头"));
        let body = captured.lock().unwrap().clone();
        let json = body.split("\r\n\r\n").nth(1).unwrap_or("");
        assert!(
            json.contains("\"max_tokens\":123456"),
            "补 brief 的输出上限应与模型自报上限同口径（而不是硬编码 1200）：{json}"
        );
        assert!(
            !json.contains("reasoning_effort"),
            "补 brief 不应显式携带推理档位（产出极短，给 high 只加耗时）：{json}"
        );
    }

    #[test]
    fn failure_cache_ttl_boundary_is_exactly_sixty_seconds() {
        // "失败会被缓存 60 秒"里的 60 秒：TTL 边界直接断言，不做真实等待
        // （真等 60 秒会让这条测试无法在日常回归里跑）。
        let t0 = std::time::Instant::now();
        assert!(failure_is_fresh(t0, t0), "刚失败时必须在有效期内");
        assert!(
            failure_is_fresh(t0, t0 + LIMITS_FAILURE_TTL - Duration::from_millis(1)),
            "TTL 内必须仍算新鲜（不再探测）"
        );
        assert!(
            !failure_is_fresh(t0, t0 + LIMITS_FAILURE_TTL),
            "到达 TTL 即过期，必须允许重新探测（否则网络恢复后永远接不上）"
        );
        assert!(!failure_is_fresh(t0, t0 + Duration::from_secs(3600)));
    }

    #[tokio::test]
    async fn limits_failure_is_cached_and_a_cleared_cache_reprobes() {
        // 这条是 `clear_limits_key` 的真实用途：验证"失败会被缓存（TTL 内不再打 /models）、
        // 按 key 清掉后会重新探测"。**只清本测试自己的 key**——全表清空会让并行测试互相删掉
        // 对方的缓存条目，对方多探一次 `/models`，变成顺序相关的偶发假红。
        // 假服务先坏后好：`/models` 第一次返回 `{}`（没有 data 数组 → 探测失败），
        // 之后（网络恢复）返回合法的模型列表。
        let healed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let healed2 = healed.clone();
        let s = fake::Server::start_with_models_fn(
            Duration::ZERO,
            |_| (200, fake::completion_body("ok")),
            move || {
                if healed2.load(std::sync::atomic::Ordering::SeqCst) {
                    fake::models_body(222_222)
                } else {
                    "{}".to_string()
                }
            },
        );
        let cfg = cfg_for(&s);
        // 本实例的 key（base_url 含唯一路径前缀）必然是全新的，这里清一次只是把前提写明
        clear_limits_key(&cfg);
        let probes = || s.models_hits.load(std::sync::atomic::Ordering::SeqCst);

        // 1) 探测失败 → 退兜底值（绝不报错），并真的探测过一次
        assert_eq!(model_limits(&cfg).await, fallback_limits(), "查不到上限应退兜底，而不是失败");
        assert_eq!(probes(), 1, "第一次调用应探测一次 /models");

        // 2) 再调用：失败已入缓存，**不再探测**——否则离线时每个绘图/补 brief 请求
        //    都要先白等一次旁路超时（这正是"失败也缓存"的理由）。
        assert_eq!(model_limits(&cfg).await, fallback_limits());
        assert_eq!(probes(), 1, "失败结果应被缓存，TTL 内不得重复探测（实际 {} 次）", probes());

        // 3) 服务恢复 + 清掉本 key → 重新探测，并采信新值
        healed.store(true, std::sync::atomic::Ordering::SeqCst);
        clear_limits_key(&cfg);
        assert_eq!(
            model_limits(&cfg).await,
            ModelLimits { max_output_tokens: 222_222 },
            "清缓存后应重新探测并采信服务端的新值（probes={}, hits={}）",
            probes(),
            s.hits.load(std::sync::atomic::Ordering::SeqCst)
        );
        assert_eq!(probes(), 2, "清缓存后应恰好再探测一次（实际 {} 次）", probes());

        // 4) 成功值此后在进程内一直有效，不必再探测
        assert_eq!(model_limits(&cfg).await, ModelLimits { max_output_tokens: 222_222 });
        assert_eq!(probes(), 2, "成功值应长期有效，不再探测（实际 {} 次）", probes());
    }

    #[test]
    fn nonstream_timeout_stays_at_the_empirically_covered_value() {
        // 任务 2 的结论钉成断言：上限（393216）与超时（180 秒）不同步是**有意的**。
        // 实测吞吐约 268 token/秒 ⇒ 180 秒 ≈ 4.8 万 token，而实测最坏样本是 21238 token
        // （画图，83.6 秒）——180 秒仍有两倍余量；反过来 393216 token 需要约 1470 秒，
        // 上限永远先撞不到。把超时抬到与上限相称，只会让"网络卡住"变成干等 25 分钟。
        // 因此：上限负责"不人为截断"，超时负责"兜住跑飞"。改这个数值必须带新的实测依据。
        assert_eq!(DEFAULT_NONSTREAM_TIMEOUT_SECS, 180);
        assert!(
            DEFAULT_NONSTREAM_TIMEOUT_SECS * 268 > 21_238 * 2,
            "180 秒按实测吞吐折算必须仍覆盖最坏实测样本的两倍以上"
        );
    }

    #[test]
    fn nonstream_effort_is_pinned_to_high() {
        // 实测：low 档 0/4 过闸（元素跑出画布），high 档 4/4。别把这里改成 low。
        assert_eq!(NONSTREAM_EFFORT, "high");
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
        // 语义就是 is_empty()（原写法 `!vague.calls.is_empty() == false` 虽然断言正确，
        // 但双重否定极易被后来者误读成反义而改错，直接写成肯定式）
        assert!(vague.calls.is_empty(), "模糊请求不应直接取工具: {vague_text}");
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
        let reply = stream_chat_budgeted(
            &cfg,
            vec![msg("system", system), msg("user", "写一篇咖啡店开业宣传推文，日系风，800 字左右，直接写"), msg("user", &write)],
            "max",
            64000,
            &mut StreamMeta::default(),
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
        let user = svg_user_prompt(
            "wide",
            "清晨的咖啡店门头：木质招牌、暖黄灯光、门口一株绿植与花盆，门廊有地砖与盆栽层次",
            Some("日系"),
            None,
        )
        .expect("prompt 应组装成功");
        let text = raw_completion(
            &cfg,
            image_model(),
            vec![msg("system", SVG_SYSTEM_PROMPT), msg("user", &user)],
        )
        .await
        .expect("图像子智能体应返回内容")
        .text;
        assert!(extract_clarify(&text).is_none(), "该说明充足，不应回问: {text}");
        let svg = extract_svg(&text).expect("应产出 SVG");
        assert!(svg.contains("viewBox="), "应带 viewBox");
        let tag_re = Regex::new(r#"(?i)<(circle|rect|ellipse|line|path|polygon|polyline|image)\b"#).expect("ok");
        let n = tag_re.find_iter(&svg).count();
        println!("LIVE SVG: elements={n} len={} head={}", svg.len(), svg.chars().take(60).collect::<String>());
        assert!(n >= 10, "可见图形元素应 ≥10（复杂度契约），实际 {n}");
    }
}
