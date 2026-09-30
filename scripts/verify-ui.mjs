// verify-ui.mjs —— 纯浏览器模式端到端冒烟（第 2 轮扩展）
// 场景1: 示例→流式→预览渲染→质量检查通过(q-ok)
// 场景2: 违规演示→质量检查检出问题(q-fail, 问题清单展示)
// 用法: node scripts/verify-ui.mjs [outDir] [URL]
//   outDir 缺省为 docs/artifacts/<当天日期>-e2e/（独立日期目录，绝不覆盖历史证据与 README 配图）
//
// 运行依赖（2026-09-29 改）：不再硬编码作者机器的绝对路径。
//   playwright 模块：先按常规 require('playwright')，再退到环境变量 VERIFY_PLAYWRIGHT（模块路径/入口）；
//   chromium 可执行文件：环境变量 VERIFY_CHROMIUM（不设则由 playwright 自己找已安装的浏览器）。
//   两者都拿不到时**明确报错退出（非 0）**——"因为找不到浏览器所以跳过"是最危险的假绿，绝不能做。
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult（status/checks/errors）→ run-result.json + 退出码。
//   本脚本有 60 多处内联的 `console.log(\`  PASS/FAIL - …\`)`，逐条改调用点风险更大，
//   所以总数按**实际打印出来的结论行**统计（tapCheckLines）：零条结论行 = 没有断言被执行 = ERROR，
//   而不是"failed===0 所以 OK"。缺依赖（playwright/chromium）= BLOCKED，异常 = ERROR，都退出非 0。
import { createRequire } from 'module'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { createJudge, guardCrashes, parseRunnerArgs, tapCheckLines } from './lib/run-result.mjs'
const require = createRequire(import.meta.url)
// 本脚本所在目录（scripts/）：S19 的结构断言要读 src/ 下的源码文本
const here = dirname(fileURLToPath(import.meta.url))

// T10：默认输出目录原来是 `docs/artifacts`——脚本按**固定文件名**写盘（wxmp-desktop-ok.png 等），
// 于是每跑一次 E2E 就覆盖 README 里声明为"2026-09 发布阶段、非本轮运行截图"的那几张配图，
// 证据边界声明不断被破坏（docs/artifacts/README.md 已写明"新验证使用独立日期输出目录"）。
// 现在默认写到按当天日期生成的独立目录；要写别处仍可用第一个参数显式指定。
//
// 注意：**必须在解析 playwright 之前**建好判定器与输出目录——缺依赖那条早退路径（die）也要落盘 ERROR/BLOCKED。
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// 统一解析：位置参数与 `--out <dir>` 都认，且**判定目录、截图目录、报告目录是同一个值**。
// 之前这里原样吃 `process.argv[2]`：传 `--out <dir>` 时判定结果去了对的地方，
// 而 `mkdirSync(outDir)` 与所有 `page.screenshot({path: outDir + ...})` 会写进一个叫 `--out/` 的目录。
const { outDir: argOutDir, base: argBase } = parseRunnerArgs()
const outDir = argOutDir || `docs/artifacts/${localDate()}-e2e`
const url = argBase
const errors = []
const judge = createJudge({ script: 'verify-ui', outDir })
guardCrashes(judge)
tapCheckLines(judge)
// 计划场景（指南 §3.1「计划场景执行完整」）：每个场景都必须在 stdout 里留下至少一条结论行。
// 某个场景被条件静默跳过（既不 PASS 也不 FAIL）→ 执行不完整 → ERROR，而不是"没报错就是通过"。
// 这串标记就是各场景检出行 id 的前缀（`  PASS - S25 …`），在 2026-09-30 的完整跑里逐条核过。
const PLANNED_SCENARIOS = [
  'S1 ', 'S1.5 ', 'S1.6 ', 'S1.7 ', 'S1.8 ', 'S1.9 ', 'S2 ', 'S7 ', 'S8 ', 'S9', 'S10 ', 'S11 ', 'S12 ', 'S13 ',
  'S14 ', 'S15 ', 'S16 ', 'S17 ', 'S18 ', 'S19 ', 'S20 ', 'S21 ', 'S22 ', 'S23 ', 'S24 ', 'S25 ',
]
judge.setPlanned(PLANNED_SCENARIOS)
// 目录可能不存在（日期目录每天都是新的）：显式创建，避免截图静默失败
mkdirSync(outDir, { recursive: true })

const CONFIG_HINT = `配置方法（任选其一）：
  1) 常规安装：在能解析到 playwright 的目录下运行（本仓库 devDependencies 未声明 playwright，也可 npm i -D playwright 后需 npx playwright install chromium）；
  2) 指定模块与环境（Git Bash 示例）：
       export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
       export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"
     只需 VERIFY_PLAYWRIGHT 时，浏览器交给 playwright 自己找；只有 VERIFY_CHROMIUM 时，模块仍走 require('playwright')。`

function die(msg) {
  console.error(`\n[verify-ui] 无法开始验证：${msg}\n\n${CONFIG_HINT}\n`)
  // 缺依赖/无法开始 = BLOCKED（不是"没跑过所以算通过"），退出码 2
  judge.block(msg)
  judge.finish({ exitCode: 2 })
  process.exit(2)
}

/** playwright 模块：require('playwright') → VERIFY_PLAYWRIGHT；都拿不到就报错退出（不静默跳过） */
function resolvePlaywright() {
  const tried = []
  try {
    return { mod: require('playwright'), how: "require('playwright')" }
  } catch (e) {
    tried.push(`require('playwright') → ${String(e.message || e).split('\n')[0]}`)
  }
  const p = process.env.VERIFY_PLAYWRIGHT
  if (!p) {
    tried.push('VERIFY_PLAYWRIGHT → 未设置')
  } else {
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return { mod: require(target), how: `VERIFY_PLAYWRIGHT=${target}` }
    } catch (e) {
      tried.push(`VERIFY_PLAYWRIGHT=${target} → ${String(e.message || e).split('\n')[0]}`)
    }
  }
  die(`解析不到 playwright 模块。已尝试：\n  - ${tried.join('\n  - ')}`)
}

/** chromium 可执行文件路径：只在显式设置 VERIFY_CHROMIUM 时使用；设了但不存在直接报错 */
function resolveChromium() {
  const p = process.env.VERIFY_CHROMIUM
  if (!p) return null
  const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
  if (!existsSync(target)) {
    die(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
  }
  return target
}

const { mod: playwright, how: pwHow } = resolvePlaywright()
const chromiumExe = resolveChromium()

// 样例稿的素材位数量：5 个（2 个 [[img:wide]] + 1 个 [[img:inline]] + 2 个角饰位，
// 同一份样例在 compose-check.mjs 里断言 `r.arts.length === 5`）。
// T8：这里原来是 `artImgs >= 4`，文案却写死 "five art assets"——阈值比宣称值低一档，
// 少渲染一张不会被发现，而"素材位落空"正是本项目历史上最典型的失败。
// 现在文案与阈值共用同一个常量，且阈值就是样例的真实素材位数。
const SAMPLE_ART_SLOTS = 5

console.log(`[verify-ui] playwright: ${pwHow}${chromiumExe ? ` | chromium: ${chromiumExe}` : ' | chromium: 交给 playwright 自解析'}`)

const { chromium } = playwright
let browser
try {
  browser = await chromium.launch(chromiumExe ? { executablePath: chromiumExe } : {})
} catch (e) {
  die(
    `浏览器启动失败：${String(e.message || e).split('\n')[0]}\n` +
      `  常见两种原因：①本机没装 playwright 自带浏览器（npx playwright install chromium）；\n` +
      `  ②已装浏览器与 playwright 版本不匹配（要的 build 号对不上）——用 VERIFY_CHROMIUM 直接指定 chrome.exe 可绕过。`,
  )
}
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text())
})

async function waitStreamDone(timeout = 30000) {
  await page.waitForFunction(
    () => {
      // 2026-09-28：工作气泡取代 .typing；取"最后一个"助手气泡，避免多消息时命中旧的
      const all = document.querySelectorAll('.msg-assistant-text')
      const t = all[all.length - 1]
      return !!t && t.textContent.trim().length > 3 && !document.querySelector('.work-bubble')
    },
    // 超时必须放 `waitForFunction(fn, arg, options)` 的**第三**位：写在第二位会被当成 arg 忽略，
    // 实际走 Playwright 默认超时（指南 §3.1）。
    null,
    { timeout },
  )
  await page.waitForTimeout(300)
}

// 第 29 轮：删用户可见 mock 按钮后，场景改用输入框直接发文本驱动（mock 链路仍在，语义不变）
async function sendPrompt(text) {
  await page.locator('textarea').fill(text)
  await page.locator('textarea').press('Enter')
}

// 场景跑法（S1 用）：发一条提示 → 等流结束 → 读质量条。`expectFail` 只决定等哪个类名。
// 注：S2 原先是这里的第二个调用（expectFail=true），2026-09-29 起违规稿会被修复轮替换成
// 合规成品，**不再是"红条照显示"**，故 S2 改为自己的独立断言块（见下方）。
async function runScenario(name, trigger, expectFail) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  await trigger()
  await waitStreamDone()
  const strip = page.locator(expectFail ? '.quality-strip.q-fail' : '.quality-strip.q-ok')
  const stripText = await strip.innerText().catch(() => '')
  const issues = page.locator('.q-list li')
  const nIssues = await issues.count()
  console.log(`[${name}] strip =`, stripText.replace(/\n/g, ' ').slice(0, 160))
  await page.screenshot({ path: `${outDir}/wxmp-desktop-${name}.png` })
  const checks = [
    ['quality strip shown', stripText.length > 0],
    expectFail
      ? ['fail detected (问题检出)', stripText.includes('问题') && nIssues >= 3]
      : ['pass ok (质量通过)', stripText.includes('通过')],
  ]
  return { checks, stripText, nIssues }
}

let failed = 0
const s1 = await runScenario(
  'ok',
  () => sendPrompt('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写'),
  false,
)
for (const [name, ok] of s1.checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - S1 ${name}`)
  if (!ok) failed++
}

// 第 23 轮：界面无模式/风格控件（LLM 自决）；busy 生成期文案为「正在生成…」
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  if ((await page.locator('.msg-user').count()) > 0) {
    await page.locator('[data-act="clear"]').click()
    await page.waitForSelector('.chat-empty', { timeout: 10000 })
  }
  const noStyle = (await page.locator('.style-select').count()) === 0
  const noMode = (await page.locator('.seg-btn').count()) === 0
  console.log(`  ${noStyle && noMode ? 'PASS' : 'FAIL'} - S1.9 no mode/style UI controls (styleSelect=${await page.locator('.style-select').count()})`)
  if (!noStyle || !noMode) failed++
  await sendPrompt('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  // 2026-09-28：等待期指示器由「.typing 正在生成…」升级为工作气泡（阶段标签 + 细节 + 计时）
  await page.waitForSelector('.work-bubble', { timeout: 20000 })
  const wb = await page.locator('.work-bubble').first().innerText()
  const wbLabel = await page.locator('.work-bubble .wb-label').first().innerText()
  const wbTime = await page.locator('.work-bubble .wb-time').first().innerText()
  const wbOk = /[一-龥]/.test(wbLabel) && /^\d/.test(wbTime)
  console.log(`  ${wbOk ? 'PASS' : 'FAIL'} - S1.9 working bubble shown (${wb.replace(/\n/g, ' ').slice(0, 44)})`)
  if (!wbOk) failed++
  await waitStreamDone()
} catch (e) {
  console.log('  FAIL - S1.9 controls/busy-phase error:', String(e).slice(0, 200))
  failed++
}

// S1.7 对话流净化：气泡无代码文本；「查看正文」可展开 v2 语法正文/收起
try {
  const bubble = await page.locator('.msg-assistant-text').last().innerText()
  const clean = !bubble.includes('```') && !bubble.includes('<section')
  console.log(`  ${clean ? 'PASS' : 'FAIL'} - S1.7 bubble has no code text (${bubble.slice(0, 30)}…)`)
  if (!clean) failed++
  await page.locator('.src-toggle').first().click()
  await page.waitForSelector('.src-view', { timeout: 10000 })
  const src = await page.locator('.src-view').first().innerText()
  const srcOk = src.includes('[[banner') && src.includes('::: steps')
  console.log(`  ${srcOk ? 'PASS' : 'FAIL'} - S1.7 source expand shows v2 body (${src.length} chars)`)
  if (!srcOk) failed++
  await page.locator('.src-toggle').first().click()
  await page.waitForTimeout(200)
  const collapsed = (await page.locator('.src-view').count()) === 0
  console.log(`  ${collapsed ? 'PASS' : 'FAIL'} - S1.7 source collapse works`)
  if (!collapsed) failed++
} catch (e) {
  console.log('  FAIL - S1.7 clean bubble error:', String(e).slice(0, 200))
  failed++
}

