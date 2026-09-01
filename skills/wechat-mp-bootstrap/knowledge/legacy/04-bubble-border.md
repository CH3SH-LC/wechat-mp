# 04｜更优秀的气泡框与边框设计

> 目标平台：微信公众号正文。仅允许 HTML 内联 style（无 `<style>`/`<script>`/伪元素/外链字体）。flex、float、position:absolute、渐变、圆角、box-shadow、border 均可用；图片须为微信 uploadimg URL。
> 基线：主色橙 `#ff6b35` / 青 `#00b8a9` / 紫 `#7a3cec`；块距 16px；行高 1.75。
> 注：气泡模板基于通用排版经验编写，微信具体版本的细节渲染请以真机预览为准。

---

## 一、气泡层次技法

让气泡"浮起来"或"有层次"，核心在 background / box-shadow / border 组合。全部为内联样式。

### 1.1 双层 box-shadow 悬浮

外层 shadow 负责投影，内层 shadow 负责高光，两层叠加做出"悬浮卡片"质感。iOS WKWebView 与 Android X5 对基础 box-shadow（非 inset 混合）支持稳定，避免过多 layer。

```html
<div style="background:#fff;border-radius:14px;padding:16px 16px;
box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.10);
border:1px solid #f0f0f0;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#333;">双层投影：紧贴层 + 弥散层，气泡看起来自然上浮。</p>
</div>
```
适用：正文里的内容聚焦气泡，替代纯白卡片，视觉更"立"。

### 1.2 同色系深浅渐变底

用主色的深→浅渐变做底色，文字用主色的深一档。只有 1 个渐变元素，字体反色风险低、渲染稳。

```html
<div style="background:linear-gradient(135deg,#ff6b35, #ff9a5c);
border-radius:12px;padding:16px 18px;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#fff;font-weight:600;">橙色热血区</p>
  <p style="margin:8px 0 0;line-height:1.75;font-size:14px;color:#fff9f5;">同色系由深到浅，白字清晰、层次顺滑。</p>
</div>
```
适用：品牌号召、行动号召段，色彩强烈、情绪饱满。

### 1.3 描边层次（虚线 / 双线 / 内外双层 border）

单一实线边太"平"。用 border 样式变化制造层次。

- 虚线边：`border:1px dashed #ccc`，适合"未尽事项 / 过渡说明"。
- 双线边：外层实线 + 内层用 box-shadow 模拟第二圈线。
- 内外双层：`outline` 在部分浏览器可额外绘一圈，但**微信内 outline 定位不稳定，改用外层 padding + 内层 border 更稳**。

```html
<div style="border:1px dashed #00b8a9;border-radius:10px;padding:14px 16px;background:#f4fffd;">
  <div style="border:1px solid #00b8a9;border-radius:8px;padding:10px 12px;">
    <p style="margin:0;line-height:1.75;font-size:14px;color:#005a52;">内外双描边：外层虚线 + 内层实线，信息容器更醒目。</p>
  </div>
</div>
```
适用：需要强调"框中之框"层级（如规则内嵌示例）。

### 1.4 角标标签（左上 / 右上小标签）

微信内 `position:absolute` 定位基本可用，但**必须保证父容器有 position:relative**，否则角标会飘到页面级。稳妥备选是负 margin 方案：标签不参与定位，靠 `margin-left:-x` 上移压在边框角上。

**absolute 方案（推荐结构清晰）：**
```html
<div style="position:relative;background:#fff;border:1px solid #eee;border-radius:12px;
padding:16px 18px;margin-top:10px;">
  <div style="position:absolute;top:0;left:0;transform:translateY(-50%);
  background:#7a3cec;color:#fff;font-size:12px;border-radius:6px;
  padding:2px 10px;font-weight:600;">NEW</div>
  <p style="margin:0;line-height:1.75;font-size:15px;color:#333;">角标压在上边框，内容区适当预留顶部空间。</p>
</div>
```
适用：带"标签"属性的卡片（NEW / 更新 / 新品 / 限时）。备用写法：把角标改成普通段落并 `margin-top:-24px;float:right`，兼容性最好但布局需手调。

---

## 二、边框设计

### 2.1 圆角体系

- `4px`：密集数据表、小注、按钮内嵌，利落精致。
- `8px`：默认卡片、提示块，通用平衡。
- `12px`：大段落气泡、推荐卡，柔和。
- `14px`：超大展示卡、封面式引言，最柔。
- 规则：**圆角 ≤ 内容区高度的一半**，避免过度椭圆化；同一视觉组内圆角统一（8 或 12），不混用。

