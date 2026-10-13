//! A dedicated, shallow inbox for images the user may choose to attach.
//! Listing only reads names and metadata; importing stays in `local_images`.

use serde::Serialize;
use std::cmp::Ordering;
use std::fs::{self, Metadata, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

const DIRECTORY_NAME: &str = "待插入图片";
const MAX_IMAGES: usize = 500;
const GUIDE_NAME: &str = "说明.txt";
const GUIDE: &str = "智序 · 待插入图片\r\n\r\n\
把需要插入推文的图片直接放在这个文件夹里，无需再建子文件夹。\r\n\
支持 PNG、JPG、JPEG、WebP、GIF 和 BMP。\r\n\r\n\
回到智序，在对话输入区打开“待插入图片”，点击“刷新”查看新放入的图片。\r\n\
选择需要的图片，添加到当前消息后，再写下用途并发送；放进文件夹不会自动发送。\r\n\
每次最多显示按文件名排序的前 500 张图片。\r\n\r\n\
图片成功添加后，智序会保存一份副本。以后移动或删除这里的源图片，不会破坏已保存的会话和推文。\r\n";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertionImage {
    pub name: String,
    pub path: String,
    pub byte_length: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertionImages {
    pub directory: String,
    pub images: Vec<InsertionImage>,
    pub warnings: Vec<String>,
}

fn is_link(metadata: &Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // Junctions and other reparse points must not redirect the inbox or its entries.
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Check each ancestor before creating or reading a directory, so an existing
/// workspace/inbox junction cannot redirect this feature elsewhere.
fn ensure_plain_directory(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        ensure_plain_directory(parent)?;
    }
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            match fs::create_dir(path) {
                Ok(()) => {}
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
                Err(error) => {
                    return Err(format!(
                        "创建待插入图片目录失败（{}）：{error}",
                        path.display()
                    ));
                }
            }
            fs::symlink_metadata(path)
                .map_err(|error| format!("检查待插入图片目录失败（{}）：{error}", path.display()))?
        }
        Err(error) => {
            return Err(format!(
                "读取待插入图片目录失败（{}）：{error}",
                path.display()
            ));
        }
    };
    if is_link(&metadata) {
        return Err(format!(
            "待插入图片目录不能经过链接文件夹（{}），请使用普通文件夹后重试",
            path.display()
        ));
    }
    if !metadata.is_dir() {
        return Err(format!(
            "待插入图片目录被同名文件占用（{}），请保留并移走该文件后重试",
            path.display()
        ));
    }
    Ok(())
}

fn prepare_directory_at(base: &Path) -> Result<(PathBuf, Vec<String>), String> {
    let directory = base.join(DIRECTORY_NAME);
    ensure_plain_directory(&directory)?;
    let mut warnings = Vec::new();
    // create_new is atomic and never opens or overwrites an existing user file/link.
    match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(directory.join(GUIDE_NAME))
    {
        Ok(mut file) => {
            if let Err(error) = file.write_all(GUIDE.as_bytes()) {
                warnings.push(format!("写入图片目录说明失败：{error}；仍可选择图片"));
            }
        }
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
        Err(error) => warnings.push(format!("创建图片目录说明失败：{error}；仍可选择图片")),
    }
    Ok((directory, warnings))
}

/// Best-effort startup preparation; command calls retry the same preparation.
pub fn initialize_insertion_image_folder() -> Result<(), String> {
    let (_, warnings) = prepare_directory_at(&crate::sessions::workspace_dir()?)?;
    for warning in warnings {
        eprintln!("[wxmp] {warning}");
    }
    Ok(())
}

fn compare_image_names(left: &str, right: &str) -> Ordering {
    let left_lower = left.to_lowercase();
    let right_lower = right.to_lowercase();
    let (a, b) = (left_lower.as_bytes(), right_lower.as_bytes());
    let (mut i, mut j) = (0, 0);
    while i < a.len() && j < b.len() {
        if a[i].is_ascii_digit() && b[j].is_ascii_digit() {
            let (start_i, start_j) = (i, j);
            while i < a.len() && a[i].is_ascii_digit() {
                i += 1;
            }
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            let digits_a = &a[start_i..i];
            let digits_b = &b[start_j..j];
            let number_a = &digits_a[digits_a
                .iter()
                .position(|&c| c != b'0')
                .unwrap_or(digits_a.len())..];
            let number_b = &digits_b[digits_b
                .iter()
                .position(|&c| c != b'0')
                .unwrap_or(digits_b.len())..];
            let order = number_a
                .len()
                .cmp(&number_b.len())
                .then_with(|| number_a.cmp(number_b))
                .then_with(|| digits_a.len().cmp(&digits_b.len()));
            if order != Ordering::Equal {
                return order;
            }
        } else {
            let order = a[i].cmp(&b[j]);
            if order != Ordering::Equal {
                return order;
            }
            i += 1;
            j += 1;
        }
    }
    (a.len() - i)
        .cmp(&(b.len() - j))
        .then_with(|| left.cmp(right))
}

