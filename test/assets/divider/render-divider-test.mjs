// test/assets/divider/render-divider-test.mjs
// 分割线（module-divider）资产 10 个：
//   4x 渲染 PNG + probe 像素验证（落纯色部件 ±12）+ 体积 ≤1MB +
//   装饰洁净带扫描（严格版 divider-scan.mjs：y10..80 部件数/线体连贯/主行 run 数精确/
//   行碎片上限/无杂点/带内带外约束）+ 线体显示厚度 ≥2.5px + 装饰显示 ≥16px + 分组预览页
// 守卫：EXPECT 硬编码各资产 band/lineCheck 声明值，与导入资产不符立即中止
// （防止声明值被外部放宽导致"假通过"——铁律：校准坐标不放宽容差）。
// 输出：test/assets/divider/png-divider/<name>.png + preview-divider.html/.png
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dividerArts, validateDividerArts, DIVIDER_SCALE } from './ARTS-divider.mjs'
import { scanCleanBandSrc } from './divider-scan.mjs'

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
const v = validateDividerArts()
console.log('validate: ' + v.count + ' 资产, dupName=' + v.dupName.length + ', bad=' + v.bad.length + (v.bad.length ? ' → ' + v.bad.map((b) => b.name).join(',') : ''))
if (!v.ok) process.exit(1)

// —— EXPECT 守卫：硬编码各资产 band/lineCheck 声明值（防外部放宽声明导致假通过）——
const EXPECT = {
  'divider-line':    { parts: 1, mainRuns: 1, maxRuns: 2,  axisY: 45, span: [[0, 750]] },
  'divider-dots':    { parts: 3, mainRuns: 3, maxRuns: 6,  axisY: 45, span: [[347, 359], [369, 381], [391, 403]] },
  'divider-bar':     { parts: 1, mainRuns: 1, maxRuns: 2,  axisY: 45, span: [[288.5, 461.5]] },
  'divider-vine':    { parts: 1, mainRuns: 1, maxRuns: 16, axisY: 45, span: [[102, 648]] },
  'divider-ribbon':  { parts: 1, mainRuns: 1, maxRuns: 3,  axisY: 45, span: [[0, 750]] },
  'divider-dual':    { parts: 2, mainRuns: 2, maxRuns: 4,  axisY: 45, span: [[262, 366], [384, 487]] },
  'divider-section': { parts: 1, mainRuns: 1, maxRuns: 12, axisY: 104, span: [[311, 439]] },
  'divider-guochao': { parts: 3, mainRuns: 3, maxRuns: 3,  axisY: 45, span: [[233, 337], [413, 517]] },
  'divider-campus':  { parts: 3, mainRuns: 3, maxRuns: 5,  axisY: 45, span: [[347, 359], [369, 381], [391, 403]] },
  'divider-tech':    { parts: 1, mainRuns: 1, maxRuns: 3,  axisY: 45, span: [[288.5, 461.5]] },
}
const expectGuard = []
for (const a of dividerArts) {
  const e = EXPECT[a.name]
  const b = a.band, lc = a.lineCheck
  const sp = JSON.stringify(lc.span)
  if (!e || b.parts !== e.parts || b.mainRuns !== e.mainRuns || b.maxRuns !== e.maxRuns ||
    lc.axisY !== e.axisY || sp !== JSON.stringify(e.span)) {
    expectGuard.push(a.name + '(parts=' + b.parts + '/' + b.mainRuns + '/' + b.maxRuns + ' axis=' + lc.axisY + ' span=' + sp + ')')
  }
}
if (expectGuard.length) {
  console.log('EXPECT 守卫失败（声明值被改动/与规范不符）: ' + expectGuard.join(', '))
  process.exit(1)
}
console.log('EXPECT 守卫：10 资产 band/lineCheck 声明全部符合规范')

