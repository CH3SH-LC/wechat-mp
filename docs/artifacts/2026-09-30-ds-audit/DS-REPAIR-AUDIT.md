# DS 修复完成度核查

核查日期：2026-09-30（Asia/Shanghai）。对象：`D:/deepseek-harness/wechat-mp-desktop` 当前工作树，以及 `docs/design/ds-repair-guide-2026-09-29.md` 的要求。

**结论：尚未完成。已有实质修复，基础测试与构建通过；但正文保护、当前回合授权、素材保持、预览隔离仍有可复现缺口，真实模型验收和测试工具整改也没有闭环。指南开头“F1–F5 已关闭”的记录超出了现有证据。**

本次只做核查：未修改产品源码、未启动桌面或安装器、未调用真实模型、未操作真实作品。新增日志、截图和探针都保存在本目录，未覆盖原始失败证据。浏览器验证使用新隔离 context；外链边界测试在本地拦截并响应请求，没有访问目标公网服务。

## 1. 完成度对照

| 项目 | 当前判断 | 核查依据 |
| --- | --- | --- |
| F1 自动修复事实基准与候选提升 | 部分完成 | 原 body=null 接线及提前提升已修；原正反组通过，但三个单项事实反例仍 accepted |
| F6 事实匹配与 warning 口径 | 部分完成 | 原子串、格式、姓名换序、emoji 用例通过；时段和作者正文投影仍漏检 |
| F2 准备结果契约 | 部分完成 | 结构化结果、共享三次预算、错误不转创作已实现；历史创作仍被当作本回合授权 |
| F3 完整稿进入统一交付 | 接线已改，验收不足 | candidate 共用交付代码存在；现有 prep 脚本只证明返回 source，未证明真实 App/桌面提交 |
| F4 只改文字时保持素材 | 未满足 | 无匹配绑定仍派发绘图；库更新后采用新版而非文档快照；歧义绑定取第一项 |
| F5 中间预览资源隔离 | 部分完成 | 原带引号 img 用例通过；四种合法 HTML/CSS 写法仍发起外链请求，另有两种显示破坏 |
| T1 测试基础与唯一判定 | 未完成 | 新脚本存在；异常退出仍生成全 PASS 报告；旧真实 runner 未整改 |
| E 发布、真实验收与证据闭环 | 未完成 | 新 exe/setup 存在；未找到完整发布输入证明；新真实模型首篇、续改、重开、导出未执行 |

## 2. 需要 DS 继续处理的主要问题

### R1：自动修复仍可改坏正文事实并保存

优先级：沿用指南 F1/F6 的 P0。证据层级：**当前 App 实际候选循环和浏览器文档持久化**；只替换模型输出。

| 自动修订内容 | 应有结果 | 实测结果 |
| --- | --- | --- |
| 仅删除原夹具中的“在东区操场” | 拦截事实丢失 | `bodyApplicability=applied`，`factsMissing=[]`，`accepted=true` |
| “上午8 点 30 分”改成“下午8 点 30 分” | 拦截时刻变化 | 两者都规范成 `08:30`，最终 accepted |
| 删除以行内代码格式显示的 `010-55556666` | 拦截联系电话丢失 | 首稿电话先被正文投影删掉，beforeFacts 为空，最终 accepted |

三个反例都属于同一用户回合的自动修复，没有用户授权修改事实。每组均确认首稿因 emoji 阻断、真实执行 write→revise，修订源文已保存。保留电话、合法去掉独立 emoji 的两个正例通过。

根因位置：

- [delivery-quality.ts:812](D:/deepseek-harness/wechat-mp-desktop/src/lib/delivery-quality.ts:812)：地点匹配把“分在东区操场”作为候选，与时间重叠后在 898 行被整项丢弃。
- [delivery-quality.ts:784](D:/deepseek-harness/wechat-mp-desktop/src/lib/delivery-quality.ts:784)：时刻 token 不包含上午/下午。
- [delivery-quality.ts:341](D:/deepseek-harness/wechat-mp-desktop/src/lib/delivery-quality.ts:341)：正文投影删除整个行内代码 span，连实际可见作者事实一起豁免。

验收要求：三组反例都必须不提交，两个正例保持通过；不能通过恢复“所有正文改动一律阻断”来修。原始失败夹具含空格的时间和地点上下文必须保留，不能换成更易通过的表达。

证据：[五组结果与源码指纹](facts/boundary-summary.json)、[详细分析、trace、source 与截图索引](facts/F1-F6-AUDIT.md)。

### R2：历史创作状态仍会把当前普通问答变成创作

优先级：P1。证据层级：**生产 runPrep 实测 + App 静态接线**；尚未据此声称真实文稿被覆盖。

