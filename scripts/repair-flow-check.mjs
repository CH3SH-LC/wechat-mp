// repair-flow-check.mjs —— 「自动修复的事实保护」在**真实 App** 上的回归（DS 修复指南 包 A / 包 B）
//
// 用法：
//   node scripts/repair-flow-check.mjs [outDir] [URL]
//     outDir 缺省 docs/artifacts/<当天日期>-repair-flow/（独立日期目录，不覆盖历史证据）
//     URL    缺省 http://127.0.0.1:1420（需先起 dev server）
//
// 为什么必须有这个脚本：`repair-integrity-check` 只打纯函数，纯函数再绿也证明不了
// **App 把它接上了**——上一轮的真实缺陷恰恰是"纯函数全部正确、App 两轮都传 body=null"，
// 结果删掉日期/时间/地点/张老师/人数的修订稿照样以"成品已验收并保存"收尾。
// 本脚本因此把一个受控模型输出喂进**真实 App**，只替换模型这一段，然后断言业务结果：
//   ① 首稿含违规 emoji → 确实进入自动修订（模型被调用两次）；
//   ② App 真的执行了正文保留比较（trace 里出现 bodyApplicability='applied'，不是"没查"）；
//   ③ 丢事实的修订稿 **不得** 被标成成品；
//   ④ 只删 emoji、事实全留的修订稿 **必须** 通过并被标成成品（正反对照，排除"所有修订都失败"的假绿）；
//   ⑤ 全程没有外链请求、没有页面异常。
//
// DS 修复指南（2026-09-30）包 B 追加的三个**单项事实**反例（每个都单独成例，不用"整段删光"
// 掩盖单项漏检；也不允许由其它缺失互相掩护）：
//   ⑮ place-only-loss   仅删「在东区操场」        → 首稿必须真的抽到 `东区操场`，修订必须被拦；
//   ⑯ ampm-changed      上午 8 点 30 分 → 下午 8 点 30 分 → 时段参与规范化后必须被拦；
//   ⑰ inline-phone-loss 删除行内代码里的电话      → 正文投影保留作者可见代码文本后必须被拦。
// 以及两个必须继续通过的正例：行内代码电话保留、独立 emoji 段落删除。
//
// 被测实现与源码指纹一并记录；输出写入独立目录。
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { parseRunnerArgs } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

/**
 * 唯一判定结果（指南 §3.1）：stdout / JSON / Markdown / 退出码全部由它派生。
 * 异常 → ERROR，缺依赖 → BLOCKED，零检查 / 执行不完整 → ERROR；不靠 `failed === 0` 推导成功。
 */
const run = {
  script: 'repair-flow-check',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED',
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [],
  errors: [],
  blockedReason: null,
}
const LOG = []
const check = (name, ok, extra = '') => {
  const line = `  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`
  console.log(line)
  LOG.push(line)
  run.checks.push({ id: name, pass: Boolean(ok), evidence: extra ? [String(extra)] : [] })
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[repair-flow-check] ERROR@${stage}: ${message}`)
}
function statusOf() {
  if (run.blockedReason) return 'BLOCKED'
  if (run.errors.length) return 'ERROR'
  if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) return 'ERROR'
  if (run.checks.length === 0) return 'ERROR'
  return run.checks.some((c) => !c.pass) ? 'FAIL' : 'PASS'
}

/**
 * 输出目录：**每次必须新目录**（指南 §3.2 末段）。
 * 显式传入时拒绝覆盖已存在且非空的目录——避免"重跑一次就把上一轮证据盖掉"。
 */
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function uniqueDir(prefix) {
  return join('docs', 'artifacts', `${localDate()}-${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)
}
const { outDir: outDirArg, base } = parseRunnerArgs()
const outDir = outDirArg || uniqueDir('repair-flow')
// 显式指定目录时：里面已经有本轮结果就拒绝覆盖（不把上一轮证据当本次通过）
if (outDirArg && existsSync(join(outDir, 'result.md'))) {
  die(`输出目录已存在同名结果，拒绝覆盖：${outDir}（每次跑必须一个新目录）`)
}
mkdirSync(outDir, { recursive: true })


const CONFIG_HINT = `配置方法（与 verify-ui.mjs 同一口径）：
  export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
  export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"`
