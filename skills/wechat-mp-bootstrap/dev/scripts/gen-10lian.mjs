// 军训十连推文 v10 渲染：从 SKILL.md 提取最新源码（平面化 + 零 emoji + 植物图案），stub 执行 compose 生成 375px HTML + 截图
// v10：提取 Client ARTS 的 SVG → 本地渲染 PNG（data URI）→ 注入 artUrls，使 |grass 等图案装饰在本地可见
import { readFileSync, writeFileSync } from 'node:fs'
import { skillMd, artifact, loadPlaywright, findChromium } from './lib/env.mjs'
const { chromium } = await loadPlaywright()

const skill = readFileSync(skillMd, 'utf8')
const blocks = [...skill.matchAll(/````js\n([\s\S]*?)````/g)].map((m) => m[1])
const hostSrc = blocks[0]
const clientSrc = blocks[1]

const tools = {}
globalThis.harness = { defineTool: (t) => t, registerTool: (_c, t) => { tools[t.name] = t }, handle: () => {} }
const ctxStub = { timer: { timeout: (ms) => new Promise((r) => setTimeout(r, ms)) }, get: (n) => (n === 'shell' ? { resolve: (r) => r, run: async () => { throw new Error('stub') } } : undefined) }
new Function(hostSrc)().apply(ctxStub)
console.log('工具注册：' + Object.keys(tools).join(', '))

// 提取 Client ARTS 定义（SVG 源码）
const artMatch = clientSrc.match(/const ARTS = \[([\s\S]*?)\n    \]/)
if (!artMatch) throw new Error('未找到 ARTS 定义')
const arts = eval('[' + artMatch[1] + ']')
console.log('美术资产：' + arts.map((a) => a.name).join(', '))

const markdown = readFileSync(artifact('10lian-tuiwen.md'), 'utf8')
const title = '首战告捷！十连捧回沙场争锋旗'

const browser = await chromium.launch({ executablePath: findChromium() })
try {
  // 1) 本地渲染所有 ARTS SVG → PNG data URI
  const artPage = await browser.newPage({ viewport: { width: 800, height: 600 } })
  const artUrls = {}
  for (const a of arts) {
    const svgB64 = Buffer.from(a.svg, 'utf8').toString('base64')
    await artPage.setContent('<img id="i" src="data:image/svg+xml;base64,' + svgB64 + '" />')
    const dataUrl = await artPage.evaluate(async (a) => {
      const img = document.getElementById('i')
      await new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res } })
      const c = document.createElement('canvas')
      c.width = a.w * 2; c.height = a.h * 2
      const cx = c.getContext('2d')
      cx.scale(2, 2)
      cx.drawImage(img, 0, 0, a.w, a.h)
      return c.toDataURL('image/png')
    }, a)
    artUrls[a.name] = dataUrl
    console.log('  渲染 ' + a.name + ' (' + dataUrl.length + ' 字符)')
  }
  await artPage.close()

  // 2) compose（注入 artUrls 供图案装饰使用）
  const res = await tools.wechat_mp_compose.execute({ title, mode: 'promo', markdown, artUrls })
  const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=375"><title>' + title +
    '</title></head><body style="max-width:375px;margin:0 auto;padding:12px;background:#ffffff">' + res.html + '</body></html>'
  writeFileSync(artifact('10lian-run-art.html'), html, 'utf8')

  const page = await browser.newPage({ viewport: { width: 375, height: 800 } })
  await page.setContent(html)
  await page.waitForTimeout(600)
  await page.screenshot({ path: artifact('10lian-run-art.png'), fullPage: true })
  await page.close()

  console.log('======== 10lian-run-art（带图案版） ========')
  console.log('模式: ' + res.mode + '（' + res.modeLabel + '） | 字数: ' + res.chars + ' | 图片数: ' + res.imageCount + ' | HTML ' + res.html.length + ' 字符')
  console.log('警告: ' + (res.warnings.length ? res.warnings.join(' | ') : '无'))
} finally {
  await browser.close()
}
console.log('已生成 dev/artifacts/10lian-run-art.html（375px 壳）+ 截图')
