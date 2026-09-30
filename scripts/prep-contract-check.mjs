// prep-contract-check.mjs —— 准备阶段结果契约的回归（DS 修复指南 包 A / 包 C）
//
// 用法：
//   node scripts/prep-contract-check.mjs [outDir] [URL]
//
// 打的是**真实 `runPrep`**（经本地 Vite 引入生产模块），只把 Rust 侧 `prep_turn` 的返回 stub 掉。
// 不走浏览器 `mode:'skip'` 那条捷径——那条路径什么都不会验证。
//
// 覆盖（DS 指南 §5.2 / §5.3 / §5.5）：
//   · 合法终结工具 reply / compose / candidate 各自被机械执行；
//   · **当前入口只认合法终结结果**：历史创作布尔值不再参与授权（`runPrep` 已无此入参）；
//     READY / 说明+READY / 自由围栏 / 无回执的完成宣称 → 预算内请模型规范声明，
//     拿不到就 protocol/exhausted 失败，**不自行授权**，也不丢弃原文（`failed.raw`）；
//   · 第三次合法终结仍要执行（不会因为纠偏就少一次机会），无第 4 次请求；
//   · 严格参数：顶层非对象 / outcome 非字符串 / reply 缺 text / compose|candidate 缺 assetPolicy /
//     assetPolicy 非法 / candidate source 非字符串或为空 / 互斥字段 → 全部 protocol 失败，
//     **不做类型转换、不补默认值**；
//   · 一份响应**只接受知识工具集合或一次终结**：混用与多终结都判协议错误；
//   · 回合内重复的知识读取复用缓存（同一工具+参数只执行一次）；
//   · 本回合用户 images 随 prep 消息一并送出（不被重建消息丢掉）；
//   · 全程不联网、不调模型、不写真实工作区。
//
// 判定器（指南 §3.1）：唯一 RunResult，stdout / JSON / Markdown / 退出码都由它派生；
// 异常 → ERROR，缺依赖 → BLOCKED，零检查 → ERROR；finally 只落盘与关资源。
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const CONFIG_HINT = `配置方法（与 verify-ui.mjs 同一口径）：
  export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
  export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"`