function die(msg) {
  console.error(`\n[repair-flow-check] 无法开始验证：${msg}\n\n${CONFIG_HINT}\n`)
  run.blockedReason = msg
  fail('deps', msg)
  finalizeAndExit(2)
}

/**
 * 收尾：把唯一判定结果落盘（run-result.json），退出码只由 status 决定。
 * 必须能被"依赖缺失"这条早退路径调用——所以它对 outDir 做了兜底，不依赖主流程走到哪一步。
 */
function finalizeAndExit(code) {
  run.status = statusOf()
  run.finishedAt = new Date().toISOString()
  let dir = ''
  try {
    dir = outDir
    mkdirSync(dir, { recursive: true })
  } catch {
    dir = join(process.env.TEMP || process.env.TMP || '.', 'repair-flow-blocked')
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      /* 连临时目录都写不了：只在 stdout 报告，不再抛 */
    }
  }
  try {
    writeFileSync(join(dir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  } catch {
    /* 落盘失败不改变退出码语义 */
  }
  console.log('')
  if (dir) console.log(`  产出留档：${dir}`)
  console.log(`REPAIR-FLOW ${run.status}`)
  process.exit(code)
}
function resolvePlaywright() {
  try {
    return require('playwright')
  } catch (e) {
    const p = process.env.VERIFY_PLAYWRIGHT
    if (!p) die(`解析不到 playwright：require 失败（${String(e.message || e).split('\n')[0]}），且未设置 VERIFY_PLAYWRIGHT`)
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return require(target)
    } catch (e2) {
      die(`VERIFY_PLAYWRIGHT=${target} 仍解析失败：${String(e2.message || e2).split('\n')[0]}`)
    }
  }
}
function resolveChromium() {
  const p = process.env.VERIFY_CHROMIUM
  if (!p) return null
  const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
  if (!existsSync(target)) die(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
  return target
}
const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromium()


const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

// ---- 受控模型输出（**只用合成短文，不含任何真实作品/凭据**） ----
const FACTS = '活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。'
const HEAD = '[[theme:校园]]\n\n## 新生见面会\n\n'
const TAME = '\n\n欢迎同学参加活动，请提前了解集合安排。'
const TAME_EMOJI = '\n\n欢迎同学参加活动🎉，请提前了解集合安排。'
const PHONE_INITIAL = `${HEAD}联系电话：\`010-55556666\`。${TAME_EMOJI}`
const wrap = (s) => '已按要求写好。\n\n```v2\n' + s + '\n```'

const CASES = [
  {
    name: 'facts-lost',
    want: 'blocked',
    prompt: '直接写一篇校园风的新生见面会短通知，保留活动日期9 月 1 日、时间8 点 30 分、地点东区操场、负责老师张老师和100名新生等事实，不需要配图。',
    initial: `${HEAD}${FACTS}${TAME_EMOJI}`,
    revision: `${HEAD}欢迎同学参加活动，请提前了解集合安排。`,
    mustExtract: [
      { kind: 'date', text: '9 月 1 日' },
      { kind: 'time', text: '上午8 点 30 分' },
      { kind: 'place', text: '东区操场' },
      { kind: 'name', text: '张老师' },
      { kind: 'number', text: '100名' },
    ],
    mustKeep: ['9 月 1 日', '8 点 30 分', '东区操场', '张老师', '100名'],
  },
  {
    name: 'facts-preserved',
    want: 'accepted',
    prompt: '直接写一篇校园风的新生见面会短通知，保留活动日期9 月 1 日、时间8 点 30 分、地点东区操场、负责老师张老师和100名新生等事实，不需要配图。',
    initial: `${HEAD}${FACTS}${TAME_EMOJI}`,
    revision: `${HEAD}${FACTS}${TAME}`,
    mustExtract: [{ kind: 'place', text: '东区操场' }],
    mustKeep: ['9 月 1 日', '8 点 30 分', '东区操场', '张老师', '100名'],
  },
  {
    // 指南 §4.1 反例 1：**仅**删除地点短语（其它事实逐字保留）
    name: 'place-only-loss',
    want: 'blocked',
    prompt: '把这句里的地点去掉，其它事实一个字都别改。',
    initial: `${HEAD}${FACTS}${TAME_EMOJI}`,
    revision: `${HEAD}活动于9 月 1 日上午8 点 30 分举行，负责接待的是张老师，预计100名新生参加。${TAME}`,
    mustExtract: [{ kind: 'place', text: '东区操场' }],
    mustKeep: [],
  },
  {
    // 指南 §4.1 反例 2：**仅**把上午改成下午（"下午 8 点 30 分" = 20:30，与 08:30 不同）
    name: 'ampm-changed',
    want: 'blocked',
    prompt: '把上午改成下午，其它内容不动。',
    initial: `${HEAD}${FACTS}${TAME_EMOJI}`,
    revision: `${HEAD}活动于9 月 1 日下午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。${TAME}`,
    mustExtract: [{ kind: 'time', text: '上午8 点 30 分' }],
    mustKeep: [],
  },
  {
    // 指南 §4.1 反例 3：删除**以行内代码展示**的电话（作者可见文本，不是内部实现）
    name: 'inline-phone-loss',
    want: 'blocked',
    prompt: '电话先不写了，改成"请见后续通知"。',
    initial: PHONE_INITIAL,
    revision: `${HEAD}联系电话请见后续通知。${TAME}`,
    mustExtract: [{ kind: 'phone', text: '010-55556666' }],
    mustKeep: [],
  },
  {
    // 正例：行内代码电话原样保留 → 必须仍然通过（防"一律拦死"的过修）
    name: 'inline-phone-preserved',
    want: 'accepted',
    prompt: '把欢迎语里的 emoji 去掉，电话保留原样。',
    initial: PHONE_INITIAL,
    revision: `${HEAD}联系电话：\`010-55556666\`。${TAME}`,
    mustExtract: [{ kind: 'phone', text: '010-55556666' }],
    mustKeep: ['010-55556666'],
  },
  {
    // 正例：删掉**独立成段**的 emoji（不是作者事实）→ 必须通过
    name: 'standalone-emoji-preserved',
    want: 'accepted',
    prompt: '删掉最后单独一行的 emoji，正文事实不动。',
    initial: `${HEAD}${FACTS}\n\n🎉`,
    revision: `${HEAD}${FACTS}`,
    mustExtract: [{ kind: 'place', text: '东区操场' }],
    mustKeep: ['东区操场', '张老师', '100名'],
  },
  {
    // §4.3 第 7 行：**有效无事实正文**必须能正常验收。
    // "正文里没有数字/地点/电话" ≠ "投影失败"——它只是没有需要保护的事实。
    // 首稿带 emoji 触发一轮自动修订，修订稿仍然没有受保护事实，必须 accepted 而不是被阻断。
    // `wantNoFacts` 是这条用例的**可证伪点**：如果抽取器开始把普通词产成事实（历史真出现过
    // `感谢老师` → name:感谢老师 这类假事实），这里会立刻变红。
    name: 'no-protected-facts-accepted',
    want: 'accepted',
    wantNoFacts: true,
    prompt: '直接写一篇校园风短通知，标题保持「新生见面会」，说明本期栏目主题是春游随笔，不涉及日期、地点、电话或人数，不需要配图。',
    initial: `${HEAD}本期栏目主题是春游随笔，欢迎投稿。${TAME_EMOJI}`,
    revision: `${HEAD}本期栏目主题是春游随笔，欢迎投稿。${TAME}`,
    mustExtract: [],
    mustKeep: ['春游随笔'],
  },
]

const evidence = {
  createdAt: new Date().toISOString(),
  outDir,
  base,
  scope:
    '真实 App（浏览器 mock 模式）+ 受控模型输出。只替换 sendChatMock 这一段；质量判定、候选循环、落库全部走生产实现。不联网、不调模型、不写真实工作区。',
  sourceHashes: {},
  cases: [],
}
for (const rel of ['src/App.tsx', 'src/lib/delivery-quality.ts', 'src/lib/compose.ts', 'src/lib/prep.ts']) {
  evidence.sourceHashes[rel] = sha256(join(repoRoot, rel))
}

const browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
run.plannedCases = CASES.map((c) => c.name)
try {
  for (const c of CASES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
    const page = await context.newPage()
    const pageErrors = []
    const offsiteRequests = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.route('**/*', async (route) => {
      const u = route.request().url()
      if (u.startsWith(base + '/') || u.startsWith('data:') || u.startsWith('blob:')) return route.fallback()
      offsiteRequests.push(u)
      return route.abort('blockedbyclient')
    })
    // 只替换"模型"这一段：首轮给 initial，自动修订轮给 revision
    await page.route('**/src/lib/chat.ts*', async (route) => {
      const response = await route.fetch()
      const actual = await response.text()
      const injected =
        actual +
        `\n// 仅测试注入：替换 sendChatMock（模型输出段），App 实现不变。\n` +
        `sendChatMock = function(messages, onDelta, onDone) {\n` +
        `  const last = [...messages].reverse().find(x => x.role === 'user');\n` +
        `  const phase = String(last?.content || '').includes('【自动质检】') ? 'revise' : 'write';\n` +
        `  const response = phase === 'revise' ? ${JSON.stringify(wrap(c.revision))} : ${JSON.stringify(wrap(c.initial))};\n` +
        `  (window.__probeCalls ||= []).push({ phase, response });\n` +
        `  let stopped = false;\n` +
        `  const timer = window.setTimeout(() => { if (!stopped) { onDelta(response); window.setTimeout(() => { if (!stopped) onDone?.(); }, 30); } }, 30);\n` +
        `  return { cancel: () => { stopped = true; window.clearTimeout(timer); } };\n` +
        `};\n`
      await route.fulfill({ response, body: injected, contentType: 'application/javascript' })
    })
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.waitForSelector('textarea')
    // 先装观察器：气泡可能在几十毫秒内出现又消失（注入的 mock 只延迟 30ms），
    // 结束时再回头看 DOM 会看不到它——"从没出现过"与"已经结束"必须可区分（指南 §3.1）。
    await page.evaluate(() => {
      window.__paneProbe = { started: 0, finished: 0, sawBubble: false }
      const tick = () => {
        const has = !!document.querySelector('.work-bubble')
        if (has && !window.__paneProbe.sawBubble) {
          window.__paneProbe.sawBubble = true
          window.__paneProbe.started++
        } else if (!has && window.__paneProbe.sawBubble) {
          window.__paneProbe.sawBubble = false
          window.__paneProbe.finished++
        }
      }
      new MutationObserver(tick).observe(document.body, { childList: true, subtree: true, attributes: true })
      window.__paneProbe.timer = window.setInterval(tick, 50)
    })
    await page.locator('textarea').fill(c.prompt)
    await page.locator('textarea').press('Enter')
    // ① 本轮 run 真的**开始**了：模型被调用过（注入的 mock 记了 __probeCalls）、工作气泡出现过。
    //    超时必须是 `waitForFunction(fn, arg, options)` 的第三个参数——写在第二位会被当成 arg 忽略掉，
    //    实际走 Playwright 默认超时（旧实现踩的就是这个）。
    await page.waitForFunction(() => (window.__probeCalls || []).length >= 1, null, { timeout: 30000 })
    await page.waitForFunction(() => window.__paneProbe.started > 0, null, { timeout: 30000 })
    // ② 同一 run **终结**：气泡结束 + trace 里出现本轮的落定记录（提交 / 存草稿 / 保存失败）。
    //    只等"气泡不存在"是不够的——它会把"还没开始"和"已经结束"当成同一件事，也会在落库完成前
    //    就去读文档状态（指南 §3.1）。
    await page.waitForFunction(() => window.__paneProbe.finished > 0, null, { timeout: 120000 })
    await page.waitForFunction(
      async () => {
        const { traceBuffer } = await import('/src/lib/trace.ts')
        return traceBuffer().some(
          (t) => (t.kind === 'run' && (t.stage === 'commit' || t.stage === 'persist')) || (t.stage === 'persist' && t.ok === false),
        )
      },
      null,
      { timeout: 60000 },
    )
    await page.waitForTimeout(800)

    const state = await page.evaluate(async () => {
      const { traceBuffer } = await import('/src/lib/trace.ts')
      const { bodyIntegrity, issuesFromBody, deliveryVerdict, bodyText, extractFacts } = await import(
        '/src/lib/delivery-quality.ts'
      )
      const { composeMarkdown } = await import('/src/lib/compose.ts')
      const strip = (s) => String(s || '').replace(/```v2\n?/, '').replace(/\n?```\s*$/, '')
      const sessions = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}')
      const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}')
      const doc = docs.docs?.[sessions.current] || null
      const trace = traceBuffer()
      const calls = window.__probeCalls || []
      // 独立复算：对同一份修订稿直接跑生产门禁（唯一判定口径），用来和 App 的结论交叉核对
      const baseHtml = composeMarkdown(strip(calls[0]?.response), {}).html
      const revHtml = composeMarkdown(strip(calls.at(-1)?.response), {}).html
      const baseText = bodyText(baseHtml)
      const direct = bodyIntegrity(baseText, bodyText(revHtml))
      const directVerdict = deliveryVerdict(issuesFromBody(direct), { htmlOk: true, body: direct, bodyApplicability: 'applied' })
      return {
        calls: calls.map((x) => x.phase),
        trace,
        doc: doc ? { accepted: doc.accepted, validation: doc.validation, revisionId: doc.revisionId, source: doc.source, html: doc.html } : null,
        ui: {
          docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state'),
          strip: document.querySelector('.quality-strip')?.textContent || '',
        },
        control: {
          // 首稿真正抽到了哪些受保护事实（指南 §4.3：先证明"抽得出来"，才谈得上"漏没漏")
          baseFacts: extractFacts(baseText).map((f) => `${f.kind}:${f.text}`),
          directFacts: direct.factsMissing.map((f) => f.kind + ':' + f.text),
          directVerdictOk: directVerdict.ok,
          directBlockers: directVerdict.blockers.map((b) => b.code),
        },
      }
    })

    await page.screenshot({ path: join(outDir, c.name + '.png'), fullPage: true })
    writeFileSync(join(outDir, c.name + '.json'), JSON.stringify({ ...state, pageErrors, offsiteRequests }, null, 2) + '\n')
    writeFileSync(join(outDir, c.name + '-saved-source.md'), state.doc?.source || '', 'utf8')

    const bodyApplied = state.trace.filter((t) => t.bodyApplicability === 'applied')
    const bodyNA = state.trace.filter((t) => t.bodyApplicability === 'not-applicable')
    // §4.2：投影必须来自 **compose 的作者节点**，而不是 `legacy-html` 那条弱化回退。
    // 这条断言的可证伪性在于：把 App 的 `projectionFrom(authorUnits, html)` 换回
    // `bodyText(html)`（或让 authorUnits 传 null），note 里就会出现 legacy-html 而不再是 投影=ok。
    const qualityNotes = state.trace.filter((t) => t.kind === 'quality').map((t) => String(t.note || ''))
    const authorProjectionUsed = qualityNotes.some((n) => n.includes('投影=ok')) && !qualityNotes.some((n) => n.includes('legacy-html'))
    const storedHasFacts = c.mustKeep.every((f) => String(state.doc?.source || '').includes(f))
    const extractedOk = c.mustExtract.every((f) => state.control.baseFacts.includes(`${f.kind}:${f.text}`))
    const result = {
      name: c.name,
      want: c.want,
      calls: state.calls,
      accepted: state.doc?.accepted === true,
      docState: state.ui.docState,
      bodyApplied: bodyApplied.length,
      bodyNotApplicable: bodyNA.length,
      baseFacts: state.control.baseFacts,
      extractedOk,
      directFactsMissing: state.control.directFacts,
      directVerdictOk: state.control.directVerdictOk,
      directBlockers: state.control.directBlockers,
      storedHasFacts,
      pageErrors: pageErrors.length,
      offsiteRequests,
    }
    evidence.cases.push(result)
    run.executedCases.push(c.name)
    console.log(`\n[${c.name}] ${JSON.stringify(result)}`)

    check(`${c.name}：首稿确实进入了自动修订（模型被调用 2 次）`, state.calls.length === 2 && state.calls[1] === 'revise', `calls=${state.calls.join(',')}`)
    check(
      `${c.name}：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied）`,
      bodyApplied.length >= 1,
      `applied=${bodyApplied.length} not-applicable=${bodyNA.length}`,
    )
    check(
      `${c.name}：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退）`,
      authorProjectionUsed,
      qualityNotes.join(' | ').slice(0, 220),
    )
    if (c.wantNoFacts) {
      // 这条是把"有效无事实正文"与"投影失败"分开的落点：没有受保护事实仍然要 accepted。
      check(
        `${c.name}：确认正文里**确实没有**受保护事实（否则这条用例测的不是它）`,
        state.control.baseFacts.length === 0,
        `实抽=${state.control.baseFacts.join(' / ') || '（无）'}`,
      )
      check(
        `${c.name}：投影仍是 ok（不是 failed/empty），无事实不等于投影失败`,
        qualityNotes.some((n) => n.includes('投影=ok')) && !qualityNotes.some((n) => n.includes('投影=failed')),
        qualityNotes.join(' | ').slice(0, 220),
      )
    }
    check(`${c.name}：全程无外链请求`, offsiteRequests.length === 0, offsiteRequests.join(' / '))
    check(`${c.name}：全程无页面异常`, pageErrors.length === 0, pageErrors.join(' / '))
    // 只在**声明了要抽的事实**时才断言这一条：`mustExtract` 为空时 `every()` 恒真，
    // 留着它就是一条永远绿的断言（这个仓库反复踩过的坑）。"没有事实"那一类用例由
    // 下面的 `wantNoFacts` 单独断言，语义更准确。
    if (c.mustExtract.length > 0) {
      check(
        `${c.name}：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"）`,
        extractedOk,
        `期望=${c.mustExtract.map((f) => f.kind + ':' + f.text).join(' / ')}；实抽=${state.control.baseFacts.join(' / ')}`,
      )
    }
    if (c.want === 'blocked') {
      check(
        `${c.name}：丢事实的修订稿**没有**被标成成品`,
        state.doc?.accepted !== true && state.ui.docState !== 'accepted',
        `accepted=${state.doc?.accepted} docState=${state.ui.docState}`,
      )
      check(
        `${c.name}：独立复算同样判不通过（App 结论与生产判定一致）`,
        state.control.directVerdictOk === false && state.control.directFacts.length > 0,
        `directVerdictOk=${state.control.directVerdictOk} 缺失=${state.control.directFacts.join(' / ')}`,
      )
    } else {
      check(
        `${c.name}：保留事实的修订稿**被**接受为成品`,
        state.doc?.accepted === true && state.ui.docState === 'accepted',
        `accepted=${state.doc?.accepted} docState=${state.ui.docState}`,
      )
      check(`${c.name}：落盘源文保留全部指定事实`, storedHasFacts, `source=${String(state.doc?.source || '').slice(0, 60)}`)
      check(`${c.name}：独立复算同样判通过（正反对照成立）`, state.control.directVerdictOk === true, JSON.stringify(state.control.directBlockers))
    }
    await context.close()
  }
} catch (e) {
  // 任何未预期的异常都必须**被记录下来**：只把状态改成 ERROR、errors 空着，
  // 负向回归就查不出"失败在哪一步"（实测被 runner-negative-check 抓到）。
  fail('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
} finally {
  run.executionComplete = run.executedCases.length === run.plannedCases.length
  run.status = statusOf()
  writeFileSync(join(outDir, 'evidence-summary.json'), JSON.stringify(evidence, null, 2) + '\n')
  writeFileSync(
    join(outDir, 'result.md'),
    `# 自动修复事实保护 —— 真实 App 回归\n\n状态：**${run.status}**（检查 ${run.checks.filter((c) => c.pass).length}/${run.checks.length} 通过；计划 ${run.plannedCases.length} / 执行 ${run.executedCases.length}）\n\n` +
      `时间：${evidence.createdAt}\n入口：\`node scripts/repair-flow-check.mjs ${outDir} ${base}\`\n\n` +
      `被测源码指纹：\n\n\`\`\`json\n${JSON.stringify(evidence.sourceHashes, null, 2)}\n\`\`\`\n\n` +
      `\`\`\`\n${LOG.join('\n')}\n\`\`\`\n`,
    'utf8',
  )
  writeFileSync(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  await browser.close()
}
finalizeAndExit(run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1)
