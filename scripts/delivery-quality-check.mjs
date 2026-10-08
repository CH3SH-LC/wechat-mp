// delivery-quality-check.mjs —— 统一质量结果与交付门禁断言（质量恢复计划 §4 / §10 验收场景）
// 用法：node scripts/delivery-quality-check.mjs
//
// 断言必须**可证伪**：每条都对应一个"故意改坏实现就会变红"的结论。
// 因此这里不写恒真断言，也不把结论硬编码——所有期望值都由 fixture 事实推出（图片数、行号、片段文本）。
//
// 覆盖 §10 表里的六条：①只有 checkHtml 失败也进门禁；②有 6 张图仍有泄漏也阻断；
// ③必需素材被拒收 → 阻断且能定位 slotId；④短篇/推荐性组件不阻断；⑤正文完整性给出具体丢失片段；
// ⑥照片位待补不阻断但被明示。
//
// 另覆盖指南 §4.5 验收表里前面未覆盖的四条：
//   ⑦两轮修复逐步丢事实（基准必须冻结在首个候选，不能跟着 prevCand 走）；
//   ⑧末轮"原问题减少但新增事实阻断"（阻断条数下降不足以放行）；
//   ⑨单项素材重试时正文比较仍生效（只换素材=过，顺手改事实=拦）；
//   ⑩ issuesFromBody 严重度 ↔ gate.bodyIntegrityOk ↔ verdict.ok 在所有上述用例里同源一致。

import {
  CAPACITY_RULES,
  ISSUE_CODES,
  bodyIntegrity,
  bodyText,
  collectDeliveryIssues,
  countBySeverity,
  dedupeIssues,
  deliveryVerdict,
  extractFacts,
  htmlIssues,
  issueFingerprint,
  issuesFromBody,
  issuesFromMaterial,
  issuesFromRaster,
  issuesFromRejected,
  issuesFromVersion,
  leakIssues,
  repairKindFor,
  requiredSlotsFromEntries,
  slotIndexFromLedger,
  softFacts,
  stageOfCode,
} from '../src/lib/delivery-quality.ts'

// 对抗式审计（2026-09-29）发现的两条**假通过/真截断**，断言直接打在生产函数上。
import { splitAssistant } from '../src/lib/extract.ts'
import { composeMarkdown } from '../src/lib/compose.ts'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'

// 统一判定器（指南 §3.1 / §0.2）：本脚本原先自己维护 `failed` 计数、**不产出 run-result.json**——
// 于是"零条断言被执行"与"全部通过"在归档里完全一样（把断言全删掉也照样打印 DELIVERY-QUALITY OK、
// exit 0）。改为走共享模块：计划场景齐全（①…⑫）+ 异常/零检查都落成 ERROR 且退出非 0。
// `MIN_CHECKS` 取 2026-10-01 实测条数：静默删掉一条断言会立刻变红，这是**故意**的。
const MIN_CHECKS = 123
const judge = createJudge({
  script: 'delivery-quality-check',
  outDir: resolveOutDir('delivery-quality-check'),
  plannedCases: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'],
  minChecks: MIN_CHECKS,
})
guardCrashes(judge)
let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}
const codes = (list) => list.map((i) => i.code)
const has = (list, code) => list.some((i) => i.code === code)
const blockingCodes = (v) => codes(v.blockers)
const infoCodes = (v) => codes(v.infos)

/**
 * 走**唯一判定路径**做一次交付判定：只喂 `issuesFromBody` 的产物 + 适用性。
 * 这是"严重度 / gate.bodyIntegrityOk / verdict.ok 同源"三件事的最小可证伪载体——
 * 任何一条被改单边（给事实缺失降级、把片段丢失算进 body.ok…）都会在这个组合上露出来。
 */
const gateOf = (body, applicability) => {
  const issues = issuesFromBody(body)
  const ctx = { htmlOk: true, bodyApplicability: applicability }
  if (body) ctx.body = body
  return { body, issues, verdict: deliveryVerdict(issues, ctx) }
}

// ---------- 公共 fixture ----------

// 干净成品：无 emoji / 无渐变 / 无阴影 / 无 <style> / 无外链图 / 无 ≥100px 固定宽度
const CLEAN_HTML =
  '<section style="background:#ffffff;padding:4px 16px;box-sizing:border-box;font-size:16px;line-height:1.75;color:#3f3f3f">' +
  '<p style="margin:0 0 16px">九月第一天，开学典礼如约而至。</p>' +
  '<p style="margin:0 0 16px">请同学们按时到场。</p></section>'

const IMG_TAG =
  '<img src="data:image/svg+xml;base64,AAA" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />'

// 真实故障形态：有 6 张图，但可见文本里同时残留内部协议与转义 SVG 源码
const LEAKY_HTML =
  '<section style="background:#ffffff;padding:4px 16px">' +
  IMG_TAG.repeat(6) +
  '<p style="margin:0 0 16px">::: art wide 晨光里的旗帜</p>' +
  '<p style="margin:0 0 16px">&lt;svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210"&gt;' +
  '&lt;rect x="60" y="140" width="5" height="62"/&gt;&lt;/svg&gt;</p></section>'

const LEAKY_SOURCE = [
  '# 开学',
  '',
  '::: art wide 晨光里的旗帜',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>',
  ':::',
  '',
  '正文。',
].join('\n')

const GRADIENT_HTML =
  '<section style="background:linear-gradient(90deg,#fff,#eee);padding:4px 16px">' +
  '<p style="margin:0 0 16px">正文。</p></section>'

