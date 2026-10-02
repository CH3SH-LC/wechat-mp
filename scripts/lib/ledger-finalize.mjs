// ledger-finalize.mjs —— 验收账本「终结」的**唯一**生产实现（DS 修复指南 §0.0 C）
//
// 为什么单独成一个模块：这段顺序原来是 `live-acceptance.mjs::finalizeLedger()` 里的一串内联语句，
// 而它正是 2026-10-02 独立复核抓到的那个缺口的所在——
//
//   B1（业务失败屏障与 phase 关闭是**两次**写）：原实现先用 `recordPhase()` 单独写一条
//      `businessFailure` 记录，再 `closePhase()`。于是"屏障那次写失败、关闭那次写成功"是完全可能的：
//      盘上留下 `open:false, outcome:error` 却**没有** `businessFailure`，下一个进程读到
//      `unresolvedPhase=null` / `priorBusinessFailure=null`，照样开始新 phase 并预留额度。
//      复核用真实预算模块 + 真实 finalizeLedger 原文复现了这条（只把一次真实文件写入置为只读）。
//
//   B2（先闭合、后写证据）：原 `finalizeAndExit()` 先调 `finalizeLedger()`（把账本记成 PASS），
//      再去写 `report.md` 等必需证据。证据写失败时本次 `run-result.json` 确实是 ERROR/exit 1，
//      但**账本已经写着 pass**，下一进程同样放行。
//
// 修法两条，都落在本模块与调用顺序上：
//   1. **业务失败标记与 phase 终结合成同一次原子账本写**（`closePhase({..., extra:{businessFailure}})`，
//      `dispatch-budget` 的 `persist()` 是"写临时文件 + rename"，所以要么两者都在，要么两者都不在）。
//      写失败 = 盘上仍是**未闭合**——下一进程必须先核对，不需要依赖另一条可能失败的附加记录。
//   2. 调用方必须在**必需证据确认落盘之后**才调用本模块（见 `live-acceptance.mjs::finalizeAndExit`），
//      并消费返回的 `errors`：任何一条关键写失败都让本轮非 PASS。
//
// 本模块**不**碰证据文件、不打印、不退出——那三件事留在驱动侧，测试才能直接驱动这里。

/**
 * 收尾的**顺序**本身也是生产代码（指南 §0.0 C，复核反例 B2 的修法）。
 *
 * 顺序：① 必需证据先落盘 → ② 再把 phase 终结写进账本 → ③ 按最终判定重写一遍证据。
 * 为什么不能反过来（原实现）：先在账本上记成 pass，再去写 `report.md`；报告写失败时本次
 * `run-result.json` 确实是 ERROR/exit 1，**但账本已经写着 pass**——下一个进程读到"上一轮成功了"，
 * 直接继续花钱。把顺序抽成函数，是为了让回归能驱动**真实调用顺序**，而不是只做 closePhase 单测。
 *
 * @param persist  无参回调：落盘一遍必需证据，返回 `{ ok, run, errors }`（实现见驱动侧 persistOnce）
 * @param finalize 无参回调：把 phase 终结写进账本（实现见 `finalizePhase` 与驱动侧的 finalizeLedger）
 * @returns {{ first, ledger, final }}
 */
export function runFinalizeSequence({ persist, finalize }) {
  const first = persist()
  const ledger = finalize()
  const final = persist()
  return { first, ledger, final }
}

/**
 * 判定本 phase 的终局，并把它**一次原子写**进账本。
 *
 * @param budget        `dispatch-budget.mjs` 的写者实例（生产用默认 `requirePhaseOpen:true`）
 * @param phase         phase 名（L1..L6）
 * @param blockedReason 非空表示本 phase 是 BLOCKED（缺依赖/连不上应用等）
 * @param failedChecks  `{ id }[]`：未通过的业务检查
 * @param errorCount    `run.errors.length`（含落盘阶段新产生的错误）
 * @param checks        `{ passed, total }`：只用于写人看的 note
 * @param note          （可选）覆盖默认 note
 * @returns {{
 *   ok: boolean,                // 账本收尾是否干净：无关键写失败、且（需要闭合时）确实闭合了
 *   outcome: 'pass'|'fail'|'error'|'blocked',
 *   hasFailure: boolean,        // 本轮是否属于"业务失败/关键失败"（必须留痕给下一个进程）
 *   closed: boolean|null,       // true=已闭合；false=该闭合但写失败（盘上仍未闭合）；null=本来就没有可闭合的对象
 *   failurePersisted: boolean,  // 业务失败标记是否已持久（闭合或独立记录落盘成功）
 *   errors: string[],           // 调用方必须据此 `fail('budget', …)`
 *   persistFailures: number,    // 本次运行累计的关键写失败次数
 *   lockFailures: number,
 *   mirrorFailures: number,
 *   mirrorFailureReasons: string[],
 *   unresolvedAfter: object|null, // 收尾后账本里是否还有未闭合 phase（正常情况下应为 null）
 * }}
 */