// S1.8 compose 确定性渲染：v2 正文被排版引擎渲染进 375px 预览；美术素材渲染为 data 图片
try {
  const frame = page.frames().find((f) => f !== page.mainFrame())
  const bodyTxt = frame ? await frame.locator('body').innerText() : ''
  const composed = bodyTxt.includes('新生开学典礼') && bodyTxt.includes('典礼流程') && bodyTxt.includes('记得带')
  console.log(`  ${composed ? 'PASS' : 'FAIL'} - S1.8 compose rendered in preview (${bodyTxt.length} chars)`)
  if (!composed) failed++
  const artImgs = frame ? await frame.locator('img[src^="data:image/"]').count() : 0
  const artOk = artImgs >= SAMPLE_ART_SLOTS
  console.log(`  ${artOk ? 'PASS' : 'FAIL'} - S1.8 sample ${SAMPLE_ART_SLOTS} art slots all rendered to data images (${artImgs})`)
  if (!artOk) failed++
  const bodyHtml = frame ? await frame.locator('body').innerHTML() : ''
  const themed = bodyHtml.includes('#2f6fed') && !bodyHtml.includes('[[theme')
  console.log(`  ${themed ? 'PASS' : 'FAIL'} - S1.8 campus theme colors applied in preview`)
  if (!themed) failed++
  const noSlot = frame ? !bodyHtml.includes('[[img') && !bodyHtml.includes('[[deco') : false
  console.log(`  ${noSlot ? 'PASS' : 'FAIL'} - S1.8 placeholders materialized (no [[img/[[deco in output)`)
  if (!noSlot) failed++
} catch (e) {
  console.log('  FAIL - S1.8 compose render error:', String(e).slice(0, 200))
  failed++
}

// S1.5 导出（浏览器模式 = <a download>，playwright 捕获 download 事件）
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('[data-act="export-html"]').click(),
  ])
  const fs = await import('fs')
  const buf = fs.readFileSync(await download.path())
  const text = buf.toString('utf8')
  const dlOk = download.suggestedFilename().endsWith('.html') && text.includes('<section')
  console.log(`  ${dlOk ? 'PASS' : 'FAIL'} - S1.5 export download (${download.suggestedFilename()}, ${buf.length} bytes)`)
  if (!dlOk) failed++
} catch (e) {
  console.log('  FAIL - S1.5 export download error:', String(e).slice(0, 200))
  failed++
}

// S1.6 会话恢复：等防抖存档 → 刷新 → 消息与预览仍在 → 清空 → 本地存储清空
try {
  await page.waitForTimeout(1100)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(
    () => {
      const all = document.querySelectorAll('.msg-assistant-text')
      const t = all[all.length - 1]
      return !!t && t.textContent.trim().length > 3 && !document.querySelector('.work-bubble')
    },
    null,
    // 超时值保持**原来的有效值 30s**：本次只修参数位（写在第二位会被当成 arg 忽略，
    // 实际走 Playwright 默认 30s）。实测把这里的 10s 当真执行后，S24 会因 prep 阶段的
    // 耗时波动偶发假红（停止时助手文字还是 0 字）——收紧等待不是本次改动的目的。
    { timeout: 30000 },
  )
  const userCount = await page.locator('.msg-user').count()
  const frame = page.frames().find((f) => f !== page.mainFrame())
  const body = frame ? await frame.locator('body').innerText() : ''
  // 2026-09-28：顶栏「已自动保存」小字已移除——恢复判据改为消息 + 预览本身，并断言该小字不再出现
  const saveHintCount = await page.locator('.topbar-meta .hint').count()
  const restoreOk = userCount >= 1 && body.trim().length > 40 && saveHintCount === 0
  console.log(`  ${restoreOk ? 'PASS' : 'FAIL'} - S1.6 restore after reload (userMsgs=${userCount}, body=${body.length}, saveHint=${saveHintCount})`)
  if (!restoreOk) failed++

  await page.locator('[data-act="clear"]').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}'))
  const curMsgLen = (() => {
    const cur = state.current
    return cur && state.items[cur] ? state.items[cur].messages.length : -1
  })()
  const clearOk = curMsgLen === 0
  console.log(`  ${clearOk ? 'PASS' : 'FAIL'} - S1.6 clear empties current session (msgs=${curMsgLen})`)
  if (!clearOk) failed++
} catch (e) {
  console.log('  FAIL - S1.6 restore/clear error:', String(e).slice(0, 200))
  failed++
}

