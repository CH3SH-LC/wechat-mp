// settings.rs —— 应用内 API 设置（Documents/wechat-mp-workspace/settings.json）
// 使桌面端可在无 ~/.dsh 的机器上直接配置 DeepSeek 凭据（本地明文文件，仅本机自用）
//
// 读失败的口径（R5，2026-09-29 修）：
// - 文件**不存在** → 默认值（首次启动的正常态，不是错误）；
// - 文件存在但**解析失败** → 也返回默认值，但把原因放进 `AppSettings::load_error` 一并回传。
//   为什么不直接返回 Err：`read_settings()` 的调用方很多，其中 chat.rs 的 resolve_config 用的是
//   `unwrap_or_default()`——返回 Err 会被它折叠成"未配置"，用户看到的行为和"密钥被清空"一模一样，
//   仍然是静默。带 load_error 的默认值能让界面明确说出"设置文件损坏（原文件已保留）"。
// - 无论哪条路径都**不覆盖原文件**：损坏的 settings.json 原样留在磁盘上，用户还有机会自己捞回密钥。

use serde::{Deserialize, Serialize};

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
    // 公众号草稿箱发布（可选）：缺省/空串均视为未配置；读旧 settings.json（无此字段）时 serde(default) → None
    #[serde(default)]
    pub wx_appid: Option<String>,
    #[serde(default)]
    pub wx_secret: Option<String>,
    // P2 视觉复核（2026-09-24 调查 §8）：可选的第二个模型，负责"看实图选素材"。
    // 默认关闭——视觉调用有费用，调查要求"先测效果再选默认"，故由用户显式开启。
    #[serde(default)]
    pub model_vision: String,
    #[serde(default)]
    pub vision_review: bool,
    /// 只读的"读取诊断"：**只存在于内存，永不落盘**。
    /// 非空 = 磁盘上的 settings.json 存在但解析失败，当前返回的是默认值（原文件已保留）。
    ///
    /// `serde(skip)` 同时跳过序列化与反序列化，所以它既不会被写回 settings.json，
    /// 也不会出现在这一结构体的 JSON 里。**要把它送到前端，必须经过 `SettingsView`**——
    /// 2026-09-29 集成时踩过这个坑：前端按 `load_error` 接好了，但 `load_settings` 返回的
    /// 是 `AppSettings` 本身，序列化时被 skip 掉，于是这条诊断在前端永远看不到（死字段）。
    #[serde(skip)]
    pub load_error: Option<String>,
}

impl AppSettings {
    pub fn wx_appid_str(&self) -> Option<&str> {
        self.wx_appid.as_deref().map(str::trim).filter(|s| !s.is_empty())
    }
    pub fn wx_secret_str(&self) -> Option<&str> {
        self.wx_secret.as_deref().map(str::trim).filter(|s| !s.is_empty())
    }
}

pub fn settings_path() -> Result<std::path::PathBuf, String> {
    Ok(crate::sessions::workspace_dir()?.join("settings.json"))
}

/// 读设置（workspace 目录版）。语义见文件头注释：缺失 → 默认；解析失败 → 默认 + load_error。
pub fn read_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    let dir = path.parent().unwrap_or(std::path::Path::new("."));
    read_settings_at(dir)
}

