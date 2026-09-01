// test/assets/render-combo-test.mjs
// 模拟 v11·组合模板与深度融合资产：把 ARTS-subheading-combo.mjs 的 8 个复合资产真实渲染为 PNG（4x）
// v5 精细度：渲染分辨率 2x → 4x（画布与 probe 同步 ×4）
// 输出：test/assets/png-combo/<name>.png + test/assets/preview-combo.html/.png
// 自动验证：每资产 probe 像素点（设计坐标×4，容差 ±12）→ PASS/FAIL + PNG 体积 ≤1MB（uploadimg 上限）
// 管线与 SKILL.md 客户端 svgToPng 一致：data:image/svg+xml;base64 → img → canvas 4x → PNG
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { comboArts } from './ARTS-subheading-combo.mjs'

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

const outDir = fileURLToPath(new URL('./png-combo/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
const results = []
const b64map = {}
let pass = 0, fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  for (const a of comboArts) {
    const svgB64 = Buffer.from(a.svg, 'utf8').toString('base64')
    await page.setContent('<img id="i" src="data:image/svg+xml;base64,' + svgB64 + '" />')
    const r = await page.evaluate(async (art) => {
      const img = document.getElementById('i')
      await new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res } })
      const S = 4 // v5：渲染分辨率 2x → 4x（精细度 ×4）
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
    const okSize = png.length < 1024 * 1024 // uploadimg 上限 1MB
    if (okRender && okProbe && okSize) pass++; else fail++
    results.push({ ...a, alphaPct: +r.alphaPct.toFixed(2), px: r.px, okRender, okProbe, sizeKB: +(png.length / 1024).toFixed(1) })
    console.log((okRender && okProbe && okSize ? 'OK  ' : 'FAIL') + ' ' + a.name.padEnd(26) + ' 不透明' + r.alphaPct.toFixed(2).padStart(6) + '%  probe(' + r.px.join(',') + ')' + (r.ok ? '' : ' 期望(' + a.probe[2].join(',') + ')') + '  ' + (png.length / 1024).toFixed(0) + 'KB')
  }
  await page.close()

  // 预览页：4 种组合方式 + 深度融合场景（375px 手机壳，文字负 margin 叠字 = 微信白名单兼容）
  const demo = (title, inner) =>
    '<div style="width:375px;margin:12px;background:#fff;border:1px solid #eee;border-radius:12px;display:inline-block;vertical-align:top;overflow:hidden">' +
    '<div style="padding:0 16px;font-family:sans-serif">' + inner + '</div></div>'
  // 1) 居中上下分割线：文字叠上下线中央（负 margin 压入）
  const s1 = demo('居中上下分割线', '<div style="text-align:center;margin-top:18px"><img src="data:image/png;base64,' + b64map['combo-frame-lines'] + '" style="width:100%;display:inline-block"/></div><p style="text-align:center;font-size:17px;font-weight:700;color:#2f3640;letter-spacing:2px;margin:-78px 0 92px;position:relative">把日子过成手账</p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">上下线形成完整框架，标题嵌在中央，线就是分隔不再加宽空行……</p>')
  // 2) 居中边框·深度融合：左上角小花 + 右下角叶子长在边框线上
  const s2 = demo('居中边框（左上花右下叶）', '<div style="text-align:center;margin-top:18px"><img src="data:image/png;base64,' + b64map['combo-frame-corner-flower'] + '" style="width:100%;display:inline-block"/></div><p style="text-align:center;font-size:17px;font-weight:700;color:#2f3640;letter-spacing:2px;margin:-88px 0 104px;position:relative">一周读一本书</p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">小花长在边框左上角线上，叶子长在右下角线上——装饰与结构一体……</p>')
  // 3) 左对齐左下划线：花锚 + 左对齐下划线
  const s3 = demo('左对齐左下划线', '<div style="text-align:left;margin-top:18px"><img src="data:image/png;base64,' + b64map['combo-underline-left'] + '" style="width:82%;display:inline-block"/></div><p style="font-size:16px;font-weight:700;color:#2f3640;margin:-60px 0 58px;padding-left:8px;position:relative">先做这 1 件事</p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">花锚在左端，下划线从左向右延伸，文字浮在线上方……</p>')
  // 4) 居中下划线：两端叶 + 中央波浪线
  const s4 = demo('居中下划线（两端叶）', '<p style="text-align:center;font-size:17px;font-weight:700;color:#2f3640;letter-spacing:2px;margin:18px 0 2px">清单化是整理的第一步</p><div style="text-align:center"><img src="data:image/png;base64,' + b64map['combo-underline-center'] + '" style="width:68%;display:inline-block"/></div><p style="font-size:15px;color:#555;line-height:1.75;margin:12px 0 16px">先列清单再动手，脑子就不会乱……</p>')
  // 5) 夹线嵌字·中心花饰
  const s5 = demo('夹线嵌字（中心花饰）', '<div style="position:relative;margin-top:18px;height:32px"><img src="data:image/png;base64,' + b64map['combo-clamp-flower'] + '" style="width:100%;display:block;position:absolute;top:50%;transform:translateY(-50%)"/><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:16px;font-weight:700;color:#2f3640;letter-spacing:1px;background:#fff;padding:0 10px;white-space:nowrap">三遍阅读法</span></div><p style="font-size:15px;color:#555;line-height:1.75;margin:12px 0 16px">中心花饰是夹线的延伸，不是额外贴上去的装饰……</p>')
  // 6) 徽章·藤蔓缠绕（深度融合：装饰长在徽章上）
  const s6 = demo('徽章藤蔓缠绕', '<p style="display:flex;align-items:center;margin:18px 0 12px"><img src="data:image/png;base64,' + b64map['combo-badge-vine'] + '" style="width:40px;height:40px;margin-right:10px"/><span style="font-size:17px;font-weight:700;color:#2f3640">第一步：先删最占空间的视频</span></p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">藤蔓从徽章边缘生长出来，与徽章一体……</p>')
  // 7) 缎带·花冠（活动标识）
  const s7 = demo('缎带花冠 CTA', '<div style="text-align:center;margin-top:18px"><img src="data:image/png;base64,' + b64map['combo-banner-crown'] + '" style="width:74%;display:inline-block"/></div><p style="text-align:center;font-size:15px;font-weight:700;color:#2f3640;margin:-68px 0 80px;position:relative">收藏这套方法</p><p style="font-size:15px;color:#555;line-height:1.75;margin:0 0 16px">花冠长在缎带顶部，CTA 文字叠缎带中央……</p>')

  const preview = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f7f7f5;padding:16px;font-family:sans-serif}h2{font-size:18px;color:#2f3640;margin:8px 12px}h3{font-size:15px;color:#2f3640;margin:8px 12px}</style></head><body>' +
    '<h2>v11 组合模板与深度融合资产（8 个 · 渐变+明暗分层，装饰长在组件结构上）</h2>' +
    '<div style="margin:0 12px 24px;white-space:nowrap;overflow-x:auto">' + s1 + s2 + s3 + s4 + s5 + s6 + s7 + '</div>' +
    '</body></html>'
  const previewPath = fileURLToPath(new URL('./preview-combo.html', import.meta.url))
  writeFileSync(previewPath, preview)

  const pv = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await pv.setContent(preview)
  await pv.waitForTimeout(500)
  await pv.screenshot({ path: fileURLToPath(new URL('./preview-combo.png', import.meta.url)), fullPage: true })
  await pv.close()

  console.log('======== 汇总 ========')
  const fails = results.filter((r) => !r.okRender || !r.okProbe || r.sizeKB > 1024)
  console.log('渲染+probe+体积 通过 ' + pass + '/' + (pass + fail) + '；失败: ' + (fails.length ? fails.map((f) => f.name + '(' + f.sizeKB + 'KB)').join(', ') : '无'))
  console.log('PNG 输出: test/assets/png-combo/（' + results.length + ' 张，4x）+ preview-combo.html/.png')
} finally {
  await browser.close()
}
