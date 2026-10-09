// fixture-repair.mjs —— 用真实失败样例产出「修复副本 + 前后对比 + 请求统计」（修复计划阶段 6 第 6 条）
// 用法：node scripts/fixture-repair.mjs
//
// 输入：scripts/fixtures/2026-09-28-basement/（2026-09-28 用户实际拿到的失败稿 + 当时的四枚库素材 + 当时保存的告警）
// 输出：docs/artifacts/2026-09-28-repair/ 下的
//   · fixed-source.md    —— 修复后的源文（成功素材位已规范化成按 ID 的稳定引用）
//   · fixed-article.html —— 修复后渲染出的 HTML（素材内联为 SVG data URI，可直接用浏览器打开）
//   · repair-report.md   —— 前后对比与请求统计
//
// 边界（计划明确要求）：
//   · **只读**真实作品：不读写 C:/Users/Lenovo/Documents/wechat-mp-workspace 下的任何文件；
//   · **不覆盖原稿**：产物只写在仓库内的 docs/artifacts/ 下；
//   · **不联网、不调模型**：缺少的素材走浏览器演示池（inTauri 为假），只用于展示链路，不冒充真实模型产物。
import { resetStub } from './lib/ls-stub.mjs'
import { failingDoc, failingSource, fixtureAssets, seedFixtureAssets } from './lib/fixtures.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const { composeMarkdown } = await import('../src/lib/compose.ts')
const { emptyMaterializeInfo, materializePlaceholders } = await import('../src/lib/image-agent.ts')
const { createLedger, unfinished } = await import('../src/lib/asset-ledger.ts')
const { splitAssistant } = await import('../src/lib/extract.ts')
const { newRunId, clearTraceBuffer, traceBuffer, summarize, clip } = await import('../src/lib/trace.ts')

const here = dirname(fileURLToPath(import.meta.url))
// 2026-10-09：默认落点收进项目内 `.local/`——以前默认写 `docs/artifacts/2026-09-28-repair/`，
// 而那里是**受版本控制**的冻结样例，于是每跑一次就把两个已提交文件改脏（新运行 ID 流水）。
const outDir = join(here, '..', '.local', 'runs', 'fixture-repair')
mkdirSync(outDir, { recursive: true })

// ---- 修复前（来自当时保存的告警与绑定，不重新解读、不修饰） ----
const before = failingDoc()
const beforeAssetWarnings = before.warnings.filter((w) => w.includes('未定义') || w.includes('未达标'))
const beforeBindings = before.bindings || []
const beforeFailed = beforeBindings.filter((b) => b.source === 'failed')
const beforeSnapshots = Object.keys(before.snapshots || {}).length

// ---- 跑真实解析链路 ----
resetStub()
clearTraceBuffer()
const seeded = seedFixtureAssets()
const src = splitAssistant(failingSource()).v2
const ledger = createLedger(newRunId())
const info = emptyMaterializeInfo()
const matured = await materializePlaceholders(src, '校园', info, { persist: false, ledger, theme: '校园' })
const comp = composeMarkdown(matured, {})

// 把 compose 的 @@ARTn@@ 占位替换成 SVG data URI（无 canvas 环境下的等价呈现；微信发布用 PNG 由导出链路生成）
let html = comp.html
comp.arts.forEach((art, i) => {
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art.svg)
  html = html.split('@@ART' + i + '@@').join(uri)
})

writeFileSync(join(outDir, 'fixed-source.md'), info.normalized || matured, 'utf8')
// compose 产出的是微信用的**片段**；这里加一层 375px 外壳，便于直接用浏览器打开核对观感
writeFileSync(
  join(outDir, 'fixed-article.html'),
  `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>「筑基」稿修复副本（375px 预览）</title>
<style>
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;width:375px;max-width:100%;margin:0 auto;padding:0 0 40px;box-sizing:border-box}
</style>
</head>
<body>
${html}
</body>
</html>`,
  'utf8',
)

