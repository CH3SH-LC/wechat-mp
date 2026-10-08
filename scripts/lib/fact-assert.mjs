// fact-assert.mjs —— 固定题面的事实断言（DS 修复指南 §0.4 第 3 条）
//
// 为什么单独成模块：这套判定原本长在 `live-acceptance.mjs` 里，而 `live-acceptance.mjs` 要连真机、
// 要花真钱，**没法在离线回归里验**。于是它自己的错就一直没被发现——审计实测出四类：
//   ① 用 `/9:0{0,2}/` 这种**没有数字边界**的模式，`19:00` 会被当成 `9:00` 通过；
//   ② 只看"全文有没有出现过"，错误年份、错误星期一样过；
//   ③ 把正文按逗号切分后要求日期与时段落在**同一个短句**里，于是"2026年10月10日，9:00–17:00 开放"
//      这种完全合法的写法被判**假红**；
//   ④ 没有否定检查，写成"不开放"也算开放。
// 抽出来之后，`scripts/fact-assert-check.mjs` 用固定反例把它钉住（含上述四类的正反例）。
//
// 2026-10-02 独立复核又复现出五类（本文件当时用的是"固定字数邻近窗口 + 全文出现即算"）：
//   ⑤ ISO 年份漏判：`2025-10-10` 的 `10-10` 落进无年份分支，错误年份被放行；
//   ⑥ 时段未成对：开放时段写成 `9:00–16:00`、另句写"17:00 结束"，只看全文出现 `17:00` 仍通过；
//   ⑦ 闭馆否定缺失："全天不闭馆"照样通过；
//   ⑧ 地点否定缺失："自习区不在一楼"照样通过；
//   ⑨ 合法紧凑文本跨句误伤：`10月10日9:00–17:00开放；10月11日全天闭馆。…` 被判红。
// 因此判定改为**按句读切分**（`。；;\n`，逗号不是切分点）：日期、成对时段、否定一律限定在**同一句**内，
// 不再用固定字数窗口做跨句判断。反例见 `fact-assert-check.mjs` 第 ⑥ 节。
//
// 这里只做**判定**，不碰网络、不碰浏览器、不碰文件系统。

/** 归一化：去掉空白，统一破折号与冒号写法 */
export const norm = (s) =>
  String(s || '')
    .replace(/\s+/g, '')
    .replace(/[—–―−~～]/g, '-')
    .replace(/[：]/g, ':')

export const clip = (s, n) => {
  const t = String(s == null ? '' : s)
  return t.length > n ? t.slice(0, n) + '…' : t
}

