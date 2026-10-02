# 晚间复核：预算、IPC 门禁与结果持久化

2026-10-02，当前工作树只读复核。**本轮智序启动 0 次、真实模型请求 0 次、正式工作区写入 0 次**；未访问或修改真实全局账本，未扩容授权，未覆盖早间证据。只新增本目录文件和独立临时测试目录。

结论：早间发现已有实质修复，当前单写者和跨进程预算检查通过；但新的 fetch 门禁尚未覆盖 Tauri 的 postMessage 回退。这个缺陷由当前生产探针与项目锁定的真实协议源码组合复现，仍应阻止继续付费复验，先完成零模型修复验收。下列故障注入不等于已观察到历史付费轮次发生了同样故障，也不据此抹除已有成功轮次证据。

## 本轮执行和证据

```powershell
node scripts/budget-check.mjs --out docs/artifacts/2026-10-02-evening-review/budget/budget-check
node docs/artifacts/2026-10-02-evening-review/budget/probe.mjs
```

- `budget-check/run-result.json`：exit 0，65/65，12 个计划组全部执行，含两个独立子进程/不同 root/共享账本的预留竞争。
- `probe.mjs` / `probe-results.json`：提取当前 live-acceptance 的 installProbe、finalizeLedger、finalizeAndExit 原始代码；IPC 使用本机 Cargo registry 的 `tauri-2.11.5/scripts/ipc-protocol.js` 原文，仅给构建期模板填入假值。所有底层 fetch/postMessage 都是本地假传输，没有网络服务、浏览器或桌面应用。
- `src-tauri/Cargo.lock:3643-3644` 锁定 tauri 2.11.5，所用协议不是自行复制的行为模型。
- `live-finalizer-passing/`：真实收尾函数片段对一个全部通过的假运行生成的三个最终产物。

## 已修并得到当前证据支持的范围

| 早间问题 | 当前实现/实测 | 接受边界 |
| --- | --- | --- |
| 多 root 的缓存账本丢更新 | dispatch-budget.mjs:74-116 全局账本锁；:324-342 临界区重读；:444-472 锁内预留落盘。两进程额度 1 测试只放行 1，盘上也为 1 | 正常锁获取路径已验证；不宣称已穷尽死锁回收的所有调度交错 |
| 负 totals、绘图大于总量、非数组 phases 被接受 | dispatch-budget.mjs:206-229 拒绝损坏结构，当前离线反例全部拒发 | 已关闭早间三个具体结构反例 |
| recordPhase 落盘错误被吞 | dispatch-budget.mjs:275-295 累计关键/镜像失败；live-acceptance.mjs:1608-1619、:2108、:2305、:2720-2734 检查或上抛 | 本轮会 ERROR 已修；下一进程的持久屏障仍缺，见下方 |
| 主结果 PASS，报告 BLOCKED，evidence 无 status | live-acceptance.mjs:2487-2509 用函数式附件；共享 persistRunResult 先计算状态再写，错误改变状态后重写 | 本轮原始收尾函数探针得到 exit 0，run-result/evidence/report 全部 PASS |
| 总传输误作绘图计数 | live-acceptance.mjs:517、:1233、:1542 已使用独立 transportDraw | 静态接线已修；本目录不重复主审计的 trace 核验 |

## 仍缺 1：P1，fetch 出错后协议永久改走未受控的 postMessage

生产探针只替换 `window.fetch`（live-acceptance.mjs:489-522）。拒绝预算时合成合法 error Response（:512-513）确实修好了“主动拒绝自己触发 fallback”这一条路径，但没有处理以下路径：

1. 非付费命令 :506 直接调用 origFetch；任意一次底层 fetch 或响应解码失败均会被 Tauri 协议捕获。
2. 本机真实 `tauri-2.11.5/scripts/ipc-protocol.js:59-67` 将 `customProtocolIpcFailed` 置 true，并重发当前消息。
3. 同一文件 :25-28 / :70-84 使后续所有命令直接 `window.ipc.postMessage`，不再调用 fetch，因此没有预算预留。
4. `window.__acceptanceReserve(...)` 自身 Promise reject（宿主绑定故障）也未在 wrapper 内转换为拒绝 Response（live-acceptance.mjs:507-519），会走同一 fallback。

