# wechat-mp-desktop 需求登记册（REQUIREMENTS.md）

> 每轮开发前先在本文件登记需求（含验收标准），确认后再动手；开发流程见项目 CLAUDE.md。

## 一、项目定位（2026-08-29 用户原话整理）

> 让这个项目独立于 dsh。目标是做一个桌面本地项目：一方面可以跟 AI 对话，生成内容；另一方面可以实时看到 AI 生成的推文。harness 底座参考 dsh 的极简模式智能体，外附我整理的微信公众号知识（三层知识库）；桌面前端采用 Tauri。

- 独立性：不依赖 DSH/Cordis 运行时；AI 直连 DeepSeek API；知识语料内嵌。
- 双栏桌面工作台：左 = AI 对话生成；右 = 375px 手机壳实时预览生成的推文 HTML。

## 二、功能需求登记（逐轮追加，最新在最上）

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
