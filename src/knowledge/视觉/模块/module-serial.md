# 模块·往期回顾 / 下期预告

> 定位：用一条"近几期回顾列表"或"下期预告单条"把连载、系列教程、栏目首尾衔接起来，让读者追下去、把系列流量串成线。
> 调用时机：连载、系列教程、固定栏目；当文章是某个系列的一期、想让读者补齐前面并期待后面时。

## 一、可用写法与语法

系列衔接条有**两种形式**，可单独用也可连用：

**1. 往期回顾列表**（补前面）：列出本系列的近几期，每期"一句话标题 + 可点击跳转"。用于引老读者回顾、且方便新读者从零开始追。
- 写法：每行 = 序号/小标签 + 一句话概括 + 跳转（放对应文章链接）。一句话概括别只是复读标题，要给"这篇讲了什么"。

**2. 下期预告单条**（吊后面）：一句话吊读者胃口，给"下期内容 + 暗示收益"。
- 写法："下期教你把开头从留白到爆款"——比"下期更精彩"具体得多。再配一句"点个关注/星标，不错过"。

**常见衔接句式**：
- 回顾："上一篇我们讲到 X，没看的先把这篇补上。"
- 预告："下一篇拆解 Y，记得蹲住，别错过。"

**适用场景**：连载故事、系列教程（1/2/3 部分）、固定栏目（每周一更的专栏）、长专题拆成多篇。

**语法骨架**（回顾列表）:
```html
<section style="background:#f7f7f7;border:1px solid #eee;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 8px;line-height:1.5;">往期回顾</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff6b35;"></span> 上一篇：排版避坑的 7 个雷台</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff6b35;"></span> 上上篇：开头 30 秒留住人</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff6b35;"></span> 基础篇：公众号如何选题</p>
</section>
```
（实际每行会包成可点的链接，见第九节带链接骨架。）

## 二、双模式表现（文字类 / 宣传类）

- **文字类**（内容号、连载）：回顾列表克制灰卡 + 一句预告，重在"把系列串牢"，不催订阅。
- **宣传类**（专栏/知识付费连载）：回顾列表 + 醒目预告卡（纯色）+ "点关注别错过"按钮，拉回访与订阅，转化感强。

## 三、样式变体（≥3 种，带参数）

**变体 A｜往期回顾列表卡**（见上文骨架，每期一行链接）。行与行间距 4px，`实心圆点 span` 前缀；行首可给"上一篇/上上篇/基础篇"位置标签。

**变体 B｜下期预告单条卡（吊胃口 + 引导关注）**:
```html
<section style="background:#6b4fc4;border-radius:12px;padding:16px;margin:0 0 16px;text-align:center;">
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0 0 6px;line-height:1.5;">下期预告</p>
  <p style="font-size:14px;color:#e3dcf7;margin:0 0 10px;line-height:1.75;">拆解「标题公式」，3 分钟拟出爆款标题</p>
  <span style="display:inline-block;font-size:13px;font-weight:bold;color:#6b4fc4;background:#fff;border-radius:18px;padding:6px 18px;line-height:1.5;">点个关注别错过</span>
</section>
```
> 紫色纯色整卡 + 白字 + 白胶囊，视觉上是"系列终点 + 下期钩子"，引导关注。

**变体 C｜首尾连贯卡（回顾 + 预告同卡）**:
```html
<section style="background:#ffffff;border:1px solid #eee;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:13px;font-weight:bold;color:#8a8a8a;margin:0 0 6px;line-height:1.5;">上一篇</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 10px;">「内容规划」怎么列一年的选题库</p>
  <p style="height:1px;margin:0 0 10px;background:#f2f2f2;font-size:1px;">&nbsp;</p>
  <p style="font-size:13px;font-weight:bold;color:#ff6b35;margin:0 0 6px;line-height:1.5;">下一篇</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0;">「发布」发布前最后一次自检清单</p>
</section>
```
> 上半灰色"上一篇"、下半主色"下一篇"，中间一条细线分隔，形成"首尾衔接"的连贯感，漫画连载、系列专栏用它最顺。

