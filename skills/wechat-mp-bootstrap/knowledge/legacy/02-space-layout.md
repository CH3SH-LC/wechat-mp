# 微信公众号排版 · 空间划分方法论（非上下平铺）

> 目标平台：微信公众号正文（富文本 HTML，仅允许 **内联 style 属性**，无 `<style>`/`<script>`/伪元素/外链字体）。
> 现有设计基线：正文 16px、行高 1.75、块间距 16px；宣传类三主色 橙 `#ff6b35` / 青 `#00b8a9` / 紫 `#7a3cec`。
> 说明：以下布局模板为微信公众号排版的常用方案，可直接套用；上线前建议在微信后台预览确认效果。

---

## 0. 为什么不能一直"上下平铺"

常见新手排版是"一段接一段往下排"，读起来是长条粥，行末扫读时缺少"块"的手感。空间划分的核心不是把内容变窄，而是**用视觉块把信息分组、建立层级、制造节奏点**，让读者在 3 秒扫视中抓住结构。

划分手段按"成本/风险"从低到高排序：

| 手段 | 是否新建块 | 典型用途 | 微信风险 |
|------|-----------|---------|---------|
| 分割线（只需一个 `<p>`） | 否 | 切分区段 | 低 |
| 背景色带（整卡 `<section>`） | 是 | 强调块 | 低 |
| 两栏 table-cell | 是 | 对比/图片+文字 | 很低（兼容性最佳） |
| flex 两/三栏 | 是 | 信息卡网格 | 中（老旧客户端） |
| 绝对定位角标 | 否 | 小徽标 | 中（易遮挡/塌陷） |

**核心原则**：能用一个 `<section>` 就划分出"块"，就优先用背景色 + 圆角 + 内边距；需要横向分栏才上 table-cell / flex。每屏（手机上约 6~8 行正文高度）至少要有一个"可停靠"的视觉块，否则读者会滑得很快。

---

## 1. 空间节奏方法论

### 1.1 块间距层级（16 / 24 / 32px）

并不需要"所有间距=16px"。间距本身就是层级语言：

- **8px**：卡片内部元素贴紧（同属一个信息的标题与副标题、标签与数字）。
- **16px**：默认块间距（基线值）；正文段落间、相邻卡片之间。
- **24px**：**语义块切换** —— 不同分区之间（如先介绍后对比、结论与表格之间）。
- **32px（及以上）**：**大章节切换** —— 页眉色带之后、结论收尾、CTA 之前。

实现时**用空 `<p style="height:24px; margin:0"></p>` 或直接给块加 `margin-bottom`**。微信编辑器中空段会用差行高造成间隙，推荐显式写高度：

```html
<p style="height:24px;margin:0;line-height:1px;font-size:1px;">&nbsp;</p>
```

> 技巧：间距占位越"硬"越可预测 —— 永远给行高和字号设极小值（1px），只靠显式 height 撑高，避免浏览器默认行高把空段撑得太高。

### 1.2 留白规则

- **内容与卡片内边距 ≥ 12px**：卡片内文字若不贴内边（padding），在深底卡片上会显得"顶头"，视觉压迫。建议 16px。
- **卡片与卡片间距 ≥ 12px**（上下相邻）；建议统一 16px。
- **两根相邻卡片的分隔**：宁用间距不用描边——间距是"分隔"，描边越细（1px）越显得是"合并区"，两种信息等级不要混用。
- **页边距（左右）**：正文默认 16px 左右系统边距，卡片内容不必再内缩，避免三层缩进。

### 1.3 用分割线 / 背景色带划分，而不是一直平铺段落

平铺段落的隐性问题：文字顶头到底、块与块没有边界。低成本替代方案：

**① 细分割线**（分隔同层级小节）：

```html
<p style="height:24px;margin:0;line-height:1px;font-size:1px;">&nbsp;</p>
<p style="text-align:center;font-size:14px;color:#999;letter-spacing:2px;margin:0;line-height:1.6;">————&nbsp; 具体做法 &nbsp;————</p>
<p style="height:24px;margin:0;line-height:1px;font-size:1px;">&nbsp;</p>
```

