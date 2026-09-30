// delivery-quality.ts —— 统一质量结果与交付门禁（2026-09-29 质量恢复计划 §4）
//
// 为什么要有这个模块（真实故障 `s1790565874610554000`）：
// 当时流水线里同时存在三套互不相认的"检查"——`compose` 的 `warnings: string[]`、
// `quality.checkHtml` 的 `ok/kind`、`image-agent` 的 `residual/residue/errors`。它们各说各话：
//   · 自动修订靠 `revise.fixableWarnings` 对**六个中文子串**做 `includes` 匹配来决定重写谁；
//   · `checkHtml` 单独跑，失败只画一条红条，照样把稿子写进磁盘并显示"成稿已保存 / ok:true"；
//   · 库素材"读到了"就记为 `ok`，排版层把它拒收（含 `<text>` 等）时没有任何回写。
// 结果：正文里 0 个有效素材、3 处转义 SVG 与内部 `::: art` 文本同时存在，而日志一片正常。
//
// 这个模块只做一件事：把**五类检查**（解析 / 素材 / 栅格 / HTML / 正文完整性）汇总成**一条统一
// 问题清单**，并据此给出**交付判定**。判定只认每条的稳定 `code` 与 `severity`，
// **中文 `message` 只负责展示，绝不作为分支条件**——按提示文案做分支的写法，
// 一改文案就会静默失效（`fixableWarnings` 就是被这么绕过去的）。
//
// 边界（项目铁律 6，永久有效）：本模块判定的是**产物质量**，不是用户意图。
// 它不得用于控制对话流程、澄清、路由或任何前端状态机——问题清单只描述"这份产物能不能当成品"，
// 不决定"用户想干什么"。运行期间不拦截用户回合，用户随时可以停止或继续修订。
//
// 零外部依赖（仅 type-only 引用 compose/asset-ledger，运行期只 import quality.checkHtml），
// 纯函数为主，可直接被 node 断言脚本加载。

import type { AssetLedger } from './asset-ledger.ts'
import type { ComposeIssue, RejectedArt } from './compose.ts'
import { checkHtml } from './quality.ts'

// ---------- 统一问题的稳定字段 ----------

export type QualitySeverity = 'blocking' | 'warning' | 'info'

/**
 * 检查阶段。前五个是计划 §4 要求的五类检查；`capacity`/`version` 是判定成品可提交所必需的两项附加约束
 * （容量约束与版本字段一致），单列出来是为了让"为什么没通过"能落到具体阶段，而不是笼统一句"未通过"。
 */
export type QualityStage = 'parse' | 'material' | 'raster' | 'html' | 'body' | 'capacity' | 'version'

/**
 * 默认处理/修复策略。取值与计划 §4 表格逐行对应（见 REPAIR_POLICY）：
 * - `reparse`：修正解析/局部结构后重新渲染（解析、结构、正文丢失类）
 * - `restore-asset`：恢复对应已验收快照，或替换/重绘该素材位（素材、栅格类）
 * - `normalize`：可证明语义不变时局部规范化，否则定点修订（产品规范类）
 * - `capacity-recheck`：先清除泄漏、核实度量阶段，再考虑压缩（容量类）
 * - `await-photo`：明示待补照片，**不自动伪造照片**（照片位）
 * - `revert-version`：回落/恢复完整已验收版本（版本字段不一致，计划 §7）
 * - `none`：提示即可，不强迫改稿、不阻断成品（有意短篇、推荐性组件数量）
 */
export type RepairKind =
  | 'reparse'
  | 'restore-asset'
  | 'normalize'
  | 'capacity-recheck'
  | 'await-photo'
  | 'revert-version'
  | 'none'

/** 源文行范围，1-based 闭区间。`line === 0` 表示**无法定位到源文行**（例如问题只在渲染后的 HTML 里出现） */
export interface SourceRange {
  line: number
  endLine: number
}

export interface DeliveryIssue {
  /** 稳定代码：分支只认它 */
  code: string
  severity: QualitySeverity
  stage: QualityStage
  /** 面向用户的说明（可展示，不参与判定） */
  message: string
  sourceRange: SourceRange
  /** 渲染节点标识（调用方在映射回渲染产物时填） */
  nodeId?: string
  /** 素材位稳定 id（台账 slotId）；素材类问题必须尽量填上 */
  slotId?: string
  assetId?: string
  repairKind: RepairKind
  /** 证据摘要（可证伪的原始事实：长度、引用词、缺失片段……） */
  evidence?: string
  /** 该素材位是否必需（true 时未完成一定阻断；false/未填只作参考） */
  required?: boolean
}

/** 稳定代码表：本模块自己产出的代码集中在这里，避免散落的字符串字面量漂移 */
export const ISSUE_CODES = {
  // 解析 / 结构
  parseLeak: 'parse.leak',
  parseAssetPlaceholder: 'asset.art-placeholder',
  /**
   * **正文边界无法确定**：v2 围栏内出现裸 ``` （代码块的开围栏与正文结束围栏同形），
   * 解析器只能按 toggle 走，正文可能已被截断。详见 `extract.ts` 的 `v2Ambiguous`。
   * 这条**必须阻断**：不确定的边界不能当成功提交（提交了但内容不对）。
   */
  parseAmbiguous: 'parse.ambiguous-body',
  // 素材
  assetRejected: 'asset.rejected',
  assetSlotUnlocated: 'asset.slot-unlocated',
  assetUnresolved: 'asset.unresolved',
  assetProtocolResidue: 'asset.protocol-residue',
  assetCategoryMismatch: 'asset.category-mismatch',
  assetError: 'asset.error',
  assetRequiredIncomplete: 'asset.required-incomplete',
  // 栅格（实际显示尺寸下的可见性/观感）
  rasterNotPassed: 'raster.not-passed',
  // HTML（产品规范）
  htmlCheckFailed: 'html.check-failed',
  // 正文完整性
  bodyTextLost: 'body.text-lost',
  bodyFactLost: 'body.fact-lost',
  bodyTextChanged: 'body.text-changed',
  bodyOrderChanged: 'body.order-changed',
  bodyTextAdded: 'body.text-added',
  /**
   * 正文完整性**无法核验**（该比却比不了：没有可信正文投影 / 投影失败 / 该给基准却没给）。
   * 与"不适用"（本回合首个候选，本来就没有可比对象）是两件事——见 `BodyApplicability`。
   * 这条是**阻断**：不能用"没检查"冒充"检查通过"（计划 §4.4 第 6 条）。
   */
  bodyUnverified: 'body.unverified',
  bodyShortHint: 'body.short-hint',
  bodyIntentionalShort: 'body.intentional-short',
  // 推荐性组件（不阻断）
  componentsTip: 'components.tip',
  componentsPhotoOnlyTip: 'components.photo-only-tip',
  componentsStructureTip: 'components.structure-tip',
  // 照片位待补
  photoPending: 'photo.pending',
  // 容量
  capacityOverLimit: 'capacity.over-limit',
  // 版本
  versionMismatch: 'version.mismatch',
  versionMissing: 'version.missing',
} as const

/** 计划 §4 表格的机器可读版本：策略文案只负责展示，调度看 `repairKind` */
export const REPAIR_POLICY: Record<RepairKind, { strategy: string; autoFix: boolean; blocks: boolean }> = {
  reparse: {
    strategy: '修正解析/局部结构后重新渲染：程序错误用程序修，不让模型反复重写文章来补偿',
    autoFix: true,
    blocks: true,
  },
  'restore-asset': {
    strategy: '恢复该素材位的已验收快照（核实与当前需求兼容），否则替换/重绘该素材位；不得为清空问题清单而删除用户明确要求的素材',
    autoFix: true,
    blocks: true,
  },
  normalize: {
    strategy: '可证明语义不变时局部规范化（定点改写那几行），否则定点修订；不做整篇重写',
    autoFix: true,
    blocks: true,
  },
  'capacity-recheck': {
    strategy: '先清除泄漏、核实度量阶段（源文/渲染 HTML/内嵌图片数据不是同一尺寸），再考虑压缩；不能直接删正文凑长度',
    autoFix: false,
    blocks: false,
  },
  'await-photo': {
    strategy: '明示待补照片：创作草稿允许；发布就绪检查单独判定，**不自动伪造照片**',
    autoFix: false,
    blocks: false,
  },
  'revert-version': {
    strategy: '回落到完整已验收版本（不拼接旧 HTML 与新元数据）；没有合格历史时如实显示"草稿未通过"',
    autoFix: false,
    blocks: true,
  },
  none: {
    strategy: '仅提示：不强迫改稿，不阻断成品',
    autoFix: false,
    blocks: false,
  },
}

/** 阶段 → 兜底策略。未知代码按前缀进统一门禁（fail-closed），不会被静默放行 */
function repairKindOf(code: string, severity: QualitySeverity): RepairKind {
  if (code === ISSUE_CODES.parseLeak) return 'reparse'
  if (code === ISSUE_CODES.parseAmbiguous) return 'reparse'
  if (code === ISSUE_CODES.parseAssetPlaceholder) return 'restore-asset'
  if (code === ISSUE_CODES.assetRejected || code === ISSUE_CODES.assetRequiredIncomplete) return 'restore-asset'
  if (code === ISSUE_CODES.assetSlotUnlocated) return 'restore-asset'
  if (code === ISSUE_CODES.assetUnresolved) return 'restore-asset'
  if (code === ISSUE_CODES.assetProtocolResidue) return 'restore-asset'
  if (code === ISSUE_CODES.rasterNotPassed) return 'restore-asset'
  if (code === ISSUE_CODES.htmlCheckFailed) return 'normalize'
  if (code === ISSUE_CODES.bodyTextLost || code === ISSUE_CODES.bodyFactLost) return 'reparse'
  if (code === ISSUE_CODES.bodyTextChanged || code === ISSUE_CODES.bodyOrderChanged) return 'normalize'
  // "比不了"不是"改写能解决"：缺的是基准/投影，让模型再改一版正文只会把问题拖下去。
  // 归到 revert-version（阻断、不自动改稿）：保留上一份已验收成品或只存草稿。
  if (code === ISSUE_CODES.bodyUnverified) return 'revert-version'
  if (code === ISSUE_CODES.versionMismatch || code === ISSUE_CODES.versionMissing) return 'revert-version'
  if (code === ISSUE_CODES.capacityOverLimit) return 'capacity-recheck'
  if (code === ISSUE_CODES.photoPending) return 'await-photo'
  if (severity === 'info') return 'none'
  switch (stageOfCode(code)) {
    case 'material':
    case 'raster':
      return 'restore-asset'
    case 'html':
      return 'normalize'
    case 'version':
      return 'revert-version'
    case 'capacity':
      return 'capacity-recheck'
    case 'body':
    case 'parse':
    default:
      return 'reparse'
  }
}

