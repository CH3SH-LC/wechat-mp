// cdp-preflight.mjs —— 真机验收驱动的**零调用** CDP 可用性预检（DS 修复指南 §0.5 R4）
//
// 用途：`live-acceptance.mjs` 连不上 WebView2 的 DevTools 端点时，本脚本给出"到底是哪一段断了"的
// 最小矩阵证据。**不读密钥、不发模型命令、不花一分钱**；只启动隔离 profile 下的自有进程，逐个关掉。
//
// 为什么必须分开做：把"连不上"和"应用起不来"混在一起排查，会得到一堆无法区分的结论。
// 这里逐格区分这些状态（指南 §0.5 要求）：
//   · 无监听 / TCP 连接错误（并区分 ECONNREFUSED / ETIMEDOUT / 其它）
//   · HTTP 有响应但状态码非 200
//   · HTTP 可达但 JSON 坏 / target 结构不符 / target 为空
//   · 连接成功（有结构正确的 target）
// 归类**以最新一次采样为准**，采样序列完整保留（旧的"任一时刻空 target"会被后来的有效 target 误判）。
//
// 矩阵（只在能提供**区分证据**时才加格）：
//   A. 应用，不给 CDP 参数（显式清掉继承的 CDP/runtime 覆盖） → 对照格：不该有监听
//   B. 应用，WXMP_CDP_PORT=<port>     → 被测格：本轮真正走的那条路径
//   C. 普通 Edge，--remote-debugging-port=<port> → 正对照：证明"这台机器上 CDP over TCP 是通的"，
//      因此 B 的失败不是"CDP 在这台机器上根本不能用"。**注意**：C 成功只能证明 Edge 那个配置可用，
//      不能据此给 WebView2 定根因。
//
// 纪律（指南 §0.5 末段）：所有子进程最终退出；不修改任何全局策略、不重装运行时、不动用户自己的实例；
// 读不出来的东西一律报 UNKNOWN，不补造。**每个 app / Edge 记录并使用该进程自己的 exe 核验身份**，
// 绝不用应用路径去核验 Edge。
//
// 判定：唯一 RunResult（指南 §3.1）。本脚本的 PASS 含义是"**矩阵采集完整且每格都能给出结论、且本轮
// 自有进程全部正常关闭**"，不是"CDP 可用"——CDP 到底通不通属于观测结论，写在报告里。
// 矩阵是**必需附件**（`extraFiles['cdp-matrix.json']`）：附件写失败 → 判定非 PASS。

import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import {
  closeOwnPid,
  classifySamples,
  classifyTcpError,
  extractUserDataDirs,
  findDevToolsActivePort,
  freePort,
  hashInventory,
  launchDesktop,
  prepareIsolation,
  procIdentity,
  realWorkspaceDir,
} from './lib/desktop-harness.mjs'

const outDir = resolveOutDir('cdp-preflight')
const judge = createJudge({
  script: 'cdp-preflight',
  outDir,
  // 格 C 是**正对照**：本机没有 Edge 时它按 UNKNOWN 记录，不能算"该跑没跑"，
  // 所以不写进计划场景；A/B/D 是本脚本必须给出的结论。
  plannedCases: ['A:', 'B:', 'D:'],
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}
const observe = (id, detail) => {
  console.log(`  [观测] ${id}：${detail}`)
  judge.observe(id, detail)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const repoRoot = join(import.meta.dirname, '..')
const exe = join(repoRoot, 'src-tauri', 'target', 'release', 'wechat-mp-desktop.exe')
const workRoot = mkdtempSync(join(tmpdir(), 'wxmp-cdp-preflight-'))

/** TCP 层：这个端口有没有人在听（不看 HTTP），并记录**连接错误的类型**（拒绝/超时/其它分开） */
function tcpProbe(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port })
    let settled = false
    const done = (listening, tcpKind) => {
      if (settled) return
      settled = true
      try {
        sock.destroy()
      } catch {
        /* 已经关了 */
      }
      resolve({ listening, tcpKind: tcpKind || null })
    }
    sock.setTimeout(timeoutMs)
    sock.on('connect', () => done(true, null))
    sock.on('timeout', () => done(false, 'etimedout'))
    sock.on('error', (e) => done(false, classifyTcpError(e && e.code)))
  })
}

