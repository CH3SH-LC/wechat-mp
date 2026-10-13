# 模块·小程序卡片

> 定位：一个可点击跳转的小程序入口卡，把读者"指到"商城/报名/打卡页下单，是正文里最直接的转化按钮。
> 调用时机：带货、电商、报名、打卡、会员等需要把读者从"看文章"转到"去操作"的转化收尾场景。

## 一、可用写法与语法

小程序标签在微信里是**官方卡片组件**：用 `#小程序://` 开头的小程序路径作为 `<a>` 的 `href`，微信会自动渲染成可点击的圆角卡片。这是唯一能点进小程序的方式。

> 注意：本文给的演示用标题/文案是排版骨架，**真正对接小程序要插入内容后，在小程序标签里绑定你的小程序路径与卡片文案**（微信后台/编辑器的"小程序"按钮快速插入），这里展示的是配套文案与视觉结构。卡片视觉一律纯色 + 细边框，不写渐变、不加投影。

**插入操作步骤（不必会代码也能做）**：
1. 在微信编辑器工具栏点"小程序"图标。
2. 搜索/选择你的小程序，填好路径、展示文字、选择卡片样式。
3. 卡片文字按真实用途写好再绑定，发布前真机点一遍确认能跳。
（正文里能填的只有"文字样式与话术"，跳转链路由编辑器的小程序标签负责。）

**内容与入口**

标题标识真实小程序或目的；补充说明写清点击后可以完成的操作与必要条件。按钮只标识实际动作，不套折扣、稀缺或收益话术。卡片文字与落地页一致，不能夸大收益。

**排版与功能**

并排卡使用 box-sizing:border-box，必要时改为竖排避免溢出。按钮圆角可在 14–18px 内选择，正文层级与留白保持清楚。实际输出遵循 engine-write-protocol v2；下方旧内联例子仅作视觉参数参考。

小程序必须自有或获得授权，路径有效；图像或按钮外观不能代替真正可点击的标签。明丽或极简只影响视觉强调，不改变文字承诺。内容选取与组织按需查阅 文本/写作/writing-purpose、writing-structure、对应场景知识和 writing-review；本条只处理组件呈现。



## 三、样式变体（≥3 种，带参数）

**变体 A｜横向按钮条（信息 + 右下按钮）**:
```html
<section style="background:#ffffff;border:1px solid #ffe0d0;border-radius:12px;padding:12px 14px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <section style="flex:1;">
    <p style="font-size:15px;font-weight:bold;color:#5a4a3a;margin:0 0 4px;line-height:1.5;">好物商城</p>
    <p style="font-size:12px;color:#8a8a8a;margin:0;line-height:1.7;">新品 5 折 · 7 天无理由</p>
  </section>
  <span style="font-size:13px;font-weight:bold;color:#fff;background:#ff6b35;border-radius:16px;padding:6px 14px;line-height:1.5;flex-shrink:0;">立即购买</span>
</section>
```
> 左信息右按钮，`display:flex` 顶对齐；按钮胶囊形 `border-radius:16px`。实际跳转需嵌小程序标签。

**变体 B｜深色强调卡（纯按钮式）**:
```html
<section style="background:#e56b2f;border-radius:12px;padding:14px 16px;margin:0 0 16px;text-align:center;">
  <p style="font-size:16px;font-weight:bold;color:#fff;margin:0 0 6px;line-height:1.5;">限时福利 · 0 元领资料</p>
  <p style="font-size:13px;color:#ffe8d9;margin:0 0 10px;line-height:1.7;">前 200 名立减 30 元</p>
  <span style="display:inline-block;font-size:14px;font-weight:bold;color:#e56b2f;background:#fff;border-radius:18px;padding:8px 22px;line-height:1.5;">点我去领取</span>
</section>
```
> 主色橙整卡 + 白字 + 白底胶囊按钮，视觉最抓眼，适合单次强转化。前面加一句"点击上方卡片进入"跳转提示。

