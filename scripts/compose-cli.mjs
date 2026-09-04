// compose-cli.mjs —— 命令行 compose：node scripts/compose-cli.mjs <input.md> <output.html> [mode]
import { readFileSync, writeFileSync } from 'fs'
import { composeMarkdown, svgElementCount } from '../src/lib/compose.ts'

const md = readFileSync(process.argv[2], 'utf8')
const mode = (process.argv[4] || 'auto')
const r = composeMarkdown(md, { mode })
writeFileSync(process.argv[3], r.html, 'utf8')
console.log(`mode=${r.mode} plainChars=${r.plainText.length} htmlBytes=${r.html.length} arts=${r.arts.length} warnings=${r.warnings.length}`)
r.arts.forEach((a, i) => console.log(`art[${i}] elements=${svgElementCount(a.svg)} wide=${a.wide} alt=${a.alt.slice(0, 20)}`))
for (const w of r.warnings) console.log('WARN: ' + w)
