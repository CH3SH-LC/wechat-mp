# 2026-09-29 照片位吞并回归：前后对比证据

真实故障：文档 `s1790565874610554000`（2026-09-29）的成品 `article.html` 里 3 处**内部源码泄漏**——
`::: photo` 照片位把紧随其后的段落与 `::: art` 素材块（含整段 SVG）吞进自己的"说明"，再转义成可见文字输出。

- 样例（只读）：[`scripts/fixtures/2026-09-29-photo-swallow/`](../../../scripts/fixtures/2026-09-29-photo-swallow/)
- 断言脚本：[`scripts/photo-swallow-check.mjs`](../../../scripts/photo-swallow-check.mjs)
- 可证伪的期望清单：[expected.md](../../../scripts/fixtures/2026-09-29-photo-swallow/expected.md)

真实作品目录（`%USERPROFILE%\Documents\wechat-mp-workspace`）全程**只读**：没有写入、没有启动桌面应用、没有联网。
成品 678 KB 的 `article.html` 不入库，只把其中的 3 段泄漏原文逐字收在
`fixtures/2026-09-29-photo-swallow/failing-doc.json` 的 `html` 字段里。

## 目录（一个 label 一个子目录，互不覆盖）

| 目录 | 内容 |
| --- | --- |
| [2026-09-29-pre-fix-head/](2026-09-29-pre-fix-head/) | **先证红**：同一套断言打在 `git HEAD:src/lib/compose.ts`（修复前）上的真实输出 `red-proof.md` |
| [2026-09-29-post-fix/](2026-09-29-post-fix/) | **后证绿**：同一套断言打在当前工作区 `src/lib/compose.ts` 上的产出与 `result.md` |

> 曾有一个 `2026-09-29-baseline/` 目录，那是脚本**初稿**的运行结果：断言①把"紧随其后的段落"这条判据
> 写成了对整篇可见文本的正则（照片位 section 之后 400 字内出现该段落即判失败），于是**假阳性**报了一条 FAIL。
> 修正为"只查照片位 section 自己的说明文字"后该产物已删除，避免在证据目录里留一条假 FAIL。
> 断言本身没有放宽：吞没判据从"附近出现过"收紧成"就在说明字段里"。

## 实测对比

真实成品基线取自 `failing-doc.json`（成品里 3 段泄漏 section 逐字原文），
裁剪版取自本次 `output-real-trimmed.html`。两者是**同一故障的同一形态**，裁剪版只是删掉了与故障无关的正文。

| 指标 | 真实成品 `article.html` | 修复前（`HEAD` 解析器）× fixture | 修复后（工作区）× fixture |
| --- | --- | --- | --- |
| 可见文本泄漏总处数 | **6** | **6** | **0** |
| 转义 `<svg` | 3 | 3 | 0 |
| 可见 `::: art` | 3 | 3 | 0 |
| 未解析 `[[asset:` / `[[img:` / `[[deco:` | 0 | 0 | 0 |
| `【照片位】` | 3 | 3 | 3 |
| 有效素材位（落位到 `arts`） | 0 | 6 | 6 |
| 明确阻断的美术素材（带原因的可见占位） | 0（当时只有一句"已用占位文本替换"，无逐块原因） | 0 | 1 |
| 断言 FAIL 条数 | —— | **10**（`red-proof.md`） | **0**（`result.md`） |

"修复前 × fixture"那一列的 **6 = 真实成品的 6**：裁剪样例把真实故障按同样的数量复现出来了——
不是"大概像"，是同一形态、同样 3 处 `<svg` + 3 处 `::: art`。

## 复现方式

```bash
node scripts/photo-swallow-check.mjs --prove-red --label <名字>   # 对着 HEAD 的解析器跑，要求至少红一条
node scripts/photo-swallow-check.mjs --label <名字>               # 对着当前工作区跑，要求全绿
```

`--prove-red` 把 `--at`（默认 `HEAD`）版本的 `src/lib/compose.ts` 及其相对依赖取到系统临时目录里跑，
跑完即删，**不改动任何源文件**。

## 证据的版本边界

`compose.ts` 是"照片位吞并"的修复落点，而这份证据是在该文件**正被并行修改**期间取的。
两次运行之间曾出现同一份样例从"全绿"变"全红"——那是抓到了文件被改写的中间态（先报了一次
`ERR_INVALID_TYPESCRIPT_SYNTAX`，后又在旧实现态下跑出 9 条 FAIL），**不是回归**。
因此每次运行的产出都记下工作区 `src/lib/compose.ts` 的内容哈希：

- `2026-09-29-post-fix/result.md` 记为 `28c7f5571c7b1d193a9c1b365e855ff22d273837`。

换版本重跑请用新 label，不要覆盖本目录。

## 还没做的（别把本目录当成验收通过）

- **`checkHtml` 不通过却仍 `ok:true / 成稿已保存` 且不自动修订**：这是保存链路的门禁问题
  （仓库外证据 `latest-quality-evidence.json` 的 `autoReviseTriggers: []`），本样例只钉解析器一侧的根因。
- **真实模型下的产物**：本目录全部离线（无模型调用、无绘图），只证明解析链路。
- **真机观感**：`output-real-trimmed.html` 是 compose 片段，没有 375px 外壳，也没有替换 `@@ARTn@@`
  占位（离线无 canvas）；要看素材实际画面请走 `scripts/fixture-repair.mjs` 那条路径或桌面端导出。