/**
 * 代码 → 阶段。只认前缀，不认中文文案。
 * 未知前缀一律落到 `parse`：这是**保守兜底**——宁可把不认识的检查当成"需要重新渲染才能解决"，
 * 也不能让它变成没人处理、也不阻断的孤儿问题。
 */
export function stageOfCode(code: string): QualityStage {
  if (code.startsWith('asset.')) return 'material'
  if (code.startsWith('raster.')) return 'raster'
  if (code.startsWith('html.')) return 'html'
  if (code.startsWith('body.')) return 'body'
  if (code.startsWith('capacity.')) return 'capacity'
  if (code.startsWith('version.')) return 'version'
  return 'parse'
}

/** 由代码 + 严重度派生 repairKind（外部可直接复用，避免各处再写一遍映射） */
export function repairKindFor(code: string, severity: QualitySeverity): RepairKind {
  return repairKindOf(code, severity)
}

/** 问题指纹：相同指纹 + 产物未变化 → 计划 §5 要求的"提前结束空转"依据 */
export function issueFingerprint(i: DeliveryIssue): string {
  return [i.code, i.severity, i.stage, i.slotId || '-', i.nodeId || '-', i.sourceRange.line, i.sourceRange.endLine].join('|')
}

/** 去重（同代码同位置同素材只留一条，保留先到者并合并证据） */
export function dedupeIssues(issues: DeliveryIssue[]): DeliveryIssue[] {
  const seen = new Map<string, DeliveryIssue>()
  for (const i of issues) {
    const k = issueFingerprint(i)
    const prev = seen.get(k)
    if (!prev) {
      seen.set(k, i)
      continue
    }
    if (i.evidence && prev.evidence && !prev.evidence.includes(i.evidence)) prev.evidence = prev.evidence + ' ／ ' + i.evidence
  }
  return [...seen.values()]
}

export function countBySeverity(issues: DeliveryIssue[], severity: QualitySeverity): number {
  return issues.filter((i) => i.severity === severity).length
}

function mk(args: {
  code: string
  severity: QualitySeverity
  message: string
  line?: number
  endLine?: number
  slotId?: string
  assetId?: string
  nodeId?: string
  evidence?: string
  repairKind?: RepairKind
  required?: boolean
}): DeliveryIssue {
  const line = args.line && args.line > 0 ? args.line : 0
  const endLine = args.endLine && args.endLine > 0 ? args.endLine : line
  const out: DeliveryIssue = {
    code: args.code,
    severity: args.severity,
    stage: stageOfCode(args.code),
    message: args.message,
    sourceRange: { line, endLine },
    repairKind: args.repairKind || repairKindOf(args.code, args.severity),
    evidence: args.evidence,
  }
  if (args.slotId) out.slotId = args.slotId
  if (args.assetId) out.assetId = args.assetId
  if (args.nodeId) out.nodeId = args.nodeId
  if (args.required !== undefined) out.required = args.required
  return out
}

// ---------- ① 解析类：内部协议泄漏（源文行定位） ----------

