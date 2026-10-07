// export-paging-check.mjs —— **安全分页（多页导出）**的零模型验收
//
// 用法：node scripts/export-paging-check.mjs [outDir] [URL]   （需先启动 dev server）
//
// 变化（2026-10-07 · B 路）：分页从「每 1000 CSS px 等高硬切」改成「先量保护区、再选切点」。
// 因此本脚本的判据也换了：**不再**断言"所有非末页等高"或"末页高 = 长图高 − (页数−1)×页高"
// （那两条是旧实现的耦合，页高现在允许不同），改为：
//   · 保留：PNG 结构核对（签名 / IHDR / IEND）、页序、无缺页/重复、**同 canvas 拼回逐像素一致**；
//   · 新增：切点严格递增且首 0 末 canvasPx、末页非空、**没有任何切点穿过文字行/图片/SVG/表格行**；
//   · 新增：**旧固定切法证红** —— 用同一套独立探针在"每 1000 CSS px"的旧切点上必须报出切口，
//     证明①该夹具确实摆在会被旧实现切坏的位置，②本检测器不是恒绿。
//
// 三个冻结夹具（scripts/fixtures/2026-10-07-safe-paging/，本脚本只读）：
//   short.md 短稿（一页）· text.md 纯文字（≥3 页，文字行贴近原固定切点）·
//   art.md 插画/表格/超高块（普通插画压在旧切线上、表格行跨旧切线、一张超过目标页高的竖版长插画）。
//
// 走的是**真实生产链**：`composeMarkdown(夹具) → renderArtPlaceholders → exportArticleImages
//   → renderArticleImages → export_images`。唯一替身是最后那步 Rust 落盘命令（浏览器里执行不了），
// 脚本把**真正传给它的文件清单**抓下来自己写盘，再做独立于浏览器自述的文件级核对。
//
// 带上/下标、阴影、旋转装饰等**未覆盖**边界见 B/report.md「未覆盖条件」。

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJudge, guardCrashes, parseRunnerArgs, resolveOutDir } from './lib/run-result.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FIX_DIR = join(here, 'fixtures', '2026-10-07-safe-paging')
/** 目标页高（CSS px）；新实现下实际页高允许不同 */
const TARGET_CSS_H = 1000

const args = parseRunnerArgs()
const judge = createJudge({
  script: 'export-paging-check',
  outDir: resolveOutDir('export-paging-check', args.outDir),
  plannedCases: ['①', '②', '③', '④'],
  // 2026-10-08 实测 59 条（①16 + ②17 + ③21 + ④5）；静默少跑一条就变红
  minChecks: 59,
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}
const observe = (id, detail) => judge.observe(id, detail)

const require = createRequire(import.meta.url)
function resolvePlaywright() {
  const tried = []
  try {
    return require('playwright')
  } catch (e) {
    tried.push(`require('playwright') → ${String(e.message || e).split('\n')[0]}`)
  }
  const p = process.env.VERIFY_PLAYWRIGHT
  if (p) {
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return require(target)
    } catch (e) {
      tried.push(`VERIFY_PLAYWRIGHT=${target} → ${String(e.message || e).split('\n')[0]}`)
    }
  } else tried.push('VERIFY_PLAYWRIGHT → 未设置')
  judge.block(`解析不到 playwright 模块。已尝试：\n  - ${tried.join('\n  - ')}`)
  judge.finish({ exitCode: 2 })
  process.exit(2)
}
function resolveChromiumExe() {
  const env = process.env.VERIFY_CHROMIUM
  if (env) {
    const t = isAbsolute(env) ? env : resolve(process.cwd(), env)
    return existsSync(t) ? t : null
  }
  const hard = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
  return existsSync(hard) ? hard : null
}

// ── 夹具冻结核对（只读；sha256 写进观测，便于事后确认跑的是哪一版夹具）────────────────
const FIXTURES = [
  { key: '①', name: '短稿', file: 'short.md', minPages: 1, maxPages: 1, minOldCross: 0, expectImg: 0, expectTr: 0, expectOversize: 0 },
  { key: '②', name: '纯文字', file: 'text.md', minPages: 3, maxPages: 0, minOldCross: 2, expectImg: 0, expectTr: 0, expectOversize: 0 },
  { key: '③', name: '插画表格', file: 'art.md', minPages: 3, maxPages: 0, minOldCross: 2, expectImg: 2, expectTr: 1, expectOversize: 1 },
]
const fixtureInfo = []
for (const f of FIXTURES) {
  const p = join(FIX_DIR, f.file)
  if (!existsSync(p)) {
    judge.block(`找不到夹具：${p}`)
    break
  }
  const buf = readFileSync(p)
  fixtureInfo.push({ ...f, path: p, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), source: buf.toString('utf8') })
}
if (!judge.run.blockedReason) {
  console.log('\n[夹具] scripts/fixtures/2026-10-07-safe-paging/（冻结，本脚本只读）')
  for (const f of fixtureInfo) console.log(`  ${f.key} ${f.file}  ${f.bytes} 字节  sha256=${f.sha256.slice(0, 16)}…`)
  observe('夹具冻结指纹', fixtureInfo.map((f) => `${f.file}=${f.sha256}`).join(' | '))
}

const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromiumExe()
const base = args.base || 'http://127.0.0.1:1420'

