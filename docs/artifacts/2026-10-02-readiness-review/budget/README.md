# 当前收口修复复核：预算与 IPC 门禁

2026-10-02。只读当前产品/验收源码，**0 智序启动、0 真实模型请求、0 正式工作区写入**，未读写真实全局账本。测试只写本目录及独立临时目录，未覆盖前两轮证据。

结论：上轮两个主要问题都有实质修复，并非只增加绿色断言。但当前收口还剩两类有限的基础设施缺口：一种特殊 IPC 响应仍能导致预算绕过，以及终结落盘的顺序仍能让失败运行被下一进程视为已结束。它们属于验收驱动和证据可靠性，**不证明文章、素材或已有成品质量失败，也不撤销已有真实成功样本**。产品成熟度须另按默认发布版、业务场景、失败恢复和交付体验判断，不能直接从本目录的测试数量推导。

## 本轮实际执行

```powershell
node scripts/ipc-gate-check.mjs --out docs/artifacts/2026-10-02-readiness-review/budget/ipc-gate-check
node scripts/budget-check.mjs --out docs/artifacts/2026-10-02-readiness-review/budget/budget-check
node docs/artifacts/2026-10-02-readiness-review/budget/probe.mjs
node docs/artifacts/2026-10-02-readiness-review/budget/ipc-special-response.mjs
```

前两条均 exit 0：IPC-GATE 36/36，BUDGET 91/91，结果分别在对应子目录的 run-result.json。后两条是独立、限定故障注入，使用当前生产函数/模块，结果在 probe-results.json 和 ipc-special-response-results.json。独立 finalizer 探针的“下一阶段”是在同一 Node 进程内新建 createBudget 实例、重新读盘并按 main 的历史检查顺序模拟，不是已经启动新的 OS 进程；它证明盘上持久状态与实际检查接线存在缺口。既有 budget-check 的跨进程计数组确实启动了两个子进程，两层证据不混用。

## 已修且行为证据有效的部分

- `ipc-gate.mjs` 已从 live 内嵌字符串抽为唯一生产实现，付费命令表从预算模块生成；live 确实导入该实现（live-acceptance.mjs:85、:483）。
- 原先“非付费 fetch reject→postMessage 绕过”已被捕获并转换为协议错误响应；宿主预留异常、200 状态非法 JSON、响应体读取 reject 也有真实 Tauri 2.11.5 协议测试。检查不是自己模拟 fallback 的副本：runner 按 Cargo.lock 找本机 Cargo registry 协议源，填入构建模板后执行原协议。
- 安装前协议已经回退时，覆盖探针会得到 viaFetch=false；live 在启动（:829）和回合前（:1107）拒绝此状态。fetch 身份脱落后的重包、零预算五种付费命令拒绝均有行为检查。
- 默认 requirePhaseOpen=true；live :2689 在应用启动前调用 beginPhase。budget-check 的新增第 ⑬ 组证实：开始记录未成功不派发，closePhase 写失败后新实例看到未闭合且拒绝开始/派发。这关闭了上次“整个存储故障持续到结束”的具体反例。
- 原有跨进程预算临界区、负数/不自洽 totals 拒绝、非数组 phases 拒绝保持通过。

测试局限：ipc-gate-check 的 live 集成部分是源码结构断言，不是实际驱动执行；它测试的是正常 200 响应及几种错误，没有覆盖下方特殊状态响应。budget-check 的关闭失败用例直接让 closePhase 写失败，未覆盖生产 finalizeLedger 的“失败标记写失败而 close 成功”及“close 成功后最终报告失败”。部分老预算组刻意 requirePhaseOpen=false，只测计数；默认生命周期另在第 ⑬ 组测试。

## 剩余反例 A：特殊无正文 JSON 响应仍切到 postMessage（P1，有限故障条件）

源位置：`scripts/lib/ipc-gate.mjs:64-66` 对 204/205/304 直接重建无正文 Response 后返回，跳过 :69-74 的 JSON 校验；同文件 :35-36 重用时直接返回旧 coverage。项目锁定的真实 `tauri-2.11.5/scripts/ipc-protocol.js:42-53` 不根据 status 跳过 json()，因此 `204 + content-type: application/json` 在后续解码抛错，再走 :59-67 的永久 fallback。

