# 零图标装饰（module-legend）

> 定位：推文正文**禁止出现任何 emoji 与图标字符**。本条目解决"需要给关键信息做标记、配说明、交代符号含义"时的替代方案——用序号文字、CSS 圆点/方块/菱形、或 art:// 植物图案给信息"做标记"，让读者一眼看懂结构，全程不出现一个 emoji 或 Unicode 图标字符。
> 调用时机：参数对比、清单、FAQ、教程需要先交代"这些标记代表什么"时；或正文需要区分多类要点、步骤序号、行内角标时。全文任何需要"标记 + 文字"组合的位置都可调用。**凡是想用 emoji/图标的冲动，一律改到这里用零图标方案解决。**

## 一、为什么禁止 emoji 与图标字符

- emoji 自带颜色、多样式，在不同机型/深色模式下渲染不一，且自带强烈情绪，容易把正文视觉搅乱、与品牌主色冲突、显得廉价花哨。
- Unicode 几何图标字符（菱形、箭头、对勾、叉号、星形、圆点、三角等装饰字形）样式不可控，微信端渲染参差，也会被当成装饰噪声。
- 我们的设计规范统一为：**零 emoji、零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案**。需要"做标记"时，用下面三选一：
  1. **序号文字**：普通数字 1 2 3，或 CSS 圆底数字（span 圆形 + 数字，见 2.3）——排序、分类的最稳做法。
  2. **CSS 几何形状**：span 圆角/旋转拼的圆点、方块、菱形、细线、圆形序号，颜色完全贴主色。
  3. **art:// 植物图案**：sprig-grass 小草 / vine-frame 藤蔓花框 / blossom-branch 花枝 / leaf-corner 叶角，用在标题旁、气泡角、分割线中央等点缀处。

## 二、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体/icon 字体库/`<svg>`。**不用 emoji、不用 Unicode 图标字符**。图形只能用 `<span>` + 内联样式（圆角/旋转/细边框）拼几何形状，或用 `![说明](art://植物图案)`。flex、圆角、细边框、纯色背景可用；渐变与阴影禁用。

### 2.1 序号文字图例卡（1 2 3 + 标题 + 说明 三行式）

图例卡是一个浅色容器，里面每行 = 左边一个序号（1/2/3）+ 加粗标题 + 右边灰色说明。放在长文开头，先向读者交代三类要点，正文就只管用序号标注、不再重复解释。

容器规格：`background:#f7f9fc`（浅灰）、`border:1px solid #e6ecf5`（浅蓝灰细边框）、`border-radius:12px`、内边距 `padding:16px 18px`、底部边距 `margin:0 0 16px`。容器第一行是标题（14px、加粗、`color:#2b3a5e`、底部 `margin:0 0 10px`）；下面每行用 `<p>` 包（14px、`line-height:1.9`），行内 `span` 空隙统一：序号 `margin-right:8px`、标题加粗、说明灰字 `color:#8a94a6` 且 `margin-left:8px`。

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;margin:0 0 16px;border:1px solid #e6ecf5;">
  <p style="margin:0 0 10px;font-size:14px;color:#2b3a5e;font-weight:700;">阅读图例</p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;color:#2b3a5e;font-weight:700;">1</span><b style="color:#2b3a5e;">可行方案</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 已实测、可直接用</span>
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;color:#d46b08;font-weight:700;">2</span><b style="color:#2b3a5e;">注意点</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 踩过的坑、易错处</span>
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;color:#c0392b;font-weight:700;">3</span><b style="color:#2b3a5e;">重点</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 本篇核心、建议收藏</span>
  </p>
</section>
```

### 2.2 单个要点卡（序号/圆点点缀 + 一句说明）

不解释整套符号，只强调单个知识点时用。左竖条 + 浅橙底 + 序号文字标题，独立成块。此处的"标记"用序号文字（1/2/3）或 CSS 圆点均可。

容器：`background:#fff8f1`（浅橙）、`border-left:4px solid #fa8c16`（橙竖条）、`border-radius:8px`、`padding:12px 16px`、`margin:0 0 16px`。标题 15px、加粗、`color:#d46b08`；说明 14px、`color:#7a5233`、`line-height:1.75`。

