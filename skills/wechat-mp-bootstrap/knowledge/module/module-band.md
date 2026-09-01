# 花纹色带（module-band）

> 定位：用「低饱和纯色 + 细边框 + 半透明纯色块叠加」做出斜纹/波点/棋盘/条纹/圆环等平面花纹，铺成一条"花色带"，给分区做强调、给小标题做衬底。
> 调用时机：想让两个大段落有清晰分界、或让小标题更醒目时用；需要一点"装饰味"但不至于花哨时用。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体；**花纹全靠低饱和纯色块 + 细线边框叠加**实现，不使用任何渐变（本规范不推荐渐变、不推荐投影，统一纯色 + 细边框）。如需真实纹理图，一律用微信 `uploadimg` URL。

**一条花纹 = 多块低饱和纯色/半透明纯色块 + `border:1px solid` 细线**，直接写进元素的 `style="background:..."` 或靠子元素拼接。统一的使用图示（容器）：

```html
<div style="width:100%;height:80px;border-radius:8px;margin:0 0 16px; [花纹外观值]"></div>
```

**通用透明度约定（深浅两档）**：
- 浅档 = `rgba(色, .08)`
- 深档 = `rgba(色, .16)`
- 正文衬底默认用**浅档（≤.15）**保文字可读；色块、页眉、CTA 装饰可用**深档（.16）**。

**平面化替换原则**：凡原"重复渐变花纹"的位置，一律改为「纯色底 `rgba(色,浅档)` + 细边框 `border:1px solid rgba(色,中档)` + 半透明纯色小色块 `.16` 间隔排布 + 留白」。花纹主色取色板中的品牌主色；辅色/对比色只用色板内相邻或互补色，整条色带颜色数 ≤2；深浅档控制的是**视觉密度**而非颜色本身。示例统一用主色蓝 `#2777ff`、辅紫 `#6b4fc4`、强调橙 `#e6550d`、中性灰 `#333`。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：花纹色带用浅档（≤.08）作衬底，只给标题/小结增加一点层次，不抢正文文字；色带高度偏矮（40-60px），颜色贴近主色但更淡。
- **宣传类**：花纹色带可用深档（.16）或双纯色块排布，高度可加到 80-100px，甚至做活动头图衬底；颜色跨主色→辅色。但文字落在花纹上时必须垫一层浅实色底或用浅档，保证可读。

## 三、样式变体（≥3 种，具体参数）

### 3.1 斜纹家族（最百搭）

**细斜纹（旋转细线）**——细分隔、栏目衬底、标题行分隔：用一排 `transform:rotate(45deg)` 的细边框块排列成斜向节拍。

```html
<div style="width:100%;height:52px;border-radius:8px;background:rgba(39,119,255,.05);overflow:hidden;display:flex;align-items:center;">
  <div style="width:100%;height:4px;background:rgba(39,119,255,.16);border:1px solid rgba(39,119,255,.35);transform:rotate(45deg) scale(1.6);"></div>
</div>
```
深档把 `.16` 换成 `.24`。调节细线高度与 `border` 粗细成对改。

**粗斜纹（宽幅斜带）**——页眉、横幅、分区色带（装饰性强）：用两条平行的细边框斜带叠出宽幅节奏。

```html
<div style="width:100%;height:80px;border-radius:8px;background:rgba(230,85,13,.05);overflow:hidden;position:relative;">
  <div style="position:absolute;top:10px;left:0;right:0;height:18px;background:rgba(230,85,13,.16);border:1px solid rgba(230,85,13,.4);transform:rotate(45deg) scale(1.6);"></div>
  <div style="position:absolute;top:40px;left:0;right:0;height:18px;background:rgba(230,85,13,.16);border:1px solid rgba(230,85,13,.4);transform:rotate(45deg) scale(1.6);"></div>
</div>
```

**双色交叉斜纹（编织感）**——两组 45deg 与 -45deg 的细边框斜块叠加，适合工艺/手作/非遗主题：

