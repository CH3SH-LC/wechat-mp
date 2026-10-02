// cdp-preflight-check.mjs —— cdp-preflight / desktop-harness 的**故障注入回归**（指南 §0.5 R4）
//
// 纯 mock：不启动任何进程、不读密钥、不调用模型、不真实 taskkill、不访问网络。
// 每一处 OS/进程/时间操作都以注入的 probe / alive / runner 替代，目录用系统临时目录。
//
// 覆盖的缺陷（对应 10-02 R4 复核逐条）：
//   1. 收尾身份闭锁：启动身份齐备（PID+映像名+完整路径+创建时刻）才可关；身份不匹配 / UNKNOWN /
//      只读到映像名 → 零关闭操作；每次关闭动作（含强杀）前都重验；已退出被动退出如实标记。
//   2. 矩阵落错目录：矩阵作为**必需附件**（附件写失败 → 非 PASS）。
//   3. 收尾可假绿：cdp-preflight 不再清空追踪、不再固定 true。
//   4. DevToolsActivePort 查错层：按实际 `--user-data-dir` 递归查找。
//   5. 网络分类：TCP 错误分类、HTTP 状态、JSON、target 结构、空 target 后有效 target 以最新为准。
//
// 判定口径：唯一 RunResult（run-result.mjs）。任一断言失败 → 非 PASS、退出非 0。

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createJudge, guardCrashes, resolveOutDir, persistRunResult } from './lib/run-result.mjs'

const outDir = resolveOutDir('cdp-preflight-check')
// 必需检查条数的下界：删掉一条断言立即变红（故意如此）。
const MIN_CHECKS = 30
const judge = createJudge({ script: 'cdp-preflight-check', outDir, minChecks: MIN_CHECKS })
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

const repoRoot = join(import.meta.dirname, '..')
const H = await import('./lib/desktop-harness.mjs')
const has = (n) => typeof H[n] === 'function'

const work = mkdtempSync(join(tmpdir(), 'wxmp-cdp-preflight-check-'))

// =====================================================================================
// 0. 诊断纯函数导出（缺失即回归失败，不崩溃）
// =====================================================================================
console.log('\n[0. harness 诊断纯函数]')
const exportNames = ['classifySamples', 'classifyTcpError', 'classifyTargetList', 'extractUserDataDirs', 'findDevToolsActivePort', 'probeProcessIdentity', 'closeOwnPid']
const missing = exportNames.filter((n) => typeof H[n] !== 'function')
check('harness 导出诊断纯函数', missing.length === 0, missing.length ? `缺：${missing.join(',')}` : exportNames.join(','))

// =====================================================================================
// 1. closeOwnPid 身份闭锁（全部注入：probe / alive / runner）
// =====================================================================================
console.log('\n[1. closeOwnPid 身份闭锁]')
const APP = 'C:\\apps\\wechat-mp-desktop.exe'
const EDGE = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'

// 完整的"本轮启动身份"：闭锁门槛要求四项齐备（PID + 映像名 + 完整路径 + 创建时刻）。
// 字段名沿用 procIdentity() 的输出——expectedImage/actualImage 是同一映像名的两种表述，
// expectedPath/actualPath 同理，门槛与比对都认这两种写法（见 closeOwnPid 里的取值顺序）。
const identityFor = (exePath, image, startTime = 111) => ({
  pid: 987654,
  expectedImage: `${image}.exe`,
  expectedPath: exePath,
  actualImage: image,
  actualPath: exePath,
  actualStartTime: startTime,
})
const APP_ID = identityFor(APP, 'wechat-mp-desktop')

async function runClose(opts) {
  const calls = []
  let alive = opts.aliveInitially !== false
  const probe = opts.probe
  const runner = (args) => {
    calls.push(args)
    if (opts.killOnRunner !== false) alive = false
    return { ok: true }
  }
  const r = await H.closeOwnPid(987654, {
    exe: opts.exe,
    expectedIdentity: opts.expectedIdentity || null,
    gracefulMs: opts.gracefulMs != null ? opts.gracefulMs : 400,
    forceMs: opts.forceMs != null ? opts.forceMs : 150,
    probe,
    alive: opts.aliveFn || (() => alive),
    runner,
  })
  return { r, calls, aliveAfter: alive }
}

