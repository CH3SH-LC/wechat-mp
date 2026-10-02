// ledger-finalize-check.mjs —— 账本「终结顺序」与「失败屏障」的**离线**验收（DS 修复指南 §0.0 C）
//
// 测的是两个**生产**模块的原文：
//   · `scripts/lib/ledger-finalize.mjs`（`finalizePhase` / `runFinalizeSequence` / `preflightLedgerGate`）
//   · `scripts/lib/dispatch-budget.mjs`（真实预算写者、真实原子落盘）
// 全部用假传输：`reserve()` 放行才算"真的发出去了"，不联网、不起浏览器、不启动应用、不读密钥。
//
// 复核（docs/artifacts/2026-10-02-readiness-review/budget/README.md）点了两条限定反例：
//   B1 业务失败屏障**单独**写一次、phase 关闭再写一次 → 屏障那次写失败而关闭成功，盘上留下
//      `open:false, outcome:error` 却**没有** `businessFailure`；新进程读到两个 null，照常预留。
//   B2 先 `finalizeLedger()`（账本记 pass）再写必需证据 → 证据写失败时本次判定已是 ERROR，
//      **但账本写着 pass**，下一进程仍获准继续。
//
// 本脚本对两条各做「修后必须绿 / 旧形状必须红」的对照，并且**用真正的新子进程**
// （`scripts/fixtures/ledger-gate-child.mjs`）重读同一份隔离账本、执行同一套历史门槛——
// 复核明确要求过：同进程新建实例不能替代进程边界。
//
// 局限（如实写在证据里）：驱动侧 `finalizeAndExit()` 的 `persistOnce`（把落盘错误并回判定对象）
// 是本脚本用**最小同口径替身**表示的；本脚本保证的是"顺序"与"账本落盘结果"这两件事，
// 驱动源码里的接线由第 ④ 组的结构断言钉住。

import { mkdirSync, mkdtempSync, readFileSync, chmodSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createJudge, guardCrashes, persistRunResult, resolveOutDir } from './lib/run-result.mjs'
import { createBudget } from './lib/dispatch-budget.mjs'
import { finalizePhase, preflightLedgerGate, runFinalizeSequence } from './lib/ledger-finalize.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const childScript = join(here, 'fixtures', 'ledger-gate-child.mjs')

const judge = createJudge({
  script: 'ledger-finalize-check',
  outDir: resolveOutDir('ledger-finalize-check'),
  plannedCases: ['①', '②', '③', '④'],
  minChecks: 20,
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}
const observe = (id, detail) => judge.observe(id, detail)

const workRoot = mkdtempSync(join(tmpdir(), 'wxmp-ledger-finalize-'))
const readLedger = (p) => JSON.parse(readFileSync(p, 'utf8'))
const phasesOf = (p) => readLedger(p).phases || []

/** 用**真正的新进程**重读同一份账本、跑同一套历史门槛；返回它自报的结果 */
function runChild(ledgerPath, { resume = null } = {}) {
  const args = [childScript, ledgerPath]
  if (resume) args.push('--resume', resume)
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 })
  if (r.status !== 0) return { spawnError: `exit=${r.status} stderr=${String(r.stderr || '').slice(0, 300)}` }
  try {
    return JSON.parse(String(r.stdout || '').trim().split('\n').pop())
  } catch (e) {
    return { spawnError: `无法解析子进程输出：${String((e && e.message) || e)}；stdout=${String(r.stdout || '').slice(0, 200)}` }
  }
}

const mkLedger = (tag, budget = { maxDispatches: 5, maxGenSvg: 2 }) => {
  const p = join(workRoot, `${tag}.json`)
  const b = createBudget({ ledgerPath: p, ...budget })
  return { path: p, budget: b }
}

