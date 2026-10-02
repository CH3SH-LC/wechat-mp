// Zero-model audit of production modules plus the locked local Tauri IPC source.
import { readFileSync, writeFileSync, mkdirSync, renameSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { createBudget } from '../../../../scripts/lib/dispatch-budget.mjs'
import { persistRunResult } from '../../../../scripts/lib/run-result.mjs'

const out = dirname(fileURLToPath(import.meta.url))
const temp = mkdtempSync(join(tmpdir(), 'wxmp-evening-budget-probe-'))
const livePath = new URL('../../../../scripts/live-acceptance.mjs', import.meta.url)
const source = readFileSync(livePath, 'utf8')
const ipcPath = 'C:/Users/Lenovo/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.11.5/scripts/ipc-protocol.js'
const ipcRaw = readFileSync(ipcPath, 'utf8')
const ipcSource = ipcRaw
  .replaceAll('__TEMPLATE_invoke_key__', JSON.stringify('local-audit-placeholder'))
  .replaceAll('__RAW_process_ipc_message_fn__', 'function (payload) { return {contentType: "application/json", data: JSON.stringify(payload)} }')
  .replaceAll('__TEMPLATE_os_name__', JSON.stringify('windows'))
  .replaceAll('__TEMPLATE_fetch_channel_data_command__', JSON.stringify('plugin:__TAURI_CHANNEL__|fetch'))
const probeMatch = source.match(/  installProbe: (\[[\s\S]*?\]\.join\('\\n'\)),/)
if (!probeMatch) throw new Error('Cannot locate current installProbe')
const probeSource = vm.runInNewContext(probeMatch[1])
const digest = (s) => createHash('sha256').update(s).digest('hex')
const results = { at: new Date().toISOString(), temp, appStarts: 0, realModelRequests: 0, sources: { livePath: fileURLToPath(livePath), liveSha256: digest(source), ipcPath, ipcSha256: digest(ipcRaw) } }

async function exerciseIpc(tag, { cap, failNonPaid = false, hostReject = false, detachFetch = false }, commands) {
  const budget = createBudget({ ledgerPath: join(temp, `${tag}.json`), maxDispatches: cap, maxGenSvg: cap })
  budget.open()
  const callbacks = new Map()
  let callbackId = 0
  let reserveCalls = 0
  let failedFetch = false
  const transports = []
  const warnings = []
  const sandbox = {
    Headers, Response, Promise, Date, JSON,
    console: { warn: (...args) => warnings.push(args.map(String).join(' ')) },
    __TAURI_INTERNALS__: {
      invoke() {},
      convertFileSrc: (cmd) => `http://ipc.localhost/${encodeURIComponent(cmd)}`,
      runCallback: (id, value) => callbacks.get(Number(id))?.(value),
    },
    fetch: async (url, init) => {
      const cmd = decodeURIComponent(String(url).split('/').at(-1))
      if (failNonPaid && cmd === 'list_documents' && !failedFetch) { failedFetch = true; throw new TypeError('injected non-paid IPC fetch failure') }
      transports.push({ via: 'fetch', cmd })
      return new Response(JSON.stringify('fake-result'), { status: 200, headers: { 'Tauri-Response': 'ok', 'content-type': 'application/json' } })
    },
    ipc: { postMessage: (data) => {
      const message = JSON.parse(data)
      transports.push({ via: 'postMessage', cmd: message.cmd, customProtocolIpcBlocked: message.options.customProtocolIpcBlocked })
      sandbox.__TAURI_INTERNALS__.runCallback(message.callback, 'fake-result')
    } },
    __acceptanceReserve: async (cmd) => { reserveCalls++; if (hostReject) throw new Error('injected host bridge rejection'); return budget.reserve(cmd) },
  }
  sandbox.window = sandbox
  const context = vm.createContext(sandbox)
  vm.runInContext(ipcSource, context)
  const rawFetch = sandbox.fetch
  const install = () => vm.runInContext(`new Function(${JSON.stringify(probeSource)})()`, context)
  const installed = install()
  let reinstalled = null
  if (detachFetch) { sandbox.fetch = rawFetch; reinstalled = install() }
  const invoke = (cmd) => new Promise((resolve, reject) => {
    const callback = ++callbackId
    const error = ++callbackId
    callbacks.set(callback, resolve)
    callbacks.set(error, reject)
    sandbox.__TAURI_INTERNALS__.postMessage({ cmd, payload: {}, callback, error })
  })
  const outcomes = []
  for (const cmd of commands) {
    try { await invoke(cmd); outcomes.push({ cmd, status: 'fulfilled' }) }
    catch (e) { outcomes.push({ cmd, status: 'rejected', reason: String(e) }) }
  }
  const paid = (cmd) => ['chat_stream', 'prep_turn', 'gen_svg', 'refine_brief', 'review_assets'].includes(cmd)
  return { installed: installed.ok, reinstalled: reinstalled && { ok: reinstalled.ok, reused: reinstalled.reused }, cap, reserveCalls, paidBackendTransports: transports.filter((x) => paid(x.cmd)).length, transports, outcomes, warnings, ledger: budget.summary(), probe: sandbox.__acceptanceProbe }
}

results.healthyCapOne = await exerciseIpc('healthy', { cap: 1 }, ['prep_turn', 'chat_stream'])
results.directDenial = await exerciseIpc('deny', { cap: 0 }, ['prep_turn'])
results.fallbackAfterNonPaidFailure = await exerciseIpc('fallback', { cap: 0, failNonPaid: true }, ['list_documents', 'prep_turn', 'gen_svg'])
results.hostBridgeRejection = await exerciseIpc('host-reject', { cap: 0, hostReject: true }, ['prep_turn', 'gen_svg'])
results.recheckAfterFetchDetached = await exerciseIpc('detach', { cap: 0, detachFetch: true }, ['prep_turn'])

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Missing function: ${name}`)
  return source.slice(start, source.indexOf('\n}', start) + 2)
}
const failurePath = join(temp, 'failed-barrier.json')
const barrierBudget = createBudget({ ledgerPath: failurePath, maxDispatches: 2, maxGenSvg: 1 })
barrierBudget.open()
renameSync(failurePath, `${failurePath}.prior`)
mkdirSync(failurePath)
const barrierRun = { checks: [{ id: 'business-check', pass: false }], errors: [] }
const barrierEvidence = {}
vm.runInNewContext(`${functionSource('finalizeLedger')}\nfinalizeLedger()`, {
  LEDGER_FINALIZED: false, CTX: { budget: barrierBudget }, run: barrierRun, evidence: barrierEvidence, phase: 'L1',
  fail: (stage, message) => barrierRun.errors.push({ stage, message }), observe() {},
})
// Move only our injected empty obstacle, then restore the unchanged prior ledger to emulate recovery.
renameSync(failurePath, `${failurePath}.obstacle`)
renameSync(`${failurePath}.prior`, failurePath)
const nextBudget = createBudget({ ledgerPath: failurePath })
const opened = nextBudget.open()
results.failedBarrierRestart = { previousRunErrors: barrierRun.errors, persistFailures: barrierBudget.state.persistFailures, reopened: opened.ok, priorBusinessFailure: nextBudget.priorBusinessFailure(), nextReserve: nextBudget.reserve('prep_turn') }

const finalDir = join(out, 'live-finalizer-passing')
const run = { script: 'live-acceptance', phase: 'L1', status: 'BLOCKED', executionComplete: true, plannedCases: ['case'], executedCases: ['case'], checks: [{ id: 'case', pass: true, evidence: [] }], errors: [], observations: [], blockedReason: null, startedAt: new Date().toISOString() }
const evidence = { phase: 'L1', ledgerAfter: null, inputFingerprints: {}, isolation: null, launches: [] }
const logs = []
let exitCode = null
vm.runInNewContext([functionSource('statusOf'), functionSource('reportMarkdown'), functionSource('finalizeAndExit'), 'finalizeAndExit()'].join('\n'), {
  run, evidence, evidenceDir: finalDir, root: temp, phase: 'L1', LOG: logs, persistRunResult, tmpdir, join,
  ensureDir: (p) => mkdirSync(p, { recursive: true }), finalizeLedger() {}, assertNoSecret() {},
  log: (s) => logs.push(s), fail: (stage, message) => run.errors.push({ stage, message }), process: { exit: (code) => { exitCode = code } },
})
results.finalizer = { exitCode, runStatus: JSON.parse(readFileSync(join(finalDir, 'run-result.json'), 'utf8')).status, evidenceStatus: JSON.parse(readFileSync(join(finalDir, 'evidence.json'), 'utf8')).status, reportStatusLine: readFileSync(join(finalDir, 'report.md'), 'utf8').split('\n').find((s) => s.startsWith('状态：')) }
writeFileSync(join(out, 'probe-results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([key, r]) => [key, r?.transports ? { cap: r.cap, reserveCalls: r.reserveCalls, paidBackendTransports: r.paidBackendTransports, transports: r.transports, reinstalled: r.reinstalled } : r])), null, 2))
