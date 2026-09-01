// test/assets/render-subheading-test.mjs
// 模拟 v3（大量扩充）：把 ARTS-subheading-add.mjs 的 38 个标题装饰资产真实渲染为 PNG（2x）
// 输出：test/assets/png/<name>.png + test/assets/preview-subheading.html/.png（分组预览 + 全页截图）
// 自动验证：每资产 probe 像素点（设计坐标×2，容差 ±12）→ PASS/FAIL
// 管线与 SKILL.md 客户端 svgToPng 一致：data:image/svg+xml;base64 → img → canvas 2x → PNG
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { subheadingArts } from './ARTS-subheading-add.mjs'

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

// 8 个分组（预览页顺序）
const GROUPS = [
  ['序号徽章', ['badge-num-circle', 'badge-num-square', 'badge-num-hexagon', 'badge-num-diamond', 'badge-num-flower', 'badge-num-ring', 'badge-num-banner']],
  ['左右夹线', ['clamp-line', 'clamp-line-flower', 'clamp-line-double', 'clamp-vine', 'clamp-dash', 'clamp-arrow']],
  ['分隔线', ['divider-ornate-single', 'divider-ornate-double', 'divider-wave', 'divider-vine', 'divider-dash', 'divider-cloud', 'divider-star']],
  ['几何点缀', ['accent-sparkle', 'accent-leaf', 'accent-diamond-chain', 'accent-dots', 'accent-triangle']],
  ['卷曲与角饰', ['flourish-double', 'flourish-single', 'corner-vine', 'corner-flower']],
  ['缎带横幅', ['banner-mini', 'banner-flag', 'banner-scroll']],
  ['下划线', ['underline-wave', 'underline-double', 'underline-scribble']],
  ['标题框', ['frame-title-round', 'frame-title-double', 'frame-title-corner']],
]