```html
<section style="background:#fff8f1;border-left:4px solid #fa8c16;border-radius:8px;padding:12px 16px;margin:0 0 16px;">
  <p style="margin:0;font-size:15px;font-weight:700;color:#d46b08;">
    <span style="margin-right:8px;">1</span>一句话核心技巧
  </p>
  <p style="margin:6px 0 0;font-size:14px;line-height:1.75;color:#7a5233;">
    跟正文呼应的简短说明，把方法论压缩成一句可带走的话。
  </p>
</section>
```

### 2.3 CSS 几何形状做标记（全用 span 拼，颜色贴主色）

全部用 `<span>` + 内联样式拼出几何图形，不依赖任何字符图标，颜色可完全贴合品牌主色。常用五种：

- **圆形数字徽标**（步骤序号，最常用）：22px 圆、纯色底、白字。关键：`display:inline-flex` + `width:22px;height:22px;border-radius:50%` + `background:#1a7fd1`（纯色，不用渐变）+ `color:#fff;font-size:13px;font-weight:700` + `align-items:center;justify-content:center`。
- **空心圆带勾**（勾选态单选项）：18px 圆、粗边框 + 内部放号或直接留白配旁边文字。`border:2px solid #2f9e5f;color:#2f9e5f;font-size:12px`（不同字形，只用边框与纯色传达状态）。
- **实心圆点**（列表项目符号 / 标记）：8px 纯色圆。`border-radius:50%;background:#1a7fd1;margin-right:8px`。
- **旋转方块（菱形）**（分隔 / 点缀）：8px 方块 `transform:rotate(45deg);border-radius:2px`，用 `#d48806` 或主色。
- **细线标记**（角标 / 强调点）：`display:inline-block;width:24px;height:2px;border-radius:1px;background:主色;margin-right:8px;vertical-align:middle`。

```html
<!-- 圆形数字序号（纯色，无渐变） -->
<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:#1a7fd1;color:#fff;font-size:13px;font-weight:700;align-items:center;justify-content:center;">1</span>
<!-- 空心圆（勾选态，细边框 + 纯色） -->
<span style="display:inline-flex;width:18px;height:18px;border-radius:50%;border:2px solid #2f9e5f;align-items:center;justify-content:center;"></span>
<!-- 实心圆点 -->
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1a7fd1;margin-right:8px;"></span>
<!-- 旋转方块（菱形） -->
<span style="display:inline-block;width:8px;height:8px;background:#d48806;transform:rotate(45deg);border-radius:2px;margin-right:8px;"></span>
<!-- 细线标记 -->
<span style="display:inline-block;width:24px;height:2px;border-radius:1px;background:#1a7fd1;margin-right:8px;vertical-align:middle;"></span>
```

> 需要更丰富、更"植物/自然"的点缀时，用 art:// 植物图案，不用拼复杂几何：`![小草](art://sprig-grass)`（分割线中央、气泡角）、`![花枝](art://blossom-branch)`（标题旁）、`![藤蔓花框](art://vine-frame)`（大图装饰框）、`![叶角](art://leaf-corner)`（卡片角）。

### 2.4 行内小标签（词条 / 价格旁挂小标）

浅底色小圆角 `span`，挂在词条或数字旁边做标注（不属于图标字符，是文字标签，合规）。规格：`display:inline-block`、`background:#fff1f0`、`color:#d4380d`、`font-size:12px`、`line-height:1`、`padding:3px 7px`、`border-radius:4px`、`vertical-align:2px`、`margin-left:8px`。

```html
<p style="font-size:15px;color:#2b3a5e;line-height:1.75;">
  精选好物
  <span style="display:inline-block;background:#fff1f0;color:#d4380d;font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px;">新品</span>
  限时 5 折
  <span style="display:inline-block;background:#fff7e6;color:#d48806;font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px;">仅今天</span>
</p>
```

## 三、双模式表现（文字类 / 宣传类）

