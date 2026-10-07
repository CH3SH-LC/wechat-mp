// E 路 阶段二：核对父协调者的判断 —— `live-conformance` 的唯一红项是否"先于本轮存在"。
//
// 可独立验证的部分：
//   ① composeMarkdown 的**依赖闭包**是否被本轮改动触碰（compose.ts → palettes.ts / svg-quality.ts）；
//   ② composeMarkdown 在同一输入上是否**确定性**（跑两次结果逐字节相同）；
//   ③ 同一输入在**基线**与**候选**两份模块上是否产出相同 warnings（本轮该路径无行为变化）。
// 不能独立验证的部分（如实标注）：真实模型那次交回的 bodyC 未被保存，无法逐字回放同一次输入；
//   因此本脚本证明的是"该红项与本轮改动无关"，**不是**"该红项永远会出现"。
import { createServer } from 'vite'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${id}${ev ? '  (' + ev + ')' : ''}`) }
const rec = { script: 'phase2-conformance-check', checks: [] }

// ① 依赖闭包：compose.ts 只 import palettes.ts 与 svg-quality.ts
const composeSrc = readFileSync(join(repoRoot, 'src/lib/compose.ts'), 'utf8')
const imports = [...composeSrc.matchAll(/^import .*?from '\.\/([^']+)'/gm)].map((m) => m[1])
rec.composeImports = imports
const changed = execFileSync('git', ['status', '--short'], { cwd: repoRoot }).toString('utf8')
const touchedSources = [...changed.matchAll(/^\s*M\s+(\S.*\.(ts|tsx|js|mjs|md|html))$/gm)].map((m) => m[1].replace(/^"|"$/g, ''))
rec.touchedSources = touchedSources
const closureTouched = imports.filter((i) => touchedSources.some((t) => t.endsWith('/' + i)))
ok('① compose.ts 的依赖闭包未被本轮改动触碰', closureTouched.length === 0, `imports=${imports.join(',')}；本轮改动源码=${JSON.stringify(touchedSources)}`)
const three = ['src/lib/persona.ts', 'src/lib/compose.ts', 'src/knowledge/排版引擎/engine-write-protocol.md']
const threeDiff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', ...three], { cwd: repoRoot }).toString('utf8').trim()
ok('①b runner 只读的三份输入与 HEAD 逐字节相同', threeDiff === '', threeDiff || '(空 = 未改)')

// ②③ 确定性与基线/候选等价：用 runner 自身的构造形状喂同一输入
const DUMMY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none"><circle cx="240" cy="220" r="40" fill="#f2c76e"/></svg>'
const body =
  '## 本周活动安排\n\n' +
  '> [!提示|bubble-flower-corner] 到场请注意\n\n' +
  '本周活动如期举行，欢迎到场参加。\n\n' +
  '::: art deco bubble-flower-corner\n' + DUMMY + '\n:::\n\n' +
  '活动结束后请带走随身物品。\n'

async function loadCompose(rootName) {
  const s = await createServer({ root: join(here, rootName), configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  const mod = await s.ssrLoadModule('/src/lib/compose.ts')
  return { s, compose: mod.composeMarkdown }
}
const cand = await loadCompose('candidate')
const r1 = cand.compose(body, {})
const r2 = cand.compose(body, {})
await cand.s.close()
const base = await loadCompose('baseline')
const r0 = base.compose(body, {})
await base.s.close()

const j = (x) => JSON.stringify(x.warnings)
ok('② composeMarkdown 同一输入确定性（两次结果相同）', j(r1) === j(r2), `warnings=${r1.warnings.length}`)
ok('③ 基线/候选同一输入产出相同 warnings（本轮该路径无行为变化）', j(r1) === j(r0), `候选=${j(r1).slice(0, 120)}；基线=${j(r0).slice(0, 120)}`)
rec.sampleWarnings = r1.warnings
console.log('  样本 warnings：', JSON.stringify(r1.warnings))

writeFileSync(join(outDir, 'phase2-conformance.json'), JSON.stringify(rec, null, 2))
const failed = rec.checks.filter((c) => !c.pass)
console.log(`\n检查 ${rec.checks.length} 条，未过 ${failed.length} 条${failed.length ? '：' + failed.map((c) => c.id).join(' / ') : ''}`)
console.log('写出：', join(outDir, 'phase2-conformance.json'))
