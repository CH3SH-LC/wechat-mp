# 微信公众号六种视觉风格研究与配色决策

> 目标平台：微信公众号正文，仅限 HTML 内联 style（无 `<style>`/`<script>`/伪元素/外链字体）。
> 可用：渐变、圆角、阴影、flex、重复渐变图案；图片须为微信 uploadimg URL。
> 说明：色板基于成熟设计经验整理，可直接套用；如需贴合品牌色，可按自己的品牌色微调主色。

---

## 1. 极简留白风

**气质特征**：高冷、克制、疏朗、大量留白，强调字本身的力量。少装饰，少配色。
**适用内容类型**：品牌宣言、观点评论、深度科技、产品发布、高端访谈。
**色板**：
- 主色 #111111（近黑正文级）、#1A1A1A
- 辅色 #8A8A8A（次级灰）、#4B4B4B（小标题灰）
- 文字色 #111111 / #2B2B2B
- 浅底色 #FFFFFF / #F7F7F7（极浅灰分区）
**标题样式**：超大号纯黑大标题 + 左侧一条 2px 竖线；副标题细灰；无渐变无阴影。
**气泡与边框**：无气泡；卡片仅 1px #E5E5E5 细描边或极浅 #F7F7F7 底色 + 圆角 8px，无阴影。
**使用时机**：只在品牌需要"说一句话就足够"的高信任时刻用，内容密度必须低。

```html
<p style="font-size:22px;font-weight:bold;color:#111111;line-height:1.5;border-left:2px solid #111111;padding-left:12px;margin:0 0 16px;">
  克制，是一种更深的表达
</p>
<p style="font-size:15px;color:#2B2B2B;line-height:1.8;letter-spacing:0.03em;">
  真正好的品牌，不需要喧哗。把颜色交还给文字，把注意力交还给读者。
</p>
<div style="background:#F7F7F7;border-radius:8px;padding:20px 18px;border:1px solid #E5E5E5;margin-top:18px;">
  <p style="font-size:15px;color:#4B4B4B;line-height:1.7;">
    留白不是空，是给思想腾出落地的位置。
  </p>
</div>
```

---

## 2. 日系杂志风

**气质特征**：纸感、温暖、米白底、柔和撞色，像翻一本质感杂志。字号偏大，行距舒展。
**适用内容类型**：生活方式、美食探店、旅行手记、咖啡/文具/器皿类内容。
**色板**：
- 主色 #C29B6B（陶土米棕）、#8FA37A（鼠尾草绿）
- 辅色 #D9A97A（奶茶橘）
- 文字色 #3D3A34（暖墨）
- 浅底色 #FBF7F0（米白纸感）/ #F4EDE2（浅杏分区）
**标题样式**：衬线感大标题 + #C29B6B 下划线双线；副标题用浅绿色。
**气泡与边框**：卡片底色 #FBF7F0 + 圆角 12px + 顶部细描边；气泡多为米白底 + 轻阴影。
**使用时机**：做"有温度、慢下来"的内容，让读者像翻杂志一样有翻阅感。

```html
<p style="font-size:20px;font-weight:bold;color:#3D3A34;line-height:1.5;border-bottom:3px double #C29B6B;padding-bottom:10px;margin:0 0 18px;">
  在旧街角，喝一杯慢咖啡
</p>
<p style="font-size:15px;color:#3D3A34;line-height:1.9;">
  推开木门的瞬间，光落进刚刚磨好的豆香里。时间在这里，慢得刚刚好。
</p>
<div style="background:#FBF7F0;border-radius:12px;padding:18px 16px;margin-top:16px;box-shadow:0 2px 10px rgba(194,155,107,0.12);">
  <p style="font-size:15px;color:#6B5B45;line-height:1.8;">
    老板娘说，这杯手冲的配方，她试了三年。
  </p>
</div>
```

---

## 3. 国潮新中式