/// 注入式实现（便于测试）。
pub fn read_settings_at(dir: &std::path::Path) -> Result<AppSettings, String> {
    let path = dir.join("settings.json");
    if !path.exists() {
        // 首次启动：没有文件是正常态，不是"坏掉"
        return Ok(AppSettings::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取设置失败：{e}"))?;
    match serde_json::from_str::<AppSettings>(&raw) {
        Ok(mut s) => {
            s.load_error = None; // 真读出来了，清掉诊断字段（防止调用方拿去保存时带出旧状态）
            Ok(s)
        }
        Err(e) => Ok(AppSettings {
            load_error: Some(format!(
                "设置文件损坏，未能解析（原文件已保留，未被覆盖）：{e}"
            )),
            ..Default::default()
        }),
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

/// `load_settings` 的线上形态：设置值 + 只读诊断。
///
/// 为什么不直接返回 `AppSettings`：`load_error` 标了 `serde(skip)`（保证不落盘），
/// 同一个结构体没法既"序列化时带上"又"写文件时不带上"。于是用一个包装类型专门承载返回，
/// 落盘路径（`save_settings` 收到的仍是 `AppSettings`）不受影响。
#[derive(Serialize)]
pub struct SettingsView {
    #[serde(flatten)]
    pub settings: AppSettings,
    /// 非空 = 磁盘上的设置文件存在但解析失败（原文件已保留，当前返回的是默认值）。
    pub load_error: Option<String>,
}

#[tauri::command]
pub fn load_settings() -> Result<SettingsView, String> {
    let s = read_settings()?;
    Ok(SettingsView { load_error: s.load_error.clone(), settings: s })
}

#[cfg(test)]
mod tests {
    use super::*;

    // 注：下列用例只验证 settings.json 的**存取**（键名、旧文件兼容），不涉及模型选择。
    // 模型名在 chat.rs 的 resolve_model 里解析，当前被 LOCKED_MODEL 统一收敛为 deepseek-flash。
    #[test]
    fn settings_roundtrip() {
        let dir = std::env::temp_dir().join(format!("wxmp-settings-test-{}", std::process::id()));
        let s = AppSettings {
            api_key: "sk-abc".into(),
            base_url: "https://example.com".into(),
            model: "deepseek-v4-flash".into(),
            wx_appid: Some("wx1234567890".into()),
            wx_secret: Some("secret-中文 & /=".into()),
            model_vision: "deepseek-flash".into(),
            vision_review: true,
            load_error: None,
        };
        let path = save_settings_to(&dir, &s).expect("save");
        assert!(path.ends_with("settings.json"));
        let loaded = read_settings_at(&dir).expect("load");
        assert_eq!(loaded.api_key, "sk-abc");
        assert_eq!(loaded.model, "deepseek-v4-flash");
        assert_eq!(loaded.wx_appid.as_deref(), Some("wx1234567890"));
        assert_eq!(loaded.wx_secret.as_deref(), Some("secret-中文 & /="));
        assert_eq!(loaded.model_vision, "deepseek-flash");
        assert!(loaded.vision_review);
        assert!(loaded.load_error.is_none(), "正常文件不该带诊断信息");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_error_is_never_persisted() {
        // load_error 是只读诊断字段：带着它保存不能把它写进 settings.json（否则下次读出来是脏的）
        let dir = std::env::temp_dir().join(format!("wxmp-settings-skip-{}", std::process::id()));
        let s = AppSettings { api_key: "sk-1".into(), load_error: Some("上一次的诊断".into()), ..Default::default() };
        save_settings_to(&dir, &s).expect("save");
        let raw = std::fs::read_to_string(dir.join("settings.json")).unwrap();
        assert!(!raw.contains("load_error"), "诊断字段不能落盘：{raw}");
        // 前端把带 load_error 的对象原样回传也要能存（skip 字段按未知键忽略，不报错）
        let sent_back = r#"{"api_key":"sk-2","load_error":"损坏"}"#;
        let parsed: AppSettings = serde_json::from_str(sent_back).expect("回传对象应能解析");
        assert_eq!(parsed.api_key, "sk-2");
        assert!(parsed.load_error.is_none(), "传入的 load_error 应被忽略");
        // 反面：**线上的 SettingsView 必须带上它**——否则前端永远看不到这条诊断（曾经的死字段）
        let view = SettingsView { settings: s.clone(), load_error: Some("损坏".into()) };
        let wire = serde_json::to_string(&view).expect("序列化");
        assert!(wire.contains("\"load_error\":\"损坏\""), "返回给前端时必须带上诊断：{wire}");
        assert!(wire.contains("\"api_key\":\"sk-1\""), "设置值要平铺在同一层：{wire}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_settings_without_vision_fields_still_load() {
        // P2 新增 model_vision / vision_review：旧 settings.json 没有这两个字段也必须能读，
        // 且视觉复核默认关闭（调用有费用，不能因为升级就替用户打开）
        let dir = std::env::temp_dir().join(format!("wxmp-settings-legacy-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("settings.json"),
            r#"{"api_key":"sk-old","base_url":"https://api.deepseek.com","model":"deepseek-v4-flash"}"#,
        )
        .unwrap();
        let loaded = read_settings_at(&dir).expect("旧设置应能读出");
        assert_eq!(loaded.api_key, "sk-old");
        assert_eq!(loaded.model_vision, "");
        assert!(!loaded.vision_review, "视觉复核必须默认关闭");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_file_is_normal_but_corrupt_file_reports_load_error() {
        // R5：文件不存在 = 正常（默认值，无诊断）；文件存在但坏了 = 默认值 + load_error，
        // 界面据此能说"设置文件损坏"，而不是让用户以为密钥被清空了
        let dir = std::env::temp_dir().join(format!("wxmp-settings-none-{}", std::process::id()));
        let missing = read_settings_at(&dir).expect("缺失是正常态");
        assert!(missing.api_key.is_empty());
        assert!(missing.load_error.is_none(), "没有文件不是错误");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("settings.json"), "not json").unwrap();
        let corrupt = read_settings_at(&dir).expect("损坏时仍返回默认值供调用方使用");
        assert!(corrupt.api_key.is_empty());
        let msg = corrupt.load_error.expect("必须带诊断信息");
        assert!(msg.contains("损坏"), "文案要说清是损坏：{msg}");
        assert!(msg.contains("保留"), "文案要说明原文件已保留：{msg}");
        // 原文件不能被覆盖
        assert_eq!(std::fs::read_to_string(dir.join("settings.json")).unwrap(), "not json");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_json_without_wx_fields_defaults_none() {
        // 旧 settings.json 无 wx_appid/wx_secret → 应回退 None（不报错、不丢原字段）
        let dir = std::env::temp_dir().join(format!("wxmp-settings-old-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("settings.json"), r#"{"api_key":"sk-legacy","base_url":"https://x","model":"m"}"#).unwrap();
        let loaded = read_settings_at(&dir).expect("load old json");
        assert_eq!(loaded.api_key, "sk-legacy");
        assert_eq!(loaded.wx_appid, None);
        assert_eq!(loaded.wx_secret, None);
        assert!(loaded.load_error.is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
