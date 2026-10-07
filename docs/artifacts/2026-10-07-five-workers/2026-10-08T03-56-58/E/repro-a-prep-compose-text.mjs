// E 路 阶段一：独立复现 A 的缺陷 —— `outcome=compose` 带 `text` 被整条拒绝。
//
// 判据（自定，不看实施者自述）：
//   P1  合法终结 `compose`（**不带** text）必须被接受为 compose；
//   P2  **同一份响应**若 compose 里多带了 text，则整条被拒（这就是原缺陷的机制）；
//   P3  协议错误发生在**预算仍有剩余**时，当前实现**不再发纠偏请求**，直接终结整回合；
//   P4  被拒时**不产生**任何写作授权 / 不写坏旧稿（产品行为正确性，缺陷只在"丢机会"）。
//
// 做法：**真实生产模块** runPrep（经 vite ssrLoadModule 原样加载 src/lib/prep.ts），
//       只把 `@tauri-apps/api/core` 的 invoke 换成受控剧本；记录实际发出的请求条数与参数。
//
// 退出码：0 = 复现结论已产出（无论缺陷是否成立）；1 = 基础设施出错。
import { createServer } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

import { createHash } from 'node:crypto'
const ROOT = process.env.E_ROOT || 'baseline'   // 'baseline' = df97022 快照；'candidate' = 冻结合同候选
const sha = (rel) => createHash('sha256').update(readFileSync(join(here, ROOT, rel))).digest('hex')

const rec = {
  script: 'repro-a-prep-compose-text',
  startedAt: new Date().toISOString(),
  subject: 'git HEAD df97022 的 src/lib/prep.ts 快照（对抗实施中并发编辑）',
  hashes: { [`${ROOT}/src/lib/prep.ts`]: sha('src/lib/prep.ts') },
  requests: [], checks: [],
}
const check = (id, ok, ev = '') => { rec.checks.push({ id, ok: Boolean(ok), evidence: String(ev ?? '') }); console.log(`  ${ok ? 'OK  ' : 'MISS'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

// 受控剧本：每次 prep_turn 按顺序返回一条写死的回复（受控返回值，非真实模型原文）
globalThis.window = { __TAURI_INTERNALS__: {} }
let script = []
let seen = []
globalThis.__E_INVOKE_HANDLER__ = (cmd, args) => {
  if (cmd !== 'prep_turn') return null          // 其余命令不应被触发
  seen.push(JSON.parse(JSON.stringify(args?.messages ?? [])))   // 调用时刻深拷贝，避免后续 push 污染
  const r = script.shift()
  if (!r) throw new Error('剧本用尽：模型不该再发第 N 次请求')
  return r
}
const reply = (calls, text = null) => ({ text, calls, model: 'stub-controlled', finishReason: 'tool_calls', usage: { total: 1 } })
const fin = (args) => ({ id: 'c1', name: 'finish_preparation', args: JSON.stringify(args) })
const know = (name, args) => ({ id: 'k1', name, args: JSON.stringify(args) })

const server = await createServer({
  // 只服务 git HEAD(df97022) 的 src 快照：A 正在改 src/lib/prep.ts，必须对冻结点复核
  root: join(here, ROOT),
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { '@tauri-apps/api/core': join(here, 'lib', 'invoke-stub.mjs') } },
  optimizeDeps: { noDiscovery: true },
})
let prep
try {
  prep = await server.ssrLoadModule('/src/lib/prep.ts')
} catch (e) {
  console.error('加载生产模块失败：', e)
  process.exit(1)
}
console.log('生产模块加载成功；MAX_PREP_CALLS =', prep.MAX_PREP_CALLS)

const baseMsgs = [
  { role: 'system', content: '（E 复核用的最小 system 占位）' },
  { role: 'user', content: 'E 复核：受控请求占位' },
]

async function run(label, s) {
  script = s.slice(); seen = []
  const out = await prep.runPrep(baseMsgs, { runId: 'E-' + label })
  rec.requests.push({ label, count: seen.length })
  return out
}

// ---- 场景 1（对照）：compose 不带 text → 应当被接受为 compose
{
  const out = await run('compose-without-text', [reply([fin({ outcome: 'compose', assetPolicy: 'preserve' })])])
  check('P1 不带 text 的 compose 被接受', out.mode === 'prep' && out.kind === 'compose', `out=${out.mode}/${out.kind}`)
  check('P1 只发 1 次请求', seen.length === 1, `requests=${seen.length}`)
}

// ---- 场景 2（原缺陷）：compose 带 text → 整条拒绝
{
  const out = await run('compose-with-text', [
    reply([fin({ outcome: 'compose', text: '我按默认排版来写，如果想调整告诉我。', assetPolicy: 'preserve' })]),
  ])
  rec.requests.at(-1).outcome = `${out.mode}/${out.kind}${out.failure ? '/' + out.failure : ''}`
  rec.requests.at(-1).reason = out.reason ?? null
  check('P2 compose 带 text 被整条拒绝', out.mode === 'prep' && out.kind === 'failed' && out.failure === 'protocol', `out=${out.mode}/${out.kind}/${out.failure}`)
  check('P2 拒绝原因指出互斥', /互斥/.test(out.reason || ''), out.reason || '(无)')
}

// ---- 场景 3（缺陷的决定性反例）：前面已经花掉 1 次预算(知识工具)，第 2 次才是非法终结
//      预算还剩 1 次，实现是否追问/纠偏？按 T3 的要求"剩余预算内纠偏"，这里应当仍有第 3 次请求。
{
  const out = await run('knowledge-then-bad-terminal-with-budget-left', [
    reply([know('load_knowledge', { path: '排版引擎/engine-write-protocol' })]),
    reply([fin({ outcome: 'compose', text: '附一句说明。', assetPolicy: 'preserve' })]),
  ])
  rec.requests.at(-1).outcome = `${out.mode}/${out.kind}${out.failure ? '/' + out.failure : ''}`
  rec.requests.at(-1).reason = out.reason ?? null
  check('P3 预算剩 1 次时仍不发纠偏请求（缺陷）', seen.length === 2, `实际请求数=${seen.length}（MAX=3，剩余预算未使用）`)
  check('P3 该回合以 protocol 失败收尾', out.kind === 'failed' && out.failure === 'protocol', `${out.kind}/${out.failure}`)
}

// ---- 场景 4：被拒时**不**产生写作授权、不写坏旧稿
{
  const s = [reply([fin({ outcome: 'compose', text: 'x', assetPolicy: 'preserve' })])]
  const out = await run('rejected-does-not-authorize', s)
  check('P4 被拒后没有 compose/candidate 产出', !(out.kind === 'compose' || out.kind === 'candidate'), `kind=${out.kind}`)
  check('P4 返回 failed 而不是静默降级', out.kind === 'failed', `kind=${out.kind}`)
}

// ---- 场景 5：candidate 带 text 同样被拒（同类，用于界定缺陷范围）
{
  const out = await run('candidate-with-text', [
    reply([fin({ outcome: 'candidate', text: '顺手说明', source: '正文第一行\n正文第二行', assetPolicy: 'preserve' })]),
  ])
  check('P5 candidate 带 text 也被整条拒绝', out.kind === 'failed' && out.failure === 'protocol', `${out.kind}/${out.failure}`)
}

await server.close()
rec.finishedAt = new Date().toISOString()
writeFileSync(join(outDir, `repro-a-${ROOT}.json`), JSON.stringify(rec, null, 2))
console.log('\n请求计数：', JSON.stringify(rec.requests))
console.log('写出：', join(outDir, `repro-a-${ROOT}.json`))
