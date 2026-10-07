# 项目结构

更新：2026-10-02 最新复核（真实成果、驱动器边界与交付任务）。本文维护模块位置；使用方式见 [开发指南](docs/DEVELOPMENT.md)，完整文档入口见 [文档导航](docs/README.md)。

## 顶层

`docs/design/ds-five-workers-guide-2026-10-07.md`：DS 五并发操作入口，包含五路任务、文件所有权、动态接续、串行集成、真实小样与独立签收。

`docs/artifacts/2026-10-07-five-workers/<run-id>/`：五并发执行的**每轮唯一产物目录**——`coord/`（父协调者的 `baseline.md` 基线、`ledger-baseline.md` 账本与屏障快照、`decisions.md` 裁决、`freeze.md` 候选冻结与回归、`real-samples.md` 真实补测、`final.md` 最终交付）、`A/`–`E/` 五路各自证据。**每轮新 run-id，不覆盖历史目录**。

`docs/research/2026-10-03-strategy/`：未来方向专项，README综合计划、product-direction产品定位、retrospective错误与返工、engineering-plan技术与验收取舍、ds-operating-model调度与派单规则；研究建议不冒充功能实现。

续研新增grounding-deep-dive材料依据真实入口、pagination-deep-dive安全分页、ds-throughput-deep-dive耗时与调度、delivery-experiment实际交付实验、next-ds-task当前五字段派单；verification保存本轮IPC/ledger定向复核原件及边界，pagination-review-20261003-0116保存真实compose装饰叶子离线探针。

```text
wechat-mp-desktop/
├── CLAUDE.md                 协作规则
├── GOAL.md                   项目目标、范围与完成标准
├── README.md                 产品与安装入口
├── REQUIREMENTS.md           当前需求、约束与待办
├── PROGRESS.md               近期详细变更与里程碑
├── PROGRESS-LITE.md          近期一句话摘要
├── STRUCTURE.md              模块地图
├── RELEASE-NOTES.md          版本发布记录
├── docs/
│   ├── README.md             文档导航与维护约定
│   ├── DEVELOPMENT.md        开发、验证、打包
│   ├── ai-context/README.md  提示词和知识注入源码索引
│   ├── design/docs-assets.md V3 决策及实现差异
│   │   working-bubble.md 「AI 工作中」气泡的决策与阶段口径
│   │   repair-2026-09-28-batch1.md 素材复用故障的根因、修复口径与分批安排（批次一）
│   │   repair-2026-09-28-batch2.md 等待控制、实际尺寸视觉检查与真机三小样验收（批次二）
│   │   repair-2026-09-29-full.md 输出上限与推理档位的实测口径（查服务端而非猜）
│   │   quality-recovery-plan-2026-09-29.md 最新稿源码泄漏与自动修复、完整版本回滚方案（A–E 五批已实施，含两处口径裁决）
│   │   ds-repair-guide-2026-09-29.md 第一轮任务与实施时点记录（整体关闭结论已被第二轮复测更新）
│   │   ds-repair-guide-2026-09-30.md 当前 DS 执行指南：复测缺口修复、回归、发布及已授权的少量真实模型验收
│   │   webview2-cdp-and-live-acceptance-2026-10-01.md CDP 历史阻塞观察与待核实根因，继续诊断见指南 §0
│   │   improvement-review-2026-09-24.md 体验与素材问题调查建议（P0/P1/P2 已实施）
│   ├── maintenance/          文档整理范围、证据与恢复说明
│   └── artifacts/            发布期配图、排版样例、按日期归档的运行证据（2026-09-24/ 2026-09-28-repair/ 2026-09-29-e2e/ 2026-09-29-e2e-final/ 2026-09-29-photo-swallow/ 2026-09-29-capability-review/ 2026-09-29-repair-integrity/ 2026-09-29-repair-flow/ 2026-09-29-prep-contract/ 2026-09-29-preview-resource/）、README.md
├── src/                      React 前端与运行时知识库
├── src-tauri/                Rust 后端、配置与安装资源
├── scripts/                  验证与手动渲染脚本
├── public/                   静态资源
├── index.html                页面入口
├── package.json              前端依赖与命令
├── pnpm-lock.yaml            依赖锁定
├── pnpm-workspace.yaml       构建许可
├── tsconfig*.json            TypeScript 配置
└── vite.config.ts            Vite 配置
```

