# 徽章 / 高亮（module-badge）

> 定位：用小徽章（标签、角标）给价格/标签/类别"盖个章"，用高亮标记把重点文字"涂出来"，一眼抓住读者。
> 调用时机：价格、促销标签、栏目名、金句、关键词需要"点出来"时用；替代大段下划线/加粗，提升可扫性。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体。徽章是**行内 `<span>`**（随文字排布）或**单个块**；高亮是**行内 `<mark>` 或 `<span>`**，给文字加底/加色。

### 1.1 行内小标签徽章（挂在词条/价格旁）

浅底色、小圆角、小字号 `span`，挂在标题、词条、价格数字旁做"官方盖章"。规格统一：`display:inline-block`、`font-size:12px`、`line-height:1`、`padding:3px 7px`、`border-radius:4px`、`margin-left:8px`、`vertical-align:2px`。

```html
<p style="font-size:15px;color:#2b3a5e;line-height:1.75;">
  精选好物
  <span style="display:inline-block;background:#fff1f0;color:#d4380d;font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px;">新品</span>
  限时 5 折
  <span style="display:inline-block;background:#fff7e6;color:#d48806;font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px;">仅今天</span>
</p>
```

### 1.2 右上角角标徽章（卡片角落提示）

绝对定位到卡片右上角，切出一个斜角，常见于"爆款/HOT/限量"卡。要点：角标顶到卡片右上角，一个角用曲线贴合卡片圆角。

```html
<section style="position:relative;background:#f7f9fc;border-radius:12px;padding:14px 16px;margin:0 0 16px;overflow:hidden;">
  <span style="position:absolute;top:0;right:0;background:#c0392b;color:#fff;font-size:11px;line-height:1;padding:4px 10px 4px 12px;border-radius:0 12px 0 12px;">HOT</span>
  <p style="margin:0;font-size:14px;font-weight:700;color:#2b3a5e;">爆款清单</p>
  <p style="margin:6px 0 0;font-size:13px;color:#8a94a6;">跟正文呼应的简短说明。</p>
</section>
```
- 角部裁切：`border-radius:0 12px 0 12px`（左上 0、右上、左下 0、右下）与容器圆角呼应。
- 容器必须 `overflow:hidden` 保证裁切干净；角标用纯色块 + 细边框即可，不必依赖定位以外的装饰字符。

### 1.3 高亮标记（== 高亮 ==）

高亮 = 给关键词加浅底 + 深字，让人"一眼看到重点"。用行内 `<span>` 模拟 `<mark>`（更可控）。规格：`background:#fff3bf`（浅黄）或主色浅调、`color:深色`、`padding:1px 4px`、`border-radius:3px`、`font-weight:700`。

```html
<p style="font-size:15px;color:#333;line-height:1.75;">
  这句的<span style="background:#fff3bf;color:#b8860b;font-weight:700;padding:1px 4px;border-radius:3px;">重点词</span>要被一眼抓住。
</p>
```
- 高亮色板：浅黄 `#fff3bf`/`#b8860b` 字（最通用）、主色浅底（如蓝 `#e6f4ff`/`#1890ff` 字）、警示橙 `#fff7e6`/`#d48806` 字。
- 高亮与加粗并用要克制：高亮词本身就是重点，不再额外加下划线；一段里高亮 ≤1 处。

**加粗 / 高亮 / 下划线三层怎么分工**：
- 全文加粗可多次用（≥4-10 处）——做出"普通层级"的强调，如段落内的小标题缩写、关键流程词。
- 高亮每屏 ≤1 处——只在"这一屏最要紧的一句"上用，制造唯一焦点；其余别轻易启用，否则每个都像重点。
- 下划线主要用于链接/可点击，**不建议拿来强调**（易与链接混淆）；需要强调用高亮或加粗，不要三者叠在同一词上。
- 若一句话同时有"提一下"和"必须记住"两个层次，用加粗给前者、把高亮留给后者——一屏只留一个高亮焦点。

