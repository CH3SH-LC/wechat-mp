# 准备阶段结果契约 —— 回归

状态：**PASS**（executionComplete=true，检查 231/231 通过）
时间：2026-10-07T19:59:03.104Z → 2026-10-07T19:59:10.325Z
入口：`node scripts/prep-contract-check.mjs docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/A/runs/00-baseline-before http://127.0.0.1:1437`
被测：`src/lib/prep.ts`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）+ `src/App.tsx` 接线断言
源码哈希：`{"src/lib/prep.ts":"6d7bc7ebc2cd25d0782e6df69f695fdc0d1995ddb987f6a0c1483f3e483f5409","src/App.tsx":"8a04066497b41924e0a69b81f924e6beeeb44bd5bd33efc10e8b61afb560b7b7"}`

```
PASS - valid-compose：没有抛异常
PASS - valid-compose：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - valid-compose：结果类型 = compose (实测 prep/compose)
PASS - valid-compose：assetPolicy = preserve (实测 preserve)
PASS - valid-compose：知识摘要随结果带出
PASS - valid-compose：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - valid-compose：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - valid-compose：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - valid-compose：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - valid-compose：前一轮的知识工具结果确实回传给了模型 (第二次请求含 tool 消息=true)
PASS - valid-reply：没有抛异常
PASS - valid-reply：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - valid-reply：结果类型 = reply (实测 prep/reply)
PASS - valid-reply：答复文本已带出 (请问面向哪类读者？)
PASS - valid-reply：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - valid-reply：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - valid-reply：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - valid-reply：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - valid-candidate：没有抛异常
PASS - valid-candidate：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - valid-candidate：结果类型 = candidate (实测 prep/candidate)
PASS - valid-candidate：assetPolicy = modify (实测 modify)
PASS - valid-candidate：正文进入交付（不是只存聊天） ([[theme:校园]]

## 周末到馆提醒

各位读者：

- **10月1)
PASS - valid-candidate：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - valid-candidate：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - valid-candidate：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - valid-candidate：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - valid-candidate：前一轮的知识工具结果确实回传给了模型 (第二次请求含 tool 消息=true)
PASS - ready-only-no-longer-authorized：没有抛异常
PASS - ready-only-no-longer-authorized：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - ready-only-no-longer-authorized：结果类型 = failed (实测 prep/failed)
PASS - ready-only-no-longer-authorized：失败分类 = protocol (实测 protocol)
PASS - ready-only-no-longer-authorized：未形成合法终结的原文被保留（failed.raw） (需要的信息已齐备。

READY)
PASS - ready-only-no-longer-authorized：确实追加过一次协议纠偏请求 (纠偏请求已发出=true)
PASS - ready-only-no-longer-authorized：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - ready-only-no-longer-authorized：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - ready-only-no-longer-authorized：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - fenced-v2-without-declaration：没有抛异常
PASS - fenced-v2-without-declaration：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - fenced-v2-without-declaration：结果类型 = failed (实测 prep/failed)
PASS - fenced-v2-without-declaration：失败分类 = protocol (实测 protocol)
PASS - fenced-v2-without-declaration：未形成合法终结的原文被保留（failed.raw） (```v2
[[theme:校园]]

## 周末到馆提醒

各位读者：

