# 公众号推文助手桌面版 开发进度记录

> 本文件记录每次代码变更的完整过程。精简版见 PROGRESS-LITE.md。
> 新条目追加位置：在 `---` 分隔线之后、已有最新条目之前。

---

## 2026-09-05

### [Change] 第 12 轮：通用对话模式——去掉固定澄清卡，像通用智能体一样正常对话

背景 / 变更原因：
用户验收第 11 轮后强烈反馈「这不是一个可用的智能体，为什么会有该死的固定框，为什么不是跟一个通用智能体一样正常对话」。经 1 问确认形态 = 通用对话模式：AI 像 DeepSeek/ChatGPT 一样正常聊天（闲聊、公众号写作答疑都自然回复）；只有明确说「写/生成推文」时才产出推文；创作信息不足时由 AI 在对话流里用自然语言反问，用户直接在输入框回答，不再有任何卡片/按钮框。

实现：
- 删除 components/ClarifyCard.tsx、.clarify-* 样式、App pendingClarify 挂卡分流与需求注注入（第 11 轮"需求确认/默认"注取消——对话即契约，按默认推进时由模型在正文前一句话说明默认）
- App 对话路由：isCreateRequest/isDemoTopic → 创作模式 turn('gen')；其余（闲聊/答疑）→ 通用对话 turn('chat')；expectRef 创作上下文标记（模型未产出 HTML=先反问时，下一条消息仍走创作模式；产出推文或用户说"算了"后复位回对话）；知识检索失败回退纯 persona
- lib/needs.ts 重写为请求分类器：CREATE_VERB_NOUN/CREATE_IMPERATIVE/CREATE_HELP 创作判定、isCancel 取消判定；evaluate 保留供模拟端判断反问；删除卡片相关选项/标注导出
- lib/persona.ts：新增 buildChatSystem 通用对话人设（含「对话模式」标记供模拟端识别）；PERSONA_RULES 创作流程补「模糊→最多问 1 个关键问题并停下等待回答；本条若是对澄清的回答→直接产出；按默认推进先一句话说明默认」
- lib/chat.ts：模拟端三类回复（对话人设→闲聊文案；创作且需求不足且上一条未反问→反问问题；否则成文样本）
- ChatPane：移除卡片槽与相关 props；空态/占位/示例 chips 改对话式（新增"帮我写一篇推文，主题是新书上市"演示反问、"公众号推文怎么起标题？"演示答疑）；typing 文案"正在思考…"

验证：
- pnpm build exit 0；cargo test 17/17（Rust 零改动）
- E2E 全绿 28 项 + 零浏览器错误：S9a 模糊创作→对话反问且无预览→回答"日系风格，800字左右"→成文 + 质量通过；S9b 直接写→不问直出单回合；S9c "你好"→自然回复且不产出预览；S9d 反问后"算了"→取消不生成；S1/S1.5/S1.6/S1.7/S2/S7/S8 全回归；截图 verify-artifacts/wxmp-desktop-S9*.png

---

## 2026-09-05

### [Change] 第 13 轮：与 DSH 全面对齐——模型/推理配置 + 模型自主对话

背景 / 变更原因：
用户问「为什么和我用在 deepseek harness 里的差这么多」。差异检查定位：①DSH 用 deepseek-v4-flash + reasoningEffort max，桌面端默认 deepseek-chat 且请求体无推理参数（同 key 官方端点实测：v4-flash 带内部推理、输出更自然；reasoning_effort max 对 deepseek-chat 与 v4-flash 均兼容 HTTP 200）；②DSH 模型完全自主，桌面端仍是本地正则路由 + expectRef 状态机；③DSH persona 对话与创作一体。用户确认「全面对齐优化」。

