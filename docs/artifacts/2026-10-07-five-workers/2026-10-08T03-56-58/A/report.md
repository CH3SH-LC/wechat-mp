# A 路：可纠正的终结参数错误（T3）诊断与有界纠偏

- run-id：`2026-10-08T03-56-58`（A 路）
- HEAD：`df97022acedb6e1a3172a8459337c72894f68e0a`
- 唯一允许写入：`src/lib/prep.ts`、`scripts/prep-contract-check.mjs`、本目录 `A/`
- 本轮只做**离线**验证：不联网、不调真实模型、不启动桌面应用、不写累计账本。
- **证据纪律**：`%TEMP%\wxmp-f1-real-g2a` / `-g3` 的原件里 **Rust 侧只存工具名、不存参数**，
  看不到模型塞进 `text` 的原话。因此本路的非法参数输入**全部是受控夹具**（按已知失败形状构造的
  `finish_preparation` 实参），**不是对真实响应的回放**。下文凡"真实"二字都指 F1 报告第七节的观测记录，
  不指本次实验的输入。

---

## 一、结论摘要

1. **触发条件（可纠正的一类）**：单条回复里**只有一个** `finish_preparation`，其 `outcome` 取值为**合法值**
   （`compose` 或 `candidate`），却同时带了**存在且非 null** 的 `text` 字段——即"终结字段互斥冲突（text）"。
   这与 F1 观测到的失败形状逐字对应：`finish_preparation { outcome:"compose", text:…, assetPolicy:… }`。
2. **缺陷不在"拒绝"上，在"拒绝之后没有反馈、没有第二次机会"**：`parseFinishArgs` 的正确拒绝
   （严格互斥、不猜"以谁为准"）是**对的**，必须保留；但 `runPrep` 对**工具参数错误**的处理是
   **一次性 `return failed`**——它既不把错误回传给模型，也不消耗剩余预算再问一次。于是一次
   本可在第 1 次请求后就被纠正的参数错误，直接吃掉了整个准备回合（0 产出）。
3. **判据是机械的、不涉及意图**：只检查"声明的 outcome 合法 + 出现只属于 reply 的 `text`"这一**结构**属性，
   不读语义、不猜"它到底想 reply 还是 compose"。纠偏轮只**告诉模型它刚才的调用被拒了、请重新声明**，
   由模型自己决定改成哪一种——没有任何前端意图判断（铁律 6），也没有替模型补/删参数。
4. **预算**：纠偏不新增预算。它是同一个 `for (callNo < MAX_PREP_CALLS)` 循环的下一次迭代，
   总额仍是 3 次；`callNo + 1 >= MAX_PREP_CALLS`（即最后一次请求）时**立即失败**，不会发出第 4 次请求。
5. **至多一次**：与既有旧协议文本纠偏**共用同一个 `corrected` 标志**——整个准备回合最多纠偏一次，
   不区分类型；纠偏后再次非法（含再次同样的参数错误）**立即失败，不再追加**。

---

## 二、触发条件的精确定义（先诊断，后实现）

### 2.1 现状：两条分界完全不同的路径

`src/lib/prep.ts` 的 `runPrep` 里，模型的回复按"有没有工具调用"分流：

| 回复形态 | 现在的处理 | 有没有"纠偏" |
| --- | --- | --- |
| 知识工具调用 | 机械执行 → 回传 tool 结果 → 下一轮 | 不需要（本来就该继续） |
| **一个终结工具 + 参数合法** | 直接产出 reply/compose/candidate | — |
| **一个终结工具 + 参数非法** | **立即 `return protocolFailure(args)`** | **没有。零反馈、剩余预算全部作废** |
| 知识工具与终结工具混用 / 多个终结 | 立即协议失败 | 没有（本轮明确要求保留） |
| 无工具、正文为空 | `continue` 下一轮 | 不加说明的重试 |
| 无工具、正文含 READY / 围栏正文（旧协议形态） | 有剩余预算 → 追加 `PREP_CORRECTION` 再问一次 | **有，且只在这里** |

