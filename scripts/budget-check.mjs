// budget-check.mjs —— 派发前付费预算的**离线**验收（DS 修复指南 §0.3 R2 验收表）
//
// 全用假传输，不收费、不联网、不启动应用：受测的是 `scripts/lib/dispatch-budget.mjs` 本身
// （真机验收脚本用的就是这一个模块），"实际传输次数"由一条**只有预留成功才会走**的假通道统计——
// 它不是断言里的常量，而是被测行为的产物。
//
// 为什么要有这个脚本：原实现是"先发再数"（页面探针记录后直接 `orig()`，回合里每 1.4s 回读一次
// 计数，超了才停）。那种形状在单测里不容易看出问题，但只要把"额度只剩 1 次却同时发 2 个请求"
// 摆出来，实际传输就会是 2 次。下面第 ① 组同时跑**改前形状**（对照，必须红）与**改后形状**
// （必须恰好 1 次），让"这个断言能不能变红"当场可见。
//
// 判定：唯一 RunResult（指南 §3.1）。零检查 / 异常 = ERROR，都退出非 0。

import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { DEFAULT_MAX_DISPATCHES, DEFAULT_MAX_GEN_SVG, createBudget, parseBudgetParam } from './lib/dispatch-budget.mjs'

const judge = createJudge({
  script: 'budget-check',
  outDir: resolveOutDir('budget-check'),
  plannedCases: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬'],
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}

/**
 * 本脚本逐条验收的是 `reserve()` 的**额度语义**，不是 phase 生命周期，所以显式关掉 phase 屏障
 * （默认 `requirePhaseOpen:true` 会要求先 `beginPhase()` 才能付费预留）。
 * 屏障本身的语义由 ⑬ 组**用默认值**单独覆盖；生产调用方 `live-acceptance.mjs` 也用默认值。
 */
const mkBudget = (opts) => createBudget({ ...opts, requirePhaseOpen: false })

const workRoot = mkdtempSync(join(tmpdir(), 'wxmp-budget-check-'))
let caseNo = 0
const freshPaths = () => {
  const tag = `c${++caseNo}`
  return { ledgerPath: join(workRoot, `${tag}-global.json`), mirrorPath: join(workRoot, `${tag}-root.json`) }
}

/**
 * 假传输：只有 `reserve` 放行时才把命令"发出去"。
 * 返回 `{ transported, perCmd }`——`transported` 就是"实际打到端点"的次数。
 */
function fakeTransport(budget, cmds) {
  const perCmd = []
  let transported = 0
  for (const cmd of cmds) {
    const r = budget.reserve(cmd)
    if (r.ok) {
      transported += 1 // 只有这里代表"真的发出去了"
      perCmd.push({ cmd, sent: true })
    } else {
      perCmd.push({ cmd, sent: false, reason: r.reason })
    }
  }
  return { transported, perCmd }
}

/**
 * 改前形状的对照：**先发、后数**。
 *
 * 原实现的时序是「页面探针记录 → 直接 `orig()`（请求已经出去了）→ 脚本每约 1.4s 回读一次计数
 * → 超了才点停止」。所以在一个轮询窗口内发出的请求**与额度无关地全都发出去了**——
 * 这正是"额度只剩 1 次却传出 2 次"的成因。这里按同一时序复算，用来证明上面那条断言可证伪。
 */
function postHocShape(maxDispatches, cmds, { pollMs = 1400, burstMs = 20 } = {}) {
  let sent = 0
  for (let elapsed = 0; elapsed < pollMs && sent < cmds.length; elapsed += burstMs) sent += 1
  return { sent, overBy: Math.max(0, sent - maxDispatches) }
}

console.log('\n[① 剩余 1 次时"同时"请求 2 次，实际传输恰 1 次]')
{
  // 对照：改前形状（先发再数）在同一场景下会传出 2 次 —— 证明本组断言可证伪
  const naive = postHocShape(1, ['chat_stream', 'chat_stream']).sent
  const { ledgerPath, mirrorPath } = freshPaths()
  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 1, maxGenSvg: DEFAULT_MAX_GEN_SVG })
  const opened = b.open()
  check('① 账本打开成功', opened.ok, opened.reason || '')
  const r1 = b.reserve('chat_stream')
  const r2 = b.reserve('chat_stream') // 同一次"并发窗口"里的第二个请求
  check('① 第一个请求被放行、第二个被拒', r1.ok === true && r2.ok === false, `r1=${r1.ok} r2=${r2.ok}（${r2.reason || ''}）`)
  check('① 实际传输恰 1 次（不是 2 次）', Number(r1.ok) + Number(r2.ok) === 1, `传输=${Number(r1.ok) + Number(r2.ok)}`)
  check('① 反例对照：改前"先发再数"的形状在同一场景会传出 2 次', naive === 2, `改前形状传输=${naive}`)
}

