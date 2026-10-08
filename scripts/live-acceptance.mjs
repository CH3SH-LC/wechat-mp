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

import { createRequire, stripTypeScriptTypes } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir, tmpdir } from 'node:os'
import {
  closeOwnPid,
  diffInventory,
  freePort,
  hashInventory,
  launchDesktop,
  prepareIsolation,
  procIdentity,
  realWorkspaceDir,
  waitForCdp,
} from './lib/desktop-harness.mjs'
// 判定与落盘口径复用共享模块：本脚本自己写的 `finalizeAndExit` 曾经在**证据写入之前**就把
// 状态定死，写盘失败照样 PASS——修共享模块不会自动修到这个独立实现，所以它也改成调同一套。
import { persistRunResult } from './lib/run-result.mjs'
// 派发**之前**的付费预算（指南 §0.3 R2）。与 `scripts/budget-check.mjs` 测的是同一个模块：
// 那边用假传输逐条验收，这边只做接线。
import {
  DEFAULT_MAX_DISPATCHES,
  DEFAULT_MAX_GEN_SVG,
  GLOBAL_LEDGER,
  createBudget,
  parseBudgetParam,
  readLedgerFile,
} from './lib/dispatch-budget.mjs'
import { gateCoverageProven, installProbeSource } from './lib/ipc-gate.mjs'
import { finalizePhase, preflightLedgerGate, runFinalizeSequence } from './lib/ledger-finalize.mjs'
import { factChecks, inventedQuotaHits, norm } from './lib/fact-assert.mjs'
import { canReopenAfterClose, compareDispatchEvidence, readTraceRecords, summarizeRequests } from './lib/trace-read.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// =====================================================================================
// 第 0 节：参数
// =====================================================================================

const argv = process.argv.slice(2)
const PHASES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'G1', 'G2A', 'G2B', 'G3', 'BIG', 'LONG2']
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
// 额度参数必须是**有限非负整数**（指南 §0.3）：非法值一律 BLOCKED，不能被当成默认值悄悄放过去，
// 更不能靠 `--max-dispatches 1e9` 之类把授权额度放大。
// 注意 `def` 传的是 `null` 而不是默认额度：**没给参数**与"给了个值"必须可区分——
// 没给就是"没意见"（沿用盘上账本已存的上限），给了值才表达"只能调小"（见 dispatch-budget 的 clampBudget）。
// 2026-10-02 踩到：用户放宽授权后，一次没带参数的普通运行会把上限悄悄压回默认 20。
const MAX_DISPATCHES_ARG = parseBudgetParam(opt('max-dispatches', null), null)
const MAX_GEN_SVG_ARG = parseBudgetParam(opt('max-gen-svg', null), null)
// 上次业务失败必须**显式解除**才能继续付费 phase（指南 §0.4 末段）。理由要写下来，留痕。
const RESUME_REASON = opt('resume-after-fix', null)
// 没给参数 → `undefined`（= 没意见）；非法 → `NaN`（下面会 BLOCKED）
const MAX_DISPATCHES = MAX_DISPATCHES_ARG.ok ? (MAX_DISPATCHES_ARG.value == null ? undefined : MAX_DISPATCHES_ARG.value) : NaN
const MAX_GEN_SVG = MAX_GEN_SVG_ARG.ok ? (MAX_GEN_SVG_ARG.value == null ? undefined : MAX_GEN_SVG_ARG.value) : NaN

