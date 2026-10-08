// l6-pixel-red.mjs —— 证明 L6 新增的"逐页逐像素与长图比对"**可证伪**（2026-10-08，待办 T6）
//
// 用法：
//   VERIFY_PLAYWRIGHT=<playwright 模块目录> node docs/artifacts/2026-10-08-commercial-grade-r2/l6-pixel-red.mjs [--dir <某次导出的 PNG 目录>]
//
// 为什么需要它：一条断言如果在任何输入下都成立，它就不是断言。
// `comparePagesToLong` 在真机上返回"7 页全部 0 像素差异"，必须回答"那它到底会不会红"——
// 做法是**同一批文件、故意把条带配错**（换序 / 错位），看它是否如实报出差异。
//
// 两条防漂移的规矩（照抄本仓库既有做法）：
//   ① 比对函数**从 runner 里抽取**（`scripts/live-acceptance.mjs` 的 `comparePagesToLong`），
//      抽不到直接报错退出——不允许证明脚本自带一份会悄悄漂移的副本；
//   ② 用的就是**真机导出的那批 PNG**，不另造夹具。
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..', '..')

const args = process.argv.slice(2)
const dirArg = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null
const DEFAULT_DIR = join(
  process.env.TEMP || '',
  'wxmp-r2/big1/profile/Documents/wechat-mp-workspace/exports/img-tuiwen-20261008-2230',
)
const dir = dirArg || DEFAULT_DIR

function die(msg) {
  console.error(`[l6-pixel-red] ${msg}`)
  process.exit(2)
}

if (!existsSync(dir)) die(`找不到导出目录：${dir}\n（用 --dir 指定某个导出的 PNG 目录）`)

// ---------- ① 从 runner 里抽取比对函数（抽不到即报错，不退回自带副本） ----------
const runner = readFileSync(join(repo, 'scripts', 'live-acceptance.mjs'), 'utf8')
const m = /comparePagesToLong:\s*\[([\s\S]*?)\]\.join\('\\n'\)/.exec(runner)
if (!m) die('在 scripts/live-acceptance.mjs 里抽不到 comparePagesToLong——抽取方式失效了，请先修抽取，不要改用自带副本')
const pageSrc = eval(`[${m[1]}].join('\\n')`) // 数组字面量里只有字符串，eval 是安全的
if (!pageSrc.includes('getImageData')) die('抽到的源码里没有 getImageData——抽错了东西')
console.log(`[抽取] comparePagesToLong ${pageSrc.length} 字符，来源 scripts/live-acceptance.mjs`)

// ---------- ② 用真机导出的那批 PNG ----------
const files = readdirSync(dir).filter((n) => /\.png$/.test(n))
const longName = files.find((n) => n.includes('长图'))
const pageNames = files.filter((n) => /-\d+\.png$/.test(n)).sort()
if (!longName || pageNames.length < 2) die(`目录里没有"长图 + ≥2 张分页"：${JSON.stringify(files)}`)
const b64 = (n) => readFileSync(join(dir, n)).toString('base64')
const long = `data:image/png;base64,${b64(longName)}`
const pages = pageNames.map((n) => ({ dataUrl: `data:image/png;base64,${b64(n)}` }))
console.log(`[输入] 长图=${longName}；分页 ${pageNames.length} 张：${JSON.stringify(pageNames)}`)

// ---------- ③ 在真实浏览器里跑（与 runner 同一执行方式：new Function('arg', src)） ----------
const pwPath = process.env.VERIFY_PLAYWRIGHT || 'playwright'
let chromium
try {
  // 用 createRequire：Windows 盘符路径（`D:/…`）不能直接 `import()`——会被当成 URL scheme 拒绝。
  // 这也是本仓库其它 runner 拿到 playwright 的方式（VERIFY_PLAYWRIGHT 指向模块目录）。
  ;({ chromium } = require(pwPath))
} catch (e) {
  die(`解析不到 playwright（${String(e).slice(0, 160)}）；设置 VERIFY_PLAYWRIGHT=<模块目录>`)
}

// 本机 playwright 的默认 chromium 可能没下载；与 export-paging-check 同一套解析方式：
// 先看 VERIFY_CHROMIUM，再退到本机既有的 ms-playwright chromium。
const chromExe = (() => {
  const env = process.env.VERIFY_CHROMIUM
  if (env) {
    const t = resolve(env)
    if (existsSync(t)) return t
  }
  const hard = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
  return existsSync(hard) ? hard : null
})()
console.log(`[浏览器] ${chromExe || '(playwright 默认 chromium)'}`)

const browser = await chromium.launch({ headless: true, ...(chromExe ? { executablePath: chromExe } : {}) })
const page = await browser.newPage()
await page.goto('about:blank')
const runCmp = (payload) => page.evaluate(({ src, arg }) => new Function('arg', src)(arg), { src: pageSrc, arg: payload })

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` (${extra})` : ''}`)
  if (!ok) failed++
}

console.log('\n[对照 1：真机原样 —— 应当全部 0 差异]')
const base = await runCmp({ long, pages })
{
  const ds = base.pages.map((p) => p.diff)
  check('原样顺序下每页差异像素 = 0', ds.every((d) => d === 0), `diff=${JSON.stringify(ds)}；合计覆盖 ${base.coveredSum}/${base.longH}`)
}

console.log('\n[反证 A：交换前两页 —— 必须非 0（页序颠倒要被抓到）]')
{
  const swapped = [pages[1], pages[0], ...pages.slice(2)]
  const r = await runCmp({ long, pages: swapped })
  const d1 = r.pages[0].diff
  const d2 = r.pages[1].diff
  check('交换第 1/2 页后，两页都被判为"与长图该条带不一致"', d1 > 0 && d2 > 0, `第1页 diff=${d1}（首个差异行 ${r.pages[0].firstRow}）；第2页 diff=${d2}（首个差异行 ${r.pages[1].firstRow}）`)
}

console.log('\n[反证 B：整体错位（丢掉第 1 页，把第 2 页放到 top=0）—— 必须非 0（补偿性偏移要被抓到）]')
{
  const shifted = pages.slice(1)
  const r = await runCmp({ long, pages: shifted })
  const d = r.pages[0].diff
  check('错位后第 1 条比对非 0', d > 0, `diff=${d}（首个差异行 ${r.pages[0].firstRow}，占该页 ${((d / (r.pages[0].w * r.pages[0].h)) * 100).toFixed(1)}%）`)
}

console.log('\n[对照 2：同一页重复两次 —— 第 1 条应当 0，第 2 条必须非 0（证明"0"不是常量返回）]')
{
  const twice = [pages[0], pages[0], ...pages.slice(1)]
  const r = await runCmp({ long, pages: twice })
  check('重复页：第 1 条 0 差异、第 2 条非 0', r.pages[0].diff === 0 && r.pages[1].diff > 0, `diff[0]=${r.pages[0].diff}；diff[1]=${r.pages[1].diff}`)
}

await browser.close()
console.log(failed === 0 ? '\nL6-PIXEL-RED PASS（比对可证伪：原样 0、配错必红）' : `\nL6-PIXEL-RED FAIL（${failed} 条）`)
process.exit(failed === 0 ? 0 : 1)
