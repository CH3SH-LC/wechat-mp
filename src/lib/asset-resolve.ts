// asset-resolve.ts —— 素材解析的确定性决策层（P0，2026-09-24 调查建议 §1/§2；
//                    协议修复：2026-09-28 修复计划阶段 2）
// 纯函数、无 IO、无 Tauri：被 image-agent 调用，也可被 node 脚本直接断言。
// 五件事：
// 1. judgeReuse：库复用判定（长度归一化命中 + 配色冲突否决），修「共享 3 个字符二元组就复用」；
// 2. pairBubbleRefs：把每个角饰素材位与「其后最近的、尚未被占用的」气泡角饰引用配对，
//    使 image-agent 能按本文别名（而非库 ID）输出 `::: art deco <别名>`，修「气泡角饰未定义」；
// 3. planDecoAliases：一个角饰块可声明多个别名（库 ID / 库名称 / 本文占位别名 / 气泡引用词）；
// 4. parseAssetRef / resolveAssetRef（阶段 2）：**宽匹配所有 `[[asset:…]]` 再校验字段**——
//    旧实现用 `[a-z-]+` 匹配分类，中文分类连识别都进不去，引用原样漏进 HTML（真实故障根因之一）；
// 5. findLegacyDecoBlocks / resolveLegacyDeco（阶段 2）：历史遗留的**纯文字** `::: art deco 名称`
//    块——按历史绑定/快照、精确 ID、唯一库名称恢复；恢复不了就报明确错误，**绝不自动发起绘图**。
// 6. snapshotUsable / svgContentHash / sameAsset（DS 修复指南 §5.4 末段，2026-09-30）：素材身份
//    不能只看 ID——「同 ID 库升级到 v2」「ID 相同但内容被改」都算**换了素材**；快照缺失/损坏
//    必须明确失败，不能拿库当前版本悄悄补齐。
import { ASSET_CATEGORIES, categoryKey, categoryMenu, usageForCategory } from './asset-categories.ts'

/** 去空白与标点/符号，仅留实义字符（中英文数字） */
export function normText(s: string): string {
  return String(s || '').replace(/[\s\p{P}\p{S}]/gu, '')
}

export function bigrams(s: string): Set<string> {
  const clean = normText(s)
  const out = new Set<string>()
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2))
  return out
}

// ---------- 配色冲突否决 ----------

// 保守色词表：只收明确表色的单字/词，避免「木纹/米线/骆驼」这类误伤。
// 冲突判定要求两侧都识别出颜色且交集为空——单侧无颜色时不否决（宁可复用，不误杀）。
const COLOR_LEXICON: [string, string[]][] = [
  ['red', ['红', '朱', '绯', '赤', '绛']],
  ['orange', ['橙', '橘']],
  ['yellow', ['黄', '金']],
  ['green', ['绿', '翠', '碧', '青']],
  ['blue', ['蓝', '靛']],
  ['purple', ['紫']],
  ['pink', ['粉', '桃', '樱']],
  ['black', ['黑', '墨']],
  ['white', ['白', '银']],
  ['gray', ['灰']],
  ['brown', ['棕', '咖', '褐']],
]

/** 文本命中的规范颜色集合（无命中返回空集） */
export function colorsIn(text: string): Set<string> {
  const t = String(text || '')
  const out = new Set<string>()
  for (const [canon, words] of COLOR_LEXICON) {
    if (words.some((w) => t.includes(w))) out.add(canon)
  }
  return out
}

/** 配色冲突：两侧都有颜色且没有共同色 → 描述指向的是不同配色的素材 */
export function hasColorConflict(query: string, candidateText: string): boolean {
  const a = colorsIn(query)
  if (!a.size) return false
  const b = colorsIn(candidateText)
  if (!b.size) return false
  for (const c of a) if (b.has(c)) return false
  return true
}

// ---------- 库复用判定 ----------

export const REUSE_MIN_SCORE = 3
export const REUSE_MIN_COVERAGE = 0.5

export interface ReuseVerdict {
  score: number
  coverage: number // score / 描述二元组总数：按长度归一化，短描述不再轻易"强命中"
  ok: boolean
  reason: string
}

/**
 * 判定一条描述与一条候选素材是否算"强命中可复用"。
 * 旧口径只看绝对分（>=3），描述越长越容易误命中；这里要求覆盖率过半。
 */
