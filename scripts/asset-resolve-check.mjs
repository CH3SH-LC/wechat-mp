// asset-resolve-check.mjs —— 素材解析器 P0 断言（2026-09-24 调查 §1/§2/§7）
// 用法：node scripts/asset-resolve-check.mjs
// 用内存 localStorage 桩驱动真实的 asset-library / image-agent / compose 代码，
// 重放调查文档里的隔离案例，并按"整篇不触发自动重写"这一验收口径做端到端断言。
import { resetStub } from './lib/ls-stub.mjs'
import { failingDoc, failingSource, fixtureAssets, seedFixtureAssets } from './lib/fixtures.mjs'
const { addAsset, listAssets } = await import('../src/lib/asset-library.ts')
const { emptyMaterializeInfo, materializePlaceholders } = await import('../src/lib/image-agent.ts')
const { composeMarkdown } = await import('../src/lib/compose.ts')
const { fixableWarnings } = await import('../src/lib/revise.ts')
const { splitAssistant } = await import('../src/lib/extract.ts')
const { createLedger, unfinished } = await import('../src/lib/asset-ledger.ts')
const { newRunId } = await import('../src/lib/trace.ts')
const { judgeReuse, hasColorConflict, pairBubbleRefs, planDecoAliases, splitPolicy } = await import('../src/lib/asset-resolve.ts')

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  if (!ok) failed++
}

// 一朵"红色玫瑰"角饰：主体集中在右下、不铺满、元素 ≥4（符合 deco 角色契约）
const ROSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<circle cx="200" cy="130" r="34" fill="#c0392b"/>
<circle cx="232" cy="106" r="20" fill="#a5281f"/>
<path d="M150 176 q30 -46 74 -34 q-22 46 -74 34z" fill="#6b8e6e"/>
<path d="M170 186 q22 -22 56 -16" stroke="#3f6b45" stroke-width="4" fill="none"/>
<circle cx="216" cy="146" r="8" fill="#e8b48a"/>
</svg>`
const ROSE_MARK = 'circle cx="200" cy="130" r="34"'

function seedRose() {
  resetStub()
  return addAsset({
    category: 'bubble',
    name: 'rose',
    title: '玫瑰角饰',
    desc: '右下角一朵红色玫瑰花，校园毕业季',
    usage: 'deco',
    origin: 'workshop',
    svg: ROSE,
  })
}

// 通用场景插画（750x220、8 个可见元素、覆盖率约 0.9）：用于填充正文的非角饰素材位，
// 必须自己能通过 wide/inline 角色门槛，否则会被引擎拦下、干扰我们真正要观察的角饰断言。
const SCENERY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="0" y="170" width="750" height="50" fill="#e8dcc8"/>
<path d="M0 170 L180 110 L320 150 L500 90 L640 140 L750 96 V170 Z" fill="#d9a35f" opacity="0.45"/>
<circle cx="620" cy="60" r="38" fill="#f2c76e"/>
<rect x="120" y="96" width="90" height="74" fill="#8a5f3a"/>
<path d="M110 96 h110 l-18 -26 h-74 z" fill="#a97c50"/>
<circle cx="165" cy="130" r="12" fill="#f2c76e"/>
<path d="M400 150 q20 -34 60 -30 q-8 34 -60 30z" fill="#8fb8a4"/>
<circle cx="430" cy="132" r="9" fill="#c96f4a"/>
</svg>`

const FILLER = `咖啡店开业的第一个周末，门口摆了两张小桌，磨豆机从早响到晚。附近写字楼的客人多是外带，
楼上的住户更愿意坐下来，点一杯手冲慢慢喝完。店里的陈设没什么讲究，木架子上放着几袋当季豆子，
墙上挂着一块手写的口味板，写着今天供应哪几支豆、烘焙到什么程度、适合怎么冲。
选豆这件事比很多人想的简单：先看烘焙度，浅烘焙的酸质明亮、适合手冲，中深烘焙的醇厚、适合做奶咖，
再看产区，非洲豆花果调明显，中南美豆坚果巧克力调更稳。第一周我们只上了三支豆，都是反复杯测后留下来的，
与其堆满一墙选择，不如把每支豆子的脾气讲清楚，让客人按自己的口味挑。`
const FILLER2 = `关于价格，我们做了一件自认为实在的事：所有单品的定价都写在门口的小黑板上，不加收服务费，
自带杯子减两元。开业首周做了个小小的活动，买任意一杯送一张手冲体验券，可在工作日任意时段使用，
我们不打算用限时排队来制造热闹，只希望附近的邻居能慢慢把这里当成日常的一部分。`