// 1a. 身份不匹配（映像名不同）→ 零关闭操作
// 传完整启动身份，让这条仍然走"比对失败"分支；否则会先被 1h 的齐备门槛拦下，语义就变了。
{
  const { r, calls } = await runClose({
    exe: APP,
    expectedIdentity: APP_ID,
    probe: () => ({ ok: true, via: 'mock', image: 'other.exe', path: 'C:\\other\\other.exe', startTime: 5 }),
  })
  check('身份不匹配 → refused，零关闭操作', r.refused === true && r.closed === false && calls.length === 0, `refused=${r.refused} via=${r.via} calls=${calls.length}`)
}

// 1b. 身份 UNKNOWN（probe 取不到）→ 零关闭操作
{
  const { r, calls } = await runClose({
    exe: APP,
    expectedIdentity: APP_ID,
    probe: () => ({ ok: false, via: null, image: null, path: null, startTime: null, error: 'powershell 失败 + tasklist 无结果' }),
  })
  check('身份 UNKNOWN → refused，零关闭操作', r.refused === true && calls.length === 0 && r.reverifiedIdentity && r.reverifiedIdentity.matchesExpected === null, `refused=${r.refused} calls=${calls.length} matches=${r.reverifiedIdentity && r.reverifiedIdentity.matchesExpected}`)
}

// 1c. 身份匹配 → 可关闭（注入假 killer，WM_CLOSE 路径）
{
  const { r, calls } = await runClose({
    exe: APP,
    expectedIdentity: APP_ID,
    probe: () => ({ ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111 }),
  })
  check('身份匹配 → 正常走 WM_CLOSE（假 killer）', r.closed === true && r.refused !== true && r.via === 'wm-close' && calls.length === 1 && calls[0][0] === '/PID' && !calls[0].includes('/F'), JSON.stringify({ closed: r.closed, via: r.via, calls }))
}

// 1d. 进程已不在 → exitedBeforeRequest 标记非正常退出路径
{
  const calls = []
  const r = await H.closeOwnPid(987654, {
    exe: APP,
    alive: () => false,
    probe: () => ({ ok: false }),
    runner: (a) => {
      calls.push(a)
      return { ok: true }
    },
  })
  check('已退出 → 保留 closed:true 但 exitedBeforeRequest:true（非正常退出路径）', r.closed === true && r.exitedBeforeRequest === true && calls.length === 0, JSON.stringify({ closed: r.closed, exitedBeforeRequest: r.exitedBeforeRequest, note: r.note ? r.note.slice(0, 40) : null }))
}

// 1e. 用调用方传入的 exe 核验：Edge 用 Edge 自身 exe 可通过
{
  const { r } = await runClose({ exe: EDGE, expectedIdentity: identityFor(EDGE, 'msedge', 9), probe: () => ({ ok: true, via: 'mock', image: 'msedge.exe', path: EDGE, startTime: 9 }) })
  check('每进程用自身 exe 核验：Edge 用 msedge.exe 可通过', r.closed === true && r.refused !== true, `closed=${r.closed}`)
}

// 1f. 传错 exe（用应用 exe 核验 Edge 映像）→ refused
{
  const { r, calls } = await runClose({ exe: APP, expectedIdentity: APP_ID, probe: () => ({ ok: true, via: 'mock', image: 'msedge.exe', path: EDGE, startTime: 9 }) })
  check('传错 exe 核验（应用 exe vs Edge 映像）→ refused', r.refused === true && calls.length === 0, `refused=${r.refused} calls=${calls.length}`)
}

