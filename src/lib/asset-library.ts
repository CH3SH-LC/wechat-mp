// asset-library.ts —— V3-R2 个人素材库双通道：Tauri → assets.rs（workspace/assets/items/<id>/）
// 浏览器 → localStorage（wxmp-assets-v1）。素材 = SVG 源 + 语义元数据（desc 必须写清长什么样），
// 分类检索由 TS 确定性打分（标题/desc/tags bigram），风格仅为软参考；替换源时 version+1 并返回影响扫描。

import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'

export interface AssetMetaL {
  id: string
  category: string
  name: string
  title: string
  desc: string
  tags: string[]
  usage: string // deco | wide | inline
  placement: string
  style: string[]
  palette_note: string
  version: number
  origin: string // workshop | article-fallback
  createdAt: string
  updatedAt: string
}

export interface AssetInputL {
  category: string
  name: string
  title: string
  desc: string
  tags?: string[]
  usage?: string
  placement?: string
  style?: string[]
  palette_note?: string
  origin?: string
  svg: string
}

export interface AssetPatchL {
  name?: string
  title?: string
  desc?: string
  tags?: string[]
  usage?: string
  placement?: string
  style?: string[]
  palette_note?: string
}

export interface AssetRecordL {
  meta: AssetMetaL
  svg: string
}

export interface RefDocL {
  id: string
  title: string
}

export interface UpdateResultL {
  meta: AssetMetaL
  references: RefDocL[]
}

// 首版八类（决策 D4：bg/icon 后置）。defaultUsage：入库未指定时的引擎安放位推导
export const ASSET_CATEGORIES: { key: string; label: string; defaultUsage: string; hint: string }[] = [
  { key: 'bubble', label: '气泡（角饰）', defaultUsage: 'deco', hint: '气泡右下角的角饰/陪衬（如右下角一朵小花的气泡角饰）' },
  { key: 'divider', label: '分割线', defaultUsage: 'wide', hint: '横向窄条换场花饰/分割线素材' },
  { key: 'deco', label: '通用角饰', defaultUsage: 'deco', hint: '组件通用角落装饰，小巧精致' },
  { key: 'banner', label: '开篇横幅', defaultUsage: 'wide', hint: '文章开篇主视觉插画（宽幅）' },
  { key: 'heading', label: '小节装饰', defaultUsage: 'inline', hint: '小标题旁的横向装饰小图' },
  { key: 'art-inline', label: '正文内嵌插画', defaultUsage: 'inline', hint: '文中信息性小插画' },
  { key: 'art-wide', label: '宽幅插图', defaultUsage: 'wide', hint: '通栏插图/场景图' },
  { key: 'photo-frame', label: '照片位装饰框', defaultUsage: 'wide', hint: '与照片位并存的装饰画框' },
]

export function categoryLabel(key: string): string {
  return ASSET_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

const LS_KEY = 'wxmp-assets-v1'

interface LsAsset {
  meta: AssetMetaL
  svg: string
}

interface LsState {
  items: Record<string, LsAsset>
}

function lsRead(): LsState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { items: {} }
    const s = JSON.parse(raw) as LsState
    return { items: s.items || {} }
  } catch {
    return { items: {} }
  }
}

function lsWrite(s: LsState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    // ignore（超限等）
  }
}

function fromWire(m: Record<string, unknown>): AssetMetaL {
  return {
    id: String(m.id ?? ''),
    category: String(m.category ?? ''),
    name: String(m.name ?? ''),
    title: String(m.title ?? ''),
    desc: String(m.desc ?? ''),
    tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
    usage: String(m.usage ?? ''),
    placement: String(m.placement ?? ''),
    style: Array.isArray(m.style) ? (m.style as string[]) : [],
    palette_note: String(m.palette_note ?? ''),
    version: Number(m.version ?? 1),
    origin: String(m.origin ?? 'workshop'),
    createdAt: String(m.created_at ?? ''),
    updatedAt: String(m.updated_at ?? ''),
  }
}

function genBrowserId(): string {
  return `as-b${Date.now()}${Math.floor(Math.random() * 1000)}`
}

// 名称消毒：仅小写字母数字与中划线（bubble/deco 类名还要能被引擎装饰名语法引用）
export function sanitizeName(raw: string): string {
  const s = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'asset'
}

