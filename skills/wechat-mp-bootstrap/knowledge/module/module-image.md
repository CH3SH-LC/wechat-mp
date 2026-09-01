# 图片（module-image）

> 定位：在正文中按需混排单图、左图右文、双图、三图、2×2 网格、拼贴、图注与图片卡片，把抽象内容变成可视画面，调节阅读节奏。
> 调用时机：正文需要"每 400-600 字配一张图"时、讲解步骤/对比/案例/氛围需要配图时；全文至少 1-2 张图增加可读性与停留时长。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体；flex、float、`position`、圆角、细边框 可用，渐变与阴影不推荐（统一纯色 + 细边框）；图片必须是**微信 uploadimg URL**（jpg/png ≤1MB，原图建议 ≥1080px 宽）；无固定 px 宽度（一律百分比 + `max-width:100%`）。

**四条铁律（先读，违反即返工）**：
1. **图片永不允许横向溢出**——任何图片容器写 `max-width:100%;width:100%;height:auto;display:block`，绝不用固定 px 宽。
2. **圆角与描边写在父容器、不是 `<img>` 上**——外包装一个带 `border-radius;overflow:hidden` 的 `div` 再塞 `<img>`，部分机型对 `<img>` 自身圆角失效。
3. **间距用块级容器 + margin，不用 `<br>` 堆空行**——`<br>` 在不同字号下行高不同，间距不可控。
4. **图片必须微信上传（uploadimg URL）**——本地路径/`data:`/外链 CDN 发布后失效；微信会把超宽图压缩到约 677px，原图建议 ≥1080px 保证压缩后仍清晰。

> **间距硬规范**：所有图片/图片容器上下边距统一 **12px**（块间 `margin:12px 0`，与 16px 块距、24px 分割线区分）；图注与上文间距 ≥6px、图注字号 12-13px、行高 1.5、灰色居中 `#999`。

### 1.1 单图（最基础）

一张图铺满内容区宽，圆角 8px。容器 `width:100%;overflow:hidden;border-radius:8px`。

```html
<div style="width:100%;overflow:hidden;border-radius:8px;margin:12px 0;">
  <img src="微信uploadimg地址" style="width:100%;display:block;height:auto;">
</div>
```

### 1.2 左图右文（flex 版，推荐）

两列随容器缩放、手机端满宽。图列 `flex:0 0 40%`（锁比例防变形），文字列 `flex:1 1 auto;min-width:0`（防长英文撑破）。`gap:14px`。适合产品对比、步骤配图、截图配简介。

```html
<div style="width:100%;display:flex;align-items:flex-start;gap:14px;margin:12px 0;">
  <div style="flex:0 0 40%;max-width:40%;border-radius:8px;overflow:hidden;">
    <img src="微信uploadimg地址" style="width:100%;display:block;height:auto;">
  </div>
  <div style="flex:1 1 auto;min-width:0;">
    <p style="font-size:15px;color:#333;line-height:1.75;margin:0 0 8px;">配图旁说明文字标题</p>
    <p style="font-size:13px;color:#777;line-height:1.65;margin:0;">补充说明、产品参数、一句话观点。阅读路径"先看图，再读文"。</p>
  </div>
</div>
```

### 1.3 双图并排

两张图各 50%，之间留缝 `gap:10px`（图间缝避免"贴成一张"）。用于同一事物两角度、前后对比、并排结果。

```html
<div style="width:100%;display:flex;gap:10px;margin:12px 0;">
  <div style="flex:1 1 50%;max-width:50%;overflow:hidden;border-radius:8px;"><img src="图1" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 50%;max-width:50%;overflow:hidden;border-radius:8px;"><img src="图2" style="width:100%;display:block;height:auto;"></div>
</div>
```

### 1.4 三图一行

三张各 33.333%，`gap:8px`。单图会较窄（约 200px），**图内容要"大而少"**，别放太多小字细节会糊。用于三并列产品、三步流程。

