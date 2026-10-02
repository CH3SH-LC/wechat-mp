// dispatch-budget.mjs —— 真机验收的**派发前**付费预算（DS 修复指南 §0.3 R2）
//
// 为什么必须单独做成一个"写者"模块：原实现把预算当成**事后计数**——页面侧探针记录命令后直接
// `orig()`，`sendTurn()` 每约 1.4 秒回读一次计数，超了才点"停止"。也就是说：
//   · 额度只剩 1 次时同时发两个请求，两次都**真的发出去了**，事后才发现超了；
//   · 脚本崩溃/被 Ctrl-C 时，已经发出去的请求根本没记进账本，重启后额度被"恢复"；
//   · 账本读不出来或 JSON 坏了会被当成"全新账本"，20/4 直接回到满额。
// 三件事的共同点是**决定发生在派发之后**。本模块把决定挪到派发之前：每一次可能计费的请求都要
// 先在这里**原子地预留并落盘**，预留失败就不发。
//
// 口径（指南 §0.3）：
//   · 预留 = 立即计入已用（不设"待定"状态）——所以"已预留但结果未知"的派发天然继续占额度，
//     崩溃重启不会把额度还回来；
//   · 唯一写者：本模块所有变更都是"读-改-写-落盘"一次做完，进程内同步执行 → 并发预留不会
//     同时消费同一份剩余额度；
//   · 权限账本只有一份，路径**固定**（`GLOBAL_LEDGER`），与 `--root` 无关——换 root 不能重置预算；
//     每个 root 下另存一份镜像，供本次证据归档；
//   · 账本"读不出来/解析不了/schema 不符"一律 BLOCKED，**不自动清零**；
//   · 命令行参数必须是有限非负整数；已存的额度**只能被调小**，调大无效；
//   · **在途状态先落盘**（2026-10-02 晚间复核新增）：付费派发之前必须先 `beginPhase()` 把
//     "本 phase 已开始"写进账本，只有 `closePhase()` 把终结证据写成功才算闭合。下一次启动
//     读到未闭合记录时必须先核对（`unresolvedPhase()`），不自动视为成功——这是对"失败记录
//     正好写不成时，新进程凭旧账本继续预留"那条反例的修复。
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { writeFileAtomic } from './run-result.mjs'

/**
 * 账本锁的等待参数。
 *
 * 2026-10-02 独立复核抓到的真缺陷：账本是**全局一份**（`GLOBAL_LEDGER`），锁却在每个 `--root` 下
 * （`<root>/.live-acceptance.lock`）。两个不同 root 的进程先各自 `open()`（都读到 totals=0），
 * 再各 `reserve()`，于是**额度 1 放行了 2 次**，而盘上只记 1 次——账实不符，且没有任何人报错。
 *
 * 修法是把"读盘 → 查额度 → 扣减 → 落盘"整段放进**同一个跨进程临界区**，且每次都在临界区里
 * **重新读盘**（不能用自己那份内存副本覆盖别人刚写的结果）。锁就是账本旁边的一个独占创建文件
 * （`open(..., 'wx')`：检查与占用是同一次系统调用，不存在"先读后写"的窗口）。
 *
 * 临界区里用的是 `Atomics.wait` 同步等待（同步模块没法 await），所以等待上限必须有限：
 * 等不到就**当成拿不到锁**返回失败，调用方按"零派发"处理——宁可拒绝花钱，不可绕过额度。
 */
const LOCK_SUFFIX = '.lock'
const LOCK_WAIT_MS = 25
const LOCK_TIMEOUT_MS = 20000
/** 超过这个年龄、且持有者进程已经不在，才允许回收（避免从活着的持有者手里抢锁） */
const LOCK_STALE_MS = 60000

const syncSleep = (ms) => {
  // 只有主线程能 Atomics.wait；拿不到就退化成忙等（临界区很短，不构成问题）
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    const end = Date.now() + ms
    while (Date.now() < end) {
      /* busy wait */
    }
  }
}

const pidAlive = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM = 进程在但没权限（也算活着）；ESRCH = 不存在
    return e && e.code === 'EPERM'
  }
}

/**
 * 在 `<ledgerPath>.lock` 上跑一段**跨进程串行**的临界区。
 *
 * 返回 `{ ok:true, value }` 或 `{ ok:false, reason }`。
 * **拿不到锁一律不执行 `fn`**（调用方据此拒绝派发），不"降级成不锁也要跑"。
 */
