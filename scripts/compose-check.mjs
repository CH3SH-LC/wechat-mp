// compose-check.mjs —— composeMarkdown 转换器校验（第 14/15 轮）
// 用法：node scripts/compose-check.mjs [outDir]
import { composeMarkdown, svgElementCount } from '../src/lib/compose.ts'
import { writeFileSync } from 'fs'

const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210" fill="none">
<rect x="60" y="140" width="5" height="62" fill="#c96f4a"/>
<path d="M65 142 h170 l-24 16 24 16 h-170 z" fill="#e8b48a"/>
<circle cx="628" cy="64" r="36" fill="#f2c76e"/>
<circle cx="640" cy="52" r="5" fill="#ffffff"/>
<path d="M0 210 L160 148 L280 186 L430 112 L570 170 L750 96 V210 Z" fill="#d9a35f" opacity="0.35"/>
<path d="M0 210 L230 158 L390 190 L560 134 L750 172 V210 Z" fill="#c96f4a" opacity="0.22"/>
<path d="M560 40 q12 -20 30 -20 q-4 -14 -22 -14 q-20 0 -26 14 q-8 14 4 22 q10 -6 14 -2z" fill="#5f8d8a" opacity="0.5"/>
</svg>`

const FLOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" fill="none">
<path d="M150 250 C140 180 120 140 90 110" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M150 250 C165 190 195 150 230 130" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="90" cy="104" r="16" fill="#e8b48a"/>
<circle cx="236" cy="124" r="14" fill="#d9a35f"/>
<circle cx="150" cy="150" r="20" fill="#c96f4a"/>
<path d="M120 130 q-26 -8 -34 -30 q28 2 40 18z" fill="#8fb8a4"/>
<path d="M188 170 q24 -14 44 -6 q-10 24 -38 18z" fill="#8fb8a4"/>
<circle cx="90" cy="104" r="6" fill="#f2c76e"/>
</svg>`

const SAMPLE = `[[theme:校园]]

[[banner:新生开学典礼|9 月 1 日上午 8 点 · 东区操场]]

::: art wide 晨光里的旗帜
${FLAG_SVG}
:::

九月第一天，典礼如约而至。这篇清单把当天安排一次看明白。

## 典礼流程

::: steps
- 8:00 集合入场：按班级通道入场，新生从东门进，家长休息区在体育馆二层
- 9:00 典礼开始：校长致辞、新生代表发言、佩戴校徽，全程约 40 分钟
- 9:50 班级班会：典礼后各班回教室，班主任交代入学安排
:::

::: art inline 节奏与小花
${FLOWER_SVG}
:::

::: art deco blossom
${FLOWER_SVG}
:::

> [!KEY|blossom] 记得带
> 录取通知书与身份证、水杯与防晒（户外排队用）

## 你需要准备

- 提前 15 分钟到集合点，找本班引导牌
- 手机调静音，典礼中保持安静
- 带一件薄外套，室内空调较凉

## 提前一晚要做的事

- 把录取通知书、身份证和一张一寸照片装进同一个文件袋，睡前放在门口鞋柜上
- 校服提前熨好挂起，书包只装当天要用的东西，太重反而手忙脚乱
- 设好两个闹钟，间隔十分钟——典礼日早上八点前要站到本班集合点
- 熟悉一遍从校门到东区操场的路，家长可以从体育馆二层入场

这些都做完了，就早睡。典礼日的精神头，一半在前一晚的睡眠里。

## 给家长的话

送完孩子不必急着走。体育馆二层的家长休息区开放到十点半，有饮水与座椅；班主任会在九点五十左右把班会安排发到班级群。如果孩子是第一次住校，可以趁典礼前把宿舍钥匙、水卡的位置再叮嘱一遍——大部分紧张，都在"东西放在哪"上。

开学第一周是适应期，晚上九点后尽量别打电话，让孩子按自己的节奏收拾洗漱；真有急事，宿管老师的电话贴在每层楼梯口。

::: art inline 书本与开始
${FLOWER_SVG}
:::

::: band 斜纹
- 典礼后各班回教室开班会，记得把这份时间表转给同班同学。
:::

::: art wide 花带收尾
${FLOWER_SVG}
:::

[[title:新的开始|box]]

第一堂课从典礼开始。愿你们在这里的每一天，都有新的收获。

[[badge:新生指南]] [[badge:开学典礼]]`

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

const outDir = process.argv[2] || 'docs/artifacts'

