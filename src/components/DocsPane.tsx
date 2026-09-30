import type { DocMetaL } from '../lib/documents.ts'
import type { UnreadableItemL } from '../lib/sessions.ts'
import { fmtTime } from '../lib/sessions.ts'

interface Props {
  items: DocMetaL[]
  /** 读取失败的原因（null = 未失败）。**纯展示**：失败时给的是"读不出来"，绝不能显示成"还没有文档" */
  error: string | null
  /** 整体读得出来、但个别文档坏了：给一条简短提示（不铺开 error 全文） */
  unreadable: UnreadableItemL[]
  onRetry: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

// V3-R1 文档库工作区：顶栏「文档库」进入。展示默认自动保存的推文文档（真源+html 快照），
// 点文档 = 打开其源会话继续改（回到对话工作台）；删除文档会连同其会话一起删除。
// 读取失败与"库里没有文档"是两件事：前者给原因 + 重试，只有真的空库才说"还没有文档"。
export default function DocsPane({ items, error, unreadable, onRetry, onOpen, onDelete }: Props) {
  return (
    <div className="docs-pane" data-docs="1">
      <div className="docs-head">
        <span className="dot dot-green" />
        文档库
      </div>
      <div className="docs-body">
        {error ? (
          <div className="docs-error" data-list-error="1">
            <span className="docs-error-text">文档库读取失败：{error}</span>
            <button className="mini docs-retry" onClick={onRetry}>
              重试
            </button>
          </div>
        ) : null}
        {unreadable.length > 0 && (
          <div className="docs-unreadable" data-unreadable="1">
            有 {unreadable.length} 个文档无法读取
          </div>
        )}
        {!error && items.length === 0 && <div className="docs-empty">还没有文档。</div>}
        {items.map((d) => (
          <div key={d.id} className="doc-row" data-id={d.id} onClick={() => onOpen(d.id)} title="打开此文档继续修改">
            <div className="doc-main">
              <div className="doc-title">{d.title || '未命名推文'}</div>
              <div className="doc-meta">
                {d.updatedAt ? `更新于 ${fmtTime(d.updatedAt)}` : '未更新'}
              </div>
            </div>
            <button
              className="mini mini-danger doc-del"
              title="删除此文档（连同其会话）"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(d.id)
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