```html
<div style="width:100%;display:flex;gap:8px;margin:12px 0;">
  <div style="flex:1 1 33.333%;max-width:33.333%;overflow:hidden;border-radius:8px;"><img src="图1" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 33.333%;max-width:33.333%;overflow:hidden;border-radius:8px;"><img src="图2" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 33.333%;max-width:33.333%;overflow:hidden;border-radius:8px;"><img src="图3" style="width:100%;display:block;height:auto;"></div>
</div>
```

### 1.5 2×2 网格

四张 `flex-wrap:wrap` 自动换行成 2×2，格宽 `calc(50% - 5px)`、间距 10px。用于四要点图、作品集缩略、四宫格拼图。

```html
<div style="width:100%;display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;">
  <div style="flex:1 1 calc(50% - 5px);max-width:calc(50% - 5px);overflow:hidden;border-radius:8px;"><img src="图1" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 calc(50% - 5px);max-width:calc(50% - 5px);overflow:hidden;border-radius:8px;"><img src="图2" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 calc(50% - 5px);max-width:calc(50% - 5px);overflow:hidden;border-radius:8px;"><img src="图3" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 calc(50% - 5px);max-width:calc(50% - 5px);overflow:hidden;border-radius:8px;"><img src="图4" style="width:100%;display:block;height:auto;"></div>
</div>
```

### 1.6 图片拼贴（大小混合 + 编号）

一张大图 + 两张小图纵向（不对称），`object-fit:cover` 填充让高度对齐。**编号不放图上（overlay 不可靠），放独立图注行**。

```html
<div style="width:100%;display:flex;gap:10px;margin:12px 0;">
  <div style="flex:1.5 1 60%;max-width:60%;overflow:hidden;border-radius:8px;">
    <img src="大图" style="width:100%;display:block;height:100%;object-fit:cover;">
  </div>
  <div style="flex:1 1 40%;max-width:40%;display:flex;flex-direction:column;gap:10px;">
    <div style="flex:1;overflow:hidden;border-radius:8px;"><img src="小图1" style="width:100%;display:block;height:100%;object-fit:cover;"></div>
    <div style="flex:1;overflow:hidden;border-radius:8px;"><img src="小图2" style="width:100%;display:block;height:100%;object-fit:cover;"></div>
  </div>
</div>
<p style="font-size:12px;color:#999;text-align:center;margin:6px 0 12px;line-height:1.5;"><span style="display:inline-block;min-width:16px;height:16px;line-height:16px;text-align:center;background:#e5e5e5;border-radius:50%;font-size:11px;color:#333;margin-right:4px;">1</span> 主视角，2 侧视，3 结构</p>
```

### 1.7 图注（图片下方说明文字）

小号灰居中，说明来源/地点/数据/内容。独立成行（不压图）、可选中、最稳。

```html
<div style="width:100%;overflow:hidden;border-radius:8px;margin:12px 0 0;">
  <img src="微信uploadimg地址" style="width:100%;display:block;height:auto;">
</div>
<p style="font-size:12px;color:#999;text-align:center;margin:8px 0 12px;line-height:1.5;">图注 / 图片来源 / 数据说明</p>
```

### 1.8 图片卡片（图 + 底栏说明）

图片与底栏文字合成一张"卡片"，比图注整构成一体。整卡 `border-radius:10px;overflow:hidden;border:1px solid #ececec;background:#fff`，底栏用 `border-top:1px solid #f3f3f3` 分隔。

```html
<div style="width:100%;border-radius:10px;overflow:hidden;border:1px solid #ececec;background:#fff;margin:12px 0;">
  <div style="width:100%;overflow:hidden;">
    <img src="微信uploadimg地址" style="width:100%;display:block;height:auto;">
  </div>
  <div style="padding:10px 14px 12px;border-top:1px solid #f3f3f3;">
    <p style="font-size:13px;color:#555;line-height:1.6;margin:0;text-align:center;">底栏说明：图片说明、参数、来源署名，视觉与图归为一体。</p>
  </div>
</div>
```

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：图片即内容（截图、示意图、说明图），配图注；混排以单图、左图右文为主，圆角小（8px），不带投影。图片起"解释"作用。
- **宣传类**：图片即氛围/视觉冲击（产品照、场景图、banner），可加圆角+细描边（卡片感）或圆角+留白（画面感）；多用双图、三图、拼贴网格制造版式感。图片起"种草"作用。

