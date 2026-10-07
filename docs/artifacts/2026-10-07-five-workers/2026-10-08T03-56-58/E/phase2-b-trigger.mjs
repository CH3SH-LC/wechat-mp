// E 路 阶段二：干净矩阵 —— 每个用例一个**全新页面**（消除缓存/顺序影响），只改一个变量。
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
const N = Number(process.env.E_REPEAT || 3)

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1519, strictPort: true } })
await server.listen()
const browser = await pw.chromium.launch({ executablePath: EXE, headless: true })

async function fresh() {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  await page.goto('http://127.0.0.1:1519/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })
  return page
}

// 准备两种 src：production(artRender) 与 canvas 现场生成，尺寸一致
const p0 = await fresh()
const srcs = await p0.evaluate(async () => {
  const art = await import('/src/lib/artRender.ts')
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>'
  const prod = await art.svgToPngDataUri(svg)
  const c = document.createElement('canvas'); c.width = 300; c.height = 200
  const x = c.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 300, 200)
  const canv = c.toDataURL('image/png')
  return { prod, canv, prodBytes: prod.length, canvBytes: canv.length, prodHead: prod.slice(0, 70), canvHead: canv.slice(0, 70) }
})
await p0.close()
console.log('prod src:', srcs.prodBytes, 'B  head=', srcs.prodHead)
console.log('canv src:', srcs.canvBytes, 'B  head=', srcs.canvHead)

const styles=["width:100%;display:block", "width:100%;max-width:100%;display:block", "max-width:100%;display:block", "max-width:100%", "width:100%;max-width:100%", "max-width:100%;border-radius:8px;margin:12px 0;display:block"]
const out=[]
for (const st of styles){
  const html = `<p>a</p><img src="${srcs.prod}" alt="" style="${st}" />`
  let ok=0
  for (let i=0;i<2;i++){ const page=await fresh(); try{ await page.evaluate(async(h)=>{const m=await import('/src/lib/htmlToImage.ts');await m.renderArticleImages(h)},html); ok++ }catch(e){} await page.close() }
  out.push({st,ok,n:2}); console.log(`  ${ok}/2  ${st}`)
}
await browser.close(); await server.close()
writeFileSync(join(outDir, `phase2-b-matrix-${ROOT}.json`), JSON.stringify({ srcs: { prodBytes: srcs.prodBytes, canvBytes: srcs.canvBytes, prodHead: srcs.prodHead, canvHead: srcs.canvHead }, out }, null, 2))
console.log('写出：', join(outDir, `phase2-b-matrix-${ROOT}.json`))
