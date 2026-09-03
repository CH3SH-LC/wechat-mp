mod chat;
mod export;

use chat::chat_stream;
use export::export_html;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![chat_stream, export_html])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
