// B 路一次性几何探针（非交付物）：量三夹具的高度、旧切点穿越情况、新切点位置，用于调夹具。
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
const FIX = 'D:/deepseek-harness/wechat-mp-desktop/scripts/fixtures/2026-10-07-safe-paging'
const which = process.argv[2] || 'text'

const src = readFileSync(join(FIX, which + '.md'), 'utf8')
const browser = await pw.chromium.launch({ headless: true, executablePath: exe })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror:', String(e).split('\n')[0]))
await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
const out = await page.evaluate(
  async ({ src }) => {
    const { composeMarkdown } = await import('/src/lib/compose.ts')
    const { renderArtPlaceholders } = await import('/src/lib/artRender.ts')
    const { renderArticleImages } = await import('/src/lib/htmlToImage.ts')
    const composed = composeMarkdown(src, {})
    const html = composed.arts && composed.arts.length ? await renderArtPlaceholders(composed.html, composed.arts) : composed.html

    const WIDTH = 375
    const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
    const host = document.createElement('div')
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;font-family:${FONT};`
    host.innerHTML = `<div style="width:${WIDTH}px;box-sizing:border-box">${html}</div>`
    document.body.appendChild(host)
    await Promise.all([...host.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const top0 = host.getBoundingClientRect().top
    const cssH = Math.ceil(host.getBoundingClientRect().height)

    const rects = []
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue
      range.selectNodeContents(n)
      for (const r of Array.from(range.getClientRects())) {
        if (r.width > 0 && r.height > 0)
          rects.push({ top: r.top - top0, bottom: r.bottom - top0, kind: 'text', text: String(n.nodeValue).trim().slice(0, 18) })
      }
    }
    for (const el of host.querySelectorAll('img,svg')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0)
        rects.push({ top: r.top - top0, bottom: r.bottom - top0, kind: el.tagName.toLowerCase(), text: (el.getAttribute('alt') || '').slice(0, 18) })
    }
    for (const el of host.querySelectorAll('tr')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) rects.push({ top: r.top - top0, bottom: r.bottom - top0, kind: 'tr', text: (el.textContent || '').trim().slice(0, 18) })
    }
    const cross = (cut) => rects.filter((x) => x.top + 0.5 < cut && cut < x.bottom - 0.5)
    host.remove()

    const r = await renderArticleImages(html)
    const cutsCss = r.cutsPx.map((v) => v / 2)
    const oldCss = []
    for (let k = 1000; k < cssH; k += 1000) oldCss.push(k)
    return {
      htmlLen: html.length,
      arts: (composed.arts || []).length,
      warnings: (composed.warnings || []).slice(0, 4),
      cssH,
      rectCount: rects.length,
      imgRects: rects.filter((x) => x.kind !== 'text').map((x) => `${x.kind}「${x.text}」y=${Math.round(x.top)}..${Math.round(x.bottom)}`),
      longH: r.cutsPx[r.cutsPx.length - 1],
      cutsCss,
      pageCount: r.pages.length,
      pageCssH: r.pages.map((_, i) => (r.cutsPx[i + 1] - r.cutsPx[i]) / 2),
      oversize: r.oversize.map((o) => ({ startCss: o.startPx / 2, endCss: o.endPx / 2, hCss: o.hPx / 2 })),
      oldCss,
      oldCross: oldCss.map((c) => ({ c, hits: cross(c).map((x) => `${x.kind}「${x.text}」h=${Math.round(x.bottom - x.top)} cross=${Math.round(x.bottom - c)}`) })),
      newCross: cutsCss.slice(1, -1).map((c) => ({ c, hits: cross(c).map((x) => `${x.kind}「${x.text}」`) })),
    }
  },
  { src },
)
console.log(JSON.stringify(out, null, 1))
await browser.close()