**分界结论**：产品**已经有**"有界纠偏"这个机制，也已经有"总额 3 次、纠偏占用同一预算、
最后一次不再纠偏"这套约束（`legacyShape && !corrected && callNo + 1 < MAX_PREP_CALLS`）。
缺的只是：**这套机制没有接到"终结工具参数错误"这条路上**。
所以 T3 的正确修法不是新造一套重试，而是**把已有的同一套有界纠偏接到这一条已知错误形状上**，
不放松任何校验。

### 2.2 为什么"这一类"必须收得很窄

"参数非法"是一大类。只把其中**一个**已知形状接进纠偏，其余保持一次性失败：

| 参数错误的形状 | 是否接纠偏 | 理由 |
| --- | --- | --- |
| `compose` / `candidate` 带 `text`（**T3 本类**） | **是**，至多一次 | 有真实复现（G2A、G3 各一次）；错误是**纯结构性**的（合法 outcome + 越界字段）；纠偏只要求"重新声明"，不涉及意图猜测 |
| `reply` 带 `source`（互斥） | **否** | 现象不同（"既想答复又想交稿"），无真实复现；且现有冻结断言 `strict-exclusive-fields` 明确要求 1 次请求即失败，改它就等于动已冻结的判据 |
| 缺 / 非法 `assetPolicy` | **否** | 属于"必填字段缺失"，不是"越界字段"；无真实复现。指南 §5.3 虽写了"缺失或非法值走有界纠偏/失败"两可，但本轮**不为未复现的形状扩面**（见第七节"未覆盖"） |
| 未知 `outcome` / `outcome` 非字符串 / 顶层非对象 / 坏 JSON | **否** | 任务卡**明文禁止**强转与猜测 |
| `candidate` 的 `source` 为空 / 围栏不成对 / 非字符串 | **否** | 无真实复现；且不能替模型改写正文 |
| 知识工具与终结工具混用 / 多个终结 | **否** | 本轮必须保留"正确拒绝"，已有断言覆盖 |
| 空回复 / 旧协议文本 | 现状不变 | 已有各自的处理 |

判据（唯一实现入口，避免复刻校验逻辑而漂移）：

```
isCorrectableFinishError(args) === true
  当且仅当：
    · args 能解析成 JSON 对象（非数组 / 非 null）
    · o.outcome 是字符串且严格等于 "compose" 或 "candidate"
    · o.text 出现且不为 null（与 parseFinishArgs 判定"text 存在"的口径逐字一致）
```

注意它**不**检查 `assetPolicy`、**不**检查 `source`：这些交给 `parseFinishArgs` 继续把关。
`isCorrectableFinishError` 只负责回答"这条已知形状像不像 T3"，**绝不用来产出结果**——
它返回 `true` 时仍然先经过 `parseFinishArgs` 的拒绝，纠偏只是"再问一次"。

### 2.3 剩余预算如何约束

- 纠偏次数：`corrected` 布尔（0 → 1，一次性），与旧协议文本纠偏**共用**。
- 剩余预算：`callNo + 1 < MAX_PREP_CALLS`。`callNo` 从 0 起，`MAX_PREP_CALLS = 3`，
  故 `callNo ∈ {0,1}` 时才有下一次请求；`callNo = 2`（最后一次请求）非法 → 立即失败。
- 满足"非法后纠正成功"必然消耗 2 次请求（非法 1 次 + 重新声明 1 次），仍在 3 次以内。

---

## 三、合同三方对照（schema / 指令 / 执行器）

用**受控夹具**把三方摆在一起比（`A/runs/01-diagnose-before/`）：

