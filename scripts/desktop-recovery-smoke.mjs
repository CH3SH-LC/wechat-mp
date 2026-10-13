// Native-only, zero-model crash recovery verification. Faults target only the
// WebView descendants of the isolated executable launched by this invocation.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { prepareIsolation, launchDesktop, procIdentity, closeOwnPid, hashInventory, diffInventory, realWorkspaceDir } from './lib/desktop-harness.mjs'

const exe = resolve(process.argv[2] || 'src-tauri/target/release/wechat-mp-desktop.exe')
const out = resolve(process.argv[3] || `.local/runs/recovery-${Date.now()}`)
mkdirSync(out, { recursive: true })
const iso = prepareIsolation(`recovery-${Date.now()}`)
const logPath = join(iso.workspace, 'traces', 'desktop-runtime.jsonl')
const report = { status: 'ERROR', exe, isolation: iso, startedAt: new Date().toISOString(), checks: [], faults: [], errors: [] }
const before = hashInventory(realWorkspaceDir())
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const quote = value => "'" + String(value).replaceAll("'", "''") + "'"
const ps = code => execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ${code}`], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim()
const logs = () => existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
function check(name, pass) {
  report.checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  if (!pass) throw new Error(name)
}
async function waitFor(label, predicate, timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) { const value = predicate(); if (value) return value; await pause(350) }
  throw new Error(`Timed out: ${label}`)
}
function views() {
  const list = JSON.parse(ps(`@(Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'" | ForEach-Object { [pscustomobject]@{pid=$_.ProcessId;parent=$_.ParentProcessId;path=$_.ExecutablePath;start=[long]($_.CreationDate.ToUniversalTime()-[datetime]'1970-01-01T00:00:00Z').TotalMilliseconds;type=[regex]::Match($_.CommandLine,'--type=([^ ]+)').Groups[1].Value;isolated=$_.CommandLine.Contains(${quote(iso.webview)})} }) | ConvertTo-Json -Compress`))
  const rows = Array.isArray(list) ? list : list ? [list] : []
  const ids = new Set([ctx.pid])
  for (let changed = true; changed;) {
    changed = false
    for (const row of rows) if (ids.has(row.parent) && !ids.has(row.pid)) { ids.add(row.pid); changed = true }
  }
  return rows.filter(row => ids.has(row.pid))
}
function inject(target) {
  const current = procIdentity(ctx.pid, exe, { expectedStartTime: identity.actualStartTime })
  if (!current.identityComplete || !current.matchesExpected) throw new Error('Isolated host identity changed; refusing fault injection')
  const tree = views()
  const same = tree.find(row => row.pid === target.pid && row.start === target.start && row.path === target.path && row.type === target.type)
  const browser = tree.find(row => row.parent === ctx.pid && row.type === '' && row.isolated)
  if (!same || !browser || (target.pid !== browser.pid && target.parent !== browser.pid)) throw new Error('Isolated WebView ownership unproven; refusing fault injection')
  // Recheck creation time, path, and parent in the same shell as Stop-Process.
  ps(`$v=Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(target.pid)}'; if (!$v -or $v.ExecutablePath -ne ${quote(target.path)} -or $v.ParentProcessId -ne ${Number(target.parent)} -or [long]($v.CreationDate.ToUniversalTime()-[datetime]'1970-01-01T00:00:00Z').TotalMilliseconds -ne ${Number(target.start)}) { throw 'WebView identity changed' }; Stop-Process -Id ${Number(target.pid)} -Force`)
  report.faults.push({ ...target, injectedAt: new Date().toISOString() })
}

let ctx, identity
try {
  ctx = launchDesktop(exe, { profile: iso.profile, webview: iso.webview, isolateCdpEnv: true })
  ctx.child.stdout.on('data', () => {})
  ctx.child.stderr.on('data', () => {})
  identity = await waitFor('host identity', () => { const p = procIdentity(ctx.pid, exe); return p.identityComplete && p.matchesExpected ? p : null })
  report.identity = identity
  await waitFor('initial React mount', () => logs().some(row => row.event === 'frontend-ready'))
  check('React mounted in real desktop WebView', true)
  const renderer = await waitFor('owned renderer', () => views().find(row => row.type === 'renderer'))
  let start = logs().length
  inject(renderer)
  await waitFor('React remount after renderer exit', () => logs().slice(start).some(row => row.event === 'frontend-ready'))
  const renderLog = logs().slice(start)
  check('renderer exit delivered native event and reload', renderLog.some(row => row.event === 'process-failed' && row.kind === 1) && renderLog.some(row => row.event === 'reload-dispatched'))
  check('replacement renderer is running', views().some(row => row.type === 'renderer' && row.pid !== renderer.pid))
  const browser = views().find(row => row.parent === ctx.pid && row.type === '' && row.isolated)
  if (!browser) throw new Error('Owned browser missing')
  start = logs().length
  inject(browser)
  await waitFor('React remount after browser exit', () => logs().slice(start).some(row => row.event === 'frontend-ready' && row.generation >= 2))
  const browserLog = logs().slice(start)
  check('browser exit delivered native event and rebuild', browserLog.some(row => row.event === 'process-failed' && row.kind === 0) && browserLog.some(row => row.event === 'rebuild-finished'))
  check('replacement browser is running', views().some(row => row.parent === ctx.pid && row.type === '' && row.pid !== browser.pid && row.isolated))
  check('same native host survived both faults', procIdentity(ctx.pid, exe, { expectedStartTime: identity.actualStartTime }).matchesExpected === true)
} catch (error) { report.errors.push(error.message); console.error(error.message) }
finally {
  if (ctx?.pid && identity) {
    report.close = await closeOwnPid(ctx.pid, { exe, expectedIdentity: identity })
    report.checks.push({ name: 'isolated host closed normally', pass: report.close.closed && !report.close.forced && !report.close.refused && !report.close.exitedBeforeRequest })
  }
  report.workspaceDiff = diffInventory(before, hashInventory(realWorkspaceDir()))
  report.checks.push({ name: 'real workspace unchanged', pass: ['added', 'removed', 'changed'].every(key => report.workspaceDiff[key].length === 0) })
  report.events = logs()
  report.finishedAt = new Date().toISOString()
  report.status = report.errors.length || report.checks.some(row => !row.pass) || report.checks.length !== 8 ? 'FAIL' : 'PASS'
  writeFileSync(join(out, 'run-result.json'), JSON.stringify(report, null, 2))
  console.log(`${report.status}: ${out}`)
  if (report.status !== 'PASS') process.exitCode = 1
}
