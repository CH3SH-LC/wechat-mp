# 验证产物

本目录分三类：**README 配图**、**按日期归档的运行证据**、**本地导出物**。

- README 配图（2026-09 发布阶段，已提交）：`wxmp-desktop-ok.png`、`wxmp-desktop-S12a-docs.png`、`wxmp-desktop-S13a-made.png`。
- [排版样例](compose-sample.html)：由 `compose-check` 生成。
- **按日期归档的运行证据**（每一次验证一个目录，互不覆盖）：
  - [2026-09-30-ds-audit/](2026-09-30-ds-audit/)：第二轮独立复测精选原件副本（39 份及 SHA-256）、精确事实/预览输入、准备/素材探针数据；含已复现失败，不是修复通过报告。配套 [第二轮 DS 指南](../design/ds-repair-guide-2026-09-30.md)，真实模型测试已获授权但此目录没有新付费调用产物。调查脚本禁止原地运行覆盖证据。
  - [2026-09-24/](2026-09-24/)：P0/P1/P2 改动的浏览器 E2E 产物（S1–S16）。
  - [2026-09-29-capability-review/](2026-09-29-capability-review/)：**独立能力验证的失败证据与修复输入**
    （[DS 修复指南](../design/ds-repair-guide-2026-09-29.md) §1.1 的仓库内入口）：`failure-fixtures.json`
    保留受控首稿/修订稿、真实会话原文、已固化的源文与素材绑定（仅合成验收文章，不含 API 凭据）；
    `evidence-index.json` 给出原始证据的绝对位置与 SHA-256；`fact-matcher-design-probes.json` 是
    编写指南时的**生产函数反例**（属离线函数证据）。
    **原始日志、完整图像与版本文件仍在仓库外的原始证据目录**，未搬移、未覆写。
  - [2026-09-28-repair/](2026-09-28-repair/)：
    - 由 `scripts/fixture-repair.mjs` 从真实失败样例（`scripts/fixtures/2026-09-28-basement/`）产出的**修复副本**与前后对比报告：`fixed-source.md`、`fixed-article.html`、`repair-report.md`（逐素材位绘图尝试次数与请求统计）。缺料由浏览器演示池补足，**不代表真实模型产物**。
    - `live-traces/`、`live-sample-{1,2,3}.png`：2026-09-29 **真机三小样**的原始证据（CDP 驱动真实桌面应用、真实 DeepSeek 接口、隔离工作区）。这一组**是**真实模型产物。
  - [2026-09-29-e2e/](2026-09-29-e2e/)：最新一轮浏览器 E2E（S1–S19）。README「界面」一节用的就是这里的三张。
  - [2026-09-29-e2e-final/](2026-09-29-e2e-final/)：同一天的收尾复跑（S1–S22，**107 PASS / 0 FAIL**；S23–S25 于其后补入，需重跑才有对应截图）。
    与上一目录并存是刻意的——同一天两次运行各留一份，便于对比"改动前后同一天内的差异"。
  - [2026-09-29-photo-swallow/](2026-09-29-photo-swallow/)：**照片位吞并后续素材块导致源码泄漏**的回归证据。
    含修复前的**先证红**记录（`--prove-red` 从 git 取修复前版本跑，10 条红）与修复后的逐条实测输出，
    并逐次记录被测 `compose.ts` 的内容哈希——修复期间该文件被并行修改过，证据必须钉在具体版本上。
  - [2026-09-29-repair-integrity/](2026-09-29-repair-integrity/)：**自动修复事实保护**的纯函数回归输出
    （事实规范化、正反对照、正文投影、口径一致），一个 run 一个子目录。
  - [2026-09-29-repair-flow/](2026-09-29-repair-flow/)：**真实 App** 上的事实保护接线证据：
    `facts-lost` / `facts-preserved` 两组截图、原始 JSON（含 trace 与落盘源文）与 `result.md`。
    关键断言是 trace 里出现 `bodyApplicability='applied'`——证明 App 真的执行了比较，而不是纯函数自说自话。
  - [2026-09-29-prep-contract/](2026-09-29-prep-contract/)：**准备阶段结果契约**回归输出
    （`reply/compose/candidate` 三分支、F2/F3 旧协议路径、普通答疑不提交、参数非法、预算封顶）。
  - [2026-09-29-preview-resource/](2026-09-29-preview-resource/)：**预览全过程外链检查**输出：
    `preview.png` 截图、`raw.json`（全部请求尝试与被拦 URL）、`result.md`。断言外链尝试为 0
    且原始违规诊断仍进了门禁（trace 里的 `html.*` 问题码）。
    这三项浏览器证据与 `photo-swallow` 一样：**是受控/离线产物**，不代表真实模型行为。
- **本地导出物与运行截图/判定 JSON（2026-09-30 起不入库）**：`docs/artifacts/**` 下的 `*.png`、`*.json`、`*.jsonl`
  一律由 `.gitignore` 排除，只留在本机——含 `tuiwen-*-长图.png` 导出长图、各轮 E2E 截图、各 runner 的
  `run-result.json` 与原始 JSON 探针数据。本目录随仓库提交的只有报告类文件（`.md` / `.html` / `.txt`）
  与 [排版样例](compose-sample.html)；已提交的 README 配图不受影响（`.gitignore` 不改动已跟踪文件）。
  需要长期文档配图时，从已留档的独立运行目录挑选后单独 `git add -f`。
- 其余 14 张旧场景截图已完整保存在仓库外备份，包含旧失败截图；没有丢弃失败证据。清单与恢复见 [整理记录](../maintenance/2026-09-24.md)。
- 已移除旧 compose-live/probe HTML、提示词注入与风格实验 Markdown、带时间戳的导出长图；原始副本在仓库外备份。

**输出目录约定（2026-09-30 更新）**：仅日期默认目录不能保证同日重复运行不覆盖。
本轮所有 runner 显式传入时间戳与随机后缀组成的唯一 outDir；旧脚本先核对和修正输出参数，已存在结果目录应拒绝覆盖。
冻结失败证据和调查探针不得原地运行写回。需要长期文档配图时，再从已留档的独立运行目录挑选。