export function withLedgerLock(ledgerPath, fn, { timeoutMs = LOCK_TIMEOUT_MS } = {}) {
  const lockPath = ledgerPath + LOCK_SUFFIX
  try {
    mkdirSync(dirname(lockPath), { recursive: true })
  } catch (e) {
    return { ok: false, reason: `无法创建账本目录（${String((e && e.message) || e)}）：${dirname(lockPath)}` }
  }
  const deadline = Date.now() + timeoutMs
  let fd = null
  for (;;) {
    try {
      fd = openSync(lockPath, 'wx') // 独占创建：检查与占用一次做完
      writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), 'utf8')
      break
    } catch (e) {
      if (!e || e.code !== 'EEXIST') {
        return { ok: false, reason: `无法创建账本锁（${String((e && e.message) || e)}）：${lockPath}` }
      }
      // 已存在：判断持有者是不是已经死了（崩溃残留），是就回收
      if (reclaimStaleLock(lockPath)) continue
      if (Date.now() >= deadline) {
        return {
          ok: false,
          reason: `账本锁被其它进程占用超过 ${timeoutMs}ms（${lockPath}）——拒绝在无锁状态下读写额度`,
        }
      }
      syncSleep(LOCK_WAIT_MS)
    }
  }
  try {
    return { ok: true, value: fn() }
  } finally {
    try {
      closeSync(fd)
    } catch {
      /* 关不掉不影响正确性 */
    }
    try {
      unlinkSync(lockPath)
    } catch {
      /* 已经被别人回收：不影响正确性 */
    }
  }
}

/** 持有者已死且锁够旧 → 回收。回收前后各看一次 mtime，避免把别人刚拿到的锁删掉 */
function reclaimStaleLock(lockPath) {
  let st1 = null
  try {
    st1 = statSync(lockPath)
  } catch {
    return true // 已经没了：直接重试创建
  }
  let holder = null
  try {
    holder = JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    holder = null
  }
  const ageMs = Date.now() - st1.mtimeMs
  const holderGone = !holder || !pidAlive(Number(holder.pid))
  if (!(ageMs > LOCK_STALE_MS && holderGone)) return false
  let st2 = null
  try {
    st2 = statSync(lockPath)
  } catch {
    return true
  }
  if (st2.mtimeMs !== st1.mtimeMs) return false // 期间被人动过：让调用方重试
  try {
    unlinkSync(lockPath)
    return true
  } catch {
    return false
  }
}

/** 指南 §8.1 的执行默认值（不是用户给定的硬金额限制） */
export const DEFAULT_MAX_DISPATCHES = 20
export const DEFAULT_MAX_GEN_SVG = 4

/** 权限账本的固定位置：**故意不放在 `--root` 下**，否则换个 root 就等于重置预算 */
export const GLOBAL_LEDGER = join(tmpdir(), 'wxmp-live-acceptance-budget.json')

export const LEDGER_SCHEMA = 1

/**
 * 会打到真实模型端点的命令 → 计费类别。**这张表就是"全覆盖"的凭据**：
 * 表外的命令一律按"不计费"放行，所以加新的付费命令时必须同时加进这里，否则它会被静默放过。
 * 对照 `src-tauri/src/chat.rs` 的 `#[tauri::command]`：chat_stream / gen_svg / review_assets /
 * refine_brief / prep_turn 五个；`model_lock_state` 只读本地配置，不计费。
 *
 * 一次 invoke = 一次服务端请求：`gen_svg` 的重试发生在**前端**（每次递增 `attempt` 再调一次），
 * Rust 侧没有内部重试循环，所以"按命令预留一次"与"按请求预留一次"是同一件事。
 */
export const PAID_COMMANDS = {
  chat_stream: 'text', // 撰写 / 修订（按 turn 档位区分，同一个命令）
  prep_turn: 'text', // 准备阶段
  refine_brief: 'text', // 补描述
  review_assets: 'text', // 视觉复核
  gen_svg: 'draw', // 绘图（独立额度）
}
export const isPaidCommand = (cmd) => Object.prototype.hasOwnProperty.call(PAID_COMMANDS, String(cmd))