export function finalizePhase({
  budget,
  phase,
  blockedReason = null,
  failedChecks = [],
  errorCount = 0,
  checks = { passed: 0, total: 0 },
  note = null,
  extra = {},
} = {}) {
  const errors = []
  const failedIds = failedChecks.map((c) => (c && c.id !== undefined ? c.id : String(c))).slice(0, 12)
  const hasFailure = failedChecks.length > 0 || errorCount > 0
  // ⚠️ 这里**不能**用驱动侧的 `run.status`：它在写完判定文件之后才定型，而本模块在它之前跑
  // （实测写出来的 outcome 与 note 自相矛盾过一次）。终局只由"有没有阻断原因 / 错误 / 失败检查"推。
  const outcome = blockedReason ? 'blocked' : errorCount ? 'error' : failedChecks.length ? 'fail' : 'pass'
  const state = budget && budget.state ? budget.state : {}
  const base = {
    ok: true,
    outcome,
    hasFailure,
    closed: null,
    failurePersisted: !hasFailure, // 没有失败就无需留痕，视为已满足
    errors,
    persistFailures: 0,
    lockFailures: 0,
    mirrorFailures: 0,
    mirrorFailureReasons: [],
    unresolvedAfter: null,
  }
  if (!budget) return base

  const defaultNote =
    `${phase} 结束：${outcome}（检查 ${checks.passed}/${checks.total}，错误 ${errorCount}）` +
    (hasFailure ? `；业务失败屏障：${failedChecks.length} 条检查未通过、${errorCount} 条错误` : '')

  if (state.phaseOpen) {
    // ① 有在途记录 → 闭合它，**并且**（有失败时）把业务失败标记放进**同一次**写入。
    const closed = budget.closePhase({
      outcome,
      note: note || defaultNote,
      extra: {
        phase,
        outcome,
        blockedReason: blockedReason ? String(blockedReason).slice(0, 300) : null,
        ...(hasFailure ? { businessFailure: true, failedChecks: failedIds } : {}),
        ...extra,
      },
    })
    base.closed = closed.ok === true
    // 闭合成功 = 同一次写入里的业务失败标记（如果有）也落盘了；没有失败时本来就没有标记要落。
    base.failurePersisted = closed.ok === true || !hasFailure
    if (!closed.ok) {
      errors.push(
        `phase 终结记录没有落盘（${closed.reason}）——业务失败标记与终结是**同一次写入**，` +
          `所以这一轮在盘上仍是未闭合；下一个进程会先把这一轮当成"没跑完"要求核对`,
      )
    }
  } else if (hasFailure) {
    // ② 没有可闭合的对象（例如连 `beginPhase` 之前就 BLOCKED 了，这一轮也**没有**任何派发）：
    // 只能单独记一条屏障。它同样是必需写入，写不成就必须让本轮非 PASS。
    const rec = budget.recordPhase({
      dispatches: 0,
      genSvg: 0,
      note: note || defaultNote,
      extra: { phase, businessFailure: true, failedChecks: failedIds },
    })
    base.closed = null
    base.failurePersisted = rec.ok === true
    if (!rec.ok) errors.push(`业务失败屏障没有落盘（${rec.reason}）——后续付费 phase 会以为可以继续`)
  }

  base.persistFailures = Number(state.persistFailures) || 0
  base.lockFailures = Number(state.lockFailures) || 0
  base.mirrorFailures = Number(state.mirrorFailures) || 0
  base.mirrorFailureReasons = Array.isArray(state.mirrorFailureReasons) ? state.mirrorFailureReasons.slice(0, 5) : []
  // 关键账本写失败必须上抛：只在内存里记着"写失败过"而判定照样通过，等于账实不符可以被签收。
  if (base.persistFailures > 0) {
    errors.push(`本次运行有 ${base.persistFailures} 次关键账本写失败（落盘/重读）——额度可能没有被记下，本次不能算通过`)
  }
  if (base.lockFailures > 0) errors.push(`本次运行有 ${base.lockFailures} 次未能取得账本锁——拒绝在无锁状态下读写额度`)
  base.ok = errors.length === 0
  base.unresolvedAfter = typeof budget.unresolvedPhase === 'function' ? budget.unresolvedPhase() : null
  return base
}

/**
 * 「下一个进程必须拒绝直接继续」的门槛 —— 把驱动启动阶段的**两道历史检查**抽成同一个函数，
 * 免得两处各写一遍（写歪一处就漏一处）。顺序与 `live-acceptance.mjs::main()` 一致：
 *   1. 账本里还有未闭合 phase（上一次没写下终结证据）→ 未经显式核对不许开新的；
 *   2. 还有未解除的业务失败标记 → 后续付费 phase 不许直接继续。
 *
 * @param budget   预算写者（已 open）
 * @param needsPaid 本 phase 是否真的会派发（L5/L6 传 false：它们零模型，可以继续跑核对）
 * @returns {{ block: string|null, unresolved: object|null, priorFailure: object|null }}
 */
export function preflightLedgerGate({ budget, needsPaid = true }) {
  const unresolved = typeof budget.unresolvedPhase === 'function' ? budget.unresolvedPhase() : null
  if (unresolved) {
    return {
      block:
        `累计账本里还有**未闭合**的 phase（${unresolved.phase || '?'}，起于 ${unresolved.at}` +
        `${unresolved.count > 1 ? `，共 ${unresolved.count} 条` : ''}）——说明上一次运行没有写下终结证据` +
        `（业务失败记录也可能同样没写成）。核对那一次到底派发了什么之后，请显式传 ` +
        `--resume-after-fix "<理由>" 闭合它；不自动视为成功。`,
      unresolved,
      priorFailure: null,
    }
  }
  const priorFailure = typeof budget.priorBusinessFailure === 'function' ? budget.priorBusinessFailure() : null
  if (priorFailure && needsPaid) {
    return {
      block:
        `累计账本里还有未解除的业务失败（${priorFailure.at}，${priorFailure.phase || ''}：${priorFailure.note}）——` +
        `后续付费 phase 不得直接继续。修好后针对性复验请显式传 --resume-after-fix "<理由>"；` +
        `该命令会解除标记并把理由写进账本（仍属本次授权，不额外扩容）。`,
      unresolved: null,
      priorFailure,
    }
  }
  return { block: null, unresolved: null, priorFailure }
}
