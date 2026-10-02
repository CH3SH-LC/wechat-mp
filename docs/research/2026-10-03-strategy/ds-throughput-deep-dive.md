# DS 执行效率深拆：两个真实任务与两项减法

初稿保存：2026-10-03 01:12:35；末轮复核：01:13:26，北京时间。只读当前 `839183b` 源码与已有隔离证据；未启动应用、DSH 或模型，未改产品、配置或全局账本。研究不另建调度平台，不主动重置或改变计费。用量观察是离散快照，不声称连续监控或服务端计费硬限制；个人账户数值不写入工程产物。

## 先做两项减法

1. **裁判改动先重判原件，不再把模型当测试夹具生成器。** L8 已经提交了正文和同一素材，错的是旧 180 字阈值；第二次又把“标题已改过”当失败。应冻结 L7 成功作品及 L8 前后原件，把断言变成纯读取重放；只有输入契约或产品行为确实变了才新跑模型。当前任务优先解决正文擅加未给定运营规则，不能用这条建议掩盖内容问题。
2. **减少不必要的桌面冷启动，同时保留专门的重开验收。** 一个隔离 root 的有序 L1→L2→L3→L4 可共用经过身份/门禁核对的存活实例；L5 仍独立承担正常退出、新 PID、读回与零模型检查。原始隔离基线复制后再用，不修改旧证据。这里是待验证的窄优化，不能立刻删掉 90 秒等待或关闭身份检查。

两项收益都有真实调用链支撑；收益数额仅能给历史可避免的重复区间，不能承诺未来一定省多少分钟。先完成第一项；第二项先以现有 runner 的会话生命周期做窄实验，若必须另建完整调度框架，暂缓该实现。不可因复用实例而绕过各 phase 的预算、探针身份和读回门槛。

## 计时口径：什么能归因，什么仍未知

`src-tauri/src/trace.rs:30–47` 的 `ReqTimer::start()` 同时保存单调 `Instant` 和墙钟 `SystemTime`；`request_record` 在 154–173 行输出 `startedAt=timer.started_at()`、`ms=timer.ms()`。`chat.rs:899–940` 在 `raw_completion` 之前开表，返回及提取 SVG 后写 request；prep 同样在 `chat.rs:1496–1498` 的 `request_prep` 前开表。因此：

- `startedAt` 是调用端测得的开始墙钟，**不是日志落盘时间，也不是从结束时刻倒算的开始**。
- `ms` 是调用端经过的单调耗时，覆盖调用等待及本地返回处理；不能拆成服务端排队、推理、网络，更不能称纯模型算时。
- 以下以 `startedAt + ms` 近似放回墙钟区间，与 run-result 的开始/结束对齐；前提是期间墙钟未跳变。原件没有校时跳变字段，所以跨时钟差值保留这个限制。
- 对所列三请求链，下一请求开始均晚于上一请求结束，**无重叠**；因此这里可以相加。一般多素材并发应合并时间区间，不能直接求和冒充关键路径。
- `evidence.turns[].seconds` 是四舍五入的总轮时；不拿它倒算毫秒阶段。`launches[].at` 是 `openAppOnce` 做过进程身份查询后记录的时刻；预热记录的 `at` 更是预热关闭后才写，不能都当进程真正创建时间。

原件位置统一在 `C:/Users/Lenovo/AppData/Local/Temp/`。下表用 run-result 开始/结束、对应 traces 请求计算，单位秒。

| 任务 | 全段 | 首请求前 | prep 请求合计 | 绘图请求 | 请求间隙 | 末请求后 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| r8 L1 首篇 | 128.994 | 42.628 | 9.588 | 68.914 | 0.113 | 7.751 |
| r8 L4 换图 | 223.102 | 116.918 | 6.604 | 71.764 | 0.110 | 27.706 |
| r9 L7 长文首篇 | 110.305 | 20.866 | 23.703 | 57.767 | 0.118 | 7.851 |
| r10 L7 重生长文 | 114.209 | 20.755 | 21.237 | 65.334 | 0.107 | 6.776 |
| r10 L8 文字续改 | 18.868 | 2.999 | 8.517 | 0 | 0.030 | 7.322 |

“首请求前/末请求后”是区间名称，不是空等归因。它们还含驱动、页面准备、落盘读回、截图、进程清理等，只有下面有事件对齐的部分才细归因。

## 代表一：r8 L4，慢的主因不能全算给模型

原件：`wxmp-live-r8-1790951270/evidence/L4-2026-10-02T14-32-11-20299890/{run-result,evidence}.json`；trace：同 root 的 `profile/Documents/wechat-mp-workspace/traces/rmur2dbtg-1.jsonl`。

