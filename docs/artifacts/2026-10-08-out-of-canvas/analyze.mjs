// 只读分析：不做修改，只用产品真实 analyzeSvg 口径复算
import { analyzeSvg } from '../../../src/lib/svg-quality.ts'
import fs from 'node:fs'; import path from 'node:path'

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) collect(p, out)
    else if (e.name.endsWith('.svg')) out.push(p)
  }
  return out
}
const kindOf = c => c==='art-wide'?'wide':c==='art-deco'?'deco':c==='art-divider'?'divider':c==='art-heading'?'heading':c==='art-photo'?'photo-frame':'inline'

// ── 复刻 analyzeSvg 的元素扫描（只为统计"祖先 transform"等结构，不改判定口径）──────────
function scanStructure(svg) {
  const body = String(svg).replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(defs|clipPath|mask|filter|linearGradient|radialGradient|pattern|stop|style|desc|title|metadata)[\s\S]*?<\/\1>/gi,'')
  const tagRe = /<\/?([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g
  let m, stack = [], el = 0, underTransform = 0, underG = 0, zeroArea = 0, atEdge = 0
  const primRe = /^(circle|rect|ellipse|line|path|polygon|polyline|image)$/i
  while ((m = tagRe.exec(body)) !== null) {
    const closing = m[0].startsWith('</'); const name = m[1].toLowerCase(); const attrs = m[2] || ''
    if (name === 'g') { if (closing) stack.pop(); else if (!m[3]) stack.push(/\btransform\s*=/.test(attrs)); continue }
    if (closing || !primRe.test(name)) continue
    el++
    if (stack.some(Boolean)) underTransform++
    else if (stack.length) underG++
  }
  return { el, underTransform, underG }
}
function edgeStats(svg, vb) {
  const body = String(svg).replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(defs|clipPath|mask|filter|linearGradient|radialGradient|pattern|stop|style|desc|title|metadata)[\s\S]*?<\/\1>/gi,'')
  const re = /<(circle|rect|ellipse|line|path|polygon|polyline|image)\b([^>]*?)\/?>/gi
  let m, zero = 0, onRightOrBottomEdge = 0, n = 0
  while ((m = re.exec(body)) !== null) {
    const a = {}; const ar = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let k
    while ((k = ar.exec(m[0])) !== null) a[k[1].toLowerCase()] = k[2] !== undefined ? k[2] : k[3]
    const num = (x, d=0) => { const v = parseFloat(a[x]); return Number.isNaN(v) ? d : v }
    n++
    if (m[1].toLowerCase() === 'rect' || m[1].toLowerCase() === 'image') {
      const w = Math.abs(num('width')), h = Math.abs(num('height'))
      if (w === 0 || h === 0) zero++
      if (vb && (num('x') === vb.w || num('y') === vb.h)) onRightOrBottomEdge++
    }
  }
  return { n, zero, onRightOrBottomEdge }
}

const dirs = process.argv.slice(2)
const rows = []
for (const d of dirs) {
  for (const f of collect(d)) {
    const svg = fs.readFileSync(f, 'utf8')
    let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(path.dirname(f),'meta.json'),'utf8')) } catch {}
    const kind = kindOf(meta.category)
    const m = analyzeSvg(svg, { w: 343, h: 220 })
    const s = scanStructure(svg)
    const es = edgeStats(svg, m.viewBox)
    const alt = ['300x200','360x240','300x300','750x220','750x120','360x160','600x600']
    const sweep = {}
    for (const v of alt) {
      const [w,h] = v.split('x').map(Number)
      const svg2 = svg.replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="0 0 ${w} ${h}"`)
      sweep[v] = analyzeSvg(svg2, {w:343,h:220}).offCanvas
    }
    rows.push({ name: meta.name || path.basename(path.dirname(f)), kind, vb: m.viewBox && `${m.viewBox.w}x${m.viewBox.h}`,
      el: m.elements, vis: m.visible, off: m.offCanvas, cov: +m.coverage.toFixed(2),
      gUnderTransform: s.underTransform, zeroAreaRect: es.zero, rectAtRightBottomEdge: es.onRightOrBottomEdge,
      sweep })
  }
}
console.table(rows.map(r => ({ name: r.name, kind: r.kind, vb: r.vb, el: r.el, vis: r.vis, off: r.off, cov: r.cov, gUnderTransform: r.gUnderTransform, zeroAreaRect: r.zeroAreaRect, edgeExact: r.rectAtRightBottomEdge })))
console.log('\n=== 若同一份坐标改用别的 viewBox 声明，offCanvas 会是多少 ===')
console.table(rows.map(r => ({ name: r.name, own: r.vb, ...r.sweep })))
