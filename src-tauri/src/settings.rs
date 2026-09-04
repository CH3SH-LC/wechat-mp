// settings.rs —— 应用内 API 设置（Documents/wechat-mp-workspace/settings.json）
// 使桌面端可在无 ~/.dsh 的机器上直接配置 DeepSeek 凭据（本地明文文件，仅本机自用）

use serde::{Deserialize, Serialize};

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
}

pub fn settings_path() -> Result<std::path::PathBuf, String> {
    Ok(crate::sessions::workspace_dir()?.join("settings.json"))
}

/// 读设置：文件缺失或损坏 → 返回默认（不覆盖原文件，避免误删用户密钥）
pub fn read_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取设置失败：{e}"))?;
    match serde_json::from_str::<AppSettings>(&raw) {
        Ok(s) => Ok(s),
        Err(_) => Ok(AppSettings::default()),
    }
}

pub fn save_settings_to(dir: &std::path::Path, s: &AppSettings) -> Result<String, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建目录失败：{e}"))?;
    let path = dir.join("settings.json");
    let json = serde_json::to_string_pretty(s).map_err(|e| format!("序列化失败：{e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("写入设置失败：{e}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<String, String> {
    let dir = crate::sessions::workspace_dir()?;
    save_settings_to(&dir, &settings)
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    read_settings()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_roundtrip() {
        let dir = std::env::temp_dir().join(format!("wxmp-settings-test-{}", std::process::id()));
        let s = AppSettings {
            api_key: "sk-abc".into(),
            base_url: "https://example.com".into(),
            model: "deepseek-v4-flash".into(),
        };
        let path = save_settings_to(&dir, &s).expect("save");
        assert!(path.ends_with("settings.json"));
        let loaded = read_settings_from(&dir).expect("load");
        assert_eq!(loaded.api_key, "sk-abc");
        assert_eq!(loaded.model, "deepseek-v4-flash");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_or_corrupt_returns_default() {
        let dir = std::env::temp_dir().join(format!("wxmp-settings-none-{}", std::process::id()));
        assert!(read_settings_from(&dir).expect("ok").api_key.is_empty());
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("settings.json"), "not json").unwrap();
        assert!(read_settings_from(&dir).expect("ok").api_key.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn read_settings_from(dir: &std::path::Path) -> Result<AppSettings, String> {
        let path = dir.join("settings.json");
        if !path.exists() {
            return Ok(AppSettings::default());
        }
        let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取失败：{e}"))?;
        serde_json::from_str::<AppSettings>(&raw).or(Ok(AppSettings::default()))
    }
}