实现：
- src-tauri/chat.rs：默认模型 deepseek-chat → deepseek-v4-flash；请求体加 reasoning_effort: max（流式）
- src/lib/settings.ts：DEFAULTS.model → deepseek-v4-flash；settings.rs 测试 fixture 同步
- src/lib/persona.ts：PERSONA_RULES 重写为「对话+创作一体」——身份含通用对话能力；行为判断由模型自主（闲聊/答疑直接回复不输出代码；创作模糊→自然问 1 个关键问题后等待；本条是对澄清的回答→直接产出；"算了"→停止创作回对话）；创作硬规范（间距/审美 v10/排版语法/```html 输出协议）保留；删除 buildChatSystem（不再有独立对话人设）
- src/App.tsx：删除本地创作/对话路由与 expectRef 状态机、kind 分支；统一为单回合 turn（统一 persona + 知识节选，兜底无节选 persona）；回复含 HTML 才更新预览（纯对话不触碰预览）
- src/lib/needs.ts：降级为「仅供浏览器模拟端近似模型自主判断」（注释声明）
- src/lib/chat.ts：模拟端不再依赖系统"对话模式"标记，按 isCancel → isDemoTopic → isCreateRequest+需求评估 → 闲聊 启发式近似模型自主（上一条反问过且非取消 → 直接成文）
- 知识库结构不动（第 13 轮 wechat-mp 设计已排除发布/复盘类，desktop 三层即创作知识面）

验证：
- pnpm build exit 0；E2E 全绿 28 项零浏览器错误（S9a 反问成文/S9b 直接写/S9c 闲聊/S9d 反问后"算了"取消 语义保持；S1-S8 回归）
- cargo 17/17；live 冒烟 OK（v4-flash 流式回复）；live_article_sample OK（16.7s、6919 字、0 issues）

---

## 2026-09-05

### [New Feature] 第 14 轮：移植 DSH 完整创作工艺——v2 语法 → HTML 确定性转换器（方案 B）

背景 / 变更原因：
用户质疑「为什么现在产物的质量还留在最初的版本？我 test 内更新的大量内容都去哪里了」。差异检查结论：知识文件零丢失（桌面 149 文件与 test 三层镜像逐字节一致，仅差 2 个开发文档），根因是消费侧——persona 创作协议仍是最初精简版，test 的 47 模块/30 风格/27 文案知识从未进入生成流程。1 问确认方案 B：移植 DSH 完整工艺（wechat-mp preset SKILL.md Host 源码的 compose 转换器）。

实现：
- src/lib/compose.ts（新）：转写 SKILL.md markdownToWechatHtml 核心（DESIGNS text/promo 双色系、inline/paraBlock/bubble/divider/heading/quote/card/steps/banner/cols/imgrow/imgcard/timeline/band/frame/list/table/code/title/lace、detectMode、主循环、art:// 移除+警告、本地图/表格/20000 字符警告、wrapper+plainText），桌面无微信资产 → artUrls 恒空
- 创作协议：persona 改为「输出 ```v2 围栏正文（Markdown+v2 语法），本地排版引擎渲染为微信合法内联 HTML」，语法表 = v2 全集；不再直接写 HTML
- extract.ts：splitAssistant 返回 { prose, code(html), v2 }，识别围栏语言；```html 直通通道保留（违规演示/旧会话）
- App：resolvePreview（html 直通 or v2 compose）；流中 v2 围栏闭合即实时预览；流末终检质量；applySession 恢复时对最后 v2 正文重放 compose；warnings state 展示在预览（art:///本地图/表格提示）
- PreviewPane：body padding 归零（compose wrapper 自带 16px 页边距）+ compose-warn 样式
- ChatPane：源码区按内容显示「查看正文（v2）」或「查看 HTML 源码」
- chat.ts：mock 成文改为 v2 语法正文样例（校园宣传，参照 dev/artifacts/10lian-tuiwen.md 风格）；BAD 演示仍 html 直通
- chat.rs：请求体补 max_tokens 16000（实测 reasoning_effort max 下推理会吃光默认预算导致正文为空）
- scripts/compose-check.mjs（22 项断言）+ compose-cli.mjs（命令行渲染）

验证：
- pnpm build exit 0；compose-check 22/22（模式检测/banner/steps/band/badge/title/气泡/art 移除/本地图与表格警告/文字类结构）
- E2E 31 项全绿零浏览器错误（S1.7 源码区=v2 正文、新增 S1.8 compose 渲染断言：预览含 banner 标题/小节/气泡文本；S1.5 导出 7485B 为 compose HTML；S9a-d 语义保持；S2 直通检出）
- 真实模型 live：v4-flash 按 v2 协议产出 900 字日系风正文（cols/steps/band/KEY 气泡/引用/badge 全语法）→ compose 渲染 promo 755 纯文字、8188B、0 警告
- cargo 17/17 + live 冒烟；产物 compose-live.html/compose-sample.html 落 verify-artifacts

---

## 2026-09-05

### [New Feature] 第 15 轮：现场生成美术素材——按知识库每次创作 SVG + 强制使用 + 结构 ≥6

背景 / 变更原因：
用户问「为什么现在没有生成素材了？我希望根据知识库每次现场生成需要的 svg 素材；强制规定要使用美术素材，且每个 svg 内部结构不得少于 6」。根因：第 14 轮按 DSH"未上传即移除"把 art:// 移除（桌面无微信上传）。方案：桌面本地素材管线——模型按知识库（module-art-assets 规范 + 风格色板）现场绘制 SVG，引擎校验元素 ≥6 后 canvas 渲染 PNG data URI 内嵌（自包含，微信后台粘贴可转存）。

实现：
- src/lib/compose.ts：新增 `::: art [wide|inline] 说明` 容器——原样收集 SVG 内容，校验带 viewBox 且图形元素 ≥6（svgElementCount：circle/rect/ellipse/line/path/polygon/polyline，剥离 defs/渐变/注释），达标输出 @@ARTn@@ 占位并收集 arts，不达标输出占位文本 + 警告；段落合并 break 条件补 art
- src/lib/artRender.ts（新）：svgToPngDataUri（canvas 2x → PNG data URI；尺寸超界/canvas 失败回退 svg data URI）+ renderArtPlaceholders（@@ARTn@@ 逐位替换）
- App：resolvePreview 返回 arts；流中/流末/会话恢复异步渲染替换（artSeqRef 序号防旧渲染覆盖）；质量检查针对渲染后 HTML（data 图不触发外链检查）
- persona：美术素材铁律（每篇必须 ≥1 素材；现场绘制 SVG：viewBox 建议 750x220/300x300、图形元素 ≥6、植物/自然/器物意象、零文字零 emoji、透明底、低饱和同色系 ≤4 色按知识色板、SVG 内允许轻量明暗渐变、每屏 ≤1、wide/inline 用法示例）
- chat.ts mock 样例加 art 块（朝阳旗帜横幅 SVG 7 元素）；compose-check/compose-cli 增 art 断言与摘要
- E2E S1.8 增"素材渲染为 data 图片"断言

验证：
- pnpm build exit 0；compose-check 全绿（art 收集/占位/元素计数/weak svg 拦截/inline 居中）
- E2E 32 项全绿零浏览器错误（S1.8 art svg rendered to data image=1；S1.5 导出 64KB 含 data PNG；S9a-d/S2 语义保持）
- 真实模型 live：v4-flash 产出 2606 字日系咖啡开业 v2 正文，素材块"日式手冲与一颗豆子的香气"SVG（渐变陶杯/拉花涡纹/蒸汽/豆子）15 图形元素 ≥6，compose 渲染 promo 603 字 0 警告
- cargo 17/17（Rust 零改动）；产物 compose-live-art.html 落 verify-artifacts

---

## 2026-09-05

### [Change] 第 16 轮：素材用量升级——组件装饰全覆盖（每篇 5-8 处、单屏 ≤1）

背景 / 变更原因：
用户反馈「强制使用美术素材不够，量太少，每个组件都必须使用美术素材」。经 1 问确认口径 = 组件装饰全覆盖：所有组件装饰位用素材（banner 配主题插画、每个 ## 小节标题下配小插画、气泡邻接 inline 素材、换场分隔花饰、容器按需），单篇 5-8 处、单屏 ≤1。

实现：
- persona 美术素材铁律 v2：素材用量 5-8 处/篇（短篇 ≥4）+ 组件全覆盖映射 + 每处 SVG 元素 ≥6 + 意象呼应 + 单屏 ≤1
- compose.ts：素材用量校验——arts 0 处 →「未包含美术素材」警告；<4 处 →「素材用量偏低」警告（展示在预览区）
- chat.ts mock 样例扩到 5 处素材（FLAG/FLOWER 两变体交替：banner 宽幅、小节 inline×3、收尾宽幅）
- chat.rs：max_tokens 16000 → 32000（实测 reasoning_effort max 下复杂创作推理会吃光 16k 预算致正文为空；32000 为 API 接受上限内）
- compose-check/E2E 断言更新（zero-art/low-art 警告、S1.8 five art assets rendered）

验证：
- pnpm build exit 0；compose-check 30 项全绿
- E2E 33 项全绿零浏览器错误（重跑确认；S1.8 five art assets rendered to data images=5；S1.5 导出 195KB 含 5 张内嵌 PNG；S9a-d/S2 语义保持）
- 真实模型 live：日系咖啡开业 5876 字正文，**6 处素材**（目标 5-8；元素 8-13 全 ≥6；banner 暖帘/小节拉花/豆子旅程/托盘四季/手冲壶/收尾横幅），compose 渲染 promo 767 字 0 警告；产物 compose-live-art5.html
- cargo 17/17（Rust 仅 max_tokens 数值调整）

---

## 2026-09-05

### [Change] 第 17 轮：四项质量修复——文案克制 / 组件必用 / 强制询问 / 风格真正落地

背景 / 变更原因：
用户反馈四项：①文案用力过猛；②只有 SVG 插图、没有各种组件（如修饰的小气泡）；③依旧不询问清楚；④完全没有考虑风格（显式风格按钮在渲染层不生效）。

实现：
- src/lib/palettes.ts（新）：按知识库视觉/风格条目提取 8 风格主题表（日系/国潮/校园/科技/极简/商务/手账/森系；bg 正文底色 + 文字类 accent/accentDark/heading/soft/soft2/border/hl + 宣传类 orange/amber/teal/ink；深档近似色按同色系）
- compose.ts：resolveTheme（UI opts.theme 优先，否则正文 [[theme:名称]] 首个声明）；makeDesign 主题键覆盖；wrapper 加 background（主题底色）；theme 行不渲染；组件化校验警告（容器 ≥2 + 气泡 ≥1 + 列表/引用 ≥1）
- persona 新增三段：文案语气规则（禁夸张营销词/感叹号 ≤1/具体细节/平实号召）；结构规则（正文必须组件化，纯文字 ≤2 连段）；风格规则（界面选择优先；自动时正文顶部 [[theme:名称]] 声明；素材配色同步）
- App：强制询问状态机——创作请求且 evaluate 缺 ≥2（无"直接写"/演示）→ 澄清回合（CLARIFY_SYSTEM 只问 1 个精简问题、不产出）→ 回答后创作；askRef 恢复/清空复位；UI style → compose theme 注入；恢复会话按 item.style 上色
- mock 样例声明 [[theme:校园]]；compose-check 36 项 + E2E 断言更新（主题色渲染、UI 优先、组件化警告、S9 强制询问语义）

验证：
- pnpm build exit 0；compose-check 36 项全绿
- E2E 37 项全绿零浏览器错误（S1.8 campus theme colors applied；S1.7/1.5/1.6/S2/S7/S8/S9a-d 回归）
- 真实模型 live：国潮茶饮 5474 字正文——[[theme:国潮]] 声明 → 宣纸米底 #fff9ef + 朱红 #c03a2b 主色落地、SVG 素材配色贴合（鎏金/朱红/宣纸米）、文案自然克制（"菜单不大，是手抄的…"）；素材 5 处元素 9-12 全达标；产物 compose-live-guochao.html（模型示例语法导致 alt 换行，非产品缺陷）
- cargo 17/17（Rust 零改动）

---

## 2026-09-05

### [Change] 第 18 轮：撤销前端对话状态机（用户永久禁令，立即执行）

背景 / 变更原因：
用户明确「记下来绝对禁止前端状态机，绝对禁止」。第 17 轮实现的"强制询问状态机"（askRef 澄清回合：创作且需求缺 ≥2 → 前端拦截走澄清人设）属于被禁止的前端对话流程状态机，立即撤销；询问与否完全交还模型自主（persona 保留"需求模糊 → 问 1 个关键问题并停下等待"条款作为约束）。

实现：
- App.tsx：删除 askRef/CLARIFY_SYSTEM/澄清回合分支与 needs 前端导入（evaluate/isCreateRequest/isDemoTopic），send 恢复直通统一回合；保留 UI/数据状态（busy/currentId/artSeqRef 等非对话流程状态）
- 禁令落盘：项目 CLAUDE.md 铁律新增第 6 条「绝对禁止前端对话状态机」；REQUIREMENTS.md 新增「〇、永久禁令」节并登记第 18 轮；第 17 轮状态加注说明 askRef 部分已撤销
- 第 17 轮其余三项（文案克制/组件化/风格落地）保留

验证：
- pnpm build exit 0；E2E 全绿（VERIFY OK：S9a-d 语义由模拟端自主近似保持，真实链路交模型自主；S1-S8 回归）

---

## 2026-09-05

### [Change] 第 19 轮：三层数据库按任务路由注入——让最终三层库真正驱动创作

背景 / 变更原因：
用户「我需要的就是最终的三层数据库，为什么没能体现出这个性能」。根因：桌面端只做关键词检索 + ≤6 条 4500 字截断节选，三层库的 46 模块/30 风格/内容类型/模板/合规红线绝大部分从不进入生成上下文；DSH 侧 agent 按 00-GUIDE「路由→索引→点文件」读全文。桌面无工具调用 → 由前端在单次请求内执行同一路由逻辑（非对话状态机，不违永久禁令）。

实现：
- retrieval.ts：任务路由注入——needs.assess 判内容类型 → 文本/内容类型/type-<key> + 文本/文案/copy-tpl-<key>（模板）；风格 → 视觉/风格/style-<key> 全文；营销类（promo/soft/brand）→ 文本/合规/comp-banned 红线（命中提示加"合规红线"）；主题词命中优先、相似度兜底补足 topK；路由点文件截断放宽 8000（其余 4500）
- persona：知识库参考段改为「按任务路由注入，注入内容即该任务权威细则，冲突以库为准」；风格规则强化 auto 场景必须在 v2 正文第一行声明 [[theme:名称]]
- scripts/live-knowledge-probe.mjs（真实注入对比：读库内 4 点文件 → buildSystemPrompt → 模型 → compose）

验证：
- pnpm build exit 0；E2E 39 项全绿零浏览器错误（新增 S8 三层路由注入断言：知识命中含"内容类型:promo / 合规红线"）
- 真实注入对比 live-knowledge-probe：注入 type-promo + copy-tpl-promo + style-guochao + comp-banned（23.6KB）→ 模型产出 6814 字：促销 banner（前三天八折利益点）、5 处素材全部国潮库色（#C03A2B 朱红/#D4AF37 鎏金/#FFF3DE 绢黄/#2B2118 墨）且 alt 具象（开张横幅圆窗杯盏山影红灯笼/桂花枝瓷杯/宣纸灯竹影/金线水云纹/杯垫红印）、0 警告；产物 probe-injected.md / compose-probe-injected.html
- cargo 17/17（Rust 零改动）

---

## 2026-09-05

### [Change] 第 20 轮：风格选型教程注入 + 反模板化——风格按内容选，禁止全国潮模板

背景 / 变更原因：
用户反馈「目前只有风格参考，没有风格选择的教程，全都是成国潮模板了」。根因：①auto 场景从不注入风格选型教程（风格 00-索引"内容类型→首选/备选风格"速查、style-guide-choose 决策流），模型无选型依据 → 瞎选/偏爱国潮；②注入的 style-* 文件（含标题层级/模块表现/文案调性示例）被整篇当模板套 → 每篇都"成国潮模板"。

实现：
- retrieval.ts：ensureKnowledgeLoaded 不再过滤 00-*（相似度兜底排除 00-*/design-logic-components）；auto（assess 无风格）且创作请求 → 注入 视觉/风格/00-索引（内容类型→首选/备选风格速查，路径定位避开各方向同名 00-索引），命中提示加"风格速查"；用户点名风格仍注入 style-<key>；路由条目按原对象输出（避免同名索引错取）
- persona 风格规则 v3：auto 先按注入速查与读者/情绪匹配选风格再声明 [[theme:名称]]，拿不准宁可不声明（默认双色系）；风格=皮肤（色板/气质/装饰），正文结构文案由内容类型模板与主题决定；注入文件中的标题/模块/文案示例仅说明规范，禁止照搬骨架句式；同风格不同主题不得雷同
- scripts/live-style-choice.mjs（三主题同质注入选型验证）

验证：
- pnpm build exit 0；E2E 40 项全绿零浏览器错误（S8 断言补"风格速查"命中：知识命中 活动/内容类型:promo/风格速查/合规红线）
- 真实模型三场景（同质注入：风格速查+type-promo+comp-banned；auto 不指定风格）：咖啡店开业 → [[theme:日系]]（米纸底、木牌窗台意象、拟人 banner"树下咖啡·滨江店，开了"）；科技新品 → [[theme:科技]]（深蓝表带、参数利益点 banner）；中秋国货礼盒 → [[theme:guochao]]（朱红鎏金桂花满月、文化意象 banner）——三篇风格/配色/意象/banner 文案/结构全部差异化，不再是全国潮模板；产物 style-choice-{coffee,gadget,festival}.md
- cargo 17/17（Rust 零改动）

---

## 2026-09-05

### [Change] 第 21 轮：素材具体插画化 + 正文加长 + 气泡角饰修饰

背景 / 变更原因：
用户反馈三项：①SVG 插图过于抽象没有具体图像（根因：persona 素材铁律"线条意象+平面克制"导致几何剪影；"具体插画"引导缺失）；②文案太短（默认长度与充实度要求不足）；③所有气泡缺修饰（组件内装饰素材未实现）。

实现：
- persona 素材铁律 v4：素材必须"看得懂的具体插画"（明确对象结构与前后关系、≥2 层明暗（渐变或深浅色块）、细节纹理、禁止几何剪影冒充；自查标准=读者一眼说出画的是什么）；正文默认 1500-2500 字、每小节展开细节/场景/数据（短文 <600 会被引擎提示）；气泡 KEY/TIP/DANGER 必带角饰（::: art deco 名称 定义 + > [!KEY|名称] 引用，示例给出）；移除 v2 内普通代码块语法（防围栏嵌套干扰提取）；风格规则改为"采用风格必声明 theme（重复声明无害）"
- compose.ts：::: art deco 预扫描注册（SVG ≥6 元素 + viewBox 校验，未达标警告）；bubble 支持现场角饰（60px 右下 data uri 渲染）；引用未定义角饰产生警告；正文偏短（<600 字）警告
- chat.rs：max_tokens 32000 → 64000（实测 1800 字+素材+deco 的长创作在 max 推理下仍吃光 32k 预算）
- mock 样例加长（1500 字级正文）并演示 KEY 气泡角饰；compose-check/E2E 断言更新

验证：
- pnpm build exit 0；compose-check 41 项全绿（deco 渲染/未定义警告/偏短警告/长文无警告）
- E2E 41 项全绿零浏览器错误（S1.8 素材+角饰渲染；S8 路由注入；S9a-d 语义保持）
- 真实模型 live：有闲茶咖开业（信息齐全、1800-2200 字指令）→ 产出 1518 字正文、2 个气泡分别带 keyflower/tipdessert 角饰（定义+引用）、素材 7 处全部具体插画（朱红门前第一盏茶与咖/窗边小桌茶壶/一杯手冲与一盏热茶/一碗桂花茶冻/桂花枝下）元素 16-41、0 警告；产物 probe-injected.md / compose-probe-r21.html
- cargo 17/17（Rust 仅 max_tokens 数值）

---

## 2026-09-04

### [New Feature] 第 11 轮：结构化需求澄清卡——桌面端体现 req-clarify 能力

背景 / 变更原因：
用户批评"桌面端工具里没能体现出 req-clarify 的能力"。经 1 问确认形态 = 结构化澄清卡、确认后生成（不弹卡条件：需求清晰 / 含"直接写"指令 / 演示话题）。

实现：
- src/lib/needs.ts：需求评估（类型/风格/字数/调性/配图五维度关键词命中，缺 ≥2 且无"直接写/演示"触发澄清）+ 需求注组装（describeSelections 已知项 + assumptionNote 默认项：req-clarify"直接做也标注假设"）
- src/components/ClarifyCard.tsx：分维度选项行（每项可点选或保留默认）、需求原文、确认并生成 / 跳过直接生成
- App：send 分流（评估 → 挂卡不调 LLM / 直行附默认注）；confirm/skip 拼装最终 prompt（"需求确认/默认"标注）走原链路；ChatPane 顶部渲染卡片
- 修 React key 冲突：会话恢复（applySession）时把 idSeq 提升到最大消息 id+1，消除恢复后新增消息的重复 key 告警

验证：
- pnpm build exit 0（主包 251.7kB）
- E2E 全绿 21 项 + 零浏览器错误：S9a（模糊请求→弹卡且不流式→选日系/适中→确认→生成含"需求确认"注）；S9b（直接写→不弹卡→消息含默认注）；S1-S8 全回归

---

### [Change] 第 10 轮：界面体验修正——常驻会话栏 + 对话流净化（需求报告驱动）

背景 / 变更原因：
用户批评两点：①生成的代码被用户看到（气泡整段显示 ```html 原文）；②未澄清需求就开干。经 myworkflow-req-clarify 两轮澄清（上下文形态=常驻会话栏；代码展示=默认隐藏可展开），报告 `docs/information/2026-09-04-context-rail-clean-chat.md` 经用户"通过"后实施（方案 A）。