fn list_at(base: &Path) -> Result<InsertionImages, String> {
    let (directory, mut warnings) = prepare_directory_at(base)?;
    let entries = fs::read_dir(&directory).map_err(|error| {
        format!(
            "读取待插入图片列表失败（{}）：{error}；请检查文件夹后刷新",
            directory.display()
        )
    })?;
    let mut images: Vec<InsertionImage> = Vec::new();
    let mut matching_count = 0usize;
    let mut unreadable_count = 0usize;
    let mut link_count = 0usize;
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                unreadable_count += 1;
                continue;
            }
        };
        let path = entry.path();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => {
                unreadable_count += 1;
                continue;
            }
        };
        if is_link(&metadata) {
            link_count += 1;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !matches!(
            extension.to_ascii_lowercase().as_str(),
            "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp"
        ) {
            continue;
        }
        let name = entry.file_name();
        let (Some(name), Some(path)) = (name.to_str(), path.to_str()) else {
            unreadable_count += 1;
            continue;
        };
        matching_count += 1;
        let index = images
            .binary_search_by(|image| compare_image_names(&image.name, name))
            .unwrap_or_else(|index| index);
        // Keep only the first 500 in natural order, independent of read_dir order.
        if index < MAX_IMAGES {
            images.insert(
                index,
                InsertionImage {
                    name: name.to_string(),
                    path: path.to_string(),
                    byte_length: metadata.len(),
                },
            );
            if images.len() > MAX_IMAGES {
                images.pop();
            }
        }
    }
    if matching_count > MAX_IMAGES {
        warnings.push(format!(
            "文件夹里共有 {matching_count} 张图片，仅显示按文件名排序的前 {MAX_IMAGES} 张；请移走暂不用的源图片后刷新"
        ));
    }
    if unreadable_count > 0 {
        warnings.push(format!(
            "有 {unreadable_count} 个文件暂时无法读取，已略过；请检查文件后刷新"
        ));
    }
    if link_count > 0 {
        warnings.push(format!(
            "已略过 {link_count} 个链接文件或链接文件夹；请将原图片直接放入此文件夹"
        ));
    }
    Ok(InsertionImages {
        directory: directory.to_string_lossy().into_owned(),
        images,
        warnings,
    })
}

#[tauri::command]
pub fn list_insertion_images() -> Result<InsertionImages, String> {
    list_at(&crate::sessions::workspace_dir()?)
}

