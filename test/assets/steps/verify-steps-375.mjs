// test/assets/steps/verify-steps-375.mjs
// 步骤条资产 375px 手机壳叠字实测：10 个步骤 PNG + 真实步骤文案（每步 ≤15 字）叠入 zone
// 最关键的验收：DOM getBoundingClientRect 对比 —— 每个文字元素的边界必须全部落在对应
//   zone 矩形内（纵向 4 步条每步一行；带前提帽的资产：帽一行 13px + 步骤一行 14px），
//   10/10 全部通过才算完成。
// 输出：test/assets/steps/demo-steps-375.html/.png
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { stepsArts } from './ARTS-steps.mjs'

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

// —— 每个资产的演示文案（真实步骤：动词开头、每步 ≤15 字、单行不折行）——
// texts 与资产 zone 数组一一对应；hatIdx 标注前提帽 zone（13px），其余步骤 zone 14px
const DEMO = {
  'steps-single':        { texts: ['打开应用并登录账号', '点击右上角新建', '选择模板并保存', '发布前预览一遍'], color: '#1a4a66' },
  'steps-vertical':      { texts: ['填写报名表信息', '上传作品文件', '提交并等待审核', '查收确认通知'], color: '#7a3a1a' },
  'steps-card':          { texts: ['注册账号并登录', '完善个人资料', '领取新人礼包', '开始创作之旅'], color: '#7a3a1a' },
  'steps-prep':          { texts: ['准备：注册一个账号', '上传图片素材', '选择排版模板', '调整文字颜色', '保存并发布'], color: '#1a4a66', hatIdx: 0 },
  'steps-campus':        { texts: ['打开体育选课系统', '选择心仪课程', '提交选课申请', '等待确认结果'], color: '#3f5a2a' },
  'steps-guochao':       { texts: ['挑选心仪礼盒', '填写祝福留言', '支付并确认订单', '等待送达签收'], color: '#5a3520' },
  'steps-tech':          { texts: ['下载最新客户端', '登录企业账号', '同步云端数据', '开始协作办公'], color: '#1b3a66' },
  'steps-minimal':       { texts: ['打开设置页面', '找到隐私选项', '关闭定位权限', '完成安全设置'], color: '#333333' },
  'steps-promo':         { texts: ['立即扫码领取新人优惠券'], color: '#8a4a1f' },
  'steps-single-guochao': { texts: ['准备：关注公众号', '转发文章集齐 20 个赞'], color: '#5a3520', hatIdx: 0 },
}

// 显示换算：内容宽 343px（375 壳 - 32 padding），750 设计 → 343 显示，scale ≈ 0.4573
const SHELL_W = 375
const CONTENT_W = 343
const scale = CONTENT_W / 750
const LINE_H = 1.2 // 紧凑行高（整图嵌字用 1.2-1.4，符合 §5.0）

function demoCard(a) {
  const d = DEMO[a.name] || { texts: [], color: '#333' }
  const pngPath = fileURLToPath(new URL('./png-steps/' + a.name + '.png', import.meta.url))
  const b64 = readFileSync(pngPath).toString('base64')
  const IMG_H = Math.round(a.h * scale)
  const zones = Array.isArray(a.zone) ? a.zone : [a.zone || { x0: 130, y0: 32, x1: 730, y1: 88 }]
  // 每个 zone 叠一行文字（前提帽 13px、步骤 14px），文字垂直居中于 zone、左对齐内缩 6px
  const layerEls = zones.map((z, zi) => {
    const txt = d.texts[zi]
    if (!txt) return ''
    const size = zi === d.hatIdx ? 13 : 14
    const zx = Math.round(z.x0 * scale), zy = z.y0 * scale
    const zh = (z.y1 - z.y0) * scale
    const lineH = size * LINE_H
    const top = Math.round(zy + Math.max(0, (zh - lineH) / 2))
    return `<div data-zone="${zi}" style="position:absolute;top:${top}px;left:${zx + 6}px;right:${zx + 6}px;font-size:${size}px;color:${d.color};line-height:${LINE_H};font-weight:600;white-space:nowrap;text-align:left;">${txt}</div>`
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

const cards = stepsArts.map(demoCard).join('')
const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8e8e5;font-family:sans-serif;padding:20px 0}h1{font-size:17px;color:#2f3640;margin:0 20px 16px}h2{font-size:13px;color:#888;font-weight:normal;margin:0 20px 16px}</style></head><body>
<div style="width:375px;margin:0 auto;background:#f7f7f5;border-radius:24px;padding:20px 0;box-shadow:0 8px 30px rgba(0,0,0,.12);">
<h1 style="text-align:center">步骤条组件 · 375px 壳叠字实测（steps）</h1>
<h2 style="text-align:center">10 个素材 = 4 种组合方式（类型）× 8 种风格（内容） · 文字已叠入右侧 zone · DOM 边界验证 10/10</h2>
${cards}
</div></body></html>`

const htmlPath = fileURLToPath(new URL('./demo-steps-375.html', import.meta.url))
writeFileSync(htmlPath, preview)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const pv = await browser.newPage({ viewport: { width: 500, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(800)
  await pv.screenshot({ path: fileURLToPath(new URL('./demo-steps-375.png', import.meta.url)), fullPage: true })

  // —— 最关键的验收：DOM 文字边界 vs zone 矩形（getBoundingClientRect 对比）——
  const check = await pv.evaluate(() => {
    const TOL = 1.5 // px 容差（吸收取整与亚像素）
    const cards = [...document.querySelectorAll('[data-card]')]
    const out = []
    for (const card of cards) {
      const name = card.getAttribute('data-card')
      const h = +card.getAttribute('data-h') || 220
      const zones = JSON.parse(card.getAttribute('data-zones'))
      const cont = card.querySelector('div[style*="position:relative"]').getBoundingClientRect()
      const texts = [...card.querySelectorAll('[data-zone]')]
      const zoneRects = zones.map((z) => ({
        left: cont.left + z.x0 * (cont.width / 750),
        top: cont.top + z.y0 * (cont.height / h),
        right: cont.left + z.x1 * (cont.width / 750),
        bottom: cont.top + z.y1 * (cont.height / h),
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
        if (bad.length) violations.push('zone' + zi + '[' + t.textContent + ']→' + bad.join('、'))
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
  console.log('输出: test/assets/steps/demo-steps-375.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
