// documents.ts —— V3-R1 推文文档双通道：Tauri → documents.rs（workspace/documents/<id>/）
// 浏览器 → localStorage。文档 id 与会话 id 相同：会话终稿默认自动落盘、就地刷新；删除会话联动删文档。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat.ts'
import type { AssetBinding } from './image-agent.ts'
import type { UnreadableItemL } from './sessions.ts'

export interface AssetSnapL {
  svg: string
  ver: number
}

/** 素材位 → 库素材 id / 来源 / 原因的确定绑定（P0 §7：不靠自然语言描述恢复素材身份；
 *  阶段 3 增 slotId：素材位在本轮创作内的稳定标识，供单项重试与跨轮追踪，旧文档缺省为空串） */
export type AssetBindingL = AssetBinding

export interface DocContentL {
  id: string
  title: string
  updatedAt: string
  source: string
  html: string
  warnings: string[]
  snapshots: Record<string, AssetSnapL>
  bindings: AssetBindingL[]
  // ---- 版本信息（Rust 侧附加字段；旧格式文档缺省为空）----
  /** 这次读到的内容属于哪一版 */
  revisionId?: string | null
  acceptedRevisionId?: string | null
  draftRevisionId?: string | null
  generation?: number
  /**
   * 该版本的验收状态：`""`（未记录）/ `"verified"`（经交付门禁通过）/ `"unverified"`（旧格式迁移，未验证）/ `"failed"`。
   *
   * 判定"能不能当回滚目标"只看它——**不能因为有图片就当合格**（计划 §7.3：
   * 旧三文件文档迁移来的版本没有验收记录，故标 unverified）。
   */
  validation?: string
  quality?: unknown
  runId?: string | null
  /**
   * 浏览器端等价标记（localStorage 没有版本目录，用布尔表达同一件事）。
   * 桌面端读到的对象里没有它——`isAcceptedDoc` 会优先看 `validation`。
   */
  accepted?: boolean
}

/**
 * 该版本是否**已通过交付门禁**。唯一判据是验收记录，**不是"有没有图"**——
 * 旧格式迁移来的版本没有验收记录，因此不能当合格的回滚目标（计划 §7.3）。
 *
 * 两条通道的字段不同但语义一致：
 * - 桌面：Rust 版本的 `validation`（`verified` / `unverified` / `failed` / 空串）；
 * - 浏览器：localStorage 没有版本目录，用等价的布尔标记 `accepted`。
 */
export function isAcceptedDoc(d: DocContentL | null | undefined): boolean {
  if (!d) return false
  if (d.validation) return d.validation === 'verified'
  return d.accepted === true
}

export interface DocMetaL {
  id: string
  title: string
  updatedAt: string
}

/** 保存时附带的交付元信息（计划 §4/§7：同一份版本必须完整绑定源文、HTML、素材与质量结果） */
export interface SaveDocMeta {
  /**
   * 本次保存是否提交为**成品**。
   * - true  → 走成品提交：`validation="verified"` 且必须带 quality（Rust 会校验），推进成品指针；
   * - false/缺省 → `asDraft: true`：只推进**草稿**指针，**不动已验收成品**（失败候选不得替换成品）。
   */
  accepted?: boolean
  /** 本候选基于哪一份已提交版本（提交前校验，旧请求不得覆盖较新的提交） */
  baseRevisionId?: string
  /** 产生这一版的 runId（日志与版本对齐） */
  runId?: string
  /** 本轮候选的交付判定（Rust 只存不解释，原样随版本落盘） */
  quality?: unknown
  /** 检查实现版本标识（可复现"这一版是按哪套规则验收的"） */
  validationVersion?: string
}

export interface SaveDocPayload {
  title: string
  source: string
  html: string
  warnings?: string[]
  snapshots?: Record<string, AssetSnapL>
  bindings?: AssetBindingL[]
  accepted?: boolean
  baseRevisionId?: string
  runId?: string
  quality?: unknown
  validationVersion?: string
}

/**
 * 列表读取结果：**必须**区分「读取失败」与「没有文档」。
 * 失败若折叠成空数组，界面会把"读不出来"显示成"还没有文档"——那是与事实相反的结论。
 * `unreadable`：整体读取成功、但个别文档坏了/读不出来——它们不在 items 里，界面给一条简短提示。
 */
export type DocsListResult =
  | { ok: true; items: DocMetaL[]; unreadable: UnreadableItemL[] }
  | { ok: false; error: string }

