// repair-integrity-check.mjs —— 自动修复的"事实保护"纯函数回归（DS 修复指南 包 B）
//
// 用法：
//   node scripts/repair-integrity-check.mjs [--out <目录>]
//
// 覆盖五件事，全部打在生产函数上（不复制实现）：
//   ① 事实规范化：8 点 30 分 / 08:30 / 8:30 是同一时刻；18:30 不是；电话格式差异可规范、尾号追加必须拦；
//   ② 正反对照：独立 emoji 删除只有 warning、事实保留 → 可通过；逐项删事实 → 阻断；
//   ③ 正文投影：SVG 属性/坐标/素材 ID/行内代码/拒收占位不进正文比较（改样式不该被判"丢事实"）；
//   ④ 口径一致：body.ok ↔ issuesFromBody 的严重度 ↔ deliveryVerdict.ok ↔ gate.bodyIntegrityOk
//      必须同源；"该比却比不了"（缺基准/投影失败）必须阻断，不能当通过。
//   ⑤ 规范化边界（指南 §4.3）：两组必须钉死的用例——**必须不通过**（日期/时间/电话的取值变化、
//      "新值包含旧值"的字符串陷阱、时间被整段删掉）与**必须通过**（同义时间格式、日期书写格式、
//      电话分隔符、姓名句式调整）。每例同时断言"规范值确实抽到了"，否则"两边都抽不出事实"会让
//      通过组变成恒真。
//
// 本脚本是**离线纯函数**检查：不起浏览器、不联网、不调模型、不写真实工作区。
// 原始证据（`~/.codex/visualizations/.../offline/fact-matcher-design-probes.mjs`）是"确认缺陷的
// 调查探针"，其 exit 0 只说明观察到了错误；这里改成断言**期望的正确行为**，输出另建目录。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const q = await import('../src/lib/delivery-quality.ts')
const { bodyIntegrity, issuesFromBody, deliveryVerdict, extractFacts, bodyText, ISSUE_CODES } = q

const argv = process.argv.slice(2)
const argOf = (n, d) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const stamp = new Date()
const pad = (n) => String(n).padStart(2, '0')
const outDir = resolve(
  argOf('--out', join(repoRoot, 'docs', 'artifacts', '2026-09-29-repair-integrity',
    `run-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`)),
)

let failed = 0
const LOG = []
const check = (name, ok, extra = '') => {
  const line = `  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`
  console.log(line)
  LOG.push(line)
  if (!ok) failed++
}

/** 一次完整判定：正文比较 + 清单 + 门禁（所有断言都走这条唯一判定路径） */
function judge(before, after, opts = {}) {
  const body = bodyIntegrity(before, after)
  const issues = issuesFromBody(body)
  const verdict = deliveryVerdict(issues, { htmlOk: true, body, ...opts })
  return { body, issues, verdict }
}

const kindsOf = (v) => [...new Set(v.blockers.map((b) => b.code))].join(',') || '无'

// ---------- ① 事实规范化 ----------
{
  const eq = (a, b, label) => {
    const fa = extractFacts(a)
    const fb = extractFacts(b)
    const ja = fa.map((f) => f.kind + '|' + f.canon).sort().join(',')
    const jb = fb.map((f) => f.kind + '|' + f.canon).sort().join(',')
    check(`① 规范化等价：${label}`, ja === jb, `\n      ${a} → ${ja}\n      ${b} → ${jb}`)
  }
  const ne = (a, b, label) => {
    const fa = extractFacts(a).map((f) => f.kind + '|' + f.canon)
    const fb = extractFacts(b).map((f) => f.kind + '|' + f.canon)
    check(`① 规范化不等价：${label}`, fa.some((x) => !fb.includes(x)), `旧 ${fa.join(',')} / 新 ${fb.join(',')}`)
  }
  eq('集合时间为8 点 30 分。', '集合时间为8:30。', '8 点 30 分 = 8:30')
  eq('集合时间为 08：30。', '集合时间为8:30。', '08：30 = 8:30')
  ne('集合时间为8:30。', '集合时间为18:30。', '8:30 ≠ 18:30')
  eq('活动日期2025年9月1日。', '活动日期2025-09-01。', '2025年9月1日 = 2025-09-01')
  ne('活动日期2025年9月1日。', '活动日期9月1日。', '带年份 ≠ 丢年份')
  ne('开放时间为10月1日。', '开放时间为10月10日。', '日期"新值包含旧值"（10月1日 是 10月10日 的前缀）不得并同')
  eq('联系电话：010-55556666。', '联系电话：010 5555 6666。', '电话分隔符差异')
  ne('联系电话：010-55556666。', '联系电话：010-555566660。', '电话尾号追加一位')
  const f = extractFacts('负责接待的是张老师。').filter((x) => x.kind === 'name')
  check('① 姓名不把虚词当名字', f.length === 1 && f[0].canon === '张老师', JSON.stringify(f))
}

