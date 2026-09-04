import type { SessionMetaL } from '../lib/sessions'
import { fmtTime } from '../lib/sessions'

interface Props {
  items: SessionMetaL[]
  currentId: string | null
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function SessionMenu({ items, currentId, onNew, onOpen, onDelete, onClose }: Props) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="session-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <b>会话（独立上下文）</b>
          <button className="mini" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="session-list">
          {items.length === 0 && <div className="session-empty">还没有会话，点下方新建。</div>}
          {items.map((m) => (
            <div
              key={m.id}
              className={`sess-row ${m.id === currentId ? 'sess-active' : ''}`}
              data-id={m.id}
              onClick={() => onOpen(m.id)}
            >
              <div className="sess-main">
                <div className="sess-title">{m.title}</div>
                <div className="sess-meta">
                  {m.count} 条消息 · {m.updatedAt ? fmtTime(m.updatedAt) : '未更新'}
                  {m.id === currentId ? ' · 当前' : ''}
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
        <div className="settings-foot">
          <span className="settings-note">每个会话拥有独立的对话历史与内容，自动保存。</span>
          <button className="btn btn-send" onClick={onNew}>
            + 新建会话
          </button>
        </div>
      </div>
    </div>
  )
}