/** HTTP 层：分别取 /json/version 与 /json/list，错误**按类型**记录，不写成"失败了" */
async function probeCdp(port, timeoutMs = 2500) {
  const get = async (path) => {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), timeoutMs)
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { signal: ac.signal })
      clearTimeout(t)
      const text = await r.text()
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
      return { ok: true, status: r.status, json, textHead: text.slice(0, 200) }
    } catch (e) {
      // 区分：超时 / 连接被拒 / 其它。三种在归因上完全不是一回事。
      const kind = e && e.name === 'AbortError' ? 'timeout' : e && e.cause && e.cause.code ? String(e.cause.code) : String((e && e.message) || e)
      return { ok: false, errorKind: kind, error: String((e && e.message) || e) }
    }
  }
  return { version: await get('/json/version'), list: await get('/json/list') }
}

/** 某一格的完整采样序列（**不提前中断**，把空 target 到有效 target 的演变都保留下来） */
async function watchPort(port, samples, gapMs) {
  const rows = []
  for (let i = 0; i < samples; i++) {
    const t = await tcpProbe(port)
    const http = t.listening ? await probeCdp(port) : null
    rows.push({
      at: Date.now(),
      listening: t.listening,
      tcpKind: t.tcpKind,
      targets: http && http.list.ok && Array.isArray(http.list.json) ? http.list.json.length : null,
      http,
    })
    await sleep(gapMs)
  }
  return rows
}

/**
 * 取某 PID 的子进程命令行（用来核对 `--remote-debugging-port` / `--user-data-dir` 到底出现在哪）。
 * wmic 在较新的 Windows 上可能已被移除，退回 PowerShell；两条都拿不到就返回 `{ ok:false }`——
 * **UNKNOWN 就是 UNKNOWN**，不拿"没查到"当"没有这个参数"。
 */
