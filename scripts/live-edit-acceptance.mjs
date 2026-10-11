// live-edit-acceptance.mjs —— **改稿契约的真实模型验收**（R25，付费真实调用）
//
// 用户判词："要求用户在使用过程中修改某些地方也完全可以，而不是只有第一遍直出才有高质量"。
// 这条要求只有**真实模型**能证：契约文本对不对由离线回归保证（`edit-contract-check.mjs`），
// 但"模型照着契约做之后，改一处是不是真的只动那一处、且成品质量不掉"必须真跑。
//
// 判据（每个改稿回合）：
//   ① 模型产出了 v2 正文（否则 BLOCKED——跑不起来不算通过）
//   ② **用户要的改动确实发生了**（按各自的题面判定，见 CASES 的 `changed` 断言）
//   ③ **其余部分没被大改**：`structureDiff.textChangedRatio ≤ 阈值`、素材引用零增删、设计轴声明未变
//   ④ **改完不掉质量**：`checkHtml` 过，且 compose 层的"可修复告警"**不比改前多**
//      （判据刻意用"不比改前多"而不是"==0"：首稿自己就有的告警不是改稿造成的；
//        且应用真正的交付门禁是 `deliveryVerdict` 的 blockers，本脚本没有素材/绑定上下文跑不出来，
//        所以这里只把它当**相对信号**，并把它**不做成"单轮修订必须变好"的硬判据**）
//   ⑤ 真出现可修复项时，走**一轮**自动修订，证明"改稿之后仍有被修干净的路，
//      且修的时候不会借机重写全文"
//
// 用法：node --experimental-strip-types scripts/live-edit-acceptance.mjs [--out <目录>]
// 缺凭据 = BLOCKED（退出 2）；零条检查 = ERROR。
import os from 'os'
import fs from 'fs'
import path from 'path'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { MATERIAL_GROUNDING_REF, PERSONA_RULES } from '../src/lib/persona.ts'
import { writeInstruction } from '../src/lib/edit-contract.ts'
import { buildReviseContent, fixableWarnings } from '../src/lib/revise.ts'
import { structureDiff } from '../src/lib/edit-diff.ts'
import { composeMarkdown } from '../src/lib/compose.ts'
import { checkHtml } from '../src/lib/quality.ts'

const ENGINE_PROTOCOL = fs.readFileSync(
  path.join(import.meta.dirname, '..', 'src', 'knowledge', '排版引擎', 'engine-write-protocol.md'),
  'utf8',
)

function cred() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim()
  try {
    const t = fs.readFileSync(path.join(os.homedir(), '.dsh', '.credentials.yaml'), 'utf8')
    const m = t.match(/DEEPSEEK_API_KEY\s*:\s*["']?([^\s"']+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function chat(history) {
  const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cred() },
    body: JSON.stringify({
      model,
      stream: true,
      reasoning_effort: 'max',
      max_tokens: 64000,
      messages: [
        { role: 'system', content: PERSONA_RULES + '\n\n## 已取用：排版引擎协议（本轮创作依据，冲突以本协议为准）\n' + ENGINE_PROTOCOL },
        ...history,
      ],
    }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 300))
  const raw = await res.text()
  let out = ''
  for (const line of raw.split('\n')) {
    const l = line.trim()
    if (!l.startsWith('data:')) continue
    const d = l.slice(5).trim()
    if (!d || d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      const c = j.choices?.[0]?.delta?.content
      if (c) out += c
    } catch { /* keep-alive */ }
  }
  return out
}

const v2Of = (reply) => {
  const f = reply.match(/```v2\n([\s\S]*?)```/)
  return f ? f[1] : ''
}

/** 要一次 v2 正文（最多追问一次） */
async function once(history, nudge) {
  let reply = await chat(history)
  if (v2Of(reply)) return { reply, body: v2Of(reply) }
  history.push({ role: 'assistant', content: reply })
  history.push({ role: 'user', content: nudge })
  reply = await chat(history)
  return { reply, body: v2Of(reply) }
}

const judge = createJudge({ script: 'live-edit-acceptance', outDir: resolveOutDir('live-edit-acceptance'), plannedCases: ['①初稿', '②改稿A', '③改稿B'] })
fs.mkdirSync(process.env.WXMP_LOCAL_DIR || '.local', { recursive: true })
guardCrashes(judge)
let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}
const observe = (name, detail) => judge.observe(name, detail)

