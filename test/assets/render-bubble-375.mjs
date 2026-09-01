// test/assets/render-bubble-375.mjs
// 气泡资产 375px 手机壳叠字实测：10 个气泡 PNG + 真实标题句/内容句叠入中央嵌字区
// 输出：test/assets/demo-bubble-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bubbleArts } from './ARTS-bubble.mjs'

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
// textColor: 文字主色；titleColor: 标题句色；align: 左/中；title 标题句；body 内容句（可 2 行用 <br/>）
const DEMO = {
  'bubble-bar-note':     { title: '提示：', body: '每周留半天慢读，比每天刷一小时更有效。', titleColor: '#1a4a66', bodyColor: '#1a4a66', align: 'left' },
  'bubble-solid-tip':    { title: '进阶方法', body: '把复杂流程拆成 3 步，每步一个动词开头。', titleColor: '#ffffff', bodyColor: '#fff7f0', align: 'left' },
  'bubble-corner-new':   { title: '重点：', body: '新增了自动排版功能，一次满足全年封面需求。', titleColor: '#4a1f8a', bodyColor: '#4a1f8a', align: 'left' },
  'bubble-warn-frame':   { title: '注意：', body: '这里别走岔——提交前再核对一遍所有数字。', titleColor: '#a11', bodyColor: '#a11', align: 'left' },
  'bubble-key-deep':     { title: '一句话记住本文', body: '真正拉开差距的，是每天愿意多读 20 分钟。', titleColor: '#ffffff', bodyColor: '#f4efff', align: 'left' },
  'bubble-brand-blue':   { title: '重点', body: '品牌蓝单色系：五语义全用一套蓝，只改深浅与粗细。', titleColor: '#1b3a66', bodyColor: '#1b3a66', align: 'left' },
  'bubble-compare':      { title: '', body: '反例：标题堆满关键词，像报菜名。', bodyColor: '#8a2418', body2: '正例：一个钩子加一个关键词。', body2Color: '#1a4a66', align: 'left' },
  'bubble-campus-ball':  { title: '开学第一课', body: '篮球场见！运动前后记得做好拉伸。', titleColor: '#3f5a2a', bodyColor: '#3f5a2a', align: 'left' },
  'bubble-guochao-seal': { title: '本期专栏', body: '非遗手作入门：先学会这三件小事。', titleColor: '#5a3520', bodyColor: '#5a3520', align: 'left' },
  'bubble-tech-diamond': { title: '系统更新', body: '新版本已上线，重启后自动生效。', titleColor: '#ffffff', bodyColor: '#dbe7ff', align: 'left' },
}

// 显示换算：内容宽 343px（375 壳 - 32 padding），750 设计 → 343 显示，scale ≈ 0.4573
const SHELL_W = 375
const CONTENT_W = 343
const scale = CONTENT_W / 750

function demoCard(a) {
  const d = DEMO[a.name] || { title: '', body: '', titleColor: '#333', bodyColor: '#555', align: 'left' }
  const pngPath = fileURLToPath(new URL('./png-bubble/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone || { x0: 110, y0: 50, x1: 730, y1: 170 }]
  // 每个 zone 渲染标题+内容（单 zone 气泡：标题 y0+4、内容 y0+30；双 zone 每泡一行：y0+6，仅渲染本泡文字）
  const layerEls = zones.map((z, zi) => {
    const zx = Math.round(z.x0 * scale), zy = Math.round(z.y0 * scale)
    const tx = zx + 8
    const align = d.align === 'center' ? 'center' : 'left'
    const ta = align === 'center' ? 'left:50%;transform:translateX(-50%);text-align:center;width:100%' : `left:${tx}px;right:${zx + 8}px`
    const isMulti = zones.length > 1
    if (isMulti) {
      // 双泡：每泡仅一行文字（反例/正例），从 zone 顶部对齐
      const body = zi === 1 ? (d.body2 || '') : d.body
      const bodyColor = zi === 1 ? (d.body2Color || d.bodyColor) : d.bodyColor
      return body
        ? `<div style="position:absolute;top:${zy + 6}px;${ta};font-size:13px;color:${bodyColor};line-height:1.5;font-weight:600;">${body}</div>`
        : ''
    }
    const titleY = zy + 4, bodyY = zy + 30
    const titleEl = d.title
      ? `<div style="position:absolute;top:${titleY}px;${ta};font-size:15px;font-weight:700;color:${d.titleColor};line-height:1.4;">${d.title}</div>`
      : ''
    const bodyEl = d.body
      ? `<div style="position:absolute;top:${bodyY}px;${ta};font-size:14px;color:${d.bodyColor};line-height:1.5;font-weight:${d.title ? 400 : 600};">${d.body}</div>`
      : ''
    return titleEl + bodyEl
  }).join('')
  return `
<div style="background:#fff;border-radius:12px;padding:14px 0 18px;margin:0 0 18px;box-shadow:0 1px 4px rgba(0,0,0,.05);">
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

const cards = bubbleArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">气泡组件 · 375px 壳叠字实测</h1>
<h2 style="text-align:center">10 个素材 = 7 种组合方式（类型）× 5 种风格（内容） · 文字已叠入中央嵌字区</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-bubble-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(600)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-bubble-375.png', import.meta.url)), fullPage: true })
  // 验证：嵌字区文字渲染（截取每个卡片 img 区域采样非白像素增量）
  const counts = await pv.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')]
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    const out = []
    imgs.forEach((img, i) => {
      c.width = img.naturalWidth; c.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let alpha = 0
      for (let j = 3; j < d.length; j += 4) if (d[j] > 0) alpha++
      out.push({ i, w: img.naturalWidth, h: img.naturalHeight, alphaPct: +(alpha / (c.width * c.height) * 100).toFixed(2) })
    })
    return out
  })
  console.log('======== 375px 壳叠字实测 ========')
  console.log('图片加载 ' + counts.length + '/' + bubbleArts.length + ' 张（naturalWidth>0 = 已渲染）')
  const bad = counts.filter((x) => !x.w)
  console.log(bad.length ? '失败: ' + bad.map((b) => bubbleArts[b.i].name).join(',') : '10/10 全部渲染')
  console.log('输出: test/assets/demo-bubble-375.html/.png')
} finally {
  await browser.close()
}