export async function listAssets(category?: string): Promise<AssetMetaL[]> {
  if (inTauri()) {
    try {
      const r = await invoke<Record<string, unknown>[]>('list_assets', { category: category || null })
      return r.map(fromWire)
    } catch {
      return []
    }
  }
  const all = Object.values(lsRead().items).map((a) => a.meta)
  const list = category ? all.filter((m) => m.category === category) : all
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function getAsset(id: string): Promise<AssetRecordL | null> {
  if (inTauri()) {
    try {
      const r = await invoke<{ meta: Record<string, unknown>; svg: string } | null>('get_asset', { id })
      if (!r) return null
      return { meta: fromWire(r.meta), svg: r.svg }
    } catch {
      return null
    }
  }
  const a = lsRead().items[id]
  return a ? { meta: { ...a.meta }, svg: a.svg } : null
}

export async function addAsset(input: AssetInputL): Promise<AssetMetaL | null> {
  if (inTauri()) {
    try {
      const r = await invoke<Record<string, unknown>>('add_asset', { input })
      return fromWire(r)
    } catch {
      return null
    }
  }
  const now = new Date().toISOString()
  const meta: AssetMetaL = {
    id: genBrowserId(),
    category: input.category,
    name: sanitizeName(input.name),
    title: input.title,
    desc: input.desc,
    tags: input.tags || [],
    usage: (input.usage || ASSET_CATEGORIES.find((c) => c.key === input.category)?.defaultUsage || 'inline') as 'deco' | 'wide' | 'inline',
    placement: input.placement || '',
    style: input.style || [],
    palette_note: input.palette_note || '',
    version: 1,
    origin: input.origin || 'workshop',
    createdAt: now,
    updatedAt: now,
  }
  const s = lsRead()
  s.items[meta.id] = { meta, svg: input.svg }
  lsWrite(s)
  return meta
}

export async function updateAsset(id: string, patch: AssetPatchL, svg?: string): Promise<UpdateResultL | null> {
  if (inTauri()) {
    try {
      const r = await invoke<{ meta: Record<string, unknown>; references: { id: string; title: string }[] }>('update_asset', {
        id,
        patch,
        svg: svg || null,
      })
      return { meta: fromWire(r.meta), references: r.references || [] }
    } catch {
      return null
    }
  }
  const s = lsRead()
  const a = s.items[id]
  if (!a) return null
  const m = a.meta
  if (patch.name !== undefined && patch.name.trim()) m.name = sanitizeName(patch.name)
  if (patch.title !== undefined) m.title = patch.title
  if (patch.desc !== undefined) m.desc = patch.desc
  if (patch.tags !== undefined) m.tags = patch.tags
  if (patch.usage !== undefined && patch.usage.trim()) m.usage = patch.usage as 'deco' | 'wide' | 'inline'
  if (patch.placement !== undefined) m.placement = patch.placement
  if (patch.style !== undefined) m.style = patch.style
  if (patch.palette_note !== undefined) m.palette_note = patch.palette_note
  m.updatedAt = new Date().toISOString()
  if (svg && svg.trim()) {
    a.svg = svg
    m.version += 1
  }
  lsWrite(s)
  // 浏览器端影响扫描：解析各文档 source 中的 [[asset:分类|<id>|…]] 引用
  const references: RefDocL[] = []
  try {
    const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {}
    for (const [docId, d] of Object.entries(docs) as [string, { title: string; source: string }][]) {
      if ((d.source || '').includes(`|${id}|`) && (d.source || '').includes('[[asset:')) {
        references.push({ id: docId, title: d.title || '' })
      }
    }
  } catch {
    // ignore
  }
  return { meta: m, references }
}

export async function deleteAsset(id: string): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('delete_asset', { id })
    } catch {
      // ignore
    }
    return
  }
  const s = lsRead()
  delete s.items[id]
  lsWrite(s)
}

// ---------- 确定性语义检索（主智能体/工坊共用；风格为软参考不做硬过滤） ----------

function bigrams(s: string): Set<string> {
  const clean = s.replace(/[\s\p{P}\p{S}]/gu, '')
  const out = new Set<string>()
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2))
  return out
}

export interface SearchAssetsOpts {
  category?: string // 硬过滤（安放位约束）
  style?: string // 软偏好词：命中加分，不做硬过滤
  limit?: number
}

/**
 * 语义检索：对 name/title/desc/tags 做查询词二元组打分 + 整词包含加分；
 * style 词命中额外加分（软参考，口径 4）。分数 >0 才返回，按分数降序、新建优先。
 */
export async function searchAssets(query: string, opts?: SearchAssetsOpts): Promise<AssetMetaL[]> {
  const q = String(query || '').trim()
  if (!q) return []
  const all = await listAssets(opts?.category)
  if (!all.length) return []
  const qb = bigrams(q)
  const qLower = q.toLowerCase()
  const styleWords = opts?.style ? bigrams(opts.style) : null
  const scored = all
    .map((m) => {
      const hay = `${m.name} ${m.title} ${m.desc} ${m.tags.join(' ')}`.toLowerCase()
      const hayB = bigrams(hay)
      let score = 0
      for (const g of qb) if (hayB.has(g)) score += 1
      if (qLower.length >= 2 && hay.includes(qLower)) score += 4 // 整词/整句包含 → 强命中
      if (styleWords) {
        for (const g of styleWords) if (hayB.has(g)) score += 0.5
      }
      return { m, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.m.createdAt < b.m.createdAt ? 1 : -1))
  return scored.slice(0, opts?.limit ?? 10).map((x) => x.m)
}

/** 给模型看的素材清单文本（prep/撰写上下文用，按最近创建倒序截取 ≤12 条） */
export async function libraryDigest(limit = 12): Promise<string> {
  const all = await listAssets()
  const pick = all.slice(0, limit)
  if (!pick.length) return ''
  const lines = pick.map(
    (m) => `- ${m.category}｜${m.name}｜${m.title}｜${m.desc}（usage=${m.usage}，style=${m.style.join('/') || '任意'}）`,
  )
  return `## 个人素材库（可复用清单，取自本机已入库素材；命中即用 [[asset:分类|名称或ID|用途]] 引用，库里没有的才写 [[img]]/[[deco]] 占位）\n${lines.join('\n')}`
}