### 1.4 图文二选一：用高亮还是徽章

- **高亮（==文字==）**：给句子里的关键词"涂色"，强调含义，适合正文朗读流中被"闪一下"的要点。
- **徽章（标签/角标）**：给词条/卡片"盖章"，像标签/价格签，适合需要"归类/标注"的场景（价格、促销、类别、状态）。
- 判断：是"这句话里哪个词重要"→ 高亮；是"这是什么东西、什么价"→ 徽章。两者可同段混用但各司其职。

实际组合示例（一款课程推文里三者共存但不拥挤）：给课程标题挂一枚"限时 5 折"胶囊徽章，给正文关键技能名做浅黄高亮。一卡一件、一屏一个高亮，层级清晰各司其职：

```html
<section style="background:#fff;border:1px solid #ececec;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#2b3a5e;line-height:1.75;">
    爆款课程
    <span style="display:inline-block;background:#fff7e6;color:#d48806;font-size:12px;line-height:1;padding:3px 7px;border-radius:999px;margin-left:8px;vertical-align:2px;">限时 5 折</span>
  </p>
  <p style="margin:0;font-size:14px;color:#555;line-height:1.75;">
    这套课专门教<span style="background:#fff3bf;color:#b8860b;font-weight:700;padding:1px 4px;border-radius:3px;">排版实战</span>，从标题到结尾一次讲透。
  </p>
</section>
```

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：徽章用中性浅底（`#fff7e6` 米 / 极浅灰 `#f5f5f5`），高亮用浅黄 `#fff3bf`，比例低、色泽温和；价格徽章不高亮、不加红色纯色块更重的样式，只用一枚中性小标签淡淡标出"限时"即可。每屏高亮 ≤1 处，不打扰正文。
- **宣传类**：徽章可用主色/高饱和纯色小标（`#c0392b` 红、`#2f6fed` 蓝）更抓眼，价格徽章放大加粗（12-13px、`font-weight:700`），甚至换角标形态挂卡片；高亮可用主色浅底强调"品牌关键词"。但整体仍遵守"徽章 ≤3、高亮每屏 ≤1"的密度线，颜色 ≤3 色。

> **模式切换关键**：同一枚徽章在文字类用"浅底深字"、在宣传类用"纯色底白字"即可完成切换，不必改位置与数量——保持结构稳定、只换外观，是双模式切换最稳的做法。

**同一场景双模式对照（价格徽章）**：

| 位置 | 文字类表现 | 宣传类表现 |
|---|---|---|
| 徽章底色 | `#fff7e6` 浅米（深字 `#d48806`） | `#c0392b` 红纯色（白字） |
| 徽章字号 | 12px、普通粗细 | 12-13px、`font-weight:700` |
| 高亮标记 | 浅黄 `#fff3bf` | 主色浅底/品牌色浅底 |
| 数量 | 徽章 ≤2 | 徽章 ≤3（仍守上限） |
| 整体调性 | 温和平稳、不打扰正文 | 抓眼、制造紧迫与转化感 |

> 结构（挂在词条/卡片哪个位置、多少个）两模式尽量一致，只变外观色与字号，便于读者建立稳定认知；任意模式下都遵守"徽章 ≤3、每屏高亮 ≤1"。

## 三、样式变体（≥3 种，具体参数）

1. **行内小标签徽章**：12px、`padding:3px 7px`、`border-radius:4px`、浅底深字、`margin-left:8px`、`vertical-align:2px`。价格/标签旁。（见 1.1）
2. **右上角角标徽章**：11px、纯色底白字、`position:absolute;top:0;right:0`、`border-radius:0 12px 0 12px`、容器 `overflow:hidden`。卡片角落提示。（见 1.2）
3. **高亮标记**：`background:浅底 + color:深字 + padding:1px 4px + border-radius:3px + font-weight:700`。正文金句/关键词。（见 1.3）
4. **圆点状态徽章**：CSS 小圆点 + 文字组合（空心圆/实心圆 span + 状态文字），用于"已读/未读、开票/不开票、正在报名"等状态标注。绿色点 = 可行/开放、橙色点 = 提醒、灰色点 = 关闭：