// =====================================================================================
console.log('\n[① B1：业务失败标记与 phase 终结是**同一次原子写**；写失败就保持未闭合]')
{
  const { path: ledgerPath, budget } = mkLedger('c1')
  check('① 账本打开、phase 开始记录落盘', budget.open().ok === true && budget.beginPhase({ name: 'L1', note: 'B1 复现' }).ok === true)
  check('① 前置：这个 phase 真的派发过一次（所以"没跑完"是有代价的）', budget.reserve('prep_turn').ok === true)

  // 注入：终结那次（也是唯一一次）账本写入失败——复刻复核探针的"临时把账本置为只读"。
  chmodSync(ledgerPath, 0o444)
  const res = finalizePhase({
    budget,
    phase: 'L1',
    failedChecks: [{ id: 'L1-事实缺失' }, { id: 'L1-素材缺位' }],
    errorCount: 1,
    checks: { passed: 3, total: 5 },
  })
  chmodSync(ledgerPath, 0o666)

  check('① 终结写失败 → `closed=false`（不假装闭合）', res.closed === false, JSON.stringify({ closed: res.closed, outcome: res.outcome }))
  check('① 终结写失败 → 业务失败标记**没有**持久（不是"内存里说失败"）', res.failurePersisted === false, `failurePersisted=${res.failurePersisted}`)
  check('① 写失败被上抛成调用方必须处理的错误', res.errors.length >= 1 && /终结记录没有落盘/.test(res.errors.join(' ')), JSON.stringify(res.errors))

  const after = phasesOf(ledgerPath)
  check('① 盘上这条 phase **仍是未闭合**（复核反例的形状是"闭着、说 error、没有失败标记"）', after.some((p) => p.open === true) && !after.some((p) => p.open !== true && p.outcome === 'error'), JSON.stringify(after.map((p) => ({ open: p.open, outcome: p.outcome, businessFailure: p.businessFailure }))))

  // 真正的新进程：未经核对
  const c1 = runChild(ledgerPath)
  check('① 新子进程（无核对）读到未闭合记录', !c1.spawnError && c1.unresolved !== null && c1.unresolved.phase === 'L1', JSON.stringify(c1.unresolved || c1.spawnError))
  check('① 新子进程被门槛拦下（gateBlock 非空）', !c1.spawnError && typeof c1.gateBlock === 'string' && c1.gateBlock.length > 0, String(c1.gateBlock || '').slice(0, 120))
  check('① **新子进程的假传输为 0**（这才是复核要的"未经显式核对不得继续"）', !c1.spawnError && c1.transported === 0 && c1.phaseOpened === false, JSON.stringify({ transported: c1.transported, phaseOpened: c1.phaseOpened }))

  // 人工核对之后才允许继续；闭合要留理由、不返还额度、不清零累计
  const c2 = runChild(ledgerPath, { resume: '已核对：那一次只派发了 1 次 prep_turn，无绘图' })
  check('① 显式核对后子进程可以继续（不是"永远锁死"）', !c2.spawnError && c2.transported === 1, JSON.stringify({ transported: c2.transported, reason: c2.reserveReason || c2.gateBlock }))
  const led1 = readLedger(ledgerPath)
  check('① 核对闭合留了理由（可追溯）', led1.phases.some((p) => p.outcome === 'resolved-after-review' && /已核对/.test(String(p.closeNote))), JSON.stringify(led1.phases.map((p) => p.outcome)))
  check('① 核对闭合的是**原来那条**记录（不删历史、不新建替换）', led1.phases.some((p) => p.phase === 'L1' && p.outcome === 'resolved-after-review'), JSON.stringify(led1.phases.map((p) => ({ phase: p.phase, outcome: p.outcome }))))
  check('① 核对**不返还额度、不清零累计**（2 次派发都还在账上）', led1.totals.dispatches === 2 && led1.totals.genSvg === 0, JSON.stringify(led1.totals))

  // 对照：把复核当时那套**两写**顺序原样演一遍，必须复现出"闭着、说 error、却没有失败标记"的那条。
  const { path: oldPath, budget: ob } = mkLedger('c1-old')
  ob.open()
  ob.beginPhase({ name: 'L1', note: '旧顺序对照' })
  ob.reserve('prep_turn')
  chmodSync(oldPath, 0o444)
  const barrier = ob.recordPhase({ dispatches: 0, genSvg: 0, note: '业务失败屏障', extra: { phase: 'L1', businessFailure: true } })
  chmodSync(oldPath, 0o666)
  const closedOld = ob.closePhase({ outcome: 'error', note: '旧顺序：先屏障、后闭合' })
  const oldRec = phasesOf(oldPath).find((p) => p.outcome === 'error')
  check('① 对照：旧顺序下屏障那次写确实失败了', barrier.ok === false, barrier.reason || '')
  check('① 对照：旧顺序下 phase 关闭**成功**了', closedOld.ok === true, closedOld.reason || '')
  check('① 对照：盘上确实是"闭着 + outcome=error + **没有** businessFailure"（被修掉的那条）', oldRec && oldRec.open !== true && oldRec.outcome === 'error' && !oldRec.businessFailure, JSON.stringify(oldRec && { open: oldRec.open, outcome: oldRec.outcome, businessFailure: oldRec.businessFailure }))
  // 第二层兜底：即便历史/旧实现留下了这种条目，`priorBusinessFailure()` 也要认得出它是失败。
  const ob2 = createBudget({ ledgerPath: oldPath })
  ob2.open()
  const pri = ob2.priorBusinessFailure()
  check('① 兜底：新版 `priorBusinessFailure()` 也认 `outcome=error` 的旧条目（via=outcome）', pri !== null && pri.via === 'outcome', JSON.stringify(pri))
}

