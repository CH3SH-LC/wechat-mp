# 模块 · 清单勾选 / 自查表

> 定位：用「CSS 勾选框」把一份可逐一核对的清单列出来，让读者像打勾一样逐条确认，产生"参与感、完成感"——它是"核对 / 自查"的机制，不是普通并列列表。勾选意味着读者在自己身上"过一遍"：做到一条划一条，最后得到一个"我做到了几条 / 我踩中几条"的结果。
> 调用时机：教程文结尾的自查清单、方法文的"你是否中招"式自查、发布/运营前的核对表——凡是"读者（或小编）可以逐条对照自己有没有做到、有没有踩坑"的内容都适合。它把"读"变成"做一遍"，黏性更高、也更容易引导转发（"你踩中几条？留言告诉我"）。

## 一、可用写法与语法

写作语法有两种：用 `:checklist` 容器，或在每一行行首直接放 **CSS 勾选框 span** 表示"未做 / 已做"两种状态。勾选清单让读者在心理上"逐条标记"，所以**每一条都必须能被独立回答"是 / 否"**——这是它与普通列表最根本的区别。

**勾选框的 CSS 形状实现**（不写字形字符，如"空心方块""打勾""错叉"等 Unicode 装饰符号；一律用 border 画方框、用内层对钩 span 拼勾）：

未做（空心方框）：
```html
<span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>
```
已做（内嵌对钩）：
```html
<span style="display:inline-block;width:12px;height:12px;border:2px solid #18a058;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"><span style="display:block;width:4px;height:8px;border-right:2px solid #18a058;border-bottom:2px solid #18a058;transform:rotate(45deg);margin:1px 0 0 2px;"></span></span>
```

**写法要点**：
1. **每一条是一个可判断的动作或状态**：写"确认标题含关键词"而不是"标题"——读者读完要能马上答"是 / 否"，不能用"还行、大概、看情况"蒙混过去。
2. **已完成项用删除线**：已经做到、已经踩过坑、已经排除的项，文字加删除线（用 `<s>`），表示"这一条我勾掉了"，和未做的空心方框形成进度感。
3. **结构统一、逐条陈述**：每条尽量 ≤1 行，清楚到读者不用想就能打勾；不要一条半句话、一条两句话地长短拉锯。
4. **勾选意义**：它是"读者的自查动作"，最适合作"你是否中招 / 你做到几条 / 发布前检查"这类强互动体。交给读者的不是信息，是一个可以进行的动作。
5. 做标记也可搭配 art:// 植物图案点缀（`![小草](art://sprig-grass)`）分隔清单首尾，不占字形字符。

## 二、双模式表现（文字类/宣传类）

**文字类（文字排版优先）**：勾选框用最朴素的细边框 + 灰色，字色与正文一致（`#333`），已做项加删除线变灰，像一份可靠的"对照检查表"。它的核心是"方框形状 + 划线"带来的勾选动作本身，不额外加色块、不加背景，让读者专注逐条打勾。

**宣传类（视觉优先）**：勾选框用主色高亮——已做用主色实心勾、未做用空心灰框，重点项加粗，可把"你踩中几条"做成引导语（如"看看上面这 5 条你中了几条？"）。多用于"自查 + 通往解决方案"的转化钩子：勾中越多 → 越需要看正文下文 / 越需要约客服/下单。**两种模式都没必要上重色块**——清单的核心是"方框 + 划线"，色彩只是轻暗示，把每行单独描成一个色块反而失去了打勾的清爽。

**两个模式在同一篇里只选其一**：文字类全文用素色方框 + 划线，宣传类用主色方框 + 加粗引导，不要一半素、一半主色——混用会让读者分不清这套清单到底是"对照检查"还是"转化钩子"（见模块组合铁律）。

## 三、样式变体（4 种常用，具体参数）

清单的行高统一比正文大：**`line-height:1.9`**，给 CSS 勾选框留出垂直空间，避免与上下行粘连。以下是 4 种最常用的模板。

