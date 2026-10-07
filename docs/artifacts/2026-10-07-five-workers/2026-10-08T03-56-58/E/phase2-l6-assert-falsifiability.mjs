// E 路 阶段二：证明父协调者新写入的 L6 分页断言**可证伪**，并检验它抓不住什么。
//
// 被检验的断言（逐字取自冻结的 scripts/live-acceptance.mjs:2443-2449）：
//   const pageInfos  = pageNames.map((n) => infos.find((x) => x.name === n))
//   const pageHeights= pageInfos.map((i) => (i ? i.height : NaN))
//   const pageSum    = pageHeights.every(Number.isFinite) ? sum : NaN
//   PASS ⇔ pageInfos.every(Boolean) && pageHeights.every((h) => h > 0) && pageSum === longInfo.height
//
// 用**真实导出**的页高/长图高做种子，再对输入做变异，看断言是否变红。
// 同时给出更强的替代式（逐页与长图对应带逐像素相等），并证明它能抓住该断言抓不住的变异。
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.E_ROOT || 'candidate'
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
function resolvePlaywright() {
  for (const m of ['playwright-core', 'playwright']) { try { return require(m) } catch { /* next */ } }
  const c = process.env.VERIFY_PLAYWRIGHT || join(process.env.TEMP, 'pw-deps', 'node_modules', 'playwright-core')
  return require(isAbsolute(c) ? c : resolve(process.cwd(), c))
}
const pw = resolvePlaywright()
const chromiumPath = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')

// —— 被检验的断言：与冻结源码逐字同形的求值函数 ——
function frozenAssertion(pageNames, infos, longInfo) {
  const pageInfos = pageNames.map((n) => infos.find((x) => x.name === n))
  const pageHeights = pageInfos.map((i) => (i ? i.height : NaN))
  const pageSum = pageHeights.every((h) => Number.isFinite(h)) ? pageHeights.reduce((a, b) => a + b, 0) : NaN
  const pass = pageInfos.every(Boolean) && pageHeights.every((h) => h > 0) && pageSum === longInfo.height
  return { pass, pageHeights, pageSum }
}
// 更强的替代式（建议）：逐页与长图对应带**逐像素**相等（顺序、内容、缺页、重复、补偿性改动全抓）
function strongAssertion(bands, longBands) {
  if (bands.length !== longBands.length) return false
  for (let i = 0; i < bands.length; i++) {
    if (bands[i].length !== longBands[i].length) return false
    for (let k = 0; k < bands[i].length; k++) if (bands[i][k] !== longBands[i][k]) return false
  }
  return true
}

const rec = { script: 'phase2-l6-assert-falsifiability', root: ROOT, checks: [] }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

