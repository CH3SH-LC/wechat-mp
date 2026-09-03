// verify-ui.mjs —— 纯浏览器模式端到端冒烟：点示例 → 模拟流式对话 → 右侧 375px 预览渲染
// 用法: node scripts/verify-ui.mjs [截图输出路径] [页面URL]
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const out = process.argv[2] || 'verify-ui.png'
const url = process.argv[3] || 'http://127.0.0.1:1420'
const errors = []

const browser = await chromium.launch({
  executablePath: 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('.chip-primary', { timeout: 20000 })
const statusText = await page.locator('.chat-head .badge').innerText()
console.log('[1] status badge =', statusText)

await page.locator('.chip-primary').click()
console.log('[2] clicked demo prompt, waiting for stream to finish...')

try {
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.msg-assistant-text')
      return !!t && t.textContent.includes('</section>') && !document.querySelector('.typing')
    },
    { timeout: 30000 },
  )
} catch {
  console.log('  TIMEOUT waiting for stream; page errors so far:')
  for (const e of errors) console.log('  -', e)
  const state = await page.locator('.chat-body').innerText().catch(() => '')
  console.log('  chat body state:', state.slice(0, 300).replace(/\n/g, ' '))
  await page.screenshot({ path: 'verify-ui-timeout.png' })
  await browser.close()
  process.exit(1)
}
await page.waitForTimeout(400)

const note = await page.locator('.knowledge-note').innerText().catch(() => '')
console.log('[3] knowledge note =', note)

const assistant = await page.locator('.msg-assistant-text').last().innerText()
console.log('[4] assistant text length =', assistant.length, '| has fence =', assistant.includes('```html'))

const frames = page.frames().filter((f) => f !== page.mainFrame())
if (!frames.length) throw new Error('no iframe frame found')
const bodyText = await frames[0].locator('body').innerText()
console.log('[5] preview body text head =', bodyText.slice(0, 60).replace(/\n/g, ' '))

await page.screenshot({ path: out, fullPage: false })
console.log('[6] screenshot saved:', out)

const checks = []
checks.push(['status shows mode', statusText.includes('模拟')])
checks.push(['fence present', assistant.includes('```html')])
checks.push(['preview rendered (non-empty)', bodyText.trim().length > 40])
checks.push(['preview has demo content', /典礼|流程|通知书|清单|开学/.test(bodyText)])

let failed = 0
for (const [name, ok] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`)
  if (!ok) failed++
}
if (errors.length) {
  console.log('browser errors:', errors.slice(0, 5))
  failed++
}
await browser.close()
console.log(failed === 0 ? 'VERIFY OK' : `VERIFY FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
