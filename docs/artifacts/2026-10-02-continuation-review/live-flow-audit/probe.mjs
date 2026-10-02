// Independent, zero-model review. Extracts current driver functions without running its entrypoint.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { factChecks, SAMPLE_OK_BODY } from '../../../../scripts/lib/fact-assert.mjs'
import { canReopenAfterClose, compareDispatchEvidence, summarizeRequests } from '../../../../scripts/lib/trace-read.mjs'

const src = readFileSync(new URL('../../../../scripts/live-acceptance.mjs', import.meta.url), 'utf8')
const out = { boundary: 'No application, browser, model, credentials, or production ledger used.', cases: [] }
out.sourceFingerprints = Object.fromEntries(['live-acceptance.mjs', 'lib/fact-assert.mjs', 'lib/trace-read.mjs', 'live-driver-check.mjs', 'fact-assert-check.mjs'].map(rel => [rel, createHash('sha256').update(readFileSync(new URL('../../../../scripts/' + rel, import.meta.url))).digest('hex')]))
const record = (id, expected, actual, detail) => out.cases.push({ id, expected, actual, discrepancy: expected !== actual, detail })
const extract = (start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)))
const title = '校园图书馆开放通知'
const facts = (body) => factChecks({ bodyText: body, firstHeadingText: title, bodyChars: body.replace(/\s+/g, '').length, counted: body.replace(/\s+/g, '') }, title, { expectTitle: title, limit180: 180 })
const factCase = (id, body, expected) => {
  const results = facts(body)
  record(id, expected, results.every(x => x.pass), { body, failed: results.filter(x => !x.pass) })
}
factCase('facts-positive-control', SAMPLE_OK_BODY, true)
factCase('facts-end-time-borrowed-from-unrelated-sentence', SAMPLE_OK_BODY.replace('17:00', '16:00') + '咨询服务于17:00结束。', false)
factCase('facts-negated-floor', SAMPLE_OK_BODY.replace('自习区在一楼', '自习区不在一楼'), false)
factCase('facts-negated-closure', SAMPLE_OK_BODY.replace('全天闭馆', '全天不闭馆'), false)
factCase('facts-wrong-ISO-year', SAMPLE_OK_BODY.replace('2026年10月10日', '2025-10-10'), false)
factCase('facts-valid-compact-prose', '10月10日9:00–17:00开放；10月11日全天闭馆。自习区在一楼，电话010-55556666。', true)

const reconciles = extract('function reconcile(', '// ---------- L1 ----------')
const traceInfo = { observable: true, requests: [{ phase: 'prep', startedAt: 1 }, { phase: 'chat', startedAt: 2 }], files: [], dirExists: true }
const checks = []
const context = vm.createContext({ compareDispatchEvidence, summarizeRequests, phase: 'L2', idTag: () => 'L2 ', check: (id, pass, ev) => checks.push({ id, pass, ev }), fail: () => {}, observe: () => {}, clip: s => s })
vm.runInContext(reconciles, context)
const recon = context.reconcile({ recordPhase: () => {}, remaining: () => ({ dispatches: 18, genSvg: 4 }) }, { dispatchAfter: 2, genSvgAfter: 0, transportAfter: 2, refusals: [], ended: 'idle' }, traceInfo, {})
record('driver-L2-production-reconcile-wiring', true, recon.dispatchProblems.length === 0, { recon, checks })
const under = compareDispatchEvidence({ reserved: 2, reservedGenSvg: 0, transport: 2, genSvgTransport: 0, traceRequests: 0, traceGenSvg: 0, traceObservable: true })
record('trace-visible-empty-despite-two-transports', false, under.ok, under)
const drawBypass = compareDispatchEvidence({ reserved: 1, reservedGenSvg: 0, transport: 1, genSvgTransport: 0, traceRequests: 1, traceGenSvg: 1, traceObservable: true })
record('trace-draw-without-draw-reservation', false, drawBypass.ok, drawBypass)