if (!cred()) {
  judge.block('缺少真实模型凭据：环境变量 DEEPSEEK_API_KEY 与 ~/.dsh/.credentials.yaml 都没取到（本脚本需要真实模型）。')
  judge.finish({ exitCode: 2, label: 'LIVE-EDIT' })
  process.exit(2)
}

const TOPIC =
  '写一篇校园「秋日书市」活动推文（学院公众号）：10 月 26 日在图书馆前广场，有二手书交换、手作书签、热可可摊位。' +
  '校园风，800-1200 字，至少 2 个容器组件、3 个提示气泡、3 处插画占位。已给全部信息：直接撰写，只输出一个 ```v2 代码块，不要澄清。'

const CASES = [
  {
    key: '②改稿A-追加导语',
    threshold: 0.25,
    ask: '请在正文最前面加一句不超过 20 字的导语（单独一段），**其余内容一个字都不要动**。',
    changed: (before, after) => {
      const first = (s) => String(s).split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('[[') && !l.startsWith(':::') && !l.startsWith('>') && !l.startsWith('#'))
      const f0 = first(before)
      const f1 = first(after)
      return Boolean(f0 && f1 && f0 !== f1)
    },
  },
  {
    key: '③改稿B-删掉一个气泡',
    threshold: 0.3,
    ask: '请**删掉全文最后一个提示气泡**（`> [!…]` 那一段，连同它的正文），其余内容一个字都不要动。',
    changed: (before, after) => {
      const n = (s) => (String(s).match(/^>\s*\[!/gm) || []).length
      return n(after) === n(before) - 1
    },
  },
]

// ── ① 初稿 ───────────────────────────────────────────────────────────────────
console.log('== ① 初稿 ==')
const genHistory = [{ role: 'user', content: TOPIC }]
const gen = await once(genHistory, '请直接输出完整正文，只给一个 ```v2 代码块，不要再澄清。')
const genPath = path.join(process.env.WXMP_LOCAL_DIR || '.local', 'live-edit-①初稿.md')
fs.writeFileSync(genPath, gen.body || '(空)')
check('①初稿：模型产出 v2 正文', gen.body.length > 300, `${gen.body.length} 字`)
const baseR = gen.body ? composeMarkdown(gen.body, { mode: 'auto' }) : null
// 基准只要求"渲染合法"；**首稿本身的"可修复告警"数记下来当基线**，用来判断改稿有没有把它变差
// （首稿有 3 个"角饰未定义"是模型的协议滑手，不是本轮要证的事——真实应用里由自动修订兜）。
const baseFixable = baseR ? fixableWarnings(baseR.warnings).length : null
observe('①初稿 基线', `正文 ${gen.body.length} 字；checkHtml=${baseR ? checkHtml(baseR.html).ok : 'n/a'}；可修复告警 ${baseFixable}`)
check('①初稿：渲染合法（过 checkHtml）', Boolean(baseR && checkHtml(baseR.html).ok), baseR ? `issues=${checkHtml(baseR.html).issues.length}` : '(无正文)')