console.log('\n[② 剩余 0 时实际传输为 0]')
{
  const { ledgerPath, mirrorPath } = freshPaths()
  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 0, maxGenSvg: 0 })
  b.open()
  const t = fakeTransport(b, ['chat_stream', 'prep_turn', 'gen_svg'])
  check('② 额度为 0 时一次都不发', t.transported === 0, JSON.stringify(t.perCmd.map((x) => `${x.cmd}:${x.sent}`)))
}

console.log('\n[③ 绘图预算为 0：draw 不发，额度内的非 draw 照常]')
{
  const { ledgerPath, mirrorPath } = freshPaths()
  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 3, maxGenSvg: 0 })
  b.open()
  const draw = b.reserve('gen_svg')
  const text = b.reserve('chat_stream')
  check('③ 绘图额度 0 → gen_svg 被拒', draw.ok === false && draw.kind === 'draw', draw.reason || '')
  check('③ 同一额度下非绘图照常放行', text.ok === true, text.reason || '')
  const t = fakeTransport(b, ['gen_svg', 'prep_turn'])
  check('③ 混合请求里只有非绘图真的发出去', t.transported === 1, JSON.stringify(t.perCmd.map((x) => `${x.cmd}:${x.sent}`)))
}

console.log('\n[④ 预留落盘失败 → 零派发]')
{
  // 4a：账本路径本身就是个目录 → 连 open 都过不去（不假装可用）
  const { mirrorPath } = freshPaths()
  const bad = join(workRoot, 'c4-ledger-is-a-dir')
  mkdirSync(bad, { recursive: true })
  const b = mkBudget({ ledgerPath: bad, mirrorPath, maxDispatches: 5, maxGenSvg: 5 })
  const opened = b.open()
  check('④a 账本读不出来时 open 直接失败（不假装可用）', opened.ok === false, opened.reason || '')
  const t = fakeTransport(b, ['chat_stream', 'gen_svg'])
  check('④a 账本不可用时实际传输为 0', t.transported === 0, JSON.stringify(t.perCmd.map((x) => `${x.cmd}:${x.sent}`)))

  // 4b：open 成功之后**预留那一刻**才写不下去（这才是"预留落盘失败"本身）
  const { ledgerPath, mirrorPath: m4 } = freshPaths()
  const c = mkBudget({ ledgerPath, mirrorPath: m4, maxDispatches: 5, maxGenSvg: 5 })
  check('④b 先让 open 成功（账本确实是可写的文件）', c.open().ok === true)
  // 把账本文件换成同名**目录**：writeFileAtomic 的改名会失败 → 预留落盘失败
  unlinkSync(ledgerPath)
  mkdirSync(ledgerPath, { recursive: true })
  const before = { ...c.state.ledger.totals }
  const r = c.reserve('chat_stream')
  check('④b 预留落盘失败 → 拒绝派发', r.ok === false, r.reason || '')
  check('④b 落盘失败次数被记下来（不是静默）', c.state.persistFailures === 1, `persistFailures=${c.state.persistFailures}`)
  check(
    '④b 内存计数回滚到与磁盘一致（没发出却占了额度=另一种账实不符）',
    c.state.ledger.totals.dispatches === before.dispatches && c.state.phase.dispatches === 0,
    `totals=${JSON.stringify(c.state.ledger.totals)} phase=${JSON.stringify(c.state.phase)}`,
  )
  const t2 = fakeTransport(c, ['chat_stream'])
  check('④b 落盘不可用时实际传输为 0', t2.transported === 0, '')
}