**变体 C｜列表式多入口（多个小程序排一列）**:几个小程序/板块需要同时曝光时，每个作为一行小卡：
```html
<section style="background:#ffffff;border:1px solid #eee;border-radius:12px;padding:4px 14px;margin:0 0 16px;">
  <section style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f2f2f2;">
    <section style="flex:1;"><p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 2px;line-height:1.5;">报名通道</p><p style="font-size:12px;color:#999;margin:0;line-height:1.6;">第 5 期训练营</p></section>
    <span style="font-size:13px;font-weight:bold;color:#fff;background:#00b8a9;border-radius:14px;padding:4px 12px;line-height:1.5;flex-shrink:0;">去报名</span>
  </section>
  <section style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;">
    <section style="flex:1;"><p style="font-size:14px;font-weight:bold;color:#5a4a3a;margin:0 0 2px;line-height:1.5;">商城</p><p style="font-size:12px;color:#999;margin:0;line-height:1.6;">周边新品上架</p></section>
    <span style="font-size:13px;font-weight:bold;color:#fff;background:#6b4fc4;border-radius:14px;padding:4px 12px;line-height:1.5;flex-shrink:0;">去看看</span>
  </section>
</section>
```
> 每行一入口，`border-bottom` 细线分隔；各入口可给不同主题色按钮区分动作。

## 四、使用时机与位置

当读者确实需要购买、报名、查询或使用工具时，在对应说明旁提供入口。没有有效承接页时不放卡。入口位置随内容决定，不固定在开头、中段、结尾重复。价格、资格、费用与截止时间以实际材料为准。

## 五、风格适配（4 个例子）

- **简约商务**：白卡细边框 + 灰信息 + 青胶囊按钮，副文中性。
- **电商/促销**：橙整卡 + 白字 + 白胶囊，限时檄章，最热。
- **教育/课程**：可用深青或蓝紫配色；按钮与说明反映实际课程入口与条件。
- **日系/清新**：白卡圆角 14px + 淡青按钮，副文说明真实操作和必要条件，不改变语气以配合配色。

## 六、间距与尺寸（遵守硬规范）

- 卡片与前后内容：`margin:0 0 16px`。
- 卡内 padding：横条款 `12px 14px`；整卡款 `14px 16px`。
- 标题 14–16px、副文 12–13px；按钮 12–14px。
- 卡片间（多入口列表）用细线分隔，外侧给 `padding:4px 14px` 包裹。
- 跳转提示短句与卡片：标题下/卡片上方 8–10px。
- 整卡 `border-radius:12px`；按钮胶囊 `border-radius:14–18px`。
- 卡片与价格表、倒计时等相邻转化模块之间：块距 16px，用空段占位或 `margin-bottom` 显式写高，避免微信编辑器空段被拉高失真。

**卡片重复出现的间距节奏**：同一张卡多次出现时，每次前后都保持 16px 块距 + 一句简短跳转提示，别让多张卡紧贴连成一条"广告带"。中间隔以正文段，转化更自然。

## 七、密度限制

- 卡片主体单次转化块内 **1 个主卡片** + 最多 3 个横向列表入口。
- 全篇小程序卡片 **1–3 处**（开头/中/尾声各一）为上限，过多读者会腻。
- 卡片文字按实际内容检查换行，必要时扩大区域或把完整条件放在相邻正文。
- 一套促销檄章（限时/立减）别在多张卡重复堆叠。

## 八、常见错误（反例 + 正解）

1. **卡片点不了 / 路径错误**。
  反例：只放一张"看起来像按钮"的图片或纯文案，点不动。
  正解：用 `#小程序://` 路径的小程序标签；发布前真机点一遍确认能跳。
2. **文案与落地页不一致**。
  反例：卡片写"0 元领取"，跳进去是付费页，读者转身走。
  正解：卡片主行动、副文与落地页完全对齐，别玩"标题党跳转"。
