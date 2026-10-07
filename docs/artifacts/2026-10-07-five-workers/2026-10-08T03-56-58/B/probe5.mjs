// B 路一次性探针 5：把 text 夹具在旧切点 4000 CSS px 附近的原始像素放大存成 PNG，用于目视核对。
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
const OUT = process.argv[2]
const src = readFileSync('D:/deepseek-harness/wechat-mp-desktop/scripts/fixtures/2026-10-07-safe-paging/text.md', 'utf8')
const browser = await pw.chromium.launch({ headless: true, executablePath: exe })
const page = await browser.newPage()
await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
const out = await page.evaluate(async ({ src }) => {
  const { composeMarkdown } = await import('/src/lib/compose.ts')
  const { renderArticleImages } = await import('/src/lib/htmlToImage.ts')
  const html = composeMarkdown(src, {}).html
  const r = await renderArticleImages(html)
  const im = new Image()
  im.src = r.long
  await im.decode()
  const cv = document.createElement('canvas')
  cv.width = im.naturalWidth
  cv.height = im.naturalHeight
  cv.getContext('2d').drawImage(im, 0, 0)
  /** 取 [y0,y1) 行、横向整幅，放大 z 倍；在 cutPx 处画红线 */
  const strip = (y0, y1, cutPx, z) => {
    const c = document.createElement('canvas')
    c.width = cv.width * z
    c.height = (y1 - y0) * z
    const x = c.getContext('2d')
    x.imageSmoothingEnabled = false
    x.fillStyle = '#fff'
    x.fillRect(0, 0, c.width, c.height)
    x.drawImage(cv, 0, y0, cv.width, y1 - y0, 0, 0, c.width, c.height)
    if (cutPx > y0 && cutPx < y1) {
      x.fillStyle = '#e60000'
      x.fillRect(0, (cutPx - y0) * z, c.width, Math.max(1, z / 2))
    }
    return c.toDataURL('image/png')
  }
  return {
    cssH: r.cssH,
    cuts: r.cutsPx,
    oldStrip: strip(7940, 8060, 8000, 3), // 旧切点 4000 CSS px（设备 8000）附近 ±60 行
    newStrip: strip(7928, 8048, 7988, 3), // 新切点 3994 CSS px（设备 7988）附近
  }
}, { src })
writeFileSync(OUT + '/seams/text-旧切线4000CSS-长图原始像素x3.png', Buffer.from(out.oldStrip.split(',')[1], 'base64'))
writeFileSync(OUT + '/seams/text-新切线3994CSS-长图原始像素x3.png', Buffer.from(out.newStrip.split(',')[1], 'base64'))
console.log('cssH', out.cssH, 'cuts', JSON.stringify(out.cuts))
await browser.close()
