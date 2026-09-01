// 验证 Client 源码块语法 + ARTS 数组数量与唯一性
import { readFileSync } from 'node:fs'
import { skillMd } from './lib/env.mjs'

const skill = readFileSync(skillMd, 'utf8')
const blocks = [...skill.matchAll(/````js\n([\s\S]*?)````/g)].map((m) => m[1])
console.log('源码块数量: ' + blocks.length + '（Host ' + blocks[0].length + ' 字符, Client ' + blocks[1].length + ' 字符）')

// Client 语法编译检查
try {
  new Function(blocks[1])
  console.log('Client 语法: OK')
} catch (e) {
  console.log('Client 语法: FAIL ' + e.message)
  process.exit(1)
}

// ARTS 数量与唯一性
const clientSrc = blocks[1]
const artMatch = clientSrc.match(/const ARTS = \[([\s\S]*?)\n    \]/)
const arts = eval('[' + artMatch[1] + ']')
const names = arts.map((a) => a.name)
console.log('ARTS 数量: ' + arts.length)
const dup = names.filter((n, i) => names.indexOf(n) !== i)
console.log('重复名: ' + (dup.length ? dup.join(',') : '无'))
const svgOk = arts.every((a) => a.svg.startsWith('<svg') && a.svg.endsWith('</svg>'))
console.log('SVG 完整性: ' + (svgOk ? 'OK' : 'FAIL'))
console.log('资产名列表: ' + names.join(', '))
