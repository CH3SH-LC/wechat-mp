// live-driver-check.mjs —— 真机验收驱动器里**与浏览器无关**的那部分（DS 修复指南 §0.4）
//
// 为什么单独做：`live-acceptance.mjs` 要连真机、要花真钱，所以它自己的错一直没人验得出来。
// 这里把它里面**纯逻辑**的那几段（trace 证据读取、派发数核对、"能不能重开"的判定）抽到
// `scripts/lib/trace-read.mjs`，再用替身目录/替身结果逐条钉住。测的是**生产模块本身**，
// 不是复制一份实现。
//
// 覆盖指南 §0.4 点名的两条：
//   · "无 traces 目录时漏 `requests` 字段 → 调用方 TypeError"——必须不抛、且不能被读成"零请求"；
//   · "关闭失败仍启动第二个实例"——必须拒绝。
// 另加派发数三方核对（门禁放行 / 页面探针实际传输 / trace 真实请求）。
//
// 全离线：不联网、不调模型、不启浏览器、不写真实工作区。

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { canReopenAfterClose, compareDispatchEvidence, readTraceRecords } from './lib/trace-read.mjs'

const judge = createJudge({
  script: 'live-driver-check',
  outDir: resolveOutDir('live-driver-check'),
  plannedCases: ['①', '②', '③', '④', '⑤', '⑥'],
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}

const root = mkdtempSync(join(tmpdir(), 'wxmp-driver-check-'))

console.log('\n[① 没有 traces 目录：不抛异常，也不读成"零请求"]')
{
  const ws = join(root, 'ws-missing-traces')
  mkdirSync(ws, { recursive: true })
  let threw = null
  let info = null
  try {
    info = readTraceRecords(ws, 0)
    // 旧实现就是在这里漏了 requests，调用方下面这行会 TypeError
    void info.requests.length
  } catch (e) {
    threw = String((e && e.message) || e)
  }
  check('① 目录不存在时读取**不抛异常**（旧实现漏 `requests` 字段，`.length` 直接 TypeError）', threw === null, threw || '')
  check('① 返回结构与其他分支一致（七个字段都在）', info !== null && ['records', 'requests', 'files', 'badLines', 'observable', 'dirExists', 'note'].every((k) => k in info), JSON.stringify(Object.keys(info || {})))
  check('① 明确标为**不可观察**（不是"已检查且零请求"）', info && info.observable === false && info.dirExists === false, JSON.stringify({ observable: info && info.observable, dirExists: info && info.dirExists }))
  check('① 说明里写清是哪个目录：调用方能据此报 UNKNOWN 而不是 0', Boolean(info && info.note && info.note.includes('traces')), info ? info.note : '')
}

console.log('\n[② 空目录 / 坏行：区分"确实零请求"与"读不出来"]')
{
  const wsEmpty = join(root, 'ws-empty-traces')
  mkdirSync(join(wsEmpty, 'traces'), { recursive: true })
  const empty = readTraceRecords(wsEmpty, 0)
  check('② 目录在、没有日志文件 → 可观察且 0 请求（这是"确实没有请求"）', empty.observable === true && empty.requests.length === 0, JSON.stringify({ observable: empty.observable, n: empty.requests.length }))

  const wsBad = join(root, 'ws-bad-traces')
  mkdirSync(join(wsBad, 'traces'), { recursive: true })
  writeFileSync(join(wsBad, 'traces', 's1.jsonl'), '{"kind":"request","startedAt":1,"phase":"prep"}\n这不是 JSON\n', 'utf8')
  const bad = readTraceRecords(wsBad, 0)
  check('② 有解析不了的行 → 标为不可观察（不能拿残缺证据当可信计数）', bad.observable === false, JSON.stringify({ observable: bad.observable, badLines: bad.badLines.length }))
  check('② 坏行单独报出来（便于区分"日志坏了"和"真的没请求"）', bad.badLines.length === 1 && bad.dirExists === true, JSON.stringify(bad.badLines))
  check('② 不抛异常（读坏行也要走同一条返回路径）', Array.isArray(bad.requests), '')
}

console.log('\n[③ 有真实记录：按时间排序、只认 since 之后的 request]')
{
  const ws = join(root, 'ws-real-traces')
  mkdirSync(join(ws, 'traces'), { recursive: true })
  const recs = [
    { kind: 'request', startedAt: 5000, phase: 'prep', ok: true },
    { kind: 'request', startedAt: 9000, phase: 'gen_svg', ok: true },
    { kind: 'request', startedAt: 100, phase: 'prep', ok: true }, // since 之前
    { kind: 'note', startedAt: 7000 }, // 不是 request
  ]
  writeFileSync(join(ws, 'traces', 's2.jsonl'), recs.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  const info = readTraceRecords(ws, 4000)
  check('③ 只取 since 之后的 request，且按 startedAt 升序', info.requests.length === 2 && info.requests[0].phase === 'prep' && info.requests[1].phase === 'gen_svg', JSON.stringify(info.requests.map((r) => [r.phase, r.startedAt])))
  check('③ 可观察为真', info.observable === true, '')
  check('③ 非 request 记录仍保留在 records 里（供人工核对）', info.records.length === 4, `records=${info.records.length}`)
}

console.log('\n[④ 派发数三方核对 + 关停可否重开]')
{
  const ok = compareDispatchEvidence({ reserved: 2, reservedGenSvg: 1, transport: 2, genSvgTransport: 1, traceRequests: 2, traceGenSvg: 1, traceObservable: true })
  check('④ 三方一致 → 通过', ok.ok, JSON.stringify(ok.problems))

  const bypass = compareDispatchEvidence({ reserved: 1, reservedGenSvg: 0, transport: 1, genSvgTransport: 0, traceRequests: 3, traceGenSvg: 0, traceObservable: true })
  check('④ trace 比门禁多 → 判"绕过派发前预算"', !bypass.ok && bypass.problems.some((p) => p.code === 'bypass'), JSON.stringify(bypass.problems))

  const unobservable = compareDispatchEvidence({ reserved: 2, reservedGenSvg: 0, transport: 2, genSvgTransport: 0, traceRequests: 0, traceGenSvg: 0, traceObservable: false })
  check('④ trace 不可观察但放行过 → 判"费用只能记 UNKNOWN"', !unobservable.ok && unobservable.problems.some((p) => p.code === 'unobservable'), JSON.stringify(unobservable.problems))
  check('④ 不可观察时不会把费用记成 0（保守取门禁放行数）', unobservable.countedDispatches === 2, `counted=${unobservable.countedDispatches}`)

  const mismatch = compareDispatchEvidence({ reserved: 2, reservedGenSvg: 0, transport: 1, genSvgTransport: 0, traceRequests: 2, traceGenSvg: 0, traceObservable: true })
  check('④ 门禁放行数与页面探针实际传输不一致 → 报不一致', !mismatch.ok && mismatch.problems.some((p) => p.code === 'transportMismatch'), JSON.stringify(mismatch.problems))

  const zeroReserved = compareDispatchEvidence({ reserved: 0, reservedGenSvg: 0, transport: 0, genSvgTransport: 0, traceRequests: 0, traceGenSvg: 0, traceObservable: false })
  check('④ 零派发且看不到 trace → 这是**一致**的（L5/L6 场景），不算缺口', zeroReserved.ok, JSON.stringify(zeroReserved.problems))

  // 关停
  check('④ 观测到进程退出且非强杀 → 可以重开', canReopenAfterClose({ closed: true, forced: false, via: 'wm-close' }).ok === true)
  const forcedRes = canReopenAfterClose({ closed: true, forced: true, via: 'taskkill-force' })
  check('④ 强杀退出 → 不算正常关闭，不得重开', forcedRes.ok === false && forcedRes.reason.includes('强杀'), forcedRes.reason)
  const aliveRes = canReopenAfterClose({ closed: false, forced: true, via: 'taskkill-force' })
  check('④ 进程还活着 → 不得重开（否则同 profile 两个实例）', aliveRes.ok === false && aliveRes.reason.includes('没有退出'), aliveRes.reason)
  check('④ 没有关闭结果 → 不得重开', canReopenAfterClose(null).ok === false)
}

console.log('\n[⑤ 2026-10-02 复核新增反例：少记 / 绘图类别 / 非正常退出路径]')
{
  // (a) trace 少记：门禁放行 2、页面确实传了 2，但 trace 一条都没有 → 旧实现读成 ok
  const missing = compareDispatchEvidence({ reserved: 2, reservedGenSvg: 0, transport: 2, genSvgTransport: 0, traceRequests: 0, traceGenSvg: 0, traceObservable: true })
  check('⑤ 门禁放行 2 次、trace 只记到 0 条 → 判"少记"（费用只能记 UNKNOWN，不是一致）', !missing.ok && missing.problems.some((p) => p.code === 'missing'), JSON.stringify(missing.problems))

  // (b) 绘图预算绕过：预留绘图 0，trace 里却有 1 次绘图 → 旧实现的总数相等就放过了
  const genGap = compareDispatchEvidence({ reserved: 1, reservedGenSvg: 0, transport: 1, genSvgTransport: 1, traceRequests: 1, traceGenSvg: 1, traceObservable: true })
  check('⑤ 绘图预留 0 但 trace 有 1 次绘图 → 判"绘图类别不符"（总数相等也拦得住）', !genGap.ok && genGap.problems.some((p) => p.code === 'genSvgMismatch'), JSON.stringify(genGap.problems))

  // (c) 对照：绘图预留 1、trace 绘图 1、总数一致 → 仍然通过（不是把正常路径判红）
  const drawOk = compareDispatchEvidence({ reserved: 2, reservedGenSvg: 1, transport: 2, genSvgTransport: 1, traceRequests: 2, traceGenSvg: 1, traceObservable: true })
  check('⑤ 对照：绘图预留与 trace 绘图一致时仍然通过', drawOk.ok, JSON.stringify(drawOk.problems))

  // (d) trace 不可观察时不拿"恰好 0"当通过
  const unobsZero = compareDispatchEvidence({ reserved: 0, reservedGenSvg: 0, transport: 0, genSvgTransport: 0, traceRequests: 0, traceGenSvg: 0, traceObservable: false })
  check('⑤ 对照：真实零派发 + trace 不可观察 → 无缺口（这是 L5/L6 的合法组合）', unobsZero.ok, JSON.stringify(unobsZero.problems))

  // (e) "请求关闭之前进程就已经不在"不是正常退出路径
  const alreadyGone = canReopenAfterClose({ closed: true, forced: false, via: 'already-exited', exitedBeforeRequest: true })
  check('⑤ 进程在收到关闭请求前就已退出 → 不得算正常关闭、不得重开', alreadyGone.ok === false && /already-exited/.test(alreadyGone.reason), alreadyGone.reason)
  const idBad = canReopenAfterClose({ closed: true, forced: false, via: 'wm-close', identityMismatch: true })
  check('⑤ 关闭前身份核验不一致 → 不得算正常关闭', idBad.ok === false, idBad.reason)
}

// ── ⑥ 结构断言：上面 (a)(b) 证明的是**纯函数**；但真正会犯的错在 live-acceptance 的**接线**上
// （把总传输量当成绘图传输量、用了不存在的 `page`、关闭失败却标成已关闭）。这些接线要连真机才跑得到，
// 所以这里对**生产脚本源码**做定点断言——它抓不住"逻辑写错"，但能抓住"又改回旧写法"这一类回归。
// 明确标注：这是结构断言，不是行为断言；行为部分由 ①–⑤ 的纯函数用例覆盖。
console.log('\n[⑥ 结构断言：live-acceptance 的关键接线不得改回旧写法]')
{
  const driverPath = resolve(dirname(fileURLToPath(import.meta.url)), 'live-acceptance.mjs')
  const src = readFileSync(driverPath, 'utf8')
  const has = (re) => re.test(src)
  // 探针源码 2026-10-02 移到了 `scripts/lib/ipc-gate.mjs`（它由 `ipc-gate-check.mjs` 用真实协议
  // 源码逐条验收），所以"按 kind 单独计绘图传输"这条要在这两份文件里合起来看。
  const gateSrc = readFileSync(resolve(dirname(driverPath), 'lib', 'ipc-gate.mjs'), 'utf8')
  const hasAny = (re) => re.test(src) || re.test(gateSrc)
  // 账本收尾（未闭合门槛 / 终结顺序 / 失败屏障）2026-10-02 也移到了 `scripts/lib/ledger-finalize.mjs`，
  // 由 `ledger-finalize-check.mjs` 用真实预算模块 + 真新子进程逐条验收。这里同样两份合起来看：
  // 驱动必须**接住**那个模块，行为本身不再在本文件里断言。
  const finSrc = readFileSync(resolve(dirname(driverPath), 'lib', 'ledger-finalize.mjs'), 'utf8')

  check(
    '⑥ reconcile 把绘图传输量接成 `turn.transportDrawAfter`（不是总 transportAfter）',
    has(/genSvgTransport:\s*turn\.transportDrawAfter/) && !has(/genSvgTransport:\s*turn\.transportAfter/),
    '期望出现 `genSvgTransport: turn.transportDrawAfter`，且不出现 `genSvgTransport: turn.transportAfter`',
  )
  check(
    '⑥ 绘图传输量由探针按预留返回的 kind 单独计数',
    hasAny(/if \(r\.kind === "draw"\) probe\.transportDraw \+= 1/) && has(/transportDrawBefore/) && has(/turn\.transportDrawAfter = \(after\.transportDraw/),
    '探针 transportDraw 计数 + sendTurn 的 before/after 差值',
  )
  // 只看 runL3 函数体：`sendTurn` / `snapshot` 里的 `page.evaluate` 是**有 page 参数**的合法用法，
  // 全局负向匹配会把它们一起误伤。判据是"函数体里出现了裸 `page.evaluate`（前面不是点号）"。
  const l3Start = src.indexOf('async function runL3(')
  const l3End = src.indexOf('// ---------- L5 ----------')
  const l3Body = l3Start >= 0 && l3End > l3Start ? src.slice(l3Start, l3End) : ''
  check(
    '⑥ runL3 不再引用未定义的 `page`（必须从 app 取页面）',
    l3Body.length > 0 && /app\.page\.evaluate\(/.test(l3Body) && !/(?<![.\w])page\.evaluate\(/.test(l3Body),
    `runL3 函数体长度=${l3Body.length}；app.page.evaluate=${/app\.page\.evaluate\(/.test(l3Body)}；裸 page.evaluate=${/(?<![.\w])page\.evaluate\(/.test(l3Body)}`,
  )
  check(
    '⑥ 关闭结果必须按 `closed === true` 记账（不再无条件标已关闭）',
    has(/mine\.closed = r\.closed === true/) && !has(/mine\.closed = true\n/),
    'close 闭包与 finally 都用 `r.closed === true`',
  )
  const recCalls = (src.match(/\.recordPhase\(/g) || []).length
  const recAssigned = (src.match(/=\s*[\w$.]*\.recordPhase\(/g) || []).length
  check('⑥ 每一次 recordPhase 调用都赋给变量（返回值必须被检查，不能白调）', recCalls > 0 && recCalls === recAssigned, `调用=${recCalls}，赋值=${recAssigned}`)
  check(
    '⑥ 没有"无成功版就退回失败版"的旧基准语义（latestBaseline 无 ok 记录时返回 null）',
    /一条 ok 都没有/.test(src) && /没有\*\*"最后成功版本"/.test(src) && /return null\s*\}/.test(src),
    'latestBaseline 末尾返回 null（不再返回时间上最后一条失败记录）',
  )
  check(
    '⑥ L5/L6 都要求基准是成功版本（prev.ok === true）',
    (src.match(/prev\.ok !== true/g) || []).length >= 2,
    `prev.ok 守卫出现 ${(src.match(/prev\.ok !== true/g) || []).length} 次`,
  )
  check(
    '⑥ 三个回合的 trace 都经"落盘后等一拍再读"（避免把落盘延迟误判成少记）',
    (src.match(/await tracesAfterTurn\(app\.page, ctx\.iso\.workspace, t0\)/g) || []).length === 3 &&
      /async function tracesAfterTurn\(/.test(src),
    `tracesAfterTurn 调用点=${(src.match(/await tracesAfterTurn\(/g) || []).length}`,
  )
  // ── 2026-10-02 晚间复核后新增：IPC 门禁与失败屏障的**接线**（§0.0 A / C）
  check(
    '⑥ 预算显式开启 phase 屏障（requirePhaseOpen: true），付费派发前先持久记录在途状态',
    /requirePhaseOpen: true/.test(src) && /budget\.beginPhase\(/.test(src) && /const began = budget\.beginPhase\(/.test(src) && /if \(!began\.ok\)/.test(src),
    '需要 `requirePhaseOpen: true` + 检查 beginPhase 返回值',
  )
  check(
    '⑥ 启动时先读未闭合 phase，未闭合且无 --resume-after-fix 就 BLOCKED',
    has(/preflightLedgerGate\(\{ budget, needsPaid \}\)/) && has(/budget\.resolveUnresolved\(String\(RESUME_REASON\)\)/) && /未闭合/.test(finSrc),
    '门槛在 lib/ledger-finalize.mjs，驱动必须调用它',
  )
  check(
    '⑥ 收尾必须闭合 phase 且检查返回值（写不成 = 下一个进程会当成没跑完）',
    has(/finalizePhase\(\{/) && has(/for \(const e of res\.errors\) fail\('budget', e\)/) &&
      /state\.phaseOpen/.test(finSrc) && /budget\.closePhase\(\{/.test(finSrc) && /if \(!closed\.ok\)/.test(finSrc),
    '闭合与返回值检查在 lib/ledger-finalize.mjs，驱动必须消费它返回的错误',
  )
  check(
    '⑥ 收尾顺序：必需证据先落盘，之后才闭合账本（复核反例 B2：反过来会把失败的账本留成 pass）',
    has(/runFinalizeSequence\(\{ persist: persistOnce, finalize: finalizeLedger \}\)/) && !/^\s*finalizeLedger\(\)\s*$/m.test(src),
    '顺序由 lib/ledger-finalize.mjs::runFinalizeSequence 驱动',
  )
  check(
    '⑥ 业务失败屏障与 phase 终结合并成**同一次**账本写（复核反例 B1）',
    /businessFailure: true, failedChecks: failedIds/.test(finSrc) && !has(/extra: \{ phase, businessFailure: true/),
    '屏障不再是驱动侧单独的一次 recordPhase',
  )
  check(
    '⑥ 关闭自有进程时传**本轮启动身份**，不是只传 exe 名称（§0.0 B）',
    /closeOwnPid\(mine\.pid, \{ exe, expectedIdentity: mine\.identity \}\)/.test(src) &&
      /closeOwnPid\(h\.pid, \{ exe, expectedIdentity: h\.identity \}\)/.test(src),
    'Phase 与 finally 两处都要带 expectedIdentity',
  )
  check(
    '⑥ 启动核对要求进程身份字段齐备（缺字段就关不干净，宁可不跑）',
    /ident\.identityComplete === true/.test(src),
    '',
  )
}

// 故意**不**清理临时目录：`fs.rmSync(p, {force:true})` 在本机（node v24.13.0 / Windows）
// 对某些路径会让进程**原生中止**（exit 3221226505），一次"清理"能把整份判定带走。
// 这些目录都在系统临时区，留着比冒着崩掉的风险删更划算。
judge.observe('替身目录', `${root}（系统临时区，未自动清理：见文件末尾说明）`)
console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'LIVE-DRIVER' })