// 台账（形状与 asset-ledger.LedgerEntry 一致；不 import 台账实现，避免把编排逻辑带进质量判定）
const LEDGER = {
  runId: 'r1',
  order: ['r1-s1', 'r1-s2'],
  slots: {
    'r1-s1': {
      slotId: 'r1-s1',
      slot: '[[asset:bubble|as-1a2b|气泡角落装饰]]',
      kind: 'asset',
      status: 'ok',
      assetId: 'as-1a2b',
      block: '::: art deco Flower as-1a2b\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><circle cx="150" cy="100" r="40"/></svg>\n:::',
      ref: '[[asset:bubble|as-1a2b|气泡角落装饰]]',
    },
    'r1-s2': {
      slotId: 'r1-s2',
      slot: '[[asset:banner|as-9z8y|横幅主图]]',
      kind: 'asset',
      status: 'failed',
      assetId: '',
      reason: '素材含 <text> 被拒收',
    },
  },
}
const SLOTS = slotIndexFromLedger(LEDGER)

// ---------- ① 只有 checkHtml 失败，也必须进统一门禁（不走旁路） ----------

const vHtml = deliveryVerdict(collectDeliveryIssues({ html: GRADIENT_HTML, plainText: '正文。' }))
check('① checkHtml 失败被并入统一清单', has(vHtml.blockers, 'html.gradient'), codes(vHtml.blockers).join(','))
check('① 仅 checkHtml 失败时整稿不通过', vHtml.ok === false && vHtml.reason === 'blocked')
check(
  '① 调用方漏传 html.* 问题，只给 htmlOk=false 也阻断',
  deliveryVerdict([], { htmlOk: false }).ok === false &&
    has(deliveryVerdict([], { htmlOk: false }).blockers, ISSUE_CODES.htmlCheckFailed),
)
check(
  '① 纯 checkHtml.ok=true 不构成通过（缺必需素材仍阻断）',
  deliveryVerdict(collectDeliveryIssues({ html: CLEAN_HTML, plainText: '正文。' }), {
    requiredSlots: [{ slotId: 'r1-s2', slot: '[[asset:banner|as-9z8y|横幅主图]]', done: false }],
  }).ok === false,
)

// ---------- ② 有 6 张图 + 源码泄漏 → 阻断（不依赖零图条件） ----------

const imgCount = (LEAKY_HTML.match(/<img\b/g) || []).length
const leaks = leakIssues(LEAKY_HTML, LEAKY_SOURCE)
const vLeaky = deliveryVerdict(collectDeliveryIssues({ html: LEAKY_HTML, source: LEAKY_SOURCE, plainText: '正文。' }))
check('② fixture 前提：确实有 6 张图', imgCount === 6, `img=${imgCount}`)
check('② 有图也检出源码泄漏', has(leaks, ISSUE_CODES.parseLeak), codes(leaks).join(','))
check('② 泄漏项为阻断且要求重新渲染', leaks.length > 0 && leaks.every((i) => i.severity === 'blocking' && i.repairKind === 'reparse'))
check('② 有图 + 泄漏 → 整稿阻断', vLeaky.ok === false && has(vLeaky.blockers, ISSUE_CODES.parseLeak))
check('② 泄漏能定位回源文行（::: art 在第 3 行、SVG 在第 4 行）', leaks.some((i) => i.sourceRange.line === 3) && leaks.some((i) => i.sourceRange.line === 4))

// ---------- ③ 必需素材被拒收 → 阻断且能定位 slotId ----------

const byId = issuesFromRejected([{ refs: ['as-1a2b'], line: 12, reason: '素材含 <text>', deco: true }], SLOTS)
check('③ 按 assetId 命中素材位 slotId', byId.length === 1 && byId[0].slotId === 'r1-s1' && byId[0].assetId === 'as-1a2b')
const byAlias = issuesFromRejected([{ refs: ['Flower'], line: 12, reason: '角饰铺满画布', deco: true }], SLOTS)
check('③ 按块头别名也能命中素材位', byAlias[0].slotId === 'r1-s1', JSON.stringify(byAlias[0].slotId))
const bySlotText = issuesFromRejected([{ refs: ['as-9z8y'], line: 30, reason: '无法读取', deco: false }], SLOTS)
check('③ 被拒收素材一律阻断', byId[0].severity === 'blocking' && bySlotText[0].severity === 'blocking')
const unlocated = issuesFromRejected([{ refs: ['未知别名-xyz'], line: 40, reason: '含 <text>', deco: false }], SLOTS)
check(
  '③ 定位不到不静默丢弃，如实记为无法定位',
  unlocated.length === 1 &&
    unlocated[0].code === ISSUE_CODES.assetSlotUnlocated &&
    unlocated[0].severity === 'blocking' &&
    String(unlocated[0].evidence).includes('未知别名-xyz'),
  unlocated[0] && unlocated[0].code,
)
check('③ 空台账不崩且不假装匹配', slotIndexFromLedger(null).length === 0 && issuesFromRejected([{ refs: ['x'], line: 1, reason: 'r', deco: false }], []).length === 1)

const requiredSlots = requiredSlotsFromEntries([
  { slotId: 'r1-s1', slot: '[[asset:bubble|as-1a2b|气泡角落装饰]]', status: 'ok', assetId: 'as-1a2b' },
  { slotId: 'r1-s2', slot: '[[asset:banner|as-9z8y|横幅主图]]', status: 'failed', reason: '素材含 <text>' },
])
const matIssues = issuesFromMaterial({ requiredSlots })
const vMat = deliveryVerdict(
  collectDeliveryIssues({ html: CLEAN_HTML, plainText: '正文。', rejectedArts: [{ refs: ['as-9z8y'], line: 30, reason: '素材含 <text>', deco: false }], slots: SLOTS, material: { requiredSlots } }),
  { requiredSlots },
)
check('③ 台账未完成项 → 阻断且带 slotId', has(matIssues, ISSUE_CODES.assetRequiredIncomplete) && matIssues[0].slotId === 'r1-s2')
check('③ 只有部分素材完成 → 整稿不通过', vMat.ok === false && vMat.gate.requiredSlotsDone === false && vMat.reason === 'blocked')
check('③ 拒收经 collect 汇总后仍能定位 slotId', vMat.blockers.some((i) => i.code === ISSUE_CODES.assetRejected && i.slotId === 'r1-s2'))