**② 色带页眉**（新建"章节"级语义，最适合宣传类）：

```html
<!-- 章节页眉色带 -->
<section style="background:#ff6b35;border-radius:8px;padding:12px 16px;margin:24px 0 16px;">
  <p style="font-size:17px;font-weight:bold;color:#fff;margin:0;line-height:1.5;">01｜为什么需要空间划分</p>
</section>
```

**③ 左侧竖条**（强调单点结论）：可以用 4px 左边框的 1px 渐变或纯色条模拟"引用卡"。

---

## 2. 空间划分的常见模式（8 个可落地模板）

> 所有模板均使用**微信安全子集**：`display:flex`、`display:table`/`table-cell`、`float`、渐变、圆角、box-shadow、background 均可。推荐优先 `table-cell`（兼容性最稳），新式布局用 flex。

---

### 模板 1｜两栏信息卡网格（用 table-cell 兼容版）

**适用场景**：并列的"特性 / 数据 / 标签"两两一组，需要左右分栏且端内极端兼容。table-cell 在微信富文本中最稳，单元格自动等高，适合文字卡两两对齐。

```html
<!-- 外层 table 占满宽，去掉全局行高干扰 -->
<section style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <!-- 左卡 -->
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#fff7f2;border:1px solid #ffe0d0;border-radius:10px;padding:16px;margin:0 8px 0 0;">
          <p style="font-size:14px;font-weight:bold;color:#ff6b35;margin:0 0 6px;line-height:1.5;">轻量启动</p>
          <p style="font-size:13px;color:#8a6a5a;margin:0;line-height:1.7;">3 分钟上手，无需配置，开箱即用。</p>
        </section>
      </td>
      <!-- 右卡 -->
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f0fbff;border:1px solid #cfeefb;border-radius:10px;padding:16px;margin:0 0 0 8px;">
          <p style="font-size:14px;font-weight:bold;color:#00b8a9;margin:0 0 6px;line-height:1.5;">海量扩展</p>
          <p style="font-size:13px;color:#4a7a73;margin:0;line-height:1.7;">内置 200+ 模板，持续更新。</p>
        </section>
      </td>
    </tr>
  </table>
</section>
```

**要点**：
- 左右用 `margin:0 8px 0 0 / 0 0 0 8px` 制造 16px 中缝；单元格宽各 50%。
- 高亮头用主色、底色用主色的淡色调（`#fff7f2` 对橙、`#f0fbff` 对青），形成"两栏对比但同体系"。
- 想做成三栏，加第三 `<td>`，宽度改 `33.33%`，中缝改用 `margin:0 6px`。三栏在手机端单卡偏窄，文字需精简到 13px 级。

---

### 模板 2｜两栏信息网格（flex 版）

**适用场景**：需要**每栏内竖排多条**、未来可响应式拉伸（微信端按行内块渲染，固定即可）。flex 在近 5 年的微信客户端均可用，适合现代移动端为主的目标读者。

```html
<section style="display:flex;justify-content:space-between;margin-bottom:16px;">
  <!-- 左列 49% -->
  <section style="width:49%;background:#fff7f2;border-radius:10px;padding:12px;box-sizing:border-box;">
    <p style="font-size:13px;color:#ff6b35;font-weight:bold;margin:0 0 8px;line-height:1.5;">优点</p>
    <p style="font-size:13px;color:#5a4a3a;margin:0 0 10px;line-height:1.7;"><span style="color:#ff6b35;font-weight:bold;">·</span> 部署快</p>
    <p style="font-size:13px;color:#5a4a3a;margin:0;line-height:1.7;"><span style="color:#ff6b35;font-weight:bold;">·</span> 成本低</p>
  </section>
  <!-- 右列 49% -->
  <section style="width:49%;background:#f0fbff;border-radius:10px;padding:12px;box-sizing:border-box;">
    <p style="font-size:13px;color:#00b8a9;font-weight:bold;margin:0 0 8px;line-height:1.5;">注意事项</p>
    <p style="font-size:13px;color:#4a6a63;margin:0 0 10px;line-height:1.7;"><span style="color:#00b8a9;font-weight:bold;">·</span> 需备案</p>
    <p style="font-size:13px;color:#4a6a63;margin:0;line-height:1.7;"><span style="color:#00b8a9;font-weight:bold;">·</span> 有配额</p>
  </section>
</section>
```

