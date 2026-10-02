# 10-02 晚间 live 原件与成品复核

本次只读原始隔离目录、当前源代码和磁盘产物；重跑两份零模型离线检查。没有启动智序/浏览器，没有调用模型、修改原总账、旧证据或产品代码。

## 结论

六个阶段的 PASS 原件确实存在，主要业务结论可由请求 trace、正式 revision、固化素材及真实导出文件支撑。应写成“同一 root 内，经过失败、修复与重试，L1–L6 各阶段均取得 PASS”；不应写成“L1→L6 一次连续通过”。实际执行顺序中，L3 在 L6 之后；当前 root 另有 4 个 FAIL 和 1 个无最终结果目录。

此结论仅确认所留原件支持的验收事实，不等于当前驱动器所有异常路径已安全：独立预算复核另发现 fetch 后备通道绕过门禁，见兄弟目录 `../budget/README.md`。

## 证据入口

- 原 root：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-live-run1`
- 正式 workspace：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-live-run1\profile\Documents\wechat-mp-workspace`
- `audit-summary.json`：本次独立复算后的阶段事实、原始请求摘要、before/after 比较、正式版本与导出校验。
- `sha256-manifest.json`：被读取原件和当前源文件的绝对路径、字节数、SHA-256。
- `original-results/`：本 root 所有已存在的 run-result/evidence 副本；没有结果的 L4 只保存其唯一 `L4-before.json`，未替它创造最终判定。
- `original-traces/`：8 份原始 JSONL 副本。
- `driver-check/run-result.json`：本次离线复跑 **35/35 PASS**。
- `facts-check/run-result.json`：本次离线复跑 **30/30 PASS**，进度文档写 29 已落后。

原件有完整输入 exe SHA（六阶段均为 `36b45e256b9be3fe644a1bd060c84e6902b34631ae1f22dfc2375ea628703522`）及部分产品源文件指纹；没有记录每次 runner 文件的输入 SHA，不能证明所有尝试采用同一份 runner 源码。当前源码指纹只证明本次复核时看到的版本。

## 六个 PASS 的独立支持证据

|阶段|原件目录（`root/evidence/` 下）|核验结果|
|---|---|---|
|L1|`L1-2026-10-02T10-05-54-f9372ae2`|30/30；4 条原始 request（3 prep+1 gen_svg）与门禁/传输/reconcile 均一致；gen1，106 字；源文/HTML/绑定/快照/quality 哈希从实际 revision 文件重算吻合。|
|L2|`L2-2026-10-02T10-10-23-e3cd1e8b`|36/36；2 prep、0绘图；gen1→2；正文106→102字、标题更新；素材 id/ver/svg SHA相同。bindingsHash 确实变化（slotId 和引用描述变化），不能笼统写“绑定记录逐字未变”。|
|L3|`L3-2026-10-02T10-29-08-f9f279b4`|24/24；**2 prep**，非文档所写1派发；捕获命令无 save_document/save_document_draft/commit_document_revision；前后14个版本字段和正文一致，正式 gen5未变。它是在L4、L5、L6之后验证的。|
|L4|`L4-2026-10-02T10-15-27-cf29391e`|26/26；2 prep+1 gen_svg；本次gen4→5，新素材id与svg SHA均改变；标题与102字正文和开始前/成功L2基准逐字一致；正式revision、绑定、固化快照可读且重算吻合。|
|L5|`L5-2026-10-02T10-17-44-156ea26a`|30/30；基准为成功L4/gen5；PID-A49892→PID-B44572；各自路径/创建时间的启动与关闭前复核一致，记录wm-close、gracefulCmd.ok、非forced、非exitedBeforeRequest；before/after各14字段均与基准相同。独立扫描整个phase时间窗口内原始trace为0请求，账本54/11前后未变。|
|L6|`L6-2026-10-02T10-26-48-c1caa5e0`|26/26；与L5同一gen5/revision；回执HTML确在added且字节SHA等正式版；两PNG确在added、均750×1340；375CSSpx手机壳截图实际存在、像素564×698；整个phase原始trace0请求，账本54/11前后未变。|