## 三、样式变体（≥3 种，具体参数）

1. **单图（纯圆角 8px）**：容器 `width:100%;overflow:hidden;border-radius:8px`。（见 1.1）
2. **圆角 + 细描边**：容器加 `border:1px solid #e0e0e0`——截图类模拟设备边框。
3. **圆角 + 主色细描边**：容器加 `border:1px solid #d8a05f` 或账号主色——照片/产品图卡片感，靠细描边与留白分层，不做投影。
4. **图 + 独立标题条**（安全替代"图内叠字"）：图上方加深色纯色标题条，图中下方加浅灰图注条，全端可靠。图片 + 文字分条分段，不 overlay 压图。

> **图内文字的坑**：把文字 `position:absolute` 叠加到 `<img>` 之上在微信端极不可靠（机型/自适应高度/层叠不稳，发布后深浅图下不可读）。安全做法是"图片 + 独立标题条/图注条"分段，或用设计工具把文字直接"喷"进图片（但那样文字不可选中）。

## 四、使用时机与位置

- **频率硬线**：正文**每 400-600 字配一张图**（图片是停留时长与可读性的关键抓手），但不要为凑数硬塞。
- **位置**：章节大图/横幅放段首做停顿；说明图紧跟对应观点段落；对比/并排图放对比结论处；封面题图在首屏。
- **内容类型**：教程（步骤截图配左图右文/图注）、报告（图表截图配图注）、电商（产品图卡片渲染）、生活方式（氛围大图做节奏）。

## 五、风格适配（4 个风格例子）

- **科技商务**：截图/示意图圆角 8px + 细描边（模拟设备边框），产品功能图配浅色卡片，图间 `gap:8px` 紧凑。
- **国潮红金**：氛围大图配红金标题条（上方深红纯色条 + 下方浅米图注），圆角 10px，图片本身色调偏暖。
- **校园清新**：圆角加大到 12px + 浅色细描边（`border:1px solid #e8e8e8`），配图卡白色圆角、图片多格拼贴活泼。
- **极简白**：圆角最小（4-6px）或直角，无描边、无投影，图即内容最干净的呈现，图注直接浅灰小字。

## 六、间距与尺寸（遵守硬规范）

- **图片/图片容器上下各 12px**（`margin:12px 0`）——硬规范；多图网格外容器同理。
- 图文混排左右间距 `gap:10-14px`（flex）；左图右文推荐 `gap:14px`。
- 图注字号 12-13px、行高 1.5、色 `#999`、居中；与上图间距 ≥6px，与下文 `margin-bottom` ≥12px。
- 网格间距统一 8-10px（双列/三列/网格），避免贴死。
- 图片裁切：圆角/描边放容器 + `overflow:hidden`；圆角建议 8-12px。

## 七、密度限制

- **图片间隔 400-600 字一张**——太密（<300 字）打断阅读，太疏（>800 字）枯燥。
- **图片卡/图片横幅每屏 ≤2 个**，长文里全宽横幅图 2-3 张即可，别每段一张大图。
- 一张长图信息量大时，优先"切成多小图 + 图注"或"小图 + 查看原图引导"，避免微信把超高长图压缩到 1500px 内模糊。
- 网格/三图/拼贴这类"版式化"组合一屏 ≤1 处，避免全篇都是格子。

## 八、常见错误（反例 + 正解）

- 反例：图片容器写 `width:600px`，手机端直接溢出破版。正解：一律 `max-width:100%;width:100%` + `height:auto`。
- 反例：在 `<img>` 上直接设 `border-radius` 却不配外层 `overflow:hidden`，部分机型方角压角。正解：圆角写在容器、配 `overflow:hidden`。
- 反例：图内叠字 `position:absolute` 压图上，发布后看不清。正解：用"图片+独立标题条/图注条"分段，或把文字直接做进图里。
- 反例：本地图 / `data:` / 外链 CDN 地址直接贴，发布后全裂图。正解：一律用微信上传的 uploadimg URL。
- 反例：用 `<br>` 堆图片间距，不同手机行高不同、间距乱。正解：用容器 `margin` 控制片距。
- 反例：正文 1000 字都没有一张图，长段落一片文字墙。正解：每 400-600 字配一张图，用图做可视锚点与节奏缓冲。

