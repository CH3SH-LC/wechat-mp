// sessions.ts —— 多会话上下文：Tauri → sessions.rs（workspace/sessions/*.json）；浏览器 → localStorage
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'

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

export interface SessionsListL {
  items: SessionMetaL[]
  current: string | null
}

const LS_KEY = 'wxmp-sessions-v1'
const LEGACY_LS_KEY = 'wxmp-draft-v1'

interface LsState {
  current: string | null
  items: Record<string, Omit<SessionItem, 'id'>>
}

function lsRead(): LsState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { current: null, items: {} }
    return JSON.parse(raw) as LsState
  } catch {
    return { current: null, items: {} }
  }
}

function lsWrite(s: LsState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
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

export async function listSessions(): Promise<SessionsListL> {
  if (inTauri()) {
    try {
      const r = await invoke<{ items: { id: string; title: string; updated_at: string; count: number }[]; current: string | null }>('list_sessions')
      return {
        items: r.items.map((m) => ({ id: m.id, title: m.title, updatedAt: m.updated_at, count: m.count })),
        current: r.current,
      }
    } catch {
      return { items: [], current: null }
    }
  }
  lsMigrateLegacy()
  const s = lsRead()
  const items = Object.entries(s.items)
    .map(([id, it]) => toMeta(id, it))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return { items, current: s.current }
}

export async function createSession(): Promise<string> {
  if (inTauri()) {
    try {
      return await invoke<string>('create_session')
    } catch {
      return ''
    }
  }
  const s = lsRead()
  const id = `b${Date.now()}`
  s.items[id] = { title: '新对话', updatedAt: new Date().toISOString(), mode: 'auto', style: 'auto', messages: [] }
  s.current = id
  lsWrite(s)
  return id
}

export async function openSession(id: string): Promise<SessionItem | null> {
  if (inTauri()) {
    try {
      const f = await invoke<{ id: string; title: string; updated_at: string; mode: string; style: string; messages: SMsg[] } | null>('open_session', { id })
      if (!f) return null
      return { id: f.id, title: f.title, updatedAt: f.updated_at, mode: f.mode, style: f.style, messages: f.messages }
    } catch {
      return null
    }
  }
  const s = lsRead()
  const it = s.items[id]
  if (!it) return null
  s.current = id
  lsWrite(s)
  return { id, ...it }
}

export interface SavePayload {
  title?: string | null
  mode: string
  style: string
  messages: SMsg[]
}

export async function saveSession(id: string, p: SavePayload): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('save_session', {
        id,
        title: p.title ?? null,
        mode: p.mode,
        style: p.style,
        messages: p.messages,
      })
    } catch {
      // ignore
    }
    return
  }
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
}

export async function deleteSession(id: string): Promise<SessionsListL> {
  if (inTauri()) {
    try {
      const r = await invoke<{ items: { id: string; title: string; updated_at: string; count: number }[]; current: string | null }>('delete_session', { id })
      return {
        items: r.items.map((m) => ({ id: m.id, title: m.title, updatedAt: m.updated_at, count: m.count })),
        current: r.current,
      }
    } catch {
      return { items: [], current: null }
    }
  }
  const s = lsRead()
  delete s.items[id]
  if (s.current === id) s.current = Object.keys(s.items).sort().pop() ?? null
  lsWrite(s)
  return listSessions()
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