当前 manifest：`s1790935555605661500` / `generation=5` / `accepted_revision_id=r1790936230221652500` / `draft_revision_id=null`。

最终正式 source SHA：`912a13084f18cd3dd03f04e8d371b28236b743347d5a51b006ee2bf8f11cc7bc`；HTML SHA：`d798fdc079334cfae328df465f7691bc4133af2d83968594aba15776868fc506`。

L1–L4留档预览正文用当前事实模块独立复查全部通过。quality.ok为真、blockers=0，但meta里仍明确保留 `unverified:["version","version"]`、渲染HTML容量警告、正文保留比较 not-applicable；不能把quality字段解释为“所有潜在验证面均已检查通过”。L4正文未变结论来自独立前后文本比对。

## 必须保留的失败与未知

上海时间18:05 L1 PASS →18:08 L2 FAIL→18:10 L2 PASS→18:10 L4 FAIL→18:11 L4 FAIL→18:14 L4无结果→18:15 L4 PASS→18:17 L5 PASS→18:20 L6 FAIL→18:26 L6 PASS→18:29 L3 PASS。

- L2首试原始trace终结为protocol，仍是gen1，没有提交新版。
- L4前两次FAIL实际上分别提交gen3和gen4，失败断言是驱动器错误套用“标题/正文必须变化”，以及相对旧基准比较generation。保留FAIL原件；不要用“尝试失败”推导“没有写入”。
- `L4-2026-10-02T10-14-12-2927b2d0`只有`L4-before.json`，无run-result、evidence、stdout。对应时间内`rmuqt34d0-1.jsonl`有2条prep，最后一条note是进入统一交付门禁；没有gen_svg结果或终结run。这是未完成证据，不是0调用、PASS或可归因的模型失败。
- L6首试确实生成了HTML/两PNG，但驱动没取到回执且截图目标宽度不是375，所以FAIL；不能将这些文件存在当首试验收通过。
- 本root 8份原始trace共**21请求/4绘图**；该root开始L1前账本34/6、最后56/11，差额**22/5**。多出的1预留/1绘图与无终结L4相邻。仅凭结果日志不能确定其实际网络完成或计费状态，应保留UNKNOWN；本复核没有读取全局总账来验证其它root的历史34/6，56/11不能在此报告中称已独立核清的真实计费总量。

## 旧 R3 缺陷现状

当前代码和本次独立检查支持以下修复：绘图传输接独立 `transportDrawAfter`（live:1542）；L3从`app.page.evaluate`取得页面（1942）；关闭失败不再标closed（774）；启动调用进入清理try（2673）；无成功基准返回null、L5/L6要求prev.ok；trace少记与绘图类别不符判红、already-exited拒绝重开；事实错误年份/借用无关17点/否定闭馆/否定楼层/合法紧凑写法的旧反例都已纳入并通过。

这些检查中，live-driver第⑥段是源码结构断言，不能改称整条真实入口故障注入。本次真实PASS原件弥补了正常入口执行证据，但并不覆盖传输失败、宿主预留函数异常、IPC后备通道等新故障条件。

## 视觉文件和导出边界

- 预览：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-live-run1\evidence\L6-2026-10-02T10-26-48-c1caa5e0\L6-preview-375.png`
- HTML：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-live-run1\profile\Documents\wechat-mp-workspace\exports\tuiwen-1790936811.html`
- 长图：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-live-run1\profile\Documents\wechat-mp-workspace\exports\img-tuiwen-20261002-1826\tuiwen-20261002-1826-长图.png`
- 分页：同目录 `tuiwen-20261002-1826-01.png`。

两PNG均161237字节，SHA相同：`04c2ce646bdbc225613c83fd503f74f173a156aa28831bbcf43545811b05fe5a`。这次长图1340px、只有一个分页，能验证单页导出，不能推导多页切分无遗漏。像素视觉检查由主线直接打开上述原件执行；本子审计仅重新读字节与PNG尺寸，没有把机器断言当人工视觉结论。

复跑独立读取与校验：从仓库根运行 `node docs/artifacts/2026-10-02-evening-review/live/audit.mjs`；它只写本新证据目录，读取原件，且不启动应用/模型。保留本目录快照后再复跑，以区分未来原件漂移。
