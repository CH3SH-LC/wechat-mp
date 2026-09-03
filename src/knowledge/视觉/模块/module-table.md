# 数据表格 / 图表块（module-table）

> 定位：把对比、份额、进度、达成率等数据用「表格」或「纯 CSS 图表」呈现，让数字可读、可比较。
> 调用时机：报告、研究、对比文、复盘文需要展示多行多列数据或量化指标时用；文字说不清、用表更清楚时用。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体；无图标库；flex、圆角可用。微信对「复杂表格」（合并单元格、跨行跨列）渲染不稳定，**能不用原生 `<table>` 就别用**——优先用 div 网格或 flex 行搭"表"，或截图成图（见第四节）。

### 1.1 完整表格的做法（表头 / 斑马纹 / 对齐）

用 div + flex 搭表，每行一个 flex 容器，单元格用 `flex` 均分。要点：**表头深一点、正文浅一点、偶数行加浅底（斑马纹）**、数字列右对齐、文字列左对齐。

外层容器规格：`background:#fff`、`border:1px solid #e6ecf5`、`border-radius:12px`、`overflow:hidden`、`margin:0 0 16px`。表头行 `background:#eef3fb`（浅灰蓝）或品牌主色浅调，正文行 `#fff`，偶数行 `#f7f9fc`（斑马纹）。

```html
<section style="margin:0 0 16px;border:1px solid #e6ecf5;border-radius:12px;overflow:hidden;">
  <div style="display:flex;background:#eef3fb;padding:10px 14px;">
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;">项目</div>
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;text-align:right;">数据</div>
  </div>
  <div style="display:flex;background:#fff;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">A 方案</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;text-align:right;line-height:1.75;">120</div>
  </div>
  <div style="display:flex;background:#f7f9fc;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">B 方案</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;text-align:right;line-height:1.75;">210</div>
  </div>
</section>
```

多列同理，把每行的 `flex:1` 改成 3 个/4 个单元格。表头底色深于正文、行间加 `border-top:1px solid #eef2f8` 分隔，偶数行 `#f7f9fc` 出斑马纹。**三列表格骨架**（每行 3 格，加一列"说明"）：

```html
<section style="margin:0 0 16px;border:1px solid #e6ecf5;border-radius:12px;overflow:hidden;">
  <div style="display:flex;background:#eef3fb;padding:10px 12px;">
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;">套餐</div>
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;text-align:center;">价格</div>
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;text-align:right;">含服务</div>
  </div>
  <div style="display:flex;background:#fff;padding:10px 12px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">基础版</div>
    <div style="flex:1;font-size:14px;color:#d46b08;text-align:center;line-height:1.75;">¥99</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;text-align:right;line-height:1.75;">1 次</div>
  </div>
  <div style="display:flex;background:#f7f9fc;padding:10px 12px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">进阶版</div>
    <div style="flex:1;font-size:14px;color:#d46b08;text-align:center;line-height:1.75;">¥299</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;text-align:right;line-height:1.75;">5 次</div>
  </div>
</section>
```

**纵向字段表（参数少但列多的产品表）**：一行一个"标签:值"，手机端最稳不挤压，适合参数规格：

```html
<section style="margin:0 0 16px;border:1px solid #e6ecf5;border-radius:12px;overflow:hidden;">
  <div style="display:flex;padding:10px 14px;">
    <div style="width:90px;font-size:14px;color:#8a94a6;">重量</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;text-align:right;">1.2 kg</div>
  </div>
  <div style="display:flex;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="width:90px;font-size:14px;color:#8a94a6;">续航</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;text-align:right;">12 小时</div>
  </div>
  <div style="display:flex;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="width:90px;font-size:14px;color:#8a94a6;">接口</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;text-align:right;">USB-C / 蓝牙</div>
  </div>
</section>
```

> 纵向字段表的标签列用固定 `width:90px`（窄标签右侧对齐）、值列 `flex:1` 右对齐，标签灰色、值深色，一眼对应。

### 1.2 纯 CSS 图表化（柱状 / 进度条 / 占比条）

核心思想：**用 div 嵌套的宽度百分比 + 纯色填充模拟图表**，不引入任何图表库或 SVG。微信内 flex 可用，但**推荐优先用 block + margin**（更稳），必要时再包一层 flex 行。图表一律**纯色填充 + 细边框 + 圆角**，不用渐变。

