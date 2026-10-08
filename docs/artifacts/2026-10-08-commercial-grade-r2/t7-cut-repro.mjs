// t7-cut-repro.mjs —— 待办 T7（真机分页切穿文字行）的**根因定位**探针（2026-10-08 R10）
//
// 用法：
//   VERIFY_PLAYWRIGHT=<playwright> node docs/artifacts/2026-10-08-commercial-grade-r2/t7-cut-repro.mjs [--html <导出的 .html>]
//
// 做法（**不重写产品逻辑**）：把 `src/lib/htmlToImage.ts` 里真正干活的
// `toDeviceRanges`（保护区 → 设备像素区间）与 `planCuts`（切点计划）**按源码抽取**出来，
// 用抽到的函数跑真机那篇正文的行盒，看**抽出来的切点落在哪里**、以及它**是否落在某个行盒内部**。
// 抽不到就报错退出——不允许用一份会悄悄漂移的副本冒充产品逻辑。
//
// 已知的两个候选机制（本脚本就是用来分辨它们的）：
//   · M1 量/画不一致：量到的行盒与画出来的位置对不上（真机实测：175 行盒里只有 5 个渲染后无墨 ⇒ 基本不成立）；
//   · M2 **保护区上边界的 padding 把切点推进了上一行**：两个相邻行盒 [A.top, A.bottom) 与 [B.top, B.bottom)
//        首尾相接（A.bottom == B.top）时，`toDeviceRanges` 给 B 的上边界减 `PROTECT_PAD_PX`，
//        得到 `B.top - 1`；`planCuts` 退到"包含目标点的那个区间的 top"，切点就落在 `B.top - 1`——
//        **而那个位置正好在 A 的盒子里面**。
import { readFileSync, existsSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..', '..')
const src = readFileSync(join(repo, 'src', 'lib', 'htmlToImage.ts'), 'utf8')

function extract(name) {
  const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}')
  const m = re.exec(src)
  if (!m) {
    console.error(`[t7] 在 src/lib/htmlToImage.ts 里抽不到 ${name}——抽取方式失效了，请先修抽取，不要改用自带副本`)
    process.exit(2)
  }
  return m[0]
}
const numConst = (n) => {
  const m = new RegExp('const ' + n + ' = ([0-9]+)').exec(src)
  if (!m) { console.error(`[t7] 抽不到常量 ${n}`); process.exit(2) }
  return Number(m[1])
}

// 抽到的是 TypeScript（带类型标注），`new Function` 解析不了——先剥类型。
// 用 Node 自带的 stripTypeScriptTypes，**不手写正则去抠类型**（那正是会悄悄改坏逻辑的做法）。
const toDeviceRangesSrc = stripTypeScriptTypes(extract('toDeviceRanges'), { mode: 'strip' })
const planCutsSrc = stripTypeScriptTypes(extract('planCuts'), { mode: 'strip' })
const SCALE = numConst('SCALE')
const PROTECT_PAD_PX = numConst('PROTECT_PAD_PX')
const MIN_TAIL_PX = numConst('MIN_TAIL_PX')
console.log(`[抽取] toDeviceRanges ${toDeviceRangesSrc.length} 字符 / planCuts ${planCutsSrc.length} 字符；SCALE=${SCALE} PAD=${PROTECT_PAD_PX} MIN_TAIL=${MIN_TAIL_PX}`)

const args = process.argv.slice(2)
const htmlPath = args.includes('--html')
  ? args[args.indexOf('--html') + 1]
  : join(process.env.TEMP || '', 'wxmp-r5/big3/profile/Documents/wechat-mp-workspace/exports/tuiwen-1791472053.html')
if (!existsSync(htmlPath)) { console.error(`[t7] 找不到正文：${htmlPath}`); process.exit(2) }
const html = readFileSync(htmlPath, 'utf8')
console.log(`[输入] ${htmlPath}（${html.length} 字节）`)

