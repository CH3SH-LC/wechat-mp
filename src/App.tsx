import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg, Mode, Style } from './components/ChatPane'
import PreviewPane from './components/PreviewPane'
import SettingsPanel from './components/SettingsPanel'
import SessionMenu from './components/SessionMenu'
import { buildSystemPrompt } from './lib/persona'
import { ensureKnowledgeLoaded, retrieve } from './lib/retrieval'
import { extractHtml } from './lib/extract'
import { checkHtml, QualityResult } from './lib/quality'
import { ChatMsg, inTauri, sendChatRust, sendChatMock } from './lib/chat'
import { SessionItem, SessionMetaL, createSession, deleteSession, fmtTime, listSessions, openSession, saveSession } from './lib/sessions'
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

const VALID_MODES: Mode[] = ['auto', 'text', 'promo']
const VALID_STYLES: Style[] = ['auto', 'campus', 'tech', 'guochao', 'japanese', 'minimal', 'business', 'handbook']

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
  const [savedAt, setSavedAt] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showSessions, setShowSessions] = useState(false)

  // 多会话状态
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sessionItems, setSessionItems] = useState<SessionMetaL[]>([])

  const busyRef = useRef(false)
  const draftRef = useRef('')
  const stopRef = useRef<{ cancel: () => void } | null>(null)
  const msgsRef = useRef<DisplayMsg[]>([])

  useEffect(() => {
    msgsRef.current = msgs
  }, [msgs])

  // ---------- 会话工具 ----------
  const refreshItems = () => {
    listSessions().then((r) => setSessionItems(r.items))
  }

  const applySession = (item: SessionItem) => {
    const mapped: DisplayMsg[] = item.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'error')
      .map((m) => ({ id: m.id, role: m.role as DisplayMsg['role'], content: m.content }))
    setMsgs(mapped)
    if (VALID_MODES.includes(item.mode as Mode)) setMode(item.mode as Mode)
    else setMode('auto')
    if (VALID_STYLES.includes(item.style as Style)) setStyle(item.style as Style)
    else setStyle('auto')
    const last = [...mapped].reverse().find((m) => m.role === 'assistant')
    if (last) {
      const r = extractHtml(last.content)
      if (r) {
        setHtml(r.html)
        setQuality(checkHtml(r.html))
      }
    } else {
      setHtml(null)
      setQuality(null)
    }
    setSavedAt(fmtTime(item.updatedAt))
  }

  const clearAllChat = () => {
    setMsgs([])
    setHtml(null)
    setQuality(null)
    setNote('')
    setSavedAt('')
  }

  // 启动：加载会话列表与当前会话（首次自动建会话；旧单会话自动迁移）
  // bootRef 互斥防 StrictMode 双跑；不设 alive 门控（cleanup 会先于异步完成执行）
  const bootRef = useRef(false)
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    ;(async () => {
      let r = await listSessions()
      if (!r.items.length) {
        const id = await createSession()
        r = { items: [{ id, title: '新对话', updatedAt: '', count: 0 }], current: id }
      }
      setSessionItems(r.items)
      const cur = r.current ?? r.items[0].id
      setCurrentId(cur)
      const item = await openSession(cur)
      if (item) {
        applySession(item)
        refreshItems()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 知识库懒加载
  useEffect(() => {
    ensureKnowledgeLoaded().then((e) => setKbCount(e.length)).catch(() => setKbCount(0))
  }, [])

  // 变更自动存档（防抖 700ms，绑定当前会话）
  useEffect(() => {
    if (!currentId || !msgs.length) return
    const id = currentId
    const timer = window.setTimeout(() => {
      saveSession(id, { mode, style, messages: msgs }).then(() => {
        setSavedAt(fmtTime(new Date().toISOString()))
        refreshItems()
      })
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, mode, style, currentId])

  const persistNow = (id: string, messages: DisplayMsg[], m: Mode, s: Style) => {
    saveSession(id, { mode: m, style: s, messages }).then(() => {
      setSavedAt(fmtTime(new Date().toISOString()))
      refreshItems()
    })
  }

  // ---------- 对话 ----------
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
    // 流结束：终检 + 立即存档到当前会话
    const final = extractHtml(draftRef.current)
    if (final) {
      setHtml(final.html)
      setQuality(checkHtml(final.html))
    }
    if (currentId) {
      const saveMsgs: DisplayMsg[] = [...history, userMsg, { id: idSeq - 1, role: 'assistant', content: draftRef.current }]
      persistNow(currentId, saveMsgs, mode, style)
    }
  }

  const stop = () => {
    stopRef.current?.cancel()
    stopRef.current = null
    busyRef.current = false
    setBusy(false)
  }

  // ---------- 会话操作 ----------
  const newSession = async () => {
    if (busyRef.current || showSessions) setShowSessions(false)
    if (busyRef.current) return
    const id = await createSession()
    if (!id) return
    clearAllChat()
    setCurrentId(id)
    setShowSessions(false)
    refreshItems()
  }

  const switchSession = async (id: string) => {
    if (busyRef.current || id === currentId) {
      setShowSessions(false)
      return
    }
    if (currentId) persistNow(currentId, msgsRef.current, mode, style)
    const item = await openSession(id)
    if (item) {
      clearAllChat()
      applySession(item)
      setCurrentId(id)
    }
    setShowSessions(false)
    refreshItems()
  }

  const removeSession = async (id: string) => {
    const r = await deleteSession(id)
    setSessionItems(r.items)
    if (r.current && r.current !== currentId) {
      const item = await openSession(r.current)
      clearAllChat()
      if (item) applySession(item)
      setCurrentId(r.current)
    } else if (!r.current) {
      clearAllChat()
      const nid = await createSession()
      setCurrentId(nid)
    }
    refreshItems()
  }

  // 清空 = 清空当前会话内容（保留会话，标题回到默认）
  const clear = () => {
    if (busyRef.current) return
    clearAllChat()
    if (currentId) persistNow(currentId, [], mode, style)
  }

  const status = inTauri() ? 'DeepSeek 桌面' : '模拟模式（浏览器）'
  const currentTitle = sessionItems.find((m) => m.id === currentId)?.title ?? '新对话'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" />
          公众号推文助手
          <button className="mini sess-btn" data-ready={currentId ? 1 : 0} onClick={() => setShowSessions(true)}>
            会话 · {currentTitle.length > 10 ? currentTitle.slice(0, 10) + '…' : currentTitle}
          </button>
        </div>
        <div className="topbar-meta">
          <span>{kbCount === null ? '知识库加载中…' : `知识库 ${kbCount} 条目 · 三层结构`}</span>
          {savedAt && <span className="hint">已自动保存 {savedAt}</span>}
          <button className="mini topbar-settings" onClick={() => setShowSettings(true)}>
            设置
          </button>
        </div>
      </header>
      {showSessions && (
        <SessionMenu
          items={sessionItems}
          currentId={currentId}
          onNew={() => void newSession()}
          onOpen={(id) => void switchSession(id)}
          onDelete={(id) => void removeSession(id)}
          onClose={() => setShowSessions(false)}
        />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
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