// 1g. procIdentity 的"身份齐备"标志：四个维度齐全才算 complete，缺项进 missingFields
//     （10-02 晚复核的反例 1：只读到映像名、path/startTime 为 null 也曾被当成"身份确认"）
{
  const full = H.procIdentity(987654, APP, { probe: () => ({ ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111 }), alive: () => true })
  // tasklist 回退的真实形状：ok=true 但只有映像名
  const partial = H.procIdentity(987654, APP, { probe: () => ({ ok: true, via: 'tasklist', image: 'wechat-mp-desktop', path: null, startTime: null }), alive: () => true })
  const ok =
    full.identityComplete === true &&
    (full.missingFields || []).length === 0 &&
    partial.identityComplete === false &&
    (partial.missingFields || []).includes('actualPath') &&
    (partial.missingFields || []).includes('actualStartTime')
  check('procIdentity 身份齐备标志：四字段齐全才 complete，缺项进 missingFields', ok, JSON.stringify({ full: { idComplete: full.identityComplete, missing: full.missingFields }, partial: { idComplete: partial.identityComplete, missing: partial.missingFields } }))
}

// 1h. 只给 exe、没有本轮启动身份 → 齐备门槛拒绝，零关闭操作（release-smoke 旧调用的形状）
{
  const { r, calls } = await runClose({
    exe: APP,
    probe: () => ({ ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111 }),
  })
  check('无启动身份（只给 exe）→ refused（incomplete-identity），零关闭操作', r.refused === true && r.closed === false && r.via === 'incomplete-identity' && calls.length === 0 && Boolean(r.reason), JSON.stringify({ refused: r.refused, via: r.via, calls: calls.length, missing: r.missingFields }))
}

// 1i. 启动身份缺创建时刻 → 齐备门槛拒绝，零关闭操作
{
  const partial = { ...APP_ID }
  delete partial.actualStartTime
  const { r, calls } = await runClose({ exe: APP, expectedIdentity: partial, probe: () => ({ ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111 }) })
  check('启动身份缺创建时刻 → refused（incomplete-identity），零关闭操作', r.refused === true && r.via === 'incomplete-identity' && calls.length === 0, JSON.stringify({ refused: r.refused, via: r.via, calls: calls.length, missing: r.missingFields }))
}

// 1j. 启动身份缺完整路径 → 齐备门槛拒绝，零关闭操作
{
  const partial = { pid: 987654, expectedImage: 'wechat-mp-desktop.exe', actualImage: 'wechat-mp-desktop', actualStartTime: 111 }
  const { r, calls } = await runClose({ exe: APP, expectedIdentity: partial, probe: () => ({ ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111 }) })
  check('启动身份缺完整路径 → refused（incomplete-identity），零关闭操作', r.refused === true && r.via === 'incomplete-identity' && calls.length === 0, JSON.stringify({ refused: r.refused, via: r.via, calls: calls.length, missing: r.missingFields }))
}

// 1k. 探针只读到同名映像、path/startTime 为 null（tasklist 回退形状）→ refused，零关闭操作
//     （10-02 晚复核的反例 1 原文）
{
  const { r, calls } = await runClose({
    exe: APP,
    expectedIdentity: APP_ID,
    probe: () => ({ ok: true, via: 'tasklist', image: 'wechat-mp-desktop', path: null, startTime: null }),
  })
  check('探针只读到同名映像（path/startTime 为 null）→ refused，零关闭操作', r.refused === true && r.closed === false && calls.length === 0, JSON.stringify({ refused: r.refused, via: r.via, calls: calls.length, reasons: r.reverifiedIdentity && r.reverifiedIdentity.matchReasons }))
}

// 1l. 温和关闭等待后、强杀之前身份变化（等待期 PID 被回收复用）→ 拒绝强杀
//     （10-02 晚复核的反例 2 原文：替身在正常关闭请求后把 PID 换成另一个进程）
{
  let probeCount = 0
  const probe = () => {
    probeCount += 1
    // 第一次（关闭前核验）身份正确；第二次（强杀前再核验）创建时刻变成另一个进程。
    // 差值远大于 startTimeToleranceMs（3000），确保是"明确不一致"而不是容差内抖动。
    return probeCount === 1
      ? { ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111111 }
      : { ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 999999 }
  }
  const { r, calls } = await runClose({
    exe: APP,
    expectedIdentity: identityFor(APP, 'wechat-mp-desktop', 111111),
    probe,
    killOnRunner: false, // runner 不改 alive：这里要证明的是"身份变了就不再强杀"，不是"进程被杀了"
    gracefulMs: 50,
    forceMs: 50,
  })
  const noForce = !calls.some((a) => a.includes('/F'))
  check('强杀前身份变化 → refused（identity-changed-before-force），只发过温和关闭一次、无 /F', r.refused === true && r.via === 'identity-changed-before-force' && calls.length === 1 && noForce, JSON.stringify({ refused: r.refused, via: r.via, calls, reverifiedBeforeForce: r.reverifiedBeforeForce && r.reverifiedBeforeForce.matchesExpected }))
}

