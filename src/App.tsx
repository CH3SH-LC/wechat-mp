import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg } from './components/ChatPane'
import PreviewPane from './components/PreviewPane'
import SettingsPanel from './components/SettingsPanel'
import SessionRail from './components/SessionRail'
import { PERSONA_RULES, buildRegistrySystem } from './lib/persona'
import { buildRegistry, ensureKnowledgeLoaded } from './lib/retrieval'
import { extractHtml, splitAssistant } from './lib/extract'
import { composeMarkdown } from './lib/compose'
import { themeDeclaration } from './lib/palettes'
import { hasPlaceholders, materializePlaceholders } from './lib/image-agent'
import { renderArtPlaceholders } from './lib/artRender'
import { checkHtml, QualityResult } from './lib/quality'
import { ChatMsg, inTauri, sendChatRust, sendChatMock } from './lib/chat'
import { isCreateRequest } from './lib/needs'
import { WRITE_INSTRUCTION, runPrep } from './lib/prep'
import type { PrepOutcome } from './lib/prep'
import { SessionItem, SessionMetaL, createSession, deleteSession, fmtTime, listSessions, openSession, saveSession } from './lib/sessions'
import './App.css'

let idSeq = 1

// 第 23 轮：界面无模式/风格控件——类型与风格由模型按已澄清需求自决（persona 约束），
// 渲染主题一律取正文 [[theme:名称]] 声明（含 [[palette]] 自定义色板），不再从 UI 传入。

// 把助手文本解析为可预览 HTML（第 14/15 轮）：```html 直通；```v2 正文经 compose 渲染；无围栏返回 null
// 第 23 轮起不再传 UI 主题——风格由正文 [[theme:名称]]（+可选 [[palette]]）声明；arts：compose 收集的 SVG 素材（需由调用方渲染替换 @@ARTn@@ 占位）
// 第 24 轮：正文含图位占位（[[img:…]]/[[deco:…]]）时暂不渲染——等素材生成器替换为 ::: art 后再 compose（见 turn/applySession）
function resolvePreview(raw: string): { html: string; warnings: string[]; arts: { svg: string; alt: string; wide: boolean }[] } | null {
  const direct = extractHtml(raw)
  if (direct) return { html: direct.html, warnings: [], arts: [] }
  const { v2 } = splitAssistant(raw)
  if (v2) {
    if (hasPlaceholders(v2)) return null
    const r = composeMarkdown(v2, {})
    return { html: r.html, warnings: r.warnings, arts: r.arts }
  }
  return null
}

// v2 正文 → compose → 素材 PNG 渲染，一步到位（供已 materialize 的正文 / 图位路径使用）
async function renderV2(v2: string): Promise<{ html: string; warnings: string[] } | null> {
  const r = composeMarkdown(v2, {})
  if (!r) return null
  const html = r.arts.length ? await renderArtPlaceholders(r.html, r.arts) : r.html
  return { html, warnings: r.warnings }
}

