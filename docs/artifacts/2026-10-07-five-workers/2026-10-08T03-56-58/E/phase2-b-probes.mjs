// E 路 阶段二：B 的两项独立探针
//   P1 画布上限：`toDataURL` 在超限时是否**静默**返回 "data:,"（B 的 MAX_CANVAS_PX=65535 断言）
//   P2 <img> 光栅化争点：同一台机器上，`foreignObject` 能否画进 data:image/png|svg 的 <img>
// 记录实际可执行文件、启动参数、浏览器版本，并对不同启动参数各跑一遍以判断是否"参数相关"。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const executablePath = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')

const rec = { script: 'phase2-b-probes', root: ROOT, executablePath, playwrightVersion: pw._version ?? null, runs: [], checks: [] }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'MISS'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1511, strictPort: true } })
await server.listen()

const LAUNCH_VARIANTS = [
  { name: 'default-headless', args: [] },
  { name: 'headless-new+disable-gpu', args: ['--disable-gpu', '--disable-software-rasterizer'] },
]

const html = readFileSync(join(here, 'fixtures', 'paging-cut.html'), 'utf8')
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const SVG_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#ff00ff"/></svg>')
const IMG_CASES = {
  'inline-svg': '<p>a</p><svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" style="display:block"><rect width="200" height="120" fill="#ff00ff"/></svg>',
  'img-svg-size-style': `<p>a</p><img style="display:block;width:200px;height:120px" src="${SVG_URI}">`,
  'img-svg-size-attrs': `<p>a</p><img width="200" height="120" style="display:block" src="${SVG_URI}">`,
  'img-svg-no-size': `<p>a</p><img src="${SVG_URI}">`,
  'img-png-1x1': `<p>a</p><img style="display:block;width:200px;height:120px" src="data:image/png;base64,${PNG1}">`,
}

for (const v of LAUNCH_VARIANTS) {
  const browser = await pw.chromium.launch({ executablePath, headless: true, args: v.args })
  const version = browser.version()
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  await page.goto('http://127.0.0.1:1511/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })
  const run = { variant: v.name, args: v.args, version, canvas: [], img: {} }

  // ---- P1：画布上限
  run.canvas = await page.evaluate(() => {
    const rows = []
    for (const h of [2000, 16384, 32767, 32768, 65535, 65536, 70000]) {
      let url = '', err = null
      try {
        const c = document.createElement('canvas'); c.width = 750; c.height = h
        const x = c.getContext('2d'); x.fillStyle = '#123456'; x.fillRect(0, 0, 750, h)
        url = c.toDataURL('image/png')
      } catch (e) { err = String(e) }
      rows.push({ h, len: url.length, head: url.slice(0, 24), silentEmpty: url === 'data:,', err })
    }
    return rows
  })

  // ---- P2：<img> 光栅化
  for (const [name, frag] of Object.entries(IMG_CASES)) {
    run.img[name] = await page.evaluate(async (frag) => {
      try {
        const mod = await import('/src/lib/htmlToImage.ts')
        const res = await mod.renderArticleImages(frag)
        // 长图里是否真出现目标色 #ff00ff
        const im = await new Promise((rs, rj) => { const i = new Image(); i.onload = () => rs(i); i.onerror = rj; i.src = res.long })
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
        const x = c.getContext('2d'); x.drawImage(im, 0, 0)
        const d = x.getImageData(0, 0, c.width, Math.min(c.height, 400)).data
        let hits = 0
        for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] < 20 && d[i + 2] > 240) hits++
        return { ok: true, cssH: res.cssH, magentaPixels: hits }
      } catch (e) { return { ok: false, err: String(e).slice(0, 140) } }
    }, frag)
  }
  rec.runs.push(run)
  await browser.close()
  console.log(`\n[${v.name}] chromium ${version}  args=${JSON.stringify(v.args)}`)
  console.log('  画布：', run.canvas.map((r) => `${r.h}:${r.silentEmpty ? 'data:,（静默空）' : r.err ? 'throw' : r.len + 'B'}`).join('  '))
  for (const [k, r] of Object.entries(run.img)) console.log(`  ${k}: ${r.ok ? 'OK cssH=' + r.cssH + ' magenta=' + r.magentaPixels : 'ERR ' + r.err}`)
}

await server.close()

const d0 = rec.runs[0]
const c = d0.canvas
const at = (h) => c.find((r) => r.h === h)
ok('P1a 65535 设备像素高仍能导出有效 PNG', at(65535) && !at(65535).silentEmpty && !at(65535).err && at(65535).len > 1000, `len=${at(65535)?.len}`)
ok('P1b 65536 起**静默**返回 "data:,"（不抛异常）', at(65536) && at(65536).silentEmpty && !at(65536).err, `head=${at(65536)?.head} err=${at(65536)?.err}`)
const svgOk = Object.entries(d0.img).filter(([k]) => k.startsWith('inline-svg')).every(([, r]) => r.ok && r.magentaPixels > 0)
ok('P2a 内联 <svg> 可光栅化（对照）', svgOk, JSON.stringify(Object.fromEntries(Object.entries(d0.img).filter(([k]) => k.startsWith('inline')).map(([k, r]) => [k, r.ok ? 'ok:' + r.magentaPixels : 'err']))))
const imgResults = Object.fromEntries(Object.entries(d0.img).filter(([k]) => k.startsWith('img-')).map(([k, r]) => [k, r.ok ? 'ok:' + r.magentaPixels : 'err']))
console.log('\n<img> 变体结果：', JSON.stringify(imgResults))
rec.paramDependent = rec.runs.some((r) => JSON.stringify(r.img) !== JSON.stringify(d0.img))
ok('P2b 两个启动参数下 <img> 结果一致（非参数相关）', !rec.paramDependent, `paramDependent=${rec.paramDependent}`)

writeFileSync(join(outDir, `phase2-b-probes-${ROOT}.json`), JSON.stringify(rec, null, 2))
console.log('写出：', join(outDir, `phase2-b-probes-${ROOT}.json`))
