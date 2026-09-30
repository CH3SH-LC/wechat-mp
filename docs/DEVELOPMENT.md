# 开发、验证与打包

## 环境与启动

在仓库根目录执行。需要 Node.js ≥ 20、pnpm、Rust stable、Windows 10/11、WebView2 及 Rust/MSVC 对应构建工具。

```powershell
pnpm install
pnpm dev
pnpm tauri dev
```

`pnpm dev` 为浏览器 mock，对话不调用真实模型；`pnpm tauri dev` 启动桌面应用。Vite 使用 1420 端口。

## 配置

- 桌面密钥顺序：`DEEPSEEK_API_KEY` → 工作区 `settings.json` → `~/.dsh/.credentials.yaml` 兼容回退（可选，应用不依赖 DSH）。
- 端点：环境变量 `DEEPSEEK_BASE_URL` 优先于应用设置，默认 `https://api.deepseek.com`。
- **网络超时**（修复计划阶段 4，可环境变量覆盖）：连接 15 秒（`DEEPSEEK_CONNECT_TIMEOUT`）作用于所有请求；单次非流式请求总超时 180 秒（`DEEPSEEK_NONSTREAM_TIMEOUT`）作用于绘图 / 补描述 / prep / 视觉复核。**流式对话不设总超时**——写长文可能持续数分钟，掐总时长会杀掉正常创作，它只受连接超时约束。
- **非流式输出上限**：**默认取模型自己声明的上限**（应用启动后查一次 `GET /models`，按「端点+模型」缓存）。实测 `deepseek-flash` 为 `max_output_tokens = 393216`（上下文窗口 1048576）。查询失败时退回 32000（已验证可用）。`DEEPSEEK_NONSTREAM_MAX_TOKENS` 可覆盖，但仍会被模型上限钳制。
  - **别调低**：上限 8000 时绘图请求会 `finish_reason: length` + `completion` 用满 8000 + 正文为空（推理开销先吃光预算），一次成功绘制实际需要约 1.9 万 token。
  - **也别调高过模型上限**：实测 `max_tokens=400000` → `Invalid max_tokens value, the valid range is [1, 393216]`，而 400 属于不重试的 `auth` 类，整次请求直接失败。
  - 推理档位固定 `high`（`NONSTREAM_EFFORT`）：实测降到 `low` 会让 4/4 全部出现"元素跑出画布"，而耗时只快约 15%。
- **取消**：前端"停止"会调用 `cancel_run(runId)` 让后端立刻停止等待；流式事件带 runId，旧回合的迟到增量会被丢弃。只保证本地停止等待与后续处理，**不承诺服务端已停止计费**。
- **准备阶段契约**（DS 修复指南 §5，2026-09-29）：桌面每个回合先走一次非流式准备请求，模型用终结工具 `finish_preparation({outcome})` 声明本回合是 `reply`（答复/澄清，不提交文稿）、`compose`（交系统撰写）还是 `candidate`（自己已写好完整 v2 正文），并用 `assetPolicy`（`preserve`/`modify`）声明素材是否变动。总额预算 3 次请求（知识取用、空回复重试、协议纠偏共用）；旧协议（只回 `READY`、或只贴一段完整 v2）在**已具备创作操作契约**时先纠偏一次、仍无结构化结果才做受测的兼容转换，并打 `legacyCompat` 标。网络/鉴权/协议失败与预算耗尽**明确报错并保留旧成品**，不再降级成"直接撰写"。`PREP_EVERY_TURN`（`src/App.tsx`）置 `false` 可退回"只在创作请求/创作态提供工具"。
- 素材并发与预算（前端，可环境变量覆盖，构建时读取）：`VITE_DRAW_CONCURRENCY`（默认 2）、`VITE_SLOT_BUDGET_MS`（单素材位累计预算，默认 240000）。
- **模型临时锁定**（用户 2026-09-24 要求）：创作与对话、素材绘制、视觉复核**三路一律使用 `deepseek-flash`**，`DEEPSEEK_MODEL` / `DEEPSEEK_IMAGE_MODEL` / `DEEPSEEK_VISION_MODEL` 与应用设置里的其它模型名都会被忽略。设置面板把模型输入框置灰并显示锁定模型名（2026-09-28 随界面小字清理移除了原解释文字，锁定行为未变）。恢复可配置：把 [chat.rs](../src-tauri/src/chat.rs) 里的 `LOCKED_MODEL` 改回 `None`（一处改动，无需动别处）。
- 视觉复核（看图选素材）默认关闭，可在设置里打开；开启后按上面的锁定模型调用。准确请求参数以 [chat.rs](../src-tauri/src/chat.rs) 为准。
- 浏览器设置存 localStorage；桌面数据存本机 `Documents/wechat-mp-workspace/` 下。不要提交 settings.json 或真实凭据。