**变体 A｜未做「空心方框」自查清单（"你是否中招"用）**——适用：开篇/中段列举常见错误：
```html
<p style="margin:0 0 16px;line-height:1.9;font-size:14px;color:#333;">
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>标题没有关键词，读者搜不到<br/>
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>配图版权未确认<br/>
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>发布前没做合规自查
</p>
```
- 参数：每行一个空心方框 span + 一条可答"是/否"的陈述；行高 1.9 让方框与上下行拉开距离；正文 14px、字色 `#333`；整组底部 `margin:0 0 16px`（块距 16px）。

**变体 B｜「对 / 错」对照（"你错在哪"用）**——适用：错误示范 vs 正确示范：
```html
<p style="margin:0 0 4px;line-height:1.75;font-size:14px;color:#8a2418;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#9a281f;vertical-align:1px;margin-right:6px;"></span>全文只有一个长段落，没有小标题</p>
<p style="margin:0 0 16px;line-height:1.75;font-size:14px;color:#1f6b3d;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#18a058;vertical-align:1px;margin-right:6px;"></span>每 300-500 字就切一个小章节</p>
```
- 参数：错例用红色实心圆 `#9a281f`、正例用绿色实心圆 `#18a058`，一对红一对绿成组；这组是"对照"不是"自查"，行高可收回到 1.75，红绿本身已足够区分；底部 16px 收尾。

**变体 C｜已完成划线（"你做到几条"用）**——适用：进度感、教程结尾清单：
```html
<p style="margin:0 0 16px;line-height:1.9;font-size:14px;color:#333;">
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #18a058;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"><span style="display:block;width:4px;height:8px;border-right:2px solid #18a058;border-bottom:2px solid #18a058;transform:rotate(45deg);margin:1px 0 0 2px;"></span></span><s style="color:#999;">确认了选题方向</s><br/>
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #18a058;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"><span style="display:block;width:4px;height:8px;border-right:2px solid #18a058;border-bottom:2px solid #18a058;transform:rotate(45deg);margin:1px 0 0 2px;"></span></span><s style="color:#999;">拟好钩子标题</s><br/>
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>选好视觉风格（进行中）
</p>
```
- 参数：已做项用"实心对钩方框" + 文字加删除线 `<s>` 并变灰 `#999`（表示"完成 / 勾掉"）；未做项留空心方框、字色保持 `#333`。划线的灰与未做的深色形成"进度感"，读者一眼看到还剩几条没做。

**变体 D｜带编号1的发布前核对表（收进浅卡）**——适用：面向小编/运营团队的自查：
```html
<section style="background:#f7f9fc;border:1px solid #ececec;border-radius:12px;padding:16px;margin:0 0 16px;">
  <p style="margin:0 0 10px;line-height:1.5;font-size:15px;font-weight:bold;color:#2c3e50;">发布前必查</p>
  <p style="margin:0 0 6px;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>1 标题 ≤28 字且含关键词</p>
  <p style="margin:0 0 6px;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>2 首屏有钩子</p>
  <p style="margin:0 0 6px;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>3 配图已上传微信</p>
  <p style="margin:0 0 6px;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>4 无不符规词汇</p>
  <p style="margin:0;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>5 封面文字不压脸</p>
</section>
```
- 参数：整组收进浅底卡（底色 `#f7f9fc` + `border:1px solid #ececec`、圆角 12px、内部 `padding:16px`）；每条一个空心方框 span + `1` 序号 + 可判断陈述；条目行高 1.9；卡标题 15px 加粗、深蓝灰 `#2c3e50`，条目 14px；卡底部 `margin:0 0 16px`。适合"编辑器 / 运营团队"边编辑边逐条勾掉的正式核对表。

## 四、使用时机与位置