// ---------- ② 正反对照（指南 §4.5 的"命中/未命中"两组） ----------
{
  const before = '活动于9月1日上午8点30分在东区操场举行，负责接待的是张老师，预计100名新生参加。'

  const emojiOnly = judge(before + '\n🎉', before)
  check(
    '② 删掉句外 emoji、事实全留 → 可通过',
    emojiOnly.verdict.ok && emojiOnly.body.factsMissing.length === 0,
    `ok=${emojiOnly.verdict.ok} 阻断=${kindsOf(emojiOnly.verdict)} 缺失=${emojiOnly.body.factsMissing.length}`,
  )
  check(
    '② 片段丢失（emoji）只作 warning，不是阻断项',
    emojiOnly.verdict.blockers.length === 0 && emojiOnly.issues.some((i) => i.code === 'body.text-lost' && i.severity === 'warning'),
    `blockers=${emojiOnly.verdict.blockers.length}`,
  )

  const inLine = judge('欢迎同学参加活动🎉，请提前了解集合安排。', '欢迎同学参加活动，请提前了解集合安排。')
  check('② 句中 emoji 被删、事实全留 → 可通过', inLine.verdict.ok, `ok=${inLine.verdict.ok} 阻断=${kindsOf(inLine.verdict)}`)

  const drops = [
    ['日期', '活动于上午8点30分在东区操场举行，负责接待的是张老师，预计100名新生参加。', 'date'],
    ['时间', '活动于9月1日在东区操场举行，负责接待的是张老师，预计100名新生参加。', 'time'],
    ['地点', '活动于9月1日上午8点30分举行，负责接待的是张老师，预计100名新生参加。', 'place'],
    ['姓名', '活动于9月1日上午8点30分在东区操场举行，预计100名新生参加。', 'name'],
    ['人数', '活动于9月1日上午8点30分在东区操场举行，负责接待的是张老师。', 'number'],
  ]
  for (const [label, after, kind] of drops) {
    const r = judge(before, after)
    check(
      `② 逐一删除${label} → 阻断并指到具体 kind`,
      !r.verdict.ok && r.body.factsMissing.some((f) => f.kind === kind),
      `缺失 ${r.body.factsMissing.map((f) => f.kind + ':' + f.text).join(' / ') || '无'}；阻断 ${kindsOf(r.verdict)}`,
    )
  }

  const timeChange = judge('集合时间为8:30。', '集合时间为18:30。')
  check('② 8:30→18:30 → 阻断（不能被"新值包含旧值"骗过）', !timeChange.verdict.ok, `阻断 ${kindsOf(timeChange.verdict)}`)

  const phoneAppend = judge('联系电话：010-55556666。', '联系电话：010-555566660。')
  check('② 电话尾号追加一位 → 阻断', !phoneAppend.verdict.ok, `阻断 ${kindsOf(phoneAppend.verdict)}`)

  const phoneFormat = judge('联系电话：010-55556666。', '联系电话：01055556666。')
  check('② 电话只是分隔符不同 → 可通过', phoneFormat.verdict.ok, `阻断 ${kindsOf(phoneFormat.verdict)}`)

  const paraphrase = judge('负责接待的是张老师。', '张老师负责接待。')
  check('② 姓名句式调整 → 可通过（不把虚词当保护事实）', paraphrase.verdict.ok, `阻断 ${kindsOf(paraphrase.verdict)}`)

  const headcount = judge('预计100名新生参加。', '预计1000名新生参加。')
  check('② 人数变化 → 阻断', !headcount.verdict.ok, `阻断 ${kindsOf(headcount.verdict)}`)

  // 同一行既有 emoji 又有日期：删 emoji 的许可不豁免该行的日期
  const sameLine = judge('活动于9月1日举行🎉。', '活动于举行🎉。')
  check('② 同行删 emoji 不能豁免同行日期', !sameLine.verdict.ok && sameLine.body.factsMissing.some((f) => f.kind === 'date'), `阻断 ${kindsOf(sameLine.verdict)}`)
}

