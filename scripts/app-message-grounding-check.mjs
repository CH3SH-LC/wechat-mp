// app-message-grounding-check.mjs —— F1「全入口遵守材料依据边界」的**真实 App 实参**截获
//
// 用法：
//   node scripts/app-message-grounding-check.mjs [outDir] [URL]
//     outDir 缺省 %TEMP%/wxmp-f1-<时间戳>/（不覆盖历史证据）
//     URL    缺省 http://127.0.0.1:1420（需先起 dev server）
//
// 为什么必须这样打：任务卡第 3 节明确要求「用零模型替身截获**真实 App 实际发出**的消息……
// 不能以常量匹配或源码字符串断言代替」。`prep-contract-check` 打的是真实 `runPrep`（覆盖 prep 两个入口），
// 但 compose 的 WRITE、candidate/compose 之后的自动 REVISE 是 **App 自己的组装**——
// 只断言源码常量，抓不住"规则写在文件里、忘了接进实际发出的消息"。
//
// 做法：把真实 App 原样跑起来（真实 React 组件、真实 `turn()`、真实交付门禁），
// **只在 `src/lib/chat.ts` 模块末尾注入**一段替身，把 Rust 侧通道换成受控实现：
//   · `prep_turn` 按剧本返回（夹具，不是原响应回放）；
//   · `chat_stream` 记录**实参**再按剧本回放增量；
//   · 其余命令返回最小可用的固定值。
// 页面里 `window.__TAURI_INTERNALS__` 因此为真 → App 走的就是桌面端的组装路径（digest、baseMsgs、revise 追加）。
// 不联网、不调模型、不写真实工作区。
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { parseRunnerArgs, writeFileAtomic } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const CONFIG_HINT = `配置方法（与 verify-ui.mjs 同一口径）：
  export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
  export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"`

// ---- 断言目标文本 ----
// 都是"共同规则单一来源"在**实际发出的消息**里的可识别片段。它们不是源码常量匹配：
// 断言对象是页面里真实 App 组装并交给 `chat_stream` / `prep_turn` 的 `messages` 实参。
const MARK = {
  /** 共同材料依据边界：必须出现在 system（persona）与各入口追加指令里 */
  ground: '材料依据边界',
  /** compose 的 digest 头：旧文案「冲突以库为准」必须已被收窄 */
  digestOld: '作为本次创作依据，冲突以库为准',
  /** compose 的 digest 头（收窄后）：写作知识只约束写法，不是事实来源 */
  digestNew: '已取用写作知识',
  /** 自动修订：只修所列问题、不新增运营规则 */
  reviseNoNewRules: '不新增运营规则',
  /** 自动修订：保留对象限定为用户材料 / 明确确认的事实 */
  reviseKeep: '用户材料或明确确认',
  /** 续改：当前正式稿已注入 */
  priorDocHeading: '当前正式文稿',
  /** 续改：「权威」的范围限定（只指版本与素材引用，不是逐句事实认证） */
  priorAuthorityLimit: '只指**当前保存的版本与素材引用**',
  /** 续改：既有素材保持约束仍在 */
  priorAssetKeep: '不要给已有素材加 |new',
  /** G3 过度阻断对照：规则里必须保留正向授权（连接语与明确标识的普通建议照常写） */
  g3PositiveAllowed: '可以写连接语和明确标识的普通建议',
  /** G3 过度阻断对照：规则里**不得**出现"见到承诺就删/封"这类口径（一组，不是单串） */
  g3KeywordHack: ['一律删', '全部删除', '一律不写', '不得出现', '禁止提及'],
  /** G3 过度阻断对照：规则要明确"不要因为缺一个非必要字段就反复追问" */
  g3NoEndlessAsking: '不要因为缺一个非必要字段就反复追问',
  /** G3 过度阻断对照：材料没给的非必要细节**可以省略**（而不是必须问） */
  g3OmitAllowed: '可以省略',
  /** prep 指令本身的识别串（用它把断言钉在那条消息上，而不是 system） */
  prepInstruction: '创作类请求的处理方式',
  /** 末轮预算提醒的识别串 */
  prepLastRound: '最后一次请求',
  /** 末轮提醒里必须带上的依据边界句（时间紧也不能补事实） */
  prepLastRoundGround: '时间紧也不要把没材料依据的规则写进去',
}

