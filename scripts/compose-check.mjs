// R26：样例显式声明版式——`[[theme:]]` 不再顺带决定版式，样例该有的长相要自己写出来。

﻿// compose-check.mjs —— composeMarkdown 转换器校验（第 14/15 轮）
// 用法：node scripts/compose-check.mjs [outDir]
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult → run-result.json + 退出码；零条检查是 ERROR 而不是"通过"。
import { buildAuthorUnits, composeMarkdown, faceFromSpec, projectionOf, resolveBoxScheme, resolveFaceSpec, svgElementCount } from '../src/lib/compose.ts'
import { checkHtml } from '../src/lib/quality.ts'
import { PALETTES, resolveTheme } from '../src/lib/palettes.ts'
import { MARK_KEYS, MARK_LABEL, THEME_MARKS, markDataUrl } from '../src/lib/marks.ts'
import { buildReviseContent, fixableWarnings, locateIssues } from '../src/lib/revise.ts'
import { createJudge, guardCrashes, parseRunnerArgs } from './lib/run-result.mjs'
import { mkdirSync, writeFileSync } from 'fs'
import { createHash } from 'node:crypto'
import { ornamentDataUrl } from '../src/lib/ornaments.ts'

// P1：组件化/素材配额按成品长度分档（<600 字为短篇档，不再强塞组件）。
// 需要触发长文档警告的用例必须先把正文撑过 600 字。
const FILLER = '这是一段用来把正文撑到长文档位的填充文字，重复若干遍以确保总长度超过六百字。'.repeat(18)

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
[[boxes:亲和;radius=14]]

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
// 用统一解析：既认位置参数、也认 `--out <dir>`，并且**判定目录与产物目录用同一个值**。
// 之前这里是 `const outDir = process.argv[2]`（原样吃位置参数）、只有 judge 走 resolveOutDir——
// 于是 `--out <dir>` 时判定结果去了对的地方，`compose-sample.html` 却写进了一个叫 `--out/` 的目录
// （实测在仓库根建出来过）。证据要么在正确的地方，要么别声称有。
const { outDir } = parseRunnerArgs()
// minChecks：2026-10-01 实测 98 条。没有可分场景前缀的 runner 靠它证明"执行完整"——
// 只跑得起一条也算 PASS 的话，断言被静默删掉就没人会发现。2026-10-11 R23 实测 215 条（+4：宣传类"纯色气泡"禁令）。
const judge = createJudge({ script: 'compose-check', outDir, minChecks: 420 }) // R38 321 条 + R39 原生装饰、原图、旧版 18 样本与标题/角标回归
guardCrashes(judge)
mkdirSync(outDir, { recursive: true })
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

// R23：横幅不再是实色块（"整篇无任何色块"）⇒ "主题色落地"的判据从 `background:#hex` 改为**线条色**：
// 横幅现在用同一主题色画**上下夹线**（`rgba(主题色,0.5)`）。下面这个小工具把 hex 转成引擎用的 rgba 写法。
const hexToRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
// 横幅的形态随 `frame` 变（line→下划线、plane→上下夹线、stack→双层框…），所以判据放宽成
// "某条 border 用的是这个主题色的 rgba"——既钉住"主题色确实落地"，也不绑死某一种线条。
const bannerHasLine = (html, hex) => {
  const n = parseInt(hex.slice(1), 16)
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
  return new RegExp('border[^;"]*(?:' + hex + '|rgba\\(\\s*' + rgb + '\\s*,)').test(html)
}

