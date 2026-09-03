# 首屏引导关注条（module-followbar）

> 定位：标题下方、正文开篇前的一条「关注 / 星标」提醒带，把「平台默认关注入口」升级成编辑主动引导，提升涨粉转化。
> 调用时机：干货教程、连载系列、情感 / 观点类等**有涨粉诉求**的账号用；纯一次性活动或强营销广告可省略，避免开场就劝退。

## 一、可用写法与语法

关注条是「一条横带」，首选排版语法里的 banner 单行变形，或用内联样式自写。排版语法里没有专用「关注条」标签，所以**通用做法是内联样式**，或复用 `:::` 卡片的轻量版。

**排版语法（轻量，交给排版工具）**——用卡片承放关注文案：

```markdown
::: card 关注我
欢迎常来看稿子，点个关注不错过更新。
:::
```

**排版语法（圆点图例轻量版）**：

```markdown
::: iconlist
- 新朋友点关注，下期直接看
:::
```

若要「左文字 + 右动作」的横排按钮感，改内联样式（见下）。

**内联样式——纯文字变体（最克制）**

```html
<section style="background:#f7f7f7;border-radius:8px;padding:10px 14px;margin:0 0 16px;
display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:13px;color:#888;line-height:1.7;">常来看稿 <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#d4a24c;margin:0 6px;vertical-align:middle;"></span> 更新不错过</span>
  <span style="font-size:12px;font-weight:bold;color:#fff;background:#e56b2f;border-radius:14px;padding:4px 12px;">关注</span>
</section>
```

**内联样式——带圆点标记变体（右部星标圆点）**

```html
<section style="background:#fff8e8;border:1px solid #ffe0a8;border-radius:10px;
padding:10px 14px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:13px;color:#7a5800;line-height:1.7;display:inline-flex;align-items:center;gap:6px;">
    <span style="width:10px;height:10px;border-radius:50%;background:#d4a24c;"></span>新朋友点个关注，下期直接看</span>
  <span style="font-size:12px;font-weight:bold;color:#fff;background:#d4a24c;border-radius:14px;padding:4px 12px;">关注我</span>
</section>
```

**兼容注意**：`display:flex` + `justify-content:space-between` 是低成本横排，微信近 5 年客户端均可用；若遇极老安卓不识别 `flex`，退成 `text-align:center` 纯文字一行即可。动作钮用 `border-radius:14px`（≈高度一半）做成胶囊。

## 二、双模式表现

| 维度 | 文字类 | 宣传类 |
|---|---|---|
| 底 / 边 | 浅灰浅底 `#f7f7f7`、无边框，克制 | 浅色高亮底（青 / 黄）+ 细边框，醒目一点 |
| 动作钮 | 灰白文字 + 主色钮，低调 | 主色实底钮 + 加粗，更抢眼 |
| 文案口吻 | 服务承诺式（「常来看、不错过」） | 利益钩子式（「新朋友关注领教程」） |
| 字数 | ≤14 字左文案 | 可 ≤18 字，带利益点 |
| 用量 | 首屏 1 条，之后不再重复 | 首屏 1 条，可在结尾呼应一次 |

关注条本身不区分「文字/宣传」的强风格，核心是**克制**：它是一句提醒而非横幅广告，两种模式都保持低饱和底色。

## 三、样式变体（≥3 种）

**变体 A｜纯文字灰条（默认最稳）**——浅灰底 + 右侧胶囊钮。
参数：`background:#f7f7f7;border-radius:8px;padding:10px 14px`；左文案 13px、`#888`；右钮 `background:#e56b2f;color:#fff;font-size:12px;padding:4px 12px;border-radius:14px`；flex 排布 `justify-content:space-between`，`margin:0 0 16px`。这是通用性最好、任何风格都不会出错的默认款。