历史曾要求写通知；当前用户说“请解释 NOT READY 的意思，暂时不要编辑文稿。”，受控模型回复 `NOT READY`。使用 App 相同表达式和生产 `isCreateRequest` 得到 `creationContract=true`，生产 runPrep 两次调用后返回 `compose, legacyCompat=true`。同样历史下，用户只要求 v2 语法示例，返回示例却被转为 candidate。

根因：[App.tsx:745](D:/deepseek-harness/wechat-mp-desktop/src/App.tsx:745) 与 [App.tsx:752](D:/deepseek-harness/wechat-mp-desktop/src/App.tsx:752) 将历史创作布尔值作为当前授权；[prep.ts:112](D:/deepseek-harness/wechat-mp-desktop/src/lib/prep.ts:112) 识别任意 READY 单词，[prep.ts:307](D:/deepseek-harness/wechat-mp-desktop/src/lib/prep.ts:307) 在纠偏后自行转创作。

验收要求：由当前回合合法模型契约决定 reply/compose/candidate；不能用历史关键词或围栏补造授权。上述两组必须保持普通答复或明确协议失败。保留第三次合法终结可执行、三次空答耗尽、网络失败和取消不转创作的现有正例。

### R3：preserve 没有保证零绘图、同一素材快照和唯一绑定

优先级：P1。证据层级：**生产 materializePlaceholders 实测**；存储/模型 invoke 为受控桩。

- 旧绑定与新占位描述不能确定性对应时，`preserve` 仍派发一次 `gen_svg`。桩立即取消，未真实绘图或消耗额度；缺陷在于已经进入派发。
- 文档快照为 v1、同 ID 素材库为 v2 时，实际采用 v2 SVG，台账标记 `recover/ok, version=2`。绘图为 0 不等于素材没变。
- 同 slot 存在两个旧绑定时，静默采用第一项，没有阻断歧义。

根因：[image-agent.ts:465](D:/deepseek-harness/wechat-mp-desktop/src/lib/image-agent.ts:465) 的 `find`；[image-agent.ts:891](D:/deepseek-harness/wechat-mp-desktop/src/lib/image-agent.ts:891) 只保护已匹配分支；[image-agent.ts:893](D:/deepseek-harness/wechat-mp-desktop/src/lib/image-agent.ts:893) 使用当前库内容而非文档快照。

验收要求：preserve 在派发前拒绝无法唯一对应的槽位；从文档快照恢复原 ID、版本、内容；明确 modify 才允许新增或更换。`asset-completion-check.mjs:343` 将“preserve 无绑定仍可新绘”写成 PASS 预期，与指南相反，必须同时修正。

R2/R3 证据：[完整输入、invoke、结果与台账](prep/counterexamples.json)、[详细源码审计](prep/report.md)。

### R4：预览抑制仍漏放外链，并破坏正常样式和图片

优先级：外链 P1，显示破坏 P2。证据层级：**实际 PreviewPane 与 iframe srcdoc**，不是仅检查正则返回值。

四种输入均观测到浏览器资源请求：无引号 `img src`、HTML 实体编码 URL、CSS 字符串形式的 `@import`、style 中带 HTML 实体的 CSS URL。请求被测试 route 本地响应，仍计为失败。

另外，CSS 替换插入双引号后截断外层双引号 style 属性，后续颜色失效；混合 srcset 直接按逗号分割，破坏 data URI，正常 2×2 PNG 的 `naturalWidth` 变成 0。

根因：[preview-safe.ts:35](D:/deepseek-harness/wechat-mp-desktop/src/lib/preview-safe.ts:35)、[preview-safe.ts:42](D:/deepseek-harness/wechat-mp-desktop/src/lib/preview-safe.ts:42)、[preview-safe.ts:61](D:/deepseek-harness/wechat-mp-desktop/src/lib/preview-safe.ts:61)、[preview-safe.ts:85](D:/deepseek-harness/wechat-mp-desktop/src/lib/preview-safe.ts:85)。当前“绝不会漏放”的注释已被实测反驳。

验收要求：在浏览器实际解析边界验证完整资源语法和实体解码；禁止资源零请求，合法 data/blob 资源和无关样式保持可用；原始候选仍进入门禁，不能洗掉诊断。八组现为两个正例通过、六个反例失败。

证据：[请求、DOM、图片解码和计算样式](preview/boundary-results.json)、[详细报告与复跑命令](preview/AUDIT.md)。

### R5：回归工具和真实验收尚不能支撑“完成”

优先级：P1（验收闭环），脚本错误汇总 P2。

