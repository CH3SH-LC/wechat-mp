# AI 上下文 · 审阅目录

> 代码内置的"进模型上下文的提示词/指令"已导出为可读 md。知识语料全清单见 `../ai-context-inventory.md`。

## 主模型（对话 + 创作）每回合进 system/user
- [`01-persona-rules.md`](01-persona-rules.md) — 主模型统一人设 `PERSONA_RULES`（运行时真值导出）
- [`02-prep-and-registry-shell.md`](02-prep-and-registry-shell.md) — 创作前置 `PREP/WRITE_INSTRUCTION` + 注册表壳措辞

## 子智能体（独立模型调用）
- [`03-image-agent-prompt.md`](03-image-agent-prompt.md) — 图像子智能体 `gen_svg` 提示（复杂度契约 + `refine_brief` 有界回问）

## 仅浏览器 mock（第 29 轮起为内部测试桩，不发给真实模型）
- [`04-mock-browser-only.md`](04-mock-browser-only.md)

## 数据类（进入上下文的语料）
- 知识语料 150 个 md（含第 29 轮新增「排版引擎」组）：见 [`../ai-context-inventory.md`](../ai-context-inventory.md)

> 同步约定：改过 `persona.ts`/`prep.ts` 后，persona 真值请重跑导出（`node --input-type=module -e` 导入 persona 写 01）；prep/chat.rs/mock 措辞改动请同步本目录对应 md。
