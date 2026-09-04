// compose-check.mjs —— composeMarkdown 转换器校验（第 14 轮）
// 用法：node scripts/compose-check.mjs [outDir]
import { composeMarkdown } from '../src/lib/compose.ts'
import { writeFileSync } from 'fs'

const SAMPLE = `[[banner:新生开学典礼|9 月 1 日上午 8 点 · 东区操场]]

九月第一天，典礼如约而至。这篇清单把当天安排一次看明白。

## 典礼流程

::: steps
- 8:00 集合入场：按班级通道入场，新生从东门进，家长休息区在体育馆二层
- 9:00 典礼开始：校长致辞、新生代表发言、佩戴校徽，全程约 40 分钟
- 9:50 班级班会：典礼后各班回教室，班主任交代入学安排
:::

> [!KEY] 记得带
> 录取通知书与身份证、水杯与防晒（户外排队用）

## 你需要准备

- 提前 15 分钟到集合点，找本班引导牌
- 手机调静音，典礼中保持安静
- 带一件薄外套，室内空调较凉

::: band 斜纹
- 典礼后各班回教室开班会，记得把这份时间表转给同班同学。
:::

[[title:新的开始|box]]

第一堂课从典礼开始。愿你们在这里的每一天，都有新的收获。

[[badge:新生指南]] [[badge:开学典礼]]`

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

const outDir = process.argv[2] || 'D:/deepseek-harness/verify-artifacts'

// 1) 宣传类样例：mode 自动检测 promo；关键模块渲染
const r = composeMarkdown(SAMPLE, { mode: 'auto' })
check('auto detect promo', r.mode === 'promo' && r.modeLabel === '宣传类', `${r.mode}/${r.modeLabel}`)
check('banner rendered (orange bg)', r.html.includes('background:#c96f4a;padding:24px 18px'))
check('steps numbered circles', (r.html.match(/border-radius:50%/g) || []).length >= 3)
check('band rgba pattern', r.html.includes('rgba(') && r.html.includes('band') === false)
check('badge rendered', r.html.includes('border-radius:20px'))
check('title box rendered', r.html.includes('border:2px solid #c96f4a'))
check('key bubble rendered (promo vivid)', r.html.includes('padding:16px 18px 14px;background:#c96f4a'))
check('wrapper present', r.html.startsWith('<section style="padding:4px 16px'))
check('no emoji/gradient/shadow in output', !/linear-gradient|box-shadow|[\u{1F000}-\u{1FAFF}]/u.test(r.html))
check('plainText non-empty', r.plainText.length > 30, `${r.plainText.length} chars`)
check('no warnings', r.warnings.length === 0, r.warnings.join('|'))

// 2) 文字类：显式 text；h2 无编号；列表为 ul
const t = composeMarkdown('# 标题\n\n正文第一段。\n\n## 小节\n\n- 甲\n- 乙\n\n> 引用一句话。', { mode: 'text' })
check('text mode forced', t.mode === 'text')
check('h1/h2 headings', t.html.includes('<h1 style=') && t.html.includes('<h2 style='))
check('ul list', t.html.includes('<ul style='))
check('quote blockquote', t.html.includes('<blockquote'))

// 3) art:// 移除 + 本地图警告 + 表格警告
const a = composeMarkdown('![花枝](art://blossom-branch)\n\n![本地](C:/pic/a.png)\n\n|a|b|\n|-|-|\n|1|2|', { mode: 'text' })
check('art:// removed', !a.html.includes('art://'))
check('art warning', a.warnings.some((w) => w.includes('art://blossom-branch')))
check('local image warning', a.warnings.some((w) => w.includes('本地图片')))
check('table warning', a.warnings.some((w) => w.includes('表格')))
check('table rendered', a.html.includes('<table style='))

// 4) 普通对话文本（无语法）不产生 HTML 结构
const c = composeMarkdown('就是随便聊聊，没有什么排版。', { mode: 'auto' })
check('plain chat text mode text', c.mode === 'text')
check('paragraph wrapped', c.html.includes('<p style='))

writeFileSync(`${outDir}/compose-sample.html`, r.html, 'utf8')
console.log(failed === 0 ? 'COMPOSE OK' : `COMPOSE FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