const outDir = fileURLToPath(new URL('./png-divider/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
const results = []
const b64map = {}
let pass = 0, fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  for (const a of dividerArts) {
    const svgB64 = Buffer.from(a.svg, 'utf8').toString('base64')
    await page.setContent('<img id="i" src="data:image/svg+xml;base64,' + svgB64 + '" />')
    const r = await page.evaluate(async ({ art, scanSrc }) => {
      const scan = eval('(' + scanSrc + ')') // divider-scan.mjs 严格版源码还原
      const img = document.getElementById('i')
      await new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res } })
      const S = 4
      const c = document.createElement('canvas')
      c.width = art.w * S; c.height = art.h * S
      const cx = c.getContext('2d')
      cx.scale(S, S)
      cx.drawImage(img, 0, 0, art.w, art.h)
      const d = cx.getImageData(0, 0, c.width, c.height).data
      let alpha = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) alpha++
      // probe 像素验证（落纯色部件）
      const p = art.probe
      const pi = ((p[1] * S) * c.width + p[0] * S) * 4
      const px = [d[pi], d[pi + 1], d[pi + 2]]
      const exp = p[2]
      const okProbe = Math.abs(px[0] - exp[0]) <= 12 && Math.abs(px[1] - exp[1]) <= 12 && Math.abs(px[2] - exp[2]) <= 12
      // 装饰洁净带扫描（严格版，浏览器内执行）
      const scanRes = scan(art, d, c.width, c.height, S, 25)
      // 装饰渲染真实性（4x bbox 前景覆盖率 ≥ 5%）
      let decorOk = true
      for (const dc of art.decorChecks) {
        const xa = Math.round((dc.cx - dc.he) * S), xb = Math.round((dc.cx + dc.he) * S)
        const ya = Math.round((dc.cy - dc.he) * S), yb = Math.round((dc.cy + dc.he) * S)
        let fgN = 0, tot = 0
        for (let y = Math.max(0, ya); y <= Math.min(c.height - 1, yb); y++) {
          for (let x = Math.max(0, xa); x <= Math.min(c.width - 1, xb); x++) {
            tot++
            if (d[(y * c.width + x) * 4 + 3] >= 60) fgN++
          }
        }
        if (tot > 0 && fgN / tot < 0.05) decorOk = false
      }
      return {
        alphaPct: alpha / (c.width * c.height) * 100,
        dataUrl: c.toDataURL('image/png'),
        px, okProbe,
        ncomp: scanRes.ncomp, maxR: scanRes.maxR, thick: scanRes.thick,
        runsRowAxis: scanRes.runsRowAxis, bandV: scanRes.violations, decorOk,
      }
    }, { art: a, scanSrc: scanCleanBandSrc })
    const png = Buffer.from(r.dataUrl.split(',')[1], 'base64')
    writeFileSync(outDir + a.name + '.png', png)
    b64map[a.name] = r.dataUrl.split(',')[1]
    const okRender = r.alphaPct > 0.5
    const okSize = png.length < 1024 * 1024
    const okBand = r.bandV.length === 0
    const okThick = r.thick * DIVIDER_SCALE >= 2.5
    const okAll = okRender && r.okProbe && okSize && okBand && okThick && r.decorOk
    if (okAll) pass++; else fail++
    results.push({
      ...a, alphaPct: +r.alphaPct.toFixed(2), px: r.px, okRender, okProbe: r.okProbe, okSize, okBand,
      bandV: r.bandV, ncomp: r.ncomp, maxR: r.maxR, okThick,
      thickDisplay: +(r.thick * DIVIDER_SCALE).toFixed(2), decorOk: r.decorOk,
      sizeKB: +(png.length / 1024).toFixed(1),
    })
    console.log((okAll ? 'OK  ' : 'FAIL') + ' ' + a.name.padEnd(20) +
      ' 声明[' + a.band.parts + '/' + a.band.mainRuns + '/' + a.band.maxRuns + ']' +
      ' 实测(部件' + r.ncomp + '/run' + r.runsRowAxis + '/maxR' + r.maxR + ')' +
      ' 不透明' + r.alphaPct.toFixed(2).padStart(5) + '%  probe(' + r.px.join(',') + ')' + (r.okProbe ? '' : ' 期望(' + a.probe[2].join(',') + ')') +
      '  线厚' + (r.thick * DIVIDER_SCALE).toFixed(2) + 'px' +
      (r.bandV.length ? '  洁净带✗[' + r.bandV.join(';') + ']' : '  洁净带✓') +
      (r.decorOk ? '' : '  decor✗') + '  ' + (png.length / 1024).toFixed(0) + 'KB')
  }
  await page.close()

  // 分组预览页（卡片 320px 展示宽，标注 资产名/组合方式/风格/显示尺寸）
  const card = (img64, a) =>
    '<div style="display:inline-block;width:340px;margin:8px;vertical-align:top;text-align:center">' +
    '<div style="border:1px solid #eee;border-radius:8px;padding:8px;background:#fff">' +
    '<img src="data:image/png;base64,' + img64 + '" style="width:100%;height:auto;display:block"/></div>' +
    '<div style="font-size:12px;color:#2f3640;margin-top:4px;font-weight:700">' + a.label + '</div>' +
    '<div style="font-size:11px;color:#666;margin-top:2px">组合方式 ' + a.type + ' · 风格 ' + a.style + '</div>' +
    '<div style="font-size:10px;color:#aaa">' + a.name + ' · 设计 ' + a.w + '×' + a.h + ' · 显示 ≈' + Math.round(a.w * DIVIDER_SCALE) + '×' + Math.round(a.h * DIVIDER_SCALE) + '（缩放 ' + DIVIDER_SCALE.toFixed(3) + '）</div></div>'
  const group = (title, names) => '<div style="margin:0 0 24px"><h3 style="font-size:15px;color:#2f3640;margin:8px 12px">' + title + '</h3>' +
    names.map((n) => { const a = dividerArts.find((x) => x.name === n); return card(b64map[a.name], a) }).join('') + '</div>'

  const preview = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f7f7f5;padding:16px;font-family:sans-serif}h2{font-size:18px;color:#2f3640;margin:8px 12px}p.note{font-size:12px;color:#888;margin:4px 12px 16px}</style></head><body>' +
    '<h2>分割线美术资产 · divider（10 个 · 类型 × 风格 · 整图资产）</h2>' +
    '<p class="note">类型 = 7 种组合方式骨架（①细线/②圆点/③短横条/④art花边/⑤色带/⑥双条/⑦章节组合）；风格 = 图案词汇表（花草/印章回纹/球类星星/几何端点/珍珠）。无文字型画布 750×90（显示 ≈343×41，缩放 0.457）、zone:null + 装饰洁净带 y10..80；章节组合式画布 750×150 + zone x50..700 y20..130（标题 ≤10 字）。三层验证：probe 像素 + 洁净带扫描 + 375px 壳实测。</p>' +
    group('① 细线式', ['divider-line']) +
    group('② 圆点分隔式', ['divider-dots', 'divider-campus']) +
    group('③ 短横条式', ['divider-bar', 'divider-tech']) +
    group('④ art花边式', ['divider-vine', 'divider-guochao']) +
    group('⑤ 横条色带式', ['divider-ribbon']) +
    group('⑥ 双条拼色式', ['divider-dual']) +
    group('⑦ 章节组合式', ['divider-section']) +
    '</body></html>'
  const previewPath = fileURLToPath(new URL('./preview-divider.html', import.meta.url))
  writeFileSync(previewPath, preview)

  const pv = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(500)
  await pv.screenshot({ path: fileURLToPath(new URL('./preview-divider.png', import.meta.url)), fullPage: true })
  await pv.close()

  console.log('======== 汇总（渲染+probe+体积+洁净带+线厚+装饰） ========')
  const fails = results.filter((r) => !r.okRender || !r.okProbe || !r.okSize || !r.okBand || !r.okThick || !r.decorOk)
  console.log('通过 ' + pass + '/' + (pass + fail) + '；失败: ' + (fails.length ? fails.map((f) => f.name + '(probe=' + f.okProbe + ',band=' + f.okBand + '[' + f.bandV.join(';') + '],thick=' + f.okThick + ',decor=' + f.decorOk + ',' + f.sizeKB + 'KB)').join(', ') : '无'))
  console.log('PNG 输出: test/assets/divider/png-divider/（' + results.length + ' 张，4x）+ preview-divider.html/.png')
  if (fail > 0) process.exitCode = 1
} finally {
  await browser.close()
}