3. **卡片堆砌无节制**。
  反例：一篇塞 6 张商城卡，读者看到就想滑走。
  正解：精选 1 个主入口 + 至多 3 个列表，只在关键转化点出现。
4. **没有跳转提示，读者犹豫不敢点**。
  反例：卡片孤零零放那，没人知道能点。
  正解：卡前加"点击上方卡片进商城"，按钮话术动词明确（立即购买/去报名）。
5. **诱导点击 / 夸大收益话术**。
  反例："点击必中奖""注册就返 100"
  正解：话术真实、活动如实描述，绝不承诺无法兑现的返利/中奖。

## 九、示例（可替换的骨架）

**附带：两种落地链路的卡片排版对照**
- **单商品直购**（价格已定，直接买）：卡片标题=商品名，副文=价格+配送，按钮="立即购买"。
- **多选导购**（进店再挑）：卡片标题=商城名，副文="新品/满减/分类"，按钮="进店逛逛"。
先想清你这张卡引导的是"直接买"还是"先进去看看"，按钮话术和落地页随之一致。

```html
<!-- 跳转提示 + 卡片（示例结构：真正跳转需在编辑器嵌小程序标签） -->
<p style="font-size:14px;color:#8a7a70;text-align:center;margin:0 0 10px;line-height:1.7;">点击下方卡片进入商城</p>

<section style="background:#ffffff;border:1px solid #ffe0d0;border-radius:12px;padding:12px 14px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <section style="flex:1;padding-right:10px;">
    <p style="font-size:15px;font-weight:bold;color:#5a4a3a;margin:0 0 4px;line-height:1.5;">好物商城</p>
    <p style="font-size:12px;color:#8a8a8a;margin:0;line-height:1.7;">新品上架 · 满 99 包邮</p>
  </section>
  <span style="display:inline-block;font-size:13px;font-weight:bold;color:#fff;background:#ff6b35;border-radius:16px;padding:6px 14px;line-height:1.5;flex-shrink:0;">立即购买</span>
</section>
<p style="font-size:12px;color:#aaa;text-align:center;margin:0;line-height:1.6;">* 点不进请在微信内打开本文</p>
```
> 可替换：橙边框/橙按钮换成你的主色；标题"好物商城"、副文"满 99 包邮"、按钮"立即购买"按场景换（报名→"去报名+本期仅 30 人"、打卡→"开始打卡"）。真实发布时把整段套进小程序标签组件。

## 十、个性化空间（可调参数与判断依据）

- **单卡 vs 深色整卡 vs 多入口列表**：单一主打商城 → 单卡；促销力度大 → 深色整卡；多个板块同时要曝光 → 多入口列表。判断依据：本篇转化主目标有几个。
- **卡片出现次数**：客单高、决策重 → 3 次（开/中/尾）；客单低、轻决策 → 1–2 次。判断依据：决策重量与阅读打断容忍度。
- **按钮话术**：按动作选（购买/报名/打卡/领会员），越具体越好。判断依据：你希望读者做的下一步动作。
- **补充说明**：根据实际入口说明操作和必要条件；不自动添加折扣、名额、包邮或收益话术。
- **卡片位置（开头还是结尾）**：想让读者"边看边惦记"→ 开头抛一次；想"读完再买"→ 结尾收口。判断依据：内容长度与读者耐心。
- **按钮是否带日期/名额**：促销限时 → 按钮或副文带"限今日/名额过半"；长期款 → 不带稀缺。判断依据：活动有没有真实时效。
- **风格色盘**：商务青/促销橙/教育深蓝/日系淡青。判断依据：内容类型与账号调性。

**发布前终检**：真机点一遍每张卡能否跳转、文案与落地页是否一致、按钮话术动词是否明确。卡能点、跳得对，转化才不白费。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
