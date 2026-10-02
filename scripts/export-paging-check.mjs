// export-paging-check.mjs —— **多页导出**的零模型验收（DS 修复指南 §0.0 P2.1）
//
// 用法：node scripts/export-paging-check.mjs [outDir] [URL]   （需先启动 dev server）
//
// 指南要求："固定长文夹具经真实 `renderArticleImages → exportArticleImages → export_images` 得到至少 3 页，
// 含可辨识页边界文字/图片；核对 750px 宽、末页、顺序、无缺页/重复、长图与拼接页一致，并目视边界切字/切图
// 和可读性。当前单页 PASS 不能改名为多页 PASS。"
//
// 因此这里**不重写渲染**：在真实浏览器里动态 import 生产模块，走真实调用链
//   `composeMarkdown(固定夹具) → html → exportArticleImages(html) → renderArticleImages → export_images`
// 唯一的替身是最后那步 Rust 落盘命令（本机不可能在浏览器里执行它）——本脚本把**真正传给它的文件清单**
// 抓下来，自己在临时目录写出这些 PNG，再做**独立于浏览器自述**的文件级核对（签名 / IHDR 宽高 / IEND / 张数）。
//
// 为什么必须有"对照组"：分页是"每 1000 CSS px 切一刀"，**天生会切开文字行**。所以本脚本把
//   · ① 真实长文（夹具，7 节 + 6 个列表/小节）
//   · ② 一张**故意跨页边界**的高图（手工构造的 HTML）
// 放在一起：② 用来证明"边界切口检测器"不是恒真（它必须报出这张图被切了），① 的切口统计才有意义。
//
// 判定（指南 §3.1）：唯一 RunResult；缺浏览器 = BLOCKED，零检查/异常 = ERROR，都退出非 0。

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJudge, guardCrashes, parseRunnerArgs, resolveOutDir } from './lib/run-result.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const FIXTURE = join(here, 'fixtures', '2026-10-02-longarticle', 'source.md')

