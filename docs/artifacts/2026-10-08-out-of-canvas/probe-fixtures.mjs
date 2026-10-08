import { checkSvgQuality, analyzeSvg, SLOT_PX } from '../../../src/lib/svg-quality.ts'
import fs from 'node:fs'
const files = process.argv.slice(2)
for (const f of files) {
  const svg = fs.readFileSync(f, 'utf8')
  const m = analyzeSvg(svg, {w:300,h:300})
  console.log(f, '| vb=', JSON.stringify(m.viewBox), 'el=', m.elements, 'vis=', m.visible, 'off=', m.offCanvas, 'cov=', m.coverage.toFixed(3), 'inkX=', m.inkXRatio.toFixed(3), 'inkY=', m.inkYRatio.toFixed(3))
}