/** 有限非负整数校验（指南 §0.3：非法数值不得成为放大额度的手段） */
export function parseBudgetParam(raw, def) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: def }
  const s = String(raw).trim()
  if (!/^\d+$/.test(s)) return { ok: false, reason: `额度参数必须是有限非负整数，收到 "${raw}"` }
  const n = Number(s)
  if (!Number.isSafeInteger(n)) return { ok: false, reason: `额度参数超出安全整数范围："${raw}"` }
  return { ok: true, value: n }
}

/** 读账本文件：区分"本来就没有"与"有但读不出来"——后者绝不能被当成新账本 */
export function readLedgerFile(path) {
  if (!existsSync(path)) return { state: 'missing' }
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch (e) {
    return { state: 'corrupt', reason: `账本存在但读不出来（${String((e && e.message) || e)}）：${path}` }
  }
  let j = null
  try {
    j = JSON.parse(raw)
  } catch (e) {
    return { state: 'corrupt', reason: `账本存在但不是合法 JSON（${String((e && e.message) || e)}）：${path}` }
  }
  if (!j || typeof j !== 'object' || j.schema !== LEDGER_SCHEMA) {
    return { state: 'corrupt', reason: `账本 schema 不符（期望 ${LEDGER_SCHEMA}，实际 ${j && j.schema}）：${path}` }
  }
  if (!j.totals || !Number.isSafeInteger(j.totals.dispatches) || !Number.isSafeInteger(j.totals.genSvg)) {
    return { state: 'corrupt', reason: `账本 totals 字段缺失或非法：${path}` }
  }
  // 负数计数一律判损坏。**不能**"修成 0"——那等于把一份说不清累计额度的账本洗成"还剩满额"，
  // 比报错危险得多（2026-10-02 复核实测：totals=-1/-1 时旧实现放行了本该拒绝的一次绘图）。
  if (j.totals.dispatches < 0 || j.totals.genSvg < 0) {
    return { state: 'corrupt', reason: `账本 totals 出现负数（dispatches=${j.totals.dispatches}，genSvg=${j.totals.genSvg}）：${path}——拒绝猜测累计额度` }
  }
  // 自洽性：每次绘图本身也是一次派发，所以 genSvg 不可能大于 dispatches
  if (j.totals.genSvg > j.totals.dispatches) {
    return { state: 'corrupt', reason: `账本 totals 不自洽（genSvg=${j.totals.genSvg} > dispatches=${j.totals.dispatches}）：${path}` }
  }
  // budget 必须自洽：**已存在但非法**（null / 负数 / 小数 / 字符串）是损坏，不是"没设置"。
  // 实测踩过：非法命令行参数让 `NaN` 被 JSON 序列化成 `null` 落进账本，之后每次打开都读到一个
  // 说不清额度的账本——这种"以为还有 20 次"的账本比报错危险得多。
  for (const [k, v] of [['maxDispatches', j.budget && j.budget.maxDispatches], ['maxGenSvg', j.budget && j.budget.maxGenSvg]]) {
    if (!Number.isSafeInteger(v) || v < 0) {
      return { state: 'corrupt', reason: `账本 budget.${k} 非法（${JSON.stringify(v)}）：${path}——拒绝猜测额度，请人工核对后删除该账本再重建` }
    }
  }
  // phases 必须真的是一张表。旧实现把非数组静默改成 `[]`——那会把**历史业务失败标记一起抹掉**，
  // 后续付费 phase 就凭一份"干净"的账本继续花钱（2026-10-02 复核实测）。
  if (!Array.isArray(j.phases)) {
    return { state: 'corrupt', reason: `账本 phases 不是数组（实际 ${j.phases === null ? 'null' : typeof j.phases}）：${path}——拒绝丢弃历史记录，请人工核对` }
  }
  return { state: 'ok', ledger: j }
}

/**
 * 建立一个预算写者。
 *
 * @param ledgerPath 权限账本（固定路径，跨 root 累加）
 * @param mirrorPath 可选的镜像（通常是 `<root>/ledger.json`，只作证据，**不参与判定**）
 * @param maxDispatches/maxGenSvg 本次命令行给出的额度上限（只能把已存额度调小）
 * @param phaseMaxDispatches/phaseMaxGenSvg 本 phase 的中止线（L5/L6 传 0：本回合一次都不许发）
 * @param requirePhaseOpen 付费派发是否必须先有一条**已落盘**的 phase 开始记录（默认 true，fail closed）
 */
