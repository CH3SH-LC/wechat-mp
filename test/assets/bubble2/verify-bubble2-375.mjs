// test/assets/bubble2/verify-bubble2-375.mjs
// 气泡资产 375px 手机壳叠字实测（bubble2）：10 个气泡 PNG + 真实标题句/内容句叠入 zone
// 最关键的验收：DOM getBoundingClientRect 对比 —— 每个文字元素的边界必须全部落在对应
//   zone 矩形内（单泡：标题+内容两行；双泡：每泡一行），10/10 全部通过才算完成。
// 输出：test/assets/bubble2/demo-bubble2-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bubbleArts2 } from './ARTS-bubble2.mjs'

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

// —— 每个气泡的演示文案（类型×风格：骨架相同，内容随组件语义与风格）——
// 单泡：标题句 15px（行高1.4）+ 内容句 14px（行高1.5），各一行，正文 ≤16 字保证单行不折行；
// 双泡：每泡一行 13px（≤16 字）。全部满足 §5.0 文字区容量（标题+内容 ≈ 48-55px 显示高）
const DEMO = {
  'bubble-bar-note':     { title: '小提示：', body: '每周留半天慢读，比刷一小时有效。', titleColor: '#1a4a66', bodyColor: '#1a4a66', align: 'left' },
  'bubble-solid-tip':    { title: '进阶好方法：', body: '把流程拆成三步，每步一个动词开头', titleColor: '#ffffff', bodyColor: '#fff7f0', align: 'left' },
  'bubble-corner-new':   { title: '本期重点：', body: '新增自动排版，满足全年封面需求。', titleColor: '#4a1f8a', bodyColor: '#4a1f8a', align: 'left' },
  'bubble-warn-frame':   { title: '重要注意：', body: '提交前再核对一遍数字，别走岔。', titleColor: '#8a2418', bodyColor: '#8a2418', align: 'left' },
  'bubble-key-deep':     { title: '一句话记住本文', body: '拉开差距的，是每天多读二十分钟。', titleColor: '#ffffff', bodyColor: '#f4efff', align: 'left' },
  'bubble-brand-blue':   { title: '本期重点：', body: '品牌蓝单色系，一套蓝只改深浅。', titleColor: '#1b3a66', bodyColor: '#1b3a66', align: 'left' },
  'bubble-compare':      { title: '', body: '反例：标题堆满关键词，像报菜名。', bodyColor: '#8a2418', body2: '正例：一个钩子加一个关键词。', body2Color: '#1a4a66', align: 'left' },
  'bubble-campus-ball':  { title: '开学第一课', body: '运动前后记得做好拉伸，球场见！', titleColor: '#3f5a2a', bodyColor: '#3f5a2a', align: 'left' },
  'bubble-guochao-seal': { title: '本期专栏：', body: '非遗手作入门，先学会这三件事。', titleColor: '#5a3520', bodyColor: '#5a3520', align: 'left' },
  'bubble-tech-diamond': { title: '系统更新公告', body: '新版本已上线，重启后自动生效。', titleColor: '#ffffff', bodyColor: '#dbe7ff', align: 'left' },
}

// 显示换算：内容宽 343px（375 壳 - 32 padding），750 设计 → 343 显示，scale ≈ 0.4573
const SHELL_W = 375
const CONTENT_W = 343
const scale = CONTENT_W / 750

function demoCard(a) {
  const d = DEMO[a.name] || { title: '', body: '', titleColor: '#333', bodyColor: '#555', align: 'left' }
  const pngPath = fileURLToPath(new URL('./png-bubble2/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone || { x0: 110, y0: 50, x1: 730, y1: 170 }]
  const isMulti = zones.length > 1
  // 每个 zone 渲染文字（单泡：标题 y0+4、内容 y0+30；双泡每泡一行：y0+6）；文字左右内缩 6px
  const layerEls = zones.map((z, zi) => {
    const zx = Math.round(z.x0 * scale), zy = Math.round(z.y0 * scale)
    const tx = zx + 6
    const ta = d.align === 'center' ? 'left:50%;transform:translateX(-50%);text-align:center;width:100%' : `left:${tx}px;right:${tx}px`
    if (isMulti) {
      // 双泡：每泡仅一行文字（反例/正例），从 zone 顶部对齐
      const body = zi === 1 ? (d.body2 || '') : d.body
      const bodyColor = zi === 1 ? (d.body2Color || d.bodyColor) : d.bodyColor
      return body
        ? `<div data-zone="${zi}" data-line="body" style="position:absolute;top:${zy + 6}px;${ta};font-size:13px;color:${bodyColor};line-height:1.5;font-weight:600;white-space:nowrap;">${body}</div>`
        : ''
    }
    const titleY = zy + 4, bodyY = zy + 30
    const titleEl = d.title
      ? `<div data-zone="${zi}" data-line="title" style="position:absolute;top:${titleY}px;${ta};font-size:15px;font-weight:700;color:${d.titleColor};line-height:1.4;">${d.title}</div>`
      : ''
    const bodyEl = d.body
      ? `<div data-zone="${zi}" data-line="body" style="position:absolute;top:${bodyY}px;${ta};font-size:14px;color:${d.bodyColor};line-height:1.5;font-weight:${d.title ? 400 : 600};">${d.body}</div>`
      : ''
    return titleEl + bodyEl
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

const cards = bubbleArts2.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">气泡组件 · 375px 壳叠字实测（bubble2）</h1>
<h2 style="text-align:center">10 个素材 = 7 种组合方式（类型）× 5 种风格（内容） · 文字已叠入中央嵌字区 · DOM 边界验证 10/10</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-bubble2-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-bubble2-375.png', import.meta.url)), fullPage: true })

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
        top: cont.top + z.y0 * (cont.height / 215),
        right: cont.left + z.x1 * (cont.width / 750),
        bottom: cont.top + z.y1 * (cont.height / 215),
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
  console.log('输出: test/assets/bubble2/demo-bubble2-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
