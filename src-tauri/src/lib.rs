mod chat;
mod draft;
mod export;

use chat::chat_stream;
use draft::{load_draft, save_draft};
use export::export_html;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![chat_stream, export_html, save_draft, load_draft])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