// ---------- ③ 正文投影：素材实现/样式/坐标不是正文事实 ----------
{
  // fixture 里的 SVG **必须带可见文字**：早先那版的 SVG 只有属性与坐标，普通去标签就足以让它消失，
  // 于是"剔除整段 SVG"这条断言即使被关掉也照样绿（实测变异确认）——那是恒真的假保护。
  const beforeHtml =
    '<p>正文：9月1日在东区操场集合。</p><svg viewBox="0 0 750 220"><rect width="100" height="200" fill="#f2c76e"/><text x="20" y="40">素材内部文字甲</text></svg>'
  const afterHtml =
    '<p>正文：9月1日在东区操场集合。</p><svg viewBox="0 0 750 240"><circle cx="150" cy="100" r="46" fill="#8fb8a4"/><text x="20" y="40">素材内部文字乙</text></svg>'
  const proj = (h) => bodyText(h)
  check('③ 正文投影剔除 SVG（坐标/属性不当事实）', !/viewBox|750|220|<svg/.test(proj(beforeHtml)), proj(beforeHtml).slice(0, 60))
  check(
    '③ 正文投影剔除 SVG 内的**可见文字**（不是靠去标签碰巧通过）',
    !proj(beforeHtml).includes('素材内部文字甲') && !proj(afterHtml).includes('素材内部文字乙'),
    proj(beforeHtml).slice(0, 80),
  )
  const r = judge(proj(beforeHtml), proj(afterHtml))
  check('③ 只改素材实现 → 不产生任何正文阻断', r.verdict.ok, `阻断 ${kindsOf(r.verdict)}`)
  const ph = bodyText('<p>前文。</p><p>（此处原为美术素材「横幅插画」，未达标已略过）</p>')
  check('③ 系统生成的拒收占位不进正文投影', !ph.includes('此处原为美术素材'), ph)
  const code = bodyText(
    '<p>示例：<span style="background-color:#f6f8fa;font-family:Consolas,Menlo,monospace">010-55556666</span>结束</p>',
  )
  // DS 修复指南 §4.1 第 3 条：行内代码是**作者可见文本**，文字必须留在投影里
  // （否则 `联系电话：\`010-55556666\`。` 的首稿抽不出电话，"丢电话"永远检不出来）。
  // 不能留在投影里的是它的**样式/属性**——那是实现细节，不是文章事实。
  check('③ 行内代码的文字进正文投影（作者可见内容，指南 §4.1）', code.includes('010-55556666'), code)
  check(
    '③ 行内代码的样式属性不进正文投影（background-color / 字体名不是文章事实）',
    !/background-color|Consolas|monospace/.test(code),
    code,
  )
  // 端到端：行内代码里的电话被删掉时必须报事实丢失（这正是三个反例之一）
  const phoneInline = judge('联系电话：`010-55556666`。', '联系电话请见后续通知。')
  check(
    '③ 行内代码里的电话被删 → 阻断并指到 phone',
    !phoneInline.verdict.ok && phoneInline.body.factsMissing.some((f) => f.kind === 'phone'),
    `缺失 ${phoneInline.body.factsMissing.map((f) => f.kind + ':' + f.text).join(' / ') || '无'}`,
  )
  const leaked = bodyText('<p>泄漏：&lt;svg viewBox="0 0 750 220"&gt;</p>')
  check('③ 转义后的泄漏 SVG **仍**留在正文投影里（交给 leakIssues 阻断，不在这里洗掉）', leaked.includes('<svg'), leaked)
}

