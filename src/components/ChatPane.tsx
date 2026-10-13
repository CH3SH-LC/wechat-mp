import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { splitAssistant } from '../lib/extract.ts'
import type { TaskEvent } from '../lib/progress.ts'
import WorkingBubble from './WorkingBubble.tsx'
import { getLocalImage, importLocalImage, MAX_ATTACHED_IMAGES, onLocalImageImported } from '../lib/local-images.ts'
import type { LocalImageMeta, LocalImageRecord } from '../lib/local-images.ts'

export interface DisplayMsg {
  id: number
  role: 'user' | 'assistant' | 'error'
  content: string
  localImages?: LocalImageMeta[]
}

/** P2：预览里点选组件后，把一段文本锚点插进输入框草稿（用户自己补指令再发送） */
export interface ChatPaneApi {
  insertRef: (text: string) => void
}

interface Props {
  msgs: DisplayMsg[]
  busy: boolean
  /** 会话正在读取或保存时暂缓输入，不表示模型正在工作。 */
  disabled?: boolean
  /** 只控制当前面板是否接收拖入，不参与创作意图或对话路由。 */
  active?: boolean
  onSend: (text: string) => void
  onStop: () => void
  status: string
  /** 当前工作阶段与细节（读资料 / 思考 / 撰写 / 素材 / 质检 / 保存），仅展示 */
  task?: TaskEvent | null
  /** 本轮开始时间戳，供工作气泡显示已耗时 */
  turnStartedAt?: number | null
  /** 已入库的本地原图。发送后稳定 ID 随消息存档。 */
  images?: LocalImageRecord[]
  onAttachImages?: (images: LocalImageRecord[]) => void
  onRemoveImage?: (idx: number) => void
  apiRef?: React.Ref<ChatPaneApi>
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('读取图片失败'))
    r.readAsDataURL(file)
  })
}

function SavedImage({ image }: { image: LocalImageMeta }) {
  const [preview, setPreview] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let sequence = 0
    const load = () => {
      const own = ++sequence
      void getLocalImage(image.assetId).then((record) => {
        if (active && own === sequence) { setPreview(record.modelDataUrl); setFailed(false) }
      }).catch(() => { if (active && own === sequence) setFailed(true) })
    }
    load()
    const unsubscribe = onLocalImageImported((id) => { if (id === image.assetId) load() })
    return () => { active = false; unsubscribe() }
  }, [image.assetId])
  return <span className="attach-chip" title={image.name}>
    {preview && <img src={preview} alt={image.name} />}
    <span className="attach-name">{failed ? `图片暂不可读：${image.name}` : image.name}</span>
  </span>
}

const QUICK_PROMPTS = [
  '帮我写一篇推文，主题是新书上市',
  '写一篇新生入学典礼的宣传类推文，校园风',
  '写一篇咖啡店新品上新的宣传推文，日系风',
  '写一篇软件使用教程的干货文，配图少一点',
  '公众号推文怎么起标题？',
]

