import type { DocMetaL } from '../lib/documents'
import { fmtTime } from '../lib/sessions'

interface Props {
  items: DocMetaL[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

// V3-R1 文档库工作区：顶栏「文档库」进入。展示默认自动保存的推文文档（真源+html 快照），
// 点文档 = 打开其源会话继续改（回到对话工作台）；删除文档会连同其会话一起删除。
export default function DocsPane({ items, onOpen, onDelete }: Props) {
  return (
    <div className="docs-pane" data-docs="1">
      <div className="docs-head">
        <span className="dot dot-green" />
        文档库
        <span className="hint">对话中成稿的推文会默认自动保存到这里；点开即回到原会话继续修改</span>
      </div>
      <div className="docs-body">
        {items.length === 0 && <div className="docs-empty">还没有文档。在对话工作台生成一篇推文后会自动出现在这里。</div>}
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
