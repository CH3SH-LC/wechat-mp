#!/usr/bin/env node
// f1-artifact-rejudge.mjs —— F1 冻结原件「离线成品重判」（零模型 / 不启动应用 / 只读原件）
//
// 与 live-acceptance.mjs 的分工：
//   · live-acceptance：**执行**真实回合，边跑边判，结果写进 `<证据目录>/run-result.json`。
//   · 本脚本：**只重判**已经冻结在磁盘上的成品证据，不改原件、不重跑、不调用模型。
//     因此它产出的是一份**新的**重判记录，**不等于**原执行自动由 FAIL 变 PASS——
//     原 run-result.json 原样保留，新旧两份并列陈述（见 --out 输出里的 originalVerdict 与 items）。
//
// 冻结口径（来源 docs/artifacts/2026-10-03-f1-grounding/）：
//   · G2B 题面「只把标题改成…，正文和配图一个字都不要动」**没有字数要求**，
//     所以旧运行里那条 `字数-正文可见文字去空白 ≤ 180 字` 属**不适用**判据，重判时移除
//     （驱动侧已改为「传没传」：G2B 传 wordLimit=null，见 live-acceptance.mjs runWritePhase）。
//   · 证据不足的项一律记 UNKNOWN，**不用推断填满**。
//
// 用法：
//   node scripts/f1-artifact-rejudge.mjs --sample G2B --dir <G2B 证据目录> \
//        --baseline <G1 证据目录> [--workspace <隔离工作区>] [--out <json 路径>]
//   node scripts/f1-artifact-rejudge.mjs --sample G2A|G3 --dir <证据目录> \
//        [--workspace <隔离工作区>] [--out <json 路径>]
//
// 退出码：0 = 重判完成（不代表全 PASS）；2 = 用法/原件缺失等硬错误。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname, resolve } from 'node:path'

// ---------- 小工具 ----------

const args = process.argv.slice(2)
const opt = (name, dflt = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt
}

const SAMPLE = (opt('sample', 'G2B') || 'G2B').toUpperCase()
const DIR = opt('dir')
const BASELINE = opt('baseline')
const WORKSPACE = opt('workspace')
const OUT = opt('out')

