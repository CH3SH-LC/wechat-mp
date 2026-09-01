// test/assets/render-combo2-test.mjs
// 模拟 v11·第二批 combo 资产（21 个）：渲染 4x PNG + probe 像素验证 + 分组预览页
// v5 精细度：渲染分辨率 2x → 4x（画布与 probe 同步 ×4）+ PNG 体积 ≤1MB 检查
// 输出：test/assets/png-combo2/<name>.png + test/assets/preview-combo2.html/.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { comboArts2, validateComboArts2 } from './ARTS-subheading-combo2.mjs'

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
const v = validateComboArts2()
console.log('validate: ' + v.count + ' 资产, dupName=' + v.dupName.length + ', dupLabel=' + v.dupLabel.length + ', bad=' + v.bad.length + (v.bad.length ? ' → ' + v.bad.map((b) => b.name).join(',') : ''))
if (!v.ok) process.exit(1)

const GROUPS = [
  ['A 边框系列', ['combo-frame-vine-rose', 'combo-frame-quad-flower', 'combo-frame-gold-band', 'combo-frame-corner-branch']],
  ['B 上下分割线系列', ['combo-lines-rose', 'combo-lines-double-vine', 'combo-lines-wave']],
  ['C 下划线系列', ['combo-underline-vine', 'combo-underline-double-flower', 'combo-underline-branch']],
  ['D 夹线嵌字系列', ['combo-clamp-vine-flower', 'combo-clamp-pearl', 'combo-clamp-diamond-flower']],
  ['E 徽章系列', ['combo-badge-laurel', 'combo-badge-wreath', 'combo-badge-ribbon']],
  ['F 缎带/分隔/点缀', ['combo-banner-scroll-vine', 'combo-banner-twin-flower', 'combo-banner-flag-crown', 'combo-accent-branch', 'combo-divider-ribbon']],
]

const outDir = fileURLToPath(new URL('./png-combo2/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
const results = []
const b64map = {}
let pass = 0, fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  for (const a of comboArts2) {
    const svgB64 = Buffer.from(a.svg, 'utf8').toString('base64')
    await page.setContent('<img id="i" src="data:image/svg+xml;base64,' + svgB64 + '" />')
    const r = await page.evaluate(async (art) => {
      const img = document.getElementById('i')
      await new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res } })
      const S = 4 // v5：渲染分辨率 2x → 4x
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
    console.log((okRender && okProbe && okSize ? 'OK  ' : 'FAIL') + ' ' + a.name.padEnd(28) + ' 不透明' + r.alphaPct.toFixed(2).padStart(6) + '%  probe(' + r.px.join(',') + ')' + (r.ok ? '' : ' 期望(' + a.probe[2].join(',') + ')') + '  ' + (png.length / 1024).toFixed(0) + 'KB')
  }
  await page.close()

  // 分组预览页（卡片 240px 展示宽）
  const card = (img64, label, name, w, h) =>
    '<div style="display:inline-block;width:240px;margin:8px;vertical-align:top;text-align:center">' +
    '<div style="border:1px solid #eee;border-radius:8px;padding:8px;background:#fff">' +
    '<img src="data:image/png;base64,' + img64 + '" style="width:100%;height:auto;display:block"/></div>' +
    '<div style="font-size:12px;color:#666;margin-top:4px">' + label + '<br/><span style="color:#aaa">' + name + ' · ' + w + '×' + h + '</span></div></div>'
  const group = (title, names) => '<div style="margin:0 0 24px"><h3 style="font-size:15px;color:#2f3640;margin:8px 12px">' + title + '</h3>' +
    names.map((n) => { const a = comboArts2.find((x) => x.name === n); return card(b64map[a.name], a.label, a.name, a.w, a.h) }).join('') + '</div>'

  const preview = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f7f7f5;padding:16px;font-family:sans-serif}h2{font-size:18px;color:#2f3640;margin:8px 12px}</style></head><body>' +
    '<h2>v11 第二批 combo 复合资产（20 个 · 6 组，复杂度铁律基准：渐变≥2段/装饰≥2处/珍珠叶脉细节）</h2>' +
    GROUPS.map(([t, ns]) => group(t, ns)).join('') +
    '</body></html>'
  const previewPath = fileURLToPath(new URL('./preview-combo2.html', import.meta.url))
  writeFileSync(previewPath, preview)

  const pv = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(500)
  await pv.screenshot({ path: fileURLToPath(new URL('./preview-combo2.png', import.meta.url)), fullPage: true })
  await pv.close()

  console.log('======== 汇总 ========')
  const fails = results.filter((r) => !r.okRender || !r.okProbe || r.sizeKB > 1024)
  console.log('渲染+probe+体积 通过 ' + pass + '/' + (pass + fail) + '；失败: ' + (fails.length ? fails.map((f) => f.name + '(' + f.sizeKB + 'KB)').join(', ') : '无'))
  console.log('PNG 输出: test/assets/png-combo2/（' + results.length + ' 张，4x）+ preview-combo2.html/.png')
} finally {
  await browser.close()
}
