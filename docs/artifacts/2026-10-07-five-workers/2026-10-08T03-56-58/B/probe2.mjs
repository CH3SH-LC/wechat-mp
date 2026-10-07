// B 路一次性探针 2：<img> 在 foreignObject 里到底有没有真的画出来（按像素判定）。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
const browser = await pw.chromium.launch({ headless: true, executablePath: exe })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror:', String(e).split('\n')[0]))
await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })

const out = await page.evaluate(async () => {
  const { renderArticleImages } = await import('/src/lib/htmlToImage.ts')
  const res = {}
  // 生成一张纯色 PNG data URL
  const png = (() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 200
    const x = c.getContext('2d'); x.fillStyle = '#e11'; x.fillRect(0, 0, 300, 200)
    return c.toDataURL('image/png')
  })()
  const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#11e"/></svg>')

  const probe = async (label, imgSrc) => {
    const html = '<p style="margin:0 0 12px;font-size:16px">之前。</p>' +
      '<img src="' + imgSrc + '" style="width:300px;height:200px;display:block" />'
    try {
      const r = await renderArticleImages(html)
      // 统计长图里"强饱和"像素（红或蓝），确认图片真的画进去
      const im = new Image(); im.src = r.long; await im.decode()
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight
      const x = c.getContext('2d'); x.drawImage(im, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      let red = 0, blue = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 180 && d[i + 1] < 100 && d[i + 2] < 100) red++
        else if (d[i + 2] > 180 && d[i] < 100 && d[i + 1] < 100) blue++
      }
      res[label] = { ok: true, cssH: r.cssH, longH: c.height, red, blue }
    } catch (e) { res[label] = { ok: false, err: String(e) } }
  }
  await probe('img_png', png)
  await probe('img_svg', svgData)
  return res
})
console.log(JSON.stringify(out, null, 2))
await browser.close()