const outDir = fileURLToPath(new URL('./png/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
const results = []
const b64map = {}
let pass = 0, fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  for (const a of subheadingArts) {
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
      // probe：设计坐标 ×S
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
    const okRender = r.alphaPct > 1
    const okProbe = r.ok
    const okSize = png.length < 1024 * 1024
    if (okRender && okProbe && okSize) pass++; else fail++
    results.push({ ...a, alphaPct: +r.alphaPct.toFixed(2), px: r.px, okRender, okProbe, sizeKB: +(png.length / 1024).toFixed(1) })
    console.log((okRender && okProbe && okSize ? 'OK  ' : 'FAIL') + ' ' + a.name.padEnd(22) + ' 不透明' + r.alphaPct.toFixed(2).padStart(6) + '%  probe(' + r.px.join(',') + ')' + (r.ok ? '' : ' 期望(' + a.probe[2].join(',') + ')') + '  ' + (png.length / 1024).toFixed(0) + 'KB')
  }
  await page.close()

  // 预览页：8 组资产（179px 展示宽）+ 真实应用场景（375px 手机壳）
  const card = (img64, label, name, w, h) =>
    '<div style="display:inline-block;width:179px;margin:8px;vertical-align:top;text-align:center">' +
    '<div style="border:1px solid #eee;border-radius:8px;padding:8px;background:#fff">' +
    '<img src="data:image/png;base64,' + img64 + '" style="width:100%;height:auto;display:block"/></div>' +
    '<div style="font-size:12px;color:#666;margin-top:4px">' + label + '<br/><span style="color:#aaa">' + name + ' · ' + w + '×' + h + '</span></div></div>'
  const group = (title, names) => '<div style="margin:0 0 24px"><h3 style="font-size:15px;color:#2f3640;margin:8px 12px">' + title + '</h3>' +
    names.map((n) => { const a = subheadingArts.find((x) => x.name === n); return card(b64map[a.name], a.label, a.name, a.w, a.h) }).join('') + '</div>'

  const demo = (title, inner) =>
    '<div style="width:375px;margin:12px;background:#fff;border:1px solid #eee;border-radius:12px;display:inline-block;vertical-align:top;overflow:hidden">' +
    '<div style="padding:0 16px;font-family:sans-serif">' + inner + '</div></div>'
  const scene1 = demo('夹线标题（嵌字）', '<div style="position:relative;padding-top:16px;height:32px"><img src="data:image/png;base64,' + b64map['clamp-line'] + '" style="width:100%;display:block;position:absolute;top:50%;transform:translateY(-50%)"/><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:16px;font-weight:700;color:#2f3640;letter-spacing:1px;background:#fff;padding:0 10px;white-space:nowrap">三遍阅读法</span></div><p style="font-size:15px;color:#555;line-height:1.75;margin:12px 0 16px">正文示例：把书读三遍，每一遍都有不同的任务与收获……</p>')
  const scene2 = demo('徽章标题', '<p style="display:flex;align-items:center;margin:16px 0 12px"><img src="data:image/png;base64,' + b64map['badge-num-circle'] + '" style="width:32px;height:32px;margin-right:10px"/><span style="font-size:17px;font-weight:700;color:#2f3640">先做这 1 件事</span></p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">第一步的动作越小越好，小到不需要意志力就能开始……</p>')
  const scene3 = demo('分隔线标题（线下置）', '<p style="text-align:center;font-size:19px;font-weight:700;color:#2f3640;margin:16px 0 6px;letter-spacing:2px">02 · 如何做整理</p><div style="text-align:center"><img src="data:image/png;base64,' + b64map['divider-ornate-single'] + '" style="width:55%;display:inline-block"/></div><p style="font-size:15px;color:#555;line-height:1.75;margin:12px 0 16px">整理不是扔东西，而是给每件物品找到它的位置……</p>')
  const scene4 = demo('标题框', '<p style="margin:16px 0 12px"><img src="data:image/png;base64,' + b64map['frame-title-round'] + '" style="width:100%;display:inline-block"/></p><p style="text-align:center;font-size:19px;font-weight:700;color:#2f3640;margin:-70px 0 56px;letter-spacing:2px;position:relative">把日子过成手账</p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">标题文字叠加在框内，用负 margin 压入……</p>')
  const scene5 = demo('下划线标题', '<p style="text-align:center;font-size:19px;font-weight:700;color:#2f3640;margin:16px 0 2px;letter-spacing:2px">清单化是整理的第一步</p><div style="text-align:center;margin:0 0 16px"><img src="data:image/png;base64,' + b64map['underline-wave'] + '" style="width:45%;display:inline-block"/></div><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">先列清单再动手，脑子就不会乱……</p>')

  const preview = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f7f7f5;padding:16px;font-family:sans-serif}h2{font-size:18px;color:#2f3640;margin:8px 12px}</style></head><body>' +
    '<h2>v11 标题装饰资产大全（38 个 · 8 大类，179px 展示宽 = 正文装饰图实际尺寸）</h2>' +
    GROUPS.map(([t, ns]) => group(t, ns)).join('') +
    '<h2>真实应用场景（375px 手机壳）</h2>' +
    '<div style="margin:0 12px 24px;white-space:nowrap;overflow-x:auto">' + scene1 + scene2 + scene3 + scene4 + scene5 + '</div>' +
    '</body></html>'
  const previewPath = fileURLToPath(new URL('./preview-subheading.html', import.meta.url))
  writeFileSync(previewPath, preview)

  const pv = await browser.newPage({ viewport: { width: 900, height: 800 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(500)
  await pv.screenshot({ path: fileURLToPath(new URL('./preview-subheading.png', import.meta.url)), fullPage: true })
  await pv.close()

  console.log('======== 汇总 ========')
  const fails = results.filter((r) => !r.okRender || !r.okProbe)
  console.log('渲染+probe 通过 ' + pass + '/' + (pass + fail) + '；失败: ' + (fails.length ? fails.map((f) => f.name).join(', ') : '无'))
  console.log('PNG 输出: test/assets/png/（' + results.length + ' 张）+ preview-subheading.html/.png')
} finally {
  await browser.close()
}
