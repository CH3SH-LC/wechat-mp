// live-style-choice.mjs —— 历史风格选择观察；R36 同步当前写作知识。
// 固定注入风格速查、产品介绍方法与合规；只观察三个主题的自主选择，不预定主题到风格的唯一答案。
// 本脚本不经过桌面 prep/独立复核/交付门禁，不能作为 R36 文案或桌面验收证据。
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'node:path'
import { buildSystemPrompt } from '../src/lib/persona.ts'

const outDir = resolve(process.argv[2] || resolve(import.meta.dirname, '../.local/runs/style-choice-' + Date.now()))
mkdirSync(outDir, { recursive: true })
const KB = resolve(import.meta.dirname, '../src/knowledge')
const read = (rel) => {
  const text = readFileSync(`${KB}/${rel}`, 'utf8')
  return text.length > 8000 ? text.slice(0, 8000) + '\n…（节选截断）' : text
}
const styleIndex = read('视觉/风格/00-索引.md')
const picks = [
  { path: '/src/knowledge/视觉/风格/00-索引.md', head: '', text: styleIndex },
  { path: '/src/knowledge/文本/写作/writing-product.md', head: '', text: read('文本/写作/writing-product.md') },
  { path: '/src/knowledge/文本/合规/comp-banned.md', head: '', text: read('文本/合规/comp-banned.md') },
]
const sys = buildSystemPrompt(picks) + '\n\n## 当前排版协议（只决定语法与呈现，不提供本稿事实）\n' + readFileSync(`${KB}/排版引擎/engine-write-protocol.md`, 'utf8')
const cred = readFileSync(process.env.USERPROFILE + '/.dsh/.credentials.yaml', 'utf8')
const key = (cred.match(/DEEPSEEK_API_KEY:\s*"?([^"\r\n]+)/) || [])[1]?.trim()

const scenarios = [
  { name: 'coffee', user: '写一篇咖啡店新店开业的宣传推文（不要指定具体风格，由你判断合适的风格）。600-800 字。' },
  { name: 'gadget', user: '写一篇智能手环新品发布的宣传推文（不要指定具体风格，由你判断合适的风格）。600-800 字。' },
  { name: 'festival', user: '写一篇中秋国货糕点礼盒的宣传推文（不要指定具体风格，由你判断合适的风格）。600-800 字。' },
]
const only = process.argv[3]
const runList = only ? scenarios.filter((s) => s.name === only) : scenarios
for (const s of runList) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-flash', max_tokens: 32000, reasoning_effort: 'max', stream: false,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: s.user }],
    }),
  })
  const json = await res.json()
  const content = json.choices?.[0]?.message?.content || ''
  const m = content.match(/```v2\s*([\s\S]*?)```/)
  const theme = m ? (m[1].match(/\[\[theme:([^\]]+)\]\]/) || [])[1] || '(none)' : '(no fence)'
  console.log(`${s.name}: theme=${theme} contentLen=${content.length}`)
  console.log('head: ' + content.slice(0, 120).replace(/\n/g, ' '))
  if (m) writeFileSync(`${outDir}/style-choice-${s.name}.md`, m[1].trim(), 'utf8')
}