/** 成品**可见文本**里不允许出现的内部协议痕迹 */
const LEAK_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /<svg\b/i, what: '转义的 SVG 源码' },
  { re: /<path\b|<circle\b|<rect\b/i, what: '转义的 SVG 图元源码' },
  { re: /:::\s*(?:art|photo|card|steps|cols|imgrow|imgcard|timeline|band|frame|deco)\b/, what: '内部块标记' },
  { re: /\[\[(?:asset|img|deco|theme|palette|banner|title|lace|badge)\s*:/, what: '未解析的协议行' },
]

/** 行内代码 span（`compose.inline()` 产出）：先剔除再查泄漏——合法代码示例不能被全局字符串规则误杀 */
const INLINE_CODE_SPAN = /<span style="background-color:[^"]*font-family:Consolas,Menlo,monospace[^"]*">[\s\S]*?<\/span>/g

/**
 * **代码块**（`compose.codeBlock()` 产出）：整段剔除。
 *
 * 为什么必须剔除：compose 自己的逐节点泄漏检查显式跳过代码节点（`if (!meta || meta.code) continue`，
 * 注释写着"代码块是合法展示内容"），但交付门禁的 `visibleText()` 过去只剔行内代码 span——
 * 而代码块的 `<p>` 样式里**没有** `background-color:`，`INLINE_CODE_SPAN` 匹配不到它。
 * 实测后果：正文里贴一段示范素材写法的代码（含 `[[asset:…]]` 或转义的 `<svg`）会让这份稿
 * **永远过不了门禁**，而自动修复只会让模型反复重写正文（写程序 bug 的补偿）。
 *
 * 口径与 compose 保持一致：`codeBlock` 的外层 section 带 `overflow-x:auto`，据此识别。
 */
const CODE_BLOCK_SECTION = /<section style="background:[^"]*overflow-x:auto[^"]*">[\s\S]*?<\/section>/g

/** 取"可见文本"：去掉代码块、代码 span、标签与实体转义 */
export function visibleText(html: string): string {
  return String(html || '')
    .replace(CODE_BLOCK_SECTION, ' ')
    .replace(INLINE_CODE_SPAN, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** compose 在素材被质检拦下时写进正文的**系统生成**占位（不是作者内容，也不是要保护的事实） */
const REJECT_PLACEHOLDER = /（此处原为美术素材「[^」]*」，[^）]*）/g

/**
 * **正文投影**：从渲染后的 HTML 取"可比较的作者正文单元"，供事实抽取与片段比较使用。
 *
 * 为什么要专门做一层，而不是直接把 raw v2 或 HTML 折成一行（计划 §4.3 明确禁止这两种做法）：
 * - raw v2 里的 `viewBox="0 0 750 220"`、`<path d="M60 170 q90 -40 180 0">`、素材 ID
 *   `as-1790663783921024000` 都会被事实抽取当成"数字事实"——模型改一次 SVG 就会被判"丢事实"；
 * - 折成一行后源文行号全部失效，`body.*` 问题就再也定位不到具体位置。
 *
 * 因此这里**有选择地**剔除：整段 `<svg>`（素材实现，不是文章事实）、系统生成的拒收占位。
 * **不**剔除转义后的 `&lt;svg` 泄漏文本——那是真实故障的产物，由 `leakIssues` 负责阻断，
 * 不能在这里被顺手洗掉。
 *
 * 行内代码 span **保留其文字**（DS 修复指南 §4.1 第 3 条）：`font-family:monospace` 只是**样式**，
 * 里面写的是读者真的看得见的作者内容。旧实现把整个 span 连同文字一起删掉，于是
 * `联系电话：\`010-55556666\`。` 的首稿**一个电话事实都抽不出来**，下一轮模型把电话删掉时
 * `beforeFacts` 是空的，"丢事实"根本无从比较——实测反例正是这么溜过门禁的。
 * 保留的方式很简单：不做特殊处理，交给下面的通用标签剥离（`<[^>]+>`）——属性里的
 * 颜色/字体名随标签一起消失，只有可见文字留下。
 * 代码**块**（`CODE_BLOCK_SECTION`）同理属于可见作者内容，本函数从来就没删过它；
 * 只有 `visibleText()`（协议泄漏检查，用途不同）才剔除代码块与行内代码。
 */
export function bodyText(html: string): string {
  return String(html || '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(REJECT_PLACEHOLDER, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 在源文里定位某个特征（返回 1-based 行号，找不到返回 0——如实说明"定位不到"，不猜一个行号） */
export function locateInSource(source: string | undefined, test: (line: string) => boolean): number {
  if (!source) return 0
  const lines = String(source).split(/\r?\n/)
  for (let k = 0; k < lines.length; k++) if (test(lines[k])) return k + 1
  return 0
}

/**
 * 源码泄漏检查（计划 §3.2"检查可见文本是否泄漏内部 ::: art、转义 SVG、未解析素材指令或失败占位"）。
 *
 * 与图片数量**无关**：真实故障正是"有 6 张 img 的同时还有 3 处转义 SVG"，所以这里只看可见文本，
 * 不引入"零图才查"之类的旁路条件。
 */
export function leakIssues(html: string, source?: string): DeliveryIssue[] {
  const out: DeliveryIssue[] = []
  const seen = new Set<string>()
  const text = visibleText(html)
  const raw = String(html || '')

  // ① 可见文本里的协议痕迹
  for (const p of LEAK_PATTERNS) {
    if (seen.has(p.what)) continue
    const m = p.re.exec(text)
    if (!m) continue
    seen.add(p.what)
    const from = Math.max(0, m.index - 20)
    const snippet = text.slice(from, from + 80)
    const line = locateInSource(source, (l) => p.re.test(l.trim()))
    out.push(
      mk({
        code: ISSUE_CODES.parseLeak,
        severity: 'blocking',
        message: `成品可见文本里出现内部源码泄漏（${p.what}）：${snippet}`,
        line,
        evidence: `命中"${p.what}"；片段：…${snippet}…（转义后仍作为正文文字显示）`,
        repairKind: 'reparse',
      }),
    )
  }

  // ② 未被替换的素材占位（artRender 没跑到，img 的 src 还是 @@ARTn@@）
  const ph = /src="@@ART(\d+)@@"/g
  for (const m of raw.matchAll(ph)) {
    const line = locateInSource(source, (l) => /^:::\s*art\b/.test(l.trim()))
    out.push(
      mk({
        code: ISSUE_CODES.parseAssetPlaceholder,
        severity: 'blocking',
        message: `美术素材占位 @@ART${m[1]}@@ 没有被渲染结果替换，成品里该处是空图`,
        line,
        evidence: `HTML 中仍存在 src="@@ART${m[1]}@@"`,
        repairKind: 'restore-asset',
      }),
    )
  }
  return out
}

// ---------- ② HTML 类（产品规范）：checkHtml 的稳定 kind → 统一问题 ----------

/**
 * `checkHtml` 的 `kind` 本身就是稳定英文标识（empty/style-tag/…），这里直接 `html.` 前缀化。
 *
 * 注意：**`checkHtml.ok` 单独为真不等于整稿通过**（计划 §4 原文）。本函数只负责把它的失败项
 * 并入统一清单；判定必须由 `deliveryVerdict` 结合素材、栅格、正文完整性和版本字段一起做。
 */
export function htmlIssues(html: string): DeliveryIssue[] {
  const r = checkHtml(html)
  return r.issues.map((q) =>
    mk({
      code: 'html.' + q.kind,
      severity: 'blocking', // 计划 §4：当前产品规范禁止的字符或样式 → 阻断成品提升
      message: q.detail,
      evidence: `checkHtml kind=${q.kind}`,
      repairKind: 'normalize',
    }),
  )
}

// ---------- ③ 素材类：拒收映射回素材位（库读取成功 ≠ 验收完成） ----------

/**
 * 素材位索引条目。来源是台账（`AssetLedger`），但这里只取**只读快照**，不依赖台账实现细节。
 * 比对口径：`refs` 逐个与 `slot` / `assetId` / `aliases` 比对——别名覆盖
 * 「台账 slot 原文」「`[[asset:分类|ID|用途]]` 里的分类与 ID」「成品块头部的多别名」，
 * 因为素材解析层写入的就是这些词，而排版层拒收时只有块头那几个词可用。
 */
export interface SlotIndexEntry {
  slotId: string
  slot: string
  assetId?: string
  aliases: string[]
  kind?: string
}

function normRef(s: string): string {
  return String(s || '')
    .trim()
    .replace(/^:::\s*art(\s+deco)?(\s+(wide|inline))?\s*/i, '')
    .replace(/^\[\[|\]\]$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** 从 `[[asset:分类|ID|用途]]` 里拆出可比较的身份词 */
function identityTokens(slot: string): string[] {
  const m = /\[\[asset:([^\]|]*)\|([^\]|]*)\|?([^\]]*)\]\]/.exec(String(slot || ''))
  if (!m) return []
  return [m[1], m[2], m[3]].map((x) => x.trim()).filter(Boolean)
}

/** 从成品块头部（`::: art deco 别名A 别名B`）拆出别名 */
function blockAliases(block: string | undefined): string[] {
  if (!block) return []
  const head = String(block).split(/\r?\n/)[0] || ''
  return head
    .replace(/^:::\s*art(\s+deco)?(\s+(wide|inline))?\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** 台账 → 索引（含别名）。台账为空时返回空数组：调用方不得据此认定"没有素材位" */
export function slotIndexFromLedger(ledger: AssetLedger | null | undefined): SlotIndexEntry[] {
  if (!ledger) return []
  return ledger.order.map((id) => ledger.slots[id]).filter(Boolean).map((e) => {
    const aliases = new Set<string>()
    for (const t of [normRef(e.slot), normRef(e.assetId), ...identityTokens(e.slot).map(normRef), ...blockAliases(e.block).map(normRef), ...blockAliases(e.ref).map(normRef), normRef(e.slotId)]) {
      if (t) aliases.add(t)
    }
    return { slotId: e.slotId, slot: e.slot, assetId: e.assetId || undefined, aliases: [...aliases], kind: e.kind }
  })
}

/** 把一个拒收引用词映射回素材位。比对不上返回 null——**不静默丢弃**，由调用方记 `asset.slot-unlocated` */
export function matchArtRefs(refs: string[], slots: SlotIndexEntry[]): { ref: string; entry: SlotIndexEntry } | null {
  for (const raw of refs || []) {
    const r = normRef(raw)
    if (!r) continue
    for (const e of slots || []) {
      if (e.aliases.includes(r) || normRef(e.slot) === r || (e.assetId && normRef(e.assetId) === r)) return { ref: raw, entry: e }
    }
  }
  return null
}

/**
 * `RejectedArt` → 统一问题。命中素材位 → `asset.rejected`（阻断，带 slotId）；
 * 比对不上 → `asset.slot-unlocated`（阻断，如实记为"无法定位到素材位"）。
 *
 * 为什么比对不上也阻断：拒收意味着成品那个位置显示的是**占位文本**，是用户可见的缺陷。
 * 在无法证明"这不是必需素材位"时按 fail-closed 处理，比"定位不到就当没事"安全得多。
 */
export function issuesFromRejected(rejected: RejectedArt[], slots: SlotIndexEntry[] = []): DeliveryIssue[] {
  return (rejected || []).map((r) => {
    const hit = matchArtRefs(r.refs || [], slots)
    const what = (r.refs || []).filter(Boolean).join(' / ') || '（无引用词）'
    if (hit) {
      return mk({
        code: ISSUE_CODES.assetRejected,
        severity: 'blocking',
        message: `素材位「${hit.entry.slot || hit.entry.slotId}」的素材未通过本地质检（${r.reason}），该处已用占位文本代替`,
        line: r.line,
        endLine: r.line,
        slotId: hit.entry.slotId,
        assetId: hit.entry.assetId,
        required: true,
        evidence: `拒收引用：${what}；命中别名「${hit.ref}」；${r.deco ? '角饰定义' : '整块素材'}；原因：${r.reason}`,
        repairKind: 'restore-asset',
      })
    }
    return mk({
      code: ISSUE_CODES.assetSlotUnlocated,
      severity: 'blocking',
      message: `素材被拒收（${r.reason}），但引用词「${what}」无法定位到素材位；如实记录，不静默丢弃`,
      line: r.line,
      endLine: r.line,
      evidence: `拒收引用：${what}；${r.deco ? '角饰定义' : '整块素材'}；原因：${r.reason}；台账中缺少匹配的 slot/assetId/别名`,
      repairKind: 'restore-asset',
    })
  })
}

/** 素材位完成状态：台账未完成项 → 必需素材位未完成（阻断） */
export interface RequiredSlot {
  slotId: string
  slot: string
  done: boolean
  assetId?: string
  reason?: string
}

/** 台账条目 → 必需素材位清单（`status !== 'ok'` 即未完成；"读到"不算完成） */
export function requiredSlotsFromEntries(
  entries: { slotId: string; slot: string; status: string; assetId?: string; reason?: string }[],
): RequiredSlot[] {
  return (entries || []).map((e) => ({
    slotId: e.slotId,
    slot: e.slot,
    done: e.status === 'ok',
    assetId: e.assetId || undefined,
    reason: e.reason || undefined,
  }))
}

/** 素材阶段的**数量性事实**（`MaterializeInfo` 的可判定子集；纯数字，不靠文案） */
export interface MaterialFacts {
  /** 无法解析的 `[[asset:…]]` 引用行数：引用不匹配 → 阻断 */
  residual?: number
  /** 从成品中剔除的素材协议残留行数：素材没落位 → 阻断 */
  residue?: number
  /** 声明分类与实际不符但用途兼容：可解释警告，不阻断、不触发整篇重写 */
  mismatched?: number
  /** 面向用户的明确错误（逐条进清单，按阻断处理——素材失败是用户可见缺陷） */
  errors?: string[]
  /** 必需素材位（台账未完成项） */
  requiredSlots?: RequiredSlot[]
}

export function issuesFromMaterial(facts: MaterialFacts | undefined): DeliveryIssue[] {
  if (!facts) return []
  const out: DeliveryIssue[] = []
  const residual = facts.residual || 0
  if (residual > 0) {
    out.push(
      mk({
        code: ISSUE_CODES.assetUnresolved,
        severity: 'blocking',
        message: `有 ${residual} 处库素材引用无法解析，对应素材没有落位（库素材引用缺失）`,
        evidence: `residual=${residual}`,
        repairKind: 'restore-asset',
      }),
    )
  }
  const residue = facts.residue || 0
  if (residue > 0) {
    out.push(
      mk({
        code: ISSUE_CODES.assetProtocolResidue,
        severity: 'blocking',
        message: `有 ${residue} 行素材协议未能落位、已从成品中剔除（该处素材缺失）`,
        evidence: `residue=${residue}`,
        repairKind: 'restore-asset',
      }),
    )
  }
  const mismatched = facts.mismatched || 0
  if (mismatched > 0) {
    out.push(
      mk({
        code: ISSUE_CODES.assetCategoryMismatch,
        severity: 'warning',
        message: `有 ${mismatched} 处素材声明分类与实际分类不一致（用途兼容，仅提示）`,
        evidence: `mismatched=${mismatched}`,
        repairKind: 'none',
      }),
    )
  }
  for (const err of facts.errors || []) {
    if (!String(err || '').trim()) continue
    out.push(
      mk({
        code: ISSUE_CODES.assetError,
        severity: 'blocking',
        message: String(err),
        evidence: 'image-agent errors[]',
        repairKind: 'restore-asset',
      }),
    )
  }
  for (const s of facts.requiredSlots || []) {
    if (s.done) continue
    out.push(
      mk({
        code: ISSUE_CODES.assetRequiredIncomplete,
        severity: 'blocking',
        message: `必需素材位「${s.slot || s.slotId}」未完成${s.reason ? '：' + s.reason : ''}`,
        slotId: s.slotId,
        assetId: s.assetId,
        required: true,
        evidence: `slotId=${s.slotId}；status≠ok；reason=${s.reason || '（未记录）'}`,
        repairKind: 'restore-asset',
      }),
    )
  }
  return out
}

// ---------- ④ 栅格类（实际显示尺寸下的可见性） ----------

/**
 * 栅格检查的输入。**本模块不做渲染**：rasterStats 需要浏览器画布，属于调用方环境，
 * 这里只消费已经算好的不达标原因（`checkRaster` 的返回），补上素材位身份并计入门禁。
 */
export interface RasterInput {
  /** 角色：deco / wide / inline / divider / photo-frame / heading … */
  kind: string
  slotId?: string
  assetId?: string
  refs?: string[]
  /** checkRaster 的不达标原因（仅作证据与展示） */
  failures: string[]
  /** 实际显示尺寸（px）——"按真实尺寸判定"是阶段 5 的口径 */
  targetWidth?: number
  /** 其它证据摘要（底色谱、对比度、主体像素等） */
  metrics?: string
}

export function issuesFromRaster(inputs: RasterInput[] | undefined, slots: SlotIndexEntry[] = []): DeliveryIssue[] {
  const out: DeliveryIssue[] = []
  for (const r of inputs || []) {
    if (!r || !r.failures || r.failures.length === 0) continue
    let slotId = r.slotId
    let assetId = r.assetId
    if (!slotId && r.refs && r.refs.length) {
      const hit = matchArtRefs(r.refs, slots)
      if (hit) {
        slotId = hit.entry.slotId
        assetId = assetId || hit.entry.assetId
      }
    }
    out.push(
      mk({
        code: ISSUE_CODES.rasterNotPassed,
        severity: 'blocking',
        message: `素材（${r.kind}）在实际显示尺寸下未通过栅格质检：${r.failures[0]}${r.failures.length > 1 ? `（另有 ${r.failures.length - 1} 项）` : ''}`,
        slotId,
        assetId,
        required: true,
        evidence: `kind=${r.kind}${r.targetWidth ? `；显示宽度=${r.targetWidth}px` : ''}；${r.metrics || ''}；不达标项：${r.failures.join('；')}`,
        repairKind: 'restore-asset',
      }),
    )
  }
  return out
}

// ---------- ⑤ 正文完整性（可证伪的片段对比，不是布尔） ----------

export type FactKind = 'date' | 'time' | 'number' | 'phone' | 'name' | 'place' | 'quote'

/** 需被保护的事实片段（姓名/时间/地点/数字/电话/引语） */
export interface FactToken {
  kind: FactKind
  /** 原文显示形式（给用户看的那一份，不做改写） */
  text: string
  /**
   * 规范化值：**同一事实的不同书写 → 同一字符串**，不同事实绝不并成一个。
   * 匹配只认 canon，不再用裸字符串包含判断（`afterAll.includes(text)`）——
   * 那既会把 `负责接待的是张老师` 整段当姓名，也会漏掉 `8:30 → 18:30` 这种"新值包含旧值"的改写。
   */
  canon: string
}

export interface BodyFragment {
  kind: 'lost' | 'changed' | 'reordered' | 'added'
  /** 具体片段（可证伪：调用方可以直接拿去核对） */
  text: string
  /** 改写类片段：改动后的文本 */
  after?: string
  /** 相似度（改写类） */
  similarity?: number
  /** before 侧行号（1-based，0 = 未知） */
  beforeLine?: number
  afterLine?: number
  /** 为什么算退化/改动 */
  reason: string
  /** 该片段涉及的事实 */
  facts?: string[]
}

export interface BodyIntegrityResult {
  ok: boolean
  lost: BodyFragment[]
  changed: BodyFragment[]
  reordered: BodyFragment[]
  added: BodyFragment[]
  /** before 里出现、after 里找不到的事实片段（姓名/时间/地点/数字/引语） */
  factsMissing: FactToken[]
  /** 统计：before/after 的片段数与被保护事实数 */
  stats: { beforeUnits: number; afterUnits: number; matched: number; facts: number }
  summary: string
}

export interface BodyIntegrityOptions {
  /** 用户本轮明确要求改动的目标行（before 侧行号闭区间）：目标内不做退化判定 */
  ignore?: SourceRange[]
  /** 相似判定阈值（默认 0.6）：≥ 阈值算"改写"，低于算"丢失" */
  similarityThreshold?: number
}

/**
 * 事实抽取规则表。每条给出：匹配正则、取哪一段作为显示文本、以及**规范化**函数。
 *
 * 规范化边界（计划 §4.3 要求"实现应声明可支持的规范化边界，不把宽泛'语义差不多'当作自动豁免"）：
 * - 支持：`8 点 30 分` / `08:30` / `8:30` 是同一时刻；`20 25年9月1日` 与 `2025-09-01` 是同一日期；
 *   电话的空格/连字符展示差异；姓名前后句式调整（`负责接待的是张老师` ↔ `张老师负责接待`）。
 * - **不支持**（一律按不同事实阻断）：任何数值、单位、年份、时刻的**实际变化**
 *   （`8:30 → 18:30`、`100名 → 1000名`、电话尾号追加一位）；同义改写、语义近似。
 */
const FACT_PATTERNS: {
  kind: FactKind
  re: RegExp
  pick: (m: RegExpMatchArray) => string
  canon: (raw: string) => string
}[] = [
  // 电话：优先于"数字"识别，否则 010-55556666 会被拆成 010 / 55556666 两段，
  // 而"尾号追加一位"这种改动正好落在拆分后的残缺匹配上（实测漏检）。
  // `(?!\d)` 必须要有：没有它，"010-555566660" 会匹配到前 8 位，和原号规范化成同一个值。
  {
    kind: 'phone',
    re: /(?:\+?86[-\s]?)?(?:0\d{1,3}(?:[-\s]?\d){7,9}(?!\d)|1[3-9]\d{9}(?!\d))/g,
    pick: (m) => m[0],
    canon: (raw) => raw.replace(/\D/g, ''),
  },
  // 日期：2025年9月1日 / 2025-09-01 / 2025/9/1 / 9月1日
  {
    kind: 'date',
    re: /\d{4}\s*[-/年.]\s*\d{1,2}\s*[-/月.]\s*\d{1,2}\s*日?|\d{1,2}\s*月\s*\d{1,2}\s*日/g,
    pick: (m) => m[0],
    canon: (raw) => {
      const n = raw.match(/\d+/g) || []
      if (n.length >= 3) return `${n[0]}-${String(n[1]).padStart(2, '0')}-${String(n[2]).padStart(2, '0')}`
      if (n.length === 2) return `${String(n[0]).padStart(2, '0')}-${String(n[1]).padStart(2, '0')}`
      return raw.replace(/\s+/g, '')
    },
  },
  // 时刻：`8:30` / `08：30` / `8 点 30 分` / `8点`，**含时段限定词**（上午/下午/晚上…）。
  //
  // 时段为什么必须进 token（DS 修复指南 §4.1 第 2 条）：旧实现只抽数字，`上午8 点 30 分`
  // 与 `下午8 点 30 分` 都规范化成 `08:30`——把"上午改成下午"这种**真实的时刻变更**
  // 判成"事实还在"，于是自动修订放行了改坏时间的那一版。
  //
  // 等价范围（显式声明，不靠"语义差不多"）：
  // - 时段 + 12 小时制 → 24 小时制：`下午8:30` ≡ `20:30`、`晚上8 点` ≡ `20:00`；
  //   `上午8:30` ≡ `08:30`；`上午12点` ≡ `00:00`，`下午12点`/`中午12点` ≡ `12:00`；
  // - **无时段**表达规范成独立的 `any` 段：`8:30` 既不等于 `上午8:30` 也不等于 `20:30`——
  //   没写时段就是没写，不能替作者选一个（只去格式，不去时段含义）。
  // - 已是 24 小时制且 ≥13 点 → 归一为 `pm` 段，因此 `20:30` 与 `下午8:30` 相等（同一事实的两种写法）。
  {
    kind: 'time',
    re: /(?:(上午|下午|中午|凌晨|早上|晚上|傍晚|夜里|深夜)\s*)?(\d{1,2}\s*[:：]\s*\d{2}(?!\d)|\d{1,2}\s*点(?:\s*\d{1,2}\s*分)?)/g,
    pick: (m) => m[0],
    canon: (raw) => {
      const t = String(raw)
      const w = (/^(上午|下午|中午|凌晨|早上|晚上|傍晚|夜里|深夜)/.exec(t) || [])[1] || ''
      const n = t.match(/\d+/g) || []
      let h = Number(n[0] || 0)
      const mi = n.length > 1 ? Number(n[1]) : 0
      // 上午/早上/凌晨 → am；其余限定词 → pm（中午与下午同为 12 小时制的后半段）
      let scope = w ? (/^(上午|早上|凌晨)$/.test(w) ? 'am' : 'pm') : 'any'
      if (scope === 'am') {
        if (h === 12) h = 0 // 上午12点 = 00:00
      } else if (scope === 'pm') {
        if (h === 12) h = 12 // 下午/中午12点 = 12:00
        else if (h < 12) h += 12
      } else if (!w && h >= 13) {
        scope = 'pm' // 无时段但已是 24 小时制下午：与"下午N点"是同一事实
      }
      return `${scope}|${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
    },
  },
  // 姓名：**姓名 + 称谓**，且必须满足两条结构约束（无 NLP，只能靠确定性约束把假姓名挡在外面）：
  //   ① 姓名那一段必须**整体是一个真实姓氏**（单姓表 / 复姓表），不是任意汉字；
  //   ② 姓氏前面必须是边界（行首/标点/空白）或明确的引介字（的/是/由/和…）。
  // 为什么必须这么严：`([一-龥]{1,6})` 会把上下文词一起吞进来——实测 `感谢老师们的辛勤付出`
  // 抽出过 `感谢老师`、`也感谢各位同学` 抽出过 `也感谢各位同学`。这些**假事实**会让一次
  // 正常改写（`感谢老师…` → `感谢各位老师…`）被判"姓名丢失"进而阻断整条修复链，
  // 用户看到的拒稿理由是"正文事实丢失（name）：感谢老师"——比漏检更糟。
  {
    kind: 'name',
    re: /(?:^|[，。、；：！？\s(（"“]|的|是|了|由|和|与|跟|同|请|给|让|向|对|为|被)((?:欧阳|司马|诸葛|上官|皇甫|尉迟|令狐|慕容|东方|独孤|南宫|长孙|宇文|轩辕|夏侯|闻人|赫连|澹台|端木|拓跋|呼延|[王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗郑梁宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严武戴莫孔向汤]))(老师|同学|先生|女士|教授|校长|主任|经理|书记|院长|队长|医生)/g,
    pick: (m) => m[1] + m[2],
    canon: (raw) => raw.replace(/\s+/g, ''),
  },
  // 地点：常见地点后缀。前导允许标点/空白/行首，也允许"在/于/到/去/往/从"这类处所介词——
  // 否则最自然的写法"活动在东区操场举行"永远抽不出地名，删掉地点也就永远检不出来。
  // 后缀**只收多字词**：早先为了凑"图书馆"补进去的单字（馆/楼/厅/堂/园/苑）会把
  // `周末到馆提醒` 里的"周末到馆"抽成地名，是纯假事实。
  {
    kind: 'place',
    re: /(?:^|[，。、；：！？\s(（"“]|在|于|到|去|往|从)([一-龥]{0,6}(?:大学|学院|中学|小学|学校|医院|车站|机场|广场|公园|体育馆|图书馆|大厦|大道|操场|教学楼|路|街|村|镇|区|县|市|省))/g,
    pick: (m) => placeOf(m[1]),
    canon: (raw) => raw.replace(/\s+/g, ''),
  },
  // 引语：引号里的原话。规范化要**吃掉引语内部的标点**——
  // `他说“欢迎光临”` 与 `他说：“欢迎光临！”` 是同一句原话，只差标点，
  // 若标点参与比对就会被判"引语丢失"（实测误报）。
  {
    kind: 'quote',
    re: /[“"「]([^”"」]{2,})[”"」]/g,
    pick: (m) => m[1],
    canon: (raw) => raw.replace(/[\s，。、；：！？!?;:,.]/g, ''),
  },
  // 数量+单位：金额/人数/次数……（保留单位含义，100名 与 1000名 不是同一个事实）
  {
    kind: 'number',
    re: /\d+(?:\.\d+)?\s*(?:%|％|万元|亿元|元|人|位|名|次|个|件|篇|天|周|岁|届|米|公里|千克|kg|吨|万|亿)/g,
    pick: (m) => m[0],
    canon: (raw) => raw.replace(/\s+/g, ''),
  },
  // 裸数字（编号、门牌、日期片段之外的多位数字）
  { kind: 'number', re: /\d{2,}/g, pick: (m) => m[0], canon: (raw) => raw.replace(/\s+/g, '') },
]

/** 事实优先级：数值精确的排在前面，重叠时保留高优先级那条（`8:30` 不该再被拆出一个裸 `30`） */
const FACT_PRIORITY: FactKind[] = ['phone', 'date', 'time', 'name', 'place', 'quote', 'number']

/**
 * 从"边界 + 若干上下文词 + 地名"的捕获里剥出**真正的地名**。
 *
 * 为什么需要这一步：正则的 `(?:^|[标点]|在|于…)` 允许起点落在行首或标点上，
 * 而地名前的 `[一-龥]{2,6}` 会把**上下文标签**一起吞进来——实测
 * `本次活动由学生会主办，地点在图书馆三楼报告厅。` 抽出的地名是 `地点在图书馆`。
 * 那是假事实：改写句式就会误报"地点丢失"。
 *
 * 处理：剥掉常见上下文标签（地点/现场/时间…）与处所介词（在/于/到/去/往/从），
 * 剥完不足 2 个字就丢弃这条命中（宁可漏检也不产出假事实）。
 */
const PLACE_LABEL = /^(?:地点|位置|地址|现场|会场|时间|活动|本次|本周|周末|今天|明天|昨天|届时|其中|这里|那里)/
const PLACE_PREP = /^[在于到去往从]/
/** 中段出现的处所介词（非行首）——它前面那截是**被正则吞进来的上下文**，不是地名本身 */
const PLACE_PREP_ANY = /[在于到去往从]/
/**
 * 从"边界 + 若干上下文词 + 地名"的捕获里剥出**真正的地名**。
 *
 * 为什么需要这一步：正则的 `(?:^|[标点]|在|于…)` 允许起点落在行首或标点上，
 * 而地名前的 `[一-龥]{0,6}` 会把**上下文词**一起吞进来——实测
 * `本次活动由学生会主办，地点在图书馆三楼报告厅。` 抽出的地名是 `地点在图书馆`。
 * 那是假事实：改写句式就会误报"地点丢失"。
 *
 * 第二类吞进来的形态更隐蔽（DS 修复指南 §4.1 第 1 条）：前导是**空白**时，`[一-龥]{0,6}`
 * 可以跨过一个处所介词继续往前抓——`…30 分在东区操场举行` 抽出的地名是 `分在东区操场`。
 * 它比真正的地点多一个字，于是与时刻 token（`…8 点 30 分`，含那个"分"）**范围重叠**，
 * 在 `extractFacts` 的重叠消解里被整项丢弃：首稿**根本抽不出地名**，
 * 下一轮把"在东区操场"删掉自然也就"没有事实丢失"。修复方式：介词把捕获切成两段，
 * 真正的地名在介词**之后**（`清理上下文后重新计算范围`）。
 *
 * 处理：剥掉常见上下文标签与**行首**处所介词；若仍含中段介词，取其后的部分；
 * 剥完不足 2 个字就丢弃这条命中（宁可漏检也不产出假事实）。
 */
function placeOf(raw: string): string {
  let s = String(raw || '')
  for (let i = 0; i < 3; i++) {
    const before = s
    s = s.replace(PLACE_LABEL, '').replace(PLACE_PREP, '')
    if (s === before) break
  }
  const m = PLACE_PREP_ANY.exec(s)
  if (m && m.index > 0) s = s.slice(m.index + 1)
  return s.length >= 2 ? s : ''
}

/** 抽取需保护的事实片段（确定性正则，纯函数；顺序稳定，便于对比） */
export function extractFacts(text: string): FactToken[] {
  const s = String(text || '')
  interface Hit {
    kind: FactKind
    text: string
    canon: string
    start: number
    end: number
  }
  const hits: Hit[] = []
  for (const p of FACT_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags)
    for (const m of s.matchAll(re)) {
      const raw = String(m[0])
      const picked = String(p.pick(m as RegExpMatchArray) || '').trim()
      if (!picked) continue
      // pick 可能只取了子串（姓名、地点都去掉了前导标点）：位置要跟着走，重叠判定才准
      const rel = raw.indexOf(picked)
      const start = (m.index ?? 0) + (rel >= 0 ? rel : 0)
      hits.push({ kind: p.kind, text: picked, canon: String(p.canon(picked)), start, end: start + picked.length })
    }
  }
  // 同一段文字只保留优先级最高的事实：否则 `8:30` 会同时产出 time|08:30 与 number|30，
  // 而"30"这种碎片又会和别处的数字互相干扰。
  hits.sort(
    (a, b) =>
      FACT_PRIORITY.indexOf(a.kind) - FACT_PRIORITY.indexOf(b.kind) ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  )
  const taken: Hit[] = []
  const out: FactToken[] = []
  const seen = new Set<string>()
  for (const h of hits) {
    if (!h.canon) continue
    if (taken.some((t) => h.start < t.end && t.start < h.end)) continue
    taken.push(h)
    const key = h.kind + '|' + h.canon
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: h.kind, text: h.text, canon: h.canon })
    if (out.length >= 300) break
  }
  return out
}

const UNIT_PUNCT = /[\s，。、；：""''「」『』《》（）()\[\]{}<>!?,.;:~～·—\-—_*#|`"'’“”]/g

function normUnit(s: string): string {
  return String(s || '').replace(UNIT_PUNCT, '')
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2)
    m.set(g, (m.get(g) || 0) + 1)
  }
  if (s.length === 1) m.set(s, 1)
  return m
}

/** 字符二元组 Dice 相似度（0..1）：用于区分"改写"与"丢失"，避免把改写一律当丢失 */
export function similarity(a: string, b: string): number {
  const x = normUnit(a)
  const y = normUnit(b)
  if (!x && !y) return 1
  if (!x || !y) return 0
  if (x === y) return 1
  const A = bigrams(x)
  const B = bigrams(y)
  let inter = 0
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0)
  // 二元组总数：长度 n 的串有 n-1 个二元组（单字符串按 1 算）
  const size = (x.length > 1 ? x.length - 1 : 1) + (y.length > 1 ? y.length - 1 : 1)
  return size ? (2 * inter) / size : 0
}

interface Unit {
  text: string
  line: number
}

function splitUnits(text: string): Unit[] {
  const out: Unit[] = []
  const lines = String(text || '').split(/\r?\n/)
  lines.forEach((ln, idx) => {
    const parts = ln
      .split(/(?<=[。！？!?；;])/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const p of parts) out.push({ text: p, line: idx + 1 })
  })
  return out
}

function inRanges(line: number, ranges: SourceRange[]): boolean {
  return ranges.some((r) => line >= r.line && line <= r.endLine)
}

/**
 * 两版正文对比：给出**具体丢失/改动的片段**（可证伪），而不是一个布尔。
 *
 * 口径（计划 §5"正文保护"）：
 * - 对目标以外节点做文本/顺序比较，保护已有姓名、时间、地点、数字等事实；
 * - **不把"与旧稿不同"一律当退化**：改写（事实还在）只是 warning，只有整片段丢失或事实丢失才判失败；
 * - 模型承诺"保留了"不是证据，落到这里的片段才作数。
 */
export function bodyIntegrity(before: string, after: string, opts?: BodyIntegrityOptions): BodyIntegrityResult {
  const ignore = opts?.ignore || []
  const threshold = opts?.similarityThreshold ?? 0.6
  const beforeUnits = splitUnits(before).filter((u) => !inRanges(u.line, ignore))
  const afterUnits = splitUnits(after)
  const afterNorm = afterUnits.map((u) => normUnit(u.text))

  const usedAfter = new Set<number>()
  const lost: BodyFragment[] = []
  const changed: BodyFragment[] = []
  const matchedOrder: number[] = [] // before 侧命中顺序（用于顺序变化判定）

  for (const bu of beforeUnits) {
    const bn = normUnit(bu.text)
    if (!bn) continue
    let exact = -1
    for (let k = 0; k < afterNorm.length; k++) {
      if (usedAfter.has(k)) continue
      if (afterNorm[k] === bn) {
        exact = k
        break
      }
    }
    if (exact >= 0) {
      usedAfter.add(exact)
      matchedOrder.push(exact)
      continue
    }
    // 找最相似的未用片段
    let best = -1
    let bestScore = 0
    for (let k = 0; k < afterNorm.length; k++) {
      if (usedAfter.has(k)) continue
      const sc = similarity(bu.text, afterUnits[k].text)
      if (sc > bestScore) {
        bestScore = sc
        best = k
      }
    }
    const facts = extractFacts(bu.text).map((f) => f.text)
    if (best >= 0 && bestScore >= threshold) {
      usedAfter.add(best)
      matchedOrder.push(best)
      changed.push({
        kind: 'changed',
        text: bu.text,
        after: afterUnits[best].text,
        similarity: Number(bestScore.toFixed(3)),
        beforeLine: bu.line,
        afterLine: afterUnits[best].line,
        reason: `片段被改写（相似度 ${bestScore.toFixed(2)}）`,
        facts,
      })
    } else {
      lost.push({
        kind: 'lost',
        text: bu.text,
        beforeLine: bu.line,
        reason: '旧稿片段在新稿中找不到对应内容（未匹配到任何相似片段）',
        facts,
      })
    }
  }

  const added: BodyFragment[] = []
  for (let k = 0; k < afterUnits.length; k++) {
    if (usedAfter.has(k)) continue
    added.push({ kind: 'added', text: afterUnits[k].text, afterLine: afterUnits[k].line, reason: '新稿新增片段（不视为退化）' })
  }

  // 顺序：命中序列是否单调递增。非单调 = 对目标以外节点动了顺序
  const reordered: BodyFragment[] = []
  for (let k = 1; k < matchedOrder.length; k++) {
    if (matchedOrder[k] < matchedOrder[k - 1]) {
      const u = beforeUnits[k]
      reordered.push({
        kind: 'reordered',
        text: u.text,
        beforeLine: u.line,
        afterLine: afterUnits[matchedOrder[k]]?.line,
        reason: '在旧稿顺序中靠后的片段被移到了前面（对目标以外节点动了顺序）',
      })
      break
    }
  }

  // 事实保护只在**目标以外**的旧稿内容上做：用户明确要求改的那几行，其事实不算"丢失"，
  // 否则"改一行"会被误判成"丢事实"，把正常定点修订挡在门外。
  const beforeScoped = beforeUnits.map((u) => u.text).join('\n')
  const beforeFacts = extractFacts(beforeScoped)
  // 匹配只认**规范化值**（kind|canon），不再用 `afterAll.includes(text)`：
  // 后者既会把 `8:30` 的改写（`18:30`）当成"新值包含旧值"而漏检，也会把同义改写误判成丢失。
  const afterCanon = new Set(extractFacts(String(after || '')).map((f) => f.kind + '|' + f.canon))
  const factsMissing: FactToken[] = []
  const seenFact = new Set<string>()
  for (const f of beforeFacts) {
    const key = f.kind + '|' + f.canon
    if (seenFact.has(key)) continue
    seenFact.add(key)
    if (!afterCanon.has(key)) factsMissing.push(f)
  }

  // 口径一致性（计划 §4.3）：`body.ok`、问题清单、`gate.bodyIntegrityOk`、总判定必须同源。
  // 因此这里**只**由事实缺失决定——片段丢失在 `issuesFromBody` 里是 warning，
  // 若 ok 仍因它变 false，就会出现"清单里没有阻断项、判定却过不去"的自相矛盾（实测把修复永远挡在门外）。
  const ok = factsMissing.length === 0
  const summary = ok
    ? `正文完整性通过：事实缺失 0 项（片段丢失 ${lost.length} 处仅提示、改写 ${changed.length} 处、新增 ${added.length} 处、顺序变化 ${reordered.length} 处）`
    : `正文完整性未通过：事实缺失 ${factsMissing.length} 项（片段丢失 ${lost.length} 处仅提示）`
  return {
    ok,
    lost,
    changed,
    reordered,
    added,
    factsMissing,
    stats: { beforeUnits: beforeUnits.length, afterUnits: afterUnits.length, matched: matchedOrder.length, facts: beforeFacts.length },
    summary,
  }
}

/** 正文完整性 → 统一问题（丢失/事实缺失阻断；改写与顺序变化只警告；新增仅 info） */
export function issuesFromBody(b: BodyIntegrityResult | null | undefined): DeliveryIssue[] {
  if (!b) return []
  const out: DeliveryIssue[] = []
  for (const f of b.lost) {
    out.push(
      mk({
        code: ISSUE_CODES.bodyTextLost,
        // warning（不是 blocking）——计划 §5.6 的两句必须同时成立：
        //   "无关段落变化 → 撤销候选" 与 "**不能**将'与旧稿不同'一律当退化"。
        // 本模块做的是**全文纯文本**比较，没有节点级的"目标/非目标"划分，因此
        // 每一处片段丢失在它眼里都长得像"无关段落变化"——包括**修复本身要删掉的那段违规文字**
        // （实测：违规稿里的 emoji 段落被重写掉后，这里会报 blocking，于是修复永远无法生效）。
        // 折中且可证伪的口径：**片段丢失只作提示**（附原文与行号，由用户判断），
        // **事实丢失（姓名/时间/地点/数字）仍然阻断**——那才是"内容真的少了"的精确信号。
        severity: 'warning',
        message: `正文片段丢失：${clip(f.text, 60)}`,
        line: f.beforeLine,
        evidence: `旧稿第 ${f.beforeLine || '?'} 行片段在新稿中找不到；原文：${clip(f.text, 120)}。片段丢失不等于退化（可能正是本轮修复要改写的那段），需人工确认`,
        repairKind: 'normalize',
      }),
    )
  }
  for (const f of b.factsMissing) {
    out.push(
      mk({
        code: ISSUE_CODES.bodyFactLost,
        severity: 'blocking',
        message: `正文事实丢失（${f.kind}）：${f.text}`,
        evidence: `旧稿中的事实「${f.text}」在新稿里不再出现；模型声称"保留了"不算证据`,
        repairKind: 'reparse',
      }),
    )
  }
  for (const f of b.changed) {
    out.push(
      mk({
        code: ISSUE_CODES.bodyTextChanged,
        severity: 'warning',
        message: `正文片段被改写：${clip(f.text, 40)} → ${clip(f.after || '', 40)}`,
        line: f.beforeLine,
        evidence: `相似度 ${f.similarity}；改写不等于退化，仅需确认语义未被削掉`,
        repairKind: 'normalize',
      }),
    )
  }
  for (const f of b.reordered) {
    out.push(
      mk({
        code: ISSUE_CODES.bodyOrderChanged,
        severity: 'warning',
        message: `正文顺序变化：${clip(f.text, 40)}`,
        line: f.beforeLine,
        evidence: f.reason,
        repairKind: 'normalize',
      }),
    )
  }
  for (const f of b.added) {
    out.push(
      mk({
        code: ISSUE_CODES.bodyTextAdded,
        severity: 'info',
        message: `正文新增片段：${clip(f.text, 40)}`,
        line: f.afterLine,
        evidence: '新增不视为退化',
        repairKind: 'none',
      }),
    )
  }
  return out
}

function clip(s: string, n: number): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : t.slice(0, n) + '…'
}

// ---------- ⑥ 容量（按已验证的目标格式规则判定） ----------

export interface CapacityRule {
  name: string
  limit: number
  /** 度量对象：源文 / 渲染 HTML / 纯文本——**三者不是同一个尺寸**（计划 §4 明确要求先核实度量阶段） */
  measure: 'source' | 'html' | 'plainText'
  /** 是否已在目标平台验证过。未验证的规则只登记为"长度风险"，不当作平台拒绝事实 */
  verified: boolean
  note: string
}

export const CAPACITY_RULES: CapacityRule[] = [
  {
    name: 'wechat-body-20000',
    limit: 20000,
    measure: 'html',
    verified: false,
    note:
      '现有 20000 字符规则的计算对象是**渲染 HTML 长度**，与源文、内嵌图片数据、实际发布格式都不是同一尺寸；' +
      '未在微信后台验证前，不得当作"平台一定会拒绝"的既成事实，也不擅自移除保护。',
  },
]

export interface CapacityInput {
  source?: string
  html?: string
  plainText?: string
  rules?: CapacityRule[]
}

/** 容量判定：未验证的规则 → warning（长度风险）；已验证 → 阻断 */
export function issuesFromCapacity(input: CapacityInput): DeliveryIssue[] {
  const out: DeliveryIssue[] = []
  const rules = input.rules || CAPACITY_RULES
  for (const r of rules) {
    const text = r.measure === 'source' ? input.source : r.measure === 'plainText' ? input.plainText : input.html
    if (text === undefined) continue
    const len = String(text).length
    if (len < r.limit) continue
    out.push(
      mk({
        code: ISSUE_CODES.capacityOverLimit,
        severity: r.verified ? 'blocking' : 'warning',
        message: `${r.name}：${measureLabel(r.measure)}当前约 ${len}，超过规则上限 ${r.limit}${r.verified ? '（已验证规则，阻断）' : '（规则未在平台验证，按长度风险登记，不阻断）'}`,
        evidence: `${r.note}；度量对象=${r.measure}；实测=${len}；limit=${r.limit}`,
        repairKind: 'capacity-recheck',
      }),
    )
  }
  return out
}

function measureLabel(m: CapacityRule['measure']): string {
  return m === 'source' ? '源文长度' : m === 'plainText' ? '正文纯文本长度' : '渲染 HTML 长度'
}

// ---------- ⑦ 推荐性提示（有意短篇 / 推荐性组件 / 照片位待补） ----------

export interface SoftFacts {
  plainTextLength: number
  htmlLength: number
  artCount: number
  imageCount: number
  containerCount: number
  bubbleCount: number
  listOrQuoteCount: number
  photoSlotCount: number
  scale: 'short' | 'mid' | 'long'
}

/**
 * 从源文统计"规模事实"（与 compose 同口径的确定性正则）。
 * 这些只是**产物规模度量**，用来把提示分档——不参与任何对话/意图判断（铁律 6）。
 */
export function softFacts(input: { source?: string; plainText?: string; html?: string; artCount?: number; imageCount?: number }): SoftFacts {
  const src = String(input.source || '')
  const plainText = String(input.plainText || '')
  const containers = (src.match(/^:::\s*(?:steps|cols|card|band|frame|timeline)\b/gm) || []).length
  const bubbles = (src.match(/^>\s*\[!/gm) || []).length
  const listOrQuote = (src.match(/^\s*[-*+]\s+/gm) || []).length + (src.match(/^>\s*(?!\[!)/gm) || []).length
  const artBlocks = (src.match(/^:::\s*art\b(?!\s+deco)/gm) || []).length
  const photoSlotCount = photoSlots(src).length
  const len = plainText.length
  return {
    plainTextLength: len,
    htmlLength: String(input.html || '').length,
    artCount: input.artCount === undefined ? artBlocks : input.artCount,
    imageCount: input.imageCount || 0,
    containerCount: containers,
    bubbleCount: bubbles,
    listOrQuoteCount: listOrQuote,
    photoSlotCount,
    scale: len < 350 ? 'short' : len < 1400 ? 'mid' : 'long',
  }
}

/** 源文里的照片位行号（`::: photo` 是单行指令） */
export function photoSlots(source: string): number[] {
  const out: number[] = []
  String(source || '')
    .split(/\r?\n/)
    .forEach((l, i) => {
      if (/^:::\s*photo\b/.test(l.trim())) out.push(i + 1)
    })
  return out
}

/**
 * 推荐性提示：**全部是 info，绝不阻断**（计划 §4 表格最后两行）。
 * 这正是替换 `revise.fixableWarnings` 的地方：以前"组件化不足"这类推荐项会触发整篇自动重写，
 * 现在它们只是提示，重写与否由调用方按预算决定。
 */
export function issuesFromSoft(f: SoftFacts | undefined): DeliveryIssue[] {
  if (!f) return []
  const out: DeliveryIssue[] = []
  if (f.scale === 'short') {
    out.push(
      mk({
        code: ISSUE_CODES.bodyIntentionalShort,
        severity: 'info',
        message: `短篇口径（正文约 ${f.plainTextLength} 字）：不因组件/素材数量阻断成品`,
        evidence: `plainTextLength=${f.plainTextLength} < 350`,
        repairKind: 'none',
      }),
    )
  }
  if (f.plainTextLength < 600) {
    out.push(
      mk({
        code: ISSUE_CODES.bodyShortHint,
        severity: 'info',
        message: `正文偏短（约 ${f.plainTextLength} 字），建议 1500-2500 字（用户明确要求短篇除外）`,
        evidence: `plainTextLength=${f.plainTextLength}`,
        repairKind: 'none',
      }),
    )
  }
  const floor = f.scale === 'mid' ? 3 : 4
  if (f.artCount === 0 && f.photoSlotCount === 0) {
    out.push(
      mk({
        code: ISSUE_CODES.componentsTip,
        severity: 'info',
        message: '正文未包含美术素材：建议为横幅/小节/气泡等装饰位补现场绘制素材（推荐项，不阻断）',
        evidence: `artCount=0；scale=${f.scale}`,
        repairKind: 'none',
      }),
    )
  } else if (f.artCount === 0 && f.photoSlotCount > 0) {
    out.push(
      mk({
        code: ISSUE_CODES.componentsPhotoOnlyTip,
        severity: 'info',
        message: '正文只有照片位、没有装饰插画：真实照片是信息画面，组件装饰位仍建议配生成插画（推荐项，不阻断）',
        evidence: `artCount=0；photoSlotCount=${f.photoSlotCount}`,
        repairKind: 'none',
      }),
    )
  } else if (f.artCount < floor && f.photoSlotCount === 0) {
    out.push(
      mk({
        code: ISSUE_CODES.componentsTip,
        severity: 'info',
        message: `素材用量偏低（当前 ${f.artCount} 处，建议 ${floor}-8 处并覆盖各组件装饰位；推荐项，不阻断）`,
        evidence: `artCount=${f.artCount} < floor=${floor}；scale=${f.scale}`,
        repairKind: 'none',
      }),
    )
  }
  if (f.containerCount < 2 || f.bubbleCount < 1 || f.listOrQuoteCount < 1) {
    out.push(
      mk({
        code: ISSUE_CODES.componentsStructureTip,
        severity: 'info',
        message:
          `没有使用排版组件（容器 ${f.containerCount} 个 / 气泡 ${f.bubbleCount} 个 / 列表或引用 ${f.listOrQuoteCount} 处）` +
          `${f.scale === 'short' ? '；短通知保持现状即可' : '，建议补 1 个气泡或 1 处列表'}（推荐项，不阻断）`,
        evidence: `containers=${f.containerCount}；bubbles=${f.bubbleCount}；listOrQuote=${f.listOrQuoteCount}`,
        repairKind: 'none',
      }),
    )
  }
  return out
}

/** 照片位待补：**不阻断**，但必须被明示（发布就绪检查单独判定，不自动伪造照片） */
export function issuesFromPhotoSlots(source: string): DeliveryIssue[] {
  return photoSlots(source).map((line) => {
    const text = String(source).split(/\r?\n/)[line - 1] || ''
    return mk({
      code: ISSUE_CODES.photoPending,
      severity: 'info',
      message: `照片位等待用户真实照片（第 ${line} 行）：${text.trim()}——创作草稿允许，发布就绪检查单独判定，系统不自动伪造照片`,
      line,
      evidence: `源文第 ${line} 行：${clip(text, 80)}`,
      repairKind: 'await-photo',
    })
  })
}

// ---------- 版本字段一致性（计划 §7：整组版本绑定） ----------

/** 一处版本字段快照：`scope` 例 'meta' | 'source' | 'html' | 'manifest' */
export interface VersionField {
  scope: string
  field: string
  value: string
}

/**
 * 版本字段核验。同一字段在不同文件里取值不同 → 阻断（否则会出现"新源文配旧 HTML"的混合版本）；
 * `required` 里的字段在任一已提供 scope 缺失 → 阻断。
 */
export function issuesFromVersion(fields: VersionField[] | undefined, required: string[] = []): DeliveryIssue[] {
  if (!fields || fields.length === 0) return []
  const out: DeliveryIssue[] = []
  const scopes = [...new Set(fields.map((f) => f.scope))]
  const byField = new Map<string, VersionField[]>()
  for (const f of fields) {
    const arr = byField.get(f.field) || []
    arr.push(f)
    byField.set(f.field, arr)
  }
  for (const [field, list] of byField) {
    const values = [...new Set(list.map((x) => String(x.value)))]
    if (values.length > 1) {
      out.push(
        mk({
          code: ISSUE_CODES.versionMismatch,
          severity: 'blocking',
          message: `版本字段「${field}」在各文件间不一致：${list.map((x) => `${x.scope}=${x.value}`).join(' / ')}`,
          evidence: `field=${field}；取值数=${values.length}；${list.map((x) => `${x.scope}=${x.value}`).join(' / ')}`,
          repairKind: 'revert-version',
        }),
      )
    }
  }
  for (const field of required) {
    const list = byField.get(field) || []
    const have = new Set(list.map((x) => x.scope))
    const missing = scopes.filter((s) => !have.has(s))
    if (missing.length || list.length === 0) {
      out.push(
        mk({
          code: ISSUE_CODES.versionMissing,
          severity: 'blocking',
          message: `必需版本字段「${field}」缺失（缺少于：${(missing.length ? missing : scopes).join(' / ') || '全部'}）`,
          evidence: `field=${field}；已提供 scope=${scopes.join('/')}；缺失 scope=${missing.join('/') || '（无任何取值）'}`,
          repairKind: 'revert-version',
        }),
      )
    }
  }
  return out
}

// ---------- 汇总入口 ----------

export interface DeliveryInput {
  /** 源文（用于行号定位、照片位与规模统计） */
  source?: string
  /** 渲染后的成品 HTML（泄漏检查 + checkHtml + 容量度量对象） */
  html?: string
  /** 渲染后正文纯文本（长度分档） */
  plainText?: string
  /** compose 解析结果的结构化问题（compose.issues） */
  composeIssues?: (ComposeIssue & { nodeId?: string })[]
  /** compose 拒收的现场素材块（compose.rejectedArts） */
  rejectedArts?: RejectedArt[]
  /** 素材位索引（`slotIndexFromLedger(ledger)`），用于把拒收映射回 slotId */
  slots?: SlotIndexEntry[]
  /** image-agent 的数量性事实 */
  material?: MaterialFacts
  /** 栅格（实际显示尺寸）检查结果 */
  raster?: RasterInput[]
  /** 正文完整性（`bodyIntegrity(before, after)` 的结果） */
  body?: BodyIntegrityResult | null
  /** 版本字段快照 */
  version?: VersionField[]
  /** 必需版本字段名 */
  requiredVersionFields?: string[]
  /** 规模事实（缺省时由 source/plainText 自行推导） */
  facts?: SoftFacts
  /** 排除某几类检查（不传即全查；**默认全查**，避免调用方无意旁路掉某一类） */
  skip?: QualityStage[]
  /** 额外问题（调用方自己的检查，同样进统一清单） */
  extra?: DeliveryIssue[]
}

/**
 * 汇总五类检查 + 容量 + 版本，输出**一条统一问题清单**。
 *
 * 关键设计：默认**全查**。调用方想少查必须显式 `skip`——这样"checkHtml 单独失败"不可能被绕过
 * （真实故障里正是 `checkHtml` 独立于修订与保存，红条照显示、稿子照保存）。
 */
export function collectDeliveryIssues(input: DeliveryInput): DeliveryIssue[] {
  const skip = new Set(input.skip || [])
  const out: DeliveryIssue[] = []
  const html = String(input.html || '')

  // 解析类：compose 的结构化问题（含 asset.rejected）+ 可见文本泄漏
  if (!skip.has('parse')) {
    for (const ci of input.composeIssues || []) {
      out.push(
        mk({
          code: ci.code,
          severity: ci.severity,
          message: ci.message,
          line: ci.line,
          endLine: ci.endLine,
          nodeId: ci.nodeId,
          evidence: ci.assetRefs && ci.assetRefs.length ? `assetRefs=${ci.assetRefs.join(' / ')}` : undefined,
        }),
      )
    }
  }
  if (html && !skip.has('parse')) out.push(...leakIssues(html, input.source))

  // 素材类：拒收映射回素材位 + 数量性事实
  if (!skip.has('material')) {
    out.push(...issuesFromRejected(input.rejectedArts || [], input.slots || []))
    out.push(...issuesFromMaterial(input.material))
  }
  if (!skip.has('raster')) out.push(...issuesFromRaster(input.raster, input.slots || []))

  // HTML 类：checkHtml 全量并入（这是"不走旁路"的保证）
  if (html && !skip.has('html')) out.push(...htmlIssues(html))

  // 正文完整性
  if (!skip.has('body')) out.push(...issuesFromBody(input.body))

  // 容量（按已验证规则判定；未验证 → 长度风险）
  if (!skip.has('capacity')) out.push(...issuesFromCapacity({ source: input.source, html: input.html, plainText: input.plainText }))

  // 版本字段
  if (!skip.has('version')) out.push(...issuesFromVersion(input.version, input.requiredVersionFields || []))

  // 提示类：有意短篇 / 推荐性组件 / 照片位待补（全部 info）
  const facts = input.facts || softFacts({ source: input.source, plainText: input.plainText, html: input.html })
  out.push(...issuesFromSoft(facts))
  out.push(...issuesFromPhotoSlots(String(input.source || '')))

  out.push(...(input.extra || []))
  return dedupeIssues(out)
}

// ---------- 交付判定 ----------

export type CheckState = 'pass' | 'fail' | 'unknown'

/**
 * 正文保留比较的**适用性**（计划 §4.2）。三种情境必须显式区分，
 * 不能再用 `body = null` 同时表示"不适用""没检查""检查失败"——那正是上一轮
 * "两轮都传 body=null、门禁却照样通过"的直接原因。
 */
export type BodyApplicability =
  /** 该比，并且拿到了结果（结果见 `body`） */
  | 'applied'
  /** 本来就没有可比对象：本回合**首个候选**（首次创作 / 用户主动修改的第一版） */
  | 'not-applicable'
  /** 该比却比不了：缺基准、正文投影失败、算不出来 → **阻断**，不许当通过 */
  | 'failed'

export interface DeliveryContext {
  /**
   * `checkHtml(html).ok`。传 false 时即使调用方忘了把 `html.*` 问题放进清单，也会在此处补一条阻断，
   * 杜绝"红条照显示、稿子照保存"。
   */
  htmlOk?: boolean
  /** 必需素材位（台账未完成项）：未全部完成 → 不允许提交成品 */
  requiredSlots?: RequiredSlot[]
  /** 正文完整性结果：未通过 → 不允许提交成品 */
  body?: BodyIntegrityResult | null
  /**
   * 本次正文保留比较的适用性。缺省按 `body` 是否有值推断（给了结果=applied，没给=not-applicable）；
   * 声称 `applied` 却没给结果 ⇒ 按 `failed` 处理并阻断——"该比却没比"绝不能静默变成通过。
   */
  bodyApplicability?: BodyApplicability
  /** 版本字段快照与必需字段 */
  version?: VersionField[]
  requiredVersionFields?: string[]
  /** 本轮实际检查过哪些阶段（未列出的阶段在 checks 里记 unknown，而不是假装通过） */
  stagesChecked?: QualityStage[]
  /** 是否存在已验收的历史版本：没有历史时**不得**宣称"已回滚" */
  hasAcceptedHistory?: boolean
}

export interface DeliveryVerdict {
  /** 是否允许**提交成品**（阻断项 0 + 必需素材完成 + 正文完整性通过 + 版本字段一致） */
  ok: boolean
  /** 是否满足"发布就绪"（在 ok 之上再要求：没有待补照片） */
  publishReady: boolean
  reason: 'accepted' | 'blocked' | 'draft-only'
  blockers: DeliveryIssue[]
  warnings: DeliveryIssue[]
  infos: DeliveryIssue[]
  /** 待补照片（info，但会让 publishReady 为 false） */
  pendingPhotos: DeliveryIssue[]
  /** 分阶段结论（pass/fail/unknown） */
  checks: Record<QualityStage, CheckState>
  gate: { blockers: number; requiredSlotsDone: boolean; bodyIntegrityOk: boolean; versionConsistent: boolean; bodyApplicability: BodyApplicability }
  /** 未能核验的事实（例如没有提供版本字段快照）——如实列出，不含糊通过 */
  unverified: string[]
  summary: string
  /** 硬性口径说明（UI/日志可直接展示） */
  notes: string[]
}

const ALL_STAGES: QualityStage[] = ['parse', 'material', 'raster', 'html', 'body', 'capacity', 'version']

/**
 * 交付判定。
 *
 * **明确写死两条口径**（计划 §4 原文，避免后来者再绕过去）：
 * 1. `checkHtml.ok` 单独为真**不等于**整稿通过——它只覆盖产品规范类，不覆盖素材落位、栅格、正文完整性与版本绑定；
 * 2. 磁盘保存成功**不等于**验收通过——保存的是"这一轮产物"，验收看的是门禁结论。
 *
 * 只有满足：阻断项为 0 && 必需素材全部完成 && 正文完整性通过 && 版本字段一致，才 `ok = true`。
 */
export function deliveryVerdict(issues: DeliveryIssue[], ctx?: DeliveryContext): DeliveryVerdict {
  const c = ctx || {}
  let list = dedupeIssues([...(issues || [])])

  // checkHtml.ok=false 但清单里没有 html 类问题 → 在这里补一条阻断，绝不允许旁路
  if (c.htmlOk === false && !list.some((i) => i.stage === 'html' && i.severity === 'blocking')) {
    list.push(
      mk({
        code: ISSUE_CODES.htmlCheckFailed,
        severity: 'blocking',
        message: 'HTML 质检未通过（checkHtml.ok=false）：必须并入统一门禁处理，不能只显示红条后继续提交',
        evidence: 'ctx.htmlOk=false 且问题清单中缺少 html.* 阻断项',
        repairKind: 'normalize',
      }),
    )
  }

  // 版本字段核验：ctx 里给了快照就必须并入清单（否则"版本一致"只是一个算出来给人看的布尔，
  // 问题本身却不出现在 blockers 里，UI/日志又看不到原因）
  const versionIssues = c.version && c.version.length ? issuesFromVersion(c.version, c.requiredVersionFields || []) : []
  if (versionIssues.length) list = dedupeIssues([...list, ...versionIssues])

  // 正文保留比较：先定"这次到底该不该比"（三态显式表示），再定结果。
  // 声称 applied 却没给结果 = 比不了（failed），补一条**阻断**——不允许用"没检查"冒充"检查通过"
  // （计划 §4.4 第 6 条：提交以完整 verdict.ok 和所需检查完成为前提，不只看 blockers.length===0）。
  let bodyApp: BodyApplicability = c.bodyApplicability ?? (c.body ? 'applied' : 'not-applicable')
  if (bodyApp === 'applied' && !c.body) bodyApp = 'failed'
  if (bodyApp === 'failed') {
    list = dedupeIssues([
      ...list,
      mk({
        code: ISSUE_CODES.bodyUnverified,
        severity: 'blocking',
        message: '正文完整性无法核验：该做保留比较却拿不到可信基准或正文投影',
        evidence: 'bodyApplicability=failed（缺基准 / 投影失败 / 声称已比却没给结果）；不能当作"检查通过"',
        repairKind: 'revert-version',
      }),
    ])
  }

  const blockers = list.filter((i) => i.severity === 'blocking')
  const warnings = list.filter((i) => i.severity === 'warning')
  const infos = list.filter((i) => i.severity === 'info')
  const pendingPhotos = infos.filter((i) => i.code === ISSUE_CODES.photoPending)

  const checked = new Set(c.stagesChecked || [])
  const checks = {} as Record<QualityStage, CheckState>
  for (const st of ALL_STAGES) {
    if (blockers.some((i) => i.stage === st)) {
      checks[st] = 'fail'
      continue
    }
    // 调用方声明了本轮查过哪些阶段时，没查的记 unknown（不假装通过）
    checks[st] = !checked.size || checked.has(st) ? 'pass' : 'unknown'
  }
  // 不适用是**明确的结论**（"本回合第一个候选，本来就没有可比对象"），不是"没查"也不是"通过"
  if (bodyApp === 'not-applicable' && checks.body !== 'fail') checks.body = 'unknown'

  const requiredSlotsDone = !c.requiredSlots || c.requiredSlots.every((s) => s.done)
  const bodyIntegrityOk = bodyApp === 'applied' ? Boolean(c.body?.ok) : true
  const versionConsistent = versionIssues.length === 0

  const ok = blockers.length === 0 && requiredSlotsDone && bodyIntegrityOk && versionConsistent
  const publishReady = ok && pendingPhotos.length === 0

  const unverified: string[] = []
  if (checked.size) for (const st of ALL_STAGES) if (!checked.has(st)) unverified.push(st)
  if (!c.version || c.version.length === 0) unverified.push('version')
  // 只记"该比却比不了"；"不适用"是明确结论，不算未核验（否则首稿永远背着一条假的未核验项）
  if (bodyApp === 'failed') unverified.push('body')
  if (!c.requiredSlots) unverified.push('requiredSlots')

  const notes: string[] = [
    'checkHtml.ok 单独为真不等于整稿通过：它只覆盖产品规范类，素材落位、栅格、正文完整性与版本绑定各自独立判定。',
    '磁盘保存成功不等于验收通过：保存的是本轮产物（草稿），验收看本判定结论。',
    '失败候选允许保存为草稿继续编辑，但不得自动替换已验收成品。',
  ]
  if (blockers.length) {
    notes.push(
      `阻断项 ${blockers.length} 条：${[...new Set(blockers.map((b) => b.code))].join(', ')}；` +
        (c.hasAcceptedHistory === false ? '没有已验收历史：如实显示"草稿未通过"，不宣称已回滚。' : '成品维持上一份已验收版本。'),
    )
  }
  if (pendingPhotos.length) notes.push(`有 ${pendingPhotos.length} 处照片位待补真实照片：草稿允许，发布就绪另判（不自动伪造照片）。`)
  if (!requiredSlotsDone) notes.push('必需素材位尚未全部完成：库读取成功不等于验收完成。')
  notes.push(
    bodyApp === 'applied'
      ? `正文保留比较：已执行（结果 ${bodyIntegrityOk ? '通过' : '未通过'}）——与**本回合首个候选**冻结的事实基准比，不跟历史成品比。`
      : bodyApp === 'not-applicable'
        ? '正文保留比较：不适用（本回合首个候选，没有修复前版本）。本条**不声称**已做保留比较。'
        : '正文保留比较：无法核验（该比却比不了）——已按阻断处理，候选不得提升为成品。',
  )

  const reason: DeliveryVerdict['reason'] = !ok ? 'blocked' : publishReady ? 'accepted' : 'draft-only'
  const bodyLabel = bodyApp === 'applied' ? String(bodyIntegrityOk) : bodyApp === 'not-applicable' ? '不适用' : '无法核验'
  const summary = ok
    ? publishReady
      ? `成品可提交：阻断 0、必需素材完成、正文完整性=${bodyLabel}、版本字段一致（警告 ${warnings.length}、提示 ${infos.length}）`
      : `草稿可保存但未达发布就绪：阻断 0，仍有 ${pendingPhotos.length} 处照片位待补`
    : `未通过交付门禁：阻断 ${blockers.length} 条（必需素材完成=${requiredSlotsDone}、正文完整性=${bodyLabel}、版本一致=${versionConsistent}）`

  return { ok, publishReady, reason, blockers, warnings, infos, pendingPhotos, checks, gate: { blockers: blockers.length, requiredSlotsDone, bodyIntegrityOk, versionConsistent, bodyApplicability: bodyApp }, unverified, summary, notes }
}