export default function App() {
  const [msgs, setMsgs] = useState<DisplayMsg[]>([])
  const [busy, setBusy] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [quality, setQuality] = useState<QualityResult | null>(null)
  const [note, setNote] = useState('')
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
    const last = [...mapped].reverse().find((m) => m.role === 'assistant')
    if (last) {
      const seq = ++artSeqRef.current
      const { v2 } = splitAssistant(last.content)
      if (v2 && hasPlaceholders(v2)) {
        // 第 24 轮：恢复含图位占位的会话 → 先素材生成再渲染
        const matured = await materializePlaceholders(v2, themeDeclaration(v2))
        const p = await renderV2(matured)
        if (artSeqRef.current === seq && p) {
          setHtml(p.html)
          setQuality(checkHtml(p.html))
          setWarnings(p.warnings)
        }
      } else {
        const c = resolvePreview(last.content)
        if (c) {
          const html2 = c.arts.length ? await renderArtPlaceholders(c.html, c.arts) : c.html
          if (artSeqRef.current === seq) {
            setHtml(html2)
            setQuality(checkHtml(html2))
            setWarnings(c.warnings)
          }
        } else if (c === null) {
          setHtml(null)
          setQuality(null)
          setWarnings([])
        }
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
      saveSession(id, { mode: 'auto', style: 'auto', messages: msgs }).then(() => {
        setSavedAt(fmtTime(new Date().toISOString()))
        refreshItems()
      })
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, currentId])

  const persistNow = (id: string, messages: DisplayMsg[]) => {
    saveSession(id, { mode: 'auto', style: 'auto', messages }).then(() => {
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
    const c = resolvePreview(draft)
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

  // ---------- 对话回合（统一 persona，模型自主判断；禁止任何前端对话状态机）----------
  // 第 25 轮：system 只注入轻量"知识注册表"，不再 bigram 注入正文；桌面创作前经 prep_turn
  // 让模型决定"取哪些知识点 / 是否澄清"（工具取用循环非对话路由，不改变用户可见回合）。
  const turn = async (raw: string): Promise<void> => {
    if (busyRef.current) return
    const content = raw
    const userMsg: DisplayMsg = { id: idSeq++, role: 'user', content }
    const history: DisplayMsg[] = msgsRef.current
    setMsgs([...history, userMsg, { id: idSeq++, role: 'assistant', content: '' }])

    busyRef.current = true
    setBusy(true)
    draftRef.current = ''

    // system = PERSONA_RULES + 知识注册表（目录，≤3500 字符）；加载失败退回纯 persona（不挡对话）
    let system: string
    try {
      const registry = await buildRegistry()
      setNote(`注册表就绪 · ${registry.length} 字符目录 · 模型按需取用`)
      system = buildRegistrySystem(registry)
    } catch {
      setNote('知识库加载失败，已退回通用人设')
      system = PERSONA_RULES
    }

    const baseMsgs: ChatMsg[] = [
      { role: 'system', content: system },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content },
    ]

    // 创作前置判定：明确写推文，或历史最后一条助手反问过（用户在补需求）→ 桌面先跑 prep
    const lastAssistantHist = [...history].reverse().find((m) => m.role === 'assistant')
    const needPrep = isCreateRequest(raw) || (lastAssistantHist?.content.includes('？') ?? false)

    // prep 阶段累积消息（含已执行 tool 结果）；默认即 baseMsgs（无 prep 直接走流式）
    let streamMsgs: ChatMsg[] = baseMsgs
    if (inTauri() && needPrep) {
      let prep: PrepOutcome
      try {
        prep = await runPrep(baseMsgs)
      } catch {
        // prep/工具失败不把用户挡在门外：退化为"无 prep 的流式"（知识缺失也能创作）
        prep = { mode: 'prep', ready: true }
      }
      if (prep.mode === 'prep' && prep.ready) {
        // READY：把实际取用知识点摘要 + 撰写指令拼进流式续写（不透传工具回合消息）
        const digestNote = prep.digest
          ? `\n\n## 已取用知识点（来自知识工具，作为本次创作依据，冲突以库为准）\n${prep.digest}\n`
          : ''
        streamMsgs = [...baseMsgs, { role: 'user', content: digestNote + WRITE_INSTRUCTION }]
      } else if (prep.mode === 'prep' && !prep.ready) {
        // 模型输出澄清问题（未取工具或未收敛）：追加为助手消息，不做预览；意外含 ```v2 则渲染
        const q = prep.text || '请补充一下需求，我再开始创作。'
        draftRef.current = q
        updateAssistant(q)
        stopRef.current = null
        const clarifyMsg: DisplayMsg = { id: idSeq - 1, role: 'assistant', content: q }
        busyRef.current = false
        setBusy(false)
        if (currentId) persistNow(currentId, [...history, userMsg, clarifyMsg])
        return
      }
    }

    try {
      if (inTauri()) {
        await sendChatRust(streamMsgs)
      } else {
        await new Promise<void>((resolve) => {
          stopRef.current = sendChatMock(streamMsgs, (d) => updateAssistant(draftRef.current + d), resolve)
        })
      }
    } catch (err) {
      fail(err)
      return
    }
    stopRef.current = null
    // 流结束：素材生成（若正文含图位占位）→ compose 预览 → 终检；素材生成期间保持 busy="生成中"；纯对话不触碰预览
    const draft = draftRef.current
    const { v2 } = splitAssistant(draft)
    if (v2 && hasPlaceholders(v2)) {
      const matured = await materializePlaceholders(v2, themeDeclaration(v2))
      const p = await renderV2(matured)
      if (p) {
        const seq = ++artSeqRef.current
        if (artSeqRef.current === seq) {
          setHtml(p.html)
          setQuality(checkHtml(p.html))
          setWarnings(p.warnings)
        }
      }
    } else {
      const final = resolvePreview(draft)
      if (final) {
        const seq = ++artSeqRef.current
        const html2 = final.arts.length ? await renderArtPlaceholders(final.html, final.arts) : final.html
        if (artSeqRef.current === seq) {
          setHtml(html2)
          setQuality(checkHtml(html2))
          setWarnings(final.warnings)
        }
      }
    }
    busyRef.current = false
    setBusy(false)
    if (currentId) {
      const saveMsgs: DisplayMsg[] = [...history, userMsg, { id: idSeq - 1, role: 'assistant', content: draftRef.current }]
      persistNow(currentId, saveMsgs)
    }
  }

  // 发送：直通统一回合，不设任何对话状态机（澄清与否由模型自主判断）
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
    if (currentId) persistNow(currentId, msgsRef.current)
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
    if (currentId) persistNow(currentId, [])
  }

  // ---------- 发布到草稿箱（仅桌面；浏览器模式不渲染按钮） ----------
  const publishDraft = async (h: string): Promise<string> => {
    if (!inTauri()) return Promise.reject('发布需在桌面模式使用')
    return await invoke<string>('publish_draft', { html: h, title: null })
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
        />
        <PreviewPane html={html} quality={quality} warnings={warnings} onClear={clear} publishDraft={publishDraft} />
      </main>
    </div>
  )
}
