// live-acceptance.mjs —— 「真机 + 真实模型」四回合验收（DS 修复指南 §8，2026-09-30）
//
// ⚠️ 这个脚本花**真钱**、用**真实模型**，**必须由人手动执行**。
//    它会启动打包好的桌面应用（缺省 `src-tauri/target/release/wechat-mp-desktop.exe`），
//    在真实界面上发真实消息，由真实 Rust 调用链打到真实 DeepSeek 端点（模型在源码里锁定为
//    deepseek-flash，见 chat.rs 的 LOCKED_MODEL）。本脚本**没有**无人值守开关，也不在 CI /
//    构建 / 其它脚本里被拉起；没有 `--yes` 一类的自动确认参数。
//    预算（指南 §8.1）：整批累计最多 20 次可能计费的 completion 派发，其中 gen_svg 最多 4 次；
//    账本写在隔离目录的 ledger.json 里，**跨 phase 累加不清零**，额度不足时拒绝派发并把该 phase 记 BLOCKED。
//
// 用法（一个 phase 一次）：
//   node scripts/live-acceptance.mjs L1                       # 首篇一图
//   node scripts/live-acceptance.mjs L2 --root <上面那次打印的 root>
//   node scripts/live-acceptance.mjs L3 --root <同一个 root>   # 接着 L1/L2 的会话继续
//   node scripts/live-acceptance.mjs L4 --root <同一个 root>
//   node scripts/live-acceptance.mjs L5 --root <同一个 root>   # 关停 + 新 PID 重开，不新增模型调用
//   node scripts/live-acceptance.mjs L6 --root <同一个 root>   # 导出，不新增模型调用
//
//   其它可选参数：
//     --exe <path>            指定被测 exe（缺省 src-tauri/target/release/wechat-mp-desktop.exe）
//     --turn-timeout <ms>     单回合等待上限（缺省 600000，指南参考值约 5 分钟/回合）
//     --max-dispatches <n>    整批派发上限（缺省 20，允许调小做"更省"的批次）
//     --max-gen-svg <n>       整批绘图上限（缺省 4）
//   退出码：PASS=0，FAIL=1，BLOCKED=2，ERROR=1（与 statusOf 一一对应）。
//
// ── 隔离为什么是安全的（别改成"手工设环境变量"那一套）────────────────────────────
//   2026-09-29 出过一次真实事故：某个子任务忘了设 `USERPROFILE`，直接启动了真实应用跑了一个
//   创作回合，真实工作区因此多出 3 枚素材、2 个会话被改写，消耗了真实额度且无法还原。
//   本脚本因此**完全复用** `scripts/lib/desktop-harness.mjs` 的隔离四件套，一条都不自己重写：
//     1. 子进程专属 `USERPROFILE` → 应用据此拼出 `<profile>/Documents/wechat-mp-workspace`，
//        真实工作区 `<真实用户>/Documents/wechat-mp-workspace` **全程只读核对**；
//     2. 子进程专属 `WEBVIEW2_USER_DATA_FOLDER` → WebView2 的 profile 与真实实例分开
//        （只设 USERPROFILE 不够：WebView2 的数据目录仍可能落在真实用户目录下）；
//     3. 本轮现取的空闲回环 CDP 端口（`freePort`）→ 不与用户正在开的实例撞车；
//     4. 背景 helper 隐藏窗口（`windowsHide: true`）。
//   `prepareIsolation` 还会做硬性断言：隔离目录解析后既不等于真实工作区、也不与之嵌套，否则拒绝启动。
//   另有三条纪律：
//     · 只关闭**本轮确切启动的那个 PID**（`closeOwnPid`，先温和后强制）；绝不 `taskkill` 任何其它进程，
//       更不会去关用户自己开着的实例；
//     · 密钥只从 `~/.dsh/.credentials.yaml` 解析、**只**经 `launchDesktop` 的 `extraEnv` 传给子进程；
//       不写进任何证据文件、不打印、不提交。所有落盘前都会扫一遍密钥（`assertNoSecret`）；
//     · 真实工作区在每个 phase 前后各做一次完整文件哈希清单，差异**只作为观测**写进证据（见
//       §观测与归因限制）——指南 §8.2 第 4 条明确：不能因为"计数相同"就声称完全没变，
//       也不能为了消掉差异去动用户自己的实例。
//
// ── 判定口径（指南 §3.1）────────────────────────────────────────────────────
//   唯一判定结果 `run-result.json`（status / executionComplete / plannedCases / executedCases /
//   checks / errors），stdout、JSON、Markdown、退出码全部从它派生。异常写 ERROR、缺依赖或端口不通写
//   BLOCKED、**零条检查是错误不是通过**。每次运行写一个**新证据目录**，已存在同名结果就拒绝覆盖。
//
// ── 引用协议与字数口径（指南 §8.3 第一段）──────────────────────────────────────
//   字数口径固定为「文章正文可见文字，去空白；不计标题和纯图片，不以 raw 协议计字数」；
//   实际计数的字符串会原样存进证据（`counted`）。题面逐字取自指南 §8.3 表格，不做改写、不偷偷补指令。

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir, tmpdir } from 'node:os'
import {
  closeOwnPid,
  diffInventory,
  freePort,
  hashInventory,
  launchDesktop,
  prepareIsolation,
  realWorkspaceDir,
  waitForCdp,
} from './lib/desktop-harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// =====================================================================================
// 第 0 节：参数
// =====================================================================================

const argv = process.argv.slice(2)
const PHASES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']
const phase = String(argv.find((a) => PHASES.includes(a.toUpperCase())) || '').toUpperCase()
const opt = (name, def = null) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def
}
// 缺省 root 用**固定** tag：不固定的话 L1..L6 每次都会落到不同目录，"接着 L1 的会话继续"就不成立。
const DEFAULT_ROOT_TAG = 'wxmp-live-libnotice'
const rootArg = opt('root', null)
const root = resolve(rootArg || join(process.env.TEMP || process.env.TMP || tmpdir(), DEFAULT_ROOT_TAG))
const exeArg = opt('exe', null)
const exe = resolve(exeArg || join(repoRoot, 'src-tauri', 'target', 'release', 'wechat-mp-desktop.exe'))
const TURN_TIMEOUT_MS = Number(opt('turn-timeout', '600000'))
const MAX_DISPATCHES = Number(opt('max-dispatches', '20'))
const MAX_GEN_SVG = Number(opt('max-gen-svg', '4'))

const CONFIG_HINT = `用法：node scripts/live-acceptance.mjs <L1|L2|L3|L4|L5|L6> [--root <dir>] [--exe <path>]
  · L1..L4 必须共用同一个 --root（同一 profile / workspace / 会话），L5/L6 也用同一个；
  · 缺省 root：${join(process.env.TEMP || process.env.TMP || tmpdir(), DEFAULT_ROOT_TAG)}`

// =====================================================================================
// 第 1 节：唯一判定结果（指南 §3.1）——所有输出从它派生
// =====================================================================================

const run = {
  script: 'live-acceptance',
  phase: phase || '(未指定)',
  status: 'BLOCKED',
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [],
  errors: [],
  observations: [],
  blockedReason: null,
  startedAt: new Date().toISOString(),
}
const LOG = []
const evidence = {
  phase,
  createdAt: new Date().toISOString(),
  root,
  realWorkspace: realWorkspaceDir(),
  isolation: null,
  inputFingerprints: {},
  launches: [],
  turns: [],
  ledgerBefore: null,
  ledgerAfter: null,
  realWorkspaceInventory: [],
  launchReadbacks: [],
  exportInventory: null,
  notes: [],
}

function log(line = '') {
  console.log(line)
  LOG.push(line)
}
function check(id, pass, extra = '') {
  const line = `  ${pass ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + clip(extra, 400) + ')' : ''}`
  log(line)
  run.checks.push({ id, pass: Boolean(pass), evidence: extra ? [clip(String(extra), 4000)] : [] })
  return Boolean(pass)
}
function observe(id, detail) {
  run.observations.push({ id, detail: clip(String(detail), 4000) })
}
function fail(stage, message) {
  const msg = clip(String(message), 2000)
  run.errors.push({ stage, message: msg })
  console.error(`[live-acceptance] ERROR@${stage}: ${msg}`)
}
function block(stage, message) {
  run.blockedReason = clip(String(message), 2000)
  fail(stage, `BLOCKED：${message}`)
}
function clip(s, n) {
  const t = String(s == null ? '' : s)
  return t.length > n ? t.slice(0, n) + '…' : t
}
function statusOf() {
  if (run.blockedReason) return 'BLOCKED'
  if (run.errors.length) return 'ERROR'
  if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) return 'ERROR'
  if (run.checks.length === 0) return 'ERROR' // 零条检查是错误，不是通过
  return run.checks.some((c) => !c.pass) ? 'FAIL' : 'PASS'
}
/** 本 phase 到此为止的检查是否全过（用于决定要不要把它写成 L5 的基准） */
function checksSoFarOk() {
  return run.checks.length > 0 && run.checks.every((c) => c.pass) && !run.errors.length
}

// =====================================================================================
// 第 2 节：密钥（绝不落盘 / 绝不打印）
// =====================================================================================

let SECRET = null

