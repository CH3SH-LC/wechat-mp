// trace-check.mjs —— 请求追踪与素材预算断言（修复计划阶段 1 + 阶段 3 的确定性部分）
// 用法：node scripts/trace-check.mjs
//
// 做法：把 Tauri 通道桩进 window（让真实的 image-agent 走"桌面分支"），逐个注入故障，
// 检查"网络错误 / 空内容 / 无 SVG / 质检拒绝 / 取消"五类结果**能被明确区分**，
// 并检查台账（阶段 3）确实让"同一素材位一轮只做一次决定、失败不重获预算"。
// 全部离线：没有任何真实模型调用。
import { resetStub } from './lib/ls-stub.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// ---------- Tauri 通道桩（故障注入点） ----------
const callLog = []
let genBehavior = () => 'ok'
let tauriCalls = 0
/** 绘图请求的模拟耗时：用于观察并发峰值与"在途共享" */
let genDelayMs = 0
/** 当前在途的 gen_svg 数量与本次观测到的峰值（阶段 4 第 1 条的断言依据） */
let inFlight = 0
let maxInFlight = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (typeof globalThis.window === 'undefined') globalThis.window = {}
globalThis.window.__TAURI_INTERNALS__ = {
  invoke: async (cmd, args) => {
    tauriCalls++
    callLog.push(cmd)
    switch (cmd) {
      case 'list_assets':
      // 素材列表的"权威口径"命令（带 unreadable 清单）：桩要给出同样的形状，
      // 否则 listAssetsSafe 会在 null 上取属性——那是桩没跟上产品命令，不是产品的问题。
      case 'list_assets_report':
        return { items: [], unreadable: [] }
      case 'load_settings':
        return { vision_review: false }
      case 'gen_svg': {
        inFlight++
        if (inFlight > maxInFlight) maxInFlight = inFlight
        try {
          const r = genBehavior(args)
          if (genDelayMs > 0) await sleep(genDelayMs)
          return await r
        } finally {
          inFlight--
        }
      }
      case 'refine_brief':
        return '补全后的画面说明：浅蓝浅粉校园书桌与对话气泡，清爽活泼'
      default:
        return null
    }
  },
}

const traceMod = await import('../src/lib/trace.ts')
const {
  emptyMaterializeInfo,
  materializePlaceholders,
  mapBounded,
  raceTimeout,
  slotBudgetMs,
  drawConcurrency,
} = await import('../src/lib/image-agent.ts')
const { createLedger, unfinished } = await import('../src/lib/asset-ledger.ts')

const { clearTraceBuffer, traceBuffer, setTraceSink, summarize, isTraceRecord, classifyError, classifyGenError, retryable, retryHintMs, newRunId, newSlotId, FAILURE_CLASSES, trace, clip } = traceMod

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

// ---------- 词汇表两侧一致 ----------
console.log('[失败分类：前后端词表必须逐字一致]')
{
  const rust = readFileSync(join(here, '..', 'src-tauri', 'src', 'trace.rs'), 'utf8')
  const m = /FAILURE_CLASSES:\s*\[&str;\s*\d+\]\s*=\s*\[([^\]]+)\]/.exec(rust)
  const rustClasses = m ? m[1].split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean) : []
  check('能从 trace.rs 读到分类表', rustClasses.length > 0, JSON.stringify(rustClasses))
  check(
    '前后端分类逐字一致',
    rustClasses.length === FAILURE_CLASSES.length && rustClasses.every((c) => FAILURE_CLASSES.includes(c)),
    `rust=[${rustClasses}] ts=[${FAILURE_CLASSES}]`,
  )
  check('五类可区分的失败都在表内', ['network', 'empty', 'no-svg', 'quality', 'cancel', 'auth'].every((c) => FAILURE_CLASSES.includes(c)))
}