探针结果：

| 场景 | 额度 | reserve 调用 | 假后端付费传输 | 结果 |
| --- | ---: | ---: | ---: | --- |
| 健康 IPC，prep_turn 后 chat_stream | 1 | 2 | 1 | 对照有效，只放行一次 |
| 健康 IPC，直接拒绝 prep_turn | 0 | 1 | 0 | 合成 error Response 有效，不触发 fallback |
| 先注入 list_documents 的 fetch 失败，再 prep_turn/gen_svg | 0 | 0 | 2 | 两次均绕过预留，经 postMessage 放行 |
| 宿主 reserve Promise reject，再 prep_turn/gen_svg | 0 | 1 | 2 | 首次故障和后续请求均绕过预留 |

**修复验收**：预留必须覆盖项目真实 IPC 的所有可达传输路径，或一旦无法证明所有路径受控就拒绝派发。复用上述真实协议测试，在非付费 IPC 故障、付费 IPC 故障、响应解析失败、宿主绑定失败后，零额度都必须保持后端付费传输为 0；不得只测“预算返回 ok:false”。

## 仍缺 2：P1，业务失败屏障只把本轮变红，未保证下一进程拒绝

live-acceptance.mjs:2720-2734 现在会报告屏障没有落盘，属于实质进步。但新一轮唯一历史检查仍是 :2616-2625 的 priorBusinessFailure；dispatch-budget.mjs:514-522 只读权限账本中的 phases，不查上次失败运行归档，也没有 pending/unclean 标记。

探针对自己创建的临时账本注入无法读取/写回的障碍，运行**生产 finalizeLedger 原始函数**：本轮收到两条 budget 错误、persistFailures=1。恢复原先未写入失败屏障的账本，重新 createBudget/open 后，priorBusinessFailure=null，下一次 prep_turn reserve=true。

**修复验收**：开始付费阶段前应已有可持久读取的“本阶段未完成”状态；只有成功写完最终结论才可清除。下次遇到未完成/结果未知应明确阻断并要求核对，不能依赖那个正好写失败的失败记录。增加“记录失败→进程结束→存储恢复→新进程”的完整反例；仅检查当轮 stderr/ERROR 不足。

## 次要缺口：探针重用检查没有确认当前 fetch 仍是受控函数

live-acceptance.mjs:480 只要 T.__liveAcceptanceProbe 存在就回 ok/reused，未比较当前 window.fetch；sendTurn :1124 因此没有真正复验门禁身份。隔离探针把 window.fetch 还原后再次安装，返回 ok=true/reused=true，额度 0 的 prep_turn 实际假传输 1、reserve 调用 0。

这是故障注入证明，未观察到当前真实页面有代码主动替换 fetch；优先级低于已由 Tauri 正常故障处理触发的 fallback。修 IPC 门禁时应一起补“函数已脱落/通道已切换”的身份检查。

## 后续指导范围

先只修上述两个确定阻断及门禁身份检查，跑零模型真实协议故障注入；不以继续花模型调用来验证预算门禁。本目录不推导历史 56/11 是已核清的真实请求/费用：预留、实际传输、完成 trace 与 UNKNOWN 必须分别列出，历史账本和 F 六阶段证据由主审计另行对账。

当前输入指纹：

- dispatch-budget.mjs SHA-256 `27d8788381674e05418812a88d21e77df6eed56159f48b6eed800f60ac8c1313`
- run-result.mjs SHA-256 `c2e752e27385bfea87c8f70e42e357708709003575ecebc9e60a156298e88a2e`
- live-acceptance.mjs SHA-256 `89f957463473f8128b31c5539c4f66e8f1753d9cee840fba421fe3bf48657e54`
- Tauri IPC source SHA-256 `68ae690606006f733bde75dd8bb6748464954a22c7e83914a93b1abc221d7072`
