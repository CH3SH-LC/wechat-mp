# 商用级加固 R2：有信息重画 + 长短两档复跑（2026-10-08）

目标（用户原话）：**"以实现商用级长短均可的推文作为目标，持续进行推进"**。

本轮做两件事：① 修一个**有实证**的素材质量缺陷（质检拒收后的重画没有把失败原因带回模型）；
② 在**同一个发布产物**上把"短篇 + 长文"两档各跑一次真机真实模型验收，让"长短均可"从单次样本
变成可复现证据。阈值、模型侧提示词、账本口径一律未动。

## 一、缺陷：重画是"盲画"（产品侧，已修）

**现状（改前）**：`src/lib/image-agent.ts` 的 `drawSlot` 在素材被本地质检拒收后，
**原样重发同一个 brief**（`genOnce(..., brief, theme)`）。模型拿不到"上一版哪里不合规"。

**实证代价**：G2A 两次生成分别有 **30 / 15** 个可见元素完全落在画布外，重画后变成 **44 / 15**——
**越画越差**。同一批证据见 [越界判定修复记录](../2026-10-08-out-of-canvas/fix.md)。

**为什么这是缺陷而不是"模型不行"**：产品里**已经**有一条同构的通道——`refine_brief`。
模型 CLARIFY 追问时，前端把问题交回主模型补 brief 再画一次。也就是说"把上一个失败的事实交回模型"
这条路是通的，**只有质检拒收这条路径没有接上**。

**修法**（只做事实转述，不猜画法）：

| 层 | 改动 |
| --- | --- |
| `src/lib/image-agent.ts` | `GenOnce` 增 `reasons`（**完整**理由，`detail` 仍只留前 2 条）；新增纯函数 `qualityRetryHint(reasons)`（过滤空白、**最多转述 3 条**、无理由返回 `null`）；`drawSlot` 维护 `qualityHint`，**仅在上一次是质检拒收时**写入，并传给下一次 `genOnce` |
| `src-tauri/src/chat.rs` | `gen_svg` 增可选 `hint`；`svg_user_prompt` 把 hint 作为**独立一句**追加，**不混进"画面内容"** |

**几个刻意的边界**：

1. **网络类失败不带提示**——那类失败重发同一 brief 才是对的，加提示只会污染画面描述。
2. **brief 被 `refine_brief` 重写后清空 hint**——旧理由针对的是**旧的画面描述**，继续带着会指错方向。
3. **提示只追加、不替换**——`画面内容：{desc}` 保持原样（Rust 单测钉住这一点：模型不能把几何约束
   当成要画的对象）。
4. **不告诉模型"该怎么画"**——本地质检只掌握几何事实，越界去猜画法等于把提示词变成另一套规则。

## 二、离线验证（注入故障，确定性）

`node scripts/trace-check.mjs` → **116/116 PASS**（2026-10-08 前为 108/108，本轮 +8）。

新增的 8 条分两侧钉住（纯函数 4 条 + 带/不带提示 4 条）：

```
PASS - 重画提示：没有理由 → null（不附加任何东西）
PASS - 重画提示：空白项被过滤，全是空白 → null
PASS - 重画提示：原样转述质检理由，不做改写
PASS - 重画提示：最多转述 3 条（提示不能反过来淹掉画面描述）
PASS - 有信息重画：首画不带修正提示（此时还没有可转述的失败事实）
PASS - 有信息重画：重画带上了质检给出的原因（不是重发同一 brief）
         ("含 <text>（素材禁用文字）；可见元素仅 1 个（inline 至少 6 个；…）；主体占画布仅 0%（…）")
PASS - 有信息重画：画面描述原样保留（提示只做追加，不替换 brief）
PASS - 网络类失败重画**不**带修正提示（那类失败重发同一 brief 才对）
```

Rust 侧单测新增 1 条并全绿：`cargo test --lib` **134 passed / 0 failed / 4 ignored**，含
`svg_user_prompt_appends_quality_hint_without_polluting_content`。

其余离线回归同批全绿：`svg-quality-check` 24/24、`delivery-quality-check` 123/123、
`asset-completion-check` 58/58、`asset-resolve-check` 86/86、`photo-swallow-check` 33/33、
`repair-integrity-check` 75/75、`budget-check` 91/91、`ledger-finalize-check` 39/39、
`ipc-gate-check` 67/67、`progress-check` 36/36、`fact-assert-check` 30/30；`tsc --noEmit` 退出码 0。

