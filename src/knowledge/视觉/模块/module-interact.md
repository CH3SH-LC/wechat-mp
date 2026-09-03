# 模块·读者互动块

> 定位：在正文里给出投票/抽奖/问卷/留言引导四种互动，把读者从"只看"变成"参与"，提升粘性、涨粉和选题情报。
> 调用时机：活动、涨粉、选题收集、测读者偏好；当文章读完想让读者"动手回应"而不是默默滑走时。

## 一、可用写法与语法

互动块是"引导+承接"的组合：先用一段话给互动理由，再用对应形式让读者参与。微信支持的互动形式如下：

**1. 投票**：正文插入微信**官方投票组件**（编辑器"投票"按钮），列出 2–6 个选项。用于 A/B 选择、偏好调查。
- 文案引导："你选哪个？投完看看大家怎么选"。选项要互斥、覆盖主流、别给"其他"留太大模糊空间。

**2. 抽奖**：抽奖一般走**小程序/工具（如抽奖助手、打卡抽奖）**链接，正文放入口卡并说明规则。
- 必须真实、奖品明确、规则清楚（怎么参与、何时开奖、如何兑奖），见合规。

**3. 问卷**：用小程序/第三方问卷工具（腾讯问卷、问卷星）生成链接，正文放"点此填写"入口。
- 用于选题收集、用户画像、课程需求调研。问题别太多（≤5 题），给"评论也行"的备选。

**4. 留言引导**：正文结尾引导读者评论（纯文字，最通用）。
- "聊聊你的看法""评论区说说你的情况，我尽量回"。给话题点 + 开放问题，比"欢迎留言"更容易触发。

**各互动形式的文案示例（可直接抄改）：**
- 投票："你写稿最卡的是哪步？投个票，我下期拆最痛的那步。"
- 抽奖："转评赞里抽 3 位送新出的《排版手册》实体书，评论一句你最近的困惑就行。"
- 问卷："愿意花 30 秒帮我把选题做得更贴你的话，点下方填一下，匿名。"
- 留言："评论区说一个你最想改掉的写作习惯，我来逐条回。"
每种都给"一个具体的动作 + 一个具体的反馈/回报"，互动率才会起来。

**通用引导句式**：
- 讲清"参与能得到什么/我对它感兴趣"：如"你们的选择决定我下期写哪个"。
- 给读者一个轻松参与的低门槛动作：投票 > 留言 > 问卷 > 抽奖（门槛递升）。
- 给"为什么想问"：投票是"猜大家选哪个"，问卷是"帮我把内容做得更贴你"，抽奖是"回馈一直在的你"。

**四种互动怎么配（选型思路）**：
| 目的 | 首选互动 | 次选 | 提醒 |
|---|---|---|---|
| 让读者随手参与 | 投票 / 留言 | — | 门槛最低，先保参与率 |
| 涨粉 | 抽奖 / 抽奖+关注 | 留言 | 规则透明，别诱导转发刷关注 |
| 收集选题情报 | 问卷 / 投票 | 留言 | 问卷别太长，≤5 题 |
| 拉近关系 / 情感连接 | 留言引导 | 投票 | 给话题点，开放提问 |

**互动块要与正文同题**：投票/问卷/留言的话题应围绕本文主题或"下一步该写什么"，别突然跳到一个无关问题，否则读者找不到参与的理由。

**合规底线（抽奖尤其重要）**：
1. **抽奖必须真实兑现**，奖项、数量、开奖时间、兑奖方式写清楚；禁止"虚假抽奖"刷粉骗关注。
2. 奖品明确（具体是什么、几份），不写"神秘大奖"画饼。
3. 抽奖不可设为"仅转发才参与"诱导过度分享、不可变相刷关注（微信规则有限制）。
4. 涉及现金、实物，依法规与微信平台活动规范执行，不承诺无法兑现的。

## 二、双模式表现（文字类 / 宣传类）

- **文字类**（干货、观点、情感）：以留言+投票为主，评论区套近乎（"看完想聊就聊"），弱抽奖。
- **宣传类**（活动、涨粉、促销）：投票/抽奖为主，视觉热点强，抽奖口子大，配合涨粉引导。注意别让抽奖喧宾夺主盖过内容。

## 三、样式变体（≥3 种，带参数）

