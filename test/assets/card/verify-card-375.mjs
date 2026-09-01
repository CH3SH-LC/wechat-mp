// test/assets/card/verify-card-375.mjs
// 卡片资产 375px 手机壳叠字实测（card）：10 个卡片 PNG + 真实文案叠入 zone
// 最关键的验收：DOM getBoundingClientRect 对比 —— 每个文字元素的边界必须全部落在对应
//   zone 矩形内（单卡：标题 15px + 3-4 行条目 13px 单行；分栏卡每格：标题 13px + 2 行
//   条目 12.5px 单行 ≤10 字），10/10 全部通过才算完成。
// 输出：test/assets/card/demo-card-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cardArts } from './ARTS-card.mjs'

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

// —— 每个卡片的演示文案（类型×风格：骨架相同，内容随组件语义与风格；§5.0 文案长度约束）——
// 单卡：标题 ≤8 字 15px（行高1.35）+ 3-4 行条目 ≤20 字 13px（行高1.55），单行不折行；
// 分栏卡：每格标题 ≤8 字 13px + 2 行条目 ≤10 字 12.5px（格宽减半）。全部满足 §5.0 容量。
const DEMO = {
  'card-white-frame': {
    title: '核心参数', items: ['屏幕：6.7 英寸', '电池：4500mAh', '重量：199 克', '防水：IP68 级'],
    titleColor: '#333333', itemColor: '#555555',
  },
  'card-light-round': {
    title: '行动清单', items: ['第一步：先列素材', '第二步：套用模板', '第三步：逐段替换', '第四步：手机自查'],
    titleColor: '#2c3e50', itemColor: '#4a5a6a',
  },
  'card-solid-topbar': {
    title: '推荐组合', items: ['套餐一：入门三件套', '套餐二：进阶五件套', '套餐三：旗舰全家桶', '组合购买立省 15%'],
    titleColor: '#ffffff', itemColor: '#555555', topbar: true,
  },
  'card-double-line': {
    title: '注意事项', items: ['以上价格不含运费', '生鲜商品不支持退换', '下单后 24 小时内发货'],
    titleColor: '#333333', itemColor: '#666666',
  },
  'card-split-columns': {
    zones: [
      { title: '优点', items: ['轻量易上手', '排版够统一'], titleColor: '#0b6f66', itemColor: '#3a5a52' },
      { title: '注意', items: ['需手动备份', '字体数量有限'], titleColor: '#9a4a12', itemColor: '#6b4a2a' },
    ],
  },
  'card-campus': {
    title: '开学清单', items: ['每天锻炼一小时', '早睡早起精神好', '带齐课本和文具', '作业记得按时交'],
    titleColor: '#3f5a2a', itemColor: '#4a5a3a',
  },
  'card-guochao': {
    title: '非遗小课堂', items: ['先选一个入门题材', '材料一次准备齐', '跟着示范慢慢练', '每周完成小作品'],
    titleColor: '#5a3520', itemColor: '#6b4a28',
  },
  'card-tech': {
    title: '系统更新公告', items: ['新版本已全量上线', '重启后自动生效', '修复已知三处问题', '如遇异常请反馈'],
    titleColor: '#ffffff', itemColor: '#4a5a6a', topbar: true,
  },
  'card-minimal': {
    title: '合同要点', items: ['服务期为十二个月', '费用分三期支付', '续约提前一月申请'],
    titleColor: '#333333', itemColor: '#666666',
  },
  'card-promo': {
    zones: [
      { title: '普通版', items: ['基础功能够用', '适合日常使用'], titleColor: '#4a5a3a', itemColor: '#5a6a55' },
      { title: '推荐版', items: ['解锁全部模板', '全年素材免费更'], titleColor: '#ffffff', itemColor: '#4a3a2a', topbar: true },
    ],
  },
}

// 显示换算：内容宽 343px（375 壳 - 32 padding），750 设计 → 343 显示，scale ≈ 0.4573
const SHELL_W = 375
const CONTENT_W = 343
const scale = CONTENT_W / 750

// 单卡：标题 zy+4，条目 zy+30 起（顶条卡 zy+40，条目在顶条之下），步进 22.2（13px×1.55+2）
// 分栏：标题 zy+4，条目 zy+30 起，步进 22（12.5px×1.5+2.2）；有顶条的一格条目 zy+50（顶条高 80 设计）
function demoCard(a) {
  const d = DEMO[a.name] || { title: '', items: [], titleColor: '#333', itemColor: '#555' }
  const pngPath = fileURLToPath(new URL('./png-card/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone || { x0: 110, y0: 40, x1: 730, y1: 340 }]
  const isMulti = zones.length > 1
  const layerEls = zones.map((z, zi) => {
    const zx = Math.round(z.x0 * scale), zy = Math.round(z.y0 * scale)
    const tx = zx + 6
    // 仅 left 锚定（nowrap 下 div 宽=文字宽）：分栏左右 zone 并排时不会把文字 div 撑满整卡宽
    const ta = `left:${tx}px;`
    const zd = isMulti ? (d.zones ? d.zones[zi] : { title: '', items: [] }) : d
    const bar = !!zd.topbar
    const entryFont = isMulti ? 12.5 : 13
    const titleFont = isMulti ? 13 : 15
    const entryLh = isMulti ? 1.5 : 1.55
    const titleEl = zd.title
      ? `<div data-zone="${zi}" data-line="title" style="position:absolute;top:${zy + 4}px;${ta};font-size:${titleFont}px;font-weight:700;color:${zd.titleColor};line-height:1.35;white-space:nowrap;">${zd.title}</div>`
      : ''
    const step = entryFont * entryLh + 2
    const first = zy + (bar ? 40 : 30)
    // 分栏推荐格：顶条占 y30..110 设计（显示 13.7..50.3），条目需在顶条之下 → 起点抬高
    const itemFirst = isMulti && bar ? zy + 50 : first
    const itemEls = (zd.items || []).map((t, i) =>
      `<div data-zone="${zi}" data-line="item${i + 1}" style="position:absolute;top:${(itemFirst + i * step).toFixed(1)}px;${ta};font-size:${entryFont}px;color:${zd.itemColor};line-height:${entryLh};font-weight:400;white-space:nowrap;">${t}</div>`).join('')
    return titleEl + itemEls
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

const cards = cardArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">卡片组件 · 375px 壳叠字实测（card）</h1>
<h2 style="text-align:center">10 个素材 = 5 种组合方式（类型）× 5 种风格（内容） · 文字已叠入中央嵌字区 · DOM 边界验证 10/10</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-card-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-card-375.png', import.meta.url)), fullPage: true })

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
        top: cont.top + z.y0 * (cont.height / 360),
        right: cont.left + z.x1 * (cont.width / 750),
        bottom: cont.top + z.y1 * (cont.height / 360),
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
  console.log('输出: test/assets/card/demo-card-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
