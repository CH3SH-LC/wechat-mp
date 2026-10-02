// Read-only source extraction; all app/IPC/filesystem collaborators are inert mocks.
// Does not import or execute live-acceptance.mjs, launch a process, or call a model.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repo = resolve(scriptDir, '../../../..')
const args = process.argv.slice(2)
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--out' && args[1] && !args[1].startsWith('--')), 'Usage: node probe.mjs [--out <new-output-directory>]')
const out = args.length ? resolve(args[1]) : mkdtempSync(join(tmpdir(), 'wxmp-live-runner-offline-probe-'))
const resultPath = join(out, 'result.json')
assert.ok(!existsSync(resultPath), `Refusing to overwrite existing evidence: ${resultPath}`)
mkdirSync(out, { recursive: true })
const path = join(repo, 'scripts/live-acceptance.mjs')
const source = readFileSync(path, 'utf8')
const snippets = []
function extract(start, end) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a, `Extraction anchors exist: ${start}`)
  const text = source.slice(a, b)
  snippets.push({ start, firstLine: source.slice(0, a).split('\n').length, sha256: createHash('sha256').update(text).digest('hex') })
  return text
}
function bind(text, name, env) {
  return new Function(...Object.keys(env), `${text}\nreturn ${name}`)(...Object.values(env))
}
const findings = []

// 1. The exact shipped invoke wrapper observes, but never denies, model calls.
const pageCode = extract('const SRC_COMMON = [', '/** 在页面里执行 PAGE_SRC')
const PAGE_SRC = bind(pageCode, 'PAGE_SRC', {})
let forwarded = 0
const window = { __TAURI_INTERNALS__: { invoke() { forwarded++; return Promise.resolve(null) } } }
new Function('window', PAGE_SRC.installProbe)(window)
for (let i = 0; i < 21; i++) await window.__TAURI_INTERNALS__.invoke('chat_stream', {})
assert.equal(forwarded, 21)
assert.equal(window.__acceptanceProbe.model.length, 21)
findings.push({ id: 'invoke-probe-has-no-dispatch-gate', reproduced: true, observed: { forwarded, counted: window.__acceptanceProbe.model.length }, limitation: 'Synthetic IPC only; no real request or cost.' })

// 2. Exact sendTurn sees over-budget dispatches only after they have occurred.
const sendCode = extract('async function sendTurn(', '/** 发消息前的准备')
let reads = 0
let stops = 0
const evidence = { turns: [] }
const state = (dispatch) => ({ msgs: dispatch ? 2 : 1, busy: true, dispatch, genSvg: 0, workPhase: 'prep', lastAssistantLen: 0 })
const sendTurn = bind(sendCode, 'sendTurn', {
  phase: 'L1', evidence, TURN_TIMEOUT_MS: 600000,
  pageFn: async () => state(reads++ === 0 ? 0 : 21),
  clickStop: async () => { stops++; return true },
})
const fakePage = { locator: () => ({ fill: async () => {}, press: async () => {} }), waitForTimeout: async () => {} }
const turn = await sendTurn(fakePage, 'synthetic', { maxDispatches: 20, maxGenSvg: 4 })
assert.equal(turn.dispatchAfter, 21)
assert.equal(stops, 1)
assert.ok(turn.aborted)
findings.push({ id: 'watchdog-post-dispatch-only', reproduced: true, observed: { dispatchAfter: turn.dispatchAfter, stops, aborted: turn.aborted }, limitation: 'A deterministic state sequence proves ordering, not frequency of overshoot in real use.' })

// 3. Launch checks fail, yet exact runL1 reaches sendTurn.
const launchCode = extract('async function verifyLaunch(', '/** 真实工作区清单差异')
const checks = []
const real = resolve('synthetic-real-workspace')
const verifyLaunch = bind(launchCode, 'verifyLaunch', {
  isPidAlive: () => false,
  check: (id, pass) => { checks.push({ id, pass: Boolean(pass) }); return Boolean(pass) },
  idTag: () => 'L1:', resolve, realWorkspaceDir: () => real,
  appSessions: async () => ({ ok: true, value: { current: 'existing', items: [{ id: 'existing' }, { id: 'other' }] } }),
  appDocs: async () => ({ ok: true, value: { items: [{ id: 'existing' }] } }),
  appSession: async () => ({ ok: true, value: { messages: ['existing message'] } }),
  evidence: { launchReadbacks: [] }, block: () => { throw new Error('unexpected block') },
})
const app = { launch: { pid: 123, exeHash: 'a'.repeat(64) }, rec: { cdpPages: [{ url: 'https://foreign.test', hasDebugger: true }] }, cdpPort: 9999, page: {} }
const ctx = { iso: { workspace: real } }
let sendReached = false
const sentinel = new Error('synthetic stop before actual send')
const l1Code = extract('async function runL1(', '// ---------- L2 / L4')
const runL1 = bind(l1Code, 'runL1', {
  verifyLaunch, hashInventory: () => ({}), realWorkspaceDir: () => real,
  gotoChat: async () => {}, PROMPTS: { L1: 'synthetic' },
  sendTurn: async () => { sendReached = true; throw sentinel },
})
try { await runL1(ctx, app, {}) } catch (e) { assert.equal(e, sentinel) }
assert.ok(sendReached)
assert.equal(checks.filter(c => !c.pass).length, 4)
findings.push({ id: 'launch-failed-checks-still-reach-sendTurn', reproduced: true, observed: { sendReached, failedChecks: checks.filter(c => !c.pass) }, limitation: 'Mock PID/readbacks/path only; no application started.' })

