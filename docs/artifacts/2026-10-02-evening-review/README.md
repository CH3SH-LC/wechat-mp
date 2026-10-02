# 2026-10-02 晚间进度复核与 DS 继续依据

六个场景的真实 PASS 原件和主要业务结论已经独立核对，当前已有可用成品；此前 R1–R4 多数修复有效。仍有三个确定缺口需要先修：IPC 回退绕过预算、部分未知身份及强制关闭前未重验、业务失败屏障写失败后的跨进程恢复。完整执行要求在 [DS 指南 §0.0](../../design/ds-repair-guide-2026-09-30.md#00-2026-10-02-最新复核与直接执行任务)。

本轮仅读取代码和已有实件，运行零模型检查与替身传输/进程探针；没有启动智序、调用真实模型、读写真实全局总账、修改正式产品/runner、覆盖旧证据或操作历史 PID。唯一浏览器运行是对本机未监听端口的负向检查。Git HEAD 仍为 `472fd3d`，大部分新成果尚未提交。

## 已支持的业务结论

| 场景 | 原结果 | 本次独立核对 |
| --- | --- | --- |
| L1 | PASS 30/30 | 4 请求/1 绘图，正式 gen1，source/HTML/绑定/快照/quality 从实际文件重算 |
| L2 | PASS 36/36 | 2 prep/0 绘图，gen1→2；素材 ID/版本/SVG 保持，正文和标题更新 |
| L3 | PASS 24/24 | 2 prep/0 写作/0 绘图/0 保存，前后 14 字段相同；该阶段最后执行 |
| L4 | PASS 26/26 | gen4→5，配图确实变，102 字正文和标题不变 |
| L5 | PASS 30/30 | 新进程同 profile 读回 14 字段一致；重查完整 phase 窗口原 trace 零请求 |
| L6 | PASS 26/26 | HTML 与正式版字节一致且属于本次新增，PNG 750×1340，预览截图存在 |

这是同 root 内经修复和重试，各场景分别通过。实际成功时间顺序为 L1→L2→L4→L5→L6→L3；期间还有 4 个 FAIL 和 1 个无结果目录。两次 L4 FAIL 实际已提交 gen3/gen4，不能将“判定失败”解释成“没有写入”。L2 保住素材身份和 SVG，但 slotId/引用描述有变化，不能声称整个绑定记录逐字不变。

核验方法、原路径、逐字段比较和 SHA-256 见 [live 原件报告](live/README.md)，含 `audit-summary.json`、`sha256-manifest.json`、原结果及 8 份 trace 副本。当前指纹不能倒推每次历史运行使用同一 runner 源码。

## 本轮直接复跑及新增反例

| 检查 | 本轮结果 | 证据 |
| --- | --- | --- |
| budget | 65/65 PASS | `budget/budget-check/run-result.json` |
| live-driver | 35/35 PASS | `live/driver-check/run-result.json` |
| fact-assert | 30/30 PASS | `live/facts-check/run-result.json` |
| cdp-preflight-check | 23/23 PASS | `cdp-release/existing-cdp-check/run-result.json` |
| runner-negative | 34/34 PASS | `runner-negative/run-result.json`；显式配置现有 Playwright/Chromium，含缺浏览器与落盘故障 |

- [预算与 IPC](budget/README.md)：执行当前安装探针和 Cargo.lock 对应的 Tauri 2.11.5 原协议，非付费 IPC fetch 故障后切换 postMessage，零额度仍到达 2 次假付费传输；宿主预算 Promise reject 同样绕过。健康路径对照为额度 1 只放 1、额度 0 放 0。另复现失败记录落盘失败、恢复旧账本后新实例可继续预留。全部是假传输，不据此推定历史成功样本发生同样故障。
- [进程身份与发布](cdp-release/README.md)：完全 mock 复现同名但路径/创建时间缺失仍关闭，以及温和关闭等待后身份变化仍发强制关闭；没有操作真实进程。已有明确不匹配/完全 UNKNOWN 的拒绝路径仍然有效。
- R1 原收尾函数探针的主结果/报告/附件已全部一致为 PASS，旧矛盾已修；其他旧具体反例的修复范围分别在专项报告记录，不整体撤回已有成果。

调查探针会写本目录固定结果文件；后续先保存快照，迁入正式测试或使用新目录复跑，不能覆盖本次原件。探针退出码 0 表示采样完成，不等于被测功能通过。

## 用量及尝试历史的边界

`attempt-index.json` 索引本次可读 TEMP 匹配目录中 10-02 的 34 个尝试（含一个无结果文件目录），并记录结果路径与哈希。其中 L1 的 17 份记录有 8 BLOCKED、1 ERROR、6 FAIL、2 PASS；这些包含启动、依赖、预算和驱动故障，不能作为模型合规率分母，更不能把 13 次混合尝试推导为稳定“合规率约一半”。

run1 进入前的账本记录为 34/6，最终 56/11，增量 22/5；本 root 原 trace 21 个 request/4 个 gen_svg，差 1/1。无结果的 `L4-2026-10-02T10-14-12-2927b2d0` 与缺失绘图终结记录需进一步关联；保留 UNKNOWN 和预留，不擅自补结果、返还额度或断定已/未计费。历史其它 root 的 34/6 与授权调整不由本轮改写。

## 成品与发布证据

已直接打开手机截图及完整长图查看：标题、窗台书与绿植、开放/闭馆、自习区和咨询电话清晰，未见明显截断或源码泄漏。截图为 375 CSS px 手机壳在设备缩放下的 564×698 像素视口，底部未出现在这张截图内；完整内容由 750×1340 长图核对。分页只有一页，和长图同 SHA，不外推多页分割能力。

- [手机视口截图](visual/L6-preview-375.png)
- [实际导出长图](visual/tuiwen-20261002-1826-长图.png)
- [导出 HTML](visual/tuiwen-1790936811.html)

`visual/manifest.json` 记录三个原件及副本，哈希全部一致。

验收 exe SHA 为 `36b45e256b9be3fe644a1bd060c84e6902b34631ae1f22dfc2375ea628703522`；默认发布 exe 为 `b45d146cbeb26343a31009d7d71b3d1946d64b496ae488b65669a6e13d322626`，setup 为 `1171abf71dd176a077ef38f9efe2ee6a1daa814557f406a07e652a557d99a864`。默认构建日志及启动冒烟 PASS 5/5 原件存在，首次 FAIL 4/5/强制关闭也保留；两次使用不同新 profile，不能推为相同预热原因。验收版业务通过不能自动转成默认二进制同级验收。

feature 属性取值链及验收版预热后可达真实 target 已有证据；TCP 根因仍欠受控 feature×profile 对照，当前只收窄文案，不为证明措辞反复启动或收费。微软 API 和依赖行号见发布专项报告。

本目录 `source-fingerprints.json` 记录复核时 14 个相关输入文件指纹；`evidence-index.json` 为最终证据清单。原失败证据、午间审计、现有作品与账本均保持原样。
