// E 路 阶段二：<img> 抛错是否**可重复**（竞态）而非稳定限制。
// 同一页面会话内，每个变体重复 N 次，统计 OK/ERR。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'out'); mkdirSync(outDir, { recursive: true })
function resolvePlaywright() {
  for (const m of ['playwright-core', 'playwright']) { try { return require(m) } catch { /* next */ } }
  const c = process.env.VERIFY_PLAYWRIGHT || join(process.env.TEMP, 'pw-deps', 'node_modules', 'playwright-core')
  return require(isAbsolute(c) ? c : resolve(process.cwd(), c))
}
const pw = resolvePlaywright()
const EXE = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>'
const SRC = `## 小节标题\n\n正文一段。\n\n::: art wide 秋日书单插画\n\n${SVG}\n\n:::\n\n正文另一段。\n`

const N = Number(process.env.E_REPEAT || 8)
const server = await createServer({ root: join(here, 'candidate'), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1517, strictPort: true } })
await server.listen()
const browser = await pw.chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
await page.goto('http://127.0.0.1:1517/', { waitUntil: 'commit', timeout: 120000 })
await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

const out = await page.evaluate(async ({ SRC, N, SVG }) => {
  const compose = await import('/src/lib/compose.ts')
  const art = await import('/src/lib/artRender.ts')
  const h2i = await import('/src/lib/htmlToImage.ts')
  const c = compose.composeMarkdown(SRC, {})
  const prodHtml = await art.renderArtPlaceholders(c.html, (c.arts ?? []).map((a) => ({ svg: a.svg })))
  const imgTag = (prodHtml.match(/<img[^>]*>/) || [''])[0]
  const srcUri = (imgTag.match(/src="([^"]*)"/) || [])[1] || ''
  const bigHtml = prodHtml.replace(/<svg\b[\s\S]*?<\/svg>/g, '')
  const variants = {
    'prod-html': prodHtml,
    'bare-img': '<p>a</p><img src="' + srcUri + '">',
    'styled-img': '<p>a</p><img src="' + srcUri + '" style="width:100%;height:auto;display:block;margin:12px 0;border-radius:8px" />',
    'inline-svg': prodHtml.replace(imgTag, SVG),
  }
  const res = {}
  for (const [k, html] of Object.entries(variants)) {
    let ok = 0, err = 0, firstErr = ''
    for (let i = 0; i < N; i++) {
      try { await h2i.renderArticleImages(html); ok++ }
      catch (e) { err++; if (!firstErr) firstErr = String(e).slice(0, 60) }
    }
    res[k] = { ok, err, n: N, firstErr, flaky: ok > 0 && err > 0 }
  }
  return res
}, { SRC, N, SVG })
await browser.close(); await server.close()

for (const [k, v] of Object.entries(out)) console.log(`  ${k}: OK ${v.ok}/${v.n}，ERR ${v.err}/${v.n}${v.flaky ? '  ← 不稳定（竞态）' : ''}${v.firstErr ? '  err=' + v.firstErr : ''}`)
writeFileSync(join(outDir, 'phase2-b-repeat.json'), JSON.stringify({ N, out }, null, 2))
console.log('写出：', join(outDir, 'phase2-b-repeat.json'))
