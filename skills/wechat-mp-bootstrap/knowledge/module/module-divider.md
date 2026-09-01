# 分割线（module-divider）

> 定位：用细线、圆点、纯色条、花边等分隔元素把章节、段落隔开，制造阅读节奏与视觉停顿。
> 调用时机：长文章节切换、观点转折、正文到末尾过渡、需要"换口气"的地方时用；是比缩进更清楚的天然分段标志。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素（不能用 `::after` 做装饰尾巴）/外链字体；flex、圆角、`line-height`、`letter-spacing` 可用。分割线本质是一个**独立块级元素**（`<div>` 或 `<p>`），宽度自适应内容区，前后做留白。

**间距硬规范**：分割线上下各留 **24px** 空白（`margin:24px 0`），与图片的 12px、普通块的 16px 区分开——分割线是"更强的停顿"，间距更大。这条是必守项，违反即返工。

**微信兼容注意**：分割线全部用简单块级元素 + inline style，微信端渲染稳定。三个坑要避开——1 不要用 `<hr>` 然后想改它颜色（微信对 hr 默认样式覆盖不稳，用自建 `<div style="border-top:1px solid 色">`）；2 装饰条两端在深色卡片底上观感不同，嵌在彩色卡片里要让两端留白或配细边框，不用透明过渡；3 无伪元素，花边的"对称装饰尾巴"别用 `::before/::after` 拼，直接写 CSS 形状 span 或 art:// 植物图案。

### 1.1 细线（最基础、最万能）

一条实线或淡色线居中，可左对齐可带两侧小形状。规格：`margin:24px 0` + `height:0` + `border-top:1px solid 色`。

```html
<div style="margin:24px 0;height:0;border-top:1px solid #e8e8e8;"></div>
```

要稍重的分隔可用 `#d8d8d8`（中灰）；若想要"虚化"感，用更浅 `#f0f0f0`。细线是任何风格都能兜底的基础款，非风格强约束时优先选它。

### 1.2 圆点 / 竖点分隔

用若干 CSS 小圆点排成一行，适合轻松、简洁风格。点与点之间用 `letter-spacing` 或 flex `gap` 拉出空隙，居中排布。

```html
<div style="margin:24px 0;text-align:center;display:flex;justify-content:center;gap:10px;">
  <span style="width:6px;height:6px;border-radius:50%;background:#c0c4cc;"></span>
  <span style="width:6px;height:6px;border-radius:50%;background:#c0c4cc;"></span>
  <span style="width:6px;height:6px;border-radius:50%;background:#c0c4cc;"></span>
</div>
```
- 三个点最标准；点多一点（五个）会显得更疏朗，但别超过五个，避免像省略号。
- `gap:10px` 让三点均匀散开；想更紧凑用 `8px`，更稀疏用 `12px`。
- 也可用三点 + 主题色，如 `background:#2f6fed`，在不打破极简的前提下带一点品牌色。

### 1.3 纯色短横条

一条由主色构成的短横条，居中，比细线更有设计感。用低饱和纯色 + 细边框铺成，中间实色，简洁利落。

```html
<div style="width:80px;height:3px;border-radius:2px;background:#2f6fed;border:1px solid #c9d9ff;margin:24px auto;"></div>
```
- 关键参数：`width:80px`（长度）、`height:3px`（厚度）、`border-radius:2px`（圆头）、`margin:24px auto`（上下 24px + 水平居中）。
- 想更醒目：宽度加大到 120px、厚度 4-5px、圆角 2-3px；主色可用辅色做第二短横条并排。
- 纯色短横条是最"现代、干净"的强调款，适合科技、商务。

**短横条描边变体**：

```html
<!-- 单色横条：主色实底 + 细描边，精致简洁 -->
<div style="width:100px;height:4px;border-radius:2px;background:#2f6fed;border:1px solid #c9d9ff;margin:24px auto;"></div>
<!-- 细描边的细横条：中间主色、四周描边，更精致的"装饰轴" -->
<div style="width:80px;height:4px;border-radius:2px;background:#2f6fed;border:1px solid #d6e4ff;margin:24px auto;"></div>
```

> 主色 + 辅色并排两条短横条（中间留缝），视觉像一个"多段提亮"的装饰轴，两端以留白收边，不引入过渡。

