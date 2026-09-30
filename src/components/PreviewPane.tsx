import { useCallback, useRef, useState } from 'react'
import type { QualityResult } from '../lib/quality.ts'
import type { DeliveryIssue, DeliveryVerdict } from '../lib/delivery-quality.ts'
import { exportHtml } from '../lib/exportHtml.ts'
import { exportArticleImages } from '../lib/exportImages.ts'
import { HOVER_CLASS, blockRefLabel, ensureHoverStyle, nearestBlock } from '../lib/preview-pick.ts'
import { neutralizeExternalResources } from '../lib/preview-safe.ts'

export interface AssetIssue {
  slotId: string
  label: string
  reason: string
}

/**
 * 预览区展示的文档状态（质量恢复计划 §8 第一条）。四种状态一一对应计划里的四种结论。
 *
 * **纯展示输入**（项目铁律 6，永久有效）：由上层按统一交付判定置入，本组件只负责把它说清楚，
 * 不得因 `kind === 'draft-failed'` 之类的取值去触发导出、澄清、路由或任何别的行为。
 */
export type DocDisplayState =
  | {
      kind: 'accepted'
      revisionId?: string
      /**
       * 本轮**成功提交回执 + 读回**是否已经拿到（DS 指南 §5.3 末段：
       * 「应用「已保存」只来自本轮成功提交回执与读回」）。
       *
       * 为什么要有它：`accepted` 是**交付门禁**的结论（稿子合格），**不是**磁盘写入的结论。
       * 上层在走落库之前就要把状态置成 accepted 好让用户看见"验收通过"，但那时"已保存"还没发生——
       * 旧文案把两件事说成一句「成品已验收并保存」，于是保存失败时界面仍在报告"已保存"。
       * `false` = 已验收、写入结果尚未确认（或已失败，失败原因另由保存提示条给出）；
       * `true` / 缺省 = 已拿到回执（缺省是为兼容既有调用方与既有断言）。
       */
      saved?: boolean
    }
  | { kind: 'restored'; revisionId?: string } // 已恢复上一版成品（本候选被撤销）
  | { kind: 'draft-failed'; blockers: number } // 草稿未通过
  | { kind: 'repairing'; attempt: number } // 修复中

/**
 * 四种状态的用户可见文案。`draft: true` 表示"现在预览里这份**不是**已验收成品"——
 * 必须显式写出来，否则用户会把聊天里刚出现的新稿误读成"正式成品已经更新了"（§8 第二条）。
 */
const DOC_STATE_TEXT: Record<DocDisplayState['kind'], { label: string; detail: string; draft: boolean }> = {
  accepted: {
    label: '成品已验收并保存',
    detail: '下方预览显示的是已验收成品；导出与复制取回的也是这一版。',
    draft: false,
  },
  restored: {
    label: '已恢复上一版成品',
    detail:
      '本轮候选未通过、已撤销：下方预览仍是上一版已验收成品，聊天里刚出现的新稿没有生效、也没有替换正式成品。',
    draft: false,
  },
  'draft-failed': {
    label: '草稿未通过',
    detail:
      '下方预览显示的是本轮草稿（未通过交付门禁），不是已验收成品；正式成品维持上一版。',
    draft: true,
  },
  repairing: {
    label: '修复中',
    detail: '下方预览是正在修复的临时稿，尚未验收；修复结束后才给出成品或草稿结论。',
    draft: true,
  },
}

/** 状态详情：只有在草稿取回入口真的渲染出来时，才提示"请走草稿入口"——不指一个不存在的按钮 */
function docStateDetail(s: DocDisplayState, hasDraftExport: boolean): string {
  if (s.kind === 'accepted' && s.saved === false) {
    return '已通过交付门禁；文档库写入结果尚未确认，因此这里不显示「已保存」。若写入失败，预览区上方会给出原因。'
  }
  const t = DOC_STATE_TEXT[s.kind]
  return s.kind === 'draft-failed' && hasDraftExport ? t.detail + '取回请走下方标注的草稿入口。' : t.detail
}

