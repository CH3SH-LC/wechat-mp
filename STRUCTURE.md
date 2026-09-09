# wechat-mp-desktop 项目结构

> 最后更新：2026-09-09
> 新增、删除、重命名文件或目录时必须同步更新本文件。

---
## 顶层结构
wechat-mp-desktop/
├── CLAUDE.md              # 工作区入口指令
├── README.md              # 项目说明（开发命令/密钥说明）
├── STRUCTURE.md           # 本文件
├── PROGRESS.md            # 详细开发进度
├── PROGRESS-LITE.md       # 精简开发进度
├── REQUIREMENTS.md        # 需求登记册（逐轮登记）
├── index.html             # Vite 页面入口（lang zh-CN，无图标请求）
├── package.json           # pnpm 前端依赖与脚本
├── pnpm-workspace.yaml    # pnpm 11 构建许可（esbuild）
├── tsconfig.json / tsconfig.node.json  # TypeScript 配置
├── vite.config.ts         # Vite 配置（端口 1420 strictPort，Tauri 专用）
├── public/                # 静态资源（空占位）
├── scripts/
│   ├── verify-ui.mjs      # E2E 冒烟：对话/创作/预览断言+截图（playwright；S1-S12 回归 + S13 素材工坊 + S14 素材复用/固化/改版影响）
│   ├── compose-check.mjs  # composeMarkdown 转换器断言（node 直跑 TS）
│   ├── compose-cli.mjs    # 命令行 compose：md → html（真实模型产物验证用）
│   ├── live-knowledge-probe.mjs # 三层知识路由注入的真实模型验证（读库点文件 → persona → 模型 → compose）
│   ├── live-style-choice.mjs    # 风格选型验证（同质注入 × 三主题，检查 theme 选择与反模板化）
│   └── live-conformance.mjs # 真实模型合规验收闸门：A 照片位+装饰插画并存 / B 无照片纯插画 + V3-R3 场景 C 素材库清单→[[asset]] 复用（真机跑）
├── docs/
│   ├── REQUIREMENTS-understanding.md  # 需求文档（目标态，2026-09-06 依 8 项意见修订；▲ 标未实现待迭代）
│   ├── information/     # 需求报告（…quality-r17.md、knowledge-routing.md、style-choice.md、art-concrete.md、2026-09-09-v3-docs-assets-design.md V3 大版本设计：文档化+素材库+素材智能体分离）
│   ├── ai-context/      # 注入内容对照（persona/prep 壳/素材智能体提示/mock 说明；V3-R3 已同步 search_assets 与素材库复用条款）
│   └── artifacts/       # 验证产物归档（E2E 截图 + compose/注入/风格选型样例；verify-ui/compose-check 默认输出至此）
├── src/                   # 前端源码
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主布局：顶栏(对话/文档库 页签)+ 对话/文档库工作区；状态中枢（V3-R1：turn 尾段终稿自动落文档、applySession 文档快照恢复）
│   ├── App.css            # 全局样式（顶栏/对话/预览/手机壳 + V3-R1 view-tabs/docs-pane）
│   ├── components/
│   │   ├── ChatPane.tsx   # 左中栏：消息流（净化+源码展开+busy 两档）+ 输入（无模式/风格控件、无 mock 演示按钮）
│   │   ├── PreviewPane.tsx# 右栏：375px 手机壳 iframe 预览 + 质量条 + 缩放/复制/导出图片/导出HTML/清空（第34轮去发布草稿箱按钮）
│   │   ├── SessionRail.tsx# 左侧常驻会话栏：列表/新建/切换/删除/当前高亮
│   │   ├── DocsPane.tsx   # V3-R1 文档库工作区：自动保存的推文文档列表/打开/删除
│   │   ├── AssetWorkshop.tsx # V3-R2 素材工坊工作区：选分类→素材智能体制作入库→语义元数据编辑→检索→替换源(version+1)→删除→影响扫描逐篇"用新版更新"
│   │   └── SettingsPanel.tsx # 设置弹层：API Key/端点/模型，保存/恢复默认
│   ├── lib/
│   │   ├── compose.ts     # v2 排版语法 → 微信合法 HTML 确定性转换器（::: art 素材 + ::: photo 照片位 + 校验）
│   │   ├── palettes.ts    # 风格主题表（知识库 8 风格色板：日系/国潮/校园/科技/极简/商务/手账/森系）
│   │   ├── artRender.ts   # SVG 素材 → PNG data URI（canvas 2x；回退 svg data URI）
│   │   ├── htmlToImage.ts # 第34轮 正文 HTML→图片：375px 版式 foreignObject 2x 光栅化 → 长图 + 按屏分页 PNG
│   │   ├── exportImages.ts# 第34轮 导出图片桥：Tauri→export_images 落盘开目录 / 浏览器→逐张下载
│   │   ├── image-agent.ts # 素材解析器(V3-R3)：[[asset:分类|名称|用途]] 库引用解析 + 传统占位先检索库（强命中才转引用）→ 未命中委托素材智能体 gen_svg（桌面现场补做自动入库 origin=article-fallback）；mockArtSvg 样例池
│   │   ├── asset-library.ts # V3-R2 个人素材库双通道（Tauri assets 命令 / 浏览器 wxmp-assets-v1）：八类分类表 + CRUD + bigram 语义检索（风格软参考）+ sanitizeName
│   │   ├── asset-agent.ts # V3-R2 素材智能体编排：kindForCategory + generateAssetSvg + makeWorkshopAsset（校验后入库）
│   │   ├── persona.ts     # 统一系统提示词（V3-R3：创作段配图条款——不手写 SVG、有素材库清单先 [[asset]] 复用）
│   │   ├── needs.ts       # 请求启发式（浏览器 mock 近似 + isCreateRequest 真实桌面 prep 触发判定）
│   │   ├── retrieval.ts   # 知识取用：懒加载 + buildRegistry(注册表，≤3500 字，排版引擎组置顶) + loadEngineProtocol + runKnowledgeTool
│   │   ├── prep.ts        # 创作前置工具循环：runPrep + PREP/WRITE_INSTRUCTION（理解型澄清/允许正文前说明；空回复重试不泄漏兜底话术）
│   │   ├── chat.ts        # 对话通道：Tauri→Rust 流式 / 浏览器→本地 mock（内部测试桩；第32轮 REVISE_MARKER/缺组件样稿；V3-R3 增"素材库复用"样本 [[asset]] 引用）
│   │   ├── extract.ts     # 围栏解析：extractHtml(html 直通) + splitAssistant(prose/code/v2=末个围栏) + collapseAssistantDraft(叠稿归一)
│   │   ├── revise.ts      # 第32轮 自动质检自检：fixableWarnings(六类可修项，V3-R3 增 库素材引用缺失) + buildReviseContent + REVISE_MARKER/MAX_AUTO_REVISES=2（产物质量门禁，非对话状态机）
│   │   ├── quality.ts     # 输出 HTML 质量检查（零 emoji/渐变/阴影/外链图/style 标签）
│   │   ├── exportHtml.ts  # 导出：Tauri→export_html 命令 / 浏览器→<a download>
│   │   ├── sessions.ts    # 多会话：Tauri→sessions 命令 / 浏览器→localStorage（含旧键迁移）
│   │   ├── documents.ts   # V3-R1 推文文档：Tauri→documents 命令 / 浏览器→localStorage wxmp-docs-v1（终稿自动落盘/就地刷新/删除；V3-R3 snapshots 素材固化快照）
│   │   └── settings.ts    # API 设置 + 公众号配置（wx_appid/wx_secret）：Tauri→save/load_settings / 浏览器→localStorage
│   └── knowledge/         # 知识语料（文本/视觉/插图/其它 + 00-GUIDE/design-logic + 排版引擎协议）
│       ├── 00-GUIDE.md    # 三层路由总表
│       ├── design-logic-components.md
│       ├── 排版引擎/      # engine-write-protocol.md（桌面 compose v2 引擎协议：语法/素材引用[[asset]]与占位/风格/审美 + 第33轮 §四.5/6 小标题/气泡写法要点）
│       ├── 文本/ 视觉/ 插图/ 其它/   # 四方面 + 各方向 00-索引 + 点文件
└── src-tauri/             # Rust 后端
    ├── Cargo.toml         # 依赖：tauri2/reqwest(rustls)/serde + dev tokio
    ├── tauri.conf.json    # 窗口 1380x880「智序 · 公众号推文助手」；productName 智序（发布轮品牌化）；bundle.resources 打包 使用手册.html
    ├── capabilities/default.json  # core:default（含事件监听）
    ├── resources/         # 发布轮：随安装包发布的资源
    │   └── 使用手册.html   # 面向无技术背景用户的中文图文手册（单文件 HTML，应用内「使用手册」按钮打开）
    ├── icons/             # 应用图标
    └── src/
        ├── main.rs        # 入口（调 lib::run）
        ├── lib.rs         # Builder + 24 命令注册（chat_stream/gen_svg/refine_brief/prep_turn/export/open_manual/sessions/settings/documents/assets）+ WxTokenState setup
        ├── chat.rs        # LLM 客户端：resolve_config(env>settings>~/.dsh)、SSE 流式（字节缓冲按行解码防中文乱码）、gen_svg（V3-R2 增 divider/heading 分类 kind）、refine_brief、prep_turn（V3-R3 tools 含 search_assets）、单测+live
        ├── export.rs      # 导出 HTML + 第34轮 export_images（长图/分页 PNG 写 exports/img-*/并开目录，2 单测）
        ├── manual.rs      # 发布轮：open_manual 定位并打开随包《使用手册》（find_manual 兼容资源根/resources 两布局，3 单测）
        ├── documents.rs   # V3-R1 推文文档（documents/<id>/：meta+source.md+article.html，list/open/save/delete，6 单测；snapshots 素材固化字段）
        ├── assets.rs      # V3-R2 个人素材库（assets/items/<id>/：meta+source.svg；list/add/get/update(替换源 version+1+影响扫描)/delete，5 单测）
        ├── sessions.rs    # 多会话（workspace/sessions/<id>.json + state.json；旧 draft 迁移；5 单测）
        ├── settings.rs    # API 设置 + 公众号配置（workspace/settings.json，损坏→默认，2+ 单测）
        └── publish.rs     # 第26轮 微信草稿箱发布（休眠，UI 已撤）：access_token 缓存/素材上传/draft.add（9 纯函数单测；真实接口 LIVE-PENDING，第34轮起停用改图片手动上传）

## 当前核心事实
- 运行时：Node 24 / Rust 1.95；包管理器：pnpm 11（onlyBuiltDependencies esbuild）
- 前端构建：`pnpm build`（tsc && vite build）；桌面运行：`pnpm tauri dev`
- LLM：OpenAI 兼容接口，默认 https://api.deepseek.com/chat/completions，模型 deepseek-v4-flash（reasoning_effort max，与 DSH 一致；创作前置 prep_turn 用 tools/function-calling，省略 reasoning_effort；图像子智能体 gen_svg 专用 deepseek-chat，可 DEEPSEEK_IMAGE_MODEL 覆盖——v4-flash 画图推理失控）
- 密钥：env DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml
- 验证：`scripts/verify-ui.mjs`（playwright + 本机 chromium-1234）+ `cargo test`（含 `--ignored` live 冒烟）
