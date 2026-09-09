import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg } from './components/ChatPane'
import PreviewPane from './components/PreviewPane'
import SettingsPanel from './components/SettingsPanel'
import SessionRail from './components/SessionRail'
import DocsPane from './components/DocsPane'
import AssetWorkshop from './components/AssetWorkshop'
import { PERSONA_RULES, buildRegistrySystem } from './lib/persona'
import { buildRegistry, ensureKnowledgeLoaded, loadEngineProtocol } from './lib/retrieval'
import { collapseAssistantDraft, extractHtml, splitAssistant } from './lib/extract'
import { composeMarkdown } from './lib/compose'
import { themeDeclaration } from './lib/palettes'
import { hasPlaceholders, materializePlaceholders } from './lib/image-agent'
import type { MaterializeInfo } from './lib/image-agent'
import { getAsset } from './lib/asset-library'
import { renderArtPlaceholders } from './lib/artRender'
import { checkHtml, QualityResult } from './lib/quality'
import { ChatMsg, inTauri, sendChatRust, sendChatMock } from './lib/chat'
import { isCreateRequest } from './lib/needs'
import { WRITE_INSTRUCTION, runPrep } from './lib/prep'
import type { PrepOutcome } from './lib/prep'
import { MAX_AUTO_REVISES, buildReviseContent, fixableWarnings } from './lib/revise'
import { SessionItem, SessionMetaL, createSession, deleteSession, fmtTime, listSessions, openSession, saveSession } from './lib/sessions'
import { DocMetaL, deleteDocument, listDocuments, openDocument, saveDocument } from './lib/documents'
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

  // V3：顶栏工作区切换（对话 / 文档库 / 素材工坊）；文档库数据（文档默认自动保存、就地刷新）
  const [view, setView] = useState<'chat' | 'docs' | 'assets'>('chat')
  const [docItems, setDocItems] = useState<DocMetaL[]>([])

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

  const refreshDocs = () => {
    listDocuments().then(setDocItems)
  }

  // V3-R1：把一版终稿（v2 真源 + 渲染 html）默认自动保存/就地刷新为当前会话的文档；
  // V3-R3：snapshots = 本次渲染实际复用的库素材固化快照（{svg, ver}），供改版影响比较
  const persistDoc = async (
    id: string,
    source: string,
    html: string,
    warns: string[],
    snapshots?: Record<string, { svg: string; ver: number }>,
  ) => {
    if (!source.trim() || !html.trim()) return
    // 标题与会话保持一致：优先会话列表已有标题；列表滞后（新建会话首稿）时按首条用户消息派生
    const meta = sessionItems.find((i) => i.id === id)
    let title = meta && meta.title && meta.title !== '新对话' ? meta.title : ''
    if (!title) {
      const firstUser = msgsRef.current.find((m) => m.role === 'user')
      const line = firstUser ? firstUser.content.split('\n')[0].trim() : ''
      title = line ? line.slice(0, 16) + (line.length > 16 ? '…' : '') : ''
    }
    const saved = await saveDocument(id, { title, source, html, warnings: warns, snapshots: snapshots || {} })
    if (saved) refreshDocs()
  }

  // 把本次素材解析使用到的库素材 id 读成固化快照（当前 SVG + version）
  const snapshotsOfUsed = async (used: Record<string, { id: string; title: string }>) => {
    const out: Record<string, { svg: string; ver: number }> = {}
    for (const key of Object.keys(used || {})) {
      const rec = await getAsset(key)
      if (rec) out[key] = { svg: rec.svg, ver: rec.meta.version }
    }
    return out
  }

  const applySession = async (item: SessionItem) => {
    const mapped: DisplayMsg[] = item.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'error')
      .map((m) => ({ id: m.id, role: m.role as DisplayMsg['role'], content: m.content }))
    // 避免恢复后的消息 id 与 idSeq 计数器冲突（React key 唯一性）
    const maxId = mapped.reduce((acc, m) => Math.max(acc, m.id), 0)
    if (maxId >= idSeq) idSeq = maxId + 1
    setMsgs(mapped)
    // V3-R1：该会话已有自动保存的文档（article.html 快照）→ 直接用快照恢复预览，
    // 不重跑素材生成/渲染（打开"我保存的 html"即见原样）
    const doc = await openDocument(item.id)
    if (doc && doc.html.trim()) {
      setHtml(doc.html)
      setQuality(checkHtml(doc.html))
      setWarnings(doc.warnings || [])
      setSavedAt(fmtTime(item.updatedAt))
      return
    }
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
      refreshDocs()
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

  // Tauri 流式事件订阅（仅桌面模式）。注：错误不依赖事件——Rust 从不 emit chat-error，
  // 失败经 sendChatRust 抛错 → catch → fail()（第 27 轮清理休眠监听）。
  useEffect(() => {
    if (!inTauri()) return
    const un1 = listen<string>('chat-delta', (e) => {
      if (busyRef.current) updateAssistant(draftRef.current + e.payload)
    })
    return () => {
      un1.then((f) => f())
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
    let sessionNote = ''
    try {
      const registry = await buildRegistry()
      sessionNote = `注册表就绪 · ${registry.length} 字符目录 · 模型按需取用`
      setNote(sessionNote)
      system = buildRegistrySystem(registry)
    } catch {
      sessionNote = '知识库加载失败，已退回通用人设'
      setNote(sessionNote)
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
    // 第 31 轮：历史中任一条用户消息是创作请求 → 本会话处于创作态。即使本轮 needPrep=false
    // （如继续追问/回复澄清的延续句不命中创作词），模型仍可能在回复里直接产出 ```v2 正文，
    // 若无引擎协议会写不出 ::: photo / [[img]] / [[theme]] → 美术素材与照片位全灭。
    const creativeSession = history.some((m) => m.role === 'user' && isCreateRequest(m.content))

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
        // 第 29 轮：persona 已精简，v2 契约迁知识库——digest 若缺 engine-write-protocol 则强制附加
        // （引擎协议是 compose 正确性的确定性来源，不依赖模型是否自觉 load；loadEngineProtocol 只读缓存）
        let digestNote = prep.digest
          ? `\n\n## 已取用知识点（来自知识工具，作为本次创作依据，冲突以库为准）\n${prep.digest}\n`
          : ''
        if (!digestNote.includes('engine-write-protocol')) {
          const proto = await loadEngineProtocol()
          if (proto) {
            digestNote += `\n\n## 排版引擎协议（必读：v2 语法/美术占位/风格声明/质量底线，冲突以本协议为准）\n${proto}\n`
          }
        }
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

    // 第 31 轮：创作会话的延续回合（needPrep=false 未走 prep，如"哪里缺乏内容了"这类追问）
    // 也可能直接产出 ```v2 正文；若上下文无引擎协议，模型写不出 ::: photo / [[img]] / ::: art /
    // [[theme]] → 美术素材与照片位缺失。给这类回合兜底附加协议（仅当正文撰写可能发生且尚未含协议时）。
    if (
      inTauri() &&
      creativeSession &&
      !needPrep &&
      !streamMsgs.some((m) => m.content?.includes('engine-write-protocol'))
    ) {
      const proto = await loadEngineProtocol()
      if (proto) {
        streamMsgs = [
          ...streamMsgs,
          {
            role: 'user',
            content: `\n（若本回合你决定撰写 v2 正文围栏，以下为本地渲染引擎协议，按它产出 v2 语法与美术占位/照片位）\n## 排版引擎协议\n${proto}\n`,
          },
        ]
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
    // ---- 流结束：自动质检自检（第 32 轮）→ 终稿预览 → 落库 ----
    // 归一叠稿（一个回合多篇 ```v2 时保留末篇+说明文字，避免污染历史/预览），取末个 v2 为候选正文。
    // 候选经引擎质检：仍含"可修复质量项"（组件化/素材/气泡角饰）且有界内 → 把问题清单喂回模型，
    // 重写同一助手气泡；纯对话 / 无 v2 / 达到上限 / 用户停止则结束。这是产物质量门禁，非对话状态机。
    let draftRaw = collapseAssistantDraft(draftRef.current)
    let done = false
    let aborted = false
    // V3-R1：记录终稿渲染产物（html 快照 + 质检警告），流结束后默认自动保存为文档
    let finalHtml: string | null = null
    let finalWarnings: string[] = []
    // V3-R3：最后一轮素材解析实际复用的库素材（供文档固化快照）
    let lastUsed: Record<string, { id: string; title: string }> = {}
    for (let round = 0; round <= MAX_AUTO_REVISES && !done; round++) {
      const { v2 } = splitAssistant(draftRaw)
      if (!v2) {
        // 无 v2（纯对话 / ```html 直通）：沿用旧预览逻辑，不进自检
        const final = resolvePreview(draftRaw)
        if (final) {
          const seq = ++artSeqRef.current
          const html2 = final.arts.length ? await renderArtPlaceholders(final.html, final.arts) : final.html
          if (artSeqRef.current === seq) {
            setHtml(html2)
            setQuality(checkHtml(html2))
            setWarnings(final.warnings)
          }
          finalHtml = html2
          finalWarnings = final.warnings
        }
        done = true
        break
      }
      // 素材解析 + 排版质检（V3-R3：库引用优先解析，缺失计为可修复警告；无占位直接 compose）
      let preview: { html: string; warnings: string[] } | null = null
      const matInfo: MaterializeInfo = { used: {}, residual: 0, storedFallback: 0 }
      if (hasPlaceholders(v2)) {
        const matured = await materializePlaceholders(v2, themeDeclaration(v2), matInfo)
        const p = await renderV2(matured)
        if (p && matInfo.residual > 0) {
          p.warnings = [
            ...p.warnings,
            `库素材引用缺失（${matInfo.residual} 处）：所引用的库素材不存在或未收录，请改用 [[img]]/[[deco]] 占位，或引用个人素材库中实际存在的素材`,
          ]
        }
        preview = p
      } else {
        const c = resolvePreview(draftRaw)
        if (c) {
          const html2 = c.arts.length ? await renderArtPlaceholders(c.html, c.arts) : c.html
          preview = { html: html2, warnings: c.warnings }
        }
      }
      lastUsed = matInfo.used
      const fix = preview ? fixableWarnings(preview.warnings) : []
      const atCap = round === MAX_AUTO_REVISES
      if (!preview || fix.length === 0 || atCap || !busyRef.current) {
        if (preview) {
          const seq = ++artSeqRef.current
          if (artSeqRef.current === seq) {
            setHtml(preview.html)
            setQuality(checkHtml(preview.html))
            setWarnings(preview.warnings)
          }
          finalHtml = preview.html
          finalWarnings = preview.warnings
        }
        if (!busyRef.current) aborted = true
        done = true
        break
      }
      // 自动修订一版：清空气泡与旧预览 → 质检问题清单喂回 → 重写流
      setNote('自动质检：根据问题修订正文中…')
      setHtml(null)
      setQuality(null)
      setWarnings([])
      draftRef.current = ''
      updateAssistant('')
      const revise = buildReviseContent(v2, fix)
      try {
        if (inTauri()) {
          await sendChatRust([...streamMsgs, { role: 'user', content: revise }])
        } else {
          await new Promise<void>((resolve) => {
            stopRef.current = sendChatMock(
              [...streamMsgs, { role: 'user', content: revise }],
              (d) => updateAssistant(draftRef.current + d),
              resolve,
            )
          })
        }
      } catch (err) {
        if (!busyRef.current) {
          aborted = true
          done = true
          break
        }
        fail(err)
        return
      }
      stopRef.current = null
      if (!busyRef.current) {
        aborted = true
        done = true
        break
      }
      draftRaw = collapseAssistantDraft(draftRef.current)
    }
    setNote(sessionNote)
    busyRef.current = false
    setBusy(false)
    if (currentId && !aborted) {
      const finalRaw = collapseAssistantDraft(draftRaw)
      const saveMsgs: DisplayMsg[] = [...history, userMsg, { id: idSeq - 1, role: 'assistant', content: finalRaw }]
      persistNow(currentId, saveMsgs)
      // V3-R1：终稿默认自动保存为文档（source 真源 + html 快照）；会话内更新就地刷新同一份文档
      // V3-R3：同时固化本轮实际复用的库素材（{svg, ver}）——改库素材不会静默改变老文档
      if (splitAssistant(finalRaw).v2 && finalHtml) {
        const snaps = await snapshotsOfUsed(lastUsed)
        void persistDoc(currentId, finalRaw, finalHtml, finalWarnings, snaps)
      }
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
    // V3-R1：删除会话连带删除其默认文档（文档 id == 会话 id，避免残留"幽灵文档"）
    await deleteDocument(id)
    refreshDocs()
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

  // 清空 = 清空当前会话内容（保留会话，标题回到默认）；其文档一并移除（无产物不留在文档库）
  const clear = () => {
    if (busyRef.current) return
    clearAllChat()
    if (currentId) {
      void deleteDocument(currentId)
      refreshDocs()
      persistNow(currentId, [])
    }
  }

  // ---------- 使用手册（发布轮；桌面版顶栏入口，手册 HTML 随安装包发布） ----------
  const openManual = async () => {
    if (!inTauri()) return
    try {
      await invoke('open_manual')
    } catch (e) {
      window.alert(`打开《使用手册》失败：${e}。可在程序安装目录中找到 使用手册.html 手动打开。`)
    }
  }

  // ---------- V3 顶栏工作区 ----------
  const goView = (v: 'chat' | 'docs' | 'assets') => {
    if (v === 'docs') refreshDocs()
    setView(v)
  }

  const openDocFromLib = async (id: string) => {
    if (busyRef.current) return
    if (id !== currentId) await switchSession(id)
    setView('chat')
  }

  const status = inTauri() ? 'DeepSeek 桌面' : '模拟模式（浏览器）'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" />
          智序
          <span className="brand-sub">公众号推文助手</span>
          <button
            className="mini sess-btn"
            data-ready={currentId ? 1 : 0}
            data-open={railOpen ? 1 : 0}
            onClick={() => setRailOpen((v) => !v)}
          >
            {railOpen ? '收起会话栏' : '展开会话栏'}
          </button>
        </div>
        <nav className="view-tabs">
          <button className={`view-tab ${view === 'chat' ? 'view-tab-active' : ''}`} data-view="chat" onClick={() => goView('chat')}>
            对话
          </button>
          <button className={`view-tab ${view === 'docs' ? 'view-tab-active' : ''}`} data-view="docs" onClick={() => goView('docs')}>
            文档库
          </button>
          <button className={`view-tab ${view === 'assets' ? 'view-tab-active' : ''}`} data-view="assets" onClick={() => goView('assets')}>
            素材工坊
          </button>
        </nav>
        <div className="topbar-meta">
          <span>{kbCount === null ? '知识库加载中…' : `知识库 ${kbCount} 条目 · 三层结构`}</span>
          {savedAt && <span className="hint">已自动保存 {savedAt}</span>}
          {inTauri() && (
            <button className="mini" onClick={() => void openManual()}>
              使用手册
            </button>
          )}
          <button className="mini topbar-settings" onClick={() => setShowSettings(true)}>
            设置
          </button>
        </div>
      </header>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {view === 'chat' ? (
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
          <PreviewPane html={html} quality={quality} warnings={warnings} onClear={clear} />
        </main>
      ) : view === 'docs' ? (
        <main className="workspace docs-workspace">
          <DocsPane
            items={docItems}
            onOpen={(id) => void openDocFromLib(id)}
            onDelete={(id) => void removeSession(id)}
          />
        </main>
      ) : (
        <main className="workspace docs-workspace">
          <AssetWorkshop />
        </main>
      )}
    </div>
  )
}