/** 全角数字 → 半角（只用于下面的数量判定，不改动 `norm` 的其它口径） */
const toHalfDigits = (s) => String(s || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

/**
 * "把**未定**的人数/费用写成具体数字"这一类**编造数量**的写法（待办 T4，2026-10-08）。
 *
 * 为什么要单独一条规则：旧判据是**裸子串**——只要正文出现「名额」就判"补写了未给的规则"。
 * 实测（G2A 2026-10-08）写的是「会在费用、**名额确定后**一并向大家说明」——**恰好说明它没编**，
 * 却被判红。真正的缺陷形态只有一个：**给尚未确定的项安上一个数字**。
 *
 * 覆盖面（明写，不外推）：
 *   · 阿拉伯数字全形态：`名额60` / `限额：30` / `60 个名额` / `限 30 人` / `人数上限 50`；
 *   · 中文数字**要求带单位**（个/名/人/位）：`名额三十名` / `限五十人`。不带单位的中文数字
 *     **不覆盖**——因为「名额一旦确定」里的「一」会被误伤，宁可少拦也不制造新的假红。
 *
 * @param {string} body 正文（可为原文，内部自己 `norm` + 全角数字归一）
 * @returns {string[]} 命中的原文片段（空数组 = 没有编造）
 */
export const RE_INVENTED_QUOTA = new RegExp(
  [
    '(?:名额|限额|限报|上限)\\s*[:：]?\\s*\\d+',
    '(?:名额|限额|限报|上限)\\s*[:：]?\\s*[一二三四五六七八九十百千]+\\s*(?:个|名|人|位)',
    '\\d+\\s*个\\s*名额',
    '[一二三四五六七八九十百千]+\\s*个\\s*名额',
    '限\\s*\\d+\\s*人',
    '限\\s*[一二三四五六七八九十百千]+\\s*人',
    '人数\\s*(?:上限|不超过|限制为)\\s*[:：]?\\s*\\d+',
    '人数\\s*(?:上限|不超过|限制为)\\s*[:：]?\\s*[一二三四五六七八九十百千]+\\s*(?:个|名|人|位)',
  ].join('|'),
  'g',
)

export function inventedQuotaHits(body) {
  const t = toHalfDigits(norm(body))
  const out = []
  RE_INVENTED_QUOTA.lastIndex = 0
  let m
  while ((m = RE_INVENTED_QUOTA.exec(t))) {
    out.push(m[0])
    if (out.length >= 5) break
  }
  return out
}

/** 取 `token` 前后 radius 个字符的窗口 */
export function windowAround(text, token, radius = 26) {
  const i = text.indexOf(token)
  if (i < 0) return null
  return text.slice(Math.max(0, i - radius), Math.min(text.length, i + token.length + radius))
}

/**
 * 把正文里出现的**时刻**抽出来并规范成"零点起的分钟数"。
 *
 * 必须先切出【整段时刻文本】再比较分钟数，而不是拿裸子串去 `includes`：`19:00` 与 `9:00`
 * 是两个不同的时刻，前者的数字边界必须被尊重。时段按明确等价规范（指南 §4.1）：
 * 下午/晚上 +12（"下午5"就是 17:00），凌晨 12 点按 0 点。
 * **不加推定**：没写时段的 `8:30` 就是 8:30，不会被自动认成上午 8:30。
 */
export function extractTimes(text) {
  const out = []
  // 边界只需挡**前一位数字**：`19:00` 里的 `9` 前面是 `1`，所以不会被另读成 `9:00`。
  // ⚠️ 不能顺手把冒号也挡掉：正文里"开放时间：9:00"经归一化后是"开放时间:9:00"，
  // 挡冒号会把这种**完全正常**的写法整条漏掉（实测：整段只识别出 17:00，9:00 不见了）。
  const re = /(?<!\d)(上午|下午|晚上|中午|凌晨)?\s*(\d{1,2})\s*(?:[:：](\d{2})|([点时])(?:(\d{1,2})分?)?)(?![\d])/g
  let m
  while ((m = re.exec(text))) {
    const band = m[1] || ''
    let h = Number(m[2])
    const mi = m[3] !== undefined ? Number(m[3]) : m[5] !== undefined ? Number(m[5]) : 0
    if ((band === '下午' || band === '晚上') && h < 12) h += 12
    if (band === '凌晨' && h === 12) h = 0
    if (h > 23 || mi > 59) continue
    out.push({ raw: m[0].trim(), index: m.index, len: m[0].length, band, minutes: h * 60 + mi })
  }
  return out
}

/**
 * 日期命中：返回 `{ index, len, year, yearOk, raw }`。
 * "有年份但年份不对"**必须**判失败（指南 §0.4：错误年份不得通过），所以年份单独解析、单独核。
 */
export function dateHits(text, y, m, d) {
  // 年份**必须和月日落在同一次匹配里**。旧写法 `(?:(\\d{4})年)?` + 独立的无年份分支，会把 ISO 的
  // `2025-10-10` 拆成两段：`2025年` 不成组（后面是 `-` 不是 `年`），`10-10` 落进无年份分支 →
  // `year=null` → `yearOk=true` → 错误年份被整条放行（2026-10-02 复核 P1）。
  // 现在：年是可选的**前缀**（后缀 `年`/`-`/`/`），月日之间只吃 `月`/`-`/`/`；两侧数字边界
  // `(?<!\\d)`/`(?!\\d)` 挡"扎进更长数字串中间"。`2026-10-10` 因此整体命中且 `year=2026`。
  const re = new RegExp(`(?<!\\d)(?:(\\d{4})[年\\-/])?0?${m}[月\\-/]0?${d}[日号]?(?!\\d)`, 'g')
  const out = []
  let mm
  while ((mm = re.exec(text))) {
    const year = mm[1] ? Number(mm[1]) : null
    out.push({ raw: mm[0], index: mm.index, len: mm[0].length, year, yearOk: year === null || year === y })
  }
  return out
}

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const weekdayName = (iso) => WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()]

