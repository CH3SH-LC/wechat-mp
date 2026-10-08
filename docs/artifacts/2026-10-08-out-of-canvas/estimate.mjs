// 用"已验收样本"的 字符数/元素数 比率，反推被拦实例的元素规模（估计，非实测）
import { analyzeSvg } from '../../../src/lib/svg-quality.ts'
import fs from 'node:fs'; import path from 'node:path'
const root = process.argv[2]
const rows = []
for (const d of fs.readdirSync(root)) {
  const svg = fs.readFileSync(path.join(root, d, 'source.svg'), 'utf8')
  const meta = JSON.parse(fs.readFileSync(path.join(root, d, 'meta.json'), 'utf8'))
  const m = analyzeSvg(svg, {w:343,h:220})
  rows.push({ name: meta.name, chars: svg.length, el: m.elements, perEl: +(svg.length/m.elements).toFixed(1), off: m.offCanvas })
}
const mean = rows.reduce((s,r)=>s+r.perEl,0)/rows.length
console.log('已验收样本 字符/元素 比率：'); console.table(rows)
console.log('均值 chars/element =', mean.toFixed(1))
// trace 里的 responseLength（=SVG 字符数）与被拦个数
const blocked = [
  ['BIG s7  attempt1 (wide)',   10239, 3],
  ['BIG s9  attempt1 (wide)',   11306, 3],
  ['BIG s4  attempt1 (inline)', 12068, 11],
  ['BIG s3  attempt1 (wide)',   13338, 21],
  ['BIG s4  attempt2 (inline)', 14433, 44],
  ['G2A s1  attempt1',           9561, 30],
  ['G2A s1  attempt2',           9087, 15],
]
console.log('\n被拦实例：元素规模估计与"画布外"占比预估')
console.table(blocked.map(([n, chars, off]) => {
  const el = Math.round(chars / mean)
  return { 实例: n, SVG字符: chars, 元素数估计: `~${el}`, 画布外: off, 占比估计: `~${(100*off/el).toFixed(1)}%` }
}))
