// photo-swallow-check.mjs —— 「照片位吞并后续块」回归校验（2026-09-29 质量恢复计划 阶段 3.2）
//
// 用法：
//   node scripts/photo-swallow-check.mjs [--label <名字>]        # 对着**当前工作区**的 compose.ts 跑，要求全绿
//   node scripts/photo-swallow-check.mjs --prove-red [--at <ref>] # 对着 <ref>（默认 HEAD）**修复前**的 compose.ts 跑，要求至少红一条
//
// 故障（真实产物，文档 s1790565874610554000，2026-09-29）：
//   `::: photo 说明` 是**单行指令**，正文从下一行开始。旧解析器却一路向后扫到第一个
//   trim === ':::' 的行为止——而那个 `:::` 很可能是**后面某个 `::: art` 素材块的结束符**。
//   于是照片位把紧随其后的段落、`::: art` 头部与整段 SVG 全部吞进自己的"说明"，
//   再由 escapeHtml 转义成**可见文字**输出。真实成品 article.html 的实测值：
//     <img> 6 个、有效 art 0 个、`&lt;svg` 3 处、可见的 `::: art` 3 处、照片位 3 个。
//   （成品 678KB 不入库；3 段泄漏原文保存在 fixtures/2026-09-29-photo-swallow/failing-doc.json。）
//
// 本脚本只做**离线回归**：加载 scripts/fixtures/2026-09-29-photo-swallow/ 的只读样例，
// 用生产模块 composeMarkdown 解析并断言。不联网、不起桌面应用、不写真实工作区
// （%USERPROFILE%\Documents\wechat-mp-workspace）；`--prove-red` 只把 <ref> 版本的
// 三个源文件读进系统临时目录，跑完即删。
//
// 为什么默认要求全绿：修复已在工作区落地（`collectBlockBody` / `scanLegacyPhotoBody`），
// 默认跑法用于**防止回退**；`--prove-red` 用于证明这套断言的**确能抓到那条故障**——
// 如果更换解析器后它仍然全绿，说明样例根本没复现故障，脚本会以非 0 退出。
// 任何为了让脚本变绿而放宽断言的改动，都是在删证据。
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult → run-result.json + 退出码。
// 本脚本的"通过"方向有两种，**显式分开**，不再靠一个 `failed === 0` 同时表达：
//   默认模式：PASS 要求 ①…⑥ 都在 + 零条红；零条检查是 ERROR。
//   --prove-red：PASS 要求至少一条红（否则样例没复现故障，判定为 FAIL）。
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { createJudge, guardCrashes } from './lib/run-result.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const fixtureDir = join(here, 'fixtures', '2026-09-29-photo-swallow')

