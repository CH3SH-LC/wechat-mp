# 公众号推文助手桌面版 开发进度记录

> 本文件记录每次代码变更的完整过程。精简版见 PROGRESS-LITE.md。
> 新条目追加位置：在 `---` 分隔线之后、已有最新条目之前。

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