// S2 违规输出 → 交付门禁阻断 → 自动修复轮 → 收敛为**已验收成品**（计划 §4/§5 新契约，2026-09-29 改）
//
// 旧契约（已作废）：违规稿只在质量条上标红，最终仍以它作为展示稿（q-fail + ≥3 条问题）。
// 新契约：当前产品规范禁止的字符与样式是**阻断项**，成品位不得被它占据——
// 引擎把问题喂回模型重写一轮，模型给出合规稿后 q-ok 且成品指针落在合规稿上。
// 这比旧断言更强：它同时证明"违规稿没成为成品"和"修复轮真的收敛了"。
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  await page.locator('textarea').fill('演示质量检查：请故意输出包含 emoji、渐变与外链图的推文（违规输出检测）')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForTimeout(800)
  const s2info = await page.evaluate(async () => {
    const frame = document.querySelector('iframe')
    const body = frame && frame.contentDocument ? frame.contentDocument.body.innerHTML : ''
    const strip = document.querySelector('.quality-strip')
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const rec = ((JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {})[cur]) || null
    const bubbles = [...document.querySelectorAll('.msg-assistant-text')]
    return {
      stripCls: strip ? strip.className : '',
      stripText: strip ? strip.innerText.replace(/\n/g, ' ') : '',
      blockers: document.querySelectorAll('[data-blocker-code]').length,
      docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state') ?? null,
      // 违规特征是否还留在**成品 HTML**里（这才是"违规稿有没有成为成品"的直接证据）
      gradient: /linear-gradient/.test(body),
      emoji: /[\u{1F300}-\u{1FAFF}]/u.test(body),
      external: /example\.com/.test(body),
      violText: body.includes('这是违规演示'),
      // 被采用的成品源文：直接读**落盘文档**的 source（权威，且不依赖 DOM 渲染形态）
      savedSource: rec ? String(rec.source || '') : '',
      hasDoc: !!rec,
      accepted: rec ? rec.accepted : null,
    }
  })
  console.log(`[S2] strip = ${s2info.stripText.slice(0, 120)}`)
  const s2ok = [
    ['交付判定为通过（违规稿被修复轮替换）', s2info.stripCls.includes('q-ok')],
    ['成品 HTML 无 linear-gradient', !s2info.gradient],
    ['成品 HTML 无 emoji', !s2info.emoji],
    ['成品 HTML 无外链图片', !s2info.external],
    ['违规文字未进入成品', !s2info.violText],
    ['文档被标为已验收成品', s2info.hasDoc && s2info.accepted === true],
    ['重写后的稿子取代了违规稿（含合规结构）', s2info.savedSource.includes('[[banner:') && s2info.savedSource.includes('::: steps')],
    ['落盘源文里也没有违规特征（源文与成品同源，不是混合版本）', !/linear-gradient|example\.com/.test(s2info.savedSource) && !s2info.savedSource.includes('这是违规演示')],
  ]
  for (const [name, ok] of s2ok) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S2 ${name}`)
    if (!ok) failed++
  }
} catch (e) {
  console.log('  FAIL - S2 违规输出/修复轮 error:', String(e).slice(0, 200))
  failed++
}

// S7 设置面板（浏览器模式 localStorage）：填入保存 → 刷新仍在 → 恢复默认清空
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.topbar-settings', { timeout: 20000 })
  await page.locator('.topbar-settings').click()
  await page.waitForSelector('.settings-panel', { timeout: 10000 })
  await page.locator('.set-key').fill('sk-e2e-123')
  await page.locator('.settings-foot .btn-send').click()
  await page.waitForSelector('.settings-msg', { timeout: 10000 })
  const savedText = await page.locator('.settings-msg').innerText()
  const lsHas = await page.evaluate(() => (localStorage.getItem('wxmp-settings-v1') || '').includes('sk-e2e-123'))
  const savedOk = savedText.includes('已保存') && lsHas
  console.log(`  ${savedOk ? 'PASS' : 'FAIL'} - S7 settings save (${savedText})`)
  if (!savedOk) failed++

  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.topbar-settings').click()
  await page.waitForSelector('.set-key', { timeout: 10000 })
  const persisted = await page.locator('.set-key').inputValue()
  const persistOk = persisted === 'sk-e2e-123'
  console.log(`  ${persistOk ? 'PASS' : 'FAIL'} - S7 settings persisted after reload (${persisted})`)
  if (!persistOk) failed++

  await page.locator('.settings-foot .mini-danger').click()
  await page.waitForTimeout(300)
  const cleared = await page.locator('.set-key').inputValue()
  const clearedOk = cleared === ''
  console.log(`  ${clearedOk ? 'PASS' : 'FAIL'} - S7 settings reset to default (${cleared})`)
  if (!clearedOk) failed++
  await page.locator('.settings-head .mini').click()
} catch (e) {
  console.log('  FAIL - S7 settings error:', String(e).slice(0, 200))
  failed++
}

// S8 多会话上下文（侧栏）：新建 → 独立内容 → 列表增长 → 切换 → 删除回退
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })

  const ensureRail = async () => {
    if ((await page.locator('.session-rail').count()) === 0) {
      await page.locator('.sess-btn').click()
    }
    await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  }
  const rowCount = () => page.locator('.session-rail .sess-row').count()

  await ensureRail()
  const n0 = await rowCount()
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })
  // 2026-09-29：新建后等列表真的多出一行，并把新会话 id 记下来——后面删它时用 data-id
  // 定位（不再靠 ".sess-row:has-text('毕业季')" 这种文案匹配）。
  await page
    .waitForFunction((n) => document.querySelectorAll('.session-rail .sess-row').length === n + 1, n0, { timeout: 10000 })
    .catch(() => {})
  const newSessionId = await page.locator('.session-rail .sess-row.sess-active').getAttribute('data-id')
  if (!newSessionId) {
    console.log('  FAIL - S8 新建会话后取不到其 data-id（后续切换/删除断言无从判定）')
    failed++
    throw new Error('S8: no data-id on newly created session row')
  }

  // 在 B 会话输入并生成（内容独立于 A）
  await page.locator('textarea').fill('写一篇毕业季活动推文，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  const userB = await page.locator('.msg-user').last().innerText()
  const bOk = userB.includes('毕业季')
  console.log(`  ${bOk ? 'PASS' : 'FAIL'} - S8 new session independent content (${userB.slice(0, 24)}…)`)
  if (!bOk) failed++
  // 2026-09-28：运行期小字（知识命中 / 注册表就绪）已从对话区移除，改为断言该区域不再出现
  const noteCount = await page.locator('.knowledge-note, .debug-note').count()
  const routeOk = noteCount === 0
  console.log(`  ${routeOk ? 'PASS' : 'FAIL'} - S8 knowledge-registry debug text removed (n=${noteCount})`)
  if (!routeOk) failed++

  const n1 = await rowCount()
  const grewOk = n1 === n0 + 1
  console.log(`  ${grewOk ? 'PASS' : 'FAIL'} - S8 session list grew (${n0} → ${n1})`)
  if (!grewOk) failed++

  // 切回最旧会话（列表倒序末位）
  // T1：原来是 `const switched = await page.locator('.msg-user').count() >= 0`——count() 返回 number，
  // 任何数字都 >= 0，这条恒真、100% PASS，哪怕点完会话界面全白。现在改成真断言：
  // 先记下目标会话的 id 与它的用户消息（从 localStorage 取，不猜），切换后断言
  // ①高亮的会话行换成了目标 ②对话区渲染出的用户消息与目标会话存的内容逐条对得上 ③新会话那条消息确实不在了。
  const targetRow = page.locator('.session-rail .sess-row').last()
  const targetId = await targetRow.getAttribute('data-id')
  const beforeActiveId = await page.locator('.session-rail .sess-row.sess-active').getAttribute('data-id')
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const targetUsers = await page.evaluate((id) => {
    const st = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}')
    const it = st && st.items ? st.items[id] : null
    const msgs = it && Array.isArray(it.messages) ? it.messages : []
    return msgs.filter((m) => m.role === 'user').map((m) => String(m.content || ''))
  }, targetId)
  const shownBefore = (await page.locator('.msg-user').allInnerTexts()).map(norm)
  await targetRow.click()
  await page
    .waitForFunction(
      (id) => {
        const el = document.querySelector('.session-rail .sess-row.sess-active')
        return !!el && el.getAttribute('data-id') === id
      },
      targetId,
      { timeout: 10000 },
    )
    .catch(() => {})
  await page.waitForTimeout(500)
  const afterActiveId = await page.locator('.session-rail .sess-row.sess-active').getAttribute('data-id')
  const shownUsers = (await page.locator('.msg-user').allInnerTexts()).map(norm)
  const targetNorm = targetUsers.map(norm)
  // 对话区内容必须与目标会话**存下来的**用户消息逐条对得上（空会话则应为空），而不是"有数字就行"
  const contentMatches =
    shownUsers.length === targetNorm.length &&
    targetNorm.every((t, i) => shownUsers[i] === t || shownUsers[i].startsWith(t.slice(0, 24)))
  // 而且内容必须真的换过（B 会话那条用户消息不能还留在屏幕上）
  const contentChanged = JSON.stringify(shownUsers) !== JSON.stringify(shownBefore)
  const switched =
    !!targetId &&
    targetId !== beforeActiveId &&
    afterActiveId === targetId &&
    contentMatches &&
    contentChanged &&
    !shownUsers.some((t) => t === norm(userB))
  console.log(
    `  ${switched ? 'PASS' : 'FAIL'} - S8 switch back ok (active ${beforeActiveId}→${afterActiveId}, target=${targetId}, 用户消息 ${shownUsers.length}/${targetNorm.length} 条对上, 内容已换=${contentChanged})`,
  )
  if (!switched) failed++

  // 删除刚建的毕业季会话（按 data-id 定位，不靠文案）
  await page.locator(`.session-rail .sess-row[data-id="${newSessionId}"] .sess-del`).click()
  await page.waitForTimeout(500)
  const n2 = await rowCount()
  const shrinkOk = n2 === n0
  console.log(`  ${shrinkOk ? 'PASS' : 'FAIL'} - S8 delete session (${n1} → ${n2})`)
  if (!shrinkOk) failed++
} catch (e) {
  console.log('  FAIL - S8 multi-session error:', String(e).slice(0, 200))
  failed++
}

// S9 通用对话（第 12 轮）：无卡片；创作模糊 → 对话反问 → 回答成文；直接写 → 不问直出；
// 闲聊 → 自然回复且不产出预览；反问后说"算了" → 取消回对话不生成
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('textarea', { timeout: 20000 })

  const ensureEmpty = async () => {
    if ((await page.locator('.msg-user').count()) > 0) {
      await page.locator('[data-act="clear"]').click()
      await page.waitForSelector('.chat-empty', { timeout: 10000 })
    }
  }
  const sendLine = async (text) => {
    await page.locator('textarea').fill(text)
    await page.locator('textarea').press('Enter')
  }
  const waitTurn = async () => {
    await page.waitForSelector('.work-bubble', { timeout: 10000 }).catch(() => {})
    await waitStreamDone()
  }
  const lastAssistantText = () => page.locator('.msg-assistant-text').last().innerText()

  const noCard = (await page.locator('.clarify-card').count()) === 0
  console.log(`  ${noCard ? 'PASS' : 'FAIL'} - S9 clarify card removed from UI`)
  if (!noCard) failed++

  // 9a 模糊创作请求：模型先在对话里反问（无 HTML/预览），回答后直接成文
  await ensureEmpty()
  await sendLine('帮我写一篇推文，主题是新书上市')
  await waitTurn()
  const q1 = await lastAssistantText()
  const asked = q1.includes('？') && !q1.includes('已生成推文')
  console.log(`  ${asked ? 'PASS' : 'FAIL'} - S9a vague create -> agent asks in chat (${q1.slice(0, 26)}…)`)
  if (!asked) failed++
  const noPreviewYet =
    (await page.locator('.quality-strip').count()) === 0 && (await page.locator('.preview-body iframe').count()) === 0
  console.log(`  ${noPreviewYet ? 'PASS' : 'FAIL'} - S9a no article/preview before answer`)
  if (!noPreviewYet) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S9a-question.png` })

  await sendLine('日系风格，800字左右')
  await waitTurn()
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 15000 })
  const nUserA = await page.locator('.msg-user').count()
  const aOk = nUserA === 2 && (await page.locator('.msg-assistant').count()) === 2
  console.log(`  ${aOk ? 'PASS' : 'FAIL'} - S9a answer -> article generated (users=${nUserA})`)
  if (!aOk) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S9a-article.png` })

  // 9b 直接写：不问，直出推文
  await ensureEmpty()
  await sendLine('写一篇咖啡店开业宣传，日系风，800字左右，直接写')
  await waitTurn()
  const bText = await lastAssistantText()
  const noAsk = !bText.includes('？')
  console.log(`  ${noAsk ? 'PASS' : 'FAIL'} - S9b direct-write no question (${bText.slice(0, 20)}…)`)
  if (!noAsk) failed++
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 15000 })
  const nUserB = await page.locator('.msg-user').count()
  console.log(`  ${nUserB === 1 ? 'PASS' : 'FAIL'} - S9b direct-write one-turn article (users=${nUserB})`)
  if (nUserB !== 1) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S9b.png` })

  // 9c 闲聊：正常对话回复，不产出推文预览
  await ensureEmpty()
  await sendLine('你好')
  await waitTurn()
  const cText = await lastAssistantText()
  const chatOk = cText.startsWith('你好') && !cText.includes('已生成推文')
  console.log(`  ${chatOk ? 'PASS' : 'FAIL'} - S9c casual chat answered naturally (${cText.slice(0, 20)}…)`)
  if (!chatOk) failed++
  const noArticleC = (await page.locator('.quality-strip').count()) === 0
  console.log(`  ${noArticleC ? 'PASS' : 'FAIL'} - S9c chat produces no article preview`)
  if (!noArticleC) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S9c.png` })

  // 9d 反问后取消：说"算了"→ 回对话，不生成
  await sendLine('帮我写一篇推文，主题是新书上市')
  await waitTurn()
  const q2 = await lastAssistantText()
  const asked2 = q2.includes('？')
  console.log(`  ${asked2 ? 'PASS' : 'FAIL'} - S9d vague again asks (${q2.slice(0, 20)}…)`)
  if (!asked2) failed++
  await sendLine('算了')
  await waitTurn()
  const dText = await lastAssistantText()
  const cancelOk = dText.includes('先不写') && (await page.locator('.quality-strip').count()) === 0
  console.log(`  ${cancelOk ? 'PASS' : 'FAIL'} - S9d cancel after question -> no article (${dText.slice(0, 20)}…)`)
  if (!cancelOk) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S9d.png` })
} catch (e) {
  console.log('  FAIL - S9 conversational error:', String(e).slice(0, 200))
  failed++
}

// S10 提示级问题**不触发重写**（计划 §4/§5 第 3 条新契约，2026-09-29 改）
//
// 旧契约（已作废）：首稿"缺组件"属于 FIXABLE_KEYS（靠中文子串匹配），会被推回模型整篇重写，
// 断言要求最终正文变成另一版合规稿。
// 新契约：**推荐性组件数量是提示，不阻断成品、也不触发修复**——§4 明列"不强迫改稿"，
// §5 第 3 条"无阻断项：进入持久化提交"。也就是说：模型给什么，用户就得到什么（标注提示），
// 引擎不会为了少几条告警把它整篇换掉。本场景改用**可证伪**的方式验证这一点：
// 半成品必须**原样**成为成品，且组件不足只作为提示出现、不进阻断清单。
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) {
    await page.locator('.sess-btn').click()
  }
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })
  await page.locator('textarea').fill('写一篇军训慰问推文（自检缺组件），直接写')
  await page.locator('textarea').press('Enter')

  let settled = false
  for (let i = 0; i < 80; i++) {
    const ok = await page.locator('.quality-strip.q-ok').count()
    const busyBubble = await page.locator('.work-bubble').count()
    if (ok > 0 && busyBubble === 0) {
      settled = true
      break
    }
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1200)
  const finalOk = (await page.locator('.quality-strip.q-ok').count()) > 0
  console.log(`  ${settled && finalOk ? 'PASS' : 'FAIL'} - S10 缺组件半成品仍判定为可交付（提示不阻断）`)
  if (!settled || !finalOk) failed++

  const nUser = await page.locator('.msg-user').count()
  const nAsst = await page.locator('.msg-assistant').count()
  const singleTurn = nUser === 1 && nAsst === 1
  console.log(`  ${singleTurn ? 'PASS' : 'FAIL'} - S10 只修改一轮、不额外起稿 (user=${nUser} asst=${nAsst})`)
  if (!singleTurn) failed++

  const s10 = await page.evaluate(() => {
    const strip = document.querySelector('.quality-strip')
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const rec = ((JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {})[cur]) || null
    // 读**落盘文档**的 source：证明"模型给什么就存什么"（而不是读 DOM 渲染形态）
    const src = rec ? String(rec.source || '') : ''
    return {
      stripText: strip ? strip.innerText.replace(/\n/g, ' ') : '',
      blockers: document.querySelectorAll('[data-blocker-code]').length,
      docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state') ?? null,
      hasDeficient: src.includes('好像比刚才又亮了几分'),
      srcLen: src.length,
      accepted: rec ? rec.accepted : null,
    }
  })
  const s10ok = [
    ['组件不足只作提示、不进阻断清单', s10.blockers === 0 && /提示/.test(s10.stripText)],
    // 用**确实存在于**缺组件半成品里的句子（旧断言用的是 "又比刚才又亮了几分"，
    // 而 mock 原文是 "好像比刚才又亮了几分" —— 那个否定式断言是恒真的假绿，这里一并纠正）
    ['模型原文**原样**成为成品（没有被静默换掉）', s10.hasDeficient === true],    ['文档标记为已验收成品', s10.accepted === true],
    ['预览标明显示的是成品', s10.docState === 'accepted'],
  ]
  for (const [name, ok] of s10ok) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S10 ${name}`)
    if (!ok) failed++
  }
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S10.png` })
} catch (e) {
  console.log('  FAIL - S10 auto-revise error:', String(e).slice(0, 200))
  failed++
}