/**
 * 日期附近的星期写法若存在，必须与真实星期一致；不写星期则不判失败。
 *
 * 取法：**先看日期紧后面**，没有才退回同一句的前面。
 * 不能简单取"前后 8 字里第一个 周X"——正文里"2026年10月10日（周六）。2026年10月11日（周日）…"
 * 是常见写法，前一个日期的"周六"正好落在后一个日期的前置窗口里，会让 10月11日 被判成周六
 * （实测踩到）。退回前面时也先按句读切断，避免跨句借来别人的星期。
 */
export function weekdayOkIn(text, index, len, iso) {
  const want = weekdayName(iso)
  const map = { 一: '周一', 二: '周二', 三: '周三', 四: '周四', 五: '周五', 六: '周六', 日: '周日', 天: '周日', 末: '周六' }
  const findIn = (s) => {
    const m = /(?:周|星期)([一二三四五六日天末])/.exec(s)
    return m ? map[m[1]] : null
  }
  const after = text.slice(index + len, index + len + 8)
  const beforeRaw = text.slice(Math.max(0, index - 8), index)
  const cut = beforeRaw.search(/[。；;，,、]/)
  const before = cut >= 0 ? beforeRaw.slice(cut + 1) : beforeRaw
  const found = findIn(after) || findIn(before)
  if (!found) return { ok: true, found: null, want }
  return { ok: found === want, found, want }
}

/**
 * 按**句读**切分：`。`、全/半角分号、换行。**逗号与顿号不是切分点**——"2026年10月10日，9:00–17:00 开放"
 * 是合法写法，按逗号切会把日期与时段的成对关系切断（指南 §0.4 点名假红）。分隔符保留在句尾。
 * 2026-10-02 复核的根因就是"用固定字数窗口做跨句判断"：9:00 的 ±22 字窗口跨到下一句的"闭馆"被误伤。
 * 改成句读切分后，否定/成对/日期一律限定在**同一句**内判。
 */
export function splitSentences(text) {
  const s = String(text || '')
  const out = []
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '。' || ch === '；' || ch === ';' || ch === '\n') {
      out.push({ text: s.slice(start, i + 1), start, end: i + 1 })
      start = i + 1
    }
  }
  if (start < s.length) out.push({ text: s.slice(start), start, end: s.length })
  return out
}

const NEG_OPEN = /闭馆|不开放|非开放|停止开放|暂停开放|休馆|暂不开放/
/** 闭馆被**否定**的写法：「不闭馆/非闭馆/未闭馆/没闭馆」「照常/如常/照旧」「正常开放/正常开馆/正常营业」 */
const NEG_CLOSED = /[不非未没无](?:闭馆|休馆)|照常|如常|照旧|正常(?:开放|开馆|营业|服务)/
/** 地点被**否定**的写法：「不在/不位于/不处于」「并非」 */
const NEG_PLACE = /[不非未没无](?:在|位于|处于)|并非/
/** 时段起止之间的合法连接符（norm 已把破折号统一成 `-`） */
const RANGE_CONN = /^[-~至到]+$/
/** 开放语义词：本句必须表达"开放"，不能只有裸时刻 */
const OPEN_WORDS = /开放|开馆|到馆|营业|对外开放|服务/
/**
 * **字段标签**不是否定：紧凑列表正文里常见"开放时间：… 闭馆安排：10月11日全天闭馆"，
 * 这里的"闭馆安排："是下一条的标签，不是对上面那个时段的否定。
 * 2026-10-02 真机踩到：模型把两条写成一行（`9:00–17:00闭馆安排：10月11日…`），
 * 否定窗口吃到紧随其后的"闭馆"→ 完全合法的开放时段被判成"没有成对"（假红）。
 * 判据：标签形如 `闭馆/开放/… + 可选名词 + 冒号`，且前面**没有**否定字（"不闭馆："不算标签）。
 */
