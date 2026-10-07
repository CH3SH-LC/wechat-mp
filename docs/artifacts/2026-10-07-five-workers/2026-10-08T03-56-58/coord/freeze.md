# 候选冻结（父协调者）

冻结时间：2026-10-08。冻结后 A–E 停止写入生产文件；任何后续改动都必须重新冻结并交 E 重验。

## 冻结构成（SHA-256）

| 路 | 文件 | SHA-256 |
| --- | --- | --- |
| A | `src/lib/prep.ts` | `882e3edbaaa7b1b63a6988e2d368f050fbca1b46503c58417a69676e8f91d3db`（修订后，见下） |
| A | `scripts/prep-contract-check.mjs` | `662862cecc816852e745243adfb7a90b1095cb943f6f7d3205920e0f40a2a465` |
| B | `src/lib/htmlToImage.ts` | `573788d84cbf1ba0a66561298314181de1b1ce65fbf059480280e5601b723b64` |
| B | `scripts/export-paging-check.mjs` | `849aa98c0193b6c1134510b1ea380980b7c2a996b49e43eeef3dbb4b77f7c3c5` |
| B | `scripts/fixtures/2026-10-07-safe-paging/short.md` | `7e80745d2d8db53c51c097cd988a4c3ad0ada0b92f4c28833a6bebb90e07f9c0` |
| B | `scripts/fixtures/2026-10-07-safe-paging/text.md` | `f5028e42897e9394d9c4cfff321a5b468c92e5288c1f862099f1c61af8d54523` |
| B | `scripts/fixtures/2026-10-07-safe-paging/art.md` | `9f7a59b7fefcb88fa138da847d7d1d0534e52e417cf9b07b12827c3cdce04fd7` |
| C | `src-tauri/resources/使用手册.html` | `ce0f8498eff482481a0961458daf4c640ee414345350838b3cfc10f12130ac1d` |
| D | `scripts/f1-artifact-rejudge.mjs`（新增） | `44a4621f11779d00c7a500ae3f000f50894f70ea526c995297bb7d1c2dd7f995` |
| **父** | `scripts/live-acceptance.mjs`（集成改动，见下） | `2adb9e0ee15f9cfd6460974bc7470e58e5329ff35864b47ef8d59ac1cef475f4` |

约束：`src-tauri/src/**` 本轮**零改动**；`src/lib/prep.ts` 的 `parseFinishArgs` 与 `MAX_PREP_CALLS` 未改。

## 父协调者的跨文件集成改动（唯一一处）

**`scripts/live-acceptance.mjs` 的 L6 分页断言**——B 路改变分页切法后的**跨文件后果**，B 已按规程拒绝自行跨文件修改并上交建议，由父协调者写入。

- **旧断言**：`页数 = ceil(长图高/2000)`、每页高 `= min(2000, 剩余)`。它把**实现细节**当合同；安全分页后页高不再等高，该式在新实现下**必红**。
- **新断言**：`各页高度之和 === 长图高`（连续覆盖 = 无缺页、无重复、无空隙）+ 每页高为正。旧等高实现同样满足此式，故**不是**为转绿而放松——只是不再把某一种切法当成合同。
- 切点精度与超高页原因仍由 B 的 `export-paging-check` 夹具断言承载（B 已用独立探针证红证绿）。

## 本机受影响回归（父协调者实跑，独立端口 1439）

| runner | 结果 |
| --- | --- |
| `prep-contract-check` | **PASS 389/389**，错误 0（与 A 自报一致） |
| `export-paging-check` | **PASS 59/59**，计划 4/4（与 B 自报一致） |
| `app-message-grounding-check` | **PASS 67/67** |
| `repair-flow-check` | **PASS 69/69** |
| `verify-ui` | **PASS 134/134**，计划 26/26 |
| `compose-check` | PASS 98/98 |
| `delivery-quality-check` | PASS 123/123 |
| `asset-completion-check` | PASS 58/58 |
| `asset-resolve-check` | PASS 86/86 |
| `repair-integrity-check` | PASS 75/75 |
| `photo-swallow-check` | PASS 33/33 |
| `svg-quality-check` | PASS 20/20 |
| `progress-check` | PASS 36/36 |
| `trace-check` | PASS 107/107 |
| `fact-assert-check` | PASS 30/30 |
| `budget-check` | PASS 91/91 |
| `ipc-gate-check` | PASS 67/67 |
| `ledger-finalize-check` | PASS 39/39 |
| `runner-negative-check` | PASS 34/34 |
| `live-driver-check` | PASS 42/42 |
| `preview-resource-check` | PASS |
| `raster-check` | PASS 8/8 |
| `live-conformance` | **FAIL 16/17 —— 开工前既有，非本轮回归**（见下） |
| `tsc --noEmit` | 退出码 0 |

缺依赖时 `prep-contract-check` 首次运行如实报 **BLOCKED**（playwright 需 `VERIFY_PLAYWRIGHT` 指定到 `%TEMP%/pw-deps/node_modules/playwright-core`），未以零检查冒充 PASS。

## 已知既有失败（非本轮引入，不得写成"全绿"）

`live-conformance` 唯一红项：`C: compose 无"气泡角饰未定义"警告`，证据 `warnings=6`。

**为什么断定与本轮无关**：该 runner 只读 `src/lib/persona.ts`、`src/lib/compose.ts`、`src/knowledge/排版引擎/engine-write-protocol.md`——
三者在本轮 `git status` 中**均未修改**（本轮改动只有 `prep.ts`、`htmlToImage.ts`、手册、三个 `scripts/` 与夹具）。
`composeMarkdown` 是确定性函数，输入字节相同 ⇒ 输出相同 ⇒ 该红在 `df97022` 上即存在。
**处置**：如实登记，本轮不修（不属 A–E 任何一路的所有权，且修它会引入未评估的 compose 行为变化）。

## 待 E 复核的争点

**B 与 E 对同一现象的结论相反，必须由 E 用决定性实验分开**：
- E（阶段一）：本机受控 Chromium 的 `foreignObject` **无法解码任何 `<img>`**（连 1×1 PNG 都 `EncodingError`）→ 带图多页在浏览器层**未覆盖**。
- B：同机复测**不复现**该限制（`chromium-1234` + `playwright-core 1.63` 下，内联 SVG 与 `data:image/png|svg` 的 `<img>` **均可**光栅化，art 夹具两张插画已按强饱和像素确认画进长图）。

两者可能因**具体 Chromium 构建/启动参数**不同而并存。E 需给出：本次跑的是哪一个可执行文件与启动参数，以及该结论是否可复现；
若确为构建相关，则**"带图多页"在浏览器层的覆盖结论不能统一声称**，以真实 WebView2 补证为准（父协调者执行）。