`.git/`、`.vscode/` 为仓库/编辑器配置；`node_modules/`、`dist/`、`src-tauri/target/` 为本地依赖或构建产物。

`docs/artifacts/2026-09-30-ds-audit/` 新增第二轮审计精选副本：README、evidence-index、regression-inputs、总审计、facts/prep/preview 三专项及日志/截图。39 份原件副本按 SHA-256 校验；不是下一轮修复通过产物，内含调查脚本禁止原地运行。

`docs/artifacts/2026-10-01-continuation-audit/` 为继续任务独立复核：`README.md` 索引、`persistence/` 共享判定器写盘失败反例、`live-runner-offline-probe/` 正式 live runner 原函数提取探针及冻结结果。均为离线调查，探针复现成功不代表产品通过；再次运行使用新目录。

`docs/artifacts/2026-10-02-continuation-review/` 为最新复核：README、源码指纹、预算/主流程/CDP 三专项、compose/delivery/负向复跑与历史 L1/L2/矩阵副本及哈希。当前继续任务在原指南 §0.0；不在冻结证据目录重跑并覆盖结果。仓库根 `cdp-matrix.json` 是已有 preflight 落错目录的历史原件，未当作正式输出入口，也未删除。

`docs/artifacts/2026-10-02-evening-review/` 为晚间复核：预算/IPC、live原件、CDP/发布三专项、当前离线回归、34个历史尝试索引、原件哈希与实际成品副本；源码指纹和证据索引分别保存。当前执行入口仍为DS指南§0.0，午间证据保留。

`docs/artifacts/2026-10-02-closeout/` 为 §0.0 收口执行记录（**只有 Markdown**，大件原件按仓库口径不入库）：A/B/C 三个缺口的修法、变异证红/转绿证据、账务 1/1 差额的逐格对齐表与直接证据、38 个尝试目录的分母、发布版 exe 的 L5/L6 零模型签收、以及推翻旧 CDP 根因文案的那次对照。原件根目录写在文首（`%TEMP%/wxmp-closeout-*`、`%TEMP%/wxmp-pubver-*`）。

## 前端模块

`docs/artifacts/2026-10-02-readiness-review/` 为最新独立复核：README、21个源码指纹、budget/（特殊IPC与收尾反例）、live/（默认版L5/L6与清单重算）、cdp-release/（身份修复与发布原件）、live-driver/本次结果，以及验证/证据索引；均不覆盖历史证据。当前任务仍为DS指南§0.0，核心修复后推进多页与交付。

`docs/artifacts/2026-10-02-r8-real-acceptance/` 为真实模型验收的执行记录（**只有 Markdown**，大件原件按仓库口径不入库）：默认发布版 exe 在同一隔离 root 上 L1–L6 的结果表、过程中两次真实失败（模型耗尽 prep 预算不声明 / 同条回复混用工具）的根因与修法、`prep-contract-check` 的证红变异、两次重建与最终 exe 上重跑整套的口径、以及如实记录的两处不完美（L5 一次强杀收尾偶发、提醒无法证明为通过的决定因素）。原件在 `%TEMP%/wxmp-live-r6-*`（失败）、`-r7-*`（失败）、`-r8-*`（最终通过）。

`docs/artifacts/2026-10-02-p2-delivery/` 为用户交付面（P1/P2）的记录：多页导出的核对表与页边界切口清单（含未覆盖的"带图多页"及其原因）、安装交付事实（当前中文包路径/哈希、被测 exe、数据位置、6 步隔离清单、**安装 NOT RUN** 的条件、手册旧安装名的差异）、公众号后台人工核对清单（NOT RUN）、以及 P1 的证据口径修订（尝试分母 41、1/1 差额的归因边界、待验证解释）。新增的长文代表稿 L7/L8 结果也在其中（原件 `%TEMP%/wxmp-live-r10-*`）。

`docs/artifacts/2026-10-02-p0-closeout/` 为第二轮 P0 收口的执行记录（**只有 Markdown**，大件原件按仓库口径不入库）：P0-A（204/205/304 空体 json 绕过预算）与 P0-C（B1 失败屏障两写、B2 先闭合后写证据）两条的修法、逐条**旧形状对照**（复现复核记录的反例）、真新子进程门槛验证、以及本轮全量零模型回归清单。原件根目录写在文首；P1/P2 未推进。

