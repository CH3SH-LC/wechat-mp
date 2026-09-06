# wechat-mp-desktop 需求登记册（REQUIREMENTS.md）

> 每轮开发前先在本文件登记需求（含验收标准），确认后再动手；开发流程见项目 CLAUDE.md。

## 〇、永久禁令（用户 2026-09-05 明确，任何轮次不得违反）

1. **绝对禁止前端对话状态机**：不得用任何前端状态（pendingClarify / expectRef / askRef 等）控制对话流程、澄清或路由；消息一律直通模型，由模型自主判断——需求澄清只能靠 persona 约束，不能靠前端分流/等待态。历史违例：第 11 轮澄清卡（已撤）、第 12/13 轮 expectRef（已撤）、第 17 轮 askRef 强制澄清回合（用户发现后立即撤销，见第 18 轮）。

## 一、项目定位（2026-08-29 用户原话整理）

> 让这个项目独立于 dsh。目标是做一个桌面本地项目：一方面可以跟 AI 对话，生成内容；另一方面可以实时看到 AI 生成的推文。harness 底座参考 dsh 的极简模式智能体，外附我整理的微信公众号知识（三层知识库）；桌面前端采用 Tauri。

- 独立性：不依赖 DSH/Cordis 运行时；AI 直连 DeepSeek API；知识语料内嵌。
- 双栏桌面工作台：左 = AI 对话生成；右 = 375px 手机壳实时预览生成的推文 HTML。

## 二、功能需求登记（逐轮追加，最新在最上）

### 2026-09-06｜第 26 轮：微信草稿箱发布（需求文档 v2 修订 1）
- 需求：成稿后除复制/导出外，可经微信官方接口发布到公众号草稿箱——配置 AppID/AppSecret → 正文图片上传为永久素材并替换引用 → draft/add 入草稿箱。
- 改动点：①Rust publish.rs（access_token 获取/缓存刷新、material/add_material 图片上传、draft/add）+ 命令注册；②SettingsPanel 增公众号配置（AppID/AppSecret 本地存）；③PreviewPane「发布到草稿箱」按钮与状态反馈；④微信接口抽象层支持 mock（E2E）与测试号（live）。
- 验收标准：cargo 单测全绿（token 解析/上传/草稿拼装纯函数 + mock HTTP）；E2E mock 链路：发布成功返回草稿提示；无凭据/失败给出可读错误且不丢产物；文档同步+提交；live（微信测试号）验证另行记录。
- 状态：✅ 代码完成（cargo 37/37（含 publish 9 纯函数单测 + 本地假微信服务器端到端契约单测）+ pnpm build + compose-check + E2E 全绿；真实微信 draft/add 需测试号联网验证——LIVE-PENDING 见 publish.rs 注释：封面 thumb_media_id、multipart 字段、token 过期重试幂等）

### 2026-09-06｜第 25 轮：知识注册表 + 模型按需工具取用（需求文档 v2 修订 7）
- 需求：知识不再"一股脑注入"也不"启发式条件注入"——system 只注入**知识注册表**（目录），创作前模型经 **DeepSeek function-calling 工具**（load_knowledge/search_knowledge）按需取用点文件全文。
- 改动点：①Rust prep_turn 非流式命令（tools 声明 + 透传 tool_calls）；②retrieval 增 buildRegistry/runKnowledgeTool（内存库执行）；③persona 知识段改工具用法；④App turn 创作前 prep 循环（模型决定取知识/澄清），取完 READY 后带工具结果流式生成；浏览器 mock 走原路不触发。
- 验收标准：pnpm build exit 0；cargo 全绿（含 prep 解析单测）；E2E 全绿；真实模型 live：创作时 system 含注册表不含大段正文、模型确实触发 load_knowledge 且产物体现类型模板/风格色板/合规（live 记录于 docs）。
- 状态：✅ 代码完成（cargo 36/36 + pnpm build + compose-check + E2E 全绿；真实模型 live 已闭环：明确创作→模型自选 load style-japanese/type-promo/copy-tpl-promo/comp-banned 4 点→digest 流式成稿 3422 字 v2，无 400）

### 2026-09-06｜第 24 轮：美术素材改图像子智能体产出（需求文档 v2 修订 8）
- 需求：把"画 SVG"从主模型剥离——创作时主模型只写**图位占位**（`[[img:wide|说明]]` / `[[img:inline|说明]]` / `[[deco:名称|说明]]`），正文产出后由**图像子智能体**按占位清单逐个独立生成具体插画 SVG（校验 ≥6 元素 + viewBox），再经 artRender 转 PNG data URI 回填、compose 渲染——减主模型负担与中断风险。
- 改动点：①persona 素材铁律改"图位占位语法"，主模型不再内联 SVG（明确类型/位置/意象/风格/说明）；②新增 src/lib/image-agent.ts——桌面 invoke 新 Rust 命令 gen_svg（DeepSeek 非流式、专用画图 persona）/ 浏览器模拟用本地样例池近似；③App 创作收尾"素材生成器"：检测占位 → 逐个（可串行）生成 → 校验 → 替换为完整 ::: art/deco 块 → compose；④chat.ts 模拟样例改为占位写法 + 本地 SVG 池；⑤验证断言。
- 验收标准：pnpm build exit 0；compose-check 全绿；E2E 全绿（新增：产物含 ≥4 data 素材图、无占位残留文本）；真实模型 live：一次创作素材全部来自图位（非手写 svg）、素材数 5-8、0 警告；cargo 回归（新 gen_svg 单测/live）。
- 状态：✅ 代码完成（pnpm build + compose-check + E2E 全绿（S1.8 占位全替换断言过）+ cargo 36/36；gen_svg live 已联网闭环——专用 deepseek-chat 11s 直出 53 元素具体 SVG）