```html
<div style="width:100%;height:56px;border-radius:8px;background:rgba(39,119,255,.04);overflow:hidden;position:relative;">
  <div style="position:absolute;top:50%;left:-20%;right:-20%;height:3px;background:rgba(39,119,255,.2);border:1px solid rgba(39,119,255,.45);transform:rotate(45deg);"></div>
  <div style="position:absolute;top:50%;left:-20%;right:-20%;height:3px;background:rgba(107,79,196,.2);border:1px solid rgba(107,79,196,.45);transform:rotate(-45deg);"></div>
</div>
```

### 3.2 波点家族（温和、适用广）

**圆点阵**——均匀波点、轻松主题卡片底、标题衬底：用多个实心圆点 span 排成周期。

```html
<div style="width:100%;height:56px;border-radius:8px;background:rgba(39,119,255,.04);border:1px solid rgba(39,119,255,.14);display:flex;gap:16px;align-items:center;justify-content:space-around;padding:0 16px;">
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(39,119,255,.22);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(39,119,255,.22);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(39,119,255,.22);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(39,119,255,.22);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(39,119,255,.22);"></span>
</div>
```

**双层点阵（大小错落）**——大点小点嵌套，活泼有节奏，适合年轻化、活动物料：

```html
<div style="width:100%;height:56px;border-radius:8px;background:rgba(39,119,255,.04);border:1px solid rgba(39,119,255,.14);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-around;padding:4px 16px;">
  <span style="width:14px;height:14px;border-radius:50%;background:rgba(107,79,196,.22);"></span>
  <span style="width:6px;height:6px;border-radius:50%;background:rgba(39,119,255,.26);"></span>
  <span style="width:14px;height:14px;border-radius:50%;background:rgba(107,79,196,.22);"></span>
  <span style="width:6px;height:6px;border-radius:50%;background:rgba(39,119,255,.26);"></span>
  <span style="width:14px;height:14px;border-radius:50%;background:rgba(107,79,196,.22);"></span>
</div>
```

### 3.3 棋盘格（趣味、辨识度高）

**双色棋盘**——用纯色方块 + 留白交替成格（原"角度渐变四等分"的效果，现以纯色方板块平铺），适合游戏/极客/轻互动：

```html
<div style="width:100%;height:56px;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
  <div style="display:flex;">
    <span style="width:28px;height:28px;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
    <span style="width:14px;height:28px;"></span>
    <span style="width:28px;height:28px;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  </div>
  <div style="display:flex;">
    <span style="width:28px;height:28px;"></span>
    <span style="width:14px;height:28px;"></span>
    <span style="width:28px;height:28px;"></span>
  </div>
</div>
```

**细格纹（方格纸）**——横竖细线叠加，学习/清单/科技极简：两条细边框横竖相交。

```html
<div style="width:100%;height:56px;border-radius:8px;overflow:hidden;position:relative;background:#fafbfc;">
  <div style="position:absolute;top:0;left:0;width:100%;height:1px;background:#d9dde3;"></div>
  <div style="position:absolute;top:18px;left:0;width:100%;height:1px;background:#d9dde3;"></div>
  <div style="position:absolute;top:36px;left:0;width:100%;height:1px;background:#d9dde3;"></div>
  <div style="position:absolute;top:0;left:24px;width:1px;height:100%;background:#d9dde3;"></div>
  <div style="position:absolute;top:0;left:48px;width:1px;height:100%;background:#d9dde3;"></div>
  <div style="position:absolute;top:0;left:72px;width:1px;height:100%;background:#d9dde3;"></div>
</div>
```

### 3.4 条纹家族

**竖条纹**（侧栏标注、榜单条背景）：一排同宽的纯色竖条均匀排开。

```html
<div style="width:100%;height:48px;border-radius:8px;display:flex;gap:8px;align-items:stretch;justify-content:center;">
  <span style="flex:1;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="flex:1;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="flex:1;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="flex:1;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
</div>
```