| UTC 事件 | 证据含义 |
| --- | --- |
| 14:32:11.150 | runner 开始 |
| 14:32:12.261 | 第一次启动记录（身份查询已做） |
| 14:34:05.671 | 第一实例关闭完成，`forced=true`、`via=taskkill-force`；第一次启动没有 `cdpPages` |
| 14:34:06.466 | 第二次启动记录，有 CDP 页面 |
| 14:34:08.002 | turn 开始；14:34:08.068 第一次 prep 开始 |
| 14:34:08.068–14:34:11.603 | prep 1，3.535 秒 |
| 14:34:11.662–14:34:14.731 | prep 2，3.069 秒，已返回候选正文 |
| 14:34:14.782–14:35:26.546 | 唯一绘图，71.764 秒，attempt=1 成功 |
| 14:35:54.249 | 第二实例收尾完成，`forced=true` |
| 14:35:54.252 | runner 结束 |

`run-result.json.observations` 的 `id=启动重试` 直接记录“第 1 次启动 90s 内没有可用 CDP 页面……关闭后按有界策略重开一次”。`live-acceptance.mjs:701–716` 只有首个 `CDP 在` 阻断才有第二次 `openAppOnce`，且会清掉该次阻断；`767–781` 先等 CDP 90 秒再关；`desktop-harness.mjs:354–356,437–440` 默认正常退出等待 20 秒后才考虑强杀。**事件记录、源码路径及两份启动记录支持：首请求前发生了 CDP 超时及关停重开，绝不是 116.918 秒模型等待。** 从第一次启动记录到第一次关闭是 113.410 秒；其中 CDP 和关停的各自实际起止没有完整保存，不能再把它精确拆成 90.000 + 23.410。观察文案对“profile 初始化”的根因解释仍是旧假说，本研究只认 CDP 超时与重开这两个已观察事件。

末请求后 27.706 秒中有强制关闭；实际关停起点没有独立日志，所以不把全部 27.706 秒归为清理，也不直接从中扣固定 20 秒。`runTurn` 在 1230–1238 行要三次稳定观察、轮询间隔 1.4 秒；`tracesAfterTurn` 在 1268–1270 行固定再等 0.8 秒。它们解释了非零观察尾部，但本轮无法给每项精确占比。

本任务绘图只有一个槽位、一次成功，不存在绘图重试。当前 `image-agent.ts:60,78–97,1286` 已有默认并发 2 的素材任务池；给这篇单图文章加第三第四个 worker **不能缩短这个唯一 71.764 秒的依赖项**。prep 2 依赖 prep 1 的知识返回，绘图依赖候选中的素材 brief，最终提交依赖绘图结果。可以并行做独立审稿/文档检查，不能把同一素材提案提前盲发来“提速”。

补正历史文字：最终 r8 L1 与 L4 都是 **2 prep + 1 draw**，不是“第 3 次 prep 才声明”。L1 请求间隙为 53/60 毫秒，L4 为 59/51 毫秒；r10 L7 为 59/48 毫秒。这也说明不能用这几个最终样本证明“最后一轮提醒”发挥了决定作用。前一轮复盘沿引进度文档的“恰好用满第 3 轮”应以此原件勘误。

## 代表二：r9→r10 L8，裁判假红引发上游再生产

原件目录：

- `wxmp-live-r9-1790955586/evidence/L8-2026-10-02T15-43-17-9676c9a5`：17.490 秒，2 次 prep、0 绘图；唯一失败 `字数…≤180字`。
- 同 root 的 `L8-2026-10-02T15-43-59-4cefa53e`：17.523 秒，2 次 prep、0 绘图；唯一失败 `源文标题行也变了`。
- `wxmp-live-r10-1790955871/evidence/L7-2026-10-02T15-44-31-2d1922e0`：114.209 秒，2 次 prep + 1 绘图。
- 同 root 的 `L8-2026-10-02T15-46-26-a349b816`：18.868 秒，2 次 prep、0 绘图，通过。

r9 的两份 trace（`rmur4ubzh-1.jsonl`、`rmur4v8sf-1.jsonl`）都写了 `stage=commit, ok=true`，素材决策 `recover`，并带连续变化的 `baseRevisionId`。这说明第一次 runner FAIL **并没有撤销产品已提交状态**；第二次重发同一改标题要求时，标题已经是目标值。把“相对本次前态必须变化”当目标，产生第二个假红。不能把第二次红解释为 DS 再次没会改标题。

两次假红共 35.013 秒执行区间、4 条 prep 请求；随后为干净 root 重生的 L7 又是 114.209 秒、3 条请求（含一绘图）。合计 149.222 秒和 7 条请求是可定位的历史重复执行量，**不等同于全部可无损节省**：干净 root 也给过独立证据；应先证明原件重放覆盖相同断言。最后成功 L8 的 18.868 秒不计在这项重复量内。