### 2026-09-06｜第 23 轮：界面去控件 + LLM 自决风格/模式 + busy 两档 + persona v5 全澄清（需求文档 v2 落地第 1 批）
- 需求（源自 docs/REQUIREMENTS-understanding.md 修订意见 3/4/5/6 + O-1）：界面删去"模式三段按钮"与"风格下拉"——类型/风格改由 LLM 依据已澄清需求自决；风格不局限于预置 8 色板（引擎支持正文自定义 palette token）；澄清策略改"创作前把相关需求逐项问清、未决不产出"（非只问 1 个）；busy 区分"思考/澄清中"与"生成中"两档；统一 persona 字数口径。
- 改动点：①ChatPane/App 移除模式按钮与风格下拉及 decoratePrompt 注入；会话存档 mode/style 保留（旧会话恢复兼容，作为主题回退）；②busy 两档=「正在思考…/正在生成…」，由"当前 draft 是否已打开 ``` 围栏"内容态派生（仅展示，非对话状态机）；③persona v5——澄清规则（逐维度问清至明确或授权"由你定"，需求全明确才产出，取消"最多 1 问"与"直接写即产出"倾向）、风格自决规则（预置可名引用、非预置须自带色板、UI 无风格）、正文默认 1500-2500 字统一口径（修 O-1）；④compose/palettes 主题扩展——`[[theme:名称]]` 非预置名时合并正文 `[[palette:bg=…;accent=…;…]]` 自定义色板渲染，二者皆缺则警告回退默认色系。
- 验收标准：pnpm build exit 0；compose-check 全绿（新增 palette/未知风格警告断言）；E2E 全绿（界面无模式/风格控件；自动模式创作产出含 [[theme]] 声明；S9 澄清语义按 v5 更新）；真实模型 live：不指定风格时模型自选并声明 theme（含非预置风格样例）、正文 ≥1200 字、澄清不产出；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 代码完成（pnpm build + compose-check（palette/未知风格断言）+ E2E S1.9 全绿；真实模型 live 已联网闭环：模糊→多维度澄清不产出、明确→工具自选+成稿，见 PROGRESS live）

### 2026-09-05｜第 22 轮：整理散落验证产物归档到项目 docs/artifacts（整理轮，无代码功能）
- 需求：用户「整理所有散落在外的文件到 wechat-mp-desktop 内」。盘点：工作区 verify-artifacts 33 个文件——A 组 19 个属本项目验证产物（E2E 截图 8、compose/注入样例 9、风格选型 3）；B 组 14 个属 askkp/dsh-desktop 历史产物保留原位；工作区根杂项与 TEMP 残留不动。用户确认按提议移动 A 组。
- 改动点：新建 docs/artifacts/ 并移入 A 组 19 个；verify-ui.mjs 与 compose-check.mjs 默认输出路径改为项目内 docs/artifacts（今后验证截图/样例自动落在项目内）；STRUCTURE/docs 树登记；REQUIREMENTS/进度同步。
- 验收标准：docs/artifacts 含 19 个产物；verify-artifacts 剩 14 个非本项目文件；脚本默认输出路径生效；文档同步 + 提交。
- 状态：✅ 完成（19 个产物已移入 docs/artifacts；verify-artifacts 剩余 14 个非本项目历史产物；两脚本默认 outDir 指向项目内；STRUCTURE/PROGRESS/RELEASE-NOTES 同步；commit 完成）

