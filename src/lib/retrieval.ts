// retrieval.ts —— 三层知识取用：主题词映射 + 按任务路由注入点文件（00-GUIDE 路由逻辑前端化）
// 知识库懒加载：首次调用 ensureKnowledgeLoaded() 后缓存（打包体积从 2.4MB 降至数百 KB）
// 第 20 轮：保留 00-* 索引（路由可显式注入"风格选择速查"等教程）；相似度兜底排除索引文件
import type { KnowledgePick } from './persona'
import { assess, isCreateRequest } from './needs.ts'

export interface KnowledgeEntry {
  path: string // 如 src/knowledge/视觉/模块/module-bubble.md
  name: string // 文件名（去 .md）
  dir: string // 方向目录名（中文）
  head: string // 一级标题行
  text: string // 全文
}

const mdGlob = import.meta.glob('/src/knowledge/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

let cache: Promise<KnowledgeEntry[]> | null = null

export function ensureKnowledgeLoaded(): Promise<KnowledgeEntry[]> {
  if (!cache) {
    cache = Promise.all(
      Object.entries(mdGlob).map(async ([path, loader]) => {
        const text = (await loader()) as string
        const rel = path.replace(/^\/src\/knowledge\//, '')
        const seg = rel.split('/')
        const name = (seg[seg.length - 1] || '').replace(/\.md$/, '')
        const dir = seg.length > 1 ? seg[0] : ''
        const head = (text.match(/^#\s+.*$/m) || [''])[0]
        return { path, name, dir, head, text }
      }),
    )
  }
  return cache
}

// 主题词 → 命中文件（精确映射，按语义）
const TOPIC_MAP: Record<string, string[]> = {
  标题: ['copy-title'],
  摘要: ['cover-summary'],
  开头: ['copy-open'],
  结尾: ['copy-end'],
  金句: ['copy-quote'],
  小标题: ['copy-subheading', 'module-subheading'],
  文案: ['copy-style-basics', 'copy-points'],
  干货: ['type-tutorial', 'copy-tpl-tutorial'],
  资讯: ['type-news', 'copy-tpl-news'],
  新闻: ['type-news'],
  情感: ['type-emotion', 'copy-tpl-emotion'],
  软文: ['type-soft', 'copy-tpl-soft'],
  促销: ['type-promo', 'copy-tpl-promo'],
  活动: ['type-promo'],
  品牌: ['type-brand-story', 'copy-tpl-brand'],
  人物: ['type-person-story', 'copy-tpl-person'],
  盘点: ['type-list'],
  清单: ['type-list'],
  科普: ['type-science'],
  测评: ['type-science'],
  公告: ['type-announcement'],
  通知: ['type-announcement'],
  连载: ['type-serial', 'module-serial'],
  校园: ['style-campus', 'style-variant-sport'],
  科技: ['style-tech'],
  国潮: ['style-guochao'],
  商务: ['style-business'],
  日系: ['style-japanese'],
  手账: ['style-handbook'],
  极简: ['style-minimal'],
  插画: ['style-illustration'],
  港风: ['style-hk-retro'],
  杂志: ['style-magazine'],
  赛博: ['style-cyberpunk'],
  森系: ['style-forest', 'style-variant-shimizu'],
  动漫: ['style-anime'],
  二次元: ['style-anime'],
  报纸: ['style-newspaper'],
  美式: ['style-american-retro'],
  画廊: ['style-gallery'],
  敦煌: ['style-variant-dunhuang'],
  孟菲斯: ['style-variant-memphis'],
  波普: ['style-variant-pop'],
  运动: ['style-variant-sport'],
  气泡: ['module-bubble'],
  卡片: ['module-card', 'module-price'],
  步骤: ['module-steps'],
  时间线: ['module-timeline'],
  列表: ['module-list'],
  分割线: ['module-divider'],
  徽章: ['module-badge'],
  花纹: ['module-band'],
  色带: ['module-band'],
  表格: ['module-table'],
  数据: ['module-table'],
  图注: ['module-image'],
  图片: ['module-image'],
  视频: ['video-prepare', 'video-insert', 'module-media'],
  音频: ['module-media'],
  倒计时: ['module-countdown'],
  标签: ['module-tags'],
  关注: ['module-followbar'],
  页脚: ['module-footer'],
  目录: ['module-toc'],
  互动: ['module-interact'],
  小程序: ['module-miniapp'],
  抽奖: ['module-gift'],
  价格: ['module-price', 'module-card'],
  套餐: ['module-price'],
  证言: ['module-testimonial'],
  福利: ['module-gift'],
  封面: ['cover-spec', 'cover-text', 'cover-firstscreen'],
  首屏: ['cover-firstscreen'],
  摘要写法: ['cover-summary'],
  合规: ['comp-banned'],
  违禁词: ['comp-banned'],
  广告法: ['comp-banned'],
  版权: ['comp-copyright', 'img-copyright'],
  行业: ['comp-industry'],
  医疗: ['comp-industry'],
  金融: ['comp-industry'],
  数据引用: ['comp-data'],
  免责: ['comp-disclaimer', 'module-disclaimer'],
  深色: ['read-darkmode'],
  对比度: ['read-contrast'],
  字号: ['read-typography'],
  节奏: ['read-rhythm'],
  颜色: ['read-contrast', 'style-guide-choose'],
  风格: ['style-guide-choose', 'style-guide-check'],
  混搭: ['style-guide-mix'],
  排版: ['module-guide-combos', 'module-guide-rhythm'],
  图片处理: ['img-processing'],
  图片来源: ['img-sources'],
  无图: ['img-alternatives'],
  替代: ['img-alternatives'],
  求职: ['module-job'],
  招聘: ['module-job'],
}

function bigrams(s: string): Set<string> {
  const clean = s.replace(/[\s\p{P}\p{S}]/gu, '')
  const out = new Set<string>()
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2))
  return out
}

// 第 20 轮：三层任务路由——内容类型 → type-<key> + copy-tpl-<key>；风格 → style-<key> 或选型速查；营销类 → comp-banned 红线

const TYPE_FILE: Record<string, string> = {
  tutorial: 'type-tutorial', news: 'type-news', emotion: 'type-emotion', soft: 'type-soft',
  promo: 'type-promo', brand: 'type-brand-story', person: 'type-person-story', list: 'type-list',
  science: 'type-science', announcement: 'type-announcement', serial: 'type-serial',
}

const TPL_FILE: Record<string, string> = {
  tutorial: 'copy-tpl-tutorial', news: 'copy-tpl-news', emotion: 'copy-tpl-emotion', soft: 'copy-tpl-soft',
  promo: 'copy-tpl-promo', brand: 'copy-tpl-brand', person: 'copy-tpl-person',
}

const AD_TYPES = ['promo', 'soft', 'brand'] // 营销类必须带合规红线

export interface RetrievalResult {
  picks: KnowledgePick[]
  hits: string[] // 命中的主题词/路由（调试/展示用）
  sourceCount: number
}

export async function retrieve(query: string, topK = 6): Promise<RetrievalResult> {
  const entries = await ensureKnowledgeLoaded()
  const hits: string[] = []
  const byName = new Map(entries.map((e) => [e.name, e]))
  const picked = new Set<string>()

  // 1) 精确主题词映射（用户明示的模块/风格/文案位词优先）
  for (const [word, names] of Object.entries(TOPIC_MAP)) {
    if (query.includes(word)) {
      hits.push(word)
      for (const n of names) picked.add(n)
    }
  }

  // 2) 三层任务路由：内容类型/模板/风格（或风格选型教程）/合规红线——注入点文件原对象
  const a = assess(query)
  const routeEntries: KnowledgeEntry[] = []
  const addName = (n: string) => {
    const e = byName.get(n)
    if (e) routeEntries.push(e)
  }
  if (a.type && TYPE_FILE[a.type]) {
    addName(TYPE_FILE[a.type])
    hits.push('内容类型:' + a.type)
  }
  if (a.type && TPL_FILE[a.type]) addName(TPL_FILE[a.type])
  if (a.style) {
    addName('style-' + a.style)
    hits.push('风格:' + a.style)
  } else if (isCreateRequest(query)) {
    // 第 20 轮：未指定风格 → 注入风格选型速查（内容类型→首选/备选风格），避免瞎选/全国潮模板
    const styleIndex = entries.find((e) => e.path.includes('/视觉/风格/00-索引.md'))
    if (styleIndex) routeEntries.push(styleIndex)
    hits.push('风格速查')
  }
  if (a.type && AD_TYPES.includes(a.type)) {
    addName('comp-banned')
    hits.push('合规红线')
  }
  for (const e of routeEntries) picked.add(e.name)

  // 3) 相似度兜底：文件名 + 标题与查询的二元组重合（排除 00-* 索引与顶层世界观文件）
  const q = bigrams(query)
  const scored = entries
    .filter((e) => !picked.has(e.name) && !e.name.startsWith('00-') && e.name !== 'design-logic-components')
    .map((e) => {
      const hay = e.name + ' ' + e.head + ' ' + e.dir
      let score = 0
      for (const g of q) if (hay.includes(g)) score++
      return { e, score }
    })
    .sort((a, b) => b.score - a.score)

  for (const s of scored) {
    if (picked.size >= topK) break
    if (s.score >= 2) picked.add(s.e.name)
  }

  // 路由点文件（类型/模板/风格/选型/红线）是"该任务权威细则"：截断放宽到 8000 字符
  const picks: KnowledgePick[] = []
  const emit = (e: KnowledgeEntry, limit: number) => {
    const text = e.text.length > limit ? e.text.slice(0, limit) + '\n…（节选截断）' : e.text
    picks.push({ path: e.path, head: e.head, text })
  }
  for (const e of routeEntries) emit(e, 8000)
  for (const n of picked) {
    if (routeEntries.some((re) => re.name === n)) continue // 路由条目已输出（含同名索引用原对象）
    const e = byName.get(n)
    if (e) emit(e, 4500)
  }
  return { picks, hits, sourceCount: entries.length }
}

// ---------- 第 25 轮：知识注册表 + 本地工具执行（DeepSeek function-calling） ----------

export interface KnowledgeToolCall {
  name: string // load_knowledge | search_knowledge
  args: string // JSON 字符串参数（原样透传）
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 从文件路径取"子方向"（如 视觉/风格），供注册表分组
function groupOf(e: KnowledgeEntry): string {
  const rel = e.path.replace(/^\/src\/knowledge\//, '').replace(/\/[^/]+$/, '')
  return rel || e.dir
}

// head 清洗成短标：去 # 前缀、去「（文件名）」「文件名 · 」冗余
function shortHead(e: KnowledgeEntry, max = 18): string {
  const h0 = e.head.replace(/^#+\s*/, '').trim()
  if (!h0) return e.name
  const h1 = h0
    .replace(new RegExp(`[（(]${escapeRegex(e.name)}[）)]\\s*$`), '')
    .replace(new RegExp(`^${escapeRegex(e.name)}\\s*[·｜\\-—]?\\s*`), '')
    .trim()
  return h1.length > max ? h1.slice(0, max) + '…' : h1
}

// 子方向展示优先级（注册表按此排序，保证核心创作类别不被截断在末尾）
const REGISTRY_GROUP_ORDER = [
  '文本/内容类型',
  '文本/文案',
  '文本/合规',
  '视觉/风格',
  '视觉/模块',
  '插图/图片',
  '插图/视频',
  '其它/封面',
  '其它/可读性',
]

/** 把缓存条目压缩成"注册表"目录文本（每个点一行：name —— 短标），总量 ≤3500 字符；供注入 system 但不含正文 */
export async function buildRegistry(): Promise<string> {
  const entries = await ensureKnowledgeLoaded()
  const byGroup = new Map<string, KnowledgeEntry[]>()
  for (const e of entries) {
    if (e.name === '00-GUIDE' || e.name === 'design-logic-components') continue // 顶层入口，检索时可读
    const g = groupOf(e)
    const arr = byGroup.get(g) ?? []
    arr.push(e)
    byGroup.set(g, arr)
  }
  const groups = [...byGroup.keys()].sort((a, b) => {
    const ia = REGISTRY_GROUP_ORDER.indexOf(a)
    const ib = REGISTRY_GROUP_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'zh')
  })

  const NOTE = '…（目录较长已节选；未列出的点文件可用 search_knowledge 检索）'
  const budget = 3500 - NOTE.length - 2 // 给截断注记预留空间，保证总长 ≤3500
  const lines: string[] = []
  let used = 0
  let truncated = false
  const push = (s: string): boolean => {
    const cost = s.length + 1
    if (used + cost > budget) {
      truncated = true
      return false
    }
    lines.push(s)
    used += cost
    return true
  }

  for (const g of groups) {
    const es = byGroup.get(g) ?? []
    es.sort((a, b) => a.name.localeCompare(b.name))
    if (!push(`【${g}】`)) break
    for (const e of es) {
      if (!push(`- ${e.name}｜${shortHead(e)}`)) break
    }
    if (truncated) break
  }
  if (truncated) {
    lines.push(NOTE)
  }
  return lines.join('\n')
}

// 从工具调用的 args 解析出参数字符串（大小写容错、去引号）
function toolParam(call: KnowledgeToolCall, field: 'name' | 'query'): string {
  let v: unknown = null
  try {
    const parsed = JSON.parse(call.args || '') as unknown
    if (parsed && typeof parsed === 'object') {
      v = (parsed as Record<string, unknown>)[field]
    } else {
      v = parsed
    }
  } catch {
    v = call.args
  }
  return String(v ?? '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim()
}

function findEntry(entries: KnowledgeEntry[], raw: string): KnowledgeEntry | null {
  const name = raw.toLowerCase()
  return (
    entries.find((e) => e.name.toLowerCase() === name) ??
    entries.find((e) => e.name.toLowerCase() === name + '.md') ??
    entries.find((e) => e.name.toLowerCase().includes(name)) ??
    entries.find((e) => e.head.replace(/^#+\s*/, '').toLowerCase().includes(raw.toLowerCase())) ??
    null
  )
}

/**
 * 本地执行知识工具：load_knowledge(name) → 返回点文件全文（截 6000 字符）；
 * search_knowledge(query) → 主题词/二元组近似返回 ≤6 个匹配文件名。执行不抛错（返回提示串）。
 */
export async function runKnowledgeTool(call: KnowledgeToolCall): Promise<string> {
  const entries = await ensureKnowledgeLoaded()
  try {
    if (call.name === 'load_knowledge') {
      const name = toolParam(call, 'name')
      if (!name) return 'load_knowledge 缺少参数 name（点文件名，如 style-guochao）。'
      const e = findEntry(entries, name)
      if (!e) {
        return `未找到知识文件「${name}」。可在注册表查看点文件名，或改用 search_knowledge 检索。`
      }
      const body = e.text.length > 6000 ? e.text.slice(0, 6000) + '\n…（节选）' : e.text
      return `# ${e.name}（${e.dir}）\n${body}`
    }
    if (call.name === 'search_knowledge') {
      const q = toolParam(call, 'query')
      if (!q) return 'search_knowledge 缺少参数 query（检索主题，如 促销活动）。'
      const byName = new Map(entries.map((en) => [en.name, en]))
      const picked = new Set<string>()
      // 1) 主题词精确映射
      for (const [word, names] of Object.entries(TOPIC_MAP)) {
        if (q.includes(word)) for (const n of names) picked.add(n)
      }
      // 2) 二元组近似（排除 00-* 索引与顶层世界观文件）
      const bg = bigrams(q)
      const scored = entries
        .filter((e) => !picked.has(e.name) && !e.name.startsWith('00-') && e.name !== 'design-logic-components')
        .map((e) => {
          const hay = `${e.name} ${e.head} ${e.dir}`
          let score = 0
          for (const g of bg) if (hay.includes(g)) score++
          return { e, score }
        })
        .sort((a, b) => b.score - a.score)
      for (const s of scored) {
        if (picked.size >= 6) break
        if (s.score >= 2) picked.add(s.e.name)
      }
      if (!picked.size) {
        return `未检索到与「${q}」相关的知识。可用 load_knowledge 直接加载点文件，或在注册表中查看现有目录。`
      }
      const hits = [...picked].slice(0, 6).map((n) => byName.get(n)).filter(Boolean) as KnowledgeEntry[]
      return '命中：\n' + hits.map((e) => `- ${e.name}｜${shortHead(e)}`).join('\n')
    }
    return `未知知识工具：${call.name}（可用 load_knowledge / search_knowledge）。`
  } catch (err) {
    return `知识工具执行失败：${String(err)}`
  }
}
