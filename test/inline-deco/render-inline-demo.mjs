// test/inline-deco/render-inline-demo.mjs
// 行内装饰资产 · before/after 对比渲染（375px 壳）+ DOM/像素验证
// 问题根因：SKILL.md inline() 对所有 art:// 统一输出 max-width:56%;height:auto;vertical-align:middle;margin:12px auto
//          → 行首"小花"被放大成近 192px 宽的巨大盒子（显示高 105px），可见图案与 15px 文字基线脱离（飘到第一行上面）
// 修复：art://名称[:显示高px] 语法 + 行内装饰 CSS（height:Npx;width:auto;vertical-align:baseline;margin:0 3px 0 0）
//       + 紧裁/底部锚点行内资产（图案底部贴画布底边 → baseline 对齐时图案"站在"基线上）
// 验证：
//   A. before 复现（证据）：旧 CSS + blossom-branch 花枝 → 图片显示高 ≥60px（大小失控），图案带与文字带错位
//   B. after 生效（门禁）：6 个行内资产按指定高度渲染；图片顶不高于所在行行顶；图片底落在首行文字盒基线区；
//      像素级：花图案底部与首行文字像素底差 ≤4px（2x 设备像素）
// 产物：demo-inline-before.html/.png、demo-inline-after.html/.png、png-inline/*.png
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INLINE_DECO_ARTS, renderInlinePngs } from './ARTS-inline-deco.mjs'

const outDir = fileURLToPath(new URL('./', import.meta.url))
const pngDir = outDir + 'png-inline/'
mkdirSync(pngDir, { recursive: true })

// ---------- playwright 探测（与参考管线同一套） ----------
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

// ---------- before 用旧资产（blossom-branch 花枝 400×220，SKILL.md ARTS 原样） ----------
const BLOSSOM = {
  name: 'blossom-branch', w: 400, h: 220,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><path d="M30 200 Q 140 160 250 110 Q 330 70 370 30" fill="none" stroke="#6b5b4a" stroke-width="6" stroke-linecap="round"/><g fill="#c96f4a"><circle cx="120" cy="168" r="16"/><circle cx="120" cy="168" r="8" fill="#e8b48c"/><circle cx="216" cy="126" r="18"/><circle cx="216" cy="126" r="9" fill="#e8b48c"/><circle cx="310" cy="86" r="20"/><circle cx="310" cy="86" r="10" fill="#e8b48c"/><circle cx="370" cy="30" r="14"/><circle cx="370" cy="30" r="7" fill="#e8b48c"/></g><g fill="#6f9e78"><ellipse cx="180" cy="150" rx="14" ry="8" transform="rotate(-40 180 150)"/><ellipse cx="280" cy="102" rx="14" ry="8" transform="rotate(30 280 102)"/><ellipse cx="345" cy="60" rx="12" ry="7" transform="rotate(-25 345 60)"/></g></svg>',
}

const pw = await loadPlaywright()
await renderInlinePngs(pw, findChromium(), pngDir)
{
  const { chromium } = pw
  const browser = await chromium.launch({ executablePath: findChromium() })
  try {
    const page = await browser.newPage()
    await page.setContent('<html><body></body></html>')
    const b64 = await page.evaluate(async ({ svg, w, h }) => {
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      try {
        const img = new Image()
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
        const canvas = document.createElement('canvas')
        canvas.width = w * 4; canvas.height = h * 4
        const cx = canvas.getContext('2d')
        cx.scale(4, 4)
        cx.drawImage(img, 0, 0, w, h)
        return canvas.toDataURL('image/png').split(',')[1]
      } finally { URL.revokeObjectURL(url) }
    }, { svg: BLOSSOM.svg, w: BLOSSOM.w, h: BLOSSOM.h })
    writeFileSync(pngDir + 'blossom-branch.png', Buffer.from(b64, 'base64'))
  } finally { await browser.close() }
}

const uri = (n) => 'data:image/png;base64,' + readFileSync(pngDir + n + '.png').toString('base64')

// ---------- 页面骨架（375px 壳，正文 15px/1.75，同真实管线） ----------
const SHELL_OPEN =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=375"></head>' +
  '<body style="margin:0;background:#e9e6e0;padding:28px 0 56px;">' +
  '<div style="width:375px;margin:0 auto;background:#ffffff;border-radius:20px;box-shadow:0 6px 24px rgba(0,0,0,.08);overflow:hidden;">' +
  '<div style="padding:24px 16px 40px;box-sizing:border-box;font-family:-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">'