**要点**：
- `width:49% + justify-content:space-between / width:48%`，避免 50%+间距溢出折行。
- 子卡必须 `box-sizing:border-box`，否则内边距会让总宽超 100%。
- 各列内部用**同字号同色文字**但**色点前缀**区分条目，保持节奏统一。

---

### 模板 3｜三栏特性卡（promo 风格，含渐变图标块）

**适用场景**：宣传类的"三大亮点 / 三步流程"，每栏一个色系，与宣传类三主色体系呼应。

```html
<section style="display:flex;justify-content:space-between;margin-bottom:16px;">
  <!-- 卡 1：橙 -->
  <section style="width:31%;background:#ffffff;border-radius:12px;padding:12px 10px;box-sizing:border-box;box-shadow:0 4px 12px rgba(255,107,53,0.12);">
    <p style="font-size:15px;font-weight:bold;color:#fff;text-align:center;margin:0 0 8px;line-height:1.5;background:linear-gradient(135deg,#ff8f5e,#ff6b35);border-radius:8px;padding:6px 0;">1</p>
    <p style="font-size:13px;font-weight:bold;color:#ff6b35;text-align:center;margin:0 0 6px;line-height:1.5;">极速</p>
    <p style="font-size:12px;color:#8a7a70;text-align:center;margin:0;line-height:1.7;">首屏 <span style="color:#ff6b35;font-weight:bold;">0.8s</span></p>
  </section>
  <!-- 卡 2：青 -->
  <section style="width:31%;background:#ffffff;border-radius:12px;padding:12px 10px;box-sizing:border-box;box-shadow:0 4px 12px rgba(0,184,169,0.12);">
    <p style="font-size:15px;font-weight:bold;color:#fff;text-align:center;margin:0 0 8px;line-height:1.5;background:linear-gradient(135deg,#2ccfb8,#00b8a9);border-radius:8px;padding:6px 0;">2</p>
    <p style="font-size:13px;font-weight:bold;color:#00b8a9;text-align:center;margin:0 0 6px;line-height:1.5;">稳定</p>
    <p style="font-size:12px;color:#8a7a70;text-align:center;margin:0;line-height:1.7;">全年 <span style="color:#00b8a9;font-weight:bold;">99.9%</span></p>
  </section>
  <!-- 卡 3：紫 -->
  <section style="width:31%;background:#ffffff;border-radius:12px;padding:12px 10px;box-sizing:border-box;box-shadow:0 4px 12px rgba(122,60,236,0.12);">
    <p style="font-size:15px;font-weight:bold;color:#fff;text-align:center;margin:0 0 8px;line-height:1.5;background:linear-gradient(135deg,#9a6ef0,#7a3cec);border-radius:8px;padding:6px 0;">3</p>
    <p style="font-size:13px;font-weight:bold;color:#7a3cec;text-align:center;margin:0 0 6px;line-height:1.5;">安全</p>
    <p style="font-size:12px;color:#8a7a70;text-align:center;margin:0;line-height:1.7;">全程加密</p>
  </section>
</section>
```

**要点**：
- 三栏单卡最窄（约手机屏 31%），**文字务必精简**，12px 是极限。
- 每张卡用自身主题色的 `box-shadow` 淡化同色光晕，不必上粗描边，竖向条目用色点区分。
- 渐变仅用于编号数字块，不用于整卡，避免整卡渐变更俗且难调节奏。

---

### 模板 4｜左右对比块（对比 / 优劣 / 前后）

**适用场景**："我们 vs 别人""改版前 vs 改版后"，需要左右成对、结构整齐、一眼看出差异。用 table-cell 保证两部分顶端对齐。

