import fs from 'node:fs'; import path from 'node:path'
const files = []
const add = d => { if (!fs.existsSync(d)) return; for (const x of fs.readdirSync(d)) { const p=path.join(d,x); if (fs.statSync(p).isDirectory()) add(p); else if (x.endsWith('.svg')) files.push(p) } }
for (const r of process.argv.slice(2)) add(r)
const pats = {
  '<g ': /<g[\s>]/gi, 'transform=': /transform\s*=/gi, '<use': /<use[\s>]/gi,
  '<symbol': /<symbol[\s>]/gi, '<clipPath': /<clipPath[\s>]/gi, '<defs': /<defs[\s>]/gi,
  '<image': /<image[\s>]/gi, 'preserveAspectRatio': /preserveAspectRatio/gi,
  'width=%': /width\s*=\s*["']\d+%/gi, 'translate(-': /translate\(\s*-/gi, 'translate(': /translate\(/gi,
}
const rows = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const r = { file: f.replace(/.*assets[\/]items[\/]/, '').slice(0,28) }
  for (const [k, re] of Object.entries(pats)) r[k] = (s.match(re) || []).length
  rows.push(r)
}
console.table(rows)
console.log('files scanned:', files.length)
