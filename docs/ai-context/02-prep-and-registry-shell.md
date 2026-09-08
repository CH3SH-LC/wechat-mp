# 创作前置指令 / 注册表壳措辞

> 这些不是知识正文，是注入到"发给主模型"的固定指令措辞。
> 来源：`src/lib/prep.ts`（PREP/WRITE）、`src/lib/persona.ts` 的 `buildRegistrySystem`（system 壳）、`src/lib/retrieval.ts` 的 `loadEngineProtocol`（digest 兜底）。
> 第 29 轮变化：PREP 改"先取引擎协议再按需取点"、澄清改理解型可跨轮；WRITE 允许正文前自然说明（不再"只输出代码块不要解释"）。

## PREP_INSTRUCTION（创作前置 prep 阶段，作为 user 消息追加）
```text
创作类请求的处理方式：先用知识工具取用点文件——必取 排版引擎/engine-write-protocol（本地渲染引擎协议：v2 语法/美术占位/风格声明/质量底线），再按需取 内容类型(type-*)、风格(style-*)、合规(comp-*)、文案(copy-*) 等本次创作真正用到的点。取完后若仍有影响成稿的关键点没弄清楚，就用自然对话问清楚（可以继续问，不必一次问完）；问清或获授权后输出 READY（仅此一词），随后会进入撰写阶段——正文可先用一两句自然说明，再以 ```v2 围栏给出。
```

## WRITE_INSTRUCTION（READY 后进入撰写的指令，随 digest 一起作为 user 消息）
```text
开始撰写正文：正文放进一个 ```v2 围栏代码块（不要 ```html）。正文前可以用普通文字自然说明（写好了/按什么风格/采纳什么默认）。
```

## 知识注册表壳措辞（buildRegistrySystem 固定前缀，注入在每条 system 的 persona 之后）
```text
## 知识注册表（目录。创作前会通过工具按需取用点文件，不要把它当正文）
<registry>
```
其中 `<registry>` = `src/knowledge/**/*.md` 全部文件名+短标（≤3500 字，见 `docs/ai-context-inventory.md` B 节；「排版引擎」组置于注册表首位，防截断吞掉引擎协议入口）。

## prep 工具循环的规则性引导（写在 `prep.ts` 注释，非发给模型）
工具循环≤3 轮：模型发起 tool_calls → 本地执行（读点文件/检索）→ 回传 tool 结果；3 轮不收敛则降级为直接撰写（不再把兜底话术当回复）。

## App digest 兜底（src/App.tsx，非发给模型的文案）
persona 精简后 v2 契约迁知识库——prep.ready 撰写路径若 digest 未含 engine-write-protocol（如模型未自觉取用/降级），App 调 `loadEngineProtocol()` 把协议全文强制附加进撰写上下文（compose 正确性的确定性来源，不依赖模型自觉）。