```html
<section style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
    <tr>
      <!-- 对比左侧 -->
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f2f2f2;border-radius:10px 0 0 10px;padding:14px 16px;">
          <p style="font-size:13px;font-weight:bold;color:#999;margin:0 0 8px;line-height:1.5;">传统做法</p>
          <p style="font-size:13px;color:#666;margin:0 0 6px;line-height:1.7;">✕ 手动复制</p>
          <p style="font-size:13px;color:#666;margin:0 0 6px;line-height:1.7;">✕ 易出错</p>
          <p style="font-size:13px;color:#666;margin:0;line-height:1.7;">✕ 难追溯</p>
        </section>
      </td>
      <!-- 对比右侧（高亮） -->
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#ff6b35;border-radius:0 10px 10px 0;padding:14px 16px;">
          <p style="font-size:13px;font-weight:bold;color:#fff;margin:0 0 8px;line-height:1.5;">本方案</p>
          <p style="font-size:13px;color:#fff;margin:0 0 6px;line-height:1.7;">✓ 一键同步</p>
          <p style="font-size:13px;color:#fff;margin:0 0 6px;line-height:1.7;">✓ 全程留痕</p>
          <p style="font-size:13px;color:#fff;margin:0;line-height:1.7;">✓ 自动提醒</p>
        </section>
      </td>
    </tr>
  </table>
</section>
```

**要点**：
- **左右用圆角拼接**（左 `border-radius:10px 0 0 10px`，右 `0 10px 10px 0`）形成一个连续"对比带"，视觉上是整体、语义上更强。
- 灰底标"劣势"，主题高亮色标"优势"——**明暗对比传递褒贬**，比纯文字更直观。
- 条目行数必须一致（这里各 3 行），否则 table-cell 自动等高后留白会偏心。

---

### 模板 5｜分区页眉 + 内容卡

**适用场景**：长文章节分隔，每一节先给一个"色带标题"再放内容卡，纵向把文章拆成若干独立章节，替代一味的平铺段落。

```html
<!-- 章节一 -->
<section style="background:linear-gradient(90deg,#ff6b35,#ff8f5e);border-radius:10px;padding:12px 18px;margin:0 0 16px;">
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0;line-height:1.5;">Part 1 · 认识空间划分</p>
</section>
<section style="background:#fff7f2;border-left:4px solid #ff6b35;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;color:#5a4a3a;margin:0;line-height:1.75;">空间划分本质是「信息分组」。一张卡片、一条色带，都是在告诉读者：这块是一组。</p>
</section>

<!-- 章节二 -->
<section style="background:linear-gradient(90deg,#00b8a9,#2ccfb8);border-radius:10px;padding:12px 18px;margin:0 0 16px;">
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0;line-height:1.5;">Part 2 · 上手步骤</p>
</section>
<section style="background:#f0fbff;border-left:4px solid #00b8a9;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;color:#4a6a63;margin:0;line-height:1.75;">先定卡片，再排间距，最后补分割线。顺序错了就会越排越乱。</p>
</section>
```

**要点**：
- 色带页眉是"章节级"信号，正文内容卡用**淡底色 + 左竖条**承接，形成"抬头—正文"配对。
- 页眉用渐变增强"开始"感，但全文页眉**色系要轮换或保持一致**，别每个章节都换三个色导致混乱；建议同章节用同色、跨章节可递增编号。
- 每章之间用 24~32px 间距，读者自然感知章节切换。

---

### 模板 6｜时间线 / 流程布局（纵向）

**适用场景**：发展历程、操作步骤、时间节点。纵向一条竖线 + 数字节点 + 说明文字。