**变体 D｜系列合集收尾条（下拉全部）**——连载到一定期数后，结尾放一条"系列全部入口":
```html
<section style="background:#fff7f2;border:1px solid #ffe0d0;border-radius:12px;padding:12px 16px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:13px;color:#5a4a3a;line-height:1.7;">想看整条系列？</span>
  <span style="font-size:12px;font-weight:bold;color:#fff;background:#ff6b35;border-radius:14px;padding:4px 12px;line-height:1.5;">去合集</span>
</section>
```
> 左文字右按钮，把"这只是一期"升级为"这儿有一整套"，引导读者从头追，提升整个系列的回访与吸附。

## 四、使用时机与位置

- **回顾列表**：文章开头（引新读者补课）和中段（提到上文时跳转）。太长就放开头，供没看过的人追。
- **下期预告**：**文章结尾**必用，是"追更钩子"+ 关注引导；连载感强。
- **固定栏目**：每期同一位置（如结尾）放统一版式预告，读者养成追更习惯。
- **不建议**：中段频繁插入预告打断；回顾列表太长老占篇幅。

**系列感的建立（不只是预告，是让读者认出"这是一个系列"）**：
1. 标题带"第 N 期 / (N/N)"，或用统一栏目名前缀。
2. 每期固定的开头"这是第 N 篇，前几篇见回顾"。
3. 收尾统一预告下期，配固定的版式与色系。
4. 底部放合集导航（"全部见菜单合集"），把系列串成一个整体，方便新读者从 0 追。
系列感立住，"预告钩子"才起作用——否则读者不知道这是一根连续的线。

## 五、风格适配（4 个例子）

- **内容/干货连载**：灰卡回顾 + 一句预告，最克制。
- **知识付费专栏**：回顾列表 + 紫色纯色预告卡 + 关注按钮。
- **情感/故事连载**：预告卡用暖色（橙/红）+"下集更精彩"悬念话术，吊胃口。
- **极简/商务**：只用细线分隔的上一/下一篇行（变体 C），无装饰色，最干净。

## 六、间距与尺寸（遵守硬规范）

- 衔接块与前后内容：`margin:0 0 16px`。
- 卡内 padding `14px 16px`；行距 1.75、行间 4–6px。
- 预告卡 `padding:16px`；标题 14–16px、正文 13–14px、按钮 13px。
- 变体 C 的分隔细线用 `height:1px;background:#f2f2f2` 占位。
- 回顾列表行 ≤5 条，超了就只列"最近 3 期 + 去合集看全部"。

## 七、密度限制

- 回顾列表 **≤5 行**，一期一行一句话；多用合集导航替代长列表。
- 全篇预告 **1 处**（结尾）；不要在开头也剧透下期。
- 一篇一个衔接块定位（开篇回顾、结尾预告）即可，别每节都放。
- 一句话概括 ≤ 一行，别把每期整段挂在列表里。
- 变体别混用：一篇连载统一用"回顾列表 + 预告单条（或首尾连贯卡）"一种组合，别既上列表又上合集条又上预告卡堆三样。

**连载的节奏控制**：
- 开篇回顾只给"最近 1–3 期"，别把 8 期全铺开，否则新读者看到一堆要补就弃坑。
- 结尾预告永远给"下一篇"，别一次预告两期，分散追更注意力。
- 一篇固定"开篇补课 + 结尾勾人"的两点式，中间不再插入衔接。

## 八、常见错误（反例 + 正解）

1. **总结复读标题、不说内容**。
  反例："往期回顾：第 3 篇、第 4 篇、第 5 篇"（读者不知道每篇讲啥）
  正解：每期一句话说明讲了什么："第 4 篇：开头 30 秒怎么留住人"。