**横条纹**（水平节奏、上下分段装饰）：上下几条纯色横条。

```html
<div style="width:100%;height:56px;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;gap:6px;justify-content:center;">
  <span style="height:8px;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="height:8px;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="height:8px;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
</div>
```

**双色条纹**（两组同向错半周期，双品牌色）：主色块与辅色块交错。

```html
<div style="width:100%;height:48px;border-radius:8px;display:flex;gap:8px;align-items:stretch;">
  <span style="flex:1;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="flex:1;background:rgba(107,79,196,.14);border:1px solid rgba(107,79,196,.22);"></span>
  <span style="flex:1;background:rgba(39,119,255,.14);border:1px solid rgba(39,119,255,.22);"></span>
  <span style="flex:1;background:rgba(107,79,196,.14);border:1px solid rgba(107,79,196,.22);"></span>
</div>
```

### 3.5 圆环家族

**鱼鳞/圆环**——细边框圆环错位出鳞片感，海洋/自然主题：

```html
<div style="width:100%;height:56px;border-radius:8px;background:rgba(39,119,255,.04);display:flex;gap:12px;align-items:center;justify-content:space-around;padding:0 12px;">
  <span style="width:20px;height:20px;border-radius:50%;border:2px solid rgba(39,119,255,.35);"></span>
  <span style="width:20px;height:20px;border-radius:50%;border:2px solid rgba(39,119,255,.35);"></span>
  <span style="width:20px;height:20px;border-radius:50%;border:2px solid rgba(39,119,255,.35);"></span>
  <span style="width:20px;height:20px;border-radius:50%;border:2px solid rgba(39,119,255,.35);"></span>
</div>
```

> 圆环家族与波点家族是同一种"点状语言"，只变了疏密；同篇里别同时用圆环又用波点，避免重复啰嗦。

### 3.6 分段色块条（多色，彩条）

一条多个纯色块切成多段，模拟"分段轴"或节日彩条。每色块等宽、间隔留白，可自行增删色块。

```html
<div style="width:100%;height:24px;border-radius:8px;display:flex;gap:6px;overflow:hidden;">
  <span style="flex:1;background:rgba(33,102,255,.16);border:1px solid rgba(33,102,255,.28);"></span>
  <span style="flex:1;background:rgba(230,85,13,.16);border:1px solid rgba(230,85,13,.28);"></span>
  <span style="flex:1;background:rgba(107,79,196,.16);border:1px solid rgba(107,79,196,.28);"></span>
</div>
```

### 3.7 大理石（多纯色半透明色斑）

多组不同位置、不同大小的半透明纯色块叠加模拟云纹/流动纹理，**无法全景平铺**，更适合单块装饰元素而非满幅背景。用于画册封面、艺术引言卡、文字局部衬底：

```html
<div style="width:100%;height:80px;border-radius:8px;position:relative;overflow:hidden;background:#f7f9fc;">
  <div style="position:absolute;top:10%;left:10%;right:30%;height:40%;border-radius:50%;background:rgba(39,119,255,.10);"></div>
  <div style="position:absolute;top:40%;left:45%;right:10%;height:45%;border-radius:50%;background:rgba(107,79,196,.10);"></div>
  <div style="position:absolute;top:-10%;left:-5%;right:50%;height:60%;border-radius:50%;background:rgba(230,85,13,.08);"></div>
</div>
```

### 3.8 星芒 / 放射（纯角块拼装）

靠多个旋转的细边框三角/菱形块拼出放射感，能量/颁奖/激励主题。**兼容性**：全部为纯色块 + 边框，任何内核都稳定渲染，无需兜底：

```html
<div style="width:100%;height:80px;border-radius:8px;background:rgba(230,85,13,.05);display:flex;align-items:center;justify-content:center;">
  <span style="width:8px;height:48px;background:rgba(230,85,13,.18);border:1px solid rgba(230,85,13,.35);"></span>
  <span style="width:48px;height:8px;background:rgba(230,85,13,.18);border:1px solid rgba(230,85,13,.35);"></span>
</div>
```

