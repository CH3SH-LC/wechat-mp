# R4 CDP 证据独立复核（2026-10-02）

本次仅读取代码和已有文件，并对抽取的收尾函数做完全 mock 的离线探针；未启动、关闭或重启任何桌面应用，未运行模型，未实时重试 CDP。`Get-CimInstance Win32_Process` 本次返回拒绝访问，因此当前进程树为 UNKNOWN，未使用历史 PID 操作进程。

## 已核实原件与范围

- 矩阵原件：仓库根 `cdp-matrix.json`，SHA-256 `227a1c6baec5a67f300f77723b549f7e1df395081a0bea434d993ff13be173d5`。
- 当前 release exe：`src-tauri/target/release/wechat-mp-desktop.exe`，SHA-256 `bdbf102ae5a0aced6d3bf6d283f1f93c8e118484edb0356e2e4cedf8bb9edd29`，与矩阵 A/B 和文档相符。
- 隔离目录原件仍在 `C:\Users\Lenovo\AppData\Local\Temp\wxmp-cdp-preflight-7uJ4yw`。在该目录、`%TEMP%/wxmp-*` 顶层候选、`wxmp-suite` 与仓库 `docs/artifacts` 未定位到这次 preflight 的原 `run-result.json`；不推断其从未生成。
- B 格记录了 PID 22252、应用映像名、端口 61856。六次样本为北京时间 2026-10-01 16:39:26.596 至 16:39:39.136，采样跨度 12.540 秒，均 `listening:false`。这是对 `127.0.0.1:61856` 的连通探测记录，不是全部 TCP 监听的枚举。
- B 的子进程命令行含 `--remote-debugging-port=61856`，程序路径指向 WebView2 `154.0.4258.37`，实际 `--user-data-dir` 指向本轮 `B/webview/EBWebView`。但 fallback 只保存命令行，不保存该子 PID、创建时间、实际映像哈希；仍不足以完整封闭同次启动身份链。
- C 格 Edge 端口 63446 返回 HTTP 200；`/json/version` 为 `Edg/154.0.4258.48`，`/json/list` 有 7 个 target。只支持该 Edge 配置可用，不能排除仓库启动配置、宿主权限、WebView2 配置等因素。
- 当前内外两层都未找到 DevToolsActivePort，但当前不存在不能补证历史检查正确。矩阵没有真实工作区测前/测后逐文件清单，也没有 cleanup 原始结果，无法从矩阵独立验明“55 文件完全未改”和“全部正常关闭”。

## 已确认缺陷（按当前源码行号）

1. **收尾没有身份闭锁**：`scripts/lib/desktop-harness.mjs:152–162` 仅 PID + 映像名，未含创建时间/实际路径；`:178–192` 获取身份后只检查 alive，身份不匹配或 UNKNOWN 仍进入 taskkill。本次完全 mock 探针两种情况均观察到 taskkill 调用并返回 `closed:true, forced:false`。先修复此处再运行会启动/收尾应用的 preflight。
2. **矩阵落错目录**：`scripts/cdp-preflight.mjs:298` 用 `judge.run.outDir || ''`；`scripts/lib/run-result.mjs:225–242` 把 outDir 放在闭包变量，run 没有该属性。纯离线探针确认因此输出 `cwd/cdp-matrix.json`。矩阵应作为必需附件，与判定文件一起原子归档并校验哈希，不能继续覆盖仓库根文件。
3. **收尾可假绿**：`scripts/cdp-preflight.mjs:147–150` 只记录关闭结果，`:184–185`、`:226–227`、`:255–256` 无条件清空 startedPids，`:314` 固定 true 宣称全部关闭。且 C 的 PID 仍由 closeAll 用应用 exe 核验（`:149`），并非 Edge 的 exe。每次保存完整启动记录，所有关闭结果必须参与判定；未退出或身份 UNKNOWN 时停止，不能清空追踪。
4. **DevToolsActivePort 查错层**：`:198–209` 只列 `isoB.webview` 外层；矩阵记录该层只有 EBWebView，实际 user-data-dir 是下一层。必须按实际进程命令行目录检查，且固定端口配置下“没有此文件”不能单独用作 CDP 不支持的证据。
5. **A 对照和网络分类不完整**：`:173–182` 探测未传给应用的随机空闲端口，无法排除其他端口存在监听；`desktop-harness.mjs:81–96` A 仍继承父环境，没有显式清掉 CDP/runtime 环境覆盖。`:59–75` 把 TCP timeout/各类 error 合并为 false；`:79–100` HTTP 可响应就 ok，不验证 status 或 JSON 结构；`:274–281` 历史空 target 先于之后有效 target，会误归类。B 现有记录仍可保留为有限观察。
6. **结论过度且注释冲突**：`docs/design/webview2-cdp-and-live-acceptance-2026-10-01.md:25` 的“不是本项目传参链路的问题”超出“最终子命令行出现开关”的证据范围；`scripts/lib/desktop-harness.mjs:91–93` 仍写 setter 覆盖环境变量，与文档已修正的 API 合并语义冲突，不能继续作为根因。

## 下一步给 DS

先修收尾身份门禁、退出结果判定、矩阵附件归档和诊断准确性，并用无进程、无模型的故障注入验证 UNKNOWN/不匹配、未关闭、必需附件写失败、空 target 转为有效 target 等情况。再由单一集成人运行新隔离 profile、新端口的零调用矩阵，保存 source/exe/runtime 哈希、父子 PID/创建时间/实际路径、启动白名单、真实 token 完整性级别（读不到保持 UNKNOWN）、实际目录、TCP 错误、HTTP/target、测前测后哈希清单和完整收尾结果。之后才按已安装 runtime 和确认权限做单变量对照；不要先归因运行时、改全局策略、重装或反复启动 live runner。

本目录 `result.json` 为本次离线观测；`reproduce.mjs` 可在仓库根用 `node docs/artifacts/2026-10-02-continuation-review/cdp-evidence-audit/reproduce.mjs` 重跑。该脚本所有进程操作均为 mock，不读取密钥，不调用模型，不真实 taskkill。后续源码修复后输出应变化，因此历史 result.json 保留，不覆盖冒充修复后结果。