// ── 页面内：跑一个夹具（真实生产链 + 独立几何探针 + 像素核对）────────────────────────
async function runFixture({ src, targetCssH }) {
  const { composeMarkdown } = await import('/src/lib/compose.ts')
  const { renderArtPlaceholders } = await import('/src/lib/artRender.ts')
  const { renderArticleImages } = await import('/src/lib/htmlToImage.ts')
  const { exportArticleImages } = await import('/src/lib/exportImages.ts')

  const WIDTH = 375
  const SCALE = 2
  const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"

  const mount = (html) => {
    const host = document.createElement('div')
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;font-family:${FONT};`
    host.innerHTML = `<div style="width:${WIDTH}px;box-sizing:border-box">${html}</div>`
    document.body.appendChild(host)
    return host
  }
  const paint = async (host) => {
    await Promise.all([...host.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  }
  const dataUrlToCanvas = async (url) => {
    const im = new Image()
    im.src = url
    await im.decode()
    const c = document.createElement('canvas')
    c.width = im.naturalWidth
    c.height = im.naturalHeight
    c.getContext('2d').drawImage(im, 0, 0)
    return c
  }
  const ctxOf = (c) => c.getContext('2d')

  /**
   * **独立于产品实现**的受保护对象测量：文字行用 `Range.getClientRects()` 逐行取（不是整块包围框），
   * 图片/内联 SVG 整块取，表格行 `tr` 整行取。产品那边怎么实现不在这里复用——否则就是"自己判自己"。
   */
  const probeRects = (host, top0) => {
    const out = []
    const push = (r, kind, text) => {
      if (r.width > 0 && r.height > 0) out.push({ top: r.top - top0, bottom: r.bottom - top0, kind, text: String(text || '').replace(/\s+/g, ' ').slice(0, 24) })
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue
      range.selectNodeContents(n)
      for (const r of Array.from(range.getClientRects())) push(r, 'text', String(n.nodeValue).trim())
    }
    for (const el of host.querySelectorAll('img,svg')) push(el.getBoundingClientRect(), el.tagName.toLowerCase(), el.getAttribute('alt') || '')
    for (const el of host.querySelectorAll('tr')) push(el.getBoundingClientRect(), 'tr', el.textContent || '')
    return out
  }
  /** 哪些受保护对象**跨过**某条切点（严格穿过内部才算，压着边不算） */
  const crossers = (rects, cut) =>
    rects
      .filter((x) => x.top + 0.5 < cut && cut < x.bottom - 0.5)
      .map((x) => ({ kind: x.kind, text: x.text, height: Math.round(x.bottom - x.top), crossPx: Math.round(x.bottom - cut) }))
  const inkRatio = (c) => {
    const d = ctxOf(c).getImageData(0, 0, c.width, c.height).data
    let ink = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) ink++
    return ink / (c.width * c.height)
  }
  /** 彩色（强饱和）像素数：用来证明插画**真的被光栅化**了，而不是只占了个空盒子 */
  const colorCount = (c) => {
    const d = ctxOf(c).getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2])
      const mn = Math.min(d[i], d[i + 1], d[i + 2])
      if (mx - mn > 60) n++
    }
    return n
  }
  /** 逐张拼回后与长图逐像素比；高度对不上直接报错值 */
  const stitchDiff = (longCv, pagesCv) => {
    const stitched = document.createElement('canvas')
    stitched.width = longCv.width
    stitched.height = longCv.height
    const sctx = ctxOf(stitched)
    let y = 0
    for (const pc of pagesCv) {
      sctx.drawImage(pc, 0, y)
      y += pc.height
    }
    if (y !== longCv.height) return { heightMismatch: y - longCv.height, diff: -1 }
    const a = ctxOf(longCv).getImageData(0, 0, longCv.width, longCv.height).data
    const b = sctx.getImageData(0, 0, longCv.width, longCv.height).data
    let diff = 0
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++
    }
    return { heightMismatch: 0, diff }
  }
  /** 用同一张长图按给定切点裁成若干张（对照用：旧固定切法） */
  const sliceAtCss = (longCv, cutsCss) => {
    const cuts = [0, ...cutsCss.filter((c) => c * SCALE < longCv.height).map((c) => Math.round(c * SCALE)), longCv.height]
    const out = []
    for (let i = 0; i < cuts.length - 1; i++) {
      const h = cuts[i + 1] - cuts[i]
      if (h <= 0) continue
      const c = document.createElement('canvas')
      c.width = longCv.width
      c.height = h
      c.getContext('2d').drawImage(longCv, 0, cuts[i], longCv.width, h, 0, 0, longCv.width, h)
      out.push(c.toDataURL('image/png'))
    }
    return out
  }
  /**
   * **逐像素跨缝墨迹**：切线上下各取一行，统计"同一列两行都有墨"的列数。
   * 这是"这一刀有没有切穿内容"的像素级判据——字形/图形被切开时，缝的两侧在同样的列上都还有墨；
   * 落在空隙里的干净切点，两侧都是白。它比行盒矩形（会含行间空白）更接近"肉眼看到被切开"。
   *
   * ⚠️ "墨"的判据不能用 `任一通道 < 245`：主题的浅色卡片底（如 #eef3fb 的 R=238）会被算成墨，
   * 于是整行 686 列（= 343 CSS px 内容宽 ×2）全部"有墨"，指标退化成恒真（实测踩过）。
   * 这里用"三通道之和 < 600（均值 < 200）"识别真正的字形/图形笔画，并要求 alpha 非零
   * （画布未绘制处是透明像素，其 RGB 读出来是 0，不加 alpha 判定会被当成纯黑）。
   */
  const seamInk = (cv, cutPx) => {
    if (!cv || cutPx <= 0 || cutPx >= cv.height) return null
    const ctx = ctxOf(cv)
    const a = ctx.getImageData(0, cutPx - 1, cv.width, 1).data
    const b = ctx.getImageData(0, cutPx, cv.width, 1).data
    const dark = (d, i) => d[i + 3] > 8 && d[i] + d[i + 1] + d[i + 2] < 600
    let cols = 0
    for (let x = 0; x < cv.width; x++) {
      const i = x * 4
      if (dark(a, i) && dark(b, i)) cols++
    }
    return cols
  }
  /**
   * 放大接缝图（人工目视用）：把长图上切线**两侧各 30 CSS px** 放大 2 倍，中间留一道红色缝。
   * 上下两块就是"切完之后上一页底 / 下一页顶"的真实像素：如果某一刀切穿了字形或图形，
   * 红线两侧能直接看到被劈开的上下两半（不是靠文字描述，是像素）。
   */
  const zoomShot = (cv, cutPx, band = 60) => {
    const top = Math.max(0, cutPx - band)
    const hTop = cutPx - top
    const hBot = Math.min(cv.height, cutPx + band) - cutPx
    const gap = 6
    const c = document.createElement('canvas')
    c.width = cv.width * 2
    c.height = (hTop + hBot) * 2 + gap
    const x = ctxOf(c)
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, c.width, c.height)
    x.imageSmoothingEnabled = false
    if (hTop > 0) x.drawImage(cv, 0, top, cv.width, hTop, 0, 0, cv.width * 2, hTop * 2)
    x.fillStyle = '#e60000'
    x.fillRect(0, hTop * 2, c.width, gap)
    if (hBot > 0) x.drawImage(cv, 0, cutPx, cv.width, hBot, 0, hTop * 2 + gap, cv.width * 2, hBot * 2)
    return c.toDataURL('image/png')
  }
  /**
   * 接缝图（人工目视用）：上一页**最后 22 CSS px** + 红色分隔 + 下一页**最前 22 CSS px**，放大 3 倍。
   * 用真实分页 PNG（不是长图）拼，所以看到的就是"上传到公众号后台的第 N 张和第 N+1 张的接缝"。
   */
  const seamShot = (pagesCv, i, band = 44, zoom = 3) => {
    const a = pagesCv[i]
    const b = pagesCv[i + 1]
    const ha = Math.min(band, a.height)
    const hb = Math.min(band, b.height)
    const c = document.createElement('canvas')
    c.width = a.width * zoom
    c.height = (ha + hb) * zoom + 8
    const x = ctxOf(c)
    x.imageSmoothingEnabled = false
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, c.width, c.height)
    x.drawImage(a, 0, a.height - ha, a.width, ha, 0, 0, a.width * zoom, ha * zoom)
    x.fillStyle = '#e60000'
    x.fillRect(0, ha * zoom, c.width, 8)
    x.drawImage(b, 0, 0, b.width, hb, 0, ha * zoom + 8, b.width * zoom, hb * zoom)
    return c.toDataURL('image/png')
  }

  const composed = composeMarkdown(src, {})
  const html = composed.arts && composed.arts.length ? await renderArtPlaceholders(composed.html, composed.arts) : composed.html

  // ① 真实链路：exportArticleImages → export_images（stub 只替掉 Rust 落盘那一步）
  const invokes = []
  const prevInternals = window.__TAURI_INTERNALS__
  window.__TAURI_INTERNALS__ = {
    ...(prevInternals || {}),
    invoke: async (cmd, payload) => {
      invokes.push({ cmd, name: (payload && payload.name) || '', files: (payload && payload.files) || [] })
      return 'STUB-DIR::' + ((payload && payload.name) || '')
    },
  }
  let exported = null
  let exportErr = null
  try {
    exported = await exportArticleImages(html)
  } catch (e) {
    exportErr = String((e && e.message) || e)
  }
  window.__TAURI_INTERNALS__ = prevInternals
  const call = invokes.find((i) => i.cmd === 'export_images') || null
  const files = call ? call.files : []

  // ② 同一生产模块再读一次诊断（cutsPx / oversize）
  let rendered = null
  let renderErr = null
  try {
    rendered = await renderArticleImages(html)
  } catch (e) {
    renderErr = String((e && e.message) || e)
  }

  // ③ 独立几何探针（必须在 host 还挂着的时候量）
  const host = mount(html)
  await paint(host)
  const top0 = host.getBoundingClientRect().top
  const cssH = Math.ceil(host.getBoundingClientRect().height)
  const rects = probeRects(host, top0)
  const probe = {
    elCount: rects.length,
    hostTop: Math.round(top0),
    hostH: cssH,
    counts: rects.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {}),
    samples: rects.slice(0, 5).map((r) => ({ kind: r.kind, top: Math.round(r.top), bottom: Math.round(r.bottom) })),
  }
  host.remove()

  // ④ 用 export_images 真正交出去的载荷还原画布，做像素核对（不信任浏览器自述）
  const longFile = files.find((f) => /长图\.png$/.test(f.name)) || null
  const pageFiles = files.filter((f) => !/长图\.png$/.test(f.name))
  const longCv = longFile ? await dataUrlToCanvas(longFile.data) : null
  const pagesCv = []
  for (const f of pageFiles) pagesCv.push(await dataUrlToCanvas(f.data))
  const stitch = longCv && pagesCv.length ? stitchDiff(longCv, pagesCv) : { heightMismatch: null, diff: null }
  const ink = pagesCv.map(inkRatio)
  const color = pagesCv.map(colorCount)
  const pageH = pagesCv.map((c) => c.height)
  const pageW = pagesCv.map((c) => c.width)

  // ⑤ 切点：新切点由分页高度累加得到（这就是实际执行的切点）；旧切点是 1000 CSS px 的整数倍
  const pageCssH = pageH.map((h) => h / SCALE)
  const newCutsCss = [0]
  for (const h of pageCssH) newCutsCss.push(+(newCutsCss[newCutsCss.length - 1] + h).toFixed(3))
  const oldCutsCss = []
  for (let k = targetCssH; k < cssH; k += targetCssH) oldCutsCss.push(k)
  const oldCross = oldCutsCss.map((c) => ({ c, hits: crossers(rects, c) }))
  const newCross = newCutsCss.slice(1, -1).map((c) => ({ c, hits: crossers(rects, c) }))

  // 超高对象整块保留：最高的一张图/SVG，竖直范围内不得有任何内部切点
  const imgRects = rects.filter((x) => x.kind === 'img' || x.kind === 'svg')
  const tallest = imgRects.slice().sort((a, b) => b.bottom - b.top - (a.bottom - a.top))[0]
  if (tallest) {
    const inner = newCutsCss.slice(1, -1).filter((c) => c > tallest.top + 0.5 && c < tallest.bottom - 0.5)
    probe.oversizeGuard = {
      found: inner.length === 0,
      detail: `最高图片 y=${Math.round(tallest.top)}..${Math.round(tallest.bottom)}（高 ${Math.round(tallest.bottom - tallest.top)} CSS px）；落在它内部的切点 ${inner.length} 个 ${JSON.stringify(inner)}`,
    }
  } else {
    probe.oversizeGuard = { found: false, detail: '(夹具里没有图片/SVG 对象)' }
  }

  // ⑥ 旧固定切法的对照页 + 新切法的接缝图（人工目视用）
  const oldPages = longCv && oldCutsCss.length ? sliceAtCss(longCv, oldCutsCss) : []
  const oldPagesCv = []
  for (const url of oldPages) oldPagesCv.push(await dataUrlToCanvas(url))
  const seams = pagesCv.length > 1 ? pagesCv.slice(0, -1).map((_, i) => seamShot(pagesCv, i)) : []
  const oldSeams = oldPagesCv.length > 1 ? oldPagesCv.slice(0, -1).map((_, i) => seamShot(oldPagesCv, i)) : []

  // ⑦ 逐像素跨缝墨迹 + 放大接缝图（新切点 vs 旧固定切点）
  const innerCutsCss = newCutsCss.slice(1, -1)
  const seamInkNew = innerCutsCss.map((c) => ({ cutCss: c, cols: seamInk(longCv, Math.round(c * SCALE)) }))
  const seamInkOld = oldCutsCss.map((c) => ({ cutCss: c, cols: seamInk(longCv, Math.round(c * SCALE)) }))
  const zoomNew = longCv ? innerCutsCss.map((c) => zoomShot(longCv, Math.round(c * SCALE))) : []
  const zoomOld = longCv ? oldCutsCss.map((c) => zoomShot(longCv, Math.round(c * SCALE))) : []

  return {
    composed: {
      issues: (composed.issues || []).map((i) => ({ code: i.code, severity: i.severity, line: i.line, message: String(i.message || '').slice(0, 120) })),
      warnings: (composed.warnings || []).length,
      artCount: (composed.arts || []).length,
      htmlLen: html.length,
    },
    export: {
      ok: exported && exported.ok,
      msg: exported && exported.msg,
      err: exportErr,
      invokes: invokes.map((i) => ({ cmd: i.cmd, name: i.name, fileCount: i.files.length })),
      names: files.map((f) => f.name),
      payload: files.map((f) => ({ name: f.name, data: f.data })),
      longBytes: longFile ? longFile.data.length : 0,
    },
    render: { ok: !!rendered, err: renderErr, cutsPx: rendered ? rendered.cutsPx : null, oversize: rendered ? rendered.oversize : null },
    cssH,
    probe,
    longW: longCv ? longCv.width : 0,
    longH: longCv ? longCv.height : 0,
    longColor: longCv ? colorCount(longCv) : 0,
    pageW,
    pageH,
    ink,
    color,
    newCutsCss,
    oldCutsCss,
    oldCross,
    newCross,
    stitch,
    seams,
    oldSeams,
    oldPages,
    seamInkNew,
    seamInkOld,
    zoomNew,
    zoomOld,
  }
}

// ── 页面内：旧切法证红的**对照夹具**（与三个夹具无关，独立手写）──────────────────────
async function runControl({ targetCssH }) {
  const { exportArticleImages } = await import('/src/lib/exportImages.ts')
  const WIDTH = 375
  const SCALE = 2
  const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
  // 显式高度把内容精确推到旧切线上：960px 空白 + 3 行文字（压在 1000 CSS px 上）
  // + 300px 实心块 + 614px 空白 + 3 行文字（压在 2000 CSS px 上）。
  // 空白分隔块**不给背景色**：带背景的叶子会被生产实现当装饰保护，那样测的就不是"文字行会不会被切"了。
  const html =
    `<div style="font-size:16px;line-height:1.8;color:#222">` +
    `<div style="height:960px"></div>` +
    `<p style="margin:0">这一行文字正好压在旧的 1000 CSS px 固定切页线上，旧实现会把它切成两半，新实现会把这一页提前结束。</p>` +
    `<blockquote style="height:300px;margin:0;background:#dfeede"></blockquote>` +
    `<div style="height:614px"></div>` +
    `<p style="margin:0">第二条参照文字，压在旧的 2000 CSS px 切线上；这一行同样会被旧实现切开，新实现会提前结束上一页。</p>` +
    `</div>`

  const invokes = []
  const prevInternals = window.__TAURI_INTERNALS__
  window.__TAURI_INTERNALS__ = {
    ...(prevInternals || {}),
    invoke: async (cmd, payload) => {
      invokes.push({ cmd, name: (payload && payload.name) || '', files: (payload && payload.files) || [] })
      return 'STUB'
    },
  }
  let exported = null
  let err = null
  try {
    exported = await exportArticleImages(html)
  } catch (e) {
    err = String((e && e.message) || e)
  }
  window.__TAURI_INTERNALS__ = prevInternals
  const call = invokes.find((i) => i.cmd === 'export_images') || null
  const files = call ? call.files : []
  const pageFiles = files.filter((f) => !/长图\.png$/.test(f.name))
  const longFile = files.find((f) => /长图\.png$/.test(f.name)) || null
  const canvases = []
  const decode = async (url) => {
    const im = new Image()
    im.src = url
    await im.decode()
    const c = document.createElement('canvas')
    c.width = im.naturalWidth
    c.height = im.naturalHeight
    c.getContext('2d').drawImage(im, 0, 0)
    return c
  }
  for (const f of pageFiles) canvases.push(await decode(f.data))
  const longCv = longFile ? await decode(longFile.data) : null
  /** 切线上下各取一行，"同列两行都有墨"的列数（与夹具侧同一口径，判据见 runFixture 的注释） */
  const seamInk = (cv, cutPx) => {
    if (!cv || cutPx <= 0 || cutPx >= cv.height) return null
    const ctx = cv.getContext('2d')
    const a = ctx.getImageData(0, cutPx - 1, cv.width, 1).data
    const b = ctx.getImageData(0, cutPx, cv.width, 1).data
    const dark = (d, i) => d[i + 3] > 8 && d[i] + d[i + 1] + d[i + 2] < 600
    let cols = 0
    for (let x = 0; x < cv.width; x++) {
      const i = x * 4
      if (dark(a, i) && dark(b, i)) cols++
    }
    return cols
  }

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;font-family:${FONT};`
  host.innerHTML = `<div style="width:${WIDTH}px;box-sizing:border-box">${html}</div>`
  document.body.appendChild(host)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const top0 = host.getBoundingClientRect().top
  const cssH = Math.ceil(host.getBoundingClientRect().height)
  const rects = []
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue
    range.selectNodeContents(n)
    for (const r of Array.from(range.getClientRects())) {
      if (r.width > 0 && r.height > 0) rects.push({ top: r.top - top0, bottom: r.bottom - top0, kind: 'text', text: String(n.nodeValue).trim().slice(0, 20) })
    }
  }
  for (const el of host.querySelectorAll('blockquote')) {
    const r = el.getBoundingClientRect()
    rects.push({ top: r.top - top0, bottom: r.bottom - top0, kind: 'blockquote', text: '' })
  }
  host.remove()
  const crossers = (cut) =>
    rects.filter((x) => x.top + 0.5 < cut && cut < x.bottom - 0.5).map((x) => ({ kind: x.kind, height: Math.round(x.bottom - x.top), crossPx: Math.round(x.bottom - cut) }))
  const pageCssH = canvases.map((c) => c.height / SCALE)
  const newCutsCss = [0]
  for (const h of pageCssH) newCutsCss.push(+(newCutsCss[newCutsCss.length - 1] + h).toFixed(3))
  const oldCutsCss = []
  for (let k = targetCssH; k < cssH; k += targetCssH) oldCutsCss.push(k)
  return {
    ok: exported && exported.ok,
    msg: exported && exported.msg,
    err,
    cssH,
    rectCount: rects.length,
    pageCount: canvases.length,
    pageCssH,
    newCutsCss,
    oldCutsCss,
    oldCross: oldCutsCss.map((c) => ({ c, hits: crossers(c) })),
    newCross: newCutsCss.slice(1, -1).map((c) => ({ c, hits: crossers(c) })),
    seamInkOld: oldCutsCss.map((c) => ({ cutCss: c, cols: seamInk(longCv, Math.round(c * SCALE)) })),
    seamInkNew: newCutsCss.slice(1, -1).map((c) => ({ cutCss: c, cols: seamInk(longCv, Math.round(c * SCALE)) })),
  }
}

