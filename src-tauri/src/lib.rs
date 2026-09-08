mod chat;
mod export;
mod publish;
mod sessions;
mod settings;

use chat::{chat_stream, gen_svg, prep_turn, refine_brief};
use export::export_html;
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
            export_html,
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
