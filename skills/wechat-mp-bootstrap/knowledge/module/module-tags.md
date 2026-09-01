# 话题标签条（module-tags）

> 定位：在文首/文末用一枚枚"话题标签"把文章的品类、栏目、关键词标出来，方便读者识别、也帮助合集归集。
> 调用时机：系列栏目、品牌号、知识/干货号每篇必用的"归属标记"时用；需要让读者一眼知道"这是哪类/哪个栏目"时用。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体；flex、圆角可用。话题标签条本质是一排"胶囊/圆角小标签"（`#` + 话题词），可横向排列在一行（文末）或紧随标题（文首）。

### 1.1 文末话题标签条（多枚一排）

文末惯例放 2-4 枚标签，总结本篇归属。容器白色/浅色，每枚标签一个胶囊 `span`，`margin-right:8px` 间隔。

```html
<section style="margin:16px 0 0;">
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin-right:8px;"># 公众号运营</span>
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin-right:8px;"># 排版技巧</span>
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin-right:8px;"># 图文模板</span>
</section>
```
- 胶囊规格：12px、浅底深字、`border-radius:999px`、`padding:6px 12px`、`margin-right:8px`。
- 当超过 3 枚标签导致换行时，用 flex-wrap 让它们自动换行，仍保持等距（可用 `.tags` 容器 + 每枚 `margin:4px`）。

**多枚自动换行的标签条（>3 枚时）**——用 flex-wrap + 每枚固定间距，即使换行也不会挤在一起：

```html
<section style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;">
  <span style="background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;"># 公众号运营</span>
  <span style="background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;"># 排版技巧</span>
  <span style="background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;"># 图文模板</span>
  <span style="background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;"># 视觉设计</span>
</section>
```
> 用 `display:flex;flex-wrap:wrap;gap:8px` 让标签在窄屏自动换行、并保持统一间距，比逐个 `margin-right` 更省事且不会在末尾多出多余间距。

### 1.2 文首话题标签条（标题下，单枚或两枚）

紧跟标题/开头引导之后，放 1-2 枚归属标签，让读者一进来就知品类。前置一个 CSS 圆点小标记或"#{栏目名}"。

```html
<p style="margin:0 0 16px;font-size:13px;color:#8a94a6;line-height:1.75;">
  <span style="display:inline-block;background:#e6f4ff;color:#1890ff;font-size:12px;line-height:1;padding:4px 10px;border-radius:999px;margin-right:8px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#1890ff;vertical-align:middle;margin-right:4px;"></span>干货</span>
  <span style="display:inline-block;background:#e6f4ff;color:#1890ff;font-size:12px;line-height:1;padding:4px 10px;border-radius:999px;margin-right:8px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#1890ff;vertical-align:middle;margin-right:4px;"></span>第 5 期</span>
</p>
```
> 文首小标记用 CSS 圆点 span（`6px + border-radius:50% + 主色`），代替符号字形。

### 1.3 合集归集提示（引导加入合集）

话题标签除了识别品类，还能**提示"这是某个合集/系列的哪篇"**，帮读者点开合集追读。做法：在标签条旁加一句"本文属于「××系列」，点击话题可查看系列全部文章"，把标签做成可跳合集入口。

```html
<p style="margin:0 0 16px;font-size:13px;color:#8a94a6;line-height:1.75;">
  本文属于
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin:0 4px;"># 公众号排版 30 讲</span>
  系列 · 点击话题可回看全部
</p>
```

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：话题标签条低调——浅蓝底 `#eef3fb`/`#e6f4ff` + 主色字，形状胶囊，字号 12px；文末 2-4 枚即可，作为"归属注脚"。
- **宣传类**：话题标签可稍醒目——品牌色纯色底白字、胶囊更大（`padding:6px 14px`），可用主题色把重要标签（如 #{爆款栏目}）突出；但整体仍是"分类标记"，不该比标题/正文更抢眼。

## 三、样式变体（≥3 种，具体参数）

1. **浅蓝胶囊标签（文末标准款）**：`#eef3fb` 底 + `#2166ff` 字 + 胶囊 `border-radius:999px` + `padding:6px 12px`。（见 1.1）
2. **主色浅底 + 描边胶囊**：`background:主色浅底 + border:1px solid 主色` + 主色字，略为强调；适合想带一点品牌质感。（见 1.3）
3. **深色纯底重点标签**：`background:主色深一档纯色` 底 + 白字，用于醒目品牌栏目标签；一屏 ≤1 枚与普通浅色标签混排做视觉重点。
4. **CSS 圆点前缀标签**：每枚前带一个 CSS 圆点小标记（`6px + border-radius:50%`），用 `#栏目名` 更"话题感"；文首单枚更清爽。

## 四、使用时机与位置

- **位置**：文末话题标签条是"标准动作"，几乎每篇都放 2-4 枚；文首 1-2 枚仅在"需要读者进门前先知道品类"时放（如干货教程、栏目文首）。
- **时机**：系列栏目、品牌号、知识/干货号每篇必用，用于品类识别与合集归集；单篇独立、无系列可归时只放品类标签即可，不强造系列。
- **内容类型**：知识/干货（品类标签）、系列连载（系列+期数标签）、品牌号（品牌栏目标签）、活动专题（活动名标签）。

## 五、风格适配（4 个风格例子）

- **科技商务**：浅蓝胶囊 `#eef3fb`/`#2166ff`，文末 `# 公众号运营 # 排版` 标准款；克制、专业。
- **国潮红金**：浅米 `#fff6ec` 底 + 深红字 `#8f1b14`，胶囊内加一点金描边 `border:1px solid #d4a24c`；有文化感。
- **校园清新**：浅薄荷 `#e8faf4` 底 + 深薄荷字 `#0a6b52`，胶囊圆角大、间距松（`margin-right:10px`）；活泼清爽。
- **极简白**：无底色，仅灰字 `#999` + `#` 前缀，胶囊用极细下划线或纯文本；近乎隐形、靠文末换行区分。