2. **跳转链接失效 / 漏链**。
  反例：回顾列表写了一大串，点不动或链到旧文章。
  正解：发布前逐个点一遍链接，错误链接改或删，宁缺毋滥。
3. **预告太空泛、没钩子**。
  反例："下期更精彩，敬请期待"
  正解：具体到下期讲什么、读者能拿到什么："下期把开头怎么写拍成 3 步给你抄"。
4. **回顾列表过长堆一堆**。
  反例：把 20 期全列出来，读者刷半天进不了正文。
  正解：只列最近 3 期 + "更多见合集/菜单"，保正文不被打断。
5. **连载却无系列标签，读者认不出是系列**。
  反例：文章标题不标"第几期"、也无栏目标识。
  正解：标题/开头带"第 N 期 / 栏目名"，结尾统一预告，让系列感成立。

## 九、示例（可替换的骨架）

**回顾 / 预告的一句话模板（照填就行）：**
- 回顾（带位置）："上一篇【《内容规划》】讲了【怎么写一年的选题库】，没看的先补这篇。"
- 回顾（列表行）："【上一篇】：《内容规划》，怎么列一年的选题库"
- 预告（吊胃口）："下期【《标题公式》】让你 3 分钟拟出一个能点进来的标题"
- 预告（收订阅）："续篇见下期，点个关注别错过 [栏目名] 专栏每一篇"
把"标题 + 一句话内容概括"写出来，比只列名字有用得多。

```html
<!-- 往期回顾列表（每行可套链接） -->
<section style="background:#f7f7f7;border:1px solid #eee;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 8px;line-height:1.5;">这个系列你没看的部分</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff6b35;"></span> <span style="color:#ff6b35;font-weight:bold;">上一篇</span>：内容规划，怎么列一年的选题库</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff6b35;"></span> 第 2 篇：开头 30 秒怎么留住人</p>
  <p style="font-size:13px;color:#5a4a3a;line-height:1.75;margin:0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff6b35;"></span> 第 1 篇：公众号到底该写什么</p>
  <p style="font-size:12px;color:#999;margin:8px 0 0;line-height:1.6;">从第 1 篇开始补，效果最好。全部见底部合集。</p>
</section>

<!-- 下期预告 -->
<section style="background:#6b4fc4;border-radius:12px;padding:16px;margin:0 0 16px;text-align:center;">
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0 0 6px;line-height:1.5;">下期预告</p>
  <p style="font-size:14px;color:#e3dcf7;margin:0 0 10px;line-height:1.75;">「标题」3 分钟拟出爆款标题的公式</p>
  <span style="display:inline-block;font-size:13px;font-weight:bold;color:#6b4fc4;background:#fff;border-radius:18px;padding:6px 18px;line-height:1.5;">点个关注别错过</span>
</section>
```
> 可替换：紫纯色换成你的主色；"选题库/开头/写什么"换成你系列真实各篇一句话；关注按钮话术可按需换（星标/在看）。

## 十、个性化空间（可调参数与判断依据）

- **列表 vs 预告单条 vs 首尾连贯**：主补前面 → 回顾列表；主吊后面 → 预告单条；既回顾又预告的连载 → 首尾连贯卡。判断依据：这篇的衔接重点在前还是在后。
- **回顾列几条**：新读者可能从 0 看 → 列到第 1 篇；老读者多 → 只列近 2–3 期 + 合集。判断依据：你的读者到期第几篇的概率分布。
- **预告话术详略**：强追更需求 → 具体讲清下期内容与收益；弱 → 一句悬念。判断依据：连载粘性强度。
- **是否加"点关注/星标"引导**：连载在私域沉淀价值高 → 加；纯内容分享 → 可省。判断依据：运营目标是追更还是订阅。
- **色盘**：干货灰 / 专栏紫 / 情感暖橙 / 极简细线。判断依据：内容类型与账号调性。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
