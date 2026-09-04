import { useState } from 'react'
import { MOCK_TOPICS } from '../lib/chat'
import { splitAssistant } from '../lib/extract'
import { ClarifySelections } from '../lib/needs'
import ClarifyCard from './ClarifyCard'

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
  pendingClarify: { text: string; missing: (keyof ClarifySelections)[] } | null
  onClarifyConfirm: (s: ClarifySelections) => void
  onClarifySkip: () => void
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
  '写一篇新生入学典礼的宣传类推文，校园风，直接写',
  '写一篇咖啡店新品上新的宣传推文，日系风，直接写',
  '写一篇软件使用教程的干货文开头与三个分点，直接写',
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
  pendingClarify,
  onClarifyConfirm,
  onClarifySkip,
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
    if (!t || busy || pendingClarify) return
    setInput('')
    onSend(t)
  }

  return (
    <div className="chat-pane">
      <div className="chat-head">
        <span className="dot" />
        AI 对话生成
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
        {pendingClarify && (
          <ClarifyCard
            text={pendingClarify.text}
            missing={pendingClarify.missing}
            onConfirm={onClarifyConfirm}
            onSkip={onClarifySkip}
          />
        )}
        {msgs.length === 0 && !pendingClarify && (
          <div className="chat-empty">
            <p>输入主题，AI 直接产出微信合法 HTML 推文。</p>
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
          // assistant：只展示围栏外说明文字；源码收进可展开查看器
          const { prose, code } = splitAssistant(m.content)
          const showPlaceholder = !prose && !busy && code !== null
          const streamingEmpty = busy && !prose && !m.content
          return (
            <div key={m.id} className="msg msg-assistant">
              <div className="assistant-box">
                <pre className="msg-assistant-text">
                  {prose || (showPlaceholder ? '已生成推文，见右侧预览。' : streamingEmpty ? '…' : '')}
                </pre>
                {code !== null && (
                  <div className="src-area">
                    <button className="src-toggle" onClick={() => toggleSrc(m.id)}>
                      {openSrc.has(m.id) ? '收起 HTML 源码' : '查看 HTML 源码'}
                    </button>
                    {openSrc.has(m.id) && <pre className="src-view">{code}</pre>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {busy && <div className="typing">正在生成…</div>}
        {knowledgeNote && <div className="knowledge-note">知识命中: {knowledgeNote}</div>}
      </div>

      <div className="chat-input-row">
        <textarea
          value={input}
          rows={2}
          placeholder="例如：写一篇毕业季情感类推文，手账风，直接写…（Enter 发送，Shift+Enter 换行）"
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