// ---------- ③b 假事实回归（对抗式审计发现，2026-09-29） ----------
// 这几条**曾经真的红过**：事实抽取把上下文词/虚词一起当事实，导致一次正常改写被判"丢事实"→
// 阻断整条修复链，用户看到的拒稿理由是"正文事实丢失（name）：感谢老师"这种荒谬的话。
// 断言只钉"改写后仍然通过"，不规定实现怎么写。
{
  const paraphraseCases = [
    ['活动在图书馆举行', '在图书馆举行活动', '地点状语换位'],
    ['他说“欢迎光临”', '他说：“欢迎光临！”', '引语只差标点'],
    ['感谢老师们的辛勤付出', '感谢各位老师的辛勤付出', '称谓前加了限定词'],
    ['负责接待的是张老师。', '张老师负责接待。', '姓名句式调整'],
    ['定于 8 点 30 分开始', '8:30 开始', '时间格式等价改写'],
  ]
  for (const [a, b, label] of paraphraseCases) {
    const r = bodyIntegrity(a, b)
    check(
      `③b 正常改写不误报丢事实：${label}`,
      r.ok && r.factsMissing.length === 0,
      `误报 ${JSON.stringify(r.factsMissing.map((f) => f.kind + ':' + f.text))}`,
    )
  }

  // 反向对照：**真删掉**仍然必须报（否则上面那组就是"什么都检不出来"的空断言）
  const realDeletes = [
    ['活动于9月1日上午8点30分在东区操场举行，负责接待的是张老师。', '活动于上午8点30分在东区操场举行，负责接待的是张老师。', 'date'],
    ['活动于9月1日上午8点30分在东区操场举行，负责接待的是张老师。', '活动于9月1日在东区操场举行，负责接待的是张老师。', 'time'],
    ['活动于9月1日上午8点30分在东区操场举行，负责接待的是张老师。', '活动于9月1日上午8点30分举行，负责接待的是张老师。', 'place'],
    ['活动于9月1日上午8点30分在东区操场举行，负责接待的是张老师。', '活动于9月1日上午8点30分在东区操场举行。', 'name'],
  ]
  for (const [a, b, kind] of realDeletes) {
    const r = bodyIntegrity(a, b)
    check(
      `③b 真删掉${kind}仍然报出（反向对照）`,
      !r.ok && r.factsMissing.some((f) => f.kind === kind),
      `缺失 ${JSON.stringify(r.factsMissing.map((f) => f.kind + ':' + f.text))}`,
    )
  }

  // 假事实本身也要钉住：这些串**不该**出现在抽取结果里
  const fakeSources = [
    ['本次活动由学生会主办，地点在图书馆三楼报告厅。', '地点在'],
    ['感谢老师们的辛勤付出，也感谢各位同学的到来。', '感谢'],
    ['周末到馆提醒：10月10日周六 9:00-17:00 开放。', '周末到馆'],
  ]
  for (const [text, bad] of fakeSources) {
    const got = extractFacts(text).map((f) => f.kind + ':' + f.text)
    check(
      `③b 不产出假事实（${bad}…）`,
      !got.some((g) => g.includes(bad)),
      `抽到 ${JSON.stringify(got)}`,
    )
  }
}