export function judgeReuse(query: string, candidateText: string): ReuseVerdict {
  const qb = bigrams(query)
  if (qb.size < 2) return { score: 0, coverage: 0, ok: false, reason: '描述过短，不足以判定复用' }
  const hay = normText(candidateText)
  let score = 0
  for (const g of qb) if (hay.includes(g)) score += 1
  const coverage = score / qb.size
  if (hasColorConflict(query, candidateText)) {
    return { score, coverage, ok: false, reason: `配色冲突（描述与库素材色系不同），不复用` }
  }
  if (score < REUSE_MIN_SCORE) {
    return { score, coverage, ok: false, reason: `语义重合不足（命中 ${score} 项，需 ≥${REUSE_MIN_SCORE}）` }
  }
  if (coverage < REUSE_MIN_COVERAGE) {
    return {
      score,
      coverage,
      ok: false,
      reason: `描述与库素材重合度 ${Math.round(coverage * 100)}%（需 ≥${Math.round(REUSE_MIN_COVERAGE * 100)}%），主体可能不同`,
    }
  }
  return { score, coverage, ok: true, reason: `与库素材重合度 ${Math.round(coverage * 100)}%` }
}

/** 候选素材的检索文本（与 searchAssets 同口径） */
export function assetHay(m: { name: string; title: string; desc: string; tags?: string[] }): string {
  return `${m.name} ${m.title} ${m.desc} ${(m.tags || []).join(' ')}`
}

export interface ReuseCandidate {
  name: string
  title: string
  desc: string
  tags?: string[]
  createdAt?: string
}

/**
 * 从候选中挑出可复用的那一条（按分数降序、同分新建优先）。
 * hit = null 表示"库无强命中"；near = 有语义重合但没过阈值的近邻候选，
 * 供调用方（视觉复核）在含糊时进一步判断"能不能凑合用"。
 */
export function pickReuse<T extends ReuseCandidate>(
  query: string,
  candidates: T[],
  nearLimit = 4,
): { hit: T | null; reason: string; near: T[] } {
  const scored = candidates
    .map((m) => ({ m, v: judgeReuse(query, assetHay(m)) }))
    .sort((a, b) => b.v.score - a.v.score || String(b.m.createdAt || '').localeCompare(String(a.m.createdAt || '')))
  const ok = scored.filter((x) => x.v.ok)
  if (ok.length) {
    const top = ok[0]
    return { hit: top.m, reason: `复用库素材「${top.m.title || top.m.name}」：${top.v.reason}`, near: [] }
  }
  // 有语义重合但被否决的候选（按分数降序）——视觉复核的输入
  const near = scored.filter((x) => x.v.score > 0).slice(0, nearLimit).map((x) => x.m)
  const top = scored[0]
  return {
    hit: null,
    reason: top ? `新建：${top.v.reason}` : '新建：素材库暂无该类候选',
    near,
  }
}

// ---------- 角饰别名与气泡引用配对 ----------

const BUBBLE_REF_RE = /^>\s*\[!(\w+)(?:\|([A-Za-z0-9_-]+))?\]/

export interface BubbleRef {
  line: number
  token: string
}

/** 收集正文里所有「带角饰词的气泡引用行」 */
export function collectBubbleRefs(lines: string[]): BubbleRef[] {
  const out: BubbleRef[] = []
  lines.forEach((l, i) => {
    const m = BUBBLE_REF_RE.exec(String(l).trim())
    if (m && m[2]) out.push({ line: i, token: m[2] })
  })
  return out
}

/**
 * 把每个角饰素材位（行号）与其后最近的、尚未被占用的气泡引用词配对——即排版协议既有的
 * 「先在某个素材位定义角饰、随后气泡引用同名」语义。返回与 slotLines 等长的引用词数组。
 */
export function pairBubbleRefs(lines: string[], slotLines: number[]): (string | undefined)[] {
  const refs = collectBubbleRefs(lines)
  const used = new Set<number>()
  return slotLines.map((slot) => {
    for (const r of refs) {
      if (r.line > slot && !used.has(r.line)) {
        used.add(r.line)
        return r.token
      }
    }
    return undefined
  })
}

const TOKEN_RE = /^[A-Za-z0-9_-]+$/

/**
 * 一个角饰块可声明的别名集合（去重、只保留引擎可解析的 token）。
 * 四个来源都写上，历史各种引用风格（本文占位别名 / 气泡配对词 / 库名称 / 库 ID）都能解析。
 */