| 一方 | 对 `{outcome:"compose", text:"…", assetPolicy:"preserve"}` 的行为 |
| --- | --- |
| **schema / 校验器**（`parseFinishArgs`） | 正确判定为互斥冲突 → `{ok:false, error:'outcome=compose 与 text 互斥（要答复请用 reply）'}`。**这是对的，不能动。** |
| **指令**（`PREP_INSTRUCTION`） | 2026-10-03 已补一句「compose 与 candidate 都不接受 text 字段……带了会被整条拒绝」。**补了仍复现**（G2A/G3），说明"写在指令里"不足以救这一次调用——模型是在**同一条回复**里现编参数，指令属于背景，不是即时反馈。 |
| **执行器**（`runPrep`） | `finishOutcome → null → protocolFailure → return`。**模型永远不知道自己的调用被拒了**（连 tool 结果都没有），也没有第二次机会。 |

**分歧点**：真实工具调用范式里，"工具调用被拒"应当以 **tool 结果**回到模型手里；
而这里终结工具的校验失败是**吞掉**的（`return` 而不是回到循环）。三方的合同在"参数必须互斥"上是一致的，
不一致的是**执行器没有把拒绝播出去**。所以修的是**执行器的反馈通道**，不是 schema，也不是再加提示词。

（顺带记录：这也是为什么"再加一句提示词"不会有用——继续堆提示词正是任务卡禁止的做法。）

---

## 四、实现方案与取舍

### 4.1 方案（采纳）

在 `runPrep` 的"单终结工具但参数非法"分支加**一次**有界纠偏：

1. 先照旧 `parseFinishArgs` 校验；非法 → 再问 `isCorrectableFinishError(args)`。
2. 若属于本类 **且** `!corrected` **且** 还有剩余预算 →
   - 把模型**这次实际的调用**（assistant + `tool_calls`，arguments 原样）追加进 `convo`；
   - 追加一条 **tool 结果**，内容 = 校验器的**原错误串** + 一句"请重新调用 finish_preparation 声明结果"
     的机械指引；
   - `corrected = true`，`continue` 下一轮。
   - **一个字都不改模型的 arguments**：不删 `text`、不补 `assetPolicy`、不改写 `source`。
3. 否则（不是本类 / 已纠偏过 / 没有剩余预算）→ 维持现在的**立即协议失败**。

### 4.2 取舍

- **为什么用 tool 结果而不是 user 消息**：模型这次真的发起了工具调用；真实工具范式的反馈就是 tool 结果。
  已有的知识工具回传（assistant `tool_calls` + `tool` 消息）已经在生产里跑通，沿用同一形状不会有新的 API 风险。
- **为什么与旧协议文本纠偏共用 `corrected`**：任务卡要求"至多一次有界纠偏"。两个独立标志会变成"最多两次"，
  超出授权。共用意味着：本回合一旦用过任一形式的纠偏，后续任何形态都不再纠偏。
- **为什么不顺带把"缺 assetPolicy"也接进来**：无真实复现，且会把本轮从"这一类"扩大成"一大类"，
  使回归面不可控。留作第七节的未覆盖项。
- **是否采纳本方案**：采纳。第三节对照显示分歧点就是"反馈通道缺失"，且修法不改校验、不改 schema、
  不新增预算——满足任务卡全部禁令。

### 4.3 明确不做（任务卡禁令，逐条对照）

| 禁令 | 本实现 |
| --- | --- |
| 删除 `text` 后自动接受 `compose` | 不做。纠偏**绝不**改参数；`parseFinishArgs` 仍然拒绝，只有模型重新声明才可能有结果 |
| 从自由文本猜授权 | 不做。自由文本路径一字未改 |
| 未知 outcome 强转 | 不做。`outcome` 非字符串 / 非三值 → 仍一次性失败 |
| candidate 改写为新正文 | 不做。`source` 完全不碰 |
| 前端意图状态机（铁律 6） | 不做。判据是**错误形状**（结构），不是用户意图；不改任何用户可见回合；不做关键词路由 |
| 放松严格合同 | 不动 `parseFinishArgs`；不放宽任何断言；`MAX_PREP_CALLS` 仍为 3 |

