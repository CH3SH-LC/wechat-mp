# 微信公众号图文混排：多样插入图片的落地知识文件

> 主题：在微信公众号正文中多样地插入图片（图文混排）
> 说明：以下图文混排模板为微信排版通用方案，可直接套用；关键兼容细节建议在微信编辑器/真机预览确认。
> 基线：图片默认 `max-width:100%`、圆角 8px、上下边距 12px
> 平台约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体；flex、float、position、渐变、圆角、box-shadow 均可用；图片必须是微信 uploadimg URL（jpg/png ≤1MB），宽度建议 ≤677px 内容区。

---

## 0. 先读：本文件的通用铁律

1. **图片永远允许缩放，不允许横向溢出。** 微信正文内容区桌面端约 677px、手机端约 100% 视口宽 — 120px（左右各 60px 边距）。任何图片容器都写 `max-width:100%; width:100%; height:auto; display:block;`，**绝不用固定 px 宽度**，否则小屏直接溢出或破版。
2. **圆角与描边要写在图片的父容器上，而不是只写在 `<img>` 上。** 部分微信客户端对 `<img>` 自身 `border-radius` + `overflow:hidden` 失效，稳妥做法是外包装一个 `div`（自带 `border-radius; overflow:hidden;`）再塞 `<img>`，图片填满容器。
3. **间距用块级容器 + margin，不要用 `<br>` 堆空行。** `<br>` 在不同字号下行高不同，间距不可控；统一用 `margin` 控制才算"设计"。
4. **不要给图片用固定像素高度**（除特写裁切场景），只用宽度 + `height:auto` 保持比例。
5. **图内文字（绝对定位叠加在 img 之上）在微信端不可靠**，一律改用"图片 + 独立标题条分段"的安全方案（见模板 4）。
6. **图片务必用微信编辑器图片（uploadimg URL）上传**，本地相对路径/`data:image`/外链 CDN 在正文发布后统统失效。上传后微信会自动把超宽图压缩到约 677px；**原始图建议 ≥1080px 宽**（手机 DPR 2~3），这样压缩后依旧锐利。

---

## 1. 图文混排模式

### 模板 1：左图右文（flex 版）——推荐

两列均随容器缩放，手机端满宽显示，最稳。用 `flex` 而非 `float`，因为 flex 在容器 `width:100%` 时天然不溢出；`float` 方案见模板 2 作备选。

```html
<div style="width:100%; display:flex; align-items:flex-start; gap:14px;">
  <div style="flex:0 0 40%; max-width:40%; border-radius:8px; overflow:hidden;">
    <img src="微信uploadimg地址" style="width:100%; height:auto; display:block;">
  </div>
  <div style="flex:1 1 auto; min-width:0;">
    <p style="font-size:15px; color:#333; line-height:1.7; margin:0 0 8px;">这是配图旁的说明文字标题</p>
    <p style="font-size:13px; color:#777; line-height:1.65; margin:0;">用于放补充说明、产品参数、一句话观点等，左图右文的阅读路径是"先看图，再读文"。</p>
  </div>
</div>
<div style="clear:both; height:14px;"></div>
```

- **适用场景**：产品对比、步骤配图、短文案 + 图的卡片式排布、截图配简介。
- **微信兼容性**：flex 在 iOS/Android 微信 WebView 与安卓内置浏览器均支持良好。注意给文字列加 `min-width:0` 防长英文/长链接撑破。图/文比例 40/60 或 45/55 视觉较稳；图列用 `flex:0 0 40%` 锁定比例，避免手机端被压缩变形。

### 模板 2：左图右文（float 版）——备选/兼容旧设备

`float` 方案在无 flex 的老旧 WebView 也能工作，但需在父容器上勤加 `clear`。**注意：移动端横图 + float 容易导致文字不换行溢出，建议 float 图宽 ≤45%。**

```html
<div style="width:100%;">
  <img src="微信uploadimg地址" style="float:left; width:42%; margin:0 14px 8px 0; border-radius:8px;">
  <p style="font-size:14px; color:#555; line-height:1.7; margin:0;">
    浮动在文字左侧的图片示例。图片使用 float:left，文字从图片右侧自然环绕。若图片较矮，文字会环绕并收到图片下方；适合"图文穿插叙述"的正文风格。注意 float 图宽不要超过容器 45%，否则手机端右侧文字变窄难读。
  </p>
  <div style="clear:both;"></div>
</div>
<div style="height:16px;"></div>
```

