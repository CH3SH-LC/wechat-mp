// svg-quality-check.mjs —— 素材 SVG 确定性质检 Tier 1 断言（2026-09-24 调查 §3）
// 用法：node scripts/svg-quality-check.mjs [--out <目录>]
// 核心回归：旧口径「viewBox + 元素数 ≥6」会把画布外、fill=none 的圆判为合格；现在必须拦下。
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult → run-result.json + 退出码；零条检查是 ERROR 而不是"通过"。
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { analyzeSvg, checkSvgQuality, SLOT_PX } from '../src/lib/svg-quality.ts'
const { mockArtSvg } = await import('../src/lib/image-agent.ts')

// minChecks：2026-10-01 实测 20 条 → 2026-10-08 加 4 条越界判定断言后为 24（靠条数下界证明执行完整）
const judge = createJudge({ script: 'svg-quality-check', outDir: resolveOutDir('svg-quality-check'), minChecks: 24 })
guardCrashes(judge)

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

// 调查文档里的反例：六个圆全部落在画布外，且 fill=none 无描边 —— 老实现在元素计数上"合格"
const OFF_CANVAS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
<circle cx="500" cy="500" r="10"/><circle cx="520" cy="500" r="10"/><circle cx="540" cy="500" r="10"/>
<circle cx="560" cy="500" r="10"/><circle cx="580" cy="500" r="10"/><circle cx="600" cy="500" r="10"/>
</svg>`

const BLANK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"></svg>`

// 角饰铺满整幅：轮廓/避让都会出问题
const FULL_BLEED_DECO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<rect x="0" y="0" width="300" height="200" fill="#c96f4a"/>
<rect x="10" y="10" width="280" height="180" fill="#e8b48a"/>
<circle cx="150" cy="100" r="60" fill="#8fb8a4"/>
<path d="M0 200 L300 0" stroke="#5f8d8a" stroke-width="6" fill="none"/>
</svg>`

// 主体缩成一个小点：大幅空白画布上一个小圆
const SPECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
<circle cx="500" cy="500" r="8" fill="#c96f4a"/>
<circle cx="505" cy="505" r="4" fill="#8fb8a4"/>
<circle cx="495" cy="505" r="4" fill="#8fb8a4"/>
<circle cx="505" cy="495" r="4" fill="#8fb8a4"/>
<circle cx="495" cy="495" r="4" fill="#e8b48a"/>
<circle cx="500" cy="492" r="3" fill="#f2c76e"/>
</svg>`

// 相对路径：朴素"数字两两当坐标"会算错包围盒（曾导致正常插画被误判铺满画布）
const RELATIVE_PATH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<path d="M200 150 q-22 -30 4 -52 q26 22 -4 52z" fill="#8fb8a4"/>
<circle cx="240" cy="120" r="24" fill="#e8b48a"/>
<circle cx="240" cy="120" r="9" fill="#f2c76e"/>
<path d="M180 165 q26 -10 54 -4" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="262" cy="158" r="10" fill="#d9a35f"/>
</svg>`

// 含文字 / emoji：素材禁止
const WITH_TEXT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<rect x="20" y="20" width="260" height="160" fill="#e8dcc8"/>
<text x="150" y="100">标题</text>
<circle cx="240" cy="150" r="30" fill="#c96f4a"/>
<circle cx="200" cy="40" r="20" fill="#8fb8a4"/>
<circle cx="60" cy="150" r="18" fill="#d9a35f"/>
<circle cx="100" cy="60" r="16" fill="#f2c76e"/>
<path d="M0 190 h300" stroke="#8a5f3a" stroke-width="4" fill="none"/>
</svg>`

// 主体占比刻意卡在 deco(0.05) 与默认档(0.1) 之间：约 6% —— deco 下通过、默认档下被拦。
// 这正是 T11 需要的"只在两档之间才有分界"的样例。
const TINY_DECO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<circle cx="262" cy="162" r="18" fill="#c96f4a"/>
<circle cx="240" cy="176" r="10" fill="#8fb8a4"/>
<circle cx="276" cy="140" r="8" fill="#f2c76e"/>
<path d="M222 190 q22 -22 46 -10" stroke="#5f8d8a" stroke-width="4" fill="none"/>
</svg>`

// 照片位装饰框：四周有框、中间留空
const PHOTO_FRAME = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
<rect x="6" y="6" width="188" height="16" rx="6" fill="#d9a35f"/>
<rect x="6" y="178" width="188" height="16" rx="6" fill="#d9a35f"/>
<rect x="6" y="6" width="16" height="188" rx="6" fill="#c96f4a"/>
<rect x="178" y="6" width="16" height="188" rx="6" fill="#c96f4a"/>
<circle cx="60" cy="60" r="6" fill="#8fb8a4"/>
<circle cx="140" cy="60" r="6" fill="#8fb8a4"/>
<circle cx="60" cy="140" r="6" fill="#8fb8a4"/>
<circle cx="140" cy="140" r="6" fill="#8fb8a4"/>
</svg>`

