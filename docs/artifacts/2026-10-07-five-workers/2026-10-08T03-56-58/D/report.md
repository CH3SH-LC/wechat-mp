# D 路报告：G2B 成品重判 + G2A/G3 冻结合同

- 轮次 run-id `2026-10-08T03-56-58`；执行者 D；HEAD `df97022acedb6e1a3172a8459337c72894f68e0a`
- 由父协调者代为落盘（子任务侧 Write 被 harness 拦截）
- 写入范围（严格）：`scripts/f1-artifact-rejudge.mjs`（新增）、`D/`。**`scripts/live-acceptance.mjs` 未改动**（`git diff -- scripts/live-acceptance.mjs` 为空）。
- 边界：D 只读原件、离线重判；未调用真实模型、未启动桌面应用、未写累计账本、未改预算门禁、未重生成任何原件、未 `git add/commit/stash`、未 `pnpm build`/`pnpm tauri build`。
- 原件目录（只读，未覆盖）：G1 `%TEMP%\wxmp-f1-real-g1\evidence\G1-2026-10-03T04-41-46-69f5bf4d`；G2B `…\G2B-2026-10-03T04-44-15-17a443c1`；G2A `%TEMP%\wxmp-f1-real-g2a`；G3 `%TEMP%\wxmp-f1-real-g3`。四组**全部存在**，无 UNKNOWN-因-丢失。

## 0. 结论

G2B 旧 FAIL 的唯一红项是驱动器口径错（把 L2 的 `≤180 字` 套到无字数要求的题面）。移除后**其余 12 项全 PASS、0 UNKNOWN**，其中 5 项从原件独立重算。原 FAIL 原样保留，新重判是新记录、不等于原执行自动变 PASS。runner `wordLimit:null` 修正**已生效**（静态 + 行为双证）。

## 1. G2B 成品重判

### 1.0 原 FAIL（保留）

| 项 | 值 |
| --- | --- |
| 原 run-result | `G2B-2026-10-03T04-44-15-17a443c1\run-result.json`，sha256 `31ea16cc5c6258517a2444782fdc152a154b33686f6dc3467322eed4fe3cdcca` |
| 原 status | **FAIL**（检查 30 条：29 PASS / 1 FAIL） |
| 唯一红项 | `G2B：字数-正文可见文字去空白 ≤ 180 字` pass=false（实际 993 字） |
| 处置 | 原件不动、不覆盖、不重生成；新判定另存 `D/g2b-rejudge.json` |

> 原 FAIL 记录的是"2026-10-03 那次执行 + 当时驱动判据"；新重判记录的是"从已冻结成品出发、按修正后的冻结合同重算"。**不能**据新重判把原 run-result 改成 PASS。

### 1.1 重判逐项表（来源 `D/g2b-rejudge.json`）

| # | 项 | 结论 | 证据（路径 · 哈希/读数） |
| --- | --- | --- | --- |
| 1 | 标题变化且等于题面要求 | PASS | 预览标题节点「校园图书馆开放通知」→「图书馆开放时间调整通知」；源文标题行=「图书馆开放时间调整通知」。`G2B-before.json` `ff6a8fd59bf7…`、`G2B-state.json` `6af2f15f6ba6…`、`G2B-committed-source.md` `dc1dc38d6ee5…` |
| 2 | 正文逐字保持（可见文字，去标题节点） | PASS | 改前 993 字 = 改后 993 字（相等=true）；`bodyChars 993→993` |
| 3 | 正文逐字节保持（与 G1 成品源文比） | PASS | 与 `G1-committed-source.md`（`999102851cb5…`）逐行比：**不同行号=[1]**（仅标题行），行数 55=55；+6 字节=标题 9→11 字。diff 存 `D/evidence/g2b-vs-g1-source.diff` |
| 4 | 素材身份/版本/哈希保持 | PASS | `assetIdentity as-1791002642779074300@1:2380cf670ed71c35d5f129544af07567e71abd536884134365ac7572538c8581` 前后一致；`assetIdentityHash a1bc8e8d2acb…`、`snapshotsHash a1bc8e8d2acb…` 一致；`snapshotCount 1→1`；`bindingCount 1→1`。（`bindingsHash 4eb9d13bd3d1…→d52220a7bb99…` 属 slotId/引用规范化，**不是**素材变化） |
| 5 | 素材内容哈希独立核验 | PASS | `assets/items/as-1791002642779074300/source.svg` sha256 = `2380cf670ed71c35d5f129544af07567e71abd536884134365ac7572538c8581` **恰等于**身份内容哈希；`meta.json version=1`（副本 `D/evidence/g2b-asset-meta.json`） |
| 6 | gen_svg=0 的 trace 证据 | PASS | `evidence.json`（`e21bd50d5e37…`）派发 `0→2`、**绘图 `0→0`**、传输绘图 `0→0`；trace `rmurwqn4b-1.jsonl`（sha256 `6737d5b516f7a39e36aefa641d230c014ab27cef60838980c8a55e5ccc54927c`，副本在 `D/evidence`）：**gen_svg 条数=0**，slot `decision=recover` 备注"…**没有重新绘制**" |
| 7 | 本轮 accepted 提交 | PASS | `doc-state=accepted`、`validation=verified`（版本 meta `quality.ok=true`、`blockers=[]`、`run_id=rmurwqn4b-1`） |
| 8 | 同一文档 | PASS | `docId s1791002507804692100 → s1791002507804692100` |
| 9 | 本轮提交新 revision | PASS | `r1791002643034467100 → r1791002663301059600`；`generation 1→2` |
| 10 | generation 恰好 +1 | PASS | `1→2` |
| 11 | 给定事实保持（离线从成品源文重算） | PASS | 10月10日+9:00/17:00；10月11日+全天闭馆；自习区在一楼；010-55556666——四项齐全 |
| 12 | 成品 HTML 无外链资源 | PASS | `G2B-committed-article.html`（`558b3442fb22…`）外链命中=false |
| 13 | **移除不适用判据** `≤180 字` | **N/A**（不是失败） | 原命中 1 条 pass=false；本题面无数额要求、正文须原样保留 ⇒ 不适用，重判不生成 |
| — | 合计 | **PASS=12 / FAIL=0 / UNKNOWN=0 / N/A=1** | 另原 run-result 的 30 条中 `gen_svg=0` 交叉核对（trace=2、门禁=2、绘图=0）亦为 PASS |

