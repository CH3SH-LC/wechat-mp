# 14 · 花纹图案库（CSS 可实现的装饰花纹）

> 平台约束：仅 HTML 内联 style；全部图案用 CSS 渐变实现（repeating-linear-gradient / repeating-radial-gradient / radial-gradient + background-size / 多背景叠加）；如需真实图片一律用 `uploadimg` URL。
> 说明：花纹色带支持 **斜纹（45deg）** 与 **波点** 两种基础纹样；本文件为更多花纹的扩展库，并统一给出深浅两档透明度示例。
> 通用透明度约定：浅档 = `rgba(色, .08)`，深档 = `rgba(色, .16)`。正文衬底默认用浅档（≤.15 保文字可读），色块/页眉装饰可用深档。

---

## 0. 使用总则（先读）

- **一条花纹 = 一段完整 `background` 值**，直接放进元素的 `style="..."` 即可。图示统一为：

  ```
  <div style="width:100%;height:80px;border-radius:8px; <background值>"></div>
  ```

- 每个图案给 `浅档` 与 `深档` 两档透明度，色板配对时把下文的 `主色#` 按需求替换（示例用 `主色 #2777ff` 蓝、`辅色 #8a2be2` 紫、`强调 #e6550d` 橙、`中性 #333` 灰）。
- **色板搭配通则**：花纹主色取色板中的主品牌色；花纹辅色/对比色只用色板内相邻或互补色，颜色数 ≤2；深浅档控制的是**视觉密度**而非颜色本身。
- 所有值可直接粘进 inline style；注释性说明标在 `/* */` 外，不含在直接粘贴的 CSS 值里。

---

## 1. 斜纹家族

### 1.1 细斜纹（45deg 细线）— 已有 band 斜纹的独立色版
细密平行线，最百搭，适合栏目衬底、标题行分隔。
```css
background:repeating-linear-gradient(45deg,
  rgba(220,39,39,.08) 0 6px,
  transparent 6px 16px);
```
```css
background:repeating-linear-gradient(45deg,
  rgba(220,39,39,.16) 0 6px,
  transparent 6px 16px);
```
- 适用：正文卡片底纹、标题衬底、色带内叠纹理。
- 色板：主品牌色即可，单色不发闷。
- 调节：`6px`（线宽）/`16px`（间距）成对改，线宽越大视觉越"粗"。

### 1.2 粗斜纹（宽幅斜带）
宽斜带，装饰性强，适合页眉、横幅、分区色带。
```css
background:repeating-linear-gradient(45deg,
  rgba(230,85,13,.08) 0 24px,
  rgba(255,255,255,0) 24px 56px);
```
```css
background:repeating-linear-gradient(45deg,
  rgba(230,85,13,.16) 0 24px,
  rgba(255,255,255,0) 24px 56px);
```
- 适用：页眉色带、分隔横幅、活动头图衬底。
- 色板：搭配浅色背景时用透明间隔；若底色非白，把 `rgba(255,255,255,0)` 换成 `rgba(底色,.9)` 防叠色发灰。

### 1.3 双色交叉斜纹（编织感）
两组 45deg/-45deg 斜线叠加模拟编织，层次感强。适合工艺/手作/强主题文章。
```css
background:
  repeating-linear-gradient(45deg,rgba(39,119,255,.08) 0 16px,transparent 16px 32px),
  repeating-linear-gradient(-45deg,rgba(39,119,255,.08) 0 16px,transparent 16px 32px);
```
```css
background:
  repeating-linear-gradient(45deg,rgba(39,119,255,.16) 0 16px,transparent 16px 32px),
  repeating-linear-gradient(-45deg,rgba(39,119,255,.16) 0 16px,transparent 16px 32px);
```
- 适用：手作/织物/非遗主题卡、工艺流程节标题。
- 色板：双色更佳——把两组线分别用主色与辅淡色：
  ```css
  background:
    repeating-linear-gradient(45deg,rgba(39,119,255,.12) 0 16px,transparent 16px 32px),
    repeating-linear-gradient(-45deg,rgba(138,43,226,.12) 0 16px,transparent 16px 32px);
  ```
- 提示：两组不同色需控制总密度，双线叠加处明显变深，是预期的"编织交叠"效果。

---

## 2. 点阵家族

### 2.1 圆点阵
均匀圆点，温和、适用广，是"波点"色带的可调密度版本。
```css
background:
  radial-gradient(circle at 24px 24px,rgba(39,119,255,.08) 6px,transparent 7px) 0 0 / 48px 48px;
```
```css
background:
  radial-gradient(circle at 24px 24px,rgba(39,119,255,.16) 6px,transparent 7px) 0 0 / 48px 48px;
```
- 适用：正文点缀、儿童/轻松主题卡片底、色带纹理。
- 色板：单色即可，可用低饱和主色做衬底。