// ---- 2026-10-08：越界判定（offCanvas）的三类已实证误判 + 一个对照 ----
// 起因：真实模型画的图反复被「有 N 个可见元素完全落在画布外」拦下（BIG 大文章 14 张里 5 张、
// G2A 单篇连画 2 次），而成簇的数字（11/21/44）指向**判定本身**有问题。下面是三类最小复现。

// D1 贴边的零厚度元素：顶边横线（y=0，高 0）与 x=0 竖线（宽 0）。它们有一半在图内，本来就合格；
// 旧口径用严格 `0 + 0 > 0` 判相交，于是把它们判成"完全落在画布外"——**挪 1 个单位就变合格**。
const EDGE_ZERO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500" fill="none">
<rect x="60" y="60" width="630" height="380" fill="#e8b48a"/>
<line x1="0" y1="0" x2="750" y2="0" stroke="#c96f4a" stroke-width="8"/>
<line x1="0" y1="20" x2="0" y2="480" stroke="#8fb8a4" stroke-width="8"/>
<circle cx="375" cy="250" r="60" fill="#f2c76e"/>
</svg>`

// D2 祖先 <g transform> 搬进画布：组内元素**变换前**在画布外（x 460..660 / y 340..460），
// `translate(-400,-300)` 后落在 60..260 / 40..160，完全在 300×200 画布内。
// 旧口径只看元素**自身**有没有 transform，于是整组被判越界。
const ANCESTOR_TRANSFORM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<g transform="translate(-400,-300)">
<rect x="460" y="340" width="200" height="120" fill="#e8b48a"/>
<circle cx="560" cy="400" r="40" fill="#c96f4a"/>
</g>
<circle cx="60" cy="60" r="20" fill="#f2c76e"/>
</svg>`

// D3 viewBox 的非零原点：画布实际是 [20,320]×[20,220]。底边横线 y=210 在画布内，
// 旧口径把 min-x/min-y 丢掉后按 [0,300]×[0,200] 判，于是 y=210 被判"落在画布外"。
const VIEWBOX_ORIGIN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 20 300 200" fill="none">
<rect x="40" y="40" width="260" height="160" fill="#e8b48a"/>
<circle cx="170" cy="120" r="40" fill="#c96f4a"/>
<path d="M30 210 h280" stroke="#5f8d8a" stroke-width="6" fill="none"/>
</svg>`

// 对照组：真的整块在画布之外、且没有任何 transform 可解释——必须**仍然**被判越界。
// 没有这一条，上面三条就可能只是"把规则关掉了"。
const GENUINELY_OUTSIDE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<rect x="40" y="40" width="220" height="120" fill="#e8b48a"/>
<circle cx="900" cy="900" r="30" fill="#c96f4a"/>
<circle cx="150" cy="100" r="30" fill="#f2c76e"/>
</svg>`

console.log('[调查文档反例必须被拦下]')
check('画布外 fill=none 的六个圆被拒', !checkSvgQuality(OFF_CANVAS, 'wide').ok, JSON.stringify(checkSvgQuality(OFF_CANVAS, 'wide').failures))
check('六个圆都不计可见', analyzeSvg(OFF_CANVAS).visible === 0)
check('空白 SVG 被拒', !checkSvgQuality(BLANK, 'wide').ok)
check('铺满画布的角饰被拒', !checkSvgQuality(FULL_BLEED_DECO, 'deco').ok, JSON.stringify(checkSvgQuality(FULL_BLEED_DECO, 'deco').failures))
check('大画布上的小点被拒', !checkSvgQuality(SPECK, 'wide').ok, JSON.stringify(checkSvgQuality(SPECK, 'wide').failures))
check('含 <text> 的素材被拒', !checkSvgQuality(WITH_TEXT, 'wide').ok, JSON.stringify(checkSvgQuality(WITH_TEXT, 'wide').failures))

