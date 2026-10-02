# 文档导航

更新：2026-10-02。先读当前文档；历史轮次可通过 Git 或本次清理备份查询。

| 读者 / 问题 | 唯一入口 |
| --- | --- |
| F1 已实施：全入口遵守材料依据边界（改动、实参截获红绿对照、三组样本判定、未覆盖项） | [F1 交付与证据](artifacts/2026-10-03-f1-grounding/README.md) |
| 未来方向、为何慢、怎样高效驱动DS | [2026-10-03四路研究与计划](research/2026-10-03-strategy/README.md) |
| 下一轮只派F1的短任务卡，旧专项已独立复核 | [五字段DS任务卡](research/2026-10-03-strategy/next-ds-task.md) |
| 项目目标、范围和完成标准 | [GOAL](../GOAL.md) |
| 产品介绍、安装、截图 | [项目 README](../README.md) |
| 软件具体怎么用 | [随安装包发布的使用手册](../src-tauri/resources/使用手册.html) |
| 当前需求、永久约束、待办 | [需求基线](../REQUIREMENTS.md) |
| 开发环境、验证与打包 | [开发指南](DEVELOPMENT.md) |
| 文件在哪、模块做什么 | [项目结构](../STRUCTURE.md) |
| 最近状态 / 变更原因与验证 | [精简进度](../PROGRESS-LITE.md) / [详细进度](../PROGRESS.md) |
| 当前能力与继续任务：F1 材料依据边界已实施并离线验收（真实语义未验），下一包为分页可读性与真实交付 | [F1 交付与证据](artifacts/2026-10-03-f1-grounding/README.md)、[10月3日综合状态](research/2026-10-03-strategy/README.md)、[定向复核](research/2026-10-03-strategy/verification/README.md) |
| 真实模型验收（默认发布版 L1–L6 同一 exe）的结果、两次真实失败与修复 | [真实模型验收记录](artifacts/2026-10-02-r8-real-acceptance/README.md) |
| 用户交付面：多页导出、安装交付与后台核对清单、长文代表稿、证据口径修订 | [P1/P2 交付面记录](artifacts/2026-10-02-p2-delivery/README.md) |
| 第二轮 P0 收口（P0-A 特殊 IPC 响应 / P0-C 终结顺序）执行记录与反证 | [第二轮 P0 收口](artifacts/2026-10-02-p0-closeout/README.md) |
| 上一轮执行与反例（历史，以最新复核的勘误为准） | [DS收口记录](artifacts/2026-10-02-closeout/README.md)、[晚间复核证据](artifacts/2026-10-02-evening-review/README.md)、[午间历史反例](artifacts/2026-10-02-continuation-review/README.md) |
| CDP 历史连接失败及 preflight 身份、收尾、归档缺口 | [WebView2 与真机验收](design/webview2-cdp-and-live-acceptance-2026-10-01.md) |
| 第一轮任务及原始失败输入（历史关闭状态已被复测更新） | [第一轮指南](design/ds-repair-guide-2026-09-29.md)、[原始失败夹具](artifacts/2026-09-29-capability-review/README.md) |
| AI 提示词与知识注入入口 | [上下文索引](ai-context/README.md) |
| 体验与素材问题调查与修改方案（P0/P1/P2 已实施；残留项见需求基线） | [代码调查建议](design/improvement-review-2026-09-24.md) |
| 文档库、素材库的已确认决策 | [V3 决策记录](design/docs-assets.md) |
| 「AI 工作中」气泡的决策与阶段口径 | [工作气泡决策记录](design/working-bubble.md) |
| 素材复用故障的根因、修复口径与分批安排 | [素材复用修复决策（第一批）](design/repair-2026-09-28-batch1.md)、[（第二批：等待控制与实际尺寸检查）](design/repair-2026-09-28-batch2.md) |
| 输出上限与推理档位的实测口径（查服务端而非猜） | [全量修复决策](design/repair-2026-09-29-full.md) |
| 最新稿 SVG 源码泄漏、统一质量门禁与完整版本回滚（A–E 五批已实施，含两处口径裁决） | [修改方案](design/quality-recovery-plan-2026-09-29.md) |
| 照片位吞并素材块导致源码泄漏的回归证据（先证红 + 真实源文副本） | [回归产物](artifacts/2026-09-29-photo-swallow/) |
| 「筑基」失败稿的修复副本与前后对比 | [修复副本与报告](artifacts/2026-09-28-repair/repair-report.md) |
| 发布版本与当时验收 | [发布说明](../RELEASE-NOTES.md) |
| 截图和排版样例 | [验证产物说明](artifacts/README.md) |
| 本轮清理范围、备份与恢复 | [整理记录](maintenance/2026-09-24.md) |
| 协作规则 | [CLAUDE.md](../CLAUDE.md) |

## 维护约定

- 同一事实只维护一处正文，其余用链接引用；提示词与知识正文以源码为准，不再维护导出副本。
- 需求登记写目标、验收、状态；详细进度写原因和验证；精简进度每条一句话，不复制文件清单或测试日志。
- 已完成的旧轮次由 Git 保留。阶段结束后压缩为里程碑；尚未解决的事项必须留在需求基线，不能随历史删除。
- 设计记录保留用户决策，并明确区分目标与实现；截图说明标注产生时期，不能当作新一次验收。
- `src/knowledge/` 是应用打包加载的运行时语料；使用手册是安装资源，均不属于可直接清除的历史文档。
- 本次整理的开始时存在的文档和产物已在仓库外完整备份，清理清单与恢复说明见整理记录；不在仓库新建历史垃圾堆。