// ---- 统计 ----
const sum = summarize(traceBuffer())
const reused = info.bindings.filter((b) => b.source === 'asset' || b.source === 'reuse' || b.source === 'recover')
const created = info.bindings.filter((b) => b.source === 'new')
const draws = traceBuffer().filter((r) => r.kind === 'slot' && r.decision === 'new').length
const svgCount = (matured.match(/<svg\b/g) || []).length
const imgCount = (html.match(/<img\b/g) || []).length
// 成品受众看到的是 **HTML**：那里不该出现未解析的引用，也不该出现"生成失败"这类说明。
// （`::: art` 是解析后的内部编译格式，只应存在于交给 compose 的源文里，不该出现在 HTML 中。）
const leftover = /\[\[asset:|\[\[img:|\[\[deco:|::: ?art|生成失败/.test(html)

const rows = (bindings) =>
  bindings
    .map((b) => `| ${clip(b.slot, 46)} | ${b.id || '（无）'} | ${b.source} | ${clip(b.reason, 60)} |`)
    .join('\n')

// ---------- 验收对照（T2：全部由实测值算出，不再是写死的 [x]） ----------
// 原来这一节 6 行是**字面字符串** `- [x] ...`，与 reused.length / draws / leftover 毫无关系：
// 哪怕解析链路整体回归、一枚素材都没恢复，生成的报告照样打印"全部恢复绑定、0 次绘图"，
// 于是磁盘上留着一份看起来已验收的假证据（比缺测更危险）。
// 现在每一项都由实测变量拼出结论、带上实测数字，未达成即打 [ ] 并计入 unmet/failed。
const unmet = []
const item = (ok, text) => {
  if (!ok) unmet.push(text)
  return `- [${ok ? 'x' : ' '}] ${text}`
}

const fixtureIds = fixtureAssets().map((a) => a.meta.id)
const restoredAll = fixtureIds.length === 4 && fixtureIds.every((id) => reused.some((b) => b.id === id))
const reuseSlots = ledger.order.map((k) => ledger.slots[k]).filter((e) => reused.some((b) => b.slotId === e.slotId))
const reuseAttempts = reuseSlots.reduce((n, e) => n + e.attempts, 0)
const reuseZeroDraw = reuseSlots.length === reused.length && reused.length > 0 && reuseAttempts === 0
const protoInHtml = /\[\[asset:/.test(html)
const protoClean = info.residual === 0 && !protoInHtml
// 角饰位（含旧纯文字块）只允许"按库恢复或报错"，不允许重画
const isDecoSlot = (s) => /角饰|deco/i.test(String(s || ''))
const decoDrawn = created.filter((b) => isDecoSlot(b.slot)).length
const decoFailed = info.bindings.filter((b) => b.source === 'failed' && isDecoSlot(b.slot)).length
const noDecoRedraw = decoDrawn === 0
const bindingSlotIds = info.bindings.filter((b) => !!b.slotId).length
const finishByBinding = unfinished(ledger).length === 0 && info.bindings.length > 0 && bindingSlotIds === info.bindings.length

const report = `# 「筑基」稿修复副本与前后对比

由 \`node scripts/fixture-repair.mjs\` 生成。输入是 2026-09-28 真实失败稿与当时库素材的**只读副本**
（\`scripts/fixtures/2026-09-28-basement/\`），输出只写在仓库内，**没有读写真实作品目录，也没有联网或调用模型**。

> 真实模型下的产物仍需另跑（见下"未做"）。本页展示的是**解析链路**的修复结果：
> 已有素材能不能被用上、协议会不会残留、失败会不会被当成正文。

## 修复前（来自当时保存的 \`meta.json\`）

| 检查项 | 实际结果 |
| --- | --- |
| 最终 HTML 里的 \`<img>\` / \`<svg>\` | **0 / 0** |
| 素材绑定 | ${beforeBindings.length} 条，其中 \`source=failed\` **${beforeFailed.length}** 条 |
| 库素材固化快照 | ${beforeSnapshots} 条（空） |
| 保存的告警 | ${before.warnings.length} 条，其中素材相关 **${beforeAssetWarnings.length}** 条 |

当时的素材相关告警：

${beforeAssetWarnings.map((w) => `- ${w}`).join('\n')}

## 修复后（同一条输入，走当前解析链路）

| 检查项 | 实际结果 |
| --- | --- |
| 素材位总数 | ${ledger.order.length} |
| 已有库素材被用上 | **${reused.length}** 处（复用 / 恢复，**0 次绘图**） |
| 因缺料新绘制 | ${created.length} 处 |
| 仍未完成 | **${unfinished(ledger).length}** 处 |
| 成品里的 \`<svg>\` / \`<img>\` | ${svgCount} / ${imgCount} |
| 成品残留素材协议或"生成失败"字样 | ${leftover ? '**有**（不应出现）' : '无'} |
| 解析产生的告警 | ${comp.warnings.length} 条 |

### 已有素材的绑定

| 素材位 | 绑定素材 ID | 来源 | 原因 |
| --- | --- | --- | --- |
${rows(reused)}

### 新绘制的素材位

${created.length ? `| 素材位 | 绑定素材 ID | 来源 | 原因 |\n| --- | --- | --- | --- |\n${rows(created)}` : '（无）'}

> 上表"新绘制"一列的素材 ID 为空是**离线运行的正常表现**：本脚本不写素材库（\`persist: false\`），
> 因此新画的素材没有库 ID。桌面端跑真实链路时这些位置会入库并拿到 ID，绑定表里也会带上。

## 请求统计（本次离线链路）

| 指标 | 值 |
| --- | --- |
| 追踪记录条数 | ${sum.total} |
| 素材位决策计数 | ${Object.entries(sum.decisions).map(([k, v]) => `${k}=${v}`).join('，') || '（无）'} |
| 实际绘图次数 | **${draws}**（四枚已有素材贡献 0 次） |
| 出现过的素材位 id | ${sum.slots.join('，')} |
| 失败分类计数 | ${Object.entries(sum.failures).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join('，') || '（无失败）'} |
| 缺少耗时的请求记录 | ${sum.missingMs}（缺失记为未知，不编造） |
| 样例素材注入数 | ${seeded} |

四个素材位的绘图尝试次数（0 = 没有重新画）：

${ledger.order
  .map((k) => ledger.slots[k])
  .filter((e) => reused.some((b) => b.slotId === e.slotId))
  .map((e) => `- \`${e.slotId}\`：绘图尝试 **${e.attempts}** 次｜${clip(e.desc, 30)}｜绑定 ${e.assetId}`)
  .join('\n')}

## 与计划的验收对照

> 本节的每一项都由本次运行的实测值算出（括号内即实测数字），未达成会打 \`[ ]\` 并让脚本以非 0 退出。

${item(restoredAll, `四枚已有素材全部恢复绑定（实测 ${reused.length}/${fixtureIds.length} 枚命中库 ID：${fixtureIds.filter((id) => reused.some((b) => b.id === id)).length}；书桌插画按中文分类引用解析，三枚角饰按旧文字块恢复）`)}
${item(reuseZeroDraw, `这四枚复用位产生 **0 次绘图调用**（实测复用位 ${reuseSlots.length} 个、绘图尝试合计 ${reuseAttempts} 次；缺料另画 ${created.length} 处）`)}
${item(protoClean, `中文分类引用不再泄漏进成品（实测未解析引用 ${info.residual} 处；HTML 残留 \`[[asset:\` ${protoInHtml ? '有' : '无'}）`)}
${item(noDecoRedraw, `角饰位只按库恢复、绝不重画（实测新绘制里的角饰位 ${decoDrawn} 处；恢复不了记 failed 报错 ${decoFailed} 处）`)}
${item(!leftover, `成品不残留素材协议，也不把"生成失败"写成正文段落（实测 ${leftover ? '**有残留**' : '无残留'}）`)}
${item(finishByBinding, `完成状态按绑定与实渲染判定（实测未完成 ${unfinished(ledger).length} 处；${bindingSlotIds}/${info.bindings.length} 条绑定带 slotId——未完成项可逐项重试）`)}

## 未做（需要授权，且不属于本脚本）

- **真实模型三小样**：①有库复用 ②仅缺一张新图 ③已有稿只改正文。需要付费调用授权；
  本脚本用浏览器演示池代替绘图，只能验证链路与协议，**不能**作为真实模型产物证据。
- 微信端实际观感（角饰 60px 在真机上的效果）需人工看图，见 \`scripts/raster-check.mjs\` 的实测表。
`

writeFileSync(join(outDir, 'repair-report.md'), report, 'utf8')

console.log(`已写出 ${outDir}`)
console.log(`  已有素材复用/恢复：${reused.length} 处，绘图 ${draws} 次，未完成 ${unfinished(ledger).length} 处`)
console.log(`  所有绑定：${info.bindings.map((b) => `${b.source}${b.id ? ':' + b.id.slice(-6) : ''}`).join(' ')}`)
if (leftover) {
  console.log('  警告：成品仍残留素材协议文本')
  process.exitCode = 1
}
// T2：验收对照未达成时必须以非 0 退出，并与报告里的 [ ] 保持一致（不能只写进报告就算数）
if (unmet.length) {
  console.log(`  验收对照未达成 ${unmet.length} 项：`)
  for (const t of unmet) console.log(`    - ${t}`)
  process.exitCode = 1
}
console.log(unmet.length === 0 && !leftover ? '  FIXTURE-REPAIR OK' : '  FIXTURE-REPAIR FAILED')