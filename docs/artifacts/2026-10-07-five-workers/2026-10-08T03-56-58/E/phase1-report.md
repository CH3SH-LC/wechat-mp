# E 路阶段一报告：判据与缺陷独立复现（2026-10-08）

对象：**git 冻结基线 `df97022`**。产出：本报告 + `E/criteria.md` + 四份复现脚本与原始读数（`E/out/repro-*.json`）+ 分页切割证据图（`E/out/paging-boundary-*.png`）。
**本阶段不出 ACCEPT**——代码仍在变（见下），只在候选冻结后签收。

---

## 〇、方法：为什么必须对基线快照复核

开工后核对发现 **A、B、C 已经在改自己名下的生产文件**，工作树相对 HEAD 已脏：

```
$ git status --short src/ scripts/ src-tauri/
 M src/lib/htmlToImage.ts        (B 正在改)
 M src/lib/prep.ts               (A 正在改)
 M scripts/export-paging-check.mjs
 M scripts/prep-contract-check.mjs
 M "src-tauri/resources/使用手册.html"   (C 正在改)
?? scripts/f1-artifact-rejudge.mjs
?? scripts/fixtures/2026-10-07-safe-paging/
```

因此"对着工作树跑一遍"得到的不是基线行为。E 一律用 `git archive df97022 src` 把冻结点提取到 `E/baseline/`，
生产模块从该副本加载（vite root = `E/baseline`），并记录哈希：

```
$ git archive --format=tar df97022 src | tar -x -C E/baseline
$ git hash-object E/baseline/src/lib/prep.ts        → 8469613061c89120bee33618a34ae0aea7f8ec46  (= df97022:src/lib/prep.ts)
$ git hash-object E/baseline/src/lib/htmlToImage.ts → 307458f4819216c769200971d2a9d1712f8143c2  (= df97022:src/lib/htmlToImage.ts)
```

> 首轮试跑确实踩到了这个坑：B 的行内改动让页高变成 `[1481,1987,1176]`（非等高），读数与基线不符。改用基线快照后才得到基线应有的 `[2000,2000,644]`。

**受控传输声明**：A/D 的所有"模型回复"都是脚本写死的**受控返回值**（标注 `model=stub-controlled`），
只证明产品侧契约与执行器行为，**不是真实模型行为**，也不据此声称任何语义结论。

---

## 一、A：`outcome=compose` 带 `text` 被整条拒绝

**脚本**：`E/repro-a-prep-compose-text.mjs`（真实生产模块 `runPrep`，经 vite `ssrLoadModule` 加载基线 `prep.ts`；只替换 `@tauri-apps/api/core` 的 `invoke` 为受控剧本，并记录每次实际发出的请求条数）

```
$ node E/repro-a-prep-compose-text.mjs      # 退出码 0（结论已产出）
生产模块加载成功；MAX_PREP_CALLS = 3
```

| 场景（受控返回值） | 观测 | 判定 |
| --- | --- | --- |
| `finish_preparation{outcome:compose, assetPolicy:preserve}` | `prep/compose`，请求数 1 | **P1 过**：不带 text 的 compose 正常接受 |
| 同上多带 `text:'我按默认排版来写…'` | `prep/failed/protocol`，请求数 **1**，reason=`outcome=compose 与 text 互斥（要答复请用 reply）` | **P2 复现**：整条被拒 |
| 先 1 次知识工具，第 2 次才给非法终结（**预算还剩 1 次**） | 请求数 **2**（未使用剩余预算），结局 `failed/protocol` | **P3 复现**：剩余预算内**不发纠偏请求**，直接终结整回合 |
| `candidate` 多带 `text` | `failed/protocol` | P5 同类，缺陷范围含 candidate |
| 被拒后的返回 | `kind=failed`，无 compose/candidate | **P4 过**：失败不产生写作授权、不静默降级 |

**结论：复现成功。** 缺陷 = 一个"可纠正的终结参数错误"在预算仍有剩余时**直接终结**该回合（T3 的"有界纠偏"缺失）。
产品行为正确的一面同时得到印证：被拒时不写、不降级。

---

## 二、B：固定 1000 CSS px 等高硬切切断文字行 / 插画