实现：
- SessionRail.tsx：左侧常驻会话栏（列表/新建/切换/删除/当前高亮），顶栏「会话」按钮改为折叠开关（收起/展开会话栏），≤1120px 初始折叠；SessionMenu 弹层退役删除
- 对话流净化：ChatPane 按 splitAssistant（lib/extract.ts 新增）只渲染 ```html 围栏外说明文字；无说明显示"已生成推文，见右侧预览"；每条助手消息带「查看 HTML 源码」展开区（默认收起、独立展开态，流中不显示按钮）
- App 三栏布局（rail-on/rail-off grid）；CSS（session-rail/src-area/src-view 等）
- E2E：S1.7 新增断言（气泡无代码文本/展开含源码/收起）、waitStreamDone/S1.6/S8 迁移到净化与侧栏语义

验证：
- pnpm build exit 0；E2E 全绿（S1 通过 / S1.7 三项 / S1.5 导出 / S1.6 恢复+清空 / S2 检出 / S7 设置 / S8 侧栏 1→2→1）
- Rust 零改动（会话存储沿用第 9 轮）

---

### [New Feature] 第 9 轮：多会话上下文窗口（像 DSH 的会话切换）

需求 / 变更原因：
用户反馈"没有项目的概念/上下文的概念，需要像 dsh 那样有不同的上下文窗口"——每会话独立上下文（历史/内容/模式/风格），新建/切换/删除/自动保存/启动恢复；旧单会话 draft.json 自动迁移首个会话（不丢稿）。

实现：
- Rust draft.rs → sessions.rs：workspace/sessions/<id>.json + state.json 当前指针；sessions_dir/state 注入 base 可测；标题规则（首条 user 消息 ≤16 字 / 自定义保留）；旧 draft.json 自动迁移（rename .migrated）；命令 list/create/open/save/rename/delete_session（10 命令总量）；export/settings 引用改 sessions::workspace_dir
- 前端 draft.ts → sessions.ts（Tauri invoke / localStorage wxmp-sessions-v1，旧 wxmp-draft-v1 迁移）；SessionMenu 组件（列表/新建/删除/当前高亮）；App 状态机 currentId（防抖自动保存绑定当前会话 + 流结束即存 + 切换先存后开 + 删除回退 + 清空=清当前内容）；顶栏「会话 · 标题」入口 + data-ready 就绪标记
- 修 dev StrictMode 双跑：bootRef 互斥 + 移除 alive 门控（cleanup 先于异步完成导致引导丢失）

验证：
- cargo test 17/17（sessions 4：create/list/roundtrip、标题规则、删除回退当前、legacy 迁移）
- pnpm build exit 0（主包 244.5kB）
- E2E 全绿：S1/S1.5/S1.6(新语义 清空=空当前会话)/S2/S7/**S8 多会话**（1→2 新建独立内容 毕业季 → 列表增长 → 切换 → 删 2→1 回退）
- release 重建含本功能

---

### [Build] 第 8 轮：发布刷新——全功能 release 重建 + 安装闭环复验

需求 / 变更原因：
第 5 轮安装包落后于第 6/7 轮功能（存档目录统一、应用内设置），重建交付最终产物并复验安装闭环。

产出 / 验证：
- pnpm tauri build --bundles nsis 重建（release 32s；exe + setup 覆盖）
- 复验：静默安装 exit 0 → 安装版启动存活 → 卸载 exit 0 目录删除
- 清理 resolve_api_key dead_code（release 无用）
- cargo 16/16 无警告
- 交付物：src-tauri/target/release/bundle/nsis/wechat-mp-desktop_0.1.0_x64-setup.exe（含 1-7 轮全部功能）

---

### [New Feature] 第 7 轮：应用内 API 设置——彻底脱离 ~/.dsh

需求 / 变更原因：
对外分发的桌面端不应依赖用户机器的 ~/.dsh 凭据——应用内提供 API 配置（Key/端点/模型），本地保存；密钥解析优先级 env > 应用设置 > 旧 ~/.dsh 兼容回退。

实现：
- src-tauri/src/settings.rs：AppSettings + read/save（损坏→默认不覆盖）+ save_settings/load_settings 命令（2 单测）
- chat.rs：LlmConfig + resolve_config（env > settings.json > ~/.dsh legacy）+ stream_chat 改收 &LlmConfig（修空白 env 处理，+1 优先级单测）
- 前端 lib/settings.ts（Tauri invoke / localStorage wxmp-settings-v1）+ SettingsPanel（Key 掩码/地址/模型/保存/恢复默认/优先级说明）+ 顶栏「设置」入口
- RELEASE-NOTES 配置段改写

验证：
- cargo test 16/16（2 ignored）
- pnpm build exit 0（主包 240.3kB）
- E2E 七场景全绿：S1 通过 / S1.5 导出 / S1.6 恢复+清空 / S2 检出 4 项 / **S7 设置保存→刷新持久(sk-e2e-123)→恢复默认清空**

---

### [Build] 第 6 轮：安装器真实验证——静默安装/启动/卸载闭环

需求 / 变更原因：
第 5 轮产出的 NSIS setup 尚未做真机安装验证；本轮补发布闭环：静默安装 → 安装版启动冒烟 → 静默卸载 → 目录清理。

产出 / 验证：
- setup.exe /S /D=… 静默安装 exit 0；安装目录出现 wechat-mp-desktop.exe
- 安装版启动冒烟：进程存活（6s）后关闭
- uninstall.exe /S 静默卸载 exit 0；安装目录已删除
- RELEASE-NOTES 验证基线补"发布闭环"一行
- 备注：dev 模式 tauri dev（pwsh-17）随之结束；后续开发可随时重启

---

### [Build] 第 5 轮：发布打包——独立安装版（tauri build + NSIS）

需求 / 变更原因：
把桌面端做成可脱离开发环境交付的独立安装版：release 编译 + NSIS 安装器；并冒烟验证发布产物可启动。

产出：
- `pnpm tauri build --bundles nsis`：release exe 12.2MB + NSIS setup 3.7MB（wechat-mp-desktop_0.1.0_x64-setup.exe，makensis 本地工具无需外网）
- RELEASE-NOTES.md：功能清单 / 运行与打包方式 / 配置 / 验证基线 / 已知边界
- 清理 draft.rs dead_code 警告（删除未用 draft_path）

验证：
- 产物存在：bundle/nsis/setup.exe 3.7MB、release/wechat-mp-desktop.exe 12.2MB
- release exe 启动冒烟：进程存活（78MB）→ 正常关闭
- 回归 cargo test 13/13（2 ignored）
- tauri build 整程 1m34s release + NSIS 完成（exit 1 为 pnpm/stderr 噪音，产物完整）

---

### [New Feature] 第 4 轮：会话自动存档/恢复 + 工作区目录统一 + 真实模型整篇抽样

需求 / 变更原因：
桌面创作要"断电不丢稿"：对话自动存档并在启动恢复；导出与存档统一到一个工作区目录；并对真实模型整篇输出做合规抽样（此前只冒烟过短回复）。

实现：
- src-tauri/src/draft.rs：Draft/DraftMsg 结构 + save_draft_to/load_draft_from（损坏存档改名 draft.json.corrupt 容错）+ save_draft/load_draft 命令（3 单测）
- 工作区统一：Documents/wechat-mp-workspace/{draft.json, exports/}（export.rs default_export_dir 改为 delegation 到 draft::exports_dir）
- src/lib/draft.ts：双通道存档（Tauri invoke / 浏览器 localStorage wxmp-draft-v1）+ fmtTime
- App：启动恢复（消息/模式/风格/预览与质量条）、变更防抖 700ms 自动存档、流结束立即存档、顶栏"已自动保存 HH:mm"、清空同时清存档
- chat.rs 新增 live_article_sample（#[ignore] 真实整篇生成 + 软断言）

验证：
- cargo test 13/13（draft 3 项：roundtrip/缺失 None/损坏容错）
- E2E 四场景全绿：S1 质量通过 / S1.5 导出下载 / S1.6 刷新恢复（userMsgs=1 预览恢复 + 顶栏已自动保存）→ 清空清存储 / S2 违规检出 4 项
- live_article_sample：LIVE ARTICLE len=3753 issues=[]（零 gradient/shadow/style/emoji）
- pnpm build exit 0（主包 237.7kB）；窗口 2:46:17 自动重启含 save_draft/load_draft 命令

---

### [New Feature] 第 3 轮：导出 HTML 文件 + 知识库懒加载减包

需求 / 变更原因：
生成结果要"能带走"：①导出按钮——Tauri 模式经 Rust 命令写入 文档/wechat-mp-exports/（文件名消毒、返回完整路径展示），浏览器模式走 <a download>；②知识库 eager 全量内联导致主包 2.4MB，改为懒加载按文件拆分。

实现：
- src-tauri/src/export.rs：default_export_dir/sanitize_name/with_html_ext/export_to_dir + export_html 命令（4 单测：非法字符消毒、htm/html 扩展、写盘内容一致、默认名前缀）
- src/lib/exportHtml.ts：双通道导出（invoke export_html / blob+a.download，文件名 tuiwen-yyyymmdd-hhmm.html）；PreviewPane「导出」按钮 + 结果提示条
- src/lib/retrieval.ts：import.meta.glob 改懒加载（ensureKnowledgeLoaded 缓存 Promise）；App 异步 await retrieve + 顶栏条目数动态显示（加载中…）

验证：
- cargo test 10/10（含 export 4 项；修测试预期：尾部 '_' 被 trim 属预期行为）
- pnpm build exit 0：主包 2388kB → 235.8kB（gzip 75.1kB），知识条目拆 149 个懒加载 chunk
- E2E 全绿：S1 质量通过 / S1.5 导出下载（tuiwen-20260904-0243.html 2254B，内容含 <section>）/ S2 违规检出 4 项
- tauri dev 自动重建重启窗口（PID 更替），export_html 命令已注册

---

### [New Feature] 第 2 轮：生成体验产品化——类型/风格选择注入 + 输出质量检查护栏

需求 / 变更原因：
把生成体验做成可调、结果可检查：①对话侧加「模式(自动/文字/宣传) + 风格(校园/科技/国潮/日系/极简/商务/手账)」快速选择，随请求注入提示词并参与知识检索；②对助手产出 HTML 做客户端质量检查（v10 铁律：零 emoji/零图标、无 style/script/文档级标签、无 linear-gradient/box-shadow、无外链图、无硬性宽），预览栏展示「质量检查:通过/问题清单」。

实现：
- src/lib/quality.ts：checkHtml → {ok, issues}（Extended_Pictographic + v10 图标字符显式集；style/script/html/head/body 标签；linear-gradient/box-shadow；http(s) img；≥100px 固定宽）
- ChatPane：控制条（seg 模式 + 风格下拉）+「演示：违规输出检测」chip；App：mode/style 状态 + decoratePrompt 注入 + 流结束后终检（checkHtml 只在结束时跑，避免流中抖动）；PreviewPane：质量条（q-ok/q-fail + 问题列表）
- chat.ts：新增违规演示样本（BAD_HTML：emoji+渐变+外链图），按提问含"违规"命中

验证：
- pnpm build（tsc+vite）exit 0
- E2E 双向全绿：S1 干净样本 → 质量检查通过（q-ok）；S2 违规样本 → 检出 4 项（emoji/gradient/shadow/external-img）并展示清单（q-fail）；截图 verify-artifacts/wxmp-desktop-ok.png / -fail.png

---

## 2026-08-29

### [New Feature] 第 1 轮：桌面双栏骨架 + 极简智能体链路（Tauri 2 + React 19 + DeepSeek 流式）

背景 / 需求：
用户要求把公众号推文助手做成**独立于 DSH 的桌面本地项目**：左侧与 AI 对话生成内容，右侧实时预览 AI 生成的推文；harness 底座参考 DSH 极简模式智能体（persona + 知识检索 + 流式对话），外附我整理的三层知识库；前端采用 Tauri。

设计决策：
1. **零依赖 DSH**：不引入 Cordis/DSH 运行时；Rust 侧 reqwest 直连 DeepSeek OpenAI 兼容接口（SSE 流式），密钥只从 env DEEPSEEK_API_KEY 或 `~/.dsh/.credentials.yaml` 读取，JS 永不见钥。
2. **双栏工作台**：左 ChatPane（消息流 + 快速示例 + 输入），右 PreviewPane（375px 手机壳 iframe，实时渲染 ```html 围栏内容）。
3. **极简智能体**：system prompt = persona（创作流程/间距 v5/v10 审美/输出协议）+ 按用户提问检索到的知识节选；知识语料 src/knowledge/（三层 149 文件，拷贝自 wechat-mp/test/knowledge，剔除迁移说明等开发文档）；检索 = 主题词映射（80+ 词 → 条目）+ 二元组相似度兜底。
4. **双通道对话**：Tauri 内 invoke chat_stream（Rust 流式，chat-delta 事件推送）；纯浏览器（vite dev）走本地模拟流，便于无壳演示。