### 1.4 花边 / 植物图案

用 art:// 植物图案或 CSS 几何形状拼成的装饰分隔，替代 emoji/图标字符花边。花边适合纪念、节日、情感类；植物图案用浅绿或主题色，轻盈。

```html
<!-- 植物图案花边：居中一朵小草 -->
<div style="margin:24px 0;text-align:center;">![小草](art://sprig-grass)</div>
<!-- 纯色横条 + 四角圆点装饰 -->
<div style="margin:24px 0;display:flex;align-items:center;justify-content:center;gap:8px;">
  <span style="width:5px;height:5px;border-radius:50%;background:#9a281f;"></span>
  <div style="width:60px;height:2px;border-radius:1px;background:#9a281f;"></div>
  <span style="width:5px;height:5px;border-radius:50%;background:#9a281f;"></span>
</div>
```
- 花边要点：`gap:8px` 让点与线之间留缝；字号 14px 适中，太大会显得笨。
- 植物图案要点：用 `![说明](art://sprig-grass)` 草丛、`art://blossom-branch` 花枝、`art://leaf-corner` 叶角，居中排布即可；也可用"短横条 + 两端圆点"的几何拼法代替 emoji。
- 花边色彩通常是主题彩或节日专属色，**不作为默认款**，只在特定情感/宣传场景用。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：分割线克制，以细线、圆点为主，颜色浅灰 `#e8e8e8`~`#c0c4cc`；短横条用主色但短而淡；整篇统一 1 种，靠留白建立节奏，不打断正文流动。
- **宣传类**：短横条可更宽更鲜艳（80-120px、主色铺面），花边可用 art:// 植物图案 + 主色；也允许在重要章节切换处换用稍强的主色短横条。但同篇仍 ≤2 种，避免乱。

**同一场景双模式对照（"下一章"切换线）**：

| 位置 | 文字类表现 | 宣传类表现 |
|---|---|---|
| 主默认款 | 细线 `#e8e8e8` | 主色短横条（80px、3px） |
| 章节强调款 | 细线加深到 `#c0c4cc` | 短横条加宽到 120px、双条拼色 |
| 花边 | 基本不用 | 节日/专题可用 art:// 植物图案 + 主题色 |
| 数量 | 全文 1-2 处 | 每大章节 1 次 |
| 调性 | 干净、看不见装饰的"静" | 有仪式感的"转场" |

> **切换要点**：两模式用同一套位置结构（只在章节/转折处放），只换线的粗细与颜色深浅，读者建立的"停顿感"保持一致；无论何种模式，分割线都 ≤2 种、上下留 24px。

## 三、样式变体（≥5 种，具体参数）

1. **细线**：`border-top:1px solid #e8e8e8`、`height:0`、`margin:24px 0`。最万能，任意风格兜底。（见 1.1）
2. **圆点分隔**：CSS 圆点（`width:6px;height:6px;border-radius:50%`）、`gap:10px`、`background:#c0c4cc`、居中。轻松阅读、收尾。（见 1.2）
3. **纯色短横条**：`width:80px;height:3px;border-radius:2px` + 主色 + 细边框 + `margin:24px auto`。章节强调、现代。（见 1.3）
4. **art:// 植物花边**：`![小草](art://sprig-grass)` / `art://blossom-branch` 居中 + 主题色。节日、纪念、情感。（见 1.4）
5. **横条色带**：3px 高纯色横条（中间满色 + 两端圆点），主色/金色。品牌、宣传、新年。（见 1.4）
6. **段落式留白分节**：不画线，仅用较大的块距 + 居中的 CSS 圆点或一句过渡文案分隔——真正的极简版，"无分割线的分隔"。用于极简白、文艺类：

```html
<div style="margin:40px 0;text-align:center;line-height:1;">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0c4cc;margin:0 4px;"></span>
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0c4cc;margin:0 4px;"></span>
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0c4cc;margin:0 4px;"></span>
</div>
<p style="font-size:14px;color:#8a94a6;text-align:center;margin:-32px 0 40px;line-height:1.75;">—— 间歇片刻，继续 ——</p>
```
> 要点：留白分节用 `margin:40px`（比 24px 大，本身就是"停顿"），配一个简单的 CSS 圆点组或一句过渡话即可，整篇作为唯一分节手段，够极简。