**脚本**：`E/repro-b-paging-cut.mjs`（dev server + 受控 Chromium 加载基线 `htmlToImage.ts`，调用真实 `renderArticleImages`）
**夹具**：`E/fixtures/paging-cut.html`（连续中文段落 + 两张固定高度内联 SVG 插画）

```
$ node E/repro-b-paging-cut.mjs             # 退出码 0
cssH=3114  pages=4  pageHeights=[2000,2000,2000,228]  long=750x6228
边界 y=1000: 被切文字行 0 个；被切图形盒 1 个 {"tag":"svg","top":741.47,"bottom":1163.47}
边界 y=2000: 被切文字行 1 个 {"top":1997.38,"bottom":2018.38,"text":"第九段：正文继续。为了不依赖运气"}
边界 y=3000: 被切文字行 1 个 {"top":2997.19,"bottom":3018.19,"text":"第十七段：收尾。到此为止，夹具已"}
Q3 页图拼回与长图逐像素一致（比较 6228 行，不一致 0 行）
```

- **3 个页边界，3 个都落在内容内部**（命中率 100%）。这正是固定 1000px 等差切的必然结果：连续段落的行盒首尾相接，切点无处可躲。
- **插画被切成两半**：边界 y=1000 落在插画盒 `[741.47, 1163.47]` 内 258.5 CSS px 处，即**正中间**。
  证据图 `E/out/paging-boundary-1000.png`（上页末尾 200 行 + 红线=页边界 + 下页开头 200 行）肉眼可见红线把圆形插图横切为两半。
- **文字行被切断**：y=2000、y=3000 各落在一个行盒内部（分别深入 2.62 / 2.81 CSS px ≈ 5–6 设备像素的残行）。
- **页高特征**：所有非末页恒为 2000 设备像素（=1000 CSS px），即"等高硬切"。
- **拼回逐像素一致**（0/6228 行不一致）：说明缺陷**不是丢像素**，而是**内容被腰斩**——这条同时验证了 B4 判据不是恒真。

**结论：复现成功。**

附一条对 B 有影响的实现环境事实（不是缺陷，须如实记录）：
本机受控 Chromium 的 `foreignObject` 光栅化**无法解码任何 `<img>`**（连 1×1 PNG 都报
`EncodingError: The source image cannot be decoded`），内联 `<svg>` 与 `div` 正常。
故夹具用内联 SVG 承担"插画盒"。这与既有记录"普通 Chromium 的带图限制"一致；
**真实 `<img>` 正文的多页导出在真实 WebView2 上仍属未覆盖**，不得由本报告外推。

---

## 三、C：手册包名与实测条件不符

**脚本**：`E/repro-c-manual-claims.mjs`（只读 `git show df97022:src-tauri/resources/使用手册.html`，与实际构建产物/源码对账）

```
$ node E/repro-c-manual-claims.mjs          # 退出码 0
MISS S1a 手册里出现的安装包名能在实际产物中找到
        手册=["wechat-mp-desktop-x.x.x-setup.exe"]；磁盘=["wechat-mp-desktop_0.1.0_x64-setup.exe","智序_0.1.0_x64-setup.exe"]
MISS S1b 手册包名 == productName 推出的实际名（期望 智序_0.1.0_x64-setup.exe）
MISS S2  手册"密钥不会上传到任何地方" 与源码不符（chat.rs 发 Authorization，5 处）
MISS S3  「全程约 2-3 分钟」「图片方式所见即所得，任何公众号都能用」「把 HTML 内容复制到公众号编辑器」
```

| 发现 | 基线原文（行号） | 实际 | 分类 |
| --- | --- | --- | --- |
| **包名不符（决定性）** | L140 `wechat-mp-desktop-x.x.x-setup.exe` | `tauri.conf.json` `productName=智序` → 实际产物 `智序_0.1.0_x64-setup.exe`；且实际用下划线，手册用连字符 | 产品（交付文案） |
| 密钥去向表述与网络行为矛盾 | L160「本软件不会把它上传到任何地方」 | `chat.rs` 在 5 处发送 `Authorization: Bearer {cfg.key}` 到用户配置的接口地址 | 产品（交付文案） |
| 未实测断言当事实 | L246「全程约 2-3 分钟」、L260「任何公众号都能用」、L258「把 HTML 内容复制到公众号编辑器」 | 仓库内无对应实测证据；安装与后台均登记 NOT RUN | 证据 |
| 版本标识陈旧 | L102「适用版本：0.1.x（2026-09 发布版）」 | 当前 0.1.0 构建于 2026-10-03 | 产品（次要） |