- **教程/方法文结尾**：正文讲完"诀窍"后给一份"自我检查清单"，让读者立刻自查是否做到——这是清单最经典的落点，正文给方法、清单变动作。
- **"你是否中招"类自查**：开篇或正文中段列举常见错误清单，读者逐条"对号入座"，互动感强、易转发（"你中了几条"自带传播钩子）。
- **发布/运营核对表**：面向小编团队的发布前自查，用带编号的清单（变体 D）收进浅卡，边编辑边逐条勾。
- **位置顺序**：自查清单通常放在"讲完问题 / 方法之后"作为落地动作，紧跟行动号召之前；"中招清单"放正文中段制造"啊对号入座了"的会心一击。
- **不要清单开场**：清单是"确认动作"，需要先让读者进入"我在学 / 我在核对"的状态。没有铺垫就甩一屏勾选框，读者不知道要对齐什么；至少先给一句"下面这几条，你中了几个？"引导。

## 五、风格适配（4 个例子）

- **极简/商务**：用变体 A，方框用最朴素细边框灰色，灰黑两色（`#333` / `#999`），行高拉开即完成，不装卡、不加色，克制到底。
- **教育/成长**：用变体 C 已完成划线 + 暖色调，勾选框用 `#ff8a3d` 暖橙、划线灰 `#b0a89a`，首尾可加 art:// 植物图案（`![花枝](art://blossom-branch)`）当软分隔，轻松有进度感，鼓励"还差一步就完成了"。
- **电商/营销**：用变体 D 带编号清单收进卡 + 主推亮橙标题（`#e56b2f`），适合"购买前自问 4 问 / 你符合哪几条"之类转化钩子，勾中越多越接近下单。
- **运营/技术**：把自查做成"对照正确 / 错误"（变体 B），红绿一眼看出问题，加一句"对照上面，你的正文踩了几条"，适合小编发布前查错。

**风格统一原则**：清单的风格要与整篇其他模块保持一致——如果全篇用浅底圆角卡，清单装卡用同色系浅底；如果是极简灰黑风，清单就素到底。清单是"全篇衣服上的一颗扣子"，不能单独换风格、更不能每一条都描成色块（那已经不是清单了）。

## 六、间距与尺寸（遵守硬规范）

- **清单与前后块距离**：整组 `margin:0 0 16px`（块距基线 16px）。清单后面若紧跟另一块，中间仍是 16px，不要两个清单挤在一起。
- **条目行高**：清单普遍用 `line-height:1.9`（比正文 1.75 略大），给 CSS 勾选框留出垂直空间，避免与上下行粘连。这是清单特有的"宽松感"；只有变体 B 那种红绿对照可回收到 1.75（红绿本身已够区分）。
- **方框与文字**：行首勾选框后留 `margin-right:6px`；编号清单按 `方框 + 1` 对齐缩进。
- **字号**：正文项目 14px；装卡的核对表卡标题 15px、条目 14px。
- **划线样式**：删除线用 `<s>`，加 `color:#999` 降级成灰色；删除线要紧贴文字、别用多余符号画线。

## 七、配色配合（与全篇色盘协同）

清单的颜色同样从全篇色盘里取，不能自成一套。

- **单色用法**：自查清单统一用一个"勾选主色"——已做勾框用主色、未做用空心灰框，整篇强调点与卡片/列表共用这个主色。最克制、最好维护，也最像一份干净的检查表。
- **红绿对照用法**：只有"错 vs 对"对照（变体 B）时才允许红绿双色，且红色一定数量最少（只有错误示范用），绿色是正确示范；红色多到成片就变成了"整页都是错"，情绪过重。
- **品牌色替换**：把勾选框替换成品牌主色体系，划线灰也跟着品牌灰调。判断依据：品牌色能否在"已做深色 / 未做空心 / 划线灰色"之间拉开层次，若能就换，若挤不出就退回灰黑单色。
- **避免**：整组清单每一条换一个颜色（红橙蓝绿开会），读者分不清这些方框到底是"对错"还是"轻重"；也避免把未做项和重点项涂成同一个浓度。
- **与正文关系**：勾选框色与正文文字 `#333` 区分度要够；划线灰 `#999` 只用于"已完成"的弱化，不要在未做项上就用灰（未做是需要读者留意的现状）。

