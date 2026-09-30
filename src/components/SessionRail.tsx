import { useRef, useState } from 'react'
import type { SessionMetaL, UnreadableItemL } from '../lib/sessions.ts'
import { fmtTime } from '../lib/sessions.ts'

interface Props {
  items: SessionMetaL[]
  currentId: string | null
  /** 读取失败的原因（null = 未失败）。**纯展示**：失败时不能说"还没有会话" */
  error: string | null
  /** 整体读得出来、但个别会话文件坏了：给一条简短提示（不铺开 error 全文） */
  unreadable: UnreadableItemL[]
  /** "当前会话"指针未能记录的原因（null = 正常）：说清重启后可能打开另一个会话 */
  stateWarning: string | null
  onRetry: () => void
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  /** 改名（双击标题进入行内输入）：由上层调 sessions.renameSession 并在成功后刷新列表；
   *  写没写进去由上层提示，组件不在这里吞掉失败 */
  onRename: (id: string, title: string) => void
}

// 左侧常驻会话栏（DSH 会话侧栏式）：新建/切换/删除一步直达，当前高亮
// 列表读不出来时显示失败原因 + 重试，而不是"还没有会话。"——那会让用户以为历史会话全没了。
// "整体读不出来"（error，带 data-list-error 契约）与"个别文件坏了"（unreadable）分开显示。
// 改名是**纯交互**（双击标题 → 行内输入 → Enter 提交 / Esc 取消 / 失焦提交），不参与对话流程（铁律 6）。
export default function SessionRail({ items, currentId, error, unreadable, stateWarning, onRetry, onNew, onOpen, onDelete, onRename }: Props) {
  // 行内改名的编辑态（哪一行在编辑 + 输入框内容）。只影响这一小块界面。
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  // 提交/Esc 会卸载输入框，浏览器可能在卸载时补一个 blur——用这个标记避免"取消被当成提交"
  const submittedRef = useRef(false)

  const beginRename = (m: SessionMetaL) => {
    submittedRef.current = false
    setEditingId(m.id)
    setDraft(m.title)
  }

  const commitRename = (id: string, original: string) => {
    submittedRef.current = true
    const t = draft.trim()
    setEditingId(null)
    // 空标题 / 没改动：当取消，不打后端（Rust 对空标题是静默保留旧名，前端不能当成功）
    if (!t || t === original) return
    onRename(id, t)
  }

  return (
    <aside className="session-rail">
      <div className="rail-head">
        <span className="rail-title">会话</span>
        <button className="btn btn-send rail-new" onClick={onNew}>
          新建
        </button>
      </div>
      <div className="session-list">
        {error ? (
          <div className="rail-error" data-list-error="1">
            <span className="rail-error-text">会话列表读取失败：{error}</span>
            <button className="mini rail-retry" onClick={onRetry}>
              重试
            </button>
          </div>
        ) : null}
        {unreadable.length > 0 && (
          <div className="rail-unreadable" data-unreadable="1">
            有 {unreadable.length} 个会话无法读取
          </div>
        )}
        {stateWarning && <div className="rail-unreadable" data-state-warning="1">当前会话未能记录，重启后可能打开的是另一个会话</div>}
        {!error && items.length === 0 && <div className="session-empty">还没有会话。</div>}
        {items.map((m) => (
          <div
            key={m.id}
            className={`sess-row ${m.id === currentId ? 'sess-active' : ''}`}
            data-id={m.id}
            onClick={() => onOpen(m.id)}
          >
            <div className="sess-main">
              {editingId === m.id ? (
                <input
                  className="sess-rename"
                  data-rename-input="1"
                  autoFocus
                  value={draft}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(m.id, m.title)
                    else if (e.key === 'Escape') {
                      submittedRef.current = true
                      setEditingId(null)
                    }
                  }}
                  onBlur={() => {
                    if (submittedRef.current) return
                    commitRename(m.id, m.title)
                  }}
                />
              ) : (
                <div className="sess-title" title={`${m.title}（双击改名）`} onDoubleClick={() => beginRename(m)}>
                  {m.title}
                </div>
              )}
              <div className="sess-meta">
                {m.count} 条消息 · {m.updatedAt ? fmtTime(m.updatedAt) : '未更新'}
              </div>
            </div>
            <button
              className="mini mini-danger sess-del"
              title="删除此会话"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(m.id)
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
