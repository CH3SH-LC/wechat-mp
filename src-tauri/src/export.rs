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

/// 因重名被改名的文件：让界面能说清"哪几张被加了序号"，而不是让用户以为导出少了/覆盖了
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct RenamedFile {
    pub original: String,
    pub final_name: String,
}

/// 一次图片导出的**实际**结果（R4）：目标目录、真正写入的张数、被改名的清单。
///
/// 旧实现只返回目录、回报 `files.len()`：`sanitize_name` 会把不同原名折叠成同一个文件名
/// （`a/b.png` 与 `a_b.png` 都变 `a_b.png`），后写覆盖先写，而汇报按输入算——
/// 用户以为导出了两张，磁盘上只剩一张。现在重名自动追加 `-2`/`-3`，并按实际写入数回报。
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct ImageExportResult {
    pub dir: String,
    pub written: usize,
    #[serde(default)]
    pub renamed: Vec<RenamedFile>,
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

/// 拆出（主干, 扩展名带点）；无扩展名时第二项为空串
fn split_ext(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    }
}

/// 在 target 目录内求一个不冲突的文件名：与"本次已用名"及"目录里已有的文件"都不冲突，
/// 冲突则追加 `-2`/`-3`。用 lower 做键——Windows 文件系统大小写不敏感，`a.PNG` 与 `a.png` 是同一个文件。
fn unique_name(target: &Path, name: &str, used: &mut std::collections::HashSet<String>) -> String {
    let taken = |n: &str, used: &std::collections::HashSet<String>| {
        used.contains(&n.to_lowercase()) || target.join(n).exists()
    };
    if !taken(name, used) {
        used.insert(name.to_lowercase());
        return name.to_string();
    }
    let (stem, ext) = split_ext(name);
    let mut n = 2u32;
    loop {
        let cand = format!("{stem}-{n}{ext}");
        if !taken(&cand, used) {
            used.insert(cand.to_lowercase());
            return cand;
        }
        n += 1;
    }
}

/// 写一组 PNG 到 dir/img-<base>/ 下（文件名消毒 + 重名加序号），返回实际写入结果。可测（不打开目录）。
pub fn export_images_to_dir(dir: &Path, base: &str, files: &[ImageFile]) -> Result<ImageExportResult, String> {
    let target = dir.join(format!("img-{}", sanitize_name(base)));
    std::fs::create_dir_all(&target).map_err(|e| format!("创建图片目录失败：{e}"))?;
    if files.is_empty() {
        return Err("没有可导出的图片".to_string());
    }
    let mut used = std::collections::HashSet::new();
    let mut renamed = Vec::new();
    let mut written = 0usize;
    for f in files {
        let want = sanitize_name(&f.name);
        let name = unique_name(&target, &want, &mut used);
        if name != want {
            renamed.push(RenamedFile { original: f.name.clone(), final_name: name.clone() });
        }
        let bytes = png_bytes(&f.data)?;
        std::fs::write(target.join(&name), &bytes).map_err(|e| format!("写入图片失败（{name}）：{e}"))?;
        written += 1;
    }
    Ok(ImageExportResult { dir: target.to_string_lossy().to_string(), written, renamed })
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
    let r = export_images_to_dir(&dir, &name, &files)?;
    open_folder(&r.dir);
    // 汇报按**实际写入**算，并把被改名的文件说出来——旧实现按输入张数汇报，重名覆盖时数字是假的
    let mut msg = format!("已导出 {} 张图片到：{}", r.written, r.dir);
    if !r.renamed.is_empty() {
        let names: Vec<&str> = r.renamed.iter().map(|x| x.final_name.as_str()).collect();
        msg.push_str(&format!(
            "（其中 {} 张与已有文件重名，已自动加序号：{}）",
            r.renamed.len(),
            names.join("、")
        ));
    }
    Ok(msg)
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
        let r = export_images_to_dir(&dir, "我的:推文", &files).expect("ok");
        assert!(r.dir.ends_with("img-我的_推文"), "dir={}", r.dir);
        assert_eq!(r.written, 2);
        assert!(r.renamed.is_empty(), "名字本来就不同，不该改名");
        let f1 = std::fs::read(dir.join("img-我的_推文/a-长图.png")).expect("f1");
        assert_eq!(f1.len(), 70, "png 字节应与原一致");
        let f2 = std::fs::read(dir.join("img-我的_推文/a-01.png")).expect("f2");
        assert_eq!(f2, f1);
        assert!(png_bytes("not-base64-###").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn colliding_image_names_get_suffix_instead_of_overwriting() {
        // R4：a/b.png 与 a_b.png 消毒后同名——旧实现后者覆盖前者，汇报却按输入算成 2 张
        let png1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        // 另一张不同的 1x1 PNG（内容不同，便于验证没被覆盖）
        let png2 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        let dir = std::env::temp_dir().join(format!("wxmp-imgcollide-{}", std::process::id()));
        let files = vec![
            ImageFile { name: "a/b.png".into(), data: png1.into() },
            ImageFile { name: "a_b.png".into(), data: png2.into() },
        ];
        let r = export_images_to_dir(&dir, "同名", &files).expect("ok");
        assert_eq!(r.written, 2, "两张都要真的落盘");
        assert_eq!(std::fs::read_dir(dir.join("img-同名")).unwrap().count(), 2, "磁盘上应有 2 个文件");
        assert_eq!(r.renamed.len(), 1, "第二张被加序号");
        assert_eq!(r.renamed[0].original, "a_b.png");
        assert_eq!(r.renamed[0].final_name, "a_b-2.png");
        let first = std::fs::read(dir.join("img-同名/a_b.png")).unwrap();
        let second = std::fs::read(dir.join("img-同名/a_b-2.png")).unwrap();
        assert_ne!(first, second, "先写的不能被后写的覆盖");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn image_name_collides_with_existing_file_on_disk() {
        // 同名目录已存在（同分钟内重复导出）时也不能覆盖上一次的产物
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        let dir = std::env::temp_dir().join(format!("wxmp-imgexist-{}", std::process::id()));
        let target = dir.join("img-重复");
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(target.join("a.PNG"), b"old").unwrap(); // 大小写不敏感：与 a.png 视为同名
        let files = vec![ImageFile { name: "a.png".into(), data: png.into() }];
        let r = export_images_to_dir(&dir, "重复", &files).expect("ok");
        assert_eq!(r.written, 1);
        assert_eq!(r.renamed[0].final_name, "a-2.png");
        assert_eq!(std::fs::read(target.join("a.PNG")).unwrap(), b"old", "已有文件必须原样保留");
        assert!(target.join("a-2.png").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