const run = {
  script: 'app-message-grounding-check',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED',
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [],
  errors: [],
  sourceHashes: {},
}
const SRC = ['src/App.tsx', 'src/lib/chat.ts', 'src/lib/persona.ts', 'src/lib/prep.ts', 'src/lib/revise.ts']
for (const rel of SRC) run.sourceHashes[rel] = createHash('sha256').update(readFileSync(join(repoRoot, rel))).digest('hex')

const check = (id, pass, ...evidence) => {
  run.checks.push({ id, pass: Boolean(pass), evidence: evidence.map((e) => String(e ?? '')) })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${evidence.filter(Boolean).length ? ' (' + evidence.filter(Boolean).join(' / ') + ')' : ''}`)
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[app-message-grounding-check] ERROR@${stage}: ${message}`)
}

function resolvePlaywright() {
  try {
    return require('playwright')
  } catch (e) {
    const p = process.env.VERIFY_PLAYWRIGHT
    if (!p) dieBlocked(`解析不到 playwright：require 失败（${String(e.message || e).split('\n')[0]}），且未设置 VERIFY_PLAYWRIGHT`)
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return require(target)
    } catch (e2) {
      dieBlocked(`VERIFY_PLAYWRIGHT=${target} 仍解析失败：${String(e2.message || e2).split('\n')[0]}`)
    }
  }
}
function resolveChromium() {
  const p = process.env.VERIFY_CHROMIUM
  if (!p) return null
  const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
  if (!existsSync(target)) dieBlocked(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
  return target
}
function dieBlocked(msg) {
  fail('deps', msg)
  run.blockedReason = msg
  console.error(`\n${CONFIG_HINT}\n`)
  finalize()
  process.exit(2)
}

const { outDir: outDirArg, base } = parseRunnerArgs()
const outDir = outDirArg || join(process.env.TEMP || '/tmp', `wxmp-f1-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)

const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromium()

// ---------------------------------------------------------------------------
// 夹具脚本（受控响应；**不是**原响应回放）
// ---------------------------------------------------------------------------

/**
 * 一份**带阻断项**的草稿：含 emoji → `html.emoji` 阻断（质量模块 v10 零 emoji 铁律），
 * 且 `repairKind` 属于"可改写法修复" → 必然触发一次自动修订。
 * 这正是 `repair-flow-check` 用来进修订环的那条既有触发路径，不是为本卡新造的。
 */
const BAD_V2 = '```v2\n# 周末到馆提醒 🎉\n\n各位读者：\n\n10月10日（周六）9:00-17:00 开放；10月11日（周日）全天闭馆。\n\n咨询电话：010-55556666。\n```'

/** 修订轮回放稿：去掉 emoji，让循环收口（与"依据"无关，只看接线）。 */
const REVISED_V2 = '```v2\n# 周末到馆提醒\n\n各位读者：\n\n10月10日（周六）9:00-17:00 开放；10月11日（周日）全天闭馆。\n\n咨询电话：010-55556666。\n```'

// 两个剧本都走满 **3 次** prep 请求（前两轮取资料、第 3 轮才声明）——这不是为了好看：
// `PREP_LAST_ROUND_REMINDER` 只在 `callNo === MAX_PREP_CALLS - 1`（第 3 次）追加，
// 2 轮的剧本**永远触不到它**，会让"末轮提醒真的发出去了吗"变成空头覆盖（独立复核 2026-10-03 抓到过）。
const PREP_COMPOSE = [
  { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
  { text: null, calls: [{ id: 'k2', name: 'load_knowledge', args: '{"name":"type-announcement"}' }] },
  { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"modify"}' }] },
]
const PREP_CANDIDATE = [
  { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
  { text: null, calls: [{ id: 'k2', name: 'load_knowledge', args: '{"name":"type-announcement"}' }] },
  {
    text: null,
    calls: [
      {
        id: 'f1',
        name: 'finish_preparation',
        args: JSON.stringify({ outcome: 'candidate', source: BAD_V2.replace(/^```v2\n|\n```$/g, ''), assetPolicy: 'modify' }),
      },
    ],
  },
]

/**
 * G2b 用的既有正式稿：内容**故意**含一条材料未给的规则（"续借不受影响"），
 * 用来核对续改时"权威只指版本"的限定确实随实际消息发给模型（保留原文 ≠ 认证原文事实）。
 */
const PRIOR_SOURCE =
  '# 校园图书馆开放通知\n\n[[asset:art-wide|as-1790955979624508100|开篇横图插画：暖色台灯照亮蓝色书本]]\n\n' +
  '10 月 10 日（周六）9:00–17:00 开放；10 月 11 日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。\n\n' +
  '闭馆当天线上查询、续借不受影响。\n'
const PRIOR_DOC = {
  id: 'doc-fixture-prior-1',
  title: '校园图书馆开放通知',
  updated_at: '2026-10-02T15:44:31+08:00',
  source: PRIOR_SOURCE,
  html: '<p>夹具正文</p>',
  warnings: [],
  snapshots: {},
  bindings: [
    { slot: '[[asset:art-wide|as-1790955979624508100|开篇横图插画：暖色台灯照亮蓝色书本]]', slotId: 'slot-0', id: 'as-1790955979624508100', source: 'asset', reason: '夹具' },
  ],
  revision_id: 'rev-fixture-1',
  accepted_revision_id: 'rev-fixture-1',
  generation: 1,
  validation: 'verified',
  quality: null,
  run_id: 'run-fixture-1',
}

const CASES = [
  {
    name: 'compose-write-and-revise',
    prompt: '帮我写一篇周末到馆提醒的通知。',
    prep: PREP_COMPOSE,
    write: BAD_V2,
    revise: REVISED_V2,
  },
  {
    name: 'candidate-then-revise',
    prompt: '帮我写一篇周末到馆提醒的通知，直接出稿。',
    prep: PREP_CANDIDATE,
    write: null, // candidate 路径不发起撰写
    revise: REVISED_V2,
  },
  {
    // G2b：已有 accepted 正式稿 + 用户**只改标题**。核对的是"续改实参里带没带
    // ① 当前正式稿本身 ② 权威只指版本的限定 ③ 素材保持约束"。
    name: 'prior-doc-title-only',
    prompt: '只把标题改成「冬季开馆时间调整」，其他内容一律不动。',
    prep: PREP_COMPOSE,
    write: BAD_V2,
    revise: REVISED_V2,
    priorDoc: PRIOR_DOC,
  },
]
run.plannedCases = CASES.map((c) => c.name)

/** 注入到 chat.ts 末尾的替身：只替换 Rust 侧通道，App 组装一行不改。 */
function stubSource(c) {
  return `
// ---- F1 夹具注入（仅测试）：把 Tauri 通道换成受控替身 ----
;(function () {
  const w = window
  w.__wxmp = { calls: [], prep: ${JSON.stringify(c.prep)}, write: ${JSON.stringify(c.write)}, revise: ${JSON.stringify(c.revise)}, openDoc: ${JSON.stringify(c.priorDoc ?? null)}, events: {} }
  let cbSeq = 0
  let evSeq = 0
  const handlers = {}
  // **必须在调用时刻深拷贝**：runPrep 传进来的 convo 是**同一个数组引用**，它在后续轮次里还会被 push
  // 工具结果——按引用存下来，读回的"第 1 次请求"其实是最后一次的最终形态（三份记录逐字节相同）。
  // 独立复核 2026-10-03 抓到过这一点：那样记录的实参**不是**当时真正发出去的那份。
  const call = (cmd, args) => {
    let snap = null
    try { snap = args === undefined ? null : JSON.parse(JSON.stringify(args)) } catch (e) { snap = { __unserializable: String(e) } }
    w.__wxmp.calls.push({ cmd, args: snap })
    return args
  }
  const SVGSAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200"><rect width="640" height="200" fill="#e8e2d6"/><circle cx="160" cy="100" r="52" fill="#c8a06a"/><text x="240" y="112" font-size="28" fill="#3b3630">FIXTURE</text></svg>'
  const emitDelta = (runId, delta) => {
    const all = Object.values(handlers).filter((x) => x.event === 'chat-delta')
    w.__wxmp.emitProbe = (w.__wxmp.emitProbe || []).concat([{ listeners: all.length }])
    const h = all[all.length - 1]
    if (!h) return false
    const fn = w['_' + h.handlerId]
    if (typeof fn !== 'function') return false
    fn({ event: 'chat-delta', id: h.eventId, payload: { runId: runId ?? null, delta } })
    return true
  }
  const invoke = async (cmd, args) => {
    call(cmd, args)
    if (cmd === 'plugin:event|listen') {
      const eventId = ++evSeq
      handlers[eventId] = { event: args && args.event, handlerId: args && args.handler, eventId }
      return eventId
    }
    if (cmd === 'plugin:event|unlisten') return null
    if (cmd === 'prep_turn') {
      const n = w.__wxmp.calls.filter((x) => x.cmd === 'prep_turn').length
      return w.__wxmp.prep[Math.min(n - 1, w.__wxmp.prep.length - 1)]
    }
    if (cmd === 'chat_stream') {
      const turn = (args && args.turn) || 'chat'
      const body = turn === 'revise' ? w.__wxmp.revise : turn === 'write' ? w.__wxmp.write : null
      w.__wxmp.streamTurns = (w.__wxmp.streamTurns || []).concat([turn])
      if (body) {
        // 分两段回放：真实流式也是多段增量
        emitDelta(args && args.runId, body.slice(0, Math.ceil(body.length / 2)))
        emitDelta(args && args.runId, body.slice(Math.ceil(body.length / 2)))
      }
      return null
    }
    switch (cmd) {
      case 'cancel_run':
      case 'cancel_reset':
      case 'trace_start':
      case 'trace_write':
      case 'rename_session':
      case 'delete_document':
      case 'delete_asset':
      case 'save_settings':
      case 'open_manual':
        return null
      case 'list_sessions': return { items: [] }
      case 'create_session': return 's-fixture-0001'
      case 'open_session': return null
      case 'save_session': return { ok: true }
      case 'delete_session': return { items: [] }
      case 'list_documents': return { items: [] }
      case 'open_document': return w.__wxmp.openDoc || null
      case 'save_document': return w.__wxmp.saveDocResult || null
      case 'load_settings':
        return { api_key: '', base_url: '', model: '', wx_appid: null, wx_secret: null, model_vision: null, vision_review: null, load_error: null }
      case 'model_lock_state': return { locked: false, model: '' }
      case 'list_assets_report': return { items: [] }
      case 'search_assets': return { items: [] }
      case 'get_asset': return null
      case 'add_asset': return { id: 'as-fixture' }
      case 'review_assets': return { ok: false, reason: '夹具：不做视觉复核' }
      case 'gen_svg': return SVGSAMPLE
      case 'export_html': return 'C:/fixture/out.html'
      case 'export_images': return 'C:/fixture/out.png'
      default: return null
    }
  }
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
  w.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback: (cb, once) => { const id = ++cbSeq; w['_' + id] = (p) => { if (once) delete w['_' + id]; cb(p) }; return id },
    convertFileSrc: (p) => p,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  }
})();
`
}

// ---------------------------------------------------------------------------
// 执行
// ---------------------------------------------------------------------------
let browser = null
const collected = []
try {
  browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
  for (const c of CASES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    const offsite = []
    await page.route('**/*', async (route) => {
      const u = route.request().url()
      if (u.startsWith(base + '/') || u.startsWith('data:') || u.startsWith('blob:')) return route.fallback()
      offsite.push(u)
      return route.abort('blockedbyclient')
    })
    await page.route('**/src/lib/chat.ts*', async (route) => {
      const response = await route.fetch()
      const actual = await response.text()
      await route.fulfill({ response, body: actual + stubSource(c), contentType: 'application/javascript' })
    })
    let turns = 0
    try {
      await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector('.chat-input-row textarea', { timeout: 30000 })
      await page.locator('.chat-input-row textarea').fill(c.prompt)
      await page.locator('.chat-input-row textarea').press('Enter')
      // 等本回合收口：busy 气泡消失且不再有新调用
      await page.waitForFunction(() => (window.__wxmp || {}).calls && window.__wxmp.calls.length > 0, null, { timeout: 60000 })
      await page.waitForFunction(() => !document.querySelector('.chat-input-row textarea[disabled]'), null, { timeout: 120000 })
      await page.waitForTimeout(1200)
      turns = await page.evaluate(() => window.__wxmp.calls.filter((x) => x.cmd === 'chat_stream').length)
    } catch (e) {
      fail(`case:${c.name}:drive`, String(e.message || e).split('\n')[0])
    }
    const snap = await page
      .evaluate(() => {
        const calls = window.__wxmp ? window.__wxmp.calls : []
        const streams = calls.filter((x) => x.cmd === 'chat_stream')
        const preps = calls.filter((x) => x.cmd === 'prep_turn')
        const slim = (m) => ({
          role: m.role,
          text: String(m.content || ''),
          images: Array.isArray(m.images) ? m.images.length : 0,
        })
        return {
          prepSends: preps.map((p) => ({ count: (p.args.messages || []).length, messages: (p.args.messages || []).map(slim) })),
          streams: streams.map((s) => ({ turn: s.args.turn, messages: (s.args.messages || []).map(slim) })),
          streamTurns: window.__wxmp.streamTurns || [],
          cmds: Array.from(new Set(calls.map((x) => x.cmd))).sort(),
        }
      })
      .catch((e) => ({ error: String(e) }))
    collected.push({ name: c.name, snap, pageErrors, offsite, turns })
    await context.close().catch(() => {})
  }
} catch (e) {
  fail('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
} finally {
  mkdirSync(outDir, { recursive: true })
  writeFileAtomic(join(outDir, 'raw.json'), JSON.stringify({ run, collected }, null, 2) + '\n')
  if (browser) await browser.close().catch(() => {})
}

// ---------------------------------------------------------------------------
// 断言
// ---------------------------------------------------------------------------
const has = (s, sub) => String(s || '').includes(sub)
const allText = (msgs) => (msgs || []).map((m) => m.text).join('\n\u0000\n')
const systemText = (msgs) => ((msgs || []).find((m) => m.role === 'system') || {}).text || ''
/**
 * **最后一条消息**＝ App 各入口**追加**的那段指令（WRITE 的 digest+撰写指令、REVISE 的修订清单）。
 * 断言必须打在这一条上：system 里本来就有共同规则，用 `allText` 会让"追加指令漏接"被 system 盖过去——
 * 那正是本卡要防的"规则写在文件里、忘了接进实际发出的消息"。
 */
const lastText = (msgs) => {
  const a = msgs || []
  return a.length ? a[a.length - 1].text : ''
}
/** 找出**包含着某个识别串的那条消息**（用于把断言钉在特定消息上，而不是整串文本） */
const pickMsg = (msgs, sub) => (msgs || []).find((m) => has(m.text, sub)) || null

if (!run.errors.length && collected.length === CASES.length) {
  for (const [i, c] of CASES.entries()) {
    const r = collected[i]
    const label = c.name
    run.executedCases.push(label)
    console.log(`\n[${label}] cmds=${JSON.stringify((r.snap || {}).cmds || (r.snap || {}).error)} streamTurns=${JSON.stringify((r.snap || {}).streamTurns || [])}`)
    check(`${label}：页面无异常`, r.pageErrors.length === 0, r.pageErrors.join(' / '))
    check(`${label}：没有外链请求`, r.offsite.length === 0, r.offsite.join(' / '))
    check(`${label}：本回合真的跑起来了（有 prep 往返）`, (r.snap.prepSends || []).length > 0, `prep 往返 ${(r.snap.prepSends || []).length} 次`)

    // prep 普通轮与末轮都在实参里带上共同依据规则。
    // ⚠️ 这里的第二条断言**必须钉在 PREP_INSTRUCTION 那条消息上**，不能用整串文本：
    // system 里本来就有共同规则（persona 展开），用整串会让这 6 条变成恒真、抓不住"prep 指令漏接"。
    const prepSends = r.snap.prepSends || []
    for (const [n, p] of prepSends.entries()) {
      const instr = pickMsg(p.messages, MARK.prepInstruction)
      check(`${label}：prep 第 ${n + 1} 次请求的系统提示含共同依据规则`, has(systemText(p.messages), MARK.ground), `system 长度 ${systemText(p.messages).length}`)
      check(`${label}：prep 第 ${n + 1} 次请求的指令消息本身含依据边界`, Boolean(instr) && has(instr.text, MARK.ground), instr ? `指令长度 ${instr.text.length}` : '没找到指令消息')
    }
    // 末轮：预算提醒**真的随最后一次请求发出**，且带上了依据边界；
    // 前面的请求不得出现它（否则就变成"每轮都在催"）。
    {
      const counts = prepSends.map((p) => (p.messages || []).filter((m) => has(m.text, MARK.prepLastRound)).length)
      const expected = counts.map((_, i) => (i === prepSends.length - 1 ? 1 : 0))
      check(
        `${label}：预算提醒只出现在最后一次 prep 请求（共 ${prepSends.length} 次往返）`,
        prepSends.length === 3 && JSON.stringify(counts) === JSON.stringify(expected),
        `各次提醒条数=${JSON.stringify(counts)}，期望=${JSON.stringify(expected)}`,
      )
      const lastReminder = pickMsg((prepSends[prepSends.length - 1] || {}).messages, MARK.prepLastRound)
      check(`${label}：末轮提醒里也写了依据边界（时间紧不补事实）`, Boolean(lastReminder) && has(lastReminder.text, MARK.prepLastRoundGround), lastReminder ? `提醒长度 ${lastReminder.text.length}` : '没找到提醒')
    }

    // G3 过度阻断对照：共同规则必须是"生成合同"，不能退化成关键词封禁。
    // 边界（如实标注）：这仍是**文本层**的对照——它证明规则本身没有过度阻断口径，
    // **不证明**模型在正向材料下真的会保留承诺（那是语义，本轮未验）。
    {
      const sys0 = systemText((prepSends[0] || {}).messages)
      const hit = MARK.g3KeywordHack.filter((w) => has(sys0, w))
      check(`${label}：共同规则保留了正向授权（连接语与普通建议照常写）`, has(sys0, MARK.g3PositiveAllowed), '')
      check(`${label}：共同规则不是"见到承诺就删/封"式口径（查一组措辞）`, hit.length === 0, `命中=${JSON.stringify(hit)}`)
      check(`${label}：共同规则明确不要为缺项反复追问`, has(sys0, MARK.g3NoEndlessAsking), '')
      check(`${label}：共同规则允许省略非必要缺项（不是"缺任何字段都不成稿"）`, has(sys0, MARK.g3OmitAllowed), '')
    }

    // 续改（G2b）：正式稿回读、权威范围限定、素材保持约束都在**实际消息**里
    if (c.priorDoc) {
      const prepSys = systemText(((r.snap.prepSends || [])[0] || {}).messages)
      check(`${label}：续改实参带上了当前正式稿`, has(prepSys, MARK.priorDocHeading) && has(prepSys, c.priorDoc.source.split('\n')[0]), '')
      check(`${label}：续改实参限定了「权威」只指版本与素材引用`, has(prepSys, MARK.priorAuthorityLimit), '')
      check(`${label}：续改实参仍要求保持既有素材引用`, has(prepSys, MARK.priorAssetKeep), '')
      check(`${label}：续改实参把上一版的未给依据规则保留为原文（不静默删除、不加占位）`, has(prepSys, '续借不受影响') && !has(prepSys, '待确认'), '')
    }

    const streams = r.snap.streams || []
    const write = streams.find((s) => s.turn === 'write')
    const revise = streams.find((s) => s.turn === 'revise')
    if (c.write) {
      check(`${label}：compose 路径确实发出了 write 请求`, Boolean(write), `streamTurns=${JSON.stringify(r.snap.streamTurns || [])}`)
      if (write) {
        check(`${label}：WRITE 的系统提示含共同依据规则`, has(systemText(write.messages), MARK.ground), '')
        check(`${label}：WRITE 的 digest 不再笼统让位给知识库`, !has(lastText(write.messages), MARK.digestOld) && has(lastText(write.messages), MARK.digestNew), `追加速度 ${lastText(write.messages).length}`)
        check(`${label}：WRITE 的追加指令（最后一条消息）含材料依据边界`, has(lastText(write.messages), MARK.ground), '')
      }
    } else {
      check(`${label}：candidate 路径不发起撰写请求`, !write, `streamTurns=${JSON.stringify(r.snap.streamTurns || [])}`)
    }
    if (revise) {
      check(`${label}：REVISE 的系统提示含共同依据规则`, has(systemText(revise.messages), MARK.ground), '')
      check(`${label}：REVISE 的追加指令含"只修所列问题、不新增运营规则"`, has(lastText(revise.messages), MARK.reviseNoNewRules), '')
      check(`${label}：REVISE 的"保留已澄清事实"已限定为用户材料/确认`, has(lastText(revise.messages), MARK.reviseKeep), '')
    } else {
      check(`${label}：本回合确实进入了自动修订`, false, `streamTurns=${JSON.stringify(r.snap.streamTurns || [])}`)
    }
  }
  run.executionComplete = run.executedCases.length === run.plannedCases.length
}

function finalize() {
  const hasFail = run.checks.some((c) => !c.pass)
  if (run.blockedReason) run.status = 'BLOCKED'
  else if (run.errors.length) run.status = 'ERROR'
  else if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'completeness', message: `计划 ${run.plannedCases.length} 个用例，实际执行 ${run.executedCases.length} 个` })
  } else if (run.checks.length === 0) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'checks', message: '零条检查：不能算通过' })
  } else if (hasFail) run.status = 'FAIL'
  else run.status = 'PASS'
  run.finishedAt = new Date().toISOString()
  mkdirSync(outDir, { recursive: true })
  const passed = run.checks.filter((c) => c.pass).length
  writeFileAtomic(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  writeFileAtomic(
    join(outDir, 'result.md'),
    `# 真实 App 实参截获（F1 材料依据边界）\n\n状态：**${run.status}**（executionComplete=${run.executionComplete}，检查 ${passed}/${run.checks.length} 通过）\n` +
      `时间：${run.startedAt} → ${run.finishedAt}\n入口：\`node scripts/app-message-grounding-check.mjs ${outDirArg || '(默认)'} ${base}\`\n` +
      `被测：真实 App（React 组件 + \`turn()\` + 交付门禁）+ \`src/lib/chat.ts\` 通道替身（受控夹具，非原响应回放）\n` +
      `源码哈希：\`${JSON.stringify(run.sourceHashes)}\`\n\n` +
      (run.errors.length ? `## 错误\n\n${run.errors.map((e) => `- [${e.stage}] ${e.message}`).join('\n')}\n\n` : '') +
      `\`\`\`\n${run.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} - ${c.id}${c.evidence.filter(Boolean).length ? ' (' + c.evidence.filter(Boolean).join(' / ') + ')' : ''}`).join('\n')}\n\`\`\`\n`,
  )
  console.log('')
  console.log(`  产出留档：${outDir}`)
  console.log(`APP-MESSAGE-GROUNDING ${run.status}`)
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}

finalize()
