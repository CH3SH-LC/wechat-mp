// B 路一次性标定探针（非交付物）：量出各内容块的 CSS 高度，用于把夹具图形摆到旧切点附近。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require(process.env.PW_SRC || 'playwright-core')
const exe = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:1461'
const browser = await pw.chromium.launch({ headless: true, executablePath: exe })
const page = await browser.newPage()
await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })

const P2 = '这是一段两行的演示文字，用来标定一个普通段落的高度。它的长度大致相当于两行中文，段落之间保留标准的段间距，重复多次即可精确地把后面的内容推到目标位置。'
const P3 = '这是一段三行的演示文字，用来标定一个较长段落的高度。它的内容比两行段落更长一些，写满三行之后换段，段间距保持一致，这样就能用段落数量来微调后续内容的起始位置，而不用去改版式。'
const H = '## 小节标题'
const ART = '\n::: art wide 标定插画\n\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect x="0" y="0" width="300" height="200" fill="#eef3fb"/><rect x="26" y="40" width="74" height="120" fill="#f0b429" rx="6"/><rect x="112" y="28" width="78" height="132" fill="#2f6fb3" rx="6"/><rect x="202" y="52" width="70" height="108" fill="#c8553d" rx="6"/><circle cx="63" cy="30" r="14" fill="#2f6fb3"/><circle cx="150" cy="20" r="11" fill="#f0b429"/><line x1="26" y1="176" x2="272" y2="176" stroke="#8ea3bd" stroke-width="3"/></svg>\n\n:::\n'
const TABLE = '\n| 区域 | 座位类型 | 电源插座 | 开放时段 |\n| --- | --- | --- | --- |\n| 一层综合阅览区 | 长桌与沙发混排 | 每座一个 | 8:00–22:00 |\n| 二层专业书库 | 单人隔断座 | 每两个一个 | 9:00–21:00 |\n| 三层期刊区 | 靠窗长桌 | 每四个一个 | 9:00–17:00 |\n'
const LIST = '\n- 需要长时间写作：一层靠窗一侧，光线与插座都最稳\n- 需要安静：二层专业书库，隔断座隔音最好\n- 需要查阅当年期刊：三层，注意当年期刊不外借\n'

const head = '[[theme:校园风]]\n\n[[banner:秋季书单与阅读区改造|——插画、表格与整块不可分割内容的排版说明]]\n\n'
const cases = {
  base: head + '开场一段。',
  p2x0: head + '开场一段。',
  p2x1: head + '开场一段。\n\n' + P2,
  p2x2: head + '开场一段。\n\n' + P2 + '\n\n' + P2,
  p3x1: head + '开场一段。\n\n' + P3,
  p3x2: head + '开场一段。\n\n' + P3 + '\n\n' + P3,
  hx1: head + '开场一段。\n\n' + H + '\n\n' + P2,
  art: head + '开场一段。\n\n' + ART,
  table: head + '开场一段。\n\n' + TABLE,
  list: head + '开场一段。\n\n' + LIST,
}

const out = await page.evaluate(
  async ({ cases }) => {
    const { composeMarkdown } = await import('/src/lib/compose.ts')
    const { renderArtPlaceholders } = await import('/src/lib/artRender.ts')
    const res = {}
    for (const [k, src] of Object.entries(cases)) {
      const c = composeMarkdown(src, {})
      const html = c.arts && c.arts.length ? await renderArtPlaceholders(c.html, c.arts) : c.html
      const host = document.createElement('div')
      host.style.cssText =
        "position:fixed;left:-20000px;top:0;width:375px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;"
      host.innerHTML = `<div style="width:375px;box-sizing:border-box">${html}</div>`
      document.body.appendChild(host)
      await Promise.all([...host.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())))
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      res[k] = Math.ceil(host.getBoundingClientRect().height)
      host.remove()
    }
    return res
  },
  { cases },
)
console.log(JSON.stringify(out, null, 1))
const d = (a, b) => out[b] - out[a]
console.log('两行段落高 =', d('p2x0', 'p2x1'), '; 三行段落高 =', d('p3x1', 'p3x2'))
console.log('标题+两行段落高 =', d('p2x0', 'hx1'), '; 插画块高 =', d('p2x0', 'art') - d('p2x0', 'p2x1'), '; 表格块高 =', d('p2x0', 'table') - d('p2x0', 'p2x1'))
console.log('开场段高 =', out.base - (out.p2x0 - d('p2x0', 'p2x1')) + 0, '（base 与 p2x0 同内容）')
console.log('插画块高(绝对值) =', out.art - out.p2x0, '; 表格块高 =', out.table - out.p2x0, '; 列表块高 =', out.list - out.p2x0)
await browser.close()