```html
<span style="font-size:13px;color:#333;line-height:1.75;">
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#18a058;margin-right:6px;"></span>
  报名中（本周三截止）
</span>
```

5. **描边徽章**：不填色、只用边框 + 深色文字（`border:1px solid 主色; color:主色; border-radius:999px; padding:2px 10px`），极简/商务风最常用：

```html
<span style="display:inline-block;border:1px solid #2166ff;color:#2166ff;font-size:12px;line-height:1;padding:3px 10px;border-radius:999px;vertical-align:2px;">新功能</span>
```

辅以 art:// 植物图案做点缀（不占位、不加字形字符）：`![小草](art://sprig-grass)`、`![花枝](art://blossom-branch)`。

## 四、使用时机与位置

- **位置**：行内标签徽章挂词条/价格/类目旁；角标徽章在卡片左上/右上角；高亮在正文句子内。徽章常出现在标题、卡片、价格区、分类标签处。
- **时机**：价格与促销场景（价格+限时徽章）、栏目/类别标记（`新专栏` `干货` `连载`）、金句强调、产品参数标注。
- **内容类型**：带货/课程/会员多用价格与促销徽章；干货/教程多用高亮标重点；品牌号/系列用栏目徽章；情感/观点文用单点高亮金句。

**按场景选徽章的快速参考**：

| 场景 | 用哪种徽章/高亮 | 一条理由 |
|---|---|---|
| 价格数字旁 | 行内小标签（限时/优惠） | 直接盖章在价格上，一眼看到 |
| 卡片提示 | 右上角角标（HOT/限量） | 不占正文，角落抓眼球 |
| 栏目/系列名 | 胶囊描边徽章 | 归类清晰、不抢正文 |
| 状态（报名/售罄） | 圆点状态徽章 | 点色传达"开/关"，直观 |
| 金句里的关键词 | 高亮标记（==词==） | 涂色闪出重点，不打断朗读 |
| 品牌关键词强调 | 主色浅底高亮 | 与主色呼应，突出品牌

## 五、风格适配（4 个风格例子）

- **科技商务**：描边徽章（`border:1px solid #2166ff;color:#2166ff;border-radius:999px`），高亮蓝色浅底 `#e6f4ff`/`#1890ff` 字；角度锋利、克制。
- **国潮红金**：徽章红底白字（`#9a281f`），角标金 `#d4a24c`；高亮浅米 `#fff6ec`/`#a06a1a` 字。
- **校园清新**：薄荷绿实底浅圆角徽章（`#0bbf8f` 白字、`border-radius:6px`），高亮浅薄荷 `#e8faf4`/`#0a6b52` 字；活泼。
- **极简白**：一律描边徽章（灰边 `#d9d9d9` + 深灰字），高亮只用浅灰 `#f5f5f5`/`#333` 字，近乎隐形、全靠留白。

## 六、间距与尺寸（遵守硬规范）

- 徽章/高亮是行内元素，不单独占块距；所在段落仍遵守行高 `line-height:1.75`、块距 16px。
- 行内标签徽章：字号 12px、`padding:3px 7px`、`border-radius:4px`、`margin-left:8px`、`vertical-align:2px`。
- 角标徽章：字号 11px、`padding:4px 10px 4px 12px`、斜角 `border-radius:0 12px 0 12px`。
- 高亮：`padding:1px 4px`、`border-radius:3px`；与前后文字间距正常文不加额外 margin。
- 卡片内徽章与正文间距 ≥8px；角标不挤正文标题（标题在卡片内留 `padding-top` 空间）。