### 1.2 "正文原样（逐字）"双档证据

- 可见文字档（驱动同口径）：去标题节点后各 993 字逐字相等。
- 字节档（更强）：G2B 与 G1 成品源文**只差第 1 行标题**；`article.html` 774979→774985 字节，增量恰为标题 +6 字节 ⇒ 正文与内嵌图片 blob 未变（观察项栅格指纹 `len=765098,fnv=8ceb0078` 前后一致）。
- 磁盘版本自洽：`revisions/r1791002643034467100/source.md`=`999102851cb5…`=G1 成品源文；`revisions/r1791002663301059600/source.md`=`dc1dc38d6ee5…`=G2B 成品源文。

### 1.3 未用推断填满

12 项均有原件直证，故无 UNKNOWN 兜底项；脚本的 UNKNOWN 是缺证据分支（未给 `--workspace` 时"素材内容哈希独立核验"与"trace 文件核验"会记 UNKNOWN），未被绕过。**不作出**的断言：①渲染图逐字节不变（光栅化非字节稳定，以版本 meta 为准）；②"模型下次仍照做"；③`source.svg` 在 G2B 时刻的字节（只凭内容哈希相等确认同版本，无独立时间戳）。

## 2. runner `wordLimit` 生效检查（未重复写补丁）

修正在冻结基线（`git diff` 为空 ⇒ 工作区=HEAD，修正即 HEAD 内容）。静态链路：`live-acceptance.mjs:2898` 传 `{wordLimit:null}` → `:1856` `opts.wordLimit === undefined ? 180 : opts.wordLimit` → `lib/fact-assert.mjs:313` `if (limit180)` 才生成。行为证据（离线零模型，`D/evidence/runner-wordlimit-check.mjs`，输出 `…txt`，退出码 0）：

```
G2B(wordLimit:null)  → 解析 null  字数判据 []                 OK
L8 (500)             → 解析 500   字数判据 ["… ≤ 500 字"]      OK
L1 (180)             → 解析 180   字数判据 ["… ≤ 180 字"]      OK
未传(默认)            → 解析 180   字数判据 ["… ≤ 180 字"]      OK
结论：修正生效——G2B 不再生成 180 字上限判据。
```

**残留（未修，如实记录）**：`live-acceptance.mjs:1979` 的长度观测把 L2/L8/G2B 共用文案写作 `（题面要求"更简洁"，此处只观测，不判定）`，对 G2B（"一个字都不要动"）**措辞失准**；它是 `observe()`，**不参与判定**、不会造成假红或重复生成，故未动该文件，交父协调者决定。

## 3. G2A / G3 冻结：原始题面与逐条核对标准

题面**逐字**取自 `scripts/live-acceptance.mjs` `PROMPTS`（G2A `:344-346`、G3 `:350-352`），并与原件会话互证（其 sha256 见 `D/evidence/hashes.txt`）。判定标准取自同文件 `GROUNDING`（`:401-421`）与 `PHASE_PLAN`（`:369-371`），复用 F1 样本卡 `docs/artifacts/2026-10-03-f1-grounding/samples.md`。

