// raster-check.mjs —— 素材"真实显示尺寸"栅格检查的**校准与断言**（修复计划阶段 5，2026-09-28）
// 用法：node scripts/raster-check.mjs [URL] [--out <目录>]   （需先启动 dev server，默认 http://127.0.0.1:1420）
//
// 为什么用浏览器：栅格检查要真的把 SVG 画到 canvas 上数像素，node 里没有 canvas。
// 做法是从**已经跑起来的 Vite dev server** 里动态 import 真实模块（`/src/lib/svg-raster.ts`），
// 因此断言的是产品代码本身，不是复刻实现。
//
// 输出一张实测表（每个样例的 真实尺寸主体像素 / 对比度 / 右下占比），并据此断言：
//   · 合格样例必须通过；
//   · "浅色消失"与"缩成一个小点"两类退化必须被拦下；
//   · 真实库素材（bud / star / 四叶草）的数值要记录在案——它们**不会被批量重画**（库素材不经过
//     本层复检），记录它们是为了说明阈值落在哪里、以及哪些素材属于"薄弱但可用"。
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult → run-result.json + 退出码。
// 缺浏览器/解析不到 playwright = BLOCKED（退出 2）；导航失败或脚本抛异常 = ERROR；零条检查 = ERROR。
import { createRequire } from 'module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { createJudge, guardCrashes, parseRunnerArgs, resolveOutDir } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
// minChecks：原有栅格校准 8 条 + R31 DOM 尺寸 9 条 + R32 XHTML 导出 10 条。
const judge = createJudge({ script: 'raster-check', outDir: resolveOutDir('raster-check'), minChecks: 27 })
guardCrashes(judge)

