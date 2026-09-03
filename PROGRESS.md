# 公众号推文助手桌面版 开发进度记录

> 本文件记录每次代码变更的完整过程。精简版见 PROGRESS-LITE.md。
> 新条目追加位置：在 `---` 分隔线之后、已有最新条目之前。

---

## 2026-09-04

### [New Feature] 第 2 轮：生成体验产品化——类型/风格选择注入 + 输出质量检查护栏

需求 / 变更原因：
把生成体验做成可调、结果可检查：①对话侧加「模式(自动/文字/宣传) + 风格(校园/科技/国潮/日系/极简/商务/手账)」快速选择，随请求注入提示词并参与知识检索；②对助手产出 HTML 做客户端质量检查（v10 铁律：零 emoji/零图标、无 style/script/文档级标签、无 linear-gradient/box-shadow、无外链图、无硬性宽），预览栏展示「质量检查:通过/问题清单」。

实现：
- src/lib/quality.ts：checkHtml → {ok, issues}（Extended_Pictographic + v10 图标字符显式集；style/script/html/head/body 标签；linear-gradient/box-shadow；http(s) img；≥100px 固定宽）
- ChatPane：控制条（seg 模式 + 风格下拉）+「演示：违规输出检测」chip；App：mode/style 状态 + decoratePrompt 注入 + 流结束后终检（checkHtml 只在结束时跑，避免流中抖动）；PreviewPane：质量条（q-ok/q-fail + 问题列表）
- chat.ts：新增违规演示样本（BAD_HTML：emoji+渐变+外链图），按提问含"违规"命中

验证：
- pnpm build（tsc+vite）exit 0
- E2E 双向全绿：S1 干净样本 → 质量检查通过（q-ok）；S2 违规样本 → 检出 4 项（emoji/gradient/shadow/external-img）并展示清单（q-fail）；截图 verify-artifacts/wxmp-desktop-ok.png / -fail.png

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
