# E 路阶段二报告：候选签收（2026-10-08）

对象：父协调者冻结的候选（`coord/freeze.md`）。**E 独立复核，实施者自报不替代签收。**

## 〇、哈希核对（逐个）

| 文件 | 冻结值 | E 实测 | 一致 |
| --- | --- | --- | --- |
| `src/lib/prep.ts` | `db238631…be4f` | `db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f` | 是 |
| `scripts/prep-contract-check.mjs` | `662862ce…a465` | `662862cecc816852e745243adfb7a90b1095cb943f6f7d3205920e0f40a2a465` | 是 |
| `src/lib/htmlToImage.ts` | `573788d8…3b64` | `573788d84cbf1ba0a66561298314181de1b1ce65fbf059480280e5601b723b64` | 是 |
| `scripts/export-paging-check.mjs` | `849aa98c…c3c5` | `849aa98c0193b6c1134510b1ea380980b7c2a996b49e43eeef3dbb4b77f7c3c5` | 是 |
| `fixtures/2026-10-07-safe-paging/short.md` | `7e80745d…f9c0` | `7e80745d2d8db53c51c097cd988a4c3ad0ada0b92f4c28833a6bebb90e07f9c0` | 是 |
| `fixtures/2026-10-07-safe-paging/text.md` | `f5028e42…4523` | `f5028e42897e9394d9c4cfff321a5b468c92e5288c1f862099f1c61af8d54523` | 是 |
| `fixtures/2026-10-07-safe-paging/art.md` | `9f7a59b7…4fd7` | `9f7a59b7fefcb88fa138da847d7d1d0534e52e417cf9b07b12827c3cdce04fd7` | 是 |
| `src-tauri/resources/使用手册.html` | `ce0f8498…ac1d` | `ce0f8498eff482481a0961458daf4c640ee414345350838b3cfc10f12130ac1d` | 是 |
| `scripts/f1-artifact-rejudge.mjs` | `44a4621f…f995` | `44a4621f11779d00c7a500ae3f000f50894f70ea526c995297bb7d1c2dd7f995` | 是 |
| `scripts/live-acceptance.mjs` | `2adb9e0e…75f4` | `2adb9e0ee15f9cfd6460974bc7470e58e5329ff35864b47ef8d59ac1cef475f4` | 是 |

`src-tauri/src/**`：`git status --short src-tauri/src/` 为空，**零改动**。核对通过后 E 把候选整体快照到 `E/candidate/`，
所有复核只对该快照执行（不与后续写入竞争）。

---

## 一、A 协议修复 —— **ACCEPT**

脚本：`E/phase2-a-check.mjs`（真实生产模块 `runPrep` + 受控 `invoke`）。命令与结果：

```
$ E_ROOT=candidate node phase2-a-check.mjs   →  检查 28 条，未过 0 条
$ E_ROOT=baseline  node phase2-a-check.mjs   →  检查 22 条，未过 4 条（红绿对照）
```

| 父协调者点名项 | E 独立结论 |
| --- | --- |
| **总请求计数不得出现第 4 次** | 15 个场景实测请求数 `[1,2,2,3,3,2,1,1,1,1,1,1,1,1,2]`，全局 `max=3`，**无任何 overrun**（脚本在剧本耗尽时会记录 overrun，实测 0） |
| **非法参数后的纠偏失败路径** | 纠偏只播回"被拒绝"的事实（tool 结果，含校验器原错误串），不改写模型 arguments；第二次非法即失败 |
| **被拒时不写坏旧稿** | `prep` 返回 `kind:'failed'`；`App.tsx:903-922` 的 failed 分支只 `persistNow` 聊天消息，不触碰文稿/预览（App 本轮未改） |
| **失败/取消不获得写作授权** | 所有失败场景 `kind=failed`，无 compose/candidate |
| **`candidate`+`text` 是否算"已知协议错误"、是否过宽** | 见下 |

**过宽争点的判断：不算过宽，但有一处文档与实现的措辞差。**