/** 组装一篇结构合规的 v2 正文（容器 ≥2 / 气泡 ≥1 / 列表 ≥1 / 素材 ≥4 / 长度 ≥600），
 *  这样 compose 的配额类警告不会掩盖我们要观察的角饰问题。 */
function article(decoBlock, bubbleLine) {
  return `[[theme:日系]]

[[banner:新店开业|木架上的当季豆子]]

::: art wide 门店横幅
${SCENERY}
:::

## 关于选豆

${FILLER}

::: steps
- 先定烘焙度：浅焙做手冲，中深焙做奶咖
- 再定产区：非洲豆花果调，中南美豆坚果调
- 最后按当天心情挑，不必迷信评分
:::

::: art inline 豆子特写
${SCENERY}
:::

## 开业的安排

${FILLER2}

::: card 首周安排
- 门口小黑板明码标价，不收服务费
- 自带杯子每杯减两元
- 首周买任意一杯送手冲体验券
:::

${decoBlock}

${bubbleLine}
> 体验券工作日全天可用，不限时段使用

::: art wide 收尾花带
${SCENERY}
:::

欢迎路过时进来坐坐，喝一杯再走。`
}

const run = async (v2, opts) => {
  const info = emptyMaterializeInfo()
  const out = await materializePlaceholders(v2, undefined, info, opts)
  return { out, info, comp: composeMarkdown(out, {}) }
}

// ---------- 纯函数层 ----------
console.log('[asset-resolve 纯函数]')
check('不同配色被否决', hasColorConflict('右下角一朵蓝色雪花', '右下角一朵红色玫瑰花'))
check('同色系不否决', !hasColorConflict('右下角一朵大红花', '右下角一朵红色玫瑰花'))
check('单侧无颜色不否决', !hasColorConflict('右下角一朵雪花', '右下角一朵红色玫瑰花'))

// 调查案例原文：旧的绝对阈值(>=3)会判为强命中；新口径按长度归一化后否决
const V = judgeReuse('右下角一朵蓝色雪花，冬季科技大会', '右下角一朵红色玫瑰花，校园毕业季 rose 玫瑰角饰')
check('长描述不同主体不复用', !V.ok, `score=${V.score} cov=${V.coverage.toFixed(2)} ${V.reason}`)
const SAME = judgeReuse('右下角一朵红色玫瑰花', '右下角一朵红色玫瑰花 rose 玫瑰角饰')
check('同主体同配色可复用', SAME.ok, `score=${SAME.score} cov=${SAME.coverage.toFixed(2)}`)

check('策略段 |new 解析', splitPolicy('花簇角饰|new').policy === 'new')
check('策略段 |auto 解析', splitPolicy('花簇角饰|auto').policy === 'auto')
check('描述含竖线仍保留', splitPolicy('甲|乙').desc === '甲|乙')

const pairLines = ['[[deco:blossom|花簇]]', '正文', '> [!KEY|second] 标题', '> 内容']
check('气泡引用配对', pairBubbleRefs(pairLines, [0])[0] === 'second')
check(
  '别名并集去重',
  planDecoAliases({ pairedRef: 'second', placeholderAlias: 'second', assetName: 'rose', assetId: 'as-1' }).join(',') === 'second,rose,as-1',
)

// ---------- 解析器层 ----------
let rose = await seedRose()
check('种子素材已入库', !!rose, rose && rose.id)

