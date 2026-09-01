// 像素抽样验证：渐变资产是否真渲染出渐变层次（canvas 抽样多点颜色对比）
import { readFileSync } from 'node:fs'
import { artifactsDir, loadPlaywright, findChromium } from './lib/env.mjs'
const { chromium } = await loadPlaywright()

const CASES = [
  // [name, svgFile, points: [[x,y,期望说明], ...]]
  ['sunrise-panorama', 'sunrise-panorama', [[10, 10, '天空顶部'], [375, 60, '天空中部'], [375, 116, '太阳中心'], [10, 290, '水面底部']]],
  ['seal-red', 'seal-red', [[150, 150, '印章中心'], [150, 60, '印章上部边缘']]],
  ['moon-night', 'moon-night', [[10, 10, '夜空顶部'], [10, 270, '夜空底部'], [540, 84, '月亮中心']]],
  ['lotus', 'lotus', [[120, 150, '荷叶中心'], [300, 60, '莲花瓣尖']]],
  ['frame-gilt', 'frame-gilt', [[40, 160, '左框边'], [375, 30, '顶框边']]],
]

const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  for (const [name, file, pts] of CASES) {
    const png = readFileSync(artifactsDir + 'assets-v103/' + file + '.png')
    const b64 = png.toString('base64')
    await page.setContent('<img id="i" src="data:image/png;base64,' + b64 + '" />')
    const colors = await page.evaluate((pts) => {
      const img = document.getElementById('i')
      const c = document.createElement('canvas')
      c.width = img.naturalWidth; c.height = img.naturalHeight
      const cx = c.getContext('2d')
      cx.drawImage(img, 0, 0)
      return pts.map(([x, y]) => {
        const d = cx.getImageData(x * 2, y * 2, 1, 1).data
        return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')'
      })
    }, pts)
    console.log(name)
    pts.forEach((p, i) => console.log('  (' + p[0] + ',' + p[1] + ') ' + p[2] + ' -> ' + colors[i]))
  }
  await page.close()
} finally {
  await browser.close()
}