// 1) 宣传类样例（校园主题）：mode 自动检测 promo；关键模块渲染；主题色落地
const r = composeMarkdown(SAMPLE, { mode: 'auto' })
check('auto detect promo', r.mode === 'promo' && r.modeLabel === '宣传类', `${r.mode}/${r.modeLabel}`)
check('theme declared not rendered', !r.html.includes('[[theme'))
check('campus theme banner (blue, 走线条而非色块)', bannerHasLine(r.html, '#2f6fed'))
check('wrapper white bg (campus)', r.html.startsWith('<section style="background:#ffffff;padding:4px 16px'))
check('steps numbered circles', (r.html.match(/border-radius:50%/g) || []).length >= 3)
check('band rgba pattern', r.html.includes('rgba(') && r.html.includes('band') === false)
check('badge rendered', r.html.includes('border-radius:20px'))
check('title box rendered (campus blue)', r.html.includes('border:2px solid #2f6fed'))
// P0：气泡底部内边距改为按角饰实际高度预留（避免压字 / vivid 气泡 overflow:hidden 裁切）。
// **R23（2026-10-11）：那条 promo 专属的"实色反白"分支被用户整体禁掉了**——
// 原话"为什么依旧是纯色圆角矩形气泡？完全禁止掉这种气泡设计"。
// 所以这里不再断言"KEY 以主题主色实色渲染"，改为断言**反过来的事**：KEY 气泡在场、语义标签在场、
// 且**它身上没有不透明底色**。判据见下面的「气泡底色必须是带透明度的 rgba」那一组。
const vividSegs = []
for (let idx = r.html.indexOf('>重点<'); idx >= 0; idx = r.html.indexOf('>重点<', idx + 1)) {
  const open = r.html.lastIndexOf('<section style="', idx)
  vividSegs.push(r.html.slice(open, r.html.indexOf('>', open))) // **只看开标签**：段内还有角标 span 的实色芯片
}
check('key bubble rendered (campus, 非实色)', vividSegs.length >= 1 && vividSegs.every((s) => !/background:#[0-9a-fA-F]{3,8}\b/.test(s)), `segs=${vividSegs.length} 底色=${vividSegs.map((s) => (s.match(/background:[^;"]+/) || ['(无)'])[0].slice(0, 24)).join('|')}`)
check('no emoji/gradient/shadow in output', !/linear-gradient|box-shadow|[\u{1F000}-\u{1FAFF}]/u.test(r.html))
check('plainText non-empty', r.plainText.length > 30, `${r.plainText.length} chars`)
check('no warnings', r.warnings.length === 0, r.warnings.join('|'))
check('bubble deco rendered (corner img)', r.html.includes('width:60px;height:auto;max-height:56px;pointer-events:none') && (r.html.match(/@@ART/g) || []).length >= 5)
check('no short-body warning', !r.warnings.some((w) => w.includes('正文偏短')))
const noComp = composeMarkdown(`## 标题\n\n- 列表项\n\n${FILLER}`, { mode: 'text' })
check('componentized warning (no container/bubble)', noComp.warnings.some((w) => w.includes('组件化不足')))

// P1（2026-09-24 调查 §5）：短通知不得被强塞组件与素材，也不得因此触发整篇自动重写
const shortNotice = composeMarkdown('## 停水通知\n\n明天上午 9 点到 11 点停水，请提前储水。\n\n- 请提前储水\n', { mode: 'text' })
check('短通知不报组件化不足', !shortNotice.warnings.some((w) => w.includes('组件化不足')), shortNotice.warnings.join('|'))
check('短通知不报素材配额', !shortNotice.warnings.some((w) => w.includes('素材用量偏低') || w.includes('未包含美术素材')))
check('短通知给出非可修复的短篇提示', shortNotice.warnings.some((w) => w.includes('短篇提示')))
check('短通知不触发自动重写', fixableWarnings(shortNotice.warnings).length === 0, JSON.stringify(fixableWarnings(shortNotice.warnings)))
// 长文仍按原口径要求组件（短篇放宽不得顺带废掉长文质量闸门）
check('长文仍报组件化不足', noComp.warnings.some((w) => w.includes('组件化不足')))
check('SAMPLE componentized clean', !r.warnings.some((w) => w.includes('组件化不足')))
const shortBody = composeMarkdown('::: art deco a\n' + FLOWER_SVG + '\n:::\n\n> [!KEY|b] 标题\n> 内容\n\n正文一句话。', { mode: 'text' })
check('short body warning', shortBody.warnings.some((w) => w.includes('正文偏短')))
check('undefined deco warning', shortBody.warnings.some((w) => w.includes('气泡角饰 b 未定义')))
check('art collected 5 (2 wide)', r.arts.length === 5 && r.arts.filter((a) => a.wide).length === 2, `arts=${r.arts.length}`)
check('art placeholder in html', r.html.includes('@@ART0@@'))
check('art wide img style', r.html.includes('width:100%;height:auto;display:block;margin:12px 0'))

// 1e) P0（2026-09-24 调查 §2）：角饰块多别名——一个 `::: art deco` 定义可被多个引用词命中，
// 且只占一个 arts 条目（否则 @@ARTn@@ 索引与素材用量统计错位）。
const multiAlias = composeMarkdown(
  '::: art deco aliasA aliasB asset-id\n' + FLOWER_SVG + '\n:::\n\n> [!KEY|aliasB] 标题\n> 内容\n\n> [!TIP|aliasA] 标题\n> 内容',
  { mode: 'text' },
)
check('multi-alias deco registers one art', multiAlias.arts.length === 1, `arts=${multiAlias.arts.length}`)
check('multi-alias deco resolves aliasB', !multiAlias.warnings.some((w) => w.includes('aliasB 未定义')))
check('multi-alias deco resolves aliasA', !multiAlias.warnings.some((w) => w.includes('aliasA 未定义')))
check('multi-alias deco renders both bubbles', (multiAlias.html.match(/@@ART0@@/g) || []).length === 2)

// P0：角饰避让——气泡底部内边距随角饰高度变化（方角饰比扁角饰留得多）
const tallDeco = '::: art deco t\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none"><circle cx="220" cy="220" r="40" fill="#c96f4a"/><circle cx="250" cy="200" r="18" fill="#e8b48a"/><path d="M170 260 q30 -30 80 -20" stroke="#5f8d8a" stroke-width="4" fill="none"/><circle cx="200" cy="250" r="10" fill="#8fb8a4"/></svg>\n:::\n\n> [!KEY|t] 标题\n> 内容'
const flatDeco = '::: art deco f\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" fill="none"><circle cx="220" cy="80" r="30" fill="#c96f4a"/><circle cx="255" cy="60" r="14" fill="#e8b48a"/><path d="M170 130 q30 -20 80 -14" stroke="#5f8d8a" stroke-width="4" fill="none"/><circle cx="195" cy="110" r="9" fill="#8fb8a4"/></svg>\n:::\n\n> [!KEY|f] 标题\n> 内容'
// R16：断言语义——「角饰越高、承载它的气泡底部预留越多」，不绑死 padding 常量。
// 取法：定位角饰 <img>，往前找**最近一处** `padding:` 声明，取第 3 个值（三段式）或第 1 个值（两段式）。
// 两种模式都要成立（text 的 KEY 是夹线型、padding 为两段式，vivid 是嵌套 section）。
const decoBottomPad = (html) => {
  const i = html.indexOf('pointer-events:none')
  if (i < 0) return -1
  const m = [...html.slice(0, i).matchAll(/padding:([^;"]+)/g)].pop()
  if (!m) return -1
  const nums = m[1].split(/\s+/).map((v) => parseFloat(v)).filter((n) => !Number.isNaN(n))
  return nums.length >= 3 ? nums[2] : (nums[0] ?? -1)
}
for (const mode of ['auto', 'text']) {
  const tallPad = decoBottomPad(composeMarkdown(tallDeco, { mode }).html)
  const flatPad = decoBottomPad(composeMarkdown(flatDeco, { mode }).html)
  check(`deco clearance grows with ornament height (${mode})`, tallPad > flatPad && flatPad >= 12, `tall=${tallPad} flat=${flatPad}`)
}
const cappedPad = decoBottomPad(composeMarkdown(tallDeco, { mode: 'auto' }).html)
check('deco clearance capped', cappedPad <= 76, `tall=${cappedPad}`)

// ---- R16/R18（2026-10-09）：气泡按语义分化容器语言 + 编辑感排版 ----
// ---- R21（2026-10-09 二轮）：默认语言**去掉底色与全包裹框** ----
// 用户判词："不像劣质的全包裹圆角矩形纯浅色背景这种AI味重的气泡"。
// 判据因此从"五种语义各有一套容器语言"收紧为：**默认气泡根本不铺底、不整圈包框**，
// 轻重靠**竖线粗细**（3 < 4 < 5）与重语义的**半包围夹线**承担，警报集中在标签 chip 上。
const FIVE = ['NOTE', 'TIP', 'WARN', 'DANGER', 'KEY'].map((k) => `> [!${k}] 标签测试\n> 正文一句。`).join('\n\n')
const five = composeMarkdown(FIVE, { mode: 'text' }).html
// ① 不铺底、不整圈包框、不圆角矩形——这三条合起来正是被点名的"AI 味"长相。
// 唯一允许带 background 的 section 是**文章根容器**（整页白底），气泡本身一律没有。
check('R21 默认气泡不铺底（没有"全包裹浅色面板"）',
  (five.match(/<section style="[^"]*background:/g) || []).length === 1,
  `带底色的 section 数=${(five.match(/<section style="[^"]*background:/g) || []).length}（应为 1，即文章根容器）`)
check('R21 默认气泡不整圈包框（只有 border-left / border-top / border-bottom）', !/<section style="[^"]*[^-]border:/.test(five))
check('R21 默认气泡不是圆角矩形', !/<section style="[^"]*border-radius:/.test(five))
// ---- R23（2026-10-11）：**宣传类也不许再有"纯色圆角矩形气泡"** ----
//
// 用户原话："为什么依旧是纯色圆角矩形气泡？完全禁止掉这种气泡设计"。
// 被禁掉的是 promo 专属的 `solid` 分支（KEY/TIP/DANGER 整块实色 + 白字 + 圆角）。
// 上面 R21 那三条只管 `mode=text`；**宣传类此前恰好绕过它们**（`solid` 把底铺满），
// 所以这里对 promo 独立再断言一遍——**判据是"底色必须带透明度"**：
// 旧实色是 `background:#2f6fed`（不透明十六进制），新形态是 `background:rgba(...)`。
const promoSix = composeMarkdown(['NOTE', 'TIP', 'WARN', 'DANGER', 'KEY'].map((k) => `> [!${k}] 标签${k}\n> 正文一句。`).join('\n\n'), { mode: 'promo' }).html
const bubbleSecsOf = (html) =>
  ['标签NOTE', '标签TIP', '标签WARN', '标签DANGER', '标签KEY']
    .map((tag) => {
      const at = html.indexOf('>' + tag + '<')
      if (at < 0) return null
      const open = html.lastIndexOf('<section style="', at)
      return html.slice(open, html.indexOf('>', open))
    })
    .filter(Boolean)
const promoBubbles = bubbleSecsOf(promoSix)
const opaqueBg = (style) => /background:#[0-9a-fA-F]{3,8}\b/.test(style) || /background:rgb\(/.test(style)
check('R23 宣传类五种语义的气泡全都在场（取样成功，否则下面的断言是空断言）',
  promoBubbles.length === 5, `取到 ${promoBubbles.length}/5`)
check('R38 宣传类未声明 fill 时保持无底默认',
  promoBubbles.length === 5 && promoBubbles.every((s) => !opaqueBg(s)),
  promoBubbles.map((s) => (s.match(/background:[^;"]+/) || ['(无底)'])[0]).join(' | '))
// 自证伪：这条判据必须真能抓住旧的实色形态，否则它是条永远为真的空断言。
check('R23 该判据能抓住旧的实色气泡（自证伪）',
  opaqueBg('<section style="background:#c96f4a;border-radius:14px">') &&
    opaqueBg('<section style="background:rgb(201,111,74);padding:13px">') &&
    !opaqueBg('<section style="background:rgba(201,111,74,0.1);padding:13px">'))
// 语义差别改由**语义色（竖线/夹线）+ 标签文字 + 角标图案**承担——不再靠"铺一块实色"。
// 判据：五个气泡的**线条语义色**两两不同（NOTE 3px / TIP 4px / WARN 5px+夹线 / DANGER 5px+夹线 / KEY 上下夹线）。
// NOTE/TIP/WARN/DANGER 走 bar（竖线色是**不透明**语义色），KEY 走 rules（夹线是**半透明**同色系）——
// 所以这里要求"四条竖线色两两不同"，再加一条"KEY 是上下夹线语言"。
const promoRailHex = promoBubbles.map((s) => (s.match(/(?:border-left|border-top):\d+px solid (#[0-9a-fA-F]{6})/) || [])[1]).filter(Boolean)
const promoKeyOpen = promoBubbles.find((s) => s.includes('border-top:'))
check('R23 宣传类五语义靠"语义色 + 线条轻重"区分（四条竖线色互不相同 + KEY 走上下夹线）',
  promoRailHex.length >= 4 && new Set(promoRailHex).size >= 4 && Boolean(promoKeyOpen && promoKeyOpen.includes('border-bottom:')),
  `${promoRailHex.join(',')} | KEY=${promoKeyOpen ? 'rules' : '(未找到)'}`)
// ② 轻重阶梯落在**竖线粗细**上：NOTE 3 < TIP 4 < WARN/DANGER 5（越重越粗）。
check('R21 note=3px 竖线', five.includes('border-left:3px solid '))

// ---- R24（2026-10-11）：**八种结构不同的气泡骨架** ----
//
// 用户判词："同一种结构，只是切换了非常简单的图标，不能说有很多的不同设计……给出更多的气泡设计"。
// 所以这里断言的不是"图案不同"，而是**结构不同**：每种骨架必须能靠一段**独有的结构签名**被认出来。
const SHAPES8 = ['rail', 'medal', 'index', 'cap', 'hanger', 'side', 'quote', 'bracket']
const shapeHtml = (sp, extra = '') => composeMarkdown(`[[boxes:frame=line;shape=${sp}${extra}]]\n\n> [!TIP] 换书先看版权页\n> 教材类留意版次：同一本书差一个版次。\n`, { mode: 'text' }).html
const sig = {
  rail: (h) => /border-left:\d+px solid #/.test(h) && /position:absolute;left:-\d+px;top:0;width:22px/.test(h),
  medal: (h) => /width:44px;height:44px/.test(h) && /border:2px solid #/.test(h) && /flex:1;min-width:0/.test(h),
  index: (h) => /font-size:29px/.test(h) && />01</.test(h) && /Georgia,serif/.test(h),
  cap: (h) => /width:22px;height:2px;background:#/.test(h) && !/border-left:\d+px solid #/.test(h),
  hanger: (h) => /position:absolute;left:9px;top:14px;width:44px;text-align:left/.test(h) && /padding:13px 16px \d+px 60px/.test(h),
  side: (h) => /writing-mode:vertical-rl/.test(h) && /align-self:flex-start/.test(h),
  quote: (h) => /height:74px/.test(h) && /transform:scale\(4\);transform-origin:0 0/.test(h) && /Georgia,'Songti SC','SimSun',serif/.test(h),
  bracket: (h) => (h.match(/border-left:2px solid #[0-9a-f]{6};border-top:2px solid #/g) || []).length === 1 && (h.match(/border-right:2px solid #[0-9a-f]{6};border-bottom:2px solid #/g) || []).length === 1,
}
const shapeBuilt = {}
for (const sp of SHAPES8) shapeBuilt[sp] = shapeHtml(sp)
check('R24 八种骨架各自到场（取样成功，否则下面的断言是空断言）', SHAPES8.every((sp) => shapeBuilt[sp].length > 80), SHAPES8.map((sp) => `${sp}:${shapeBuilt[sp].length}`).join(' '))
const shapeMiss = SHAPES8.filter((sp) => !sig[sp](shapeBuilt[sp]))
check('R24 每种骨架都有**它自己的结构签名**（不是同一套结构换图案）', shapeMiss.length === 0, shapeMiss.length ? '未命中：' + shapeMiss.join(',') : '8/8')
check('R24 八种结构**两两不同**（结构签名互不重合）', new Set(SHAPES8.filter((sp) => sig[sp](shapeBuilt[sp]))).size === 8, SHAPES8.filter((sp) => sig[sp](shapeBuilt[sp])).join(','))
check('R24 每种骨架都过 checkHtml 且不含未渲染占位', SHAPES8.every((sp) => checkHtml(shapeBuilt[sp]).ok && !/undefined|@@ART/.test(shapeBuilt[sp])), SHAPES8.map((sp) => sp + ':' + checkHtml(shapeBuilt[sp]).ok).join(' '))
// R38 保留旧默认：没有显式 fill 的八种骨架仍无底色。
check('R38 八种旧骨架未声明 fill 时仍无底色',
  SHAPES8.every((sp) => !/<section style="[^"]*padding:[^"]*background:(#|rgb\(|rgba\()/.test(shapeBuilt[sp])),
  SHAPES8.filter((sp) => /<section style="[^"]*padding:[^"]*background:(#|rgb\(|rgba\()/.test(shapeBuilt[sp])).join(',') || '8/8 干净')
// 序号骨架按正文顺序自动编号（01 → 02）
const twoIndex = composeMarkdown('[[boxes:frame=line;shape=index]]\n\n> [!TIP] 甲\n> 一。\n\n> [!NOTE] 乙\n> 二。\n', { mode: 'text' }).html
check('R24 序号骨架按正文顺序自动编号（01 → 02）', twoIndex.includes('>01<') && twoIndex.includes('>02<'), (twoIndex.match(/>(0\d)</g) || []).join(','))
// 口径收紧（2026-10-11 完整 demo 读图复核踩到）：**只数用了 shape=index 的气泡**，
// 且**遇到 `##` 归零**——否则"三条读法"里前面那个普通 rail 提示会把清单顶到 02 起。
const seqScoped = composeMarkdown('[[boxes:frame=line;shape=index]]\n\n> [!NOTE] 普通一\n> 甲。\n\n## 小节\n\n> [!TIP] 要点一\n> 乙。\n\n> [!TIP] 要点二\n> 丙。\n', { mode: 'text' }).html
check('R24 序号只数 index 骨架的气泡、且遇 `##` 归零（清单从 01 起）',
  seqScoped.includes('>01<') && seqScoped.includes('>02<') && !seqScoped.includes('>03<'),
  (seqScoped.match(/>(0\d)</g) || []).join(','))
// R24 续：`[[boxes:…]]` 改为**流式**（从它那一行起生效）——此前只有第一条生效，
// 于是"要点用序号骨架、金句用引文骨架"在引擎里做不到。
const streamAxes = composeMarkdown('[[boxes:frame=line;shape=rail]]\n\n> [!NOTE] 甲标题\n> 一。\n\n[[boxes:frame=line;shape=medal]]\n\n> [!TIP] 乙标题\n> 二。\n', { mode: 'text' }).html
const posA = streamAxes.indexOf('>甲标题<')
const posB = streamAxes.indexOf('>乙标题<')
const posMedal = streamAxes.indexOf('width:44px;height:44px')
const posRail = streamAxes.search(/border-left:\d+px solid #/)
check('R24 骨架声明是**流式**的：第二条 `[[boxes:…]]` 从它那一行起换骨架',
  posA > 0 && posB > posA && posRail > 0 && posRail < posA && posMedal > posA && posMedal < posB,
  `甲标题@${posA} 乙标题@${posB} 竖线@${posRail} 徽章@${posMedal}`)
check('R24 流式声明不影响它之前的内容（只向后生效）',
  posRail > 0 && posRail < posA && (streamAxes.slice(posRail, posA).match(/width:44px;height:44px/) || []).length === 0,
  '甲仍是 rail')
// R24 续：`::: cols` 超过 3 项 → **降级为纵向排列**并出声。
// 起因：完整 demo 第 2 屏读图复核实测——375px 下 4 列每列只剩 ~76px、内距吃掉一半，
// **每行只排得下 2 个汉字**，正文被压成"竖直细条"，读者根本读不了。宁可排成竖列也别出这种成品。
const bigCols = composeMarkdown('::: cols\n- 甲项\n- 乙项\n- 丙项\n- 丁项\n:::\n', { mode: 'text' })
check('R24 分栏超 3 项 → 降级为纵向排列（不出"每行 2 个字"的成品）',
  bigCols.warnings.some((w) => w.includes('分栏最多 3 项')) && !/display:flex;align-items:stretch/.test(bigCols.html),
  `warn=${bigCols.warnings.length} 并排=${/display:flex;align-items:stretch/.test(bigCols.html)}`)
check('R24 分栏列数**按内容长度**决定：项短才 3 列，整句退到 2 列 + 换行',
  // 已实测：375px 下 3 列每列约 105px、每行 4 个字，装整句会把词拦腰拆开（"权力"断成 权/力）
  /width:33\.3%/.test(composeMarkdown('::: cols\n- 甲\n- 乙\n- 丙\n:::\n', { mode: 'text' }).html) &&
    /width:calc\(50% - 6px\)/.test(composeMarkdown('::: cols\n- 这是很长的一句话，用来验证整句时长分栏会退到两列排列\n- 第二句同样很长，也需要退到两列才读得舒服一些\n- 第三句也不短，一起验证这条规则确实生效了\n:::\n', { mode: 'text' }).html),
  '短项→' + (/width:33\.3%/.test(composeMarkdown('::: cols\n- 甲\n- 乙\n- 丙\n:::\n', { mode: 'text' }).html) ? '3列' : '?') + '；长项→' + (/width:calc\(50% - 6px\)/.test(composeMarkdown('::: cols\n- 这是很长的一句话，用来验证整句时长分栏会退到两列排列\n- 第二句同样很长，也需要退到两列才读得舒服一些\n- 第三句也不短，一起验证这条规则确实生效了\n:::\n', { mode: 'text' }).html) ? '2列' : '?'))
check('R24 三项短分栏仍走并排（没把正常用法一起废掉）', 
  /display:flex;align-items:stretch/.test(composeMarkdown('::: cols\n- 甲项\n- 乙项\n- 丙项\n:::\n', { mode: 'text' }).html))
// ---- R26：**配色风格 与 版式 解耦** ----
//
// 用户判词："原来的格式是格式，配色被绑定到格式上了，现在要把配色风格和板式分开"。
// 解耦的判据必须是**可证伪的结构事实**：同一版式换配色后，去掉颜色两版**逐字相同**；
// 以及"只写主题"不再顺带套上某个版式（否则又有耦合）。
// 注：除了颜色，还要剥掉**角标图案的 data-URI**——图案词汇属于**风格层**（`THEME_MARKS`：
// 森系长叶子、校园长星星），它是「风格」的一部分，不是版式。这条断言只证「**版式**不受配色影响」。
const stripColor = (h) => String(h)
  .replace(/src="data:[^"]*"/g, 'src="data:C"')
  .replace(/#[0-9a-fA-F]{3,8}/g, '#C')
  .replace(/rgba?\([^)]*\)/g, 'rgba(C)')
const mixDoc = (theme, boxes) => composeMarkdown(`[[theme:${theme}]]\n[[boxes:${boxes}]]\n\n## 小标题\n\n正文一句。\n\n> [!TIP] 技巧\n> 一句。\n`, { mode: 'text' }).html
check('R26 **解耦证据**：同一版式换配色，去掉颜色后逐字相同（配色不动结构）',
  stripColor(mixDoc('校园', '杂志')) === stripColor(mixDoc('薄荷', '杂志')),
  stripColor(mixDoc('校园', '杂志')) === stripColor(mixDoc('薄荷', '杂志')) ? '两份去色后一致' : '去色后仍不同 ⇒ 配色还在影响结构')
check('R26 **解耦证据**：同一配色换版式，结构确实不同（版式独立生效）',
  stripColor(mixDoc('校园', '杂志')) !== stripColor(mixDoc('校园', '编辑感')),
  '')
check('R26 风格化扩充：色板表 ≥14 个，且新增的 6 个风格都能按中文名解析',
  PALETTES.length >= 14 && ['杂志', '报纸', '奶油', '薄荷', '赤陶', '靛蓝'].every((l) => Boolean(resolveTheme('[[theme:' + l + ']]'))),
  PALETTES.map((x) => x.label).join(','))
check('R26 配色 × 版式 任意组合都过 checkHtml（16 组抽样）',
  ['校园', '薄荷', '赤陶', '靛蓝'].every((th) => ['编辑感', '杂志', '手账', '科技'].every((bx) => checkHtml(mixDoc(th, bx)).ok)),
  '')
// R26 续：**配色要真的到达气泡**。此前气泡的语义色是 DESIGNS 里的固定常量、与主题无关，
// "换个风格"气泡颜色几乎不变——那等于配色没落到最显眼的组件上。
const tipCard = (th) => composeMarkdown(`[[theme:${th}]]\n[[boxes:frame=line]]\n\n> [!TIP] 技巧\n> 一句。\n`, { mode: 'text' }).html
const railOf = (h) => (h.match(/border-left:\d+px solid (#[0-9a-fA-F]{6})/) || [])[1]
check('R26 配色确实到达气泡：两种风格的 TIP 语义色不同（不再是固定常量）',
  Boolean(railOf(tipCard('校园'))) && railOf(tipCard('校园')) !== railOf(tipCard('靛蓝')),
  `校园=${railOf(tipCard('校园'))} 靛蓝=${railOf(tipCard('靛蓝'))}`)
const lumOf = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
}
const cwOf = (hex) => 1.05 / (lumOf(hex) + 0.05)
const semBad = PALETTES.filter((p) => [p.sub, p.tip, p.warn, p.danger].some((c) => !/^#[0-9a-fA-F]{6}$/.test(c) || cwOf(c) < 3))
check('R26 每种风格的四个语义色都与白底 ≥3:1（大字/图形下限；15 个风格全过）',
  semBad.length === 0, semBad.length ? semBad.map((x) => x.key).join(',') : `${PALETTES.length} 个风格全过`)
// 未知名不生效、不崩（走既有"未知轴"口径）
const badShape = composeMarkdown('[[boxes:shape=弯曲的样式]]\n\n> [!NOTE] 提示\n> 正文。', { mode: 'text' })
check('R24 认不出的骨架名 → 出声且回退默认（不静默变形）', badShape.warnings.some((w) => w.includes('组件设计轴')) && /border-left:\d+px solid #/.test(badShape.html), badShape.warnings.slice(0, 1).join('|'))

// R38：这些样例没有显式 fill，继续锁住旧默认；显式浅底在下方单独验证。
const NO_BLOCK = `[[theme:校园]]
[[boxes:frame=line]]

> [!NOTE] 提示
> 正文。

> [!KEY] 重点
> 正文。

::: card 卡片
- 一
:::

::: steps
- 一步
:::

::: cols
- 甲
- 乙
:::

::: band 波点
- 带
:::

::: timeline
- 节点
:::

::: frame
- 框
:::

> 一句引用。

## 小标题

正文 [[badge:徽章]] 一句。

---
`
const noBlockHtml = composeMarkdown(NO_BLOCK, { mode: 'promo' }).html
const secStyles = [...noBlockHtml.matchAll(/<section style="([^"]*)"/g)].map((m) => m[1])
const rootStyle = secStyles[0] || ''
const isBlockBg = (s) => /padding:/.test(s) && (/background:#[0-9a-fA-F]{3,8}\b/.test(s) || /background:rgb\(/.test(s) || /background:rgba\(/.test(s))
const blockBgs = secStyles.slice(1).filter(isBlockBg)
check('R38 未声明 fill 的旧默认全文不铺内容底色',
  rootStyle.includes('background:#ffffff') && blockBgs.length === 0,
  `section 数=${secStyles.length}｜带底色的块=${blockBgs.length}｜${blockBgs.slice(0, 3).map((s) => (s.match(/background:[^;"]+/) || [''])[0]).join(' | ')}`)
// 自证伪：这条判据必须真能抓住旧的浅底容器，否则它是永远为真的空断言。
// 边界（如实断言，免得"整篇无任何色块"被当成连标题带也管）：横幅仍是实色块。
// 横幅与居中装饰标题**也不再是实色块**（它们曾是全篇最大的一块色）。
// 判据：两者都不得出现不透明底，且横幅的主题色**改由线条承载**。
check('R23 横幅 / 居中装饰标题也不是色块（主题色改由线条承载）',
  !composeMarkdown('[[theme:校园]]\n\n[[title:装饰标题]]\n', { mode: 'promo' }).html.includes('background:#2f6fed') &&
  !composeMarkdown('[[theme:校园]]\n\n[[banner:横幅|副标题]]\n', { mode: 'promo' }).html.includes('background:#2f6fed') &&
  bannerHasLine(composeMarkdown('[[theme:校园]]\n\n[[banner:横幅|副标题]]\n', { mode: 'promo' }).html, '#2f6fed'))
check('R23 该判据能抓住旧的浅底容器（自证伪）',
  [ 'background:#ffffff;padding:4px 16px',
    'margin:0;background:rgba(200,100,50,0.06);padding:13px',
    'margin:0;background:#eef6ff;padding:13px',
    'margin:0;border-left:3px solid #333;padding:13px' ].filter(isBlockBg).length === 3)

check('R21 tip=4px 竖线', five.includes('border-left:4px solid '))
check('R21 warn/danger=5px 竖线（恰两条，且比 tip 粗）', (five.match(/border-left:5px solid /g) || []).length === 2)
// ③ 重语义再夹上下两道细线（半包围）——这是它凭空比 tip 重的那一档，**只给重语义**。
check('R21 warn/danger 夹上下细线（半包围，恰 2 组）',
  (five.match(/border-top:1px solid rgba/g) || []).length === 2 && (five.match(/border-bottom:1px solid rgba/g) || []).length === 2)
// ④ 角括号默认**不画**（模板工具最脸熟的一笔）；轴里还留着，模型点名才画。
check('R21 默认不出现对角角括号', (five.match(/width:16px;height:16px;border-(?:left|right):2px solid/g) || []).length === 0)
// ⑤ 重语义的"警报"集中在**一枚小 chip** 上（warn 描边 / danger 实心）——取代旧的"给整段套框"。
check('R21 warn 标签=描边 chip', (five.match(/border:1px solid [^;]+;color:[^;]+;border-radius:2px;padding:1px 8px/g) || []).length === 1)
check('R21 danger 标签=实心 chip（白字）', (five.match(/background:[^;]+;color:#ffffff;border-radius:2px;padding:1px 8px/g) || []).length === 1)
// ⑥ "小号 + 大字距"的题字腔标签去掉，但五种语义的标签必须都还在场（微信端拿不到形状标记）。
check('R21 语义标签紧排（无 letter-spacing:2px 题字腔）', !five.includes('letter-spacing:2px'))
check('R21 五种语义的文字标签都在场（语义靠文字辨认）',
  ['>提示</p>', '>技巧</p>', '>注意</span>', '>警示</span>', '>重点</p>'].every((l) => five.includes(l)))
check('R21 warn/danger 的区分在 chip 形态上（描边 vs 实心），不再靠角括号', (five.match(/border-radius:2px;padding:1px 8px/g) || []).length === 2)
check('R16 key=夹线型（上下各一条 2px 夹线 + 大引号）', five.includes('border-top:2px solid ') && five.includes('border-bottom:2px solid ') && /font-size:46px;line-height:1;font-family:Georgia/.test(five))
const titled = composeMarkdown('> [!NOTE] 有标题的气泡\n> 正文一句。', { mode: 'text' }).html
check('R16 标题 15px/700 大于正文 14px（旧实现是 14 vs 15，层级倒挂）',
  /font-size:15px;font-weight:700/.test(titled) && /font-size:14px;line-height:1.75/.test(titled))
check('R16 标题与语义标签重复时不渲染两遍', (composeMarkdown('> [!NOTE] 提示\n> 正文一句。', { mode: 'text' }).html.match(/提示/g) || []).length === 1)
// R16 回归：宣传类下 NOTE 曾吐 `border-left:4px solid undefined; color:undefined`，浏览器直接丢弃这两条声明。
let leak = ''
for (const mode of ['auto', 'promo', 'text']) {
  for (const theme of ['', '[[theme:校园]]\n']) {
    if (/(?:[a-z-]+:\s*|solid\s+)undefined/.test(composeMarkdown(theme + FIVE, { mode }).html)) leak += `${mode}/${theme ? '校园' : '无主题'} `
  }
}
check('R16 三模式 × 两主题共六组合无 undefined 色键泄漏', leak === '', leak)
// R16：引用不做"浅底 + 圆角 + 大引号"三件套；引用的竖线端点也不得被圆角连坐。
const quoted = composeMarkdown('> 一句普通引用。\n\n正文。', { mode: 'text' }).html
check('R16 引用=竖线 + 缩进，无底色无圆角', /border-left:3px solid [^;]+;padding:2px 0 2px 14px/.test(quoted) && !/blockquote[^>]*border-radius/.test(quoted))

// ---- R21 二轮追加（2026-10-09）：宣传类普通段落**不再套"文字容器"** ----
// v10.1 曾让宣传类每个普通段落都进一层浅色面板（当时口径是"消除裸文字"）——但那正是被点名的
// "全包裹圆角矩形纯浅色背景"，且**整页都是块**会把真正的强调（横幅/气泡/分割线）淹掉。
// 判据：宣传类正文段落必须是裸 `<p>`；除**文章根容器**（整页白底）外不得再有铺底色的 section。
// 用"只有普通段落、没有任何组件"的正文，避免被气泡/横幅的底色喂饱而恒真（R20 首版就是这样假绿的）。
const promoPara = composeMarkdown('这是第一段普通正文，没有气泡也没有组件。\n\n这是第二段普通正文，同样应当是裸文字。\n', { mode: 'promo' }).html
// 主断言用**结构不变式**而不是"没有某种颜色"：无组件时整页只应有**一个** `<section>`（文章根容器）。
// 任何"把段落包进面板"的回归都会凭空多出 section（且不依赖面板用的到底是 rgba 还是别的色）。
check('R21 宣传类普通段落不套外壳：无组件时整页只有一个 <section>（文章根容器）',
  (promoPara.match(/<section/g) || []).length === 1,
  `section 数=${(promoPara.match(/<section/g) || []).length}（应为 1）`)
check('R21 宣传类两段正文各自成段（裸 <p>，未被吞并）',
  (promoPara.match(/<p style="margin:0 0 16px;font-size:16px/g) || []).length === 2,
  `裸段落数=${(promoPara.match(/<p style="margin:0 0 16px;font-size:16px/g) || []).length}`)

// ---- R22（2026-10-10）：气泡**框线"断口" + 角标图案词汇表** ----
// 用户判词："没有角标（框线略去一部分换为一个小图标会不会更好？严禁 emojy，小图标即为角标用 svg 画）"
//          ""完全可以更复杂的小图标，比如一个秋季活动就可以画一个枫叶"。
// 判据：① 每种 frame 语言的气泡都带角标（角标不挑语言）；② 角标是**不透明**实色块、落点**贴着
// 框线那一侧**（否则盖不住线，"断口"不成立）；③ 图案是 SVG 图形、零 emoji；④ mark/markat 轴生效、
// 认不出的值出声；⑤ 语义默认沿用"形状即情绪"契约；⑥ 框架 × 图案抽样全部可渲染。
const badgeImgs = (html) => [...html.matchAll(/<img src="(data:image\/svg\+xml;charset=utf-8,[^"]+)" alt="" style="width:15px;height:15px;display:block"/g)].map((m) => decodeURIComponent(m[1]))
const badgeChips = (html) => [...html.matchAll(/<span style="position:absolute;(left|right):(-?[\d.]+px|0);(top|bottom):(-?[\d.]+px|0);width:22px;height:22px;border-radius:[^;]*;background:([^;]+);/g)].map((m) => ({ h: m[1], hv: m[2], v: m[3], vv: m[4], bg: m[5] }))
const FRAMES7 = ['line', 'edge', 'plane', 'dash', 'rules', 'stack', 'none']
// R23：`plane` 从"只靠底色"降级为线条语言（底色被禁），所以它也"有线可骑"。
const LINE_FRAMES = ['line', 'edge', 'plane', 'dash', 'rules', 'stack']

const frameHtml = {}
for (const f of FRAMES7) frameHtml[f] = composeMarkdown(`[[boxes:frame=${f}]]\n\n${FIVE}`, { mode: 'text' }).html
check('R22 七种 frame 语言的气泡都带角标（角标不挑语言）',
  FRAMES7.every((f) => badgeImgs(frameHtml[f]).length === 5),
  FRAMES7.map((f) => `${f}:${badgeImgs(frameHtml[f]).length}`).join(' '))
// 角标必须**不透明**、且**骑在框线上**：`position:absolute` 的包含块是内边距盒，`left:0` 会落在框线内侧、
// 盖不到线——所以有框线的语言必须给**负偏移**，只有**真的没有线**的语言（`none`）才允许 0。
// 芯片若被改成半透明就盖不住线；这条同时把"没骑上"和"透了"两类回归都钉住。
check('R22 角标不透明实色 + 骑在框线上（有线语言负偏移，无线语言 0）',
  FRAMES7.every((f) => {
    const cs = badgeChips(frameHtml[f])
    if (cs.length !== 5 || !cs.every((c) => /^#[0-9a-fA-F]{3,8}$/.test(c.bg))) return false
    if (!LINE_FRAMES.includes(f)) return cs.every((c) => c.hv === '0' && c.vv === '0')
    return cs.every((c) => parseFloat(c.hv) < 0 || parseFloat(c.vv) < 0)
  }),
  FRAMES7.map((f) => `${f}:${badgeChips(frameHtml[f]).map((c) => c.h + c.hv + '/' + c.v + c.vv).join(',')}`).join('  '))
// 逐壳的偏移量要**正好等于框线宽度**（粗线语言 -barW、细框语言 -1、夹线 -2）
const oneBubble = (spec, kind) => composeMarkdown(`[[boxes:${spec}]]\n\n> [!${kind}] 标题\n> 正文。`, { mode: 'text' }).html
check('R22 左竖线的负偏移 = 竖线宽度（NOTE barW=3 → left:-3px）', /left:-3px;top:0;width:22px/.test(oneBubble('frame=line', 'NOTE')))
check('R22 重语义（WARN barW=5 + 夹线）→ left:-5px;top:-1px', /left:-5px;top:-1px;width:22px/.test(oneBubble('frame=line', 'WARN')))
check('R22 细框语言（dash 1px 边框）→ left:-1px;top:-1px', /left:-1px;top:-1px;width:22px/.test(oneBubble('frame=dash', 'NOTE')))
// **R23 改口径**：`plane`（"没有边框、只靠底色成块"）在"整篇无任何色块"下不成立，
// 气泡的 `plane` 降级到 `line` 那一套**线条阶梯**——判据从"有底色"改成"**有左竖线、且无底色**"。
const planeBubble = oneBubble('frame=plane', 'NOTE')
check('R38 frame=plane 且 fill=none 时保留左竖线',
  /border-left:3px solid #/.test(planeBubble) && !/<section style="margin[^"]*background:/.test(planeBubble),
  (planeBubble.match(/<section style="margin[^"]*"/) || [''])[0].slice(0, 90))
check('R22 frame=none 才是真裸文字（无边框也无底色）', !/border-(?:left|top|right|bottom)?:/.test(oneBubble('frame=none', 'NOTE').replace(/border-radius[^;"]*/g, '')) && !/<section style="[^"]*background:rgba/.test(oneBubble('frame=none', 'NOTE')))
// 角标芯片必须与白底 ≥4.5:1，否则 15px 白图形糊在浅灰块上认不出（读图实测 NOTE 原为 3.05:1）
const lum = (hex) => { const c = hex.replace('#', ''); const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }; const n = parseInt(c, 16); return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255) }
const cw = (hex) => 1.05 / (lum(hex) + 0.05)
const chipBgs = FRAMES7.flatMap((f) => badgeChips(frameHtml[f]).map((c) => c.bg))
check('R22 角标芯片与白底 ≥4.5:1（小图形不发灰）', chipBgs.every((b) => cw(b) >= 4.5),
  chipBgs.map((b) => b + ':' + cw(b).toFixed(2)).join(' '))

// 语义默认角标——沿用知识库既有"形状即情绪"契约（NOTE 空心圆／TIP 实心圆／WARN 空心菱形／DANGER 方框／KEY 实心菱形）
const fiveBadges = badgeImgs(composeMarkdown(FIVE, { mode: 'text' }).html)
check('R22 语义默认角标：NOTE=空心圆', /<circle[^>]*fill="none" stroke=/.test(fiveBadges[0] || ''))
check('R22 语义默认角标：TIP=实心圆', /<circle[^>]*fill="#ffffff"\/>/.test(fiveBadges[1] || ''))
check('R22 语义默认角标：WARN=空心菱形', /<path d="M12 3\.2 20\.8 12 12 20\.8 3\.2 12Z" fill="none" stroke=/.test(fiveBadges[2] || ''))
check('R22 语义默认角标：DANGER=方框', /<rect[^>]*fill="none" stroke=/.test(fiveBadges[3] || ''))
check('R22 语义默认角标：KEY=实心菱形', /<path d="M12 3\.2 20\.8 12 12 20\.8 3\.2 12Z" fill="#ffffff"\/>/.test(fiveBadges[4] || ''))
check('R22 五种语义的角标两两不同（形状即情绪，不是同一枚换色）',
  new Set(fiveBadges).size === 5, `去重后 ${new Set(fiveBadges).size} 枚`)

// mark 轴：点名换图案（引擎内置词汇表；模型不写 SVG）
const maple = composeMarkdown('[[boxes:mark=枫叶]]\n\n> [!NOTE] 标题\n> 正文一句。', { mode: 'text' }).html
check('R22 mark=枫叶 换成枫叶图案（引擎按名字画，模型不写 SVG）', (badgeImgs(maple)[0] || '').includes('17.2 5.6 20.2 10'))
const book = composeMarkdown('[[boxes:mark=书页]]\n\n> [!NOTE] 标题\n> 正文。', { mode: 'text' }).html
check('R22 mark=书页 与默认角标不同（换图案真的换掉）', badgeImgs(book)[0] !== fiveBadges[0])

// markat 轴：落点可换（用户："顶端／左上角／右侧／左侧／右下角都可以"）
const br = composeMarkdown('[[boxes:markat=右下]]\n\n> [!NOTE] 标题\n> 正文。', { mode: 'text' }).html
check('R22 markat=右下 角标落到右下', /position:absolute;right:0;bottom:0;width:22px/.test(br))
const tr = composeMarkdown('[[boxes:markat=tr]]\n\n> [!NOTE] 标题\n> 正文。', { mode: 'text' }).html
check('R22 markat=右上 时右侧内距留白（不压正文）', /22px;height:22px[^>]*/.test(tr) && /padding:\d+px 32px \d+px 16px/.test(tr))
// ---- R22 续：四边中点也是一等落点（用户原话"顶端／左侧／右侧…都可以"）----
const midAt = (a) => composeMarkdown(`[[boxes:markat=${a}]]\n\n> [!NOTE] 标题\n> 正文。`, { mode: 'text' }).html
check('R22 markat=t（顶端）角标水平居中、骑在上框线上', /position:absolute;left:50%;margin-left:-11px;top:/.test(midAt('t')))
check('R22 markat=b（底端）角标水平居中、骑在下框线上', /position:absolute;left:50%;margin-left:-11px;bottom:/.test(midAt('b')))
check('R22 markat=l（左侧）角标垂直居中、骑在左竖线上（负偏移 = 竖线宽）', /position:absolute;left:-3px;top:50%;margin-top:-11px/.test(midAt('l')))
check('R22 markat=r（右侧）角标垂直居中', /position:absolute;right:[^;]+;top:50%;margin-top:-11px/.test(midAt('r')))
check('R22 边中点落点也**多留一档内距**（徽章不压正文）',
  /padding:26px 16px 15px 16px/.test(midAt('t')) && /padding:13px 16px 26px 16px/.test(midAt('b')),
  (midAt('t').match(/padding:26px[^";]*/) || ['?'])[0] + ' | ' + (midAt('b').match(/padding:13px 16px 26px[^";]*/) ? '13px 16px 26px …' : '?'))
check('R22 中文写法也认（顶端/左侧/右边）',
  /left:50%;margin-left:-11px/.test(midAt('顶端')) && /left:-3px;top:50%/.test(midAt('左侧')) && /right:[^;]+;top:50%/.test(midAt('右边')))
// 取角标 span 的**前四段**定位（left/right + margin + top/bottom）——只比前两段会让 t/b 撞脸
const atKey = (a) => {
  const m = midAt(a).match(/position:absolute;([^"]+?)width:22px/)
  return m ? m[1] : ''
}
check('R22 八种落点两两不同（产出互不相同的定位）',
  new Set(['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'].map(atKey)).size === 8,
  [...new Set(['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'].map(atKey))].length + ' 种唯一')
// 右下角**有角饰**时，右下角标必须让位（角饰固定 right:12px/bottom:10px、宽 60px，与 br 实测重叠）
const decoBubble = composeMarkdown(
  '::: art deco bloom\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" fill="none"><circle cx="90" cy="104" r="16" fill="#c96f4a"/><circle cx="236" cy="124" r="14" fill="#d9a35f"/><circle cx="150" cy="150" r="20" fill="#8fb8a4"/><path d="M120 130 q-26 -8 -34 -30 q28 2 40 18z" fill="#5f8d8a"/><path d="M188 170 q24 -14 44 -6 q-10 24 -38 18z" fill="#e8b48a"/><circle cx="90" cy="104" r="6" fill="#f2c76e"/></svg>\n:::\n\n[[boxes:markat=br;mark=枫叶]]\n\n> [!KEY|bloom] 右下角与角饰\n> 角标应当让开右下角的角饰。\n',
  { mode: 'text' }).html
check('R22 右下角有角饰时，br 角标让位（不压在角饰上）',
  /position:absolute;right:80px;bottom:/.test(decoBubble),
  (decoBubble.match(/position:absolute;right:\d+px;bottom:[-\d]+px;width:22px/) || ['(未让位)'])[0])
check('R22 没有角饰时 br 仍贴角（让位只在需要时发生）', /position:absolute;right:0;bottom:/.test(midAt('br')))
// mark=none：明确不画（给"不要角标"的语言留出口）
const noMark = composeMarkdown('[[boxes:mark=none]]\n\n> [!NOTE] 标题\n> 正文。', { mode: 'text' }).html
check('R22 mark=none 不画角标', !/width:22px;height:22px/.test(noMark))
// 认不出的图案名 → 出声（走既有修订回路），且**确定性回退到语义默认**（不是静默摆烂、也不是乱画）
const badMark = composeMarkdown('[[boxes:mark=不存在的东西]]\n\n> [!NOTE] 标题\n> 正文。', { mode: 'text' })
check('R22 mark 认不出的值出声，并确定性回退到语义默认角标',
  badMark.warnings.some((w) => w.includes('mark=不存在的东西')) && badgeImgs(badMark.html)[0] === fiveBadges[0],
  badMark.warnings.filter((w) => w.includes('设计轴')).join('|').slice(0, 90))

// 零 emoji：角标是**可绘制图形**（path/circle/rect），不是 emoji 或图标字符
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2460}-\u{24FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
const emojiMarks = MARK_KEYS.filter((k) => EMOJI_RE.test(decodeURIComponent(markDataUrl(k, '#ffffff'))))
check('R22 十七枚角标图案零 emoji／零图标字符（是可绘制图形，不是字符图标）', emojiMarks.length === 0, emojiMarks.join(','))
check('R22 角标 SVG 只含几何绘制语句（无 <text>/无 foreignObject/无位图）',
  MARK_KEYS.every((k) => !/<text|foreignObject|<image/i.test(decodeURIComponent(markDataUrl(k, '#ffffff')).replace(/^data:[^,]*,/, ''))))

// 框架 × 图案抽样：全部可渲染、过 checkHtml、无 undefined（不是挑几个好看的例子）
const markCombos = []
for (const f of FRAMES7) for (const k of MARK_KEYS) markCombos.push(`frame=${f};mark=${k}`)
const markBad = []
for (const spec of markCombos) {
  const html = composeMarkdown(`[[boxes:${spec}]]\n\n${FIVE}\n\n正文一句。\n`, { mode: 'text' }).html
  const q = checkHtml(html)
  if (!q.ok || /undefined/.test(html)) markBad.push(spec + '→' + (q.issues.map((i) => i.kind).join('/') || 'undefined'))
}
check(`R22 框架 × 图案抽样全部可渲染且过 checkHtml（${markCombos.length} 组）`, markBad.length === 0, markBad.slice(0, 4).join(' | '))
// 宣传类角标：R23 起气泡不再是实色块，芯片色回到统一的 `chipColor(语义色)`（过对比度），
// 不能再是那条"实色反白 ⇒ 白底芯片"的特例。
const promoMark = composeMarkdown('[[boxes:mark=枫叶]]\n\n> [!DANGER] 警示\n> 正文。', { mode: 'promo' }).html
check('R22/R23 宣传类角标：芯片为语义色（过对比度）且不 undefined',
  badgeChips(promoMark).some((c) => c.bg && c.bg !== '#ffffff' && !/^transparent/.test(c.bg)) && !/undefined/.test(promoMark),
  badgeChips(promoMark).map((c) => c.bg).join(','))

// ---- R22 续：主题（风格）词汇层——知识库 §三.1"每个风格条目提供自己的图案词汇表" ----
// 优先级：[[boxes:mark=名]] 显式 > 主题词汇 > 语义默认。主题**只覆盖 note/tip**，
// 警报与结论的形状不动（方框=阻断、实菱形=压轴，是信息本身）。
const themed = (theme, kind) => badgeImgs(composeMarkdown(`[[theme:${theme}]]\n\n> [!${kind}] 标题\n> 正文。`, { mode: 'text' }).html)[0] || ''
check('R22 主题词汇层：[[theme:森系]] 的 NOTE 换成叶芽（风格词汇落到标记位）', themed('森系', 'NOTE').includes('M12 22V11'))
check('R22 主题词汇层：[[theme:校园]] 的 NOTE 换成星', themed('校园', 'NOTE').includes('12 2.2 14.9 9'))
check('R22 主题词汇层：警报形状**不**被主题换掉（DANGER 仍是方框）', /<rect[^>]*fill="none" stroke=/.test(themed('森系', 'DANGER')))
check('R22 主题词汇层：结论形状**不**被主题换掉（KEY 仍是实心菱形）', /<path d="M12 3\.2 20\.8 12 12 20\.8 3\.2 12Z" fill="#ffffff"\/>/.test(themed('森系', 'KEY')))
check('R22 无主题时仍走语义默认（NOTE=空心圆）', /<circle[^>]*fill="none" stroke=/.test(badgeImgs(composeMarkdown('> [!NOTE] 标题\n> 正文。', { mode: 'text' }).html)[0] || ''))
check('R22 显式 mark= 优先于主题词汇（森系 + mark=书页 ⇒ 书页）',
  badgeImgs(composeMarkdown('[[theme:森系]]\n\n[[boxes:mark=书页]]\n\n> [!NOTE] 标题\n> 正文。', { mode: 'text' }).html)[0].includes('4.8 12 12.6'))
check('R22 十一个主题词汇全部是词汇表里的合法键（不静默落空）',
  Object.entries(THEME_MARKS).every(([, v]) => Object.values(v).every((m) => MARK_KEYS.includes(m) || m === undefined)),
  Object.entries(THEME_MARKS).filter(([, v]) => !Object.values(v).every((m) => !m || MARK_KEYS.includes(m))).map(([k]) => k).join(','))

// ---- R17（2026-10-09）：组件语言层——文字框要能产出**多种方案**，不是又一次"一种标准设计" ----
// 用户判词："拒绝一种标准设计，你需要有能设计多种方案的能力。"
// 判据不是"配色换了"，而是**结构语言换了**：圆角/直角、有框/无框、实底/夹线、标签形态、标题字体。
const SCHEME_NAMES = ['editorial', 'soft', 'magazine', 'sticker', 'tech']
const schemeHtml = {}
for (const s of SCHEME_NAMES) {
  schemeHtml[s] = composeMarkdown(`[[theme:校园]]\n[[boxes:${s}]]\n\n${FIVE}`, { mode: 'text' }).html
}
check('R17 五套方案全部通过 checkHtml（零渐变/零阴影/零 emoji/无 ≥100px 固定宽度）',
  SCHEME_NAMES.every((s) => checkHtml(schemeHtml[s]).ok),
  SCHEME_NAMES.filter((s) => !checkHtml(schemeHtml[s]).ok).join(','))
check('R17 五套产出彼此不同（HTML 两两不等）', new Set(SCHEME_NAMES.map((s) => schemeHtml[s])).size === 5)
// 每套的**签名结构特征**必须在场——这是"换了语言"而不是"换了配色"的判据
const SCHEME_SIG = {
  editorial: (h) => h.includes('border-left:3px solid ') && h.includes('border-left:4px solid ') && h.includes('border-top:2px solid '),
  // R38：显式 soft 恢复浅底圆角壳，chip 标签与无大引号的特征保留。
  soft: (h) => /background:rgba\([^)]*,0\.1\)/.test(h) && h.includes('border-radius:14px') && h.includes('border-radius:10px') && !h.includes('font-size:46px') && !h.includes('dashed'),
  magazine: (h) => /border:1px solid [^;]+;padding:3px/.test(h) && /font-size:17px/.test(h),
  sticker: (h) => h.includes('border:1px dashed ') && h.includes('rotate(-4deg)'),
  tech: (h) => h.includes('font-family:Consolas') && h.includes('>// 提示<'),
}
for (const s of SCHEME_NAMES) check(`R17 ${s} 的签名结构特征在场`, SCHEME_SIG[s](schemeHtml[s]))
// 选择规则：显式声明 > 主题映射 > 默认
check('R17 [[boxes:名]] 优先于主题映射', resolveBoxScheme('[[theme:科技]]\n[[boxes:sticker]]', 'tech') === 'sticker')
check('R26 配色不再决定版式：8 个主题解析出的版式载荷**全都相同且为空**（= 中性默认）',
  ['campus', 'tech', 'minimal', 'japanese', 'guochao', 'forest', 'handbook', 'business'].every((k) => resolveFaceSpec('', k).spec === ''),
  ['campus', 'tech', 'minimal', 'japanese'].map((k) => k + ':' + JSON.stringify(resolveFaceSpec('', k).spec)).join(' '))
check('R26 版式与配色可任意组合：同一份轴换任何主题，解析出的轴载荷逐字不变',
  resolveFaceSpec('[[boxes:杂志]]', 'campus').spec === '杂志' && resolveFaceSpec('[[boxes:杂志]]', 'japanese').spec === '杂志' && resolveFaceSpec('[[boxes:frame=line;shape=index]]', 'forest').spec === 'frame=line;shape=index',
  resolveFaceSpec('[[boxes:杂志]]', 'campus').spec + ' / ' + resolveFaceSpec('[[boxes:frame=line;shape=index]]', 'forest').spec)
check('R26 只写主题、不写轴 → 版式载荷为空（不再顺带套上某主题的版式）',
  resolveFaceSpec('[[theme:校园]]', 'campus').spec === '' && resolveFaceSpec('[[theme:日系]]', 'japanese').spec === '', '')
check('R17 中文方案名也认（与 [[theme:名称]] 同口径）', resolveBoxScheme('[[boxes:手账]]', undefined) === 'sticker' && resolveBoxScheme('[[boxes:杂志]]', undefined) === 'magazine')
check('R26 未知方案名不生效、回退中性默认（不再回退到主题的版式）', resolveFaceSpec('[[boxes:不存在的方案]]', 'campus').spec === '' && resolveFaceSpec('[[boxes:不存在的方案]]', 'campus').unknown.length === 1)
check('R26 无声明无主题 → 中性默认（兼容口径 `resolveBoxScheme` 仍可用）', resolveFaceSpec('', undefined).spec === '' && resolveBoxScheme('', undefined) === 'custom')
check('R17 [[boxes:…]] 声明行不进正文', !composeMarkdown('[[boxes:soft]]\n\n正文一段。', { mode: 'text' }).html.includes('[[boxes'))

// ---- R18（2026-10-09）：设计轴词汇表——模型给**意图**，引擎负责渲染成微信安全的样子 ----
// 用户判词："你要做的不是补充几套固定语言，而是让模型能自主推断出这种风格的气泡应该怎么做。"
const FIVE2 = ['NOTE', 'TIP', 'WARN', 'DANGER', 'KEY'].map((k) => `> [!${k}] 标签测试\n> 正文一句。`).join('\n\n')
const hashHtml = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

// ① 组合空间**抽样**必须全部可渲染：不是挑几个好看的例子，而是穷举轴 × 值的代表组合
const AXIS_SAMPLES = []
for (const frame of ['line', 'edge', 'plane', 'dash', 'rules', 'stack', 'none']) for (const radius of ['0', '4', '8', '14']) AXIS_SAMPLES.push(`frame=${frame};radius=${radius}`)
for (const label of ['eyebrow', 'chip', 'mono', 'none']) for (const fill of ['none', 'tint', 'wash', 'paper']) AXIS_SAMPLES.push(`label=${label};fill=${fill}`)
for (const deco of ['none', 'brackets', 'tape', 'quote', 'brackets,quote']) for (const title of ['sans', 'serif', 'mono']) AXIS_SAMPLES.push(`deco=${deco};title=${title};size=19`)
for (const bar of ['2', '5']) for (const pad of ['tight', 'loose']) AXIS_SAMPLES.push(`bar=${bar};pad=${pad};radius=8`)
const axisBad = []
for (const spec of AXIS_SAMPLES) {
  const html = composeMarkdown(`[[boxes:${spec}]]\n\n${FIVE2}`, { mode: 'text' }).html
  const q = checkHtml(html)
  if (!q.ok || /undefined/.test(html)) axisBad.push(spec + '→' + (q.issues.map((i) => i.kind).join('/') || 'undefined'))
}
check(`R18 轴组合抽样全部可渲染且过 checkHtml（${AXIS_SAMPLES.length} 组）`, axisBad.length === 0, axisBad.slice(0, 4).join(' | '))

// ② 冲突消解留在引擎：模型说"要左竖线"，引擎自己把圆角夹到 0（圆角会连坐 border-left 端点）
const lineFace = composeMarkdown('[[boxes:frame=line;radius=14]]\n\n> [!NOTE] 提示\n> 正文。', { mode: 'text' }).html
check('R18 冲突消解：frame=line 强制圆角 0', /border-left:3px solid /.test(lineFace) && !/border-radius:14px/.test(lineFace), '')

// ③ 未知轴/取值：出声且不生效；有效段照常生效；**整条都不认识时回退主题映射**（不静默变默认语言）
const unk = composeMarkdown('[[boxes:半径=99;frane=line]]\n\n> [!NOTE] 提示\n> 正文。', { mode: 'text' })
check('R18 未知轴名/取值 → 给警告', unk.warnings.some((w) => w.includes('组件设计轴')), JSON.stringify(unk.warnings))
check('R18 未知段以外的有效段照常生效', composeMarkdown('[[boxes:soft;半径=99]]\n\n> [!NOTE] 提示\n> 正文。', { mode: 'text' }).html.includes('border-radius:10px'))
check('R26 整条都不认识时回退中性默认（不静默变成某个主题的版式）', resolveFaceSpec('[[boxes:瞎写]]', 'campus').spec === '' && resolveFaceSpec('[[boxes:瞎写]]', 'campus').unknown.length > 0)

// ④ 组合自由：能产出**任何预置都没有**的长相——这才是"自主推断"的意义
const COMBO = 'frame=stack;radius=14;label=chip;fill=paper;title=serif;deco=tape;pad=loose'
const comboHtml = composeMarkdown(`[[boxes:${COMBO}]]\n\n> [!NOTE] 提示\n> 正文。`, { mode: 'text' }).html
check('R18 组合自由：非预置组合自洽（双线 + 圆角 14 + 胶囊 + 胶带 + 衬线）',
  comboHtml.includes('border:1px solid') && comboHtml.includes('border-radius:14px') && comboHtml.includes('border-radius:10px') &&
  comboHtml.includes('rotate(-4deg)') && comboHtml.includes('serif'), '')
check('R18 组合长相与五个预置都不同',
  ['editorial', 'soft', 'magazine', 'sticker', 'tech'].every((p) => hashHtml(composeMarkdown(`[[boxes:${p}]]\n\n> [!NOTE] 提示\n> 正文。`, { mode: 'text' }).html) !== hashHtml(comboHtml)))

// ⑤ 方案层已推到**其余容器**（R17 只覆盖气泡与引用）——同一份多容器正文在五套语言下必须五份不同
const ALL_CONTAINERS = `> [!KEY] 重点\n> 正文。\n\n::: card 卡片标题\n- 条目一\n- 条目二\n:::\n\n::: frame\n- 框内一句\n:::\n\n::: cols\n- 左栏\n- 右栏\n:::\n\n::: band 波点\n- 色带内文\n:::\n\n::: steps\n- 第一步\n- 第二步\n:::\n\n::: timeline\n- 节点一\n:::\n\n- 列表项一\n\n> 引用一句。\n`
const byScheme = ['editorial', 'soft', 'magazine', 'sticker', 'tech'].map((p) => composeMarkdown(`[[boxes:${p}]]\n\n${ALL_CONTAINERS}`, { mode: 'text' }).html)
check('R18 全容器在五套语言下产出五份彼此不同的 HTML', new Set(byScheme.map(hashHtml)).size === 5)
check('R18 全容器输出在所有语言下都过 checkHtml', byScheme.every((h) => checkHtml(h).ok), byScheme.map((h) => checkHtml(h).issues.map((i) => i.kind).join('/')).join(' | '))
// 时间线曾经是**唯一**不走 `surface()` 的容器——虚线/双线语言在它身上整条不生效（重看整篇渲染时发现）
check('R18 时间线节点也跟随 frame（dash → 虚线框）',
  composeMarkdown('[[boxes:frame=dash]]\n\n::: timeline\n- 节点一\n:::\n', { mode: 'text' }).html.includes('border:1px dashed'))
check('R18 容器跟随轴（卡片：plane→圆角无边框 / stack→双线）',
  composeMarkdown('[[boxes:soft]]\n\n::: card 卡片\n- 一\n- 二\n:::\n', { mode: 'text' }).html.includes('border-radius:14px') &&
  composeMarkdown('[[boxes:magazine]]\n\n::: card 卡片\n- 一\n- 二\n:::\n', { mode: 'text' }).html.includes('padding:3px'))
check('R18 引用跟随轴（frame=rules → 上下夹线居中）',
  composeMarkdown('[[boxes:frame=rules]]\n\n> 一句引用。\n', { mode: 'text' }).html.includes('text-align:center'))
// **R23 改口径**：原来这条断言"实色反白只改底色与线条色、不改框架"，判据是"edge 的左粗线是**白色**"。
// 实色分支被禁掉之后，"白色线条特例"也随之作废——保留的是**意图**：宣传类的 KEY 一样跟随 frame 语言。
// 判据改为"框架签名在场，且**不再出现白色线条**"。
const promoKeyFrames = ['edge', 'dash', 'stack'].map((f) => composeMarkdown(`[[boxes:frame=${f}]]\n\n> [!KEY] 重点\n> 正文。`, { mode: 'promo' }).html)
const promoKeyOpenStyles = promoKeyFrames.map((h) => { const o = h.lastIndexOf('<section style="', h.indexOf('>重点<')); return h.slice(o, h.indexOf('>', o)) })
check('R18/R23 宣传类 KEY 保留框架语言（edge→左粗线 / dash→虚线框 / stack→双线嵌套），且不再是白色特例',
  /border-left:\d+px solid #/.test(promoKeyOpenStyles[0]) && promoKeyFrames[1].includes('border:1px dashed') && promoKeyFrames[2].includes('padding:3px') &&
    !promoKeyOpenStyles.some((s) => s.includes('#ffffff')),
  promoKeyOpenStyles.map((s) => (s.includes('#ffffff') ? 'white' : 'semantic')).join(','))

// ---- R20（2026-10-09）：装饰件（标题 / 横幅 / 分割线 / 徽章）也读**同一套**设计轴 ----
// 判据是"换轴 → 换**结构**"（不是换了配色），且显式覆盖与默认都不降级——与 R16/R17/R18 同口径。
// **每条断言都用"只含该装饰件"的正文**：混在一起的文档会让"标题断言"被同文档里的横幅/徽章喂饱而恒真
// （首版就是这样——变异把标题 plane 分支改成返回空串，断言照样绿）。
const onlyHeading = (spec) => composeMarkdown(`[[boxes:${spec}]]\n\n# 大标题\n\n## 章节标题\n`, { mode: 'text' }).html
const onlyDivider = (spec, mark = '---') => composeMarkdown(`[[boxes:${spec}]]\n\n${mark}\n`, { mode: 'text' }).html
const onlyBanner = (spec) => composeMarkdown(`[[boxes:${spec}]]\n\n[[banner:标题|副]]\n`, { mode: 'text' }).html
const onlyTitle = (spec) => composeMarkdown(`[[boxes:${spec}]]\n\n[[title:装饰标题]]\n`, { mode: 'text' }).html
const onlyBadge = (spec) => composeMarkdown(`[[boxes:${spec}]]\n\n正文 [[badge:新品]] 一句。\n`, { mode: 'text' }).html

// ① 标题：结构由 `frame` 决定
const headFrames = ['line', 'plane', 'dash', 'stack', 'rules', 'edge', 'none'].map((f) => onlyHeading('frame=' + f))
check('R20 标题跟随 frame：line→左竖条', /display:flex;align-items:center/.test(headFrames[0]) && /width:3px;height:\d+px;background:#2f6fed/.test(headFrames[0]))
check('R38 标题 frame=plane 且无 fill 时保留左竖条', /display:flex;align-items:center/.test(headFrames[1]) && /width:3px;height:\d+px;background:#2f6fed/.test(headFrames[1]))
check('R20 标题跟随 frame：dash→虚线框', headFrames[2].includes('border:1px dashed'))
check('R20 标题跟随 frame：stack→双线框', headFrames[3].includes('padding:3px'))
check('R20 标题跟随 frame：rules→上下夹线居中', headFrames[4].includes('border-top:2px solid') && headFrames[4].includes('text-align:center'))
check('R20 标题跟随 frame：edge→细框+左粗线', headFrames[5].includes('border-left:3px solid #2f6fed'))
// R23：底色被禁后 `plane` 与 `line` 在小标题上**同形**（如实断言这次塌缩，而不是假装七种都不同）
check('R20 标题六种形态互不相同，且 plane 与 line 同形（塌缩如实记录）', new Set(headFrames.map(hashHtml)).size === 6 && hashHtml(headFrames[1]) === hashHtml(headFrames[0]))
// 字号 / 字体轴确实作用到标题（h2 基础 20px，size 15/19 → 20/24）
check('R20 字号轴作用到标题（size=19 → h2 24px）', /<h2 style="margin:0;font-size:24px/.test(onlyHeading('size=19')))
check('R20 字体轴作用到标题（title=serif → 衬线族）', /<h2 style="[^"]*font-family:Georgia/.test(onlyHeading('title=serif')))

// ② 分割线：骨架由 `frame` 决定（对应 module-divider 的组合方式）
check('R20 分割线跟随 frame：dash→虚线', onlyDivider('frame=dash').includes('border-top:2px dashed'))
check('R20 分割线跟随 frame：plane→短横条', onlyDivider('frame=plane').includes('width:64px'))
check('R20 分割线跟随 frame：stack→双条拼色', onlyDivider('frame=stack').includes('width:44%'))
check('R20 分割线跟随 frame：none→圆点组', (onlyDivider('frame=none').match(/border-radius:50%/g) || []).length >= 3)
check('R20 分割线跟随 frame：edge→色带', onlyDivider('frame=edge').includes('height:8px'))
check('R20 分割线四种记号在 line 下产出不同（kind = 风格输入）',
  new Set(['---', '***', '___', '~~~'].map((k) => hashHtml(onlyDivider('frame=line', k)))).size === 4)

// ③ 横幅 / 装饰标题：与标题同构（无副标题的横幅），并保留显式覆盖
check('R20 横幅跟随 frame（line→下划线 / stack→双线框）',
  onlyBanner('frame=line').includes('border-bottom:3px solid') && onlyBanner('frame=stack').includes('padding:3px'))
check('R20 装饰标题 = 无副标题的横幅（同语言）',
  onlyTitle('frame=rules').includes('text-align:center') && onlyTitle('frame=rules').includes('border-bottom:2px solid') &&
  !onlyTitle('frame=rules').includes('副'))
check('R20 显式覆盖 [[title:…|box]] 仍在场且取主题色',
  composeMarkdown('[[boxes:frame=plane]]\n\n[[title:框标题|box]]\n', { mode: 'text' }).html.includes('border:2px solid #2f6fed'))

// ④ 徽章：形态复用语义标签词汇 `label`，圆角/底色取 `radius`/`fill`
check('R20 徽章跟随 label：none→纯文字（无底色）', !onlyBadge('label=none').includes('rgba(31,79,196'))
check('R20 徽章跟随 label：mono→等宽 // 前缀',
  onlyBadge('label=mono').includes('// 新品') && onlyBadge('label=mono').includes('Consolas'))
check('R20 徽章跟随 radius：胶囊档→圆角 20px / 直角档→2px',
  onlyBadge('radius=14').includes('border-radius:20px') && onlyBadge('radius=0').includes('border-radius:2px'))

// ⑤ 装饰件轴组合**抽样**：全部可渲染且过 checkHtml（不是挑几个好看的例子）
const DECO_DOC = (spec) => `[[boxes:${spec}]]\n\n# 大标题\n\n## 章节标题\n\n---\n\n[[banner:横幅主标题|副标题]]\n\n[[title:装饰标题]]\n\n[[badge:徽章]] 正文一句。\n\n正文段落。\n`
const DECO_SAMPLES = []
for (const frame of ['line', 'plane', 'dash', 'stack', 'rules', 'edge', 'none']) for (const radius of ['0', '14']) DECO_SAMPLES.push(`frame=${frame};radius=${radius}`)
for (const label of ['eyebrow', 'chip', 'mono', 'none']) for (const size of ['15', '19']) DECO_SAMPLES.push(`label=${label};size=${size};title=serif;pad=loose`)
const decoBad = []
for (const spec of DECO_SAMPLES) {
  const html = composeMarkdown(DECO_DOC(spec), { mode: 'text' }).html
  const q = checkHtml(html)
  if (!q.ok || /undefined/.test(html)) decoBad.push(spec + '→' + (q.issues.map((i) => i.kind).join('/') || 'undefined'))
}
check(`R20 装饰件轴组合抽样全部可渲染且过 checkHtml（${DECO_SAMPLES.length} 组）`, decoBad.length === 0, decoBad.slice(0, 4).join(' | '))

// ⑥ 宣传类装饰件不得出现 `undefined` 泄漏（R16 修过一次同源缺陷：DESIGNS.promo 缺语义色键）
const ALL_DECO = '# 标题\n\n## 小节\n\n---\n\n***\n\n___\n\n~~~\n\n[[banner:主|副]]\n\n[[title:装饰]]\n\n[[badge:标签]] 正文。\n\n正文段落。\n'
const promoBad = []
for (const spec of ['editorial', 'frame=stack;radius=14', 'frame=dash;label=mono', 'frame=none;label=none;radius=0', 'frame=plane;fill=paper']) {
  const html = composeMarkdown(`[[boxes:${spec}]]\n\n${ALL_DECO}`, { mode: 'promo' }).html
  if (/undefined/.test(html)) promoBad.push(spec || '(默认)')
}
check('R20 宣传类装饰件无 undefined 泄漏', promoBad.length === 0, promoBad.join(' | '))
check('R20 宣传类装饰件输出过 checkHtml', checkHtml(composeMarkdown(`[[boxes:frame=stack;radius=14]]\n\n${ALL_DECO}`, { mode: 'promo' }).html).ok)

// 1c) 主题：opts.theme（UI）优先于正文声明；日系底色/主色落地
const uiTheme = composeMarkdown(SAMPLE, { mode: 'auto', theme: 'japanese' })
check('opts theme overrides body theme', uiTheme.html.includes('background:#faf3e3;padding:4px 16px') && bannerHasLine(uiTheme.html, '#c29b6b'))
const bodyTheme = composeMarkdown('[[theme:国潮]]\n\n[[banner:开业大吉|主标题]]\n\n正文内容。', { mode: 'auto' })
check('body theme guochao applied', bodyTheme.html.includes('background:#fff9ef;padding:4px 16px') && bannerHasLine(bodyTheme.html, '#c03a2b'))

// 1d) 第 23 轮：自定义色板 [[palette]]——非预置风格可渲染；缺色板的未知风格 → 警告并回退默认
const customTheme = composeMarkdown(
  '[[theme:杂志]]\n\n[[palette:bg=#fbf6ef;accent=#b5482d;orange=#b5482d;amber=#c9a227;heading=#2f2a26]]\n\n[[banner:标题|副标题]]\n\n正文内容。',
  { mode: 'auto' },
)
check('custom palette wrapper bg', customTheme.html.includes('background:#fbf6ef;padding:4px 16px'))
check('custom palette banner uses orange（线条色）', bannerHasLine(customTheme.html, '#b5482d'))
check('custom palette no unknown-theme warning', !customTheme.warnings.some((w) => w.includes('未收录')))
for (const mode of ['text', 'promo']) {
  const explicit = composeMarkdown('[[palette:bg=#FFFFFF;text=#26332E;heading=#26332E;ink=#26332E;accent=#2F6656;orange=#2F6656;tip=#2F6656;warn=#A57A3C;sub=#53675D;danger=#8B463B]]\n\n正文色号。\n\n> [!TIP] 自定义提示\n> 提示内容。\n\n> [!WARN] 自定义注意\n> 注意内容。', { mode })
  check(`R31 ${mode} 正文与语义气泡接受自定义颜色`, explicit.html.includes('color:#26332E') && explicit.html.includes('color:#2F6656') && explicit.html.includes('color:#A57A3C') && !explicit.html.includes('color:undefined'))
  const invalid = composeMarkdown('[[palette:text=red;tip=#12;key=#ffffff;text-shadow=#000000]]\n\n正文色号。', { mode })
  check(`R31 ${mode} 非法色号或样式键不能注入`, !invalid.html.includes('color:red') && !invalid.html.includes('text-shadow:') && invalid.html.includes(mode === 'text' ? 'color:#3f3f3f' : 'color:#4a4a52'))
  const quote = composeMarkdown('[[theme:森系]]\n[[boxes:frame=stack]]\n\n> 双线引用保留白纸。', { mode }).html
  const quoteStyles = [...quote.matchAll(/<blockquote style="([^"]*)"/g)].map((m) => m[1])
  check(`R31 ${mode} 双线引用也不铺底色`, quoteStyles.length === 2 && quoteStyles.every((style) => !/background(?:-color)?:/.test(style)))
}
const unknownTheme = composeMarkdown('[[theme:山海清风]]\n\n正文内容，未带自定义色板。', { mode: 'text' })
check('unknown theme warning', unknownTheme.warnings.some((w) => w.includes('「山海清风」未收录且正文未提供 [[palette]]')))
check('unknown theme falls back default white', unknownTheme.html.startsWith('<section style="background:#ffffff;padding:4px 16px'))

// 第 28 轮：风格名归一——「校园风」等带尾缀声明应命中校园色板而非回退默认
const aliasTheme = composeMarkdown('[[theme:校园风]]\n\n[[banner:开学典礼|副标题]]\n\n正文内容。', { mode: 'auto' })
check('alias theme 校园风 hits campus palette', bannerHasLine(aliasTheme.html, '#2f6fed') && aliasTheme.html.startsWith('<section style="background:#ffffff;padding:4px 16px'))
check('alias theme no unknown-style warning', !aliasTheme.warnings.some((w) => w.includes('未收录')))

// 第 28 轮：照片位（::: photo）渲染为可替换占位块。第 31 轮：照片位与装饰插画并存口径——
// 纯照片位不报"未包含美术素材"硬错，但软提示补装饰插画；照片位 + 已落地插画 → 素材告警清零
// 注意：该口径属长文档档（<600 字的短篇档改用「短篇提示」，不再软催装饰插画）
const photoDoc = '::: photo 活动现场全景\n主席台与观众席，拍一张横幅视角\n:::\n\n' + FILLER
const pr = composeMarkdown(photoDoc, { mode: 'text' })
check('photo block rendered', pr.html.includes('【照片位】') && pr.html.includes('dashed'))
check('photo does not false-flag no-material', !pr.warnings.some((w) => w.includes('未包含美术素材')))
check('photo-only soft-hints decorative art', pr.warnings.some((w) => w.includes('没有任何装饰插画')))
const photoArtDoc = '::: photo 活动现场全景\n主席台与观众席\n:::\n\n::: art wide 横幅插画\n' + FLAG_SVG + '\n:::\n\n正文内容。'
const par = composeMarkdown(photoArtDoc, { mode: 'text' })
check('photo + art coexists no material warning', par.arts.length === 1 && !par.warnings.some((w) => w.includes('装饰插画')) && !par.warnings.some((w) => w.includes('素材用量偏低')))

// 1a) 素材用量警告：0 处与不足 4 处均提示
const zero = composeMarkdown(`## 标题\n\n${FILLER}`, { mode: 'text' })
check('zero-art warning', zero.warnings.some((w) => w.includes('未包含美术素材')))
const low = composeMarkdown('::: art inline 一\n' + FLOWER_SVG + '\n:::\n\n::: art inline 二\n' + FLOWER_SVG + '\n:::\n\n' + FILLER, { mode: 'text' })
check('low-art (2) warning', low.arts.length === 2 && low.warnings.some((w) => w.includes('素材用量偏低')))

// 1b) 素材元素计数：样本 ≥6；劣质素材（<6）被拦截
const artSvg = r.arts[0]?.svg || ''
check('sample svg elements >= 6', svgElementCount(artSvg) >= 6, `elements=${svgElementCount(artSvg)}`)
const weak = composeMarkdown('::: art inline 劣质装饰\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#ccc"/></svg>\n:::\n\n正文。', { mode: 'text' })
check('weak svg (1 elem) blocked', weak.arts.length === 0 && weak.warnings.some((w) => w.includes('美术素材未达标')))
check('weak svg no placeholder img', !weak.html.includes('@@ART') && weak.html.includes('未达标已略过'))
const inlineMd = '::: art inline 小装饰\n' + artSvg + '\n:::\n\n正文。'
const inl = composeMarkdown(inlineMd, { mode: 'text' })
check('inline 内容插画居中且可读，窄屏不溢出', inl.arts.length === 1 && inl.arts[0].wide === false && inl.html.includes('width:100%;max-width:300px;height:auto') && inl.html.includes('text-align:center'))
check('R31 真实 inline 排版的自适应最大宽度可通过 HTML 质检', checkHtml(inl.html).ok, JSON.stringify(checkHtml(inl.html).issues))
check('R31 固定 width 仍拦截且支持空格/大小写/小数', ['width:300px', ' Width : 300.5px !important ', 'height:2px;width:100px'].every(style => checkHtml(`<section style="${style}">正文</section>`).issues.some(i => i.kind === 'fixed-width')))
check('R31 最大宽度和正文文本不误判固定宽度', ['max-width:300px;width:100%', 'border-width:100px'].every(style => !checkHtml(`<section style="${style}">width:300px 是正文</section>`).issues.some(i => i.kind === 'fixed-width')))

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

// 3b) P1 局部修订：可定位到行的问题走"只改这几行"口径，结构问题才整篇重写
const localV2 = '第一段正文。\n\n> [!KEY|second] 记得带\n> 内容\n\n末段。'
const localMsg = buildReviseContent(localV2, ['气泡角饰 second 未定义：请先用 ::: art deco second 定义现场装饰素材'])
check('局部问题定位到行', locateIssues(localV2, ['气泡角饰 second 未定义：…'])[0]?.line === 3)
check('局部问题要求逐字保留', localMsg.includes('逐字保留') && localMsg.includes('第 3 行'))
check('局部问题附上原行文本', localMsg.includes('> [!KEY|second] 记得带'))
const structMsg = buildReviseContent(localV2, ['组件化不足（当前容器 0 个 / 气泡 1 个 / 列表或引用 1 处）'])
// 图片整行保留是所有修订共有的素材保护要求，不限制正文修订范围。
// 只识别正文范围控制句；用真实局部问题和 preserveRest 输出作反例。
const wholeDraftRevision = message => message.includes('按下列问题修订重写一遍') &&
  !message.includes('请只修这些行，其余内容逐字保留') &&
  !message.includes('只改问题所指的地方，**其余内容逐字保留**')
const scopedStructMsg = buildReviseContent(localV2, ['组件化不足（当前容器 0 个 / 气泡 1 个 / 列表或引用 1 处）'], { preserveRest: true })
check('结构问题仍走整篇修订', wholeDraftRevision(structMsg) && !wholeDraftRevision(localMsg) && !wholeDraftRevision(scopedStructMsg))
const mixedMsg = buildReviseContent(localV2, ['气泡角饰 second 未定义', '素材用量偏低（当前 1 处）'])
check('局部+结构混合走整篇修订', wholeDraftRevision(mixedMsg) && !wholeDraftRevision(localMsg) && !wholeDraftRevision(scopedStructMsg))

// 4) 普通对话文本（无语法）不产生 HTML 结构
const c = composeMarkdown('就是随便聊聊，没有什么排版。', { mode: 'auto' })
check('plain chat text mode text', c.mode === 'text')
check('paragraph wrapped', c.html.includes('<p style='))

writeFileSync(`${outDir}/compose-sample.html`, r.html, 'utf8')

// ============================================================================
// 2026-09-29 质量恢复计划 §3：照片位与块解析（真实故障 s1790565874610554000 的回归）
// 故障形态：`::: photo` 后面跟着普通段落与一个 `::: art` 素材块，全文只在**素材块末尾**有一个 `:::`。
// 旧实现"一路扫到下一个 `:::`"→ 照片位把段落 + 素材块头 + 整段 SVG 吞进自己的"说明"，
// 再 escapeHtml 成可见文字：成品 0 个有效 art、3 处转义 SVG、3 处内部 `::: art` 文本。
// 下面每条断言都可证伪——把 collectBlockBody 换回无界扫描即变红。
// ============================================================================
const visibleOf = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

// ① 单行照片位 + 段落 + art 块：三者都要独立渲染，源文范围不跨块
const swallow = `::: photo 现场照片①｜慰问讲话\n\n这是照片位后面的正文段落，绝不能被吞进照片说明。\n\n::: art wide 收尾插画\n${FLOWER_SVG}\n:::\n\n这一段在素材块之后，同样必须保留。`
const sw = composeMarkdown(swallow, { mode: 'text' })
const swVisible = visibleOf(sw.html)
check('单行照片位不吞后续段落', swVisible.includes('绝不能被吞进照片说明'))
check('单行照片位不吞后续素材块', sw.arts.length === 1, `arts=${sw.arts.length}`)
check('单行照片位不吞块后正文', swVisible.includes('同样必须保留'))
check('成品可见文本无转义 SVG', !swVisible.includes('<svg'))
check('成品可见文本无内部 ::: art', !/:::\s*art/.test(swVisible))
check('泄漏检查报 blocking parse.leak', sw.issues.some((i) => i.code === 'parse.leak' && i.severity === 'blocking') === false, '本用例不该有泄漏')
check('照片位本身仍渲染', swVisible.includes('【照片位】'))

// ② 历史多行照片块（纯文本说明 + 显式闭合）仍兼容——不能为了修故障把合法旧块判死
const legacyPhoto = '::: photo 老照片位\n第一行说明\n第二行说明\n:::\n\n正文照常。'
const lp = composeMarkdown(legacyPhoto, { mode: 'text' })
check('历史多行照片块仍兼容', visibleOf(lp.html).includes('第一行说明') && visibleOf(lp.html).includes('第二行说明'))
check('历史多行块记 info（非阻断）', lp.issues.some((i) => i.code === 'parse.legacy-photo-block' && i.severity === 'info'))
check('历史多行块不误报泄漏', !lp.issues.some((i) => i.code === 'parse.leak'))

// ③ 歧义输入：单行照片位 + 空行 + 段落 + 后面某个块的 `:::` → 必须按单行处理，不吞正文
const ambiguous = '::: photo 单行说明\n\n段落甲\n\n::: card 卡片\n- 内容\n:::\n\n段落乙'
const am = composeMarkdown(ambiguous, { mode: 'text' })
check('歧义输入按单行解析', visibleOf(am.html).includes('段落甲') && visibleOf(am.html).includes('段落乙'))
check('歧义输入不吞卡片内容', visibleOf(am.html).includes('内容'))
check('歧义输入不产生转义 SVG/协议泄漏', !am.issues.some((i) => i.code === 'parse.leak'))

// ④ 孤立 `:::` 必须被显式跳过（旧实现会掉进段落分支不推进 i → 死循环）
const orphan = '正文一段。\n\n:::\n\n正文二段。'
const orph = composeMarkdown(orphan, { mode: 'text' })
check('孤立 ::: 被上报而非静默', orph.issues.some((i) => i.code === 'parse.orphan-close'))
check('孤立 ::: 之后正文照常渲染', visibleOf(orph.html).includes('正文二段'))

// ⑤ 未闭合容器：有显式 blocking 问题 + 带源文行范围（供交付门禁定位）
const unclosed = '::: card 标题\n- 一行内容'
const uc = composeMarkdown(unclosed, { mode: 'text' })
const ucIssue = uc.issues.find((i) => i.code === 'parse.unclosed-block')
check('未闭合容器报 blocking', ucIssue?.severity === 'blocking')
check('未闭合容器带源文行范围', ucIssue?.line === 1 && ucIssue.endLine >= 1, JSON.stringify(ucIssue))

// ⑥ 素材被质检拒收 → rejectedArts 回写（供素材位台账定位 slotId）
const rejected = '::: art wide as-abc123 说明\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#ccc"/></svg>\n:::'
const rj = composeMarkdown(rejected, { mode: 'text' })
check('拒收素材记入 rejectedArts', rj.rejectedArts.length === 1, `n=${rj.rejectedArts.length}`)
check('拒收记录带别名候选（可回写台账）', rj.rejectedArts[0]?.refs.includes('as-abc123'), JSON.stringify(rj.rejectedArts[0]?.refs))
check('拒收素材报 blocking asset.rejected', rj.issues.some((i) => i.code === 'asset.rejected' && i.severity === 'blocking'))

// ⑦ 作者节点投影（DS 修复指南 §4.2）：来源范围、精确边界、三态。
// 这一节的断言直接打 `buildAuthorUnits` / `projectionOf` 纯函数——它们就是"投影"这件事本身。
{
  // ⑦a 行内代码的**作者可见文本必须留下**（这正是当年被正则删掉的那一项）
  const units = buildAuthorUnits(
    [
      '<p style="margin:0 0 16px;color:#3f3f3f">联系电话：<span style="background-color:#f6f8fa;color:#2f6fed">010-55556666</span></p>',
      // SVG 里**故意放可见文本**：这才是可证伪的形态。纯几何 SVG 被"剥标签"之后本来就不剩字符，
      // 拿它断言"SVG 不进投影"是恒真的（第一版就是这么写的，变异掉剔除逻辑仍然全绿）。
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210"><title>SVG标题不该进投影</title><text x="10" y="20">SVG正文不该进投影</text><path d="M0 210 L160 148" fill="#d9a35f"/></svg>',
      '<p style="color:#3f3f3f">第二段</p>',
    ],
    [
      { line: 3, code: false },
      { line: 9, code: false },
      { line: 12, code: false },
    ],
  )
  check('⑦ 作者节点：行内代码的作者文本保留（不被当实现细节删掉）', units.some((u) => u.text.includes('010-55556666')), JSON.stringify(units.map((u) => u.text)))
  check(
    '⑦ 作者节点：SVG 整块不进投影（连它内部的 <text>/<title> 也不行——那是画面文字，不是作者正文）',
    !units.some((u) => /SVG标题不该进投影|SVG正文不该进投影|viewBox|#d9a35f/.test(u.text)),
    JSON.stringify(units.map((u) => u.text)),
  )
  check('⑦ 作者节点：只有 SVG 的节点不产出空单元', units.length === 2, `n=${units.length}`)
  check('⑦ 作者节点：每个单元带源文行号', units[0]?.line === 3 && units[1]?.line === 12, JSON.stringify(units.map((u) => u.line)))

  // ⑦b 系统占位/报错句由 emit 打标排除——**不**靠匹配文案形状
  const withSystem = buildAuthorUnits(
    ['<p>timeline 需至少 1 个节点（- 内容）</p>', '<p>真正的正文</p>'],
    [
      { line: 1, code: false, system: true },
      { line: 2, code: false },
    ],
  )
  check('⑦ 作者节点：系统报错句不进投影（按标记而不是按文案）', withSystem.length === 1 && withSystem[0].text === '真正的正文', JSON.stringify(withSystem))

  // ⑦c 三态：成功 / 有效空内容 / 失败——三者不能互相顶替
  check('⑦ 投影三态：有正文 → ok', projectionOf([{ text: '正文', line: 1, code: false }]).status === 'ok')
  check(
    '⑦ 投影三态：有效空内容 → empty（**不是**失败，短通知不该因此被拦）',
    projectionOf([]).status === 'empty',
    projectionOf([]).status,
  )
  check('⑦ 投影三态：没有解析树 → failed 且文本为空', projectionOf(null).status === 'failed' && projectionOf(null).text === '')

  // ⑦d 真实样例上的端到端：行号落在源文范围内、投影里没有实现细节
  const srcLines = SAMPLE.split(/\r?\n/)
  const proj = projectionOf(r.authorUnits)
  check('⑦ 真实样例：投影状态 ok', proj.status === 'ok', proj.status)
  check(
    '⑦ 真实样例：每个作者节点都带**有效**源文行号（1..源文行数）',
    r.authorUnits.length > 0 && r.authorUnits.every((u) => u.line >= 1 && u.line <= srcLines.length),
    `n=${r.authorUnits.length} lines=${JSON.stringify(r.authorUnits.map((u) => u.line))}`,
  )
  // 注意正则要写对：`[[\w]+:` 在字符类里其实是"`[` 或词字符 + 冒号"，
  // 会把正文里的 `8:00` 也匹配上（第一版就是这么误报的），这里显式转义方括号。
  const implLeak = proj.text.match(/style=|margin:|viewBox|@@ART|\[\[[^\]]+:|\]\]/)
  check('⑦ 真实样例：投影里不含实现细节（样式/坐标/素材协议占位）', implLeak === null, String(implLeak?.[0] || proj.text.slice(0, 120)))
}

// ---- R35：从极简到明丽，配色、标题尺度、对齐、装饰必须分别生效 ----
// 这里只证明解析与实际渲染行为。结构不同、checkHtml 通过都不是视觉质量结论；
// 375px 的拥挤、溢出、标题断行、正文节奏与装饰占比仍需独立像素/目视验收。
const R35_THEMES = ['minimal', 'memphis', 'pop', 'sport']
const R35_BASE = 'frame=line;mark=none;deco=none'
const R35_DEFAULTS = 'scale=standard;align=auto;ornament=none'
const R35_LAYOUTS = [
  `${R35_BASE};${R35_DEFAULTS}`,
  `${R35_BASE};scale=display;align=center;ornament=confetti`,
  'frame=none;mark=none;deco=none;scale=display;align=left;ornament=dots',
  'frame=rules;mark=none;deco=none;scale=display;align=left;ornament=speed',
  'frame=stack;shape=bracket;label=chip;mark=none;deco=none;scale=display;align=center;ornament=dots',
]
const R35_BODY = `[[banner:R35活动主视觉|周五傍晚在操场集合]]

# R35主标题

正文尺度保持十六像素。

## R35章节标题

### R35细节标题

[[title:R35显式框标题|box]]

${NO_BLOCK.replace(/^\[\[(?:theme|boxes):[^\]]+\]\]\r?\n/gm, '')}`
const r35Render = (theme, spec, mode, body = R35_BODY) => composeMarkdown(
  `${theme ? `[[theme:${theme}]]\n` : ''}[[boxes:${spec}]]\n\n${body}`, { mode },
)
const r35Style = (html, tag, text) =>
  [...html.matchAll(new RegExp(`<${tag} style="([^"]*)">([\\s\\S]*?)</${tag}>`, 'g'))]
    .find(m => m[2].replace(/<[^>]*>/g, '') === text)?.[1] || ''
const r35Px = (style, property) => Number(style.match(new RegExp(`(?:^|;)${property}:(\\d+(?:\\.\\d+)?)px(?:;|$)`))?.[1] || 0)
const r35HeadingSize = (html, level, text) => r35Px(r35Style(html, `h${level}`, text), 'font-size')
// 比旧 R23 的 section+padding 判据更宽：background-color、单侧 padding、
// blockquote/div/p/表格单元格也检查；仅文章根底纸与不带 padding 的细分割线例外。
const r35BlockFills = (html) => {
  const nodes = [...html.matchAll(/<(section|div|blockquote|p|td|th)\b[^>]*\bstyle="([^"]*)"/g)]
  return nodes.filter(([all, tag, style], index) => {
    if (index === 0 && tag === 'section' && html.startsWith(all)) return false
    const painted = /(?:^|;)\s*background(?:-color)?\s*:\s*(?!none(?:;|$)|transparent(?:;|$))[^;]+/i.test(style)
    const height = r35Px(style, 'height')
    const thinRule = tag === 'section' && height > 0 && height <= 8 &&
      !/(?:^|;)\s*(?:padding(?:-[a-z]+)?|min-height)\s*:/i.test(style)
    return painted && !thinRule
  }).map(([, tag, style]) => `${tag}:${style}`)
}
let r35Count = 0
const checkR35 = (name, ok, extra = '') => { r35Count++; check(`R35 ${name}`, ok, extra) }
checkR35('三种新色板可按英文、中文和常用别名解析', [
  ['memphis', '孟菲斯', '孟菲斯几何风'],
  ['pop', '波普', '波普艺术风格'],
  ['sport', '运动', '运动活力风'],
].every(([key, ...names]) => [key, ...names].every((name) => resolveTheme(`[[theme:${name}]]`)?.key === key)))
checkR35('新色板不自动选择明丽版式，仍可搭配极简', R35_THEMES.every((theme) =>
  resolveFaceSpec(`[[theme:${theme}]]`, theme).spec === '' &&
  resolveFaceSpec(`[[theme:${theme}]]\n[[boxes:${R35_BASE}]]`, theme).spec === R35_BASE))
const r35AxisCombinations = []
for (const scale of ['standard', 'display']) for (const align of ['auto', 'left', 'center']) for (const ornament of ['none', 'confetti', 'dots', 'speed']) {
  const parsed = faceFromSpec(`scale=${scale};align=${align};ornament=${ornament}`)
  r35AxisCombinations.push(parsed.unknown.length === 0 && parsed.applied === 3 &&
    parsed.tokens.scale === scale && parsed.tokens.align === align && parsed.tokens.ornament === ornament)
}
checkR35('三个新轴的 24 组合法组合独立解析', r35AxisCombinations.length === 24 && r35AxisCombinations.every(Boolean))
checkR35('无内容色块判据能抓住旧浅底与无 padding 的大块，保留小记号/细线例外',
  r35BlockFills('<section style="background:#fff;padding:4px 16px"><section style="background-color:rgba(1,2,3,.08);padding-left:12px">正文</section><blockquote style="background:#fff">引用</blockquote><section style="background:rgb(1,2,3);height:48px"></section><span style="background:#fff;width:8px;height:8px"></span><section style="height:1px;background:#333"></section></section>').length === 3)
for (const mode of ['text', 'promo']) {
  const matrix = R35_LAYOUTS.flatMap((spec) => R35_THEMES.map((theme) => ({
    theme, spec, result: r35Render(theme, spec, mode),
  })))
  checkR35(`${mode} 20 组配色×版式全部真实渲染且过 HTML 质检`, matrix.length === 20 && matrix.every(({ result }) =>
    checkHtml(result.html).ok && !/undefined|NaN|@@ART|\[\[boxes:/.test(result.html)),
  matrix.filter(({ result }) => !checkHtml(result.html).ok).map(({ theme, spec }) => `${theme}/${spec}`).join(' | '))
  checkR35(`${mode} 同一版式换四色板，去色后逐字相同`, R35_LAYOUTS.every((spec) =>
    new Set(matrix.filter((row) => row.spec === spec).map(({ result }) => stripColor(result.html))).size === 1))
  checkR35(`${mode} 三种新色板实际到达标题和横幅线条`, R35_THEMES.slice(1).every((theme) => {
    const pal = resolveTheme(`[[theme:${theme}]]`)
    const html = r35Render(theme, R35_BASE, mode).html
    return pal && r35Style(html, 'h1', 'R35主标题').includes(`color:${mode === 'promo' ? pal.ink : pal.heading}`) &&
      html.includes(`border-bottom:3px solid ${mode === 'promo' ? pal.orange : pal.accent}`)
  }))
  const ornamentRows = ['none', 'confetti', 'dots', 'speed'].map((ornament) =>
    r35Render('memphis', `${R35_BASE};ornament=${ornament}`, mode))
  checkR35(`${mode} 同色板四种装饰在去色后仍两两不同`,
    new Set(ornamentRows.map(({ html }) => stripColor(html))).size === 4)
  checkR35(`${mode} 装饰变化保留作者内容与顺序，不把几何符号混入正文投影`,
    new Set(ornamentRows.map(({ authorUnits }) => projectionOf(authorUnits).text)).size === 1 &&
    projectionOf(ornamentRows[0].authorUnits).text.includes('正文尺度保持十六像素'))
  const standard = r35Render('minimal', `${R35_BASE};${R35_DEFAULTS}`, mode)
  const display = r35Render('minimal', `${R35_BASE};scale=display`, mode)
  checkR35(`${mode} display 提升 h1/h2/横幅层级而不放大正文`,
    r35HeadingSize(display.html, 1, 'R35主标题') > r35HeadingSize(standard.html, 1, 'R35主标题') &&
    r35HeadingSize(display.html, 2, 'R35章节标题') > r35HeadingSize(standard.html, 2, 'R35章节标题') &&
    r35HeadingSize(display.html, 1, 'R35主标题') > r35HeadingSize(display.html, 2, 'R35章节标题') &&
    r35Px(r35Style(display.html, 'p', 'R35活动主视觉'), 'font-size') > r35Px(r35Style(standard.html, 'p', 'R35活动主视觉'), 'font-size') &&
    r35Style(display.html, 'p', '正文尺度保持十六像素。') === r35Style(standard.html, 'p', '正文尺度保持十六像素。'))
  const aligned = ['auto', 'left', 'center'].map((align) => r35Render('minimal', `${R35_BASE};align=${align}`, mode))
  const headingParentStyle = (html) => html.match(/<section style="([^"]*)"><h1 style="[^"]*">R35主标题<\/h1>/)?.[1] || ''
  checkR35(`${mode} 左对齐/居中/旧 auto 有实际排版差异且正文不受影响`,
    new Set(aligned.map(({ html }) => stripColor(html))).size === 3 &&
    headingParentStyle(aligned[1].html).includes('text-align:left') &&
    headingParentStyle(aligned[2].html).includes('text-align:center') &&
    new Set(aligned.map(({ html }) => r35Style(html, 'p', '正文尺度保持十六像素。'))).size === 1)
  const oldMinimal = r35Render('minimal', R35_BASE, mode)
  checkR35(`${mode} 未写新轴与显式旧默认的极简 HTML 逐字一致`, oldMinimal.html === standard.html)
  checkR35(`${mode} 极简仍为旧 h1 22/h2 20/h3 18 与正文 16px`,
    r35HeadingSize(oldMinimal.html, 1, 'R35主标题') === 22 &&
    r35HeadingSize(oldMinimal.html, 2, 'R35章节标题') === 20 &&
    r35HeadingSize(oldMinimal.html, 3, 'R35细节标题') === 18 &&
    r35Px(r35Style(oldMinimal.html, 'p', '正文尺度保持十六像素。'), 'font-size') === 16)
  const streamed = r35Render('minimal', R35_BASE, mode,
    `# 开场\n\n[[boxes:${R35_BASE};scale=display;ornament=confetti]]\n\n# 主场\n\n[[boxes:${R35_BASE}]]\n\n# 尾声`)
  checkR35(`${mode} 新轴从声明处向后生效，下一条省略新轴会恢复默认`,
    r35HeadingSize(streamed.html, 1, '开场') === 22 && r35HeadingSize(streamed.html, 1, '主场') > 22 &&
    r35HeadingSize(streamed.html, 1, '尾声') === 22)
  const fills = matrix.flatMap(({ theme, spec, result }) => r35BlockFills(result.html).map((style) => `${theme}/${spec}/${style}`))
  checkR35(`${mode} 明丽组合未声明 fill 时所测容器、引用、横幅及显式框标题均无底色`, fills.length === 0, fills.slice(0, 3).join(' | '))
  const invalidSpec = 'scale=calc(99px);align=right;ornament=url(javascript:alert(1))'
  const invalid = r35Render('minimal', `${R35_BASE};${invalidSpec}`, mode)
  const invalidParsed = faceFromSpec(invalidSpec)
  checkR35(`${mode} 非法新轴报错并回退旧默认，不能进入 CSS`,
    invalidParsed.unknown.length === 3 && invalidParsed.applied === 0 &&
    invalid.warnings.some((warning) => warning.includes('组件设计轴')) && invalid.html === oldMinimal.html &&
    !/javascript:|calc\(99px\)|text-align:right/.test(invalid.html))
  const partial = r35Render('minimal', `${R35_BASE};scale=display;align=invalid;ornament=invalid`, mode)
  checkR35(`${mode} 同条声明中的有效新轴仍生效，非法轴不抹掉它`,
    partial.html === display.html && partial.warnings.some((warning) => warning.includes('组件设计轴')))
  const invalidTheme = r35Render('memphis;background=red', R35_BASE, mode)
  checkR35(`${mode} 非法新色板声明安全回退且正文保留`,
    invalidTheme.html === r35Render('', R35_BASE, mode).html &&
    invalidTheme.warnings.some((warning) => warning.includes('未收录')) && !invalidTheme.html.includes('background=red'))
}
check('R35 固定行为检查全部登记（32 条，视觉验收另计）', r35Count === 32, `checks=${r35Count}`)

// R35 真实桌面稿：中文图案后缀不应把整个提示块降为原始引用。
const nativeMark = composeMarkdown('[[theme:孟菲斯]]\n[[boxes:frame=line]]\n> [!KEY|星] 到场提醒\n> 14:00—17:00，活动免费。')
check('R35 中文本地图案后缀实际渲染且不泄漏标记', !nativeMark.html.includes('[!KEY') && nativeMark.html.includes('重点') && nativeMark.html.includes('到场提醒') && nativeMark.html.includes('14:00—17:00，活动免费。'))
check('R35 中文图案使用本地星形绘制而不请求缺失素材', nativeMark.html.includes(markDataUrl('star', '#ffffff')) && !nativeMark.warnings.some(w => w.includes('未定义')))
const nativeNoMark = composeMarkdown('[[boxes:mark=none]]\n> [!KEY|星] 到场提醒\n> 正文不变。')
check('R35 显式关闭角标仍优先于局部图案', !nativeNoMark.html.includes('data:image/svg+xml') && !nativeNoMark.html.includes('[!KEY') && nativeNoMark.html.includes('正文不变。'))
const unknownCn = composeMarkdown('> [!KEY|未登记的角饰] 到场提醒\n> 正文不变。')
check('R35 未定义中文角饰明确告警但保留气泡内容', unknownCn.warnings.some(w => w.includes('未登记的角饰') && w.includes('未定义')) && !unknownCn.html.includes('[!KEY') && unknownCn.html.includes('正文不变。'))
const longNativeTitle = composeMarkdown('[[boxes:scale=display;ornament=confetti]]\n[[banner:社团开放日：三个社团摊开等你来|活动信息]]')
check('R35 海报长标题启用均衡断行且正文标题逐字保留', longNativeTitle.html.includes('text-wrap:balance') && longNativeTitle.html.includes('社团开放日：三个社团摊开等你来'))
const phraseTitle = '光绘、桌游、开嗓试唱！10月24日下午，大学生活动中心一楼见'
for (const heading of ['# ' + phraseTitle, '[[banner:' + phraseTitle + '|活动信息]]']) {
  const result = composeMarkdown('[[boxes:scale=display;ornament=confetti]]\n' + heading)
  check('R35 明丽标题保护短分句和日期且不删改文字 ' + heading.slice(0, 9),
    result.html.includes('white-space:nowrap">开嗓试唱！</span>') &&
    result.html.includes('white-space:nowrap">10月24日</span>') &&
    result.html.replace(/<[^>]*>/g, '').includes(phraseTitle))
}


// R38：精致浅底与完整图文气泡。保留旧断言并增加可证伪的浅底、结构、内容与身份检查。
const r38Body = '第一段保留完整叙述，时间为上午8点30分，地点是东区操场。'.repeat(10)
const r38Tail = '第二段继续保留事实与顺序，联系电话010-55556666，正文结束。'
const r38Title = '把长标题完整放入题签：交流实践的现场记录、参与者发言与下一步安排'
const r38Source = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(FLAG_SVG)
const r38Text = `> [!TIP] ${r38Title}\n> ${r38Body}\n>\n> ![现场记录原图](${r38Source})\n>\n> ${r38Tail}`.replace(/\\n/g, '\n')
const r38Render = (spec, body = '> [!KEY] 保留标题\n> 保留正文。') => composeMarkdown(`[[theme:校园]]\n[[boxes:${spec}]]\n\n${body}`.replace(/\\n/g, '\n'), { mode: 'text' })
const r38Styles = html => [...html.matchAll(/<(?:section|blockquote) style="([^"]*)"/g)].slice(1).map(m => m[1])
const r38Fills = html => r38Styles(html).flatMap(s => [...s.matchAll(/(?:^|;)background:([^;]+)/g)].map(m => m[1]))
const r38Light = color => {
  const rgba = color.match(/^rgba\(\d+,\d+,\d+,([\d.]+)\)$/)
  if (rgba) return Number(rgba[1]) > 0 && Number(rgba[1]) <= 0.1
  return color === '#fffaf3' || color === '#ffffff'
}
for (const fill of ['tint', 'wash', 'paper']) {
  const result = r38Render(`fill=${fill};mark=none;deco=none`)
  const fills = r38Fills(result.html)
  check(`R38 显式 fill=${fill} 在 KEY 夹线壳内生效且只用浅底`, fills.length > 0 && fills.every(r38Light), fills.join(' | '))
  check(`R38 显式 fill=${fill} 不让正文反白且通过 HTML 质检`, checkHtml(result.html).ok && !/<p style="[^"]*color:#ffffff/.test(result.html))
}
const r38NoFill = r38Render('fill=none;mark=none;deco=none')
check('R38 fill=none 明确不铺内容底', r38Fills(r38NoFill.html).length === 0)
check('R38 省略 fill 与显式 none 输出逐字相同', r38Render('mark=none;deco=none').html === r38NoFill.html)
check('R38 三种浅底真实不同', new Set(['tint', 'wash', 'paper'].map(fill => r38Render(`fill=${fill}`).html)).size === 3)
const r38Plane = r38Render('frame=plane;fill=tint;mark=none;deco=none')
check('R38 plane 配浅底有可见纸面且不额外借用竖线', r38Fills(r38Plane.html).length > 0 && !/border-left:/.test(r38Plane.html))
const r38PlaneCard = r38Render('frame=plane;fill=none', '::: card 卡片\n- 正文不消失\n:::')
check('R38 plane 不铺底时普通卡片仍保留细框', r38PlaneCard.html.includes('border:1px solid') && r38PlaneCard.html.includes('正文不消失') && r38Fills(r38PlaneCard.html).length === 0)
for (const [preset, shape, cn] of [['tab', 'tab', '题签'], ['panel', 'panel', '纸笺']]) {
  check(`R38 ${cn} 中文预置与英文预置一致`, JSON.stringify(faceFromSpec(cn).tokens) === JSON.stringify(faceFromSpec(preset).tokens))
  check(`R38 ${cn} 中文轴值与英文轴值一致`, faceFromSpec(`shape=${cn}`).tokens.shape === shape && faceFromSpec(`shape=${cn}式`).tokens.shape === shape)
  const result = r38Render(cn, r38Text)
  check(`R38 ${cn} 长标题长段落图片全部保留且按原顺序`, result.html.includes(r38Title) && result.html.includes(r38Body) && result.html.includes(r38Tail) && result.html.indexOf(r38Body) < result.html.indexOf(r38Source) && result.html.indexOf(r38Source) < result.html.indexOf(r38Tail))
  check(`R38 ${cn} 图片身份与原 URL 完整保留`, result.html.includes(`src="${r38Source}"`) && result.html.includes('alt="现场记录原图"') && result.html.includes('max-width:100%'))
  check(`R38 ${cn} 无协议泄漏且通过 HTML 质检`, checkHtml(result.html).ok && !/\[\[boxes:|\[!TIP|@@ART|undefined|NaN|&lt;svg/.test(result.html), JSON.stringify(checkHtml(result.html).issues))
  check(`R38 ${cn} 内容区不裁切且不固定高度`, !/overflow:hidden/.test(result.html.replace(/<span style="[^"]*position:absolute[^>]*>[\s\S]*?<\/span>/g, '')) && ![...result.html.matchAll(/<(?:section|p) style="([^"]*)"/g)].some(m => /(?:^|;)(?:height|max-height):/.test(m[1])))
  check(`R38 ${cn} fill=none 可关闭纸面`, r38Fills(r38Render(`${cn};fill=none`, r38Text).html).length === 0)
  check(`R38 ${cn} 浅底与无底不改变作者投影`, projectionOf(result.authorUnits).text === projectionOf(r38Render(`${cn};fill=none`, r38Text).authorUnits).text)
  const deco = r38Render(`${cn};mark=none`, '::: art deco flower\n' + FLOWER_SVG + '\n:::\n\n> [!TIP|flower] 图文单元\n> 正文保留。')
  check(`R38 ${cn} 现场角饰身份和避让仍生效`, deco.arts.length === 1 && deco.html.includes('@@ART0@@') && /(?:padding:0 18px (?:6\d|70)px|padding:17px 16px (?:6\d|70)px)/.test(deco.html), deco.html.match(/padding:[^;"]+/g)?.join(' | '))
}
check('R38 两种新气泡具有不同结构签名', r38Render('题签').html.includes('margin:-18px 0 15px') && !r38Render('题签').html.includes('padding:7px"><section') && r38Render('纸笺').html.includes('padding:7px"><section') && r38Render('纸笺').html.includes('border-bottom:1px solid'))
check('R38 新版式与色板解耦，换色后结构相同', ['题签', '纸笺'].every(spec => {
  const samples = ['校园', '森系', '赤陶'].map(theme => composeMarkdown(`[[theme:${theme}]]\n[[boxes:${spec};mark=none]]\n${r38Text}`.replace(/\\n/g, '\n'), { mode: 'text' }).html)
  return new Set(samples.map(stripColor)).size === 1
}))
for (const preset of ['题签', '纸笺']) {
  const local = r38Render(preset, '> [!TIP] 本地图文\n> 原文开始。\n>\n> ![保留原照片](local-image://r38-photo-original)\n>\n> 原文结束。')
  check(`R38 ${preset} 本地图稳定身份进入图片清单并保留完整图文`, local.images.some(image => image.local === 'local-image://r38-photo-original' && image.alt === '保留原照片') && local.html.includes('原文开始。') && local.html.includes('原文结束。') && !local.issues.some(issue => issue.code === 'asset.local-image-unimported'))
}
check('R38 纸笺外框样式与换行样式由分号分隔', /word-break:break-word;border:1px solid/.test(r38Render('纸笺').html) && !r38Render('纸笺').html.includes('break-wordborder:'))
check('R38 不认识的新骨架仍告警，不注入 CSS', r38Render('shape=tab;background=red').warnings.some(w => w.includes('background=red')) && !r38Render('shape=tab;background=red').html.includes('background:red'))

// R39：三种完整纸面语言。行为、身份与兼容性可在这里验；视觉质量必须另行读图。
const r39Presets = [['花笺', 'botanical'], ['票笺', 'ticket'], ['缎带', 'ribbon']]
const r39Photo = 'local-image://r39-original-photo-unchanged'
const r39Plain = '这是原文中的完整段落，时间为上午8点30分，联系电话010-55556666。'
const r39Heading = '二、细致整理，形成可以持续追溯和查阅的完整记录'
const r39Document = `[[banner:让每一个平常的校园日子被认真记住|完整保留原有副标题]]\n\n${r39Plain}\n\n## ${r39Heading}\n\n> [!NOTE] ${r38Title}\n> ${r38Body}\n>\n> ![现场记录原图](${r39Photo})\n>\n> ${r38Tail}\n\n---\n\n::: card 完整信息卡\n- ${r39Plain}\n:::\n\n::: frame\n- 完整图文结尾。\n:::`
const r39Render = (spec, md = r39Document, mode = 'promo') => composeMarkdown(`[[theme:校园]]\n[[boxes:${spec}]]\n\n${md}`, { mode })
const r39Drawings = html => [...html.matchAll(/<img src="(data:image\/svg\+xml;charset=UTF-8,[^"]+)" alt=""/g)].map(m => decodeURIComponent(m[1].split(',')[1]))
const r39Flow = html => html.replace(/<span aria-hidden="true" style="[^"]*"><\/span>/g, '')
for (const [cn, en] of r39Presets) {
  const parsed = faceFromSpec(cn)
  const result = r39Render(cn)
  check(`R39 ${cn} 中英预置与 shape/ornament 中文轴均解析`, parsed.unknown.length === 0 && JSON.stringify(parsed.tokens) === JSON.stringify(faceFromSpec(en).tokens) && faceFromSpec(`shape=${cn};ornament=${cn}`).tokens.shape === en && faceFromSpec(`shape=${cn};ornament=${cn}`).tokens.ornament === en)
  check(`R39 ${cn} 预置关闭语义标签和小角标`, parsed.tokens.label === 'none' && parsed.tokens.mark === 'none' && !/>提示<|>注意<|>重点</.test(result.html))
  check(`R39 ${cn} 长标题与完整正文未被增删拆分`, result.html.includes(r38Title) && result.html.includes(r38Body) && result.html.includes(r38Tail) && result.plainText.includes(r39Heading) && result.html.includes(r39Plain))
  check(`R39 ${cn} 图文顺序与本地原图身份保持`, result.html.indexOf(r38Body) < result.html.indexOf(r39Photo) && result.html.indexOf(r39Photo) < result.html.indexOf(r38Tail) && JSON.stringify(result.images) === JSON.stringify([{ local: r39Photo, alt: '现场记录原图' }]))
  check(`R39 ${cn} 新装饰不进入素材生成或图片任务列表`, result.arts.length === 0 && !result.issues.some(issue => issue.code === 'photo.pending') && result.images.length === 1)
  check(`R39 ${cn} 正文、气泡、信息卡均为 17px`, result.html.includes('margin:0 0 16px;font-size:17px') && result.html.includes('margin:0;font-size:17px;line-height:1.75') && result.html.includes('margin:0 0 8px;font-size:17px;line-height:1.75'))
  check(`R39 ${cn} 已有中文章序不再叠加系统数字`, !/>0?1<\/span>/.test(result.html) && r35Style(result.html, 'h2', r39Heading).length > 0)
  check(`R39 ${cn} 未编号章节仍只添加一次系统序号`, (r39Render(cn, '## 完整章节标题').html.match(/>01<\/span>/g) || []).length === 1)
  check(`R39 ${cn} 新标题与内容容器无固定高度、裁切或绝对定位`, !/(?:overflow:hidden|text-overflow|line-clamp|position:absolute|(?:^|;)height:\d)/m.test(r39Flow(result.html)) && ![...result.html.matchAll(/<(?:section|h1|h2|p) style="([^"]*)"/g)].some(m => /(?:^|;)(?:height|max-height):/.test(m[1])))
  const drawings = r39Drawings(result.html)
  check(`R39 ${cn} 主标题、章节、纸面与分隔有可复用矢量装饰`, drawings.length >= 8 && new Set(drawings).size >= 3 && drawings.every(svg => svg.startsWith('<svg ') && /<path|<rect|<circle/.test(svg)))
  check(`R39 ${cn} 输出与内置 SVG 无脚本、滤镜、渐变、外链或可见 SVG 字样`, checkHtml(result.html).ok && drawings.every(svg => !/<(?:text|script|image|filter|foreignObject|linearGradient|radialGradient)|(?:href|onload)=/.test(svg)) && !/@@ART|undefined|NaN|&lt;svg/.test(result.html))
  check(`R39 ${cn} fill=none 能关闭所有内容浅底`, r38Fills(r39Render(`${cn};fill=none`).html).length === 0)
  check(`R39 ${cn} 换底纸不改变作者文字投影`, projectionOf(result.authorUnits).text === projectionOf(r39Render(`${cn};fill=none`).authorUnits).text)
  const shapeOnly = r39Render(`shape=${en};mark=none;label=none;deco=none`)
  const noShape = r39Render('mark=none;label=none;deco=none')
  check(`R39 ${cn} shape 独立选择不接管 h2 装饰`, r35Style(shapeOnly.html, 'h2', r39Heading) === r35Style(noShape.html, 'h2', r39Heading))
  const externalDeco = r39Render(cn, `::: art deco flower\n${FLOWER_SVG}\n:::\n\n> [!TIP|flower] 原有角饰\n> ${r39Plain}`)
  check(`R39 ${cn} 显式外来角饰保留且以自然流占位避让`, externalDeco.arts.length === 1 && externalDeco.html.includes('@@ART0@@') && !r39Flow(externalDeco.html).includes('position:absolute'))
  writeFileSync(`${outDir}/r39-${en}.html`, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">' + result.html + '</body>')
}
check('R39 三种气泡骨架在去除 SVG 和颜色后仍然不同', new Set(r39Presets.map(([cn]) => stripColor(r39Render(cn, '> [!NOTE] 原文标题\n> 原文正文。').html.replace(/<img[^>]+>/g, '')))).size === 3)
check('R39 三种装饰可独立应用到旧形状且不改原文', r39Presets.every(([, en]) => r39Render(`ornament=${en};shape=rail;label=none;mark=none`).html.includes(r38Body)))
check('R39 内置矢量颜色参数不可注入 SVG', !decodeURIComponent(ornamentDataUrl('botanical', 'hero', '" onload="attack()', '#abcdef', '#123456')).includes('onload'))
check('R39 三种新预置不改变旧极简显式默认', r39Render('frame=none;mark=none;deco=none').html === r39Render('frame=none;mark=none;deco=none;ornament=none;scale=standard;align=auto;shape=rail').html)
const r39LegacyBody = '# 原始标题\n\n正文内容保持不变。\n\n## 第二章节\n\n> [!KEY] 重点标题\n> 气泡正文内容。\n\n---\n\n::: card 卡片标题\n- 卡片正文\n:::\n\n[[banner:横幅|副标题]]'
// 下列 SHA-256 来自 R39 改动前 .local/runs/r39/before 的 R38 compose.ts，非当前实现的自证明。
const r39LegacyHashes = [
  ['', 'text', 'd50eef81681828e9c6679603842f84c7ede3583462ea4bb559dec57146ca6f1c'],
  ['', 'promo', '455922294c3a3b80cab189139baf0737865b0915dbbae2af4622d60e06a7cd38'],
  ['frame=none;mark=none;deco=none', 'text', 'b876334fc578dc595ffd5416574a8f1564da92cb7ea0c24aca9ffbd65498e0a9'],
  ['frame=none;mark=none;deco=none', 'promo', '844afc9f00c68c5524f84cedd99bfeb9482d738caeb59d6357cfd149c6d3edb2'],
  ['题签', 'text', 'a4d77f0b018e49eca6b86940b4b9594f1c15dd0c24fe37b18911404c03d70829'],
  ['题签', 'promo', '307bd5f8cb8af575dcd624583c9e34612641ae752dde6837b9839bbcf0248a73'],
  ['纸笺', 'text', '9b1cfe9bab03bd378829c877fb9002ccbb22ba9305d391f3ee64d631493a9c08'],
  ['纸笺', 'promo', 'f06fc71b17b11092ca6f6845e0cc7a3b6bcab044e0e19d43d23e0b6c77089998'],
  ['编辑感', 'text', 'd50eef81681828e9c6679603842f84c7ede3583462ea4bb559dec57146ca6f1c'],
  ['编辑感', 'promo', '455922294c3a3b80cab189139baf0737865b0915dbbae2af4622d60e06a7cd38'],
  ['亲和', 'text', '99dfaf7a5d3be79f14511f8076f3974e90773dbc1561e4346d38070f9a567efd'],
  ['亲和', 'promo', '0762e7a2e64b8332d354edb20eee25ca58f4046b3e92ec3aa8ad2669373897f6'],
  ['杂志', 'text', 'da5966124559728a31cbc8d1a3faf40929755827468826bb09926351f9e30a16'],
  ['杂志', 'promo', '281e783dc5a226898be8919510060c83f50673641cd7cdcc1e2fe025334a0400'],
  ['手账', 'text', '21a26aba21a4735fe16d92396eb61ede21489196e0ab9706f560a0388eb48f42'],
  ['手账', 'promo', '4265cff0f01d428072ef1c290995108475c729249a9006eb6497fb421a38e47c'],
  ['科技', 'text', '7811702ca9eaa20b8661294ddc6cf86eda66a84cddc077b15591de6787cb0b26'],
  ['科技', 'promo', '960c69cba1d7b54f11202ae8bb1ebc5d69865e91407961b533662c90d0655431'],
]
for (const [spec, mode, expected] of r39LegacyHashes) {
  const md = `[[theme:极简]]\n${spec ? `[[boxes:${spec}]]\n` : ''}${r39LegacyBody}`
  check(`R39 ${spec || '旧默认'} ${mode} 与 R38 备份逐字兼容`, createHash('sha256').update(composeMarkdown(md, { mode }).html).digest('hex') === expected)
}
for (const [cn] of r39Presets) {
  const decorated = r39Render(cn, `# 完整文章\n\n${FILLER}`)
  check(`R39 ${cn} 原生装饰足以完成排版，不以旧配额触发额外素材请求`, !decorated.issues.some(issue => ['quality.no-art', 'quality.low-art', 'quality.photo-only', 'quality.low-structure'].includes(issue.code)) && fixableWarnings(decorated.warnings).length === 0)
}
const r39Large = r39Render('花笺', Array.from({ length: 10 }, (_, i) => `## 原有标题${i}\n\n> [!NOTE] 原有标题\n> ${r39Plain}`).join('\n\n'))
check('R39 HTML 大体积提示保留未验证风险与编码证据，不断言发布会拒绝', r39Large.issues.some(issue => issue.code === 'limit.length-unverified' && issue.evidence?.includes('html ')) && r39Large.warnings.some(w => w.includes('含图片编码') && w.includes('尚未验证')) && !r39Large.warnings.some(w => w.includes('微信会拒绝保存')))
check('R39 内置装饰的角色具有不同图形，不是同一花纹等比缩放', r39Presets.every(([, kind]) => new Set(['hero', 'section', 'paper', 'footer', 'divider'].map(role => ornamentDataUrl(kind, role, '#246b58', '#be9548', '#547f65'))).size === 5))
check('R39 版式流式退回旧极简后不再继承 17px 正文或花边', r39Render('花笺', `${r39Plain}\n\n[[boxes:frame=none;mark=none;deco=none]]\n\n返回旧极简。`).html.includes('margin:0 0 16px;font-size:16px;line-height:1.75') && r39Render('花笺').html.includes('margin:0 0 16px;font-size:17px;line-height:1.75'))
check('R39 花笺票笺背页独立露出 10px，绝对定位节点仅为空装饰而非内容', ['花笺', '票笺'].every(preset => {
  const html = r39Render(preset).html
  return html.includes('padding:0 10px 10px 0') && /<span aria-hidden="true" style="[^"]*left:10px;right:0;top:10px;bottom:0[^"]*"><\/span>/.test(html) && !r39Flow(html).includes('position:absolute')
}))

const r39WrapTitle = '时间、地点，和你要带来的东西'
const r39WrapSub = '4月18日（星期六）14:00–17:00 · 南区共享草坪'
const r39MarkBody = '> [!NOTE] 标记位置标题\n> 保持完整正文和图像身份。'
for (const [cn, en] of r39Presets) {
  const none = r39Render(`${cn};mark=none`, r39MarkBody)
  const book = r39Render(`${cn};mark=书页`, r39MarkBody)
  const sprout = r39Render(`${cn};mark=叶芽`, r39MarkBody)
  check(`R39 ${cn} 显式书页和叶芽实际渲染且有别于 none`, new Set([none.html, book.html, sprout.html]).size === 3 && book.html.includes(markDataUrl('book', '#2f6fed')) && sprout.html.includes(markDataUrl('sprout', '#2f6fed')))
  check(`R39 ${cn} 八个 markat 唯一出现且处于正确的题头或正文槽`, ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'].every(at => {
    const html = r39Render(`${cn};mark=书页;markat=${at}`, r39MarkBody).html
    const marker = html.indexOf(`data-wx-mark-at="${at}"`), head = html.indexOf('标记位置标题'), body = html.indexOf('保持完整正文和图像身份。')
    const correctOrder = en === 'ribbon' && at === 'tr' ? head < marker && marker < body : ['tl', 't', 'tr'].includes(at) ? marker < head : ['l', 'r'].includes(at) ? head < marker && marker < body : body < marker
    const align = at === 't' || at === 'b' ? 'center' : ['tr', 'r', 'br'].includes(at) ? 'right' : 'left'
    const aligned = en === 'ribbon' || html.includes(`data-wx-mark-at="${at}" style="margin:0 0 10px;text-align:${align}`)
    return marker > 0 && correctOrder && aligned && (html.match(/data-wx-mark-at=/g) || []).length === 1 && !r39Flow(html).includes('position:absolute')
  }))
  check(`R39 ${cn} 默认与显式 none 不额外挂语义角标`, r39Render(cn, r39MarkBody).html === none.html && !none.html.includes('data-wx-mark-at=') && !r39Render(`shape=${en};label=none;deco=none`, r39MarkBody).html.includes('data-wx-mark-at='))
  const unknownMark = r39Render(`${cn};mark=未登记角标`, r39MarkBody)
  const unknownDeco = r39Render(cn, '> [!NOTE|未登记角饰] 原文标题\n> 原文正文。')
  check(`R39 ${cn} 未登记的 mark 与角饰仍明确告警`, unknownMark.warnings.some(w => w.includes('mark=未登记角标')) && unknownMark.html === none.html && unknownDeco.warnings.some(w => w.includes('未登记角饰') && w.includes('未定义')))
  const photoDeco = `::: art deco flower\n${FLOWER_SVG}\n:::\n\n> [!TIP|flower] 标记位置标题\n> 完整正文。\n>\n> ![原图](${r39Photo})`
  const markedPhoto = r39Render(`${cn};mark=书页;markat=br`, photoDeco)
  const barePhoto = r39Render(`${cn};mark=none`, photoDeco)
  check(`R39 ${cn} 显式角标与外来角饰原图共存且作者投影不变`, markedPhoto.html.includes('@@ART0@@') && markedPhoto.arts.length === 1 && markedPhoto.html.includes(`src="${r39Photo}"`) && JSON.stringify(markedPhoto.images) === JSON.stringify(barePhoto.images) && projectionOf(markedPhoto.authorUnits).text === projectionOf(barePhoto.authorUnits).text)
  const titleMd = `[[banner:春日交换会|${r39WrapSub}]]\n\n## ${r39WrapTitle}`
  const wrapped = r39Render(cn, titleMd, 'text')
  check(`R39 ${cn} 标题副信息的断行包装不增删文字或插入强制换行`, wrapped.plainText.includes(r39WrapSub) && wrapped.plainText.includes(r39WrapTitle) && projectionOf(wrapped.authorUnits).text.includes(r39WrapSub) && projectionOf(wrapped.authorUnits).text.includes(r39WrapTitle) && !/<br\s*\/?\s*>/.test(wrapped.html))
  check(`R39 ${cn} 保护短地点与中文短尾并允许极窄屏组内退让`, /data-wx-title-unit="true"[^>]*> 南区共享草坪<\/span>/.test(wrapped.html) && /data-wx-title-unit="true"[^>]*>来的东西<\/span>/.test(wrapped.html) && wrapped.html.includes('text-wrap:balance') && wrapped.html.includes('max-width:100%;white-space:normal;overflow-wrap:anywhere') && !wrapped.html.includes('white-space:nowrap'))
  const longTitle = '连续中文标题保持全部事实与先后关系'.repeat(8) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(5)
  const longWrapped = r39Render(cn, `# ${longTitle}`, 'text')
  check(`R39 ${cn} 超长混合标题不截断且保持可换行约束`, longWrapped.plainText === longTitle && projectionOf(longWrapped.authorUnits).text === longTitle && checkHtml(longWrapped.html).ok && !/line-clamp|text-overflow|white-space:nowrap/.test(longWrapped.html))
  writeFileSync(`${outDir}/r39-${en}-title-mark.html`, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">' + wrapped.html + book.html + '</body>')
}

check('R39 标题副信息中的时间冒号与日期星期不会被当作任意短句分隔', r39Presets.every(([cn]) => {
  const html = r39Render(cn, `[[banner:保留标题|${r39WrapSub}]]`).html
  return /data-wx-title-unit="true"[^>]*>14:00–17:00<\/span>/.test(html) && /data-wx-title-unit="true"[^>]*>4月18日（星期六）<\/span>/.test(html)
}))

judge.finish({ label: 'PHOTO-PARSE' })