- **文字类**：标记最克制，只给最关键的 1-3 个要点配序号/圆点；行内标记间距统一 `margin-right:8px`；图例卡底色浅灰 `#f7f9fc`，不抢正文；靠灰字说明承担信息，不用任何图标字符。
- **宣传类**：标记可更大胆——序号文字放大加粗、图例卡可换主色浅底（如 `#e6f4ff` 蓝）+ 主色细边框；圆形序号用更大字号纯色。但一屏标记仍 ≤5 个、颜色仍 ≤3 色，防止花哨覆盖正文重点。可引用一指 art:// 植物图案做角饰，一个气泡顶多加一处。

## 四、样式变体（≥3 种，具体参数）

1. **浅灰序号图例卡**：`#f7f9fc` 底 + `#e6ecf5` 细边框 + 12px 圆角 + 16px 18px 内边距，行首用 1 2 3 或 1 2 3。用于长篇教程、清单开头交代结构。（见 2.1）
2. **单条要点卡**：`#fff8f1` 浅橙底 + `4px #fa8c16` 左竖条 + 8px 圆角 + 12px 16px 内边距，标题前序号文字。用于强调单个知识点。（见 2.2）
3. **CSS 圆形数字步骤**：纯色圆 + 白字序号，无图标字符，颜色贴主色。用于步骤流程、参数对比序号、FAQ 编号。（见 2.3）
4. **CSS 圆点 / 方块标记组**（多语义并列清单）：用纯色圆点或旋转方块做项目符号，底色浅调（`#e6f4ff` 蓝 / `#fff7e6` 橙 / `#fff1f0` 红），文字用同系深色（`#1a7fd1` / `#d48806` / `#d4380d`），深浅搭配、对比清晰，全程无图标字符。
5. **art:// 植物点缀**：sprig-grass 小草（气泡角、分割线中央）、blossom-branch 花枝（标题旁）、vine-frame 藤蔓花框（大图框）、leaf-corner 叶角（卡片角）。用在需要一点自然气质的点缀处。

## 五、使用时机与位置

- **位置**：图例卡放正文开头（结构说明区），紧跟章节标题或首屏引导之后；单个要点卡放对应知识点附近；CSS 序号用于步骤或同类项罗列；行内标签就近挂词条；art:// 植物图案放在标题旁/气泡角/分割线中央等点缀位。
- **时机**：正文会用 3 个以上不同记号（1 2 3 或不同圆点色）时，先上图例卡；只用 1-2 个记号时不必上图例卡，直接在行内标注。
- **内容类型**：教程、清单、FAQ、参数对比、操作指南优先用；纯讲故事的推文慎用任何标记，避免打断情绪流。

## 六、风格适配（4 个风格例子）

- **校园清新**：标记统一 1 个主色（薄荷绿 `#0bbf8f`），图例卡底色 `#e8faf4`、细边框 `#cdeee4`、圆角 14px，圆圈序号用纯色 `#0bbf8f`，可配 sprig-grass 小草点缀。
- **科技商务**：全用 CSS 圆点/方块/细线，图例卡底 `#eef3fb` 浅灰蓝、细边框 `#d6e0f5`，圆点/方块用科技蓝 `#2166ff`，纯色序号，无图标字符。
- **国潮红金**：红金配；图例卡底色 `#fff6ec`、细边框 `#f0d9b8`，序号圆纯色 `#b3261e`、白字，强调点缀 `#d4a24c` 金。
- **极简白**：去掉图例卡背景与细边框，仅留序号文字或极细圆点 + 灰字，行内间距收紧（`margin-right:6px`），颜色只留黑白灰 + 1 个点缀色。

## 七、间距与尺寸（遵守硬规范）

- 图例卡/要点卡底部边距统一 `margin:0 0 16px`（块距硬规范）。
- 卡内各行 `font-size:14px`、`line-height:1.75` 起，图例卡说明行可 `line-height:1.9`（行高硬规范）。
- 行内标记与文字间距统一 `margin-right:8px`；标记与后文说明间隔 `margin-left:8px`。
- 行内小标签纵向 `vertical-align:2px` 微调对齐；标签内边距 `padding:3px 7px`、字号 12px、圆角 4px。
- CSS 序号圆最小 20px（手机端好点按/看清）；圆角规则：图形 50%，容器 8~14px 视风格。

