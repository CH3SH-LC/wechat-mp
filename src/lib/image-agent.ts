// image-agent.ts —— 素材子智能体编排与"素材解析器"（第 24 轮起 / V3-R3 升级）
// 职责：
// 1. 把 v2 正文里的素材引用解析为实际 SVG——先解析个人素材库的确定性引用
//    `[[asset:分类|名称或ID|用途]]`，命中即复用、不再现场画（计入 info.used 供文档固化快照）；
// 2. 传统图位占位 `[[img:…]]/[[deco:…]]`：先按语义检索个人素材库（强命中才转库引用），
//    未命中才交给素材智能体 gen_svg 现场绘制（桌面模式自动存回素材库 origin=article-fallback，D7）；
// 3. 主文档智能体绝不内联 SVG——SVG 全部来自素材库或素材智能体（V3 口径 2）。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'
import { svgElementCount } from './compose'
import { addAsset, getAsset, listAssets, sanitizeName, searchAssets } from './asset-library'
import type { AssetMetaL } from './asset-library'

// ---------- 浏览器演示用本地样例 SVG（均带 viewBox、图形元素 ≥6，纯色无文字） ----------
const POOL: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210" fill="none">
<rect x="60" y="140" width="5" height="62" fill="#c96f4a"/>
<path d="M65 142 h170 l-24 16 24 16 h-170 z" fill="#e8b48a"/>
<circle cx="628" cy="64" r="36" fill="#f2c76e"/>
<circle cx="640" cy="52" r="5" fill="#ffffff"/>
<path d="M0 210 L160 148 L280 186 L430 112 L570 170 L750 96 V210 Z" fill="#d9a35f" opacity="0.35"/>
<path d="M0 210 L230 158 L390 190 L560 134 L750 172 V210 Z" fill="#c96f4a" opacity="0.22"/>
<path d="M560 40 q12 -20 30 -20 q-4 -14 -22 -14 q-20 0 -26 14 q-8 14 4 22 q10 -6 14 -2z" fill="#5f8d8a" opacity="0.5"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" fill="none">
<path d="M150 250 C140 180 120 140 90 110" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M150 250 C165 190 195 150 230 130" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="90" cy="104" r="16" fill="#e8b48a"/>
<circle cx="236" cy="124" r="14" fill="#d9a35f"/>
<circle cx="150" cy="150" r="20" fill="#c96f4a"/>
<path d="M120 130 q-26 -8 -34 -30 q28 2 40 18z" fill="#8fb8a4"/>
<path d="M188 170 q24 -14 44 -6 q-10 24 -38 18z" fill="#8fb8a4"/>
<circle cx="90" cy="104" r="6" fill="#f2c76e"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="70" y="152" width="610" height="6" rx="3" fill="#c9a86a"/>
<path d="M180 152 v-70 h110 v70 z" fill="#8a5f3a"/>
<path d="M180 82 c-6 -20 8 -30 30 -28 l-4 30 c-12 2 -20 4 -26 10 z" fill="#a97c50"/>
<path d="M300 96 h140 v56 h-140 z" fill="#b98a5e"/>
<circle cx="235" cy="120" r="12" fill="#f2c76e"/>
<path d="M320 62 q12 -18 28 -18 q-2 -16 -20 -18 q-18 2 -22 18 q-4 18 16 22 q6 -8 12 -4z" fill="#6b8e6e" opacity="0.55"/>
<path d="M360 66 q12 -14 26 -14 q2 -12 -12 -16 q-14 -2 -20 10 q-4 12 8 20 q6 -6 10 -2z" fill="#6b8e6e" opacity="0.45"/>
<path d="M470 96 c32 -36 128 -36 160 0 v56 h-160 z" fill="#e8dcc8"/>
<circle cx="548" cy="120" r="10" fill="#f2c76e"/>
</svg>`,
]

let poolIdx = 0

/** V3-R2：浏览器演示链路（素材工坊/子智能体）共用的本地样例 SVG（轮换取样） */
export function mockArtSvg(): string {
  const s = POOL[poolIdx % POOL.length]
  poolIdx++
  return s
}

// ---------- 占位/引用检测 ----------

// 占位/引用行是否存在于 v2 正文（主模型未内联 SVG，仅写图位/引用）
export function hasPlaceholders(v2: string): boolean {
  return (
    /\[\[img:(?:wide|inline)\|[^\]]+\]\]/.test(v2) ||
    /\[\[deco:[A-Za-z0-9_-]+\|[^\]]+\]\]/.test(v2) ||
    /\[\[asset:[a-z-]+\|[a-zA-Z0-9_-]+\|[^\]]+\]\]/.test(v2)
  )
}

// ---------- 素材解析信息 ----------

export interface MaterializeInfo {
  used: Record<string, { id: string; title: string }> // 本次实际复用的库素材 id
  residual: number // 无法解析的 [[asset:…]] 引用行数（触发"库素材引用缺失"可修复警告）
  storedFallback: number // 现场补做并自动存回素材库的数量（桌面）
}

const ASSET_REF_RE = /^\[\[asset:([a-z-]+)\|([a-zA-Z0-9_-]+)\|([^\]]+)\]\]$/

function isAssetRef(line: string): { cat: string; id: string; desc: string } | null {
  const m = ASSET_REF_RE.exec(line.trim())
  return m ? { cat: m[1], id: m[2], desc: m[3] } : null
}

// 传统图位占位 → 候选库分类（安放位硬约束）
function candidatesFor(kind: string): string[] {
  if (kind === 'wide') return ['banner', 'art-wide', 'divider', 'photo-frame']
  if (kind === 'inline') return ['heading', 'art-inline']
  return ['bubble', 'deco'] // deco 角饰
}

// 检索命中打分（bigram 口径，供"强命中才转库引用"阈值判断）
function scoreOf(query: string, m: AssetMetaL): number {
  const clean = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '')
  const q = clean(query)
  if (q.length < 2) return 0
  const hay = clean(`${m.name} ${m.title} ${m.desc} ${m.tags.join(' ')}`)
  const bg = new Set<string>()
  for (let i = 0; i < q.length - 1; i++) bg.add(q.slice(i, i + 2))
  let score = 0
  for (const g of bg) if (hay.includes(g)) score += 1
  return score
}

// 素材块落位：usage=deco → ::: art deco <id>（供气泡 |> [!语义|id] 引用）；
// usage=wide/inline → ::: art wide/inline（整行图）
async function svgBlock(item: AssetMetaL, desc: string): Promise<string | null> {
  const rec = await getAsset(item.id)
  if (!rec || !rec.svg.trim()) return null
  const d = desc.trim() || item.title || item.name
  if (item.usage === 'deco') {
    return `::: art deco ${item.id}\n${rec.svg}\n:::`
  }
  return `::: art ${item.usage === 'wide' ? 'wide' : 'inline'} ${d}\n${rec.svg}\n:::`
}

/**
 * V3-R3 素材解析主入口：把 v2 正文中可解析的素材引用/占位替换为真实素材块。
 * - `[[asset:…]]` → 按 id/名称查素材库：命中 → 就地内联（计入 info.used）；未命中 → 保留原行并计入 residual
 * - `[[img:…]]/[[deco:…]]` → 先按语义检索库（强命中才转库引用）；否则现场委托素材智能体绘制
 * 桌面（inTauri）现场补做后自动入库（origin=article-fallback）；浏览器演示走本地样例、不入库。
 */
export async function materializePlaceholders(
  v2: string,
  theme?: string,
  info?: MaterializeInfo | null,
): Promise<string> {
  const inf: MaterializeInfo = info || { used: {}, residual: 0, storedFallback: 0 }
  const lines = String(v2 || '').split(/\r?\n/)

  // 全量库条目索引（小库单次读取即可）
  const lib = await listAssets()
  const byId = new Map(lib.map((m) => [m.id, m]))
  const byName = new Map(lib.map((m) => [m.name, m]))
  const lookup = (key: string): AssetMetaL | undefined => byId.get(key) ?? byName.get(key)

  // 传统占位的语义检索缓存（同描述只搜一次）
  const searchCache = new Map<string, AssetMetaL | null>()

  const out: string[] = []
  for (const line of lines) {
    const assetRef = isAssetRef(line)
    if (assetRef) {
      const item = lookup(assetRef.id)
      if (item) {
        const blk = await svgBlock(item, assetRef.desc)
        if (blk) {
          inf.used[item.id] = { id: item.id, title: item.title || item.name }
          out.push(blk)
          continue
        }
      }
      // 未命中/读取失败：保留原行，调用方检出后由自动质检让模型改引用或换占位
      inf.residual++
      out.push(line)
      continue
    }

    const imgM = line.match(/^\[\[img:(wide|inline)\|([^\]]+)\]\]$/)
    const decoM = line.match(/^\[\[deco:([A-Za-z0-9_-]+)\|([^\]]+)\]\]$/)
    if (imgM || decoM) {
      const kind = imgM ? imgM[1] : 'deco'
      const desc = imgM ? imgM[2] : decoM![2]
      const descKey = `${kind}:${desc}`
      let hit: AssetMetaL | null | undefined = searchCache.get(descKey)
      if (hit === undefined) {
        const cand = candidatesFor(kind)
        const res = await searchAssets(desc, { style: theme })
        const pooled = res.filter((m) => cand.includes(m.category))
        const qLower = desc.toLowerCase()
        hit =
          pooled.find((m) => `${m.name} ${m.title} ${m.desc}`.toLowerCase().includes(qLower)) ||
          pooled.find((m) => scoreOf(desc, m) >= 3) ||
          null
        searchCache.set(descKey, hit)
      }
      if (hit) {
        const blk = await svgBlock(hit, desc)
        if (blk) {
          inf.used[hit.id] = { id: hit.id, title: hit.title || hit.name }
          out.push(blk)
          continue
        }
      }
      // 库无强命中 → 现场委托素材智能体（原 gen 路径）
      const svg = await generateSvg(kind as 'wide' | 'inline' | 'deco', desc, theme)
      if (svg) {
        if (inTauri()) {
          // D7：现场补做自动存回个人素材库（origin=article-fallback），此后可直接复用
          const meta = await addAsset({
            category: kind === 'deco' ? 'deco' : kind === 'wide' ? 'art-wide' : 'art-inline',
            name: sanitizeName(`${kind}-${Date.now().toString(36)}`),
            title: desc.slice(0, 16),
            desc,
            usage: kind === 'deco' ? 'deco' : kind,
            origin: 'article-fallback',
            svg,
          })
          if (meta) inf.storedFallback++
        }
        out.push(kind === 'deco' ? `::: art deco ${decoM![1]}\n${svg}\n:::` : `::: art ${kind} ${desc}\n${svg}\n:::`)
      } else {
        out.push(`（此美术素材生成失败：${desc}）`)
      }
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

// ---------- 素材智能体现场绘制（桌面 gen_svg + CLARIFY 有界回问；浏览器样例池） ----------

const CLARIFY_PREFIX = 'CLARIFY:'

async function generateSvg(kind: 'wide' | 'inline' | 'deco', desc: string, theme?: string): Promise<string | null> {
  if (!inTauri()) {
    await new Promise((r) => setTimeout(r, 40))
    const s = mockArtSvg()
    return /<svg\b[^>]*viewBox="[^"]*"/.test(s) && svgElementCount(s) >= 6 ? s : null
  }
  const callOnce = async (d: string): Promise<string | null> => {
    try {
      const svg = await invoke<string>('gen_svg', { kind, desc: d, theme: theme || null })
      if (svg.startsWith(CLARIFY_PREFIX)) {
        const question = svg.slice(CLARIFY_PREFIX.length).trim()
        const refined = await invoke<string>('refine_brief', { desc: d, question, theme: theme || null })
        if (refined && refined.trim()) {
          const svg2 = await invoke<string>('gen_svg', { kind, desc: refined.trim(), theme: theme || null })
          if (svg2.startsWith(CLARIFY_PREFIX)) return null
          return svg2 && /<svg\b[^>]*viewBox="[^"]*"/.test(svg2) && svgElementCount(svg2) >= 6 ? svg2 : null
        }
        return null
      }
      return svg && /<svg\b[^>]*viewBox="[^"]*"/.test(svg) && svgElementCount(svg) >= 6 ? svg : null
    } catch (e) {
      console.warn('gen_svg 失败：', e)
      return null
    }
  }
  let svg = await callOnce(desc)
  if (!svg) svg = await callOnce(desc) // 瞬态空/失败重试一次（第 31 轮防御）
  return svg
}
