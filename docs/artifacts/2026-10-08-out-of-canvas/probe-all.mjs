import { analyzeSvg, SLOT_PX } from '../../../src/lib/svg-quality.ts'
import fs from 'node:fs'; import path from 'node:path'
const roots = process.argv.slice(2); const out = []
const kindFromCat = c => c==='art-wide'?'wide':c==='art-deco'?'deco':c==='art-divider'?'divider':c==='art-heading'?'heading':c==='art-photo'?'photo-frame':'inline'
for (const r of roots) {
  for (const d of fs.readdirSync(r)) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(r,d,'meta.json'),'utf8'))
      const svg = fs.readFileSync(path.join(r,d,'source.svg'),'utf8')
      const kind = kindFromCat(meta.category)
      const m = analyzeSvg(svg, SLOT_PX[kind])
      out.push({ name: meta.name, kind, cat: meta.category, vb: m.viewBox&&`${m.viewBox.w}x${m.viewBox.h}`, el: m.elements, vis: m.visible, off: m.offCanvas, cov:+m.coverage.toFixed(2), inkX:+m.inkXRatio.toFixed(2), inkY:+m.inkYRatio.toFixed(2), unsafe: m.unsafe.join(',') })
    } catch(e) { out.push({ dir: d, err: String(e).slice(0,60) }) }
  }
}
console.table(out)