export function createBudget({
  ledgerPath = GLOBAL_LEDGER,
  mirrorPath = null,
  // `undefined` = **调用方没有意见**（命令行没给这个参数）：此时以盘上账本为准，不把它缩小。
  // 2026-10-02 踩到：用户把额度授权放宽后，下一次没带参数的运行会把上限**悄悄压回默认 20**，
  // 于是"授权放宽"被一次普通运行抹掉、收到一个莫名的"剩余 0 次"。给了值才表达"只能调小"的意图。
  maxDispatches,
  maxGenSvg,
  phaseMaxDispatches = null,
  phaseMaxGenSvg = null,
  // 默认 **true**（fail closed）：付费请求前必须先在账本里持久写下"本 phase 已开始"。
  // 这样"业务失败/关键写失败/进程中断"三种情形的下一次启动都能读到一条**未闭合**记录并先核对，
  // 而不是依赖那条正好写失败的失败记录（2026-10-02 晚间复核的反例：失败记录写不成时，
  // 恢复旧账本的新实例读到 priorBusinessFailure=null，仍可正常预留）。
  // 唯一会显式关掉它的是 `scripts/budget-check.mjs`：它逐条验收 `reserve()` 的额度语义，
  // 不跑生命周期；phase 屏障本身由该脚本的 ⑬ 组单独覆盖。
  requirePhaseOpen = true,
  now = () => new Date().toISOString(),
} = {}) {
  const state = {
    ok: false,
    reason: null,
    fresh: false,
    ledger: null,
    ledgerPath,
    mirrorPath,
    /** 本 phase 已预留 */
    phase: { dispatches: 0, genSvg: 0 },
    phaseMax: { dispatches: phaseMaxDispatches, genSvg: phaseMaxGenSvg },
    /** 是否要先持久化 phase 开始记录才允许付费派发 */
    requirePhaseOpen: requirePhaseOpen === true,
    /** 本进程是否已经成功持久写下 phase 开始记录 */
    phaseOpen: false,
    /** 本进程 phase 开始记录对应的名字（只作证据） */
    phaseName: null,
    /** 落盘失败次数（**任何**一次关键写失败都在这里累计，含 open/reserve/recordPhase） */
    persistFailures: 0,
    /** 镜像（只作证据）落盘失败次数与原因：不影响判定，但必须可观察，不能静默吞掉 */
    mirrorFailures: 0,
    mirrorFailureReasons: [],
    /** 拿不到跨进程锁的次数 */
    lockFailures: 0,
    /** 超出额度被拒的派发尝试（拒绝过几次） */
    refusals: [],
  }

  const persist = (ledger) => {
    ledger.updatedAt = now()
    try {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      writeFileAtomic(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
    } catch (e) {
      // **在这里累计**（而不是只在 reserve 的失败分支里）：open / recordPhase / clearBusinessFailure
      // 的写失败同样是"关键账本写不出去"，调用方必须能拿到这个信号并把本次运行钉成 ERROR。
      state.persistFailures += 1
      return { ok: false, reason: `账本落盘失败（${String((e && e.message) || e)}）：${ledgerPath}` }
    }
    if (mirrorPath) {
      // 镜像只是留档：写不出去不影响判定（权限账本已经写成功），但**不能静默吞掉**——
      // 原实现 `catch {}` 直接忽略，于是"镜像从来没写成功过"在证据里看不出来。
      try {
        mkdirSync(dirname(mirrorPath), { recursive: true })
        writeFileAtomic(mirrorPath, JSON.stringify(ledger, null, 2) + '\n')
      } catch (e) {
        state.mirrorFailures += 1
        state.mirrorFailureReasons.push(String((e && e.message) || e))
      }
    }
    return { ok: true }
  }

  /**
   * 账本额度**只能调小**（命令行给 200 不能把已记的 20 放大）；调用方没给值时（`undefined`）
   * 保持盘上已存的上限不动；空账本才用构造参数（或默认值）初始化。
   */
  const clampBudget = (ledger) => {
    const pick = (stored, asked, def) => {
      const hasStored = Number.isSafeInteger(stored)
      const hasAsked = Number.isSafeInteger(asked)
      if (hasStored) return hasAsked ? Math.min(stored, asked) : stored
      return hasAsked ? asked : def
    }
    ledger.budget = {
      maxDispatches: pick(ledger.budget?.maxDispatches, maxDispatches, DEFAULT_MAX_DISPATCHES),
      maxGenSvg: pick(ledger.budget?.maxGenSvg, maxGenSvg, DEFAULT_MAX_GEN_SVG),
    }
    return ledger
  }

  /**
   * 在**临界区里**重新读盘并采纳为当前真值。
   *
   * 这是"多 root 不超发"的关键：不能用自己那份内存副本覆盖别人刚写进去的累计值。
   * 账本在运行期**消失**（被谁删了）也按损坏处理——"读不出来"绝不能等同于"额度是满的"。
   */
  const readFresh = () => {
    const r = readLedgerFile(ledgerPath)
    if (r.state === 'corrupt') return { ok: false, reason: r.reason }
    if (r.state === 'missing') {
      return { ok: false, reason: `账本在运行期消失了（${ledgerPath}）——拒绝按"全新账本"继续，请人工核对累计派发` }
    }
    state.ledger = clampBudget(r.ledger)
    return { ok: true, ledger: state.ledger }
  }

  /** 跑一段需要独占账本的临界区；拿不到锁 → `{ ok:false }`（调用方必须放弃派发） */
  const critical = (fn) => {
    let r
    try {
      r = withLedgerLock(ledgerPath, () => {
        const fresh = readFresh()
        if (!fresh.ok) return { ok: false, reason: fresh.reason, ledgerUnavailable: true }
        return fn(fresh.ledger)
      })
    } catch (e) {
      // 临界区里抛异常：一律按"这次预留失败"处理（fail closed），不让异常穿透到页面侧探针
      state.persistFailures += 1
      return { ok: false, reason: `账本临界区异常（${String((e && e.message) || e)}）——拒绝派发` }
    }
    if (!r.ok) {
      state.lockFailures += 1
      return { ok: false, reason: r.reason }
    }
    const v = r.value
    if (!v || !v.ok) {
      // 临界区里"账本本身不可用"（读不出来/写不下去）与"额度用尽被拒"是两回事：
      // 前者是必须被上抛的关键写失败，后者是正常的预算行为。
      if (v && v.ledgerUnavailable) state.persistFailures += 1
      // 其余字段（refused / unresolved / ledgerUnavailable）**原样带出去**：调用方靠它区分
      // "额度用尽"、"phase 已有未闭合记录"、"账本读不出来"这三件完全不同的事。
      return { ok: false, ...(v || {}), reason: (v && v.reason) || '账本操作失败' }
    }
    return v
  }

  const api = {
    state,
    /** 打开账本。损坏 → ok:false（调用方应 BLOCKED），**不**创建新账本 */
    open() {
      // 构造参数先验：`NaN`/`-1`/`1.5` 之类必须在这里就拦住。
      // 不拦的后果实测过：`NaN` 经 JSON 序列化变成 `null` 落进账本，**污染了持久账本**，
      // 之后每次打开都得靠"猜"来还原额度。宁可开不了，也不写一份说不清的账本。
      for (const [k, v] of [['maxDispatches', maxDispatches], ['maxGenSvg', maxGenSvg]]) {
        if (v === undefined) continue // 没意见（见 clampBudget）：以盘上账本为准
        if (!Number.isSafeInteger(v) || v < 0) {
          state.reason = `预算参数 ${k} 非法（${JSON.stringify(v)}）：必须是有限非负整数——拒绝创建/使用账本`
          return { ok: false, reason: state.reason }
        }
      }
      // 首次创建也必须进临界区：两个进程同时"发现没有账本"再各写一份，会把对方的初始化冲掉。
      const r = withLedgerLock(ledgerPath, () => {
        const cur = readLedgerFile(ledgerPath)
        if (cur.state === 'corrupt') return { ok: false, reason: `${cur.reason}——拒绝自动清零，请人工核对累计派发后再决定是否新建账本` }
        if (cur.state === 'missing') {
          const led = {
            schema: LEDGER_SCHEMA,
            createdAt: now(),
            budget: {
              maxDispatches: Number.isSafeInteger(maxDispatches) ? maxDispatches : DEFAULT_MAX_DISPATCHES,
              maxGenSvg: Number.isSafeInteger(maxGenSvg) ? maxGenSvg : DEFAULT_MAX_GEN_SVG,
            },
            totals: { dispatches: 0, genSvg: 0 },
            phases: [],
            note: '所有 prep/write/revise/补描述/绘图/视觉复核调用合并计数；新批次不清零（指南 §8.1）',
          }
          const p = persist(led)
          if (!p.ok) return { ok: false, reason: p.reason }
          state.fresh = true
          state.ledger = led
          return { ok: true, fresh: true }
        }
        state.ledger = clampBudget(cur.ledger)
        return { ok: true, fresh: false }
      })
      if (!r.ok) {
        // 拿不到锁：**不是**"账本坏了"，但也绝不能放行
        state.lockFailures += 1
        state.reason = r.reason
        return { ok: false, reason: r.reason }
      }
      // ⚠️ 锁成功 ≠ 打开成功：临界区里读盘/建账本的结论在 `r.value` 里
      const v = r.value
      if (!v || !v.ok) {
        state.reason = (v && v.reason) || '打开账本失败'
        return { ok: false, reason: state.reason }
      }
      state.ok = true
      return { ok: true, fresh: state.fresh, ledger: state.ledger }
    },

    /**
     * 剩余额度。**以盘上账本为准**（跨进程唯一真值），读不出来才退回内存副本。
     * 写入用 rename 落盘，所以读到的要么是旧版本、要么是新版本，不会是半截。
     */
    remaining() {
      const r = readLedgerFile(ledgerPath)
      const led = r.state === 'ok' ? r.ledger : state.ledger
      if (!led) return { dispatches: 0, genSvg: 0 }
      return {
        dispatches: led.budget.maxDispatches - led.totals.dispatches,
        genSvg: led.budget.maxGenSvg - led.totals.genSvg,
      }
    },

    /**
     * 派发**之前**的原子预留。返回 `{ ok, paid, reason }`；`ok:false` 时调用方**必须**放弃这次派发。
     * 非付费命令直接 `{ ok: true, paid: false }`（不占额度、不碰账本）。
     *
     * 整段（重新读盘 → 查额度 → 扣减 → 落盘）都在**同一把跨进程锁**里；拿不到锁就拒绝。
     */
    reserve(cmd) {
      if (!isPaidCommand(cmd)) return { ok: true, paid: false, kind: null }
      const kind = PAID_COMMANDS[String(cmd)]
      if (!state.ok) {
        state.refusals.push({ cmd: String(cmd), at: now(), reason: '账本不可用' })
        return { ok: false, paid: true, kind, reason: state.reason || '账本不可用' }
      }
      // 在途状态必须先落盘：没有"本 phase 已开始"这条持久记录就拒发。
      // 这一层拦的是"上一次运行在写下终结证据之前就结束了"——那种情形下新进程不能凭旧账本
      // 直接继续（指南 §0.0 C）。
      if (state.requirePhaseOpen && !state.phaseOpen) {
        state.refusals.push({ cmd: String(cmd), at: now(), reason: 'phase 未开始' })
        return {
          ok: false,
          paid: true,
          kind,
          reason: '本 phase 尚未以**持久记录**开始（无在途状态）——拒绝派发；先核对上一次运行留下的未闭合记录',
        }
      }
      const out = critical((led) => {
        const why = []
        if (state.phaseMax.dispatches !== null && state.phase.dispatches >= state.phaseMax.dispatches) {
          why.push(`本回合派发已达中止线 ${state.phaseMax.dispatches}`)
        }
        if (led.totals.dispatches >= led.budget.maxDispatches) {
          why.push(`累计派发已达上限 ${led.budget.maxDispatches}`)
        }
        if (kind === 'draw') {
          if (state.phaseMax.genSvg !== null && state.phase.genSvg >= state.phaseMax.genSvg) why.push(`本回合绘图已达中止线 ${state.phaseMax.genSvg}`)
          if (led.totals.genSvg >= led.budget.maxGenSvg) why.push(`累计绘图已达上限 ${led.budget.maxGenSvg}`)
        }
        if (why.length) return { ok: false, refused: true, reason: why.join('；') }
        // 预留 = 立即计入已用（没有"待定"窗口，所以崩溃也不会把额度还回来）
        const before = { dispatches: led.totals.dispatches, genSvg: led.totals.genSvg }
        led.totals.dispatches += 1
        if (kind === 'draw') led.totals.genSvg += 1
        state.phase.dispatches += 1
        if (kind === 'draw') state.phase.genSvg += 1
        const p = persist(led)
        if (!p.ok) {
          // 落盘失败 → 内存回滚到与磁盘一致（磁盘上没有这次预留，就绝不能让它发出去）
          led.totals.dispatches = before.dispatches
          led.totals.genSvg = before.genSvg
          state.phase.dispatches -= 1
          if (kind === 'draw') state.phase.genSvg -= 1
          return { ok: false, refused: true, reason: p.reason }
        }
        return { ok: true, kind, remaining: api.remaining() }
      })
      if (!out.ok) {
        state.refusals.push({ cmd: String(cmd), at: now(), reason: out.reason })
        return { ok: false, paid: true, kind, reason: out.reason }
      }
      return { ok: true, paid: true, kind: out.kind, remaining: out.remaining }
    },

    /**
     * 记一条 phase 记录（**只记**，不再加减额度——额度已经在 reserve 时扣过了）。
     * 返回值必须被调用方检查：false 表示这条记录**没有落盘**（例如业务失败屏障没写进去，
     * 后续付费进程就看不到它），本次运行必须据此判 ERROR/UNKNOWN。
     */
    recordPhase({ dispatches, genSvg, note, extra = {} }) {
      if (!state.ok) return { ok: false, reason: '账本不可用' }
      return critical((led) => {
        led.phases.push({
          at: now(),
          dispatches,
          genSvg,
          totalsAfter: { ...led.totals },
          remaining: api.remaining(),
          note,
          ...extra,
        })
        return persist(led)
      })
    },

    /**
     * 本回合中止线（`min(该 phase 额度, 整批剩余额度)`）在打开账本之后才能算出来，
     * 所以单独给一个设置口——**必须在任何 reserve 之前调用**。
     */
    setPhaseMax({ dispatches, genSvg }) {
      state.phaseMax = { dispatches, genSvg }
    },

    /**
     * **在任何付费派发之前**，把"本 phase 已开始"这条在途状态持久写进账本（指南 §0.0 C）。
     *
     * 为什么必须有这一步：原实现只在"业务失败那一刻"才写记录，而那次写**可能失败**——
     * 失败之后恢复成"可读的旧账本"，新实例读到的 `priorBusinessFailure` 就是 null，照样预留。
     * 于是"上一次跑了一半"这件事在盘上完全没有痕迹。把开始/在途状态**先**落盘，
     * 就得到一条与"失败记录能否写成"无关的、可跨进程读到的未闭合记录。
     *
     * 账本里已经有未闭合 phase 时**拒绝开第二个**（不覆盖、不假装续上）——调用方必须先核对，
     * 再用 `resolveUnresolved(reason)` 显式闭合它。
     */
    beginPhase({ name = null, note = null } = {}) {
      if (!state.ok) return { ok: false, reason: '账本不可用' }
      const out = critical((led) => {
        const openIdx = led.phases.findIndex((p) => p && p.open === true)
        if (openIdx >= 0) {
          const p = led.phases[openIdx]
          return {
            ok: false,
            unresolved: true,
            reason: `账本里已有未闭合的 phase（${p.phase || '?'}，起于 ${p.at}）——先核对再继续，不自动视为成功`,
          }
        }
        led.phases.push({ at: now(), phase: name, open: true, dispatches: 0, genSvg: 0, note })
        const p = persist(led)
        if (!p.ok) return { ok: false, reason: p.reason }
        state.phaseOpen = true
        state.phaseName = name
        return { ok: true, at: now() }
      })
      if (!out.ok && !out.unresolved) state.refusals.push({ cmd: '(beginPhase)', at: now(), reason: out.reason })
      return out
    },

    /** 读账本里是否还有未闭合的 phase（新进程启动时先看这个，看了才决定要不要继续） */
    unresolvedPhase() {
      const r = readLedgerFile(ledgerPath)
      const phases = (r.state === 'ok' ? r.ledger : state.ledger)?.phases || []
      const open = phases.filter((p) => p && p.open === true)
      if (!open.length) return null
      const p = open[open.length - 1]
      return { at: p.at, phase: p.phase ?? null, note: p.note ?? null, count: open.length }
    },

    /**
     * 人工核对之后，显式闭合历史遗留的未闭合 phase（理由必须写下来，留痕）。
     * 只闭合记录，**不返还额度、不清零累计**——那些派发到底发没发出去仍算 UNKNOWN。
     */
    resolveUnresolved(reason) {
      if (!state.ok) return { ok: false, reason: '账本不可用' }
      return critical((led) => {
        let n = 0
        for (let i = 0; i < led.phases.length; i++) {
          const p = led.phases[i]
          if (p && p.open === true) {
            led.phases[i] = { ...p, open: false, closedAt: now(), outcome: 'resolved-after-review', closeNote: `人工核对后闭合：${reason}` }
            n += 1
          }
        }
        if (!n) return { ok: false, reason: '账本里没有未闭合的 phase' }
        return persist(led)
      })
    },

    /**
     * 本 phase 的终结记录。**只有终结证据完整且写入成功才算闭合**——写不成就保持未闭合，
     * 下一个进程会读到"上一次没跑完"并要求先核对（指南 §0.0 C）。
     */
    closePhase({ outcome = 'unspecified', note = null, extra = {} } = {}) {
      if (!state.ok) return { ok: false, reason: '账本不可用' }
      const out = critical((led) => {
        let idx = -1
        for (let i = led.phases.length - 1; i >= 0; i--) {
          if (led.phases[i] && led.phases[i].open === true) {
            idx = i
            break
          }
        }
        if (idx < 0) return { ok: false, reason: '账本里没有未闭合的 phase（没有可闭合的对象）' }
        led.phases[idx] = {
          ...led.phases[idx],
          open: false,
          closedAt: now(),
          outcome,
          closeNote: note,
          totalsAtClose: { ...led.totals },
          ...extra,
        }
        return persist(led)
      })
      if (out.ok) state.phaseOpen = false
      return out
    },

    /**
     * 本任务累计账本里最近一次**业务失败**（指南 §0.4 末段：批次首次业务失败要记进持久账本，
     * 后续付费 phase 不得直接继续）。返回 null 表示没有未清的业务失败。
     *
     * 判定两路合并（从新往旧扫，先撞到哪条算哪条）：
     *   · `businessFailure: true` —— 现在的终结合并把标记写在同一条记录上（`ledger-finalize.mjs`）；
     *   · 已闭合条目里 `outcome` 是 `error`/`fail` —— 这是**给旧记录兜底**：2026-10-02 之前的实现
     *     先单独写失败屏障、再闭合，屏障那次写失败就会在盘上留下"闭着、说 error、却没有失败标记"
     *     的条目（复核实测）。只认标记字段的话，这类条目在新进程眼里等于"没失败过"。
     *   · `businessFailureCleared` —— 人工核对后的显式解除；它比它**更早**的失败记录更优先。
     */
    priorBusinessFailure() {
      const r = readLedgerFile(ledgerPath)
      const phases = (r.state === 'ok' ? r.ledger : state.ledger)?.phases || []
      for (let i = phases.length - 1; i >= 0; i--) {
        const p = phases[i]
        if (!p) continue
        if (p.businessFailure) return { at: p.at, phase: p.phase || null, note: p.note || '', via: 'marker' }
        if (p.open !== true && (p.outcome === 'error' || p.outcome === 'fail')) {
          return { at: p.at, phase: p.phase || null, note: p.closeNote || p.note || '', via: 'outcome' }
        }
        if (p.businessFailureCleared) return null
      }
      return null
    },

    /** 显式清除业务失败标记（修后针对性复验用；必须写明理由，留痕） */
    clearBusinessFailure(reason) {
      if (!state.ok) return { ok: false, reason: '账本不可用' }
      return critical((led) => {
        led.phases.push({ at: now(), businessFailureCleared: true, note: `业务失败标记解除：${reason}` })
        return persist(led)
      })
    },

    /** 供证据落盘的摘要 */
    summary() {
      return {
        ledgerPath,
        mirrorPath,
        fresh: state.fresh,
        persistFailures: state.persistFailures,
        mirrorFailures: state.mirrorFailures,
        mirrorFailureReasons: state.mirrorFailureReasons.slice(0, 5),
        lockFailures: state.lockFailures,
        refusals: state.refusals,
        phase: { ...state.phase },
        phaseMax: { ...state.phaseMax },
        /** 本进程是否已持久写下 phase 开始记录（false = 付费派发被拦） */
        phaseOpen: state.phaseOpen,
        requirePhaseOpen: state.requirePhaseOpen,
        /** 盘上是否还有未闭合的历史 phase（新进程据此先核对） */
        unresolvedPhase: api.unresolvedPhase(),
        budget: state.ledger ? { ...state.ledger.budget } : null,
        totals: state.ledger ? { ...state.ledger.totals } : null,
        remaining: api.remaining(),
      }
    },
  }
  return api
}
