// B 路一次性探针 4：把 text 夹具在旧切点 4000 CSS px 处的"跨缝墨迹"列位置打出来，核对指标不是假红。
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
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
  const ctx = cv.getContext('2d')
  const res = {}
  for (const cutCss of [4000, 3994]) {
    const cut = cutCss * 2
    const a = ctx.getImageData(0, cut - 1, cv.width, 1).data
    const b = ctx.getImageData(0, cut, cv.width, 1).data
    const dark = (d, i) => d[i + 3] > 8 && d[i] + d[i + 1] + d[i + 2] < 600
    const cols = []
    for (let x = 0; x < cv.width; x++) if (dark(a, x * 4) && dark(b, x * 4)) cols.push(x)
    // 把上面几行的墨迹分布也打出来，便于判断"是不是字形被劈开"
    const rowsInk = (y) => {
      const d = ctx.getImageData(0, y, cv.width, 1).data
      let n = 0
      for (let x = 0; x < cv.width; x++) if (dark(d, x * 4)) n++
      return n
    }
    res['cut' + cutCss] = {
      seamCols: cols.length,
      first: cols.slice(0, 8),
      last: cols.slice(-4),
      sample: cols.length ? [a[cols[0] * 4], a[cols[0] * 4 + 1], a[cols[0] * 4 + 2], a[cols[0] * 4 + 3]] : null,
      rows: [-8, -4, -2, -1, 0, 1, 2, 3, 4, 8].map((dy) => ({ dy, ink: rowsInk(cut + dy) })),
    }
  }
  return res
}, { src })
console.log(JSON.stringify(out, null, 1))
await browser.close()