**结论：复现成功。** 决定性反例 = 用户照手册去找 `wechat-mp-desktop-x.x.x-setup.exe`——
该名字的产物**不存在**（磁盘上仅有历史上旧的 `wechat-mp-desktop_0.1.0_x64-setup.exe`，分隔符也不同）。
另注：`src-tauri/target/release/bundle/nsis/` 同时残留 2026-09-09 的旧英文名安装包，属交付目录卫生问题，本轮不扩范围。

---

## 四、D：G2B 用错 180 字上限判 FAIL

**脚本**：`E/repro-d-g2b-wordlimit.mjs`（题面逐字取自 `git show df97022:scripts/live-acceptance.mjs`；正文可见文字口径自己重算；归档原件只读）

```
$ node E/repro-d-g2b-wordlimit.mjs          # 退出码 0
G2B 题面（冻结基线逐字）："只把标题改成“图书馆开放时间调整通知”，正文和配图一个字都不要动。"
R1 G2B 题面不含任何字数要求            → 通过
R2a 冻结基线 G2B 传 wordLimit:null     → 通过
R2b 冻结基线 runWritePhase 只在"没传"时才用 180（`=== undefined ? 180 : null`）→ 通过
R2c 旧的 `|| 180` 形状会把显式 null 变成 180（原假红机制）：null||180 = 180
R4a 我独立重算的字数 = 归档记录的 993 字   （重算=993，归档=993）
R4b 原 FAIL 是该题面下唯一失败项：G2B：字数-正文可见文字去空白 ≤ 180 字
R4c 旧运行确实套用了 180（假红）
R3  归档原件哈希逐项未变（重判不修改旧判定）：全部一致
```

- 归档原件（`%TEMP%/wxmp-f1-real-g1/evidence/G2B-2026-10-03T04-44-15-17a443c1/`）里
  **唯一失败项**就是那条 180 字上限；题面里根本没有任何字数要求 → 该判据**不适用**。
- E 用与 runner 公布口径一致的"正文可见文字去空白、排除标题节点与 svg/img/script/style"独立重算，得 **993 字**，与归档读数**逐字一致**。
- 冻结基线里该判据**已不适用于 G2B**（`wordLimit: null` + `=== undefined` 守卫）；但**原 FAIL 记录仍在归档里**。
  重判必须产出**新**记录并保留旧 FAIL——这正是 D 要证明的"新旧判断可区分"。

**结论：复现成功。** 分类：**runner**（口径错，非产品缺陷）。

---

## 五、阶段一结论与等待条件

| 项 | 阶段一结论 |
| --- | --- |
| A 缺陷复现 | **复现成功**（compose+candidate 带 text 被整条拒；预算剩 1 次也不追问） |
| B 缺陷复现 | **复现成功**（3/3 边界切内容；插画居中腰斩有截图；拼回无丢像素） |
| C 缺陷复现 | **复现成功**（包名不符=决定性；密钥表述与源码矛盾；3 处未实测断言） |
| D 缺陷复现 | **复现成功**（题面无字数要求，180 判据不适用；独立复算 993 与归档一致；原件未变） |

**不签收**：上述全部针对基线 `df97022`；A/B/C 的生产文件此刻正在被各自实施者修改。

**等待第二阶段**（父协调者把候选冻结并给出实际文件与哈希后执行）：

1. 逐个候选记录 sha256 / git blob，并**只对候选**重跑 `repro-a/b/c/d`（vite root 指向候选快照）。
2. 按 `E/criteria.md` 的 A1–A8 / B1–B7 / C1–C5 / D1–D5 逐条判定，给 `ACCEPT / REWORK / BLOCKED / UNKNOWN` + 一条决定性反例。
3. `BLOCKED` 只用于缺环境（真实 WebView2 带图导出、真实安装、公众号后台）或缺授权；这些**本轮由父协调者按适用授权操作，E 不自行启动**。
4. 实施者自报全绿不替代签收；每次修订重新检查对应候选；不扩成全仓审计。

**E 本轮未做**：未启动真实模型、未启动桌面应用、未 `build`、未改任何生产文件或测试脚本、未 `git add/commit/stash`、未启动后代子任务。写入范围仅 `E/`。