- `candidate`+`text` 与 `compose`+`text` 是**同一结构类**：合法的 `outcome` 值携带只属于 `reply` 的 `text`，被 `parseFinishArgs` 以同族互斥规则拒绝。任务卡原文"只针对**该类**已知协议错误"是按类说，不是按单个字面例；且纠偏**不放松任何校验**（参数照旧被拒、由模型自行重新声明）。
- **决定性对照**：基线 4 条红（无纠偏，`req=1/1/2`），候选 28 条全绿——说明纠偏确实接上了，而不是把判据改松。
- 反例检验（我尝试构造"过宽有害"的反例）：**构造不出**。纠偏不产生结果、不删字段、不猜 outcome，且 `candidate` 仍须通过 `v2SourceFromToolArg`（非空且围栏成对）。最坏后果只是"多花一次请求"。
- **措辞差（advisory，不判 REWORK）**：`isCorrectableFinishError({outcome:'compose',text:'a'})` 返回 **true**，而该参数因**缺 assetPolicy** 也会被拒——A 自己的注释把"缺/非法 assetPolicy"列为"故意不覆盖"。即：**复合错误**（同时含已知类与其它类）会走纠偏。影响仅是多一次有界请求，校验未放松。建议把注释改成"含已知类即纠偏"。

---

## 二、B 安全分页 —— **ACCEPT**

脚本：`E/repro-b-paging-cut.mjs`（真实 `renderArticleImages`；行盒/图形盒用 `Range.getClientRects` 在 375px 版式上独立测量）。

```
$ E_ROOT=candidate node repro-b-paging-cut.mjs                          # 连续正文 + 插画夹具
cssH=3114 pages=4 pageHeights=[1481,1608,1963,1176] cutsPx=[0,1481,3089,5052,6228]
边界 y=740.5 / 1544.5 / 2526：被切文字行 0，被切图形盒 0
Q3 拼回逐像素一致：比较 6228 行，不一致 0        B4a 页高之和=长图高=6228   B3a/B3b 严格递增且覆盖

$ E_ROOT=candidate E_FIXTURE=paging-oversize.html node repro-b-paging-cut.mjs
cssH=1942 pages=3 pageHeights=[774,2607,503] cutsPx=[0,774,3381,3884]
oversize=[{startPx:774,endPx:3381,hPx:2607,targetPx:2000,reason:"oversize-unbreakable"}]
被切文字行 0，被切图形盒 0，拼回不一致 0

$ E_ROOT=baseline  E_FIXTURE=paging-oversize.html node repro-b-paging-cut.mjs   # 红对照
页边界 y=1000 落在 1300 CSS px 高的插画盒 [387.94,1689.94] 内部 → 基线**确实把超高块切了**
```

| 判据 | 结论 |
| --- | --- |
| R1 边界不落文字行盒 | 两个夹具、5 条边界，**0 命中** |
| R2 边界不落插画/图形盒 | **0 命中**；同一夹具基线 **1 命中**（红对照成立） |
| R3 切点严格递增且覆盖 [0,canvasPx] | `[0,774,3381,3884]`、`[0,1481,3089,5052,6228]` 均满足 |
| R4 拼回逐像素一致 | 6228 行、3884 行，**不一致 0** |
| R5 750px 宽 | 长图与页图均 **750** 宽 |
| R6 页高不必等高 | 候选页高 `[1481,1608,1963,1176]`；基线 `[2000,2000,2000,228]`（等高=缺陷特征） |
| R7 超高块策略明确 | 1300 CSS px 块整体落在 2607 设备像素的**超高页**里，并显式记录 `oversize-unbreakable`（父协调者点名的"记录高度风险"满足） |

**`MAX_CANVAS_PX = 65535` 断言独立确证（不是臆测）** —— 脚本 `E/phase2-b-probes.mjs`：

```
宽 750 逐高 toDataURL： 2000→49594B  16384→404714B  32767→809214B  32768→809238B
                       65535→1618254B   65536→"data:,"（静默空、**不抛异常**）   70000→"data:,"
```

