import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg, Mode, Style } from './components/ChatPane'
import PreviewPane from './components/PreviewPane'
import SettingsPanel from './components/SettingsPanel'
import SessionRail from './components/SessionRail'
import { KnowledgePick, buildSystemPrompt } from './lib/persona'
import { ensureKnowledgeLoaded, retrieve } from './lib/retrieval'
import { extractHtml, splitAssistant } from './lib/extract'
import { composeMarkdown } from './lib/compose'
import { renderArtPlaceholders } from './lib/artRender'
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

// 把助手文本解析为可预览 HTML（第 14/15 轮）：```html 直通；```v2 正文经 compose 渲染；无围栏返回 null
// arts：compose 收集的 SVG 美术素材（需由调用方渲染替换 @@ARTn@@ 占位）
function resolvePreview(raw: string, mode: Mode): { html: string; warnings: string[]; arts: { svg: string; alt: string; wide: boolean }[] } | null {
  const direct = extractHtml(raw)
  if (direct) return { html: direct.html, warnings: [], arts: [] }
  const { v2 } = splitAssistant(raw)
  if (v2) {
    const r = composeMarkdown(v2, { mode })
    return { html: r.html, warnings: r.warnings, arts: r.arts }
  }
  return null
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
  const [warnings, setWarnings] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)

  // 会话栏：默认按窗口宽度展开（≤1120px 折叠），顶栏「会话」按钮为折叠开关
  const [railOpen, setRailOpen] = useState<boolean>(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1120))

  // 多会话状态
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sessionItems, setSessionItems] = useState<SessionMetaL[]>([])

  const busyRef = useRef(false)
  const draftRef = useRef('')
  const stopRef = useRef<{ cancel: () => void } | null>(null)
  const msgsRef = useRef<DisplayMsg[]>([])
  // artSeqRef：素材异步渲染序号，防止旧渲染结果覆盖新预览
  const artSeqRef = useRef(0)

  useEffect(() => {
    msgsRef.current = msgs
  }, [msgs])

  // ---------- 会话工具 ----------
  const refreshItems = () => {
    listSessions().then((r) => setSessionItems(r.items))
  }

  const applySession = async (item: SessionItem) => {
    const mapped: DisplayMsg[] = item.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'error')
      .map((m) => ({ id: m.id, role: m.role as DisplayMsg['role'], content: m.content }))
    // 避免恢复后的消息 id 与 idSeq 计数器冲突（React key 唯一性）
    const maxId = mapped.reduce((acc, m) => Math.max(acc, m.id), 0)
    if (maxId >= idSeq) idSeq = maxId + 1
    setMsgs(mapped)
    if (VALID_MODES.includes(item.mode as Mode)) setMode(item.mode as Mode)
    else setMode('auto')
    if (VALID_STYLES.includes(item.style as Style)) setStyle(item.style as Style)
    else setStyle('auto')
    const last = [...mapped].reverse().find((m) => m.role === 'assistant')
    if (last) {
      const m = VALID_MODES.includes(item.mode as Mode) ? (item.mode as Mode) : 'auto'
      const c = resolvePreview(last.content, m)
      if (c) {
        const seq = ++artSeqRef.current
        const html2 = c.arts.length ? await renderArtPlaceholders(c.html, c.arts) : c.html
        if (artSeqRef.current === seq) {
          setHtml(html2)
          setQuality(checkHtml(html2))
          setWarnings(c.warnings)
        }
      } else {
        setHtml(null)
        setQuality(null)
        setWarnings([])
      }
    } else {
      setHtml(null)
      setQuality(null)
      setWarnings([])
    }
    setSavedAt(fmtTime(item.updatedAt))
  }

  const clearAllChat = () => {
    setMsgs([])
    setHtml(null)
    setQuality(null)
    setNote('')
    setWarnings([])
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
        await applySession(item)
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
    // 流中实时预览：```html 直通或 ```v2 围栏闭合即 compose；素材异步渲染（序号防覆盖）
    const c = resolvePreview(draft, mode)
    if (c) {
      const seq = ++artSeqRef.current
      if (c.arts.length) {
        void renderArtPlaceholders(c.html, c.arts).then((html2) => {
          if (artSeqRef.current === seq) setHtml(html2)
        })
      } else {
        setHtml(c.html)
      }
      if (c.warnings.length) setWarnings(c.warnings)
    }
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

  // ---------- 对话回合（第 13 轮：统一 persona，模型自主判断对话/创作/反问）----------
  const turn = async (raw: string): Promise<void> => {
    if (busyRef.current) return
    const content = decoratePrompt(raw, mode, style)
    const userMsg: DisplayMsg = { id: idSeq++, role: 'user', content }
    const history: DisplayMsg[] = msgsRef.current
    setMsgs([...history, userMsg, { id: idSeq++, role: 'assistant', content: '' }])

    busyRef.current = true
    setBusy(true)
    draftRef.current = ''

    let picks: KnowledgePick[] = []
    try {
      const hint = style !== 'auto' ? raw + STYLE_PHRASE[style] : raw
      const r = await retrieve(hint)
      picks = r.picks
      setNote(
        r.hits.length
          ? r.hits.slice(0, 8).join(' / ')
          : r.picks
              .map((p) => p.path.replace(/^.*\/([^/]+)$/, '$1'))
              .slice(0, 8)
              .join(' / '),
      )
    } catch {
      // 知识库加载失败不影响对话：退回无节选的 persona
      picks = []
    }

    const payload: ChatMsg[] = [
      { role: 'system', content: buildSystemPrompt(picks) },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content },
    ]

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
    // 流结束：含 ```html 直通或 ```v2 正文 → compose 预览（素材渲染完成）并终检；纯对话不触碰预览
    const final = resolvePreview(draftRef.current, mode)
    if (final) {
      const seq = ++artSeqRef.current
      const html2 = final.arts.length ? await renderArtPlaceholders(final.html, final.arts) : final.html
      if (artSeqRef.current === seq) {
        setHtml(html2)
        setQuality(checkHtml(html2))
        setWarnings(final.warnings)
      }
    }
    if (currentId) {
      const saveMsgs: DisplayMsg[] = [...history, userMsg, { id: idSeq - 1, role: 'assistant', content: draftRef.current }]
      persistNow(currentId, saveMsgs, mode, style)
    }
  }

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busyRef.current) return
    await turn(t)
  }

  const stop = () => {
    stopRef.current?.cancel()
    stopRef.current = null
    busyRef.current = false
    setBusy(false)
  }

  // ---------- 会话操作 ----------
  const newSession = async () => {
    if (busyRef.current) return
    const id = await createSession()
    if (!id) return
    clearAllChat()
    setCurrentId(id)
    refreshItems()
  }

  const switchSession = async (id: string) => {
    if (busyRef.current || id === currentId) return
    if (currentId) persistNow(currentId, msgsRef.current, mode, style)
    const item = await openSession(id)
    if (item) {
      clearAllChat()
      await applySession(item)
      setCurrentId(id)
    }
    refreshItems()
  }

  const removeSession = async (id: string) => {
    const r = await deleteSession(id)
    setSessionItems(r.items)
    if (r.current && r.current !== currentId) {
      const item = await openSession(r.current)
      clearAllChat()
      if (item) await applySession(item)
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" />
          公众号推文助手
          <button
            className="mini sess-btn"
            data-ready={currentId ? 1 : 0}
            data-open={railOpen ? 1 : 0}
            onClick={() => setRailOpen((v) => !v)}
          >
            {railOpen ? '收起会话栏' : '展开会话栏'}
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
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <main className={`workspace ${railOpen ? 'rail-on' : 'rail-off'}`}>
        {railOpen && (
          <SessionRail
            items={sessionItems}
            currentId={currentId}
            onNew={() => void newSession()}
            onOpen={(id) => void switchSession(id)}
            onDelete={(id) => void removeSession(id)}
          />
        )}
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
        <PreviewPane html={html} quality={quality} warnings={warnings} onClear={clear} />
      </main>
    </div>
  )
}