**变体 B｜圆点星标条（情感 / 陪伴感账号）**——暖黄底 + 星标主色圆点。
参数：`background:#fff8e8;border:1px solid #ffe0a8;border-radius:10px`；左文案 13px、`#7a5800`、前置 CSS 小圆点（`width:10px;height:10px;border-radius:50%;background:#d4a24c`）；右钮 `#d4a24c`；padding `10px 14px`；`margin:0 0 16px`。暖黄系贴近「陪伴 / 温暖」人设。

**变体 C｜纯色底条（宣传 / 活动号进场）**——用主色纯色铺底、整条白字。
参数：`background:#0ba89b` 纯色；`border-radius:8px;padding:12px 16px`；文案白字 14px、居中或左右排；右钮反白 `background:#fff;color:#0ba89b`；仅活动开场可用，普通干货慎用，`margin:0 0 16px`。纯色底条视觉重，用一次就够。

**变体 D｜无底纯文字（极简账号）**——完全去底色，只留一行提示 + 链接。
参数：`text-align:center;font-size:13px;color:#999;letter-spacing:1px;margin:0 0 16px`；不加任何色块，用一句话 + 可选 `**关注**` 加粗强调。极简 / 科技 / 黑白账号的收敛答案。

**变体 E｜「星标」双提示带（帮助读者不迷路的账号）**——同时提「关注 + 设为星标」。
参数：`background:#fff8e8;border:1px solid #ffe0a8;border-radius:10px;padding:10px 16px`；文案两段（左 13px「点关注」、右 13px「设星标不错过」配 CSS 星形/圆点）用 `display:flex;justify-content:space-between`；`margin:0 0 16px`。适合依赖更新的连载 / 日更账号。注意别让「关注 + 星标」两条指令叠得太满，一条一行即可。

## 四、使用时机与位置

- **位置**：标题 / 页眉之下、正文首段（或目录）之前，第一屏黄金位。
- **首屏放置顺序建议**：`# 标题`、关注条、钩子段（或目录）。先给一句轻提醒，不打断正文节奏。
- **克制要求**：开机第一条最重要，别配上密集装饰；整篇通常只放这 1 条（宣传类可在结尾用一条淡的呼应，不重复大钮）。
- **与结尾配合**：结尾想再劝关注时，用更轻的纯文字（见关闭模板），不重复首屏的视觉重条。
- **与目录的先后**：内容本身重、需要先给地图的干货长文，顺序可为「标题、关注条、目录」；短文「标题、关注条、钩子段」即可。

## 五、风格适配

- **国潮红金墨**：底 `#f5efe0`、文字墨 `#4a3a2a`、钮金 `#b8860b` 或红 `#b03a2e`；文案偏「承蒙关注 / 常来看」的谦辞。
- **科技蓝紫**：底 `#eef3ff`、文案深蓝 `#1a3a66`、钮 `#2f6fed`；文案可带「持续更新 / 下期技术拆解」的信息承诺。
- **校园青春**：底 `#eafaf7`（浅青）、钮 `#00b8a9`；文案口语（「别迷路，点个关注」），标记用 CSS 圆点或 art:// 小草。
- **极简黑白**：走变体 D 无底纯文字，只留一句灰字；不出现任何色块与按钮，与裸奔开篇呼应。
- **商务 / 知识付费**：底 `#f4f6f8`、文案深灰、钮主品牌色；文案偏「订阅本栏目，每周一篇拆解」的价值承诺。

## 六、间距与尺寸（遵守硬规范）

- 关注条底部与下一块：**16px**（`margin:0 0 16px`）。
- 块内 padding：`10px 14px`（紧致）或 `12px 16px`（宽松），文案与底边 ≥8px。
- 文案字号 13px、`line-height:1.7`；钮字号 12px。
- 若紧跟页眉 banner，banner 已自带 `margin:0 0 16px`，关注条上不再叠加空段，避免两段空隙堆叠。
- 变形为整条纯色时 padding 提到 `12px 16px`，保持内容不贴边。
- 若把关注条包进卡片（`::: card 关注我`），卡片内文按 `14px 16px 12px` 规范。

