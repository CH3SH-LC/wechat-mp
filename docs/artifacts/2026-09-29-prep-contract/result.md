# 准备阶段结果契约 —— 离线回归

时间：2026-09-29T08:36:03.626Z
入口：`node scripts/prep-contract-check.mjs docs\artifacts\2026-09-29-prep-contract http://127.0.0.1:1420`
被测：`src/lib/prep.ts`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）
源码哈希：`a7966100d66ca31dc67de1e3a1cdfd0f46160045fb8afca1f9ea778618d73d7f`

**结果：全部 PASS**

```
  PASS - valid-compose：没有抛异常
  PASS - valid-compose：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
  PASS - valid-compose：结果类型 = compose (实测 prep/compose)
  PASS - valid-compose：assetPolicy = preserve (实测 preserve)
  PASS - valid-compose：知识摘要随结果带出
  PASS - valid-compose：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
  PASS - valid-compose：prep 上报次数与知识工具调用一致 (prep×1（首轮知识调用=true）)
  PASS - valid-compose：前一轮的知识工具结果确实回传给了模型 (第二次请求含 tool 消息=true)
  PASS - valid-reply：没有抛异常
  PASS - valid-reply：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
  PASS - valid-reply：结果类型 = reply (实测 prep/reply)
  PASS - valid-reply：答复文本已带出 (请问面向哪类读者？)
  PASS - valid-reply：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
  PASS - valid-reply：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - valid-candidate：没有抛异常
  PASS - valid-candidate：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
  PASS - valid-candidate：结果类型 = candidate (实测 prep/candidate)
  PASS - valid-candidate：assetPolicy = modify (实测 modify)
  PASS - valid-candidate：正文进入交付（不是只存聊天） ([[theme:校园]]

## 周末到馆提醒

各位读者：

- **10月1…)
  PASS - valid-candidate：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
  PASS - valid-candidate：prep 上报次数与知识工具调用一致 (prep×1（首轮知识调用=true）)
  PASS - valid-candidate：前一轮的知识工具结果确实回传给了模型 (第二次请求含 tool 消息=true)
  PASS - f2-explanation-then-ready：没有抛异常
  PASS - f2-explanation-then-ready：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
  PASS - f2-explanation-then-ready：结果类型 = compose (实测 prep/compose)
  PASS - f2-explanation-then-ready：标为旧协议兼容转换（可追溯）
  PASS - f2-explanation-then-ready：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
  PASS - f2-explanation-then-ready：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - f2-explanation-then-ready：兼容转换前确实先做过一次协议纠偏（不是直接猜测） (纠偏请求已发出=true)
  PASS - f3-complete-v2-reply：没有抛异常
  PASS - f3-complete-v2-reply：请求次数等于预期（无第 4 次准备请求） (实测 2（期望 2，上限 3）)
  PASS - f3-complete-v2-reply：结果类型 = candidate (实测 prep/candidate)
  PASS - f3-complete-v2-reply：标为旧协议兼容转换（可追溯）
  PASS - f3-complete-v2-reply：正文进入交付（不是只存聊天） ([[theme:校园]]

## 周末到馆提醒

各位读者：

- **10月1…)
  PASS - f3-complete-v2-reply：每次模型往返恰好一次 think 阶段上报 (think×2，往返 2 次)
  PASS - f3-complete-v2-reply：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - f3-complete-v2-reply：兼容转换前确实先做过一次协议纠偏（不是直接猜测） (纠偏请求已发出=true)
  PASS - chat-with-ready-and-v2-example：没有抛异常
  PASS - chat-with-ready-and-v2-example：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
  PASS - chat-with-ready-and-v2-example：结果类型 = reply (实测 prep/reply)
  PASS - chat-with-ready-and-v2-example：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
  PASS - chat-with-ready-and-v2-example：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - candidate-without-source：没有抛异常
  PASS - candidate-without-source：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
  PASS - candidate-without-source：结果类型 = failed (实测 prep/failed)
  PASS - candidate-without-source：失败分类 = protocol (实测 protocol)
  PASS - candidate-without-source：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
  PASS - candidate-without-source：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - two-terminal-tools：没有抛异常
  PASS - two-terminal-tools：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
  PASS - two-terminal-tools：结果类型 = failed (实测 prep/failed)
  PASS - two-terminal-tools：失败分类 = protocol (实测 protocol)
  PASS - two-terminal-tools：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
  PASS - two-terminal-tools：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - exhausted-empty-replies：没有抛异常
  PASS - exhausted-empty-replies：请求次数等于预期（无第 4 次准备请求） (实测 3（期望 3，上限 3）)
  PASS - exhausted-empty-replies：结果类型 = failed (实测 prep/failed)
  PASS - exhausted-empty-replies：失败分类 = exhausted (实测 exhausted)
  PASS - exhausted-empty-replies：每次模型往返恰好一次 think 阶段上报 (think×3，往返 3 次)
  PASS - exhausted-empty-replies：prep 上报次数与知识工具调用一致 (prep×0（首轮知识调用=false）)
  PASS - knowledge-then-terminal-in-one-response：没有抛异常
  PASS - knowledge-then-terminal-in-one-response：请求次数等于预期（无第 4 次准备请求） (实测 1（期望 1，上限 3）)
  PASS - knowledge-then-terminal-in-one-response：结果类型 = compose (实测 prep/compose)
  PASS - knowledge-then-terminal-in-one-response：知识摘要随结果带出
  PASS - knowledge-then-terminal-in-one-response：每次模型往返恰好一次 think 阶段上报 (think×1，往返 1 次)
  PASS - knowledge-then-terminal-in-one-response：prep 上报次数与知识工具调用一致 (prep×1（首轮知识调用=true）)
  PASS - 纯函数边界：multipleFencesIsNull (true)
  PASS - 纯函数边界：singleFenceOk (true)
  PASS - 纯函数边界：unclosedFenceIsNull (true)
  PASS - 纯函数边界：replyWithoutTextRejected (true)
  PASS - 纯函数边界：unknownOutcomeRejected (true)
  PASS - 纯函数边界：badJsonRejected (true)
  PASS - 全程无页面异常
```
