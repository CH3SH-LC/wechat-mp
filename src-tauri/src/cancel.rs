// cancel.rs —— 运行取消句柄（修复计划阶段 4 第 5 条，2026-09-28）
//
// 要解决的问题：桌面端的"停止"此前只在前端生效——`stopRef.cancel` 由浏览器 mock 设置，
// 桌面链路 `sendChatRust` 没有任何后端取消句柄（当时属既有待办；**本文件即该待办的实现**，
// 已由 lib.rs 注册 `cancel_run`/`cancel_reset`，前端 stop() 也已接上）。
// 结果是：用户按了停止，前端的迟到事件被 `busyRef` 挡住，但**后端仍在跑、仍在计费**，
// 而且一次新的创作会与上一轮的迟到响应竞争。
//
// 设计：按 runId 维护一个 `watch<bool>` 取消信号。
// - `cancel_run` 命令把它置真；
// - 所有长耗时调用（流式对话、绘图、补描述、prep、视觉复核）包在 `run_cancellable` 里，
//   一旦置真立刻返回"已取消"，不等服务端。
// - 用 `watch` 而不是 `Notify`：watch 保留当前值，取消**先于**订阅发生时后到的任务也能立刻看到
//   （`Notify::notify_waiters` 只唤醒当时存在的等待者，会丢掉先到的取消）。
//
// 边界（必须如实说明）：取消只保证**本地停止等待与后续处理**；它不能承诺服务端已经停止计费。
// 这一点与修复计划原文一致，界面文案也不得宣称"已停止计费"。

use std::collections::{HashMap, VecDeque};
use std::future::Future;
use std::sync::{Arc, Mutex};

use tokio::sync::watch;

/// 同时保留的取消信号数量上限（FIFO 淘汰最旧的）。
/// 每回合一个 runId，活跃回合必在队尾；淘汰只可能丢掉早已结束的回合信号，
/// 后果退化为"该回合的取消不再被观察"，不会崩、也不会误取消别的回合。
const MAX_FLAGS: usize = 128;

/// 取消信号：`watch` 通道保留当前值，晚订阅者也能立刻看到已发生的取消。
pub struct CancelFlag {
    tx: watch::Sender<bool>,
}

impl CancelFlag {
    fn new() -> Self {
        CancelFlag { tx: watch::channel(false).0 }
    }
    fn subscribe(&self) -> watch::Receiver<bool> {
        self.tx.subscribe()
    }
    fn fire(&self) {
        // 必须用 send_replace 而不是 send：`watch::Sender::send` 在**没有活跃接收者**时
        // 会返回 Err 且**不写入新值**——取消先于调用发生（还没有人在等）正是最常见的情形，
        // 用 send 会让那次取消被静默丢掉。
        let _ = self.tx.send_replace(true);
    }
    pub fn is_cancelled(&self) -> bool {
        *self.tx.borrow()
    }
}

/// 进程内取消表（Tauri managed state）
#[derive(Default)]
pub struct CancelState {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    flags: HashMap<String, Arc<CancelFlag>>,
    order: VecDeque<String>,
}

impl CancelState {
    /// 取（必要时创建）某个 runId 的取消信号
    pub fn flag(&self, run_id: &str) -> Arc<CancelFlag> {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(f) = g.flags.get(run_id) {
            return f.clone();
        }
        let f = Arc::new(CancelFlag::new());
        g.flags.insert(run_id.to_string(), f.clone());
        g.order.push_back(run_id.to_string());
        while g.order.len() > MAX_FLAGS {
            if let Some(old) = g.order.pop_front() {
                g.flags.remove(&old);
            }
        }
        f
    }

    /// 置为已取消（幂等）
    pub fn cancel(&self, run_id: &str) {
        self.flag(run_id).fire();
    }

    pub fn is_cancelled(&self, run_id: &str) -> bool {
        self.inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .flags
            .get(run_id)
            .map(|f| f.is_cancelled())
            .unwrap_or(false)
    }