// S11 导出图片（第 34 轮）：生成正文 → 「导出图片」触发浏览器下载长图+分页 PNG
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) {
    await page.locator('.sess-btn').click()
  }
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })
  await page.locator('textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 15000 })

  const downloads = []
  page.on('download', (d) => downloads.push(d))
  await page.locator('[data-act="export-images"]').click()
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.export-msg')
      return !!t && /已下载|转图失败/.test(t.textContent || '')
    },
    null,
    { timeout: 30000 },
  )
  await page.waitForTimeout(1500) // 等全部下载触发
  const pngFiles = downloads.filter((d) => d.suggestedFilename().endsWith('.png'))
  const msg = await page.locator('.export-msg').innerText().catch(() => '')
  const okMsg = msg.includes('已下载')
  let sizeOk = false
  if (pngFiles.length > 0) {
    const fs = require('fs')
    const first = pngFiles[0]
    const p = `${outDir}/${first.suggestedFilename()}`
    await first.saveAs(p)
    sizeOk = fs.statSync(p).size > 20000
  }
  const pngOk = pngFiles.length >= 2 && okMsg && sizeOk
  console.log(`  ${pngOk ? 'PASS' : 'FAIL'} - S11 export images downloads (png=${pngFiles.length}, size>20KB=${sizeOk}, msg=${msg.slice(0, 40)})`)
  if (!pngOk) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S11.png` })
} catch (e) {
  console.log('  FAIL - S11 export images error:', String(e).slice(0, 200))
  failed++
}

// S12 V3-R1 文档库：会话成稿默认自动保存为文档 → 顶栏切「文档库」可见 → 点开回到源会话 →
// 删除文档连带删除其会话（无幽灵文档）
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  await page.locator('.view-tab[data-view="docs"]').click()
  await page.waitForSelector('.docs-pane', { timeout: 10000 })
  const n0 = await page.locator('.doc-row').count()
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S12a-docs.png` })

  // 回对话工作台，新建会话生成一篇（内容独立）
  await page.locator('.view-tab[data-view="chat"]').click()
  await page.waitForSelector('textarea', { timeout: 10000 })
  if ((await page.locator('.session-rail').count()) === 0) {
    await page.locator('.sess-btn').click()
  }
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })
  await page.locator('textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 15000 })
  await page.waitForTimeout(800) // 等默认文档自动落盘

  await page.locator('.view-tab[data-view="docs"]').click()
  await page.waitForSelector('.docs-pane', { timeout: 10000 })
  await page.waitForFunction(
    (n) => document.querySelectorAll('.doc-row').length === n + 1,
    n0,
    { timeout: 10000 },
  )
  const n1 = await page.locator('.doc-row').count()
  const firstTitle = await page.locator('.doc-row .doc-title').first().innerText()
  const autoSaved = n1 === n0 + 1 && (firstTitle.includes('入学') || firstTitle.includes('开学'))
  console.log(`  ${autoSaved ? 'PASS' : 'FAIL'} - S12 article auto-saved as doc (rows ${n0}→${n1}, title=${firstTitle.slice(0, 20)})`)
  if (!autoSaved) failed++
  const firstId = await page.locator('.doc-row').first().getAttribute('data-id')

  // 点开该文档 → 回到其源会话（对话工作台，消息恢复、会话高亮为同一 id）
  await page.locator('.doc-row').first().click()
  await page.waitForSelector('.chat-pane', { timeout: 10000 })
  await page.waitForTimeout(500)
  const nUser = await page.locator('.msg-user').count()
  const activeId = await page
    .locator('.sess-row.sess-active')
    .getAttribute('data-id')
    .catch(() => null)
  const openOk = nUser >= 1 && activeId === firstId
  console.log(`  ${openOk ? 'PASS' : 'FAIL'} - S12 open doc returns to its session (users=${nUser}, active=${activeId})`)
  if (!openOk) failed++

  // 删除该文档 → 文档数回基线，其会话文件与文档文件都消失
  await page.locator('.view-tab[data-view="docs"]').click()
  await page.waitForSelector('.docs-pane', { timeout: 10000 })
  await page.locator('.doc-row').first().locator('.doc-del').click()
  await page.waitForTimeout(700)
  const n2 = await page.locator('.doc-row').count()
  const gone = await page.evaluate((id) => {
    const ses = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}')
    const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}')
    return !(id in (ses.items || {})) && !(id in (docs.docs || {}))
  }, firstId)
  const delOk = n2 === n0 && gone
  console.log(`  ${delOk ? 'PASS' : 'FAIL'} - S12 delete doc removes doc+session (rows ${n1}→${n2}, gone=${gone})`)
  if (!delOk) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S12b.png` })
} catch (e) {
  console.log('  FAIL - S12 doc library error:', String(e).slice(0, 200))
  failed++
}

// S13 V3-R2 素材工坊：制作气泡角饰入库 → 语义检索过滤命中 → 改名/描述保存 → 替换源 version+1 → 删除路径
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.view-tab[data-view="assets"]', { timeout: 20000 })
  await page.locator('.view-tab[data-view="assets"]').click()
  await page.waitForSelector('.ws-pane', { timeout: 10000 })
  await page.locator('.ws-cat[data-cat="bubble"]').click()
  const a0 = await page.locator('.ws-row').count()
  await page
    .locator('.ws-desc')
    .fill('右下角一朵小花的气泡角饰：浅暖色五瓣小花、花心一点金黄，其余大面积留白，用于 KEY 气泡右下角，是气泡装饰素材')
  await page.locator('.ws-make-btn').click()
  await page.waitForFunction(
    (n) => document.querySelectorAll('.ws-row').length === n + 1,
    a0,
    { timeout: 15000 },
  )
  const madeOk = (await page.locator('.ws-row').count()) === a0 + 1
  console.log(`  ${madeOk ? 'PASS' : 'FAIL'} - S13 workshop asset made & stored (rows ${a0}→${a0 + 1})`)
  if (!madeOk) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S13a-made.png` })

  // 语义检索/过滤命中（按描述里的"小花"）
  await page.locator('.ws-q').fill('小花')
  await page.waitForTimeout(300)
  const searchHits = await page.locator('.ws-row').count()
  await page.locator('.ws-q').fill('')
  console.log(`  ${searchHits >= 1 ? 'PASS' : 'FAIL'} - S13 search by desc (hits=${searchHits})`)
  if (searchHits < 1) failed++

  // 改名/描述保存（入库即可编辑语义元数据）
  await page.waitForSelector('.ws-detail', { timeout: 10000 })
  await page.locator('.ws-name').fill('flower-corner-e2e')
  await page.locator('.ws-title').fill('右下角小花气泡角饰')
  await page.locator('.ws-save').click()
  await page.waitForTimeout(600)
  const rowTitle = await page.locator('.ws-row .ws-row-title').first().innerText().catch(() => '')
  const metaOk = rowTitle.includes('右下角小花气泡角饰')
  console.log(`  ${metaOk ? 'PASS' : 'FAIL'} - S13 meta editable & saved (row=${rowTitle.slice(0, 20)})`)
  if (!metaOk) failed++

  // 替换 SVG 源 → version+1（影响扫描：此时尚无文档引用）
  await page.locator('.ws-replace').click()
  await page.waitForFunction(
    () => /v2/.test(document.querySelector('.ws-ver')?.textContent || ''),
    null,
    // 超时值保持**原来的有效值 30s**：本次只修参数位（写在第二位会被当成 arg 忽略，
    // 实际走 Playwright 默认 30s）。实测把这里的 10s 当真执行后，S24 会因 prep 阶段的
    // 耗时波动偶发假红（停止时助手文字还是 0 字）——收紧等待不是本次改动的目的。
    { timeout: 30000 },
  )
  const verOk = (await page.locator('.ws-ver').innerText()).includes('v2')
  console.log(`  ${verOk ? 'PASS' : 'FAIL'} - S13 replace source bumps version (v2)`)
  if (!verOk) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S13b.png` })

  // 分割线分类制作 → 删除路径
  await page.locator('.ws-cat[data-cat="divider"]').click()
  const d0 = await page.locator('.ws-row').count()
  await page.locator('.ws-desc').fill('细横线配一枚小花蕊的极简分隔素材，横向居中')
  await page.locator('.ws-make-btn').click()
  await page.waitForFunction(
    (n) => document.querySelectorAll('.ws-row').length === n + 1,
    d0,
    { timeout: 15000 },
  )
  await page.locator('.ws-row .ws-del').first().click()
  await page.waitForFunction(
    (n) => document.querySelectorAll('.ws-row').length === n,
    d0,
    { timeout: 10000 },
  )
  const delOk = (await page.locator('.ws-row').count()) === d0
  console.log(`  ${delOk ? 'PASS' : 'FAIL'} - S13 delete asset works (rows→${d0})`)
  if (!delOk) failed++
} catch (e) {
  console.log('  FAIL - S13 workshop error:', String(e).slice(0, 200))
  failed++
}

// S14 V3-R3 推文素材复用 + 固化 + 改版影响：会话创作引用工坊气泡素材（[[asset]]）→
// 解析复用（快照落文档）→ 素材改版 → 影响扫描列出文档 → 逐篇"用新版更新"
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) {
    await page.locator('.sess-btn').click()
  }
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })
  const bubbleId = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('wxmp-assets-v1') || '{}')
    const metas = Object.values((lib.items || {})).map((a) => a.meta)
    const top = metas.filter((m) => m.category === 'bubble').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
    return top ? top.id : ''
  })
  await page
    .locator('textarea')
    .fill('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写（素材库复用气泡角饰）')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 20000 })
  await page.waitForTimeout(900) // 等文档自动落盘（含固化快照）

  const docState = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {}
    const rec = docs[cur]
    return { cur, title: rec ? rec.title : '', snaps: rec ? rec.snapshots || {} : {} }
  })
  const reused = !!bubbleId && !!docState.snaps[bubbleId]
  const frame = page.frames().find((f) => f !== page.mainFrame())
  const bodyHtml = frame ? await frame.locator('body').innerHTML() : ''
  const noRefLeak = !bodyHtml.includes('[[asset') && bodyHtml.includes('data:image/')
  console.log(`  ${reused ? 'PASS' : 'FAIL'} - S14 library asset reused & snapshot persisted (doc=${docState.title.slice(0, 12)} id=${bubbleId})`)
  if (!reused) failed++
  console.log(`  ${noRefLeak ? 'PASS' : 'FAIL'} - S14 asset ref materialized in preview (no [[asset leak)`)
  if (!noRefLeak) failed++

  // 素材改版影响：回素材工坊替换气泡源 → 影响扫描应列出这篇文档 → 用新版更新 → 快照 version 跟进
  await page.locator('.view-tab[data-view="assets"]').click()
  await page.waitForSelector('.ws-pane', { timeout: 10000 })
  await page.locator('.ws-cat[data-cat="bubble"]').click()
  await page.waitForSelector('.ws-row', { timeout: 10000 })
  await page.locator('.ws-row:has-text("右下角小花气泡角饰")').click()
  await page.waitForSelector('.ws-detail', { timeout: 10000 })
  await page.locator('.ws-replace').click()
  await page.waitForSelector('.ws-ref-row', { timeout: 15000 })
  const refN = await page.locator('.ws-ref-row').count()
  console.log(`  ${refN >= 1 ? 'PASS' : 'FAIL'} - S14 impact scan lists referencing doc (refs=${refN})`)
  if (refN < 1) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S14a-refs.png` })

  // 契约（2026-09-29 新增）：工坊「用当前素材（新版）重渲染被引用文档」必须有可见忙碌态——
  //   按钮带 data-ref-update="<docId>"；忙碌时 disabled 且 data-busy="1"；空闲时 data-busy="0"。
  // 为什么用两套采样（沿用 S17 已有的手法，回答两个不同问题）：
  //   __busyCommit：MutationObserver(attributeFilter= data-busy/disabled) 的属性**提交序列**——
  //                 证明"应用真的把忙碌态提交进了 DOM"（而不是只在某个从未渲染的 state 里闪过）。
  //   __busyFrames：rAF 逐帧读数——证明"这个中间态至少被绘制过一帧（用户真的看得见）"。
  // mock 链路里重渲染可能只花几毫秒（本地库素材 + canvas 栅格化），中间帧不一定落到 rAF 上，
  // 所以"被绘制过"如实打印、不作为失败；硬断言落在**提交序列**上（出现过 1、且收尾回到 0）。
  const checkS14 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S14 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.evaluate(() => {
    window.__busyCommit = []
    window.__busyFrames = []
    const snap = (el) =>
      el ? { id: el.getAttribute('data-ref-update'), busy: el.getAttribute('data-busy'), disabled: !!el.disabled } : null
    const push = (arr, v) => {
      if (!v) return
      const last = arr[arr.length - 1]
      if (!last || last.id !== v.id || last.busy !== v.busy || last.disabled !== v.disabled) arr.push(v)
    }
    // 只关心"文档重渲染按钮"上的属性变化：用 closest 过滤，避免别的按钮 disabled 变化混进来
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target && r.target.closest ? r.target.closest('[data-ref-update]') : null
        if (el) push(window.__busyCommit, snap(el))
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-busy', 'disabled'],
    })
    const tick = () => {
      push(window.__busyFrames, snap(document.querySelector('[data-ref-update]')))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const refBtnId = await page.locator('.ws-ref-update').first().getAttribute('data-ref-update')
  checkS14('重渲染按钮带 data-ref-update 契约', !!refBtnId, `id=${refBtnId}`)
  // 进入重渲染之前必须空闲（0 且可点），否则"忙碌过又回到空闲"就无从谈起
  const idleBefore = await page
    .locator('.ws-ref-update')
    .first()
    .evaluate((el) => ({ busy: el.getAttribute('data-busy'), disabled: !!el.disabled }))
  checkS14('点击前为空闲态（data-busy=0 且可点）', idleBefore.busy === '0' && !idleBefore.disabled, JSON.stringify(idleBefore))

  await page.locator('.ws-ref-update').first().click()
  await page.waitForFunction(
    () => /重渲染/.test(document.querySelector('.ws-msg')?.textContent || ''),
    null,
    // 超时值保持**原来的有效值 30s**：本次只修参数位（写在第二位会被当成 arg 忽略，
    // 实际走 Playwright 默认 30s）。实测把这里的 10s 当真执行后，S24 会因 prep 阶段的
    // 耗时波动偶发假红（停止时助手文字还是 0 字）——收紧等待不是本次改动的目的。
    { timeout: 30000 },
  )
  // 等它真的回到空闲（而不是只在消息文案上看到"重渲染"三个字）
  await page
    .waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll('[data-ref-update]')).some(
          (b) => b.getAttribute('data-ref-update') === id && b.getAttribute('data-busy') === '0' && !b.disabled,
        ),
      refBtnId,
      { timeout: 10000 },
    )
    .catch(() => {})
  const busy = await page.evaluate(() => ({ commit: window.__busyCommit, frames: window.__busyFrames }))
  const mine = busy.commit.filter((s) => s.id === refBtnId)
  const sawBusy = mine.some((s) => s.busy === '1')
  checkS14('观测到忙碌态提交（data-busy 提交序列里出现过 "1"）', sawBusy, mine.map((s) => s.busy).join('→') || '序列为空')
  checkS14(
    '忙碌时按钮同时 disabled（不只是换个 data 属性）',
    mine.filter((s) => s.busy === '1').every((s) => s.disabled),
    JSON.stringify(mine.filter((s) => s.busy === '1')),
  )
  const lastMine = mine[mine.length - 1]
  checkS14('断言结束时恢复空闲（收尾为 data-busy=0 且可点）', !!lastMine && lastMine.busy === '0' && !lastMine.disabled, JSON.stringify(lastMine))
  const paintedBusy = busy.frames.some((s) => s && s.busy === '1')
  console.log(
    `  INFO - S14 忙碌态是否被绘制成帧：${paintedBusy ? '是（用户可见的中间帧）' : '否（mock 下几毫秒完成，只有提交序列抓得到；真机上有栅格化/IO 会更慢）'} (frames=${busy.frames.length})`,
  )

  const newSnapVer = await page.evaluate((id) => {
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {}
    const rec = docs[cur]
    return rec && rec.snapshots && rec.snapshots[id] ? rec.snapshots[id].ver : 0
  }, bubbleId)
  console.log(`  ${newSnapVer >= 2 ? 'PASS' : 'FAIL'} - S14 doc re-rendered with new version (snapshot ver=${newSnapVer})`)
  if (newSnapVer < 2) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S14b.png` })
} catch (e) {
  console.log('  FAIL - S14 reuse/impact error:', String(e).slice(0, 220))
  failed++
}

// ---- S15 P2（2026-09-24 调查 §6）：预览里点选组件 → 输入框出现文本锚点。
// 关键断言：**不自动发送**（用户消息数不变），因为项目铁律 6 禁止前端状态机控制对话流程。
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  await sendPrompt('写一篇新生入学典礼的宣传类推文，校园风，800字左右，直接写')
  await waitStreamDone()
  await page.waitForSelector('.phone iframe', { timeout: 15000 })
  const usersBefore = await page.locator('.msg-user').count()
  const draftBefore = await page.locator('textarea').inputValue()
  const frame = page.frameLocator('.phone iframe')
  await frame.locator('section > *').first().click({ force: true })
  await page.waitForTimeout(400)
  const draftAfter = await page.locator('textarea').inputValue()
  const usersAfter = await page.locator('.msg-user').count()
  const gotRef = draftAfter.includes('预览第') && draftAfter.length > draftBefore.length
  console.log(`  ${gotRef ? 'PASS' : 'FAIL'} - S15 preview click inserts component anchor (draft="${draftAfter.slice(0, 30)}")`)
  if (!gotRef) failed++
  const noAutoSend = usersAfter === usersBefore
  console.log(`  ${noAutoSend ? 'PASS' : 'FAIL'} - S15 click does not auto-send (users ${usersBefore}→${usersAfter})`)
  if (!noAutoSend) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S15-pick.png` })
} catch (e) {
  console.log('  FAIL - S15 preview pick error:', String(e).slice(0, 200))
  failed++
}

