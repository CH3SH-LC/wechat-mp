// test/assets/divider/verify-divider-375.mjs
// 分割线资产 375px 手机壳实测（第三层验证，§5.0 ③）：
//   ① 章节组合式（divider-section）：真实标题文案（≤10 字）按 zone 叠入图片，
//      DOM getBoundingClientRect 对比 —— 文字边界必须全部落在 zone 矩形内（TOL 1.5px）
//   ② 无文字型（9 个）：装饰洁净带在 375 显示尺度下重扫（严格版扫描器，k=DIVIDER_SCALE）
//      + 线体显示厚度 ≥2.5px（4x PNG 实测 × scale）+ 装饰显示 ≥16px（声明 × scale + 4x 渲染真实性）
// 输出：test/assets/divider/demo-divider-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dividerArts, DIVIDER_SCALE } from './ARTS-divider.mjs'
import { scanCleanBandSrc } from './divider-scan.mjs'

const pwCandidates = [
  'D:/deepseek-harness/deepseek-harness/node_modules/.pnpm',
  'C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/.pnpm',
]
async function loadPlaywright() {
  const cands = []
  for (const r of pwCandidates) {
    try {
      for (const d of readdirSync(r)) {
        if (d.startsWith('playwright@')) {
          cands.push(r + '/' + d + '/node_modules/playwright/index.mjs')
          cands.push(r + '/' + d + '/playwright/index.mjs')
        }
      }
    } catch (_) { /* skip */ }
  }
  cands.push('D:/deepseek-harness/deepseek-harness/node_modules/playwright/index.mjs')
  cands.push('C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/playwright/index.mjs')
  for (const c of cands) {
    try {
      if (existsSync(c)) return await import('file:///' + c.replace(/\\/g, '/'))
    } catch (_) { /* next */ }
  }
  throw new Error('找不到 playwright')
}
function findChromium() {
  const base = 'C:/Users/Lenovo/AppData/Local/ms-playwright'
  try {
    for (const d of readdirSync(base)) {
      if (d.startsWith('chromium-')) {
        const exe = base + '/' + d + '/chrome-win64/chrome.exe'
        if (existsSync(exe)) return exe
      }
    }
  } catch (_) { /* skip */ }
  return undefined
}

// EXPECT 守卫（与 render 脚本一致，防声明值被外部放宽）
const EXPECT = {
  'divider-line':    { parts: 1, mainRuns: 1, maxRuns: 2,  axisY: 45, span: [[0, 750]] },
  'divider-dots':    { parts: 3, mainRuns: 3, maxRuns: 6,  axisY: 45, span: [[347, 359], [369, 381], [391, 403]] },
  'divider-bar':     { parts: 1, mainRuns: 1, maxRuns: 2,  axisY: 45, span: [[288.5, 461.5]] },
  'divider-vine':    { parts: 1, mainRuns: 1, maxRuns: 16, axisY: 45, span: [[102, 648]] },
  'divider-ribbon':  { parts: 1, mainRuns: 1, maxRuns: 3,  axisY: 45, span: [[0, 750]] },
  'divider-dual':    { parts: 2, mainRuns: 2, maxRuns: 4,  axisY: 45, span: [[262, 366], [384, 487]] },
  'divider-section': { parts: 1, mainRuns: 1, maxRuns: 12, axisY: 104, span: [[311, 439]] },
  'divider-guochao': { parts: 3, mainRuns: 3, maxRuns: 3,  axisY: 45, span: [[233, 337], [413, 517]] },
  'divider-campus':  { parts: 3, mainRuns: 3, maxRuns: 5,  axisY: 45, span: [[347, 359], [369, 381], [391, 403]] },
  'divider-tech':    { parts: 1, mainRuns: 1, maxRuns: 3,  axisY: 45, span: [[288.5, 461.5]] },
}
const expectGuard = []
for (const a of dividerArts) {
  const e = EXPECT[a.name]
  const b = a.band, lc = a.lineCheck
  if (!e || b.parts !== e.parts || b.mainRuns !== e.mainRuns || b.maxRuns !== e.maxRuns ||
    lc.axisY !== e.axisY || JSON.stringify(lc.span) !== JSON.stringify(e.span)) expectGuard.push(a.name)
}
if (expectGuard.length) {
  console.log('EXPECT 守卫失败: ' + expectGuard.join(', '))
  process.exit(1)
}

