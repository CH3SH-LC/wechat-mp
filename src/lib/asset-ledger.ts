// asset-ledger.ts —— 一轮创作的素材结果表（修复计划阶段 3，2026-09-28）
//
// 要解决的问题（真实运行调查 §3/§4）：自动修订会**整篇重来**，而每轮都重新做一次素材解析，
// 于是"已经画好的素材"可能被再画一遍、"已经失败的图位"在每轮都重新获得预算。
// 静态极端上限是单素材位 6 次模型往返 × 3 轮 = 18 次绘图尝试，等待被成倍放大。
//
// 台账把一件事说清楚：**同一个素材位在整个回合内只做一次决定**。
// - 成功了：记住成品素材块与规范化引用，之后每轮直接复用，不再检索、不再绘制；
// - 失败了：记住失败与已用尝试次数，之后每轮沿用同一个失败结果，**不重新获得预算**。
//
// 纯函数 + 纯数据，零 import（node 断言脚本可直接加载）。
// 边界（项目铁律 6）：台账只做**素材任务编排**，不承担用户意图判断、澄清或对话路由。
//
// F1（2026-09-28 只读审计）：指纹口径曾只有 `kind|策略|规范化描述|主题`，`[[asset:…]]` 素材位
// 因此会"两处用途说明相同就算同一个素材位"。现行口径为 `kind|策略|规范化描述|主题|身份`，
// 其中身份段（分类 + 素材 ID/名称）**只对 kind='asset' 生效**——详见 fingerprintOf 的注释。

export type SlotKind = 'wide' | 'inline' | 'deco' | 'asset' | 'legacy-deco'

export type SlotStatus = 'pending' | 'ok' | 'failed'

export type SlotSource = 'asset' | 'reuse' | 'new' | 'failed' | 'recover'

/** 每个素材位每个回合最多尝试绘图几次（第一次 + 一次重画） */
export const MAX_DRAW_ATTEMPTS = 2
/** 每个素材位每个回合最多补描述几次（子智能体回问 → 主模型补 brief） */
export const MAX_CLARIFY = 1

export interface LedgerEntry {
  /** 素材位 id：本轮内稳定，写入 trace 与文档绑定，便于逐项重试与事后追踪 */
  slotId: string
  /** 素材位原文（首次出现的那一行），也是文档绑定里的 slot 键 */
  slot: string
  kind: SlotKind
  /**
   * 输入指纹：kind + 策略 + 规范化描述 + 主题（`[[asset:…]]` 素材位另加「分类|素材ID/名称」身份段，
   * 见 fingerprintOf —— F1 修复：没有身份段时，两处用法说明相同的引用会被误判成同一个素材位）。
   * 描述或要求变了才算新任务。
   */
  fingerprint: string
  policy: 'auto' | 'new'
  desc: string
  status: SlotStatus
  /** 已用绘图尝试次数（跨自动修订累计，不因重新排版清零） */
  attempts: number
  /** 已用补描述次数 */
  clarifications: number
  /** 绑定的库素材 id（失败为空串） */
  assetId: string
  /** 素材版本（固化快照用；0 表示未知） */
  version: number
  source: SlotSource
  reason: string
  /** 成功后的成品素材块（`::: art …` / `::: art deco …`），跨轮直接复用 */
  block?: string
  /** 成功后规范化出的稳定引用（按 ID），用于交给主模型修订的源文 */
  ref?: string
  /**
   * 排版层拒收回写时用的原始标识（`RejectedArt.refs`）。
   * 降级会清掉 `assetId` 与成品块，而这两样正是比对用的身份键——不留这一笔，
   * "同一份拒收记录被回写两次"（先当场回写、下一轮又随 opts 传一次）会在第二次比对不上，
   * 误报一条"无法定位到素材位"。留下它，回写才是幂等的。
   */
  rejectedRefs?: string[]
}

export interface AssetLedger {
  runId: string
  slots: Record<string, LedgerEntry>
  /** 素材位出现顺序（逐项重试与"未完成清单"按它排列） */
  order: string[]
}

export function createLedger(runId: string): AssetLedger {
  return { runId, slots: {}, order: [] }
}