// 库读取成功 ≠ 验收完成：读取失败的引用进 residual/residue/errors 时同样阻断，分类不符只提示
const vResidue = deliveryVerdict(
  collectDeliveryIssues({ html: CLEAN_HTML, plainText: '正文。', material: { residual: 1, residue: 2, mismatched: 1, errors: ['素材 as-9z8y 读取失败：文件缺失'] } }),
)
check(
  '③ 引用不匹配/协议残留/读取错误 → 阻断',
  has(vResidue.blockers, ISSUE_CODES.assetUnresolved) &&
    has(vResidue.blockers, ISSUE_CODES.assetProtocolResidue) &&
    has(vResidue.blockers, ISSUE_CODES.assetError),
  blockingCodes(vResidue).join(','),
)
check('③ 分类不符只是警告（不阻断、不触发整篇重写）', has(vResidue.warnings, ISSUE_CODES.assetCategoryMismatch) && vResidue.warnings.find((i) => i.code === ISSUE_CODES.assetCategoryMismatch).repairKind === 'none')

// 栅格：实际显示尺寸下不达标 → 阻断，并可按 refs 还原 slotId
const rast = issuesFromRaster([{ kind: 'deco', refs: ['as-1a2b'], targetWidth: 60, failures: ['角饰在 60px 显示尺寸下几乎看不见：对比度仅 8'], metrics: 'background=#ffffff' }], SLOTS)
const vRast = deliveryVerdict(collectDeliveryIssues({ html: CLEAN_HTML, plainText: '正文。', raster: [{ kind: 'deco', refs: ['as-1a2b'], targetWidth: 60, failures: ['角饰在 60px 显示尺寸下几乎看不见'] }], slots: SLOTS }))
check('③ 栅格不达标 → 阻断且 slotId 可还原', rast[0].severity === 'blocking' && rast[0].slotId === 'r1-s1' && rast[0].stage === 'raster')
check('③ 栅格问题经 collect 后仍在阻断清单', has(vRast.blockers, ISSUE_CODES.rasterNotPassed) && vRast.ok === false)

// ---------- ④ 短篇提示 / 推荐性组件不阻断 ----------

const SHORT_SOURCE = '# 通知\n\n今天下午三点开会，请准时参加。\n'
const shortFacts = softFacts({ source: SHORT_SOURCE, plainText: '今天下午三点开会，请准时参加。', html: CLEAN_HTML })
const vShort = deliveryVerdict(collectDeliveryIssues({ source: SHORT_SOURCE, html: CLEAN_HTML, plainText: '今天下午三点开会，请准时参加。' }))
check('④ 短篇被识别为短篇档', shortFacts.scale === 'short' && shortFacts.plainTextLength < 350, `scale=${shortFacts.scale}`)
check('④ 短篇提示是 info 且不阻断', has(vShort.infos, ISSUE_CODES.bodyIntentionalShort) && vShort.ok === true, blockingCodes(vShort).join(',') || '无阻断')
check('④ 推荐性组件数量提示是 info 且不阻断', has(vShort.infos, ISSUE_CODES.componentsTip) && vShort.ok === true)
check('④ 推荐项 repairKind 为 none（不强迫改稿）', vShort.infos.every((i) => i.repairKind === 'none'), vShort.infos.map((i) => i.code + ':' + i.repairKind).join(','))

// ---------- ⑤ 正文完整性：给出具体丢失/改动片段（可证伪） ----------

const BEFORE = '九月第一天，开学典礼在东区操场举行。\n负责接待的是张老师。\n集合时间是 8 点 30 分。\n'
const AFTER = '九月第一天，开学典礼在东区操场举行。\n集合时间是 8 点 30 分。\n'
const b1 = bodyIntegrity(BEFORE, AFTER)
const b1Issues = issuesFromBody(b1)
check('⑤ 检出被删掉的具体片段', b1.lost.length === 1 && b1.lost[0].text.includes('张老师'), b1.lost.map((f) => f.text).join(' | '))
check('⑤ 片段带旧稿行号（可核对）', b1.lost[0].beforeLine === 2, String(b1.lost[0].beforeLine))
check('⑤ 完整性判定为未通过', b1.ok === false && has(b1Issues, ISSUE_CODES.bodyTextLost) && has(b1Issues, ISSUE_CODES.bodyFactLost))
check('⑤ 丢失项经门禁后阻断成品', deliveryVerdict(collectDeliveryIssues({ html: CLEAN_HTML, plainText: '正文。', body: b1 })).ok === false)

// 事实保护：数字/日期被抽掉，即便句子还在改写里也要报出来
const b2 = bodyIntegrity('活动在 9 月 1 日上午 8 点 30 分开始。\n', '活动在开学日早上开始。\n')
check('⑤ 抽取出被保护的事实（日期/时间）', extractFacts('活动在 9 月 1 日上午 8 点 30 分开始。').length >= 2, JSON.stringify(extractFacts('活动在 9 月 1 日上午 8 点 30 分开始。')))
check('⑤ 事实丢失被逐项列出', b2.factsMissing.length >= 2 && b2.factsMissing.some((f) => f.text.includes('9 月 1 日')), JSON.stringify(b2.factsMissing))
check('⑤ 事实丢失 → 阻断', b2.ok === false && has(issuesFromBody(b2), ISSUE_CODES.bodyFactLost))

