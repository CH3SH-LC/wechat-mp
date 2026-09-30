// asset-completion-check.mjs —— 素材"完成状态"贯通断言（修复计划 §6：库读取成功 ≠ 验收完成）
// 用法：node scripts/asset-completion-check.mjs
//
// 要证伪的是这条缝：素材**到手**（库读到了 / 画出来了）曾经直接等于"素材位完成"。
// 可素材还要过结构/实际尺寸栅格门禁，还要在最终排版上真的落位——被排版层拒收、或者干脆
// 被丢掉的那一处，正文里其实是个空框，而界面与清单上显示"已完成"，用户没有可重试的项。
//
// 覆盖：
//   ① 排版拒收 → 台账从 ok 降级为 failed，理由来自 compose（真实 composeMarkdown 的 rejectedArts）
//   ② refs 比对不上 → 如实产出"无法定位到素材位"的诊断（不静默丢弃）
//   ③ 降级后 unfinished(ledger) 能列出它（界面据此给单项重试），且降级不带预算、不自动重画
//   ④ 复用路径同样过适用门禁（结构不合格 / 按素材角色判定），与新绘路径同一套 acceptSvg
//   ⑤ 自动流程不会重置用户未点过的素材位预算；只有用户显式重试（retrySlotIds）才重置
//
// 关于栅格那一半：真实尺寸栅格（阶段 5）只在有 canvas 的环境（webview）跑，node 里
// `rasterStats` 返回 null、自动跳过；本脚本因此只能覆盖门禁的**结构**半边，
// 栅格阈值本身的校准与断言在 scripts/raster-check.mjs（浏览器）里，走的是同一个 acceptSvg。
import { resetStub } from './lib/ls-stub.mjs'

const { addAsset, updateAsset, getAsset, deleteAsset } = await import('../src/lib/asset-library.ts')
const { emptyMaterializeInfo, materializePlaceholders, applyRejectedArts } = await import('../src/lib/image-agent.ts')
const { composeMarkdown } = await import('../src/lib/compose.ts')
const { createLedger, unfinished, MAX_DRAW_ATTEMPTS } = await import('../src/lib/asset-ledger.ts')
const { newRunId } = await import('../src/lib/trace.ts')
const { checkSvgQuality } = await import('../src/lib/svg-quality.ts')
const { readFileSync } = await import('node:fs')
const { fileURLToPath } = await import('node:url')
const { dirname, join } = await import('node:path')

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

// 一朵"红色玫瑰"角饰（右下集中、元素 5 个、比例 1.5）：库素材样例
const ROSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<circle cx="200" cy="130" r="34" fill="#c0392b"/>
<circle cx="232" cy="106" r="20" fill="#a5281f"/>
<path d="M150 176 q30 -46 74 -34 q-22 46 -74 34z" fill="#6b8e6e"/>
<path d="M170 186 q22 -22 56 -16" stroke="#3f6b45" stroke-width="4" fill="none"/>
<circle cx="216" cy="146" r="8" fill="#e8b48a"/>
</svg>`
const ROSE_MARK = 'circle cx="200" cy="130" r="34"'

// 通栏插画（750x220、8 个可见元素）：宽幅位用
const SCENERY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="0" y="170" width="750" height="50" fill="#e8dcc8"/>
<path d="M0 170 L180 110 L320 150 L500 90 L640 140 L750 96 V170 Z" fill="#d9a35f" opacity="0.45"/>
<circle cx="620" cy="60" r="38" fill="#f2c76e"/>
<rect x="120" y="96" width="90" height="74" fill="#8a5f3a"/>
<path d="M110 96 h110 l-18 -26 h-74 z" fill="#a97c50"/>
<circle cx="165" cy="130" r="12" fill="#f2c76e"/>
<path d="M400 150 q20 -34 60 -30 q-8 34 -60 30z" fill="#8fb8a4"/>
<circle cx="430" cy="132" r="9" fill="#c96f4a"/>
</svg>`

