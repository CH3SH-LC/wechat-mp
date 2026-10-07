// E 路 阶段二：二分定位 —— 同一次会话里跑"生产链路 html"与"我的探针 html"，把两者差异缩到最小。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
function resolvePlaywright() {
  for (const m of ['playwright-core', 'playwright']) { try { return require(m) } catch { /* next */ } }
  const c = process.env.VERIFY_PLAYWRIGHT || join(process.env.TEMP, 'pw-deps', 'node_modules', 'playwright-core')
  return require(isAbsolute(c) ? c : resolve(process.cwd(), c))
}
const pw = resolvePlaywright()
const EXE = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>'
const SRC = `## 小节标题\n\n正文一段。\n\n::: art wide 秋日书单插画\n\n${SVG}\n\n:::\n\n正文另一段。\n`

const server = await createServer({ root: join(here, 'candidate'), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1516, strictPort: true } })
await server.listen()
const browser = await pw.chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
await page.goto('http://127.0.0.1:1516/', { waitUntil: 'commit', timeout: 120000 })
await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

const out = await page.evaluate(async (SRC) => {
  const compose = await import('/src/lib/compose.ts')
  const art = await import('/src/lib/artRender.ts')
  const h2i = await import('/src/lib/htmlToImage.ts')
  const c = compose.composeMarkdown(SRC, {})
  const prodHtml = await art.renderArtPlaceholders(c.html, (c.arts ?? []).map((a) => ({ svg: a.svg })))
  const imgTag = (prodHtml.match(/<img[^>]*>/) || [''])[0]
  const srcUri = (imgTag.match(/src="([^"]*)"/) || [])[1] || ''
  const canvasPng = (() => { const k = document.createElement('canvas'); k.width = 200; k.height = 120; const x = k.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 200, 120); return k.toDataURL('image/png') })()

  const variants = {
    'A-prod-html': prodHtml,
    'B-p+prod-img-verbatim': '<p>a</p>' + imgTag,
    'C-p+img-same-src-no-style': '<p>a</p><img src="' + srcUri + '">',
    'D-p+img-same-src-fulltag-no-alt': '<p>a</p><img src="' + srcUri + '" style="width:100%;height:auto;display:block;margin:12px 0;border-radius:8px" />',
    'E-p+canvas-png': '<p>a</p><img style="display:block;width:200px;height:120px" src="' + canvasPng + '">',
    'F-empty-doc+canvas-png': '<img style="display:block;width:200px;height:120px" src="' + canvasPng + '">',
  }
  const res = {}
  for (const [k, html] of Object.entries(variants)) {
    try { const rr = await h2i.renderArticleImages(html); res[k] = { ok: true, cssH: rr.cssH } }
    catch (e) { res[k] = { ok: false, err: String(e).slice(0, 70) } }
  }
  return { srcUriHead: srcUri.slice(0, 40), srcUriLen: srcUri.length, canvasPngHead: canvasPng.slice(0, 40), imgTag: imgTag.slice(0, 160), prodHtmlLen: prodHtml.length, res }
}, SRC)
await browser.close(); await server.close()

console.log('生产 img 标签：', JSON.stringify(out.imgTag))
console.log('生产 src 头：', out.srcUriHead, 'len=', out.srcUriLen)
console.log('canvas png 头：', out.canvasPngHead)
for (const [k, v] of Object.entries(out.res)) console.log(`  ${k}: ${v.ok ? 'OK cssH=' + v.cssH : 'ERR ' + v.err}`)
writeFileSync(join(outDir, 'phase2-b-bisect.json'), JSON.stringify(out, null, 2))
console.log('写出：', join(outDir, 'phase2-b-bisect.json'))
