// sessions.rs —— 多会话上下文（像 DSH 的会话窗口）
// 每个会话 = 独立上下文 {mode/style/messages}，存 workspace/sessions/<id>.json；
// state.json 记录当前会话；旧单会话 draft.json 首次启动自动迁移（不丢稿）。

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionMsg {
    pub id: u64,
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SessionData {
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub style: String,
    #[serde(default)]
    pub messages: Vec<SessionMsg>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionFile {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    #[serde(flatten)]
    pub data: SessionData,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionMeta {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub count: usize,
}

/// "读不出来"的条目（R1/R2/R3 共用，故放在这里做单一权威）。
///
/// 为什么需要它：列表类接口过去习惯把"读取失败"折叠成"不存在"（`if let Ok(..)` 无分支），
/// 于是界面无法区分"没有这条"与"这条坏了"，用户会看到东西凭空消失。现在坏条目仍**不进** `items`
/// （不能把坏数据当正常项渲染），但必须在同一次返回里如实报出 id 与原因。
#[derive(Serialize, Deserialize, Clone)]
pub struct UnreadableItem {
    pub id: String,
    /// 中文原因（来自 read_* 的错误上下文），直接可给界面展示
    pub error: String,
}

#[derive(Serialize, Deserialize)]
pub struct SessionsList {
    pub items: Vec<SessionMeta>,
    pub current: Option<String>,
    /// R1：文件损坏/读失败的会话。它们不在 `items` 里，但必须让界面知道它们存在过。
    #[serde(default)]
    pub unreadable: Vec<UnreadableItem>,
    /// R6：`state.json`（"当前会话"指针）读/写异常的原因。为空 = 正常。
    /// 没有这个字段时，写失败被 `let _ =` 丢掉，用户重启后打开了另一个会话却毫无提示。
    #[serde(default)]
    pub state_warning: Option<String>,
}

// ---------- 目录与基础 ----------

pub fn workspace_dir() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "无法定位用户目录".to_string())?;
    Ok(PathBuf::from(home).join("Documents").join("wechat-mp-workspace"))
}

pub fn exports_dir() -> Result<PathBuf, String> {
    Ok(workspace_dir()?.join("exports"))
}

fn sessions_dir_at(base: &Path) -> PathBuf {
    base.join("sessions")
}

fn state_path_at(base: &Path) -> PathBuf {
    base.join("state.json")
}

fn now_ts() -> String {
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}{:09}", d.as_secs(), d.subsec_nanos())
}

pub fn new_id() -> String {
    format!("s{}", now_ts())
}

fn derive_title(messages: &[SessionMsg]) -> String {
    for m in messages {
        if m.role == "user" {
            let line = m.content.lines().next().unwrap_or("").trim();
            if !line.is_empty() {
                let cut: String = line.chars().take(16).collect();
                return if cut != line { format!("{cut}…") } else { cut };
            }
        }
    }
    "新对话".to_string()
}