    /// 开始新一轮（同 runId 复用时不带上一次的取消状态）
    pub fn reset(&self, run_id: &str) {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        g.flags.remove(run_id);
        g.order.retain(|k| k != run_id);
    }
}

/// 取消错误文案：统一成一种，供失败分类识别为 `cancel`
pub const CANCELLED: &str = "已取消（用户停止）";

/// 把一次异步调用包成"可取消"：取消发生即立刻返回 `Err(CANCELLED)`，不等服务端。
/// `run_id` 为 None（旧调用路径）时原样等待，行为与改动前一致。
pub async fn run_cancellable<T, F>(
    state: &CancelState,
    run_id: Option<&str>,
    fut: F,
) -> Result<T, String>
where
    F: Future<Output = Result<T, String>>,
{
    let Some(id) = run_id else {
        return fut.await;
    };
    let flag = state.flag(id);
    // 先订阅再读当前值：若取消发生在两次调用之间，`borrow()` 会看到 true 并立即返回；
    // 若发生在之后，`changed()` 会唤醒。两个窗口都覆盖，不会漏。
    let mut rx = flag.subscribe();
    if *rx.borrow() {
        return Err(CANCELLED.to_string());
    }
    tokio::select! {
        r = fut => r,
        _ = rx.changed() => Err(CANCELLED.to_string()),
    }
}

/// 前端"停止"按钮的后端句柄（阶段 4 第 5 条）。
/// 恒返回 Ok：取消是尽力而为的本地动作，失败不该再产生一个错误弹窗。
#[tauri::command]
pub fn cancel_run(state: tauri::State<'_, CancelState>, run_id: String) -> Result<(), String> {
    state.cancel(&run_id);
    Ok(())
}

/// 清除某回合的取消状态，返回**清除前是否处于取消态**。
/// 用途：用户停止后又在未完成素材清单上点"重试"——重试属于同一个 runId，
/// 若不清除，重试会立刻被上一轮的取消信号打断。返回值供日志记录（不是流程判断）。
#[tauri::command]
pub fn cancel_reset(state: tauri::State<'_, CancelState>, run_id: String) -> Result<bool, String> {
    let was = state.is_cancelled(&run_id);
    state.reset(&run_id);
    Ok(was)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn cancel_before_start_is_observed() {
        let st = CancelState::default();
        st.cancel("r1");
        let r = run_cancellable(&st, Some("r1"), async { Ok::<_, String>(1) }).await;
        assert!(r.is_err(), "取消先于调用发生时必须立刻返回");
        assert!(r.unwrap_err().contains("取消"));
    }

    #[tokio::test]
    async fn cancel_during_flight_aborts_wait() {
        let st = CancelState::default();
        let flag = st.flag("r2");
        let slow = async {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            Ok::<_, String>("late")
        };
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(30)).await;
            flag.fire();
        });
        let t0 = std::time::Instant::now();
        let r = run_cancellable(&st, Some("r2"), slow).await;
        assert!(r.is_err());
        assert!(t0.elapsed().as_secs() < 5, "必须在取消后立刻返回，而不是等满 30 秒");
    }

    #[tokio::test]
    async fn without_run_id_behaves_as_before() {
        let st = CancelState::default();
        assert!(run_cancellable(&st, None, async { Ok::<_, String>(7) }).await.unwrap() == 7);
    }

    #[tokio::test]
    async fn reset_clears_previous_cancellation() {
        let st = CancelState::default();
        st.cancel("r3");
        assert!(st.is_cancelled("r3"));
        st.reset("r3");
        assert!(!st.is_cancelled("r3"), "新一轮不得继承上一轮的取消状态");
    }

    #[test]
    fn registry_is_bounded() {
        let st = CancelState::default();
        for i in 0..(MAX_FLAGS + 20) {
            st.cancel(&format!("r{i}"));
        }
        let n = st.inner.lock().unwrap().flags.len();
        assert_eq!(n, MAX_FLAGS, "取消表必须有上限，不能随会话无限增长");
    }
}
