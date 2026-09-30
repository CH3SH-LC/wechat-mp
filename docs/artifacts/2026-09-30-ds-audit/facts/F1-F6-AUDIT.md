# F1/F6 审计：原始回归通过，事实保护仍不能关闭

审计日期：2026-09-30。工作区：`D:\deepseek-harness\wechat-mp-desktop`。仅只读检查和合成数据离线/隔离浏览器验证；没有修改产品源码、没有调用真实模型、没有启动桌面、没有访问真实作品。服务由根代理提供：`http://127.0.0.1:1448`。

## 实际运行

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| `scripts/repair-integrity-check.mjs --out <本目录>/integrity` | exit 0，58 PASS / 0 FAIL | `integrity.log`、`integrity/result.md` |
| `scripts/repair-flow-check.mjs <本目录>/flow http://127.0.0.1:1448` | exit 0，13 PASS / 0 FAIL，2 个真实 App 场景 | `flow.log`、`flow/evidence-summary.json` |
| `node <本目录>/boundary-probe.mjs http://127.0.0.1:1448` | Node exit 1，5 场景中 2 符合期望、3 不符合期望 | `boundary.log`、`boundary-summary.json` |

边界探针只 route 替换生产 `sendChatMock` 的模型输出；生产 App、compose、正文投影、事实抽取、门禁、候选循环和浏览器文档持久化不替换。每个场景新建隔离 context。5 组均无页面异常、无外链请求。源码 SHA-256 记录于 `boundary-summary.json`；所有输出写本目录，未覆盖历史产物。PowerShell 运行器最后读取日志故自身 exit 0，日志中的 `boundaryExit=1` 是 Node 真实退出码。

## 已确认修复

- 原来的“首稿 emoji 阻断后，自动修订删除整句事实仍 accepted”已修。DS 原始真实 App 反组为不 accepted，正组 accepted；两组第二轮都记录 `bodyApplicability=applied`。
- 首稿事实基准现于 `src/App.tsx:1172` 冻结；后续通过 `1049–1058` 调 `bodyIntegrity`。候选退化检查 `1179–1198` 位于 `acceptedCand=cand` (`1213–1214`) 和预算结束 (`1227–1230`) 之前，原 best 提前提升缺陷已消除。
- `delivery-quality.ts:1073–1076` 统一 warning 与 body.ok 口径；实际 App 独立一行 emoji 删除通过（`standalone-emoji-preserved/`）。DS 纯函数还验证了时间格式、电话边界、姓名换序等原 F6 指定用例。

## 三个已在当前 App 复现的剩余问题

三组都发生在同一用户回合的自动修复，无用户修改事实授权；均为 `write → revise`，首稿 emoji 确实阻断，修订 `bodyApplicability=applied`、`factsMissing=[]`、最终 `accepted=true`，修改后的 source 已进入隔离 localStorage 文档。

### 1. 只删原夹具地点仍验收

原文：`活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。` 自动修订仅去掉 `在东区操场`（并修复 emoji），仍 accepted。

根因：`delivery-quality.ts:812` 的地点正则在 `30 分在东区操场` 的空格后先匹配 `分在东区操场`。`placeOf` (`850–859`) 不去掉“分”；该命中与高优先级时间的末尾“分”重叠，于 `898` 整项丢弃，最终 beforeFacts 根本没有 place。它不是合理的无事实文章，也没有“无法验收”状态。

DS 单项删除地点测试 `scripts/repair-integrity-check.mjs:88,105–116` 改用了不含空格的 `8点30分`，所以原夹具的带空格上下文漏检未被覆盖。`flow` 同时删除整句，其他四类事实仍足以阻断，掩盖了地点缺失。

证据：`place-only-loss/evidence.json`、`place-only-loss/saved-source.md`、`place-only-loss/final.png`。这属于仍未满足指南 §4.3/§4.5 的边界；历史原抽取同样不精准（当时提取“分在东区”），不能把新实现称为所有地点保护已完成。

### 2. 上午改下午仍被当作同一时间

同一原夹具将 `上午8 点 30 分` 自动改成 `下午8 点 30 分`，仍 accepted。`delivery-quality.ts:784–790` 只捕获数字时分，前后都规范成 `time|08:30`，时段语义丢失。

这直接违背同文件 `751–752` 声明的“任何时刻实际变化一律阻断”，并非要求新增宽泛 NLP 能力。证据：`ampm-changed/`。该反例是本次新发现；未声称它一定是此次提交新引入的回归。

### 3. 行内代码样式会豁免实际正文电话

原文 `联系电话：\`010-55556666\`。` 自动修订成 `联系电话请见后续通知。`，仍 accepted。生产 compose 将号码放进代码 span 后，`bodyText` 在 `delivery-quality.ts:341` 把整个 span 含可见作者文字删除，beforeFacts=[]。保留电话的正组也 accepted，证明不是所有带代码文章都失败。

这不是 SVG 属性/坐标，号码是作者可见正文事实。指南 §4.3 要求区分合法作者代码与内部实现，不授权把代码样式内所有正文事实豁免。DS 测试 `repair-integrity-check.mjs:160–161` 只用内部 asset ID 示例并断言整个行内代码被删，固化了过宽豁免。

证据：`inline-phone-loss/`、`inline-phone-preserved/`。

## 仅源码确认，未扩展成运行结果的缺口

1. **缺基准不闭锁。** `App.tsx:1052–1053` 用 `!baseline` 一律判 not-applicable，未使用 round 区分首次候选与自动修复。`1172` 将空投影转为 null。若首个候选投影失败/为空，后续仍走不适用，和指南 §4.2/§4.5 要求冲突。本次没有构造实际可达空投影修复链，不能与上述三个运行缺陷混报。
2. **单项重试空投影仍不适用，且先更新预览。** `App.tsx:1573–1576` 两侧任一空即 not-applicable；`1560–1566` 在比较/门禁之前更新 HTML 与素材上下文。正常非空路径确实调用 bodyIntegrity；`1539–1542` 复用原 ledger 并只传请求的 retrySlotIds。未实际运行单项素材重试，本次不能声明其端到端验收完成。
3. **投影/来源信息未落实。** `bodyText:343–349` 仍以正则去标签并把所有空白压为一行；`FactToken:696–706` 没有来源范围，内部 start/end 在 `903` 输出时被丢弃。指南要求的正文单元与源文范围映射尚未实现。App 已不再拿源文 ignore 范围套该投影，这一旧误用风险已避开。
4. **无进展仍只看正文投影。** `App.tsx:1236–1242` 比较问题代码与 projection；样式/素材实现进展会被投影去掉，尚非指南要求的候选内容指纹。本次仅静态确认，不宣称已复现错误停止。

## 结论

原 F1 的“没有接线”与 F6 指定子串/emoji/格式问题已有真实修复和回归证据。当前 F1/F6 仍有至少三个可以复跑的自动事实改坏后验收路径，故“全部关闭”超出证据。最小下一步应补入上述三对边界回归，并修正文投影与事实 token 的上下文/时段表示；不应恢复“普通片段变化一律阻断”，否则会重新误杀合法去 emoji。
