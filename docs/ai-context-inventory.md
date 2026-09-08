# AI 上下文注入清单（供逐文件审阅）

> 目的：把"会进入发给模型的上下文的文件/内容"完整列出，标注**何时以何种形态注入**，供逐项审阅。
> 生成日期：2026-09-07（第 29 轮 persona 精简后重导出）。分两类：**A. 手写提示词（代码内）**、**B. 知识语料（src/knowledge/*.md）**。
> 注入通道实现见：`src/lib/persona.ts`(buildRegistrySystem)、`src/lib/retrieval.ts`(buildRegistry/loadEngineProtocol/runKnowledgeTool)、`src/lib/prep.ts`(runPrep/PREP_INSTRUCTION/WRITE_INSTRUCTION)、`src/App.tsx`(turn 拼 payload/digest + 引擎协议兜底)。

---

## A. 手写提示词入口（先审这批 —— 每条都直接进 system/指令）

| # | 文件 | 内容 | 何时注入 |
|---|---|---|---|
| A1 | `src/lib/persona.ts` — `PERSONA_RULES` | **精简后的主模型统一人设（第 29 轮，≈30% 原体量）**：通用 AI 助手身份 + 少量公众号创作能力；对话/创作判断；**理解型澄清**（自然对话弄明白主题/读者/配图来源等，授权或理解充分才写）；输出协议（创作正文用 ```v2 围栏、围栏前可自然说明；非创作纯文本）；"创作细则由创作回合提供"指针 | **每条用户消息的 system**（与注册表一起，经 buildRegistrySystem 拼装） |
| A2 | `src/lib/prep.ts` | `PREP_INSTRUCTION`（创作前置规约：**先取 engine-write-protocol 再按需取 type/style/comp/copy**，未理解可跨轮自然追问，理解或授权后 READY）、`WRITE_INSTRUCTION`（撰写：正文 ```v2 围栏，**允许正文前自然说明**，不再"只输出代码块/不要解释"）、runPrep 运行时降级文案 | 桌面创作回合：作为 **user 消息** 追加（prep 阶段 + 撰写阶段） |
| A3 | `src-tauri/src/chat.rs` — `SVG_SYSTEM_PROMPT` + `svg_user_prompt()` | **图像子智能体人设（第 29 轮复杂度契约）**：具体可辨认插画、分层构图、物体结构/明暗体积/材质纹理、细节密度（横幅 20+/小图 10+ 元素，≥6 只是门槛）；零文字 emoji、透明背景、低饱和 ≤4 色；CLARIFY 追问协议（说明不足时输出 `CLARIFY:<一句问题>`，不硬画） | 每次 gen_svg（独立调用 deepseek-chat） |
| A3b | `src-tauri/src/chat.rs` — `refine_brief` 的补 brief 人设 | **有界回问**：图像子智能体 CLARIFY 后，主模型（cfg.model）把占位说明补成可作画的具体 brief（对象/动作场景/构图氛围/色彩） | 仅子智能体 CLARIFY 时由前端调用一次（每占位 ≤1 次回问） |
| A4 | `src/lib/chat.ts` | mock 提示文案（`CHAT_GREET/CHAT_QA/CLARIFY_QUESTION/CANCEL_REPLY`、SAMPLE_V2、BAD_HTML）——**仅内部测试桩**（第 29 轮起无用户可见演示按钮，verify-ui 输入文本驱动） | **仅浏览器 mock**（`pnpm dev` / E2E），不打真实模型 |
| A5 | `src/lib/persona.ts` — `buildRegistrySystem` 的固定措辞 | “## 知识注册表（目录。创作前会通过工具按需取用点文件…）”系统壳措辞 | 每条用户消息 system |

> 第 29 轮审阅结论对照：① persona 已精简为通用助手 + 少量公众号能力，工艺细则迁知识库（见 B 新增"排版引擎"组）；② 允许正文前自然说明（不再强制"只输出代码块"）；③ 澄清改理解型（不按维度收问卷）；④ SVG 复杂度契约 + CLARIFY 回问（详见 01-03 分文档）。

---

## B. 知识语料 `src/knowledge/`（150 个 md，含第 29 轮新增排版引擎协议）

注入方式分两档：
- **常驻（所有 150）**：每个文件仅 **文件名 + 一级标题（短标）** 汇入「注册表」目录（总量 ≤3500 字符），随每条 user 的 system 注入 —— **正文不进**。生成器：`retrieval.ts buildRegistry`（顶层 `00-GUIDE.md`、`design-logic-components.md` 不列入目录，但工具仍可按名取）。
- **按需全文注入（取用即进上下文）**：模型调用工具 `load_knowledge(点文件名)` → 该文件**全文（截 ≤6000 字符）**经 prep 摘要(digest) 进入撰写阶段上下文；`search_knowledge` 只返回 ≤6 个文件名清单（不注入正文）。故下列**每个**文件都可能是"全文注入"的对象。

### 第 29 轮新增：排版引擎（创作必读组，注册表置顶防截断）
- engine-write-protocol.md —— 桌面 compose v2 引擎唯一权威协议：产出形态、v2 语法表、美术素材图位/照片位规则、结构/语气/审美、风格声明（`[[theme]]`/`[[palette]]`）。**创作正文前必取**（PREP_INSTRUCTION 强制 + App digest 缺时兜底 loadEngineProtocol 附加）。

### B0 顶层（2，不进注册表，可按名 load）
- 00-GUIDE.md
- design-logic-components.md

### 文本 / 内容类型（15）
- 00-索引.md
- type-announcement.md · type-brand-story.md · type-catalog.md · type-choose.md · type-emotion.md · type-list.md · type-mix.md · type-news.md · type-person-story.md · type-promo.md · type-science.md · type-serial.md · type-soft.md · type-tutorial.md

### 文本 / 文案（27）
- 00-索引.md
- copy-end.md · copy-guide-checklist.md · copy-guide-from-topic.md · copy-guide-length.md · copy-guide-platform.md · copy-guide-principles.md · copy-guide-vivid-news.md · copy-layout.md · copy-open.md · copy-points.md · copy-quote.md · copy-redline.md · copy-style-basics.md · copy-style-rhythm.md · copy-style-vivid.md · copy-subheading.md · copy-tags.md · copy-title.md · copy-transition.md · copy-tpl-brand.md · copy-tpl-emotion.md · copy-tpl-news.md · copy-tpl-person.md · copy-tpl-promo.md · copy-tpl-soft.md · copy-tpl-tutorial.md

### 文本 / 合规（7）
- 00-索引.md
- comp-banned.md · comp-copyright.md · comp-data.md · comp-disclaimer.md · comp-industry.md · comp-penalty.md

### 视觉 / 模块（47）
- 00-索引.md
- module-art-assets.md · module-badge.md · module-band.md · module-bubble.md · module-card.md · module-case.md · module-checklist.md · module-contact.md · module-countdown.md · module-cta-end.md · module-disclaimer.md · module-divider-page.md · module-divider.md · module-faq.md · module-followbar.md · module-footer.md · module-gift.md · module-guide-check.md · module-guide-combos.md · module-guide-dualmode.md · module-guide-matrix.md · module-guide-mobile.md · module-guide-rhythm.md · module-guide-templates.md · module-header.md · module-heading.md · module-image.md · module-inline-deco.md · module-interact.md · module-job.md · module-legend.md · module-list.md · module-media.md · module-miniapp.md · module-price.md · module-quote.md · module-reading.md · module-serial.md · module-spec.md · module-steps.md · module-subheading.md · module-table.md · module-tags.md · module-testimonial.md · module-timeline.md · module-toc.md

### 视觉 / 风格（30）
- 00-索引.md
- style-american-retro.md · style-anime.md · style-business.md · style-campus.md · style-cyberpunk.md · style-forest.md · style-gallery.md · style-guide-brand.md · style-guide-check.md · style-guide-choose.md · style-guide-maintain.md · style-guide-mix.md · style-guide-occasions.md · style-guide-platform.md · style-guochao.md · style-handbook.md · style-hk-retro.md · style-illustration.md · style-japanese.md · style-magazine.md · style-minimal.md · style-newspaper.md · style-tech.md · style-variant-dunhuang.md · style-variant-handdraw.md · style-variant-memphis.md · style-variant-pop.md · style-variant-shimizu.md · style-variant-sport.md

### 插图 / 图片（6）· 插图 / 视频（3）
- 00-索引.md · img-alternatives.md · img-copyright.md · img-insert.md · img-processing.md · img-sources.md
- 00-索引.md · video-insert.md · video-prepare.md

### 其它 / 封面（6）· 其它 / 可读性（6）
- 00-索引.md · cover-consistency.md · cover-firstscreen.md · cover-spec.md · cover-summary.md · cover-text.md
- 00-索引.md · read-check.md · read-contrast.md · read-darkmode.md · read-rhythm.md · read-typography.md

---

## C. 动态（非文件，供知悉）
- 每次 user 输入原样进上下文；会话历史（本会话 user/assistant 消息）进上下文。
- prep 阶段模型可见 tool_calls + 工具返回（工具返回=B 点文件全文或其提示）；撰写阶段模型只看到 digest 化知识 + `WRITE_INSTRUCTION`。
- gen_svg 的用户指令 = 正文 `[[img/deco/photo]]` 占位的说明文字（由 A1 人设要求主模型撰写，透传给 A3 图像子智能体）。

## 建议审阅顺序
1. A1 persona.ts（影响最大）→ A2 prep.ts → A3 chat.rs 的 SVG 提示 → A5 壳措辞 → A4 mock（可跳过）。
2. B：先审会被**经常全文取用**的点文件：`文本/内容类型/*`、`文本/文案/copy-tpl-*`、`视觉/风格/style-*`（尤其 style-campus/japanese/guochao 与 00-索引）、`文本/合规/comp-banned`、`视觉/模块/module-bubble/art-assets`；其余 00-索引多为路由目录。
3. 想看某次真实运行实际注入了哪些点文件：读 `Documents/wechat-mp-workspace/sessions/<最新>.json` 里该次 assistant 前的工具命中记录，或加日志观察 prep digest。
