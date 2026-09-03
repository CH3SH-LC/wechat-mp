# 公众号推文助手桌面版 开发进度记录

> 本文件记录每次代码变更的完整过程。精简版见 PROGRESS-LITE.md。
> 新条目追加位置：在 `---` 分隔线之后、已有最新条目之前。

---

## 2026-09-04

### [New Feature] 第 7 轮：应用内 API 设置——彻底脱离 ~/.dsh

需求 / 变更原因：
对外分发的桌面端不应依赖用户机器的 ~/.dsh 凭据——应用内提供 API 配置（Key/端点/模型），本地保存；密钥解析优先级 env > 应用设置 > 旧 ~/.dsh 兼容回退。

实现：
- src-tauri/src/settings.rs：AppSettings + read/save（损坏→默认不覆盖）+ save_settings/load_settings 命令（2 单测）
- chat.rs：LlmConfig + resolve_config（env > settings.json > ~/.dsh legacy）+ stream_chat 改收 &LlmConfig（修空白 env 处理，+1 优先级单测）
- 前端 lib/settings.ts（Tauri invoke / localStorage wxmp-settings-v1）+ SettingsPanel（Key 掩码/地址/模型/保存/恢复默认/优先级说明）+ 顶栏「设置」入口
- RELEASE-NOTES 配置段改写

验证：
- cargo test 16/16（2 ignored）
- pnpm build exit 0（主包 240.3kB）
- E2E 七场景全绿：S1 通过 / S1.5 导出 / S1.6 恢复+清空 / S2 检出 4 项 / **S7 设置保存→刷新持久(sk-e2e-123)→恢复默认清空**

---

### [Build] 第 6 轮：安装器真实验证——静默安装/启动/卸载闭环

需求 / 变更原因：
第 5 轮产出的 NSIS setup 尚未做真机安装验证；本轮补发布闭环：静默安装 → 安装版启动冒烟 → 静默卸载 → 目录清理。

产出 / 验证：
- setup.exe /S /D=… 静默安装 exit 0；安装目录出现 wechat-mp-desktop.exe
- 安装版启动冒烟：进程存活（6s）后关闭
- uninstall.exe /S 静默卸载 exit 0；安装目录已删除
- RELEASE-NOTES 验证基线补"发布闭环"一行
- 备注：dev 模式 tauri dev（pwsh-17）随之结束；后续开发可随时重启

---

### [Build] 第 5 轮：发布打包——独立安装版（tauri build + NSIS）

需求 / 变更原因：
把桌面端做成可脱离开发环境交付的独立安装版：release 编译 + NSIS 安装器；并冒烟验证发布产物可启动。

产出：
- `pnpm tauri build --bundles nsis`：release exe 12.2MB + NSIS setup 3.7MB（wechat-mp-desktop_0.1.0_x64-setup.exe，makensis 本地工具无需外网）
- RELEASE-NOTES.md：功能清单 / 运行与打包方式 / 配置 / 验证基线 / 已知边界
- 清理 draft.rs dead_code 警告（删除未用 draft_path）

验证：
- 产物存在：bundle/nsis/setup.exe 3.7MB、release/wechat-mp-desktop.exe 12.2MB
- release exe 启动冒烟：进程存活（78MB）→ 正常关闭
- 回归 cargo test 13/13（2 ignored）
- tauri build 整程 1m34s release + NSIS 完成（exit 1 为 pnpm/stderr 噪音，产物完整）

---

### [New Feature] 第 4 轮：会话自动存档/恢复 + 工作区目录统一 + 真实模型整篇抽样

需求 / 变更原因：
桌面创作要"断电不丢稿"：对话自动存档并在启动恢复；导出与存档统一到一个工作区目录；并对真实模型整篇输出做合规抽样（此前只冒烟过短回复）。

实现：
- src-tauri/src/draft.rs：Draft/DraftMsg 结构 + save_draft_to/load_draft_from（损坏存档改名 draft.json.corrupt 容错）+ save_draft/load_draft 命令（3 单测）
- 工作区统一：Documents/wechat-mp-workspace/{draft.json, exports/}（export.rs default_export_dir 改为 delegation 到 draft::exports_dir）
- src/lib/draft.ts：双通道存档（Tauri invoke / 浏览器 localStorage wxmp-draft-v1）+ fmtTime
- App：启动恢复（消息/模式/风格/预览与质量条）、变更防抖 700ms 自动存档、流结束立即存档、顶栏"已自动保存 HH:mm"、清空同时清存档
- chat.rs 新增 live_article_sample（#[ignore] 真实整篇生成 + 软断言）

验证：
- cargo test 13/13（draft 3 项：roundtrip/缺失 None/损坏容错）
- E2E 四场景全绿：S1 质量通过 / S1.5 导出下载 / S1.6 刷新恢复（userMsgs=1 预览恢复 + 顶栏已自动保存）→ 清空清存储 / S2 违规检出 4 项
- live_article_sample：LIVE ARTICLE len=3753 issues=[]（零 gradient/shadow/style/emoji）
- pnpm build exit 0（主包 237.7kB）；窗口 2:46:17 自动重启含 save_draft/load_draft 命令

---

### [New Feature] 第 3 轮：导出 HTML 文件 + 知识库懒加载减包

需求 / 变更原因：
生成结果要"能带走"：①导出按钮——Tauri 模式经 Rust 命令写入 文档/wechat-mp-exports/（文件名消毒、返回完整路径展示），浏览器模式走 <a download>；②知识库 eager 全量内联导致主包 2.4MB，改为懒加载按文件拆分。

实现：
- src-tauri/src/export.rs：default_export_dir/sanitize_name/with_html_ext/export_to_dir + export_html 命令（4 单测：非法字符消毒、htm/html 扩展、写盘内容一致、默认名前缀）
- src/lib/exportHtml.ts：双通道导出（invoke export_html / blob+a.download，文件名 tuiwen-yyyymmdd-hhmm.html）；PreviewPane「导出」按钮 + 结果提示条
- src/lib/retrieval.ts：import.meta.glob 改懒加载（ensureKnowledgeLoaded 缓存 Promise）；App 异步 await retrieve + 顶栏条目数动态显示（加载中…）

验证：
- cargo test 10/10（含 export 4 项；修测试预期：尾部 '_' 被 trim 属预期行为）
- pnpm build exit 0：主包 2388kB → 235.8kB（gzip 75.1kB），知识条目拆 149 个懒加载 chunk
- E2E 全绿：S1 质量通过 / S1.5 导出下载（tuiwen-20260904-0243.html 2254B，内容含 <section>）/ S2 违规检出 4 项
- tauri dev 自动重建重启窗口（PID 更替），export_html 命令已注册

---

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