// =====================================================================================
console.log('\n[② B2：必需证据先落盘、账本后闭合——证据写失败绝不能把账本留成 pass]')
{
  const { path: ledgerPath, budget } = mkLedger('c2')
  budget.open()
  budget.beginPhase({ name: 'L2', note: 'B2 复现' })
  budget.reserve('chat_stream')

  // 与驱动同口径的最小替身：落盘错误并回判定对象（生产的那一段在 live-acceptance.ts 里，由 ④ 组钉住）。
  const evidDir = join(workRoot, 'c2-evidence')
  mkdirSync(join(evidDir, 'report.md'), { recursive: true }) // 文件名被目录占住 → 写 report.md 必然失败
  const runObj = { status: 'PASS', errors: [], blockedReason: null, checks: [{ id: 'L2-x', pass: true }] }
  const persistOnce = () => {
    const baseErrors = runObj.errors.slice()
    return persistRunResult({
      dir: evidDir,
      files: { 'report.md': '# report\n', 'evidence.json': '{}\n' },
      verdict: (errors) => {
        runObj.errors = baseErrors.concat(errors.map((e) => ({ stage: 'persist', message: `写 ${e.file} 失败：${e.message}` })))
        runObj.status = runObj.errors.length ? 'ERROR' : 'PASS'
        return runObj
      },
    })
  }

  // **生产顺序**：先证据、后账本、再重写证据
  const seq = runFinalizeSequence({
    persist: persistOnce,
    finalize: () =>
      finalizePhase({
        budget,
        phase: 'L2',
        failedChecks: [],
        errorCount: runObj.errors.length,
        checks: { passed: 1, total: 1 },
      }),
  })

  check('② 第一次落盘确实失败了（注入生效，否则下面不算数）', seq.first.ok === false && seq.first.errors.length >= 1, JSON.stringify(seq.first.errors))
  check('② 判定被降级为 ERROR（不是 PASS）', runObj.status === 'ERROR', runObj.status)
  const rec2 = phasesOf(ledgerPath).find((p) => p.phase === 'L2')
  check('② 账本里**没有**留下 pass（复核反例 B2 的形状）', rec2 && rec2.outcome !== 'pass', JSON.stringify(rec2 && { outcome: rec2.outcome, businessFailure: rec2.businessFailure }))
  check('② 账本记的是 error + 业务失败标记（下一次未经核对不得继续）', rec2 && rec2.outcome === 'error' && rec2.businessFailure === true, JSON.stringify(rec2 && { outcome: rec2.outcome, businessFailure: rec2.businessFailure }))
  check('② 账本必须闭合（证据写失败是"已知道的失败"，不是"不知道发生了什么"）', rec2 && rec2.open !== true, JSON.stringify(rec2 && { open: rec2.open }))

  const c = runChild(ledgerPath)
  check('② 新子进程读到业务失败标记并拒绝继续', !c.spawnError && c.priorFailure !== null && typeof c.gateBlock === 'string', JSON.stringify(c.priorFailure || c.spawnError))
  check('② **新子进程的假传输为 0**', !c.spawnError && c.transported === 0, JSON.stringify({ transported: c.transported, phaseOpened: c.phaseOpened }))

  // 对照：旧顺序（先闭合、后写证据）——账本已经是 pass，子进程照常继续花钱。
  const { path: oldPath, budget: ob } = mkLedger('c2-old')
  ob.open()
  ob.beginPhase({ name: 'L2', note: '旧顺序对照' })
  ob.reserve('chat_stream')
  const closedPass = ob.closePhase({ outcome: 'pass', note: '旧顺序：证据还没写就先记 pass' })
  const oldRec = phasesOf(oldPath).find((p) => p.phase === 'L2')
  check('② 对照：旧顺序把账本记成了 pass（证据此刻还没写出去）', closedPass.ok === true && oldRec.outcome === 'pass', JSON.stringify(oldRec && { outcome: oldRec.outcome }))
  const cOld = runChild(oldPath)
  check('② 对照：这份账本下新子进程**照常预留**（transported=1）——这就是被修掉的后果', !cOld.spawnError && cOld.transported === 1 && cOld.gateBlock === null, JSON.stringify({ transported: cOld.transported, gateBlock: cOld.gateBlock }))
  observe(
    '② 对照的读法',
    '左侧（修后）账本 outcome=error+businessFailure → 子进程 0 派发；右侧（旧顺序）账本 outcome=pass → 子进程照常派发。' +
      '两者唯一的差别就是"账本闭合发生在必需证据落盘之前还是之后"。',
  )
}