- **适用场景**：正文叙述中想插入一张横向小图、长段落提行处插图；需要兼容特别老设备的场景。
- **微信兼容性**：float 全端支持良好；核心风险是**溢出**——务必给图限定百分比宽度 + `max-width:100%`，且段落文字列在移动端可能被压得过窄，故**优先推荐模板 1 的 flex**。右图左文只需把 `float:left` 换成 `float:right`、`margin:0 0 8px 14px` 即可，其余一致。

### 模板 3：图 + 文字卡组合（图文一体的"卡片"）

图片放卡片顶部，卡片自带白底、描边、圆角，整体像一张杂志卡片。

```html
<div style="width:100%; border:1px solid #ececec; border-radius:10px; overflow:hidden; background:#ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <div style="width:100%; overflow:hidden;">
    <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
  </div>
  <div style="padding:14px 16px 16px;">
    <p style="font-size:16px; font-weight:bold; color:#222; margin:0 0 6px; line-height:1.5;">卡片标题</p>
    <p style="font-size:13px; color:#777; line-height:1.7; margin:0;">
      卡片正文说明。图+文字作为一个整体单元出现，视觉上比单纯的图更"成体系"，适合作为一篇文章里的一则要点/一则案例。
    </p>
  </div>
</div>
<div style="height:14px;"></div>
```

- **适用场景**：案例卡片、摘要卡片、多则并列要点（复制此块重复多次即成一列卡片）。
- **微信兼容性**：`border + radius + box-shadow` 在内联样式中均可靠渲染；深浅底色卡片也支持渐变背景（见模板 8）。建议整卡 `overflow:hidden` 兜住圆角图片。

### 模板 4：图片上方"标题条"——图+独立标题条（安全方案）

> **结论**：把文字用 `position:absolute` 叠加到 `<img>` 之上（"图内文字"），在微信端**极不可靠**——不同机型对 overlay 的渲染、图片自适应高度与层叠次序不稳定，且发布后深浅图背景下文字不可读。**安全做法是"图片 + 独立标题条分段"**：标题条是图片正上/正下方的独立色块，随图片一起自适应。

```html
<div style="width:100%; border-radius:8px; overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e); padding:14px 16px;">
    <p style="font-size:15px; font-weight:bold; color:#ffffff; margin:0; line-height:1.5;">这一条的标题（深色渐变条）</p>
    <p style="font-size:12px; color:rgba(255,255,255,0.75); margin:4px 0 0; line-height:1.5;">副标题/英文/小字说明</p>
  </div>
  <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
  <div style="background:#f5f5f5; padding:6px 16px;">
    <p style="font-size:12px; color:#999; margin:0; text-align:center;">—— 图下方的图注 ——</p>
  </div>
</div>
<div style="height:14px;"></div>
```

- **适用场景**：章节大图 + 标题、专题横幅 + 标题（色调让给图片上/下的色条表达，不覆盖图片）。
- **微信兼容性**：整块是普通块级元素，无 overlay，全端可靠。**这是替代"图内叠字"的唯一稳定方案**——如实在想让文字叠在图上方，唯一的接近做法是"把文字直接喷进图片里"（用设计工具导出成一张带文字的图），但那样文字无法选中/改字，谨慎使用。

### 模板 5：全宽横幅图

一张横图铺满内容区，作为章节分隔或氛围大图。

```html
<div style="width:100%; border-radius:8px; overflow:hidden;">
  <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
</div>
<p style="font-size:13px; color:#999; text-align:center; margin:6px 0 18px; line-height:1.5;">§ 横幅图下方的分隔说明文字，居中浅灰 §</p>
```

- **适用场景**：章节开始的大场面图、题图、品牌氛围图、引子图。常与"上下留白大"配合，制造节奏停顿。
- **微信兼容性**：纯 block 图 + 圆角，全端稳。**注意**：微信会把宽 PNG/JPG 压缩到约 677px 并可能损失细节，横幅图建议原图宽度 ≥1080~1200px、重要内容（文字/LOGO）不要贴边，避免被微信裁切或缩小后模糊。

### 模板 6：圆角 / 描边 / 阴影图片的三种形态

同一张图的三态对比——**图片装进带 `overflow:hidden` 的容器**，圆角/描边/阴影都加在容器上：

