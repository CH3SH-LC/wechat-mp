# 运行器判定器负向回归

时间：2026-10-02T05:32:31.429Z
入口：`node scripts/runner-negative-check.mjs D:\deepseek-harness\wechat-mp-desktop\docs\artifacts\2026-10-02-continuation-review\runner-negative-with-browser 59998`

## 一、错误端口（每个运行器连一个没有服务在听的本机端口）

断言"退出非 0 + 状态 ERROR/BLOCKED + 不产出全通过结论"。

## 二、判定器写盘失败（指南 §0.2 R1）

子进程导入**真实** `scripts/lib/run-result.mjs`，逐项断言"写盘失败 → 非 0 且不打印 PASS"。

- PASS — 合法目录：正常通过并留下判定文件（exit=0 期望：exit=0、打印 PASS、run-result.json 存在且状态 PASS）
- PASS — 输出路径是普通文件（mkdir EEXIST）（exit=1 期望：退出非 0、不打印 PASS、打印 ERROR）
- PASS — 主判定文件写不出去（run-result.json 是目录）（exit=1 期望：退出非 0、不打印 PASS、判定路径下没有写着 PASS 的文件）
- PASS — 必需附件写失败（report.md 是目录）（exit=1 期望：退出非 0、不打印 PASS、判定文件已写成 ERROR 并带 persist 错误）
- PASS — 目录里有过时 PASS 且本次附件失败 → 过时 PASS 必须被更新（exit=1 期望：原先那份 PASS 不再留在原地，被本次 ERROR 判定取代）
- PASS — 重复调用 finish 不得把失败翻绿（exit=1 期望：两次调用只产出一条判定行、两次返回值都是 ERROR、退出非 0）
- PASS — 未捕获异常经 guardCrashes 落成 ERROR（坏目录下也不假绿）（exit=1 期望：退出非 0、判定为 ERROR、全程没有 PASS 字样）
- PASS — 必需检查条数下界（minChecks）不足时不是 PASS（exit=1 期望：只跑了 1 条而声明至少 3 条 → ERROR，不是"至少跑了一条就算过"）

**结果：FAIL**（检查 23/26 通过，3 条红）

- PASS - preview-resource-check：错误端口下退出码非 0 (exit=1)
- PASS - preview-resource-check：产出了唯一判定结果文件
- PASS - preview-resource-check：状态是 ERROR 或 BLOCKED（不是 PASS/FAIL） (status=ERROR)
- PASS - preview-resource-check：executionComplete 不为 true (executionComplete=false)
- PASS - preview-resource-check：没有任何"全部 PASS"式的结论行 (stdout 里不得出现全通过字样)
- PASS - preview-resource-check：报告里写明了具体错误（不是静默失败） ([runner] browserType.launch: Executable doesn't exist at C:\Users\Lenovo\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe)
- PASS - prep-contract-check：错误端口下退出码非 0 (exit=1)
- PASS - prep-contract-check：产出了唯一判定结果文件
- PASS - prep-contract-check：状态是 ERROR 或 BLOCKED（不是 PASS/FAIL） (status=ERROR)
- PASS - prep-contract-check：executionComplete 不为 true (executionComplete=false)
- PASS - prep-contract-check：没有任何"全部 PASS"式的结论行 (stdout 里不得出现全通过字样)
- PASS - prep-contract-check：报告里写明了具体错误（不是静默失败） ([runner] browserType.launch: Executable doesn't exist at C:\Users\Lenovo\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe)
- PASS - repair-flow-check：错误端口下退出码非 0 (exit=1)
- FAIL - repair-flow-check：产出了唯一判定结果文件
- FAIL - repair-flow-check：状态是 ERROR 或 BLOCKED（不是 PASS/FAIL） (status=null)
- PASS - repair-flow-check：executionComplete 不为 true (executionComplete=null)
- PASS - repair-flow-check：没有任何"全部 PASS"式的结论行 (stdout 里不得出现全通过字样)
- FAIL - repair-flow-check：报告里写明了具体错误（不是静默失败） (（无 errors）)
- PASS - 判定器写盘：合法目录：正常通过并留下判定文件 (exit=0 期望：exit=0、打印 PASS、run-result.json 存在且状态 PASS)
- PASS - 判定器写盘：输出路径是普通文件（mkdir EEXIST） (exit=1 期望：退出非 0、不打印 PASS、打印 ERROR)
- PASS - 判定器写盘：主判定文件写不出去（run-result.json 是目录） (exit=1 期望：退出非 0、不打印 PASS、判定路径下没有写着 PASS 的文件)
- PASS - 判定器写盘：必需附件写失败（report.md 是目录） (exit=1 期望：退出非 0、不打印 PASS、判定文件已写成 ERROR 并带 persist 错误)
- PASS - 判定器写盘：目录里有过时 PASS 且本次附件失败 → 过时 PASS 必须被更新 (exit=1 期望：原先那份 PASS 不再留在原地，被本次 ERROR 判定取代)
- PASS - 判定器写盘：重复调用 finish 不得把失败翻绿 (exit=1 期望：两次调用只产出一条判定行、两次返回值都是 ERROR、退出非 0)
- PASS - 判定器写盘：未捕获异常经 guardCrashes 落成 ERROR（坏目录下也不假绿） (exit=1 期望：退出非 0、判定为 ERROR、全程没有 PASS 字样)
- PASS - 判定器写盘：必需检查条数下界（minChecks）不足时不是 PASS (exit=1 期望：只跑了 1 条而声明至少 3 条 → ERROR，不是"至少跑了一条就算过")