const FILLER = `咖啡店开业的第一个周末，门口摆了两张小桌，磨豆机从早响到晚。附近写字楼的客人多是外带，
楼上的住户更愿意坐下来，点一杯手冲慢慢喝完。店里的陈设没什么讲究，木架子上放着几袋当季豆子，
墙上挂着一块手写的口味板，写着今天供应哪几支豆、烘焙到什么程度、适合怎么冲。`
const FILLER2 = `关于价格，我们做了一件自认为实在的事：所有单品的定价都写在门口的小黑板上，不加收服务费，
自带杯子减两元。开业首周做了个小小的活动，买任意一杯送一张手冲体验券，可在工作日任意时段使用。`

/** 组装一篇结构合规的 v2 正文；decoLine / wideLine 是两个待检验的素材位 */
function article(decoLine, wideLine) {
  return `[[theme:日系]]

[[banner:新店开业|木架上的当季豆子]]

${wideLine}

## 关于选豆

${FILLER}

${decoLine}

${FILLER2}
`
}

const run = async (v2, opts) => {
  const info = emptyMaterializeInfo()
  const out = await materializePlaceholders(v2, '日系', info, opts)
  return { out, info, comp: composeMarkdown(out, {}) }
}

/** 把正文里第一个 `::: art deco …` 块的 SVG 换掉（模拟"排版层最终拿到的那份块不达标"） */
function replaceFirstArtBody(text, svg) {
  const lines = String(text).split('\n')
  const start = lines.findIndex((l) => l.trim().startsWith('::: art deco'))
  if (start < 0) return null
  let end = -1
  for (let k = start + 1; k < lines.length; k++) {
    if (lines[k].trim() === ':::') { end = k; break }
  }
  if (end < 0) return null
  return [...lines.slice(0, start + 1), svg, ...lines.slice(end)].join('\n')
}

// ================= ① ② ③：排版拒收 → 台账降级 =================
console.log('[§6 ① 排版层拒收的素材位必须从 ok 降级为 failed]')
resetStub()
const rose = await addAsset({
  category: 'bubble',
  name: 'rose',
  title: '玫瑰角饰',
  desc: '右下角一朵红色玫瑰花，校园毕业季',
  usage: 'deco',
  origin: 'workshop',
  svg: ROSE,
})
check('样例角饰已入库', !!rose, rose && rose.id)

const V2 = article(`[[asset:bubble|${rose.id}|右下角一朵红色玫瑰花，校园毕业季]]`, '[[img:wide|门店横幅]]')
const ledger = createLedger(newRunId())
const first = await run(V2, { ledger, persist: false })
const decoEntry = ledger.order.map((k) => ledger.slots[k]).find((e) => e.kind === 'asset')
const wideEntry = ledger.order.map((k) => ledger.slots[k]).find((e) => e.kind === 'wide')
check('两个素材位都已记为 ok（素材到手）', !!decoEntry && !!wideEntry && decoEntry.status === 'ok' && wideEntry.status === 'ok')
check('基线：排版层没有拒收', first.comp.rejectedArts.length === 0, `n=${first.comp.rejectedArts.length}`)

// 排版层最终拿到的那份块不达标（node 里没有栅格层，两层共用同一个 Tier 1 结构检查，
// 所以这里注入"块内 SVG 不合格"来制造一次真实的 compose 拒收——被检验的是**回写链路**，
// 不是"两层会不会分歧"）
const BAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="1"/></svg>'
const injected = replaceFirstArtBody(first.out, BAD_SVG)
check('注入成功（确实换掉了 deco 块的 SVG）', !!injected && injected.includes(BAD_SVG) && !injected.includes(ROSE_MARK))
const composed = composeMarkdown(injected, {})
check('排版层拒收该素材块', composed.rejectedArts.length === 1, `n=${composed.rejectedArts.length}`)
check('拒收记录带别名/ID 候选', composed.rejectedArts[0].refs.includes(rose.id), JSON.stringify(composed.rejectedArts[0].refs))
check(
  '拒收同时报 blocking 问题（交付门禁据此阻断）',
  composed.issues.some((i) => i.code === 'asset.rejected' && i.severity === 'blocking'),
  JSON.stringify(composed.issues.map((i) => `${i.code}/${i.severity}`)),
)

