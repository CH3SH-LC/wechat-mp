// retrieval.ts —— 极简知识检索：按主题词映射 + 二元组相似度，从知识库挑 ≤K 个条目
import type { KnowledgePick } from './persona'

export interface KnowledgeEntry {
  path: string // 如 src/knowledge/视觉/模块/module-bubble.md
  name: string // 文件名（去 .md）
  dir: string // 方向目录名（中文）
  head: string // 一级标题行
  text: string // 全文
}

const mdFiles = import.meta.glob('/src/knowledge/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

let cache: KnowledgeEntry[] | null = null

export function loadKnowledge(): KnowledgeEntry[] {
  if (cache) return cache
  cache = Object.entries(mdFiles)
    .map(([path, text]) => {
      const rel = path.replace(/^\/src\/knowledge\//, '')
      const seg = rel.split('/')
      const name = (seg[seg.length - 1] || '').replace(/\.md$/, '')
      const dir = seg.length > 1 ? seg[0] : ''
      const head = (text.match(/^#\s+.*$/m) || [''])[0]
      return { path, name, dir, head, text }
    })
    .filter((e) => !e.name.startsWith('00-') && e.name !== 'design-logic-components')
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

export interface RetrievalResult {
  picks: KnowledgePick[]
  hits: string[] // 命中的主题词（调试/展示用）
  sourceCount: number
}

export function retrieve(query: string, topK = 6): RetrievalResult {
  const entries = loadKnowledge()
  const hits: string[] = []
  const byName = new Map(entries.map((e) => [e.name, e]))
  const picked = new Set<string>()

  // 1) 精确主题词映射
  for (const [word, names] of Object.entries(TOPIC_MAP)) {
    if (query.includes(word)) {
      hits.push(word)
      for (const n of names) picked.add(n)
    }
  }

  // 2) 相似度兜底：文件名 + 标题与查询的二元组重合
  const q = bigrams(query)
  const scored = entries
    .filter((e) => !picked.has(e.name))
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

  const picks: KnowledgePick[] = []
  for (const n of picked) {
    const e = byName.get(n)
    if (e) picks.push({ path: e.path, head: e.head, text: e.text })
  }
  return { picks, hits, sourceCount: entries.length }
}
