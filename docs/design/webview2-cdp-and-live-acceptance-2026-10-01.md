# WebView2 不开放 CDP 端口：真机验收（包 F）为何被卡住

日期：2026-10-01。状态：**基础设施阻塞，已定位到具体原因并留证；不是"还没做"，也不是"等授权"。**

本文件记录一次真实的排查结论，目的是让后来者不必重新踩一遍同样的坑。它同时说明：本轮已经把
"驱动真机"的能力**修到代码层面可用**，卡点在**运行时的行为**，不在本仓库。

## 1. 结论（一句话）

本机 WebView2 运行时**不对外提供 TCP 上的 DevTools 端点**，因此任何"经 CDP 驱动真实桌面应用"
的验收（`scripts/live-acceptance.mjs` 的 L1–L6、以及历史上的 `live-three-samples.mjs`）在本机
**无法执行**。脚本会在启动阶段就 BLOCKED，**不派发任何模型请求、不产生费用**。

## 2. 排查过程与证据（按时间顺序）

| # | 观察 | 结论 |
| --- | --- | --- |
| 1 | `scripts/release-smoke.mjs` 启动隔离实例后，`http://127.0.0.1:<port>/json/list` 连续 45s 连不上 | 端口没开 |
| 2 | 隔离 profile 下 `Documents/wechat-mp-workspace`、`state.json`、WebView2 `EBWebView/` 都正常建出 | **应用本身起来了**，不是崩溃 |
| 3 | 用 PowerShell 读 `MainWindowTitle`，与 `智序 · 公众号推文助手` **逐字符相等**（UTF-8 存取，排除控制台乱码干扰） | 窗口正常 |
| 4 | grep Tauri 依赖源码：`wry-0.55.1/src/webview2/mod.rs:294` 用 `unwrap_or_else` **无条件**给 `additional_browser_args` 填默认串，并调用 `set_additional_browser_arguments()` | 该调用会**覆盖** `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 环境变量 → 旧文档里"用环境变量开 CDP"的做法**在当前依赖下是死的** |
| 5 | 改由 Tauri builder 的 `additional_browser_args()` 显式传入（`src-tauri/src/lib.rs`，env `WXMP_CDP_PORT` 门控），重建后 dump WebView2 进程命令行 | `BROWSER pid=… rdp=9357`——**开关确实到了 WebView2 浏览器进程** |
| 6 | 同一时刻 `netstat` 无任何端口监听；换 `--remote-debugging-port=0` 后 `DevToolsActivePort` 文件**不存在** | WebView2 收到开关但**不启动** DevTools 服务端 |
| 7 | 同机普通 Edge 用同一开关 + `--headless=new`：`/json/version` 返回 **200** | 机器层面不拦，问题**只在 WebView2** |
| 8 | 查注册表 `HKLM/HKCU\SOFTWARE\Policies\Microsoft\Edge(WebView)` 与 `RemoteDebuggingAllowed`：**全部不存在** | 不是组策略拦的 |
| 9 | 指向旧运行时 153（`WEBVIEW2_BROWSER_EXECUTABLE_FOLDER`）重试；运行 `--remote-allow-origins=*` 重试 | 均**仍然连不上** |
| 10 | 本机安装的 WebView2 版本：`153.0.4234.48` 与 `154.0.4258.37` | 两代都不开放 |

## 3. 顺带修掉的一个真实缺陷（已生效）

`src-tauri/src/lib.rs` 现在把主窗口的创建从 `tauri.conf.json` 搬到代码里，并用环境变量
`WXMP_CDP_PORT` 门控是否追加 `--remote-debugging-port`。

- **默认行为完全不变**：不设该变量时不开任何调试端口；窗口标题 / 尺寸 / 最小尺寸 / label（`main`）
  与配置里逐字一致（已实测标题逐字符相等、隔离工作区正常建立、真实工作区逐字节未变）。
- 一旦自己传参数，wry 的默认串就不再追加，因此**必须**原样带上
  `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`（Tauri 文档明确警告过）。
- 意义：在**允许 CDP 的机器上**，真机验收脚本现在真的能连上了；在此之前那条路是静默失效的。

安全上：非法端口值一律忽略并打印说明，不猜、不静默变形。

## 4. 对包 F 的影响（如实）

- **未执行**：L1 首篇 / L2 只改文字 / L3 普通问答 / L4 明确换图 / L5 重开 / L6 导出，
  六项**全部 NOT RUN**，原因是启动阶段连不上 CDP（已留证：`run-result.json` 为 `BLOCKED`，
  账本 `已派发 0 次、绘图 0 次`）。
- **不因此声称任何交付能力**。`finish_preparation` 的真实模型遵从、真实桌面完整续改链、
  微信端观感、断电恢复、多实例并发等**仍然全部未验收**。
- **不需要重新征求付费授权**（用户已授权）；需要的是**换一个能开 CDP 的环境**，
  或者等 WebView2 恢复该能力，或者改走别的驱动方式（例如 Windows UI Automation，代价与脆弱性另说）。
- 在具备 CDP 的机器上，直接 `node scripts/live-acceptance.mjs L1 --root <新目录>`，
  然后 L2→L6 复用同一个 `--root`。预算账本跨 phase 累加，派发前检查，超限即 BLOCKED。