// 反向：改写了但事实都在 → 不算退化（不能把"与旧稿不同"一律当退化）
const b3 = bodyIntegrity('本次活动由学生会组织，面向全体新生。\n', '本次活动面向全体新生，由学生会组织安排。\n')
check('⑤ 改写不算丢失（片段仍在）', b3.lost.length === 0 && b3.changed.length === 1, `lost=${b3.lost.length} changed=${b3.changed.length}`)
check('⑤ 改写不判失败、只给警告', b3.ok === true && has(issuesFromBody(b3), ISSUE_CODES.bodyTextChanged) && !has(issuesFromBody(b3), ISSUE_CODES.bodyTextLost))
check('⑤ 改写片段可证伪（给出前后文）', Boolean(b3.changed[0].after && b3.changed[0].similarity >= 0.6), JSON.stringify({ sim: b3.changed[0].similarity, after: b3.changed[0].after }))

// 顺序变化：报告具体片段，但不判失败
const b4 = bodyIntegrity('第一段讲场地。\n第二段讲时间。\n第三段讲报名。\n', '第三段讲报名。\n第二段讲时间。\n第一段讲场地。\n')
check('⑤ 顺序变化被报告为具体片段', b4.reordered.length === 1 && b4.lost.length === 0, JSON.stringify(b4.reordered.map((f) => f.text)))
check('⑤ 顺序变化不判失败（只警告）', b4.ok === true && has(issuesFromBody(b4), ISSUE_CODES.bodyOrderChanged))

// ignore：用户明确要求改的目标行不参与退化判定
const b5 = bodyIntegrity(BEFORE, '九月第一天，开学典礼在东区操场举行。\n集合时间是 8 点 30 分。\n', { ignore: [{ line: 2, endLine: 2 }] })
check('⑤ 目标行内的改动不判退化', b5.ok === true && b5.lost.length === 0 && b5.stats.beforeUnits === 2, JSON.stringify(b5.stats))

// ---------- ⑥ 照片位待补：不阻断但被明示 ----------

const PHOTO_SOURCE = '::: photo 活动现场照片\n\n正文第一段。\n'
const photoIssues = collectDeliveryIssues({ source: PHOTO_SOURCE, html: CLEAN_HTML, plainText: '正文第一段。' })
const vPhoto = deliveryVerdict(photoIssues)
check('⑥ 照片位被明示（info、待补、不伪造）', photoIssues.some((i) => i.code === ISSUE_CODES.photoPending && i.severity === 'info' && i.repairKind === 'await-photo'))
check('⑥ 照片位行号正确（第 1 行）', photoIssues.find((i) => i.code === ISSUE_CODES.photoPending).sourceRange.line === 1)
check('⑥ 照片位不阻断成品', vPhoto.ok === true && vPhoto.gate.blockers === 0, blockingCodes(vPhoto).join(','))
check('⑥ 但发布就绪另判（publishReady=false，reason=draft-only）', vPhoto.publishReady === false && vPhoto.reason === 'draft-only' && vPhoto.pendingPhotos.length === 1)

// ---------- ⑦ 两轮修复逐步丢事实：基准必须冻结在首个候选（§4.5 "两轮修复逐步丢事实"） ----------
//
// 场景 A→B→C：B 丢掉一半事实（电话、地点），C 再把剩下的一半（日期、时间、姓名、人数）丢光。
// 红/绿分界：基准跟着"上一轮候选"走时，C 相对 B 的那份缺失清单里**没有**电话与地点——
// 于是模型只要把 C 里剩下的补回来，这一链就会放行一份丢了两项原始事实的稿子。
// 本节用 A 基准 / B 基准两组对照直接把这个差异算出来，证明断言不是空的。

const FACTS_A = '活动于10月10日上午9点开始，地点在东区操场，电话 010-55556666，联系人张老师，预计100名新生参加。'
const FACTS_B = '活动于10月10日上午9点开始，联系人张老师，预计100名新生参加。' // 第 1 轮修复：丢掉电话与地点
const FACTS_C = '活动即将开始，请大家留意后续通知。' // 第 2 轮修复：再丢掉日期/时间/姓名/人数
const FACTS_D = '本次活动于10月10日上午9点开始，联系人张老师，预计100名新生参加。' // 第 3 轮：补回第 2 轮丢的，但第 1 轮丢的仍未回来

const factKey = (f) => f.kind + '|' + f.canon
const missingKeys = (r) => r.factsMissing.map(factKey)
const factsInA = new Set(extractFacts(FACTS_A).map(factKey))
const frozenVC = bodyIntegrity(FACTS_A, FACTS_C) // 正确做法：基准冻结在首个候选
const followVC = bodyIntegrity(FACTS_B, FACTS_C) // 错误做法：基准跟着上一轮候选
const frozenVD = bodyIntegrity(FACTS_A, FACTS_D)
const followVD = bodyIntegrity(FACTS_B, FACTS_D)

check(
  '⑦ 基准冻结时，第 2 轮候选的缺失事实被逐项报全',
  frozenVC.factsMissing.length === factsInA.size && frozenVC.ok === false,
  `缺失 ${frozenVC.factsMissing.length}/${factsInA.size}：${missingKeys(frozenVC).join(', ')}`,
)
check(
  '⑦ 基准跟着上一轮候选会漏掉第 1 轮丢的那批（对照差异非空）',
  missingKeys(followVC).length < missingKeys(frozenVC).length,
  `冻结基准 ${missingKeys(frozenVC).length} 项 / 跟随基准 ${missingKeys(followVC).length} 项`,
)
const lostOnlyWhenFollowing = missingKeys(frozenVC).filter((k) => !missingKeys(followVC).includes(k))
check(
  '⑦ 漏掉的正是电话与地点（可逐项核对，非空差异）',
  lostOnlyWhenFollowing.includes('phone|01055556666') && lostOnlyWhenFollowing.some((k) => k.startsWith('place|')),
  lostOnlyWhenFollowing.join(', ') || '（无差异——该断言已被架空）',
)
check(
  '⑦ 两个基准给出相反结论：冻结基准否决、跟随基准放行',
  frozenVD.ok === false && followVD.ok === true,
  `A 基准 ok=${frozenVD.ok}（缺 ${missingKeys(frozenVD).join(',')}）；B 基准 ok=${followVD.ok}`,
)
check(
  '⑦ 否决理由落到具体事实缺失（blocking 且可核对 kind）',
  has(issuesFromBody(frozenVD), ISSUE_CODES.bodyFactLost) && frozenVD.factsMissing.some((f) => f.kind === 'phone'),
  JSON.stringify(missingKeys(frozenVD)),
)

