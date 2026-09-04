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

#[derive(Serialize, Deserialize)]
pub struct SessionsList {
    pub items: Vec<SessionMeta>,
    pub current: Option<String>,
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

fn read_current(base: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(state_path_at(base)).ok()?;
    serde_json::from_str::<serde_json::Value>(&raw)
        .ok()?
        .get("current")?
        .as_str()
        .map(|s| s.to_string())
}

fn write_current(base: &Path, current: &Option<String>) {
    let json = serde_json::json!({ "current": current });
    let _ = std::fs::write(state_path_at(base), serde_json::to_string_pretty(&json).unwrap_or_default());
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
    write_current(base, &Some(file.id.clone()));
    let _ = std::fs::rename(&legacy, base.join("draft.json.migrated"));
    Ok(true)
}

// ---------- 核心操作（base 可注入，便于测试） ----------

fn list_at(base: &Path) -> Result<SessionsList, String> {
    migrate_legacy(base)?;
    let sd = sessions_dir_at(base);
    let _ = std::fs::create_dir_all(&sd);
    let mut metas = Vec::new();
    for entry in std::fs::read_dir(&sd).map_err(|e| format!("读取会话目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".json") {
            continue;
        }
        let id = name.trim_end_matches(".json").to_string();
        if let Ok(Some(f)) = read_session(&sd, &id) {
            metas.push(SessionMeta {
                count: f.data.messages.len(),
                id: f.id,
                title: f.title,
                updated_at: f.updated_at,
            });
        }
    }
    metas.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    let current = read_current(base).filter(|c| metas.iter().any(|m| &m.id == c));
    let current = match current {
        Some(c) => Some(c),
        None => metas.first().map(|m| m.id.clone()),
    };
    write_current(base, &current);
    Ok(SessionsList { items: metas, current })
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
    write_current(base, &Some(id.clone()));
    Ok(id)
}

fn open_at(base: &Path, id: &str) -> Result<Option<SessionFile>, String> {
    let f = read_session(&sessions_dir_at(base), id)?;
    if f.is_some() {
        write_current(base, &Some(id.to_string()));
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
    write_current(base, &Some(id.to_string()));
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