// ---------- ④ 口径一致性 + "比不了必须阻断" ----------
{
  const okBody = bodyIntegrity('活动于9月1日举行。', '活动于9月1日举行。')
  const badBody = bodyIntegrity('活动于9月1日举行。', '活动于举行。')
  for (const [label, body] of [['通过', okBody], ['未通过', badBody]]) {
    const issues = issuesFromBody(body)
    const v = deliveryVerdict(issues, { htmlOk: true, body, bodyApplicability: 'applied' })
    check(
      `④ body.ok=${body.ok}（${label}）与 verdict.ok / gate.bodyIntegrityOk 同源`,
      v.ok === body.ok && v.gate.bodyIntegrityOk === body.ok,
      `verdict.ok=${v.ok} gate=${v.gate.bodyIntegrityOk}`,
    )
  }

  const noBaseline = deliveryVerdict([], { htmlOk: true, bodyApplicability: 'failed' })
  check(
    '④ 该比却比不了 → 阻断（body.unverified），不当通过',
    !noBaseline.ok && noBaseline.blockers.some((b) => b.code === ISSUE_CODES.bodyUnverified),
    `ok=${noBaseline.ok} 阻断=${kindsOf(noBaseline)}`,
  )

  const notApplicable = deliveryVerdict([], { htmlOk: true, bodyApplicability: 'not-applicable' })
  check(
    '④ 不适用（首稿）→ 不做保留比较，但也不谎称通过',
    notApplicable.ok && notApplicable.checks.body === 'unknown' && !notApplicable.unverified.includes('body'),
    `ok=${notApplicable.ok} checks.body=${notApplicable.checks.body}`,
  )

  const claimedButMissing = deliveryVerdict([], { htmlOk: true, bodyApplicability: 'applied' })
  check(
    '④ 声称已比却没给结果 → 按"比不了"阻断',
    !claimedButMissing.ok && claimedButMissing.blockers.some((b) => b.code === ISSUE_CODES.bodyUnverified),
    `ok=${claimedButMissing.ok}`,
  )

  // 新增事实阻断 + 原问题变少：不能因为总数下降就放行（App 侧提升顺序的行为由 repair-flow-check 覆盖）
  const mixed = deliveryVerdict(issuesFromBody(bodyIntegrity('活动于9月1日在东区操场举行。', '活动在举行。')), { htmlOk: true, body: bodyIntegrity('活动于9月1日在东区操场举行。', '活动在举行。'), bodyApplicability: 'applied' })
  check('④ 事实缺失仍是最强阻断（不是靠条数多少）', !mixed.ok, `阻断 ${kindsOf(mixed)}`)
}