## 四、使用时机与位置

- **位置**：花纹色带常用于「分区强调」（大段落之间的一条花色分隔带）或「小标题衬底」（标题文字放在花色浅条上）。色带多用在章节衔接、页眉、CTA 前，制造节奏停顿。
- **时机**：想让读者"这里有文章氛围/这是一个新板块"时用；不必每章都用，只用在最重要的 1-3 处。
- **内容类型**：宣传类、活动类、专题/特辑、品牌故事最常用；纯干货长文可只在小标题衬底用一条浅斜纹，点到为止。

## 五、风格适配（4 个风格例子）

- **科技商务**：斜纹或细格纹，主色科技蓝 `#2166ff` 浅档（.08），色带高度 48px，圆角 8px，底下垫深蓝字。
- **国潮红金**：粗斜纹或棋盘，红金配（主色 `#9a281f` 红 + 辅金 `#d4a24c`），深浅对半，衬底红金两档叠。
- **校园清新**：波点或圆环，薄荷绿 `#0bbf8f` 浅档（.08），圆角 14px，色带矮（40px）当小标题衬底。
- **极简白**：细斜纹或细格纹，中性灰 `#999` 浅档，高度 36px，无圆角或 4px，几乎隐入背景。

## 六、间距与尺寸（遵守硬规范）

- 色带容器底部边距统一 `margin:0 0 16px`（块距硬规范）；做分区分隔时上下各留 16px。
- 高度：小标题衬底 36-60px；分区强调带 60-100px。圆角与高度配合（矮带 6-10px 圆角，高带 8-12px）。
- 衬底花纹上若有文字，文字层用**实色浅底隔开**，且文字 `line-height:1.75`、字号 14-15px。
- 花纹密度用 alpha 控制：浅档 ≤.08，中档 .12，深档 .16。**文字可读是硬底线**，衬底花纹透明度 ≤.15。

## 七、密度限制

- **全篇花纹 ≤2 种**（如"斜纹 + 波点"或"斜纹 + 棋盘"，别 6 种杂糅）。
- **最多 2~3 处出现**；文章锚定 1 个"主花纹"贯穿，另一个"点缀花纹"只在页眉/CTA 出现一次。
- **同类家族统一**：斜纹三款同属"斜纹"语言，别把细斜纹、粗斜纹、交叉斜纹三种都上，选一种即可。
- 衬底花纹只建议 **3 行内正文** 使用，长段落一律纯色或 ≤.08 细纹。

## 八、常见错误（反例 + 正解）

- **反例**：半篇正文都铺在花纹上，字被线压花、读不动。**正解**：衬底只给标题/短小结（≤3 行），且透明度 ≤.08；长段落用纯色。
- **反例**：一篇里斜纹+波点+棋盘+竖条全上，视觉一片花。**正解**：全篇 ≤2 种花纹、≤3 处出现，锚定一个主花纹。
- **反例**：双色条纹两层周期不一致，叠成整片深色看不出条纹。**正解**：双色条纹色块等宽、间隔对齐，才会交错出双色。
- **反例**：用了不兼容的渐变写法做棋盘却忘了垫一层浅实色底，老手机整块变纯色。**正解**：本规范统一用纯色块 + 细边框平铺棋盘，任何内核都稳定，无需兜底。
- **反例**：色带高 200px 又用深色满铺，视觉压迫正文。**正解**：分区强调带 60-100px，深档只用于无文字装饰区域，文字区一律浅档。

## 九、示例（可用骨架，标注可替换处）

**骨架 A · 细斜纹小标题衬底**（科技/通用）：