/** 与 `src-tauri/src/chat.rs` 的 `parse_credentials` 同一口径：逐行找 DEEPSEEK_API_KEY，去引号去空白 */
function parseCredentials(content) {
  for (const line of String(content).split(/\r?\n/)) {
    const l = line.trim()
    if (!l.startsWith('DEEPSEEK_API_KEY')) continue
    let rest = l.slice('DEEPSEEK_API_KEY'.length)
    rest = rest.replace(/^:?/, '')
    rest = rest.trim()
    rest = rest.replace(/^['"]|['"]$/g, '')
    if (rest) return rest
  }
  return null
}
function loadKey() {
  const p = join(homedir(), '.dsh', '.credentials.yaml')
  if (!existsSync(p)) block('credentials', `找不到 ${p}（也可用环境变量 DEEPSEEK_API_KEY，但本脚本按指南只从该文件读取）`)
  let raw = ''
  try {
    raw = readFileSync(p, 'utf8')
  } catch (e) {
    block('credentials', `读取 ${p} 失败：${e.message}`)
  }
  const k = parseCredentials(raw)
  if (!k) block('credentials', `${p} 里没有可用的 DEEPSEEK_API_KEY`)
  SECRET = k
  return k
}
/** 落盘前的硬门禁：证据里出现密钥即算失败（服务端回显的错误串也可能带上，一律扫） */
function assertNoSecret(text, where) {
  const s = String(text)
  if (SECRET && s.includes(SECRET)) throw new Error(`证据 ${where} 里出现了密钥——拒绝落盘`)
  const m = s.match(/sk-[A-Za-z0-9_-]{16,}/)
  if (m) throw new Error(`证据 ${where} 里出现疑似密钥（${m[0].slice(0, 6)}…）——拒绝落盘`)
}

// =====================================================================================
// 第 3 节：文件 / 哈希 / 证据落盘
// =====================================================================================

let evidenceDir = ''
function ensureDir(p) {
  mkdirSync(p, { recursive: true })
  return p
}
const sha256Text = (s) => createHash('sha256').update(String(s)).digest('hex')
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}
/** 写 JSON 证据（含密钥扫描）。任何写入失败都升级成 ERROR，不静默。 */
function writeJsonEvidence(absPath, obj, where = absPath) {
  const text = JSON.stringify(obj, null, 2) + '\n'
  try {
    assertNoSecret(text, where)
  } catch (e) {
    fail('secret', e.message)
    return false
  }
  ensureDir(dirname(absPath))
  try {
    writeFileSync(absPath, text, 'utf8')
    return true
  } catch (e) {
    fail('io', `写 ${where} 失败：${e.message}`)
    return false
  }
}
function writeFileEvidence(absPath, text, where = absPath) {
  try {
    assertNoSecret(text, where)
  } catch (e) {
    fail('secret', e.message)
    return false
  }
  ensureDir(dirname(absPath))
  try {
    writeFileSync(absPath, text, 'utf8')
    return true
  } catch (e) {
    fail('io', `写 ${where} 失败：${e.message}`)
    return false
  }
}
/** 每次运行一个新证据目录：已存在同名结果目录就拒绝覆盖（指南 §3.2） */
function makeEvidenceDir() {
  const tag = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${Math.random().toString(16).slice(2, 10)}`
  const dir = join(root, 'evidence', `${phase || 'unknown'}-${tag}`)
  ensureDir(dir)
  return dir
}

// =====================================================================================
// 第 4 节：题面（**逐字**取自指南 §8.3 表格，不做改写、不偷偷补指令）
// =====================================================================================

const PROMPTS = {
  // L1 首篇一图
  L1:
    '请直接写一篇校园图书馆短通知，采用默认校园风格，不再询问。固定测试情境：2026年10月10日周六 9:00–17:00 开放；' +
    '2026年10月11日周日全天闭馆；自习区在一楼；咨询电话010-55556666。标题“校园图书馆开放通知”，正文不超过180字。' +
    '只配一张开篇横图：暖色台灯照亮蓝色书本，不要照片位、角饰或额外图片。',
  // L2 只改文字
  L2:
    '将标题改为“周末到馆提醒”，正文更简洁且不超过180字；完整保留开放日期时段、周日全天闭馆、一楼自习区和电话。' +
    '只改文字，现有配图和所有素材保持原样。',
  // L3 当前普通问答
  L3: '只解释 NOT READY 这个词是什么意思，不修改文章或配图，也不要生成新稿。',
  // L4 明确换图
  L4:
    '将现有开篇横图重新绘制为：晴天里图书馆窗边的一株绿色盆栽和合上的红色书，画面无文字。明确新画，只换这张图；' +
    '标题和全部正文保持原样，不增加其他素材。',
}

/** 每个 phase 的额度与写不写稿。maxDispatches 是本回合的**中止线**（超了就停手并 BLOCKED），不是目标值。 */
const PHASE_PLAN = {
  L1: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 3, title: '校园图书馆开放通知' },
  L2: { writes: true, minDispatches: 2, maxDispatches: 4, maxGenSvg: 0, title: '周末到馆提醒' },
  L3: { writes: false, minDispatches: 1, maxDispatches: 3, maxGenSvg: 0, title: null },
  L4: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 2, title: '周末到馆提醒' },
  L5: { writes: false, minDispatches: 0, maxDispatches: 0, maxGenSvg: 0, title: null },
  L6: { writes: false, minDispatches: 0, maxDispatches: 0, maxGenSvg: 0, title: null },
}

// =====================================================================================
// 第 5 节：账本（跨 phase 累加，派发**之前**检查额度）
// =====================================================================================

const ledgerPath = join(root, 'ledger.json')
const lockPath = join(root, '.live-acceptance.lock')

function loadLedger() {
  const j = readJson(ledgerPath)
  if (!j || j.schema !== 1) {
    return {
      schema: 1,
      createdAt: new Date().toISOString(),
      root,
      budget: { maxDispatches: MAX_DISPATCHES, maxGenSvg: MAX_GEN_SVG },
      totals: { dispatches: 0, genSvg: 0 },
      phases: [],
      note: '所有 prep/write/revise/补描述/绘图调用合并计数；新批次不清零（指南 §8.1）',
    }
  }
  // 额度参数可以被调小（例如只想花更少的钱），但**不会**被调大超过本次命令行给出的上限
  j.budget = { maxDispatches: Math.min(j.budget?.maxDispatches ?? MAX_DISPATCHES, MAX_DISPATCHES), maxGenSvg: Math.min(j.budget?.maxGenSvg ?? MAX_GEN_SVG, MAX_GEN_SVG) }
  j.totals = j.totals || { dispatches: 0, genSvg: 0 }
  j.phases = j.phases || []
  return j
}
const remaining = (led) => ({
  dispatches: led.budget.maxDispatches - led.totals.dispatches,
  genSvg: led.budget.maxGenSvg - led.totals.genSvg,
})
function saveLedger(led) {
  led.updatedAt = new Date().toISOString()
  writeJsonEvidence(ledgerPath, led, 'ledger.json')
}
function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
function acquireLock() {
  ensureDir(root)
  const holder = readJson(lockPath)
  if (holder && holder.pid && holder.pid !== process.pid && isPidAlive(holder.pid)) {
    block('lock', `另一个 phase 正在运行（pid=${holder.pid}，phase=${holder.phase}，起于 ${holder.at}）。同一 profile 不得同时跑两个实例。`)
    return false
  }
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, phase, at: new Date().toISOString() }), 'utf8')
  return true
}
function releaseLock() {
  const holder = readJson(lockPath)
  if (holder && holder.pid === process.pid) {
    try {
      writeFileSync(lockPath, JSON.stringify({ pid: 0, phase: '(released)', at: new Date().toISOString() }), 'utf8')
    } catch {
      /* 释放失败不影响退出码 */
    }
  }
}

function recordLedger(led, { dispatches, genSvg, note }) {
  const prev = { ...led.totals }
  led.totals.dispatches += dispatches
  led.totals.genSvg += genSvg
  led.phases.push({
    phase,
    at: new Date().toISOString(),
    dispatches,
    genSvg,
    prev,
    after: { ...led.totals },
    remaining: remaining(led),
    note,
  })
  saveLedger(led)
}

// =====================================================================================
// 第 6 节：trace 读取（派发计数的权威来源之一）
// =====================================================================================

/** 读 `<workspace>/traces/*.jsonl`，只取 `sinceMs` 之后写入的回合日志 */
function traceRecordsSince(workspace, sinceMs) {
  const dir = join(workspace, 'traces')
  const out = []
  const files = []
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return { records: [], files: [], note: 'traces 目录不存在（本轮可能没有任何模型请求）' }
  }
  for (const n of names) {
    if (!n.endsWith('.jsonl')) continue
    const p = join(dir, n)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.mtimeMs < sinceMs - 5000) continue
    files.push({ file: n, mtime: st.mtimeMs, bytes: st.size })
    let lines = []
    try {
      lines = readFileSync(p, 'utf8').split('\n')
    } catch {
      continue
    }
    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      let r
      try {
        r = JSON.parse(t)
      } catch {
        continue
      }
      r.__file = n
      out.push(r)
    }
  }
  const requests = out.filter((r) => r.kind === 'request' && typeof r.startedAt === 'number' && r.startedAt >= sinceMs - 3000)
  requests.sort((a, b) => a.startedAt - b.startedAt)
  return { records: out, requests, files }
}
/** 请求证据摘要（脱敏：只有结构字段，没有请求正文、没有密钥） */
function summarizeRequests(requests) {
  return requests.map((r, i) => ({
    localRequestId: `${phase}-r${i + 1}`,
    runId: String(r.__file || '').replace(/\.jsonl$/, ''),
    phase: r.phase || '',
    model: r.model || '',
    attempt: typeof r.attempt === 'number' ? r.attempt : null,
    slotId: r.slotId || null,
    startedAt: r.startedAt,
    ms: typeof r.ms === 'number' ? r.ms : null,
    ok: r.ok === true,
    failure: r.failure || null,
    error: r.error || null,
    responseLength: typeof r.responseLength === 'number' ? r.responseLength : null,
    finishReason: r.finishReason || null,
    usage: r.usage || null,
    toolCalls: Array.isArray(r.toolCalls) ? r.toolCalls : undefined,
    modelReturned: r.modelReturned || undefined,
  }))
}

// =====================================================================================
// 第 7 节：页面侧探针与读取（CDP 直连真实 WebView2）
// =====================================================================================

/**
 * 「正文可见文字」的统一读取口径（指南 §8.3 第一段）：
 *   文章正文可见文字，去空白；不计标题和纯图片，不以 raw 协议计字数。
 * 实现：从 document.body 走文本节点，跳过（a）标题节点、（b）script/style/svg/img 等非文字节点、
 * （c）aria-hidden/hidden/display:none/visibility:hidden 的元素；再把结果去空白后计数。
 * 标题节点：优先取"第一个 h1..h6"；若它与源文标题行对不上，退化为"文本恰好等于标题的最深元素"。
 * 这段源码被 readState（预览 iframe）与 readHtml（读回的 HTML 串）共用，保证两侧同一口径。
 */
const SRC_COMMON = [
  'var fnv = function (s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return ("00000000" + h.toString(16)).slice(-8); };',
  'var readArticle = function (doc, titleText) {',
  '  var headings = Array.prototype.slice.call(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));',
  '  var firstHeading = headings.length ? headings[0] : null;',
  '  var firstHeadingText = firstHeading ? (firstHeading.textContent || "").trim() : "";',
  '  var titleEl = null;',
  '  if (firstHeading && (!titleText || firstHeadingText.indexOf(titleText) >= 0)) titleEl = firstHeading;',
  '  else if (titleText) {',
  '    var all = Array.prototype.slice.call(doc.querySelectorAll("*"));',
  '    for (var i = 0; i < all.length; i++) {',
  '      var el = all[i];',
  '      if (el.children.length === 0 && (el.textContent || "").trim() === titleText) { titleEl = el; break; }',
  '    }',
  '  }',
  '  var skip = { SCRIPT: 1, STYLE: 1, SVG: 1, IMG: 1, DEFS: 1, NOSCRIPT: 1, TITLE: 1 };',
  '  var parts = [];',
  '  var view = doc.defaultView;',
  '  var walk = function (n) {',
  '    if (!n) return;',
  '    if (n.nodeType === 3) { parts.push(n.nodeValue || ""); return; }',
  '    if (n.nodeType !== 1) return;',
  '    if (titleEl && n === titleEl) return;',
  '    var tag = n.tagName ? n.tagName.toUpperCase() : "";',
  '    if (skip[tag]) return;',
  '    if (n.getAttribute && (n.getAttribute("aria-hidden") === "true" || n.getAttribute("hidden") !== null)) return;',
  '    if (n.getAttribute) { var inline = n.getAttribute("style") || ""; if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(inline)) return; }',
  '    if (view && view.getComputedStyle) {',
  '      var st = view.getComputedStyle(n);',
  '      if (st && (st.display === "none" || st.visibility === "hidden")) return;',
  '    }',
  '    for (var k = 0; k < n.childNodes.length; k++) walk(n.childNodes[k]);',
  '  };',
  '  walk(doc.body);',
  '  var text = parts.join(" ").replace(/[ \\t\\r\\n\\u00a0]+/g, " ").trim();',
  '  var noWS = text.replace(/\\s+/g, "");',
  '  return { firstHeadingText: firstHeadingText, titleNodeText: titleEl ? (titleEl.textContent || "").trim() : "", titleNodeMatched: !!titleEl, bodyText: text, bodyChars: noWS.length, counted: noWS };',
  '};',
].join('\n')

/**
 * 页面内函数源码（用 `new Function('arg', src)` 在页面里执行，避免 page.evaluate 的字符串求值歧义）。
 * 全部只用单引号，避免与外层模板字面量打架。
 */
const PAGE_SRC = {
  /** 安装 invoke 探针：把模型命令的调用次数独立记在页面里（与 traces 交叉核对） */
  installProbe: [
    'var T = window.__TAURI_INTERNALS__;',
    'if (!T || typeof T.invoke !== "function") return { ok: false, reason: "没有 __TAURI_INTERNALS__.invoke" };',
    'if (T.__liveAcceptanceProbe) { window.__acceptanceProbe = window.__acceptanceProbe || T.__liveAcceptanceProbe; return { ok: true, reused: true, probe: window.__acceptanceProbe }; }',
    'var model = ["chat_stream", "gen_svg", "prep_turn", "refine_brief", "review_assets"];',
    'var probe = { installedAt: Date.now(), calls: [], model: [] };',
    'window.__acceptanceProbe = probe;',
    'var orig = T.invoke.bind(T);',
    'T.invoke = function (cmd, args, opts) {',
    '  var rec = { t: Date.now(), cmd: String(cmd) };',
    '  if (model.indexOf(rec.cmd) >= 0) {',
    '    if (args && args.slotId) rec.slotId = String(args.slotId);',
    '    if (args && args.kind) rec.kind = String(args.kind);',
    '    if (args && args.turn) rec.turn = String(args.turn);',
    '    if (args && typeof args.attempt === "number") rec.attempt = args.attempt;',
    '    probe.model.push(rec);',
    '  }',
    '  probe.calls.push(rec);',
    '  return orig(cmd, args, opts);',
    '};',
    'T.__liveAcceptanceProbe = probe;',
    'return { ok: true, reused: false, probe: probe };',
  ].join('\n'),

  /** 轻量运行状态（等待回合结束时高频轮询用） */
  readRun: [
    'var q = function (s) { return document.querySelector(s); };',
    'var probe = window.__acceptanceProbe || { model: [], calls: [] };',
    'var list = Array.prototype.slice.call(document.querySelectorAll(".msg-assistant"));',
    'var last = list.length ? list[list.length - 1] : null;',
    'var lastText = last && last.querySelector(".msg-assistant-text") ? (last.querySelector(".msg-assistant-text").textContent || "") : "";',
    'var wb = q(".work-bubble");',
    'return {',
    '  busy: !!wb || !!q(".btn-stop"),',
    '  workPhase: wb ? (wb.getAttribute("data-phase") || null) : null,',
    '  dispatch: probe.model.length,',
    '  genSvg: probe.model.filter(function (m) { return m.cmd === "gen_svg"; }).length,',
    '  msgs: document.querySelectorAll(".msg").length,',
    '  lastAssistantLen: lastText.trim().length,',
    '  docState: q("[data-doc-state]") ? q("[data-doc-state]").getAttribute("data-doc-state") : null,',
    '  errorText: q(".msg-error") ? (q(".msg-error").textContent || "").trim() : "",',
    '  saveError: q(".save-error") ? (q(".save-error").textContent || "").trim() : "",',
    '  notice: q("[data-notice]") ? (q("[data-notice]").textContent || "").trim() : ""',
    '};',
  ].join('\n'),

  /** 完整状态 + 预览正文（标题节点/可见文字/图片指纹） */
  readState: [
    'var q = function (s) { return document.querySelector(s); };',
    'var arg0 = arg || {};',
    SRC_COMMON,
    'var f = q(".preview-body iframe");',
    'var fdoc = f && f.contentDocument ? f.contentDocument : null;',
    'var art = fdoc ? readArticle(fdoc, arg0.titleText || "") : null;',
    'var imgs = fdoc ? Array.prototype.slice.call(fdoc.querySelectorAll("img[src^=\\"data:image/\\"]")) : [];',
    'var list = Array.prototype.slice.call(document.querySelectorAll(".msg-assistant"));',
    'var last = list.length ? list[list.length - 1] : null;',
    'var lastText = last && last.querySelector(".msg-assistant-text") ? (last.querySelector(".msg-assistant-text").textContent || "") : "";',
    'var probe = window.__acceptanceProbe || { model: [], calls: [] };',
    'return {',
    '  docState: q("[data-doc-state]") ? q("[data-doc-state]").getAttribute("data-doc-state") : null,',
    '  docIsDraft: q("[data-doc-state]") ? q("[data-doc-state]").getAttribute("data-doc-is-draft") : null,',
    '  revisionBadge: q(".ds-meta") ? (q(".ds-meta").textContent || "").trim() : "",',
    '  qualityStrip: q(".quality-strip") ? (q(".quality-strip").textContent || "").trim().slice(0, 300) : "",',
    '  blockersAttr: q("[data-q-blockers]") ? q("[data-q-blockers]").getAttribute("data-q-blockers") : null,',
    '  assetIssueCount: q(".asset-issues") ? Number(q(".asset-issues").getAttribute("data-issues") || 0) : 0,',
    '  warnings: Array.prototype.slice.call(document.querySelectorAll(".compose-warn div")).map(function (d) { return (d.textContent || "").trim(); }),',
    '  busy: !!q(".work-bubble") || !!q(".btn-stop"),',
    '  msgCount: document.querySelectorAll(".msg").length,',
    '  userMsgCount: document.querySelectorAll(".msg-user").length,',
    '  lastAssistantText: lastText.trim(),',
    '  lastHasSrcToggle: !!(last && last.querySelector(".src-toggle")),',
    '  hasDraftEntry: !!q("[data-export-draft-entry]"),',
    '  exportMsg: q(".export-msg") ? (q(".export-msg").textContent || "").trim() : "",',
    '  saveError: q(".save-error") ? (q(".save-error").textContent || "").trim() : "",',
    '  notice: q("[data-notice]") ? (q("[data-notice]").textContent || "").trim() : "",',
    '  probeModel: probe.model.map(function (m) { return { t: m.t, cmd: m.cmd, slotId: m.slotId || null, kind: m.kind || null, attempt: m.attempt == null ? null : m.attempt }; }),',
    '  probeCallCount: probe.calls.length,',
    '  previewHasFrame: !!fdoc,',
    '  article: art,',
    '  images: imgs.map(function (im) { var s = im.getAttribute("src") || ""; return { len: s.length, fnv: fnv(s), w: im.naturalWidth || 0, h: im.naturalHeight || 0 }; }),',
    '  previewInnerTextSample: fdoc ? (fdoc.body.innerText || "").slice(0, 300) : ""',
    '};',
  ].join('\n'),

  /** 读一段 HTML 串（读回产物）的标题/正文——与预览**同一段读取口径**（SRC_COMMON） */
  readHtml: [
    'var arg0 = arg || {};',
    SRC_COMMON,
    'var doc = new DOMParser().parseFromString("<body>" + (arg0.html || "") + "</body>", "text/html");',
    'var art = readArticle(doc, arg0.titleText || "");',
    'return { firstHeadingText: art.firstHeadingText, titleNodeText: art.titleNodeText, titleNodeMatched: art.titleNodeMatched, bodyText: art.bodyText, bodyChars: art.bodyChars, counted: art.counted };',
  ].join('\n'),

  /** 浏览器真实解码一张 PNG（证明"可解码"，不是只看文件头） */
  decodePng: [
    'var dataUrl = arg.dataUrl;',
    'var img = new Image();',
    'img.src = dataUrl;',
    'return img.decode().then(function () { return { ok: true, w: img.naturalWidth, h: img.naturalHeight }; }, function (e) { return { ok: false, error: String(e) }; });',
  ].join('\n'),
}