## 验证入口

```powershell
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
node scripts/compose-check.mjs
node scripts/asset-resolve-check.mjs
node scripts/svg-quality-check.mjs
node scripts/progress-check.mjs
node scripts/trace-check.mjs
node scripts/raster-check.mjs
node scripts/fixture-repair.mjs
node scripts/delivery-quality-check.mjs
node scripts/photo-swallow-check.mjs
node scripts/asset-completion-check.mjs
node scripts/repair-integrity-check.mjs
node scripts/repair-flow-check.mjs
node scripts/prep-contract-check.mjs
node scripts/preview-resource-check.mjs
node scripts/verify-ui.mjs
node scripts/live-conformance.mjs
node scripts/live-three-samples.mjs 1   # 真机三小样：见下方说明，需先起应用
```

- `pnpm build`：类型检查与前端构建。
- Rust 单测：本地逻辑验证；带 `--ignored` 的 live 测试需要真实 API 与密钥，按变更选择执行。
- `compose-check`：排版引擎样例断言；默认产物在 `docs/artifacts/`。
- `asset-resolve-check`：素材复用判定、角饰别名、强制新建、分类校验与快照登记的离线断言（用内存 localStorage 桩，不调模型）；末尾还重放 `scripts/fixtures/2026-09-28-basement/` 的真实失败样例（中文分类引用 + 三枚纯文字旧角饰块），断言四枚已有素材恢复绑定且 **0 次绘图**。
- `svg-quality-check`：素材 SVG 确定性质检断言（画布外/不可见元素被拒、大图不退化、按角色门槛）。
- `progress-check`：工作气泡的展示文案断言（阶段标签映射、耗时格式化边界、工具调用文案、已删死代码不得复活）。纯函数，不碰 DOM、不调模型。
- `trace-check`：请求追踪与素材预算断言。把 Tauri 通道桩进 `window` 让真实 `image-agent` 走桌面分支，逐个注入**网络错误 / 空内容 / 无 SVG / 质检拒绝 / 取消**五类故障，验证五类结果可区分、尝试次数受台账预算约束（取消与鉴权不重试）、同一素材位跨三轮只画一次；并断言阶段 4 的**有界并发**（峰值 ≤2、结果仍按原素材位顺序）、**相同输入共享在途任务**、**超时到点返回**、**取消后不再派发与入库**；最后交叉比对前端 `FailureClass` 与 Rust `FAILURE_CLASSES` 的词表。全程离线，不调模型。
- `raster-check`：素材"真实显示尺寸"栅格检查的**校准与断言**。从已启动的 dev server 动态 import 真实 `svg-raster.ts`，把样例 SVG 真画到 canvas 上（node 没有 canvas），在 **60px 宽、白底**下打印主体像素/对比度/对比度 P90/右下占比实测表，并断言合格样例通过、"浅色消失"与"缩成一个点"被拦下。真实库素材（bud/star/四叶草）只记录数值不判定——库素材不经过本层复检，不会被重画。
- `fixture-repair`：从 `scripts/fixtures/2026-09-28-basement/` 的真实失败样例产出**修复副本**（源文 + 375px 可直接打开的 HTML）与前后对比报告，写到 `docs/artifacts/2026-09-28-repair/`。**只读**真实作品目录、不覆盖原稿、不联网不调模型。
- `delivery-quality-check`：交付门禁的离线断言。核心是"**不能有旁路**"——只有 `checkHtml` 失败也照样进统一门禁；**有 6 张图但仍有源码泄漏**也照样阻断（不依赖"零图"这种巧合条件）；素材被拒收要能定位回 slotId，定位不到要如实记"无法定位"而不是丢弃；短篇提示/推荐性组件不阻断；正文完整性要能指出**具体丢了哪一段、哪个事实**（不是只给一个布尔）。
- `photo-swallow-check`：2026-09-29 真实故障（照片位把后续段落与 `::: art` 素材块吞进自己的"说明"，再转义成可见文字）的回归。`--prove-red` 会从 git 取**修复前**的 `compose.ts` 到临时目录跑一遍先证红（实测 10 条红），日常跑法对当前工作区要求全绿；每次运行都记录被测文件的内容哈希，证据钉在具体版本上。用例 ⑥ 直接跑**真实最新稿的整份只读副本**（`fixtures/2026-09-29-photo-swallow/real-full-source.md`）。
- `asset-completion-check`：素材完成状态的离线断言（计划 §6）。①排版层拒收的素材位要从 `ok` 降级为 `failed` 且理由来自排版层；②比对不上素材位的拒收要产出"无法定位"诊断而不是静默丢弃；③**复用路径也要过与新绘一致的适用门禁**（该路径此前完全没有门禁）；④自动流程不得重置用户没点过的素材位预算。
- `repair-integrity-check`：**自动修复的事实保护**纯函数回归（DS 修复指南 包 B）。①事实规范化：`8 点 30 分`/`08:30`/`8:30` 同一时刻、`18:30` 不是、电话分隔符差异可规范而**尾号追加必须拦**、带年份与丢年份不等价、姓名不把虚词当名字；②正反对照：删句外/句中 emoji 且事实全留 → 可通过，逐一删日期/时间/地点/姓名/人数 → 阻断并指到具体 kind；③正文投影：SVG 属性/坐标/行内代码/系统拒收占位不进正文比较，而**转义后的泄漏 SVG 仍在投影里**（交给泄漏检查）；④口径一致：`body.ok`、问题清单、`gate.bodyIntegrityOk`、总判定同源，"该比却比不了"必须阻断。默认写入独立日期目录，`--out` 可指定。
- `repair-flow-check`：**真实 App** 上的自动修复事实保护回归（需先起 dev server）。只替换 `sendChatMock` 这一段模型输出，质量判定/候选循环/落库全走生产实现。两组正反对照：①丢事实的修订稿**不得**被标成成品；②只删 emoji、事实全留的修订稿**必须**被接受；两组都断言 trace 里出现 `bodyApplicability='applied'`（证明 App 真的接上了比较，而不是纯函数自说自话）、全程无外链请求与页面异常。输出目录与 URL 由前两个参数指定。
- `prep-contract-check`：**准备阶段结果契约**回归（需先起 dev server）。打的是真实 `runPrep`，只 stub Rust 侧 `prep_turn` 的返回，不走浏览器 `mode:'skip'`。覆盖合法 `reply/compose/candidate` 三分支、F2（`说明 + 换行 + READY`）与 F3（含完整 v2 的回复）在具备创作操作契约时不再丢稿、普通答疑里出现 READY 或 v2 示例**一律不提交**、终结参数非法/多个终结工具 → 明确 `protocol` 失败、空回复连续三轮 → `exhausted`，并断言**不发生第 4 次准备请求**。
- `preview-resource-check`：**预览全过程外链检查**（需先起 dev server）。从发送前开始记录**所有**请求（含重试、redirect、srcset、CSS `url()`），断言未经许可的外链尝试为 0；同时断言原始违规证据仍进了门禁（trace 里有 `html.*` 问题码），避免"靠把外链洗掉变绿"。对精确 URL 提供**本地固定响应**消除公网依赖；测试 route 只是防意外联网并计数，不因为它拦住了请求就把产品判为通过。另含 `preview-safe.ts` 的纯函数边界（`data:` 图不动、协议相对 `//host` 也算外链、`srcset` 只剔外链项）。
- `verify-ui`：需先启动浏览器开发服务，默认 `http://127.0.0.1:1420`；覆盖 S1–S25（S19 保存失败契约、S20 生成中导出禁用、S21 会话改名、**S22 草稿/成品标识与完整版本回退**——同一会话先出一版成品、再出一版过不了门禁的稿子，断言预览回到上一版成品、落盘文档与源文都没被换掉、草稿取回入口出现；**S23 无已验收历史时的失败交付**——必须是 `draft-failed` 而不是凭空 `restored`，且草稿可取回；**S24 取消不覆盖已有成品**——流中点停止后落盘 source/版本一字未变，并有“同一提示语不取消就会换稿”的反向对照；**S25 375px 预览逐项断言**——壳宽 375、正文节点数、素材图全部为 `data:`/`blob:`、可见文本无协议泄漏）。当前 **133 PASS / 0 FAIL**。截图默认写入**独立日期目录** `docs/artifacts/<当天日期>-e2e/`（首个参数可覆盖目录、第二个参数可覆盖 URL），不再写进 `docs/artifacts/` 根目录——那里的旧图是发布阶段配图与历史证据，脚本按固定文件名落盘会直接覆盖它们。
  - Playwright 模块与 Chromium 的解析顺序：先试 `require('playwright')`，再读环境变量 `VERIFY_PLAYWRIGHT`（模块路径）与 `VERIFY_CHROMIUM`（可执行文件路径）。**两条都拿不到时明确报错并以 exit 2 退出，不会静默跳过**——"因为找不到浏览器所以跳过"是最危险的假绿。本仓库未声明 playwright 依赖，本机需要显式给路径：

