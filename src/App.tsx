import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import ChatPane, { DisplayMsg } from './components/ChatPane.tsx'
import type { ChatPaneApi } from './components/ChatPane.tsx'
import PreviewPane from './components/PreviewPane.tsx'
import SettingsPanel from './components/SettingsPanel.tsx'
import SessionRail from './components/SessionRail.tsx'
import DocsPane from './components/DocsPane.tsx'
import AssetWorkshop from './components/AssetWorkshop.tsx'
import { PERSONA_RULES, buildRegistrySystem } from './lib/persona.ts'
import { buildRegistry, ensureKnowledgeLoaded, loadEngineProtocol } from './lib/retrieval.ts'
import { collapseAssistantDraft, extractHtml, splitAssistant } from './lib/extract.ts'
import { composeMarkdown } from './lib/compose.ts'
import { themeDeclaration } from './lib/palettes.ts'
import { applyRejectedArts, emptyMaterializeInfo, hasPlaceholders, materializePlaceholders, needsMaterialize } from './lib/image-agent.ts'
import { resetVisionBudget } from './lib/vision.ts'
import type { AssetBinding, MaterializeInfo } from './lib/image-agent.ts'
import { createLedger, identityKeysOf, unfinished } from './lib/asset-ledger.ts'
import type { AssetLedger } from './lib/asset-ledger.ts'
import { clip, newRunId, setTraceSink, trace } from './lib/trace.ts'
import { getAsset } from './lib/asset-library.ts'
import { renderArtPlaceholders } from './lib/artRender.ts'
import { checkHtml, QualityResult } from './lib/quality.ts'
import { ChatMsg, DeltaPayload, cancelChatRun, inTauri, sendChatRust, sendChatMock } from './lib/chat.ts'
import { isCreateRequest } from './lib/needs.ts'
import type { TaskEvent, TaskPhase } from './lib/progress.ts'
import { WRITE_INSTRUCTION, runPrep } from './lib/prep.ts'
import type { AssetPolicy, PrepOutcome } from './lib/prep.ts'
import { MAX_AUTO_REVISES, buildReviseContent } from './lib/revise.ts'
import {
  bodyIntegrity,
  bodyText,
  collectDeliveryIssues,
  deliveryVerdict,
  issueFingerprint,
  slotIndexFromLedger,
} from './lib/delivery-quality.ts'
import type { BodyApplicability, DeliveryIssue, DeliveryVerdict, SlotIndexEntry } from './lib/delivery-quality.ts'
import { SessionItem, SessionMetaL, createSession, deleteSession, listSessions, openSession, renameSession, saveSession } from './lib/sessions.ts'
import type { UnreadableItemL } from './lib/sessions.ts'
import { DocContentL, DocMetaL, deleteDocument, isAcceptedDoc, listDocuments, openDocumentSafe, saveDocument } from './lib/documents.ts'
import type { SaveDocMeta } from './lib/documents.ts'
import './App.css'

let idSeq = 1

// P1（2026-09-24 调查 §5）：是否每个桌面回合都提供知识/素材工具。
// 2026-09-29（DS 修复指南 §5.2）：改为 **true**。理由：准备阶段现在是**唯一的模型入口**，
// 由模型用 finish_preparation 声明 reply / compose / candidate——不靠 isCreateRequest 或历史创作词
// 才能进入契约（否则一次"只改文字"的续改可能根本走不到结构化结果，F2/F3 就是这么丢的）。
// 代价：纯对话多一次**非流式**请求；但因为它以 outcome=reply 结束、**不再追加撰写请求**，
// 总请求数与"直接流式对话"持平。设置回 false 可退回"只在创作请求/创作态提供工具"。
const PREP_EVERY_TURN = true

// 交付门禁的实现版本标识：写进每一版文档，使"这一版是按哪套规则验收的"事后可查（计划 §4）。
// 改动检查口径时**必须**同步递增——否则旧稿会被误读成"按新规则验收过"。
const VALIDATION_VERSION = 'dq-2026-09-29'

// 第 23 轮：界面无模式/风格控件——类型与风格由模型按已澄清需求自决（persona 约束），
// 渲染主题一律取正文 [[theme:名称]] 声明（含 [[palette]] 自定义色板），不再从 UI 传入。

// 把助手文本解析为可预览 HTML（第 14/15 轮）：```html 直通；```v2 正文经 compose 渲染；无围栏返回 null
// 第 23 轮起不再传 UI 主题——风格由正文 [[theme:名称]]（+可选 [[palette]]）声明；arts：compose 收集的 SVG 素材（需由调用方渲染替换 @@ARTn@@ 占位）
// 第 24 轮：正文含图位占位（[[img:…]]/[[deco:…]]）时暂不渲染——等素材生成器替换为 ::: art 后再 compose（见 turn/applySession）
//
// 2026-09-29：返回值**必须**带上 `issues` 与 `rejectedArts`。此前这里只回传
// `{html, warnings, arts}`，于是"没有占位、直接 compose"的那条分支（纯正文稿）把结构化问题丢了——
// 交付门禁拿不到 `quality.low-structure` 之类的解析类问题，实测后果是**一版缺组件的半成品被直接
// 判为可提交、自动修订一次都不跑**（warnings 有、但门禁清单里空着）。
interface PreviewParse {
  html: string
  warnings: string[]
  arts: { svg: string; alt: string; wide: boolean }[]
  issues: ReturnType<typeof composeMarkdown>['issues']
  rejectedArts: ReturnType<typeof composeMarkdown>['rejectedArts']
}

