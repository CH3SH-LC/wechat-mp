mod chat;

use chat::chat_stream;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![chat_stream])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