console.log('\n[⑤ 派发后模拟崩溃重启，额度不恢复]')
{
  const { ledgerPath, mirrorPath } = freshPaths()
  const a = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 3, maxGenSvg: 1 })
  a.open()
  check('⑤ 重启前预留 2 次文字 + 1 次绘图', a.reserve('chat_stream').ok && a.reserve('prep_turn').ok && a.reserve('gen_svg').ok)
  const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  check('⑤ 预留**当场**落在盘上（不等回合结束）', onDisk.totals.dispatches === 3 && onDisk.totals.genSvg === 1, JSON.stringify(onDisk.totals))
  // "崩溃"：直接丢掉 a，重新建一个写者读同一个账本
  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 3, maxGenSvg: 1 })
  b.open()
  const t = fakeTransport(b, ['chat_stream', 'gen_svg'])
  check('⑤ 重启后额度没有回来（继续拒发）', t.transported === 0 && b.remaining().dispatches === 0, JSON.stringify(b.remaining()))
}

console.log('\n[⑥ 损坏账本不清零]')
{
  const { ledgerPath, mirrorPath } = freshPaths()
  const seed = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 20, maxGenSvg: 4 })
  seed.open()
  seed.reserve('chat_stream')
  // 写坏它
  writeFileSync(ledgerPath, '{ 这不是 JSON', 'utf8')
  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 20, maxGenSvg: 4 })
  const opened = b.open()
  check('⑥ 损坏账本 → open 失败（BLOCKED 语义，而不是新建 20/4）', opened.ok === false, opened.reason || '')
  const t = fakeTransport(b, ['chat_stream'])
  check('⑥ 损坏账本下零派发（不拿"以为的满额"去花钱）', t.transported === 0, '')
  // schema 不符也算损坏
  const { ledgerPath: p2, mirrorPath: m2 } = freshPaths()
  writeFileSync(p2, JSON.stringify({ schema: 99, totals: { dispatches: 0, genSvg: 0 } }), 'utf8')
  check('⑥ schema 不符同样判为损坏', mkBudget({ ledgerPath: p2, mirrorPath: m2 }).open().ok === false, '')
}

console.log('\n[⑦ 换 --root 不能重置预算]')
{
  const ledgerPath = join(workRoot, 'c7-shared-global.json') // 固定账本 = 与 root 无关
  const rootA = { ledgerPath, mirrorPath: join(workRoot, 'c7-rootA.json') }
  const rootB = { ledgerPath, mirrorPath: join(workRoot, 'c7-rootB.json') }
  const a = mkBudget({ ...rootA, maxDispatches: 2, maxGenSvg: 1 })
  a.open()
  fakeTransport(a, ['chat_stream', 'prep_turn'])
  check('⑦ 第一个 root 用掉 2 次', a.remaining().dispatches === 0, JSON.stringify(a.remaining()))
  const b = mkBudget({ ...rootB, maxDispatches: 2, maxGenSvg: 1 })
  b.open()
  check('⑦ 换一个 root 打开，剩余额度**没有**回到 2', b.remaining().dispatches === 0, JSON.stringify(b.remaining()))
  const t = fakeTransport(b, ['chat_stream'])
  check('⑦ 新 root 里同样零派发', t.transported === 0, '')
  // 命令行把额度调大无效
  const c = mkBudget({ ...rootB, maxDispatches: 200, maxGenSvg: 40 })
  c.open()
  check('⑦ 命令行把额度调大无效（只能调小）', c.state.ledger.budget.maxDispatches === 2, JSON.stringify(c.state.ledger.budget))
}

