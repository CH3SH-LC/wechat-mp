# 模块·用户证言 / 口碑卡

> 定位：呈现有来源、有授权的用户反馈，帮助读者了解实际经历；不能借组件制造口碑或推导普遍效果。
> 调用时机：真实反馈与本篇问题相关且允许使用时，不固定在购买入口之前。

## 一、可用写法与语法

证言卡本质是**多则短反馈的卡片化拼装**，微信里用内联样式排版。推荐两走法：

- **内联样式手工卡**（最稳，粘贴不易乱）：用 `<section>` 做卡、`<p>` 装"人 + 结果"、标注色强调数字/结论。见第九节骨架。
- **换行符弱排版**（极简）：不用卡片容器，每则证言用完整引文与真实署名之间留一个 `height:16px` 占位段，靠行距天然分隔。

**引文处理**：保留反馈原意、必要语境和来源信息。直接引用遵守原文，转述明确其性质；不得增加对方没有说过的时间、数字、困境或效果，也不把长反馈改造成短句口碑。没有可用反馈时省略这个模块。

**素材从哪来**（真证言的来源，别靠编）：
1. 文章留言区、私信里读者自发的好评。
2. 购买/付费后的好评截图、返场复购时读者说的话。
3. 社群里的提问感谢、打卡成功的自报成绩。
4. 主动回访老用户，"用了三个月感觉怎么样"收到的回复。
5. （拿到授权后）课程/服务评价后台的真实评价。

**合规底线**（必读，见第八节详述）：
1. 证言**必须是真实发生的**，禁止无中生有、张冠李戴、夸大疗效/收益。
2. 用于商业宣传的用户证言，**原则上要有本人授权**；涉及前后效果对比（尤其课程、身体、理财）证据必须真实可查。
3. 涉及治疗效果、收益承诺、绝对化用语（最、第一、立减）直接踩红线，一律删。
4. 医疗/投资/教育类证言，额外看行业合规，可在卡下挂"个人经历，效果因人而异"提示。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：以正文层级或引用样式呈现真实反馈；保留原始语气，不改成聊天记录，不规定主证言压轴。
- **宣传类**：可用卡片、线条与重点标记区分来源；并列只用于确实需要比较的反馈，不强制堆出口碑墙或接购买号召。

## 三、样式变体（≥3 种，带参数）

**变体 A｜单条证言大卡（压轴款）**——适合放最重要的一则:
```html
<section style="background:#fff7f2;border-left:4px solid #ff6b35;border-radius:0 12px 12px 0;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;color:#5a4a3a;line-height:1.75;margin:0 0 10px;">"考了三次没过的科目二，这个月一把过了。教练说我是他带过最稳的"</p>
  <p style="font-size:13px;color:#b08068;line-height:1.7;margin:0;">—— 30岁 · 全职妈妈 阿岚</p>
</section>
```

**变体 B｜双列口碑墙（多条并排）**——两张淡色卡并排，table-cell 最稳:
```html
<section style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
    <tr>
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f0fbff;border-radius:12px;padding:14px 16px;margin:0 8px 0 0;">
          <p style="font-size:14px;color:#4a6a63;line-height:1.75;margin:0 0 8px;">"坚持打卡 21 天，睡眠打分从 62 涨到 81"</p>
          <p style="font-size:12px;color:#7fa49d;line-height:1.6;margin:0;">程序员 · 阿凯</p>
        </section>
      </td>
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f3f1ff;border-radius:12px;padding:14px 16px;margin:0 0 0 8px;">
          <p style="font-size:14px;color:#6a5a9a;line-height:1.75;margin:0 0 8px;">"9 点下班的新媒体人，这周天天提前交稿"</p>
          <p style="font-size:12px;color:#9a87c4;line-height:1.6;margin:0;">运营 · 小林</p>
        </section>
      </td>
    </tr>
  </table>
</section>
```

**变体 C｜数字高亮条（结果突出款）**——把"结果数字"用主色放大，适合有硬指标的场景:
```html
<section style="background:#ffffff;border:1px solid #ffe0d0;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0 0 8px;">"坚持晨跑 3 个月，"</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0;">体重从 <span style="color:#ff6b35;font-weight:bold;font-size:20px;">78kg</span> 降到 <span style="color:#ff6b35;font-weight:bold;font-size:20px;">69kg</span>，体检指标全绿。"</p>
  <p style="font-size:12px;color:#b0a090;line-height:1.6;margin:8px 0 0;">—— 销售 · 大伟</p>
</section>
```