/** 在页面里执行 PAGE_SRC 中的一段（用 new Function，参数名固定为 arg） */
async function pageFn(page, name, arg = null) {
  const src = PAGE_SRC[name]
  return page.evaluate(({ src, arg }) => new Function('arg', src)(arg), { src, arg })
}

// =====================================================================================
// 第 8 节：应用启动 / 收尾（一律走 desktop-harness 的隔离设施）
// =====================================================================================

const HANDLES = [] // 本轮启动过的所有自有进程（每个都有自己的 closed 标记，绝不互相误关）
let ACTIVE = null

function drain(child, sink) {
  if (!child || !child.stdout) return
  child.stdout.on('data', (d) => {
    sink.stdoutBytes += d.length
  })
  child.stderr?.on('data', (d) => {
    sink.stderrBytes += d.length
  })
}

async function openApp(chromium, ctx) {
  const cdpPort = await freePort()
  const launch = launchDesktop(exe, {
    profile: ctx.iso.profile,
    webview: ctx.iso.webview,
    cdpPort,
    extraEnv: { DEEPSEEK_API_KEY: ctx.key },
  })
  const sink = { stdoutBytes: 0, stderrBytes: 0, exit: null }
  drain(launch.child, sink)
  launch.child.on('exit', (code, signal) => {
    sink.exit = { code, signal, at: Date.now() }
  })
  const rec = {
    phase,
    at: new Date().toISOString(),
    pid: launch.pid,
    exe,
    exeHash: launch.exeHash,
    cdpPort,
    profile: ctx.iso.profile,
    webview: ctx.iso.webview,
    workspace: ctx.iso.workspace,
  }
  evidence.launches.push(rec)
  const mine = { pid: launch.pid, closed: false, sink, rec }
  HANDLES.push(mine)
  ACTIVE = mine
  const close = async () => {
    if (mine.closed) return { closed: true, forced: false, alreadyClosed: true }
    const r = await closeOwnPid(mine.pid) // 只关**这一个** PID；不用 ACTIVE，避免误伤后开的实例
    mine.closed = true
    rec.closed = { ...r, at: new Date().toISOString() }
    rec.childOutput = { ...sink }
    return r
  }
  log(`  [启动] pid=${launch.pid} cdpPort=${cdpPort} exeHash=${launch.exeHash.slice(0, 12)}…`)
  let pages = []
  try {
    pages = await waitForCdp(cdpPort, 90000)
  } catch (e) {
    await close()
    // 这里**必须早于任何模型派发**：CDP 连不上就没有任何驱动手段，绝不能"先发一轮再发现"——
    // 那是花了真钱换一条 BLOCKED。所以它在启动阶段就拦住（实测这条件确实成立）。
    block(
      'launch',
      `CDP 在 90s 内没有可用页面（pid=${launch.pid}，端口 ${cdpPort}）：${e.message}\n` +
        `  · 先排除"应用没起来"：看上面 pid 与 childOutput，以及隔离目录下 profile/Documents/wechat-mp-workspace 是否已建出。\n` +
        `  · 若应用正常起来了却仍然连不上，多半是 **WebView2 运行时不开放远程调试端口**（本机 2026-10-01 实测：\n` +
        `    WebView2 154 与 153 都不开放；\`--remote-debugging-port\` 确实出现在 WebView2 浏览器进程的命令行上，\n` +
        `    但没有任何 TCP 端口监听、也没有 DevToolsActivePort 文件；同一台机器上普通 Edge 用同一开关可以正常监听，\n` +
        `    且不存在 Edge/WebView2 组策略拦截）。这种情况下只能换一台机器/换运行时版本，本脚本无法自行绕过。`,
    )
    return null
  }
  rec.cdpPages = pages.map((p) => ({ type: p.type, url: p.url, hasDebugger: !!p.webSocketDebuggerUrl }))
  // 进程在 CDP 就绪前就退出，说明应用起不来（例如 exe 与 dist 不匹配）——如实报 BLOCKED，不硬测
  if (sink.exit) {
    await close()
    block('launch', `应用在 CDP 就绪前后退出了（exit=${JSON.stringify(sink.exit)}）`)
    return null
  }
  let browser = null
  let page = null
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)
    const contexts = browser.contexts()
    const all = contexts.flatMap((c) => c.pages())
    page = all.find((p) => p.url().includes('tauri.localhost')) || all[0]
    if (!page) throw new Error('CDP 里没有任何页面')
    page.setDefaultTimeout(60000)
    await page.waitForSelector('header.topbar', { timeout: 90000 })
    const inTauri = await page.evaluate(() => '__TAURI_INTERNALS__' in window)
    if (!inTauri) throw new Error('连上的页面不是桌面应用（__TAURI_INTERNALS__ 不存在）')
  } catch (e) {
    await close()
    block('launch', `连接 WebView2 失败：${e.message}`)
    return null
  }
  const probeInstalled = await pageFn(page, 'installProbe')
  if (!probeInstalled || !probeInstalled.ok) {
    await close()
    block('probe', `无法安装 invoke 探针（交叉核对是硬要求）：${JSON.stringify(probeInstalled)}`)
    return null
  }
  ACTIVE.page = page
  ACTIVE.browser = browser
  return { launch, page, browser, cdpPort, close, sink, rec }
}

// =====================================================================================
// 第 9 节：应用内只读读取（生产读路径，不经文件系统绕过）
// =====================================================================================