// ---------- 纯函数 ----------
console.log('\n[分类与记录形状]')
{
  check('网络错误', classifyError('请求 DeepSeek 失败：error sending request') === 'network')
  check('超时归网络类（可在预算内重试）', classifyError('素材位等待超时（超过 240 秒）') === 'network')
  check('鉴权错误单独成类（不重试）', classifyError('DeepSeek API 错误 401：Unauthorized') === 'auth')
  check('参数无效同样不重试', classifyError('DeepSeek API 错误 400：invalid_request') === 'auth')
  check('限流可重试（429 归网络类）', classifyError('DeepSeek API 错误 429：rate limited') === 'network')
  check('暂时性服务端错误可重试（503 归网络类）', classifyError('DeepSeek API 错误 503：unavailable') === 'network')
  check('404 之类的 4xx 不重试', classifyError('DeepSeek API 错误 404：not found') === 'auth')
  check('鉴权类不可重试', !retryable('auth'))
  check('取消不可重试', !retryable('cancel'))
  check('网络类可重试一次', retryable('network'))
  check('质检拒收可重试一次', retryable('quality'))
  // 限流等待提示：Rust 把 Retry-After 用 RETRY_HINT: 前缀转发过来（只认秒数）
  check('能读出服务端等待提示', retryHintMs('DeepSeek API 错误 429：rate limited RETRY_HINT:3') === 3000)
  check('没有提示返回 null（不猜一个等待时间）', retryHintMs('DeepSeek API 错误 500：boom') === null)
  check('提示非法也不猜', retryHintMs('RETRY_HINT:abc') === null)
  check('取消', classifyError('user canceled the request') === 'cancel')
  check('取消（中文）', classifyError('已取消') === 'cancel')
  check('空内容', classifyError('模型未返回内容（或返回内容为空）') === 'empty')
  check('正文非空但没有 SVG → no-svg', classifyGenError('图像子智能体未返回 SVG（响应片段：好的，我画了…）', '好的，我画了…') === 'no-svg')
  check('正文为空却没有 SVG → empty（不是 no-svg）', classifyGenError('图像子智能体未返回 SVG（响应片段：）', '') === 'empty')
  check('从异常文案里也能读出响应片段（桌面链路正文不回传）', classifyGenError('图像子智能体未返回 SVG（响应片段：我画了一幅画）') === 'no-svg')
  check('片段为空时判 empty', classifyGenError('图像子智能体未返回 SVG（响应片段：）') === 'empty')
  check('认不出归 unknown（不猜）', classifyError('某种没见过的异常') === 'unknown')

  check('合法记录通过形状校验', isTraceRecord({ kind: 'slot', slotId: 'r1-s1', decision: 'reuse', ms: 12, attempt: 1 }))
  check('拒绝未知失败分类', !isTraceRecord({ kind: 'slot', failure: 'whatever' }))
  check('拒绝非法耗时', !isTraceRecord({ kind: 'slot', ms: -1 }))
  check('拒绝非正尝试序号', !isTraceRecord({ kind: 'slot', attempt: 0 }))
  check('截断保留可读长度', clip('x'.repeat(500), 20).length === 21)
}

// ---------- 身份与缓冲 ----------
console.log('\n[回合/素材位身份与内存缓冲]')
{
  clearTraceBuffer()
  const a = newRunId()
  const b = newRunId()
  check('runId 不重号', a !== b, `${a} / ${b}`)
  check('slotId 带回合前缀且稳定', newSlotId(a, 0) === `${a}-s1` && newSlotId(a, 0) === newSlotId(a, 0))
  trace({ kind: 'run', runId: a, phase: 'turn', ok: true })
  check('记录进内存缓冲', traceBuffer().length === 1)
  // 日志失败不阻塞创作：sink 抛错必须被吞掉
  setTraceSink(() => {
    throw new Error('磁盘满了')
  })
  let threw = false
  try {
    trace({ kind: 'note', runId: a, phase: 'save' })
  } catch {
    threw = true
  }
  check('sink 抛错不会打断调用方', !threw)
  setTraceSink(null)
  clearTraceBuffer()
}

// ---------- 故障注入：五类结果必须可区分 ----------
const V2 = '[[theme:校园]]\n\n[[img:inline|浅蓝浅粉校园书桌与对话气泡插画，清爽活泼]]\n\n正文一句话。'

/** 跑一次素材解析并取回这一轮涉及该素材位的追踪记录 */
async function inject(name, behavior) {
  resetStub()
  clearTraceBuffer()
  callLog.length = 0
  genBehavior = behavior
  const ledger = createLedger(newRunId())
  const info = emptyMaterializeInfo()
  const out = await materializePlaceholders(V2, '校园', info, { persist: false, ledger, theme: '校园' })
  const recs = traceBuffer()
  const slot = recs.find((r) => r.kind === 'slot')
  const quality = recs.find((r) => r.kind === 'quality')
  return { name, ledger, info, out, recs, slot, quality, draws: callLog.filter((c) => c === 'gen_svg').length }
}

