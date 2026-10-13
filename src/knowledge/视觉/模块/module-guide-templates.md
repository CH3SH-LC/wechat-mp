# 组件复用与替换检查（module-guide-templates）

> 定位：复用已经验证过的视觉组件和资产，减少重复排版；复用单位是组件，不是整篇文章。

选材、标题、段落组织与结尾由 `文本/写作` 知识负责：按任务需要读取 `writing-purpose`、`writing-structure`、`writing-campus`、`writing-product`、`writing-explain`、`writing-story` 或 `writing-review`。视觉风格只决定呈现方式，不绑定文章结构、篇幅或语气。

## 按组件用途取用

| 要呈现的内容 | 查阅条目 |
|---|---|
| 标题与层级 | module-header、module-heading、module-subheading |
| 提醒、引用与分类 | module-bubble、module-quote、module-card、module-badge |
| 步骤、清单与时间 | module-steps、module-checklist、module-timeline |
| 数据与产品规格 | module-table、module-spec、module-price |
| 图片、视频与装饰 | module-image、module-media、module-inline-deco |
| 联系、报名与跳转 | module-contact、module-miniapp、module-job |
| 证据、来源与补充阅读 | module-case、module-testimonial、module-disclaimer、module-reading |

只有正文确有对应信息时才取用组件。组件的标题、说明、按钮与图注均来自当前任务，不带入旧稿人物、价格、日期、地点、名额、评价或承诺。

## 替换与保存

读取组件条目及当前引擎协议，确认支持的结构与素材引用。替换本篇信息、有效资产与所选色板，再检查长标题、长字段和不同图片比例是否溢出。保留字号层级、行高 1.75、块距 16px、卡内留白至少 12px 等排版参数。

可复用库记录组件用途、支持语法、可替换字段、有效资产、视觉参数和已验证的使用环境。保留版本与出处；涉及外部素材时保留授权信息。旧版本不覆盖当前用户内容，过期入口和事实重新确认。

## 实例边界

门店卡可以保留名称、地址、营业信息和联系入口的布局，填写时仍需有当前有效信息。参数卡可以复用对齐方式，但比较维度和单位依据本次产品。两种组件同篇出现时，沿正文需要安排位置，不由组合模板增补开场、卖点或结尾。

## 交付检查

核对示例占位是否清除、内容与素材是否匹配、链接是否可用、来源是否保留。生成的外观不能代表真实跳转、发布或手机预览已经完成；验证状态按实际记录。

实际输出以 `engine-write-protocol` 的 v2 语法为准。色板与版式分别选择；正文容器按 `fill` 选择无底或浅底，横幅与小标题在 `frame=plane` 且显式选择浅底时可使用浅底，默认保留线条结构，允许协议支持的小记号与插画内部填色。保持零 emoji、零图标字符、零渐变、零阴影。素材沿用有效引用，生成需求使用协议支持的 `[[img]]` / `[[deco]]`；旧 HTML/CSS 片段仅用于理解视觉，不作为桌面输出语法。
