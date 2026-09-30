// raster-check.mjs —— 素材"真实显示尺寸"栅格检查的**校准与断言**（修复计划阶段 5，2026-09-28）
// 用法：node scripts/raster-check.mjs [URL]   （需先启动 dev server，默认 http://127.0.0.1:1420）
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
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const url = process.argv[2] || 'http://127.0.0.1:1420'
const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(here, 'fixtures', 'deco-calibration')

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

const browser = await chromium.launch({
  executablePath: 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
})
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
} catch (e) {
  console.log('  FAIL - raster-check error:', String(e).slice(0, 300))
  failed++
}

await browser.close()
console.log(failed === 0 ? '\nRASTER OK' : `\nRASTER FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