// ---- S16 P2：真实进度行出现（功能反馈保留）；知识命中/调试小字整块移除。
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  await page.locator('textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800字左右，直接写')
  await page.locator('textarea').press('Enter')
  let sawProgress = false
  try {
    await page.waitForSelector('.work-bubble', { timeout: 8000 })
    sawProgress = true
  } catch {
    sawProgress = false
  }
  console.log(`  ${sawProgress ? 'PASS' : 'FAIL'} - S16 real task progress line shown (work-bubble)`)
  if (!sawProgress) failed++
  await waitStreamDone()
  // 2026-09-28：知识命中/调试区整块移除（原先收在 details 里，现不再出现在界面上）
  const noteCount = await page.locator('.knowledge-note, .debug-note').count()
  console.log(`  ${noteCount === 0 ? 'PASS' : 'FAIL'} - S16 knowledge/debug small text removed (n=${noteCount})`)
  if (noteCount !== 0) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S16-progress.png` })
} catch (e) {
  console.log('  FAIL - S16 progress/debug error:', String(e).slice(0, 200))
  failed++
}

// ---- S17 工作气泡：阶段按真实步骤推进（think → write → 素材/排版 → 保存）、计时走动、结束消失 ----
try {
  const checkS17 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S17 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  const ensureEmpty = async () => {
    if ((await page.locator('.msg-user').count()) > 0) {
      await page.locator('[data-act="clear"]').click()
      await page.waitForSelector('.chat-empty', { timeout: 10000 })
    }
  }
  await ensureEmpty()
  // 两套采样，分别回答两个不同问题：
  //  __committed：DOM 提交序列（MutationObserver + attributeOldValue）——证明"应用发出了这些阶段"
  //  __painted  ：至少存在过一帧的阶段（rAF）——证明"用户真的看得见"
  // 瞬时阶段（如浏览器 mock 下的保存）会被 React 合并成一次提交，只查 DOM 现值会漏掉，故分开断言。
  await page.evaluate(() => {
    window.__committed = []
    window.__phases = []
    window.__times = []
    const push = (arr, v) => {
      if (v && arr[arr.length - 1] !== v) arr.push(v)
    }
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' && r.attributeName === 'data-phase') {
          push(window.__committed, r.oldValue)
          push(window.__committed, r.target.getAttribute('data-phase'))
        }
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-phase'],
      attributeOldValue: true,
    })
    const tick = () => {
      const el = document.querySelector('.work-bubble')
      push(window.__phases, el ? el.getAttribute('data-phase') : null)
      const t = el && el.querySelector('.wb-time')
      push(window.__times, t ? t.textContent : null)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.locator('textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800字左右，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  const { phases, committed, times } = await page.evaluate(() => ({
    phases: window.__phases,
    committed: window.__committed,
    times: window.__times,
  }))

  // 浏览器模式不做 prep（runPrep 直接 skip），所以首个提交是「等待模型响应」的 think
  const seq = committed
  const idx = (p) => seq.indexOf(p)
  const wantOrder = ['think', 'write', 'compose', 'save']
  const ordered = wantOrder.every((p, i) => idx(p) >= 0 && (i === 0 || idx(wantOrder[i - 1]) < idx(p)))
  console.log(`  ${ordered ? 'PASS' : 'FAIL'} - S17 阶段按真实步骤推进 (${seq.join(' → ')})`)
  if (!ordered) failed++
  checkS17('素材阶段出现', idx('asset') >= 0, `asset=${idx('asset')}`)
  // 独立「质量检查」阶段已并入 compose（<1ms 的检查画不出来），不得再出现
  checkS17('无独立 quality 阶段', idx('quality') < 0)
  checkS17('保存阶段收尾', seq[seq.length - 1] === 'save', `last=${seq[seq.length - 1]}`)
  // 有真实耗时的阶段必须真的被画出来（用户看得见），这是本次改造的核心承诺
  const paintedReal = ['think', 'write', 'asset'].every((p) => phases.includes(p))
  checkS17('真实耗时阶段被绘制（think/write/asset）', paintedReal, phases.join('→'))

  // 计时：本轮耗时数秒，秒数必须真的走动（不是写死的 0s）
  const ticked = times.some((t) => t && t !== '0s')
  checkS17('计时走动', ticked, times.filter(Boolean).join(',') || '无读数')

  const gone = (await page.locator('.work-bubble').count()) === 0
  checkS17('回合结束后气泡消失', gone)
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S17-bubble.png` })
} catch (e) {
  console.log('  FAIL - S17 working bubble error:', String(e).slice(0, 200))
  failed++
}

