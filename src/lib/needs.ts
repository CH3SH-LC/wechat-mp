// needs.ts —— 请求分类与需求评估
// 第 12 轮起：请求先路由为「创作请求 / 通用对话」两类；创作信息不足时由模型在对话流里反问，
// 本地不再弹任何卡片（ClarifyCard 已退役）。evaluate 仍供模拟端判断"本条是否需要反问"。

export interface NeedsAssessment {
  type: string | null
  style: string | null
  words: string | null // 'short' | 'mid' | 'long'
  tone: string | null
  image: boolean | null
}

const TYPE_WORDS: [string, string][] = [
  ['干货', 'tutorial'], ['教程', 'tutorial'],
  ['资讯', 'news'], ['新闻', 'news'], ['报道', 'news'],
  ['情感', 'emotion'], ['随笔', 'emotion'],
  ['软文', 'soft'], ['带货', 'soft'],
  ['促销', 'promo'], ['活动', 'promo'], ['开业', 'promo'], ['上新', 'promo'], ['预售', 'promo'], ['招生', 'promo'],
  ['品牌', 'brand'],
  ['人物', 'person'], ['专访', 'person'],
  ['盘点', 'list'], ['清单', 'list'],
  ['科普', 'science'], ['测评', 'science'],
  ['公告', 'announcement'], ['通知', 'announcement'],
  ['连载', 'serial'],
]

const STYLE_WORDS: [string, string][] = [
  ['校园', 'campus'],
  ['科技', 'tech'],
  ['国潮', 'guochao'],
  ['日系', 'japanese'], ['日式', 'japanese'],
  ['极简', 'minimal'],
  ['商务', 'business'],
  ['手账', 'handbook'], ['手帐', 'handbook'],
  ['森系', 'forest'], ['清新', 'forest'],
  ['港风', 'hk'],
  ['插画', 'illustration'],
]

export function assess(text: string): NeedsAssessment {
  const type = TYPE_WORDS.find(([w]) => text.includes(w))?.[1] ?? null
  const style = STYLE_WORDS.find(([w]) => text.includes(w))?.[1] ?? null
  const mWord = /(\d{3,4})\s*字/.exec(text)
  let words: string | null = null
  if (mWord) {
    const n = Number(mWord[1])
    words = n <= 600 ? 'short' : n <= 1300 ? 'mid' : 'long'
  } else if (/长文|长一点|长篇/.test(text)) {
    words = 'long'
  } else if (/短一点|短文|别太长|太长了|简短/.test(text)) {
    words = 'short'
  }
  const tone = text.includes('正式') || text.includes('稳重') ? 'formal'
    : text.includes('活泼') || text.includes('生动') || text.includes('轻松') ? 'vivid'
    : text.includes('口语') ? 'oral' : null
  const image = /配图|配个图|配张图|图片|插图|放图/.test(text) ? true : null
  return { type, style, words, tone, image }
}

export function hasDirective(text: string): boolean {
  return /直接写|直接生成|别问|不用问|不要再问/.test(text)
}

export function isDemoTopic(text: string): boolean {
  return /演示|违规输出检测|质量检查演示/.test(text)
}

export interface AssessResult {
  needsClarify: boolean
  missing: (keyof NeedsAssessment)[]
  assessment: NeedsAssessment
}

export function evaluate(text: string): AssessResult {
  const a = assess(text)
  const missing: (keyof NeedsAssessment)[] = []
  if (!a.type) missing.push('type')
  if (!a.style) missing.push('style')
  if (!a.words) missing.push('words')
  if (!a.tone) missing.push('tone')
  if (a.image === null) missing.push('image')
  const needsClarify = missing.length >= 2 && !hasDirective(text) && !isDemoTopic(text)
  return { needsClarify, missing, assessment: a }
}

// ---------- 第 12 轮：创作 / 对话路由 ----------

// 创作动词 + 目标名词（如"写一篇咖啡店开业宣传"）
const CREATE_VERB_NOUN = /(?:写|生成|创作|起草|拟|编|来|出|做|发|整|敲)(?:一|个|篇|段|条|点|份|些)?\s*(?:篇|段)?\s*(?:推文|公众号文章|公众号文案|文案|软文|宣传(?:文|稿|文案)?|图文|文章|稿子?|公告|通知|开业(?:文|宣传)?|招生|预告|干货(?:文|帖)?|教程|测评|盘点|资讯|指南|内容)/
// 祈使式创作（"来一篇""写个"）
const CREATE_IMPERATIVE = /(?:来一篇|来段|写一篇|写个|写一段|写段|生成一篇|生成个|出一篇|做一篇|整一篇|发一篇|编一篇)/
// 帮我/给我 + 创作动词（排除"帮我写个标题/名字"这类问答）
const CREATE_HELP = /(?:帮我|给我|请)[^。\n，,]{0,14}(?:写|生成|创作)(?!标题|名字|名称)/

export function isCreateRequest(text: string): boolean {
  return (
    CREATE_VERB_NOUN.test(text) ||
    CREATE_IMPERATIVE.test(text) ||
    CREATE_HELP.test(text) ||
    (text.includes('推文') && /(?:写|生成|创作)/.test(text))
  )
}

// 对话中放弃/取消（用于反问等待态下的取消路由）
export function isCancel(text: string): boolean {
  return /^(?:算了|那算了|不用了|先不用|先不写|不写了|别写了|取消)/.test(text)
}
