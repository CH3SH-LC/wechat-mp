# 五并发最终交付（父协调者）

- 指南：[DS 五并发操作指南](../../../../design/ds-five-workers-guide-2026-10-07.md)
- run-id：`2026-10-08T03-56-58`；开工基线 HEAD `df97022`（未漂移）
- 本轮产物根：[`docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/`](../)（`coord/` + `A/`–`E/`）

## 交付项逐条

| 交付项 | 负责人 | 候选版本（SHA-256） | 实际命令 / 退出码 | 原件路径 | 结论 | 未覆盖条件 |
| --- | --- | --- | --- | --- | --- | --- |
| **A 协议修复** | A（`afea2ee302f1987b5`） | `src/lib/prep.ts` `882e3edbaaa7b1b63a6988e2d368f050fbca1b46503c58417a69676e8f91d3db` | `node scripts/prep-contract-check.mjs` → **PASS 389/389**（exit 0）；变异 5 个 | `A/report.md`、`A/runs/*`、`A/mutants/mutants-result.json` | **ACCEPT（E）** | 真实触发条件本轮**未出现**（详见下"T3 边界"） |
| **B 分页** | B（`a0be346621553fc0e`） | `src/lib/htmlToImage.ts` `573788d84cbf1ba0a66561298314181de1b1ce65fbf059480280e5601b723b64` | `node scripts/export-paging-check.mjs` → **PASS 59/59**（exit 0） | `B/check-run.txt`、`B/run/seams/`、`B/report.md` | **ACCEPT（E）** | 带图多页在**真实 WebView2** 未覆盖；`max-width:100%` 变体未定性 |
| **C 交付** | C（`a3bd6a7c62ca9860e`） | `src-tauri/resources/使用手册.html` `ce0f8498eff482481a0961458daf4c640ee414345350838b3cfc10f12130ac1d` | 手册哈希核对 + 源码逐条比对（E：10/10） | `C/report.md`、`C/delivery-report.md` | **ACCEPT（E）** | **安装与真实后台 = NOT RUN** |
| **D 证据** | D（`a82871dbc2c7835ae`） | `scripts/f1-artifact-rejudge.mjs` `44a4621f11779d00c7a500ae3f000f50894f70ea526c995297bb7d1c2dd7f995` | `node scripts/f1-artifact-rejudge.mjs --sample G2B …` → exit 0（PASS=12 / FAIL=0 / UNKNOWN=0 / N/A=1） | `D/g2b-rejudge.json`、`D/evidence/*` | **ACCEPT（E）**；**原 FAIL 原样保留**（`31ea16cc…`） | 原执行**不因新重判变 PASS** |
| **E 独立验收** | E（`a94643f3abb4b547b`） | 见 `E/phase2-report.md` | 18 个复核脚本，四次运行 exit 0 | `E/criteria.md`、`E/phase1-report.md`、`E/phase2-report.md` | 五项 **ACCEPT** | 见各条"未覆盖条件" |

## 可点击的本机路径

- **安装包**（本轮最终身份，未安装实测）：[`src-tauri/target/release/bundle/nsis/智序_0.1.0_x64-setup.exe`](../../../../../src-tauri/target/release/bundle/nsis/)
  = `c4c5c7b9357a4ba6a5c7ee45a4d07294440ed1e41f9c6e86f3376adf26dfb277`（4,603,695 字节）
- 被测 exe：[`src-tauri/target/release/wechat-mp-desktop.exe`](../../../../../src-tauri/target/release/)
  = `4774c58c9a99b50388cad6423236710ce3c65421a897cd8f177cc938c1ed7d14`（15,883,264 字节）