```html
<!-- 形态 A：仅圆角 -->
<div style="width:100%; overflow:hidden; border-radius:12px; margin-bottom:14px;">
  <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
</div>

<!-- 形态 B：圆角 + 细描边 -->
<div style="width:100%; overflow:hidden; border-radius:8px; border:1px solid #e0e0e0; margin-bottom:14px;">
  <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
</div>

<!-- 形态 C：圆角 + 阴影 -->
<div style="width:100%; overflow:hidden; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.08);">
  <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
</div>
<div style="height:6px;"></div>
```

- **适用场景**：截图类内容建议圆角+描边（模拟设备边框）；照片类建议圆角+阴影（悬浮感）；示意/插画类可用大圆角。
- **微信兼容性**：圆角/描边/阴影需在**容器**上渲染并配 `overflow:hidden`，避免图片自身太方把圆角裁成"方角压角"异常。圆角建议 8~12px；阴影用 `box-shadow` 内联，iOS/Android 均支持。

---

## 2. 多图布局

### 模板 7：双图并排（flex 各 50% 带间距）

```html
<div style="width:100%; display:flex; gap:10px;">
  <div style="flex:1 1 50%; max-width:50%; overflow:hidden; border-radius:8px;">
    <img src="微信uploadimg地址①" style="width:100%; display:block; height:auto;">
  </div>
  <div style="flex:1 1 50%; max-width:50%; overflow:hidden; border-radius:8px;">
    <img src="微信uploadimg地址②" style="width:100%; display:block; height:auto;">
  </div>
</div>
<div style="height:12px;"></div>
```

- **适用场景**：同一事物的两个角度、前后对比、并排结果展示、左右对照（推荐先图后文）。间距用 `gap:10px` 实现，图间留一条缝，避免"两张贴成一张"。
- **微信兼容性**：flex gap 在较新 WebView 支持良好；**保险起见**可用图间 `margin-right:10px` + `:last` 手动控制间隔以覆盖旧设备（本项目不用伪元素，可对第二个容器内边距不设即可用 gap 无妨）。两图高度不同时 `align-items:flex-start` 可避免拉伸变形；默认 stretch 会让矮图被拉高，注意给内层 `height:auto` + 外层不加固定高度。

### 模板 8：三图一行

```html
<div style="width:100%; display:flex; gap:8px;">
  <div style="flex:1 1 33.333%; max-width:33.333%; overflow:hidden; border-radius:8px;"><img src="图①" style="width:100%; display:block; height:auto;"></div>
  <div style="flex:1 1 33.333%; max-width:33.333%; overflow:hidden; border-radius:8px;"><img src="图②" style="width:100%; display:block; height:auto;"></div>
  <div style="flex:1 1 33.333%; max-width:33.333%; overflow:hidden; border-radius:8px;"><img src="图③" style="width:100%; display:block; height:auto;"></div>
</div>
<div style="height:12px;"></div>
```

- **适用场景**：三个并列产品/三步流程/三张缩略预览。单图会很窄（约 200px），**图内容要"大而少"**，放太多小字细节会糊。
- **微信兼容性**：flex 三列全端可用；每列 `max-width:33.333%` + 外层 `gap` 控制间隔即可，无溢出风险。

### 模板 9：2×2 网格

```html
<div style="width:100%; display:flex; flex-wrap:wrap; gap:10px;">
  <div style="flex:1 1 calc(50% - 5px); max-width:calc(50% - 5px); overflow:hidden; border-radius:8px;"><img src="图①" style="width:100%; display:block; height:auto;"></div>
  <div style="flex:1 1 calc(50% - 5px); max-width:calc(50% - 5px); overflow:hidden; border-radius:8px;"><img src="图②" style="width:100%; display:block; height:auto;"></div>
  <div style="flex:1 1 calc(50% - 5px); max-width:calc(50% - 5px); overflow:hidden; border-radius:8px;"><img src="图③" style="width:100%; display:block; height:auto;"></div>
  <div style="flex:1 1 calc(50% - 5px); max-width:calc(50% - 5px); overflow:hidden; border-radius:8px;"><img src="图④" style="width:100%; display:block; height:auto;"></div>
</div>
<div style="height:12px;"></div>
```

- **适用场景**：四个要点图、作品集缩略、四宫格拼图。`flex-wrap:wrap` 自动换行成 2×2。
- **微信兼容性**：`calc()` 在微信 WebView 支持良好；`gap + calc(50% - 5px)`（间距 10px）可实现等距双列。**注意**：`calc` 参与百分比需谨慎，若无间距需求可简化为每格 `width:50%` + 内边距，更稳。

