// 变异测试驱动（A 路）——证明新增断言**确实**由修复代码里的几处守卫承担责任。
//
// 每个变异体：在 src/lib/prep.ts 上做一次**精确**的字符串替换（替换次数必须恰好 1，否则报错退出），
// 跑一次真实 `scripts/prep-contract-check.mjs`，收集 FAIL 断言 id，然后从 pristine 备份恢复并校验哈希。
// 用法：node <本文件> <viteBase>
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url)) // .../A/mutants
const A = resolve(here, '..')
const repo = resolve(A, '..', '..', '..', '..', '..') // wechat-mp-desktop
if (!/wechat-mp-desktop$/.test(repo) || !existsSync(join(repo, 'src', 'lib', 'prep.ts'))) throw new Error('repo 路径解析错误，拒绝写入：' + repo)
const prepPath = join(repo, 'src', 'lib', 'prep.ts')
const pristine = join(here, 'prep.ts.pristine')
const base = process.argv[2] || 'http://127.0.0.1:1437'
if (!existsSync(pristine)) throw new Error('缺少 pristine 备份：' + pristine)
const pristineSrc = readFileSync(pristine, 'utf8')
const pristineHash = createHash('sha256').update(pristineSrc).digest('hex')

const MUTANTS = [
  {
    id: 'M1-drop-corrected-guard',
    desc: '去掉「至多一次」守卫（!corrected）→ 纠偏可以重复',
    from: 'if (!corrected && callNo + 1 < MAX_PREP_CALLS && isCorrectableFinishError(args)) {',
    to: 'if (callNo + 1 < MAX_PREP_CALLS && isCorrectableFinishError(args)) {',
  },
  {
    id: 'M2-drop-budget-guard',
    desc: '去掉「剩余预算」守卫（callNo + 1 < MAX_PREP_CALLS）→ 最后一轮也会纠偏（可能发出第 4 次请求）',
    from: 'if (!corrected && callNo + 1 < MAX_PREP_CALLS && isCorrectableFinishError(args)) {',
    to: 'if (!corrected && isCorrectableFinishError(args)) {',
  },
  {
    id: 'M3-over-broad-classifier',
    desc: '分类器放宽成「任何 compose/candidate 错误都可纠偏」（不再要求带 text）',
    from: '  return o.text !== undefined && o.text !== null',
    to: '  return true',
  },
  {
    id: 'M4-ignore-text-and-accept',
    desc: '**任务卡明确禁止的行为**：忽略 text 直接接受 compose（删掉互斥拒绝）',
    from: '    if (hasText) return { ok: false, error: \'outcome=compose 与 text 互斥（要答复请用 reply）\' }',
    to: '    if (false && hasText) return { ok: false, error: \'outcome=compose 与 text 互斥（要答复请用 reply）\' }',
  },
  {
    id: 'M5-rewrite-echoed-args',
    desc: '回填时**改写**模型的 arguments（把 text 抹掉）——防伪造回执',
    from: '              function: { name: c.name, arguments: c.args },\n            }),\n          ),\n        })\n        convo.push({\n          role: \'tool\',',
    to: '              function: { name: c.name, arguments: \'{"outcome":"compose","assetPolicy":"preserve"}\' },\n            }),\n          ),\n        })\n        convo.push({\n          role: \'tool\',',
  },
]

const env = {
  ...process.env,
  VERIFY_PLAYWRIGHT: 'C:/Users/Lenovo/AppData/Local/Temp/pw-deps/node_modules/playwright-core',
  VERIFY_CHROMIUM: 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
}

const results = []
try {
  for (const m of MUTANTS) {
    const hits = pristineSrc.split(m.from).length - 1
    if (hits !== 1) throw new Error(`${m.id}：替换锚点命中 ${hits} 次（必须恰好 1 次），拒绝继续`)
    writeFileSync(prepPath, pristineSrc.replace(m.from, m.to), 'utf8')
    const outDir = join(A, 'runs', `03-mutant-${m.id}`)
    const r = spawnSync(process.execPath, ['scripts/prep-contract-check.mjs', outDir, base], { cwd: repo, env, encoding: 'utf8' })
    const stdout = r.stdout || ''
    const fails = stdout
      .split(/\r?\n/)
      .filter((l) => /^  FAIL - /.test(l))
      .map((l) => l.replace(/^  FAIL - /, ''))
    const status = (stdout.match(/PREP-CONTRACT (\w+)/) || [])[1] || 'UNKNOWN'
    results.push({ id: m.id, desc: m.desc, exit: r.status, status, failCount: fails.length, fails })
    console.log(`\n### ${m.id}（exit=${r.status} / ${status} / FAIL ${fails.length} 条）`)
    console.log(fails.map((f) => '  - ' + f).join('\n') || '  （无 FAIL：这个变异体没有被断言抓住！）')
  }
} finally {
  copyFileSync(pristine, prepPath)
  const back = createHash('sha256').update(readFileSync(prepPath)).digest('hex')
  const ok = back === pristineHash
  console.log(`\n恢复 prep.ts：${ok ? 'OK' : '失败'}（sha256=${back}）`)
  writeFileSync(join(here, 'mutants-result.json'), JSON.stringify({ pristineHash, restoredHash: back, restoredOk: ok, results }, null, 2) + '\n')
  if (!ok) process.exitCode = 3
}
