# 03 微信公众号：复杂标题结构（居中标题左右加特殊图案装饰）

> 平台约束：仅允许 HTML 内联样式（无 `<style>`/`<script>`/伪元素/外链字体）；可用 flex、float、position:absolute、渐变、圆角、transform:rotate；图片须为微信 uploadimg URL。
> 全部装饰均由 `<span>` 拼装（无伪元素）。正文容器预设宽度 677px（微信正文区）。
> 说明：模板尺寸基于微信兼容性经验编写，粘贴前请在图文编辑器预览一次。

---

## 一、居中标题 + 左右对称装饰：纯 CSS 方案

### 公共结构说明
- 标题杆一行内做：装饰段 → 文字 → 装饰段，用 `display:inline-block`/浮动使左右对称。
- 因微信会吞部分空行与外层边距，每段 span 自己带 margin，并在最外容器用 `text-align:center`。
- 677px 宽度下：左右装饰段各占约 100–160px，中间文字保持 1–2 行 20–22px，整体视觉均衡。

---

### 方案 A｜渐变线 + 菱形 / 圆点组合（适用：正式、编辑部、品牌栏目）

**原理**：左右各一段 `linear-gradient` 细线作为底；线上再浮置 1 个菱形 + 2 个圆点。菱形用 `transform:rotate(45deg)` 得到，圆点用高圆角 span。

```html
<section style="text-align:center;margin:26px 0 14px;">
  <span style="display:inline-block;vertical-align:middle;margin-right:10px;">
    <span style="display:block;width:110px;height:2px;background:linear-gradient(to left,#c9a063,#e6d5b0);"></span>
    <span style="display:inline-block;margin-top:-4px;">
      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#c9a063;margin:0 3px;"></span>
      <span style="display:inline-block;width:10px;height:10px;background:#c9a063;transform:rotate(45deg);border-radius:1px;vertical-align:middle;"></span>
      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#c9a063;margin:0 3px;"></span>
    </span>
  </span>
  <span style="display:inline-block;vertical-align:middle;font-size:22px;letter-spacing:4px;color:#8a6d3b;font-weight:bold;">本期主题</span>
  <span style="display:inline-block;vertical-align:middle;margin-left:10px;">
    <span style="display:block;width:110px;height:2px;background:linear-gradient(to right,#c9a063,#e6d5b0);"></span>
    <span style="display:inline-block;margin-top:-4px;">
      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#c9a063;margin:0 3px;"></span>
      <span style="display:inline-block;width:10px;height:10px;background:#c9a063;transform:rotate(45deg);border-radius:1px;vertical-align:middle;"></span>
      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#c9a063;margin:0 3px;"></span>
    </span>
  </span>
</section>
```

- 尺寸建议（677px）：左右线宽各 **110px、高 2px**；圆点 **5×5px**、菱形 **10×10px**，间距 3px；标题字 **22px、字距 4px**，整行总宽约 330–360px，居中留白充足。
- 兼容注意：`linear-gradient` 在微信 iOS/安卓均正常；注意菱形靠 `rotate` 后会留 1px 白边，可加 `border-radius:1px` 减弱棱角反锯齿。

---

### 方案 B｜花括号形 {  }（适用：深度、观点、专栏、开篇）

**原理**：用两组带内凹效果 span 拼出左右括号。括号本体用上下两段细线 + 垂直短竖，靠 float/负 margin 对齐；下方渲染括号视觉。

```html
<section style="text-align:center;margin:26px 0 14px;">
  <span style="display:inline-block;vertical-align:middle;height:34px;margin-right:10px;">
    <span style="display:block;width:2px;height:14px;background:#5a6b8c;margin-left:6px;"></span>
    <span style="display:block;width:14px;height:2px;background:#5a6b8c;margin:-1px 0 0 0;"></span>
    <span style="display:block;width:2px;height:14px;background:#5a6b8c;margin-left:6px;"></span>
  </span>
  <span style="display:inline-block;vertical-align:middle;font-size:22px;letter-spacing:3px;color:#5a6b8c;font-weight:bold;">深度 · 观点</span>
  <span style="display:inline-block;vertical-align:middle;height:34px;margin-left:10px;">
    <span style="display:block;width:2px;height:14px;background:#5a6b8c;"></span>
    <span style="display:block;width:14px;height:2px;background:#5a6b8c;margin:-1px 0 0 0;float:right;overflow:hidden;"></span>
    <span style="display:block;width:2px;height:14px;background:#5a6b8c;float:right;"></span>
  </span>
</section>
```