/** 描述规范化：只在**实质内容**变化时才当作"要求变了"（空白与标点差异不算） */
export function normDesc(s: string): string {
  return String(s || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

/**
 * 身份段规范化：**不能**用 normDesc——它会把 `-` `_` 这类标点抹掉，
 * 于是 `deco-a` 与 `decoa`、`as-1` 与 `as1` 会撞成同一个身份。素材 ID 与名称本身
 * 就是"逐字比较"的标识（见 asset-resolve.resolveAssetRef），这里只做去空白与大小写统一。
 */
export function normIdentity(s: string): string {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * 输入指纹：决定"这是不是同一个素材任务"。
 *
 * F1（2026-09-28 只读审计，高危）：指纹原来只有 `kind|策略|规范化描述|主题`——
 * **没有分类、也没有素材 ID/名称**。而 `prep.ts` 的清单行（`assetLine`）把第三段写成固定
 * 占位文案「按用途改这句说明」，模型"照抄行尾的引用写法"时若两处用途说明写了同一句
 * （或干脆照抄不改），两条 `[[asset:…]]` 的指纹就完全相同 → 第二条命中第一条的台账记录
 * → 成品里两处显示**同一张图**、另一张被静默丢弃，且不进 residual、不进 errors、无任何警告。
 *
 * 因此 `kind === 'asset'` 时把「分类 + 素材 ID/名称」（identity）并进指纹：素材位身份由
 * "引用的是哪一张素材"决定，而不只是"用途说明写得一样"。其它 kind（img/deco/legacy-deco）
 * 不传 identity，指纹与旧口径逐字节一致（trace-check 里"相同描述共享在途任务"的语义不变）。
 */
export function fingerprintOf(
  kind: SlotKind,
  policy: string,
  desc: string,
  theme?: string,
  identity?: string,
): string {
  const id = kind === 'asset' ? normIdentity(identity || '') : ''
  return `${kind}|${policy}|${normDesc(desc)}|${normDesc(theme || '')}|${id}`
}

/** 按指纹找已登记的同任务素材位（同轮全文修订后重新解析时命中它，不产生新任务） */
export function findByFingerprint(ledger: AssetLedger, fp: string): LedgerEntry | undefined {
  return ledger.order.map((id) => ledger.slots[id]).find((e) => e && e.fingerprint === fp)
}

/** 登记（或取回）一个素材位 */
export function ensureSlot(
  ledger: AssetLedger,
  args: {
    kind: SlotKind
    slot: string
    desc: string
    policy: 'auto' | 'new'
    theme?: string
    /**
     * 素材位身份（F1）：`kind === 'asset'` 时传「归一化分类 + 素材 ID 或名称」，
     * 例如 `bubble|as-1a2b`。用途说明相同的两条引用因此仍是两个素材位。
     * 其它 kind 不传，指纹口径与旧版一致。
     */
    identity?: string
  },
): LedgerEntry {
  const fp = fingerprintOf(args.kind, args.policy, args.desc, args.theme, args.identity)
  const existing = findByFingerprint(ledger, fp)
  if (existing) {
    // 同一任务再次出现：保留首次的 slotId 与素材位原文（文档绑定键因此稳定）
    if (!existing.slot) existing.slot = args.slot
    return existing
  }
  const slotId = `${ledger.runId}-s${ledger.order.length + 1}`
  const entry: LedgerEntry = {
    slotId,
    slot: args.slot,
    kind: args.kind,
    fingerprint: fp,
    policy: args.policy,
    desc: args.desc,
    status: 'pending',
    attempts: 0,
    clarifications: 0,
    assetId: '',
    version: 0,
    source: 'failed',
    reason: '',
  }
  ledger.slots[slotId] = entry
  ledger.order.push(slotId)
  return entry
}

/** 还能不能再画一次（预算用尽即不再重试） */
export function canDraw(e: LedgerEntry): boolean {
  return e.status !== 'ok' && e.attempts < MAX_DRAW_ATTEMPTS
}

/** 记一次绘图尝试（无论成败都要记，否则预算形同虚设） */
export function noteDraw(e: LedgerEntry): void {
  e.attempts++
}

/** 还能不能再补描述 */
export function canClarify(e: LedgerEntry): boolean {
  return e.clarifications < MAX_CLARIFY
}

export function noteClarify(e: LedgerEntry): void {
  e.clarifications++
}

/** 落定成功：记下绑定与成品，之后每轮直接复用 */
export function finishOk(
  e: LedgerEntry,
  args: { assetId: string; version?: number; source: SlotSource; reason: string; block: string; ref: string },
): void {
  e.status = 'ok'
  e.assetId = args.assetId
  e.version = args.version ?? 0
  e.source = args.source
  e.reason = args.reason
  e.block = args.block
  e.ref = args.ref
}

/** 落定失败：沿用同一结论，不因下一轮自动修订而重获预算 */
export function finishFail(e: LedgerEntry, reason: string, source: SlotSource = 'failed'): void {
  e.status = 'failed'
  e.assetId = ''
  e.source = source
  e.reason = reason
  e.block = undefined
  e.ref = undefined
}

/** 未完成的素材位（完成状态按它判定，不采信助手的一句"修好了"） */
export function unfinished(ledger: AssetLedger): LedgerEntry[] {
  return ledger.order.map((id) => ledger.slots[id]).filter((e) => e && e.status !== 'ok')
}

/** 已完成的素材位数 */
export function doneCount(ledger: AssetLedger): number {
  return ledger.order.map((id) => ledger.slots[id]).filter((e) => e && e.status === 'ok').length
}

/** 总素材位数 */
export function totalCount(ledger: AssetLedger): number {
  return ledger.order.length
}

/** 把台账里已经成功的素材位，按"成品块 / 规范化引用"两种口径取出来 */
export function okEntries(ledger: AssetLedger): LedgerEntry[] {
  return ledger.order.map((id) => ledger.slots[id]).filter((e) => e && e.status === 'ok')
}

// ================= 计划 §6：排版层的拒收回写——"库读取成功 ≠ 验收完成" =================
//
// 台账里的 `ok` 迄今为止只有一个含义：**素材到手了**（库读到了 / 画出来了）。但验收口径是
// "结构、实际尺寸栅格、最终落位都通过"（§6 第一条）。素材块写进正文之后，排版层（compose）
// 还要再查一遍：`::: art …` 结构不合格、被质检拒收、或者根本没落位（例如被照片位吞掉）。
// 那一刻若台账仍写 `ok`，界面就会告诉用户"已完成"，而正文里其实是个占位空框——
// 用户拿着缺图的稿子出去，且清单上没有任何可重试项。所以 `ok` **必须**能被降级。

/** 排版层（compose）拒收一条素材块时的结构化记录 */
export interface RejectedArtRecord {
  /** 素材块头部的别名/ID 候选（`::: art deco a b c` → a b c；`::: art wide 说明` → 整段说明） */
  refs: string[]
  /** 拒收发生在源文第几行（1-based，仅供诊断展示） */
  line: number
  /** 排版层给出的原因——直接进素材位失败理由，用户据此知道"为什么不算完成" */
  reason: string
  /** 是否发生在 `::: art deco <名称>` 定义里（气泡角饰） */
  deco?: boolean
}

export interface RejectionOutcome {
  /** 由 ok **降级**为 failed 的素材位（正文里没落位，完成状态必须改口） */
  demoted: LedgerEntry[]
  /** 拒收记录命中了素材位，但它本来就不是 ok（已经是失败/未完成），没有可降级的状态 */
  alreadyUnfinished: LedgerEntry[]
  /** 比对不上任何素材位的拒收记录——**不能静默丢弃**，调用方必须记一条用户可见的诊断 */
  unlocated: RejectedArtRecord[]
}

/**
 * 成品块头部的别名/ID 候选（与 compose 取 `::: art` 头部的口径一致：按空白切词）。
 * - `::: art deco a b c` → ['a','b','c']（多别名是既有口径：本文别名 / 气泡引用词 / 库名称 / 库 ID）；
 * - `::: art wide 门店横幅` → ['门店横幅']；描述含空格时同时给「整段」与「逐词」两种口径——
 *   排版层会把头部整段按空白拆词，只按整段比会漏，只按逐词比会散。
 */
export function blockAliasesOf(block: string | undefined): string[] {
  const head = String(block || '').split('\n')[0].trim()
  const deco = /^:::\s*art\s+deco\s+(.*)$/.exec(head)
  if (deco) return deco[1].split(/\s+/).filter(Boolean)
  const art = /^:::\s*art(?:\s+(?:wide|inline))?\s*(.*)$/.exec(head)
  if (!art) return []
  const rest = art[1].trim()
  if (!rest) return []
  const words = rest.split(/\s+/).filter(Boolean)
  return words.length > 1 ? [rest, ...words] : [rest]
}

/** 素材位的"身份键"：素材位原文 / 库素材 ID / 成品块头部别名 / 上次拒收回写留下的原始标识 */
export function identityKeysOf(e: LedgerEntry): string[] {
  const out: string[] = []
  const push = (s: string) => {
    const k = normIdentity(s)
    if (k && !out.includes(k)) out.push(k)
  }
  push(e.slot)
  push(e.assetId)
  for (const a of blockAliasesOf(e.block)) push(a)
  for (const a of e.rejectedRefs || []) push(a)
  return out
}

/**
 * 把已记为 `ok` 的素材位**降级为失败**（计划 §6 第三/四条）。
 *
 * 为什么 ok 可以变回 failed：`ok` 原本只代表"素材已经拿到手"（库读到了、或现场画出来了），
 * 而交付口径是"结构、实际尺寸栅格、**最终落位**都通过才算验收完成"。素材到手却太浅、太糊、
 * 结构不合规，或者被排版层整段丢弃时，正文里那一处就是空的——此时若继续显示"已完成"，
 * 用户看到的完成度是假的，也没有任何可重试的项。
 *
 * 降级只是**结论更新**，不是"重来"：
 * - 不重置 `attempts` / `clarifications`——预算不能因为一次排版失败而白送回去（§5 预算口径）；
 * - 清掉 block / ref——已被拒收的成品块绝不能在下一轮被 `reuseFromLedger` 又复用回正文。
 *
 * 返回是否真的发生了降级（已经是 failed 的不重复记，同一原因不刷屏）。
 */
export function demoteOk(e: LedgerEntry, reason: string): boolean {
  if (e.status !== 'ok') return false
  e.status = 'failed'
  e.source = 'failed'
  e.reason = reason
  e.assetId = ''
  e.block = undefined
  e.ref = undefined
  return true
}

/**
 * 把排版层的拒收记录映射回素材位台账（计划 §6 第三条：`compose` 返回失败素材的 slotId，
 * 回写台账与候选问题清单）。
 *
 * 比对规则（按优先级，与 §6 的"库读取成功 ≠ 验收完成"一一对应）：
 * 1. **身份键**：`entry.slot`（素材位原文）、`entry.assetId`（库素材 ID）、成品块头部的别名
 *    （`::: art deco a b c` 的 a/b/c）。同描述不同素材的两个素材位（F1 起就是两条记录）
 *    因此能落到正确的那一条；
 * 2. **描述**：`::: art wide <描述>` 的头部就是描述本身，退回描述比对。同描述的多条无法从
 *    头部区分是哪一条 → **全部**标为未完成：宁可让用户看到并逐项重试，也不能假装完成；
 * 3. 两轮都比不上 → 记进 `unlocated`，**绝不静默丢弃**（静默丢弃 = 素材位显示完成、
 *    正文里其实是空框）。
 *
 * 纯函数、可重复调用（已经 failed 的不会被再降一次）。
 */
export function noteRejectedArts(
  ledger: AssetLedger,
  arts: RejectedArtRecord[] | null | undefined,
): RejectionOutcome {
  const out: RejectionOutcome = { demoted: [], alreadyUnfinished: [], unlocated: [] }
  const list = (arts || []).filter((a): a is RejectedArtRecord => !!a)
  if (!list.length) return out
  const entries = ledger.order.map((id) => ledger.slots[id]).filter((e): e is LedgerEntry => !!e)
  for (const art of list) {
    // 原始 refs（去空白、去空项）既用于比对，也留给台账做"同一份拒收记录被回写两次"的幂等标记
    const refs = (art.refs || []).map((r) => String(r || '').trim()).filter(Boolean)
    const cands = new Set<string>()
    for (const r of refs) cands.add(normIdentity(r))
    if (!cands.size) {
      out.unlocated.push(art)
      continue
    }
    let hits = entries.filter((e) => identityKeysOf(e).some((k) => cands.has(k)))
    if (!hits.length) {
      hits = entries.filter((e) => {
        const d = normIdentity(e.desc)
        return !!d && cands.has(d)
      })
    }
    if (!hits.length) {
      out.unlocated.push(art)
      continue
    }
    const why = `排版阶段拒收该素材（已从成品中移除）：${String(art.reason || '').trim() || '未说明原因'}`
    for (const e of hits) {
      if (demoteOk(e, why)) {
        // 记下这次的原始标识：同一份拒收记录再被回写一次时，比对得上、不会误报"无法定位"
        e.rejectedRefs = refs
        out.demoted.push(e)
      } else if (!out.alreadyUnfinished.includes(e)) {
        out.alreadyUnfinished.push(e)
      }
    }
  }
  return out
}
