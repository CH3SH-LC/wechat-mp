// test/product/verify-product-pixels.mjs
// 对 product-article.png（2x，375px 宽）做精确验证：
//  1) 页面内每个 img naturalWidth>0 且 bounding box 非零（图真实渲染）
//  2) 按 DOM 实际位置对截图抽样：每个资产中心点应为非白像素
//  3) 全文非白像素占比合理（非空白页）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('./', import.meta.url))
const pngPath = here + 'product-article.png'

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

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 800, deviceScaleFactor: 2 } })
  const html = readFileSync(here + 'product-article.html', 'utf8')
  await page.setContent(html)
  await page.waitForTimeout(400)
  // 1) DOM 级验证：每个 img 的渲染状态与位置
  const boxes = await page.evaluate(() => {
    return [...document.querySelectorAll('img')].map((im) => {
      const r = im.getBoundingClientRect()
      const s = im.currentSrc || im.src
      const name = (s.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/) ? '(png)' : s.split('/').pop())
      return {
        name: name.startsWith('(png)') ? 'png#' + [...document.querySelectorAll('img')].indexOf(im) : name,
        ok: im.complete && im.naturalWidth > 0 && r.width > 0 && r.height > 0,
        x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height),
      }
    })
  })
  const imgOk = boxes.filter((b) => b.ok)
  console.log('img 渲染: ' + imgOk.length + '/' + boxes.length + ' 成功')
  boxes.filter((b) => !b.ok).forEach((b) => console.log('  FAIL ' + JSON.stringify(b)))

  // 2) 截图按 DOM 位置抽样：对每个 img 的包围盒扫描非白像素
  await page.screenshot({ path: pngPath, fullPage: true })
  const pngB64 = readFileSync(pngPath).toString('base64')
  const samples = await page.evaluate(({ boxes, b64 }) => {
    const img = document.createElement('img')
    return new Promise((resolve) => {
      const c = document.createElement('canvas')
      img.onload = () => {
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(img, 0, 0)
        const d = cx.getImageData(0, 0, c.width, c.height).data
        const sx = c.width / 375
        const sy = c.height / document.body.scrollHeight
        const scan = (x0, y0, x1, y1) => {
          let colored = 0, total = 0
          for (let y = Math.round(y0 * sy); y < Math.round(y1 * sy); y += 2) {
            for (let x = Math.round(x0 * sx); x < Math.round(x1 * sx); x += 2) {
              const i = (y * c.width + x) * 4
              if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) colored++
              total++
            }
          }
          return { colored, total, pct: +(colored / total * 100).toFixed(1) }
        }
        // 全文非白占比（每 6px 抽 1 列）
        let nonWhite = 0, total = 0
        for (let y = 0; y < c.height; y += 6) {
          for (let x = 0; x < c.width; x += 6) {
            const i = (y * c.width + x) * 4
            if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) nonWhite++
            total++
          }
        }
        resolve({
          scans: boxes.map((b) => ({ name: b.name, ...scan(b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2) })),
          nonWhitePct: +(nonWhite / total * 100).toFixed(2),
        })
      }
      img.src = 'data:image/png;base64,' + b64
    })
  }, { boxes: boxes.map(({ name, x, y, w, h }) => ({ name, x, y, w, h })), b64: pngB64 })
  console.log('截图非白占比: ' + samples.nonWhitePct + '%')
  for (const s of samples.scans) {
    console.log('  ' + s.name.padEnd(8) + ' 有内容 ' + s.pct + '% (' + s.colored + '/' + s.total + ')')
  }
  const allImgsPainted = samples.scans.every((s) => s.pct > 0.5)
  if (imgOk.length !== boxes.length || !allImgsPainted || samples.nonWhitePct < 3) {
    throw new Error('验证失败：图片未全渲染或截图空白')
  }
  console.log('====== 测试产品像素验证通过（' + boxes.length + '/' + boxes.length + ' 图有内容，非白 ' + samples.nonWhitePct + '%） ======')
} finally {
  await browser.close()
}