---

## 五、逐条断言的红 → 绿证据

### 5.0 复现命令（每次运行的完整事实）

环境（playwright 只装了 core，`VERIFY_PLAYWRIGHT` 指向它；chromium 用本机已下载的那个；dev server 是本路自己的端口 1437，**没碰**别的路的端口）：

```
cd D:\deepseek-harness\wechat-mp-desktop
pnpm exec vite --port 1437 --strictPort        # 后台起，仅本地 dev server（不写 dist/）
set VERIFY_PLAYWRIGHT=C:/Users/Lenovo/AppData/Local/Temp/pw-deps/node_modules/playwright-core
set VERIFY_CHROMIUM=C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
node scripts/prep-contract-check.mjs <outDir> http://127.0.0.1:1437
```

| # | 运行 | 被测 `src/lib/prep.ts` sha256 | 退出码 | 最后一行 | 检查 | 用例 |
| --- | --- | --- | --- | --- | --- | --- |
| 00 | `A/runs/00-baseline-before`（**改前**，旧断言集） | `6d7bc7eb…` | 0 | `PREP-CONTRACT PASS` | 231/231 | 25/25 |
| 01 | `A/runs/01-diagnose-before`（**改前** + 新断言 → 红） | `6d7bc7eb…` | 1 | `PREP-CONTRACT FAIL` | 未通过 | 35/35 |
| 02 | `A/runs/02-green`（改后） | `db238631…` | 0 | `PREP-CONTRACT PASS` | 389/389 | 35/35 |
| 03 | `A/runs/03-mutant-*`（5 个变异体，见 5.3） | 复原后 `db238631…` | 1 ×5 | `PREP-CONTRACT FAIL` | — | 35/35 |
| 04 | `A/runs/04-final-green`（复原后确认） | `db238631…` | 0 | `PREP-CONTRACT PASS` | 389/389 | 35/35 |

`pnpm exec tsc --noEmit` → 退出码 **0**（无类型错误）。
新增检查 389 − 231 = **+158 条**；新增用例 35 − 25 = **+10 个**。

### 5.1 红 → 绿（行为断言）

"红"= `01-diagnose-before`（旧实现）下的实测；每一行都是**同一个用例、同一条断言**在旧实现上为 FAIL、在新实现上为 PASS。

| 任务卡要求 | 用例 | 旧实现（红）实测 | 新实现（绿）实测 |
| --- | --- | --- | --- |
| 非法后**纠正成功** | `t3-compose-text-then-declares-compose` | `prep/failed`，1 次请求，无纠偏轮 | `prep/compose`（assetPolicy=preserve），2 次请求，1 次带拒绝反馈的纠偏轮 |
| 非法后**纠正成功**（同族 candidate） | `t3-candidate-text-then-declares-candidate` | `prep/failed`，1 次请求 | `prep/candidate`，正文进交付（含「周末到馆提醒」），2 次请求 |
| 纠偏后模型改口成**普通答复** | `t3-compose-text-then-declares-reply` | `prep/failed` | `prep/reply`「报名费还没定，我先按常规写？」，**0 提交** |
| **最后一轮**非法 → **不发第 4 个请求** | `t3-last-round-illegal-no-fourth-request` | 3 次请求、`failed/protocol`（**旧实现本来就满足**，见 5.3 的 M2） | 3 次请求、`failed/protocol`，未发纠偏 |
| 纠偏后**再次非法** → 停止、不再追加 | `t3-illegal-again-after-correction-stops` | 1 次请求就失败（红：期望 2） | 2 次请求、`failed/protocol`、纠偏轮恰好 1 次 |
| 混用知识工具与终结工具仍被拒 | `t3-not-applied-to-mixed-tools`（终结参数正是本类形状） | `failed/protocol`，1 次请求 | 同左（**不受本修复影响**） |
| 多个终结仍被拒 | `two-terminal-tools`（原有） | `failed/protocol`，1 次请求 | 同左 |
| 合法 reply/compose/candidate 不受影响 | `valid-reply` / `valid-compose` / `valid-candidate`（原有）+ 全部 35 个用例的「不属于可纠偏类别时没有发终结参数纠偏」25 条 | 全绿 | 全绿 |
| **取消 / 失败不获得写作授权** | `cancel-transport-error-throws-no-outcome` + 全部 `failed` 用例（22 条）「无 source / 无 assetPolicy」 | 全绿 | 全绿 |