console.log('\n[故障注入：五类结果能明确区分（离线，禁网）]')
const cases = [
  ['网络错误', () => { throw new Error('请求 DeepSeek 失败：error sending request for url') }, 'network'],
  ['空内容', () => { throw new Error('图像子智能体未返回 SVG（响应片段：）') }, 'empty'],
  ['无 SVG', () => { throw new Error('图像子智能体未返回 SVG（响应片段：好的，我画了一幅校园插画）') }, 'no-svg'],
  [
    '质检拒绝',
    () =>
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none"><text x="10" y="20">文字</text><circle cx="12" cy="12" r="3" fill="#000"/></svg>',
    'quality',
  ],
  ['取消', () => { throw new Error('user canceled') }, 'cancel'],
]
const results = {}
for (const [label, behavior, expect] of cases) {
  const r = await inject(label, behavior)
  results[label] = r
  check(`${label} → ${expect}`, r.slot && r.slot.failure === expect, `failure=${r.slot && r.slot.failure} detail=${r.slot && r.slot.note}`)
  check(`${label}：记录形状合法`, r.recs.every((x) => isTraceRecord(x)), JSON.stringify(r.recs.map((x) => x.kind)))
  check(`${label}：素材位带 slotId（可沿它对到最终绑定）`, !!r.slot?.slotId && r.slot.slotId.startsWith(r.ledger.runId), r.slot?.slotId)
  check(`${label}：绑定落成 source=failed 且无 id`, r.info.bindings.length === 1 && r.info.bindings[0].source === 'failed' && r.info.bindings[0].id === '')
}

console.log('\n[预算：失败不越界重试，取消不重试]')
{
  check('网络错误在预算内重试一次（共 2 次绘图）', results['网络错误'].draws === 2, `draws=${results['网络错误'].draws}`)
  check('无 SVG 重试一次', results['无 SVG'].draws === 2, `draws=${results['无 SVG'].draws}`)
  check('质检拒绝重试一次', results['质检拒绝'].draws === 2, `draws=${results['质检拒绝'].draws}`)
  check('取消**不**重试', results['取消'].draws === 1, `draws=${results['取消'].draws}`)
  check('质检拒绝留下可读的具体原因', !!results['质检拒绝'].quality?.qualityReasons?.length, JSON.stringify(results['质检拒绝'].quality?.qualityReasons))
  const s = summarize(results['网络错误'].recs)
  check('汇总能按失败分类计数', s.failures.network === 1, JSON.stringify(s.failures))
  check('汇总能给出素材位清单', s.slots.length === 1)
}