const rejInfo = emptyMaterializeInfo()
const res = applyRejectedArts(ledger, composed.rejectedArts, rejInfo)
check('台账按 assetId/别名把拒收定位回素材位', res.demoted.length === 1 && res.demoted[0].slotId === decoEntry.slotId, `demoted=${res.demoted.length}`)
check('没有"无法定位"的拒收（这一条能对上）', res.unlocated.length === 0)
check('① 该素材位改口为 failed', decoEntry.status === 'failed', decoEntry.status)
check('① 失败理由来自排版层（原样带上 compose 的 reason）', decoEntry.reason.includes(composed.rejectedArts[0].reason), decoEntry.reason)
check('降级清掉成品块（下一轮不会把被拒的块又复用回正文）', decoEntry.block === undefined && decoEntry.ref === undefined)
check('③ unfinished(ledger) 能列出它（界面据此给单项重试）', unfinished(ledger).some((e) => e.slotId === decoEntry.slotId), JSON.stringify(unfinished(ledger).map((e) => e.slotId)))
check('没有误伤别的素材位（宽幅位仍是 ok）', wideEntry.status === 'ok' && wideEntry.block !== undefined)
check('降级不重置预算（不白送一次绘图预算）', decoEntry.attempts === 0 && decoEntry.clarifications === 0)

// 下一轮自动修订：拒收回写必须让它从正文里消失，并向用户报出真实原因
const round2 = await run(V2, { ledger, persist: false, rejectedArts: composed.rejectedArts })
check('下一轮不再复用被拒的成品块（正文里没有它）', !round2.out.includes(ROSE_MARK))
check(
  '下一轮把真实原因报给用户（不是"已完成"）',
  round2.info.errors.some((e) => e.includes('未完成') && e.includes(composed.rejectedArts[0].reason)),
  JSON.stringify(round2.info.errors),
)
check('未完成状态在下一轮仍然成立', unfinished(ledger).some((e) => e.slotId === decoEntry.slotId))
check('被拒的素材位不会被自动重画（要用户点重试）', round2.info.storedFallback === 0, `stored=${round2.info.storedFallback}`)
check(
  '同一份拒收记录被回写两次不会误报"无法定位"（回写幂等）',
  round2.info.unlocatedRejects.length === 0,
  JSON.stringify(round2.info.unlocatedRejects),
)

// ================= ② refs 比对不上 =================
console.log('\n[§6 ② refs 比对不上 → 如实记一条"无法定位"，不静默丢弃]')
{
  const info = emptyMaterializeInfo()
  const before = unfinished(ledger).length
  const r = applyRejectedArts(
    ledger,
    [{ refs: ['as-不存在', '某个没登记过的别名'], line: 12, reason: '素材含 <text>' }],
    info,
  )
  check('确实比对不上（没有乱认亲）', r.unlocated.length === 1 && r.demoted.length === 0, `unlocated=${r.unlocated.length} demoted=${r.demoted.length}`)
  check('② 产出"无法定位到素材位"的诊断', info.unlocatedRejects.length === 1 && info.unlocatedRejects[0].includes('找不到对应的素材位'), JSON.stringify(info.unlocatedRejects))
  check('② 诊断同时进用户可见的错误（不是只写进日志）', info.errors.length === 1 && info.errors[0].includes('不会被算作交付成功'), JSON.stringify(info.errors))
  check('诊断带得上源文行号与原因', info.unlocatedRejects[0].includes('第 12 行') && info.unlocatedRejects[0].includes('素材含 <text>'))
  check('比对不上不会连带降级别的素材位', unfinished(ledger).length === before)
}

