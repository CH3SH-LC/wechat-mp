# 模块·价格表 / 套餐对比

> 定位：把多档价格/套餐并排摆开并突出推荐档，帮读者快速对比、敢于下单，是"转化临门一脚"的收银台。
> 调用时机：课程、会员、付费社群、实体商品等有明确价格档位、需要在文中促成购买的场景。

## 一、可用写法与语法

价格表微信里用内联样式排版，主流两种布局：

- **三栏对比卡**（并列三档，最常见）：`display:flex` 三段或 `table-cell` 三列，各占约 31–33%，中间档位高亮为"推荐"。适合 3 个套餐（基础/标准/尊享）。
- **表格对比（价格行）**：用一张完整表格列"功能 vs 各档"，行是功能点、列是档位，方便逐项对比。适合功能差异细、档位 2–4 个。

**突出推荐档的三种手法**（可叠加）：
1. **高亮底色**：推荐档卡底用主色或深色（如橙 `#ff6b35` 或 `rgba(255,107,53,0.08)` 淡橙），其他档用白/灰。
2. **角标/徽章**：卡顶放一个 `[[badge:推荐]]` 或手写胶囊"最受欢迎"，用 `[[badge:文本]]` 语法即可。
3. **加大/放前面**：推荐档字号与内边距略大、视觉最先被抓到；常用"中间档=推荐"把选择往中档引（锚定）。

**价格锚定写法**：先放一个"高价参考"（原价/单项价），再放"现在价格"，让落差制造"划算感"。例：`原价 299 → 现价 129`；`三件单买 87 元，套餐只要 59 元`。锚点必须真实，禁止虚高原价（见合规）。

**排版骨架建议**：
- 价格表前给一句引导（"三档任选，推荐中间那档"）。
- 表末统一放 CTA（"点击下方小程序购买"/"回复「套餐」获取"）。
- 档位元素从上到下：套餐名 → 一句话卖点 → 大价格 → 功能列表（用实心圆点 span 勾列）→ 购买按钮。

**合规底线**：
1. **价格必须真实**：禁止虚标"原价"再打折（虚假比较价违规）；折扣、促销价要有依据。
2. **价格与文案一致**：正文、表、按钮、落地页价格不能对不上。
3. 不写绝对化销量（"销量第一"）、夸大包治/包过疗效类承诺。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**（会员、付费社群、知识付费，弱转化）：单向表格或 2–3 栏淡色卡，推荐档用淡橙底就够了，不铺夸张促销话术。价格就是信息本身。
- **宣传类**（促销、限量、课程报名）：三栏高饱和对比卡 + 推荐档高亮/角标 + 原价划线 + 倒计时粘合，视觉最热、转化最强。常配"立减、限时"徽章。

## 三、样式变体（≥3 种，带参数）

**变体 A｜三栏推荐高亮卡**（最常用）:
```html
<section style="display:flex;justify-content:space-between;margin:0 0 16px;">
  <section style="width:31%;background:#f7f7f7;border-radius:12px;padding:14px 12px;box-sizing:border-box;">
    <p style="font-size:14px;font-weight:bold;color:#8a8a8a;text-align:center;margin:0 0 6px;line-height:1.5;">基础版</p>
    <p style="font-size:16px;font-weight:bold;color:#5a4a3a;text-align:center;margin:0 0 4px;line-height:1.4;">¥39</p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0;line-height:1.7;">入门够用</p>
  </section>
  <section style="width:31%;background:#fff7f2;border:2px solid #ff6b35;border-radius:12px;padding:14px 12px;box-sizing:border-box;">
    <p style="font-size:13px;font-weight:bold;color:#fff;background:#ff6b35;border-radius:10px;text-align:center;margin:0 0 8px;padding:2px 0;line-height:1.5;">最受欢迎</p>
    <p style="font-size:14px;font-weight:bold;color:#ff6b35;text-align:center;margin:0 0 6px;line-height:1.5;">标准版</p>
    <p style="font-size:20px;font-weight:bold;color:#ff6b35;text-align:center;margin:0 0 4px;line-height:1.4;">¥89</p>
    <p style="font-size:12px;color:#b08068;text-align:center;margin:0;line-height:1.7;">性价比之选</p>
  </section>
  <section style="width:31%;background:#f7f7f7;border-radius:12px;padding:14px 12px;box-sizing:border-box;">
    <p style="font-size:14px;font-weight:bold;color:#8a8a8a;text-align:center;margin:0 0 6px;line-height:1.5;">尊享版</p>
    <p style="font-size:16px;font-weight:bold;color:#5a4a3a;text-align:center;margin:0 0 4px;line-height:1.4;">¥199</p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0;line-height:1.7;">全套服务</p>
  </section>
</section>
```
> 用 `width:31% + justify-content:space-between` 避免 3×33% 溢出；推荐档加粗边框 + 淡橙底 + 顶部徽章三箭齐发。

