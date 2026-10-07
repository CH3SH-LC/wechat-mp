// E 路 阶段一：独立复现 B 的缺陷 —— 固定 1000 CSS px 等高硬切切断文字行 / 插画。
//
// 判据（自定，与实现无关）：
//   Q1  任何一条页边界（y = k*1000 CSS px）**不得**落在某个文字行盒内部（top < y < bottom）；
//   Q2  任何一条页边界不得落在某个插画/图形盒内部；
//   Q3  页图拼回长图必须**逐像素一致**（无丢行、无重复）；
//   Q4  页高必须是"内容或切点"的函数，而不是所有页恒等于 1000（等高硬切本身就是缺陷特征）。
//
// 做法：真实生产模块 `src/lib/htmlToImage.ts` 的 renderArticleImages（经 vite dev server 动态 import），
//       行盒 / 图形盒用 Range.getClientRects 在**同一份 375px 版式**上独立测量。
//
// 退出码：0 = 结论已产出；1 = 基础设施出错。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

function resolvePlaywright() {
  const tried = []
  for (const m of ['playwright-core', 'playwright']) { try { return require(m) } catch (e) { tried.push(m) } }
  const cand = [
    process.env.VERIFY_PLAYWRIGHT,
    process.env.TEMP && join(process.env.TEMP, 'pw-deps', 'node_modules', 'playwright-core'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, '..', 'Roaming', 'npm', 'node_modules', 'playwright-core'),
  ].filter(Boolean)
  for (const c of cand) {
    const t = isAbsolute(c) ? c : resolve(process.cwd(), c)
    try { return require(t) } catch (e) { tried.push(t) }
  }
  throw new Error('解析不到 playwright / playwright-core；尝试过：\n  ' + tried.join('\n  '))
}
function resolveChromium() {
  if (process.env.VERIFY_CHROMIUM) return process.env.VERIFY_CHROMIUM
  const base = process.env.LOCALAPPDATA
  return join(base, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')
}
const pw = resolvePlaywright()
const executablePath = resolveChromium()

import { createHash } from 'node:crypto'
const ROOT = process.env.E_ROOT || 'baseline'   // 'baseline' = df97022 快照；'candidate' = 冻结合同候选
const sha = (rel) => createHash('sha256').update(readFileSync(join(here, ROOT, rel))).digest('hex')
const rec = {
  script: 'repro-b-paging-cut',
  startedAt: new Date().toISOString(),
  subject: 'git HEAD df97022 的 src/lib/htmlToImage.ts 快照（对抗实施中并发编辑）',
  hashes: { [`${ROOT}/src/lib/htmlToImage.ts`]: sha('src/lib/htmlToImage.ts') },
  checks: [], boundaries: [],
}
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'MISS'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

const PORT = 1499
const server = await createServer({
  // 只服务 git HEAD(df97022) 的 src 快照：B 正在改 src/lib/htmlToImage.ts，必须对冻结点复核
  root: join(here, ROOT), configFile: false, logLevel: 'error',
  server: { host: '127.0.0.1', port: PORT, strictPort: true },
})
await server.listen()
const baseUrl = `http://127.0.0.1:${PORT}`
const FIXTURE = process.env.E_FIXTURE || 'paging-cut.html'
const TAG = FIXTURE.replace(/\.html$/, '')
const html = readFileSync(join(here, 'fixtures', FIXTURE), 'utf8')

const browser = await pw.chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
// 只取到文档提交即可：本脚本不需要 App 挂载，只需页面 origin 落在 dev server 上，
// 之后动态 import 生产模块。首次 transform 较慢，超时放宽。
await page.goto(baseUrl + '/', { waitUntil: 'commit', timeout: 120000 })
await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

const out = await page.evaluate(async ({ html }) => {
  const mod = await import('/src/lib/htmlToImage.ts')
  const res = await mod.renderArticleImages(html)

  const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
  const WIDTH = 375, SCALE = 2, PAGE = 1000
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;font-family:${FONT};`
  host.innerHTML = `<div style="width:${WIDTH}px;box-sizing:border-box">${html}</div>`
  document.body.appendChild(host)
  const hb = host.getBoundingClientRect()
  const rel = (v) => +(v - hb.top).toFixed(2)

  const lines = []
  const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  let n
  while ((n = tw.nextNode())) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue
    const r = document.createRange(); r.selectNodeContents(n)
    for (const cr of r.getClientRects()) {
      if (cr.width < 1 || cr.height < 1) continue
      lines.push({ top: rel(cr.top), bottom: rel(cr.bottom), text: n.nodeValue.trim().slice(0, 16) })
    }
  }
  const boxes = []
  for (const el of host.querySelectorAll('img,svg,table')) {
    const r = el.getBoundingClientRect()
    boxes.push({ tag: el.tagName, alt: el.getAttribute('alt') || el.tagName, top: rel(r.top), bottom: rel(r.bottom) })
  }
  const measuredH = Math.ceil(hb.height)
  host.remove()

  // 逐像素：长图 vs 页图拼回
  const loadImg = (url) => new Promise((rs, rj) => { const im = new Image(); im.onload = () => rs(im); im.onerror = rj; im.src = url })
  const longIm = await loadImg(res.long)
  const cv = document.createElement('canvas'); cv.width = longIm.width; cv.height = longIm.height
  const cx = cv.getContext('2d'); cx.drawImage(longIm, 0, 0)
  const longData = cx.getImageData(0, 0, cv.width, cv.height).data
  let mismatchedRows = 0, firstMismatch = null, comparedRows = 0
  const pageHeights = []
  let offsetRows = 0   // 页高可不同：必须按**实际页高**累计偏移，不能假设每页 2000
  for (let k = 0; k < res.pages.length; k++) {
    const p = await loadImg(res.pages[k])
    pageHeights.push(p.height)
    const pc = document.createElement('canvas'); pc.width = cv.width; pc.height = p.height
    const pctx = pc.getContext('2d'); pctx.drawImage(p, 0, 0)
    const pd = pctx.getImageData(0, 0, pc.width, pc.height).data
    for (let row = 0; row < p.height; row++) {
      const off = row * pc.width * 4
      const lo = (offsetRows + row) * cv.width * 4
      comparedRows++
      for (let i = 0; i < pc.width * 4; i++) {
        if (pd[off + i] !== longData[lo + i]) { mismatchedRows++; if (firstMismatch === null) firstMismatch = { page: k + 1, row, byte: i }; break }
      }
    }
    offsetRows += p.height
  }

  // 边界证据图：page[k] 末尾 200 行 + 红线 + page[k+1] 开头 200 行
  const crops = []
  for (let k = 0; k + 1 < res.pages.length; k++) {
    const a = await loadImg(res.pages[k]); const b = await loadImg(res.pages[k + 1])
    const N = 200
    const c = document.createElement('canvas'); c.width = a.width; c.height = N * 2 + 2
    const cc = c.getContext('2d')
    cc.drawImage(a, 0, a.height - N, a.width, N, 0, 0, a.width, N)
    cc.fillStyle = '#e11d48'; cc.fillRect(0, N, a.width, 2)
    cc.drawImage(b, 0, 0, b.width, N, 0, N + 2, b.width, N)
    crops.push({ boundary: (k + 1) * PAGE, dataUrl: c.toDataURL('image/png') })
  }

  return {
    cssH: res.cssH, measuredH, pageCount: res.pages.length, pageHeights,
    longW: longIm.width, longH: longIm.height,
    lines, boxes, mismatchedRows, comparedRows, firstMismatch, crops,
    cutsPx: res.cutsPx ?? null, oversize: res.oversize ?? null, protectedRanges: res.protectedRanges ?? null,
  }
}, { html })

// ---- 判定
console.log(`\ncssH=${out.cssH} measuredH=${out.measuredH} pages=${out.pageCount} pageHeights=${JSON.stringify(out.pageHeights)} long=${out.longW}x${out.longH}`)

ok('测量宿主高度与 renderArticleImages 报告的高度一致', out.measuredH === out.cssH, `${out.measuredH} vs ${out.cssH}`)
const sumPages = out.pageHeights.reduce((a, b) => a + b, 0)
ok('B4a 各页高度之和 === 长图高（连续覆盖，无缺页/重复/空隙）', sumPages === out.longH, `sum=${sumPages} 长图=${out.longH}`)
if (Array.isArray(out.cutsPx)) {
  const diffs = out.cutsPx.slice(1).map((v, i) => v - out.cutsPx[i])
  ok('B4b 页高与 cutsPx 区间逐一对应', JSON.stringify(diffs) === JSON.stringify(out.pageHeights), `${JSON.stringify(diffs)} vs ${JSON.stringify(out.pageHeights)}`)
}
if (!Array.isArray(out.cutsPx)) ok('页数 = ceil(h/1000)（基线等高实现）', out.pageCount === Math.ceil(out.cssH / 1000), `${out.pageCount}`)

const equalHeight = out.pageHeights.slice(0, -1).every((h) => h === 2000)
rec.equalHeightAllButLast = equalHeight
// Q4 是**特征观测**而不是达标条件：等高硬切是缺陷特征，安全切点下页高本就应当不同。
console.log(`  [观测] Q4 非末页页高恒等于 2000（2x）= ${equalHeight} —— ${JSON.stringify(out.pageHeights)}`)

// 页边界：候选有 cutsPx（设备像素）就用**实现真实用的**切点；否则退回基线的 k*1000 假设
let cutLines = 0, cutBoxes = 0
let boundariesCss
if (Array.isArray(out.cutsPx) && out.cutsPx.length > 2) {
  boundariesCss = out.cutsPx.slice(1, -1).map((px) => px / 2)
  const inc = out.cutsPx.every((v, i) => i === 0 || v > out.cutsPx[i - 1])
  const covers = out.cutsPx[0] === 0 && out.cutsPx[out.cutsPx.length - 1] === out.cssH * 2
  ok('B3a 切点严格递增', inc, JSON.stringify(out.cutsPx))
  ok('B3b 切点覆盖 [0, canvasPx]（末切点=画布高、首切点=0）', covers, `首=${out.cutsPx[0]} 末=${out.cutsPx[out.cutsPx.length - 1]} 画布=${out.cssH * 2}`)
} else {
  boundariesCss = Array.from({ length: out.pageCount - 1 }, (_, i) => (i + 1) * 1000)
}
for (const B of boundariesCss) {
  const ls = out.lines.filter((l) => l.top < B && B < l.bottom)
  const bs = out.boxes.filter((b) => b.top < B && B < b.bottom)
  cutLines += ls.length; cutBoxes += bs.length
  rec.boundaries.push({ boundaryCssPx: B, cutLineCount: ls.length, cutBoxCount: bs.length, cutLines: ls.slice(0, 4), cutBoxes: bs.slice(0, 4) })
  console.log(`  边界 y=${B}: 被切文字行 ${ls.length} 个 ${ls.length ? JSON.stringify(ls[0]) : ''}；被切图形盒 ${bs.length} 个 ${bs.length ? JSON.stringify(bs[0]) : ''}`)
}
ok('Q1 无页边界落在文字行盒内部', cutLines === 0, `被切文字行合计 ${cutLines} 行`)
ok('Q2 无页边界落在插画/图形盒内部', cutBoxes === 0, `被切图形盒合计 ${cutBoxes} 个`)
ok('Q3 页图拼回与长图逐像素一致', out.mismatchedRows === 0, `比较 ${out.comparedRows} 行，不一致 ${out.mismatchedRows} 行${out.firstMismatch ? ' 首个=' + JSON.stringify(out.firstMismatch) : ''}`)

// ---- 落盘证据图
for (const c of out.crops) {
  const b64 = c.dataUrl.split(',')[1]
  const p = join(outDir, `paging-boundary-${ROOT}-${TAG}-${c.boundary}.png`)
  writeFileSync(p, Buffer.from(b64, 'base64'))
  console.log('  证据图：', p)
}
writeFileSync(join(outDir, `repro-b-${ROOT}-${TAG}.json`), JSON.stringify({ ...rec, raw: { cssH: out.cssH, pageHeights: out.pageHeights, lineCount: out.lines.length, boxCount: out.boxes.length, mismatchedRows: out.mismatchedRows, comparedRows: out.comparedRows, cutsPx: out.cutsPx, oversize: out.oversize, protectedCount: out.protectedRanges?.length ?? null } }, null, 2))

await browser.close()
await server.close()
console.log('\n写出：', join(outDir, `repro-b-${ROOT}-${TAG}.json`))