async function appInvoke(page, cmd, args = {}) {
  return page.evaluate(async ({ c, a }) => {
    try {
      const r = await window.__TAURI_INTERNALS__.invoke(c, a)
      return { ok: true, value: r }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }, { c: cmd, a: args })
}
async function appDoc(page, id) {
  const r = await appInvoke(page, 'open_document', { id })
  return r
}
async function appRevisions(page, id) {
  return appInvoke(page, 'list_document_revisions', { id })
}
async function appSessions(page) {
  return appInvoke(page, 'list_sessions')
}
async function appDocs(page) {
  return appInvoke(page, 'list_documents')
}
async function appSession(page, id) {
  return appInvoke(page, 'open_session', { id })
}

// =====================================================================================
// 第 10 节：磁盘读回（与生产读路径交叉核对）
// =====================================================================================

function docDir(ws, id) {
  return join(ws, 'documents', id)
}
/** 直接读磁盘上的当前成品版本（manifest 指针 + revisions/<id>/ 三件套） */
function readDocDisk(ws, id) {
  const dir = docDir(ws, id)
  const manifestPath = join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) return { ok: false, error: `缺少 ${manifestPath}` }
  let manifestRaw = ''
  let manifest = null
  try {
    manifestRaw = readFileSync(manifestPath, 'utf8')
    manifest = JSON.parse(manifestRaw)
  } catch (e) {
    return { ok: false, error: `读取/解析 manifest 失败：${e.message}` }
  }
  const revId = manifest.accepted_revision_id
  if (!revId) return { ok: false, error: 'manifest 没有 accepted_revision_id（还没有成品版本）' }
  const rdir = join(dir, 'revisions', revId)
  if (!existsSync(rdir)) return { ok: false, error: `版本目录不存在：${rdir}` }
  let source = ''
  let html = ''
  let meta = null
  try {
    source = readFileSync(join(rdir, 'source.md'), 'utf8')
    html = readFileSync(join(rdir, 'article.html'), 'utf8')
    meta = JSON.parse(readFileSync(join(rdir, 'meta.json'), 'utf8'))
  } catch (e) {
    return { ok: false, error: `读取版本文件失败：${e.message}` }
  }
  let revisions = []
  let revFiles = []
  try {
    revisions = readdirSync(join(dir, 'revisions'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    revisions = []
  }
  try {
    revFiles = readdirSync(rdir).sort()
  } catch {
    revFiles = []
  }
  return {
    ok: true,
    docId: id,
    dir,
    manifest,
    manifestHash: sha256Text(manifestRaw),
    revisionId: revId,
    generation: manifest.generation,
    draftRevisionId: manifest.draft_revision_id || null,
    source,
    html,
    meta,
    sourceHash: sha256Text(source),
    htmlHash: sha256Text(html),
    metaHash: sha256Text(JSON.stringify(meta)),
    revisions,
    revFiles,
  }
}
/** 版本指纹（跨 phase 比较用；只放哈希/计数，不放正文） */
function versionFingerprint(disk, appDocValue) {
  const meta = disk.meta || {}
  const snaps = Object.keys(meta.snapshots || {}).sort().map((k) => `${k}@${meta.snapshots[k].ver}:${sha256Text(meta.snapshots[k].svg || '')}`)
  const binds = (meta.bindings || []).map((b) => `${b.slotId || ''}|${b.slot || ''}|${b.id || ''}|${b.source || ''}`).sort()
  return {
    docId: disk.docId,
    generation: disk.generation,
    revisionId: disk.revisionId,
    draftRevisionId: disk.draftRevisionId,
    runId: meta.run_id || null,
    validation: meta.validation || '',
    qualityHash: sha256Text(JSON.stringify(meta.quality || null)),
    qualityOk: meta.quality ? meta.quality.ok === true : null,
    qualityBlockers: meta.quality && Array.isArray(meta.quality.blockers) ? meta.quality.blockers.length : null,
    sourceHash: disk.sourceHash,
    htmlHash: disk.htmlHash,
    bindingsHash: sha256Text(binds.join('\n')),
    snapshotsHash: sha256Text(snaps.join('\n')),
    bindingCount: (meta.bindings || []).length,
    snapshotCount: snaps.length,
    appHtmlHash: appDocValue && appDocValue.html ? sha256Text(appDocValue.html) : null,
    appSourceHash: appDocValue && appDocValue.source ? sha256Text(appDocValue.source) : null,
    appRevisionId: appDocValue ? appDocValue.revisionId || null : null,
    appGeneration: appDocValue && typeof appDocValue.generation === 'number' ? appDocValue.generation : null,
  }
}
function fpEqual(a, b, keys) {
  const diff = []
  for (const k of keys) if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) diff.push(`${k}: ${JSON.stringify(a?.[k])} != ${JSON.stringify(b?.[k])}`)
  return { equal: diff.length === 0, diff }
}

// =====================================================================================
// 第 11 节：基准（跨 phase 的"最后成功版本"）
// =====================================================================================

const baselinePath = join(root, 'baselines.json')
function loadBaselines() {
  const j = readJson(baselinePath)
  if (j && j.schema === 1) return j
  return { schema: 1, root, createdAt: new Date().toISOString(), byPhase: {}, latest: null }
}
function saveBaselines(b) {
  b.updatedAt = new Date().toISOString()
  writeJsonEvidence(baselinePath, b, 'baselines.json')
}

/** 记录一版成品为基准（只有 checks 全过的写入 phase 才更新 latest） */
function recordBaseline(state, view, ok) {
  const b = loadBaselines()
  const entry = {
    phase,
    at: new Date().toISOString(),
    ok,
    docId: view.docId,
    generation: view.generation,
    revisionId: view.revisionId,
    runId: view.runId,
    validation: view.validation,
    sourceHash: view.sourceHash,
    htmlHash: view.htmlHash,
    qualityHash: view.qualityHash,
    qualityOk: view.qualityOk,
    qualityBlockers: view.qualityBlockers,
    bindingsHash: view.bindingsHash,
    snapshotsHash: view.snapshotsHash,
    bindingCount: view.bindingCount,
    snapshotCount: view.snapshotCount,
    manifestHash: state.disk.manifestHash,
    // 应用侧读回的同一版本（L5 重开时要逐字段比对，缺了这些字段比对必然失败）
    appRevisionId: view.appRevisionId,
    appGeneration: view.appGeneration,
    appSourceHash: view.appSourceHash,
    appHtmlHash: view.appHtmlHash,
    previewTitle: state.ui.article ? state.ui.article.firstHeadingText : '',
    titleNodeText: state.ui.article ? state.ui.article.titleNodeText : '',
    bodyChars: state.ui.article ? state.ui.article.bodyChars : null,
    counted: state.ui.article ? state.ui.article.counted : '',
    bodyText: state.ui.article ? state.ui.article.bodyText : '',
    images: state.ui.images,
    docState: state.ui.docState,
    qualityStrip: state.ui.qualityStrip,
    bindings: view.bindings,
    snapshots: view.snapshots,
    source: state.disk.source,
    html: state.disk.html,
    meta: state.disk.meta,
  }
  b.byPhase[phase] = entry
  if (ok) b.latest = phase
  saveBaselines(b)
  return entry
}
function latestBaseline() {
  const b = loadBaselines()
  for (const p of ['L4', 'L2', 'L1']) {
    if (b.byPhase[p] && b.byPhase[p].ok) return b.byPhase[p]
  }
  // 没有"ok"的也返回（L5 会自己判定并如实报失败）
  for (const p of ['L4', 'L2', 'L1']) if (b.byPhase[p]) return b.byPhase[p]
  return null
}

// =====================================================================================
// 第 12 节：回合驱动（等待、预算看门狗）
// =====================================================================================

async function clickStop(page) {
  try {
    const stop = page.locator('.btn-stop')
    if (await stop.count()) {
      await stop.first().click()
      return true
    }
  } catch {
    /* 按钮可能已经消失 */
  }
  return false
}

/**
 * 发一条消息并等这一回合真正结束。
 * 结束判据：不再 busy（工作气泡/停止按钮都消失）且派发计数连续 3 次采样不变且最后一条助手消息非空。
 * **预算看门狗**：本回合派发数超过额度就按停止并中止（不静默追加回合）。
 */
async function sendTurn(page, text, plan) {
  const t0 = Date.now()
  const before = await pageFn(page, 'readRun')
  const turn = {
    phase,
    prompt: text,
    startedAt: new Date().toISOString(),
    t0,
    msgsBefore: before.msgs,
    dispatchBefore: before.dispatch,
    genSvgBefore: before.genSvg,
    stages: [],
    ended: null,
    aborted: null,
    dispatchAfter: null,
    genSvgAfter: null,
    seconds: null,
  }
  evidence.turns.push(turn)

  await page.locator('.chat-input-row textarea').fill(text)
  await page.locator('.chat-input-row textarea').press('Enter')

  // 1) 等回合开始（消息数增加 / busy / 出现派发），最多 60s——"没开始就等结束"是假绿
  const startDeadline = Date.now() + 60000
  let started = false
  while (Date.now() < startDeadline && !started) {
    const s = await pageFn(page, 'readRun')
    started = s.msgs > before.msgs || s.busy || s.dispatch > before.dispatch
    if (!started) await page.waitForTimeout(600)
  }
  turn.started = started
  if (!started) {
    turn.ended = 'not-started'
    return turn
  }

  // 2) 等结束
  let lastDispatch = -1
  let stable = 0
  const deadline = t0 + TURN_TIMEOUT_MS
  while (Date.now() < deadline) {
    let s
    try {
      s = await pageFn(page, 'readRun')
    } catch (e) {
      turn.ended = 'read-failed'
      turn.readError = String(e.message || e)
      break
    }
    if (s.workPhase && turn.stages[turn.stages.length - 1] !== s.workPhase) turn.stages.push(s.workPhase)
    if (s.errorText && !(turn.uiErrors || []).includes(s.errorText)) turn.uiErrors = [...(turn.uiErrors || []), s.errorText]
    if (s.saveError && !(turn.saveErrors || []).includes(s.saveError)) turn.saveErrors = [...(turn.saveErrors || []), s.saveError]
    if (s.notice && !(turn.notices || []).includes(s.notice)) turn.notices = [...(turn.notices || []), s.notice]
    if (s.dispatch - before.dispatch > plan.maxDispatches || s.genSvg - before.genSvg > plan.maxGenSvg) {
      turn.aborted = `本回合派发超出额度（派发 ${s.dispatch - before.dispatch}/${plan.maxDispatches}，绘图 ${s.genSvg - before.genSvg}/${plan.maxGenSvg}）——按预算规则中止本回合`
      await clickStop(page)
      await page.waitForTimeout(2500)
      break
    }
    const quiet = !s.busy
    const terminal = quiet && Boolean(s.errorText || s.saveError) // 已出现可见错误面：不必再等满超时
    if (quiet && s.dispatch === lastDispatch && (s.lastAssistantLen > 0 || terminal)) stable++
    else stable = 0
    lastDispatch = s.dispatch
    if (stable >= 3) {
      turn.ended = terminal && s.lastAssistantLen === 0 ? 'error-surface' : 'idle'
      break
    }
    await page.waitForTimeout(1400)
  }
  if (!turn.ended) turn.ended = 'timeout'
  const after = await pageFn(page, 'readRun')
  turn.dispatchAfter = after.dispatch - before.dispatch
  turn.genSvgAfter = after.genSvg - before.genSvg
  turn.seconds = Math.round((Date.now() - t0) / 1000)
  turn.uiErrors = turn.uiErrors || []
  turn.saveErrors = turn.saveErrors || []
  turn.notices = turn.notices || []
  return turn
}

/** 发消息前的准备：切到对话视图 + 确认输入框可用 */
async function gotoChat(page) {
  const tab = page.locator('[data-view="chat"]')
  if (await tab.count()) await tab.first().click()
  await page.waitForSelector('.chat-input-row textarea', { timeout: 30000 })
}

/**
 * 落盘用的瘦身状态：正文本身另存 `committed-<phase>-source.md` / `-article.html`，
 * JSON 里只留哈希与计数（证据文件不该塞进几百 KB 的 base64 图）。
 */
function slimState(s) {
  if (!s) return null
  const { ui, probe, view, disk, appDoc } = s
  return {
    ui,
    probe,
    view,
    disk:
      disk && disk.ok
        ? {
            ok: true,
            docId: disk.docId,
            revisionId: disk.revisionId,
            generation: disk.generation,
            draftRevisionId: disk.draftRevisionId,
            manifestHash: disk.manifestHash,
            sourceHash: disk.sourceHash,
            htmlHash: disk.htmlHash,
            metaHash: disk.metaHash,
            revisions: disk.revisions,
            revFiles: disk.revFiles,
            sourceChars: disk.source.length,
            htmlChars: disk.html.length,
            meta: disk.meta,
          }
        : disk,
    appDoc: appDoc
      ? {
          revisionId: appDoc.revisionId || null,
          generation: appDoc.generation ?? null,
          validation: appDoc.validation || '',
          sourceHash: sha256Text(appDoc.source || ''),
          htmlHash: sha256Text(appDoc.html || ''),
          title: appDoc.title || '',
        }
      : null,
    appDocError: s.appDocError || null,
  }
}
/** 把一款成品的源文与 HTML 全文另存成独立文件（供人工核对；不含密钥） */
function writeCommittedArtifacts(prefix, disk) {
  if (!disk || !disk.ok) return
  writeFileEvidence(join(evidenceDir, `${prefix}-source.md`), disk.source, `${prefix}-source.md`)
  writeFileEvidence(join(evidenceDir, `${prefix}-article.html`), disk.html, `${prefix}-article.html`)
}

/** 等"这一版真的落到界面上了"：预览出现内容且 doc-state 已渲染（不是 sleep 完就断言） */
async function waitDocReady(page, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await pageFn(page, 'readRun')
    if (last.docState && last.lastAssistantLen > 0 && !last.busy) return last
    await page.waitForTimeout(700)
  }
  return last
}

/** 一份完整状态快照（UI + 预览 + 探针 + 磁盘 + 应用读回） */
async function snapshot(page, ws, docId, titleText) {
  const ui = await pageFn(page, 'readState', { titleText: titleText || '' })
  const probe = await page.evaluate(() => {
    const p = window.__acceptanceProbe || { model: [], calls: [] }
    return {
      model: p.model.map((m) => ({ t: m.t, cmd: m.cmd, slotId: m.slotId || null, kind: m.kind || null, turn: m.turn || null })),
      callCount: p.calls.length,
    }
  })
  const disk = docId ? readDocDisk(ws, docId) : { ok: false, error: '没有文档 id' }
  const docR = docId ? await appDoc(page, docId) : { ok: false, error: '没有文档 id' }
  const snap = { ui, probe, disk, appDoc: docR.ok ? docR.value : null, appDocError: docR.ok ? null : docR.error }
  if (disk.ok) {
    const meta = disk.meta || {}
    snap.view = versionFingerprint(disk, snap.appDoc)
    snap.view.bindings = meta.bindings || []
    snap.view.snapshots = Object.keys(meta.snapshots || {})
      .sort()
      .map((k) => ({ id: k, ver: meta.snapshots[k].ver, svgHash: sha256Text(meta.snapshots[k].svg || '') }))
  }
  return snap
}

// =====================================================================================
// 第 13 节：事实断言（把题面里的事实**真的**断言，不是只打印）
// =====================================================================================

const norm = (s) =>
  String(s || '')
    .replace(/\s+/g, '')
    .replace(/[—–―−~～]/g, '-')
    .replace(/[：]/g, ':')

/** 取 token 前后 radius 个字符的窗口（用于"不颠倒"这类邻近性断言） */
function windowAround(text, token, radius = 26) {
  const i = text.indexOf(token)
  if (i < 0) return null
  return text.slice(Math.max(0, i - radius), Math.min(text.length, i + token.length + radius))
}
const hasAny = (s, list) => list.some((re) => re.test(s))

/**
 * 题面事实断言（L1/L2 共用）。返回 [{id, pass, evidence}]
 * 说明：正文一律取**预览里的可见文字**（去空白后），标题另取预览标题节点 + 源文标题行。
 */
function factChecks(article, sourceTitle, { expectTitle, limit180 }) {
  const t = norm(article ? article.bodyText : '')
  const full = norm(`${sourceTitle || ''} ${article ? article.bodyText : ''}`)
  const out = []
  const add = (id, pass, ev) => out.push({ id, pass: Boolean(pass), evidence: ev })

  if (expectTitle) {
    const node = article ? article.firstHeadingText : ''
    add(
      `${idTag()}标题节点与源文都含「${expectTitle}」`,
      norm(node).includes(norm(expectTitle)) && norm(sourceTitle).includes(norm(expectTitle)),
      `预览首个标题节点=「${clip(node, 60)}」；源文标题行=「${clip(sourceTitle, 60)}」`,
    )
  }

  // ── 日期 · 时段 · 地点：按**分句**归属断言，而不是"某词是否在全文里出现过" ──
  // 为什么按分句：正文常常把两天写在同一句的左右两段里，只看"全文是否出现 9:00"会漏掉
  // "把闭馆那天写成开放时段"这种颠倒。这里把正文切成短句（；。，！？、换行都算边界），
  // 再要求"承载开放时段的那个短句里必须出现 10月10日"、"承载闭馆的那个短句里必须出现 10月11日"。
  const clauses = t.split(/[；;。！!？?，,\n、]/).map((x) => x.trim()).filter(Boolean)
  const openClause = clauses.find((c) => hasAny(c, [/9:0{0,2}/, /9点/, /上午9/, /9时/]) && !c.includes('闭馆')) || null
  add(
    '事实-周六 10月10日 9:00–17:00 开放（同一短句里既有日期又有时段，且该句不是"闭馆"）',
    Boolean(openClause) && openClause.includes('10月10日') && hasAny(openClause, [/17:0{0,2}/, /17点/, /下午5/]) && hasAny(openClause, [/开放/, /开馆/, /到馆/, /9:0{0,2}/]),
    `承载开放时段的短句=「${clip(openClause || '(未找到)', 90)}」`,
  )
  const closedClause = clauses.find((c) => c.includes('闭馆')) || null
  add(
    '事实-周日 10月11日全天闭馆（"闭馆"这个短句里必须出现 10月11日 与"全天"）',
    Boolean(closedClause) && closedClause.includes('10月11日') && closedClause.includes('全天'),
    `承载"闭馆"的短句=「${clip(closedClause || '(未找到)', 90)}」`,
  )
  // 自习区在一楼（同一个短句里同时出现；退一步允许紧邻）
  const floorClause = clauses.find((c) => c.includes('自习') && c.includes('一楼')) || null
  const wStudy = windowAround(t, '自习', 14)
  const wFloor = windowAround(t, '一楼', 14)
  add(
    '事实-自习区在一楼',
    Boolean(floorClause) || Boolean(wStudy && wStudy.includes('一楼')) || Boolean(wFloor && wFloor.includes('自习')),
    `同一短句=${floorClause ? '「' + clip(floorClause, 60) + '」' : '无'}；自习窗口=「${clip(wStudy || '(未出现)', 50)}」；一楼窗口=「${clip(wFloor || '(未出现)', 50)}」`,
  )
  // 电话：先按原文找，再按去非数字找（允许 010 5555 6666 之类的间隔写法）
  const digits = t.replace(/\D/g, '')
  add(
    '事实-咨询电话 010-55556666',
    t.includes('010-55556666') || digits.includes('01055556666'),
    `原文命中=${t.includes('010-55556666')}；数字串命中=${digits.includes('01055556666')}`,
  )
  if (limit180) {
    const n = article ? article.bodyChars : -1
    add(
      `字数-正文可见文字去空白 ≤ ${limit180} 字`,
      n >= 0 && n <= limit180,
      `实际 ${n} 字；计数字符串=「${clip(article ? article.counted : '', 400)}」`,
    )
  }
  add('事实-全文同时含开放与闭馆（不是只写了其中一种）', full.includes('闭馆') && hasAny(full, [/9:0{0,2}/, /9点/, /17:0{0,2}/]), `闭馆=${full.includes('闭馆')}`)
  return out
}
const idTag = () => `${phase}：`

