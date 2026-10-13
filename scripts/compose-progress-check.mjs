// R30：不完整结构不能让排版器原地循环；每个样例在有超时的子进程中执行。
// 可选 --prove-red：只在输出目录制作去掉保护的副本，证明旧行为会被超时检查抓到。
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'

const outDir = resolveOutDir('compose-progress-check')
const judge = createJudge({ script: 'compose-progress-check', outDir, minChecks: 55 })
guardCrashes(judge)
mkdirSync(outDir, { recursive: true })
const composeUrl = new URL('../src/lib/compose.ts', import.meta.url)
const qualityUrl = new URL('../src/lib/delivery-quality.ts', import.meta.url)
const issueCode = 'parse.unrecognized-structure'
const samples = [
  { name: '单行竖线文字', source: '| 普通文字', bad: '| 普通文字', line: 1 },
  { name: '表格缺少分隔行', source: '| 第一列 | 第二列 |\n后续内容', bad: '| 第一列 | 第二列 |', line: 1, after: '后续内容' },
  { name: '横幅未闭合', source: '前段\n\n[[banner:保留横幅\n后续内容', bad: '[[banner:保留横幅', line: 3, after: '后续内容' },
  { name: '标题未闭合', source: '[[title:保留标题\n后续内容', bad: '[[title:保留标题', line: 1, after: '后续内容' },
  { name: '花边近似指令', source: '[[lace-extra]]\n后续内容', bad: '[[lace-extra]]', line: 1, after: '后续内容' },
  { name: '照片近似指令', source: '::: photox\n后续内容', bad: '::: photox', line: 1, after: '后续内容' },
  { name: '回退保留并转义原文', source: '| <em>文字</em> & 内容\n后续内容', bad: '| <em>文字</em> & 内容', line: 1, after: '后续内容' },
  { name: '合法普通段落', source: '第一行\n第二行\n\n后一段', expected: ['第一行<br/>第二行', '后一段'], tag: '<p ' },
  { name: '合法表格', source: '| 第一列 | 第二列 |\n| --- | --- |\n| 甲 | 乙 |\n\n后续内容', expected: ['第一列', '第二列', '甲', '乙', '后续内容'], tag: '<table ' },
  { name: '合法标题横幅花边', source: '[[banner:横幅标题|副标题]]\n[[title:装饰标题]]\n[[lace]]\n\n完整正文', expected: ['横幅标题', '副标题', '装饰标题', '完整正文'], tag: '<section' },
  { name: '合法列表与容器', source: '- 列表第一项\n- 列表第二项\n\n::: card 卡片标题\n卡片正文\n:::\n\n末段', expected: ['列表第一项', '列表第二项', '卡片标题', '卡片正文', '末段'], tag: 'display:flex;align-items:flex-start' },
]

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function runSample(source, moduleUrl = composeUrl.href, timeout = 3000) {
  const code = `
    import { composeMarkdown, projectionOf } from ${JSON.stringify(moduleUrl)};
    import { collectDeliveryIssues, deliveryVerdict } from ${JSON.stringify(qualityUrl.href)};
    const source = ${JSON.stringify(source)};
    const started = performance.now();
    const result = composeMarkdown(source, {});
    const verdict = deliveryVerdict(collectDeliveryIssues({ source, html: result.html, plainText: result.plainText, composeIssues: result.issues }));
    console.log(JSON.stringify({ html: result.html, projection: projectionOf(result.authorUnits), issues: result.issues, warnings: result.warnings, verdict: { ok: verdict.ok, blockerCodes: verdict.blockers.map(x => x.code) }, ms: performance.now() - started }));
  `
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 1024 * 1024,
  })
  const record = { status: child.status, signal: child.signal, error: child.error?.code, stderr: child.stderr, result: null }
  if (child.status === 0) record.result = JSON.parse(child.stdout)
  return record
}

const evidence = []
for (const sample of samples) {
  const record = runSample(sample.source)
  evidence.push({ ...sample, ...record })
  const result = record.result
  judge.check(`${sample.name}：子进程及时正常返回`, record.status === 0 && !!result, JSON.stringify({ status: record.status, error: record.error, stderr: record.stderr }))
  if (!result) continue
  const fallback = result.issues.filter(issue => issue.code === issueCode)
  if (sample.bad) {
    judge.check(`${sample.name}：保留该行字面内容`, result.html.includes(escapeHtml(sample.bad)))
    judge.check(`${sample.name}：源行定位准确且只回退一次`, fallback.length === 1 && fallback[0].line === sample.line && fallback[0].endLine === sample.line)
    judge.check(`${sample.name}：结构化问题阻断成品`, fallback[0]?.severity === 'blocking' && !result.verdict.ok && result.verdict.blockerCodes.includes(issueCode))
    judge.check(`${sample.name}：用户可见解析说明`, result.warnings.some(warning => warning.includes('已保留原文')))
    judge.check(`${sample.name}：后续正文仍在作者投影`, !sample.after || result.projection.text.includes(sample.after))
  } else {
    judge.check(`${sample.name}：不触发回退`, fallback.length === 0)
    judge.check(`${sample.name}：保留正常结构`, result.html.includes(sample.tag))
    judge.check(`${sample.name}：内容完整`, sample.expected.every(text => result.html.includes(text)))
    judge.check(`${sample.name}：作者投影正常`, result.projection.status === 'ok')
  }
}

if (process.argv.includes('--prove-red')) {
  const current = readFileSync(fileURLToPath(composeUrl), 'utf8')
  const start = current.indexOf('    // 结构起点的前缀识别比上面的完整语法宽：')
  const end = current.indexOf('    // R21：宣传类普通段落', start)
  if (start < 0 || end <= start) throw new Error('无法精确定位前进保护，拒绝构造失真的变异副本')
  const mutated = (current.slice(0, start) + current.slice(end)).replace(/from '(\.\/[^']+)'/g, (_match, relative) => `from '${new URL(relative, composeUrl).href}'`)
  const mutantPath = join(outDir, 'compose-without-progress-guard.ts')
  writeFileSync(mutantPath, mutated, 'utf8')
  for (const sample of [samples[0], samples[3]]) {
    const record = runSample(sample.source, pathToFileURL(mutantPath).href, 1500)
    evidence.push({ name: `变异反证：${sample.name}`, ...record })
    judge.check(`变异反证：去掉保护后${sample.name}被超时抓住`, record.error === 'ETIMEDOUT' && record.status === null, JSON.stringify({ status: record.status, error: record.error, stderr: record.stderr }))
  }
}

writeFileSync(join(outDir, 'cases.json'), JSON.stringify(evidence, null, 2), 'utf8')
judge.finish({ label: 'COMPOSE-PROGRESS' })