## 四、使用时机与位置

- **位置**：章节与章节之间、正文章节切换处、观点转折处、正文到"结尾/敬请期待"的过渡处、以及两段太"平"需要停顿换气处。
- **时机**：一篇文章用一个分割线还是多个？——**短文 1-2 处即可**，长文可在每个大章节用一次；分割线是"小节之间的停顿"，太密的章节还要配合章节标题（见「章节标题」条目）。
- **不要替代标题**：分割线是"视觉分隔"，不是"内容提示"；真正要告诉读者"下一章讲什么"时用章节标题，分割线只做切换缓冲。
- **内容类型**：所有类型都可用；干货/报告类用细线或短横条（克制），情感/纪念/节日类可用花边（有情调）。

**按位置选分割线的快速参考**：

| 位置 | 推荐款 | 理由 |
|---|---|---|
| 章节之间（长文） | 细线 / 主色短横条 | 中性、不打断阅读流 |
| 观点转折处 | 圆点分隔 / 细线 | 轻停顿、不喧宾夺主 |
| 正文到结尾过渡 | 圆点 / 花边 | 收束感、告别感 |
| 节日/纪念关键节点 | 花边 | 有仪式感、专属色 |
| 极简风格通篇 | 细线（最浅）或纯留白 | 靠空白分节，隐形处理 |

> **黄金法则**：分割线数量越少越有效。若一篇文章里需要用 4 条以上分割线来理清层次，说明结构该靠章节标题（见「章节标题」条目）而不是线来承担——线是缓冲，标题才是导航。

## 五、风格适配（4 个风格例子）

- **科技商务**：细线 `#e8ecf3` 或主色短横条（`#2f6fed`），宽度 80px、高 3px、圆角 2px；不用花边；整体干净利落，分割线偏"结构线"而非"装饰"。
- **国潮红金**：横条用红金纯色（`#9a281f` / `#d4a24c`），高 4px、圆角 2px；节点处用 art:// 植物图案（`art://blossom-branch`）或 CSS 菱形点缀；正章之间可用纯色短横条做强停顿，营造"章回感"。
- **校园清新**：圆点分隔薄荷绿 `#0ba89b`，或短横条 `#0ba89b`，宽 60px、圆角 3px；整体轻盈、休闲。
- **极简白**：只用最浅细线 `#f0f0f0` + 大量留白，几乎看不出线，全靠空白分节；全篇不换第二种，把分割线降到"隐性"。

### 风格内部的"款式与颜色配合"建议

- 一款风格其实只需记住"**一款主分隔 + 一款章节强调**"两档：主款用中性（细线/圆点），章节款用该风格的代表色（科技蓝、红金、薄荷、灰）。
- 颜色的选择与正文主色一致（见「风格」维度索引），分割线只用主色的「相对淡」版本（如 `#e8e8e8`~主色），不引入第三个不相关颜色。
- 花边只在确认"此风格允许装饰"时使用（国潮/校园/节日可以，科技商务、极简白原则上不用）。
- 若一篇文章同时用分割线 + 花纹色带，两者颜色必须同源（同一主色的浅档），避免分割线一色、花纹另一色打架。

## 六、间距与尺寸（遵守硬规范）

- **分割线上下各 24px**（`margin:24px 0`）——硬规范，比普通块距（16px）大，营造"强停顿"。短横条/横条色带水平居中额外用 `auto`（`margin:24px auto`）。
- 线高：细线 1px、短横条/横条色带 3-5px；宽度：短横条/横条色带 60-120px；圆点分隔用 `gap:10px` 拉距，圆点直径 6px。
- 花边 `gap:8px`、字号 14px；行高 1.75 内不额外撑高。
- 整篇分割线是同一种样式时位置统一居中；不同场景才右/左对齐，避免混乱。
- 与图片/模块相邻时：分割线不与图片直接贴边，中间至少隔一个 24px 停顿，避免线与图挤在一起。

**分割线参数速查表**：

