import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { insertionImageSize, listInsertionImages, openInsertionImageFolder } from '../lib/insertion-images.ts'
import type { InsertionImageList } from '../lib/insertion-images.ts'
import './InsertionImagePicker.css'

interface Props {
  availableSlots: number
  disabled: boolean
  importing: boolean
  onAdd: (paths: string[]) => Promise<void>
  onClose: () => void
}

export default function InsertionImagePicker({ availableSlots, disabled, importing, onAdd, onClose }: Props) {
  const [listing, setListing] = useState<InsertionImageList | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [openingFolder, setOpeningFolder] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const mountedRef = useRef(false)
  const requestRef = useRef(0)
  const addingRef = useRef(false)

  const refresh = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const next = await listInsertionImages()
      if (!mountedRef.current || request !== requestRef.current) return
      setListing(next)
      const present = new Set(next.images.map((image) => image.path))
      setSelected((previous) => new Set([...previous].filter((path) => present.has(path))))
    } catch (e) {
      if (mountedRef.current && request === requestRef.current) setError(`读取图片列表失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (mountedRef.current && request === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const opener = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    dialog?.showModal()
    void refresh()
    return () => {
      mountedRef.current = false
      requestRef.current++
      dialog?.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [refresh])

  const openFolder = async () => {
    setOpeningFolder(true)
    setError('')
    try {
      await openInsertionImageFolder()
    } catch (e) {
      if (mountedRef.current) setError(`打开文件夹失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (mountedRef.current) setOpeningFolder(false)
    }
  }

  const blocked = disabled || importing
  const filtered = listing?.images.filter((image) => image.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? []
  const canAdd = !blocked && !loading && selected.size > 0 && selected.size <= availableSlots
  const add = async () => {
    if (!canAdd || addingRef.current) return
    addingRef.current = true
    try {
      await onAdd([...selected])
      if (mountedRef.current) onClose()
    } finally {
      addingRef.current = false
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="insertion-picker" aria-labelledby="insertion-picker-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
          .filter((element) => element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="insertion-picker-content">
        <header className="insertion-picker-head">
          <div>
            <h2 id="insertion-picker-title">待插入图片</h2>
            <p>选好图片，添加到当前消息后再发送。</p>
          </div>
          <button type="button" className="insertion-picker-button" onClick={onClose} aria-label="关闭待插入图片">关闭</button>
        </header>
        <div className="insertion-picker-body" aria-busy={loading}>
          <div className="insertion-picker-directory">
            <span className="insertion-picker-label">图片存放位置</span>
            <p>{listing?.directory || '文档 / wechat-mp-workspace / 待插入图片'}</p>
            <div className="insertion-picker-tools">
              <button type="button" className="insertion-picker-button" disabled={openingFolder} onClick={() => void openFolder()}>{openingFolder ? '正在打开…' : '打开文件夹'}</button>
              <button type="button" className="insertion-picker-button" disabled={loading || importing} onClick={() => void refresh()}>{loading ? '读取中…' : '刷新'}</button>
            </div>
          </div>
          <p className="insertion-picker-help">仅显示此文件夹本层的 PNG、JPEG、WebP、GIF、BMP 图片。</p>
          {error && <p className="insertion-picker-error" role="alert">{error}</p>}
          {!!listing?.warnings.length && <div className="insertion-picker-warnings" role="status">{listing.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}
          {!listing && loading && <p className="insertion-picker-help" role="status">正在读取图片列表…</p>}
          {listing?.images.length === 0 && !loading && <div className="insertion-picker-empty">
            <h3>这里还没有图片</h3>
            <ol>
              <li>点击“打开文件夹”。</li>
              <li>把要用的图片复制到这个文件夹。</li>
              <li>回到这里点击“刷新”，选图后添加到消息。</li>
            </ol>
          </div>}
          {!!listing?.images.length && <>
            <label className="insertion-picker-search">
              <span>查找文件名</span>
              <input type="search" value={query} placeholder="输入文件名" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <p className="insertion-picker-help">{query.trim() ? `找到 ${filtered.length} 张，共 ${listing.images.length} 张` : `共 ${listing.images.length} 张图片`}</p>
            <div className="insertion-picker-list" aria-label="待插入图片列表">
              {filtered.map((image) => <label key={image.path} className={`insertion-picker-file${selected.has(image.path) ? ' is-selected' : ''}`}>
                <input type="checkbox" checked={selected.has(image.path)} disabled={blocked || loading || (!selected.has(image.path) && selected.size >= availableSlots)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setSelected((previous) => {
                      const next = new Set(previous)
                      if (checked) next.add(image.path)
                      else next.delete(image.path)
                      return next
                    })
                  }} />
                <span className="insertion-picker-file-details"><span className="insertion-picker-filename">{image.name}</span><span className="insertion-picker-size">{insertionImageSize(image.byteLength)}</span></span>
              </label>)}
              {!filtered.length && <p className="insertion-picker-help">没有找到匹配的图片，试试其他文件名。</p>}
            </div>
          </>}
        </div>
        <footer className="insertion-picker-foot">
          <p role="status">{importing ? '正在保存原图…' : `已选 ${selected.size} 张 · 当前消息还可添加 ${availableSlots} 张`}</p>
          <button type="button" className="insertion-picker-button insertion-picker-add" disabled={!canAdd} onClick={() => void add()}>{importing ? '添加中…' : '添加到消息'}</button>
        </footer>
      </div>
    </dialog>, document.body,
  )
}