export function planDecoAliases(args: {
  pairedRef?: string
  placeholderAlias?: string
  assetName?: string
  assetId?: string
}): string[] {
  const out: string[] = []
  for (const t of [args.pairedRef, args.placeholderAlias, args.assetName, args.assetId]) {
    const s = String(t || '').trim()
    if (s && TOKEN_RE.test(s) && !out.includes(s)) out.push(s)
  }
  return out
}

// ---------- 占位策略段（自动选择 / 必须新建） ----------

export type AssetPolicy = 'auto' | 'new'

const POLICIES: AssetPolicy[] = ['auto', 'new']

/**
 * 拆分占位描述的第三段策略标记：`[[deco:blossom|花簇角饰|new]]` → {desc:'花簇角饰', policy:'new'}。
 * 只有恰好是 auto/new 的末段才当策略，其余原样保留在描述里（向后兼容）。
 */
export function splitPolicy(raw: string): { desc: string; policy: AssetPolicy } {
  const parts = String(raw || '').split('|')
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim()
    if ((POLICIES as string[]).includes(last)) {
      return { desc: parts.slice(0, -1).join('|').trim(), policy: last as AssetPolicy }
    }
  }
  return { desc: String(raw || '').trim(), policy: 'auto' }
}

// ---------- [[asset:…]] 引用：宽匹配 + 字段校验（阶段 2 核心修复） ----------

/**
 * 宽匹配：只要整行是 `[[asset:…]]` 就被认出来，**内容一律先收下再校验**。
 * 旧实现把分类写死在正则里（`[a-z-]+`），中文分类的引用因此连"这是一条引用"都判不出来——
 * 既不进 residual、也没有"引用缺失"的可修复警告，最后原样漏进成品 HTML。
 */
const ASSET_REF_WIDE_RE = /^\[\[asset:([^\]]*)\]\]$/

export interface AssetRef {
  raw: string
  /** 声明里原样写的分类（可能是中文、可能是别名） */
  categoryRaw: string
  /** 归一化后的英文分类键；识别不出来时为空串 */
  category: string
  /** 名称或素材 ID（按 ID 优先解析） */
  idOrName: string
  desc: string
  /** 非空即这条引用不合法；文案直接面向用户/模型，说明怎么改 */
  error: string
}

/** 解析一条素材引用行；不是引用行返回 null。字段不合法时 error 非空、其余字段尽量保留。 */
export function parseAssetRef(line: string): AssetRef | null {
  const m = ASSET_REF_WIDE_RE.exec(String(line || '').trim())
  if (!m) return null
  const raw = String(line).trim()
  const parts = m[1].split('|')
  const categoryRaw = (parts[0] ?? '').trim()
  const idOrName = (parts[1] ?? '').trim()
  const desc = parts.slice(2).join('|').trim()
  const blank: AssetRef = { raw, categoryRaw, category: '', idOrName, desc, error: '格式不完整' }
  if (parts.length < 3) {
    return { ...blank, error: '引用缺少字段：应为 [[asset:分类|名称或素材ID|用途说明]]' }
  }
  const key = categoryKey(categoryRaw)
  if (!key) {
    return { ...blank, error: `未知分类「${categoryRaw}」：分类须为 ${categoryMenu()}` }
  }
  const ref: AssetRef = { raw, categoryRaw, category: key, idOrName, desc, error: '' }
  if (!idOrName) return { ...ref, error: '引用缺少素材 ID 或名称（第二段不能为空）' }
  if (!desc) return { ...ref, error: '引用缺少用途说明（第三段不能为空）' }
  return ref
}

/** 库条目的解析所需字段（纯结构，不依赖 asset-library 的类型） */
export interface LibItem {
  id: string
  name: string
  category: string
  usage: string
  title?: string
  desc?: string
  /**
   * 素材版本（指南 §5.4："除 ID 外比较版本"）。可选：调用方没带版本时按"未知"处理
   * （`usableVersionOf` → 0），而不是假装它与文档里的版本一致。
   */
  version?: number
}

export type ResolveOutcome =
  | {
      ok: true
      item: LibItem
      /** 声明分类与实际分类不符但用途兼容时的可解释说明（空串=完全一致） */
      mismatch: string
      /** 按 ID 命中还是按名称唯一命中 */
      matchedBy: 'id' | 'name'
    }
  | { ok: false; error: string }