**变体 B｜功能对比表格（逐项对比）**:
```html
<section style="background:#ffffff;border:1px solid #eee;border-radius:12px;overflow:hidden;margin:0 0 16px;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    <tr style="background:#fff7f2;">
      <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#5a4a3a;line-height:1.5;">功能</td>
      <td style="padding:10px 8px;font-size:13px;color:#ff6b35;text-align:center;line-height:1.5;">基础</td>
      <td style="padding:10px 8px;font-size:13px;font-weight:bold;color:#ff6b35;text-align:center;line-height:1.5;">标准</td>
      <td style="padding:10px 8px;font-size:13px;color:#999;text-align:center;line-height:1.5;">尊享</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">视频课</td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff6b35;"></span></td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff6b35;"></span></td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff6b35;"></span></td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">社群答疑</td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;">—</td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff6b35;"></span></td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff6b35;"></span></td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">一对一</td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;">—</td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;">—</td>
      <td style="padding:8px;text-align:center;border-top:1px solid #f2f2f2;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff6b35;"></span></td>
    </tr>
  </table>
</section>
```
> 表头行给淡橙底区分表头；功能列左对齐、勾选列居中（有该项用主色实心圆点 span，无该项用 `—` 破折号）；行间 `border-top:1px solid #f2f2f2` 细线分隔。

**变体 C｜锚定 + 划线原价单卡（划算感）**:
```html
<section style="background:#6b4fc4;border-radius:12px;padding:18px 16px;margin:0 0 16px;text-align:center;">
  <p style="font-size:13px;color:#e3dcf7;margin:0 0 6px;line-height:1.7;">单买三件要 87 元</p>
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0 0 8px;line-height:1.5;">套餐只需 <span style="color:#ffe08a;font-size:24px;">59</span> 元</p>
  <p style="font-size:12px;color:#d9cff2;margin:0;line-height:1.7;">今日下单立省 28 元 · <span style="text-decoration:line-through;color:#c9bcea;">原价 87</span></p>
</section>
```
> 深紫纯色整卡 + 金色价格放大 + 划线原价，落差感强；用于单一推荐档或收尾强化。

## 四、使用时机与位置

- **首选位置**：卖点与证言之后、接近文末——信息铺垫够了再亮价格，读者不觉得"屠刀"。
- **三栏对比卡**适合"有 2–3 档位选择"；**功能表格**适合"档位功能差异多"；**锚定单卡**适合"只主推一档"或收尾强调。
- 一篇**一个价格块**即可；若既有三栏又有锚定收尾，把锚定简化成一句，避免重复喊价。

**档位怎么定才像"合理的选择"（定价心理）**：
- 档位间要有清晰差距，且推荐档"贵得不多、多很多"，让人顺手上探。
- 不做"三档都差不多"的无效对比——档位差异要能一句话说清。
- 锚点要真：原价/单买总价是真实可查的，别把从未卖过的价写上。
- 低客单用"性价比"钩人，高客单用"服务/权益"勾人，痛点不同。

## 五、风格适配（4 个例子）

- **简约商务**：灰色档位 `#f7f7f7`，推荐档 `#eef7ff`+青描边 `#00b8a9`，去图标徽章，只用边框区分。
- **国潮**：卡底 `#fbf3e8`，推荐档红金 `border:2px solid #c0392b`，徽章写"镇店之选"。
- **日系清新**：米白底、圆角 14px，推荐档淡橙 `#fff3ea`，文字小、字距松。
- **科技深色**：整块深青 `#0f2838` + 白字，价格放大，靠对比度而非颜色区分档位。

**与结尾 CTA 的衔接**：价格表通常不独立收尾，而是在表末接一张「小程序卡片」或一条"点击购买"引导；促销类再用「倒计时条」粘合（见对应条目）。价格表给出"选哪个 + 多少钱"，跳转给出"然后点这里"，两步不能断。

**促销组合建议**：
- 平常转化：三栏表 + 一句"7 天无理由退" + 小程序入口。
- 大促：三栏表（推荐档加「限时」徽章）+ 锚定单卡收尾 + 倒计时条。
- 课程报名：三栏表 + 名额引导（"本期仅收 30 人"）+ 报名小程序。

## 六、间距与尺寸（遵守硬规范）

- 价格卡与前后内容：底部 `margin:0 0 16px`。
- 卡内：`padding:14px 12px`（三栏窄卡）或 `18px 16px`（整卡锚定款）。
- 卡内元素间隙：标题与价格 6px、价格与卖点 4px、卖点与功能列表 10px。
- 价格是焦点：价格字号比其他元素**大 6–10px**（如档位名 14px、价格 20px）。
- 表格行高 1.6、表头 1.5；行内 padding 8–10px 上下。
- 三栏间中缝用 `justify-content:space-between`（每栏 31%）或各 `margin:0 6px`。

## 七、密度限制

- 档位 **3 档**最理想（少不足以对比、多则选择瘫痪）；**最多 4 档**，再多合并或改为表格。
- 价格卡内功能点 **≤6 条**，超出就折叠到"详情页"。
- 全篇价格块 1 处；不要在多处重复喊"立减/限时"，徽章整篇 ≤3。
- 表格列数 = 档位数 + 1（功能列），列多时手机端会挤，功能文字必须精简。