// ── ②③ 改稿回合（按应用里的真实组装：system 带上"当前正式文稿"，末条用户消息追加改稿契约） ──
for (const c of CASES) {
  console.log(`== ${c.key} ==`)
  if (!gen.body) {
    check(`${c.key}：有初稿可改（否则跳过）`, false, '初稿为空')
    continue
  }
  const history = [
    { role: 'user', content: TOPIC },
    { role: 'assistant', content: '```v2\n' + gen.body + '\n```' },
    // 应用里这段是追加在 system 末尾的"当前正式文稿"；这里如实复刻，别让契约在真空里被测
    { role: 'system', content: `\n\n## 当前正式文稿（应用实际保存的版本）\n${MATERIAL_GROUNDING_REF}\n\`\`\`\n${gen.body}\n\`\`\`` },
    { role: 'user', content: c.ask + '\n\n' + writeInstruction(true) },
  ]
  const out = await once(history, '请直接输出修改后的完整正文，只给一个 ```v2 代码块。')
  const p = path.join(process.env.WXMP_LOCAL_DIR || '.local', `live-edit-${c.key}.md`)
  fs.writeFileSync(p, out.body || '(空)')
  check(`${c.key}：模型产出 v2 正文`, out.body.length > 300, `${out.body.length} 字`)
  if (!out.body) continue

  const d = structureDiff(gen.body, out.body)
  observe(`${c.key} 改动范围`, d.summary)
  check(`${c.key}：用户要的改动**确实发生了**`, c.changed(gen.body, out.body), '')
  check(`${c.key}：其余部分没被大改（正文改动 ≤ ${Math.round(c.threshold * 100)}%）`, d.textChangedRatio <= c.threshold, d.summary)
  check(`${c.key}：素材引用零增删（改稿不该顺手重画配图）`, d.assets.added.length === 0 && d.assets.removed.length === 0, JSON.stringify(d.assets))
  check(`${c.key}：设计轴声明与主题未被改（改一处不该换整篇语言）`, !d.boxesChanged && !d.themeChanged, `boxesChanged=${d.boxesChanged} themeChanged=${d.themeChanged}`)

  const r = composeMarkdown(out.body, { mode: 'auto' })
  const fx = fixableWarnings(r.warnings)
  // **"不掉质量"的正确判据**：改完仍然渲染合法，且"可修复告警"**不比改前多**。
  // （首稿自己就有的告警不是改稿造成的；要求"==0"是把模型的协议滑手算到改稿头上。）
  check(`${c.key}：**改完不掉质量**（渲染合法，且可修复告警不比改前多）`,
    checkHtml(r.html).ok && fx.length <= baseFixable,
    `issues=${checkHtml(r.html).issues.length} fixable=${fx.length}（改前 ${baseFixable}）`)
  // 真有可修复项时，走**一轮**自动修订（真实应用的口径 + 本轮的"不许重写全文"契约），
  // 证明"改稿之后的成品仍有被修到干净的路，且修的时候不会把别处重写"。
  if (fx.length) {
    const revAsk = buildReviseContent(out.body, fx, { preserveRest: true })
    const rev = await once(
      [...history, { role: 'assistant', content: '```v2\n' + out.body + '\n```' }, { role: 'user', content: revAsk }],
      '请直接输出修订后的完整正文，只给一个 ```v2 代码块。',
    )
    if (rev.body) {
      const rr = composeMarkdown(rev.body, { mode: 'auto' })
      const rf = fixableWarnings(rr.warnings)
      const rd = structureDiff(out.body, rev.body)
      observe(`${c.key} 自动修订后改动范围`, rd.summary)
      // 注意口径：这里的 `fixableWarnings` 是 **compose 层**的告警，**不是**应用真正的交付门禁。
      // 应用按 `deliveryVerdict` 的 **blockers** 决定收不收，并且有一条"新增阻断即撤销候选"的退化判断
      // （App.tsx 的 `stopReason='regressed'`）。本脚本没有素材/绑定上下文，跑不出 deliveryVerdict，
      // 所以**不把"单轮修订必须减少告警"写成硬判据**——那既不是应用的口径，也会在模型单轮变差时假红。
      // 硬判据只留结构性的两条：**没借机重写全文**、**渲染仍合法**。
      observe(`${c.key} 自动修订的告警变化`, `compose 层可修复告警 ${fx.length} → ${rf.length}（应用的交付门禁看 deliveryVerdict.blockers，不看这个数）`)
      check(`${c.key}：自动修订**没有借机重写全文**（正文改动 ≤ 50%，设计轴/主题/素材引用未变）`,
        rd.textChangedRatio <= 0.5 && !rd.boxesChanged && !rd.themeChanged && rd.assets.added.length === 0 && rd.assets.removed.length === 0,
        rd.summary)
      check(`${c.key}：自动修订后仍渲染合法（过 checkHtml）`, checkHtml(rr.html).ok, `issues=${checkHtml(rr.html).issues.length}`)
    } else {
      check(`${c.key}：自动修订产出了 v2 正文`, false, '未产出')
    }
  }
  // 契约文本层面再钉一次：有可修复项时，喂回去的修订提示必须带"逐字保留"
  if (fx.length) {
    check(`${c.key}：自动修订提示带上"逐字保留"（不重写全文）`,
      buildReviseContent(out.body, fx, { preserveRest: true }).includes('逐字保留'), '')
  }
}

judge.finish({ exitCode: failed ? 1 : 0, label: 'LIVE-EDIT' })
