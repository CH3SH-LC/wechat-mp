// asset-library.ts —— V3-R2 个人素材库双通道：Tauri → assets.rs（workspace/assets/items/<id>/）
// 浏览器 → localStorage（wxmp-assets-v1）。素材 = SVG 源 + 语义元数据（desc 必须写清长什么样），
// 分类检索由 TS 确定性打分（标题/desc/tags bigram），风格仅为软参考；替换源时 version+1 并返回影响扫描。

import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat.ts'
import type { UnreadableItemL } from './sessions.ts'

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
  /**
   * 影响扫描是否完整（R3/update_asset）。非空 = 有文档未能判定是否引用了该素材——
   * 它必须让用户看到：把"某篇文档读不出来"当成"没有引用"，用户会以为可以安全覆盖，
   * 实际会改坏那篇文档。null = 扫描完整。
   */
  scanWarning: string | null
}

/**
 * 列表读取结果：**必须**区分「读取失败」与「库里没有素材」。
 *
 * 这个区分不只是显示问题：`image-agent.ts` 的 `materializePlaceholders` 拿到空库后，
 * 会把正文里**已经存在**的 `[[asset:…]]` 引用判成"库里没有这件素材"，从正文里剔除并
 * 告诉用户"所引用的库素材不存在"，还可能触发自动重写——结论与事实完全相反。
 *
 * `unreadable`：整体读取成功、但个别素材坏了/读不出来（meta 损坏或 IO 失败）。
 * 它们不在 items 里，界面给一条简短提示即可，不必铺开原因全文。
 */
export type AssetsListResult =
  | { ok: true; items: AssetMetaL[]; unreadable: UnreadableItemL[] }
  | { ok: false; error: string }

/** 单体读取结果：notFound=true 表示确实不存在；error 表示存在但读不出来 */
export type AssetReadResult = { ok: true; record: AssetRecordL } | { ok: false; notFound: boolean; error: string }