// ---------- 台账：一轮只做一次决定 ----------
console.log('\n[台账：同一素材位在整个回合内只做一次决定]')
{
  resetStub()
  clearTraceBuffer()
  callLog.length = 0
  genBehavior = () => {
    throw new Error('请求 DeepSeek 失败：error sending request')
  }
  const ledger = createLedger(newRunId())
  // 三轮"自动修订"用同一份素材位（正文不同，占位描述相同）→ 就该只花一次预算
  for (let round = 0; round < 3; round++) {
    const info = emptyMaterializeInfo()
    await materializePlaceholders(`${V2}\n\n第 ${round} 轮的正文说明。`, '校园', info, { persist: false, ledger, theme: '校园' })
  }
  const draws = callLog.filter((c) => c === 'gen_svg').length
  check('三次素材化只花 2 次绘图（旧实现为 6 次）', draws === 2, `draws=${draws}`)
  check('未完成素材位只有 1 个', unfinished(ledger).length === 1)
  check('失败原因与尝试次数留在台账', unfinished(ledger)[0].attempts === 2, `attempts=${unfinished(ledger)[0].attempts}`)

  // 成功的素材位在下一轮直接复用，不再检索也不再绘制
  resetStub()
  callLog.length = 0
  const okLedger = createLedger(newRunId())
  // 合规的内嵌插画样例（8 个可见元素、覆盖率足够），保证这一轮真的成功、可以观察跨轮复用
  const MOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="0" y="170" width="750" height="50" fill="#e8dcc8"/>
<path d="M0 170 L180 110 L320 150 L500 90 L640 140 L750 96 V170 Z" fill="#d9a35f" opacity="0.45"/>
<circle cx="620" cy="60" r="38" fill="#f2c76e"/>
<rect x="120" y="96" width="90" height="74" fill="#8a5f3a"/>
<path d="M110 96 h110 l-18 -26 h-74 z" fill="#a97c50"/>
<circle cx="165" cy="130" r="12" fill="#f2c76e"/>
<path d="M400 150 q20 -34 60 -30 q-8 34 -60 30z" fill="#8fb8a4"/>
<circle cx="430" cy="132" r="9" fill="#c96f4a"/>
</svg>`
  genBehavior = () => MOCK
  for (let round = 0; round < 3; round++) {
    const info = emptyMaterializeInfo()
    const out = await materializePlaceholders(`${V2}\n\n第 ${round} 轮改的是正文。`, '校园', info, { persist: false, ledger: okLedger, theme: '校园' })
    if (round > 0) {
      check(`第 ${round + 1} 轮直接复用成品块`, out.includes(MOCK))
      // 未落库时素材没有库 ID，规范化源文保留原占位行——但素材位身份（指纹）不变，
      // 下一轮仍命中同一条台账记录。落了库才会变成 `[[asset:分类|素材ID|用途]]`（见 asset-resolve-check 的真实样例）。
      check(`第 ${round + 1} 轮素材位身份稳定`, info.ledger.order.length === 1 && info.normalized.includes('[[img:inline|'))
    }
  }
  const okDraws = callLog.filter((c) => c === 'gen_svg').length
  check('成功的素材位只画了 1 次（跨 3 轮）', okDraws === 1, `draws=${okDraws}`)

  // 单项重试：只给指定的素材位重置预算
  callLog.length = 0
  const info = emptyMaterializeInfo()
  const slotId = unfinished(okLedger).length ? unfinished(okLedger)[0].slotId : okLedger.order[0]
  await materializePlaceholders(`${V2}\n\n重试用的正文。`, '校园', info, { persist: false, ledger: okLedger, theme: '校园', retrySlotIds: [slotId] })
  check('单项重试才会再画一次', callLog.filter((c) => c === 'gen_svg').length === 1, `draws=${callLog.filter((c) => c === 'gen_svg').length}`)
}

console.log('\n[阶段 4：有界并发、在途共享、超时与取消]')
{
  // 合规的内嵌插画样例（8 个可见元素、覆盖率足够），保证这一轮真的成功
  const MOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="0" y="170" width="750" height="50" fill="#e8dcc8"/>
<path d="M0 170 L180 110 L320 150 L500 90 L640 140 L750 96 V170 Z" fill="#d9a35f" opacity="0.45"/>
<circle cx="620" cy="60" r="38" fill="#f2c76e"/>
<rect x="120" y="96" width="90" height="74" fill="#8a5f3a"/>
<path d="M110 96 h110 l-18 -26 h-74 z" fill="#a97c50"/>
<circle cx="165" cy="130" r="12" fill="#f2c76e"/>
<path d="M400 150 q20 -34 60 -30 q-8 34 -60 30z" fill="#8fb8a4"/>
<circle cx="430" cy="132" r="9" fill="#c96f4a"/>
</svg>`

  // 四个**不同**素材位：应并发绘制，峰值不超过 2
  resetStub()
  clearTraceBuffer()
  callLog.length = 0
  genDelayMs = 25
  genBehavior = () => MOCK
  inFlight = 0
  maxInFlight = 0
  const v2 = [
    '[[theme:校园]]',
    '',
    '[[img:inline|甲图：校园书桌与笔记本电脑插画]]',
    '',
    '[[img:inline|乙图：操场与旗帜场景插画]]',
    '',
    '[[img:inline|丙图：教室黑板与课桌插画地]]',
    '',
    '[[img:inline|丁图：图书馆书架与台灯插画]]',
    '',
    '正文一句话。',
  ].join('\n')
  const ledger = createLedger(newRunId())
  const info = emptyMaterializeInfo()
  const out = await materializePlaceholders(v2, '校园', info, { persist: false, ledger, theme: '校园' })
  check('并发峰值不超过 2', maxInFlight <= 2, `max=${maxInFlight}`)
  check('确实并发（峰值达到 2，而不是串行）', maxInFlight === 2, `max=${maxInFlight}`)
  check('四个素材位各画一次', callLog.filter((c) => c === 'gen_svg').length === 4, `draws=${callLog.filter((c) => c === 'gen_svg').length}`)
  const order = out
    .split('\n')
    .filter((l) => l.startsWith('::: art inline '))
    .map((l) => l.replace('::: art inline ', '').slice(0, 2))
  check('结果按原素材位顺序组装', order.join(',') === '甲图,乙图,丙图,丁图', order.join(','))

  // 相同描述的两处 → 共享同一条在途任务，只画一次，两处都拿到成品
  resetStub()
  clearTraceBuffer()
  callLog.length = 0
  genDelayMs = 20
  const dup = ['[[theme:校园]]', '', '[[img:inline|同一张图：校园书桌插画场景]]', '', '中间正文。', '', '[[img:inline|同一张图：校园书桌插画场景]]'].join('\n')
  const ledger2 = createLedger(newRunId())
  const info2 = emptyMaterializeInfo()
  const out2 = await materializePlaceholders(dup, '校园', info2, { persist: false, ledger: ledger2, theme: '校园' })
  check('相同输入共享在途任务（只画一次）', callLog.filter((c) => c === 'gen_svg').length === 1, `draws=${callLog.filter((c) => c === 'gen_svg').length}`)
  check('两处都拿到成品块', (out2.match(/::: art inline/g) || []).length === 2)
  check('台账只登记一条素材位', ledger2.order.length === 1, `n=${ledger2.order.length}`)

  // 超时机制（纯函数层）：到期立刻返回，不无限等待
  inFlight = 0
  maxInFlight = 0
  const never = new Promise(() => {})
  const t0 = Date.now()
  const timeoutErr = await raceTimeout(never, 60).then(
    () => null,
    (e) => e,
  )
  check('超时后立刻返回（不无限等待）', !!timeoutErr && Date.now() - t0 < 800, `ms=${Date.now() - t0}`)
  check('超时错误归网络类（可在预算内重试）', classifyError(timeoutErr) === 'network')
  check('预算默认值为计划初始值 240 秒', slotBudgetMs() === 240_000, String(slotBudgetMs()))
  check('并发默认值为计划初始值 2', drawConcurrency() === 2, String(drawConcurrency()))

  // mapBounded：结果必须按输入顺序返回，无论完成先后如何
  const bounded = await mapBounded([40, 10, 30, 5], 2, async (ms, i) => {
    await sleep(ms)
    return i
  })
  check('有界并发结果按输入顺序返回', bounded.join(',') === '0,1,2,3', bounded.join(','))

  // 取消后不再派发新任务、不入库
  resetStub()
  clearTraceBuffer()
  callLog.length = 0
  // T9：调用计数也一并归零——下一个块（落库通道未被打扰）必须只看这一段的调用，
  // 用脚本开头起的全局累计计数器钉不住这一段（前面任何一次调用都会让它为真）。
  tauriCalls = 0
  genDelayMs = 0
  genBehavior = () => MOCK
  const ledger3 = createLedger(newRunId())
  const info3 = emptyMaterializeInfo()
  const out3 = await materializePlaceholders(v2, '校园', info3, {
    persist: true,
    ledger: ledger3,
    theme: '校园',
    cancelled: () => true,
  })
  check('已取消：不再派发绘图', callLog.filter((c) => c === 'gen_svg').length === 0, `draws=${callLog.filter((c) => c === 'gen_svg').length}`)
  check('已取消：不写素材库', callLog.filter((c) => c === 'add_asset').length === 0)
  check('已取消：成品不含素材块', !out3.includes('::: art inline'))
  check('已取消：素材位记为未完成（完成状态按事实判定）', unfinished(ledger3).length === 4, `n=${unfinished(ledger3).length}`)

  genDelayMs = 0
}

