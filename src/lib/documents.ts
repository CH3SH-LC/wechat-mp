// documents.ts —— V3-R1 推文文档双通道：Tauri → documents.rs（workspace/documents/<id>/）
// 浏览器 → localStorage。文档 id 与会话 id 相同：会话终稿默认自动落盘、就地刷新；删除会话联动删文档。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'

export interface AssetSnapL {
  svg: string
  ver: number
}

export interface DocContentL {
  id: string
  title: string
  updatedAt: string
  source: string
  html: string
  warnings: string[]
  snapshots: Record<string, AssetSnapL>
}

export interface DocMetaL {
  id: string
  title: string
  updatedAt: string
}

export interface SaveDocPayload {
  title: string
  source: string
  html: string
  warnings?: string[]
  snapshots?: Record<string, AssetSnapL>
}

const LS_KEY = 'wxmp-docs-v1'

interface LsDoc {
  title: string
  updatedAt: string
  source: string
  html: string
  warnings: string[]
  snapshots: Record<string, AssetSnapL>
}

interface LsState {
  docs: Record<string, LsDoc>
}

function lsRead(): LsState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { docs: {} }
    const s = JSON.parse(raw) as LsState
    return { docs: s.docs || {} }
  } catch {
    return { docs: {} }
  }
}

function lsWrite(s: LsState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    // ignore（超限等）
  }
}

function toMeta(id: string, d: LsDoc): DocMetaL {
  return { id, title: d.title, updatedAt: d.updatedAt }
}

export async function listDocuments(): Promise<DocMetaL[]> {
  if (inTauri()) {
    try {
      const r = await invoke<{ items: { id: string; title: string; updated_at: string }[] }>('list_documents')
      return r.items.map((m) => ({ id: m.id, title: m.title, updatedAt: m.updated_at }))
    } catch {
      return []
    }
  }
  return Object.entries(lsRead().docs)
    .map(([id, d]) => toMeta(id, d))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function openDocument(id: string): Promise<DocContentL | null> {
  if (inTauri()) {
    try {
      const f = await invoke<DocContentL | null>('open_document', { id })
      if (!f) return null
      return f
    } catch {
      return null
    }
  }
  const d = lsRead().docs[id]
  if (!d) return null
  return { id, ...d }
}

export async function saveDocument(id: string, p: SaveDocPayload): Promise<DocContentL | null> {
  if (inTauri()) {
    try {
      return await invoke<DocContentL>('save_document', {
        id,
        title: p.title,
        source: p.source,
        html: p.html,
        warnings: p.warnings || [],
        snapshots: p.snapshots || {},
      })
    } catch {
      return null
    }
  }
  const s = lsRead()
  const prev = s.docs[id]
  s.docs[id] = {
    title: p.title.trim() || prev?.title || '',
    updatedAt: new Date().toISOString(),
    source: p.source,
    html: p.html,
    warnings: p.warnings || prev?.warnings || [],
    snapshots: p.snapshots || prev?.snapshots || {},
  }
  lsWrite(s)
  return { id, ...s.docs[id] }
}

export async function deleteDocument(id: string): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('delete_document', { id })
    } catch {
      // ignore
    }
    return
  }
  const s = lsRead()
  delete s.docs[id]
  lsWrite(s)
}
