import { useImperativeHandle, useRef, useState } from 'react'
import { splitAssistant } from '../lib/extract.ts'
import type { TaskEvent } from '../lib/progress.ts'
import WorkingBubble from './WorkingBubble.tsx'

export interface DisplayMsg {
  id: number
  role: 'user' | 'assistant' | 'error'
  content: string
}

/** P2：预览里点选组件后，把一段文本锚点插进输入框草稿（用户自己补指令再发送） */
export interface ChatPaneApi {
  insertRef: (text: string) => void
}

interface Props {
  msgs: DisplayMsg[]
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
  status: string
  /** 当前工作阶段与细节（读资料 / 思考 / 撰写 / 素材 / 质检 / 保存），仅展示 */
  task?: TaskEvent | null
  /** 本轮开始时间戳，供工作气泡显示已耗时 */
  turnStartedAt?: number | null
  /** P2：参考图（data URL），随下一条消息发给模型；消费后由上层清空 */
  images?: string[]
  onAttachImages?: (urls: string[]) => void
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // 参考图仅作"本轮附带的图像"，读成 data URL 后交给上层，不落库、不写进会话
  const pickFiles = async (files: FileList | null) => {
    if (!files || !files.length || !onAttachImages) return
    setImgErr('')
    const urls: string[] = []
    for (const f of Array.from(files).slice(0, 4)) {
      if (!/^image\//.test(f.type)) {
        setImgErr('只支持图片文件')
        continue
      }
      if (f.size > 8 * 1024 * 1024) {
        setImgErr('单张图片需小于 8MB')
        continue
      }
      try {
        urls.push(await readAsDataUrl(f))
      } catch {
        setImgErr('读取图片失败')
      }
    }
    if (urls.length) onAttachImages(urls)
    if (fileRef.current) fileRef.current.value = ''
  }

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
    if (!t || busy) return
    setInput('')
    onSend(t)
  }

  return (
    <div className="chat-pane">
      <div className="chat-head">
        <span className="dot" />
        AI 对话
        <span className={`badge ${status.includes('模拟') ? 'badge-warn' : 'badge-ok'}`}>{status}</span>
      </div>

      <div className="chat-body">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <div className="chips">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} className="chip" disabled={busy} onClick={() => onSend(p)}>
                  {p.length > 18 ? p.slice(0, 18) + '…' : p}
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
              </div>
            )
          }
          if (m.role === 'error') {
            return (
              <div key={m.id} className="msg msg-error">
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
                    <button className="src-toggle" onClick={() => toggleSrc(m.id)}>
                      {openSrc.has(m.id) ? (code !== null ? '收起 HTML 源码' : '收起正文') : code !== null ? '查看 HTML 源码' : '查看正文'}
                    </button>
                    {openSrc.has(m.id) && <pre className="src-view">{src}</pre>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {/* 「AI 工作中」气泡：阶段标签 + 真实细节 + 本轮已耗时（纯展示，非对话状态机） */}
        {busy && <WorkingBubble phase={task?.phase ?? 'think'} detail={task?.text ?? ''} startedAt={turnStartedAt} />}
      </div>

      {images.length > 0 && (
        <div className="attach-strip">
          {images.map((u, i) => (
            <span key={i} className="attach-chip" data-idx={i}>
              <img src={u} alt={`参考图 ${i + 1}`} />
              <button className="attach-del" title="移除这张参考图" onClick={() => onRemoveImage?.(i)}>
                移除
              </button>
            </span>
          ))}
        </div>
      )}
      {imgErr && <div className="attach-err">{imgErr}</div>}
      <div className="chat-input-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="attach-input"
          onChange={(e) => void pickFiles(e.target.files)}
        />
        <button className="mini attach-btn" disabled={busy} title="附加参考图（随下一条消息发给模型）" onClick={() => fileRef.current?.click()}>
          图片
        </button>
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          placeholder="和 AI 正常对话，或说「写一篇 XX 推文」直接生成…（Enter 发送，Shift+Enter 换行）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={busy}
        />
        {busy ? (
          <button className="btn btn-stop" onClick={onStop}>
            停止
          </button>
        ) : (
          <button className="btn btn-send" onClick={send} disabled={!input.trim()}>
            发送
          </button>
        )}
      </div>
    </div>
  )
}