### 5.2 诊断证据（"拒绝被吞掉"的直接观测）

- `01-diagnose-before` 里 `t3-compose-text-then-declares-compose` 的实测是 **1 次请求 + `prep/failed`**，
  且 `finishArgsCorrectionSent=false`：模型那次调用**被拒绝后，没有任何消息回到它手里**，
  剩余 2 次预算直接作废。这正是 G2A/G3 "0 产出"在本层的机制。
- 同一运行里 `t3_composeWithText_stillRejected = true`（`parseFinishArgs` 仍拒绝）——
  说明修复**不通过**放宽校验来达成，与"合同不放宽"一致。
- 三方对照（第三节）在本运行里的落地：指令文本确实带着"compose 不接受 text"（
  `firstInvokeForbidsMixing` 等首次请求断言全绿），校验器确实拒绝，**唯独执行器不反馈**。

### 5.3 变异测试（证明守卫有承重作用）

驱动：`A/mutants/run-mutants.mjs`（对 `src/lib/prep.ts` 做一次**精确**替换，替换命中数必须恰好 1，
跑真实检查脚本，收集 FAIL 断言，最后从 `A/mutants/prep.ts.pristine` 复原并校验 sha256）。
结果：`A/mutants/mutants-result.json`；复原后 sha256 = `db238631…`（与 04 运行一致）。

| 变异体 | 变异内容 | 被哪些断言抓住（条数） |
| --- | --- | --- |
| M1 `drop-corrected-guard` | 去掉 `!corrected` → 纠偏可重复 | 4 条：`t3-illegal-again-…` 拿到 `prep/compose`、3 次请求、纠偏 **2** 次 |
| M2 `drop-budget-guard` | 去掉 `callNo + 1 < MAX_PREP_CALLS` → 最后一轮也纠偏 | 2 条：最后一轮用例的失败分类从 `protocol` 变成 `exhausted`、且**发了**纠偏轮 |
| M3 `over-broad-classifier` | 分类器改成"任何 compose/candidate 错误都可纠偏" | **15 条**：`strict-missing-assetPolicy` / `strict-bad-assetPolicy` / `strict-candidate-source-non-string` / `strict-candidate-source-blank` 全部从 1 次请求变 2 次请求；`t3-not-applied-to-missing-assetPolicy` 甚至被自动接受成 `compose` |
| M4 `ignore-text-and-accept`（**任务卡禁止的行为**） | 删除 compose 的互斥拒绝 → 直接接受带 `text` 的 compose | **20 条**：三条 T3 纠正用例全部变成 1 次请求、无纠偏；`t3_composeWithText_stillRejected` 变红 |
| M5 `rewrite-echoed-args` | 回填时改写 arguments（抹掉 text） | 3 条：「非法调用被原样回填」断言在三个用例上全部变红 |

**M2 的诚实修正**：即使去掉预算守卫，**也不会**真的发出第 4 次请求——`for (callNo < MAX_PREP_CALLS)`
的循环上界仍然兜住。所以"最后一轮非法不得发第 4 个请求"这条断言是**双保险**：
主承重是循环上界（旧实现就满足），本修复额外补的是"最后一轮不把预算浪费在一次无法被回答的纠偏上"。
这一点不能写成"本修复让它不再发第 4 个请求"。

---

## 六、改动文件清单