### 2.2 渐变边框（background 双层模拟）

微信不支持 border-image 的稳定渲染，用「外层 padding + 内层白底」模拟渐变边框最可靠。

```html
<div style="background:linear-gradient(135deg,#ff6b35,#7a3cec);
border-radius:14px;padding:2px;">
  <div style="background:#fff;border-radius:12px;padding:14px 16px;">
    <p style="margin:0;line-height:1.75;font-size:15px;color:#333;">外层 2px 渐变当"边框"，内层白底做内容区。</p>
  </div>
</div>
```
适用：品牌双色渐变描边的强调卡，比纯色边更有质感和"高级感"。

### 2.3 特殊形状（旗形 / 标签页形 / 折角）

纯 CSS 特殊形状在微信内有兼容风险，推荐用"可接受的退化"设计——形状退化时仍为方形卡片。

**旗形（上窄下宽横幅）：** 用线性渐变模拟对称梯形。
```html
<div style="background:linear-gradient(135deg,#ff6b35,#ffb347);
border-radius:3px;padding:16px;color:#fff;line-height:1.75;
border-top:4px solid #e0532a;">
  <p style="margin:0;font-size:15px;font-weight:600;">旗形横幅，靠圆角+顶部粗边做出"旗帜头"感。</p>
</div>
```

**标签页形（标签叠在容器上方）：** 标签用渐变底 + 容器用同色 upper 边线，营造"页签已选中"。
```html
<div style="border:1px solid #eee;border-top:3px solid #00b8a9;border-radius:10px;padding:14px 16px;">
  <div style="display:inline-block;background:#00b8a9;color:#fff;font-size:12px;
  border-radius:5px;padding:2px 10px;margin-bottom:8px;">热点</div>
  <p style="margin:0;line-height:1.75;font-size:14px;color:#333;">顶部粗色边 + 同色小标签 = 轻量标签页。</p>
</div>
```

**折角（书角/便签角）：** 真正折角需伪元素/角标图形，微信不稳。**放弃折角，改用「顶角高光」近似**：左上角放一个主色小方块，成本低、不退化。
```html
<div style="background:#fff;border:1px solid #f0f0f0;border-radius:12px;
padding:14px 16px;position:relative;">
  <div style="width:0;height:0;border:10px solid transparent;
  border-top-color:#ff6b35;border-right-color:#ff6b35;
  position:absolute;top:0;right:0;border-radius:0 0 0 6px;"></div>
  <p style="margin:0;line-height:1.75;font-size:14px;color:#333;">右上角三角折角（border 三角），结构简单、稳定。</p>
</div>
```
适用：便签式、注释型内容；三角折角比 true 折角更省且不退化。

---

## 三、语义气泡体系（5 语义 × 2 变体）

统一间距 `padding:14px 16px`、行高 1.75。图标用 Unicode 符号（免外链字体）配合固定颜色。
文字类＝简洁中性、细边浅底；宣传类＝强渐变/实底、醒目。每段末尾附一句适用场景。

### 3.1 提示（info）

**文字类：**
```html
<div style="background:#eef6ff;border-left:3px solid #00b8a9;padding:14px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;line-height:1.75;font-size:14px;color:#1a4a66;">💡 提示：本段为中性说明信息，灰蓝浅底降低干扰。</p>
</div>
```
适用：正文中的中性补充说明、纯信息备注，最常用。
**宣传类：**
```html
<div style="background:linear-gradient(135deg,#00b8a9,#37d5c3);padding:14px 16px;border-radius:10px;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#fff;font-weight:600;">✨ 新知速递</p>
  <p style="margin:6px 0 0;line-height:1.75;font-size:14px;color:#ffffff;">青色渐变强化"updates"的鲜活感。</p>
</div>
```
适用：新品发布、更新动态等想传递"新鲜"情绪的段落。

### 3.2 技巧（tip）

**文字类：**
```html
<div style="background:#fff8e8;border-left:3px solid #ffb347;padding:14px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;line-height:1.75;font-size:14px;color:#7a5800;">🛠 技巧：暖色浅底，偏"实用经验"口吻。</p>
</div>
```
适用：给用户的可执行小技巧、操作建议。
**宣传类：**
```html
<div style="background:linear-gradient(135deg,#ff6b35,#ffb347);padding:14px 16px;border-radius:10px;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#fff;font-weight:600;">🏆 进阶方法</p>
  <p style="margin:6px 0 0;line-height:1.75;font-size:14px;color:#fff7f0;">橙金渐变＝"厉害、值得学"。</p>
</div>
```
适用：全篇中的核心干货/高阶方法，抢注意力。