### 2026-09-05｜第 21 轮：素材具体插画化 + 正文加长 + 气泡角饰修饰
- 需求：用户反馈三项——①SVG 插图过于抽象没有具体图像（根因：persona 素材铁律"线条意象+平面克制"导致模型画几何剪影；库中"具体插画"引导未入规则）；②文案太短（默认长度与"充实度"要求不足，模型倾向短篇）；③所有气泡缺修饰（组件内装饰素材桌面未实现，bubble 只有纯色/左条）。
- 改动点：①persona 素材铁律 v4——素材必须"具体可辨认插画"：明确对象轮廓与结构、≥2 层明暗体积（允许渐变）、细节纹理层，禁止几何剪影冒充图像，附自查点；②正文默认 1500-2500 字（未要求短篇时），每小节展开细节/场景/数据；compose 加"正文偏短(<600 字)"警告；③气泡角饰：compose 支持 \`::: art deco 名称\` 装饰素材定义（不输出正文图）+ 气泡 \`> [!KEY|名称]\` 引用 → 角饰 60px 右下渲染（SVG 现场生成 data uri）；引用未定义名称产生警告；persona 要求每个 KEY/TIP/DANGER 气泡带角饰（定义+引用示例）；④mock 样例加长至 1200 字级并给 KEY 气泡加角饰；E2E/compose-check 断言更新。
- 验收标准：pnpm build exit 0；compose-check 全绿（新增 deco 定义/引用/未定义警告/正文偏短警告断言）；E2E 全绿（角饰渲染 data 图、正文加长后 S1.8 文本更长）；真实模型 live：同主题产物插图具体化（对象轮廓/明暗细节可辨）、正文 ≥1200 字、气泡带角饰；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 完成（persona 素材铁律 v4：素材=具体可辨认插画（明确对象结构、≥2 层明暗、细节纹理、禁几何剪影）、正文默认 1500-2500 字且要求充实、气泡 KEY/TIP/DANGER 必带角饰（::: art deco 定义 + 语法引用示例）；compose 支持 ::: art deco 预扫描注册 + 气泡 `|名称` 角饰 60px 渲染 + 未定义警告 + 正文偏短(<600)警告；chat.rs max_tokens 32000→64000（实测长创作 max 推理仍吃光 32k）；persona 移除 v2 内普通代码块语法（防围栏嵌套干扰）+ 风格规则改"采用风格必声明 theme"；mock 样例加长至 1500 字级 + KEY 气泡带角饰；compose-check 41 项全绿（deco 渲染/未定义/偏短断言）；E2E 41 项全绿（S1.8 五图+角饰渲染）；真实模型 live：国潮咖啡开业 1800 字指令产出 1518 字正文、2 个气泡各带角饰（keyflower/tipdessert）、素材 7 处全部具体插画（朱红门前第一盏茶/窗边茶壶/手冲与热茶/桂花茶冻/桂花枝下）元素 16-41、0 警告；cargo 17/17；release 重建含本功能）

### 2026-09-05｜第 20 轮：风格选型教程注入 + 反模板化——风格按内容选，禁止全国潮模板
- 需求：用户反馈「目前只有风格参考，没有风格选择的教程，全都是成国潮模板了」。根因：①auto 场景路由从不注入风格选型教程（风格 00-索引"内容类型→首选/备选风格"速查、style-guide-choose 决策流），模型无选型依据 → 瞎选/偏爱国潮；②注入的 style-* 文件（含标题层级/模块表现/文案调性示例）被模型整篇当模板套用 → 每篇都"成国潮模板"。
- 改动点：①retrieval：ensureKnowledgeLoaded 不再过滤 00-*（bigram 兜底排除 00-*/design-logic），新增路由——auto（assess 无风格）且创作请求 → 注入 视觉/风格/00-索引（速查，路径定位避开同名索引）+ style-guide-choose（决策流），命中提示加"风格速查"；用户点名风格仍注入 style-<key>；②persona 风格规则 v3：auto 先按注入速查/决策流选风格再声明 theme，无合适候选宁可不声明；风格只是"皮肤"——内容结构与文案由内容类型模板与主题决定，禁止照搬注入文件中的标题/模块/文案示例骨架与措辞，同风格不同主题产出不得雷同；③mock/E2E 断言补"风格速查"命中。
- 验收标准：pnpm build exit 0；E2E 全绿（S8 断言含 风格速查）；真实模型 live 三场景（咖啡店开业/科技新品/节日国货，均 auto 不指定风格）→ theme 声明分别符合速查（咖啡→日系或美式复古而非国潮；科技→科技；节日国货→国潮），且产物结构非单一模板复刻；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 完成（retrieval：00-* 索引不再被加载过滤（相似度兜底排除），auto 且创作请求 → 注入视觉/风格/00-索引"内容类型→首选/备选风格速查"（路径定位避免同名索引），命中提示"风格速查"；persona 风格规则 v3：auto 先按速查选型再声明 theme、拿不准宁可不声明；风格=皮肤非内容模板，禁止照搬注入文件示例骨架/句式，同风格不同主题不得雷同；E2E 40 项全绿（S8 断言补 风格速查）；真实模型三场景 auto 验证：咖啡店开业→日系、科技新品→科技、中秋国货→国潮，三篇风格/配色/意象/banner 文案/结构全部差异化（非模板复刻）；cargo 17/17（Rust 零改动）；release 重建含本功能）

### 2026-09-05｜第 19 轮：三层数据库按任务路由注入——让最终三层库真正驱动创作
- 需求：用户「我需要的就是最终的三层数据库，为什么没能体现出这个性能」。根因：桌面端只做关键词检索 + ≤6 条 4500 字截断节选，三层库的 46 模块/30 风格/内容类型/模板/合规红线绝大部分从不进入生成上下文；DSH 侧 agent 按 00-GUIDE「路由→索引→点文件」读全文。桌面无工具调用 → 由前端在单次请求内执行同一路由逻辑（非对话状态机，不违禁令）。
- 改动点：retrieval.ts 升级为任务路由注入——①内容类型（needs.assess）→ 注入 文本/内容类型/type-<key> + 文本/文案/copy-tpl-<key>（模板）；②风格（assess/文本词）→ 视觉/风格/style-<key> 全文；③营销类（promo/soft/brand）→ 文本/合规/comp-banned 红线；④主题词命中优先保留；⑤相似度兜底补足 topK；路由点文件截断放宽至 8000 字符（其余 4500）；persona 知识库段改为"注入即该任务权威细则，冲突以库为准"。
- 验收标准：pnpm build exit 0；E2E 全绿（含知识命中区含路由条目）；真实模型 live：同主题在路由注入下产物体现类型模板结构/风格色板一致性/合规红线（目检 + 命中断言）；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 完成（retrieval.ts 升级任务路由注入：内容类型→type-<key>+copy-tpl-<key>、风格→style-<key> 全文、营销类→comp-banned 红线，路由文件截断放宽 8000 其余 4500，主题词命中优先、相似度兜底；合规红线入命中提示；persona 知识段改"注入即权威细则、冲突以库为准"+ 风格 auto 场景强制正文首行声明 [[theme:名称]]；E2E 39 项全绿（新增 S8 三层路由注入断言：知识命中含 内容类型:promo/合规红线）；真实注入对比 live-knowledge-probe：注入 type-promo+copy-tpl-promo+style-guochao+comp-banned（23.6KB）→ 模型产物促销 banner 八折利益点、素材 5 处全部国潮库色（朱红/鎏金/绢黄/墨）且 alt 具象、0 警告；cargo 17/17；release 重建含本功能）

### 2026-09-05｜第 18 轮：撤销前端对话状态机（用户永久禁令，立即执行）
- 需求：用户明确「记下来绝对禁止前端状态机，绝对禁止」。第 17 轮"强制询问状态机"（askRef 澄清回合）违反该原则，立即撤销；询问与否完全交还模型自主（persona 保留"需求模糊→问 1 个关键问题并停下等待"条款）。
- 改动点：App 删除 askRef/CLARIFY_SYSTEM/澄清回合分支与 needs 前端导入，send 直通统一回合；禁令写入项目 CLAUDE.md 铁律第 6 条与 REQUIREMENTS「〇、永久禁令」；persona 询问条款保留（模型自主行为）。
- 验收标准：pnpm build exit 0；E2E 全绿（S9a 语义由模拟端自主近似保持：先问→回答→成文；真实链路交模型自主）；文档同步 + 提交。
- 状态：✅ 完成（E2E 回归全绿；CLAUDE.md 铁律第 6 条 + REQUIREMENTS 永久禁令落盘；App 仅保留必要 UI/数据状态，无任何对话流程状态机）

### 2026-09-05｜第 17 轮：四项质量修复——文案克制 / 组件必用 / 强制询问 / 风格真正落地
- 需求：用户反馈四项：①文案用力过猛（夸张空洞 AI 味）；②只有 SVG 插图、没有各种组件（如修饰的小气泡）；③依旧不询问清楚（模型常直接默认产出）；④完全没有考虑风格——显式风格选择在渲染层不生效。
- 方案：①persona 增「文案语气规则」（禁用夸张词表/感叹号 ≤1/具体细节/平实号召）；②persona 增「结构规则」——正文必须组件化：≥2 种容器（steps/cols/card/band/timeline/frame）+ ≥1 气泡 + 列表/引用，纯文字段落 ≤2 连段；③前端强制询问状态机——创作请求且需求评估缺 ≥2 项（无"直接写"/演示）→ 先走澄清回合（专用人设问 1 个精简问题、禁止产出），回答后再创作；needs.evaluate 复用；④风格落地——palettes.ts 按知识库 8 风格色板（日系/国潮/校园/科技/极简/商务/手账/森系）建主题表；composeMarkdown 支持 opts.theme（UI 风格选择）与正文 `[[theme:名称]]` 声明（UI 优先），DESIGNS 双模式主色键按主题覆盖（含正文底色 bg），素材/组件配色同步换色。
- 改动点：palettes.ts（新建，色板取自 src/knowledge/视觉/风格/* 条目）；compose.ts（theme 解析 + makeDesign + wrapper 底色 + resolveTheme 导出）；persona（语气/结构/风格三段）；App（askRef 状态机 + clarify 回合 + style→theme 注入 + 恢复/清空复位）；needs（复用 isCreateRequest/isDemoTopic/isCancel/evaluate）；mock 样例加 [[theme:校园]]；compose-check/E2E 断言（主题色渲染、澄清语义保持）。
- 验收标准：pnpm build exit 0；compose-check 全绿（新增 theme 覆盖/UI 优先断言）；E2E 全绿（S1.8 主题色断言；S9a 语义=强制询问保持；回归）；真实模型 live：风格声明后渲染换色 + 文案/组件目检；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 完成（palettes.ts 按知识库 8 风格色板（日系/国潮/校园/科技/极简/商务/手账/森系，bg+文字类 7 键+宣传类 5 键）；compose 支持 opts.theme（UI 优先）与正文 [[theme:名称]] 声明、wrapper 主题底色、theme 行不渲染；persona 增三段：文案语气规则（禁夸张词/感叹号 ≤1/平实号召）、结构规则（容器 ≥2 + 气泡 ≥1 + 列表/引用 ≥1、纯文字 ≤2 连段）、风格规则（界面选择优先/自动时声明 theme/素材配色同步）；App 强制询问状态机（askRef：创作且需求评估缺 ≥2 → 澄清回合专用人设只问不产出 → 回答后创作；演示/直接写跳过；恢复/清空复位）；compose 引擎组件化不足校验警告；mock 样例声明 [[theme:校园]]；compose-check 36 项全绿（含 theme 覆盖/UI 优先/组件化警告）；E2E 37 项全绿（S1.8 campus 主题色断言；S9a 强制询问语义保持）；真实模型 live：国潮茶饮 5474 字正文——theme 声明→宣纸米底/朱红主色落地、素材配色贴合（鎏金/朱红）、文案自然克制；cargo 17/17（Rust 零改动）；release 重建含本功能。注：其中「强制询问状态机（askRef）」部分于第 18 轮按用户永久禁令撤销（见「〇、永久禁令」与第 18 轮），文案克制/组件化/风格落地三项保留）

### 2026-09-05｜第 16 轮：素材用量升级——组件装饰全覆盖（每篇 5-8 处、单屏 ≤1）
- 需求：用户反馈「强制使用美术素材不够，量太少，每个组件都必须使用美术素材」。经 1 问确认口径 = **组件装饰全覆盖**（推荐）：所有组件装饰位都用上现场生成素材——开篇 banner 配主题插画、每个 ## 小节标题下配小插画、每个 [!KEY/TIP] 等气泡邻接配素材、换场分隔配花饰素材、卡片/容器附近按需配图；单篇 5-8 处素材、单屏仍 ≤1、克制不花哨（对齐 DSH v10.3 样文质感）。
- 改动点：①persona 美术素材铁律升级 v2——素材数量 5-8 处/篇（短篇 ≥4），组件覆盖规则（banner/小节/气泡/分隔/容器各装饰位）与位置建议、单屏 ≤1；②compose.ts 引擎素材用量校验——0 处与 <4 处产生"素材用量不足"警告（展示在预览区）；③mock 样例素材扩到 5 处（banner 图/小节图×2/气泡图/分隔花饰）；④compose-check/E2E 断言更新（预览 data 素材 ≥4）；⑤真实模型 live 验证单篇素材 ≥5。
- 验收标准：pnpm build exit 0；compose-check 全绿；E2E 全绿（S1.8 素材渲染 ≥4）；真实模型 live 素材 5+ 处且 0 警告；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 完成（persona 素材铁律 v2：5-8 处/篇（短篇 ≥4）、组件装饰全覆盖映射（banner 配插画/小节标题下配图/气泡邻接/inline/分隔花饰/容器按需）、单屏 ≤1；compose 引擎素材用量校验：0 处与 <4 处产生用量警告；mock 样例 5 处素材（旗帜/花枝变体）；compose-check 30 项全绿（新增 zero-art/low-art 警告断言）；E2E 33 项全绿（S1.8 five art assets rendered 5）；真实模型 live：日系咖啡开业 5876 字正文 6 处素材（元素 8-13 全达标）0 警告；chat.rs max_tokens 16000→32000（实测推理 max 长创作仍会吃光 16k 预算）；cargo 17/17；release 重建含本功能）

### 2026-09-05｜第 15 轮：现场生成美术素材——按知识库每次创作 SVG 素材 + 强制使用 + 结构 ≥6
- 需求：用户问「为什么现在没有生成素材了？我希望能够根据知识库，每次现场生成需要的 svg 素材；另外，强制规定要使用美术素材，且每个 svg 内部结构不得少于 6」。根因：第 14 轮移植按 DSH"未上传即移除"把 art:// 移除（桌面无微信上传通道）。方案：桌面本地素材管线——模型在 v2 正文里按知识库（module-art-assets 规范 + 风格条目）**现场绘制 SVG**，新语法 `::: art [wide|inline] 说明` + SVG 原始内容 + `:::`；引擎校验 SVG 元素数 ≥6（circle/rect/ellipse/line/path/polygon/polyline/image 合计）与 viewBox 存在；达标 → 前端 canvas 渲染 PNG（2x）→ data URI 内嵌预览与导出（自包含，微信后台粘贴可转存）；不达标 → 占位 + 警告。persona 硬规则：每篇创作必须使用 ≥1 个美术素材；素材须植物/自然类、按知识库色板、零文字零 emoji、密度每屏 ≤1。
- 改动点：compose.ts 增 `::: art` 容器（原样收集 SVG、元素计数校验、宽/居中两种展示规格、arts 收集与占位警告）；artRender.ts（SVG→PNG data URI，canvas 2x，失败回退 svg data URI）；App 异步渲染替换 @@ARTn@@（流中/终检/会话恢复一致，防竞态）；persona 语法表与硬规则；mock 样例含 art 块；compose-check 增校验断言；E2E 断言预览出现渲染 PNG。
- 验收标准：pnpm build exit 0；compose-check 全绿（新增 art ≥6 通过/<6 占位警告/arts 收集）；E2E 全绿（S1.8 预览含 data:image/png 素材图 + 质量通过）；真实模型 live 产出含素材 v2 正文并渲染；cargo 回归；文档同步 + 提交；release 重建。
- 状态：✅ 完成（compose.ts 增 ::: art 容器：SVG 原样收集、svgElementCount 校验（circle/rect/ellipse/line/path/polygon/polyline ≥6 且带 viewBox），达标输出 @@ARTn@@ 占位 + arts 收集，不达标占位文本+警告；artRender.ts canvas 2x 渲染 PNG data URI（失败回退 svg data URI）；App 流中/终检/会话恢复异步渲染替换（artSeqRef 防竞态）；persona 素材铁律：每篇 ≥1 素材、现场绘制 SVG、元素 ≥6、植物器物意象、零文字 emoji、低饱和 ≤4 色、每屏 ≤1；E2E 32 项全绿（S1.8 art svg rendered to data image）；compose-check 新增 art 断言全过；真实模型 live：日式手冲素材 SVG 15 元素 0 警告；cargo 17/17；release 重建含本功能）

### 2026-09-05｜第 14 轮：移植 DSH 完整创作工艺——v2 语法 → HTML 确定性转换器（方案 B）
- 需求：用户质疑「为什么现在产物的质量还留在最初的版本？我 test 内更新的大量内容都去哪里了」。检查结论：知识文件零丢失（桌面 149 与 test 151 仅差 2 个开发文档，哈希全同，同步于 09/02 重组当天）；根因是消费侧——桌面 persona 创作协议仍是第 1 轮精简版（基础 HTML 语法十行），test 的 47 模块/30 风格/27 文案知识从未进入生成流程。用户选方案 **B：移植 DSH 完整工艺**——把 wechat-mp 预设（SKILL.md Host 源码）的 compose 转换器（v2 排版语法 → 微信合法内联 HTML，DESIGNS text/promo 双色系 + 间距 v5 + 平面化 v10）移植到桌面端，创作协议改为模型产出 v2 语法正文、前端确定性转 HTML。
- 改动点：①新建 src/lib/compose.ts（转写 SKILL.md markdownToWechatHtml 核心：inline/bubble/divider/heading/quote/card/steps/banner/cols/imgrow/imgcard/timeline/band/frame/list/table/code/title/lace + detectMode + art:// 移除警告；纯 TS 无微信依赖，桌面版无资产 → art:// 引用移除并警告）；②persona 创作协议改为输出 ```v2 围栏正文（Markdown + v2 语法表，由转换器渲染），不再直接写 HTML；知识节选保留；③前端协议：```v2 围栏 → compose → 375px 预览 + 质量检查；```html 围栏仍支持直通（保留违规演示与旧会话）；气泡显示说明文字 + 可展开查看正文；会话恢复时对最后 v2 正文重放 compose；④模式控件传给 compose（auto/text/promo）；⑤模拟端成文改为 v2 正文样例（参照 dev/artifacts/10lian-tuiwen.md）；⑥验收基线：全语法样例经 compose 输出与 DSH syntax-text/promo.html 结构同源（关键块级断言），E2E 回归 + 真实 live 生成对比。
- 验收标准：pnpm build exit 0；E2E 全绿（S1 预览为 compose 产物且质量通过、S2 违规演示直通检出、S9a-d 语义保持）；compose 单测（node 直接跑？前端无测试框架 → 以 E2E 断言 + 样例基线为准）；文档同步 + 提交；release 重建。
- 状态：✅ 完成（compose.ts 移植 DSH 转换器 22 项脚本检查全过；persona 改 v2 协议；```v2 围栏→compose→预览+质量检查，```html 直通保留；会话恢复 v2 重放；compose-warn 展示 art:///本地图/表格/超长警告；修复 reasoning max 下无 max_tokens 导致推理吃光预算的隐患（body 加 max_tokens 16000）；E2E 31 项全绿零浏览器错误（新增 S1.8 compose 渲染断言）；真实模型 live 验证：v4-flash 按 v2 协议产出 900 字日系正文 → compose 渲染 755 纯文字 0 警告；cargo 17/17 + live 冒烟；release 重建含本功能）

