import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg, Mode, Style } from './components/ChatPane'
import PreviewPane from './components/PreviewPane'
import { buildSystemPrompt } from './lib/persona'
import { ensureKnowledgeLoaded, retrieve } from './lib/retrieval'
import { extractHtml } from './lib/extract'
import { checkHtml, QualityResult } from './lib/quality'
import { ChatMsg, inTauri, sendChatRust, sendChatMock } from './lib/chat'
import './App.css'

let idSeq = 1

const STYLE_PHRASE: Record<Exclude<Style, 'auto'>, string> = {
  campus: '校园',
  tech: '科技',
  guochao: '国潮',
  japanese: '日系',
  minimal: '极简',
  business: '商务',
  handbook: '手账',
}

function decoratePrompt(text: string, mode: Mode, style: Style): string {
  let out = text
  if (mode !== 'auto') out += mode === 'promo' ? '\n（按宣传类处理：生动层次、利益点与行动号召）' : '\n（按文字类处理：简洁清晰、重内容轻装饰）'
  if (style !== 'auto') out += `\n（视觉风格采用「${STYLE_PHRASE[style]}」，色板与模块表现以风格知识为准）`
  return out
}

export default function App() {
  const [msgs, setMsgs] = useState<DisplayMsg[]>([])
  const [busy, setBusy] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [quality, setQuality] = useState<QualityResult | null>(null)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<Mode>('auto')
  const [style, setStyle] = useState<Style>('auto')
  const [kbCount, setKbCount] = useState<number | null>(null)

  // 知识库懒加载：首屏后异步载入，显示条目数
  useEffect(() => {
    ensureKnowledgeLoaded().then((e) => setKbCount(e.length)).catch(() => setKbCount(0))
  }, [])

  const busyRef = useRef(false)
  const draftRef = useRef('')
  const stopRef = useRef<{ cancel: () => void } | null>(null)
  const msgsRef = useRef<DisplayMsg[]>([])

  useEffect(() => {
    msgsRef.current = msgs
  }, [msgs])

  const updateAssistant = (draft: string) => {
    draftRef.current = draft
    setMsgs((prev) => {
      const copy = prev.slice()
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = { ...copy[i], content: draft }
          break
        }
      }
      return copy
    })
    const r = extractHtml(draft)
    if (r) setHtml(r.html)
  }

  const fail = (err: unknown) => {
    setMsgs((prev) => [...prev, { id: idSeq++, role: 'error', content: String(err) }])
    busyRef.current = false
    setBusy(false)
  }

  // Tauri 流式事件订阅（仅桌面模式）
  useEffect(() => {
    if (!inTauri()) return
    const un1 = listen<string>('chat-delta', (e) => {
      if (busyRef.current) updateAssistant(draftRef.current + e.payload)
    })
    const un2 = listen<string>('chat-error', (e) => fail(e.payload))
    return () => {
      un1.then((f) => f())
      un2.then((f) => f())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (text: string) => {
    if (busyRef.current) return
    const userText = decoratePrompt(text, mode, style)
    const userMsg: DisplayMsg = { id: idSeq++, role: 'user', content: userText }
    const history: DisplayMsg[] = msgsRef.current
    setMsgs([...history, userMsg, { id: idSeq++, role: 'assistant', content: '' }])
    setHtml(null)
    setQuality(null)

    const r = await retrieve(text + (style !== 'auto' ? STYLE_PHRASE[style] : ''))
    setNote(
      r.hits.length
        ? r.hits.slice(0, 8).join(' / ')
        : r.picks
            .map((p) => p.path.replace(/^.*\/([^/]+)$/, '$1'))
            .slice(0, 8)
            .join(' / '),
    )

    const payload: ChatMsg[] = [
      { role: 'system', content: buildSystemPrompt(r.picks) },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userText },
    ]

    busyRef.current = true
    setBusy(true)
    draftRef.current = ''

    try {
      if (inTauri()) {
        await sendChatRust(payload)
      } else {
        await new Promise<void>((resolve) => {
          stopRef.current = sendChatMock(payload, (d) => updateAssistant(draftRef.current + d), resolve)
        })
      }
    } catch (err) {
      fail(err)
      return
    }
    busyRef.current = false
    setBusy(false)
    stopRef.current = null
    // 流结束后跑一次质量检查
    const final = extractHtml(draftRef.current)
    if (final) {
      setHtml(final.html)
      setQuality(checkHtml(final.html))
    }
  }

  const stop = () => {
    stopRef.current?.cancel()
    stopRef.current = null
    busyRef.current = false
    setBusy(false)
  }

  const clear = () => {
    setMsgs([])
    setHtml(null)
    setQuality(null)
    setNote('')
  }

  const status = inTauri() ? 'DeepSeek 桌面' : '模拟模式（浏览器）'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" />
          公众号推文助手
        </div>
        <div className="topbar-meta">
          <span>{kbCount === null ? '知识库加载中…' : `知识库 ${kbCount} 条目 · 三层结构`}</span>
          <span className="hint">底座：极简智能体（persona + 知识检索 + 流式对话）</span>
        </div>
      </header>
      <main className="workspace">
        <ChatPane
          msgs={msgs}
          busy={busy}
          onSend={(t) => void send(t)}
          onStop={stop}
          status={status}
          knowledgeNote={note}
          mode={mode}
          style={style}
          onModeChange={setMode}
          onStyleChange={setStyle}
        />
        <PreviewPane html={html} quality={quality} onClear={clear} />
      </main>
    </div>
  )
}
