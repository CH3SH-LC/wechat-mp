# 12 · 图例 / 图标 / 图示体系

> 微信公众号正文中使用小图标、符号、图示表达信息的完整方案。
> **平台硬约束**：仅 HTML 内联 style；无 `<style>`/`<script>`/伪元素/外链字体；flex/渐变/圆角/阴影可用；图片须为 uploadimg URL；**无 icon 字体库、无 `<svg>`**——图标只能用 emoji / Unicode 字符 / CSS 形状（span+圆角/旋转/边框/渐变）。

---

## 1. 图标方案盘点

### 1.1 Emoji 图标（主力方案，零成本、跨端稳定）

按语义分组，每组给常用字符 + 适用场景。

**🟢 提示 / 信息**（正文开头说明、注意事项）
- 💡 提示 · 思路（小贴士、冷知识标题）
- 📌 标注 · 原文引用（"注意""重点回看"）
- ℹ️ 通用信息（说明性文字）
- 👀 关注 · 观察点（引导读者注意细节）

**✅ 成功 / 完成**
- ✅ 成功 · 完成 · 已处理（方案之一）
- ✔️ 已完成 · 通过（列表核对项）
- ⭐ 推荐 · 亮点 · 优选（推荐项）
- 🎉 庆祝 · 好消息 · 达成

**⚠️ 警告 / 注意**
- ⚠️ 警告 · 隐患（"这里要注意"）
- ⛔ 禁止 · 勿做（误区、反面示例）
- 🚫 拒绝 · 不可行（排除项）
- ❌ 错误 · 失败 · 反例（错误示范）

**❤️ 重点 / 强调**
- 🔥 热门 · 重点 · 高能（最重要信息）
- 💎 干货 · 精华 · 核心（精华总结）
- 🎯 目标 · 定位（单篇主题/核心观点）
- ✨ 亮点 · 增色（锦上添花项）

**💰 优惠 / 商品**
- 🛒 购买 · 带货（购买入口）
- 🏷️ 价格 · 标签 · 促销（价格/促销标签）
- 🎁 赠品 · 福利（限时福利、赠品）
- ✅ 优惠 · 划算（性价比说明）

**🚀 步骤 / 流程**
- 🚀 启动 · 开始（第一步、行动号令）
- 📌 步骤 · 序号（配合编号排流程）
- 🔧 操作 · 修改（动手教程的步骤）
- ➡️ 下一步 · 跳转（引导继续阅读）

**📊 数据 / 统计**
- 📊 数据 · 报表（图表标题）
- 📈 增长 · 上升（正面数据箭头）
- 📉 下降 · 回落（负面/趋势）
- 🔢 数量 · 数字（关键数字强调）
- ⚡ 快 · 高效 · 增速（性能/效率强调）

> 使用要点：**一屏图标建议 ≤5 个**，且同一语义组内固定在 1 个字符上不换（避免同一意思一会儿 ✅ 一会儿 ✔️）。emoji 天然带颜色，与主色冲突时用 CSS 形状图标替代。

### 1.2 CSS 形状图标（无 emoji 色、需与主色协调时用）

全部用 `span` + 内联样式拼。

**圆形数字徽标**（步骤序号，最常用）

```html
<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;
background:linear-gradient(135deg,#1890ff,#096dd9);color:#fff;font-size:13px;
font-weight:700;align-items:center;justify-content:center;">1</span>
```

**空心圆 + 勾**（勾选态单选项）：span 圆形带边框，字号勾字符

```html
<span style="display:inline-flex;width:18px;height:18px;border-radius:50%;
border:2px solid #18a058;color:#18a058;font-size:12px;font-weight:700;
align-items:center;justify-content:center;">✓</span>
```

**菱形◆**（分隔/点缀，可旋转做成方块）

```html
<span style="display:inline-block;width:8px;height:8px;background:#faad14;
transform:rotate(45deg);border-radius:2px;"></span>
```

**实心圆点**（列表项目符号；用半透明圆做"光源"点缀）

```html
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
background:#1890ff;margin-right:8px;"></span>
```

**旗帜**（进度/节点，用 emoji 🚩 或 CSS 三角组合）。CSS 三角比较麻烦，**推荐直接用 emoji 🚩🏁**，除非主题色强约束。

---

