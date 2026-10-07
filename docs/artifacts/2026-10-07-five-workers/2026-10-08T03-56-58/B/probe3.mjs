// B 路一次性探针 3：量出本 runner 的 Chromium 画布能力上限（宽固定 750 时的高度上限）。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
const browser = await pw.chromium.launch({ headless: true, executablePath: exe })
const page = await browser.newPage()
await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
const out = await page.evaluate(() => {
  const test = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const x = c.getContext('2d')
    if (!x) return { w, h, ctx: false }
    x.fillStyle = '#123456'; x.fillRect(0, 0, w, h)
    let urlLen = 0, err = null
    try { urlLen = c.toDataURL('image/png').length } catch (e) { err = String(e) }
    // 回读一个像素，判断是不是真的画上去了
    let px = null
    try { const d = x.getImageData(0, 0, 1, 1).data; px = [d[0], d[1], d[2]] } catch (e) { px = 'ERR:' + e }
    return { w, h, urlLen, px, err }
  }
  const res = {}
  for (const h of [2000, 16000, 16384, 16385, 32767, 32768, 65535, 65536, 70000]) res['h' + h] = test(750, h)
  res.area_750x357913 = test(750, 357913).urlLen
  return res
})
console.log(JSON.stringify(out, null, 2))
await browser.close()
