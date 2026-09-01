// v10 知识库全库扫描：找出残留的 emoji 字符、图标字符、渐变写法（排除禁令说明与 art:// 图案纹理）
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { knowledgeDir } from './lib/env.mjs'

const root = knowledgeDir
// 活跃知识库（排除 legacy 归档：legacy 是历史原貌，仅回查不调用）
const activeRoot = root + '/..'
// emoji 区：表情/符号区（不含文档流程箭头 → U+2192 与 ➜ U+279C，那是文档说明文字，非推文图标）
const emojiRe = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2B00-\u2BFF]/u
const iconCharRe = /[❀✦▸➤★☆◆●▲✓✗💡✨⚠🚫⭐🎉🎯🏃🤝💪📌🔥✅🔔🎓📚🏀🍀💼📈🀄🏮🚩✳✧⬤🔖🗨]/u
const gradRe = /linear-gradient|radial-gradient/g

function walk(dir, skipLegacy) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (skipLegacy && name === 'legacy') continue
    if (statSync(p).isDirectory()) out.push(...walk(p, skipLegacy))
    else if (p.endsWith('.md')) out.push(p)
  }
  return out
}

let emojiFiles = 0
let gradFiles = 0
let checked = 0
for (const f of walk(root, true)) {
  const txt = readFileSync(f, 'utf8')
  checked++
  const lines = txt.split(/\r?\n/)
  const emojiLines = []
  const gradLines = []
  lines.forEach((l, i) => {
    // 跳过"禁令说明"行（列举禁止字符的文档说明）与 v10 规范注释行
    const isBanDoc = /禁止|不得|禁用|禁令|零 emoji|零图标|不用 emoji|忌 emoji|删除|违和|花哨|俗用|别放|不让|拒绝|绝不用|不出现|全库|规范|条款/.test(l)
    if (emojiRe.test(l) && !isBanDoc) emojiLines.push((i + 1) + ': ' + l.trim().slice(0, 80))
    if (iconCharRe.test(l) && !isBanDoc) emojiLines.push((i + 1) + ' [图标字符]: ' + l.trim().slice(0, 80))
    const grad = l.match(gradRe)
    // 渐变出现在示例 HTML/CSS 中且不是"禁用"说明 → 残留
    if (grad && /background|border-radius|样式|style|#[0-9a-fA-F]{3,6}→|→/.test(l) && !isBanDoc && !/花纹纹理|repeating-gradient 属|图案纹理/.test(l)) {
      gradLines.push((i + 1) + ': ' + l.trim().slice(0, 90))
    }
  })
  if (emojiLines.length) {
    emojiFiles++
    console.log('=== ' + f.replace(root, '') + '（emoji/图标字符残留）')
    for (const e of emojiLines.slice(0, 6)) console.log('  ' + e)
    if (emojiLines.length > 6) console.log('  ... 共 ' + emojiLines.length + ' 处')
  }
  if (gradLines.length) {
    gradFiles++
    console.log('=== ' + f.replace(root, '') + '（渐变写法残留）')
    for (const g of gradLines.slice(0, 6)) console.log('  ' + g)
    if (gradLines.length > 6) console.log('  ... 共 ' + gradLines.length + ' 处')
  }
}
console.log('\n扫描 ' + checked + ' 个文件：emoji/图标字符残留 ' + emojiFiles + ' 个文件，渐变写法残留 ' + gradFiles + ' 个文件')
