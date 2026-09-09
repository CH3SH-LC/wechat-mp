mod assets;
mod chat;
mod documents;
mod export;
mod manual;
mod publish;
mod sessions;
mod settings;

use assets::{add_asset, delete_asset, get_asset, list_assets, update_asset};
use chat::{chat_stream, gen_svg, prep_turn, refine_brief};
use documents::{delete_document, list_documents, open_document, save_document};
use export::{export_html, export_images};
use manual::open_manual;
use publish::{publish_draft, WxTokenState};
use sessions::{create_session, delete_session, list_sessions, open_session, rename_session, save_session};
use settings::{load_settings, save_settings};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 微信 access_token 进程内缓存（发布草稿箱用；重复获取会触发平台频控）
            app.manage(WxTokenState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_stream,
            gen_svg,
            prep_turn,
            refine_brief,
            list_assets,
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
            save_settings,
            load_settings,
            list_sessions,
            create_session,
            open_session,
            save_session,
            rename_session,
            delete_session,
            publish_draft
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