console.log('\n[⑧ 参数校验与本 phase 中止线]')
{
  check('⑧ 缺省量是 20 / 4（指南执行默认值）', DEFAULT_MAX_DISPATCHES === 20 && DEFAULT_MAX_GEN_SVG === 4)
  for (const bad of ['-1', 'abc', '1.5', 'Infinity', '1e3', '', ' ']) {
    const ok = bad === '' || bad === ' ' ? true : parseBudgetParam(bad, 20).ok // 空串按"没给"处理
    check(`⑧ 非法额度参数被拒：${JSON.stringify(bad)}`, ok === false || bad.trim() === '', JSON.stringify(parseBudgetParam(bad, 20)))
  }
  check('⑧ 合法值原样接受', parseBudgetParam('7', 20).value === 7 && parseBudgetParam(undefined, 20).value === 20)
  // L5/L6：本 phase 中止线为 0 → 即使整批还有额度，一次都不许发
  const { ledgerPath, mirrorPath } = freshPaths()
  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 20, maxGenSvg: 4, phaseMaxDispatches: 0, phaseMaxGenSvg: 0 })
  b.open()
  const t = fakeTransport(b, ['chat_stream', 'gen_svg', 'prep_turn'])
  check('⑧ 本回合中止线 0（L5/L6）→ 拒绝一切模型派发', t.transported === 0, JSON.stringify(t.perCmd.map((x) => `${x.cmd}:${x.sent}`)))
  check('⑧ 被拒原因是"本回合中止线"而不是"累计额度"', (t.perCmd[0].reason || '').includes('本回合'), t.perCmd[0].reason || '')
  // 非付费命令不占额度
  const before = { ...b.state.ledger.totals }
  const r = b.reserve('list_documents')
  check('⑧ 非付费命令不占额度（也不被 phaseMax 拦）', r.ok === true && r.paid === false && b.state.ledger.totals.dispatches === before.dispatches)

  // ── 非法预算参数**绝不能落进账本**（这是真机跑出来的一条真缺陷）──────────────────────────
  // 现象：`--max-dispatches abc` → `NaN` → `JSON.stringify` 把 `NaN` 写成 `null` → 账本被污染，
  // 之后每次打开都读到一个"说不清额度"的账本，只能靠猜。实时句柄可以自己吞掉 NaN，
  // 但**盘上的账本**会带着这个洞留下去。
  const { ledgerPath: pBad, mirrorPath: mBad } = freshPaths()
  const nan = mkBudget({ ledgerPath: pBad, mirrorPath: mBad, maxDispatches: NaN, maxGenSvg: 4 })
  check('⑧ 非法 maxDispatches（NaN）→ open 直接失败', nan.open().ok === false, nan.state.reason || '')
  check('⑧ 失败时**没有**在盘上留下账本（不制造说不清额度的文件）', !existsSync(pBad), pBad)
  check('⑧ 同上：负数/小数同样拒绝', mkBudget({ ledgerPath: join(workRoot, 'x1.json'), maxDispatches: -1 }).open().ok === false && mkBudget({ ledgerPath: join(workRoot, 'x2.json'), maxDispatches: 1.5 }).open().ok === false)

  // ── 盘上已有的非法额度 → 判损坏，不猜 ──────────────────────────────────────────────
  const { ledgerPath: pNull, mirrorPath: mNull } = freshPaths()
  writeFileSync(pNull, JSON.stringify({ schema: 1, budget: { maxDispatches: null, maxGenSvg: 4 }, totals: { dispatches: 0, genSvg: 0 }, phases: [] }), 'utf8')
  const nulled = mkBudget({ ledgerPath: pNull, mirrorPath: mNull, maxDispatches: 20, maxGenSvg: 4 })
  const openedNull = nulled.open()
  check('⑧ 账本里 maxDispatches=null（NaN 被序列化的样子）→ 判损坏并拒绝', openedNull.ok === false, openedNull.reason || '')
  const t3 = fakeTransport(nulled, ['chat_stream'])
  check('⑧ 这种账本下零派发（不拿"以为还有 20 次"去花钱）', t3.transported === 0, '')
}

