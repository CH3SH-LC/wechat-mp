// live-style-choice.mjs —— 风格选型验证（第 20 轮）：同质注入（风格速查+促销类型+红线），三主题 auto 不指定风格
// 期望：咖啡→非国潮（速查：美式复古/日系）；科技新品→科技；节日国货→国潮
import { readFileSync, writeFileSync } from 'fs'
import { buildSystemPrompt } from '../src/lib/persona.ts'

const outDir = process.argv[2] || 'D:/deepseek-harness/verify-artifacts'
const KB = 'D:/deepseek-harness/wechat-mp-desktop/src/knowledge'
const read = (rel) => {
  const text = readFileSync(`${KB}/${rel}`, 'utf8')
  return text.length > 8000 ? text.slice(0, 8000) + '\n…（节选截断）' : text
}
const styleIndex = read('视觉/风格/00-索引.md')
const picks = [
  { path: '/src/knowledge/视觉/风格/00-索引.md', head: '', text: styleIndex },
  { path: '/src/knowledge/文本/内容类型/type-promo.md', head: '', text: read('文本/内容类型/type-promo.md') },
  { path: '/src/knowledge/文本/合规/comp-banned.md', head: '', text: read('文本/合规/comp-banned.md') },
]
const sys = buildSystemPrompt(picks)
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