```html
<div style="width:100%;height:52px;border-radius:8px;margin:0 0 16px;display:flex;align-items:center;justify-content:center;background:rgba(33,102,255,.05);overflow:hidden;position:relative;">
  <div style="position:absolute;top:24px;left:-10%;right:-10%;height:4px;background:rgba(33,102,255,.18);border:1px solid rgba(33,102,255,.35);transform:rotate(45deg);"></div>
  <span style="position:relative;font-size:15px;font-weight:700;color:#1b2a4a;background:#eef3fb;padding:6px 18px;border-radius:6px;">第三章 · 实用技巧</span>
</div>
```
> 可替换处：主色 `rgba(33,102,255,…)`、标题文字与底色 `#1b2a4a`/`#eef3fb`、高度与圆角。

**骨架 B · 波点分区强调带**（校园/轻松）：

```html
<div style="width:100%;height:64px;border-radius:12px;margin:0 0 16px;background:rgba(11,191,143,.04);border:1px solid rgba(11,191,143,.16);display:flex;align-items:center;justify-content:space-around;padding:0 20px;">
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(11,191,143,.26);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(11,191,143,.26);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(11,191,143,.26);"></span>
  <span style="width:10px;height:10px;border-radius:50%;background:rgba(11,191,143,.26);"></span>
</div>
```
> 可替换处：主色 `rgba(11,191,143,…)`、圆点个数与间距、高度。

**骨架 C · 棋盘格小标题衬底**（趣味/极简）：

```html
<div style="width:100%;height:48px;border-radius:8px;margin:0 0 16px;overflow:hidden;display:flex;flex-direction:column;">
  <div style="display:flex;">
    <span style="width:24px;height:24px;background:rgba(51,51,51,.10);border:1px solid rgba(51,51,51,.16);"></span>
    <span style="width:12px;height:24px;"></span>
    <span style="width:24px;height:24px;background:rgba(51,51,51,.10);border:1px solid rgba(51,51,51,.16);"></span>
  </div>
  <div style="display:flex;">
    <span style="width:24px;height:24px;"></span>
    <span style="width:12px;height:24px;"></span>
    <span style="width:24px;height:24px;"></span>
  </div>
</div>
```
> 可替换处：主色 `rgba(51,51,51,.1)`、格尺寸（`24px`）。纯色块 + 边框平铺，任意内核稳定渲染，无需渐变兜底。

**骨架 D · 双色条纹细分隔**（双品牌色活动）：

```html
<div style="width:100%;height:40px;border-radius:6px;margin:0 0 16px;display:flex;gap:8px;">
  <span style="flex:1;background:rgba(33,102,255,.16);border:1px solid rgba(33,102,255,.28);"></span>
  <span style="flex:1;background:rgba(212,76,88,.16);border:1px solid rgba(212,76,88,.28);"></span>
  <span style="flex:1;background:rgba(33,102,255,.16);border:1px solid rgba(33,102,255,.28);"></span>
  <span style="flex:1;background:rgba(212,76,88,.16);border:1px solid rgba(212,76,88,.28);"></span>
</div>
```
> 可替换处：两组 `rgba(...)` 换成两组品牌色；色块等宽、间隔一致才会交错出双色条纹。

## 十、个性化空间（可调参数与判断依据）

- **可调**：花纹类型（斜纹/波点/棋盘/条纹/圆环）、线与块宽、间隔与周期尺寸。**判断依据**：干货与商务用斜纹/细格（克制），宣传与活动用粗斜纹/分段彩条（跳眼）；间隔越大越疏朗，越小越密实。
- **可调**：深浅档（.08 / .12 / .16）。**判断依据**：文字衬底用浅档保可读，无文字装饰区可深档；深浅档改变的是密度，不换配色。
- **可调**：颜色（`rgba(R,G,B,.a)` 三组数字即 RGB）。**判断依据**：花纹主色取品牌主色，辅色只用色板相邻/互补色；颜色数 ≤2。
- **可调**：色带高度与圆角（衬底 36-60px / 分区带 60-100px）。**判断依据**：越高的带越像"正式分区页"，越矮越像"标题衬底"；宣传类可更高更有仪式感。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
