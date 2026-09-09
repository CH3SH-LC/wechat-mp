// live-conformance.mjs —— 第 28 轮：真实模型 → 排版引擎 → 产品规范断言（验收闸门，补"只证能力不证合规"盲区）
// 用法：node scripts/live-conformance.mjs   （需真实 DEEPSEEK_API_KEY / ~/.dsh）
// 覆盖：①兜底话术不泄漏进正文 ②风格名归一（带"风"尾缀不落空）③口径 A：给真实照片 → ::: photo 照片位 + 装饰插画（[[img]]/[[deco]]）并存；口径 B：无照片 → [[img]]/[[deco]] 插画占位（零照片位）
import os from 'os'
import fs from 'fs'
import path from 'path'
import { PERSONA_RULES } from '../src/lib/persona.ts'
import { composeMarkdown } from '../src/lib/compose.ts'

// 第 29 轮：persona 已精简，工艺细则迁知识库；验收闸门必须复刻"prep 已取用引擎协议"的上下文，
// 把 排版引擎/engine-write-protocol.md 全文注入（等价桌面 runPrep 取用后 digest 进撰写阶段），
// 否则模型不知道 v2 语法/素材占位/::: photo——不是合规测试失效，是少了取用环节。
const ENGINE_PROTOCOL = fs.readFileSync(
  path.join(import.meta.dirname, '..', 'src', 'knowledge', '排版引擎', 'engine-write-protocol.md'),
  'utf8',
)

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

