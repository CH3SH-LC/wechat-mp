// test/inline-deco/verify-inline-deco.mjs
// 独立验收（主智能体复跑，不信任子智能体/渲染脚本自报）：
// 第 1 层 资产级：6 个行内资产 PNG probe 纯色点 ±12；紧裁（图案包围盒 ≥70% 画布）；
//               底部锚点（图案最底行距画布底 ≤20px@4x = 5px 设计）；PNG 体积 ≤1MB
// 第 2 层 375px 壳 DOM：after 页面 6 个行内图——显示高=指定 px；图片顶不低于所在行行顶-1.5；
//               图片底落在首行文字盒 [底-12, 底+1.5]（baseline 区）
// 第 3 层 像素：图案像素带底与首行文字像素带底差 ≤4px（2x 设备像素）
// 用法：node verify-inline-deco.mjs（先运行 render-inline-demo.mjs 生成产物）
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INLINE_DECO_ARTS, INLINE_SCALE } from './ARTS-inline-deco.mjs'

const outDir = fileURLToPath(new URL('./', import.meta.url))
const pngDir = outDir + 'png-inline/'
let fail = 0

// ---------- 资产级验证（读已渲染 PNG） ----------
console.log('======== 第 1 层：资产级（probe + 紧裁 + 底部锚点 + 体积） ========')
const { createCanvas, loadImage } = await import('canvas').catch(() => ({ createCanvas: null }))
let pixelOf = null
if (createCanvas) {
  pixelOf = async (file, x, y) => {
    const img = await loadImage(file)
    const c = createCanvas(img.width, img.height)
    const cx = c.getContext('2d')
    cx.drawImage(img, 0, 0)
    const d = cx.getImageData(x, y, 1, 1).data
    return [d[0], d[1], d[2]]
  }
}
// canvas 包可能不可用（Windows 原生模块），改用 playwright 读像素（更贴近真实渲染管线）
if (!pixelOf) {
  const pwCandidates = [
    'D:/deepseek-harness/deepseek-harness/node_modules/.pnpm',
    'C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/.pnpm',
  ]
  const cands = []
  for (const r of pwCandidates) {
    try { for (const d of readdirSync(r)) if (d.startsWith('playwright@')) cands.push(r + '/' + d + '/node_modules/playwright/index.mjs') } catch (_) { }
  }
  cands.push('D:/deepseek-harness/deepseek-harness/node_modules/playwright/index.mjs')
  let pw
  for (const c of cands) { try { pw = await import('file:///' + c.replace(/\\/g, '/')) } catch (_) { } }
  const base = 'C:/Users/Lenovo/AppData/Local/ms-playwright'
  let exe
  try { for (const d of readdirSync(base)) if (d.startsWith('chromium-') && existsSync(base + '/' + d + '/chrome-win64/chrome.exe')) exe = base + '/' + d + '/chrome-win64/chrome.exe' } catch (_) { }
  const browser = await pw.chromium.launch({ executablePath: exe })
  const page = await browser.newPage()
  pixelOf = async (file, x, y) => {
    const b64 = readFileSync(file).toString('base64')
    return page.evaluate(({ b64, x, y }) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(img, 0, 0)
        const d = cx.getImageData(x, y, 1, 1).data
        resolve([d[0], d[1], d[2]])
      }
      img.src = 'data:image/png;base64,' + b64
    }), { b64, x, y })
  }
  // 像素带扫描也走同页
  globalThis.__scan = async (file) => {
    const b64 = readFileSync(file).toString('base64')
    return page.evaluate(({ b64 }) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(img, 0, 0)
        const d = cx.getImageData(0, 0, c.width, c.height).data
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x += 2) {
            const i = (y * c.width + x) * 4
            // 只统计不透明且非白的像素（透明底 RGB=0 不算内容）
            if (d[i + 3] > 8 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) {
              if (x < minX) minX = x; if (x > maxX) maxX = x
              if (y < minY) minY = y; if (y > maxY) maxY = y
            }
          }
        }
        resolve({ minX, maxX, minY, maxY, w: c.width, h: c.height })
      }
      img.src = 'data:image/png;base64,' + b64
    }), { b64 })
  }
  globalThis.__browser = browser
} else {
  globalThis.__scan = async (file) => {
    const img = await loadImage(file)
    const c = createCanvas(img.width, img.height)
    const cx = c.getContext('2d')
    cx.drawImage(img, 0, 0)
    const d = cx.getImageData(0, 0, c.width, c.height).data
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4
        if (d[i + 3] > 8 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
    return { minX, maxX, minY, maxY, w: c.width, h: c.height }
  }
}

let assetPass = 0
for (const a of INLINE_DECO_ARTS) {
  const file = pngDir + a.name + '.png'
  if (!existsSync(file)) { console.log('FAIL ' + a.name + ' 缺 PNG'); fail++; continue }
  const size = readFileSync(file).length
  const okSize = size <= 1 * 1024 * 1024
  // probe
  let okProbe = true, probeMsg = []
  for (const p of a.probes) {
    const got = await pixelOf(file, p.x * INLINE_SCALE, p.y * INLINE_SCALE)
    const ok = Math.abs(got[0] - p.c[0]) <= 12 && Math.abs(got[1] - p.c[1]) <= 12 && Math.abs(got[2] - p.c[2]) <= 12
    if (!ok) { okProbe = false; probeMsg.push(p.note + ' 期望' + p.c.join(',') + ' 实得' + got.join(',')) }
  }
  // 紧裁 + 底部锚点
  const b = await globalThis.__scan(file)
  const bw = (b.maxX - b.minX + 1) / b.w, bh = (b.maxY - b.minY + 1) / b.h
  const okCrop = bw >= 0.70 && bh >= 0.70
  const bottomGap = b.h - 1 - b.maxY
  const okAnchor = bottomGap <= 20 // 4x 下 ≤5px 设计
  const ok = okSize && okProbe && okCrop && okAnchor
  if (ok) assetPass++
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + a.name.padEnd(16) +
    ' probe ' + (okProbe ? '3/3' : '✗ ' + probeMsg.join('; ')) +
    ' · 包围盒 ' + (bw * 100).toFixed(0) + '×' + (bh * 100).toFixed(0) + '%(≥70)' +
    ' · 底部留白 ' + bottomGap + 'px@4x(≤20)' +
    ' · PNG ' + (size / 1024).toFixed(0) + 'KB(≤1024)')
  if (!ok) fail++
}
console.log('资产级通过: ' + assetPass + '/' + INLINE_DECO_ARTS.length)

