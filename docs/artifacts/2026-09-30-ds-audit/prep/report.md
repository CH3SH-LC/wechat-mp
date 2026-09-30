# F2 / F3 / F4 独立审计（2026-09-30）

结论：DS 已接入结构化准备结果与 candidate 共用交付分支，但本包不能算完整完成。当前实现仍把历史创作状态当作本回合写作授权；`preserve` 在绑定缺失、歧义和库版本更新时不能保证素材不变；读取正式稿失败仍继续。以下区分生产函数实测和 App 静态调用链，未把返回 candidate 等同于真实文档已提交。

## 执行范围和真实数量

- 复跑仓库现有 `scripts/prep-contract-check.mjs`：**10 个场景、73 条 PASS、0 FAIL**，退出码 0。输出 `original.log` 与 `original/raw.json`。
- 独立 `counterexamples.mjs`：**18 项精确契约探针，其中 4 项符合预期、14 项不符合指南**。这些是有意针对疑似缺口选出的反例，**不是随机样本，不能表述为整体成功率**。
- 独立探针通过 Vite `http://127.0.0.1:1448` 导入当前生产 `runPrep`、`parseFinishArgs`、`materializePlaceholders`、`isCreateRequest`；只给 Tauri invoke 注入受控返回，没有复制生产算法。新无头浏览器 context，无页面异常。
- 本次没有真实模型请求、真实桌面启动、用户工作区写入、产品源码修改。`gen_svg=1` 表示生产模块试图派发 1 次绘图命令；测试桩立刻抛取消，**不表示实际消耗模型额度或实际生成了图片**。
- 未在本探针中驱动 App 的整轮 UI/存储提交；App 接线部分为源码检查。生产文件 SHA-256 随 `counterexamples.json` 留档。

## 主要缺口

### P1：历史创作仍决定当前兼容授权，普通问答会变为 compose/candidate

源码：`src/App.tsx:745` 使用历史任一用户消息的 `isCreateRequest` 得到 `creativeSession`；`:752` 把 `isCreateRequest(raw) || creativeSession` 当成 `creationContract`；`:766` 传给准备模块。`src/lib/prep.ts:112` 检测任意 READY 单词；`:291` 合并为 `legacyReady`；`:296` 至多纠偏一次后，`:307–312` 将文本自动转 candidate/compose。

实际生产模块反例：

1. 历史用户曾要求写校园通知；当前用户为“请解释 NOT READY 的意思，暂时不要编辑文稿。”。模型受控返回 `NOT READY`。采用 App 的同一布尔表达式和生产 `isCreateRequest`，`creationContract=true`；真实 `runPrep` 两次调用后返回 `compose, legacyCompat=true`。
2. 同一创作历史；当前用户要求展示 v2 语法示例、暂不编辑；模型受控返回完整围栏示例。真实 `runPrep` 两次调用后返回 `candidate, legacyCompat=true`。

证据：`counterexamples.json` → `rows[0]` / `rows[1]`，包含每次实际 invoke 参数。对应 App 对 compose 的后续写作分支是 `src/App.tsx:838`，candidate 接入交付是 `:827`；本测试已证明错误的准备结果，**尚未据此宣称文档被实际提交覆盖**。

指南 §5.3 明确要求协议/本回合契约显式传入，不能靠历史关键词；说明 + READY 也不能猜 compose。当前注释称“意图判断全部由模型”与实际分支不符。需去掉从历史状态得到兼容授权的路径，失败/待确认不得变成写作授权。

### P1：preserve 无唯一绑定仍派发绘图

源码：`src/lib/image-agent.ts:891–892` 仅在 preserve 且 `preserveHit` 非空时进入保护分支；无命中直接继续 `:921` 后的正常检索/绘制，`:925` 的 `|new` 又跳过检索。

实测 `assetPolicy='preserve'`，旧绑定与新占位描述不同、无法确定性对应：真实 `materializePlaceholders` 派发 `gen_svg` **1 次**，台账 `attempts=1`。测试桩拦截为取消后才得到失败。指南 §5.4 要求无法唯一对应时在派发前明确阻断，不能当新料绘制。证据：`assetRows` → `preserve-absent-binding-new-slot`。

DS 的 `scripts/asset-completion-check.mjs:343` 反而把“preserve：没有历史绑定的新素材位仍可新绘”作为 PASS 预期；这个测试预期与指南相反。

### P1：preserve 不保留文档快照版本，歧义绑定静默取第一项

源码：`src/lib/image-agent.ts:893–894` 从当前库读取同 ID 的素材并调用 `svgBlock`；`:899` 保存的是当前库 `item.version`，没有使用此位的文档 snapshot。`priorBindingFor` 在 `:465` 使用 `bindings.find`，精确同 slot 有两条时只取第一条，并未做唯一性校验。

