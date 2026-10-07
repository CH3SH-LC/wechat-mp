// E 路 阶段二：定位 <img> 光栅化失败的**判别条件**。假设："渲染尺寸 == 图片固有尺寸（1:1，不缩放）时失败"。
// 用同一张 data:image/png（固有 300×200），只改 style，逐一测（各重复 3 次）。
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

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1518, strictPort: true } })
await server.listen()
const browser = await pw.chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
await page.goto('http://127.0.0.1:1518/', { waitUntil: 'commit', timeout: 120000 })
await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

const out = await page.evaluate(async () => {
  const h2i = await import('/src/lib/htmlToImage.ts')
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, w, h); return c.toDataURL('image/png') }
  const U300 = mk(300, 200)   // 固有 300×200
  const U375 = mk(375, 250)
  const cases = [
    ['固有300×200 / 无 style（渲染=固有 300×200，1:1）', `<p>a</p><img src="${U300}">`],
    ['固有300×200 / width:200px;height:auto（缩放）', `<p>a</p><img style="width:200px;height:auto" src="${U300}">`],
    ['固有300×200 / width:300px;height:auto（1:1）', `<p>a</p><img style="width:300px;height:auto" src="${U300}">`],
    ['固有300×200 / width:100%;height:auto（放大）', `<p>a</p><img style="width:100%;height:auto" src="${U300}">`],
    ['固有300×200 / width:200px;height:120px（1:1 且变形）', `<p>a</p><img style="width:200px;height:120px" src="${U300}">`],
    ['固有300×200 / width:200px;height:133px（微缩放）', `<p>a</p><img style="width:200px;height:133px" src="${U300}">`],
    ['固有300×200 / max-width:100%（固有 300<375 → 1:1）', `<p>a</p><img style="max-width:100%" src="${U300}">`],
    ['固有300×200 / max-width:56%;height:auto（缩小）', `<p>a</p><img style="max-width:56%;height:auto;display:inline-block" src="${U300}">`],
    ['固有300×200 / width:300px（1:1，只给宽）', `<p>a</p><img style="width:300px" src="${U300}">`],
    ['固有375×250 / width:100%（375 容器 → 1:1）', `<p>a</p><img style="width:100%;height:auto" src="${U375}">`],
    ['固有375×250 / width:50%（缩放）', `<p>a</p><img style="width:50%;height:auto" src="${U375}">`],
  ]
  const res = []
  for (const [name, html] of cases) {
    let ok = 0, n = 3, err = ''
    for (let i = 0; i < n; i++) {
      try { await h2i.renderArticleImages(html); ok++ } catch (e) { if (!err) err = String(e).slice(0, 50) }
    }
    // 同时记录浏览器里该 img 的渲染框尺寸（在 375px 宿主里量）
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:375px;background:#fff'
    host.innerHTML = `<div style="width:375px;box-sizing:border-box">${html}</div>`
    document.body.appendChild(host)
    const im = host.querySelector('img')
    const box = im ? `${Math.round(im.getBoundingClientRect().width)}x${Math.round(im.getBoundingClientRect().height)}` : 'n/a'
    host.remove()
    res.push({ name, ok, n, box, err })
  }
  return res
})
await browser.close(); await server.close()

for (const r of out) console.log(`  ${r.ok}/${r.n}  box=${r.box.padEnd(9)} ${r.name}${r.err ? '  err=' + r.err : ''}`)
writeFileSync(join(outDir, `phase2-b-scale-${ROOT}.json`), JSON.stringify(out, null, 2))
console.log('写出：', join(outDir, `phase2-b-scale-${ROOT}.json`))