const run = {
  script: 'prep-contract-check',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED',
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [],
  errors: [],
  sourceHashes: {},
}
for (const rel of ['src/lib/prep.ts', 'src/App.tsx']) {
  run.sourceHashes[rel] = createHash('sha256').update(readFileSync(join(repoRoot, rel))).digest('hex')
}
const check = (id, pass, ...evidence) => {
  run.checks.push({ id, pass: Boolean(pass), evidence: evidence.map((e) => String(e ?? '')) })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${evidence.filter(Boolean).length ? ' (' + evidence.filter(Boolean).join(' / ') + ')' : ''}`)
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[prep-contract-check] ERROR@${stage}: ${message}`)
}
function dieBlocked(msg) {
  fail('deps', msg)
  run.blockedReason = msg
  console.error(`\n${CONFIG_HINT}\n`)
  finalize()
  process.exit(2)
}
function resolvePlaywright() {
  try {
    return require('playwright')
  } catch (e) {
    const p = process.env.VERIFY_PLAYWRIGHT
    if (!p) dieBlocked(`解析不到 playwright：require 失败（${String(e.message || e).split('\n')[0]}），且未设置 VERIFY_PLAYWRIGHT`)
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return require(target)
    } catch (e2) {
      dieBlocked(`VERIFY_PLAYWRIGHT=${target} 仍解析失败：${String(e2.message || e2).split('\n')[0]}`)
    }
  }
}
function resolveChromium() {
  const p = process.env.VERIFY_CHROMIUM
  if (!p) return null
  const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
  if (!existsSync(target)) dieBlocked(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
  return target
}
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const outDirArg = process.argv[2]
const outDir = outDirArg || join('docs', 'artifacts', `${localDate()}-prep-contract-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)
const base = process.argv[3] || 'http://127.0.0.1:1420'
if (outDirArg && existsSync(join(outDir, 'result.md'))) {
  fail('outDir', `输出目录已存在同名结果，拒绝覆盖：${outDir}`)
  finalize()
  process.exit(2)
}

// 依赖探测必须放在 outDir 初始化之后：解析不到 playwright 时 dieBlocked 会调 finalize()，
// 而 finalize() 要往 outDir 落 run-result.json；提前到这里之前会撞 TDZ
// （ReferenceError: Cannot access 'outDir' before initialization）——静默退出、不落判定文件。
const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromium()

const V2 = '[[theme:校园]]\n\n## 周末到馆提醒\n\n各位读者：\n\n- **10月10日（周六）**：9:00-17:00 开放。\n- **10月11日（周日）**：全天闭馆。\n\n咨询电话：**010-55556666**'
const FENCE = (s) => '```v2\n' + s + '\n```'

/** 每个用例：一串「第 N 次 prep_turn 的返回」，按顺序消耗（超出后重复最后一条） */
const CASES = [
  {
    name: 'valid-compose',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'compose', assetPolicy: 'preserve', calls: 2, digestHasKnowledge: true },
  },
  {
    name: 'valid-reply',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":"请问面向哪类读者？"}' }] }],
    want: { kind: 'reply', calls: 1, textIncludes: '哪类读者' },
  },
  {
    name: 'valid-candidate',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: V2, assetPolicy: 'modify' }) }] },
    ],
    want: { kind: 'candidate', assetPolicy: 'modify', calls: 2, sourceIncludes: '周末到馆提醒' },
  },
  {
    // 旧协议：只回 READY → 纠偏后仍只回 READY → 协议失败，**不**自行升级成 compose。
    // 原文必须保留在 failed.raw 里（"旧完整稿不得丢弃"）。
    name: 'ready-only-no-longer-authorized',
    replies: [
      { text: '需要的信息已齐备，这就不再多问，进入撰写。\n\nREADY', calls: [] },
      { text: '需要的信息已齐备。\n\nREADY', calls: [] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, rawIncludes: 'READY', correctionSent: true },
  },
  {
    // 旧协议：只贴一段完整 v2 → 纠偏后仍不声明 → 协议失败，原文保留（不自行授权、不丢弃）
    name: 'fenced-v2-without-declaration',
    replies: [
      { text: '已按你的要求改好：标题换成「周末到馆提醒」。\n\n' + FENCE(V2), calls: [] },
      { text: FENCE(V2), calls: [] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, rawIncludes: '周末到馆提醒', correctionSent: true },
  },
  {
    // 纠偏之后的**合法终结**必须照常执行（模型学会新协议的那条路）
    name: 'fenced-v2-then-declares-candidate',
    replies: [
      { text: FENCE(V2), calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: V2, assetPolicy: 'preserve' }) }] },
    ],
    want: { kind: 'candidate', assetPolicy: 'preserve', calls: 2, sourceIncludes: '周末到馆提醒', correctionSent: true },
  },
  {
    // R2 场景（指南 §5.2）：历史里有创作请求，**本回合**只是问一句普通问题，
    // 模型回「NOT READY」。旧实现用历史布尔值把它判成创作请求 → 变成 compose。
    // 现在：不授权 → 协议失败（明确失败，不是偷偷写稿）。
    name: 'r2-history-creation-plain-question-not-ready',
    history: [
      { role: 'user', content: '帮我写一篇校园图书馆开放通知，直接出稿。' },
      { role: 'assistant', content: '好的，已写好。' },
    ],
    userText: '请解释 NOT READY 这个词是什么意思，暂时不要编辑文稿。',
    replies: [
      { text: 'NOT READY', calls: [] },
      { text: 'NOT READY 是旧协议里的"尚未就绪"标记。', calls: [] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, rawIncludes: 'NOT READY', correctionSent: true },
  },
  {
    // R2 的第二个形态：只要求看 v2 语法示例 → 不能把示例当稿子提交。
    // 纠偏后模型改成合法 reply → 正常答复，0 提交。
    name: 'r2-v2-example-then-declares-reply',
    history: [
      { role: 'user', content: '帮我写一篇校园图书馆开放通知，直接出稿。' },
      { role: 'assistant', content: '好的，已写好。' },
    ],
    userText: '给我看看 v2 语法长什么样，只是举例，不要改文稿。',
    replies: [
      { text: 'v2 语法大概是这样：\n\n' + FENCE(V2), calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":"上面就是 v2 的大致写法，只是举例。"}' }] },
    ],
    want: { kind: 'reply', calls: 2, correctionSent: true, textIncludes: '只是举例' },
  },
  {
    // 纯普通答复（既没有控制词也没有围栏）：一次请求、直接 reply
    name: 'plain-chat-answer',
    history: [
      { role: 'user', content: '帮我写一篇校园图书馆开放通知，直接出稿。' },
      { role: 'assistant', content: '好的，已写好。' },
    ],
    userText: '顺便说说公众号推文的开头怎么写比较好？',
    replies: [{ text: '开头三秒抓人，先给结论再给理由。', calls: [] }],
    want: { kind: 'reply', calls: 1, textIncludes: '三秒' },
  },
  {
    // 严格参数：compose 缺 assetPolicy → 协议失败（不补默认值）
    name: 'strict-missing-assetPolicy',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：assetPolicy 非法值 → 协议失败
    name: 'strict-bad-assetPolicy',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"keep"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：candidate 的 source 不是字符串 → 协议失败（不做 String() 硬转）
    name: 'strict-candidate-source-not-string',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"candidate","source":{"a":1},"assetPolicy":"preserve"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：candidate source 为空串 → 协议失败
    name: 'strict-candidate-source-blank',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"candidate","source":"   ","assetPolicy":"preserve"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：reply 的 text 不是字符串（数值）→ 协议失败，不转成 "123"
    name: 'strict-reply-text-not-string',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":123}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：互斥字段（reply 同时给 source）
    name: 'strict-exclusive-fields',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'reply', text: '好的', source: V2 }) }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：顶层是数组 → 协议失败（不抛未分类异常）
    name: 'strict-top-level-array',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '[]' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：顶层是 null → 协议失败
    name: 'strict-top-level-null',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: 'null' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：outcome 不是字符串
    name: 'strict-outcome-not-string',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":3}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 多个终结工具 → 协议错误，不从多份稿件里猜一个
    name: 'two-terminal-tools',
    replies: [
      {
        text: null,
        calls: [
          { id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' },
          { id: 'f2', name: 'finish_preparation', args: '{"outcome":"reply","text":"你好"}' },
        ],
      },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 知识工具与终结工具**混用** → 协议错误（本轮明确采用的验收规则）
    name: 'knowledge-mixed-with-terminal',
    replies: [
      {
        text: null,
        calls: [
          { id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
          { id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' },
        ],
      },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 第三次合法终结仍要执行（预算 3 次：知识 → 空回复 → 合法终结）
    name: 'third-call-legal-terminal-executes',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: '', calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"modify"}' }] },
    ],
    want: { kind: 'compose', assetPolicy: 'modify', calls: 3 },
  },
  {
    // 三次空回复 → exhausted（没有第 4 次请求）
    name: 'exhausted-empty-replies',
    replies: [{ text: '', calls: [] }, { text: '', calls: [] }, { text: '', calls: [] }, { text: '', calls: [] }],
    want: { kind: 'failed', failure: 'exhausted', calls: 3 },
  },
  {
    // 回合内重复读取同一份知识 → 只执行一次（缓存），但两次 tool 结果都要回给模型
    name: 'duplicate-knowledge-reads-cached',
    replies: [
      {
        text: null,
        calls: [
          { id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
          { id: 'k2', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
        ],
      },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'compose', calls: 2, prepProgressCount: 1 },
  },
  {
    // 本回合附带参考图 → 必须随用户消息进 prep（不被消息重建丢掉）
    name: 'images-preserved-into-prep',
    images: ['data:image/png;base64,iVBORw0KGgo='],
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":"图我看到了。"}' }] }],
    want: { kind: 'reply', calls: 1, firstInvokeUserHasImages: true },
  },
]

run.plannedCases = CASES.map((c) => c.name)

let rows = []
const pageErrors = []
let browser = null
try {
  browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
  const page = await browser.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
  } catch (e) {
    fail('navigate', `打开 ${base} 失败：${String(e.message || e).split('\n')[0]}`)
  }
  if (!run.errors.length) {
    try {
      rows = await page.evaluate(
        async ({ cases }) => {
          const { runPrep, parseFinishArgs, extractV2Source, MAX_PREP_CALLS } = await import('/src/lib/prep.ts')
          const out = []
          for (const c of cases) {
            const invokes = []
            const progress = []
            window.__TAURI_INTERNALS__ = {
              invoke: async (cmd, args) => {
                if (cmd !== 'prep_turn') throw new Error('Unexpected invoke: ' + cmd)
                invokes.push(args)
                const reply = c.replies[Math.min(invokes.length - 1, c.replies.length - 1)]
                return reply ?? { text: '', calls: [] }
              },
            }
            const msgs = [
              { role: 'system', content: '离线契约检查。' },
              ...(c.history || []),
              { role: 'user', content: c.userText || '请只把正文缩到 180 字以内，标题改为「周末到馆提醒」。', ...(c.images ? { images: c.images } : {}) },
            ]
            let outcome
            let threw = null
            try {
              outcome = await runPrep(msgs, {
                runId: 'offline-prep-' + c.name,
                onProgress: (e) => progress.push(e),
                hasPriorBindings: true,
              })
            } catch (e) {
              threw = String(e)
              outcome = null
            }
            delete window.__TAURI_INTERNALS__
            out.push({
              name: c.name,
              invokeCount: invokes.length,
              secondHasToolResult: Boolean(invokes[1] && invokes[1].messages.some((m) => m.role === 'tool')),
              firstInvokeUserHasImages: Boolean(
                invokes[0] && invokes[0].messages.some((m) => m.role === 'user' && Array.isArray(m.images) && m.images.length),
              ),
              // 纠偏请求：必须识别**实际追加的纠偏轮**（内容为 PREP_CORRECTION），
              // 不能因为初始提示里也含 finish_preparation 就恒真（旧脚本的弱断言）。
              correctionSent: invokes.slice(1).some((i) => i.messages.some((m) => m.role === 'user' && String(m.content).includes('请改用 finish_preparation'))),
              outcome,
              threw,
              progressPhases: progress.map((p) => p.phase),
              maxCalls: MAX_PREP_CALLS,
            })
          }
          // 纯函数边界（严格参数逐条可证伪）
          const pure = {
            multipleFencesIsNull: extractV2Source('```v2\na\n```\n```v2\nb\n```') === null,
            singleFenceOk: extractV2Source('```v2\nA\n```') === 'A',
            unclosedFenceIsNull: extractV2Source('```v2\nA') === null,
            replyWithoutTextRejected: parseFinishArgs('{"outcome":"reply"}').ok === false,
            unknownOutcomeRejected: parseFinishArgs('{"outcome":"wat"}').ok === false,
            badJsonRejected: parseFinishArgs('{oops').ok === false,
            topLevelArrayRejected: parseFinishArgs('[]').ok === false,
            topLevelNullRejected: parseFinishArgs('null').ok === false,
            topLevelNumberRejected: parseFinishArgs('3').ok === false,
            emptyObjectRejected: parseFinishArgs('{}').ok === false,
            composeWithoutPolicyRejected: parseFinishArgs('{"outcome":"compose"}').ok === false,
            candidateNonStringSourceRejected: parseFinishArgs('{"outcome":"candidate","source":7,"assetPolicy":"preserve"}').ok === false,
            replyNumberTextRejected: parseFinishArgs('{"outcome":"reply","text":9}').ok === false,
            exclusiveFieldsRejected: parseFinishArgs('{"outcome":"reply","text":"a","source":"b"}').ok === false,
            composeAcceptsExplicitPolicy:
              (() => {
                const r = parseFinishArgs('{"outcome":"compose","assetPolicy":"preserve"}')
                return r.ok && r.kind === 'compose' && r.assetPolicy === 'preserve'
              })(),
            candidateAcceptsExplicitPolicy:
              (() => {
                const r = parseFinishArgs(JSON.stringify({ outcome: 'candidate', source: 'A', assetPolicy: 'modify' }))
                return r.ok && r.kind === 'candidate' && r.assetPolicy === 'modify'
              })(),
          }
          return { rows: out, pure }
        },
        { cases: CASES },
      )
    } catch (e) {
      fail('evaluate', String(e.message || e).split('\n')[0])
    }
  }
} catch (e) {
  fail('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
} finally {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'raw.json'), JSON.stringify({ rows, pageErrors, run }, null, 2) + '\n')
  if (browser) await browser.close().catch(() => {})
}

