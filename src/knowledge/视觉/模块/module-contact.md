# 模块·联系方式 / 地址营业卡（电话 · 地址 · 营业时间 · 客服入口）

> 定位：把线下/线上联系信息（电话、地址、营业时间、客服、到访指引）放进整齐卡片，让读者一眼看到怎么找你、什么时候能找到你。
> 调用时机：门店、商家、服务号、需要线下转化或售后服务的内容。凡文章结尾或正文出现"联系我们/来找我/下单后联系"的地方，都应该有这张卡兜底。
> 交叉：外观细节与间距见《模块索引》与 00-GUIDE；双模式见《双模式切换》；模板取用见《模板包》。

## 一、一句话定位

一张集中的"联系卡"收纳所有找得到的入口（电话/地址/时间/客服/地图），告诉读者三件事：
1. **怎么联系**（电话 / 微信 / 客服入口）；
2. **什么时间能联系**（营业 / 咨询时间 / 节假日）；
3. **约到什么程度**（到店 / 上门 / 在线咨询）。

信息完整、入口清楚，是这张卡的唯一目标——它不承担卖点，只承担"找到我"。

## 二、适用场景与位置

| 场景 | 内容类型 | 放哪 | 卡片要点 |
|---|---|---|---|
| 线下门店/实体店 | 门店介绍、新品到店 | 文末 + 正文"到店"处 | 地址+营业时间+门店照片 |
| 商家/服务号 | 服务介绍、售后 | 文末 | 客服入口+电话+留言 |
| 个人/工作室接单 | 服务介绍、作品集 | 末尾 | 电话+微信号+咨询时间 |
| 电商详情页内容 | 产品文 | 文末 | 售前客服入口+发货说明 |
| 活动线下场 | 活动预告 | 活动详情处 | 时间+地点+到达指引 |

**判断依据**：
- 文章**有没有可能让读者想联系你**？只要有可能，就放一张联系卡。
- B2C 服务号/门店几乎每篇都要；纯资讯/科普号可选。

## 三、卡片内容清单（必含项与可选项）

**必含项**（取决于场景，至少 2-3 项）：
- 电话（可拨打）；
- 地址（含城市+详细门牌，可看地图）；
- 营业/咨询时间（含周末、节假日说明）；
- 客服入口（微信号/小程序/公众号回复关键词）。

**可选项**：
- 门店照片/定位地图截图；
- 到店交通提示（地铁站/公交站/停车场）；
- 联系人的称呼或职位（"店长-阿楠"）；
- 备注（"加微请备注来源：公众号"）。

## 四、样式与双模式表现

- **文字类（低调传统）**：细边框白卡，电话/地址/时间各行排列，用 CSS 形状标记（实心圆/旋转方块 span）做前缀，克制不抢正文。
- **宣传类（醒目转化）**：主色描边或实色顶部条卡片，电话按钮用主色填充醒目显示，客服入口加大强调，常与 CTA/优惠券并列出现。
- 位置：线上服务号放文末；线下门店正文"到店"处加一张小型卡、文末再放完整卡。

## 五、样式变体（5 种，带骨架）

### 变体 A｜极简联系条（服务号文末，最通用）

```html
<section style="background:#f7f7f7;border:1px solid #ececec;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#4a4150;margin:0 0 8px;line-height:1.5;">联系我</p>
  <p style="font-size:14px;color:#5a5a5a;line-height:1.75;margin:0;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8a94a6;vertical-align:1px;margin-right:6px;"></span>电话 138-0000-8888（工作日 9:00-18:00）</p>
  <p style="font-size:14px;color:#5a5a5a;line-height:1.75;margin:0;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8a94a6;vertical-align:1px;margin-right:6px;"></span>微信：公众号回复「客服」直达</p>
</section>
```

### 变体 B｜门店营业卡（实体店，含时间与地址）

```html
<section style="border:1px solid #f7d9c6;border-radius:12px;padding:16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#e56b2f;margin:0 0 10px;line-height:1.5;">XX 烘焙坊 · 欢迎到店</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#e56b2f;vertical-align:1px;margin-right:6px;"></span>幸福路 88 号（地铁 2 号线幸福站 A 口步行 200 米）</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#e56b2f;vertical-align:1px;margin-right:6px;"></span>周一至周日 9:00-21:00（节假日照常）</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;"><span style="display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:#e56b2f;vertical-align:1px;margin-right:6px;"></span>店后 50 米有免费停车场</p>
</section>
```

