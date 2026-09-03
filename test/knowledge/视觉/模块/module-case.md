# 模块·案例展示卡

> 定位：把一则真实案例做成"问题 → 做法 → 结果"的卡片，用完整的转变故事证明方法/产品有效，比零碎证言更有说服力。
> 调用时机：案例文、复盘文、招生/招商、成果展示；当你想证明"这套做法能出结果"而非只夸一句时。

## 一、可用写法与语法

案例卡的核心是**三段式叙事**：问题（他本来有多难）→ 做法（我们/方法是怎么做的）→ 结果（最后变了多少）。微信里用内联样式，三段的小标签用 CSS 形状标记（实心圆/旋转方块 span）或直接加粗文字，不用 emoji 与图标字符，推荐结构：

```html
<!-- 卡一：问题 -->
<section style="background:#f7f7f7;border:1px solid #ececec;border-radius:12px;padding:14px 16px;margin:0 0 12px;">
  <p style="font-size:13px;font-weight:bold;color:#8a94a6;margin:0 0 6px;line-height:1.5;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8a94a6;vertical-align:1px;margin-right:6px;"></span>问题</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">...</p>
</section>
<!-- 卡二：做法 -->
<section style="background:#fff7f2;border:1px solid #f7e0d3;border-radius:12px;padding:14px 16px;margin:0 0 12px;">
  <p style="font-size:13px;font-weight:bold;color:#e56b2f;margin:0 0 6px;line-height:1.5;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#e56b2f;vertical-align:1px;margin-right:6px;"></span>做法</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">...</p>
</section>
<!-- 卡三：结果 -->
<section style="background:#f0fbff;border:1px solid #d9f0f5;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:13px;font-weight:bold;color:#0ba89b;margin:0 0 6px;line-height:1.5;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#0ba89b;vertical-align:1px;margin-right:6px;"></span>结果</p>
  <p style="font-size:14px;color:#4a6a63;line-height:1.75;margin:0;">...</p>
</section>
```

**数据化结果的写法**：结果段尽量给**可量化、可对照**的数字，而不是"效果很好"：
- "3 个月粉丝从 2000 涨到 1.2 万"（前后对比）
- "退货率从 12% 降到 4%"（降了多少）
- "当周复购率 35%"（绝对值）
- 给时间跨度（3 个月/半年），让数字有可信刻度。

**案例选择标准**（挑哪则案例）：
1. **有细节**：能讲出当时的困境、具体做法，不是一带而过。
2. **有变化幅度**：前后落差够大（涨了、降了、省了），结果可量化。
3. **典型**：代表目标读者的情况——读者看了会觉得"这跟我一样，我也可以"。
4. **真实可查**：案例必须有出处（学员/客户/自己复盘），能授权能溯源。

**与证言卡的区别**（容易混淆，务必区分）：
- **证言卡**：短反馈，只给"人 + 一句话结果"，碎片拼成口碑，适合快速堆信任。
- **案例卡**：完整叙事，"问题→做法→结果"三段展开，适合深度论证方法有效。前面讲产品用证言，讲方法/实战用案例。

**合规底线**（见第八节）：案例必须真实、可溯源、获授权；不虚构"学员收益"、不夸大疗效、涉投资/医疗/教育不承诺收益。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**（复盘、方法文、故事）：案例是"论据"，卡片淡色、克制，三段式完整叙事，结果数据扎实即可，不硬凹促销。
- **宣传类**（招生、招商、成果营销）：案例卡 + 数字放大高亮 + 收尾 CTA，常用多个案例"连班"展示，最后导流。

## 三、样式变体（≥3 种，带参数）

**变体 A｜上下三段卡**（最标准，见上文骨架）：问题/做法/结果三张淡色小卡纵向排，间距 12px（内部节奏），整体块距 16px。

**变体 B｜左右结果卡（前后对比）**——结果用两栏拼出"之前 vs 之后":
```html
<section style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
    <tr>
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f2f2f2;border:1px solid #e6e6e6;border-radius:12px;padding:14px 16px;margin:0 8px 0 0;">
          <p style="font-size:13px;font-weight:bold;color:#8a94a6;margin:0 0 8px;line-height:1.5;">之前</p>
          <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;">粉丝 2,000</p>
          <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">月入 0</p>
        </section>
      </td>
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#fff7f2;border:1px solid #f7e0d3;border-radius:12px;padding:14px 16px;margin:0 0 0 8px;">
          <p style="font-size:13px;font-weight:bold;color:#e56b2f;margin:0 0 8px;line-height:1.5;">之后</p>
          <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="color:#e56b2f;font-weight:bold;">1.2万</span> 粉丝</p>
          <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">稳定变现</p>
        </section>
      </td>
    </tr>
  </table>
</section>
```
> "之前"灰底劣、"之后"淡橙优，明暗对比传结果；条目数左右一致避免偏心。