`chromium 151.0.7922.34`（`chrome.exe` 与 `chrome-headless-shell.exe` 两种可执行文件结果一致）；
且在 `--disable-gpu, --disable-software-rasterizer` 下同样。**B 的错误分支有真实依据，不是伪代码。**

---

## 三、C 交付说明 —— **ACCEPT**

脚本：`E/phase2-c-check.mjs`（只读对账源码，不执行安装/后台）：**检查 10 条，未过 0 条**，手册 sha256 = 冻结值。

| 点名项 | 源码事实 | 手册 | 结论 |
| --- | --- | --- | --- |
| `writeText` 为纯文本 | `PreviewPane.tsx:243,262` `navigator.clipboard.writeText(html)` | 明说"**纯文本**…不是带排版的富文本…不会保留版式" | 一致 |
| `exports/img-<名>` | `export.rs:136` `dir.join(format!("img-{}", sanitize_name(base)))` | `exports/img-<名>`（正文与数据表两处） | 一致 |
| `LOCKED_MODEL` | `chat.rs:414` `Some("deepseek-flash")` | "模型名当前被**临时锁定为 deepseek-flash**（输入框置灰、不可改）" | 一致 |
| 包名 | `productName=智序` + `0.1.0` → `智序_0.1.0_x64-setup.exe`（磁盘存在） | 同名；已不再出现 `wechat-mp-desktop-…` | 一致 |
| 未实测断言 | — | `2-3 分钟` / `任何公众号都能用` / `密钥不会上传到任何地方` **三处均已移除**；密钥去向改为如实说明"随请求发往配置的接口（请求头 Authorization），源码 5 处发送" | 一致 |

**未验条件的标注**：手册本身**未**声称安装/后台已实测（`S6` 通过），这是正确的；**但"安装 = NOT RUN / 后台 = NOT RUN"这句话的落点在交付报告（`coord/final.md`）**，不在手册。
E 未读到该报告的最终版本，故这项**不由手册承担**；若最终报告缺失该标注，应记为交付面缺口。

---

## 四、D 原件重判 —— **ACCEPT**

```
$ node scripts/f1-artifact-rejudge.mjs --sample G2B --dir <G2B原件> --baseline <G1原件> --out E/out/d-g2b-rejudge.json
  → exit 0；PASS=11 FAIL=0 UNKNOWN=2 N/A=1
```

| 判据 | 结论 |
| --- | --- |
| 原件身份 | 跑前/跑后逐文件 sha256 **完全一致**（`run-result.json` = `31ea16cc…3cdcca` 等 4 个文件） |
| 旧 FAIL 保留 | 记录内含 `originalVerdict:{preserved:true, status:"FAIL", sha256:"31ea16cc…"}`，并把不适用的那条列入 `inapplicableChecks` |
| 新/旧不混同 | 不适用的字数项记为 **`N/A (word_limit_removed)`**，**不是** PASS；顶层 `note` 明写"不等于原执行自动变 PASS" |
| 读数可独立复算 | E 自己按公开口径重算正文可见文字 = **993 字**，与归档记录逐字一致（阶段一 `repro-d-g2b-wordlimit.mjs`） |
| 证据不足留 UNKNOWN | 2 项（素材文件内容哈希、trace 文件）因未给 `--workspace` 记 **UNKNOWN**，未用推断填满 |

---

## 五、父协调者新写入的 L6 分页断言 —— **可证伪，但有两处盲点（advisory）**

脚本：`E/phase2-l6-assert-falsifiability.mjs`（把冻结表达式逐字复刻成求值函数，用**真实导出**的页高/长图高做种子再变异）：

```
基线（真实导出 4 页 sum=6228 = 长图 6228）                         → PASS（不是恒真）
末页缺失（sum=5052）        → 变红      中间页缺失（sum=4620）      → 变红
多出一页（sum=7404）        → 变红      某页高度为 0               → 变红
某页高度 NaN（sum=NaN）     → 变红
【盲点】补偿性改动 +100/-100（和不变）  → **仍然 PASS**
【盲点】页面顺序颠倒（和不变）          → **仍然 PASS**
```

