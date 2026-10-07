// E 路 阶段二：A（协议修复）独立复核 — 真实生产模块 runPrep + 受控传输。
//
// 覆盖父协调者点名的四项 + 三个附加争点：
//   A1 合法 compose（不带 text）仍被接受，只发 1 次请求
//   A2/A3 可纠正错误：**一次**有界纠偏，占用同一总额预算，纠偏后能成稿
//   A4 任何场景 prep_turn 调用次数 ≤ 3（无第 4 次请求）
//   A5 最后一轮（callNo=2）出错不再纠偏，立即失败
//   A6 被拒/失败时不产生 compose/candidate；纠偏**不修改**模型原 arguments、不删 text 自动接受
//   A7 不可纠正的形状仍"一次即失败"（证明纠偏集不放松合同）
//   A8 纠偏标志与旧协议(READY)纠偏**共用**，整回合至多纠偏一次
//   A9 纠偏类别判定：{compose,candidate}+text = 是；其余否（过宽争点的机理核对）
//
// 受控返回值，非真实模型行为。退出码 0 = 结论已产出。
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { createServer } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.E_ROOT || 'candidate'
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
const sha = (rel) => createHash('sha256').update(readFileSync(join(here, ROOT, rel))).digest('hex')

const rec = { script: 'phase2-a-check', root: ROOT, subject: `${ROOT}/src/lib/prep.ts`, hashes: { 'src/lib/prep.ts': sha('src/lib/prep.ts') }, scenarios: [], checks: [] }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

globalThis.window = { __TAURI_INTERNALS__: {} }
let script = [], seen = [], overrun = 0, backfilled = []
globalThis.__E_INVOKE_HANDLER__ = (cmd, args) => {
  if (cmd !== 'prep_turn') return null
  seen.push(JSON.parse(JSON.stringify(args?.messages ?? [])))
  const r = script.shift()
  if (!r) { overrun++; return { text: null, calls: [], model: 'stub-controlled', finishReason: 'stop', usage: null } }
  // 记录模型原样回填的 tool_calls（用于证明 arguments 未被改写）
  if (r.calls) for (const c of r.calls) backfilled.push(c.args)
  return r
}
const reply = (calls, text = null) => ({ text, calls, model: 'stub-controlled', finishReason: 'tool_calls', usage: { total: 1 } })
const fin = (args) => ({ id: 'fin' + Math.random().toString(16).slice(2, 6), name: 'finish_preparation', args: typeof args === 'string' ? args : JSON.stringify(args) })
const know = () => ({ id: 'k' + Math.random().toString(16).slice(2, 6), name: 'load_knowledge', args: JSON.stringify({ path: '排版引擎/engine-write-protocol' }) })

const server = await createServer({
  root: join(here, ROOT), configFile: false, logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { '@tauri-apps/api/core': join(here, 'lib', 'invoke-stub.mjs') } },
  optimizeDeps: { noDiscovery: true },
})
const prep = await server.ssrLoadModule('/src/lib/prep.ts')
const baseMsgs = [{ role: 'system', content: 'E 复核最小 system 占位' }, { role: 'user', content: 'E 复核受控请求' }]

async function run(label, s) {
  script = s.slice(); seen = []; overrun = 0; backfilled = []
  const out = await prep.runPrep(baseMsgs, { runId: 'E2-' + label })
  const row = { label, requests: seen.length, overrun, outcome: `${out.mode}/${out.kind}${out.failure ? '/' + out.failure : ''}`, reason: out.reason ?? null, backfilled }
  rec.scenarios.push(row)
  return { out, row }
}

// S1 合法 compose（不带 text）
{
  const { out, row } = await run('S1 compose-no-text', [reply([fin({ outcome: 'compose', assetPolicy: 'preserve' })])])
  ok('A1 合法 compose 被接受且只发 1 次', out.kind === 'compose' && row.requests === 1, `${row.outcome} req=${row.requests}`)
}

// S2 compose+text → 纠偏一次 → 模型改正
{
  const bad = { outcome: 'compose', text: '我按默认排版来写，想调整告诉我。', assetPolicy: 'preserve' }
  const { out, row } = await run('S2 compose+text corrected', [reply([fin(bad)]), reply([fin({ outcome: 'compose', assetPolicy: 'preserve' })])])
  ok('A2 compose+text 触发一次纠偏后成稿', out.kind === 'compose' && row.requests === 2, `${row.outcome} req=${row.requests}`)
  ok('A6 纠偏**不修改**模型原 arguments（原样回填）', row.backfilled[0] === JSON.stringify(bad), `回填=${String(row.backfilled[0]).slice(0, 60)}`)
  const corrMsg = seen[1]?.[seen[1].length - 1]
  ok('A2b 拒绝以 tool 结果播回（含原错误串）', corrMsg?.role === 'tool' && /互斥/.test(corrMsg.content || ''), `role=${corrMsg?.role} 片段=${String(corrMsg?.content).slice(0, 40)}`)
}