## 七、密度限制

- **首屏最多 1 条**；整篇关注 / 星标提醒 ≤2 次（一次首屏、一次结尾纯文字，且不要摆相同的大钮）。
- 关注条不重复出现在中段；中段的涨粉引导交给「往期回顾 / 下期预告」模块。
- 底色纯色关注条（变体 C）一篇至多 1 处，避免满屏都是「关注」二字形成噪音。
- 变体 E 的双提示（关注 + 星标）整篇只出现一次，且不要在首屏同时再叠「目录」等其它大块。

## 八、常见错误

- **反例**：关注条塞在引言中间打断阅读，或首屏没放、正文三分之二才出现。**正解**：放标题下方第一屏黄金位；中段转用「往期回顾」承接。
- **反例**：左文案写成长句（「如果你觉得这个内容对你有帮助就请点击右上角关注我们这个公众号并设为星标以免走丢」）——又长又低声下气。**正解**：≤14 字、利落（「常来看，不错过更新」），动作词「关注」外置成钮。
- **反例**：整条纯色 + 大圆钮 + 多个标记叠在一起，开场像广告弹窗。**正解**：克制——低饱和底 + 单钮，纯色条变体留给活动开场。
- **反例**：关注条 `margin-bottom:0` 紧贴标题下无空隙。**正解**：下留 16px。
- **反例**：一篇里首屏、中段、结尾各放一条相同的大钮，满屏「关注」。**正解**：整篇 ≤2 次且结尾降级为纯文字。
- **反例**：活动号把纯色关注条当默认样式，每篇都上重色块。**正解**：纯色条只留给真活动开场，日常走变体 A 灰条。

## 九、示例（骨架，标注可替换处）

**克制默认（纯文字灰条）**

```markdown
# 高效阅读的三个方法

<section style="background:#f7f7f7;border-radius:8px;padding:10px 14px;margin:0 0 16px;
display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:13px;color:#888;line-height:1.7;">常来看稿 <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#d4a24c;margin:0 6px;vertical-align:middle;"></span> 更新不错过</span>
  <span style="font-size:12px;font-weight:bold;color:#fff;background:#e56b2f;border-radius:14px;padding:4px 12px;">关注</span>
</section>

正文首段（可替换）……
```

**活动开场（纯色条）**

```html
<section style="background:#0ba89b;border-radius:8px;
padding:12px 16px;margin:0 0 16px;text-align:center;">
  <span style="font-size:14px;color:#fff;letter-spacing:1px;">新朋友点关注，领本期资料包</span>
</section>
```

**结尾纯文字呼应（轻到可忽略）**

```html
<p style="text-align:center;font-size:13px;color:#aaa;margin:16px 0 0;line-height:1.75;">喜欢这期就点个关注，我们下期见。</p>
```

**排版语法版**

```markdown
::: card 关注我
欢迎常来看稿子，点个关注不错过更新。
:::
```

## 十、个性化空间

- **动作钮文案**：可换「关注」「关注我」「订阅」「追更」；判断依据：账号称呼习惯（服务号用「关注」，个人 IP 用「关注我」更亲切）。
- **底色 / 钮色**：换账号主色；判断依据是品牌 VI，关注条主色必须与页眉、按钮同体系，避免每块一个色。
- **是否带标记 / 图标**：判断依据是账号人设——轻松 / 陪伴型放 CSS 圆点或 art:// 植物图案，严肃 / 知识型不放。
- **文案承诺维度**：可承诺「更新频率 / 下期内容 / 资料领取」，判断依据是读者最在意什么：干货号承诺「持续更新 + 资料」，情感号承诺「每周陪伴」。
- **是否加「设星标」提示**：判断依据读者是否容易漏更——连载 / 日更号建议加，周更低频号可省。
- **放不放**：判断依据是**涨粉诉求强度**——连载、系列教程、情感号强烈建议；一次性活动号可省。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