**气质特征**：红金墨三色主导，传统纹样（云纹/回纹/卷草）点缀，庄重又有节庆感。常配渐变金边。
**适用内容类型**：节日营销、传统文化、国货品牌、非遗、节气文案。
**色板**：
- 主色 #C03A2B（朱红）、#B8860B/#D4AF37（鎏金）
- 辅色 #2B2118（墨黑）
- 文字色 #2B2118 / #7A1F16（深红强调）
- 浅底色 #FFF9EF（宣纸米）/ #FBF1E0（绢黄）
**标题样式**：墨黑大标题 + 金色渐变下边框；副标题朱红行楷感；常用金色分隔线 + 装饰点。
**气泡与边框**：边框用渐变描边（红→金）、卡片带金角的框；气泡内衬宣纸底色。
**使用时机**：一切需要"东方仪式感""年的味道""文化传承"的时刻，红金一出便是节庆。

```html
<p style="font-size:21px;font-weight:bold;color:#2B2118;line-height:1.5;padding-bottom:12px;border-bottom:2px solid;border-image:linear-gradient(90deg,#C03A2B,#D4AF37) 1;margin:0 0 16px;">
  一炉香，一纸山河
</p>
<p style="font-size:15px;color:#7A1F16;line-height:1.9;">
  千年窑火未曾熄，把团圆的意头，烧进每一件器物的骨里。
</p>
<div style="background:#FFF9EF;border-radius:6px;padding:18px 16px;margin-top:16px;border:1px solid #D4AF37;box-shadow:0 0 0 3px rgba(212,175,55,0.18);">
  <p style="font-size:15px;color:#2B2118;line-height:1.8;">
    新春限定的红，是写给旧时光的情书。
  </p>
</div>
```

---

## 4. 文艺手账风

**气质特征**：柔和彩铅色系、贴纸感、圆点/格纹底、手写签名，亲切治愈。低饱和、粉彩质感。
**适用内容类型**：情感散文、随笔日记、亲子日常、读书笔记、治愈治愈类图文。
**色板**：
- 主色 #F0A3B0（樱粉）、#9FB8AD（雾青）
- 辅色 #F7E08A（奶黄高亮）
- 文字色 #5A5A5F（柔碳灰）/ 标题 #9A6A6F（豆沙玫瑰）
- 浅底色 #FFFFFF (配 #FBF3F5 粉白分区)
**标题样式**：手写感（无外链字体则用圆润字重+粉字）大标题 + 奶黄圆点标注；副标题雾青色。
**气泡与边框**：气泡带虚线圆角框 + 左上角"贴纸"小圆点；卡片圆角 14px + 淡粉描边。
**使用时机**：记录情绪、碎碎念、亲子陪伴、治愈瞬间，让读者觉得"像我的日记本"。

```html
<p style="font-size:20px;font-weight:bold;color:#9A6A6F;line-height:1.5;margin:0 0 16px;">
  ★ 今天也想好好生活
</p>
<p style="font-size:15px;color:#5A5A5F;line-height:1.9;">
  把日子过成手账，每一页都有认真落下的注脚。
</p>
<div style="background:#FBF3F5;border-radius:14px;border:2px dashed #F0A3B0;padding:16px;margin-top:16px;">
  <p style="font-size:15px;color:#7A7A80;line-height:1.8;">
    晚上八点，阳台的花和心情一起，开了。
  </p>
</div>
```

---

## 5. 商务科技风

**气质特征**：深蓝紫科技底、数据感、冷静专业。大量使用渐变蓝、图表卡片、灰阶层次。
**适用内容类型**：职场干货、科技产品、金融投研、数据报告、行业白皮书。
**色板**：
- 主色 #1B3A6B（深海军蓝）、#4F6DF5（电光蓝）
- 辅色 #8B5CF6（紫）、#3E4C6B（夜空）
- 文字色 #1E2A3A（墨蓝黑）/ 强调 #2D5CF0
- 浅底色 #F5F8FF（浅蓝底）/ #EEF2FF
**标题样式**：深蓝大标题 + 细横线分隔，数字/强调字做渐变；小标题带序号徽章。
**气泡与边框**：深蓝→紫渐变边框 + 圆角 10px + 轻阴影；卡片内可用数据表格底色分区。
**使用时机**：输出专业信息、建信任、讲逻辑时，深蓝紫传达"可靠+前沿"。

