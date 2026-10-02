# 运行结果无法落盘却仍 PASS：2026-10-01 独立复现

本次只做离线探针；未修改产品源码、未启动应用、未请求模型，也未写真实作品目录。审计基线为 `472fd3dee16ad13587763e30dba456f4673c1128`。

## 实际结果

`scripts/lib/run-result.mjs:169–185` 的 `finish()` 在 `mkdirSync/writeFileSync` 抛错时只打印错误，不把最终状态改为 ERROR，也不改退出码。将证据输出目录指向一个新建的普通文件后：

| 实测项 | 结果 |
| --- | --- |
| 写入结果 | `EEXIST: file already exists, mkdir .../not-a-directory` |
| 子 runner 最终结论 | `PERSIST-FAILURE-PROOF PASS` |
| 子 runner 退出码 | `0` |
| `run-result.json` | 没有产出 |
| 本探针期望 | ERROR、非零退出、不打印 PASS |
| 本探针结果与退出码 | FAIL、1 |

这是 A/E 的一个新反例，不能继续将“共享判定器已覆盖异常且全部关闭”作为当前完整结论。正常断言全绿不能替代对证据落盘失败的处理。

原始输出在 [observed/stdout.log](observed/stdout.log)、[observed/stderr.log](observed/stderr.log)、[observed/probe-result.json](observed/probe-result.json)。JSON 按仓库既有规则不进入 Git，原件保留在本机。

## 可复跑命令

从仓库根运行；每次新目录，不能覆盖 `observed`：

```powershell
$probeOut = Join-Path $env:TEMP ('wxmp-judge-persistence-' + [guid]::NewGuid().ToString('N'))
node docs/artifacts/2026-10-01-continuation-audit/persistence/reproduce.mjs $probeOut
# 当前缺陷仍在时 exit 1；修正后满足 ERROR + 非零子进程退出 + 无 PASS 才 exit 0。
```

探针故意让唯一判定文件无法写入，不要求在同一不可写位置凭空生成 JSON；要求内存判定和最终退出码如实失败，并在可用的 stderr 留下原因。DS 应同时覆盖 `extraFiles` 写入失败，防止部分证据缺失而正式验收仍 PASS。

## 溯源

- 被测源码 `scripts/lib/run-result.mjs` SHA-256：`5d5f235d54ad56d0be2bdb9738acb6bc28f5f1d864fef05d6977cdbf10c669cc`。
- 探针 `reproduce.mjs` SHA-256：`1b9c18f3dbde446d3b9f077e345abf06a4cf91ba3f774a2adc9b07804fa119c0`。
- 本次正式复现命令：`node docs/artifacts/2026-10-01-continuation-audit/persistence/reproduce.mjs docs/artifacts/2026-10-01-continuation-audit/persistence/observed`。
- 同轮在独立临时目录运行 `node scripts/compose-check.mjs --out <new-directory>`：exit 0、PASS、98/98。该结果只覆盖 compose 离线回归，不能证明 App、桌面或真实模型验收。
- compose 原件：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-codex-evidence-audit-52a3c8d6ee904b36a2f3ccbfda6d34f0\compose\run-result.json`；日志在同级 `compose.log`。

## 发布输入审计补充

现存 exe/setup 的 SHA-256 与 PROGRESS 最新记录一致（`bdbf102a...` / `7c610fc0...`）。这只证明本机二进制等于已记录的二进制，不单独证明完整构建输入对应关系。

当前 `input-manifest.mjs` 运行得到 645 项、46,975,998 字节，其中 `docs/artifacts` 历史输出占 330 项、41,843,545 字节。`scripts/input-manifest.mjs:33–57` 只排除若干目录与 exe/msi，仍纳入历史截图/日志等输出；`:93–104` 未记录构建参数或本次二进制身份。PROGRESS 所记旧清单仅有哈希/摘要，没有原件定位及构建前后、验收后同集合差异报告，本次未找到其原件，不能据此反推旧清单已丢失。

DS 继续时应先定位旧原件并记录路径；不能找到则标记旧对应性未独立核验。下一次正式构建按指南 §7 固定输入集合，分别保存构建前/后和验收后清单与比较结果，并将 exe/setup 哈希、构建命令、工具版本、runner 源码哈希及证据路径关联起来。当前补采清单不能补写成历史构建前证据。
