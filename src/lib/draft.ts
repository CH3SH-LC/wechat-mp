// draft.ts —— 会话自动存档：Tauri → Rust draft.json（文档/wechat-mp-workspace/）；浏览器 → localStorage
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'
import type { DisplayMsg } from '../components/ChatPane'

export interface DraftData {
  v: 1
  updatedAt: string // ISO
  mode: string
  style: string
  messages: DisplayMsg[]
}

interface RustDraft {
  version: number
  updated_at: string
  mode: string
  style: string
  messages: { id: number; role: string; content: string }[]
}

const LS_KEY = 'wxmp-draft-v1'

export interface LoadResult {
  data: DraftData | null
}

export async function loadDraft(): Promise<LoadResult> {
  if (inTauri()) {
    try {
      const d = (await invoke('load_draft')) as RustDraft | null
      if (!d) return { data: null }
      return {
        data: {
          v: 1,
          updatedAt: d.updated_at,
          mode: d.mode,
          style: d.style,
          messages: d.messages as DisplayMsg[],
        },
      }
    } catch {
      return { data: null }
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { data: null }
    const d = JSON.parse(raw) as DraftData
    return { data: d }
  } catch {
    return { data: null }
  }
}

export async function saveDraft(data: DraftData): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('save_draft', {
        draft: {
          version: data.v,
          updated_at: data.updatedAt,
          mode: data.mode,
          style: data.style,
          messages: data.messages,
        },
      })
    } catch {
      // 存档失败不阻塞对话
    }
    return
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export async function clearDraft(): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('save_draft', {
        draft: { version: 1, updated_at: '', mode: 'auto', style: 'auto', messages: [] },
      })
    } catch {
      // ignore
    }
    return
  }
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