| 款式 | 关键样式 | 线高 | 长度 | 圆角 |
|---|---|---|---|---|
| 细线 | `border-top:1px solid #e8e8e8` | 1px | 100% | — |
| 短横条 | `background:主色` + `border:1px solid 浅档` | 3-5px | 60-120px | 2-3px |
| 圆点分隔 | 圆点 span + `gap:10px` | 6px 直径 | 居中 | 50% |
| 花边 | art:// 植物图案 + `gap:8px` | 14px 字 | 居中 | — |
| 横条色带 | 纯色横条 + 两端圆点 | 3-5px | 100% | 2-3px |

> 所有款式**上下边距统一 24px**（硬规范），短横条/横条色带再加水平 `margin:auto` 居中。长文切换章节时，同一款式只变「章节强调款」一次（如细线换短横条），其余全程主默认款。

## 七、密度限制

- **同篇分割线 ≤2 种**（如"细线为主，唯一一处章节用短横条"）。index 模块铁律"装饰标题 ≤2 处、花纹 ≤2 种"同样约束分割线家族。
- **出现频率**：短文 1-2 处，长文按大章节 1 次；避免每段都加线，让分割线失去"停顿"意义。
- 一段内不要连续两个同款分割线（读者不知哪层是重点）；需要用更强调的切换时用章节标题页（见「章节分隔宣传页」「章节标题」）。
- **与装饰模块共用时**：分割线 + 花纹 + 徽章等装饰总量相互制约——若全文已用了花纹色带 + 两个徽章，分割线类就尽量只留"细线"一种，避免多种装饰叠在一起显得满。
- **一个章节内不重复**：同一大章节内部不再插入第二枚不同款式的分割线，统一用主款；只有"跨章节"才允许章节款登场。

> **自检**：定稿前数一遍全文分割线形状与颜色——若超过"≤2 种、≤3 处"或出现"每段一条"，立刻删减到只在最关键的 1-3 处保留。

## 八、常见错误（反例 + 正解）

- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：`<hr>` 或 `<div>` 没设 `margin`，线贴到上下文字——密集挤成一团。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：分割线 `margin:24px 0`，上下留足 24px 停顿（硬规范）。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：一篇里细线、短横条、花边、横条色带四种全用，风格乱。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：同篇 ≤2 种，锚定 1 个主分割线贯穿，另一个只在关键章节出现一次。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：用 `<br>` 空行堆出"假分割线"——不同手机行高不同，间距不可控。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：用真正的块级分割线元素 + `margin`/`height`。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：横条写固定 `width:600px`，手机端超宽溢出破版。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：宽度用固定小值 60-120px + 居中，或 `max-width:80%`，绝不用大 px 全宽。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：文档中间无分割线、结尾才突然一条花边，读者感觉突兀。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：分割线节奏均匀，或只在明确的"章节切换/情感转折"处出现，保持一致性。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：分隔线粘在某个彩色卡片里，两端靠透明过渡，卡片深色底时出现生硬白圈。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：嵌在彩色底上的装饰条用纯色 + 细边框，两端以留白收边即可，不做透明淡出。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：把分割线当"标题占位"，在无数段落间堆叠却从不配文字标题。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：线与标题分工——真正要提示"下一章讲什么"时用章节标题，分割线只做视觉停顿，别替标题说话。

## 九、示例（可用骨架，标注可替换处）

**骨架 A · 细线（通用）**：

```html
<div style="height:0;border-top:1px solid #e8e8e8;margin:24px 0;"></div>
```
> 可替换处：线色 `#e8e8e8`（深一点 `#d8d8d8`，浅一点 `#f0f0f0`）、间距 24px。

**骨架 B · 主色短横条（章节强调）**：

```html
<div style="width:80px;height:3px;border-radius:2px;background:#2f6fed;border:1px solid #d6e4ff;margin:24px auto;"></div>
```
> 可替换处：主色 `#2f6fed`、宽度 60-120px、高度 3-5px、圆角 2-3px、描边色随主色浅档。

**骨架 C · 圆点 / 花边（收尾轻松）**：

```html
<div style="margin:24px 0;text-align:center;display:flex;justify-content:center;gap:6px;">
  <span style="width:7px;height:7px;border-radius:50%;background:#9a281f;"></span>
  <span style="width:2px;height:7px;background:#9a281f;"></span>
  <span style="width:7px;height:7px;border-radius:50%;background:#9a281f;"></span>
</div>
```
> 可替换处：颜色 `#9a281f`（主题色）、分隔符 `gap:4-8px`；也可用 `![小草](art://sprig-grass)` 居中替代。