```powershell
$env:VERIFY_PLAYWRIGHT="D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright"
$env:VERIFY_CHROMIUM="C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe"
node scripts/verify-ui.mjs
```
  - `raster-check` 同样读这两个环境变量。
- `live-three-samples`：**真机**三小样验收（真实桌面应用 + 真实模型 + 真实 DeepSeek 接口），会消耗 API 额度。桌面端跑在 WebView2 上，加调试端口后 Playwright 经 CDP 直连它的 webview，点真实按钮、走真实编排、调真实 Rust 命令。**务必隔离工作区**：

```powershell
# 终端 1：换 USERPROFILE 指向临时目录（否则会写进真实作品目录），并开调试端口
$env:USERPROFILE="C:\Temp\wxmp-live"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
.\src-tauri\target\release\wechat-mp-desktop.exe

# 终端 2：题号 1/2/3；③ 要在 ①/② 产出的会话上跑
$env:WXMP_HOME="C:\Temp\wxmp-live"
node scripts/live-three-samples.mjs 1
```

跑完请删除临时目录（里面为连通凭据可能放了副本）。证据看 `<临时工作区>/traces/<runId>.jsonl`。

**这条隔离是硬性的，不是"建议"**：2026-09-29 有一次子任务没设 `USERPROFILE`，直接启动了真实应用并跑了一个创作回合，
真实工作区因此多出 3 枚素材、2 个会话被改写，还消耗了真实 API 额度——而那些记录无法还原成"原本没有"。
起应用前先确认：**进程的 `USERPROFILE` 与脚本的 `WXMP_HOME` 都指向临时目录**；
跑完核对真实工作区的会话/文档/素材计数与 `traces/` 是否与开工前一致。
- `live-conformance`：真实模型合规场景 A/B/C，需要网络与密钥，不能用 mock 结果替代。
- `live-knowledge-probe` / `live-style-choice` 为旧实验脚本，使用兼容注入方式和机器路径，不作为当前桌面主链路验收；`compose-cli` 为手动渲染工具。