const closeSnippet = extract('  const close = async () => {', '  log(`  [启动]')
const mine = { pid: 123, closed: false }
const closeContext = vm.createContext({ mine, closeOwnPid: async () => ({ closed: false, forced: true, via: 'fake-failed-close' }), exe: 'FAKE', rec: {}, sink: {} })
vm.runInContext(closeSnippet + '\nglobalThis.extractedClose = close', closeContext)
const closeResult = await closeContext.extractedClose()
record('driver-failed-close-must-stay-open-for-cleanup', false, mine.closed, { closeResult, mine, finallySkipsThisHandle: mine.closed })
const alreadyGone = canReopenAfterClose({ closed: true, forced: false, via: 'already-exited' })
record('driver-already-exited-does-not-prove-normal-shutdown', false, alreadyGone.ok, alreadyGone)

for (const validIdentity of [false, true]) {
  const gates = []
  const blocks = []
  const ctx = vm.createContext({
    procIdentity: () => ({ alive: true, matchesExpected: validIdentity }), exe: 'FAKE', idTag: () => 'L1 ',
    existsSync: () => true, readdirSync: () => ['PREEXISTING-ITEM'], resolve, realWorkspaceDir: () => 'C:/real-ws',
    appSessions: async () => ({ ok: true, value: { current: 'd1', items: [{ id: 'd1' }] } }),
    appDocs: async () => ({ ok: true, value: { items: [] } }), appSession: async () => ({ value: { messages: [] } }),
    evidence: {}, check: (id, pass) => gates.push({ id, pass }), block: (stage, message) => blocks.push({ stage, message })
  })
  vm.runInContext(extract('async function verifyLaunch(', '/** 真实工作区清单差异'), ctx)
  const launchRead = await ctx.verifyLaunch({ launch: { pid: 1, exeHash: 'a'.repeat(64) }, rec: { cdpPages: [{ hasDebugger: true, url: 'http://tauri.localhost' }] }, page: { url: () => 'http://tauri.localhost' }, cdpPort: 1234 }, { iso: { workspace: 'C:/fake-ws', webview: 'C:/fake-webview' } }, { expectEmpty: true })
  record(validIdentity ? 'launch-ordinary-positive-control' : 'launch-invalid-identity-now-blocks', validIdentity, launchRead !== null, { gates, blocks, inputFilesWereOnlyPreexistingStrings: true })
}

const failedBaseline = { ok: false, phase: 'L1', at: '2026-10-02T00:00:00Z', revisionId: 'r1', sourceHash: 's', htmlHash: 'h', bindingsHash: 'b', snapshotsHash: 'ss' }
const baselineContext = vm.createContext({ loadBaselines: () => ({ latest: null, byPhase: { L1: failedBaseline } }) })
vm.runInContext(extract('function latestBaseline()', '// ====================================================================================='), baselineContext)
const baseline = baselineContext.latestBaseline()
record('driver-no-successful-baseline-must-return-null', true, baseline === null, baseline)

let sends = 0
const l3Context = vm.createContext({
  latestBaseline: () => ({ docId: 'doc-1' }), verifyLaunch: async () => ({ cur: 'doc-1' }), hashInventory: () => ({}), realWorkspaceDir: () => 'FAKE',
  gotoChat: async () => {}, waitDocReady: async () => {}, snapshot: async () => ({}), sendTurn: async () => { sends++; return {} },
  readTraceRecords: () => ({}), reconcile: () => ({}), PROMPTS: { L3: 'fake' }, block: () => {}
})
vm.runInContext(extract('async function runL3(', '// ---------- L5 ----------'), l3Context)
let l3Error = null
try { await l3Context.runL3({ iso: { workspace: 'FAKE' } }, { page: {} }, {}) } catch (e) { l3Error = e.message }
record('driver-L3-after-send-must-not-reference-undefined-page', null, l3Error, { sends, error: l3Error })

const json = JSON.stringify(out, null, 2) + '\n'
writeFileSync(new URL('probe-result.json', import.meta.url), json)
console.log(JSON.stringify({ output: fileURLToPath(new URL('probe-result.json', import.meta.url)), checks: out.cases.map(x => ({ id: x.id, discrepancy: x.discrepancy, expected: x.expected, actual: x.actual })) }, null, 2))
