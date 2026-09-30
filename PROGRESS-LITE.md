# 最近进度

详细原因与验证见 [PROGRESS.md](PROGRESS.md)；当前待办见 [REQUIREMENTS.md](REQUIREMENTS.md)。每条只写一句话，阶段结束后合并里程碑。

---
## 2026-10-01

- [Verify] §4.3「有效无事实正文」App 层回归：新增 `no-protected-facts-accepted` 用例（无日期/地点/电话/人数仍须 accepted），并断言 `baseFacts` 为空、投影为 `ok` 而非 `failed`——把抽取器改成凭空产事实即变红；顺带删掉一条 `mustExtract: []` 时的**恒真断言**。
- [Verify] §7 发布输入清单绑定本次 release：`gitHead 4ad6900`、645 个输入文件 / 46,971,339 字节、工具版本 node v24.13.0 / pnpm 10.33.2 / cargo 1.95.0、敏感文件跳过 0、清单自身 sha256 `35685990…`（JSON 按用户口径不入库，只记哈希）。

- [Change] §4.2 正文投影改由 **compose 的作者节点**产出（`ComposeResult.authorUnits` + `projectionOf` 三态 ok/empty/failed）：带源文行号、`<svg>` 整块（含内部 `<text>`）剔除而**作者写的代码文本保留**、系统占位与容器报错句按 `emit` 标记排除；只有旧 ```html 直通通道才退回正则投影，并在 trace 里标 `legacy-html`。有效空内容不再被当成失败。
- [Verify] `compose-check` 新增 ⑦ 节 11 条（98/98）；`repair-flow-check` 新增 7 条 App 层断言（trace 必须 `投影=ok` 且不含 `legacy-html`）。**两条断言第一版都是恒真的，靠变异才改对**：纯几何 SVG 换成含 `<text>` 的 SVG、把投影原因写进 trace note 之后才可证伪；另修掉一条自己写错的正则（`[[\w]+:` 误匹配正文里的 `8:00`）。

- [Change] 第二轮指南 §4.2 时序与基准语义：正文比较的"不适用"改按**候选轮次**判（原按 `!baseline`，首个候选投影为空会让后续每一轮修复都被报成"不适用"——而它在判定里不阻断），修复轮缺基准/投影为空一律 `failed`。
- [Change] 无进展判定改用**位置级问题指纹 + 完整候选内容指纹**（原来只比问题 code 与正文投影，投影剔掉 SVG/样式，素材重画与样式改动会被误判成空转）。
- [Change] 单项素材重试改为"先冻结正文与文档身份 → 处理素材 → 比较/门禁/取消/运行身份复核全过才提升预览与素材上下文"（原来先换预览与素材上下文、后跑门禁，失败的重试会顶掉正式版）；重试的正文比较适用性从 not-applicable 改为 failed。
- [Change] 「已保存」只来自**回执 + 独立读回**：`accepted` 原来在落库前就置位、文案写"已验收并保存"，保存失败时仍在报保存成功；现拆出 `saved` 标志，落库前说"写入尚未确认"。
- [Change] 保存时的素材快照改以**文档已有快照为权威**（原来无条件读库当前 svg/ver，库升 v2 会把用户没同意更新的旧文档一起改掉）；素材身份比较加入版本与内容哈希，快照损坏与缺失给不同结论。
- [Chore] 新增 `scripts/lib/run-result.mjs` 统一判定器，12 个 runner 改为"计划场景齐全 + 检查数>0 + 无错误才 PASS"（零检查与异常 = ERROR、缺依赖 = BLOCKED）；外链证据断言收紧为**特定** `html.external-img` + 原始违规原文（旧的"任意 html.*"实测不可证伪）；修正 `waitForFunction` 超时参数位错位。
- [New] 新增真机验收驱动器 `scripts/live-acceptance.mjs`（L1–L6、隔离启动、跨回合预算账本、双口径派发计数），离线自检通过，未运行。
- [Blocked] **包 F 六回合全部未执行**：本机 WebView2（153/154 都试）不提供 TCP 上的 DevTools 端点，脚本在启动阶段即 BLOCKED（0 次派发、0 次绘图、无费用），证据见 [排查记录](docs/design/webview2-cdp-and-live-acceptance-2026-10-01.md)。
- [Fix] 顺带修掉一个从未生效的做法：wry 0.55.1 无条件覆盖 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`，项目文档里"用该环境变量开 CDP"一直是死的；改由 `lib.rs` 创建主窗口时按 `WXMP_CDP_PORT` 门控传入（默认不开端口，窗口标题/尺寸逐字不变，已实测）。
- [Verify] `tsc`/`pnpm build` 干净；`cargo test --lib` 133 项；离线 11 个脚本全绿；`verify-ui`、`repair-flow-check`（含三个新事实反例）、`prep-contract-check` 175/175、`preview-resource-check` 26/26 全绿；负向回归 18/18；变异证伪有效。
- [Fix] runner 参数陷阱：四个用**位置参数**的 runner 会把 `--out` 当成输出目录名（实测在仓库根建出 `--out/`）；`--out` 生效后位置又前移，URL 被当目录、baseURL 悄悄退回 1420 导致假 ERROR。统一改由 `parseRunnerArgs()` 按"像不像 URL"解析，两种约定都实测写对目录。
- [Build] release 重建（`pnpm tauri build --bundles nsis`）+ **隔离启动冒烟通过**（窗口标题逐字符相等、隔离工作区自动建立、真实工作区逐文件哈希未变）。

## 2026-09-30

- [Fix] 入库前验证抓出真缺陷：`prep-contract-check.mjs` 的依赖探测早于 `outDir` 初始化，解析不到 playwright 时撞 TDZ 抛错、退出码 1 且不落判定文件（静默失败）——探测后移，`runner-negative-check` 由 FAILED(3) 转 18 条全绿。
- [Chore] 2026-09-24 起六轮改动首次入库并推送 GitHub：289 文件 / 3.21 MB；`.gitignore` 改为排除 `docs/artifacts/**` 的 `*.png`/`*.json`/`*.jsonl`（用户口径：只提交代码与文档），6 个 `scripts/fixtures` 测试夹具按例外保留；`tsc` 干净、11 个离线断言脚本全绿、`cargo test --lib` 133 项。
- [Review] 独立复测确认原接线等修复有效，但新增三个事实漏拦、准备授权/素材快照、预览及测试判定缺口，第一轮整体关闭结论撤回，见 [复测证据](docs/artifacts/2026-09-30-ds-audit/README.md)。
- [Docs] 新增 [第二轮 DS 修改指南](docs/design/ds-repair-guide-2026-09-30.md) 与 39 份冻结证据副本，列明 A–F 修复、确定性回归、版本及真实交付验收；本轮未改产品代码。
- [Decision] 用户已明确允许该任务内少量真实模型测试，DS 修复后直接按指南执行四回合及无额外调用的重开/导出，不再等待相同授权；当前尚未执行。

## 2026-09-29

- [Debug] **事实保护接线**（F1，P0）：`App.tsx` 的 `baselineHtml` 只在候选零阻断时建立、而零阻断那版立刻退出循环，导致修复轮基准恒为 null、两轮都传 `body=null`——改为**本回合首个候选的正文投影冻结为基准**，退化比较前移到 `best` 更新与提前退出之前，`accepted` 只可能是完整通过门禁的那一版。
- [Debug] 事实匹配重写：`FactToken` 加 `canon` 规范化值（时刻/日期/电话/数量），按 `kind|canon` 集合比对取代裸字符串包含（`8:30→18:30` 不再漏检、姓名句式调整不再误判），重叠消解优先级、姓名从右往左取；`bodyIntegrity.ok` 只由**事实缺失**决定（片段丢失仍为提示），修掉"清单无阻断项、gate 却 false"的自相矛盾；新增 `bodyText()` 正文投影（剔 SVG/坐标/行内代码/拒收占位）。
- [Debug] `deliveryVerdict` 新增 `BodyApplicability` 三态（applied / not-applicable / failed），不再用 `null` 兼表"不适用/没查/查不了"；`failed` 补一条阻断 `body.unverified`。
- [Change] **准备结果契约**（F2/F3）：新增终结工具 `finish_preparation{outcome: reply|compose|candidate, source?, assetPolicy?}`，`runPrep` 改返回判别联合；旧协议（只回 READY / 只给完整围栏正文）先做一次协议纠偏（占用同一总额预算 3 次），纠偏后仍无结构化结果且**已具备创作操作契约**时才做受测兼容转换并打标；普通答疑里出现 READY 或 v2 示例一律 reply、不提交；预算耗尽与网络/鉴权失败**明确失败**，不再降级成"直接撰写"。
- [Change] **统一交付入口**：主撰写流、prep 直接候选、自动修复走同一段候选代码与同一门禁；调用模型**之前**读取当前正式文稿并把 revisionId + canonical source + 素材稳定引用标给模型；`PREP_EVERY_TURN` 改 true（准备阶段为唯一模型入口，纯对话以 reply 结束、不追加撰写请求）。
- [Change] 素材身份退化拦截（F4）：`materializePlaceholders` 新增 `assetPolicy`，`preserve` 时按文档绑定**确定性恢复**同一 assetId/快照并记 `recover`，恢复不了明确失败——不偷偷重画一张；缺省值按"文档已有绑定→preserve"。
- [Change] 预览外链抑制（F5）：新增纯函数 `src/lib/preview-safe.ts`，`PreviewPane.wrapSrcDoc` 在显示边界把外链 `src/href/srcset/CSS url()` 换成内联占位；门禁/草稿/导出仍用原始 HTML，违规证据完整保留。
- [Verify] `cargo test --lib` **132 项**（新增终结工具声明断言）；离线九脚本全绿共 **602 条断言**（`delivery-quality-check` 123 / `repair-integrity-check` 58 / `asset-completion-check` 52 等）；`verify-ui` **133 PASS / 0 FAIL**（S1–S25，两次稳定）；新增 `repair-flow-check`（真实 App：丢事实组不得 accepted、保留组必须 accepted、trace 必须有 `bodyApplicability=applied`）、`prep-contract-check`（F2/F3 原文 + 不提交 + 预算封顶无第 4 次请求）、`preview-resource-check`（外链尝试 0 且原始诊断仍在）全绿。
- [Debug] **对抗式审计（只读）抓到并修掉一个 P0、一个 P1、八个 P2**：P0 是事实抽取产**假事实**（`感谢老师们的辛勤付出` → `name:感谢老师`、`地点在图书馆三楼报告厅` → `place:地点在图书馆`），一次正常改写被判"姓名丢失"→ 阻断整条修复链；另一个 P0 是 v2 正文里的 ```` ``` ```` 代码块让围栏扫描**静默截断**后半篇、截断稿照样标成已验收（同一字节序列无法确定边界，故不猜测性修复，改为如实标记 `v2Ambiguous` 并阻断，模型显式声明的 `source` 不经围栏反推）。P1 是素材工坊「用新版素材重渲染」**绕过门禁写文档库**且提示条与实际情况不符。另修：单项重试的必需素材位未按本候选正文过滤、取消检查排在接受之后（停止后仍可能显示"已验收并保存"）、准备失败留下空气泡、普通答复里的 v2 示例顶掉成品预览、`preview-safe` 单引号占位截断、`stagesChecked` 声明没查过的阶段、草稿落盘 trace 不查返回值、重试被取消仍落草稿。同时清掉自己脚本里的恒真/弱断言并补 60 余条可证伪回归（变异确认会变红）。
- [Build] release 重建（16:32）+ 隔离 USERPROFILE/WebView2 启动冒烟通过（窗口标题「智序 · 公众号推文助手」，真实工作区 15 会话/3 文档/11 素材/3 trace 计数不变），冒烟进程按 PID 关闭、临时目录已删。
- [Verify][未完成] **真实模型回合未跑**（首篇/续改/重开/导出需付费授权），F2/F3 只在受控 stub 下证明契约与执行，不能写成"已验收"；微信端观感、后台上传、断电恢复、多实例并发、图像理解均未覆盖。

- [Research][Docs] 按本轮独立验证形成 [DS 完整修复指南](docs/design/ds-repair-guide-2026-09-29.md) 及失败夹具，明确事实保护、prep 完整稿交付、素材保持和预览/验收修复。（**本条为当时的时点记录**：指南后续已实施，见上方各条与 README 状态行。）

- [Change] 批次 C（Rust 侧）：文档存储由"三文件就地覆盖"改为**不可变版本目录 + 提交指针**（`manifest.json` 指针 / `revisions/<rev>` 不可变 / `staging/<txn>` 未提交候选）——写 staging → 读回校验（文件/哈希/绑定/质量记录）→ 目录整体改名安装 → **一次 rename 提交指针**；提交前查 `generation`/`baseRevisionId` 挡住迟到请求，失败时旧指针逐字节不变、不删旧文件；旧三文件迁移为 `revisions/legacy` 且标 `unverified`（无验收记录不得当合格回滚目标），迁移读失败明确报错不覆盖；新增 `list_document_revisions`/`open_document_revision`/`commit_document_revision`（前端待接线）。
- [Verify] `cargo test --lib` **131 项全绿**（原 120 项无退化，新增 11 项：六个提交中断点/未提交候选不提升/CAS 拒绝/旧指针不变/旧文档迁移/哈希不一致/quality 门禁/草稿与提升/版本一览）；全部用 `std::env::temp_dir()` 隔离，未读写真实工作区、未启动应用、未跑 pnpm；两次变异（就地覆盖、故障点失效）证明断言非恒真。

- [Research][Docs] 新增 [最新稿源码泄漏与质量恢复修改方案](docs/design/quality-recovery-plan-2026-09-29.md)，列明统一门禁、自动修复复检、完整版本回滚及故障注入验收；仅方案，尚未实施。

- [Debug] 全量修复（11 个并行 agent：4 写 + 7 只读审计驱动）：修掉三条系统性倾向——①Rust **读路径/扫描路径**把"读不出来"折叠成"不存在"（影响扫描曾把"某文档读不出"当"没有引用"，用户据此覆盖素材就会改坏它），现在列表带 `unreadable`、扫描带 `scan_warning`、设置损坏带 `load_error`；②前端**持久化链路**把"失败"折叠成"空"（素材库读失败 → 正文里已有的引用被判成"不存在"并触发自动重写），现在 lib 层区分失败与为空、四个界面给失败态+重试、删会话失败不再清空会话栏；③**测试假绿**（恒真断言、断言实现副本、把验收结论硬编码进产物报告），逐条换成可证伪断言并用变异验证。另修素材协议五处不一致（含"未识别协议行原样漏进正文"）、`svgBlock` 区分"没有"与"读不出来"（后者曾导致重画一张库里已有的图）、流式零增量曾被当成功、prep 工具字段缺失曾静默降级、`verify-ui` 每跑一次就覆盖 README 配图且硬编码作者机器路径。
- [Verify] `cargo test` 120 项、离线六脚本全绿、`verify-ui` S1–S21 全绿（90 PASS，新增 S19/S20/S21）、`raster-check` OK；`verify-ui` 路径缺失时明确报错 exit 2（不静默跳过）。

- [Verify] 两个新契约先写断言（`scripts/verify-ui.mjs`）：S14 用 MutationObserver 提交序列 + rAF 逐帧两路采样，实测"用新版更新"按钮 `data-ref-update` 契约下 `data-busy` 走 1→0 且忙碌期间 `disabled` 同步为真（强断言）；S19 断言"保存成功路径下不渲染 `.save-error/[data-save-error]`"并**先证明这一轮真的落盘**，另加源码结构断言（PreviewPane 契约 + App 侧 setSaveError/传参）——失败分支在浏览器 mock 下结构上走不到（`documents.ts` 的 `lsWrite` 吞掉 setItem 异常、`saveDocument` 仍返回非 null），故为弱断言、不伪造。`scripts/trace-check.mjs` 增 `/models` 失败缓存 60 秒 TTL 与"空连接不计命中"的**结构断言**（含反向对照，真正行为断言在 cargo test）。

- [Debug] 真机三小样验收（驱动真实桌面应用、真实模型，隔离工作区）：①有库复用 0 次绘图 ②仅缺一张新图恰好 1 次绘图 ③只改正文 0 次绘图——三题全过。过程中逼出一个真 bug：非流式输出上限 8000 使绘图**必然**返回空正文（实测 `finish_reason: length`、`completion` 正好用满 8000、`responseLength: 0`，两次重试均 35 秒后失败；改到 32000 后一次成功，实际耗 18574 token 产出 6874 字 SVG）；另修我自己埋点的缺口（空正文把 `finish_reason`/`usage` 丢掉，导致只看到"空返回"分不清原因）。顺带证实：一次成功绘图要 74.5 秒（印证"不重复画"的价值与 240 秒预算合理），失败结果确实没被写成正文。
- [Change] 输出上限不再靠猜：直接查服务端（`GET /models`）——`deepseek-flash` 上下文窗口 1,048,576、**最大输出 393,216**、推理档位 low/high/max 且默认 high。改为运行时查询并按「端点+模型」缓存，查不到则退回已验证可用的 32000；上限按模型真实值钳制（猜低会静默截断、猜高会被 400 拒而 400 不重试）。推理档位显式钉成 `high`——实测降 `low` 会让**4/4 全部出现元素跑出画布**（`high` 4/4 过闸），只快约 15%。
- [Verify] `cargo test` 101 项（含上限钳制/兜底/端到端发值断言；并修掉假服务端口复用造成的随机失败）；改动后重跑真机第 ②③ 题：新画横幅一次成功（`stop`、`completion 21238`、8358 字 SVG、83.6 秒），改正文 0 次绘图；证据（原始 JSONL + 截图）随仓库保留在 `docs/artifacts/2026-09-28-repair/`。

## 2026-09-28

- [Change] 素材修复第二批（阶段 4–6）：素材解析改三段式（先决策 → 最多 2 个并发绘制 → 按原行序组装），同描述共享在途任务；新增三层超时（连接 15s / 单次非流式 180s / 单素材位 240s，均可环境变量覆盖，流式不设总超时）；"停止"接后端取消句柄（kill 在途等待、流式事件带 runId 丢弃迟到增量、停止后不再派发与入库，但不承诺服务端停计费）；鉴权/参数错误（4xx）新分类 `auth` 且不重试，限流/5xx 归网络类并按服务端 `Retry-After` 提示在剩余预算内等待重试；自动修订接上既有 `revise` 档。
- [Change] 素材质检改按**真实显示尺寸**（角饰 60px）栅格化，新增主体实际像素与对比度 P90 两项指标；阈值由样例实测校准（合格通过、浅色消失与"缩成一个点"被拦下，三枚真实库素材全部通过）；库素材不经过复检，既有库存不被批量重画；角饰作画提示收紧（单一主体、粗轮廓、透明边距、明度上限）。
- [Verify] `cargo test` 95 项（新增可控假 HTTP 服务 5 项：延迟/超时/错误分类/流式元信息/取消）、`pnpm build`、六个离线断言脚本同绿（`trace-check` 新增并发峰值=2 与顺序组装、取消后 0 派发；新增 `raster-check` 实测校准）、E2E S1–S18 全绿；`fixture-repair` 产出「筑基」稿修复副本与前后对比（四枚已有素材复用、绘图 0 次）；release 重建（`智序_0.1.0_x64-setup.exe` 22:39）并启动冒烟 12 秒通过。真实模型三小样需付费授权，未跑。

- [Debug][Change] 素材复用与交付修复第一批（阶段 1–3）：修掉三条真实根因——中文分类引用被整条丢掉、质检反馈教模型写内部容器 `::: art deco` 导致"定义了仍未定义"、自动修订每轮重做素材解析放大等待；新增按回合 JSONL 请求证据（阶段/模型/单调耗时/尝试序号/返回长度/finish_reason/usage/五类失败分类，不记密钥与正文）、素材引用宽匹配+按 ID 校验、旧角饰块只恢复不绘图、一轮创作的素材台账（成功即复用、失败不重获预算、每位最多 2 画 + 1 补描述）、未完成素材清单与单项重试；成品不再残留素材协议与失败说明。真实失败样例回归：四枚已有素材全部恢复绑定且这四位绘图尝试为 0。
- [Verify] `cargo test` 83 项、`pnpm build`、五个离线断言脚本（新增 `trace-check` 五类故障注入）与 E2E S1–S18 全绿；release 重建（`智序_0.1.0_x64-setup.exe` 21:43）并启动冒烟 12 秒通过——首次构建曾被使用者正在运行的实例锁住 exe，请其关闭后重跑成功。

- [New Feature] 对话区「AI 工作中」气泡：合并原先三处分散提示为一个助手侧气泡（阶段标签 + 真实细节 + 本轮已耗时），阶段为 读取资料/思考中/撰写正文/素材任务/排版与质检/自动修订/保存文档；prep 工具、主流式首 token、素材派发与第 N/M 张、保存均上报真实信号；纯展示不参与流程（加不变式断言）。实测发现独立「质量检查」阶段（<1ms）无法被绘制、用户确认并入「排版与质检」，保存阶段用 flushSync + 带超时的让帧保证到达 DOM。
- [Build] release 重建（`智序_0.1.0_x64-setup.exe`）并启动冒烟 12 秒通过；`progress-check` 新增、verify-ui S1–S17 全绿。

- [Change] 删除前端解释性小字：顶栏副标题/知识库计数/已自动保存、知识命中调试区、参考图说明、会话栏底注、各页头说明句、设置两段长说明与锁定说明、素材库括号解释与空态引导；保留功能反馈（保存/导出/错误/质检）与行内数据（消息数、版本号、时间）。连带清掉 3 个死状态与 12 条失效 CSS，使用手册同步改口径；verify-ui S1–S16 全绿、release 重建并启动冒烟。

## 2026-09-24

- [Change] 模型全部临时锁定为 deepseek-flash（创作/画图/看图三路，env 与设置里的其它模型被忽略）；设置面板显示锁定状态；`LOCKED_MODEL` 改回 None 即恢复可配置。未实测 flash 出图能力。

- [Debug] P0 素材复用确定性修复：长度归一化命中 + 配色冲突否决、分类过滤前置、`|new` 强制新建、角饰多别名（不再触发整篇重写）、分类不符只警告、新建素材进快照。
- [Change] P1 素材质量：按角色拆素材契约（小构件不再套大插画要求）、新增确定性 SVG 质检（画布外/不可见/铺满/含文字一律拦下）、角饰避让不再压字或裁切。
- [Change] P1 对话：去掉「含问号」启发式、短篇分档不再强塞组件（阈值 350 字）、修订保留旧预览、局部问题局部改、推理预算旋钮（默认不变）。
- [New Feature] P2 交互：预览点选组件插入文本锚点（不注入脚本、不自动发送）、真实任务进度、对话与工坊参考图、ChatMsg 多模态图像输入、视觉复核（默认关，限次缓存）、工坊连续修改前后对比。
- [Verify] 新增 2 个离线断言脚本 + compose-check 扩充全通过；cargo test 71 项、pnpm build、verify-ui S1–S16 全通过；release 重建成功并启动冒烟；真实模型仅跑最便宜的一条线上冒烟。
- [Research] 只读调查体验与素材链路，隔离确认错误复用、角饰引用和无效 SVG 放行，形成多模态改进方案；未开发、未调用付费模型。

- [Docs] 新增 GOAL 与完成标准，收敛文档入口并补充静态证据，备份后归档 14 张旧截图，保留源码与历史决策；详见整理记录。

## 2026-09-15

- [Change] 整理文档导航、需求与进度，保留 V3 决策，清除旧报告、提示词副本与重复验证产物，原文已备份。

## 2026-09-09（历史里程碑）

- [New Feature] 文档库、素材库、复用与固化快照、图片导出完成发布阶段整合。
- [Build] 智序 0.1.0 发布，具体当时验收见 RELEASE-NOTES.md。
- [Change] 最新稿源码泄漏与质量恢复闭环（质量恢复计划 A–E 五批，2026-09-29 实施）：**A 解析止损**——`compose.ts` 抽出**有边界的块收集** `collectBlockBody`（遇到下一个块起点即停，不再"一路扫到下一个 `:::`"）；`::: photo` 按**单行指令**解析、后续行一律退回正文，历史多行块只在无歧义（候选范围内全是纯文本行且确有闭合）时兼容，歧义输入一律按单行；孤立 `:::` 显式跳过（旧实现会掉进段落分支且不推进 i，**是死循环**）；`ComposeResult` 新增结构化 `issues`（稳定 code + severity + **源文行号**）与 `rejectedArts`，并逐节点做**可见文本泄漏检查**（跳过代码块与行内代码，合法代码示例不被误杀）。**B 统一门禁**——新增 `src/lib/delivery-quality.ts`（解析/素材/栅格/HTML/正文完整性 + 容量/版本 → 一条问题清单 + `DeliveryVerdict`；`bodyIntegrity` 给出**具体丢失片段与事实**）；`checkHtml` 失败不再"红条照显示、稿子照保存"；素材被排版层拒收**当场回写台账**（ok→failed）。**C 版本存储**——Rust `documents.rs` 改为 `manifest.json` 提交指针 + `revisions/<id>/` 不可变版本 + `staging/<txn>/`，写 staging → 读回校验 → 目录改名安装 → **一次 rename 提交**，提交前查 generation/baseRevisionId，失败时旧指针逐字节不变；旧三文件迁移为 `revisions/legacy` 且标 `unverified`。**D 修复与回滚**——回合产出改为**一串候选**：每轮跑同一套门禁，无阻断项即提交；有阻断项才修（先由解析器做确定性修复，剩需要改正文的才喂回模型）；退化（新增阻断项 / 事实丢失）撤销候选；预算用尽或不可修 → 草稿另存、成品维持上一份已验收版本；`PreviewPane` 四态标识 + **独立的草稿导出入口**。**E 交付验证**——新增失败样例夹具（含真实 `source.md` 整份只读副本）、`photo-swallow-check`（`--prove-red` 实测修复前 **10 条红**）、`asset-completion-check`、`delivery-quality-check`；E2E 新增 **S22**（好稿→成品 / 失败候选→**回退到上一版成品**且成品指针未被覆盖）。
- [Debug] 顺带修掉四个真 bug：①`resolvePreview` 只回传 `{html,warnings,arts}`，**丢掉结构化解析问题** → 纯正文稿（无占位）把"缺组件的半成品"直接判为可提交、自动修订一次都不跑；②必需素材位按**跨轮累计台账**计，模型改写后引用已不在正文、台账那条 `failed` 仍挂着 → `unfinished()` 永远非空 → **该候选永远阻断、修不进去**（实测打死 S14 复用样例）；③保存时把"最新候选的源文"配上"已验收候选的 HTML"——正是计划点名禁止的**新源文配旧 HTML 混合版本**（实测导致文档固化快照清零、影响扫描查不到引用）；④`documents.ts` 桌面读取路径直接透传 Rust 的 snake_case 字段，`updatedAt` 等**在桌面端恒为 undefined**（列表路径有映射所以看不出来）。
- [Verify] `cargo test --lib` **131 项**全绿（含 11 项版本存储的故障注入/迁移/CAS 用例，全程 `temp_dir()` 隔离）；离线断言 **9 个脚本**全绿（新增 `delivery-quality-check` 53 条、`photo-swallow-check` 含真实源文用例、`asset-completion-check` 45 条）；浏览器 E2E **107 PASS / 0 FAIL（S1–S22）** 连跑两次稳定；`tsc` 干净。release 重建与启动冒烟见详细进度。
- [Build] release 重建（`pnpm tauri build --bundles nsis`）：`wechat-mp-desktop.exe` 15.7 MB / `智序_0.1.0_x64-setup.exe` 4.6 MB（13:17）；启动冒烟用**隔离 USERPROFILE**（临时目录）跑到 14 秒确认窗口起来了、隔离目录下自动建出 `wechat-mp-workspace`，真实工作区计数**未变**（会话 15 / 文档 3 / 素材 11），冒烟进程已按 PID 关闭、临时目录已清。
