// release-smoke.mjs —— release exe 的**隔离启动冒烟**（DS 修复指南 包 E）
//
// 用法：
//   node scripts/release-smoke.mjs [evidenceDir] [exePath]
//
// 做什么：
//   1. 记录**真实工作区**的完整逐文件哈希清单（只读，绝不写）；
//   2. 用全新隔离 profile + WebView2 数据目录 + 空闲 CDP 端口启动 release exe；
//   3. 核对：进程活着、CDP 有页面、窗口标题对、隔离工作区**已经建出来**、
//      真实工作区清单**逐字节未变**；
//   4. 只关闭本轮确切启动的 PID，临时目录按需删除（默认保留证据，`--clean` 才删）。
//
// 不做：不调模型、不写真实作品、不动使用者正在跑的实例。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import {
  closeOwnPid,
  diffInventory,
  exists,
  freePort,
  hashInventory,
  launchDesktop,
  prepareIsolation,
  procIdentity,
  realWorkspaceDir,
  waitForCdp,
} from './lib/desktop-harness.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const args = process.argv.slice(2)
const clean = args.includes('--clean')
const positional = args.filter((a) => !a.startsWith('--'))
const exe = resolve(positional[1] || join(repoRoot, 'src-tauri', 'target', 'release', 'wechat-mp-desktop.exe'))