// =====================================================================================
// 第 14 节：各 phase
// =====================================================================================

function phaseContext() {
  const iso = prepareIsolation(`live-${phase}`, root)
  evidence.isolation = { root: iso.root, profile: iso.profile, webview: iso.webview, evidence: iso.evidence, workspace: iso.workspace, realWorkspace: realWorkspaceDir() }
  return iso
}

/** 启动核对（指南 §8.2 第 3 条）：PID / exe 哈希 / CDP 端口 / workspace 位置；不是 sleep 完就开测 */
async function verifyLaunch(app, ctx, { expectEmpty }) {
  const pidAlive = isPidAlive(app.launch.pid)
  check(`${idTag()}启动核对：本轮自有 PID 存活`, pidAlive, `pid=${app.launch.pid}`)
  check(`${idTag()}启动核对：exe 哈希已记录`, /^[0-9a-f]{64}$/.test(app.launch.exeHash), `exeHash=${app.launch.exeHash.slice(0, 16)}…`)
  check(
    `${idTag()}启动核对：CDP 端口为本轮新分配且有我们自己的页面`,
    app.rec.cdpPages.some((p) => p.hasDebugger) && app.rec.cdpPages.some((p) => String(p.url).includes('tauri.localhost')),
    `port=${app.cdpPort}；pages=${JSON.stringify(app.rec.cdpPages).slice(0, 240)}`,
  )
  const wsResolved = resolve(ctx.iso.workspace).toLowerCase()
  const realResolved = resolve(realWorkspaceDir()).toLowerCase()
  check(
    `${idTag()}隔离：子进程 workspace 指向隔离目录、与真实工作区不同`,
    wsResolved !== realResolved && !wsResolved.startsWith(realResolved) && !realResolved.startsWith(wsResolved),
    `workspace=${ctx.iso.workspace}`,
  )

  const sessions = await appSessions(app.page)
  const docs = await appDocs(app.page)
  if (!sessions.ok || !docs.ok) {
    block('launch', `启动后读取会话/文稿失败：sessions=${JSON.stringify(sessions).slice(0, 200)} docs=${JSON.stringify(docs).slice(0, 200)}`)
    return null
  }
  const cur = sessions.value.current
  const docCount = (docs.value.items || []).length
  evidence.launchReadbacks = evidence.launchReadbacks || []
  evidence.launchReadbacks.push({ at: new Date().toISOString(), pid: app.launch.pid, sessions: sessions.value, docs: docs.value })
  if (expectEmpty) {
    const msgs = cur ? (await appSession(app.page, cur)).value?.messages?.length ?? -1 : -1
    check(
      `${idTag()}启动核对：全新隔离工作区（空会话 / 空文稿）`,
      docCount === 0 && msgs === 0 && (sessions.value.items || []).length <= 1,
      `会话数=${(sessions.value.items || []).length} 当前会话消息数=${msgs} 文稿数=${docCount}`,
    )
  } else {
    check(
      `${idTag()}启动核对：接着隔离目录里已有的会话与文稿`,
      (sessions.value.items || []).length >= 1 && docCount >= 1,
      `会话数=${(sessions.value.items || []).length} 当前会话=${cur} 文稿数=${docCount}`,
    )
  }
  return { cur, docCount, sessions: sessions.value, docs: docs.value }
}

/** 真实工作区清单差异 → 只写观测（归因限制见脚本头部与报告） */
function realWorkspaceObserve(before, label) {
  const after = hashInventory(realWorkspaceDir())
  const diff = diffInventory(before, after)
  const rec = {
    label,
    at: new Date().toISOString(),
    beforeCount: Object.keys(before).length,
    afterCount: Object.keys(after).length,
    added: diff.added,
    removed: diff.removed,
    changed: diff.changed,
  }
  evidence.realWorkspaceInventory.push(rec)
  if (diff.added.length + diff.removed.length + diff.changed.length === 0) {
    observe(
      `真实工作区清单差异（${label}）：0 个文件`,
      '计数相同**不等于**"完全没变"：清单只覆盖文件级内容哈希，目录 mtime、临时文件、用户实例正在写入的中间态都不在其中；' +
        '本脚本的子进程带隔离 USERPROFILE，路线断言见"隔离"检查项，差异不归因于本脚本，也无法据此排除用户自有实例的写入。',
    )
  } else {
    observe(
      `真实工作区清单差异（${label}）：${rec.added.length + rec.removed.length + rec.changed.length} 个文件`,
      `新增=${JSON.stringify(rec.added.slice(0, 20))} 删除=${JSON.stringify(rec.removed.slice(0, 20))} 修改=${JSON.stringify(rec.changed.slice(0, 20))}；` +
        '归因限制：不排除用户自己的实例正在写入（本次测试运行在隔离 profile，不写真实工作区，也不会为消除差异去终止用户实例）。',
    )
  }
  return rec
}

/** 派发后的账本与交叉核对 */
function reconcile(led, turn, traceInfo, plan) {
  const requests = traceInfo.requests
  const dispatched = requests.length
  const genSvgDispatched = requests.filter((r) => r.phase === 'gen_svg').length
  const attempts = turn.dispatchAfter
  const genSvgAttempts = turn.genSvgAfter
  // 记账取两侧的较大值（宁可高估花费，不可低估）——指南 §8.1 要求派发前约束、事后也要留痕
  const countedDispatches = Math.max(dispatched, attempts)
  const countedGenSvg = Math.max(genSvgDispatched, genSvgAttempts)

  const explainable = dispatched === attempts && genSvgDispatched === genSvgAttempts
  const hasErrorSurface = turn.uiErrors.length > 0 || turn.saveErrors.length > 0 || requests.some((r) => r.ok === false)
  check(
    `${idTag()}交叉核对：trace 派发数与 WebView 侧观测一致`,
    dispatched <= attempts && (explainable || hasErrorSurface),
    `traces 派发=${dispatched}（绘图 ${genSvgDispatched}）；WebView 命令调用=${attempts}（绘图 ${genSvgAttempts}）；` +
      (explainable ? '一致' : '不一致，但存在可见错误面（' + clip(turn.uiErrors.concat(turn.saveErrors).join(' | '), 200) + '），按"失败在派发前"归因'),
  )
  if (dispatched > attempts) {
    fail('reconcile', `trace 记到 ${dispatched} 次派发，但 WebView 侧只观测到 ${attempts} 次命令调用——证据互相矛盾，本轮结果不可信`)
  }
  check(
    `${idTag()}预算：本回合派发在额度内（≤${plan.maxDispatches} 次、绘图 ≤${plan.maxGenSvg} 次）`,
    countedDispatches <= plan.maxDispatches && countedGenSvg <= plan.maxGenSvg,
    `派发 ${countedDispatches}/${plan.maxDispatches}，绘图 ${countedGenSvg}/${plan.maxGenSvg}`,
  )
  recordLedger(led, {
    dispatches: countedDispatches,
    genSvg: countedGenSvg,
    note: `${phase} 回合：${turn.ended}${turn.aborted ? '（' + turn.aborted + '）' : ''}`,
  })
  return {
    dispatched,
    genSvgDispatched,
    attempts,
    genSvgAttempts,
    countedDispatches,
    countedGenSvg,
    phases: requests.map((r) => r.phase),
    requests: summarizeRequests(requests),
    traceFiles: traceInfo.files,
    remainingAfter: remaining(led),
  }
}

// ---------- L1 ----------

async function runL1(ctx, app, plan) {
  const launchRead = await verifyLaunch(app, ctx, { expectEmpty: true })
  if (!launchRead) return

  const realBefore = hashInventory(realWorkspaceDir())
  await gotoChat(app.page)
  const t0 = Date.now()
  const turn = await sendTurn(app.page, PROMPTS.L1, plan)
  const traceInfo = traceRecordsSince(ctx.iso.workspace, t0)
  const recon = reconcile(ctx.ledger, turn, traceInfo, plan)
  log(`  [回合] ${turn.ended}，用时 ${turn.seconds}s，阶段=${turn.stages.join('→')}，派发=${recon.countedDispatches}（绘图 ${recon.countedGenSvg}）`)

  const docId = launchRead.cur
  await waitDocReady(app.page)
  const state = await snapshot(app.page, ctx.iso.workspace, docId, '')
  const srcTitle = firstSourceTitle(state.disk.ok ? state.disk.source : '')
  state.srcTitle = srcTitle
  evidence.turns[evidence.turns.length - 1].snapshot = slimState(state)
  writeJsonEvidence(join(evidenceDir, 'L1-state.json'), { turn, recon, state: slimState(state) }, 'L1-state.json')
  writeCommittedArtifacts('L1-committed', state.disk)
  realWorkspaceObserve(realBefore, 'L1 前后')

  if (turn.aborted) {
    block('budget', turn.aborted)
    return
  }
  if (!turn.started || turn.ended === 'not-started') check(`${idTag()}回合确实开始并跑完`, false, `ended=${turn.ended}`)
  if (turn.ended === 'timeout') check(`${idTag()}回合在 ${TURN_TIMEOUT_MS}ms 内结束`, false, `阶段=${turn.stages.join('→')}`)

  check(
    `${idTag()}本轮 accepted 提交（界面 doc-state=accepted 且版本 validation=verified）`,
    state.ui.docState === 'accepted' && state.disk.ok && state.disk.meta.validation === 'verified',
    `doc-state=${state.ui.docState}；validation=${state.disk.ok ? state.disk.meta.validation : '(磁盘不可读)'}`,
  )
  check(
    `${idTag()}恰好一个素材位真正落位（预览内联图片 1 张、版本 bindings 1 条）`,
    state.ui.images.length === 1 && state.disk.ok && (state.disk.meta.bindings || []).length === 1,
    `预览图片=${state.ui.images.length} 张；bindings=${state.disk.ok ? JSON.stringify((state.disk.meta.bindings || []).map((b) => b.slot)) : '(不可读)'}`,
  )
  const binds = state.disk.ok ? state.disk.meta.bindings || [] : []
  check(
    `${idTag()}素材位是开篇横图，不是照片位/角饰/分割线等额外素材`,
    binds.length > 0 && binds.every((b) => !/photo|frame|deco|divider|heading/i.test(String(b.slot))),
    `slots=${JSON.stringify(binds.map((b) => b.slot))}`,
  )
  check(
    `${idTag()}成品 HTML 无外链资源（离线可渲染）`,
    state.disk.ok && !/src\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(state.disk.html),
    `html 长度=${state.disk.ok ? state.disk.html.length : -1}`,
  )
  for (const c of factChecks(state.ui.article, srcTitle, { expectTitle: plan.title, limit180: 180 })) check(c.id, c.pass, c.evidence)
  check(
    `${idTag()}quality 与回执一致（版本内 quality.ok=true、界面质量条为"通过"、阻断 0 条）`,
    state.disk.ok && state.disk.meta.quality && state.disk.meta.quality.ok === true && /通过/.test(state.ui.qualityStrip) && state.ui.blockersAttr === '0',
    `quality.ok=${state.disk.ok ? state.disk.meta.quality?.ok : null}；strip=「${clip(state.ui.qualityStrip, 120)}」；blockers=${state.ui.blockersAttr}`,
  )
  check(
    `${idTag()}新版本 ID / generation / runId 已记录且磁盘产物哈希自洽`,
    state.disk.ok &&
      !!state.disk.revisionId &&
      state.disk.generation >= 1 &&
      !!state.disk.meta.run_id &&
      state.disk.meta.hashes &&
      state.disk.meta.hashes.source === state.disk.sourceHash &&
      state.disk.meta.hashes.html === state.disk.htmlHash &&
      state.view.appHtmlHash === state.disk.htmlHash &&
      state.view.appRevisionId === state.disk.revisionId,
    `revisionId=${state.disk.ok ? state.disk.revisionId : '-'} generation=${state.disk.ok ? state.disk.generation : '-'} runId=${state.disk.ok ? state.disk.meta.run_id : '-'}`,
  )

  if (state.disk.ok && state.view) {
    recordBaseline(state, state.view, checksSoFarOk())
  }
}

// ---------- L2 / L4 ----------