console.log('\n[§1 同库换主体必须新建，且不触发整篇重写]')
{
  const { out, info, comp } = await run(
    article('[[deco:second|右下角一朵蓝色雪花，冬季科技大会]]', '> [!KEY|second] 记得带'),
    { persist: true },
  )
  check('未复用旧玫瑰', !out.includes(ROSE_MARK))
  check('确实产生新生成', info.storedFallback === 1, `stored=${info.storedFallback}`)
  check('新建素材登记进 used', Object.keys(info.used).length === 1, `used=${Object.keys(info.used).length}`)
  check('新建素材有了库 id 绑定', !!info.bindings[0]?.id)
  check('绑定记录来源为 new', info.bindings[0]?.source === 'new')
  check('气泡角饰别名可解析', !comp.warnings.some((w) => w.includes('未定义')), JSON.stringify(comp.warnings.filter((w) => w.includes('角饰'))))
  check('整篇不触发自动重写', fixableWarnings(comp.warnings).length === 0, JSON.stringify(fixableWarnings(comp.warnings)))
}

rose = await seedRose()
console.log('\n[§1 |new 强制新建必须绕过库]')
{
  const { out, info, comp } = await run(
    article('[[deco:second|右下角一朵红色玫瑰花，校园毕业季|new]]', '> [!KEY|second] 记得带'),
    { persist: true },
  )
  check('未命中旧库（强制新建）', !out.includes(ROSE_MARK))
  check('确实重新生成', info.storedFallback === 1, `stored=${info.storedFallback}`)
  check('原因写明强制新建', (info.bindings[0]?.reason || '').includes('|new'), info.bindings[0]?.reason)
  check('不触发自动重写', fixableWarnings(comp.warnings).length === 0, JSON.stringify(fixableWarnings(comp.warnings)))
}

console.log('\n[§1 合理复用不能被禁掉]')
{
  const { info, comp } = await run(article(`[[asset:bubble|${rose.id}|右下角一朵红花的气泡角饰]]`, `> [!KEY|${rose.id}] 记得带`))
  check('显式引用零生成', info.storedFallback === 0 && info.residual === 0)
  check('复用命中并记入 used', !!info.used[rose.id], JSON.stringify(Object.keys(info.used)))
  check('来源标记为 asset', info.bindings[0]?.source === 'asset')
  check('不触发自动重写', fixableWarnings(comp.warnings).length === 0, JSON.stringify(fixableWarnings(comp.warnings)))
}
{
  // 传统占位、描述与库素材高度重合 → 走复用（"不要以每篇全部重画替代合理复用"）
  const { info } = await run(article('[[deco:rose|右下角一朵红色玫瑰花，校园毕业季]]', '> [!KEY|rose] 记得带'))
  check('语义重合时仍可自动复用', info.storedFallback === 0 && info.bindings[0]?.source === 'reuse', info.bindings[0]?.reason)
}

console.log('\n[§2 角饰别名必须让气泡引用解析成功]')
{
  const { out, comp } = await run(article(`[[asset:bubble|${rose.id}|右下角一朵红花的气泡角饰]]`, '> [!KEY|third] 记得带'))
  const decoLine = out.split('\n').find((l) => l.startsWith('::: art deco')) || ''
  check('角饰块带气泡引用词', decoLine.startsWith('::: art deco third'), decoLine)
  check('角饰块带库名称与 id', decoLine.includes('rose') && decoLine.includes(rose.id), decoLine)
  check('无"气泡角饰未定义"警告', !comp.warnings.some((w) => w.includes('未定义')), JSON.stringify(comp.warnings.filter((w) => w.includes('角饰'))))
  check('不触发整篇自动重写', fixableWarnings(comp.warnings).length === 0, JSON.stringify(fixableWarnings(comp.warnings)))
}

