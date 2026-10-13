//! Native WebView2 diagnostics and bounded recovery. No document/settings content
//! enters this log; rebuilding only replaces the window, never the workspace.
use std::sync::{Arc, Mutex};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Failure {
    BrowserExited,
    RendererExited,
    Unresponsive,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Action {
    None,
    Reload,
    Rebuild,
    AskReload,
    AskRebuild,
}

#[derive(Default)]
struct Policy {
    generation: u64,
    busy: bool,
    rebuilding: bool,
    rebuild_queued: bool,
    closing: bool,
    reloaded: bool,
    rebuilt: bool,
    asked_reload: bool,
    asked_rebuild: bool,
    asked_unresponsive: bool,
    pending_browser: Option<u64>,
    declined_generation: Option<u64>,
}

impl Policy {
    fn decide(&mut self, generation: u64, failure: Failure) -> Action {
        if self.closing
            || generation != self.generation
            || self.declined_generation == Some(generation)
        {
            return Action::None;
        }
        if self.busy {
            if failure == Failure::BrowserExited {
                self.pending_browser = Some(generation);
            }
            return Action::None;
        }
        let action = match failure {
            Failure::RendererExited if !self.reloaded => {
                self.reloaded = true;
                Action::Reload
            }
            Failure::BrowserExited if !self.rebuilt => {
                self.rebuilt = true;
                Action::Rebuild
            }
            Failure::RendererExited if !self.asked_reload => {
                self.asked_reload = true;
                Action::AskReload
            }
            Failure::BrowserExited if !self.asked_rebuild => {
                self.asked_rebuild = true;
                Action::AskRebuild
            }
            Failure::Unresponsive if !self.asked_unresponsive => {
                self.asked_unresponsive = true;
                Action::AskReload
            }
            _ => Action::None,
        };
        self.busy = action != Action::None;
        action
    }

    fn finish(&mut self) {
        self.busy = false;
        self.rebuilding = false;
        self.rebuild_queued = false;
        self.pending_browser = None;
    }
    fn decline(&mut self) {
        self.declined_generation = Some(self.generation);
        self.finish();
    }
    /// Upgrade an already queued action before touching a dead browser. A
    /// confirmation authorizes this recovery, but never replenishes its budget.
    fn prioritize(&mut self, generation: u64, action: Action, confirmed: bool) -> Action {
        if self.closing
            || generation != self.generation
            || self.declined_generation == Some(generation)
        {
            return Action::None;
        }
        if self.pending_browser == Some(generation) {
            self.pending_browser = None;
            if matches!(action, Action::Rebuild | Action::AskRebuild) {
                return action;
            }
            self.busy = false;
            let action = self.decide(generation, Failure::BrowserExited);
            return if confirmed && action == Action::AskRebuild {
                Action::Rebuild
            } else {
                action
            };
        }
        action
    }
    fn complete(&mut self, generation: u64) -> Action {
        let pending = self.pending_browser;
        self.finish();
        if pending == Some(generation) && generation == self.generation {
            self.decide(generation, Failure::BrowserExited)
        } else {
            Action::None
        }
    }
    fn prevent_exit(&self, code: Option<i32>) -> bool {
        code.is_none() && self.rebuilding && !self.closing
    }
}

#[derive(Clone, Default)]
pub(crate) struct DesktopRuntime(Arc<Mutex<Policy>>);

#[cfg(windows)]
mod native {
    use super::*;
    use std::{
        fs::OpenOptions,
        io::Write,
        os::windows::fs::OpenOptionsExt,
        path::Path,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };
    use tauri::{AppHandle, Manager, WebviewWindow};
    use webview2_com::{Microsoft::Web::WebView2::Win32::*, ProcessFailedEventHandler};
    use windows::{
        core::{w, Interface},
        Win32::UI::WindowsAndMessaging::{
            MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONWARNING, MB_OK, MB_SETFOREGROUND, MB_YESNO,
        },
    };

    #[derive(Clone, Copy, serde::Serialize)]
    #[serde(rename_all = "kebab-case")]
    enum Event {
        WebviewAttached,
        FrontendReady,
        HookFailed,
        ProcessFailed,
        RecoverySuppressed,
        RecoveryQueued,
        ReloadStarted,
        ReloadDispatched,
        ReloadFailed,
        RecoveryPrompt,
        RecoveryDeclined,
        RebuildStarted,
        RebuildFinished,
        RebuildFailed,
        DispatchFailed,
        UserClose,
    }

    // Deliberately typed: callers cannot pass URLs, errors, prompts, or settings.
    #[derive(serde::Serialize)]
    struct Record {
        timestamp_ms: u64,
        pid: u32,
        event: Event,
        generation: u64,
        kind: Option<i32>,
        reason: Option<i32>,
        exit_code: Option<i32>,
        hresult: Option<i32>,
    }

    const MAX_LOG_BYTES: u64 = 1024 * 1024;
    static LOG_LOCK: Mutex<()> = Mutex::new(());

    fn append_record(dir: &Path, bytes: &[u8], limit: u64) -> std::io::Result<()> {
        if bytes.len() as u64 > limit {
            return Err(std::io::Error::other("runtime record too large"));
        }
        let _guard = LOG_LOCK
            .lock()
            .map_err(|_| std::io::Error::other("runtime log lock failed"))?;
        std::fs::create_dir_all(dir)?;
        // Share-mode zero also serializes independent desktop instances. A busy
        // log fails this record safely instead of racing backup replacement.
        let _file_lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .share_mode(0)
            .open(dir.join("desktop-runtime.lock"))?;
        let path = dir.join("desktop-runtime.jsonl");
        let backup = dir.join("desktop-runtime.previous.jsonl");
        let length = match std::fs::metadata(&path) {
            Ok(meta) => meta.len(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => 0,
            Err(error) => return Err(error),
        };
        if length.saturating_add(bytes.len() as u64) > limit {
            match std::fs::remove_file(&backup) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error),
            }
            std::fs::rename(&path, &backup)?;
            // Bound an oversized log from an older executable too. No content
            // is read; only this historical backup may end in a partial line.
            if length > limit {
                OpenOptions::new()
                    .write(true)
                    .open(&backup)?
                    .set_len(limit)?;
            }
        }
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?
            .write_all(bytes)
    }

    fn record(
        event: Event,
        generation: u64,
        kind: Option<i32>,
        reason: Option<i32>,
        exit_code: Option<i32>,
        hresult: Option<i32>,
    ) {
        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            let dir = crate::sessions::workspace_dir()
                .map_err(std::io::Error::other)?
                .join("traces");
            let mut bytes = serde_json::to_vec(&Record {
                timestamp_ms: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                pid: std::process::id(),
                event,
                generation,
                kind,
                reason,
                exit_code,
                hresult,
            })?;
            bytes.push(b'\n');
            append_record(&dir, &bytes, MAX_LOG_BYTES)?;
            Ok(())
        })();
        if result.is_err() {
            eprintln!("[wxmp] desktop runtime log write failed");
        }
    }

    fn simple(event: Event, generation: u64) {
        record(event, generation, None, None, None, None);
    }
    fn runtime(app: &AppHandle) -> DesktopRuntime {
        app.state::<DesktopRuntime>().inner().clone()
    }

    // Tauri executes main-thread tasks immediately when called from the UI thread.
    // Dispatch from a worker so no COM callback destroys/reloads its own sender.
    fn defer(app: &AppHandle, generation: u64, task: impl FnOnce(AppHandle) + Send + 'static) {
        let handle = app.clone();
        std::thread::spawn(move || {
            let task_handle = handle.clone();
            if handle
                .run_on_main_thread(move || task(task_handle))
                .is_err()
            {
                runtime(&handle).0.lock().unwrap().finish();
                simple(Event::DispatchFailed, generation);
            }
        });
    }

    pub(super) fn attach(window: &WebviewWindow) -> tauri::Result<()> {
        let app = window.app_handle().clone();
        let generation = {
            let state = runtime(&app);
            let mut policy = state.0.lock().unwrap();
            policy.generation += 1;
            policy.generation
        };
        window.with_webview(move |platform| unsafe {
            let hook = (|| -> windows::core::Result<()> {
                let core = platform.controller().CoreWebView2()?;
                let callback_app = app.clone();
                let handler = ProcessFailedEventHandler::create(Box::new(move |_sender, args| {
                    let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND(-1);
                    let mut reason = None;
                    let mut exit_code = None;
                    if let Some(args) = args {
                        let _ = args.ProcessFailedKind(&mut kind);
                        if let Ok(extra) = args.cast::<ICoreWebView2ProcessFailedEventArgs2>() {
                            let mut value = COREWEBVIEW2_PROCESS_FAILED_REASON(-1);
                            if extra.Reason(&mut value).is_ok() {
                                reason = Some(value.0);
                            }
                            let mut value = 0;
                            if extra.ExitCode(&mut value).is_ok() {
                                exit_code = Some(value);
                            }
                        }
                    }
                    record(
                        Event::ProcessFailed,
                        generation,
                        Some(kind.0),
                        reason,
                        exit_code,
                        None,
                    );
                    let failure = match kind {
                        COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED => {
                            Failure::BrowserExited
                        }
                        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED => {
                            Failure::RendererExited
                        }
                        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE => {
                            Failure::Unresponsive
                        }
                        _ => Failure::Other,
                    };
                    let state = runtime(&callback_app);
                    let mut policy = state.0.lock().unwrap();
                    let action = policy.decide(generation, failure);
                    let queued = policy.pending_browser == Some(generation);
                    drop(policy);
                    if action == Action::None {
                        simple(
                            if queued {
                                Event::RecoveryQueued
                            } else {
                                Event::RecoverySuppressed
                            },
                            generation,
                        );
                    } else {
                        defer(&callback_app, generation, move |app| {
                            execute(&app, generation, action)
                        });
                    }
                    Ok(())
                }));
                let mut token = 0;
                core.add_ProcessFailed(&handler, &mut token)?;
                // CoreWebView2 retains the event handler until this view is destroyed.
                Ok(())
            })();
            match hook {
                Ok(()) => simple(Event::WebviewAttached, generation),
                Err(error) => record(
                    Event::HookFailed,
                    generation,
                    None,
                    None,
                    None,
                    Some(error.code().0),
                ),
            }
        })
    }

    fn execute(app: &AppHandle, generation: u64, mut action: Action) {
        let state = runtime(app);
        action = state
            .0
            .lock()
            .unwrap()
            .prioritize(generation, action, false);
        if action == Action::None {
            return;
        }
        let mut confirmed = false;
        if matches!(action, Action::AskReload | Action::AskRebuild) {
            simple(Event::RecoveryPrompt, generation);
            let yes = unsafe {
                MessageBoxW(None,
                w!("界面发生故障。是否恢复界面？\n\n已保存的作品会保留；尚未保存的输入或正在进行的任务可能中断。\n选择“否”可保留当前现场，稍后自行关闭并重新打开。"),
                w!("智序 · 界面恢复"), MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | MB_SETFOREGROUND) == IDYES
            };
            if !yes {
                state.0.lock().unwrap().decline();
                simple(Event::RecoveryDeclined, generation);
                return;
            }
            action = if action == Action::AskRebuild {
                Action::Rebuild
            } else {
                Action::Reload
            };
            confirmed = true;
        }
        // A native dialog pumps messages; an explicit close during that nested
        // loop must win over a previously queued recovery decision.
        action = state
            .0
            .lock()
            .unwrap()
            .prioritize(generation, action, confirmed);
        if action == Action::None {
            return;
        }
        // A browser exit between queued reload and dispatch may require its own
        // bounded prompt when this turn did not already obtain consent.
        if matches!(action, Action::AskReload | Action::AskRebuild) {
            defer(app, generation, move |app| {
                execute(&app, generation, action)
            });
            return;
        }
        if matches!(action, Action::Reload | Action::Rebuild) {
            // Only cancel after consent/close checks, immediately before replacing
            // the client that owns these requests. Saved documents are untouched.
            app.state::<crate::cancel::CancelState>().cancel_all();
        }
        match action {
            Action::Reload => {
                simple(Event::ReloadStarted, generation);
                let ok = app
                    .get_webview_window("main")
                    .is_some_and(|window| window.reload().is_ok());
                complete_and_dispatch(app);
                simple(
                    if ok {
                        Event::ReloadDispatched
                    } else {
                        Event::ReloadFailed
                    },
                    generation,
                );
            }
            Action::Rebuild => {
                state.0.lock().unwrap().rebuilding = true;
                simple(Event::RebuildStarted, generation);
                if app
                    .get_webview_window("main")
                    .is_none_or(|window| window.destroy().is_err())
                {
                    fail_rebuild(app, generation);
                    return;
                }
                // Wait for Destroyed before reusing the label. Bound the no-window
                // interval even if the runtime fails to report destruction.
                let watchdog_app = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(10));
                    defer(&watchdog_app, generation, move |app| {
                        let state = runtime(&app);
                        let policy = state.0.lock().unwrap();
                        let timed_out = policy.rebuilding && policy.generation == generation;
                        drop(policy);
                        if timed_out {
                            fail_rebuild(&app, generation);
                        }
                    });
                });
            }
            _ => {
                state.0.lock().unwrap().finish();
            }
        }
    }

    fn complete_and_dispatch(app: &AppHandle) {
        let state = runtime(app);
        let mut policy = state.0.lock().unwrap();
        let generation = policy.generation;
        let action = policy.complete(generation);
        drop(policy);
        if action != Action::None {
            defer(app, generation, move |app| {
                execute(&app, generation, action)
            });
        }
    }

    fn fail_rebuild(app: &AppHandle, generation: u64) {
        runtime(app).0.lock().unwrap().finish();
        simple(Event::RebuildFailed, generation);
        unsafe {
            MessageBoxW(None,
            w!("界面恢复未能完成。已保存的作品仍保留在本机。\n请关闭后，从项目目录重新打开智序。"),
            w!("智序 · 界面恢复"), MB_OK | MB_ICONWARNING | MB_SETFOREGROUND);
        }
        // Never leave a headless process with ExitRequested permanently blocked.
        if app.get_webview_window("main").is_none() {
            app.exit(1);
        }
    }

    pub(super) fn on_run_event(app: &AppHandle, event: &tauri::RunEvent) {
        match event {
            tauri::RunEvent::ExitRequested { code, api, .. } => {
                if runtime(app).0.lock().unwrap().prevent_exit(*code) {
                    api.prevent_exit();
                }
            }
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { .. },
                ..
            } if label == "main" => {
                let state = runtime(app);
                let mut policy = state.0.lock().unwrap();
                policy.closing = true;
                policy.finish();
                simple(Event::UserClose, policy.generation);
            }
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::Destroyed,
                ..
            } if label == "main" => {
                let state = runtime(app);
                let mut policy = state.0.lock().unwrap();
                if !policy.rebuilding || policy.rebuild_queued || policy.closing {
                    return;
                }
                policy.rebuild_queued = true;
                let generation = policy.generation;
                drop(policy);
                // Tauri removes the manager label before this callback; deferring
                // also lets Wry finish removing the native window from its map.
                defer(app, generation, move |app| {
                    let state = runtime(&app);
                    if state.0.lock().unwrap().closing {
                        return;
                    }
                    match crate::create_main_window(&app) {
                        Ok(()) => {
                            complete_and_dispatch(&app);
                            simple(Event::RebuildFinished, generation);
                        }
                        Err(_) => fail_rebuild(&app, generation),
                    }
                });
            }
            _ => {}
        }
    }

    pub(super) fn frontend_ready(window: &WebviewWindow) {
        if window.label() == "main" {
            simple(
                Event::FrontendReady,
                runtime(window.app_handle()).0.lock().unwrap().generation,
            );
        }
    }

    #[cfg(test)]
    mod log_tests {
        use super::*;
        #[test]
        fn rotation_keeps_one_bounded_backup_without_reading_live_content() {
            let root = std::env::temp_dir();
            let dir = root.join(format!(
                "wxmp-runtime-log-test-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            let row = b"{\"event\":\"frontend-ready\"}\n";
            let limit = row.len() as u64 * 2;
            for _ in 0..9 {
                append_record(&dir, row, limit).unwrap();
            }
            assert_eq!(
                std::fs::metadata(dir.join("desktop-runtime.jsonl"))
                    .unwrap()
                    .len(),
                row.len() as u64
            );
            assert_eq!(
                std::fs::metadata(dir.join("desktop-runtime.previous.jsonl"))
                    .unwrap()
                    .len(),
                limit
            );
            assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 3); // active, one backup, lock
            std::fs::write(
                dir.join("desktop-runtime.jsonl"),
                vec![b'x'; limit as usize * 3],
            )
            .unwrap();
            append_record(&dir, row, limit).unwrap();
            assert_eq!(
                std::fs::metadata(dir.join("desktop-runtime.previous.jsonl"))
                    .unwrap()
                    .len(),
                limit
            );
            assert!(dir.starts_with(&root));
            std::fs::remove_dir_all(dir).unwrap();
        }
    }
}

/// Called by the mounted React root, with no content or caller-selected fields.
#[tauri::command]
pub(crate) fn desktop_frontend_ready(window: tauri::WebviewWindow) {
    #[cfg(windows)]
    native::frontend_ready(&window);
    #[cfg(not(windows))]
    let _ = window;
}

pub(crate) fn attach(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    return native::attach(window);
    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(())
    }
}