// 1m. 温和等待期间进程自己退出（只是退得慢）→ 算应用退出路径，via wm-close-late，不再强杀
{
  // 假 alive：关闭前核验 / 温和等待判定 / 超时后的 `!alive` 判定 三次返回 true，
  // 第四次（强杀前的再核验）返回 false。runner 全程不改 alive（退出不是它造成的）。
  // gracefulMs=0 让循环只做一次判定，调用次序确定：①关闭前 ②循环判定 ③超时后判活 ④强杀前再核验。
  let aliveCalls = 0
  const aliveFn = () => {
    aliveCalls += 1
    return aliveCalls <= 3
  }
  const { r, calls } = await runClose({
    exe: APP,
    expectedIdentity: APP_ID,
    probe: () => ({ ok: true, via: 'mock', image: 'wechat-mp-desktop', path: APP, startTime: 111 }),
    killOnRunner: false,
    gracefulMs: 0,
    forceMs: 0,
    aliveFn,
  })
  check('温和等待期间进程退出 → via wm-close-late（closed=true, forced=false），无 /F', r.closed === true && r.forced === false && r.refused === false && r.via === 'wm-close-late' && !calls.some((a) => a.includes('/F')), JSON.stringify({ closed: r.closed, forced: r.forced, via: r.via, calls }))
}

// =====================================================================================
// 2. 网络分类纯函数
// =====================================================================================
console.log('\n[2. 网络分类]')
if (has('classifyTcpError')) {
  const a = H.classifyTcpError('ECONNREFUSED')
  const b = H.classifyTcpError('ETIMEDOUT')
  const c = H.classifyTcpError('EACCES')
  check('classifyTcpError 区分 ECONNREFUSED / ETIMEDOUT / 其它', a === 'econnrefused' && b === 'etimedout' && c !== a && c !== b && c.startsWith('error:'), `${a} / ${b} / ${c}`)
} else {
  check('classifyTcpError 区分 ECONNREFUSED / ETIMEDOUT / 其它', false, 'classifyTcpError 未导出')
}

if (has('classifyTargetList')) {
  const status500 = H.classifyTargetList({ ok: true, status: 500, json: { error: 'x' } })
  const badJson = H.classifyTargetList({ ok: true, status: 200, json: null, textHead: 'not json' })
  const malformed = H.classifyTargetList({ ok: true, status: 200, json: [{ url: 'about:blank' }] })
  const empty = H.classifyTargetList({ ok: true, status: 200, json: [] })
  const valid = H.classifyTargetList({ ok: true, status: 200, json: [{ id: 'A', url: 'http://127.0.0.1/', webSocketDebuggerUrl: 'ws://x' }] })
  const ok = status500 === 'http-status-500' && badJson === 'http-json-invalid' && malformed === 'targets-malformed' && empty === 'targets-empty' && valid === 'targets-valid'
  check('classifyTargetList 区分非 200 / JSON 坏 / 结构不符 / 空 / 有效', ok, [status500, badJson, malformed, empty, valid].join(' , '))
} else {
  check('classifyTargetList 区分非 200 / JSON 坏 / 结构不符 / 空 / 有效', false, 'classifyTargetList 未导出')
}