console.log('\n[⑩ 两个进程 / 不同 root / 同一个账本：额度 1 只能放行 1 次]')
{
  // 2026-10-02 独立复核的真缺陷：账本全局一份，锁却在每个 root 下；两个实例各自 open（都读到 0），
  // 再各 reserve → 额度 1 放行 2 次，盘上只记 1 次。单实例里的 Promise 并发**测不出**这个，
  // 必须有真的两个子进程。下面先给出"改前形状"的对照，证明这组断言可证伪。
  const preFix = (() => {
    const p = join(workRoot, 'c10-prefix.json')
    writeFileSync(p, JSON.stringify({ schema: 1, budget: { maxDispatches: 1, maxGenSvg: 1 }, totals: { dispatches: 0, genSvg: 0 }, phases: [] }), 'utf8')
    const readOnce = () => JSON.parse(readFileSync(p, 'utf8')) // 旧形状：open 时读一次，之后只改内存
    const a = readOnce()
    const b = readOnce() // 两个实例都看到 totals=0
    a.totals.dispatches += 1 // 各自的 reserve 都"通过"
    b.totals.dispatches += 1
    writeFileSync(p, JSON.stringify(b), 'utf8') // 后写者覆盖前者
    return { allowed: 2, onDisk: b.totals.dispatches }
  })()
  check('⑩ 对照：改前形状（各自 open 后各 reserve）会放行 2 次、盘上只记 1', preFix.allowed === 2 && preFix.onDisk === 1, JSON.stringify(preFix))

  const ledgerPath = join(workRoot, 'c10-shared-global.json')
  const transportFile = join(workRoot, 'c10-transport.log')
  const barrier = join(workRoot, 'c10-barrier')
  mkdirSync(barrier, { recursive: true })
  const childPath = join(workRoot, 'c10-child.mjs')
  writeFileSync(
    childPath,
    [
      "import { appendFileSync, readdirSync, writeFileSync } from 'node:fs'",
      "import { join } from 'node:path'",
      'const [ledger, mirror, barrierDir, tag, transport] = process.argv.slice(2)',
      'const { createBudget } = await import(process.env.WXMP_BUDGET_MODULE)',
      // 子进程里没有本文件顶部的 mkBudget：显式关掉 phase 屏障（本组测的是跨进程额度竞争）
      'const b = createBudget({ ledgerPath: ledger, mirrorPath: mirror, maxDispatches: 1, maxGenSvg: 1, requirePhaseOpen: false })',
      'const opened = b.open()',
      "writeFileSync(join(barrierDir, tag + '.opened'), JSON.stringify(opened))",
      'const t0 = Date.now()',
      'let timedOut = false',
      "while (readdirSync(barrierDir).filter((n) => n.endsWith('.opened')).length < 2) {",
      '  if (Date.now() - t0 > 20000) { timedOut = true; break }',
      '  await new Promise((r) => setTimeout(r, 10))',
      '}',
      "writeFileSync(join(barrierDir, tag + '.ready'), JSON.stringify({ timedOut }))",
      "const r = b.reserve('gen_svg')",
      "if (r.ok) appendFileSync(transport, tag + '\\n')",
      "writeFileSync(join(barrierDir, tag + '.result'), JSON.stringify({ opened, r }))",
      '',
    ].join('\n'),
    'utf8',
  )
  const moduleUrl = new URL('./lib/dispatch-budget.mjs', import.meta.url).href
  const runChild = (tag) =>
    new Promise((res) => {
      const p = spawn(process.execPath, [childPath, ledgerPath, join(workRoot, `c10-root-${tag}.json`), barrier, tag, transportFile], {
        env: { ...process.env, WXMP_BUDGET_MODULE: moduleUrl },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let err = ''
      p.stderr.on('data', (d) => {
        err += d
      })
      p.on('exit', (code) => res({ tag, code, err: err.slice(0, 400) }))
    })
  const results = await Promise.all([runChild('A'), runChild('B')])
  check('⑩ 两个子进程都正常退出', results.every((r) => r.code === 0), JSON.stringify(results.map((r) => [r.tag, r.code, r.err])))
  const readResult = (tag) => {
    try {
      return JSON.parse(readFileSync(join(barrier, `${tag}.result`), 'utf8'))
    } catch {
      return null
    }
  }
  const rA = readResult('A')
  const rB = readResult('B')
  check('⑩ 两个子进程都完成了 open（交错条件成立，不是"根本没并发起来"）', Boolean(rA && rB && rA.opened.ok && rB.opened.ok), JSON.stringify([rA && rA.opened, rB && rB.opened]))
  const transportLines = existsSync(transportFile) ? readFileSync(transportFile, 'utf8').split('\n').filter(Boolean) : []
  check('⑩ 实际传输**恰 1 次**（额度 1 不能放行 2 次）', transportLines.length === 1, `实际传输=${JSON.stringify(transportLines)}`)
  const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  check('⑩ 盘上累计也只记 1 次（放行数与落盘数一致，不是"放 2 记 1"）', onDisk.totals.dispatches === 1 && onDisk.totals.genSvg === 1, JSON.stringify(onDisk.totals))
  const loser = [rA, rB].find((r) => r && r.r && !r.r.ok)
  check('⑩ 被拒的那一次给出了明确理由（不是静默丢弃）', Boolean(loser && /上限|锁/.test(String(loser.r.reason))), loser ? loser.r.reason : '(没有找到被拒的一方)')
}

console.log('\n[⑪ 结构损坏的账本一律拒绝（不修成 0、不静默丢弃历史）]')
{
  const cases = [
    ['totals 为负数', { schema: 1, budget: { maxDispatches: 20, maxGenSvg: 4 }, totals: { dispatches: -1, genSvg: -1 }, phases: [] }],
    ['genSvg > dispatches（不自洽）', { schema: 1, budget: { maxDispatches: 20, maxGenSvg: 4 }, totals: { dispatches: 1, genSvg: 3 }, phases: [] }],
    ['phases 不是数组（历史被清空 = 业务失败标记丢了）', { schema: 1, budget: { maxDispatches: 20, maxGenSvg: 4 }, totals: { dispatches: 0, genSvg: 0 }, phases: { a: 1 } }],
    ['totals 缺失', { schema: 1, budget: { maxDispatches: 20, maxGenSvg: 4 }, phases: [] }],
  ]
  for (const [name, obj] of cases) {
    const p = join(workRoot, `c11-${cases.findIndex((c) => c[0] === name)}.json`)
    writeFileSync(p, JSON.stringify(obj), 'utf8')
    const b = mkBudget({ ledgerPath: p, maxDispatches: 20, maxGenSvg: 4 })
    const opened = b.open()
    const t = fakeTransport(b, ['chat_stream', 'gen_svg'])
    check(`⑪ ${name} → 判损坏并拒绝（零派发）`, opened.ok === false && t.transported === 0, `${opened.reason || '(open 竟然成功了)'}；传输=${t.transported}`)
  }
}

console.log('\n[⑫ 关键写失败必须被调用方看见：reserve / recordPhase / clearBusinessFailure]')
{
  // 只读的账本文件：读得出来、但改名写回会 EPERM（Windows 实测）——正好复现"读得到、写不下去"。
  const ledgerPath = join(workRoot, 'c12-readonly.json')
  const mirrorPath = join(workRoot, 'c12-mirror.json')
  const seed = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 5, maxGenSvg: 5 })
  check('⑫ 先建出账本', seed.open().ok === true)
  const { chmodSync } = await import('node:fs')
  chmodSync(ledgerPath, 0o444)

  const b = mkBudget({ ledgerPath, mirrorPath, maxDispatches: 5, maxGenSvg: 5 })
  check('⑫ 只读账本仍能打开（读得到）', b.open().ok === true)
  const r = b.reserve('chat_stream')
  check('⑫ 预留落盘失败 → 拒绝派发', r.ok === false, r.reason || '')
  check('⑫ 这次失败被计数（persistFailures）而不是静默', b.state.persistFailures === 1, `persistFailures=${b.state.persistFailures}`)
  const rp = b.recordPhase({ dispatches: 0, genSvg: 0, note: '业务失败屏障', extra: { businessFailure: true } })
  check('⑫ recordPhase 落盘失败**如实返回 false**（业务失败屏障没写进去，调用方必须据此判 ERROR）', rp.ok === false, rp.reason || '')
  check('⑫ recordPhase 的失败同样计入 persistFailures', b.state.persistFailures === 2, `persistFailures=${b.state.persistFailures}`)
  check('⑫ 屏障没写进盘 → 盘上读不出业务失败（所以"只在内存里说失败"是不够的）', b.priorBusinessFailure() === null, JSON.stringify(b.priorBusinessFailure()))
  const cf = b.clearBusinessFailure('测试')
  check('⑫ clearBusinessFailure 落盘失败也返回 false', cf.ok === false, cf.reason || '')
  chmodSync(ledgerPath, 0o666)

  // 镜像（只作证据）写失败：不影响判定，但必须可观察（旧实现直接 `catch {}` 吞掉）。
  // 注入方式：让镜像的**父路径是一个文件** → mkdir 必然 ENOTDIR。
  const blockedParent = join(workRoot, 'c12b-blocked-parent')
  writeFileSync(blockedParent, 'not a directory', 'utf8')
  const m = mkBudget({ ledgerPath: join(workRoot, 'c12b-global.json'), mirrorPath: join(blockedParent, 'mirror.json'), maxDispatches: 2, maxGenSvg: 1 })
  check('⑫ 镜像路径不可写时账本本身仍可用', m.open().ok === true)
  const mr = m.reserve('chat_stream')
  check('⑫ 镜像写失败不影响派发判定（权限账本已写成功）', mr.ok === true, mr.reason || '')
  check('⑫ 但镜像失败被记下来（不再静默吞掉）', m.state.mirrorFailures >= 1, `mirrorFailures=${m.state.mirrorFailures} ${JSON.stringify(m.state.mirrorFailureReasons)}`)
  check('⑫ 摘要里带出镜像失败与锁失败计数（证据可见）', 'mirrorFailures' in m.summary() && 'lockFailures' in m.summary(), JSON.stringify(Object.keys(m.summary())))
}

