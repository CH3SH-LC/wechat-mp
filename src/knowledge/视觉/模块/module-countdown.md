# 倒计时条（module-countdown）

> 定位：用醒目的倒计时条展示"活动/优惠/报名"剩余时间（天/小时），制造紧迫感，push 读者尽快行动。
> 调用时机：限时优惠、活动报名、课程开课、新品发售、抢购等有明确截止时间的转化场景时用。

## 一、可用写法与语法

平台硬约束：仅 HTML 内联 `style`；无 `<style>`/`<script>`/伪元素/外链字体；flex、圆角可用。**注意：微信正文无法做"实时跳动"的 JS 倒计时**（正文是静态 HTML，不会每秒刷新），所以倒计时条是**静态展示**——要么写截止日期，要么写"还剩 X 天"，由作者在发布时手动更新，或用截图/小程序内实时倒计时补足。

### 1.1 静态天/小时倒计时条

一个"倒计时"横幅：左侧 CSS 形状徽标 + 中间"还剩 X 天 X 小时"大字 + 右侧行动动词。行不通实时，至少把"最终截止时刻"写清楚（如"7 月 20 日 23:59 截止"），读者心里有谱。

横幅规格：`background:#c0392b`（低饱和纯色红）、白字、`border-radius:12px`、`padding:14px 16px`、`margin:0 0 16px`。用 flex 三区：图标、倒计时数字、行动词。左侧用告示点（4 个向内收的圆点）代替时钟 emoji。

```html
<section style="background:#c0392b;border-radius:12px;padding:14px 16px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:inline-flex;gap:3px;padding:5px;">
    <span style="width:7px;height:7px;border-radius:50%;background:#fff;"></span>
    <span style="width:7px;height:7px;border-radius:50%;background:#fff;"></span>
    <span style="width:7px;height:7px;border-radius:50%;background:#fff;"></span>
  </div>
  <div style="text-align:center;flex:1;">
    <p style="margin:0;font-size:16px;font-weight:700;color:#fff;line-height:1.4;">仅剩 3 天 12 小时</p>
    <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.8);line-height:1.4;">7 月 20 日 23:59 截止</p>
  </div>
  <div style="background:#fff;color:#c0392b;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;line-height:1;">立即抢</div>
</section>
```
- 三区：左 CSS 圆点组、中倒计时（可放截止时间）、右行动胶囊按钮（白底红字）。
- 数字放大加粗、截止时间小字半透明白，制造"时间不多"的视觉密度。

### 1.2 天数大数字 + 底部文字（简洁款）

更极简：一个大数字（天）+ "天"字 + 一段说明"距开营还剩"。适合压台、庄重的报名场景。

```html
<section style="background:#fff8f1;border:1px solid #ffd8a8;border-radius:12px;padding:16px 18px;margin:0 0 16px;text-align:center;">
  <p style="margin:0;font-size:13px;color:#d46b08;line-height:1.75;">距 第 3 期写作营 开营</p>
  <p style="margin:6px 0 0;font-size:34px;font-weight:700;color:#d46b08;line-height:1.2;">还有 <span style="font-size:46px;">3</span> 天</p>
  <p style="margin:8px 0 0;font-size:12px;color:#b45309;line-height:1.75;">倒计时结束前报名，享早鸟价</p>
</section>
```
- 大数字 40-46px、加粗、主题色；外圈说明与内圈倒计时分两层，重点突出数字。

### 1.3 列表式"逐项截止"（多活动）

多个即将截止的活动，用列表每行一个"截止日期/倒计时"小标签，适合活动多条、需要展示"哪个先截止"。

```html
<section style="background:#fff;border:1px solid #e6ecf5;border-radius:12px;margin:0 0 16px;overflow:hidden;">
  <div style="display:flex;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">早鸟报名</div>
    <div style="font-size:13px;color:#c0392b;font-weight:700;line-height:1.75;">剩 2 天</div>
  </div>
  <div style="display:flex;background:#f7f9fc;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">限时上新</div>
    <div style="font-size:13px;color:#c0392b;font-weight:700;line-height:1.75;">剩 5 小时</div>
  </div>
</section>
```

## 二、双模式表现（文字类 / 宣传类）

