# 2026-10-02 最新进度复核与 DS 继续依据

本次核对当前代码、未提交差异和实际结果文件，并运行零模型检查及隔离探针。**已有驱动器修改有实质进展，但 R1–R4 尚未整体闭环，F 的 L1–L6 业务验收未完成。** 继续任务见 [现有 DS 指南 §0.0](../../design/ds-repair-guide-2026-09-30.md#00-2026-10-02-最新复核与直接执行任务)。

Git HEAD 为 `472fd3d`；开始时工作区已有 20 个已跟踪文件修改和预算、事实、trace、preflight 等新脚本。本次保留这些改动，只新增调查证据并更新文档；没有修改产品或正式 runner，没有启动智序、读取模型密钥、修改全局预算账本或调用真实模型。浏览器负向复验只访问本机未监听端口。

## 本次直接复跑

| 检查 | 结果 | 证据及限制 |
| --- | --- | --- |
| compose | PASS 98/98 | `compose/run-result.json`、`compose/console.txt` |
| delivery-quality | PASS 123/123，12/12 场景 | `delivery/run-result.json`；生产模块离线检查 |
| budget | PASS 43/43 | `budget_result_audit-20261002-132657/budget-check/run-result.json`；未覆盖本次新增多实例/损坏账本反例 |
| live-driver | PASS 21/21 | `live-flow-audit/driver-existing/run-result.json`；纯模块绿灯，不能替代 live 接线 |
| fact-assert | PASS 20/20 | `live-flow-audit/facts-existing/run-result.json`；新增语义反例仍失败 |
| runner-negative，配置完整 | PASS 26/26 | `runner-negative-configured/run-result.json`；三个子 runner 都实到 `ERR_CONNECTION_REFUSED`，8 条落盘等负向用例也通过 |
| runner-negative，只指定 Playwright | FAIL 23/26 | `runner-negative-with-browser/run-result.json`；默认浏览器 1228 不存在，repair-flow 在启动异常后无判定文件。该反例保留，后续配置完整的通过不能消除这一异常处理缺口 |

另一个子审计的 runner-negative 为 26/26，但浏览器部分止于缺 Playwright；该范围已在其报告注明。主审计随后使用仓库开发文档中**实际存在**的模块和 Chromium 1234 路径补做导航失败复验，无需安装依赖。完整复跑命令如下，输出目录须换成新目录：

```powershell
$env:VERIFY_PLAYWRIGHT='D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright'
$env:VERIFY_CHROMIUM='C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
node scripts/runner-negative-check.mjs --out <新的绝对输出目录> 59998
```

## 独立反例与证据层次

- [预算与结果落盘](budget_result_audit-20261002-132657/README.md)：额度 1 的两个实例放行 2 次、盘上只记 1；负数计数/坏 phases 被接受；失败标记写盘错误被忽略；原 live 收尾函数生成 PASS 主判定、BLOCKED 报告和缺 status 附件。单写者页面门禁原字符串加假传输则通过。
- [live 调用链与事实断言](live-flow-audit/README.md)：原函数提取探针、纯模块检查和静态发现分别标注。15 个探针项中 3 个对照符合、12 个边界差异，**不是 12 个独立产品缺陷，也不是桌面入口运行**。包括绘图计数接线、L3 未定义变量、trace 少记、关闭失败误标、失败版基准、错误事实假绿和合法紧凑文本假红。
- [CDP 诊断与收尾](cdp-evidence-audit/README.md)：身份不匹配/UNKNOWN 仍关闭 PID 的完全 mock 反例；矩阵写错 cwd、收尾恒真、DevToolsActivePort 目录少一层。未执行实时 CDP 重试；没有操作历史 PID。

这些调查探针可能写固定相邻结果文件，后续不要在原目录重跑并覆盖历史证据。应把精确输入和断言迁入正式可注入依赖的 runner，使用新输出目录保留修复后结果。`probe` 的 exit 0 仅表示调查完成，不是产品 PASS。

## 新定位的历史记录

`historical-results/manifest.json` 登记原件路径、SHA-256 和副本一致性，四份副本全部哈希一致：

| 副本 | 原时间（北京时间） | 观察 |
| --- | --- | --- |
| `L1-r5.json` | 10-01 16:49:52 开始 | L1 启动 CDP 90 秒无页面，BLOCKED，0 个业务检查 |
| `L1-r5b.json` | 10-01 16:53:57 开始 | 再次 L1 启动 BLOCKED，0 个业务检查 |
| `L2-r5b.json` | 10-01 16:55:37 开始 | 持久业务失败标记阻断后续付费 phase，BLOCKED |
| `cdp-matrix.json` | 10-01 16:39 左右 | B 格六次回环连接失败；C 格 Edge HTTP 可达；完整身份与收尾证据不足 |

`historical-results/suite-summary.json` 索引 `%TEMP%/wxmp-suite` 的 17 份直接子目录结果及哈希，均为 10-01 的历史 PASS；嵌套 photo-swallow 及故障注入子结果未计入这 17 份。此处仅证明读到这些原件，不代表本次全部重新执行，也不证明历史结果与今日未提交源码完全一致。

## 版本和边界

`source-fingerprints.json` 登记本次审计的 14 个脚本/模块的完整 SHA-256、长度和修改时间；`evidence-index.json` 登记本轮证据文件的 SHA-256。exe 与 setup 本次重新取哈希：

- `wechat-mp-desktop.exe`：`bdbf102ae5a0aced6d3bf6d283f1f93c8e118484edb0356e2e4cedf8bb9edd29`
- `智序_0.1.0_x64-setup.exe`：`7c610fc0380c15f10bb1a7008b8218df792bb09d6a1461057433f7fec156f25d`

两者与 10-01 记录一致。本次未重建、未做桌面启动冒烟、未做真实保存重开/导出或实际尺寸成品检查。真实模型授权继续有效，但不能用授权或历史计数代替未完成的门槛。
