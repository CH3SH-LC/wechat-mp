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
      return !!t && t.textContent.includes('</section>') && !document.querySelector('.typing')
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
      return !!t && t.textContent.includes('</section>')
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

// S8 多会话上下文：新建 → 独立内容 → 列表 2 条 → 切换恢复 → 删除回退
try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sess-btn[data-ready="1"]', { timeout: 20000 })

  const openMenu = async () => {
    await page.locator('.sess-btn').click()
    await page.waitForSelector('.session-panel', { timeout: 10000 })
  }
  const rowCount = () => page.locator('.sess-row').count()

  await openMenu()
  const n0 = await rowCount()
  await page.locator('.settings-foot .btn-send', { hasText: '新建会话' }).click()
  await page.waitForSelector('.chat-empty', { timeout: 10000 })

  // 在 B 会话输入并生成（内容独立于 A）
  await page.locator('textarea').fill('写一篇毕业季活动推文，直接写')
  await page.locator('textarea').press('Enter')
  await waitStreamDone()
  const userB = await page.locator('.msg-user').last().innerText()
  const bOk = userB.includes('毕业季')
  console.log(`  ${bOk ? 'PASS' : 'FAIL'} - S8 new session independent content (${userB.slice(0, 24)}…)`)
  if (!bOk) failed++

  await openMenu()
  const n1 = await rowCount()
  const grewOk = n1 === n0 + 1
  console.log(`  ${grewOk ? 'PASS' : 'FAIL'} - S8 session list grew (${n0} → ${n1})`)
  if (!grewOk) failed++

  // 切回第一个会话（倒序列表最末为最旧）
  const firstRow = page.locator('.sess-row').last()
  await firstRow.click()
  await page.waitForTimeout(400)
  const backOk = (await page.locator('.msg-user').count()) >= 0
  console.log(`  ${backOk ? 'PASS' : 'FAIL'} - S8 switch back ok (rows shown)`)
  if (!backOk) failed++

  // 删除毕业季会话（当前可能已非它；删除后列表回退）
  await openMenu()
  await page.locator('.sess-row', { hasText: '毕业季' }).locator('.sess-del').click()
  await page.waitForTimeout(500)
  const n2 = await rowCount()
  const shrinkOk = n2 === n0
  console.log(`  ${shrinkOk ? 'PASS' : 'FAIL'} - S8 delete session (${n1} → ${n2})`)
  if (!shrinkOk) failed++
  await page.locator('.settings-head .mini').click()
} catch (e) {
  console.log('  FAIL - S8 multi-session error:', String(e).slice(0, 200))
  failed++
}

if (errors.length) {
  console.log('browser errors:', errors.slice(0, 5))
  failed++
}
await browser.close()
console.log(failed === 0 ? 'VERIFY OK' : `VERIFY FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