/** 异常 → 一句话原因（只用于提示与日志，不改写异常语义） */
function brief(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

// 首版八类（决策 D4：bg/icon 后置）。分类表已抽到零依赖的 asset-categories.ts——
// 纯解析层（asset-resolve）也要用它，不能被迫拖进 Tauri 依赖。这里原样再导出，保持既有引用路径。
export { ASSET_CATEGORIES, categoryKey, categoryLabel, usageForCategory } from './asset-categories.ts'
import { ASSET_CATEGORIES, categoryLabel } from './asset-categories.ts'

const LS_KEY = 'wxmp-assets-v1'

interface LsAsset {
  meta: AssetMetaL
  svg: string
}

interface LsState {
  items: Record<string, LsAsset>
}

/** 读 localStorage。**读不出来就抛**——由调用方判定"读失败"还是"库里没有素材"（不许静默当空） */
function lsRead(): LsState {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return { items: {} }
  const s = JSON.parse(raw) as LsState
  return { items: s.items || {} }
}

/** 写 localStorage；写失败（超限/不可写）就抛，由调用方判定是否成功 */
function lsWrite(s: LsState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
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

/**
 * 列表（权威口径）：读失败返回 {ok:false}（**不是**空数组）。
 * 需要区分"读不出来"与"库是空的"的调用方必须用这个；
 * `listAssets` 只是它的兼容包装（把失败压成空数组），仅供尚未迁移的调用方使用。
 *
 * 桌面端走 `list_assets_report`（R2）而不是 `list_assets`：旧命令返回裸数组，
 * "有素材坏了"会在列表里凭空消失而无人知晓；报告版把坏条目放进 unreadable 一并回传。
 */
export async function listAssetsSafe(category?: string): Promise<AssetsListResult> {
  if (inTauri()) {
    try {
      const r = await invoke<{ items: Record<string, unknown>[]; unreadable?: { id: string; error: string }[] }>(
        'list_assets_report',
        { category: category || null },
      )
      return {
        ok: true,
        items: (r.items || []).map(fromWire),
        unreadable: (r.unreadable || []).map((u) => ({ id: u.id, error: u.error })),
      }
    } catch (e) {
      console.warn('素材库读取失败：', e)
      return { ok: false, error: brief(e) }
    }
  }
  try {
    const all = Object.values(lsRead().items).map((a) => a.meta)
    const list = category ? all.filter((m) => m.category === category) : all
    // 浏览器端（localStorage）没有"坏文件"这一说：能读出就是全都能读
    return { ok: true, items: list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), unreadable: [] }
  } catch (e) {
    console.warn('素材库读取失败：', e)
    return { ok: false, error: brief(e) }
  }
}

/**
 * 兼容包装：读失败时返回空数组（= 与"库里没有素材"不可区分）。
 * **不要在新代码里用它**——image-agent / 工坊的"库里不存在"结论就是被它带偏的。
 */
export async function listAssets(category?: string): Promise<AssetMetaL[]> {
  const r = await listAssetsSafe(category)
  return r.ok ? r.items : []
}

/** 单体（权威口径）：区分「确实不存在」（notFound）与「存在但读不出来」（error） */
export async function getAssetSafe(id: string): Promise<AssetReadResult> {
  if (inTauri()) {
    try {
      const r = await invoke<{ meta: Record<string, unknown>; svg: string } | null>('get_asset', { id })
      if (!r) return { ok: false, notFound: true, error: '素材不存在' }
      return { ok: true, record: { meta: fromWire(r.meta), svg: r.svg } }
    } catch (e) {
      console.warn('素材读取失败：', e)
      return { ok: false, notFound: false, error: brief(e) }
    }
  }
  try {
    const a = lsRead().items[id]
    if (!a) return { ok: false, notFound: true, error: '素材不存在' }
    return { ok: true, record: { meta: { ...a.meta }, svg: a.svg } }
  } catch (e) {
    console.warn('素材读取失败：', e)
    return { ok: false, notFound: false, error: brief(e) }
  }
}

/** 兼容包装：把"没读到"（不存在**或**读失败）压成 null，供仍按 null 判定的调用方使用 */
export async function getAsset(id: string): Promise<AssetRecordL | null> {
  const r = await getAssetSafe(id)
  return r.ok ? r.record : null
}

export async function addAsset(input: AssetInputL): Promise<AssetMetaL | null> {
  if (inTauri()) {
    try {
      const r = await invoke<Record<string, unknown>>('add_asset', { input })
      return fromWire(r)
    } catch (e) {
      console.warn('素材入库失败：', e)
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
  try {
    const s = lsRead()
    s.items[meta.id] = { meta, svg: input.svg }
    lsWrite(s)
    return meta
  } catch (e) {
    console.warn('素材入库失败：', e)
    return null
  }
}

export async function updateAsset(id: string, patch: AssetPatchL, svg?: string): Promise<UpdateResultL | null> {
  if (inTauri()) {
    try {
      const r = await invoke<{
        meta: Record<string, unknown>
        references: { id: string; title: string }[]
        scan_warning?: string | null
      }>('update_asset', {
        id,
        patch,
        svg: svg || null,
      })
      return { meta: fromWire(r.meta), references: r.references || [], scanWarning: r.scan_warning ?? null }
    } catch (e) {
      console.warn('素材更新失败：', e)
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
    // ignore：影响扫描失败不影响本次更新
  }
  try {
    lsWrite(s)
  } catch (e) {
    console.warn('素材更新失败：', e)
    return null
  }
  return { meta: m, references, scanWarning: null }
}

/** 删除：返回是否真的删掉（false 时调用方不得当作已删除） */
export async function deleteAsset(id: string): Promise<boolean> {
  if (inTauri()) {
    try {
      await invoke('delete_asset', { id })
      return true
    } catch (e) {
      console.warn('素材删除失败：', e)
      return false
    }
  }
  try {
    const s = lsRead()
    delete s.items[id]
    lsWrite(s)
    return true
  } catch (e) {
    console.warn('素材删除失败：', e)
    return false
  }
}

// ---------- 确定性语义检索（主智能体/工坊共用；风格为软参考不做硬过滤） ----------

function bigrams(s: string): Set<string> {
  const clean = s.replace(/[\s\p{P}\p{S}]/gu, '')
  const out = new Set<string>()
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2))
  return out
}

export interface SearchAssetsOpts {
  category?: string // 硬过滤（单一分类；安放位约束）
  categories?: string[] // 硬过滤（多分类，供安放位候选集用）——在打分与截断之前生效
  style?: string // 软偏好词：命中加分，不做硬过滤
  limit?: number
}

/**
 * 语义检索：对 name/title/desc/tags 做查询词二元组打分 + 整词包含加分；
 * style 词命中额外加分（软参考，口径 4）。分数 >0 才返回，按分数降序、新建优先。
 *
 * P0（2026-09-24 调查 §1）：分类过滤必须在**打分与 limit 之前**完成。
 * 旧实现先按 limit 截前 10 条、再由调用方按分类筛，真正的合适候选可能已被截掉。
 */
export async function searchAssets(query: string, opts?: SearchAssetsOpts): Promise<AssetMetaL[]> {
  const q = String(query || '').trim()
  if (!q) return []
  const safe = await listAssetsSafe(opts?.category)
  // 库里读不出来时只能给出"没命中"（本函数签名是数组，无法向上表达失败）；
  // 调用方若需要区分，请改用 listAssetsSafe。
  if (!safe.ok) return []
  let all = safe.items
  if (opts?.categories?.length) {
    const allow = new Set(opts.categories)
    all = all.filter((m) => allow.has(m.category))
  }
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

/**
 * 一条素材的**统一清单行**：英文分类键 + 中文显示名 + 稳定 ID + 名称 + 语义描述 +
 * 可直接复制的完整引用。`prep.ts` 的 search_assets 与 `libraryDigest` 共用它——
 * 两个入口给出不同口径，正是修复计划阶段 2 要消除的问题。
 *
 * 行尾的引用写法带 ID：ID 是稳定标识，名称可能被用户改名，跨文档引用按 ID 才可靠。
 */
export function assetLine(m: AssetMetaL): string {
  const label = categoryLabel(m.category)
  const ref = assetRefOf(m, '按用途改这句说明')
  return `- ${m.category}（${label}）｜id=${m.id}｜name=${m.name}｜${m.title}｜${m.desc}（usage=${m.usage}，style=${m.style.join('/') || '任意'}，version=${m.version}）→ 引用写法 ${ref}`
}

/**
 * 规范引用写法（**按 ID**）：`[[asset:<英文分类键>|<素材ID>|<用途说明>]]`。
 * 用途说明由调用方给——它描述"这一处要它做什么"，不是素材自己的 desc。
 */
export function assetRefOf(m: Pick<AssetMetaL, 'id' | 'category'>, desc: string): string {
  return `[[asset:${m.category}|${m.id}|${String(desc || '').replace(/[|\]]/g, ' ').trim()}]]`
}

/** 给模型看的素材清单文本（prep/撰写上下文用，按最近创建倒序截取 ≤12 条） */
export async function libraryDigest(limit = 12): Promise<string> {
  const safe = await listAssetsSafe()
  // 读不出来时返回空串（= 本次不给清单）；模型会因此走"现场绘制"，不影响已有文档
  if (!safe.ok) return ''
  const pick = safe.items.slice(0, limit)
  if (!pick.length) return ''
  const lines = pick.map(assetLine)
  return `## 个人素材库（可复用清单，取自本机已入库素材；命中即照抄行尾的「引用写法」直接复用，库里没有的才写 [[img]]/[[deco]] 占位）\n${lines.join('\n')}`
}