**变体 D｜quote 引用风证言（最轻的一种）**——整段只靠引号 + 署名，不用卡:
```html
<p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;">“用之前以为又是一次智商税，结果 2 个月就达标了。”</p>
<p style="font-size:13px;color:#ff8f5e;line-height:1.7;margin:0 0 10px;">—— 设计师 阿C</p>
<p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;">“孕期 6 个月，动作做起来比想象中缓和，老师会提醒别硬撑。”</p>
<p style="font-size:13px;color:#ff8f5e;line-height:1.7;margin:0;">—— 准妈妈 云朵</p>
```
> 每条"引文 + 署名"之间 4–10px 收紧，多条连排自然成"聊天记录"感，适合文字类弱转化。

**变体 E｜图卡 + 文字卡配对（最强真实感）**——有授权化的评论区截图/反馈图时，先放一张图卡（`border-radius:12px;overflow:hidden;margin:0 0 12px;border:1px solid #eee` 包裹 `img`），下面接一段文字总结，图文互证:
```html
<section style="border-radius:12px;overflow:hidden;margin:0 0 12px;border:1px solid #eee;">
  <img src="https://mmbiz.qpic.cn/你的截图图ID/640" style="width:100%;display:block;border-radius:12px;margin:0;" />
</section>
<p style="font-size:13px;color:#8a7a70;line-height:1.75;margin:0;">上图是一位学员的真实评价（已获授权）——注意他提到"第 2 周开始不用提醒就自觉打卡"，这正是方法起效的拐点。</p>
```
> 截图务必经当事人授权、确保图片走微信素材上传（mmbiz 链接）；涉及人名、聊天头像按需打码。图卡用细边框 + 圆角包裹，不用投影。

## 四、使用时机与位置

- **位置**：紧邻反馈所支持、说明或限制的内容，不预设能够提高转化。
- **篇末使用**：只有文章本身需要在此呈现这份材料时才使用，不添加固定背书收尾。
- **最适合的文体**：带货软文、课程招生、付费社群介绍、服务口碑文。
- **不适合**：没有可核实反馈或反馈与本篇无关时不使用，不能为了填充版面补造。
- 一篇里证言块 **1 处**即可（长篇可 2 处：正文一处、结尾一处），多了反而像刷屏广告。

## 五、风格适配（4 个例子）

- **简约科技/商务**：灰白卡 `background:#f7f7f7`、`border:0`，名字下方一行小字 `color:#999`，几乎无色。
- **国潮**：米底 `#fbf3e8` + 红金描边 `border:1px solid #e8c56b`，人名用楷体感（无外链字体则靠字号放大）。
- **日系/清新**：极淡青 `#f0faf8`、圆角 14px、无边框，保留完整引文与署名。
- **港风**：整块高饱和撞色——橙底 `#e56b2f` + 白字，适合强促销；背景深、文字白，对比拉满。
- **配图联动**：若有授权化的真实头像/评论区截图，可把截图做成图卡配在证言旁，真实感上升一个台阶（注意处理隐私，涉及实名信息打码）。

## 六、间距与尺寸（遵守硬规范）

- 块与块（证言卡之间、证言卡与其前后段）：底部 `margin:0 0 16px`。
- 卡内：内容上 `14px`、左右 `16px`、下 `12px`（`padding:14px 16px 12px`）。
- 引文与名字之间：`margin:0 0 10px`（卡内 8px 档收紧）。
- 正文/引文行高统一 **1.75**；名字行 1.6–1.7。
- 页边距不自设（正文自带左右 16px）；卡不额外内缩，避免三层缩进。
- 引文字号正文级（15px）或略小（14px）；名字 12–13px 灰字。
- 若证言卡上是引用样式，引文可加"引号"前缀（“ ”），无需 `:::` 容器也能有引用感。

## 七、密度限制

- 一篇证言总则数：单条大卡 **1 则压轴**，口碑墙 **2–4 则**已是上限；再多读者扫不动。
- 卡内引文保留完整语义及必要上下文；空间不足时用纵向引用或普通正文，不拆短、不摘取会歪曲意思的高光句。
- 高亮数字/结论**每卡 ≤2 处**；全篇证言块 1–2 处。
- 并排卡正文保持 13–14px 以上的可读字号；长反馈改为单列，不能为窄卡删掉条件或压缩成口号。
- 证言风格（单选/双列/数字/引用风）**一篇只选一种**，别混搭出四不像。

## 八、常见错误（反例 + 正解）

