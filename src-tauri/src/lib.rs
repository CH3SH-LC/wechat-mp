mod chat;
mod export;
mod sessions;
mod settings;

use chat::chat_stream;
use export::export_html;
use sessions::{create_session, delete_session, list_sessions, open_session, rename_session, save_session};
use settings::{load_settings, save_settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            chat_stream,
            export_html,
            save_settings,
            load_settings,
            list_sessions,
            create_session,
            open_session,
            save_session,
            rename_session,
            delete_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
