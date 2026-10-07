// E 路 最小重签：证明 src/lib/prep.ts 由 db238631… → 882e3edb… 的改动**只动注释**。
// 两种互相独立的方法：
//   A) tsc 编译器 API 的 transpileModule({removeComments:true}) → 去注释后的 JS 文本比较
//   B) 解析成 AST 后用 Printer({removeComments:true}) 重打印 → AST 层比较（注释不在 AST 中）
// 外加：逐行比对原始文本，把每一处差异行**分类**为注释行 / 非注释行。
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out'); mkdirSync(outDir, { recursive: true })
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const rel = 'src/lib/prep.ts'
const oldSrc = readFileSync(join(here, 'candidate', rel), 'utf8')   // 我 ACCEPT 过的旧候选快照
const newSrc = readFileSync(join(repoRoot, rel), 'utf8')

const rec = { script: 'phase2-a-recheck', file: rel, hashes: { old: sha256(Buffer.from(oldSrc, 'utf8')), new: sha256(Buffer.from(newSrc, 'utf8')) }, checks: [], diff: {} }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

ok('① 新候选哈希 == 父协调者给出的 882e3edb…', rec.hashes.new === '882e3edbaaa7b1b63a6988e2d368f050fbca1b46503c58417a69676e8f91d3db', rec.hashes.new)
ok('①b 旧候选快照哈希 == 我 ACCEPT 的 db238631…', rec.hashes.old === 'db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f', rec.hashes.old)

// ---- 方法 A：tsc transpileModule，去注释
const ts = require('typescript')
const stripA = (s) => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ESNext, removeComments: true } }).outputText
const a1 = stripA(oldSrc), a2 = stripA(newSrc)
ok('②方法A（transpileModule 去注释）新旧输出逐字节相同', a1 === a2, `len old=${a1.length} new=${a2.length}；sha old=${sha256(Buffer.from(a1)).slice(0, 16)} new=${sha256(Buffer.from(a2)).slice(0, 16)}`)

// ---- 方法 B：AST 重打印（注释不进 AST）
const stripB = (s) => {
  const sf = ts.createSourceFile('prep.ts', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return ts.createPrinter({ removeComments: true }).printFile(sf)
}
const b1 = stripB(oldSrc), b2 = stripB(newSrc)
ok('②方法B（AST 重打印）新旧输出逐字节相同', b1 === b2, `len old=${b1.length} new=${b2.length}`)

// ---- 逐行差异分类：每一处差异行是否都在注释内
function commentLines(src) {
  const sf = ts.createSourceFile('prep.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const set = new Set()
  const add = (r) => {
    const { pos, end } = r
    const startLine = sf.getLineAndCharacterOfPosition(pos).line
    const endLine = sf.getLineAndCharacterOfPosition(end).line
    for (let l = startLine; l <= endLine; l++) set.add(l)
  }
  const walk = (node) => {
    for (const r of ts.getLeadingCommentRanges(src, node.pos) || []) add(r)
    for (const r of ts.getTrailingCommentRanges(src, node.end) || []) add(r)
    ts.forEachChild(node, walk)
  }
  walk(sf)
  // 文件首尾的孤立注释（不属于任何节点 leading/trailing 的）
  const all = [...(ts.getLeadingCommentRanges(src, 0) || [])]
  for (const r of all) add(r)
  return set
}
const oldLines = oldSrc.split(/\r?\n/), newLines = newSrc.split(/\r?\n/)
const commentsNew = commentLines(newSrc), commentsOld = commentLines(oldSrc)
// 简易 LCS 差异：这里只在长度相同区域找变更行（两版行数应只差注释行数）
// 朴素逐行索引比对在"注释块行数变化"后会整体错位（会把后续所有行都记成差异），
// 因此改成**序列比对**：把两版各自的"非注释行"按顺序取出，要求完全一致。
const isCommentLine = (line, i, set) => set.has(i) || /^\s*(\/\/|\*|\/\*)/.test(line)
const codeOld = oldLines.filter((l, i) => !isCommentLine(l, i, commentsOld))
const codeNew = newLines.filter((l, i) => !isCommentLine(l, i, commentsNew))
rec.diff = { oldLines: oldLines.length, newLines: newLines.length, codeOldLines: codeOld.length, codeNewLines: codeNew.length }
ok('③ 两版"非注释行"序列完全一致（可执行文本未变）', codeOld.length === codeNew.length && JSON.stringify(codeOld) === JSON.stringify(codeNew), `非注释行 old=${codeOld.length} new=${codeNew.length}`)
// 定位第一处注释差异，便于人工确认改动落在哪个块
let firstDiff = -1
for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) if (oldLines[i] !== newLines[i]) { firstDiff = i; break }
rec.diff.firstDiffLine = firstDiff + 1
const changedOld = [firstDiff]

// 也报告一下：新版本里该注释块的文本
const block = [newLines[firstDiff]]
rec.diff.firstChangedLineText = block.slice(0, 3)
rec.diff.oldText = [oldLines[firstDiff]]
rec.diff.newText = [newLines[firstDiff]]
console.log('\n  首个差异行（旧）：', JSON.stringify(oldLines[firstDiff]))
console.log('  首个差异行（新）：', JSON.stringify(newLines[firstDiff]))

// ---- 附加：可执行符号清单（导出/函数/常量名）是否一致
function declNames(src) {
  const sf = ts.createSourceFile('prep.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const out = []
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.push('fn ' + n.name.text + '/' + n.parameters.length)
    if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) out.push('var ' + d.name.text)
    if (ts.isInterfaceDeclaration(n)) out.push('iface ' + n.name.text)
    if (ts.isTypeAliasDeclaration(n)) out.push('type ' + n.name.text)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}
const d1 = declNames(oldSrc), d2 = declNames(newSrc)
ok('④ 声明清单（函数/变量/类型）逐项相同', JSON.stringify(d1) === JSON.stringify(d2), `${d1.length} 项`)

writeFileSync(join(outDir, 'phase2-a-recheck.json'), JSON.stringify(rec, null, 2))
const failed = rec.checks.filter((c) => !c.pass)
console.log(`\n检查 ${rec.checks.length} 条，未过 ${failed.length} 条`)
console.log('写出：', join(outDir, 'phase2-a-recheck.json'))
