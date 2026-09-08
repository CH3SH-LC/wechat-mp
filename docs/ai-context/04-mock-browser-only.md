# 浏览器 mock（第 29 轮起 = 仅内部测试桩，无用户可见演示入口）

> 来源：`src/lib/chat.ts`（CHAT_*/CLARIFY/CANCEL、SAMPLE_V2、BAD_HTML）、`src/lib/needs.ts`（启发式）、`src/lib/image-agent.ts`（本地样例 SVG 池）。
> 第 29 轮审阅点 4：**删用户可见 mock**——ChatPane 不再渲染「示例：开学典礼宣传」「演示：违规输出检测」按钮；QUICK_PROMPTS 保留（通用引导，非 mock）。
> mock 代码与 needs.ts **保留为内部测试桩**：verify-ui 的对话语义断言（S2 违规检出 / S9 反问·直出·闲聊·取消）改为**输入框直接发文本**驱动（sendPrompt），仍走 mock 链路；`needs.isCreateRequest` 同时被真实桌面流用于触发 prep（真实引用，不可删）。
> 这些只在无 Tauri 的浏览器演示/E2E 链路出现；桌面版真实创作走 Rust + 真实模型。

## 澄清 / 取消 / 闲聊回复（模拟端文案）
```text
CLARIFY_QUESTION：好的，先把要求问清楚再写：这篇推文是什么类型（活动宣传还是资讯介绍）？想要什么风格？大概多少字？需要配图吗？还有发布到哪里（导出/草稿箱）？你逐项告诉我即可。
CANCEL_REPLY：好的，那先不写了。需要的时候随时告诉我主题就行。
CHAT_GREET：你好，我是公众号推文助手。你可以像用通用助手一样和我聊天：问公众号写作的问题、聊选题想法都行；说「写一篇…推文」，我会先把要求问清楚再帮你产出可直接发布的推文并实时预览。
CHAT_QA：可以。公众号写作的通用要点：……
CHAT_DEFAULT：明白。想继续聊公众号写作，还是让我写一篇推文？告诉我主题、目标读者、风格倾向即可。
```

## 演示 v2 样例（SAMPLE_V2，含 [[theme:校园]] + 图位占位写法）
> 见源码 `chat.ts` 的 `SAMPLE_V2`（含 `[[img:…]]/[[deco:…]]` 占位，本地样例池近似渲染）——E2E 的 S1/S1.8 依赖它验证 compose 渲染链路，保留。

## 违规直通样本（BAD_HTML）
> 含 emoji/gradient/shadow/外链图，用于质量护栏演示（E2E S2 违规检出断言）；保留，由输入文本触发。

## mock 分流规则（needs.ts 启发式，仅模拟端）
取消→`CANCEL_REPLY`；上一条反问且本条为回答→直接成文；演示/违规→直通坏样本；创作意图→按需求充分度反问或成文；其余按闲聊/问答/兜底。
