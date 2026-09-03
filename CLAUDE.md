# wechat-mp-desktop 工作区指令

## 每次启动会话的强制步骤
**每次新会话开始工作时，必须先调用「myworkflow-project-maintain」skill。** 它引导你：
1. 读取本文件（CLAUDE.md）了解项目规则
2. 读取 PROGRESS-LITE.md 了解最近进展
3. 读取 STRUCTURE.md 了解项目布局
4. 工作完成后强制更新 PROGRESS.md + PROGRESS-LITE.md + STRUCTURE.md

> 不要跳过。文档体系的价值取决于每一次工作都留下记录。

## 当前项目
正在开发 **公众号推文助手桌面版（wechat-mp-desktop）**——独立于 DSH 的本地桌面应用：左侧与 AI 对话生成推文，右侧 375px 手机壳实时预览。技术栈：Tauri 2 + React 19 + TypeScript + Vite；底座参考 DSH 极简智能体（persona + 知识检索 + 流式对话），知识语料来自 wechat-mp 项目三层知识库（文本/视觉/插图/其它）。

## 工作区目录结构
D:\deepseek-harness\wechat-mp-desktop/
├── CLAUDE.md              # 本文件 — 工作区入口指令
├── README.md              # 项目说明
├── STRUCTURE.md           # 项目结构文档
├── PROGRESS.md            # 详细开发进度
├── PROGRESS-LITE.md       # 精简进度（标签化）
├── REQUIREMENTS.md        # 需求登记册（逐轮登记，先记录后开发）
├── index.html             # Vite 入口
├── package.json           # 前端依赖（pnpm）
├── src/                   # 前端源码（React）
├── src-tauri/             # Rust 后端（Tauri 壳 + LLM 客户端）
├── scripts/               # 验证脚本（playwright E2E）
└── public/                # 静态资源

## 目录结构更新规则
仅当顶层新增/删除/重命名目录或文件、新增子项目、核心规则变化时更新本文件目录树；日常子目录内文件增删由 STRUCTURE.md 管理。

## 项目铁律
1. **先记录后开发**：每轮开发先在 REQUIREMENTS.md 登记（需求/改动点/验收标准/状态），确认后动手。
2. **密钥安全**：DEEPSEEK_API_KEY 只从环境变量或 `~/.dsh/.credentials.yaml` 读取，绝不写入源码/提交；`src-tauri/target`、`dist` 不提交。
3. **知识语料同步**：`src/knowledge/` 从 wechat-mp 项目（wechat-mp/test/knowledge 三层结构）拷贝；语料更新需手动同步并在 PROGRESS 记录。
4. **真实验证文化**：UI 链路用 `scripts/verify-ui.mjs`（playwright）跑通并截图存证；Rust 逻辑用 cargo 单元测试 + live 冒烟（`--ignored`）。
5. **零 emoji 内容**：产品文案与知识语料不使用 emoji。

## 每次变更的文档同步规则
**每次代码修复/重构/功能变更后，必须同步更新：**
1. **PROGRESS.md** — `---` 分隔线后追加详细条目（日期+问题+根因+文件列表+验证）
2. **PROGRESS-LITE.md** — 同步追加精简条目（`[标签]` + 一句话）
3. **STRUCTURE.md** — 文件/目录有增删改则同步目录树
4. **REQUIREMENTS.md** — 需求状态变化同步
此规则无例外。文档即代码的一部分。

## 跨项目约定
- 本仓库独立 git（初始提交后推 GitHub 需用户确认）；
- 上层工作区（D:\deepseek-harness）PROGRESS/STRUCTURE 也要同步本项目的顶层变更；
- wechat-mp 仓库（公众号插件预设）与本项目并行存在：预设负责真实发布链路，本项目负责独立桌面创作体验。
