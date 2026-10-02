# R3 独立复核（2026-10-02）

结论：R3 有实质修复，但未达到可运行付费 L1–L4 的状态；L5/L6 也未形成真实重开、导出验收。仅运行零模型离线检查及替身依赖探针，没有启动应用/浏览器、读取密钥、访问真实模型、修改全局预算账本或真实工作区。未修改产品或 runner 源码。

## 证据与复跑

- `driver-existing/run-result.json`：当前 `live-driver-check.mjs` 原脚本 PASS，21/21，计划/执行 4/4。
- `facts-existing/run-result.json`：当前 `fact-assert-check.mjs` 原脚本 PASS，20/20，计划/执行 5/5。
- `probe.mjs` / `probe-result.json`：15 个独立探针项，3 个对照符合预期，12 个边界不符合预期。文件包含被审计 5 个源文件的 SHA-256。探针 exit 0 表示采样完成，不能解释为产品通过。
- 原脚本只调用共享纯函数；独立探针对 `reconcile`、`latestBaseline`、`verifyLaunch`、`runL3` 及 `openApp` 的 close 闭包直接从当前源码截取执行，依赖全部由替身提供。不是桌面入口执行，也不证明真实 WebView/模型/关闭行为。

从仓库根目录复跑（原结果不覆盖；为原检查选择新输出目录）：

```powershell
node scripts/live-driver-check.mjs --out <新的绝对输出目录>
node scripts/fact-assert-check.mjs --out <另一个新的绝对输出目录>
node docs/artifacts/2026-10-02-continuation-review/live-flow-audit/probe.mjs
```

最后一条重写本目录 `probe-result.json`，应先留存旧探针结果或复制整个证据目录再复跑。

## 已复现缺陷

|优先级|位置|独立证据与影响|
|---|---|---|
|P1|`scripts/live-acceptance.mjs:1329`|`reconcile` 将 `genSvgTransport` 接成总 `turn.transportAfter`。2 次普通请求、0 次绘图、trace 完全一致的 L2 替身仍报绘图 transportMismatch；L1/L4 混合请求也会假红。`driver-L2-production-reconcile-wiring` 执行的是当前原函数。|
|P1|`scripts/live-acceptance.mjs:1679`|`runL3` 使用不存在的 `page.evaluate`，应从 `app` 取得页面。当前原函数在替身 sendTurn 已调用一次后抛 `page is not defined`，即真实流程会在已派发回合后才失败。|
|P1|`scripts/live-acceptance.mjs:643`、`:2298`|close 闭包无条件设置 `mine.closed=true`。替身 `closeOwnPid` 回 `closed:false` 仍被标已关，后续 finally 的 `if(h.closed) continue` 跳过清理。此处与 finally 内已修成 `r.closed===true` 的路径不一致。|
|P1|`scripts/lib/trace-read.mjs:114`、`:132`|只拦 trace 总数大于预留，不拦 trace 总数少于实际传输；`reserved=transport=2, trace=0, observable=true` 返回 ok。另 `traceGenSvg=1,reservedGenSvg=0`、总数均为1也返回 ok，绘图预算绕过证据未判红。以上为直接导入生产模块实测。|
|P1|`scripts/live-acceptance.mjs:930`、`:1767`、`:1857`|没有任何 ok 基准时 `latestBaseline` 仍返回最后失败基准。原函数探针已复现；L5/L6 后续只核对字段齐备、未检查 `prev.ok` 是静态确认。因此不能称其已经保证“最后成功版本”。|
|P2|`scripts/lib/trace-read.mjs:151–155`；`scripts/lib/desktop-harness.mjs:180`|`canReopenAfterClose({closed:true,forced:false,via:'already-exited'})` 返回 ok。进程在请求正常关闭前已退出，不能证明走应用关闭路径；该接受行为已直接测得，真实退出原因没有调查。|
|P1|`scripts/lib/fact-assert.mjs:159`|把正文开放时段改成 9:00–16:00，并追加“咨询服务于17:00结束。”，全套事实断言仍通过。17:00 只要求全文出现，没有与同一开放时段绑定。|
|P1|`scripts/lib/fact-assert.mjs:176–190`、`:200`|“全天不闭馆”“自习区不在一楼”分别替换标准正文后仍全部通过；闭馆与楼层只做邻近词存在判断，没有相应否定语义。|
|P1|`scripts/lib/fact-assert.mjs:65–71`|把开放日期改为 `2025-10-10` 后仍全部通过。正则只把 `2025年` 识别为年份，将 ISO 日期中的 `10-10` 当无年份日期。|
|P2|`scripts/lib/fact-assert.mjs:140`、`:152`|合法紧凑文本 `10月10日9:00–17:00开放；10月11日全天闭馆。自习区在一楼，电话010-55556666。` 被判红；9:00 的 ±22 字窗口包含下一天的“闭馆”，跨日否定误伤。|

