// compose-check.mjs —— composeMarkdown 转换器校验（第 14/15 轮）
// 用法：node scripts/compose-check.mjs [outDir]
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult → run-result.json + 退出码；零条检查是 ERROR 而不是"通过"。
import { buildAuthorUnits, composeMarkdown, projectionOf, resolveBoxScheme, svgElementCount } from '../src/lib/compose.ts'
import { checkHtml } from '../src/lib/quality.ts'
import { buildReviseContent, fixableWarnings, locateIssues } from '../src/lib/revise.ts'
import { createJudge, guardCrashes, parseRunnerArgs } from './lib/run-result.mjs'
import { mkdirSync, writeFileSync } from 'fs'

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
// 只跑得起一条也算 PASS 的话，断言被静默删掉就没人会发现。
const judge = createJudge({ script: 'compose-check', outDir, minChecks: 138 })
guardCrashes(judge)
mkdirSync(outDir, { recursive: true })
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

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
// P0：气泡底部内边距改为按角饰实际高度预留（避免压字 / vivid 气泡 overflow:hidden 裁切），
// R16 进一步改为"实色 + 内衬亮边"（嵌套 section），故断言**语义而非固定像素**：
// 「宣传类 KEY 走实色反白、底色取主题主色、语义标签仍在场」。
// R17 起具体形状随"组件语言"变（校园主题映射到 soft），故这里**不绑死形状**：
// 断言"KEY 气泡确实以主题主色实色渲染、且文字是白色、语义标签在场"。
const vividSegs = []
for (let idx = r.html.indexOf('background:#2f6fed'); idx >= 0; idx = r.html.indexOf('background:#2f6fed', idx + 1)) {
  const end = r.html.indexOf('</section>', idx)
  vividSegs.push(r.html.slice(idx, end < 0 ? undefined : end))
}
check('key bubble rendered (campus vivid)', vividSegs.some((s) => s.includes('重点') && s.includes('#ffffff')), `segs=${vividSegs.length}`)
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

// ---- R16（2026-10-09）：气泡按语义分化容器语言 + 编辑感排版 ----
// 判据是"五种语义各自产出**不同的容器语言**"，而不是"同一个圆角矩形换五种颜色"。
const FIVE = ['NOTE', 'TIP', 'WARN', 'DANGER', 'KEY'].map((k) => `> [!${k}] 标签测试\n> 正文一句。`).join('\n\n')
const five = composeMarkdown(FIVE, { mode: 'text' }).html
check('R16 note=线型（3px 竖线）', five.includes('border-left:3px solid '))
check('R16 tip=线型（4px 竖线）', five.includes('border-left:4px solid '))
// R18 起圆角是**全局轴**（默认编辑感 = 0），不再是"框型 4px / 线型 0"的分语义硬编码——
// 断言改成"框型 + 圆角取自轴"，不绑死某个像素值。
check('R16 warn=框型（极浅底 + 整圈 1px 细边 + 圆角取自轴）', /background:rgba\([^)]+\);border:1px solid [^;]+;border-radius:\d+px/.test(five))
check('R16 danger=框型 + 对角角括号（**只两个角**）', (five.match(/width:16px;height:16px;border-(?:left|right):2px solid/g) || []).length === 2)
check('R16 key=夹线型（上下各一条 2px 夹线 + 大引号）', five.includes('border-top:2px solid ') && five.includes('border-bottom:2px solid ') && /font-size:46px;line-height:1;font-family:Georgia/.test(five))
check('R16 warn/danger 同属框型、靠角括号区分（框型容器恰好两个）', (five.match(/;border:1px solid [^;]+;border-radius:\d+px;/g) || []).length === 2)
check('R16 五种语义的文字标签都在场（微信端拿不到形状标记，语义靠文字辨认）',
  ['提示', '技巧', '注意', '警示', '重点'].every((l) => five.includes('letter-spacing:2px;line-height:1.4;color:') && five.includes('>' + l + '</p>')))
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
  soft: (h) => h.includes('border-radius:14px') && !h.includes('border-left:') && !h.includes('dashed'),
  magazine: (h) => /border:1px solid [^;]+;padding:3px/.test(h) && /font-size:17px/.test(h),
  sticker: (h) => h.includes('border:1px dashed ') && h.includes('rotate(-4deg)'),
  tech: (h) => h.includes('font-family:Consolas') && h.includes('>// 提示<'),
}
for (const s of SCHEME_NAMES) check(`R17 ${s} 的签名结构特征在场`, SCHEME_SIG[s](schemeHtml[s]))
// 选择规则：显式声明 > 主题映射 > 默认
check('R17 [[boxes:名]] 优先于主题映射', resolveBoxScheme('[[theme:科技]]\n[[boxes:sticker]]', 'tech') === 'sticker')
check('R17 主题映射：校园 → soft', resolveBoxScheme('', 'campus') === 'soft')
check('R17 主题映射：科技 → tech', resolveBoxScheme('', 'tech') === 'tech')
check('R17 主题映射：极简 → editorial', resolveBoxScheme('', 'minimal') === 'editorial')
check('R17 中文方案名也认（与 [[theme:名称]] 同口径）', resolveBoxScheme('[[boxes:手账]]', undefined) === 'sticker' && resolveBoxScheme('[[boxes:杂志]]', undefined) === 'magazine')
check('R17 未知方案名不生效、回退到主题映射', resolveBoxScheme('[[boxes:不存在的方案]]', 'campus') === 'soft')
check('R17 无声明无主题 → editorial', resolveBoxScheme('', undefined) === 'editorial')
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
check('R18 未知段以外的有效段照常生效', composeMarkdown('[[boxes:soft;半径=99]]\n\n> [!NOTE] 提示\n> 正文。', { mode: 'text' }).html.includes('border-radius:14px'))
check('R18 整条都不认识时回退主题映射（不静默变编辑感）', resolveBoxScheme('[[boxes:瞎写]]', 'campus') === 'soft')

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
// 实色反白**只改底色与线条色、不改框架**——否则宣传类的 key/tip/danger 会把整篇的
// 设计语言断掉（双线/虚线这些签名特征在 3/5 的语义上直接消失）。
const solidFrames = ['edge', 'dash', 'stack'].map((f) => composeMarkdown(`[[boxes:frame=${f}]]\n\n> [!KEY] 重点\n> 正文。`, { mode: 'promo' }).html)
check('R18 实色气泡保留框架语言（edge→白色左粗线 / dash→虚线 / stack→双线）',
  solidFrames[0].includes('border-left:3px solid #ffffff') && solidFrames[1].includes('border:1px dashed') && solidFrames[2].includes('padding:3px'),
  solidFrames.map((h) => (h.includes('#ffffff') ? 'white' : 'no-white')).join(','))