// ---------- ⑤ 规范化边界（指南 §4.3："声明可支持的规范化边界"） ----------
//
// 本实现**声明支持**的规范化（除此之外一律按"不同事实"阻断，不承认宽泛的"语义差不多"）：
//   · 时刻：`8 点 30 分` / `08：30` / `8:30` 等价；`9:00` 与 `19:00` 不等价；
//   · 日期：`2025年9月1日` / `2025-09-01` 等价且不丢年份；`10月1日` 与 `10月10日` 不等价；
//   · 电话：空格/连字符展示差异等价；数字不得增减，也不得因前缀包含关系混同；
//   · 姓名：`负责接待的是张老师` / `张老师负责接待` 保留同一姓名，虚词不入名。
// **不支持**（一律阻断）：任何数值、单位、年份、时刻的实际变化；同义改写。
//
// 红/绿分界（两组都必须能回答"什么输入下会变红"）：
//   · 必须不通过组：把规范化改宽（按裸字符串包含判断、把分钟/尾号差异当同义、把"新值包含旧值"当保留）
//     → verdict.ok 变 true，红；每例还钉住"缺失的必须是旧值那一条 canon"，避免"因为别的原因不通过"冒充通过。
//   · 必须通过组：把规范化改窄（只认 HH:MM、姓名连虚词一起抓、日期只认一种格式）→ factsMissing 非空，红；
//     每例同时断言 before/after 的规范值集合都含目标 canon **且文本确实不同**——
//     否则"两边一个字都没抽出来"（canon 集合都是空）会让这组恒真。
{
  const canonKeys = (t) => extractFacts(t).map((f) => f.kind + '|' + f.canon)
  const missingKeys = (r) => r.body.factsMissing.map((f) => f.kind + '|' + f.canon)
  const hasFactLostBlocker = (r) => r.issues.some((i) => i.code === 'body.fact-lost' && i.severity === 'blocking')

  // canon 现为「时段|hh:mm」（DS 修复指南 §4.1 第 2 条）：无时段限定词记 any，24 小时制下午记 pm。
  // 时段成了事实的一部分，所以「上午改下午」不再被当成"同一时刻"。
  const mustBlock = [
    ['日期取值变化 10月10日 → 10月11日', '开放时间为10月10日周六。', '开放时间为10月11日周日。', 'date|10-10'],
    ['日期"新值包含旧值" 10月1日 → 10月10日', '开放时间为10月1日。', '开放时间为10月10日。', 'date|10-01'],
    ['时间被整段删掉（9:00-17:00）', '开放时间 9:00-17:00，全天开放。', '开放时间，全天开放。', 'time|any|09:00'],
    ['时间"新值包含旧值" 9:00 → 19:00', '集合时间为9:00。', '集合时间为19:00。', 'time|any|09:00'],
    ['时段变化 上午8 点 30 分 → 下午8 点 30 分', '活动于上午8 点 30 分开始。', '活动于下午8 点 30 分开始。', 'time|am|08:30'],
    ['电话尾号变化 010-55556666 → 010-55556667', '联系电话 010-55556666。', '联系电话 010-55556667。', 'phone|01055556666'],
  ]
  for (const [label, before, after, mustMiss] of mustBlock) {
    const r = judge(before, after)
    check(
      `⑤ 必须不通过：${label}`,
      !r.verdict.ok && missingKeys(r).includes(mustMiss) && hasFactLostBlocker(r),
      `ok=${r.verdict.ok} 缺失=${missingKeys(r).join(',') || '无'}，阻断 ${kindsOf(r.verdict)}`,
    )
  }
  const timeGone = judge('开放时间 9:00-17:00，全天开放。', '开放时间，全天开放。')
  check(
    '⑤ 时间被整段删掉时起止两项都报出（不能只报一个）',
    missingKeys(timeGone).includes('time|any|09:00') && missingKeys(timeGone).includes('time|pm|17:00'),
    missingKeys(timeGone).join(',') || '（一项都没报）',
  )

  const mustPass = [
    ['同义时间格式 8 点 30 分 → 8:30', '集合时间为8 点 30 分。', '集合时间为8:30。', 'time|any|08:30'],
    ['同义时间格式 08：30 → 8:30', '集合时间为 08：30。', '集合时间为8:30。', 'time|any|08:30'],
    ['时段+12 小时制 = 24 小时制 下午8:30 → 20:30', '集合时间为下午8:30。', '集合时间为20:30。', 'time|pm|20:30'],
    ['日期书写格式 2025年9月1日 → 2025-09-01', '活动日期2025年9月1日。', '活动日期2025-09-01。', 'date|2025-09-01'],
    ['电话分隔符差异 010-55556666 → 010 5555 6666', '联系电话：010-55556666。', '联系电话：010 5555 6666。', 'phone|01055556666'],
    ['姓名句式调整 负责接待的是张老师 → 张老师负责接待', '负责接待的是张老师。', '张老师负责接待。', 'name|张老师'],
  ]
  for (const [label, before, after, mustKeep] of mustPass) {
    const r = judge(before, after)
    check(
      `⑤ 必须通过：${label}`,
      r.verdict.ok &&
        r.body.factsMissing.length === 0 &&
        before !== after &&
        canonKeys(before).includes(mustKeep) &&
        canonKeys(after).includes(mustKeep),
      `ok=${r.verdict.ok} 缺失=${r.body.factsMissing.length}；前 ${canonKeys(before).join(',') || '（未抽出事实）'}；后 ${canonKeys(after).join(',') || '（未抽出事实）'}`,
    )
  }
}

