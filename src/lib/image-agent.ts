// image-agent.ts —— 素材子智能体编排与"素材解析器"（第 24 轮起 / V3-R3 升级 / P0 2026-09-24）
// 职责：
// 1. 把 v2 正文里的素材引用解析为实际 SVG——先解析个人素材库的确定性引用
//    `[[asset:分类|名称或ID|用途]]`，命中即复用、不再现场画（计入 info.used 供文档固化快照）；
// 2. 传统图位占位 `[[img:…]]/[[deco:…]]`：先按语义检索个人素材库（强命中才转库引用），
//    未命中才交给素材智能体 gen_svg 现场绘制（桌面模式自动存回素材库 origin=article-fallback，D7）；
//    占位可带策略段 `|new` 强制重新绘制（P0：用户说"重新设计"时必须贯穿到解析器）。
// 3. 主文档智能体绝不内联 SVG——SVG 全部来自素材库或素材智能体（V3 口径 2）。
//
// P0 修复（2026-09-24 调查 §1/§2/§7）：
// - 复用判定改为长度归一化 + 配色冲突否决（asset-resolve.judgeReuse），不再"共享 3 个二元组即复用"；
// - 分类过滤在检索内部先行（searchAssets categories），不再先截断后筛选；
// - 角饰块按"本文别名 + 库名称 + 库 ID + 气泡引用词"输出多别名，气泡引用不再"未定义"→ 不再触发整篇重写；
// - 显式引用的声明分类与实际分类不符时给可解释警告（不静默成功，也不进自动重写清单）；
// - 现场新建的素材登记进 info.used 与 info.bindings，文档固化快照不再漏掉首次生成物。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat.ts'
import { checkSvgQuality, SLOT_PX } from './svg-quality.ts'
import { checkRaster, rasterStats } from './svg-raster.ts'
import { addAsset, getAsset, getAssetSafe, listAssetsSafe, sanitizeName, searchAssets } from './asset-library.ts'
import type { AssetMetaL } from './asset-library.ts'
import {
  findLegacyDecoBlocks,
  pairBubbleRefs,
  parseAssetRef,
  pickReuse,
  planDecoAliases,
  resolveAssetRef,
  resolveLegacyDeco,
  sameAsset,
  snapshotUsable,
  splitPolicy,
  svgContentHash,
  usableVersionOf,
} from './asset-resolve.ts'
import type { LegacyDecoBlock, LibItem } from './asset-resolve.ts'
import type { ProgressFn } from './progress.ts'
import { candidateAt, reviewCandidates } from './vision.ts'
import {
  canClarify,
  canDraw,
  createLedger,
  ensureSlot,
  finishFail,
  finishOk,
  noteClarify,
  noteDraw,
  noteRejectedArts,
} from './asset-ledger.ts'
import type { AssetLedger, LedgerEntry, RejectedArtRecord, RejectionOutcome } from './asset-ledger.ts'
import { classifyError, classifyGenError, clip, retryHintMs, retryable, trace } from './trace.ts'
import type { FailureClass } from './trace.ts'

// ---------- 阶段 4：等待与调用放大的控制参数（修复计划第 4 阶段） ----------
// 三个参数都可被环境变量覆盖：默认值是计划给出的**初始值**，不是"已实测的生成速度"。

/** 单素材位累计预算（毫秒）：含排队之后的执行、重试与补描述（计划初始值 240 秒） */
export const SLOT_BUDGET_MS_DEFAULT = 240_000
/**
 * 同时绘制的素材位上限。结果与顺序无关：组装始终按正文原始行序（见 `mapBounded`）。
 *
 * 2026-10-08：由 2 提到 **20**（用户指令"我的并发数没有限额，先把限额设为 20，然后测试"）。
 * 两点依据 + 一处如实说明：
 *   · 这个上限**不控制成本**——每个素材位的派发都在账本里**派发前预扣**，且每素材位最多
 *     2 画 + 1 次补描述；N 个素材位无论几路并发，**调用总数一样**，并发只改变**时间**。
 *   · 原值 2 是"阶段 4 控制调用放大"时给的**计划初始值，从未实测**（旧注释自己就这么写的），
 *     不是任何测量结果。
 *   · **20 同样不是实测值**：服务端能扛多少路并发、429 限流从多少开始出现，**尚未测量**。
 *     在实测之前不要把它当"已知安全"。测出真实上限后回填这里，别再用猜的数。
 * 可用 `VITE_DRAW_CONCURRENCY` 覆盖，作为紧急收口。
 */
export const DRAW_CONCURRENCY_DEFAULT = 20

function envNumber(key: string): number | undefined {
  // 直接在 node 下跑断言脚本时没有 Vite 的 import.meta.env，用可选链安全读取
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  const n = Number(env?.[key])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function slotBudgetMs(): number {
  return envNumber('VITE_SLOT_BUDGET_MS') ?? SLOT_BUDGET_MS_DEFAULT
}

export function drawConcurrency(): number {
  const n = envNumber('VITE_DRAW_CONCURRENCY')
  return n ? Math.max(1, Math.floor(n)) : DRAW_CONCURRENCY_DEFAULT
}

/**
 * 有界并发映射：最多 limit 个任务同时在跑，返回值**按输入顺序**排列
 * （阶段 4 第 1 条"结果仍按原素材位顺序组装"）。纯函数、无副作用，可在 node 里断言并发峰值。
 */
export async function mapBounded<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

/**
 * 到时即返回的等待。**不取消底层调用**——只是不再等它；底层请求另有 Rust 侧超时兜底，
 * 其迟到结果不会再写进台账（写台账的是调用方，已经返回了）。
 */
export function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const msg = `素材位等待超时（超过 ${Math.round(ms / 1000)} 秒）`
  if (!(ms > 0)) return Promise.reject(new Error(msg))
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

// ---------- 浏览器演示用本地样例 SVG（均带 viewBox、图形元素 ≥6，纯色无文字） ----------
const POOL: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210" fill="none">
<rect x="60" y="140" width="5" height="62" fill="#c96f4a"/>
<path d="M65 142 h170 l-24 16 24 16 h-170 z" fill="#e8b48a"/>
<circle cx="628" cy="64" r="36" fill="#f2c76e"/>
<circle cx="640" cy="52" r="5" fill="#ffffff"/>
<path d="M0 210 L160 148 L280 186 L430 112 L570 170 L750 96 V210 Z" fill="#d9a35f" opacity="0.35"/>
<path d="M0 210 L230 158 L390 190 L560 134 L750 172 V210 Z" fill="#c96f4a" opacity="0.22"/>
<path d="M560 40 q12 -20 30 -20 q-4 -14 -22 -14 q-20 0 -26 14 q-8 14 4 22 q10 -6 14 -2z" fill="#5f8d8a" opacity="0.5"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" fill="none">
<path d="M150 250 C140 180 120 140 90 110" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M150 250 C165 190 195 150 230 130" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="90" cy="104" r="16" fill="#e8b48a"/>
<circle cx="236" cy="124" r="14" fill="#d9a35f"/>
<circle cx="150" cy="150" r="20" fill="#c96f4a"/>
<path d="M120 130 q-26 -8 -34 -30 q28 2 40 18z" fill="#8fb8a4"/>
<path d="M188 170 q24 -14 44 -6 q-10 24 -38 18z" fill="#8fb8a4"/>
<circle cx="90" cy="104" r="6" fill="#f2c76e"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="70" y="152" width="610" height="6" rx="3" fill="#c9a86a"/>
<path d="M180 152 v-70 h110 v70 z" fill="#8a5f3a"/>
<path d="M180 82 c-6 -20 8 -30 30 -28 l-4 30 c-12 2 -20 4 -26 10 z" fill="#a97c50"/>
<path d="M300 96 h140 v56 h-140 z" fill="#b98a5e"/>
<circle cx="235" cy="120" r="12" fill="#f2c76e"/>
<path d="M320 62 q12 -18 28 -18 q-2 -16 -20 -18 q-18 2 -22 18 q-4 18 16 22 q6 -8 12 -4z" fill="#6b8e6e" opacity="0.55"/>
<path d="M360 66 q12 -14 26 -14 q2 -12 -12 -16 q-14 -2 -20 10 q-4 12 8 20 q6 -6 10 -2z" fill="#6b8e6e" opacity="0.45"/>
<path d="M470 96 c32 -36 128 -36 160 0 v56 h-160 z" fill="#e8dcc8"/>
<circle cx="548" cy="120" r="10" fill="#f2c76e"/>
</svg>`,
]

// 小构件样例（P1 起按角色分开）：角饰必须集中在右下且不铺满，分割线必须横贯——
// 这些是 svg-quality 的确定性契约，演示链路也必须产出合规样例，否则 mock 文章会被引擎判为未达标。
const DECO_POOL: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<path d="M196 176 q-22 -30 4 -52 q26 22 -4 52z" fill="#8fb8a4"/>
<circle cx="228" cy="126" r="18" fill="#e8b48a"/>
<circle cx="228" cy="126" r="7" fill="#f2c76e"/>
<path d="M200 168 q26 -10 54 -4" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="258" cy="160" r="9" fill="#d9a35f"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<path d="M214 172 q-30 -18 -8 -46 q30 16 8 46z" fill="#c96f4a"/>
<circle cx="252" cy="142" r="14" fill="#e8b48a"/>
<path d="M182 178 q34 -6 66 0" stroke="#b08d8a" stroke-width="3" fill="none"/>
<circle cx="196" cy="150" r="8" fill="#8fb8a4"/>
</svg>`,
]

const DIVIDER_POOL: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 120" fill="none">
<rect x="40" y="56" width="670" height="3" rx="1.5" fill="#c9a86a"/>
<path d="M330 32 l30 28 -30 28 -30 -28z" fill="#e8b48a"/>
<circle cx="375" cy="60" r="9" fill="#c96f4a"/>
<circle cx="120" cy="60" r="7" fill="#8fb8a4"/>
<circle cx="630" cy="60" r="7" fill="#8fb8a4"/>
</svg>`,
]

const PHOTO_FRAME_POOL: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
<rect x="6" y="6" width="188" height="188" rx="8" fill="#f7f3ee"/>
<rect x="6" y="6" width="188" height="16" rx="6" fill="#d9a35f"/>
<rect x="6" y="178" width="188" height="16" rx="6" fill="#d9a35f"/>
<rect x="6" y="6" width="16" height="188" rx="6" fill="#c96f4a"/>
<rect x="178" y="6" width="16" height="188" rx="6" fill="#c96f4a"/>
<circle cx="60" cy="60" r="6" fill="#8fb8a4"/>
<circle cx="140" cy="60" r="6" fill="#8fb8a4"/>
<circle cx="60" cy="140" r="6" fill="#8fb8a4"/>
<circle cx="140" cy="140" r="6" fill="#8fb8a4"/>
</svg>`,
]

let poolIdx = 0
const decoIdx = { n: 0 }
const divIdx = { n: 0 }

/**
 * V3-R2：浏览器演示链路（素材工坊/子智能体）共用的本地样例 SVG（轮换取样）。
 * P1：按角色取样——角饰/分割线/照片框走各自合规样例，其余走通用插画池。
 */