文件：
- src/lib/persona.ts、retrieval.ts、chat.ts、extract.ts；components/ChatPane.tsx、PreviewPane.tsx；App.tsx/App.css/index.html
- src-tauri/src/chat.rs（密钥解析/SSE 解析/stream_chat 核心，6 单测 + live 冒烟 #[ignore]）、lib.rs、Cargo.toml（+reqwest rustls）、tauri.conf.json（1380x880「公众号推文助手」）
- scripts/verify-ui.mjs（playwright E2E）；四文件体系 + REQUIREMENTS（第 0/1 轮）

验证：
- pnpm build（tsc+vite）exit 0；E2E 全绿：模拟链路 4/4 PASS（状态徽标/围栏存在/预览非空/演示内容命中），截图 verify-artifacts/wxmp-desktop-ui.png；知识命中"校园/风格"
- cargo test 6/6 过（修 parse_credentials 循环内 `?` 提前返回 bug）；live DeepSeek 冒烟 `LIVE REPLY: 桌面链路测试通过`
- tauri dev 窗口启动确认（端口占用问题：先停 vite 再 tauri dev）

踩坑记录：
- pnpm 11 默认拦截 esbuild 构建脚本 → pnpm-workspace.yaml `allowBuilds: esbuild: true`
- 验证脚本首版等 `.btn-send:not(:disabled)` 误判（输入为空时按钮本就禁用）→ 改为等流结束标志（围栏完整 + typing 消失）
- playwright 版本与已装 chromium 不匹配 → executablePath 显式指 chromium-1234

---