## 八、微信兼容注意

写清单时的"可用子集"与"要绕开的坑"（微信富文本编辑器）：

- **可用**：`border`（细边框方框）、`border-radius`、`transform:rotate`（拼对钩）、`width/height`（inline-block 勾选框）、`line-height`（1.9/1.75）、`color`、`font-size`、`margin`、`background` 浅底色、`<s>` 删除线全部可靠。本规范以 CSS 勾选框代替字形字符，字体渲染兼容问题更少。
- **尽量别用**：伪元素（`::before / ::after`）多被编辑器剥除——勾选框老老实实用内层 `<span>` 拼对钩，别想用 CSS 画一条会"变绿对齐"的假勾选框；`display:flex` 做勾选框与文字分列在旧端易错位，宁可在同一行用文本前后拼接。
- **删除线**：用 `<s>` 或者 `~~删除线~~` 都由编辑器渲染，别自造"横线符"手绘删除线（会歪、也禁不起修改）。
- **勾选框的显示**：旧安卓字体里字形方框类装饰符号可能显示成小方框、甚至乱码；本规范统一用 `border` 画空心方框 + 内层对钩 span，任何内核都稳定显示。若确需保留字形兜底，务必保证装饰失效后内容字面仍可读。
- **通用兜底原则**：任何一种装饰"锦上添花"时，优先保留"素色方框 + 16px 块距 + 14px 正文"组合——即使勾选框渲染有偏差，读者仍能逐条读下来。

## 九、密度限制（重要）

- **每组 ≤7 条**：勾选框一多就眼花，7 条是舒适上限；超过就拆成"基础自查 + 进阶自查"两组，各加一个小标题。
- **有"已完成"也有"未做"才用划线**：一篇 ≤2 组清单即可，别全文都做成勾选（失去新鲜感也拖慢阅读）。全是"已划线完成"没有留给读者的空方框，完成感反而消失。
- **清单不与列表混用**：同一屏内不要"上半段勾选 + 下半段圆点列表"搅不清结构——一行带勾选框、一行又变成圆点，读者不知道该勾还是该看；同一组要么勾选要么列表。
- **每项必须可答是/否**：不能独立判断的项别塞进清单（那该用普通「模块 · 列表」）；"真列不出几条能自查的"就说明这内容不适合清单。
- **变体 B 是一组分两行的对照，不是两组清单**：红绿对照整体算"一组"，仍受"一篇 ≤2 组"约束。

## 十、常见错误（反例 + 正解）

- **反例**："空方框 标题。空方框 配图。空方框 格式。"（抽象名词，没法答"是否做到"）→ **正解**："空方框 标题已含核心关键词；空方框 配图已上传微信；空方框 字号行高已符合间距规范。"每条都能打勾判断。
- **反例**：全部"已做"划线，读者没有可勾的 => 完成感消失 → **正解**：保留至少一条"进行中 / 待你做"的空方框，让读者有"还剩 1 件事你可以做"的动力。
- **反例**：一屏 12 条勾选，滑三屏才勾完 → **正解**：7 条封顶，拆成"已完成 / 待完成"两组或精简到核心。
- **反例**：把勾选框当"并列列表"用，混用各种字形勾选符号 → **正解**：一个清单只用一个勾选框样式（全空心方框 或 全对钩方框），别混（见「模块 · 列表」与本章的边界）。
- **反例**：清单用 `line-height:1.75`，勾选框贴在上下文字上黏成一团 → **正解**：清单独用 `line-height:1.9`，方框与行距分开，视觉透气。
- **反例**："你是否中招"清单放在全篇最前面、没有任何引导 → **正解**：清单前先给一句"下面这 5 条，你中了几个？"，再上勾选框，读者才知道要对齐什么。

## 十一、示例（可用骨架，标注可替换处）

