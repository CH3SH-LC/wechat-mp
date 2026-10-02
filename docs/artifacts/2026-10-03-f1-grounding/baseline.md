# F1 基线冻结（2026-10-03）

对应 [下一包 F1 任务卡](../../research/2026-10-03-strategy/next-ds-task.md) 第 2 节「先记录当前 commit、已有 dirty 文件及所用原件身份，保护别人改动」。

## 代码基线

- commit：`839183b51fc69dbb5357564318ea6d7b60b2d102`（工作区 HEAD，未 push）
- 分支：`main`

## 开工前已有的 dirty 文件（他人/上一轮未提交改动，本轮**不动**）

| 文件 | 状态 | 内容 |
| --- | --- | --- |
| `PROGRESS.md` | Modified | 2026-10-03 研究段两条 |
| `PROGRESS-LITE.md` | Modified | 2026-10-03 两条 |
| `REQUIREMENTS.md` | Modified | 2026-10-03 研究登记 |
| `STRUCTURE.md` | Modified | `docs/research/2026-10-03-strategy/` 条目 |
| `docs/README.md` | Modified | 研究入口索引 |
| `cdp-matrix.json` | Untracked | 未跟踪（按仓库口径不入库） |
| `docs/research/2026-10-03-strategy/` | Untracked | 本轮研究的全部产物 |

本轮只**追加**，不覆盖、不回退上述内容。

## 产品源文件基线哈希（修改前）

| 文件 | SHA-256 |
| --- | --- |
| `src/lib/persona.ts` | `e1bfa6f3411f034d4f2c5d0b398dd17728a10504a89ba2c33b8888d69d714465` |
| `src/lib/prep.ts` | `59060d3b5c5fd2f90305cebe576bd4ebce18faa4681216afa321e6f3c68ded6d` |
| `src/lib/revise.ts` | `be080e5a50892e3cbd4b3ec5d8cb7cff42cbf33df49825b358c3bb08b5e87029` |
| `src/App.tsx` | `2fd22ab0c5aac6bb74fea1a3b83a035f1318d537a6745f41c625acb8041075fa` |
| `src/knowledge/文本/内容类型/type-announcement.md` | `83f9e7b9cc5bb588775432be29f7c26cbf41f98852333f336a5ce387bdcf7612` |

**哈希口径**：上表是**工作区 on-disk**（Windows 上为 CRLF）的 sha256。runner 在页面里读到的模块文本
按 Vite 的原样字节算，与 `git show HEAD:<file>` 的 **CRLF 版本**逐字节相同、与上表（LF 语义等价）**不同**——
复核时请按"内容等于 HEAD"判断，不要拿两边的哈希直接比。
（独立复核 2026-10-03 实测：baseline 运行的 `sourceHashes` 正是 `git show HEAD` 内容的 CRLF 版本，
且 `raw.json` 里含旧句"细则优先级高于本提示的通用说法"、无"材料依据边界"、write 末条含旧 digest，
确证改前基线就是 HEAD 行为。）

## 原件身份（只读，不复制、不修改）

隔离 root：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-live-r10-1790955871\profile\Documents\wechat-mp-workspace`

| 原件 | SHA-256 | 说明 |
| --- | --- | --- |
| `traces/rmur4watv-1.jsonl` | `c9a377237bac644e0ea860e9e90800c94e5bde10dd50c1aa29f19472f9de75c9` | L7 长文整回合（9 行） |
| `traces/rmur4ydf1-1.jsonl` | `925d56720f1ad2229136e9ab5bb412dfc34ac486aeccedf342866971f328698f` | L8 续改整回合（8 行） |
| `sessions/s1790955873418387400.json` | `3e4d04ddfc2d2d4fd6ad2ff56735af0fc2ddc9f24c4853d9899534dd3ec3dc4f` | 对话四条（两问两答），含前后两份成品正文 |

哈希与 [材料依据链深挖](../../research/2026-10-03-strategy/grounding-deep-dive.md) 记录的完全一致（同一批原件，未被改动）。