- 尺寸建议（677px）：括号总高 **34px**，竖条 **宽 2px、高 14px** 各两段，横条 **宽 14px、高 2px** 居中连接；标题字 **22px**；左右括号对称内缩于文字两侧留白 10px。
- 兼容注意：右侧括号用 `float:right` 对齐易受文字宽度影响，建议先放文字再放右括号以保证对称；若右括号偏移，可固定容器 `width`（如 320px）并 `margin:0 auto`。

---

### 方案 C｜星形 ✳（适用：奖项、惊喜、品牌活动、节日）

**原理**：左右各一组星形字符/旋转方块的集合。最稳妥用 Unicode 星号字符（✦ ✧ ✳ ★）由 span 承载，不依赖图片；若用图形星，则用 rotate 方块拼。

```html
<section style="text-align:center;margin:26px 0 14px;color:#b8860b;">
  <span style="display:inline-block;vertical-align:middle;font-size:16px;letter-spacing:4px;margin-right:12px;">✧ ✦ ✳</span>
  <span style="display:inline-block;vertical-align:middle;font-size:22px;letter-spacing:3px;color:#8a6d3b;font-weight:bold;">年中好礼清单</span>
  <span style="display:inline-block;vertical-align:middle;font-size:16px;letter-spacing:4px;margin-left:12px;">✳ ✦ ✧</span>
</section>
```

- 尺寸建议（677px）：左右星组字号 **16px、字距 4px、margin 12px**；中间标题 **22px**；星与文字水平中间对齐，整行约 300px。
- 兼容注意：Unicode 星在不同系统机字号显示略有差异，iOS/安卓均可见但存在风格差异；若需统一观感，改用内联图片（uploadimg URL）拼星形。

---

## 二、两侧框线标题（左右横线 + 中间文字）

**适用**：常规栏目、章节分隔、需要稳定严谨的标题带。

```html
<section style="display:flex;align-items:center;margin:26px 0 14px;justify-content:center;">
  <span style="flex:1;height:1px;background:#cfcfcf;margin-right:14px;"></span>
  <span style="font-size:20px;color:#333333;letter-spacing:2px;font-weight:bold;white-space:nowrap;">章节导读</span>
  <span style="flex:1;height:1px;background:#cfcfcf;margin-left:14px;"></span>
</section>
```

- 尺寸建议（677px）：左右横线用 `flex:1` 自适应平分剩余宽度（各约 270px）、**高 1px、浅灰 #cfcfcf**；标题白 `white-space:nowrap` 防止换行；标题字号 20px、字距 2px。
- 兼容注意：`display:flex` 在微信 iOS/安卓渲染正常；但部分安卓旧内核不识别 `flex:1` 简写，可写成 `flex:1 1 auto;width:1%;`；若文字过长自动换行，先缩减标题字数。

---

## 三、胶囊 / 旗形 / 丝带角标标题、双层描边标题、emoji+文字标题

### 3.1 胶囊 / 旗形角标标题（适用：专题 Banner、活动导览）

```html
<section style="text-align:center;margin:24px 0 12px;">
  <span style="display:inline-block;background:#e2574c;color:#ffffff;font-size:16px;letter-spacing:3px;padding:8px 20px;border-radius:22px;font-weight:bold;">限时特辑</span>
</section>
```

- 兼容注意：`border-radius:22px`（圆角胶囊）+ 单一实色最稳；底部可再接一条任意背景的横条营造"旗形"，但旗形要锯齿缺角需图片，故微信内以圆角矩形容器 + 底部实色横杠近似。

```html
<!-- 旗形近似：胶囊顶部 + 下方实色短旗尾 -->
<section style="text-align:center;margin:24px 0 12px;">
  <span style="display:inline-block;">
    <span style="display:block;background:#e2574c;color:#ffffff;font-size:16px;letter-spacing:3px;padding:8px 20px;border-radius:22px;font-weight:bold;">限时特辑</span>
    <span style="display:block;width:60%;height:18px;background:#e2574c;margin:0 auto;"></span>
  </span>
</section>
```

- 兼容注意：旗尾的锯齿缺角无法用 CSS 伪元素裁切（无伪元素），只能以实色短矩形近似；如需真实旗形，上传一张纯色旗形 PNG（uploadimg URL）直接作背景/图片。

### 3.2 双层描边标题（适用：文案型大标题、强调核心句）

```html
<section style="text-align:center;margin:24px 0 12px;color:#ffffff;text-shadow:2px 0 0 #8a6d3b,-2px 0 0 #8a6d3b,0 2px 0 #8a6d3b,0 -2px 0 #8a6d3b;">
  <span style="display:inline-block;font-size:26px;font-weight:bold;letter-spacing:6px;background:#f7f1e6;padding:4px 16px;">匠心 · 坚守</span>
</section>
```