## 2. 图例卡片模板（图标 + 标题 + 说明三行式）

`::: 图例` 容器内用 `- emoji 标题|说明` 语法。每行：图标 + 加粗标题 + 灰字说明。

**模板 A · 图例清单**（图文顶部的符号说明区）

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;
margin:16px 0;border:1px solid #e6ecf5;">
  <p style="margin:0 0 10px;font-size:14px;color:#2b3a5e;font-weight:700;">
    📖 阅读图例
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;">✅</span>
    <b style="color:#2b3a5e;">可行方案</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 已实测、可直接用</span>
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;">⚠️</span>
    <b style="color:#2b3a5e;">注意点</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 踩过的坑、易错处</span>
  </p>
  <p style="margin:4px 0;font-size:14px;line-height:1.9;">
    <span style="margin-right:8px;">🔥</span>
    <b style="color:#2b3a5e;">重点</b>
    <span style="color:#8a94a6;margin-left:8px;">—— 本篇核心、建议收藏</span>
  </p>
</section>
```

**适用场景**：教程/清单/对比类长文开头的"符号说明"，先向读者交代图标含义，正文只用图标不重复解释。

**模板 B · 单个要点卡**（标题 + 一句说明，强调单个知识点）

```html
<section style="background:#fff8f1;border-left:4px solid #fa8c16;
border-radius:8px;padding:12px 16px;margin:14px 0;">
  <p style="margin:0;font-size:15px;font-weight:700;color:#d46b08;">
    <span style="margin-right:8px;">🚀</span>一句话核心技巧
  </p>
  <p style="margin:6px 0 0;font-size:14px;line-height:1.8;color:#7a5233;">
    跟正文呼应的简短说明，把方法论压缩成一句可带走的话。
  </p>
</section>
```

---

## 3. 数据图示（纯 div CSS，无图表库）

核心：宽度百分比 div + 渐变 + 圆角/阴影。微信内 flex 可用，但**推荐用 block + margin** 保证旧端兼容，必要时再包 flex 行。

**模板 C · 柱状图**（多组数据对比）

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;margin:16px 0;">
  <p style="margin:0 0 12px;font-size:14px;color:#2b3a5e;font-weight:700;">📊 各渠道触达占比</p>
  <div style="margin:0 0 2px;font-size:13px;color:#8a94a6;">私域<br></div>
  <div style="height:10px;border-radius:5px;background:#eef2f8;margin:4px 0 12px;overflow:hidden;">
    <div style="height:100%;width:68%;border-radius:5px;
    background:linear-gradient(90deg,#1890ff,#36cfc9);"></div>
  </div>
  <div style="font-size:13px;color:#8a94a6;">公域<br></div>
  <div style="height:10px;border-radius:5px;background:#eef2f8;margin:4px 0 12px;overflow:hidden;">
    <div style="height:100%;width:24%;border-radius:5px;
    background:linear-gradient(90deg,#36cfc9,#13c2c2);"></div>
  </div>
  <div style="font-size:13px;color:#8a94a6;">转介绍<br></div>
  <div style="height:10px;border-radius:5px;background:#eef2f8;margin:4px 0 0;overflow:hidden;">
    <div style="height:100%;width:8%;border-radius:5px;
    background:linear-gradient(90deg,#13c2c2,#08979c);"></div>
  </div>
</section>
```

**模板 D · 进度条 + 目标**（单条达成率）

```html
<section style="background:#f7f9fc;border-radius:12px;padding:16px 18px;margin:16px 0;">
  <p style="margin:0 0 8px;font-size:14px;color:#2b3a5e;font-weight:700;">
    本月目标达成 78%<span style="color:#8a94a6;font-weight:400;"> / 10 万</span>
  </p>
  <div style="height:14px;border-radius:7px;background:#eef2f8;overflow:hidden;">
    <div style="height:100%;width:78%;border-radius:7px;
    background:linear-gradient(90deg,#18a058,#73d13d);"></div>
  </div>
  <p style="margin:6px 0 10px;font-size:12px;color:#8a94a6;text-align:right;">已达成 7.8 万</p>
  <!-- 环形占比：无 SVG 时改用两半圆拼，或用下方整条占比条 -->
</section>
```

**占比条（两段对比）** —— 无 SVG 环形图的替代：一条底 + 两段带色 div