// —— 演示文案 ——
const SECTION_TITLE = { text: '第三章 · 开始行动', size: 18, color: '#2f4a41' } // ≤10 字
const CONTENT_W = 343 // 375 壳两侧各 16px padding
const scale = CONTENT_W / 750

function demoCard(a) {
  const pngPath = fileURLToPath(new URL('./png-divider/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const isSection = a.zone !== null
  // 章节组合式：标题叠入 zone 左上（内缩 6px，顶部 +4px 显示）
  const layer = isSection
    ? `<div data-zone="0" data-line="title" style="position:absolute;top:${Math.round(a.zone.y0 * scale + 4)}px;left:${Math.round(a.zone.x0 * scale + 6)}px;right:${Math.round(a.zone.x0 * scale + 6)}px;font-size:${SECTION_TITLE.size}px;font-weight:700;color:${SECTION_TITLE.color};line-height:1.4;white-space:nowrap;">${SECTION_TITLE.text}</div>`
    : ''
  return `
<div data-card="${a.name}" data-zones='${JSON.stringify(a.zone || { x0: 0, y0: 0, x1: 750, y1: 90 })}' style="background:#fff;border-radius:12px;padding:14px 0 18px;margin:0 0 18px;box-shadow:0 1px 4px rgba(0,0,0,.05);">
  <div style="padding:0 16px;margin:0 0 10px;">
    <span style="display:inline-block;background:#f0f0ee;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;margin-right:6px;">${a.type}</span>
    <span style="display:inline-block;background:#f0f0ee;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;margin-right:6px;">${a.style}</span>
    <span style="font-size:11px;color:#999;">${a.name} · ${a.label}</span>
  </div>
  <div style="position:relative;margin:0 16px;height:${IMG_H}px;overflow:hidden;border-radius:10px;background:#fdfdfb;">
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;"/>
    ${layer}
  </div>
</div>`
}

const cards = dividerArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 8px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">分割线组件 · 375px 壳实测（divider）</h1>
<h2 style="text-align:center">10 个素材 = 7 种组合方式（类型）× 6 种风格（内容）· 章节组合式叠真实标题于 zone · 无文字型检查装饰洁净带与显示尺寸</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-divider-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-divider-375.png', import.meta.url)), fullPage: true })

  // —— 核心验收：浏览器内逐资产检查 ——
  const check = await pv.evaluate(async ({ arts, scanSrc, scale }) => {
    const scan = eval('(' + scanSrc + ')')
    const out = []
    for (const art of arts) {
      const card = document.querySelector('[data-card="' + art.name + '"]')
      const cont = card.querySelector('div[style*="position:relative"]')
      const img = cont.querySelector('img')
      await new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res } })
      const res = { name: art.name, isSection: art.zone !== null, zoneV: [], bandV: [], thickDisplay: 0, decorOk: true, decorSizes: [] }
      if (art.zone) {
        // —— 章节组合式：DOM 文字边界 vs zone 矩形 ——
        const TOL = 1.5
        const z = art.zone
        const cr = cont.getBoundingClientRect()
        const zr = {
          left: cr.left + z.x0 * (cr.width / 750),
          top: cr.top + z.y0 * (cr.height / art.h),
          right: cr.left + z.x1 * (cr.width / 750),
          bottom: cr.top + z.y1 * (cr.height / art.h),
        }
        const t = cont.querySelector('[data-zone="0"]')
        const tr = t.getBoundingClientRect()
        const bad = []
        if (tr.left < zr.left - TOL) bad.push('left溢出' + (zr.left - tr.left).toFixed(1))
        if (tr.right > zr.right + TOL) bad.push('right溢出' + (tr.right - zr.right).toFixed(1))
        if (tr.top < zr.top - TOL) bad.push('top溢出' + (zr.top - tr.top).toFixed(1))
        if (tr.bottom > zr.bottom + TOL) bad.push('bottom溢出' + (tr.bottom - zr.bottom).toFixed(1))
        res.zoneV = bad
      }
      // —— 通用：375 显示尺度洁净带重扫 ——
      const S = 4
      const dw = Math.round(art.w * scale), dh = Math.round(art.h * scale)
      const dc = document.createElement('canvas')
      dc.width = dw; dc.height = dh
      const dctx = dc.getContext('2d')
      dctx.drawImage(img, 0, 0, dw, dh)
      const dd = dctx.getImageData(0, 0, dw, dh).data
      const scanRes = scan(art, dd, dw, dh, scale, 4)
      res.bandV = scanRes.violations
      // —— 线体显示厚度（4x PNG 实测 × scale ≥ 2.5px）——
      const big = document.createElement('canvas')
      big.width = art.w * S; big.height = art.h * S
      const bctx = big.getContext('2d')
      bctx.drawImage(img, 0, 0, art.w * S, art.h * S)
      const bd = bctx.getImageData(0, 0, big.width, big.height).data
      const bScan = scan(art, bd, big.width, big.height, S, 25)
      res.thickDisplay = bScan.thick * scale
      // —— 装饰显示 ≥16px + 渲染真实性 ——
      for (const dcq of art.decorChecks) {
        res.decorSizes.push(+(dcq.he * 2 * scale).toFixed(1))
        const xa = Math.round((dcq.cx - dcq.he) * S), xb = Math.round((dcq.cx + dcq.he) * S)
        const ya = Math.round((dcq.cy - dcq.he) * S), yb = Math.round((dcq.cy + dcq.he) * S)
        let fgN = 0, tot = 0
        for (let y = Math.max(0, ya); y <= Math.min(big.height - 1, yb); y++) {
          for (let x = Math.max(0, xa); x <= Math.min(big.width - 1, xb); x++) {
            tot++
            if (bd[(y * big.width + x) * 4 + 3] >= 60) fgN++
          }
        }
        if (tot > 0 && fgN / tot < 0.05) res.decorOk = false
      }
      out.push(res)
    }
    return out
  }, { arts: dividerArts, scanSrc: scanCleanBandSrc, scale })

  console.log('======== 375px 壳实测 ========')
  let pass = 0, fail = 0
  for (const c of check) {
    let ok
    if (c.isSection) {
      ok = c.zoneV.length === 0 && c.bandV.length === 0
      console.log((ok ? 'OK  ' : 'FAIL') + ' ' + c.name.padEnd(20) + ' zone文字' + (c.zoneV.length ? '✗[' + c.zoneV.join(';') + ']' : '✓') +
        '  洁净带' + (c.bandV.length ? '✗[' + c.bandV.join(';') + ']' : '✓') + '  线厚' + c.thickDisplay.toFixed(2) + 'px')
    } else {
      ok = c.bandV.length === 0 && c.thickDisplay >= 2.5 && c.decorOk && c.decorSizes.every((s) => s >= 16)
      console.log((ok ? 'OK  ' : 'FAIL') + ' ' + c.name.padEnd(20) +
        '  洁净带' + (c.bandV.length ? '✗[' + c.bandV.join(';') + ']' : '✓') +
        '  线厚' + c.thickDisplay.toFixed(2) + 'px' + (c.thickDisplay >= 2.5 ? '' : '✗') +
        '  装饰显示[' + c.decorSizes.join('/') + ']px' + (c.decorSizes.every((s) => s >= 16) ? '' : '✗') +
        (c.decorOk ? '' : '  decor✗'))
    }
    if (ok) pass++; else fail++
  }
  console.log('375px 壳实测通过 ' + pass + '/' + (pass + fail) + (fail ? ' —— 需修复后重跑' : ' —— 10/10 全部通过'))
  console.log('输出: test/assets/divider/demo-divider-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
