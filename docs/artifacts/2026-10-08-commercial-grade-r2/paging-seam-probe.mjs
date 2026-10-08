// paging-seam-probe.mjs —— 在**真机导出的**长图/分页上量"切点有没有切穿墨迹"（2026-10-08 R9）
//
// 用法：
//   VERIFY_PLAYWRIGHT=<playwright> node docs/artifacts/2026-10-08-commercial-grade-r2/paging-seam-probe.mjs [--dir <某次导出的 PNG 目录>] [--crop]
//
// 背景：`export-paging-check`（离线夹具路径）有一条断言是"**新切点逐像素未切穿墨迹（跨缝列数 = 0）**"，
// 它用的是自己渲染的夹具。真机导出路径此前**没有**这条量法。本脚本就是把它搬到真机产物上：
// 从分页 PNG 的高度反推切点，在长图上逐切点统计"同一列上下两行都是深墨"的列数。
//
// 口径与 export-paging-check 一致：深墨 = RGB 三通道都 < 180；跨缝 = `cut-1` 行与 `cut` 行同列都深墨。
// 跨缝列数 > 0 就说明**这一刀切在了一个字/一行字上**（用户会在页边界看到半截笔画）。
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : process.env.TEMP + '/wxmp-r5/big3/profile/Documents/wechat-mp-workspace/exports/img-tuiwen-20261008-2307'
const wantCrop = args.includes('--crop')
if (!existsSync(dir)) {
  console.error(`[seam] 找不到目录：${dir}（用 --dir 指定）`)
  process.exit(2)
}

const files = readdirSync(dir).filter((n) => /\.png$/.test(n))
const longName = files.find((n) => n.includes('长图'))
const pageNames = files.filter((n) => /-\d+\.png$/.test(n)).sort()
if (!longName || pageNames.length < 2) {
  console.error(`[seam] 需要"长图 + ≥2 张分页"：${JSON.stringify(files)}`)
  process.exit(2)
}
const b64 = (n) => 'data:image/png;base64,' + readFileSync(join(dir, n)).toString('base64')

let chromium
try {
  ;({ chromium } = require(process.env.VERIFY_PLAYWRIGHT || 'playwright'))
} catch (e) {
  console.error(`[seam] 解析不到 playwright：${String(e).slice(0, 140)}`)
  process.exit(2)
}
const chromExe = (() => {
  const env = process.env.VERIFY_CHROMIUM
  if (env && existsSync(resolve(env))) return resolve(env)
  const hard = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
  return existsSync(hard) ? hard : null
})()

const browser = await chromium.launch({ headless: true, ...(chromExe ? { executablePath: chromExe } : {}) })
const page = await browser.newPage()
await page.goto('about:blank')

const out = await page.evaluate(
  async ({ long, pages }) => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = u })
    const imgs = await Promise.all([load(long), ...pages.map(load)])
    const li = imgs[0], lw = li.naturalWidth, lh = li.naturalHeight
    const c = document.createElement('canvas'); c.width = lw; c.height = lh
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(li, 0, 0)
    const heights = imgs.slice(1).map((i) => i.naturalHeight)
    const cuts = []
    let y = 0
    for (let k = 0; k < heights.length - 1; k++) { y += heights[k]; cuts.push(y) }
    const dark = (row) => { const a = x.getImageData(0, row, lw, 1).data; let n = 0; for (let k = 0; k < a.length; k += 4) if (a[k] < 180 && a[k + 1] < 180 && a[k + 2] < 180) n++; return n }
    const res = []
    for (const cut of cuts) {
      const A = x.getImageData(0, cut - 1, lw, 1).data, B = x.getImageData(0, cut, lw, 1).data
      let cross = 0
      for (let k = 0; k < A.length; k += 4) if (A[k] < 180 && A[k + 1] < 180 && A[k + 2] < 180 && B[k] < 180 && B[k + 1] < 180 && B[k + 2] < 180) cross++
      let nearestInk = -1
      for (let d = 0; d <= 30; d++) { if (dark(cut - d) > 0 || dark(cut + d) > 0) { nearestInk = d; break } }
      res.push({ cut, cross, nearestInk })
    }
    // 首刀的位置也要能画出来给人看
    const crops = []
    for (const r of res) {
      if (r.cross === 0) continue
      const cc = document.createElement('canvas'); cc.width = lw; cc.height = 360
      const cx = cc.getContext('2d')
      cx.drawImage(c, 0, Math.max(0, r.cut - 180), lw, 360, 0, 0, lw, 360)
      cx.fillStyle = '#ff0000'; cx.fillRect(0, Math.min(179, r.cut - Math.max(0, r.cut - 180)), lw, 2)
      crops.push({ cut: r.cut, dataUrl: cc.toDataURL('image/png') })
    }
    return { lw, lh, heights, cuts: res, pageSum: heights.reduce((a, b) => a + b, 0), crops }
  },
  { long: b64(longName), pages: pageNames.map(b64) },
)
await browser.close()

console.log(`[输入] ${dir}`)
console.log(`[长图] ${out.lw}×${out.lh}；分页 ${out.heights.length} 张，页高 ${JSON.stringify(out.heights)}，合计 ${out.pageSum}`)
if (out.pageSum !== out.lh) console.log('  ⚠ 页高之和 ≠ 长图高')
console.log('[逐切点]')
let bad = 0
for (const r of out.cuts) {
  const tag = r.cross > 0 ? '切穿墨迹' : '干净'
  if (r.cross > 0) bad++
  console.log(`  切点 y=${r.cut}  跨缝列数=${r.cross}  最近墨迹距离=${r.nearestInk}px  → ${tag}`)
}
console.log(bad === 0 ? '[判定] 所有切点都落在空白处（跨缝列数全 0）' : `[判定] **${bad} 个切点切穿了墨迹**——页边界上会看到半截笔画`)

if (wantCrop && out.crops.length) {
  const d = mkdtempSync(join(tmpdir(), 'seam-crop-'))
  for (const cp of out.crops) {
    const p = join(d, `cut-${cp.cut}.png`)
    writeFileSync(p, Buffer.from(cp.dataUrl.split(',')[1], 'base64'))
    console.log(`[裁图] ${p}（红线上方/下方是页边界两侧）`)
  }
}
process.exit(bad === 0 ? 0 : 1)
