// needs.ts —— 需求评估（req-clarify 思路在推文创作场景的落地）
// 清晰度维度：类型 / 风格 / 字数 / 调性 / 配图。
// 缺 ≥2 项且无"直接写/直接生成/别问"指令 → 进入澄清卡；否则直接生成并附需求默认注。

export interface NeedsAssessment {
  type: string | null
  style: string | null
  words: string | null // 'short' | 'mid' | 'long'
  tone: string | null
  image: boolean | null
}

export interface ClarifySelections {
  type: string | null
  style: string | null
  words: string | null
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

const TYPE_LABELS: { v: string; label: string }[] = [
  { v: 'tutorial', label: '干货教程' },
  { v: 'news', label: '新闻资讯' },
  { v: 'emotion', label: '情感随笔' },
  { v: 'soft', label: '产品软文' },
  { v: 'promo', label: '活动促销' },
  { v: 'brand', label: '品牌故事' },
  { v: 'person', label: '人物故事' },
  { v: 'list', label: '盘点清单' },
  { v: 'science', label: '科普测评' },
  { v: 'announcement', label: '公告通知' },
  { v: 'serial', label: '连载栏目' },
]

const STYLE_OPTIONS: { v: string; label: string }[] = [
  { v: 'auto', label: '风格自动' },
  { v: 'campus', label: '校园' },
  { v: 'tech', label: '科技' },
  { v: 'guochao', label: '国潮' },
  { v: 'japanese', label: '日系' },
  { v: 'minimal', label: '极简' },
  { v: 'business', label: '商务' },
  { v: 'handbook', label: '手账' },
  { v: 'forest', label: '森系' },
]

const WORDS_OPTIONS: { v: string; label: string }[] = [
  { v: 'short', label: '简短（500 字上下）' },
  { v: 'mid', label: '适中（800-1200 字）' },
  { v: 'long', label: '较长（1500-2000 字）' },
]

const TONE_OPTIONS: { v: string; label: string }[] = [
  { v: 'oral', label: '口语化' },
  { v: 'formal', label: '正式克制' },
  { v: 'vivid', label: '活泼生动' },
]

export function assess(text: string): NeedsAssessment {
  const type = TYPE_WORDS.find(([w]) => text.includes(w))?.[1] ?? null
  const style = STYLE_WORDS.find(([w]) => text.includes(w))?.[1] ?? null
  const mWord = /(\d{3,4})\s*字/.exec(text)
  let words: string | null = null
  if (mWord) {
    const n = Number(mWord[1])
    words = n <= 600 ? 'short' : n <= 1300 ? 'mid' : 'long'
  } else if (/长文|长一点/.test(text)) {
    words = 'long'
  } else if (/短一点|短文/.test(text)) {
    words = 'short'
  }
  const tone = text.includes('正式') || text.includes('稳重') ? 'formal'
    : text.includes('活泼') || text.includes('生动') || text.includes('轻松') ? 'vivid'
    : text.includes('口语') ? 'oral' : null
  const image = /配图|图片|插图|放图/.test(text) ? true : null
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

const TYPE_LABEL_MAP = new Map(TYPE_LABELS.map((t) => [t.v, t.label]))
const STYLE_LABEL_MAP = new Map(STYLE_OPTIONS.map((s) => [s.v, s.label]))

export function describeSelections(s: ClarifySelections): string[] {
  const parts: string[] = []
  if (s.type) parts.push(`类型：${TYPE_LABEL_MAP.get(s.type) ?? s.type}`)
  if (s.style) parts.push(`风格：${STYLE_LABEL_MAP.get(s.style) ?? s.style}`)
  if (s.words) parts.push(`字数：${WORDS_OPTIONS.find((w) => w.v === s.words)?.label ?? s.words}`)
  if (s.tone) parts.push(`调性：${TONE_OPTIONS.find((t) => t.v === s.tone)?.label ?? s.tone}`)
  if (s.image) parts.push('需要配图位')
  return parts
}

// 直接生成路径的"需求默认"标注（req-clarify：直接做也标注假设）
export function assumptionNote(a: NeedsAssessment): string[] {
  const parts: string[] = []
  if (!a.type) parts.push('类型：自动（按内容判断）')
  if (!a.style) parts.push('风格：自动')
  if (!a.words) parts.push('字数：800-1200 字上下')
  if (!a.tone) parts.push('调性：口语化')
  if (a.image === null) parts.push('配图：不配图')
  return parts
}

export { TYPE_LABELS, STYLE_OPTIONS, WORDS_OPTIONS, TONE_OPTIONS }
