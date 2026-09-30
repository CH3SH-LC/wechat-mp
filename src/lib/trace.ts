// trace.ts —— 创作回合的请求证据（纯逻辑层；修复计划阶段 1，2026-09-28）
//
// 背景：真实运行调查（2026-09-28）发现，一次失败后**分不清**是网络错误、接口空返回、
// 内容里没有 SVG，还是被本地质检拒绝——工作区只有"素材生成失败"五个字。本模块定义这套
// 可区分的证据词汇，并把记录交给一个可替换的 sink（桌面端写 JSONL，浏览器端留在内存）。
//
// 为什么单独一个文件：本模块**零 import**，因此可以被 node 离线断言脚本直接加载
// （与 progress.ts / asset-resolve.ts 同一手法）。写盘、时钟等 IO 由调用方经 `setTraceSink`
// 注入，本模块只做纯函数与内存缓冲。

/**
 * 失败分类。**必须与 `src-tauri/src/trace.rs` 的 `FAILURE_CLASSES` 逐字一致**——
 * `scripts/trace-check.mjs` 会交叉比对两侧，改一侧漏一侧会直接断言失败。
 *
 * - network：网络层没拿到响应（连接失败、超时、5xx）
 * - empty  ：拿到了响应，但正文字段为空（典型：推理吃光预算导致 content 为空）
 * - no-svg ：正文非空，但里面没有 `<svg>`（提示词/能力问题，不是服务问题）
 * - quality：拿到了 SVG，被本地确定性质检或栅格质检拒收
 * - cancel ：用户主动停止
 * - auth   ：鉴权失败或参数无效——**重试不会改变结果**，因此不重试（阶段 4 第 3 条）
 * - unknown：以上都不是（不猜测，如实标注）
 */
export type FailureClass = 'network' | 'empty' | 'no-svg' | 'quality' | 'cancel' | 'auth' | 'unknown'

export const FAILURE_CLASSES: FailureClass[] = ['network', 'empty', 'no-svg', 'quality', 'cancel', 'auth', 'unknown']

/** 记录类型：什么被记下来了 */
export type TraceKind =
  | 'run' // 回合开始/结束
  | 'request' // 一次模型请求（Rust 侧写）
  | 'slot' // 一个素材位的决策结果（复用/新建/拒绝/失败）
  | 'quality' // 本地质检拒收
  | 'note' // 其它事件（取消等）

/**
 * 交付流程的**阶段**（计划 §8：日志拆分 `validation / repair / rollback / persist / commit`）。
 *
 * 为什么要拆开：真实故障里 `checkHtml` 不通过，日志却以「成稿已保存 / ok:true」收尾——
 * 因为"渲染完成""写到磁盘""验收通过"三件事挤在同一句里，读日志的人无法分辨哪一步真的成了。
 * 拆开之后每条记录只回答一个问题：
 *   - validation：这一轮候选的检查结果（阻断项几条、问题代码是什么）
 *   - repair    ：一次修复尝试（确定性修复 / 素材恢复 / 模型修订）
 *   - rollback  ：候选被撤销、退回上一份已验收成品
 *   - persist   ：候选落盘为**草稿**（持久化成功 ≠ 交付成功）
 *   - commit    ：提交为**成品**（最后一个版本指针切换）
 */
export type TraceStage = 'validation' | 'repair' | 'rollback' | 'persist' | 'commit'

export const TRACE_STAGES: TraceStage[] = ['validation', 'repair', 'rollback', 'persist', 'commit']

export interface TraceUsage {
  prompt?: number | null
  completion?: number | null
  total?: number | null
}