// =====================================================================================
console.log('\n[③ 正常对照：全通过 → 账本干净闭合，下一个进程能正常继续]')
{
  const { path: ledgerPath, budget } = mkLedger('c3')
  const evidDir = join(workRoot, 'c3-evidence')
  const runObj = { status: 'PASS', errors: [], blockedReason: null, checks: [{ id: 'L1-x', pass: true }] }
  const persistOnce = () => {
    const baseErrors = runObj.errors.slice()
    return persistRunResult({
      dir: evidDir,
      files: { 'report.md': '# report\n', 'evidence.json': '{}\n' },
      verdict: (errors) => {
        runObj.errors = baseErrors.concat(errors.map((e) => ({ stage: 'persist', message: `写 ${e.file} 失败：${e.message}` })))
        runObj.status = runObj.errors.length ? 'ERROR' : 'PASS'
        return runObj
      },
    })
  }
  budget.open()
  budget.beginPhase({ name: 'L1', note: '正常对照' })
  budget.reserve('prep_turn')
  const seq = runFinalizeSequence({
    persist: persistOnce,
    finalize: () => finalizePhase({ budget, phase: 'L1', failedChecks: [], errorCount: runObj.errors.length, checks: { passed: 1, total: 1 } }),
  })
  check('③ 证据与判定文件都写成了', seq.first.ok === true && seq.final.ok === true, JSON.stringify(seq.first.errors))
  const rec = phasesOf(ledgerPath).find((p) => p.phase === 'L1')
  check('③ 账本闭合为 pass 且**没有**业务失败标记', rec && rec.open !== true && rec.outcome === 'pass' && !rec.businessFailure, JSON.stringify(rec && { open: rec.open, outcome: rec.outcome, businessFailure: rec.businessFailure }))
  const c = runChild(ledgerPath)
  check('③ 新子进程没有被拦（这是"正常成功能继续"的正对照）', !c.spawnError && c.gateBlock === null && c.unresolved === null && c.priorFailure === null, JSON.stringify({ gateBlock: c.gateBlock, unresolved: c.unresolved, priorFailure: c.priorFailure }))
  check('③ 新子进程正常派发 1 次', !c.spawnError && c.transported === 1, JSON.stringify({ transported: c.transported }))
  const led = readLedger(ledgerPath)
  check('③ 累计额度继续累加（不清零、不返还）', led.totals.dispatches === 2, JSON.stringify(led.totals))
}

// =====================================================================================
console.log('\n[④ 结构断言：驱动必须真的接住这套生产实现，而不是各写一份]')
{
  const src = readFileSync(join(repoRoot, 'scripts', 'live-acceptance.mjs'), 'utf8')
  check('④ live-acceptance 导入生产收尾模块（不再内联一份终结逻辑）', /from '\.\/lib\/ledger-finalize\.mjs'/.test(src) && /finalizePhase/.test(src) && /runFinalizeSequence/.test(src) && /preflightLedgerGate/.test(src), '')
  check('④ 收尾顺序由生产序列函数驱动（persist → finalize → persist）', /runFinalizeSequence\(\{\s*persist: persistOnce,\s*finalize: finalizeLedger\s*\}\)/.test(src), '')
  check('④ `finalizeLedger()` 不再被单独裸调用（否则又变成"先闭合、后写证据"）', (src.match(/^\s*finalizeLedger\(\)\s*$/gm) || []).length === 0, JSON.stringify((src.match(/^\s*finalizeLedger\(\)\s*$/gm) || []).length))
  check('④ 启动阶段的两道历史门槛走同一个生产函数', /preflightLedgerGate\(\{ budget, needsPaid \}\)/.test(src), '')
  check('④ 业务失败屏障不再由驱动侧单独写一次（只剩 finalizePhase 里的那一次原子写）', !/extra: \{ phase, businessFailure: true/.test(src), '')
  check('④ 账本收尾结果进了证据（outcome/closed/failurePersisted 可核对）', /evidence\.ledgerFinalize = \{/.test(src), '')
  const lib = readFileSync(join(repoRoot, 'scripts', 'lib', 'ledger-finalize.mjs'), 'utf8')
  check('④ 生产模块里"屏障与终结同一次写"确实是一条 closePhase 调用', /businessFailure: true, failedChecks: failedIds/.test(lib) && !/recordPhase\(\{[\s\S]{0,400}businessFailure[\s\S]{0,400}\}\)\s*\n\s*if \(state\.phaseOpen\)/.test(lib), '')
  const child = readFileSync(childScript, 'utf8')
  check('④ 子进程夹具用的是同一套生产门槛与真实预算写者', /preflightLedgerGate/.test(child) && /createBudget/.test(child) && /budget\.reserve\('prep_turn'\)/.test(child), '')
}

judge.observe('工作目录', `${workRoot}（全为假传输：未联网、未启动应用、未调用模型；账本均为本目录下的隔离路径）`)
judge.observe('子进程', `真新进程：${childScript}（复核要求"不冒充新 OS 进程"，故用 spawnSync 另起 node）`)
console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'LEDGER-FINALIZE' })