const thin = (o) =>
  o
    ? {
        mode: o.mode,
        kind: o.kind,
        failure: o.failure,
        assetPolicy: o.assetPolicy,
        text: o.text,
        raw: o.raw ? o.raw.slice(0, 40) + '…' : undefined,
        source: o.source ? o.source.slice(0, 40) + '…' : undefined,
        digest: o.digest ? '[有知识摘要]' : undefined,
      }
    : null

if (!run.errors.length && rows.rows) {
  for (const [i, c] of CASES.entries()) {
    const r = rows.rows[i]
    if (!r) {
      fail(`case:${c.name}`, '没有采集到该用例的结果')
      continue
    }
    const o = r.outcome
    run.executedCases.push(c.name)
    console.log(`\n[${c.name}] ${JSON.stringify({ invokes: r.invokeCount, outcome: thin(o), threw: r.threw })}`)
    check(`${c.name}：没有抛异常`, !r.threw, r.threw || '')
    check(`${c.name}：请求次数等于预期（无第 4 次准备请求）`, r.invokeCount === c.want.calls, `实测 ${r.invokeCount}（期望 ${c.want.calls}，上限 ${r.maxCalls}）`)
    check(`${c.name}：结果类型 = ${c.want.kind}`, o && o.mode === 'prep' && o.kind === c.want.kind, `实测 ${o ? o.mode + '/' + o.kind : 'null'}`)
    if (c.want.failure) check(`${c.name}：失败分类 = ${c.want.failure}`, o && o.failure === c.want.failure, `实测 ${o && o.failure}`)
    if (c.want.assetPolicy) check(`${c.name}：assetPolicy = ${c.want.assetPolicy}`, o && o.assetPolicy === c.want.assetPolicy, `实测 ${o && o.assetPolicy}`)
    if (c.want.textIncludes) check(`${c.name}：答复文本已带出`, o && String(o.text || '').includes(c.want.textIncludes), o && o.text)
    if (c.want.sourceIncludes) check(`${c.name}：正文进入交付（不是只存聊天）`, o && String(o.source || '').includes(c.want.sourceIncludes), o && String(o.source || '').slice(0, 40))
    if (c.want.rawIncludes) check(`${c.name}：未形成合法终结的原文被保留（failed.raw）`, o && String(o.raw || '').includes(c.want.rawIncludes), o && String(o.raw || '').slice(0, 40))
    if (c.want.digestHasKnowledge) check(`${c.name}：知识摘要随结果带出`, o && Boolean(o.digest), '')
    if (c.want.correctionSent) check(`${c.name}：确实追加过一次协议纠偏请求`, r.correctionSent, `纠偏请求已发出=${r.correctionSent}`)
    if (c.want.correctionSent === undefined) check(`${c.name}：不该发纠偏时没有发`, !r.correctionSent, `纠偏请求已发出=${r.correctionSent}`)
    if (c.want.prepProgressCount !== undefined) {
      const prepCount = r.progressPhases.filter((x) => x === 'prep').length
      check(`${c.name}：知识工具只执行一次（重复读取复用回合内缓存）`, prepCount === c.want.prepProgressCount, `prep 上报 ${prepCount} 次（期望 ${c.want.prepProgressCount}）`)
    }
    if (c.want.firstInvokeUserHasImages) check(`${c.name}：本回合参考图随用户消息送到了模型`, r.firstInvokeUserHasImages, `首次请求含 images=${r.firstInvokeUserHasImages}`)
    const thinkCount = r.progressPhases.filter((x) => x === 'think').length
    check(`${c.name}：每次模型往返恰好一次 think 阶段上报`, thinkCount === r.invokeCount, `think×${thinkCount}，往返 ${r.invokeCount} 次`)
    const firstHasKnowledge = Boolean(c.replies[0] && c.replies[0].calls.some((x) => x.name !== 'finish_preparation'))
    if (firstHasKnowledge && r.invokeCount > 1 && o && o.kind !== 'failed') {
      check(`${c.name}：前一轮的知识工具结果确实回传给了模型`, r.secondHasToolResult, `第二次请求含 tool 消息=${r.secondHasToolResult}`)
    }
  }

  const pure = rows.pure
  console.log('')
  for (const [k, v] of Object.entries(pure || {})) check(`纯函数边界：${k}`, v === true, String(v))

  // ---- 接线断言（App 侧）：指南 §5.2"移除历史创作布尔值对兼容授权的作用" ----
  // 这是结构断言，不是行为断言：行为断言在 prep-contract-check 的 runPrep 层（R2 两个用例），
  // 这里只钉住"那两条入参不会被人重新接回来"。
  const appSrc = readFileSync(join(repoRoot, 'src/App.tsx'), 'utf8')
  check('接线：App 不再有 creationContract 入参（历史创作布尔值不参与授权）', !/creationContract/.test(appSrc))
  check('接线：App 不再有 creativeSession 历史创作态变量', !/creativeSession/.test(appSrc))
  check('接线：App 调用 runPrep 时不传任何授权开关', /runPrep\(baseMsgs, \{/.test(appSrc) && !/runPrep\(baseMsgs, \{[\s\S]{0,200}creationContract/.test(appSrc))
  check('接线：读取当前文稿失败会终止本轮（不是 console.warn 后继续）', !/当前文稿读取失败，本轮按"没有已验收旧稿"处理/.test(appSrc))

  check('全程无页面异常', pageErrors.length === 0, pageErrors.join(' / '))
  run.executionComplete = run.executedCases.length === run.plannedCases.length
}

function finalize() {
  const hasFail = run.checks.some((c) => !c.pass)
  if (run.blockedReason) run.status = 'BLOCKED'
  else if (run.errors.length) run.status = 'ERROR'
  else if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'completeness', message: `计划 ${run.plannedCases.length} 个用例，实际执行 ${run.executedCases.length} 个` })
  } else if (run.checks.length === 0) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'checks', message: '零条检查：不能算通过' })
  } else if (hasFail) run.status = 'FAIL'
  else run.status = 'PASS'
  run.finishedAt = new Date().toISOString()
  mkdirSync(outDir, { recursive: true })
  const passed = run.checks.filter((c) => c.pass).length
  writeFileSync(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  writeFileSync(
    join(outDir, 'result.md'),
    `# 准备阶段结果契约 —— 回归\n\n状态：**${run.status}**（executionComplete=${run.executionComplete}，检查 ${passed}/${run.checks.length} 通过）\n` +
      `时间：${run.startedAt} → ${run.finishedAt}\n入口：\`node scripts/prep-contract-check.mjs ${outDirArg || '(默认)'} ${base}\`\n` +
      `被测：\`src/lib/prep.ts\`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）+ \`src/App.tsx\` 接线断言\n` +
      `源码哈希：\`${JSON.stringify(run.sourceHashes)}\`\n\n` +
      (run.errors.length ? `## 错误\n\n${run.errors.map((e) => `- [${e.stage}] ${e.message}`).join('\n')}\n\n` : '') +
      `\`\`\`\n${run.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} - ${c.id}${c.evidence.filter(Boolean).length ? ' (' + c.evidence.filter(Boolean).join(' / ') + ')' : ''}`).join('\n')}\n\`\`\`\n`,
    'utf8',
  )
  console.log('')
  console.log(`  产出留档：${outDir}`)
  console.log(`PREP-CONTRACT ${run.status}`)
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}

finalize()