**徽章/高亮参数速查表**：

| 元素 | 字号 | 内边距 | 圆角 | 备注 |
|---|---|---|---|---|
| 行内小标签徽章 | 12px | `3px 7px` | 4px | `vertical-align:2px`，`margin-left:8px` |
| 右上角角标徽章 | 11px | `4px 10px 4px 12px` | `0 12px 0 12px` | 容器 `overflow:hidden` |
| 描边胶囊徽章 | 12px | `3px 10px` | 999px | `border:1px solid` 主色 |
| 圆点状态徽章 | 8px 点 | — | 50% | 点 `margin-right:6px` |
| 高亮标记 | 13-15px | `1px 4px` | 3px | `font-weight:700`，浅底深字 |

**微信兼容注意**：徽章/高亮都是行内元素，微信端渲染稳定，但有两个坑——1 绝对定位角标必须要容器 `overflow:hidden`，否则斜角切不开；2 高亮/徽章的浅底在较深背景/深色模式下对比不足，务必保持"浅底 + 足够深的字"（如 `#fff3bf` 底 + `#b8860b` 字），不要在徽章上写浅色文字配浅色底。

## 七、密度限制

- **徽章 ≤3 个/篇**（index 模块铁律）；超出就收，让徽章保持"盖章"的稀缺感。
- **高亮每屏 ≤1 处**；同一屏出现 2 个以上高亮，读者分不清哪个更重要，反而失去重点。
- **角标徽章 ≤2 个/篇**，且只在最重要的卡片上；别每张卡都挂 HOT/限量。
- 颜色数整体 ≤3 色；一屏徽章+高亮颜色不超 4 个色样，避免花。

## 八、常见错误（反例 + 正解）

- **反例**：一篇贴了 7 个徽章，读者麻木，不知道该注意哪个。**正解**：徽章 ≤3，只在价格、栏目、促销等关键标签上"盖章"。
- **反例**：一段正文连续 4 处 ==高亮==，全部"重点"等于没重点。**正解**：高亮每屏 ≤1 处，其余用普通加粗/留白区分层级。
- **反例**：角标徽章的 `border-radius:0 12px 0 12px` 忘了容器 `overflow:hidden`，斜角露出难看缺口。**正解**：角标所在卡片写 `overflow:hidden`，切角才干净。
- **反例**：徽章用 `display:inline-block` 却忘记 `vertical-align:2px`，标签贴到词条底部错位。**正解**：行内徽章 `vertical-align:2px` 微调垂直对齐。
- **反例**：高亮直接嵌在超长句中间、前后无停顿，读者读不出边界。**正解**：高亮只标 1-4 字的短词，前后留标点或空格作为停顿。

## 九、示例（可用骨架，标注可替换处）

**骨架 A · 价格标签徽章（带货）**：

```html
<p style="font-size:17px;color:#b3261e;font-weight:700;line-height:1.75;">
  ¥299
  <span style="display:inline-block;background:#fff1f0;color:#d4380d;font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px;">限时 48 小时</span>
  <span style="display:inline-block;background:#fff7e6;color:#d48806;font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px;">买一送一</span>
</p>
```
> 可替换处：价格、两枚徽章文字与浅底/深字色（红/橙），数量保持 ≤3 个徽章。

**骨架 B · 栏目标签徽章（品牌号）**：

```html
<p style="font-size:14px;color:#8a94a6;line-height:1.75;">
  <span style="display:inline-block;background:#e6f4ff;color:#1890ff;font-size:12px;line-height:1;padding:3px 9px;border-radius:999px;margin-right:8px;vertical-align:2px;">○○专栏</span>
  第 12 期 · 数据与图表
</p>
```
> 可替换处：徽章文字、浅蓝底 `#e6f4ff`/蓝字 `#1890ff`、圆角 999px（胶囊形）。

**骨架 C · 金句高亮（观点文）**：