export function mockArtSvg(kind?: string): string {
  if (kind === 'deco') return DECO_POOL[decoIdx.n++ % DECO_POOL.length]
  if (kind === 'divider') return DIVIDER_POOL[divIdx.n++ % DIVIDER_POOL.length]
  if (kind === 'photo-frame') return PHOTO_FRAME_POOL[0]
  const s = POOL[poolIdx % POOL.length]
  poolIdx++
  return s
}

// ---------- 占位/引用检测 ----------

// 占位/引用行是否存在于 v2 正文（主模型未内联 SVG，仅写图位/引用）。
// P0：描述段允许带策略尾标（`[[deco:blossom|花簇角饰|new]]`），[^\]]+ 天然覆盖。
// 阶段 2：`[[asset:…]]` 改为**宽匹配**——分类可以是中文/别名，是否合法交给解析器判定，
// 不能在"是不是一条引用"这一步就把中文分类的引用漏掉（那正是真实故障的起点）。
export function hasPlaceholders(v2: string): boolean {
  return (
    /\[\[img:(?:wide|inline)\|[^\]]+\]\]/.test(v2) ||
    /\[\[deco:[A-Za-z0-9_-]+\|[^\]]+\]\]/.test(v2) ||
    /\[\[asset:[^\]]+\]\]/.test(v2)
  )
}

/**
 * F12（2026-09-28 只读审计）：**App.tsx 的素材解析判定点应改用这个函数**（当前还写着 `hasPlaceholders`）。
 *
 * 语义 = 「含占位/引用」**或**「含未闭合的纯文字 `::: art deco` 块」。
 *
 * 为什么必须换：`findLegacyDecoBlocks` → `resolveLegacyDeco` 的恢复逻辑**只**在
 * materializePlaceholders 内部被调用，而 App.tsx 只以 `hasPlaceholders(v2)` 作为调用开关。
 * 一篇正文若**只**含纯文字 `::: art deco 名称` 块（没有 `[[img]]`/`[[deco]]`/`[[asset]]`），
 * hasPlaceholders 为 false → 恢复逻辑永不执行 → compose 直接判"现场角饰定义不可用…已忽略"
 * → 随后的气泡引用报"角饰未定义" → 触发一轮自动重写。同一个正文形态，加一行占位就能恢复、
 * 不加就被重写——行为不一致。这里给出统一的判定入口，两个入口不再各说各话。
 *
 * 注意：`hasPlaceholders` 保持原语义不变（resolvePreview 等处仍按它决定"此刻能不能先渲染预览"，
 * 那里只关心占位协议，不该因为存在遗留角饰块就憋着不渲染）。
 */
export function needsMaterialize(v2: string): boolean {
  if (hasPlaceholders(v2)) return true
  return findLegacyDecoBlocks(String(v2 || '').split(/\r?\n/)).length > 0
}

// ---------- 素材解析信息 ----------

export interface AssetBinding {
  slot: string // 素材位（占位说明或引用行）
  slotId: string // 素材位在本轮创作内的稳定标识（阶段 3：供单项重试与跨轮追踪）
  id: string // 绑定的库素材 id（未入库/失败为空串）
  source: 'asset' | 'reuse' | 'new' | 'failed' | 'recover'
  reason: string // 为什么复用或新建（可解释，供用户逐项重做）
}

export interface MaterializeInfo {
  used: Record<string, { id: string; title: string }> // 本次实际复用的库素材 id（供文档固化快照）
  residual: number // 无法解析的 [[asset:…]] 引用行数（触发"库素材引用缺失"可修复警告）
  storedFallback: number // 现场补做并自动存回素材库的数量
  mismatched: number // 声明分类与实际分类不符（但用途兼容）的引用数（可解释警告，不触发整篇重写）
  bindings: AssetBinding[] // 有序：每个素材位 → 库 ID / 来源 / 原因
  /** 从成品正文中**剔除**的素材协议残留行数（阶段 2 第 7 条：成品不得残留原始协议） */
  residue: number
  /** 面向用户的明确错误（在编辑界面显示，不作为文章段落输出） */
  errors: string[]
  /**
   * 排版层拒收、但**比对不上任何素材位**的记录（计划 §6 第三条）。
   * 这类拒收不能静默：素材块已经被排版层换成了占位文本，而台账里找不到对应的素材位，
   * 界面若不报出来，用户只会看到成品里少了一张图而查不到原因。
   */
  unlocatedRejects: string[]
  /** 规范化源文：成功的素材位 → 稳定 ID 引用；供自动修订使用（阶段 3 第 2 条） */
  normalized: string
  /** 本轮素材结果表（阶段 3） */
  ledger: AssetLedger | null
}

export function emptyMaterializeInfo(): MaterializeInfo {
  return {
    used: {},
    residual: 0,
    storedFallback: 0,
    mismatched: 0,
    bindings: [],
    residue: 0,
    errors: [],
    unlocatedRejects: [],
    normalized: '',
    ledger: null,
  }
}

export interface MaterializeOptions {
  /** 现场新建的素材是否存回个人素材库；默认跟随运行环境（桌面 true / 浏览器 false） */
  persist?: boolean
  /** 任务进度上报（纯展示，不参与流程判断） */
  onProgress?: ProgressFn
  /** 本轮创作的素材结果表（阶段 3）：跨自动修订复用，失败预算不清零 */
  ledger?: AssetLedger
  /** 本文主题/风格词（进指纹，主题变了才算新任务） */
  theme?: string
  /** 文档已保存的素材位绑定（遗留角饰块恢复的第一步） */
  priorBindings?: { slot: string; id: string }[]
  /**
   * 本轮模型声明的素材操作（DS 修复指南 §5.4；由 `finish_preparation` 的 `assetPolicy` 传入，
   * **不能**由前端按中文关键词猜）：
   * - `preserve`：本回合只改文字，素材保持不动 → 模型若把历史 `[[asset:…]]` 退回成
   *   `[[img:…|new]]`（身份退化），必须按文档绑定**确定性恢复**同一 assetId/快照，不许重新画一张；
   * - `modify`：模型明确选择修改/新建素材 → 正常走库检索与新绘（不受本条限制）。
   * 不传 = 旧的默认行为（按正文里的 `|new` 决定），保持既有调用点不变。
   */
  assetPolicy?: 'preserve' | 'modify'
  /** 文档固化快照（id → SVG）：库素材被改删后仍能按原版本恢复 */
  snapshots?: Record<string, { svg: string; ver: number }>
  /** 单项重试：这些素材位忽略失败缓存并重置预算（用户点"重试"时传入） */
  retrySlotIds?: string[]
  /**
   * 排版阶段（compose）对本轮素材块的拒收记录（计划 §6 第三条）。
   *
   * 素材块被写进正文 ≠ 已交付：还要在**最终排版**上过质检并真的落位。排版层把拒收结果交回来，
   * 被拒收的素材位就从 `ok` 降级为 `failed`（理由用 compose 给的 reason），出现在
   * `unfinished()` 里，界面据此给出单项重试。
   *
   * 注意：本轮**已产出的正文不会因此改写**（排版层已经把该处换成占位文本），降级影响的是
   * "完成状态"与后续轮次（下一轮不会再复用被拒收的成品块）。运行中也可以不等下一轮，
   * 直接在 compose 之后调用 `applyRejectedArts` 当场降级。
   */
  rejectedArts?: RejectedArtRecord[]
  /** 用户是否已停止（阶段 4 第 5 条）：为真时不再派发新任务、不再入库 */
  cancelled?: () => boolean
}

/** 传统图位占位 → 候选库分类（安放位硬约束） */
function candidatesFor(kind: string): string[] {
  if (kind === 'wide') return ['banner', 'art-wide', 'divider', 'photo-frame']
  if (kind === 'inline') return ['heading', 'art-inline']
  return ['bubble', 'deco'] // deco 角饰
}

/** 占位 kind → 入库分类 */
function categoryFor(kind: 'wide' | 'inline' | 'deco'): string {
  return kind === 'deco' ? 'deco' : kind === 'wide' ? 'art-wide' : 'art-inline'
}

// 素材块落位：usage=deco → `::: art deco <别名…>`（供气泡 |> [!语义|别名] 引用）；
// usage=wide/inline → `::: art wide/inline <说明>`（整行图）。
// P0：角饰输出多别名（本文占位别名 / 气泡引用词 / 库名称 / 库 ID），历史引用风格都能解析。
type SvgBlockResult =
  | { ok: true; block: string; note?: string }
  | { ok: false; kind: 'not-found' | 'empty' | 'read-error' | 'quality'; error: string }

/**
 * 复用素材的质检角色（计划 §6 第二条：**复用素材与新生成素材执行一致的适用门禁**）。
 *
 * 必须与 `asset-agent.kindForCategory` 逐字一致：素材工坊入库时就是按那个口径过的门禁，
 * 复用若换一套口径，就会出现"入库时合格、复用时被判不合格"（或反之）的错判。这里不 import
 * 它是为了不制造 image-agent ↔ asset-agent 的循环依赖（后者要 import 本模块的 acceptSvg）；
 * 两处口径将来若要合并，应把它下沉到零依赖的 asset-categories.ts。
 */
function gateKindFor(category: string, usage: string): string {
  switch (category) {
    case 'bubble':
    case 'deco':
      return 'deco'
    case 'divider':
      return 'divider'
    case 'heading':
      return 'heading'
    case 'photo-frame':
      return 'photo-frame'
    case 'banner':
    case 'art-wide':
      return 'wide'
    default:
      return usage === 'deco' ? 'deco' : usage === 'wide' ? 'wide' : 'inline'
  }
}

/** 质检口径版本：门禁内容一变就必须换它，否则旧结论会被缓存继续沿用（§6 第二条） */
const REUSE_GATE_VERSION = 'v1'
/** 复用素材的门禁结论缓存：assetId|版本|角色|口径版本 → 不达标原因（空数组 = 通过） */
const reuseGateCache = new Map<string, string[]>()

/**
 * 复用素材的适用门禁：结构（Tier 1）+ 按**真实显示尺寸**的栅格（阶段 5），与新绘素材同一套
 * `acceptSvg`。按「资产版本 + 内容哈希 + 用途角色 + 检查版本」缓存，避免每轮重复做昂贵的栅格化
 * （§6 第二条）；素材被改版时 version+1，键自然失效，内容被改而版本没变时哈希也会让键失效。
 *
 * 为什么复用路径原来必须补这一层："库里读到了"曾经直接等于"素材位完成"。可库里存着的可能是
 * 一张结构不合规（例如含 `<text>`）或 60px 下几乎看不见的角饰——它照样进正文、台账照样记 ok，
 * 直到排版层把它换成占位文本，用户才发现图没了。库读取成功只说明**可读**，不等于可用。
 *
 * 返回不达标原因（空数组 = 通过）。
 */