/**
 * 把一条已解析的引用落到库条目上。规则（修复计划阶段 2 第 2/3 条）：
 * - **优先按 ID**；名称只允许**唯一匹配**，重名一律判歧义（不猜是哪一张）。
 * - 声明的分类与实际分类不一致时：**用途兼容**（同类安放位，如 bubble ↔ deco）→
 *   按库记录恢复并保留告警；**用途不兼容**（如把 wide 的横幅塞进角饰位）→ 明确报错，
 *   绝不"宽松解析"硬塞进不兼容的位置。
 */
export function resolveAssetRef(ref: AssetRef, lib: LibItem[]): ResolveOutcome {
  if (ref.error) return { ok: false, error: ref.error }
  const byId = lib.find((m) => m.id === ref.idOrName)
  let item = byId
  let matchedBy: 'id' | 'name' = 'id'
  if (!item) {
    const named = lib.filter((m) => m.name === ref.idOrName)
    if (named.length === 0) {
      return { ok: false, error: `素材库中找不到「${ref.idOrName}」（既不是素材 ID，也没有同名素材）` }
    }
    if (named.length > 1) {
      return {
        ok: false,
        error: `素材名称「${ref.idOrName}」在库中有 ${named.length} 条同名记录，无法确定用哪一张；请改用具唯一性的素材 ID`,
      }
    }
    item = named[0]
    matchedBy = 'name'
  }
  const wantUsage = usageForCategory(ref.category)
  if (wantUsage && item.usage !== wantUsage) {
    return {
      ok: false,
      error: `用途不兼容：引用声明为 ${ref.category}（安放位 ${wantUsage}），但库中素材「${item.name}」的安放位是 ${item.usage}——不能把它放进这个位置`,
    }
  }
  const mismatch =
    item.category === ref.category
      ? ''
      : `引用声明分类 ${ref.category}，素材实际分类 ${item.category}（用途一致，已按实际分类渲染）`
  return { ok: true, item, mismatch, matchedBy }
}

// ---------- 素材身份：快照结构校验 + 版本 + 内容哈希（指南 §5.4 末段） ----------
//
// 要证伪的是这条缝："快照里有东西 + ID 一样" 就被当成"素材没变"。
// - 快照里的 SVG 可能是空串、被截断、串进了别的字段（损坏）→ 过去 `trim()` 非空就当有效，
//   于是拿一段坏内容去渲染，或者更糟：悄悄拿库里的最新版补上；
// - 同一个 ID 在库里可以被改成 v2（甚至版本号没变、内容被改）→ 只看 ID 不足以证明"同一素材"。
// 因此这里给出三件事：结构校验（snapshotUsable）、稳定内容哈希（svgContentHash）、
// 以及"身份 = ID + 版本 + 内容哈希"的比较口径（sameAsset）。

/** SVG 文本的稳定内容哈希（FNV-1a 32 位）：零依赖，node 与浏览器逐位一致 */
export function svgContentHash(svg: unknown): string {
  const t = String(svg ?? '').replace(/\r\n?/g, '\n').trim()
  let h = 0x811c9dc5
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `fnv1a-${(h >>> 0).toString(16).padStart(8, '0')}-${t.length}`
}

/** 快照 SVG 的合理长度区间：太短必然是被截断/空壳，太长必然写坏了别的数据 */
export const SNAP_SVG_MIN_LEN = 40
export const SNAP_SVG_MAX_LEN = 2_000_000

export type SnapshotVerdict =
  | { ok: true; svg: string; ver: number; hash: string }
  | { ok: false; error: string }

/**
 * 版本号是否"可用"：正整数才算数（0 = 未知，不算可用；非数值/负数/小数/NaN 一律不可用）。
 *
 * 为什么不用 0 兜底：`0` 与 `缺失` 在比较里必须区分开——"版本未知"就没法证明是同一版本，
 * 而指南要求"除 ID 外比较版本"。未知一律按不可用处理，让调用方**明确失败**而不是假装一致。
 */
export function usableVersionOf(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 0
}