**结论：该断言可证伪**（缺页/多页/零高/NaN 四类必红），因此不是恒真断言；但它只断言"高度之和"，
抓不住**顺序错乱**与**补偿性改动**。更强的替代式（E 已实现并验证）：

> 逐页与长图**对应带逐像素相等**，并先断言 `切点数 === 页数 + 1`、`首切点 = 0`、`末切点 = 长图高`、切点严格递增。

```
强式：真实导出逐页与长图对应带一致 → 通过
强式：顺序颠倒 → 必红（冻结断言抓不住的那种）
强式：缺页     → 必红
```

建议：在 L6 现有断言后**增加**这条（保留高度和不变式作为快速失败），不必删除现有式。**不判 REWORK**——
现断言已满足父协调者声明的意图（不再把某一种切法当合同），且它确实可证伪。

---

## 六、`live-conformance` 唯一红项是否"先于本轮存在" —— **父协调者判断成立**

脚本：`E/phase2-conformance-check.mjs`：

```
① compose.ts 的依赖闭包未被本轮改动触碰
   imports = palettes.ts, palettes.ts, svg-quality.ts；本轮改动源码 = [scripts/…, src/lib/htmlToImage.ts, src/lib/prep.ts]
①b runner 只读的三份输入与 HEAD 逐字节相同（git diff --stat 为空）
② composeMarkdown 同一输入两次结果相同（确定性）
③ 基线 / 候选 同一输入产出**相同 warnings**
```

**结论：该红项不能归因于本轮改动。** 两点补充说明：
- 该 check 的输入是**该次运行的真实模型输出**（未被保存），所以严格说是"**不可归因于本轮**"，
  而不是"每次必红"；E 无法逐字回放那次输入（如实记录）。
- 因此"本轮回归全绿"不能写；应写成"除一条开工前既有的 `live-conformance` 红项外，其余全绿"。

---

## 七、`<img>` 光栅化争点 —— **双方的全称说法都不成立；必须收窄措辞**

**E 实际用的可执行文件与启动参数**（此前未写明，现补全）：

```
executablePath = C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
playwright-core 1.63（%TEMP%/pw-deps）；Chromium 151.0.7922.34；headless: true；无额外 args
（对照还跑了 chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe，结果相同）
（对照还跑了 --disable-gpu / --disable-software-rasterizer，结果相同）
```

**决定性实验**（`E/phase2-b-session.mjs`，6 次**独立浏览器启动** × 每项 2 次）：

```
launch#1..#6（逐次相同）: no-style=0/2   style-width100-only=0/2   prod-style-full=2/2
合计：no-style 0/12、style-width100-only 0/12、prod-style-full 12/12；每次启动都稳定
```

**真实生产样式**（`E/phase2-b-styles.mjs`，取 `compose.ts` 实际发出的 7 种 img 样式）：**7/7 全部 3/3 通过**。
**真实两步链路**（`E/phase2-b-decisive.mjs`：`composeMarkdown('::: art' 内联 SVG)` → `artRender.renderArtPlaceholders`（产出 `data:image/png`）→ `renderArticleImages`）：**8/8 通过**。

**结论（修正我阶段一的说法）**：

1. **E 阶段一"`foreignObject` 无法解码任何 `<img>`"是过宽、错误的**，我撤回。被拒的不是"解码这张图"，而是**嵌套光栅化那一步**；且它**依赖标记的 style**——同一个 `src`，带完整生产 style 通过 12/12，裸 `<img src=…>` 或只有 `width:100%` 则 0/12（6 次独立启动稳定）。
2. **B 的"`data:image/png|svg` 的 `<img>` 均可光栅化"同样过宽**：裸/最小样式的 `<img>` 在我这里稳定失败。应改为"**生产实际发出的样式均通过**"。
3. **对 B 交付的实际影响：无。** B 的 `art.md` 夹具用的是**内联 `<svg>`**（`::: art` 块），而内联 SVG 在所有实验里都通过；生产样式的 `<img>` 也全部通过。所以"带图多页在本机 Chromium 层已覆盖"**对产品实际标记成立**，但**不能统一声称**（对任意 `<img>` 不成立）。
4. 一处**未完全定性的残余**（如实记录）：`max-width:100%` 用 canvas 现场生成的 src 时失败、用 `artRender` 的 src 时通过；E 未能把触发条件收敛成单一属性。失败在**同一次运行内确定**、跨次启动稳定，但跨不同探针脚本出现过不一致。
   → 这本身说明该光栅化路径**脆弱**；**真实 WebView2 的补证仍是唯一权威**（父协调者执行），不要用浏览器层结论替代它。