**变体 A｜投票引导框（纯文案 + 选项缩略展示）**:
```html
<section style="background:#f7f7f7;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 8px;line-height:1.5;"><span style="display:inline-block;width:6px;height:6px;background:#ff6b35;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>你更想我先写哪个？</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0 0 6px;">A. 排版避坑指南</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0 0 6px;">B. 开头怎么写不跑粉</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0;">C. 标题公式合集</p>
  <p style="font-size:13px;font-weight:bold;color:#ff6b35;margin:8px 0 0;line-height:1.7;">投完下方投票，结果决定下期选题</p>
</section>
```
> 灰卡装引导 + 文字选项预览，正式的投票组件紧随其后；缩略选项降低"要不要参与"的心理门槛。

**变体 B｜抽奖规则卡（清楚写规则）**:
```html
<section style="background:#fff7f2;border:1px solid #ffe0d0;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#ff6b35;margin:0 0 8px;line-height:1.5;"><span style="display:inline-block;width:6px;height:6px;background:#ff6b35;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>转发抽奖</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.8;margin:0 0 4px;">参与：文末留言一句你想说的</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.8;margin:0 0 4px;">奖品：3 份《公众号运营手册》实体书</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.8;margin:0;">开奖：8 月 30 日晚 8 点在留言区公布</p>
</section>
```
> 把"参与方式 / 奖品 / 开奖时间 / 兑奖"用几行写死，规则透明最能建立信任。抽奖入口用小程序的抽奖卡片接在后面。

**变体 C｜问卷入口卡（点击填写）**:
```html
<section style="background:#ffffff;border:1px solid #dcefea;border-radius:12px;padding:14px 16px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <section style="flex:1;padding-right:10px;">
    <p style="font-size:15px;font-weight:bold;color:#4a6a63;margin:0 0 4px;line-height:1.5;"><span style="display:inline-block;width:6px;height:6px;background:#00b8a9;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>30 秒小问卷</p>
    <p style="font-size:12px;color:#8a8a8a;margin:0;line-height:1.7;">说说你最需要的干货方向</p>
  </section>
  <span style="display:inline-block;font-size:13px;font-weight:bold;color:#fff;background:#00b8a9;border-radius:16px;padding:6px 14px;line-height:1.5;flex-shrink:0;">去填写</span>
</section>
```
> 左说明右按钮，点进问卷工具；用青色调区别于促销橙，降低"又要我掏钱"的戒备。

## 四、使用时机与位置

- **投票**：正文中后段（观点/选择类内容之后），"你选哪个"+官方投票。
- **抽奖**：结尾或活动页，配清晰规则 + 入口；涨粉活动常挂在结尾。
- **问卷**：正文末尾或独立调研，别在内容高潮段打断。
- **留言引导**：全文末尾必用（配合行动号召）；观点/情感文尤其有效。
- **互动块与内容不脱节**：投票/问卷要围绕本文主题或下期方向，别突然问无关问题。

## 五、风格适配（4 个例子）

- **简约干货**：灰卡 + 一行引导 + 投票组件，无抽奖，最克制。
- **涨粉/活动**：橙纯色卡 + 奖品图 + 抽奖入口 + "快转发"按钮，视觉最热。
- **观点/情感**：留言引导用暖色气泡 + "想聊就来评论区"，人味儿重。
- **科技数据**：问卷卡用青调 + "30 秒完成"文案，专业感、不打扰。

## 六、间距与尺寸（遵守硬规范）

- 互动块与前后内容：`margin:0 0 16px`。
- 卡内 padding `14px 16px`；行高 1.7–1.8（规则类多行），行间 4–8px。
- 标题 14–15px 加粗、引导/选项 13px；三行以内选项最清爽。
- 抽奖规则逐行排，每行一句（参与/奖品/开奖），别挤成一段。
- 入口按钮胶囊 `border-radius:14–16px`，字号 13px。

## 七、密度限制

- 一篇**互动块 ≤2 处**（如中部一个投票 + 结尾一个抽奖/留言），别全文每个段都想互动。
- 投票选项 4 个左右（2–6），选项文字别超 12 字。
- 抽奖奖品种类别堆 4 个以上；问卷 ≤5 题。
- 互动块别与促销卡贴一起变"连环轰炸"，分开放。

## 八、常见错误（反例 + 正解）

1. **虚假抽奖 / 不兑奖**。
  反例："转发关注就送 iPhone，中了自己后台定"（不兑现、变相刷关注）
  正解：抽奖真实、奖品与数量明确、开奖时间与兑奖方式写清并真正兑现；避免"转发才抽"诱导过度分享。