// ---------- S18：引用不可用 → 未完成素材清单 + 单项重试（修复计划阶段 2/3）----------
// 场景：稿子里引用了一个素材库里并不存在的素材。要看到三件事——协议不残留进正文、
// 问题以可操作清单出现（不是文章段落、不是助手自述）、清单上的"重试"能真的再跑一次。
try {
  const ensureEmptyS18 = async () => {
    if ((await page.locator('.msg-user').count()) > 0) {
      await page.locator('[data-act="clear"]').click()
      await page.waitForSelector('.chat-empty', { timeout: 10000 })
    }
  }
  await ensureEmptyS18()
  await page.locator('textarea').fill('写一篇素材故障样例的推文，校园风，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  // 自动修订不会清掉它（重写正文解决不了素材问题），等清单稳定出现
  await page.waitForSelector('.asset-issues', { timeout: 15000 })

  const issues = await page.locator('.asset-issues .ai-list li').count()
  console.log(`  ${issues >= 1 ? 'PASS' : 'FAIL'} - S18 未完成素材清单出现 (${issues} 项)`)
  if (issues < 1) failed++

  const retryBtns = await page.locator('.asset-issues [data-retry-slot]').count()
  console.log(`  ${retryBtns === issues ? 'PASS' : 'FAIL'} - S18 每项都有可点的重试 (${retryBtns}/${issues})`)
  if (retryBtns !== issues) failed++

  // 正文（HTML）里不得残留任何素材协议文本——协议行必须被剔除，而不是当段落输出
  const bodyText = await page.evaluate(() => {
    const f = document.querySelector('.preview-body iframe')
    return f && f.contentDocument ? f.contentDocument.body.innerHTML : ''
  })
  const leaked = /\[\[asset:|:::\s*art|生成失败/.test(bodyText)
  console.log(`  ${!leaked ? 'PASS' : 'FAIL'} - S18 成稿不残留素材协议与失败说明`)
  if (leaked) failed++

  // 问题必须出现在界面清单里，而不是被助手的一句"修好了"代替
  const doc = await page.evaluate(() => document.querySelector('.asset-issues')?.textContent || '')
  const shown = doc.includes('素材未完成')
  console.log(`  ${shown ? 'PASS' : 'FAIL'} - S18 完成状态按绑定判定，不采信助手自述 (${doc.slice(0, 30)})`)
  if (!shown) failed++
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S18-asset-issues.png` })

  // 单项重试就地再跑一次素材解析（不是新的对话回合）
  const userBefore = await page.locator('.msg-user').count()
  await page.locator('.asset-issues [data-retry-slot]').first().click()
  await page.waitForSelector('.work-bubble', { timeout: 5000 }).catch(() => {})
  await waitStreamDone()
  const userAfter = await page.locator('.msg-user').count()
  console.log(`  ${userAfter === userBefore ? 'PASS' : 'FAIL'} - S18 重试不发新对话回合 (users ${userBefore}→${userAfter})`)
  if (userAfter !== userBefore) failed++
  const stillThere = await page.locator('.asset-issues').count()
  console.log(`  ${stillThere >= 1 ? 'PASS' : 'FAIL'} - S18 重试失败后清单仍在（不假装成功）`)
  if (stillThere < 1) failed++
} catch (e) {
  console.log('  FAIL - S18 asset issues error:', String(e).slice(0, 200))
  failed++
}

// ---------- S19：保存失败提示的可见性契约（2026-09-29 新增）----------
// 契约：终稿保存失败时 PreviewPane 渲染 <div className="save-error" data-save-error="1">…</div>；
//       保存成功时不渲染该容器。
//
// 这一节是**弱断言**，且刻意不伪造失败场景，理由写在这里备查：
//   1) 浏览器 mock 链路的写盘走 documents.ts 的 localStorage 分支，而 lsWrite() 把 setItem 的异常
//      整个 try/catch 吞掉、saveDocument() 照样返回非 null —— 也就是说 mock 下 App 里
//      `if (!saved) throw ... setSaveError(...)` 那条失败分支**结构上走不到**
//      （真机走 Tauri 的 invoke 分支，抛错才返回 null）。
//   2) 用 page.evaluate 手搓一个 .save-error 节点是伪造界面，什么也证明不了。
//   3) 把 localStorage 塞到超限不可靠：配额随浏览器/配置变化，而且超限异常同样被 lsWrite 吞掉，
//      连"失败"都不会被上层看见。
//   所以这里只断言两件**能真实查证**的事：
//     A. 源码里契约还在（选择器与 App 侧接线没被改名/删掉）——结构断言；
//     B. 正常成功路径下该容器不存在——**并且先证明这一轮确实保存成功了**，
//        否则"没有错误提示"会退化成废话（什么都没发生也满足）。
//   "失败时确实出现"这条留给 Rust/单元测试与真机验证，本脚本**不假装**覆盖它。
try {
  const repoRoot = join(here, '..')
  const previewSrc = readFileSync(join(repoRoot, 'src', 'components', 'PreviewPane.tsx'), 'utf8')
  const appSrc = readFileSync(join(repoRoot, 'src', 'App.tsx'), 'utf8')
  const checkS19 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S19 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  // A. 结构断言：契约存在于源码里（这是弱断言，只挡"改名/删除"，不证明运行时行为）
  checkS19('PreviewPane.tsx 含 data-save-error 契约', /data-save-error/.test(previewSrc))
  checkS19('PreviewPane.tsx 含 save-error 样式类', /["'`][^"'`]*\bsave-error\b/.test(previewSrc))
  checkS19('PreviewPane.tsx 接收 saveError 入参', /saveError/.test(previewSrc))
  checkS19('App.tsx 在失败分支里 setSaveError(...)', /setSaveError\(/.test(appSrc))
  checkS19('App.tsx 把 saveError 传给 PreviewPane', /<PreviewPane[\s\S]{0,600}saveError=\{saveError\}/.test(appSrc))

  // B. 运行期：跑完一整轮并**确证保存成功**，再看失败容器不存在
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  if ((await page.locator('.msg-user').count()) > 0) {
    await page.locator('[data-act="clear"]').click()
    await page.waitForSelector('.chat-empty', { timeout: 10000 })
  }
  const beforeSave = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {}
    return { cur, updatedAt: docs[cur] ? docs[cur].updatedAt : '' }
  })
  await sendPrompt('写一篇新生入学典礼的宣传类推文，校园风，800字左右，直接写')
  await waitStreamDone()
  // 等文档真的落盘（updatedAt 变化）——这一步是让"没有失败提示"变得有意义的对照项
  await page
    .waitForFunction(
      (prev) => {
        const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
        const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {}
        const rec = docs[cur]
        return !!rec && !!rec.html && rec.updatedAt !== prev
      },
      beforeSave.updatedAt,
      { timeout: 15000 },
    )
    .catch(() => {})
  const afterSave = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {}
    const rec = docs[cur]
    return {
      cur,
      saved: !!rec && (rec.html || '').length > 200,
      updatedAt: rec ? rec.updatedAt : '',
      errNodes: document.querySelectorAll('.save-error, [data-save-error]').length,
    }
  })
  checkS19(
    '对照项：这一轮确实保存成功了（否则"无失败提示"是废话）',
    afterSave.saved && afterSave.updatedAt !== beforeSave.updatedAt,
    `doc=${afterSave.cur} updatedAt ${beforeSave.updatedAt}→${afterSave.updatedAt}`,
  )
  checkS19('正常成功路径下不渲染保存失败容器', afterSave.errNodes === 0, `nodes=${afterSave.errNodes}`)
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S19-nosaveerror.png` })
} catch (e) {
  console.log('  FAIL - S19 save-error contract error:', String(e).slice(0, 200))
  failed++
}

// ---------- S20：生成中禁用导出/复制（2026-09-29 新增）----------
// 缺口：PreviewPane 过去只按 `!html || exportingImg` 禁用导出按钮 → 流式生成中点「导出 HTML / 导出图片」
// 会导出**半成品**。现在 busy（生成中）为真时，导出图片 / 导出 HTML / 复制 HTML 三个按钮必须禁用，
// 清空保持可用（可随时中止回到空稿）。
// 采样方式：busy 是 App 的运行期状态，没有独立 DOM 契约，所以 rAF 逐帧记录
//   busy = 工作气泡在（.work-bubble）&& html = 预览 iframe 已渲染
// 再读四个按钮的 disabled。**只对"确实有稿子且确实在生成中"的帧硬断言**——
// 否则"按钮禁用"可能只是因为没有稿子（废话断言）。若整轮都没采到这样的帧，如实判 FAIL
// （说明要么 html 在生成期间从不出现、要么禁用没生效），不静默跳过。
try {
  const checkS20 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S20 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  checkS20(
    '四个入口都带 data-act 契约',
    (await page.locator('[data-act="copy-html"]').count()) === 1 &&
      (await page.locator('[data-act="export-html"]').count()) === 1 &&
      (await page.locator('[data-act="export-images"]').count()) === 1 &&
      (await page.locator('[data-act="clear"]').count()) === 1,
  )

  if ((await page.locator('.msg-user').count()) > 0) {
    await page.locator('[data-act="clear"]').click()
    await page.waitForSelector('.chat-empty', { timeout: 10000 })
  }
  await page.evaluate(() => {
    window.__exp = []
    const on = (sel) => {
      const el = document.querySelector(sel)
      return el ? !!el.disabled : null
    }
    const snap = () => ({
      busy: !!document.querySelector('.work-bubble'),
      html: !!document.querySelector('.preview-body iframe'),
      copy: on('[data-act="copy-html"]'),
      exp: on('[data-act="export-html"]'),
      img: on('[data-act="export-images"]'),
      clear: on('[data-act="clear"]'),
    })
    const tick = () => {
      const v = snap()
      const a = window.__exp
      const last = a[a.length - 1]
      if (!last || JSON.stringify(last) !== JSON.stringify(v)) a.push(v)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  // 「自检缺组件」这句会走两轮（首稿不达标 → 自动修订），html 出现后仍在生成中的窗口最长
  await page.locator('textarea').fill('写一篇军训慰问推文（自检缺组件），直接写')
  await page.locator('textarea').press('Enter')
  let settled = false
  for (let i = 0; i < 100; i++) {
    const ok = await page.locator('.quality-strip.q-ok').count()
    const busyBubble = await page.locator('.work-bubble').count()
    if (ok > 0 && busyBubble === 0) {
      settled = true
      break
    }
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(500)
  const expFrames = await page.evaluate(() => window.__exp || [])
  const live = expFrames.filter((f) => f.busy && f.html)
  const allThreeOff = live.every((f) => f.copy === true && f.exp === true && f.img === true)
  // 快照只在状态变化时才落一条，所以"帧数"=状态变化次数；序列本身才是证据
  const seq = expFrames
    .map((f) => `${f.busy ? 'B' : '-'}${f.html ? 'H' : '-'}:三键${[f.copy, f.exp, f.img].map((v) => (v == null ? 'x' : v ? '禁' : '可')).join('')}｜清空${f.clear === false ? '可' : '禁'}`)
    .join(' → ')
  checkS20(
    '生成中（有稿子 + 工作气泡）三个导出/复制入口都禁用',
    settled && live.length > 0 && allThreeOff,
    `采到 ${live.length} 个生成中且有稿子的状态读数，三键禁用=${allThreeOff}；序列 ${seq}`,
  )
  const clearOn = live.every((f) => f.clear === false)
  checkS20('生成中「清空」保持可用', live.length > 0 && clearOn, `样本 ${live.length} 帧`)
  // 收尾：生成结束后可导出（否则"禁用"可能其实是永久禁用）
  const after = await page.locator('[data-act="export-html"]').evaluate((el) => ({ disabled: !!el.disabled, html: !!document.querySelector('.preview-body iframe') }))
  checkS20('生成结束后导出恢复可用（有稿子为前提）', after.html && !after.disabled, JSON.stringify(after))
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S20-busy-export.png` })
} catch (e) {
  console.log('  FAIL - S20 busy export error:', String(e).slice(0, 200))
  failed++
}