/** 状态附加信息（版本号 / 阻断条数 / 修复轮次），没有可说的就返回空串 */
function docStateMeta(s: DocDisplayState): string {
  switch (s.kind) {
    case 'accepted':
    case 'restored':
      return s.revisionId ? `版本 ${s.revisionId}` : ''
    case 'draft-failed':
      return `阻断 ${s.blockers} 条`
    case 'repairing':
      return `第 ${s.attempt} 轮修复`
  }
}

export interface PreviewPaneProps {
  html: string | null
  quality: QualityResult | null
  warnings?: string[]
  /** 未完成的素材位（阶段 3）：展示在预览上方，可逐项重试 */
  assetIssues?: AssetIssue[]
  retrying?: boolean
  onRetryAsset?: (slotId: string) => void
  /**
   * 保存失败提示（可选）：一句人话 + 错误摘要，由上层在落库失败时置入、保存成功后清空。
   * **只是展示**——不参与任何流程控制（铁律 6）；为 null / 空串时该容器不渲染。
   */
  saveError?: string | null
  /**
   * 正在生成（可选，默认 false）：为真时禁用三个导出/复制入口。
   * 为什么：流式生成中点导出会导出**半成品**，用户以为拿到的是终稿。
   * **只是禁用按钮**——不参与任何流程控制（铁律 6）。
   */
  busy?: boolean
  onClear: () => void
  /** 点击预览里的某个块 → 回调一个文本锚点（由上层插进对话输入框，用户自己补指令再发送） */
  onPickComponent?: (label: string) => void
  /**
   * 文档状态（可选，质量恢复计划 §8）：说明**当前预览里这份**是成品、上一版成品、未通过草稿还是修复中临时稿。
   * **纯展示输入**（铁律 6）：组件只把它渲染成文字标识，绝不据它触发任何行为；为 null / 不传时不渲染该容器。
   */
  docState?: DocDisplayState | null
  /**
   * 交付判定（可选）：与 App 用的是**同一份**质量结果，用来逐条列出阻断项（§8 第四条、§10 末行
   * "不以 quality-strip 颜色证明整体合格"）。不传时质量条完全按既有 `quality` 渲染（向后兼容）。
   */
  verdict?: DeliveryVerdict | null
  /**
   * 导出是否指向草稿（可选，默认 false）：为真时给**主导出/复制按钮**加"（草稿）"文案与 data-export-draft="1" 标记。
   *
   * 语义收紧（质量恢复计划 §8 第三条）：它只负责"给主导出按钮标注这是草稿"，**不得**用来代替
   * `draftHtml` 入口——回滚场景下 `html` 是已验收成品、草稿另有其人，靠改文案把成品按钮说成草稿
   * 会名实不符。上层只在 `html` 本身就是草稿（如 docState.kind === 'draft-failed'）时才置真。
   *
   * **只是文案与标记**：是否禁用这些按钮仍由上层传入的 props（如 `busy`）决定，本组件不自行判断能否导出（铁律 6）。
   */
  exportIsDraft?: boolean
  /**
   * 未通过交付门禁的候选 HTML（可选，计划 §8 第三条）：非空时在预览区多渲染一个**独立**的草稿导出入口组，
   * 它导出/复制的就是这份 `draftHtml`，与导出已验收成品的 `html` 分开，不静默把失败候选当成品交付。
   *
   * 为 null / 不传 / 空串时不渲染该入口（DOM 与既有行为完全一致）。**纯展示 + 纯回调**（铁律 6）：
   * 是否禁用只由传入的 props（`busy`）决定，组件不自行判断"能不能导出"。
   */
  draftHtml?: string | null
}

/**
 * 显示层的文档外壳。**导出给验收脚本用**（`scripts/preview-resource-check.mjs`）：预览的资源隔离
 * 边界就是"这段外壳 + srcdoc + sandbox"，验收必须用**生产这一份**去挂载各变体，
 * 不能在测试里再抄一遍包装（抄的那份永远会通过，因为抄的人按自己以为的规则抄）。
 */
