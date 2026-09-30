# 开发进度

近期变更保留原因、范围与验证；完成轮次合并为里程碑。当前需求和未解决事项见 [REQUIREMENTS.md](REQUIREMENTS.md)。

---
## 2026-10-01

### [Verify] 指南 §4.3「有效无事实正文」App 层回归 + §7 发布输入清单绑定本次 release

**§4.3 表第 7 行（有效无事实正文与投影失败必须分开）**：`repair-flow-check` 新增用例
`no-protected-facts-accepted`——首稿带 emoji 触发一轮自动修订，修订稿**没有任何受保护事实**
（无日期/地点/电话/人数），必须 accepted 而不是被阻断。两条新断言都做了可证伪处理：
- `wantNoFacts` 断言 `baseFacts.length === 0`：把抽取器改成凭空产出事实（模拟历史上真出现过的
  `感谢老师` → `name:感谢老师` 假事实），该用例**立刻变红**（实测 REPAIR-FLOW FAIL）；
- 断言 trace 里是 `投影=ok` 而**不是** `failed/empty`——"没有事实"不等于"投影失败"。
- 顺带修掉一条**恒真断言**：`mustExtract: []` 时 `every()` 自动为真，那条"首稿真的抽出了要保护
  的事实"在这种用例上是永远绿的；现在只在声明了要抽的事实时才断言，"没有事实"由 `wantNoFacts` 负责。

**§7 发布输入清单**：`node scripts/input-manifest.mjs` 对**本次 release** 生成清单——
`gitHead = 4ad6900`（与构建时的树一致）、645 个输入文件 / 46,971,339 字节、
工具版本 `node v24.13.0 / pnpm 10.33.2 / cargo 1.95.0 / rustc 1.95.0`、
排除 `node_modules dist .git target .vite .pnpm-store coverage`、**敏感文件跳过 0**（确认没有把凭据当输入收进去）、
清单自身 sha256 `356859900057010a76f63bfe33fc7cb83326f6d8208e1f6ae6cd53d52f85aa47`。
清单内容含未跟踪输入（runner/fixture 也算输入）；按用户口径 JSON 不入库，只在本条记录哈希与摘要。

### [Change][Verify] §4.2 正文投影改由 compose 的作者节点产出（关闭上一节留下的那条未完成项）

**问题**：上一节交付时如实标了"§4.2 要求的'利用 compose 的作者节点与 emit 元信息形成带来源范围的正文单元'只做了一半"——`FactToken` 有了来源区间，但**投影本身**仍是 `bodyText(html)`：拿渲染后的 HTML 做正则去标签。它猜不出节点边界，另外缺三样东西：**来源范围**（出问题只知道"某段文字少了"，不知道在源文第几行）、**三态**（分不开"解析成功但正文确实为空"与"根本建不出投影"）、**精确分类**（系统占位/报错句只能靠匹配文案形状排除）。

**改动**：
- `src/lib/compose.ts`：`emit()` 已经是"每个作者节点 + 源文行号"的唯一出口（`outMeta` 一直在记），这一版把它**接出来**：
  - `emit` 的元信息补 `system` 标记，并在 6 处**系统自己写**的节点上打标（素材被质检拒收的占位说明、以及 `timeline 需至少 1 个节点` 这类容器报错句）。**排除的只是投影**——这两类各自的 `issues` 照常进交付门禁，不会被藏起来。
  - 新增 `AuthorUnit`（作者可见文本 + 源文行号 + 是否代码节点）、`buildAuthorUnits()`、`authorTextOf()`、`projectionOf()`（返回 `BodyProjection{status:'ok'|'empty'|'failed', text, units, reason}`）；`ComposeResult` 新增 `authorUnits`。
  - 口径：`<svg>` 整块剔除（**包括它内部的 `<text>`/`<title>`**——那是画面文字不是作者正文）；其余标签只当分隔，**作者写的代码文本照收**（`联系电话：`010-55556666`` 的号码必须留在投影里）。
