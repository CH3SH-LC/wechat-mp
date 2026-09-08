# 公众号推文助手桌面版 开发进度（精简版）

> 标签：[New Feature] 新功能 / [Debug] 修复 / [Change] 变更 / [Build] 构建
> 详细记录见 PROGRESS.md

---
## 2026-09-08
- [New Feature] 第 32 轮：自动质检自检（"能检测到组件不足就是不做"，口径确认=检出即自动重写到合格）+ 修叠稿——真实会话 21:20 定位：修订回合助手同一消息叠两篇 v2、预览只取首篇→差稿(组件化不足)进预览好稿被吞、warning 从不驱动修正。改 extract v2=末围栏 + collapseAssistantDraft 归一叠稿、新增 revise.ts(fixableWarnings 五类可修项/buildReviseContent/REVISE_MARKER/上限2)、App turn 尾段改有界自检回路(检出可修项→喂回模型重写同一气泡,纯产物门禁无对话状态机)、chat mock 自检触发/修订返回、verify-ui 新增 S10；验证:tsc/build/cargo 42/compose-check/E2E S1-S10 全绿(修复 note 闭包旧值回归)、extract/revise 单测过、真实模型 LIVE-REVISE OK(单围栏+组件化不足消除容器3)、release 重建(exe14.9+setup4.3)冒烟 OK
- [Debug] 第 31 轮：修复"依旧无法生成美术资产"（真实会话审计 + 口径确认驱动）——根因：28 轮口径 A 一刀切"给真实照片→只留 ::: photo 不写 [[img]]"，凡要照片的推文只剩空照片框零装饰插画；且 live-conformance 场景 A / compose photoUsed 只查"占位合规"从不查"有没有插画"，3 次复发未被拦。用户口径确认"照片位+装饰插画都要"。改 engine-write-protocol §二/§三.3 为并存口径（照片=信息画面留位、插画=版面装饰照配，照片多时插画 2-5 处）、persona 澄清配图来源措辞、compose 纯照片位软提示缺装饰插画、live-conformance 场景 A 断言 photo≥1 且 [[img]]/[[deco]]≥1、compose-check 增并存断言；验证：tsc/build/cargo 42/E2E/compose-check 全绿；live-conformance CONFORM OK（A 场景产出 photo=6+[[img]]=4+[[deco]]=1 并存 / B 无照片零照片位）；release 重建（停用户运行实例后 exe 14.9MB+setup 4.3MB）启动冒烟 OK
- [Debug] 第 30 轮：修复"又生成不了美术素材"（真实持久化会话审计驱动）——四根因：①SSE 每 chunk 独立 from_utf8_lossy 劈开中文→U+FFFD 乱码（重构字节缓冲按完整行解码 + 2 单测）；②prep 空回复（v4-flash 推理吃光 1200 预算）把兜底话术当正式回复泄漏（msg24/28）→ 空回复重试 + prep max_tokens 3200；③引擎协议只在 prep.ready 附加，创作会话延续句（needPrep=false）上下文无协议→模型写【照片位N】纯文本而非 ::: photo（新增 creativeSession 强制注入协议）；④gen_svg 瞬态空结果加原样重试。验证：tsc/build/cargo 42/compose/E2E 全绿；live-conformance CONFORM OK（A/B）；真实链路复刻 REGRESSION OK（C 澄清链无兜底泄漏收敛 ready / D 延续句注入协议产出 7 ::: photo 0 乱码渲染虚线占位）；release 重建补记
## 2026-09-07
- [Change] 规则：用户明确"每次更新都要更新桌面版 release"——CLAUDE.md 新增铁律 7 + REQUIREMENTS 〇节 2（永久禁令）：代码变更验证后必 tauri build 重建 release + 冒烟（29 轮曾漏建，已补）
- [Build] 第 29 轮后全功能 release 重建——pnpm tauri build --bundles nsis（2026-09-08 00:15）：release exe 14.9MB + setup 4.3MB（含第 29 轮全部改动）；release exe 启动冒烟存活后关闭 OK
- [Change] 第 29 轮：注入内容审阅改造（docs/ai-context 审阅驱动）——persona 精简至 ~30% 通用助手化、工艺细则迁新知识点 排版引擎/engine-write-protocol（注册表置顶 + App digest 兜底）；prep 必取引擎协议 + 澄清理解型可跨轮 + WRITE 允许正文前说明（2.1/2.2）；SVG 提示复杂度契约（分层/明暗/材质/细节密度）+ gen_svg CLARIFY 有界回问（新增 refine_brief 命令）；ChatPane 删用户可见 mock、verify-ui 改 sendPrompt 文本驱动；live-conformance 注入引擎协议 + 修历史累积 bug；tsc/build/compose/cargo 40/E2E 全绿；真实模型 CONFORM OK（A 校园 7 照片位 / B 插画 0 照片位，0 泄漏）
- [New Feature] 第 28 轮：真实产物合格性修复 + 验收闸门（实机审计驱动）——风格名归一（校园风→校园）；::: photo 照片位（口径 A，预览虚线占位、抑制无素材误报）+ persona 配图来源分支；prep 3 轮不收敛降级直接撰写（不再把兜底话术当回复）；新增 scripts/live-conformance.mjs 真实模型合规闸门——A 照片位/B 插画双场景全绿；build/compose/E2E/cargo 38 全绿
## 2026-09-06
- [Build] 第 27 轮后全功能 release 重建——pnpm tauri build --bundles nsis：release exe 14.2MB + setup 4.1MB（2026-09-06 23:46）；启动冒烟存活后关闭 OK；含到第 27 轮全部功能
- [Change] 第 27 轮：全项目结构重构（零行为变化）——删旧 retrieve/三层任务路由死代码与休眠 chat-error 监听、清理遗留模式/风格 CSS、修复 SSE EOF 无尾换行残留不解析（O-8，补 sse_tail_delta 单测）；cargo 38 + build/compose/E2E/app 编译全绿
- [Change] 第 23-25 轮真实模型 live 闭环（联网）：模糊→多维度澄清（不产出）；明确→模型自选 load 4 点文件→digest 流式成稿 3422 字 v2（无 400）；gen_svg 改专用 deepseek-chat（v4-flash 画图推理失控），11s 直出 53 元素具体 SVG；cargo 36/36 + live 4/4 + build/compose/E2E 全绿
- [New Feature] 第 26 轮：微信草稿箱发布——publish.rs（token 缓存/素材上传替换 data 图/draft.add）+ 公众号配置区块 + 桌面发布按钮；cargo 37 过（含本地假微信服务器端到端契约单测）+ build/compose/E2E/app 编译全绿；真实微信接口 LIVE-PENDING（封面/字段待测试号核对）
- [New Feature] 第 25 轮：知识注册表 + 工具按需取用——system 只注入 ≤3500 字注册表目录；Rust prep_turn（tools/tool_calls）让模型创作前置自选读哪些点，取完 READY 再带工具结果流式成稿；cargo 26 过 + build/compose/E2E 全绿；live 待联网
- [Change] 第 24 轮：素材改图像子智能体——主模型只写图位占位（[[img:…]]/[[deco:…]]），Rust gen_svg 非流式按描述画具体插画，前端 materialize 替换 ::: art 块再 compose+PNG；浏览器 mock 样例池近似；cargo 26 过 + E2E 全绿（占位全替换断言）；live 待联网
- [Change] 第 23 轮：界面删模式/风格控件、类型风格交 LLM 自决；创作前需求全澄清（v5）；风格不限预置（[[palette]] 自定义色板渲染，未收录名回退警告）；busy 分"思考·生成"两档；统一 1500-2500 字口径；build/compose/E2E 全绿（新增 palette/未知风格/S1.9）；live 待联网
- [Change] 撰写按理解还原的需求文件 docs/REQUIREMENTS-understanding.md——通读四文件+源码三层（前端/Rust/管线）后重建现状需求规格（定位/架构/FR/NFR/领域模型 + 10 条代码观察待议）；非轮次登记册
- [Change] 依用户 8 项意见把需求文档修订为目标态（v2，仅改文档不动代码）：发布直达公众号草稿箱▲ / 创作前需求全澄清▲ / 删模式·风格控件改 LLM 自决 / 风格不限于预置▲ / busy 分"思考·生成"两档▲ / 知识改"注册表+工具按需调用"▲ / 素材改图像子智能体产出▲；落点见附录 A 对照表
## 2026-09-05
- [Change] 第 22 轮：整理散落验证产物归档——docs/artifacts 收纳 E2E 截图/compose/注入/风格样例 19 个（工作区 verify-artifacts 迁入，其余项目产物保留原位）；verify-ui/compose-check 默认输出改项目内；STRUCTURE/REQUIREMENTS 同步
- [Change] 第 21 轮：素材具体插画化 + 正文加长 + 气泡角饰——素材铁律 v4（具体可辨认插画/明暗层次/禁几何剪影）、正文默认 1500-2500 字、气泡 KEY/TIP/DANGER 必带 ::: art deco 角饰；compose 支持 deco 定义/引用/未定义与偏短警告；chat.rs max_tokens 64000；compose-check 41 项 + E2E 41 项全绿；live 1518 字 + 双气泡角饰 + 7 处具体插画（元素 16-41）0 警告
- [Change] 第 20 轮：风格选型教程注入 + 反模板化（"只有风格参考没有风格选择教程，全国潮模板"）——auto 创作注入风格速查（00-索引：内容类型→首选/备选），persona 规则 v3（先选型再声明、风格=皮肤禁模板复刻）；E2E 40 项全绿（S8 风格速查命中）；真实三场景 auto：咖啡→日系/科技→科技/节日国货→国潮，差异化非复刻
- [Change] 第 19 轮：三层数据库按任务路由注入（"我需要的就是最终的三层数据库"）——retrieval 升级：类型→type/copy-tpl、风格→style 全文、营销→合规红线，路由文件 8000 字、主题词优先；persona 注入即权威 + auto 强制声明 theme；E2E 39 项全绿（S8 路由命中断言）；真实注入对比：4 点文件 23.6KB 注入 → 促销模板+国潮库色素材（5 处 0 警告）
- [Change] 第 18 轮：撤销前端对话状态机（用户永久禁令"绝对禁止"）——删 App askRef/CLARIFY_SYSTEM 澄清回合与 needs 前端导入，send 直通模型自主；禁令写入 CLAUDE.md 铁律第 6 条 + REQUIREMENTS「〇、永久禁令」；E2E 全绿；第 17 轮文案/组件化/风格三项保留
- [Change] 第 17 轮：四项质量修复（文案克制/组件必用/强制询问/风格落地）——palettes.ts 8 风格主题表（知识库色板）+ compose theme（UI 优先/正文 [[theme]] 声明/底色）+ persona 语气与结构规则 + App 强制澄清回合状态机（缺 ≥2 先问再写）+ 组件化引擎校验；E2E 37 项全绿（S1.8 主题色）；真实模型 live 国潮主题渲染落地、文案克制；Rust 零改动
- [Change] 第 16 轮：素材用量升级——组件装饰全覆盖（用户："量太少，每个组件都必须使用美术素材"；1 问确认口径）——persona 铁律 v2（每篇 5-8 处、banner/小节/气泡/分隔/容器装饰位全覆盖、单屏 ≤1）；compose 引擎 0/<4 处用量警告；mock ×5 素材；chat.rs max_tokens 32000（推理吃光 16k 实测）；E2E 33 项全绿（S1.8 five art assets）；真实模型 live 6 处素材全达标 0 警告
- [New Feature] 第 15 轮：现场生成美术素材（回应"为什么没素材了"）——::: art 容器：模型按知识库现场绘制 SVG，引擎校验元素 ≥6 与 viewBox，canvas 渲染 PNG data URI 内嵌预览/导出；persona 强制每篇 ≥1 素材；E2E 32 项全绿（S1.8 素材渲染 data 图）；真实模型 live 咖啡题材 SVG 15 元素 0 警告
- [New Feature] 第 14 轮：移植 DSH 完整创作工艺（方案 B，用户选）——compose.ts 转写 wechat-mp 转换器（v2 语法→微信合法 HTML，DESIGNS 双色系/间距 v5/平面化 v10/art 移除警告）；persona 改输出 ```v2 围栏正文；```v2→compose→预览+质量检查，```html 直通保留；会话恢复重放；修复 reasoning max 无 max_tokens 推理吃光预算（补 16000）；E2E 31 项全绿（新 S1.8 compose 渲染断言）；真实模型 live 产出 900 字 v2 正文渲染 0 警告
- [Change] 第 13 轮：与 DSH 全面对齐（差异检查驱动）——Rust 默认模型 deepseek-chat→deepseek-v4-flash + 请求体 reasoning_effort max（实测兼容）；删除 App 本地创作/对话路由与 expectRef，persona 统一为对话+创作一体、模型自主判断（闲聊/答疑/反问/取消）；needs 降级仅供模拟端近似；E2E 28 项全绿 S9a-d 语义保持；live 冒烟 + 整篇抽样（v4-flash 16.7s 6919 字 0 issues）
- [Change] 第 12 轮：通用对话模式（用户否决固定澄清卡）——删除 ClarifyCard 与挂卡分流；请求路由为「创作/对话」两类：明确写推文才进入创作（信息不足由 AI 在对话里自然反问、回答后直接产出；"算了"取消），闲聊/答疑走通用对话人设正常聊天；需求默认注改为模型正文前一句话说明；模拟端三类回复；E2E 28 项全绿含 S9a 反问成文/S9b 直接写/S9c 闲聊/S9d 反问后取消；Rust 零改动
## 2026-09-04
- [New Feature] 第 11 轮：结构化需求澄清卡（req-clarify 落地）——五维度需求评估（类型/风格/字数/调性/配图），缺≥2 弹卡选项补齐、确认后生成；直接写/演示话题跳过但附需求默认注；修会话恢复 React key 冲突（idSeq 提升）；E2E 21 项全绿含 S9a/S9b；Rust 零改动
- [Change] 第 10 轮：常驻会话栏 + 对话流净化（需求报告驱动）——SessionRail 左侧栏（顶栏按钮=折叠开关，SessionMenu 退役）；气泡只显说明文字（splitAssistant），HTML 收进「查看 HTML 源码」展开（默认收起）；E2E 全绿含新 S1.7 三项断言 + S8 侧栏 1→2→1；Rust 零改动
- [New Feature] 第 9 轮：多会话上下文窗口（像 DSH）——sessions.rs（sessions/<id>.json + state.json，旧 draft.json 自动迁移不丢稿）+ 会话菜单（新建/切换/删除/当前高亮）+ App currentId 状态机（自动保存绑定当前会话）；修 StrictMode 双跑引导；Rust 17/17；E2E 全绿含 S8 1→2→1；release 重建
- [Build] 第 8 轮：全功能 release 重建（含 1-7 轮功能，32s）+ 安装闭环复验（装/启/卸 exit 0）；清理 dead_code；cargo 16/16 无警告——最终交付产物 setup.exe
- [New Feature] 第 7 轮：应用内 API 设置——顶栏设置面板（Key 掩码/端点/模型，settings.json/localStorage），密钥解析 env>设置>~/.dsh 兼容回退（pick_key 纯函数）；Rust 16/16；E2E 七场景全绿含 S7 保存→刷新持久→恢复默认
- [Build] 第 6 轮：安装器真实验证——setup 静默安装 exit 0 → 安装版启动存活 → 卸载 exit 0 目录清理，发布闭环完成
- [Build] 第 5 轮：发布打包——tauri build --bundles nsis 成功（release exe 12.2MB + setup 3.7MB），release exe 启动冒烟通过；RELEASE-NOTES.md 发布说明；清理 dead_code；回归 13/13
- [New Feature] 第 4 轮：会话自动存档/恢复（draft.rs→文档/wechat-mp-workspace/draft.json 损坏容错，浏览器 localStorage；防抖自动保存+流结束即存+顶栏已自动保存；E2E S1.6 刷新恢复/清空清存储通过）+ 导出目录统一 workspace/exports + live_article_sample 真实整篇抽样（3753 字 0 issues）；Rust 13/13
- [New Feature] 第 3 轮：导出 HTML（Rust export.rs 写 文档/wechat-mp-exports/ 文件名消毒，10/10 单测；浏览器 <a download>；E2E S1.5 下载 2254B 通过）+ 知识库懒加载减包（主包 2388kB→236kB gzip 75kB，149 懒加载 chunk）；E2E 三场景全绿，窗口自动重启含新命令
- [New Feature] 第 2 轮：生成体验产品化——模式/风格选择注入提示词并参与检索 + 输出质量检查护栏（quality.ts：零 emoji/零渐变/零阴影/无 style-script-外链图检查）；预览栏质量条 q-ok/q-fail；E2E 双向全绿（S1 通过 / S2 违规样本检出 4 项问题），截图 wxmp-desktop-ok.png/-fail.png
## 2026-08-29
- [New Feature] 第 1 轮：桌面双栏骨架 + 极简智能体链路——Tauri2+React19 脚手架（1380x880「公众号推文助手」）、src/lib（persona/知识检索/双通道 chat/HTML 提取）、ChatPane+PreviewPane(375px 手机壳 iframe)、Rust chat.rs（env/.dsh 密钥解析+SSE 流式+chat-delta 事件，6 单测+live 冒烟 OK）、知识语料 src/knowledge 三层 149 文件、verify-ui.mjs E2E 4/4 PASS（截图 verify-artifacts/wxmp-desktop-ui.png）；tauri dev 窗口启动确认
- [Build] 第 0 轮：项目初始化——create-tauri-app react-ts、四文件体系+REQUIREMENTS+README+.gitignore、pnpm11 esbuild 许可、git init；踩坑：pnpm 只读 pnpm-workspace.yaml、playwright/chromium 版本不匹配用 executablePath、验证条件误用按钮禁用态