## 三、真机 + 真实模型复跑（同一个发布产物）

发布产物：`pnpm tauri build --bundles nsis` 重建，**整个构建结束后**再量哈希：

| 产物 | SHA-256 |
| --- | --- |
| `src-tauri/target/release/wechat-mp-desktop.exe` | `7db3417de79a8a5286cff760e5d967002e7a982b0e08e6bc65959e1a0e75c139` |
| `bundle/nsis/智序_0.1.0_x64-setup.exe` | `7bff42d87ada56ab00f3b83d1495a1f674223f5d4c80848e3df2efb8c98cfe6c` |

| | **短篇 `L1`** | **长文 `BIG`** |
| --- | --- | --- |
| 题面 | 校园图书馆短通知，≤180 字 + 1 张开篇横图 | 校园「秋季社团招新」5 小节 × 每节 2 图、1500–2500 字 |
| 判定 | **PASS 31/31，0 失败 0 错误** | **PASS 26/26，0 失败 0 错误** |
| 回合 | `idle`，88s，think→asset，派发 3（绘图 1） | `idle`，145s，think→asset，派发 13（绘图 11） |
| 成稿 | `doc-state=accepted`、`validation=verified` | 同左 |
| 正文 | **136 字**（≤180） | **1643 字**（≥1500） |
| 产物 | HTML 624,103 B | HTML 1,624,234 B（11 张内联插画） |
| 绘图并发峰值 | 1 | **11**（实测；旧上限下只能是 2） |
| 材料事实 | 四条全对（含 19:00 ≠ 9:00 的数字边界反例） | 三条全保住（10月20日 / 活动中心 / 010-55566666） |
| 质检 | 阻断 0 条 | 阻断 0 条（警告 1 = `wechat-body-20000` 容量风险，见下） |

账本 **166/63 → 182/75**（+16 派发 / +12 绘图：L1 +3/+1、BIG 复跑 +13/+11），未重置、未扩容。

## 四、必须写明的边界（不得外推）

1. **有信息重画的"好处"没有被真机证明。** 这次 BIG 的 11 次 `gen_svg` **全部 attempt=1、全部成功**
   （11 个素材位 s1–s11，0 次质检拒收）——**新代码路径在真实链路里一次都没被触发**。
   真机证明的是**没有回归**；"带提示能少画坏"这一步的证明在**离线注入故障**的那 8 条断言里
   （可证伪：把 hint 去掉，其中 2 条立刻变红）。要拿到真机的收益数据，需要一次**真的出现质检拒收**
   的样本，本轮没有。
2. **两档各只有 1 次样本。** "长短均可"目前是"各通过一次"，不是通过率。`BIG` 历史上字数有波动
   （1313 / 1781 / 1846 / 1643），本轮 1643 在区间内，但**不足以说长文字数稳定达标**。
3. **`wechat-body-20000` 容量警告仍在**（长文成品 1,624,234 > 20,000，按规则限度登记、不阻断）。
   该规则的计算对象与"平台一定会拒绝"都**未在公众号后台验证**；仍需人工核对才能定论。
4. **一次启动级 BLOCKED 已按规程处理**：首次以全新隔离 profile 跑 `BIG` 时，第二实例 90 秒内
   未渲染出 `header.topbar`，判定 `BLOCKED`（**0 次模型派发、0 次绘图**，不产生费用）。
   同一 exe 数分钟前的 `L1` 已通过，故按驱动自身的 `--resume-after-fix` 通路闭合该记录
   （写明理由、**不返还额度、不清零累计**），随后在**同一 root**（profile 已预热）复跑并通过。
   这不是产品缺陷，也不该被读成"产品能跑"——它是一次驱动侧的环境抖动，已如实登记。

## 五、复现命令

```bash
pnpm tauri build --bundles nsis
VERIFY_PLAYWRIGHT="<本机 playwright 模块目录>" node scripts/live-acceptance.mjs L1  --root "%TEMP%\wxmp-r2\l1"
VERIFY_PLAYWRIGHT="<同上>" node scripts/live-acceptance.mjs BIG --root "%TEMP%\wxmp-r2\big1"
node scripts/trace-check.mjs
cd src-tauri && cargo test --lib
```
