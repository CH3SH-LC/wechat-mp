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
  const stored = await page.evaluate(() => localStorage.getItem('wxmp-draft-v1'))
  const clearOk = stored === null
  console.log(`  ${clearOk ? 'PASS' : 'FAIL'} - S1.6 clear wipes storage`)
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

if (errors.length) {
  console.log('browser errors:', errors.slice(0, 5))
  failed++
}
await browser.close()
console.log(failed === 0 ? 'VERIFY OK' : `VERIFY FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
