// manual.rs —— 用户使用手册（发布轮新增）：随安装包发布的单文件 HTML（resources/使用手册.html）。
// 顶栏「使用手册」按钮 → open_manual：在资源目录定位手册文件，调 opener 以系统默认浏览器打开。
// 手册是给无技术背景用户看的：安装后即使没人教，也能从应用内一步打开操作说明。

use std::path::{Path, PathBuf};
use tauri::Manager;

pub const MANUAL_NAME: &str = "使用手册.html";

/// 在资源目录下定位手册文件：
/// - 打包/安装后：bundle.resources 映射到资源目录根（NSIS 下即程序目录，与 exe 同层）；
/// - dev/测试构建：可能落在 resources/ 子目录——两种布局都找，保证未来路径调整不破坏入口。
pub fn find_manual(resource_dir: &Path) -> Option<PathBuf> {
    [
        resource_dir.join(MANUAL_NAME),
        resource_dir.join("resources").join(MANUAL_NAME),
    ]
    .into_iter()
    .find(|p| p.is_file())
}

#[tauri::command]
pub fn open_manual(app: tauri::AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败：{e}"))?;
    let file = find_manual(&base).ok_or_else(|| {
        format!("未找到《使用手册》（{MANUAL_NAME}），请重新安装最新版本后再试")
    })?;
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_path(file.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| format!("打开使用手册失败：{e}"))?;
    Ok(file.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tmpdir() -> PathBuf {
        let d = std::env::temp_dir().join(format!(
            "wxmp-manual-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn finds_root_layout() {
        let d = tmpdir();
        let f = d.join(MANUAL_NAME);
        fs::write(&f, "<html></html>").unwrap();
        assert_eq!(find_manual(&d), Some(f));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn finds_resources_subdir_layout() {
        let d = tmpdir();
        let sub = d.join("resources");
        fs::create_dir_all(&sub).unwrap();
        let f = sub.join(MANUAL_NAME);
        fs::write(&f, "<html></html>").unwrap();
        assert_eq!(find_manual(&d), Some(f));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn missing_returns_none() {
        let d = tmpdir();
        assert_eq!(find_manual(&d), None);
        let _ = fs::remove_dir_all(&d);
    }
}