- 分页/导出成品证据：`%TEMP%\wxmp-f1-five-a\G3\evidence\L6-2026-10-07T20-47-31-cfdf021d\`（含 `L6-preview-375.png`）
- G3 已验收成品：`%TEMP%\wxmp-f1-five-a\G3\profile\Documents\wechat-mp-workspace\`

## 本机串行验收（父协调者实跑，非实施者自报）

| 项 | 结果 |
| --- | --- |
| 受影响回归 | prep-contract **389/389**、export-paging **59/59**、grounding **67/67**、repair-flow **69/69**、verify-ui **134/134** |
| 其余离线/浏览器 runner | 17 个全绿（compose 98、delivery-quality 123、asset-completion 58、asset-resolve 86、repair-integrity 75、photo-swallow 33、svg-quality 20、progress 36、trace 107、fact-assert 30、budget 91、ipc-gate 67、ledger-finalize 39、runner-negative 34、live-driver 42、preview-resource、raster 8） |
| `tsc --noEmit` | exit 0 |
| `cargo test --lib` | **133 passed / 0 failed**（`src-tauri/src` 本轮零改动） |
| 隔离启动冒烟 | **RELEASE-SMOKE PASS**（真实工作区逐文件哈希未变；`via=wm-close`） |
| **`live-conformance`** | **FAIL 16/17 —— 开工前既有，非本轮回归**（E 独立复核确认；不得写"全绿"） |

## 真实调用增量与账本屏障

| 阶段 | 派发 | 绘图 | 结果 |
| --- | --- | --- | --- |
| G2A | +5 | +2 | FAIL（**模型 SVG 质量**，非协议；产品正确 fail-closed） |
| G3 | +2 | 0 | **PASS 25/25** |
| L6（复用 G3 稿，零模型） | 0 | 0 | **PASS** |
| **合计** | **+7** | **+2** | 账本 **101/17 → 108/19**，未重置、未扩容 |

- 屏障：开工时实际敞开的是 **G3**（#138；指南写的 G2A 已在 #137 解除）。已通过 runner 自身的
  `--resume-after-fix` 机制**登记有理由的恢复**（#140、#146），**未删除、未手改 JSON**。
- 本轮结束时 **G3 已以 pass 闭合（#147）**，账本**无未解除屏障**。

## T3 协议修复的证据边界（不得外推）

A 的有界纠偏在两次补测中**都没有被触发**——G2A 与 G3 的准备阶段都一次给出合法 `finish_preparation`。
因此：可以说"原协议错误本轮未复现，G2A/G3 都拿到了成稿机会"；**不能**说"是 A 的修复救回了它们"，
也**不能**说"模型以后不会再犯"。修复正确性目前只有**离线证据**（389/389 + E 30/30、基线对照 4 红）。

## 仍缺条件（明确未完成，不得统一写"全部完成"）

1. **安装**：NOT RUN——本机无 Hyper-V/VM，无可用隔离账户环境。手册与清单已备好，**安装动作未执行**。
2. **公众号后台草稿/手机预览**：NOT RUN——无账号与登录态；仅准备人工核对表，不正式发布。
3. **G2A 语义面**：本轮拿到的是一份 **`draft-failed`**（素材位未完成），**未产生 accepted 成品**，
   故"费用/人数未定不补写"的语义结论**仍未取得**；且 `名额` 一条为**检查器关键词误报**（正文写的是"名额仍在确定中"，
   未编造数字），登记为待裁决项。
4. **带图多页在真实 WebView2**：未覆盖（真机路径只走了单页纯文）。
5. **`live-conformance` C 组红项**：开工前既有，本轮不修，如实登记。
6. **`<img>` 在 `foreignObject` 的可光栅化边界**：E 已撤回"全部失败"、B 的"全部成功"同样过宽；
   实测生产样式 12/12、compose 实际 7 种样式 7/7、真实两跳链 8/8，但 `max-width:100%` 变体未定性。
7. **`live-acceptance.mjs` L6 断言的两处盲点**（E 指出）：页序颠倒、补偿性 +100/−100 仍会通过；
   本轮**未替换**（避免在付费补测前引入未测代码），登记待办。
8. **A 判定类别的口径**：`candidate`+`text` 被 A 纳入可纠偏集（任务卡只点名 `compose`）；E 独立判断
   **不算过宽**（同属"合法 outcome 携带 reply-only 字段"的结构类，构造不出有害反例）。
9. **模型语义长期性**：单次样本通过不等于长期遵守（F1 样本卡原有禁令）。