const args = parseRunnerArgs()
const judge = createJudge({
  script: 'export-paging-check',
  outDir: resolveOutDir('export-paging-check', args.outDir),
  plannedCases: ['①', '②'],
  // 2026-10-02 实测 15 条（① 12 + ② 2 + 结构 1，条数稳定）；静默少跑一条就变红
  minChecks: 16,
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

const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromiumExe()
const base = args.base || 'http://127.0.0.1:1420'

if (!existsSync(FIXTURE)) judge.block(`找不到长文夹具：${FIXTURE}`)
const fixtureSource = existsSync(FIXTURE) ? readFileSync(FIXTURE, 'utf8') : ''
if (!judge.run.blockedReason) {
  console.log(`\n[夹具] ${FIXTURE}（${fixtureSource.length} 字符，冻结不改）`)
  observe('夹具', `${FIXTURE}；${fixtureSource.length} 字符；含 6 个「第 N 节」小节标记与列表，用于目视分页边界`)
}

/**
 * 页边界切口检测用的选择器。
 *
 * ⚠️ 不能照搬"标准 HTML"的选择器：compose 输出的是**微信兼容标记**——正文段落是 `<p>`，但标题、卡片、
 * 列表项都是 `<section>` 套 `<span>`（没有 `h1..h6`/`ul`/`li`）。2026-10-02 实测：用 `p,li,h1..h4`
 * 只能量到极少数元素，"0 处切口"是一句假话。所以这里按**实际标记**取，并在页内做"只留最内层内容块"
 * 的过滤（父容器与子元素同时跨线只算一次）。
 */
const CUT_SELECTORS = 'p,span,img,blockquote,section,li'

let result = null
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
      result = await page.evaluate(
        async ({ fixtureSource, cutSelectors }) => {
          const { composeMarkdown } = await import('/src/lib/compose.ts')
          const { exportArticleImages } = await import('/src/lib/exportImages.ts')

          const WIDTH = 375
          const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"

          /** 与 htmlToImage 同一套排版（量高/量元素位置用；不改产品代码、只测量） */
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
           * 内容块：`span`/`img` 本身就是最细的盒子；`section`/`p`/`li`/`blockquote` 只在**没有**
           * 更细的内容块时才计一次（避免"父容器 + 子段落"同时跨线被报成两处切口）。
           */
          const leafBlocks = (host) =>
            [...host.querySelectorAll(cutSelectors)].filter((el) => {
              const tag = el.tagName.toLowerCase()
              if (tag === 'img' || tag === 'span') return true
              return el.querySelector(cutSelectors) === null
            })

          /**
           * 边界切口检测：把内容块元素的竖直范围换算到 host 内坐标，
           * 看它有没有**跨过** 1000 CSS px 的整数倍（= 分页切线）。
           */
          const cutsOf = (host, pageCss) => {
            const top0 = host.getBoundingClientRect().top
            const cuts = []
            for (const el of leafBlocks(host)) {
              const r = el.getBoundingClientRect()
              const top = r.top - top0
              const bottom = r.bottom - top0
              if (bottom - top < 1) continue
              const k = Math.floor(top / pageCss) + 1
              if (k * pageCss > top + 0.5 && k * pageCss < bottom - 0.5) {
                cuts.push({
                  y: Math.round(k * pageCss),
                  tag: el.tagName.toLowerCase(),
                  text: String(el.textContent || '').replace(/\s+/g, ' ').slice(0, 40),
                  height: Math.round(bottom - top),
                  crossPx: Math.round(bottom - k * pageCss),
                })
              }
            }
            return cuts
          }
          /** 「第 N 节」标记落在哪一页（给目视用） */
          const markersOf = (host, pageCss) => {
            const top0 = host.getBoundingClientRect().top
            const out = []
            for (const el of leafBlocks(host)) {
              const t = String(el.textContent || '').replace(/\s+/g, ' ')
              const m = /第\s*(\d+)\s*节\s*·\s*([^\s，。]{1,10})/.exec(t)
              if (!m) continue
              const y = Math.round(el.getBoundingClientRect().top - top0)
              out.push({ label: `第 ${m[1]} 节 ${m[2]}`, y, page: Math.floor(y / pageCss) + 1 })
            }
            return out
          }
          /** 每页"有墨"的像素占比：0 就是空白页（分页错位/丢内容时会出现） */
          const inkRatio = (ctx, w, h) => {
            const d = ctx.getImageData(0, 0, w, h).data
            let ink = 0
            for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) ink++
            return ink / (w * h)
          }
          /** 把分页逐张拼回一张，与长图逐像素比 —— 不一致的像素数 */
          const stitchDiff = (longCv, pagesCv) => {
            const lctx = ctxOf(longCv)
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
            const a = lctx.getImageData(0, 0, longCv.width, longCv.height).data
            const b = sctx.getImageData(0, 0, longCv.width, longCv.height).data
            let diff = 0
            for (let i = 0; i < a.length; i += 4) {
              if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++
            }
            return { heightMismatch: 0, diff }
          }

          const out = { pageErrors: [], cases: {} }

          // ── ① 真实长文：走真实 compose → exportArticleImages → export_images 链路 ──────────
          {
            const composed = composeMarkdown(fixtureSource, {})
            const html = composed.html
            const invokes = []
            const prevInternals = window.__TAURI_INTERNALS__
            window.__TAURI_INTERNALS__ = {
              ...(prevInternals || {}),
              invoke: async (cmd, payload) => {
                invokes.push({ cmd, name: payload && payload.name, files: (payload && payload.files) || [] })
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
            const longFile = files.find((f) => /长图\.png$/.test(f.name)) || null
            const pageFiles = files.filter((f) => !/长图\.png$/.test(f.name))

            // 用真实 renderArticleImages 的**同一路径**再拿一份画布做像素核对：
            // exportArticleImages 内部已经渲染过一次，这里从它交出的 data URL 还原。
            const longCv = longFile ? await dataUrlToCanvas(longFile.data) : null
            const pagesCv = []
            for (const f of pageFiles) pagesCv.push(await dataUrlToCanvas(f.data))

            // 元素级边界切口（用与产品相同的排版重新挂一次 DOM 来量位置）
            const host = mount(html)
            await paint(host)
            const cssH = Math.ceil(host.getBoundingClientRect().height)
            const pageCss = pagesCv.length ? pagesCv[0].height / 2 : 1000
            const cuts = cutsOf(host, pageCss)
            const markers = markersOf(host, pageCss)
            // ⚠️ 探针必须在 `host.remove()` **之前**取样：元素一旦脱离文档，`getBoundingClientRect()`
            // 全部返回 0，量出来的"0 处切口"就是假象（2026-10-02 实测踩到过：探针写在了 remove 之后，
            // 报出 elCount=2 / hostH=0）。这条断言的作用就是钉住"几何测量真的量到了东西"。
            const probeTop = host.getBoundingClientRect().top
            const probeBlocks = leafBlocks(host)
            const probe = {
              elCount: probeBlocks.length,
              hostTop: Math.round(probeTop),
              hostH: Math.round(host.getBoundingClientRect().height),
              samples: probeBlocks.slice(0, 6).map((el) => {
                const r = el.getBoundingClientRect()
                return { tag: el.tagName.toLowerCase(), top: Math.round(r.top - probeTop), bottom: Math.round(r.bottom - probeTop) }
              }),
            }
            host.remove()

            const ink = pagesCv.map((c) => inkRatio(ctxOf(c), c.width, c.height))
            const st = longCv ? stitchDiff(longCv, pagesCv) : { heightMismatch: null, diff: null }

            out.cases.real = {
              composeIssues: (composed.issues || []).length,
              composeWarnings: (composed.warnings || []).length,
              composeIssueList: (composed.issues || []).map((i) => ({
                code: i.code,
                severity: i.severity,
                line: i.line,
                message: String(i.message || '').slice(0, 120),
              })),
              htmlLen: html.length,
              exportOk: exported && exported.ok,
              exportMsg: exported && exported.msg,
              exportErr,
              invokes: invokes.map((i) => ({ cmd: i.cmd, name: i.name, fileCount: i.files.length })),
              fileNames: files.map((f) => f.name),
              longBytes: longFile ? longFile.data.length : 0,
              pageBytes: pageFiles.map((f) => f.data.length),
              payload: files.map((f) => ({ name: f.name, data: f.data })),
              cssH,
              probe,
              longW: longCv ? longCv.width : 0,
              longH: longCv ? longCv.height : 0,
              pageW: pagesCv.map((c) => c.width),
              pageH: pagesCv.map((c) => c.height),
              ink,
              cuts,
              markers,
              stitch: st,
            }
          }

          // ── ② 对照：一张**故意跨过第一条分页线**的高图（证伪"切口检测器恒真"） ──────────
          {
            // **确定性**对照：用显式高度的空块把内容精确推到切线前，再放一个 240px 高的内容块，
            // 让它的竖直范围正好跨过第一条 1000 CSS px 切线（960 + 240 = 1200 > 1000）。
            //
            // ⚠️ 这里用**块元素**而不是 `<img>`：本 runner 跑在 playwright 的 Chromium 里，而
            // Chromium 不允许"SVG 当图片"（`renderArticleImages` 的外层就是 `<img src="data:image/svg+xml…">`）
            // 内部再嵌图片——实测只要正文含任何 `<img>`，整篇转图就以
            // `EncodingError: The source image cannot be decoded` 失败（headless 与 headed 都一样）。
            // **这是驱动环境的限制，不是产品缺陷**：真实 WebView2 能渲染含插画的正文
            // （已用真实导出成品核对：750×1300 长图里强饱和像素占 12.21%，纯文字页远达不到），
            // 所以"带图的多页"不在本 runner 的覆盖范围内，另行记录为未覆盖项。
            // 用 `blockquote`（在切口检测器的选择器清单里）而不是裸 `div`：检测器只统计"内容块"级元素，
            // 容器 div 会淹没报告。高度显式给足，位置才可复现。
            const block = '<blockquote style="height:240px;margin:0;background:#dfeede"></blockquote>'
            const html =
              `<div style="padding:0;font-size:16px;line-height:1.8">` +
              `<div style="height:960px;background:#f4f4f4"></div>${block}<p style="margin:0">对照块之后的段落。</p></div>`

            // 用真实 renderArticleImages（经 exportArticleImages）拿分页结果，再量元素位置
            const invokes = []
            const prevInternals = window.__TAURI_INTERNALS__
            window.__TAURI_INTERNALS__ = {
              ...(prevInternals || {}),
              invoke: async (cmd, payload) => {
                invokes.push({ cmd, name: payload && payload.name, files: (payload && payload.files) || [] })
                return 'STUB-DIR::' + ((payload && payload.name) || '')
              },
            }
            let ctlExport = null
            let ctlErr = null
            try {
              ctlExport = await exportArticleImages(html)
            } catch (e) {
              ctlErr = String((e && e.message) || e)
            }
            window.__TAURI_INTERNALS__ = prevInternals
            const call = invokes.find((i) => i.cmd === 'export_images')
            const files = call ? call.files : []
            const pageFiles = files.filter((f) => !/长图\.png$/.test(f.name))
            const pagesCv = []
            for (const f of pageFiles) pagesCv.push(await dataUrlToCanvas(f.data))

            const host = mount(html)
            await paint(host)
            const pageCss = pagesCv.length ? pagesCv[0].height / 2 : 1000
            const cuts = cutsOf(host, pageCss)
            host.remove()
            out.cases.control = {
              pageCount: pagesCv.length,
              pageCss,
              cuts,
              exportOk: ctlExport && ctlExport.ok,
              exportMsg: ctlExport && ctlExport.msg,
              exportErr: ctlErr,
            }
          }

          out.pageErrors = []
          return out
        },
        { fixtureSource, cutSelectors: CUT_SELECTORS },
      )
    }
  } catch (e) {
    judge.error('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

// =====================================================================================
const outDir = judge.run.outDir || resolveOutDir('export-paging-check', args.outDir)
let written = null
if (result && result.cases && result.cases.real) {
  const real = result.cases.real
  const dir = join(outDir, 'pages')
  try {
    mkdirSync(dir, { recursive: true })
    written = []
    for (const f of real.payload || []) {
      const p = join(dir, f.name)
      writeFileSync(p, Buffer.from(String(f.data).replace(/^data:image\/png;base64,/, ''), 'base64'))
      written.push(p)
    }
  } catch (e) {
    judge.error('persist', `写 PNG 失败：${String((e && e.message) || e)}`)
  }
}

/** 独立于浏览器自述的文件级核对：签名 / IHDR 宽高 / IEND / 是否可被 Node 读回 */
function pngInfo(buf) {
  const sigOk = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const ihdrOk = buf.length > 33 && buf.subarray(12, 16).toString('latin1') === 'IHDR'
  const w = ihdrOk ? buf.readUInt32BE(16) : 0
  const h = ihdrOk ? buf.readUInt32BE(20) : 0
  const iendOk = buf.length >= 12 && buf.subarray(buf.length - 8, buf.length - 4).toString('latin1') === 'IEND'
  return { sigOk, ihdrOk, iendOk, w, h }
}

if (result && result.cases && result.cases.real) {
  const real = result.cases.real
  const pageCount = real.pageH.length
  console.log(`\n[① 真实长文：compose → exportArticleImages → export_images]`)
  console.log(
    `  正文 CSS 高 ${real.cssH}px；长图 ${real.longW}×${real.longH}；分页 ${pageCount} 张，高度 ${JSON.stringify(real.pageH)}`,
  )

  // 夹具是纯文字长文，compose 会给 `quality.no-art` / `quality.low-structure` 之类的**质量提示**（severity=warning）——
  // 那不是解析失败。这里要求的是"没有解析/阻断级问题"，并在观测里如实记录全部提示。
  const blockingIssues = (real.composeIssueList || []).filter((i) => i.severity !== 'warning' && i.severity !== 'info')
  if (real.composeIssueList && real.composeIssueList.length)
    observe('① compose 质量提示（非阻断）', JSON.stringify(real.composeIssueList))
  check('① compose 没有解析/阻断级问题（夹具本身是合法 v2）', blockingIssues.length === 0, `阻断=${blockingIssues.length}；全部=${JSON.stringify(real.composeIssueList)}`)
  check('① 真实链路走通：exportArticleImages 返回 ok', real.exportOk === true && !real.exportErr, `${real.exportMsg}${real.exportErr ? ' ERR=' + real.exportErr : ''}`)
  check(
    '① export_images 收到的文件清单 = 1 张长图 + N 张分页（命名带序号）',
    real.invokes.length === 1 &&
      real.invokes[0].cmd === 'export_images' &&
      real.fileNames.filter((n) => /长图\.png$/.test(n)).length === 1 &&
      real.fileNames.length === pageCount + 1 &&
      real.fileNames.slice(1).every((n, i) => n.endsWith(`-${String(i + 1).padStart(2, '0')}.png`)),
    JSON.stringify(real.fileNames),
  )
  check(`① **至少 3 页**（指南要求；实际 ${pageCount} 页）`, pageCount >= 3, `分页 ${pageCount} 张`)
  check('① 长图与每一页宽度都是 750px', real.longW === 750 && real.pageW.every((w) => w === 750), `长图 ${real.longW}；分页 ${JSON.stringify(real.pageW)}`)
  check(
    '① 无缺页 / 无重复：所有分页高度相加 = 长图高度，且每页都是整切（末页可不足）',
    real.pageH.every((h, i) => h === (i === pageCount - 1 ? real.longH - i * real.pageH[0] : real.pageH[0])) &&
      real.pageH.reduce((a, b) => a + b, 0) === real.longH,
    `页码高度 ${JSON.stringify(real.pageH)} 求和=${real.pageH.reduce((a, b) => a + b, 0)} 长图=${real.longH}`,
  )
  check(
    '① 末页存在且高度 = 长图高 - (页数-1)×页高（>0）',
    pageCount >= 1 && real.pageH[pageCount - 1] === real.longH - (pageCount - 1) * real.pageH[0] && real.pageH[pageCount - 1] > 0,
    `末页高 ${real.pageH[pageCount - 1]}`,
  )
  check('① **顺序正确**：分页逐张拼回后与长图逐像素一致', real.stitch.diff === 0 && real.stitch.heightMismatch === 0, JSON.stringify(real.stitch))
  check('① 每一页都有可见内容（没有空白页）', real.ink.every((r) => r > 0.001), JSON.stringify(real.ink.map((r) => +(r * 100).toFixed(2))))
  check('① 每页"有墨"比例反映真实排版（不是整页纯色）', real.ink.every((r) => r < 0.9), JSON.stringify(real.ink.map((r) => +(r * 100).toFixed(1))))

  if (written && written.length) {
    const infos = written.map((p) => ({ p, ...pngInfo(readFileSync(p)) }))
    check(
      '① 落盘的 PNG 文件独立核对通过（签名 + IHDR + IEND 齐全）',
      infos.length === pageCount + 1 && infos.every((i) => i.sigOk && i.ihdrOk && i.iendOk),
      infos.map((i) => `${i.w}×${i.h}`).join(' | '),
    )
    check(
      '① 落盘文件的像素尺寸与浏览器自述一致（宽度都 750）',
      infos.every((i) => i.w === 750) && infos[0].h === real.longH && infos.slice(1).every((i, k) => i.h === real.pageH[k]),
      `长图 ${infos[0].w}×${infos[0].h}；分页 ${infos.slice(1).map((i) => i.h).join(',')}`,
    )
  } else {
    check('① 落盘的 PNG 文件独立核对通过（签名 + IHDR + IEND 齐全）', false, '没有写出任何 PNG')
  }

  console.log(`\n[① 页边界切口统计（目视用，不是判定项）]`)
  if (real.cuts.length === 0) {
    observe('① 页边界切口', `0 处：${pageCount} 页之间没有任何内容块跨过分页线（正文共 ${real.cssH} CSS px）`)
  } else {
    observe(
      '① 页边界切口',
      `${real.cuts.length} 处内容块跨过分页线（固定 1000 CSS px 切分的天生行为，需人工目视是否可接受）：` +
        real.cuts.map((c) => `${c.y}px 处 <${c.tag}> 被切 ${c.crossPx}px「${c.text}」`).join('；'),
    )
  }
  observe('① 小节标记落页', real.markers.map((m) => `${m.label} → 第 ${m.page} 页（y=${m.y}）`).join('；') || '(未识别到标记)')
  observe('① 产物路径', written && written.length ? written.join(' | ') : '(未落盘)')

  check('① 边界切口统计已产出且给出可核对的结构', Array.isArray(real.cuts) && Array.isArray(real.markers), `cuts=${real.cuts.length} markers=${real.markers.length}`)
  // 这条是"切口统计可信"的前提：几何测量必须真的量到内容块，且宿主高度与渲染高度对得上。
  // 量不到元素时 cuts 恒为 0，"0 处切口"就会变成一句假话。
  check(
    '① 几何测量可用（量到内容块，且宿主高度与转图高度一致）',
    real.probe && real.probe.elCount > 20 && Math.abs(real.probe.hostH - real.cssH) <= 2,
    JSON.stringify(real.probe),
  )
}

if (result && result.cases && result.cases.control) {
  const c = result.cases.control
  console.log(`\n[② 对照：一张故意跨过分页线的高图（证明切口检测器能报红）]`)
  check(
    '② 对照组确实生成了分页（前置条件）',
    c.pageCount >= 2,
    `分页 ${c.pageCount} 张，页高 ${c.pageCss * 2}px；ok=${c.exportOk} msg=${c.exportMsg} err=${c.exportErr}`,
  )
  observe(
    '② 未覆盖项：正文含 `<img>` 的多页导出',
    '本 runner 的 Chromium 无法把含图片的正文转图（EncodingError：SVG 当图片时不能再嵌图片），' +
      '所以这里用块元素做切口对照。真实 WebView2 可以（L6 的真实导出成品里强饱和像素占 12.21%），' +
      '但"带图多页"需要真实 WebView2 驱动才能覆盖，本轮如实记为未覆盖。',
  )
  check(
    '② 检测器**必须**报出那个跨线内容块被切开（否则 ① 的"无切口"不成立）',
    c.cuts.some((x) => x.tag === 'blockquote' && x.y === 1000 && x.height === 240),
    JSON.stringify(c.cuts.slice(0, 3)),
  )
}

if (pageErrors.length) judge.error('pageerror', pageErrors[0])
console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'EXPORT-PAGING' })