**变体 C｜单卡叙事（三段并一卡，中间做法带序号）**:
```html
<section style="background:#ffffff;border:1px solid #ececec;border-radius:12px;padding:16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#5a4a3a;margin:0 0 8px;line-height:1.5;">案例 · 半年副业转正</p>
  <p style="font-size:14px;color:#8a7a70;line-height:1.75;margin:0 0 10px;"><span style="color:#e56b2f;font-weight:bold;">问题：</span>设计师想转运营，投了 30 份简历全被拒。</p>
  <p style="font-size:14px;color:#8a7a70;line-height:1.75;margin:0 0 10px;"><span style="color:#e56b2f;font-weight:bold;">做法：</span>1用现有作品做了 3 个作品集方向 2每周发 2 篇复盘 3拿 2 个免费项目练手。</p>
  <p style="font-size:14px;color:#8a7a70;line-height:1.75;margin:0;"><span style="color:#e56b2f;font-weight:bold;">结果：</span><span style="color:#e56b2f;font-weight:bold;">第 6 个月拿到 2 个 offer</span>，薪资上浮 30%。</p>
</section>
```
> 一段卡内用粗体前缀标"问题/做法/结果"，适合作为文中穿插的"小案例嵌入"。

## 四、使用时机与位置

- **首选位置**：方法/产品讲清之后，用 1–2 则完整案例做实；再配一幅"前后数据"图更立体。
- **案例系列**：多则案例连排时，前加"案例 01 / 02"小节标题，后加小结提炼共性结论。
- **招生/招商**：置于卖点与价格之间，先证明"能出结果"再引导。
- 一篇案例 ≤3 则；群像案例太长可拆为证言墙（见「用户证言/口碑卡」）。

## 五、风格适配（4 个例子）

- **简约干货**：三段都用 `#fafafa` 同底，只凭粗体前缀"问题/做法/结果"区分，最素。
- **商务科技**：灰白卡 + 青竖条 `border-left:4px solid #0ba89b`，结果段用青高亮。
- **国潮**：米底 + 红金描边，结果数据用红色放大，显"大吉大利"的成果感。
- **日系清新**：极淡配色、圆角 14px，"问题/做法/结果"用 CSS 圆点标记 + 留白。

**与证言墙的分工**：
- 讲"一套方法/产品怎么用出结果" → 用案例三段式（深度论证）。
- 讲"很多人用都说好" → 用证言墙（广度堆信任）。
- 一篇文章可**先用 1 则完整案例把结论立住，再用 2–3 则短证言填空**，形成"深一浅"配合；但别把两种混在同一块视觉里。

**案例的结尾提炼**：多则案例连排时，最后加一句"共性结论"（三则共同指向的规律），把"个例"升成"可复制的方法"，说服力倍增:

```html
<section style="background:#fff7f2;border:1px solid #f7e0d3;border-radius:12px;padding:12px 16px;margin:0 0 16px;">
  <p style="font-size:14px;font-weight:bold;color:#e56b2f;margin:0 0 4px;line-height:1.5;">三则案例的共同点</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">都是先做内容定位再发力，前 2 周不涨粉别慌，第 4 周开始起量。</p>
</section>
```

## 六、间距与尺寸（遵守硬规范）

- 案例块整体与前后内容：底部 `margin:0 0 16px`。
- 三段分卡之间：`margin:0 0 12px`（案例内部可比块距略紧，因三卡同属一个案例）。
- 单卡内：`padding:14px 16px`；卡内标题与正文 6px。
- 行高统一 **1.75**；标题行 1.5。
- 标题小标签（问题/做法/结果）13px、正文 14px、结果数据可放大到 18–20px 高亮。

## 七、密度限制

- 一篇案例 **≤3 则**；超长案例 1 则 + 若干证言填空。
- 单则案例"做法"步骤 **≤4 条**（用123），多了像教程。
- 三段卡高度尽量均衡：结果段可略短，别让"做法"页挤三屏。
- 全篇高亮数字 ≤4 处（案例结果 + 或许证言各一两处）。

