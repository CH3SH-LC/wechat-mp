// fact-assert-check.mjs —— 固定题面事实断言的**离线**回归（DS 修复指南 §0.4 第 3 条）
//
// 为什么必须有：这套判定原来长在 `live-acceptance.mjs` 里，那脚本要连真机、要花真钱，
// 所以它自己的错没人验得出来。审计实测出四类**真错**，本脚本逐条钉住：
//   ① 无数字边界：`/9:0{0,2}/` 让 `19:00` 通过 → 现在必须红；
//   ② 错误年份 / 错误星期一样通过 → 现在必须红；
//   ③ 日期与时间之间的**合法逗号**被判假红 → 现在必须绿；
//   ④ 写成"不开放"也算开放 → 现在必须红。
// 另外附上"改题面换 PASS"的反例：把 10月10日 换成 10月12日 不许通过。
//
// 全离线：不联网、不调模型、不启浏览器。判定走唯一 RunResult（指南 §3.1）。

import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { SAMPLE_OK_BODY, extractTimes, factChecks, inventedQuotaHits } from './lib/fact-assert.mjs'

const judge = createJudge({
  script: 'fact-assert-check',
  outDir: resolveOutDir('fact-assert-check'),
  plannedCases: ["①", "②", "③", "④", "⑤", "⑦", "⑧"],
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}

/** 造一个"预览读取结果"，只填事实断言用得到的字段 */
const art = (bodyText, title = '校园图书馆开放通知') => ({
  bodyText,
  firstHeadingText: title,
  titleNodeText: title,
  titleNodeMatched: true,
  bodyChars: bodyText.replace(/\s+/g, '').length,
  counted: bodyText.replace(/\s+/g, ''),
})

const TITLE = '校园图书馆开放通知'
const run = (body, title = TITLE) => factChecks(art(body, title), title, { expectTitle: TITLE, limit180: 180, tag: '' })
const byId = (checks, frag) => checks.find((c) => c.id.includes(frag))
const allOk = (checks) => checks.every((c) => c.pass)
const failing = (checks) => checks.filter((c) => !c.pass).map((c) => c.id)
/** 某一条（按 id 片段定位）是否被判失败——用来把"整套红"精确定位到出问题的那一条 */
const failsWith = (checks, frag) => failing(checks).some((id) => id.includes(frag))

// ─────────────────────────────────────────────────────────────────────────────
// ① 数字边界：19:00 不是 9:00
// ─────────────────────────────────────────────────────────────────────────────
{
  check('① 对照·合法正文必须全绿（否则下面的红没有意义）', allOk(run(SAMPLE_OK_BODY)), failing(run(SAMPLE_OK_BODY)).join(' | '))

  const t19 = '2026年10月10日（周六）19:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  const r19 = run(t19)
  check('① 把开放时刻写成 19:00 必须被拦住（旧实现会当成 9:00 放行）', !allOk(r19), `未通过项=${failing(r19).join(' | ')}`)
  check(
    '① 19:00 被正确规范成 19:00 而不是 9:00',
    extractTimes('19:00').every((x) => x.minutes === 19 * 60) && extractTimes('9:00').every((x) => x.minutes === 9 * 60),
    `19:00→${JSON.stringify(extractTimes('19:00').map((x) => x.minutes))}；9:00→${JSON.stringify(extractTimes('9:00').map((x) => x.minutes))}`,
  )
  check(
    '① 时段等价写法仍被接受：下午5:00 = 17:00',
    extractTimes('下午5:00')[0].minutes === 17 * 60 && extractTimes('下午 5 点')[0].minutes === 17 * 60,
    JSON.stringify(extractTimes('下午5:00').concat(extractTimes('下午 5 点')).map((x) => x.minutes)),
  )
  check(
    '① 无时段表达不加推定：8:30 仍是 8:30（不会被认成上午）',
    extractTimes('8:30')[0].minutes === 8 * 60 + 30,
    JSON.stringify(extractTimes('8:30').map((x) => x.minutes)),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ② 错误年份 / 错误星期
// ─────────────────────────────────────────────────────────────────────────────
{
  const wrongYear = '2025年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  const rYear = run(wrongYear)
  check('② 开放日写成 2025年10月10日 必须被拦住', !allOk(rYear), `未通过项=${failing(rYear).join(' | ')}`)
  check(
    '② 年份不是靠"看起来像"判断的：命中里能看出 2025',
    byId(rYear, '9:00').evidence.includes('2025'),
    byId(rYear, '9:00').evidence.slice(0, 200),
  )

  const wrongWeekday = '2026年10月10日（周日）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  const rWd = run(wrongWeekday)
  check('② 2026年10月10日（其实是周六）写成"周日"必须被拦住', !allOk(rWd), `未通过项=${failing(rWd).join(' | ')}`)

  // 反例：两天都写对星期，必须绿（不能靠"只要有星期就拦"蒙对）
  const rightWd = '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  check('② 对照：星期写对必须绿', allOk(run(rightWd)), failing(run(rightWd)).join(' | '))
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ 日期与时间之间带合法逗号 / 顿号，不得假红
// ─────────────────────────────────────────────────────────────────────────────
{
  const comma = '2026年10月10日，9:00–17:00 开放；2026年10月11日，全天闭馆。自习区，在一楼；咨询电话 010-55556666。'
  const rComma = run(comma)
  check('③ 日期与时段之间是逗号 → 必须绿（旧实现按逗号切句会假红）', allOk(rComma), `未通过项=${failing(rComma).join(' | ')}`)

  const commaReverse = '开放时间：9:00–17:00，2026年10月10日（周六）。2026年10月11日（周日）全天闭馆。自习区在一楼，电话 010 5555 6666。'
  check('③ 时段在前、日期在后的逗号写法也要绿', allOk(run(commaReverse)), `未通过项=${failing(run(commaReverse)).join(' | ')}`)

  const spacedPhone = '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010 5555 6666。'
  check('③ 电话写成 010 5555 6666 也要绿（间隔写法）', allOk(run(spacedPhone)), `未通过项=${failing(run(spacedPhone)).join(' | ')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ④ 否定开放：写成"不开放 / 暂停开放 / 闭馆"不得算开放
// ─────────────────────────────────────────────────────────────────────────────
{
  const negated = '2026年10月10日（周六）9:00–17:00 不开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  const rNeg = run(negated)
  check('④ 9:00–17:00 但是"不开放" → 必须被拦住', !allOk(rNeg), `未通过项=${failing(rNeg).join(' | ')}`)

  const paused = '2026年10月10日（周六）暂停开放 9:00–17:00；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  check('④ "暂停开放"同样不算开放', !allOk(run(paused)), `未通过项=${failing(run(paused)).join(' | ')}`)

  const closedDayOpenHours =
    '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）8:00–20:00 闭馆。自习区在一楼，咨询电话 010-55556666。'
  check('④ 闭馆日却写了开放时段 → 必须被拦住', !allOk(run(closedDayOpenHours)), `未通过项=${failing(run(closedDayOpenHours)).join(' | ')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ 改题面换 PASS 的路径必须堵死
// ─────────────────────────────────────────────────────────────────────────────
{
  // 把开放日改成 10月12日（同一年、星期写法也自洽）：事实变了就必须红，不能靠"有日期有时段"通过
  const swapped = '2026年10月12日（周一）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  const rSwap = run(swapped)
  check('⑤ 把开放日换成 10月12日 不通过（题面事实固定，不能改题换绿）', !allOk(rSwap), `未通过项=${failing(rSwap).join(' | ')}`)

  const missingPhone = '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼。'
  check('⑤ 缺电话不通过', !allOk(run(missingPhone)), `未通过项=${failing(run(missingPhone)).join(' | ')}`)

  const wrongFloor = '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在二楼，咨询电话 010-55556666。'
  check('⑤ 自习区写成二楼不通过', !allOk(run(wrongFloor)), `未通过项=${failing(run(wrongFloor)).join(' | ')}`)

  const missingClosed = '2026年10月10日（周六）9:00–17:00 开放。自习区在一楼，咨询电话 010-55556666。'
  check('⑤ 只写开放不写闭馆不通过', !allOk(run(missingClosed)), `未通过项=${failing(run(missingClosed)).join(' | ')}`)

  const tooLong = '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。' + '补充说明。'.repeat(30)
  check('⑤ 超过 180 字不通过', !allOk(run(tooLong)), `未通过项=${failing(run(tooLong)).join(' | ')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ 2026-10-02 独立复核新增反例（未修前逐条为红，修后转绿）
//    docs/artifacts/2026-10-02-continuation-review/live-flow-audit/README.md 已复现表：
//    · 年份：ISO 写法 2025-10-10 不得被当成"无年份的 10-10"放行；
//    · 时段：起止必须同一句内成对（起=9:00、止=17:00），不能靠全文别处出现 17:00 蒙过；
//    · 闭馆否定："全天不闭馆"不等于"全天闭馆"；
//    · 地点否定："自习区不在一楼"不等于"自习区在一楼"；
//    · 合法紧凑写法（日期紧贴时刻、无空格）必须绿，不得跨句被下一句的"闭馆"误伤。
// ─────────────────────────────────────────────────────────────────────────────
{
  // ⑥-1 ISO 年份：正确题面是 2026年10月10日（周六）。写成 2025-10-10 时，旧的 `10-10` 无年份分支会放行。
  const isoWrongYear =
    '2025-10-10（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
  const rIso = run(isoWrongYear)
  check(
    '⑥ ISO 年份 2025-10-10 必须被拦住（开放事实不得放行）',
    failsWith(rIso, '9:00'),
    `未通过项=${failing(rIso).join(' | ')}`,
  )
  check(
    '⑥ 对照：2026-10-10（ISO，年份正确）必须绿',
    allOk(
      run('2026-10-10（周六）9:00–17:00 开放；2026-10-11（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'),
    ),
    failing(
      run('2026-10-10（周六）9:00–17:00 开放；2026-10-11（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'),
    ).join(' | '),
  )

  // ⑥-2 时段成对：开放时段被改成 9:00–16:00，另起一句写"17:00 结束"。旧判定只看全文是否出现 17:00 → 放行。
  const brokenPair =
    '2026年10月10日（周六）9:00–16:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666，咨询服务于17:00结束。'
  const rPair = run(brokenPair)
  check(
    '⑥ 开放止于 16:00、17:00 出现在别句 → 不得放行（起止必须同句成对）',
    failsWith(rPair, '9:00'),
    `未通过项=${failing(rPair).join(' | ')}`,
  )

  // ⑥-3 闭馆否定："全天不闭馆"仍是开放表述，不得当作闭馆事实。
  const notClosed =
    '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天不闭馆。自习区在一楼，咨询电话 010-55556666。'
  const rNotClosed = run(notClosed)
  check(
    '⑥ "全天不闭馆"必须被拦住（否定不得算闭馆）',
    failsWith(rNotClosed, '全天闭馆'),
    `未通过项=${failing(rNotClosed).join(' | ')}`,
  )

  // ⑥-4 地点否定："自习区不在一楼"不得当作"自习区在一楼"。
  const notFloor =
    '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区不在一楼，咨询电话 010-55556666。'
  const rNotFloor = run(notFloor)
  check(
    '⑥ "自习区不在一楼"必须被拦住（否定不得算楼层）',
    failsWith(rNotFloor, '自习区在一楼'),
    `未通过项=${failing(rNotFloor).join(' | ')}`,
  )

  // ⑥-5 合法紧凑写法（复核点名的假红）：日期紧贴时刻、无空格，必须全绿。
  const compact = '10月10日9:00–17:00开放；10月11日全天闭馆。自习区在一楼，电话010-55556666。'
  const rCompact = run(compact)
  check('⑥ 合法紧凑写法（无空格）必须绿，不得跨句误伤', allOk(rCompact), `未通过项=${failing(rCompact).join(' | ')}`)
}

// ⑦ 2026-10-02 **真机**跑出来的假红：模型把"9:00—17:00 开放"和"10月11日全天闭馆"写进**同一句**
// （中间没有句号），旧实现拿整句判否定 → 完全合法的开放时段被判成"没有成对"。
// 这段正文逐字来自那次真实生成的 `counted`（L1，接受稿，154 字），必须**全绿**。
console.log('\n[⑦ 真机正文（开放与闭馆同句）不得假红]')
{
  const realBody =
    '校园图书馆开放通知为配合馆内设备维护，本周末开馆安排调整如下，请提前安排借还与自习时间。' +
    '10月10日（周六）9:00—17:00开放10月11日（周日）全天闭馆自习区设在一楼咨询电话010-55556666周日全天闭馆请提前完成借还，避免跑空。' +
    '闭馆期间如有疑问，可拨打010-55556666咨询，感谢理解。'
  const rReal = run(realBody)
  check('⑦ 真机正文（开放与闭馆同句、含破折号）必须全绿', allOk(rReal), `未通过项=${failing(rReal).join(' | ')}`)

  // 同一句里出现"正常开放"也不得把**另一处**的闭馆判成被否定
  const withNormal = '10月10日（周六）9:00-17:00正常开放；10月11日（周日）全天闭馆。自习区在一楼，电话010-55556666。'
  const rNormal = run(withNormal)
  check('⑦ 同句出现"正常开放"不得否定另一处闭馆', allOk(rNormal), `未通过项=${failing(rNormal).join(' | ')}`)

  // 真机第二例：模型把两条写成一行、用**字段标签**分隔（"…9:00–17:00闭馆安排：10月11日…"）。
  // "闭馆安排："是下一条的标签，不是对上面那段开放时间的否定——不得据此判红。
  const labeledBody =
    '按学校安排，图书馆本周开放时间调整如下，请同学们提前安排借还书与自习。' +
    '开放时间：10月10日（周六）9:00–17:00闭馆安排：10月11日（周日）全天闭馆' +
    '自习区：一楼，随开馆时间同步开放咨询电话：010-55556666需要办理借还书的同学，请在10月10日开放时段内完成。由此带来的不便，敬请谅解。'
  const rLabeled = run(labeledBody)
  check('⑦ 字段标签（"闭馆安排："）不得被当作否定而判红', allOk(rLabeled), `未通过项=${failing(rLabeled).join(' | ')}`)

  // 但**紧贴**闭馆的否定仍然要拦（这条不能被上一条放松掉）
  const notClosedNear = '10月10日（周六）9:00-17:00开放；10月11日（周日）全天不闭馆。自习区在一楼，电话010-55556666。'
  const rNot = run(notClosedNear)
  check('⑦ 对照：「全天不闭馆」仍然必须红', failsWith(rNot, '全天闭馆'), `未通过项=${failing(rNot).join(' | ')}`)
}

console.log('\n[⑧ 数量编造判定（T4：把未定的人数写成具体数字）]')
{
  // 背景：G2A 的旧判据是**裸子串**「名额」——实测正文写的是
  // 「会在费用、名额确定后一并向大家说明」（**恰好说明它没编**）却被判红。
  // 判据要拦的是"给未定项安上一个数字"这个缺陷形态，不是某个词的出现。
  const cases = [
    // 必须命中：给未定项安了数字
    ['名额60个', true],
    ['限额：30', true],
    ['60 个名额', true],
    ['限 30 人', true],
    ['人数上限 50', true],
    ['人数不超过 40', true],
    ['名额三十名', true],
    ['限五十人', true],
    ['名额６０', true], // 全角数字
    // 必须不命中：如实说明"还没定"
    ['会在费用、名额确定后一并向大家说明。', false],
    ['报名费用与人数上限暂未确定，', false],
    ['名额一旦确定就会通知', false],
    ['费用尚未确定，确定后在本通知中同步', false],
    ['请提前 5 分钟到场', false],
  ]
  for (const [s, want] of cases) {
    const hits = inventedQuotaHits(s)
    check(
      `⑧ ${want ? '必须命中' : '必须不命中'}：${s}`,
      want ? hits.length > 0 : hits.length === 0,
      JSON.stringify(hits),
    )
  }
  // 对照：同一句式只把"如实说明"改成"编造"，判据必须立刻翻面（证明它不是恒假）
  const honest = '会在费用、名额确定后一并向大家说明。'
  const invented = '名额 30 人，先到先得。'
  check(
    '⑧ 对照：同一句式改成「名额 30 人」必须命中（判据不是恒假）',
    inventedQuotaHits(honest).length === 0 && inventedQuotaHits(invented).length > 0,
    `honest=${JSON.stringify(inventedQuotaHits(honest))} invented=${JSON.stringify(inventedQuotaHits(invented))}`,
  )
}

console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'FACT-ASSERT' })