async function runWritePhase(ctx, app, kind, plan) {
  const prev = latestBaseline()
  if (!prev) {
    block('baseline', `找不到可比较的上一版基准（baselines.json 里没有 L1）——请先用同一个 --root 跑 L1`)
    return
  }
  const launchRead = await verifyLaunch(app, ctx, { expectEmpty: false })
  if (!launchRead) return
  const docId = launchRead.cur
  if (prev.docId !== docId) {
    check(`${idTag()}同一文档（docId 与基准一致）`, false, `基准=${prev.docId}，当前会话=${docId}`)
    block('baseline', `当前会话 ${docId} 与基准文档 ${prev.docId} 不是同一篇——请确认用的是同一个 --root`)
    return
  }

  const realBefore = hashInventory(realWorkspaceDir())
  await gotoChat(app.page)
  await waitDocReady(app.page)
  const before = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || prev.previewTitle || '')
  writeJsonEvidence(join(evidenceDir, `${kind}-before.json`), { before: slimState(before) }, `${kind}-before.json`)

  const t0 = Date.now()
  const turn = await sendTurn(app.page, PROMPTS[kind], plan)
  const traceInfo = traceRecordsSince(ctx.iso.workspace, t0)
  const recon = reconcile(ctx.ledger, turn, traceInfo, plan)
  log(`  [回合] ${turn.ended}，用时 ${turn.seconds}s，阶段=${turn.stages.join('→')}，派发=${recon.countedDispatches}（绘图 ${recon.countedGenSvg}）`)

  await waitDocReady(app.page)
  const after = await snapshot(app.page, ctx.iso.workspace, docId, plan.title || prev.titleNodeText || '')
  const srcTitle = firstSourceTitle(after.disk.ok ? after.disk.source : '')
  after.srcTitle = srcTitle
  const payload = { kind, turn, recon, before: slimState(before), after: slimState(after), baseline: prev }
  evidence.turns[evidence.turns.length - 1].snapshot = { before: slimState(before), after: slimState(after), srcTitle }
  writeJsonEvidence(join(evidenceDir, `${kind}-state.json`), payload, `${kind}-state.json`)
  writeCommittedArtifacts(`${kind}-committed`, after.disk)
  realWorkspaceObserve(realBefore, `${kind} 前后`)

  if (turn.aborted) {
    block('budget', turn.aborted)
    return
  }
  if (turn.ended !== 'idle') check(`${idTag()}回合正常跑完（不是超时/未开始）`, false, `ended=${turn.ended}`)

  check(
    `${idTag()}本轮 accepted 提交`,
    after.ui.docState === 'accepted' && after.disk.ok && after.disk.meta.validation === 'verified',
    `doc-state=${after.ui.docState}；validation=${after.disk.ok ? after.disk.meta.validation : '(不可读)'}`,
  )
  check(`${idTag()}同一文档（docId 与基准一致）`, after.disk.ok && after.disk.docId === prev.docId, `docId=${after.disk.docId}`)
  check(
    `${idTag()}真实新 revision / runId（revisionId 新、generation 增加、runId 新）`,
    after.disk.ok &&
      after.disk.revisionId !== prev.revisionId &&
      after.disk.generation > prev.generation &&
      !!after.disk.meta.run_id &&
      after.disk.meta.run_id !== prev.runId,
    `revisionId ${prev.revisionId} → ${after.disk.ok ? after.disk.revisionId : '-'}；generation ${prev.generation} → ${after.disk.ok ? after.disk.generation : '-'}；runId ${prev.runId} → ${after.disk.ok ? after.disk.meta.run_id : '-'}`,
  )
  check(
    `${idTag()}新版本 generation 恰好 +1（没有偷偷多提交一版）`,
    after.disk.ok && after.disk.generation === prev.generation + 1,
    `${prev.generation} → ${after.disk.ok ? after.disk.generation : '-'}`,
  )
  check(
    `${idTag()}预览标题节点确实变化且等于新标题`,
    norm(after.ui.article ? after.ui.article.firstHeadingText : '').includes(norm(plan.title)) &&
      after.ui.article &&
      after.ui.article.titleNodeMatched &&
      norm(after.ui.article.firstHeadingText) !== norm(prev.previewTitle),
    `标题节点「${clip(before.ui.article ? before.ui.article.firstHeadingText : '', 40)}」→「${clip(after.ui.article ? after.ui.article.firstHeadingText : '', 40)}」`,
  )
  check(
    `${idTag()}正文确实变化（可见文字与基准不同）`,
    after.ui.article && before.ui.article && after.ui.article.counted !== prev.counted,
    `基准 ${prev.bodyChars} 字 → 现在 ${after.ui.article ? after.ui.article.bodyChars : -1} 字`,
  )
  check(
    `${idTag()}源文标题行也变了（不是只改了预览）`,
    norm(srcTitle).includes(norm(plan.title)) && norm(srcTitle) !== norm(prev.previewTitle),
    `源文标题行=「${clip(srcTitle, 60)}」`,
  )
  observe(
    `${kind} 长度观测`,
    `基准正文 ${prev.bodyChars} 字 → 现在 ${after.ui.article ? after.ui.article.bodyChars : -1} 字（题面要求"更简洁"，此处只观测，不判定）`,
  )
  observe(
    `${kind} 侧栏会话名 vs 文章标题`,
    `侧栏会话名=「${clip(sessionTitleOf(launchRead.sessions, docId), 60)}」；文章标题（源文/预览节点）=「${clip(srcTitle, 60)}」；` +
      '断言一律取自源文与预览标题节点，不用侧栏会话名代替文章标题。',
  )

  observe(
    `${kind} 预览图片字节指纹（仅观测，不作判定）`,
    `before=${JSON.stringify(before.ui.images)}；after=${JSON.stringify(after.ui.images)}。` +
      '图片是 SVG 经 canvas 光栅化后的结果，光栅化不保证逐字节稳定，因此"素材没变"一律以版本 meta 的 bindings/snapshots 哈希为准。',
  )

  if (kind === 'L2') {
    check(
      `${idTag()}gen_svg=0（只改文字，没有重新画图）`,
      recon.countedGenSvg === 0 && recon.phases.every((p) => p !== 'gen_svg'),
      `派发阶段=${JSON.stringify(recon.phases)}；绘图=${recon.countedGenSvg}`,
    )
    check(
      `${idTag()}素材 ID / 版本 / 快照哈希不变`,
      after.view &&
        JSON.stringify(after.view.bindings) === JSON.stringify(prev.bindings) &&
        after.view.bindingsHash === prev.bindingsHash &&
        after.view.snapshotsHash === prev.snapshotsHash &&
        after.view.snapshotCount === prev.snapshotCount,
      `bindingsHash ${prev.bindingsHash.slice(0, 12)} → ${after.view ? after.view.bindingsHash.slice(0, 12) : '-'}；snapshotsHash ${prev.snapshotsHash.slice(0, 12)} → ${after.view ? after.view.snapshotsHash.slice(0, 12) : '-'}`,
    )
    check(
      `${idTag()}素材位数不变（预览 1 张图、bindings 1 条）`,
      after.ui.images.length === prev.images.length && after.ui.images.length === 1 && after.view?.bindingCount === prev.bindingCount,
      `图片 ${prev.images.length} → ${after.ui.images.length}；bindings ${prev.bindingCount} → ${after.view ? after.view.bindingCount : '-'}`,
    )
    for (const c of factChecks(after.ui.article, srcTitle, { expectTitle: plan.title, limit180: 180 })) check(c.id, c.pass, c.evidence)
  }

  if (kind === 'L4') {
    check(
      `${idTag()}本轮确实派发了新画（gen_svg ≥ 1，不把"永远复用"当成功）`,
      recon.countedGenSvg >= 1 && recon.phases.includes('gen_svg'),
      `绘图派发=${recon.countedGenSvg}；阶段=${JSON.stringify(recon.phases)}`,
    )
    check(
      `${idTag()}素材内容确实不同（预览图片指纹与上一版不同）`,
      after.ui.images.length === 1 &&
        before.ui.images.length === 1 &&
        after.ui.images[0].fnv !== before.ui.images[0].fnv &&
        after.ui.images[0].len !== before.ui.images[0].len,
      `before=${JSON.stringify(before.ui.images)}；after=${JSON.stringify(after.ui.images)}`,
    )
    check(
      `${idTag()}文本不变（标题与正文可见文字与上一版逐字一致）`,
      norm(after.ui.article ? after.ui.article.firstHeadingText : '') === norm(before.ui.article ? before.ui.article.firstHeadingText : '') &&
        (after.ui.article ? after.ui.article.counted : 'x') === prev.counted,
      `标题「${clip(after.ui.article ? after.ui.article.firstHeadingText : '', 40)}」；正文 ${after.ui.article ? after.ui.article.bodyChars : -1} 字（基准 ${prev.bodyChars}）`,
    )
    check(
      `${idTag()}素材位数不变（预览 1 张图、bindings 1 条）`,
      after.ui.images.length === 1 && after.view?.bindingCount === prev.bindingCount,
      `图片=${after.ui.images.length}；bindings ${prev.bindingCount} → ${after.view ? after.view.bindingCount : '-'}`,
    )
  }

  // 读回与预览一致（同一段读取口径作用在磁盘读回的 HTML 上）
  const readback = await pageFn(app.page, 'readHtml', { html: after.disk.ok ? after.disk.html : '', titleText: srcTitle || '' })
  check(
    `${idTag()}磁盘读回与预览一致（标题与正文可见文字逐字一致）`,
    readback &&
      norm(readback.titleNodeText || '') === norm(after.ui.article ? after.ui.article.titleNodeText : '') &&
      readback.counted === (after.ui.article ? after.ui.article.counted : 'x'),
    `读回标题=「${clip(readback && readback.titleNodeText, 40)}」预览标题=「${clip(after.ui.article ? after.ui.article.titleNodeText : '', 40)}」；读回 ${readback && readback.counted ? readback.counted.length : -1} 字 / 预览 ${after.ui.article ? after.ui.article.counted.length : -1} 字`,
  )
  check(
    `${idTag()}应用读回的成品与磁盘当前版本一致`,
    after.disk.ok && after.view.appHtmlHash === after.disk.htmlHash && after.view.appRevisionId === after.disk.revisionId,
    `appRevision=${after.view ? after.view.appRevisionId : '-'} diskRevision=${after.disk.ok ? after.disk.revisionId : '-'}`,
  )

  if (after.disk.ok && after.view) recordBaseline(after, after.view, checksSoFarOk())
}

/** 源文里的标题行（`# ` 开头） */
function firstSourceTitle(source) {
  for (const line of String(source || '').split(/\r?\n/)) {
    const m = line.trim().match(/^#{1,6}\s+(.*)$/)
    if (m) return m[1].trim()
  }
  return ''
}
function sessionTitleOf(sessions, id) {
  const it = (sessions.items || []).find((x) => x.id === id)
  return it ? it.title : '(未知)'
}

// ---------- L3 ----------

async function runL3(ctx, app, plan) {
  const prev = latestBaseline()
  if (!prev) {
    block('baseline', '找不到基准（baselines.json 里没有 L1/L2）——请先用同一个 --root 跑 L1（L2 可选）')
    return
  }
  const launchRead = await verifyLaunch(app, ctx, { expectEmpty: false })
  if (!launchRead) return
  const docId = launchRead.cur
  if (prev.docId !== docId) {
    block('baseline', `当前会话 ${docId} 与基准文档 ${prev.docId} 不是同一篇——请确认用的是同一个 --root`)
    return
  }
  const realBefore = hashInventory(realWorkspaceDir())
  await gotoChat(app.page)
  await waitDocReady(app.page)
  const before = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || prev.previewTitle || '')

  const t0 = Date.now()
  const turn = await sendTurn(app.page, PROMPTS.L3, plan)
  const traceInfo = traceRecordsSince(ctx.iso.workspace, t0)
  const recon = reconcile(ctx.ledger, turn, traceInfo, plan)
  const after = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || '')
  const invocationLog = (await page.evaluate(() => {
    const p = window.__acceptanceProbe || { calls: [], model: [] }
    return { calls: p.calls.map((c) => c.cmd), model: p.model.map((m) => ({ cmd: m.cmd, turn: m.turn || null, slotId: m.slotId || null })) }
  })) || { calls: [], model: [] }
  const thisTurnCalls = invocationLog.calls.slice(before.ui.probeCallCount)
  const thisTurnModels = invocationLog.model.slice(before.probe.model.length)
  const writeTurns = thisTurnModels.filter((m) => m.cmd === 'chat_stream').map((m) => m.turn)
  const probeGenSvg = thisTurnModels.filter((m) => m.cmd === 'gen_svg').length
  const payload = { turn, recon, before: slimState(before), after: slimState(after), baseline: prev, thisTurnCalls, thisTurnModels }
  evidence.turns[evidence.turns.length - 1].snapshot = { before: slimState(before), after: slimState(after) }
  writeJsonEvidence(join(evidenceDir, 'L3-state.json'), payload, 'L3-state.json')
  realWorkspaceObserve(realBefore, 'L3 前后')
  log(`  [回合] ${turn.ended}，用时 ${turn.seconds}s，阶段=${turn.stages.join('→')}，派发=${recon.countedDispatches}（绘图 ${recon.countedGenSvg}）`)

  if (turn.aborted) {
    block('budget', turn.aborted)
    return
  }
  if (turn.ended !== 'idle') check(`${idTag()}回合正常跑完（不是超时/未开始）`, false, `ended=${turn.ended}`)
  else check(`${idTag()}回合正常跑完`, true, `${turn.seconds}s，阶段=${turn.stages.join('→')}`)

  check(
    `${idTag()}只增加聊天记录（消息数增加、助手回复非空）`,
    after.ui.msgCount > before.ui.msgCount && after.ui.lastAssistantText.length > 0,
    `消息 ${before.ui.msgCount} → ${after.ui.msgCount}；回复长度=${after.ui.lastAssistantText.length}`,
  )
  observe(
    `${idTag()}助手回复是否带正文片段`,
    `最后一条助手消息是否渲染"查看正文/HTML 源码"入口：${after.ui.lastHasSrcToggle}。` +
      '回复里出现示例正文属正常答疑（应用有文字专用入口，不会用它顶掉预览）；此条只作观测，不作判定。',
  )
  check(
    `${idTag()}无 write / revise / gen_svg 派发（trace 阶段 + 命令级 turn 档位双重口径）`,
    recon.phases.every((p) => !/write|revise|gen_svg|refine_brief|vision/.test(String(p))) &&
      !writeTurns.some((t) => t === 'write' || t === 'revise') &&
      probeGenSvg === 0,
    `trace 阶段=${JSON.stringify(recon.phases)}；chat_stream 档位=${JSON.stringify(writeTurns)}；绘图派发=${probeGenSvg}`,
  )
  check(
    `${idTag()}无文稿提交（本轮没有调用 save_document）`,
    !thisTurnCalls.includes('save_document'),
    `本轮命令=${JSON.stringify([...new Set(thisTurnCalls)])}`,
  )
  check(
    `${idTag()}文稿整套状态不变（generation / revisionId / manifest / 源文 / HTML 哈希与运行前一致）`,
    before.disk.ok &&
      after.disk.ok &&
      after.disk.generation === before.disk.generation &&
      after.disk.revisionId === before.disk.revisionId &&
      after.disk.manifestHash === before.disk.manifestHash &&
      after.disk.sourceHash === before.disk.sourceHash &&
      after.disk.htmlHash === before.disk.htmlHash &&
      JSON.stringify(after.disk.revisions) === JSON.stringify(before.disk.revisions),
    `generation ${before.disk.ok ? before.disk.generation : '-'} → ${after.disk.ok ? after.disk.generation : '-'}；revision=${after.disk.ok ? after.disk.revisionId : '-'}（不变）；revisions=${after.disk.ok ? after.disk.revisions.length : '-'} 个`,
  )
  check(
    `${idTag()}预览未被示例替换（标题与正文可见文字逐字不变）`,
    before.ui.article &&
      after.ui.article &&
      norm(before.ui.article.titleNodeText) === norm(after.ui.article.titleNodeText) &&
      before.ui.article.counted === after.ui.article.counted,
    `标题「${clip(after.ui.article ? after.ui.article.titleNodeText : '', 40)}」；正文 ${after.ui.article ? after.ui.article.bodyChars : -1} 字`,
  )
  // 说明：模型走"普通答复"分支时，应用会把本轮的状态标识清掉（setDeliveryState(null)），
  // 于是预览区的 doc-state 容器整体不渲染——这是"本轮没有文稿提交"的如实展示，不是文稿被改了。
  // 因此这里断言的是"**没有被换成另一份稿**"（不是草稿态、徽标要么不变要么随状态一起消失），
  // 论文稿本身是否变化由上面的磁盘/读回哈希负责。
  check(
    `${idTag()}预览没有被换成另一份稿（不是草稿态；版本徽标未指向别的版本）`,
    after.ui.docIsDraft !== '1' &&
      (after.ui.docState === null || (after.ui.docState === 'accepted' && after.ui.revisionBadge === before.ui.revisionBadge)),
    `doc-state=${after.ui.docState}（运行前=${before.ui.docState}）；徽标「${clip(after.ui.revisionBadge, 60)}」；draft 标记=${after.ui.docIsDraft}`,
  )
  check(
    `${idTag()}没有新的未完成素材 / 保存失败提示（答案没有把稿子带坏）`,
    after.ui.assetIssueCount === 0 && !after.ui.saveError,
    `未完成素材=${after.ui.assetIssueCount}；saveError=「${clip(after.ui.saveError, 120)}」`,
  )
}