async function reuseGate(item: AssetMetaL, version: number, svg: string): Promise<string[]> {
  const kind = gateKindFor(item.category, item.usage)
  // 键里带**内容哈希**（指南 §5.4："`gen_svg=0` 或 ID 相同不足以证明素材不变"）：
  // 旧键只有 `id|版本`，于是"版本号没变、内容被改"（迁移、外部改写、恢复旧库）会命中旧结论，
  // 拿一段从没检查过的内容当"已通过质检"。哈希一变键就变，结论必然重算。
  const key = `${item.id}|${version}|${svgContentHash(svg)}|${kind}|${REUSE_GATE_VERSION}`
  const cached = reuseGateCache.get(key)
  if (cached) return cached
  const verdict = await acceptSvg(svg, kind)
  const reasons = verdict.ok ? [] : verdict.reasons.slice(0, 2)
  reuseGateCache.set(key, reasons)
  return reasons
}

/**
 * 库复用路径上与**文档固化快照**的身份比较（指南 §5.4 末段："除 ID 外比较版本和内容哈希"）。
 *
 * 这条路径上两侧内容都真的在手（文档快照 vs 刚读出来的库记录），所以能做完整的
 * ID + 版本 + 内容哈希比较：三者全同才算"同一素材"。不同就如实写明"库里这一份不是文档固化的
 * 那一版"——本回合**未声明 preserve** 时仍按库当前版本复用（用户允许改版），但不能再声称
 * 素材没变；文档里没有这件素材的快照 → 返回空串（无从比较，不编造结论）。
 */
function libIdentityNote(id: string, libVer: number, libSvg: string, docSnap?: { svg: string; ver: number }): string {
  if (!docSnap) return ''
  const doc = snapshotUsable(id, docSnap)
  if (!doc.ok) return `；文档里这件素材的固化快照不可用（${doc.error}）`
  const lib = { id, ver: libVer, hash: svgContentHash(libSvg) }
  if (sameAsset({ id, ver: doc.ver, hash: doc.hash }, lib)) {
    return `；与文档固化快照完全一致（v${doc.ver}，内容哈希 ${doc.hash}）`
  }
  return `；与文档固化快照不同（文档 v${doc.ver}/${doc.hash}，库当前 v${libVer || '未知'}/${lib.hash}）——本回合未声明素材保持不动，按库当前版本复用`
}

/**
 * 取一件库素材的 SVG 并组装成素材块。
 *
 * 为什么返回结构化结果而不是 `string | null`（2026-09-29 只读审计）：
 * `null` 同时表示「库里没有这件素材」与「有，但这次读不出来」，而两者处置完全不同——
 *   · 没有 → 是**正文写法**问题，模型改引用或改占位就能解决 → 计入可修复项，值得自动修订；
 *   · 读不出来 → 是**本机读取**问题，重写正文解决不了。若按「没有」处理，不仅误报「素材不存在」，
 *     在检索命中路径上还会**直接重新绘制一张**（白等几十秒、白花钱）。
 * `quality`（2026-09-29 计划 §6 第二条补入）：库里那份素材**读得出来但不达标**，同样不是
 * 正文写法问题——重写正文无用，处置是让用户换一张或重画（清单上单项重试），
 * **也不**在检索命中路径上顺势重画（那会把"库里有、只是不能用"悄悄换成一次模型调用）。
 */
async function svgBlock(
  item: AssetMetaL,
  desc: string,
  aliases?: (string | undefined)[],
  docSnap?: { svg: string; ver: number },
): Promise<SvgBlockResult> {
  const r = await getAssetSafe(item.id)
  if (!r.ok) {
    return r.notFound
      ? { ok: false, kind: 'not-found', error: `素材库中已不存在 ${item.id}` }
      : { ok: false, kind: 'read-error', error: `素材 ${item.id} 读取失败：${r.error}` }
  }
  if (!r.record.svg.trim()) {
    return { ok: false, kind: 'empty', error: `素材 ${item.id} 的 SVG 内容为空` }
  }
  const svg = r.record.svg
  const ver = usableVersionOf(r.record.meta?.version ?? item.version)
  // 计划 §6 第一/二条：库读取成功只代表"可读"，**结构 + 实际尺寸栅格**通过才算可用。
  // 新绘路径在 genOnce 里已经跑了 acceptSvg，复用路径过去没跑——这是"库里读到就直接当完成"
  // 的那条缝。这里补上同一套门禁（按资产版本缓存，不每轮重复栅格化）。
  const reasons = await reuseGate(item, ver, svg)
  if (reasons.length) {
    return {
      ok: false,
      kind: 'quality',
      error: `库素材「${item.title || item.name}」未通过质检：${reasons.join('；')}`,
    }
  }
  // 与文档固化快照做 ID + 版本 + 内容哈希比较（指南 §5.4）：库这份是不是文档里那一版，
  // 结论写进 reason，别让"ID 一样"冒充"素材没变"。
  const note = libIdentityNote(item.id, ver, svg, docSnap)
  if (item.usage === 'deco') return { ok: true, block: decoBlock(svg, item.name, item.id, aliases), note }
  const d = desc.trim() || item.title || item.name
  return { ok: true, block: `::: art ${item.usage === 'wide' ? 'wide' : 'inline'} ${d}\n${svg}\n:::`, note }
}

/**
 * `assetPolicy='preserve'` 下的**确定性身份恢复**（DS 修复指南 §5.4 第 2 条）。
 *
 * 只做一件事：本文档**已经绑定过**的素材位 → 同一个 assetId。匹配不上就返回 none，
 * 交给调用方**明确阻断**（指南："不能掉回普通检索/新绘制"），**绝不**按模糊描述随便挑一件库素材顶上。
 *
 * 两级匹配，都是确定的、不看语义相似度：
 * 1. 素材位文本一致（去掉空白与 `|new` 尾标）；
 * 2. 模型把引用写法退回成占位、但 kind+描述未变（身份退化的典型形态）——且必须**唯一**命中。
 *
 * **唯一性也要管第一级**（指南 §5.4：`find()` 取首项不算，同 slot 两条不同绑定必须阻断）：
 * 旧实现用 `bindings.find(...)`，同一 slot 有两条不同 assetId 时静默采用第一条——
 * 用户看到的是"素材没变"，实际选的是哪一张取决于数组顺序。只有 (slot, id) **完全相同**的
 * 重复记录才允许去重（那是同一绑定的冗余，不是歧义）。
 */
type PriorBindingLookup =
  | { status: 'hit'; id: string }
  | { status: 'ambiguous'; reason: string }
  | { status: 'none' }

function priorBindingFor(
  bindings: { slot: string; id: string }[] | undefined,
  kind: string,
  desc: string,
  slotKey: string,
  split: (s: string) => { desc: string },
): PriorBindingLookup {
  if (!bindings || !bindings.length) return { status: 'none' }
  const norm = (s: string) => String(s || '').replace(/\s+/g, '').replace(/\|new\b/g, '')
  /** 同一组绑定里，身份是否唯一（只把 (slot,id) 完全相同的记录当重复） */
  const pickUnique = (list: { slot: string; id: string }[]): PriorBindingLookup => {
    const ids = [...new Set(list.map((b) => String(b.id || '')))]
    if (ids.length > 1) {
      return { status: 'ambiguous', reason: `同一素材位在文档里有 ${ids.length} 个不同绑定（${ids.join(' / ')}），无法确定"保持不动"指的是哪一张` }
    }
    const id = ids[0] || ''
    if (!id) return { status: 'none' }
    return { status: 'hit', id }
  }
  const slotN = norm(slotKey)
  const exact = bindings.filter((b) => norm(b.slot) === slotN)
  if (exact.length) return pickUnique(exact)
  const key = `${kind}|${norm(desc)}`
  const byDesc = bindings.filter((b) => {
    const m = /^\[\[(?:img:(wide|inline)|deco:[A-Za-z0-9_-]+)\|([^\]]+)\]\]$/.exec(String(b.slot).trim())
    if (!m) return false
    const k = m[1] || 'deco'
    return `${k}|${norm(split(m[2]).desc)}` === key
  })
  if (byDesc.length) return pickUnique(byDesc)
  return { status: 'none' }
}

/**
 * `preserve` 下取"本文档固化的那份 SVG"（指南 §5.4：**文档快照是保持素材的权威输入**）。
 *
 * 同 ID 素材在库里被升级到 v2 时，仍必须用文档里的 v1；库条目被删、快照还在时仍能恢复。
 * 快照缺失或损坏 → **明确失败**：不拿库最新版悄悄补齐（那等于让"只改文字"这一回合
 * 顺手把用户的配图换成另一个版本，而使用者以为素材没动）。
 *
 * 判定本身（结构校验：ID 非空 / 版本是可用的数值 / SVG 非空且含 `<svg` / 长度在合理区间）在
 * `asset-resolve.snapshotUsable`——**损坏**与**没有**是两回事，必须分得开：前者是"文档里本来
 * 有这份记录、内容坏了"（绝不能拿库里的顶替），后者是"从未固化过"。版本与内容哈希一并返回，
 * 供上层做身份比较（**不能只比 ID**）。
 */
function snapshotOf(
  opts: MaterializeOptions | undefined,
  id: string,
): { ok: true; svg: string; ver: number; hash: string } | { ok: false; error: string } {
  const snap = opts?.snapshots ? opts.snapshots[id] : undefined
  const v = snapshotUsable(id, snap)
  if (v.ok) return v
  return {
    ok: false,
    error:
      snap === undefined
        ? `${v.error}，本回合声明素材保持不动时不能用素材库当前版本顶替（会悄悄换掉作品里的图）`
        : `${v.error}；不能改用素材库当前版本顶替（会悄悄换掉作品里的图）`,
  }
}

/**
 * 快照之外再比一次**库侧版本**（指南 §5.4 末段："除 ID 外比较版本和内容哈希；`gen_svg=0`
 * 或 ID 相同不足以证明素材不变"）。
 *
 * preserve 路径**不读库内容**（不拿库当前值当内容），所以这里只用库索引里已有的版本号比较：
 * 版本不同 → 如实写明"库里已是 vN，本回合仍用文档那一版"；版本相同但库侧内容哈希没有核对过 →
 * **不写"与库一致"**（证明不了就不写）；库里没有这件素材 → 写明快照仍然有效。返回空串 = 一切一致。
 */
function libVersionNote(id: string, snapVer: number, libMeta: AssetMetaL | undefined): string {
  if (!libMeta) return `；素材库里已没有这件素材（${id}），文档快照仍然有效`
  const libVer = usableVersionOf(libMeta.version)
  if (!libVer) return `；素材库里这件素材没有可用版本号，无法证明与文档是同一版，本回合按文档快照恢复`
  if (libVer !== snapVer) return `；素材库里同 ID 素材已是 v${libVer}（文档 v${snapVer}），本回合仍用文档那一版`
  return ''
}

/**
 * 用**文档快照**的内容 + 素材位的角色信息拼出素材块（`preserve` 专用）。
 *
 * 内容一律来自快照；库条目只用来提供**角色信息**（名称 / 分类 / usage）——库条目已被删除时按
 * 占位 kind 推导，保证"库删了、快照还在"也能恢复（指南 §5.4）。分类同样回落到快照侧推导，
 * 不让恢复出来的引用因为库没了就写不出分类。
 */