2026-09-24 文档整理只验证文档、引用及受保护文件完整性，没有重跑上述应用验收。历史测试数量见 [发布说明](../RELEASE-NOTES.md)，不得作为本次通过数量。

模型默认值仅为源码配置，不代表本轮验证了服务端可用性。桌面数据目录由用户主目录拼接 Documents 得到，系统目录重定向尚需验证。

建议将新验证产物写入独立日期目录；compose-check 与 verify-ui 均支持首个参数指定输出目录（verify-ui 会自行创建目录，compose-check 需先建），不要覆盖历史失败证据。仓库只保留文档实际引用的代表样例。

## 打包

```powershell
pnpm tauri build --bundles nsis
```

安装包在 `src-tauri/target/release/bundle/nsis/`；安装资源包含 [使用手册](../src-tauri/resources/使用手册.html)。代码变更必须重建 release 并启动冒烟，见 [永久约束](../REQUIREMENTS.md)。

**重建前先确认没有正在运行的实例**：`wechat-mp-desktop.exe` 在运行时会锁住目标文件，`cargo` 会在
`failed to remove … .exe / 拒绝访问 (os error 5)` 处失败。先请使用者关闭应用，或用
`taskkill /PID <pid> /T /F` 结束该进程树（**只结束本应用自己的进程**，不要动其它程序）。

## 运行痕迹（业务追踪日志）

桌面端把每次创作回合的请求证据写到 `<workspace>/traces/<runId>.jsonl`（与作品数据同处
`Documents/wechat-mp-workspace/`，但属于运行痕迹）。内容与边界：

- 记什么：阶段 / 模型 / 起止墙钟与**单调耗时** / 尝试序号 / 返回长度 / `finish_reason` / `usage`
  （服务返回时）/ 失败分类 / 质检拒绝原因 / 素材位决策（复用·新建·拒绝·恢复·失败）与素材 ID。
- **不记**：密钥、完整请求正文、参考图片；错误只留截断后的分类文案。
- 上限：单文件 512 KB，目录内保留最近 60 个回合，超出按修改时间淘汰。
- 写盘失败**不阻塞创作**：命令恒返回 Ok，前端 sink 抛错也被吞掉。
- 界面只显示有用的进度与失败反馈，不把这些技术细节当小字铺在界面上。
