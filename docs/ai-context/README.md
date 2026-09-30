# AI 上下文源码索引

更新：2026-09-29。这里维护入口与作用，不复制提示词正文；审阅以链接指向的源码为准。

| 内容 | 权威入口 | 使用阶段 |
| --- | --- | --- |
| 主模型人设与系统壳 | [persona.ts](../../src/lib/persona.ts) | 对话/创作判断、自然澄清、输出协议与注册表 system |
| 创作前置与撰写指令 | [prep.ts](../../src/lib/prep.ts) | **准备阶段结果契约**（`PREP_INSTRUCTION` 要求模型调用终结工具 `finish_preparation`；`PREP_CORRECTION` 是协议纠偏话术；`MAX_PREP_CALLS=3` 为总额预算）、知识与素材搜索、撰写前摘要 |
| 准备阶段工具声明 | [chat.rs](../../src-tauri/src/chat.rs) 的 `PREP_TOOLS` | 发给模型的工具 JSON：`load_knowledge` / `search_knowledge` / `search_assets` / **`finish_preparation`**（`outcome` 与 `assetPolicy` 的 enum 由 `cargo test` 钉住） |
| 知识目录及加载 | [retrieval.ts](../../src/lib/retrieval.ts) | 注册表与按需知识全文；实际条目从 src/knowledge 加载 |
| 创作引擎协议 | [engine-write-protocol.md](../../src/knowledge/排版引擎/engine-write-protocol.md) | v2 语法、照片与素材引用、风格与组件质量要求 |
| 图像模型及补充说明 | [chat.rs](../../src-tauri/src/chat.rs) | SVG 提示与按角色契约、gen_svg、refine_brief、视觉复核、消息线上形态与回合预算 |
| 素材占位解析与复用 | [image-agent.ts](../../src/lib/image-agent.ts) | 库查询、快照解析、缺料补做；**`assetPolicy=preserve` 下的素材身份确定性恢复**（防 `[[asset:…]]` 退回 `[[img:…\|new]]` 时重新画一张） |
| 复用判定与角饰别名 | [asset-resolve.ts](../../src/lib/asset-resolve.ts) | 长度归一化命中、配色冲突否决、气泡引用配对与别名规划（纯函数） |
| 素材质量门槛 | [svg-quality.ts](../../src/lib/svg-quality.ts) | 按角色的确定性判定：可见元素、越界、占画面比、几何角色要求 |
| 视觉复核决策 | [vision.ts](../../src/lib/vision.ts) | 何时调用看图模型、限次与缓存、失败回退口径 |
| 自动修订提示 | [revise.ts](../../src/lib/revise.ts) | 可修复产物警告回喂，最多两次；局部问题附行号定点修订 |
| 事实保护与正文投影 | [delivery-quality.ts](../../src/lib/delivery-quality.ts) | `extractFacts` 的规范化边界、`bodyText` 投影口径、`BodyApplicability` 三态 |
| 预览显示层的外链抑制 | [preview-safe.ts](../../src/lib/preview-safe.ts) | 纯函数 `neutralizeExternalResources`：显示层把外链 `src/href/srcset/CSS url()` 换成内联占位；**门禁与导出仍用原始 HTML**（不洗掉违规证据） |
| 回合实际拼装 | [App.tsx](../../src/App.tsx) | payload/digest、准备结果执行（reply/compose/candidate）、统一交付入口、候选提升与退化比较、协议兜底 |
| 浏览器测试桩 | [chat.ts](../../src/lib/chat.ts) | 浏览器 mock，不代表真实模型提示与输出 |

知识正文在 [运行时知识库](../../src/knowledge/)；注册表只提供目录，正文由工具按需加载。文件数量直接从目录读取，避免维护另一份逐文件清单。改提示词时改源码；新增注入入口时再更新本表。