if (has('classifySamples')) {
  // 空 target 先于有效 target → 以最新为准，必须判为 targets-present（不能因历史空 target 误判）
  const rows = [
    { at: 1, listening: true, tcpKind: null, http: { list: { ok: true, status: 200, json: [] } } },
    { at: 2, listening: true, tcpKind: null, http: { list: { ok: true, status: 200, json: [{ id: 'A', url: 'u', webSocketDebuggerUrl: 'ws' }] } } },
  ]
  const s = H.classifySamples(rows)
  check('classifySamples 空 target 后有效 target → 以最新为准（targets-present）', s.state === 'targets-present', `${s.state}（samples=${s.sampleCount}）`)
} else {
  check('classifySamples 空 target 后有效 target → 以最新为准（targets-present）', false, 'classifySamples 未导出')
}

if (has('classifySamples')) {
  const refused = H.classifySamples([{ at: 1, listening: false, tcpKind: 'econnrefused', http: null }]).state
  const timedout = H.classifySamples([{ at: 1, listening: false, tcpKind: 'etimedout', http: null }]).state
  const other = H.classifySamples([{ at: 1, listening: false, tcpKind: 'error:EACCES', http: null }]).state
  const ok = refused === 'tcp-econnrefused' && timedout === 'tcp-etimedout' && other === 'tcp-error-other'
  check('classifySamples 区分 TCP 错误三类', ok, `${refused} / ${timedout} / ${other}`)
} else {
  check('classifySamples 区分 TCP 错误三类', false, 'classifySamples 未导出')
}

if (has('classifySamples')) {
  const httpStatus = H.classifySamples([{ at: 1, listening: true, http: { list: { ok: true, status: 502, json: {} } } }]).state
  const jsonBad = H.classifySamples([{ at: 1, listening: true, http: { list: { ok: true, status: 200, json: null } } }]).state
  const struct = H.classifySamples([{ at: 1, listening: true, http: { list: { ok: true, status: 200, json: [{ url: 'x' }] } } }]).state
  const success = H.classifySamples([{ at: 1, listening: true, http: { list: { ok: true, status: 200, json: [{ id: 'A', url: 'u', webSocketDebuggerUrl: 'ws' }] } } }]).state
  const ok = httpStatus === 'http-status-non-200' && jsonBad === 'http-json-invalid' && struct === 'target-structure-mismatch' && success === 'targets-present'
  check('classifySamples 区分 HTTP 非 200 / JSON 坏 / 结构不符 / 连接成功', ok, [httpStatus, jsonBad, struct, success].join(' , '))
} else {
  check('classifySamples 区分 HTTP 非 200 / JSON 坏 / 结构不符 / 连接成功', false, 'classifySamples 未导出')
}

// =====================================================================================
// 3. DevToolsActivePort 按实际 user-data-dir 查找（临时目录，无进程）
// =====================================================================================
console.log('\n[3. DevToolsActivePort 定位]')
if (has('extractUserDataDirs')) {
  const lines = ['"C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\154.0\\msedgewebview2.exe" --type=renderer --remote-debugging-port=61856 --user-data-dir="C:\\Temp\\B\\webview\\EBWebView" --no-sandbox']
  const dirs = H.extractUserDataDirs(lines)
  check('extractUserDataDirs 取命令行上的实际 --user-data-dir', Array.isArray(dirs) && dirs.length === 1 && /EBWebView$/i.test(dirs[0]), JSON.stringify(dirs))
} else {
  check('extractUserDataDirs 取命令行上的实际 --user-data-dir', false, 'extractUserDataDirs 未导出')
}

if (has('findDevToolsActivePort')) {
  const outer = join(work, 'webview')
  const inner = join(outer, 'EBWebView')
  mkdirSync(inner, { recursive: true })
  writeFileSync(join(inner, 'DevToolsActivePort'), '61856\n/devtools/browser/abc\n')
  const found = H.findDevToolsActivePort(outer)
  check('findDevToolsActivePort 按实际 user-data-dir 递归找到下一层文件', found && found.present === true && found.found.some((f) => /EBWebView/i.test(f)), JSON.stringify(found && { present: found.present, found: found.found }))
} else {
  check('findDevToolsActivePort 按实际 user-data-dir 递归找到下一层文件', false, 'findDevToolsActivePort 未导出')
}

