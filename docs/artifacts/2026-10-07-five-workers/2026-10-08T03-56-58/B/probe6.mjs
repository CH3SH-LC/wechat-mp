// B 路一次性探针 6：核对"超出画布能力"这条路径给的是**准确错误**而不是静默空图。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
const browser = await pw.chromium.launch({ headless: true, executablePath: exe })
const page = await browser.newPage()
await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
const out = await page.evaluate(async () => {
  const { renderArticleImages } = await import('/src/lib/htmlToImage.ts')
  const res = {}
  const tryIt = async (label, html) => {
    try {
      const r = await renderArticleImages(html)
      res[label] = { ok: true, cssH: r.cssH, pages: r.pages.length, longLen: r.long.length }
    } catch (e) {
      res[label] = { ok: false, err: String(e && e.message ? e.message : e) }
    }
  }
  await tryIt('空正文', '<p></p>')
  // 32767 CSS px 是 65535 设备像素的分界：正好在边界内、刚过边界各测一次
  await tryIt('正好 32700 CSS px', '<div style="height:32700px;background:#eef"></div>')
  await tryIt('超出 32800 CSS px', '<div style="height:32800px;background:#eef"></div>')
  return res
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