export default function ChatPane({
  msgs,
  busy,
  disabled = false,
  active = true,
  onSend,
  onStop,
  status,
  task = null,
  turnStartedAt = null,
  images = [],
  onAttachImages,
  onRemoveImage,
  apiRef,
}: Props) {
  const [input, setInput] = useState('')
  const [openSrc, setOpenSrc] = useState<ReadonlySet<number>>(new Set())
  const [imgErr, setImgErr] = useState('')
  const [importing, setImporting] = useState(false)
  const importingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const followRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const nativeDropRef = useRef<(paths: string[]) => void>(() => {})
  // WebView2 默认由 Tauri 接管文件拖放，不会派发 DOM drop；真实桌面需要监听原生事件。
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<{ paths: string[] }>('tauri://drag-drop', (event) => nativeDropRef.current(event.payload.paths || []))
      .then((fn) => { if (disposed) fn(); else unlisten = fn })
      .catch((e) => console.warn('图片拖入监听失败，可用图片按钮或粘贴添加：', e))
    return () => { disposed = true; unlisten?.() }
  }, [])

  // 只控制滚动呈现：用户上翻阅读时不抢位置，与模型对话决策无关。
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    if (followRef.current) {
      body.scrollTop = body.scrollHeight
      setHasNewMessages(false)
    } else {
      setHasNewMessages(true)
    }
  }, [msgs, busy, task?.text])

  const jumpToLatest = () => {
    followRef.current = true
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
    setAwayFromBottom(false)
    setHasNewMessages(false)
  }

  // 导入完成才允许发送；失败逐张说明，已经成功保存的原图继续保留。
  const pickFiles = async (files: FileList | (File | string)[] | null) => {
    if (!files || !files.length || !onAttachImages || !active || busy || disabled || importingRef.current) return
    importingRef.current = true
    setImporting(true)
    setImgErr('')
    const errors: string[] = []
    const remaining = Math.max(0, MAX_ATTACHED_IMAGES - images.length)
    if (files.length > remaining) errors.push(`每条消息最多附加 ${MAX_ATTACHED_IMAGES} 张图片，多出的图片未添加`)
    const imported: LocalImageRecord[] = []
    try {
      for (const f of Array.from(files as ArrayLike<File | string>).slice(0, remaining)) {
        const name = typeof f === 'string' ? f.split(/[\\/]/).pop() || f : f.name
        if ((typeof f === 'string' || !/^image\//.test(f.type)) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) {
          errors.push(`${name}：只支持 PNG、JPEG、WebP、GIF、BMP 图片`)
          continue
        }
        if (typeof f !== 'string' && f.size > 32 * 1024 * 1024) {
          errors.push(`${name}：单张图片需小于 32MB`)
          continue
        }
        try {
          imported.push(await importLocalImage(typeof f === 'string' ? { path: f, name } : { dataUrl: await readAsDataUrl(f), name }))
        } catch (e) {
          errors.push(`${name}：${e instanceof Error ? e.message : String(e)}`)
        }
      }
      if (mountedRef.current) {
        if (imported.length) onAttachImages(imported)
        setImgErr(errors.join('；'))
      }
    } finally {
      importingRef.current = false
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  nativeDropRef.current = (paths) => { void pickFiles(paths) }

  // 只做"把文本追加进草稿并聚焦"，不触发发送、不参与任何流程判断（项目铁律 6）。
  useImperativeHandle(
    apiRef,
    () => ({
      insertRef: (text: string) => {
        setInput((prev) => {
          const sep = !prev || /\s$/.test(prev) ? '' : ' '
          return prev + sep + text
        })
        window.setTimeout(() => {
          const el = inputRef.current
          if (el) {
            el.focus()
            el.setSelectionRange(el.value.length, el.value.length)
          }
        }, 0)
      },
    }),
    [],
  )

  const toggleSrc = (id: number) => {
    setOpenSrc((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const send = () => {
    const t = input.trim()
    if (!t || busy || disabled || importingRef.current) return
    jumpToLatest()
    setInput('')
    onSend(t)
  }

  return (
    <div className="chat-pane"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void pickFiles(e.dataTransfer.files) } }}
    >
      <div className="chat-head">
        <span className="dot" />
        AI 对话
        <span className={`badge ${status.includes('模拟') ? 'badge-warn' : 'badge-ok'}`}>{status}</span>
      </div>

      <div
        className="chat-body"
        ref={bodyRef}
        role="log"
        aria-label="对话记录"
        aria-live="off"
        tabIndex={0}
        onScroll={() => {
          const body = bodyRef.current
          if (!body) return
          const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80
          followRef.current = nearBottom
          setAwayFromBottom(!nearBottom)
          if (nearBottom) setHasNewMessages(false)
        }}
      >
        {msgs.length === 0 && (
          <div className="chat-empty">
            <div className="empty-eyebrow">从一个想法开始</div>
            <h1>把想法变成一篇好推文</h1>
            <p>告诉我主题、读者和手头的资料。成稿后，可以在预览中点选内容，继续提出修改。</p>
            <div className="chips">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} className="chip" disabled={busy || disabled || importing} onClick={() => { jumpToLatest(); onSend(p) }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="msg msg-user">
                <pre className="msg-user-text">{m.content}</pre>
                {!!m.localImages?.length && <div className="attach-strip">{m.localImages.map((image, i) => <SavedImage key={`${image.assetId}-${i}`} image={image} />)}</div>}
              </div>
            )
          }
          if (m.role === 'error') {
            return (
              <div key={m.id} className="msg msg-error" role="alert">
                {m.content}
              </div>
            )
          }
          // assistant：只展示围栏外说明文字；正文（v2）或直通 HTML 收进可展开查看器
          const { prose, code, v2 } = splitAssistant(m.content)
          const src = code !== null ? code : v2
          // 本轮首个 token 还没到：不渲染空的助手气泡，状态交给下方工作气泡承担
          // （回合结束后这条消息必有内容，DOM 与改造前一致）
          if (busy && !m.content) return null
          const showPlaceholder = !prose && !busy && src !== null
          return (
            <div key={m.id} className="msg msg-assistant">
              <div className="assistant-box">
                <pre className="msg-assistant-text">
                  {prose || (showPlaceholder ? '已生成推文，见右侧预览。' : '')}
                </pre>
                {src !== null && (
                  <div className="src-area">
                    <button className="src-toggle" aria-expanded={openSrc.has(m.id)} aria-controls={`message-source-${m.id}`} onClick={() => toggleSrc(m.id)}>
                      {openSrc.has(m.id) ? (code !== null ? '收起 HTML 源码' : '收起正文') : code !== null ? '查看 HTML 源码' : '查看正文'}
                    </button>
                    {openSrc.has(m.id) && <pre className="src-view" id={`message-source-${m.id}`}>{src}</pre>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {/* 「AI 工作中」气泡：阶段标签 + 真实细节 + 本轮已耗时（纯展示，非对话状态机） */}
        {busy && <WorkingBubble phase={task?.phase ?? 'think'} detail={task?.text ?? ''} startedAt={turnStartedAt} />}
      </div>

      {awayFromBottom && (
        <div className="chat-jump-row">
          <button className="mini chat-jump" onClick={jumpToLatest}>
            {hasNewMessages ? '有新内容 · 回到最新' : '回到最新消息'}
          </button>
        </div>
      )}
      {images.length > 0 && (
        <div className="attach-strip">
          {images.map((image, i) => (
            <span key={i} className="attach-chip" data-idx={i}>
              <img src={image.modelDataUrl} alt={image.name} title={image.name} />
              <button className="attach-del" disabled={busy || disabled || importing} title={`移除${image.name}`} onClick={() => onRemoveImage?.(i)}>
                移除
              </button>
            </span>
          ))}
        </div>
      )}
      {imgErr && <div className="attach-err" role="alert">{imgErr}</div>}
      {importing && <div className="attach-err" role="status">正在保存原图…</div>}
      <div className="chat-input-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          multiple
          className="attach-input"
          onChange={(e) => void pickFiles(e.target.files)}
        />
        <button className="mini attach-btn" disabled={busy || disabled || importing} title="添加本地图片（原图保存在本机，可直接插入推文）" onClick={() => fileRef.current?.click()}>
          图片
        </button>
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          aria-label="消息内容"
          aria-describedby="chat-input-hint"
          placeholder="和 AI 正常对话，或说「写一篇 XX 推文」直接生成…（Enter 发送，Shift+Enter 换行）"
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.items).filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter((f): f is File => f !== null)
            if (files.length) { e.preventDefault(); void pickFiles(files) }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
              e.preventDefault()
              send()
            }
          }}
          disabled={busy || disabled}
        />
        {busy ? (
          <button className="btn btn-stop" onClick={onStop}>
            停止
          </button>
        ) : (
          <button className="btn btn-send" onClick={send} disabled={!input.trim() || disabled || importing}>
            发送
          </button>
        )}
      </div>
      <div className="chat-input-hint" id="chat-input-hint">Enter 发送 · Shift + Enter 换行 · 可粘贴或拖入图片，最多 {MAX_ATTACHED_IMAGES} 张</div>
    </div>
  )
}