export interface TraceRecord {
  kind: TraceKind
  runId?: string
  slotId?: string
  phase?: string
  model?: string
  /** 同一素材位内的第几次尝试（1 起） */
  attempt?: number
  /** 起始墙钟毫秒（仅用于排序；耗时看 ms） */
  startedAt?: number
  /** 单调时钟耗时（毫秒） */
  ms?: number
  ok?: boolean
  failure?: FailureClass
  /** 已分类的简短原因；不得包含密钥或完整请求正文 */
  error?: string
  /** 模型返回正文的字符数（不记录正文本身） */
  responseLength?: number
  finishReason?: string | null
  usage?: TraceUsage | null
  /** 素材位决策结果 */
  decision?: 'reuse' | 'new' | 'refuse' | 'fail' | 'recover'
  assetId?: string
  category?: string
  /** 用途说明（截断后）；用于人工核对"这个位想要什么" */
  desc?: string
  /** 质检拒绝原因（逐条截断） */
  qualityReasons?: string[]
  /** 其它可读说明 */
  note?: string

  // ---- 交付流程字段（计划 §8；全部可选，旧记录不受影响） ----
  /** 本记录属于交付流程的哪一步 */
  stage?: TraceStage
  /** 本轮候选的版本 id（未提交的候选也有 id，便于把 validation/repair/rollback 串起来） */
  revisionId?: string
  /** 本候选基于哪一份已提交版本（回滚与"旧请求不得覆盖新提交"都靠它） */
  baseRevisionId?: string
  /** 提交指针世代号 */
  generation?: number
  /** 候选的问题代码（稳定 code，不是中文文案） */
  issueCodes?: string[]
  /** 阻断项 / 提示项条数（同一轮候选的真实计数） */
  blockingCount?: number
  warningCount?: number
  /** 修复前后的结果对照（各一句摘要，不记全文） */
  before?: string
  after?: string
  /** 停止原因：为什么没有继续修（预算用尽 / 无进展 / 不可修复 / 用户停止 / 退化撤销） */
  stopReason?: 'budget' | 'no-progress' | 'unrepairable' | 'cancelled' | 'regressed' | 'none'
  /**
   * 本轮**正文保留比较**的适用性（DS 修复指南 §4.2/§5.5）：
   * `applied` 已比（结果看 before/after）、`not-applicable` 本回合首个候选没有可比对象、
   * `failed` 该比却比不了（已按阻断处理）。**不记这一项就分不清"没查"和"查了没问题"**，
   * 上一轮"两轮都传 body=null 却照样通过"正是因为这个区别在日志里根本看不见。
   */
  bodyApplicability?: 'applied' | 'not-applicable' | 'failed'
}

// ---------- 纯函数 ----------

/** 记录里的自由文本一律截断：日志要能读，也不能被一次超长响应撑爆 */
export function clip(s: unknown, max = 160): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

/**
 * 把抛出的异常归到一个稳定的失败分类（与 Rust 侧 `classify_error` 同一口径）。
 * 只看错误文案本身，不推测。
 */
export function classifyError(err: unknown): FailureClass {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const e = raw.toLowerCase()
  if (e.includes('cancel') || e.includes('abort') || raw.includes('取消')) return 'cancel'
  if (e.includes('未返回内容') || e.includes('content 为空') || e.includes('empty')) return 'empty'
  if (e.includes('未返回 svg') || e.includes('未返回图像')) return 'no-svg'
  // 有状态码时按状态码判（与 Rust 侧 `classify_error` 同一口径）：
  //   限流与暂时性服务端错误（429/5xx）→ network，可在剩余预算内重试一次；
  //   鉴权与参数错误（4xx 其余）→ auth，**不重试**（阶段 4 第 3 条）。
  const code = httpStatusOf(raw)
  if (code !== null) {
    if (code === 429 || (code >= 500 && code < 600)) return 'network'
    if (code >= 400 && code < 500) return 'auth'
  }
  if (
    e.includes('timeout') ||
    e.includes('timed out') ||
    e.includes('connection') ||
    raw.includes('超时') ||
    e.includes('请求 deepseek 失败') ||
    e.includes('响应流中断') ||
    e.includes('读取响应失败')
  ) {
    return 'network'
  }
  return 'unknown'
}

