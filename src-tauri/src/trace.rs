// trace.rs —— 创作回合的业务追踪（修复计划阶段 1，2026-09-28）
//
// 为什么需要它：真实运行调查（2026-09-28）发现，工作区只保存了会话内容与最终告警，
// 没有任何按请求落盘的业务日志。因此「素材生成失败」只有一句话，**分不清**究竟是网络错误、
// 接口空返回、内容里没有 SVG，还是本地质检拒绝；也无法追认每张图实际尝试了几次、耗时多少。
// 本模块把每个创作回合的关键证据写进独立 JSONL，让「失败」变成可区分、可追踪的事实。
//
// 边界（与计划一致，不得越界）：
// - **不记录密钥**：调用方只传结构化字段；没有任何字段承载 API key 或 Authorization。
// - **不记录完整请求正文与参考图片**：只记长度与分类（`responseLength` / `error` 为截断文案）。
// - **日志失败不阻塞创作**：所有 IO 错误在命令边界被吞掉，命令恒返回 Ok。
// - 目录在 workspace 下（`<workspace>/traces/`），与作品数据同处一地但不属于作品。

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// 单回合日志文件上限。超出后不再追加（回合很可能已经异常循环，继续写只会吃满磁盘）。
pub const TRACE_MAX_FILE_BYTES: u64 = 512 * 1024;
/// 目录内保留的回合日志数；超出按修改时间淘汰最旧的。
pub const TRACE_MAX_FILES: usize = 60;
/// runId 允许的字符集与长度（runId 会成为文件名，必须先消毒，杜绝路径穿越）。
const RUN_ID_MAX: usize = 64;

/// 失败分类（与前端 `src/lib/trace.ts` 的 `FailureClass` 必须逐字一致；
/// `scripts/trace-check.mjs` 会交叉比对两侧，改一处漏一处会直接断言失败）。
pub const FAILURE_CLASSES: [&str; 7] = ["network", "empty", "no-svg", "quality", "cancel", "auth", "unknown"];

/// 单调时钟计时器：耗时一律用它，不用墙钟（墙钟会被系统对时跳变污染）。
pub struct ReqTimer {
    started: Instant,
    wall_ms: u64,
}

impl ReqTimer {
    pub fn start() -> Self {
        ReqTimer { started: Instant::now(), wall_ms: now_ms() }
    }
    /// 已耗时（毫秒，单调时钟）
    pub fn ms(&self) -> u64 {
        self.started.elapsed().as_millis() as u64
    }
    /// 起始墙钟时间（仅用于跨进程排序；耗时不看它）
    pub fn started_at(&self) -> u64 {
        self.wall_ms
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 日志目录：与作品数据同处 workspace（便于用户整体备份/清理），但属于运行痕迹而非作品。
pub fn trace_dir() -> Result<PathBuf, String> {
    Ok(crate::sessions::workspace_dir()?.join("traces"))
}

/// 把 runId 消毒成安全的文件名片段；非法或为空时返回 None（调用方跳过写盘，不报错）。
fn safe_run_id(run_id: &str) -> Option<String> {
    let s: String = run_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(RUN_ID_MAX)
        .collect();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// 追加一条 JSONL 记录。任何失败都只返回 Err 由调用方决定——命令边界会吞掉。
pub fn append(run_id: &str, record: &serde_json::Value) -> Result<(), String> {
    let Some(id) = safe_run_id(run_id) else {
        return Ok(()); // 无 runId 的调用属于旧路径，静默跳过
    };
    let dir = trace_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建日志目录失败：{e}"))?;
    let path = dir.join(format!("{id}.jsonl"));

    // 大小上限：超限后停止写入（不截断已有内容，保留前面完整的证据）
    if let Ok(m) = fs::metadata(&path) {
        if m.len() >= TRACE_MAX_FILE_BYTES {
            return Ok(());
        }
    }

    let mut line = serde_json::to_string(record).map_err(|e| format!("序列化日志失败：{e}"))?;
    line.push('\n');
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("打开日志文件失败：{e}"))?;
    f.write_all(line.as_bytes())
        .map_err(|e| format!("写入日志失败：{e}"))?;
    Ok(())
}

/// 轮转：目录内只保留最近 `TRACE_MAX_FILES` 个回合日志。在每次新建回合（run 记录）后调用。
fn prune(dir: &PathBuf) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut files: Vec<(SystemTime, PathBuf)> = rd
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "jsonl").unwrap_or(false))
        .filter_map(|e| {
            let t = e.metadata().ok().and_then(|m| m.modified().ok())?;
            Some((t, e.path()))
        })
        .collect();
    if files.len() <= TRACE_MAX_FILES {
        return;
    }
    files.sort_by(|a, b| b.0.cmp(&a.0)); // 新的在前
    for (_, p) in files.into_iter().skip(TRACE_MAX_FILES) {
        let _ = fs::remove_file(p);
    }
}

/// 新建一个回合日志（先清掉同名旧文件，保证同 id 重跑不混入上次的行）。
pub fn start_run(run_id: &str) -> Result<(), String> {
    let Some(id) = safe_run_id(run_id) else {
        return Ok(());
    };
    let dir = trace_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建日志目录失败：{e}"))?;
    let _ = fs::remove_file(dir.join(format!("{id}.jsonl")));
    prune(&dir);
    Ok(())
}

/// 由前端上报一条记录（素材位决策、进度、取消等都走这里）。
/// **失败不阻塞创作**：无论内部发生什么，命令都返回 Ok。
#[tauri::command]
pub fn trace_write(run_id: String, record: serde_json::Value) -> Result<(), String> {
    let _ = append(&run_id, &record);
    Ok(())
}