`docs/artifacts/2026-10-03-f1-grounding/` 为 F1「全入口遵守材料依据边界」的交付记录（**只有 Markdown**）：`baseline.md`（开工前冻结的 commit / dirty 文件 / 产品哈希 / L7-L8 原件哈希）、`samples.md`（**开工前**冻结的 G1/G2/G3 样本卡）、`README.md`（改动清单与改后哈希、真实 App 实参截获的红绿对照、G1 逐句判定表、G2b/G3 的离线可证部分、回归清单、以及**未覆盖**项）。runner 产出的 JSON 原件在 `%TEMP%/wxmp-f1-{baseline,after,mutation}`，按仓库口径不入库。

| 路径（src/ 下） | 职责 |
| --- | --- |
| main.tsx、App.tsx、App.css | 入口、工作区/回合编排和样式 |
| components/ChatPane.tsx、WorkingBubble.tsx、PreviewPane.tsx、SessionRail.tsx | 对话、AI 工作中气泡（阶段标签+细节+计时）、375px 预览（四态标识：成品/已恢复上一版/草稿未通过/修复中 + 独立草稿导出入口）、会话侧栏 |
| components/DocsPane.tsx、AssetWorkshop.tsx、SettingsPanel.tsx | 文档库、素材工坊、设置 |
| lib/persona.ts、prep.ts、retrieval.ts、needs.ts、chat.ts | 系统提示、工具准备、知识读取、请求判断与双通道对话 |
| lib/compose.ts、palettes.ts、artRender.ts、quality.ts | 排版、色板、SVG 渲染与质量检查；compose 返回**结构化解析问题**（稳定 code + 源文行范围）、被质检拒收的素材块（`issues` / `rejectedArts`）以及**作者节点**（`authorUnits`：作者可见文本 + 源文行号，由 `emit` 元信息直接产出，供正文投影与事实保护用；见 `projectionOf` 的三态） |
| lib/delivery-quality.ts | 交付门禁：把解析/素材/栅格/HTML/正文完整性+容量+版本汇成一条问题清单，输出 `DeliveryVerdict`（阻断项为 0 才允许提交成品）；`bodyIntegrity` 按**规范化事实**（`kind\\|canon`）比对并给出具体丢失片段，`bodyText()` 提供正文投影（剔 SVG/行内代码/拒收占位）；`BodyApplicability` 三态显式区分"已比 / 不适用 / 比不了" |
| lib/extract.ts、revise.ts | 提取成稿、归一叠稿和自动修订 |
| lib/image-agent.ts、asset-agent.ts、asset-library.ts、asset-categories.ts | 素材解析复用与有界并发绘制（阶段 4：最多 2 个并发、同输入共享在途、位预算 240s）、制作与库操作；分类表（零依赖纯数据，解析层与工坊共用） |
| lib/asset-resolve.ts、asset-ledger.ts、svg-quality.ts、svg-raster.ts | 引用解析与复用判定、一轮创作的素材结果表（成败/预算/指纹）、素材 SVG 确定性质检（解析层 / 按真实显示尺寸的栅格层） |
| lib/trace.ts、vision.ts、progress.ts、preview-pick.ts、preview-safe.ts | 请求证据与失败分类（纯函数层）、视觉复核（限次与缓存）、任务阶段事件与展示文案、预览组件拾取、**预览显示层的外部资源抑制**（纯函数 `neutralizeExternalResources`：把外链 src/href/srcset/CSS url() 换成内联占位；门禁与导出仍用原始 HTML） |
| lib/documents.ts、sessions.ts、settings.ts | 文档、会话和设置持久化（读失败与"为空"**区分**返回：`{ok:…}` / boolean，界面据此给失败态 + 重试） |
| lib/exportHtml.ts、exportImages.ts、htmlToImage.ts | HTML/图片导出 |
| knowledge/ | 文本、视觉、插图、其它及排版引擎协议；应用运行时加载，非历史文档 |

## 桌面后端（src-tauri/ 下）