- 尺寸建议（677px）：标题字号 **26px、字距 6px**；描边用 `text-shadow` 四方向 **偏移 2px、0 模糊、颜色 #8a6d3b**，制造双色描边轮廓。
- 兼容注意：微信 iOS 对 `text-shadow` 支持好，安卓部分旧内核阴影偏淡；背景色块（#f7f1e6）+ 描边组合可强化层次；不要依赖负值模糊，微信不支持 blur 描边的理想效果。

### 3.3 emoji + 文字标题（适用：轻松、生活、美食、亲子）

```html
<section style="text-align:center;margin:22px 0 12px;">
  <span style="font-size:22px;letter-spacing:2px;font-weight:bold;color:#444444;">🍲 温暖的一人食 🍲</span>
</section>
```

- 兼容注意：emoji 用系统字体直接渲染，无需图片；iOS/安卓显示表情略有差异（苹果彩绘 vs 系统彩绘），排版上给 emoji 与文字间留空格、并用 `letter-spacing` 微调即可；不建议 emoji 与 strikethrough/外链字体混用（微信不支持外链字体）。

---

## 四、文章开头页眉区完整模板

**适用**：文章首图位置的文字页眉——居中大标题 + 上下装饰线 + 副标题 + 日期作者行。

```html
<section style="text-align:center;padding:30px 20px 20px;margin:0 0 8px;background:linear-gradient(to bottom,#f7f1e6,#ffffff);">
  <!-- 上装饰线：渐变 + 菱形 -->
  <section style="margin-bottom:16px;">
    <span style="display:inline-block;vertical-align:middle;width:70px;height:1px;background:#c9a063;"></span>
    <span style="display:inline-block;vertical-align:middle;width:8px;height:8px;background:#c9a063;transform:rotate(45deg);margin:0 8px;"></span>
    <span style="display:inline-block;vertical-align:middle;width:70px;height:1px;background:#c9a063;"></span>
  </section>
  <!-- 大标题 -->
  <section style="margin-bottom:10px;">
    <span style="display:inline-block;font-size:30px;font-weight:bold;letter-spacing:4px;color:#8a6d3b;line-height:1.4;">每一份用心，都值得<br/>被看见</span>
  </section>
  <!-- 副标题 -->
  <section style="margin-bottom:14px;">
    <span style="display:inline-block;font-size:15px;color:#a08d6a;letter-spacing:2px;">关于坚持这件事，我们聊了很多</span>
  </section>
  <!-- 下装饰线 -->
  <section style="margin-bottom:16px;">
    <span style="display:inline-block;vertical-align:middle;width:70px;height:1px;background:#c9a063;"></span>
    <span style="display:inline-block;vertical-align:middle;width:8px;height:8px;background:#c9a063;transform:rotate(45deg);margin:0 8px;"></span>
    <span style="display:inline-block;vertical-align:middle;width:70px;height:1px;background:#c9a063;"></span>
  </section>
  <!-- 日期作者行 -->
  <section>
    <span style="display:inline-block;font-size:13px;color:#b0a189;letter-spacing:1px;">（年份）年（月份）月 · 撰文 / （署名）</span>
  </section>
</section>
```

- 尺寸建议（677px）：页眉内边距 **上下 30/20 + 左右 20px**；大标题 **30px、字距 4px、行高 1.4**；装饰线 **70px 长、1px 高**，菱形 **8×8px**；副标题 **15px**、日期行 **13px**；上装饰线下 / 标题下 / 副标题下间距依次 16 / 10 / 14px。
- 兼容注意：`linear-gradient` 背景温和可用；若标题跨行用 `<br/>` 而非自动折行，避免字距导致断行位置难看；整块背景渐变在安卓旧内核可能退化为纯色，属可接受降级。

---

## 五、装饰克制原则

1. **数量克制**：一个标题版面最多 **1 种装饰主元素**（线、星、花括号、角标四选一），其余用小号元素（圆点/菱形）点缀；装饰段总宽控制在 160px 内，避免喧宾夺主。
2. **色彩协调**：装饰色与主色同系或取主色的浅一阶（如金色系 #c9a063 配 #8a6d3b 标题），最多 **2 个强调色**；切忌装饰色与正文色冲突。
3. **层级与间距**：标题与正文之间的垂直节奏固定——标题上方留白 **28px**、标题下方与正文间距 **12px**，保证视觉层级清晰、不粘连。
4. **对齐原则**：左右装饰必须严格对称（等宽线段、等宽色块、等字距），手机与桌面两档宽度各检查一次对称性。
5. **克制 check list**：装饰不压文字、装饰不清越正文、一屏装饰元素 ≤3 处；定稿前在微信图文编辑器真实预览一次。

---
