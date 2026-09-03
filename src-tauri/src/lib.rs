mod chat;
mod draft;
mod export;
mod settings;

use chat::chat_stream;
use draft::{load_draft, save_draft};
use export::export_html;
use settings::{load_settings, save_settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            chat_stream,
            export_html,
            save_draft,
            load_draft,
            save_settings,
            load_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