function snapshotBlock(
  svg: string,
  meta: AssetMetaL | undefined,
  id: string,
  kind: 'wide' | 'inline' | 'deco',
  desc: string,
  aliases?: (string | undefined)[],
): { block: string; category: string } {
  const usage = meta?.usage || (kind === 'deco' ? 'deco' : kind)
  if (usage === 'deco') {
    return { block: decoBlock(svg, meta?.name || id, id, aliases), category: meta?.category || 'deco' }
  }
  const wide = usage === 'wide'
  const d = desc.trim() || meta?.title || meta?.name || ''
  return {
    block: `::: art ${wide ? 'wide' : 'inline'} ${d}\n${svg}\n:::`,
    category: meta?.category || (wide ? 'art-wide' : 'art-inline'),
  }
}

/** 角饰块的落位文本；别名按「气泡引用词 / 本文占位别名 / 库名称 / 库 ID」并集输出 */
function decoBlock(
  svg: string,
  assetName: string,
  assetId: string,
  aliases?: (string | undefined)[],
): string {
  const names = planDecoAliases({
    pairedRef: aliases?.[0],
    placeholderAlias: aliases?.[1],
    assetName,
    assetId,
  })
  if (!names.length) names.push(assetId || assetName || 'deco') // 别名全被过滤时的兜底
  return `::: art deco ${names.join(' ')}\n${svg}\n:::`
}

/** 库条目 → 解析层需要的纯结构（解析层零依赖，不认 AssetMetaL） */
function toLibItem(m: AssetMetaL): LibItem {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    usage: m.usage,
    title: m.title,
    desc: m.desc,
    // 版本必须带上（指南 §5.4："除 ID 外比较版本"）：没有版本，"库里还是那个 ID"就没法证明
    version: m.version,
  }
}

/**
 * 把排版层的拒收记录回写台账（修复计划 §6 第三条）——"库读取成功 ≠ 验收完成"的落点。
 *
 * 调用时机有两处，任选其一（也可以都用，重复调用是幂等的）：
 * 1. `composeMarkdown()` 之后**当场**调用（传本轮 `info`）——完成状态立刻从 ok 降级，
 *    界面上的"仍未完成 N 处 + 逐项重试"与本轮正文一致；
 * 2. 交给下一轮 `materializePlaceholders` 的 `opts.rejectedArts`——下一轮不再复用被拒的成品块。
 *
 * 只有「比对不上任何素材位」的拒收会写进 `info.errors` / `info.unlocatedRejects`：
 * 降级本身已经由台账（`unfinished()`）与排版层的 blocking 问题现身两处报出来了，
 * 这里再写一遍只会让同一件事在界面上刷屏。
 */
export function applyRejectedArts(
  ledger: AssetLedger | null | undefined,
  rejectedArts: RejectedArtRecord[] | null | undefined,
  info?: MaterializeInfo | null,
): RejectionOutcome {
  const res: RejectionOutcome = ledger
    ? noteRejectedArts(ledger, rejectedArts)
    : { demoted: [], alreadyUnfinished: [], unlocated: [] }
  if (info) {
    if (!Array.isArray(info.unlocatedRejects)) info.unlocatedRejects = []
    if (!Array.isArray(info.errors)) info.errors = []
    for (const a of res.unlocated) {
      const msg =
        `排版阶段拒收了素材「${clip((a.refs || [])[0] || '未知素材', 40)}」` +
        `（源文第 ${a.line} 行：${a.reason || '未说明原因'}），但台账里找不到对应的素材位——` +
        `该处已在成品中被占位文本代替，不会被算作交付成功，请核对该处的素材写法。`
      info.unlocatedRejects.push(msg)
      info.errors.push(msg)
    }
  }
  return res
}

/**
 * V3-R3 素材解析主入口（阶段 2/3 重写）：
 * - `[[asset:…]]`：**宽匹配后校验字段**（中文分类/别名都认），按 ID 优先、名称唯一匹配解析；
 *   用途不兼容、重名、未知分类分别给明确结果，绝不"宽松解析"把图硬塞进不合适的位置。
 * - `[[img:…]]/[[deco:…]]`：先按语义检索库（强命中才复用）；否则委托素材智能体绘制；
 *   第三段 `new` 强制重新绘制。
 * - 历史遗留的**纯文字** `::: art deco 名称` 块：按历史绑定/快照、精确 ID、唯一库名称恢复，
 *   恢复不了只报错，**不自动发起绘图**。
 * - 台账（opts.ledger）：同一素材位在整个回合内只做一次决定——成功后跨轮直接复用，
 *   失败后不再重获预算（自动修订因此不会把等待成倍放大）。
 * - 成品正文**不残留任何原始协议**：解析不了的行从正文剔除，改由诊断信息呈现。
 * persist（默认桌面）为真时，现场补做结果自动入库（origin=article-fallback）并计入文档快照。
 */