// ---------- S21：会话改名（2026-09-29 新增）----------
// 契约：双击会话标题 → 行内 <input data-rename-input>；Enter 提交 / Esc 取消 / 失焦提交。
// 断言走 localStorage 真值（浏览器模式），不只看渲染文本——避免"界面显示了但没落盘"。
try {
  const checkS21 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S21 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) await page.locator('.sess-btn').click()
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  // 用当前高亮会话（双击它不会触发切换）
  const row = page.locator('.session-rail .sess-row.sess-active')
  const sid = await row.getAttribute('data-id')
  const titleOf = async () => (await row.locator('.sess-title').innerText()).trim()
  const storedTitle = () =>
    page.evaluate((id) => {
      const st = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}')
      return st.items && st.items[id] ? st.items[id].title : null
    }, sid)
  checkS21('当前会话行有 data-id', !!sid, `id=${sid}`)
  const oldTitle = await titleOf()

  // ① 双击标题 → 行内输入出现
  await row.locator('.sess-title').dblclick()
  await page.waitForSelector('.session-rail [data-rename-input]', { timeout: 5000 })
  const inputCount = await page.locator('.session-rail [data-rename-input]').count()
  checkS21('双击标题出现行内输入（data-rename-input）', inputCount === 1, `n=${inputCount}`)

  // ② Esc 取消：输入框消失且标题没变
  const input = page.locator('.session-rail [data-rename-input]')
  await input.fill('不该被写进去的名字')
  await input.press('Escape')
  await page.waitForTimeout(300)
  const afterEsc = await titleOf()
  checkS21(
    'Esc 取消：输入框收起且标题未变',
    (await page.locator('.session-rail [data-rename-input]').count()) === 0 && afterEsc === oldTitle,
    `${oldTitle} → ${afterEsc}`,
  )

  // ③ 失焦提交（不按 Enter）：点到别处即提交
  const blurName = `失焦改名-${Date.now() % 100000}`
  await row.locator('.sess-title').dblclick()
  await page.locator('.session-rail [data-rename-input]').fill(blurName)
  await page.locator('.session-rail .rail-title').click()
  await page
    .waitForFunction(
      (a) => {
        const el = document.querySelector(`.session-rail .sess-row[data-id="${a.id}"] .sess-title`)
        return !!el && el.textContent.trim() === a.name
      },
      { id: sid, name: blurName },
      { timeout: 10000 },
    )
    .catch(() => {})
  checkS21('失焦提交后标题更新且已落库', (await titleOf()) === blurName && (await storedTitle()) === blurName, `stored=${await storedTitle()}`)

  // ④ Enter 提交 + 刷新页面后仍在（真的写进本机，不只是界面状态）
  const enterName = `回车改名-${Date.now() % 100000}`
  await row.locator('.sess-title').dblclick()
  await page.locator('.session-rail [data-rename-input]').fill(enterName)
  await page.locator('.session-rail [data-rename-input]').press('Enter')
  await page.waitForTimeout(400)
  checkS21('Enter 提交后标题更新且已落库', (await titleOf()) === enterName && (await storedTitle()) === enterName, `stored=${await storedTitle()}`)
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S21-rename.png` })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) await page.locator('.sess-btn').click()
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  const afterReload = await page
    .locator(`.session-rail .sess-row[data-id="${sid}"] .sess-title`)
    .innerText()
    .catch(() => '')
  checkS21('刷新后新标题仍在', afterReload.trim() === enterName, `row="${afterReload.trim()}"`)
} catch (e) {
  console.log('  FAIL - S21 session rename error:', String(e).slice(0, 200))
  failed++
}

// ---------- S22：草稿/成品标识、草稿取回入口与**完整版本回退**（质量恢复计划 §5.7/§7/§8）----------
// 要证明的是这一轮新加的那条链路真的成立：
//   ① 一版通过门禁的稿子 → 成品（data-doc-state="accepted"），且**没有**草稿取回入口；
//   ② 同一个会话再出一版**过不了门禁**的稿子 → 成品指针**不动**、预览回到上一版已验收成品
//      （data-doc-state="restored"），最新那版作为草稿保留并可取回；
//   ③ 硬证据：落盘文档的 accepted 仍为 true，且被引用的预览 HTML 里**没有**失败稿的特征。
// 为什么必须有这条：计划 §11 明确"静态代码存在、单项质检通过、模型声称修好或日志显示保存成功，
// 都不能替代这些证据"——只有跑过才知道回退链路是不是真的接上了。
try {
  const checkS22 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S22 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) await page.locator('.sess-btn').click()
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })

  const readState = () =>
    page.evaluate(() => {
      const frame = document.querySelector('iframe')
      const body = frame && frame.contentDocument ? frame.contentDocument.body.innerHTML : ''
      const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
      const rec = ((JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {})[cur]) || null
      return {
        docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state') ?? null,
        stripCls: document.querySelector('.quality-strip')?.className ?? '',
        blockers: document.querySelectorAll('[data-blocker-code]').length,
        draftEntry: document.querySelectorAll('[data-export-draft-entry="1"]').length,
        mainExportDraft: document.querySelectorAll('[data-export-draft="1"]').length,
        bodyLen: body.length,
        hasStuck: body.includes('素材故障演示'),
        hasBanner: body.includes('新生开学典礼'),
        docSource: rec ? String(rec.source || '') : '',
        accepted: rec ? rec.accepted : null,
      }
    })

  // ① 先出一版好稿 → 成品
  await page.locator('textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForTimeout(1200)
  const s22a = await readState()
  checkS22('好稿被判为成品', s22a.docState === 'accepted', `state=${s22a.docState} strip=${s22a.stripCls}`)
  checkS22('成品态没有草稿取回入口', s22a.draftEntry === 0, `entries=${s22a.draftEntry}`)
  checkS22('落盘文档标记为已验收', s22a.accepted === true)

  // ② 同一会话再出一版过不了门禁的稿子（引用不存在的素材 → 阻断）
  await page.locator('textarea').fill('再写一篇素材故障样例的推文，校园风，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForTimeout(2000)
  const s22b = await readState()
  checkS22('失败候选被标为"已恢复上一版成品"', s22b.docState === 'restored', `state=${s22b.docState}`)
  checkS22('阻断项逐条列明（不是只变个颜色）', s22b.blockers >= 1, `blockers=${s22b.blockers}`)
  checkS22('预览显示的是上一版成品而非失败稿', s22b.bodyLen > 0 && !s22b.hasStuck && s22b.hasBanner, `stuck=${s22b.hasStuck} banner=${s22b.hasBanner}`)
  checkS22('落盘文档仍是已验收状态（成品指针没被覆盖）', s22b.accepted === true)
  checkS22('落盘源文也仍是上一版（无新源文配旧 HTML 的混合版本）', !s22b.docSource.includes('素材故障演示'))
  checkS22('提供了明确标注的草稿取回入口', s22b.draftEntry >= 1, `entries=${s22b.draftEntry}`)

  await page.screenshot({ path: `${outDir}/wxmp-desktop-S22-restored.png` })
} catch (e) {
  console.log('  FAIL - S22 草稿/成品与回退 error:', String(e).slice(0, 200))
  failed++
}

// ---------- S23：**没有已验收历史**时的失败交付（2026-09-29 新增，DS 修复指南 §10 未覆盖行）----------
// 覆盖的验收行：§4.5 末段"有/无旧成品两种失败情况 → 分别为完整恢复/草稿未通过，**不制造不存在的回滚**"。
// S22 已经覆盖"有旧成品"那一半（restored），这里覆盖"没有旧成品"那一半。
//
// 这条**必须**是独立会话的**第一轮**：新建会话 → 首个候选就过不了门禁。此时 priorAccepted 为空，
// 若产品仍显示"已恢复上一版成品"，就是把不存在的回滚讲给用户听。
//
// 红/绿分界（每条写清楚"什么情况下会变红"）：
//   ①"这一轮确实产出了候选"   红：助手气泡为空 / 落盘 source 为空或不含本轮的故障稿特征（说明根本没产出，后面的"没成品"就成了废话）
//   ②"状态是 draft-failed"    红：状态是 restored（凭空回滚）或 accepted（失败稿被当成品）或 repairing
//   ③"没有回滚横幅"           红：出现了 data-doc-state="restored" 容器或"已恢复上一版成品"字样
//   ④"预览显示的是本轮草稿"   红：预览里没有本轮故障稿特征（说明预览挂的是别的东西）
//   ⑤"草稿导出入口存在"       红：失败候选取不回来（入口数为 0）
//   ⑥"落盘文档 accepted!==true" 红：没有文档记录（候选没落盘）或被标成已验收
try {
  const checkS23 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S23 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) await page.locator('.sess-btn').click()
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })

  // 先确认这是"没有已验收历史"的会话（否则整条断言的前提不成立）
  const s23pre = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const rec = ((JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {})[cur]) || null
    return { cur, hasDoc: !!rec, accepted: rec ? rec.accepted : null }
  })
  checkS23('前提：新会话没有已验收成品历史', s23pre.hasDoc === false, `doc=${s23pre.cur} hasDoc=${s23pre.hasDoc} accepted=${s23pre.accepted}`)

  // 同一会话**第一轮**就产出过不了门禁的稿子（素材侧问题，重写正文解决不了）
  await page.locator('textarea').fill('写一篇素材故障样例的推文，校园风，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForTimeout(1500)

  const s23 = await page.evaluate(() => {
    const frame = document.querySelector('.preview-body iframe')
    const body = frame && frame.contentDocument ? frame.contentDocument.body.innerHTML : ''
    const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
    const rec = ((JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {})[cur]) || null
    const pane = document.querySelector('.preview-pane')
    const bubbles = [...document.querySelectorAll('.msg-assistant-text')]
    const last = bubbles[bubbles.length - 1]
    const ds = document.querySelector('[data-doc-state]')
    return {
      docState: ds ? ds.getAttribute('data-doc-state') : null,
      docIsDraft: ds ? ds.getAttribute('data-doc-is-draft') : null,
      restoredNodes: document.querySelectorAll('[data-doc-state="restored"]').length,
      paneText: pane ? pane.innerText : '',
      draftEntry: document.querySelectorAll('[data-export-draft-entry="1"]').length,
      blockers: document.querySelectorAll('[data-blocker-code]').length,
      asstLen: last ? last.textContent.trim().length : 0,
      hasDoc: !!rec,
      accepted: rec ? rec.accepted : null,
      srcLen: rec ? String(rec.source || '').length : 0,
      srcIsFailing: rec ? String(rec.source || '').includes('素材故障演示') : false,
      bodyHasFailing: body.includes('素材故障演示'),
    }
  })
  checkS23(
    '这一轮确实产出了候选（否则"没有成品"是废话）',
    s23.asstLen > 10 && s23.srcLen > 0 && s23.srcIsFailing === true,
    `助手文案=${s23.asstLen}字 落盘source=${s23.srcLen}字 含故障稿特征=${s23.srcIsFailing}`,
  )
  checkS23('没有旧成品时状态是"草稿未通过"（不是"已恢复上一版"）', s23.docState === 'draft-failed', `state=${s23.docState} isDraft=${s23.docIsDraft}`)
  checkS23(
    '预览区没有"已恢复上一版成品"横幅（找回上一版是 restored 才有的）',
    s23.restoredNodes === 0 && !s23.paneText.includes('已恢复上一版成品'),
    `restoredNodes=${s23.restoredNodes} 含字样=${s23.paneText.includes('已恢复上一版成品')}`,
  )
  checkS23('预览里显示的确实是本轮失败草稿', s23.bodyHasFailing === true, `预览含故障稿特征=${s23.bodyHasFailing} 阻断项=${s23.blockers}`)
  checkS23('草稿导出入口存在（失败候选可取回）', s23.draftEntry >= 1, `entries=${s23.draftEntry}`)
  checkS23('失败候选已落盘为文档且 accepted!==true', s23.hasDoc === true && s23.accepted !== true, `hasDoc=${s23.hasDoc} accepted=${s23.accepted}`)
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S23-draft-failed.png` })
} catch (e) {
  console.log('  FAIL - S23 无历史失败交付 error:', String(e).slice(0, 200))
  failed++
}