### 变体 C｜客服双入口卡（服务号/售后，转化感强）

```html
<section style="background:#e56b2f;border:1px solid #c95528;border-radius:12px;padding:16px;margin:0 0 16px;display:flex;justify-content:space-between;">
  <section style="width:47%;text-align:center;">
    <p style="font-size:14px;font-weight:bold;color:#fff;margin:0 0 6px;line-height:1.5;">电话咨询</p>
    <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0;line-height:1.7;">400-888-6666</p>
  </section>
  <section style="width:47%;text-align:center;">
    <p style="font-size:14px;font-weight:bold;color:#fff;margin:0 0 6px;line-height:1.5;">在线客服</p>
    <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0;line-height:1.7;">公众号直接留言</p>
  </section>
</section>
```

### 变体 D｜活动到访指引（线下活动场，含时间地点路线）

```html
<section style="background:#fff7f2;border-left:4px solid #e56b2f;border-radius:0 12px 12px 0;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#5a4a3a;margin:0 0 8px;line-height:1.5;"><span style="display:inline-block;width:10px;height:10px;transform:rotate(45deg);background:#e56b2f;vertical-align:1px;margin-right:6px;"></span>活动安排</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0 0 4px;">时间：8 月 20 日 14:00-17:00</p>
  <p style="font-size:14px;color:#5a4a3a;line-height:1.75;margin:0;">地点：市图书馆三楼报告厅（已报名读者优先入座）</p>
</section>
```

### 变体 E｜多分店列表卡（连锁/多店，信息多时用）

```html
<section style="border:1px solid #e6e6e6;border-radius:12px;padding:14px 16px;margin:0 0 16px;">
  <p style="font-size:15px;font-weight:bold;color:#4a4150;margin:0 0 8px;line-height:1.5;">门店地址</p>
  <p style="font-size:13px;color:#666;line-height:1.7;margin:0 0 4px;">· 城东店：幸福路 88 号（9:00-21:00）</p>
  <p style="font-size:13px;color:#666;line-height:1.7;margin:0 0 4px;">· 城西店：滨河大道 20 号（10:00-22:00）</p>
  <p style="font-size:13px;color:#666;line-height:1.7;margin:0;">· 高新区店：科创园 C 座 1 层（周一闭店）</p>
</section>
```

## 六、使用时机与位置细节

- **首选**：文末、CTA 之后、页脚之前——读者看完正文决定联系时，正好看到。
- **次选**：正文涉及"到店/售后/报名"处，加小型指引卡，紧跟相关段落。
- 一篇**只放一张完整联系卡**（线上），线下门店可加一张小指引 + 文末完整卡，共两处为上限。
- 电话/地址等**关键信息全文保持一致**，改了店址/换号要同步更新旧文，别给读者错地址。

## 七、风格适配（4 个例子）

- **商务/服务号专业风**：灰白卡 `background:#f7f7f7` + 无边框，电话信息清晰，几乎无色，稳重可信。
- **门店/生活亲切风**：暖橙边 `#f7d9c6` + 主色标题，配地址/时间，像一张实体名片。
- **活动/促销风**：主色实色整卡（变体 C 改纯色底），双入口并排，转化感强。
- **极简/文艺风**：白卡细灰边，只用 CSS 小圆点标记前缀，不放按钮，安静收尾。

## 八、间距尺寸（遵守硬规范）

- 块间距：卡片与其前后段 `margin:0 0 16px`。
- 卡内：`padding:14px 16px 12px`（内容上与左右 ≥12px）。
- 行高：卡内信息行统一 **1.75**；小字备注 1.6。
- 卡片内各行间距 4–6px（同信息收紧）；标题与信息行之间 8–10px。
- 页边距不自设（正文自带左右 16px）。

## 九、密度限制

- 联系卡：一篇文章**两张以内**（门店号可小指引+文末完整卡），线上服务号一张即可。
- 卡内必含项 `≤5 行` 为宜，行数过多读者扫不清；长信息（多个分店）拆成多张卡或用列表（变体 E），别塞一张。
- 电话/地址/时间用 **CSS 形状标记一行一项**，别把多条塞进一段长句。

## 十、微信兼容注意

