# 2026-10-02 第二轮收口：IPC 特殊响应（P0-A）与最终证据/phase 闭合顺序（P0-C）

对应 [DS 修复指南 §0.0](../../design/ds-repair-guide-2026-09-30.md#00-2026-10-02-最新复核与直接执行任务) 的
「P0-A 特殊空响应仍会绕过预算」与「P0-C 最终证据与 phase 闭合顺序仍有漏洞」两项。
本文件是**执行记录与证据索引**，结论严格限定在证据支持的范围里。

**本轮花费的真实模型调用：0。** 除一次**隔离启动冒烟**（release exe、独立 profile、只关本轮自有 PID、零模型）外，
全部检查都是纯 Node 离线（假传输 / `node:vm` 沙箱 / 真新子进程）。没有新增付费派发，没有扩容或重置账本，
没有删除或覆盖任何既有证据目录，没有触碰真实作品目录（启动冒烟前后逐文件哈希核对为 0 增 0 删 0 改）。

**本轮没有重建 release**：改动全在验收驱动（`scripts/`），产品前端/Rust/语料一字未动；现存 exe
`64ab2946…` 与本轮启动冒烟所用的就是同一个二进制。该决定经用户确认。

---

## 一、P0-A：特殊状态响应仍会绕过预算（204/205/304 + `application/json`）

### 缺陷（复核原件）

`docs/artifacts/2026-10-02-readiness-review/budget/README.md`「剩余反例 A」。要点：
旧 `ipc-gate.mjs::guardResponse` 对 204/205/304 **直接** `new Response(null, {status, headers})` 返回、
跳过 JSON 校验；而本机锁定的真实协议 `tauri-2.11.5/scripts/ipc-protocol.js:42-53` **按 `content-type`
选解码器、不看 status**，于是空体 `json()` 抛错 → `customProtocolIpcFailed = true` → 此后所有命令走
`window.ipc.postMessage`（wry 冻死、页面侧拦不住）。复核实测：额度 0 之下 `prep_turn`/`gen_svg`
各经 postMessage 到达假后端 1 次（共 2 次），预留 0 次；重装仍报 `reused=true/coverageProven=true`。

### 修复

`scripts/lib/ipc-gate.mjs`：

1. `guardResponse` 去掉按 status 的短路，**统一按协议下一步真正会做的解码**判定：
   `content-type` 取逗号前第一段，`application/json` → 必须 `JSON.parse` 成功（空体必失败 → 判解码失败并
   `latch` 停发）；`text/plain` / 其它 → 协议侧 `text()`/`arrayBuffer()` 不抛，放行。
   空体状态**不能带 body 重建**这条构造性限制保留（`Response` 构造会拒绝），但 json 分支已在更前面拦下。
2. 复用分支不再提前返回旧 coverage：`reused:true` 只表示"拦截函数身份没变、不必再包一层"，
   **覆盖率每次安装都实发一条非付费命令重新自证**。
3. 派发前的门禁身份核对比的是**已安装的那个**包装函数（`probe.gate.wrappedFetch`），
   否则复用路径下新建的闭包与被挂上的旧包装不是同一个函数，会恒假、把正常派发全拒了。

### 证据（`scripts/ipc-gate-check.mjs`，**先证红**）

- 新 ⑨ 组：204 / 205 / 304 三例各走"正常 200 装起来（覆盖率获证）→ 注入空体 json 响应 → 重装（复用）→ 再发两条付费命令"。
  三例均：解码失败被如实记下、`fallbackLatched=true`、协议**没有**切通道（`post=0`）、额度 0 时付费传输 **0**。
- ⑨ **旧形状对照**（把旧 status 短路原样塞回生产源码）：同一场景下 `paid=2`、`post=3`、
  `postCmds=[list_documents, prep_turn, gen_svg]` —— **与复核记录的反例逐项吻合**，证明本组的断言不是恒真。
- 新 ⑩ 组：复用路径确实重发自证命令（按假后端实际收到的 `list_documents` 次数计），
  `rewrapCount=0`（没有再套一层），返回的是**新**一次覆盖率记录，且额度 1 时两条付费仍只放行 1 条。
- 结果：**IPC-GATE PASS 67/67（计划 10/10）**，本轮之前为 36/36。

---

## 二、P0-C：最终证据与 phase 闭合顺序

### 缺陷（复核原件）

同上一份 README「剩余反例 B」：

- **B1**：业务失败屏障用**一次**独立 `recordPhase` 写、phase 关闭再写一次。屏障那次写失败、关闭成功时，
  盘上留下 `open:false, outcome:error` 却**没有** `businessFailure`；新进程读到
  `unresolvedPhase=null` / `priorBusinessFailure=null`，照常 `beginPhase` 并预留。
- **B2**：`finalizeAndExit()` 先 `finalizeLedger()`（账本记 pass），之后才写 `report.md` 等必需证据。
  证据写失败时本次判定确实是 ERROR/exit 1，**但账本已经写着 pass**，下一进程仍获准继续。

### 修复

新增 `scripts/lib/ledger-finalize.mjs`，作为账本收尾的**唯一生产实现**（与 `ipc-gate.mjs` 同样的做法）：

1. `finalizePhase()`：业务失败标记与 phase 终结**合并成同一次原子账本写**
   （`closePhase({…, extra:{businessFailure:true, failedChecks}})`，落盘是"写临时文件 + rename"，
   要么两者都在、要么两者都不在）。写失败 = 盘上仍是**未闭合** → 下一个进程必须先核对。
   只有"这一轮根本没 `beginPhase`"时才退回单独记一条屏障。
2. `runFinalizeSequence()`：把**顺序**本身也变成生产代码 —— ①必需证据先落盘 → ②再闭合账本（用最终状态）
   → ③按最终判定重写证据。`live-acceptance.mjs::finalizeAndExit()` 改为调用它；`main()` 的 `finally`
   不再调用 `finalizeLedger()`。
3. `preflightLedgerGate()`：启动阶段的两道历史门槛（未闭合 phase / 未解除的业务失败）抽成同一个函数，
   驱动与本轮回归共用，不再各写一份。
4. `dispatch-budget.mjs::priorBusinessFailure()` 兜底：除 `businessFailure` 标记外，也认**已闭合条目**
   里 `outcome` 为 `error`/`fail` 的（那是旧实现可能留下的、没有标记的失败条目）。扫描顺序仍是"从新往旧"，
   因此人工 `businessFailureCleared` 之后的记录优先。

### 证据（新 `scripts/ledger-finalize-check.mjs`，**先证红**）

用**真实预算写者**（真实原子落盘、真实跨进程锁）驱动**生产收尾函数**，并且用**真正的新子进程**
（`scripts/fixtures/ledger-gate-child.mjs`，`spawnSync` 另起 node —— 复核明确要求过"同进程新实例不冒充新 OS 进程"）
重读同一份隔离账本、跑同一套历史门槛：

- ① B1：注入"终结那次写失败" → `closed=false`、`failurePersisted=false`、盘上 phase **仍未闭合**；
  新子进程读到未闭合记录、被门槛拦下、**假传输 0**。显式 `--resume` 后才继续（transported=1），
  且闭合留理由、不返还额度、不清零累计（2 次派发仍在账上）。
  **对照**：把旧的两写顺序演一遍（屏障写失败、随后关闭成功）→ 复现"`open:false` + `outcome:error` +
  **没有** `businessFailure`"的原始反例条目；并验证新版 `priorBusinessFailure()` 用 `via=outcome` 也能认出它。
- ② B2：用生产 `runFinalizeSequence` + 生产 `finalizePhase`，第一次落盘用一个真实写失败的报告路径
  （文件名被目录占住）→ 判定降级 ERROR、账本**没有**留 pass（`outcome=error` + `businessFailure=true`）、
  新子进程**假传输 0**。
  **对照**：旧顺序（先 `closePhase({outcome:'pass'})`、后写证据失败）→ 账本就是 pass，新子进程
  **照常预留（transported=1）**——两者唯一的差别就是"账本闭合发生在必需证据落盘之前还是之后"。
- ③ 正常对照：全通过 → 账本干净闭合为 pass、无失败标记 → 新子进程不被拦、正常派发 1 次。
- ④ 结构断言：驱动确实接住这套生产实现（导入、序列函数、门槛函数、不再裸调 `finalizeLedger()`、
  屏障不再由驱动侧单独写一次）。
- 结果：**LEDGER-FINALIZE PASS 39/39（计划 4/4）**。

**局限（如实记录）**：② 里"落盘错误并回判定对象"的那一小段是驱动侧逻辑的**最小同口径替身**；
本脚本保证的是**顺序**与**账本落盘结果**两件事，驱动源码里的接线由 ④ 组结构断言与
`live-driver-check` ⑥ 组钉住，不是逐行执行驱动原文。

---

## 三、顺带：`release-smoke` 的最终判定消费关闭结果

复核 §0.0 末段的附带要求。`scripts/release-smoke.mjs` 原来把 `closeOwnPid` 的结果只写进证据、
不参与 `run.checks`/`status`，于是"身份不符被拒绝关闭"与"等不到正常退出只好强杀"都能报 PASS。
现在新增两条检查：`closed===true && refused!==true`、`forced!==true && exitedBeforeRequest!==true`。

**已用真实运行验证**（不是只改源码）：隔离启动冒烟 **PASS 7/7**（原 5/5），
`closed=true forced=false refused=false via=wm-close`，真实工作区 55 文件逐字节未变，
被测 exe `64ab2946aecee3a84fcc67d67a3a2d9ef8001f110a250e11b9fc5e35ec6dac5a`。

---

## 四、本轮全量零模型回归（全部新目录，未覆盖既有证据）

| 类别 | 结果 |
| --- | --- |
| 离线 runner（17 个） | ipc-gate **67/67**、budget 91/91、ledger-finalize **39/39（新）**、live-driver **42/42**（+2 结构）、cdp-preflight 30/30、fact-assert 30/30、runner-negative 28/28、compose 98/98、delivery-quality 123/123、asset-completion 58/58、asset-resolve 86/86、photo-swallow 33/33、repair-integrity 75/75、trace 107/107、svg-quality 20/20、progress 36/36 |
| 浏览器 runner（5 个，本地 dev server + 显式 chromium） | verify-ui **134/134**、prep-contract PASS、preview-resource PASS、repair-flow PASS、raster 8/8 |
| 真实桌面（零模型） | release-smoke **PASS 7/7**（隔离 profile，自有 PID 关闭，真实工作区未变） |

`live-driver-check` 两条结构断言随本次抽模块同步更新（原来断言的是 `live-acceptance.mjs` 里那份内联实现，
现在改为"驱动必须接住 `lib/ledger-finalize.mjs`，行为在那边断言"）。

---

## 五、仍未做 / 不因本轮改变

- 指南 §0.0 的 **P1**（旧 38 目录索引口径、22/5 与 21/4 的 1/1 差额归因、默认版 CDP 探针输出定位、
  中文安装包路径与哈希、证据勘误）与 **P2**（多页导出零模型夹具、安装交付隔离验证、默认版代表稿与续改、
  微信后台人工核对）**均未推进**。
- 账务 1/1 差额仍为 **UNKNOWN、继续占额度、未退款**；累计账本 56 次派发 / 11 次绘图未被本轮触碰
  （本轮只在隔离临时账本上操作；真实账本仅只读核对过门槛判定）。
- 本轮的"关闭"仅指**这两类确定性缺口的行为回归已转绿并附反证**；是否关闭该指南条目仍须由独立复核确认。
- 多页分页、微信后台观感、断电恢复、多实例并发、图像理解仍是各自独立边界。
