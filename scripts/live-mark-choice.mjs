// live-mark-choice.mjs —— R22：真实模型下"角标图案"的选型验收（付费真实调用）
//
// 为什么单独立一个：R16–R22 每一轮都以"零模型调用"收尾，于是"模型会不会**点名贴切的图案**"
// 一直挂在边界里没证。R22 给了模型两个新轴（`mark` / `markat`），这条边界不闭合，"词汇表能用"
// 就只是"引擎能画"，不是"模型会选"。
//
// 判据（只有前两条是硬断言；后两条是观测，不假装能判美观）：
//   ① 模型产出了 ```v2 正文（否则 BLOCKED——跑不起来不算通过）
//   ② 正文里 `[[boxes:…]]` 的**轴名与取值全部合法**（`faceFromSpec` 的 unknown 为空）
//   ③ 成品可渲染：`checkHtml` 过、正文无 `undefined`、无未解析的素材占位
//   ④ 观测：模型写了哪些 `mark`；以及它们**是否落在该主题的期望图案集**里（只记录，不判"对错"）
//
// 用法：node --experimental-strip-types scripts/live-mark-choice.mjs [--out <目录>]
// 缺凭据 = BLOCKED（退出 2）；零条检查 = ERROR。
import os from 'os'
import fs from 'fs'
import path from 'path'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { PERSONA_RULES } from '../src/lib/persona.ts'
import { composeMarkdown, faceFromSpec } from '../src/lib/compose.ts'
import { resolveMark } from '../src/lib/marks.ts'
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

async function article(user) {
  const history = [{ role: 'user', content: user }]
  let last = ''
  for (let t = 0; t < 2; t++) {
    const reply = await chat(history)
    last = reply
    const f = reply.match(/```v2\n([\s\S]*?)```/)
    if (f) return { reply, body: f[1] }
    history.push({ role: 'assistant', content: reply })
    history.push({ role: 'user', content: '请勿再澄清：要求已给全，直接撰写正文，只输出一个 ```v2 代码块。' })
  }
  return { reply: last, body: '' }
}

const judge = createJudge({ script: 'live-mark-choice', outDir: resolveOutDir('live-mark-choice'), plannedCases: ['①', '②'] })
fs.mkdirSync(process.env.WXMP_LOCAL_DIR || '.local', { recursive: true })
guardCrashes(judge)
let failed = 0
const observe = (id, detail) => judge.observe(id, detail)
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

if (!cred()) {
  judge.block('缺少真实模型凭据：环境变量 DEEPSEEK_API_KEY 与 ~/.dsh/.credentials.yaml 都没取到（本脚本需要真实模型）。')
  judge.finish({ exitCode: 2, label: 'LIVE-MARK' })
  process.exit(2)
}

// 题面刻意为"图上贴内容"的场景准备：一处秋季活动、一处书评——词汇表里都有对口图案。
const CASES = [
  {
    key: '①秋日活动',
    want: ['枫叶', '叶芽', '星', '花', '闪电'],
    prompt:
      '写一篇秋季校园活动的宣传推文（学院公众号）：活动叫"秋日书市"，10 月 26 日在图书馆前广场，' +
      '有二手书交换、手作书签、热可可摊位。风格走校园风。正文 600-900 字即可，' +
      '用 2-3 个提示气泡。若气泡要配角标图案，请**挑与内容贴合的**（本次是秋天的书市）。' +
      '已给全部信息：直接撰写，只输出一个 ```v2 代码块，不要澄清。',
  },
  {
    key: '②书评',
    want: ['书页', '星', '心', '叶芽'],
    prompt:
      '写一篇读书笔记推文：读《万历十五年》的感想，讲这本书怎么写"大历史"。风格走书卷气/杂志感。' +
      '正文 600-900 字即可，用 2-3 个提示气泡。若气泡要配角标图案，请**挑与内容贴合的**（本次是一本书的读后感）。' +
      '已给全部信息：直接撰写，只输出一个 ```v2 代码块，不要澄清。',
  },
]

for (const c of CASES) {
  console.log(`== ${c.key} ==`)
  const { body } = await article(c.prompt)
  fs.writeFileSync(path.join(process.env.WXMP_LOCAL_DIR || '.local', `${c.key}.md`), body || '(空)')
  check(`${c.key}：模型产出 v2 正文`, !!body && body.length > 200, `${(body || '').length} 字`)
  if (!body) { observe(`${c.key} 未成稿`, '(跳过后续断言)'); continue }

  const r = composeMarkdown(body, { mode: 'auto' })
  // ② 轴名/取值全部合法
  const axisLine = /\[\[boxes:\s*([^\]]+?)\s*\]\]/.exec(body)
  const spec = axisLine ? faceFromSpec(axisLine[1]).unknown : []
  check(`${c.key}：[[boxes:…]] 的轴名与取值全部合法（unknown 为空）`, spec.length === 0, spec.join(' / ') || '(无未知项)')
  // ③ 成品可渲染
  const q = checkHtml(r.html)
  check(`${c.key}：成品过 checkHtml 且无 undefined / 未解析占位`,
    q.ok && !/undefined/.test(r.html) && !/@ART\d+@/.test(r.html),
    q.issues.map((i) => i.kind).join(',') || 'ok')
  // ④ 观测：模型实际点名了哪些图案、是否与主题期望集重合（只记录，不判对错）
  const used = [...body.matchAll(/mark\s*=\s*([^;\]\s]+)/g)].map((m) => m[1])
  const known = used.filter((u) => resolveMark(u))
  const unknownMark = used.filter((u) => !resolveMark(u))
  const apt = known.filter((u) => c.want.includes(u))
  observe(`${c.key} 模型点名的角标图案`, used.length ? `使用 ${used.join('/')}；规范键 ${known.join('/') || '（无）'}；与主题期望集 ${c.want.join('/')} 的交集 ${apt.join('/') || '（空）'}` : '未使用 mark 轴（走语义/主题默认）')
  check(`${c.key}：模型点名的图案名都解析得出（不静默落空）`, unknownMark.length === 0, unknownMark.join(','))
  check(`${c.key}：点名的图案确实渲染进了成品（角标 img 在场）`,
    used.length === 0 || /<img src="data:image\/svg\+xml/.test(r.html))
}

judge.finish({ exitCode: failed ? 1 : 0, label: 'LIVE-MARK' })
