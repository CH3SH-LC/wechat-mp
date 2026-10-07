// E 路 阶段一：独立复现 D 的缺陷 —— G2B 被套用了不适用的 180 字上限，判成 FAIL。
//
// 判据（自定）：
//   R1  G2B 的**题面**里没有任何字数要求（不出现"不超过/不少于/N 字"这类约束）；
//   R2  题面无字数要求时，字数上限判据**不适用**，不得产生"≤ 180 字"这类检查；
//   R3  归档原件必须**原样保留**（哈希不变），重判只能产出**新的**判定记录，不能改旧文件；
//   R4  旧运行里那条 FAIL 是**驱动口径错**造成的假红，不是产品缺陷（正文其余断言与素材身份均成立）。
//
// 做法：题面逐字取自 **git HEAD df97022 的 scripts/live-acceptance.mjs**（冻结基线）；
//       "正文可见文字去空白"按 runner 已公布的口径自己重算（排除标题节点与 svg/img/script/style），
//       再与归档 run-result 里记录的 993 字对照。全程只读原件。
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
const sha256 = (b) => createHash('sha256').update(b).digest('hex')

const ART = join(process.env.TEMP, 'wxmp-f1-real-g1', 'evidence', 'G2B-2026-10-03T04-44-15-17a443c1')
const rec = { script: 'repro-d-g2b-wordlimit', startedAt: new Date().toISOString(), artifactDir: ART, checks: [] }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'MISS'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

// ---- 1. 题面（逐字取冻结基线）
const baselineRunner = execFileSync('git', ['show', 'df97022:scripts/live-acceptance.mjs'], { cwd: repoRoot, maxBuffer: 1 << 26 }).toString('utf8')
rec.baselineRunnerSha256 = sha256(Buffer.from(baselineRunner, 'utf8'))
const m = baselineRunner.match(/\n\s*G2B:\s*'([^']*)',/)
const g2bPrompt = m ? m[1] : null
console.log('  G2B 题面（冻结基线逐字）：', JSON.stringify(g2bPrompt))
ok('R1 G2B 题面不含任何字数要求', g2bPrompt !== null && !/(不超过|不少于|至多|至少|\d+\s*[–-]\s*\d+\s*字|\d+\s*字)/.test(g2bPrompt), g2bPrompt || '(未取到)')

// ---- 2. 冻结基线里 G2B 实际传的字数口径
const passesNull = /phase === 'G2B'\)[^\n]*wordLimit: null/.test(baselineRunner)
const guarded = /const wordLimit = opts\.wordLimit === undefined \? 180 : opts\.wordLimit/.test(baselineRunner)
rec.baselineG2BWordLimitArg = passesNull ? null : 'not-null'
ok('R2a 冻结基线 G2B 传 wordLimit:null', passesNull)
ok('R2b 冻结基线 runWritePhase 只在"没传"时才用 180', guarded)
ok('R2c 旧的 `|| 180` 形状会把显式 null 变成 180（原假红机制）', (null || 180) === 180, `null||180 = ${null || 180}`)

// ---- 3. 归档原件身份（只读）
const files = ['run-result.json', 'G2B-committed-source.md', 'G2B-committed-article.html', 'evidence.json']
rec.artifactHashesBefore = {}
for (const f of files) { const p = join(ART, f); rec.artifactHashesBefore[f] = existsSync(p) ? sha256(readFileSync(p)) : null }
const runResult = JSON.parse(readFileSync(join(ART, 'run-result.json'), 'utf8'))

// ---- 4. 独立重算"正文可见文字去空白"
function resolvePlaywright() {
  const tried = []
  for (const mm of ['playwright-core', 'playwright']) { try { return require(mm) } catch { tried.push(mm) } }
  const cand = [process.env.VERIFY_PLAYWRIGHT, process.env.TEMP && join(process.env.TEMP, 'pw-deps', 'node_modules', 'playwright-core')].filter(Boolean)
  for (const c of cand) { const t = isAbsolute(c) ? c : resolve(process.cwd(), c); try { return require(t) } catch { tried.push(t) } }
  throw new Error('解析不到 playwright；尝试过：' + tried.join(', '))
}
const pw = resolvePlaywright()
const chromiumPath = process.env.VERIFY_CHROMIUM || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')
const browser = await pw.chromium.launch({ executablePath: chromiumPath, headless: true })
const page = await browser.newPage()

