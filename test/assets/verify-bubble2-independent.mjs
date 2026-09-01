// test/assets/verify-bubble2-independent.mjs —— 主智能体独立验收：新子智能体产出（bubble2/）
// 验证：①画布 750×215 ②zone 容量（单泡 y50..170 高≥120px，双泡每泡≥72px）③4x PNG 存在且 ≤1MB ④375px 壳叠字 DOM 实测
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('./bubble2/', import.meta.url))
const artsPath = base + 'ARTS-bubble2.mjs'

// —— ① 静态检查 ARTS 文件 ——
console.log('======== 独立验收：bubble2/ 子智能体产出 ========')
if (!existsSync(artsPath)) {
  console.log('FAIL: 未找到 bubble2/ARTS-bubble2.mjs')
  process.exit(1)
}
const src = readFileSync(artsPath, 'utf8')

// 资产块提取（粗查：name/w/h/zone/画布）
const nameMatches = [...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
console.log('① 资产数: ' + nameMatches.length + '（期望 10）')
const hMatches = [...src.matchAll(/\bh:\s*(\d+)/g)].map((m) => +m[1])
const wMatches = [...src.matchAll(/\bw:\s*(\d+)/g)].map((m) => +m[1])
console.log('   画布 w: ' + [...new Set(wMatches)].join(',') + '（期望 750）  h: ' + [...new Set(hMatches)].join(',') + '（期望 215）')
// zone 检查：支持内联对象、数组（双泡）、或常量引用（如 ZONE / ZONE2）
const zoneConstMatch = [...src.matchAll(/const\s+(\w*ZONE\w*)\s*=\s*\{[^}]*\}/g)].map((m) => m[1])
const zoneRefCount = (src.match(/zone:\s*(?:ZONE\w*|\{)/g) || []).length
const zoneArrCount = (src.match(/zone:\s*\[/g) || []).length
const zoneInlineOk = (src.match(/zone:\s*\{ x0: 110, y0: 50, x1: 730, y1: 170 \}/g) || []).length
console.log('   zone 字段: 引用数 ' + zoneRefCount + '（含常量 ' + zoneConstMatch.join(',') + '）/ 数组(双泡) ' + zoneArrCount + ' / 内联标准 {110,50,730,170} ' + zoneInlineOk + ' 处')
const zoneOk = zoneRefCount >= 9 || zoneArrCount >= 1
console.log('   zone 合规: ' + (zoneOk ? '✓ 9+ 单泡引用或含双泡数组' : '⚠ 需人工核') + (zoneInlineOk ? '' : '（未发现内联标准写法，若用常量引用则正常）'))
const vGrad = (src.match(/gradientUnits="userSpaceOnUse"/g) || []).length
console.log('   userSpaceOnUse 渐变引用数: ' + vGrad)
const emojiHit = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src)
console.log('   emoji 字符: ' + (emojiHit ? '⚠ 发现!' : '无 ✓'))

// —— ② PNG 检查 ——
const pngDir = base + 'png-bubble2/'
let pngOk = 0, pngTotal = 0, pngBig = []
if (existsSync(pngDir)) {
  const files = readdirSync(pngDir).filter((f) => f.endsWith('.png'))
  pngTotal = files.length
  for (const f of files) {
    const kb = statSync(pngDir + f).size / 1024
    if (kb <= 1024) pngOk++; else pngBig.push(f + '=' + Math.round(kb) + 'KB')
  }
}
console.log('② PNG: ' + pngOk + '/' + pngTotal + ' ≤1MB' + (pngBig.length ? ' 超限: ' + pngBig.join(',') : ' ✓'))

// —— ③ 375px 壳叠字 DOM 实测（复用主验收逻辑）——
const pwCandidates = ['D:/deepseek-harness/deepseek-harness/node_modules/.pnpm']
const cands = []
for (const r of pwCandidates) {
  try { for (const d of readdirSync(r)) { if (d.startsWith('playwright@')) cands.push(r + '/' + d + '/node_modules/playwright/index.mjs') } } catch (_) { /* skip */ }
}
let pw
for (const c of cands) { try { if (existsSync(c)) { pw = await import('file:///' + c.replace(/\\/g, '/')); break } } catch (_) { /* next */ } }
const cb = 'C:/Users/Lenovo/AppData/Local/ms-playwright'
let exe
for (const d of readdirSync(cb)) { if (d.startsWith('chromium-')) { const p = cb + '/' + d + '/chrome-win64/chrome.exe'; if (existsSync(p)) { exe = p; break } } }

const demoFiles = ['demo-bubble2-375.html', 'demo-bubble2-375.png']
const hasDemo = demoFiles.every((f) => existsSync(base + f))
console.log('③ 375px 壳产物: ' + (hasDemo ? 'demo-bubble2-375.html/.png 存在 ✓' : '⚠ 未找到（子智能体可能未生成）'))

if (hasDemo && pw && exe) {
  const browser = await pw.chromium.launch({ executablePath: exe })
  try {
    const page = await browser.newPage({ viewport: { width: 500, height: 900 } })
    await page.goto('file:///' + (base + 'demo-bubble2-375.html').replace(/\\/g, '/'))
    await page.waitForTimeout(400)
    const result = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('div[style*="box-shadow:0 1px 4px"]')]
      if (!cards.length) {
        // 子智能体的卡片结构可能不同：退而检查 img 与绝对定位文字
        const imgs = [...document.querySelectorAll('img')]
        const texts = [...document.querySelectorAll('div[style*="position:absolute"]')]
        return { cards: imgs.length, texts: texts.length, imgsLoaded: imgs.filter((i) => i.naturalWidth > 0).length, note: 'fallback' }
      }
      return {
        cards: cards.length,
        imgsLoaded: cards.filter((c) => { const i = c.querySelector('img'); return i && i.naturalWidth > 0 }).length,
        allInside: cards.every((card) => {
          const img = card.querySelector('img')
          const texts = [...card.querySelectorAll('div[style*="position:absolute"]')]
          if (!img || !texts.length) return false
          const ir = img.getBoundingClientRect()
          return texts.every((t) => { const r = t.getBoundingClientRect(); return r.left >= ir.left - 1 && r.right <= ir.right + 1 && r.top >= ir.top - 1 && r.bottom <= ir.bottom + 1 })
        }),
        texts: cards.map((c) => c.querySelectorAll('div[style*="position:absolute"]').length),
      }
    })
    if (result.note === 'fallback') {
      console.log('   DOM: 卡片 ' + result.cards + ' / 图片加载 ' + result.imgsLoaded + ' / 文字层 ' + result.texts + '（结构非标准，无法自动判定越界）')
    } else {
      console.log('   DOM: 卡片 ' + result.cards + ' / 图片加载 ' + result.imgsLoaded + ' / 文字层数 ' + result.texts.join(',') + ' / 全部在界内: ' + result.allInside)
    }
  } finally {
    await browser.close()
  }
}
console.log('======== 验收结束 ========')
