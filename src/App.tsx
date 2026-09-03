import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg } from './components/ChatPane'
import PreviewPane from './components/PreviewPane'
import { buildSystemPrompt } from './lib/persona'
import { retrieve } from './lib/retrieval'
import { extractHtml } from './lib/extract'
import { ChatMsg, inTauri, sendChatRust, sendChatMock } from './lib/chat'
import './App.css'

let idSeq = 1

export default function App() {
  const [msgs, setMsgs] = useState<DisplayMsg[]>([])
  const [busy, setBusy] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [note, setNote] = useState('')

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
    const userMsg: DisplayMsg = { id: idSeq++, role: 'user', content: text }
    const history: DisplayMsg[] = msgsRef.current
    setMsgs([...history, userMsg, { id: idSeq++, role: 'assistant', content: '' }])
    setHtml(null)

    const r = retrieve(text)
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
      { role: 'user', content: text },
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
          <span>知识库 149 条目 · 三层结构</span>
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
        />
        <PreviewPane html={html} onClear={clear} />
      </main>
    </div>
  )
}