1. 对 `preview-resource-check.mjs` 传无效本机端口，实际导航异常、进程 exit 1，但 finally 写出“全部 PASS”，且执行检查数为 0。应统一退出码、JSON、Markdown 的判定，并要求执行完成，异常为 ERROR/BLOCKED。[错误报告原件](preview/runner-error-control/result.md)。
2. prep 脚本将“返回 source 含正文”称为“正文进入交付”，未执行 App 提交；非创作示例人工传 `creationContract=false`，遗漏真正的历史创作入口；知识工具和终结混用被写成成功预期。
3. `scripts/live-three-samples.mjs` 与指南前 SHA-256 完全相同。未找到完成指南要求的替代真实 runner、隔离启动器和统一业务判定器。该脚本仍有硬编码、挑最新 trace、清空文档、只打印部分预期等旧问题，不应直接据其输出签收。
4. DS 在 `PROGRESS.md:92–94` 明确记载新真实模型回合未执行。原来的真实模型日志测试的是旧协议，不能证明新 finish_preparation 的模型行为与续改提交成功。

后续收尾顺序：先修上述已复现问题并补回归，再运行新 profile 下少量真实首篇→只改文字→明确换图→失败保留旧稿→正常重开与导出。判定必须核对本轮 revision、source、HTML、bindings、snapshots 和 trace，不能仅看旧成品仍在或助手声称已保存。

## 3. 本次已通过的验证

| 核查 | 结果与范围 | 证据 |
| --- | --- | --- |
| `cargo test --lib` | 132 passed，0 failed，4 ignored；未执行忽略的真实调用 | [日志](cargo-test.log) |
| `tsc --noEmit` | exit 0 | [日志](tsc.log) |
| Vite build | exit 0；写独立目录，没有覆盖 release/dist | [日志](vite-build.log) |
| 当前 dist 对独立前端构建 | 155 个文件逐个 SHA-256 相同 | [对照结果](frontend-build-comparison.json) |
| `verify-ui.mjs` | 133 PASS，VERIFY OK，exit 0 | [日志](verify-ui.log) |
| `repair-integrity-check.mjs` | 58 PASS | [日志](facts/integrity.log) |
| `repair-flow-check.mjs` | 13 PASS，两个当前 App 正反场景 | [结果](facts/flow/evidence-summary.json) |
| `prep-contract-check.mjs` | 10 场景、73 PASS | [日志](prep/original.log) |
| `preview-resource-check.mjs` | 现有样例全部 PASS | [结果](preview/existing-script/result.md) |

这里没有将 DS 声称的九项 602 断言当成本次全部重跑结果。新增边界探针是定向选择的缺口样本，不是产品随机抽样，不能据其失败占比推算整体成功率。

确认的改进还包括：首稿基准冻结、正文比较执行、退化检查先于候选提升、独立 emoji warning 不再误杀；准备阶段第三次合法结果可用，网络错误和取消不会变成创作。这些修复应保留。

## 4. 尚未运行复现的源码缺口

以下是静态核对，不混称为已发生的数据覆盖或端到端失败：

- [App.tsx:718](D:/deepseek-harness/wechat-mp-desktop/src/App.tsx:718)：读取当前正式稿失败只 console.warn，随后按无旧稿继续。与同段注释及指南要求相反；应停止本轮提交并显示读取失败。
- App 修复阶段缺基准仍可标 not-applicable；单项素材重试空投影处理、先更新预览等路径尚未做本次运行复现。
- 正文投影仍折成一行，token 来源范围未保留；无进展判定使用正文投影而非完整候选指纹。
- 准备终结参数缺失/非法 assetPolicy 会默认补值，非字符串 source 会被强制转换；相关参数探针失败不等于后续门禁一定会放行。最后用户 images 在准备消息重建中被丢弃，已核对传参，但未测试图像理解。

这些详细位置与边界说明见 [事实专项](facts/F1-F6-AUDIT.md) 和 [准备/素材专项](prep/report.md)。

## 5. 发布版本和证据边界

Git HEAD 为 `1c2afbe26f78baa62368b38307935a82e44e0f9c`，实际产品来自大量未提交修改，不能仅用 HEAD 代表被测版本。本次记录了 263 项相关输入的 [审计时源码清单](audit-source-manifest.json) 和 [工作树状态](git-status.txt)；此清单不能倒推历史构建 provenance。

当前新发布文件确实存在：

- exe：15,705,600 bytes，SHA-256 `FD24167433D70B352540551FE4174D746E42510365FC9D193B1ED0A1504B3DF8`。
- `智序_0.1.0_x64-setup.exe`：4,582,036 bytes，SHA-256 `02148B3C2FDC53F3CC4144804B0AF9D424F499AD88B0DCC0899AAC545D989580`。
- 二者修改时间 2026-09-29 16:32:18（北京时间）。独立前端构建与现有 dist 相同，不能由此单独证明 exe 内嵌资源及全部 Rust 输入的历史对应关系。

DS 的隔离启动仅有文档中的窗口与文件计数记录，本次没有再次启动；计数相同不能替代真实数据文件哈希一致。完整发布前后输入 manifest、新协议真实模型验收、真实桌面续改后的正常重开和导出仍缺证据。

**建议签收状态：退回继续修复，保留已通过项；不要将 A–E 整体标记为完成。**