```html
<p style="font-size:21px;font-weight:bold;color:#1B3A6B;line-height:1.5;padding-bottom:10px;border-bottom:2px solid #4F6DF5;margin:0 0 16px;">
  数据驱动，正在重塑每一个行业
</p>
<p style="font-size:15px;color:#1E2A3A;line-height:1.9;">
  过去一年，超过 78% 的头部企业在用数据做决策，而非直觉。
</p>
<div style="background:linear-gradient(90deg,#F5F8FF,#EEF2FF);border-radius:10px;padding:18px 16px;margin-top:16px;border:1px solid #D5DDFF;box-shadow:0 2px 8px rgba(75,109,245,0.12);">
  <p style="font-size:15px;color:#2D5CF0;font-weight:bold;line-height:1.8;">
    ⬤ 核心洞察：透明，是增长的前提。
  </p>
</div>
```

---

## 6. 活泼插画风

**气质特征**：高饱和撞色、圆润可爱、元气满格。大圆角、粗描边、斜切色块、漫画感贴图。
**适用内容类型**：快消产品、母婴用品、娱乐圈粉、趣味盘点、节日福利、互动抽奖。
**色板**：
- 主色 #FF5A5F（活力橙红）、#2EC4B6（青柠绿）
- 辅色 #FFD447（明黄）、#7C3AED（糖果紫）
- 文字色 #352B3D（深紫褐）/ 强调白字
- 浅底色 #FFF7E0（奶油黄底）
**标题样式**：粗描边白字 + 撞色底块 + 圆角，像贴纸；标题可加大号圆润字重。
**气泡与边框**：气泡用彩色圆角底块 + 阴影 + 大头圆点；卡片圆角 16px 以上 + 白色粗边。
**使用时机**：想让人一眼开心、想参与、想立刻行动（抽奖/抢购/娱乐）时用，越热闹越好。

```html
<p style="font-size:20px;font-weight:bold;color:#FFFFFF;background:#FF5A5F;border-radius:12px;padding:10px 16px;display:inline-block;margin:0 0 16px;">
  🎉 夏日福利，抽奖啦！
</p>
<p style="font-size:15px;color:#352B3D;line-height:1.9;">
  转发这条到朋友圈，评论区 @ 闺蜜，口红＆零食大礼包送送送！
</p>
<div style="background:#FFF7E0;border-radius:16px;border:3px solid #FFD447;padding:16px;margin-top:16px;box-shadow:0 4px 12px rgba(255,90,95,0.25);">
  <p style="font-size:15px;color:#352B3D;font-weight:bold;line-height:1.8;">
    🍊 心动不如行动，手快有手慢无！
  </p>
</div>
```

---

## 决策表：内容类型 → 推荐风格 → 推荐设计类模式

| 内容类型 | 推荐风格 | 设计模式 text/promo |
| --- | --- | --- |
| 品牌宣言 / 观点 / 深度科技 | 极简留白风 | text |
| 生活方式 / 美食 / 旅行 / 文具器皿 | 日系杂志风 | text |
| 节日营销 / 传统文化 / 国货 / 节气 | 国潮新中式 | promo |
| 情感散文 / 随笔 / 亲子 / 治愈 | 文艺手账风 | text |
| 职场干货 / 科技 / 金融 / 数据报告 | 商务科技风 | text |
| 快消 / 母婴 / 娱乐 / 抽奖互动 | 活泼插画风 | promo |
| 新品发布 / 产品升级（高端品牌） | 极简留白风 | promo |
| 品牌周年 / 跨界联名（国货） | 国潮新中式 | promo |
| 活动预热 / 裂变涨粉（热闹向） | 活泼插画风 | promo |

**速记口诀**：冷静讲逻辑用「极简/商务」，讲温度用「日系/手账」，要仪式感用「国潮」，要热闹冲动用「活泼」。

---

## 实操小贴士
1. **同文一主色**：一篇文章锁定 1 个主色 + 1 个辅色，撞色只在活泼插画风里放开。
2. **文字色优先可读**：正文 #2B2B2B~#3D3A34 级别，勿用纯高饱和正文字。
3. **浅底色决定气质**：米白=日系/国潮纸感，浅蓝=商务科技，粉白/奶黄=手账/活泼。
4. **边框=风格速写**：细描边（极简）、双下划线（日系）、金渐变（国潮）、虚线圆角（手账）、粗色块（活泼）。
