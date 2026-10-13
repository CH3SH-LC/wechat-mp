import { useState } from 'react'
import type { DocMetaL } from '../lib/documents.ts'
import type { UnreadableItemL } from '../lib/sessions.ts'
import { fmtTime } from '../lib/sessions.ts'

interface Props {
  items: DocMetaL[]
  error: string | null
  unreadable: UnreadableItemL[]
  busy?: boolean
  onRetry: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export default function DocsPane({ items, error, unreadable, busy = false, onRetry, onOpen, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const visible = items.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  return (
    <div className="docs-pane" data-docs="1">
      <div className="docs-head">
        <div className="library-heading"><span className="dot dot-green" aria-hidden="true" /><h1>文档库</h1><span className="library-count">{items.length} 篇</span></div>
        <p>成稿自动保存在这里。打开文档，回到原会话继续修改。</p>
      </div>
      <div className="docs-toolbar">
        <input className="docs-query" type="search" aria-label="搜索文档" placeholder="搜索文档标题" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="library-results" role="status">{query.trim() ? `找到 ${visible.length} 篇文档` : `共 ${items.length} 篇文档`}</span>
      </div>
      <div className="docs-body">
        {error && (
          <div className="docs-error" data-list-error="1" role="alert">
            <span className="docs-error-text">文档库读取失败：{error}</span>
            <button className="mini docs-retry" disabled={busy} onClick={onRetry}>重试</button>
          </div>
        )}
        {unreadable.length > 0 && <div className="docs-unreadable" data-unreadable="1">有 {unreadable.length} 个文档无法读取</div>}
        {!error && items.length === 0 && <div className="docs-empty"><h2>你的下一篇推文，从对话开始</h2><p>在对话中完成创作后，文稿会自动出现在这里。</p></div>}
        {items.length > 0 && visible.length === 0 && <div className="docs-empty">没有找到匹配的文档，请换个关键词。</div>}
        {visible.map((d) => (
          <div key={d.id} className="doc-row" data-id={d.id}>
            <button className="doc-main doc-open" disabled={busy} onClick={() => onOpen(d.id)} title="打开此文档继续修改">
              <span className="doc-title">{d.title || '未命名推文'}</span>
              <span className="doc-meta">{d.updatedAt ? `更新于 ${fmtTime(d.updatedAt)}` : '未更新'}</span>
            </button>
            <button className="mini mini-danger doc-del" disabled={busy} title="删除此文档（连同其会话）" aria-label={`删除文档及会话：${d.title || '未命名推文'}`} onClick={() => onDelete(d.id)}>删除</button>
          </div>
        ))}
      </div>
    </div>
  )
}