// ---------- ⑧ 末轮：原问题减少但新增事实阻断（§4.5 "原问题减少但新增事实阻断，发生在最后一轮"） ----------
//
// 第 1 轮候选：正文事实完好，阻断都在 HTML 规范上（零渐变/零阴影），共 2 条。
// 第 2 轮候选：HTML 修好了（阻断降到 1 条），却顺手丢了日期。
// 红/绿分界：若调用方用"阻断条数下降"当进展（或把退化比较放在 best 更新之后），
// 第 2 轮就会被选中并提交——本节断言它必须被"新增阻断代码 + 事实缺失"否掉。

const HTML_TWO_BLOCKERS =
  '<section style="background:linear-gradient(90deg,#fff,#eee);box-shadow:0 2px 4px #ccc;padding:4px 16px">' +
  '<p style="margin:0 0 16px">正文。</p></section>'
const round1Body = bodyIntegrity(FACTS_A, FACTS_A)
const round2Body = bodyIntegrity(FACTS_A, '活动于上午9点开始，地点在东区操场，电话 010-55556666，联系人张老师，预计100名新生参加。')
const round1 = deliveryVerdict(
  collectDeliveryIssues({ source: FACTS_A, html: HTML_TWO_BLOCKERS, plainText: FACTS_A, body: round1Body }),
  { htmlOk: false, body: round1Body, bodyApplicability: 'applied' },
)
const round2 = deliveryVerdict(
  collectDeliveryIssues({ source: FACTS_A, html: CLEAN_HTML, plainText: FACTS_A, body: round2Body }),
  { htmlOk: true, body: round2Body, bodyApplicability: 'applied' },
)
const round1Codes = codes(round1.blockers)
const newRound2Codes = codes(round2.blockers).filter((c) => !round1Codes.includes(c))
const round2FactLost = has(round2.blockers, ISSUE_CODES.bodyFactLost)

check(
  '⑧ 前提：第 2 轮阻断条数确实比第 1 轮少（否则这个反例是空的）',
  round2.blockers.length < round1.blockers.length,
  `第 1 轮 ${round1.blockers.length} 条 [${round1Codes.join(',')}] / 第 2 轮 ${round2.blockers.length} 条 [${codes(round2.blockers).join(',')}]`,
)
check('⑧ 前提：第 1 轮本身也未通过（两轮都在同一条修复链上）', round1.ok === false, `ok=${round1.ok}`)
check(
  '⑧ 第 2 轮新增了第 1 轮没有的阻断代码，且正是事实缺失',
  newRound2Codes.includes(ISSUE_CODES.bodyFactLost) && round2FactLost,
  `新增 ${newRound2Codes.join(',') || '无'}；含 fact-lost=${round2FactLost}`,
)
check(
  '⑧ 条数下降不足以放行：门禁仍判不通过',
  round2.ok === false && round2.gate.blockers === round2.blockers.length,
  `ok=${round2.ok} gate.blockers=${round2.gate.blockers}`,
)
check(
  '⑧ 只按条数挑选会挑中第 2 轮（故 best 更新必须晚于退化比较）',
  round2.blockers.length < round1.blockers.length && round2.ok === false,
  `条数 ${round1.blockers.length} → ${round2.blockers.length}，但 ok 仍为 ${round2.ok}`,
)

// ---------- ⑨ 单项素材重试：正文比较仍然生效（§4.5 "单项素材重试"的纯函数口径） ----------
//
// App 侧的真实接线（重试不重置素材预算、不动正文身份）由 `scripts/repair-flow-check.mjs` 另验；
// 这里钉的是纯函数口径：只换素材（正文投影逐字一致）必须判过，顺手改掉日期必须报 body.fact-lost。
// 红/绿分界：若正文比较被"这次只动素材"的旁路跳过，或事实比较只在首轮生效，本节就会变红。

const RETRY_TEXT = '集合时间为 9 月 1 日上午 8 点 30 分，电话 010-55556666。'
// SVG 里放一段**可见文字**（真实形态：素材曾被拒收就是因为含 <text>）：投影剔除整段 SVG 时必须连它一起剔除，
// 否则"只换素材"的重试会因素材内部文字不同而被当成正文变化。
const retryBefore = bodyText(`<p>${RETRY_TEXT}</p><svg viewBox="0 0 750 220"><text x="10" y="20">现场插画</text></svg>`)
const retryAfter = bodyText(`<p>${RETRY_TEXT}</p><svg viewBox="0 0 750 260"><text x="10" y="20">重绘后的现场插画</text></svg>`)
const retrySame = bodyIntegrity(retryBefore, retryAfter)
const retrySteady = gateOf(retrySame, 'applied')

