// Real Windows desktop UI acceptance. No Vite, separate browser, IPC mock, or model call.
// node scripts/desktop-ui-check.mjs [--exe <exe>] [--out <new evidence directory>]
// VERIFY_PLAYWRIGHT may point to an existing Playwright package; only connectOverCDP is used.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  closeOwnPid, diffInventory, freePort, hashInventory, launchDesktop,
  prepareIsolation, procIdentity, realWorkspaceDir, waitForCdp,
} from './lib/desktop-harness.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const tag = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
const options = { exe: join(repoRoot, 'src-tauri/target/release/wechat-mp-desktop.exe'), out: join(repoRoot, '.local/runs', `desktop-ui-${tag}`) }
const argumentErrors = []
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i]
  if ((flag === '--exe' || flag === '--out') && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) options[flag.slice(2)] = resolve(process.argv[++i])
  else argumentErrors.push(`Unsupported or incomplete argument: ${flag}`)
}
const exe = resolve(options.exe)
const outDir = resolve(options.out)
const run = {
  schemaVersion: 1, script: 'desktop-ui-check', startedAt: new Date().toISOString(),
  status: 'BLOCKED', exe, outDir, exeHash: null, completedTestFlow: false,
  checks: [], errors: [], blockedReasons: [], launches: [], fileReadbacks: [],
  scope: {
    realDesktop: true, browserLaunch: false, vite: false, ipcMock: false,
    realSettingsCopied: false, modelActions: 0,
    covered: ['desktop bridge', 'navigation', 'unsent input across views', 'session creation and rename', 'settings persistence', 'normal exit and reopen'],
    excluded: ['model generation', 'article export', 'WeChat backend', 'installer execution'],
  },
}
let evidenceReady = false
let iso
let active
let realBefore
let playwright
let warmupRetryUsed = false
const handles = []
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const persist = () => {
  if (evidenceReady) writeFileSync(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n', 'utf8')
}
const check = (id, pass, evidence = {}) => {
  run.checks.push({ id, pass: Boolean(pass), evidence })
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${id}`)
  persist()
  return Boolean(pass)
}
class Blocked extends Error {}
class CheckFailed extends Error {}
function requireCheck(id, pass, evidence = {}) {
  if (!check(id, pass, evidence)) throw new CheckFailed(id)
}
async function until(test, description, timeout = 12000) {
  const deadline = Date.now() + timeout
  let lastError
  do {
    try { const value = await test(); if (value) return value } catch (e) { lastError = e.message }
    await delay(100)
  } while (Date.now() < deadline)
  throw new Error(`Timed out: ${description}${lastError ? ` (${lastError})` : ''}`)
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function readback(relativePath) {
  // Callers supply only an ID proven to be a filename; all reads stay in the isolated workspace.
  const path = join(iso.workspace, relativePath)
  const raw = readFileSync(path)
  const value = JSON.parse(raw.toString('utf8'))
  run.fileReadbacks.push({ path, sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length, at: new Date().toISOString() })
  persist()
  return value
}
function sessionPath(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id || '')) throw new Error(`Invalid session filename: ${id}`)
  return join('sessions', `${id}.json`)
}
function normalClose(result) {
  return result.closed === true && result.refused !== true && result.forced !== true && result.exitedBeforeRequest !== true
}
async function closeHandle(handle, reason) {
  if (handle.closed) return handle.record.close
  const result = await closeOwnPid(handle.record.pid, { exe, expectedIdentity: handle.record.identity })
  handle.closed = result.closed === true
  handle.record.close = { ...result, reasonForClose: reason, at: new Date().toISOString() }
  check(`lifecycle.${handle.record.index}.closed-own-pid`, result.closed && !result.refused, handle.record.close)
  check(`lifecycle.${handle.record.index}.normal-exit`, normalClose(result), { forced: result.forced, refused: result.refused, exitedBeforeRequest: result.exitedBeforeRequest, via: result.via })
  // Do not call browser.close(): the application receives WM_CLOSE through closeOwnPid.
  // Closing the native process disconnects its CDP connection without a Browser.close command.
  if (active === handle && handle.closed) active = null
  persist()
  return result
}
async function launchAndConnect(phase) {
  for (;;) {
    if (handles.some((h) => !h.closed)) throw new Blocked('An earlier isolated PID remains alive; refusing a second instance on the same profile.')
    const cdpPort = await freePort()
    const launch = launchDesktop(exe, {
      profile: iso.profile, webview: iso.webview, cdpPort, isolateCdpEnv: true,
      // Override inherited credentials and endpoints; no test action invokes generation.
      extraEnv: { DEEPSEEK_API_KEY: 'desktop-ui-isolated-nonfunctional', DEEPSEEK_BASE_URL: 'http://127.0.0.1:9' },
    })
    const record = {
      index: handles.length + 1, phase, pid: launch.pid, exeHash: launch.exeHash, cdpPort,
      startedAt: new Date(launch.startedAt).toISOString(), identity: procIdentity(launch.pid, exe),
      profile: iso.profile, webview: iso.webview,
      childOutput: { stdoutBytes: 0, stderrBytes: 0 }, cdpReady: false,
    }
    const handle = { record, launch, closed: false, browser: null, page: null }
    active = handle
    handles.push(handle)
    run.launches.push(record)
    run.exeHash ||= launch.exeHash
    launch.child.stdout?.on('data', (chunk) => { record.childOutput.stdoutBytes += chunk.length })
    launch.child.stderr?.on('data', (chunk) => { record.childOutput.stderrBytes += chunk.length })
    launch.child.on('error', (error) => { record.launchError = error.message })
    launch.child.on('exit', (code, signal) => { record.exit = { code, signal, at: new Date().toISOString() } })
    persist()
    if (!record.identity.identityComplete || record.identity.matchesExpected !== true) throw new Blocked('Cannot verify complete identity of the freshly launched desktop process.')
    requireCheck(`lifecycle.${record.index}.same-executable`, launch.exeHash === run.exeHash, { sha256: launch.exeHash })
    try {
      const pages = await waitForCdp(cdpPort, 25000)
      record.cdpPages = pages.map(({ url, type }) => ({ url, type }))
      handle.browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, { timeout: 12000 })
      handle.page = await until(() => handle.browser.contexts().flatMap((c) => c.pages()).find((p) => {
        try { return new URL(p.url()).hostname === 'tauri.localhost' } catch { return false }
      }), 'desktop navigation to tauri.localhost', 15000)
      handle.page.setDefaultTimeout(12000)
      record.cdpReady = true
    } catch (error) {
      record.cdpFailure = String(error.message || error)
      const result = await closeHandle(handle, 'CDP unavailable or desktop readiness failed')
      if (!normalClose(result)) throw new Blocked(`CDP unavailable; the owned PID did not close normally: ${record.cdpFailure}`)
      if (warmupRetryUsed) throw new Blocked(`WebView2 CDP remains unavailable after one isolated-profile restart: ${record.cdpFailure}`)
      warmupRetryUsed = true
      run.warmupRetry = { used: true, sameProfile: iso.profile, reason: record.cdpFailure }
      console.log('CDP unavailable; restarting the same isolated profile once after verified normal exit.')
      persist()
      continue
    }
    // Once CDP is connected, missing UI/bridge is a test failure, not a CDP BLOCKED result.
    handle.page.on('pageerror', (error) => { run.errors.push({ stage: `desktop-page-${record.index}`, message: error.message }); persist() })
    handle.page.on('dialog', async (dialog) => {
      run.errors.push({ stage: 'unexpected-dialog', message: dialog.message() })
      await dialog.dismiss().catch(() => {})
    })
    await handle.page.locator('.topbar').waitFor()
    const bridge = await handle.page.evaluate(() => ({ url: location.href, bridge: typeof window.__TAURI_INTERNALS__?.invoke === 'function' }))
    record.page = bridge
    requireCheck(`desktop.${record.index}.native-bridge-and-origin`, bridge.bridge && new URL(bridge.url).hostname === 'tauri.localhost', bridge)
    await handle.page.locator('.sess-btn[data-ready="1"]').waitFor()
    if (await handle.page.locator('.sess-btn').getAttribute('data-open') !== '1') await handle.page.locator('.sess-btn').click()
    await handle.page.locator('.sess-active').waitFor()
    persist()
    return handle
  }
}
async function openSettings(page) {
  await page.locator('.topbar-settings').click()
  await page.locator('.settings-panel').waitFor()
  await until(() => page.locator('.settings-foot .btn-send').isEnabled(), 'settings read completed')
}
async function closeSettings(page) {
  await page.locator('.settings-head button').click()
  await page.locator('.settings-panel').waitFor({ state: 'detached' })
}

try {
  if (argumentErrors.length) throw new Blocked(argumentErrors.join('; '))
  if (existsSync(outDir) && readdirSync(outDir).length) throw new Blocked('The output directory already contains evidence; use a new --out directory.')
  // prepareIsolation rejects overlaps with the real workspace before creating any directories.
  iso = prepareIsolation(`desktop-ui-${tag}`)
  mkdirSync(outDir, { recursive: true })
  evidenceReady = true
  run.isolation = iso
  persist()
  if (process.platform !== 'win32') throw new Blocked('This check requires the Windows desktop executable and WebView2.')
  if (!existsSync(exe)) throw new Blocked(`Desktop executable missing: ${exe}`)
  try { playwright = require('playwright') } catch {
    try { playwright = require(process.env.VERIFY_PLAYWRIGHT || '') } catch { throw new Blocked('Playwright package unavailable. Set VERIFY_PLAYWRIGHT; this runner connects to WebView2 and never launches Chromium.') }
  }
  const real = realWorkspaceDir()
  realBefore = hashInventory(real)
  run.realWorkspace = { path: real, before: realBefore, beforeCount: Object.keys(realBefore).length }
  requireCheck('isolation.real-workspace-readable', !Object.values(realBefore).includes('(unreadable)'), { fileCount: Object.keys(realBefore).length })
  const first = await launchAndConnect('initial')
  const page = first.page
  requireCheck('isolation.workspace-created-by-desktop', existsSync(iso.workspace), { path: iso.workspace })
  const initialId = await page.locator('.sess-active').getAttribute('data-id')
  const initialFile = sessionPath(initialId)
  await until(() => existsSync(join(iso.workspace, initialFile)), 'initial session file')
  const initial = readback(initialFile)
  requireCheck('session.initial-created-by-rust', initial.id === initialId && Array.isArray(initial.messages) && initial.messages.length === 0, { id: initialId })
  requireCheck('preview.empty-state', await page.locator('.preview-empty').isVisible())

  const draft = `桌面输入保留检查 ${tag}，只填写，不发送。`
  const input = page.locator('.chat-input-row textarea')
  await input.fill(draft)
  await page.locator('[data-view="docs"]').click()
  await page.locator('[data-docs="1"]').waitFor()
  requireCheck('navigation.documents', await page.locator('.docs-query').isVisible() && await page.locator('.docs-empty').isVisible())
  await page.locator('.docs-query').fill('桌面验收未创建文稿')
  requireCheck('documents.search-accepts-input', await page.locator('.docs-query').inputValue() === '桌面验收未创建文稿')
  await page.locator('[data-view="assets"]').click()
  await page.locator('[data-ws="1"]').waitFor()
  requireCheck('navigation.assets', await page.locator('.ws-desc').isVisible() && await page.locator('.ws-q').isVisible())
  await page.locator('.ws-q').fill('不存在的隔离素材')
  await until(async () => (await page.locator('.ws-empty').textContent()).includes('没有匹配'), 'asset search result')
  requireCheck('assets.search-empty-result', (await page.locator('.ws-empty').textContent()).includes('没有匹配'))
  await page.locator('[data-view="chat"]').click()
  requireCheck('chat.unsent-input-preserved-across-views', await input.inputValue() === draft)
  requireCheck('chat.unsent-input-not-saved-as-message', readback(initialFile).messages.length === 0)
  await input.fill('')

  const beforeIds = await page.locator('.sess-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-id')))
  await page.locator('.rail-new').click()
  const createdId = await until(async () => {
    const id = await page.locator('.sess-active').getAttribute('data-id')
    return id && !beforeIds.includes(id) ? id : null
  }, 'new session ID')
  const createdFile = sessionPath(createdId)
  await until(() => existsSync(join(iso.workspace, createdFile)), 'new session file')
  requireCheck('session.new-persisted-by-rust', readback(createdFile).id === createdId, { id: createdId })
  await until(() => page.locator('.sess-active .sess-rename-action').isEnabled(), 'new session UI unlocked')
  await page.locator('.sess-active .sess-rename-action').click()
  const renamedTitle = `本地桌面验收 ${tag}`
  await page.locator('.sess-rename').fill(renamedTitle)
  await page.locator('.sess-rename').press('Enter')
  await until(() => readJson(join(iso.workspace, createdFile)).title === renamedTitle, 'renamed session stored by Rust')
  requireCheck('session.rename-persisted-by-rust', readback(createdFile).title === renamedTitle, { id: createdId, title: renamedTitle })
  await until(async () => (await page.locator('.sess-active .sess-title').textContent()) === renamedTitle, 'renamed title visible')
  await page.locator('.rail-query').fill(renamedTitle)
  requireCheck('session.search-finds-renamed-item', await page.locator('.sess-row').count() === 1 && await page.locator('.sess-row').getAttribute('data-id') === createdId)
  await page.locator('.rail-query').fill('')

  const fixtureSettings = { key: 'desktop-ui-isolated-nonfunctional', url: `http://127.0.0.1:9/desktop-ui-${tag}` }
  await openSettings(page)
  requireCheck('navigation.settings-native-read', !await page.locator('[data-settings-read-error], [data-settings-load-error]').count())
  await page.locator('.set-key').fill(fixtureSettings.key)
  await page.locator('.settings-fields input[type="url"]').fill(fixtureSettings.url)
  await page.locator('.set-vision-on').uncheck()
  await page.locator('.settings-foot .btn-send').click()
  await until(() => {
    const value = readJson(join(iso.workspace, 'settings.json'))
    return value.base_url === fixtureSettings.url && value.api_key === fixtureSettings.key && value.vision_review === false
  }, 'settings file stored by Rust')
  const settings = readback('settings.json')
  requireCheck('settings.persisted-by-rust', settings.base_url === fixtureSettings.url && settings.api_key === fixtureSettings.key && settings.vision_review === false, { baseUrl: settings.base_url, keyMatchesFixture: settings.api_key === fixtureSettings.key, visionReview: settings.vision_review })
  await closeSettings(page)
  await openSettings(page)
  requireCheck('settings.reopen-dialog-persistence', await page.locator('.set-key').inputValue() === fixtureSettings.key && await page.locator('.settings-fields input[type="url"]').inputValue() === fixtureSettings.url)
  await closeSettings(page)
  await until(() => readJson(join(iso.workspace, 'state.json')).current === createdId, 'current session pointer')
  requireCheck('session.current-pointer-persisted', readback('state.json').current === createdId, { id: createdId })
  const firstClose = await closeHandle(first, 'verify persistence across normal application restart')
  if (!normalClose(firstClose)) throw new CheckFailed('Normal desktop exit is required before reopen verification.')

  const reopened = await launchAndConnect('persistence-reopen')
  const reopenedPage = reopened.page
  await until(async () => await reopenedPage.locator('.sess-active').getAttribute('data-id') === createdId, 'restored current session')
  requireCheck('reopen.current-session-restored', await reopenedPage.locator('.sess-active .sess-title').textContent() === renamedTitle, { id: createdId, title: renamedTitle })
  requireCheck('reopen.sessions-still-on-disk', readback(createdFile).title === renamedTitle && readback(initialFile).id === initialId)
  await openSettings(reopenedPage)
  requireCheck('reopen.settings-restored-from-rust', await reopenedPage.locator('.set-key').inputValue() === fixtureSettings.key && await reopenedPage.locator('.settings-fields input[type="url"]').inputValue() === fixtureSettings.url && !await reopenedPage.locator('.set-vision-on').isChecked())
  await closeSettings(reopenedPage)
  const isolatedFiles = hashInventory(iso.workspace)
  // Native window recovery writes lifecycle diagnostics even when no model action runs.
  const traceFiles = Object.keys(isolatedFiles).filter((path) => /^(traces|runs)\//.test(path) && !/^traces\/desktop-runtime\.(jsonl|lock)$/.test(path))
  requireCheck('scope.no-model-run-evidence-created', traceFiles.length === 0, { traceFiles, modelActions: run.scope.modelActions })
  run.completedTestFlow = true
} catch (error) {
  if (error instanceof Blocked) {
    run.blockedReasons.push(error.message)
    console.error(`BLOCKED - ${error.message}`)
  } else {
    run.errors.push({ stage: error instanceof CheckFailed ? 'assertion' : 'desktop-ui', message: String(error.message || error) })
    console.error(`FAIL - ${error.message || error}`)
  }
} finally {
  for (const handle of handles) {
    if (!handle.closed) {
      try { await closeHandle(handle, 'final cleanup') } catch (error) {
        run.errors.push({ stage: 'cleanup', message: String(error.message || error), pid: handle.record.pid })
      }
    }
  }
  if (realBefore) {
    const after = hashInventory(realWorkspaceDir())
    const diff = diffInventory(realBefore, after)
    run.realWorkspace.after = after
    run.realWorkspace.diff = diff
    check('isolation.real-workspace-unchanged', !Object.values(after).includes('(unreadable)') && !diff.added.length && !diff.removed.length && !diff.changed.length, { added: diff.added, removed: diff.removed, changed: diff.changed, fileCount: Object.keys(after).length })
  }
  if (iso && existsSync(iso.workspace)) run.isolatedWorkspaceInventory = hashInventory(iso.workspace)
  run.finishedAt = new Date().toISOString()
  run.summary = { passed: run.checks.filter((c) => c.pass).length, failed: run.checks.filter((c) => !c.pass).length, total: run.checks.length }
  run.status = run.summary.failed || run.errors.length ? 'FAIL' : run.blockedReasons.length || !run.completedTestFlow ? 'BLOCKED' : 'PASS'
  // Invalid/occupied output paths are not written into; still return machine-readable diagnostics on stdout.
  persist()
  console.log(JSON.stringify({ script: run.script, status: run.status, summary: run.summary, blockedReasons: run.blockedReasons, errors: run.errors, result: evidenceReady ? join(outDir, 'run-result.json') : null }))
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}