#[tauri::command]
pub fn open_insertion_image_folder(app: tauri::AppHandle) -> Result<String, String> {
    let (directory, warnings) = prepare_directory_at(&crate::sessions::workspace_dir()?)?;
    for warning in warnings {
        eprintln!("[wxmp] {warning}");
    }
    let path = directory.to_string_lossy().into_owned();
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_path(&path, None::<&str>)
        .map_err(|error| format!("打开待插入图片文件夹失败（{path}）：{error}；请稍后重试"))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

    struct TempBase(PathBuf);

    impl TempBase {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "wxmp-insertion-images-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, AtomicOrdering::Relaxed),
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempBase {
        fn drop(&mut self) {
            // This is exclusively our newly-created, absolute temporary base.
            if self.0.is_absolute() && self.0.parent() == Some(std::env::temp_dir().as_path()) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
    }

    #[test]
    fn empty_directory_is_created_and_repeatable() {
        let base = TempBase::new();
        let first = list_at(&base.0).unwrap();
        let second = list_at(&base.0).unwrap();
        assert!(first.images.is_empty());
        assert!(first.warnings.is_empty());
        assert_eq!(
            first.directory,
            base.0.join(DIRECTORY_NAME).to_string_lossy()
        );
        assert_eq!(first.directory, second.directory);
        assert_eq!(
            fs::read_to_string(base.0.join(DIRECTORY_NAME).join(GUIDE_NAME)).unwrap(),
            GUIDE
        );
        let json = serde_json::to_value(first).unwrap();
        assert!(json["images"].as_array().unwrap().is_empty());
        assert_eq!(json["warnings"], serde_json::json!([]));
    }

    #[test]
    fn existing_user_files_and_guide_are_preserved() {
        let base = TempBase::new();
        let directory = base.0.join(DIRECTORY_NAME);
        fs::create_dir(&directory).unwrap();
        fs::write(directory.join(GUIDE_NAME), "用户自己的说明").unwrap();
        fs::write(directory.join("活动.png"), b"original bytes").unwrap();
        fs::write(base.0.join("existing-document.txt"), "旧作品").unwrap();
        let result = list_at(&base.0).unwrap();
        assert_eq!(
            fs::read_to_string(directory.join(GUIDE_NAME)).unwrap(),
            "用户自己的说明"
        );
        assert_eq!(
            fs::read(directory.join("活动.png")).unwrap(),
            b"original bytes"
        );
        assert_eq!(
            fs::read_to_string(base.0.join("existing-document.txt")).unwrap(),
            "旧作品"
        );
        assert_eq!(
            result.images[0].path,
            directory.join("活动.png").to_string_lossy()
        );
        assert_eq!(result.images[0].byte_length, 14);
        assert_eq!(
            serde_json::to_value(&result.images[0]).unwrap()["byteLength"],
            14
        );
    }

    #[test]
    fn supported_extensions_are_case_insensitive_and_naturally_sorted() {
        let base = TempBase::new();
        let (directory, _) = prepare_directory_at(&base.0).unwrap();
        for name in [
            "图10.png",
            "图2.JPG",
            "图01.jpeg",
            "图1.GIF",
            "图3.WebP",
            "图4.BMP",
            "图5.svg",
            "图6.png.txt",
            "无扩展名",
        ] {
            // Deliberately not valid image data: listing must not decode file contents.
            fs::write(directory.join(name), b"metadata only").unwrap();
        }
        let result = list_at(&base.0).unwrap();
        let names: Vec<_> = result
            .images
            .iter()
            .map(|image| image.name.as_str())
            .collect();
        assert_eq!(
            names,
            [
                "图1.GIF",
                "图01.jpeg",
                "图2.JPG",
                "图3.WebP",
                "图4.BMP",
                "图10.png"
            ]
        );
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn nested_folders_are_not_listed_or_traversed() {
        let base = TempBase::new();
        let (directory, _) = prepare_directory_at(&base.0).unwrap();
        fs::create_dir(directory.join("subfolder.png")).unwrap();
        fs::write(
            directory.join("subfolder.png").join("nested.jpg"),
            b"nested",
        )
        .unwrap();
        fs::write(base.0.join("outside.png"), b"outside inbox").unwrap();
        assert!(list_at(&base.0).unwrap().images.is_empty());
    }

    #[test]
    fn maximum_returns_stable_first_500_and_reports_omissions() {
        let base = TempBase::new();
        let (directory, _) = prepare_directory_at(&base.0).unwrap();
        for index in (1..=MAX_IMAGES + 3).rev() {
            fs::write(directory.join(format!("图片{index}.png")), b"image").unwrap();
        }
        let result = list_at(&base.0).unwrap();
        assert_eq!(result.images.len(), MAX_IMAGES);
        assert_eq!(result.images.first().unwrap().name, "图片1.png");
        assert_eq!(result.images.last().unwrap().name, "图片500.png");
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("503") && warning.contains("500")));
        assert!(directory.join("图片503.png").is_file());
    }

    #[test]
    fn occupied_directory_returns_error_without_replacing_file_and_can_retry() {
        let base = TempBase::new();
        let directory = base.0.join(DIRECTORY_NAME);
        fs::write(&directory, b"preserve").unwrap();
        let error = list_at(&base.0).unwrap_err();
        assert!(error.contains("同名文件占用"));
        assert_eq!(fs::read(&directory).unwrap(), b"preserve");
        fs::rename(&directory, base.0.join("preserved-user-file")).unwrap();
        assert!(list_at(&base.0).unwrap().images.is_empty());
        let occupied_base = base.0.join("preserved-user-file");
        assert!(list_at(&occupied_base)
            .unwrap_err()
            .contains("同名文件占用"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_junctions_are_skipped_and_cannot_redirect_the_inbox() {
        struct Junction(PathBuf);
        impl Drop for Junction {
            fn drop(&mut self) {
                // remove_dir unlinks the junction itself, never its target contents.
                let _ = fs::remove_dir(&self.0);
            }
        }
        fn junction(link: PathBuf, target: &Path) -> Junction {
            let output = std::process::Command::new("cmd")
                .args(["/D", "/C", "mklink", "/J"])
                .arg(&link)
                .arg(target)
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "Cannot create test junction: {} {}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            Junction(link)
        }

        let base = TempBase::new();
        let target = base.0.join("external");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("outside.png"), b"outside").unwrap();
        let (directory, _) = prepare_directory_at(&base.0).unwrap();
        let _child = junction(directory.join("linked-images"), &target);
        let result = list_at(&base.0).unwrap();
        assert!(result.images.is_empty());
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("链接")));

        let redirected_base = base.0.join("redirected-workspace");
        let _root = junction(redirected_base.clone(), &target);
        assert!(list_at(&redirected_base)
            .unwrap_err()
            .contains("链接文件夹"));
        assert!(!target.join(DIRECTORY_NAME).exists());
        assert_eq!(fs::read(target.join("outside.png")).unwrap(), b"outside");
    }
}