export function wrapSrcDoc(html: string): string {
  // 包 D（DS 修复指南 §6）：**显示层**不得发起被禁止的外链资源请求。
  // 候选在通过质量门禁之前就会进这个 iframe，`sandbox="allow-same-origin"` 拦不住外链图片——
  // 实测中间过程会真的去请求 `https://example.com/x.jpg`。这里把它换成内联占位。
  // 传进门禁、失败草稿与导出用的**仍是原始 HTML**（本函数只作用于显示），违规证据不会被洗掉。
  const safe = neutralizeExternalResources(html).html
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  html,body{margin:0;padding:0;background:#ffffff;}
  body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;width:375px;max-width:100%;margin:0 auto;padding:0 0 40px;box-sizing:border-box;}
</style>
</head>
<body>
${safe}
</body>
</html>`
}

export default function PreviewPane({
  html,
  quality,
  warnings = [],
  assetIssues = [],
  retrying = false,
  onRetryAsset,
  saveError = null,
  busy = false,
  onClear,
  onPickComponent,
  docState = null,
  verdict = null,
  exportIsDraft = false,
  draftHtml = null,
}: PreviewPaneProps) {
  const [copied, setCopied] = useState(false)
  const [copiedDraft, setCopiedDraft] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [exportMsg, setExportMsg] = useState('')
  const [exportingImg, setExportingImg] = useState(false)
  const msgTimer = useRef<number | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  // 预览块拾取：iframe 与父页同源（allow-same-origin），父页直接挂监听即可，
  // 无需 allow-scripts / postMessage / 注入脚本。点击产物只是一段文本，交给对话输入框。
  // 回调走 ref，避免监听里闭包到旧函数；srcDoc 每次变更都会重载 iframe，所以挂在 onLoad 上。
  const pickRef = useRef(onPickComponent)
  pickRef.current = onPickComponent

  const attachPick = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc || !doc.body || !pickRef.current) return
    ensureHoverStyle(doc)
    let hovered: Element | null = null
    const clear = () => {
      if (hovered) hovered.classList.remove(HOVER_CLASS)
      hovered = null
    }
    const onOver = (e: Event) => {
      const el = nearestBlock(e.target as Element, doc)
      if (el === hovered) return
      clear()
      if (el) {
        el.classList.add(HOVER_CLASS)
        hovered = el
      }
    }
    const onClick = (e: Event) => {
      const el = nearestBlock(e.target as Element, doc)
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      pickRef.current?.(blockRefLabel(el, doc))
    }
    doc.addEventListener('mouseover', onOver, true)
    doc.addEventListener('mouseout', clear, true)
    doc.addEventListener('click', onClick, true)
  }, [])

  const flashMsg = (setter: (v: string) => void, text: string, ms = 8000) => {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setter(text)
    msgTimer.current = window.setTimeout(() => {
      setter('')
      msgTimer.current = null
    }, ms)
  }

  const copy = async () => {
    if (!html) return
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const doExport = async () => {
    if (!html) return
    const r = await exportHtml(html)
    flashMsg(setExportMsg, r.ok ? `已导出：${r.msg}` : `导出失败：${r.msg}`)
  }

  // 草稿取回入口（计划 §8 第三条）：导出/复制的必须是**失败候选**（draftHtml），
  // 不是预览里那份（回滚场景下预览是已验收成品）。刻意与上面的成品导出分开成两个按钮。
  const copyDraft = async () => {
    if (!draftHtml) return
    try {
      await navigator.clipboard.writeText(draftHtml)
      setCopiedDraft(true)
      setTimeout(() => setCopiedDraft(false), 1200)
    } catch {
      setCopiedDraft(false)
    }
  }

  const doExportDraft = async () => {
    if (!draftHtml) return
    const r = await exportHtml(draftHtml)
    flashMsg(setExportMsg, r.ok ? `已导出草稿：${r.msg}` : `导出草稿失败：${r.msg}`)
  }

  // 第 34 轮：HTML → 图片（长图 + 分页），替代微信 API 发草稿箱，由用户手动上传
  const doExportImg = async () => {
    if (!html) return
    setExportingImg(true)
    flashMsg(setExportMsg, '正在把正文渲染为图片（长图 + 分页）…')
    try {
      const r = await exportArticleImages(html)
      flashMsg(setExportMsg, r.ok ? r.msg : `导出图片失败：${r.msg}`, 20000)
    } catch (e) {
      flashMsg(setExportMsg, `导出图片失败：${String(e)}`, 20000)
    } finally {
      setExportingImg(false)
    }
  }

  // ---------- 文档状态与质量条（全部是纯展示计算，不参与任何流程判断：铁律 6） ----------
  const stateText = docState ? DOC_STATE_TEXT[docState.kind] : null
  // 「已保存」这几个字只能来自**本轮成功提交回执**（DS 指南 §5.3 末段）。上层在落库之前就会把
  // 状态置成 accepted（好让用户先看见"验收通过"），此时 saved===false —— 那时还不能说"已保存"。
  const stateLabel =
    docState?.kind === 'accepted' && docState.saved === false
      ? '成品已验收，写入文档库尚未确认'
      : stateText?.label || ''
  const stateMeta = docState ? docStateMeta(docState) : ''
  // 是否"预览里这份不是已验收成品"——这个布尔只用来选文案与 data 标记，不驱动任何行为
  const showingDraft = !!stateText?.draft
  // 导出入口的草稿标识：只改文案与 data 属性；能否点击仍由上层传入的 busy 等 props 决定
  const draftTag = exportIsDraft ? '（草稿）' : ''
  // 独立的草稿取回入口：非空才渲染，空串 / null 时 DOM 与既有行为完全一致
  const hasDraftExport = String(draftHtml || '').length > 0
  // 质量条：给了统一判定（verdict）就以它为准——与 App 用的是同一份质量结果；
  // 不传 verdict 时完全按既有 quality 渲染，保持向后兼容。
  const showStrip = !!html && (!!quality || !!verdict)
  const stripOk = verdict ? verdict.ok : !!quality?.ok
  const stripTitle = verdict
    ? verdict.ok
      ? `质量检查 · 通过（阻断 0 条 · 警告 ${verdict.warnings.length} · 提示 ${verdict.infos.length}）`
      : `质量检查 · 未通过：${verdict.blockers.length} 项阻断问题`
    : quality?.ok
      ? '质量检查 · 通过'
      : `质量检查 · ${quality?.issues.length ?? 0} 项问题`
  // 阻断项按稳定 code 归组：逐条列出"代码 + 一句话 + 条数"（§8 第四条 / §10 末行：
  // 不能只靠颜色证明整体合格）。判定只认 code，中文 message 只用于展示。
  const blockerGroups: { code: string; items: DeliveryIssue[] }[] = []
  if (verdict) {
    const byCode = new Map<string, DeliveryIssue[]>()
    for (const b of verdict.blockers) {
      const arr = byCode.get(b.code)
      if (arr) arr.push(b)
      else byCode.set(b.code, [b])
    }
    for (const [code, items] of byCode) blockerGroups.push({ code, items })
  }
  // 既有 checkHtml 问题清单：统一判定没覆盖到的那部分照旧列出来，不能因为换成"阻断项"就少显示问题。
  // 已并入 blockers 的按 `html.<kind>` 代码去重，避免同一条问题列两遍。
  const legacyIssues =
    verdict && quality && !quality.ok
      ? quality.issues.filter((it) => !verdict.blockers.some((b) => b.code === 'html.' + it.kind))
      : []

  return (
    <div className="preview-pane">
      <div className="preview-head">
        <span className="dot dot-green" />
        推文预览 · 375px
        <div className="preview-actions">
          <button className="mini" onClick={() => setZoom((z) => (z >= 1.5 ? 1 : z + 0.25))}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="mini"
            data-act="copy-html"
            data-export-draft={exportIsDraft ? '1' : undefined}
            onClick={copy}
            disabled={!html || busy}
            title={exportIsDraft ? '复制的是未通过交付门禁的草稿，不是已验收成品' : undefined}
          >
            {copied ? '已复制' : `复制 HTML${draftTag}`}
          </button>
          <button
            className="mini"
            data-act="export-images"
            data-export-draft={exportIsDraft ? '1' : undefined}
            onClick={() => void doExportImg()}
            disabled={!html || exportingImg || busy}
            title={
              exportIsDraft
                ? '把当前草稿渲染成图片（长图+分页 2x 高清）：这不是已验收成品，仅用于取回核对'
                : '把当前正文渲染成图片（长图+分页 2x 高清），导出后手动上传使用'
            }
          >
            {exportingImg ? '转图中…' : `导出图片${draftTag}`}
          </button>
          <button
            className="mini"
            data-act="export-html"
            data-export-draft={exportIsDraft ? '1' : undefined}
            onClick={() => void doExport()}
            disabled={!html || busy}
            title={exportIsDraft ? '导出的是未通过交付门禁的草稿，不是已验收成品' : undefined}
          >
            导出 HTML{draftTag}
          </button>
          <button className="mini mini-danger" data-act="clear" onClick={onClear} disabled={!html}>
            清空
          </button>
        </div>
      </div>

      {/* 文档状态（计划 §8 第一、二条）：说清预览里这份到底是草稿还是已验收成品。
          容器带 data-doc-state="accepted|restored|draft-failed|repairing" 与 data-doc-is-draft="0|1"；
          **纯展示**——不参与任何流程判断、澄清或路由（铁律 6）；docState 为空时该容器不渲染。 */}
      {docState && stateText && (
        <div
          className={`doc-state ds-${docState.kind}`}
          data-doc-state={docState.kind}
          data-doc-is-draft={showingDraft ? '1' : '0'}
        >
          <div className="ds-line">
            <span className="ds-title">{stateLabel}</span>
            {stateMeta && <span className="ds-meta">{stateMeta}</span>}
          </div>
          <div className="ds-detail">{docStateDetail(docState, hasDraftExport)}</div>
        </div>
      )}
      {/* 草稿导出标识（§8 第三条）：失败候选允许通过明确标注的入口取回，但不静默作为成品交付。
          是否禁用按钮由上层 props 决定，这里只负责说清"取回的不是成品"。 */}
      {exportIsDraft && (
        <div className="draft-export-note" data-export-draft="1">
          导出与复制取回的是草稿（未通过交付门禁），不是已验收成品。
        </div>
      )}
      {/* 独立的草稿取回入口（§8 第三条）：导出的是 draftHtml —— 失败候选本体，
          不是预览里那份（回滚场景下预览是已验收成品）。draftHtml 为空时整组不渲染。
          **纯展示 + 纯回调**：能否点只由 busy 决定（铁律 6）。 */}
      {hasDraftExport && (
        <div className="draft-export" data-export-draft-entry="1">
          <span className="de-label">未通过门禁的候选（草稿）</span>
          <button
            className="mini"
            data-act="export-draft-html"
            onClick={() => void doExportDraft()}
            disabled={busy}
            title="导出的失败候选草稿，不是已验收成品"
          >
            导出草稿 HTML
          </button>
          <button
            className="mini"
            data-act="copy-draft-html"
            onClick={() => void copyDraft()}
            disabled={busy}
            title="复制的失败候选草稿，不是已验收成品"
          >
            {copiedDraft ? '已复制草稿' : '复制草稿 HTML'}
          </button>
        </div>
      )}

      {exportMsg && <div className="export-msg">{exportMsg}</div>}
      {/* 保存失败：必须是看得见的功能反馈，不能只留控制台线索（用户会以为稿子已经存好）。
          契约：data-save-error="1" 只在失败时出现，未失败时该容器不渲染。仅为展示，不参与流程（铁律 6）。 */}
      {saveError ? (
        <div className="save-error" data-save-error="1">
          {saveError}
        </div>
      ) : null}
      {/* 未完成素材（阶段 3 第 6 条）：达到生成预算仍没做出来的素材位，逐项列出并可单独重试。
          完成状态以这里为准，不看助手说了什么。 */}
      {assetIssues.length > 0 && (
        <div className="asset-issues" data-issues={assetIssues.length}>
          <div className="ai-head">仍有 {assetIssues.length} 个素材未完成</div>
          <ul className="ai-list">
            {assetIssues.map((it) => (
              <li key={it.slotId}>
                <span className="ai-label">{it.label}</span>
                <span className="ai-reason">{it.reason}</span>
                <button
                  className="mini"
                  data-retry-slot={it.slotId}
                  disabled={retrying || !onRetryAsset}
                  onClick={() => onRetryAsset?.(it.slotId)}
                >
                  重试
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="compose-warn">
          {warnings.slice(0, 3).map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {showStrip && (
        <div className={`quality-strip ${stripOk ? 'q-ok' : 'q-fail'}`} data-strip-source={verdict ? 'verdict' : undefined}>
          <span className="q-title">{stripTitle}</span>
          {verdict ? (
            <>
              {blockerGroups.length > 0 ? (
                <div className="q-blockers" data-q-blockers={verdict.blockers.length} data-blocker-count={blockerGroups.length}>
                  <div className="qb-head">阻断项逐条列明（{verdict.blockers.length} 条 / {blockerGroups.length} 类代码）：</div>
                  {/* 同时带 q-list 类：既有的 `.q-list li` 断言（问题条数）继续可用，
                      阻断项本身就是这份稿子的问题清单，不是另一套数据。 */}
                  <ul className="q-list qb-list">
                    {blockerGroups.map((g) => (
                      <li key={g.code} data-blocker-code={g.code} data-count={g.items.length}>
                        <code className="qb-code">{g.code}</code>
                        <span className="qb-msg">{g.items[0].message}</span>
                        <span className="qb-count">{g.items.length} 条</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                // 通过时也要给出**文字**证据，不让"绿色"成为唯一结论（§10 末行）
                <div className="q-clear" data-q-blockers="0">
                  阻断项 0 条：本稿没有必须拦下的问题（逐阶段结论与未核验项以交付判定为准）。
                </div>
              )}
              {verdict.unverified.length > 0 && (
                <div className="q-unverified" data-q-unverified={verdict.unverified.length}>
                  未核验：{verdict.unverified.join(' / ')}（未核验不等于通过）
                </div>
              )}
              {legacyIssues.length > 0 && (
                <div className="q-legacy" data-q-legacy={legacyIssues.length}>
                  <div className="qb-head">HTML 产品规范另有 {legacyIssues.length} 项：</div>
                  <ul className="q-list">
                    {legacyIssues.slice(0, 5).map((it, i) => (
                      <li key={i}>
                        {it.kind}: {it.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            !quality?.ok && (
              <ul className="q-list">
                {quality?.issues.slice(0, 5).map((it, i) => (
                  <li key={i}>
                    {it.kind}: {it.detail}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      <div className="preview-body" data-doc-draft={docState && stateText ? (showingDraft ? '1' : '0') : undefined}>
        {!html ? (
          <div className="preview-empty" />
        ) : (
          <div className="preview-stage">
            <div className="phone" style={{ transform: `scale(${zoom})` }}>
              <div className="phone-notch" />
              <iframe
                ref={frameRef}
                title="推文预览"
                srcDoc={wrapSrcDoc(html)}
                sandbox="allow-same-origin"
                onLoad={attachPick}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