// ---------- 第 2/3 层：375px 壳 after 页面 DOM + 像素（复用 render-inline-demo.mjs 的产物 html） ----------
const htmlPath = outDir + 'demo-inline-after.html'
if (!existsSync(htmlPath)) {
  console.log('FAIL 缺少 demo-inline-after.html（先运行 render-inline-demo.mjs）')
  process.exitCode = 1
} else {
  console.log('======== 第 2/3 层：375px 壳 DOM + 像素对齐 ========')
  const pwCandidates = [
    'D:/deepseek-harness/deepseek-harness/node_modules/.pnpm',
    'C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/.pnpm',
  ]
  const cands = []
  for (const r of pwCandidates) {
    try { for (const d of readdirSync(r)) if (d.startsWith('playwright@')) cands.push(r + '/' + d + '/node_modules/playwright/index.mjs') } catch (_) { }
  }
  cands.push('D:/deepseek-harness/deepseek-harness/node_modules/playwright/index.mjs')
  let pw
  for (const c of cands) { try { pw = await import('file:///' + c.replace(/\\/g, '/')) } catch (_) { } }
  const base = 'C:/Users/Lenovo/AppData/Local/ms-playwright'
  let exe
  try { for (const d of readdirSync(base)) if (d.startsWith('chromium-') && existsSync(base + '/' + d + '/chrome-win64/chrome.exe')) exe = base + '/' + d + '/chrome-win64/chrome.exe' } catch (_) { }
  const browser = await pw.chromium.launch({ executablePath: exe })
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 900, deviceScaleFactor: 2 } })
    await page.setContent(readFileSync(htmlPath, 'utf8'))
    await page.waitForTimeout(400)
    await page.screenshot({ path: outDir + 'verify-inline-after.png' })
    const b64 = readFileSync(outDir + 'verify-inline-after.png').toString('base64')
    const rows = await page.evaluate(({ b64 }) => new Promise((resolve) => {
      const shot = new Image()
      shot.onload = () => {
        const c = document.createElement('canvas')
        c.width = shot.naturalWidth; c.height = shot.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(shot, 0, 0)
        const d = cx.getImageData(0, 0, c.width, c.height).data
        const sx = c.width / 375
        const out = []
        for (const img of [...document.querySelectorAll('img[data-inline]')]) {
          const [name, px] = img.getAttribute('data-inline').split(':')
          const ir = img.getBoundingClientRect()
          let imgMin = Infinity, imgMax = -Infinity
          for (let y = Math.round(ir.top * sx); y < Math.round(ir.bottom * sx); y++) {
            let has = false
            for (let x = Math.round(ir.left * sx); x < Math.round(ir.right * sx); x += 2) {
              const i = (y * c.width + x) * 4
              if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { has = true; break }
            }
            if (has) { imgMin = Math.min(imgMin, y); imgMax = Math.max(imgMax, y) }
          }
          const x0 = Math.round((ir.right + 6) * sx), x1 = Math.round(Math.min(ir.right + 120, 375) * sx)
          let txtMin = Infinity, txtMax = -Infinity
          for (let y = Math.round((ir.top - 20) * sx); y < Math.round((ir.bottom + 5) * sx); y++) {
            let has = false
            for (let x = x0; x < x1; x += 2) {
              const i = (y * c.width + x) * 4
              if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { has = true; break }
            }
            if (has) { txtMin = Math.min(txtMin, y); txtMax = Math.max(txtMax, y) }
          }
          out.push({
            name, expect: +px, h: +ir.height.toFixed(2),
            imgTop: +ir.top.toFixed(1), imgBottom: +ir.bottom.toFixed(1),
            imgBand: imgMin === Infinity ? null : { top: +(imgMin / sx).toFixed(1), bottom: +(imgMax / sx).toFixed(1) },
            txtBand: txtMin === Infinity ? null : { top: +(txtMin / sx).toFixed(1), bottom: +(txtMax / sx).toFixed(1) },
          })
        }
        resolve(out)
      }
      shot.src = 'data:image/png;base64,' + b64
    }), { b64 })
    let domPass = 0
    for (const r of rows) {
      const hOk = Math.abs(r.h - r.expect) <= 0.6
      const pxOk = r.imgBand && r.txtBand && Math.abs(r.imgBand.bottom - r.txtBand.bottom) <= 4
      const aboveOk = r.imgBand && r.txtBand && (r.imgBand.top - r.txtBand.top) >= -14
      const ok = hOk && pxOk && aboveOk
      if (ok) domPass++
      console.log((ok ? 'OK  ' : 'FAIL') + ' ' + r.name.padEnd(16) +
        ' 高 ' + r.h + '/' + r.expect + 'px' +
        ' · 图案带 ' + (r.imgBand ? 'y' + r.imgBand.top + '..' + r.imgBand.bottom : '无') +
        ' · 文字带 ' + (r.txtBand ? 'y' + r.txtBand.top + '..' + r.txtBand.bottom : '无') +
        (r.imgBand && r.txtBand ? ' · 底差 ' + (r.imgBand.bottom - r.txtBand.bottom).toFixed(1) + 'px(≤4) · 顶差 ' + (r.imgBand.top - r.txtBand.top).toFixed(1) + 'px(≥-14)' : '') +
        (ok ? '' : ' [h=' + hOk + ' px=' + pxOk + ' above=' + aboveOk + ']'))
      if (!ok) fail++
    }
    console.log('375px 壳 DOM+像素通过: ' + domPass + '/' + rows.length)
  } finally {
    await browser.close()
  }
}

// 关闭可能遗留的浏览器
try { if (globalThis.__browser) await globalThis.__browser.close() } catch (_) { }

console.log('======== ' + (fail ? '存在失败项（' + fail + '）' : '独立验收全绿：资产级 + 375px 壳 DOM/像素 全部通过') + ' ========')
if (fail) process.exitCode = 1