```html
<p style="font-size:15px;color:#333;line-height:1.75;">
  与其焦虑，不如<span style="background:#fff3bf;color:#b8860b;font-weight:700;padding:1px 4px;border-radius:3px;">现在就做</span>第一小步。
</p>
```
> 可替换处：高亮词（≤4 字）、浅黄底 `#fff3bf`/深字 `#b8860b`、圆角 3px。

**骨架 D · 右上角角标徽章（卡片）**：

```html
<section style="position:relative;background:#f7f9fc;border-radius:12px;padding:14px 16px;margin:0 0 16px;overflow:hidden;">
  <span style="position:absolute;top:0;right:0;background:#c0392b;color:#fff;font-size:11px;line-height:1;padding:4px 10px 4px 12px;border-radius:0 12px 0 12px;">HOT</span>
  <p style="margin:0;font-size:14px;font-weight:700;color:#2b3a5e;">爆款清单</p>
  <p style="margin:6px 0 0;font-size:13px;color:#8a94a6;">跟正文呼应的简短说明。</p>
</section>
```
> 可替换处：角标文字（HOT/限量/新品）、纯色 `#c0392b`、卡片圆角与角标切角保持一致。

**骨架 E · 描边胶囊徽章（商务极简）**：

```html
<p style="font-size:14px;color:#2b3a5e;line-height:1.75;">
  <span style="display:inline-block;border:1px solid #d9d9d9;color:#666;font-size:12px;line-height:1;padding:3px 10px;border-radius:999px;margin-right:8px;vertical-align:2px;">已验证</span>
  <span style="display:inline-block;border:1px solid #2166ff;color:#2166ff;font-size:12px;line-height:1;padding:3px 10px;border-radius:999px;margin-right:8px;vertical-align:2px;">官方认证</span>
</p>
```
> 可替换处：徽章文字、描边色（灰 `#d9d9d9` 中性 / 主色 `#2166ff` 强调）、圆角 999px。

## 十、个性化空间（可调参数与判断依据）

- **可调**：徽章形状（直角 4px / 胶囊 999px）、填色 or 描边、纯色底。**判断依据**：商务极简用描边胶囊，宣传带货用纯色填色；直角更理性、胶囊更亲和。同一篇只保留一种形状语言（全直角或全胶囊），别混。
- **可调**：高亮底色与字色（浅黄 `#fff3bf`/`#b8860b`、主色浅底 `#e6f4ff`/`#1890ff`、警示橙 `#fff7e6`/`#d48806`、中性浅灰 `#f5f5f5`/`#333`）。**判断依据**：强调"重要"用黄，强调"品牌"用主色浅底，强调"警示"用橙，极简用灰；与正文底色的对比要足够（浅底 + 深字）。
- **可调**：徽章/高亮的字号与 padding。**判断依据**：副标题/正文旁的徽章小一号（11-12px、`padding:2px 6px`），标题/价格旁可 12-13px（`padding:3px 8px`）；高亮统一 13-15px（跟随正文）、`padding:1px 4px`。字号越大越像"印章"，越小越像"脚注"。
- **可调**：一屏徽章用到 2 个还是 3 个。**判断依据**：信息密集的带货文可到 3 个（价格+限时+赠品），观点/干货文 1-2 个即可；同一卡片标签 ≤2 个避免拥挤。若要多挂，改用更小的字号与更淡的颜色对冲。
- **可调**：徽章/高亮与正文的层级关系。**判断依据**：想让"标签"高于正文（如价格）就用实色/稍大字号；想让其低于正文（如脚注/来源）就用浅底小号、`color` 灰化。层级清晰是徽章排版的关键。

> **调参自查**：改完任何一项后，把整段文字截图到手机看一屏——若一眼能分清"哪个是重点/哪个是标签、哪个是正文"，则火候正好；若满屏都是"盖章/涂色"，说明密度超了，回退到节七的限制。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