export async function materializePlaceholders(
  v2: string,
  theme?: string,
  info?: MaterializeInfo | null,
  opts?: MaterializeOptions,
): Promise<string> {
  const inf: MaterializeInfo = info || emptyMaterializeInfo()
  // info 是跨模块传递的可变累加器：补齐新增字段，避免旧调用点/旧持久化数据导致崩溃
  if (!Array.isArray(inf.bindings)) inf.bindings = []
  if (typeof inf.mismatched !== 'number') inf.mismatched = 0
  if (typeof inf.residue !== 'number') inf.residue = 0
  if (!Array.isArray(inf.errors)) inf.errors = []
  if (!Array.isArray(inf.unlocatedRejects)) inf.unlocatedRejects = []
  const persist = opts?.persist ?? inTauri()
  const say = opts?.onProgress || (() => {})
  const isCancelled = opts?.cancelled || (() => false)
  const themeWord = opts?.theme ?? theme ?? ''
  const lines = String(v2 || '').split(/\r?\n/)

  // 全量库条目索引（小库单次读取即可）。
  // W1（2026-09-29 接线）：这里**必须**用 listAssetsSafe 并把"读不出来"抛出去，不能继续跑。
  // 理由：listAssets 把读取失败压成空数组，而空库在下面 `resolveAssetRef` / `resolveLegacyDeco`
  // 眼里与"库里没有这件素材"无法区分——正文里**已经存在**的 `[[asset:…]]` 会被全部判成
  // "所引用的库素材不存在"，于是从正文里剔除、给用户一句"库素材引用缺失"，还可能触发自动重写。
  // 结论与事实完全相反，而且是静默发生的（用户以为素材真的丢了）。
  // 抛错则让整个回合以**真实原因**失败：App.tsx 的 turn() 已把这段调用包在 try/catch 里
  // → fail(e) 显示可见错误并解锁输入；retryAsset() 也有 try/catch，把原因挂到预览区提示条上。
  const libR = await listAssetsSafe()
  if (!libR.ok) throw new Error(`素材库读取失败：${libR.error}`)
  const lib = libR.items
  const libItems = lib.map(toLibItem)
  const byId = new Map(lib.map((m) => [m.id, m]))
  const byName = new Map(lib.map((m) => [m.name, m]))
  const takenNames = new Set(lib.map((m) => m.name))

  // 台账（阶段 3）：调用方未提供时自建一个——单次解析仍能工作，跨轮复用才需要传同一个
  const ledger: AssetLedger = opts?.ledger ?? createLedger('adhoc')
  inf.ledger = ledger
  // 计划 §6 第三条：上一轮排版阶段拒收的素材位，先回写台账（ok → failed），再往下走。
  // 必须在阶段 A 之前：被拒收的素材位这一轮直接按"未完成"处理（从正文剔除、给出可重试项），
  // 绝不因为"库里读到过"又被复用回正文。
  if (opts?.rejectedArts?.length) applyRejectedArts(ledger, opts.rejectedArts, inf)
  // 铁律 6 + 计划 §6 第六条：**只有用户手动点"重试"**才会走到这里（App.retryAsset 的
  // retrySlotIds）。自动修订/复检/故障重试一律不传，因此自动流程不可能冒充用户重试来重置预算。
  const retryIds = new Set(opts?.retrySlotIds || [])

  const bind = (b: AssetBinding) => {
    inf.bindings.push(b)
  }
  /** 记一条"素材位 → 库 ID"的确定绑定（成功路径统一走它，保证 slotId 不会漏写） */
  const bindOk = (e: LedgerEntry, id: string, source: AssetBinding['source'], reason: string) => {
    bind({ slot: e.slot, slotId: e.slotId, id, source, reason })
  }

  // 历史遗留的纯文字角饰块（阶段 2 第 4/5 条）：先整体解析，再在主循环里替换
  const legacyBlocks = findLegacyDecoBlocks(lines)
  const legacyAt = new Map<number, LegacyDecoBlock>()
  const legacySkippedTo = new Map<number, number>()
  for (const b of legacyBlocks) {
    legacyAt.set(b.start, b)
    legacySkippedTo.set(b.start, b.end)
  }

  // P0：预扫描角饰素材位（传统 [[deco:]] 占位、遗留角饰块，或引用了 usage=deco 库素材的
  // [[asset:]]），与其后"最近的、尚未被占用的"气泡引用词配对——角饰块据此按本文别名输出。
  const decoSlots: number[] = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (legacyAt.has(i)) {
      decoSlots.push(i)
      return
    }
    if (/^\[\[deco:[A-Za-z0-9_-]+\|/.test(t)) {
      decoSlots.push(i)
      return
    }
    const ref = parseAssetRef(t)
    if (ref && !ref.error) {
      const hit = byId.get(ref.idOrName) ?? byName.get(ref.idOrName)
      if (hit && hit.usage === 'deco') decoSlots.push(i)
    }
  })
  const pairedRefs = pairBubbleRefs(lines, decoSlots)
  const aliasAt = new Map<number, string>()
  decoSlots.forEach((slot, k) => {
    if (pairedRefs[k]) aliasAt.set(slot, pairedRefs[k]!)
  })

  // 传统占位的语义检索缓存（同描述+策略只搜一次）
  const searchCache = new Map<string, { hit: AssetMetaL | null; reason: string; near: AssetMetaL[] }>()

  // 现场新建素材的引用名：优先用本文别名，其次 kind 前缀；与库内已有名冲突时加序号
  const uniqueName = (base: string): string => {
    const root = sanitizeName(base)
    if (!takenNames.has(root)) {
      takenNames.add(root)
      return root
    }
    for (let n = 2; n < 100; n++) {
      const cand = `${root}-${n}`
      if (!takenNames.has(cand)) {
        takenNames.add(cand)
        return cand
      }
    }
    return `${root}-${Date.now().toString(36)}`
  }

  // 待处理素材位总数（`[[img]]`/`[[deco]]` 占位 + 遗留角饰块）——仅供气泡显示
  // 「派发素材任务（共 N 个）」，实际是复用还是新建仍由逐位判定（与流程判断无关）。
  const totalSlots = lines.filter((l, i) => {
    if (legacyAt.has(i)) return true
    const t = l.trim()
    return /^\[\[img:(wide|inline)\|/.test(t) || /^\[\[deco:[A-Za-z0-9_-]+\|/.test(t)
  }).length
  if (totalSlots > 0) say({ phase: 'asset', text: `派发素材任务（共 ${totalSlots} 个素材位）` })

  // ================= 阶段 A：逐个素材位做决定（只读本地库，不调模型） =================
  // 计划项与素材位一一对应；真正需要绘图的项只登记 slotId，绘制在阶段 B 统一跑。
  type Plan =
    | { t: 'text'; text: string }
    | { t: 'emit'; block: string; ref: string }
    | { t: 'drop'; ref: string }
    | { t: 'draw'; slotId: string }
  interface DrawTask {
    entry: LedgerEntry
    kind: 'wide' | 'inline' | 'deco'
    desc: string
    cachedReason: string
    placeholderAlias: string
    /** 本文里与该素材位配对的气泡引用词（角饰别名之一） */
    pairedRef?: string
    shortDesc: string
  }
  const plans: Plan[] = []
  const drawTasks = new Map<string, DrawTask>()
  /**
   * `preserve` 违规清单（指南 §5.4："预检整组素材再进入执行"）。
   *
   * 素材位的判定全部发生在绘制之前（本函数先走完整行循环、再执行 `draw` 计划），
   * 但光有"判定在前"还不够：前面几位的 `draw` 计划已经躺在 `plans` 里，执行阶段照样会画出去。
   * 一旦本回合有 preserve 违规，这份候选注定过不了门禁——再花钱画别的位就是纯浪费。
   * 因此执行阶段看到非空清单就**整组跳过绘制**，如实把违规原因报上去。
   */
  const preserveViolations: string[] = []

  /** 台账命中：成功直接复用成品块；失败沿用同一结论（不重新检索、不重画） */
  const reuseFromLedger = (e: LedgerEntry): Plan | null => {
    if (e.status === 'ok' && e.block) {
      return { t: 'emit', block: e.block, ref: e.ref || e.slot }
    }
    if (e.status === 'failed') {
      inf.residue++
      inf.errors.push(`素材位未完成：${clip(e.desc || e.slot, 40)}（${e.reason}）`)
      say({ phase: 'asset', text: `跳过未完成素材位：${clip(e.desc || e.slot, 14)}` })
      return { t: 'drop', ref: e.slot }
    }
    return null
  }

  /**
   * 单项重试：用户明确要求再试一次 → 忽略失败缓存并重置预算。
   *
   * 计划 §6 第五条：重置的只是**预算**，不是"完成"——重试后产出的素材照样要过适用的门禁
   * （新绘走 genOnce 的 acceptSvg，复用走 reuseGate），也要在最终排版上真的落位；排版层若
   * 再次拒收，`applyRejectedArts` 会再把它降级为 failed。**没有**任何独立保存入口能绕过检查
   * 把它算成功（完成状态只由台账判定，而台账只被门禁与拒收回写改写）。
   *
   * 计划 §6 第六条：`retryIds` 只来自用户显式发起的那次重试（`opts.retrySlotIds`，
   * 见 App.retryAsset）。自动流程（自动修订、复检、故障重试）不传它——它们复用同一个台账，
   * 因此不会冒充用户重试来给素材位回血。
   */
  const applyRetry = (e: LedgerEntry) => {
    if (retryIds.has(e.slotId)) {
      e.status = 'pending'
      e.attempts = 0
      e.clarifications = 0
    }
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]

    // ---- 遗留纯文字角饰块：按历史绑定/快照/精确 ID/唯一名称恢复，恢复不了只报错 ----
    const legacy = legacyAt.get(idx)
    if (legacy) {
      const entry = ensureSlot(ledger, {
        kind: 'legacy-deco',
        slot: lines[legacy.start].trim(),
        desc: legacy.body || legacy.names[0],
        policy: 'auto',
        theme: themeWord,
      })
      applyRetry(entry)
      const hit = reuseFromLedger(entry)
      if (hit) {
        plans.push(hit)
        idx = legacySkippedTo.get(idx) ?? idx
        continue
      }
      const decided = resolveLegacyDeco(legacy, {
        lib: libItems,
        bindings: opts?.priorBindings,
        snapshots: opts?.snapshots,
        // 指南 §5.4：preserve 下文档里没有记录的素材位一律阻断，不许按库里的同 ID/同名顶替
        // （快照/绑定的权威性由 resolveLegacyDeco 内部按"文档记录优先"处理）。
        assetPolicy: opts?.assetPolicy,
        // F4（2026-09-28 只读审计）：冲突检测必须拿 **deco 的名字**（`[[deco:<名称>|…]]` 的第一段）
        // 去比 `resolveLegacyDeco` 里的 `block.names`（形如 bud/star）。旧写法
        // `/^\[\[(?:deco|img):[A-Za-z0-9_-]*\|([^\]]+)\]\]$/` 捕获的是**第一个 `|` 之后的全部**，
        // 即 `[[deco:bud|花簇角饰|new]]` 捕到的是 `花簇角饰|new`（描述）——与名字是两个空间，
        // 永远比对不上，于是"同一素材位既复用旧的又重新画"这条冲突分支成了死代码
        // （实际行为：旧图被恢复 + 新图另画，谁也不报错）。img 占位没有名字，不参与该比对。
        newPolicyNames: lines
          .map((l) => /^\[\[deco:([A-Za-z0-9_-]+)\|([^\]]+)\]\]$/.exec(l.trim()))
          .filter((m): m is RegExpExecArray => !!m)
          .filter((m) => splitPolicy(m[2]).policy === 'new')
          .map((m) => m[1]),
      })
      if (!decided.ok) {
        inf.residue++
        finishFail(entry, decided.error)
        bind({ slot: entry.slot, slotId: entry.slotId, id: '', source: 'failed', reason: decided.error })
        inf.errors.push(`旧角饰块「${legacy.names[0]}」未被采用：${decided.error}`)
        trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'refuse', desc: clip(entry.desc, 60), note: decided.error })
        plans.push({ t: 'drop', ref: entry.slot })
        idx = legacySkippedTo.get(idx) ?? idx
        continue
      }
      const meta = byId.get(decided.id)
      // 计划 §6 第二条的**边界**：这一支（历史纯文字角饰块的恢复）刻意**不**跑复用门禁。
      // 理由：它恢复的是**本文档已经固化过的成品**（快照/历史绑定），不是"本轮新挑中的复用"；
      // 而这条路径按设计**不会自动重绘**（resolveLegacyDeco 只恢复、不画），一旦用栅格门禁
      // 判它不合格，用户的旧文档会直接丢掉角饰且没有任何补救入口——那是删用户的图，不是验收。
      // 真正需要门禁的是"库里有这件素材 → 我决定用它"的路径（svgBlock 的两个复用分支）：
      // 那里的判断还在"本轮"，不合格可以如实记为未完成并让用户换一张。被恢复的块若真不合格，
      // 排版层仍会在最终排版时再查一遍并把结果回写到台账（compose.rejectedArts → applyRejectedArts）。
      //
      // 快照路径（decided.source='snapshot'）内容与版本都来自**文档**；库路径才去读库，
      // 读到的这一份按库当前版本如实记账（版本 + 内容哈希），**不**声称它就是文档固化过的那一版
      // （指南 §5.4："不能因为库里还有这个 ID 就当成同一版本"）。
      const libRec = decided.svg === null && meta ? await getAsset(meta.id) : null
      const svg = decided.svg ?? libRec?.svg ?? null
      if (!svg || !svg.trim()) {
        inf.residue++
        const why = `素材 ${decided.id} 的 SVG 读不出来（可能已被删除）`
        finishFail(entry, why)
        bind({ slot: entry.slot, slotId: entry.slotId, id: '', source: 'failed', reason: why })
        inf.errors.push(`旧角饰块「${legacy.names[0]}」未被采用：${why}`)
        plans.push({ t: 'drop', ref: entry.slot })
        idx = legacySkippedTo.get(idx) ?? idx
        continue
      }
      const hash = decided.hash || svgContentHash(svg)
      // 真实版本：快照路径 = 文档里的版本；库路径 = 库记录的版本（未知记 0，并写明"版本未知"）
      const ver = decided.source === 'snapshot' ? decided.ver : usableVersionOf(libRec?.meta?.version ?? decided.ver)
      // 注：库路径在这里**不会**再回落到文档快照——`resolveLegacyDeco` 内部已经按"文档记录优先"
      // 处理过（快照在就绝不用库），因此能走到这里的库恢复，文档里本来就没有这件素材的快照记录。
      const blk = decoBlock(svg, meta?.name || decided.id, decided.id, [aliasAt.get(idx), legacy.names[0], meta?.name, decided.id])
      entry.ref = `[[asset:${meta?.category || 'deco'}|${decided.id}|${entry.desc || legacy.names[0]}]]`
      const reason =
        `旧角饰块按${decided.source === 'snapshot' ? '文档固化快照' : '素材库当前版本'}恢复：${decided.reason}` +
        `｜素材身份 ${decided.id} v${ver || '未知'} 内容哈希 ${hash}`
      finishOk(entry, { assetId: decided.id, version: ver, source: 'recover', reason, block: blk, ref: entry.ref })
      bindOk(entry, decided.id, 'recover', reason)
      if (meta) inf.used[meta.id] = { id: meta.id, title: meta.title || meta.name }
      say({ phase: 'asset', text: `恢复旧角饰块：${clip(entry.desc, 14) || legacy.names[0]}` })
      trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'recover', assetId: decided.id, desc: clip(entry.desc, 60), note: reason })
      plans.push({ t: 'emit', block: blk, ref: entry.ref })
      idx = legacySkippedTo.get(idx) ?? idx
      continue
    }

    // ---- [[asset:…]] 引用：宽匹配 + 字段校验 + 严格解析 ----
    const assetRef = parseAssetRef(line)
    if (assetRef) {
      const slotKey = line.trim()
      const entry = ensureSlot(ledger, {
        kind: 'asset',
        slot: slotKey,
        desc: assetRef.desc || assetRef.idOrName,
        policy: 'auto',
        theme: themeWord,
        // F1（2026-09-28 审计）：素材位身份 = 归一化分类 + 素材 ID/名称。
        // `prep.ts` 的清单行把用途段写成固定占位文案「按用途改这句说明」，模型照抄两行不改
        // （或两处用途本就同句）时，只按描述算指纹会把第二条**静默并进第一条**——成品两处同图、
        // 另一张被丢弃且无任何警告。带上身份后，引用的是哪一张素材才算"同一个素材位"。
        identity: `${assetRef.category || assetRef.categoryRaw}|${assetRef.idOrName}`,
      })
      applyRetry(entry)
      const hit = reuseFromLedger(entry)
      if (hit) {
        plans.push(hit)
        continue
      }

      // ---- assetPolicy='preserve'：显式 [[asset:…]] 引用同样要闭锁（指南 §5.4 末段） ----
      // "显式 [[asset]] 与旧 [[img:…|new]] 恢复路径都适用"：本条路径也只接受**本文档已经固化过**的
      // 那一件，内容取**文档快照**（库里的同 ID 素材即使已升级到 v2 也不用）。
      // 新引用（文档里从没有过的素材）、快照缺失都明确阻断——preserve 不是"从库里随便挑一张"。
      if (opts?.assetPolicy === 'preserve') {
        const boundIds = new Set<string>([
          ...Object.keys(opts.snapshots || {}),
          ...(opts.priorBindings || []).map((b) => String(b.id || '')).filter(Boolean),
        ])
        const refName = String(assetRef.idOrName || '').trim()
        let id = boundIds.has(refName) ? refName : ''
        if (!id) {
          // 引用写的是**库名称**时，允许按名称解析——但解析结果必须本来就是本文档固化过的素材
          const byName = [...byId.values()].find((m) => m.name === refName || m.title === refName)
          if (byName && boundIds.has(byName.id)) id = byName.id
        }
        if (!id) {
          const why = `本回合声明素材保持不动，但正文引用的「${refName || '(空)'}」不是本文档固化过的素材（新引用）。要保持素材不动就照抄现有 [[asset:分类|素材ID|用途说明]]；要换图请把 assetPolicy 改为 modify`
          inf.residue++
          finishFail(entry, why)
          bind({ slot: slotKey, slotId: entry.slotId, id: '', source: 'failed', reason: why })
          inf.errors.push(`素材引用未采用：${clip(refName || slotKey, 40)}（${why}）`)
          say({ phase: 'asset', text: `素材未采用：${clip(refName || slotKey, 14)}` })
          trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'refuse', desc: clip(entry.desc, 60), note: why })
          plans.push({ t: 'drop', ref: slotKey })
          preserveViolations.push(why)
          continue
        }
        const metaP = byId.get(id)
        const snap = snapshotOf(opts, id)
        if (!snap.ok) {
          const why = `本回合声明素材保持不动，但引用 ${id} 不可用：${snap.error}`
          inf.residue++
          finishFail(entry, why)
          bind({ slot: slotKey, slotId: entry.slotId, id: '', source: 'failed', reason: why })
          inf.errors.push(`素材引用未采用：${clip(refName || slotKey, 40)}（${why}）`)
          say({ phase: 'asset', text: `素材未采用：${clip(refName || slotKey, 14)}` })
          trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'fail', assetId: id, desc: clip(entry.desc, 60), note: why })
          plans.push({ t: 'drop', ref: slotKey })
          preserveViolations.push(why)
          continue
        }
        const kindOfSlot: 'wide' | 'inline' | 'deco' = metaP?.usage === 'deco' ? 'deco' : metaP?.usage === 'wide' ? 'wide' : 'inline'
        const built = snapshotBlock(snap.svg, metaP, id, kindOfSlot, assetRef.desc, [aliasAt.get(idx), assetRef.idOrName])
        // 身份写全：文档固化的版本 + 内容哈希 + 与库侧版本的比较结论（指南 §5.4 末段）
        const reason =
          `本回合声明素材不动，按文档固化快照恢复同一素材（${id} v${snap.ver}，内容哈希 ${snap.hash}），没有重新绘制` +
          libVersionNote(id, snap.ver, metaP)
        entry.ref = `[[asset:${built.category}|${id}|${assetRef.desc}]]`
        finishOk(entry, { assetId: id, version: snap.ver, source: 'recover', reason, block: built.block, ref: entry.ref })
        bind({ slot: slotKey, slotId: entry.slotId, id, source: 'recover', reason })
        inf.used[id] = { id, title: metaP?.title || metaP?.name || id }
        say({ phase: 'asset', text: `按文档固化快照复用素材「${metaP?.title || metaP?.name || id}」（未重画）` })
        trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'recover', assetId: id, category: built.category, desc: clip(entry.desc, 60), note: reason })
        plans.push({ t: 'emit', block: built.block, ref: entry.ref })
        continue
      }
      const resolved = resolveAssetRef(assetRef, libItems)
      if (!resolved.ok) {
        // 无法解析：计入可修复警告（模型可改写法），并**从成品正文中剔除协议行**
        inf.residual++
        inf.residue++
        finishFail(entry, resolved.error)
        bind({ slot: slotKey, slotId: entry.slotId, id: '', source: 'failed', reason: resolved.error })
        inf.errors.push(`素材引用不可用：${resolved.error}`)
        trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'refuse', desc: clip(entry.desc, 60), note: resolved.error })
        plans.push({ t: 'drop', ref: slotKey })
        continue
      }
      const item = resolved.item
      const meta = byId.get(item.id)
      // 文档里存着这件素材的固化快照时，本次库复用要**比较 ID + 版本 + 内容哈希**（指南 §5.4 末段），
      // 结论写进 reason：库这一份到底是不是文档里那一版，不能靠"ID 一样"断定。
      const docSnapForReuse = opts?.snapshots?.[item.id]
      const blkR = meta ? await svgBlock(meta, assetRef.desc, [aliasAt.get(idx), assetRef.idOrName], docSnapForReuse) : null
      if (!blkR || !blkR.ok) {
        const kind = blkR ? blkR.kind : 'not-found'
        const why = blkR ? blkR.error : `素材 ${item.id} 不在本次索引里`
        // 只有「库里确实没有」才计入可修复项（residual）：那是**正文写法**问题，模型改引用就能解决。
        // 「内容为空」「读不出来」「质量不达标」都是**本机素材本身**的问题——模型再写一遍也一样
        // 拿不到/过不了，计入 residual 只会白跑一轮自动修订。如实报错 + 记为未完成
        // （可在清单上单项重试，或换一张素材）才是正解。
        if (kind === 'not-found') inf.residual++
        inf.residue++
        finishFail(entry, why)
        bind({ slot: slotKey, slotId: entry.slotId, id: '', source: 'failed', reason: why })
        inf.errors.push(
          kind === 'not-found'
            ? `素材引用不可用：${why}`
            : kind === 'quality'
              ? `库素材未通过质检（正文该处已移除；重写正文无用，请换一张素材或在预览区重试）：${why}`
              : `素材读取失败（正文该处已移除，重写正文无用，请在预览区重试）：${why}`,
        )
        trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'fail', assetId: item.id, desc: clip(entry.desc, 60), note: why })
        plans.push({ t: 'drop', ref: slotKey })
        continue
      }
      const blk = blkR.block
      const okCategory = meta?.category || assetRef.category
      const reason =
        (matchedReason(resolved.matchedBy, item) + (resolved.mismatch ? `；${resolved.mismatch}` : '') + (blkR.note || '')).trim()
      finishOk(entry, {
        // 版本记真实值（未知记 0），"按 ID 相同就当同一版"在这里不成立
        assetId: item.id,
        version: usableVersionOf(meta?.version ?? item.version),
        source: 'asset',
        reason,
        block: blk,
        ref: `[[asset:${okCategory}|${item.id}|${assetRef.desc}]]`,
      })
      bind({ slot: slotKey, slotId: entry.slotId, id: item.id, source: 'asset', reason })
      // P0：声明分类与实际分类不符（但用途兼容）→ 单独计数，给可解释警告，不进可修复清单
      if (resolved.mismatch) inf.mismatched++
      inf.used[item.id] = { id: item.id, title: item.title || item.name }
      say({ phase: 'asset', text: `复用库素材「${item.title || item.name}」` })
      trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'reuse', assetId: item.id, category: okCategory, desc: clip(entry.desc, 60), note: reason })
      plans.push({ t: 'emit', block: blk, ref: entry.ref || slotKey })
      continue
    }

    // ---- 传统图位占位 [[img:…]] / [[deco:…]] ----
    const imgM = line.match(/^\[\[img:(wide|inline)\|([^\]]+)\]\]$/)
    const decoM = line.match(/^\[\[deco:([A-Za-z0-9_-]+)\|([^\]]+)\]\]$/)
    if (imgM || decoM) {
      const kind: 'wide' | 'inline' | 'deco' = imgM ? (imgM[1] as 'wide' | 'inline') : 'deco'
      const placeholderAlias = imgM ? '' : decoM![1]
      const { desc, policy } = splitPolicy(imgM ? imgM[2] : decoM![2])
      const slotKey = line.trim()
      const shortDesc = desc.length > 14 ? desc.slice(0, 14) + '…' : desc
      const entry = ensureSlot(ledger, { kind, slot: slotKey, desc, policy, theme: themeWord })
      applyRetry(entry)
      const hit0 = reuseFromLedger(entry)
      if (hit0) {
        plans.push(hit0)
        continue
      }

      // ---- assetPolicy='preserve'：拦截"身份退化"（DS 修复指南 §5.4 / F4） ----
      // 本回合模型已声明"只改文字、素材不动"，却又把历史 `[[asset:…]]` 退回成
      // `[[img:…|new]]`/`[[deco:…|new]]`。照常往下走会**重新画一张**（白等几十秒、白花钱，
      // 而且成品换成了另一张图）。这里按文档绑定确定性恢复同一 assetId / **快照**，0 次绘图。
      //
      // 指南 §5.4 的闭锁：preserve 下**没有**"匹配不上就正常检索/新绘"这条路——
      // 无命中、歧义、快照缺失一律明确阻断（见下面三个分支），否则"保持不动"就只是一句口号。
      if (opts?.assetPolicy === 'preserve') {
        const lookup = priorBindingFor(opts?.priorBindings, kind, desc, slotKey, splitPolicy)
        const blockPreserve = (why: string, assetId: string) => {
          finishFail(entry, why)
          bind({ slot: slotKey, slotId: entry.slotId, id: '', source: 'failed', reason: why })
          inf.residue++
          inf.errors.push(`素材位未完成：${shortDesc}（${why}）`)
          say({ phase: 'asset', text: `素材未完成：${shortDesc}` })
          trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'fail', assetId, desc: clip(desc, 60), note: why })
          plans.push({ t: 'drop', ref: entry.slot })
          preserveViolations.push(why)
        }
        if (lookup.status === 'ambiguous') {
          blockPreserve(`本回合声明素材保持不动，但无法确定该素材位对应哪一张：${lookup.reason}`, '')
          continue
        }
        if (lookup.status === 'none') {
          blockPreserve(
            `本回合声明素材保持不动，但正文里的这个素材位在本文档里没有对应绑定（新素材位 / 新占位）。` +
              `要保持素材不动就照抄已固化引用；要换图请改 assetPolicy 为 modify`,
            '',
          )
          continue
        }
        const meta = byId.get(lookup.id)
        const snap = snapshotOf(opts, lookup.id)
        if (!snap.ok) {
          blockPreserve(`本回合声明素材保持不动，但该素材位绑定的素材不可用：${snap.error}`, lookup.id)
          continue
        }
        const built = snapshotBlock(snap.svg, meta, lookup.id, kind, desc, [
          aliasAt.get(idx),
          placeholderAlias,
        ])
        const reason =
          `本回合声明素材不动，按文档固化快照恢复同一素材（${lookup.id} v${snap.ver}，内容哈希 ${snap.hash}），没有重新绘制` +
          libVersionNote(lookup.id, snap.ver, meta)
        entry.ref = `[[asset:${built.category}|${lookup.id}|${desc}]]`
        finishOk(entry, { assetId: lookup.id, version: snap.ver, source: 'recover', reason, block: built.block, ref: entry.ref })
        bind({ slot: slotKey, slotId: entry.slotId, id: lookup.id, source: 'recover', reason })
        inf.used[lookup.id] = { id: lookup.id, title: meta?.title || meta?.name || lookup.id }
        say({ phase: 'asset', text: `按文档固化快照复用素材「${meta?.title || meta?.name || lookup.id}」（未重画）` })
        trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'recover', assetId: lookup.id, category: built.category, desc: clip(desc, 60), note: reason })
        plans.push({ t: 'emit', block: built.block, ref: entry.ref })
        continue
      }

      // 库检索（同描述+策略只搜一次）
      const descKey = `${kind}:${policy}:${desc}`
      let cached = searchCache.get(descKey)
      if (cached === undefined) {
        if (policy === 'new') {
          cached = { hit: null, reason: '正文要求重新绘制（|new），跳过库检索直接新建', near: [] }
        } else {
          say({ phase: 'asset', text: `检索素材库：${shortDesc}` })
          const res = await searchAssets(desc, { categories: candidatesFor(kind), style: themeWord })
          const picked = pickReuse(desc, res)
          if (!picked.hit && picked.near.length) {
            say({ phase: 'asset', text: `视觉复核候选素材（${picked.near.length} 张）：${shortDesc}` })
            const vd = await reviewCandidates(kind, desc, picked.near)
            const chosen = candidateAt(picked.near, vd)
            if (chosen) {
              cached = { hit: chosen, reason: `视觉复核选中库素材「${chosen.title || chosen.name}」：${vd?.reason || ''}`, near: [] }
            } else if (vd?.reason) {
              cached = { hit: null, reason: `新建：${vd.reason}`, near: [] }
            } else {
              cached = picked
            }
          } else {
            cached = picked
          }
        }
        searchCache.set(descKey, cached)
      }
      const libHit = cached.hit
      if (libHit) {
        // 文档里存着这件素材的固化快照时，复用前比较 ID + 版本 + 内容哈希（指南 §5.4 末段）
        const blkR = await svgBlock(libHit, desc, [aliasAt.get(idx), placeholderAlias], opts?.snapshots?.[libHit.id])
        if (blkR.ok) {
          const blk = blkR.block
          const reason = (cached.reason + (blkR.note || '')).trim()
          entry.ref = `[[asset:${libHit.category}|${libHit.id}|${desc}]]`
          finishOk(entry, { assetId: libHit.id, version: usableVersionOf(libHit.version), source: 'reuse', reason, block: blk, ref: entry.ref })
          bind({ slot: slotKey, slotId: entry.slotId, id: libHit.id, source: 'reuse', reason })
          inf.used[libHit.id] = { id: libHit.id, title: libHit.title || libHit.name }
          say({ phase: 'asset', text: `复用库素材「${libHit.title || libHit.name}」` })
          trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'reuse', assetId: libHit.id, category: libHit.category, desc: clip(desc, 60), note: reason })
          plans.push({ t: 'emit', block: blk, ref: entry.ref })
          continue
        }
        // 检索**命中了**但这份素材读不出来（或读出来却不达标，计划 §6 第二条）：不能顺势掉进
        // "重新画一张"——那会一边误报"库里没有"、一边白等几十秒重画一张库里本来就有的图。
        // 如实记为未完成，让用户看到真实原因（可在清单上单项重试，或换一张素材）。
        const why = blkR.error
        finishFail(entry, why)
        bind({ slot: slotKey, slotId: entry.slotId, id: '', source: 'failed', reason: why })
        inf.residue++
        inf.errors.push(`素材位未完成：${shortDesc}（${why}）`)
        say({ phase: 'asset', text: `库素材不可用：${shortDesc}` })
        trace({ kind: 'slot', runId: ledger.runId, slotId: entry.slotId, phase: 'asset', decision: 'fail', assetId: libHit.id, desc: clip(desc, 60), note: why })
        plans.push({ t: 'draw', slotId: entry.slotId })
        continue
      }

      // 库无强命中 → 登记绘图任务（阶段 B 有界并发执行；同指纹只登记一次）
      plans.push({ t: 'draw', slotId: entry.slotId })
      if (!drawTasks.has(entry.slotId)) {
        drawTasks.set(entry.slotId, {
          entry,
          kind,
          desc,
          cachedReason: cached.reason,
          placeholderAlias,
          pairedRef: aliasAt.get(idx),
          shortDesc,
        })
      }
      continue
    }

    // ---- F5（2026-09-28 只读审计）：未识别的素材协议行，一律不得原样漏进正文 ----
    // 表现：`[[deco:花簇角饰|说明]]`（中文名）、`[[img:full|说明]]`（kind 拼错）这类整行协议
    // 走不到上面任何分支，于是被当作普通文本 push 进产出 → 最终**以字面量出现在预览与成品
    // HTML 里**；既不进台账、也不计 residue，App 的"已从正文中移除 N 处未解析的素材协议行"
    // 不会出现（residue 为 0），界面显示一切正常。"成品零协议残留"因此不成立。
    // 这里在兜底直通**之前**拦一层：整行形如 `[[xxx:…]]` 且没人认领 → 按未知素材协议处理
    // （计 residue、给面向用户的错误、**产出与规范化源文都不收该行**）。
    // 只在"整行就是一个 [[xxx:…]]"时才判，不误伤正文里含方括号的普通句子。
    // 白名单：`[[theme:…]]` `[[palette:…]]` `[[banner:…]]` `[[title:…]]` `[[badge:…]]`（以及无冒号的
    // `[[lace]]`）是 v2 语法里**由 compose 处理**的行级声明，不是素材协议，绝不能被当成残留剔掉。
    if (/^\s*\[\[\w+:[^\]]*\]\]\s*$/.test(line) && !/^\s*\[\[(?:theme|palette|banner|title|badge)\b/.test(line)) {
      inf.residue++
      const why = `素材协议写法无法识别：${clip(line.trim(), 60)}`
      inf.errors.push(
        `${why}——这行协议没被识别，已从成品中移除。可用的写法：[[asset:分类|素材ID|用途说明]]、[[img:wide 或 inline|说明]]、[[deco:名称|说明]]`,
      )
      say({ phase: 'asset', text: `忽略无法识别的素材协议行：${clip(line.trim(), 14)}` })
      trace({ kind: 'slot', runId: ledger.runId, phase: 'asset', decision: 'refuse', desc: clip(line.trim(), 60), note: '未识别的素材协议行，已从成品移除' })
      // 不 push 任何 plan：不可识别的协议既不属于正文，也不该进规范化源文（错误清单里已带原文）
      continue
    }

    plans.push({ t: 'text', text: line })
  }

  // ================= 阶段 B：有界并发绘制（阶段 4 第 1 条） =================
  // 同时最多 drawConcurrency() 个素材位在画（初始值 2）；相同指纹的素材位共用同一条台账记录，
  // 因此只会画一次。结果与顺序无关——组装在阶段 C 按原始行序进行。
  //
  // 指南 §5.4 的"预检整组素材再进入执行"落在这里：本回合只要有一个 `preserve` 违规，
  // 候选已经注定过不了门禁，**整组**不再绘制（不是"画完前几位才发现最后一位不合规"）。
  if (preserveViolations.length > 0 && drawTasks.size > 0) {
    const why = `本回合声明素材保持不动，但整组素材预检发现 ${preserveViolations.length} 处违规，已停止全部绘制：${preserveViolations[0]}`
    for (const task of drawTasks.values()) {
      finishFail(task.entry, why)
      inf.errors.push(`素材位未执行绘制：${clip(task.entry.desc || task.entry.slot, 40)}（${why}）`)
    }
    trace({ kind: 'run', runId: ledger.runId, stage: 'validation', ok: false, stopReason: 'unrepairable', note: why })
    drawTasks.clear()
  }
  if (drawTasks.size > 0) {
    const tasks = [...drawTasks.values()]
    const budget = slotBudgetMs()
    let drawStart = 0
    await mapBounded(tasks, drawConcurrency(), async (task) => {
      const e = task.entry
      if (isCancelled()) {
        finishFail(e, '用户已停止，本素材位未执行')
        return
      }
      drawStart++
      say({ phase: 'asset', text: `绘制素材（第 ${drawStart}/${totalSlots} 张）：${task.shortDesc}` })
      // 本素材位的累计预算终点（含排队之后的执行、重试与补描述）
      const deadline = Date.now() + budget
      let draw: DrawResult
      try {
        draw = await raceTimeout(
          drawSlot(e, task.kind, task.desc, themeWord, say, ledger.runId, e.slotId, deadline),
          budget,
        )
      } catch (err) {
        draw = { svg: null, failure: classifyError(err), detail: clip(String(err instanceof Error ? err.message : err), 120) }
      }
      if (!draw.svg) {
        finishFail(e, draw.detail || '素材生成失败')
        bind({ slot: e.slot, slotId: e.slotId, id: '', source: 'failed', reason: draw.detail || '素材生成失败' })
        inf.residue++
        inf.errors.push(`素材位未完成：${task.shortDesc}（${draw.detail || '素材生成失败'}）`)
        trace({ kind: 'slot', runId: ledger.runId, slotId: e.slotId, phase: 'asset', decision: 'fail', desc: clip(task.desc, 60), note: draw.detail, failure: draw.failure })
        return
      }
      // 入库（D7：现场补做自动存回素材库，此后可直接复用）。
      // 取消后不再入库：已取消的结果不该在素材库里留下痕迹。
      const newName = uniqueName(task.placeholderAlias || `${task.kind}-${Date.now().toString(36)}`)
      let newId = ''
      let newCategory = categoryFor(task.kind)
      let newVersion = 0
      if (persist && !isCancelled()) {
        const meta = await addAsset({
          category: categoryFor(task.kind),
          name: newName,
          title: task.desc.slice(0, 16),
          desc: task.desc,
          usage: task.kind === 'deco' ? 'deco' : task.kind,
          origin: 'article-fallback',
          svg: draw.svg,
        })
        if (meta) {
          newId = meta.id
          newCategory = meta.category
          newVersion = meta.version
          inf.storedFallback++
          inf.used[meta.id] = { id: meta.id, title: meta.title || meta.name }
        }
      }
      const blk =
        task.kind === 'deco'
          ? decoBlock(draw.svg, newName, newId, [task.pairedRef, task.placeholderAlias, newName, newId])
          : `::: art ${task.kind} ${task.desc}\n${draw.svg}\n:::`
      e.ref = newId ? `[[asset:${newCategory}|${newId}|${task.desc}]]` : e.slot
      const reason = `${task.cachedReason}；已委托素材智能体新绘制${newId ? '并入库' : ''}`
      finishOk(e, { assetId: newId, version: newVersion, source: 'new', reason, block: blk, ref: e.ref })
      bind({ slot: e.slot, slotId: e.slotId, id: newId, source: 'new', reason })
      say({ phase: 'asset', text: newId ? `素材已入库：${task.shortDesc}` : `素材已绘制：${task.shortDesc}` })
      trace({ kind: 'slot', runId: ledger.runId, slotId: e.slotId, phase: 'asset', decision: 'new', assetId: newId, category: newCategory, desc: clip(task.desc, 60), note: reason })
    })
  }

  // ================= 阶段 C：按原始行序组装 =================
  // 注意 `emit` 的语义：它只表示"这一轮把成品块**写进了**产物"，**不表示已交付**
  // （计划 §6 第三条）。素材还要在最终排版上过质检并真的落位——排版层若拒收
  // （`composeMarkdown().rejectedArts`），必须由 `applyRejectedArts` 把台账这一条从 ok 降级为
  // failed；这正是"已被照片位吞掉、未实际落位的素材不能被算作交付成功"的成立条件：
  // 台账只认门禁与回写，不认"我们打算把它放进去"。
  const out: string[] = []
  const normalized: string[] = []
  for (const plan of plans) {
    if (plan.t === 'text') {
      out.push(plan.text)
      normalized.push(plan.text)
      continue
    }
    if (plan.t === 'emit') {
      out.push(plan.block)
      normalized.push(plan.ref)
      continue
    }
    if (plan.t === 'drop') {
      // 成品不残留素材协议：无法解析/未完成的行从正文剔除，改由诊断信息承载
      normalized.push(plan.ref)
      continue
    }
    // draw：绘制结果由台账承载（成功→成品块；失败→剔除）
    const e = ledger.slots[plan.slotId]
    if (e && e.status === 'ok' && e.block) {
      out.push(e.block)
      normalized.push(e.ref || e.slot)
    } else if (e) {
      normalized.push(e.slot)
    }
  }

  inf.normalized = normalized.join('\n')
  return out.join('\n')
}