const articleHtml = readFileSync(join(ART, 'G2B-committed-article.html'), 'utf8')
const measured = await page.evaluate(({ html, title }) => {
  document.documentElement.innerHTML = html
  const doc = document
  const headings = Array.prototype.slice.call(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'))
  let titleEl = null
  if (headings.length && (headings[0].textContent || '').trim().includes(title)) titleEl = headings[0]
  if (!titleEl) {
    for (const el of doc.querySelectorAll('*')) {
      if (el.children.length === 0 && (el.textContent || '').trim() === title) { titleEl = el; break }
    }
  }
  const skip = { SCRIPT: 1, STYLE: 1, SVG: 1, IMG: 1, DEFS: 1, NOSCRIPT: 1, TITLE: 1 }
  const parts = []
  const walk = (n) => {
    if (!n) return
    if (n.nodeType === 3) { parts.push(n.nodeValue || ''); return }
    if (n.nodeType !== 1) return
    if (titleEl && n === titleEl) return
    const tag = n.tagName ? n.tagName.toUpperCase() : ''
    if (skip[tag]) return
    if (n.getAttribute && (n.getAttribute('aria-hidden') === 'true' || n.getAttribute('hidden') !== null)) return
    const st = getComputedStyle(n)
    if (st && (st.display === 'none' || st.visibility === 'hidden')) return
    for (const c of n.childNodes) walk(c)
  }
  walk(doc.body)
  const text = parts.join(' ').replace(/[ \t\r\n\u00a0]+/g, ' ').trim()
  return {
    bodyChars: text.replace(/\s+/g, '').length,
    countedHead: text.replace(/\s+/g, '').slice(0, 400),
    titleNodeMatched: !!titleEl,
    firstHeadingText: headings.length ? (headings[0].textContent || '').trim() : '',
  }
}, { html: articleHtml, title: '图书馆开放时间调整通知' })
await browser.close()

// 归档 run-result 里记录的读数
const failCheck = (runResult.checks || []).find((c) => !c.pass && /字数-正文可见文字去空白/.test(c.id))
const recorded = failCheck ? Number((failCheck.evidence.join(' ').match(/实际\s*(\d+)\s*字/) || [])[1]) : null
rec.measured = measured
rec.recordedBodyChars = recorded
rec.originalFailCheck = failCheck ? failCheck.id : null
rec.originalStatus = runResult.status
rec.originalFailedChecks = (runResult.checks || []).filter((c) => !c.pass).map((c) => c.id)

ok('R4a 我独立重算的字数 = 归档记录的 993 字', measured.bodyChars === recorded, `重算=${measured.bodyChars}，归档=${recorded}`)
ok('R4b 原 FAIL 是该题面下唯一失败项', (runResult.checks || []).filter((c) => !c.pass).length === 1, `失败项=${rec.originalFailedChecks.join(' / ')}`)
ok('R4c 旧运行确实套用了 180（假红）', /≤ 180 字/.test(failCheck ? failCheck.id : ''), failCheck ? failCheck.id : '(无)')
rec.verdictUnder180 = measured.bodyChars <= 180 ? 'PASS' : 'FAIL'
ok('R1/R2 结论：该题面下 180 上限不适用，套用即假红', measured.bodyChars > 180 && !/(不超过|不少于|\d+\s*字)/.test(g2bPrompt || ''), `${measured.bodyChars} 字 vs 上限 180`)

// ---- 5. 原件未被改动
rec.artifactHashesAfter = {}
for (const f of files) { const p = join(ART, f); rec.artifactHashesAfter[f] = existsSync(p) ? sha256(readFileSync(p)) : null }
const unchanged = files.every((f) => rec.artifactHashesBefore[f] === rec.artifactHashesAfter[f])
ok('R3 归档原件哈希逐项未变（重判不修改旧判定）', unchanged, unchanged ? '全部一致' : '有文件被改动')

writeFileSync(join(outDir, 'repro-d.json'), JSON.stringify(rec, null, 2))
console.log('\n重算字数 =', measured.bodyChars, '| 归档记录 =', recorded, '| 题面字数要求 =', /(不超过|不少于|\d+\s*字)/.test(g2bPrompt || '') ? '有' : '无')
console.log('写出：', join(outDir, 'repro-d.json'))