const CONFIG_HINT = `用法：node scripts/live-acceptance.mjs <L1..L8|G1|G2A|G2B|G3> [--root <dir>] [--exe <path>]
  · L1..L4 必须共用同一个 --root（同一 profile / workspace / 会话），L5/L6 也用同一个；
  · F1 三组样本：G1（稀疏长稿，逐字同 L7 题面）→ G2B（只改标题）必须共用同一个 --root；
    G2A（首稿未定）与 G3（正向授权）各自用**新的空 root**（它们都是首稿）；
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
  // L7 长文代表稿（§0.0 P2.3）：**同一组固定事实**，但要求写成 800–1200 字长文 + 一张开篇横图。
  // 复用同一组事实是有意的：事实断言 `factChecks()` 就是按这组事实写的，长文才能用同一套已验证的口径核对，
  // 不需要另造一套断言（另造一套就等于换题面）
  L7:
    '请直接写一篇校园图书馆的介绍长文，采用默认校园风格，不再询问。固定测试情境：2026年10月10日周六 9:00–17:00 开放；' +
    '2026年10月11日周日全天闭馆；自习区在一楼；咨询电话010-55556666。标题“校园图书馆开放通知”，正文不少于800字、不超过1200字。' +
    '只配一张开篇横图：暖色台灯照亮蓝色书本，不要照片位、角饰或额外图片。',
  // L8 只改文字保留图片（§0.0 P2.3 的续改）
  L8:
    '把标题改为“冬季开馆时间调整”，正文压缩到 300–500 字；完整保留开放日期时段、周日全天闭馆、一楼自习区和电话。' +
    '只改文字，现有配图和所有素材保持原样。',

  // ---- F1（2026-10-03，用户明文授权真实小样）三组材料依据样本 ----
  // G1 **逐字同 L7 题面**：同一输入，改前产出的是"补了 13 条未给规则"的坏稿（见 F1 证据），
  // 这样才构成同输入的前后对照，而不是换一道题再夸一遍。
  G1:
    '请直接写一篇校园图书馆的介绍长文，采用默认校园风格，不再询问。固定测试情境：2026年10月10日周六 9:00–17:00 开放；' +
    '2026年10月11日周日全天闭馆；自习区在一楼；咨询电话010-55556666。标题“校园图书馆开放通知”，正文不少于800字、不超过1200字。' +
    '只配一张开篇横图：暖色台灯照亮蓝色书本，不要照片位、角饰或额外图片。',
  // G2a 首稿未定：费用与人数上限**明确没给**，不得补成免费 / 限额。
  G2A:
    '帮我写一篇周末亲子手工活动的报名通知，直接写，不要再问我。固定情境：活动日期是 2026年11月15日（周六）。' +
    '报名费用和人数上限还没定下来，先按这个写。标题“亲子手工活动报名通知”。',
  // G2b 旧稿只改标题：正文与素材必须原样保留。
  G2B: '只把标题改成“图书馆开放时间调整通知”，正文和配图一个字都不要动。',
  // G3 正向授权：材料**确实给了**免费 / 预约顺延 / 9–17 值守，必须准确保留，不能被"防编造"误伤砍掉。
  G3:
    '帮我写一篇馆内活动通知，直接写。材料如下：本活动免费参加；原预约自动顺延到下周一同一时段，不用重新预约；' +
    '现场 9:00–17:00 有人值守。标题“周末活动安排通知”，最后再附两句一般性的到场建议。',

  // ---- BIG（2026-10-08 用户指令：攻大文章——数个章节、每章几张插图）----
  // 目的：把"绘制并发上限 2 → 20"放到**真实链路**上验证。这篇要求约 10 张插画：
  // 旧上限下它们是 5 波串行（每波 2 张），新上限下应当**同时在飞**。
  // 峰值由 trace 的 gen_svg 请求区间**实测**（见 reconcile），不看配置常量。
  BIG:
    '请直接写一篇校园“秋季社团招新”介绍长文，采用默认校园风格，不再询问。要求：分成 5 个小节，' +
    '每个小节标题下各配 2 张插画，全文共 10 张插画，每张都要有独立画面。固定测试情境：' +
    '报名从 2026年10月20日周二开始；地点在大学生活动中心一楼；咨询电话010-55566666。' +
    '标题“秋季社团招新指南”，正文 1500–2500 字。不要照片位。',

  // LONG2（2026-10-08，用户目标"商用级长短均可"）：**第二个、刻意不同体裁**的长文题面。
  // 目的：T7（真机分页切穿文字行）修复后的验证目前只覆盖 BIG 一个题面；换一个体裁，
  // 才能把"分页不再切穿文字行"从"一个题面成立"推到"两个不同体裁都成立"。
  // 刻意处处与 BIG 不同：体裁（科普介绍 vs 活动指南）、结构（1 横图 + 3 小节各 1 图 = 4 张 vs 5×2=10 张）、
  // 字数（1600–2200 vs 1500–2500）、材料（**另一天 / 另一地点 / 另一个电话**——跨题面串味会被断言抓到）。
  LONG2:
    '请直接写一篇介绍「图书馆自助借还系统」的科普长文，采用默认校园风格，不再询问。要求：' +
    '开篇配 1 张横图；正文分成 3 个小节，每个小节各配 1 张插画，全文共 4 张插画。固定测试情境：' +
    '系统从 2026年11月3日（周二）起启用；自助设备在图书馆二楼自助服务区；咨询电话 010-55577777。' +
    '标题“自助借还系统使用指南”，正文 1600–2200 字。不要照片位。',
}

/** 每个 phase 的额度与写不写稿。maxDispatches 是本回合的**中止线**（超了就停手并 BLOCKED），不是目标值。 */
const PHASE_PLAN = {
  L1: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 3, title: '校园图书馆开放通知' },
  L2: { writes: true, minDispatches: 2, maxDispatches: 4, maxGenSvg: 0, title: '周末到馆提醒' },
  L3: { writes: false, minDispatches: 1, maxDispatches: 3, maxGenSvg: 0, title: null },
  L4: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 2, title: '周末到馆提醒' },
  L5: { writes: false, minDispatches: 0, maxDispatches: 0, maxGenSvg: 0, title: null },
  L6: { writes: false, minDispatches: 0, maxDispatches: 0, maxGenSvg: 0, title: null },
  // L7 长文：长稿比短通知更容易触发多轮，但仍按同一套有界预算（首篇 5 次、绘图 3 次）
  L7: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 3, title: '校园图书馆开放通知' },
  // L8 只改文字：不绘图
  L8: { writes: true, minDispatches: 2, maxDispatches: 4, maxGenSvg: 0, title: '冬季开馆时间调整' },
  // F1 三组样本：每篇仍按同一套有界预算（首篇 5 次、绘图 3 次；只改标题那条不绘图）
  G1: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 3, title: '校园图书馆开放通知' },
  G2A: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 3, title: null },
  G2B: { writes: true, minDispatches: 2, maxDispatches: 4, maxGenSvg: 0, title: '图书馆开放时间调整通知' },
  G3: { writes: true, minDispatches: 2, maxDispatches: 5, maxGenSvg: 3, title: null },
  // BIG 大文章（2026-10-08）：绘图预算按用户指令放到 20；派发上限要容得下 prep + 写作 + 约 10 张图 + 修订。
  // `minObservedConcurrency` 是**实测要求**：绘图请求数够多时，trace 算出的并发峰值必须 ≥ 它，
  // 否则说明并发上限没真的放开（仍是一波 2 个的串行）。
  // 中止线要容得下：prep（最多 3）+ 写作 1 + 约 10 张图（含重试；首次实测用了 14）+ 自动修订若干轮。
  // 2026-10-08 首次跑用 18 太紧：14 张图 + 写作 + 修订就把中止线烧光，还**主动拦掉了一次绘图**
  // （`fail/unknown：预算门禁拒绝派发：本回合派发已达中止线 18`）——于是"没成稿"里混进了测试脚本
  // 自己的限制，那不算产品结论。加大到 40，让中止线只作兜底、不参与判断。
  BIG: { writes: true, minDispatches: 4, maxDispatches: 40, maxGenSvg: 20, title: '秋季社团招新指南', minObservedConcurrency: 4 },
  // LONG2（2026-10-08）：第二个不同体裁的长文。配图只有 4 张，`minObservedConcurrency` 相应降到 3
  // （4 张一起派出去时峰值就该是 4；要求 3 是**可达且仍有意义**的下界——这一档的并发不是本题的重点，
  // 重点是**分页缝合**，BIG 那档才承担"并发放开"的断言）。
  LONG2: { writes: true, minDispatches: 4, maxDispatches: 40, maxGenSvg: 12, title: '自助借还系统使用指南', minObservedConcurrency: 3 },
}

// =====================================================================================
// 第 4.5 节：F1「材料依据边界」三组样本的内容判定
// =====================================================================================
//
// 判定读的是**成品正文**（admissibility 的产物），不是产品侧的关键词阻断——
// 产品里没有、也不允许有这种阻断（铁律 6 / 任务卡 §2）。这里只是验收脚本在体检成品。
// 长短匹配一律走 `norm()`（去空白、破折号统一），与 factChecks 同一口径。
const GROUNDING = {
  // G1：**逐字同 L7 题面**。改前同一输入产出的稿件补了 13 条材料未给的规则（见 F1 证据），
  // 下面每一条就是那 13 条里的一个可识别片段——它们**必须不出现**。
  G1: {
    facts: 'l1', // 与 L1/L7 同一组固定事实，继续用 factChecks 核对（不另造一套）
    forbidden: [
      ['周一恢复开放', '恢复正常'],
      ['清场安排', '清场'],
      ['门口张贴告示', '告示'],
      ['线上续借承诺', '续借'],
      ['预约/归还日顺延', '顺延'],
      ['储物格等现场设施', '储物格'],
      ['插座数量', '插座'],
      ['一楼服务台', '服务台'],
      ['"按学校统一安排"式机构授权来源', '学校'],
      ['电话有人值守', '值守'],
      ['预约取书/预约规则', '预约'],
    ],
  },
  // G2a：费用与人数**明确未定**，不得补成免费 / 限额 / 先到先得；日期要保住。
  G2A: {
    required: [['材料给的日期被保住', '11月15日']],
    forbidden: [
      ['把未定的费用写成免费', '免费'],
      ['把未定的费用写成不收费', '不收费'],
      // T4（2026-10-08）：原判据是裸子串「限额」「名额」——但 G2A 实测写的是
      // 「会在费用、**名额确定后**一并向大家说明」，**恰好说明它没编**，却被判红（假红）。
      // 真正的缺陷形态是**给未定项安上一个数字**，改走 `inventedQuotaHits`（纯函数，离线有断言）。
      ['把未定的人数写成具体名额数（数字 × 名额/人数）', '数字 × 名额/人数 的写法', 'quota'],
      ['把未定的规则写成先到先得', '先到先得'],
    ],
  },
  // G3 正向授权（过度阻断对照）：材料**确实给了**的规则必须准确保留。
  G3: {
    required: [
      ['材料给的"免费参加"被保住', '免费'],
      ['材料给的"预约自动顺延"被保住', '顺延'],
      ['材料给的"9:00–17:00 值守"被保住', '9:00'],
    ],
    // 过度阻断的失败形态是"把已给的规则也删了/写成待定"，用一个明确片段兜底；
    // 真正的"反复追问"由"本轮必须 accepted 提交"兜住（追问就没有提交）。
    forbidden: [['把已给的免费写成待定', '费用待定']],
  },
  // BIG（2026-10-08 大文章）。**不**复用 L1 的事实地图——那是"图书馆开放"那篇的固定事实，
  // 套到这题上必然全红（2026-10-08 首次跑就是这么错的：BIG 没传 grounding，按代码默认走了 L1 的
  // factChecks，于是"10月10日 9:00–17:00 开放 / 010-55556666"这些**本题根本没有**的事实被判 FAIL）。
  // 按代码口径：`grounding` 存在且 `facts ≠ 'l1'` ⇒ 跳过 L1 factChecks，只核下面这组本題面的材料。
  BIG: {
    required: [
      ['材料给的报名开始日期被保住', '10月20日'],
      ['材料给的报名地点被保住', '活动中心'],
      ['材料给的咨询电话被保住', '010-55566666'],
      // 标题**不**在这里核：标题存在标题节点里（`titleNodeText`），已由「标题节点与源文」那条专门断言覆盖。
      // 2026-10-08 首次跑把它写进 required、去**正文**里搜整串，正文按标题断句渲染（"秋季社团招新"+换行），
      // 必然搜不到 —— 那是判据写错造成的假红，不是产品问题（同「名额」那一类）。
    ],
    forbidden: [],
  },
  // LONG2（2026-10-08）：材料是**另一组**——11月3日 / 二楼 / 010-55577777。
  // 与 BIG（10月20日 / 活动中心 / 010-55566666）逐项不同，所以一旦模型把别的题面的材料串进来，
  // 这几条**必须**红。标题同样不进 required（标题在标题节点里，由专门断言覆盖，同 BIG 的理由）。
  LONG2: {
    required: [
      ['材料给的启用日期被保住', '11月3日'],
      ['材料给的地点被保住', '二楼'],
      ['材料给的咨询电话被保住', '010-55577777'],
    ],
    forbidden: [],
  },
}

// =====================================================================================
// 第 5 节：账本（跨 phase 累加，派发**之前**检查额度）
// =====================================================================================

// 权限账本在**固定路径**（与 `--root` 无关）：换 `--root` 不能成为重置授权额度的方法（指南 §0.3）。
// `root/ledger.json` 只作本次证据的镜像。
const ledgerPath = GLOBAL_LEDGER
const mirrorLedgerPath = join(root, 'ledger.json')
const lockPath = join(root, '.live-acceptance.lock')

function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * 同 profile 锁：用 `wx` **原子创建**，不"先读后写"。
 *
 * 原来的读-判断-写不是原子的：两个 phase 同时启动时都能读到"没有 holder"，然后都把自己写进去，
 * 于是同一个隔离 profile 上真的跑起两个实例。`wx` 让"检查"与"占用"合成一次系统调用，
 * 只有一个能成功。
 */
function acquireLock() {
  ensureDir(root)
  const payload = JSON.stringify({ pid: process.pid, phase, at: new Date().toISOString() })
  const tryCreate = () => {
    try {
      writeFileSync(lockPath, payload, { encoding: 'utf8', flag: 'wx' })
      return true
    } catch (e) {
      if (e && e.code === 'EEXIST') return false
      block('lock', `无法创建锁文件 ${lockPath}：${String((e && e.message) || e)}`)
      return false
    }
  }
  if (tryCreate()) return true
  // 已存在：只有"占用者确实还活着"才算冲突；占用者已死则回收（同一 profile 的上一轮崩了）
  const holder = readJson(lockPath)
  if (holder && holder.pid === process.pid) return true
  if (holder && holder.pid && isPidAlive(holder.pid)) {
    block('lock', `另一个 phase 正在运行（pid=${holder.pid}，phase=${holder.phase}，起于 ${holder.at}）。同一 profile 不得同时跑两个实例。`)
    return false
  }
  try {
    writeFileSync(lockPath, payload, 'utf8') // 持有者已退出：覆盖它
    return true
  } catch (e) {
    block('lock', `回收死锁失败：${String((e && e.message) || e)}`)
    return false
  }
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

// =====================================================================================
// 第 6 节：trace 读取（派发计数的权威来源之一）
// =====================================================================================

// trace 读取与派发核对已抽到 `scripts/lib/trace-read.mjs`：那套逻辑原来长在这个**要连真机**的脚本里，
// 离线回归够不着，于是"traces 目录不存在时漏 `requests` 字段 → 调用方 TypeError"一直没被发现。
// 现在由 `scripts/live-driver-check.mjs` 用替身目录逐条钉住。
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
  // 本产品的排版引擎**不输出 h1..h6**（公众号正文用 section/span + 内联样式，语义标题会被平台吃掉），
  // 所以没有 h1..h6 时要把"文本恰等于标题的那个节点"当作标题节点，否则标题断言永远红。
  '  if (!firstHeading && titleEl) firstHeadingText = (titleEl.textContent || "").trim();',
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
  /**
   * 安装 invoke 探针（指南 §0.3 R2）。
   *
   * **关键差别：付费命令先预留、后派发。**
   * 原来是「记录 → 直接 `orig()`」，预算只在脚本侧事后轮询，所以额度只剩 1 次时同时来的两个
   * 请求**两个都真的发出去了**。现在付费命令一律：先 `await window.__acceptanceReserve(cmd)`
   * （宿主侧原子预留并落盘），**只有** `ok===true` 才 `orig()`；预留失败就地抛错、一次都不发。
   *
   * `probe.transport` 因此就是"真的打到端点的次数"——它不是断言里的常量，而是门禁放行的产物。
   * 宿主没暴露 `__acceptanceReserve` 时**拒绝安装**：宁可不测，也不在无门禁状态下花钱。
   *
   * **源码已移到 `scripts/lib/ipc-gate.mjs`**：那段逻辑原来只挂在 `window.fetch` 上，
   * 而 tauri 2.11.5 在任意一次 IPC fetch/解码失败后会把此后所有命令切到
   * `window.ipc.postMessage`（wry 冻死的对象，拦不住）。现在它守的是"永不切通道 + 一旦故障就停发
   * + 覆盖率自证"三条防线，由一个纯 Node 的回归脚本（`scripts/ipc-gate-check.mjs`，
   * 用本机真实的 tauri 协议源码 + 假传输）逐条钉住，所以它必须能被单独 import。
   */
  installProbe: installProbeSource,

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
    // 探针**在不在**必须能被读到：原来只有"计数为 0"，而"探针丢了"与"确实没派发"长得一模一样
    '  probeInstalled: !!window.__acceptanceProbe,',
    // 门禁还**在链路上**吗？"探针对象在"与"拦截函数还挂着"是两件事：
    // 2026-10-02 晚间的反例就是把 window.fetch 还原之后，旧标记还在、门禁却已经不生效了。
    '  gateLive: !!(window.__acceptanceProbe && window.__acceptanceProbe.gate && window.__acceptanceProbe.gate.wrappedFetch === window.fetch),',
    '  fallbackLatched: !!(window.__acceptanceProbe && window.__acceptanceProbe.fallbackLatched),',
    '  coverageViaFetch: !!(window.__acceptanceProbe && window.__acceptanceProbe.coverage && window.__acceptanceProbe.coverage.viaFetch),',
    '  genSvg: probe.model.filter(function (m) { return m.cmd === "gen_svg"; }).length,',
    '  transport: probe.transport || 0,',
    '  transportDraw: probe.transportDraw || 0,',
    '  refused: (probe.refused || []).length,',
    '  msgs: document.querySelectorAll(".msg").length,',
    '  lastAssistantLen: lastText.trim().length,',
    '  docState: q("[data-doc-state]") ? q("[data-doc-state]").getAttribute("data-doc-state") : null,',
    '  errorText: q(".msg-error") ? (q(".msg-error").textContent || "").trim() : "",',
    '  saveError: q(".save-error") ? (q(".save-error").textContent || "").trim() : "",',
    // ⚠️ 导出回执必须由**这里**返回：`waitForExportMsg()` 读的就是 `readRun()` 的 `exportMsg`，
    // 而它一直只长在 `readState` 里——于是 L6 永远等不到回执（2026-10-02 真机：
    // 文件确实导出了、回执也显示了 8s，但驱动读的字段不存在，只能报"超时未出现导出回执"）。
    '  exportMsg: q(".export-msg") ? (q(".export-msg").textContent || "").trim() : "",',
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
    '  probeRefused: (probe.refused || []).map(function (m) { return { t: m.t, cmd: m.cmd, slotId: m.slotId || null, reason: m.reason }; }),',
    '  probeTransport: probe.transport || 0,',
    '  probeInstalled: !!window.__acceptanceProbe,',
    '  probeCallCount: probe.calls.length,',
    // 门禁健康度进证据：切通道、解码失败、拦截函数脱落都必须留痕，不能只体现在"传输 0 次"上
    '  probeGateLive: !!(probe.gate && probe.gate.wrappedFetch === window.fetch),',
    '  probeFallbackLatched: !!probe.fallbackLatched,',
    '  probeFallbackReason: probe.fallbackReason || null,',
    '  probeCustomProtocolFailures: (probe.customProtocolFailures || []).slice(0, 5),',
    '  probeDecodeFailures: (probe.decodeFailures || []).slice(0, 5),',
    '  probeGateIdentityFailures: probe.gateIdentityFailures || 0,',
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

  /**
   * 逐页与长图**对应条带**做逐像素比较（L6 分页断言的加强，2026-10-08，待办 T6 第一处盲点）。
   *
   * 为什么需要它：`Σ页高 = 长图高` 证明的是"覆盖面完整"，**证明不了"每页画的是它该画的那一段"**——
   * 页序颠倒、或每页整体偏移 ±N 像素（只要页高之和仍等于长图高），旧断言一律通过。
   *
   * 口径：第 k 页的像素 vs 长图从 `top = Σ前 k-1 页高` 起的同尺寸条带，**逐像素、零容差**
   * （容差等于把"画错了多少"藏起来）。差异像素数与首个差异行原样报出；页宽不一致、条带越界
   * 单独标出，**不冒充"比过了"**（`diff:-1` 表示没比）。
   */
  comparePagesToLong: [
    'var a = arg || {};',
    'function load(u) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i) }; i.onerror = function () { rej("decode failed") }; i.src = u; }); }',
    'function ctxOf(img) { var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; var x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0); return x; }',
    'return Promise.all([load(a.long)].concat(a.pages.map(function (p) { return load(p.dataUrl) }))).then(function (imgs) {',
    '  var li = imgs[0]; var lw = li.naturalWidth, lh = li.naturalHeight; var lctx = ctxOf(li);',
    '  var out = []; var top = 0;',
    '  for (var k = 0; k < a.pages.length; k++) {',
    '    var pi = imgs[k + 1]; var w = pi.naturalWidth, h = pi.naturalHeight; var n = Math.min(w, lw);',
    '    var rec = { index: k, top: top, w: w, h: h, inRange: top + h <= lh, diff: -1, firstRow: -1, note: "" };',
    '    if (w !== lw) { rec.note = "页宽与长图不一致"; }',
    '    else if (!rec.inRange) { rec.note = "该页条带超出长图范围"; }',
    '    else {',
    '      var pd = ctxOf(pi).getImageData(0, 0, n, h).data;',
    '      var ld = lctx.getImageData(0, top, n, h).data;',
    '      var d = 0, fr = -1;',
    '      for (var i = 0; i < pd.length; i += 4) {',
    '        if (pd[i] !== ld[i] || pd[i + 1] !== ld[i + 1] || pd[i + 2] !== ld[i + 2] || pd[i + 3] !== ld[i + 3]) { d++; if (fr < 0) fr = Math.floor(i / 4 / n); }',
    '      }',
    '      rec.diff = d; rec.firstRow = fr;',
    '    }',
    '    out.push(rec); top += h;',
    '  }',
    // ⑥ 缝口：每个切点（= 每页上边）上下各取一行，数"同一列两行都是深墨"的列数。
    // 口径与 export-paging-check 完全一致（深墨 = RGB 三通道都 < 180）。列数 > 0 ⇒ 这一刀切在字上。
    '  var seams = [];',
    '  for (var q = 1; q < out.length; q++) {',
    '    var cy = out[q].top;',
    '    if (cy <= 0 || cy >= lh) continue;',
    '    var A = lctx.getImageData(0, cy - 1, lw, 1).data, B = lctx.getImageData(0, cy, lw, 1).data;',
    '    var cross = 0;',
    '    for (var j = 0; j < A.length; j += 4) {',
    '      if (A[j] < 180 && A[j + 1] < 180 && A[j + 2] < 180 && B[j] < 180 && B[j + 1] < 180 && B[j + 2] < 180) cross++;',
    '    }',
    '    var nearest = -1;',
    '    for (var d = 0; d <= 30 && nearest < 0; d++) {',
    '      var up = cy - d >= 0 ? lctx.getImageData(0, cy - d, lw, 1).data : null;',
    '      var dn = cy + d < lh ? lctx.getImageData(0, cy + d, lw, 1).data : null;',
    '      var hitU = false, hitD = false;',
    '      if (up) for (var k = 0; k < up.length; k += 4) if (up[k] < 180 && up[k + 1] < 180 && up[k + 2] < 180) { hitU = true; break; }',
    '      if (dn) for (var k2 = 0; k2 < dn.length; k2 += 4) if (dn[k2] < 180 && dn[k2 + 1] < 180 && dn[k2 + 2] < 180) { hitD = true; break; }',
    '      if (hitU || hitD) nearest = d;',
    '    }',
    '    seams.push({ cut: cy, cross: cross, nearestInk: nearest });',
    '  }',
    '  return { longW: lw, longH: lh, coveredSum: top, pages: out, seams: seams };',
    '});',
  ].join('\n'),

  /**
   * 诊断（只观测、不判定，2026-10-08 R10 / 待办 T7）：
   * **把产品自己的"量 → 画"两步在真机上重跑一遍**，看"量出来的行盒"与"画出来的像素"对不对得上。
   *
   * 为什么要它：`renderArticleImages` 是**先量后画**——量的是挂在文档里的 `<div>`，
   * 画的是 `<img src="data:image/svg+xml,…">` 里的 `<foreignObject>`（**图片是独立文档上下文，
   * 页面 CSS 不参与**）。两者若布局有别，行盒位置就会整体错开并向下累积，切点就可能落在字上。
   *
   * 这里**逐行**核对：把量到的每个行盒换算成设备像素区间，数该区间里有没有墨。
   * 返回"完全无墨的行盒数"与`首行到末行`的漂移抽样，用来区分两种根因：
   *   · 行盒里有墨但位置系统性偏移 ⇒ 量/画两套上下文不一致（假设成立）；
   *   · 行盒位置与墨迹吻合 ⇒ 量/画一致，问题在切点选择逻辑（假设不成立）。
   * **只给观测数字，不给结论**——结论要人看。
   */
  measureRenderAgreement: [
    'var html = arg.html;',
    'var SCALE = 2, WIDTH = 375;',
    'function inkInRow(ctx, y, w) { var d = ctx.getImageData(0, y, w, 1).data; var n = 0; for (var k = 0; k < d.length; k += 4) if (d[k] < 180 && d[k + 1] < 180 && d[k + 2] < 180) n++; return n; }',
    'function inkInBand(ctx, y0, y1, w) { var n = 0; for (var y = Math.max(0, y0); y < y1; y++) n += inkInRow(ctx, y, w); return n; }',
    'function nearestInk(ctx, y, w, h) { for (var d = 0; d <= 60; d++) { if (y - d >= 0 && inkInRow(ctx, y - d, w) > 0) return -d; if (y + d < h && inkInRow(ctx, y + d, w) > 0) return d; } return null; }',
    'return (async function () {',
    '  var host = document.createElement("div");',
    // 与 src/lib/htmlToImage.ts 的 renderArticleImages **逐字一致**（改产品时必须同步改这里）
    '  host.style.cssText = "position:fixed;left:-20000px;top:0;width:375px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;";',
    '  host.innerHTML = "<div style=\\"width:375px;box-sizing:border-box\\">" + html + "</div>";',
    '  document.body.appendChild(host);',
    '  await Promise.all(Array.prototype.slice.call(host.querySelectorAll("img")).map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }));',
    '  await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });',
    '  var hCss = Math.ceil(host.getBoundingClientRect().height);',
    '  var top0 = host.getBoundingClientRect().top;',
    '  var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);',
    '  var range = document.createRange(); var lines = [];',
    '  while (walker.nextNode()) {',
    '    var node = walker.currentNode;',
    '    if (!node.nodeValue || !node.nodeValue.trim()) continue;',
    '    var pe = node.parentElement; if (!pe) continue;',
    '    var cs = getComputedStyle(pe);',
    '    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;',
    '    range.selectNodeContents(node);',
    '    var rs = Array.from(range.getClientRects());',
    '    for (var i = 0; i < rs.length; i++) lines.push({ top: rs[i].top - top0, bottom: rs[i].bottom - top0 });',
    '  }',
    '  var inner = "<div xmlns=\\"http://www.w3.org/1999/xhtml\\" style=\\"width:375px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif\\">" + html + "</div>";',
    '  var svg = "<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"" + (WIDTH * SCALE) + "\\" height=\\"" + (hCss * SCALE) + "\\"><g transform=\\"scale(" + SCALE + ")\\"><foreignObject width=\\"" + WIDTH + "\\" height=\\"" + hCss + "\\">" + inner + "</foreignObject></g></svg>";',
    '  var img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await img.decode();',
    '  var cv = document.createElement("canvas"); cv.width = WIDTH * SCALE; cv.height = Math.round(hCss * SCALE);',
    '  var ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0);',
    '  var empty = 0; var drift = [];',
    '  for (var q = 0; q < lines.length; q++) {',
    '    var t = Math.max(0, Math.round(lines[q].top * SCALE)), b = Math.min(cv.height, Math.round(lines[q].bottom * SCALE));',
    '    var ink = inkInBand(ctx, t, b, cv.width);',
    '    if (ink === 0) empty++;',
    '    if (q % 20 === 0 || q >= lines.length - 3) drift.push({ line: q, top: t, ink: ink, nearest: nearestInk(ctx, t, cv.width, cv.height) });',
    '  }',
    '  var last = lines.length ? Math.round(lines[lines.length - 1].bottom * SCALE) : 0;',
    '  var inkBottom = -1; for (var y = cv.height - 1; y >= 0; y--) { if (inkInRow(ctx, y, cv.width) > 0) { inkBottom = y; break; } }',
    '  document.body.removeChild(host);',
    '  return { lines: lines.length, emptyLineBoxes: empty, hCss: hCss, canvasH: cv.height, measuredBottom: last, inkBottom: inkBottom, drift: drift };',
    '})();',
  ].join('\n'),

  /**
   * 诊断（只观测，待办 T7）：在**真机的渲染环境**里，用**从源码抽出来的产品函数**把
   * "保护区 →（padding+合并）区间 → 切点计划"整条链重算一遍，回答两个问题：
   *   ① 目标点落在哪个（已 padding 的）区间里 → 于是退到哪个 top；
   *   ② 最终每个切点是否落在某个**未 padding 的保护区**内部。
   * 参数由 `extractT7Fns()` 提供（抽不到就根本不会走到这里）。
   */
  t7PlanProbe: [
    'var a = arg || {};',
    'var C = a.consts;',
    // 抽出来的函数体引用了模块级常量 `SCALE` / `PROTECT_PAD_PX` / `MIN_TAIL_PX`，作为形参喂进去
    'var fns = new Function("SCALE", "PROTECT_PAD_PX", "MIN_TAIL_PX", a.code + "\\nreturn { collectProtected: collectProtected, toDeviceRanges: toDeviceRanges, planCuts: planCuts };")' +
      '(C.SCALE, C.PROTECT_PAD_PX, C.MIN_TAIL_PX);',
    'return (async function () {',
    '  var SCALE = C.SCALE, WIDTH = C.WIDTH;',
    '  var host = document.createElement("div");',
    '  host.style.cssText = "position:fixed;left:-20000px;top:0;width:" + WIDTH + "px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;";',
    '  host.innerHTML = "<div style=\\"width:" + WIDTH + "px;box-sizing:border-box\\">" + a.html + "</div>";',
    '  document.body.appendChild(host);',
    '  await Promise.all(Array.prototype.slice.call(host.querySelectorAll("img")).map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }));',
    '  await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });',
    '  var h = Math.ceil(host.getBoundingClientRect().height);',
    '  var canvasPx = h * SCALE;',
    '  var top0 = host.getBoundingClientRect().top;',
    '  var ranges = fns.collectProtected(host, top0, h);',
    '  var merged = fns.toDeviceRanges(ranges, canvasPx);',
    '  var plan = fns.planCuts(canvasPx, merged, C.PAGE_CSS_H * SCALE);',
    '  document.body.removeChild(host);',
    // 未 padding 的保护区（设备像素），用来判"这一刀是否真落在内容上"
    '  var raw = ranges.map(function (r) { return [Math.round(r.top * SCALE), Math.round(r.bottom * SCALE), r.kind]; });',
    '  var hits = [];',
    '  for (var i = 0; i < plan.cutsPx.length; i++) {',
    '    var c = plan.cutsPx[i]; if (c <= 0 || c >= canvasPx) continue;',
    '    for (var j = 0; j < raw.length; j++) { if (raw[j][0] < c && c < raw[j][1]) { hits.push({ cut: c, kind: raw[j][2], top: raw[j][0], bottom: raw[j][1] }); break; } }',
    '  }',
    '  return { hCss: h, canvasPx: canvasPx, rangeCount: ranges.length, mergedCount: merged.length, cuts: plan.cutsPx, oversize: plan.oversize, cutInsideProtected: hits, mergedTail: merged.slice(-4) };',
    '})();',
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

/**
 * 逐页 × 长图逐像素比对（L6）单次可传的上限：长图 + 全部分页要一次性进页面，
 * 超限就**如实记为"未比较"**，不做半截比较、也不冒充通过。
 */
const PIXEL_CMP_MAX_BYTES = 24 * 1024 * 1024

/**
 * 诊断用（待办 T7）：把 `src/lib/htmlToImage.ts` 里真正干活的几个函数**按源码抽取**出来，
 * 剥掉类型后注入页面执行——目的不是"复刻一份逻辑"，而是让**真机的渲染环境**跑**同一份源码**
 * （抽取失败直接抛错；不允许退回自带副本，那正是会悄悄漂移的东西）。
 *
 * 为什么要这样：T7 的切点在应用外面**复现不出来**（字体度量不同 ⇒ 切点全变），
 * 所以只能在应用里、用产品自己的函数把"保护区 → 区间 → 切点"这条链重算一遍。
 */
function extractT7Fns() {
  const file = join(dirname(here), 'src', 'lib', 'htmlToImage.ts')
  const src = readFileSync(file, 'utf8')
  const names = ['isInvisible', 'transparentColor', 'hasVisibleBorder', 'collectProtected', 'toDeviceRanges', 'planCuts']
  const parts = names.map((n) => {
    const m = new RegExp('function ' + n + '\\([\\s\\S]*?\\n\\}').exec(src)
    if (!m) throw new Error(`在 htmlToImage.ts 里抽不到 ${n}（抽取方式失效，请先修抽取）`)
    return m[0]
  })
  const num = (n) => {
    const m = new RegExp('const ' + n + ' = ([0-9]+)').exec(src)
    if (!m) throw new Error(`抽不到常量 ${n}`)
    return Number(m[1])
  }
  return {
    code: stripTypeScriptTypes(parts.join('\n\n'), { mode: 'strip' }),
    consts: { SCALE: num('SCALE'), WIDTH: num('WIDTH'), PROTECT_PAD_PX: num('PROTECT_PAD_PX'), MIN_TAIL_PX: num('MIN_TAIL_PX'), PAGE_CSS_H: num('PAGE_CSS_H') },
  }
}

// =====================================================================================
// 第 8 节：应用启动 / 收尾（一律走 desktop-harness 的隔离设施）
// =====================================================================================

const HANDLES = [] // 本轮启动过的所有自有进程（每个都有自己的 closed 标记，绝不互相误关）
let ACTIVE = null
// 本轮的上下文（隔离目录 / 密钥 / 预算 / playwright）。提到模块级是为了让 `finalizeAndExit()`
// 也能收尾账本——**所有退出路径**都要落一条账本结论，包括"启动阶段就 BLOCKED"这种早退
// （实测踩过：after openApp 返回 null 时直接 `return`，连 finally 都没进，证据里 `ledgerAfter` 是 null）。
let CTX = null
let LEDGER_FINALIZED = false

function drain(child, sink) {
  if (!child || !child.stdout) return
  child.stdout.on('data', (d) => {
    sink.stdoutBytes += d.length
  })
  child.stderr?.on('data', (d) => {
    sink.stderrBytes += d.length
  })
}

/**
 * 预热隔离 profile（2026-10-02 实测得到的**必需**步骤）。
 *
 * 现象（可复现，非偶发）：WebView2 在**首次**初始化一个全新的 user-data-dir 时，即使
 * `--remote-debugging-port` 确实出现在它的子进程命令行上，端口也不会被监听；用**同一个**目录
 * 再启动一次，约 1 秒就可达。实测：全新目录连跑 25s 无监听；同一目录的第 2、3 次启动各 1s 可达。
 *
 * 这解释了为什么历史上的每一次真机验收都卡在"CDP 无页面"——每一轮都用全新的隔离 profile。
 * 所以真正测量之前先做一次**预热启动**：不驱动界面、不派发任何请求、只等 profile 落盘后按身份关掉。
 */
async function warmUpProfile(ctx) {
  const marker = join(ctx.iso.webview, 'EBWebView', 'Local State')
  if (existsSync(marker)) return { skipped: true, marker }
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
  const identity = procIdentity(launch.pid, exe)
  const mine = { pid: launch.pid, closed: false, sink, rec: null, identity }
  HANDLES.push(mine)
  const t0 = Date.now()
  while (Date.now() - t0 < 45000 && !existsSync(marker)) await new Promise((r) => setTimeout(r, 500))
  const markerMs = Date.now() - t0
  // ⚠️ 光等 `Local State` 出现还不够：实测（4 次里 1 次）标记 1.8s 就出现、随后真正那一轮仍然
  // 90s 连不上。等到 25s 再关的对照里，后一次启动 1s 就可达。所以再给一段固定沉降，别一出现就关。
  if (existsSync(marker)) await new Promise((r) => setTimeout(r, 15000))
  const ready = existsSync(marker)
  const closeResult = await closeOwnPid(launch.pid, { exe, expectedIdentity: identity })
  mine.closed = closeResult.closed === true
  const rec = {
    phase,
    at: new Date().toISOString(),
    warmUp: true,
    pid: launch.pid,
    exe,
    exeHash: launch.exeHash,
    cdpPort,
    profile: ctx.iso.profile,
    webview: ctx.iso.webview,
    workspace: ctx.iso.workspace,
    identity,
    profileReady: ready,
    closed: { ...closeResult, at: new Date().toISOString() },
    childOutput: { ...sink },
  }
  mine.rec = rec
  evidence.launches.push(rec)
  log(
    `  [预热] pid=${launch.pid} 首次初始化隔离 profile：${ready ? `已完成（标记 ${markerMs}ms + 沉降 15s，共 ${Date.now() - t0}ms）` : `45s 内未见 ${marker}`}`,
  )
  // 2026-10-08：这里原来是 `fail('launch', ...)`，可它自己的措辞就是"**大概率**不可用"——
  // 一个**概率性**判断被当成硬失败，会把一次全绿的跑分整条判成 ERROR。
  // 实测（BIG run3）：**全部检查通过、0 条 FAIL**，只因预热 45s 内没看到 `Local State` 就报 ERROR，
  // 而**同一轮 CDP 随后正常连上、检查全部跑完、成稿 accepted**。
  // 真正的门禁在下面 `openApp`：CDP 连不上会以**确定**的理由失败或阻塞。这里降级为观测——
  // 如实留痕，但不拿"大概率"当结论去判死一次已经成功的运行。
  if (!ready) {
    observe(
      '隔离 profile 预热超时',
      `预热 45s 内未见 ${marker}（WebView2 首轮初始化的已知行为，不是脚本错）。` +
        `**本轮能否驱动以下面的 CDP 连接结果为准**：连上则不影响结论，连不上则由 openApp 给出确定理由。`,
    )
  }
  if (!mine.closed) fail('cleanup', `预热实例未能关闭（${JSON.stringify(closeResult)}）`)
  return { skipped: false, ready, ms: Date.now() - t0, closeResult }
}

/**
 * 启动应用并连上 CDP。**全新隔离 profile 的首次启动**有概率在 90s 内不开放调试端口
 * （2026-10-02 实测：4 次里 1 次，即使预热已完成标记）——这是 WebView2 首轮初始化的行为，不是脚本错。
 * 所以做**一次有界重试**：关掉、重开、再等一次。重试发生在任何派发之前（零成本），
 * 且只重试一次——真正的启动故障不会被它掩盖。
 */
async function openApp(chromium, ctx) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const app = await openAppOnce(chromium, ctx)
    if (app) return app
    const cdpBlocked = typeof run.blockedReason === 'string' && run.blockedReason.includes('CDP 在')
    if (attempt === 1 && cdpBlocked) {
      observe('启动重试', '第 1 次启动 90s 内没有可用 CDP 页面（全新隔离 profile 的首轮初始化尚未真正完成）——关闭后按有界策略重开一次')
      log('  [重试] 第 1 次 CDP 等待超时，关闭后重开一次')
      run.blockedReason = null
      run.errors = run.errors.filter((e) => !String(e.message).includes('CDP 在'))
      continue
    }
    return null
  }
  return null
}

async function openAppOnce(chromium, ctx) {
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
  // 启动时把**预期身份**固定下来（PID + 映像名 + 完整路径 + 创建时刻），关闭前要用它复核。
  // 少了创建时刻，PID 被回收后"那个数字还活着"就能骗过检查。
  const launchIdentity = procIdentity(launch.pid, exe)
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
    identity: launchIdentity,
  }
  evidence.launches.push(rec)
  const mine = { pid: launch.pid, closed: false, sink, rec, identity: launchIdentity }
  HANDLES.push(mine)
  ACTIVE = mine
  const close = async () => {
    if (mine.closed) return { closed: true, forced: false, alreadyClosed: true }
    // 只关**这一个** PID，且用该进程**自己的** exe 与启动时记下的身份复核；不用 ACTIVE，避免误伤后开的实例。
    // 身份不匹配/查不出来时 closeOwnPid 会**零关闭操作**并回 refused（指南 §0.4 第 4 条）。
    const r = await closeOwnPid(mine.pid, { exe, expectedIdentity: mine.identity })
    // 只有**观测到进程确实消失**才算已关闭（`closed:false` 不能标成关好了）。
    // 原来这里无条件 `mine.closed = true`：关闭失败也会让后续 finally 的 `if (h.closed) continue`
    // 跳过清理，于是同一个隔离 profile 上可能留下一个还活着的实例。
    mine.closed = r.closed === true
    rec.closed = { ...r, at: new Date().toISOString() }
    rec.childOutput = { ...sink }
    if (!mine.closed) fail('cleanup', `自有 PID ${mine.pid} 未能关闭（${JSON.stringify(r)}）——同一 profile 不得再开第二个实例`)
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
  // ⚠️ CDP 端点会**先于页面导航**就绪：目标可能还是 `about:blank`，此时启动核对会因为
  // "页面归属不是 tauri.localhost" 直接 BLOCKED（2026-10-02 真机踩到）。等它导航完成再判。
  const navDeadline = Date.now() + 30000
  while (Date.now() < navDeadline && !pages.some((p) => String(p.url).includes('tauri.localhost'))) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      pages = await waitForCdp(cdpPort, 5000)
    } catch {
      /* 列表暂时读不到：保留上一次结果，继续等 */
    }
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
  // 预算门禁先于探针：探针在装不上门禁时会**拒绝安装**（指南 §0.3）。
  // 这条通道是"宿主函数"，不经过应用的 invoke，所以门禁自己不会触发门禁。
  try {
    await page.exposeFunction('__acceptanceReserve', (cmd, info) => {
      const r = ctx.budget.reserve(cmd)
      if (!r.ok) {
        observe(
          `预算拒绝派发：${cmd}`,
          `${r.reason}${info && info.slotId ? `（slotId=${info.slotId}）` : ''}——该请求**没有**发出`,
        )
      }
      return r
    })
  } catch (e) {
    await close()
    block('budget', `无法把预算门禁暴露给页面（${String((e && e.message) || e)}）——没有门禁就不开测，避免"先发再数"`)
    return null
  }
  const probeInstalled = await pageFn(page, 'installProbe')
  if (!probeInstalled || !probeInstalled.ok) {
    await close()
    block('probe', `无法安装 invoke 探针（交叉核对是硬要求）：${JSON.stringify(probeInstalled)}`)
    return null
  }
  // **覆盖率自证**（指南 §0.0 A）：装好后那条非付费命令必须确实经过我们的 fetch。
  // 没经过 = 协议已经不走自定义协议通道（回退在安装之前就激活了），此后付费命令根本不经过门禁，
  // 页面侧再怎么补也够不着——此时唯一的正确动作是零派发地放弃这一轮。
  if (!gateCoverageProven(probeInstalled)) {
    await close()
    block(
      'probe',
      `IPC 门禁覆盖率未获证明：安装后那条 list_documents 没有经过受控的 window.fetch（coverage=${JSON.stringify(probeInstalled.coverage)}）。` +
        `这通常意味着 tauri 协议已经回退到 window.ipc.postMessage 通道（wry 把它冻成 Object.freeze，拦不住），` +
        `此时付费命令不会经过预算门禁——拒绝开测，本 phase 模型派发为 0。`,
    )
    return null
  }
  evidence.gate = { coverage: probeInstalled.coverage, reused: probeInstalled.reused === true }
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
  // **素材身份**的稳定指纹（L2 "素材保持原样"要比的是这个，不是上面那条会随写法变化的 bindings 指纹）：
  // 按槽位顺序取 素材 id + 该 id 的快照版本与内容哈希。刻意**不含**
  //   · `slotId`（每轮 runId 不同，天然会变）；
  //   · 槽位描述文本与引用写法（模型把 `[[img:wide|描述]]` 改写成等价的 `[[asset:art-wide|id|描述]]`
  //     是**正确**行为——2026-10-02 真机实测：素材 id 与快照都没变，只有引用写法变了，
  //     旧的整条 bindings 比对会把它误判成"素材变了"）。
  const assetIdentity = (meta.bindings || []).map((b) => {
    const s = (meta.snapshots || {})[b.id] || {}
    return `${b.id || ''}@${s.ver != null ? s.ver : ''}:${sha256Text(s.svg || '')}`
  })
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
    assetIdentity,
    assetIdentityHash: sha256Text(assetIdentity.join('\n')),
    snapshotsHash: sha256Text(snaps.join('\n')),
    bindingCount: (meta.bindings || []).length,
    snapshotCount: snaps.length,
    appHtmlHash: appDocValue && appDocValue.html ? sha256Text(appDocValue.html) : null,
    appSourceHash: appDocValue && appDocValue.source ? sha256Text(appDocValue.source) : null,
    // ⚠️ 应用命令回的是 **snake_case**（Rust `DocContent.revision_id`）；前端 TS 层自己做了映射，
    // 本脚本直接调 invoke，必须自己认两种写法——否则 appRevisionId 恒为 null，
    // "应用读回的成品与磁盘当前版本一致"这条会**永远判红**（2026-10-02 真机踩到）。
    appRevisionId: appDocValue ? (appDocValue.revisionId ?? appDocValue.revision_id ?? null) : null,
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
    assetIdentity: view.assetIdentity,
    assetIdentityHash: view.assetIdentityHash,
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
/**
 * "最后成功版本"——**按实际提交顺序**取，不按 L4/L2/L1 的固定优先级猜。
 *
 * 原来写死了 `['L4','L2','L1']`：于是 L4 失败、L2 成功时仍会拿 L4 那一版当基准，
 * 与"保存关停前**最后成功**的那个版本"（指南 §8.4）正好相反。现在看 `latest`
 * （每次成功的写稿 phase 都会更新它）与各条记录的 `at` 时间。
 */
function latestBaseline() {
  const b = loadBaselines()
  const entries = Object.entries(b.byPhase || {}).filter(([, e]) => e)
  if (!entries.length) return null
  const latest = b.latest && b.byPhase[b.latest] ? b.byPhase[b.latest] : null
  if (latest && latest.ok) return latest
  // `latest` 不可用时退回"按时间排在最后的那条 ok 记录"
  const oks = entries.filter(([, e]) => e.ok).sort((x, y) => String(x[1].at || '').localeCompare(String(y[1].at || '')))
  if (oks.length) return oks[oks.length - 1][1]
  // 一条 ok 都没有 → **没有**"最后成功版本"。
  // 原来这里会返回时间上最后一条（哪怕它 ok=false），于是 L5/L6 拿着一个失败版当基准去比对，
  // 只要字段齐备就"通过"——等于导出/重开一个从未验收的失败稿还宣称验收成功（指南 §0.4 第 5 条）。
  // 如实返回 null，由调用方 BLOCKED。
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
  // 每一回合开始前**重新确认探针在位**（installProbe 幂等）。
  // 踩过的坑（2026-10-02 真机）：`T.invoke` 原来用普通赋值替换，而它是不可写属性 → 静默失败，
  // 回合里读到 0 次派发、账本漏记 4 次真实请求。现在 installProbe 会当场核对替换是否生效；
  // 这里再兜一层：装不上就不发消息（不花钱），也不能把"探针不在"读成"没有派发"。
  const ensured = await pageFn(page, 'installProbe')
  if (!ensured || !ensured.ok || !gateCoverageProven(ensured)) {
    fail(
      'probe',
      `回合开始前探针/门禁不可用：${JSON.stringify(ensured)}——拒绝在无预算门禁的状态下发送消息`,
    )
    const abortedTurn = {
      phase,
      prompt: text,
      started: false,
      ended: 'no-probe',
      probeInstalled: false,
      probeError: ensured && ensured.reason,
      stages: [],
      refusals: [],
      seconds: 0,
      dispatchAfter: 0,
      genSvgAfter: 0,
      transportAfter: 0,
      transportDrawAfter: 0,
      uiErrors: [],
      saveErrors: [],
      notices: [],
    }
    evidence.turns.push(abortedTurn)
    return abortedTurn
  }
  const before = await pageFn(page, 'readRun')
  const turn = {
    phase,
    prompt: text,
    startedAt: new Date().toISOString(),
    t0,
    /** 回合开始/结束时探针都在位，计数才可信（缺了就把"看不见"当成"零派发"了） */
    probeInstalled: before.probeInstalled !== false,
    msgsBefore: before.msgs,
    dispatchBefore: before.dispatch,
    genSvgBefore: before.genSvg,
    transportBefore: before.transport || 0,
    transportDrawBefore: before.transportDraw || 0,
    refusalsBefore: before.refused || 0,
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
    // 门禁**在回合中途**掉链子：拦截函数被换掉，或协议已经切到 postMessage 通道。
    // 这两种情况下"页面探针传输计数"已经不再是真实传输——继续跑下去只会拿到一份假的预算核对。
    if (s.gateLive === false || s.fallbackLatched === true) {
      turn.aborted =
        s.gateLive === false
          ? '门禁身份在回合中途失效：window.fetch 已不是受控函数——本回合之后的传输不可信'
          : `协议回退已激活（${String(s.fallbackReason || '未知')}）——付费请求已改走未受门禁覆盖的通道`
      turn.gateBroken = { gateLive: s.gateLive, fallbackLatched: s.fallbackLatched }
      fail('probe', `回合中途门禁失效：${turn.aborted}——停止本回合，本轮结果不可按"预算已受控"签收`)
      await clickStop(page)
      await page.waitForTimeout(2500)
      break
    }
    // 预算已经在**派发前**扣过了（`budget.reserve`），所以这里不该再看到"超了"。
    // 真看到就说明门禁被绕过——不是"按预算规则中止"这种温和处置，而是硬失败：
    // 钱已经花出去了，不能只记一句"已中止"。
    if (s.dispatch - before.dispatch > plan.maxDispatches || s.genSvg - before.genSvg > plan.maxGenSvg) {
      turn.aborted = `派发前预算门禁被绕过：本回合放行 ${s.dispatch - before.dispatch} 次（中止线 ${plan.maxDispatches}）、绘图 ${s.genSvg - before.genSvg} 次（中止线 ${plan.maxGenSvg}）`
      fail('budget', turn.aborted)
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
  turn.transportAfter = (after.transport || 0) - (before.transport || 0)
  // 绘图**单独**计一份：原来把总传输量当绘图传输量传进核对，于是"2 次普通请求、0 次绘图"
  // 的 L2 回合会报绘图口径不一致（假红），而 L1/L4 混合请求又可能被掩盖（指南 §0.0 R3）。
  turn.transportDrawAfter = (after.transportDraw || 0) - (before.transportDraw || 0)
  turn.probeInstalled = turn.probeInstalled && after.probeInstalled === true
  // 被门禁拒掉的派发明细（它们**没有**发出去）：不只看条数，还要能说清是哪条命令、什么理由
  turn.refusals = await page.evaluate((n) => {
    const p = window.__acceptanceProbe || { refused: [] }
    return (p.refused || []).slice(n).map((x) => ({ cmd: x.cmd, slotId: x.slotId || null, reason: x.reason }))
  }, before.refused || 0)
  turn.seconds = Math.round((Date.now() - t0) / 1000)
  turn.uiErrors = turn.uiErrors || []
  turn.saveErrors = turn.saveErrors || []
  turn.notices = turn.notices || []
  return turn
}

/**
 * 回合结束后**稍等一拍**再读 trace。
 *
 * 为什么要等：Rust 侧 JSONL 的落盘时刻与"界面回到空闲"不是同一个时刻，立刻读有概率少读最后几条，
 * 而"trace 比预留少"在本轮是**硬判据**（少记 = 费用无法核对）。所以给一个固定的一拍；
 * 它**不是**"轮询到变绿"——等完就读一次，少记仍然判失败（只是不再被落盘延迟误伤）。
 */
async function tracesAfterTurn(page, ws, t0) {
  await page.waitForTimeout(800)
  return readTraceRecords(ws, t0)
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

// 事实判定已抽到 `scripts/lib/fact-assert.mjs`：那套逻辑原来长在这个**要连真机、要花真钱**的脚本里，
// 离线回归根本够不着它，所以它自己的四个缺陷（无数字边界、错误年份/星期、逗号假红、无否定检查）
// 一直没被发现。抽出去之后由 `scripts/fact-assert-check.mjs` 用固定反例钉住。
const idTag = () => `${phase}：`

// =====================================================================================
// 第 14 节：各 phase
// =====================================================================================

function phaseContext() {
  const iso = prepareIsolation(`live-${phase}`, root)
  evidence.isolation = { root: iso.root, profile: iso.profile, webview: iso.webview, evidence: iso.evidence, workspace: iso.workspace, realWorkspace: realWorkspaceDir() }
  return iso
}

/**
 * 启动核对（指南 §8.2 第 3 条 / §0.4 第 1 条）。
 *
 * **这里是门禁，不是体检报告。** 原来它把每条检查都写成 `check(...)` 之后照样返回对象，
 * 于是"隔离目录、PID、页面归属、空数据"四项全红，`runL1()` 也只会看一眼返回值就开始发消息——
 * 用真钱测一个本来就不该开跑的实例。
 *
 * 现在的口径：所有前置项先收集，**任何一条不过就地 `block()` 并返回 null**；
 * 调用方拿到 null 必须直接返回，本 phase 的发送/导出次数为 0。
 *
 * 另外，"隔离生效"不再靠**比字符串**：`workspace` 变量不等于真实路径，只说明"我传了一个别的字符串"。
 * 这里改为查**应用实际写出来的东西**——隔离 workspace 下真的建出了 `sessions/`、WebView2 数据目录
 * 里真的有内容，再加上应用自己的读路径（list_sessions / list_documents）回读一致。
 */
async function verifyLaunch(app, ctx, { expectEmpty }) {
  const gates = []
  const gate = (id, ok, ev) => {
    gates.push({ id, ok: Boolean(ok), ev })
    return Boolean(ok)
  }

  const ident = procIdentity(app.launch.pid, exe)
  gate(`${idTag()}启动核对：本轮自有 PID 存活`, ident.alive, `pid=${app.launch.pid}`)
  gate(
    `${idTag()}启动核对：进程身份与本轮 exe 一致（不是被回收后复用的 PID）`,
    ident.matchesExpected === true,
    JSON.stringify(ident),
  )
  gate(`${idTag()}启动核对：exe 哈希已记录`, /^[0-9a-f]{64}$/.test(app.launch.exeHash), `exeHash=${app.launch.exeHash.slice(0, 16)}…`)
  // 身份字段齐备才**关得干净**（指南 §0.0 B）：路径或创建时刻读不到时，关闭前的核验只能是
  // "只知道映像名"，那种情况下 closeOwnPid 会按零关闭操作拒绝——于是本轮会留下一个活着的实例。
  // 所以在派发之前就拦下：宁可这一轮不跑，也不留下一个既花了钱又收不掉的进程。
  gate(
    `${idTag()}启动核对：进程身份字段齐备（PID/完整路径/创建时刻都读得到，否则无法安全关闭）`,
    ident.identityComplete === true,
    `complete=${ident.identityComplete} missing=${JSON.stringify(ident.missingFields || [])} probe=${JSON.stringify(ident.probe)}`,
  )

  const pages = app.rec.cdpPages || []
  gate(
    `${idTag()}启动核对：CDP 端口为本轮新分配且有我们自己的页面`,
    pages.some((p) => p.hasDebugger) && pages.some((p) => String(p.url).includes('tauri.localhost')),
    `port=${app.cdpPort}；pages=${JSON.stringify(pages).slice(0, 240)}`,
  )
  let pageUrl = ''
  try {
    pageUrl = app.page.url()
  } catch {
    pageUrl = '(读不到)'
  }
  gate(`${idTag()}启动核对：CDP 目标页面的归属是本应用（tauri.localhost）`, pageUrl.includes('tauri.localhost'), `pageUrl=${pageUrl}`)

  // 隔离的**实证**：应用到我们指定的目录里真的写东西了
  const wsExists = existsSync(ctx.iso.workspace)
  const wsEntries = wsExists ? readdirSync(ctx.iso.workspace) : []
  gate(
    `${idTag()}隔离：应用确实在隔离目录下建出了工作区（不是只换了个字符串）`,
    wsExists && wsEntries.length > 0,
    `workspace=${ctx.iso.workspace}；条目=${JSON.stringify(wsEntries.slice(0, 8))}`,
  )
  const wvExists = existsSync(ctx.iso.webview)
  const wvEntries = wvExists ? readdirSync(ctx.iso.webview) : []
  gate(
    `${idTag()}隔离：WebView2 数据目录被本实例实际使用（有落盘内容）`,
    wvExists && wvEntries.length > 0,
    `webview=${ctx.iso.webview}；条目数=${wvEntries.length}`,
  )
  const wsResolved = resolve(ctx.iso.workspace).toLowerCase()
  const realResolved = resolve(realWorkspaceDir()).toLowerCase()
  gate(
    `${idTag()}隔离：子进程 workspace 指向隔离目录、与真实工作区不同`,
    wsResolved !== realResolved && !wsResolved.startsWith(realResolved) && !realResolved.startsWith(wsResolved),
    `workspace=${ctx.iso.workspace}`,
  )

  const sessions = await appSessions(app.page)
  const docs = await appDocs(app.page)
  gate(
    `${idTag()}启动核对：生产读路径可用（会话/文稿都读得出来）`,
    sessions.ok && docs.ok,
    `sessions=${JSON.stringify(sessions).slice(0, 160)} docs=${JSON.stringify(docs).slice(0, 160)}`,
  )

  const cur = sessions.ok ? sessions.value.current : null
  const docCount = docs.ok ? (docs.value.items || []).length : -1
  evidence.launchReadbacks = evidence.launchReadbacks || []
  evidence.launchReadbacks.push({
    at: new Date().toISOString(),
    pid: app.launch.pid,
    pageUrl,
    identity: ident,
    sessions: sessions.ok ? sessions.value : null,
    docs: docs.ok ? docs.value : null,
  })
  if (expectEmpty) {
    const msgs = cur && sessions.ok ? ((await appSession(app.page, cur)).value?.messages?.length ?? -1) : -1
    gate(
      `${idTag()}启动核对：全新隔离工作区（空会话 / 空文稿）`,
      docCount === 0 && msgs === 0 && (sessions.ok ? (sessions.value.items || []).length : 99) <= 1,
      `会话数=${sessions.ok ? (sessions.value.items || []).length : '?'} 当前会话消息数=${msgs} 文稿数=${docCount}`,
    )
    if (cur) evidence.launchReadbacks[evidence.launchReadbacks.length - 1].currentSessionMessages = msgs
  } else {
    gate(
      `${idTag()}启动核对：接着隔离目录里已有的会话与文稿`,
      (sessions.ok ? (sessions.value.items || []).length : 0) >= 1 && docCount >= 1,
      `会话数=${sessions.ok ? (sessions.value.items || []).length : '?'} 当前会话=${cur} 文稿数=${docCount}`,
    )
  }

  for (const g of gates) check(g.id, g.ok, g.ev)
  const bad = gates.filter((g) => !g.ok)
  if (bad.length) {
    block(
      'launch',
      `启动核对未通过 ${bad.length} 项：${bad.map((b) => b.id.replace(idTag(), '')).join('；')}` +
        `——**拒绝继续**，本 phase 的模型派发与导出次数均为 0`,
    )
    return null
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

/**
 * 派发后的交叉核对。
 *
 * 口径变了（指南 §0.3）：预算在**派发前**就已经扣掉并落盘了（`budget.reserve`），
 * 这里不再"事后累加"，而是做三件事的**核对**：
 *   ① 预留了几次 ↔ WebView 侧放行了几次（探针只在预留成功后才算数，二者应当相等）；
 *   ② 预留了几次 ↔ trace 里真实请求了几条（应当相等；trace 更多 = 有派发绕过了门禁）；
 *   ③ trace 本身可不可观测（`note`/`observable`）——不可观测就如实 UNKNOWN，不按 0 请求记账。
 */
function reconcile(budget, turn, traceInfo, plan) {
  const requests = traceInfo.observable ? traceInfo.requests : []
  const dispatched = requests.length
  const genSvgDispatched = requests.filter((r) => r.phase === 'gen_svg').length
  const reserved = turn.dispatchAfter
  const reservedGenSvg = turn.genSvgAfter
  const refusals = (turn.refusals || []).length

  const traceObservable = traceInfo.observable === true
  // 判定走抽出去的纯函数（`scripts/live-driver-check.mjs` 测的就是它，不是这里的副本）
  const cmp = compareDispatchEvidence({
    reserved,
    reservedGenSvg,
    transport: turn.transportAfter,
    // ⚠️ 这里**必须**是绘图专属的传输计数：原来传的是总 `turn.transportAfter`，
    // 于是 L2（2 次普通请求、0 次绘图）会被判成"绘图传输不一致"（假红），
    // L1/L4 的混合请求则可能被总数掩盖。`transportDraw` 由页面探针按预留返回的 kind 单独计数。
    genSvgTransport: turn.transportDrawAfter,
    traceRequests: dispatched,
    traceGenSvg: genSvgDispatched,
    traceObservable,
  })
  const byCode = (c) => cmp.problems.find((p) => p.code === c) || null
  // 探针不在位时，"页面实际传输 0 次"是**没看见**而不是**没发生**——不能拿它去核对预算
  const probeMissing = turn.probeInstalled !== true
  // ── 绘制并发峰值（2026-10-08，用户指令"限额设为 20 然后测试"）─────────────────────────────
  // 并发上限到底有没有生效，**不看配置常量**：从 trace 里每条 gen_svg 请求的 [startedAt, startedAt+ms)
  // 区间做扫描线，算"实际同时在飞"的峰值。旧上限 2 下这篇会呈现 5 波、峰值 2；新上限下应当接近素材位数。
  const genIntervals = requests
    .filter((r) => r.phase === 'gen_svg' && Number.isFinite(r.startedAt) && Number.isFinite(r.ms) && r.ms > 0)
    .map((r) => [r.startedAt, r.startedAt + r.ms])
  let peakDrawConc = 0
  if (genIntervals.length) {
    const evs = []
    for (const [s, e] of genIntervals) {
      evs.push([s, 1])
      evs.push([e, -1])
    }
    // 同一时刻先减后加：相邻首尾相接不算重叠，避免把顺序执行误算成并发
    evs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    let live = 0
    for (const [, d] of evs) {
      live += d
      if (live > peakDrawConc) peakDrawConc = live
    }
  }
  observe(
    `${idTag()}绘制并发峰值（实测）`,
    genIntervals.length
      ? `从 ${genIntervals.length} 条 gen_svg 请求的区间扫描得出**真实并发峰值 = ${peakDrawConc}**（不是配置常量）。`
      : `本轮无可算区间的 gen_svg 请求（绘图 ${genSvgDispatched} 条），并发峰值记 UNKNOWN，不按 0 记账。`,
  )
  const needConc = plan && Number.isFinite(plan.minObservedConcurrency) ? plan.minObservedConcurrency : 0
  if (needConc > 0) {
    if (genIntervals.length >= needConc) {
      check(
        `${idTag()}绘制并发放开生效（trace 实测峰值 ≥ ${needConc}，不是一波 2 个的串行）`,
        peakDrawConc >= needConc,
        `真实峰值=${peakDrawConc}（要求 ≥${needConc}）；绘图请求 ${genIntervals.length} 条`,
      )
    } else {
      observe(
        `${idTag()}绘制并发峰值无法判定`,
        `绘图请求只有 ${genIntervals.length} 条（要求 ≥${needConc} 才够判定），本项记 UNKNOWN——**不**据此说并发已放开或未放开。`,
      )
    }
  }
  check(
    `${idTag()}页面探针在回合期间在位（"实际传输 0 次"必须是观测结果，不是探针丢了的假象）`,
    !probeMissing,
    `probeInstalled=${turn.probeInstalled}`,
  )
  if (probeMissing) {
    fail('probe', `本回合页面探针不在位：预算无法与本回合的事件核对（trace 记到 ${dispatched} 次真实请求）——不按"零派发"记账`)
  }
  const unobservable = byCode('unobservable')
  check(
    `${idTag()}证据可观测性：trace 目录可读且本轮请求证据完整`,
    !unobservable,
    traceObservable
      ? `${traceInfo.files.length} 个 trace 文件可读`
      : traceInfo.dirExists
        ? `无法观察：${traceInfo.note}`
        : `traces 目录不存在（本轮门禁放行 ${reserved} 次）`,
  )
  if (unobservable) {
    // 不能把"看不见"当成"没有请求"：账本与请求证据缺失时如实 UNKNOWN，不报 0 费用（指南 §0.3 末条）
    fail('trace', `${unobservable.message}`)
  }
  check(
    `${idTag()}交叉核对：门禁放行次数与 WebView 侧实际传输一致（总数与绘分数分开核）`,
    !byCode('transportMismatch'),
    `门禁放行 ${reserved}（绘图 ${reservedGenSvg}）；页面探针实际传输 ${turn.transportAfter} 次（其中绘图 ${turn.transportDrawAfter} 次）`,
  )
  const bypass = byCode('bypass')
  check(
    `${idTag()}交叉核对：trace 真实请求数不多于门禁放行数（没有绕过预算的派发）`,
    !bypass,
    `traces 请求=${traceObservable ? dispatched : 'UNKNOWN'}（绘图 ${traceObservable ? genSvgDispatched : 'UNKNOWN'}）；门禁放行=${reserved}（绘图 ${reservedGenSvg}）`,
  )
  if (bypass) fail('reconcile', `${bypass.message}（本模块的付费命令覆盖清单需要补）`)
  // 少记与类别不符同样是缺口：trace 比门禁**少**说明有派发没留下请求证据（费用只能记 UNKNOWN），
  // 绘图类别的 trace 与预留不一致说明"绘图预算绕过"的证据没被核对（指南 §0.0 R3）。
  const missing = byCode('missing')
  check(
    `${idTag()}交叉核对：trace 请求证据没有少记（可观察时 trace 条数 = 门禁放行数）`,
    !missing,
    traceObservable ? `trace=${dispatched}，门禁放行=${reserved}` : 'trace 不可观察：本轮记 UNKNOWN，不按"恰好相等"通过',
  )
  if (missing) fail('trace', `${missing.message}——本轮费用只能记 UNKNOWN`)
  const genGap = byCode('genSvgMismatch')
  check(
    `${idTag()}交叉核对：绘图类别的 trace 与绘图预留一致（绘图预算绕不过去）`,
    !genGap,
    traceObservable ? `trace 绘图=${genSvgDispatched}，门禁放行绘图=${reservedGenSvg}` : 'trace 不可观察：绘图计数记 UNKNOWN',
  )
  if (genGap) fail('reconcile', `${genGap.message}`)
  if (refusals > 0) {
    observe(
      `${idTag()}预算拒绝`,
      `本回合有 ${refusals} 次派发被门禁拒绝（额度用尽或落盘失败）：${clip(JSON.stringify(turn.refusals).slice(0, 400), 400)}`,
    )
  }
  // 记账：额度已在 reserve 时扣过，这里**只记一条 phase 记录**，不再加减。
  // 返回值必须检查：记录没落盘 = 证据里没有这一回合，必须让本次运行明确失败（指南 §0.0 R2）。
  const rec = budget.recordPhase({
    dispatches: reserved,
    genSvg: reservedGenSvg,
    note: `${phase} 回合：${turn.ended}${turn.aborted ? '（' + turn.aborted + '）' : ''}`,
    extra: {
      phase,
      traceRequests: traceObservable ? dispatched : null,
      traceObservable,
      refusals,
    },
  })
  if (!rec.ok) fail('budget', `回合账本记录没有落盘（${rec.reason}）——证据链缺这一回合，本次运行不能算通过`)
  return {
    dispatched: traceObservable ? dispatched : null,
    genSvgDispatched: traceObservable ? genSvgDispatched : null,
    attempts: reserved,
    genSvgAttempts: reservedGenSvg,
    transport: turn.transportAfter,
    countedDispatches: cmp.countedDispatches,
    countedGenSvg: cmp.countedGenSvg,
    traceObservable,
    dispatchProblems: cmp.problems,
    refusals,
    phases: requests.map((r) => r.phase),
    requests: summarizeRequests(requests),
    traceFiles: traceInfo.files,
    remainingAfter: budget.remaining(),
  }
}

// ---------- L1 ----------

/**
 * 「本回合是第一篇」的共通流程：L1（短通知，≤180 字）与 L7（长文，800–1200 字）走同一段代码，
 * 差别只有**题面键**与**字数口径**。共用是有意的——两条路若各写一份，"长文"那条就绕过了
 * 素材位/事实/质量条/哈希自洽这些已经在 L1 上验过的断言，等于开了个更弱的口子。
 *
 * @param promptKey PROMPTS 的键（同时也是证据文件名前缀）
 * @param opts.wordLimit 字数上限（factChecks 的同一口径：正文可见文字去空白）
 * @param opts.minWords  字数下限（短通知不设；长文设 800）
 */
async function runFirstPhase(ctx, app, plan, promptKey, opts = {}) {
  const wordLimit = opts.wordLimit || 180
  const minWords = opts.minWords || null
  // 题面**自己写了**字数上限的 phase 才传（见下面那条断言处的说明）；默认不核上限
  const maxWords = opts.maxWords || null
  // 素材位数：L1/L7 的题面要求"恰好一张开篇横图"；F1 的 G2a/G3 题面**没有**配图要求，
  // 不能拿 L1 的口径去判它们（`null` = 跳过这两条）。默认仍是 1，L1/L7 行为不变。
  const expectAssets = opts.expectAssets === undefined ? 1 : opts.expectAssets
  const grounding = opts.grounding || null
  const launchRead = await verifyLaunch(app, ctx, { expectEmpty: true })
  if (!launchRead) return

  const realBefore = hashInventory(realWorkspaceDir())
  await gotoChat(app.page)
  const t0 = Date.now()
  const turn = await sendTurn(app.page, PROMPTS[promptKey], plan)
  const traceInfo = await tracesAfterTurn(app.page, ctx.iso.workspace, t0)
  const recon = reconcile(ctx.budget, turn, traceInfo, plan)
  log(`  [回合] ${turn.ended}，用时 ${turn.seconds}s，阶段=${turn.stages.join('→')}，派发=${recon.countedDispatches}（绘图 ${recon.countedGenSvg}）`)

  const docId = launchRead.cur
  await waitDocReady(app.page)
  const state = await snapshot(app.page, ctx.iso.workspace, docId, plan.title || '')
  const srcTitle = firstSourceTitle(state.disk.ok ? state.disk.source : '')
  state.srcTitle = srcTitle
  evidence.turns[evidence.turns.length - 1].snapshot = slimState(state)
  writeJsonEvidence(join(evidenceDir, `${promptKey}-state.json`), { turn, recon, state: slimState(state) }, `${promptKey}-state.json`)
  writeCommittedArtifacts(`${promptKey}-committed`, state.disk)
  realWorkspaceObserve(realBefore, `${promptKey} 前后`)

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
  const binds = state.disk.ok ? state.disk.meta.bindings || [] : []
  if (expectAssets !== null) {
    check(
      `${idTag()}恰好一个素材位真正落位（预览内联图片 1 张、版本 bindings 1 条）`,
      state.ui.images.length === 1 && state.disk.ok && (state.disk.meta.bindings || []).length === 1,
      `预览图片=${state.ui.images.length} 张；bindings=${state.disk.ok ? JSON.stringify((state.disk.meta.bindings || []).map((b) => b.slot)) : '(不可读)'}`,
    )
    check(
      `${idTag()}素材位是开篇横图，不是照片位/角饰/分割线等额外素材`,
      binds.length > 0 && binds.every((b) => !/photo|frame|deco|divider|heading/i.test(String(b.slot))),
      `slots=${JSON.stringify(binds.map((b) => b.slot))}`,
    )
  }
  check(
    `${idTag()}成品 HTML 无外链资源（离线可渲染）`,
    state.disk.ok && !/src\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(state.disk.html),
    `html 长度=${state.disk.ok ? state.disk.html.length : -1}`,
  )
  // 固定事实核对：只有"与 L1/L7 同一组固定事实"的题面才走 factChecks。
  // F1 的 G2a/G3 是另外的材料，套 L1 的事实断言必然假红，所以传 `facts:'l1'` 才走这条。
  if (!grounding || grounding.facts === 'l1') {
    for (const c of factChecks(state.ui.article, srcTitle, { expectTitle: plan.title, limit180: wordLimit, tag: idTag() })) check(c.id, c.pass, c.evidence)
  }
  // F1 内容判定：给定事实保留 / 未给依据的规则不得补写（读的是成品正文，不是产品侧的阻断）
  if (grounding) {
    const body = norm(state.ui.article ? state.ui.article.bodyText : '')
    for (const [label, needle] of grounding.required || []) {
      check(`${idTag()}材料给的信息被保住：${label}`, body.includes(norm(needle)), `查「${needle}」，读数 ${body.length} 字`)
    }
    // forbidden 条目两种形态（2026-10-08 T4）：
    //   `[标签, 子串]`       → 裸子串匹配（"这个词出现就不对"）
    //   `[标签, 说明, 'quota']` → 交给 `inventedQuotaHits`：只拦**给未定项安上数字**的写法
    // 为什么需要第二种：G2A 写的是「会在费用、**名额确定后**一并向大家说明」——恰好说明它没编，
    // 却被裸子串判红。判据要拦的是**编造数量**这个缺陷形态，不是某个词的出现。
    for (const [label, needle, kind] of grounding.forbidden || []) {
      let hit = false
      let shown = needle
      if (kind === 'quota') {
        const hits = inventedQuotaHits(body)
        hit = hits.length > 0
        shown = hit ? hits.join(' / ') : '数字 × 名额/人数 的写法'
      } else {
        hit = body.includes(norm(needle))
      }
      check(`${idTag()}没有补写材料未给的规则：${label}`, !hit, hit ? `正文里出现了「${shown}」` : `未出现「${shown}」`)
    }
  }
  if (minWords) {
    const chars = norm(state.ui.article ? state.ui.article.bodyText : '').length
    check(`${idTag()}正文不少于 ${minWords} 字（长文口径）`, chars >= minWords, `实际 ${chars} 字`)
  }
  // 题面自己写了**上限**的，才核上限（2026-10-08 R8）。
  // 为什么单独一个 `maxWords` 而不是复用 `wordLimit`：`wordLimit` 在**带 grounding 的题面**上根本走不到
  // ——factChecks 那一支被 `grounding.facts !== 'l1'` 跳过，`limit180` 也就没人看。于是 BIG 题面写的
  // "1500–2500 字"里**上限从来没被核过**：模型写 4000 字也照样 PASS。
  // 而 G2A/G3 的 `wordLimit: 1200` 是**驱动自己的默认值**、题面根本没提字数——拿它当上限会造出假红
  // （与 T4 同类）。所以：**只有题面明确写了上限的 phase 才传 maxWords**。
  if (maxWords) {
    const chars = norm(state.ui.article ? state.ui.article.bodyText : '').length
    check(`${idTag()}正文不超过 ${maxWords} 字（题面给的上限）`, chars <= maxWords, `实际 ${chars} 字`)
  }
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

async function runWritePhase(ctx, app, kind, plan, opts = {}) {
  // 字数口径随题面走：L2 是"≤180 字"的短通知，L8 是"300–500 字"的收缩稿。
  // 写死 180 会把一条**按题面完全正确**的收缩稿判红（2026-10-02 实测踩到：L8 交 399 字被判超限，
  // 模型是照题面写的，红的是驱动这边的口径）。
  // `null` = **本题面没有字数要求**（F1 的 G2b"只改标题"正文必须原样保留，套 180 会假红）——
  // 所以判据是"传没传"，不是 `||`（`||` 会把显式的 null 也变成 180，同一个坑再踩一次）。
  const wordLimit = opts.wordLimit === undefined ? 180 : opts.wordLimit
  const prev = latestBaseline()
  if (!prev) {
    block('baseline', `找不到可比较的上一版基准（baselines.json 里没有任何"检查全过"的成功版本）——请先用同一个 --root 跑 L1`)
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
  const traceInfo = await tracesAfterTurn(app.page, ctx.iso.workspace, t0)
  const recon = reconcile(ctx.budget, turn, traceInfo, plan)
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
  // 「本轮提交了新版本」要跟**本回合开始前**的状态比，而不是跟"最后一个全过相位"的基准比：
  // 一次失败的重试也会提交版本，拿旧基准比会得出 "generation +2" 这种假红（2026-10-02 真机踩到）。
  check(
    `${idTag()}本轮提交了新 revision（revisionId / generation / runId 相对**本回合开始前**都前进）`,
    after.disk.ok &&
      before.disk.ok &&
      after.disk.revisionId !== before.disk.revisionId &&
      after.disk.generation > before.disk.generation &&
      !!after.disk.meta.run_id &&
      after.disk.meta.run_id !== (before.disk.meta && before.disk.meta.run_id),
    `revisionId ${before.disk.ok ? before.disk.revisionId : '-'} → ${after.disk.ok ? after.disk.revisionId : '-'}；generation ${before.disk.ok ? before.disk.generation : '-'} → ${after.disk.ok ? after.disk.generation : '-'}；runId ${before.disk.ok && before.disk.meta ? before.disk.meta.run_id : '-'} → ${after.disk.ok ? after.disk.meta.run_id : '-'}`,
  )
  check(
    `${idTag()}本轮 generation 恰好 +1（没有偷偷多提交一版）`,
    after.disk.ok && before.disk.ok && after.disk.generation === before.disk.generation + 1,
    `${before.disk.ok ? before.disk.generation : '-'} → ${after.disk.ok ? after.disk.generation : '-'}`,
  )

  // ⚠️ 下面三条是 **L2 专属**语义（"只改文字"才要求标题/正文/源文都变）。
  // L4 的要求正好相反（"标题和全部正文保持原样"），套在 L4 上必然假红——
  // 2026-10-02 真机链路上 L4 明明红着这几条、产品却完全正确（新画已派发、素材内容确实不同、文本逐字未变）。
  // F1 的 G2b（只改标题）：与 L2/L8 **正好相反**——正文必须**逐字保持**，只有标题变。
  // 两条路的断言不能共用（共用必然假红，2026-10-02 在 L4 上踩过同类）。
  if (kind === 'G2B') {
    const sansHeading = (a) => {
      if (!a) return null
      const t = norm(a.bodyText)
      const h = norm(a.firstHeadingText)
      return h && t.includes(h) ? t.replace(h, '') : t
    }
    check(
      `${idTag()}预览标题节点确实变化且等于新标题`,
      norm(after.ui.article ? after.ui.article.firstHeadingText : '').includes(norm(plan.title)) &&
        after.ui.article &&
        after.ui.article.titleNodeMatched &&
        norm(after.ui.article.firstHeadingText) !== norm(before.ui.article ? before.ui.article.firstHeadingText : ''),
      `标题节点「${clip(before.ui.article ? before.ui.article.firstHeadingText : '', 40)}」→「${clip(after.ui.article ? after.ui.article.firstHeadingText : '', 40)}」`,
    )
    check(
      `${idTag()}源文标题行也变了（不是只改了预览）`,
      norm(srcTitle).includes(norm(plan.title)) &&
        norm(srcTitle) !== norm(before.disk.ok ? firstSourceTitle(before.disk.source) : ''),
      `源文标题行=「${clip(srcTitle, 60)}」`,
    )
    check(
      `${idTag()}正文逐字保持（去掉标题节点后与改前一致——"保留原文"不等于"认证原文事实"）`,
      sansHeading(before.ui.article) !== null && sansHeading(after.ui.article) === sansHeading(before.ui.article),
      `${before.ui.article ? before.ui.article.bodyChars : -1} 字 → ${after.ui.article ? after.ui.article.bodyChars : -1} 字`,
    )
  }

  if (kind === 'L2' || kind === 'L8') {
    check(
      `${idTag()}预览标题节点确实变化且等于新标题`,
      norm(after.ui.article ? after.ui.article.firstHeadingText : '').includes(norm(plan.title)) &&
        after.ui.article &&
        after.ui.article.titleNodeMatched &&
        norm(after.ui.article.firstHeadingText) !== norm(before.ui.article ? before.ui.article.firstHeadingText : ''),
      `标题节点「${clip(before.ui.article ? before.ui.article.firstHeadingText : '', 40)}」→「${clip(after.ui.article ? after.ui.article.firstHeadingText : '', 40)}」`,
    )
    check(
      `${idTag()}正文确实变化（可见文字与本回合开始前不同）`,
      after.ui.article && before.ui.article && after.ui.article.counted !== before.ui.article.counted,
      `本回合前 ${before.ui.article ? before.ui.article.bodyChars : -1} 字 → 现在 ${after.ui.article ? after.ui.article.bodyChars : -1} 字`,
    )
    check(
      `${idTag()}源文标题行也变了（不是只改了预览）`,
      norm(srcTitle).includes(norm(plan.title)) &&
        norm(srcTitle) !== norm(before.disk.ok ? firstSourceTitle(before.disk.source) : ''),
      `源文标题行=「${clip(srcTitle, 60)}」`,
    )
  }
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

  if (kind === 'L2' || kind === 'L8' || kind === 'G2B') {
    check(
      `${idTag()}gen_svg=0（只改文字，没有重新画图）`,
      recon.countedGenSvg === 0 && recon.phases.every((p) => p !== 'gen_svg'),
      `派发阶段=${JSON.stringify(recon.phases)}；绘图=${recon.countedGenSvg}`,
    )
    check(
      `${idTag()}素材身份不变（同一槽位的素材 id + 快照版本/内容哈希逐项一致）`,
      after.view &&
        after.view.assetIdentityHash === prev.assetIdentityHash &&
        JSON.stringify(after.view.assetIdentity) === JSON.stringify(prev.assetIdentity) &&
        after.view.snapshotsHash === prev.snapshotsHash &&
        after.view.snapshotCount === prev.snapshotCount,
      `assetIdentity ${JSON.stringify(prev.assetIdentity)} → ${JSON.stringify(after.view ? after.view.assetIdentity : null)}；snapshotsHash ${String(prev.snapshotsHash).slice(0, 12)} → ${after.view ? String(after.view.snapshotsHash).slice(0, 12) : '-'}`,
    )
    // 引用写法/slotId 变了不算"素材变了"（模型把 [[img:wide|描述]] 规范成 [[asset:…]] 是正确的），
    // 但变化本身要如实留痕，别让"看起来没变"掩盖了实际发生的改写。
    if (after.view && after.view.bindingsHash !== prev.bindingsHash) {
      observe(
        `${kind} 引用写法变化（非素材变化）`,
        `bindingsHash ${String(prev.bindingsHash).slice(0, 12)} → ${String(after.view.bindingsHash).slice(0, 12)}；` +
          `素材身份 ${JSON.stringify(prev.assetIdentity)} → ${JSON.stringify(after.view.assetIdentity)}。` +
          'slotId 每轮不同、引用可被规范化，这两者变化都不等于换素材。',
      )
    }
    check(
      `${idTag()}素材位数不变（预览 1 张图、bindings 1 条）`,
      after.ui.images.length === prev.images.length && after.ui.images.length === 1 && after.view?.bindingCount === prev.bindingCount,
      `图片 ${prev.images.length} → ${after.ui.images.length}；bindings ${prev.bindingCount} → ${after.view ? after.view.bindingCount : '-'}`,
    )
    for (const c of factChecks(after.ui.article, srcTitle, { expectTitle: plan.title, limit180: wordLimit, tag: idTag() })) check(c.id, c.pass, c.evidence)
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
    block('baseline', '找不到基准（baselines.json 里没有任何"检查全过"的成功版本）——请先用同一个 --root 跑 L1（L2 可选）')
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
  const traceInfo = await tracesAfterTurn(app.page, ctx.iso.workspace, t0)
  const recon = reconcile(ctx.budget, turn, traceInfo, plan)
  const after = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || '')
  // ⚠️ 这里原来写的是 `page.evaluate`，而 `runL3` 里根本没有 `page` 这个标识符——
  // 真实流程会在**已经派发过一轮**之后抛 `page is not defined`（钱花了、回合没核对）。
  const invocationLog = (await app.page.evaluate(() => {
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
    block('baseline', '找不到"关停前最后成功版本"的基准（没有任何检查全过的成功版本）——请先用同一个 --root 跑 L1（L2/L4 可选）')
    return
  }
  check(
    `${idTag()}关停前基准齐备且是**成功版本**（ok=true；revisionId / generation / 源文/HTML/绑定/快照哈希）`,
    prev.ok === true && !!(prev.revisionId && prev.sourceHash && prev.htmlHash && prev.bindingsHash && prev.snapshotsHash),
    `基准 phase=${prev.phase} ok=${prev.ok} revision=${prev.revisionId} generation=${prev.generation}`,
  )
  if (prev.ok !== true) {
    block('baseline', `最后一条基准 ok=${prev.ok}（不是成功版本）——拒绝拿失败稿当"关停前最后成功版本"`)
    return
  }
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
  // "正常退出"只认**走应用自己的关闭路径**（Windows 上即 WM_CLOSE）退出的那一次。
  // 强杀也回 `closed:true`，但它证明不了"重开能读回"——应用根本没机会收尾。
  const reopenGate = canReopenAfterClose(closeA)
  check(`${idTag()}PID-A 走应用自身退出路径正常关闭（未被强杀）`, reopenGate.ok, `${JSON.stringify(closeA)}${reopenGate.ok ? '' : '——' + reopenGate.reason}`)
  observe(`${idTag()}关停`, `PID-A=${app.launch.pid}；关闭方式=${closeA.via}；应用输出 ${JSON.stringify(app.sink)}`)
  realWorkspaceObserve(realBefore, 'L5 PID-A 运行前后')
  if (!reopenGate.ok) {
    // 关闭没成功就**不能**在同一个 profile 上开第二个实例：两个实例会争同一个工作区/WebView 数据目录
    block('close', `PID-A 未达到"可重开"条件：${reopenGate.reason}——拒绝在同一隔离 profile 上再开第二个实例`)
    return
  }

  // ② PID-B：新 PID 打开**同一**隔离 profile
  const appB = await openApp(ctx.chromium, ctx)
  if (!appB) return // block 已在 openApp 里置好
  try {
    check(`${idTag()}PID-B 与 PID-A 是不同进程`, appB.launch.pid !== app.launch.pid, `A=${app.launch.pid} B=${appB.launch.pid}`)
    check(
      `${idTag()}PID-B 进程身份与本轮 exe 一致`,
      procIdentity(appB.launch.pid, exe).matchesExpected === true,
      JSON.stringify(procIdentity(appB.launch.pid, exe)),
    )
    check(`${idTag()}PID-B 用的是同一隔离 profile / workspace`, appB.rec.profile === ctx.iso.profile && appB.rec.workspace === ctx.iso.workspace, `profile=${appB.rec.profile}`)
    const launchReadB = await verifyLaunch(appB, ctx, { expectEmpty: false })
    if (!launchReadB) return
    // 等重开后的界面把文稿恢复出来（不是 sleep 完就断言）
    await appB.page.waitForFunction(() => !!document.querySelector('[data-doc-state]'), null, { timeout: 60000 }).catch(() => {})
    await waitDocReady(appB.page)
    // 零请求观察窗口从 **PID-B 启动那一刻**开始，而不是"读回完成之后"。
    // 原来 `t0` 取在读回之后，启动早期的派发（如果有）落在窗口外，等于把"没看见"当成"零请求"。
    const t0 = appB.rec.startedAt || appB.launch.startedAt || Date.now()
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
    const traceAfter = readTraceRecords(ctx.iso.workspace, t0)
    const probeB = await appB.page.evaluate(() => {
      const p = window.__acceptanceProbe || { model: [], calls: [] }
      return { model: p.model.map((m) => m.cmd), calls: p.calls.map((c) => c.cmd) }
    })
    // 零请求是**必须可观察**才算成立：trace 读不出来时"没看到请求"证明不了零请求（指南 §0.0 R3 末条）。
    check(
      `${idTag()}重开期间没有新的模型请求（探针无模型命令、trace 可观察且无新 request）`,
      probeB.model.length === 0 && traceAfter.observable === true && traceAfter.requests.length === 0,
      `探针模型命令=${JSON.stringify(probeB.model)}；新 trace 请求=${traceAfter.observable ? traceAfter.requests.length : 'UNKNOWN'}；可观察=${traceAfter.observable}；窗口自 ${new Date(t0).toISOString()}（PID-B 启动）起；重开本轮命令=${JSON.stringify([...new Set(probeB.calls)])}`,
    )
    if (traceAfter.observable !== true) {
      fail('trace', `重开期间的 trace 不可观察（${traceAfter.note || '未知原因'}）——无法证明"零新增模型请求"，只能记 UNKNOWN`)
    }
    const recL5 = ctx.budget.recordPhase({ dispatches: 0, genSvg: 0, note: 'L5 关停重开：不新增模型调用', extra: { phase, noDispatchExpected: true } })
    if (!recL5.ok) fail('budget', `L5 账本记录没有落盘（${recL5.reason}）`)
    writeJsonEvidence(join(evidenceDir, 'L5-after-reopen.json'), { stateB: slimState(stateB), cmpB, probeB, traceRequests: traceAfter.requests.length, pidB: appB.launch.pid }, 'L5-after-reopen.json')
  } finally {
    const closeB = await appB.close()
    check(`${idTag()}PID-B 走应用自身退出路径正常关闭（未被强杀）`, closeB.closed === true && closeB.forced === false, JSON.stringify(closeB))
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

  // 导出对象必须是**最后成功版本**（指南 §8.4）：与 L5 用同一份基准，而不是"当前界面上随便哪一版"。
  // 这样 L4 失败而 L2 成功时，基准就是 L2——不会固定拿 L1 去比，也不会用失败稿冒充成品。
  const prev = latestBaseline()
  if (!prev) {
    block('baseline', '找不到"最后成功版本"的基准（没有任何检查全过的成功版本）——请先用同一个 --root 跑 L1（L2/L4 可选）')
    return
  }
  check(
    `${idTag()}导出基准齐备且是**成功版本**（最后成功版本 = ${prev.phase}，ok=true）`,
    prev.ok === true && !!(prev.revisionId && prev.htmlHash && prev.sourceHash),
    `基准 phase=${prev.phase} ok=${prev.ok} revision=${prev.revisionId} generation=${prev.generation}`,
  )
  if (prev.ok !== true) {
    block('baseline', `最后一条基准 ok=${prev.ok}（不是成功版本）——拒绝导出失败稿冒充验收成品`)
    return
  }
  if (prev.docId !== docId) {
    check(`${idTag()}当前会话与导出基准是同一篇文档`, false, `基准=${prev.docId}，当前=${docId}`)
    block('baseline', `当前会话 ${docId} 与最后成功版本所在的文档 ${prev.docId} 不是同一篇`)
    return
  }
  writeJsonEvidence(join(evidenceDir, 'L6-baseline.json'), prev, 'L6-baseline.json')

  await waitDocReady(app.page)
  const state = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || prev.previewTitle || '')
  check(
    `${idTag()}导出对象是已验收成品（doc-state=accepted 且磁盘成品可读）`,
    state.ui.docState === 'accepted' && state.disk.ok && state.disk.meta.validation === 'verified',
    `doc-state=${state.ui.docState}；revision=${state.disk.ok ? state.disk.revisionId : '-'}`,
  )
  check(
    `${idTag()}当前成品就是那份"最后成功版本"（revision / HTML 哈希逐项一致）`,
    state.disk.ok && state.disk.revisionId === prev.revisionId && state.disk.htmlHash === prev.htmlHash,
    `revision ${prev.revisionId} vs ${state.disk.ok ? state.disk.revisionId : '-'}；htmlHash 一致=${state.disk.ok && state.disk.htmlHash === prev.htmlHash}`,
  )
  const t0 = Date.now()
  const currentHtml = state.disk.ok ? state.disk.html : ''

  // ① HTML 导出
  await app.page.locator('[data-act="export-html"]').first().click()
  const htmlMsg = await waitForExportMsg(app.page, /已导出|导出失败/)
  log(`  [导出-HTML] ${htmlMsg}`)
  const htmlPath = (htmlMsg.match(/已导出：(.+)$/) || [])[1] || ''
  const htmlExists = Boolean(htmlPath) && existsSync(htmlPath)
  const htmlFileOk = htmlExists && readFileSync(htmlPath, 'utf8') === currentHtml
  check(
    `${idTag()}HTML 导出有 UI 回执，且实际文件内容与"最后成功版本"逐字节一致`,
    /已导出/.test(htmlMsg) && htmlFileOk,
    `回执=「${clip(htmlMsg, 200)}」；文件存在=${htmlExists}；与基准逐字节一致=${htmlFileOk}；基准 htmlHash=${String(prev.htmlHash).slice(0, 12)}`,
  )
  // 「导出的 .html 真的能打开、内容完整」——GOAL 验收表"导出交付"的**本地半边**（2026-10-08 R7）。
  // 上面两条（逐字节等于成功版本 / 无外链资源）**都推不出**"用户双击打开后看得到东西"：
  // 一个图全裂、正文缺失的 HTML 同样能逐字节一致、同样没有外链。
  // 做法是**真的用浏览器打开那个文件**（file://），核"图片全部解码 + 标题可见 + 可见字数对得上预览"。
  // 打不开页面（拿不到新 page）时如实记为**未核验**，不冒充通过、也不算失败。
  let htmlRender = null
  let htmlRenderErr = ''
  try {
    const ctx0 = htmlExists && app.browser && typeof app.browser.contexts === 'function' ? app.browser.contexts()[0] : null
    const rp = ctx0 && typeof ctx0.newPage === 'function' ? await ctx0.newPage() : null
    if (!rp) {
      htmlRenderErr = '拿不到新的浏览器页面（无法打开导出文件）'
    } else {
      await rp.goto(pathToFileURL(htmlPath).href)
      htmlRender = await rp.evaluate(() => {
        const imgs = Array.from(document.images)
        return {
          charset: document.characterSet,
          imgs: imgs.length,
          broken: imgs.filter((i) => !i.naturalWidth).length,
          widths: imgs.map((i) => i.naturalWidth).slice(0, 12),
          chars: ((document.body && document.body.innerText) || '').replace(/\s+/g, '').length,
          text: ((document.body && document.body.innerText) || '').slice(0, 300),
        }
      })
      await rp.close()
    }
  } catch (e) {
    htmlRenderErr = String(e).slice(0, 180)
  }
  {
    const wantChars = state.ui.article ? state.ui.article.bodyChars : 0
    const wantTitle = String(prev.titleNodeText || '').trim()
    const titleSeen = wantTitle ? String((htmlRender && htmlRender.text) || '').includes(wantTitle) : true
    if (htmlRenderErr) {
      observe(`${idTag()}导出的 .html 用浏览器打开`, `**未核验**：${htmlRenderErr}——不冒充通过、也不据此判失败。`)
    } else {
      check(
        `${idTag()}导出的 .html 用浏览器打开后**内容完整**（图片全部解码 + 标题可见 + 可见字数与预览一致）`,
        htmlRender.imgs > 0 &&
          htmlRender.broken === 0 &&
          titleSeen &&
          wantChars > 0 &&
          Math.abs(htmlRender.chars - wantChars) <= wantChars * 0.1,
        `图 ${htmlRender.imgs} 张（解码失败 ${htmlRender.broken}，宽度 ${JSON.stringify(htmlRender.widths)}）；` +
          `渲染可见字数 ${htmlRender.chars}（预览读数 ${wantChars}）；标题「${wantTitle}」可见=${titleSeen}；字符集 ${htmlRender.charset}`,
      )
    }
  }
  // 新文件必须**出现在本轮目录差分里**（不是"目录里本来就有个同名文件"），
  // 而且必须就是 UI 回执里写的**那一个**路径——只断言"目录里多了任意一个文件"太弱：
  // 回执指向 A、实际新增的是 B，也能过（指南 §0.0 R3 第 6 条）。
  const addedAfterHtml = diffInventory(inventoryBefore, existsSync(exportsDir) ? hashInventory(exportsDir) : {})
  const htmlRel = htmlPath ? relUnder(exportsDir, htmlPath) : ''
  check(
    `${idTag()}HTML 导出产生了本轮新增文件`,
    addedAfterHtml.added.length > 0,
    `新增=${JSON.stringify(addedAfterHtml.added.slice(0, 8))}`,
  )
  check(
    `${idTag()}HTML 回执里的路径就是本轮新增的那个文件（绑定同一成功版本）`,
    !!htmlRel && addedAfterHtml.added.includes(htmlRel) && htmlFileOk,
    `回执路径=「${clip(htmlPath, 200)}」→ 相对=${htmlRel || '(不在导出目录内或回执不可解析)'}；本轮新增=${JSON.stringify(addedAfterHtml.added.slice(0, 8))}；与基准逐字节一致=${htmlFileOk}`,
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
  // 长图与每个分页都要能绑定到"本轮新写出来的文件"（回执张数 ÷ 差分条目各管一半）
  const diffAfterImages = diffInventory(inventoryBefore, existsSync(exportsDir) ? hashInventory(exportsDir) : {})
  const newFiles = new Set(diffAfterImages.added)
  const exportedRel = [longName, ...pageNames].filter(Boolean).map((n) => {
    const abs = join(imgDir, n)
    const rel = abs.slice(exportsDir.length + 1).split('\\').join('/')
    return { name: n, rel, isNew: newFiles.has(rel) }
  })
  check(
    `${idTag()}长图与分页的每一个文件都能绑定到本轮新增（不是"目录里有同名旧文件"）`,
    exportedRel.length > 0 && exportedRel.every((x) => x.isNew),
    `导出对照：${JSON.stringify(exportedRel)}；本轮新增=${JSON.stringify(diffAfterImages.added.slice(0, 20))}`,
  )
  // 保留 375px 预览与 750px 输出供人工查看（指南 §8.4 末条）。
  // 光比正文快照证明不了"预览真的按 375px 渲染"——所以这里抓**真实截图**并核对像素。
  const previewState = await snapshot(app.page, ctx.iso.workspace, docId, prev.titleNodeText || '')
  check(
    `${idTag()}375px 预览仍显示该版本（供人工查看）`,
    previewState.ui.docState === 'accepted' && !!previewState.ui.article && previewState.ui.article.counted === prev.counted,
    `doc-state=${previewState.ui.docState}；正文 ${previewState.ui.article ? previewState.ui.article.bodyChars : -1} 字（基准 ${prev.bodyChars}）`,
  )
  const shot = await capturePreviewShot(app.page)
  check(
    `${idTag()}375px 预览有**真实像素证据**（手机壳宽 375px + 截图落盘且可解码）`,
    Boolean(shot.box) && Math.round(shot.box.width) === 375 && Boolean(shot.info && shot.info.ok && shot.info.height > 0) && !shot.err,
    `手机壳=${shot.box ? `${Math.round(shot.box.width)}x${Math.round(shot.box.height)} CSS px` : '(取不到)'}；截图=${shot.info ? `${shot.info.width}x${shot.info.height} 像素` : '(无)'}；文件=${shot.path || '(未落盘)'}${shot.err ? `；错误=${shot.err}` : ''}`,
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
    // 2026-10-08（父协调者集成 · B 路安全分页的跨文件后果）：
    // 旧断言写死了**实现细节**——`页数 = ceil(长图高/2000)` 且每页高 `= min(2000, 剩余)`。
    // 安全分页把切点改成由**内容边界**决定（不穿过文字行/插画），页高因此不再等高，旧公式必红；
    // 而且它本来就断言不了"分页对不对"，只断言了"切法是不是那一种"。
    // 改为断言分页真正要保证的不变式：各页高度之和**恰等于**长图高（连续覆盖 = 无缺页、无重复、无空隙），
    // 且每页高度为正。旧等高实现同样满足这条（它没坏在拼接上），所以这不是"为了转绿而放松"——
    // 它只是不再把某一种切法当成合同。
    const pageInfos = pageNames.map((n) => infos.find((x) => x.name === n))
    const pageHeights = pageInfos.map((i) => (i ? i.height : NaN))
    const pageSum = pageHeights.every((h) => Number.isFinite(h)) ? pageHeights.reduce((a, b) => a + b, 0) : NaN
    check(
      `${idTag()}分页严格连续拼接（页高之和 = 长图高；无缺页/重复/空隙；每页高为正）`,
      pageInfos.every(Boolean) && pageHeights.every((h) => h > 0) && pageSum === longInfo.height,
      `长图 ${longInfo.width}x${longInfo.height}；${pageNames.length} 页，页高=${JSON.stringify(pageHeights)}，合计=${pageSum}`,
    )
    // 2026-10-08（T6 第一处盲点）：把"覆盖完整"升级为"每一页画的就是它该覆盖的那一段"。
    // 页序颠倒、或每页整体偏移 ±N 像素（只要页高之和仍等于长图高）上面那条都不拦；逐像素比较才拦得住。
    if (pageInfos.every(Boolean) && pageHeights.every((h) => Number.isFinite(h) && h > 0)) {
      const b64 = (n) => readFileSync(join(imgDir, n)).toString('base64')
      const longB64 = b64(longName)
      const pageB64 = pageNames.map(b64)
      const totalBytes = Buffer.byteLength(longB64, 'base64') + pageB64.reduce((s, b) => s + Buffer.byteLength(b, 'base64'), 0)
      let cmp = null
      if (totalBytes > PIXEL_CMP_MAX_BYTES) {
        observe(
          `${idTag()}逐页逐像素与长图比对`,
          `跳过：长图 + 分页合计 ${(totalBytes / 1048576).toFixed(1)} MB，超过单次比对上限 ${PIXEL_CMP_MAX_BYTES / 1048576} MB——**如实记为未比较**，不冒充通过。`,
        )
      } else {
        try {
          cmp = await pageFn(app.page, 'comparePagesToLong', {
            long: `data:image/png;base64,${longB64}`,
            pages: pageB64.map((b) => ({ dataUrl: `data:image/png;base64,${b}` })),
          })
        } catch (e) {
          observe(`${idTag()}逐页逐像素与长图比对`, `比对执行失败（${String(e).slice(0, 140)}）——**如实记为未比较**，不冒充通过。`)
        }
      }
      // 诊断（只观测）：在真机上把产品自己的"量 → 画"两步重跑一遍，看行盒对不对得上墨迹。
      // 这是给待办 T7 取证用的——**不判定**，只把数字记下来。
      try {
        const agree = await pageFn(app.page, 'measureRenderAgreement', { html: currentHtml })
        observe(
          `${idTag()}量/画一致性（T7 取证，只观测）`,
          `量到的文本行盒 ${agree.lines} 个，其中**渲染后完全没有墨**的 ${agree.emptyLineBoxes} 个；` +
            `量到的正文底 = ${agree.measuredBottom} 设备像素，实际最底墨迹行 = ${agree.inkBottom}（差 ${agree.inkBottom - agree.measuredBottom}）；` +
            `画布高 ${agree.canvasH}（= 量到 CSS 高 ${agree.hCss}×2）。抽样：` +
            (agree.drift || []).map((d) => `#${d.line}(top=${d.top},墨=${d.ink},最近墨=${d.nearest})`).join(' '),
        )
      } catch (e) {
        observe(`${idTag()}量/画一致性（T7 取证，只观测）`, `诊断未执行：${String(e).slice(0, 160)}`)
      }
      // T7 取证之二：在真机里用**从源码抽出来的产品函数**重算"保护区 → 区间 → 切点"整条链。
      try {
        const { code, consts } = extractT7Fns()
        const plan = await pageFn(app.page, 't7PlanProbe', { code, consts, html: currentHtml })
        observe(
          `${idTag()}切点计划复算（T7 取证，只观测）`,
          `正文高 ${plan.hCss} CSS → 画布 ${plan.canvasPx}；保护区 ${plan.rangeCount} 个 → padding+合并成 ${plan.mergedCount} 个区间；` +
            `切点 ${JSON.stringify(plan.cuts)}；尾部区间 ${JSON.stringify(plan.mergedTail)}；超高页 ${JSON.stringify(plan.oversize)}；` +
            (plan.cutInsideProtected.length
              ? `**落在未 padding 保护区内部**的切点 ${JSON.stringify(plan.cutInsideProtected)}`
              : '没有切点落在未 padding 的保护区内部'),
        )
      } catch (e) {
        observe(`${idTag()}切点计划复算（T7 取证，只观测）`, `诊断未执行：${String(e).slice(0, 200)}`)
      }
      if (cmp) {
        const seams = cmp.seams || []
        if (seams.length === 0) {
          observe(`${idTag()}分页缝口`, '本次只有一页（没有内部切点），缝口无对象可查。')
        } else {
          const bad = seams.filter((s) => s.cross > 0)
          const minNear = Math.min(...seams.map((s) => (s.nearestInk < 0 ? Infinity : s.nearestInk)))
          check(
            `${idTag()}分页**没有一刀切在字上**（每个切点跨缝列数 = 0；口径同 export-paging-check）`,
            bad.length === 0,
            `切点 ${seams.length} 个：` +
              seams.map((s) => `y=${s.cut}(跨缝 ${s.cross}，最近墨迹 ${s.nearestInk < 0 ? '>30' : s.nearestInk}px)`).join('；') +
              `；最近墨迹最小距离=${Number.isFinite(minNear) ? minNear + 'px' : '>30px'}`,
          )
        }
      }
      if (cmp) {
        const ps = cmp.pages || []
        const notCompared = ps.filter((p) => p.diff !== 0)
        check(
          `${idTag()}分页每一页与长图对应条带**逐像素一致**（页序颠倒 / 整体偏移同样会被这条拦下）`,
          ps.length === pageNames.length && notCompared.length === 0,
          `长图 ${cmp.longW}x${cmp.longH}；` +
            ps
              .map(
                (p) =>
                  `第${p.index + 1}页(top=${p.top},h=${p.h})` +
                  (p.diff === 0 ? '一致(0 像素差异)' : p.diff < 0 ? `未比较(${p.note})` : `差异 ${p.diff} 像素，首个差异行 ${p.firstRow}`),
              )
              .join('；'),
        )
      }
    }
    observe(
      `${idTag()}分页切点与覆盖范围`,
      `页高由内容驱动的安全切点决定（不再是固定 2000 设备像素），本次页高=${JSON.stringify(pageHeights)}。` +
        `单页高超出目标页高**只应**出现在"不可分割块高于一页"的超高页；本行只观测不判定` +
        `（切点精度与超高页原因由 export-paging-check 的夹具断言承载）。` +
        `本次只证明${pageNames.length === 1 ? '单页' : '这一次的分页'}情形，多页边界仍需确定性长文夹具验证，不能据此声称覆盖多页分页。`,
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
  const traceAfter = readTraceRecords(ctx.iso.workspace, 0)
  const traceThisExport = readTraceRecords(ctx.iso.workspace, t0)
  const newReqs = traceThisExport.requests
  check(
    `${idTag()}本轮导出没有新增模型调用（trace 必须可观察，否则只能记 UNKNOWN）`,
    probe.model.length === 0 && traceThisExport.observable === true && newReqs.length === 0,
    `探针模型命令=${JSON.stringify(probe.model)}；本轮新 trace 请求=${traceThisExport.observable ? newReqs.length : 'UNKNOWN'}；可观察=${traceThisExport.observable}；全部 trace 请求数=${traceAfter.requests.length}`,
  )
  if (traceThisExport.observable !== true) {
    fail('trace', `导出期间的 trace 不可观察（${traceThisExport.note || '未知原因'}）——无法证明"导出零模型请求"，只能记 UNKNOWN`)
  }
  const recL6 = ctx.budget.recordPhase({ dispatches: 0, genSvg: 0, note: 'L6 导出：不新增模型调用', extra: { phase, noDispatchExpected: true } })
  if (!recL6.ok) fail('budget', `L6 账本记录没有落盘（${recL6.reason}）`)
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

/** `abs` 相对 `base` 的路径（不在 base 之下则空串）——用于把 UI 回执路径绑定到目录差分条目上 */
function relUnder(base, abs) {
  try {
    const b = resolve(base)
    const a = resolve(abs)
    const bl = b.toLowerCase()
    const al = a.toLowerCase()
    if (al === bl) return ''
    if (!al.startsWith(bl + sep.toLowerCase())) return ''
    return a.slice(b.length + 1).split(sep).join('/')
  } catch {
    return ''
  }
}

/**
 * 抓预览 iframe 的**真实截图**（指南 §8.4：375px 预览要留实际成品证据，不能只留正文快照）。
 * 返回 `{ box, info, err, path }`；`box` 是元素的 CSS 像素尺寸，`info` 是 PNG 头解析结果。
 */
async function capturePreviewShot(page) {
  // "375px 预览"量的是**手机壳**（`.phone`，CSS 里就是 `width: 375px`），不是里面的 iframe：
  // 外壳有 12px/8px 内边距与 1px 边框，iframe 内容区实测 358px。原来量 iframe 元素宽度，
  // 于是这条永远差 17px 判红——量错了对象（2026-10-02 真机踩到）。
  const el = page.locator('.phone').first()
  let box = null
  try {
    box = await el.boundingBox()
  } catch {
    box = null
  }
  let bytes = null
  let err = null
  try {
    bytes = await el.screenshot()
  } catch (e) {
    err = String((e && e.message) || e).split('\n')[0]
  }
  let info = null
  let path = ''
  if (bytes && bytes.length) {
    info = pngInfo(bytes)
    path = join(evidenceDir, 'L6-preview-375.png')
    try {
      writeFileSync(path, bytes)
    } catch (e) {
      err = `截图落盘失败：${String((e && e.message) || e)}`
      path = ''
    }
  } else if (!err) {
    err = '截图返回空'
  }
  return { box, info, err, path }
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

/**
 * 报告正文。**状态从一个显式传入的 run 派生**，不再读模块级的 `run.status`——
 * 否则它会用到"附件错误还没产生时"算出来的那份状态，同一份归档里三份文件互相打脸
 * （2026-10-02 复核 R1 实测：判 PASS、报告 BLOCKED、evidence 没有 status）。
 */
function reportMarkdown(r) {
  const led = evidence.ledgerAfter || {}
  const lines = []
  lines.push(`# 真机 + 真实模型验收 · ${phase}`)
  lines.push('')
  lines.push(`状态：**${r.status}**（检查 ${r.checks.filter((c) => c.pass).length}/${r.checks.length} 通过；计划 ${r.plannedCases.length} / 执行 ${r.executedCases.length}）`)
  lines.push('')
  lines.push(`- 时间：${r.startedAt} → ${r.finishedAt || ''}`)
  lines.push(`- 隔离 root：\`${root}\``)
  lines.push(`- 隔离 workspace：\`${evidence.isolation ? evidence.isolation.workspace : '(未建立)'}\``)
  lines.push(`- 证据目录：\`${evidenceDir}\``)
  lines.push(`- 复现命令：\`node scripts/live-acceptance.mjs ${phase} --root ${root}\``)
  if (r.blockedReason) lines.push(`- **阻塞原因**：${r.blockedReason}`)
  lines.push('')
  lines.push('## 检查清单')
  lines.push('')
  for (const c of r.checks) lines.push(`- ${c.pass ? 'PASS' : 'FAIL'} — ${c.id}${c.evidence.length ? `\n  - 证据：${c.evidence.join(' / ')}` : ''}`)
  if (!r.checks.length) lines.push('- （零条检查 = 错误，不是通过）')
  lines.push('')
  if (r.errors.length) {
    lines.push('## 错误')
    lines.push('')
    for (const e of r.errors) lines.push(`- \`${e.stage}\`：${e.message}`)
    lines.push('')
  }
  lines.push('## 观测与归因限制')
  lines.push('')
  for (const o of r.observations) lines.push(`- ${o.id}：${o.detail}`)
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

/**
 * 收尾落盘 + 定退出码（指南 §0.2 R1）。
 *
 * 顺序是**先落盘、后定状态**：原来先算 `run.status` 再写文件，写失败只表现为
 * `writeFileEvidence` 里一句 `fail('io', …)`——而 `run.status` 早就定好了，于是
 * "证据没写出去"和"全部通过"在归档里长得一模一样。现在任何必需附件或判定文件写失败
 * 都会进入 `statusOf()`，把本次运行钉成 ERROR、退出非 0、且不打印"证据留档"。
 *
 * 写两遍是有意的，而且两遍之间夹着**账本闭合**（指南 §0.0 C）：第一遍确认必需证据真的落盘了，
 * 之后才把 phase 终结写进账本，再按最终判定重写一遍 `report.md` / `run-result.json`——
 * 账本侧的任何关键写失败都会让本轮非 PASS，两份文件必须说的是同一件事（"尽力更新过时判定"）。
 * 反过来先闭合账本、再写证据，就是复核反例 B2：账本记成 pass 而这次运行连证据都没写出去。
 */
function finalizeAndExit() {
  run.finishedAt = new Date().toISOString()
  let dir = evidenceDir
  try {
    ensureDir(dir)
  } catch {
    dir = join(tmpdir(), 'wxmp-live-acceptance-blocked')
    try {
      ensureDir(dir)
    } catch {
      /* 连临时目录都写不了：只在 stdout 报告，下面 persist 会如实失败 */
    }
  }
  // 附件内容**全部从传入的 run 派生**（函数形式）：附件错误一旦改变判定，
  // persistRunResult 会按新判定把这三份重写一遍，保证同一归档里状态是同一件事（指南 §0.2 R1）。
  const filesFor = (r) => {
    evidence.status = r.status
    const out = {
      'evidence.json': JSON.stringify(evidence, null, 2) + '\n',
      'report.md': reportMarkdown(r),
      'stdout.txt': LOG.join('\n') + '\n',
    }
    // 落盘前扫密钥：这里绕过了 writeJsonEvidence，扫不到就等于把密钥交给归档
    for (const [name, text] of Object.entries(out)) assertNoSecret(text, name)
    return out
  }
  // `baseErrors` 让 verdict **可重复计算**：persist 会多次回调（附件重写 + 判定文件重写），
  // 若用 push 追加就会多出一份重复错误，判定对象也就不可重复计算了。
  // ⚠️ 这个快照必须**每次调用时当场取**：本函数现在会被调用两遍（见下方的顺序），
  // 固定成调用前那一份会把第二遍之前新产生的错误（账本侧失败）整个抹掉。
  const persistOnce = () => {
    const baseErrors = run.errors.slice()
    try {
      return persistRunResult({
        dir,
        files: filesFor,
        verdict: (errors) => {
          run.errors = baseErrors.concat(errors.map((e) => ({ stage: 'persist', message: `写 ${e.file} 失败：${e.message}` })))
          run.status = statusOf() // persist 错误已进 run.errors → ERROR（BLOCKED 优先，它本来就不是"通过"）
          return run
        },
      })
    } catch (e) {
      const msg = String((e && e.message) || e)
      fail('persist', `落盘过程异常：${msg}`)
      run.status = statusOf()
      evidence.status = run.status
      return { ok: false, dir, errors: [{ file: '(未知)', message: msg }], verdictWritten: false }
    }
  }

  // ── 顺序（指南 §0.0 C，复核反例 B2 的修法）─────────────────────────────────────
  //   ① **必需证据先落盘**；② 证据确认落盘之后才把 phase 终结（连同业务失败屏障，同一次原子写）
  //   写进账本；③ 再按最终判定重写一遍证据——账本侧的任何关键写失败都会让本轮非 PASS，
  //   而 `run-result.json` 必须说的是同一件事。
  // 顺序本身在 `lib/ledger-finalize.mjs::runFinalizeSequence()`（唯一实现，离线可驱动）：
  // 反过来（先闭合、后写证据）就是被修掉的那条——账本记成 pass，而这次运行连证据都没写出去。
  let persist = runFinalizeSequence({ persist: persistOnce, finalize: finalizeLedger }).final
  // 最终判定以 persist 回来的那一份为准（它才是被写进 run-result.json 的对象）
  const finalStatus = (persist.run && persist.run.status) || run.status
  run.status = finalStatus
  log('')
  if (persist.ok) {
    log(`  证据留档：${dir}`)
    log(`  run-result.json：${join(dir, 'run-result.json')}`)
  } else {
    // 不打印"证据留档"：这些文件确实没写成功，说了就等于伪造归档
    log(`  [落盘失败] 目标目录 ${dir} 下这些文件没有写成功，归档里不会有它们：`)
    for (const e of persist.errors) log(`    · ${e.file}：${e.message}`)
    log('  ——本次结果不可按"已留档"签收。')
  }
  log(`LIVE-ACCEPTANCE ${run.status}（${phase}）`)
  process.exit(run.status === 'PASS' && persist.ok ? 0 : run.status === 'BLOCKED' ? 2 : 1)
}

// =====================================================================================
// 第 16 节：主流程
// =====================================================================================

async function main() {
  if (!phase) {
    console.error(`必须指定 phase（L1..L6）。\n${CONFIG_HINT}`)
    process.exit(2)
  }
  // 额度参数先验（指南 §0.3）：非法值直接 BLOCKED。
  // 不拦的后果是具体的——`NaN` 会让"本回合中止线"永远为假（`x >= NaN` 恒 false），
  // 等于把这一层的额度限制**整个关掉**，而界面上只会看到一行"≤ NaN"。
  if (!MAX_DISPATCHES_ARG.ok || !MAX_GEN_SVG_ARG.ok) {
    block('budget', `额度参数非法：${[!MAX_DISPATCHES_ARG.ok && MAX_DISPATCHES_ARG.reason, !MAX_GEN_SVG_ARG.ok && MAX_GEN_SVG_ARG.reason].filter(Boolean).join('；')}`)
    return
  }
  log(`=== 真机 + 真实模型验收 · ${phase} ===`)
  log(`  隔离 root：${root}`)
  log(`  被测 exe：${exe}`)
  log(
    `  预算：整批派发 ≤ ${MAX_DISPATCHES === undefined ? '(沿用账本已存上限)' : MAX_DISPATCHES} 次，` +
      `其中 gen_svg ≤ ${MAX_GEN_SVG === undefined ? '(沿用账本已存上限)' : MAX_GEN_SVG} 次（跨 phase 累加，不清零）`,
  )
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
  const ctx = { iso, key: SECRET, budget: null, chromium: null }
  CTX = ctx

  // ── 付费预算：权限账本在**固定路径**（与 --root 无关），root 下只是镜像 ──
  const plan0 = PHASE_PLAN[phase]
  const budget = createBudget({
    ledgerPath: GLOBAL_LEDGER,
    mirrorPath: mirrorLedgerPath,
    maxDispatches: MAX_DISPATCHES,
    maxGenSvg: MAX_GEN_SVG,
    phaseMaxDispatches: plan0.maxDispatches,
    phaseMaxGenSvg: plan0.maxGenSvg,
    // 显式写出来（也是模块默认值）：付费派发前必须先把"本 phase 已开始"持久写进账本。
    // 少了这一步，一次"跑了一半、失败记录又没写成"的运行在盘上不留痕迹，下一个进程会直接继续花钱。
    requirePhaseOpen: true,
  })
  const opened = budget.open()
  if (!opened.ok) {
    block('budget', `账本不可用：${opened.reason}`)
    return
  }
  ctx.budget = budget
  evidence.ledgerBefore = budget.summary()
  if (opened.fresh) observe('账本', `首次创建权限账本（${GLOBAL_LEDGER}）：此前本机没有累计记录`)

  const rem = budget.remaining()
  log(
    `  账本（累计，跨 --root 不清零）：上限 ${budget.state.ledger.budget.maxDispatches} / ${budget.state.ledger.budget.maxGenSvg}；` +
      `已派发 ${budget.state.ledger.totals.dispatches} 次、绘图 ${budget.state.ledger.totals.genSvg} 次；剩余 ${rem.dispatches} / ${rem.genSvg}`,
  )

  // ── 未闭合的 phase（指南 §0.0 C）──────────────────────────────────────────────
  // 上一次运行如果**在写下终结证据之前**就结束了（业务失败记录写不成、关键写失败、进程被杀），
  // 账本里会留下一条 open 记录。读到它就不能自动当成"上一轮没事"，必须先核对。
  // 两道历史门槛抽在 `lib/ledger-finalize.mjs::preflightLedgerGate()`（唯一实现）：
  // ① 上一次运行没写下终结证据（未闭合 phase）；② 上一次业务失败标记还没解除。
  const needsPaid = plan0.minDispatches > 0
  let gate = preflightLedgerGate({ budget, needsPaid })
  if (gate.unresolved) {
    if (!RESUME_REASON) {
      block('budget', gate.block)
      return
    }
    const resolved = budget.resolveUnresolved(String(RESUME_REASON))
    if (!resolved.ok) {
      block('budget', `闭合历史未完成 phase 失败：${resolved.reason}`)
      return
    }
    observe('账本', `按 --resume-after-fix 闭合历史未完成 phase：${RESUME_REASON}（只闭合记录，不返还额度、不清零累计）`)
    gate = preflightLedgerGate({ budget, needsPaid }) // 闭合之后再看业务失败标记（原来两道检查是顺序执行的）
  }

  // 上次的业务失败没清掉之前，付费 phase 不许继续（指南 §0.4 末段）
  if (gate.priorFailure && needsPaid) {
    if (!RESUME_REASON) {
      block('budget', gate.block)
      return
    }
    const cleared = budget.clearBusinessFailure(String(RESUME_REASON))
    if (!cleared.ok) {
      block('budget', `解除业务失败标记失败：${cleared.reason}`)
      return
    }
    observe('账本', `按 --resume-after-fix 解除业务失败标记：${RESUME_REASON}`)
  } else if (gate.priorFailure) {
    observe('账本', `存在未解除的业务失败记录（${gate.priorFailure.at}）：本 phase 不派发模型，继续执行`)
  }

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
  // 门禁按**夹紧后**的中止线工作：L5/L6 的 maxDispatches=0 就是"本回合一次都不许发"
  budget.setPhaseMax({ dispatches: plan.maxDispatches, genSvg: plan.maxGenSvg })
  log(`  本回合中止线：派发 ≤ ${plan.maxDispatches}、绘图 ≤ ${plan.maxGenSvg}（派发前硬拦，超出即拒发）`)

  // 在途状态先落盘：这一步失败就一次模型都不发（指南 §0.0 C）。
  // 放在启动应用之前——这样连"启动阶段就崩掉"也会在账本里留下一条可被下一个进程读到的未闭合记录。
  const began = budget.beginPhase({
    name: phase,
    note: `${phase} 开始（派发中止线 ${plan.maxDispatches}，绘图 ${plan.maxGenSvg}）`,
  })
  if (!began.ok) {
    block('budget', `无法持久记录本 phase 的开始状态（${began.reason}）——拒绝在没有在途记录的情况下派发`)
    return
  }
  log(`  在途记录：已把「${phase} 开始」写入账本（${GLOBAL_LEDGER}）`)

  const { chromium } = resolvePlaywright()
  if (!chromium) return // 缺 playwright 时**不启动应用**：连不上 WebView2 就别去开一个没人操作的实例
  ctx.chromium = chromium

  run.plannedCases = [phase]
  let app = null
  try {
    // `openApp` 自身也要在 try 里：连接 CDP / 暴露预算门禁 / 安装探针任何一步抛异常，
    // 都必须让 finally 把**已经起来的**自有 PID 收掉（原来它在 try 之外，异常路径没有覆盖）。
    // 首次使用一个全新的隔离 profile 时，WebView2 不会开放调试端口——先预热一次再测量
    const warm = await warmUpProfile(ctx)
    if (!warm.skipped) {
      observe(
        '隔离 profile 预热',
        `首次初始化 ${ctx.iso.webview}：${warm.ready ? '已完成' : '45s 内未完成'}，耗时 ${warm.ms}ms；` +
          'WebView2 在首启新 user-data-dir 时不监听调试端口，同一目录的后续启动约 1s 即可达（2026-10-02 实测）。',
      )
    }
    app = await openApp(chromium, ctx)
    if (!app) return // block 已在 openApp 里置好；finally 仍会收尾账本与残留进程
    if (phase === 'L1') await runFirstPhase(ctx, app, plan, 'L1', { wordLimit: 180 })
    else if (phase === 'L7') await runFirstPhase(ctx, app, plan, 'L7', { wordLimit: 1200, minWords: 800 })
    else if (phase === 'L2') await runWritePhase(ctx, app, 'L2', plan)
    else if (phase === 'L3') await runL3(ctx, app, plan)
    else if (phase === 'L4') await runWritePhase(ctx, app, 'L4', plan)
    else if (phase === 'L8') await runWritePhase(ctx, app, 'L8', plan, { wordLimit: 500 })
    else if (phase === 'L5') await runL5(ctx, app)
    else if (phase === 'L6') await runL6(ctx, app)
    // F1 三组样本（2026-10-03 用户明文授权真实小样）
    else if (phase === 'G1') await runFirstPhase(ctx, app, plan, 'G1', { wordLimit: 1200, minWords: 800, grounding: GROUNDING.G1 })
    else if (phase === 'G2A') await runFirstPhase(ctx, app, plan, 'G2A', { wordLimit: 1200, grounding: GROUNDING.G2A, expectAssets: null })
    else if (phase === 'G3') await runFirstPhase(ctx, app, plan, 'G3', { wordLimit: 1200, grounding: GROUNDING.G3, expectAssets: null })
    else if (phase === 'G2B') await runWritePhase(ctx, app, 'G2B', plan, { wordLimit: null })
    // BIG 大文章（2026-10-08，用户指令）：实测绘制并发峰值与限流表现
    // 必须传 grounding：否则按默认走 L1 的 factChecks，用另一篇的固定事实判这篇（首次跑就栽在这）。
    // `maxWords` 是题面自己写的上限（"正文 1500–2500 字"）——此前只有 `wordLimit`，而它在带 grounding 的
    // 题面上走不到（factChecks 那一支被跳过），于是**上限从来没被核过**：写 4000 字也 PASS。
    else if (phase === 'BIG') await runFirstPhase(ctx, app, plan, 'BIG', { wordLimit: 2500, minWords: 1500, maxWords: 2500, grounding: GROUNDING.BIG, expectAssets: null })
    // LONG2（2026-10-08）：第二个**不同体裁**的长文。字数上下限都由**题面自己**写明（1600–2200），所以两个都传；
    // `expectAssets: null` 同 BIG——本题面要的是"开篇横图 1 + 3 小节各 1 = 4 张"，不是 L1 那种"恰好一张"，
    // 用 L1 的口径去判会假红。
    else if (phase === 'LONG2') await runFirstPhase(ctx, app, plan, 'LONG2', { wordLimit: 2200, minWords: 1600, maxWords: 2200, grounding: GROUNDING.LONG2, expectAssets: null })
    run.executedCases = [phase]
  } catch (e) {
    fail('phase', `${String(e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)}`)
  } finally {
    // 收尾：把**本轮启动过的每一个**自有 PID 都关掉（失败路径也一样），一个都不留给用户
    for (const h of HANDLES) {
      if (h.closed) continue
      const r = await closeOwnPid(h.pid, { exe, expectedIdentity: h.identity })
      // 只有**观测到进程确实消失了**才算已关闭；`closed:false`（含身份不明被拒）不能标成关好了
      // （否则下一个 phase 会在同一个 profile 上开第二个实例）
      h.closed = r.closed === true
      h.rec.closed = { ...r, at: new Date().toISOString(), via: 'phase-finally' }
      log(`  [收尾] 关闭自有 PID ${h.pid}：${JSON.stringify(r)}`)
      if (!h.closed) {
        fail(
          'cleanup',
          `自有 PID ${h.pid} 未能关闭（${r.refused ? '身份核验未通过，零关闭操作' : JSON.stringify(r)}）——同一 profile 不得再开第二个实例`,
        )
      }
    }
    // 账本终结**不在这里**做：它必须发生在"必需证据确认落盘之后"（指南 §0.0 C），
    // 也就是 `finalizeAndExit()` 里。放在这里就会重复复核反例 B2 的顺序（账本 pass、证据没写出去）。
  }
}

/**
 * 账本收尾：**所有退出路径**都要走一次（含启动阶段就 BLOCKED 的早退）。
 *
 * 业务失败要写进**持久账本**，后续付费 phase 才不会被直接继续（指南 §0.4 末段）；
 * 无论成败都要留下 `ledgerAfter` 摘要，否则证据里看不出这一轮到底动没动过额度。
 */
function finalizeLedger() {
  if (LEDGER_FINALIZED) return
  if (!CTX || !CTX.budget) {
    evidence.ledgerAfter = null
    return
  }
  LEDGER_FINALIZED = true
  // 收尾逻辑本身在 `lib/ledger-finalize.mjs`（唯一生产实现，离线可驱动）：
  // 业务失败标记与 phase 终结合成**同一次原子账本写**，写失败就保持未闭合。
  // ⚠️ 本函数必须在**必需证据确认落盘之后**被调用（见 finalizeAndExit），否则就是复核反例 B2：
  // 账本已经记成 pass，而这次运行的 run-result.json 根本没写出去。
  const failedChecks = run.checks.filter((c) => !c.pass)
  const res = finalizePhase({
    budget: CTX.budget,
    phase,
    blockedReason: run.blockedReason ? clip(run.blockedReason, 300) : null,
    failedChecks,
    errorCount: run.errors.length,
    checks: { passed: run.checks.length - failedChecks.length, total: run.checks.length },
  })
  for (const e of res.errors) fail('budget', e)
  if (res.mirrorFailures > 0) {
    observe(
      '账本镜像写失败',
      `${res.mirrorFailures} 次：${JSON.stringify(res.mirrorFailureReasons.slice(0, 3))}（镜像只作证据、不影响判定，但如实记录，不再静默吞掉）`,
    )
  }
  if (res.hasFailure && !res.failurePersisted) {
    observe(
      '失败屏障未持久',
      `本轮属于失败运行，但业务失败标记没有落盘（closed=${res.closed}）——盘上应保持**未闭合**，下一个进程会先要求核对`,
    )
  }
  evidence.ledgerAfter = CTX.budget.summary()
  evidence.ledgerFinalize = { outcome: res.outcome, closed: res.closed, failurePersisted: res.failurePersisted, ok: res.ok }
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
