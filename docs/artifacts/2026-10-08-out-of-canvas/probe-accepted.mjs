// 只读探针：用产品真实 checkSvgQuality 复判「真实跑出来的」SVG
import { checkSvgQuality, analyzeSvg, SLOT_PX } from '../../../src/lib/svg-quality.ts'
import fs from 'node:fs'
import path from 'node:path'

const kindFromCat = (c) => c === 'art-wide' ? 'wide' : c === 'art-inline' ? 'inline' : c === 'art-deco' ? 'deco' : 'inline'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.svg')) out.push(p)
  }
  return out
}

const big = process.env.BIG
const rows = []
for (const d of fs.readdirSync(big)) {
  const meta = JSON.parse(fs.readFileSync(path.join(big, d, 'meta.json'), 'utf8'))
  const svg = fs.readFileSync(path.join(big, d, 'source.svg'), 'utf8')
  const kind = kindFromCat(meta.category)
  const m = analyzeSvg(svg, SLOT_PX[kind])
  rows.push({ id: d, name: meta.name, kind, category: meta.category, chars: svg.length,
    vb: m.viewBox, elements: m.elements, visible: m.visible, offCanvas: m.offCanvas,
    coverage: +m.coverage.toFixed(3), inkX: +m.inkXRatio.toFixed(3), inkY: +m.inkYRatio.toFixed(3),
    motifPx: +m.motifPx.toFixed(1), unsafe: m.unsafe })
}
console.log(JSON.stringify(rows, null, 2))