function resolvePreview(raw: string): PreviewParse | null {
  const direct = extractHtml(raw)
  // ```html 直通：旧通道没有经过 v2 解析器，自然没有解析类问题可报（不是"丢了"，是本来就没有）
  if (direct) return { html: direct.html, warnings: [], arts: [], issues: [], rejectedArts: [] }
  const { v2 } = splitAssistant(raw)
  if (v2) {
    if (hasPlaceholders(v2)) return null
    const r = composeMarkdown(v2, {})
    return { html: r.html, warnings: r.warnings, arts: r.arts, issues: r.issues, rejectedArts: r.rejectedArts }
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

// 素材解析结果 → 用户可见警告。文案刻意分成三类，且只有第一类进"可修复"清单：
// - 引用不可用（residual）：模型改引用写法就能解决 → 进 FIXABLE_KEYS，有界自动修订
// - 分类不符（mismatched）：解析器已按实际分类正确渲染，只需提示 → 不触发全文重写（P0 验收口径）
// - 用途不兼容 / 素材位未完成：属于素材侧的事，重写正文解决不了 → 只在界面提示
function materializeWarnings(inf: MaterializeInfo): string[] {
  const out: string[] = []
  if (inf.residual > 0) {
    out.push(
      `库素材引用缺失（${inf.residual} 处）：所引用的库素材不存在、名称有歧义或分类写错，请改用 [[img]]/[[deco]] 占位，或照抄素材库清单里的引用写法`,
    )
  }
  if (inf.mismatched > 0) {
    out.push(
      `素材引用分类不符（${inf.mismatched} 处）：引用声明的分类与素材库里的实际分类不一致（用途兼容），已按素材实际分类渲染；建议核对引用写法`,
    )
  }
  if (inf.residue > 0) {
    out.push(`已从正文中移除 ${inf.residue} 处未解析的素材协议行（成品不残留占位/引用代码）`)
  }
  // 素材侧的具体失败原因（绘图失败、库素材未过适用门禁、排版拒收…）。
  // 这些以前只进 MaterializeInfo 而没有界面消费点——用户看得到"有素材未完成"，却看不到为什么。
  for (const e of inf.errors || []) if (String(e || '').trim()) out.push(String(e))
  // 排版拒收回写时比对不上任何素材位的那些（§6）：如实报出，不静默丢弃
  for (const e of inf.unlocatedRejects || []) if (String(e || '').trim()) out.push(String(e))
  return out
}

/** 未完成素材的提示：可操作（逐项重试），且**不**进自动修订清单——重写正文解决不了素材失败 */
function unfinishedWarning(n: number): string {
  return `仍有 ${n} 个素材未完成（右上预览区可逐项重试）；本次未把失败说明当作正文输出`
}

/**
 * 错误 → 界面可见的一句话摘要（前 80 字；Error 取 message，其它 toString）。
 * 只用于**展示**失败原因，不参与任何流程判断（铁律 6：前端不得有对话状态机）。
 */
function errSummary(e: unknown): string {
  return clip(e instanceof Error ? e.message : String(e), 80)
}

/** HTML → 纯文本（正文完整性比较与长度分档都用它，口径必须一致） */
function plainTextOf(html: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 交给交付门禁"源文"字段的那份文本。
 *
 * 为什么不能直接喂渲染后的 HTML 反推：compose 的解析类问题（parse.leak / parse.unclosed-block）
 * 带的是**源文行号**，逐行定位必须拿到真正的源文。这里传入的 source 已经是规范化后的
 * 成品源文（素材位 → 稳定引用块），行号能与之对上。
 */
function materializedSourceFor(source: string): string {
  return String(source || '')
}

/** 把一段纯 v2 源文回填成"助手原始回复"形态，好让它与流式撰写的结果走**同一段**候选交付代码 */
function wrapAsAssistantReply(source: string): string {
  return '```v2\n' + String(source || '').trim() + '\n```'
}

/**
 * 两组阻断项的**位置级指纹集合**是否完全相同（无进展判定用）。
 *
 * 旧实现只比 `code`（同一批问题代码就算"一样"），但那会把"同一类问题在**不同位置**"
 * 也说成没进展——模型明明在往前推（换了段落、换了素材位），却因为代码大类相同被判定空转。
 * `issueFingerprint` 带上 stage / slotId / nodeId / 源文行号，正是"问题在哪"的精确表达。
 */
function sameIssueFingerprints(a: DeliveryIssue[], b: DeliveryIssue[]): boolean {
  const sa = new Set(a.map(issueFingerprint))
  const sb = new Set(b.map(issueFingerprint))
  if (sa.size !== sb.size) return false
  for (const k of sa) if (!sb.has(k)) return false
  return true
}

/**
 * FNV-1a 32 位哈希：给"候选内容指纹"用。
 *
 * 为什么不用 `crypto.subtle`：它是异步的，而这里要在同步判定里算指纹；
 * 也不引第三方依赖（本仓库前端依赖只有 react / tauri api）。
 * 用途只是"两次快照是否逐字节相同"，32 位足够（碰撞概率与收益无关紧要，
 * 真碰撞的后果也不过是"少做一次提前结束"，不会放过任何阻断项）。
 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

/**
 * **完整候选内容指纹**（DS 指南 §4.2 末段）。
 *
 * 只比正文投影是不够的：正文投影会剔掉 `<svg>` 整块、样式与坐标——于是"素材重画了、
 * 样式改了、结构变了"这些**真实进展**在它眼里全等于零，会被误判成"无进展、提前结束"。
 * 因此指纹取**渲染后的 HTML**（它包含素材 SVG、样式与结构），再并上源文长度。
 */
function candidateFingerprint(c: { source: string; html: string }): string {
  return `${c.source.length}:${c.html.length}:${fnv1a(c.html)}`
}

/**
 * 让模型重写**解决不了**的问题（计划 §5.4/§5.6）——把它们排除出"本轮要修什么"。
 *
 * - 素材位失败（未完成 / 被拒收 / 未过适用门禁）：那是素材侧的事；模型重写只会
 *   把这一处一并删掉，等于"为了清空问题清单静默删除用户明确要求的素材"（§5.6 末句）。
 *   正解是恢复快照 / 重绘该素材位，或让用户按单项重试——不是改文章。
 * - 照片位待补、版本不一致：都不是正文能改的。
 * - `repairKind === 'none'`：策略本身就是"仅提示，不强迫改稿"。
 */
const NOT_TEXT_FIXABLE = new Set([
  'asset.required-incomplete',
  'asset.rejected',
  'raster.not-passed',
  'photo.pending',
  'version.mismatch',
  'version.missing',
  // "该比却没比"缺的是基准，不是文字——让模型再改一版正文只会把问题拖下去（DS 指南 §4.2）
  'body.unverified',
])

/** 这一条问题值不值得让模型改一版正文 */
function textFixable(i: DeliveryIssue): boolean {
  return i.repairKind !== 'none' && i.repairKind !== 'await-photo' && i.repairKind !== 'revert-version' && !NOT_TEXT_FIXABLE.has(i.code)
}

/**
 * 本轮要交给模型的目标清单：**只修阻断项**。
 *
 * 计划 §5 第 3 条写得很直白："无阻断项：进入持久化提交；有阻断项：按问题类型生成修复任务"。
 * 也就是说，**提示级问题（组件数量、正文偏短、照片位待补…）不触发修复**——它们是给用户看的
 * 信息，不是重写文章的理由（§4 明列"有意短篇、推荐性组件数量 → 提示 → 不强迫改稿，不阻断成品"）。
 *
 * 这条口径取代了 2026-09-29 之前"按 FIXABLE_KEYS 中文子串触发整篇自动重写"的做法：
 * 那种做法既用展示文案控制执行（文案一改就静默失效），又会为了少几条告警把一篇本来合格的稿子
 * 整篇换成另一篇（实测副作用：引用库素材的稿子被换成不带任何库引用的版本，文档固化快照随之清空）。
 */
function pendingFixables(v: DeliveryVerdict): DeliveryIssue[] {
  return v.blockers.filter(textFixable)
}

/**
 * 预览区显示的**是草稿还是成品**（计划 §8）。**纯展示**：不参与任何流程判断（铁律 6）。
 * 最新聊天内容不能被误解成"已经更新了正式成品"——这就是这个状态存在的理由。
 */
export type DocDisplayState =
  | {
      kind: 'accepted'
      revisionId?: string
      /** 本轮**成功提交回执 + 读回**是否已拿到（DS 指南 §5.3：应用「已保存」只来自这二者）。
       *  `accepted` 是**门禁**的结论，不等于磁盘写入成功——落库前先置 false，
       *  拿到回执与读回后才置 true。见 PreviewPane 同名类型上的说明。 */
      saved?: boolean
    } // 成品已验收并保存
  | { kind: 'restored'; revisionId?: string } // 已恢复上一版成品（本次候选被撤销）
  | { kind: 'draft-failed'; blockers: number } // 草稿未通过
  | { kind: 'repairing'; attempt: number } // 修复中

export default function App() {
  const [msgs, setMsgs] = useState<DisplayMsg[]>([])
  const [busy, setBusy] = useState(false)
  // 「AI 工作中」气泡：当前阶段 + 真实细节（读资料 / 思考 / 撰写 / 素材 / 排版 / 质检 / 修订 / 保存）
  const [task, setTask] = useState<TaskEvent | null>(null)
  // 本轮开始时间戳，供气泡显示已耗时
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null)
  // P2：随下一条消息发送的参考图（data URL，仅本轮有效；消费后清空）
  const [attached, setAttached] = useState<string[]>([])
  const [html, setHtml] = useState<string | null>(null)
  const [quality, setQuality] = useState<QualityResult | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  // 预览显示的是草稿还是成品 + 本次交付判定（两者都是**纯展示**，不参与流程判断，铁律 6）
  const [deliveryState, setDeliveryState] = useState<DocDisplayState | null>(null)
  const [deliveryVerdictState, setDeliveryVerdictState] = useState<DeliveryVerdict | null>(null)
  /**
   * 未通过门禁的候选 HTML（计划 §8：失败候选允许通过**明确标注的草稿导出**入口取回，
   * 不静默作为成品交付）。为 null 表示本次没有待取回的草稿。
   */
  const [draftHtml, setDraftHtml] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // 会话栏：默认按窗口宽度展开（≤1120px 折叠），顶栏「会话」按钮为折叠开关
  const [railOpen, setRailOpen] = useState<boolean>(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1120))

  // 多会话状态
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sessionItems, setSessionItems] = useState<SessionMetaL[]>([])
  // 会话列表**读取失败**的原因（null = 未失败）。读失败必须与"没有会话"分开显示，
  // 否则用户看到的是"一开就只剩一个新对话"，像是历史会话全被清掉了。纯展示，不参与流程（铁律 6）。
  const [sessionError, setSessionError] = useState<string | null>(null)
  // 列表整体读得出来、但个别会话文件坏了（R1）：它们不在 items 里，界面给一条简短提示。
  // 与 sessionError（整体读取失败）分开——后者才配 data-list-error 契约。
  const [sessionUnreadable, setSessionUnreadable] = useState<UnreadableItemL[]>([])
  // "当前会话"指针（state.json）读写异常的原因（R6；null = 正常）。纯展示：说清"重启后可能
  // 打开的是另一个会话"，不参与任何流程判断（铁律 6）。
  const [sessionStateWarning, setSessionStateWarning] = useState<string | null>(null)
  // 一次性失败提示条（删除会话失败 / 新建失败 / 存档失败等）：只在真的失败时出现，用户可关闭。
  // **纯展示**——不参与对话流程、不改变路由（铁律 6）。
  const [notice, setNotice] = useState<string | null>(null)

  // V3：顶栏工作区切换（对话 / 文档库 / 素材工坊）；文档库数据（文档默认自动保存、就地刷新）
  const [view, setView] = useState<'chat' | 'docs' | 'assets'>('chat')
  const [docItems, setDocItems] = useState<DocMetaL[]>([])
  // 文档库读取失败的原因（null = 未失败）：与"还没有文档"分开显示
  const [docsError, setDocsError] = useState<string | null>(null)
  // 个别文档坏了/读不出来（R3）：与 docsError（整体读取失败）分开，只给一条简短提示
  const [docsUnreadable, setDocsUnreadable] = useState<UnreadableItemL[]>([])

  const busyRef = useRef(false)
  const draftRef = useRef('')
  const chatRef = useRef<ChatPaneApi | null>(null)
  const stopRef = useRef<{ cancel: () => void } | null>(null)
  const msgsRef = useRef<DisplayMsg[]>([])
  // artSeqRef：素材异步渲染序号，防止旧渲染结果覆盖新预览
  const artSeqRef = useRef(0)
  // 工作气泡用：本轮在写什么（正文 / 自动修订）+ 首个 token 是否已到（只决定气泡标签，不参与流程）
  const writePhaseRef = useRef<TaskPhase>('write')
  const awaitingTokenRef = useRef(false)
  // 本轮创作的素材结果表（阶段 3）：跨自动修订复用，失败预算不清零
  const ledgerRef = useRef<AssetLedger | null>(null)
  // 当前回合 id（阶段 4）：用于丢弃上一回合的迟到流式增量、以及作为后端取消句柄的键
  const runIdRef = useRef<string | null>(null)
  // 上次素材解析的输入（供"未完成素材"的单项重试就地重跑，不必重开一个创作回合）
  const lastMaterializeRef = useRef<{
    v2: string
    theme: string
    ledger: AssetLedger
    bindings: AssetBinding[]
    snapshots: Record<string, { svg: string; ver: number }>
  } | null>(null)
  // 未完成的素材位（画不出来/引用不可用）——展示在预览区，可逐项重试
  const [assetIssues, setAssetIssues] = useState<{ slotId: string; label: string; reason: string }[]>([])
  const [retrying, setRetrying] = useState(false)
  // 终稿保存失败摘要（null = 没失败）。**纯展示**：只喂给 PreviewPane 渲染，不参与任何流程判断（铁律 6）。
  // 失败时置为可读的一句话，保存成功后清除——不留下"以为已经存好了"的错觉。
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    msgsRef.current = msgs
  }, [msgs])

  // ---------- 会话工具 ----------
  // 读列表失败时**保留**原有条目（不清空）并置失败原因，由会话栏显示"读取失败 + 重试"。
  const refreshItems = () => {
    void listSessions().then((r) => {
      if (!r.ok) {
        console.warn('会话列表读取失败：', r.error)
        setSessionError(r.error)
        return
      }
      setSessionItems(r.list.items)
      setSessionUnreadable(r.list.unreadable)
      setSessionStateWarning(r.list.stateWarning)
      setSessionError(null)
    })
  }

  const refreshDocs = () => {
    void listDocuments().then((r) => {
      if (!r.ok) {
        console.warn('文档库读取失败：', r.error)
        setDocsError(r.error)
        return
      }
      setDocItems(r.items)
      setDocsUnreadable(r.unreadable)
      setDocsError(null)
    })
  }

  /**
   * 载入会话列表并打开当前会话（启动与"重试"共用；重试只在用户点击时跑一次，不做自动重试）。
   * 关键：列表**读失败时绝不自动建会话**——否则一开就只剩一个"新对话"，历史会话看上去像全没了。
   */
  const loadSessions = async () => {
    const r = await listSessions()
    if (!r.ok) {
      console.warn('会话列表读取失败：', r.error)
      setSessionError(r.error)
      return
    }
    setSessionError(null)
    setSessionUnreadable(r.list.unreadable)
    setSessionStateWarning(r.list.stateWarning)
    let items = r.list.items
    let cur = r.list.current
    if (!items.length) {
      const id = await createSession()
      if (!id) {
        setNotice('新建会话失败：会话未能写入本机，请重试。')
        return
      }
      items = [{ id, title: '新对话', updatedAt: '', count: 0 }]
      cur = id
    }
    setSessionItems(items)
    const open = cur ?? items[0].id
    setCurrentId(open)
    const item = await openSession(open)
    if (!item.ok) {
      // 单体读不出来：只提示，不擅自清空会话栏、不新建会话
      console.warn('当前会话读取失败：', item.error)
      setNotice(`打开会话失败：${item.error}`)
      return
    }
    await applySession(item.item)
    refreshItems()
  }

  // V3-R1：把一版终稿（v2 真源 + 渲染 html）默认自动保存/就地刷新为当前会话的文档；
  // V3-R3：snapshots = 本次渲染实际复用的库素材固化快照（{svg, ver}），供改版影响比较
  // 返回值：保存成功返回落库结果，**未写入返回 null**（saveDocument 内部吞掉 Tauri 异常并返回 null，
  // 所以调用方必须据此判定失败，否则"保存失败"会一路静默到底）。
  const persistDoc = async (
    id: string,
    source: string,
    html: string,
    warns: string[],
    snapshots?: Record<string, { svg: string; ver: number }>,
    bindings?: AssetBinding[],
    docMeta?: SaveDocMeta,
  ): Promise<DocContentL | null> => {
    if (!source.trim() || !html.trim()) return null
    // 标题与会话保持一致：优先会话列表已有标题；列表滞后（新建会话首稿）时按首条用户消息派生
    const meta = sessionItems.find((i) => i.id === id)
    let title = meta && meta.title && meta.title !== '新对话' ? meta.title : ''
    if (!title) {
      const firstUser = msgsRef.current.find((m) => m.role === 'user')
      const line = firstUser ? firstUser.content.split('\n')[0].trim() : ''
      title = line ? line.slice(0, 16) + (line.length > 16 ? '…' : '') : ''
    }
    // P0 §7：素材位 → 库 ID / 来源 / 原因一并写入文档，素材身份不再只能靠自然语言描述恢复
    const saved = await saveDocument(id, {
      title,
      source,
      html,
      warnings: warns,
      snapshots: snapshots || {},
      bindings: bindings || [],
      accepted: docMeta?.accepted,
      baseRevisionId: docMeta?.baseRevisionId,
      quality: docMeta?.quality,
      runId: docMeta?.runId,
      validationVersion: docMeta?.validationVersion,
    })
    if (saved) refreshDocs()
    return saved
  }

  // 把本次素材解析使用到的库素材 id 读成固化快照（当前 SVG + version）
  /**
   * 为本轮实际用到的素材生成"固化快照"（写进文档，供以后逐篇选择是否更新）。
   *
   * **文档快照是保持素材的权威输入**（DS 指南 §5.4）：同一 ID 在库里升到 v2 时，
   * 已固化的文档**仍要用它自己那一版 v1 的内容与版本**。所以这里**优先沿用**已有快照
   * （`prior` 传入的是当前文档的快照表），只在没有可用快照时才读库当前值。
   *
   * 旧实现无条件 `getAsset(key)` 取库当前 `svg/ver`：文档每次保存都会被"顺带"升到库的最新版——
   * 用户在素材库里换了图，他**没同意更新**的那些旧文档也跟着变了，而界面上"逐篇选择是否更新"
   * 的语义就此失效。这不是显示问题，是文档内容的实际改动。
   */
  const snapshotsOfUsed = async (
    used: Record<string, { id: string; title: string }>,
    /** 当前文档已有的快照（缺省不沿用；显式传 {} 表示"已知文档没有快照"） */
    prior?: Record<string, { svg: string; ver: number }> | null,
  ) => {
    const out: Record<string, { svg: string; ver: number }> = {}
    for (const key of Object.keys(used || {})) {
      const frozen = prior ? prior[key] : undefined
      if (frozen && String(frozen.svg || '').trim()) {
        out[key] = { svg: frozen.svg, ver: frozen.ver }
        continue
      }
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
    // 读失败 ≠ 没有文档：失败时明确提示，不能让用户以为自己的存档没了。
    const docR = await openDocumentSafe(item.id)
    if (docR.ok && docR.doc.html.trim()) {
      setHtml(docR.doc.html)
      setQuality(checkHtml(docR.doc.html))
      // 计划 §8：重开时也要说清"看到的是哪一版"。若存在比成品更新的草稿
      // （上一次候选没通过门禁 → 草稿已存、成品维持不变），**必须**在预览区写出来，
      // 否则用户会以为聊天里那句话已经把正式成品改了。
      const doc = docR.doc
      const hasNewerDraft = !!doc.draftRevisionId && doc.draftRevisionId !== doc.acceptedRevisionId
      const accepted = isAcceptedDoc(doc)
      setDeliveryState(
        hasNewerDraft
          ? { kind: 'restored', revisionId: doc.revisionId ?? undefined }
          : accepted
            ? { kind: 'accepted', revisionId: doc.revisionId ?? undefined }
            : { kind: 'draft-failed', blockers: 0 },
      )
      setDeliveryVerdictState(null)
      const base = doc.warnings || []
      const extra: string[] = []
      if (hasNewerDraft) extra.push('本地有比当前成品更新的草稿（上次未通过交付门禁）：预览显示的是已验收成品，草稿内容仍保留在该会话的对话里。')
      if (!accepted && !hasNewerDraft) extra.push('这份文档没有验收记录（可能是旧版本迁移来的），不能当作合格回滚目标。')
      setWarnings(extra.length ? [...base, ...extra] : base)
      return
    }
    if (!docR.ok && !docR.notFound) setNotice(`文档读取失败：${docR.error}`)
    setDeliveryState(null)
    setDeliveryVerdictState(null)
    const last = [...mapped].reverse().find((m) => m.role === 'assistant')
    if (last) {
      const seq = ++artSeqRef.current
      const { v2 } = splitAssistant(last.content)
      // W2（2026-09-29）：判定用 needsMaterialize，不是 hasPlaceholders——
      // 只含纯文字 `::: art deco 名称` 块（无任何 [[img]]/[[deco]]/[[asset]]）的历史稿，
      // hasPlaceholders 为 false，会绕过恢复路径直接 compose → "角饰定义不可用…已忽略" → 触发重写。
      if (v2 && needsMaterialize(v2)) {
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
  }

  const clearAllChat = () => {
    setMsgs([])
    setHtml(null)
    setQuality(null)
    setWarnings([])
    setTask(null)
    setTurnStartedAt(null)
    setAssetIssues([])
    // 换会话/清空时不把上一份稿子的状态带过来（草稿内容、交付状态、失败提示都属于"那一篇"）
    setDeliveryState(null)
    setDeliveryVerdictState(null)
    setDraftHtml(null)
    setSaveError(null)
    lastMaterializeRef.current = null
    runIdRef.current = null
    awaitingTokenRef.current = false
  }

  // 启动：加载会话列表与当前会话（首次自动建会话；旧单会话自动迁移）
  // 列表读失败时**不建会话**，由会话栏显示失败原因 + 重试（否则像是历史会话全没了）。
  // bootRef 互斥防 StrictMode 双跑；不设 alive 门控（cleanup 会先于异步完成执行）
  const bootRef = useRef(false)
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    void (async () => {
      try {
        await loadSessions()
      } catch (e) {
        console.warn('启动加载会话失败：', e)
      }
      refreshDocs()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 知识库懒加载（首回合前预热；不再向上层暴露条目数——顶栏计数小字已移除）
  useEffect(() => {
    ensureKnowledgeLoaded().catch(() => {})
  }, [])

  // 请求证据落盘（修复计划阶段 1）：桌面端把追踪记录写进 workspace/traces/<runId>.jsonl。
  // 浏览器模式不落盘（只留在 trace.ts 的内存缓冲里，供 E2E 断言）。
  // 写盘失败一律吞掉——日志是旁路，绝不能因为它失败而打断创作。
  useEffect(() => {
    if (!inTauri()) return
    setTraceSink((rec) => {
      const runId = rec.runId || ledgerRef.current?.runId || 'adhoc'
      void invoke('trace_write', { runId, record: rec }).catch(() => {})
    })
    return () => setTraceSink(null)
  }, [])

  // 存档失败的可见提示（**不打断**创作）：追加进预览区的警告列表，同一条只留一份；
  // 下一回合渲染会用新警告整体替换它，因此它会自然过期，不需要额外状态。
  // 文案只说事实——存档没写进本机，界面就不能让用户以为已经存好了。
  const noteArchiveFailure = () => {
    setWarnings((prev) =>
      prev.some((w) => w.startsWith('消息未存档')) ? prev : [...prev, '消息未存档：未能写入本机，重启后可能丢失。'],
    )
  }

  const saveCurrent = (id: string, messages: DisplayMsg[]) => {
    void saveSession(id, { mode: 'auto', style: 'auto', messages }).then((ok) => {
      if (!ok) {
        console.warn('会话存档失败：本次消息未写入本机', id)
        noteArchiveFailure()
      }
      refreshItems()
    })
  }

  // 变更自动存档（防抖 700ms，绑定当前会话）
  useEffect(() => {
    if (!currentId || !msgs.length) return
    const id = currentId
    const timer = window.setTimeout(() => {
      saveCurrent(id, msgs)
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, currentId])

  const persistNow = (id: string, messages: DisplayMsg[]) => {
    saveCurrent(id, messages)
  }

  // ---------- 对话 ----------
  const updateAssistant = (draft: string) => {
    draftRef.current = draft
    // 首个 token 到达 → 气泡从「等待模型响应」切到「撰写正文 / 自动修订」。只切标签，不参与流程。
    if (awaitingTokenRef.current && draft) {
      awaitingTokenRef.current = false
      setTask({
        phase: writePhaseRef.current,
        text: writePhaseRef.current === 'write' ? '正在撰写正文…' : '正在按问题清单重写…',
      })
    }
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

  /**
   * 只把文字写进最后一条助手消息，**不碰预览**。
   *
   * 与 `updateAssistant` 的区别：后者会顺带 `resolvePreview()`（流式实时预览要用）。
   * 但"普通答复 / 准备失败说明"这类文本**不是**本轮产出——实测用户问"v2 写法是什么样？"时，
   * 答复里带的示例经过 `resolvePreview` 会把**已验收成品的预览替换成一段示例**，
   * 同时交付状态被清空、导出按钮还指向那份示例。所以这些路径必须走文字专用入口。
   */
  const setAssistantText = (text: string) => {
    setMsgs((prev) => {
      const copy = prev.slice()
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = { ...copy[i], content: text }
          break
        }
      }
      return copy
    })
  }

  const fail = (err: unknown) => {
    setMsgs((prev) => [...prev, { id: idSeq++, role: 'error', content: String(err) }])
    busyRef.current = false
    setBusy(false)
    awaitingTokenRef.current = false
    setTask(null)
    setTurnStartedAt(null)
  }

  // Tauri 流式事件订阅（仅桌面模式）。注：错误不依赖事件——Rust 从不 emit chat-error，
  // 失败经 sendChatRust 抛错 → catch → fail()（第 27 轮清理休眠监听）。
  // 阶段 4：事件带 runId。用户按下停止后，旧回合的迟到增量仍会到达——
  // 只要它的 runId 不是当前回合就直接丢弃，绝不写进新回合的草稿。
  useEffect(() => {
    if (!inTauri()) return
    const un1 = listen<DeltaPayload>('chat-delta', (e) => {
      if (!busyRef.current) return
      const rid = e.payload?.runId ?? null
      if (rid && runIdRef.current && rid !== runIdRef.current) return
      updateAssistant(draftRef.current + (e.payload?.delta ?? ''))
    })
    return () => {
      un1.then((f) => f())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 对话回合（统一 persona，模型自主判断；禁止任何前端对话状态机）----------
  // 第 25 轮：system 只注入轻量"知识注册表"，不再 bigram 注入正文；桌面创作前经 prep_turn
  // 让模型决定"取哪些知识点 / 是否澄清"（工具取用循环非对话路由，不改变用户可见回合）。
  const turn = async (raw: string, images: string[] = []): Promise<void> => {
    if (busyRef.current) return
    // 参考图只在本轮有效：显示文本里留一句说明，图片本身不进会话存档（sessions 结构不变）
    const content = images.length ? `${raw}
（附参考图 ${images.length} 张）` : raw
    const userMsg: DisplayMsg = { id: idSeq++, role: 'user', content }
    const history: DisplayMsg[] = msgsRef.current
    setMsgs([...history, userMsg, { id: idSeq++, role: 'assistant', content: '' }])

    busyRef.current = true
    setBusy(true)
    setTurnStartedAt(Date.now())
    setTask({ phase: 'think', text: '准备创作…' })
    // 视觉复核按"每篇文章"计预算（费用上限），每个回合开始重置
    resetVisionBudget()
    draftRef.current = ''
    awaitingTokenRef.current = false
    // 阶段 1/3：本回合一个 runId，素材结果表随它走；日志文件同名（旧文件会被清掉后重写）
    const ledger = createLedger(newRunId())
    ledgerRef.current = ledger
    runIdRef.current = ledger.runId
    lastMaterializeRef.current = null
    setAssetIssues([])
    trace({ kind: 'run', runId: ledger.runId, phase: 'turn', ok: true, note: 'run-start' })
    if (inTauri()) void invoke('trace_start', { runId: ledger.runId }).catch(() => {})

    // system = PERSONA_RULES + 知识注册表（目录，≤3500 字符）；加载失败退回纯 persona（不挡对话）
    // 2026-09-28：注册表就绪/加载失败原先会显示成对话区小字，现移除；失败仍静默退回，只留控制台线索
    let system: string
    try {
      const registry = await buildRegistry()
      system = buildRegistrySystem(registry)
    } catch (e) {
      console.warn('知识注册表加载失败，已退回通用人设', e)
      system = PERSONA_RULES
    }

    // ---- 本回合的**权威提交基准**：在调用模型**之前**读取当前正式文稿（DS 修复指南 §5.4） ----
    // 为什么必须提前读（而不是等写作结束）：模型需要看到"实际保存的是哪一版、素材引用长什么样"。
    // 否则它会照着**历史助手消息**里的旧 `[[img:…|new]]` 改稿——而正式源文早已固化成
    // `[[asset:…]]`，接通候选链后就会按 `|new` 重新画一张（F4 的重复绘图风险）。
    // 读取失败**明确报错**，不当作"没有旧稿"继续覆盖（沿用既有未验证 legacy 语义，不给旧文档补造验收记录）。
    //
    // 位置要求：必须在下面 `baseMsgs` **构造之前**——它要给 `system` 追加"当前正式文稿"段，
    // 而 `baseMsgs` 的第一条就是 system 的快照（放后面等于这段说明根本没发给模型）。
    //
    // 指南 §5.1：读取失败**必须终止本轮**并显示错误。旧行为是 console.warn 之后按"没有旧稿"继续，
    // 于是一轮在**看不到真实成品**的情况下生成并提交新稿——那正是把"读不出来"折叠成"不存在"。
    // 只有明确的 notFound 才能当新文档处理。
    const priorAcceptedR = await openDocumentSafe(currentId || '')
    if (!priorAcceptedR.ok && !priorAcceptedR.notFound) {
      const reason = errSummary(priorAcceptedR.error)
      trace({
        kind: 'run',
        runId: ledger.runId,
        stage: 'validation',
        ok: false,
        stopReason: 'unrepairable',
        note: `读取当前正式文稿失败，本轮终止（未调用模型）：${reason}`,
      })
      setSaveError(`读取当前文稿失败：${reason}。本轮没有调用模型、没有生成或更新文稿，已有成品保持不变。`)
      const noteText = `读取当前文稿失败：${reason}。本轮没有调用模型、没有生成或更新文稿，已有成品保持不变。可直接重发一次。`
      setAssistantText(noteText)
      const noteMsg: DisplayMsg = { id: idSeq - 1, role: 'assistant', content: noteText }
      busyRef.current = false
      setBusy(false)
      setTask(null)
      setTurnStartedAt(null)
      if (currentId) persistNow(currentId, [...history, userMsg, noteMsg])
      return
    }
    const priorAccepted = priorAcceptedR.ok ? priorAcceptedR.doc : null
    const priorIsAccepted = isAcceptedDoc(priorAccepted)

    // 把当前正式文稿明确标给模型（revisionId + canonical source + 素材稳定引用）。
    // 历史助手 raw reply 只是历史消息，**不是**最新成品。
    if (priorIsAccepted && priorAccepted?.source) {
      system +=
        `\n\n## 当前正式文稿（应用实际保存的权威版本）\n` +
        `revisionId: ${priorAccepted.revisionId || '(未知)'}\n` +
        `修改请基于下面这份正文；其中 [[asset:分类|素材ID|用途说明]] 是已固化素材的稳定引用，` +
        `**原样照抄分类与 ID**。用户只说改文字时，不要给已有素材加 |new，也不要改成 [[img]]/[[deco]] 占位。\n` +
        '```\n' + priorAccepted.source + '\n```'
    }

    const baseMsgs: ChatMsg[] = [
      { role: 'system', content: system },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content, images: images.length ? images : undefined },
    ]

    // 创作前置（P1，2026-09-24 调查 §5）：把知识/素材工具提供出来；取不取、要不要澄清、要不要写稿，
    // **全部由模型自己决定**（由 finish_preparation 结构化声明）。这只是"工具是否可用"的开关，
    // 不是对话路由，不改变用户可见回合。
    //
    // 指南 §5.2：**历史创作状态不再参与任何授权判断**——它只是模型上下文里的历史消息。
    // 旧写法把"历史里出现过创作请求"当作"本回合已确认的创作操作契约"，于是"历史上要过一篇通知 +
    // 现在问一句 NOT READY 是什么意思"会被判成创作请求，把普通答疑变成一次没被授权的写作。
    // 现在不存在这个开关：有合法终结结果就是有授权，没有就没有（历史照旧进 baseMsgs 给模型看）。
    const needPrep = inTauri() && (PREP_EVERY_TURN || isCreateRequest(raw))
    /** 模型声明的素材操作；缺省按"文档里已有绑定 → 保持不动"，避免缺省值把既有配图重画一遍 */
    const hasPriorBindings = Boolean(priorAccepted?.bindings?.length)
    let assetPolicy: AssetPolicy = hasPriorBindings ? 'preserve' : 'modify'
    /** prep 直接给稿时用它跳过撰写请求；null 表示要正常发起一次撰写 */
    let directSource: string | null = null

    let streamMsgs: ChatMsg[] = baseMsgs
    if (needPrep) {
      let prep: PrepOutcome
      try {
        prep = await runPrep(baseMsgs, {
          onProgress: setTask,
          runId: ledger.runId,
          hasPriorBindings,
        })
      } catch (err) {
        // 准备阶段失败**不再**降级成"无 prep 直接撰写"——那是把网络/鉴权错误转换成一次没被授权的创作
        // （并且会让用户以为稿子更新了）。分类报告，保留旧成品，本轮不提交任何文稿。
        const reason = errSummary(err)
        trace({ kind: 'request', runId: ledger.runId, phase: 'prep', ok: false, failure: 'network', error: clip(String(err), 160), note: '准备阶段失败：本轮不产出文稿' })
        setSaveError(`准备阶段失败：${reason}。本轮没有生成或更新文稿，已有成品保持不变。`)
        const noteText = `准备阶段失败：${reason}。本轮没有生成或更新文稿，已有成品保持不变。可直接重发一次。`
        // 界面也要更新：turn() 开头插了一条**空的**助手占位消息，不写进去的话它会留在对话区
        // （`ChatPane` 只在 busy 时隐藏空消息）——用户看到一个空气泡，而原因只在预览区那一行。
        setAssistantText(noteText)
        const noteMsg: DisplayMsg = { id: idSeq - 1, role: 'assistant', content: noteText }
        busyRef.current = false
        setBusy(false)
        setTask(null)
        setTurnStartedAt(null)
        if (currentId) persistNow(currentId, [...history, userMsg, noteMsg])
        return
      }

      if (prep.mode === 'prep' && prep.kind === 'failed') {
        trace({ kind: 'run', runId: ledger.runId, stage: 'validation', ok: false, stopReason: 'unrepairable', note: `准备阶段未得到合法结果：${prep.failure}` })
        const why =
          prep.failure === 'exhausted'
            ? `${prep.reason}`
            : `模型的准备结果不符合约定：${prep.reason}`
        setSaveError(`准备阶段未完成：${why}。本轮没有生成或更新文稿，已有成品保持不变。`)
        // 指南 §5.2："旧完整稿不得丢弃"——模型那段没有形成合法终结的原文照原样展示在对话里，
        // 但它**不是**成品、也没有被提交（业务成功只来自提交回执与读回）。
        const noteText =
          `准备阶段未完成：${why}。本轮没有生成或更新文稿，已有成品保持不变。` +
          (prep.raw ? `\n\n模型这次的原文如下（未形成合法结果声明，**没有**被当作成品）：\n\n${prep.raw}` : '')
        setAssistantText(noteText)
        const noteMsg: DisplayMsg = { id: idSeq - 1, role: 'assistant', content: noteText }
        busyRef.current = false
        setBusy(false)
        setTask(null)
        setTurnStartedAt(null)
        if (currentId) persistNow(currentId, [...history, userMsg, noteMsg])
        return
      }

      if (prep.mode === 'prep' && prep.kind === 'reply') {
        // 模型选择**普通答复/澄清**：只显示文字，**不写稿、不提交文稿**。
        // 这不是"澄清成功"也不是"创作失败"——就是本轮没有文稿提交（指南 §5.5：状态区域说清楚）。
        const q = prep.text
        draftRef.current = q
        awaitingTokenRef.current = false // 答复文本不走"撰写正文"标签
        // 文字专用入口：答复里若带 ```v2 示例，**不能**让示例顶掉已验收成品的预览（见 setAssistantText）
        setAssistantText(q)
        stopRef.current = null
        setDeliveryState(null)
        setDeliveryVerdictState(null)
        setDraftHtml(null)
        const clarifyMsg: DisplayMsg = { id: idSeq - 1, role: 'assistant', content: q }
        busyRef.current = false
        setBusy(false)
        setTask(null)
        setTurnStartedAt(null)
        if (currentId) persistNow(currentId, [...history, userMsg, clarifyMsg])
        return
      }

      // 指南 §5.1：模型回显的 revision **只作一致性核对，不能替换宿主捕获的基准**。
      // 回显与宿主读到的不一致 → 本轮终止：它写的是另一个版本，提交上去就是把 A 的改动
      // 落到 B 上。没有回显（缺字段）**不**取消 CAS——提交时仍带宿主捕获的 baseRevisionId。
      {
        const echoed =
          prep.mode === 'prep' && (prep.kind === 'candidate' || prep.kind === 'compose') ? prep.echoedBaseRevisionId : undefined
        const hostRev = priorAccepted?.revisionId || ''
        if (echoed && hostRev && echoed !== hostRev) {
          const why = `模型按版本 ${echoed} 改稿，但当前正式版本是 ${hostRev}`
          trace({
            kind: 'run',
            runId: ledger.runId,
            stage: 'validation',
            ok: false,
            stopReason: 'unrepairable',
            note: `模型回显版本与宿主基准不一致，本轮终止：${why}`,
          })
          setSaveError(`准备阶段一致性检查未通过：${why}。本轮没有生成或更新文稿，已有成品保持不变。`)
          const noteText = `准备阶段一致性检查未通过：${why}。本轮没有生成或更新文稿，已有成品保持不变。可直接重发一次。`
          setAssistantText(noteText)
          const noteMsg: DisplayMsg = { id: idSeq - 1, role: 'assistant', content: noteText }
          busyRef.current = false
          setBusy(false)
          setTask(null)
          setTurnStartedAt(null)
          if (currentId) persistNow(currentId, [...history, userMsg, noteMsg])
          return
        }
      }

      if (prep.mode === 'prep' && prep.kind === 'candidate') {
        // 模型已经给出**完整正文**：直接进入下面的统一交付流程，不再花一次请求重写同稿（F3）。
        assetPolicy = prep.assetPolicy
        trace({
          kind: 'note',
          runId: ledger.runId,
          stage: 'validation',
          ok: true,
          note: `准备阶段直接给出完整正文（${prep.source.length} 字，模型显式声明 candidate），进入统一交付门禁`,
        })
        directSource = prep.source
      } else if (prep.mode === 'prep' && prep.kind === 'compose') {
        assetPolicy = prep.assetPolicy
        // 把实际取用知识点摘要 + 撰写指令拼进流式续写（不透传工具回合消息）
        // 第 29 轮：persona 已精简，v2 契约迁知识库——digest 若缺 engine-write-protocol 则强制附加
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
      }
    }

    // ---- 统一交付入口（DS 修复指南 §5.4）----
    // 主撰写流、prep 直接候选、自动修复**走同一段代码**：同一个门禁、同一个版本提交路径。
    // 不各写一份相似逻辑——那正是"有的路径过了检查、有的没有"的来源。
    if (directSource === null) {
      // 主撰写流：气泡先停在「等待模型响应」，收到首个 token 后由 updateAssistant 切到「撰写正文」
      writePhaseRef.current = 'write'
      awaitingTokenRef.current = true
      setTask({ phase: 'think', text: '等待模型响应…' })
      try {
        if (inTauri()) {
          await sendChatRust(streamMsgs, 'write', ledger.runId)
        } else {
          await new Promise<void>((resolve) => {
            stopRef.current = sendChatMock(streamMsgs, (d) => updateAssistant(draftRef.current + d), resolve)
          })
        }
      } catch (err) {
        trace({ kind: 'request', runId: ledger.runId, phase: 'write', ok: false, failure: 'network', error: clip(String(err), 160) })
        fail(err)
        return
      }
      stopRef.current = null
      awaitingTokenRef.current = false
    }
    // ---- 候选交付流程（2026-09-29 质量恢复计划 §4/§5） ----
    // 归纳：一个回合产出的不是"一版稿"，而是**一串候选**。每轮候选都跑同一套完整门禁，
    // 只有阻断项为 0 的那一版才提交为成品；其余轮次的结果只作为草稿与诊断保留。
    // 这一整段是**产物质量门禁**，不是对话状态机（铁律 6）：它不判断用户想说什么、
    // 不做澄清、不改路由；用户的回合边界与 persona 语义完全不受影响。
    let draftRaw = directSource !== null ? wrapAsAssistantReply(directSource) : collapseAssistantDraft(draftRef.current)
    if (directSource !== null) {
      // 直接候选也要显示成助手消息（UI 的 .msg-assistant-text 会隐藏正文围栏，所以这里回填原文）
      draftRef.current = draftRaw
      setMsgs((prev) => {
        const copy = prev.slice()
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'assistant') {
            copy[i] = { ...copy[i], content: draftRaw }
            break
          }
        }
        return copy
      })
    }
    let aborted = false
    // 停止原因（写进日志，供"为什么没有继续修"事后可查）
    let stopReason: 'budget' | 'no-progress' | 'unrepairable' | 'cancelled' | 'regressed' | 'none' = 'none'

    // 上一份已验收成品（回滚目标）**已在调用模型之前读取**（见上方"权威提交基准"）。
    // 旧格式文档没有验收记录 → 不算合格回滚目标（计划 §7.3）。

    /** 一次候选的完整快照：所有字段来自同一轮，禁止跨轮拼接（计划 §4） */
    interface Candidate {
      round: number
      /** 交给模型继续修订的源文（已尽量用规范化源文：素材位是稳定引用） */
      source: string
      /** 模型原始输出（保存草稿用它，用户文字一个字不丢） */
      draftRaw: string
      html: string
      /** 该候选的**正文投影**（剔素材实现/样式/系统占位后的可比较文本），用于建立与比对事实基准 */
      projection: string
      warnings: string[]
      issues: DeliveryIssue[]
      verdict: DeliveryVerdict
      used: Record<string, { id: string; title: string }>
      bindings: AssetBinding[]
    }

    /**
     * 渲染 + 跑完整门禁。失败返回 null（调用方据此走"没有可交付产物"分支）。
     *
     * `baseline` 是**本回合冻结的正文事实基准**（首个候选的正文投影），只在修复轮传得进来。
     * 第一轮传 null 是**正确**的——那时没有"修复前版本"可比；但"没有可比对象"与"该比却没比"
     * 必须分开表达，否则就是上一轮"两轮都传 null、门禁照样通过"的老毛病（DS 指南 §4.2）。
     */
    const evaluate = async (
      round: number,
      raw: string,
      baseline: string | null,
      /** prep 直接候选（`finish_preparation { outcome:'candidate' }`）：**它本身就是正文**，
       *  边界由模型显式声明，不必（也不能）再从围栏反推——正文里合法地可以含 ``` 代码块。 */
      declaredV2: string | null = null,
    ): Promise<Candidate | null> => {
      const split = splitAssistant(raw)
      const v2 = declaredV2 ?? split.v2
      // 正文边界不确定（v2 里出现裸 ``` 代码块，见 extract.ts 的 v2Ambiguous）：
      // **不猜测、不静默提交**。实测危害是"聊天里是完整稿、成品被截断半篇却显示已验收"。
      // 作为阻断项走统一门禁，并由修订流把具体原因喂回模型（改用缩进或去掉内层围栏）。
      // 模型**显式声明**的那条路径不走这个判断（declaredV2 非空时边界已确定）。
      const ambiguousIssues: DeliveryIssue[] = split.v2Ambiguous && !declaredV2
        ? [
            {
              code: 'parse.ambiguous-body',
              severity: 'blocking',
              stage: 'parse',
              message:
                '正文边界无法确定：v2 正文里出现了裸的 ``` 代码围栏，与正文结束围栏同形，正文可能已被截断。' +
                '请把代码内容改为**缩进四空格**的写法（不要再用 ``` 包裹），确保正文只用开头/结尾这一对围栏，然后重新输出完整正文。',
              sourceRange: { line: 0, endLine: 0 },
              repairKind: 'reparse',
              evidence: '引擎协议里代码块用 ``` 包裹，而 v2 正文本身也用 ``` 收尾；两者同形时解析器无法判定边界。',
            },
          ]
        : []
      const matInfo: MaterializeInfo = emptyMaterializeInfo()
      let source = raw
      let html: string
      let warnings: string[]
      let composeIssues: ReturnType<typeof composeMarkdown>['issues'] = []
      let rejectedArts: ReturnType<typeof composeMarkdown>['rejectedArts'] = []

      if (v2 && needsMaterialize(v2)) {
        let matured: string
        try {
          matured = await materializePlaceholders(v2, themeDeclaration(v2), matInfo, {
            onProgress: setTask,
            ledger,
            theme: themeDeclaration(v2),
            priorBindings: priorAccepted?.bindings,
            // 本回合的素材操作声明（模型给的，见 finish_preparation.assetPolicy）。
            // preserve：模型只改文字 → 若它把 `[[asset:…]]` 退回成 `[[img:…|new]]`，
            // 在派发绘图前按文档绑定确定性恢复同一素材，**0 次绘图**（DS 指南 §5.4 / F4）。
            assetPolicy,
            snapshots: priorAccepted?.snapshots,
            // 阶段 4 第 5 条：用户已停止 → 不再派发新素材任务、不再入库
            cancelled: () => !busyRef.current,
          })
        } catch (e) {
          // 素材解析整体失败（如素材库读不出来）：按回合失败报出来并解锁输入。
          // 不能让异常逃逸成 unhandled rejection——那会留下一直在转的"AI 工作中"气泡。
          trace({ kind: 'request', runId: ledger.runId, phase: 'asset', ok: false, failure: 'unknown', error: clip(String(e), 160) })
          fail(e)
          throw e
        }
        source = matInfo.normalized || v2
        lastMaterializeRef.current = {
          v2,
          theme: themeDeclaration(v2) || '',
          ledger,
          bindings: matInfo.bindings,
          snapshots: priorAccepted?.snapshots || {},
        }
        setTask({ phase: 'compose', text: '排版与渲染素材…' })
        const r = composeMarkdown(matured, {})
        html = r.arts.length ? await renderArtPlaceholders(r.html, r.arts) : r.html
        // §6：库素材"读得出来"不等于"能用"——排版层拒收的素材位要**当场回写台账**
        // （ok → failed），必须发生在下面 `unfinished(ledger)` 之前，否则
        // "正文里其实是个空框、清单却说全部完成"。
        applyRejectedArts(ledger, r.rejectedArts, matInfo)
        warnings = [...r.warnings, ...materializeWarnings(matInfo)]
        composeIssues = r.issues
        rejectedArts = r.rejectedArts
      } else {
        const c = resolvePreview(raw)
        if (!c) return null
        setTask({ phase: 'compose', text: '排版与渲染素材…' })
        html = c.arts.length ? await renderArtPlaceholders(c.html, c.arts) : c.html
        warnings = c.warnings
        // 纯正文稿（无占位）同样要把解析类问题送进交付门禁——见 resolvePreview 的注释：
        // 漏掉这一段会让"缺组件的半成品"直接判为可提交。
        composeIssues = c.issues
        rejectedArts = c.rejectedArts
      }

      // 阶段 3 第 6 条：完成状态以**绑定与实际渲染**为准，不采信助手一句"修好了"。
      //
      // 2026-09-29：台账是**跨轮累计**的，但"必需素材"要按**本候选自己的正文**来数。
      // 否则会出现一个说不过去的死结：模型改写后那一处引用已经不在正文里了，
      // 台账里那条 `failed` 还挂着 → `unfinished()` 永远非空 → 该候选永远阻断 → 修不进去。
      // 实测就是 S14 复用样例：首稿引用了库里不存在的 `blossom`，修订稿已经改掉，
      // 却仍被判"必需素材位未完成"而退回草稿。
      // 判定口径：素材位的**身份词**（素材位原文 / 库 ID / 成品块别名 / 拒收引用词）
      // 只要还出现在本轮正文里，才算这一版的必需素材位。
      const v2ForSlots = v2 || ''
      const pending = unfinished(ledger).filter((e) =>
        identityKeysOf(e).some((k) => k.length >= 4 && v2ForSlots.includes(k)),
      )
      if (pending.length) {
        warnings = [...warnings, unfinishedWarning(pending.length)]
        setAssetIssues(pending.map((e) => ({ slotId: e.slotId, label: clip(e.desc || e.slot, 40), reason: e.reason || '素材未完成' })))
      } else {
        setAssetIssues([])
      }

      // §4：一条统一问题清单（解析 / 素材 / 栅格 / HTML / 正文完整性 + 容量与版本）
      const slots: SlotIndexEntry[] = slotIndexFromLedger(ledger)
      const requiredSlots = pending.map((e) => ({ slotId: e.slotId, slot: e.slot, done: false, reason: e.reason }))
      // 正文完整性（计划 §5.6 / DS 指南 §4.2）：
      // - **本回合第一个候选（round 0）**：不适用——没有修复前版本，本来就没有可比对象。
      //   这是明确结论，不是"没检查"，更不是"通过"（不适用时 UI/日志如实写"不适用"）。
      //   **判据是 round，不是"基准是不是空"**——用后者会把"第几个候选"与"基准建没建起来"
      //   混成同一件事，于是基准建不起来的那些回合会被永久说成"不适用"（见下方分支的说明）。
      // - **修复轮（round ≥ 1）**：必须对照**本回合首个候选冻结的事实基准**。不跟上一次成品比——
      //   用户完全可以要求整篇重写，拿历史成品当退化信号会把正常需求误判成回退。
      // - **缺基准 / 投影为空**：按"该比却比不了"处理（`failed`），由门禁补一条阻断。
      //   绝不能再用 null 同时表示"不适用""没检查""检查失败"。
      const projection = bodyText(html)
      let body: ReturnType<typeof bodyIntegrity> | null = null
      let bodyApplicability: BodyApplicability
      if (round === 0) {
        // 本回合首个候选：还没有"修复前版本"可比。这是**明确结论**（不适用），不是"没检查"，
        // 更不是"通过"。注意判据是 `round`（本回合第几个候选），**不再**是 `!baseline`——
        // 后者把"第几个候选"与"基准建没建起来"混成同一件事，实测漏洞见下一个分支。
        bodyApplicability = 'not-applicable'
      } else if (!baseline || !projection) {
        // 自动修复轮**必须**比得起来（DS 指南 §4.2）。旧写法是 `if (!baseline) not-applicable`：
        // 首候选的正文投影若为空（解析失败 / 有效空正文），`repairBaseline` 就恒为 null，
        // 于是**后续每一轮自动修复都报"不适用"**；而 `not-applicable` 在 delivery-quality 里
        // `bodyIntegrityOk` 仍是 true——等于给"该比却比不了"开了一条不阻断的放行通道
        // （独立审计 2026-09-30 记为"缺基准不闭锁"）。现在如实记 failed，由门禁补一条阻断。
        bodyApplicability = 'failed'
      } else {
        body = bodyIntegrity(baseline, projection)
        bodyApplicability = 'applied'
      }
      const htmlOk = checkHtml(html).ok
      const issues = collectDeliveryIssues({
        source: v2 ? materializedSourceFor(source) : raw,
        html,
        plainText: plainTextOf(html),
        composeIssues,
        rejectedArts,
        slots,
        material: {
          residual: matInfo.residual,
          residue: matInfo.residue,
          mismatched: matInfo.mismatched,
          errors: matInfo.errors,
          requiredSlots,
        },
        body,
        extra: ambiguousIssues,
      })
      const verdict = deliveryVerdict(issues, {
        htmlOk,
        requiredSlots,
        body,
        bodyApplicability,
        // 只声明**本轮真的喂了输入**的阶段。不再把 'version' 列进来：本轮既没传 `version` 快照
        // 也没传必需字段，`checks.version='pass'` 会是"没有输入 → 没有问题"的空结论，
        // 而且与同一对象里的 `unverified:['version']` 自相矛盾。版本一致性在落库时由 Rust 侧核验。
        // 'raster' 保留：素材各自的栅格门禁在 materialize 里已跑，结果经 material facts 流入本清单。
        stagesChecked: ['parse', 'material', 'raster', 'html', 'body', 'capacity'],
        hasAcceptedHistory: priorIsAccepted,
      })
      trace({
        kind: 'quality',
        runId: ledger.runId,
        stage: 'validation',
        attempt: round + 1,
        ok: verdict.ok,
        issueCodes: verdict.blockers.map((b) => b.code),
        blockingCount: verdict.blockers.length,
        warningCount: verdict.warnings.length,
        bodyApplicability,
        before: bodyApplicability === 'applied' ? `事实基准 ${baseline ? baseline.length : 0} 字` : undefined,
        after: body ? `缺失事实 ${body.factsMissing.length} 项` : undefined,
        note: `第 ${round + 1} 轮门禁：阻断 ${verdict.blockers.length} / 提示 ${verdict.warnings.length}；正文保留比较=${bodyApplicability}`,
      })
      return {
        round,
        source,
        draftRaw: raw,
        html,
        projection,
        warnings,
        issues,
        verdict,
        used: matInfo.used,
        bindings: matInfo.bindings,
      }
    }

    // 三类对象（DS 修复指南 §4.2）。它们的生命周期与用途**各不相同，不能互相顶替**：
    //
    //   priorAccepted                回合开始前读取的上一份完整已验收版本
    //                                → 失败后恢复 source / HTML / 绑定 / 快照，不是只留旧 HTML
    //   repairBaseline               本回合**首个候选**的可信正文投影；建立后**冻结**
    //                                → 后续自动修复必须保留的事实；不要求首稿零视觉/排版阻断
    //   previousAdmissibleCandidate  本修复链最近一个**未被退化判断否决**的候选
    //                                → 只用来判断"这一版比上一版多了什么新问题"，不得拿已被否决者
    //                                  重新定义基准，也不得靠它提升成品
    let lastCand: Candidate | null = null
    /** 修复链上最近一个未被否决的候选 */
    let prevAdmissible: Candidate | null = null
    /** 只有**完整通过门禁**的候选才可能成为成品（DS 指南 §4.4 第 6 条） */
    let acceptedCand: Candidate | null = null
    /**
     * 冻结的事实基准（首个候选的正文投影）。它在 round 0 之后**不再改变**——
     * 上一轮"只在候选零阻断时才建立基准"的写法等于让基准永远是 null（首个候选若零阻断就已退出循环），
     * 实测后果：两轮修复都拿到 `body=null`，事实保护一次都没生效，删掉日期/地点/张老师的修订稿照样成为成品。
     */
    let repairBaseline: string | null = null

    for (let round = 0; round <= MAX_AUTO_REVISES; round++) {
      // 本轮的比较对象 = **上一轮未被否决的候选**（本轮自己的结果还没出来，不能拿它跟自己比）
      const prev = prevAdmissible
      setTask({ phase: 'compose', text: '排版与质检…' })
      let cand: Candidate | null = null
      try {
        cand = await evaluate(round, draftRaw, repairBaseline, directSource)
      } catch (e) {
        // evaluate 里的素材解析整体失败已经走过 fail(e)（解锁输入、显示原因），这里只需收口：
        // 让异常**不要**逃出 turn()——否则会变成 unhandled rejection，回合永远卡在忙碌态。
        console.warn('候选渲染失败：', e)
        return
      }

      if (!cand) {
        // 无 v2（纯对话 / ```html 直通）：沿用旧预览逻辑，不进交付门禁。
        // 这类回合没有"候选/成品"之分——它本来就不是一篇推文稿。
        const final = resolvePreview(draftRaw)
        if (final) {
          const seq = ++artSeqRef.current
          const html2 = final.arts.length ? await renderArtPlaceholders(final.html, final.arts) : final.html
          if (artSeqRef.current === seq) {
            setHtml(html2)
            setQuality(checkHtml(html2))
            setWarnings(final.warnings)
          }
        }
        break
      }

      lastCand = cand
      // ① 冻结事实基准：本回合**首个候选**的正文投影，不要求它零阻断
      //    （首稿有 emoji/短篇/素材未落位都很正常，那条规则会让基准永远建不起来）
      if (round === 0) repairBaseline = cand.projection || null

      // ② 退化比较**必须早于** best 更新与任何提前退出（DS 指南 §4.4 第 4/5 条。
      //    上一轮把 `best = better(best, cand)` 写在退化检查之前，于是"更差但阻断更少"的一版
      //    会被先记成 best，退化检查再怎么拦也拦不住它成为成品）。
      //    注意：**不**把"与旧稿不同"一律当退化——片段丢失只作提示；这里只拦
      //    新增阻断项与事实缺失（后者的基准是**冻结的首稿**，不是上一轮候选）。
      if (prev) {
        const prevCodes = new Set(prev.verdict.blockers.map((b) => b.code))
        const newCodes = cand.verdict.blockers.map((b) => b.code).filter((c) => !prevCodes.has(c))
        const factsLost = cand.verdict.blockers.some((b) => b.code === 'body.fact-lost')
        if (newCodes.length > 0 || factsLost) {
          stopReason = 'regressed'
          trace({
            kind: 'note',
            runId: ledger.runId,
            stage: 'rollback',
            attempt: round + 1,
            ok: false,
            stopReason: 'regressed',
            issueCodes: newCodes,
            bodyApplicability: cand.verdict.gate.bodyApplicability,
            before: `第 ${prev.round + 1} 轮：阻断 ${prev.verdict.blockers.length}`,
            after: `第 ${round + 1} 轮：阻断 ${cand.verdict.blockers.length}${newCodes.length ? '（新增 ' + newCodes.join('/') + '）' : ''}${factsLost ? '（正文事实丢失）' : ''}`,
            note: '修复候选出现退化，已撤销该候选；它只进失败草稿与诊断，不更新基准、不参与成品选择',
          })
          break
        }
      }

      // 用户停止优先于一切——**必须排在"接受"之前**。
      // 旧顺序把接受分支放在这里之前：停止若恰好落在"流已结束、这一轮 evaluate 刚好跑完"之间，
      // `busyRef` 已经为 false 却仍会把这份候选提升成成品、显示"成品已验收并保存"。
      // 用户按了停止却说本轮已更新，是最不该出现的那种误导。
      if (!busyRef.current) {
        aborted = true
        stopReason = 'cancelled'
        break
      }

      // ④ 完整通过门禁 → 直接进入持久化提交（计划 §5 第 3 条）。提示级问题不触发重写。
      if (cand.verdict.ok) {
        acceptedCand = cand
        const seq = ++artSeqRef.current
        if (artSeqRef.current === seq) {
          setHtml(cand.html)
          setQuality(checkHtml(cand.html))
          setWarnings(cand.warnings)
        }
        break
      }

      const pendingFix = pendingFixables(cand.verdict)

      // 预算用尽：末轮同样先做完了退化比较（上面 ②），不会"先被 atCap 跳过"
      const atCap = round === MAX_AUTO_REVISES
      if (atCap) {
        stopReason = 'budget'
        break
      }

      // 无进展（§5.6 末句）：同一批问题**在同一位置**反复出现**且整个候选也没变** → 提前结束，避免空转。
      // 两项判据都必须到位（DS 指南 §4.2 末段）：
      //   · 问题用**位置级指纹**（stage/slot/节点/源文行号），只比 code 会把"同类问题换了位置"
      //     误判成没进展；
      //   · 内容用**完整候选指纹**（渲染后 HTML，含素材 SVG 与样式 + 源文长度），只比正文投影
      //     会把"素材重画了 / 样式改了"的真实进展当成零（正文投影本来就会剔掉 SVG 与样式）。
      if (
        prev &&
        sameIssueFingerprints(prev.verdict.blockers, cand.verdict.blockers) &&
        candidateFingerprint(prev) === candidateFingerprint(cand)
      ) {
        stopReason = 'no-progress'
        trace({ kind: 'note', runId: ledger.runId, stage: 'repair', attempt: round + 1, ok: false, stopReason: 'no-progress', issueCodes: cand.verdict.blockers.map((b) => b.code), before: `第 ${prev.round + 1} 轮`, after: `第 ${round + 1} 轮（问题指纹与候选内容指纹都一致）`, note: '同一批问题反复出现且整个候选未变，提前结束' })
        break
      }

      if (!pendingFix.length) {
        stopReason = 'unrepairable'
        trace({ kind: 'note', runId: ledger.runId, stage: 'repair', attempt: round + 1, ok: false, stopReason: 'unrepairable', issueCodes: cand.verdict.blockers.map((b) => b.code), note: '剩余问题没有任何可由改写法修复的项（多为素材侧或版本侧）' })
        break
      }

      // 到这里该候选**未被否决**：它成为下一轮的比较对象。
      // 放在这里而不是循环开头，是因为循环开头 `prev` 取的就是它——若在同一次迭代里就把它写进去，
      // "新增阻断项 / 无进展"两条检查会拿本轮的结果和它自己比，结果恒真（实测：首轮就被判 no-progress 直接收摊）。
      prevAdmissible = cand

      // 模型修订一版：保留上一版预览（只清空气泡草稿）→ 问题清单喂回 → 重写流。
      setDeliveryState({ kind: 'repairing', attempt: round + 1 })
      setDeliveryVerdictState(cand.verdict)
      const fixText = pendingFix.map((i) => i.message)
      const blocking = cand.verdict.blockers.length
      setTask({
        phase: 'revise',
        text:
          fixText.length === 1
            ? `发现 1 个阻断问题，正在重写：${fixText[0].slice(0, 20)}…`
            : `发现 ${blocking} 个阻断问题，正在重写正文…`,
      })
      trace({
        kind: 'note',
        runId: ledger.runId,
        stage: 'repair',
        attempt: round + 1,
        ok: true,
        issueCodes: pendingFix.map((i) => i.code),
        blockingCount: blocking,
        warningCount: cand.verdict.warnings.length,
        before: `阻断 ${blocking} / 提示 ${cand.verdict.warnings.length}`,
        note: `自动修订第 ${round + 1} 轮，目标 ${pendingFix.length} 条`,
      })
      draftRef.current = ''
      // 修订流用独立标签：首个 token 到达时切到「自动修订」，不显示成「撰写正文」
      writePhaseRef.current = 'revise'
      awaitingTokenRef.current = true
      updateAssistant('')
      const revise = buildReviseContent(cand.source, fixText)
      try {
        if (inTauri()) {
          // 阶段 4 第 6 条：自动修订显式走 revise 档（high / 32000），不再沿用撰写的 max 档。
          await sendChatRust([...streamMsgs, { role: 'user', content: revise }], 'revise', ledger.runId)
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
          stopReason = 'cancelled'
          break
        }
        fail(err)
        return
      }
      stopRef.current = null
      if (!busyRef.current) {
        aborted = true
        stopReason = 'cancelled'
        break
      }
      // 注意：这里**不**把本轮的 `cand` 再赋值给 prevAdmissible——
      // 它就是在循环开头已经赋过的同一个对象（`prevAdmissible = cand`）。
      // 旧实现在末尾又赋一次 `prevCand = cand`，配合"循环开头取的是上一轮的 prevCand"，
      // 实际比较的是"上上轮 vs 本轮"，把紧接着的两轮对比漏掉了。
      draftRaw = collapseAssistantDraft(draftRef.current)
    }
    awaitingTokenRef.current = false
    // ---- 交付：提交成品 / 保留草稿 / 明确回滚（计划 §5.7、§7、§8） ----
    // **只有完整通过门禁的候选**才可能是成品（DS 指南 §4.4 第 6 条）：不再从"阻断最少"的一版里挑，
    // 也不再看告警条数。`acceptedCand` 在循环里只在 `verdict.ok` 时被赋值，其余一律不进成品。
    const accepted = acceptedCand
    const draft = lastCand
    // 预览该显示哪一版：成品优先；没有可提交成品时，有已验收历史就显示上一版成品（并说清），
    // 否则显示本次草稿并标明"未通过"——**不制造"已回滚"的结论**（§5.7 末句）。
    const shown = accepted ? accepted : priorIsAccepted && priorAccepted?.html ? null : draft
    const docState: DocDisplayState = accepted
      ? // `saved: false` 是刻意的（DS 指南 §5.3）：此刻只完成了**门禁验收**，落库还没开始。
        // 界面据它在落库前说"已验收、写入尚未确认"，而不是抢先说"已保存"。
        { kind: 'accepted', saved: false }
      : priorIsAccepted
        ? { kind: 'restored' }
        : { kind: 'draft-failed', blockers: draft ? draft.verdict.blockers.length : 0 }
    if (shown) {
      const seq = ++artSeqRef.current
      if (artSeqRef.current === seq) {
        setHtml(shown.html)
        setQuality(checkHtml(shown.html))
        setWarnings(shown.warnings)
      }
    } else if (priorAccepted?.html) {
      // 回滚展示：预览固定为上一份已验收成品。**必须**同时说清这不是本次的新稿。
      const seq = ++artSeqRef.current
      if (artSeqRef.current === seq) {
        setHtml(priorAccepted.html)
        setQuality(checkHtml(priorAccepted.html))
        setWarnings([
          ...(priorAccepted.warnings || []),
          '本次草稿未通过交付门禁，预览是上一版已验收成品（本次结果已作为草稿保存，可在预览区按草稿导出取回）。',
        ])
      }
    }
    setDeliveryState(docState)
    setDeliveryVerdictState(accepted ? accepted.verdict : draft ? draft.verdict : null)
    // 草稿取回入口的原料：只有"本次有候选但没通过门禁"时才给（通过了就无所谓草稿）。
    setDraftHtml(!accepted && draft ? draft.html : null)
    if (stopReason !== 'none') {
      trace({ kind: 'run', runId: ledger.runId, stage: 'rollback', ok: false, stopReason, note: `交付未通过：${stopReason}` })
    }

    // 保存阶段（用户 2026-09-28 确认）：落库期间气泡停在「保存文档」，完成后才解锁输入。
    // 好处是界面上看得见"成稿已进文档库"，也避免"用户已能发下一条、文档还在写"的竞态。
    try {
      if (currentId && !aborted) {
        // flushSync 强制同步提交：否则 React 会把「保存」和紧随其后的「结束」并成一次渲染，
        // 这帧状态永远到不了 DOM，用户看不到"成稿已进文档库"。
        flushSync(() => setTask({ phase: 'save', text: '保存到文档库…' }))
        // 再让出一帧，保证这帧真的被绘制（桌面端落库要走 Tauri invoke，本来就会跨多帧）。
        // 必须带超时兜底：窗口最小化/隐藏时浏览器不派发 requestAnimationFrame，
        // 只等 rAF 会让回合永远卡在「保存文档」上。
        await new Promise((resolve) => {
          const done = () => resolve(null)
          const timer = window.setTimeout(done, 120)
          window.requestAnimationFrame(() => {
            window.clearTimeout(timer)
            done()
          })
        })
        // 会话里的助手文字：**永远保存模型最新的文字**（用户内容一个字都不丢）。
        const draftRaw2 = draft ? draft.draftRaw : collapseAssistantDraft(draftRaw)
        const saveMsgs: DisplayMsg[] = [...history, userMsg, { id: idSeq - 1, role: 'assistant', content: draftRaw2 }]
        persistNow(currentId, saveMsgs)
        // V3-R1：终稿默认自动保存为文档（source 真源 + html 快照）；会话内更新就地刷新同一份文档
        // V3-R3：同时固化本轮实际复用的库素材（{svg, ver}）——改库素材不会静默改变老文档
        //
        // 2026-09-29（计划 §7）：**source 与 html 必须来自同一个候选**。
        // 这里曾经把"最新候选的原文"配上"已验收候选的 HTML"存进同一版——正是计划点名禁止的
        // "新源文配旧 HTML"的混合版本：回滚时源文/正文对不上，重开也复现不出那一版。
        // 现在的口径：成品存成品那一版的配对内容；若最新候选与成品不是同一版，
        // 先把最新文字**另存为草稿版**（asDraft，不动成品指针），再提交成品。
        const latest = draft
        const acceptedSrc = accepted
        if (acceptedSrc) {
          // 最新候选 != 成品 → 它的文字（用户/模型的最新产出）单独留一版草稿
          if (latest && latest !== acceptedSrc) {
            const latestSnaps = await snapshotsOfUsed(latest.used, priorAccepted?.snapshots)
            const draftSaved = await persistDoc(currentId, latest.source, latest.html, latest.warnings, latestSnaps, latest.bindings, {
              accepted: false,
              baseRevisionId: priorAccepted?.revisionId ?? undefined,
              runId: ledger.runId,
              quality: latest.verdict,
              validationVersion: VALIDATION_VERSION,
            })
            // 与相邻的成品/草稿分支同一口径：`persistDoc` 失败返回 null，**不能**照样记 ok:true。
            // 旧写法把返回值丢掉却写"已另存为草稿版"，落盘失败时日志仍在声称存下来了。
            trace({
              kind: 'note',
              runId: ledger.runId,
              stage: 'persist',
              ok: Boolean(draftSaved),
              revisionId: draftSaved?.revisionId ?? undefined,
              baseRevisionId: priorAccepted?.revisionId ?? undefined,
              note: draftSaved
                ? '最新候选未通过门禁，已另存为草稿版（成品指针不变）'
                : '最新候选未通过门禁，且草稿版未能写入（磁盘不可写或权限不足）',
            })
          }
          const snaps = await snapshotsOfUsed(acceptedSrc.used, priorAccepted?.snapshots)
          const saved = await persistDoc(currentId, acceptedSrc.source, acceptedSrc.html, acceptedSrc.warnings, snaps, acceptedSrc.bindings, {
            accepted: true,
            // 基准版本 = 打开文档时读到的成品版本：提交前 Rust 会拿它做 CAS，
            // 旧请求因此不可能覆盖用户较新的提交（计划 §7.2 第 4 条）。
            baseRevisionId: priorAccepted?.revisionId ?? undefined,
            runId: ledger.runId,
            quality: acceptedSrc.verdict,
            validationVersion: VALIDATION_VERSION,
          })
          // saveDocument 失败时返回 null（内部吞异常）——必须当成失败抛出来，否则界面看不见
          if (!saved) throw new Error('文档库没有确认写入（磁盘不可写或权限不足）')
          // 落库确认成功：清掉上一次的失败提示，避免它一直挂着
          setSaveError(null)
          // **读回确认**（DS 指南 §5.3 末段）："应用「已保存」只来自本轮成功提交回执与读回"。
          // 回执说明 Rust 接受了这次提交；读回说明它确实能被读出来、且就是本轮那一版。
          // 读回失败/版本对不上时**不翻成"已保存"**——宁可让提示条说"写入未被确认"，
          // 也不能凭一个返回值让用户以为成品已经落盘（保存失败却显示成功是最坏的误导）。
          const readBack = await openDocumentSafe(currentId)
          const confirmRev = saved.revisionId ?? ''
          const readBackOk = readBack.ok && (!confirmRev || readBack.doc.revisionId === confirmRev)
          if (!readBackOk) {
            setSaveError(
              readBack.ok
                ? `写入回执与读回不一致（回执 ${confirmRev || '未返回版本号'}，读回 ${readBack.doc.revisionId || '未知'}）：本轮已通过门禁，但落盘结果未被确认。`
                : `写入后读回失败：${errSummary(readBack.error)}。本轮已通过门禁，但落盘结果未被确认。`,
            )
          }
          // 只有拿到回执**且**读回一致，才把「已保存」这一句放出去
          setDeliveryState({ kind: 'accepted', revisionId: confirmRev || undefined, saved: readBackOk })
          trace({
            kind: 'run',
            runId: ledger.runId,
            stage: 'commit',
            ok: readBackOk,
            revisionId: saved.revisionId ?? undefined,
            baseRevisionId: priorAccepted?.revisionId ?? undefined,
            stopReason,
            note: readBackOk ? '成品已验收并保存（含读回确认）' : '成品已验收，但落盘结果未被读回确认',
          })
        } else if (latest) {
          // 没有任何候选通过门禁：**存为草稿**（asDraft，不动已验收成品指针）。
          // 磁盘保存成功只说明"草稿存下来了"，交付仍然没成——两件事在这里分开记（计划 §8）。
          const snaps = await snapshotsOfUsed(latest.used, priorAccepted?.snapshots)
          const saved = await persistDoc(currentId, latest.source, latest.html, latest.warnings, snaps, latest.bindings, {
            accepted: false,
            baseRevisionId: priorAccepted?.revisionId ?? undefined,
            runId: ledger.runId,
            quality: latest.verdict,
            validationVersion: VALIDATION_VERSION,
          })
          if (!saved) throw new Error('文档库没有确认写入（磁盘不可写或权限不足）')
          setSaveError(null)
          trace({
            kind: 'run',
            runId: ledger.runId,
            stage: 'persist',
            ok: true,
            revisionId: saved.revisionId ?? undefined,
            baseRevisionId: priorAccepted?.revisionId ?? undefined,
            stopReason,
            note: priorIsAccepted
              ? '本次草稿未通过，成品维持上一份已验收版本（草稿已保存）'
              : '草稿未通过，无已验收历史可回滚（草稿已保存）',
          })
        }
      }
    } catch (e) {
      // 保存失败不阻断会话：控制台留线索（不删），**同时**在预览区给出看得见的失败提示——
      // 否则用户会以为稿子已经存好了（REQUIREMENTS：「保存失败只在控制台提示」）。
      console.warn('终稿保存失败：', e)
      setSaveError(`保存失败：${errSummary(e)}。正文仍在编辑器里，可再次发送或稍后重试。`)
      trace({ kind: 'note', runId: ledger.runId, stage: 'persist', ok: false, failure: 'unknown', error: clip(String(e), 160), note: '终稿保存失败' })
    } finally {
      setTask(null)
      setTurnStartedAt(null)
      busyRef.current = false
      setBusy(false)
    }
  }

  // 发送：直通统一回合，不设任何对话状态机（澄清与否由模型自主判断）
  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busyRef.current) return
    const imgs = attached
    setAttached([])
    await turn(t, imgs)
  }

  // 停止：既停前端的显示，也**真的让后端停下来**（阶段 4 第 5 条）。
  // 后端返回的迟到增量靠 runId 过滤丢弃；已取消回合的结果不会被再写入文档。
  const stop = () => {
    stopRef.current?.cancel()
    stopRef.current = null
    const rid = runIdRef.current
    if (rid) {
      void cancelChatRun(rid)
      trace({ kind: 'note', runId: rid, phase: 'turn', ok: false, failure: 'cancel', note: '用户停止' })
    }
    busyRef.current = false
    setBusy(false)
    awaitingTokenRef.current = false
    setTask(null)
    setTurnStartedAt(null)
    setRetrying(false)
  }

  /**
   * 单项重试（阶段 3 第 6 条；计划 §6 第五/六条）：用户对某个未完成的素材位点"重试"。
   * 就地重跑一次素材解析——只给这一个素材位重置预算（台账里其余结论不变）。
   *
   * 关键（计划 §6 原文）：**重试后仍走整稿门禁与版本提交**，不能借这个入口绕过检查——
   * 所以这里跑的是与 turn() 同一套 `collectDeliveryIssues` + `deliveryVerdict`，
   * 通过就提交为成品，不通过就只推进草稿指针。**不是**对话回合、不碰对话流程（铁律 6）。
   *
   * 另外：这是**用户显式发起的尝试**（`retrySlotIds`），自动流程不会走到这里——
   * 自动修订永远不能冒充用户重试来重置预算（§6 末条）。
   */
  const retryAsset = async (slotId: string) => {
    const ctx = lastMaterializeRef.current
    if (!ctx || busyRef.current || !currentId) return
    // **先冻结正文与文档身份**（DS 指南 §4.2），再去碰素材。
    // 冻结的是"用户点重试那一刻预览里那一版"——它就是本次的正文保留基准；
    // 处理素材期间 preview 可能被更新，读 state 会拿到已经被换过的那一版，基准就不再是"重试前"。
    const frozenHtml = html
    const frozenDocId = currentId
    const frozenRunId = ctx.ledger.runId
    busyRef.current = true
    setBusy(true)
    setRetrying(true)
    setTurnStartedAt(Date.now())
    setTask({ phase: 'asset', text: '重新尝试该素材位…' })
    // 用户可能刚按过停止：先清除该回合的取消状态，否则这次重试会被上一轮信号立刻打断。
    const wasCancelled = await cancelChatRun(ctx.ledger.runId, true)
    if (wasCancelled) {
      trace({ kind: 'note', runId: ctx.ledger.runId, phase: 'asset', ok: true, note: '重试前清除上一轮的取消状态' })
    }
    try {
      const inf = emptyMaterializeInfo()
      const matured = await materializePlaceholders(ctx.v2, ctx.theme, inf, {
        onProgress: setTask,
        ledger: ctx.ledger,
        theme: ctx.theme,
        persist: inTauri(),
        retrySlotIds: [slotId],
        cancelled: () => !busyRef.current,
      })
      setTask({ phase: 'compose', text: '排版与渲染素材…' })
      const r = composeMarkdown(matured, {})
      const html2 = r.arts.length ? await renderArtPlaceholders(r.html, r.arts) : r.html
      // 与 turn() 同一口径：排版层拒收也要回写台账（重试路径不得绕过）
      applyRejectedArts(ctx.ledger, r.rejectedArts, inf)
      // 与 turn() **同一口径**：台账是跨轮累计的，"必需素材位"要按**本候选自己的正文**来数。
      // 否则会出现一个说不通的死结：模型上一轮已经把某处引用从正文里删掉了，台账里那条 failed
      // 还挂着 → `unfinished()` 里带着一个正文里根本不存在的素材位 → `requiredSlotsDone=false`
      // → 重试成功了也判"仍有素材未完成"，界面上还给一个点了**没有任何变化**的重试按钮
      // （该行已不在 `ctx.v2` 里，`applyRetry` 不会执行）。
      const pending = unfinished(ctx.ledger).filter(
        (e) => identityKeysOf(e).some((k) => k.length >= 4 && ctx.v2.includes(k)),
      )
      const warns = [...r.warnings, ...materializeWarnings(inf)]
      if (pending.length) warns.push(unfinishedWarning(pending.length))

      // 与 turn() 同一套门禁：重试成功也不代表可以提交，必须整稿通过。
      //
      // **顺序**（DS 指南 §4.2）：「先冻结正文与文档身份，再处理素材；通过事实比较、门禁、取消及
      // 版本校验后才能提升正式预览 / 素材上下文 / 提交指针」。
      // 旧实现把 `setHtml/setQuality/setWarnings` 与 `lastMaterializeRef.current` 放在门禁**之前**，
      // 于是"重试失败"也会把正式预览与素材上下文换掉——用户会以为这一版已经生效了。
      // 现在：**先算门禁 → 再决定提升什么**。这一版仍作为**临时预览**显示（用户刚点的，得看得见），
      // 但它的"未验收"身份由 `setDeliveryVerdictState` 如实标出，且**不**冒充正式版：
      // 素材上下文只在真的通过门禁后才更新。
      const requiredSlots = pending.map((e) => ({ slotId: e.slotId, slot: e.slot, done: false, reason: e.reason }))
      // 单项重试**没有新的正文修改授权**（DS 指南 §4.2 情境表末行）：必须保留现有正文事实。
      // 做法是拿"重试前预览里的正文投影"当基准比一次——素材重渲染只该换素材，不该动一个字。
      // 这里刻意用**调用前就冻结好的** `frozenHtml`，而不是 `html`：重试中途可能已经发生过
      // `setHtml`，读 state 会拿到"本轮已经换过的那一版"，基准就跟着变了。
      const beforeText = frozenHtml ? bodyText(frozenHtml) : ''
      const afterText = bodyText(html2)
      // 单项重试**必须**比得起来：拿不到任一侧投影就是"该比却比不了"，如实记 failed
      // （门禁会补一条 `body.unverified` 阻断）。旧写法退回 `not-applicable`，
      // 而 not-applicable 在 delivery-quality 里 `bodyIntegrityOk` 仍为 true——那是条不阻断的放行通道。
      const body = beforeText && afterText ? bodyIntegrity(beforeText, afterText) : null
      const bodyApplicability: BodyApplicability = beforeText && afterText ? 'applied' : 'failed'
      const issues = collectDeliveryIssues({
        source: matured,
        html: html2,
        plainText: plainTextOf(html2),
        composeIssues: r.issues,
        rejectedArts: r.rejectedArts,
        slots: slotIndexFromLedger(ctx.ledger),
        material: {
          residual: inf.residual,
          residue: inf.residue,
          mismatched: inf.mismatched,
          errors: inf.errors,
          requiredSlots,
        },
        body,
      })
      const priorR2 = await openDocumentSafe(currentId)
      const prior2 = priorR2.ok ? priorR2.doc : null
      const verdict = deliveryVerdict(issues, {
        htmlOk: checkHtml(html2).ok,
        requiredSlots,
        body,
        bodyApplicability,
        // 与 turn() 同一口径地声明**本轮实际查过哪些阶段**。不传会让 `checks` 全表按
        // `!checked.size` 分支一律记 pass——那是"没有输入 → 没有问题"的空结论，
        // 会把 raster/version 这些本轮根本没跑的阶段显示成已通过。
        // 只声明**本轮真的喂了输入**的阶段。不再把 'version' 列进来：本轮既没传 `version` 快照
        // 也没传必需字段，`checks.version='pass'` 会是"没有输入 → 没有问题"的空结论，
        // 而且与同一对象里的 `unverified:['version']` 自相矛盾。版本一致性在落库时由 Rust 侧核验。
        // 'raster' 保留：素材各自的栅格门禁在 materialize 里已跑，结果经 material facts 流入本清单。
        stagesChecked: ['parse', 'material', 'raster', 'html', 'body', 'capacity'],
        hasAcceptedHistory: isAcceptedDoc(prior2),
      })
      setDeliveryVerdictState(verdict)
      trace({
        kind: 'quality',
        runId: ctx.ledger.runId,
        stage: 'validation',
        slotId,
        ok: verdict.ok,
        issueCodes: verdict.blockers.map((b) => b.code),
        blockingCount: verdict.blockers.length,
        bodyApplicability,
        note: `单项重试后门禁：阻断 ${verdict.blockers.length}；正文保留比较=${bodyApplicability}`,
      })
      // 用户在重试过程中按了停止：**不再落库**，预览也不提升。
      // 素材位被取消时走的是 `drop`（该行从 matured 里消失），照常 persist 会留下一份
      // "比正文少一行素材引用"的草稿——那不是用户要的结果，也不该被当成一次重试的产物。
      if (!busyRef.current) {
        trace({ kind: 'run', runId: ctx.ledger.runId, stage: 'rollback', slotId, ok: false, stopReason: 'cancelled', note: '单项重试被停止，未写入文档库' })
        return
      }
      // 到这里才算"比较 + 门禁 + 取消"都过了，可以提升预览。
      // 这一版无论通过与否都要让用户看见（是他刚点的重试），但**只有通过门禁才算正式版**：
      //   · 不通过时仍显示它，同时 `setDeliveryVerdictState(verdict)` 已把它标成未验收（四态标识）；
      //   · `lastMaterializeRef.current`（**素材上下文**）只在通过时才更新——否则一次失败的重试
      //     会悄悄把后续重试的基准换成失败那一版的素材绑定（DS 指南 §4.2："不能冒充正式版"）。
      const seq = ++artSeqRef.current
      if (artSeqRef.current === seq) {
        setHtml(html2)
        setQuality(checkHtml(html2))
        setWarnings(warns)
      }
      setAssetIssues(
        pending.map((e) => ({ slotId: e.slotId, label: clip(e.desc || e.slot, 40), reason: e.reason || '素材未完成' })),
      )
      if (verdict.ok) lastMaterializeRef.current = { ...ctx, bindings: inf.bindings }
      const snaps = await snapshotsOfUsed(inf.used, ctx.snapshots)
      const src = splitAssistant(ctx.v2)
      const draftText = src.v2 || ctx.v2
      // 运行身份复核（DS 指南 §5.1）：素材处理期间用户可能已经切了文档或开了新回合。
      // 迟到结果**只能**落回它出发时那个文档，不能悄悄提交到用户后来打开的那一版上。
      const identityOk = currentId === frozenDocId && busyRef.current
      if (!identityOk) {
        trace({
          kind: 'run',
          runId: frozenRunId,
          stage: 'rollback',
          slotId,
          ok: false,
          stopReason: 'cancelled',
          note: '单项重试期间运行身份已变化（切换文档 / 已开始新回合），本轮结果不提交',
        })
        return
      }
      const saved = await persistDoc(currentId, draftText, html2, warns, snaps, inf.bindings, {
        accepted: verdict.ok,
        baseRevisionId: prior2?.revisionId ?? undefined,
        runId: ctx.ledger.runId,
        quality: verdict,
        validationVersion: VALIDATION_VERSION,
      })
      if (!saved) {
        setSaveError('重试结果未能写入文档库（磁盘不可写或权限不足）；预览已更新，可稍后重试。')
      } else {
        setSaveError(null)
        setDeliveryState(
          verdict.ok
            ? { kind: 'accepted', revisionId: saved.revisionId ?? undefined, saved: true }
            : { kind: 'draft-failed', blockers: verdict.blockers.length },
        )
        setDraftHtml(verdict.ok ? null : html2)
      }
      trace({
        kind: 'run',
        runId: ctx.ledger.runId,
        stage: 'commit',
        slotId,
        ok: verdict.ok,
        revisionId: saved?.revisionId ?? undefined,
        note: verdict.ok ? '单项重试后整稿通过，已提交为成品' : '单项重试后仍未通过，仅更新草稿',
      })
    } catch (e) {
      // 重试失败也不静默：控制台留线索（不删），同时把失败原因挂到预览区的提示条上
      // （成功重试时上面的 setWarnings 会整条替换，这条提示自然消失）。
      console.warn('素材重试失败：', e)
      setWarnings((prev) => [...prev, `素材重试失败：${errSummary(e)}。预览无变化，可稍后再点「重试」。`])
    } finally {
      setTask(null)
      setTurnStartedAt(null)
      setRetrying(false)
      busyRef.current = false
      setBusy(false)
    }
  }

  // P2（2026-09-24 调查 §6）：预览里点选一个组件 → 往对话输入框插一段文本锚点，
  // 用户补上"改成…"再发送。全程无前端状态、不自动发送、不参与路由（铁律 6）。
  const pickComponent = (label: string) => {
    chatRef.current?.insertRef(`针对${label}：`)
  }

  // ---------- 会话操作 ----------
  const newSession = async () => {
    if (busyRef.current) return
    const id = await createSession()
    if (!id) {
      // 没建出来就别说建好了（也不切换当前会话）
      setNotice('新建会话失败：未能写入本机，请重试。')
      return
    }
    clearAllChat()
    setCurrentId(id)
    refreshItems()
  }

  const switchSession = async (id: string) => {
    if (busyRef.current || id === currentId) return
    if (currentId) persistNow(currentId, msgsRef.current)
    const item = await openSession(id)
    if (!item.ok) {
      // 读不出来就留在原会话，只提示（不切过去看一个空白界面）
      console.warn('打开会话失败：', item.error)
      setNotice(`打开会话失败：${item.error}`)
      return
    }
    clearAllChat()
    await applySession(item.item)
    setCurrentId(id)
    refreshItems()
  }

  const removeSession = async (id: string) => {
    // V3-R1：删除会话连带删除其默认文档（文档 id == 会话 id，避免残留"幽灵文档"）
    const docOk = await deleteDocument(id)
    if (!docOk) console.warn('删除文档失败（会话删除继续）：', id)
    refreshDocs()
    const r = await deleteSession(id)
    if (!r.ok) {
      // 删除失败：**只提示**——不清空会话栏、不清当前对话、不新建会话。
      // 旧实现会 setSessionItems([]) 并 clearAllChat()，点一次删除看起来像"所有会话都被删了"。
      console.warn('删除会话失败：', r.error)
      setNotice(`删除会话失败：${r.error}`)
      return
    }
    setSessionItems(r.list.items)
    setSessionUnreadable(r.list.unreadable)
    setSessionStateWarning(r.list.stateWarning)
    if (r.list.current && r.list.current !== currentId) {
      const item = await openSession(r.list.current)
      clearAllChat()
      if (!item.ok) {
        console.warn('打开会话失败：', item.error)
        setNotice(`打开会话失败：${item.error}`)
      } else {
        await applySession(item.item)
      }
      setCurrentId(r.list.current)
    } else if (!r.list.current) {
      clearAllChat()
      const nid = await createSession()
      if (!nid) {
        setNotice('新建会话失败：未能写入本机，请重试。')
        setCurrentId(null)
        return
      }
      setCurrentId(nid)
    }
    refreshItems()
  }

  // 改名（会话栏双击标题触发）：只改标题，成功后才刷新列表；失败就说清楚没写进去。
  // 纯交互，不参与对话流程（铁律 6）。
  const applyRename = (id: string, title: string) => {
    void renameSession(id, title).then((ok) => {
      if (!ok) {
        console.warn('会话改名失败：未能写入本机', id)
        setNotice('会话改名失败：未能写入本机，请重试。')
        return
      }
      refreshItems()
    })
  }

  // 清空 = 清空当前会话内容（保留会话，标题回到默认）；其文档一并移除（无产物不留在文档库）
  const clear = () => {
    if (busyRef.current) return
    clearAllChat()
    if (currentId) {
      void deleteDocument(currentId).then((ok) => {
        if (!ok) console.warn('清空时删除文档失败：', currentId)
      })
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
      {/* 一次性失败提示条（删除/新建/打开会话失败、存档失败等）：只在真的失败时出现。
          纯展示，不参与对话流程（铁律 6）；用户可关闭。
          样式类 .app-notice 由 App.css 提供（不在本轮改动范围内，已记入 PROGRESS）。 */}
      {notice && (
        <div className="app-notice" data-notice="1">
          <span className="app-notice-text">{notice}</span>
          <button className="mini app-notice-close" onClick={() => setNotice(null)}>
            关闭
          </button>
        </div>
      )}
      {view === 'chat' ? (
        <main className={`workspace ${railOpen ? 'rail-on' : 'rail-off'}`}>
          {railOpen && (
            <SessionRail
              items={sessionItems}
              currentId={currentId}
              error={sessionError}
              unreadable={sessionUnreadable}
              stateWarning={sessionStateWarning}
              onRetry={() => void loadSessions()}
              onNew={() => void newSession()}
              onOpen={(id) => void switchSession(id)}
              onDelete={(id) => void removeSession(id)}
              onRename={applyRename}
            />
          )}
          <ChatPane
            apiRef={chatRef}
            msgs={msgs}
            busy={busy}
            onSend={(t) => void send(t)}
            onStop={stop}
            status={status}
            task={task}
            turnStartedAt={turnStartedAt}
            images={attached}
            onAttachImages={(urls) => setAttached((prev) => [...prev, ...urls].slice(0, 4))}
            onRemoveImage={(i) => setAttached((prev) => prev.filter((_, k) => k !== i))}
          />
          <PreviewPane
            html={html}
            quality={quality}
            warnings={warnings}
            assetIssues={assetIssues}
            retrying={retrying}
            onRetryAsset={(id) => void retryAsset(id)}
            onClear={clear}
            onPickComponent={pickComponent}
            saveError={saveError}
            busy={busy}
            docState={deliveryState}
            verdict={deliveryVerdictState}
            exportIsDraft={deliveryState?.kind === 'draft-failed'}
            draftHtml={draftHtml}
          />
        </main>
      ) : view === 'docs' ? (
        <main className="workspace docs-workspace">
          <DocsPane
            items={docItems}
            error={docsError}
            unreadable={docsUnreadable}
            onRetry={refreshDocs}
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