事实探针有标准正文全绿对照，并保留每次完整正文与失败检查项，不能用“反例本身格式不合法”解释这些结果。

## 已修复范围与仍待查验的静态边界

1. `verifyLaunch` 的 gate 失败现在会 block 并返回 null（1263–1273）。直接提取原函数的身份失败探针返回 null；正常替身对照返回对象。这证明控制流修复，不证明真实隔离。L2/L3/L4/L6 已比对当前文档与基准文档身份。
2. 实际隔离证明仍不足：1192–1234 主要检查 CDP 页面 URL、隔离目录非空、路径不同及读 API 可用；没有端口归属 PID、WebView 进程树或其实际 profile 的证据。预先存在的目录内容也能满足检查。`procIdentity`（desktop-harness:152–162）只比较映像 basename，无创建时间/完整路径，且 `closeOwnPid` 读取 identity 后不以 `matchesExpected` 为拒绝关闭条件。这些是源码确认，没有拿真实进程做破坏性探针。
3. `main` 在 2283 调用 `openApp`，2286 才进入清理 try/finally；`openApp` 的 709 安装探针调用若抛异常，没有覆盖全生命周期的清理。加上上述 close 状态误标，启动异常清理仍未关。
4. L5 新增了关停失败拒绝重开（1788–1792）、PID-B 对比与正式版本多字段比较，但“正常退出”的证据仍受 already-exited 接受和弱进程身份影响。1822 才开始读取的 trace 时间基准设于 PID-B 已启动、读回完成之后（1810），漏掉启动早期；又不检查 trace.observable，不能把此检查称为完整的零请求证明。
5. L6 已增加图片每个文件对应本轮 added 的核对（1924–1934），PNG 结构、浏览器解码和分页尺寸检查；HTML 的新增核对仍只是 `added.length>0`（1897–1902），没有要求 UI 回执中的那个 HTML 路径属于 added。仅静态确认，未做真实导出。
6. L6 的所谓“375px 预览保留”实际仅 snapshot/正文比较（1937–1942），无截图保存调用；并未核验真实像素宽度或人工查看。PNG 只解码前 12 份（1959），短文只证明单页这一限制已经写明。不能把现有脚本/JSON 当实际尺寸截图证据。
7. L5/L6 的零请求检查读 `requests.length`，未要求 observable；独立纯模块回归还明确把“零预留且 trace 不可见”视为一致。这样的结论最多是探针未记录派发，无法证明启动安装探针之前也零请求。

## 给 DS 的收口顺序

先修正常回合的实际驱动入口：L2 的总量/绘图量接线、L3 未定义页面变量，并让离线测试通过依赖注入覆盖发送后的真实控制流。然后统一全生命周期清理与身份闭锁，禁止 closed:false/未知退出来源被当正常关闭。接着使 trace 三方核对覆盖缺失、少记、绘图类别不符，并将 UNKNOWN 保留到账本和结果。事实断言改为按同日语义单元识别成对时段、否定关系和明确日期年份，保留这些假红/假绿用例。最后修成功基准的不可变记录以及 L5/L6 的完整时间窗口、导出回执路径与像素证据。

以上通过后才有资格配合主线 R1/R2/R4 集成验证。这里没有完成真实桌面、真实模型、保存重开或导出验收，不以现有 21/21 和 20/20 单元检查替代这些层次。
