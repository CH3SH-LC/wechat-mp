# wechat-mp-desktop 需求登记册（REQUIREMENTS.md）

> 每轮开发前先在本文件登记需求（含验收标准），确认后再动手；开发流程见项目 CLAUDE.md。

## 一、项目定位（2026-08-29 用户原话整理）

> 让这个项目独立于 dsh。目标是做一个桌面本地项目：一方面可以跟 AI 对话，生成内容；另一方面可以实时看到 AI 生成的推文。harness 底座参考 dsh 的极简模式智能体，外附我整理的微信公众号知识（三层知识库）；桌面前端采用 Tauri。

- 独立性：不依赖 DSH/Cordis 运行时；AI 直连 DeepSeek API；知识语料内嵌。
- 双栏桌面工作台：左 = AI 对话生成；右 = 375px 手机壳实时预览生成的推文 HTML。

## 二、功能需求登记（逐轮追加，最新在最上）

### 2026-08-29｜第 1 轮：桌面双栏骨架 + 极简智能体链路（开发中）
- 需求：可运行的 Tauri 桌面应用骨架：左对话右预览；底座 = 极简智能体（persona + 知识检索 + 流式对话），真实调用 DeepSeek 生成推文 HTML 并在右侧实时渲染。
- 改动点：Tauri 2 + React 19 脚手架；`src/lib/`（persona/retrieval/chat/extract）；组件 ChatPane/PreviewPane；Rust `chat.rs`（密钥解析、SSE 流式、事件推送）；知识语料 `src/knowledge/`（三层 149 文件，从 wechat-mp/test/knowledge 拷贝）；验证脚本 verify-ui.mjs。
- 验收标准：①纯浏览器模拟链路 E2E 全绿（示例→流式→HTML 围栏提取→375px 预览渲染，playwright 截图存证）；②Rust 单测 6 项全过 + live DeepSeek 冒烟返回成功；③`pnpm tauri dev` 桌面窗口可启动；④四文件体系 + 需求登记落盘。
- 状态：✅ 完成（E2E 4/4 PASS、Rust 单测 6/6 + live 冒烟 OK、tauri dev 编译通过；截图 verify-artifacts/wxmp-desktop-ui.png）

### 2026-08-29｜第 0 轮：项目初始化（完成）
- 需求：建立独立桌面项目（四文件体系 + git 仓库 + Tauri 脚手架 + 知识语料内嵌）。
- 状态：✅ 完成（四文件 + REQUIREMENTS + README + .gitignore；create-tauri-app react-ts；知识语料 149 文件入 src/knowledge；pnpm 11 esbuild 许可；git init）
