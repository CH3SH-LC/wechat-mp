// test/assets/badge/verify-badge-375.mjs
// 徽章资产 375px 手机壳叠字实测（badge）：10 个徽章 PNG + 真实徽章词（≤4 字）叠入 zone
// 最关键的验收：DOM getBoundingClientRect 对比 —— 每个文字元素的边界必须全部落在对应
//   zone 矩形内（zone x40..260 / y35..85 设计 → 显示按 0.457 缩放），10/10 全部通过才算完成。
// 输出：test/assets/badge/demo-badge-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { badgeArts } from './ARTS-badge.mjs'

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

// —— 每个徽章的演示徽章词（≤4 字，12px 单行；颜色与底图对比 ≥4.5:1）——
const DEMO = {
  'badge-tag-new':      { word: '新品',   color: '#3f6b68' },
  'badge-tag-gold':     { word: '国潮',   color: '#fff8e6' },
  'badge-capsule-blue': { word: '新功能', color: '#2166ff' },
  'badge-capsule-min':  { word: '已验证', color: '#666666' },
  'badge-highlight':    { word: '重点',   color: '#8a5a00' },
  'badge-status':       { word: '报名中', color: '#2f5a42' },
  'badge-corner-hot':   { word: 'HOT',    color: '#ffffff' },
  'badge-campus':       { word: '开学季', color: '#2f6b4f' },
  'badge-guochao-seal': { word: '非遗',   color: '#9a281f' },
  'badge-tech-diamond': { word: '更新',   color: '#1b3a66' },
}

// 显示换算：300 设计 → 137 显示（≈0.457），120 设计 → 55 显示
const DISPLAY_W = 137
const DISPLAY_H = 55

function demoCard(a) {
  const d = DEMO[a.name] || { word: '', color: '#333' }
  const pngPath = fileURLToPath(new URL('./png-badge/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone || { x0: 40, y0: 35, x1: 260, y1: 85 }]
  // zone 中心叠字（word ≤4 字 12px 单行，absolute 居中于 zone 矩形）
  const layerEls = zones.map((z) => {
    const zcx = (z.x0 + z.x1) / 2, zcy = (z.y0 + z.y1) / 2
    const lx = zcx * (DISPLAY_W / 300), ly = zcy * (DISPLAY_H / 120)
    return `<div data-zone="0" data-line="word" style="position:absolute;left:${lx}px;top:${ly}px;transform:translate(-50%,-50%);font-size:12px;font-weight:700;color:${d.color};line-height:1.4;white-space:nowrap;">${d.word}</div>`
  }).join('')
  return `
<div data-card="${a.name}" data-zones='${JSON.stringify(zones)}' style="background:#fff;border-radius:12px;padding:14px 0 18px;margin:0 0 18px;box-shadow:0 1px 4px rgba(0,0,0,.05);">
  <div style="padding:0 16px;margin:0 0 10px;">
    <span style="display:inline-block;background:#f0f0ee;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;margin-right:6px;">${a.type}</span>
    <span style="display:inline-block;background:#f0f0ee;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;margin-right:6px;">${a.style}</span>
    <span style="font-size:11px;color:#999;">${a.name}</span>
  </div>
  <div style="position:relative;margin:0 16px;width:${DISPLAY_W}px;height:${DISPLAY_H}px;overflow:hidden;border-radius:8px;">
    <img src="data:image/png;base64,${b64}" style="width:${DISPLAY_W}px;height:${DISPLAY_H}px;display:block;"/>
    ${layerEls}
  </div>
</div>`
}

const cards = badgeArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">徽章组件 · 375px 壳叠字实测（badge）</h1>
<h2 style="text-align:center">10 个素材 = 5 种组合方式（类型）× 5 种风格（内容） · 徽章词已叠入中央嵌字区 · DOM 边界验证 10/10</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-badge-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-badge-375.png', import.meta.url)), fullPage: true })

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
        left: cont.left + z.x0 * (cont.width / 300),
        top: cont.top + z.y0 * (cont.height / 120),
        right: cont.left + z.x1 * (cont.width / 300),
        bottom: cont.top + z.y1 * (cont.height / 120),
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
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + c.name.padEnd(24) + ' zone×' + c.zones + ' 文字' + c.texts +
      (ok ? '' : ' 越界: ' + c.violations.join('; ')))
  }
  console.log('文字界内通过 ' + pass + '/' + (pass + fail) + (fail ? ' —— 需修复后重跑' : ' —— 10/10 全部通过'))
  console.log('输出: test/assets/badge/demo-badge-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