/** 从错误串里取出 `API 错误 <status>` 的状态码（与 Rust 侧 `http_status_of` 同口径） */
export function httpStatusOf(err: unknown): number | null {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const m = /API 错误\s+(\d{3})/.exec(raw)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/**
 * 绘图失败的分类入口：把"拿到了什么"与"报了什么错"合起来判断。
 * 关键区分：**正文为空**是 empty，**正文非空但没有 SVG** 才是 no-svg——
 * 两者的处置完全不同（前者重试有意义，后者要改提示词或换模型）。
 *
 * 桌面链路上 gen_svg 是 Rust 命令，失败以**异常文案**回来（正文本身不回传），
 * 因此这里除了显式的 responseText，还会从"响应片段：…"里把正文片段读回来。
 */
export function classifyGenError(err: unknown, responseText?: string | null): FailureClass {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (/未返回内容|内容为空/.test(raw)) return 'empty'
  if (/未返回\s*SVG/i.test(raw)) {
    const snippet = responseText ?? (/响应片段：([\s\S]*?)）/.exec(raw)?.[1] ?? '')
    // 片段以省略号收尾只是截断标记，去掉后再判断有没有实际内容
    const body = String(snippet).replace(/…\s*$/, '').trim()
    return body ? 'no-svg' : 'empty'
  }
  return classifyError(raw)
}

/**
 * 服务端限流等待提示（秒 → 毫秒）。来自 Rust 侧转发的 `RETRY_HINT:` 前缀
 * （HTTP 的 `Retry-After` 只在响应头里，前端拿到的是错误串）。
 * 没有提示返回 null——**不猜**一个等待时间出来。
 */
export function retryHintMs(err: unknown): number | null {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const m = /RETRY_HINT:(\d+)/.exec(raw)
  if (!m) return null
  const secs = Number(m[1])
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : null
}

/**
 * 这个失败还值不值得在剩余预算内再试一次。
 * - cancel：用户已经按了停止，再重试是违背用户意图 → 不重试。
 * - auth  ：鉴权失败/参数无效，重试不会改变结果，只会白等一轮 → 不重试（阶段 4 第 3 条）。
 * - 其余（网络瞬态 / 空返回 / 没有 SVG / 质检拒收）都值得在预算内重试一次。
 */
export function retryable(failure: FailureClass): boolean {
  return failure !== 'cancel' && failure !== 'auth'
}

/** 记录形状校验（脚本用它确认"写下去的东西是完整的"，避免日志里出现半条记录） */
export function isTraceRecord(v: unknown): v is TraceRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  if (typeof r.kind !== 'string') return false
  if (r.failure !== undefined && !FAILURE_CLASSES.includes(r.failure as FailureClass)) return false
  if (r.decision !== undefined && !['reuse', 'new', 'refuse', 'fail', 'recover'].includes(r.decision as string)) return false
  if (r.ms !== undefined && (typeof r.ms !== 'number' || !Number.isFinite(r.ms) || r.ms < 0)) return false
  if (r.attempt !== undefined && (typeof r.attempt !== 'number' || r.attempt < 1)) return false
  // §8：交付阶段字段同样要校验——写下去的东西必须能被脚本读回来（半条记录不如不写）
  if (r.stage !== undefined && !TRACE_STAGES.includes(r.stage as TraceStage)) return false
  if (r.stopReason !== undefined && !['budget', 'no-progress', 'unrepairable', 'cancelled', 'regressed', 'none'].includes(r.stopReason as string)) return false
  if (r.issueCodes !== undefined && (!Array.isArray(r.issueCodes) || r.issueCodes.some((c) => typeof c !== 'string'))) return false
  if (r.blockingCount !== undefined && (typeof r.blockingCount !== 'number' || r.blockingCount < 0)) return false
  if (r.warningCount !== undefined && (typeof r.warningCount !== 'number' || r.warningCount < 0)) return false
  return true
}

