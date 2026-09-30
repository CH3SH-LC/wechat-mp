# wechat-mp-desktop 工作区指令

## 每次启动会话

1. 读取本文件与 [GOAL.md](GOAL.md)，了解项目目标和永久约束。
2. 读取 PROGRESS-LITE.md、REQUIREMENTS.md 与 STRUCTURE.md，了解状态、待办和布局。
3. 先检查 Git 工作区已有改动，避免覆盖他人或上轮工作。
4. 完成后按下方规则同步需求、进度与结构，写明实际验证范围。

旧文档要求的 myworkflow-project-maintain skill 在本次检查的技能目录中未找到；上述流程直接在仓库维护，不再将缺失的外部 skill 设为强制前置。若恢复该 skill，需核对其内容与本文件是否一致。

## 当前项目
正在开发 **公众号推文助手桌面版（wechat-mp-desktop）**——独立于 DSH 的本地桌面应用：左侧与 AI 对话生成推文，右侧 375px 手机壳实时预览。技术栈：Tauri 2 + React 19 + TypeScript + Vite；底座参考 DSH 极简智能体（persona + 知识检索 + 流式对话），知识语料来自 wechat-mp 项目三层知识库（文本/视觉/插图/其它）。

## 文档入口
- [项目目标](GOAL.md)：长期方向、范围和完成标准。
- [文档导航](docs/README.md)：按读者和问题查找唯一入口。
- [项目结构](STRUCTURE.md)：维护目录和模块位置，本文件不再复制目录树。
- [需求基线](REQUIREMENTS.md)：当前约束、待办与新变更登记。

## 目录结构更新规则
目录位置统一在 STRUCTURE.md 维护；核心规则或入口变化时更新本文件。

## 项目铁律
1. **先记录后开发**：每轮开发先在 REQUIREMENTS.md 登记（需求/改动点/验收标准/状态），确认后动手。
2. **密钥安全**：DEEPSEEK_API_KEY 从环境变量、应用本机设置或旧 `~/.dsh/.credentials.yaml` 兼容回退读取，绝不写入源码/提交；`src-tauri/target`、`dist` 不提交。
3. **知识语料同步**：`src/knowledge/` 从 wechat-mp 项目（wechat-mp/test/knowledge 三层结构）拷贝；语料更新需手动同步并在 PROGRESS 记录。
4. **真实验证文化**：UI 链路用 `scripts/verify-ui.mjs`（playwright）跑通并截图存证；Rust 逻辑用 cargo 单元测试 + live 冒烟（`--ignored`）。
5. **零 emoji 内容**：产品文案与知识语料不使用 emoji。
6. **绝对禁止前端对话状态机**（用户 2026-09-05 明确，永久有效）：不得用任何前端状态（pendingClarify / expectRef / askRef 之类）控制对话流程、澄清或路由——消息一律直通模型，由模型自主判断（需求澄清靠 persona 约束，不靠前端分流）。违者立即撤销重做。
7. **每次更新必须重建桌面版 release**（用户 2026-09-08 明确，永久有效）：凡代码变更（含前端/Rust/persona/知识语料/mock）验证通过后，必须 `pnpm tauri build --bundles nsis` 重建 release exe + setup 并做启动冒烟，让 `src-tauri/target/release/` 始终与代码同步，不得只停在 dev/测试态。重建结果记入 PROGRESS（[Build] 标签）。

## 每次变更的文档同步规则
**每次代码修复/重构/功能变更后，必须同步更新：**
1. **PROGRESS.md** — `---` 分隔线后追加详细条目（日期+问题+根因+文件列表+验证）
2. **PROGRESS-LITE.md** — 同步追加精简条目（`[标签]` + 一句话）
3. **STRUCTURE.md** — 文件/目录有增删改则同步目录树
4. **REQUIREMENTS.md** — 需求状态变化同步
文档整理同样记录变更，但不触发仅适用于代码变更的 release 重建。
PROGRESS-LITE 每条一句话；PROGRESS 保留近期变更与里程碑，历史轮次由 Git 留存；压缩时必须把未解决事项和用户决策转入 REQUIREMENTS 或设计记录。提示词正文只在源码维护，索引见 docs/ai-context/README.md。

## 跨项目约定
- 本仓库独立 git（初始提交后推 GitHub 需用户确认）；
- 仅涉及本仓库内部文档调整时更新本仓库记录；若变更上层工作区的项目布局或职责，再同步上层 PROGRESS/STRUCTURE；
- wechat-mp 仓库（公众号插件预设）与本项目并行存在：本项目负责独立桌面创作体验；不以旧预设的发布能力证明本项目已验收。