### 2.2 双层点阵（大小点错落）
大点+小点错位嵌套（背景位移 1/2 周期），活泼有节奏。适合年轻化、活动物料。
```css
background:
  radial-gradient(circle at 24px 24px,rgba(138,43,226,.08) 5px,transparent 6px) 0 0 / 48px 48px,
  radial-gradient(circle at 0 0,rgba(39,119,255,.08) 2px,transparent 3px) 0 0 / 24px 24px;
```
```css
background:
  radial-gradient(circle at 24px 24px,rgba(138,43,226,.16) 5px,transparent 6px) 0 0 / 48px 48px,
  radial-gradient(circle at 0 0,rgba(39,119,255,.16) 2px,transparent 3px) 0 0 / 24px 24px;
```
- 关键点：第二层 `circle at 0 0` + 更小周期 `24px`，正好落在大点之间，形成大小错落。
- 适用：活动海报正文、趣味栏目分隔、儿童科普。
- 色板：建议双色（一组浅一色每组点），避免三层以上。

### 2.3 菱形点阵
用方块 `rotate(45deg)` 出菱形感，或用方形渐变模拟。几何感、偏正式。
```css
background:
  linear-gradient(45deg,transparent 0,rgba(51,51,51,0) 25%,rgba(51,51,51,.08) 26% 74%,rgba(51,51,51,0) 75%),
  linear-gradient(-45deg,transparent 0,rgba(51,51,51,0) 25%,rgba(51,51,51,.08) 26% 74%,rgba(51,51,51,0) 75%) 0 0 / 48px 48px;
```
```css
background:
  linear-gradient(45deg,transparent 0,rgba(51,51,51,0) 25%,rgba(51,51,51,.16) 26% 74%,rgba(51,51,51,0) 75%),
  linear-gradient(-45deg,transparent 0,rgba(51,51,51,0) 25%,rgba(51,51,51,.16) 26% 74%,rgba(51,51,51,0) 75%) 0 0 / 48px 48px;
```
- 原理：两组 ±45deg 窄色带叠加出菱形交点，形成规律菱形格。
- 适用：科技/金融/建筑主题、版块衬底、数据分隔。
- 色板：中性色+主色，克制使用。

---

## 3. 棋盘格

### 3.1 双色棋盘
两组 45deg 渐变错位叠加成经典棋盘。趣味、辨识度高。
```css
background:
  conic-gradient(from 0deg at 50% 50%,transparent 0 90deg,rgba(39,119,255,.08) 90deg 180deg) 0 0 / 48px 48px;
```
```css
background:
  conic-gradient(from 0deg at 50% 50%,transparent 0 90deg,rgba(39,119,255,.16) 90deg 180deg) 0 0 / 48px 48px;
```
- 说明：conic 四等分最省事；若需兼容老内核，用下面"两组线性渐变叠加"等价写法：
  ```css
  background:
    linear-gradient(45deg,rgba(39,119,255,.08) 25%,transparent 25% 75%,rgba(39,119,255,.08) 75%),
    linear-gradient(45deg,transparent 25%,rgba(39,119,255,.08) 25% 75%,transparent 75%) 0 0 / 48px 48px,
    transparent 0 0 / 48px 48px;
  ```
- 适用：游戏/极客/轻互动主题、卡片底、装饰按钮。
- 色板：单主色即可；可做双色（把另一组渐变换成辅色）。

### 3.2 细格纹（方格纸）
细横线+细竖线叠加，类似方格纸。适合清单、代码/学习笔记、科技极简。
```css
background:
  repeating-linear-gradient(0deg,rgba(51,51,51,.08) 0 1px,transparent 1px 24px),
  repeating-linear-gradient(90deg,rgba(51,51,51,.08) 0 1px,transparent 1px 24px);
```
```css
background:
  repeating-linear-gradient(0deg,rgba(51,51,51,.16) 0 1px,transparent 1px 24px),
  repeating-linear-gradient(90deg,rgba(51,51,51,.16) 0 1px,transparent 1px 24px);
```
- 适用：学习/手账/清单正文衬底、代码片段背景、日程卡。
- 色板：中性灰最贴"纸感"，也可用极浅主色做"网格纸"。

---

## 4. 条纹家族