### 模板 10：图片拼贴（大小混合）+ 多图带编号

混排一张大图 + 两张小图（不对称布局），并给多图统一加编号角标。**编号安全做法**：编号不是压在图上，而是独立小圆点 + 图注行，避免 overlay 不可靠。

```html
<!-- 大图（左） + 两小图（右纵向）拼贴 -->
<div style="width:100%; display:flex; gap:10px;">
  <div style="flex:1.5 1 60%; max-width:60%; overflow:hidden; border-radius:8px;">
    <img src="大图" style="width:100%; display:block; height:100%; object-fit:cover;">
  </div>
  <div style="flex:1 1 40%; max-width:40%; display:flex; flex-direction:column; gap:10px;">
    <div style="flex:1; overflow:hidden; border-radius:8px;"><img src="小图①" style="width:100%; display:block; height:100%; object-fit:cover;"></div>
    <div style="flex:1; overflow:hidden; border-radius:8px;"><img src="小图②" style="width:100%; display:block; height:100%; object-fit:cover;"></div>
  </div>
</div>
<!-- 编号以图注形式给出（安全，不压图） -->
<p style="font-size:12px; color:#999; text-align:center; margin:6px 0 2px; line-height:1.5;"><span style="display:inline-block; min-width:16px; height:16px; line-height:16px; text-align:center; background:#e5e5e5; border-radius:50%; font-size:11px; color:#333; margin-right:4px;">1</span> 主视角细节 · 2 侧视 · 3 结构</p>
<div style="height:12px;"></div>
```

- **适用场景**：产品多角度、对比拼贴的杂志感排版；带编号教程步骤（编号放图注，不用 overlay）。
- **微信兼容性**：`object-fit:cover` 用于裁切填充（小图与大图高度对齐），较新 WebView 支持良好；**若担心旧端 object-fit 失效**，可退回"所有图同比例 + 外层固定高度"或直接不用 cover 让各图自然高度（此时大图/小图高度不齐，视觉仍可接受）。编号小圆点独立于图，全端可靠。

---

## 3. 图注与图片卡片

### 模板 11：图片下方说明文字（小号灰居中）

```html
<div style="width:100%; overflow:hidden; border-radius:8px;">
  <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
</div>
<div style="border-bottom:1px solid #f0f0f0; padding-bottom:12px; margin-bottom:14px;">
  <p style="font-size:12px; color:#999; text-align:center; margin:8px 0 0; line-height:1.5;">
    ▲ 图注 / 图片来源 / 数据说明，字号 12-13px、行高 1.5、灰色居中。
  </p>
</div>
```

- **适用场景**：所有需要说明来源、地点、数据、内容的图片。图注独立成行（不压图），可选中，最稳。
- **微信兼容性**：纯块级，全端可靠。图注字号规范 12-13px、行高 1.5、色 `#999`；与上图的间距建议 ≥6px，与下文的间距用 `margin-bottom` 保证 ≥12px。

### 模板 12：图片卡片（图 + 底栏说明）

图片与底栏文字合成一张"卡片"，比模板 11 更强调整体。

```html
<div style="width:100%; border-radius:10px; overflow:hidden; border:1px solid #ececec; background:#fff;">
  <div style="width:100%; overflow:hidden;">
    <img src="微信uploadimg地址" style="width:100%; display:block; height:auto;">
  </div>
  <div style="padding:10px 14px 12px; border-top:1px solid #f3f3f3;">
    <p style="font-size:13px; color:#555; line-height:1.6; margin:0; text-align:center;">
      底栏说明文字：图片解释、参数、来源署名，位于同一卡片底栏，视觉上归为一体。
    </p>
  </div>
</div>
<div style="height:14px;"></div>
```

- **适用场景**：信息图卡片、图表卡片、照片带图注的"相框"效果。卡片底栏用 `border-top` 分隔图片与文字。
- **微信兼容性**：块级卡片全端稳；`border-top` 分隔线可靠。整卡 `overflow:hidden` 兜住圆角。

---

## 4. 图片在微信正文的展示规则