// ---------- ⑥ 复测反例的**逐字输入**回归（指南 §2.1："不得改写空格和格式来绕过反例"） ----------
//
// 输入逐字取自 `docs/artifacts/2026-09-30-ds-audit/regression-inputs.json` 的 `factCases`，
// 空格、全角标点、`|new`、行内反引号一律照抄——这几条正是审计时**漏拦**的原句，
// 换成"更易通过的表达"就等于把反例洗掉了。
//
// 走的是**生产渲染链**：`composeMarkdown`（v2 → 内联样式 HTML）→ `bodyText`（正文投影）→
// `bodyIntegrity`。行内代码那个反例只有在"HTML 投影"这一层才暴露得出来，直接比源文是骗自己。
{
  const { composeMarkdown } = await import('../src/lib/compose.ts')
  const proj = (source) => bodyText(composeMarkdown(String(source), {}).html)
  const cases = [
    {
      name: 'place-only-loss　仅删「在东区操场」',
      before: '[[theme:校园]]\n\n## 新生见面会\n\n活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。\n\n欢迎同学参加活动🎉，请提前了解集合安排。',
      after: '[[theme:校园]]\n\n## 新生见面会\n\n活动于9 月 1 日上午8 点 30 分举行，负责接待的是张老师，预计100名新生参加。\n\n欢迎同学参加活动，请提前了解集合安排。',
      wantAccepted: false,
      mustExtract: 'place:东区操场',
    },
    {
      name: 'ampm-changed　上午8 点 30 分 → 下午8 点 30 分',
      before: '[[theme:校园]]\n\n## 新生见面会\n\n活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。\n\n欢迎同学参加活动🎉，请提前了解集合安排。',
      after: '[[theme:校园]]\n\n## 新生见面会\n\n活动于9 月 1 日下午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。\n\n欢迎同学参加活动，请提前了解集合安排。',
      wantAccepted: false,
      mustExtract: 'time:上午8 点 30 分',
    },
    {
      name: 'inline-phone-loss　删除行内代码里的电话',
      before: '[[theme:校园]]\n\n## 新生见面会\n\n联系电话：`010-55556666`。\n\n欢迎同学参加活动🎉，请提前了解集合安排。',
      after: '[[theme:校园]]\n\n## 新生见面会\n\n联系电话请见后续通知。\n\n欢迎同学参加活动，请提前了解集合安排。',
      wantAccepted: false,
      mustExtract: 'phone:010-55556666',
    },
    {
      name: 'inline-phone-preserved　行内代码电话原样保留（正例）',
      before: '[[theme:校园]]\n\n## 新生见面会\n\n联系电话：`010-55556666`。\n\n欢迎同学参加活动🎉，请提前了解集合安排。',
      after: '[[theme:校园]]\n\n## 新生见面会\n\n联系电话：`010-55556666`。\n\n欢迎同学参加活动，请提前了解集合安排。',
      wantAccepted: true,
      mustExtract: 'phone:010-55556666',
    },
    {
      name: 'standalone-emoji-preserved　删掉独立成段的 emoji（正例）',
      before: '[[theme:校园]]\n\n## 新生见面会\n\n活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。\n\n🎉',
      after: '[[theme:校园]]\n\n## 新生见面会\n\n活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。',
      wantAccepted: true,
      mustExtract: 'place:东区操场',
    },
  ]
  for (const c of cases) {
    const beforeText = proj(c.before)
    const afterText = proj(c.after)
    const extracted = extractFacts(beforeText).map((f) => f.kind + ':' + f.text)
    const r = judge(beforeText, afterText)
    check(
      `⑥ ${c.name}：首稿真的抽到了要保护的事实（先证抽得出来）`,
      extracted.includes(c.mustExtract),
      `期望=${c.mustExtract}；实抽=${extracted.join(' / ') || '（什么都没抽到）'}`,
    )
    check(
      `⑥ ${c.name}：${c.wantAccepted ? '必须通过' : '必须阻断'}`,
      r.verdict.ok === c.wantAccepted,
      `ok=${r.verdict.ok}（期望 ${c.wantAccepted}）阻断=${kindsOf(r.verdict)} 缺失=${r.body.factsMissing.map((f) => f.kind + ':' + f.text).join(' / ') || '无'}`,
    )
    // 反例还要求**不是靠别的原因**不通过：必须有 body.fact-lost 这一条阻断
    if (!c.wantAccepted) {
      check(
        `⑥ ${c.name}：阻断原因确实是"正文事实丢失"（不是被别的规则顺带拦住）`,
        r.issues.some((i) => i.code === 'body.fact-lost' && i.severity === 'blocking'),
        r.issues.map((i) => `${i.code}:${i.severity}`).join(','),
      )
    }
  }
}

// ---------- 产出 ----------
mkdirSync(outDir, { recursive: true })
const report = `# 自动修复事实保护 —— 离线回归（${stamp.toISOString()}）

脚本：\`node scripts/repair-integrity-check.mjs --out ${outDir}\`
被测：\`src/lib/delivery-quality.ts\`（生产函数，纯离线；不联网、不调模型、不写真实工作区）

**结果：${failed === 0 ? '全部 PASS' : `FAIL ${failed} 条`}**

\`\`\`
${LOG.join('\n')}
\`\`\`
`
writeFileSync(join(outDir, 'result.md'), report, 'utf8')
console.log('')
console.log(`  产出留档：${outDir}`)
console.log(failed === 0 ? 'REPAIR-INTEGRITY OK' : `REPAIR-INTEGRITY FAILED (${failed})`)
process.exitCode = failed === 0 ? 0 : 1