## 六、间距与尺寸（遵守硬规范）

- 标签条用 `margin:16px 0`（文末）或 `margin:0 0 16px`（文首标题下），遵守块距 16px。
- 胶囊：字号 12px、`padding:6px 12px`、`border-radius:999px`、`margin-right:8px`、`line-height:1`。
- 多枚换行时每枚加 `margin:4px` 兜底（纵向换行也有间隙）。
- 标签内文字不换行（短词）；整条标签条与上方正文之间留 16px。
- 文首标签条与标题间距 ≥12px；标签条与正文首段间距 16px。

## 七、密度限制

- **文末话题标签 2-4 枚**（别堆到 8 枚一片）；文首 1-2 枚。
- **话题命名克制**：一个标签一个主题词（≤8 个字），别塞长句；`#` 或栏目标记统一一种前缀，别一会 `#` 一会圆点一会其他字形混着用。
- **配色 ≤3 色**：标签底色/字色跟随文章主色，混排时只允许"1 枚醒目品牌标签 + 其余浅色"，一屏 ≤1 枚深色重点标签。
- **与内容类型呼应**：干货/教程的标签突出品类与方法；系列连载突出系列名与期数；品牌号突出栏目标识；活动专题突出活动名——标签词跟随正文讲什么来定。
- 话题标签条是"分门别类"而非"堆关键词"，与「徽章」要区分——徽章盖章，话题标签归属分类。
- 话题命名与「话题标签」运营逻辑一致：标签词尽量与公众号可用「合集/话题」名称对齐，方便读者点标签即进入合集，形成"标签 ↔ 话题 ↔ 合集"闭环。

## 八、常见错误（反例 + 正解）

- **反例**：文末堆 8 枚标签，读者视觉疲劳、也显得像堆关键词。**正解**：话题标签 2-4 枚，只留最核心的品类、系列、期数。
- **反例**：标签字体与胶囊细又浅（12px、极浅底），发布后被过度压缩看不清。**正解**：胶囊 `padding:6px 12px`，字色用主色较深，保证小图上可读。
- **反例**：话题标签用长篇句子（如"这是一篇关于公众号运营的实用技巧的合集系列"），既不能点击归集也读不快。**正解**：一个标签 ≤8 字、一个主题词（`# 公众号运营`、`# 排版技巧`）。
- **反例**：文首文末都堆标签，一篇出现八九枚。**正解**：文末标准化放 2-4 枚；文首仅放 1-2 枚，别前后重复同一批。
- **反例**：把话题标签做成全牌变体混用（浅色、深色纯底、描边、纯文本各一个），视觉杂乱。**正解**：一篇内统一一种胶囊底色语言，最多 1 枚品牌深色重点标签做重点。

## 九、示例（可用骨架，标注可替换处）

**骨架 A · 文末标准标签条**：

```html
<section style="margin:16px 0 0;">
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin-right:8px;"># 公众号运营</span>
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin-right:8px;"># 排版技巧</span>
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin-right:8px;"># 图文模板</span>
</section>
```
> 可替换处：胶囊底色/字色（跟随主色）、每枚文字；数量 2-4 枚。

**骨架 B · 文首归属标签（标题下）**：

```html
<p style="margin:0 0 16px;font-size:13px;color:#8a94a6;line-height:1.75;">
  <span style="display:inline-block;background:#e6f4ff;color:#1890ff;font-size:12px;line-height:1;padding:4px 10px;border-radius:999px;margin-right:8px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#1890ff;vertical-align:middle;margin-right:4px;"></span>干货</span>
  <span style="display:inline-block;background:#e6f4ff;color:#1890ff;font-size:12px;line-height:1;padding:4px 10px;border-radius:999px;margin-right:8px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#1890ff;vertical-align:middle;margin-right:4px;"></span>第 5 期</span>
</p>
```
> 可替换处：前缀（CSS 圆点 / `#`）、颜色、字数；文首 1-2 枚。

**骨架 C · 合集归集提示（引导加入合集）**：

```html
<p style="margin:0 0 16px;font-size:13px;color:#8a94a6;line-height:1.75;">
  本文属于
  <span style="display:inline-block;background:#eef3fb;color:#2166ff;font-size:12px;line-height:1;padding:6px 12px;border-radius:999px;margin:0 4px;"># 公众号排版 30 讲</span>
  系列 · 点击话题可回看全部
</p>
```
> 可替换处：系列名、描述话术、胶囊配色；这块引导放文首或文末均可。

## 十、个性化空间（可调参数与判断依据）

- **可调**：胶囊形状（直角 4px / 胶囊 999px）、底色深浅、字色。**判断依据**：干货/知识用胶囊浅底（圆润耐读），极简用纯文本无底；字色与底色对比要够。
- **可调**：前缀（`#`/CSS 圆点/无）。**判断依据**：`#` 最有"话题感"、利于读者语义联想，CSS 圆点更温和，全篇统一一种前缀。
- **可调**：放在文首还是文末、放几枚。**判断依据**：需要读者进门先定品的放文首 1-2 枚，其余放文末 2-4 枚；别前后重复同一批。
- **可调**：是否突出 1 枚品牌/系列标签。**判断依据**：品牌号或重点栏目想带品牌感时给 1 枚深色纯底/描边重点标签，其余浅色；一屏 ≤1 枚，避免杂乱。
- **可调**：是否做"合集归集"提示。**判断依据**：有稳定系列/合集时加一句"点击话题可回看全部"，利于长尾；单篇无系列时不加，避免空喊合集。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