function matchedReason(matchedBy: 'id' | 'name', item: LibItem): string {
  return matchedBy === 'id' ? `按素材 ID 精确命中「${item.title || item.name}」` : `按库中唯一名称「${item.name}」命中`
}


// ---------- 素材智能体现场绘制（桌面 gen_svg + CLARIFY 有界回问；浏览器样例池） ----------

const CLARIFY_PREFIX = 'CLARIFY:'

/**
 * 子智能体产出的质量门禁：Tier 1 结构性门槛（viewBox / 可见元素 / 占画布比 / 显示尺寸可辨）
 * + Tier 2 栅格门槛（按**真实显示尺寸**渲染后是否真的有像素、角饰是否在右下、是否浅色消失、
 * 照片框是否留中窗）。两级都是"退化拦截"，不检测视觉美感——那部分交给提示词契约与视觉复核。
 */
export async function acceptSvg(svg: string, kind: string): Promise<{ ok: boolean; reasons: string[] }> {
  const q = checkSvgQuality(svg, kind)
  if (!q.ok) return { ok: false, reasons: q.failures }
  // 阶段 5：按该素材位在文章里的真实宽度栅格化（角饰只有 60px），并在推文正文底色（白）上比较对比度
  const st = await rasterStats(svg, { targetWidth: SLOT_PX[kind]?.w, background: '#ffffff' })
  if (st) {
    const rs = checkRaster(st, kind)
    if (rs.length) return { ok: false, reasons: rs }
  }
  return { ok: true, reasons: [] }
}

