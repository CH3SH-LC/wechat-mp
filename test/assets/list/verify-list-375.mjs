// test/assets/list/verify-list-375.mjs
// 列表资产 375px 手机壳叠字实测（list）：10 个列表 PNG + 真实文案叠入各行 zone
// 最关键的验收：DOM getBoundingClientRect 对比 —— 每条文字的边界必须全部落在对应
//   zone 行矩形内（整组 5 行 / 衬底强调式单条 1 行；每条 ≤20 字单行），10/10 全部通过才算完成。
// 输出：test/assets/list/demo-list-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { listArts } from './ARTS-list.mjs'

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

// —— 每个资产的真实文案（类型×风格：骨架相同，内容随组件语义与风格）——
// 整组 5 行：结构一致（全名词/全动词/全判断短句）；标题行（分组式）无标记；
// 单条：一行。全部 ≤20 字，保证 14px 单行不折行（≤22 字规范内）
const DEMO = {
  'list-dots': [
    { t: '一键导出微信图文', c: '#55412f' },
    { t: '多账号切换管理', c: '#55412f' },
    { t: '排版模板一键套用', c: '#55412f' },
    { t: '素材库云端同步', c: '#55412f' },
    { t: '定时发布自动提醒', c: '#55412f' },
  ],
  'list-arrow': [
    { t: '先梳理需求清单', c: '#55412f' },
    { t: '再选定整体风格', c: '#55412f' },
    { t: '接着搭好内容骨架', c: '#55412f' },
    { t: '然后填充正文细节', c: '#55412f' },
    { t: '最后整体检查发布', c: '#55412f' },
  ],
  'list-number': [
    { t: '整理原始素材', c: '#333333' },
    { t: '搭建排版骨架', c: '#333333' },
    { t: '套用列表组件', c: '#333333' },
    { t: '填入正文文字', c: '#333333' },
    { t: '导出图文发布', c: '#333333' },
  ],
  'list-lined': [
    { t: '全年无限次更新', c: '#55412f' },
    { t: '优先技术支持', c: '#55412f' },
    { t: '模板持续上新', c: '#55412f' },
    { t: '专属客服答疑', c: '#55412f' },
    { t: '纯净无广告体验', c: '#55412f' },
  ],
  'list-grouped': [
    { t: '核心功能', c: '#333333', b: true },
    { t: '自动排版一键套用', c: '#666666' },
    { t: '多账号切换管理', c: '#666666' },
    { t: '增值服务', c: '#333333', b: true },
    { t: '专属模板优先更新', c: '#666666' },
  ],
  'list-brand': [
    { t: '统一品牌视觉', c: '#1b3a66' },
    { t: '专业克制风格', c: '#1b3a66' },
    { t: '一套蓝贯穿全篇', c: '#1b3a66' },
    { t: '省心不费眼', c: '#1b3a66' },
    { t: '编辑定稿质感', c: '#1b3a66' },
  ],
  'list-campus': [{ t: '周三下午操场集合，记得穿运动鞋', c: '#3f5a2a' }],
  'list-guochao': [{ t: '非遗手作入门，先学会这三件事', c: '#5a3520' }],
  'list-tech': [{ t: '系统更新后请重启客户端生效', c: '#1b3a66' }],
  'list-promo': [{ t: '限时特惠：全场八折，今天截止', c: '#ffffff', b: true }],
}

// 显示换算：内容宽 343px（375 壳 - 32 padding），750 设计 → 343 显示，scale ≈ 0.4573
const SHELL_W = 375
const CONTENT_W = 343
const scale = CONTENT_W / 750

function demoCard(a) {
  const rows = DEMO[a.name] || []
  const pngPath = fileURLToPath(new URL('./png-list/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone]
  const isGroup = zones.length > 1
  // 整组：行高 36 设计 → 显示 16.46px；文字 14px × 行高 1.15 = 16.1px（垂直居中，余量 0.18px）
  // 单条：zone 高 92 设计 → 显示 42.07px；文字 14px × 行高 1.75 = 24.5px（上下 padding ≈8.8px）
  const rowDispH = (isGroup ? 36 : 92) * scale
  const textH = isGroup ? 14 * 1.15 : 14 * 1.75
  const lineH = isGroup ? 1.15 : 1.75
  const layerEls = zones.map((z, zi) => {
    const d = rows[zi]
    if (!d) return ''
    const zx = Math.round(z.x0 * scale), zy = Math.round(z.y0 * scale)
    const tx = zx + 2
    const top = Math.round(zy + (rowDispH - textH) / 2)
    return `<div data-zone="${zi}" data-line="row" style="position:absolute;top:${top}px;left:${tx}px;right:${tx}px;line-height:${lineH};"><span data-t style="display:inline-block;white-space:nowrap;vertical-align:top;font-size:14px;line-height:${lineH};color:${d.c};font-weight:${d.b ? 700 : 400};">${d.t}</span></div>`
  }).join('')
  return `
<div data-card="${a.name}" data-h="${a.h}" data-zones='${JSON.stringify(zones)}' style="background:#fff;border-radius:12px;padding:14px 0 18px;margin:0 0 18px;box-shadow:0 1px 4px rgba(0,0,0,.05);">
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

const cards = listArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">列表组件 · 375px 壳叠字实测（list）</h1>
<h2 style="text-align:center">10 个素材 = 6 种组合方式（类型）× 6 种风格（内容） · 文字已叠入各行 zone · DOM 边界验证 10/10</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-list-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-list-375.png', import.meta.url)), fullPage: true })

  // —— 最关键的验收：DOM 文字边界 vs zone 行矩形（getBoundingClientRect 对比）——
  const check = await pv.evaluate(() => {
    const TOL = 1.5 // px 容差（吸收取整与亚像素）
    const cards = [...document.querySelectorAll('[data-card]')]
    const out = []
    for (const card of cards) {
      const name = card.getAttribute('data-card')
      const h = +card.getAttribute('data-h')
      const zones = JSON.parse(card.getAttribute('data-zones'))
      const cont = card.querySelector('div[style*="position:relative"]').getBoundingClientRect()
      const spans = [...card.querySelectorAll('[data-t]')]
      const zoneRects = zones.map((z) => ({
        left: cont.left + z.x0 * (cont.width / 750),
        top: cont.top + z.y0 * (cont.height / h),
        right: cont.left + z.x1 * (cont.width / 750),
        bottom: cont.top + z.y1 * (cont.height / h),
      }))
      const violations = []
      for (const s of spans) {
        const zi = +s.parentElement.getAttribute('data-zone')
        const r = s.getBoundingClientRect()
        const z = zoneRects[zi]
        const bad = []
        if (r.left < z.left - TOL) bad.push('left溢出' + (z.left - r.left).toFixed(1))
        if (r.right > z.right + TOL) bad.push('right溢出' + (r.right - z.right).toFixed(1))
        if (r.top < z.top - TOL) bad.push('top溢出' + (z.top - r.top).toFixed(1))
        if (r.bottom > z.bottom + TOL) bad.push('bottom溢出' + (r.bottom - z.bottom).toFixed(1))
        if (bad.length) violations.push('行' + zi + '[' + s.textContent + ']→' + bad.join('、'))
      }
      out.push({ name, zones: zones.length, texts: spans.length, violations })
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
  console.log('输出: test/assets/list/demo-list-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