const run = {
  script: 'release-smoke',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED',
  exe,
  exeHash: null,
  checks: [],
  errors: [],
  blockedReason: null,
}
const check = (id, pass, extra = '') => {
  run.checks.push({ id, pass: Boolean(pass), evidence: extra ? [String(extra)] : [] })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[release-smoke] ERROR@${stage}: ${message}`)
}

const iso = prepareIsolation('smoke-' + Date.now().toString(36))
const evidenceDir = resolve(positional[0] || iso.evidence)
mkdirSync(evidenceDir, { recursive: true })
run.isolation = { root: iso.root, profile: iso.profile, webview: iso.webview, workspace: iso.workspace }

if (!exists(exe)) {
  fail('exe', `找不到 release exe：${exe}`)
}

let child = null
let ctx = null
try {
  if (!run.errors.length) {
    const real = realWorkspaceDir()
    const before = hashInventory(real)
    run.realWorkspace = { dir: real, fileCount: Object.keys(before).length, before }
    console.log(`[release-smoke] 真实工作区 ${real}：${Object.keys(before).length} 个文件（只读核对）`)

    const cdpPort = await freePort()
    ctx = launchDesktop(exe, { profile: iso.profile, webview: iso.webview, cdpPort })
    child = ctx.child
    run.exeHash = ctx.exeHash
    run.pid = ctx.pid
    run.cdpPort = cdpPort
    // 启动后**立刻**固定本轮启动身份（映像名 + 完整路径 + 创建时刻），关闭时原样交回。
    // 为什么必须现在取：关闭时只能用"启动时记下的"身份比对；只凭数字 PID 无法排除 PID 被回收后
    // 复用，而 closeOwnPid 在身份不齐备时会**拒绝关闭**（零关闭操作），不会去赌那个数字。
    run.identity = procIdentity(ctx.pid, exe)
    console.log(
      `[release-smoke] 启动 PID=${ctx.pid} exe=${exe}\n  sha256=${ctx.exeHash}\n  CDP=127.0.0.1:${cdpPort}\n` +
        `  启动身份：完整=${run.identity.identityComplete} image=${run.identity.actualImage} path=${run.identity.actualPath} startTime=${run.identity.actualStartTime}`,
    )

    // 窗口标题改由**操作系统**读取，不再依赖 CDP。
    //
    // 为什么改：CDP 是"驱动真实界面"的手段，而本机 WebView2 运行时（154 与 153 都试过）
    // **不开放**远程调试端口（已实测：`--remote-debugging-port` 确实到了 WebView2 浏览器进程的
    // 命令行上，但没有任何 TCP 端口在监听、也没有 DevToolsActivePort 文件；同一台机器上普通
    // Edge 用同一开关可以正常监听，且没有任何 Edge/WebView2 策略在拦）。把"窗口起来了没有"
    // 这个判定挂在 CDP 上，等于让冒烟测试去证明一件与它无关的事。
    // CDP 的可用性另行**如实记录**（`cdpAvailable`），它是真机验收的前提，不是冒烟的前提。
    await new Promise((r) => setTimeout(r, 6000))
    const title = windowTitleOf(ctx.pid)
    run.windowTitle = title

    let cdpAvailable = false
    let cdpNote = ''
    try {
      const list = await waitForCdp(cdpPort, 8000)
      cdpAvailable = list.length > 0
      run.cdpPages = list.map((p) => ({ title: p.title, type: p.type }))
      cdpNote = `pages=${list.length}`
    } catch (e) {
      cdpNote = String(e && e.message ? e.message : e)
    }
    run.cdpAvailable = cdpAvailable
    run.cdpNote = cdpNote
    console.log(`[release-smoke] 窗口标题（OS 读取）=${JSON.stringify(title)}`)
    console.log(`[release-smoke] CDP 可用=${cdpAvailable}${cdpNote ? '（' + cdpNote + '）' : ''}`)

    // 隔离工作区应该已被应用自己建出来
    const wsExists = exists(iso.workspace)
    const wsFiles = wsExists ? hashInventory(iso.workspace) : {}
    run.isolatedWorkspace = { dir: iso.workspace, exists: wsExists, fileCount: Object.keys(wsFiles).length }

    check('进程在冒烟期间一直活着', isAlive(ctx.pid))
    check('窗口标题是「智序 · 公众号推文助手」（操作系统读取，不依赖 CDP）', String(title).includes('智序'), `title=${title}`)
    check('隔离工作区已由应用自动建立（说明写的是隔离目录）', wsExists, iso.workspace)
    check('隔离工作区的会话/文档目录为空（新 profile，没有真实数据）', isEmptyish(wsFiles), JSON.stringify(Object.keys(wsFiles).slice(0, 8)))

    // 真实工作区必须逐字节未变
    const after = hashInventory(real)
    const d = diffInventory(before, after)
    run.realWorkspace.after = after
    run.realWorkspace.diff = { added: d.added.length, removed: d.removed.length, changed: d.changed.length }
    check(
      '真实工作区逐文件哈希未变（不靠"计数相同"声称没变）',
      d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0,
      `新增 ${d.added.length} / 删除 ${d.removed.length} / 修改 ${d.changed.length}：${[...d.added, ...d.removed, ...d.changed].slice(0, 5).join(', ')}`,
    )
  }
} catch (e) {
  fail('smoke', String(e && e.message ? e.message : e))
} finally {
  if (ctx) {
    // 传 exe + **本轮启动身份**：closeOwnPid 会用后者做齐备门槛与关闭前复核；
    // 只传 exe（旧调用）已在 10-02 晚复核中定性为"不足以确认身份"，会被拒绝关闭。
    // `forced` 单独报出来（强杀不等于"正常退出"）；refused 时如实打印原因。
    const r = await closeOwnPid(ctx.pid, { exe, expectedIdentity: run.identity })
    run.closed = { ...r, pid: ctx.pid }
    console.log(`[release-smoke] 关闭本轮 PID=${ctx.pid}：closed=${r.closed} forced=${r.forced} refused=${r.refused} via=${r.via}${r.reason ? ` reason=${r.reason}` : ''}`)
    // 关闭结果必须进最终判定（2026-10-02 复核 §0.0 末段）：原来 `run.closed` 只写进证据、不参与
    // `run.checks`/`status`，于是"身份不符被拒绝关闭""等不到正常退出只好强杀"这两种异常
    // 照样能报 PASS——而它们各自都是真实症状（前者会留下一个没关掉的进程，后者说明应用没走退出路径）。
    check(
      '本轮自有 PID 已按启动身份核验关闭（closed=true，且不是"身份不符被拒绝关闭"）',
      r.closed === true && r.refused !== true,
      `closed=${r.closed} refused=${r.refused} via=${r.via}${r.reason ? ` reason=${r.reason}` : ''}`,
    )
    check(
      '关闭走的是应用自身的退出路径（forced 单独记，不再"异常关闭也算通过"）',
      r.forced !== true && r.exitedBeforeRequest !== true,
      `forced=${r.forced} exitedBeforeRequest=${r.exitedBeforeRequest} via=${r.via}`,
    )
  }
}

/**
 * 用**操作系统**读取进程的主窗口标题（不依赖 CDP）。
 *
 * 走"PowerShell 以 UTF-8 写文件、Node 再读"这条路径，而不是直接捕获 stdout：
 * 直接捕获时 PowerShell 按控制台代码页（本机是 GBK）输出，Node 按 UTF-8 解码，
 * 中文标题会变成乱码——那样"标题对没对"这条断言就变成了对乱码的断言（假绿/假红都可能）。
 */
function windowTitleOf(pid) {
  const tmp = join(iso.evidence, 'window-title.txt')
  try {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { [System.IO.File]::WriteAllText('${tmp.replace(/'/g, "''")}', [string]$p.MainWindowTitle, [System.Text.UTF8Encoding]::new($false)) }`,
      ],
      { timeout: 25000 },
    )
    return existsSync(tmp) ? readFileSync(tmp, 'utf8').trim() : ''
  } catch {
    return ''
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isEmptyish(files) {
  // 全新隔离 profile 下不应该有任何**作品 / 运行痕迹**：没有 .md 源文、没有 traces/*.jsonl、
  // 没有素材文件。空壳的 sessions.json / 目录结构不算数据。
  const keys = Object.keys(files)
  const data = keys.filter((k) => /\.md$/i.test(k) || /\.jsonl$/i.test(k) || /^assets\//i.test(k) || /^docs\//i.test(k))
  return data.length === 0
}

function finalize() {
  const hasFail = run.checks.some((c) => !c.pass)
  if (run.blockedReason) run.status = 'BLOCKED'
  else if (run.errors.length) run.status = 'ERROR'
  else if (!run.checks.length) run.status = 'ERROR'
  else if (hasFail) run.status = 'FAIL'
  else run.status = 'PASS'
  run.finishedAt = new Date().toISOString()
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, 'release-smoke.json'), JSON.stringify(run, null, 2) + '\n', 'utf8')
  writeFileSync(
    join(evidenceDir, 'release-smoke.md'),
    `# release 冒烟（隔离启动）\n\n状态：**${run.status}**（检查 ${run.checks.filter((c) => c.pass).length}/${run.checks.length} 通过）\n` +
      `时间：${run.startedAt} → ${run.finishedAt}\n exe：\`${run.exe}\`\n sha256：\`${run.exeHash}\`\n` +
      `隔离目录：\`${iso.root}\`（profile / webview / evidence 三处都不在真实工作区内）\n\n` +
      `窗口标题（OS 读取）：\`${run.windowTitle ?? '(未取到)'}\`\n` +
      `CDP 可用性：**${run.cdpAvailable ? 'available' : 'unavailable'}**` +
      `${run.cdpNote ? `（${run.cdpNote}）` : ''}\n` +
      (run.cdpAvailable
        ? ''
        : `\n> CDP 不可用 ≠ 冒烟失败。它只影响"驱动真实界面"的真机验收（包 F），不影响本轮的启动冒烟结论。\n> 本机已实测：\`--remote-debugging-port\` 确实传到了 WebView2 浏览器进程的命令行，但没有任何 TCP 端口在监听、\n> 也没有 \`DevToolsActivePort\` 文件；同一台机器上普通 Edge 用同一开关可以正常监听。\n`) +
      '\n' +
      (run.errors.length ? `## 错误\n\n${run.errors.map((e) => `- [${e.stage}] ${e.message}`).join('\n')}\n\n` : '') +
      `\`\`\`\n${run.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} - ${c.id}${c.evidence.length ? ' (' + c.evidence.join(' / ') + ')' : ''}`).join('\n')}\n\`\`\`\n`,
    'utf8',
  )
  console.log('')
  console.log(`  产出留档：${evidenceDir}`)
  console.log(`RELEASE-SMOKE ${run.status}`)
  if (clean && run.status === 'PASS') {
    try {
      rmSync(iso.root, { recursive: true, force: true })
      console.log('  临时隔离目录已删除（--clean）')
    } catch (e) {
      console.log(`  临时隔离目录删除失败（不影响判定）：${String(e.message || e)}`)
    }
  } else {
    console.log(`  临时隔离目录保留：${iso.root}`)
  }
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}

finalize()