async function chat(history) {
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
        { role: 'system', content: PERSONA_RULES + '\n\n## 已取用：排版引擎协议（本轮创作依据，冲突以本协议为准）\n' + ENGINE_PROTOCOL + REGISTRY },
        ...history,
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

// 真实产品是多轮对话：模型可能先澄清 1 轮再成稿——累积历史（保留原始需求）模拟到产出 v2 为止（最多 2 轮）
async function chatUntilArticle(user) {
  const history = [{ role: 'user', content: user }]
  let last = ''
  for (let t = 0; t < 2; t++) {
    const reply = await chat(history)
    last = reply
    const f = reply.match(/```v2\n([\s\S]*?)```/)
    if (f) return { reply, body: f[1] }
    history.push({ role: 'assistant', content: reply })
    history.push({ role: 'user', content: '请勿再澄清：以上要求已给全，请直接撰写正文，只输出一个 ```v2 代码块，不要再问。' })
  }
  return { reply: last, body: '' }
}

if (!cred()) {
  console.log('SKIP：未配置 DEEPSEEK_API_KEY')
  process.exit(0)
}

// ---- 口径 A：用户会提供真实照片 → 照片位 + 装饰插画并存（第 31 轮口径）----
console.log('== 场景 A：真实照片（照片位 + 装饰插画并存）==')
const userA =
  '写一篇军训中期慰问推文：我们是学院官方号，活泼不呆板；学院：上海交通大学人工智能学院；内容：训练间隙老师带小蛋糕慰问，宋阳老师到场讲话。正文不少于 1500 字，风格走校园风。这次现场我们会拍不少照片，请在正文里放 7 个可替换的照片位（标注每处放什么照片），不要在文中用"此处建议配图"这种文字说明代替。照片位是放我们拍的真实照片，但横幅、气泡、小节这类组件装饰位也要配装饰插画（[[img]]/[[deco]]），别让全文只剩照片空框。已提供全部必要信息：请直接撰写正文，只输出一个 ```v2 代码块，不要澄清、不要解释。'
const wa = await chatUntilArticle(userA)
const replyA = wa.reply
const bodyA = wa.body
console.log('  reply len=' + replyA.length + ' fenceV2=' + !!wa.body)
check('A: 无兜底话术泄漏进正文', !replyA.includes('（请补充需求，我再开始创作）'))
if (bodyA) {
  const photoN = (bodyA.match(/^:::\s*photo\b/gm) || []).length
  const imgN = (bodyA.match(/\[\[img:/g) || []).length
  const decoN = (bodyA.match(/\[\[deco:/g) || []).length
  const noteN = (bodyA.match(/此处建议配图/g) || []).length
  check('A: 产出 ::: photo 照片位', photoN >= 1, 'photo=' + photoN + ' note=' + noteN)
  check('A: 照片位与装饰插画并存（[[img]]/[[deco]]≥1）', imgN + decoN >= 1, 'photo=' + photoN + ' [[img]]=' + imgN + ' [[deco]]=' + decoN)
  const bubbleA = (bodyA.match(/^>\s*\[!/gm) || []).length
  const bubbleTitleA = /^>\s*\[![A-Z]+\|?[^\]]*\]\s*\S+/m.test(bodyA)
  check('A: 含 ≥1 提示气泡且带标题句（第33轮小组件写法）', bubbleA >= 1 && bubbleTitleA, 'bubble=' + bubbleA)
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
  const bubbleB = (bodyB.match(/^>\s*\[!/gm) || []).length
  const bubbleTitleB = /^>\s*\[![A-Z]+\|?[^\]]*\]\s*\S+/m.test(bodyB)
  check('B: 含 ≥1 提示气泡且带标题句（第33轮小组件写法）', bubbleB >= 1 && bubbleTitleB, 'bubble=' + bubbleB)
  check('B: 声明风格被识别', !r.warnings.some((w) => w.includes('未收录')))
} else {
  check('B: 产出 v2 围栏正文', false)
}

// V3-R3：新增场景 C——给出"个人素材库清单"，真实模型应先引用库素材（[[asset:…]]）而非一律占位
console.log('== 场景 C：素材库清单 → 模型引用 [[asset]] 复用 ==')
const ASSET_DIGEST_C =
  '\n## 个人素材库（已入库可复用素材；命中即用 [[asset:分类|名称|用途说明]] 引用，风格只是参考）\n' +
  '- bubble｜bubble-flower-corner｜右下角一朵小花的气泡角饰｜右下角画一朵五瓣小花、花心金黄，其余留白，适用于 KEY/TIP 气泡右下角（usage=deco）\n' +
  '- divider｜divider-fern-line｜蕨叶细横分割线｜两侧对称的细叶横条，用于段落换场（usage=wide）\n'

async function chatC(history) {
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
        { role: 'system', content: PERSONA_RULES + '\n\n## 已取用：排版引擎协议（本轮创作依据，冲突以本协议为准）\n' + ENGINE_PROTOCOL + REGISTRY + ASSET_DIGEST_C },
        ...history,
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

const userC =
  '写一篇咖啡店新品上新的宣传推文，日系风，700 字左右。配图要求：气泡装饰优先复用你个人素材库里已有的素材（上面清单里右下角一朵小花的气泡角饰正好合适，直接引用它；分割线若有合适位置也可引用清单里的蕨叶分割线），正文里对该气泡先用 [[asset:bubble|bubble-flower-corner|右下角一朵小花的气泡角饰]] 定义、再用 > [!KEY|bubble-flower-corner] 引用；其余实在没有合适库素材的插画位才用 [[img]]/[[deco]] 占位。已提供全部必要信息：请直接撰写正文，只输出一个 ```v2 代码块，不要澄清、不要解释。'
const wc = await chatUntilArticleCustom(userC, chatC)
const bodyC = wc.body
console.log('  reply len=' + wc.reply.length + ' fenceV2=' + !!wc.body)
check('C: 无兜底话术泄漏', !wc.reply.includes('（请补充需求，我再开始创作）'))
if (bodyC) {
  const assetRef = (bodyC.match(/\[\[asset:bubble\|bubble-flower-corner\|/g) || []).length
  const bubbleUsesCorner = (bodyC.match(/^>\s*\[!KEY\|bubble-flower-corner\]/gm) || []).length
  check('C: 复用库素材引用 [[asset:bubble|bubble-flower-corner|…]]', assetRef >= 1, 'asset=' + assetRef)
  check('C: 气泡引用同名称角饰', bubbleUsesCorner >= 1, 'bubble=' + bubbleUsesCorner)
  check('C: 未手写 SVG（无 <svg 原文）', !bodyC.includes('<svg'))
  // 桌面"素材解析器"职责（把 [[asset]] 引用落位为素材块；真实实现已由 E2E S14 验证）：
  // 这里最小复刻——把库引用行替换为对应的 ::: art deco 块（附库内最小合法 SVG），再交 compose 断言引擎可用
  const DUMMY_LIB_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none"><circle cx="240" cy="220" r="40" fill="#f2c76e"/><circle cx="228" cy="196" r="9" fill="#e8b48a"/><circle cx="252" cy="208" r="9" fill="#e8b48a"/><circle cx="240" cy="232" r="9" fill="#e8b48a"/><path d="M240 180 q8 18 0 40 q-8 -22 0 -40z" fill="#c96f4a"/><rect x="120" y="120" width="60" height="60" rx="10" fill="#5f8d8a"/></svg>'
  const parsedForCompose = bodyC.replace(/^\[\[asset:bubble\|bubble-flower-corner\|[^\]]*\]\]$/gm, (ln) => {
    if (ln.includes('[[asset:bubble|bubble-flower-corner|')) {
      return '::: art deco bubble-flower-corner\n' + DUMMY_LIB_SVG + '\n:::'
    }
    return ln
  })
  const r = composeMarkdown(parsedForCompose, {})
  check('C: compose 无"气泡角饰未定义"警告', !r.warnings.some((w) => w.includes('气泡角饰')), 'warnings=' + r.warnings.length)
} else {
  check('C: 产出 v2 围栏正文', false)
}

async function chatUntilArticleCustom(user, chatFn) {
  const history = [{ role: 'user', content: user }]
  let last = ''
  for (let t = 0; t < 2; t++) {
    const reply = await chatFn(history)
    last = reply
    const f = reply.match(/```v2\n([\s\S]*?)```/)
    if (f) return { reply, body: f[1] }
    history.push({ role: 'assistant', content: reply })
    history.push({ role: 'user', content: '请勿再澄清：以上要求已给全，请直接撰写正文，只输出一个 ```v2 代码块，不要再问。' })
  }
  return { reply: last, body: '' }
}

console.log(failed === 0 ? 'CONFORM OK' : `CONFORM FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