**柱状图（多组数据对比）**：每个条目 = 一个灰色轨道 + 一条纯色填充条。轨道：`height:10px;border-radius:5px;background:#eef2f8;overflow:hidden`；填充条：`height:100%` + `width:XX%` + `background:主色纯色`。

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;margin:0 0 16px;">
  <p style="margin:0 0 12px;font-size:14px;color:#2b3a5e;font-weight:700;">各渠道触达占比</p>
  <div style="font-size:13px;color:#8a94a6;margin:0 0 2px;">私域</div>
  <div style="height:10px;border-radius:5px;background:#eef2f8;margin:4px 0 12px;overflow:hidden;">
    <div style="height:100%;width:68%;border-radius:5px;background:#1890ff;"></div>
  </div>
  <div style="font-size:13px;color:#8a94a6;margin:0 0 2px;">公域</div>
  <div style="height:10px;border-radius:5px;background:#eef2f8;margin:4px 0 12px;overflow:hidden;">
    <div style="height:100%;width:24%;border-radius:5px;background:#36cfc9;"></div>
  </div>
  <div style="font-size:13px;color:#8a94a6;margin:0 0 2px;">转介绍</div>
  <div style="height:10px;border-radius:5px;background:#eef2f8;margin:0;overflow:hidden;">
    <div style="height:100%;width:8%;border-radius:5px;background:#13c2c2;"></div>
  </div>
</section>
```

**进度条 + 目标（单个量化指标）**：更粗的单条轨道 + 右对齐的小字达成说明。

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;margin:0 0 16px;">
  <p style="margin:0 0 8px;font-size:14px;color:#2b3a5e;font-weight:700;">
    本月目标达成 <span style="color:#18a058;">78%</span><span style="color:#8a94a6;font-weight:400;"> / 10 万</span>
  </p>
  <div style="height:14px;border-radius:7px;background:#eef2f8;overflow:hidden;">
    <div style="height:100%;width:78%;border-radius:7px;background:#18a058;"></div>
  </div>
  <p style="margin:6px 0 0;font-size:12px;color:#8a94a6;text-align:right;">已达成 7.8 万</p>
</section>
```

**占比条（两段对比）**：无 SVG 环形图的替代——一条底 + 两段带色 div，下面配 CSS 圆点图例说明哪段是哪个。

```html
<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:0 0 8px;">
  <div style="height:100%;width:70%;background:#1890ff;"></div>
  <div style="height:100%;width:30%;background:#eef2f8;"></div>
</div>
<div style="font-size:12px;color:#8a94a6;">
  <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1890ff;vertical-align:middle;margin-right:4px;"></span>完成任务 70%</span>
  <span style="margin-left:16px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid #8a94a6;vertical-align:middle;margin-right:4px;"></span>进度中 30%</span>
</div>
<div style="margin:0 0 16px;"></div>
```
> 图例圆点用 CSS span：实心圆（`8px + border-radius:50% + background:主色`）与空心圆（`8px + border-radius:50% + border:1px solid`）区分两段，不写字形字符。

### 1.3 表格宽度与换行注意

- 容器与所有列**一律百分比（flex）**，绝不用固定 px 宽度，否则手机端溢出破版。
- 长英文/长链接会给列撑破——在文本列加 `min-width:0`，长内容 `word-break:break-word`。
- 列数控制在 4 列以内：手机内容区窄（约 `视口宽−120px`），超过 4 列每列太窄，数字与标签会挤到换行。列多时优先"纵向表格"（一行一个标签 + 一个值，见变体）。
- 数字与单位同行放（如 `120 kg`），避免数字换行后单位单独一行；必要时数字列 `white-space:nowrap`。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：表格与图表底色浅灰 `#f7f9fc`、轨道 `#eef2f8`，颜色克制，只有填充条带主色；斑马纹用最浅灰 `#f7f9fc`，数字列右对齐，整体"简报感"。
- **宣传类**：表头可用品牌主色纯色底或主色底 + 白字；填充条用纯色点缀，增添视觉冲击；达到率数字可放大加色（如 `#18a058` 绿）；但同类图表高度/圆角/底色要统一，只变宽度和颜色。

## 三、样式变体（≥3 种，具体参数）

1. **完整表格（div 网格）**：表头 `#eef3fb` + 正文白/偶行 `#f7f9fc` + `border-top` 行分隔 + 12px 圆角 + 单元格 `padding:10px 14px`。用于多行多列对比、参数规格。（见 1.1）
2. **柱状图卡（占比对比）**：`#f7f9fc` 容器 + 每条灰色轨道 + 纯色填充条 + 左侧标签 + 12px 圆角。用于"渠道占比/品类份额"多组数据。（见 1.2）
3. **进度条卡（达成率）**：粗轨道（14px）+ 纯色填充 + 右对齐小字，标题里数字与目标。用于目标达成、进度推进。（见 1.2）
4. **纵向字段表（标签:值）**：每行左标签右值、中间点线或留白，适合参数少、列多必换的情形。用于产品参数、FAQ 式数据。
5. **两段占比条 + 图例**：一条底 + 两段色 + 下方 CSS 圆点图例。用于"XX : XX"对比（男女占比、完成/进行中）。

## 四、使用时机与位置

- **位置**：数据表格/图表块放在引出结论的"证据"处，通常紧跟论点段落之后；一份报告里可放 1-2 个，不堆叠。
- **时机**：比较型内容（方案对比、渠道对比、价格对比）用表格；单一量化指标（目标达成、进度%）用进度条；两段占比（性别、完成度）用占比条。
- **微信兼容注意**：**复杂表格（合并单元格、跨行列）在微信端渲染不可靠，强烈建议把复杂表格用设计工具导出成图片（uploadimg URL）再放正文**；简单规整的多列表格才用 div 写法。