// 4. Invalid ledger silently starts a new zero-total ledger; raised CLI values are accepted.
const ledgerCode = extract('function loadLedger()', 'const remaining =')
const loadLedger = bind(ledgerCode, 'loadLedger', { readJson: () => ({ schema: 999, totals: { dispatches: 19, genSvg: 4 } }), ledgerPath: 'unused', root: 'unused', MAX_DISPATCHES: 200, MAX_GEN_SVG: 40 })
const ledger = loadLedger()
assert.deepEqual(ledger.totals, { dispatches: 0, genSvg: 0 })
assert.deepEqual(ledger.budget, { maxDispatches: 200, maxGenSvg: 40 })
findings.push({ id: 'invalid-ledger-resets-and-no-absolute-cap', reproduced: true, observed: { totals: ledger.totals, budget: ledger.budget }, limitation: 'Injected ledger read; does not alter a real ledger.' })

// 5. Missing trace directory omits requests; exact reconcile throws before accounting.
const traceCode = extract('function traceRecordsSince(', '/** 请求证据摘要')
const traceRecordsSince = bind(traceCode, 'traceRecordsSince', { join, readdirSync: () => { throw new Error('synthetic ENOENT') } })
const traceInfo = traceRecordsSince('unused', 0)
assert.equal(traceInfo.requests, undefined)
const reconcileCode = extract('function reconcile(', '// ---------- L1')
const reconcile = bind(reconcileCode, 'reconcile', {})
let reconcileError
try { reconcile({}, { dispatchAfter: 1, genSvgAfter: 0 }, traceInfo, {}) } catch (e) { reconcileError = String(e) }
assert.match(reconcileError, /length/)
findings.push({ id: 'missing-trace-causes-reconcile-before-ledger-error', reproduced: true, observed: { traceInfo, reconcileError }, limitation: 'Synthetic missing directory only.' })

// 6. Exact acceptance fact validator has false-green and false-red cases.
const factsCode = extract('const norm = (s)', 'const idTag = () =>')
const factChecks = bind(factsCode, 'factChecks', { idTag: () => 'L1:', clip: (s, n) => String(s).slice(0, n) })
function facts(bodyText) {
  return factChecks({ bodyText, firstHeadingText: '校园图书馆开放通知', bodyChars: bodyText.replace(/\s/g, '').length, counted: bodyText.replace(/\s/g, '') }, '校园图书馆开放通知', { expectTitle: '校园图书馆开放通知', limit180: 180 })
}
const badHour = '2026年10月10日周六19:00–17:00开放。10月11日周日全天闭馆。自习区在一楼。咨询电话010-55556666。'
const badCalendar = '2025年10月10日周一9:00–17:00开放。10月11日周二全天闭馆。自习区在一楼。咨询电话010-55556666。'
const validComma = '2026年10月10日周六，9:00–17:00开放。10月11日周日，全天闭馆。自习区在一楼。咨询电话010-55556666。'
const factCases = [
  { id: 'nineteen-recognized-as-nine', input: badHour, checks: facts(badHour) },
  { id: 'wrong-year-and-weekdays-accepted', input: badCalendar, checks: facts(badCalendar) },
  { id: 'valid-comma-punctuation-rejected', input: validComma, checks: facts(validComma) },
]
assert.ok(factCases[0].checks.every(c => c.pass))
assert.ok(factCases[1].checks.every(c => c.pass))
assert.equal(factCases[2].checks.filter(c => !c.pass).length, 2)
findings.push({ id: 'acceptance-fact-validator-misclassification', reproduced: true, observed: factCases, limitation: 'Acceptance-script validator only; this does not test product delivery-quality logic.' })

const result = {
  kind: 'offline-source-extraction-audit', createdAt: new Date().toISOString(),
  outputDirectory: out,
  source: { path, sha256: createHash('sha256').update(source).digest('hex') },
  execution: { modelCalls: 0, applicationLaunches: 0, processKills: 0, productOrRunnerEdits: 0 },
  findings, snippets,
}
writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify(result, null, 2))
