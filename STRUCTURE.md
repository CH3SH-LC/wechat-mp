# wechat-mp-desktop 项目结构

> 最后更新：2026-09-05
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
│   ├── verify-ui.mjs      # E2E 冒烟：对话/创作/预览断言+截图（playwright）
│   ├── compose-check.mjs  # composeMarkdown 转换器断言（node 直跑 TS）
│   ├── compose-cli.mjs    # 命令行 compose：md → html（真实模型产物验证用）
│   ├── live-knowledge-probe.mjs # 三层知识路由注入的真实模型验证（读库点文件 → persona → 模型 → compose）
│   └── live-style-choice.mjs    # 风格选型验证（同质注入 × 三主题，检查 theme 选择与反模板化）
├── docs/
│   ├── information/     # 需求报告（…quality-r17.md、knowledge-routing.md、style-choice.md、art-concrete.md）
│   └── artifacts/       # 验证产物归档（E2E 截图 + compose/注入/风格选型样例；verify-ui/compose-check 默认输出至此）
├── src/                   # 前端源码
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主布局：顶栏 + 对话栏 + 预览栏；状态中枢
│   ├── App.css            # 全局样式（顶栏/对话/预览/手机壳）
│   ├── components/
│   │   ├── ChatPane.tsx   # 左中栏：消息流（净化+源码展开）+ 模式/风格 + 输入
│   │   ├── PreviewPane.tsx# 右栏：375px 手机壳 iframe 预览 + 质量条 + 缩放/复制/导出/清空
│   │   ├── SessionRail.tsx# 左侧常驻会话栏：列表/新建/切换/删除/当前高亮
│   │   └── SettingsPanel.tsx # 设置弹层：API Key/端点/模型，保存/恢复默认
│   ├── lib/
│   │   ├── compose.ts     # v2 排版语法 → 微信合法 HTML 确定性转换器（移植 DSH compose；::: art 素材 + 元素/用量/组件化校验 + 主题色）
│   │   ├── palettes.ts    # 风格主题表（知识库 8 风格色板：日系/国潮/校园/科技/极简/商务/手账/森系）
│   │   ├── artRender.ts   # SVG 素材 → PNG data URI（canvas 2x；回退 svg data URI）
│   │   ├── persona.ts     # 统一系统提示词（对话+创作一体；```v2 协议 + 素材铁律 + 语气/结构/风格规则 + 知识拼装）
│   │   ├── needs.ts       # 请求启发式（模拟端近似 + 澄清触发评估：isCreateRequest/isCancel/evaluate）
│   │   ├── retrieval.ts   # 知识取用：主题词映射 + 三层任务路由注入（类型/模板/风格或选型速查/合规红线）+ 二元组兜底
│   │   ├── chat.ts        # 对话通道：Tauri→Rust 流式 / 浏览器→本地模拟（v2+art+theme 样例与违规直通演示）
│   │   ├── extract.ts     # 围栏解析：extractHtml(html 直通) + splitAssistant(prose/code/v2)
│   │   ├── quality.ts     # 输出 HTML 质量检查（零 emoji/渐变/阴影/外链图/style 标签）
│   │   ├── exportHtml.ts  # 导出：Tauri→export_html 命令 / 浏览器→<a download>
│   │   ├── sessions.ts    # 多会话：Tauri→sessions 命令 / 浏览器→localStorage（含旧键迁移）
│   │   └── settings.ts    # API 设置：Tauri→save/load_settings / 浏览器→localStorage
│   └── knowledge/         # 知识语料 149 文件（三层：文本/视觉/插图/其它 + 00-GUIDE/design-logic）
│       ├── 00-GUIDE.md    # 三层路由总表
│       ├── design-logic-components.md
│       ├── 文本/ 视觉/ 插图/ 其它/   # 四方面 + 各方向 00-索引 + 点文件
└── src-tauri/             # Rust 后端
    ├── Cargo.toml         # 依赖：tauri2/reqwest(rustls)/serde + dev tokio
    ├── tauri.conf.json    # 窗口 1380x880「公众号推文助手」
    ├── capabilities/default.json  # core:default（含事件监听）
    ├── icons/             # 应用图标
    └── src/
        ├── main.rs        # 入口（调 lib::run）
        ├── lib.rs         # Builder + 10 命令注册（chat/export/sessions/settings）
        ├── chat.rs        # LLM 客户端：resolve_config(env>settings>~/.dsh)、SSE 流式、事件推送、单测+live
        ├── export.rs      # 导出 HTML（workspace/exports/，文件名消毒，4 单测）
        ├── sessions.rs    # 多会话（workspace/sessions/<id>.json + state.json；旧 draft 迁移；5 单测）
        └── settings.rs    # API 设置（workspace/settings.json，损坏→默认，2 单测）

## 当前核心事实
- 运行时：Node 24 / Rust 1.95；包管理器：pnpm 11（onlyBuiltDependencies esbuild）
- 前端构建：`pnpm build`（tsc && vite build）；桌面运行：`pnpm tauri dev`
- LLM：OpenAI 兼容接口，默认 https://api.deepseek.com/chat/completions，模型 deepseek-v4-flash（reasoning_effort max，与 DSH 一致）
- 密钥：env DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml
- 验证：`scripts/verify-ui.mjs`（playwright + 本机 chromium-1234）+ `cargo test`（含 `--ignored` live 冒烟）