pub(crate) fn on_run_event(app: &tauri::AppHandle, event: tauri::RunEvent) {
    #[cfg(windows)]
    native::on_run_event(app, &event);
    #[cfg(not(windows))]
    let _ = (app, event);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_recovery_is_bounded_across_new_windows() {
        let mut policy = Policy::default();
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::Rebuild);
        policy.finish();
        policy.generation = 1;
        assert_eq!(policy.decide(1, Failure::BrowserExited), Action::AskRebuild);
        policy.finish();
        policy.generation = 2;
        assert_eq!(policy.decide(2, Failure::BrowserExited), Action::None);
        assert_eq!(policy.decide(2, Failure::RendererExited), Action::Reload);
        policy.finish();
        assert_eq!(policy.decide(2, Failure::RendererExited), Action::AskReload);
        policy.finish();
        assert_eq!(policy.decide(2, Failure::RendererExited), Action::None);
    }

    #[test]
    fn unresponsive_only_prompts_once_and_never_auto_reloads() {
        let mut policy = Policy::default();
        assert_eq!(policy.decide(0, Failure::Unresponsive), Action::AskReload);
        policy.finish();
        assert_eq!(policy.decide(0, Failure::Unresponsive), Action::None);
        assert!(!policy.reloaded);
    }

    #[test]
    fn duplicate_and_old_view_events_do_not_recover() {
        let mut policy = Policy::default();
        assert_eq!(policy.decide(0, Failure::RendererExited), Action::Reload);
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::None);
        policy.finish();
        policy.generation = 1;
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::None);
        assert!(!policy.rebuilt);
    }

    #[test]
    fn only_recovery_suppresses_last_window_exit() {
        let mut policy = Policy::default();
        assert!(!policy.prevent_exit(None));
        policy.rebuilding = true;
        assert!(policy.prevent_exit(None));
        assert!(!policy.prevent_exit(Some(0)));
        policy.finish();
        assert!(!policy.prevent_exit(None));
    }

    #[test]
    fn user_close_wins_over_pending_recovery() {
        let mut policy = Policy::default();
        policy.rebuilding = true;
        policy.closing = true;
        assert!(!policy.prevent_exit(None));
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::None);
    }

    #[test]
    fn gpu_frame_and_unknown_failures_only_log() {
        let mut policy = Policy::default();
        assert_eq!(policy.decide(0, Failure::Other), Action::None);
        assert!(!policy.busy);
        assert!(!policy.reloaded);
        assert!(!policy.rebuilt);
    }

    #[test]
    fn browser_exit_during_prompt_is_prioritized_after_confirmation() {
        let mut policy = Policy::default();
        assert_eq!(policy.decide(0, Failure::Unresponsive), Action::AskReload);
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::None);
        assert_eq!(policy.pending_browser, Some(0));
        assert_eq!(policy.prioritize(0, Action::Reload, true), Action::Rebuild);
        assert!(policy.rebuilt);
        assert_eq!(policy.pending_browser, None);
    }

    #[test]
    fn declined_prompt_discards_browser_exit_and_does_not_auto_retry() {
        let mut policy = Policy::default();
        policy.decide(0, Failure::Unresponsive);
        policy.decide(0, Failure::BrowserExited);
        policy.decline();
        assert_eq!(policy.complete(0), Action::None);
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::None);
        assert_eq!(policy.prioritize(0, Action::Reload, true), Action::None);
        assert!(!policy.rebuilt);
    }

    #[test]
    fn reload_completion_drains_higher_priority_browser_failure() {
        let mut policy = Policy::default();
        policy.decide(0, Failure::RendererExited);
        policy.decide(0, Failure::BrowserExited);
        assert_eq!(policy.complete(0), Action::Rebuild);
        assert!(policy.busy);
        policy.finish();
        policy.decide(0, Failure::Unresponsive);
        policy.decide(0, Failure::BrowserExited);
        assert_eq!(policy.prioritize(0, Action::Reload, true), Action::Rebuild);
        policy.finish();
        assert_eq!(policy.decide(0, Failure::BrowserExited), Action::None);
    }

    #[test]
    fn queued_browser_failure_cannot_revive_old_or_closed_window() {
        let mut policy = Policy::default();
        policy.decide(0, Failure::Unresponsive);
        policy.decide(0, Failure::BrowserExited);
        policy.closing = true;
        assert_eq!(policy.prioritize(0, Action::Reload, true), Action::None);
        assert_eq!(policy.complete(0), Action::None);
        policy.closing = false;
        policy.decide(0, Failure::RendererExited);
        policy.decide(0, Failure::BrowserExited);
        policy.generation = 1;
        assert_eq!(policy.complete(1), Action::None);
        assert!(!policy.rebuilt);
    }
}