r9 第一 L7 开始至 r10 最后 L8 结束为 418.803 秒；五个业务尝试运行区间合 278.395 秒，剩余 140.408 秒未由这些 run-result 覆盖，不归因为空等、编码或构建。另一次 L6 不纳入这段终点。P2 文档 +10/2 与原账本 +12/2 的差别只作登记漂移例，不另起账本修复。

## 给 DS 的下一包：一个可交付结果，两个离线入口

> 目标：修复 L7/L8 把未提供的办事规则写成确定承诺的问题，并防止 runner 假红再触发付费重生。基线使用当前 commit、exe 指纹和原始 L7/L8 成品；不可改旧证据。实现者只有一名，复核者只读。优先查当前 prep/persona/知识里“扩写完整文章”和事实边界的冲突，不建立前端意图状态机或通用事实平台。
>
> 先离线做两件事：A，把原始 L8 前后成品输入当前字数/标题/素材断言，证明裁判可读取已完成结果而不发送消息；B，抽取原文四项给定事实及两条未给运营承诺，由独立复核者冻结“有来源/显式待确认/不能作为确定事实”判据，形成 L7、L8、一个不同材料保留样本，共 3 题。只补命中的测试，不造十二题平台。
>
> 若需要改产品提示或契约，一次改完整、先离线反例与正常对照、再按现有约束一次 release 重建和冒烟。真实模型执行必须由有当次付费授权的协调者另行启动；本轮研究不启动。内容签收先于扩大篇幅/模板/并发。两次同因失败立即提交最小反例，不第三次盲改。

注意：原 trace 不存完整请求/响应，所以“回放”分两层：已有成品的断言可立即重判；精确模型响应回放只有保留的会话/工具原件足够时才成立。缺字段时制作明确标为受控夹具的响应，不能声称是真实响应回放。

## 回放与验收停机算法

```text
freeze baseline = commit + dirty allowlist + immutable artifact paths + 3 expectations
replay original before/after artifacts with no app/model side effects
if replay contradicts human product judgment: classify RUNNER, fix judge, replay again
if artifact invents an operational promise: classify PRODUCT_CONTENT, retain evidence
if evidence missing: classify UNKNOWN; block only claims depending on it

for affected implementation patch, at most 2 same-cause attempts:
    run frozen failure + one normal counterexample offline
    if red: repair or hand minimal reproducer to diagnostician; do not regenerate baseline
    if product changed: designated integrator builds once and performs required smoke
    when permitted: run only affected real scenario from an isolated copy of the baseline
    collect final saved result; independently judge content + identity + affected behavior
    if all frozen expectations pass once: stop this package; new unrelated ideas go backlog
```

运行真实桌面时仍要串行拥有 profile、当前会话/文档、release 输出及全局账本；“各自在不同 evidence 目录”不代表可以共用一个可写作品 root。脚本纯读取重判可以并行，改同一 App.tsx/同一提示契约的两个实施者不并行。

## DSH 控制语义：不要把消息队列误当实时刹车

当前本机源码，不等同于已证明实际 DS 会话加载了这些插件。

- `tool-subagent-control/src/index.ts:28–34,64–73`：`send_message` 调 `ctx.subagents.followup`，进入下一轮 FIFO；不能改正在做的这一轮。
- `subagent/src/continuation.ts:460–467,476–499`：运行态入队、等待态唤醒、已释放实例冷恢复；取消发消息调用只管接受前，接受后的消息不能靠它取消。
- 同文件 `508–567`：`interrupt` 只取消当前轮、保留未领走队列、已派后代继续；返回 accepted 不等于停止完成。**先 interrupt，随后随手发“继续新计划”，可能唤醒此前滞留旧任务**。因此每个孩子最多一个未消费指令；改范围时先清点队列语义，不能把新指令当自动清空旧指令。
- `tool-subagent-control/src/list-agents.ts:75–77,95–105`：列表过滤 one-shot，idle 也可能在等后代，ready 是可恢复的存档，不是完成认证；one-shot 要按其 job 控制入口处理。
- `subagent-dsh-sdk/src/index.ts:1–7`：SDK 子进程有自己的运行配置/模型/工具，不继承父 Cordis 上下文；`run.ts:133–163,175–204` 把取消结果结算与真正 `harness.close()` 分开。不能把“结果 aborted”当 OS 子进程一定已退出。