/** 单体读取结果：notFound=true 表示确实不存在；error 表示存在但读不出来（两者文案不同） */
export type DocOpenResult = { ok: true; doc: DocContentL } | { ok: false; notFound: boolean; error: string }

/** 异常 → 一句话原因（只用于提示与日志，不改写异常语义） */
function brief(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

const LS_KEY = 'wxmp-docs-v1'

/** 浏览器端的一"版"内容（与桌面 `revisions/<id>/` 里的四件套一一对应） */
interface LsRevision {
  title: string
  updatedAt: string
  source: string
  html: string
  warnings: string[]
  snapshots: Record<string, AssetSnapL>
  bindings: AssetBindingL[]
}

interface LsDoc extends LsRevision {
  /**
   * 浏览器端的**成品指针**（桌面端等价物是 `manifest.json` 的 `acceptedRevisionId`）。
   *
   * 为什么不能只用一个 `accepted: boolean`：那样"存一版没过门禁的草稿"会顺手把成品的
   * 验收标记抹掉（实测：回退场景里 `accepted` 被草稿改成 false，文档看起来"从来没验收过"）。
   * 桌面侧是两个指针（accepted / draft）互不影响，浏览器端必须表达同一件事。
   * 有成品时，**顶层字段就是成品内容**（`open_document` 在半台只返回已提交成品），草稿另存。
   */
  accepted?: boolean
  revisionId?: string
  /** 未提交的草稿（不通过门禁时写入；有成品时顶层仍是成品内容） */
  draft?: LsRevision
}

interface LsState {
  docs: Record<string, LsDoc>
}

/** 读 localStorage。**读不出来就抛**——由调用方判定"读失败"还是"没有内容"（不许静默当空） */
function lsRead(): LsState {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return { docs: {} }
  const s = JSON.parse(raw) as LsState
  return { docs: s.docs || {} }
}

/** 写 localStorage；写失败（超限/不可写）就抛，由调用方判定是否成功 */
function lsWrite(s: LsState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

function toMeta(id: string, d: LsDoc): DocMetaL {
  return { id, title: d.title, updatedAt: d.updatedAt }
}

/** 列表：读失败返回 {ok:false}（**不是**空数组）——界面据此区分"读不出来"与"还没有文档" */
export async function listDocuments(): Promise<DocsListResult> {
  if (inTauri()) {
    try {
      const r = await invoke<{ items: { id: string; title: string; updated_at: string }[]; unreadable?: { id: string; error: string }[] }>(
        'list_documents',
      )
      return {
        ok: true,
        items: r.items.map((m) => ({ id: m.id, title: m.title, updatedAt: m.updated_at })),
        // R3：坏文稿不在 items 里（拿不到完整正文就不该当正常项渲染），但必须如实报出来——
        // 丢掉它，一篇正文完好的稿子会像不存在一样从列表里消失。
        unreadable: (r.unreadable || []).map((u) => ({ id: u.id, error: u.error })),
      }
    } catch (e) {
      console.warn('文档库读取失败：', e)
      return { ok: false, error: brief(e) }
    }
  }
  try {
    const items = Object.entries(lsRead().docs)
      .map(([id, d]) => toMeta(id, d))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    // 浏览器端（localStorage）没有"坏文件"这一说：整体读不出来就是失败，能读就是全都能读
    return { ok: true, items, unreadable: [] }
  } catch (e) {
    console.warn('文档库读取失败：', e)
    return { ok: false, error: brief(e) }
  }
}

/**
 * Rust 侧返回的是 serde 原名（`updated_at` / `revision_id` / `run_id` …），
 * 而本模块对外一律用 camelCase。**必须显式映射**：曾经这里直接把对象透传，
 * 于是 `doc.updatedAt` 在桌面端恒为 undefined（列表路径有映射所以看不出来）——
 * 同一份数据两条读取路径口径不一致，这类"看起来有值其实没有"的字段最难查。
 */
function fromRustContent(f: Record<string, unknown>): DocContentL {
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
  return {
    id: String(f.id ?? ''),
    title: String(f.title ?? ''),
    updatedAt: String(f.updated_at ?? ''),
    source: String(f.source ?? ''),
    html: String(f.html ?? ''),
    warnings: Array.isArray(f.warnings) ? (f.warnings as string[]) : [],
    snapshots: (f.snapshots as Record<string, AssetSnapL>) || {},
    bindings: (f.bindings as AssetBindingL[]) || [],
    revisionId: str(f.revision_id),
    acceptedRevisionId: str(f.accepted_revision_id),
    draftRevisionId: str(f.draft_revision_id),
    generation: typeof f.generation === 'number' ? f.generation : 0,
    validation: str(f.validation) ?? '',
    quality: f.quality ?? null,
    runId: str(f.run_id),
  }
}

/** 单体：区分「确实不存在」（notFound）与「存在但读不出来」（error） */
export async function openDocumentSafe(id: string): Promise<DocOpenResult> {
  if (inTauri()) {
    try {
      const f = await invoke<Record<string, unknown> | null>('open_document', { id })
      if (!f) return { ok: false, notFound: true, error: '文档不存在' }
      return { ok: true, doc: fromRustContent(f) }
    } catch (e) {
      console.warn('文档读取失败：', e)
      return { ok: false, notFound: false, error: brief(e) }
    }
  }
  try {
    const d = lsRead().docs[id]
    if (!d) return { ok: false, notFound: true, error: '文档不存在' }
    return { ok: true, doc: { id, ...d, bindings: d.bindings || [] } }
  } catch (e) {
    console.warn('文档读取失败：', e)
    return { ok: false, notFound: false, error: brief(e) }
  }
}

/**
 * 兼容包装：把"没读到"（不存在**或**读失败）统一压成 null，供仍按 null 判定的调用方使用
 * （AssetWorkshop 的"文档不存在，可能已被删除"）。需要区分两者的调用方请用 openDocumentSafe。
 */
export async function openDocument(id: string): Promise<DocContentL | null> {
  const r = await openDocumentSafe(id)
  return r.ok ? r.doc : null
}

export async function saveDocument(id: string, p: SaveDocPayload): Promise<DocContentL | null> {
  if (inTauri()) {
    try {
      // 成品提交必须带质量记录（Rust 侧 `validation="verified"` 时会校验），
      // 否则报错——这是"磁盘保存成功 ≠ 验收通过"在协议层的落点。
      const asDraft = !p.accepted
      return await invoke<DocContentL>('save_document', {
        id,
        title: p.title,
        source: p.source,
        html: p.html,
        warnings: p.warnings || [],
        snapshots: p.snapshots || {},
        bindings: p.bindings || [],
        quality: p.quality ?? null,
        runId: p.runId ?? null,
        validationVersion: p.validationVersion ?? null,
        validation: asDraft ? 'failed' : 'verified',
        baseRevisionId: p.baseRevisionId ?? null,
        expectedGeneration: null,
        asDraft,
      })
    } catch (e) {
      // 返回 null = 未写入（调用方必须查返回值；这里同时留下原因）
      console.warn('文档保存失败：', e)
      return null
    }
  }
  try {
    const s = lsRead()
    const prev = s.docs[id]
    const now = new Date().toISOString()
    const revision: LsRevision = {
      title: p.title.trim() || prev?.title || '',
      updatedAt: now,
      source: p.source,
      html: p.html,
      warnings: p.warnings || prev?.warnings || [],
      snapshots: p.snapshots || prev?.snapshots || {},
      bindings: p.bindings ?? prev?.bindings ?? [],
    }
    if (p.accepted) {
      // 提交成品：顶层字段就是成品内容；若这版内容与草稿相同则草稿可以清掉
      s.docs[id] = { ...revision, accepted: true, revisionId: prev?.revisionId }
    } else if (prev?.accepted) {
      // 已有成品时存草稿：**顶层仍是成品**（读回来的是已提交的那一版），新内容存进 draft。
      // 这正是桌面端两个指针的语义——草稿不得顶掉成品，也不得抹掉成品的验收标记。
      s.docs[id] = { ...prev, draft: revision }
    } else {
      // 还没有成品：草稿就是当前内容（读回来是这一版，但 accepted=false，不是合格回滚目标）
      s.docs[id] = { ...revision, accepted: false, revisionId: prev?.revisionId }
    }
    lsWrite(s)
    return { id, ...s.docs[id] }
  } catch (e) {
    console.warn('文档保存失败：', e)
    return null
  }
}

/** 删除：返回是否真的删掉（false 时调用方不得当作已删除） */
export async function deleteDocument(id: string): Promise<boolean> {
  if (inTauri()) {
    try {
      await invoke('delete_document', { id })
      return true
    } catch (e) {
      console.warn('文档删除失败：', e)
      return false
    }
  }
  try {
    const s = lsRead()
    delete s.docs[id]
    lsWrite(s)
    return true
  } catch (e) {
    console.warn('文档删除失败：', e)
    return false
  }
}