// S3 candidate+text（过宽争点：任务卡只点名 compose）
{
  const bad = { outcome: 'candidate', text: '顺手说明一句', source: '第一行正文\n第二行正文', assetPolicy: 'preserve' }
  const { out, row } = await run('S3 candidate+text corrected', [reply([fin(bad)]), reply([fin({ outcome: 'candidate', source: '第一行正文\n第二行正文', assetPolicy: 'preserve' })])])
  ok('A9a candidate+text 也走一次纠偏（过宽争点的实际行为）', row.requests === 2 && out.kind === 'candidate', `${row.outcome} req=${row.requests}`)
  ok('A6b 纠偏**不**自动删 text 接受 candidate（仍由模型重新声明）', row.backfilled[0] === JSON.stringify(bad), `回填=${String(row.backfilled[0]).slice(0, 60)}`)
}

// S4 先花 1 次知识工具，再出错 → 纠偏 → 成稿
{
  const { out, row } = await run('S4 knowledge then bad then fixed', [reply([know()]), reply([fin({ outcome: 'compose', text: 'x', assetPolicy: 'preserve' })]), reply([fin({ outcome: 'compose', assetPolicy: 'preserve' })])])
  ok('A3 预算内纠偏后成稿（未超 3 次）', out.kind === 'compose' && row.requests === 3, `${row.outcome} req=${row.requests}`)
}

// S5 最后一轮才出错 → 不纠偏，立即失败，无第 4 次
{
  const { out, row } = await run('S5 last-round bad', [reply([know()]), reply([know()]), reply([fin({ outcome: 'compose', text: 'x', assetPolicy: 'preserve' })])])
  ok('A5 最后一轮出错立即失败（protocol）', out.kind === 'failed' && out.failure === 'protocol', row.outcome)
  ok('A4 该场景无第 4 次请求', row.requests === 3 && row.overrun === 0, `req=${row.requests} overrun=${row.overrun}`)
}

// S6 连续三次都错 → 3 次封顶
{
  const bad = () => reply([fin({ outcome: 'compose', text: 'x', assetPolicy: 'preserve' })])
  const { out, row } = await run('S6 persistent bad', [bad(), bad(), bad(), bad()])
  // 第一次非法 → 一次纠偏；第二次非法时 corrected 已置位 → 立即失败（req=2），不再消耗预算。
  // 判据只看"绝不超过 3 次、绝无第 4 次"，不规定它必须撑满预算。
  ok('A4b 连续非法不超 3 次、无第 4 次请求', row.requests <= 3 && row.overrun === 0, `req=${row.requests} overrun=${row.overrun}`)
  ok('A6c 封顶后以 failed 收尾、无写作授权', out.kind === 'failed', row.outcome)
}

// S7 不可纠正的形状 → 一次即失败（1 次请求）
const notCorrectable = [
  ['缺 assetPolicy', { outcome: 'compose' }],
  ['未知 outcome', { outcome: 'publish', assetPolicy: 'preserve' }],
  ['reply 带 source', { outcome: 'reply', text: 'a', source: 'b' }],
  ['candidate 空 source', { outcome: 'candidate', source: '   ', assetPolicy: 'preserve' }],
  ['assetPolicy 非法', { outcome: 'compose', assetPolicy: 'keep' }],
  ['顶层是数组', [1, 2]],
]
for (const [name, args] of notCorrectable) {
  const { out, row } = await run(`S7 ${name}`, [reply([fin(args)]), reply([fin({ outcome: 'compose', assetPolicy: 'preserve' })])])
  ok(`A7 不可纠正「${name}」一次即失败（req=1）`, out.kind === 'failed' && row.requests === 1, `${row.outcome} req=${row.requests}`)
}
{
  const { out, row } = await run('S7 混用知识+终结', [reply([know(), fin({ outcome: 'compose', assetPolicy: 'preserve' })])])
  ok('A7 知识工具与终结工具混用一次即失败', out.kind === 'failed' && row.requests === 1, `${row.outcome} req=${row.requests}`)
  const { out: o2, row: r2 } = await run('S7 两个终结', [reply([fin({ outcome: 'compose', assetPolicy: 'preserve' }), fin({ outcome: 'reply', text: 'a' })])])
  ok('A7 多个终结工具一次即失败', o2.kind === 'failed' && r2.requests === 1, `${o2.kind}/${o2.failure} req=${r2.requests}`)
}

