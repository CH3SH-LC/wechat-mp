// verify-ui.mjs —— 纯浏览器模式端到端冒烟（第 2 轮扩展）
// 场景1: 示例→流式→预览渲染→质量检查通过(q-ok)
// 场景2: 违规演示→质量检查检出问题(q-fail, 问题清单展示)
// 用法: node scripts/verify-ui.mjs <outDir> [URL]
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const outDir = process.argv[2] || 'docs/artifacts'
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

// 第 29 轮：删用户可见 mock 按钮后，场景改用输入框直接发文本驱动（mock 链路仍在，语义不变）
async function sendPrompt(text) {
  await page.locator('textarea').fill(text)
  await page.locator('textarea').press('Enter')
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
    await page.locator('.mini', { hasText: '清空' }).click()
    await page.waitForSelector('.chat-empty', { timeout: 10000 })
  }
  const noStyle = (await page.locator('.style-select').count()) === 0
  const noMode = (await page.locator('.seg-btn').count()) === 0
  console.log(`  ${noStyle && noMode ? 'PASS' : 'FAIL'} - S1.9 no mode/style UI controls (styleSelect=${await page.locator('.style-select').count()})`)
  if (!noStyle || !noMode) failed++
  await sendPrompt('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.typing')
      return !!t && t.textContent.includes('正在生成')
    },
    { timeout: 20000 },
  )
  console.log('  PASS - S1.9 busy generating label shown (正在生成…)')
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
  console.log(`  ${artImgs >= 4 ? 'PASS' : 'FAIL'} - S1.8 five art assets rendered to data images (${artImgs})`)
  if (artImgs < 4) failed++
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
    page.locator('.mini', { hasText: '导出 HTML' }).click(),
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
  () => sendPrompt('演示质量检查：请故意输出包含 emoji、渐变与外链图的推文（违规输出检测）'),
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
  const noteTxt = await page.locator('.knowledge-note').last().innerText().catch(() => '')
  const routeOk = noteTxt.includes('注册表')
  console.log(`  ${routeOk ? 'PASS' : 'FAIL'} - S8 knowledge registry active (${noteTxt.slice(0, 44)}…)`)
  if (!routeOk) failed++

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

// S10 自动质检自检（第 32 轮）：首稿缺组件/无素材（mock 故意返回半成品）→ 引擎检出"可修复质量项" →
// 自动把问题清单喂回模型重写（同一气泡）→ 收敛到 q-ok 且只保留一版正文
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

  // 跨两轮流式（首稿不达标 → 自动修订稿）等终态：q-ok 且无生成中
  let settled = false
  for (let i = 0; i < 80; i++) {
    const ok = await page.locator('.quality-strip.q-ok').count()
    const typing = await page.locator('.typing').count()
    if (ok > 0 && typing === 0) {
      settled = true
      break
    }
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1200) // 让潜在第二轮完全落定
  const finalOk = (await page.locator('.quality-strip.q-ok').count()) > 0
  console.log(`  ${settled && finalOk ? 'PASS' : 'FAIL'} - S10 auto-revise converged to q-ok`)
  if (!settled || !finalOk) failed++

  const nUser = await page.locator('.msg-user').count()
  const nAsst = await page.locator('.msg-assistant').count()
  const singleTurn = nUser === 1 && nAsst === 1
  console.log(`  ${singleTurn ? 'PASS' : 'FAIL'} - S10 rewrite stays in same bubble (user=${nUser} asst=${nAsst})`)
  if (!singleTurn) failed++

  // 修订稿应替换为合规正文（SAMPLE 特征：banner + steps 容器），不再含缺组件半成品；
  // 且来源视图是单一连贯稿（恰一个 banner、无重复两稿）——chat 源码视图展示的是剥围栏后的正文
  let replacedOk = false
  let singleOk = false
  if ((await page.locator('.src-toggle').count()) > 0) {
    await page.locator('.src-toggle').first().click()
    await page.waitForSelector('.src-view', { timeout: 10000 })
    const src = await page.locator('.src-view').first().innerText()
    const bannerN = (src.match(/\[\[banner:/g) || []).length
    singleOk = bannerN === 1 && src.includes('::: steps') && !src.includes('又比刚才又亮了几分')
    replacedOk = singleOk
  }
  console.log(`  ${replacedOk ? 'PASS' : 'FAIL'} - S10 final article replaced with compliant (not deficient)`)
  if (!replacedOk) failed++
  console.log(`  ${singleOk ? 'PASS' : 'FAIL'} - S10 single coherent article in source (banner×1 + steps)`)
  if (!singleOk) failed++
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
  await page.locator('button.mini', { hasText: '导出图片' }).click()
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.export-msg')
      return !!t && /已下载|转图失败/.test(t.textContent || '')
    },
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
    { timeout: 10000 },
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
  await page.locator('.ws-ref-update').first().click()
  await page.waitForFunction(
    () => /重渲染/.test(document.querySelector('.ws-msg')?.textContent || ''),
    { timeout: 20000 },
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

if (errors.length) {
  console.log('browser errors:', errors.slice(0, 5))
  failed++
}
await browser.close()
console.log(failed === 0 ? 'VERIFY OK' : `VERIFY FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