const LABEL_SHAPED = /(?<![不非未没无])(?:闭馆|休馆|开放|开馆)\s*(?:安排|时间|说明|时段)?\s*[:：]/g

/**
 * 在同一句内找**成对的开放时段**：起 == fromMin、止 == toMin，止在起之后，中间是合法连接符。
 * 只要求"全文任意位置出现过 17:00"不算数——复核 P1 正是拿"9:00–16:00 …另起一句 17:00 结束"蒙过的。
 */
export function findOpenPair(sentence, fromMin, toMin) {
  const ts = extractTimes(sentence)
  const starts = ts.filter((x) => x.minutes === fromMin)
  const ends = ts.filter((x) => x.minutes === toMin)
  for (const a of starts) {
    for (const b of ends) {
      if (b.index < a.index + a.len) continue // 止必须在起之后
      if (!RANGE_CONN.test(sentence.slice(a.index + a.len, b.index))) continue
      return { from: a, to: b }
    }
  }
  return null
}

/** 题面事实（固定测试情境） */
export const FACTS = {
  open: { y: 2026, m: 10, d: 10, iso: '2026-10-10', fromMin: 9 * 60, toMin: 17 * 60 }, // 周六
  closed: { y: 2026, m: 10, d: 11, iso: '2026-10-11' }, // 周日
  place: { study: '自习', floor: '一楼' },
  phone: '01055556666', // 去非数字后的样子
  phoneRaw: '010-55556666',
}

/**
 * 题面事实断言（L1/L2 共用）。返回 `[{ id, pass, evidence }]`。
 *
 * 归属按**句读切分**（`。；;\n`，逗号/顿号**不是**切分点）：日期、成对时段、闭馆、楼层一律在**同一句**内判，
 * 不再用固定字数窗口——那样会把"10月10日9:00–17:00开放；10月11日全天闭馆。"的 9:00 窗口跨到下一句的
 * "闭馆"上造成假红（2026-10-02 复核 P2）。逗号切分则会把"2026年10月10日，9:00–17:00 开放"的合法写法切断（指南 §0.4）。
 *
 * @param article `{ bodyText, firstHeadingText, bodyChars, counted }`（预览内正文读取结果）
 * @param sourceTitle 源文标题行
 * @param opts `{ expectTitle, limit180, tag }`；`tag` 是检查 id 前缀（缺省空串）
 */
