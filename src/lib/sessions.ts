// sessions.ts —— 多会话上下文：Tauri → sessions.rs（workspace/sessions/*.json）；浏览器 → localStorage
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat.ts'

export interface SMsg {
  id: number
  role: string
  content: string
}

export interface SessionItem {
  id: string
  title: string
  updatedAt: string
  mode: string
  style: string
  messages: SMsg[]
}

export interface SessionMetaL {
  id: string
  title: string
  updatedAt: string
  count: number
}

/**
 * 「读不出来」的条目（会话/文档/素材共用同一形状，与 Rust 的 `UnreadableItem` 对齐）。
 *
 * 为什么需要它：列表接口过去容易把"读取失败"折叠成"不存在"，于是界面无法区分
 * "没有这条"与"这条坏了"，用户会看到东西凭空消失。坏条目仍**不进** `items`
 * （拿不到完整正文就不该当正常项渲染），但必须在同一次返回里如实报出 id 与原因——
 * 界面据此给一条简短提示（不铺开 error 全文）。
 */
export interface UnreadableItemL {
  id: string
  error: string
}

export interface SessionsListL {
  items: SessionMetaL[]
  current: string | null
  /** 文件损坏/读失败的会话：它们不在 items 里，但必须让界面知道它们存在过 */
  unreadable: UnreadableItemL[]
  /** "当前会话"指针（state.json）读写异常的原因；null = 正常 */
  stateWarning: string | null
}

/**
 * 列表/删除结果：**必须**区分「读取失败」与「没有会话」。
 * 失败折叠成空列表会让界面显示"还没有会话"、并在启动时自动建会话——历史会话看上去像被清空了。
 */
export type SessionsResult = { ok: true; list: SessionsListL } | { ok: false; error: string }

/** 单体读取结果：notFound=true 表示确实不存在；error 表示存在但读不出来 */
export type SessionOpenResult = { ok: true; item: SessionItem } | { ok: false; notFound: boolean; error: string }

/** 异常 → 一句话原因（只用于提示与日志，不改写异常语义） */
function brief(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

const LS_KEY = 'wxmp-sessions-v1'
const LEGACY_LS_KEY = 'wxmp-draft-v1'

interface LsState {
  current: string | null
  items: Record<string, Omit<SessionItem, 'id'>>
}

/** 读 localStorage。**读不出来就抛**——由调用方判定"读失败"还是"没有会话"（不许静默当空） */
function lsRead(): LsState {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return { current: null, items: {} }
  return JSON.parse(raw) as LsState
}

/** 写 localStorage；写失败（超限/不可写）就抛，由调用方判定是否成功 */
function lsWrite(s: LsState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

function lsMigrateLegacy() {
  const s = lsRead()
  if (Object.keys(s.items).length) return
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY)
    if (!raw) return
    const d = JSON.parse(raw) as { updatedAt?: string; mode?: string; style?: string; messages?: SMsg[] }
    const id = 'legacy1'
    const user = (d.messages || []).find((m) => m.role === 'user')
    const title = user ? user.content.slice(0, 16) + (user.content.length > 16 ? '…' : '') : '新对话'
    s.items[id] = {
      title,
      updatedAt: d.updatedAt || '',
      mode: d.mode || 'auto',
      style: d.style || 'auto',
      messages: d.messages || [],
    }
    s.current = id
    lsWrite(s)
    localStorage.removeItem(LEGACY_LS_KEY)
  } catch {
    // ignore
  }
}

function toMeta(id: string, it: Omit<SessionItem, 'id'>): SessionMetaL {
  return { id, title: it.title, updatedAt: it.updatedAt, count: it.messages.length }
}

/** Rust `SessionsList` 的线上形状（含 R1/R6 新增的诊断字段，旧版本缺省时按空处理） */
interface SessionsListWire {
  items: { id: string; title: string; updated_at: string; count: number }[]
  current: string | null
  unreadable?: { id: string; error: string }[]
  state_warning?: string | null
}

/** 线上形状 → 前端形状：把 unreadable / state_warning 一并透传出去，不丢掉"有东西坏了"这件事 */
function fromWireList(r: SessionsListWire): SessionsListL {
  return {
    items: r.items.map((m) => ({ id: m.id, title: m.title, updatedAt: m.updated_at, count: m.count })),
    current: r.current,
    unreadable: (r.unreadable || []).map((u) => ({ id: u.id, error: u.error })),
    stateWarning: r.state_warning ?? null,
  }
}

/** 列表：读失败返回 {ok:false}（**不是**空列表）——界面据此区分"读不出来"与"还没有会话" */
export async function listSessions(): Promise<SessionsResult> {
  if (inTauri()) {
    try {
      const r = await invoke<SessionsListWire>('list_sessions')
      return { ok: true, list: fromWireList(r) }
    } catch (e) {
      console.warn('会话列表读取失败：', e)
      return { ok: false, error: brief(e) }
    }
  }
  try {
    lsMigrateLegacy()
    const s = lsRead()
    const items = Object.entries(s.items)
      .map(([id, it]) => toMeta(id, it))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    // 浏览器端（localStorage）没有"坏文件"这一说：读不出来就是整体失败，能读出就是全都能读
    return { ok: true, list: { items, current: s.current, unreadable: [], stateWarning: null } }
  } catch (e) {
    console.warn('会话列表读取失败：', e)
    return { ok: false, error: brief(e) }
  }
}

