# 2026-10-02 晚：CDP、构建与收尾身份独立复核

本轮仅读取当前源码、Cargo 依赖源码和既有磁盘证据；没有启动或关闭桌面应用/浏览器，没有使用历史 PID，没有模型调用，没有修改产品代码或正式 runner。仅运行纯 mock 的既有 CDP 回归及本目录身份故障注入，产物独立保存。

## 当前可确认的进展

CDP 已有真实可用证据，不能继续把 F 一律写作“CDP BLOCKED”。验收 exe 与正式 release 是两个不同二进制，应分别记验收层级。默认 release 的构建和隔离启动冒烟原件存在；两处身份闭锁缺口及根因/构建关联的证据边界仍应收口。

### 源码与依赖实际语义

- `src-tauri/Cargo.toml:24–35` 新增可选 `acceptance-devtools = ["tauri/devtools"]`，未加入 default feature。
- 本机锁定依赖为 tauri 2.11.5、tauri-runtime-wry 2.11.4、wry 0.55.1。在 `C:/Users/Lenovo/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/` 下核实：tauri 的 `Cargo.toml:92–95` 转发 devtools；tauri-runtime-wry 的 `Cargo.toml:45–48` 转发给 wry/runtime；其 `src/lib.rs:5209–5211` 在 debug 或 devtools feature 下调用 `with_devtools(webview_attributes.devtools.unwrap_or(true))`。wry 的 `src/lib.rs:834–837` 在 release 默认 false，`src/webview2/mod.rs:573` 将属性传给 SetAreDevToolsEnabled。这条“属性取值变化”的源码链可以确认。
- **源码链不能单独证明 TCP 监听的因果关系**。微软官方 [ICoreWebView2Settings / get_AreDevToolsEnabled](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2settings?view=webview2-1.0.3537.50#get_aredevtoolsenabled) 描述的是用户通过上下文菜单或快捷键打开 DevTools 窗口的权限；并未将此设置定义为 TCP CDP 服务开关。交叉参考 [当前 .NET AreDevToolsEnabled API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2settings.aredevtoolsenabled?view=webview2-dotnet-1.0.4191.47) 同样如此。本报告不反向声称该设置“绝不影响 CDP”，只是没有足够证据把两者等同。
- 因此 `PROGRESS.md:12–13`、CDP 文档 `:106–132`、Cargo 注释 `:25–33` 中“根因已经钉死”“全新 profile 必不开放端口”仍应改为本机所测配置的工作解释/观察。若要保留因果结论，需要 default/acceptance 构建与 fresh/warm profile 的受控对照原始证据，而不只是改后成功。

### 真实 CDP 与预热

原件 `%TEMP%/wxmp-live-run1/evidence/L1-2026-10-02T10-05-54-f9372ae2/evidence.json` 记录：

- 验收 exe SHA-256 `36b45e256b9be3fe644a1bd060c84e6902b34631ae1f22dfc2375ea628703522`。
- 预热 PID 39996 与后续 PID 31204 分别记录身份和关闭结果。
- 后续 `cdpPages` 包含 `type=page, url=http://tauri.localhost/, hasDebugger=true`，不是只有空端口或 Edge 对照。

当前 `live-acceptance.mjs:658–708` 的预热等待 Local State，再固定沉降 15 秒后关闭；`:717–730` 最多两次 openAppOnce；`:801–809` 等待目标导航。这些修复已经存在。但“marker 存在”不等于应用已完全可用；日志中 CDP 超时不应继续硬归因为永久不支持（`:792–795` 仍有旧文案）。

磁盘找到 `%TEMP%/wxmp-warm.mjs` 与 `wxmp-abab.mjs` 及测试目录。两份脚本主要向 stdout 打印，未在对应 evidence 目录找到可以绑定 exe/进程/采样的完整 warm 对照原件；本轮没有重跑。此处按“尚未定位原件”记录，不能推断该测试未做。

### 正式 release 原件与验收 exe 边界

已重新计算磁盘哈希，并将原始构建日志、两次 smoke JSON 复制到本目录 originals，逐份核对复制前后 SHA-256。一览见 `evidence-index.json`。

| 物件 | 现存 SHA-256 | 字节 |
| --- | --- | ---: |
| 正式 release exe | `b45d146cbeb26343a31009d7d71b3d1946d64b496ae488b65669a6e13d322626` | 15,879,168 |
| 正式 NSIS setup | `1171abf71dd176a077ef38f9efe2ee6a1daa814557f406a07e652a557d99a864` | 4,602,913 |
| `%TEMP%/wxmp-accept/wechat-mp-desktop-devtools.exe` | `36b45e256b9be3fe644a1bd060c84e6902b34631ae1f22dfc2375ea628703522` | 15,907,328 |

- `%TEMP%/wxmp-build-dev.log` 明确执行 `tauri build --no-bundle -f acceptance-devtools`；`wxmp-build-final.log` 明确执行 `tauri build --bundles nsis`，记录 frontend 与 Rust release 成功及 NSIS 产物。默认 release 本机 Cargo fingerprint 的 features 为 `[]`、declaredFeatures 包含 acceptance-devtools，mtime 对应这次构建。能支持“按默认配置重建”，不能仅凭文件大小推导所有行为相同。
- `%TEMP%/wxmp-smoke-final/release-smoke.json`：该默认 exe 4/5，标题为空，FAIL；关闭 `forced=true, via=taskkill-force`。
- `%TEMP%/wxmp-smoke-final2/release-smoke.json`：同一默认 exe 5/5，OS 读到完整预期标题，PASS；关闭 `forced=false, via=wm-close`。两份均有 55 文件测前测后完整哈希，逐项相同。
- **两次 smoke 使用不同的全新 profile**（分别 muqot3ap、muqovse1），不是同一个 profile 第二次启动。因此 `PROGRESS.md:19` 与 CDP 文档 `:166` 的“与预热原因同源、不是缺陷”尚未获证；保留首次失败及重跑通过两个事实即可。
- smoke 仅证明启动层；原件中没有 L1–L6 业务验收。L1 的真实 CDP 及业务证据绑定另存验收 exe。不得把验收 exe 的全部业务结论直接改写成“最终默认发布二进制已做同样验收”。
- 当前 live `inputFingerprints`（`scripts/live-acceptance.mjs:2566–2574`）只含 exe、setup 和五个源文件。本轮在仓库/可读 TEMP 候选中未定位到与 10-02 这两次构建绑定的**全输入清单**；找到的旧 manifest 不能冒充本次。请 DS 恢复当次原件；若不存在，明确该缺口，后续冻结输入并重新生成关联证据，不能把现在生成的 manifest 倒签为历史构建清单。

## 身份闭锁：已修部分与两个新反例

本轮重跑 `node scripts/cdp-preflight-check.mjs --out docs/artifacts/2026-10-02-evening-review/cdp-release/existing-cdp-check`：**23/23 PASS**，exit 0。这是纯 mock，未启进程。明确映像不匹配、整个身份探针失败现在均拒绝关闭；这是有效进展。

独立补充的 `identity-probe.mjs` 也只使用模块公开注入的 `probe / alive / runner`，全部 OS 操作均为替身；其结果保留在 `identity-probe-result.json`：

1. **路径/创建时间缺失仍被当作确认身份。** `desktop-harness.mjs:261–275` 一旦映像名相同先置 true，路径或开始时间缺失就跳过比较。向关闭函数传入完整的启动身份，但当前探针只返回同名 image、path/startTime 为 null，实际仍执行模拟 `taskkill /PID`，并返回 `closed:true, refused:false`。实际 fallback `:215–216` 正能产生这种只有映像名的身份。因此“UNKNOWN 全闭锁”尚不成立。
2. **强杀之前没有再次核验身份。** `desktop-harness.mjs:371–390` 初次核验后先温和关闭并等待，随后直接 `/F`；再次 `procIdentity` 位于 `:403–404`，已经在强杀之后。替身在正常关闭请求后将 PID 的身份换成另一个进程，仍观察到第二次模拟 `taskkill /PID /F`。需要在每次实际关闭动作前重新核对同一启动身份；不一致或缺字段直接 refused，不能事后才记录。

同时调用者要传入真正的启动记录：`release-smoke.mjs:139` 目前仍只传 `{exe}`，两份 smoke 的 expectedIdentity 无启动时刻。补闭锁后同步 smoke，不应为了使旧调用继续绿而放宽“缺启动身份”的门槛。

## 给 DS 的最小下一步

先修上述两个身份门禁及所有收尾调用的启动身份传递，保留 PID/真实路径/创建时刻，实际关闭前任一必需字段不可读时停止；每次温和/强制操作前都重新核验。同一 profile 的重试还应以确证已关闭为门槛。用本目录两条反例加现有 23 条回归做零模型复验。

主线的 IPC fallback/预算问题与此并行处理，随后只做零模型定向发布验证：先恢复或补建两类构建的输入/特性/产物关联；保留 default 构建、acceptance 构建、default smoke、真实业务各自的边界。需要证明根因时才补受控 feature×profile 对照；否则直接收窄因果文案即可。无须为本报告重新跑完整付费 L1–L6。