export function factChecks(article, sourceTitle, { expectTitle, limit180, tag = '' } = {}) {
  const t = norm(article ? article.bodyText : '')
  const full = norm(`${sourceTitle || ''} ${article ? article.bodyText : ''}`)
  const out = []
  const add = (id, pass, ev) => out.push({ id: `${tag}${id}`, pass: Boolean(pass), evidence: ev })

  if (expectTitle) {
    const node = article ? article.firstHeadingText : ''
    add(
      `标题节点与源文都含「${expectTitle}」`,
      norm(node).includes(norm(expectTitle)) && norm(sourceTitle).includes(norm(expectTitle)),
      `预览首个标题节点=「${clip(node, 60)}」；源文标题行=「${clip(sourceTitle, 60)}」`,
    )
  }

  const times = extractTimes(t)
  const at = (mins) => times.filter((x) => x.minutes === mins)
  const sentences = splitSentences(t)

  // ── 开放：**同一句**内 10月10日（年份对）+ 起止成对（9:00→17:00）+ 开放语义 + 非否定 ──
  // 不再用固定字数窗口：日期与时刻分居两句（或时刻被别句的"闭馆"盖住）都不再算数。
  const { open, closed } = FACTS
  const dOpen = dateHits(t, open.y, open.m, open.d)
  const dOpenWrongYear = dOpen.find((h) => !h.yearOk) || null
  const openStarts = at(open.fromMin)
  const openEnds = at(open.toMin)
  let openHit = null // { S, hit, pair, wd }
  for (const S of sentences) {
    if (!OPEN_WORDS.test(S.text)) continue
    const pair = findOpenPair(S.text, open.fromMin, open.toMin) // 起止必须在同一句内成对
    if (!pair) continue
    // 否定只在**成对时段附近**判，不看整句：2026-10-02 真机实测，模型把
    // "10月10日（周六）9:00—17:00开放" 与 "10月11日（周日）全天闭馆" 写进了**同一句**（中间没有句号），
    // 整句判否定就会让完全合法的开放时段被判成"没有成对"（假红）。
    const near = S.text.slice(
      Math.max(0, pair.from.index - 10),
      Math.min(S.text.length, pair.to.index + pair.to.len + 6),
    )
    if (NEG_OPEN.test(near.replace(LABEL_SHAPED, ''))) continue // 时段附近写着"闭馆/不开放"才不算开放语境（字段标签不算）
    const hit = dateHits(S.text, open.y, open.m, open.d).find((h) => h.yearOk) // 年份正确或未写
    if (!hit) continue
    const wd = weekdayOkIn(S.text, hit.index, hit.len, open.iso) // 星期写了必须对
    if (!wd.ok) continue
    openHit = { S, hit, pair, wd }
    break
  }
  add(
    `事实-周六 10月10日 9:00–17:00 开放（同一句内日期+起止成对，且不是"闭馆/不开放"语境）`,
    Boolean(openHit) && dOpenWrongYear === null,
    `10月10日命中=${dOpen.length ? JSON.stringify(dOpen.map((h) => h.raw)) : '无'}` +
      `${dOpenWrongYear ? `（错误年份 ${dOpenWrongYear.year}）` : ''}` +
      `；星期=${openHit ? openHit.wd.found || '未写' : '未定'}` +
      `；9:00 命中=${openStarts.length}；17:00 命中=${openEnds.length}` +
      `；成对同句=${openHit ? '「' + clip(openHit.S.text, 80) + '」' : '无'}` +
      `；全部时刻=${JSON.stringify(times.map((x) => x.raw))}`,
  )
  // 反例：19:00 不得被当成 9:00（旧的无边界正则正是这么漏的）
  add(
    '事实-反例：19:00 不会被当成 9:00（数字边界严格）',
    !/(?<![\d:])19\s*[:：]/.test(t) || !at(open.fromMin).some((x) => x.raw.includes('19')),
    `19:00 出现=${/(?<![\d:])19\s*[:：]/.test(t)}；被规范成 9:00 的原始写法=${JSON.stringify(at(open.fromMin).map((x) => x.raw))}`,
  )

  // ── 闭馆：**同一句**内 10月11日（年份对）+ 全天 + 闭馆词，且闭馆**未被否定** ──
  // "全天不闭馆""照常开放"这类否定/反向表述不得算闭馆（复核 P1）。
  const dClosed = dateHits(t, closed.y, closed.m, closed.d)
  const dClosedWrongYear = dClosed.find((h) => !h.yearOk) || null
  let closedHit = null // { S, hit, wd }
  for (const S of sentences) {
    const hit = dateHits(S.text, closed.y, closed.m, closed.d).find((h) => h.yearOk)
    if (!hit) continue
    if (!S.text.includes('全天')) continue
    if (!/闭馆|休馆/.test(S.text)) continue
    // 同理：否定只看"闭馆"附近，不看整句——整句里可能有另一处的"正常开放/照常"，那不是对闭馆的否定
    const ci = S.text.search(/闭馆|休馆/)
    const nearClosed = S.text.slice(Math.max(0, ci - 8), Math.min(S.text.length, ci + 12))
    if (NEG_CLOSED.test(nearClosed)) continue // "全天不闭馆/照常开放"不是闭馆
    const wd = weekdayOkIn(S.text, hit.index, hit.len, closed.iso)
    if (!wd.ok) continue
    closedHit = { S, hit, wd }
    break
  }
  add(
    '事实-周日 10月11日全天闭馆（同一句内日期+"全天"+闭馆，且闭馆未被否定）',
    Boolean(closedHit) && dClosedWrongYear === null,
    `10月11日命中=${dClosed.length ? JSON.stringify(dClosed.map((h) => h.raw)) : '无'}` +
      `${dClosedWrongYear ? `（错误年份 ${dClosedWrongYear.year}）` : ''}` +
      `；星期=${closedHit ? closedHit.wd.found || '未写' : '未定'}` +
      `；闭馆同句=${closedHit ? '「' + clip(closedHit.S.text, 90) + '」' : '无'}`,
  )

  // ── 自习区在一楼：同一句（或紧邻句）内同时出现，且**不得是否定**（"自习区不在一楼"） ──
  let placeUnit = null
  for (let i = 0; i < sentences.length; i++) {
    const S = sentences[i].text
    if (!S.includes(FACTS.place.study)) continue
    const sameSentence = S.includes(FACTS.place.floor)
    const local = sameSentence ? S : S + (sentences[i + 1] ? sentences[i + 1].text : '')
    if (!local.includes(FACTS.place.floor)) continue
    if (NEG_PLACE.test(local)) continue // "不在一楼/并非一楼"不是"在一楼"
    // 邻句兜底时：本句若已写了别的楼层（如"二楼"），不得再到邻句借"一楼"
    if (!sameSentence && /[二三四五六七八九十]楼/.test(S)) continue
    placeUnit = local
    break
  }
  add(
    '事实-自习区在一楼',
    Boolean(placeUnit),
    `自习区上下文=「${clip(placeUnit || '(未判定)', 60)}」` +
      `；相关句=${JSON.stringify(sentences.filter((S) => /自习|一楼/.test(S.text)).map((S) => clip(S.text, 40)))}`,
  )

  // 电话：先按原文找，再按去非数字找（允许 010 5555 6666 之类的间隔写法）
  const digits = t.replace(/\D/g, '')
  add(
    `事实-咨询电话 ${FACTS.phoneRaw}`,
    t.includes(FACTS.phoneRaw) || digits.includes(FACTS.phone),
    `原文命中=${t.includes(FACTS.phoneRaw)}；数字串命中=${digits.includes(FACTS.phone)}`,
  )

  if (limit180) {
    const n = article ? article.bodyChars : -1
    add(
      `字数-正文可见文字去空白 ≤ ${limit180} 字`,
      n >= 0 && n <= limit180,
      `实际 ${n} 字；计数字符串=「${clip(article ? article.counted : '', 400)}」`,
    )
  }

  add(
    '事实-全文同时含开放与闭馆（不是只写了其中一种）',
    full.includes('闭馆') && extractTimes(full).length > 0,
    `闭馆=${full.includes('闭馆')}；全文时刻=${JSON.stringify(extractTimes(full).map((x) => x.raw))}`,
  )
  return out
}

/** 一份**合法**的参考正文（供离线回归做正例；事实与 `live-acceptance.mjs` 的 L1 题面同一套） */
export const SAMPLE_OK_BODY =
  '2026年10月10日（周六）9:00–17:00 开放；2026年10月11日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。'
