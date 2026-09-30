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
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 微信 access_token 进程内缓存（发布草稿箱用；重复获取会触发平台频控）
            app.manage(WxTokenState::default());
            // 运行取消表（阶段 4）：前端"停止"按钮的后端句柄
            app.manage(CancelState::default());
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