/**
 * 文档固化快照的结构校验（指南 §5.4："快照缺失或损坏要明确失败"）。
 *
 * 校验四件事：ID 非空、版本是可用的数值、SVG 非空且看起来是一段 SVG（含 `<svg`）、长度在合理区间。
 * 三种结果要分得清：
 * - `文档里没有素材 X 的固化快照` —— 从未固化过（不是"有但坏了"），调用方谈恢复时应按"没有记录"处理；
 * - `素材 X 的固化快照…已损坏` —— 有记录但内容不可用，**不能**静默回落到库当前版本；
 * - ok —— 内容与版本都可用，返回内容哈希供身份比较。
 */
export function snapshotUsable(id: string, snap: unknown): SnapshotVerdict {
  const key = String(id || '').trim()
  if (!key) return { ok: false, error: '快照记录缺少素材 ID，无法确认它属于哪一件素材' }
  if (!snap || typeof snap !== 'object') return { ok: false, error: `文档里没有素材 ${key} 的固化快照` }
  const raw = snap as { svg?: unknown; ver?: unknown }
  if (typeof raw.svg !== 'string') {
    return { ok: false, error: `素材 ${key} 的固化快照已损坏：SVG 字段不是文本（实际 ${raw.svg === null ? 'null' : typeof raw.svg}）` }
  }
  const svg = raw.svg.trim()
  if (!svg) return { ok: false, error: `素材 ${key} 的固化快照已损坏：SVG 内容为空` }
  if (!/<svg[\s>]/i.test(svg)) {
    return { ok: false, error: `素材 ${key} 的固化快照已损坏：内容里没有 <svg> 根元素，不是一段 SVG` }
  }
  if (svg.length < SNAP_SVG_MIN_LEN) {
    return { ok: false, error: `素材 ${key} 的固化快照已损坏：内容只有 ${svg.length} 个字符（短于 ${SNAP_SVG_MIN_LEN}），像是被截断的记录` }
  }
  if (svg.length > SNAP_SVG_MAX_LEN) {
    return { ok: false, error: `素材 ${key} 的固化快照已损坏：内容 ${svg.length} 个字符（超过 ${SNAP_SVG_MAX_LEN}），像是写坏了别的数据` }
  }
  const ver = usableVersionOf(raw.ver)
  if (!ver) {
    return { ok: false, error: `素材 ${key} 的固化快照缺少可用的版本号（实际 ${JSON.stringify(raw.ver)}）——没有版本就无法证明它与文档固化时是同一版` }
  }
  return { ok: true, svg: raw.svg, ver, hash: svgContentHash(raw.svg) }
}

/** 素材身份：**ID + 版本 + 内容哈希**（指南 §5.4："`gen_svg=0` 或 ID 相同不足以证明素材不变"） */
export interface AssetIdentity {
  id: string
  ver: number
  hash: string
}

/**
 * 两件素材是不是同一件：ID、版本、内容哈希三者**任一不同**即视为"不是同一素材"。
 * 任意一侧缺少可用身份（null / 空 hash / 版本未知）→ 返回 false：证明不了就是证明不了。
 */
export function sameAsset(a: AssetIdentity | null | undefined, b: AssetIdentity | null | undefined): boolean {
  if (!a || !b) return false
  const ida = String(a.id || '').trim()
  const idb = String(b.id || '').trim()
  if (!ida || !idb || ida !== idb) return false
  if (!usableVersionOf(a.ver) || !usableVersionOf(b.ver) || a.ver !== b.ver) return false
  const ha = String(a.hash || '').trim()
  const hb = String(b.hash || '').trim()
  return !!ha && !!hb && ha === hb
}

// ---------- 历史遗留的纯文字 ::: art deco 块（阶段 2 第 4/5 条） ----------

export interface LegacyDecoBlock {
  /** 起始行（0 起） */
  start: number
  /** 结束行（0 起，指向 `:::`） */
  end: number
  /** 块头声明的别名（第一个作为标签） */
  names: string[]
  /** 块内正文（不含首尾行） */
  body: string
}

/**
 * 找出「块内没有 SVG 的 `::: art deco 名称` 块」。
 *
 * 背景：`::: art deco` 是**引擎内部的编译结果**（解析后应当包含 SVG）。历史轮次的
 * 质检反馈却提示模型"请先用 ::: art deco 名称 定义现场装饰素材"，模型于是照写出了
 * 只有中文说明、没有 SVG 的空块——compose 忽略它，气泡引用随后报"角饰未定义"。
 * 这类块不会、也不该触发绘图：它要么按历史绑定/库恢复，要么报明确错误。
 */