let chromium
try { ({ chromium } = require(process.env.VERIFY_PLAYWRIGHT || 'playwright')) } catch (e) {
  console.error(`[t7] 解析不到 playwright：${String(e).slice(0, 140)}`); process.exit(2)
}
const chromExe = (() => {
  const env = process.env.VERIFY_CHROMIUM
  if (env && existsSync(resolve(env))) return resolve(env)
  const hard = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
  return existsSync(hard) ? hard : null
})()

const browser = await chromium.launch({ headless: true, ...(chromExe ? { executablePath: chromExe } : {}) })
const page = await browser.newPage()
await page.goto('about:blank')

const out = await page.evaluate(
  async ({ html, toDeviceRangesSrc, planCutsSrc, SCALE, PROTECT_PAD_PX, MIN_TAIL_PX }) => {
    const WIDTH = 375
    // 与产品 renderArticleImages 的测量宿主逐字一致
    const host = document.createElement('div')
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;`
    host.innerHTML = `<div style="width:${WIDTH}px;box-sizing:border-box">${html}</div>`
    document.body.appendChild(host)
    await Promise.all([...host.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const h = Math.ceil(host.getBoundingClientRect().height)
    const top0 = host.getBoundingClientRect().top
    const canvasPx = h * SCALE

    // 只取"文字行"这一类的保护区（T7 的现象就是字被切开；装饰/图片不走这条量法）
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    const ranges = []
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node.nodeValue || !node.nodeValue.trim()) continue
      const pe = node.parentElement
      if (!pe) continue
      const cs = getComputedStyle(pe)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      range.selectNodeContents(node)
      for (const r of Array.from(range.getClientRects())) {
        if (r.width > 0 && r.height > 0) ranges.push({ top: r.top - top0, bottom: r.bottom - top0, kind: 'text' })
      }
    }
    ranges.sort((a, b) => a.top - b.top)

    // 用**产品自己的两个函数**
    const mk = new Function(
      'SCALE', 'PROTECT_PAD_PX', 'MIN_TAIL_PX', 'ranges', 'canvasPx', 'TARGET_PX',
      `${toDeviceRangesSrc}\n${planCutsSrc}\nreturn planCuts(canvasPx, toDeviceRanges(ranges, canvasPx), TARGET_PX);`,
    )
    const TARGET_PX = 1000 * SCALE
    const plan = mk(SCALE, PROTECT_PAD_PX, MIN_TAIL_PX, ranges, canvasPx, TARGET_PX)

    // 每个切点是否落在某个**文字行盒**内部
    const inLine = plan.cutsPx.map((c) => {
      if (c <= 0 || c >= canvasPx) return null
      const hit = ranges.find((r) => r.top * SCALE < c && c < r.bottom * SCALE)
      return hit ? { cut: c, lineTop: Math.round(hit.top * SCALE), lineBottom: Math.round(hit.bottom * SCALE) } : null
    })
    document.body.removeChild(host)
    return { h, canvasPx, lineCount: ranges.length, cuts: plan.cutsPx, oversize: plan.oversize, inLine: inLine.filter(Boolean) }
  },
  { html, toDeviceRangesSrc, planCutsSrc, SCALE, PROTECT_PAD_PX, MIN_TAIL_PX },
)
await browser.close()

console.log(`[量到] 高 ${out.h} CSS → 画布 ${out.canvasPx} 设备像素；文字行盒 ${out.lineCount} 个`)
console.log(`[切点] ${JSON.stringify(out.cuts)}`)
console.log(`[超高页] ${JSON.stringify(out.oversize)}`)
if (out.inLine.length === 0) {
  console.log('[判定] 抽出来的切点**没有**落在任何文字行盒内部（M2 在本环境未复现）')
} else {
  console.log('[判定] **有切点落在文字行盒内部**：')
  for (const x of out.inLine) console.log(`  切点 y=${x.cut} 落在行盒 [${x.lineTop}, ${x.lineBottom}) 内部（距行顶 ${x.cut - x.lineTop}px）`)
}
process.exit(out.inLine.length === 0 ? 0 : 1)