**骨架 D · 横条色带（宣传/新年）**：

```html
<div style="margin:24px 0;height:4px;border-radius:2px;background:#d4a24c;border:1px solid #f0d9a8;"></div>
```
> 可替换处：色带色 `#d4a24c`、描边 `#f0d9a8`、高度 3-5px。

**骨架 E · 圆点分隔（中性通用）**：

```html
<div style="margin:24px 0;text-align:center;display:flex;justify-content:center;gap:10px;">
  <span style="width:6px;height:6px;border-radius:50%;background:#c0c4cc;"></span>
  <span style="width:6px;height:6px;border-radius:50%;background:#c0c4cc;"></span>
  <span style="width:6px;height:6px;border-radius:50%;background:#c0c4cc;"></span>
</div>
```
> 可替换处：颜色 `#c0c4cc`、`gap:8-12px`。

**骨架 F · 双条拼色横条（章节强调/宣传）**：

```html
<div style="margin:24px 0;display:flex;justify-content:center;align-items:center;gap:8px;">
  <div style="width:48px;height:4px;border-radius:2px;background:#2f6fed;"></div>
  <div style="width:48px;height:4px;border-radius:2px;background:#6b4fc4;"></div>
</div>
```
> 可替换处：主/辅两色、宽度各 40-60px、高度 3-5px。

**骨架 G · 章节切换（章节标题 + 下方短横条组合）**：

```html
<div style="margin:24px 0 0;">
  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1b2a4a;">第三章 · 开始行动</h3>
  <div style="width:60px;height:3px;border-radius:2px;background:#2f6fed;border:1px solid #d6e4ff;"></div>
</div>
<p style="font-size:15px;color:#333;line-height:1.75;margin:16px 0 24px;">跟正文呼应的章节开场说明。</p>
```
> 可替换处：章节序号与标题、短横条主色；此骨架把「章节标题」与「分隔短横条」结合，比单独用分割线更有"导航感"（参见「章节标题」条目）。

**骨架 H · 留白分节（极简/文艺）**：

```html
<div style="margin:40px 0;text-align:center;line-height:1;">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0c4cc;margin:0 4px;"></span>
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0c4cc;margin:0 4px;"></span>
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0c4cc;margin:0 4px;"></span>
</div>
<p style="font-size:14px;color:#8a94a6;text-align:center;margin:-32px 0 40px;line-height:1.75;">—— 间歇片刻，继续 ——</p>
```
> 可替换处：圆点样式（可用 CSS 圆点 span / art:// 植物图案）、颜色 `#c0c4cc`、过渡文案；留白间距 `40px` 大于常规的 24px，本身就是"停顿"。

## 十、个性化空间（可调参数与判断依据）

- **可调**：分割线类型（细线/短横条/花边）、线宽、颜色、长度、圆角。**判断依据**：干货/商务用细线或单色短横条（克制），情感/节日用花边/art 图案（有情调）；主色强约束时用主色短横条最协调。
- **可调**：长度与位置（居中/左对齐）。**判断依据**：居中最正式、最通用；左对齐偏"手记"感；长文统一偏向一种，避免来回切换。
- **可调**：上下留白（默认 24px，可微调 20-28px）。**判断依据**：留白越大停顿越长；想要"嘎然而止"的强转折可加大到 28-32px，但仍保持整篇一致、≥20px 底线。
- **可调**：是否与其他模块耦合。**判断依据**：分割线+花纹/章节宣传页可做更强的转场（见「花纹色带」「章节分隔宣传页」），但同篇装饰密度有限，别叠加过多；默认分割线保持独立简洁。
- **可调**：短横条的颜色数量（单主色 or 双条拼色）。**判断依据**：科技商务单主色即可（`#2f6fed`），国潮/节日可用红金双条（`#9a281f` + `#d4a24c`）；颜色越多越"装饰"，越少越"结构"，别让分割线变成全文最花的地方。
- **可调**：花边/留白分节这套"隐形分隔"该不该用。**判断依据**：极简白、文艺类用留白分节最贴合；其余风格默认用可见的分割线款。若文中已有多处强装饰（花纹/徽章），就用最轻的分割线甚至纯留白对冲。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