export function findLegacyDecoBlocks(lines: string[]): LegacyDecoBlock[] {
  const out: LegacyDecoBlock[] = []
  let i = 0
  while (i < lines.length) {
    const m = /^:::\s*art\s+deco\s+([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*)\s*$/.exec(String(lines[i] || '').trim())
    if (!m) {
      i++
      continue
    }
    const start = i
    const body: string[] = []
    i++
    while (i < lines.length && String(lines[i]).trim() !== ':::') {
      body.push(lines[i])
      i++
    }
    const end = i < lines.length ? i : lines.length - 1
    i++
    const text = body.join('\n')
    // 块里已经有 SVG → 这是正常的内部编译产物，交给 compose 处理，不是"遗留文字块"
    if (/<svg\b/i.test(text)) continue
    out.push({ start, end, names: m[1].split(/\s+/).filter(Boolean), body: text.trim() })
  }
  return out
}

export interface LegacyDecoContext {
  lib: LibItem[]
  /** 文档已保存的素材位绑定（阶段 3 起还会带上 slotId） */
  bindings?: { slot: string; id: string }[]
  /** 文档固化快照：id → SVG（库素材后来被改/删也能恢复原样） */
  snapshots?: Record<string, { svg: string; ver: number }>
  /** 本轮台账里声明了「重新绘制」的素材名/描述（与遗留块同名即冲突） */
  newPolicyNames?: string[]
  /**
   * 本轮模型声明的素材策略（指南 §5.4）：`preserve`（只改文字、素材不动）下，
   * 文档里没有记录的素材位**一律阻断**，不允许按库里的同 ID / 同名素材顶替。
   * 不传 = 旧的默认行为（沿用库恢复），保持既有调用点不变。
   */
  assetPolicy?: 'preserve' | 'modify'
}

export type LegacyDecoOutcome =
  | {
      ok: true
      id: string
      svg: string | null
      /** 素材版本：快照路径 = 文档里的版本；库路径 = 库里的版本（未知为 0） */
      ver: number
      /** 内容哈希：快照路径 = 快照内容哈希；库路径 = 未读取内容时为空串 */
      hash: string
      source: 'snapshot' | 'library'
      reason: string
    }
  | { ok: false; error: string }

/**
 * 恢复一个遗留的纯文字角饰块。恢复顺序（指南 §5.4 + 阶段 2 第 4 条）：
 * 1. **文档固化快照**（按 ID 直接命中，或按历史绑定找到 ID）——文档固化过的那份就是权威内容：
 *    同 ID 素材在库里升到 v2 也仍用文档 v1；库条目被删、快照还在也能恢复；
 * 2. 文档里**有绑定但快照缺失/损坏** → **明确失败**（不拿库当前版本悄悄补齐）；
 * 3. `preserve` 且文档里没有任何记录 → **明确失败**（不许按库里的同 ID / 同名顶替）；
 * 4. 其余情况（未声明 preserve 的旧文档）沿用既有行为：精确素材 ID、**唯一**库名称。
 * 只恢复安放位为 deco 的素材；未知、歧义、与新建策略冲突一律返回明确错误，**不绘图**。
 */
export function resolveLegacyDeco(block: LegacyDecoBlock, ctx: LegacyDecoContext): LegacyDecoOutcome {
  const tokens = block.names
  if (!tokens.length) return { ok: false, error: '遗留角饰块没有声明名称' }
  const conflicts = (ctx.newPolicyNames || []).filter((n) => n && tokens.includes(n))
  if (conflicts.length) {
    return {
      ok: false,
      error: `旧角饰块「${conflicts[0]}」与正文里声明的重新绘制（|new）冲突：同一素材位不能既复用旧的又重新画，请删掉其中一个`,
    }
  }

  // 1a) 快照按 ID 直接命中：不依赖绑定记录还在——快照本身就是"文档固化过这件素材"的证据
  for (const t of tokens) {
    const snap = ctx.snapshots ? ctx.snapshots[t] : undefined
    if (snap === undefined) continue
    const v = snapshotUsable(t, snap)
    if (!v.ok) return { ok: false, error: `旧角饰块「${t}」${v.error}；不能改用素材库当前版本顶替（那会悄悄换掉作品里的图）` }
    return {
      ok: true,
      id: t,
      svg: v.svg,
      ver: v.ver,
      hash: v.hash,
      source: 'snapshot',
      reason: `按文档固化快照恢复（版本 ${v.ver}，内容哈希 ${v.hash}）`,
    }
  }

  // 1b) 历史绑定：绑定说明"本文档用过这件素材"——那一刻起，快照就是它的权威内容。
  //     快照缺失或损坏一律失败：库里同 ID 的当前版本**不能**证明就是文档里那一版。
  for (const t of tokens) {
    const b = (ctx.bindings || []).find((x) => x.id === t)
    if (!b) continue
    const v = snapshotUsable(t, ctx.snapshots ? ctx.snapshots[t] : undefined)
    if (!v.ok) {
      return { ok: false, error: `旧角饰块「${t}」在本文档里绑定过素材 ${t}，但${v.error}；不能改用素材库当前版本顶替（那会悄悄换掉作品里的图）` }
    }
    return {
      ok: true,
      id: t,
      svg: v.svg,
      ver: v.ver,
      hash: v.hash,
      source: 'snapshot',
      reason: `按文档固化快照恢复（版本 ${v.ver}，内容哈希 ${v.hash}）`,
    }
  }

  // 2) preserve：文档里既没有快照也没有绑定 → 明确阻断，绝不用库里的同 ID / 同名素材顶替
  if (ctx.assetPolicy === 'preserve') {
    return {
      ok: false,
      error: `本回合声明素材保持不动，但旧角饰块「${tokens[0]}」在本文档里没有绑定、也没有固化快照（新素材位）：要保持素材不动请照抄已固化的引用；要换图请改 assetPolicy 为 modify`,
    }
  }

  // 3) 精确 ID / 4) 唯一名称（沿用既有行为；该 ID 在文档里有快照时仍按快照恢复）
  for (const t of tokens) {
    const byId = ctx.lib.find((m) => m.id === t)
    if (byId) return decoOutcomeFor(byId, `按素材 ID ${t} 恢复`, ctx.snapshots)
    const named = ctx.lib.filter((m) => m.name === t)
    if (named.length === 1) return decoOutcomeFor(named[0], `按库中唯一名称「${t}」恢复`, ctx.snapshots)
    if (named.length > 1) {
      return { ok: false, error: `旧角饰块「${t}」在库中有 ${named.length} 条同名记录，无法确定用哪一张；请改用素材 ID 引用` }
    }
  }

  return {
    ok: false,
    error: `旧角饰块「${tokens[0]}」既没有历史绑定，素材库里也找不到对应素材：请改用 [[asset:bubble|素材ID|用途]] 引用，或写 [[deco:名称|说明]] 让系统重新制作`,
  }
}

/**
 * 按库条目恢复时的收口：用途必须是 deco；**该 ID 在文档里有固化快照时一律走快照**
 * （指南 §5.4："同 ID 库升级到 v2，仍用文档 v1 内容与版本"）——快照损坏则明确失败，
 * 不拿库里那一版补上。
 */
function decoOutcomeFor(
  item: LibItem,
  reason: string,
  snapshots?: Record<string, { svg: string; ver: number }>,
): LegacyDecoOutcome {
  if (item.usage !== 'deco') {
    return {
      ok: false,
      error: `旧角饰块引用的素材「${item.name}」安放位是 ${item.usage}，不是角饰（deco）——不能用它做气泡角饰`,
    }
  }
  const snap = snapshots ? snapshots[item.id] : undefined
  if (snap !== undefined) {
    const v = snapshotUsable(item.id, snap)
    if (!v.ok) {
      return { ok: false, error: `旧角饰块引用的素材「${item.name}」${v.error}；不能改用素材库当前版本顶替（那会悄悄换掉作品里的图）` }
    }
    return {
      ok: true,
      id: item.id,
      svg: v.svg,
      ver: v.ver,
      hash: v.hash,
      source: 'snapshot',
      reason: `${reason}；文档里存有这件素材的固化快照，按文档 v${v.ver} 内容恢复（内容哈希 ${v.hash}，不采用库当前版本）`,
    }
  }
  return { ok: true, id: item.id, svg: null, ver: usableVersionOf(item.version), hash: '', source: 'library', reason }
}

/** 分类键是否可用（供调用方在解析前自查；等价于 categoryKey 存在性） */
export function isKnownCategory(raw: string): boolean {
  return !!categoryKey(raw) && ASSET_CATEGORIES.some((c) => c.key === categoryKey(raw))
}
