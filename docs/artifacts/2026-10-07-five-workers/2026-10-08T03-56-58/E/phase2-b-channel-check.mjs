// E 路 阶段二：弄清 compose 的"插画"到底走哪条 HTML 通道，以判定 <img> 光栅化限制的实际影响面。
//   (a) `::: art wide 名` + 内联 <svg>（B 夹具用的形状）→ compose 产出什么元素？
//   (b) `[[img:wide|说明]]`（协议里模型可写的占位）→ compose 产出什么元素？
// 然后各自渲染，看能不能过 renderArticleImages。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.E_ROOT || 'candidate'
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
function resolvePlaywright() {
  for (const m of ['playwright-core', 'playwright']) { try { return require(m) } catch { /* next */ } }
  const c = process.env.VERIFY_PLAYWRIGHT || join(process.env.TEMP, 'pw-deps', 'node_modules', 'playwright-core')
  return require(isAbsolute(c) ? c : resolve(process.cwd(), c))
}
const pw = resolvePlaywright()
const chromiumPath = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>'
const SRC_ART = `## 小节标题\n\n正文一段，用于占位。\n\n::: art wide 秋日书单插画\n\n${SVG}\n\n:::\n\n正文另一段。\n`
const SRC_IMG = `## 小节标题\n\n正文一段，用于占位。\n\n[[img:wide|开学典礼横幅插画：晨光中升旗台与旗帜]]\n\n正文另一段。\n`

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1514, strictPort: true } })
await server.listen()
const browser = await pw.chromium.launch({ executablePath: chromiumPath, headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
await page.goto('http://127.0.0.1:1514/', { waitUntil: 'commit', timeout: 120000 })
await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

const res = await page.evaluate(async ({ SRC_ART, SRC_IMG }) => {
  const compose = await import('/src/lib/compose.ts')
  const h2i = await import('/src/lib/htmlToImage.ts')
  const out = {}
  for (const [k, src] of [['art-block', SRC_ART], ['img-placeholder', SRC_IMG]]) {
    const r = compose.composeMarkdown(src, {})
    const html = r.html ?? ''
    const hasImg = /<img\b/i.test(html)
    const hasBareSvg = /<svg\b/i.test(html)
    let raster
    try { const rr = await h2i.renderArticleImages(html); raster = { ok: true, cssH: rr.cssH, pages: rr.pages.length } }
    catch (e) { raster = { ok: false, err: String(e).slice(0, 110) } }
    out[k] = { hasImg, hasBareSvg, htmlLen: html.length, warnings: r.warnings.length, imgSnippet: (html.match(/<img[^>]{0,90}/i) || [''])[0], raster }
  }
  return out
}, { SRC_ART, SRC_IMG })
await browser.close()
await server.close()

console.log(JSON.stringify(res, null, 1))
writeFileSync(join(outDir, `phase2-b-channel-${ROOT}.json`), JSON.stringify(res, null, 2))
console.log('写出：', join(outDir, `phase2-b-channel-${ROOT}.json`))