---

## 八、逐项结论

| 交付项 | 结论 | 理由（决定性） |
| --- | --- | --- |
| **A 协议修复** | **ACCEPT** | 候选 28/28、基线 4 红；请求数全局 ≤3 无第 4 次；纠偏不改参数、不放松校验、失败不授权；`candidate`+`text` 属同类、构造不出有害反例。附一条注释措辞建议 |
| **B 安全分页** | **ACCEPT** | 两个夹具 5 条边界 **0 切内容**（基线同夹具 1 命中）；切点严格递增且覆盖；拼回 **0/6228、0/3884** 不一致；超高块整块输出并显式记 `oversize-unbreakable`；`MAX_CANVAS_PX=65535` 独立确证 |
| **C 交付说明** | **ACCEPT** | 手册哈希与冻结一致，10/10；`writeText` 纯文本、`exports/img-<名>`、`LOCKED_MODEL` 三处与源码逐条一致；三处未实测断言已移除。"安装/后台 NOT RUN"须落在 `coord/final.md` |
| **D 原件重判** | **ACCEPT** | 原件跑前跑后哈希逐项不变；`originalVerdict.status=FAIL` 显式保留、不适用项记 `N/A` 而非 PASS；993 字独立复算一致；证据不足留 UNKNOWN |
| 父的 L6 断言 | **ACCEPT（可证伪）** + advisory | 缺页/多页/零高/NaN 四类必红，非恒真；盲点=顺序与补偿性改动，已给出并验证更强替代式 |
| `live-conformance` 红 | **非本轮**（父判断成立） | 依赖闭包未被触碰、三份输入与 HEAD 逐字节相同、确定性、基线/候选 warnings 相同 |
| `<img>` 争点 | **双方全称说法均需收窄** | 生产样式 12/12 通过、真实链路 8/8 通过；裸 `<img>` 0/12 稳定失败；残余未定性，WebView2 补证为准 |

**E 本阶段未做**：未启动真实模型、未启动桌面应用、未 `build`、未改任何生产实现或测试脚本、
未 `git add/commit/stash`、未启动后代子任务、未上网。写入范围仅 `E/`。

---

# 附：最小重签（2026-10-08，A 注释更正后）

父协调者按阶段二第 2 条 advisory 改了 `src/lib/prep.ts` 的**文档注释**，给出新哈希并要求最小重签。
E 只做三件事，未扩成新一轮审计；B/C/D/父的 L6 断言**未重跑**（本次改动不波及它们——见第 2 条的"可执行部分逐字节相同"证明）。

## 1. 哈希核对

| 版本 | SHA-256 | 说明 |
| --- | --- | --- |
| 旧候选（已 ACCEPT） | `db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f` | E 的 `E/candidate/` 快照，与阶段二核对值一致 |
| **新候选** | `882e3edbaaa7b1b63a6988e2d368f050fbca1b46503c58417a69676e8f91d3db` | 与父协调者给出的值**逐字一致**，已快照到 `E/candidate2/` |

同轮其它冻结文件实测未变：`htmlToImage.ts` `573788d8…`、`使用手册.html` `ce0f8498…`、
`live-acceptance.mjs` `2adb9e0e…`、`f1-artifact-rejudge.mjs` `44a4621f…`。

## 2. 改动确为注释行 —— 三种互相独立的方法