1. **宽度自适应是硬规则**：容器 `max-width:100%; width:100%;` + 图片 `height:auto`。内容区桌面约 677px、手机约 `视口宽 - 120px`，用百分比永远跟得上。
2. **2x/3x 尺寸建议**：微信内容区约 677px，但手机主流屏幕 DPR 为 2~3，所以**原始上传图建议宽 ≥1080px（推荐 1080~1200px）**，这样微信压缩到 677px 后仍对应 2x 清晰度。PNG（Logo/示意）与 JPG（照片）都不超过 1MB。
3. **长图处理**：微信对超高长图会自动压缩到约 1500px 内并可能"整图等比缩小"，导致长图上的细字变糊无法局部放大。因此**长图（信息图）宜切成 ≤1500px 高的多段**拼接，或正文用小图 + "查看原图"引导。上传后无法保证用户能放大查看单张长图细节。
4. **推荐写法**：
   - 外容器：`display:block; width:100%; max-width:100%; overflow:hidden; border-radius:8px;`（图片自身也用 `width:100%; height:auto; display:block;`）。
   - flex 多列：`display:flex; gap:8~10px;`，每列 `flex + max-width` 约束。
   - 圆角/描边/阴影都放容器，配 `overflow:hidden`。
5. **避免的写法**：
   - ❌ 固定 px 宽度（如 `width:600px`）→ 小屏溢出。一律百分比/`max-width:100%`。
   - ❌ 固定 px 高度（如 `height:300px; width:auto`）→ 比例失真。用 `height:auto` 或 `object-fit`。
   - ❌ 在 `<img>` 上直接设 `border-radius` 却不配外层 `overflow:hidden` → 部分机型方角压角。
   - ❌ 用 `<br>` 堆图片间距 → 不可控，用容器 `margin`。
   - ❌ overlay 文字压图（absolute 定位到 img 上）→ 微信端不可靠，用"图片+独立标题条"。
   - ❌ 外链图片 / dataURI / 本地相对路径 → 发布后失效，必须用上传到微信的 uploadimg URL。

---

## 5. 图片与文字间距规范

| 位置 | 建议值 | 说明 |
|------|--------|------|
| 图与上文间距 | ≥ 12px（建议 12~16px） | 用图片/容器上方的 `margin-top` 或块间高度控制 |
| 图与下文间距 | ≥ 12px | 用 `margin-bottom` 控制 |
| 图文混排左右间距 | ≥ 10px（建议 14px） | flex `gap:10~14px` / float `margin-right` |
| 图注字号 | 12~13px，行高 1.5，色 `#999` | 独立成行、居中或左对齐 |
| 图与图注间距 | ≥ 6px | 图注不要贴图太紧 |
| 多图网格间距 | 8~10px | 双列/三列/网格统一，避免贴死 |

---

## 6. 模板速查表

| 模板 | 名称 | 核心手段 | 主要风险 | 推荐度 |
|------|------|----------|----------|--------|
| 1 | 左图右文（flex） | flex + gap | — | ★★★★★ |
| 2 | 左图右文（float 备选） | float + clear | 溢出、文字列过窄 | ★★★☆☆ |
| 3 | 图+文字卡 | 卡片容器 | — | ★★★★☆ |
| 4 | 图片+独立标题条 | 上下色条（安全替代图内叠字） | 无 overlay | ★★★★★ |
| 5 | 全宽横幅图 | 满宽 block 图 | 被压缩裁切 | ★★★★☆ |
| 6 | 圆角/描边/阴影 | 容器三态 | 忘了 overflow:hidden | ★★★★☆ |
| 7 | 双图并排 | flex 50% + gap | 高度不齐 | ★★★★★ |
| 8 | 三图一行 | flex 33.333% | 单图过窄 | ★★★★☆ |
| 9 | 2×2 网格 | flex-wrap + calc | calc 兼容 | ★★★☆☆ |
| 10 | 大小混合拼贴+编号 | flex + object-fit | object-fit 兼容 | ★★★☆☆ |
| 11 | 图下说明文字 | 独立图注行 | — | ★★★★★ |
| 12 | 图片卡片（图+底栏） | 卡片+底栏 | — | ★★★★☆ |

---

## 7. 信息缺口与后续校验建议

- ⚠️ **建议实测**：微信对 flex/gap、object-fit、calc() 的支持因客户端版本而异；1MB 与长图压缩阈值也可能调整。上线前请在 iOS 微信、主流安卓微信、微信 PC 版 + 编辑器预览中各测一遍。
- 所有模板均满足"仅内联 style、无 style/script/伪元素/外链字体、flex/float/position/渐变/圆角/box-shadow 可用"的平台约束；图片均需替换为微信 uploadimg URL。