独立探针执行过程：首次安装用正常 200 响应，coverageProven=true；随后只对一条非付费 list_documents 注入 `new Response(null, {status:204, headers:{'content-type':'application/json','Tauri-Response':'ok'}})`。再调用当前生产 installProbe 和两条付费命令：

- 预算上限 0/0，reserve 调用 **0**。
- prep_turn、gen_svg 经真实协议的 postMessage 到达假后端，各 1 次，共 **2 次**。
- 回合前重装仍返回 ok=true/reused=true/coverageProven=true。
- gateLive=true、fallbackLatched=false、decodeFailures=[]，目前健康度轮询也不能看出该回退。

边界：这是明确的特殊响应故障注入；本轮没有观察到真实 Tauri 后端已返回此响应，不泛化为“所有 IPC 不安全”或“历史模型轮次已绕过”。它直接否定当前“任何响应解码失败都不切通道”的收口声明。

最小修复/回归：把特殊状态响应也纳入与真实协议相同的解码安全判定；不能保证下游 json/text/arrayBuffer 解码成功时返回协议合法错误并停发。加入当前真实协议反例，要求 cap0 时 postMessage 付费传输为 0；204 一例足以代表此处同类特殊分支，无需扩展全协议测试矩阵。

## 剩余反例 B：phase 关闭时机仍早于完整终结证据（P1）

### B1：业务失败标记写失败，但随后 closePhase 写成功

生产路径 `live-acceptance.mjs:2764-2772` 在 recordPhase 失败后记录错误，却仍进入 :2777-2789 的 closePhase。`dispatch-budget.mjs:640-648` 的 priorBusinessFailure 仅识别 businessFailure 字段，不识别已关闭条目的 outcome:error。

`probe.mjs` 使用真实 budget，先 open→beginPhase→预留一次。仅在真实 recordPhase 调用期间将本探针的临时账本置为只读，真实写入得到 EPERM；立刻恢复权限，执行未经改写的生产 finalizeLedger 函数。结果：

- failed-check 存在，recordPhase 返回 false，本次确实记录 budget 错误。
- 同一生产收尾随后成功关闭 phase：盘上 open=false、outcome=error，**没有 businessFailure 标记**。
- 新实例按生产 main 的两项历史检查顺序读取：unresolvedPhase=null、priorBusinessFailure=null；beginPhase(L2) 与 reserve(prep_turn) 都成功。

这不是任意模块误用：故障只限制在一次真实文件写入，剩余顺序来自实际 finalizeLedger；它在 main finally :2745 和最终退出 :2478 被调用，并由 LEDGER_FINALIZED 阻止重算。

### B2：账本已写 pass，之后必需报告落盘失败

`live-acceptance.mjs:2478` 先 finalizeLedger，:2781 关闭账本；最终必需附件和判定直到 :2509-2517 才写入。

探针对一个全部检查通过的假运行执行原始 finalizeAndExit/statusOf/reportMarkdown/finalizeLedger，唯一故障是新证据目录的 report.md 路径预先建成目录。结果：本次最终 run-result.json **ERROR、exit 1**，但账本已 open=false、outcome=pass；新实例的两项历史检查都是 null，下一付费 phase 仍获准。证据在 final-report-failure-output/ 和 probe-results.json。

最小修复/回归：

1. 业务失败屏障未成功写入时，保留未闭合状态，或把失败标记与最终关闭合成同一次原子账本写；不得依靠另一条可能失败的附加记录。
2. 最终必需证据确认落盘后才把本 phase 标为完整终结；任一必需报告/屏障/关闭写失败，下一进程必须读到未闭合或持久失败状态。关闭本身失败时也保持当轮非 PASS。
3. 加入本目录 B1/B2 两个生产 finalizer 集成反例，并保留正常通过对照；DS 的回归应让真正的新子进程重读同一隔离账本、执行历史门槛并证明零派发。仅新增 direct closePhase 单测无法封住当前真实调用顺序。

## 给 DS 的有限下一步

只修特殊响应分支和以上终结顺序，补这三个确定反例后重跑相关零模型检查。不要为验证门禁再启动真实模型，也无需重新扩写预算平台或泛查产品模块。修复后可保留“已有可用成品和成功流程”的结论，同时把“自动验收故障恢复完全收口”限制在实际证据支持的范围。
