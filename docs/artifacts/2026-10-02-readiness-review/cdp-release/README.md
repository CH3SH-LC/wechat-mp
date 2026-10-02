# 2026-10-02 readiness：CDP、发布原件与收尾身份复核

本轮只读源码和既有原件，新增文件仅在本目录。未启动或终止真实应用/浏览器，未操作历史 PID，未调用模型，未修改正式 runner、产品源码、全局配置或历史结果。实际执行的检查仅为公开依赖注入的假进程探针，以及纯 mock 的 cdp-preflight-check。

## 最新结论

**晚间指出的两条具体身份缺口现已修复，并经同形反例独立重跑确认。默认发布二进制的构建、输入清单、隔离启动冒烟及既有 L5/L6 CDP 目标证据存在。15 个离线 runner + 4 个浏览器 runner、Rust 133 passed 都能定位到原始凭证。**

这不是“本轮重跑全部测试”：本轮实际重跑只有 30 项 CDP 纯 mock 回归和本目录四例身份探针，其余为原件核验。CDP 首次 90 秒、再次 432 毫秒的精确数字仅在执行文档中找到声明；原探针只向控制台输出，本次未定位到完整控制台结果。因此不能把两组数字当成本轮独立核实的原件。默认发布版能被 CDP 驱动由已有 L5/L6 的真实目标记录独立支持。

## 1. 两个旧身份反例已从危险操作转为拒绝

当前源码：

- `scripts/lib/desktop-harness.mjs:266–291`：有预期路径/创建时间而实测缺字段时置 `matchesExpected=null`。
- `:299–319`：记录 `identityComplete/missingFields`。
- `:398–420`：关闭前要求启动记录至少具备映像名、路径、创建时刻，缺项 `incomplete-identity`，不调用 runner。
- `:459–489`：温和关闭等待后、发强制操作之前再次核验；身份变化或 UNKNOWN 返回 `identity-changed-before-force`。
- `scripts/release-smoke.mjs:88` 已捕获启动身份，`:149` 关闭时传 `expectedIdentity: run.identity`，旧的只传 exe 调用已替换。

本轮直接把旧 `identity-probe.mjs` 复制到新目录重跑，旧目录未动，输出在 `identity-probe-result.json`：

| 输入形状 | 当前真实模块输出（所有 OS 操作均为替身） |
| --- | --- |
| 映像名明确不符 | refused，零关闭调用 |
| 完全 UNKNOWN | refused，零关闭调用 |
| 同名但 path/startTime 为 null（原缺陷） | refused，`actual-path-missing / actual-start-time-missing`，零关闭调用 |
| 温和关闭后 PID 身份改变（原缺陷） | 仅温和关闭调用一次，强制关闭前 refused，**没有 `/F`** |

`node scripts/cdp-preflight-check.mjs --out docs/artifacts/2026-10-02-readiness-review/cdp-release/existing-cdp-check` 本轮 **30/30 PASS，exit 0**。既有结果新增覆盖无启动身份、缺创建时刻/路径、部分身份未知、强制操作前身份改变和等待期自行退出等场景。

边界：创建时刻仍沿用 `desktop-harness.mjs:288` 的 ±3000ms 容差，closeout 文档也明示了同路径同映像在该窗口内被复用的残余歧义；所以可表述为“已修这两条已知反例”，不可表述为“任何 PID 复用都不可能误判”。原始 smoke 本次身份完整且正常关闭，但 runner 的 `release-smoke.mjs:149–151` 仍只保存关闭结果，`:200–205` 的 PASS 推导未把 `closed/refused` 纳入判定；这是后续判定一致性加固点，不能把这份真实成功 smoke 推广为异常收尾也已覆盖。

## 2. 默认发布、构建与输入关联已找到原件

证据根：`C:/Users/Lenovo/AppData/Local/Temp/wxmp-closeout-20261002-192442-8591/`。

| 项目 | 本轮重新核实 |
| --- | --- |
| 默认发布 exe | `64ab2946aecee3a84fcc67d67a3a2d9ef8001f110a250e11b9fc5e35ec6dac5a`，15,879,168 B |
| 中文 NSIS setup | `09cfac193c6bb582872d2d023c482dc245ed3a5e925ac1f064fb85b30615b994`，4,599,697 B |
| `tauri-build.log` | 明确 `tauri build --bundles nsis`，无 acceptance-devtools 参数；Rust release 和 NSIS 打包成功 |
| `release-smoke/release-smoke.json` | 当前默认 exe，PASS 5/5，启动 `identityComplete=true`，关闭 `wm-close / closed=true / forced=false`，55 文件测前测后完整哈希相同 |
| 构建前输入清单 | 880 文件 / 49,113,607 B，SHA `6e02ae9d48f792482f4cb89713f296ea066555dcbf15a7f10225395514ac4bb4` |
| 构建后输入清单 | 880 文件 / 49,113,855 B，SHA `5b42efc4231ac83a9523918e502aff7015ce88389ee68d556b5106f93470de95` |