// S8 纠偏标志与旧协议(READY)纠偏共用
{
  const { out, row } = await run('S8 READY then bad terminal', [reply([], '好，我准备好了。READY'), reply([fin({ outcome: 'compose', text: 'x', assetPolicy: 'preserve' })])])
  ok('A8 一次纠偏后不再纠偏（整回合至多一次）', row.requests === 2 && out.kind === 'failed', `${row.outcome} req=${row.requests}`)
}

// S10 复核新注释的两句话是否属实（端到端，不只查谓词）：
//   (a) "复合同样会纠偏"：缺 assetPolicy **且**带 text → 应纠偏（req=2）
//   (b) "单独出现（不带 text）的六种形状一律不纠偏、一次即失败"：S7 已逐条覆盖（均 req=1）
{
  const { out, row } = await run('S10 compound(missing assetPolicy + text)', [
    reply([fin({ outcome: 'compose', text: '附一句说明' })]),
    reply([fin({ outcome: 'compose', assetPolicy: 'preserve' })]),
  ])
  ok('A10a 复合错误（缺 assetPolicy + 带 text）**会**纠偏（req=2）', row.requests === 2 && out.kind === 'compose', `${row.outcome} req=${row.requests}`)
  const { out: o2, row: r2 } = await run('S10b same shape without text', [reply([fin({ outcome: 'compose' })])])
  ok('A10b 同一形状**不带 text** 则不纠偏、一次即失败（req=1）', r2.requests === 1 && o2.kind === 'failed', `${o2.kind}/${o2.failure} req=${r2.requests}`)
}

// S9 isCorrectableFinishError 判定表
{
  const f = prep.isCorrectableFinishError  // 基线（df97022）没有这个导出 → 竞态对照时 A9 全部不适用
  if (typeof f !== 'function') { ok('A9 基线无 isCorrectableFinishError 导出（对照：候选才有）', true, 'baseline'); }
  else {
  const cases = [
    ['compose+text', JSON.stringify({ outcome: 'compose', text: 'a', assetPolicy: 'preserve' }), true],
    ['candidate+text', JSON.stringify({ outcome: 'candidate', text: 'a', source: 'x', assetPolicy: 'preserve' }), true],
    ['compose 无 text', JSON.stringify({ outcome: 'compose', assetPolicy: 'preserve' }), false],
    ['compose text:null', JSON.stringify({ outcome: 'compose', text: null, assetPolicy: 'preserve' }), false],
    ['reply+text', JSON.stringify({ outcome: 'reply', text: 'a' }), false],
    ['未知 outcome+text', JSON.stringify({ outcome: 'x', text: 'a' }), false],
    ['compose 缺 assetPolicy 但带 text', JSON.stringify({ outcome: 'compose', text: 'a' }), true],
  ]
  for (const [n, a, exp] of cases) ok(`A9 ${n} → ${exp}`, f(a) === exp, `实际 ${f(a)}`)
  }
}

await server.close()
const maxReq = Math.max(...rec.scenarios.map((s) => s.requests))
const anyOverrun = rec.scenarios.some((s) => s.overrun > 0)
ok('A4* 全局上界：所有场景请求数 ≤ MAX_PREP_CALLS(=3)，无任何第 4 次请求', maxReq <= prep.MAX_PREP_CALLS && !anyOverrun, `maxReq=${maxReq} 任何 overrun=${anyOverrun}`)
rec.finishedAt = new Date().toISOString()
writeFileSync(join(outDir, `phase2-a-${ROOT}.json`), JSON.stringify(rec, null, 2))
const failed = rec.checks.filter((c) => !c.pass)
console.log(`\n[${ROOT}] 检查 ${rec.checks.length} 条，未过 ${failed.length} 条：${failed.map((c) => c.id).join(' / ')}`)
console.log('请求计数：', JSON.stringify(rec.scenarios.map((s) => [s.label, s.requests, s.outcome])))
console.log('写出：', join(outDir, `phase2-a-${ROOT}.json`))
