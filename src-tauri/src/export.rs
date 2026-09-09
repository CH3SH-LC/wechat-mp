// export.rs —— 导出推文到本地：export_html 写 HTML；export_images 写长图/分页 PNG（第 34 轮）
// 产物默认在 文档/wechat-mp-workspace/exports/img-<名>/，Windows 导出后自动打开目录。

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn default_export_dir() -> Result<PathBuf, String> {
    crate::sessions::exports_dir()
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

// ---------- 导出图片（第 34 轮：HTML→PNG，用户手动上传，替代微信草稿箱 API） ----------

#[derive(serde::Deserialize)]
pub struct ImageFile {
    pub name: String,
    pub data: String, // data:image/png;base64,… 或裸 base64
}

fn png_bytes(data_url: &str) -> Result<Vec<u8>, String> {
    let b64 = match data_url.find("base64,") {
        Some(i) => &data_url[i + "base64,".len()..],
        None => data_url,
    };
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| format!("图片 base64 解码失败：{e}"))
}

/// 写一组 PNG 到 dir/img-<base>/ 下（文件名消毒），返回目录完整路径。可测（不打开目录）。
pub fn export_images_to_dir(dir: &Path, base: &str, files: &[ImageFile]) -> Result<String, String> {
    let target = dir.join(format!("img-{}", sanitize_name(base)));
    std::fs::create_dir_all(&target).map_err(|e| format!("创建图片目录失败：{e}"))?;
    if files.is_empty() {
        return Err("没有可导出的图片".to_string());
    }
    for f in files {
        let name = sanitize_name(&f.name);
        let bytes = png_bytes(&f.data)?;
        std::fs::write(target.join(&name), &bytes).map_err(|e| format!("写入图片失败（{name}）：{e}"))?;
    }
    Ok(target.to_string_lossy().to_string())
}

#[cfg(windows)]
fn open_folder(dir: &str) {
    use std::process::Command;
    let _ = Command::new("explorer").arg(dir).spawn();
}

#[cfg(not(windows))]
fn open_folder(_dir: &str) {}

#[tauri::command]
pub fn export_images(name: String, files: Vec<ImageFile>) -> Result<String, String> {
    let dir = default_export_dir()?;
    let path = export_images_to_dir(&dir, &name, &files)?;
    open_folder(&path);
    Ok(format!("已导出 {} 张图片到：{path}", files.len()))
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

    #[test]
    fn export_images_writes_png_files_and_dir() {
        // 1x1 透明 PNG 极小样本
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        let dir = std::env::temp_dir().join(format!("wxmp-imgtest-{}", std::process::id()));
        let files = vec![
            ImageFile { name: "a-长图.png".into(), data: format!("data:image/png;base64,{png}") },
            ImageFile { name: "a-01.png".into(), data: png.into() },
        ];
        let target = export_images_to_dir(&dir, "我的:推文", &files).expect("ok");
        assert!(target.ends_with("img-我的_推文"), "target={target}");
        let f1 = std::fs::read(dir.join("img-我的_推文/a-长图.png")).expect("f1");
        assert_eq!(f1.len(), 70, "png 字节应与原一致");
        let f2 = std::fs::read(dir.join("img-我的_推文/a-01.png")).expect("f2");
        assert_eq!(f2, f1);
        assert!(png_bytes("not-base64-###").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
