// test/assets/render-bubble-test.mjs
// 重点气泡（module-bubble）资产 第一批 10 个：渲染 4x PNG + probe 像素验证 + 分组预览页
// 分组按"组合方式 × 风格"模型：同骨架多风格（①×3 风格 / ②×2 风格）突出类型×风格
// 输出：test/assets/png-bubble/<name>.png + test/assets/preview-bubble.html/.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bubbleArts, validateBubbleArts } from './ARTS-bubble.mjs'

const pwCandidates = [
  'D:/deepseek-harness/deepseek-harness/node_modules/.pnpm',
  'C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/.pnpm',
]
import { readdirSync, existsSync } from 'node:fs'
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

// 结构校验先行
const v = validateBubbleArts()
console.log('validate: ' + v.count + ' 资产, dupName=' + v.dupName.length + ', bad=' + v.bad.length + (v.bad.length ? ' → ' + v.bad.map((b) => b.name).join(',') : ''))
if (!v.ok) process.exit(1)

const SCALE = 0.46 // 375px 手机壳显示缩放比
const GROUPS = [
  ['① 左竖条浅底式（同骨架 × 3 风格）', ['bubble-bar-note', 'bubble-campus-ball', 'bubble-guochao-seal']],
  ['② 整块实色式（同骨架 × 2 风格）', ['bubble-solid-tip', 'bubble-tech-diamond']],
  ['③ 细边角标式', ['bubble-corner-new']],
  ['④ 警示边框式', ['bubble-warn-frame']],
  ['⑤ 双层深浅式', ['bubble-key-deep']],
  ['⑥ 品牌单色五档式', ['bubble-brand-blue']],
  ['⑦ 对照双泡式', ['bubble-compare']],
]

const outDir = fileURLToPath(new URL('./png-bubble/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
const results = []
const b64map = {}
let pass = 0, fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  for (const a of bubbleArts) {
    const svgB64 = Buffer.from(a.svg, 'utf8').toString('base64')
    await page.setContent('<img id="i" src="data:image/svg+xml;base64,' + svgB64 + '" />')
    const r = await page.evaluate(async (art) => {
      const img = document.getElementById('i')
      await new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res } })
      const S = 4 // 渲染 4x
      const c = document.createElement('canvas')
      c.width = art.w * S; c.height = art.h * S
      const cx = c.getContext('2d')
      cx.scale(S, S)
      cx.drawImage(img, 0, 0, art.w, art.h)
      const d = cx.getImageData(0, 0, c.width, c.height).data
      let alpha = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) alpha++
      const p = art.probe
      const pi = ((p[1] * S) * c.width + p[0] * S) * 4
      const px = [d[pi], d[pi + 1], d[pi + 2]]
      const exp = p[2]
      const ok = Math.abs(px[0] - exp[0]) <= 12 && Math.abs(px[1] - exp[1]) <= 12 && Math.abs(px[2] - exp[2]) <= 12
      return { alphaPct: alpha / (c.width * c.height) * 100, dataUrl: c.toDataURL('image/png'), px, ok }
    }, a)
    const png = Buffer.from(r.dataUrl.split(',')[1], 'base64')
    writeFileSync(outDir + a.name + '.png', png)
    b64map[a.name] = r.dataUrl.split(',')[1]
    const okRender = r.alphaPct > 0.5
    const okProbe = r.ok
    const okSize = png.length < 1024 * 1024
    if (okRender && okProbe && okSize) pass++; else fail++
    results.push({ ...a, alphaPct: +r.alphaPct.toFixed(2), px: r.px, okRender, okProbe, sizeKB: +(png.length / 1024).toFixed(1) })
    console.log((okRender && okProbe && okSize ? 'OK  ' : 'FAIL') + ' ' + a.name.padEnd(26) + ' 不透明' + r.alphaPct.toFixed(2).padStart(6) + '%  probe(' + r.px.join(',') + ')' + (r.ok ? '' : ' 期望(' + a.probe[2].join(',') + ')') + '  ' + (png.length / 1024).toFixed(0) + 'KB')
  }
  await page.close()

  // 分组预览页（卡片 320px 展示宽，标注 资产名/组合方式/风格/显示尺寸）
  const card = (img64, a) =>
    '<div style="display:inline-block;width:340px;margin:8px;vertical-align:top;text-align:center">' +
    '<div style="border:1px solid #eee;border-radius:8px;padding:8px;background:#fff">' +
    '<img src="data:image/png;base64,' + img64 + '" style="width:100%;height:auto;display:block"/></div>' +
    '<div style="font-size:12px;color:#2f3640;margin-top:4px;font-weight:700">' + a.label + '</div>' +
    '<div style="font-size:11px;color:#666;margin-top:2px">组合方式 ' + a.type + ' · 风格 ' + a.style + '</div>' +
    '<div style="font-size:10px;color:#aaa">' + a.name + ' · 设计 ' + a.w + '×' + a.h + ' · 显示 ≈' + Math.round(a.w * SCALE) + '×' + Math.round(a.h * SCALE) + '（缩放 ' + SCALE + '）</div></div>'
  const group = (title, names) => '<div style="margin:0 0 24px"><h3 style="font-size:15px;color:#2f3640;margin:8px 12px">' + title + '</h3>' +
    names.map((n) => { const a = bubbleArts.find((x) => x.name === n); return card(b64map[a.name], a) }).join('') + '</div>'

  const preview = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f7f7f5;padding:16px;font-family:sans-serif}h2{font-size:18px;color:#2f3640;margin:8px 12px}p.note{font-size:12px;color:#888;margin:4px 12px 16px}</style></head><body>' +
    '<h2>重点气泡美术资产（10 个 · 类型 × 风格 · 整图资产 + 中央嵌字）</h2>' +
    '<p class="note">类型 = 7 种组合方式骨架；风格 = 图案词汇表（花草/球类/印章/几何）。画布 750×215（显示 ≈345×99），中央留空 ≥240px 宽 × ≥120px 高（标题 15px + 内容 14px 两行）供文字叠放。</p>' +
    GROUPS.map(([t, ns]) => group(t, ns)).join('') +
    '</body></html>'
  const previewPath = fileURLToPath(new URL('./preview-bubble.html', import.meta.url))
  writeFileSync(previewPath, preview)

  const pv = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(500)
  await pv.screenshot({ path: fileURLToPath(new URL('./preview-bubble.png', import.meta.url)), fullPage: true })
  await pv.close()

  console.log('======== 汇总 ========')
  const fails = results.filter((r) => !r.okRender || !r.okProbe || r.sizeKB > 1024)
  console.log('渲染+probe+体积 通过 ' + pass + '/' + (pass + fail) + '；失败: ' + (fails.length ? fails.map((f) => f.name + '(' + f.sizeKB + 'KB)').join(', ') : '无'))
  console.log('PNG 输出: test/assets/png-bubble/（' + results.length + ' 张，4x）+ preview-bubble.html/.png')
} finally {
  await browser.close()
}