/** 一次绘图尝试的结果（阶段 1：失败必须可分门别类，不能只有一句"失败"） */
export interface DrawResult {
  svg: string | null
  failure: FailureClass
  /** 面向人的简短原因（不含密钥/请求正文） */
  detail: string
}

/** 单次 gen_svg 调用的结果：拿到 SVG / 拿到追问 / 失败三类 */
interface GenOnce {
  svg: string | null
  clarify: string | null
  failure: FailureClass
  detail: string
  /** 只看质检拒收：本地质检给出的**完整**理由清单（`detail` 里只留前 2 条，这里不截断） */
  reasons?: string[]
}

/**
 * 质检拒收后，下一次重画要带回给模型的**修正提示**（纯函数，可测）。
 *
 * 为什么需要它：重画此前是**原样重发同一个 brief**，模型拿不到"上一版哪里不合规"，
 * 只能重掷一次同样的骰子——实测出现过越画越差（G2A：30 / 15 个可见元素落在画布外，
 * 重画后变成 44 / 15）。已有 `refine_brief` 通道证明"把失败事实交回模型"这条路是通的
 * （模型 CLARIFY 追问 → 主模型补 brief 再画），质检拒收只是缺了同一条信息通道。
 *
 * 只做**事实转述**：告诉模型"上一版哪里不合规"，不告诉它"该怎么画"——
 * 画法是模型的事，本地质检只掌握几何事实，越界去猜画法只会把提示词变成另一套规则。
 *
 * @param reasons 本地质检给出的理由（如"有 44 个可见元素完全落在画布外"）
 * @returns 非空提示；没有可用理由时返回 null（此时不附加，保持原样重发）
 */
