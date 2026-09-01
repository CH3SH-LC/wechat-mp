// v10.3 新资产上稿验证：用 14 个新复杂资产渲染一篇 demo 推文（375px + 截图）
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

const artMatch = clientSrc.match(/const ARTS = \[([\s\S]*?)\n    \]/)
const arts = eval('[' + artMatch[1] + ']')
const v103 = arts.filter((a) => ['sunrise-panorama', 'moon-night', 'bamboo-mist', 'spring-branch', 'rose-branch', 'lotus', 'plum-branch', 'pine-sprig', 'arch-garden', 'frame-gilt', 'seal-red', 'laurel-badge', 'divider-ornate', 'corner-flourish'].includes(a.name))

const markdown = `# 山野来信：把四季装进一页

![日出山水](art://sunrise-panorama)

清晨五点，我站在山脊上。天从墨蓝褪成米金，太阳从雾青的山影后面探出来——这一页，想把那一刻的安静分你一半。

[[title:春·花开|vine]]

> [!KEY|blossom] 三月的第一朵
> 山桃比日历更早醒来。风一过，花瓣就落在刚翻开的书页上。

![春花枝](art://spring-branch)

::: card 这个季节适合
- 去郊外走一条没走过的路
- 把手机调成静音
- 摘一枝花，夹进日记本里
:::

[[title:里程碑·第 100 篇|box]]

![桂冠徽章](art://laurel-badge)

坚持写了 100 篇，回看第一篇还像昨天。给自己盖一枚朱印，当作继续写下去的理由。

![朱印圆章](art://seal-red)

---

![中心花饰](art://divider-ornate)

::: steps
- 准备：一只背包、一壶水、一份好心情
- 出发：天亮前动身，看太阳把山染成金色
- 记录：停下来，把看到的写下来
:::

> [!WARN|leaf] 别忘了
> 山里信号时有时无，提前告诉家人你的路线。

![卷草角饰](art://corner-flourish)

**写在最后**：四季会走，山还在。愿你也有一页属于自己的山野来信。`

const title = '山野来信：把四季装进一页'

const browser = await chromium.launch({ executablePath: findChromium() })
try {
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
  }
  await artPage.close()

  const res = await tools.wechat_mp_compose.execute({ title, mode: 'promo', markdown, artUrls })
  const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=375"><title>' + title +
    '</title></head><body style="max-width:375px;margin:0 auto;padding:12px;background:#ffffff">' + res.html + '</body></html>'
  writeFileSync(artifact('v103-demo.html'), html)
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } })
  await page.setContent(html)
  await page.waitForTimeout(600)
  await page.screenshot({ path: artifact('v103-demo.png'), fullPage: true })
  await page.close()

  console.log('======== v10.3 新资产上稿验证 ========')
  console.log('模式: ' + res.mode + ' | 字数: ' + res.chars + ' | HTML ' + res.html.length + ' 字符')
  console.log('警告: ' + (res.warnings.length ? res.warnings.join(' | ') : '无'))
  const used = [...markdown.matchAll(/art:\/\/([a-z0-9-]+)/g)].map((m) => m[1])
  const remain = [...res.html.matchAll(/art:\/\//g)].length
  console.log('引用资产: ' + [...new Set(used)].join(', '))
  console.log('art:// 残留: ' + remain)
  const imgs = [...res.html.matchAll(/<img[^>]*src="data:image\/png;base64,[^"]{80}/g)].length
  console.log('内嵌图片: ' + imgs + ' 张（base64 data URI）')
} finally {
  await browser.close()
}
console.log('已生成 dev/artifacts/v103-demo.html + v103-demo.png')