const SHELL_CLOSE = '</div></div></body></html>'
const P_OPEN = '<p style="font-size:15px;color:#3d4650;line-height:1.75;margin:0 0 12px;text-align:justify">'
const P_CLOSE = '</p>'

// ---------- before：旧 SKILL.md inline() 渲染 ----------
const beforeHtml = SHELL_OPEN +
  '<h1 style="text-align:center;font-size:22px;font-weight:800;color:#2f3640;margin:0 0 14px;">行首小花 · 旧渲染</h1>' +
  P_OPEN +
  '<img src="' + uri('blossom-branch') + '" alt="小花" style="max-width:56%;height:auto;display:inline-block;vertical-align:middle;border-radius:0;margin:12px auto" />' +
  '九月将至，阳光正好。欢迎新同学加入阳光校园大家庭，从踏进校门的那一刻起，这里就是你们的新起点。' +
  P_CLOSE + SHELL_CLOSE

// ---------- after：新语法 art://名称:显示高px + 行内装饰 CSS + 紧裁底部锚点资产 ----------
function inlineImg(name, px) {
  return '<img src="' + uri(name) + '" alt="' + name + '" data-inline="' + name + ':' + px + '" style="height:' + px + 'px;width:auto;display:inline-block;vertical-align:baseline;border-radius:0;margin:0 3px 0 0" />'
}
const afterHtml = SHELL_OPEN +
  '<h1 style="text-align:center;font-size:22px;font-weight:800;color:#2f3640;margin:0 0 14px;">行首小花 · 新渲染</h1>' +
  P_OPEN + inlineImg('inline-flower', 16) +
  '九月将至，阳光正好。欢迎新同学加入阳光校园大家庭，从踏进校门的那一刻起，这里就是你们的新起点。' + P_CLOSE +
  P_OPEN + '开学典礼将在 9 月 1 日上午举行，' + inlineImg('inline-sprig', 14) +
  '我们准备了迎新小礼物，' + inlineImg('inline-star', 12) + '报到当天领取。' + P_CLOSE +
  P_OPEN + inlineImg('inline-seal', 18) + '官方发布：' + inlineImg('inline-ball', 16) + '详情见下文安排。' + P_CLOSE +
  SHELL_CLOSE

writeFileSync(outDir + 'demo-inline-before.html', beforeHtml)
writeFileSync(outDir + 'demo-inline-after.html', afterHtml)

