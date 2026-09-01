// v10.2 布局实测：各装饰元素真实渲染尺寸与位置（读取 dev/artifacts/10lian-run-art.html）
import { readFileSync } from 'node:fs'
import { artifact, loadPlaywright, findChromium } from './lib/env.mjs'
const { chromium } = await loadPlaywright()

const html = readFileSync(artifact('10lian-run-art.html'), 'utf8')
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } })
  await page.setContent(html)
  await page.waitForTimeout(800)
  const info = await page.evaluate(() => {
    const out = []
    // 1) 正文 art 装饰图（inline-block 56%）
    const artImgs = [...document.querySelectorAll('img[style*="max-width:56%"], section img[style*="max-width:56%"]')]
    artImgs.forEach((img, i) => {
      const r = img.getBoundingClientRect()
      out.push({ kind: '装饰图', index: i, w: Math.round(r.width), h: Math.round(r.height), parent: img.parentElement.tagName, parentBg: img.parentElement.style.background || '无' })
    })
    // 2) 气泡角饰
    const decoImgs = [...document.querySelectorAll('img[style*="position:absolute"]')]
    decoImgs.forEach((img, i) => {
      const r = img.getBoundingClientRect()
      const pr = img.parentElement.getBoundingClientRect()
      out.push({ kind: '角饰', index: i, w: Math.round(r.width), h: Math.round(r.height), parentW: Math.round(pr.width), parentH: Math.round(pr.height), rightGap: Math.round(pr.right - r.right), bottomGap: Math.round(pr.bottom - r.bottom) })
    })
    // 3) vine 标题花边
    const vineImgs = [...document.querySelectorAll('img[style*="width:46%"]')]
    vineImgs.forEach((img, i) => {
      const r = img.getBoundingClientRect()
      out.push({ kind: 'vine花边', index: i, w: Math.round(r.width), h: Math.round(r.height) })
    })
    // 4) 段落卡片（抽查第一张）
    const para = document.querySelector('section[style*="background: rgb(247, 243, 238)"]')
    if (para) {
      const r = para.getBoundingClientRect()
      out.push({ kind: '段落卡片', w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out
  })
  for (const it of info) console.log(JSON.stringify(it))
  await page.close()
} finally {
  await browser.close()
}