// ---------- L5 ----------

async function runL5(ctx, app) {
  const prev = latestBaseline()
  if (!prev) {
    block('baseline', '找不到"关停前最后成功版本"的基准——请先用同一个 --root 跑 L1（L2/L4 可选）')
    return
  }
  check(`${idTag()}关停前基准齐备（revisionId / generation / 源文/HTML/绑定/快照哈希）`, !!(prev.revisionId && prev.sourceHash && prev.htmlHash && prev.bindingsHash && prev.snapshotsHash), `基准 phase=${prev.phase} revision=${prev.revisionId} generation=${prev.generation}`)
  writeJsonEvidence(join(evidenceDir, 'L5-baseline.json'), prev, 'L5-baseline.json')

  // ① PID-A：读回"关停前"状态，然后正常关掉
  const launchRead = await verifyLaunch(app, ctx, { expectEmpty: false })
  if (!launchRead) return
  const docId = prev.docId
  const realBefore = hashInventory(realWorkspaceDir())
  await waitDocReady(app.page)
  const stateA = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || prev.previewTitle || '')
  const fpA = stateA.view
  const cmpA = fpA ? fpEqual(fpA, prev, ['docId', 'generation', 'revisionId', 'runId', 'validation', 'sourceHash', 'htmlHash', 'qualityHash', 'bindingsHash', 'snapshotsHash', 'appSourceHash', 'appHtmlHash', 'appRevisionId', 'appGeneration']) : { equal: false, diff: ['磁盘不可读'] }
  check(`${idTag()}PID-A 读回的版本与关停前基准完全一致`, cmpA.equal, cmpA.diff.join('；') || '全部字段一致')
  writeJsonEvidence(join(evidenceDir, 'L5-before-shutdown.json'), { stateA: slimState(stateA), cmpA, pid: app.launch.pid }, 'L5-before-shutdown.json')
  const closeA = await app.close()
  check(`${idTag()}PID-A 已由 closeOwnPid 正常关闭（只关自有 PID）`, closeA.closed === true, JSON.stringify(closeA))
  observe(`${idTag()}关停`, `PID-A=${app.launch.pid} 已关闭；应用输出 ${JSON.stringify(app.sink)}`)
  realWorkspaceObserve(realBefore, 'L5 PID-A 运行前后')

  // ② PID-B：新 PID 打开**同一**隔离 profile
  const appB = await openApp(ctx.chromium, ctx)
  if (!appB) return // block 已在 openApp 里置好
  try {
    check(`${idTag()}PID-B 与 PID-A 是不同进程`, appB.launch.pid !== app.launch.pid, `A=${app.launch.pid} B=${appB.launch.pid}`)
    check(`${idTag()}PID-B 用的是同一隔离 profile / workspace`, appB.rec.profile === ctx.iso.profile && appB.rec.workspace === ctx.iso.workspace, `profile=${appB.rec.profile}`)
    const launchReadB = await verifyLaunch(appB, ctx, { expectEmpty: false })
    if (!launchReadB) return
    // 等重开后的界面把文稿恢复出来（不是 sleep 完就断言）
    await appB.page.waitForFunction(() => !!document.querySelector('[data-doc-state]'), null, { timeout: 60000 }).catch(() => {})
    await waitDocReady(appB.page)
    const t0 = Date.now()
    const stateB = await snapshot(appB.page, ctx.iso.workspace, docId, prev.titleNodeText || prev.previewTitle || '')
    const cmpB = stateB.view ? fpEqual(stateB.view, prev, ['docId', 'generation', 'revisionId', 'runId', 'validation', 'sourceHash', 'htmlHash', 'qualityHash', 'bindingsHash', 'snapshotsHash', 'appSourceHash', 'appHtmlHash', 'appRevisionId', 'appGeneration']) : { equal: false, diff: ['磁盘不可读'] }
    check(`${idTag()}PID-B 完整读回同一版本（与关停前基准逐字段一致）`, cmpB.equal, cmpB.diff.join('；') || '全部字段一致')
    check(
      `${idTag()}PID-B 界面显示的正是该版本（标题节点 + doc-state=accepted + 版本徽标）`,
      stateB.ui.docState === 'accepted' &&
        norm(stateB.ui.article ? stateB.ui.article.titleNodeText : '') === norm(prev.titleNodeText) &&
        stateB.ui.revisionBadge.includes(String(prev.revisionId)),
      `doc-state=${stateB.ui.docState}；标题=「${clip(stateB.ui.article ? stateB.ui.article.titleNodeText : '', 40)}」；徽标=「${clip(stateB.ui.revisionBadge, 60)}」`,
    )
    const traceAfter = traceRecordsSince(ctx.iso.workspace, t0)
    const probeB = await appB.page.evaluate(() => {
      const p = window.__acceptanceProbe || { model: [], calls: [] }
      return { model: p.model.map((m) => m.cmd), calls: p.calls.map((c) => c.cmd) }
    })
    check(
      `${idTag()}重开期间没有新的模型请求（探针无模型命令、trace 无新 request）`,
      probeB.model.length === 0 && traceAfter.requests.length === 0,
      `探针模型命令=${JSON.stringify(probeB.model)}；新 trace 请求=${traceAfter.requests.length}；重开本轮命令=${JSON.stringify([...new Set(probeB.calls)])}`,
    )
    recordLedger(ctx.ledger, { dispatches: 0, genSvg: 0, note: 'L5 关停重开：不新增模型调用' })
    writeJsonEvidence(join(evidenceDir, 'L5-after-reopen.json'), { stateB: slimState(stateB), cmpB, probeB, traceRequests: traceAfter.requests.length, pidB: appB.launch.pid }, 'L5-after-reopen.json')
  } finally {
    const closeB = await appB.close()
    check(`${idTag()}PID-B 已由 closeOwnPid 正常关闭`, closeB.closed === true, JSON.stringify(closeB))
  }
}

// ---------- L6 ----------

async function runL6(ctx, app) {
  const exportsDir = join(ctx.iso.workspace, 'exports')
  const launchRead = await verifyLaunch(app, ctx, { expectEmpty: false })
  if (!launchRead) return
  const docId = launchRead.cur
  const realBefore = hashInventory(realWorkspaceDir())
  const inventoryBefore = existsSync(exportsDir) ? hashInventory(exportsDir) : {}
  evidence.exportInventory = { before: Object.keys(inventoryBefore), dir: exportsDir }

  await waitDocReady(app.page)
  const state = await snapshot(app.page, ctx.iso.workspace, docId, '')
  check(
    `${idTag()}导出对象是当前已验收成品（doc-state=accepted 且磁盘成品可读）`,
    state.ui.docState === 'accepted' && state.disk.ok && state.disk.meta.validation === 'verified',
    `doc-state=${state.ui.docState}；revision=${state.disk.ok ? state.disk.revisionId : '-'}`,
  )
  const t0 = Date.now()
  const currentHtml = state.disk.ok ? state.disk.html : ''

  // ① HTML 导出
  await app.page.locator('[data-act="export-html"]').first().click()
  const htmlMsg = await waitForExportMsg(app.page, /已导出|导出失败/)
  log(`  [导出-HTML] ${htmlMsg}`)
  const htmlPath = (htmlMsg.match(/已导出：(.+)$/) || [])[1] || ''
  const htmlFileOk = htmlPath && existsSync(htmlPath) && readFileSync(htmlPath, 'utf8') === currentHtml
  check(
    `${idTag()}HTML 导出有 UI 回执且实际新文件内容与当前成品逐字节一致`,
    /已导出/.test(htmlMsg) && htmlFileOk,
    `回执=「${clip(htmlMsg, 200)}」；文件存在=${htmlPath ? existsSync(htmlPath) : false}；逐字节一致=${htmlFileOk}`,
  )

  // ② 图片导出（长图 + 分页）
  await app.page.locator('[data-act="export-images"]').first().click()
  const imgMsg = await waitForExportMsg(app.page, /已导出 .* 张图片|导出图片失败|转图失败/, 180000)
  log(`  [导出-图片] ${imgMsg}`)
  const imgDir = (imgMsg.match(/张图片到：(.+?)(（|$)/) || [])[1] || ''
  const declared = Number((imgMsg.match(/已导出 (\d+) 张图片/) || [])[1] || -1)
  const pngs = imgDir && existsSync(imgDir) ? readdirSync(imgDir).filter((n) => n.toLowerCase().endsWith('.png')).sort() : []
  check(
    `${idTag()}图片导出有 UI 回执、目标目录存在、实际写入张数与回执一致`,
    declared > 0 && !!imgDir && existsSync(imgDir) && pngs.length === declared,
    `回执张数=${declared}；目录=「${clip(imgDir, 200)}」；实际 PNG=${pngs.length} 个：${JSON.stringify(pngs.slice(0, 8))}`,
  )
  const longName = pngs.find((n) => n.includes('长图')) || ''
  const pageNames = pngs.filter((n) => /-\d+\.png$/.test(n)).sort()
  check(
    `${idTag()}长图与分页 PNG 实际存在`,
    !!longName && pageNames.length >= 1,
    `长图=${longName || '(缺)'}；分页=${JSON.stringify(pageNames)}`,
  )

  // ③ PNG 可解码 + 宽 750px + 分页无缺漏
  const infos = []
  for (const n of pngs) {
    const buf = readFileSync(join(imgDir, n))
    const head = pngInfo(buf)
    infos.push({ name: n, bytes: buf.length, ...head })
  }
  const allOk = infos.length > 0 && infos.every((i) => i.ok && i.iendOk && i.width === 750 && i.height > 0)
  check(
    `${idTag()}PNG 文件结构与宽度（签名 + IHDR + IEND；宽度全部 750px）`,
    allOk,
    infos.map((i) => `${i.name}:${i.ok ? `${i.width}x${i.height}` : 'BAD(' + i.reason + ')'}${i.iendOk ? '' : ' 无IEND'}`).join(' | '),
  )
  const longInfo = infos.find((i) => i.name === longName)
  const decodeResults = []
  for (const info of infos.slice(0, 12)) {
    const buf = readFileSync(join(imgDir, info.name))
    const dec = await pageFn(app.page, 'decodePng', { dataUrl: `data:image/png;base64,${buf.toString('base64')}` })
    decodeResults.push({ name: info.name, ...dec })
  }
  check(
    `${idTag()}PNG 能被浏览器真实解码（naturalWidth=750）`,
    decodeResults.length > 0 && decodeResults.every((d) => d.ok && d.w === 750),
    decodeResults.map((d) => `${d.name}:${d.ok ? `${d.w}x${d.h}` : 'decode失败'}`).join(' | '),
  )
  if (longInfo && longInfo.ok) {
    const expectPages = Math.ceil(longInfo.height / 2000)
    const heightsOk = pageNames.every((n, i) => {
      const info = infos.find((x) => x.name === n)
      return info && info.height === Math.min(2000, longInfo.height - i * 2000)
    })
    check(
      `${idTag()}分页无缺漏（页数 = ceil(长图高/2000)，每页高度符合切分口径）`,
      pageNames.length === expectPages && heightsOk,
      `长图 ${longInfo.width}x${longInfo.height}；期望 ${expectPages} 页，实际 ${pageNames.length} 页：${JSON.stringify(infos.filter((i) => /-\d+\.png$/.test(i.name)).map((i) => i.height))}`,
    )
    observe(
      `${idTag()}分页覆盖范围`,
      `本次短文长图 ${longInfo.width}x${longInfo.height}px、分页 ${pageNames.length} 页：**只证明${pageNames.length === 1 ? '单页' : '这一次的分页'}情形**，多页边界（溢出页）仍需确定性长文夹具验证，不能据此声称覆盖多页分页。`,
    )
  }

  const inventoryAfter = hashInventory(exportsDir)
  const exportDiff = diffInventory(inventoryBefore, inventoryAfter)
  check(
    `${idTag()}导出确实产生了新文件（导出目录清单出现新增）`,
    exportDiff.added.length > 0,
    `新增=${JSON.stringify(exportDiff.added.slice(0, 12))}（共 ${exportDiff.added.length} 个）`,
  )
  const probe = await app.page.evaluate(() => {
    const p = window.__acceptanceProbe || { model: [], calls: [] }
    return { model: p.model.map((m) => m.cmd), calls: p.calls.map((c) => c.cmd) }
  })
  const traceAfter = traceRecordsSince(ctx.iso.workspace, 0)
  const newReqs = traceRecordsSince(ctx.iso.workspace, t0).requests
  check(
    `${idTag()}本轮导出没有新增模型调用`,
    probe.model.length === 0 && newReqs.length === 0,
    `探针模型命令=${JSON.stringify(probe.model)}；本轮新 trace 请求=${newReqs.length}；全部 trace 请求数=${traceAfter.requests.length}`,
  )
  recordLedger(ctx.ledger, { dispatches: 0, genSvg: 0, note: 'L6 导出：不新增模型调用' })
  evidence.exportInventory.after = Object.keys(inventoryAfter)
  evidence.exportInventory.diff = exportDiff
  evidence.exportInventory.pngs = infos
  evidence.exportInventory.htmlMsg = htmlMsg
  evidence.exportInventory.imgMsg = imgMsg
  writeJsonEvidence(join(evidenceDir, 'L6-export.json'), evidence.exportInventory, 'L6-export.json')
  realWorkspaceObserve(realBefore, 'L6 前后')
  log(`  提示：图片导出会经产品自身逻辑打开导出目录窗口（explorer），这是产品行为；该目录在隔离 profile 内，不涉及真实数据。`)
}

