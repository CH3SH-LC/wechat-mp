// Bounded real-protocol test of the production 204 response branch.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { createBudget } from '../../../../scripts/lib/dispatch-budget.mjs'
import { installProbeSource, gateCoverageProven } from '../../../../scripts/lib/ipc-gate.mjs'

const protocolPath = 'C:/Users/Lenovo/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.11.5/scripts/ipc-protocol.js'
const raw = readFileSync(protocolPath, 'utf8')
const protocol = raw.replace('__TEMPLATE_invoke_key__', '"audit-key-placeholder"')
  .replace('__RAW_process_ipc_message_fn__', 'function (p) { return {contentType: "application/json", data: JSON.stringify(p)} }')
  .replace('__TEMPLATE_os_name__', '"windows"')
  .replace('__TEMPLATE_fetch_channel_data_command__', '"__tauri_channel_data"')
const temp = mkdtempSync(join(tmpdir(), 'wxmp-ipc-204-'))
const budget = createBudget({ ledgerPath: join(temp, 'budget.json'), maxDispatches: 0, maxGenSvg: 0 })
budget.open()
budget.beginPhase({ name: 'isolated-204-probe' })
let seq = 0
let mode = 'ok'
let reserveCalls = 0
const callbacks = new Map()
const transports = []
const warnings = []
const sandbox = { Response, Headers, TextDecoder, console: { warn: (...xs) => warnings.push(xs.map(String).join(' ')) } }
sandbox.window = sandbox
const T = sandbox.__TAURI_INTERNALS__ = {
  convertFileSrc: (cmd) => `http://ipc.localhost/${cmd}`,
  runCallback: (id, value) => callbacks.get(Number(id))?.(value),
}
sandbox.fetch = async (url) => {
  const cmd = String(url).split('/').at(-1)
  transports.push({ via: 'fetch', cmd, responseStatus: mode === '204-json' ? 204 : 200 })
  if (mode === '204-json') return new Response(null, { status: 204, headers: { 'Tauri-Response': 'ok', 'content-type': 'application/json' } })
  return new Response(JSON.stringify('fake-result'), { status: 200, headers: { 'Tauri-Response': 'ok', 'content-type': 'application/json' } })
}
Object.defineProperty(sandbox, 'ipc', { value: Object.freeze({ postMessage: (body) => {
  const m = JSON.parse(body)
  transports.push({ via: 'postMessage', cmd: m.cmd, customProtocolIpcBlocked: m.options.customProtocolIpcBlocked })
  T.runCallback(m.callback, 'fake-post-result')
} }) })
sandbox.__acceptanceReserve = async (cmd) => { reserveCalls++; return budget.reserve(cmd) }
const context = vm.createContext(sandbox)
vm.runInContext(protocol, context)
T.invoke = (cmd, payload = {}) => new Promise((resolve, reject) => {
  const callback = ++seq, error = ++seq
  callbacks.set(callback, resolve)
  callbacks.set(error, reject)
  T.postMessage({ cmd, payload, callback, error, options: {} })
})
const install = () => vm.runInContext(`new Function('arg', ${JSON.stringify(installProbeSource)})(null)`, context)
const first = await install()
mode = '204-json'
await T.invoke('list_documents')
mode = 'ok'
const recheck = await install()
await T.invoke('prep_turn')
await T.invoke('gen_svg')
const probe = sandbox.__acceptanceProbe
const result = {
  at: new Date().toISOString(), realModelRequests: 0, appStarts: 0, temp,
  protocolPath, protocolSha256: createHash('sha256').update(raw).digest('hex'),
  firstCoverageProven: gateCoverageProven(first),
  recheck: { ok: recheck.ok, reused: recheck.reused, coverageProven: gateCoverageProven(recheck), coverage: recheck.coverage },
  reserveCalls, transports,
  paidBackendTransports: transports.filter((r) => ['prep_turn', 'gen_svg'].includes(r.cmd)).length,
  gateLive: probe.gate.wrappedFetch === sandbox.fetch,
  fallbackLatched: probe.fallbackLatched,
  decodeFailures: probe.decodeFailures,
  ledger: budget.summary(), warnings,
}
writeFileSync(new URL('./ipc-special-response-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
