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
│   └── verify-ui.mjs      # E2E 冒烟：点示例→流式→375px 预览断言+截图
├── docs/information/     # 需求报告（req-clarify 落盘：…-context-rail-clean-chat.md、2026-09-05-conversational-agent.md）
├── src/                   # 前端源码
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主布局：顶栏 + 对话栏 + 预览栏；状态中枢
│   ├── App.css            # 全局样式（顶栏/对话/预览/手机壳）
│   ├── components/
│   │   ├── ChatPane.tsx   # 左中栏：消息流（净化+源码展开）+ 模式/风格 + 输入（通用对话路由入口）
│   │   ├── PreviewPane.tsx# 右栏：375px 手机壳 iframe 预览 + 质量条 + 缩放/复制/导出/清空
│   │   ├── SessionRail.tsx# 左侧常驻会话栏：列表/新建/切换/删除/当前高亮
│   │   └── SettingsPanel.tsx # 设置弹层：API Key/端点/模型，保存/恢复默认
│   ├── lib/
│   │   ├── persona.ts     # 系统提示词（persona+间距/v10 硬规范+输出协议+知识拼装）+ buildChatSystem 通用对话人设
│   │   ├── needs.ts       # 请求分类（isCreateRequest/isCancel/isDemoTopic）+ 需求评估 evaluate（模拟端反问判定）
│   │   ├── retrieval.ts   # 知识检索（主题词映射+二元组；懒加载 ensureKnowledgeLoaded 缓存）
│   │   ├── chat.ts        # 对话通道：Tauri→Rust 流式 / 浏览器→本地模拟（含违规演示样本）
│   │   ├── extract.ts     # HTML 提取 + splitAssistant（气泡净化拆分）
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
- LLM：OpenAI 兼容接口，默认 https://api.deepseek.com/chat/completions，模型 deepseek-chat
- 密钥：env DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml
- 验证：`scripts/verify-ui.mjs`（playwright + 本机 chromium-1234）+ `cargo test`（含 `--ignored` live 冒烟）