function childCmdlines(pid) {
  const tried = []
  const wmic = spawnSync('wmic', ['process', 'where', `ParentProcessId=${pid}`, 'get', 'ProcessId,CommandLine', '/format:csv'], { encoding: 'utf8', windowsHide: true, timeout: 15000 })
  if (wmic.status === 0 && wmic.stdout && wmic.stdout.trim()) return { ok: true, via: 'wmic', lines: wmic.stdout.split('\n').map((l) => l.trim()).filter(Boolean) }
  tried.push(`wmic → status=${wmic.status} ${String(wmic.stderr || '').trim().slice(0, 80)}`)
  const ps = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | Select-Object -ExpandProperty CommandLine`],
    { encoding: 'utf8', windowsHide: true, timeout: 25000 },
  )
  if (ps.status === 0 && ps.stdout && ps.stdout.trim()) return { ok: true, via: 'powershell', lines: ps.stdout.split('\n').map((l) => l.trim()).filter(Boolean) }
  tried.push(`powershell → status=${ps.status} ${String(ps.stderr || '').trim().slice(0, 80)}`)
  return { ok: false, via: null, lines: [], tried }
}

/** 当前进程的完整性级别（提权宿主会忽略 WEBVIEW2_* 环境覆盖，是待核实的变量之一） */
function integrityLevel() {
  const r = spawnSync('whoami', ['/groups'], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
  if (r.status !== 0) return { ok: false, reason: `whoami 失败（status=${r.status}）` }
  const m = /Mandatory Label\\[^\\]*\\([^\s]+)/.exec(r.stdout) || /(High|Medium|System|Low) Mandatory Level/i.exec(r.stdout)
  return { ok: Boolean(m), level: m ? m[1] : null, raw: r.stdout.split('\n').filter((l) => /Mandatory Level/i.test(l)).map((l) => l.trim()) }
}

const realBefore = hashInventory(realWorkspaceDir())
const matrix = []
/** 本轮启动的**每一个**自有进程记录（含它自己的 exe 与预期身份）；**不**清空，全部参与判定 */
const started = []
const closeResults = []
let conclusion = null

const summarizeClose = (r) => ({
  closed: r.closed,
  forced: r.forced,
  refused: r.refused,
  exitedBeforeRequest: r.exitedBeforeRequest,
  via: r.via,
  reason: r.reason || null,
  expected: r.expectedIdentity ? { pid: r.expectedIdentity.pid, expectedImage: r.expectedIdentity.expectedImage } : null,
  matchesExpected: r.reverifiedIdentity ? r.reverifiedIdentity.matchesExpected : null,
  probe: r.reverifiedIdentity ? r.reverifiedIdentity.probe : null,
})

const closeAll = async () => {
  for (const rec of started) {
    if (rec.closeResult) continue
    // 用**该进程自己的 exe**核验身份（Edge 用 msedge.exe，绝不用应用路径），并带上启动时记录的预期身份。
    const r = await closeOwnPid(rec.pid, { exe: rec.exe, expectedIdentity: rec.identity, gracefulMs: 12000, forceMs: 6000 })
    rec.closeResult = r
    const s = summarizeClose(r)
    closeResults.push({ pid: rec.pid, label: rec.label, exe: rec.exe, ...s })
    observe('收尾关闭', `[${rec.label}] pid=${rec.pid} exe=${rec.exe} → ${JSON.stringify(s)}`)
  }
}

const startRecord = (label, exePath, ctx) => {
  // 启动时尽力记录预期身份（PID + 映像名 + 创建时刻 + 完整路径）；取不到就是 UNKNOWN，后面照样据此拒绝关闭。
  const identity = procIdentity(ctx.pid, exePath)
  const rec = { label, pid: ctx.pid, exe: exePath, exeHash: ctx.exeHash || null, identity, closeResult: null }
  started.push(rec)
  return rec
}

try {
  // =====================================================================================
  // 前置：被测物是否存在、版本、是否提权
  // =====================================================================================
  console.log('\n[A/B/C/D 共同前置]')
  check('A: 被测 exe 存在', existsSync(exe), exe)
  if (!existsSync(exe)) {
    judge.block('被测 exe 不存在，无法做矩阵')
  } else {
    const exeStat = statSync(exe)
    observe('被测 exe', `${exe}｜${exeStat.size} 字节｜mtime=${exeStat.mtime.toISOString()}`)
    const il = integrityLevel()
    observe('当前进程完整性级别', il.ok ? `${il.level}（${JSON.stringify(il.raw)}）` : `UNKNOWN：${il.reason}`)
    observe('真实工作区基线', `${Object.keys(realBefore).length} 个文件（只读核对，矩阵过程不写入）`)

    // =====================================================================================
    // 格 A：应用，不给任何 CDP 参数 —— 对照格（显式清掉继承的 CDP/runtime 环境覆盖）
    // =====================================================================================
    console.log('\n[格 A：应用 + 不给 CDP 参数（对照，预期：无监听）]')
    const portA = await freePort() // 一个**未传给应用**的随机空闲端口
    const isoA = prepareIsolation('cdp-A', join(workRoot, 'A'))
    const a = launchDesktop(exe, { profile: isoA.profile, webview: isoA.webview, isolateCdpEnv: true })
    const recA = startRecord('A', exe, a)
    await sleep(14000)
    const rowsA = await watchPort(portA, 3, 1500)
    const cellA = {
      cell: 'A',
      cdpPortRequested: null,
      probePort: portA,
      exe,
      pid: a.pid,
      exeHash: a.exeHash,
      identity: recA.identity,
      clearedCdpEnv: a.clearedCdpEnv,
      envOverrides: a.envOverrides,
      samples: rowsA,
      classification: classifySamples(rowsA),
    }
    matrix.push(cellA)
    check('A: 对照格采集完成（有采样结果，不是"没跑"）', rowsA.length > 0, `samples=${rowsA.length}`)
    check('A: 未给 CDP 参数时确实**没有**监听（对照组成立）', rowsA.every((r) => !r.listening), JSON.stringify(rowsA.map((r) => r.listening)))
    observe('格 A', `随机未传端口 ${portA}：监听=${rowsA.some((r) => r.listening)}；清掉继承覆盖=${JSON.stringify(a.clearedCdpEnv)}`)
    observe('格 A 限制', '只探测一个未传给应用的随机空闲端口，不等价于"应用没有开任何调试端口"（不能枚举全部监听），因此 A 只作对照，不作为"应用未开 CDP"的单独证据。')
    await closeAll()

    // =====================================================================================
    // 格 B：应用 + WXMP_CDP_PORT —— 被测格
    // =====================================================================================
    console.log('\n[格 B：应用 + WXMP_CDP_PORT（被测路径）]')
    const portB = await freePort()
    const isoB = prepareIsolation('cdp-B', join(workRoot, 'B'))
    const b = launchDesktop(exe, { profile: isoB.profile, webview: isoB.webview, cdpPort: portB, isolateCdpEnv: true })
    const recB = startRecord('B', exe, b)
    await sleep(16000)
    const rowsB = await watchPort(portB, 6, 2500)
    const childB = childCmdlines(b.pid)
    // 按**实际命令行上的 `--user-data-dir`** 去检查该目录及其子目录；旧实现只看外层，于是"不存在"是查错层的假结论。
    const userDataDirs = extractUserDataDirs(childB.ok ? childB.lines : [])
    const dtap = userDataDirs.length
      ? findDevToolsActivePort(userDataDirs[0])
      : { ok: false, present: false, searched: [], found: [], reason: '子进程命令行 UNKNOWN，无法定位实际 --user-data-dir' }
    const cellB = {
      cell: 'B',
      cdpPortRequested: portB,
      exe,
      pid: b.pid,
      exeHash: b.exeHash,
      identity: recB.identity,
      clearedCdpEnv: b.clearedCdpEnv,
      envOverrides: b.envOverrides,
      samples: rowsB,
      classification: classifySamples(rowsB),
      childProcesses: childB,
      userDataDirs,
      devToolsActivePort: dtap,
    }
    matrix.push(cellB)
    check('B: 被测格采集完成（有采样结果）', rowsB.length > 0, `samples=${rowsB.length}`)
    check('B: 子进程命令行读取结果**如实记录**（读不到就是 UNKNOWN，不写成"没有该参数"）', true, childB.ok ? `via=${childB.via} 行数=${childB.lines.length}` : `UNKNOWN：${JSON.stringify(childB.tried)}`)
    if (childB.ok) {
      const withFlag = childB.lines.filter((l) => l.includes('remote-debugging-port'))
      observe('格 B 子进程', `${childB.lines.length} 个子进程，其中 ${withFlag.length} 个命令行带 remote-debugging-port：${JSON.stringify(withFlag.map((l) => l.slice(0, 160)))}`)
    } else {
      observe('格 B 子进程', `UNKNOWN：命令行读不出来（${JSON.stringify(childB.tried)}）——不能由"读不到"推出"没传该参数"`)
    }
    observe('格 B 状态', `端口 ${portB}：监听=${rowsB.some((r) => r.listening)}；归类=${cellB.classification.state}（detail=${cellB.classification.detail}）`)
    observe(
      '格 B DevToolsActivePort',
      userDataDirs.length
        ? `实际 --user-data-dir=${JSON.stringify(userDataDirs)}；在该目录及子目录中找到 DevToolsActivePort=${dtap.present}（搜过 ${dtap.searched.length} 层目录）`
        : `UNKNOWN：无法定位实际 --user-data-dir（子进程命令行读不出），不把"外层目录没有该文件"当成"不支持 CDP"的证据`,
    )
    observe('格 B 限制', '**固定端口配置下，"没有 DevToolsActivePort 文件"不能单独作为"CDP 不支持"的证据**：该文件是 `--remote-debugging-port=0`（随机端口）时的产物；固定端口时报文仍可能通过 `/json/list` 直接可取。需结合上述采样与 target 结论判断。')
    await closeAll()

    // =====================================================================================
    // 格 C：普通 Edge —— 正对照（证明这台机器上 CDP over TCP 本身可用）
    // =====================================================================================
    console.log('\n[格 C：普通 Edge + --remote-debugging-port（正对照）]')
    const edgeCandidates = [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ]
    const edge = edgeCandidates.find((p) => existsSync(p)) || null
    check('C: 本机存在 msedge.exe（否则正对照无法进行，如实记 UNKNOWN）', Boolean(edge), edge || edgeCandidates.join(' | '))
    if (edge) {
      const portC = await freePort()
      const profileC = join(workRoot, 'C', 'edge-profile')
      const child = spawn(edge, ['--headless=new', `--remote-debugging-port=${portC}`, `--user-data-dir=${profileC}`, '--no-first-run', 'about:blank'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const recC = startRecord('C', edge, { pid: child.pid, exeHash: null })
      await sleep(9000)
      const rowsC = await watchPort(portC, 5, 2000)
      const cellC = { cell: 'C', exe: edge, pid: child.pid, cdpPortRequested: portC, samples: rowsC, classification: classifySamples(rowsC), identity: recC.identity }
      matrix.push(cellC)
      check('C: 正对照采集完成', rowsC.length > 0, `samples=${rowsC.length}`)
      const cOk = rowsC.some((r) => r.listening && r.http && r.http.version.ok)
      observe('格 C', `端口 ${portC}：监听=${rowsC.some((r) => r.listening)}；/json/version 可取=${Boolean(rowsC.find((r) => r.http && r.http.version.ok))}；归类=${cellC.classification.state}`)
      check('C: 正对照结论已记录（无论通不通都写清）', true, cOk ? '普通 Edge 的 CDP over TCP 在本机可用' : '普通 Edge 也没起来 —— 说明问题不在 WebView2 这一层')
      await closeAll()
    } else {
      observe('格 C', 'UNKNOWN：本机找不到 msedge.exe，正对照未执行（不推测结论）')
    }

    // =====================================================================================
    // 格 D：结论汇总（只用本轮新证据，不沿用历史结论）
    // =====================================================================================
    console.log('\n[格 D：矩阵结论]')
    const bRow = matrix.find((m) => m.cell === 'B')
    const clsB = bRow ? bRow.classification : classifySamples([])
    observe('格 B 四态归类', `${clsB.state}（detail=${clsB.detail}；共 ${clsB.sampleCount} 次采样，以最新一次为准）`)
    check('D: 四态归类明确（不是"连不上"这种不可区分的话）', clsB.state !== 'unknown' && clsB.state !== 'no-samples', clsB.state)

    conclusion = {
      cellB: { classification: clsB.state, detail: clsB.detail, listening: Boolean(bRow && bRow.samples.some((r) => r.listening)) },
      cellC: { available: Boolean(matrix.find((m) => m.cell === 'C')), classification: (matrix.find((m) => m.cell === 'C') || {}).classification || null },
      elevation: integrityLevel(),
      childCmdlines: bRow ? bRow.childProcesses : null,
      userDataDirs: bRow ? bRow.userDataDirs : null,
      devToolsActivePort: bRow ? bRow.devToolsActivePort : null,
      /** 只用本轮证据能支持的结论；不能支持的写 UNKNOWN */
      note:
        '本脚本只回答"本轮配置下观察到了什么"。即使格 B 是 TCP 连接失败，也不足以断定"本机永久不开放"或"与仓库无关"——' +
        '需要换运行时版本 / 换机器 / 提权与非提权对照才能进一步区分。固定端口下没有 DevToolsActivePort 文件不能单独作为"CDP 不支持"的证据。',
    }
    observe('格 D 结论', JSON.stringify(conclusion).slice(0, 900))
  }
} catch (e) {
  judge.error('runner', String((e && e.stack ? e.stack.split('\n')[0] : e)))
} finally {
  await closeAll()
  const realAfter = hashInventory(realWorkspaceDir())
  const changed = Object.keys(realAfter).filter((k) => realBefore[k] !== realAfter[k])
  const added = Object.keys(realAfter).filter((k) => !(k in realBefore))
  const removed = Object.keys(realBefore).filter((k) => !(k in realAfter))
  observe(
    '真实工作区完整性',
    `文件数 ${Object.keys(realBefore).length} → ${Object.keys(realAfter).length}；改动=${changed.length} 新增=${added.length} 删除=${removed.length}` +
      `（本脚本全程用隔离 profile；差异不归因于本脚本，也无法排除用户自有实例的写入）`,
  )

  // 收尾判定：**不再固定 true**。未退出 / 身份不明（refused）/ 未追踪 → 失败。
  const notClosed = started.filter((r) => !r.closeResult || r.closeResult.closed !== true || r.closeResult.refused === true)
  const abnormalExit = started.filter((r) => r.closeResult && r.closeResult.exitedBeforeRequest === true)
  check(
    '收尾：本轮启动的自有进程全部已关闭（closed===true 且身份核验通过；未退出/身份 UNKNOWN → 失败）',
    notClosed.length === 0,
    `启动 ${started.length} 个；未正常关闭 ${notClosed.length}（${notClosed.map((r) => r.label + ':' + r.pid).join(',') || '无'}）`,
  )
  check(
    '收尾：没有进程走"请求前已退出"的非正常路径（exitedBeforeRequest 不能证明应用自身退出）',
    abnormalExit.length === 0,
    `已退出 ${abnormalExit.length}（${abnormalExit.map((r) => r.label + ':' + r.pid).join(',') || '无'}）`,
  )
  check(
    '收尾：真实工作区没有被本脚本改写（新增/删除为 0）',
    changed.length === 0 && added.length === 0 && removed.length === 0,
    `新增=${JSON.stringify(added.slice(0, 5))} 删除=${JSON.stringify(removed.slice(0, 5))} 改动=${changed.length}`,
  )

  // 矩阵作为**必需附件**归档（含每个进程的完整关闭结果），并记哈希。
  const matrixWithClose = matrix.map((m) => ({ ...m, closeResult: closeResults.find((c) => c.pid === m.pid) || null }))
  const matrixText = JSON.stringify({ matrix: matrixWithClose, closeResults, conclusion }, null, 2) + '\n'
  const matrixHash = createHash('sha256').update(matrixText).digest('hex')
  observe('矩阵附件', `${join(outDir, 'cdp-matrix.json')}（sha256=${matrixHash}；${matrixWithClose.length} 格、${closeResults.length} 条关闭记录）`)
  observe('产物目录', workRoot)
  console.log('')
  if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
  judge.finish({ label: 'CDP-PREFLIGHT', extraFiles: { 'cdp-matrix.json': matrixText } })
}
