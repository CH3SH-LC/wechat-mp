// Reproducible, zero-model verification. Each invocation owns its output and Vite process.
import { spawn, execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer as createNetServer } from 'node:net'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ownFile = fileURLToPath(import.meta.url)
const require = createRequire(import.meta.url)
const OFFLINE = [
  'compose-check', 'compose-progress-check', 'asset-resolve-check', 'svg-quality-check', 'progress-check',
  'trace-check', 'delivery-quality-check', 'photo-swallow-check', 'asset-completion-check',
  'repair-integrity-check', 'edit-contract-check', 'editorial-check', 'fact-assert-check', 'budget-check',
  'ipc-gate-check', 'ledger-finalize-check', 'live-driver-check', 'cdp-preflight-check',
  'runner-negative-check', 'fixture-repair',
  'document-wire-check', 'browser-asset-reference-check', 'input-manifest-check', 'local-image-path-check',
]
const BROWSER = [
  'verify-ui', 'raster-check', 'prep-contract-check', 'writing-retirement-check', 'preview-resource-check',
  'repair-flow-check', 'app-message-grounding-check', 'export-paging-check',
  'frontend-interaction-check', 'local-image-check',
]

// The child reports its actual bound port over IPC. No global port or existing server is reused.
if (process.argv.includes('--serve')) {
  if (!process.send) throw new Error('--serve is internal and requires an IPC parent')
  const { createServer } = await import('vite')
  // Vite treats port: 0 as its default port, so choose a free ephemeral port first.
  const port = await unusedPort()
  // The verification snapshot is immutable. Vite's config merge ignores an inline
  // null watch override, so disable the test watcher after resolving the config.
  // Normal desktop development and native document/asset discovery are unchanged.
  const server = await createServer({
    root, clearScreen: false,
    plugins: [{ name: 'verification-snapshot', configResolved(config) {
      config.server.watch = null
      config.optimizeDeps.entries = ['index.html']
    } }],
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
  })
  if (server.config.server.watch !== null) throw new Error('Verification watcher must be disabled for the immutable snapshot')
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    await server.close()
    process.exit(0)
  }
  process.on('message', (message) => { if (message === 'shutdown') void close() })
  process.on('disconnect', () => void close())
  await server.listen()
  const address = server.httpServer.address()
  process.send({ ready: true, url: `http://127.0.0.1:${address.port}` })
} else {
  await main()
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: node scripts/verify-project.mjs [--offline | --full | --browser] [--list]\nDefault: --offline. Full adds isolated browser checks. Never calls models or starts the desktop app.')
    return
  }
  const modes = args.filter((arg) => ['--offline', '--full', '--browser'].includes(arg))
  if (modes.length > 1 || args.some((arg) => !['--offline', '--full', '--browser', '--list'].includes(arg))) {
    console.error('Unknown or conflicting arguments. Use --help.')
    process.exitCode = 2
    return
  }
  const mode = modes[0]?.slice(2) || 'offline'
  // Desktop checks own real native processes and must be launched explicitly.
  const classified = new Set([...OFFLINE, ...BROWSER, 'desktop-ui-check'])
  const unclassified = readdirSync(join(root, 'scripts')).filter((name) => name.endsWith('-check.mjs') && !classified.has(name.slice(0, -4)))
  if (unclassified.length) {
    console.error(`Unclassified checks must be assigned before verification: ${unclassified.join(', ')}`)
    process.exitCode = 2
    return
  }
  const plan = [
    ...(mode !== 'browser' ? ['typecheck', 'build', 'rust-unit', ...OFFLINE] : []),
    ...(mode !== 'offline' ? ['browser-dependencies', 'vite-server', ...BROWSER] : []),
  ]
  if (args.includes('--list')) {
    console.log(JSON.stringify({ mode, plan, modelCalls: 0, desktop: false }, null, 2))
    return
  }
  const outDir = join(root, '.local', 'runs', `verify-${mode}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)
  mkdirSync(outDir, { recursive: true })
  const summary = { script: 'verify-project', mode, startedAt: new Date().toISOString(), finishedAt: null, status: 'ERROR', executionComplete: false, node: process.version, plan, steps: [], errors: [], sourceBefore: fingerprint(), sourceAfter: null }
  let active = null
  let serverChild = null
  let interrupted = false
  const save = () => writeFileSync(join(outDir, 'run-result.json'), JSON.stringify(summary, null, 2) + '\n')
  const onSignal = () => { interrupted = true; if (active && active.exitCode === null) active.kill('SIGTERM') }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  console.log(`Verification: ${mode}\nEvidence: ${outDir}`)
  save()

  const run = async (id, executable, argv, { verdict = null, timeoutMs = 600_000 } = {}) => {
    if (interrupted) throw new Error('Verification interrupted')
    const dir = join(outDir, id)
    mkdirSync(dir, { recursive: true })
    const row = { id, startedAt: new Date().toISOString(), command: [executable, ...argv], status: 'ERROR', exitCode: null, signal: null, timedOut: false, log: relative(outDir, join(dir, 'output.log')), verdict: null }
    summary.steps.push(row)
    save()
    console.log(`[RUN] ${id}`)
    await new Promise((done) => {
      const child = spawn(executable, argv, { cwd: root, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      active = child
      let log = ''
      const capture = (chunk) => { log += chunk.toString(); writeFileSync(join(dir, 'output.log'), log) }
      child.stdout.on('data', capture)
      child.stderr.on('data', capture)
      const timeout = setTimeout(() => { row.timedOut = true; child.kill('SIGTERM') }, timeoutMs)
      child.once('error', (error) => { row.error = error.message })
      child.once('close', (code, signal) => {
        clearTimeout(timeout)
        active = null
        row.exitCode = code
        row.signal = signal
        row.finishedAt = new Date().toISOString()
        writeFileSync(join(dir, 'output.log'), log)
        row.status = code === 0 && !row.timedOut && !interrupted ? 'PASS' : code === 2 ? 'BLOCKED' : code === null || row.timedOut || interrupted ? 'ERROR' : 'FAIL'
        if (verdict) {
          try {
            const result = JSON.parse(readFileSync(join(dir, verdict), 'utf8'))
            row.verdict = { status: result.status, checks: result.checks?.length ?? null, executionComplete: result.executionComplete ?? null }
            if (row.status === 'PASS' && result.status !== 'PASS') row.status = 'ERROR'
          } catch (error) { row.status = 'ERROR'; row.error = `Missing or invalid runner verdict: ${error.message}` }
        }
        save()
        console.log(`[${row.status}] ${id} (exit ${code})`)
        done()
      })
    })
  }

  try {
    const [major, minor] = process.versions.node.split('.').map(Number)
    if (major < 22 || (major === 22 && minor < 18) || major === 23) throw new Error('Use Node 22.18+ LTS or Node 24+; runners import TypeScript directly.')
    if (mode !== 'browser') {
      await run('typecheck', process.execPath, [require.resolve('typescript/bin/tsc')])
      await run('build', process.execPath, [join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js'), 'build'])
      await run('rust-unit', 'cargo', ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--lib'], { timeoutMs: 1_800_000 })
      for (const id of OFFLINE) {
        const dir = join(outDir, id)
        const extra = id === 'photo-swallow-check' ? ['--label', 'current'] : id === 'runner-negative-check' ? [String(await unusedPort())] : []
        await run(id, process.execPath, [join(root, 'scripts', `${id}.mjs`), '--out', dir, ...extra], { verdict: id === 'fixture-repair' ? null : id === 'photo-swallow-check' ? 'current/run-result.json' : 'run-result.json' })
      }
    }
    if (mode !== 'offline') {
      browserDependencies()
      summary.steps.push({ id: 'browser-dependencies', status: 'PASS' })
      const dir = join(outDir, 'vite-server')
      mkdirSync(dir, { recursive: true })
      serverChild = spawn(process.execPath, [ownFile, '--serve'], { cwd: root, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
      let serverLog = ''
      const capture = (chunk) => { serverLog += chunk.toString(); writeFileSync(join(dir, 'output.log'), serverLog) }
      serverChild.stdout.on('data', capture)
      serverChild.stderr.on('data', capture)
      const base = await new Promise((done, fail) => {
        const timeout = setTimeout(() => fail(new Error('Isolated Vite startup timed out')), 30_000)
        serverChild.once('message', (message) => { clearTimeout(timeout); message?.ready ? done(message.url) : fail(new Error('Invalid Vite ready message')) })
        serverChild.once('error', (error) => { clearTimeout(timeout); fail(error) })
        serverChild.once('exit', (code) => { clearTimeout(timeout); fail(new Error(`Isolated Vite exited: ${code}`)) })
      })
      summary.steps.push({ id: 'vite-server', status: 'PASS', pid: serverChild.pid, base, log: 'vite-server/output.log' })
      for (const id of BROWSER) await run(id, process.execPath, [join(root, 'scripts', `${id}.mjs`), '--out', join(outDir, id), base], { verdict: 'run-result.json' })
    }
  } catch (error) {
    summary.errors.push(error.message)
    console.error(error.message)
  } finally {
    if (serverChild?.pid && serverChild.exitCode === null && serverChild.signalCode === null) {
      await new Promise((done) => {
        const timeout = setTimeout(() => { summary.errors.push('Isolated Vite did not shut down gracefully.'); serverChild.kill('SIGTERM') }, 5_000)
        serverChild.once('exit', (code, signal) => {
          clearTimeout(timeout)
          const serverRow = summary.steps.find((row) => row.id === 'vite-server')
          if (serverRow) { serverRow.exitCode = code; serverRow.signal = signal }
          if (code !== 0) summary.errors.push(`Isolated Vite shutdown: exit=${code}, signal=${signal}`)
          done()
        })
        if (serverChild.connected) serverChild.send('shutdown', (error) => { if (error) serverChild.kill('SIGTERM') })
        else serverChild.kill('SIGTERM')
      })
    }
    summary.sourceAfter = fingerprint()
    if (summary.sourceBefore.digest !== summary.sourceAfter.digest) summary.errors.push('Source files changed during verification; results do not describe one stable checkout.')
    summary.executionComplete = plan.every((id) => summary.steps.some((row) => row.id === id))
    summary.finishedAt = new Date().toISOString()
    summary.status = summary.errors.length || !summary.executionComplete ? 'ERROR' : summary.steps.some((row) => row.status === 'ERROR') ? 'ERROR' : summary.steps.some((row) => row.status === 'FAIL') ? 'FAIL' : summary.steps.some((row) => row.status === 'BLOCKED') ? 'BLOCKED' : 'PASS'
    save()
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    process.exitCode = summary.status === 'PASS' ? 0 : summary.status === 'BLOCKED' ? 2 : 1
    console.log(`[${summary.status}] ${summary.steps.length}/${plan.length} steps. Evidence: ${outDir}`)
  }
}

function browserDependencies() {
  let modulePath
  try { modulePath = require.resolve('playwright') } catch {
    const value = process.env.VERIFY_PLAYWRIGHT
    if (!value) throw new Error('Browser checks require playwright or VERIFY_PLAYWRIGHT pointing to its installed module.')
    modulePath = require.resolve(isAbsolute(value) ? value : resolve(root, value))
  }
  const { chromium } = require(modulePath)
  const executable = process.env.VERIFY_CHROMIUM ? resolve(root, process.env.VERIFY_CHROMIUM) : chromium.executablePath()
  if (!existsSync(executable)) throw new Error('Chromium is missing. Set VERIFY_CHROMIUM or install the browser for this Playwright version.')
  process.env.VERIFY_PLAYWRIGHT = modulePath
  process.env.VERIFY_CHROMIUM = executable
}

async function unusedPort() {
  const server = createNetServer()
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  const port = server.address().port
  await new Promise((done) => server.close(done))
  return port
}

function fingerprint() {
  const entries = []
  const visit = (abs) => {
    if (!existsSync(abs)) return
    for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(abs, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (entry.isFile()) entries.push([relative(root, file).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(file)).digest('hex')])
    }
  }
  for (const dir of ['src', 'scripts', 'public', 'src-tauri/src', 'src-tauri/resources', 'src-tauri/icons', 'src-tauri/capabilities']) visit(join(root, dir))
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'vite.config.ts', 'tsconfig.json', 'tsconfig.node.json', 'index.html', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/build.rs', 'src-tauri/tauri.conf.json']) {
    if (existsSync(join(root, name))) entries.push([name, createHash('sha256').update(readFileSync(join(root, name))).digest('hex')])
  }
  let head = null
  try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() } catch { /* hashes remain authoritative outside git */ }
  return { head, digest: createHash('sha256').update(JSON.stringify(entries)).digest('hex'), entries }
}