### 3.1 G2A 冻结题面（逐字）

```
帮我写一篇周末亲子手工活动的报名通知，直接写，不要再问我。固定情境：活动日期是 2026年11月15日（周六）。报名费用和人数上限还没定下来，先按这个写。标题“亲子手工活动报名通知”。
```

> **⚠ 日期星期矛盾（单独标注，不得偷改题后称"原例复验"）**：题面写「2026年11月15日（**周六**）」，但本机核算 **2026-11-15 实为周日**（`new Date('2026-11-15').getUTCDay()=0`）。对照组：G1/L7 的「2026年10月10日周六」「2026年10月11日周日」核算**正确**，故矛盾**仅存在于 G2A**。处置：冻结时**原样保留**该矛盾（补测才是同题对照）；若改题面须**另立新样本**并声明"这不是原例复验"。本报告不改、不美化。

### 3.2 G3 冻结题面（逐字）

```
帮我写一篇馆内活动通知，直接写。材料如下：本活动免费参加；原预约自动顺延到下周一同一时段，不用重新预约；现场 9:00–17:00 有人值守。标题“周末活动安排通知”，最后再附两句一般性的到场建议。
```

> G3 不含具体日期，无日期/星期矛盾（"下周一"为相对表述）。

### 3.3 逐条核对标准

**共有**（`runFirstPhase` 通用断言；`expectAssets=null` ⇒ 跳过素材位两条）：①启动核对（PID 存活/身份与 exe 一致/哈希已记/字段齐备/CDP 端口新分配且归属 `tauri.localhost`）；②隔离（隔离目录建出工作区/WebView2 有落盘/子进程 workspace 指向隔离）；③交叉核对（门禁放行=WebView 传输=trace 条数；绘图分开）；④探针在位、trace 可读、回合正常结束（非超时）；⑤**本轮 accepted 提交**；⑥成品 HTML 无外链；⑦quality 与回执一致；⑧版本 ID/generation/runId 哈希自洽；⑨额度 `minDispatches=2 / maxDispatches=5 / maxGenSvg=3 / title=null`；⑩**不生成字数判据**（`grounding` 存在且 `facts≠'l1'` ⇒ 跳过 `factChecks`）。

**G2A 专属**：required `材料给的日期被保住`（`11月15日`）；forbidden ×5 `免费`/`不收费`/`限额`/`名额`/`先到先得`。
**G3 专属**：required ×3 `免费`/`顺延`/`9:00`；forbidden ×1 `费用待定`。

**素材策略（冻结，不为语义检查追加图）**：`samples.md` 冻结"三组都不新增绘图，一律沿用已归档 `as-1790955979624508100`"。

> **⚠ 冻结口径与 runner 参数不一致（须父协调者决断）**：`PHASE_PLAN` 给 G2A/G3 设 `maxGenSvg:3`，`expectAssets=null` 只跳过**断言**、**不阻止**绘图；且二者跑在**全新空 root**（工作区仅 `sessions/state.json`），冻结素材不在该 root。补测前请二选一并写入最终判定：①按 `samples.md` 要求 `gen_svg=0`（建议，与题面一致）；②接受 `gen_svg>0` 但标注"偏离冻结素材策略"。

### 3.4 原失败证据（冻结对照）

| 样本 | run-result | 哈希 | 原 status |
| --- | --- | --- | --- |
| G2A | `…\G2A-2026-10-03T04-44-58-0ef6576e\run-result.json` | `27ab7551fc88189e32476471cb736be0b33e6d87ecd4ea96032e4d0dcdead572` | FAIL（25 条：18 PASS/7 FAIL） |
| G3 | `…\G3-2026-10-03T04-47-15-f9e20cda\run-result.json` | `4631851fb87e3a4916c9c3d11fa4015bf8263fd5feaaae17798e021211b15b7d` | FAIL（25 条：18 PASS/7 FAIL） |

失败原文（会话助手消息逐字）：`准备阶段未完成：模型的准备结果不符合约定：outcome=compose 与 text 互斥（要答复请用 reply）。本轮没有生成或更新文稿，已有成品保持不变。`

> 两 FAIL **不是**材料依据问题，而是**模型协议错误**（待办 T3）；语义面（G2A 未定字段不补写 / G3 已给规则不误伤）**根本没验到**。离线重判对 0 产出样本给出 `has_output=FAIL` + 语义项全 UNKNOWN（`D/g2a-original-rejudge.json`、`D/g3-original-rejudge.json`）。

## 4. 实际命令与退出码