### 4.1 竖条纹
```css
background:repeating-linear-gradient(90deg,rgba(39,119,255,.08) 0 8px,transparent 8px 20px);
```
```css
background:repeating-linear-gradient(90deg,rgba(39,119,255,.16) 0 8px,transparent 8px 20px);
```
- 适用：侧栏标注、分区垂直分隔感、榜单条背景。

### 4.2 横条纹
```css
background:repeating-linear-gradient(180deg,rgba(39,119,255,.08) 0 8px,transparent 8px 20px);
```
```css
background:repeating-linear-gradient(180deg,rgba(39,119,255,.16) 0 8px,transparent 8px 20px);
```
- 适用：水平节奏、上下分段装饰、进度式背景。

### 4.3 双色条纹
两组同向条纹轴心错位，形成双色间隔条。
```css
background:
  repeating-linear-gradient(90deg,rgba(39,119,255,.08) 0 20px,transparent 20px 40px),
  repeating-linear-gradient(90deg,rgba(138,43,226,.08) 0 20px,transparent 20px 40px);
```
```css
background:
  repeating-linear-gradient(90deg,rgba(39,119,255,.16) 0 20px,transparent 20px 40px),
  repeating-linear-gradient(90deg,rgba(138,43,226,.16) 0 20px,transparent 20px 40px);
```
- 提示：两层周期必须一致且轴线错半周期 `20px`，才会交错成双色；否则叠在同位置。
- 适用：双品牌色文章、活动分区、信息并列条。

### 4.4 分段色块条（多 stop）
一条渐变多个 stop 出多段色块，模拟"分段轴"或装饰彩条。
```css
background:repeating-linear-gradient(90deg,
  rgba(39,119,255,.08) 0 12px,
  rgba(255,255,255,0) 12px 18px,
  rgba(230,85,13,.08) 18px 30px,
  rgba(255,255,255,0) 30px 36px,
  rgba(138,43,226,.08) 36px 48px,
  rgba(255,255,255,0) 48px 54px);
```
```css
background:repeating-linear-gradient(90deg,
  rgba(39,119,255,.16) 0 12px,
  rgba(255,255,255,0) 12px 18px,
  rgba(230,85,13,.16) 18px 30px,
  rgba(255,255,255,0) 30px 36px,
  rgba(138,43,226,.16) 36px 48px,
  rgba(255,255,255,0) 48px 54px);
```
- 周期 = 54px，每个色块 12px + 间隔 6px。可自行增删 stop。
- 适用：多色品牌色带、节日彩条、进度分区。

---

## 5. 高级花纹

### 5.1 鱼鳞 / 圆环
放射渐变圆环，靠 `background-size` 错位出鳞片叠加感。
```css
background:
  radial-gradient(circle at 50% 100%,rgba(39,119,255,0) 8px,rgba(39,119,255,.08) 9px 18px,transparent 19px) 0 0 / 40px 20px;
```
```css
background:
  radial-gradient(circle at 50% 100%,rgba(39,119,255,0) 8px,rgba(39,119,255,.16) 9px 18px,transparent 19px) 0 0 / 40px 20px;
```
- 说明：椭圆周期高度减半 `20px`，圆环错落成鳞片排布。竖向排布更出鳞感。
- 适用：海洋/生物/自然主题、品牌故事节标题衬底。

### 5.2 波浪线
相邻重复径向左右错位（轴心偏移 + 错开半个周期）形成连绵波浪。
```css
background:
  repeating-radial-gradient(circle at 0 50%,transparent 0 14px,rgba(39,119,255,.08) 15px 16px,transparent 17px 30px) 0 0 / 60px 30px;
```
```css
background:
  repeating-radial-gradient(circle at 0 50%,transparent 0 14px,rgba(39,119,255,.16) 15px 16px,transparent 17px 30px) 0 0 / 60px 30px;
```
- 关键点：`repeating-radial-gradient(circle at 0 50%, ...)` + 半周期负向错位 `0 0` 配周期宽的缩放，让圆环沿水平连续成波。
- 适用：水/柔/女性化主题、动态感页眉、引言衬底。

