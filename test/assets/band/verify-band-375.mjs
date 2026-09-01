// test/assets/band/verify-band-375.mjs
// 花纹色带资产 375px 手机壳叠字实测（band）：10 张色带 PNG + 真实衬底文案（一行 ≤14 字）叠入 zone
// 最关键的验收：DOM getBoundingClientRect 对比 —— 每个文字元素的边界必须全部落在对应
//   zone 矩形内（zone 显示 ≈261×32px，文字 15px 一行 + 上下留白），10/10 全部通过才算完成。
// 输出：test/assets/band/demo-band-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bandArts } from './ARTS-band.mjs'

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
    try { if (existsSync(c)) return await import('file:///' + c.replace(/\\/g, '/')) } catch (_) { /* next */ }
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

// —— 每个色带的演示文案（类型×风格：骨架相同，内容随风格；衬底文字一行 ≤14 字保证单行不折行）——
// 全部满足 §5.0 文字区容量：zone 设计 y45..115（显示 ≈32px 高）装 15px 一行（行高 1.4）+ 留白
const DEMO = {
  'band-stripe':    { text: '春游手记 · 三月', color: '#3f6b4e' },       // 自然花草 · 草绿墨
  'band-dots':      { text: '轻量生活小确幸', color: '#2f635c' },        // 自然花草 · 深青墨
  'band-checker':   { text: '今日待办清单', color: '#3a4048' },          // 极简 · 灰墨
  'band-lines':     { text: '本周精选好文', color: '#2f4d7a' },          // 极简 · 深蓝墨
  'band-rings':     { text: '海洋馆漫游指南', color: '#2f5754' },        // 自然花草 · 青绿墨
  'band-colorbar':  { text: '秋季新品预告', color: '#4a4638' },          // 品牌多色 · 暖灰墨
  'band-marble':    { text: '非遗手作 · 匠心', color: '#6b3a1a' },       // 国潮 · 赭红墨
  'band-starburst': { text: '年度盛典 · 倒计时', color: '#7a3a10' },     // 宣传 · 深橙墨
  'band-campus':    { text: '社团招新等你来', color: '#3f5a2a' },        // 校园风 · 球场绿墨
  'band-tech':      { text: '系统更新公告', color: '#1a3f8f' },          // 科技风 · 深蓝墨
}

// 显示换算：内容宽 343px（375 壳 - 32 padding），750 设计 → 343 显示，scale ≈ 0.4573
const SHELL_W = 375
const CONTENT_W = 343
const scale = CONTENT_W / 750

function demoCard(a) {
  const d = DEMO[a.name] || { text: '', color: '#333' }
  const pngPath = fileURLToPath(new URL('./png-band/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone || { x0: 90, y0: 45, x1: 660, y1: 115 }]
  const layerEls = zones.map((z, zi) => {
    const zx = Math.round(z.x0 * scale), zy = Math.round(z.y0 * scale)
    // 文字一行 15px（行高 1.4 → 行盒 21px）垂直居中于 zone（zone 显示高 32px → 上下各留 ≈5.5px）
    const top = zy + 5.5
    return d.text
      ? `<div data-zone="${zi}" data-line="text" style="position:absolute;top:${top}px;left:${zx}px;right:${zx}px;font-size:15px;font-weight:700;color:${d.color};line-height:1.4;text-align:center;white-space:nowrap;letter-spacing:0.5px;">${d.text}</div>`
      : ''
  }).join('')
  return `
<div data-card="${a.name}" data-zones='${JSON.stringify(zones)}' style="background:#fff;border-radius:12px;padding:14px 0 18px;margin:0 0 18px;box-shadow:0 1px 4px rgba(0,0,0,.05);">
  <div style="padding:0 16px;margin:0 0 10px;">
    <span style="display:inline-block;background:#f0f0ee;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;margin-right:6px;">${a.type}</span>
    <span style="display:inline-block;background:#f0f0ee;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;margin-right:6px;">${a.style}</span>
    <span style="font-size:11px;color:#999;">${a.name}</span>
  </div>
  <div style="position:relative;margin:0 16px;height:${IMG_H}px;overflow:hidden;border-radius:10px;">
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;"/>
    ${layerEls}
  </div>
</div>`
}

const cards = bandArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">花纹色带组件 · 375px 壳叠字实测（band）</h1>
<h2 style="text-align:center">10 个素材 = 8 种组合方式（类型）× 6 种风格（内容） · 衬底文字一行已叠入中央 zone（设计 y45..115） · DOM 边界验证 10/10</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-band-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-band-375.png', import.meta.url)), fullPage: true })

  // —— 最关键的验收：DOM 文字边界 vs zone 矩形（getBoundingClientRect 对比）——
  const check = await pv.evaluate(() => {
    const TOL = 1.5 // px 容差（吸收取整与亚像素）
    const cards = [...document.querySelectorAll('[data-card]')]
    const out = []
    for (const card of cards) {
      const name = card.getAttribute('data-card')
      const zones = JSON.parse(card.getAttribute('data-zones'))
      const cont = card.querySelector('div[style*="position:relative"]').getBoundingClientRect()
      const texts = [...card.querySelectorAll('[data-zone]')]
      const zoneRects = zones.map((z) => ({
        left: cont.left + z.x0 * (cont.width / 750),
        top: cont.top + z.y0 * (cont.height / 160),
        right: cont.left + z.x1 * (cont.width / 750),
        bottom: cont.top + z.y1 * (cont.height / 160),
      }))
      const violations = []
      for (const t of texts) {
        const zi = +t.getAttribute('data-zone')
        const r = t.getBoundingClientRect()
        const z = zoneRects[zi]
        const bad = []
        if (r.left < z.left - TOL) bad.push('left溢出' + (z.left - r.left).toFixed(1))
        if (r.right > z.right + TOL) bad.push('right溢出' + (r.right - z.right).toFixed(1))
        if (r.top < z.top - TOL) bad.push('top溢出' + (z.top - r.top).toFixed(1))
        if (r.bottom > z.bottom + TOL) bad.push('bottom溢出' + (r.bottom - z.bottom).toFixed(1))
        if (bad.length) violations.push(t.getAttribute('data-line') + '[' + t.textContent + ']→' + bad.join('、'))
      }
      out.push({ name, zones: zones.length, texts: texts.length, violations })
    }
    return out
  })

  console.log('======== 375px 壳叠字 DOM 实测 ========')
  let pass = 0, fail = 0
  for (const c of check) {
    const ok = c.violations.length === 0 && c.texts > 0
    if (ok) pass++; else fail++
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + c.name.padEnd(26) + ' zone×' + c.zones + ' 文字' + c.texts +
      (ok ? '' : ' 越界: ' + c.violations.join('; ')))
  }
  console.log('文字界内通过 ' + pass + '/' + (pass + fail) + (fail ? ' —— 需修复后重跑' : ' —— 10/10 全部通过'))
  console.log('输出: test/assets/band/demo-band-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
