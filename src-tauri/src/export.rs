// export.rs —— 导出推文 HTML 到本地（默认 文档/wechat-mp-exports/，文件名消毒）

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn default_export_dir() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "无法定位用户目录".to_string())?;
    Ok(PathBuf::from(home).join("Documents").join("wechat-mp-exports"))
}

fn sanitize_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches([' ', '.', '_']);
    if trimmed.is_empty() {
        "tuiwen".to_string()
    } else {
        trimmed.to_string()
    }
}

fn default_name() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("tuiwen-{secs}.html")
}

fn with_html_ext(name: &str) -> String {
    let lower = name.to_lowercase();
    if lower.ends_with(".html") || lower.ends_with(".htm") {
        name.to_string()
    } else {
        format!("{name}.html")
    }
}

/// 核心导出逻辑（可测）：写入 dir/sanitized-name，返回完整路径
pub fn export_to_dir(dir: &Path, html: &str, name: Option<&str>) -> Result<String, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建导出目录失败：{e}"))?;
    let file_name = match name {
        Some(n) => with_html_ext(&sanitize_name(n)),
        None => default_name(),
    };
    let path = dir.join(file_name);
    std::fs::write(&path, html).map_err(|e| format!("写入文件失败：{e}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_html(html: String, name: Option<String>) -> Result<String, String> {
    let dir = default_export_dir()?;
    export_to_dir(&dir, &html, name.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_removes_windows_illegal_chars() {
        assert_eq!(sanitize_name("a<b>:c\"d/e\\f|g?h*i"), "a_b__c_d_e_f_g_h_i");
        assert_eq!(sanitize_name("..."), "tuiwen");
        assert_eq!(sanitize_name("  正常 名字  "), "正常 名字");
    }

    #[test]
    fn html_ext_appended_once() {
        assert_eq!(with_html_ext("tuiwen"), "tuiwen.html");
        assert_eq!(with_html_ext("a.HTML"), "a.HTML");
        assert_eq!(with_html_ext("a.htm"), "a.htm");
    }

    #[test]
    fn export_writes_file_with_given_name() {
        let dir = std::env::temp_dir().join(format!("wxmp-export-test-{}", std::process::id()));
        let path = export_to_dir(&dir, "<section>hi</section>", Some("我的:推文?")).expect("ok");
        assert!(path.ends_with("我的_推文.html"), "path={path}");
        let content = std::fs::read_to_string(&path).expect("read");
        assert_eq!(content, "<section>hi</section>");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_default_name_has_prefix() {
        let dir = std::env::temp_dir().join(format!("wxmp-export-test2-{}", std::process::id()));
        let path = export_to_dir(&dir, "x", None).expect("ok");
        let name = Path::new(&path).file_name().unwrap().to_string_lossy().to_string();
        assert!(name.starts_with("tuiwen-") && name.ends_with(".html"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