因此到点停机只需一个小算法，不需要新调度框架：先禁止新委派与新模型请求；列出自己启动的 jobs/continuable 后代；对正在运行的目标发相应取消；等待停止/退出证据；不发唤醒消息；保存部分成品并报告未静止目标。后代树可能在首次枚举后变化，静止前再枚举一次。按用户当次授权监视订阅、重置及费用边界，读取不可确认时停止新工作并报告。观察报警不能冒充服务端硬预算开关；不得主动重置或修改计费，也不把一次研究的停止阈值固化为未来任务的长期规则。

## 只补三种观测，不造新看板

1. **runner stage span**：`attemptId, stage, startedMono, endedMono, reason`，仅 startup/CDP/retry/close/readback 五类；现有 `launches.at` 语义不统一，难以精确拆 116.918 秒。记录实际阶段边界，继续复用 evidence.json。
2. **重试的输入身份**：`baselineRevisionId, artifactHash, retryOf, retryReason`，区分产品重试、纯裁判重判、正常续改；旧成功作品是否被改过一眼可见。
3. **已存在请求记录关联**：补 `requestId/runId` 到对应 attempt，不重造 usage、ms、slotId；多请求并发分析用区间并集。只有真要优化首字延迟时再补 first-byte/token，否则不扩埋点。

不按代码量、测试条数或 agent 数评估效率。一次任务只看：首份用户愿意发布的成品是否出现，是否经历无谓重生；用户实际审稿修改分钟尚无记录，不能在本研究中估出。

## 最小复算方法

对任一上表 attempt，令 S/E 为 run-result.startedAt/finishedAt；取该期间 trace 中 kind=request 行，按 startedAt 升序。R 为各行 ms 之和，A 为第一行 startedAt，B 为最后一行 startedAt+ms。先逐对验证 `next.startedAt >= current.startedAt+ms`；本表成立。然后全段=`E-S`，首请求前=`A-S`，请求间隙=`B-A-R`，末请求后=`E-B`，四项严格相加等于全段。若重叠则用区间并集替代 R；若有时钟跳变则不做跨墙钟分段归因。请求自身 ms 仍由单调时钟取得。

## 主线补查 单图等待不能直接等同于SVG写得太长

主线随后读取同一R10 L7原始trace的服务usage，并直接核对已经保存的SVG，未调用模型。三次request记录如下；数字为服务返回的token计数，不是本研究估算，也不折算为费用。

| 请求 | 调用端耗时ms | prompt tokens | completion tokens | finishReason |
| --- | ---: | ---: | ---: | --- |
| prep 1 | 3299 | 3831 | 721 | tool_calls |
| prep 2 | 17938 | 24278 | 4272 | tool_calls |
| gen_svg | 65334 | 587 | 15228 | stop |

对应原件是`wxmp-live-r10-1790955871/profile/Documents/wechat-mp-workspace/assets/items/as-1790955979624508100/source.svg`：5347字节、5347字符，简单标签计数75个元素，其中7个path、24个rect、15个circle/ellipse、7个渐变定义，无嵌入栅格image；SHA-256为`6bb0477d607c93018ca234e9bc645fa99cf45b759deb699578235d29ee57d7b9`。元素计数含defs等，不等于可见对象数量。主线目视现有长图确认这张图呈现台灯和书本；不是本轮新生成的图。

这组数据的作用是**阻止错误归因**：记录的15228个completion tokens不能全部叫作SVG源码；可见SVG只有5347字符。`trace.rs:204–210`的公共usage对象仅保留prompt/completion/total；本次gen_svg记录没有原始响应细分，因此不能定量拆出该绘图请求的推理、可见输出和其他内部开销，也不能从字符数推算推理token。此限制专指gen_svg：prep的note另有reasoning_tokens信息，不能扩大为全部请求均无细分。`chat.rs:857–864`记载过旧输出上限下空正文的历史问题，但该注释不构成当前样本同因的证明。

后续若专门优化单图等待，先补已有响应中**实际存在的可选usage细分和可见返回长度**，缺失就记未知；不得为“补数据”默认再买一轮模型调用。保留固定brief与实际尺寸成品，按现有有效授权做一次有界对照后再决定。先看能否复用现有合适资产；不要先增加worker，也不要盲降输出上限、解除模型锁或削弱大图复杂度合同。当前`SVG_SYSTEM_PROMPT`要求层次、体积和细节，`chat.rs:800`还明确wide/inline不应因统一简化退化；这些约束要与速度目标一起验。

prep第二次输入从3831增到24278 tokens也不能直接称“无用知识过多”：它发生在知识工具返回之后，但缺加载路径及完整输入快照。优先记录路径与实际回传指纹，判断哪些知识被取用，再决定是否缩小检索范围。不能为了省上下文删掉避免语法/素材错误所需协议。

因此当前实施顺序仍是：F1依据边界→F2安全分页→真实交付；这项日志补查为未来有证据的延迟优化提供方向，不把下一轮重新改成模型参数实验。
