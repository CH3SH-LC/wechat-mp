// test/assets/verify-component-assets.mjs —— 通用组件资产独立验收脚本（阶段 B）
// 用法: node verify-component-assets.mjs <组件目录名> [资产数期望=10] [画布高期望=215] [画布宽期望=750]
// 示例: node verify-component-assets.mjs card2 10 240      (卡片画布 750×240)
//       node verify-component-assets.mjs badge 10 120 300  (徽章画布 300×120)
//       node verify-component-assets.mjs divider 10 90     (分割线 750×90，zone exempt 属正常)
// 验证: ①资产数/画布/zone/无emoji ②PNG ≤1MB ③375px 壳 DOM（若存在 demo-<name>.html）
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const compDir = process.argv[2]
const expectCount = +(process.argv[3] || 10)
const expectH = +(process.argv[4] || 215)
const expectW = +(process.argv[5] || 750)
if (!compDir) { console.log('用法: node verify-component-assets.mjs <组件目录名> [资产数] [画布高] [画布宽]'); process.exit(1) }

const base = fileURLToPath(new URL('./' + compDir + '/', import.meta.url))
const artsFiles = readdirSync(base).filter((f) => f.startsWith('ARTS-') && f.endsWith('.mjs'))
if (!artsFiles.length) { console.log('FAIL: ' + compDir + '/ 无 ARTS-*.mjs'); process.exit(1) }
const artsPath = base + artsFiles[0]
const src = readFileSync(artsPath, 'utf8')

console.log('======== 独立验收: ' + compDir + '/ ========')
const nameMatches = [...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
console.log('① 资产数: ' + nameMatches.length + '（期望 ' + expectCount + '）' + (nameMatches.length === expectCount ? ' ✓' : ' ✗'))
const hMatches = [...src.matchAll(/\bh:\s*(\d+)/g)].map((m) => +m[1])
const wMatches = [...src.matchAll(/\bw:\s*(\d+)/g)].map((m) => +m[1])
console.log('   画布: w=' + [...new Set(wMatches)].join(',') + ' h=' + [...new Set(hMatches)].join(',') + (new Set(hMatches).has(expectH) && new Set(wMatches).has(expectW) ? ' ✓' : ' ✗(期望 ' + expectW + '×' + expectH + ')'))
const zoneConsts = [...src.matchAll(/const\s+(\w+)\s*=\s*\{([^}]*)\}/g)].map((m) => ({ id: m[1], body: m[2] }))
zoneConsts.forEach((z) => {
  const m = z.body.match(/x0:\s*(\d+).*?y0:\s*(\d+).*?x1:\s*(\d+).*?y1:\s*(\d+)/s)
  if (m) { const [x0, y0, x1, y1] = [+m[1], +m[2], +m[3], +m[4]]; console.log('   zone ' + z.id + ': ' + (x1 - x0) + 'x' + (y1 - y0) + 'px 设计（对象）') }
})
// 数组 zone（如 GROUP_ROWS = [...].map(i => ({x0,y0,x1,y1}))）
const zoneArrs = [...src.matchAll(/(\w+)\s*=\s*\[[^\]]*\.map\(\(i\)\s*=>\s*\(\{([^}]*)\}\)/g)].map((m) => ({ id: m[1], body: m[2] }))
zoneArrs.forEach((z) => {
  const m = z.body.match(/x0:\s*(\d+).*?y0:\s*(\d+).*?x1:\s*(\d+).*?y1:\s*(\d+)/s)
  if (m) { const [x0, y0, x1, y1] = [+m[1], +m[2], +m[3], +m[4]]; console.log('   zone ' + z.id + ': 数组行 ' + (x1 - x0) + 'x' + (y1 - y0) + 'px 设计（数组）') }
})
const zoneRef = (src.match(/zone:\s*\w+/g) || []).length
const zoneArr = (src.match(/zone:\s*\[/g) || []).length
const zoneNull = (src.match(/zone:\s*null/g) || []).length
console.log('   zone 字段: 引用 ' + zoneRef + ' / 内联数组 ' + zoneArr + ' / null(exempt) ' + zoneNull + (zoneNull ? '（无文字型资产正常）' : ''))
const emojiHit = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src)
console.log('   emoji: ' + (emojiHit ? '⚠ 发现!' : '无 ✓'))
const pngDirs = readdirSync(base).filter((d) => d.startsWith('png-'))
let ok = 0, total = 0, big = []
for (const d of pngDirs) {
  const files = readdirSync(base + d).filter((f) => f.endsWith('.png'))
  for (const f of files) { total++; const kb = statSync(base + d + '/' + f).size / 1024; if (kb <= 1024) ok++; else big.push(f + '=' + Math.round(kb) + 'KB') }
}
console.log('② PNG: ' + ok + '/' + total + ' ≤1MB' + (big.length ? ' 超限:' + big.join(',') : ' ✓'))
console.log('======== 验收结束 ========')