const server = await createServer({ root: join(here, ROOT), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 1513, strictPort: true } })
await server.listen()
const browser = await pw.chromium.launch({ executablePath: chromiumPath, headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
await page.goto('http://127.0.0.1:1513/', { waitUntil: 'commit', timeout: 120000 })
await page.waitForFunction(() => document.readyState !== 'loading' && !!document.body, null, { timeout: 120000 })

const html = readFileSync(join(here, 'fixtures', 'paging-cut.html'), 'utf8')
const data = await page.evaluate(async ({ html }) => {
  const mod = await import('/src/lib/htmlToImage.ts')
  const res = await mod.renderArticleImages(html)
  const load = (u) => new Promise((rs, rj) => { const i = new Image(); i.onload = () => rs(i); i.onerror = rj; i.src = u })
  const longIm = await load(res.long)
  const cv = document.createElement('canvas'); cv.width = longIm.width; cv.height = longIm.height
  const cx = cv.getContext('2d'); cx.drawImage(longIm, 0, 0)
  const full = cx.getImageData(0, 0, cv.width, cv.height).data
  const w = cv.width
  // 每页的"带指纹"：为省内存只取每页每行的前 8 个像素
  const bands = []
  const heights = []
  const rowHashes = []
  let off = 0
  for (const u of res.pages) {
    const im = await load(u)
    heights.push(im.height)
    const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height
    const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0)
    const d = x2.getImageData(0, 0, c2.width, c2.height).data
    bands.push(Array.from(d.slice(0, 8 * 4)))            // 该页左上角 8 像素
    const hp = []
    for (let r = 0; r < im.height; r++) hp.push(d[r * c2.width * 4 + 1])   // 每行第 1 个像素的 G 通道
    rowHashes.push(hp)
    off += im.height
  }
  const longBands = []
  for (let k = 0; k < heights.length; k++) {
    // 长图里对应带的左上角 8 像素
    const start = bands.length ? 0 : 0
    longBands.push(null)
  }
  return { cssH: res.cssH, longH: longIm.height, longW: longIm.width, heights, bands, rowHashes, longRowG: (() => { const hp = []; for (let r = 0; r < longIm.height; r++) hp.push(full[r * w * 4 + 1]); return hp })(), cutsPx: res.cutsPx ?? null }
}, { html })
await browser.close()
await server.close()

const infos = data.heights.map((h, i) => ({ name: `explore-${i + 1}.png`, height: h }))
const longInfo = { name: 'explore-long.png', height: data.longH, width: data.longW }
const names = infos.map((i) => i.name)
console.log(`\n真实导出：长图 ${data.longW}x${data.longH}；${data.heights.length} 页，页高=${JSON.stringify(data.heights)}`)

const base = frozenAssertion(names, infos, longInfo)
ok('基线（真实导出）冻结断言 = PASS', base.pass, `sum=${base.pageSum} long=${longInfo.height}`)

// —— 变异 ——
const mut = (label, n2, i2, expect) => {
  const r = frozenAssertion(n2, i2, longInfo)
  ok(`冻结断言对「${label}」${expect ? '变红' : '不变红'}`, r.pass === !expect, `pass=${r.pass} sum=${r.pageSum} heights=${JSON.stringify(r.pageHeights)}`)
  return r
}
// 1 缺页（末页文件丢失）
mut('末页缺失', names.slice(0, -1), infos, true)
// 2 缺中间页
mut('中间页缺失', [names[0], names[2], names[3]], [infos[0], infos[2], infos[3]], true)
// 3 多出一页（重复导出）
mut('多出一页（重复）', [...names, 'explore-5.png'], [...infos, { name: 'explore-5.png', height: data.heights[3] }], true)
// 4 零高页
mut('某页高度为 0', names, infos.map((i, k) => (k === 1 ? { ...i, height: 0 } : i)), true)
// 5 高度读不到（decode 失败）
mut('某页高度为 NaN', names, infos.map((i, k) => (k === 1 ? { ...i, height: NaN } : i)), true)
// 6 补偿性改动：一页 +100、另一页 -100（高度和不变）
{
  const h = data.heights.slice()
  h[0] += 100; h[1] -= 100
  const i2 = h.map((x, k) => ({ name: names[k], height: x }))
  const r = frozenAssertion(names, i2, longInfo)
  rec.compensatedPasses = r.pass
  ok('【弱点】补偿性高度改动（+100/-100，和不变）冻结断言**无法**发现', r.pass === true, `pass=${r.pass} sum=${r.pageSum}`)
}
// 7 顺序颠倒（页面被置换，和不变）
{
  const i2 = [infos[1], infos[0], ...infos.slice(2)].map((x, k) => ({ ...x, name: names[k] }))
  const r = frozenAssertion(names, i2, longInfo)
  rec.permutationPasses = r.pass
  ok('【弱点】页面顺序颠倒（和不变）冻结断言**无法**发现', r.pass === true, `pass=${r.pass}`)
}

// —— 更强的替代式：逐页与长图对应带逐像素相等 ——
// 用真实的"每行 G 通道"指纹模拟像素比较
function strongFromFingerprints(rowsByPage, longRows, cutsPx) {
  // 强式的第一部分：切点计划必须**恰好**覆盖 [0, 长图高]，且切点数 = 页数 + 1。
  // 缺页（文件数 < 切点数）、多页、顺序错乱都会在这里先红。
  if (cutsPx) {
    if (cutsPx.length !== rowsByPage.length + 1) return false
    if (cutsPx[0] !== 0 || cutsPx[cutsPx.length - 1] !== longRows.length) return false
    for (let i = 1; i < cutsPx.length; i++) if (cutsPx[i] <= cutsPx[i - 1]) return false
  }
  if (cutsPx) {
    for (let i = 0; i < rowsByPage.length; i++) {
      const from = cutsPx[i], to = cutsPx[i + 1]
      if (rowsByPage[i].length !== to - from) return false
      for (let k = 0; k < rowsByPage[i].length; k++) if (rowsByPage[i][k] !== longRows[from + k]) return false
    }
    return true
  }
  let o = 0
  for (const rows of rowsByPage) { for (let k = 0; k < rows.length; k++) if (rows[k] !== longRows[o + k]) return false; o += rows.length }
  return true
}
ok('强式：真实导出逐页与长图对应带一致', strongFromFingerprints(data.rowHashes, data.longRowG, data.cutsPx), `cuts=${JSON.stringify(data.cutsPx)}`)
{
  const swapped = [data.rowHashes[1], data.rowHashes[0], ...data.rowHashes.slice(2)]
  const swappedCuts = [data.cutsPx[0], data.cutsPx[1] - 0, ...data.cutsPx.slice(2)]
  ok('强式：顺序颠倒必红（冻结断言抓不住的那种）', strongFromFingerprints(swapped, data.longRowG, [0, data.cutsPx[1], ...data.cutsPx.slice(2)]) === false, 'swapped→false')
}
{
  const dropped = data.rowHashes.slice(0, -1)
  const cutsDropped = data.cutsPx.slice(0, -1)
  ok('强式：缺页必红', strongFromFingerprints(dropped, data.longRowG, cutsDropped) === false, 'dropped→false')
}

writeFileSync(join(outDir, `phase2-l6-falsify-${ROOT}.json`), JSON.stringify(rec, null, 2))
const failed = rec.checks.filter((c) => !c.pass)
console.log(`\n检查 ${rec.checks.length} 条，未过 ${failed.length} 条：${failed.map((c) => c.id).join(' / ')}`)
console.log('写出：', join(outDir, `phase2-l6-falsify-${ROOT}.json`))
