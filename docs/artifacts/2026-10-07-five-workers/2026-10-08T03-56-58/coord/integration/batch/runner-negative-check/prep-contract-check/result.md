# 准备阶段结果契约 —— 回归

状态：**ERROR**（executionComplete=false，检查 0/0 通过）
时间：2026-10-07T20:17:44.199Z → 2026-10-07T20:17:50.143Z
入口：`node scripts/prep-contract-check.mjs D:\deepseek-harness\wechat-mp-desktop\docs\artifacts\2026-10-07-five-workers\2026-10-08T03-56-58\coord\integration\batch\runner-negative-check\prep-contract-check http://127.0.0.1:59999`
被测：`src/lib/prep.ts`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）+ `src/App.tsx` 接线断言
源码哈希：`{"src/lib/prep.ts":"db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f","src/App.tsx":"8a04066497b41924e0a69b81f924e6beeeb44bd5bd33efc10e8b61afb560b7b7"}`

## 错误

- [navigate] 打开 http://127.0.0.1:59999 失败：page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:59999/

```

```
