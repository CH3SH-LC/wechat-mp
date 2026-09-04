// compose-cli.mjs —— 命令行 compose：node scripts/compose-cli.mjs <input.md> <output.html> [mode]
import { readFileSync, writeFileSync } from 'fs'
import { composeMarkdown } from '../src/lib/compose.ts'

const md = readFileSync(process.argv[2], 'utf8')
const mode = (process.argv[4] || 'auto')
const r = composeMarkdown(md, { mode })
writeFileSync(process.argv[3], r.html, 'utf8')
console.log(`mode=${r.mode} plainChars=${r.plainText.length} htmlBytes=${r.html.length} warnings=${r.warnings.length}`)
for (const w of r.warnings) console.log('WARN: ' + w)