// ================= ④ 复用路径的适用门禁 =================
console.log('\n[§6 ④ 复用素材与新生成素材执行一致的适用门禁]')
{
  // 结构不合格：库里存着一张含 <text> 的角饰（素材禁用文字，Tier 1 硬拦）
  resetStub()
  const badSvg = ROSE.replace('</svg>', '<text x="10" y="20">花</text></svg>')
  const bad = await addAsset({
    category: 'deco',
    name: 'badtext',
    title: '带文字的角饰',
    desc: '右下角一朵小红花角饰',
    usage: 'deco',
    origin: 'workshop',
    svg: badSvg,
  })
  const r = await run(article(`[[asset:deco|${bad.id}|右下角一朵小红花角饰]]`, '[[img:wide|门店横幅]]'), { persist: false })
  const e = r.info.ledger.order.map((k) => r.info.ledger.slots[k]).find((x) => x.kind === 'asset')
  check('库里读得出来（不是"素材不存在"）', r.info.residual === 0, `residual=${r.info.residual}`)
  check('④ 但没通过质检，不得记为完成', e.status === 'failed' && (e.reason || '').includes('未通过质检'), e.reason)
  check('④ 不达标原因点明结构性缺陷', (e.reason || '').includes('禁用文字'), e.reason)
  check('④ 绑定落成 failed、无库 ID（不算已交付）', r.info.bindings[0]?.source === 'failed' && r.info.bindings[0]?.id === '')
  check('不达标的素材没有进成品', !r.out.includes('<text'))
  check('不达标不属于"正文写法问题"（不触发自动重写）', r.info.residual === 0)
  check('不靠"偷偷重画一张"掩盖（没有额外模型调用）', r.info.storedFallback === 0 && !r.out.includes(ROSE_MARK))
  check('素材位保留 slotId（可在清单上单项重试）', !!r.info.bindings[0]?.slotId, r.info.bindings[0]?.slotId)
}
{
  // 门禁必须按**素材角色**判定（与工坊入库同口径），不是按插槽位置将就
  resetStub()
  const pf = await addAsset({
    category: 'photo-frame',
    name: 'wf',
    title: '照片框',
    desc: '照片位装饰框',
    usage: '',
    origin: 'workshop',
    svg: SCENERY, // 750x220 通栏插画：按 wide 合格，按 photo-frame 的宽高比窗口不合格
  })
  check('对照：同一份 SVG 按 wide 判定是合格的', checkSvgQuality(SCENERY, 'wide').ok === true)
  check('对照：按 photo-frame 判定不合格（口径不同，结论必须不同）', checkSvgQuality(SCENERY, 'photo-frame').ok === false)
  const r = await run(article(`[[asset:photo-frame|${pf.id}|照片位装饰框]]`, '[[img:wide|门店横幅]]'), { persist: false })
  const e = r.info.ledger.order.map((k) => r.info.ledger.slots[k]).find((x) => x.kind === 'asset')
  check(
    '④ 复用按素材自身角色过门禁（不是按插槽位置将就）',
    e.status === 'failed' && (e.reason || '').includes('宽高比'),
    e.reason,
  )
}

// ================= ⑤ 用户手动重试 vs 自动流程 =================
console.log('\n[§6 ⑤ 自动流程不得冒充用户重试来重置预算]')
{
  resetStub()
  const good = await addAsset({
    category: 'deco',
    name: 'gooddeco',
    title: '好角饰',
    desc: '右下角一朵红色玫瑰花，校园毕业季',
    usage: 'deco',
    origin: 'workshop',
    svg: ROSE,
  })
  const v2 = article(`[[asset:deco|${good.id}|右下角一朵红色玫瑰花，校园毕业季]]`, '[[img:wide|门店横幅]]')
  const L = createLedger(newRunId())
  await run(v2, { ledger: L, persist: false })
  const e = L.order.map((k) => L.slots[k]).find((x) => x.kind === 'asset')
  check('先跑一轮：这一位是 ok', e.status === 'ok')
  // 模拟"预算已经用尽后失败"（真实里由绘图重试与超时写出来）
  e.status = 'failed'
  e.attempts = MAX_DRAW_ATTEMPTS
  e.assetId = ''
  e.block = undefined
  e.ref = undefined
  e.reason = '网络错误（注入）'

  const auto = await run(v2, { ledger: L, persist: false }) // 自动流程：不传 retrySlotIds
  check('⑤ 自动流程不重置预算', e.attempts === MAX_DRAW_ATTEMPTS, `attempts=${e.attempts}`)
  check('⑤ 自动流程不翻案（不会因为库里读得到就复活成完成）', e.status === 'failed' && !auto.out.includes(ROSE_MARK))
  check('⑤ 自动流程不派发新绘图', auto.info.storedFallback === 0)

  const manual = await run(v2, { ledger: L, persist: false, retrySlotIds: [e.slotId] }) // 用户点"重试"
  check('⑤ 只有用户显式重试才重置预算并重跑', e.status === 'ok' && manual.out.includes(ROSE_MARK), `status=${e.status}`)

  // 接线契约：retryIds 只能被 opts.retrySlotIds 填充，任何自动流程都不得往里加 id
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'image-agent.ts'), 'utf8')
  check('接线：没有任何代码往 retryIds 里加 id（只能由用户重试传入）', !src.includes('retryIds.add('))
  check('接线：retryIds 只被 applyRetry 消费', src.includes('retryIds.has(') && src.includes('opts?.retrySlotIds'))
}