check('⑨ 前提：只换素材时正文投影逐字一致（SVG 不进投影）', retryBefore === retryAfter, retryBefore)
check(
  '⑨ 只换素材的重试：完整性通过、无缺失事实、无片段丢失',
  retrySame.ok === true && retrySame.factsMissing.length === 0 && retrySame.lost.length === 0,
  `ok=${retrySame.ok} 缺失=${retrySame.factsMissing.length} 丢失=${retrySame.lost.length}`,
)
check(
  '⑨ 适用性=applied 时该重试是可通过的成品（不是"没比"也不是"不适用"）',
  retrySteady.verdict.ok === true &&
    retrySteady.verdict.gate.bodyIntegrityOk === true &&
    retrySteady.verdict.gate.bodyApplicability === 'applied',
  `ok=${retrySteady.verdict.ok} gate=${retrySteady.verdict.gate.bodyIntegrityOk} 适用性=${retrySteady.verdict.gate.bodyApplicability}`,
)

const retryDrifted = bodyIntegrity(RETRY_TEXT, '集合时间为 9 月 2 日上午 8 点 30 分，电话 010-55556666。')
const retryDriftedGate = gateOf(retryDrifted, 'applied')
check(
  '⑨ 重试顺手改掉日期 → 报出具体缺失的日期事实',
  retryDrifted.ok === false &&
    retryDrifted.factsMissing.some((f) => f.kind === 'date' && f.canon === '09-01') &&
    has(issuesFromBody(retryDrifted), ISSUE_CODES.bodyFactLost),
  missingKeys(retryDrifted).join(', ') || '（未报出任何缺失）',
)
check(
  '⑨ "这次只动素材"不豁免正文事实：该重试被门禁否决',
  retryDriftedGate.verdict.ok === false && retryDriftedGate.verdict.gate.bodyIntegrityOk === false,
  `ok=${retryDriftedGate.verdict.ok} 阻断=${blockingCodes(retryDriftedGate.verdict).join(',')}`,
)

// 同一次重试里把 9:00 改成 19:00：新值**包含**旧值的原文，靠裸字符串包含判断会漏检（F6 原缺陷）
const retrySubstring = bodyIntegrity('集合时间为9:00开始。', '集合时间为19:00开始。')
const retrySubstringGate = gateOf(retrySubstring, 'applied')
check(
  '⑨ 重试改动后的时间包含旧值原文，仍必须报事实缺失（不靠字符串包含判断）',
  retrySubstring.ok === false &&
    // canon 现为「时段|hh:mm」：无时段限定词的 9:00 记作 any|09:00，
    // 19:00 是 24 小时制下午 → pm|19:00，两者不同（DS 修复指南 §4.1 第 2 条）
    retrySubstring.factsMissing.some((f) => f.kind === 'time' && f.canon === 'any|09:00') &&
    retrySubstringGate.verdict.ok === false,
  `ok=${retrySubstring.ok} 阻断=${blockingCodes(retrySubstringGate.verdict).join(',') || '无'}`,
)

// ---------- ⑩ 严重度 / gate.bodyIntegrityOk / verdict.ok 三者同源（覆盖多条路径，不只测一条） ----------
//
// 红/绿分界：任一处被改单边都会变红——
//   · 给 body.fact-lost 降级成 warning → "blocking 且进阻断清单"那条失败；
//   · 让 body.ok 重新把"片段丢失"算进去 → "只有片段丢失"用例的 ok/gate 两条失败（这就是 F1 的隐藏 false）；
//   · 让"比不了"退化成"不适用" → failed 用例的适用性/ok 两条失败。

// 片段丢失但仍然带着一个必须保留的事实（8 点 30 分）：这样"本例无事实缺失"不是空断言——
// 事实规范化一旦把同一时刻判成不同（或反向把丢失当保留），这例就会红。
const FRAG_BEFORE = '第一段讲场地。\n第二段讲时间。\n集合时间是8点30分。\n'
const FRAG_AFTER = '第一段讲场地。\n集合时间是8点30分。\n'
const fragBody = bodyIntegrity(FRAG_BEFORE, FRAG_AFTER)

const SAME_SOURCE_CASES = [
  { label: '只有片段丢失', body: fragBody, app: 'applied', ok: true, gate: true, factBlocking: false, textWarn: true },
  { label: '有事实缺失', body: round2Body, app: 'applied', ok: false, gate: false, factBlocking: true, textWarn: null },
  { label: '完全不适用（本回合首个候选）', body: null, app: 'not-applicable', ok: true, gate: true, factBlocking: false, textWarn: null },
  // 比不了时 gate.bodyIntegrityOk 仍为 true（"比较结果"这个字段没结果可填），否决靠 body.unverified 阻断项 + 适用性——
  // 这正是三态存在的理由：只看 gate.bodyIntegrityOk 会把这一例误判成通过。
  { label: '声称 applied 却没给结果', body: null, app: 'applied', ok: false, gate: true, factBlocking: false, textWarn: null },
  { label: '冻结基准下的第 2 轮候选', body: frozenVC, app: 'applied', ok: false, gate: false, factBlocking: true, textWarn: null },
  { label: '冻结基准下补回部分事实的候选', body: frozenVD, app: 'applied', ok: false, gate: false, factBlocking: true, textWarn: null },
  { label: '只换素材的重试', body: retrySame, app: 'applied', ok: true, gate: true, factBlocking: false, textWarn: false },
  { label: '重试顺手改日期', body: retryDrifted, app: 'applied', ok: false, gate: false, factBlocking: true, textWarn: null },
  { label: '重试把时间改成包含旧值原文的新值', body: retrySubstring, app: 'applied', ok: false, gate: false, factBlocking: true, textWarn: null },
]

