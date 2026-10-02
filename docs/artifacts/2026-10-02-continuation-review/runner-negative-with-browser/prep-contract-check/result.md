# 准备阶段结果契约 —— 回归

状态：**ERROR**（executionComplete=false，检查 0/0 通过）
时间：2026-10-02T05:32:29.929Z → 2026-10-02T05:32:30.158Z
入口：`node scripts/prep-contract-check.mjs D:\deepseek-harness\wechat-mp-desktop\docs\artifacts\2026-10-02-continuation-review\runner-negative-with-browser\prep-contract-check http://127.0.0.1:59998`
被测：`src/lib/prep.ts`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）+ `src/App.tsx` 接线断言
源码哈希：`{"src/lib/prep.ts":"3ab06f879f53967403ad0cec97521bc8947e918b9d7e7d47e7695ada36f1f8b7","src/App.tsx":"2fd22ab0c5aac6bb74fea1a3b83a035f1318d537a6745f41c625acb8041075fa"}`

## 错误

- [runner] browserType.launch: Executable doesn't exist at C:\Users\Lenovo\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe

```

```
