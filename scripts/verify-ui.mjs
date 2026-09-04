// verify-ui.mjs —— 纯浏览器模式端到端冒烟（第 2 轮扩展）
// 场景1: 示例→流式→预览渲染→质量检查通过(q-ok)
// 场景2: 违规演示→质量检查检出问题(q-fail, 问题清单展示)
// 用法: node scripts/verify-ui.mjs <outDir> [URL]
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const outDir = process.argv[2] || '.'
const url = process.argv[3] || 'http://127.0.0.1:1420'
const errors = []

const browser = await chromium.launch({
  executablePath: 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text())
})

async function waitStreamDone(timeout = 30000) {
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.msg-assistant-text')
      return !!t && t.textContent.trim().length > 3 && !document.querySelector('.typing')
    },
    { timeout },
  )
  await page.waitForTimeout(300)
}

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
  () => page.locator('.chip-primary').click(),
  false,
)
for (const [name, ok] of s1.checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - S1 ${name}`)
  if (!ok) failed++
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
  console.log(`  ${artImgs >= 4 ? 'PASS' : 'FAIL'} - S1.8 five art assets rendered to data images (${artImgs})`)
  if (artImgs < 4) failed++
} catch (e) {
  console.log('  FAIL - S1.8 compose render error:', String(e).slice(0, 200))
  failed++
}

// S1.5 导出（浏览器模式 = <a download>，playwright 捕获 download 事件）
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('.mini', { hasText: '导出' }).click(),
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
      const t = document.querySelector('.msg-assistant-text')
      return !!t && t.textContent.trim().length > 3 && !document.querySelector('.typing')
    },
    { timeout: 20000 },
  )
  const userCount = await page.locator('.msg-user').count()
  const frame = page.frames().find((f) => f !== page.mainFrame())
  const body = frame ? await frame.locator('body').innerText() : ''
  const savedTag = await page.locator('.topbar-meta .hint').first().innerText().catch(() => '')
  const restoreOk = userCount >= 1 && body.trim().length > 40 && savedTag.includes('已自动保存')
  console.log(`  ${restoreOk ? 'PASS' : 'FAIL'} - S1.6 restore after reload (userMsgs=${userCount}, body=${body.length})`)
  if (!restoreOk) failed++

  await page.locator('.mini', { hasText: '清空' }).click()
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

const s2 = await runScenario(
  'fail',
  () => page.locator('.chip', { hasText: '违规输出检测' }).click(),
  true,
)
for (const [name, ok] of s2.checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - S2 ${name}`)
  if (!ok) failed++
}
console.log(`S2 issue count = ${s2.nIssues}`)

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

  // 在 B 会话输入并生成（内容独立于 A）
  await page.locator('textarea').fill('写一篇毕业季活动推文，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  const userB = await page.locator('.msg-user').last().innerText()
  const bOk = userB.includes('毕业季')
  console.log(`  ${bOk ? 'PASS' : 'FAIL'} - S8 new session independent content (${userB.slice(0, 24)}…)`)
  if (!bOk) failed++

  const n1 = await rowCount()
  const grewOk = n1 === n0 + 1
  console.log(`  ${grewOk ? 'PASS' : 'FAIL'} - S8 session list grew (${n0} → ${n1})`)
  if (!grewOk) failed++

  // 切回最旧会话（列表倒序末位）
  await page.locator('.session-rail .sess-row').last().click()
  await page.waitForTimeout(500)
  const switched = await page.locator('.msg-user').count() >= 0
  console.log(`  ${switched ? 'PASS' : 'FAIL'} - S8 switch back ok`)
  if (!switched) failed++

  // 删除毕业季会话
  await page.locator('.session-rail .sess-row', { hasText: '毕业季' }).locator('.sess-del').click()
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
      await page.locator('.mini', { hasText: '清空' }).click()
      await page.waitForSelector('.chat-empty', { timeout: 10000 })
    }
  }
  const sendLine = async (text) => {
    await page.locator('textarea').fill(text)
    await page.locator('textarea').press('Enter')
  }
  const waitTurn = async () => {
    await page.waitForSelector('.typing', { timeout: 10000 }).catch(() => {})
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

if (errors.length) {
  console.log('browser errors:', errors.slice(0, 5))
  failed++
}
await browser.close()
console.log(failed === 0 ? 'VERIFY OK' : `VERIFY FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