- **文字类**：倒计时条克制——用白/浅底 + 主题色数字（`#fff8f1` 底 + `#d46b08` 数），数字适中；声明截止时间让"紧迫感"诚实可信，不过度制造焦虑。
- **宣传类**：倒计时条用纯色红/主色（`#c0392b`）+ 白字 + 行动胶囊按钮，数字放大加粗，制造强"限时抢购"氛围；但仍守恒"真实可推算的截止时间"红线，不虚报。

## 三、样式变体（≥3 种，具体参数）

1. **红/主色纯色横幅（三区 flex）**：`background:#c0392b`（低饱和纯色）+ 白字 + 右白底行动胶囊；max冲击力，用于限时优惠。（见 1.1）
2. **浅色大数字卡**：`#fff8f1` 底 + `#ffd8a8` 描边 + 6px 大数字；庄重、报名/开营用。（见 1.2）
3. **列表式逐项截止**：白卡 + 每行末尾红色剩余时间标签；多活动用。（见 1.3）
4. **进度式倒计时**：倒计时条 + 底部一根"时间流逝"进度条（浅灰轨道 + 主色填充残余比例），让"还剩一点"可视化。用于活动过半强调。

## 四、使用时机与位置

- **位置**：倒计时条放"行动号召"最集中的地方——产品或方案介绍后、报名按钮前、文末行动处；篇首横幅也可做"全场限时"开场钩子。
- **时机**：有明确截止时间（XX 截止）才用倒计时；没有硬截止的"常规介绍"不必硬造倒计时，否则虚伪。
- **内容类型**：限时促销、活动报名、课程开课、新品发售、早鸟价；它常与「行动号召」「价格表」「资料领取」组合，推最后一脚。

## 五、风格适配（4 个风格例子）

- **科技商务**：主色蓝纯色横幅（`#2f6fed`）+ 白字，数字加粗，行动词"立即预约"；利落专业。
- **国潮红金**：红金纯色横幅（`#9a281f`）+ 金数字 `#ffd9a0`，行动词"马上报名"；庄重有仪式感。
- **校园清新**：薄荷绿浅底（`#e8faf4`）+ 深薄荷数字 `#0a6b52`，圆角大（14px），数字适中；轻松无压迫。
- **极简白**：白卡 + 仅一行"距 XX 截止还有 X 天"黑字 + 极细描边，数字用主题色；把紧迫感降到最低、靠信息本身驱动。

## 六、间距与尺寸（遵守硬规范）

- 倒计时条底部边距统一 `margin:0 0 16px`（块距硬规范）。
- 横幅内文字行距 `line-height:1.4`（紧凑为展示数字）；正文段落仍 1.75。
- 大数字 34-46px（如 `font-size:46px`）、加粗；截止时间小字 12px、半透明（`rgba(255,255,255,0.75)`）。
- 胶囊行动按钮：`padding:6px 12px`、`border-radius:999px`、白底 + 主题色字。
- 三区 flex 用 `justify-content:space-between` 拉开；行动词最多 4 字（"立即抢/马上报/立即约"）。
- 进度式倒计时的轨道高 8-10px、圆角高度一半、残余比例用主色填充。

## 七、密度限制

- **一屏 ≤1 个倒计时条**；一篇文章倒计时条 ≤2 个（<800 字短文 1 个，长文可 1 个开场 + 1 个结尾）。
- 倒计时条不是唯一行动钩子，别把全篇都做成"限时"；其余正文保持正常叙述，只在行动点强调。
- 若同时有"报名"和"优惠"两个截止，优先突出与本次行动最相关的一个，另一作小字提示。
- 倒计时数字必须有真实可推算的截止背景，拒绝无条件"仅限今天/最后一天"式滥用（见合规）。

## 八、常见错误（反例 + 正解）

- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：做成"实时跳动"的 JS 倒计时——微信正文是静态 HTML，发布后数字不动、失真。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：倒计时条用静态展示（写"还剩 X 天"或截止日期），发布时手动核对最新剩余时间；真正需实时用小程序内倒计时。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：只写"仅剩 3 小时"却不给截止时刻，读者不知还剩多少、失去可信度。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：倒计时旁标注明确截止时间（如"7 月 20 日 23:59"），紧迫感建立在可推算的真实时间上。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：全文每段都挂倒计时/限时，读者被过度焦虑逼退、觉得是套路。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：一屏 ≤1 个倒计时、全文 ≤2 个，只放在最关键的行动点。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：数字写"剩 0 天"或过期仍展示，发布后显得失实。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：发布前核对剩余时间，过期活动及时更新；无截止时间就别硬倒计时。
- <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c0392b;"></span> **反例**：行动按钮与倒计时颜色冲突（红纯色横幅配蓝行动钮），视觉乱。<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2f9e5f;"></span> **正解**：行动按钮用"横幅底色的对比色 + 白底"（红条配白底红字按钮），对比清晰。

## 九、示例（可用骨架，标注可替换处）

**骨架 A · 限时优惠横幅（宣传类）**：

```html
<section style="background:#c0392b;border-radius:12px;padding:14px 16px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:inline-flex;gap:3px;padding:5px;">
    <span style="width:7px;height:7px;border-radius:50%;background:#fff;"></span>
    <span style="width:7px;height:7px;border-radius:50%;background:#fff;"></span>
    <span style="width:7px;height:7px;border-radius:50%;background:#fff;"></span>
  </div>
  <div style="text-align:center;flex:1;">
    <p style="margin:0;font-size:16px;font-weight:700;color:#fff;line-height:1.4;">仅剩 3 天 12 小时</p>
    <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.8);line-height:1.4;">7 月 20 日 23:59 截止</p>
  </div>
  <div style="background:#fff;color:#c0392b;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;line-height:1;">立即抢</div>
</section>
```
> 可替换处：倒计时数字、截止时刻、行动词（≤4 字）、主色。

**骨架 B · 报名倒计时大数字卡（庄重）**：

```html
<section style="background:#fff8f1;border:1px solid #ffd8a8;border-radius:12px;padding:16px 18px;margin:0 0 16px;text-align:center;">
  <p style="margin:0;font-size:13px;color:#d46b08;line-height:1.75;">距 第 3 期写作营 开营</p>
  <p style="margin:6px 0 0;font-size:34px;font-weight:700;color:#d46b08;line-height:1.2;">还有 <span style="font-size:46px;">3</span> 天</p>
  <p style="margin:8px 0 0;font-size:12px;color:#b45309;line-height:1.75;">倒计时结束前报名，享早鸟价</p>
</section>
```
> 可替换处：活动名、剩余天数、说明话术、主题色。

**骨架 C · 多活动逐项截止（列表）**：

```html
<section style="background:#fff;border:1px solid #e6ecf5;border-radius:12px;margin:0 0 16px;overflow:hidden;">
  <div style="display:flex;padding:10px 14px;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">早鸟报名</div>
    <div style="font-size:13px;color:#c0392b;font-weight:700;line-height:1.75;">剩 2 天</div>
  </div>
  <div style="display:flex;background:#f7f9fc;padding:10px 14px;border-top:1px solid #eef2f8;">
    <div style="flex:1;font-size:14px;color:#2b3a5e;line-height:1.75;">限时上新</div>
    <div style="font-size:13px;color:#c0392b;font-weight:700;line-height:1.75;">剩 5 小时</div>
  </div>
</section>
```
> 可替换处：活动名、剩余时间；偶数行斑马纹 `#f7f9fc`。

## 十、个性化空间（可调参数与判断依据）

- **可调**：样式（纯色横幅 / 浅色大数字 / 列表 / 带进度条）。**判断依据**：限时抢购用纯色横幅（冲击强），报名/开营用浅色大数字（庄重），多活动用列表（信息并列），活动过半用带进度条（可视化剩余）。
- **可调**：数字大小（16px 行内 / 34-46px 大数字）、颜色（白字 / 主题色大字）。**判断依据**：数字越大越"紧迫"；宣传类可放大加粗，文字类用主题色适中。
- **可调**：是否标注具体截止时刻。**判断依据**：消费者决策类（花钱/报名）务必给明确截止时间；纯提示类（倒计时点缀）可只写天数。红线是"不能虚报倒计时"。
- **可调**：是否与该文的其他模块（行动号召/价格表）耦合。**判断依据**：有转化目标时倒计时条紧贴行动按钮/价格表；无转化、仅仪式感时独立一条即可，别过度。

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