// ---------- 断言脚手架（沿用仓库 .mjs 范式） ----------
let failed = 0
const LOG = []
const check = (name, ok, extra = '') => {
  const line = `  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`
  console.log(line)
  LOG.push(line)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

/** 被测实现的版本指纹：工作区 compose.ts 的内容哈希（git 对象哈希，与提交无关）。
 *  主 agent 与子 agent 并行改同一份 compose.ts 时，证据必须钉在某个具体版本上——
 *  同一份样例在两次运行间"突然变红"就是文件被改写的信号，不能当成回归。 */
function implFingerprint() {
  try {
    return execFileSync('git', ['hash-object', 'src/lib/compose.ts'], { cwd: repoRoot }).toString('utf8').trim()
  } catch {
    return '(unknown)'
  }
}

// ---------- 可见文本口径 ----------
// 与 src/lib/compose.ts 的 visibleTextOf() 同口径：剥标签 + 反转义 + 折空白，
// 但**先跳过行内代码 span**——合法代码示例里出现 `::: art` 或 `<svg` 属于正常内容，
// 不能被全局字符串规则误杀（那里的误杀会逼人放宽断言，等于删闸门）。
const INLINE_CODE_SPAN = /<span style="background-color:[^"]*font-family:Consolas,Menlo,monospace[^"]*">[\s\S]*?<\/span>/g
function visibleTextOf(html) {
  return String(html || '')
    .replace(INLINE_CODE_SPAN, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const LEAK_PATTERNS = [
  { key: '转义的 <svg 源码', re: /<svg\b/i },
  { key: '内部素材容器标记 ::: art', re: /:::\s*art\b/ },
  { key: '未解析素材协议 [[asset:/[[img:/[[deco:', re: /\[\[(?:asset|img|deco)\s*:/ },
]
const countLeaks = (text) => {
  const s = visibleTextOf(text)
  return LEAK_PATTERNS.map((p) => ({ key: p.key, n: (s.match(new RegExp(p.re.source, 'gi')) || []).length }))
}
const leakTotal = (text) => countLeaks(text).reduce((n, x) => n + x.n, 0)
const leakBreakdown = (text) => countLeaks(text).map((x) => `${x.key}×${x.n}`).join('，') || '无'

const photoCount = (html) => (String(html).match(/【照片位】/g) || []).length
/** 各照片位的**说明文字**（只取 photosection 内的文本，不含后面正文）——判定"吞没"必须查这里 */
const photoNotes = (html) => [...String(html).matchAll(/【照片位】([\s\S]*?)<\/section>/g)].map((m) => visibleTextOf(m[1]))
// 被质检拦下的素材会留下**可见且带原因的占位**（compose.ts: `（此处原为美术素材「…」，未达标已略过）`），
// 与被静默吞掉不是一回事：前者作者看得见，后者看不见。用它判定"落位或明确阻断"。
const blockedArtCount = (html) => (String(html).match(/此处原为美术素材/g) || []).length

// ---------- 载入 fixture ----------
// 用例用 `<!-- CASE: <name> -->…` 标记分隔（标记内可带说明文字）；标记之前的内容不参与解析。
function loadCases(text) {
  const out = {}
  const re = /<!--\s*CASE:\s*([a-z0-9_-]+)\b[\s\S]*?-->/g
  const marks = []
  let m
  while ((m = re.exec(text))) marks.push({ name: m[1], start: m.index, end: re.lastIndex })
  for (let k = 0; k < marks.length; k++) {
    const stop = k + 1 < marks.length ? marks[k + 1].start : text.length
    out[marks[k].name] = text.slice(marks[k].end, stop).trim()
  }
  return out
}

const CASES = loadCases(readFileSync(join(fixtureDir, 'failing-source.md'), 'utf8'))
const srcOf = (name) => {
  const s = CASES[name]
  if (!s) throw new Error(`fixture 缺少用例 CASE: ${name}（scripts/fixtures/2026-09-29-photo-swallow/failing-source.md）`)
  return s
}
const doc = JSON.parse(readFileSync(join(fixtureDir, 'failing-doc.json'), 'utf8'))
const baseline = { leaks: leakTotal(doc.html), breakdown: leakBreakdown(doc.html), photos: photoCount(doc.html) }

const TINY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none">
<circle cx="150" cy="100" r="46" fill="#8fb8a4"/>
<circle cx="120" cy="86" r="18" fill="#e8b48a"/>
<circle cx="182" cy="112" r="14" fill="#d9a35f"/>
<path d="M60 170 q90 -40 180 0" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M70 40 q30 -22 60 0 q-30 22 -60 0z" fill="#c96f4a" opacity="0.6"/>
<rect x="236" y="36" width="30" height="30" rx="6" fill="#f2c76e"/>
</svg>`

// ---------- 五个用例的断言（对所有实现一视同仁：不因被测版本而调整口径） ----------
function runAllCases(composeFn) {
  const run = (md) => composeFn(md, { mode: 'auto' })
  const out = {}

  // ① 最小片段：单行照片位之后的段落与 art 块不被吞并（源文范围不跨块）
  {
    const r = run(srcOf('minimal'))
    const vis = visibleTextOf(r.html)
    const notes = photoNotes(r.html)
    const PARA = '没有讲稿，没有长篇大论，这场慰问被聊成了家常。'
    out.minimal = r
    check('① 最小片段：段落仍在正文里', vis.includes(PARA), `该段落${vis.includes(PARA) ? '可见' : '**被吞/丢失**'}`)
    check(
      '① 最小片段：照片位的**说明**里没有紧随其后的段落',
      notes.length === 1 && !notes.some((n) => n.includes('没有讲稿')),
      `照片位说明 = ${JSON.stringify(notes)}`,
    )
    check('① 最小片段：照片位只有 1 处', photoCount(r.html) === 1, `照片位 ${photoCount(r.html)} 处`)
    check('① 最小片段：源文范围不跨块——art 块被解析成素材', r.arts.length === 1, `arts=${r.arts.length}（期望 1）`)
    check('① 最小片段：可见文本无内部协议泄漏', leakTotal(r.html) === 0, leakBreakdown(r.html))
  }

  // ② 真实裁剪版：可见文本里 <svg / ::: art / [[asset: 出现 0 次
  {
    const src = srcOf('real')
    const r = run(src)
    const vis = visibleTextOf(r.html)
    const leaks = countLeaks(r.html)
    const srcArtHeaders = (src.match(/^:::\s*art\b/gm) || []).length
    const landed = r.arts.length
    const blocked = blockedArtCount(r.html)
    out.real = r
    out.realMeta = { srcArtHeaders, landed, blocked, leaks, photos: photoCount(r.html), vis }
    check('② 真实裁剪版：可见文本无转义 <svg', leaks[0].n === 0, `实测 ${leaks[0].n} 处（真实成品基线 ${baseline.breakdown}）`)
    check('② 真实裁剪版：可见文本无 ::: art', leaks[1].n === 0, `实测 ${leaks[1].n} 处`)
    check(
      '② 真实裁剪版：可见文本无 [[asset:/[[img:/[[deco:',
      leaks[2].n === 0,
      `实测 ${leaks[2].n} 处——本例已固化素材，源文里没有未解析协议行，此项是**空转的守门员**；真正会命中它的是素材固化失败留下的原文（见 scripts/fixtures/2026-09-28-basement 的 3 条 source=failed）`,
    )
    check('② 真实裁剪版：3 个照片位全部保留', photoCount(r.html) === 3, `照片位 ${photoCount(r.html)} 处（期望 3）`)
    const follows = ['没有讲稿，没有长篇大论', '有同学拆开包装咬了一口', '快门按下的瞬间']
    check(
      '② 真实裁剪版：3 处照片位的后续段落都在正文里，且不在照片位说明里',
      follows.every((t) => vis.includes(t)) && !photoNotes(r.html).some((n) => follows.some((t) => n.includes(t))),
      `正文命中 ${follows.filter((t) => vis.includes(t)).length}/3`,
    )
    check(
      '② 真实裁剪版：素材位不静默消失（落位或明确阻断）',
      landed + blocked === srcArtHeaders,
      `源文 ::: art 块 ${srcArtHeaders} 个 = 落位 ${landed} + 明确阻断 ${blocked}`,
    )
    check('② 真实裁剪版：ComposeResult 暴露 issues / rejectedArts', Array.isArray(r.issues) && Array.isArray(r.rejectedArts), `issues=${Array.isArray(r.issues)} rejectedArts=${Array.isArray(r.rejectedArts)}`)
  }

  // ③ `:::` 块体不跨越下一个块起点（容器同理，不能只修照片位）
  {
    const src = `::: card 慰问速览
- **时间**：9月6日下午
- **地点**：教学楼

::: art wide as-1788896586303529900
${TINY_SVG}
:::

这一段必须留在容器之外。`
    const r = run(src)
    const vis = visibleTextOf(r.html)
    out.container = r
    check('③ 容器块体不跨越下一个块起点：art 块未被并进 card', r.arts.length === 1 && blockedArtCount(r.html) === 0, `arts=${r.arts.length} 阻断 ${blockedArtCount(r.html)}`)
    check('③ 容器块体不跨越下一个块起点：容器外段落仍在正文', vis.includes('这一段必须留在容器之外'), '')
    check('③ 容器块体不跨越下一个块起点：可见文本无协议泄漏', leakTotal(r.html) === 0, leakBreakdown(r.html))
  }

  // ④ 显式闭合的历史多行照片块仍被兼容（不能为了修故障把合法旧块判死）
  {
    const src = `::: photo 现场照片①｜慰问讲话：宋阳老师与同学们在教学楼里交流
补充说明：拍摄时请留意横幅完整入镜
:::

这一段在多行照片块之后。`
    const r = run(src)
    const vis = visibleTextOf(r.html)
    out.legacy = r
    check('④ 多行照片块仍被识别为 1 个照片位', photoCount(r.html) === 1, `照片位 ${photoCount(r.html)} 处`)
    check('④ 多行照片块的补充说明进入照片位说明', photoNotes(r.html).some((n) => n.includes('补充说明：拍摄时请留意横幅完整入镜')), `说明 = ${JSON.stringify(photoNotes(r.html))}`)
    check('④ 多行照片块之后的正文未被吞', vis.includes('这一段在多行照片块之后'), '')
    check('④ 多行照片块不产生协议泄漏', leakTotal(r.html) === 0, leakBreakdown(r.html))
  }

  // ⑤ 歧义输入按单行处理：单行照片位 + 空行 + 段落 + 后面某块的 :::
  {
    const src = `::: photo 现场照片③｜大合影

快门按下的瞬间，定格的不只是笑脸。

::: steps
- 站军姿：初始化
- 齐步走：每次迭代
:::`
    const r = run(src)
    const vis = visibleTextOf(r.html)
    out.ambiguous = r
    check('⑤ 歧义输入按单行处理：照片位只有 1 处', photoCount(r.html) === 1, `照片位 ${photoCount(r.html)} 处`)
    check('⑤ 歧义输入按单行处理：后面段落留在正文', vis.includes('快门按下的瞬间，定格的不只是笑脸。'), '')
    // 判据是"steps 真的被当成组件渲染了"——**别拿具体形状当代理**：R18 起序号徽章的形状
    // 跟随圆角轴（直角语言给方泡、圆润语言才给圆泡），`border-radius:50%` 不再恒真。
    check('⑤ 歧义输入按单行处理：后续 steps 块仍被解析为组件且未被吸进照片位',
      r.html.includes('width:24px;height:24px') && r.html.includes('站军姿') && !photoNotes(r.html).some((n) => n.includes('站军姿')),
      `照片位说明 = ${JSON.stringify(photoNotes(r.html))}`)
    check('⑤ 歧义输入按单行处理：可见文本无协议泄漏', leakTotal(r.html) === 0, leakBreakdown(r.html))
  }

  return out
}

// ---------- ⑥ 真实最新稿的**隔离副本**（计划 §10 第一行） ----------
// `real-full-source.md` 是从真实工作区**只读复制**来的那一版源文（正文即当时的 ```v2 内容）。
// 这一条不复用裁剪样例，直接打在真实输入上：3 个照片位各自的后续段落必须保留、
// 照片位说明里不得出现后续正文、成品可见文本不得有转义 SVG 或内部 `::: art`。
//
// 关于 `[[asset:…]]`：本用例把**未做素材解析**的源文直接交给 compose。真实链路里这些引用会先被
// `materializePlaceholders` 消费掉，所以这里断言的不是"落位"，而是**兜底口径**：
// 没人消费的协议行必须被**明确阻断**（blocking 的 parse.leak），绝不能原样排进正文。
// 这正是本轮修复要保住的性质——"没有静默的漏网"。
function runRealFullCase(composeFn) {
  const raw = readFileSync(join(fixtureDir, 'real-full-source.md'), 'utf8')
  const m = /```v2\r?\n([\s\S]*?)\r?\n```/.exec(raw)
  if (!m) {
    check('⑥ 真实最新稿：fixture 里有 ```v2 正文', false, 'real-full-source.md 解析不到 v2 围栏')
    return null
  }
  const v2 = m[1]
  const r = composeFn(v2, { mode: 'text' })
  const vis = visibleTextOf(r.html)
  const notes = photoNotes(r.html)
  const srcLines = v2.split(/\r?\n/)

  // 每个照片位后面紧跟的那句正文（真实源文里的原句）
  const AFTER = [
    '没有讲稿，没有长篇大论，这场慰问被聊成了家常',
    '有同学拆开包装咬了一口，给出了相当精确的评价',
    '快门按下的瞬间，定格的不只是笑脸',
  ]
  const blockers = (r.issues || []).filter((i) => i.severity === 'blocking')
  const leakBlocks = blockers.filter((i) => i.code === 'parse.leak')
  // 源文里确实有素材协议行——否则"没有静默漏网"那条断言是空转的
  const srcProto = srcLines.filter((l) => /^\s*\[\[(?:asset|img|deco)\s*:/.test(l)).length
  // countLeaks 返回 [{key,n}]，与脚本其余用例同一口径（不是拼接好的字符串）
  const leaked = countLeaks(r.html)

  check('⑥ 真实最新稿：3 个照片位都渲染出来', photoCount(r.html) === 3, `照片位 ${photoCount(r.html)} 处`)
  for (const [k, phrase] of AFTER.entries()) {
    check(`⑥ 真实最新稿：照片位 ${k + 1} 之后的段落仍在正文`, vis.includes(phrase), phrase.slice(0, 18))
    check(`⑥ 真实最新稿：照片位 ${k + 1} 的说明里没有后续正文`, !notes.some((n) => n.includes(phrase)), '')
  }
  check('⑥ 真实最新稿：可见文本无转义 SVG', leaked[0].n === 0, `&lt;svg ×${leaked[0].n}`)
  check('⑥ 真实最新稿：可见文本无内部 ::: art 文本', leaked[1].n === 0, `::: art ×${leaked[1].n}`)
  // 关于 `[[asset:…]]`：本用例把**未做素材解析**的源文直接交给 compose，而 compose 不认识这套协议，
  // 因此它会把这些行当普通段落排出来——**这是合成输入的产物，不是用户会看到的成品**：
  // App 的 `resolvePreview` 在 `hasPlaceholders(v2)` 时直接返回 null（不渲染），真实链路必然先过
  // materializePlaceholders。所以这里能断言、也必须断言的是**"没有静默漏网"**：
  // 每一行未解析协议都要有一条 blocking 的 parse.leak，而不是无声无息地排进正文。
  check(
    '⑥ 真实最新稿：每一行未解析协议都有 blocking 的 parse.leak（没有静默漏网）',
    leakBlocks.length >= srcProto,
    `源文协议行 ${srcProto} 条 → parse.leak 阻断 ${leakBlocks.length} 条`,
  )

  return { r, v2, notes, leaked, blockerCount: blockers.length, srcProto }
}

// ---------- 修复前的实现（--prove-red）：从 git 取 <ref> 版的 compose.ts 及其相对依赖到系统临时目录 ----------
// 依赖清单从 ref 版源码里的 `from './x.ts'` 递归解析——不硬编码文件名，
// 否则某个文件在 ref 里尚不存在（或在 ref 之后才拆出来）就会取错版本。
function loadComposeAtRef(ref) {
  const tmp = mkdtempSync(join(tmpdir(), 'wxmp-photo-swallow-'))
  tempDir = tmp // 立刻登记，保证中途抛错也能在 finally 里清掉
  const shown = new Set()
  const showAtRef = (rel) => {
    try {
      return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: repoRoot, maxBuffer: 1 << 28 }).toString('utf8')
    } catch {
      return null
    }
  }
  const walk = (rel) => {
    if (shown.has(rel)) return
    const text = showAtRef(rel)
    if (text === null) throw new Error(`git ${ref} 里没有 ${rel}——无法取到该版本的解析实现（先确认真实故障发生时的那次提交）`)
    shown.add(rel)
    const dest = join(tmp, rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, text)
    for (const m of text.matchAll(/from\s+'(\.[^']+\.ts)'/g)) {
      walk(join(dirname(rel), m[1]).replace(/\\/g, '/'))
    }
  }
  walk('src/lib/compose.ts')
  return { dir: tmp, entry: join(tmp, 'src/lib/compose.ts'), files: [...shown] }
}

// ---------- 主流程 ----------
const argv = process.argv.slice(2)
const argOf = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const proveRed = argv.includes('--prove-red')
const ref = argOf('--at', 'HEAD')
const label = (() => {
  const explicit = argOf('--label', null)
  if (explicit) return String(explicit).replace(/[^A-Za-z0-9._-]/g, '-')
  const t = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `run-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`
})()
// 证据目录：默认仍写历史位置（docs 里引用了它）；需要换目录（例如本轮验证要写全新临时目录）用 --out 覆盖。
// 2026-10-09：默认落点收进项目内 `.local/`（见 docs/DEVELOPMENT.md「生成物放哪」）
const outRoot = argOf('--out', join(repoRoot, '.local', 'runs', 'photo-swallow-check'))
const outDirFor = (name) => join(outRoot, name)

const judge = createJudge({
  script: 'photo-swallow-check',
  outDir: outDirFor(label),
  plannedCases: proveRed ? [] : ['①', '②', '③', '④', '⑤', '⑥'],
})
guardCrashes(judge)

let tempDir = null
let composeFn = null
try {
  if (proveRed) {
    const at = loadComposeAtRef(ref)
    tempDir = at.dir
    composeFn = (await import(pathToFileURL(at.entry).href)).composeMarkdown
  } else {
    composeFn = (await import('../src/lib/compose.ts')).composeMarkdown
  }

  console.log('照片位吞并回归 —— 2026-09-29（文档 ' + (doc.id || '?') + '）')
  console.log(`  被测实现：${proveRed ? `修复前（git ${ref}:src/lib/compose.ts）` : '当前工作区 src/lib/compose.ts'}`)
  console.log(`  版本指纹：${implFingerprint()}（工作区 src/lib/compose.ts 的内容哈希）`)
  console.log(`  真实成品基线：泄漏 ${baseline.leaks} 处（${baseline.breakdown}），照片位 ${baseline.photos} 个`)

  if (proveRed) {
    console.log('  模式：--prove-red —— **要求至少红一条**（证明这些断言确实能抓到这条故障；全绿 = 样例没复现故障）')
    runAllCases(composeFn)
    const dir = outDirFor(label)
    mkdirSync(dir, { recursive: true })
    const redReport =
      `# 先证红：同一套断言打在修复前的解析器上

命令：\`node scripts/photo-swallow-check.mjs --prove-red --at ${ref} --label ${label}\`
被测实现：\`git ${ref}:src/lib/compose.ts\`（及其相对依赖，取到系统临时目录跑，跑完即删；**未改动任何源文件**）
样例：\`scripts/fixtures/2026-09-29-photo-swallow/\`（只读）

结论：**${failed === 0 ? '全绿——样例没有复现故障，这套断言无效' : `实测 ${failed} 条红，样例确实复现了该故障`}**

\`\`\`
${LOG.join('\n')}
\`\`\`
`
    writeFileSync(join(dir, 'red-proof.md'), redReport, 'utf8')
    // --prove-red 的"通过"方向与默认模式**相反**：要求至少一条红（且必须真的跑过检查）。
    // 这里显式给状态，不靠 `failed === 0` 推导（零条检查 = ERROR，不是"通过"）。
    const redStatus = judge.run.checks.length === 0 ? 'ERROR' : failed > 0 ? 'PASS' : 'FAIL'
    console.log('')
    if (redStatus === 'PASS') {
      console.log(`PHOTO-SWALLOW RED-PROOF OK —— 修复前实测有 ${failed} 条红，样例确实复现了故障`)
      console.log(`  取证留档：${dir}/red-proof.md`)
    } else if (redStatus === 'ERROR') {
      console.log('PHOTO-SWALLOW RED-PROOF ERROR —— 一条断言都没跑到，无法证明样例复现了故障')
    } else {
      console.log('PHOTO-SWALLOW RED-PROOF FAILED —— 修复前的实现竟然全绿：样例没有复现故障，先修样例')
    }
    judge.finish({ label: 'PHOTO-SWALLOW RED-PROOF', statusOverride: redStatus, extraFiles: { 'red-proof.md': redReport } })
  } else {
    console.log('  模式：默认 —— **要求全绿**（防止修复回退）')
    const res = runAllCases(composeFn)
    // ⑥ 真实最新稿的隔离副本（计划 §10 第一行）：真实输入，不是裁剪样例
    const realFull = runRealFullCase(composeFn)

    // 产出：把本次真实输入与产出留档（一个 label 一个子目录，不覆盖历史证据）
    const outDir = outDirFor(label)
    mkdirSync(outDir, { recursive: true })
    const minimalRun = res.minimal
    const realRun = res.real
    writeFileSync(join(outDir, 'fixture-minimal.md'), srcOf('minimal'), 'utf8')
    writeFileSync(join(outDir, 'fixture-real-trimmed.md'), srcOf('real'), 'utf8')
    writeFileSync(join(outDir, 'output-minimal.html'), minimalRun.html, 'utf8')
    writeFileSync(join(outDir, 'output-real-trimmed.html'), realRun.html, 'utf8')
    writeFileSync(join(outDir, 'output-real-trimmed.visible-text.txt'), visibleTextOf(realRun.html).replace(/。</g, '。\n'), 'utf8')
    const base = countLeaks(doc.html)
    const now = res.realMeta.leaks
    writeFileSync(
      join(outDir, 'result.md'),
      `# 照片位吞并回归 —— 本次运行结果（${label}）

脚本：\`node scripts/photo-swallow-check.mjs --label ${label}\`
样例：\`scripts/fixtures/2026-09-29-photo-swallow/\`（只读，未写真实工作区、未联网）

**结果：${judge.statusOf()}**（检查 ${judge.run.checks.filter((c) => c.pass).length}/${judge.run.checks.length} 通过，${failed} 条红）（被测实现：当前工作区 \`src/lib/compose.ts\`，指纹 \`${implFingerprint()}\`）

## 真实裁剪版的实测计数

| 指标 | 真实成品 article.html（基线） | 本次（同一故障的裁剪样例） |
| --- | --- | --- |
| 可见文本泄漏总处数 | ${baseline.leaks} | ${leakTotal(realRun.html)} |
| 其中转义 \`<svg\` | ${base[0].n} | ${now[0].n} |
| 其中可见 \`::: art\` | ${base[1].n} | ${now[1].n} |
| 其中未解析 \`[[asset:\` | ${base[2].n} | ${now[2].n} |
| 照片位数量 | ${baseline.photos} | ${res.realMeta.photos} |
| 有效素材位（落位） | 0 | ${res.realMeta.landed} |
| 明确阻断的美术素材（带原因占位） | 0（当时只有一句"已用占位文本替换"，无逐块原因） | ${res.realMeta.blocked} |

\`output-real-trimmed.html\` 是本夹具的**当前**产出，可直接用浏览器打开核对观感；
\`output-real-trimmed.visible-text.txt\` 是同一份产出的可见文本（逐句换行），泄漏检查查的就是它。

## 逐条断言的真实输出（本次运行，未经修饰）

\`\`\`
${LOG.join('\n')}
\`\`\`
`,
      'utf8',
    )
    console.log('')
    judge.finish({ label: 'PHOTO-SWALLOW' })
  }
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
}