```html
<!-- 时间线工序卡 -->
<section style="padding:0;">
  <!-- 节点 1 -->
  <section style="display:flex;align-items:flex-start;margin:0 0 16px;">
    <section style="width:34px;flex-shrink:0;text-align:center;">
      <p style="font-size:14px;font-weight:bold;color:#fff;margin:0;line-height:1.5;background:#ff6b35;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">1</p>
      <p style="height:16px;margin:0;border-left:2px solid #ffd9c8;line-height:1px;font-size:1px;">&nbsp;</p>
    </section>
    <section style="background:#fff7f2;border-radius:8px;padding:12px 14px;flex:1;box-sizing:border-box;">
      <p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 4px;line-height:1.5;">分析需求</p>
      <p style="font-size:13px;color:#8a7a70;margin:0;line-height:1.7;">梳理内容分组与读者扫读路径。</p>
    </section>
  </section>
  <!-- 节点 2 -->
  <section style="display:flex;align-items:flex-start;margin:0 0 16px;">
    <section style="width:34px;flex-shrink:0;text-align:center;">
      <p style="font-size:14px;font-weight:bold;color:#fff;margin:0;line-height:1.5;background:#00b8a9;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">2</p>
      <p style="height:16px;margin:0;border-left:2px solid #cdeee9;line-height:1px;font-size:1px;">&nbsp;</p>
    </section>
    <section style="background:#f0fbff;border-radius:8px;padding:12px 14px;flex:1;box-sizing:border-box;">
      <p style="font-size:14px;font-weight:bold;color:#4a6a63;margin:0 0 4px;line-height:1.5;">搭建卡片</p>
      <p style="font-size:13px;color:#6a8a83;margin:0;line-height:1.7;">套用内联样式，保持 16px 内边距。</p>
    </section>
  </section>
</section>
```

**要点**：
- 竖线用每个节点下 16px 高的 **border-left 占位段**模拟，色与节点同色淡化，形成延续感。
- 圆形数字用 `border-radius:50%` + `display:flex` 居中，宽度高度固定 28px。
- 最后节点**不要画竖线**（收尾），或在末尾加一个不画线的占位。

---

### 模板 7｜大图卡 + 文字卡交替（重图文偏好）

**适用场景**：封面/成果图配文字，图与文各自成卡交错，比"图下配一行字"更有节奏。

```html
<!-- 交替组：图卡（换上你上传后的微信图片 URL） -->
<section style="border-radius:12px;overflow:hidden;margin:0 0 16px;box-shadow:0 6px 16px rgba(0,0,0,0.08);">
  <img src="https://mmbiz.qpic.cn/mmbiz_png/你的图片ID/640?wx_fmt=png" style="width:100%;display:block;margin:0;" />
</section>
<!-- 文字卡 -->
<section style="background:#fff7f2;border-radius:12px;padding:16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#ff6b35;margin:0 0 6px;line-height:1.5;">数据一览</p>
  <p style="font-size:13px;color:#6a5a50;margin:0;line-height:1.75;">这张图展示了核心指标：柱状高低即为各渠道占比，右侧净值曲线反映增速。</p>
</section>

<!-- 再一组，可换青/紫色系 -->
<section style="background:#f0fbff;border-radius:12px;padding:16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#00b8a9;margin:0 0 6px;line-height:1.5;">解读要点</p>
  <p style="font-size:13px;color:#4a6a63;margin:0;line-height:1.75;">横向对比发现，移动端贡献了 68% 访问，是优化重点。</p>
</section>
```

**要点**：
- 图片务必先传微信素材后台拿到 `mmbiz.qpic.cn` 的 **uploadimg URL** 再内联；本地/外链图片微信端不显示。
- 图卡配 `display:block` 消除图片下方空隙、`width:100%` 自适应，`overflow:hidden` 配合圆角裁切。
- 文字卡的色系与图卡主色呼应，形成"图—释"配对节奏。

---

### 模板 8｜底部信息条 / CTA（横向进度或行动条）

**适用场景**：文末或表格下方的一条横"信息带"，收纳次要说明、"下期预告"、行动提示，既不占正文篇幅又能收尾。

```html
<!-- 浅色信息条 -->
<section style="background:#f7f7f7;border-radius:8px;padding:10px 14px;margin:16px 0 0;display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:13px;color:#888;line-height:1.7;">已收录 3 种 · 完整版见下一篇</span>
  <span style="font-size:12px;font-weight:bold;color:#fff;background:#7a3cec;border-radius:14px;padding:4px 12px;line-height:1.5;">关注</span>
</section>

<!-- 深色 CTA 条（标题 + 副字，竖排收尾） -->
<section style="background:linear-gradient(135deg,#7a3cec,#9a6ef0);border-radius:12px;padding:18px 16px;margin:24px 0 0;text-align:center;">
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0 0 6px;line-height:1.5;">这期就到这里</p>
  <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0;line-height:1.7;">喜欢请点在看，下一篇拆促销倒计时。</p>
</section>
```