两清单逐项比对：无新增/删除，仅 `scripts/live-acceptance.mjs` 哈希变化。按 manifest 内 `src/`、`src-tauri/`、`public/`、package/lock/workspace、index、Vite/TS 配置取出的 **241 个应用输入**与当前磁盘全部一致。本轮未把现在才创建的 readiness 文件加入历史清单，也未把历史清单倒签。

构建日志、前后清单、发布哈希、smoke 原件已在本目录 `originals/` 留副本，复制前后 SHA 一致；详见 `evidence-index.json`。原来的英文 installer（2026-09-08，`3a32dcd9…`）仍是旧产物，未删除；不应作为此次发布入口。

当前默认版应保持限定描述：**默认二进制有启动、读回/重开、导出的零模型证据**；验收 exe `36b45e25…` 的 L1–L4 付费结论仍绑定那份验收二进制，不能自动迁移。NSIS 已构建并核对哈希，不等于安装/升级/卸载全流程已经本轮验证。

## 3. 15 + 4 runner 与 Rust 的原始凭证

本轮逐份读取结果状态、checks、errors，不只看文档或 stdout 最后一行。`evidence-index.json` 记了每个原始路径、SHA、时间和计数。

- closeout `runners/` 原件：15 个离线 runner 全 PASS，检查数分别为 compose 98、asset-resolve 86、svg-quality 20、delivery-quality 123、asset-completion 58、photo-swallow 33、repair-integrity 75、trace 107、progress 36、runner-negative 34、fact-assert 30、budget 91、cdp-preflight-check 30、live-driver 40、ipc-gate 36；均无 errors。photo-swallow 的结果位于其 run 子目录。
- closeout `runners/verify-ui/run-result.json`：PASS **134/134**。
- 其余三项浏览器结果实际位于 `%TEMP%/wxmp-pw2-1790940177-19178/{prep-contract-check,preview-resource-check,repair-flow-check}/run-result.json`：分别 PASS **175/175、26/26、69/69**，不是 closeout 文档笼统指向的 `runners/*.log`。
- 更早 `%TEMP%/wxmp-pw-1790940118-7863/` 中三项分别 ERROR（0、1、0 条检查），均因 `127.0.0.1:1420` 导航连接拒绝；这些失败原件仍存在。不能描述为所有尝试均一次通过。
- `cargo-test.log` 原文终结行为 **133 passed; 0 failed; 4 ignored**。`pnpm-build.log` 和 `tauri-build.log` 都有对应构建成功输出。

本轮没有重复运行浏览器或 Rust 全套，只重新验证本任务必要的身份 mock 及 CDP 纯函数回归。

## 4. CDP 观察与成熟度边界

找到 `%TEMP%/wxmp-cdp-freshwarm.mjs` 原探针，已复制供审查但**未执行**。它两次使用同一个 iso，每轮新取端口，`waitForCdp(...,90000)`，第一轮额外沉降 15 秒再关闭，并把 `RESULT` 仅打印到控制台。没有写结果文件；对应两个隔离目录 evidence 为空，closeout 证据根未找到该 RESULT 原件。因此“90 秒失败→432ms 成功”目前是执行记录声明，待 DS 从当次控制台/会话记录恢复可核验原件。其 `markerBeforeLaunch` 实际在 launch 后才读取，也不宜作为严格的启动前状态证明。

默认版 CDP 可用的更强直接证据是发布签收 L5/L6 原始记录：被测 exe SHA 指向 `64ab2946…`，`cdpPages` 有 `http://tauri.localhost/`；L5/L6 成果由主线单独复核。它足以否定“必须开启 acceptance-devtools 才能 CDP 连通”的旧必要条件断言。

仍应将 closeout 文档 `:285` 的“决定因素落在 profile 是否完成首轮初始化”和 `:289` 的“预热一次即可”收窄为：**本机这次默认发布版在已有/预热 profile 条件下能够连接；首启失败的原因仍未定位，不能保证所有机器或每次预热一次都成功。** 即使恢复两轮原件，两次顺序运行还同时改变了启动轮次、端口、时间及 profile 状态，仍不能仅凭该对照封闭全部因果变量。

建议当前收口顺序：保留有效代码修复与全部成功原件；把三浏览器结果真实路径补进证据索引；恢复 fresh/warm 控制台原件或把精确数字标为未独立核实；收窄“决定因素/一次即可”的文案。无需再重复整套付费回合。上述完成也不外推微信后台上传/观感、断电恢复、多实例并发、安装升级全链等尚未验证范围。