for (const c of SAME_SOURCE_CASES) {
  const g = gateOf(c.body, c.app)
  const v = g.verdict
  const wantApp = c.app === 'applied' && !c.body ? 'failed' : c.app
  const hasBodyBlocker = v.blockers.some((i) => i.stage === 'body')
  const wantBodyBlocker = wantApp === 'failed' ? true : wantApp === 'applied' ? !c.body.ok : false
  const factIssue = g.issues.find((i) => i.code === ISSUE_CODES.bodyFactLost)

  check(`⑩ ${c.label}：适用性如实反映`, v.gate.bodyApplicability === wantApp, `实际=${v.gate.bodyApplicability} 期望=${wantApp}`)
  check(
    `⑩ ${c.label}：gate.bodyIntegrityOk 与 body.ok / 适用性同源`,
    v.gate.bodyIntegrityOk === c.gate,
    `gate=${v.gate.bodyIntegrityOk} 期望=${c.gate} body.ok=${c.body ? c.body.ok : '（无结果）'}`,
  )
  check(`⑩ ${c.label}：verdict.ok 与严重度一致`, v.ok === c.ok, `ok=${v.ok} 阻断=${blockingCodes(v).join(',') || '无'}`)
  check(
    `⑩ ${c.label}：body 阻断项的有无与 body.ok 一一对应（无隐藏 false、无幽灵阻断）`,
    hasBodyBlocker === wantBodyBlocker,
    `有 body 阻断项=${hasBodyBlocker} 期望=${wantBodyBlocker}`,
  )
  if (!c.body) {
    // 没有正文结果时，正文类问题只允许"比不了"这一条：不得凭空造出事实缺失/片段丢失来充数
    const bodyBlockers = v.blockers.filter((i) => i.stage === 'body')
    check(
      `⑩ ${c.label}：无正文结果时不许凭空造出正文问题（只允许"比不了"）`,
      bodyBlockers.every((i) => i.code === ISSUE_CODES.bodyUnverified) &&
        bodyBlockers.length === (wantApp === 'failed' ? 1 : 0) &&
        !v.warnings.some((i) => i.stage === 'body'),
      `body 阻断=${codes(bodyBlockers).join(',') || '无'}`,
    )
  } else {
    check(
      `⑩ ${c.label}：事实缺失以 blocking 出现且确实进了阻断清单`,
      Boolean(factIssue) === c.factBlocking &&
        (!factIssue || (factIssue.severity === 'blocking' && v.blockers.some((i) => i.code === ISSUE_CODES.bodyFactLost))),
      factIssue ? `severity=${factIssue.severity}` : '（本例无事实缺失）',
    )
    if (c.textWarn !== null) {
      const textIssue = g.issues.find((i) => i.code === ISSUE_CODES.bodyTextLost)
      check(
        `⑩ ${c.label}：片段丢失以 warning 出现、只进警告清单（不阻断）`,
        Boolean(textIssue) === c.textWarn &&
          (!textIssue ||
            (textIssue.severity === 'warning' &&
              v.warnings.some((i) => i.code === ISSUE_CODES.bodyTextLost) &&
              !v.blockers.some((i) => i.code === ISSUE_CODES.bodyTextLost))),
        textIssue ? `severity=${textIssue.severity} 警告数=${v.warnings.length}` : '（本例无片段丢失）',
      )
    }
  }
}

const failedCase = gateOf(null, 'applied').verdict
check(
  '⑩ 边界：比不了时 gate.bodyIntegrityOk=true 但 ok=false——必须同时读 bodyApplicability',
  failedCase.gate.bodyIntegrityOk === true &&
    failedCase.ok === false &&
    failedCase.gate.bodyApplicability === 'failed' &&
    has(failedCase.blockers, ISSUE_CODES.bodyUnverified) &&
    failedCase.unverified.includes('body'),
  `gate=${failedCase.gate.bodyIntegrityOk} ok=${failedCase.ok} 适用性=${failedCase.gate.bodyApplicability}`,
)
const naCase = gateOf(null, 'not-applicable').verdict
check(
  '⑩ 边界：不适用是明确结论，不算"未核验"（首稿不背假账）',
  naCase.gate.bodyApplicability === 'not-applicable' && naCase.checks.body === 'unknown' && !naCase.unverified.includes('body'),
  `适用性=${naCase.gate.bodyApplicability} checks.body=${naCase.checks.body}`,
)

// ---------- 附加：版本字段一致 / 容量风险 / 指纹去重 / 未知代码兜底 ----------

const vVer1 = deliveryVerdict([], { version: [{ scope: 'meta', field: 'revisionId', value: 'rev-2' }, { scope: 'html', field: 'revisionId', value: 'rev-1' }] })
check('版本字段不一致 → 阻断（不出现新源文配旧 HTML）', vVer1.ok === false && vVer1.gate.versionConsistent === false && has(vVer1.blockers, ISSUE_CODES.versionMismatch))
const vVer2 = deliveryVerdict([], { version: [{ scope: 'meta', field: 'revisionId', value: 'rev-2' }, { scope: 'html', field: 'revisionId', value: 'rev-2' }] })
check('版本字段一致 → 不阻断', vVer2.ok === true && vVer2.gate.versionConsistent === true)
check('必需版本字段缺失 → 阻断', has(issuesFromVersion([{ scope: 'meta', field: 'runId', value: 'r1' }], ['revisionId']), ISSUE_CODES.versionMissing))

const bigHtml = '<section style="color:#333">' + 'x'.repeat(20010) + '</section>'
const capIssues = collectDeliveryIssues({ html: bigHtml, plainText: 'x'.repeat(20010) }).filter((i) => i.code === ISSUE_CODES.capacityOverLimit)
const vCap = deliveryVerdict(collectDeliveryIssues({ html: bigHtml, plainText: 'x'.repeat(20010) }))
check('未验证的容量规则只登记为长度风险（warning，不阻断）', capIssues.length === 1 && capIssues[0].severity === 'warning' && capIssues[0].stage === 'capacity', capIssues.length && capIssues[0].severity)
check('容量规则的度量对象被写明（不是"删正文凑长度"）', String(capIssues[0].evidence).includes(CAPACITY_RULES[0].measure))
check('容量风险不阻断（未在平台验证前不得当既成事实）', vCap.ok === true)

