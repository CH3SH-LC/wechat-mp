// E 路 阶段二：同一段标记，在**多次独立浏览器启动**之间是否稳定？
// 用来判定 <img> 光栅化失败是"标记的属性"还是"进程/会话级的不稳定"。
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
const ROOT = process.env.E_ROOT || 'candidate'
const LAUNCHES = Number(process.env.E_LAUNCHES || 6)

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1520, strictPort: true } })
await server.listen()

// 先固定一组 src
const b0 = await pw.chromium.launch({ executablePath: EXE, headless: true })
const p0 = await b0.newPage()
await p0.goto('http://127.0.0.1:1520/', { waitUntil: 'commit', timeout: 120000 })
await p0.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })
const srcs = await p0.evaluate(async () => {
  const art = await import('/src/lib/artRender.ts')
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>'
  return { prod: await art.svgToPngDataUri(svg) }
})
await b0.close()

const MARKUPS = {
  'no-style': `<p>a</p><img src="${srcs.prod}">`,
  'style-width100-only': `<p>a</p><img src="${srcs.prod}" style="width:100%">`,
  'prod-style-full': `<p>a</p><img src="${srcs.prod}" alt="" style="width:100%;height:auto;display:block;margin:12px 0;border-radius:8px" />`,
}

const grid = {}
for (const k of Object.keys(MARKUPS)) grid[k] = []
for (let L = 0; L < LAUNCHES; L++) {
  const browser = await pw.chromium.launch({ executablePath: EXE, headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  await page.goto('http://127.0.0.1:1520/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })
  const r = await page.evaluate(async (MARKUPS) => {
    const out = {}
    for (const [k, html] of Object.entries(MARKUPS)) {
      let ok = 0
      for (let i = 0; i < 2; i++) { try { const m = await import('/src/lib/htmlToImage.ts'); await m.renderArticleImages(html); ok++ } catch (e) { /* err */ } }
      out[k] = ok
    }
    return out
  }, MARKUPS)
  await browser.close()
  for (const k of Object.keys(MARKUPS)) grid[k].push(r[k])
  console.log(`launch#${L + 1}: ` + Object.entries(r).map(([k, v]) => `${k}=${v}/2`).join('  '))
}
await server.close()

const summary = {}
for (const [k, arr] of Object.entries(grid)) {
  const total = arr.reduce((a, b) => a + b, 0), max = arr.length * 2
  summary[k] = { ok: total, of: max, perLaunch: arr, stable: new Set(arr).size === 1 }
  console.log(`\n${k}: ${total}/${max}；每次启动=${JSON.stringify(arr)}；稳定=${summary[k].stable}`)
}
writeFileSync(join(outDir, `phase2-b-session-${ROOT}.json`), JSON.stringify({ launches: LAUNCHES, summary }, null, 2))
console.log('\n写出：', join(outDir, `phase2-b-session-${ROOT}.json`))