## 八、常见错误（反例 + 正解）

1. **虚构案例 / 无出处**。
  「误」「我们帮一位学员 3 个月赚了 10 万」（查无此人）
  「正」案例必须真实、可溯源；用"匿名化处理的大伟/客户"也要真人真事并获授权。
2. **只讲结果不交代问题与做法**。
  「误」一上来"他涨粉 10 万"，没有过程，像吹牛。
  「正」走"问题→做法→结果"三段，读者才信而且能学到。
3. **数据离谱/无时间刻度**。
  「误」「粉丝暴涨，半个月营收翻 100 倍」
  「正」给前后真实数字 + 时间跨度（"3 个月从 2,000 到 1.2 万"），夸大即删。
4. **案例与证言混淆**。
  「误」用一句"这位同学效果超好"当完整案例。
  「正」要论证深度用案例三段式；要快速堆口碑用证言墙。想清楚这篇是"讲方法"还是"堆信任"。
5. **疗效/收益承诺踩红线**。
  「误」「报名后保你月入过万」
  「正」用"多数人 3 个月见到起色"留余地，加"效果因人而异"，绝不承诺具体收益。

## 九、示例（可替换的骨架）

**先给"问题→做法→结果"的填空模板（让案例不空洞）：**
- 问题（读者痛点）："【投稿被拒 20 次】/【涨粉卡在 1000】/【退货率 12%】"
- 做法（具体动作，动词开头）："1【停更 3 周拆 10 篇爆款】2【只写一个垂直主题】3【每周固定 3 篇】"
- 结果（前后数字对照）："【3 个月】单篇破 3 万，涨到【1.2 万】粉丝"
模板填得越具体（数字、时间、动作），案例越不像编的。

```html
<!-- 案例标题 -->
<p style="font-size:16px;font-weight:bold;color:#5a4a3a;margin:0 0 12px;line-height:1.5;">案例 01 · 从 0 到万粉的 3 个月</p>

<!-- 问题 -->
<section style="background:#f7f7f7;border:1px solid #ececec;border-radius:12px;padding:14px 16px;margin:0 0 12px;">
  <p style="font-size:13px;font-weight:bold;color:#8a94a6;margin:0 0 6px;line-height:1.5;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8a94a6;vertical-align:1px;margin-right:6px;"></span>问题</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">投稿被拒不下 20 次，阅读长期不过百，快放弃了。</p>
</section>
<!-- 做法 -->
<section style="background:#fff7f2;border:1px solid #f7e0d3;border-radius:12px;padding:14px 16px;margin:0 0 12px;">
  <p style="font-size:13px;font-weight:bold;color:#e56b2f;margin:0 0 6px;line-height:1.5;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#e56b2f;vertical-align:1px;margin-right:6px;"></span>做法</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">1 停更 3 周专门拆了 10 篇爆款结构 2 只写一个垂直主题 3 每周固定 3 篇。</p>
</section>
<!-- 结果 -->
<section style="background:#f0fbff;border:1px solid #d9f0f5;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:13px;font-weight:bold;color:#0ba89b;margin:0 0 6px;line-height:1.5;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#0ba89b;vertical-align:1px;margin-right:6px;"></span>结果</p>
  <p style="font-size:14px;color:#4a6a63;line-height:1.75;margin:0;">3 个月后单篇破 3 万，账号涨到 <span style="color:#0ba89b;font-weight:bold;font-size:18px;">1.2 万</span> 粉丝，开始接商单。</p>
</section>
```
> 可替换：案例编号、标题、三段的困境/做法/结果都换成你的真实案例；做法多可列 3–4 条；结果数据放大高亮（改成你的主色）。

## 十、个性化空间（可调参数与判断依据）

- **三段分卡 vs 单卡叙事 vs 前后对比**：信息多 → 三段分卡；想紧凑嵌文中 → 单卡；结果反差大 → 前后对比。判断依据：这段案例在文中的信息量与位置。
- **选几则案例**：招生/招商要说服力 → 2–3 则连排；普通干货点缀 → 1 则。判断依据：决策重量与篇幅。
- **结果高亮色/字号**：高亮用主色放大到 18–20px 强调数字。判断依据：结果是不是这篇的强卖点。
- **是否给时间跨度**：真实有跨度 → 必给，增加可信度；无 → 宁可写过程也别编个数。判断依据：真实性。
- **风格色盘**：商务灰/国潮红金/日系淡青/科技深底，随主色换。判断依据：账号调性。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
