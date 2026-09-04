import { useState } from 'react'
import { MOCK_TOPICS } from '../lib/chat'
import { splitAssistant } from '../lib/extract'

export interface DisplayMsg {
  id: number
  role: 'user' | 'assistant' | 'error'
  content: string
}

interface Props {
  msgs: DisplayMsg[]
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
  status: string
  knowledgeNote: string
  mode: Mode
  style: Style
  onModeChange: (m: Mode) => void
  onStyleChange: (s: Style) => void
}

export type Mode = 'auto' | 'text' | 'promo'
export type Style = 'auto' | 'campus' | 'tech' | 'guochao' | 'japanese' | 'minimal' | 'business' | 'handbook'

const MODES: { v: Mode; label: string }[] = [
  { v: 'auto', label: '自动' },
  { v: 'text', label: '文字类' },
  { v: 'promo', label: '宣传类' },
]

const STYLES: { v: Style; label: string }[] = [
  { v: 'auto', label: '风格自动' },
  { v: 'campus', label: '校园' },
  { v: 'tech', label: '科技' },
  { v: 'guochao', label: '国潮' },
  { v: 'japanese', label: '日系' },
  { v: 'minimal', label: '极简' },
  { v: 'business', label: '商务' },
  { v: 'handbook', label: '手账' },
]

const QUICK_PROMPTS = [
  '帮我写一篇推文，主题是新书上市',
  '写一篇新生入学典礼的宣传类推文，校园风，直接写',
  '写一篇咖啡店新品上新的宣传推文，日系风，直接写',
  '写一篇软件使用教程的干货文开头与三个分点，直接写',
  '公众号推文怎么起标题？',
]

export default function ChatPane({
  msgs,
  busy,
  onSend,
  onStop,
  status,
  knowledgeNote,
  mode,
  style,
  onModeChange,
  onStyleChange,
}: Props) {
  const [input, setInput] = useState('')
  const [openSrc, setOpenSrc] = useState<ReadonlySet<number>>(new Set())

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

      <div className="chat-controls">
        <div className="ctrl-row">
          <span className="ctrl-label">模式</span>
          <div className="seg">
            {MODES.map((m) => (
              <button
                key={m.v}
                className={`seg-btn ${mode === m.v ? 'seg-on' : ''}`}
                disabled={busy}
                onClick={() => onModeChange(m.v)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="ctrl-label ctrl-gap">风格</span>
          <select
            className="style-select"
            value={style}
            disabled={busy}
            onChange={(e) => onStyleChange(e.target.value as Style)}
          >
            {STYLES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="chat-body">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <p>像用通用助手一样正常对话：闲聊、写作答疑都行；说「写一篇…推文」就为你创作，信息不够时 AI 会先在对话里问你。</p>
            <div className="chips">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} className="chip" disabled={busy} onClick={() => onSend(p)}>
                  {p.length > 18 ? p.slice(0, 18) + '…' : p}
                </button>
              ))}
            </div>
            {MOCK_TOPICS.length > 0 && (
              <button className="chip chip-primary" disabled={busy} onClick={() => onSend(MOCK_TOPICS[0].prompt)}>
                ▶ {MOCK_TOPICS[0].label}
              </button>
            )}
            <button className="chip" disabled={busy} onClick={() => onSend('演示质量检查：请故意输出包含 emoji、渐变与外链图的推文（违规输出检测）')}>
              演示：违规输出检测
            </button>
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
          const showPlaceholder = !prose && !busy && src !== null
          const streamingEmpty = busy && !prose && !m.content
          return (
            <div key={m.id} className="msg msg-assistant">
              <div className="assistant-box">
                <pre className="msg-assistant-text">
                  {prose || (showPlaceholder ? '已生成推文，见右侧预览。' : streamingEmpty ? '…' : '')}
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
        {busy && <div className="typing">正在思考…</div>}
        {knowledgeNote && <div className="knowledge-note">知识命中: {knowledgeNote}</div>}
      </div>

      <div className="chat-input-row">
        <textarea
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