console.log('\n[§6 第四条：单项重试后仍走整稿门禁（不绕过检查）]')
{
  // 重试只是重置预算；产出仍要过同一套门禁，且再被排版层拒收时照样降级
  resetStub()
  const bad = await addAsset({
    category: 'deco',
    name: 'badtext2',
    title: '带文字的角饰',
    desc: '右下角一朵小红花角饰',
    usage: 'deco',
    origin: 'workshop',
    svg: ROSE.replace('</svg>', '<text x="10" y="20">花</text></svg>'),
  })
  const L = createLedger(newRunId())
  const v2 = article(`[[asset:deco|${bad.id}|右下角一朵小红花角饰]]`, '[[img:wide|门店横幅]]')
  await run(v2, { ledger: L, persist: false })
  const e = L.order.map((k) => L.slots[k]).find((x) => x.kind === 'asset')
  const retry = await run(v2, { ledger: L, persist: false, retrySlotIds: [e.slotId] })
  check('重试后仍停在"未通过质检"（没有独立入口把它算成功）', e.status === 'failed' && (e.reason || '').includes('未通过质检'), e.reason)
  check('重试也没有偷偷重画一张来掩盖', retry.info.storedFallback === 0)
}

console.log('\n[§5.4 assetPolicy=preserve：身份退化拦截（DS 修复指南 F4）]')
{
  // 场景：用户只要求改文字，模型（或历史消息回显）却把已固化的
  // `[[asset:…]]` 退回成了 `[[img:wide|…|new]]`。照常走会**重新画一张**——
  // preserve 必须在**派发绘图之前**按文档绑定确定性恢复同一 assetId，0 次绘图。
  resetStub()
  const wide = await addAsset({
    category: 'art-wide',
    name: 'banner-wide',
    title: '门店横幅',
    desc: '门店横幅插画',
    usage: 'wide',
    origin: 'workshop',
    svg: SCENERY,
  })
  const L = createLedger(newRunId())
  const regressed = `[[theme:日系]]\n\n[[img:wide|门店横幅插画|new]]\n\n## 关于选豆\n\n${FILLER}\n`
  const priorBindings = [{ slot: '[[img:wide|门店横幅插画|new]]', id: wide.id }]
  /** 本文档固化下来的那一份（v1）：指南 §5.4 明确"文档快照是保持素材的权威输入" */
  const snapshots = { [wide.id]: { svg: SCENERY, ver: 1 } }

  // 对照组：不传 preserve（默认行为）→ 就该按 |new 走新绘，**不能**恢复成已有那件
  // （否则"用户要求换一张图"会被静默吞掉——这正是 preserve 必须由模型显式声明、不能全局强加的原因）
  const L0 = createLedger(newRunId())
  const plain = await run(regressed, { ledger: L0, persist: false })
  const e0 = L0.order.map((k) => L0.slots[k]).find((x) => x.kind === 'wide')
  check(
    '对照：不声明 preserve 时，|new 照常新绘、不会恢复成已有那件',
    e0?.status === 'ok' && !plain.out.includes(wide.id),
    `status=${e0?.status} 产出里含既有 ID=${plain.out.includes(wide.id)}（既有=${wide.id}）`,
  )

  // 正式断言
  const out = await run(regressed, { ledger: L, persist: false, assetPolicy: 'preserve', priorBindings, snapshots })
  const e = L.order.map((k) => L.slots[k]).find((x) => x.kind === 'wide')
  check('preserve：素材位恢复为 ok（同一 assetId，不重画）', e?.status === 'ok' && e?.assetId === wide.id, `status=${e?.status} assetId=${e?.assetId}`)
  check('preserve：产出里的块就是那件既有素材（未被新绘替换）', out.out.includes(wide.id) || out.info.used[wide.id] !== undefined, `used=${Object.keys(out.info.used).join(',')}`)
  check('preserve：恢复原因写明"本回合声明素材不动"', String(e?.reason || '').includes('素材不动'), e?.reason)
  check('preserve：新绘数量为 0（storedFallback 不增）', out.info.storedFallback === 0, `storedFallback=${out.info.storedFallback}`)

  // 库升级到 v2、文档快照仍是 v1 → 必须用**文档 v1**，不能拿库最新版悄悄补齐（指南 §5.4）
  const L1b = createLedger(newRunId())
  const upgraded = await updateAsset(wide.id, {}, SCENERY.replace('<circle cx="620" cy="60" r="38" fill="#f2c76e"/>', '<rect x="600" y="30" width="60" height="60" fill="#3f6b45"/>'))
  const libNow = (await getAsset(wide.id))?.svg || ''
  const out1b = await run(regressed, { ledger: L1b, persist: false, assetPolicy: 'preserve', priorBindings, snapshots })
  const e1b = L1b.order.map((k) => L1b.slots[k]).find((x) => x.kind === 'wide')
  const savedV1 = snapshots[wide.id].svg
  check(
    'preserve：同 ID 库升到 v2 时仍用文档 v1 快照（不被库最新版顶替）',
    // 库条目确实已经变成 v2（前置条件成立），而本回合恢复出来的是 v1 的内容
    !!upgraded && libNow !== savedV1 && e1b?.status === 'ok' && !String(out1b.out).includes(libNow),
    `库已变=${libNow !== savedV1} status=${e1b?.status} 产出含库 v2=${String(out1b.out).includes(libNow)}`,
  )

  // 库条目被删除、快照仍有效 → 仍能按快照恢复（指南 §5.4）
  const L1c = createLedger(newRunId())
  await deleteAsset(wide.id)
  const out1c = await run(regressed, { ledger: L1c, persist: false, assetPolicy: 'preserve', priorBindings, snapshots })
  const e1c = L1c.order.map((k) => L1c.slots[k]).find((x) => x.kind === 'wide')
  check(
    'preserve：库条目已删除、快照有效时仍能恢复（不因库没了就丢图）',
    e1c?.status === 'ok' && e1c?.assetId === wide.id && out1c.info.storedFallback === 0,
    `status=${e1c?.status} assetId=${e1c?.assetId}`,
  )

  // 恢复不了 → 明确失败，不偷偷改画
  const L2 = createLedger(newRunId())
  const missingPrior = [{ slot: '[[img:wide|门店横幅插画|new]]', id: 'as-does-not-exist' }]
  const out2 = await run(regressed, { ledger: L2, persist: false, assetPolicy: 'preserve', priorBindings: missingPrior, snapshots })
  const e2 = L2.order.map((k) => L2.slots[k]).find((x) => x.kind === 'wide')
  check('preserve：绑定素材不可用时明确失败，而不是偷偷新绘一张', e2?.status === 'failed' && out2.info.storedFallback === 0, `status=${e2?.status} reason=${e2?.reason}`)

  // 快照缺失（绑定在、快照没有）→ 明确失败，不能拿库最新版悄悄补齐
  const L2b = createLedger(newRunId())
  const wide2 = await addAsset({
    category: 'art-wide',
    name: 'banner-wide-2',
    title: '门店横幅二',
    desc: '门店横幅插画',
    usage: 'wide',
    origin: 'workshop',
    svg: SCENERY,
  })
  const out2b = await run(regressed, { ledger: L2b, persist: false, assetPolicy: 'preserve', priorBindings: [{ slot: '[[img:wide|门店横幅插画|new]]', id: wide2.id }], snapshots: {} })
  const e2b = L2b.order.map((k) => L2b.slots[k]).find((x) => x.kind === 'wide')
  check(
    'preserve：快照缺失时明确失败（不拿素材库当前版本顶替）',
    e2b?.status === 'failed' && out2b.info.storedFallback === 0 && String(e2b?.reason || '').includes('快照'),
    `status=${e2b?.status} reason=${e2b?.reason}`,
  )

  // 同一 slot 两个不同绑定 → 歧义必须阻断（旧实现 find() 静默取第一项）
  const L2c = createLedger(newRunId())
  const ambiguous = [
    { slot: '[[img:wide|门店横幅插画|new]]', id: wide2.id },
    { slot: '[[img:wide|门店横幅插画|new]]', id: 'as-another-one' },
  ]
  const out2c = await run(regressed, { ledger: L2c, persist: false, assetPolicy: 'preserve', priorBindings: ambiguous, snapshots: { [wide2.id]: { svg: SCENERY, ver: 1 } } })
  const e2c = L2c.order.map((k) => L2c.slots[k]).find((x) => x.kind === 'wide')
  check(
    'preserve：同一素材位有两个不同绑定时阻断（不静默取第一项）',
    e2c?.status === 'failed' && out2c.info.storedFallback === 0 && String(e2c?.reason || '').includes('无法确定'),
    `status=${e2c?.status} reason=${e2c?.reason}`,
  )

  // 没有历史绑定的**新**素材位：preserve 下**必须阻断**，不能掉回新绘
  // （DS 修复指南 §5.4：无命中/新占位都明确阻断。旧脚本把"仍可新绘"写成 PASS 预期，与指南相反，已改正）
  const L3 = createLedger(newRunId())
  const fresh = `[[theme:日系]]\n\n[[img:inline|一张全新的小插画|new]]\n\n## 关于选豆\n\n${FILLER}\n`
  const out3 = await run(fresh, { ledger: L3, persist: false, assetPolicy: 'preserve', priorBindings, snapshots })
  const e3 = L3.order.map((k) => L3.slots[k]).find((x) => x.kind === 'inline')
  check(
    'preserve：没有历史绑定的新素材位被阻断，**不**掉回新绘（指南 §5.4）',
    e3 && e3.status === 'failed' && out3.info.storedFallback === 0,
    `status=${e3?.status} storedFallback=${out3.info.storedFallback} reason=${e3?.reason}`,
  )

  // 显式 [[asset:…]] 引用新素材（文档没固化过）→ 同样阻断
  const L4 = createLedger(newRunId())
  const newRef = `[[theme:日系]]\n\n[[asset:art-wide|${wide2.id}|门店横幅插画]]\n\n## 关于选豆\n\n${FILLER}\n`
  const out4 = await run(newRef, { ledger: L4, persist: false, assetPolicy: 'preserve', priorBindings, snapshots: {} })
  const e4 = L4.order.map((k) => L4.slots[k]).find((x) => x.kind === 'asset')
  check(
    'preserve：显式 [[asset]] 引用一件文档从未固化的素材 → 阻断（新引用不放过）',
    e4 && e4.status === 'failed' && out4.info.storedFallback === 0,
    `status=${e4?.status} storedFallback=${out4.info.storedFallback} reason=${e4?.reason}`,
  )
  // 同一条路径的正例：引用的正是文档固化过的那件 → 按快照恢复、0 绘图
  const L5 = createLedger(newRunId())
  const knownRef = `[[theme:日系]]\n\n[[asset:art-wide|${wide2.id}|门店横幅插画]]\n\n## 关于选豆\n\n${FILLER}\n`
  const out5 = await run(knownRef, { ledger: L5, persist: false, assetPolicy: 'preserve', priorBindings: [{ slot: 'old', id: wide2.id }], snapshots: { [wide2.id]: { svg: SCENERY, ver: 1 } } })
  const e5 = L5.order.map((k) => L5.slots[k]).find((x) => x.kind === 'asset')
  check(
    'preserve：显式 [[asset]] 引用文档已固化的那件 → 按快照恢复、0 绘图',
    e5 && e5.status === 'ok' && e5.assetId === wide2.id && out5.info.storedFallback === 0,
    `status=${e5?.status} assetId=${e5?.assetId} storedFallback=${out5.info.storedFallback}`,
  )
}

console.log(failed === 0 ? '\nASSET-COMPLETION OK' : `\nASSET-COMPLETION FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