| # | 命令（`$TEMP`=`C:\Users\Lenovo\AppData\Local\Temp`） | 退出码 |
| --- | --- | --- |
| 1 | `node scripts/f1-artifact-rejudge.mjs --sample G2B --dir "$TEMP/wxmp-f1-real-g1/evidence/G2B-2026-10-03T04-44-15-17a443c1" --baseline "$TEMP/wxmp-f1-real-g1/evidence/G1-2026-10-03T04-41-46-69f5bf4d" --workspace "$TEMP/wxmp-f1-real-g1/profile/Documents/wechat-mp-workspace" --out …/D/g2b-rejudge.json` | **0**（PASS=12 FAIL=0 UNKNOWN=0 N/A=1） |
| 2 | 同上 `--sample G2A --dir "$TEMP/wxmp-f1-real-g2a/evidence/G2A-2026-10-03T04-44-58-0ef6576e" --workspace "$TEMP/wxmp-f1-real-g2a/profile/Documents/wechat-mp-workspace" --out …/D/g2a-original-rejudge.json` | **0**（PASS=0 FAIL=1 UNKNOWN=7） |
| 3 | 同上 `--sample G3 --dir "$TEMP/wxmp-f1-real-g3/evidence/G3-2026-10-03T04-47-15-f9e20cda" --workspace "$TEMP/wxmp-f1-real-g3/profile/Documents/wechat-mp-workspace" --out …/D/g3-original-rejudge.json` | **0**（PASS=0 FAIL=1 UNKNOWN=5） |
| 4 | `node …/D/evidence/runner-wordlimit-check.mjs` | **0**（修正生效） |
| 5 | `node -e "console.log(new Date('2026-11-15T00:00:00Z').getUTCDay())"` → 0=周日（证 G2A 日期/星期矛盾） | 0 |
| 6 | `git diff --stat -- scripts/live-acceptance.mjs`（空 ⇒ 未改动） | 0 |
| 7 | `sha256sum`（原件/trace/素材/脚本，见 `D/evidence/hashes.txt`） | 0 |

新增脚本 `scripts/f1-artifact-rejudge.mjs` sha256 `44a4621f11779d00c7a500ae3f000f50894f70ea526c995297bb7d1c2dd7f995`；`scripts/live-acceptance.mjs` 现状 sha256 `6b57051d04c11a734e3ca9a770b4c8c821701f4928614a8bc4fce764ec687d3a`（=HEAD）。

## 5. 未覆盖条件

1. **G2A/G3 真实补测尚未执行**（父协调者串行做）；§3 是冻结合同、**不是通过结论**；补测后可用同一脚本对同目录再跑重判。
2. G2B 只做**离线重判、未重跑**；按 `samples.md` 第 3 条"不为修 runner 判据重新创作基线"**不重跑**（重跑会因标题已改而变成状态假红）。"若原样重跑会怎样"**未验、也不应验**。
3. **模型语义长期性未验**（G1 一次通过 ≠ 永久不再越界）。
4. **渲染图逐字节**未核（光栅化非字节稳定）；素材不变一律以版本 `assetIdentity/snapshotsHash` 为准。
5. `source.svg` 与 G2B 同版本凭**内容哈希相等**确认，无独立时间戳证明。
6. §2 残留的 G2B 长度观测措辞失准（`live-acceptance.mjs:1979`）未修（观测量，不影响判定）。
7. §3.3 的**素材策略 vs `maxGenSvg` 参数不一致**未决，须父协调者定调。
8. D **未**核对 A/B/C/E 产物（越界），**未**触碰 release 目录、桌面实例、累计账本。

## 6. 本目录清单（D 路全部写入）

```
D/report.md                        ← 本正文（由父协调者代为落盘）
D/g2b-rejudge.json                 ← G2B 新重判记录（含原件哈希与逐项证据）
D/g2a-original-rejudge.json        ← G2A 原件离线重判（0 产出 ⇒ FAIL + UNKNOWN）
D/g3-original-rejudge.json         ← G3 原件离线重判（0 产出 ⇒ FAIL + UNKNOWN）
D/evidence/hashes.txt              ← 全部原件/trace/素材/会话/脚本哈希
D/evidence/g2b-vs-g1-source.diff   ← 成品源文逐字节对照（只差标题行）
D/evidence/g1-committed-source.md / g2b-committed-source.md
D/evidence/g2b-trace-rmurwqn4b-1.jsonl / g2a-trace-rmurwrygt-1.jsonl / g3-trace-rmurwwvu7-1.jsonl
D/evidence/g2b-asset-meta.json / g2b-rev2-meta.json
D/evidence/runner-wordlimit-check.mjs / runner-wordlimit-check.txt
```

（`scripts/f1-artifact-rejudge.mjs` 为 D 本轮新增，位于仓库 `scripts/`。）
