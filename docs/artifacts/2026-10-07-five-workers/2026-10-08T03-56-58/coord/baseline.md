# 五并发基线（父协调者）

- run-id：`2026-10-08T03-56-58`（实际启动时间，本地时区）
- 执行目录：`D:\deepseek-harness\wechat-mp-desktop`
- 依据：[DS 五并发操作指南](../../../../design/ds-five-workers-guide-2026-10-07.md)

## 源码与工作树基线

- HEAD：`df97022acedb6e1a3172a8459337c72894f68e0a`（与指南编写时一致，未发生漂移）
- 工作树（开工时）：
  - 未跟踪，**必须保留**：`cdp-matrix.json`、`docs/design/ds-five-workers-guide-2026-10-07.md`
  - 已修改未提交：`PROGRESS.md`、`PROGRESS-LITE.md`、`REQUIREMENTS.md`、`STRUCTURE.md`、`docs/README.md`
    —— 内容为上一轮（2026-10-07）指南交付的文档同步，本轮不覆盖、不还原。
- 无其他未提交代码改动；`src/`、`src-tauri/src/`、`scripts/` 与 HEAD 一致。

## release 产物（代码改动前基线）

| 产物 | 路径 | SHA-256 | 字节 | 时间 |
| --- | --- | --- | --- | --- |
| exe | `src-tauri/target/release/wechat-mp-desktop.exe` | `c86f5059ca42fc115f8cb18e0f337bbf24e3d2f5a508a9ac890a220dd26ff840` | 15,879,168 | 2026-10-03 12:39 |
| setup | `src-tauri/target/release/bundle/nsis/智序_0.1.0_x64-setup.exe` | `d00d1ef2a273eb0675898d4bab4297884d2d57c7bf3df9d64882050bb7505691` | 4,603,113 | 2026-10-03 12:39 |

两个哈希与指南登记一致。本轮若代码/persona/内置手册资源变化，按铁律 7 重建，重建后的身份写入 `final.md`。

## 证据原件位置

- G1：`%TEMP%\wxmp-f1-real-g1\evidence\G1-2026-10-03T04-41-46-69f5bf4d`
- G2B：`%TEMP%\wxmp-f1-real-g1\evidence\G2B-2026-10-03T04-44-15-17a443c1`
- G2A：`%TEMP%\wxmp-f1-real-g2a`
- G3：`%TEMP%\wxmp-f1-real-g3`

## 本实例实际提供的工具（按实际 schema，不臆造）

| 能力 | 工具 | 说明 |
| --- | --- | --- |
| 委派 | `Agent(subagent_type, prompt, model?, isolation?)` | 后台运行，完成时以 task-notification 通知；**不给子任务继承父上下文**，每张任务卡自带全部所需信息 |
| 列状态 | `ListAgents`；`TaskList` / `TaskGet` | 列出可发消息的 agent 与任务清单 |
| 收集结果 | 完成通知 + `Agent` 返回值；`TaskOutput`（后台 bash 用） | 子任务最终报告只回父协调者，不直接面向用户 |
| 续发 | `SendMessage(to, message)` | 可对已完成的 agent 继续发消息（保留其上下文），用于 E 路候选派发 |
| 中断 | `TaskStop(task_id)` | 按 agent 名或 ID 停止 |
| 容量 | 无硬性并发上限 | 本轮按指南维持 A–E 最多五路后台 + 父协调者；**子任务禁止再派发后代** |

## 五路任务 ID（实际派发）

| 路 | 子任务 ID | 状态 |
| --- | --- | --- |
| A 协议诊断与修复 | `afea2ee302f1987b5` | 运行中 |
| B 安全分页 | `a0be346621553fc0e` | 运行中 |
| C 安装与使用说明 | `a3bd6a7c62ca9860e` | 运行中 |
| D 原件重判与验收准备 | `a82871dbc2c7835ae` | 运行中 |
| E 独立复核 | `a94643f3abb4b547b` | 运行中（第一阶段：判据 + 缺陷复现；第二阶段由父协调者 SendMessage 追加候选） |

容量：五路后台任务与父协调者并行，未超过本实例能力；五个 ID 存在不等于五个任务全程重叠运行，实际重叠与起止时间在 `final.md` 记录。

## 五路任务与写入所有权（严于指南，禁止越界）

| 路 | 唯一允许写入 |
| --- | --- |
| A | `src/lib/prep.ts`、`scripts/prep-contract-check.mjs`、`A/` |
| B | `src/lib/htmlToImage.ts`、`scripts/export-paging-check.mjs`、新夹具 `scripts/fixtures/2026-10-07-safe-paging/`、`B/` |
| C | `src-tauri/resources/使用手册.html`、`C/` |
| D | `scripts/live-acceptance.mjs`、新脚本 `scripts/f1-artifact-rejudge.mjs`（确有必要才新增）、`D/` |
| E | `E/` 内的复核脚本、报告、截图 |

父协调者独占：`REQUIREMENTS.md`、两份 `PROGRESS`、`STRUCTURE.md`、`docs/README.md`、`coord/`、集成提交、`App.tsx` 等未分配生产文件、release 目录、真实桌面实例与累计账本。

共同禁令（五路）：不 `git add` / `git commit` / `git stash`；不 `pnpm build` / `pnpm tauri build` / 不写 `dist/` 与 `src-tauri/target/`；不启动桌面应用或真实模型；不改 `src-tauri/src/**`（A 若确证需要 Rust schema 改动，交最小补丁建议给父协调者）；不覆盖历史证据目录。

## 检查合同与预算

- 顺序：A–E 先做**离线**工作；父协调者收齐候选后冻结、集成、重建 release、再做隔离桌面与授权内真实小样。
- 同因两次失败即停该路追加补丁，转父协调者诊断。
- 累计账本沿用 F1 授权范围，不重置、不扩容；开工前读取实际账本与失败屏障（父协调者执行）。
