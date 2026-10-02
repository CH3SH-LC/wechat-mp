// trace-read.mjs —— 真机验收里的"请求证据读取 + 派发数核对"（DS 修复指南 §0.4 第 2 条）
//
// 抽出来的理由：这段逻辑原来长在 `live-acceptance.mjs` 里，而那脚本要连真机、要花真钱，
// 离线回归够不着。审计实测到两个**真**问题：
//   ① `traceRecordsSince()` 在"没有 traces 目录"的早退分支里**漏了 `requests` 字段**，
//      调用方 `.requests.length` 直接抛 TypeError——一次"证据看不见"被放大成"脚本崩了"，
//      而且崩在记账之前；
//   ② "看不见"与"没有请求"混为一谈：两者都会被读成 0，于是"费用未知"会被静默记成"零花费"。
// 现在两者都返回同一个结构，并用 `observable` 明确区分：不可观察时计数**不可信**。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 读 `<workspace>/traces/*.jsonl` 里 `sinceMs` 之后的回合日志。
 *
 * 返回结构**永远一致**：`{ records, requests, files, badLines, observable, dirExists, note }`。
 *   · `observable=true`  → 目录在、文件都读得出来、日志都解析得出来：`requests` 是可信计数；
 *   · `observable=false` → 目录不存在 / 有文件读不出来 / 有行解析不了：计数不可信，
 *     调用方必须按 UNKNOWN 处理。
 */
export function readTraceRecords(workspace, sinceMs) {
  const dir = join(workspace, 'traces')
  const out = []
  const files = []
  const badLines = []
  let names = []
  try {
    names = readdirSync(dir)
  } catch (e) {
    return {
      records: [],
      requests: [],
      files: [],
      badLines: [],
      observable: false,
      dirExists: false,
      note: `traces 目录不存在（${dir}）：${String((e && e.code) || e)}——本轮无法从 trace 观察请求数`,
    }
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
    let text = null
    try {
      text = readFileSync(p, 'utf8')
    } catch (e) {
      badLines.push({ file: n, reason: `读不出来：${String((e && e.message) || e)}` })
      continue
    }
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) continue
      let r
      try {
        r = JSON.parse(t)
      } catch {
        badLines.push({ file: n, reason: '不是合法 JSON 行' })
        continue
      }
      r.__file = n
      out.push(r)
    }
  }
  const requests = out.filter((r) => r.kind === 'request' && typeof r.startedAt === 'number' && r.startedAt >= sinceMs - 3000)
  requests.sort((a, b) => a.startedAt - b.startedAt)
  const observable = badLines.length === 0
  const note = observable ? '' : `有 ${badLines.length} 处 trace 内容读不出来或解析不了`
  return { records: out, requests, files, badLines, observable, dirExists: true, note }
}

/** 把 trace 记录压成脱敏的请求摘要（结构字段，不含请求正文与密钥） */
export function summarizeRequests(requests) {
  return requests.map((r, i) => ({
    localRequestId: `r${i + 1}`,
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
  }))
}

/**
 * 派发证据核对（纯函数，便于离线回归）。
 *
 * 三件事各自记账、两两核对（指南 §0.3 / §0.4）：
 *   · 门禁**放行**了几次（`reserved`，宿主侧预算决定的）；
 *   · 页面探针观测到**真的发出去**几次（`transport`）；
 *   · trace 里**实际请求**了几条（`traceRequests`，只有 `traceObservable` 为真时才可信）。
 *
 * 判据：
 *   · trace 出现但门禁没放行 → `bypass`（有派发绕过了派发前预算，最严重）；
 *   · trace 不可观察而门禁放行过 → `unobservable`（费用只能记 UNKNOWN）；
 *   · 门禁放行数与实际传输数不一致 → `transportMismatch`。
 */