### 5.3 星芒 / 放射（conic-gradient，注意兼容性）
用 conic 分段做轮辐放射。**兼容性**：CSS conic-gradient 需 Chrome 69+/Safari 12.1+/Firefox 83+，微信 iOS/Android 内核一般可用，但老安卓内核可能降级为纯色——**使用时应同时给一层浅底色兜底**。
```css
background:conic-gradient(
  from 0deg,
  rgba(230,85,13,.08) 0 12deg,transparent 12deg 60deg,
  rgba(230,85,13,.08) 60deg 72deg,transparent 72deg 120deg);
```
```css
background:conic-gradient(
  from 0deg,
  rgba(230,85,13,.16) 0 12deg,transparent 12deg 60deg,
  rgba(230,85,13,.16) 60deg 72deg,transparent 72deg 120deg);
```
- 兜底写法（先铺底色再叠星芒，内核不支持 conic 时仍见浅底色）：
  ```css
  background:linear-gradient(45deg,rgba(230,85,13,.04),rgba(230,85,13,.08)) , conic-gradient(...);
  ```
- 适用：能量/颁奖/激励主题、横幅装饰、高亮图标。

### 5.4 大理石（多 radial 随机色）
多组不同位置色斑 radial 叠加，模拟云纹/纹理流动。
```css
background:
  radial-gradient(ellipse at 20% 30%,rgba(39,119,255,.08) 0 24%,transparent 55%),
  radial-gradient(ellipse at 70% 60%,rgba(138,43,226,.08) 0 30%,transparent 60%),
  radial-gradient(ellipse at 45% 85%,rgba(230,85,13,.08) 0 22%,transparent 50%) ;
```
```css
background:
  radial-gradient(ellipse at 20% 30%,rgba(39,119,255,.16) 0 24%,transparent 55%),
  radial-gradient(ellipse at 70% 60%,rgba(138,43,226,.16) 0 30%,transparent 60%),
  radial-gradient(ellipse at 45% 85%,rgba(230,85,13,.16) 0 22%,transparent 50%) ;
```
- 无法全景平铺（渐变大色斑本身不规则），更适合单块装饰元素而非满幅背景。
- 适用：画册风封面、艺术引言卡、文字局部衬底。

---

## 6. 用法建议

### 6.1 花纹背景适用场景速查
| 场景 | 推荐图案 | 档位 |
|---|---|---|
| 正文全文衬底 | 细斜纹 / 细格纹 / 圆点阵 | 浅档（.08） |
| 页眉色带 | 粗斜纹 / 横条纹 / 分段色块 | 浅~中档 |
| 卡片底色 | 圆点阵 / 双色条纹 / 星芒 | 浅档（.08） |
| 标题衬底 | 细斜纹 / 波浪线 / 鱼鳞 | 浅档，字下方留白 |
| 醒目横幅/CTA | 粗斜纹 / 多色条 / 星芒 | 中~深档（.16） |
| 趣味/轻主题点缀 | 棋盘格 / 双层点阵 / 大理石 | 浅档局部使用 |

### 6.2 花纹与文字对比度
- **文字可读是硬底线**：正文衬底花纹透明度 **≤0.15**（推荐 `.08`）；背景纹只作"质感"，不许压字。
- 深档（.16）仅用于：无文字区域、纯装饰块、或者与文字之间隔一层实心浅色底（两层背景叠加时文字放上层实心层）。
- 花纹 + 字数：衬底花纹只建议 3 行内正文使用，长段落一律用纯色或 ≤.08 细纹。
- 避免高饱和花纹垫深底文字；如需深底，花纹用同色更亮/更浅的 alpha 提亮度。

### 6.3 篇内用量控制
- **每篇 ≤2 种花纹**，且最多 2~3 处出现，保持克制与一致性。
- 文章锚定 1 个"主花纹"贯穿（如斜纹家族），另一个"点缀花纹"只在页眉/CTA 出现一次。
- 同类家族统一用（斜纹三款同属"斜纹"语言），避免 6 种杂糅显花哨。
- 装饰密度越高，越要用浅档+大间距对冲；视觉噪音参考线：正文衬底花纹整体亮度对比 ≤12%。

### 6.4 与内置花纹的配合
`::: band` 花纹色带支持斜纹（45deg）与波点两种基础纹样；本库第 1 组（细/粗斜纹）与第 2.1（圆点阵）可作同款纹样的疏密调节参考，其余图案按需选用或独立做纹样。真图一律 `uploadimg` URL，本库全部 CSS 无需图片。

---

## 附：通用调参口诀
- 间隔/周期：改数字对（线宽/间距 或 `px px`）→ 改变花纹疏密。
- 深浅：改 alpha（`.08` ↔ `.16`）→ 不改配色只改密度。
- 颜色：替换 `rgba(...)` 的第一组数字为色板色（R,G,B）→ 整库任意换色。
- 方向：`45deg/-45deg/90deg/180deg/0deg` 互切 → 斜横竖直互换。
- 双层叠加：第二层 `0 0 / <尺寸>` 位移错半周期 → 出交错/嵌套效果。