- )
PASS - fenced-v2-without-declaration：确实追加过一次协议纠偏请求 (纠偏请求已发出=true)
PASS - fenced-v2-without-declaration：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - fenced-v2-without-declaration：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - fenced-v2-without-declaration：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - fenced-v2-then-declares-candidate：没有抛异常
PASS - fenced-v2-then-declares-candidate：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - fenced-v2-then-declares-candidate：结果类型 = candidate (实测 prep/candidate)
PASS - fenced-v2-then-declares-candidate：assetPolicy = preserve (实测 preserve)
PASS - fenced-v2-then-declares-candidate：正文进入交付（不是只存聊天） ([[theme:校园]]

## 周末到馆提醒

各位读者：

- **10月1)
PASS - fenced-v2-then-declares-candidate：确实追加过一次协议纠偏请求 (纠偏请求已发出=true)
PASS - fenced-v2-then-declares-candidate：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - fenced-v2-then-declares-candidate：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - fenced-v2-then-declares-candidate：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - r2-history-creation-plain-question-not-ready：没有抛异常
PASS - r2-history-creation-plain-question-not-ready：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - r2-history-creation-plain-question-not-ready：结果类型 = failed (实测 prep/failed)
PASS - r2-history-creation-plain-question-not-ready：失败分类 = protocol (实测 protocol)
PASS - r2-history-creation-plain-question-not-ready：未形成合法终结的原文被保留（failed.raw） (NOT READY 是旧协议里的"尚未就绪"标记。)
PASS - r2-history-creation-plain-question-not-ready：确实追加过一次协议纠偏请求 (纠偏请求已发出=true)
PASS - r2-history-creation-plain-question-not-ready：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - r2-history-creation-plain-question-not-ready：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - r2-history-creation-plain-question-not-ready：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - r2-v2-example-then-declares-reply：没有抛异常
PASS - r2-v2-example-then-declares-reply：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - r2-v2-example-then-declares-reply：结果类型 = reply (实测 prep/reply)
PASS - r2-v2-example-then-declares-reply：答复文本已带出 (上面就是 v2 的大致写法，只是举例。)
PASS - r2-v2-example-then-declares-reply：确实追加过一次协议纠偏请求 (纠偏请求已发出=true)
PASS - r2-v2-example-then-declares-reply：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - r2-v2-example-then-declares-reply：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - r2-v2-example-then-declares-reply：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - plain-chat-answer：没有抛异常
PASS - plain-chat-answer：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - plain-chat-answer：结果类型 = reply (实测 prep/reply)
PASS - plain-chat-answer：答复文本已带出 (开头三秒抓人，先给结论再给理由。)
PASS - plain-chat-answer：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - plain-chat-answer：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - plain-chat-answer：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - plain-chat-answer：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-missing-assetPolicy：没有抛异常
PASS - strict-missing-assetPolicy：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-missing-assetPolicy：结果类型 = failed (实测 prep/failed)
PASS - strict-missing-assetPolicy：失败分类 = protocol (实测 protocol)
PASS - strict-missing-assetPolicy：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-missing-assetPolicy：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-missing-assetPolicy：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-missing-assetPolicy：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-bad-assetPolicy：没有抛异常
PASS - strict-bad-assetPolicy：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-bad-assetPolicy：结果类型 = failed (实测 prep/failed)
PASS - strict-bad-assetPolicy：失败分类 = protocol (实测 protocol)
PASS - strict-bad-assetPolicy：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-bad-assetPolicy：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-bad-assetPolicy：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-bad-assetPolicy：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-candidate-source-not-string：没有抛异常
PASS - strict-candidate-source-not-string：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-candidate-source-not-string：结果类型 = failed (实测 prep/failed)
PASS - strict-candidate-source-not-string：失败分类 = protocol (实测 protocol)
PASS - strict-candidate-source-not-string：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-candidate-source-not-string：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-candidate-source-not-string：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-candidate-source-not-string：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-candidate-source-blank：没有抛异常
PASS - strict-candidate-source-blank：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-candidate-source-blank：结果类型 = failed (实测 prep/failed)
PASS - strict-candidate-source-blank：失败分类 = protocol (实测 protocol)
PASS - strict-candidate-source-blank：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-candidate-source-blank：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-candidate-source-blank：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-candidate-source-blank：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-reply-text-not-string：没有抛异常
PASS - strict-reply-text-not-string：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-reply-text-not-string：结果类型 = failed (实测 prep/failed)
PASS - strict-reply-text-not-string：失败分类 = protocol (实测 protocol)
PASS - strict-reply-text-not-string：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-reply-text-not-string：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-reply-text-not-string：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-reply-text-not-string：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-exclusive-fields：没有抛异常
PASS - strict-exclusive-fields：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-exclusive-fields：结果类型 = failed (实测 prep/failed)
PASS - strict-exclusive-fields：失败分类 = protocol (实测 protocol)
PASS - strict-exclusive-fields：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-exclusive-fields：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-exclusive-fields：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-exclusive-fields：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-top-level-array：没有抛异常
PASS - strict-top-level-array：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-top-level-array：结果类型 = failed (实测 prep/failed)
PASS - strict-top-level-array：失败分类 = protocol (实测 protocol)
PASS - strict-top-level-array：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-top-level-array：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-top-level-array：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-top-level-array：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-top-level-null：没有抛异常
PASS - strict-top-level-null：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-top-level-null：结果类型 = failed (实测 prep/failed)
PASS - strict-top-level-null：失败分类 = protocol (实测 protocol)
PASS - strict-top-level-null：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-top-level-null：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-top-level-null：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-top-level-null：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - strict-outcome-not-string：没有抛异常
PASS - strict-outcome-not-string：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - strict-outcome-not-string：结果类型 = failed (实测 prep/failed)
PASS - strict-outcome-not-string：失败分类 = protocol (实测 protocol)
PASS - strict-outcome-not-string：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - strict-outcome-not-string：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - strict-outcome-not-string：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - strict-outcome-not-string：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - two-terminal-tools：没有抛异常
PASS - two-terminal-tools：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - two-terminal-tools：结果类型 = failed (实测 prep/failed)
PASS - two-terminal-tools：失败分类 = protocol (实测 protocol)
PASS - two-terminal-tools：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - two-terminal-tools：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - two-terminal-tools：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - two-terminal-tools：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - knowledge-mixed-with-terminal：没有抛异常
PASS - knowledge-mixed-with-terminal：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - knowledge-mixed-with-terminal：结果类型 = failed (实测 prep/failed)
PASS - knowledge-mixed-with-terminal：失败分类 = protocol (实测 protocol)
PASS - knowledge-mixed-with-terminal：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - knowledge-mixed-with-terminal：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - knowledge-mixed-with-terminal：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - knowledge-mixed-with-terminal：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - third-call-legal-terminal-executes：没有抛异常
PASS - third-call-legal-terminal-executes：请求次数等于预期（无第 4 次准备请求） (实测 3（期望 3，上限 3）)
PASS - third-call-legal-terminal-executes：结果类型 = compose (实测 prep/compose)
PASS - third-call-legal-terminal-executes：assetPolicy = modify (实测 modify)
PASS - third-call-legal-terminal-executes：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - third-call-legal-terminal-executes：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - third-call-legal-terminal-executes：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0,1]，期望=[0,0,1]（往返 3 次，上限 3）)
PASS - third-call-legal-terminal-executes：每次模型往返恰好一次 think 阶段上报 (think×3，往返 3 次)
PASS - third-call-legal-terminal-executes：前一轮的知识工具结果确实回传给了模型 (第二次请求含 tool 消息=true)
PASS - exhausted-empty-replies：没有抛异常
PASS - exhausted-empty-replies：请求次数等于预期（无第 4 次准备请求） (实测 3（期望 3，上限 3）)
PASS - exhausted-empty-replies：结果类型 = failed (实测 prep/failed)
PASS - exhausted-empty-replies：失败分类 = exhausted (实测 exhausted)
PASS - exhausted-empty-replies：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - exhausted-empty-replies：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - exhausted-empty-replies：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0,1]，期望=[0,0,1]（往返 3 次，上限 3）)
PASS - exhausted-empty-replies：每次模型往返恰好一次 think 阶段上报 (think×3，往返 3 次)
PASS - exhausted-knowledge-only：没有抛异常
PASS - exhausted-knowledge-only：请求次数等于预期（无第 4 次准备请求） (实测 3（期望 3，上限 3）)
PASS - exhausted-knowledge-only：结果类型 = failed (实测 prep/failed)
PASS - exhausted-knowledge-only：失败分类 = exhausted (实测 exhausted)
PASS - exhausted-knowledge-only：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - exhausted-knowledge-only：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - exhausted-knowledge-only：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0,1]，期望=[0,0,1]（往返 3 次，上限 3）)
PASS - exhausted-knowledge-only：每次模型往返恰好一次 think 阶段上报 (think×3，往返 3 次)
PASS - duplicate-knowledge-reads-cached：没有抛异常
PASS - duplicate-knowledge-reads-cached：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
PASS - duplicate-knowledge-reads-cached：结果类型 = compose (实测 prep/compose)
PASS - duplicate-knowledge-reads-cached：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - duplicate-knowledge-reads-cached：知识工具只执行一次（重复读取复用回合内缓存） (prep 上报 1 次（期望 1）)
PASS - duplicate-knowledge-reads-cached：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - duplicate-knowledge-reads-cached：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0,0]，期望=[0,0]（往返 2 次，上限 3）)
PASS - duplicate-knowledge-reads-cached：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
PASS - duplicate-knowledge-reads-cached：前一轮的知识工具结果确实回传给了模型 (第二次请求含 tool 消息=true)
PASS - images-preserved-into-prep：没有抛异常
PASS - images-preserved-into-prep：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
PASS - images-preserved-into-prep：结果类型 = reply (实测 prep/reply)
PASS - images-preserved-into-prep：不该发纠偏时没有发 (纠偏请求已发出=false)
PASS - images-preserved-into-prep：本回合参考图随用户消息送到了模型 (首次请求含 images=true)
PASS - images-preserved-into-prep：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复" (首次请求含该规则=true)
PASS - images-preserved-into-prep：最后一次准备请求真的带上了预算提醒（且只在最后一次） (各次提醒条数=[0]，期望=[0]（往返 1 次，上限 3）)
PASS - images-preserved-into-prep：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
PASS - 纯函数边界：multipleFencesIsNull (true)
PASS - 纯函数边界：singleFenceOk (true)
PASS - 纯函数边界：unclosedFenceIsNull (true)
PASS - 纯函数边界：replyWithoutTextRejected (true)
PASS - 纯函数边界：unknownOutcomeRejected (true)
PASS - 纯函数边界：badJsonRejected (true)
PASS - 纯函数边界：topLevelArrayRejected (true)
PASS - 纯函数边界：topLevelNullRejected (true)
PASS - 纯函数边界：topLevelNumberRejected (true)
PASS - 纯函数边界：emptyObjectRejected (true)
PASS - 纯函数边界：composeWithoutPolicyRejected (true)
PASS - 纯函数边界：candidateNonStringSourceRejected (true)
PASS - 纯函数边界：replyNumberTextRejected (true)
PASS - 纯函数边界：exclusiveFieldsRejected (true)
PASS - 纯函数边界：composeAcceptsExplicitPolicy (true)
PASS - 纯函数边界：candidateAcceptsExplicitPolicy (true)
PASS - 接线：App 不再有 creationContract 入参（历史创作布尔值不参与授权）
PASS - 接线：App 不再有 creativeSession 历史创作态变量
PASS - 接线：App 调用 runPrep 时不传任何授权开关
PASS - 接线：读取当前文稿失败会终止本轮（不是 console.warn 后继续）
PASS - 全程无页面异常
```