export function compareDispatchEvidence({ reserved, reservedGenSvg, transport, genSvgTransport, traceRequests, traceGenSvg, traceObservable }) {
  const problems = []
  if (traceObservable && traceRequests > reserved) {
    problems.push({
      code: 'bypass',
      message: `trace 记到 ${traceRequests} 次真实请求，但门禁只放行 ${reserved} 次——有派发绕过了派发前预算`,
    })
  }
  // 少记同样不许通过（2026-10-02 复核 R3）：原来只拦"trace 多于预留"，于是
  // `reserved=2, transport=2, trace=0` 这种"两次请求没留下任何请求证据"被读成 ok——
  // 费用与请求 ID 都无从核对，只能记 UNKNOWN，绝不是"一致"。
  if (traceObservable && traceRequests < reserved) {
    problems.push({
      code: 'missing',
      message: `门禁放行 ${reserved} 次，trace 只记到 ${traceRequests} 次——有派发没有留下请求证据，本轮费用只能记 UNKNOWN`,
    })
  }
  // 绘图类别单独核：`reservedGenSvg=0` 却出现 `traceGenSvg=1` 正是"绘图预算被绕过"的证据，
  // 旧的核对只在"预留与 trace 总数都为 1"时看总数，会把它放过去。
  if (traceObservable && traceGenSvg !== reservedGenSvg) {
    problems.push({
      code: 'genSvgMismatch',
      message: `绘图类别 trace=${traceGenSvg}，门禁放行绘图=${reservedGenSvg}——绘图派发与预留对不上`,
    })
  }
  if (!traceObservable && reserved > 0) {
    problems.push({
      code: 'unobservable',
      message: `门禁放行 ${reserved} 次，但 trace 不可观察：本轮费用只能记 UNKNOWN，不能按 0 记账`,
    })
  }
  if (typeof transport === 'number' && transport !== reserved) {
    problems.push({
      code: 'transportMismatch',
      message: `门禁放行 ${reserved} 次，页面探针观测到实际传输 ${transport} 次——两套口径不一致`,
    })
  }
  if (typeof genSvgTransport === 'number' && genSvgTransport !== reservedGenSvg) {
    problems.push({
      code: 'transportMismatch',
      message: `门禁放行绘图 ${reservedGenSvg} 次，实际传输 ${genSvgTransport} 次`,
    })
  }
  return {
    ok: problems.length === 0,
    problems,
    /** 保守记账：宁可高估花费，不可低估 */
    countedDispatches: Math.max(reserved, traceObservable ? traceRequests : 0),
    countedGenSvg: Math.max(reservedGenSvg, traceObservable ? traceGenSvg : 0),
  }
}

/**
 * "关停失败就不得在同一个 profile 上再开第二个实例"（指南 §0.4 第 4 条）的判定。
 * 只有**观测到进程消失**且**不是强杀**，才算"正常关闭"，重开才有意义。
 */
export function canReopenAfterClose(closeResult) {
  if (!closeResult) return { ok: false, reason: '没有关闭结果' }
  if (closeResult.closed !== true) return { ok: false, reason: `进程没有退出（${JSON.stringify(closeResult)}）` }
  if (closeResult.forced === true) return { ok: false, reason: `是强杀退出（via=${closeResult.via}），不是走应用自身退出路径，不能算正常重开` }
  // "我请求关闭之前它就已经不在了"证明不了任何事：可能是崩溃、可能被别的进程带走，
  // 也可能根本不是这一轮启动的那个进程。它不是"正常退出"，不能当重开的前提（2026-10-02 复核 R3）。
  if (closeResult.via === 'already-exited' || closeResult.exitedBeforeRequest === true) {
    return { ok: false, reason: '进程在请求关闭之前就已退出（via=already-exited）——无法证明走的是应用自身退出路径，不能算正常关闭' }
  }
  if (closeResult.identityMismatch === true) {
    return { ok: false, reason: '关闭前的进程身份与启动时不一致（PID 可能已被回收）——不能算正常关闭' }
  }
  return { ok: true, reason: '' }
}