1. **凭空虚构证言**。
  反例"小美用了一周皮肤白了一个度"（无此人、无授权，涉虚假宣传）。／正解 只收真实反馈；先问读者要授权，加"真实截图/真实留言"标注。
2. **只有形容词没有结果**。
  缺乏具体信息的反馈可以不采用，但不能替原作者补写消费金额、时间或效果。
3. **夸大收益/踩绝对化**。
  无证据的效果和普遍性结论应删除；换成“多数人”或模糊时长仍需证据。
4. **证言张冠李戴 / 挪用他人头像照片**。
  反例 拿一张网图配"这位学员瘦了 20 斤"／正解 用授权过的本人头像或打码，配文写清楚来源；没图就该只写字。
5. **忽视行业合规（医疗/理财/教育）**。
  不采用未经证实的医疗、收益或教育效果承诺；补一句“因人而异”不能修复虚假信息。
6. **一篇混用多种证言样式**。
  反例 同一篇里面既有引用风又有数字高亮又有双列，视觉混乱。／正解 全篇统一一种证言形式，风格一致才像"一个公道的话"。

## 九、示例（可替换的骨架）

**示例使用边界**：下列片段只示意布局，实际引文和署名必须替换为有授权的原文，不提供虚构反馈填空模板。

```html
<!-- 标题：第三条真实反馈 -->
<p style="font-size:16px;font-weight:bold;color:#5a4a3a;margin:0 0 6px;line-height:1.5;">他们真的用出了效果</p>
<p style="font-size:13px;color:#999;margin:0 0 10px;line-height:1.7;">以下均来自真实学员，已获授权</p>

<!-- 单条压轴证言 -->
<section style="background:#fff7f2;border-left:4px solid #ff6b35;border-radius:0 12px 12px 0;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;color:#5a4a3a;line-height:1.75;margin:0 0 10px;">"考了三次没过的科目二，这个月一把过了，教练说我心态比练车时稳多了。"</p>
  <p style="font-size:13px;color:#b08068;line-height:1.7;margin:0;">—— 30岁 · 全职妈妈 阿岚</p>
</section>

<!-- 双列口碑墙 -->
<section style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
    <tr>
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f0fbff;border-radius:12px;padding:14px 16px;margin:0 8px 0 0;">
          <p style="font-size:14px;color:#4a6a63;line-height:1.75;margin:0 0 8px;">"打卡 21 天睡眠打分 62→81"</p>
          <p style="font-size:12px;color:#7fa49d;line-height:1.6;margin:0;">程序员 · 阿凯</p>
        </section>
      </td>
      <td style="width:50%;vertical-align:top;box-sizing:border-box;">
        <section style="background:#f3f1ff;border-radius:12px;padding:14px 16px;margin:0 0 0 8px;">
          <p style="font-size:14px;color:#6a5a9a;line-height:1.75;margin:0 0 8px;">"9 点下班，这周天天提前交稿"</p>
          <p style="font-size:12px;color:#9a87c4;line-height:1.6;margin:0;">运营 · 小林</p>
        </section>
      </td>
    </tr>
  </table>
</section>
```
> 可替换：橘色字改成你的主色；人名年龄职业照真实改；把"科目二/睡眠打分/交稿"换成你的产品真实产出；双列卡填不下就减到单条；想更轻就把大卡换成变体 D 的引用风。

## 十、个性化空间（可调参数与判断依据）

- **卡片底色 / 左边条色**：由账号主色定。橙→`#fff7f2`+`#e56b2f`；青→`#f0fbff`+`#00b8a9`；商务→灰。判断依据：主色是暖还是冷，暖色证言更"贴心"、冷色更"专业"。
- **单条 vs 双列 vs 数字高亮 vs 引用风**：读者决策越重（高客单、课程）越用单条大卡压轴；越轻（低价小物）越用双列堆人气；有硬指标用数字高亮；纯内容号用引用风。判断依据：客单价与决策成本。
- **证言则数与详略**：干货号弱转化用 1–2 则克制；带货/促销用口碑墙。判断依据：这篇转化目的强不强。
- **是否放名字/职业标签**：真实授权且读者在意可信度时放；敏感行业（理财、医疗）可只留化名或匿名。
- **是否配真实截图卡**：有授权化的真实反馈图 → 用图卡增强真实感；没有 → 纯文字更安全。判断依据：手头有没有真图、涉及隐私程度。
- **风格色盘替换**：切 4 种风格（科技灰、国潮红金、日系淡青、港风高饱和），依据账号调性与内容类型选。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