/** 轮询等导出回执（.export-msg 只在成功/失败时非空） */
async function waitForExportMsg(page, re, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const s = await pageFn(page, 'readRun')
    if (s.exportMsg && re.test(s.exportMsg)) return s.exportMsg
    await page.waitForTimeout(700)
  }
  const s = await pageFn(page, 'readRun')
  return s.exportMsg || '(超时未出现导出回执)'
}

/** 解析 PNG 头（签名 / IHDR / IEND） */
function pngInfo(buf) {
  if (buf.length < 33) return { ok: false, reason: '文件过小' }
  const sig = buf.slice(0, 8).toString('hex')
  if (sig !== '89504e470d0a1a0a') return { ok: false, reason: 'PNG 签名不符' }
  const type = buf.slice(12, 16).toString('ascii')
  if (type !== 'IHDR') return { ok: false, reason: '首个数据块不是 IHDR' }
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const iendOk = buf.length >= 12 && buf.slice(-12).toString('hex') === '0000000049454e44ae426082'
  return { ok: true, width, height, bitDepth: buf[24], colorType: buf[25], iendOk }
}

// =====================================================================================
// 第 15 节：报告与收尾
// =====================================================================================

function reportMarkdown() {
  const led = evidence.ledgerAfter || {}
  const lines = []
  lines.push(`# 真机 + 真实模型验收 · ${phase}`)
  lines.push('')
  lines.push(`状态：**${run.status}**（检查 ${run.checks.filter((c) => c.pass).length}/${run.checks.length} 通过；计划 ${run.plannedCases.length} / 执行 ${run.executedCases.length}）`)
  lines.push('')
  lines.push(`- 时间：${run.startedAt} → ${run.finishedAt || ''}`)
  lines.push(`- 隔离 root：\`${root}\``)
  lines.push(`- 隔离 workspace：\`${evidence.isolation ? evidence.isolation.workspace : '(未建立)'}\``)
  lines.push(`- 证据目录：\`${evidenceDir}\``)
  lines.push(`- 复现命令：\`node scripts/live-acceptance.mjs ${phase} --root ${root}\``)
  if (run.blockedReason) lines.push(`- **阻塞原因**：${run.blockedReason}`)
  lines.push('')
  lines.push('## 检查清单')
  lines.push('')
  for (const c of run.checks) lines.push(`- ${c.pass ? 'PASS' : 'FAIL'} — ${c.id}${c.evidence.length ? `\n  - 证据：${c.evidence.join(' / ')}` : ''}`)
  if (!run.checks.length) lines.push('- （零条检查 = 错误，不是通过）')
  lines.push('')
  if (run.errors.length) {
    lines.push('## 错误')
    lines.push('')
    for (const e of run.errors) lines.push(`- \`${e.stage}\`：${e.message}`)
    lines.push('')
  }
  lines.push('## 观测与归因限制')
  lines.push('')
  for (const o of run.observations) lines.push(`- ${o.id}：${o.detail}`)
  lines.push('')
  lines.push('## 账本（跨 phase 累加）')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(led, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('## 被测输入指纹')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(evidence.inputFingerprints, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('## 隔离与证据文件')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify({ isolation: evidence.isolation, launches: evidence.launches }, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('## 原始 stdout')
  lines.push('')
  lines.push('```')
  lines.push(LOG.join('\n'))
  lines.push('```')
  return lines.join('\n') + '\n'
}

function finalizeAndExit() {
  run.status = statusOf()
  run.finishedAt = new Date().toISOString()
  evidence.status = run.status
  evidence.finishedAt = run.finishedAt
  let dir = evidenceDir
  try {
    ensureDir(dir)
  } catch {
    dir = join(tmpdir(), 'wxmp-live-acceptance-blocked')
    try {
      ensureDir(dir)
    } catch {
      /* 连临时目录都写不了：只在 stdout 报告 */
    }
  }
  writeFileEvidence(join(dir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n', 'run-result.json')
  writeFileEvidence(join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n', 'evidence.json')
  writeFileEvidence(join(dir, 'report.md'), reportMarkdown(), 'report.md')
  writeFileEvidence(join(dir, 'stdout.txt'), LOG.join('\n') + '\n', 'stdout.txt')
  log('')
  log(`  证据留档：${dir}`)
  log(`  run-result.json：${join(dir, 'run-result.json')}`)
  log(`LIVE-ACCEPTANCE ${run.status}（${phase}）`)
  const code = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
  process.exit(code)
}

// =====================================================================================
// 第 16 节：主流程
// =====================================================================================

async function main() {
  if (!phase) {
    console.error(`必须指定 phase（L1..L6）。\n${CONFIG_HINT}`)
    process.exit(2)
  }
  log(`=== 真机 + 真实模型验收 · ${phase} ===`)
  log(`  隔离 root：${root}`)
  log(`  被测 exe：${exe}`)
  log(`  预算：整批派发 ≤ ${MAX_DISPATCHES} 次，其中 gen_svg ≤ ${MAX_GEN_SVG} 次（跨 phase 累加，不清零）`)
  log('  题面：' + (PROMPTS[phase] ? PROMPTS[phase] : '(本 phase 不发消息)'))
  if (!PROMPTS[phase]) log('  （L5/L6 不新增模型调用，只做关停重开与导出核对）')

  if (!existsSync(exe)) {
    block('exe', `找不到被测 exe：${exe}（本脚本**不会**替你构建；请先按项目铁律 7 构建 release）`)
    return
  }
  evidence.inputFingerprints.exe = { path: exe, sha256: sha256File(exe), mtime: statSync(exe).mtime.toISOString() }
  for (const rel of ['src/App.tsx', 'src/lib/prep.ts', 'src/lib/delivery-quality.ts', 'src-tauri/src/chat.rs', 'src-tauri/src/documents.rs']) {
    const p = join(repoRoot, rel)
    if (existsSync(p)) evidence.inputFingerprints[rel] = sha256File(p)
  }
  const installerDir = join(repoRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
  if (existsSync(installerDir)) {
    const inst = readdirSync(installerDir).filter((n) => n.toLowerCase().endsWith('.exe'))
    evidence.inputFingerprints.installer = inst.map((n) => ({ name: n, sha256: sha256File(join(installerDir, n)) }))
  }

  evidenceDir = makeEvidenceDir()
  log(`  证据目录：${evidenceDir}`)

  loadKey()
  // 密钥拿不到就**不能启动应用**（否则子进程会拿到空/字面量 "null"，产生一次注定失败的假回合）
  if (run.blockedReason) return
  if (!acquireLock()) return
  if (run.blockedReason) return

  const iso = phaseContext()
  const ctx = { iso, key: SECRET, ledger: null, chromium: null }

  const led = loadLedger()
  evidence.ledgerBefore = { totals: { ...led.totals }, budget: { ...led.budget } }
  ctx.ledger = led
  const rem = remaining(led)
  const plan0 = PHASE_PLAN[phase]
  log(`  账本（累计）：已派发 ${led.totals.dispatches} 次、绘图 ${led.totals.genSvg} 次；剩余 ${rem.dispatches} / ${rem.genSvg}`)
  if (rem.dispatches < plan0.minDispatches) {
    block('budget', `累计额度不足以完成 ${phase}（需要至少 ${plan0.minDispatches} 次派发，剩余 ${rem.dispatches} 次）——拒绝派发，不静默追加回合`)
    return
  }
  if (plan0.maxGenSvg > 0 && rem.genSvg < 1) {
    block('budget', `${phase} 必须新画一张，但绘图额度已用尽（剩余 ${rem.genSvg}）——拒绝派发`)
    return
  }
  // 本回合的中止线 = min(该 phase 的额度, 整批剩余额度)：跨过这条线就是"要花掉不存在的额度"
  const plan = {
    ...plan0,
    maxDispatches: Math.min(plan0.maxDispatches, rem.dispatches),
    maxGenSvg: Math.min(plan0.maxGenSvg, rem.genSvg),
  }
  log(`  本回合中止线：派发 ≤ ${plan.maxDispatches}、绘图 ≤ ${plan.maxGenSvg}（超出即停手并 BLOCKED）`)

  const { chromium } = resolvePlaywright()
  if (!chromium) return // 缺 playwright 时**不启动应用**：连不上 WebView2 就别去开一个没人操作的实例
  ctx.chromium = chromium

  const app = await openApp(chromium, ctx)
  if (!app) return
  run.plannedCases = [phase]
  try {
    if (phase === 'L1') await runL1(ctx, app, plan)
    else if (phase === 'L2') await runWritePhase(ctx, app, 'L2', plan)
    else if (phase === 'L3') await runL3(ctx, app, plan)
    else if (phase === 'L4') await runWritePhase(ctx, app, 'L4', plan)
    else if (phase === 'L5') await runL5(ctx, app)
    else if (phase === 'L6') await runL6(ctx, app)
    run.executedCases = [phase]
  } catch (e) {
    fail('phase', `${String(e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)}`)
  } finally {
    // 收尾：把**本轮启动过的每一个**自有 PID 都关掉（失败路径也一样），一个都不留给用户
    for (const h of HANDLES) {
      if (h.closed) continue
      const r = await closeOwnPid(h.pid)
      h.closed = true
      h.rec.closed = { ...r, at: new Date().toISOString(), via: 'phase-finally' }
      log(`  [收尾] 关闭自有 PID ${h.pid}：${JSON.stringify(r)}`)
    }
    evidence.ledgerAfter = loadLedger()
  }
}

/** playwright 解析：require('playwright') → VERIFY_PLAYWRIGHT；都拿不到就 BLOCKED（不静默跳过） */
function resolvePlaywright() {
  const require = createRequire(import.meta.url)
  const tried = []
  try {
    return { chromium: require('playwright').chromium }
  } catch (e) {
    tried.push(`require('playwright') → ${String(e.message || e).split('\n')[0]}`)
  }
  const p = process.env.VERIFY_PLAYWRIGHT
  if (p) {
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return { chromium: require(target).chromium }
    } catch (e) {
      tried.push(`VERIFY_PLAYWRIGHT=${target} → ${String(e.message || e).split('\n')[0]}`)
    }
  } else {
    tried.push('VERIFY_PLAYWRIGHT → 未设置')
  }
  block(
    'deps',
    `解析不到 playwright 模块（本脚本需要它用 CDP 连上真实 WebView2；只需 JS 模块，不需要浏览器二进制）。已尝试：${tried.join('；')}。` +
      '可用环境变量指定，例如（本机已装路径）：VERIFY_PLAYWRIGHT=D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright',
  )
  return { chromium: null }
}

// 顶层收尾：无论如何都释放锁（真正关闭 PID 在 main 的 finally 里）
try {
  await main()
} catch (e) {
  fail('top', String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e))
} finally {
  if (run.executedCases.length && run.executedCases.length === run.plannedCases.length) run.executionComplete = true
  releaseLock()
  finalizeAndExit()
}
