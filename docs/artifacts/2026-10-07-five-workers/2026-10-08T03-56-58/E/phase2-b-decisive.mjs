// E 路 阶段二：<img> 争点的决定性实验。
// 1) 走**生产两步链路**：composeMarkdown(`::: art` 内联 SVG) → renderArtPlaceholders（artRender 产出的 data: URI）→ renderArticleImages
//    —— 若这里抛 EncodingError，则"含插画的文章在本机 Chromium 无法导出"是**生产链路**的事实，而非夹具怪癖。
// 2) 用**不指定 executablePath** 的默认解析启动（B 若未设 VERIFY_CHROMIUM 就会走这条），报告实际用的是哪个构建、结果是否不同。
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
const EXPLICIT = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>'
const SRC = `## 小节标题\n\n正文一段。\n\n::: art wide 秋日书单插画\n\n${SVG}\n\n:::\n\n正文另一段。\n`

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1515, strictPort: true } })
await server.listen()

const out = { root: ROOT, runs: [] }
for (const variant of [
  { name: 'explicit-chrome.exe', opts: { executablePath: EXPLICIT }, args: [] },
  { name: 'explicit-chrome.exe+gpu-off', opts: { executablePath: EXPLICIT }, args: ['--disable-gpu'] },
  { name: 'playwright-default-resolve', opts: {}, args: [] },
]) {
  let browser
  try { browser = await pw.chromium.launch({ headless: true, args: variant.args, ...variant.opts }) }
  catch (e) { out.runs.push({ variant: variant.name, launchError: String(e).slice(0, 160) }); continue }
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  await page.goto('http://127.0.0.1:1515/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })
  const r = await page.evaluate(async (SRC) => {
    const compose = await import('/src/lib/compose.ts')
    const art = await import('/src/lib/artRender.ts')
    const h2i = await import('/src/lib/htmlToImage.ts')
    const c = compose.composeMarkdown(SRC, {})
    // 生产链路：把 @@ARTn@@ 换成 artRender 产出的 data: URI
    const uris = []
    for (const a of (c.arts ?? [])) uris.push(await art.svgToPngDataUri(a.svg))
    const html = await art.renderArtPlaceholders(c.html, (c.arts ?? []).map((a) => ({ svg: a.svg })))
    const uriHeads = [...html.matchAll(/src="(data:[^;"]+)/g)].map((m) => m[1])
    let raster
    try { const rr = await h2i.renderArticleImages(html); raster = { ok: true, cssH: rr.cssH, pages: rr.pages.length } }
    catch (e) { raster = { ok: false, err: String(e).slice(0, 110) } }
    return { arts: (c.arts ?? []).length, uriHeads, unresolved: /@@ART\d+@@/.test(html), raster, probeUriLen: uris[0]?.length ?? 0 }
  }, SRC)
  out.runs.push({ variant: variant.name, version: browser.version(), args: variant.args, ...r })
  await browser.close()
  console.log(`\n[${variant.name}] chromium ${browser.version()} args=${JSON.stringify(variant.args)}`)
  console.log(`  arts=${r.arts} uriHeads=${JSON.stringify(r.uriHeads)} unresolved=${r.unresolved}`)
  console.log(`  生产链路 raster: ${r.raster.ok ? 'OK cssH=' + r.raster.cssH + ' pages=' + r.raster.pages : 'ERR ' + r.raster.err}`)
}
await server.close()
writeFileSync(join(outDir, `phase2-b-decisive-${ROOT}.json`), JSON.stringify(out, null, 2))
console.log('\n写出：', join(outDir, `phase2-b-decisive-${ROOT}.json`))
