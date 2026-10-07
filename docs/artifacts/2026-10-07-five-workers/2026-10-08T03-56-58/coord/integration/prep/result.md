# 准备阶段结果契约 —— 回归

状态：**ERROR**（executionComplete=false，检查 0/0 通过）
时间：2026-10-07T20:14:24.311Z → 2026-10-07T20:14:24.315Z
入口：`node scripts/prep-contract-check.mjs docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/coord/integration/prep http://127.0.0.1:1439`
被测：`src/lib/prep.ts`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）+ `src/App.tsx` 接线断言
源码哈希：`{"src/lib/prep.ts":"db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f","src/App.tsx":"8a04066497b41924e0a69b81f924e6beeeb44bd5bd33efc10e8b61afb560b7b7"}`

## 错误

- [outDir] 输出目录已存在同名结果，拒绝覆盖：docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/coord/integration/prep

```

```