export function qualityRetryHint(reasons: string[] | undefined): string | null {
  const list = (reasons || []).map((r) => String(r).trim()).filter(Boolean)
  if (!list.length) return null
  // 上限 3 条：理由再多也只转述最靠前的几条，避免提示本身变成一串要求把画面描述淹没
  return list.slice(0, 3).join('；')
}

/**
 * 一次绘图请求（**一次** gen_svg 调用，不含重试）。
 * 预算与重试由调用方（drawSlot）按台账决定——这样"重画一次"才有次数上限，
 * 而不是每次失败都在函数内部再整轮试一遍。
 */
async function genOnce(
  runId: string,
  slotId: string,
  attempt: number,
  kind: 'wide' | 'inline' | 'deco',
  desc: string,
  theme: string,
  hint?: string | null,
): Promise<GenOnce> {
  const t0 = Date.now()
  try {
    const svg = await invoke<string>('gen_svg', {
      kind,
      desc,
      theme: theme || null,
      hint: hint || null,
      runId,
      slotId,
      attempt,
    })
    if (svg.startsWith(CLARIFY_PREFIX)) {
      return { svg: null, clarify: svg.slice(CLARIFY_PREFIX.length).trim(), failure: 'unknown', detail: '素材智能体回问' }
    }
    const verdict = await acceptSvg(svg, kind)
    if (!verdict.ok) {
      console.warn('gen_svg 素材未达标：', verdict.reasons.join('；'))
      // 阶段 1：拿到 SVG 却被本地质检拒收是**独立的一类结果**，必须与"服务没返回"区分开
      trace({
        kind: 'quality',
        runId,
        slotId,
        phase: 'asset',
        ok: false,
        failure: 'quality',
        ms: Date.now() - t0,
        qualityReasons: verdict.reasons.map((r) => clip(r, 80)),
        note: clip(desc, 80),
      })
      return {
        svg: null,
        clarify: null,
        failure: 'quality',
        detail: `素材未达标：${verdict.reasons.slice(0, 2).join('；')}`,
        reasons: verdict.reasons,
      }
    }
    return { svg, clarify: null, failure: 'unknown', detail: '' }
  } catch (e) {
    console.warn('gen_svg 失败：', e)
    const failure = classifyGenError(e, null)
    return { svg: null, clarify: null, failure, detail: `绘图失败（${failure}）：${clip(String(e), 120)}` }
  }
}

/**
 * 一个素材位的完整绘制过程：在**台账预算内**最多画 MAX_DRAW_ATTEMPTS 次、补描述 MAX_CLARIFY 次。
 * - 第一次回问 → 补描述后画第二次；
 * - 第一次被质检拒收或失败 → 直接画第二次；
 * - 预算用尽即结束，结论写进台账（跨自动修订沿用，不再重获预算）。
 *
 * `deadline`（墙钟毫秒，阶段 4）：本素材位的累计预算终点。服务端给了 `Retry-After` 时，
 * **只在剩余预算容得下这次等待**才重试——否则宁可如实记为未完成，也不把整篇拖超预算。
 */
async function drawSlot(
  entry: LedgerEntry,
  kind: 'wide' | 'inline' | 'deco',
  desc: string,
  theme: string,
  say: ProgressFn,
  runId: string,
  slotId: string,
  deadline: number,
): Promise<DrawResult> {
  if (!inTauri()) {
    // 浏览器演示链路：样例池取样，仍走**同一套**质检（Tier 1 + 阶段 5 的真实尺寸栅格）与预算
    let last: DrawResult = { svg: null, failure: 'unknown', detail: '未执行绘图' }
    while (canDraw(entry)) {
      noteDraw(entry)
      await new Promise((r) => setTimeout(r, 40))
      const s = mockArtSvg(kind)
      const verdict = await acceptSvg(s, kind)
      if (verdict.ok) return { svg: s, failure: 'unknown', detail: '' }
      last = { svg: null, failure: 'quality', detail: `素材未达标：${verdict.reasons.slice(0, 2).join('；')}` }
    }
    return last
  }

  let brief = desc
  // 被质检拒收后带回去的修正提示（见 qualityRetryHint 的说明）。首画为空；
  // 只在**上一次是质检拒收**时才有值——网络类失败重发同一 brief 才是对的。
  // 名字不叫 `hint`：循环里已有一个 `const hint`（限流等待毫秒），同名会被它遮蔽。
  let qualityHint: string | null = null
  let last: DrawResult = { svg: null, failure: 'unknown', detail: '未执行绘图' }
  let firstAttempt = entry.attempts === 0

  while (canDraw(entry)) {
    // 服务端限流提示（Retry-After）：剩余预算容得下才等，否则不再重试
    const hint = retryHintMs(last.detail)
    if (hint && !firstAttempt) {
      const remain = deadline - Date.now()
      if (hint + 1000 > remain) {
        last = { ...last, detail: `${last.detail}；服务端要求等待 ${Math.round(hint / 1000)} 秒，超出本素材位剩余预算，不再重试` }
        break
      }
      say({ phase: 'asset', text: `服务端限流，等待 ${Math.round(hint / 1000)} 秒后重试…` })
      trace({ kind: 'note', runId, slotId, phase: 'asset', ok: false, failure: 'network', note: `限流等待 ${Math.round(hint / 1000)} 秒` })
      await new Promise((r) => setTimeout(r, hint))
    }
    noteDraw(entry)
    if (!firstAttempt) {
      say({
        phase: 'asset',
        text: qualityHint
          ? `上一版未通过质检（${clip(qualityHint, 40)}），带着这条修正重画一次…`
          : '首版素材未达标，正在重画一次…',
      })
    }
    firstAttempt = false
    const r = await genOnce(runId, slotId, entry.attempts, kind, brief, theme, qualityHint)
    if (r.svg) return { svg: r.svg, failure: 'unknown', detail: '' }
    if (r.clarify) {
      last = { svg: null, failure: 'empty', detail: `素材智能体回问：${clip(r.clarify, 60)}` }
      if (!canClarify(entry) || !canDraw(entry)) break
      noteClarify(entry)
      say({ phase: 'asset', text: '素材智能体回问，正在重新描述画面需求…' })
      try {
        const refined = await invoke<string>('refine_brief', {
          desc: brief,
          question: r.clarify,
          theme: theme || null,
          runId,
          slotId,
        })
        if (refined && refined.trim()) {
          brief = refined.trim()
          // brief 已被重写：上一条质检理由针对的是**旧的画面描述**，继续带着它会指错方向
          qualityHint = null
        } else break
      } catch (e) {
        last = { svg: null, failure: classifyGenError(e, null), detail: `补描述失败：${clip(String(e), 100)}` }
        break
      }
      continue
    }
    last = { svg: null, failure: r.failure, detail: r.detail }
    // 被质检拒收：把**已确证的失败事实**交回模型，让下一次重画是"带着修正"的，
    // 而不是重掷同一个骰子（实测重发同一 brief 会越画越差）。其它失败类不附加提示。
    qualityHint = r.failure === 'quality' ? qualityRetryHint(r.reasons) : null
    // 取消是用户意图、鉴权/参数错重试无用：都不再消耗预算（其余失败在预算内再试一次）
    if (!retryable(r.failure)) break
  }
  return last
}
