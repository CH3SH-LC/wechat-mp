// Read-only product audit; only this new artifact folder and private temp paths are written.
import { readFileSync, writeFileSync, mkdirSync, renameSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createBudget } from '../../../../scripts/lib/dispatch-budget.mjs'
import { persistRunResult } from '../../../../scripts/lib/run-result.mjs'

const out = dirname(fileURLToPath(import.meta.url))
const temp = mkdtempSync(join(tmpdir(), 'wxmp-budget-audit-probe-'))
const source = readFileSync(new URL('../../../../scripts/live-acceptance.mjs', import.meta.url), 'utf8')
const results = { temp, usesRealModels: false, source: 'Current working-tree production modules; VM slices use unmodified function bodies.' }
const bpath = join(temp, 'parallel-ledger.json')
const a = createBudget({ ledgerPath: bpath, mirrorPath: join(temp, 'root-a', 'ledger.json'), maxDispatches: 1, maxGenSvg: 1 })
const b = createBudget({ ledgerPath: bpath, mirrorPath: join(temp, 'root-b', 'ledger.json'), maxDispatches: 1, maxGenSvg: 1 })
const openA = a.open().ok
const openB = b.open().ok
let transported = 0
const reservedA = a.reserve('chat_stream')
if (reservedA.ok) transported++
const reservedB = b.reserve('chat_stream')
if (reservedB.ok) transported++
results.staleWriters = { openA, openB, reservedA, reservedB, transported, disk: JSON.parse(readFileSync(bpath, 'utf8')) }

const npath = join(temp, 'negative-totals.json')
writeFileSync(npath, JSON.stringify({ schema: 1, budget: { maxDispatches: 0, maxGenSvg: 0 }, totals: { dispatches: -1, genSvg: -1 }, phases: [] }))
const n = createBudget({ ledgerPath: npath, maxDispatches: 0, maxGenSvg: 0 })
results.negativeTotals = { opened: n.open(), reserve: n.reserve('gen_svg'), after: n.summary() }

const brokenPhasePath = join(temp, 'broken-phases.json')
writeFileSync(brokenPhasePath, JSON.stringify({ schema: 1, budget: { maxDispatches: 1, maxGenSvg: 1 }, totals: { dispatches: 0, genSvg: 0 }, phases: { businessFailure: true } }))
const malformed = createBudget({ ledgerPath: brokenPhasePath, maxDispatches: 1, maxGenSvg: 1 })
results.malformedPhases = { opened: malformed.open(), priorFailure: malformed.priorBusinessFailure(), reserve: malformed.reserve('chat_stream') }

const ppath = join(temp, 'phase-ledger.json')
const p = createBudget({ ledgerPath: ppath, maxDispatches: 1, maxGenSvg: 1 })
p.open()
renameSync(ppath, `${ppath}.prior`)
mkdirSync(ppath)
results.phasePersistence = { record: p.recordPhase({ dispatches: 0, genSvg: 0, note: 'failed', extra: { businessFailure: true } }), summary: p.summary(), priorBusinessFailure: p.priorBusinessFailure(), lastDurableLedger: JSON.parse(readFileSync(`${ppath}.prior`, 'utf8')) }

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Missing function: ${name}`)
  // These audited top-level functions have a standalone closing brace.
  const end = source.indexOf('\n}', start) + 2
  return source.slice(start, end)
}
const finalDir = join(out, 'live-finalizer-passing-probe')
const run = { script: 'live-acceptance', phase: 'L1', status: 'BLOCKED', executionComplete: true, plannedCases: ['case'], executedCases: ['case'], checks: [{ id: 'case', pass: true, evidence: [] }], errors: [], observations: [], blockedReason: null, startedAt: new Date().toISOString() }
const evidence = { phase: 'L1', ledgerAfter: null, inputFingerprints: {}, isolation: null, launches: [] }
const logs = []
let exitCode = null
const context = { run, evidence, evidenceDir: finalDir, root: temp, phase: 'L1', LOG: logs, persistRunResult, tmpdir, join, ensureDir: (p) => mkdirSync(p, { recursive: true }), finalizeLedger: () => {}, log: (s) => logs.push(s), fail: (stage, message) => run.errors.push({ stage, message }), process: { exit: (code) => { exitCode = code } } }
vm.runInNewContext([functionSource('statusOf'), functionSource('reportMarkdown'), functionSource('finalizeAndExit'), 'finalizeAndExit()'].join('\n'), context)
results.liveFinalizer = { exitCode, returnedStatus: run.status, evidenceMemoryStatus: evidence.status, diskRun: JSON.parse(readFileSync(join(finalDir, 'run-result.json'), 'utf8')), diskEvidence: JSON.parse(readFileSync(join(finalDir, 'evidence.json'), 'utf8')), diskReportStatusLine: readFileSync(join(finalDir, 'report.md'), 'utf8').split('\n').find((s) => s.startsWith('状态：')) }

// Test the exact current installed page gate with fake transport, not a reimplementation.
const probeMatch = source.match(/  installProbe: (\[[\s\S]*?\]\.join\('\\n'\)),/)
if (!probeMatch) throw new Error('installProbe source not found')
const probeSource = vm.runInNewContext(probeMatch[1])
const gatePath = join(temp, 'gate-ledger.json')
const gateBudget = createBudget({ ledgerPath: gatePath, maxDispatches: 1, maxGenSvg: 1 })
gateBudget.open()
let gateTransport = 0
const win = { __TAURI_INTERNALS__: { invoke: async () => { gateTransport++; return 'fake-response' } }, __acceptanceReserve: async (cmd) => gateBudget.reserve(cmd) }
const gateInstalled = vm.runInNewContext(`new Function(${JSON.stringify(probeSource)})()`, { window: win })
const gateResults = await Promise.allSettled([win.__TAURI_INTERNALS__.invoke('chat_stream'), win.__TAURI_INTERNALS__.invoke('gen_svg')])
results.pageGate = { installed: gateInstalled.ok, transported: gateTransport, outcomes: gateResults.map((r) => ({ status: r.status, reason: r.reason ? String(r.reason) : null })), ledger: gateBudget.summary(), probe: win.__acceptanceProbe }

writeFileSync(join(out, 'probe-results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ staleWriters: { actualFakeTransports: transported, cap: 1, persisted: results.staleWriters.disk.totals.dispatches }, negativeTotals: { opened: results.negativeTotals.opened.ok, reservedWithZeroCaps: results.negativeTotals.reserve.ok }, malformedPhases: { opened: results.malformedPhases.opened.ok, priorFailure: results.malformedPhases.priorFailure, reserved: results.malformedPhases.reserve.ok }, phasePersistence: { result: results.phasePersistence.record.ok, persistFailures: results.phasePersistence.summary.persistFailures, diskBusinessFailure: results.phasePersistence.lastDurableLedger.phases.some((x) => x.businessFailure) }, liveFinalizer: { exitCode, runStatus: run.status, reportLine: results.liveFinalizer.diskReportStatusLine, evidenceStatusPresent: Object.hasOwn(results.liveFinalizer.diskEvidence, 'status') }, pageGate: { transported: gateTransport, outcomes: results.pageGate.outcomes } }, null, 2))