两个实际反例：

- 文档保存 `snapshot-art` v1（含填充色 `#e8dcc8`），同 ID 素材库现为 v2（改为 `#2244aa`），明确传入文档 v1 snapshot。输出使用 **v2 SVG**，台账 `version=2, status='ok', source='recover'`，却说明“素材不动”。绘图调用 0 次不能证明素材保持不变。
- 同一个旧 slot 存在 `ambiguous-a` 与 `ambiguous-b` 两个绑定，实际静默采用第一个 `ambiguous-a`，状态 ok、错误为空。

证据：`assetRows` → `preserve-document-snapshot-vs-library-update` / `preserve-ambiguous-exact-bindings`。指南要求确定性恢复同一 ID/快照；不唯一必须阻断。需要覆盖稳定显式 `[[asset]]` 引用和旧占位恢复两种路径的快照权威性。

### P1：正式文稿读取失败仍当作没有旧稿继续

**静态调用链证据，不是本探针的端到端实测**：`src/App.tsx:718–722` 读取失败只 console.warn，然后令 `priorAccepted=null`；后续照常调用准备/写作。提交时 `:1424` 用 `priorAccepted?.revisionId`，读取失败时基准因而缺失。该行为与同段注释和指南 §5.4“读取失败明确报错；不能当作没有旧稿继续覆盖”直接冲突。

必须在此处停止本轮候选提交并显示真实读取失败，不能因为后来拿到新稿就把本轮视为成功。实际覆盖风险/存储冲突处理应与根审计的存储证据合并判断，不能仅凭此静态发现声称已复现覆盖。

## 次要契约缺口与覆盖不足

- `src/lib/prep.ts:179–181,341` 对缺失/非法 assetPolicy 静默使用 fallback。实际缺少 policy 的 candidate、`assetPolicy='erase'` 的 compose 都被接受。指南要求素材操作显式，不能隐式赋予权限。
- `:140` 字符串强制转换接受 `source:42`；`:164` 对 JSON `null` 直接抛异常；互斥字段未检查；两份闭合 v2 围栏作为一个 source 被接受。这些探针证明终结参数层未完成指南要求，**不等于这些非法稿必然能通过后续交付门禁**。
- `:269–272` 接受知识工具与终结工具混用；模型在未看到知识结果前的 compose 被立即执行，DS 脚本还把它设为成功预期。指南 §5.2 建议混用视协议错误。
- `:227` 重建最后用户消息丢失 `images`；已用实际 prep invoke 参数确认缺失。这只验证传参，没有验证图像理解。
- `:317` 无合法终结的“已经改好并保存了。”直接变为 reply。本探针得到 reply，没有任何 draft/receipt；准备提示词也未落实“不得冒充已保存”。应由协议和提交回执保证状态，不能增加中文关键词路由。
- `src-tauri/src/chat.rs:1323–1326` 的 PrepReply 不保留 finish_reason/usage，`:1485–1486` 对请求记录传 None。指南 §5.5 的准备费用/截断证据仍未接齐（静态核对）。

原 DS 测试还有两处证据口径问题：`scripts/prep-contract-check.mjs:250` 仅检查返回 source 的子串却名为“正文进入交付（不是只存聊天）”，没有触发 App/存储；`:212` 的 correctionSent 查任何用户消息含 `finish_preparation`，初始 PREP_INSTRUCTION 已含该词，所以该断言不能证明发生纠偏。`chat-with-ready-and-v2-example` 人工给 `creationContract=false`，没有覆盖 App 的历史创作条件。

## 已验证的改进

- 结构化 reply / compose / candidate 分支存在；App candidate 的 `directSource` 跳过第二次正文请求，并进入主写作使用的候选处理路径（静态检查 `src/App.tsx:827–884`）。因此不能说 F3 完全没改，但本探针不证明真实存储交付完成。
- 独立探针确认：第三次返回合法 compose 仍执行；三次空返回后 exhausted 且无第四次；401 与取消各只发生一次 prep invoke、不会被转 compose，也没有协议纠偏重试。这 4 项全部 PASS。
- DS 原始 73 PASS 是本次真实复跑结果；不能凭它替代本指南遗漏的反例、真实 App 提交验证或真实模型验收。

## 证据文件

- `original.log`、`original/raw.json`：原 DS 脚本完整执行结果。
- `counterexamples.mjs`：独立精确反例，可复跑；无生产模块复制。
- `counterexamples.json`：完整输入、准备 invoke、返回、素材输出与台账、源文件 SHA-256。
- `counterexamples.log`、`counterexamples.md`：简表，18 项指南符合性探针的逐项结果。