/** 新建：返回新会话 id；返回空串表示**未创建成功**（调用方不得当作已建好） */
export async function createSession(): Promise<string> {
  if (inTauri()) {
    try {
      return await invoke<string>('create_session')
    } catch (e) {
      console.warn('新建会话失败：', e)
      return ''
    }
  }
  try {
    const s = lsRead()
    const id = `b${Date.now()}`
    s.items[id] = { title: '新对话', updatedAt: new Date().toISOString(), mode: 'auto', style: 'auto', messages: [] }
    s.current = id
    lsWrite(s)
    return id
  } catch (e) {
    console.warn('新建会话失败：', e)
    return ''
  }
}

/** 单体：区分「确实不存在」（notFound）与「存在但读不出来」（error） */
export async function openSession(id: string): Promise<SessionOpenResult> {
  if (inTauri()) {
    try {
      const f = await invoke<{ id: string; title: string; updated_at: string; mode: string; style: string; messages: SMsg[] } | null>('open_session', { id })
      if (!f) return { ok: false, notFound: true, error: '会话不存在' }
      return { ok: true, item: { id: f.id, title: f.title, updatedAt: f.updated_at, mode: f.mode, style: f.style, messages: f.messages } }
    } catch (e) {
      console.warn('会话读取失败：', e)
      return { ok: false, notFound: false, error: brief(e) }
    }
  }
  try {
    const s = lsRead()
    const it = s.items[id]
    if (!it) return { ok: false, notFound: true, error: '会话不存在' }
    s.current = id
    lsWrite(s)
    return { ok: true, item: { id, ...it } }
  } catch (e) {
    console.warn('会话读取失败：', e)
    return { ok: false, notFound: false, error: brief(e) }
  }
}

export interface SavePayload {
  title?: string | null
  mode: string
  style: string
  messages: SMsg[]
}

/** 存档：返回是否真的写入（false = 没落盘，界面不得当作已存档） */
export async function saveSession(id: string, p: SavePayload): Promise<boolean> {
  if (inTauri()) {
    try {
      await invoke('save_session', {
        id,
        title: p.title ?? null,
        mode: p.mode,
        style: p.style,
        messages: p.messages,
      })
      return true
    } catch (e) {
      console.warn('会话存档失败：', e)
      return false
    }
  }
  try {
    const s = lsRead()
    const prev = s.items[id]
    let title = p.title && p.title !== '新对话' ? p.title : prev?.title && prev.title !== '新对话' ? prev.title : ''
    if (!title) {
      const u = p.messages.find((m) => m.role === 'user')
      title = u ? u.content.slice(0, 16) + (u.content.length > 16 ? '…' : '') : '新对话'
    }
    s.items[id] = { title, updatedAt: new Date().toISOString(), mode: p.mode, style: p.style, messages: p.messages }
    s.current = id
    lsWrite(s)
    return true
  } catch (e) {
    console.warn('会话存档失败：', e)
    return false
  }
}

/** 删除：成功返回删除后的列表；失败返回 {ok:false}（调用方**不得**据此清空会话栏） */
export async function deleteSession(id: string): Promise<SessionsResult> {
  if (inTauri()) {
    try {
      const r = await invoke<SessionsListWire>('delete_session', { id })
      return { ok: true, list: fromWireList(r) }
    } catch (e) {
      console.warn('删除会话失败：', e)
      return { ok: false, error: brief(e) }
    }
  }
  try {
    const s = lsRead()
    delete s.items[id]
    if (s.current === id) s.current = Object.keys(s.items).sort().pop() ?? null
    lsWrite(s)
  } catch (e) {
    console.warn('删除会话失败：', e)
    return { ok: false, error: brief(e) }
  }
  return listSessions()
}

/**
 * 改名：成功返回 true；失败返回 false（调用方**不得**当作已改名）。
 *
 * 空标题（trim 后为空）视为无效请求，直接 false 且不打后端——Rust 侧 `rename_at` 对空标题
 * 是「保留旧名」的静默忽略，前端若当成功会让用户看到"改了名但没变"。
 */
export async function renameSession(id: string, title: string): Promise<boolean> {
  const t = title.trim()
  if (!t) return false
  if (inTauri()) {
    try {
      await invoke('rename_session', { id, title: t })
      return true
    } catch (e) {
      console.warn('会话改名失败：', e)
      return false
    }
  }
  try {
    const s = lsRead()
    const it = s.items[id]
    if (!it) return false
    // 只改标题：updatedAt 保持不动，避免改名把会话在列表里的位置挪走（Rust 侧同理）
    s.items[id] = { ...it, title: t }
    lsWrite(s)
    return true
  } catch (e) {
    console.warn('会话改名失败：', e)
    return false
  }
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
