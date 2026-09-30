# 项目结构

更新：2026-09-30（复测与第二轮指南）。本文维护模块位置；使用方式见 [开发指南](docs/DEVELOPMENT.md)，完整文档入口见 [文档导航](docs/README.md)。

## 顶层

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

## 前端模块

| 路径（src/ 下） | 职责 |
| --- | --- |
| main.tsx、App.tsx、App.css | 入口、工作区/回合编排和样式 |
| components/ChatPane.tsx、WorkingBubble.tsx、PreviewPane.tsx、SessionRail.tsx | 对话、AI 工作中气泡（阶段标签+细节+计时）、375px 预览（四态标识：成品/已恢复上一版/草稿未通过/修复中 + 独立草稿导出入口）、会话侧栏 |
| components/DocsPane.tsx、AssetWorkshop.tsx、SettingsPanel.tsx | 文档库、素材工坊、设置 |
| lib/persona.ts、prep.ts、retrieval.ts、needs.ts、chat.ts | 系统提示、工具准备、知识读取、请求判断与双通道对话 |
| lib/compose.ts、palettes.ts、artRender.ts、quality.ts | 排版、色板、SVG 渲染与质量检查；compose 返回**结构化解析问题**（稳定 code + 源文行范围）与被质检拒收的素材块（`issues` / `rejectedArts`） |
| lib/delivery-quality.ts | 交付门禁：把解析/素材/栅格/HTML/正文完整性+容量+版本汇成一条问题清单，输出 `DeliveryVerdict`（阻断项为 0 才允许提交成品）；`bodyIntegrity` 按**规范化事实**（`kind\\|canon`）比对并给出具体丢失片段，`bodyText()` 提供正文投影（剔 SVG/行内代码/拒收占位）；`BodyApplicability` 三态显式区分"已比 / 不适用 / 比不了" |
| lib/extract.ts、revise.ts | 提取成稿、归一叠稿和自动修订 |
| lib/image-agent.ts、asset-agent.ts、asset-library.ts、asset-categories.ts | 素材解析复用与有界并发绘制（阶段 4：最多 2 个并发、同输入共享在途、位预算 240s）、制作与库操作；分类表（零依赖纯数据，解析层与工坊共用） |
| lib/asset-resolve.ts、asset-ledger.ts、svg-quality.ts、svg-raster.ts | 引用解析与复用判定、一轮创作的素材结果表（成败/预算/指纹）、素材 SVG 确定性质检（解析层 / 按真实显示尺寸的栅格层） |
| lib/trace.ts、vision.ts、progress.ts、preview-pick.ts、preview-safe.ts | 请求证据与失败分类（纯函数层）、视觉复核（限次与缓存）、任务阶段事件与展示文案、预览组件拾取、**预览显示层的外部资源抑制**（纯函数 `neutralizeExternalResources`：把外链 src/href/srcset/CSS url() 换成内联占位；门禁与导出仍用原始 HTML） |
| lib/documents.ts、sessions.ts、settings.ts | 文档、会话和设置持久化（读失败与"为空"**区分**返回：`{ok:…}` / boolean，界面据此给失败态 + 重试） |
| lib/exportHtml.ts、exportImages.ts、htmlToImage.ts | HTML/图片导出 |
| knowledge/ | 文本、视觉、插图、其它及排版引擎协议；应用运行时加载，非历史文档 |

## 桌面后端（src-tauri/ 下）

- `src/main.rs` / `src/lib.rs`：启动、命令注册与状态管理。
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

- 当前检查：`verify-ui.mjs`、`compose-check.mjs`、`asset-resolve-check.mjs`、`svg-quality-check.mjs`、`progress-check.mjs`、`trace-check.mjs`、`raster-check.mjs`、`fixture-repair.mjs`、`delivery-quality-check.mjs`、`photo-swallow-check.mjs`（照片位吞并源码泄漏的回归；`--prove-red` 从 git 取修复前版本证红；用例 ⑥ 打在真实最新稿的整份只读副本上）、`asset-completion-check.mjs`（素材完成状态：排版拒收回写台账、复用路径同过适用门禁、预算不被自动流程重置）、`repair-integrity-check.mjs`（事实规范化与正文投影的纯函数回归：正反对照、口径一致、"比不了必须阻断"）、`repair-flow-check.mjs`（**真实 App** + 受控模型输出：丢事实组不得 accepted、保留组必须 accepted、trace 必须有 `bodyApplicability=applied`）、`prep-contract-check.mjs`（真实 `runPrep` + stub `prep_turn`：reply/compose/candidate 三分支、旧协议兼容、普通答疑不提交、参数非法、预算封顶无第 4 次请求）、`preview-resource-check.mjs`（从发送前记录所有请求：外链尝试必须为 0，且原始违规诊断仍在门禁记录里）、`live-conformance.mjs`、`live-three-samples.mjs`（真机三小样：CDP 驱动真实桌面应用打真实模型，需隔离工作区）。
- `lib/ls-stub.mjs`：内存 localStorage 桩，让素材链路可无头驱动（供 `asset-resolve-check.mjs` 用）。
- `lib/fixtures.mjs`：读取 `fixtures/` 下的真实失败样例；`fixtures/2026-09-28-basement/` 是 2026-09-28「筑基」失败稿 + 四枚库素材 + 当时告警的**只读**副本（脚本只读不写），`fixtures/deco-calibration/` 是角饰实际尺寸检查的校准样例（含真实库素材副本与两个合成退化样例），`fixtures/2026-09-29-photo-swallow/` 是照片位吞并后续素材块的失败样例（最小片段 + 真实结构裁剪版 + **真实 `source.md` 整份只读副本**，含前后对比证据）。
- 手动转换：`compose-cli.mjs`。
- 旧专项实验：`live-knowledge-probe.mjs`、`live-style-choice.mjs`；保留代码，使用限制见开发指南。