### 3.3 注意（note）

**文字类：**
```html
<div style="background:#fdf2f2;border-left:3px solid #e0532a;padding:14px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;line-height:1.75;font-size:14px;color:#8a2418;">⚠️ 注意：浅红提示风险或易错点。</p>
</div>
```
适用：转折句、易错点、与告知不同的地方。
**宣传类：**
```html
<div style="background:linear-gradient(135deg,#e0532a,#ff6b35);padding:14px 16px;border-radius:10px;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#fff;font-weight:600;">🚨 请注意</p>
  <p style="margin:6px 0 0;line-height:1.75;font-size:14px;color:#fff3ec;">红橙渐变，务必重视。</p>
</div>
```
适用：必须强调的避坑点或前置条件。

### 3.4 警示（warning）

**文字类：**
```html
<div style="background:#fff2f2;border:1px solid #d33;padding:14px 16px;border-radius:10px;">
  <p style="margin:0;line-height:1.75;font-size:14px;color:#a11;font-weight:600;">⛔ 警示：红边红字，最强阻断感。</p>
</div>
```
适用：明确禁止、合规红线、止损提示。
**宣传类：**
```html
<div style="background:linear-gradient(135deg,#c22,#e0532a);padding:14px 16px;border-radius:10px;border:2px solid #900;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#fff;font-weight:700;">⛔ 立即停止</p>
  <p style="margin:6px 0 0;line-height:1.75;font-size:14px;color:#ffe9e6;">深红实底 + 深色粗边，不可忽略。</p>
</div>
```
适用：高风险、必须立即处理的事项，视觉权重全篇最高。

### 3.5 重点（key）

**文字类：**
```html
<div style="background:#f4f0ff;border-left:4px solid #7a3cec;padding:14px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;line-height:1.75;font-size:15px;color:#4a1f8a;font-weight:600;">🔑 重点：紫色突出全篇核心结论。</p>
</div>
```
适用：文章的中心观点、一句话结论、金句。
**宣传类：**
```html
<div style="background:linear-gradient(135deg,#7a3cec,#a97af0);padding:14px 16px;border-radius:10px;box-shadow:0 6px 18px rgba(122,60,236,0.25);">
  <p style="margin:0;line-height:1.75;font-size:16px;color:#fff;font-weight:700;">💎 核心结论</p>
  <p style="margin:6px 0 0;line-height:1.75;font-size:14px;color:#f4efff;">紫渐变 + 同色投影，压轴强调。</p>
</div>
```
适用：全文收尾、埋点转化处的核心价值陈述。

---

## 四、微信兼容性清单

### 4.1 建议使用（iOS WKWebView 与 Android X5 均稳定）

- `background` / `linear-gradient`：单方向渐变或 `135deg` 双色，稳定。
- `border` 1px 实线/虚线、`border-radius`（4/8/12/14）。
- `box-shadow`：基础 `0 x y rgba` 投影；单层或双层均可用。
- `padding` / `margin` / `line-height:1.75` / `font-size`。
- `position:absolute` ＋ 父级 `position:relative`：结构化定位可用。
- `display:inline-block` / `block` / `flex`（简单的行内 flex）。
- `float`：简单图文绕排可用。
- 背景双层模拟渐变边框（外层 padding + 内层底）——最稳方案。

### 4.2 谨慎使用 / 避免

- **超大模糊投影**：`box-shadow` 的 `blur` 过大（>40px）或 layer 过多，X5 偶发渲染迟缓/掉层。
- **过多 inset**：多层 `box-shadow inset` 在部分 X5 版本出现锯齿或错位，避免堆叠。
- **依赖 backdrop-filter**：微信内基本不生效或引发整块变白，**禁用**。
- **border-image / outline**：定位与缩放不稳，改用双层背景或 border 实线替代。
- **依赖伪元素（::before/::after）**：正文编辑器大多剥除，特殊形状一律降级为方块/三角。
- **position:fixed / sticky**：浮层易被顶栏/底栏遮挡，尽量避免。
- **超大圆角 > 容器高度一半**：视觉怪、且在部分 WebView 圆角失效变直角。

> 通用兜底：任何一种装饰沦为"锦上添花"时优先保留纯色背景 + 实线边框 + 圆角组合；保证装饰失效后内容仍可读、仍成块。