/** playwright 模块：本机安装或 VERIFY_PLAYWRIGHT；不可用则明确 BLOCKED。 */
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
  } else {
    tried.push('VERIFY_PLAYWRIGHT → 未设置')
  }
  judge.block(`解析不到 playwright 模块。已尝试：\n  - ${tried.join('\n  - ')}`)
  judge.finish({ exitCode: 2 })
  process.exit(2)
}
/** chromium 可执行文件：VERIFY_CHROMIUM 优先，否则交给 Playwright 解析。 */
function resolveChromiumExe() {
  const env = process.env.VERIFY_CHROMIUM
  if (env) {
    const target = isAbsolute(env) ? env : resolve(process.cwd(), env)
    if (!existsSync(target)) {
      judge.block(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
      judge.finish({ exitCode: 2 })
      process.exit(2)
    }
    return target
  }
  return null
}
const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromiumExe()

// URL 不能直接取 `process.argv[2]`：脚本同时认 `--out <dir>`，两种写法混用会让位置参数整体前移，
// `--out` 自己变成 URL → `page.goto('--out')` → "Cannot navigate to invalid URL"（实测：整脚本 0 条检查、
// 报 ERROR，看起来像"栅格检查坏了"）。改由共享的"长得像不像 URL"解析，两种写法都写对。
const { base: url } = parseRunnerArgs()
const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(here, 'fixtures', 'deco-calibration')

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

let browser = null
try {
  browser = await chromium.launch({ ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
} catch (e) {
  judge.block(`浏览器启动失败：${String(e.message || e).split('\n')[0]}`)
  judge.finish({ exitCode: 2 })
  process.exit(2)
}
const page = await browser.newPage()

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('textarea', { timeout: 20000 })

  /** 在页面里跑真实的 rasterStats + checkRaster（角饰按 60px 宽、白底） */
  const probe = async (svg, targetWidth = 60) =>
    page.evaluate(
      async ([s, w]) => {
        const raster = await import('/src/lib/svg-raster.ts')
        const st = await raster.rasterStats(s, { targetWidth: w, background: '#ffffff' })
        if (!st) return null
        return { ...st, reasons: raster.checkRaster(st, 'deco') }
      },
      [svg, targetWidth],
    )

  const cases = [
    ['clear.svg', '合格：单一实心主体、颜色够深、集中在右下', true],
    ['bud.svg', '真实库素材：花苞角饰（薄弱样例）', null],
    ['star.svg', '真实库素材：星星角饰（薄弱样例）', null],
    ['clover.svg', '真实库素材：四叶草角饰（缩放比例 1:1，300 画布）', null],
    ['faint.svg', '退化：颜色接近白色（浅色在浅底上会消失）', false],
    ['dot.svg', '退化：主体缩到 60px 只剩几个点', false],
  ]

  console.log('[角饰在 60px 显示尺寸下的实测]')
  console.log('  样例           主体短边(px)  对比度  对比度P90  右下占比  判定')
  const rows = []
  for (const [file, label, expectOk] of cases) {
    const svg = readFileSync(join(fixtureDir, file), 'utf8')
    const st = await probe(svg)
    if (!st) {
      check(`${file} 可栅格化`, false, 'rasterStats 返回 null')
      continue
    }
    const ok = st.reasons.length === 0
    rows.push({ file, label, st, ok, expectOk })
    console.log(
      `  ${file.padEnd(14)}${String(st.subjectPx.toFixed(1)).padStart(9)}${String(st.contrast.toFixed(1)).padStart(9)}` +
        `${String(st.contrastP90.toFixed(1)).padStart(11)}${String(Math.round(st.quadrants[3] * 100) + '%').padStart(9)}   ${ok ? '通过' : '拦下'}`,
    )
    // 原来这里有一个 `if (ok) check(... , true) else console.log(...)` 的分支：条件 `ok` 本身就是
    // 要被断言的内容，为假时只打印一行、不计失败——这一行只可能输出 PASS，是纯装饰。
    // 删除；本样例的职责由下方 `r.expectOk` 循环（必须通过 / 必须被拦下）承担。
  }

  console.log('')
  for (const r of rows) {
    if (r.expectOk === null) continue
    if (r.expectOk) {
      check(`${r.file} 必须通过（${r.label}）`, r.ok, r.ok ? '' : r.st.reasons.join('；'))
    } else {
      check(`${r.file} 必须被拦下（${r.label}）`, !r.ok, r.ok ? '未被拦下' : r.st.reasons[0])
    }
  }

  // 阈值必须真的落在"合格"与"退化"之间——否则阈值形同虚设
  const clear = rows.find((r) => r.file === 'clear.svg')
  const faint = rows.find((r) => r.file === 'faint.svg')
  const dot = rows.find((r) => r.file === 'dot.svg')
  if (clear && faint) {
    check('主体对比度（P90）能区分合格与浅色退化', clear.st.contrastP90 > faint.st.contrastP90 * 3, `P90 ${clear.st.contrastP90.toFixed(1)} vs ${faint.st.contrastP90.toFixed(1)}`)
    check('极淡的氛围光斑不会把主体判成看不见（star 真实样例）', (rows.find((r) => r.file === 'star.svg')?.ok ?? false), 'star 的 P90 应达标')
  }
  if (clear && dot) {
    check('主体像素能区分合格与"一个小点"', clear.st.subjectPx > dot.st.subjectPx * 2, `${clear.st.subjectPx.toFixed(1)} vs ${dot.st.subjectPx.toFixed(1)}`)
  }

  // 库素材的实测值只记录、不判定（阶段 5 验收项 4：既有库存不被批量静默重画）
  console.log('\n[真实库素材实测（仅记录；库素材不经过本层复检，不会被重画）]')
  for (const r of rows.filter((x) => x.expectOk === null)) {
    console.log(
      `  ${r.file}：主体 ${r.st.subjectPx.toFixed(1)}px｜对比度 ${r.st.contrast.toFixed(1)}｜P90 ${r.st.contrastP90.toFixed(1)}｜${r.ok ? '按当前阈值通过' : '按当前阈值会被拦下：' + r.st.reasons[0]}`,
    )
  }

  // 同一素材在不同显示尺寸下的判定必须不同：这正是"按真实尺寸检查"的意义
  const clover = readFileSync(join(fixtureDir, 'clover.svg'), 'utf8')
  const at60 = await probe(clover, 60)
  const at256 = await probe(clover, 256)
  if (at60 && at256) {
    check('按真实尺寸（60px）与按 256px 的度量确实不同', at60.subjectPx < at256.subjectPx, `60px→${at60.subjectPx.toFixed(1)}｜256px→${at256.subjectPx.toFixed(1)}`)
    check('主体像素随显示宽度等比缩放', Math.abs(at256.subjectPx / at60.subjectPx - 256 / 60) < 0.2, `ratio=${(at256.subjectPx / at60.subjectPx).toFixed(2)}`)
  }

  // R31：正文插画与角饰不是同一个尺寸。走真实 compose → PNG 占位替换 → DOM，
  // 在独立 iframe 内测量，既不继承工作台 CSS，也不改写生产输出的图片样式。
  // bud.svg 是现有 300×200 非正方形合法夹具，同时用于 inline 与 TIP deco：
  // 固定高度拉伸、全局把所有图放大，以及旧 179px 上限都能被下面的断言抓到。
  console.log('\n[正文插画与角饰的真实 DOM 尺寸]')
  const layoutProbe = await page.evaluate(async (svg) => {
    const { composeMarkdown } = await import('/src/lib/compose.ts')
    const { renderArtPlaceholders } = await import('/src/lib/artRender.ts')
    const source = [
      '[[boxes:radius=0;frame=line;shape=rail;mark=none]]',
      '# 插画尺寸回归',
      '正文插画用于解释内容，角饰只提示重点。',
      '::: art inline R31正文插画', svg, ':::',
      '::: art deco r31deco', svg, ':::',
      '> [!TIP|r31deco] 检查两种用途\n> 正文插画随阅读宽度调整，角饰保持小尺寸。',
    ].join('\n\n')
    const composed = composeMarkdown(source, { mode: 'text' })
    const rendered = await renderArtPlaceholders(composed.html, composed.arts)
    const viewBox = /viewBox="\s*[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)"/.exec(svg)
    if (!viewBox) throw new Error('R31 fixture has no viewBox')
    const expectedRatio = Number(viewBox[1]) / Number(viewBox[2])
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:absolute;left:0;top:0;width:375px;height:1200px;border:0;display:block'
    try {
      await new Promise((done, fail) => {
        const timer = setTimeout(() => fail(new Error('R31 layout iframe load timeout')), 5000)
        frame.onload = () => { clearTimeout(timer); done() }
        frame.onerror = () => { clearTimeout(timer); fail(new Error('R31 layout iframe failed')) }
        frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style></head><body>' + rendered + '</body></html>'
        document.body.appendChild(frame)
      })
      const doc = frame.contentDocument
      const win = frame.contentWindow
      if (!doc || !win) throw new Error('R31 layout iframe document unavailable')
      const images = Array.from(doc.images)
      await Promise.all(images.map((img) => img.decode()))
      const article = doc.body.firstElementChild
      const inline = doc.querySelector('img[alt="R31正文插画"]')
      const deco = doc.querySelector('img[alt=""]')
      if (!article || !inline || !deco) throw new Error('R31 production output is missing article, inline image, or TIP deco')
      const dimensions = []
      const measureImage = (img) => {
        const rect = img.getBoundingClientRect()
        return { width: rect.width, height: rect.height, left: rect.left, right: rect.right, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
      }
      for (const viewportWidth of [375, 320]) {
        frame.style.width = viewportWidth + 'px'
        await new Promise((done) => win.requestAnimationFrame(() => win.requestAnimationFrame(done)))
        const rect = article.getBoundingClientRect()
        const style = win.getComputedStyle(article)
        const contentLeft = rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)
        const contentRight = rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight)
        dimensions.push({
          viewportWidth, articleWidth: rect.width, contentWidth: contentRight - contentLeft,
          contentLeft, contentRight, scrollWidth: doc.documentElement.scrollWidth,
          inline: measureImage(inline), deco: measureImage(deco),
        })
      }
      return {
        expectedRatio, artCount: composed.arts.length, rejectedArts: composed.rejectedArts.length,
        imageCount: images.length, loaded: images.every((img) => img.complete && img.naturalWidth > 0),
        unresolved: /@@ART\d+@@/.test(rendered), dimensions,
      }
    } finally {
      frame.remove()
    }
  }, readFileSync(join(fixtureDir, 'bud.svg'), 'utf8'))
  judge.observe('R31 compose→renderArtPlaceholders→DOM 实测', JSON.stringify(layoutProbe))
  check('生产链保留并加载正文插画与 TIP 角饰两张图',
    layoutProbe.artCount === 2 && layoutProbe.rejectedArts === 0 && layoutProbe.imageCount === 2 && layoutProbe.loaded && !layoutProbe.unresolved)
  const closeTo = (actual, expected) => Math.abs(actual - expected) <= 0.5
  for (const row of layoutProbe.dimensions) {
    const expectedWidth = row.viewportWidth === 375 ? 300 : 288
    const insideContent = row.inline.left >= row.contentLeft - 0.5 && row.inline.right <= row.contentRight + 0.5
    check(`${row.viewportWidth}px 文章宽度与正文内容区符合实际容器`,
      closeTo(row.articleWidth, row.viewportWidth) && closeTo(row.contentWidth, row.viewportWidth - 32),
      `文章 ${row.articleWidth}px，内容区 ${row.contentWidth}px`)
    check(`${row.viewportWidth}px 下正文插画显示 ${expectedWidth}px 且无横向溢出`,
      closeTo(row.inline.width, expectedWidth) && insideContent && row.scrollWidth <= row.viewportWidth,
      `插画 ${row.inline.width}×${row.inline.height}px，页面 scrollWidth=${row.scrollWidth}px`)
    check(`${row.viewportWidth}px 下正文插画保持原始宽高比`,
      Math.abs(row.inline.width / row.inline.height - layoutProbe.expectedRatio) < 0.01 &&
        Math.abs(row.inline.naturalWidth / row.inline.naturalHeight - layoutProbe.expectedRatio) < 0.01,
      `显示比例 ${(row.inline.width / row.inline.height).toFixed(3)}，原始比例 ${layoutProbe.expectedRatio.toFixed(3)}`)
    check(`${row.viewportWidth}px 下 TIP 角饰仍为 60px 且不拉伸`,
      closeTo(row.deco.width, 60) && Math.abs(row.deco.width / row.deco.height - layoutProbe.expectedRatio) < 0.01,
      `角饰 ${row.deco.width}×${row.deco.height}px`)
  }
  // R32: local-image materialization returns ordinary HTML (void tags have no slash).
  // Exercise the real exporter with PNG/JPEG originals, decoration, entities and void
  // elements. Only native file IO is replaced; image decoding/rasterization is real.
  const xhtmlProbe = await page.evaluate(async () => {
    const { renderArticleImages } = await import('/src/lib/htmlToImage.ts')
    const { exportArticleImages } = await import('/src/lib/exportImages.ts')
    const makeImage = (color, mime) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 48
      const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 48)
      return c.toDataURL(mime)
    }
    const originals = [makeImage('#e62020', 'image/png'), makeImage('#205ce6', 'image/jpeg'), makeImage('#209b45', 'image/png')]
    const html = `<section style="padding:12px;background:#fff"><p>A &amp; B&nbsp;读书会<br>第二行 &lt;原图&gt; "引号"</p><hr><img src="${originals[0]}" alt="PNG &amp; &quot;原图&quot;" style="width:120px;height:auto;display:block"><IMG SRC='${originals[1]}' alt='JPEG 原图' style='width:120px;height:auto;display:block'><span><img src="${originals[2]}" alt="角饰" style="width:60px;height:auto"></span><p>尾部文字</p></section>`
    const rawXmlInvalid = !!new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`, 'image/svg+xml').querySelector('parsererror')
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    const hadNative = Object.prototype.hasOwnProperty.call(window, '__TAURI_INTERNALS__'), originalNative = window.__TAURI_INTERNALS__
    const calls = []; let serialized = ''
    Object.defineProperty(HTMLImageElement.prototype, 'src', { ...srcDescriptor, set(value) {
      if (String(value).startsWith('data:image/svg+xml;charset=utf-8,')) serialized = decodeURIComponent(String(value).split(',').slice(1).join(','))
      srcDescriptor.set.call(this, value)
    } })
    window.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => { calls.push({ cmd, files: args?.files }); return 'isolated-fixture-export' } }
    try {
      const rendered = await renderArticleImages(html)
      const parsed = new DOMParser().parseFromString(serialized, 'image/svg+xml')
      const nodes = [...parsed.querySelectorAll('img')]
      const long = new Image(); long.src = rendered.long; await long.decode()
      const c = document.createElement('canvas'); c.width = long.naturalWidth; c.height = long.naturalHeight
      const ctx = c.getContext('2d'); ctx.drawImage(long, 0, 0)
      const rgba = ctx.getImageData(0, 0, c.width, c.height).data
      let red = 0, blue = 0, green = 0
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i] > 180 && rgba[i + 1] < 90 && rgba[i + 2] < 90) red++
        if (rgba[i] < 90 && rgba[i + 1] < 140 && rgba[i + 2] > 180) blue++
        if (rgba[i] < 90 && rgba[i + 1] > 110 && rgba[i + 2] < 110) green++
      }
      const exported = await exportArticleImages(html)
      const files = calls.filter(x => x.cmd === 'export_images').flatMap(x => x.files || [])
      const fileDimensions = await Promise.all(files.map(async f => { const im = new Image(); im.src = f.data; await im.decode(); return { width: im.naturalWidth, height: im.naturalHeight } }))
      return { rawXmlInvalid, error: null, xmlValid: !parsed.querySelector('parsererror'), entities: parsed.documentElement.textContent.includes('A & B\u00a0读书会') && parsed.documentElement.textContent.includes('<原图>'), voidCounts: [nodes.length, parsed.querySelectorAll('br').length, parsed.querySelectorAll('hr').length], originalsPreserved: nodes.every((n, i) => n.getAttribute('src') === originals[i]), red, blue, green, width: c.width, height: c.height, exported: exported.ok, exportCalls: calls.filter(x => x.cmd === 'export_images').length, fileDimensions }
    } catch (e) { return { rawXmlInvalid, error: String(e) } }
    finally {
      Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor)
      if (hadNative) window.__TAURI_INTERNALS__ = originalNative; else delete window.__TAURI_INTERNALS__
    }
  })
  judge.observe('R32 XHTML 真实转图与导出', JSON.stringify(xhtmlProbe))
  check('HTML 直接嵌入 XML 的旧实现会失败（证红）', xhtmlProbe.rawXmlInvalid)
  check('普通 HTML 混合原图能够完整转图', !xhtmlProbe.error, xhtmlProbe.error || '')
  check('转图实际使用的 SVG 是合法 XML', xhtmlProbe.xmlValid)
  check('实体、空格和尖括号文字保持语义', xhtmlProbe.entities)
  check('三张图、换行与分割线均保留', JSON.stringify(xhtmlProbe.voidCounts) === '[3,1,1]')
  check('PNG/JPEG 原图与角饰数据字节不变', xhtmlProbe.originalsPreserved)
  check('成品 PNG 实际包含两张原图及角饰颜色', xhtmlProbe.red > 1000 && xhtmlProbe.blue > 1000 && xhtmlProbe.green > 1000, `red=${xhtmlProbe.red} blue=${xhtmlProbe.blue} green=${xhtmlProbe.green}`)
  check('混合原图长图为 750px 且非空', xhtmlProbe.width === 750 && xhtmlProbe.height > 0)
  check('真实导出链产生一次落盘请求及长图和分页', xhtmlProbe.exported && xhtmlProbe.exportCalls === 1 && xhtmlProbe.fileDimensions?.length >= 2)
  check('提交落盘的所有 PNG 均可解码且宽度一致', xhtmlProbe.fileDimensions?.length >= 2 && xhtmlProbe.fileDimensions.every(d => d.width === 750 && d.height > 0))
} catch (e) {
  console.log('  FAIL - raster-check error:', String(e).slice(0, 300))
  failed++
  judge.error('runner', String(e).slice(0, 300))
}

await browser.close()
judge.finish({ label: 'RASTER' })