```html
<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:6px 0;">
  <div style="height:100%;width:70%;background:linear-gradient(90deg,#1890ff,#36cfc9);"></div>
  <div style="height:100%;width:30%;background:#eef2f8;"></div>
</div>
<div style="font-size:12px;color:#8a94a6;">
  <span style="color:#1890ff;">● 完成任务 70%</span>
  <span style="margin-left:16px;">○ 进度中 30%</span>
</div>
```

**适用场景**：模板 C 用于"渠道对比/品类占比"多组数据；模板 D 用于"目标达成/进度推进"单个量化指标。注意各条高度、圆角、底色统一，仅宽度/颜色渐变区分。

---

## 4. 标注 / 角标

**模板 E · 行内小标签**（词条/价格旁挂小标）

```html
<p style="font-size:15px;color:#2b3a5e;line-height:1.9;">
  精选好物
  <span style="display:inline-block;background:#fff1f0;color:#d4380d;
  font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;
  vertical-align:2px;">新品</span>
  限时 5 折
  <span style="display:inline-block;background:#fff7e6;color:#d48806;
  font-size:12px;line-height:1;padding:3px 7px;border-radius:4px;margin-left:8px;
  vertical-align:2px;">仅今天</span>
</p>
```

**模板 F · 右上角小徽标**（卡片角落提示，用绝对定位）

```html
<section style="position:relative;background:#f7f9fc;border-radius:12px;
padding:14px 16px;margin:16px 0;overflow:hidden;">
  <span style="position:absolute;top:0;right:0;background:linear-gradient(135deg,#f5222d,#cf1322);
  color:#fff;font-size:11px;line-height:1;padding:4px 10px 4px 12px;
  border-radius:0 12px 0 12px;">HOT</span>
  <p style="margin:0;font-size:14px;font-weight:700;color:#2b3a5e;">爆款清单</p>
  <p style="margin:6px 0 0;font-size:13px;color:#8a94a6;">跟正文呼应的简短说明。</p>
</section>
```

> 徽标角部裁切：`border-radius:0 12px 0 12px` 与容器圆角相呼应；右上角卡片 `overflow:hidden` 保证裁切干净。也可用 emoji 🔥 替文字角标（更省）。

---

## 5. 图标配色规则

1. **图标颜色与语义、主色三方协调，全局 ≤3 色。** 选 1 个主色（如 #1890ff）+ 1-2 个强调色（红/橙各一用于警示/优惠）。emoji 自带多色时，尽量让相邻文本用主色系，避免一屏五颜六色。
   - 主色蓝：信息、步骤、可操作项 `#1890ff`
   - 警示橙/红：警告、禁止、重要 `#fa8c16` / `#f5222d`
   - 成功绿：完成、推荐 `#18a058`
2. **图标与文字间距 ≥8px。** emoji 后跟文字：`margin-right:8px`；行内小图标列表项记得统一 `margin-right:8px`。
3. **不滥用，一屏图标 ≤5 个。** 图标是"锚点"不是"装饰"——要紧信息才配图标，连续 3 个以上无停顿的图标行要拆。
4. **统一一致性优先。** 同一语义全程固定 1 个字符（比如"重点"始终用 🔥），不要一会 🔥 一会 ⭐；图例卡解释了哪些图标，正文就严格只用这些。
5. **深浅搭配。** 图标底色用浅色调（#fff7e6 / #fff1f0 / #e6f4ff），文字/符号用深色（#d48806 / #d4380d / #1890ff），对比清晰不刺眼。

---

## 附 · 快速查询表

| 需求 | 用什么 | 模板 |
|---|---|---|
| 图标 + 说明符号说明区 | emoji + `::: 图例` | A |
| 单个要点卡 | emoji + 左边框卡片 | B |
| 多组数据对比 | div 宽度百分比柱状图 | C |
| 目标达成率 | 单条渐变进度条 | D |
| 行内价格/词条标签 | 浅底小 span 圆角 | E |
| 卡片右上角提示 | 绝对定位角标 | F |

> **红线提醒**：微信正文禁用 `<style>`/`<script>`/伪元素/外链字体/`<svg>`。以上所有方案仅用内联 style + emoji/Unicode/CSS 形状，直接进 `wechat_mp_compose` 排版可安全落地。
