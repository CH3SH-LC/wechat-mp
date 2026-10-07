// E 路 阶段二：<img> 光栅化争点 —— 追查 E 与 B 结论相反的原因。
// 变量：可执行文件（chrome.exe / chrome-headless-shell.exe）× 载荷（1×1 透明 PNG / 生成的真实 PNG / JPEG / SVG）
// 以及"分岔点"定位：`img.decode()` 单独调用是否成功（B 可能只测到这一步），对比 foreignObject 光栅化路径。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
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
const EXES = {
  'chrome-win64': join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'),
  'headless-shell': join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1234', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
}
const rec = { script: 'phase2-b-img-followup', root: ROOT, runs: [] }

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1512, strictPort: true } })
await server.listen()

for (const [exeName, exePath] of Object.entries(EXES)) {
  if (!existsSync(exePath)) { rec.runs.push({ exeName, missing: true }); continue }
  const browser = await pw.chromium.launch({ executablePath: exePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  await page.goto('http://127.0.0.1:1512/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

  const run = { exeName, exePath, version: browser.version(), cases: {} }
  run.cases = await page.evaluate(async () => {
    // 在页面里造真实载荷
    const mk = (w, h, fill, mime) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, w, h)
      x.fillStyle = '#ff00ff'; x.fillRect(0, 0, w, h / 2)
      return c.toDataURL(mime)
    }
    const PNG200 = mk(200, 120, '#00ff00', 'image/png')
    const JPG200 = mk(200, 120, '#00ff00', 'image/jpeg')
    const PNG1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#ff00ff"/></svg>')
    const mod = await import('/src/lib/htmlToImage.ts')

    const cases = {}
    const defs = {
      'img-png200': `<p>a</p><img style="display:block;width:200px;height:120px" src="${PNG200}">`,
      'img-jpg200': `<p>a</p><img style="display:block;width:200px;height:120px" src="${JPG200}">`,
      'img-png1x1': `<p>a</p><img style="display:block;width:200px;height:120px" src="data:image/png;base64,${PNG1x1}">`,
      'img-svg': `<p>a</p><img style="display:block;width:200px;height:120px" src="${SVG}">`,
      'img-http-svg': '<p>a</p><img style="display:block;width:200px;height:120px" src="/src/assets/react.svg">',
      'inline-svg': '<p>a</p><svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" style="display:block"><rect width="200" height="120" fill="#ff00ff"/></svg>',
    }
    for (const [k, frag] of Object.entries(defs)) {
      const src = (frag.match(/src="([^"]+)"/) || [])[1]
      // (a) 单独 decode：这一步能不能过？
      let decodeOk = null
      if (src) {
        decodeOk = await new Promise((rs) => {
          try { const i = new Image(); i.onload = () => rs('load'); i.onerror = () => rs('onerror'); i.src = src }
          catch (e) { rs('throw:' + String(e).slice(0, 60)) }
        })
      }
      // (b) 完整光栅化路径
      let raster
      try {
        const res = await mod.renderArticleImages(frag)
        const im = await new Promise((rs, rj) => { const i = new Image(); i.onload = () => rs(i); i.onerror = rj; i.src = res.long })
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
        const x = c.getContext('2d'); x.drawImage(im, 0, 0)
        const d = x.getImageData(0, 0, c.width, Math.min(c.height, 400)).data
        let hits = 0
        for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] < 20 && d[i + 2] > 240) hits++
        raster = { ok: true, cssH: res.cssH, magenta: hits }
      } catch (e) { raster = { ok: false, err: String(e).slice(0, 120) } }
      cases[k] = { decodeOk, raster }
    }
    return cases
  })
  rec.runs.push(run)
  await browser.close()
  console.log(`\n[${exeName}] chromium ${run.version}`)
  for (const [k, v] of Object.entries(run.cases)) console.log(`  ${k}: decode=${v.decodeOk}  raster=${v.raster.ok ? 'ok(magenta=' + v.raster.magenta + ')' : 'ERR ' + v.raster.err}`)
}

await server.close()
writeFileSync(join(outDir, `phase2-b-img-followup-${ROOT}.json`), JSON.stringify(rec, null, 2))
console.log('\n写出：', join(outDir, `phase2-b-img-followup-${ROOT}.json`))