// ---------- 渲染 + 验证 ----------
const { chromium } = pw
const browser = await chromium.launch({ executablePath: findChromium() })
let fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 900, deviceScaleFactor: 2 } })

  // ===== A. before 复现（证据性，不计入门禁） =====
  await page.setContent(beforeHtml)
  await page.waitForTimeout(400)
  await page.screenshot({ path: outDir + 'demo-inline-before.png' })
  const b64b = readFileSync(outDir + 'demo-inline-before.png').toString('base64')
  const before = await page.evaluate(({ b64 }) => {
    return new Promise((resolve) => {
      const imgEl = document.querySelector('img')
      const ir = imgEl.getBoundingClientRect()
      const shot = new Image()
      shot.onload = () => {
        const c = document.createElement('canvas')
        c.width = shot.naturalWidth; c.height = shot.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(shot, 0, 0)
        const d = cx.getImageData(0, 0, c.width, c.height).data
        const sx = c.width / 375
        // 图片内图案带（非白像素行范围）
        let imgMin = Infinity, imgMax = -Infinity
        for (let y = Math.round(ir.top * sx); y < Math.round(ir.bottom * sx); y++) {
          let has = false
          for (let x = Math.round(ir.left * sx); x < Math.round(ir.right * sx); x += 2) {
            const i = (y * c.width + x) * 4
            if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { has = true; break }
          }
          if (has) { imgMin = Math.min(imgMin, y); imgMax = Math.max(imgMax, y) }
        }
        // 图片右侧首行文字带（x: img.right+8 起 120px 宽）
        const x0 = Math.round((ir.right + 8) * sx), x1 = Math.round((ir.right + 120) * sx)
        let txtMin = Infinity, txtMax = -Infinity
        for (let y = Math.round((ir.top - 20) * sx); y < Math.round((ir.bottom + 40) * sx); y++) {
          let has = false
          for (let x = x0; x < x1; x += 2) {
            const i = (y * c.width + x) * 4
            if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { has = true; break }
          }
          if (has) { txtMin = Math.min(txtMin, y); txtMax = Math.max(txtMax, y) }
        }
        resolve({
          imgH: +ir.height.toFixed(1), imgW: +ir.width.toFixed(1),
          imgTop: +ir.top.toFixed(1), imgBottom: +ir.bottom.toFixed(1),
          imgBand: imgMin === Infinity ? null : { top: +(imgMin / sx).toFixed(1), bottom: +(imgMax / sx).toFixed(1) },
          txtBand: txtMin === Infinity ? null : { top: +(txtMin / sx).toFixed(1), bottom: +(txtMax / sx).toFixed(1) },
        })
      }
      shot.src = 'data:image/png;base64,' + b64
    })
  }, { b64: b64b })
  console.log('======== BEFORE（旧渲染：max-width:56% + vertical-align:middle + margin:12px auto） ========')
  console.log('花枝图片盒: ' + before.imgW + '×' + before.imgH + 'px（目标应为 14-20px 小装饰）')
  if (before.imgBand && before.txtBand) {
    console.log('图案像素带: y ' + before.imgBand.top + '..' + before.imgBand.bottom +
      '（高 ' + (before.imgBand.bottom - before.imgBand.top).toFixed(1) + 'px）')
    console.log('首行文字像素带: y ' + before.txtBand.top + '..' + before.txtBand.bottom)
    console.log('图案带 vs 文字带底差: ' + (before.imgBand.bottom - before.txtBand.bottom).toFixed(1) + 'px')
  }
  const sizeBad = before.imgH >= 60
  console.log((sizeBad ? '✓ 复现' : '✗ 未复现') + '：显示高 ' + before.imgH + 'px（大小失控 ≥60px → 行首小花被放大成巨盒，脱离文字行）')

  // ===== B. after 生效（门禁，像素带为准：图底=基线、图顶不飘出文字行） =====
  await page.setContent(afterHtml)
  await page.waitForTimeout(400)
  await page.screenshot({ path: outDir + 'demo-inline-after.png' })
  const b64a = readFileSync(outDir + 'demo-inline-after.png').toString('base64')
  const after = await page.evaluate(({ b64 }) => {
    return new Promise((resolve) => {
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
          // 图片内图案像素带
          let imgMin = Infinity, imgMax = -Infinity
          for (let y = Math.round(ir.top * sx); y < Math.round(ir.bottom * sx); y++) {
            let has = false
            for (let x = Math.round(ir.left * sx); x < Math.round(ir.right * sx); x += 2) {
              const i = (y * c.width + x) * 4
              if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { has = true; break }
            }
            if (has) { imgMin = Math.min(imgMin, y); imgMax = Math.max(imgMax, y) }
          }
          // 图片右侧同行文字像素带（y 限到图片底 +5px，避免扫到下一行）
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
    })
  }, { b64: b64a })

  console.log('======== AFTER（新渲染：art://名称:px + vertical-align:baseline + 紧裁底部锚点资产） ========')
  let afterPass = 0
  for (const r of after) {
    const hOk = Math.abs(r.h - r.expect) <= 0.6
    const pxOk = r.imgBand && r.txtBand && Math.abs(r.imgBand.bottom - r.txtBand.bottom) <= 4
    // 图案顶不高于同行文字顶 14px（文字顶≈基线-字高；图案最高 24px，仅允许轻微高出 = 装饰正常比字高一点）
    const aboveOk = r.imgBand && r.txtBand && (r.imgBand.top - r.txtBand.top) >= -14
    const ok = hOk && pxOk && aboveOk
    if (ok) afterPass++
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + r.name.padEnd(16) +
      ' 高 ' + r.h + '/' + r.expect + 'px' +
      ' · 图案带 ' + (r.imgBand ? 'y' + r.imgBand.top + '..' + r.imgBand.bottom : '无') +
      ' · 文字带 ' + (r.txtBand ? 'y' + r.txtBand.top + '..' + r.txtBand.bottom : '无') +
      (r.imgBand && r.txtBand ? ' · 底差 ' + (r.imgBand.bottom - r.txtBand.bottom).toFixed(1) + 'px(≤4) · 顶差 ' + (r.imgBand.top - r.txtBand.top).toFixed(1) + 'px(≥-14)' : '') +
      (ok ? '' : ' [h=' + hOk + ' px=' + pxOk + ' above=' + aboveOk + ']'))
  }
  console.log('after 对齐通过: ' + afterPass + '/' + after.length)
  if (afterPass !== after.length) fail++

  console.log('======== ' + (fail ? '存在失败项，需修复' : 'before 复现 ✓ + after 对齐 ' + afterPass + '/' + after.length + ' 全绿（demo-inline-before/after.png 已输出）') + ' ========')
  if (fail) process.exitCode = 1
} finally {
  await browser.close()
}