- `src/App.tsx`：`projectionFrom(units, htmlFallback)` 优先用作者节点；只有旧 ```html 直通通道（没有解析树）才退回 `bodyText`，且 `reason` 明确写 `legacy-html` 并**进 trace**。`evaluate` 与 `retryAsset` 两条路径都改用它；单项重试改为**先冻结"重试前那一版"的作者节点投影**再碰素材，两边同口径，避免"一个走解析树、一个走正则"产生假差异。
- 适用性口径跟着 §4.2 收紧一次：`empty`（有效空内容）**不算失败**——没有受保护事实的短文本来就该放行；只有 `failed`（建不出投影）或缺基准才阻断。这修掉了我上一版"投影为空即 failed"的过严。

**验证**：
- `compose-check` 新增 ⑦ 节 11 条断言（**98/98 全绿**）：行内代码作者文本保留、SVG 整块（含 `<text>`/`<title>`）不进投影、只有 SVG 的节点不产出空单元、单元带有效源文行号、系统句按标记排除、三态各自可达、真实样例上 17 个作者节点行号全部落在 1..源文行数且投影无实现细节。
- `repair-flow-check` 新增 7 条 App 层断言：每个场景的 trace 里 `投影=ok` 且**不含 `legacy-html`**——证明 App 真的走了作者节点通道，而不是悄悄退化成正则。
- **变异证伪（这一节的价值所在）**：第一次写的两条断言**都是恒真的**，是变异把它们抓出来的，随后都改成了可证伪形态：
  - "SVG 不进投影"最初用**纯几何 SVG** 做输入——剥完标签本来就不剩字符，去掉剔除逻辑仍然全绿；改用**含 `<text>`/`<title>` 的 SVG** 后，变异立即让 3 条断言变红。
  - App 层断言最初查 note 里有没有 `投影=ok`——而 reason 当时没进 note，"作者节点"和"legacy 回退"两种通道长得一模一样；把 reason 写进 note 后，强制走 legacy 的变异让 7 条断言全部变红（并打印出 `legacy-html：无作者节点，退回 HTML 文本投影（弱化）`）。
  - 另一条"投影不含实现细节"的正则自己写错了：`[[\w]+:` 在字符类里等价于"词字符+冒号"，把正文里的 `8:00` 也匹配上——是**断言写错**而不是实现泄漏，已改正则并注明原因。
- 回归：`delivery-quality-check` / `repair-integrity-check` / `photo-swallow-check` / `asset-*` / `svg-quality-check` / `trace-check` / `progress-check` / `runner-negative-check` 全绿；`verify-ui` 134/134；`prep-contract-check` / `preview-resource-check` PASS；`cargo test --lib` 133 项；`tsc` 与 `pnpm build` 干净。
- **release 重建**（`pnpm tauri build --bundles nsis` 后）：`wechat-mp-desktop.exe` sha256 `bdbf102ae5a0aced6d3bf6d283f1f93c8e118484edb0356e2e4cedf8bb9edd29`、`智序_0.1.0_x64-setup.exe` sha256 `7c610fc0380c15f10bb1a7008b8218df792bb09d6a1461057433f7fec156f25d`（本节收口后重建，为该轮最终产物）；核对无应用输入文件新于 exe；对该 exe 重跑**隔离启动冒烟 PASS**（窗口标题逐字符相等、隔离工作区自动建立、真实工作区逐文件哈希未变）。

### [Change][Verify][Blocked] 第二轮指南 A–E 收口；F（真实模型验收）被 WebView2 卡住

**背景**：按 [第二轮修改指南](docs/design/ds-repair-guide-2026-09-30.md) 收口复测点名的六个缺口。开工前先做了**基线核对**：A–D 的产品修复（事实三反例抽取、`preview-safe` 的 DOMParser 重写、`finish_preparation` 契约）在此前已被实现且当时就是绿的——审计（01:28–01:34）早于这些改动（01:50–02:15），所以本轮的工作是**补齐 A/E 的判定器与回归、修 §4.2 剩下的时序与基准语义、以及 §5.4 的快照权威性**，不是重做 B/C/D。

**基线（本轮开工前实测，不是转述）**：`preview-resource-check` 八组预览全 PASS；`prep-contract-check` 175/175、24/24 场景 PASS；`repair-flow-check` 三个新事实反例（仅删地点 / 上午改下午 / 删行内代码电话）在真实 App 上全部 `draft-failed`、两个正例 `accepted`。

#### 产品修复

- **§4.2 适用性判据改对了**（`src/App.tsx`）：原来用 `!baseline` 判"不适用"——首个候选的正文投影若为空，`repairBaseline` 恒为 null，**后续每一轮自动修复都被报成 `not-applicable`**，而它在交付判定里 `bodyIntegrityOk` 仍是 true，等于给"该比却比不了"开了一条不阻断的放行通道。改为按 `round` 判：第 0 个候选才是 not-applicable，修复轮缺基准/投影为空一律 `failed`（由门禁补 `body.unverified` 阻断）。
- **无进展判定改用位置级问题指纹 + 完整候选内容指纹**（`src/App.tsx`）：原来只比问题 `code` 与**正文投影**——投影会剔掉 `<svg>`、样式与坐标，于是"素材重画了、样式改了"这些真实进展在它眼里等于零，会被误判成空转提前结束。新增 `sameIssueFingerprints()`（用 `issueFingerprint` 的 stage/slot/节点/源文行号）与 `candidateFingerprint()`（渲染后 HTML 的 FNV-1a + 源文长度）。
- **单项重试的顺序回归指南语义**（`src/App.tsx` 的 `retryAsset`）：原来先 `setHtml/setQuality/setWarnings` 并覆盖 `lastMaterializeRef`（**素材上下文**），**之后**才跑正文比较与门禁——一次失败的重试会把正式预览与后续基准一起换掉。现在：进入时先冻结正文与文档身份 → 处理素材 → 比较 + 门禁 + 取消 + 运行身份复核**全部通过**后才提升预览与素材上下文；不通过时预览仍显示（用户刚点的），但由四态标识如实标成未验收。单项重试的适用性也从"任一侧空即 not-applicable"改为 **failed**（重试必须比得起来）。
- **「已保存」只来自回执 + 读回**（`src/App.tsx` + `src/components/PreviewPane.tsx`，§5.3）：`accepted` 状态原先在**落库之前**就置位，界面文案是"成品已验收并保存"——保存失败时仍在报告已保存。新增 `saved?: boolean`：落库前 `false`（文案改为"成品已验收，写入文档库尚未确认"），拿到回执**且**独立 `openDocumentSafe` 读回版本一致后才置 `true`；不一致/读回失败则给出明确提示且不翻成已保存。
- **文档快照成为保存时的权威输入**（`src/App.tsx` 的 `snapshotsOfUsed`，§5.4）：原来无条件 `getAsset(key)` 取**库当前** `svg/ver` 写回文档——库升到 v2 时，用户**没同意更新**的旧文档也跟着变，"逐篇选择是否更新"的语义就此失效。现在优先沿用文档已有快照，只有确实没有可用快照才读库。
- **素材身份：快照校验 + 版本 + 内容哈希**（`src/lib/asset-resolve.ts`、`src/lib/image-agent.ts`，§5.4）：新增 `svgContentHash`（FNV-1a，零依赖、node/浏览器同值）、`usableVersionOf`（正整数才算可用版本）、`snapshotUsable`（ID/版本/svg 非空/含 `<svg`/长度区间；**"缺失"与"损坏"给不同错误**）、`sameAsset`（ID、版本、内容哈希任一不同即不是同一素材）；preserve 路径**不读库内容**、只用库索引版本做比较并在 reason 里写明；`version: 0` 的硬编码改为真实版本；复用门禁缓存键加入内容哈希。
- **两个口径裁决**（实施中发现指南有歧义，按此执行并记录）：① 指南 §5.4 闭锁限定在 **preserve**，且"都适用"点名的恢复路径是显式 `[[asset]]` 与 `[[img:…|new]]`，**没有**点名 `::: art deco` 遗留块——因此"文档里完全没有记录"的遗留块仍按库唯一名称恢复（既有断言据此保持绿），只有**文档记过但快照缺失/损坏**时才明确失败；② preserve 不读库内容，故"版本号相同而库内容被改"在 preserve 里检不出，内容哈希真正生效的位置是复用门禁与库复用路径的身份比较。两者均写进 [PROGRESS-LITE](PROGRESS-LITE.md) 与本文，供后续裁决。

#### 判定器与回归（包 A / E）

- **新增 `scripts/lib/run-result.mjs`**：把 `preview-resource-check` / `repair-flow-check` 已经用对的唯一判定口径抽成共享模块——PASS 必须**同时**满足"计划场景执行完整 + 检查数 > 0 + 无失败与基础设施错误"；**零检查是 ERROR 不是通过**；异常 ERROR、缺依赖 BLOCKED；一律落 `run-result.json`。`verify-ui`（60 多处内联结论行）用 `tapCheckLines` 按**实际打印出来的结论行**计数，零条结论行必然等价于"没有断言被执行"。另含 `guardCrashes`：崩在半路也**落盘**再退出（实测旧行为是 run-result.json 已写成 ERROR 但进程挂着不退出）。
- **12 个 runner 统一改造**：`verify-ui`、`repair-integrity-check`、`asset-completion-check`、`live-conformance`、`asset-resolve-check`、`compose-check`、`progress-check`、`raster-check`、`svg-quality-check`、`trace-check`、`photo-swallow-check`（`--prove-red` 方向相反，用显式状态覆盖：≥1 条红才算 PASS，零检查 ERROR）、`runner-negative-check` 自身。只改"判定与退出码"这一层，**不动断言内容**。
- **外链证据断言收紧**（`preview-resource-check.mjs`，§3.2）：原断言接受**任意** `html.*` 问题当"原始违规诊断保留"的证据。实测该写法**不可证伪**——同一份 trace 里还有 `html.emoji/gradient/shadow`，改坏断言照样绿。现改为断言**特定** `html.external-img` 且其 message 里带着原始违规原文（原文取自生产 mock `src/lib/chat.ts` 的 `MOCK_BAD.html`，不另抄字面量），并在发送前装全过程观察器采集诊断（最后一版是合规稿，读末尾 DOM 看不到）。证伪实测：换成不存在的原文 → `FAIL`、exit 1。
- **等待条件修正**（§3.1）：`repair-flow-check.mjs` 原先只等 `.work-bubble` 不存在，且 `{ timeout }` 传在 **arg 位**（Playwright 签名是 `(fn, arg, options)`，超时被忽略、实际走默认 30s）。改为"先确认本轮 run 已开始（探针 started>0 或 `__probeCalls>=1`）→ 再等同一 run 终结（finished>0 且 trace 出现本轮 commit/persist 落定记录）"，超时全部放正确的 options 位；`verify-ui` 同型的 6 处参数位一并修正（**只修参数位、保留原来的有效等待值**，避免把"声明 10s 实际 30s"改成 10s 后把时序波动变成假红——实测 S24 就这么红过一次）。
- `scripts/live-three-samples.mjs` 头部加了醒目废弃说明（mtime 挑 trace、硬编码 9222、清空当前文档、恒 exit 0），注明已被 `scripts/live-acceptance.mjs` 取代。

#### 真机验收驱动器（包 F 的准备）

新增 `scripts/live-acceptance.mjs`（六回合 L1–L6，逐条实现指南 §8）：复用 `lib/desktop-harness.mjs` 的隔离启动；密钥只从 `~/.dsh/.credentials.yaml` 解析、只经 `extraEnv` 传子进程，落盘前过 `assertNoSecret`；**跨 phase 累加**的预算账本（派发 ≤20、`gen_svg` ≤4），**派发前**检查额度、超限即 BLOCKED；派发计数用"应用 trace 双口径 + 页面 invoke 探针"交叉核对，对不上报 ERROR；L5 用新 PID 重开同一 profile 比对"最后成功版本"，L6 导出并校验 PNG 可解码、宽 750px。写完后**离线自检**（`node --check`、页面注入片段单独编译、26 项纯函数自测全过），未运行、未调用任何接口。

#### 包 F：**BLOCKED（基础设施）**

`node scripts/live-acceptance.mjs L1` 在**启动阶段**即 BLOCKED（exit 2，账本 `已派发 0 次、绘图 0 次`——**没有花任何钱**）。根因排查与逐条证据见 [WebView2 与真机验收](docs/design/webview2-cdp-and-live-acceptance-2026-10-01.md)：本机 WebView2 运行时（153 与 154 都试过）**不提供 TCP 上的 DevTools 端点**；`--remote-debugging-port` 确实出现在 WebView2 浏览器进程的命令行上，但无端口监听、也无 `DevToolsActivePort` 文件；同机普通 Edge 用同一开关正常（200），且无组策略拦截。

**顺带修掉一个真实隐患**（已生效，且已验证行为中性）：wry 0.55.1 **无条件**调用 `set_additional_browser_arguments()`，会覆盖 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`——也就是说项目文档里"用该环境变量开 CDP"的做法在当前依赖下**从来没生效过**。现改由 `src-tauri/src/lib.rs` 在创建主窗口时按环境变量 `WXMP_CDP_PORT` 门控地传给 builder（`tauri.conf.json` 的 `app.windows` 随之置空）。**默认不开任何调试端口**；窗口标题/尺寸/最小尺寸/label 与配置逐字一致，且必须原样带上 wry 的 `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` 默认串（Tauri 文档警告过）。实测标题逐字符相等、隔离工作区正常建立、真实工作区逐字节未变。

#### 验证（实际执行结果）

- `npx tsc --noEmit` 干净；`pnpm build` 通过；`cargo test --lib` **133 passed / 0 failed / 4 ignored**。
- 离线断言全绿：`asset-completion-check` 58/58、`asset-resolve-check` 86/86、`compose-check` 87/87、`delivery-quality-check` 123 条、`repair-integrity-check` 75/75、`svg-quality-check` 20/20、`trace-check` 107/107、`progress-check` 36/36、`runner-negative-check` 18/18、`photo-swallow-check` 33/33、`fixture-repair` OK。
- 浏览器/App 级（真实 `PreviewPane`、iframe、CDP 驱动 mock 模型）全绿：`verify-ui`、`repair-flow-check`（含三个新事实反例）、`prep-contract-check` 175/175、`preview-resource-check` 26/26。
- **负向回归**：`runner-negative-check` 把三个受测 runner 指向无人监听的端口，断言"退出码非 0 + 状态 ERROR/BLOCKED + 不产出全通过结论"，18/18 通过；`verify-ui` 连错误端口 → `status ERROR`、`checks 0`，且不再挂住不退出。
- **变异证伪**：外链新断言换成不存在的原文 → 变红 exit 1；改回即绿。
- **隔离启动冒烟通过**：进程存活、窗口标题用**操作系统**读取且与 `智序 · 公众号推文助手` 逐字符相等、隔离工作区由应用自动建立且无真实数据、**真实工作区逐文件哈希未变**（新增 0 / 删除 0 / 修改 0）。
- **release 重建**（`pnpm tauri build --bundles nsis`）：`wechat-mp-desktop.exe` sha256 `1afa8d8a2f0ac5ff4b4e328c7e912ab715c8208cbda342802ca666bfb595457b`、`智序_0.1.0_x64-setup.exe` sha256 `3d84b282274d77ad453559c3b03ac82b726b6c11946b8cf1d243ad2ecc661cde`。构建后已核对**没有任何应用输入文件新于 exe**（`find src src-tauri/src resources public index.html dist Cargo.toml tauri.conf.json capabilities -newer <exe>` 为空），即产物与源码/前端产物同步；对该 exe 重跑隔离冒烟 PASS。
- **额外修掉的两个 runner 参数陷阱**（都属于"结果看着有、其实放错地方"这一类的可信度问题）：①`prep-contract-check` / `preview-resource-check` / `repair-flow-check` / `runner-negative-check` 用**位置参数**而 `verify-ui` 认 `--out`，用错约定时 `--out` 会被当成**输出目录名**、证据写进仓库根下一个叫 `--out/` 的目录（实测真出现了）；②`--out` 生效后位置参数**整体前移**，URL 会被当成输出目录、baseURL 悄悄退回默认的 1420 端口，于是脚本连到没在跑的服务、报一个像"产品坏了"的 ERROR（实测过）。现统一由 `lib/run-result.mjs` 的 `parseRunnerArgs()` 解析（按"长得像不像 http(s) URL"判，而不是数位置），两种写法都实测可复现地写对目录。
- **未执行**：包 F 的 L1–L6 六回合（上节已说明）；微信后台观感与上传、断电恢复、多实例并发、图像理解、参考图真实理解仍全部未覆盖。
- **未跑**：`live-*.mjs` 三个旧专项（需真实模型且与本轮范围无关）。

### [Build] release 重建与隔离冒烟（2026-10-01）

按铁律 7 重建：`pnpm tauri build --bundles nsis`。产物 `src-tauri/target/release/wechat-mp-desktop.exe` 与
`bundle/nsis/智序_0.1.0_x64-setup.exe` 均与本次源码同步；隔离启动冒烟通过（见上）。冒烟用的临时隔离目录、
探针脚本与 `%TEMP%` 下的 runner 输出均已清理，真实工作区计数未变。

## 2026-09-30

### [Fix][Chore] 运行器判定的静默失败修复 + 六轮改动首次入库

**背景**：2026-09-24 至 09-30 的全部改动此前只存在于工作区，从未提交（git 最后一条停在发布轮 `1c2afbe`）。本轮按用户指令把代码与文档一次性入库并推送 GitHub。

**入库前验证抓到一个真缺陷（`scripts/prep-contract-check.mjs`）**：`runner-negative-check` 报 FAILED(3)——把三个浏览器 runner 指向一个没有人监听的端口时，`preview-resource-check` 与 `repair-flow-check` 都正确落盘 `run-result.json`（`status: BLOCKED` + `errors`）并退出码 2，而 `prep-contract-check` 退出码 1、**不落判定文件、不写错误原因**，静默失败。

**根因（TDZ）**：该脚本把依赖探测 `const { chromium } = resolvePlaywright()` 放在第 89 行，而 `outDir` 在第 95 行才初始化。解析不到 playwright 时 `dieBlocked()` → `finalize()` → `mkdirSync(outDir)`，此时 `outDir` 仍在暂时性死区，抛 `ReferenceError: Cannot access 'outDir' before initialization` 并冒泡成退出码 1。它同时命中"报告里写明了具体错误（不是静默失败）"这条断言——正是 `runner-negative-check` 存在的意义（审计原缺陷是"零条检查却写出全部 PASS"）。另两个 runner 的 `outDir` 都声明在探测之前，所以不受影响。

**改动**：`scripts/prep-contract-check.mjs` 把两行依赖探测移到 `outDir` 初始化与同名结果拒绝之后，并加注释说明顺序不可颠倒。修复实测：死端口下退出码 `2`、`run-result.json` 落盘且 `status: BLOCKED`、`errors[0].stage = deps`；`runner-negative-check` 由 `FAILED (3)` 转为 `RUNNER-NEGATIVE OK`（18 条全绿）。

**入库范围（用户口径：只提交代码与文档，截图与 JSON 不入库）**：`.gitignore` 新增 `docs/artifacts/**/*.png` / `*.json` / `*.jsonl`（原先的 `docs/artifacts/tuiwen-*.png` 只匹配顶层，按日期归档的子目录匹配不到，是个失效规则）。共提交 289 个文件、3.21 MB。**一处例外是刻意的**：`scripts/fixtures/**/*.json`（6 个）是测试夹具而非证据转储，`asset-resolve-check` / `fixture-repair` / `photo-swallow-check` / `raster-check` 都要读它，删掉等于让回归跑不起来，故保留。`docs/artifacts/README.md` 同步改写口径（运行截图与判定 JSON 只留本地；已提交的 17 张 README 配图不受影响，`.gitignore` 不改动已跟踪文件）。

**验证**：`npx tsc --noEmit` 干净；11 个纯 Node 离线断言脚本全绿（`asset-completion-check`、`asset-resolve-check`、`compose-check`、`delivery-quality-check`、`fixture-repair`、`photo-swallow-check`、`progress-check`、`repair-integrity-check`、`svg-quality-check`、`trace-check`，加修复后的 `runner-negative-check`）；`cargo test --lib` **133 passed / 0 failed / 4 ignored**。**未跑**：需要 playwright 或真实桌面应用的五个 runner（`verify-ui` / `raster-check` / `release-smoke` / `prep-contract-check` / `preview-resource-check` / `repair-flow-check` / `live-three-samples`）——本机未配置依赖，其中 `prep-contract-check` 的失败分支恰好因此被负向回归覆盖；真实模型回合仍未执行。
**未重建 release**：本次改动只涉及 `scripts/` 下的验证脚本与 `.gitignore`/文档，都不进应用产物；`src-tauri/target/release/` 与应用代码同源未变。若按铁律 7 的严格字面口径需要重建，请指出。

### [Review][Docs] 第二轮 DS 修改指南与真实模型测试授权

**依据**：本轮独立复测，不以第一轮实施报告代替验证。132 项 Rust、133 项 UI、类型/构建和原新增回归通过，但当前 App 仍接受仅删除地点、上午改下午、删除代码样式电话的修订；生产准备/素材函数和真实 PreviewPane 另有授权、快照、外链与显示反例。专项证据层级见 [审计副本](docs/artifacts/2026-09-30-ds-audit/DS-REPAIR-AUDIT.md)。这些数字属于刚完成的审计，不是本次文档编辑重新执行的测试。

**交付**：[第二轮修改指南](docs/design/ds-repair-guide-2026-09-30.md) 将工作拆成 A 测试判定、B 正文保护、C 契约/素材、D 预览、E 发布、F 真实模型验收；保留已验证修复，明确静态待验证项，不把函数返回等同于真实提交。仓库新增 39 份冻结原件副本、哈希索引及精确输入，原件不移动不覆盖，调查探针不能原地执行。

**用户决定**：已明确允许本任务内少量真实模型调用。DS 在离线修复与构建通过后可直接执行首篇、只改文字、普通答疑、明确换图，再验证最后成功版本的正常重开/导出；无需重复征求相同付费授权。指南提供建议预算、失败停止条件和完整请求/版本证据要求，未将预算建议表述为用户硬限制。

**状态更正**：本轮复测后 F1–F5/T1 不能整体关闭；下方 2026-09-29 实施记录作为当时记录保留，当前结论以本条及 REQUIREMENTS 为准。已授权不等于已调用，真实验收仍待执行。

**本次变更**：新增指南和证据包，同步 REQUIREMENTS、PROGRESS-LITE、STRUCTURE、GOAL 的当前状态、文档导航与旧指南的更新提示。仅文档/证据整理，未修改运行时源码、未重建 release、未启动桌面或调用模型。验证范围为文件链接、UTF-8、证据哈希和状态口径。

## 2026-09-29

### [Debug][Change] DS 修复指南 A–E 五包实施：事实保护接线、准备结果契约、素材保持、预览外链

**依据**：[DS 完整修复指南](docs/design/ds-repair-guide-2026-09-29.md)。本轮关闭 F1/F2/F3/F4/F5 五条已证实缺陷与 T1（验收工具）的大部分，并**如实保留未跑部分**。

#### F1 自动修复删掉关键事实仍被当作成品（P0，已在真实 App 上复现并修复）

**根因（两处，第二处是主因）**：
1. `delivery-quality.ts` 的事实匹配用 `afterAll.includes(f.text)` 裸字符串包含判断——`8:30 → 18:30`（新值包含旧值）漏检，`负责接待的是张老师 → 张老师负责接待` 误判丢失（把虚词当姓名）。
2. **`App.tsx` 从未把正文比较接进修复轮**：`baselineHtml` 只在候选零阻断时才建立，而零阻断的那一版会立即退出循环——于是进入修复轮时基准恒为 `null`，两轮都传 `body=null`，事实保护一次都没生效。

**改动**：
- `src/lib/delivery-quality.ts`
  - `FactToken` 增加 `canon`（规范化值），新增电话/时刻/日期/数量四个规范化器与**重叠消解**（同一段文字只保留优先级最高的事实，`8:30` 不再被拆出一个干扰用的裸 `30`）；姓名改为**姓氏白名单 + 引介字/边界前置**的严格规则（见下方「对抗式审计」一节：早先的"从右往左取"仍在真实句子上产假姓名）。
  - 事实缺失判定改为 `kind|canon` 集合比对；`bodyIntegrity.ok` **只由事实缺失决定**（片段丢失仍是 warning）——修掉"清单里没有阻断项、`gate.bodyIntegrityOk` 却是 false"的自相矛盾（实测后果：修复永远无法生效）。
  - 新增 `bodyText(html)` **正文投影**：剔 `<svg>` 整块、行内代码 span、系统生成的拒收占位；**保留**转义后的 `&lt;svg` 泄漏（那是故障证据，交给 `leakIssues`）。
  - `deliveryVerdict` 新增 `BodyApplicability` 三态（`applied` / `not-applicable` / `failed`），替代 `null` 兼表"不适用/没检查/检查失败"；`failed` 补一条 **blocking** 的 `body.unverified`。
- `src/App.tsx`
  - 三类对象分离（`priorAccepted` / `repairBaseline` / `previousAdmissibleCandidate`）：基准取**本回合首个候选**的正文投影并冻结，不再要求它零阻断。
  - 候选提升顺序修正：退化比较**前移到 `best` 更新与任何提前退出之前**（旧写法把"更差但阻断更少"的一版先记成 best，退化检查拦不住）；`accepted` 只可能是**完整通过门禁**的那一版。
  - 无进展判定补上"正文投影也要一致"（旧实现只比代码列表，却在日志里写"产物未变"）；修正 `prevAdmissible` 的赋值时机（旧写法让"新增阻断/无进展"两条检查拿本轮结果和自己比，首轮即恒真）。
  - 单项重试也执行保留比较（素材重渲染不该动一个字），并显式标注适用性。

#### F2/F3 准备阶段提前结束（P1）

**根因**：`prep.ts:isReadinessMarker` 只接受整串 `READY`，真实回复是"说明 + 两个换行 + READY"；带说明的完整 v2 修改稿同样落入 `ready:false` 分支，被当成聊天存下，正式文稿版本一动没动。旧实现还会把"轮数耗尽"和"异常"都降级成 `ready:true`，等于把网络/协议错误转换成一次没被授权的创作。

**改动**：新增**结构化终结工具** `finish_preparation({outcome: reply|compose|candidate, text?, source?, assetPolicy?, baseRevisionId?})`（`src-tauri/src/chat.rs` 的 `PREP_TOOLS`），`runPrep` 改为返回**判别联合**（`src/lib/prep.ts`）：
- 机械校验参数（未知 outcome、`candidate` 无正文、多个终结工具 → `failed/protocol`）；
- 旧协议（只回 READY / 只给一段完整围栏正文）先做**一次**协议纠偏，纠偏**占用同一总额预算** `MAX_PREP_CALLS=3`；纠偏后仍拿不到结构化结果、且**已具备创作操作契约**时，才做受测的兼容转换（完整 v2 → `candidate`，READY → `compose`），并打 `legacyCompat` 标；
- 普通答疑里出现 READY 或 v2 示例 → 一律 `reply`，**不提交**（不凭裸控制词或围栏推导写作意图）；
- 预算耗尽 → `failed/exhausted`，不再降级为"直接撰写"。
- `App.tsx`：准备阶段失败（网络/鉴权/协议/耗尽）**分类报出**并保留旧成品，不再退化成"无 prep 直接流式"；`reply` 只显示文字、显式标记本轮未提交文稿；`candidate` **直接进入同一段候选交付代码**（统一交付入口：主撰写流、prep 直接候选、自动修复走同一门禁与同一版本提交）。
- 调用模型**之前**读取当前正式文稿，把 `revisionId` + canonical source + 素材稳定引用作为"当前正式文稿"标给模型；`PREP_EVERY_TURN` 改为 `true`（准备阶段成为唯一模型入口，纯对话以 `reply` 结束、**不再追加撰写请求**）。

#### F4 素材身份退化与重复绘图风险（P1）

`materializePlaceholders` 新增 `assetPolicy`：`preserve` 时，模型若把历史 `[[asset:…]]` 退回成 `[[img:…|new]]`，在**派发绘图之前**按文档绑定做**确定性恢复**（槽位文本一致，或 kind+描述唯一命中），复用同一 assetId/快照并记 `decision: recover`；恢复不了就**明确失败**，不偷偷改画一张新图。缺省值按"文档已有绑定 → preserve"给出，避免缺省把既有配图重画一遍。

#### F5 预览在门禁前发起外链请求（P1）

新增 `src/lib/preview-safe.ts`（纯函数）：`neutralizeExternalResources` 把显示层的 `src/href/poster/data/background/srcset/CSS url()` 里的 http(s) 与协议相对 `//host` 换成内联占位并记录被拦 URL；`PreviewPane.wrapSrcDoc` 做**唯一**的显示边界。传进门禁、失败草稿与导出用的**仍是原始 HTML**，违规证据不被洗掉（实测 trace 里 `html.emoji/html.gradient/html.shadow/html.external-img` 四条俱在，而外链尝试为 0）。

#### T1 验收工具

新增四个入口（均**接收唯一输出目录**，不覆盖历史证据）：
- `scripts/repair-integrity-check.mjs`：事实规范化、正反对照、正文投影、口径一致、假事实回归（纯函数，58 条）。
- `scripts/repair-flow-check.mjs`：**真实 App** 受控模型输出——丢事实组不得 accepted、保留事实组必须 accepted，且 trace 里必须出现 `bodyApplicability=applied`（证明接线有效，而不是纯函数自说自话）。
- `scripts/prep-contract-check.mjs`：真实 `runPrep` + stub `prep_turn`，覆盖 F2/F3 原文、普通答疑不提交、参数非法、多个终结工具、预算封顶无第 4 次请求。
- `scripts/preview-resource-check.mjs`：从发送前记录所有请求，断言外链尝试为 0，同时断言原始违规证据仍进了门禁；测试环境对精确 URL 提供**本地固定响应**，消除公网依赖。
- `scripts/asset-completion-check.mjs` 增补 §5.4 一组：`assetPolicy=preserve` 下身份退化被确定性恢复（同一 assetId、0 次新绘）、绑定素材不可用时**明确失败**而不是偷偷重画、**没有历史绑定的新素材位仍照常新绘**（preserve 不误吞用户真的要画的图），另有"不声明 preserve 时 `|new` 照常新绘"的反向对照。

#### 验证

- `cargo test --lib` **132 项**（新增 `prep_tools_declare_finish_preparation` 钉住终结工具与两个 enum）。
- 离线九脚本全绿，共 **602 条断言**（`compose-check` 87 / `asset-resolve-check` 86 / `svg-quality-check` 20 / `progress-check` 36 / `trace-check` 107 / `delivery-quality-check` 123 / `photo-swallow-check` 33 / `asset-completion-check` 52 / `repair-integrity-check` 58）。
- 浏览器 `verify-ui.mjs` **133 PASS / 0 FAIL**（S1–S25，连跑两次稳定）；`repair-flow-check` / `prep-contract-check` / `preview-resource-check` 全绿。
- `pnpm build`、`cargo test`、release 重建（16:32，`wechat-mp-desktop.exe` 15,705,600 B / `智序_0.1.0_x64-setup.exe` 4,582,036 B）+ **隔离 USERPROFILE/WebView2 profile 启动冒烟**（窗口标题「智序 · 公众号推文助手」，独立工作区生成；真实工作区 15 会话 / 3 文档 / 11 素材 / 3 trace 计数不变）。冒烟进程按 PID 关闭，临时目录已删。

#### 对抗式审计（只读）发现的缺陷与修复

A–E 落地后派只读 agent 对抗式审计新实现，**找到一个 P0、两个 P1、若干 P2**，逐条修掉并补了可证伪断言：

| 编号 | 问题（均为实跑复现） | 修法 |
| --- | --- | --- |
| P0-1 | **事实抽取产假事实**：`感谢老师们的辛勤付出` → `name:感谢老师`、`地点在图书馆三楼报告厅` → `place:地点在图书馆`、`周末到馆提醒` → `place:周末到馆`。一次正常改写因此被判"姓名丢失"→ 阻断整条修复链，界面给出的拒稿理由是"正文事实丢失（name）：感谢老师" | 姓名改为**姓氏白名单 + 引介字/边界前置**；地点剥掉上下文标签与处所介词、**去掉单字后缀**（馆/楼/厅/堂/园/苑——正是"周末到馆"这类假事实的来源）；引语规范化吃掉内部标点 |
| P0-2 | **v2 正文里的 ```` ``` ```` 代码块导致静默截断**：围栏扫描按行 toggle，内层代码块的开围栏被当成正文结束符，后半篇连同收尾段落一起消失，而聊天里的助手原文是完整的 → 截断稿照样 `accepted` 落库，界面显示"成品已验收并保存" | 同一份字节序列无法确定边界，故**不做猜测性修复**：`splitAssistant` 新增 `v2Ambiguous`，`App` 据此补一条**阻断**的 `parse.ambiguous-body` 并喂回模型（改用缩进）；模型**显式声明**的 `finish_preparation.source` 不经围栏反推，边界已确定 |
| P1-1 | **素材工坊「用新版素材重渲染」绕过门禁**：是唯一不经门禁就写文档库的入口；不传 `accepted` 导致落成"草稿 + 未通过门禁"，但提示条说"已就地刷新文档"，而重新打开读到的仍是已验收旧版；下次打开会话还会显示"上次未通过交付门禁…草稿保留在对话里"——原因与位置都是编造的 | 走同一套 `collectDeliveryIssues` + `deliveryVerdict`（`htmlOk` 用**真实** `checkHtml`），通过才提交成品，不通过只存草稿并**如实说明** |
| P2-1 | 单项重试用**未按本候选正文过滤**的台账未完成项 → 重试成功仍判"仍有素材未完成"，还给一个点了没有任何变化的按钮 | 与 `turn()` 同口径按 `identityKeysOf` 过滤 |
| P2-2 | 取消检查排在"接受"之后 → 停止恰好落在流结束与门禁之间时，仍会把候选提升成成品并显示"成品已验收并保存" | 取消检查前移到接受之前 |
| P2-3 | 准备阶段失败路径只写会话文件、不更新界面 → 对话区留下一个空气泡 | 新增 `setAssistantText`，两条失败分支都写入可见说明 |
| P2-4 | 普通答复里带 ```` ```v2 ```` 示例时，`updateAssistant` 会把**已验收成品的预览替换成一段示例**并清空交付状态，导出按钮还指向示例 | 答复走文字专用入口，不触发预览解析 |
| P2-5 | `preview-safe` 占位符自带单引号 → `src='…'` 被截断成无效 URI；`srcset` 全被过滤时留空串（注释承诺的降级不存在） | 占位符单引号写成 `%27`；全过滤时退化为占位图 |
| P2-6 | `stagesChecked` 声明了本轮**没有输入**的 `version` → `checks.version='pass'` 的空结论，且与同对象的 `unverified:['version']` 自相矛盾；重试路径干脆不传，导致全表一律 pass | 只声明真正喂了输入的阶段 |
| P2-7 | 草稿版落盘 `trace` 不查返回值却写 `ok:true`（相邻两个分支都查了） | 改为按返回值记 |
| P2-8 | 重试被取消后仍会落一份"少一行素材引用"的草稿 | 取消后不再落库，记 `rollback/cancelled` |

同时修掉**自己脚本里的恒真/弱断言**（审计点名）：`prep-contract-check` 的"阶段上报非空"（`say` 必定执行）改为按次数断言、并让此前只采集不断言的 `secondHasToolResult`/`correctionSent` 真正参与判定；`preview-resource-check` 去掉 `external` 的二次过滤（原写法把"非 example.com 的 document 请求"整类排除）与 iframe 检查的"或"式弱判定；`repair-integrity-check` 的正文投影 fixture SVG 原本只有属性（关掉整段 SVG 剔除照样绿）改为带可见文字。

新增回归断言（均可证伪，实操变异确认变红）：`repair-integrity-check` 新增 ③b 节 5 组改写不误报 + 4 组真删仍报 + 3 组假事实钉死，并补 `10月1日 ≠ 10月10日` 与规范化边界一节；`delivery-quality-check` 新增 ⑦⑧⑨⑩ 四节（冻结基准、末轮条数下降、素材重试、三者同源）与 ⑪⑫（代码块不是泄漏、正文边界必须可见）。**`delivery-quality-check` 现 123 条、`repair-integrity-check` 现 58 条**，离线九脚本合计 **602 条**。

**审计确认没问题的部分**（同样记下来，避免只记问题）：门禁没有旁路（接受的每个分支都以 `verdict.ok` 为前提，`htmlOk===false` 与"声称 applied 却没给结果"都会**补**阻断）；`parseFinishArgs` 的多围栏/不闭合/空 source/未知 outcome/非法 JSON 全部拒绝；`preview-safe` 只作用于显示层，`data:`/`blob:` 不动；`bodyText` 确实剔除整块 SVG、行内代码与系统占位，并**保留**转义后的泄漏供 `leakIssues` 阻断。

#### 未完成（不得标为已验收）

- **真实模型回合未跑**（首篇 / 续改 / 重开 / 导出）：需真实 API 付费授权，本轮未获授权。因此 F2/F3 只在**受控 stub** 下证明契约与执行正确，"模型真的会用 `finish_preparation`"尚无实测证据。
- 微信端观感、真实后台上传、断电恢复、多实例并发提交、图像理解：均未覆盖。
- `PREP_EVERY_TURN=true` 使每个桌面回合多一次**非流式**准备请求（纯对话以 `reply` 结束、不再追加撰写请求，总请求数持平）；这一取舍未在真实模型上验证成本与体感。

---
## 2026-09-29

### [Research][Docs] 独立能力验证后的 DS 修复指南（待实施）

- 依据本轮实际验证及追加只读源码核对，新增 [完整修复指南](docs/design/ds-repair-guide-2026-09-29.md) 与 [仓库内失败夹具/证据索引](docs/artifacts/2026-09-29-capability-review/README.md)，给出分批实施、文件责任、正反回归、版本指纹与隔离真实验收步骤。
- 核心问题：自动修复没有建立事实基准，丢事实仍提交；准备阶段只认整串 READY，完整 v2 稿件也被当澄清提前结束；历史 `|new` 与正式素材引用不一致；未经门禁的预览发起禁止外链请求。另登记事实匹配误杀/漏检、严重度与布尔门禁矛盾和测试工具的弱断言。
- 补核真实会话后校准描述：第三回合模型已给出完整修改稿，但应用只保存聊天而未提交文稿；不能把 UI 隐藏围栏后的助手摘要当成完整模型响应。
- 本次仅新增/同步文档与合成失败夹具，未实施产品修复、未追加模型调用。已核对证据路径、JSON 与文档链接；原始日志和失败产物保留。修复状态登记在 REQUIREMENTS，后续不得将本条标为代码已修复。

### [Change][Build] 批次 C（Rust 侧）：文档存储改为不可变版本目录 + 提交指针（计划 §7）

**问题**：旧 `documents.rs` 对 `documents/<docId>/` 下的 meta.json / source.md / article.html **依次就地覆盖**。
每一步都是"截断 + 写"，中途失败（磁盘满、进程被杀、断电）就留下**半新半旧**的一篇稿子——
source.md 已是新稿而 article.html 还是旧稿，用户拿到"新源文配旧 HTML"的混合版本，既不能回滚也不能重放。
多个 write 之间没有事务，跨文件 rename 也不是事务（rename 一次只替换一个名字），旧实现据此假设"三个文件会一起生效"。

**根因**：落盘单位是"文件"，而恢复单位是"版本"。只要一次保存不是以整份版本为原子单位安装 + 指针提交，
中途任何一种中断都会产生无人能判定的中间态。

**改动**（只动 Rust，前端未接线）：
- `src-tauri/src/documents.rs` 重写存储层：
  - 布局 `documents/<docId>/{manifest.json, revisions/<revisionId>/{source.md,article.html,meta.json}, staging/<transactionId>/}`；
  - 提交协议：写 staging → **读回磁盘**校验文件齐备/哈希/绑定/质量记录 → staging 目录**整体改名**为 `revisions/<rev>` → **一次同目录 rename** 换 `manifest.json`（唯一提交点，Windows 走 `MoveFileExW(REPLACE_EXISTING)`）；
  - 提交前检查 `generation` / `baseRevisionId`，不匹配返回"提交被拒绝：…"且**不写任何内容**（迟到请求不覆盖用户较新的提交）；
  - 提交失败/中断时旧指针逐字节不变，**不先删旧文件**；孤立 staging 与历史版本保留供诊断，不自动提升、不自动清理；
  - 版本 meta 记 runId / 检查版本 / **文件 SHA-256** / 验收状态 / 前端传入的 `quality` 原样存储（Rust 只存不解释）；声明 `verified` 必须带 quality，否则拒绝提交；
  - 旧布局迁移：原三文件**保留不删**，复制为 `revisions/legacy/` 并标 `unverified`（旧稿无验收记录 → 不作合格回滚目标）；meta 读不出来时**明确报错**，绝不按"没有旧稿"继续覆盖。
  - 保留 R3 口径：`list_documents` 仍返回 `items` + `unreadable`，坏文档如实上报而非静默消失。
- `src-tauri/src/lib.rs`：新增并注册 `list_document_revisions` / `open_document_revision` / `commit_document_revision`。
- `src-tauri/Cargo.toml`：`sha2` 提为直接依赖（锁文件里早已存在，不新增包）。

**验证**：`cargo test --lib` **131 项全绿**（原 120 项无退化，新增 11 项故障注入/迁移/CAS 用例），
全部在 `std::env::temp_dir()` 独立目录内进行，**未读写真实工作区**、未启动桌面应用、未跑 pnpm。
覆盖计划 §10 中属于 Rust 的行：六个提交中断点后"已提交版本可读且无混合版本"、未提交候选不成为成品、
generation/baseRevisionId 拒绝覆盖、提交失败旧指针逐字节不变、旧文档迁移与迁移失败不覆盖、哈希不一致如实报错。
另用两次变异验证这些断言不是恒真：①把新源文直接写进已提交版本 → 用例失败（哈希与版本断言捕获）；
②把六个故障点改成失效 → 用例失败（`expect_err` 捕获）。

---

### [Research][Docs] 最新稿源码泄漏与质量恢复方案（未实施）

核对 10:35 保存的真实文档 `s1790565874610554000`、请求记录及生产模块离线复现：3 处转义 SVG 泄漏来自照片位吞并后续素材块；素材拒收/超长告警未命中自动修订，HTML 检查不参与保存门禁；现有回退只覆盖有图变零图，且未保存完整历史版本。

按用户要求新增 [修改方案](docs/design/quality-recovery-plan-2026-09-29.md)，明确解析、统一质量结果、素材失败回写、定点修复与复检、完整版本提交和回滚、故障注入验收。同步 docs/README、STRUCTURE、REQUIREMENTS 与精简进度。仅文档变更；未修改源码或真实作品，未调用付费模型，未实施方案或重新做桌面验收。

### [Debug][Change] 全量修复：按只读审计逐条修掉"让用户得到错误结论"的地方

用户指令："全量修复"。做法：先派 **11 个并行 agent**（4 个写、7 个只读审计），
用审计结果驱动修复；每个 agent 独占互不重叠的文件，主会话负责接线与收口。

**审计发现的三条系统性倾向**（不是零散 bug，是习惯）：

1. **读路径与扫描路径习惯性降级**：写路径与对话主链路很诚实（落盘一律 `?` + 中文上下文、HTTP 非 2xx 带状态码报错），
   但读路径普遍用 `unwrap_or_default()` / `if let Ok(..)` 无 else / `_ => continue`，把"读不出来"折叠成"不存在/为空"。
   结果：**列表类界面无法区分"没有"与"坏掉"**。最危险的一条是**影响扫描**——把"某篇文档读不出来"当成"没有引用"，
   用户据此覆盖素材，实际改坏那篇文档。
2. **前端持久化链路把"失败"折叠成"空"**：`catch { return [] }` / `return null` / `return {items:[],current:null}`，
   调用点只判"空不空"，于是**读失败与真的没有数据在类型上不可区分**；三个空态文案（"还没有文档/会话/素材"）
   都没有对应的失败态。连带：`listAssets` 读失败返回空库 → `materializePlaceholders` 把正文里**已有**的 `[[asset:…]]`
   判成"库里不存在" → 剔除 + 告诉用户"素材不存在"（与事实相反）+ 触发自动重写。
3. **测试假绿**：恒真断言（`count() >= 0`）、条件即结论（`if (ok) check(..., true)`）、
   断言实现副本而非生产逻辑（测试里另写一份 `read_settings_from`）、以及**把结论硬编码进产物**
   （`fixture-repair` 报告里的验收清单是字面 `[x]`，解析链路整体回归也照样打印"全部恢复绑定、0 次绘图"）。

**修的（逐条）**

- **Rust 读路径如实化**：`sessions.rs`/`documents.rs`/`assets.rs` 的列表新增 `unreadable`（坏会话/坏文稿/坏素材如实上报，
  不再凭空消失）；`state_warning`（state.json 读或写失败）、`scan_warning`（影响扫描不完整，
  明说"请勿据此断定没有文档在用"）、`AppSettings::load_error`（设置文件损坏，原文件已保留）。
  `documents.rs` 的 `article.html` 从 `unwrap_or_default()` 改为区分 `NotFound` 与 IO 错误。
  `export.rs` 图片导出按实际写入数回报 + 重名自动加序号（此前会静默覆盖且汇报张数按输入算）。
- **前端持久化诚实化**：lib 层新增 `listAssetsSafe`/`getAssetSafe`/`openDocumentSafe`/`loadAppSettingsSafe`
  与 `{ok:…}`/boolean 返回，读失败**不再等于空**；`DocsPane`/`SessionRail`/`AssetWorkshop`/`SettingsPanel`
  给出失败态 + 重试；`removeSession` 删除失败不再清空会话栏、不再 `clearAllChat()`；启动时列表读失败**不再自动建会话**。
- **素材协议五处不一致**（F1/F4/F5/F6/F12）：指纹缺身份段导致两处同说明的 `[[asset]]` 被并成一个素材位；
  `|new` 与旧角饰块的冲突检测是死代码；**未识别的协议行会原样漏进正文**（"成品零协议残留"不成立）；
  分类别名表缺最常用的「气泡角饰」；只有旧文字角饰块的正文永远走不到恢复路径（新增 `needsMaterialize`）。
- **`svgBlock` 区分"没有"与"读不出来"**：`null` 曾同时表示两者。读不出来若按"没有"处理，
  在检索命中路径上会**直接重新绘制一张**（库里明明有）——白等几十秒 + 白花钱。现在分别处置：
  只有"确实没有"才计入可修复项（值得自动修订），"内容为空/读不出来"如实报错并要求在清单上单项重试。
- **`chat.rs` 三处**：流式 HTTP 200 但零增量曾被当成成功（助手空气泡 + 日志记 `ok=true`）→ 现在记为 `empty` 失败；
  prep 工具调用字段缺失曾静默降级成空串（无法派发且无线索）→ 现在报错点明字段；
  HTTP 客户端构造失败曾兜底成"没有任何超时"的 client（把阶段 4 刚加的超时丢掉）→ 现在返错，无 `expect`。
- **测试假绿清理**：S8 的恒真断言改成真断言"切回了目标会话"（对 localStorage 真值比对）；
  `fixture-repair` 报告的验收清单改成由实测值拼出、未达成即非 0 退出；删掉 3 处装饰性恒真断言；
  阈值与文案取同一常量（S1.8 素材张数 4→5）；`retry_after` 解析抽成生产函数供测试直调；
  `live_article_sample` 的审美违规从"只打印"改为**断言**。
- **`verify-ui` 不再覆盖 README 配图**：默认输出目录改为 `<YYYY-MM-DD>-e2e`（此前每跑一次就覆盖 `docs/artifacts/*.png`，
  让 README"非本轮截图"的声明失效）。同时去掉硬编码的作者机器路径，改为 `require('playwright')` →
  `VERIFY_PLAYWRIGHT`/`VERIFY_CHROMIUM` 环境变量，**两条都拿不到时明确报错退出**（不静默跳过）。
- **三处迟到的接线**：会话改名（后端 `rename_session` 早已实现并注册，前端零调用）、
  导出按钮与 `busy` 关联（此前生成中点导出能导出半成品）、`load_error` 的线上通路
  （`serde(skip)` 同时跳过序列化与反序列化 → 前端永远看不到，改用包装类型 `SettingsView`）。

**验证**

- `cargo test`：**120 项通过**（+ 4 项 ignored 的 live 冒烟）。新增含"坏会话/坏文稿/坏素材如实上报"、
  "state.json 只读写不进告警"、"导出重名不覆盖"、"`load_error` 不落盘但**必须**出现在线上返回"、
  "HTTP 200 非 SSE 不算成功"（含变异验证：把判定改坏后 2 条测试变红）。
- 离线脚本全绿：`progress-check` / `asset-resolve-check` / `compose-check` / `svg-quality-check` / `trace-check` / `fixture-repair`。
- `verify-ui` **S1–S21 全绿（VERIFY OK，90 PASS / 0 FAIL）**：新增 S19（保存失败契约）、S20（生成中导出禁用，
  rAF 逐帧采样）、S21（会话改名：双击/Esc/失焦/Enter/刷新后仍在）。S8 从恒真改为真断言后**仍然通过**（说明修的是断言不是功能）。
- `raster-check` RASTER OK（按真实尺寸的角饰校准表未变）。
- 路径缺失实测：不设环境变量或指向不存在的路径时，`verify-ui` **明确报错并 exit 2**，不产生任何输出目录。
- **桌面端真机通路核对**（隔离工作区 + CDP 连真实 webview）：新增的 `list_assets_report` 命令只在桌面才走得到，
  离线脚本都走 localStorage 桩，所以单独验了一次——应用启动后会话栏正常（1 行、**无** `data-list-error`、无 `[data-notice]`，
  说明 `SessionsList` 的新字段 `unreadable`/`state_warning` 解析正常）；切到素材工坊**无** `.ws-error`，
  即新命令在真实桌面链路上可用（8 个分类按钮、空分类显示空态而非失败态）。
- 按铁律 7 重建 release：`pnpm tauri build --bundles nsis` 成功；`wechat-mp-desktop.exe` 启动 14 + 10 秒存活（约 80MB）后按 PID 结束进程树。
  首次构建被一个 3MB 的**无窗口残留进程**（PID 12900，我这轮验证中留下的）锁住 exe，报了 `拒绝访问 os error 5`；
  经用户确认后准备结束它时发现它已自行退出，随即重建成功。

**本轮的一次真实副作用（如实记录）**：核对发现**真实工作区**在 02:39–02:42 被写过——
新增 3 枚 `origin=article-fallback` 的 `art-inline` 素材，另有 2 个会话文件被自动存档改写。
时间点与那个残留进程（启动于 02:39:42）吻合，判断是**某个子 agent 直接启动了真实应用并跑了一个创作回合**，
而不是走本轮约定的 `USERPROFILE` 隔离。代价是真实 API 调用与用户素材库多了 3 条记录。
后续跑真机验证必须显式设置 `WXMP_HOME`/`USERPROFILE` 指向临时目录；这条已写进 `docs/DEVELOPMENT.md` 的真机小节。

## 2026-09-29

### [Debug][Change][Build] 真机验收三小样：修掉"绘图必然失败"的输出上限问题

用户指令："你来进行测试"——由我跑修复计划阶段 6 第 3 条的真机三小样。
**这一轮不是复刻链路**：桌面应用跑在 WebView2 上，加 `--remote-debugging-port=9222` 后
Playwright 经 CDP 直连它的 webview，点的是真实按钮、走的是真实 TS 编排、调的是真实 Rust 命令、
打的是真实 DeepSeek 接口。唯一"模拟"的是输入框里那段用户话术。全程隔离：给进程换
`USERPROFILE` 指向临时目录，真实作品目录一字未动（跑完核对仍是 15 会话 / 3 文档 / 7 素材且无 `traces/`）；
临时目录里的凭据副本跑完已删除。驱动脚本 `scripts/live-three-samples.mjs`。

**三题全过**（证据在 `docs/artifacts/2026-09-28-repair/live-traces/*.jsonl`，原始日志随仓库保留）：

| # | 结果 | 关键证据 |
| --- | --- | --- |
| ① 有库复用 | 通过 | 1 个素材位 `reuse`（按素材 **ID** 精确命中 `as-1789145721283342400`）；**绘图 0 次**；预览 1 张图；未完成 0 |
| ② 仅缺一张新图 | 修 bug 后通过 | **绘图 1 次且一次成功**（`stop`、`completion 18574`、产出 SVG 6874 字、74.5s）；star 角饰 `reuse`；预览 2 张图；未完成 0 |
| ③ 已有稿只改正文 | 通过 | **绘图 0 次**；两个素材位都 `reuse`（② 新画的已存回库、按 100% 重合命中）；正文 294→171 字；预览仍 2 张图 |

合计约 **15.9 万 token**（六次真机回合，含一次失败重试）。

**真机逼出来的问题一（真 bug）：非流式输出上限 8000，导致画图必然失败。**

第 ② 题第一次跑，新画横幅**连续两次返回空正文**。日志数字是决定性的：
`finishReason: "length"`、`usage.completion: 8000`（正好等于上限）、`responseLength: 0`、
耗时 35.3s / 35.6s——**推理开销自己就吃光了预算，一个字都没轮到输出**。对照同轮文字创作
（`completion: 6525` 而正文仅 584 字），可见该模型的推理 token 远大于产出 token。
修好上限后再画一次：`completion: 18574`、产出 6874 字 —— **实际需要约 1.86 万 token，8000 注定失败**。

这与 `chat.rs` 里那条历史注记（"早先实测 flash 画 SVG 会推理吃光预算、content 为空"）是同一失效模式，
但这次有 `finish_reason` 与 `usage` 作证，不必再靠猜。修法是**提高上限而非换模型**：
`DEFAULT_NONSTREAM_MAX_TOKENS` 8000 → 32000（`DEEPSEEK_NONSTREAM_MAX_TOKENS` 可覆盖），
上限只是允许空间，模型写完就停。改动点：`chat.rs`（新常量 + `nonstream_max_tokens()` + 更新历史注记
+ 新增断言 `nonstream_budget_is_large_enough_for_reasoning_plus_output` 防回退）。

**上限不再靠猜，改成问服务端要（2026-09-29 补做）。**

把上限从 8000 提到 32000 仍然是我猜的。用户要求"真实去查这个模型的上限"，于是直接问服务端
（`GET /models`）：`deepseek-flash`（DeepSeek-V4.1-Flash）**上下文窗口 1,048,576、最大输出 393,216**，
输入支持 text+image，推理档位 low/high/max 且**默认 high**。

**猜错的两种代价都实测过**：猜低 → 静默截断（8000 那次 `finish_reason=length`、正文为空）；
猜高 → 服务端 400（实测 `max_tokens=400000` → `Invalid max_tokens value, the valid range of
max_tokens is [1, 393216]`，而 400 属于不重试的 `auth` 类，整次绘图直接失败）。两种都很难查。

改成**运行时查询并缓存**：新增 `ModelLimits` + `model_limits()`（打一次 `GET /models`，按
「端点+模型」缓存）→ 非流式上限取该模型的真实 `max_output_tokens`；查不到（离线/403/返回体异常/值为 0）
安静退回**已验证可用**的 32000，绝不让创作因此失败。流式档位保持不变、只加钳制——实测真实桌面创作
用掉 22,821 个 completion token 而独立探针里 2,000 字长文只用 4,299，**推理开销随上下文复杂度放大、
不随正文长度**，64000 有 2.8 倍余量，且流式刻意没有总超时，保留原档更稳妥。

**推理档位显式写死 `high`**（不再依赖服务端默认），并**否掉了一个诱人的优化**：把画图降到 `low`
看着能省，单次采样甚至显示快 2.6 倍。同一提示各跑 4 次、用产品自己的 `checkSvgQuality` 判定后：
`high` **4/4 过闸**，`low` **0/4 过闸**（四次全部"有可见元素完全落在画布外"），实际也只快约 15%
（42.3s vs 50.1s）。**单样本不可信**——同档位内耗时波动就有 2 倍（32.6s ~ 71.9s）。

与超时的关系：按实测吞吐（约 268 token/秒），180 秒超时约合 4.8 万 token——**真正兜住跑飞的是超时**，
上限只负责不去人为截断。

**问题二（我自己的埋点有缺口）：空正文把最有诊断价值的字段丢掉了。**

原 `raw_completion` 在正文为空时直接 `Err("模型未返回内容（或返回内容为空）")`，
`finish_reason` 与 `usage` 在被抛出的那一刻就没了——日志里只剩"空返回"，
分不出"服务端真的给了空"还是"被截断了"。第一次跑失败时我就撞在这个缺口上。
改成空正文**不当异常抛出**，先把 `finish_reason`/`usage` 带回去、由调用方判定失败分类；
改完立刻拿到 `length` + `8000/8000`。

**顺带修的测试偶发**：`fake_server_cancel_stops_waiting` 原来断言取消后 3 秒内返回，
机器满载时偶发假红（本轮真机验收期间撞到过一次，之后 9 次连跑未复现）。断言本意是
"没有等满服务端的 5 秒"，放宽到 4 秒仍守住该语义，不再受调度抖动影响。

**真机顺带证实的两件事**：①**绘图真的慢**——一次成功的横幅绘制 74.5 秒，这解释了
"不重复画"比"画得更快"更值钱（第 ③ 题因此直接省掉一次 74 秒），也说明 240 秒的单素材位预算定得合理；
②**失败结果确实没被当成正文**——第 ② 题失败那轮界面警告是"已从正文中移除 1 处未解析的素材协议行"，
正文里没有"此美术素材生成失败"这类字样，批次一的修复在真实链路上生效。

**文件**：新增 `scripts/live-three-samples.mjs`、`docs/artifacts/2026-09-28-repair/live-traces/*.jsonl`、
`docs/artifacts/2026-09-28-repair/live-sample-{1,2,3}.png`；修改 `src-tauri/src/chat.rs`
（模型上限运行时查询与缓存、上限钳制、推理档位显式化、空正文携带元信息、历史注记更新、测试）、
`docs/design/repair-2026-09-28-batch2.md` §四、`docs/DEVELOPMENT.md`（配置说明）。

**验证**：`cargo test` **101 项通过**（新增：上限钳制、兜底四情形、档位钉死、
"按服务端报的上限发请求"的端到端断言、`/models` 判定；并修掉假服务因**端口复用**导致的随机失败
——上限缓存键加上端点、每个假服务实例用唯一路径前缀）。离线五脚本、E2E S1–S18、
`raster-check` 全绿；改动后**重跑真机第 ②③ 题**：新画横幅一次成功
（`finishReason: stop`、`completion 21238`、产出 8358 字 SVG、83.6 秒），改正文一轮 0 次绘图；
release 重建 + 启动冒烟。

## 2026-09-28

### [Change][New Feature][Build] 素材修复第二批（阶段 4–6）：等待控制、实际尺寸视觉检查与交付验收

同一份修复计划的第二阶段。批次一的根因与口径见 [批次一记录](docs/design/repair-2026-09-28-batch1.md)；
本批决策与取舍见 [批次二记录](docs/design/repair-2026-09-28-batch2.md)。

**阶段 4：限制等待和调用放大**

- **有界并发**：`materializePlaceholders` 改为三段式——①逐个素材位做决定（只读本地库，不调模型）；
  ②需要绘制的素材位交给最多 **2 个并发**的执行器；③按**正文原始行序**组装。
  "相同输入共享在途任务"是台账的自然结果（同指纹 → 同一条台账记录 → 只画一次），不需要另建表。
  并发只发生在绘制段：检索、复用判定、遗留块恢复全部留在决策段顺序执行（本地且便宜，并行只会引入不确定性）。
- **超时三层**（此前所有请求都没有应用级超时，网络卡住只能干等或强杀）：连接 15s（所有请求）、
  单次非流式 180s（绘图/补描述/prep/视觉复核）、单素材位累计 240s（前端，含排队后的执行、重试、补描述）。
  三个值均可用环境变量覆盖，是**初始参数**而非实测速度。**流式对话刻意不设总超时**——
  写长文可能持续数分钟，掐总时长会杀掉正常创作。前端超时"到点即返回"但不取消底层调用，底层由 Rust 侧 180s 兜底。
- **后端取消句柄**（新增 `cancel.rs`）：此前"停止"只是前端不再显示，请求仍在跑、仍在计费。
  现在 `cancel_run(runId)` 置位取消信号，所有长耗时调用包在 `run_cancellable` 里立刻返回；
  **流式事件带 runId**，旧回合的迟到增量被前端丢弃，绝不写进新回合草稿；停止后不再派发素材任务、不再入库。
  实现上踩到两个 `watch` 的坑并钉了单测：必须用 `watch` 而不是 `Notify`（后者只唤醒当时的等待者，会丢掉先到的取消）；
  必须用 `send_replace` 而不是 `send`（后者在没有接收者时返回 Err **且不写入新值**——取消先于调用正是最常见情形）。
  **边界如实说明**：取消只保证本地停止等待与后续处理，不承诺服务端已停止计费。
- **鉴权类错误不重试；限流按服务端提示等**：失败分类按 HTTP 状态码判（前后端同一口径）——
  **401/403 与 4xx 其余** → 新分类 `auth`（重试不会改变结果，不重试）；**429 与 5xx** → `network`
  （限流与暂时性服务端错误，可在剩余预算内重试一次）。`Retry-After` 只在响应头里，
  沿用与既有 `CLARIFY:` 同一套文本协议由 Rust 加 `RETRY_HINT:<秒>` 前缀转发，前端解析后
  **只在剩余预算容得下这次等待时才重试**（等待 + 1 秒余量超出即结束并写明原因），
  只认秒数形式、上限 10 分钟（非法值与 HTTP-date 一律不猜）。
- **自动修订接上 `revise` 档**：此前一直走默认档（max/64000），已实现的 high/32000 修订档没被接上；现在显式传 `revise`（启用既有旋钮，非新增默认值）。

**阶段 5：按文章实际显示尺寸检查素材**

- **渲染尺寸**从"一律缩到 256px"改成按**真实组件宽度**（角饰 60px、正文插画约 210px、通栏 343px）
  栅格化 2 倍采样再折算。旧检查天然看不见问题：一张 60px 的角饰在 256px 下看起来很饱满。
  实测同一枚四叶草角饰在 60px 下量到主体 32px、在 256px 下 137px。
- **对比度**与**主体实际像素**两个新指标。主判据是 **P90 对比度**而不是平均值——实测发现真实库素材
  `star` 有一圈半径 72、几乎全白的氛围光斑把平均值拉到 12.5，按平均值会把它误判成"看不见"，
  而它主体其实很清楚（P90 = 41.3）。平均值只作地板（< 6 才算整幅与底色同色）。
- **阈值来自样例实测**，不是拍脑袋（`scripts/raster-check.mjs` 在浏览器里驱动真实模块打印实测表）：
  P90 ≥ 24、平均 ≥ 6、主体短边 ≥ 12px。合格样例 clear（28.0px / P90 176）通过；
  退化样例 faint（P90 13.3，"浅色消失"）与 dot（主体 6.0px，"缩成一个点"）被拦下；
  **三枚真实库素材（bud 19.5px、star 25.0px、四叶草 32.0px）全部通过**——阈值只拦真退化，不误杀薄弱但可用的素材。
- **既有库存不被批量重画**：本层只作用于**新绘制**的素材（`acceptSvg` 只被绘图路径调用），
  库素材走显式引用/复用时**不经过复检**，因此 bud/star/四叶草这些"薄弱但可用"的既有素材不会被静默重画或覆盖。
- **角饰作画提示收紧**：只画一个主体、轮廓要粗（主要色块宽度 ≥ 40 画布单位，约合 60px 下 8px）、
  透明边距约占画布 1/4、颜色明度不高于 85%；明确禁止"扩大整幅图片"来掩盖问题。

**阶段 6：以失败样例验收与交付**

- **可控假 HTTP 服务**（`chat.rs` 的 `tests::fake`，最小 HTTP/1.1、`127.0.0.1:0`）：5 个新测试覆盖
  正常返回（带 `finish_reason`/`usage`）、**超时**（服务慢 2 秒 + 客户端限时 1 秒 → 1 秒附近返回而不是等满 2 秒）、
  **HTTP 错误分类**（401/400 → auth，500/429 → 非 auth）、**流式增量与元信息**（两段 delta + finish_reason +
  usage + `[DONE]`）、**取消**（慢响应 + 80ms 后取消 → 立刻返回且分类为 cancel）。这层此前只有
  "离线断言"与"真实模型冒烟"两极：前者测不到网络行为，后者要花钱且不可控。
- **离线断言扩充**：重名引用判歧义（按 ID 仍可精确命中）、非角饰同名被用途不兼容拦下、坏 SVG 明确报错不靠重画掩盖、
  跨自动修订复用（第二轮成品与首轮逐字一致、不重复入库）、失败预算不因新轮次重置。
- **交付物**：`scripts/fixture-repair.mjs` 从真实失败样例产出 `docs/artifacts/2026-09-28-repair/`
  下的修复副本（源文 + 375px 可直接打开的 HTML）与前后对比报告，含逐素材位绘图尝试次数与请求统计。
  边界：**只读**真实作品目录、**不覆盖原稿**、**不联网不调模型**（缺料走浏览器演示池），
  因此只证明**解析链路**修复了，不冒充真实模型产物证据。

**文件**：新增 `src-tauri/src/cancel.rs`、`scripts/raster-check.mjs`、`scripts/fixture-repair.mjs`、
`scripts/fixtures/deco-calibration/`、`docs/design/repair-2026-09-28-batch2.md`、
`docs/artifacts/2026-09-28-repair/`；修改 `chat.rs`（超时、取消接线、`auth` 分类、流式事件带 runId、
角饰提示、假服务测试）、`lib.rs`（注册 2 个命令 + 托管取消表）、`trace.rs`（词表加 `auth`）、
`Cargo.toml`（tokio 提为直接依赖）、`svg-raster.ts`（重写：真实尺寸 + 对比度）、`image-agent.ts`
（三段式 + 并发 + 超时 + 取消回调 + 角饰按真实尺寸过闸）、`svg-quality.ts`（导出 `SLOT_PX`）、
`trace.ts`（`auth` 分类与可重试判定）、`chat.ts`（`cancelChatRun`/`DeltaPayload`）、
`App.tsx`（停止接后端取消、重试前清取消态、自动修订传 `revise`）、`asset-resolve-check.mjs`、
`trace-check.mjs`、四份文档。

**验证**

- `cargo test`：**95 项通过**（新增 5 项假服务测试 + 限流 `Retry-After` 转发与解析 2 项；`cancel.rs` 5 项；`trace.rs` 词表与 `send_replace` 相关断言），0 警告。
- 离线断言全绿：`compose-check` / `svg-quality-check` / `progress-check` / `asset-resolve-check` / `trace-check`。
  其中 `trace-check` 新增阶段 4 断言：并发峰值 **=2 且不超过 2**、四个素材位各画一次、
  **结果按原素材位顺序组装**（实测顺序 甲图,乙图,丙图,丁图）、相同描述只画一次且两处都拿到成品块、
  超时 60ms 限时实测 61ms 返回、取消后绘图 **0 次** / 入库 0 次 / 成品无素材块 / 未完成清单 4 项；
  分类断言含 429/503 → network（可重试）、404 → auth（不重试）、等待提示解析（无提示返回 null，不猜）。
- `raster-check`（新）：`RASTER OK`。实测表见 [批次二记录](docs/design/repair-2026-09-28-batch2.md) §2.3；
  并断言"按 60px 与按 256px 的度量确实不同"、"主体像素随显示宽度等比缩放（ratio=4.28，理论 4.27）"。
- `pnpm build`（tsc + vite）通过。
- `verify-ui` **S1–S18 全绿（VERIFY OK）**：角饰按真实尺寸的新闸门没有破坏 mock 演示链路（S1.8 五张素材照常渲染）。
- `fixture-repair`：产出修复副本。已有素材复用/恢复 **4 处**、绘图 **3 次**、未完成 **0** 处、
  成品 `<svg>`/`<img>` **7/7**、无协议残留；四个既有素材位的绘图尝试次数均为 **0**。
- 按铁律 7 重建 release：`pnpm tauri build --bundles nsis` 成功，产物
  `智序_0.1.0_x64-setup.exe` 与 `wechat-mp-desktop.exe`（22:39）；启动冒烟 12 秒存活（PID 68472，约 81MB）后按 PID 结束进程树。
  （限流提示改动后已重跑全套离线断言与 E2E，并再次重建。）

**未覆盖 / 明确未做**

- **真实模型三小样**已在 2026-09-29 **跑完并通过**（由我驱动真机，见本文件最上方那一节）：
  第 ② 题逼出一个真 bug——非流式输出上限 8000 使绘图必然返回空正文（`finish_reason: length`
  且 `completion` 正好用满 8000），已提到 32000 并加断言防回退。
- **微信端真机观感**需人工看图：本轮数值只覆盖"看不看得见"，不评价美感与整篇节奏。
- 取消不做跨进程硬中断：本地停止等待 + Rust 侧超时兜底；服务端是否已停止计费不作承诺，界面文案也不宣称。
- 并发上限、超时、位预算都是**初始参数**，不是实测出来的速度；调整需要真实请求数据（见批次一记录的请求证据）。

### [Debug][Change][New Feature] 素材复用与交付修复（批次一：阶段 1–3）

用户指令：按仓库外的真实运行修复计划实施（依据同目录运行调查）。计划本身规定分两批交付，
**本轮做第一批（阶段 1–3）**：①保存可复现样例与请求证据；②修复素材协议与历史错误写法；
③把自动修订与素材重做分开、正确保留失败草稿。决策与取舍见 [修复决策记录](docs/design/repair-2026-09-28-batch1.md)。

**事故与三条已确认根因**（来自真实落盘证据，非推测）：最新「筑基」稿最终 HTML 里 0 张图、
3 条绑定全部 `source=failed`、7 条告警（3 条"装饰素材未达标"+3 条"角饰未定义"），
但库里有四枚现成素材，助手却说"修好了"。

1. **中文分类引用被整条丢掉**：检索结果只给中文分类名，解析器正则只认 `[a-z-]+` →
   中文分类的引用连"是否为引用"都判不出来，既不进 `residual` 也不产生警告，原样漏进成品 HTML。
2. **质检反馈教出错误写法**：旧提示写"请先用 `::: art deco 名称` 定义现场装饰素材"，
   而 `::: art deco` 是**解析后的内部格式**（块内必须有 SVG）→ 模型写出空块、引擎忽略、
   气泡引用报"未定义"。
3. **等待被成倍放大**：自动修订每轮整篇重来且每轮重做素材解析，失败图位每轮重获预算；
   离线注入实测同一输入连跑三次 = 6+6+6=18 次绘图尝试。

**阶段 1：请求证据**

- 新增 `src-tauri/src/trace.rs`：按回合独立 JSONL（`<workspace>/traces/<runId>.jsonl`），
  单文件 512 KB 上限、目录保留最近 60 个回合、runId 消毒防路径穿越；
  `trace_write` / `trace_start` 两个命令**恒返回 Ok**（写盘失败不阻塞创作）。
- 新增 `src/lib/trace.ts`（零 import 纯函数层）：五类失败分类、记录形状校验、汇总、
  runId/slotId 生成、可替换 sink 与内存缓冲（E2E/离线断言读它）。
- `chat.rs` 埋点：`gen_svg` / `refine_brief` / `prep_turn` / `chat_stream` / `review_assets`
  全部记录阶段·模型·起止墙钟·**单调耗时**·尝试序号·返回长度·`finish_reason`·`usage`·失败分类；
  流式额外从 SSE 里抓 `finish_reason` 与 `usage`（拿不到就记缺失，不编造）；
  **不记密钥、不记完整请求正文、不记参考图**。
- 失败分类必须区分"服务没给内容"与"给了内容但没有 SVG"：前者是服务/预算问题，后者是提示词问题。
  分类词表在 Rust 与前端各写一份，由 `trace-check.mjs` 交叉比对，改一侧漏一侧直接断言失败。

**阶段 2：素材协议**

- 新增 `src/lib/asset-categories.ts`（零依赖分类表）：英文键 / 中文显示名 / 简称别名三者互认，
  解析层与工坊共用，不再让纯解析层被迫依赖 Tauri。
- `asset-library.ts`：新增 `assetLine`（统一清单行：英文键+中文名+**稳定 ID**+名称+描述+可直接复制的引用）
  与 `assetRefOf`（按 ID 的规范引用）；`libraryDigest` 与 `search_assets` **共用同一个格式化函数**——
  两个入口给出不同口径正是本次事故的温床。
- `asset-resolve.ts`：新增 `parseAssetRef`（**宽匹配所有 `[[asset:…]]` 再校验字段**：未知分类、
  缺 ID、缺用途分别报错）与 `resolveAssetRef`（**按 ID 优先、名称只允许唯一匹配**；重名判歧义；
  用途不兼容直接拒绝，用途兼容但分类写错则按库记录恢复并保留告警）。
- 新增 `findLegacyDecoBlocks` / `resolveLegacyDeco`：纯文字 `::: art deco 名称` 块按
  文档绑定+固化快照 → 精确 ID → **唯一**库名称的顺序恢复，只认 `usage=deco`；
  未知/歧义/用途不符/与 `|new` 冲突一律明确报错，**绝不自动发起绘图**。
- 成品不再残留协议：解析不了的行从正文剔除（旧实现在失败位置直接写
  `（此美术素材生成失败：…）`，这正是真实稿里那 3 处污染），问题改由诊断信息与未完成清单承载。
- 诊断话术改口径：`compose.ts` 的角饰未定义提示、`revise.ts` 新增 `MATERIAL_RULE`
  只指向 `[[asset]] / [[img]] / [[deco]]` 并明说"不要写 `::: art` 容器"；
  `engine-write-protocol.md` §三.2/§四.6 与 `persona.ts` 同步。

**阶段 3：修订与素材重做分离**

- 新增 `src/lib/asset-ledger.ts`：一轮创作的素材结果表（稳定 `slotId`、输入指纹
  `kind|策略|规范化描述|主题`、策略、绑定的 ID/版本、成败、尝试次数、成品块与规范化引用）。
  边界写进文件头：只做**素材任务编排**，不承担意图判断/澄清/路由（铁律 6）。
- `image-agent.ts` 接台账：同一素材位在整个回合内**只做一次决定**——成功即复用成品块，
  失败即沿用结论且不再重获预算；单项重试（`retrySlotIds`）才重置该位的预算。
  绘制预算收敛为**每位最多 2 次绘图 + 1 次补描述**，且 `cancel` 不重试。
- `App.tsx`：自动修订接收**规范化源文**（已完成的素材位是稳定 ID 引用，模型重写不会把成品变回待绘图位）；
  完成状态按 `unfinished(ledger)` 判定；保存时若本轮渲染零图而上一版文档有图且有未完成素材，
  **保留上一版可用成品**（`source` 照常保存最新草稿，用户文字不丢）并写明原因。
- `PreviewPane.tsx` 新增**未完成素材清单**（`data-issues` / `data-retry-slot`）：逐项列出并可单独重试；
  重试就地重跑素材解析，**不发新对话回合**。CSS 用功能反馈色（红），不是解释性小字。

**文件**：新增 `src-tauri/src/trace.rs`、`src/lib/trace.ts`、`src/lib/asset-categories.ts`、
`src/lib/asset-ledger.ts`、`scripts/trace-check.mjs`、`scripts/lib/fixtures.mjs`、
`scripts/fixtures/2026-09-28-basement/`、`docs/design/repair-2026-09-28-batch1.md`；
修改 `chat.rs`、`lib.rs`（注册 2 个命令）、`documents.rs`（binding 加 `slotId`）、
`image-agent.ts`、`asset-library.ts`、`asset-resolve.ts`、`prep.ts`、`compose.ts`、`revise.ts`、`persona.ts`、
`chat.ts`、`App.tsx`、`App.css`、`PreviewPane.tsx`、`engine-write-protocol.md`、`asset-resolve-check.mjs`、`verify-ui.mjs`。

**验证**

- `cargo test`：**83 项通过**（新增 `trace.rs` 6 项：runId 消毒防穿越、长度上限、按字符截断、
  usage 只留 token 计数字段、分类词表、计时器单调性与缺省字段不写入；`documents.rs` 新增
  `legacy_binding_without_slot_id_still_opens`），0 警告。
- 离线断言全绿：`compose-check` / `svg-quality-check` / `progress-check` / `asset-resolve-check` / **`trace-check`（新）**。
- **真实失败样例回归**（新增，随仓库可复现）：以 2026-09-28 真实失败稿 + 四枚真实库素材副本驱动真实模块，
  断言——四枚全部恢复绑定（1 枚按中文分类引用解析、3 枚按旧角饰块恢复）、**这四枚复用位的绘图尝试数全为 0**、
  `residual=0`、成品与 HTML 无任何素材协议残留、**修复前的 6 条角饰告警全部消失**、成品含全部 7 张素材 SVG、
  无未完成素材位、规范化源文含四枚稳定 ID 引用。
- **`trace-check.mjs`（新）**：把 Tauri 通道桩进 `window` 让真实 `image-agent` 走桌面分支，
  逐个注入网络错误 / 空内容 / 无 SVG / 质检拒绝 / 取消五类故障 → 五类各自命中且形状合法、
  素材位带 slotId、绑定落成 `source=failed`；预算断言：前三类各重试 1 次（共 2 次绘图）、
  **取消不重试**（1 次）、质检拒绝留下逐条可读原因；台账断言：**三次素材化只花 2 次绘图（旧实现 6 次）**、
  成功的素材位跨 3 轮只画 1 次、单项重试才会再画一次；以及"日志 sink 抛错不打断调用方"。
- `pnpm build`（tsc + vite）通过。
- `verify-ui` **S1–S18 全绿（VERIFY OK）**。新增 **S18**：mock 返回含无效素材引用的稿子且修订轮不收敛，
  断言未完成素材清单出现、每项都有可点的重试、成稿不残留协议与失败说明、完成状态不采信助手自述、
  点重试**不发新对话回合**、重试仍失败时清单仍在（不假装成功）。
- 按铁律 7 重建 release：`pnpm tauri build --bundles nsis` 成功（无编译警告），产物
  `src-tauri/target/release/wechat-mp-desktop.exe` 与 `bundle/nsis/智序_0.1.0_x64-setup.exe`（21:43）；
  启动冒烟 12 秒进程存活（PID 20096，约 81MB）后按 PID 结束进程树。
  **中途第一次构建失败**（`failed to remove wechat-mp-desktop.exe / 拒绝访问 os error 5`）：
  使用者自己的应用实例正在运行并锁住目标文件（PID 23564，非本会话启动）。未擅自结束它，
  请使用者关闭后重跑即成功。已把该操作注意写进 [开发指南](docs/DEVELOPMENT.md) 的重建小节。

**未覆盖 / 有意未做**

- 阶段 4–6（并发与超时预算、后端取消句柄、鉴权类错误不重试、自动修订接 `revise` 预算档、
  60px 最终尺寸视觉检查、真实模型小样）属第二批，**本轮未开始**。
- `401/403` 目前仍归入 `network` 并允许一次重试；细分为"鉴权不重试"需新增分类，与阶段 4 一起做。
- 真实模型下的三小样（有库复用 / 仅缺一张新图 / 已有稿只改正文）需授权付费调用，未跑。
- `docs/design/` 下没有 `index.json`，本次按"行为变更"补了独立决策记录。

### [New Feature][Build] 对话区「AI 工作中」状态气泡

用户要求：AI 工作时要有气泡告诉用户现在在干什么（读资料、思考、撰写、发布素材任务、等待等不同状态）。

**改造前**：同一件事有三处提示——`.typing` 的「正在思考…/正在生成…」（由「助手气泡里有没有 ``` 围栏」推导，`think`/`gen` 两个类名在 CSS 里没有样式分支）、`.task-progress` 的一行步骤、空气泡里的「…」。而且 `progress.ts` 里 `TaskEvent.phase` 从未被读取（只取 `e.text`），`lastLine` 是从未调用的死代码；全仓唯一的上报点是 `image-agent.ts` 的 `say()`。

**改造后**：合并为一个助手侧气泡——阶段标签 + 真实细节 + 本轮已耗时，`data-phase` 便于 E2E 断言。阶段与信号源：

| phase | 标签 | 信号源 |
| --- | --- | --- |
| `prep` | 读取资料 | `prep.ts` 每个知识/素材工具执行前（新增 `onProgress`） |
| `think` | 思考中 | `prep.ts` 每次 `prepInvoke` 前；`App.tsx` 主流式发起前 |
| `write` | 撰写正文 | 主流式首个非空 delta |
| `asset` | 素材任务 | 派发批次总数 → 检索/视觉复核/复用/绘制第 N/M 张/入库 → `generateSvg` 回问重描述、重画 |
| `compose` | 排版与质检 | `renderV2` / `renderArtPlaceholders` 前 |
| `revise` | 自动修订 | 自动修订流发起前，细节含质检发现的问题数 |
| `save` | 保存文档 | 落库前（本轮把 `await persistDoc` 移到 `setBusy(false)` 之前，用户已确认接受多锁约 100–300ms） |

**两个实测发现（都改变了实现）**

1. **独立「质量检查」阶段做不出来**。`checkHtml` + `fixableWarnings` 是纯字符串检查，实测 < 1ms。用 rAF 采样与 MutationObserver（带 `attributeOldValue`）双重验证：React 把「质量检查」和紧随的「保存」并成一次提交，DOM 里从不出现这一帧，浏览器也没有绘制窗口。给人为最小停留会白锁输入 0.4 秒且那段"正在检查"并非真实耗时。用户选择**合并为「排版与质检」**（阶段数 8 → 7），质检结论改由本来就能被看见的地方承载：需要重写时写进「自动修订」细节（`发现 N 个可修复问题，正在重写…`），不需要重写时保留在右侧预览的质检条。→ [决策记录](docs/design/working-bubble.md)
2. **「保存文档」同样会被合并掉**。浏览器 mock 的 localStorage 落库是微任务链，几毫秒走完，React 会把「保存」与随后的「结束」并成一次渲染。改为 `flushSync` 强制同步提交 + 让出一帧。让帧必须带超时兜底——窗口最小化/隐藏时浏览器不派发 `requestAnimationFrame`，只等 rAF 会让回合永远卡在「保存文档」上。桌面端落库要走 Tauri invoke、本来跨多帧，这一步是真实可见的。

**纯展示边界**：气泡只读 `busy` + 就地事件 + `Date.now()`，不参与任何流程判断（铁律 6）。为此在 `asset-resolve-check.mjs` 加了不变式断言：同一输入在「上报进度」与「不上报进度」下产物逐字一致。

**文件**：`src/lib/progress.ts`（阶段扩到 7 个；新增 `phaseLabel`/`formatElapsed`/`prepToolLabel`；删死代码 `lastLine`）、`src/lib/prep.ts`（`runPrep(messages, { onProgress })`）、`src/lib/image-agent.ts`（批次总数与 `第 N/M 张`；`generateSvg` 子步骤）、`src/components/WorkingBubble.tsx`（新）、`src/components/ChatPane.tsx`（合并三处指示；`busy` 且助手消息为空时不再渲染空气泡）、`src/App.tsx`、`src/App.css`（删 `.typing`/`.task-progress`，加 `.work-bubble` 与脉冲点、`prefers-reduced-motion` 降级）、`scripts/progress-check.mjs`（新）、`scripts/asset-resolve-check.mjs`、`scripts/verify-ui.mjs`。

**验证**

- 靶向断言先行：`progress-check.mjs` 对改动前代码跑出 3 条 FAIL（`phaseLabel`/`formatElapsed` 未导出、`lastLine` 仍在），实现后全绿。实测期间还抓到一处真问题并修掉：工具名截断阈值 20 字符会把 `engine-write-protocol`（21 字符）截成 `…protoco…`，已按实测最长知识点文件名（`design-logic-components`，23 字符）放宽到 28 并加断言。
- 四个离线断言脚本全绿：`progress-check` / `asset-resolve-check` / `compose-check` / `svg-quality-check`。
- `pnpm build`（tsc + vite）通过。
- `verify-ui` **S1–S17 全绿（VERIFY OK）**。5 处 `.typing` 依赖改为 `.work-bubble`（含两处 `waitStreamDone` 谓词、S1.9、S9 `waitTurn`、S10 收敛判定），S16 的 `.task-progress` 同步；`waitStreamDone` 改为取**最后一个** `.msg-assistant-text`，修掉多助手消息时命中第一条的既有隐患。新增 **S17** 用两套采样分别断言：MutationObserver（带 `attributeOldValue`）证明「应用发出了这些阶段」→ `think → write → asset → compose → save`，rAF 采样证明「用户真的看得见」→ `think/write/asset` 都被绘制；另断言计时真的走动、回合结束气泡消失。
- 气泡各阶段截图核验（撰写正文 / 素材任务，如 `绘制素材（第 3/5 张）：花簇小角饰 ⏱ 2s`）。
- 按铁律 7 重建 release：`智序_0.1.0_x64-setup.exe`（19:31）；`wechat-mp-desktop.exe` 启动 12 秒存活（约 32MB）后终止。
- 中途一次构建失败（`failed to remove wechat-mp-desktop.exe: 拒绝访问 os error 5`）：上一轮冒烟启动的实例仍在运行、锁住了 exe。按 PID 结束进程树后重建成功。**记录为操作注意**：重建 release 前先确认没有正在运行的实例。

**未覆盖**

- **桌面真实模型下的完整阶段走查未跑**（读取资料 → 思考 → 撰写 → 素材 → 排版与质检 → 保存需要授权付费调用）。浏览器 mock 不做 prep，因此 `prep`「读取资料」与 `think`「分析需求…」这两个文案本轮只有离线断言覆盖，没有端到端证据。
- 素材工坊的 `rerenderDocWithCurrentAssets`（被引用文档用新版素材重渲染）**完全没有忙碌态**，属既有缺口，本轮按用户口径（只做对话区）未处理。
- 保存失败仍只在控制台 `console.warn`，界面不提示；用户会以为已保存。保留既有行为，需要单独一轮处理。

---
## 2026-09-28

### [Change][Build] 删除前端解释性小字

用户要求：删去前端各个地方的小字标注，所有无意义的小字全部删掉。追问确认口径为「只删解释性/装饰性小字，保留功能反馈与行内数据」。

删除清单（7 个组件）：

- 顶栏：品牌副标题「公众号推文助手」、「知识库 N 条目 · 三层结构」计数、「已自动保存 时间」。
- 会话栏：底注「每个会话独立上下文，自动保存」。**保留**每条会话的「N 条消息 · 时间」。
- 对话：知识命中折叠调试区（`details.debug-note` + `.knowledge-note`）整块删除、参考图条尾注「参考图随下一条消息发送，仅本次有效」、空态引导长句（保留快捷提示 chips）。
- 预览：空态提示「对话生成后，正文 HTML 会实时渲染在这里」。
- 设置：模型锁定说明块（原文含 `src-tauri/src/chat.rs` 的 `LOCKED_MODEL` 源码路径）、两段长说明（视觉复核计费口径、优先级与明文保存口径）、视觉复核勾选项的括号解释。
- 文档库：页头说明长句、空态第二句引导（保留「还没有文档。」状态语）。
- 素材工坊：页头说明长句、制作标题的分类括号、「入库时即带语义描述…」提示、四个字段标签的括号解释、被引用文档/连续修改/SVG 源三处标题的括号说明、空态引导句。**保留**「共 N 条」、素材行 `名称 · v号 · 入库时间`、`usage=` 标签等行内数据。

连带处理（`noUnusedLocals` 强制，不做会直接编译失败）：

- `App.tsx`：删除 `note` / `kbCount` / `savedAt` 三个状态及全部 setter、`knowledgeNote` prop 与 `sessionNote` 变量，`fmtTime` 退出 import；知识库预热 effect 保留 `ensureKnowledgeLoaded()` 副作用，只去掉计数展示；知识注册表加载失败改为 `console.warn`（原先只在被删的小字里可见）。
- `App.css`：删除因此失效的 12 条选择器（`.brand-sub`、`.topbar-meta .hint`、`.rail-foot`、`.knowledge-note` 及其 `::-webkit-details-marker`、`.debug-note`、`.debug-note .debug-body`、`.attach-note`、`.docs-head .hint`、`.ws-head .hint`、`.settings-note`、`.settings-lock`）。
- `src-tauri/resources/使用手册.html`：第 7 节「顶栏会提示「已自动保存」」失去对应界面元素，改为「保存是自动进行的」。

验证：

- 靶向断言先行：改 [verify-ui.mjs](scripts/verify-ui.mjs) 三处（S1.6 恢复判据改为「消息 + 预览 + 保存提示不存在」；S8/S16 改为断言 `.knowledge-note` / `.debug-note` 计数为 0），对改动前代码跑出 3 条 FAIL（红）。
- 改完后 `pnpm build`（tsc + vite）通过；`node scripts/verify-ui.mjs` **S1–S16 全绿（VERIFY OK）**，三条新断言语义反转后通过（saveHint=0 / n=0 / n=0）。
- 浏览器四视图截图核验（对话空态、文档库、素材工坊、设置）：小字均已消失，布局无塌陷；空态容器（`.preview-empty`、`.ws-empty-right`）保留为空占位块。
- release 重建：`pnpm tauri build --bundles nsis` 成功，产物 `智序_0.1.0_x64-setup.exe`（17:57）；`src-tauri/target/release/wechat-mp-desktop.exe` 启动后 12 秒存活（PID 15600，约 82MB），冒烟通过后终止。
- Rust 与知识语料未改动，本轮未跑 cargo。

未覆盖与取舍：

- **桌面模式顶栏未截图**：本机 PowerShell 执行策略为 Restricted，禁止运行 `.ps1`，未绕过该控制。桌面与浏览器的顶栏差异只在本轮改动之外的「使用手册」按钮，三处删除项已由浏览器截图覆盖。
- 设置面板删掉的两段说明含「设置以本地文件明文保存（仅本机自用），不会上传、不会入库」这一安全披露；该披露仍保留在《使用手册》第 11 节数据存放表，界面内不再出现。若要在界面保留，可单独加回一行。
- 知识注册表加载失败原先只在被删的小字处可见，现仅留控制台线索，界面不再提示。
- 瞬时提示（`.ws-msg` flash，如「已入库（…）。可在右侧修改名称/描述/标签…」）按「保留功能反馈」口径未动。

---
## 2026-09-24

### [Change] 模型临时锁定为 deepseek-flash

用户要求：所有模型切换为 deepseek-flash，暂时禁止一切别的模型。

- 范围：三路模型消费点全部收敛——创作与对话（`resolve_config` → `stream_chat_budgeted` / `prep_turn` / `refine_brief`）、素材绘制（`gen_svg` 的 `image_model`）、视觉复核（`review_assets` 的 `vision_model`）。
- 实现：`chat.rs` 新增 `LOCKED_MODEL: Option<&str> = Some("deepseek-flash")` 与 `lock_model()`；三路解析后统一收敛，`DEEPSEEK_MODEL` / `DEEPSEEK_IMAGE_MODEL` / `DEEPSEEK_VISION_MODEL` 与应用设置里的其它取值一律忽略。默认值由 `deepseek-v4-flash` / `deepseek-chat` 改为 `deepseek-flash`。**恢复可配置只需把 `LOCKED_MODEL` 改回 `None`，不必动别处代码。**
- 不做静默忽略：新增 `model_lock_state` 命令，设置面板显示锁定说明并把主模型/看图模型输入框置灰；保存时不会把界面显示值当作可配置项写回。`settings.ts` 同步 `DEFAULTS` 与读取时的收敛。
- 验证：`cargo test` 75 项通过（新增 3 项：三路同名、`lock_model` 对任意输入收敛、**走真实解析函数** `resolve_model` 验证 env/设置/默认三条来源都越不过锁定；并把原先断言「看图模型 ≠ 画图模型」的用例改为随锁定状态取反，避免解锁后测试失去意义）。`pnpm build`、三个离线断言脚本、`pnpm tauri build --bundles nsis`（0 警告）与启动冒烟（12 秒存活）全部通过。
- **未验证的风险**：`chat.rs` 留有历史注记——早先实测 `deepseek-v4-flash` 在 `reasoning_effort max/low` 下画 SVG 会推理失控、content 为空，当时因此改用 `deepseek-chat`。现在 `gen_svg` 走 `raw_completion_text`（**不携带 reasoning_effort**），条件与那次实测不同，但 flash 能否稳定出图**本轮未实测**。需真实调用确认时跑：`cargo test live_gen_svg_draws_concrete_illustration -- --ignored --nocapture`。

### [Debug][Change][New Feature] 按调查报告实施 P0 + P1 + P2

用户授权按 [调查报告](docs/design/improvement-review-2026-09-24.md) 全做三段。需求先登记在 REQUIREMENTS.md，再动手。

**P0 确定性错误**
- 复用判定（新增 `lib/asset-resolve.ts`）：旧口径只看绝对分 `>=3`，长描述极易误命中；改为长度归一化覆盖率 `>=0.5` + 配色冲突否决。调查报告原文案例「蓝色雪花/冬季科技大会」原本会复用旧「红色玫瑰」，现在改为新建。
- 分类过滤前置：`searchAssets` 新增 `categories[]`，在**打分与截断之前**过滤，修「先取前 10 条再筛分类」导致合适候选被截掉。
- 占位策略段：`[[img:wide|说明|new]]` / `[[deco:名称|说明|new]]` 跳过库检索强制新建；协议文档同步教模型在「重新设计/别用旧图」时加 `new`。
- 角饰别名：`image-agent` 现在输出 `::: art deco <气泡引用词> <占位别名> <库名称> <库 ID>`，`compose` 预扫描支持多别名（仍只占一个 `arts` 条目）。修「按库 ID 定义、气泡按别名引用 → 角饰未定义 → 触发整篇自动重写」。
- 分类校验：`[[asset:分类|…]]` 声明分类与实际不符时给可解释警告并按实际分类渲染；**刻意不进 `FIXABLE_KEYS`**（调查验收明确要求该场景不触发全文修订）。
- 快照补齐：现场新建素材登记进 `used`，并新增有序 `bindings`（素材位→库 ID/来源/原因）持久化到文档（`documents.ts` + `documents.rs`，两侧 `serde(default)`/可选，旧文档已验证可读）。

**P1 素材质量**
- 新增 `lib/svg-quality.ts`（纯解析层）与 `lib/svg-raster.ts`（canvas 栅格层）。确定性地拦：画布外元素、`fill=none` 无描边的不可见元素、空白、铺满画布的角饰、大画布上的小点、含文字/emoji 的素材。**关键修复**：path 包围盒改为按命令语义解析（此前把相对命令的数字两两当坐标，会误判正常插画「铺满画布」，因为误杀过 FLOWER 样例）；带 `transform` 或几何不可解析的元素一律不参与判定，宁可放过不误杀。
- `compose` 的 `::: art` 校验改用同一套检查（此前是独立的「元素数 >=6」，与新层不一致）。
- `chat.rs` 按角色拆分素材契约：wide/inline 沿用复杂度契约不退化；deco/divider/heading/photo-frame 各自有几何要求（显示尺寸、主体位置、留白、透明中窗）。新增 `photo-frame` kind（原走 wide，画出来中间没有放照片的地方）。
- 角饰避让：气泡底部内边距按角饰实际高度预留，vivid 气泡的 `overflow:hidden` 不再裁掉高角饰；断言改为语义匹配。
- 演示样例池按角色分开，保证 mock 链路也产出合规素材。

**P1 对话与文章上下文**
- 去掉「上一条助手是否含中文问号」启发式（等于用标点决定能不能取知识）；改为创作请求或已在创作态的会话统一提供工具，取不取由模型定。留 `PREP_EVERY_TURN` 常量供一行切换。
- 配额按成品长度分档：`<350` 字为短篇档，不再报组件化/素材配额，也不再因此触发自动重写；**阈值刻意定在 350 而非 600**——600 会把四五百字的正常成文一并放过（E2E S10 的 448 字样稿首轮就撞上这个问题，已修正）。mid/long 档文案逐字保持，`FIXABLE_KEYS` 语义不变。
- 自动修订期间保留上一版预览（此前会先清空预览），不再出现「预览突然空白 + 不知要等多久」。
- `revise.ts` 区分局部问题与结构问题：可定位到行的（气泡角饰未定义、库素材引用缺失）改为附行号+原文行并要求逐字保留其余内容；结构问题仍整篇重写。
- persona 澄清收敛：已知信息不复问、每轮最多问三个真正阻碍成稿的点、给一句话可接受的默认。
- `chat.rs` 回合预算旋钮（`chat`/`revise`/`write`），**默认值与改动前逐字相同**（max/64000），按调查「先测效果再选默认」不静默降级。

**P2 交互**
- 预览组件选择：`allow-same-origin` 的 srcdoc iframe 与父页同源，父页直接读 `contentDocument` 挂监听——**不开 `allow-scripts`、不注入脚本、不用 postMessage**（注入脚本会与 `quality` 的 `<script>` 禁令冲突并污染复制/导出/粘贴）。点选只往输入框插一段文本锚点，用户自己补指令再发送；无前端状态、不自动发送。
- 任务进度：`lib/progress.ts` 事件由前端各步骤就地上报（找素材/复用/画第几张/质检/修订），`ChatPane` 新增 `.task-progress`；`.knowledge-note` 收进 `<details>`（**文本保留**，E2E S8 依赖）。
- 参考图：对话输入区与素材工坊均可附图；图片仅本轮有效，会话存档只记一句说明，`sessions.rs` 结构未动。
- `ChatMsg` 多模态：**保留 `content: Option<String>`，另加 `images` 侧车并标 `skip_serializing`**，由 `to_wire`/`build_messages` 折叠成 API 的内容块数组。这样旧文本路径逐字节不变、且「直接序列化 ChatMsg」在结构上不可能泄漏 `images` 键；图像只放行最后一条 user 消息（API 只支持 user 携带图像，也避免重复计费）。Rust 不做 SVG 光栅化，参考图一律在 webview 用 canvas 转 PNG 后传入。
- 视觉复核（`review_assets`）：只在确定性检索「排序含糊、有近邻候选」时触发，强命中不调用；设置里显式开启（默认关，有费用），每篇限 3 次、按 `id@version` 缓存、只发 256px 缩略图；任何失败回退「新建」并显示原因。看图模型与画图模型分开（`deepseek-flash` / `deepseek-chat`）。
- 素材工坊连续修改：自然语言改图指令 + 参考图 + 前后并排对比 + 采纳为新版本（复用既有 version+1 与影响扫描）；把当前素材栅格化成参考图喂给模型，使「把花心改金色」成为真正的编辑请求。
- 顺手修一处既有缺陷：设置面板保存时会把未展示的公众号凭据字段写空（数据丢失），现在按读到的值原样带回。

**验证**
- 新增 `scripts/asset-resolve-check.mjs`（39 项）与 `scripts/svg-quality-check.mjs`（23 项）：用内存 localStorage 桩驱动真实模块，重放调查报告的隔离案例，全部通过。`compose-check.mjs` 扩充多别名/避让/短篇分档/局部修订断言后通过。
- `cargo test` 71 项通过（新增 to_wire 文本路径逐字节一致、images 不泄漏、图像只进最后一条 user、视觉决策容错解析、kind 契约、回合预算默认值、旧 settings/文档缺字段可读等）。
- `pnpm build` 类型检查与构建通过。
- 浏览器 E2E：`verify-ui.mjs` S1–S16 全部通过（新增 S15 组件点选不自动发送、S16 进度行与调试信息折叠），产物在 `docs/artifacts/2026-09-24/`。
- **release 重建**：`pnpm tauri build --bundles nsis` 成功（无编译警告），产物 `src-tauri/target/release/wechat-mp-desktop.exe` 与 `bundle/nsis/智序_0.1.0_x64-setup.exe`，启动冒烟 12 秒进程存活后正常结束。
- **真实模型**：跑了最便宜的一条 live 冒烟（`live_deepseek_smoke`），确认重构后的消息线上形态在真实 API 上可用（回复「桌面链路测试通过」）。调查要求的完整真实验收集（换主题是否触发新绘制、短通知是否不被强改等）与视觉复核实测**本轮未执行**——需要真实密钥下的付费调用，留给用户决定。

未验证边界：视觉复核与参考图编辑只验证到「接口、净化与离线断言正确」，不宣称视觉决策已在真实模型下生效；`deepseek-flash` 的图像输入能力未在本机实测。

### [Research] 体验与素材链路问题调查（仅方案）

按用户要求禁止直接开发。阅读实际调用链并以现有 TypeScript 做内存隔离验证，确认不同主体被错误复用、复用角饰别名断裂、分类不校验、不可见 SVG 校验通过及首次生成未登记 used；没有使用实际会话或素材库，不能替代用户现场复现。核对官方 V4.1 Flash 多模态说明，给出分阶段修改及验收建议，详见 [调查报告](docs/design/improvement-review-2026-09-24.md)。仅新增报告并同步文档入口和登记；源码、配置、知识语料不变，未发送付费模型请求、未打包。


### [Docs] 明确项目 GOAL，收敛文档与历史产物

新增 GOAL，精简 README，更新导航、协作规则、需求证据、结构和验证产物说明；既有 D1–D7 决策与永久约束保留。基于本轮开始时已有未提交改动继续整理，没有覆盖源码。

清理前 30 个文档及产物独立 ZIP 备份并逐文件 SHA-256 校验；14 张非首页历史截图移出活跃目录，保留在备份内。完整范围、恢复路径及验证边界见 [整理记录](docs/maintenance/2026-09-24.md)。本轮未重跑应用、真实模型或 release 验收。

验证：76 处本地文件链接有效，231 个受保护文件哈希一致，git diff --check 通过；新增 2 个、修改 11 个维护文档，归档 14 张截图。

## 2026-09-15

### [Change] 文档体系整理与历史冗余清理

原因：需求、详细/精简进度长期复制轮次详情；旧需求仍要求草稿发布；提示词导出与源码会漂移；历史实验样稿和重复长图占据文档目录。

修改范围：

- Modify：README.md、CLAUDE.md、STRUCTURE.md、REQUIREMENTS.md、PROGRESS.md、PROGRESS-LITE.md、RELEASE-NOTES.md、docs/ai-context/README.md，明确入口、职责和历史验收日期。
- Add：docs/README.md、docs/DEVELOPMENT.md、docs/design/docs-assets.md、docs/artifacts/README.md。
- Delete：docs/information/ 下 11 份旧报告（V3 决策已转入新记录）、旧需求理解稿、AI 清单与 4 份提示词导出副本；旧实验 Markdown/HTML 与带时间戳的长图。逐文件清单在仓库外交付的清理报告中。
- 保留：全部运行时知识、源码、脚本、安装手册、独立场景截图及 compose-sample.html。

备份：清理前 60 个文档与产物完整打包，ZIP 逐文件内容比对通过；包含未跟踪的导出产物，SHA-256 清单随包交付。历史 Git 基线：`1c2afbe26f78baa62368b38307935a82e44e0f9c`。

验证：60 个本地文档链接全部有效；188 个源码/脚本/知识/手册文件哈希一致；Git 差异仅涉及文档及历史产物，`git diff --check` 通过；60 个备份文件 SHA-256 复核通过。本次未重跑应用测试、未重建 release，旧发布记录不作为新验收。

## 2026-09-09（发布时记录）

智序 0.1.0 完成发布阶段整合：图片导出、文档库、个人素材库、复用/快照、品牌化与安装手册。当时构建及验收摘要见 [发布说明](RELEASE-NOTES.md)。V3 设计目标与实现差异见 [决策记录](docs/design/docs-assets.md)。

## 2026-08-29—09-08（历史里程碑）

桌面骨架 → 会话/设置持久化 → v2 排版 → 知识工具按需取用 → 素材智能体 → 质量自检。曾采用的前端澄清状态机已撤销，禁止恢复；草稿发布用户流程后来改为图片导出。各轮原始记录从清理前 Git 或原文备份检索，不再在当前入口重复展开。

---

### [Change][Verify] 最新稿源码泄漏与质量恢复闭环（质量恢复计划 A–E 五批）

**问题**：真实保存产物 `s1790565874610554000`（2026-09-29 10:35:29）的成品 `article.html` 里，
**3 处内部源码泄漏进正文**——`::: photo` 照片位把紧随其后的段落与 `::: art` 素材块（含整段 SVG）
吞进自己的"说明"字段，再由 `escapeHtml` 转义成**可见文字**：成品 6 个 `<img>`（没有一张是素材）、
**0 个有效 art**、3 处转义 `&lt;svg`、3 处内部 `::: art` 文本。同一份 `meta.json` 里
`checkHtml` 的结论是 `ok:false`（圈码 ①②③），但保存流程仍以 `ok:true / 成稿已保存` 收尾、
也没有触发自动修订。

**根因（两条，互相独立）**：
1. `compose.ts` 的照片位分支从块头一路向后扫到第一个 `trim === ':::'`——而那个 `:::` 很可能是
   **后面某个素材块的结束符**。块体因此跨越了下一个块起点，把整段正文与 SVG 吞进说明。
2. 质量链路里三件事被挤在一起：`checkHtml` 的结果没有进"能不能交付"的判定，
   自动修订靠**中文告警子串**触发，落库无论质量如何都算成功。

**改动（按计划 §9 的 A–E 五批）**：

- **A 解析止损**（`src/lib/compose.ts`、`engine-write-protocol.md`、`revise.ts`）
  - 抽出**有边界的块收集** `collectBlockBody`：遇到下一个块起点（`::: <kind>`）即停止，
    只在"单独一行的 `:::`"处才认为闭合。照片位与 card/steps/… 容器全部改用它。
  - `::: photo` 改为**单行指令**：说明只取行内头部，紧随其后的行**一律退回正文渲染**；
    历史多行块只在**无歧义**时兼容（`scanLegacyPhotoBody`：候选范围内全是纯文本行、且确有闭合），
    歧义输入按单行处理。协议文档与自动修订提示（`MATERIAL_RULE`）同步写死这条。
  - `ComposeResult` 新增 `issues: ComposeIssue[]`（稳定 `code` + `severity` + **源文行号** + `evidence`）
    与 `rejectedArts: RejectedArt[]`；中文文案从此只负责展示。
  - **可见文本泄漏检查**：逐节点剥标签 + 反转义后查 `<svg` / `::: art` / `[[asset:`，
    跳过围栏代码块与行内代码 span——合法代码示例不能被全局字符串规则误杀。
  - 孤立 `:::` 显式跳过并上报。旧实现会让它掉进"普通段落"分支：段落循环在 `l === ':::'` 处 break
    却**不推进 i**，主循环原地打转——**这是个死循环**，不是理论问题。
- **B 统一门禁**（新增 `src/lib/delivery-quality.ts`、`src/lib/quality.ts` 保留为底层）
  - 五类检查（解析 / 素材 / 栅格 / HTML / 正文完整性）+ 容量 + 版本，汇总成一条问题清单，
    输出 `DeliveryVerdict`（`ok` = 允许提交成品）。`checkHtml.ok` 单独为真**不等于**整稿通过。
  - 素材被排版层拒收 → `rejectedArts` 回写台账（`ok` → `failed`），并把失败素材位的 `slotId`
    带进问题清单——"库里读得到"不再等于"能用"。
- **C 完整版本存储**（`src-tauri/src/documents.rs`、`lib.rs`、`Cargo.toml`）
  见本文件上一条 `[Change][Build] 批次 C` 的详细记录；前端接线在本轮补齐。
- **D 修复与回滚**（`src/App.tsx`、`src/components/PreviewPane.tsx`、`src/App.css`、`src/lib/trace.ts`）
  - 回合产出改成**一串候选**：每轮候选跑同一套完整门禁；**无阻断项即提交**（计划 §5 第 3 条），
    有阻断项才生成修复任务。修复优先级：解析器确定性修复 → 素材恢复/替换 → 最后才模型改文本。
  - **只让模型改它改得了的**：素材位失败（未完成/被拒收/未过适用门禁）、照片位待补、
    版本不一致一律排除出"本轮要修什么"——重写正文只会把这一处删掉，等于"为了清空问题清单
    静默删除用户明确要求的素材"。
  - **退化撤销**：修复候选新增阻断项、或丢了**事实**（姓名/时间/地点/数字）→ 撤销该候选。
    正文片段丢失**降为提示**（理由见下"口径裁决"）。
  - **失败可续**：预算用尽/取消/无进展/不可修 → 草稿另存为独立版本，成品维持上一份已验收版本；
    没有已验收历史时如实标"草稿未通过"，不制造"已回滚"的结论。
  - `PreviewPane` 四态标识（`data-doc-state="accepted|restored|draft-failed|repairing"`）+
    **独立标注的草稿导出入口**（`data-export-draft-entry`），正常导出只指向已验收成品。
  - `trace.ts` 增加交付阶段字段（`validation / repair / rollback / persist / commit`），
    `summarize()` 新增 `committed` / `rolledBack` ——"草稿存下来了"不再被误读成"这篇成了"。
- **E 交付验证**（新增夹具与三个脚本、E2E S22）
  - `scripts/fixtures/2026-09-29-photo-swallow/`：最小片段 + 真实结构裁剪版 + **真实 `source.md`
    整份只读副本**（计划 §10 第一行要的"最新稿隔离副本"）。
  - `photo-swallow-check.mjs` 新增用例 ⑥ 打在真实源文上；`--prove-red` 从 git 取修复前版本
    实测 **10 条红**，证明样例确实复现故障、断言确实能抓。
  - `verify-ui.mjs` 新增 **S22**：同一会话先出一版好稿（成品），再出一版过不了门禁的稿子 →
    断言 `data-doc-state="restored"`、预览回到上一版成品（不含失败稿特征）、
    **落盘文档仍是已验收状态且源文也没被换掉**（钉死"新源文配旧 HTML 的混合版本"）、
    草稿取回入口出现。

**两处口径裁决（计划文字有歧义，此处按下述执行并说明理由）**：

1. **§5 第 3 条按字面执行**：无阻断项直接提交，**提示级问题不再触发整篇重写**。
   这取代了旧行为（按 `FIXABLE_KEYS` 中文子串匹配就推回模型）。旧行为的两个实测坏处：
   用展示文案控制执行（文案一改就静默失效）；为少几条告警把一篇合格稿整篇换成另一篇
   ——实测引用库素材的稿子被换成不带任何库引用的版本，**文档固化快照随之清空**，
   连带把 S14 的影响扫描打断。受影响的 E2E 断言（S2/S10）已按新契约重写：**换了判据，不是放宽**。
2. **正文片段丢失降为提示，事实丢失仍阻断**。计划 §5.6 要求"无关段落变化要撤销候选"，
   又要求"不能将'与旧稿不同'一律当退化"；而本模块做的是**全文纯文本**比较，
   没有节点级的"目标/非目标"划分，分不出"这段正是修复要删的"和"这段是被误伤的"。
   实测后果是修复永远无法生效：违规稿里那段 emoji 被重写掉后完整性检查报阻断 → 候选被撤销
   → 退回违规稿。折中口径写在 `issuesFromBody` 的注释里，可证伪。

**顺带修掉的四个真 bug**（都是这轮接线时暴露出来的，不是计划内条目）：

| # | 问题 | 后果 | 修法 |
| --- | --- | --- | --- |
| 1 | `resolvePreview` 只回传 `{html,warnings,arts}`，**丢掉结构化解析问题** | 纯正文稿（无占位）的门禁清单里没有 `quality.low-structure` → 缺组件的半成品**直接判为可提交**、自动修订一次都不跑 | 返回值带 `issues`/`rejectedArts`；调用点一并送进门禁 |
| 2 | 必需素材位按**跨轮累计台账**计 | 模型改写后引用已不在正文，台账那条 `failed` 仍挂着 → `unfinished()` 永远非空 → **该候选永远阻断、修不进去**（实测打死 S14） | 按素材位**身份词**是否仍出现在本轮正文来过滤 |
| 3 | 保存时把"最新候选的源文"配上"已验收候选的 HTML" | 正是计划点名禁止的**新源文配旧 HTML 混合版本**：回滚对不上、重开复现不出那一版 | 成品存成品那一版的配对内容；最新候选若不同，**另存为草稿版**（`asDraft`，不动成品指针） |
| 4 | `documents.ts` 桌面读取路径直接透传 Rust 的 snake_case 字段 | `updatedAt` / `revisionId` 等在桌面端**恒为 undefined**（列表路径有映射，所以看不出来） | 加显式映射 `fromRustContent` |

**验证（全部为实际运行结果）**：

- `cargo test --lib`：**131 项全绿**（原 120 项无退化；新增 11 项版本存储的
  故障注入/迁移/CAS/哈希用例，全程 `std::env::temp_dir()` 隔离，未读写真实工作区）。
- 离线断言 9 个脚本全绿：`progress-check` / `asset-resolve-check` / `compose-check`（新增照片位与块边界 15 条）/
  `svg-quality-check` / `trace-check` / `fixture-repair` / `delivery-quality-check`（53 条）/
  `photo-swallow-check`（含真实源文用例）/ `asset-completion-check`（45 条）。
- `photo-swallow-check --prove-red`：**修复前实测 10 条红**（
  `<svg`×1、`::: art`×1 等），证明样例复现了故障、断言不是恒真。
- 浏览器 E2E `verify-ui.mjs`：**107 PASS / 0 FAIL（S1–S22）**，连跑两次稳定。
- `tsc --noEmit` 干净；`vite build` 通过。
- release 重建（`pnpm tauri build --bundles nsis`）：`wechat-mp-desktop.exe` 15.7 MB、
  `智序_0.1.0_x64-setup.exe` 4.6 MB（13:17 产物）。启动冒烟用**隔离 `USERPROFILE`**（临时目录）跑 14 秒：
  窗口起来（82 MB）、隔离目录下自动建出 `wechat-mp-workspace`；核对**真实工作区计数未变**
  （会话 15 / 文档 3 / 素材 11 / traces 3），冒烟进程按 PID 关闭、临时目录已清。

**计划 §10 验收表的覆盖情况（如实登记，不把"代码里有"当成"验过了"）**：

| §10 场景 | 本轮证据 |
| --- | --- |
| 当前最新稿隔离副本 | ✅ `photo-swallow-check` 用例 ⑥（真实 `source.md` 整份只读副本） |
| 单行照片位接 art/card/标题/气泡/列表/另一个 photo | 🟡 块边界逻辑是通用的、`photo-swallow` ①②③⑤ + `compose-check` 覆盖 art/card/孤立 `:::`；**标题/气泡/列表/连续照片位未逐个用例化** |
| 历史闭合照片块与缺失结束符 | ✅ `photo-swallow` ④ + `compose-check` 历史多行块 3 条 |
| 库素材读取成功但含禁用 text | ✅ `asset-completion-check` ④（含"按素材角色过门禁"的可证伪样例） |
| 有 6 张图仍存在源码泄漏 → 阻断 | ✅ `delivery-quality-check`（不依赖零图条件） |
| 只有 checkHtml 失败 → 同样进门禁 | ✅ `delivery-quality-check` + E2E S2（违规稿被修复轮替换，成品 HTML 三项违规特征归零） |
| 第一轮好、第二轮退化；两轮均失败 | 🟡 **代码路径已实现**（新增阻断项/事实丢失 → `stopReason='regressed'` 撤销候选），但**没有 E2E 场景专门构造"第二轮退化"**——浏览器 mock 产不出这种序列 |
| 没有已验收历史 | ✅ E2E S18（同会话无成品 → 草稿未通过 + 单项重试）；S22 覆盖"有历史 → 已恢复上一版" |
| meta/source/html/manifest 任一步失败 | ✅ `cargo test --lib` 6 个故障注入点 |
| 进程中断后重开 | ✅ cargo（未提交候选不提升为成品） |
| 取消、切换会话、迟到响应 | ✅ 既有 runId 过滤 + S9/S10 + cargo 的 CAS 拒绝 |
| 单项重试、打开、导出、素材更新 | ✅ 单项重试已改走**同一套整稿门禁**（`retryAsset` 重写）；导出 S20；素材更新 S14 |
| 修复预算与无进展 | 🟡 循环级 `budget` / `no-progress` 终止已实现，**无 E2E 场景**（离线 `trace-check` 覆盖的是素材位级预算） |
| 375px 预览与真实显示尺寸素材 | 🟡 `raster-check`（canvas 实测阈值）+ S22 读 iframe 实际正文；**未做"节点数量/实际图片"逐项断言** |

**本轮明确未做**：真机（桌面 + 真实模型）跑完整修复轮——需要真实 API 调用，未获本轮授权；
本轮真机证据只覆盖到**隔离桌面通路**与离线/浏览器断言，所以上表里 🟡 的三项仍属"实现了但没在真实链路验过"。
**微信端观感与真实后台上传仍未验证**（与前几轮口径一致）。
