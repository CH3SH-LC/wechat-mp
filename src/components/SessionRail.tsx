import type { SessionMetaL } from '../lib/sessions'
import { fmtTime } from '../lib/sessions'

interface Props {
  items: SessionMetaL[]
  currentId: string | null
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

// 左侧常驻会话栏（DSH 会话侧栏式）：新建/切换/删除一步直达，当前高亮
export default function SessionRail({ items, currentId, onNew, onOpen, onDelete }: Props) {
  return (
    <aside className="session-rail">
      <div className="rail-head">
        <span className="rail-title">会话</span>
        <button className="btn btn-send rail-new" onClick={onNew}>
          新建
        </button>
      </div>
      <div className="session-list">
        {items.length === 0 && <div className="session-empty">还没有会话。</div>}
        {items.map((m) => (
          <div
            key={m.id}
            className={`sess-row ${m.id === currentId ? 'sess-active' : ''}`}
            data-id={m.id}
            onClick={() => onOpen(m.id)}
          >
            <div className="sess-main">
              <div className="sess-title" title={m.title}>
                {m.title}
              </div>
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
      <div className="rail-foot">每个会话独立上下文，自动保存</div>
    </aside>
  )
}
