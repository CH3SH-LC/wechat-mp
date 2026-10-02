# 2026-10-01 继续任务复核证据

用户要求“读取最新进度并指导 DS 继续”。复核基线 `472fd3dee16ad13587763e30dba456f4673c1128`；开始时工作树干净。本目录只保存离线复核与调查探针，未启动应用、未调用模型、未修改产品和正式 runner；不代表 F 通过。

执行任务以 [第二轮指南 §0：R1–R5](../../design/ds-repair-guide-2026-09-30.md#0-2026-10-01-继续执行入口) 为唯一入口。本次重新打开 A/E 的部分证据缺口，保留已有 B/C/D 产品修复。

## 已复现的问题

| 被测代码 | 方法与实际观察 | 证明边界 |
| --- | --- | --- |
| `scripts/lib/run-result.mjs:169–185` | 普通文件作为输出目录，写盘 EEXIST；子 runner 仍 PASS/exit 0，没有 `run-result.json` | 实际导入共享生产模块；只证明该写盘异常分支 |
| `live-acceptance.mjs:519–534` | 提取真实 invoke 包装器，21 次模拟模型命令全部转发 | 替身 IPC，零网络调用；不声称发生过实际超额费用 |
| `live-acceptance.mjs:956–1030` | 提取 `sendTurn`，额度 20、读到已发 21 后才点击停止 | 确定性时序证明事后检查，非真实环境超额频率 |
| `live-acceptance.mjs:1225–1266,1347–1354` | PID、CDP 页面、隔离目录、空工作区四项失败，真实 `runL1` 仍到 `sendTurn` | 全部使用虚构路径/替身读回，没有启动进程或写真实目录 |
| `live-acceptance.mjs:313–330` | 坏 schema 账本的既有累计 19/4 被重置 0/0；扩大参数 200/40 被接受 | 20/4 是指南执行默认值，不是用户硬金额；缺陷是静默重置及参数约束不足 |
| `live-acceptance.mjs:391–399,1300–1302` | 无 traces 目录返回值漏 `requests`，在记账前触发 TypeError | 模拟目录不存在；不能把不可观察当零请求 |
| `live-acceptance.mjs:1135–1210` | 19:00–17:00、错误年份/星期均通过；合法日期后加逗号则两项失败 | 这是验收脚本的事实判定错误，不是对产品事实保护的复测结论 |

## 原件与复跑

- 写盘失败：[说明](persistence/README.md)、[探针](persistence/reproduce.mjs)、[stdout](persistence/observed/stdout.log)、[stderr](persistence/observed/stderr.log)、[结果](persistence/observed/probe-result.json)。探针 exit 1 表示受测实现未满足预期；修复后 ERROR/非零子进程退出/无 PASS 才可变绿。
- live runner：[原函数提取探针](live-runner-offline-probe/probe.mjs)、[冻结结果](live-runner-offline-probe/result.json)。这是一份审计复现器，**exit 0 表示六组缺陷成功复现，不是产品验收通过**。DS 应将反例迁入正式回归，反转为正确行为期望，不能拿此探针绿灯签收产品。
- compose 离线复跑：98/98，exit 0；原始位置与哈希说明见 [persistence 记录](persistence/README.md)。App/Rust/浏览器全套和真实模型本次未重跑。

在仓库根执行，输出都使用新目录：

```powershell
$probeOut = Join-Path $env:TEMP ('wxmp-judge-persistence-' + [guid]::NewGuid().ToString('N'))
node docs/artifacts/2026-10-01-continuation-audit/persistence/reproduce.mjs $probeOut
# 当前预期 exit 1：揭示写盘失败仍 PASS 的缺陷。

node docs/artifacts/2026-10-01-continuation-audit/live-runner-offline-probe/probe.mjs
# 默认新建临时目录；当前 exit 0：缺陷成功复现。可用 --out 指定新目录。
```

live 探针遇已有 `result.json` 拒绝覆盖（实测 exit 1）；原冻结结果保持不变。原函数片段与生产文件 SHA-256 均在结果中。调查脚本不进入正式测试套件，不作为 release 变更；JSON 按既有仓库规则只保留本机原件。

## CDP 与构建证据边界

现存 exe 与中文 setup 已重新计算 SHA-256，等于 PROGRESS 最新记录；旧发布输入清单及 CDP 原始诊断未定位，不等于证明文件已丢失。不能用现在的输入清单倒填过去的构建前记录。

本地 wry 源码只证明 setter 被调用；微软 API 明确附加环境参数会追加，不能从 setter 推出环境变量无效。提升权限进程忽略环境覆盖是另一个待核实变量。[微软 API](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.622.22)、[参数及权限](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags)。修正后的 [排查记录](../../design/webview2-cdp-and-live-acceptance-2026-10-01.md) 保留历史观察，把根因改为待核实。
