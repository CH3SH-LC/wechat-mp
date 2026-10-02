// Two bounded integration probes: run the current live finalizer function bodies,
// using only private ledger files and fake run/check data. No app or network.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { createBudget } from '../../../../scripts/lib/dispatch-budget.mjs'
import { persistRunResult } from '../../../../scripts/lib/run-result.mjs'

const out = dirname(fileURLToPath(import.meta.url))
const temp = mkdtempSync(join(tmpdir(), 'wxmp-readiness-finalizer-'))
const livePath = new URL('../../../../scripts/live-acceptance.mjs', import.meta.url)
const source = readFileSync(livePath, 'utf8')
const sha = (s) => createHash('sha256').update(s).digest('hex')
const results = { at: new Date().toISOString(), temp, appStarts: 0, realModelRequests: 0, livePath: fileURLToPath(livePath), liveSha256: sha(source) }
function body(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Missing production function: ${name}`)
  return source.slice(start, source.indexOf('\n}', start) + 2)
}
function fresh(name) {
  const ledgerPath = join(temp, `${name}.json`)
  const budget = createBudget({ ledgerPath, maxDispatches: 5, maxGenSvg: 2 })
  if (!budget.open().ok || !budget.beginPhase({ name: 'L1' }).ok || !budget.reserve('prep_turn').ok) throw new Error('Cannot seed a real isolated phase')
  return { ledgerPath, budget }
}
function runData(pass) {
  return { script: 'live-acceptance', phase: 'L1', status: 'BLOCKED', executionComplete: true, plannedCases: ['L1'], executedCases: ['L1'], checks: [{ id: 'business-check', pass, evidence: [] }], errors: [], observations: [], blockedReason: null, startedAt: new Date().toISOString() }
}
function context(budget, run, evidenceDir) {
  const evidence = { phase: 'L1', ledgerAfter: null, inputFingerprints: {}, isolation: null, launches: [] }
  const capture = { exitCode: null, stdout: [] }
  const sandbox = {
    CTX: { budget }, LEDGER_FINALIZED: false, run, evidence, evidenceDir, root: temp, phase: 'L1', LOG: capture.stdout,
    persistRunResult, tmpdir, join, ensureDir: (p) => mkdirSync(p, { recursive: true }), assertNoSecret() {},
    clip: (s, n) => String(s).slice(0, n),
    fail: (stage, message) => run.errors.push({ stage, message }),
    observe: (id, detail) => run.observations.push({ id, detail }),
    log: (s) => capture.stdout.push(s),
    process: { exit: (code) => { capture.exitCode = code } },
  }
  return { sandbox, evidence, capture }
}
function nextPhase(ledgerPath) {
  const next = createBudget({ ledgerPath })
  const opened = next.open()
  const unresolved = next.unresolvedPhase()
  const businessFailure = next.priorBusinessFailure()
  // Follow the production main decisions, not arbitrary reserve without checks.
  const wouldPassMainHistoryChecks = opened.ok && !unresolved && !businessFailure
  const begin = wouldPassMainHistoryChecks ? next.beginPhase({ name: 'L2' }) : { ok: false, skipped: true }
  const reserve = begin.ok ? next.reserve('prep_turn') : { ok: false, skipped: true }
  return { opened: opened.ok, unresolved, businessFailure, wouldPassMainHistoryChecks, begin, reserve }
}

// Case A: the failed-business record alone cannot be persisted; storage recovers
// before closePhase. Both operations still call the production budget module.
{
  const { ledgerPath, budget } = fresh('business-record-failed')
  const realRecordPhase = budget.recordPhase.bind(budget)
  const failures = []
  budget.recordPhase = (args) => {
    chmodSync(ledgerPath, 0o444)
    try { const result = realRecordPhase(args); failures.push(result); return result }
    finally { chmodSync(ledgerPath, 0o666) }
  }
  const run = runData(false)
  const ctx = context(budget, run, join(out, 'record-failure-output'))
  vm.runInNewContext(body('finalizeLedger') + '\nfinalizeLedger()', ctx.sandbox)
  const diskBeforeRestart = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  results.recordFailsButCloseSucceeds = {
    injectedRecordResults: failures, runErrors: run.errors, phaseOpenInMemory: budget.state.phaseOpen,
    diskBeforeRestart, nextPhase: nextPhase(ledgerPath),
  }
}

// Case B: business checks pass, then a required report fails to persist. The
// finalizer is the production finalizeAndExit + finalizeLedger + status/report.
{
  const { ledgerPath, budget } = fresh('final-report-failed')
  const evidenceDir = join(out, 'final-report-failure-output')
  mkdirSync(join(evidenceDir, 'report.md'), { recursive: true })
  const run = runData(true)
  const ctx = context(budget, run, evidenceDir)
  vm.runInNewContext(['statusOf', 'reportMarkdown', 'finalizeLedger', 'finalizeAndExit'].map(body).join('\n') + '\nfinalizeAndExit()', ctx.sandbox)
  const diskBeforeRestart = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  results.reportFailsAfterPhaseClosed = {
    exitCode: ctx.capture.exitCode, runStatus: run.status, runErrors: run.errors,
    persistedRun: JSON.parse(readFileSync(join(evidenceDir, 'run-result.json'), 'utf8')),
    diskBeforeRestart, nextPhase: nextPhase(ledgerPath),
  }
}

writeFileSync(join(out, 'probe-results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({
  recordFailsButCloseSucceeds: {
    recordOk: results.recordFailsButCloseSucceeds.injectedRecordResults[0]?.ok,
    diskPhase: results.recordFailsButCloseSucceeds.diskBeforeRestart.phases[0],
    next: results.recordFailsButCloseSucceeds.nextPhase,
  },
  reportFailsAfterPhaseClosed: {
    exitCode: results.reportFailsAfterPhaseClosed.exitCode,
    runStatus: results.reportFailsAfterPhaseClosed.runStatus,
    diskPhase: results.reportFailsAfterPhaseClosed.diskBeforeRestart.phases[0],
    next: results.reportFailsAfterPhaseClosed.nextPhase,
  },
}, null, 2))