const dup = dedupeIssues([htmlIssues(GRADIENT_HTML)[0], htmlIssues(GRADIENT_HTML)[0]])
check('同代码同位置去重为一条', dup.length === 1 && issueFingerprint(dup[0]) === issueFingerprint(htmlIssues(GRADIENT_HTML)[0]))
check('未知代码按解析类兜底（fail-closed，不静默放行）', stageOfCode('weird.code') === 'parse' && deliveryVerdict([{ code: 'weird.code', severity: 'blocking', stage: 'parse', message: 'x', sourceRange: { line: 1, endLine: 1 }, repairKind: 'reparse' }]).ok === false)
check('严重度分档统计可用', countBySeverity(collectDeliveryIssues({ html: GRADIENT_HTML, plainText: '正文。' }), 'blocking') >= 1)

// 汇总口径：即使全绿，也要写明"checkHtml.ok 不等于整稿通过、保存成功不等于验收通过"
const vClean = deliveryVerdict(collectDeliveryIssues({ source: '# 标题\n\n正文一段。\n', html: CLEAN_HTML, plainText: '正文一段。' }), { version: [{ scope: 'meta', field: 'revisionId', value: 'rev-3' }, { scope: 'manifest', field: 'revisionId', value: 'rev-3' }] })
check('全绿时仍显式声明两条口径', vClean.ok === true && vClean.notes.some((n) => n.includes('checkHtml.ok')) && vClean.notes.some((n) => n.includes('保存成功')))
check('未提供版本快照时记为 unverified，不含糊通过', deliveryVerdict([], {}).unverified.includes('version'))

// 未核验清单必须**去重**（2026-10-08）：`version` 在 ALL_STAGES 里，既会被"没查过的阶段"扫到、
// 又有一条更精确的判据；不去重就会在界面质量条上渲染成「未核验：version / version」（实测 BIG 成品如此）。
// 触发形状是**声明查过部分阶段**（App.tsx 就是这么调的），所以下面按这个形状造红。
const vStaged = deliveryVerdict([], { stagesChecked: ['parse', 'material', 'raster', 'html', 'body', 'capacity'] })
check(
  '未核验清单去重：声明查过部分阶段时 version 只出现一次',
  vStaged.unverified.filter((u) => u === 'version').length === 1,
  JSON.stringify(vStaged.unverified),
)
check(
  '未核验清单整体无重复项',
  new Set(vStaged.unverified).size === vStaged.unverified.length,
  JSON.stringify(vStaged.unverified),
)
// 对照：另一种调用形状（什么阶段都不声明）也必须无重复、且仍是恰好一条 version
const vNoStages = deliveryVerdict([], {})
check(
  '未核验清单去重：不声明阶段时同样无重复且 version 恰好一条',
  new Set(vNoStages.unverified).size === vNoStages.unverified.length &&
    vNoStages.unverified.filter((u) => u === 'version').length === 1,
  JSON.stringify(vNoStages.unverified),
)


console.log('\n[⑪ 代码块不是源码泄漏（对抗式审计发现）]')
{
  // 正文里贴一段示范素材写法的代码：compose 自己会跳过代码节点，交付门禁也必须跳过，
  // 否则这份稿**永远过不了门禁**，而自动修复只会让模型反复重写正文（拿改文章去修程序的错）。
  const v2WithCode =
    '[[theme:校园]]\n\n## 示例文章\n\n这段代码展示了素材写法：\n\n```\n[[asset:deco|as-1|角饰]]\n```\n\n以上是示例。'
  const r = composeMarkdown(v2WithCode, {})
  const codes = leakIssues(r.html, v2WithCode).map((i) => i.code)
  check('⑪ 正文里的正当代码示例不产生源码泄漏阻断', codes.length === 0, `实测 ${JSON.stringify(codes)}`)
  // 反向对照：**转义后的泄漏文本**仍在正文里，必须照旧拦住（不是靠全局放宽变绿）
  const realLeak = '<p>泄漏：&lt;svg viewBox="0 0 750 220"&gt;</p>'
  check('⑪ 转义后的内部源码泄漏仍然被拦（反向对照）', leakIssues(realLeak).some((i) => i.code === ISSUE_CODES.parseLeak), '')
}

console.log('\n[⑫ 正文边界不确定必须可见（不得静默提交截断稿）]')
{
  // 无内层代码块：边界确定
  const plain = '说明\n\n```v2\n[[theme:校园]]\n\n## 标题\n\n正文。\n```'
  const a = splitAssistant(plain)
  check(
    '⑫ 普通回复：正文边界确定，v2Ambiguous=false',
    a.v2 === '[[theme:校园]]\n\n## 标题\n\n正文。' && a.v2Ambiguous === false,
    `v2=${JSON.stringify(a.v2)} ambiguous=${a.v2Ambiguous}`,
  )
  // 含内层代码块：同一份字节序列既可解释为"代码块开围栏"也可解释为"正文结束"，
  // 解析器不能猜——必须把"边界不确定"报出来，上层据此**不得静默提交**。
  const nested =
    '说明\n\n```v2\n[[theme:校园]]\n\n## 示例\n\n下面是一段配置：\n\n```\nconst a = 1\n```\n\n结尾段落：请照此配置。\n```'
  const b = splitAssistant(nested)
  check('⑫ 含内层代码块：如实标记 v2Ambiguous=true', b.v2Ambiguous === true, `ambiguous=${b.v2Ambiguous} v2=${JSON.stringify(b.v2)}`)
  check(
    '⑫ 候选问题码 parse.ambiguous-body 存在且按"重新解析"处置',
    Boolean(ISSUE_CODES.parseAmbiguous) && repairKindFor(ISSUE_CODES.parseAmbiguous, 'blocking') === 'reparse',
    ISSUE_CODES.parseAmbiguous,
  )
}

console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'DELIVERY-QUALITY' })