// ── 跑 ────────────────────────────────────────────────────────────────────────────
const results = {}
let control = null
const pageErrors = []
let browser = null
if (!judge.run.blockedReason) {
  try {
    browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
    const page = await browser.newPage()
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    try {
      await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
    } catch (e) {
      judge.error('navigate', `打开 ${base} 失败：${String(e.message || e).split('\n')[0]}`)
    }
    if (!judge.run.errors.length) {
      for (const f of fixtureInfo) {
        console.log(`\n[${f.key} ${f.name}] compose → renderArtPlaceholders → exportArticleImages → export_images …`)
        try {
          results[f.file] = await page.evaluate(runFixture, { src: f.source, targetCssH: TARGET_CSS_H })
        } catch (e) {
          judge.error('runner', `${f.file} 采集失败：${String((e && e.message) || e).split('\n')[0]}`)
        }
      }
      try {
        control = await page.evaluate(runControl, { targetCssH: TARGET_CSS_H })
      } catch (e) {
        judge.error('runner', `对照夹具采集失败：${String((e && e.message) || e).split('\n')[0]}`)
      }
    }
  } catch (e) {
    judge.error('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

// ── 落盘：把 export_images 真正收到的 PNG 写出来 + 旧切法对照页 + 接缝图 ──────────────
const outDir = judge.run.outDir || resolveOutDir('export-paging-check', args.outDir)
const written = {}
try {
  mkdirSync(join(outDir, 'pages'), { recursive: true })
  mkdirSync(join(outDir, 'seams'), { recursive: true })
  for (const f of fixtureInfo) {
    const r = results[f.file]
    if (!r) continue
    const stem = f.file.replace(/\.md$/, '')
    const list = []
    for (const p of r.export.payload || []) {
      const p2 = join(outDir, 'pages', `${stem}-${p.name}`)
      writeFileSync(p2, Buffer.from(String(p.data).replace(/^data:image\/png;base64,/, ''), 'base64'))
      list.push(p2)
    }
    for (let i = 0; i < (r.oldPages || []).length; i++) {
      const p2 = join(outDir, 'pages', `${stem}-旧固定切法-${String(i + 1).padStart(2, '0')}.png`)
      writeFileSync(p2, Buffer.from(String(r.oldPages[i]).replace(/^data:image\/png;base64,/, ''), 'base64'))
      list.push(p2)
    }
    const seams = []
    for (let i = 0; i < (r.seams || []).length; i++) {
      const p2 = join(outDir, 'seams', `${stem}-新切法-接缝-${i + 1}.png`)
      writeFileSync(p2, Buffer.from(String(r.seams[i]).replace(/^data:image\/png;base64,/, ''), 'base64'))
      seams.push(p2)
    }
    for (let i = 0; i < (r.oldSeams || []).length; i++) {
      const p2 = join(outDir, 'seams', `${stem}-旧固定切法-接缝-${i + 1}.png`)
      writeFileSync(p2, Buffer.from(String(r.oldSeams[i]).replace(/^data:image\/png;base64,/, ''), 'base64'))
      seams.push(p2)
    }
    for (let i = 0; i < (r.zoomNew || []).length; i++) {
      const c = r.seamInkNew[i]
      const p2 = join(outDir, 'seams', `${stem}-新切线放大-${c.cutCss}CSS-跨缝墨迹${c.cols}.png`)
      writeFileSync(p2, Buffer.from(String(r.zoomNew[i]).replace(/^data:image\/png;base64,/, ''), 'base64'))
      seams.push(p2)
    }
    for (let i = 0; i < (r.zoomOld || []).length; i++) {
      const c = r.seamInkOld[i]
      const p2 = join(outDir, 'seams', `${stem}-旧切线放大-${c.cutCss}CSS-跨缝墨迹${c.cols}.png`)
      writeFileSync(p2, Buffer.from(String(r.zoomOld[i]).replace(/^data:image\/png;base64,/, ''), 'base64'))
      seams.push(p2)
    }
    written[f.file] = { pages: list, seams }
  }
} catch (e) {
  judge.error('persist', `写 PNG 失败：${String((e && e.message) || e)}`)
}

/** 独立于浏览器自述的文件级核对：签名 / IHDR 宽高 / IEND */
function pngInfo(buf) {
  const sigOk = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const ihdrOk = buf.length > 33 && buf.subarray(12, 16).toString('latin1') === 'IHDR'
  const w = ihdrOk ? buf.readUInt32BE(16) : 0
  const h = ihdrOk ? buf.readUInt32BE(20) : 0
  const iendOk = buf.length >= 12 && buf.subarray(buf.length - 8, buf.length - 4).toString('latin1') === 'IEND'
  return { sigOk, ihdrOk, iendOk, w, h }
}

// ── 判定 ──────────────────────────────────────────────────────────────────────────
for (const f of fixtureInfo) {
  const r = results[f.file]
  const K = f.key
  console.log(`\n[${K} ${f.name}：${f.file}]`)
  if (!r) {
    check(`${K} 采集到结果`, false, '浏览器采集失败，见上面的错误')
    continue
  }

  const blocking = (r.composed.issues || []).filter((i) => i.severity !== 'warning' && i.severity !== 'info')
  if (r.composed.issues && r.composed.issues.length) observe(`${K} compose 提示（非阻断）`, JSON.stringify(r.composed.issues))
  check(`${K} compose 没有解析/阻断级问题（夹具本身是合法 v2）`, blocking.length === 0, `阻断=${blocking.length}；全部=${JSON.stringify(r.composed.issues)}`)
  check(`${K} 真实链路走通：exportArticleImages 返回 ok`, r.export.ok === true && !r.export.err, `${r.export.msg}${r.export.err ? ' ERR=' + r.export.err : ''}`)

  const pageCount = r.pageH.length
  console.log(`  正文 CSS 高 ${r.cssH}px；长图 ${r.longW}×${r.longH}；分页 ${pageCount} 张，高度 ${JSON.stringify(r.pageH)}（CSS px ${JSON.stringify(r.pageH.map((h) => h / 2))}）`)

  check(
    `${K} export_images 收到 1 张长图 + N 张分页（命名带序号）`,
    r.export.invokes.length === 1 &&
      r.export.invokes[0].cmd === 'export_images' &&
      r.export.names.filter((n) => /长图\.png$/.test(n)).length === 1 &&
      r.export.names.length === pageCount + 1 &&
      r.export.names.slice(1).every((n, i) => n.endsWith(`-${String(i + 1).padStart(2, '0')}.png`)),
    JSON.stringify(r.export.names),
  )
  check(`${K} 长图与每一页宽度都是 750px`, r.longW === 750 && r.pageW.every((w) => w === 750), `长图 ${r.longW}；分页 ${JSON.stringify(r.pageW)}`)
  check(
    `${K} 无缺页/无重复：分页高度全部为正且求和 = 长图高`,
    r.pageH.every((h) => h > 0) && r.pageH.reduce((a, b) => a + b, 0) === r.longH,
    `求和=${r.pageH.reduce((a, b) => a + b, 0)} 长图=${r.longH}`,
  )
  check(`${K} 末页存在且高度 > 0（不是空页）`, pageCount >= 1 && r.pageH[pageCount - 1] > 0, `末页高 ${r.pageH[pageCount - 1]} 设备像素 = ${r.pageH[pageCount - 1] / 2} CSS px`)
  check(
    `${K} 末页有可见内容（不是空白页）`,
    r.ink.length > 0 && r.ink[pageCount - 1] > 0.001,
    `各页有墨比例 ${JSON.stringify(r.ink.map((x) => +(x * 100).toFixed(2)))}`,
  )
  check(`${K} **顺序正确**：分页逐张拼回后与长图逐像素一致`, r.stitch.diff === 0 && r.stitch.heightMismatch === 0, JSON.stringify(r.stitch))
  check(
    `${K} 切点严格递增、首 0、末 = 画布高（连续覆盖，无重叠无遗漏）`,
    r.newCutsCss[0] === 0 &&
      Math.round(r.newCutsCss[r.newCutsCss.length - 1] * 2) === r.longH &&
      r.newCutsCss.every((c, i) => i === 0 || c > r.newCutsCss[i - 1]),
    JSON.stringify(r.newCutsCss),
  )
  check(
    `${K} **新切点不穿过任何文字行/图片/SVG/表格行**`,
    r.newCross.every((x) => x.hits.length === 0),
    r.newCross.map((x) => `${x.c}px:${x.hits.length}`).join(' ') || '(没有内部切点)',
  )
  check(
    `${K} 几何探针可用（量到受保护对象，且宿主高与转图高一致）`,
    r.probe && r.probe.elCount > 10 && Math.abs(r.probe.hostH - r.cssH) <= 2,
    JSON.stringify(r.probe),
  )
  const info = written[f.file]
  if (info && info.pages.length) {
    const infos = info.pages.map((p) => ({ p, ...pngInfo(readFileSync(p)) }))
    check(
      `${K} 落盘 PNG 独立核对通过（签名 + IHDR + IEND 齐全）`,
      infos.every((i) => i.sigOk && i.ihdrOk && i.iendOk),
      `${infos.length} 个文件`,
    )
    check(
      `${K} 落盘文件的像素尺寸与浏览器自述一致（宽度都 750）`,
      infos.slice(0, pageCount + 1).every((i, k) => (k === 0 ? i.h === r.longH : i.h === r.pageH[k - 1]) && i.w === 750),
      `长图 ${infos[0].w}×${infos[0].h}；分页 ${infos.slice(1, pageCount + 1).map((i) => i.h).join(',')}`,
    )
  } else {
    check(`${K} 落盘 PNG 独立核对通过（签名 + IHDR + IEND 齐全）`, false, '没有写出任何 PNG')
  }

  // ── 旧切法证红：独立探针在"每 1000 CSS px 一刀"的旧切点上必须报出切口 ──────────────
  const oldHits = r.oldCross.reduce((a, x) => a + x.hits.length, 0)
  observe(
    `${K} 旧固定切法切口统计（证红依据）`,
    r.oldCross.length
      ? r.oldCross.map((x) => `${x.c}px: ${x.hits.length ? x.hits.map((h) => `<${h.kind}>${h.text ? '「' + h.text + '」' : ''}被切 ${h.crossPx}px（对象高 ${h.height}）`).join('；') : '落在空隙（未切穿）'}`).join(' ｜ ')
      : '(正文不足 1000 CSS px，旧切法没有内部切点)',
  )
  check(
    `${K} 旧固定切法**确实切穿内容**（${oldHits} 处，证红）≥ ${f.minOldCross}`,
    oldHits >= f.minOldCross,
    `旧切点 ${JSON.stringify(r.oldCutsCss)}；切口 ${oldHits} 处`,
  )

  // ── 逐像素证红/证绿：切线上下各取一行，"同列两行都有墨"的列数就是被切穿的笔画宽度 ──────────
  const inkNew = r.seamInkNew || []
  const inkOld = r.seamInkOld || []
  check(
    `${K} **新切点逐像素未切穿墨迹**（跨缝列数 = 0）`,
    inkNew.every((x) => x.cols === 0),
    inkNew.map((x) => `${x.cutCss}px:${x.cols}列`).join(' ') || '(没有内部切点)',
  )
  if (inkOld.length) {
    const worst = Math.max(...inkOld.map((x) => x.cols || 0))
    check(
      `${K} **旧固定切法逐像素切穿墨迹**（最严重一刀跨缝有墨 ${worst} 列，证红）`,
      worst > 0,
      inkOld.map((x) => `${x.cutCss}px:${x.cols}列`).join(' '),
    )
  }

  // ── 夹具特定断言 ────────────────────────────────────────────────────────────────
  if (f.maxPages === 1) {
    check(`${K} 短稿恰好 1 页`, pageCount === 1, `实际 ${pageCount} 页`)
  }
  if (f.minPages > 1) {
    check(`${K} **至少 ${f.minPages} 页**（实际 ${pageCount} 页）`, pageCount >= f.minPages, `分页 ${pageCount} 张`)
  }
  if (f.expectImg > 0) {
    const imgRectCount = r.probe.counts.img || 0
    check(
      `${K} 夹具含 ${f.expectImg} 张普通插画且**真的被光栅化**（强饱和像素 ${r.longColor} 个）`,
      imgRectCount === f.expectImg && r.longColor > 20000,
      `img 矩形 ${imgRectCount} 个；长图彩色像素 ${r.longColor}`,
    )
    check(
      `${K} 夹具含 ≥${f.expectTr} 行表格（按行保护）`,
      (r.probe.counts.tr || 0) >= f.expectTr,
      `tr 矩形 ${r.probe.counts.tr || 0} 个`,
    )
    const ov = r.render.oversize || []
    check(
      `${K} 存在 ${f.expectOversize} 张超高页（oversize-unbreakable）且页高 > 目标页高`,
      ov.length === f.expectOversize && ov.every((o) => o.hPx > o.targetPx),
      JSON.stringify(ov.map((o) => ({ 起: o.startPx, 止: o.endPx, 高: o.hPx, 目标: o.targetPx, 因: o.reason }))),
    )
    // 超高插画整块保留：那张最高的 img 竖直范围必须完整落在某一页区间里
    const tallest = r.probe.oversizeGuard
    check(
      `${K} 超高插画整块落在同一页内（没有被切开）`,
      tallest && tallest.found,
      tallest ? tallest.detail : '(未采集到超高对象信息)',
    )
  }
  observe(`${K} 新切点`, r.newCutsCss.map((c, i) => `${i + 1}/${r.newCutsCss.length - 1}: ${c}CSS`).join(' '))
  observe(`${K} 产物路径`, info ? info.pages.join(' | ') : '(未落盘)')
  observe(`${K} 接缝图路径`, info ? (info.seams.join(' | ') || '(无内部切点)') : '(未落盘)')
}

// ── ④ 对照：证明检测器不是恒绿 ─────────────────────────────────────────────────────
if (control) {
  console.log(`\n[④ 对照：手写 HTML（960px 空白 + 文字压在 1000 + 300px 实心块 + 614px 空白 + 文字压在 2000）]`)
  const oldHits = control.oldCross.reduce((a, x) => a + x.hits.length, 0)
  check(`④ 对照组真实链路走通（前置条件）`, control.ok === true, `msg=${control.msg} err=${control.err}；正文 ${control.cssH} CSS px；分页 ${control.pageCount} 张`)
  check(
    `④ 探针在**旧固定切法**上必须报红（否则 ①②③ 的"无切口"不成立）`,
    oldHits >= 2 && control.oldCross.some((x) => x.c === 1000 && x.hits.length > 0),
    control.oldCross.map((x) => `${x.c}px:${JSON.stringify(x.hits)}`).join(' '),
  )
  check(
    `④ 新切法在**同一对照**上必须报绿`,
    control.newCross.every((x) => x.hits.length === 0),
    `新切点 ${JSON.stringify(control.newCutsCss)}；切口 ${control.newCross.reduce((a, x) => a + x.hits.length, 0)} 处`,
  )
  const cOldMax = Math.max(...control.seamInkOld.map((x) => x.cols || 0), 0)
  const cNewMax = Math.max(...control.seamInkNew.map((x) => x.cols || 0), 0)
  check(
    `④ 对照的逐像素口径也成立（旧切法跨缝有墨 ${cOldMax} 列 / 新切点 ${cNewMax} 列）`,
    cOldMax > 0 && cNewMax === 0,
    `旧 ${JSON.stringify(control.seamInkOld)}；新 ${JSON.stringify(control.seamInkNew)}`,
  )
  check(`④ 几何探针量到了对照对象`, control.rectCount >= 6, `受保护矩形 ${control.rectCount} 个`)
} else {
  check(`④ 探针在旧固定切法上必须报红`, false, '对照组没有采集到结果')
}

// ── 环境与未覆盖项的如实记录 ───────────────────────────────────────────────────────
observe(
  '带图正文在本 runner 的实测口径（2026-10-07 更正）',
  '旧记录称"Chromium 无法把含 <img> 的正文转图（EncodingError）"。本轮用同一台机器、同一 runner 复测：' +
    'chromium-1234 + playwright-core 1.63 下**内联 <svg>、data:image/png、data:image/svg+xml 的 <img> 都能正常光栅化**' +
    '（③ 夹具的两张插画就是生产 artRender 产出的 data:image/png，按强饱和像素计数确认真的画进了长图）。' +
    '因此"带图多页"在浏览器层面**已覆盖**；但真实 WebView2 的实机补证仍由父协调者执行，本脚本不据此声称实机通过。',
)
observe(
  '未覆盖条件',
  '① 上/下标、斜体伸出、粗体压边、box-shadow/text-shadow/filter、伪元素、旋转阴影：只按行盒 + 1 设备像素余量保护，未做通用 CSS 绘制边界分析；' +
    '② 复杂 rowspan/colspan 表格按 tr 行保护，不重复表头；③ 绝对定位装饰已按变换后矩形保护，但未做裁剪祖先分析；' +
    '④ 真实 WebView2 的实机分页观感与本机 Chromium 可能有字体/抗锯齿差异；⑤ 未启动桌面应用、未调用真实模型。',
)

if (pageErrors.length) judge.error('pageerror', pageErrors[0])
console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'EXPORT-PAGING' })