// ---------- S24：取消后不覆盖已有成品（2026-09-29 新增）----------
// 覆盖的验收行：指南 §5.5"取消或协议失败时旧稿仍可显示，但**不能用旧稿 accepted 证明本轮更新**"+
// §5.6"prep 途中停止/取消后迟到 → 无后续派发或错误成品提升；旧版本完整"在浏览器链路上的等价断言。
//
// 做法：①先跑一轮正常成稿并记下**落盘文档的 source/revisionId/updatedAt**；
//      ②再发一条**若不取消就会提交新成品**的内容（缺组件半成品，S10 已证明它会被验收提交），
//        在流未结束时点「停止」；
//      ③断言落盘文档逐字段未变、预览仍是上一版成品；
//      ④**对照项**：同一提示语不取消时确实会换掉 source —— 否则③的"未变"可能只是因为该提示语本来就提交不了。
//
// 红/绿分界：
//   ①"停止时流仍在跑"   红：点击时 work-bubble/停止按钮已不在（那时点停止什么也没证明）
//   ②"点完停止后工作气泡消失" 红：按钮点了但气泡还在（前端没停下）
//   ③"流停止后文字不再增长" 红：取消后助手文字仍在增长（取消没生效）
//   ④"source 与第一次完全相同" 红：取消回合照样提交了一版（字段被换掉）
//   ⑤"revisionId 相同"  红：新提交换了版本号。注意：浏览器链路 revisionId 可能两份都是 null（见报告），
//      故同时用 updatedAt/source 兜底，不靠这一条单独成立
//   ⑥"预览仍是上一版成品" 红：预览被半成品替换（正文换成军训慰问稿）或状态不再是 accepted
//   ⑦"对照项：不取消就真的换稿" 红：同一提示语跑完却不改 source —— 那④就退化成恒真
try {
  const checkS24 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S24 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  const readDocRec = () =>
    page.evaluate(() => {
      const cur = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}').current
      const rec = ((JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}').docs || {})[cur]) || null
      return rec
        ? {
            has: true,
            source: String(rec.source || ''),
            updatedAt: String(rec.updatedAt || ''),
            revisionId: rec.revisionId ?? null,
            accepted: rec.accepted ?? null,
            htmlLen: String(rec.html || '').length,
          }
        : { has: false, source: '', updatedAt: '', revisionId: null, accepted: null, htmlLen: 0 }
    })
  const lastAssistantLen = () =>
    page.evaluate(() => {
      const a = [...document.querySelectorAll('.msg-assistant-text')]
      const t = a[a.length - 1]
      return t ? t.textContent.trim().length : 0
    })

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })
  if ((await page.locator('.session-rail').count()) === 0) await page.locator('.sess-btn').click()
  await page.waitForSelector('.session-rail .sess-row', { timeout: 10000 })
  await page.locator('.session-rail .rail-new').click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })

  // 第一回合：正常成稿（成品）
  await page.locator('textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 15000 })
  await page.waitForTimeout(1200)
  const doc1 = await readDocRec()
  const state1 = await page.evaluate(() => document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state') ?? null)
  checkS24(
    '对照项：第一回合确实提交了成品（否则后面的"未变"没有意义）',
    doc1.has && doc1.accepted === true && doc1.source.length > 100 && state1 === 'accepted',
    `state=${state1} srcLen=${doc1.source.length} revisionId=${doc1.revisionId} at=${doc1.updatedAt}`,
  )

  // 第二回合：另一版内容（不取消就会提交新成品），流未结束时点停止
  await page.locator('textarea').fill('写一篇军训慰问推文（自检缺组件），直接写')
  await page.locator('textarea').press('Enter')
  await page.waitForSelector('.btn-stop', { timeout: 10000 })
  await page
    .waitForFunction(
      () => {
        const a = [...document.querySelectorAll('.msg-assistant-text')]
        const t = a[a.length - 1]
        return !!t && t.textContent.trim().length > 5 && !!document.querySelector('.work-bubble')
      },
      null,
    // 超时值保持**原来的有效值 30s**：本次只修参数位（写在第二位会被当成 arg 忽略，
    // 实际走 Playwright 默认 30s）。实测把这里的 10s 当真执行后，S24 会因 prep 阶段的
    // 耗时波动偶发假红（停止时助手文字还是 0 字）——收紧等待不是本次改动的目的。
      { timeout: 30000 },
    )
    .catch(() => {})
  const stopBtnAtClick = await page.locator('.btn-stop').count()
  const bubbleAtClick = await page.locator('.work-bubble').count()
  const usersAtClick = await page.locator('.msg-user').count()
  await page.locator('.btn-stop').click()
  const lenAtStop = await lastAssistantLen()
  await page.waitForTimeout(900)
  const lenLater = await lastAssistantLen()
  const bubbleAfter = await page.locator('.work-bubble').count()
  const stopAfter = await page.locator('.btn-stop').count()
  const doc2 = await readDocRec()
  const afterStop = await page.evaluate(() => {
    const frame = document.querySelector('.preview-body iframe')
    const body = frame && frame.contentDocument ? frame.contentDocument.body.innerHTML : ''
    return {
      docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state') ?? null,
      draftEntry: document.querySelectorAll('[data-export-draft-entry="1"]').length,
      hasBanner: body.includes('新生开学典礼'),
      hasDeficient: body.includes('军训慰问'),
    }
  })

  checkS24(
    '点击停止时这一轮确实还在生成中',
    stopBtnAtClick === 1 && bubbleAtClick === 1 && usersAtClick === 2,
    `stopBtn=${stopBtnAtClick} bubble=${bubbleAtClick} users=${usersAtClick}`,
  )
  checkS24('点完停止后工作气泡与停止按钮消失', bubbleAfter === 0 && stopAfter === 0, `bubble=${bubbleAfter} stopBtn=${stopAfter}`)
  checkS24('取消后助手文字不再增长（取消真的生效）', lenLater === lenAtStop && lenAtStop > 0, `停止时=${lenAtStop}字 900ms后=${lenLater}字`)
  checkS24(
    '落盘 source 与第一回合完全相同（取消不产生新提交）',
    doc2.has && doc2.source === doc1.source && doc2.source.length > 100,
    `len ${doc1.source.length}→${doc2.source.length}`,
  )
  checkS24(
    '落盘 revisionId 与第一回合相同',
    String(doc2.revisionId) === String(doc1.revisionId),
    `revisionId ${doc1.revisionId}→${doc2.revisionId}（浏览器链路可能均为 null，见脚本注释）`,
  )
  checkS24('落盘 updatedAt 未变（没有发生第二次写入）', doc2.updatedAt === doc1.updatedAt, `at ${doc1.updatedAt}→${doc2.updatedAt}`)
  checkS24('落盘 HTML 长度未变', doc2.htmlLen === doc1.htmlLen, `htmlLen ${doc1.htmlLen}→${doc2.htmlLen}`)
  checkS24(
    '预览仍是上一版成品（没被取消掉的半成品替换）',
    afterStop.docState === 'accepted' && afterStop.hasBanner && !afterStop.hasDeficient,
    `state=${afterStop.docState} 含旧成品=${afterStop.hasBanner} 含半成品=${afterStop.hasDeficient}`,
  )
  checkS24('取消回合不产生"未通过门禁的候选"入口', afterStop.draftEntry === 0, `entries=${afterStop.draftEntry}`)
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S24-cancel.png` })

  // 对照项：同一提示语**不取消**时确实会提交新成品（证明上面的"未变"可证伪）
  await page.locator('textarea').fill('写一篇军训慰问推文（自检缺组件），直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  await page.waitForTimeout(1500)
  const doc3 = await readDocRec()
  checkS24(
    '对照项：同一提示语不取消时确实换掉了成品（上面的"未变"可证伪）',
    doc3.has && doc3.source.includes('军训慰问') && doc3.source !== doc1.source && doc3.updatedAt !== doc1.updatedAt,
    `含军训慰问=${doc3.source.includes('军训慰问')} source变了=${doc3.source !== doc1.source} at变了=${doc3.updatedAt !== doc1.updatedAt}`,
  )
} catch (e) {
  console.log('  FAIL - S24 取消不覆盖成品 error:', String(e).slice(0, 200))
  failed++
}

// ---------- S25：375px 预览的逐项断言（2026-09-29 新增）----------
// 覆盖的验收行：指南 §7.4 L5 前的"预览宽 375px"与 §6"预览显示层不得有协议残留/外链"在浏览器链路的逐项版本。
// S1.8 只断言了"渲染进去了 + 有 5 张 data 图 + 主题色"，没有断言宽度本身，也没有逐张看 img 的 src 协议。
//
// 红/绿分界：
//   ①"iframe 渲染宽度 375px"  红：.phone 宽度被改（或缩放后 rect 宽度不等于 375）
//   ②"注入 body 的宽度样式 375px" 红：wrapSrcDoc 不再注入 width:375px（宽屏下会铺满容器）
//   ③"正文节点 > 0"          红：body 里没有带直接文字的块节点（正文没渲染/只剩空壳）
//   ④"每张 img 的 src 都是 data:/blob:" 红：出现 http/https 外链图（显示层漏了外链抑制）
//   ⑤"img 数量 >= 样例素材位" 红：素材位没落成图片（④就退化成恒真）
//   ⑥"可见文本无协议残留"     红：出现了 ::: art / [[asset: / 未渲染的 svg 文本
try {
  const checkS25 = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} - S25 ${name}${extra ? ' (' + extra + ')' : ''}`)
    if (!ok) failed++
  }
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chat-head .badge', { timeout: 20000 })
  if ((await page.locator('.msg-user').count()) > 0) {
    await page.locator('[data-act="clear"]').click()
    await page.waitForSelector('.chat-empty', { timeout: 10000 })
  }
  await sendPrompt('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await waitStreamDone()
  await page.waitForSelector('.quality-strip.q-ok', { timeout: 15000 })
  await page.waitForSelector('.phone iframe', { timeout: 10000 })
  await page.waitForTimeout(600)

  const s25 = await page.evaluate(() => {
    const phone = document.querySelector('.phone')
    const iframe = document.querySelector('.phone iframe')
    if (!iframe) return null
    const doc = iframe.contentDocument
    if (!doc) return null
    const body = doc.body
    const els = [...body.querySelectorAll('*')]
    // "正文节点" = 直接含有非空文本子节点的元素（排除纯容器）
    const textNodes = els.filter((el) =>
      [...el.childNodes].some((n) => n.nodeType === 3 && String(n.textContent || '').trim().length > 0),
    )
    const imgs = [...body.querySelectorAll('img')]
    const srcs = imgs.map((i) => String(i.getAttribute('src') || ''))
    const text = body.innerText || ''
    return {
      phoneW: phone ? Math.round(phone.getBoundingClientRect().width) : -1,
      iframeW: Math.round(iframe.getBoundingClientRect().width),
      bodyW: getComputedStyle(body).width,
      injectedStyle: (doc.querySelector('style')?.textContent || '').replace(/\s+/g, ' '),
      textNodeCount: textNodes.length,
      textLen: text.length,
      imgCount: imgs.length,
      badSrcs: srcs.filter((s) => /^https?:/i.test(s)),
      okSrcs: srcs.filter((s) => /^(data:|blob:)/i.test(s)).length,
      hasArtMarker: text.includes('::: art') || text.includes('[[asset:') || text.includes('[[img'),
      hasSvgText: text.includes('<svg') || text.includes('&lt;svg'),
      sample: text.replace(/\s+/g, ' ').slice(0, 80),
    }
  })
  if (!s25) {
    checkS25('预览 iframe 可取到内容', false, '取不到 iframe 或 contentDocument')
  } else {
    checkS25('手机壳渲染宽度是 375px', s25.phoneW === 375, `phone=${s25.phoneW}px`)
    checkS25(
      'wrapSrcDoc 注入的预览 body 宽度声明是 375px',
      /body\{[^}]*width:375px/.test(s25.injectedStyle),
      `注入样式=${s25.injectedStyle.slice(0, 90)}`,
    )
    checkS25(
      '正文实际渲染宽度不超过 375px（max-width 生效，没被容器拉宽）',
      Number.parseFloat(s25.bodyW) > 0 && Number.parseFloat(s25.bodyW) <= 375,
      `body computed=${s25.bodyW} iframe=${s25.iframeW}px`,
    )
    checkS25('正文节点数 > 0 且可见文本足够长', s25.textNodeCount > 0 && s25.textLen > 200, `节点=${s25.textNodeCount} 文本=${s25.textLen}字`)
    checkS25('素材位都落成了图片（否则"src 都不是外链"会退化成恒真）', s25.imgCount >= SAMPLE_ART_SLOTS, `img=${s25.imgCount} 期望>=${SAMPLE_ART_SLOTS}`)
    checkS25(
      '每张 img 的 src 都是 data: 或 blob:（不得是 http/https）',
      s25.badSrcs.length === 0 && s25.okSrcs === s25.imgCount && s25.imgCount > 0,
      `合规=${s25.okSrcs}/${s25.imgCount} 外链=${JSON.stringify(s25.badSrcs.slice(0, 3))}`,
    )
    checkS25('可见文本没有 ::: art / [[asset: / [[img 协议残留', s25.hasArtMarker === false, `残留=${s25.hasArtMarker}`)
    checkS25('可见文本没有未渲染的 svg 文本', s25.hasSvgText === false, `残留=${s25.hasSvgText}`)
    console.log(`    INFO - S25 预览正文开头：${s25.sample}`)
  }
  await page.screenshot({ path: `${outDir}/wxmp-desktop-S25-375.png` })
} catch (e) {
  console.log('  FAIL - S25 375px 预览 error:', String(e).slice(0, 200))
  failed++
  judge.error('S25', String(e).slice(0, 200))
}

if (errors.length) {
  // 逐条打印成标准结论行：这样它同样被计入检查数与判定（不是"打印一行 + failed++"的另一套统计）
  console.log('browser errors:', errors.slice(0, 5))
  console.log(`  FAIL - 全程无浏览器错误 (${errors.length} 条：${errors.slice(0, 3).join(' / ')})`)
  failed++
  for (const e of errors.slice(0, 5)) judge.error('browser', e)
} else {
  console.log('  PASS - 全程无浏览器错误')
}
await browser.close()
// 判定与退出码一律由唯一 RunResult 派生（PASS=0 / FAIL=1 / ERROR=1 / BLOCKED=2）：
// `failed===0` 不再能单独推导出"通过"——零条结论行会被判成 ERROR（指南 §3.1）。
judge.run.__failedLines = failed
judge.finish({ label: 'VERIFY', extraFiles: { 'stdout-summary.json': JSON.stringify({ failed, checks: judge.run.checks.length }, null, 2) + '\n' } })