## 八、常见错误（反例 + 正解）

1. **虚高原价制造假折扣**。
  反例："原价 999 元，今天只要 99"（原价从未卖过就是虚假比较价）。
  正解：原价必须真实卖过或可查；没有就用"早鸟价 99 / 日常 199"这类诚实表达。
2. **推荐档不突出、读者无从下手**。
  反例：三档一模一样全是白卡，读者纠结半天不买。
  正解：明确标"推荐/最受欢迎"，用高亮底 + 边框 + 徽章三选一至少用一处。
3. **档位命名含糊、看不出差异**。
  反例："A 档 / B 档 / C 档""基础/进阶/究极"没说清差在哪。
  正解：命名带消费者视角（"入门够用 / 性价比之选 / 全套服务"）+ 每档一句话卖点。
4. **价格前后不一致（正文/表/落地页对不上）**。
  反例：正文写 129，表格写 99，按钮跳出去是 159。
  正解：所有提及价格的文案与落地页核对一致。
5. **绝对化/夸大销量与疗效**。
  反例："销量全网第一""包你一月瘦十斤"
  正解：用相对、留余地的"多数人选""需坚持、效果因人而异"，绝对象限一律删。

## 九、示例（可替换的骨架）

**先给档位命名与卖点的对照模板（套你的产品改括号）：**
- 入门档："【基础版】/【¥39】/【入门够用】/ 适合【第一次买、想先试】"
- 推荐档："【标准版】/【¥89】/【性价比之选】/ 适合【多数人，功能齐全】"
- 高端档："【尊享版】/【¥199】/【全套服务】/ 适合【进阶用户、重度使用】"
档位卖点要有"消费者的使用理由"，而不是"版本号 + 抽象功能"。

```html
<!-- 引导句 -->
<p style="font-size:15px;color:#5a4a3a;line-height:1.75;margin:0 0 10px;">三档任选，预算够就直接上中间那档，用得最久。</p>

<!-- 三栏对比卡 -->
<section style="display:flex;justify-content:space-between;margin:0 0 16px;">
  <section style="width:31%;background:#f7f7f7;border-radius:12px;padding:14px 12px;box-sizing:border-box;">
    <p style="font-size:14px;font-weight:bold;color:#8a8a8a;text-align:center;margin:0 0 6px;line-height:1.5;">基础版</p>
    <p style="font-size:16px;font-weight:bold;color:#5a4a3a;text-align:center;margin:0 0 4px;line-height:1.4;">¥39</p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0;line-height:1.7;">入门够用</p>
  </section>
  <section style="width:31%;background:#fff7f2;border:2px solid #ff6b35;border-radius:12px;padding:14px 12px;box-sizing:border-box;">
    <p style="font-size:13px;font-weight:bold;color:#fff;background:#ff6b35;border-radius:10px;text-align:center;margin:0 0 8px;padding:2px 0;line-height:1.5;">最受欢迎</p>
    <p style="font-size:14px;font-weight:bold;color:#ff6b35;text-align:center;margin:0 0 6px;line-height:1.5;">标准版</p>
    <p style="font-size:20px;font-weight:bold;color:#ff6b35;text-align:center;margin:0 0 4px;line-height:1.4;">¥89</p>
    <p style="font-size:12px;color:#b08068;text-align:center;margin:0;line-height:1.7;">性价比之选</p>
  </section>
  <section style="width:31%;background:#f7f7f7;border-radius:12px;padding:14px 12px;box-sizing:border-box;">
    <p style="font-size:14px;font-weight:bold;color:#8a8a8a;text-align:center;margin:0 0 6px;line-height:1.5;">尊享版</p>
    <p style="font-size:16px;font-weight:bold;color:#5a4a3a;text-align:center;margin:0 0 4px;line-height:1.4;">¥199</p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0;line-height:1.7;">全套服务</p>
  </section>
</section>
<p style="font-size:15px;color:#5a4a3a;line-height:1.75;margin:0;">点击下方小程序卡片下单，7 天无理由退。</p>
```
> 可替换：三档名、价格、卖点换成你的产品；推荐档每档可加 2–3 行 CSS 实心圆点 span 功能列表；促销把"最受欢迎"换成"限时 5 折"。

## 十、个性化空间（可调参数与判断依据）

- **档位数（2/3/4）**：客单高、决策重 → 3–4 档给人"中间好选"；客单低、小物 → 2 档够。判断依据：选择复杂度。
- **推荐档位置**：常作"中间档"引导中位消费，或放在"起点/终点"做方向引导。判断依据：你想把人的注意力往哪档引。
- **高亮手法**（底色/边框/徽章）：促销急 → 徽章+边框最醒目；商务沉稳 → 只用淡底。判断依据：本篇调性热还是稳。
- **锚定对象**：用"原价"或"单买总价"或"竞品价格"做锚。判断依据：哪种价差最真实可信、不违反比价规范。
- **风格色盘**：切商务/国潮/日系/科技四套，价格焦点色随主色走（橙/红/青/白）。判断依据：账号主色与内容类型。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