| 文件 | 改动 |
| --- | --- |
| `src/lib/prep.ts` | +86 行：新增 `PREP_FINISH_REJECT_MARKER`、`finishArgsCorrection()`、`isCorrectableFinishError()`；`runPrep` 的单终结分支加一次有界纠偏（`!corrected && callNo + 1 < MAX_PREP_CALLS && isCorrectableFinishError(args)`）。**`parseFinishArgs` 一行未动**，`MAX_PREP_CALLS` 仍为 3 |
| `scripts/prep-contract-check.mjs` | +269 行：新增 10 个用例（T3 纠正 3 个 + 窄面 4 个 + 取消 1 个 + 最后一轮 1 个 + 再次非法 1 个）、受控夹具、纠偏轮/原样回填/失败无授权的断言、`pure2` 分类器边界断言。**原有断言一条未删、未放宽** |
| `A/`（本目录） | `report.md`、`runs/*`（5 次运行证据，含 `run-result.json` / `result.md` / `raw.json`）、`mutants/run-mutants.mjs` + `prep.ts.pristine` + `mutants-result.json` |

**未改**（本轮明确不碰）：`parseFinishArgs` 的校验规则、`src-tauri/**`（**无需 Rust schema 改动**，
下方第七节说明）、`App.tsx`、`REQUIREMENTS.md`、`PROGRESS*.md`、`STRUCTURE.md`、`dist/`、`src-tauri/target/`。

---

## 七、未覆盖条件与残留风险

1. **真实响应未回放（证据纪律）**：本路所有非法参数都是**受控夹具**。原日志（`%TEMP%\wxmp-f1-real-g2a` /
   `-g3`）在 Rust 侧只存工具名、不存参数，**看不到**模型当时塞进 `text` 的原话——不得声称已回放真实原文。
2. **真实模型补测未做**：G2A/G3 的真实小样复测由父协调者串行执行。本路只证明"离线合同允许一次纠偏、
   且不放松校验"；**它不能证明真实模型在被纠偏后一定会改对**（这是概率问题，不是合同问题）。
3. **未覆盖：`assetPolicy` 缺失 / 非法**。指南 §5.3 的措辞（"缺失或非法值走有界纠偏/失败"）留有余地，
   但本轮无真实复现，**没有**把它接进纠偏——扩面会让回归不可控。若父协调者决定扩面，
   加的是同一张 `isCorrectableFinishError` 的判据 + 同一条 `!corrected / 剩余预算` 守卫。
4. **未覆盖：`reply` + `source` 互斥**。现象不同（"既想答复又想交稿"），且 `strict-exclusive-fields`
   是已冻结的判据（1 次请求即失败），改它等于动别人的合同。
5. **只纠偏 `text` 这一个越界字段**。若真实模型出现"compose 带 source"之外的其它越界字段组合，
   本修复不会覆盖（仍一次性失败）——宁可漏一次纠偏，不去猜。
6. **Rust schema 无需改动**：`prep_turn` 只负责把模型的工具调用照原样回传（契约里 `calls[].args` 是字符串，
   校验全在 TS 侧）。本次修复只增加"再多问一轮"，请求/响应形状没变，故**不提交 Rust 补丁建议**。
   （若日后要 Rust 侧提前校验参数，那是另一个改动，本次无证据支持。）
7. **提示词未再改**：没有往 `PREP_INSTRUCTION` 里再加任何一句。加提示词这条路上一次（2026-10-03）
   已证明两个真实样本都复现；本轮修的是**反馈通道**，不是措辞。
8. **纠偏轮的 tool 结果依赖 `terminal[0].id`**：与既有知识工具回传用的是同一来源（`prep_turn` 返回的 call id）。
   若某天出现 id 为空的调用，assistant/tool 消息配对会失效——这一点与知识工具路径**同风险**，非本修复引入。
9. **端口/并发**：本路 dev server 固定 1437，与其它路不共享；未跑 `pnpm build` / `pnpm tauri build`，
   未写 `dist/`、未动 `src-tauri/target/`，未启动桌面应用、未调真实模型、未写累计账本。