// 1c) 主题：opts.theme（UI）优先于正文声明；日系底色/主色落地
const uiTheme = composeMarkdown(SAMPLE, { mode: 'auto', theme: 'japanese' })
check('opts theme overrides body theme', uiTheme.html.includes('background:#faf3e3;padding:4px 16px') && uiTheme.html.includes('background:#c29b6b;padding:24px 18px'))
const bodyTheme = composeMarkdown('[[theme:国潮]]\n\n[[banner:开业大吉|主标题]]\n\n正文内容。', { mode: 'auto' })
check('body theme guochao applied', bodyTheme.html.includes('background:#fff9ef;padding:4px 16px') && bodyTheme.html.includes('background:#c03a2b;padding:24px 18px'))

// 1d) 第 23 轮：自定义色板 [[palette]]——非预置风格可渲染；缺色板的未知风格 → 警告并回退默认
const customTheme = composeMarkdown(
  '[[theme:杂志]]\n\n[[palette:bg=#fbf6ef;accent=#b5482d;orange=#b5482d;amber=#c9a227;heading=#2f2a26]]\n\n[[banner:标题|副标题]]\n\n正文内容。',
  { mode: 'auto' },
)
check('custom palette wrapper bg', customTheme.html.includes('background:#fbf6ef;padding:4px 16px'))
check('custom palette banner uses orange', customTheme.html.includes('background:#b5482d;padding:24px 18px'))
check('custom palette no unknown-theme warning', !customTheme.warnings.some((w) => w.includes('未收录')))
const unknownTheme = composeMarkdown('[[theme:山海清风]]\n\n正文内容，未带自定义色板。', { mode: 'text' })
check('unknown theme warning', unknownTheme.warnings.some((w) => w.includes('「山海清风」未收录且正文未提供 [[palette]]')))
check('unknown theme falls back default white', unknownTheme.html.startsWith('<section style="background:#ffffff;padding:4px 16px'))

// 第 28 轮：风格名归一——「校园风」等带尾缀声明应命中校园色板而非回退默认
const aliasTheme = composeMarkdown('[[theme:校园风]]\n\n[[banner:开学典礼|副标题]]\n\n正文内容。', { mode: 'auto' })
check('alias theme 校园风 hits campus palette', aliasTheme.html.includes('background:#2f6fed;padding:24px 18px') && aliasTheme.html.startsWith('<section style="background:#ffffff;padding:4px 16px'))
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

// 3b) P1 局部修订：可定位到行的问题走"只改这几行"口径，结构问题才整篇重写
const localV2 = '第一段正文。\n\n> [!KEY|second] 记得带\n> 内容\n\n末段。'
const localMsg = buildReviseContent(localV2, ['气泡角饰 second 未定义：请先用 ::: art deco second 定义现场装饰素材'])
check('局部问题定位到行', locateIssues(localV2, ['气泡角饰 second 未定义：…'])[0]?.line === 3)
check('局部问题要求逐字保留', localMsg.includes('逐字保留') && localMsg.includes('第 3 行'))
check('局部问题附上原行文本', localMsg.includes('> [!KEY|second] 记得带'))
const structMsg = buildReviseContent(localV2, ['组件化不足（当前容器 0 个 / 气泡 1 个 / 列表或引用 1 处）'])
check('结构问题仍走整篇修订', !structMsg.includes('逐字保留') && structMsg.includes('按下列问题修订重写一遍'))
const mixedMsg = buildReviseContent(localV2, ['气泡角饰 second 未定义', '素材用量偏低（当前 1 处）'])
check('局部+结构混合走整篇修订', !mixedMsg.includes('逐字保留'))

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

judge.finish({ label: 'PHOTO-PARSE' })