## 九、示例（可用骨架，标注可替换处）

**骨架 A · 单图 + 图注（通用）**：

```html
<div style="width:100%;overflow:hidden;border-radius:8px;margin:12px 0 0;">
  <img src="微信uploadimg地址" style="width:100%;display:block;height:auto;">
</div>
<p style="font-size:12px;color:#999;text-align:center;margin:8px 0 12px;line-height:1.5;">图注 / 来源说明</p>
```
> 可替换处：图片 URL、圆角（8-12px）、图注文字；间距保持图上下 12px。

**骨架 B · 左图右文（产品/步骤）**：

```html
<div style="width:100%;display:flex;align-items:flex-start;gap:14px;margin:12px 0;">
  <div style="flex:0 0 40%;max-width:40%;border-radius:8px;overflow:hidden;">
    <img src="微信uploadimg地址" style="width:100%;display:block;height:auto;">
  </div>
  <div style="flex:1 1 auto;min-width:0;">
    <p style="font-size:15px;color:#333;line-height:1.75;margin:0 0 8px;">标题</p>
    <p style="font-size:13px;color:#777;line-height:1.65;margin:0;">补充说明文字，一图一理。</p>
  </div>
</div>
```
> 可替换处：图片、标题与说明文字；图/文比例可改 `flex:0 0 40%`（40/55/45%）。

**骨架 C · 双图并排 + 图注（对比）**：

```html
<div style="width:100%;display:flex;gap:10px;margin:12px 0;">
  <div style="flex:1 1 50%;max-width:50%;overflow:hidden;border-radius:8px;"><img src="图1" style="width:100%;display:block;height:auto;"></div>
  <div style="flex:1 1 50%;max-width:50%;overflow:hidden;border-radius:8px;"><img src="图2" style="width:100%;display:block;height:auto;"></div>
</div>
<p style="font-size:12px;color:#999;text-align:center;margin:2px 0 12px;line-height:1.5;">左：改造前　右：改造后</p>
```
> 可替换处：两张图、图注对比文案；间距 10px、圆角 8px。

**骨架 D · 图片卡片（电商/案例）**：

```html
<div style="width:100%;border-radius:10px;overflow:hidden;border:1px solid #ececec;background:#fff;margin:12px 0;">
  <div style="width:100%;overflow:hidden;"><img src="微信uploadimg地址" style="width:100%;display:block;height:auto;"></div>
  <div style="padding:10px 14px 12px;border-top:1px solid #f3f3f3;">
    <p style="font-size:13px;color:#555;line-height:1.6;margin:0;text-align:center;">产品名/参数/一句话说明</p>
  </div>
</div>
```
> 可替换处：图片、底栏说明；卡片圆角 8-12px、底栏 `padding:10px 14px 12px`。

## 十、个性化空间（可调参数与判断依据）

- **可调**：圆角（4-12px）、描边、留白。**判断依据**：截图类用圆角+描边（设备感），照片类用圆角+细描边或大留白（画面感），极简用最小圆角无描边。
- **可调**：图/文混排比例（40/60 或 50/50）。**判断依据**：图边有小字参数要看清用 50/50；图只是氛围辅助用 40/60 或更小的 35%。
- **可调**：图片间距（12px 硬底线，可微调到 14-16px）。**判断依据**：视觉喘息的节奏——氛围大图可大一点留白，连续小图标则紧凑到 10px。
- **可调**：图注/标题条 vs 图内文字。**判断依据**：默认用图注/标题条（稳定）；若必须图内显示标题，用设计工具把字做进图（但不可选中、不可改）。
- **可调**：多图组合用哪种（双图/三图/网格/拼贴）。**判断依据**：2 张对比用双图、3 个并列用三图、4 个要点用网格、1 大 + 多小用拼贴；组合类型一屏 ≤1 处。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
