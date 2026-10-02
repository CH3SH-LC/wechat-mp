# 2026-10-02 收口：IPC 门禁 / 进程身份 / 失败屏障 + 发布版签收

对应 [DS 修复指南 §0.0](../../design/ds-repair-guide-2026-09-30.md#00-2026-10-02-最新复核与直接执行任务)
「第一优先级 A/B/C」与「第二优先级 1/2/3/4」。本文件是**执行记录与证据索引**，判定口径与失败边界都在里面，
不做比证据更强的总结。

**本轮花费的真实模型调用：0。** 全部检查要么是纯 Node 离线（假传输 / 假进程 / `node:vm` 沙箱），
要么是**零模型**的真实桌面运行（L5/L6 关停重开与导出，phase 中止线为 0）。没有新增付费派发，
没有扩容账本，没有重置累计，没有删除或覆盖任何既有证据目录。

证据根目录（仓库外，含大件原件）：
`%TEMP%/wxmp-closeout-20261002-192442-8591/`（本轮全部日志、清单、哈希）与
`%TEMP%/wxmp-pubver-1790940744/`（发布版签收用的隔离副本 + 导出成品）。
按仓库口径（只提交代码与文档），截图 / JSON / JSONL 不入库，本文件只记路径与 SHA-256。

---

## 一、第一优先级 A：所有 IPC 通道都必须经过派发前门禁

### 缺陷（已有原件）

`live-acceptance.mjs` 原来的门禁只挂 `window.fetch`。但本机锁定的 tauri 2.11.5 在**任意一次** IPC
fetch / 响应解码失败之后，会把 `customProtocolIpcFailed` 置真，此后所有命令改走
`window.ipc.postMessage`；而那条通道 wry 0.55.1 在 Windows 上是**冻死的**：

```
wry-0.55.1/src/webview2/mod.rs:885
Object.defineProperty(window, 'ipc', { value: Object.freeze({ postMessage: s=> window.chrome.webview.postMessage(s) }) });
```

属性不可写、对象已冻结 —— 页面侧**拦不住**。所以"再挂一个通道"这条修法根本不成立。

### 修法（三条防线 + 一处自证）

新模块 `scripts/lib/ipc-gate.mjs`（付费命令表**由 `dispatch-budget.mjs` 生成**，不手工维护第二份）：

1. **永不 reject**：门口 `window.fetch` 的返回值在任何失败下都转换成**协议合法的错误响应**
   （200 + `Tauri-Response: error`）。协议切通道的唯一触发点就是它自己那条链的 reject，
   所以"永不 reject"等于"永不切通道"。响应体也先读干再重建 —— 协议对 `response.json()` 的
   **解码失败**同样算 reject，这条也一并挡在门禁这一侧。
2. **一旦真出故障就停发**：`fallbackLatched` 之后本回合所有付费命令一律拒绝，不让协议"悄悄换个通道继续花钱"。
3. **覆盖率自证**：装好后主动发一条**非付费**命令（`list_documents`），确认它确实经过本门禁。
   没经过 = 协议已经不走自定义协议通道（回退在安装之前就激活了）→ 驱动**拒绝开测**。
   这是这个缺陷唯一诚实的处置：那时候页面侧任何补丁都够不着付费请求。
4. 装/重装都核对**当前实际的拦截函数身份**（`window.fetch === probe.gate.wrappedFetch`），
   不再只看 `T.__liveAcceptanceProbe` 旧标记；派发前再核一次。

驱动侧接线（`scripts/live-acceptance.mjs`）：`openAppOnce` 按覆盖率拒绝开测；回合开始前再查一次；
等待循环里监控 `gateLive` / `fallbackLatched`，中途失效即停手并判失败。

### 证据

新 runner `scripts/ipc-gate-check.mjs`（**用本机真实协议源码**，从 Cargo registry 按 `Cargo.lock`
锁定的版本现取；取不到就 BLOCKED，不伪造）：

- 协议源码：`tauri-2.11.5/scripts/ipc-protocol.js`，SHA-256
  `68ae690606006f733bde75dd8bb6748464954a22c7e83914a93b1abc221d7072`
  —— 与晚间复核报告里记的是**同一份**。
- 结果：**PASS，36/36，8 个计划场景全执行**（沙箱是 `node:vm` + 假传输，没有浏览器、没有应用、没有网络）。

| 场景 | 断言结果 |
| --- | --- |
| ① 正常 IPC，额度 1 | 假后端付费传输**恰 1 次**；被拒那次留下理由；`postMessage` 计数 0 |
| ② 额度 0 | 付费传输 0，且没有从 postMessage 漏出去 |
| ③ 非付费 IPC fetch 失败 | 失败被记下；额度 0 下付费传输仍是 0；后续付费命令仍在门禁链路上 |
| ④ 响应解码失败（非法 JSON / 响应体读取失败） | 两条都记下并阻止切通道；付费传输 0 |
| ⑤ 宿主预留 Promise reject | 记下并转成错误响应；付费传输 0；协议没被推进回退 |
| ⑥ 回退在安装前就已激活 | 覆盖率探针**检出**（`viaFetch=false`）；驱动判定为拒绝发送 |
| ⑦ 拦截函数脱落 | 重装识别出函数已换并重新包装；`rewrapCount=1`（没有套两层）；付费传输 0 |
| ⑧ L5/L6 形状（中止线 0） | 五条付费命令一条都没发出；五条都被记录为"被拒" |

**可证伪性（变异实测，不是自述）**：

- 把非付费那行改回"直接放行"（= 2026-10-02 的旧形状）→ **FAIL 29/36**，第 ③④ 组红，
  且第 ③ 组的证据行正是晚间反例的形状：`paid=2 post=3`，即**额度 0 却经 postMessage 到达假后端 2 次**。
- 把覆盖率判定改成恒真 → **FAIL 34/36**，第 ⑥ 组两条红。
- 恢复后 → 36/36 PASS。

### 未闭合的边界（如实）

- **回退已激活之后**，页面层拦不住（协议不会再调 fetch）——防线是"启动时自证 + 检出即零派发"，
  不是拦截。第 ⑥ 组的"对照"一格专门展示了"不检查就会绕过去"，就是为了不让这条被读成"已拦截"。
- 门禁的"永不 reject"会把一次真实的 IPC 故障转换成一个**命令级错误响应**给应用。
  这是有意的取舍（保住预算门禁的完整性），代价是应用看到的是错误而不是崩溃；
  这个过程**全程留痕**（`customProtocolFailures` / `decodeFailures` / `fallbackLatched` 都进证据）。
- 本组证明的是"所测配置下协议不会切通道"，不能外推成"任何 tauri 版本都如此"。

---

## 二、第一优先级 B：部分身份未知与强制关闭前的身份变化必须拒绝

### 缺陷（已有原件）

1. `procIdentity()` 一旦映像名相同就先置 `true`，路径或创建时间**缺失**时跳过比较 ——
   于是"只读到映像名"（powershell 失败退回 tasklist 的形状）也能被当成身份确认，照常关闭。
2. `closeOwnPid()` 只在最开始核验一次；温和关闭等待超时后**直接**发 `/F`，之前没有再核验。
3. `release-smoke.mjs` 关闭时只传了 `{ exe }`。

### 修法

- `procIdentity()` 新增 `identityComplete` / `missingFields`（= 活着 + 探针成功 + 映像名/路径/创建时刻都读到）；
  给了预期路径而实测读不到、给了预期创建时刻而实测读不到，都记 `matchesExpected = null`（"查不出来"≠ true）。
- `closeOwnPid()`：
  - 在任何关闭动作之前加**启动身份齐备**门槛（预期映像名 + 完整路径 + 创建时刻，缺一即
    `{ closed:false, refused:true, via:'incomplete-identity' }`，`runner` 一次都不调用）；
  - 温和等待超时后、发 `/F` **之前**再核验一次：进程已退 → `wm-close-late`（closed/非强杀）；
    身份变了 → `identity-changed-before-force`，**绝不发 `/F`**。
- `release-smoke.mjs`：启动后立刻 `procIdentity()` 记录本轮身份，关闭时传入。
- `live-acceptance.mjs` 启动核对里新增一条门禁：身份字段不齐备就**拒绝继续**（缺字段意味着关不干净，
  宁可不跑也不留下一个既花了钱又收不掉的进程）。

### 证据

`scripts/cdp-preflight-check.mjs`：**30/30 PASS**（原 23 条 → 27 条新断言 + 原 23 条中的若干条改为传完整身份）。

- 证红（改前 harness + 新测试）：**FAIL 23/30**，7 条新断言逐条失败。
  两条典型：只读到映像名时 `{"refused":false,"via":"wm-close","calls":1}`；
  强杀前身份变化时 `calls=[["/PID","987654"],["/PID","987654","/F"]]`（**发出了 `/F`**）。
- 转绿（改后）：**PASS 30/30，exit 0**。
  只给 exe → `incomplete-identity, calls=0`；缺创建时刻 → `incomplete-identity, calls=0`；
  探针只读到同名映像 → `identity-mismatch, calls=0, reasons=["actual-path-missing","actual-start-time-missing"]`；
  强杀前身份变化 → `identity-changed-before-force`，`calls=[["/PID","987654"]]`（**没有 `/F`**）；
  等待期自行退出 → `wm-close-late, closed=true, forced=false`。

### 未闭合的边界（如实）

- 这条门槛是**故意的 fail closed**：如果某台机器上 PowerShell 取不到 `StartTime`/`Path`，
  冒烟与验收会**拒绝关闭**（而不是冒险关错进程），代价是那一刻会留下一个活着的隔离实例。
  本机实测 `Get-Process` 路线可用（`identityComplete=true`），本轮 L5/L6/冒烟都正常关闭。
- 创建时刻的比对照旧用 ±3000ms 容差：PID 在 3 秒内被回收且新进程创建时刻落在容差内时，
  该维度不会报错（仍有映像名/路径兜底）。未改动这一既有设定。
- 历史证据 `2026-10-02-evening-review/cdp-release/identity-probe.mjs` 的结论文字**相对当前代码已过时**
  （重跑会得到"全拒"）。按"不覆盖旧证据"的要求未重跑、未改写，此处仅作说明。

---

## 三、第一优先级 C：失败记录写不成时，下一个进程不能凭旧账本继续

### 缺陷（已有原件）

原实现只在"业务失败那一刻"才写记录，而**那次写可能失败**。恢复成"可读的旧账本"后，
新实例读到 `priorBusinessFailure = null`，照样预留 —— "上一次跑了一半"在盘上没有任何痕迹。

### 修法（`scripts/lib/dispatch-budget.mjs`）

- 新增 `requirePhaseOpen`（**默认 true**，fail closed）：付费预留前必须已经 `beginPhase()`。
- `beginPhase()`：把"本 phase 已开始"这条**在途状态**先持久写进账本；写不成 → 直接返回 false，
  本进程不许付费派发。账本里已有未闭合 phase 时**拒绝开第二个**。
- `closePhase()`：只有终结证据写入成功才算闭合；写不成 → 保持未闭合。
- `unresolvedPhase()` / `resolveUnresolved(reason)`：新进程启动时先读未闭合记录；
  人工核对后**显式**闭合，理由留痕，**不返还额度、不清零累计、不删历史**。
- `critical()` 现在把 `refused` / `unresolved` 等字段原样带出去（原来被吞掉，调用方无法区分
  "额度用尽"与"phase 已有未闭合记录"）。

驱动侧（`live-acceptance.mjs`）：开局先读未闭合 phase，读到就要求 `--resume-after-fix "<理由>"`
才能继续；启动应用**之前** `beginPhase()`；收尾在**业务失败记录之后** `closePhase()`（顺序反了会把
"这一轮没跑完"一起抹掉）。

### 证据

`scripts/budget-check.mjs`：**91/91 PASS**（原 65 条 → 新增第 ⑬ 组，13 个计划场景全执行）。

第 ⑬ 组的核心一格正是原反例的形状：`closePhase` 写失败 → 丢掉写者 → 新进程打开**同一份旧账本** →
`priorBusinessFailure() === null`（读不到业务失败标记）→ **但付费派发仍为 0**（因为有一条持久的未闭合在途记录）。
随后 `resolveUnresolved()` 之后才恢复派发，且断言 `led.phases.length >= 2 && totals.dispatches === 2`
（**不删历史、不返还额度、不清零累计**）。

**可证伪性**：把 `requirePhaseOpen` 默认值翻成 `false` → **FAIL 85/91**，第 ⑬ 组 6 条红；
恢复后 91/91。

### 未闭合的边界（如实）

- 屏障保证的是"**下一个进程会先核对**"，不是"上一个进程一定留下正确结论"。
  未闭合期间那些预留**继续占额度**，计费状态仍是 UNKNOWN —— 这是有意的：不能凭一条写失败的记录退款。
- `scripts/budget-check.mjs` 的 ①–⑫ 组显式用 `requirePhaseOpen: false` 构造预算（它们测的是
  `reserve()` 的额度语义，不跑生命周期），屏障语义全部由第 ⑬ 组**用默认值**覆盖。

---

## 四、第二优先级 1：核清那 1/1 差额（**已定位，仍保留 UNKNOWN，未退款**）

方法：账本 `%TEMP%/wxmp-live-acceptance-budget.json` 的逐条 `phases` + 每个尝试自己的
`evidence.json` 里的 `ledgerBefore/ledgerAfter` + 运行 root 的 trace 记录，三者交叉。

`wxmp-live-run1` 这一段：账本 34/6 → 56/11（增量 **22 派发 / 5 绘图**），
该 root 的 trace 记录 **21 个 request / 4 个 gen_svg**。差额 **1 / 1**。

逐尝试对齐（每一格的"入场/出场"都取自该尝试**自己**的 `evidence.json`，不是算术倒推）：

| 尝试目录 | 入场 | 出场 | 预留 | trace request | trace gen_svg | 终结记录 |
| --- | --- | --- | --- | --- | --- | --- |
| L1 10-05-54 | 34/6 | 38/7 | 4/1 | 4 | 1 | commit ok |
| L2 10-08-07 | 38/7 | 40/7 | 2/0 | 2 | 0 | `run ok=false stage=validation`（协议失败） |
| L2 10-10-23 | 40/7 | 42/7 | 2/0 | 2 | 0 | commit ok |
| L4 10-10-38 | 42/7 | 45/8 | 3/1 | 3 | 1 | commit ok |
| L4 10-11-57 | 45/8 | 48/9 | 3/1 | 3 | 1 | commit ok |
| **L4 10-14-12** | **48/9** | **51/10** | **3/1** | **2** | **0** | **无 `run` 终结记录** |
| L4 10-15-27 | **51/10** | 54/11 | 3/1 | 3 | 1 | commit ok |
| L5 / L6 / L6 | 54/11 | 54/11 | 0/0 | 0 | 0 | 无模型调用 |
| L3 10-29-08 | 54/11 | 56/11 | 2/0 | 2 | 0 | （普通问答，无提交是正确行为） |

**结论（把能确定的和不能确定的分开写）**：

- **能确定**：差额的 1/1 **完全**来自 `L4-2026-10-02T10-14-12-2927b2d0`。这不是倒推：
  紧随其后的成功尝试 `L4-2026-10-02T10-15-27-cf29391e` 自己的 `evidence.json` 里
  `ledgerBefore.totals = {51,10}`，正好等于上一格的 48/9 加 3/1。该目录只有 `L4-before.json`，
  **没有** `evidence.json` / `run-result.json`，trace 文件 `rmuqt34d0-1.jsonl` 里只有 2 条 `prep` 请求，
  **没有** `gen_svg`，也**没有**任何 `kind:"run"` 的终结记录。
- **不能确定**：那 1 次预留了却没有 trace 的派发**到底有没有打到服务端**。
  最一致的读法是"3 次预留 = 2 次 prep（有 trace）+ 1 次 gen_svg（无 trace）"，
  即缺的那一条就是那次绘图。但它也可能根本没发出（进程/页面前就中断了）。
  **没有价格与 usage，就不写金额；没有请求证据，就不写"已计费"或"未计费"。**
- **处置**：按指南，该预留**继续占额度**、状态记 **UNKNOWN**，**不退款、不补造 PASS、
  不把 56/11 写成"已核清的实际收费请求数"**。账本 totals 未做任何改动（读数仍为 56/11）。

---

## 五、第二优先级 2：尝试历史与分母（不让"合规率"这句话有立足之地）

对 `%TEMP%/wxmp-live-*/evidence/*` 全量枚举（方法可复算，见
`attempt-inventory.json`）：**38 个尝试目录**，其中

| 状态 | 条数 | 说明 |
| --- | ---: | --- |
| PASS | 8 | 六个业务场景（run1 内经修复重试分别通过）+ 本轮的 L5/L6 发布版签收 |
| FAIL | 14 | 检查未过；多数是"13 条检查未通过"模型协议违规 / 自动修复循环 |
| BLOCKED | 14 | **几乎全部是 `checks=0/0 errors=1`**：启动 / 依赖 / 预算阶段就停住，**零派发** |
| ERROR | 1 | 检查 24/29、错误 2（L1 07-13-42） |
| 无 run-result | 1 | 就是第四节那个 `L4-10-14-12` |

**这 38 个目录不能当"模型合规率"的分母**：14 个 BLOCKED 一个模型请求都没发出去，
其中包含启动阻塞、缺依赖、预算拦截与驱动故障；把"13 次混合尝试"折成"合规率约一半"是错的。
若要谈合规率，分母只能是"**实际到达模型的请求**"（run1 段 = 21 条，全部 `ok=true`），
而不是"跑了多少次脚本"。本轮没有扩大自动重试，也没有改变用户选择的严格 candidate/text 互斥口径。

---

## 六、第二优先级 3：发布版与验收版分别签收（**发布版本轮首次取得零模型业务证据**）

| 二进制 | SHA-256 | 本轮证据 |
| --- | --- | --- |
| 默认发布 exe（**不开** devtools 特性） | `64ab2946aecee3a84fcc67d67a3a2d9ef8001f110a250e11b9fc5e35ec6dac5a` | 构建 + 隔离启动冒烟 **PASS 5/5**；**新增** L5 **PASS 32/32**、L6 **PASS 27/27** |
| NSIS setup（中文名，本次构建） | `09cfac193c6bb582872d2d023c482dc245ed3a5e925ac1f064fb85b30615b994` | 与上同一次 `pnpm tauri build --bundles nsis` |
| 验收 exe（`--features acceptance-devtools`） | `36b45e256b9be3fe644a1bd060c84e6902b34631ae1f22dfc2375ea628703522` | 仍是六个业务场景那一份，**本轮未重建、结论沿用** |

L5/L6 跑在一个**隔离副本**上：把 run1 root 的 `profile/`（含作品与 `baselines.json`）与 `webview/`
拷到新目录 `%TEMP%/wxmp-pubver-1790940744/`，原始作品与原件**逐字节未动**。

- L5（关停重开）：基准 = L4 revision `r1790936230221652500`（generation 5）；PID-A 读回全字段一致 →
  走应用自身退出路径正常关闭（`via=wm-close, forced=false`）→ PID-B 新进程同 profile 读回**逐字段一致**、
  界面 `doc-state=accepted`、徽标显示同一 revision → 重开期间**零模型请求**（探针无模型命令 + trace 可观察且 0 请求）。
- L6（导出）：HTML 回执绑定的文件与基准**逐字节一致**且属本轮新增；长图与分页 PNG 各 750×1340、
  浏览器真实解码 `naturalWidth=750`、分页无缺漏；375px 手机壳截图（564×698 像素）落盘；本轮**零模型调用**。
- 人工目视：实际打开导出的长图，标题「周末到馆提醒」、窗台绿植与红色书本配图、
  「10月10日（周六）9:00–17:00 正常开放」「10月11日（周日）全天闭馆」「自习区设在一楼」
  「咨询电话 010-55566666」全部清晰可读，无截断、无源码泄漏。

归档（路径见文首证据根）：`gitHead 472fd3d`（工作树带未提交改动）、输入清单 880 个文件 /
49,113,607 字节、清单自身 SHA-256 `6e02ae9d…`（构建前）与 `5b42efc4…`（构建后）、
工具版本 node v24.13.0 / pnpm 10.33.2 / cargo 1.95.0 / rustc 1.95.0、敏感文件跳过 0。

构建前后清单的唯一差异是 `scripts/live-acceptance.mjs`（我在构建之后修了一处注释取值），
它**不是** exe 的输入（`scripts/**` 不进 `dist/`、不进 bundle），所以不影响二进制 provenance；
但按"清单只记事实"的口径，这里如实写明。

**收口时发现的一处遗留（未处置，仅报出）**：`src-tauri/target/release/bundle/nsis/` 下还有一个
`wechat-mp-desktop_0.1.0_x64-setup.exe`（2026-09-08 的陈旧产物），与本次新构建的
`智序_0.1.0_x64-setup.exe` 并排放着。它不是本次产物，我没有删它——但它会误导"哪个是这次发布的 installer"。

---

## 七、第二优先级 4：收窄 CDP 因果结论（做了一次有区分力的零模型对照）

**新证据（零模型、零密钥、自有进程、跑完即关）**：默认发布 exe（**不开** devtools 特性），
**同一个隔离 profile** 连开两次：

| 轮次 | 结果 |
| --- | --- |
| 第 1 次（该 profile 的首次启动） | 90s 内**没有**可用 CDP 页面 |
| 第 2 次（同一 profile 再启） | **432ms** 就连上，页面是 `type=page, url=http://tauri.localhost/, hasDebugger=true` |

**这条对照推翻了原来的因果文案**：`PROGRESS.md` / CDP 文档 / `Cargo.toml` 注释里
"根因已经钉死：`tauri` 的 `devtools` 特性没开导致 release 里 `AreDevToolsEnabled(false)`，
宿主自己关了调试端点"——**站不住**。因为**没开**该特性的默认发布 exe 在 profile 预热之后**也能**提供
CDP over TCP。本轮实测支持的说法是：**决定因素落在 profile 是否已完成首轮初始化**，
而 `devtools` 特性与 TCP 端点之间的因果**没有**被任何证据支持（微软 API 文档也只把它描述成
"用户经上下文菜单/快捷键打开 DevTools 窗口的权限"）。

顺带的直接后果：**默认发布版是可以被驱动的**（预热一次即可），
所以"F 被 WebView2 卡住"这句话在发布版上也不再成立——第六节就是用它跑出来的。

`acceptance-devtools` 特性与验收 exe 依旧保留（它们工作正常），但**不再是"能不能连上"的解释**。

---

## 八、本轮跑过的检查（全部 PASS，实际命令与输出见证据根 `runners/*.log`）

| 组 | 结果 |
| --- | --- |
| 离线 15 个 runner | compose 98/98、asset-resolve 86/86、svg-quality 20/20、delivery-quality 123/123、asset-completion 58/58、photo-swallow 33/33、repair-integrity 75/75、trace 107/107、progress 36/36、runner-negative 34/34、fact-assert 30/30、**budget 91/91**、**cdp-preflight-check 30/30**、**live-driver 40/40**、**ipc-gate 36/36（新增）** |
| 浏览器 4 个 runner | verify-ui 134/134、prep-contract、preview-resource、repair-flow 全 PASS（临时 vite 服务，自由端口，跑完已停） |
| Rust | `cargo test --lib` 133 passed / 0 failed / 4 ignored |
| 前端 | `pnpm build`（tsc + vite build）干净 |

`scripts/live-driver-check.mjs` 新增 5 条**结构断言**（不是行为断言）钉住本轮接线：
`requirePhaseOpen: true` + 检查 `beginPhase` 返回值、未闭合 phase 的阻断路径、收尾 `closePhase` 的返回值检查、
两处 `closeOwnPid` 都传本轮启动身份、启动核对要求 `identityComplete`。

---

## 九、仍然开着的边界（不写成完成）

- **账务**：那 1 次无 trace 的预留仍是 UNKNOWN，继续占额度。什么时候能定论？
  只有拿到服务端侧的计费明细才行；本机没有。
- **CDP 根因**：本轮只证明了"默认发布版预热后可驱动"与"devtools 特性不是决定因素"。
  "为什么首启不监听端口"仍没有受控到根因（未重装运行时、未改全局策略），继续记 UNKNOWN。
- **验收版六场景**沿用既有 PASS 证据，本轮**没有重跑**，也没有把它们自动移给别的二进制。
- **未覆盖项**（沿用旧结论，不被本轮任何成功样本外推）：微信后台观感 / 上传、断电恢复、
  多实例并发、图像理解。
- **仓库根有一个游离的 `cdp-matrix.json`**（2026-10-01 16:40，`{matrix, conclusion}`）：
  某次 `cdp-preflight` 把矩阵写到仓库根留下的历史原件。`STRUCTURE.md` 已经把它登记为"不当作正式输出入口、
  也未删除"，所以本轮**按既有结论保持原样**，不清理。
