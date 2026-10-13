import { useRef, useState } from 'react'
import type { SessionMetaL, UnreadableItemL } from '../lib/sessions.ts'
import { fmtTime } from '../lib/sessions.ts'

interface Props {
  items: SessionMetaL[]
  currentId: string | null
  error: string | null
  unreadable: UnreadableItemL[]
  stateWarning: string | null
  busy?: boolean
  onRetry: () => void
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

export default function SessionRail({ items, currentId, error, unreadable, stateWarning, busy = false, onRetry, onNew, onOpen, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const submittedRef = useRef(false)
  const visible = items.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  const beginRename = (m: SessionMetaL) => {
    if (busy) return
    submittedRef.current = false
    setEditingId(m.id)
    setDraft(m.title)
  }

  const commitRename = (id: string, original: string) => {
    submittedRef.current = true
    const t = draft.trim()
    setEditingId(null)
    if (!t || t === original || busy) return
    onRename(id, t)
  }

  return (
    <aside id="session-sidebar" className="session-rail" aria-label="会话列表">
      <div className="rail-head">
        <span className="rail-title">会话 <span className="rail-count">{items.length}</span></span>
        <button className="btn btn-send rail-new" disabled={busy} onClick={onNew}>新建</button>
      </div>
      <div className="rail-search">
        <input className="rail-query" type="search" aria-label="搜索会话" placeholder="搜索会话" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="session-list">
        {error && (
          <div className="rail-error" data-list-error="1" role="alert">
            <span className="rail-error-text">会话列表读取失败：{error}</span>
            <button className="mini rail-retry" disabled={busy} onClick={onRetry}>重试</button>
          </div>
        )}
        {unreadable.length > 0 && <div className="rail-unreadable" data-unreadable="1">有 {unreadable.length} 个会话无法读取</div>}
        {stateWarning && <div className="rail-unreadable" data-state-warning="1">当前会话未能记录，重启后可能打开的是另一个会话</div>}
        {!error && items.length === 0 && <div className="session-empty">还没有会话。新建一个，开始写作。</div>}
        {items.length > 0 && visible.length === 0 && <div className="session-empty">没有找到匹配的会话。</div>}
        {visible.map((m) => (
          <div key={m.id} className={`sess-row ${m.id === currentId ? 'sess-active' : ''}`} data-id={m.id}>
            <div className="sess-main">
              {editingId === m.id ? (
                <input
                  className="sess-rename"
                  data-rename-input="1"
                  aria-label="会话名称"
                  autoFocus
                  disabled={busy}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(m.id, m.title) }
                    else if (e.key === 'Escape') { submittedRef.current = true; setEditingId(null) }
                  }}
                  onBlur={() => { if (!submittedRef.current) commitRename(m.id, m.title) }}
                />
              ) : (
                <button className="sess-open" disabled={busy} aria-current={m.id === currentId ? 'true' : undefined} onClick={() => onOpen(m.id)}>
                  <span className="sess-title" title={m.title} onDoubleClick={() => beginRename(m)}>{m.title}</span>
                  <span className="sess-meta">{m.count} 条消息 · {m.updatedAt ? fmtTime(m.updatedAt) : '未更新'}</span>
                </button>
              )}
            </div>
            <div className="sess-actions">
              <button className="mini sess-rename-action" disabled={busy} title="修改会话名称" aria-label={`重命名会话：${m.title}`} onClick={() => beginRename(m)}>改名</button>
              <button className="mini mini-danger sess-del" disabled={busy} title="删除此会话" aria-label={`删除会话：${m.title}`} onClick={() => onDelete(m.id)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
