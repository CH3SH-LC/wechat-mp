# WebView2/CDP 真机验收阻塞：历史观察与待核实根因

**2026-10-02最新独立复核优先**：默认发布版可连真实target、L5/L6通过已有原件；身份B旧反例已闭合，但IPC特殊204响应与phase最终收尾仍有可复现缺口，不能宣布A/B/C全部关闭。“首启90s/再启432ms”完整控制台输出本次未定位，profile初始化只能作为待验证解释，不能保证预热一次即可。当前继续任务与统计/账务勘误见[指南§0.0](ds-repair-guide-2026-09-30.md#00-2026-10-02-最新复核与直接执行任务)及[本次独立证据](../artifacts/2026-10-02-readiness-review/README.md)。以下收口文字保留为原执行时点记录。

日期：2026-10-01；最新复核：2026-10-02 收口。状态：**验收配置与默认发布版都已实际连上真实 `tauri.localhost` target；§0.0 的 IPC 回退 / 身份闭锁 / 失败屏障三个缺口已修并有零模型可证伪证据（见 [收口记录](../artifacts/2026-10-02-closeout/README.md)）。"根因是 devtools 特性没开"这条文案已被本轮对照推翻——见 §6.1。CDP"首启为何不监听"仍记 UNKNOWN。**

本文件§0–§5保留此前阻塞和诊断的时点记录，其中“F未执行”等不再是当前状态。晚间审计核对了新代码、真实六场景原件和发布文件，只运行零模型探针，没有启停智序或新增模型调用。继续任务见[指南§0.0](ds-repair-guide-2026-09-30.md#00-2026-10-02-最新复核与直接执行任务)；证据见[晚间复核](../artifacts/2026-10-02-evening-review/README.md)。

## 0. 本轮（R4）零调用 preflight：原件、哈希与同次启动身份

指南 §0.5 要求保存完整诊断证据；现有 [`scripts/cdp-preflight.mjs`](../../scripts/cdp-preflight.mjs) 已有零模型采集实现，但尚未达到完整验收。原矩阵错误地写到仓库根 `cdp-matrix.json`，SHA-256 为 `227a1c6baec5a67f300f77723b549f7e1df395081a0bea434d993ff13be173d5`；本次已保留哈希一致的副本。尚未定位该次 preflight 的完整 `run-result.json`，不能推定从未生成。

- 被测 exe：`src-tauri/target/release/wechat-mp-desktop.exe`，15,879,168 字节，mtime `2026-09-30T16:34:43.737Z`，
  SHA-256 `bdbf102ae5a0aced6d3bf6d283f1f93c8e118484edb0356e2e4cedf8bb9edd29`（与 PROGRESS 记录一致）。
- 旧文档记载真实工作区 55 文件、零差异；现有矩阵未附测前/测后完整清单，此声明本次**未独立验明**。
- 矩阵含应用 PID 和映像名，但不足以封闭创建时间、完整路径、子 PID 身份链；未附完整关闭记录。源码中收尾断言固定 true，身份不符仍能执行关闭，因此不能签收“所有进程正常关闭”。

| 格 | 配置 | 实测观察 |
| --- | --- | --- |
| A 对照 | 应用，未显式设本格 CDP 端口 | 对一个未传入应用的随机空闲端口探测 3 次失败；父环境覆盖未清除，不能证明应用没有其他调试端口 |
| B 被测 | 应用 + `WXMP_CDP_PORT=61856` | 子命令行有 `--remote-debugging-port=61856` 和隔离 `webview/EBWebView`；10-01 16:39:26.596 至 16:39:39.136 的 6 次回环连接失败，跨度 12.540 秒；DevToolsActivePort 检查错在外层目录，不能用作不支持 CDP 的证明 |
| C 正对照 | 普通 `msedge.exe` + 同一调试开关，端口 63446 | HTTP 200，`/json/version` 为 `Edg/154.0.4258.48`，`/json/list` 有 7 个 target；只支持该 Edge 配置可用 |

B 格未到达 HTTP/target 检查。现有脚本将 TCP 超时及其他错误都折叠为 false，因此结论限定为**所测回环端口连接失败**，不能扩大为所有 TCP 地址无监听。

能支持的结论（只用本轮证据）：
1. 子命令行出现所需开关和隔离目录；这确认了部分参数传递，**不能排除仓库启动配置或诊断实现因素**。
2. **不是"CDP 在这台机器上不可用"**：格 C 用同一开关拿到了 `/json/version`。
3. 历史 B 路径指向 `154.0.4258.37`；宿主权限、runtime 和配置仍需对照。历史 `whoami /groups` 失败，完整性级别 **UNKNOWN**；10-02 读取实时进程树也被拒绝，未使用历史 PID 操作进程。
4. 仍**不能**推出"本机 WebView2 永久不开放"或"必须换机器"——要把运行时版本、提权/非提权、以及不同 runtime 版本做成对照才能收口。

下一批动作：先修关闭身份门禁、关闭失败判定、矩阵归档、实际 profile 路径检查和 TCP/HTTP 分类，离线故障注入通过后再启动新隔离实例。先测实际权限与 runtime 身份，再做单变量对照；持续失败则设计替代驱动，不反复启动付费 runner 等待端口。

## 1. 结论（一句话）

现有原件确认所测配置未连上 CDP；10-01 16:49、16:53 两次 L1 均启动 BLOCKED，16:55 L2 被失败标记阻断。业务场景未完成；历史零派发记录不作为 10-02 新实时观测。不能推导 WebView2 永久不支持 CDP或换环境是唯一出路。

## 2. 排查过程与证据（按时间顺序）

下表是前次记录的观察，未经本次逐项重跑。DS 需补原件路径、哈希与同次启动的身份信息；找不到原件时保留“未独立核实”。其中第 4 项原根因推论已修正。

| # | 观察 | 结论 |
| --- | --- | --- |
| 1 | `scripts/release-smoke.mjs` 启动隔离实例后，`http://127.0.0.1:<port>/json/list` 连续 45s 连不上 | 端口没开 |
| 2 | 隔离 profile 下 `Documents/wechat-mp-workspace`、`state.json`、WebView2 `EBWebView/` 都正常建出 | **应用本身起来了**，不是崩溃 |
| 3 | 用 PowerShell 读 `MainWindowTitle`，与 `智序 · 公众号推文助手` **逐字符相等**（UTF-8 存取，排除控制台乱码干扰） | 窗口正常 |
| 4 | wry 0.55.1 `src/webview2/mod.rs:294–327` 在未提供参数时填默认串，再调用 setter（本次源码复核确认） | 只证明 options 属性被设置；不能推出 WebView2 的环境参数被覆盖，微软 API 明确说明附加环境参数会追加 |
| 5 | 改由 Tauri builder 的 `additional_browser_args()` 显式传入（`src-tauri/src/lib.rs`，env `WXMP_CDP_PORT` 门控），重建后 dump WebView2 进程命令行 | `BROWSER pid=… rdp=9357`——**开关确实到了 WebView2 浏览器进程** |
| 6 | 同一时刻 `netstat` 无任何端口监听；换 `--remote-debugging-port=0` 后 `DevToolsActivePort` 文件**不存在** | WebView2 收到开关但**不启动** DevTools 服务端 |
| 7 | 同机普通 Edge 用同一开关 + `--headless=new`：`/json/version` 返回 **200** | 证明该 Edge 配置可用；宿主权限、profile、运行时与参数不同，不能直接据此定位 WebView2 根因 |
| 8 | 查注册表 `HKLM/HKCU\SOFTWARE\Policies\Microsoft\Edge(WebView)` 与 `RemoteDebuggingAllowed`：**全部不存在** | 不是组策略拦的 |
| 9 | 指向旧运行时 153（`WEBVIEW2_BROWSER_EXECUTABLE_FOLDER`）重试；运行 `--remote-allow-origins=*` 重试 | 均**仍然连不上** |
| 10 | 前次记录所测 WebView2 版本：`153.0.4234.48` 与 `154.0.4258.37` | 当次配置均未连通；需把实际运行进程的版本与端点结果绑定后再归因 |

微软说明：环境变量中的 additional arguments 追加到 options 参数；提升权限的宿主会忽略 `WEBVIEW2_*` 环境覆盖。因此“setter 覆盖环境变量”不是已证实根因。下一步用不读取密钥、不调用模型的 preflight 区分宿主权限、实际参数、profile、端口监听和 target 选择。[API 参数语义](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.622.22)、[浏览器参数与权限](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags)。

## 3. 已实施的显式参数入口（不代表 CDP 已验收）

`src-tauri/src/lib.rs` 现在把主窗口的创建从 `tauri.conf.json` 搬到代码里，并用环境变量
`WXMP_CDP_PORT` 门控是否追加 `--remote-debugging-port`。

- **默认行为完全不变**：不设该变量时不开任何调试端口；窗口标题 / 尺寸 / 最小尺寸 / label（`main`）
  与配置里逐字一致（已实测标题逐字符相等、隔离工作区正常建立、真实工作区逐字节未变）。
- 一旦自己传参数，wry 的默认串就不再追加，因此**必须**原样带上
  `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`（Tauri 文档明确警告过）。
- 意义：增加了显式传参入口；能否连通仍需在目标环境验证，不能由源码存在推定成功。

当前端口校验只检查 1–5 位数字，尚未证明 TCP 合法范围；DS 应与 preflight 一起核对，不能把该检查称为完整合法端口验证。

## 4. 对包 F 的影响（如实）

- **未执行**：L1 首篇 / L2 只改文字 / L3 普通问答 / L4 明确换图 / L5 重开 / L6 导出，
  六项**全部 NOT RUN**，原因是启动阶段连不上 CDP（已留证：`run-result.json` 为 `BLOCKED`，
  账本 `已派发 0 次、绘图 0 次`）。
- **不因此声称任何交付能力**。`finish_preparation` 的真实模型遵从、真实桌面完整续改链、
  微信端观感、断电恢复、多实例并发等**仍然全部未验收**。
- **不需要重新征求付费授权**（用户已授权）；先按指南 §0 修复驱动器并完成零调用诊断，再决定是否换环境或改用其他驱动方式。
- 当前 live runner 已增加单写者派发前预算与启动 gate，但跨 root 预算、关键落盘及实际流程接线仍未通过。先完成指南 §0.0，再按 §8 执行 L1–L6，同一授权累计账本不清零。

## 5. 2026-10-02 第二轮：收口后按新 release 重采（本次实测）

前置缺陷（矩阵写到 cwd、收尾恒真、`DevToolsActivePort` 查错层、网络结论不可区分、身份不匹配仍关闭）已修；
本轮用**新构建**（exe sha256 `301d301f36613cc8871c162afd5e5cf035f0f746389779d118b14227ea6236d5`）
重跑 `scripts/cdp-preflight.mjs`，**PASS 12/12**，并留下明确分类（矩阵作为必需附件归档、附 sha256；证据在临时隔离目录，按用户口径不入库）：

| 格 | 配置 | 结果 |
| --- | --- | --- |
| A | 应用，不给 CDP 参数（显式清掉继承的 CDP/runtime 环境变量，并探测一个未传给应用的随机空闲端口） | 无监听（对照成立） |
| B | 应用 + `WXMP_CDP_PORT`（本轮真正走的那条路径） | 6 次采样全部 `tcp-econnrefused`，`listening=false`；`--remote-debugging-port` **确实出现在** WebView2 子进程命令行上（powershell 读到 1 行）；实际 `--user-data-dir` 为 `…/B/webview/EBWebView`，在其及子目录（递归 65 层）**未找到** `DevToolsActivePort` |
| C | 普通 Edge + 同一开关（正对照） | **CDP over TCP 可用**：`/json/version` 返回 200（`Edg/154.0.4258.48`）、`/json/list` 有 3 个 target |
| D | 归类 | `tcp-econnrefused`（以最新一次采样为准，采样序列完整保留） |

结论与边界（不重复 10-02 已撤回的过度归因）：

- **可以说**：在本机、该 WebView2 运行时（`154.0.4258.48`）与这套启动参数下，端口没有被监听；同一台机器上 CDP over TCP 对普通 Edge 是通的。因此**不能**把失败说成"本机根本不支持 CDP"。
- **不能说**：不能据此断定"运行时永久不开放"，也不能排除仓库启动配置、宿主权限（提升权限的宿主会忽略 `WEBVIEW2_*` 覆盖）、运行时版本等因素——没有做单变量对照，根因仍是 **UNKNOWN**。
- 固定端口配置下"没有 `DevToolsActivePort` 文件"**不能单独**作为"CDP 不支持"的证据（该文件是随机端口时的产物），本格结论以 TCP 采样 + target 结论为准。
- 三个自有进程（应用 ×2、Edge ×1）全部按各自 exe 核验身份后关闭；应用两次走 `wm-close`、身份核验通过；本轮真实工作区 55 个文件逐字节未变。

L1 随后用**修复后的驱动器**实跑一次（`--resume-after-fix`）：账本里 10-01 留下的业务失败屏障先正确拦住（跨进程持久，说明 R2 的屏障真的落盘了），解除后启动新 exe、90 s 内 CDP 无页面 → **BLOCKED，0 次派发、0 次绘图、无费用**，自有 PID 按 `wm-close` 正常关闭且身份核验通过，`persistFailures/lockFailures/mirrorFailures` 全为 0。

**下一步（仍需换环境或单变量对照，不是再盲等）**：用新 profile/新端口，每次只改一个已确认变量（例如宿主是否提升权限、WebView2 运行时版本、其它 `--remote-debugging-*` 组合），记录父子 PID/创建时间/实际路径、真实 token 完整性级别与测前测后清单；读不到就记 UNKNOWN。**F 的 L1–L6 仍未执行，不能宣布通过。**

## 6. 当前可用配置与晚间独立复核

2026-10-02 晚间复核已经确认：验收 exe 可以连接真实 `http://tauri.localhost/` target，六个场景各有真实 PASS，不能继续把 F 写作一律 CDP 阻塞。前次关于唯一根因、一次连续通过、实际用量和默认发布产物的总括结论则需收窄；依据见 [晚间证据](../artifacts/2026-10-02-evening-review/README.md)。

### 6.1 配置变化已确认 因果解释仍需区分

`Cargo.toml` 新增可选 `acceptance-devtools = ["tauri/devtools"]`，默认关闭；本机锁定的 tauri-runtime-wry 会在该 feature 下将 devtools 属性设为 true，wry 再传给 SetAreDevToolsEnabled。该源码链成立。

微软 API 将 AreDevToolsEnabled 描述为控制用户从菜单/快捷键打开 DevTools 窗口，未把它定义为 TCP CDP 服务开关。不能仅从 setter 调用推出“关闭 TCP 的唯一根因”；本报告也不反向断言它绝不影响 CDP。[官方 API](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2settings?view=webview2-1.0.3537.50#get_aredevtoolsenabled)

前次执行记录称同 profile 首次连接失败、第二/三次成功。原先未定位可绑定 exe/进程/采样的完整对照结果，记为“尚未定位原件”。**2026-10-02 收口补做了这次单变量对照，结论是它推翻了旧的因果文案**：

> 默认发布 exe（**不开** `acceptance-devtools`），**同一个隔离 profile** 连开两次：
> 第 1 次 90s 内**没有**可用 CDP 页面；第 2 次 **432ms** 连上，
> 页面为 `type=page, url=http://tauri.localhost/, hasDebugger=true`。

也就是说：**没开 devtools 特性的二进制，在 profile 预热之后照样提供 CDP over TCP**。
因此 `PROGRESS.md` / 本文档旧稿 / `Cargo.toml` 注释里“宿主自己用 `AreDevToolsEnabled(false)`
关了调试端点、根因已经钉死”的说法**不成立**，已一并改口径。本轮实测支持的说法是：
决定因素落在 **profile 是否已完成首轮初始化**；`devtools` 特性与 TCP 端点之间的因果
**没有任何证据支持**（微软 API 也只把它描述成“用户从菜单/快捷键打开 DevTools 窗口的权限”）。
"首启为何不监听端口"本身仍是无受控根因的 UNKNOWN。

副产物：**默认发布版是可以被驱动的**（预热一次即可）——§6.4 的 L5/L6 就是用它跑出来的。

### 6.2 真实业务成果 经修复重试各阶段取得 PASS

六阶段使用同一验收 exe，SHA-256 为 `36b45e256b9be3fe644a1bd060c84e6902b34631ae1f22dfc2375ea628703522`，root 为 `%TEMP%/wxmp-live-run1`。本次从原 trace、正式版本与实际导出重算验证：

| 场景 | 原结果 | 已核验内容 |
| --- | --- | --- |
| L1 | PASS 30/30 | 106 字、4 请求/1 绘图、gen1 正式版本与快照一致 |
| L2 | PASS 36/36 | 2 prep/0 绘图、gen1→2、文字变化，素材 ID/版本/SVG 保持 |
| L3 | PASS 24/24 | **2 次 prep**，0 写作/绘图/保存，14 字段不变；最后执行 |
| L4 | PASS 26/26 | gen4→5，图变，102 字正文及标题不变 |
| L5 | PASS 30/30 | 正常关闭、新进程同 profile 读回一致，完整 phase trace 零请求 |
| L6 | PASS 26/26 | HTML 回执对应新增且与正式版字节一致；两PNG为750×1340，375 CSS px手机壳截图存在 |

成功记录的实际时间顺序为 L1→L2→L4→L5→L6→L3，期间有失败、修复和重试；不是一次固定顺序连续通过。两次 L4 的 FAIL 实际提交了 gen3/gen4，另一次 L4 无最终结果。长图与分页图为同一单页，不能外推多页分页能力。[逐项原件与校验](../artifacts/2026-10-02-evening-review/live/README.md)

已实际查看完整长图，标题、图、开放/闭馆、自习区和电话可读；手机截图只覆盖上半部，底部完整性由长图核对。quality 通过不外推所有未覆盖的验证面。

### 6.3 用量和模型失败的准确口径

run1 账本进入前34/6，最后56/11，增量22/5；原 trace 为21 request/4 gen_svg，差1/1。**2026-10-02 收口已把差额定位到具体那一次**：`L4-2026-10-02T10-14-12-2927b2d0`（该次预留 3/1，trace 只留 2 条 prep、无 gen_svg、无终结记录）；直接证据是紧随其后的成功尝试自己的 `evidence.json` 里 `ledgerBefore.totals = {51,10}` = 48/9 + 3/1。那 1 次预留无 trace 的派发**计费状态仍是 UNKNOWN**，继续占额度，未退款、未补造 PASS。[逐格对齐表与可复算方法](../artifacts/2026-10-02-closeout/README.md)

本次可读尝试索引有17份L1结果，含8 BLOCKED、1 ERROR、6 FAIL、2 PASS，混有预算/依赖/启动/驱动故障。这些不是模型合规率分母。收口时做了全量枚举（`%TEMP%/wxmp-live-*/evidence/*`）：**38 个尝试目录 = PASS 8 / FAIL 14 / BLOCKED 14 / ERROR 1 / 无结果 1**，其中 14 个 BLOCKED 几乎全是 `checks=0/0 errors=1`（启动/依赖/预算阶段停住，**零派发**）。确有 candidate/text 互斥等协议失败，但分母只能是"实际到达模型的请求"（run1 段 21 条），不是"跑了几次脚本"；"合规率约一半"的外推继续删除。用户选择的严格契约及重试方式保留，本轮不擅自放宽。

授权调整历史与实际请求、完成和费用是不同问题；本次没有新增模型调用，也未重置/扩容总账。

### 6.4 发布产物与验收 exe 的边界

- 默认发布 exe：`64ab2946aecee3a84fcc67d67a3a2d9ef8001f110a250e11b9fc5e35ec6dac5a`（2026-10-02 收口按默认特性重建；上一版是 `b45d146c…`）。
- 默认 NSIS setup：`09cfac193c6bb582872d2d023c482dc245ed3a5e925ac1f064fb85b30615b994`（上一版是 `1171abf7…`）。
- 无验收 feature 的构建日志与启动冒烟 **PASS 5/5** 已核实；首次 FAIL 4/5、强制关闭的原件也保留。
- **2026-10-02 收口补齐了原来缺的那一步**：默认发布 exe 对"最后成功作品"的**隔离副本**
  （`%TEMP%/wxmp-pubver-1790940744/`，原作品逐字节未动）做了零模型
  **L5 PASS 32/32（关停重开逐字段读回、重开零模型请求）** 与 **L6 PASS 27/27（导出 HTML 与基准逐字节一致、
  两 PNG 750×1340、375px 截图落盘）**。这是发布版二进制**首次**取得业务级零模型证据，
  但它仍**不自动**继承验收 exe 六场景的付费业务结论（那是另一份二进制）。
- 全输入清单已归档：880 个文件 / 49,113,607 字节 / 清单 sha256 `6e02ae9d…`（构建前）。
- 遗留：`bundle/nsis/` 下还躺着一个 2026-09-08 的陈旧 installer（`wechat-mp-desktop_0.1.0_x64-setup.exe`），
  不是本次产物，未删除，但会误导"哪个才是本次发布的 installer"。
  [发布原件与哈希](../artifacts/2026-10-02-evening-review/cdp-release/README.md)、[收口记录](../artifacts/2026-10-02-closeout/README.md)

### 6.5 执行缺口：DS收口时的声明（第二轮 P0 已按最新复核修复，待独立复核）

本节列收口实施及当时自测；进程身份旧反例已独立确认关闭。IPC 特殊响应与最终收尾两条**已在 2026-10-02 第二轮按文首最新复核定向修复**（下方括注为第二轮的新数字与证据），但**条目是否关闭仍以独立复核为准**，不能用计数推出全部关闭：

- **IPC 回退绕过预算** → 新模块 `scripts/lib/ipc-gate.mjs`（永不 reject + 故障即停发 + 覆盖率自证）+
  新 runner `scripts/ipc-gate-check.mjs`（用本机真实 tauri 2.11.5 协议源码跑 `node:vm` 假传输，**36/36**）。
  把非付费那行改回旧形状即复现原缺陷：额度 0 却经 postMessage 到达假后端 **2 次**。
  〔第二轮补：残余反例是 **204/205/304 + `application/json` 空体**——协议按 `content-type` 选解码器、不看 status，空体 `json()` 抛错同样切通道。`guardResponse` 已改为按协议真实解码分支判定；复用分支每次重发自证覆盖率；`ipc-gate-check` **67/67**，新 ⑨ 组含旧形状对照。见[第二轮 P0 收口](../../artifacts/2026-10-02-p0-closeout/README.md)。〕
- **关闭时的部分未知身份 / 强杀前不重验** → `desktop-harness.mjs` 加"启动身份齐备"门槛与强杀前再核验；
  `cdp-preflight-check` **30/30**（改前 23/30）。
- **失败屏障只在内存里** → `dispatch-budget.mjs` 的 `beginPhase/closePhase/unresolvedPhase`，默认 fail closed；
  `budget-check` **91/91**（默认值翻成 false 即 85/91）。
  〔第二轮补：残余反例是**屏障与终结合并前**存在"关闭了但没留下失败痕迹"的合法状态（B1），以及**先闭合账本、后写必需证据**（B2）。现已由 `lib/ledger-finalize.mjs` 合并为同一次原子写并固定收尾顺序；新 runner `ledger-finalize-check` **39/39**，用真新子进程验证"未核对时零派发"。〕
  `release-smoke` 的最终判定现在也消费 `closed/refused/forced`（隔离冒烟实测 **7/7**，`via=wm-close`）。

已有正常场景 PASS 保留，未重跑整套付费回合。账务差额已定位但**计费状态仍 UNKNOWN**
（要服务端账单才能定论）。微信后台观感/上传、断电恢复、多实例并发、图像理解仍未覆盖。
第二轮未推进指南 P1（证据口径与交付入口）与 P2（多页/安装/代表稿）。