if (has('findDevToolsActivePort')) {
  const empty = join(work, 'webview-empty')
  mkdirSync(empty, { recursive: true })
  const r = H.findDevToolsActivePort(empty)
  check('findDevToolsActivePort 无该文件 → present=false（并保留搜索路径）', r && r.present === false && Array.isArray(r.searched) && r.searched.length > 0, JSON.stringify({ present: r && r.present, searched: r && r.searched.length }))
} else {
  check('findDevToolsActivePort 无该文件 → present=false（并保留搜索路径）', false, 'findDevToolsActivePort 未导出')
}

// =====================================================================================
// 4. 矩阵为必需附件：附件写失败 → 非 PASS（用共享判定器，纯写盘）
// =====================================================================================
console.log('\n[4. 矩阵必需附件]')
{
  const good = join(work, 'attach-good')
  const okRes = persistRunResult({ dir: good, files: { 'cdp-matrix.json': '{}\n' }, verdict: (errors) => ({ status: errors.length ? 'ERROR' : 'PASS', errors }) })
  const bad = join(work, 'attach-bad')
  mkdirSync(bad, { recursive: true })
  mkdirSync(join(bad, 'cdp-matrix.json'), { recursive: true }) // 用同名目录占位，让附件写入失败
  writeFileSync(join(bad, 'cdp-matrix.json', 'occupant'), 'x')
  const badRes = persistRunResult({ dir: bad, files: { 'cdp-matrix.json': '{}\n' }, verdict: (errors) => ({ status: errors.length ? 'ERROR' : 'PASS', errors }) })
  check('persistRunResult：附件可写 → ok=true（对照）', okRes.ok === true, JSON.stringify({ ok: okRes.ok, errors: okRes.errors }))
  check('矩阵为必需附件：附件写失败 → 非 PASS 且 errors 含附件名', badRes.ok === false && badRes.run && badRes.run.status === 'ERROR' && badRes.errors.some((e) => e.file === 'cdp-matrix.json'), JSON.stringify({ ok: badRes.ok, status: badRes.run && badRes.run.status, errors: badRes.errors }))
}

// =====================================================================================
// 5. cdp-preflight 源码结构回归（读文件，不执行）
// =====================================================================================
console.log('\n[5. cdp-preflight 源码结构]')
const preflightSrc = readFileSync(join(repoRoot, 'scripts', 'cdp-preflight.mjs'), 'utf8')
const harnessSrc = readFileSync(join(repoRoot, 'scripts', 'lib', 'desktop-harness.mjs'), 'utf8')
check('cdp-preflight 把矩阵作为必需附件（extraFiles 内含 cdp-matrix.json）', /extraFiles/.test(preflightSrc) && preflightSrc.includes('cdp-matrix.json'), '需 finish({ extraFiles: { "cdp-matrix.json": ... } })')
check('cdp-preflight 不再读不存在的 judge.run.outDir', !preflightSrc.includes('judge.run.outDir'), preflightSrc.includes('judge.run.outDir') ? '仍存在 judge.run.outDir' : '已移除')
check('cdp-preflight 不再无条件清空 startedPids 追踪', !/startedPids\.length\s*=\s*0/.test(preflightSrc), /startedPids\.length\s*=\s*0/.test(preflightSrc) ? '仍有 startedPids.length = 0' : '已移除')
check('cdp-preflight A 对照显式清继承的 CDP 环境覆盖（isolateCdpEnv）', preflightSrc.includes('isolateCdpEnv'), preflightSrc.includes('isolateCdpEnv') ? '已接入' : '未接入')
check('desktop-harness 注释不再声称 setter 覆盖环境变量', !/覆盖掉/.test(harnessSrc) && harnessSrc.includes('追加'), /覆盖掉/.test(harnessSrc) ? '仍称覆盖' : '已改为追加语义')
check('closeOwnPid 在任何关闭前以 matchesExpected!==true 拒绝（零关闭）', harnessSrc.includes('refused: true') && harnessSrc.includes('matchesExpected !== true'), '需有身份拒绝分支')

// =====================================================================================
console.log('')
observe('临时目录', work)
if (failed) console.log(`（其中 ${failed} 条断言未通过）`)
judge.finish({ label: 'CDP-PREFLIGHT-CHECK' })