console.log('\n[§2 分类写错：用途兼容则恢复并告警，不兼容则明确拒绝]')
{
  // 兼容：角饰素材被声明成 deco（实际 category=bubble，usage 都是 deco）→ 按库记录恢复 + 告警
  const { out, info, comp } = await run(article(`[[asset:deco|${rose.id}|右下角一朵红花的气泡角饰]]`, '> [!KEY|k] 记得带'))
  check('兼容的写错被恢复', info.mismatched === 1 && info.residual === 0, `mismatched=${info.mismatched} residual=${info.residual}`)
  check('绑定原因说明分类不符', (info.bindings[0]?.reason || '').includes('deco'), info.bindings[0]?.reason)
  check('仍按素材实际分类正确渲染', out.includes('::: art deco'))
  check('兼容写错不触发自动重写', fixableWarnings(comp.warnings).length === 0)
  check('mismatched 警告文案不撞 FIXABLE_KEYS', fixableWarnings(['素材引用分类不符（1 处）：引用声明的分类与素材库里的实际分类不一致']).length === 0)
}
{
  // 不兼容：把角饰素材声明成宽幅插画（安放位 wide ≠ deco）→ 明确拒绝，绝不"宽松解析"硬塞进角饰位
  const { out, info, comp } = await run(article(`[[asset:art-wide|${rose.id}|右下角一朵红花的气泡角饰]]`, '> [!KEY|k] 记得带'))
  check('用途不兼容被拒绝', info.residual === 1, `residual=${info.residual}`)
  check('拒绝原因说明用途不兼容', (info.errors[0] || '').includes('用途不兼容'), info.errors[0])
  check('不兼容的素材没有进入成品', !out.includes(ROSE_MARK))
  check('协议行不残留进成品', !out.includes('[[asset:'), JSON.stringify(out.split('\n').filter((l) => l.includes('[[asset:'))))
  // T5：原来是 `fixableWarnings(comp.warnings).length > 0 || info.residual > 0`，而上一行刚刚断言过
  // `info.residual === 1`，右项恒真 → 整条恒真。去掉右项，只看"告警是否落进可修复集合"。
  check('不兼容属于可修复引用问题（交给有界自动修订）', fixableWarnings(comp.warnings).length > 0, JSON.stringify(fixableWarnings(comp.warnings)))
}

console.log('\n[§7 新素材进快照]')
{
  resetStub()
  const { info } = await run(article('[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]', '> [!KEY|fresh] 记得带'), { persist: true })
  const ids = Object.keys(info.used)
  check('used 含现场新建素材', info.storedFallback === 1 && ids.length === 1, `used=${ids.length}`)
  check('binding 的 id 与 used 一致', info.bindings[0]?.id === ids[0])
  // T4：原来这里有一行 `check('不落库时不计入（persist:false 语义）', true)`——字面常量 true，
  // 永远 PASS，却顶着 persist:false 的名字，让人以为这条语义被覆盖了。
  // 真正的 persist:false 断言在紧接着的下一个块里（不写库、used 为空），这里删除。
}
{
  resetStub()
  const { info } = await run(article('[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]', '> [!KEY|fresh] 记得带'), { persist: false })
  check('persist:false 不写库、used 为空', info.storedFallback === 0 && Object.keys(info.used).length === 0, `used=${Object.keys(info.used).length}`)
}

console.log('\n[气泡进度事件：派发素材任务与逐张计数]')
{
  // 真实路径上抓住 onProgress 事件流（气泡显示什么完全由它决定，不能只靠肉眼看界面）
  resetStub()
  const events = []
  await run(article('[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]', '> [!KEY|fresh] 记得带'), {
    persist: true,
    onProgress: (e) => events.push(e),
  })
  const dispatch = events.find((e) => e.text.startsWith('派发素材任务'))
  check('先播报「派发素材任务」', !!dispatch && dispatch.phase === 'asset', dispatch && dispatch.text)
  check('派发计数与实际素材位数一致', /共 1 个素材位/.test(dispatch?.text || ''), dispatch && dispatch.text)
  const draws = events.filter((e) => e.text.startsWith('绘制素材'))
  check('绘制事件带「第 N/总数 张」', draws.length === 1 && /第 1\/1 张/.test(draws[0].text), draws[0] && draws[0].text)
  check('所有事件都带阶段（气泡左侧标签靠它）', events.every((e) => typeof e.phase === 'string' && e.phase.length > 0))

  // 铁律 6：进度纯展示。同一输入的产物必须与「不上报进度」时逐字一致——否则说明事件影响了流程。
  resetStub()
  const quiet = await run(article('[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]', '> [!KEY|fresh] 记得带'), { persist: true })
  const loud = await run(article('[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]', '> [!KEY|fresh] 记得带'), {
    persist: true,
    onProgress: (e) => events.push(e),
  })
  check('上报进度不改变产物（纯展示）', quiet.out === loud.out, `len ${quiet.out.length} vs ${loud.out.length}`)
}
{
  // 无素材位时不应播报派发（避免"共 0 个素材位"这种噪音）
  resetStub()
  const events = []
  await run(`[[theme:日系]]\n\n纯文字正文，没有任何素材位。`, { persist: true, onProgress: (e) => events.push(e) })
  check('无素材位不播报派发', !events.some((e) => e.text.startsWith('派发素材任务')), JSON.stringify(events))
}