脚本：`E/phase2-a-recheck.mjs`（用 E 自己保存的旧候选快照做对照，不依赖任何 git 命令）。
```
$ node phase2-a-recheck.mjs      →  检查 6 条，未过 0 条
  OK ①  新候选哈希 == 882e3edb…
  OK ①b 旧候选快照哈希 == db238631…
  OK ②方法A（tsc transpileModule removeComments:true）新旧输出**逐字节相同**
         len 14966 = 14966；sha256 前缀同为 e7bc796d561a4a4f
  OK ②方法B（解析成 AST 后用 Printer({removeComments:true}) 重打印）新旧输出**逐字节相同**（len 17037 = 17037）
  OK ③  两版"非注释行"序列完全一致（397 行 = 397 行，按序逐行相同）
  OK ④  声明清单（75 个函数/变量/接口/类型）逐项相同
  首个差异行（旧）：" * 故意**不**覆盖的形状（无真实复现，且扩面会让回归不可控）："
  首个差异行（新）：" * 判据只看**一个结构事实**：合法 outcome（compose / candidate）携带只属于 reply 的 `text`。"
```
- 方法 A/B 是**去注释后的全量比较**：只要有任何一处可执行文本或 AST 结构变化，输出就会不同。两者都逐字节相同 ⇒ **可执行部分未变**。
- 方法 ③ 是文本层对照，与 A/B 独立。
- 差异起点正是 `isCorrectableFinishError` 的 `/** … */` 块，与父协调者描述的位置和内容一致 ⇒ **确为注释行替换**。

## 3. 重跑 A 判定

```
$ E_ROOT=candidate2 node phase2-a-check.mjs   →  检查 30 条，未过 0 条
$ E_ROOT=candidate  node phase2-a-check.mjs   →  检查 30 条，未过 0 条（与旧候选逐项相同）
$ E_ROOT=baseline   node phase2-a-check.mjs   →  检查 24 条，未过 5 条
```

- 新候选 **30/30 全绿**（阶段二的 28 条 + 本轮为核对新注释新增的 2 条），与旧候选结果**完全一致**。
- 基线对照的**原有 4 条红项身份不变**（`A2 纠偏后成稿 / A2b tool 结果播回 / A9a candidate+text 纠偏 / A3 预算内纠偏成稿`）；
  第 5 条 `A10a` 是本轮新增的场景，基线本就无纠偏能力，红是可预期的（并非原有红项发生变化）。

**新注释的两句话经端到端核对属实**（不只看谓词）：

| 新注释的断言 | 实测 |
| --- | --- |
| "与其它错误的**复合**（如同条还缺 assetPolicy）同样会纠偏" | `{outcome:'compose', text:'…'}`（缺 assetPolicy）→ **纠偏**，`req=2`，最终成稿 |
| "**单独出现**（不带 `text`）的六种形状才一律不纠偏、一次即失败" | 六种形状（缺 assetPolicy / 未知 outcome / reply+source / candidate 空 source / assetPolicy 非法 / 顶层非对象）**均 `req=1` 且 failed**；加上混用与多终结共 8 例，全部一次即失败 |

## 4. 结论

> **A：ACCEPT（`src/lib/prep.ts` = `882e3edbaaa7b1b63a6988e2d368f050fbca1b46503c58417a69676e8f91d3db`）**

理由：哈希与冻结合同一致；三种独立方法证明**改动只落在注释**、可执行部分逐字节未变；
A 判定在新候选上 30/30 全绿且与旧候选结果一致；基线对照的原有红项身份不变；
新注释的两句表述经端到端验证**如实反映了实际行为**（此前的文档与实现不符已消除）。

B / C / D / 父的 L6 断言**无需重签**：本次只有 `prep.ts` 的注释变化，
且已由②的方法 A/B 证明其可执行内容与已 ACCEPT 的版本完全一致；四者涉及的
`htmlToImage.ts`、`使用手册.html`、`f1-artifact-rejudge.mjs`、`live-acceptance.mjs` 哈希本轮实测均未变。
