# R1 / R2 continuation review, 2026-10-02

本次仅检查当前工作树代码并执行隔离确定性探针。**应用启动 0 次，真实模型请求 0 次，正式工作区写入 0 次**。产品源码未修改；新增文件只在本证据目录和专用系统临时目录。未读取或修改真实全局预算账本。

## 结论

R1 的 `createJudge.finish()` 落盘失败路径已实测不再 PASS/exit 0；R2 的单写者预算及页面派发前门禁已实测有效。但以下缺陷仍可复现，R1/R2 不能整体标记验收通过，不能以现有绿色检查数直接推进付费验收。

### 1. P1：全局预算没有全局写者锁，多 root 可超发并丢计数

- `scripts/live-acceptance.mjs:334` 使用固定 GLOBAL_LEDGER；`:336` 的锁却位于每个 root，`:354-377` 只保护该 root。
- `scripts/lib/dispatch-budget.mjs:160-181` 仅在 open 时读盘；`:214-237` 的 reserve 用各实例内存副本覆盖账本，无全局锁、无事务内重读。
- `probe.mjs` 让两个预算实例以不同镜像 root 先 open 同一隔离账本（上限 1），再依次 reserve：**两次 fake transport 都获准，盘上 totals.dispatches 只为 1**。此交错等价于两个不同 root 的进程都完成 open 后分别派发。
- 此处证明生产预算模块交错有缺陷，未启动两个真实桌面应用。既有 budget-check 的“并发”只对同一个实例顺序 reserve，不能覆盖本例。
- 修复验收：同一权限账本的读、查、预留、落盘必须串行；用两个进程、不同 root、共享隔离账本做并发测试，上限 1 时总传输应恰好 1，盘上计数也恰好 1。

### 2. P1：业务失败屏障落盘失败被调用方忽略

- `scripts/lib/dispatch-budget.mjs:252-263` 的 recordPhase 返回 persist 结果；`:127-144` 的 persist 本身不累计 persistFailures，只有 reserve 失败分支 `:244` 累计。
- `scripts/live-acceptance.mjs:1368-1378`、`:1831`、`:2004` 以及关键的 `:2323-2333` 都未检查 recordPhase 返回值。finalizeLedger 还先把 LEDGER_FINALIZED 设为 true。
- 探针在成功 open 后将自己的临时账本文件移到 `.prior`，原路径建目录来注入写失败；recordPhase({businessFailure:true}) 返回 false，但 summary.persistFailures=0；内存声称有业务失败，最后一份可持久读取的账本没有失败记录。
- 由调用链可知，收尾阶段发生这种故障时没有给 run 新增落盘错误，后续进程恢复读取旧账本就看不到业务失败屏障。探针没有运行正式 live 主流程。
- 修复验收：所有关键账本写入结果必须向唯一判定上抛；业务失败屏障写不成时，本次应明确 ERROR/UNKNOWN，后续付费 phase 必须有持久的失败关闭条件，不能只靠当前进程内存。镜像落盘失败也应有可观察记录（当前 `:135-142` 直接吞掉）。

### 3. P2：账本的“合法 JSON”校验仍接受损坏的计数和 phase 结构

- `scripts/lib/dispatch-budget.mjs:80-82` 只校验 totals 为 safe integer，没有拒绝负数。
- 探针写入 totals=-1/-1、预算上限=0/0：open=true，随后 gen_svg 的 reserve=true，零额度实际被放行一次。
- `:187` 将非数组 phases 静默改为 []；探针的 phases 对象被接受，priorBusinessFailure=null，随后文字请求获准。
- 修复验收：累计值必须非负、绘图与总量须自洽；phases 必须遵循结构定义，坏结构应 BLOCKED，不能静默丢弃历史。相关用例应加入 budget-check。

### 4. P2：live 主结果与必需附件相互矛盾

- `scripts/live-acceptance.mjs:2049` 的 reportMarkdown 使用 run.status。
- `:2124-2136` 先生成并写 evidence.json/report.md；直到 verdict 回调 `:2137-2140` 才计算最终 run.status 并设置 evidence.status。
- `scripts/lib/run-result.mjs:152-170` 先写附件后调用 verdict。注释声称重写 report，但实际只重试主判定文件。
- 探针从当前源码提取**未经改写的** statusOf/reportMarkdown/finalizeAndExit 函数体，以一个已完成、全部检查通过的假运行输入执行：exitCode=0，run-result.json 为 PASS；**report.md 却写 BLOCKED，evidence.json 没有 status 字段**。
- 证据在 `live-finalizer-passing-probe/`。此为生产函数片段的隔离测试，未运行真实应用。
- 修复验收：正常通过、检查失败、附件失败、主判定失败均应保证可读主判定与报告状态一致；落盘错误加入之后必须重新生成受影响附件，无法一致落盘时不得宣告已完整归档。

## 已验证有效的范围

- `node scripts/budget-check.mjs --out docs/artifacts/2026-10-02-continuation-review/budget_result_audit-20261002-132657/budget-check`：exit 0，43/43；证据为 `budget-check/run-result.json`。这是当前既有回归集的结果，不覆盖上列新增反例。
- `node scripts/runner-negative-check.mjs --out C:/Users/Lenovo/AppData/Local/Temp/wxmp-r1-audit-20261002-132659 59998`：exit 0，26/26。8 条判定器写盘/重复 finish/崩溃/最少检查数案例直接导入真实 run-result 模块，预期故障下均 exit 1 且无 PASS 主判定。
- 上述 runner-negative 中 18 条浏览器相关断言实际停在**缺 Playwright 的 BLOCKED**（子进程 exit 2、零检查），没有触达错误端口导航；不能称本轮已复验浏览器导航失败路径。
- `node docs/artifacts/2026-10-02-continuation-review/budget_result_audit-20261002-132657/probe.mjs`：只用隔离目录和假传输。`probe-results.json` 保存新增反例、实际生产函数输入输出和路径。
- 同一探针还提取当前 PAGE_SRC.installProbe 原始字符串，使用真实 createBudget 加 fake transport 并发调用 chat_stream/gen_svg：预算 1 时一条 fulfilled、一条 rejected，实际 fake transport=1。证明 `live-acceptance.mjs:486-493` 的“预留成功后才调用 orig”门禁在单写者下有效。
- 当前 paid command 清单包括 chat_stream/prep_turn/refine_brief/review_assets/gen_svg（dispatch-budget.mjs:43-49，与 live 页面清单 :474 一致）；静态检查 chat.rs 现有命令至 completion 路径未发现内部多次重试。没有使用真实服务端计费证据验证该边界。

## 交给其他审计的已定位问题

`scripts/live-acceptance.mjs:1329` 将 genSvgTransport 传成 turn.transportAfter（总传输量），普通文字请求会被判成绘图传输不一致。已告知主审计核验；本目录不重复扩展该项证据。

## 建议 DS 顺序

1. 先修全局预算串行化、损坏账本拒绝、收尾失败屏障持久化，并把本目录反例纳入生产测试路径。
2. 修 live 最终报告序列化顺序以及主审计确认的 reconciliation 问题。
3. 用可用 Playwright 补做真正错误端口回归，再执行零模型桌面预检。
4. 只有所有硬门槛通过并留存真实证据之后，才按既有授权和预算逐阶段继续 L1-L6；本次审计没有执行任何付费阶段。