### 2026-09-05｜第 13 轮：与 DSH 全面对齐——模型/推理配置 + 模型自主对话（检查驱动）
- 需求：用户问「为什么和我用在 deepseek harness 里的差这么多」，检查定位三大差异：①模型配置——DSH 用 deepseek-v4-flash + reasoningEffort max，桌面端默认 deepseek-chat 且请求体无推理参数（同 key 实测 v4-flash 带内部推理、输出更自然）；②对话行为——DSH 模型完全自主，桌面端第 12 轮仍是本地正则路由 + expectRef 状态机；③人设/流程——DSH 预设 persona 对话与创作一体。用户确认「全面对齐优化」。
- 改动点：①Rust chat.rs 默认模型 deepseek-chat → deepseek-v4-flash，请求体带推理参数（兼容策略实测后定，如仅 v4 系发送）；resolve_config 相关单测同步；②前端设置默认模型同步 v4-flash；③persona 统一为「对话+创作一体」人设（模型自主判断闲聊/答疑/创作、创作模糊时自然反问、产出走 ```html 协议），App 删除本地创作/对话路由与 expectRef 状态机；needs.ts 分类器降级仅供模拟端近似模型判定；④chat.ts 模拟端按「创作意图 or 上一条反问过」自主近似；⑤知识库结构不动（第 13 轮 wechat-mp 设计已排除发布/复盘类，desktop 三层即创作知识面）。
- 验收标准：E2E 全绿（S9a 反问成文/S9b 直接写/S9c 闲聊/S9d 反问后"算了"取消 语义保持，S1-S8 回归）；pnpm build exit 0；cargo 单测更新后全绿 + live 冒烟（真实 v4-flash 流式、内容完整）；文档同步 + 提交；release 重建。
- 状态：✅ 完成（Rust 默认模型 deepseek-v4-flash + 请求体 reasoning_effort max（实测对 chat/v4 双模型兼容）；App 删除本地创作/对话路由与 expectRef，统一 persona 模型自主判断（对话/答疑/创作/反问/取消全由模型决定）；persona 合并对话与创作能力并删 buildChatSystem；chat.ts 模拟端启发式近似模型自主；needs.ts 降级仅供模拟端；E2E 全绿 28 项零浏览器错误（S9a-d 语义保持）+ S1-S8 回归；pnpm build exit 0；cargo 17/17 + live 冒烟与整篇抽样（v4-flash 流式内容完整、16.7s 6919 字 0 issues）；release 重建含本功能）

### 2026-09-05｜第 12 轮：通用对话模式——去掉固定澄清卡，像通用智能体一样正常对话（形态已确认）
- 需求：用户验收第 11 轮后反馈「这不是一个可用的智能体，为什么会有该死的固定框，为什么不是跟一个通用智能体一样正常对话」。经 1 问确认形态 = **通用对话模式**：AI 像 DeepSeek/ChatGPT 一样正常聊天（闲聊、公众号写作答疑都自然回复）；只有明确说「写/生成推文」时才产出推文；创作信息不足时由 AI 在对话流里用自然语言反问（最多问 1 个关键问题，其余按合理默认推进，按默认推进时先在正文前一句话说明采用的默认），用户直接在输入框回答，不再有任何卡片/按钮框。
- 改动点：删除 components/ClarifyCard.tsx、.clarify-* 样式、pendingClarify 挂卡分流；App 改为「创作/对话」双路由（lib/needs.ts 增 isCreateRequest/isCancel，保留 evaluate 供模拟端判断反问）；persona.ts 增 buildChatSystem 通用对话人设（含「对话模式」标记），PERSONA_RULES 创作流程补「本条是对澄清的回答→直接产出；仍缺关键信息最多再问 1 个问题；按默认推进先一句话说明默认」；chat.ts 模拟端支持对话/反问/成文三类回复（上一条助手回复含？且本条为回答→直接成文）；第 11 轮的「需求确认/默认」注入注取消，改为对话即契约 + 模型开头一句话默认说明；ChatPane 移除卡片槽，空态/占位/示例芯片改对话式文案；E2E S9 重写为 S9a 反问成文 / S9b 直接写 / S9c 闲聊 / S9d 反问后取消。
- 验收标准：E2E 全绿（S1-S8 回归 + S9a-d）；pnpm build exit 0；Rust 零改动（cargo 回归）；发布包重建；文档同步 + 提交。
- 状态：✅ 完成（E2E 全绿 28 项零浏览器错误：S9a 模糊创作"帮我写一篇推文，主题是新书上市"→模型在对话流自然反问（含？、无 HTML/预览）→答"日系风格，800字左右"→直接成文质量通过；S9b 直接写→不问直出单回合；S9c "你好"→自然回复且不产出预览；S9d 反问后"算了"→取消不生成；S1-S8 全回归；ClarifyCard.tsx/.clarify-* 样式/挂卡分流删除；pnpm build exit 0；cargo 17/17 Rust 零改动）

### 2026-09-04｜第 11 轮：结构化需求澄清卡——桌面端体现 req-clarify 能力（形态已确认）
- 需求：用户批评"桌面端工具里没能体现出 req-clarify 的能力"。经 1 问确认形态 = **结构化澄清卡，确认后生成**：AI 收到请求先做需求评估（类型/风格/字数/调性/配图），已明确项展示、模糊项以选项补齐；点「确认并生成」后才产出推文；含"直接写/直接生成"等指令或演示话题时跳过澄清，但直接生成路径按 req-clarify"直接做也标注假设"附注需求默认。
- 改动点：新建 lib/needs.ts（assess 需求评估 + 默认注组装）+ components/ClarifyCard.tsx（分维度选项行 + 确认）；ChatPane 顶部渲染卡片；App send 分流（需澄清→挂卡不调 LLM；确认→拼装最终 prompt 走原链路）；E2E S9（模糊→卡片→确认→生成含确认注；直接写→不弹卡带默认注）。
- 验收标准：E2E 全绿（S1-S8 回归 + S9 两项）；已清晰请求不弹卡直接生成；pnpm build exit 0；Rust 零改动；文档同步 + 提交。
- 状态：✅ 完成（E2E 全绿 21 项：S9a 模糊请求弹卡不生成→选日系+适中→确认后生成含"需求确认"注；S9b 直接写不弹卡、消息附默认注；修 React key 冲突：applySession 恢复时提升 idSeq；pnpm build exit 0；Rust 零改动）

### 2026-09-04｜第 10 轮：界面体验修正——常驻会话栏 + 对话流净化（报告已确认）
- 需求：按需求报告 `docs/information/2026-09-04-context-rail-clean-chat.md`（方案 A）——①会话上下文改为**左侧常驻栏**（列表常驻、新建/切换/删除一步直达、当前高亮；顶栏「会话」按钮保留为折叠开关；≤1120px 初始折叠）；②**对话流净化**：助手气泡只显示 ```html 围栏外的说明文字（无说明则显示"已生成推文，见右侧预览"），HTML 不进气泡；每条助手消息提供「查看 HTML 源码」点击展开（默认收起、独立展开态）。
- 改动点：新建 components/SessionRail.tsx（顶栏弹层 SessionMenu 退役删除）；ChatPane 消息渲染拆分（lib/extract.ts 增 splitAssistant）；App 三栏布局 + railOpen 状态；CSS；E2E 选择器迁移与新增断言。
- 验收标准：气泡不含 ```html 与代码文本（E2E 断言）；点击「查看 HTML 源码」展开含 <section> 源码、再点收起；会话栏新建/切换/删除/高亮通过（S8 迁移）；pnpm build exit 0；Rust 零改动；文档同步 + 提交。
- 状态：✅ 完成（E2E 全绿：S1.7 气泡净化无代码文本/展开源码 1936 字符含 <section>/收起；S8 侧栏 1→2→1；S1-S7 全回归；pnpm build exit 0；SessionRail 三栏常驻、顶栏按钮折叠开关；SessionMenu 退役；报告 docs/information/… 已确认落盘）

### 2026-09-04｜第 9 轮：多会话上下文窗口（像 DSH 的会话/上下文切换）（开发中）
- 需求：用户反馈"没有项目的概念/上下文的概念，需要像 dsh 那样有不同的上下文窗口"——每个会话 = 独立上下文（独立消息历史/生成内容/模式/风格），支持：新建会话、会话列表切换、删除会话、当前会话自动保存与启动恢复；旧单会话 draft.json 自动迁移为第一个会话（不丢稿）。
- 改动点：Rust 单会话 draft.rs → 多会话 sessions.rs（workspace/sessions/<id>.json + state.json 当前会话指针，旧 draft.json 自动迁移）；前端 draft.ts → sessions.ts；会话菜单 UI（顶栏「会话」下拉：列表/新建/删除/当前高亮）；App 状态机 currentId（自动保存绑定当前会话）。
- 验收标准：Rust sessions 单测通过（roundtrip/迁移/删除回退当前）；E2E S8 多会话场景全绿（生成 A → 新建 B → 生成 B → 列表 2 条 → 切回 A 消息恢复 → 删 B 剩 1 并回退当前）；旧存档迁移测试；文档同步 + 提交。
- 状态：✅ 完成（Rust 17/17 含 sessions 4 项 roundtrip/标题规则/删除回退/旧 draft 迁移；E2E 全绿含 S8 1→2→1 新建独立内容/列表增长/切换/删除回退；修 StrictMode 双跑引导竞态（bootRef + 去 alive 门控）与数据就绪标记 data-ready；前端 draft.ts → sessions.ts，draft.rs 删除；发布包重建含本功能）

### 2026-09-04｜第 8 轮：发布刷新——含全功能的 release 重建 + 安装闭环复验（开发中）
- 需求：第 5 轮安装包不含第 6/7 轮功能（会话存档目录统一、应用内设置），重建含全功能 release 并复验安装/卸载闭环；交付最终产物。
- 验收标准：tauri build --bundles nsis 成功；静默安装 → 安装版启动存活 → 卸载 exit 0 目录清理；文档同步 + 提交。
- 状态：✅ 完成（全功能 release 重建成功（32s，含第 7 轮设置）；静默安装 exit 0 → 安装版启动存活 → 卸载 exit 0 目录删除；清理 resolve_api_key dead_code；cargo 16/16 无警告）

### 2026-09-04｜第 7 轮：应用内 API 设置——彻底脱离 ~/.dsh（开发中）
- 需求：桌面端对外分发后不应依赖用户机器上的 ~/.dsh 凭据：应用内「设置」面板可配置 API Key/端点/模型，存到工作区 settings.json（env > 应用设置 > 旧 ~/.dsh 兼容回退）；浏览器模式存 localStorage。
- 改动点：src-tauri/settings.rs（读写 workspace/settings.json + 命令）；chat.rs 配置解析优先级重构（env > settings > ~/.dsh）；前端 SettingsPanel（顶栏入口，Key 掩码输入、模型/端点、保存/恢复默认）。
- 验收标准：settings 单测通过（roundtrip/优先级纯函数）；E2E 设置场景（浏览器：填入保存 → 刷新 → 值仍在 → 恢复默认清空）；cargo test 全绿；文档同步 + 提交。
- 状态：✅ 完成（Rust 16/16 含 settings roundtrip/损坏默认 + pick_key 优先级（修空白 env 处理）；E2E 七场景全绿含 S7 设置保存→刷新持久→恢复默认；chat_stream 走 resolve_config env>settings>~/.dsh；窗口重启含 6 命令）

### 2026-09-04｜第 6 轮：安装器真实验证——静默安装/启动/卸载闭环（开发中）
- 需求：对第 5 轮 NSIS setup 做端到端真实验证：静默安装到用户目录 → 安装产物存在且可启动 → 静默卸载 → 目录清理。
- 验收标准：安装 exit 0 且 exe 落盘；安装版启动冒烟通过；卸载 exit 0 且安装目录删除；文档同步 + 提交。
- 状态：✅ 完成（setup /S /D 静默安装 exit 0 → exe 落盘 → 安装版启动存活 → uninstall /S exit 0 → 安装目录删除；RELEASE-NOTES 验证基线补齐发布闭环）

### 2026-09-04｜第 5 轮：发布打包——独立安装版（tauri build）（开发中）
- 需求：产出可脱离开发环境的独立安装包（NSIS exe 安装器 + 免安装可执行产物验证），验证发布产物可启动。
- 验收标准：`pnpm tauri build --bundles nsis` 成功；产物存在于 src-tauri/target/release/bundle/；发布 exe 启动冒烟（进程存活后关闭）；文档同步 + 提交（产物不入库）。
- 状态：✅ 完成（build 成功：release exe 12.2MB + NSIS setup 3.7MB wechat-mp-desktop_0.1.0_x64-setup.exe；release exe 启动冒烟通过 78MB 后关闭；清理 draft.rs dead_code 警告；RELEASE-NOTES.md 发布说明；回归 13/13）

### 2026-09-04｜第 4 轮：会话自动存档/恢复 + 工作区目录统一 + 真实模型整篇抽样（开发中）
- 需求：①对话自动存档（消息/模式/风格/HTML），启动恢复，顶栏显示"已自动保存 HH:mm"，「新对话」清空并落盘；②统一工作区目录 `文档/wechat-mp-workspace/`（exports/ 导出 + draft.json 存档）；③真实模型整篇推文输出抽样（live 冒烟扩展：按 persona 规则产出一整篇，软断言结构完整）。
- 验收标准：Rust draft 单测通过（roundtrip/损坏容错/目录统一）；E2E 新增恢复场景（S1 后刷新页面 → 会话仍在 + 预览恢复 + 清空生效）；pnpm build exit 0；文档同步 + 提交。
- 状态：✅ 完成（Rust 13/13 单测含 draft 3 项 roundtrip/缺失 None/损坏改名 .corrupt；E2E 四场景全绿含 S1.6 刷新恢复 + 清空清存储；真实模型整篇抽样 live_article_sample：3753 字 0 issues；导出目录统一为 文档/wechat-mp-workspace/exports/；窗口自动重启含 4 命令）

### 2026-09-04｜第 3 轮：导出 HTML 文件 + 知识库懒加载减包（开发中）
- 需求：①「导出」按钮：Tauri 模式经 Rust 命令保存到 `文档/wechat-mp-exports/`（无敏感路径、文件名消毒、返回完整路径展示）；浏览器模式走 <a download> 下载；②知识库从 eager 全量内联改为懒加载（首屏后异步加载），打包体积下降（2.4MB → 数百 KB）。
- 验收标准：cargo 新增命令单测通过（写盘内容一致/文件名消毒）；E2E 增加导出场景（浏览器 download 事件拿到文件且内容含 <section>）；pnpm build 产物体积显著下降；文档同步 + 提交。
- 状态：✅ 完成（Rust 10/10 单测含 export 4 项；E2E 全绿含 S1.5 导出下载 tuiwen-*.html 2254B；主包 2388kB → 236kB(gzip 75kB)，知识条目拆 149 懒加载 chunk；窗口自动重启含新命令）

### 2026-09-04｜第 2 轮：生成体验产品化——类型/风格选择注入 + 输出质量检查护栏（开发中）
- 需求：①对话侧提供「模式(自动/文字/宣传) + 风格(自动/校园/科技/国潮/日系/极简/商务/手账/…)」快速选择，选择随请求注入提示词（风格知识由检索自动命中）；②对助手产出的 HTML 做客户端质量检查（零 emoji/零图标字符、无 style/script 标签、无 linear-gradient/box-shadow、无外链图），预览栏显示「质量检查:通过/问题清单」；③本地模拟增加一个含违规的演示话题，E2E 双向验证通过/检出两条路径。
- 验收标准：E2E 全绿（干净样本 → 检查通过；违规样本 → 检出问题并展示清单）；pnpm build exit 0；文档同步 + 提交。
- 状态：✅ 完成（E2E 双向全绿：S1 质量通过 / S2 检出 4 项问题 emoji+gradient+shadow+external-img；截图 verify-artifacts/wxmp-desktop-ok.png 与 -fail.png；pnpm build exit 0；commit 待执行）

### 2026-08-29｜第 1 轮：桌面双栏骨架 + 极简智能体链路（开发中）
- 需求：可运行的 Tauri 桌面应用骨架：左对话右预览；底座 = 极简智能体（persona + 知识检索 + 流式对话），真实调用 DeepSeek 生成推文 HTML 并在右侧实时渲染。
- 改动点：Tauri 2 + React 19 脚手架；`src/lib/`（persona/retrieval/chat/extract）；组件 ChatPane/PreviewPane；Rust `chat.rs`（密钥解析、SSE 流式、事件推送）；知识语料 `src/knowledge/`（三层 149 文件，从 wechat-mp/test/knowledge 拷贝）；验证脚本 verify-ui.mjs。
- 验收标准：①纯浏览器模拟链路 E2E 全绿（示例→流式→HTML 围栏提取→375px 预览渲染，playwright 截图存证）；②Rust 单测 6 项全过 + live DeepSeek 冒烟返回成功；③`pnpm tauri dev` 桌面窗口可启动；④四文件体系 + 需求登记落盘。
- 状态：✅ 完成（E2E 4/4 PASS、Rust 单测 6/6 + live 冒烟 OK、tauri dev 编译通过；截图 verify-artifacts/wxmp-desktop-ui.png）

### 2026-08-29｜第 0 轮：项目初始化（完成）
- 需求：建立独立桌面项目（四文件体系 + git 仓库 + Tauri 脚手架 + 知识语料内嵌）。
- 状态：✅ 完成（四文件 + REQUIREMENTS + README + .gitignore；create-tauri-app react-ts；知识语料 149 文件入 src/knowledge；pnpm 11 esbuild 许可；git init）
