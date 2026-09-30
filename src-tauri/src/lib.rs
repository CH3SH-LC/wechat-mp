mod assets;
mod cancel;
mod chat;
mod documents;
mod export;
mod manual;
mod publish;
mod sessions;
mod settings;
mod trace;

use assets::{add_asset, delete_asset, get_asset, list_assets, list_assets_report, update_asset};
use cancel::{cancel_reset, cancel_run, CancelState};
use chat::{chat_stream, gen_svg, model_lock_state, prep_turn, refine_brief, review_assets};
use documents::{
    commit_document_revision, delete_document, list_document_revisions, list_documents,
    open_document, open_document_revision, save_document,
};
use export::{export_html, export_images};
use manual::open_manual;
use publish::{publish_draft, WxTokenState};
use sessions::{create_session, delete_session, list_sessions, open_session, rename_session, save_session};
use settings::{load_settings, save_settings};
use trace::{trace_start, trace_write};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// 主窗口的 WebView2 附加参数。
///
/// **默认行为与以前完全一致**：不设 `WXMP_CDP_PORT` 时不监听任何调试端口。
/// 只有显式设置该环境变量（真机验收用）时，才追加 `--remote-debugging-port`。
///
/// 为什么必须在这里传、而不能靠环境变量 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`：
/// wry 0.55.1 会**无条件**调用 `CoreWebView2EnvironmentOptions::set_additional_browser_arguments`
/// （未显式提供时它会填入自己的默认串，见 wry `src/webview2/mod.rs` 的
/// `pl_attrs.additional_browser_args.unwrap_or_else(...)`），而这次调用会**覆盖** WebView2 SDK
/// 读到的同名环境变量——"用环境变量打开 CDP 端口"这条路在当前依赖版本下是死的（已实测：
/// 进程起来了、WebView2 profile 也建了，但那个端口从头到尾没人监听）。
/// 真机验收（DS 修复指南 §8）需要经 CDP 驱动真实桌面应用，因此改由 Tauri builder 显式传入。
///
/// 注意：一旦自己传参数，wry 的默认串就**不会**被追加了，必须原样带上
/// `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`，否则会顺带
/// 把"迷你菜单 / 智能屏幕"这两个既有抑制弄丢（Tauri 文档原话警告过这一点）。
fn browser_args() -> String {
    let mut args = String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");
    if let Ok(port) = std::env::var("WXMP_CDP_PORT") {
        // 只接受 1–5 位十进制端口：非法值一律忽略并说明，不猜、不静默变形。
        let valid = !port.is_empty() && port.len() <= 5 && port.chars().all(|c| c.is_ascii_digit());
        if valid {
            args.push_str(&format!(" --remote-debugging-port={port}"));
            // Chromium 111+ 会对来自非白名单 Origin 的 DevTools 连接回 403；
            // 本机回环 + 仅测试期开启，这里显式放行，避免"端口开了却连不上"。
            args.push_str(" --remote-allow-origins=*");
        } else {
            eprintln!("[wxmp] 忽略非法的 WXMP_CDP_PORT={port:?}（应为 1–5 位十进制端口号）");
        }
    }
    args
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 微信 access_token 进程内缓存（发布草稿箱用；重复获取会触发平台频控）
            app.manage(WxTokenState::default());
            // 运行取消表（阶段 4）：前端"停止"按钮的后端句柄
            app.manage(CancelState::default());
            // 主窗口在这里建（`tauri.conf.json` 的 `app.windows` 已置空）。
            // 搬到代码里的唯一理由是：只有 builder 才能把 WebView2 的附加参数交给 wry
            // （见 `browser_args` 的说明）。标题、尺寸、最小尺寸与配置里逐字一致，
            // label 仍用 "main"（配置里的默认 label），因此对前端与既有命令无任何影响。
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("智序 · 公众号推文助手")
                .inner_size(1380.0, 880.0)
                .min_inner_size(1000.0, 640.0)
                .additional_browser_args(&browser_args())
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_stream,
            gen_svg,
            prep_turn,
            refine_brief,
            review_assets,
            model_lock_state,
            list_assets,
            list_assets_report,
            add_asset,
            get_asset,
            update_asset,
            delete_asset,
            export_html,
            export_images,
            open_manual,
            list_documents,
            open_document,
            save_document,
            delete_document,
            // 阶段 C（§7）：版本目录 + 提交指针——历史版本一览、按版本打开、把版本提交为成品
            list_document_revisions,
            open_document_revision,
            commit_document_revision,
            save_settings,
            load_settings,
            list_sessions,
            create_session,
            open_session,
            save_session,
            rename_session,
            delete_session,
            publish_draft,
            trace_write,
            trace_start,
            cancel_run,
            cancel_reset
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