- `src/main.rs` / `src/lib.rs`：启动、命令注册与状态管理；**主窗口在这里创建**（`tauri.conf.json` 的 `app.windows` 已置空），以便在环境变量 `WXMP_CDP_PORT` 存在时把 `--remote-debugging-port` 交给 wry——默认不设时行为与配置窗口完全一致（标题/尺寸/label 逐字相同）。原因见 [WebView2 与真机验收](docs/design/webview2-cdp-and-live-acceptance-2026-10-01.md)。
- `src/chat.rs`：DeepSeek SSE（含消息线上形态 `to_wire`/`build_messages`、回合预算）、prep、图像生成及补充说明、视觉复核；**模型真实上限运行时查询与缓存**（`GET /models`）、网络超时、每个模型调用都写一条请求证据；`tests::fake` 是可控假 HTTP 服务（延迟/超时/错误/取消/上限的离线测试）。
- `src/documents.rs`：文档存储——**不可变版本目录 + 提交指针**（`documents/<docId>/{manifest.json, revisions/<revisionId>/{source.md,article.html,meta.json}, staging/<transactionId>/}`；写 staging → 校验 → 目录整体改名安装 → 一次 rename 提交指针；旧三文件布局迁移为 `revisions/legacy`）。命令：`list_documents`（`items` + `unreadable`）、`open_document`、`save_document`、`delete_document`、`list_document_revisions`、`open_document_revision`、`commit_document_revision`。
- `src/assets.rs` / `src/sessions.rs` / `src/settings.rs`：本地数据域；列表读取**如实区分"读不出来"**（`unreadable` / `state_warning` / `scan_warning` / `load_error`），不再把 IO 失败折叠成"不存在"。
- `src/cancel.rs`：运行取消句柄（按 runId 的 `watch` 信号、`run_cancellable` 包装、`cancel_run`/`cancel_reset` 命令）。
- `src/trace.rs`：业务追踪日志（按回合独立 JSONL、轮转与大小上限、失败分类词表、单调时钟计时）。
- `src/export.rs` / `src/manual.rs`：导出文件与打开手册。
- `src/publish.rs`：旧草稿发布兼容逻辑，命令仍注册，当前界面入口停用。
- `resources/使用手册.html`：安装包内置用户教程。
- `tauri.conf.json`、`capabilities/`、`icons/`、`Cargo.toml`、`Cargo.lock`、`build.rs`：打包、安全能力、图标、依赖与构建。

## scripts/