console.log('\n[落库通道未被打扰]')
{
  // T9：原来是 `check('桩只被问到预期命令', callLog.every((c) => [...].includes(c)))`——
  // 紧邻的上一段刚刚断言过"取消后不派发绘图"，callLog 极可能是空数组，而 `[].every(...)` 恒真
  // （vacuous true），于是这条只可能 PASS；同块的 `tauriCalls > 0` 又用的是全局累计计数，同样钉不住本段。
  // 现在：先要求本段确实发生过调用，再要求命令落在白名单内；计数器已在上一段起点归零，是本段独立计数。
  check(
    '桩只被问到预期命令',
    callLog.length > 0 && callLog.every((c) => ['list_assets', 'list_assets_report', 'load_settings', 'gen_svg', 'refine_brief'].includes(c)),
    `本段调用 ${callLog.length} 次：${JSON.stringify([...new Set(callLog)])}`,
  )
  check('tauri 桩确实被调用（不是空跑；本段独立计数）', tauriCalls > 0, `calls=${tauriCalls}`)
}

// ---------- /models 上限缓存 + 假服务空连接（**结构断言，非行为断言**）----------
//
// 这两条契约都住在 Rust 侧（`src-tauri/src/chat.rs`），本脚本跑在 Node 里，**无法调用它们**：
//   · 失败缓存 60 秒 TTL：`LIMITS_FAILURE_TTL` / `CachedLimits` / `failure_is_fresh`
//   · 假服务空连接不计数：`read_request(...)` 读空就 `continue` / 独立的 `models_hits` 计数
// 所以这里做的是**读源码断言"关键结构还在"**——它能挡住"重构时把失败缓存删掉/把 TTL 改掉/
// 把空连接算成命中"这类无声回归，但**它不能证明运行时行为**（TTL 到点是否真的重探、
// 空连接是否真的不计命中）。真正的行为断言在 cargo test 里，且已存在：
//   · chat.rs::tests::failure_cache_ttl_boundary_is_exactly_sixty_seconds（TTL 边界，纯函数直断，不真等 60 秒）
//   · chat.rs::tests::limits_failure_is_cached_and_a_cleared_cache_reprobes（TTL 内不再探 / 清缓存后重探）
// 请用 `cd src-tauri && cargo test` 跑那两条；这里只保证结构没被拆掉。
// 结构断言必须容忍排版差异（换行/空格/参数换行），所以正则一律用 \s+/[\s\S]{0,N} 缓冲。
console.log('\n[/models 上限缓存：结构断言（真行为断言在 cargo test，脚本调不动 Rust）]')
{
  const rust = readFileSync(join(here, '..', 'src-tauri', 'src', 'chat.rs'), 'utf8')
  const has = (re) => re.test(rust)

  // 1) 失败缓存的存在与时长：60 秒是"够长到不每次请求都探、够短到网络恢复能自动接上"的折中
  check('存在 LIMITS_FAILURE_TTL', has(/pub const LIMITS_FAILURE_TTL:\s*Duration\s*=/))
  check('失败缓存时长恰为 60 秒', has(/LIMITS_FAILURE_TTL:\s*Duration\s*=\s*Duration::from_secs\(60\)/))
  check(
    'TTL 边界抽成纯函数 failure_is_fresh（否则只能真等 60 秒才能测）',
    has(/fn failure_is_fresh\(at:\s*std::time::Instant,\s*now:\s*std::time::Instant\)\s*->\s*bool\s*\{[\s\S]{0,120}LIMITS_FAILURE_TTL/),
  )

  // 2) 缓存项必须区分"成功"与"失败"两种状态：只缓存成功 = 离线时每个请求都白探一次
  check('CachedLimits 区分 Ok/Failed 两种缓存项', has(/enum CachedLimits\s*\{[\s\S]{0,240}Ok\(ModelLimits\)[\s\S]{0,240}Failed\(/))
  check('Failed 分支记住失败时刻', has(/Failed\(std::time::Instant\)/))
  check('成功值直接命中返回、不再探测', has(/Some\(CachedLimits::Ok\(l\)\)\s*=>\s*return \*l/))
  check(
    '失败值在 TTL 内命中即退兜底（不再探测）',
    has(/CachedLimits::Failed\(at\)[\s\S]{0,80}failure_is_fresh\([\s\S]{0,80}\)\s*=>\s*\{?\s*return fallback_limits\(\)/),
  )
  check(
    '探测失败会写入失败缓存（不是只返回兜底就完事）',
    has(/g\.insert\(key,\s*CachedLimits::Failed\(std::time::Instant::now\(\)\)\)/),
  )
  // 兜底路径不允许把错误抛给调用方（离线/端点异常时创作不能被旁路探测拖垮）
  check('查不到时退已验证可用的兜底值（绝不抛错）', has(/fallback_limits\(\)/) && has(/pub const FALLBACK_MAX_OUTPUT_TOKENS/))

  // 3) 假服务：`/models` 是旁路探测，不能污染"这次派发了几次"的命中数
  check('假服务把 /models 探测单独计数', has(/pub models_hits:\s*Arc<AtomicUsize>/))
  check(
    '/models 命中只加 models_hits、不加 hits',
    has(/if is_models\s*\{[\s\S]{0,160}models_hits2\.fetch_add\(1,\s*Ordering::SeqCst\)/),
  )
  // 4) 空连接不计数：连接池偶尔开一条不发请求就关掉的连接，把它算成一次命中会让
  //    "这次请求派发了几次"这类断言偶发假红（实测 8 轮中 1 轮）。
  //    **刻意不绑定具体写法**：可能是 `let n = sock.read(&mut buf).unwrap_or(0); if n == 0 { continue }`，
  //    也可能抽成 `let buf = read_request(&mut sock); if buf.is_empty() { continue }`（贴切的重构都会改形状，
  //    这里要挡的是"守卫被删掉/被挪到计数之后"，不是"代码没按我写时的样子排"）。
  //    所以改成断言**不变量**：在"接受连接"之后、"给补全请求计命中"之前，必须存在一次"请求为空就 continue"。
  const acceptAt = rust.indexOf('listener.accept()')
  const hitAt = rust.indexOf('hits2.fetch_add(1, Ordering::SeqCst)')
  const window = acceptAt >= 0 && hitAt > acceptAt && hitAt - acceptAt < 8000 ? rust.slice(acceptAt, hitAt) : ''
  const emptyGuardRe = /if\s+(n\s*==\s*0|buf\.is_empty\(\)|req\.is_empty\(\)|raw\.is_empty\(\))\s*\{\s*continue;?\s*\}/
  check(
    '假服务：接受连接后先判空，空请求不计命中（守卫位于"计命中"之前）',
    emptyGuardRe.test(window),
    window ? `窗口=${window.length} 字节` : '未能定位 accept→计命中 区间',
  )
  check('假服务：确实读了请求字节（判空才有依据）', /read_request\(|sock\.read\(&mut/.test(window))

  // 5) 上面这些结构对应的 cargo 行为测试确实存在（否则结构再对也没人验行为）
  check('cargo 测试覆盖 TTL 边界（60 秒）', has(/fn failure_cache_ttl_boundary_is_exactly_sixty_seconds\(\)/))
  check('cargo 测试覆盖"失败进缓存 / 清缓存后重探"', has(/async fn limits_failure_is_cached_and_a_cleared_cache_reprobes\(\)/))
  check('cargo 测试用 models_hits 观察探测次数（计数口径真的被用上）', has(/models_hits\.load\(/))
  check('结构断言确实读到 chat.rs（不是空文件空跑）', rust.length > 10000 && has(/pub async fn model_limits\(cfg:\s*&LlmConfig\)/), `bytes=${rust.length}`)

  // 反向对照（防"正则永远为真"）：把两处关键代码各改坏一格，对应断言必须变红。
  // 没有这一步的话，正则写错（比如少写了 \s 导致实际匹配到别处）会让整段结构断言形同虚设却全绿。
  const brokenTtl = rust.replace(/(LIMITS_FAILURE_TTL:\s*Duration\s*=\s*Duration::from_secs\()60\)/, '$161)')
  check(
    '反向对照：TTL 改成 61 秒 → “恰为 60 秒”断言变红（证明正则真的在判）',
    brokenTtl !== rust && !/LIMITS_FAILURE_TTL:\s*Duration\s*=\s*Duration::from_secs\(60\)/.test(brokenTtl),
  )
  const brokenEmpty = window.replace(emptyGuardRe, 'if false { continue; }')
  check(
    '反向对照：去掉空连接守卫 → “空连接不计命中”断言变红',
    brokenEmpty !== window && !emptyGuardRe.test(brokenEmpty) && !!window,
  )
}

console.log(failed === 0 ? '\nTRACE OK' : `\nTRACE FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
