// draft.rs —— 会话自动存档（Documents/wechat-mp-workspace/draft.json），断电不丢稿

use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct DraftMsg {
    pub id: u64,
    pub role: String, // user | assistant | error
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Draft {
    pub version: u32,
    pub updated_at: String,
    pub mode: String,
    pub style: String,
    pub messages: Vec<DraftMsg>,
}

pub fn workspace_dir() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "无法定位用户目录".to_string())?;
    Ok(std::path::PathBuf::from(home)
        .join("Documents")
        .join("wechat-mp-workspace"))
}

pub fn exports_dir() -> Result<std::path::PathBuf, String> {
    Ok(workspace_dir()?.join("exports"))
}

pub fn save_draft_to(dir: &Path, draft: &Draft) -> Result<String, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建目录失败：{e}"))?;
    let path = dir.join("draft.json");
    let json = serde_json::to_string_pretty(draft).map_err(|e| format!("序列化失败：{e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("写入存档失败：{e}"))?;
    Ok(path.to_string_lossy().to_string())
}

pub fn load_draft_from(dir: &Path) -> Result<Option<Draft>, String> {
    let path = dir.join("draft.json");
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取存档失败：{e}"))?;
    match serde_json::from_str::<Draft>(&raw) {
        Ok(d) => Ok(Some(d)),
        Err(_) => {
            // 损坏存档不致命：改名留底，返回 None 从头开始
            let _ = std::fs::rename(&path, dir.join("draft.json.corrupt"));
            Ok(None)
        }
    }
}

#[tauri::command]
pub fn save_draft(draft: Draft) -> Result<String, String> {
    let dir = workspace_dir()?;
    save_draft_to(&dir, &draft)
}

#[tauri::command]
pub fn load_draft() -> Result<Option<Draft>, String> {
    let dir = workspace_dir()?;
    load_draft_from(&dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_draft() -> Draft {
        Draft {
            version: 1,
            updated_at: "2026-09-04T02:00:00".into(),
            mode: "promo".into(),
            style: "campus".into(),
            messages: vec![DraftMsg {
                id: 1,
                role: "user".into(),
                content: "写一篇开学典礼推文".into(),
            }],
        }
    }

    #[test]
    fn roundtrip_save_load() {
        let dir = std::env::temp_dir().join(format!("wxmp-draft-test-{}", std::process::id()));
        let d = sample_draft();
        let path = save_draft_to(&dir, &d).expect("save");
        assert!(path.ends_with("draft.json"));
        let loaded = load_draft_from(&dir).expect("load").expect("some");
        assert_eq!(loaded.version, 1);
        assert_eq!(loaded.messages.len(), 1);
        assert_eq!(loaded.messages[0].content, "写一篇开学典礼推文");
        assert_eq!(loaded.style, "campus");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_file_returns_none() {
        let dir = std::env::temp_dir().join(format!("wxmp-draft-none-{}", std::process::id()));
        assert!(load_draft_from(&dir).expect("ok").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_file_tolerated() {
        let dir = std::env::temp_dir().join(format!("wxmp-draft-corrupt-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("draft.json"), "{ not json").unwrap();
        assert!(load_draft_from(&dir).expect("ok").is_none());
        assert!(dir.join("draft.json.corrupt").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