/// 由前端声明一个新回合（会清空该 runId 的旧日志并触发轮转）。
#[tauri::command]
pub fn trace_start(run_id: String) -> Result<(), String> {
    let _ = start_run(&run_id);
    Ok(())
}

/// 组装一条 request 级记录（chat.rs 各模型调用统一使用，字段口径只此一处）。
/// `error` 由调用方传入**已分类的简短文案**，不得包含密钥或完整请求正文。
#[allow(clippy::too_many_arguments)]
pub fn request_record(
    phase: &str,
    model: &str,
    slot_id: Option<&str>,
    attempt: Option<u32>,
    timer: &ReqTimer,
    ok: bool,
    failure: Option<&str>,
    error: Option<&str>,
    response_len: Option<usize>,
    finish_reason: Option<&str>,
    usage: Option<&serde_json::Value>,
) -> serde_json::Value {
    let mut v = serde_json::json!({
        "kind": "request",
        "phase": phase,
        "model": model,
        "attempt": attempt,
        "startedAt": timer.started_at(),
        "ms": timer.ms(),
        "ok": ok,
    });
    if let Some(s) = slot_id {
        v["slotId"] = serde_json::Value::String(s.to_string());
    }
    if let Some(f) = failure {
        // 只接受已登记的分类：任何拼错/新造的分类都会被丢掉，避免日志里出现无法归并的散值
        if FAILURE_CLASSES.contains(&f) {
            v["failure"] = serde_json::Value::String(f.to_string());
        }
    }
    if let Some(e) = error {
        v["error"] = serde_json::Value::String(truncate(e, 240));
    }
    if let Some(n) = response_len {
        v["responseLength"] = serde_json::Value::from(n);
    }
    if let Some(fr) = finish_reason {
        v["finishReason"] = serde_json::Value::String(fr.to_string());
    }
    // usage 只在服务真的返回时记录；缺失就是缺失，不编造
    if let Some(u) = usage {
        if !u.is_null() {
            v["usage"] = compact_usage(u);
        }
    }
    v
}

/// 只保留 token 计数字段，避免把服务返回的其它结构原样落盘。
fn compact_usage(u: &serde_json::Value) -> serde_json::Value {
    let get = |k: &str| u.get(k).and_then(|x| x.as_u64());
    serde_json::json!({
        "prompt": get("prompt_tokens"),
        "completion": get("completion_tokens"),
        "total": get("total_tokens"),
    })
}

/// 截断长文本（保留尾部，便于看到错误码/结尾）；按字符而非字节切，避免切断 UTF-8。
pub fn truncate(s: &str, max_chars: usize) -> String {
    let mut out: String = s.chars().take(max_chars).collect();
    if s.chars().count() > max_chars {
        out.push('…');
    }
    out
}

/// 把一条 request 记录写进回合日志（chat.rs 的唯一落盘入口）。
pub fn log_request(run_id: Option<&str>, rec: &serde_json::Value) {
    if let Some(id) = run_id {
        let _ = append(id, rec);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_id_is_sanitized_against_path_traversal() {
        assert_eq!(safe_run_id("../../etc/passwd").as_deref(), Some("etcpasswd"));
        assert_eq!(safe_run_id("r-1_2").as_deref(), Some("r-1_2"));
        assert_eq!(safe_run_id("///"), None);
        assert_eq!(safe_run_id(""), None);
    }

    #[test]
    fn run_id_is_length_capped() {
        let long = "a".repeat(500);
        assert_eq!(safe_run_id(&long).unwrap().len(), RUN_ID_MAX);
    }

    #[test]
    fn truncate_keeps_char_boundaries() {
        assert_eq!(truncate("你好世界", 2), "你好…");
        assert_eq!(truncate("abc", 3), "abc");
        assert_eq!(truncate("abcd", 3), "abc…");
    }

    #[test]
    fn compact_usage_only_keeps_token_counts() {
        let u = serde_json::json!({
            "prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30,
            "secret_extra": "x"
        });
        let c = compact_usage(&u);
        assert_eq!(c["prompt"], 10);
        assert_eq!(c["completion"], 20);
        assert_eq!(c["total"], 30);
        assert!(c.get("secret_extra").is_none());
    }

    #[test]
    fn failure_classes_match_frontend_vocabulary() {
        // 与 src/lib/trace.ts 的 FailureClass 同集合；改一侧必须同步另一侧
        assert_eq!(FAILURE_CLASSES.len(), 7);
        assert!(FAILURE_CLASSES.contains(&"no-svg"));
        assert!(FAILURE_CLASSES.contains(&"quality"));
        assert!(FAILURE_CLASSES.contains(&"auth"));
    }

    #[test]
    fn timer_is_monotonic_and_started_at_is_wall_clock() {
        let t = ReqTimer::start();
        assert!(t.ms() < 5_000);
        assert!(t.started_at() > 1_600_000_000_000); // 晚于 2020 年，说明是墙钟
    }

    #[test]
    fn request_record_omits_unknown_fields() {
        let t = ReqTimer::start();
        let r = request_record("gen_svg", "deepseek-flash", None, Some(1), &t, false, Some("empty"), None, None, None, None);
        assert_eq!(r["kind"], "request");
        assert_eq!(r["phase"], "gen_svg");
        assert_eq!(r["attempt"], 1);
        assert_eq!(r["failure"], "empty");
        assert!(r.get("slotId").is_none());
        assert!(r.get("usage").is_none());
        assert!(r.get("finishReason").is_none());
    }
}