- **验收专用构建开关**（`src-tauri/Cargo.toml`）：`acceptance-devtools = ["tauri/devtools"]`——**默认关闭**，发布产物行为与体积不变。它原来被当成"CDP 连不上"的根因，**该结论已被 2026-10-02 收口的单变量对照推翻**：不开该特性的默认发布 exe 在同一 profile 预热后 **432ms** 就能连上（首启 90s 无页面）。实测支持的因素是 **profile 首轮初始化**；特性本身与 TCP 端点之间没有证据。特性与验收 exe 继续保留（工作正常），但不再是"能不能连上"的解释。详见 [CDP 记录 §6.1](docs/design/webview2-cdp-and-live-acceptance-2026-10-01.md)。
- 验收驱动器配套模块（2026-10-02 收口 + 第二轮 P0 收口）：`lib/dispatch-budget.mjs`（派发**前**预留 + 跨进程串行账本：全局账本旁的 `open(...,'wx')` 锁、临界区内重新读盘、损坏结构拒绝、写失败上抛；**`requirePhaseOpen` 默认 true**——付费派发前必须先 `beginPhase()` 把在途状态持久写进账本，`closePhase()` 写成功才算闭合，`unresolvedPhase()`/`resolveUnresolved()` 让下一个进程先核对；`priorBusinessFailure()` 除 `businessFailure` 标记外也认已闭合条目的 `outcome=error/fail`）、`lib/ledger-finalize.mjs`（**账本收尾的唯一实现**：`finalizePhase()` 把业务失败标记与 phase 终结合并成**同一次原子写**、写失败即保持未闭合；`runFinalizeSequence()` 固定顺序"证据先落盘 → 再闭合账本 → 按最终判定重写证据"；`preflightLedgerGate()` 供驱动与回归共用的两道历史门槛）、`lib/ipc-gate.mjs`（**页面侧门禁的唯一实现**：永不 reject + 故障即停发 + 覆盖率自证；响应按**协议真实解码分支**判定（`content-type` 决定 `json()/text()/arrayBuffer()`，不看 status），复用也重新自证；付费命令表由 `dispatch-budget.mjs` 生成）、`lib/fact-assert.mjs`（固定题面事实断言：按句读切分、起止成对、否定语义、年份/星期核对）、`lib/trace-read.mjs`（trace 读取与三方请求核对：少记/绘图类别/不可观察、关闭能否重开）；配套 `budget-check.mjs`、`ipc-gate-check.mjs`（用本机真实 tauri 协议源码跑 `node:vm` 假传输，含旧形状对照）、`ledger-finalize-check.mjs`（真预算写者 + 生产收尾函数 + **真新子进程**）、`fact-assert-check.mjs`、`live-driver-check.mjs`，以及零模型 `cdp-preflight.mjs` 与纯 mock 的 `cdp-preflight-check.mjs`；`fixtures/ledger-gate-child.mjs` 是"下一个进程"的替身夹具（`spawnSync` 另起 node）。§0.0 的 A/B/C 与第二轮 P0-A/P0-C 已收口（离线 17 + 浏览器 6 个 runner 全绿），账务 1/1 差额已定位但计费状态仍 UNKNOWN。
- 多页导出的零模型验收：`export-paging-check.mjs`（在真实浏览器里走 `composeMarkdown → exportArticleImages → renderArticleImages → export_images`，把真正传给落盘命令的文件清单抓下来自己写盘并做文件级核对；夹具 `fixtures/2026-10-02-longarticle/source.md` 与 2026-10-08 安全分页夹具 `fixtures/2026-10-07-safe-paging/{short,text,art}.md` 冻结不改。含"故意跨分页线的内容块"对照，证明切口检测器可证伪。**2026-10-08 更正**：旧注称"正文含 `<img>` 的多页在本 runner 的 Chromium 下转不出图"——同机复测**不复现**（生产完整样式 12/12、compose 实际 7 种样式 7/7、真实两跳链 8/8 均可光栅化），但**裸 `<img>` 与 `max-width:100%` 变体仍不确定**，故"带图多页已在浏览器层覆盖"**不能统一声称**，真实 WebView2 仍是独立边界）。
- `f1-artifact-rejudge.mjs`（2026-10-08 新增）：**离线重判已冻结的原件**，不重生成、不重跑——按冻结口径逐项核对 G2B（标题变化 / 正文逐字与逐字节保持 / 素材身份与快照哈希 / `gen_svg=0` 的 trace 证据 / 无外链），把不适用的判据记 **N/A 而非 PASS**，证据不足记 `UNKNOWN`；可对补测后的 G2A/G3 复用。**原 FAIL 记录与哈希原样保留，新重判不等于原执行变 PASS**。
- 当前检查：`verify-ui.mjs`、`compose-check.mjs`、`asset-resolve-check.mjs`、`svg-quality-check.mjs`、`progress-check.mjs`、`trace-check.mjs`、`raster-check.mjs`、`fixture-repair.mjs`、`delivery-quality-check.mjs`、`photo-swallow-check.mjs`（照片位吞并源码泄漏的回归；`--prove-red` 从 git 取修复前版本证红；用例 ⑥ 打在真实最新稿的整份只读副本上）、`asset-completion-check.mjs`（素材完成状态：排版拒收回写台账、复用路径同过适用门禁、预算不被自动流程重置）、`repair-integrity-check.mjs`（事实规范化与正文投影的纯函数回归：正反对照、口径一致、"比不了必须阻断"）、`repair-flow-check.mjs`（**真实 App** + 受控模型输出：丢事实组不得 accepted、保留组必须 accepted、trace 必须有 `bodyApplicability=applied`；含第二轮指南 §4.1 的三个**单项**事实反例：仅删地点 / 上午改下午 / 删行内代码电话）、`prep-contract-check.mjs`（真实 `runPrep` + stub `prep_turn`：reply/compose/candidate 三分支、旧协议兼容、普通答疑不提交、参数非法、预算封顶无第 4 次请求；**2026-10-08 加 T3 有界纠偏**——`compose`/`candidate` 携带 `text` 时把校验器原错误串作为 **tool 结果**播回、`arguments` 原样回填、至多一次且不在末轮，另 7 种不可纠正形状仍一次即失败）、`preview-resource-check.mjs`（从发送前记录所有请求：八组预览输入都必须零外链尝试，且**特定** `html.external-img` 诊断与原始违规原文仍在门禁记录里）、`runner-negative-check.mjs`（判定器负向回归：错误端口/零检查必须报错而不是全 PASS）、`ipc-gate-check.mjs`（**页面侧预算门禁**的离线验收：把 `lib/ipc-gate.mjs` 的源码连同本机真实 tauri 协议源码放进 `node:vm` 沙箱跑假传输，覆盖正常 / fetch 失败 / 响应解码失败 / 宿主预留 reject / 回退已激活 / 拦截函数脱落 / 中止线 0 七类；协议源码按 `Cargo.lock` 现取，取不到即 BLOCKED）、`release-smoke.mjs`（release exe 的隔离启动冒烟：窗口标题用**操作系统**读取、真实工作区逐字节未变；CDP 可用性单独如实记录）、`live-acceptance.mjs`（**真机 + 真实模型**验收 L1–L8 + F1 的 **G1/G2A/G2B/G3** 四个材料依据样本，隔离启动器 + 跨回合预算账本；`--resume-after-fix "<理由>"` 是**解除业务失败屏障的唯一入口**（同时闭合历史未完成 phase，理由写进账本留痕，不返还额度、不清零累计）；**2026-10-08 改 L6 分页断言**：删掉"页数 = ceil(长图高/2000) + 每页高等高"这条**实现细节断言**（安全分页后必红），改为 `各页高度之和 === 长图高` + 每页高为正的**不变式**；详见 `docs/design/webview2-cdp-and-live-acceptance-2026-10-01.md`）、`live-conformance.mjs`、`live-three-samples.mjs`（**已被 `live-acceptance.mjs` 取代，勿再作为签收依据**）、`app-message-grounding-check.mjs`（**F1：真实 App 实参截获**——把真实 App 跑在 Tauri 通道替身上，截获 prep 普通轮/末轮、compose WRITE、candidate/compose 之后自动 REVISE 的**实际 `messages`**，核对材料依据边界随各入口真的发出去了；零模型、不联网、不写真实工作区）。
- `lib/run-result.mjs`：runner 统一判定器（`createJudge`/`statusOf`/`finish`/`guardCrashes`/`resolveOutDir`/`tapCheckLines`）——PASS 必须同时满足"计划场景齐全 + 检查数 > 0 + 无错误"，零检查与异常为 ERROR、缺依赖为 BLOCKED；输出一律落 `run-result.json`。
- `lib/desktop-harness.mjs`：真机验收的**隔离启动器**（专属 `USERPROFILE` + `WEBVIEW2_USER_DATA_FOLDER` + 空闲 CDP 端口 + 隐藏窗口），隔离目录与真实工作区重叠/嵌套时**直接拒绝启动**；关闭只认**本轮启动的那个 PID**，关闭前先要求**启动身份齐备**（映像名 + 完整路径 + 创建时刻，缺一即 `incomplete-identity`、零关闭操作），再用它复核；温和关闭等待超时后、发 `/F` **之前**再核验一次（身份变了回 `identity-changed-before-force` 且绝不强杀）；`procIdentity()` 回 `identityComplete`/`missingFields`，"读不出来"记 `matchesExpected=null` 而不是 true；"请求前就已退出"单列 `exitedBeforeRequest` 不算正常退出；另含目录哈希清单/差异比对，以及 CDP 诊断纯函数（TCP 错误分类、HTTP 响应分类、target 结构分类、按实际 `--user-data-dir` 递归找 `DevToolsActivePort`）与 `isolateCdpEnv`（显式清掉继承的 CDP/runtime 环境覆盖）。
- `lib/ls-stub.mjs`：内存 localStorage 桩，让素材链路可无头驱动（供 `asset-resolve-check.mjs` 用）。
- `lib/fixtures.mjs`：读取 `fixtures/` 下的真实失败样例；`fixtures/2026-09-28-basement/` 是 2026-09-28「筑基」失败稿 + 四枚库素材 + 当时告警的**只读**副本（脚本只读不写），`fixtures/deco-calibration/` 是角饰实际尺寸检查的校准样例（含真实库素材副本与两个合成退化样例），`fixtures/2026-09-29-photo-swallow/` 是照片位吞并后续素材块的失败样例（最小片段 + 真实结构裁剪版 + **真实 `source.md` 整份只读副本**，含前后对比证据）。
- 手动转换：`compose-cli.mjs`。
- 旧专项实验：`live-knowledge-probe.mjs`、`live-style-choice.mjs`；保留代码，使用限制见开发指南。