- 卡内电话号码微信会自动识别可拨打（有些客户端会高亮），正常展示即可，不必额外做按钮。
- 地图/门店图若用外部链接易失效，建议用微信素材上传的图片或截图。
- flex 双入口卡（变体 C）在老旧客户端可能变行内错位，需时用 table-cell 双列替代（见《空间布局》模板）。

## 十一、常见错误（返工项）

1. **信息不完整 / 有歧义**：只有电话没时间，或写"周一至五"没写节假日——读者无从判断何时能联系。
  「正」电话+时间+地址/入口三件套齐全，节假日说清楚。
2. **卡片离正文太远 / 位置错**：把联系卡放很后面或在纯资讯里硬塞——该放文末的放文末，该省略的别硬加。
3. **旧信息没同步**：门店搬家/换号，旧文仍是老地址——发布前核对，历史文章定期巡检。
4. **电话/地址塞成长段**：一大段话把信息糊在一起——用 CSS 形状标记一项一行，清爽可扫。
5. **服务号漏了售后入口**：读者想退换货找不到客服——文末至少给一个"公众号回复关键词"兜底。

## 十二、个性化空间（可调参数与判断依据）

- **卡片张数与详略**按场景：纯线上服务号一张精简卡；门店号正文小指引 + 文末完整卡。判断依据＝读者"找你的方式"多不多。
- **入口优先级**按账号：电话能接就打头，不能就微信/客服打头。判断依据＝哪个入口你实际上最常回、最方便读者。
- **称呼与备注细节**：小店/工作室放"店长-阿楠"更亲切、可加"加微请报公众号"沉淀私域；品牌/企业放统一热线更正式、纯售前不必要。
- **强调色 vs 低调色**：促销/活动文案用主色醒目卡；日常门店/服务用低调卡。判断依据＝转化目的强不强。

## 十三、多入口排序原则（读者看到时哪个在前）

同一张卡里若有电话、微信、客服、地址等多个入口，排列顺序有讲究：

1. **决策最直接的在最前**：想打电话就电话打头，其下再地址/时间。
2. **线上优先于线下**（服务号）：客服/微信入口打头，线下地址靠后。
3. **按读者"最可能先做什么"排**：逛街前想知道营业时间→时间排在地址前；想直接谈→电话或微信在前。
4. **主投递只有一个**：别给 3 个电话 4 个微信让读者选择困难，给一个主入口 + 一个备选即可。

判断依据：读者"找我"最常见的那一步，排在这个卡最上面。

## 十四、联系卡与内容节奏的配合

- **门店文"到店"段**：正文先讲"为什么值得来"，落地一张小指引卡（时间+地点），别一上来就甩地址。
- **服务号售后场景**：正文讲完产品/服务，文末连"购买后续服务"，再放联系卡承接售后诉求。
- **活动文**：正文讲清楚活动价值后，在"如何参与"处放到访指引卡，别把时间地点淹没在促销语言里。
- **收尾**：联系卡后紧跟一个"行动号召"（如"到店领赠品""回复关键词咨询"），让联系有了即时钩子。

## 十五、分场景联系卡范本（可直接替换）

**门店老板娘风**
> 电话 138-0000-8888｜9:00-22:00（周一店休）
> 幸福路 88 号 · 店后有免费停车
> 微信 dianzhang-aman，加微请备注"公众号看到"更优惠

**服务号客服风**
> 400-888-6666（工作日 9-18）
> 公众号回复「客服」直达人工；回复「人工」转售后

**工作室接单风**
> 微信 studio-workspace（备注来源：公众号）
> 每周二、五 14-17 点集中回消息，急事请留言

## 十六、发布前自查清单

- [ ] 电话、地址、营业/咨询时间齐全，节假日有说明？
- [ ] 客服入口（微信/小程序/回复关键词）给了至少一个？
- [ ] 联系卡位置在文末 CTA 后、页脚前？
- [ ] 电话/地址与当前实际一致，没有旧信息？
- [ ] 全文联系卡 ≤2 张，未重复堆砌？
- [ ] 卡内信息用 CSS 形状标记一行一项、行高 1.75、块距 16px？
- [ ] 多店信息用了列表/多卡，未糊成一段？

> 已按 v10 规范：零 emoji/零图标字符、零渐变、零阴影、纯色平面化 + art:// 植物图案