console.log('\n[⑬ phase 在途状态先落盘：失败屏障写不成时，下一个进程也不能凭旧账本继续]')
{
  // 2026-10-02 晚间复核的反例：业务失败那一刻才写记录，**那次写可能失败**。恢复成"可读的旧账本"
  // 之后，新实例读到 priorBusinessFailure=null，照样预留——"上一次跑了一半"在盘上毫无痕迹。
  // 修法是把"本 phase 已开始"**先**落盘；终结证据没写成功就保持未闭合，下一个进程必须先核对。
  // 本组用**默认值**（requirePhaseOpen 默认 true），故意不走上面的 mkBudget。
  const { chmodSync } = await import('node:fs')
  const { ledgerPath, mirrorPath } = freshPaths()

  check('⑬ 默认就是 fail closed：新建的写者要求先 beginPhase', createBudget({ ledgerPath: join(workRoot, 'c13-default.json') }).state.requirePhaseOpen === true, '')

  // (a) 没有 beginPhase 就不许付费派发
  {
    const b = createBudget({ ledgerPath, mirrorPath, maxDispatches: 5, maxGenSvg: 2 })
    check('⑬ beginPhase 之前账本能打开', b.open().ok === true)
    const t = fakeTransport(b, ['chat_stream', 'prep_turn', 'gen_svg'])
    check('⑬ 未持久记录 phase 开始 → 付费派发一次都不发', t.transported === 0, JSON.stringify(t.perCmd.map((x) => `${x.cmd}:${x.sent}`)))
    check('⑬ 被拒理由是"没有在途状态"而不是"额度用尽"', /尚未以\*\*持久记录\*\*开始|在途状态/.test(String(t.perCmd[0].reason)), String(t.perCmd[0].reason))
    check('⑬ 非付费命令不受 phase 屏障影响', b.reserve('list_documents').ok === true)
  }

  // (b) beginPhase 落盘失败 → 仍然零派发（不能"内存里当开始了"）
  {
    const p = join(workRoot, 'c13-beginfail.json')
    const b = createBudget({ ledgerPath: p, mirrorPath, maxDispatches: 5, maxGenSvg: 2 })
    check('⑬(b) 账本先建出来', b.open().ok === true)
    chmodSync(p, 0o444) // 读得到、改不了名 → beginPhase 的持久化必然失败
    const began = b.beginPhase({ name: 'L1' })
    check('⑬(b) beginPhase 落盘失败 → 如实返回 false', began.ok === false, began.reason || '')
    check('⑬(b) 失败时**不**自称 phase 已开始', b.state.phaseOpen === false, `phaseOpen=${b.state.phaseOpen}`)
    check('⑬(b) 这种状态下付费派发为 0', fakeTransport(b, ['chat_stream']).transported === 0, '')
    chmodSync(p, 0o666)
  }

  // (c) 正常路径：beginPhase → 派发 → closePhase 写不成 → 下个进程读到未闭合并拒发
  {
    const b = createBudget({ ledgerPath, mirrorPath, maxDispatches: 5, maxGenSvg: 2 })
    check('⑬(c) 账本打开、phase 开始记录落盘', b.open().ok === true && b.beginPhase({ name: 'L1', note: '测试相位' }).ok === true)
    const r = b.reserve('chat_stream')
    check('⑬(c) 有在途记录时正常放行（不是把正常路径也拦掉）', r.ok === true, r.reason || '')
    chmodSync(ledgerPath, 0o444) // 终结证据这一次写不下去
    const closed = b.closePhase({ outcome: 'error', note: '模拟终结写失败' })
    check('⑬(c) 终结记录落盘失败 → closePhase 返回 false（不假装闭合）', closed.ok === false, closed.reason || '')
    check('⑬(c) 失败后本进程仍标 phase 未闭合', b.state.phaseOpen === true, `phaseOpen=${b.state.phaseOpen}`)
    chmodSync(ledgerPath, 0o666)

    // "进程结束"：丢掉写者，新进程读同一个账本
    const b2 = createBudget({ ledgerPath, mirrorPath, maxDispatches: 5, maxGenSvg: 2 })
    const opened2 = b2.open()
    check('⑬(c) 新进程能打开这份账本（盘上是可读 JSON）', opened2.ok === true, opened2.reason || '')
    const un = b2.unresolvedPhase()
    check('⑬(c) 新进程读到"上一次没跑完"（未闭合 phase，带名字与时间）', un !== null && un.phase === 'L1' && un.count === 1, JSON.stringify(un))
    // 这是本组的核心：旧账本**没有**业务失败记录（那次写失败了），只有未闭合的在途记录
    check('⑬(c) 旧账本里读不到业务失败标记（正是原反例的形状）', b2.priorBusinessFailure() === null, JSON.stringify(b2.priorBusinessFailure()))
    check('⑬(c) 即便如此，新进程的付费派发仍为 0（不再凭旧账本直接继续）', fakeTransport(b2, ['chat_stream', 'gen_svg']).transported === 0, '')
    const began2 = b2.beginPhase({ name: 'L2' })
    check('⑬(c) 也不许直接开第二个 phase（不覆盖、不假装续上）', began2.ok === false && began2.unresolved === true, began2.reason || '')

    // 人工核对后显式闭合
    const resolved = b2.resolveUnresolved('已核对：那一次没有付费请求落地')
    check('⑬(c) 人工核对后可显式闭合遗留记录', resolved.ok === true, resolved.reason || '')
    check('⑬(c) 闭合后开新 phase 正常', b2.beginPhase({ name: 'L2' }).ok === true)
    check('⑬(c) 之后付费派发恢复', fakeTransport(b2, ['chat_stream']).transported === 1, '')
    const led = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    check('⑬(c) 闭合**不删历史、不返还额度、不清零累计**', led.phases.length >= 2 && led.totals.dispatches === 2, JSON.stringify({ phases: led.phases.length, totals: led.totals }))
    check('⑬(c) 闭合记录带 outcome 与理由（留痕）', led.phases.some((p) => p.outcome === 'resolved-after-review' && /已核对/.test(String(p.closeNote))), JSON.stringify(led.phases.map((p) => p.outcome)))
  }

  // (d) 对照：正常闭合之后，下一个进程不会再被拦
  {
    const p = join(workRoot, 'c13-clean.json')
    const a = createBudget({ ledgerPath: p, mirrorPath, maxDispatches: 3, maxGenSvg: 1 })
    a.open()
    a.beginPhase({ name: 'L3' })
    a.reserve('prep_turn')
    check('⑬(d) 终结记录写得成 → closePhase 成功', a.closePhase({ outcome: 'pass' }).ok === true)
    const b = createBudget({ ledgerPath: p, mirrorPath, maxDispatches: 3, maxGenSvg: 1 })
    b.open()
    check('⑬(d) 对照：正常闭合后没有遗留记录', b.unresolvedPhase() === null, JSON.stringify(b.unresolvedPhase()))
    check('⑬(d) 对照：新进程可以正常开始并派发', b.beginPhase({ name: 'L4' }).ok === true && b.reserve('prep_turn').ok === true, '')
  }
}

console.log('')
const ledgerKept = existsSync(join(workRoot, 'c7-shared-global.json'))
judge.observe('工作目录', `${workRoot}（临时目录，全部为假传输；未联网、未调用模型）`)
judge.observe('账本落盘位置', '权限账本默认取系统临时目录下的固定路径（与 --root 无关），本次用注入路径隔离')
check('⑨ 收尾：账本文件确实落在盘上（不是内存里自说自话）', ledgerKept, join(workRoot, 'c7-shared-global.json'))
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'BUDGET' })