console.log('\n[真实失败样例（2026-09-28「筑基」稿）：中文分类引用 + 三枚纯文字旧角饰块]')
{
  // 这批输入来自当时用户实际拿到的失败稿与真实素材库（见 scripts/fixtures/ 的 README）。
  // 修复前的实测结果：四个引用位全部落空、成品 HTML 里 0 张图、7 条告警、绑定全是 source=failed。
  resetStub()
  const seeded = seedFixtureAssets()
  check('样例素材已灌入（四枚）', seeded === 4, `n=${seeded}`)

  const src = splitAssistant(failingSource()).v2
  check('样例正文可取到 v2 围栏', !!src && src.includes('[[asset:正文内嵌插画|'))

  const info = emptyMaterializeInfo()
  const out = await materializePlaceholders(src, '校园', info, { persist: true })
  const comp = composeMarkdown(out, {})
  const byId = (id) => info.bindings.filter((b) => b.id === id)
  const assets = fixtureAssets()
  const idOf = (name) => assets.find((a) => a.meta.name === name)?.meta.id

  // 1) 四枚已有素材必须全部恢复绑定
  for (const nm of ['inline-mtx761tr', 'bud', 'star', 'deco-mtt2ujno']) {
    const b = byId(idOf(nm))
    check(`恢复绑定：${nm}`, b.length === 1, b.length ? `${b[0].source}｜${b[0].reason.slice(0, 40)}` : '无绑定')
    check(`未重新绘制：${nm}`, b.length === 1 && b[0].source !== 'new', b[0]?.source)
  }

  // 2) 这四枚复用位产生 **0 次绘图尝试**（台账里 attempts 必须为 0）
  const ledger = info.ledger
  const reusedIds = ['inline-mtx761tr', 'bud', 'star', 'deco-mtt2ujno'].map(idOf)
  const reusedSlots = ledger.order
    .map((k) => ledger.slots[k])
    .filter((e) => reusedIds.includes(e.assetId))
  check('四枚复用位的绘图尝试为 0', reusedSlots.length === 4 && reusedSlots.every((e) => e.attempts === 0), JSON.stringify(reusedSlots.map((e) => e.attempts)))

  // 3) 中文分类不再漏掉：引用被解析、且不出现在成品与 HTML 里
  check('中文分类引用已解析（residual=0）', info.residual === 0, `residual=${info.residual}`)
  check('成品不残留素材协议', !/\[\[asset:/.test(out), JSON.stringify(out.split('\n').filter((l) => l.includes('[[asset:'))))

  // 4) 三枚旧角饰块被恢复成真角饰块（带 SVG），而不是"未定义"
  const decoLines = out.split('\n').filter((l) => l.startsWith('::: art deco'))
  check('产出三个角饰块', decoLines.length === 3, JSON.stringify(decoLines))
  check('角饰块带素材 ID 别名', decoLines.every((l) => reusedIds.some((id) => l.includes(id))), JSON.stringify(decoLines))
  check('成品正文没有"生成失败"说明', !out.includes('生成失败') && !out.includes('未达标已略过'))

  // 5) 修复前的 7 条告警（3 条"装饰素材未达标" + 3 条"角饰未定义"）必须全部消失
  const bad = comp.warnings.filter((w) => w.includes('未定义') || w.includes('现场角饰定义'))
  check('无"角饰未定义 / 现场角饰不可用"告警', bad.length === 0, JSON.stringify(bad))
  // T6：这条原来叫「替换前 6 条角饰告警已消失」，但它断言的是**静态 fixture 文件里存着 6 条历史告警**，
  // 与"当前告警是否消失"毫无关系（真正断言消失的是上一行）。名字与断言对象不符，只会让人误读为已覆盖。
  // 保留断言但改成它真正在测的东西：样例文件仍保有修复前证据（证据完整性）。
  check('fixture 保留 6 条历史角饰告警（证据完整性）', failingDoc().warnings.filter((w) => w.includes('未达标') || w.includes('未定义')).length === 6)

  // 6) 四枚素材的 SVG 真的进了成品（书桌插画 + 三枚角饰）
  const svgCount = (out.match(/<svg\b/g) || []).length
  check('成品含全部素材 SVG（3 张新绘 + 4 枚复用）', svgCount === 7, `svg=${svgCount}`)

  // 7) 完成状态按绑定判定：不再有未完成素材位
  check('无未完成素材位', unfinished(info.ledger).length === 0, JSON.stringify(unfinished(info.ledger).map((e) => e.slot)))

  // 8) 规范化源文：四个素材位变成稳定的按 ID 引用（供自动修订沿用，不再退回待绘图位）
  const refs = info.normalized.split('\n').filter((l) => l.includes('[[asset:'))
  check('规范化源文含四枚稳定引用', reusedIds.every((id) => refs.some((l) => l.includes(`|${id}|`))), JSON.stringify(refs.map((l) => l.slice(0, 60))))
}

console.log('\n[阶段 2：重复名称 / 非角饰同名 / 坏 SVG 都要有明确结果]')
{
  // 重名：两条同名素材 → 按名称引用判**歧义**（不猜是哪一张），按 ID 仍可精确命中
  resetStub()
  const a1 = await addAsset({ category: 'deco', name: 'dup', title: '重名甲', desc: '右下角一朵蓝色雪花角饰', usage: 'deco', origin: 'workshop', svg: ROSE })
  const a2 = await addAsset({ category: 'deco', name: 'dup', title: '重名乙', desc: '右下角一朵蓝色雪花角饰', usage: 'deco', origin: 'workshop', svg: ROSE })
  const ambiguous = await run(article('[[asset:deco|dup|右下角一朵蓝色雪花角饰]]', '> [!KEY|k] 记得带'))
  check('重名引用被判歧义并拒绝', ambiguous.info.residual === 1 && (ambiguous.info.errors[0] || '').includes('同名'), ambiguous.info.errors[0])
  const byId = await run(article(`[[asset:deco|${a1.id}|右下角一朵蓝色雪花角饰]]`, '> [!KEY|k] 记得带'))
  check('同一批里按 ID 仍能精确命中', byId.info.residual === 0 && byId.info.bindings[0]?.id === a1.id)
  check('重名不静默（有面向用户的错误）', (ambiguous.info.errors[0] || '').length > 0)

  // 非角饰同名：名称命中的素材是宽幅插画，却被放进角饰位 → 用途不兼容
  resetStub()
  const WIDE_MARK = 'circle cx="619" cy="61" r="37"'
  const WIDE_SVG = SCENERY.replace('cx="620" cy="60" r="38"', 'cx="619" cy="61" r="37"')
  await addAsset({ category: 'art-wide', name: 'samesy', title: '宽幅插画', desc: '校园操场宽幅场景插画', usage: 'wide', origin: 'workshop', svg: WIDE_SVG })
  const wrongUse = await run(article('[[asset:bubble|samesy|右下角一个小角饰]]', '> [!KEY|k] 记得带'))
  check('非角饰同名被用途不兼容拦下', wrongUse.info.residual === 1 && (wrongUse.info.errors[0] || '').includes('用途不兼容'), wrongUse.info.errors[0])
  check('该素材没有进入成品', !wrongUse.out.includes(WIDE_MARK))

  // 坏 SVG：库里有这条记录，但取不到可用 SVG（空串）→ 命中却读不出，明确报错
  resetStub()
  const broken = await addAsset({ category: 'deco', name: 'broken', title: '坏素材', desc: '右下角一朵小红花角饰', usage: 'deco', origin: 'workshop', svg: '   ' })
  const bad = await run(article('[[asset:deco|broken|右下角一朵小红花角饰]]', '> [!KEY|k] 记得带'))
  // 坏 SVG = 素材本身坏了（内容为空），**不是**正文写法问题：必须明确报错且**不计入可修复项**，
  // 否则会白跑一轮自动修订（模型重写正文也读不出那件素材），而真正该做的是让用户在清单上重试。
  check('坏 SVG 明确报错（不是静默成功）', (bad.info.errors[0] || '').includes('读取失败'), bad.info.errors[0])
  check('坏 SVG 不计入可修复项（重写正文无用）', bad.info.residual === 0, `residual=${bad.info.residual}`)
  check('坏 SVG 不触发绘图（不靠重画掩盖）', bad.info.storedFallback === 0, `stored=${bad.info.storedFallback}`)
  check('坏 SVG 的绑定落成 failed 且无 id', bad.info.bindings[0]?.source === 'failed' && bad.info.bindings[0]?.id === '')
  check('坏 SVG 的素材位 id 保留（供单项重试）', !!bad.info.bindings[0]?.slotId, bad.info.bindings[0]?.slotId)
  void broken
  void a2
}

console.log('\n[阶段 3：跨自动修订复用 + 失败预算不清零 + 取消不派发]')
{
  // 跨修订：成功的素材位在后续"轮次"里直接复用成品块，不再检索也不再绘制
  resetStub()
  const reuseEvents = []
  const L = createLedger(newRunId())
  const first = await run(article(`[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]`, '> [!KEY|fresh] 记得带'), {
    persist: true,
    ledger: L,
    theme: '科技',
    onProgress: (e) => reuseEvents.push(e),
  })
  check('首轮现场绘制一次', first.info.storedFallback === 1 && L.order.length === 1, `stored=${first.info.storedFallback} slots=${L.order.length}`)
  // T7 所需的事实快照：首轮结束时的库条目、以及台账里记下的素材 ID
  const libCountAfterFirst = await listAssets()
  const firstSlotIds = Object.fromEntries(L.order.map((k) => [k, L.slots[k].assetId]))
  const second = await run(article(`[[deco:fresh|右下角一朵蓝色雪花，冬季科技大会]]`, '> [!KEY|fresh] 记得带'), {
    persist: true,
    ledger: L,
    theme: '科技',
    onProgress: (e) => reuseEvents.push(e),
  })
  check('第二轮不再绘制（复用成品块）', second.info.storedFallback === 0, `stored=${second.info.storedFallback}`)
  check('第二轮成品与首轮一致', second.out === first.out)
  // T7：原来是 `second.info.used[Object.keys(second.info.used)[0]] === undefined ? true : Object.keys(second.info.used).length === 1`
  // ——第二轮 used 为空时，第一个键就是 undefined，取键取值自然也是 undefined，于是整条直接走 `true`：
  // "压根没入库"被算成"没重复入库"，又一条恒真。现在改成有语义的断言：真去数库里的条目数，
  // 并要求第二轮给出的库 ID 集合不超出首轮（不许冒出新的库条目），且台账里记的素材 ID 不变。
  const libCountBeforeSecond = libCountAfterFirst.length
  const libCountAfterSecond = (await listAssets()).length
  const reusedIdsGrew = Object.keys(second.info.used).some((k) => !Object.keys(first.info.used).includes(k))
  const ledgerIdStable = L.order.every((k) => L.slots[k].assetId === firstSlotIds[k])
  check(
    '第二轮不重复入库（库条目数不变、无新增库 ID、台账素材 ID 不变）',
    !reusedIdsGrew && libCountAfterSecond === libCountBeforeSecond && ledgerIdStable,
    `lib ${libCountBeforeSecond}→${libCountAfterSecond} used=${JSON.stringify(Object.keys(second.info.used))} ledgerStable=${ledgerIdStable}`,
  )
  check('失败预算不因新轮次重置', L.order.length === 1, `slots=${L.order.length}`)
  void reuseEvents
}

console.log(failed === 0 ? '\nASSET-RESOLVE OK' : `\nASSET-RESOLVE FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