**要点**：
- 信息条用 `display:flex;justify-content:space-between` 做"左说明 + 右按钮"横排，是成本最低的 CTA。
- 收尾 CTA 用主题紫渐变 + 居中，形成文章的"终点"信号，不再往下平铺。
- 仅当信息条内容短时用 flex 横排；内容长了会换行，改用竖排结构。

---

## 3. 微信端风险与规避

### 3.1 flex 布局
- **风险**：极老旧微信客户端（2016 前后）对 flex 渲染不稳定，可能出现子项不换行/塌陷；公众号富文本编辑器粘贴时 flex 常被转成行内 block，导致布局错乱。
- **规避**：**布局结构优先用 table/table-cell**（微信富文本最稳）；flex 只用于卡内单行对位（如垂直居中按钮）或明确目标读者为近 5 年移动端的场景。

### 3.2 绝对定位（position:absolute）
- **风险**：微信图文对绝对定位支持差，容器 `position:relative` 在很多渲染场景失效，绝对定位元素**可能飞逸到页面顶层遮挡**或错位；编辑与预览渲染不一致。
- **规避**：**避免依赖 `position:absolute/relative` 做角标或叠加**。需要"角标/标签"时，用**同层独立 `<span>` 显示在行内**，或用 flex 顶对齐的列来装（见模板 6 圆形序号），而不是绝对定位。

### 3.3 百分比 + 内边距溢出
- **风险**：`width:50%` 的卡若未设 `box-sizing:border-box`，加上 padding 后实际总宽超 50%，flex 撑开或 table 错位。
- **规避**：**所有需要并排的卡一律加 `box-sizing:border-box`**；flex 两/三栏避免 `50%/33.33%` 紧贴，用 `49%/31%` + `justify-content:space-between`。

### 3.4 渐变 / box-shadow / 圆角
- **风险**：老客户端不认 `linear-gradient`（回退为底色）或忽略 shadow；整段大渐变在编辑态偶发渲染异常。
- **规避**：**渐变只做点缀（色带、数字块、CTA）**，关键信息不要只靠渐变表达；想渐变又要求稳时，同时给 `background` 一个纯色兜底。
- **规避圆角溢出**：图卡 `overflow:hidden` 配合圆角，防止图片方角戳出。

### 3.5 图片
- **风险**：非微信 uploadimg URL 的图片在公众号正文不显示或占位。
- **规避**：图片一律走微信素材上传，取 `mmbiz.qpic.cn` 永久链接；内联时 `display:block;width:100%`，避免底部 3px 间隙与拉伸变形。

### 3.6 空段撑高失真
- **风险**：用空 `<p>` 当间距时，p 的默认 line-height 会把"准 16px"撑到 24px+，节奏不可控。
- **规避**：显式写 `line-height:1px;font-size:1px;height:<目标>px;margin:0`（间距占位专用），或把间距放在块自身的 `margin-bottom` 上。

### 3.7 强调必须双通道
- **规避**：任何一个"重点"，同时用**颜色 + 字号/字重 + 底色**至少两个通道表达，避免只靠颜色（色盲/低饱和屏幕）导致信息丢失。

---

## 4. 一键复用速查

| 想实现 | 推荐方案 | 风险 |
|--------|---------|------|
| 两栏并列卡片 | table-cell，单元格 50%，卡间 8px 中缝 | 低 |
| 三栏特性 | flex，31%×3，justify-content:space-between | 中 |
| 对比块 | table-cell 两张拼接圆角卡，明暗传递褒贬 | 低 |
| 章节分隔 | 色带页眉 + 内容卡 + 24px 间距 | 低 |
| 时间线/流程 | flex 左列序号+竖线占位，右列文字卡 | 中 |
| 图+文交替 | 图卡 + 淡色文字卡配对 | 低 |
| 底部信息/CTA | 灰信息条 + 紫渐变收尾卡 | 低 |

**通关口诀**：优先 table-cell 保证兼容 → 并排卡必加 `box-sizing:border-box` → 间距显式写 height → 渐变/阴影只做点缀并给纯色兜底 → 凡重点用≥2 个表达通道 → 图片一律微信上传 URL。
