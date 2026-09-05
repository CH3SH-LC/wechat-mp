// live-knowledge-probe.mjs —— 三层知识路由注入的真实模型验证（第 19 轮）
// 用法：node scripts/live-knowledge-probe.mjs <outDir>
// 模拟桌面检索路由：促销类型 → type-promo + copy-tpl-promo + comp-banned；国潮 → style-guochao
// system = persona + 注入点文件节选（与桌面 buildSystemPrompt 同构）；模型产出 v2 正文 → compose
import { readFileSync, writeFileSync } from 'fs'
import { buildSystemPrompt } from '../src/lib/persona.ts'

const outDir = process.argv[2] || 'D:/deepseek-harness/verify-artifacts'
const KB = 'D:/deepseek-harness/wechat-mp-desktop/src/knowledge'
const read = (rel) => {
  const text = readFileSync(`${KB}/${rel}`, 'utf8')
  return text.length > 8000 ? text.slice(0, 8000) + '\n…（节选截断）' : text
}
const picks = [
  { path: `/src/knowledge/${'文本/内容类型/type-promo.md'}`, head: '', text: read('文本/内容类型/type-promo.md') },
  { path: `/src/knowledge/${'文本/文案/copy-tpl-promo.md'}`, head: '', text: read('文本/文案/copy-tpl-promo.md') },
  { path: `/src/knowledge/${'视觉/风格/style-guochao.md'}`, head: '', text: read('视觉/风格/style-guochao.md') },
  { path: `/src/knowledge/${'文本/合规/comp-banned.md'}`, head: '', text: read('文本/合规/comp-banned.md') },
]
console.log(`injected: ${picks.map((p) => p.path.split('/').pop()).join(', ')} (${picks.reduce((s, p) => s + p.text.length, 0)} chars)`)

const sys = buildSystemPrompt(picks)
const cred = readFileSync(process.env.USERPROFILE + '/.dsh/.credentials.yaml', 'utf8')
const key = (cred.match(/DEEPSEEK_API_KEY:\s*"?([^"\r\n]+)/) || [])[1]?.trim()
if (!key) throw new Error('no key')

const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    max_tokens: 32000,
    reasoning_effort: 'max',
    stream: false,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: '写一篇咖啡店新店开业的宣传推文，国潮风，600-800 字。' },
    ],
  }),
})
const json = await res.json()
const content = json.choices?.[0]?.message?.content || ''
console.log(`usage: prompt=${json.usage?.prompt_tokens} completion=${json.usage?.completion_tokens} contentLen=${content.length}`)
const m = content.match(/```v2\s*([\s\S]*?)```/)
if (!m) {
  console.log('NO V2 FENCE. head: ' + content.slice(0, 300))
  process.exit(1)
}
const md = m[1].trim()
writeFileSync(`${outDir}/probe-injected.md`, md, 'utf8')
console.log(`v2 fence extracted: ${md.length} chars -> ${outDir}/probe-injected.md`)