if (!DIR) {
  console.error('用法：node scripts/f1-artifact-rejudge.mjs --sample G2B --dir <证据目录> [--baseline <G1目录>] [--workspace <隔离工作区>] [--out <json>]')
  process.exit(2)
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const exists = (p) => p && existsSync(p)
const sha256 = (p) => (exists(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null)
const bytes = (p) => (exists(p) ? readFileSync(p).length : -1)

/** 与 live-acceptance 同一口径：去空白 + 破折号统一 */
const norm = (s) => String(s ?? '').replace(/\s+/g, '').replace(/[–—−]/g, '-')

/** 去掉首个标题节点后的可见正文（与 runWritePhase 的 sansHeading 同义） */
function sansHeading(article) {
  if (!article) return null
  const t = norm(article.bodyText)
  const h = norm(article.firstHeadingText)
  return h && t.includes(h) ? t.replace(h, '') : t
}

const items = []
function item(id, criterion, status, evidence, sources = []) {
  items.push({ id, criterion, status, evidence, sources })
}

// ---------- 原件清点（身份 + 哈希） ----------

const files = {
  runResult: join(DIR, 'run-result.json'),
  evidence: join(DIR, 'evidence.json'),
  state: join(DIR, `${SAMPLE}-state.json`),
  before: join(DIR, `${SAMPLE}-before.json`),
  committedSource: join(DIR, `${SAMPLE}-committed-source.md`),
  committedHtml: join(DIR, `${SAMPLE}-committed-article.html`),
}
const originals = Object.entries(files)
  .filter(([, p]) => exists(p))
  .map(([k, p]) => ({ key: k, path: p, sha256: sha256(p), bytes: bytes(p) }))

const runResult = exists(files.runResult) ? readJson(files.runResult) : null
if (!runResult) {
  console.error(`硬错误：找不到原件 ${files.runResult}`)
  process.exit(2)
}

// 原判（**保留**）：原 run-result 的 status 与它的检查项，原样引用，不改写。
const originalInapplicable = (runResult.checks || [])
  .filter((c) => /≤\s*\d+\s*字/.test(c.id))
  .map((c) => ({ id: c.id, pass: c.pass, evidence: c.evidence || [] }))

// =====================================================================================
// G2B：成品重判（题面无数额要求，移除 180 字上限条件）
// =====================================================================================
if (SAMPLE === 'G2B') {
  const before = exists(files.before) ? readJson(files.before).before : null
  const state = exists(files.state) ? readJson(files.state) : null
  const after = state ? state.after : null

  if (!before || !after) {
    item('G2B.FATAL', '读取前后成品快照', 'UNKNOWN', `before=${!!before} after=${!!after}`, [files.before, files.state])
  }

  // 期望标题：从记录下来的真实用户题面里解析，避免脚本里再抄一份常量造成漂移。
  const promptText = state && state.turn && state.turn.prompt ? state.turn.prompt : ''
  const titleFromPrompt = (promptText.match(/标题改成[“"]([^”"]+)[”"]/) || [])[1] || null
  const expectTitle = titleFromPrompt || runResult.checks?.find((c) => /源文标题行/.test(c.id))?.evidence?.[0]?.replace(/.*=「|」.*/g, '') || null
  // slimState 丢弃了 `disk.source` / `srcTitle`，源文标题行只能从落盘的成品源文文件读（第一处标题行）。
  const srcTitle = exists(files.committedSource) ? firstSourceTitle(readFileSync(files.committedSource, 'utf8')) : ''

  // 1. 标题变化
  if (before && after) {
    const bT = norm(before.ui?.article?.firstHeadingText)
    const aT = norm(after.ui?.article?.firstHeadingText)
    const ok = !!expectTitle && aT.includes(norm(expectTitle)) && aT !== bT && norm(srcTitle).includes(norm(expectTitle))
    item('G2B.title_changed', `标题变化且等于题面要求（${expectTitle}）`, ok ? 'PASS' : 'FAIL',
      `预览标题节点「${before.ui?.article?.firstHeadingText}」→「${after.ui?.article?.firstHeadingText}」；源文标题行=「${srcTitle}」`,
      [files.before, files.state, files.committedSource])
  } else {
    item('G2B.title_changed', '标题变化且等于题面要求', 'UNKNOWN', '缺前后快照', [files.before, files.state])
  }

  // 2a. 正文原样（可见文字，逐字）
  if (before && after) {
    const bB = sansHeading(before.ui?.article)
    const aB = sansHeading(after.ui?.article)
    item('G2B.body_verbatim_visible', '正文逐字保持（去标题节点后可见文字完全一致）',
      bB !== null && aB === bB ? 'PASS' : 'FAIL',
      `去标题节点后：改前 ${bB ? bB.length : -1} 字 / 改后 ${aB ? aB.length : -1} 字；相等=${bB === aB}；bodyChars ${before.ui?.article?.bodyChars} → ${after.ui?.article?.bodyChars}`,
      [files.before, files.state])
  } else {
    item('G2B.body_verbatim_visible', '正文逐字保持', 'UNKNOWN', '缺前后快照', [files.before, files.state])
  }

  // 2b. 正文原样（字节级：与 G1 成品源文逐字节比对；只允许标题行不同）
  if (exists(files.committedSource) && BASELINE) {
    const g1src = join(BASELINE, 'G1-committed-source.md')
    if (exists(g1src)) {
      const a = readFileSync(g1src, 'utf8').split(/\r?\n/)
      const b = readFileSync(files.committedSource, 'utf8').split(/\r?\n/)
      const diffs = []
      const n = Math.max(a.length, b.length)
      for (let i = 0; i < n; i++) if ((a[i] ?? '') !== (b[i] ?? '')) diffs.push(i + 1)
      item('G2B.body_verbatim_bytes', '正文逐字节保持（与 G1 成品源文比，差异只允许出现在标题行第 1 行）',
        diffs.length === 1 && diffs[0] === 1 ? 'PASS' : 'FAIL',
        `G1 源文 vs G2B 源文：不同行号=[${diffs.join(',')}]；行数 ${a.length}=${b.length}`,
        [g1src, files.committedSource])
    } else {
      item('G2B.body_verbatim_bytes', '正文逐字节保持', 'UNKNOWN', `找不到基准源文 ${g1src}`, [files.committedSource])
    }
  } else {
    item('G2B.body_verbatim_bytes', '正文逐字节保持', 'UNKNOWN', '未给 --baseline（G1 目录），无法做字节级对照', [files.committedSource])
  }

  // 3. 素材身份 / 版本 / 哈希保持
  if (before?.view && after?.view) {
    const bv = before.view, av = after.view
    const sameId = JSON.stringify(bv.assetIdentity) === JSON.stringify(av.assetIdentity)
    const sameIdHash = bv.assetIdentityHash === av.assetIdentityHash
    const sameSnap = bv.snapshotsHash === av.snapshotsHash
    const sameSnapN = bv.snapshotCount === av.snapshotCount
    const sameBindN = bv.bindingCount === av.bindingCount
    const ok = sameId && sameIdHash && sameSnap && sameSnapN && sameBindN
    item('G2B.asset_identity_preserved', '素材身份/版本/哈希保持（同一槽位 id@版本:内容哈希、快照哈希、位数逐项一致）',
      ok ? 'PASS' : 'FAIL',
      `identity ${JSON.stringify(bv.assetIdentity)} → ${JSON.stringify(av.assetIdentity)}；` +
      `assetIdentityHash ${String(bv.assetIdentityHash).slice(0, 12)}→${String(av.assetIdentityHash).slice(0, 12)}；` +
      `snapshotsHash ${String(bv.snapshotsHash).slice(0, 12)}→${String(av.snapshotsHash).slice(0, 12)}；` +
      `snapshotCount ${bv.snapshotCount}→${av.snapshotCount}；bindingCount ${bv.bindingCount}→${av.bindingCount}；` +
      `（bindingsHash 引用写法 ${String(bv.bindingsHash).slice(0, 12)}→${String(av.bindingsHash).slice(0, 12)}，属 slotId/引用规范化，**不是**素材变化）`,
      [files.before, files.state])
    // 素材内容哈希的**独立**核验（需要隔离工作区）：文件 sha256 是否等于身份里的内容哈希
    if (WORKSPACE) {
      const id = (av.assetIdentity[0] || '').split('@')[0]
      const contentHash = (av.assetIdentity[0] || '').split(':')[1] || ''
      const svg = join(WORKSPACE, 'assets', 'items', id, 'source.svg')
      const got = sha256(svg)
      item('G2B.asset_content_hash', '素材内容哈希独立核验（source.svg 的 sha256 == 身份哈希）',
        got ? (got === contentHash ? 'PASS' : 'FAIL') : 'UNKNOWN',
        got ? `source.svg sha256=${got}；身份内容哈希=${contentHash}；相等=${got === contentHash}` : `缺文件 ${svg}`,
        [svg])
    } else {
      item('G2B.asset_content_hash', '素材内容哈希独立核验', 'UNKNOWN', '未给 --workspace，无法读素材文件', [])
    }
  } else {
    item('G2B.asset_identity_preserved', '素材身份/版本/哈希保持', 'UNKNOWN', '缺前后 view 快照', [files.before, files.state])
  }

  // 4. gen_svg=0 的 trace 证据
  const ev = exists(files.evidence) ? readJson(files.evidence) : null
  const turn = ev && ev.turns && ev.turns[0] ? ev.turns[0] : null
  if (turn) {
    const countsZero = turn.genSvgBefore === 0 && turn.genSvgAfter === 0 && turn.transportDrawAfter === 0
    let traceOk = null, tracePath = null, traceNote = ''
    if (WORKSPACE) {
      const runId = after?.view?.runId
      tracePath = runId ? join(WORKSPACE, 'traces', `${runId}.jsonl`) : null
      if (tracePath && exists(tracePath)) {
        const lines = readFileSync(tracePath, 'utf8').split(/\r?\n/).filter(Boolean)
        const objs = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
        const genSvgEntries = objs.filter((o) => String(o.phase || '') === 'gen_svg' || String(o.kind || '') === 'gen_svg')
        const slotNotes = objs.filter((o) => o.kind === 'slot').map((o) => o.note || '')
        const recoverNote = slotNotes.some((n) => /没有重新绘制|恢复同一素材/.test(n))
        traceOk = genSvgEntries.length === 0 && recoverNote
        traceNote = `trace=${tracePath}（sha256 ${String(sha256(tracePath)).slice(0, 12)}…）：gen_svg 条数=${genSvgEntries.length}；slot 备注含"没有重新绘制"=${recoverNote}`
      } else {
        traceNote = `找不到 trace 文件 ${tracePath}`
      }
    } else {
      traceNote = '未给 --workspace，未读 trace 文件（只用了 evidence.json 的计数）'
    }
    const ok = countsZero && traceOk !== false
    const status = traceOk === null ? (countsZero ? 'PASS' : 'FAIL') : (ok ? 'PASS' : 'FAIL')
    item('G2B.gen_svg_zero', 'gen_svg=0（只改文字，没有重新画图）的 trace 证据',
      status,
      `evidence.json：派发 ${turn.dispatchBefore}→${turn.dispatchAfter}、绘图 ${turn.genSvgBefore}→${turn.genSvgAfter}、传输绘图 ${turn.transportDrawBefore}→${turn.transportDrawAfter}；${traceNote}`,
      [files.evidence, ...(tracePath && exists(tracePath) ? [tracePath] : [])])
    if (traceOk === null && countsZero) {
      item('G2B.gen_svg_zero_trace_file', 'gen_svg=0 的**原始 trace 文件**核验', 'UNKNOWN', traceNote, [])
    }
  } else {
    item('G2B.gen_svg_zero', 'gen_svg=0 的 trace 证据', 'UNKNOWN', '缺 evidence.json/turns', [files.evidence])
  }

  // 5. 提交与哈希自洽
  if (before && after) {
    const accepted = after.ui?.docState === 'accepted' && after.disk?.ok && after.disk?.meta?.validation === 'verified'
    item('G2B.accepted_commit', '本轮 accepted 提交（doc-state=accepted 且 validation=verified）',
      accepted ? 'PASS' : 'FAIL',
      `doc-state=${after.ui?.docState}；validation=${after.disk?.ok ? after.disk?.meta?.validation : '(不可读)'}`, [files.state])
    const sameDoc = after.disk?.docId === before.disk?.docId && !!after.disk?.docId
    item('G2B.same_doc', '同一文档（docId 与改前一致）', sameDoc ? 'PASS' : 'FAIL',
      `docId ${before.disk?.docId} → ${after.disk?.docId}`, [files.before, files.state])
    const adv = after.disk?.revisionId !== before.disk?.revisionId && after.disk?.generation > before.disk?.generation
    item('G2B.revision_advanced', '本轮提交了新 revision（revisionId/generation 相对本回合开始前前进）',
      adv ? 'PASS' : 'FAIL',
      `revisionId ${before.disk?.revisionId} → ${after.disk?.revisionId}；generation ${before.disk?.generation} → ${after.disk?.generation}`,
      [files.before, files.state])
    item('G2B.generation_plus_one', 'generation 恰好 +1（没有多提交一版）',
      after.disk?.generation === before.disk?.generation + 1 ? 'PASS' : 'FAIL',
      `${before.disk?.generation} → ${after.disk?.generation}`, [files.before, files.state])
  } else {
    for (const id of ['accepted_commit', 'same_doc', 'revision_advanced', 'generation_plus_one']) {
      item(`G2B.${id}`, id, 'UNKNOWN', '缺前后快照', [files.before, files.state])
    }
  }

  // 6. 事实保持（离线从成品源文重算，不复用 runner 的断言结果）
  if (exists(files.committedSource)) {
    const src = norm(readFileSync(files.committedSource, 'utf8'))
    const facts = [
      ['开放日 10月10日 + 9:00/17:00', /10月10日/.test(src) && /9:00/.test(src) && /17:00/.test(src)],
      ['闭馆日 10月11日 + 全天闭馆', /10月11日/.test(src) && /闭馆/.test(src)],
      ['自习区在一楼', /自习区在一楼/.test(src)],
      ['咨询电话 010-55556666', /010-55556666/.test(src)],
    ]
    const bad = facts.filter(([, ok]) => !ok).map(([n]) => n)
    item('G2B.facts_preserved', '给定事实保持（离线从成品源文重算）', bad.length === 0 ? 'PASS' : 'FAIL',
      bad.length === 0 ? `四项齐全：${facts.map(([n]) => n).join('；')}` : `缺：${bad.join('；')}`,
      [files.committedSource])
  }

  // 7. 成品 HTML 无外链
  if (exists(files.committedHtml)) {
    const html = readFileSync(files.committedHtml, 'utf8')
    const ext = /src\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(html)
    item('G2B.html_offline', '成品 HTML 无外链资源（离线可渲染）', ext ? 'FAIL' : 'PASS',
      `html 长度=${html.length}；外链命中=${ext}`, [files.committedHtml])
  }

  // 8. 被移除的不适用判据（显式登记，不作为失败）
  item('G2B.word_limit_removed',
    '移除不适用判据：`正文可见文字去空白 ≤ 180 字`（本题面无字数要求，正文须原样保留）',
    'N/A',
    `原 run-result 命中 ${originalInapplicable.length} 条；` +
    originalInapplicable.map((c) => `「${c.id}」pass=${c.pass}（${(c.evidence || [])[0] || ''}）`).join('；'),
    [files.runResult])
}

// =====================================================================================
// G2A / G3：真实补测后的成品重判（首稿；语义面）
// =====================================================================================
if (SAMPLE === 'G2A' || SAMPLE === 'G3') {
  const state = exists(files.state) ? readJson(files.state) : null
  const after = state ? (state.after || state) : null
  const hasOutput = !!(after && after.disk && after.disk.ok && after.ui && after.ui.docState === 'accepted')
  item(`${SAMPLE}.has_output`, '是否产出并被接受的成品', hasOutput ? 'PASS' : 'FAIL',
    hasOutput ? `doc-state=${after.ui.docState}；revisionId=${after.disk.revisionId}` : '无 accepted 成品（本期无产出）',
    [files.state])
  // 语义判据（材料给的信息保留 / 未给规则不补写）由 runner 的 grounding 断言在真实回合里判；
  // 这里只在有产出时把它们从 run-result 原样引出，标注为“读回 runner 判定”，不做二次推断。
  const sem = (runResult.checks || []).filter((c) => /材料给的信息被保住|没有补写材料未给的规则/.test(c.id))
  for (const c of sem) {
    item(`${SAMPLE}.${c.id}`, c.id, hasOutput ? (c.pass ? 'PASS' : 'FAIL') : 'UNKNOWN', (c.evidence || []).join('；'), [files.runResult])
  }
  if (!hasOutput) {
    item(`${SAMPLE}.semantics`, '语义面（材料依据边界）', 'UNKNOWN',
      '本样本执行期未产出成品，语义无从判定', [files.state])
  }
}

// ---------- 汇总与输出 ----------

const summary = {
  PASS: items.filter((i) => i.status === 'PASS').length,
  FAIL: items.filter((i) => i.status === 'FAIL').length,
  UNKNOWN: items.filter((i) => i.status === 'UNKNOWN').length,
  'N/A': items.filter((i) => i.status === 'N/A').length,
}

const record = {
  script: 'f1-artifact-rejudge',
  sample: SAMPLE,
  generatedAt: new Date().toISOString(),
  note: '离线成品重判：只读原件，不改写、不重跑、不调用模型。原 run-result.json 原样保留，本记录是**新的**重判，不等于原执行自动变 PASS。',
  dir: resolve(DIR),
  baseline: BASELINE ? resolve(BASELINE) : null,
  workspace: WORKSPACE ? resolve(WORKSPACE) : null,
  originalVerdict: {
    preserved: true,
    status: runResult.status,
    path: files.runResult,
    sha256: sha256(files.runResult),
    inapplicableChecks: originalInapplicable,
  },
  originals,
  items,
  summary,
}

const text = JSON.stringify(record, null, 2)
if (OUT) {
  mkdirSync(dirname(resolve(OUT)), { recursive: true })
  writeFileSync(resolve(OUT), text, 'utf8')
  console.log(`已写出重判记录：${resolve(OUT)}`)
}
console.log(`${SAMPLE} 重判：PASS=${summary.PASS} FAIL=${summary.FAIL} UNKNOWN=${summary.UNKNOWN} N/A=${summary['N/A']}`)
for (const i of items) console.log(`  [${i.status}] ${i.id} — ${i.evidence}`)
if (!OUT) console.log(text)

// 局部小工具（放文件末尾，避免与上文的 import 混淆）
function firstSourceTitle(source) {
  for (const line of String(source || '').split(/\r?\n/)) {
    const m = line.trim().match(/^#{1,6}\s+(.*)$/)
    if (m) return m[1].trim()
  }
  return ''
}
