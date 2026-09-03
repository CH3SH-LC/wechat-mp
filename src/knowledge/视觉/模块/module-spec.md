# 模块·参数规格表

> 定位：两栏/三栏罗列产品的关键参数（表头 + 分组 + 单位统一），让技术参数一眼看懂，是产品软文里"讲得清、看得明"的信任卡。
> 调用时机：数码、硬件、家电、付费产品的规格展示；当产品需要给读者"硬指标"而不是形容词时。

## 一、可用写法与语法

参数规格表的本质是**"参数名 + 值"的两栏/三栏表格**。微信里用内联样式，常见两种：

- **两栏表格**（参数名 ｜ 值）：最常规，参数名左列、值右列。适合纵向参数多（尺寸、重量、续航、接口…）。
- **三栏表格**（参数名 ｜ 值 A ｜ 值 B）：做同一项"两版本对比"或"标准版 vs 高配版"，横向对比。

**表头样式**：首行表头给主色淡底（`background:#fff7f2`）或深底白字（纯色 `#e56b2f`），并加粗，和正文区别开。

**分组**：参数多时按"外观 / 性能 / 续航 / 接口 / 其他"分小节，每组前加一个小节标题行（跨整行、淡底），避免一长串表让人找不到。

**单位统一**：所有可度量值带上统一单位——尺寸用 cm 或 mm、重量用 g/kg、容量用 mAh/Wh、存储用 GB、速度用 Mbps。**全程一种叫法**（别这行 cm 下行是 厘米），数值对齐。

**语法骨架**（两栏表头 + 分组）:
```html
<section style="background:#ffffff;border:1px solid #eee;border-radius:12px;overflow:hidden;margin:0 0 16px;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#ff6b35;background:#fff7f2;line-height:1.5;width:34%;">参数</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#ff6b35;background:#fff7f2;line-height:1.5;">规格</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">尺寸</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">120 × 68 × 9 mm</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">重量</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">215 g</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">续航</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">14 小时</td>
    </tr>
  </table>
</section>
```

**与产品软文的配合**：参数表通常放在**卖点讲完之后、购买引导之前**——先让读者觉得"这产品优势在哪"，再用参数表证明"我没吹、数据在这"，最后导流。别一上来甩表，没人有耐心先背参数。

**参数拆条技巧**：参数多时不要一条条罗列到底，先按"读者决策重要性"排序——
- 最关心的放最前（续航、容量、核心性能）。
- "外观/接口/配件"等次要的放后或折叠到详情页。
- 一句"这里只列关键参数，完整版进详情页"兜底，避免无限拉长。

**参数文案搭配**：光给数字读者无感，可在表外配一两句"白话解读"：
- 续航 14 小时 →"重度用一天不用充电"。
- 重量 215g →"和一本薄杂志差不多"。
- 防水 IPX4 →"淋雨和洗手溅水都不怕"。
（解读与数字一致，别夸大实际能力。）

**合规**：参数必须真实、与说明/落地页一致；不虚标（容量、续航、性能）；涉及专利、认证需真实可查（如 IPX4 防水、3C 认证）。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**（拆解、横评、科普）：素表，表头浅底即可，把参数当"信息"陈列，用户自己判断。适合教学。
- **宣传类**（卖货、新品）：参数表 + 只突出与竞品/旧款的关键提升（加大/高亮优势项），表末接购买按钮；常用"标准版 vs 高配版"三栏对比引导升档。

## 三、样式变体（≥3 种，带参数）

**变体 A｜两栏基础表（单值）**：见上面表格骨架——表头淡橙底、参数列右对齐 `#666`、值列 `#5a4a3a`、行间细线。参数多时加分组标题行。

**变体 B｜三栏版本对比表（两版本横向比）**:第三列改"高配版"，值列对比，优势项加粗/高亮:
```html
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
  <tr style="background:#f0fbff;">
    <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#00b8a9;line-height:1.5;">参数</td>
    <td style="padding:10px 8px;font-size:13px;color:#00b8a9;text-align:center;line-height:1.5;">标准版</td>
    <td style="padding:10px 8px;font-size:13px;font-weight:bold;color:#00b8a9;text-align:center;line-height:1.5;">高配版</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">内存</td>
    <td style="padding:8px;font-size:13px;color:#5a4a3a;text-align:center;border-top:1px solid #f2f2f2;">8 GB</td>
    <td style="padding:8px;font-size:13px;color:#5a4a3a;text-align:center;border-top:1px solid #f2f2f2;"><span style="color:#00b8a9;font-weight:bold;">16 GB</span></td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">续航</td>
    <td style="padding:8px;font-size:13px;color:#5a4a3a;text-align:center;border-top:1px solid #f2f2f2;">10 小时</td>
    <td style="padding:8px;font-size:13px;color:#5a4a3a;text-align:center;border-top:1px solid #f2f2f2;"><span style="color:#00b8a9;font-weight:bold;">14 小时</span></td>
  </tr>
</table>
```
> 高配优势项加粗 + 主题色高亮，引导升档；列少用 `text-align:center` 更整齐。

**变体 C｜分组块表（参数多时按组拆分）**：给每组前插一个整行小节标题（跨两列、淡底）。分组标题用编号文字「1 外观」「2 续航」，不用图标字符：
```html
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
  <tr>
    <td colspan="2" style="padding:8px 12px;font-size:13px;font-weight:bold;color:#ff6b35;background:#fff7f2;line-height:1.5;">1 外观</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;">尺寸</td>
    <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;">120 × 68 × 9 mm</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">重量</td>
    <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">215 g</td>
  </tr>
  <tr>
    <td colspan="2" style="padding:8px 12px;font-size:13px;font-weight:bold;color:#ff6b35;background:#fff7f2;line-height:1.5;border-top:1px solid #eee;">2 续航</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">续航</td>
    <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">14 小时</td>
  </tr>
</table>
```
> `colspan="2"` 跨行放分组标题；分组标题用 123 编号文字 + 淡底，不用图标字符；分组间可加 `border-top` 分隔；整表包一个圆角容器。