2. **抽奖奖品含糊画饼**。
  反例："神秘大礼""超值好礼等你拿"（说不清是什么）
  正解：具体写明"3 份《xxx》实体书"，读者才知道值不值得参加。
3. **引导空泛、读者无从下手**。
  反例：结尾甩一句"有问题可以评论"没人搭话。
  正解：给话题点 + 具体引导："说说你带娃最崩溃的那一刻""选下期写哪个，投个票"。
4. **问卷/抽奖和文章主题脱节**。
  反例：一篇讲排版的文章中间突然问"你平时喝什么茶"。
  正解：互动围绕"本文主题"或"下一步该写什么"展开，有理由。
5. **抽奖入口不落地（点不动）**。
  反例：只写"抽奖在评论区"，读者没渠道参与。
  正解：入口给官方投票/抽奖小程序或工具链接，真能点、真能开奖。

## 九、示例（可替换的骨架）

**留言引导的三种钩子句式（换你的话题即可）：**
- 求共鸣："来评论区聊聊，你最近【最想戒掉的高频小动作】是什么？"
- 求选择："【A 选 A / B 选 B】，评论区扣 1 或 2，我看哪个多就写哪个。"
- 求故事："分享一个你【坚持背单词最久的】经历，最好笑/最坚持的抽 3 位送福利。"
给"具体话题 + 开放空间"，比"欢迎留言"更能触发读者开口。

**清晰抽奖规则的「四行模板」（透明才能建立信任）：**
1. 参与：怎样算参与（留言/私信/点投票）。
2. 奖品：具体是什么、共几份（别写"神秘大礼"）。
3. 开奖：何时、在哪公布（"下周二晚 20:00 评论区揭晓"）。
4. 兑奖：中奖后怎么联系、兑奖期限。
四条写满，读者才敢信；缺一条（尤其"开奖时间"）就会显得像骗粉。

```html
<!-- 投票引导块（文案部分，投票组件在编辑器中另插） -->
<section style="background:#f7f7f7;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 8px;line-height:1.5;"><span style="display:inline-block;width:6px;height:6px;background:#ff6b35;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>你更想让我下期写哪个？</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0 0 6px;">A. 开头怎么写不跑粉</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0 0 6px;">B. 标题公式合集</p>
  <p style="font-size:13px;color:#8a7a70;line-height:1.7;margin:0;">C. 排版避坑指南</p>
  <p style="font-size:13px;font-weight:bold;color:#ff6b35;margin:8px 0 0;line-height:1.7;">投票见下方，你定的选题我下期就写</p>
</section>

<!-- 留言引导块 -->
<section style="background:#f0fbff;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:14px;font-weight:bold;color:#00b8a9;margin:0 0 8px;line-height:1.5;"><span style="display:inline-block;width:6px;height:6px;background:#00b8a9;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>想听你的故事</p>
  <p style="font-size:14px;color:#4a6a63;line-height:1.75;margin:0;">来评论区聊聊：你最想戒掉的高频小动作是什么？我抽 3 位送下期彩蛋。</p>
  <p style="font-size:12px;color:#7fa49d;margin:8px 0 0;line-height:1.6;">开奖时间：下周二晚 20:00，届时在留言区公布。</p>
</section>
```
> 可替换：投票主题与选项换成你的（4 选 1 最佳）、留言话题与奖品换真实项；留言引导里的奖品要与第九节抽奖规则一致、别空画饼。

## 十、个性化空间（可调参数与判断依据）

- **选哪种互动**：读者要"随手参与"→ 投票；给自己赚"真实性福利"→ 抽奖；要"深度情报"→ 问卷；想"套近乎"→ 留言。判断依据：这篇互动目标（互动率/涨粉/选题/情感连接）。
- **互动放几处**：中段放投票、结尾放抽奖/留言。判断依据：文章长度与转换目标。
- **抽奖奖品**：跟账号调性相关的书/课/周边最自然，别硬塞不相关高价品。判断依据：读者画像。
- **规则详略**：抽奖越透明越好（参与/奖品量/开奖时间/兑奖）；纯留言不必设规则。判断依据：是否涉及奖品兑现。
- **色盘**：活动橙 / 干货灰 / 专业青 / 情感暖。判断依据：互动性质与内容调性。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