```markdown
:checklist
- 标题含核心关键词
- 配图已上传微信素材库
- 发布前完成合规自查
```
（文字类默认勾选清单。**可替换**：每条的可判断陈述、勾选状态"未做/已做"、是否加删除线。）

```html
<!-- 自查清单（"你是否中招"用）：可替换陈述/勾选态/划线 -->
<p style="margin:0 0 16px;line-height:1.9;font-size:14px;color:#333;">
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #18a058;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"><span style="display:block;width:4px;height:8px;border-right:2px solid #18a058;border-bottom:2px solid #18a058;transform:rotate(45deg);margin:1px 0 0 2px;"></span></span><s style="color:#999;">标题没有关键词</s><br/>
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>全文只有一个长段落<br/>
  <span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>发布前没做合规自查
</p>
```
**可替换处**：每条陈述（可答是/否）、勾选框"未做/已做"态、划线灰字。判断依据：是不是"读者可逐条核对打勾"的自查内容且 ≥3 条——是才用清单；更偏行动引导的并列就交给「模块 · 列表」。

```html
<!-- 发布前核对表（收进浅卡）：可替换标题/条目/序号 -->
<section style="background:#f7f9fc;border:1px solid #ececec;border-radius:12px;padding:16px;margin:0 0 16px;">
  <p style="margin:0 0 10px;line-height:1.5;font-size:15px;font-weight:bold;color:#2c3e50;">排版发布必查</p>
  <p style="margin:0 0 6px;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>1 字号与行高符合间距规范</p>
  <p style="margin:0 0 6px;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>2 块与块之间留足 16px</p>
  <p style="margin:0;line-height:1.9;font-size:14px;color:#333;"><span style="display:inline-block;width:12px;height:12px;border:2px solid #c8c8c8;border-radius:2px;vertical-align:-2px;margin-right:6px;box-sizing:border-box;"></span>3 无违禁词、无医疗功效类用语</p>
</section>
```
**可替换处**：卡标题、条目序号与内容、"收卡 or 裸清单"。判断依据：是否面向团队多人核对（正式用卡）、读者自己随便勾（裸清单更轻松）。

**组合示例（一篇的稳妥用法）**：正文 **中段** 一个"你是否中招"清单（变体 A，空心方框素色）→ **结尾** 一个"自我检查清单"（变体 C，已完成划线，引导"你做到几条"）。两组清单刚好覆盖"中招提醒 + 落地动作"，密度落在 1 篇 ≤2 组规则内，且与全文其他模块（气泡、列表）互不抢戏。

## 十二、个性化空间（可调参数与判断依据）

- **方框样式**：空心方框（未做）、对钩方框（已做）、红绿圆点（对照）。判断依据：自查类型——中招式用空心方框，正误示范用红绿圆点，发布前核对表用编号。
- **勾选框颜色**：文字类素色 `#333`；宣传类主色（已做勾框用主色、未做空心灰框）。判断依据：是否强调"勾中越多越有行动意义"——是才染主色，只是想对照就保持素色。
- **是否装卡**：轻互动裸清单 vs 正式核对表收进浅底卡（`#f7f9fc`、`border:1px solid #ececec`、圆角 12px、padding 16px）。判断依据：是否面向团队多人核对（正式用卡）、读者自己勾（裸清单更轻松）。
- **行高**：1.9（清单默认）/ 1.75（红绿对照）。判断依据：勾选框是否会与上下行粘连是决定因素，条目短可收小、一条两行就放大。
- **划线表示**：已完成全部划线、或"进度感"刻意留下未勾项。判断依据：想让读者"逐条跟上打勾"就保留未勾项（推荐），单纯示例可划线示意。
- **引导语有无**：开头可加"下面这 N 条你中了几条？"增强互动。判断依据：想做成传播钩子就加引导复述，纯内部核对表不必加。
- **条数弹性**：≤7 条为上限。判断依据：内容确实多就拆两组带小标题，别挤在一组里把读者眼睛看花。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