## 四、使用时机与位置

- **首选位置**：卖点/参数文案之后、价格/购买引导之前（"看你说的这些参数，眼见为实"）。
- **评测/横评**：正文中部，多个产品或版本横向比时用三栏表。
- **不适合**：开篇就甩参数表；也没人会在种草第一句就背书单。粉丝没被圈住前，参数是负担。
- 搭配：参数表后配一句"关键参数已列，详情页有完整版"防止表格过长。

**分组命名建议（别乱给组名）**：
- 用"外观 / 性能 / 续航 / 接口 / 配件"这类读者能直观理解的组名。
- 不要在组名里塞营销词（如"旗舰性能组"），参数表要显得客观，营销交给卖点段。
- 组内参数不超过 5 行，超过就再拆组；组与组用淡底分隔行拉开视觉。

## 五、风格适配（4 个例子）

- **简约商务**：灰白表、只有表头淡底，参数列 `#888` 右对齐、值列 `#333` 左对齐，无图标字符，最素。
- **科技深色**：整表 `#0f2838` 底白字，参数和值用对比色（青高亮），突出科技感。
- **国潮**：米底 + 表头红金描边，分组标题用"123"编号文字，不用图标字符。
- **日系清新**：极淡青底、圆角 14px，参数和值都用温柔色（青/灰青），无描边。

## 六、间距与尺寸（遵守硬规范）

- 表格块与前后内容：容器 `margin:0 0 16px`。
- 参数名列建议 `width:34–38%`，值列自动；三栏对比表尽量均分。
- 表头/值单元 padding 上下 8–10px、左右 10–12px；行高 1.5–1.6。
- 行间分隔 `border-top:1px solid #f2f2f2` 细线，别用粗线。
- 字号：表头 13px 加粗，正文 13px；数值不用放大，靠加粗高亮。
- 表整体 `overflow:hidden` + 圆角，避免边角戳出。

## 七、密度限制

- 参数行 **≤12 行**，再多必须分组；分组 ≤4 组。
- 三栏对比：版本 **≤3 个**（参数列 + 2 个版本），列太多手机端会挤到换行。
- 参数值 ≤适可长度，超长（如完整接口说明）留到详情页。
- 整篇参数表 **1 张**主表足够，别这里一张那里一张。

## 八、常见错误（反例 + 正解）

1. **虚标参数**。
  反例"电池容量 8000 mAh"（实测只有 5000）／正解 参数必须真实；容量/续航/性能在详情页与宣传保持一致。
2. **单位不统一 / 没单位**。
  反例"重量 0.2""续航很长""内存 16"／正解 全程统一单位：重量 g/kg、续航 小时、内存 GB，数值都带单位。
3. **参数名含糊 / 用形容词当参数**。
  反例"性能够强""屏幕够大"／正解 用确切指标"CPU 型号、屏幕 6.1 英寸、分辨率 1080p"。
4. **重点参数淹没在长表里**。
  反例 关键卖点参数（续航、防水）排在 20 行表中间没人看见。／正解 把最想强调的参数放大/高亮，或拆出来单列"核心参数"几行。
5. **表头样式混乱 / 分组无编号**。
  反例 表头不深色、分组标题没有底，读者分不清层级。／正解 表头统一淡底加粗；分组标题给独立淡底行 + 123 编号文字。

## 九、示例（可替换的骨架）

```html
<!-- 引导句 -->
<p style="font-size:15px;color:#5a4a3a;line-height:1.75;margin:0 0 10px;">关键参数一目了然，更多细节去详情页看。</p>

<!-- 两栏素表 -->
<section style="background:#ffffff;border:1px solid #eee;border-radius:12px;overflow:hidden;margin:0 0 16px;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#ff6b35;background:#fff7f2;line-height:1.5;width:34%;">参数</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#ff6b35;background:#fff7f2;line-height:1.5;">规格</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">屏幕</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">6.1 英寸 · 1080p · AMOLED</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">重量</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">215 g</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">续航</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">14 小时</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#666;line-height:1.6;border-top:1px solid #f2f2f2;">防水</td>
      <td style="padding:8px 12px;font-size:13px;color:#5a4a3a;line-height:1.6;border-top:1px solid #f2f2f2;">IPX4</td>
    </tr>
  </table>
</section>
<p style="font-size:15px;color:#5a4a3a;line-height:1.75;margin:0;">想升级容量选高配版，看下方对比。</p>
```
> 可替换：橙高亮、表头淡底换成你的主色与淡色调；参数名与规格全换成你产品的真实数据；行多就加分组建表头。

## 十、个性化空间（可调参数与判断依据）

- **两栏 vs 三栏对比**：单产品 → 两栏单值；两版本/两产品横比 → 三栏。判断依据：是否需要横向对比且结果能一眼分出优劣。
- **是否突出优势项**：宣传推升级/高配 → 放大高亮优势参数；中立横评 → 保持素色客观。判断依据：这篇立场是站队促销还是中立评测。
- **分组颗粒度**：参数 >10 行 → 必须分组；<8 行 → 一表到底。判断依据：总量。
- **表头样式（深底白字 vs 浅底深字）**：宣传类想强视觉 → 深底白字；信息类想克制 → 浅底。判断依据：调性热/稳。
- **风格色盘**：商务灰 / 科技深青 / 国潮红金 / 日系淡青。判断依据：账号主色与产品属性（数码偏青、家电偏灰）。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
