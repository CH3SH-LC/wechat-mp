// live-knowledge-probe.mjs —— 历史知识注入实验；R36 同步当前知识名。
// 仅供单独研究，不经过桌面 prep/独立复核/交付门禁，不能作为 R36 文案或桌面验收证据。
// 用法：node scripts/live-knowledge-probe.mjs <outDir>
// 固定注入写作目的、产品介绍、合规及国潮视觉知识；不模拟当前桌面自主检索。
// system = persona + 注入点文件节选（与桌面 buildSystemPrompt 同构）；模型产出 v2 正文 → compose
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'node:path'
import { buildSystemPrompt } from '../src/lib/persona.ts'

const outDir = resolve(process.argv[2] || resolve(import.meta.dirname, '../.local/runs/knowledge-probe-' + Date.now()))
mkdirSync(outDir, { recursive: true })
const KB = resolve(import.meta.dirname, '../src/knowledge')
const read = (rel) => {
  const text = readFileSync(`${KB}/${rel}`, 'utf8')
  return text.length > 8000 ? text.slice(0, 8000) + '\n…（节选截断）' : text
}
const picks = [
  { path: '/src/knowledge/文本/写作/writing-purpose.md', head: '', text: read('文本/写作/writing-purpose.md') },
  { path: '/src/knowledge/文本/写作/writing-product.md', head: '', text: read('文本/写作/writing-product.md') },
  { path: `/src/knowledge/${'视觉/风格/style-guochao.md'}`, head: '', text: read('视觉/风格/style-guochao.md') },
  { path: `/src/knowledge/${'文本/合规/comp-banned.md'}`, head: '', text: read('文本/合规/comp-banned.md') },
]
console.log(`injected: ${picks.map((p) => p.path.split('/').pop()).join(', ')} (${picks.reduce((s, p) => s + p.text.length, 0)} chars)`)

const sys = buildSystemPrompt(picks) + '\n\n## 当前排版协议（只决定语法与呈现，不提供本稿事实）\n' + readFileSync(`${KB}/排版引擎/engine-write-protocol.md`, 'utf8')
const cred = readFileSync(process.env.USERPROFILE + '/.dsh/.credentials.yaml', 'utf8')
const key = (cred.match(/DEEPSEEK_API_KEY:\s*"?([^"\r\n]+)/) || [])[1]?.trim()
if (!key) throw new Error('no key')

const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    max_tokens: 64000,
    reasoning_effort: 'max',
    stream: false,
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: '写一篇咖啡店新店开业的宣传推文，国潮风。信息已定：店名"有闲茶咖"，7 月 1 日开业，地点中山路 12 号，开业前三天全场饮品第二杯半价，到店送桂花茶冻。不要提问，直接创作完整正文；正文 1800-2200 字；配图与组件按内容选择，引用和占位遵守当前引擎协议。',
      },
    ],
  }),
})
const json = await res.json()
const content = json.choices?.[0]?.message?.content || ''
console.log(`usage: prompt=${json.usage?.prompt_tokens} completion=${json.usage?.completion_tokens} contentLen=${content.length}`)
// v2 围栏提取：从首个 ```v2 之后截到最后一个 ```（正文内不再允许其它围栏）
let md = ''
const start = content.indexOf('```v2')
if (start >= 0) {
  const rest = content.slice(start + 5)
  const last = rest.lastIndexOf('```')
  md = (last >= 0 ? rest.slice(0, last) : rest).trim()
}
if (!md) {
  console.log('NO V2 FENCE. head: ' + content.slice(0, 300))
  process.exit(1)
}
writeFileSync(`${outDir}/probe-injected.md`, md, 'utf8')
console.log(`v2 fence extracted: ${md.length} chars -> ${outDir}/probe-injected.md`)