console.log('\n[2026-10-08 越界判定：三类误判不得再误杀 + 一个对照]')
// 断言打的是 `offCanvas` 这个**具体指标**，不是整张图的 ok——避免与占画比/可见数等其它规则缠在一起。
check('贴边的零厚度元素不算越界（顶边横线 + x=0 竖线）', analyzeSvg(EDGE_ZERO).offCanvas === 0, `offCanvas=${analyzeSvg(EDGE_ZERO).offCanvas}`)
check('祖先 <g transform> 搬进画布的元素不算越界', analyzeSvg(ANCESTOR_TRANSFORM).offCanvas === 0, `offCanvas=${analyzeSvg(ANCESTOR_TRANSFORM).offCanvas}`)
check('viewBox 的非零 min-x/min-y 被当作画布原点（不是画布外）', analyzeSvg(VIEWBOX_ORIGIN).offCanvas === 0, `offCanvas=${analyzeSvg(VIEWBOX_ORIGIN).offCanvas}`)
check('对照组：真的落在画布外、无 transform 可解释的元素仍被判越界', analyzeSvg(GENUINELY_OUTSIDE).offCanvas > 0, `offCanvas=${analyzeSvg(GENUINELY_OUTSIDE).offCanvas}`)

console.log('\n[不误杀：正常素材必须通过]')
check('相对路径角饰可用（bbox 未算错）', checkSvgQuality(RELATIVE_PATH, 'deco').ok, JSON.stringify(checkSvgQuality(RELATIVE_PATH, 'deco').failures))
check('相对路径角饰未判铺满', analyzeSvg(RELATIVE_PATH).inkXRatio < 0.85 && analyzeSvg(RELATIVE_PATH).inkYRatio < 0.85)
check('照片位装饰框通过', checkSvgQuality(PHOTO_FRAME, 'photo-frame').ok, JSON.stringify(checkSvgQuality(PHOTO_FRAME, 'photo-frame').failures))
// T11：原来这条是 `check('未知角色退回宽松默认', checkSvgQuality(RELATIVE_PATH, 'mystery-kind').ok)`——
// 用的是在 deco 下本来就通过的样例，只能证明"那个样例仍通过"，无法证伪"回退是否真的发生"；
// 而且 DEFAULT_SPEC 的 minCoverage(0.1) 比 deco(0.05) 更严，"宽松默认"这个描述本身就是错的。
// 换成会分档的样例：TINY_DECO 在 deco 下通过、在未知角色（回退默认档）下被拦。
// 若哪天 DEFAULT_SPEC 被改成照抄 deco，这条会立刻变红。
{
  const asDeco = checkSvgQuality(TINY_DECO, 'deco')
  const asUnknown = checkSvgQuality(TINY_DECO, 'mystery-kind')
  check(
    '未知角色回退到默认档（不是照抄 deco：主体约 6% 的样例 deco 通过、默认档拦下）',
    asDeco.ok && !asUnknown.ok,
    `deco=${asDeco.ok} 未知角色=${asUnknown.ok}｜${asUnknown.failures.join('；')}`,
  )
}

console.log('\n[各角色样例池自洽]')
for (const kind of ['wide', 'inline', 'deco', 'divider', 'photo-frame']) {
  const svg = mockArtSvg(kind)
  const r = checkSvgQuality(svg, kind)
  check(`样例池 ${kind} 达标`, r.ok, JSON.stringify(r.failures))
}

console.log('\n[插槽尺寸表]')
check('deco 插槽为 60px 宽', SLOT_PX.deco.w === 60)
check('wide 插槽为 375 视口内宽', SLOT_PX.wide.w === 343)

console.log('\n[指标可观测量]')
const m = analyzeSvg(RELATIVE_PATH, SLOT_PX.deco)
check('给出墨迹占比', m.inkXRatio > 0 && m.inkYRatio > 0, JSON.stringify({ x: +m.inkXRatio.toFixed(2), y: +m.inkYRatio.toFixed(2) }))
check('给出重心位置', !!m.centroid && m.centroid.x > 0.5 && m.centroid.y > 0.4, JSON.stringify(m.centroid))
check('给出 60px 下的主体尺度（供视觉复核参考）', m.motifPx > 0, `${Math.round(m.motifPx)}px`)

judge.finish({ label: 'SVG-QUALITY' })