fn write_session(dir: &Path, s: &SessionFile) -> Result<String, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建会话目录失败：{e}"))?;
    let path = dir.join(format!("{}.json", s.id));
    let json = serde_json::to_string_pretty(s).map_err(|e| format!("序列化失败：{e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("写入会话失败：{e}"))?;
    Ok(path.to_string_lossy().to_string())
}

fn read_session(dir: &Path, id: &str) -> Result<Option<SessionFile>, String> {
    let path = dir.join(format!("{id}.json"));
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取会话失败：{e}"))?;
    serde_json::from_str::<SessionFile>(&raw)
        .map(Some)
        .map_err(|e| format!("会话文件损坏：{e}"))
}

/// 读"当前会话"指针。
/// 文件不存在 → `Ok(None)`（首次启动，正常态）；
/// 存在但读不出来/解析不了 → `Err`——把"坏掉"折叠成"没有"正是本文件要修的毛病：
/// 用户会莫名其妙地在重启后打开另一个会话，且原文件还会被下面的回退逻辑覆盖。
fn read_current(base: &Path) -> Result<Option<String>, String> {
    let path = state_path_at(base);
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取 state.json 失败：{e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("state.json 损坏：{e}"))?;
    Ok(v.get("current").and_then(|c| c.as_str()).map(|s| s.to_string()))
}

/// 写"当前会话"指针。返回 Err 由调用方决定怎么呈现（列表里回传 state_warning）。
fn write_current(base: &Path, current: &Option<String>) -> Result<(), String> {
    let json = serde_json::json!({ "current": current });
    let text = serde_json::to_string_pretty(&json).map_err(|e| format!("序列化当前会话失败：{e}"))?;
    std::fs::write(state_path_at(base), text).map_err(|e| format!("写入 state.json 失败：{e}"))
}

/// 会话操作（新建/打开/保存/迁移）后记录"当前会话"的尽力而为版本。
///
/// 为什么不在这里返 Err：会话本体已经落盘，只因"没记住当前会话"就把整个操作报成失败是**另一种不诚实**
/// （前端会提示"保存失败"，而其实保存成功了）。
/// 覆盖面与已知缺口：state.json 本身读不出/写不进这类**持续性**故障，会在每一次 list_sessions 的
/// `state_warning` 里再现（见 list_at，那里同时有读、写两条路径的用例）；但若文件里记的会话仍然有效、
/// 只是这一次没写进去（写失败的瞬间），下一次 list 不会察觉——这是"尽力而为"的边界，不做隐瞒。
fn note_current_best_effort(base: &Path, current: &Option<String>) {
    let _ = write_current(base, current);
}

/// 旧单会话 draft.json → 首个会话（仅当 sessions 目录还没有任何会话）
fn migrate_legacy(base: &Path) -> Result<bool, String> {
    let sd = sessions_dir_at(base);
    let _ = std::fs::create_dir_all(&sd);
    let has_any = std::fs::read_dir(&sd)
        .map_err(|e| format!("读取会话目录失败：{e}"))?
        .any(|e| e.is_ok());
    if has_any {
        return Ok(false);
    }
    let legacy = base.join("draft.json");
    if !legacy.exists() {
        return Ok(false);
    }
    let raw = std::fs::read_to_string(&legacy).map_err(|e| format!("读取旧存档失败：{e}"))?;
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|_| "旧存档损坏，跳过迁移".to_string())?;
    let messages: Vec<SessionMsg> = v["messages"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    Some(SessionMsg {
                        id: m["id"].as_u64().unwrap_or(0),
                        role: m["role"].as_str().unwrap_or("user").to_string(),
                        content: m["content"].as_str().unwrap_or("").to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let file = SessionFile {
        id: new_id(),
        title: derive_title(&messages),
        updated_at: v["updated_at"].as_str().unwrap_or("").to_string(),
        data: SessionData {
            mode: v["mode"].as_str().unwrap_or("auto").to_string(),
            style: v["style"].as_str().unwrap_or("auto").to_string(),
            messages,
        },
    };
    write_session(&sd, &file)?;
    note_current_best_effort(base, &Some(file.id.clone()));
    let _ = std::fs::rename(&legacy, base.join("draft.json.migrated"));
    Ok(true)
}

// ---------- 核心操作（base 可注入，便于测试） ----------

fn list_at(base: &Path) -> Result<SessionsList, String> {
    migrate_legacy(base)?;
    let sd = sessions_dir_at(base);
    let _ = std::fs::create_dir_all(&sd);
    let mut metas = Vec::new();
    let mut unreadable: Vec<UnreadableItem> = Vec::new();
    for entry in std::fs::read_dir(&sd).map_err(|e| format!("读取会话目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".json") {
            continue;
        }
        let id = name.trim_end_matches(".json").to_string();
        // R1：读失败的会话**不进 items**（不当正常项渲染），但也不能凭空消失——
        // 旧实现 `if let Ok(Some(f))` 把损坏会话直接吞掉，用户在侧栏看到的是"这条被我删了吗"。
        match read_session(&sd, &id) {
            Ok(Some(f)) => metas.push(SessionMeta {
                count: f.data.messages.len(),
                id: f.id,
                title: f.title,
                updated_at: f.updated_at,
            }),
            Ok(None) => continue, // 读取过程中文件被删（正常竞态）：确实不存在
            Err(e) => unreadable.push(UnreadableItem { id, error: e }),
        }
    }
    metas.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    let (current_in_file, mut state_warning) = match read_current(base) {
        Ok(c) => (c, None),
        Err(e) => (
            None,
            Some(format!("{e}（已回退到最近一条会话；原文件保留，未被覆盖）")),
        ),
    };
    let resolved = match current_in_file.clone() {
        Some(c) if metas.iter().any(|m| m.id == c) => Some(c),
        // 文件里记的会话已不在列表（被删/坏掉）→ 回退最近一条，与旧行为一致
        _ => metas.first().map(|m| m.id.clone()),
    };
    // 仅在"记住的当前会话与解析结果不同"时才写：state.json 读失败时不写，
    // 避免用回退值覆盖掉那个损坏文件（用户/后续版本还有机会看到它）。
    if state_warning.is_none() && resolved != current_in_file {
        if let Err(e) = write_current(base, &resolved) {
            state_warning = Some(format!("未能记录当前会话（重启后可能打开另一个会话）：{e}"));
        }
    }
    Ok(SessionsList { items: metas, current: resolved, unreadable, state_warning })
}

fn create_at(base: &Path) -> Result<String, String> {
    let id = new_id();
    let file = SessionFile {
        id: id.clone(),
        title: "新对话".to_string(),
        updated_at: now_ts(),
        data: SessionData::default(),
    };
    write_session(&sessions_dir_at(base), &file)?;
    note_current_best_effort(base, &Some(id.clone()));
    Ok(id)
}

fn open_at(base: &Path, id: &str) -> Result<Option<SessionFile>, String> {
    let f = read_session(&sessions_dir_at(base), id)?;
    if f.is_some() {
        note_current_best_effort(base, &Some(id.to_string()));
    }
    Ok(f)
}

#[allow(clippy::too_many_arguments)]
fn save_at(
    base: &Path,
    id: &str,
    title_hint: Option<&str>,
    mode: &str,
    style: &str,
    messages: &[SessionMsg],
) -> Result<String, String> {
    let sd = sessions_dir_at(base);
    let existing = read_session(&sd, id)?;
    let title = match (existing.as_ref(), title_hint) {
        (_, Some(t)) if !t.is_empty() && t != "新对话" => t.to_string(),
        (Some(e), _) if e.title != "新对话" => e.title.clone(),
        _ => derive_title(messages),
    };
    let file = SessionFile {
        id: id.to_string(),
        title,
        updated_at: now_ts(),
        data: SessionData {
            mode: mode.to_string(),
            style: style.to_string(),
            messages: messages.to_vec(),
        },
    };
    write_session(&sd, &file)?;
    note_current_best_effort(base, &Some(id.to_string()));
    Ok(file.title)
}

fn rename_at(base: &Path, id: &str, title: &str) -> Result<(), String> {
    let sd = sessions_dir_at(base);
    if let Some(mut f) = read_session(&sd, id)? {
        let t = title.trim();
        if !t.is_empty() {
            f.title = t.to_string();
        }
        write_session(&sd, &f)?;
    }
    Ok(())
}

fn delete_at(base: &Path, id: &str) -> Result<SessionsList, String> {
    let sd = sessions_dir_at(base);
    let _ = std::fs::remove_file(sd.join(format!("{id}.json")));
    let list = list_at(base)?;
    // 若删除的是当前会话，list_at 已回退到最近会话
    Ok(list)
}

// ---------- Tauri 命令 ----------

#[tauri::command]
pub fn list_sessions() -> Result<SessionsList, String> {
    let base = workspace_dir()?;
    list_at(&base)
}

#[tauri::command]
pub fn create_session() -> Result<String, String> {
    let base = workspace_dir()?;
    create_at(&base)
}

#[tauri::command]
pub fn open_session(id: String) -> Result<Option<SessionFile>, String> {
    let base = workspace_dir()?;
    open_at(&base, &id)
}

#[tauri::command]
pub fn save_session(
    id: String,
    title: Option<String>,
    mode: String,
    style: String,
    messages: Vec<SessionMsg>,
) -> Result<String, String> {
    let base = workspace_dir()?;
    save_at(&base, &id, title.as_deref(), &mode, &style, &messages)
}

#[tauri::command]
pub fn rename_session(id: String, title: String) -> Result<(), String> {
    let base = workspace_dir()?;
    rename_at(&base, &id, &title)
}

#[tauri::command]
pub fn delete_session(id: String) -> Result<SessionsList, String> {
    let base = workspace_dir()?;
    delete_at(&base, &id)
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_base(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("wxmp-sess-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn msg(id: u64, role: &str, content: &str) -> SessionMsg {
        SessionMsg { id, role: role.into(), content: content.into() }
    }

    #[test]
    fn create_list_roundtrip() {
        let base = tmp_base("roundtrip");
        let id = create_at(&base).expect("create");
        let list1 = list_at(&base).expect("list");
        assert_eq!(list1.items.len(), 1);
        assert_eq!(list1.current.as_deref(), Some(id.as_str()));
        save_at(&base, &id, None, "promo", "campus", &[msg(1, "user", "写一篇开学典礼推文")]).expect("save");
        let list2 = list_at(&base).expect("list2");
        assert_eq!(list2.items.len(), 1);
        assert_eq!(list2.items[0].title, "写一篇开学典礼推文");
        assert_eq!(list2.items[0].count, 1);
        let opened = open_at(&base, &id).expect("open").expect("some");
        assert_eq!(opened.data.mode, "promo");
        assert_eq!(opened.data.messages[0].content, "写一篇开学典礼推文");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn title_fallback_and_custom() {
        let base = tmp_base("title");
        let id = create_at(&base).expect("create");
        assert_eq!(list_at(&base).unwrap().items[0].title, "新对话");
        // 自定义标题优先
        save_at(&base, &id, Some("毕业季特辑"), "auto", "auto", &[]).expect("save");
        assert_eq!(list_at(&base).unwrap().items[0].title, "毕业季特辑");
        // 无自定义且已有非默认标题 → 保留
        save_at(&base, &id, None, "auto", "auto", &[msg(2, "assistant", "x")]).expect("save2");
        assert_eq!(list_at(&base).unwrap().items[0].title, "毕业季特辑");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn delete_falls_back_current() {
        let base = tmp_base("delete");
        let a = create_at(&base).expect("a");
        let b = create_at(&base).expect("b");
        let list = delete_at(&base, &b).expect("delete b");
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.current.as_deref(), Some(a.as_str()));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn corrupt_session_reported_not_silently_dropped() {
        // R1：损坏的会话文件不能从列表里"凭空消失"，必须进 unreadable 让界面能说清
        let base = tmp_base("corrupt-session");
        let a = create_at(&base).expect("a");
        std::fs::write(sessions_dir_at(&base).join("s-broken.json"), "{ 不是合法 JSON").unwrap();
        let list = list_at(&base).expect("list");
        assert_eq!(list.items.len(), 1, "坏会话不能当正常项渲染");
        assert_eq!(list.unreadable.len(), 1, "坏会话必须如实上报");
        assert_eq!(list.unreadable[0].id, "s-broken");
        assert!(!list.unreadable[0].error.is_empty(), "错误原因应可直接展示");
        assert_eq!(list.current.as_deref(), Some(a.as_str()));
        assert!(list.state_warning.is_none(), "state.json 正常时不应有告警");
        // 坏文件修好/删掉后告警随之消失（不留残留状态）
        std::fs::remove_file(sessions_dir_at(&base).join("s-broken.json")).unwrap();
        assert!(list_at(&base).unwrap().unreadable.is_empty());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn corrupt_current_session_falls_back_and_reports() {
        // 当前会话本身损坏：应回退到最近一条可读会话，同时把损坏如实报出
        let base = tmp_base("corrupt-current");
        let a = create_at(&base).expect("a");
        let b = create_at(&base).expect("b");
        assert_eq!(list_at(&base).unwrap().current.as_deref(), Some(b.as_str()));
        std::fs::write(sessions_dir_at(&base).join(format!("{b}.json")), "{ 坏").unwrap();
        let list = list_at(&base).expect("list");
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.unreadable.len(), 1);
        assert_eq!(list.current.as_deref(), Some(a.as_str()), "回退到仍可读的会话");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn unreadable_state_file_surfaces_warning() {
        // R6：state.json 存在但读不出来 → 回退 + 告警，且不覆盖原文件
        let base = tmp_base("bad-state");
        let id = create_at(&base).expect("create");
        std::fs::remove_file(state_path_at(&base)).unwrap();
        std::fs::create_dir_all(state_path_at(&base)).unwrap(); // 同名目录 → 读会 IO 失败
        let list = list_at(&base).expect("list");
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.current.as_deref(), Some(id.as_str()), "回退到最近一条");
        let w = list.state_warning.expect("必须有告警");
        assert!(w.contains("state.json"), "告警应指明是哪个文件：{w}");
        assert!(state_path_at(&base).is_dir(), "损坏的原文件不应被覆盖");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn unwritable_state_file_surfaces_warning() {
        // R6 的另一半：state.json 读得出来但写不进去（被设成只读）→ 必须报出来。
        // 旧实现 `let _ = std::fs::write(...)` 把这里吞掉，用户重启后打开的是另一个会话却毫无提示。
        let base = tmp_base("ro-state");
        let a = create_at(&base).expect("a");
        let b = create_at(&base).expect("b");
        // 手写一个指向"已不存在的会话"的 state.json，逼 list_at 走"写回退值"这条路径
        std::fs::write(state_path_at(&base), format!("{{\"current\":\"{a}-gone\"}}")).unwrap();
        let mut perm = std::fs::metadata(state_path_at(&base)).unwrap().permissions();
        perm.set_readonly(true);
        std::fs::set_permissions(state_path_at(&base), perm).unwrap();

        let list = list_at(&base).expect("list");
        assert_eq!(list.current.as_deref(), Some(b.as_str()), "回退到最近一条");
        let w = list.state_warning.expect("写失败必须回传告警");
        assert!(w.contains("state.json"), "告警应指明是哪个文件：{w}");

        // 复原权限，保证临时目录能删干净（只读文件在 Windows 上删不掉）
        let mut perm = std::fs::metadata(state_path_at(&base)).unwrap().permissions();
        perm.set_readonly(false);
        let _ = std::fs::set_permissions(state_path_at(&base), perm);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn migrate_legacy_draft() {
        let base = tmp_base("migrate");
        let legacy = serde_json::json!({
            "version": 1,
            "updated_at": "2026-09-04T00:00:00",
            "mode": "promo",
            "style": "guochao",
            "messages": [{ "id": 1, "role": "user", "content": "旧会话内容" }]
        });
        std::fs::write(base.join("draft.json"), serde_json::to_string(&legacy).unwrap()).unwrap();
        let list = list_at(&base).expect("list");
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0].title, "旧会话内容");
        assert_eq!(list.items[0].count, 1);
        assert!(list.current.is_some());
        assert!(!base.join("draft.json").exists());
        assert!(base.join("draft.json.migrated").exists());
        let _ = std::fs::remove_dir_all(&base);
    }
}