## 八、密度限制

- **一屏标记 ≤5 个**；连续 3 个以上无停顿的标记行要拆开，让标记当"锚点"而不是"连成线"。
- **同一语义全程固定 1 个记号**（"重点"始终用 3 或某一种圆点色，不换来换去）；图例卡写清楚哪几个记号，正文严格只用这些。
- **颜色全局 ≤3 色**：1 主色 + 1-2 个强调色（红/橙各一）。纯色圆点/方块颜色完全可控，天然不花。
- **深浅搭配**：标记底浅调、字/块深色，对比清晰不刺眼（`#fff7e6` 底 + `#d48806` 字）。

## 九、常见错误（反例 + 正解）

- **反例**：正文里一会用 emoji、一会用 emoji 表示"可行"——读者以为两种意思且整体花哨。**正解**：零 emoji，同一语义固定一个序号或圆点，图例卡里写清楚。
- **反例**：用 Unicode 图标字符做列表符号，样式不可控、机型渲染不一。**正解**：改用 CSS 实心圆点/方块（span 拼），色值可控、渲染稳定。
- **反例**：一屏堆了 8 个不同 emoji，图标连成一条彩色线看不清字。**正解**：一屏标记 ≤5 个，去掉纯装饰图标，只留语义锚点。
- **反例**：emoji 自带红色与文章蓝主色冲突，图显得脏。**正解**：用 CSS 圆点/序号取主色，相邻文本统一到主色系。
- **反例**：图例卡放在正文中间才出现，读者前面已经看不懂序号。**正解**：图例卡放正文开头，正文才用序号。
- **反例**：CSS 形状 span 忘了 `display:inline-flex`，圆点/序号挤成一条竖线或错位。**正解**：每个图形 span 都写 `display:inline-flex`（或 `inline-block`）并配 `align-items/justify-content:center`。

## 十、示例（可用骨架，标注可替换处）

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;margin:0 0 16px;border:1px solid #e6ecf5;">
  <p style="margin:0 0 10px;font-size:14px;color:#2b3a5e;font-weight:700;">阅读图例</p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;color:#c0392b;font-weight:700;">1</span><b style="color:#2b3a5e;">推荐</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 可直接上手</span>
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;color:#2f6fed;font-weight:700;">2</span><b style="color:#2b3a5e;">购买</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 底部有入口</span>
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;color:#d46b08;font-weight:700;">3</span><b style="color:#d46b08;">注意</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 先看这条</span>
  </p>
</section>
```
> 可替换处：图例标题（阅读/速查/重点）、行首序号与其含义、序号颜色（宣传类换主色）、底色（宣传类换主色浅调 `#e6f4ff`、细边框换主色）。

## 十一、个性化空间（可调参数与判断依据）

- **可调**：图例卡底色、细边框色、圆角（8-14px）、内边距（`padding:14px 16px`~`18px 20px`）、行高（1.75~1.9）。**判断依据**：宣传类推文用主色浅底更醒目，干货长文用中性浅灰更耐读。
- **可调**：标记方式选 1 2 3 序号文字 还是 CSS 圆点/方块。**判断依据**：需要排序/分类用序号文字；只要区分"有/无、满/空、类别"用圆点/方块；要点缀自然感用 art:// 植物图案。
- **可调**：CSS 圆形序号尺寸（20-26px）。**判断依据**：手机端字号越小越考验可点性，序号圆 ≥20px 保证看清。
- **可调**：图例卡是三行还是五行。**判断依据**：≥4 个记号才值得上图例卡，3 行以内直接行内标注即可，避免为凑图例卡而堆标记。
- **可调**：是否用 art:// 植物图案点缀。**判断依据**：想要一点自然/品牌气质时用（sprig-grass 小草 / blossom-branch 花枝 / vine-frame 藤蔓花框 / leaf-corner 叶角）；一个气泡顶多加一处。禁用任何 emoji 与 Unicode 图标字符。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