## 五、风格适配（4 个风格例子）

- **科技商务**：表头 `#1b2a4a` 深蓝白字，填充条纯色深蓝 `#2f6fed`，圆角 8px，轨道 `#eef2fa`。
- **国潮红金**：表头 `#8f1b14` 深红白字，填充条纯色红 `#9a281f`，表内偶数行 `#fff6ec` 浅米。
- **校园清新**：填充条纯色薄荷 `#0ba89b`，表头 `#e8faf4` 浅薄荷 + 深薄荷字，圆角 14px。
- **极简白**：去掉容器底色与描边，仅用 `border-top` 细灰线分隔行，表头白色 + 灰字，填充条单一品牌色（纯色）。

## 六、间距与尺寸（遵守硬规范）

- 表格/图表卡底部边距统一 `margin:0 0 16px`（块距硬规范）。
- 单元格文字 `font-size:14px`、`line-height:1.75`（行高硬规范）；表头可 13px；小字说明 12px。
- 单元格内边距 `padding:10px 14px`（上 10 / 左右 14 / 下 10）；卡片容器 `padding:16px 18px`。
- 图表轨道高 10~14px（柱状 10px、进度条 14px）、圆角为高度一半（`border-radius:5px`~`7px`）。
- 填充条越界裁切 `overflow:hidden`；与标签间距 `margin:4px 0 10px`。

## 七、密度限制

- **一篇数据类内容里表格/图表块 ≤3 个**，且同类图表样式完全统一（同一纯色、同一圆角、同一轨道色）。
- **每个表格 4 列以内**；超过即换纵向字段表或拆成两张。
- **一屏图表填充条的颜色 ≤2 种纯色**，避免彩虹；文字颜色控制在 3 色内。
- 数字右对齐、标签左对齐是规则，不要混排造成视觉乱。

## 八、常见错误（反例 + 正解）

- **反例**：用固定 `width:600px` 画表——手机端直接溢出破版。**正解**：所有列用百分比/flex，容器 `width:100%`。
- **反例**：6 列的大表贴进正文，手机屏幕每列只剩几十像素，数字挤成乱码。**正解**：列数 ≤4，或改纵向字段表/拆两张表/截图成图。
- **反例**：用原生 `<table>` 做合并单元格的复杂表，微信端全乱。**正解**：简单表用 div 网格；复杂表导出图片（uploadimg URL）插入。
- **反例**：表格每行底色、圆角、字号各不同，视觉花。**正解**：同一表格所有行高度、圆角、字号统一，仅表头与偶行用统一浅色区分。
- **反例**：进度条宽度写在 `<div>` 外面或忘了 `overflow:hidden`，填充条冒出圆角外。**正解**：轨道容器写 `overflow:hidden` + 圆角，填充条 `height:100%` 收在内部。

## 九、示例（可用骨架，标注可替换处）

```html
<!-- 骨架：两列完整表格（可扩成 3-4 列） -->
<section style="margin:0 0 16px;border:1px solid #e6ecf5;border-radius:12px;overflow:hidden;">
  <div style="display:flex;background:#eef3fb;padding:10px 14px;">
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;">对比项</div>
    <div style="flex:1;font-size:13px;font-weight:700;color:#2b3a5e;text-align:right;">结果</div>
  </div>
  <div style="display:flex;background:#fff;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">方案 A</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;text-align:right;line-height:1.75;">120</div>
  </div>
  <div style="display:flex;background:#f7f9fc;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">方案 B</div>
    <div style="flex:1;font-size:14px;color:#2b3a5e;text-align:right;line-height:1.75;">210</div>
  </div>
</section>
```
> 可替换处：表头底色（`#eef3fb` → 主色浅调）、填充条纯色（柱状/进度）、行数与内容、数值单位。三列就把每行 `flex:1` 复制成 3 个。

## 十、个性化空间（可调参数与判断依据）

- **可调**：表头底色（浅灰蓝 / 主色底白字 / 深色底）、圆角（8-14px）、单元格内边距（`8px 12px`~`12px 16px`）。**判断依据**：宣传类推文用主色表头更醒目，干货报告用中性灰更耐读。
- **可调**：填充条纯色配色（可与轨道成 2 档深浅，或对比两段用相近两档）。**判断依据**：进度类用单主色纯色简洁，对比类用主色→辅色两档纯色突出差异。
- **可调**：图表卡加不加标题行（用 CSS 圆点前缀或纯文字）。**判断依据**：正文已交代主题时可省略标题直接上图表，独立段落里则加标题。
- **可调**：用表格还是图表。**判断依据**：需要逐行读精确值用表格；只想表达"相对大小/进度"用图表（柱状/进度条）更直视觉冲击。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
