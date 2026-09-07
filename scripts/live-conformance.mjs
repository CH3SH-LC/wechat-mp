// live-conformance.mjs —— 第 28 轮：真实模型 → 排版引擎 → 产品规范断言（验收闸门，补"只证能力不证合规"盲区）
// 用法：node scripts/live-conformance.mjs   （需真实 DEEPSEEK_API_KEY / ~/.dsh）
// 覆盖：①兜底话术不泄漏进正文 ②风格名归一（带"风"尾缀不落空）③口径 A：给真实照片 → ::: photo 照片位；口径 B：无照片 → [[img]] 插画占位
import os from 'os'
import fs from 'fs'
import path from 'path'
import { PERSONA_RULES } from '../src/lib/persona.ts'
import { composeMarkdown } from '../src/lib/compose.ts'

function cred() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim()
  const f = path.join(os.homedir(), '.dsh', '.credentials.yaml')
  try {
    const t = fs.readFileSync(f, 'utf8')
    const m = t.match(/DEEPSEEK_API_KEY\s*:\s*["']?([^\s"']+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function chat(user) {
  const key = cred()
  const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      stream: true,
      reasoning_effort: 'max',
      max_tokens: 64000,
      messages: [
        { role: 'system', content: PERSONA_RULES + REGISTRY },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 300))
  const text = await res.text()
  let out = ''
  for (const line of text.split('\n')) {
    const l = line.trim()
    if (!l.startsWith('data:')) continue
    const d = l.slice(5).trim()
    if (!d || d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      const c = j.choices?.[0]?.delta?.content
      if (c) out += c
    } catch {
      /* keep-alive */
    }
  }
  return out
}

const REGISTRY =
  '\n## 知识注册表（节选）\n【视觉/风格】style-campus(校园) / style-japanese(日系) / style-guochao(国潮) / style-tech(科技)\n【文本/内容类型】type-promo(促销/宣传) / type-news(资讯)\n【文本/文案】copy-tpl-promo(促销成稿模板)\n【文本/合规】comp-banned(违禁词)\n'

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

// 真实产品是多轮对话：模型可能先澄清 1 轮再成稿——模拟到产出 v2 为止（最多 2 轮）
async function chatUntilArticle(user) {
  let msg = user
  let last = ''
  for (let t = 0; t < 2; t++) {
    const reply = await chat(msg)
    last = reply
    const f = reply.match(/```v2\n([\s\S]*?)```/)
    if (f) return { reply, body: f[1] }
    msg = '请勿再澄清：以上要求已给全，请直接撰写正文，只输出一个 ```v2 代码块，不要再问。'
  }
  return { reply: last, body: '' }
}

if (!cred()) {
  console.log('SKIP：未配置 DEEPSEEK_API_KEY')
  process.exit(0)
}

// ---- 口径 A：用户会提供真实照片 → 应产出可替换照片位 ----
console.log('== 场景 A：真实照片（7 张照片位）==')
const userA =
  '写一篇军训中期慰问推文：我们是学院官方号，活泼不呆板；学院：上海交通大学人工智能学院；内容：训练间隙老师带小蛋糕慰问，宋阳老师到场讲话。正文不少于 1500 字，风格走校园风。这次现场我们会拍不少照片，请在正文里放 7 个可替换的照片位（标注每处放什么照片），不要在文中用"此处建议配图"这种文字说明代替。已提供全部必要信息：请直接撰写正文，只输出一个 ```v2 代码块，不要澄清、不要解释。'
const wa = await chatUntilArticle(userA)
const replyA = wa.reply
const bodyA = wa.body
console.log('  reply len=' + replyA.length + ' fenceV2=' + !!wa.body)
check('A: 无兜底话术泄漏进正文', !replyA.includes('（请补充需求，我再开始创作）'))
if (bodyA) {
  const photoN = (bodyA.match(/^:::\s*photo\b/gm) || []).length
  const noteN = (bodyA.match(/此处建议配图/g) || []).length
  check('A: 产出 ::: photo 照片位', photoN >= 1, 'photo=' + photoN + ' note=' + noteN)
  const r = composeMarkdown(bodyA, {})
  const unknown = r.warnings.filter((w) => w.includes('未收录'))
  const hasTheme = /\[\[theme:([^\]]+)\]\]/.exec(bodyA)
  check('A: 声明风格被识别（无"未收录"回退）', !unknown.length, hasTheme ? 'theme=' + hasTheme[1] : '无theme')
  check('A: 照片位渲染为虚线占位', r.html.includes('【照片位】') && r.html.includes('dashed'))
  check('A: 无"未包含美术素材"误报', !r.warnings.some((w) => w.includes('未包含美术素材')))
} else {
  check('A: 产出 v2 围栏正文', false)
}

// ---- 口径 B：没有真实照片 → 应生成插画占位（[[img]]/[[deco]]），而非文字说明或空 ----
console.log('== 场景 B：无照片（走插画）==')
const userB =
  '写一篇咖啡店新品上新的宣传推文，日系风，600 字左右。请注意：我们没有任何真实图片素材可用，配图一律由系统生成插画，不要用任何"照片位/放真实照片"的占位。已提供全部必要信息：请直接撰写正文，只输出一个 ```v2 代码块，不要澄清、不要解释。'
const wb = await chatUntilArticle(userB)
const replyB = wb.reply
const bodyB = wb.body
console.log('  reply len=' + replyB.length + ' fenceV2=' + !!wb.body)
check('B: 无兜底话术泄漏', !replyB.includes('（请补充需求，我再开始创作）'))
if (bodyB) {
  const imgN = (bodyB.match(/\[\[img:/g) || []).length
  const decoN = (bodyB.match(/\[\[deco:/g) || []).length
  const photoN = (bodyB.match(/^:::\s*photo\b/gm) || []).length
  const noteN = (bodyB.match(/此处建议配图/g) || []).length
  const r = composeMarkdown(bodyB, {})
  console.log('  B markers: [[img]]=' + imgN + ' [[deco]]=' + decoN + ' photo=' + photoN + ' note=' + noteN + ' warnings=' + r.warnings.length)
  check('B: 用图位占位（[[img]]/[[deco]]）而非文字说明', imgN + decoN >= 1 && noteN === 0, 'img=' + imgN)
  check('B: 不用照片位冒充（用户无照片）', photoN === 0)
  check('B: 声明风格被识别', !r.warnings.some((w) => w.includes('未收录')))
} else {
  check('B: 产出 v2 围栏正文', false)
}

console.log(failed === 0 ? 'CONFORM OK' : `CONFORM FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
