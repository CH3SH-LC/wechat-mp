// red-before.mjs —— 证明 2026-10-08 新增的 4 条越界断言**真的在判事**（不是恒真断言）。
//
// 做法：从 git 取**修复前**的 `src/lib/svg-quality.ts`（该文件零 import，可独立加载），与工作区版本
// 用**同一份夹具原文**分别跑，比较 `offCanvas`。
// 夹具原文**直接从 runner 里抽取**（不复制），避免"证明脚本里的夹具"与"回归里的夹具"悄悄漂移——
// 抽不到就直接报错，不会静默用一份过期的夹具"证明"通过。
//
// 用法：node docs/artifacts/2026-10-08-out-of-canvas/red-before.mjs [仓库根]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const repo = process.argv[2] || process.cwd()
const runner = join(repo, 'scripts', 'svg-quality-check.mjs')
const src = readFileSync(runner, 'utf8')

const grab = (name) => {
  const m = new RegExp('const ' + name + ' = `([\\s\\S]*?)`', 'm').exec(src)
  if (!m) throw new Error(`抽不到夹具 ${name}——runner 结构变了，证明脚本必须先修，不能拿旧夹具充数`)
  return m[1]
}

const NAMES = ['EDGE_ZERO', 'ANCESTOR_TRANSFORM', 'VIEWBOX_ORIGIN', 'GENUINELY_OUTSIDE']
const fixtures = NAMES.map((n) => [n, grab(n)])

// 旧实现：git 取 HEAD 版本（我的修复尚未提交，所以 HEAD 就是修复前）
const dir = mkdtempSync(join(tmpdir(), 'svg-red-'))
const oldPath = join(dir, 'svg-quality-old.ts')
writeFileSync(oldPath, execFileSync('git', ['show', 'HEAD:src/lib/svg-quality.ts'], { cwd: repo, encoding: 'utf8' }))

const oldMod = await import(pathToFileURL(oldPath).href)
const newMod = await import(pathToFileURL(join(repo, 'src/lib/svg-quality.ts')).href)

console.log('夹具'.padEnd(20), '旧'.padEnd(6), '新'.padEnd(6), '判定')
let allGood = true
for (const [name, svg] of fixtures) {
  const o = oldMod.analyzeSvg(svg).offCanvas
  const n = newMod.analyzeSvg(svg).offCanvas
  const isControl = name === 'GENUINELY_OUTSIDE'
  const newOk = isControl ? n > 0 : n === 0
  const oldRed = isControl ? o > 0 : o > 0
  if (!newOk) allGood = false
  const verdict = isControl
    ? oldRed && n > 0
      ? '对照：新旧都拦（规则没被关掉）'
      : '对照失效！'
    : oldRed && n === 0
      ? '旧版红 → 新版绿（可证伪）'
      : oldRed
        ? '新版仍红——修复未生效'
        : '旧版也绿——**不可证伪**，这条断言没在判事'
  console.log(name.padEnd(20), String(o).padEnd(6), String(n).padEnd(6), verdict)
}

console.log(
  allGood
    ? '\n结论：三条误判在旧实现下**红**、新实现下**绿**；对照条新旧都被拦 ⇒ 断言可证伪，修复有效。'
    : '\n结论：有断言未达预期，上面逐行看。',
)
process.exit(allGood ? 0 : 1)
