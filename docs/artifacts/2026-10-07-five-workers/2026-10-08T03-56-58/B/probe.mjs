// B 路一次性探针（非交付物）：确认 runner 的 Chromium 能否光栅化内联 <svg>，以及 <img> 的失败口径。
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
  const { exportArticleImages } = await import('/src/lib/exportImages.ts')
  const res = {}
  const stub = (sink) => {
    const prev = window.__TAURI_INTERNALS__
    window.__TAURI_INTERNALS__ = {
      ...(prev || {}),
      invoke: async (cmd, payload) => {
        sink.push({ cmd, files: (payload && payload.files) || [] })
        return 'STUB'
      },
    }
    return () => { window.__TAURI_INTERNALS__ = prev }
  }

  // A. 内联 <svg>
  const svgHtml =
    '<p style="margin:0 0 12px;font-size:16px;line-height:1.75">内联 SVG 之前。</p>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
    '<rect x="0" y="0" width="300" height="300" fill="#cfe0ff"/>' +
    '<circle cx="150" cy="150" r="100" fill="#3366cc"/></svg>' +
    '<p style="margin:12px 0 0;font-size:16px;line-height:1.75">内联 SVG 之后。</p>'
  try {
    const r = await renderArticleImages(svgHtml)
    res.inlineSvg = { ok: true, cssH: r.cssH, pages: r.pages.length, longLen: r.long.length }
  } catch (e) {
    res.inlineSvg = { ok: false, err: String(e) }
  }

  // B. <img>（预期失败）
  const imgHtml =
    '<p style="margin:0 0 12px;font-size:16px">图片之前。</p>' +
    '<img src="data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#f88"/></svg>') +
    '" style="width:300px;height:200px" />'
  try {
    const r = await renderArticleImages(imgHtml)
    res.img = { ok: true, cssH: r.cssH, pages: r.pages.length }
  } catch (e) {
    res.img = { ok: false, err: String(e) }
  }

  // C. 走 exportArticleImages（真实链路）确认内联 SVG 也能导出
  {
    const sink = []
    const restore = stub(sink)
    let r = null, err = null
    try { r = await exportArticleImages(svgHtml) } catch (e) { err = String(e) }
    restore()
    res.exportInlineSvg = { ok: r && r.ok, msg: r && r.msg, err, names: (sink[0] ? sink[0].files.map((f) => f.name) : []) }
  }
  return res
})

console.log(JSON.stringify(out, null, 2))
await browser.close()
