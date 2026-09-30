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
    console.log(`[release-smoke] 启动 PID=${ctx.pid} exe=${exe}\n  sha256=${ctx.exeHash}\n  CDP=127.0.0.1:${cdpPort}`)

    const list = await waitForCdp(cdpPort, 45000)
    const title = await probeTitle(list)
    run.cdpPages = list.map((p) => ({ title: p.title, type: p.type }))
    console.log(`[release-smoke] CDP 页面：${JSON.stringify(run.cdpPages)}`)

    // 隔离工作区应该已被应用自己建出来
    await new Promise((r) => setTimeout(r, 3000))
    const wsExists = exists(iso.workspace)
    const wsFiles = wsExists ? hashInventory(iso.workspace) : {}
    run.isolatedWorkspace = { dir: iso.workspace, exists: wsExists, fileCount: Object.keys(wsFiles).length }

    check('进程在冒烟期间一直活着', isAlive(ctx.pid))
    check('CDP 有可用页面（窗口真的起来了）', list.length > 0, `pages=${list.length}`)
    check('窗口标题是「智序 · 公众号推文助手」', String(title).includes('智序'), `title=${title}`)
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
    const r = await closeOwnPid(ctx.pid)
    run.closed = { ...r, pid: ctx.pid }
    console.log(`[release-smoke] 关闭本轮 PID=${ctx.pid}：closed=${r.closed} forced=${r.forced}`)
  }
}

/** 用 CDP 的 HTTP 接口取一次页面标题（不需要 playwright，避免给冒烟引入额外依赖） */
async function probeTitle(list) {
  const p = list.find((x) => x.type === 'page') || list[0]
  return p ? p.title : ''
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