export interface TraceSummary {
  total: number
  /** 按失败分类计数（没有 failure 的记录不计入） */
  failures: Record<FailureClass, number>
  /** 素材位决策结果计数 */
  decisions: Record<string, number>
  /** 出现过的素材位 id（顺序去重）——用于把请求沿 slotId 对到最终绑定 */
  slots: string[]
  /** 有请求记录但没有耗时的条数（"缺失值记为未知"的显式计数） */
  missingMs: number
  /** 交付流程各阶段出现次数（计划 §8） */
  stages: Record<TraceStage, number>
  /**
   * 是否真的**提交为成品**（出现过 stage='commit' 且 ok=true）。
   *
   * 为什么单独给一个字段：计划 §8 要求"保存诊断草稿记为持久化成功，但交付仍失败"——
   * 只看 `persist` 会把"草稿存下来了"误读成"这篇稿子成了"。判定交付必须看 commit。
   */
  committed: boolean
  /** 出现过 `stage='rollback'`：候选被撤销、退回上一份已验收成品 */
  rolledBack: boolean
}

export function emptySummary(): TraceSummary {
  const failures = {} as Record<FailureClass, number>
  for (const f of FAILURE_CLASSES) failures[f] = 0
  const stages = {} as Record<TraceStage, number>
  for (const s of TRACE_STAGES) stages[s] = 0
  return { total: 0, failures, decisions: {}, slots: [], missingMs: 0, stages, committed: false, rolledBack: false }
}

/** 汇总一批记录：断言与排查都读这个，避免各处重复统计口径。 */
export function summarize(records: TraceRecord[]): TraceSummary {
  const s = emptySummary()
  for (const r of records) {
    s.total++
    if (r.failure) s.failures[r.failure] = (s.failures[r.failure] || 0) + 1
    if (r.decision) s.decisions[r.decision] = (s.decisions[r.decision] || 0) + 1
    if (r.slotId && !s.slots.includes(r.slotId)) s.slots.push(r.slotId)
    if (r.kind === 'request' && typeof r.ms !== 'number') s.missingMs++
    if (r.stage) {
      s.stages[r.stage] = (s.stages[r.stage] || 0) + 1
      if (r.stage === 'commit' && r.ok === true) s.committed = true
      if (r.stage === 'rollback') s.rolledBack = true
    }
  }
  return s
}

/** 一个回合内某素材位的全部记录（沿 slotId 追一个素材位的完整经历） */
export function recordsForSlot(records: TraceRecord[], slotId: string): TraceRecord[] {
  return records.filter((r) => r.slotId === slotId)
}

// ---------- 身份 ----------

let seq = 0

/** 回合 id：时间基 + 进程内序号，保证同一进程内不重号，且能一眼看出先后 */
export function newRunId(now = Date.now()): string {
  seq = (seq + 1) % 1000
  return `r${now.toString(36)}-${seq.toString(36)}`
}

/** 素材位 id：一个素材位在**整个回合内**（含多轮自动修订）保持同一个 id */
export function newSlotId(runId: string, index: number): string {
  return `${runId}-s${index + 1}`
}

// ---------- sink 与内存缓冲 ----------

export type TraceSink = (rec: TraceRecord) => void

let sink: TraceSink | null = null

/** 注入写盘实现（桌面端写 JSONL）。传 null 即恢复"只留内存"。 */
export function setTraceSink(fn: TraceSink | null): void {
  sink = fn
}

export const TRACE_BUFFER_LIMIT = 800

const buffer: TraceRecord[] = []

/** 内存缓冲快照（E2E 与离线断言读它；不参与任何流程判断） */
export function traceBuffer(): TraceRecord[] {
  return buffer.slice()
}

export function clearTraceBuffer(): void {
  buffer.length = 0
}

/**
 * 记一条。**永不抛错**——日志是旁路，绝不能因为它失败而打断创作（修复计划阶段 1 的验收项）。
 */
export function trace(rec: TraceRecord): void {
  try {
    if (!isTraceRecord(rec)) return
    buffer.push(rec)
    if (buffer.length > TRACE_BUFFER_LIMIT) buffer.splice(0, buffer.length - TRACE_BUFFER_LIMIT)
    sink?.(rec)
  } catch {
    // 静默：日志失败不阻塞创作
  }
}