// 1) 宣传类样例（校园主题）：mode 自动检测 promo；关键模块渲染；主题色落地
const r = composeMarkdown(SAMPLE, { mode: 'auto' })
check('auto detect promo', r.mode === 'promo' && r.modeLabel === '宣传类', `${r.mode}/${r.modeLabel}`)
check('theme declared not rendered', !r.html.includes('[[theme'))
check('campus theme banner (blue)', r.html.includes('background:#2f6fed;padding:24px 18px'))
check('wrapper white bg (campus)', r.html.startsWith('<section style="background:#ffffff;padding:4px 16px'))
check('steps numbered circles', (r.html.match(/border-radius:50%/g) || []).length >= 3)
check('band rgba pattern', r.html.includes('rgba(') && r.html.includes('band') === false)
check('badge rendered', r.html.includes('border-radius:20px'))
check('title box rendered (campus blue)', r.html.includes('border:2px solid #2f6fed'))
check('key bubble rendered (campus vivid)', r.html.includes('padding:16px 18px 14px;background:#2f6fed'))
check('no emoji/gradient/shadow in output', !/linear-gradient|box-shadow|[\u{1F000}-\u{1FAFF}]/u.test(r.html))
check('plainText non-empty', r.plainText.length > 30, `${r.plainText.length} chars`)
check('no warnings', r.warnings.length === 0, r.warnings.join('|'))
check('bubble deco rendered (corner img)', r.html.includes('width:60px;height:auto;pointer-events:none') && (r.html.match(/@@ART/g) || []).length >= 5)
check('no short-body warning', !r.warnings.some((w) => w.includes('正文偏短')))
const noComp = composeMarkdown('## 标题\n\n- 列表项\n\n正文段落。', { mode: 'text' })
check('componentized warning (no container/bubble)', noComp.warnings.some((w) => w.includes('组件化不足')))
check('SAMPLE componentized clean', !r.warnings.some((w) => w.includes('组件化不足')))
const shortBody = composeMarkdown('::: art deco a\n' + FLOWER_SVG + '\n:::\n\n> [!KEY|b] 标题\n> 内容\n\n正文一句话。', { mode: 'text' })
check('short body warning', shortBody.warnings.some((w) => w.includes('正文偏短')))
check('undefined deco warning', shortBody.warnings.some((w) => w.includes('气泡角饰 b 未定义')))
check('art collected 5 (2 wide)', r.arts.length === 5 && r.arts.filter((a) => a.wide).length === 2, `arts=${r.arts.length}`)
check('art placeholder in html', r.html.includes('@@ART0@@'))
check('art wide img style', r.html.includes('width:100%;height:auto;display:block;margin:12px 0'))

// 1c) 主题：opts.theme（UI）优先于正文声明；日系底色/主色落地
const uiTheme = composeMarkdown(SAMPLE, { mode: 'auto', theme: 'japanese' })
check('opts theme overrides body theme', uiTheme.html.includes('background:#faf3e3;padding:4px 16px') && uiTheme.html.includes('background:#c29b6b;padding:24px 18px'))
const bodyTheme = composeMarkdown('[[theme:国潮]]\n\n[[banner:开业大吉|主标题]]\n\n正文内容。', { mode: 'auto' })
check('body theme guochao applied', bodyTheme.html.includes('background:#fff9ef;padding:4px 16px') && bodyTheme.html.includes('background:#c03a2b;padding:24px 18px'))

// 1a) 素材用量警告：0 处与不足 4 处均提示
const zero = composeMarkdown('## 标题\n\n正文段落，没有任何素材。', { mode: 'text' })
check('zero-art warning', zero.warnings.some((w) => w.includes('未包含美术素材')))
const low = composeMarkdown('::: art inline 一\n' + FLOWER_SVG + '\n:::\n\n::: art inline 二\n' + FLOWER_SVG + '\n:::\n\n正文。', { mode: 'text' })
check('low-art (2) warning', low.arts.length === 2 && low.warnings.some((w) => w.includes('素材用量偏低')))

// 1b) 素材元素计数：样本 ≥6；劣质素材（<6）被拦截
const artSvg = r.arts[0]?.svg || ''
check('sample svg elements >= 6', svgElementCount(artSvg) >= 6, `elements=${svgElementCount(artSvg)}`)
const weak = composeMarkdown('::: art inline 劣质装饰\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#ccc"/></svg>\n:::\n\n正文。', { mode: 'text' })
check('weak svg (1 elem) blocked', weak.arts.length === 0 && weak.warnings.some((w) => w.includes('美术素材未达标')))
check('weak svg no placeholder img', !weak.html.includes('@@ART') && weak.html.includes('未达标已略过'))
const inlineMd = '::: art inline 小装饰\n' + artSvg + '\n:::\n\n正文。'
const inl = composeMarkdown(inlineMd, { mode: 'text' })
check('inline art centered <=56%', inl.arts.length === 1 && inl.arts[0].wide === false && inl.html.includes('max-width:56%'))

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
