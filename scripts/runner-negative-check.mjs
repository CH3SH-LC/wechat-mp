// runner-negative-check.mjs —— 运行器判定器的**负向回归**（DS 修复指南 §3.1 / §7）
//
// 用法：
//   node scripts/runner-negative-check.mjs <evidenceDir> [deadPort]
//
// 为什么必须有：审计抓到的原缺陷是"导航异常、零条检查，进程 exit 1，但 finally 照样写出
// **全部 PASS**"。光把判定器写好不够——还得证明"坏输入真的会变红"，否则下一次改动又可能
// 把它改回"什么都 PASS"而没人发现。
//
// 本脚本对每个受测运行器做三件事：
//   ① 用一个**没有服务在听的端口**跑它（错误端口）；
//   ② 断言退出码非 0；
//   ③ 断言产出的 `run-result.json` 状态是 ERROR / BLOCKED，且**没有任何** PASS 结论、
//      `executionComplete` 不是 true。
//
// 用独立子进程跑，互不干扰；不联网（端口是本机空号）、不调模型、不写真实工作区。
//
// 判定（DS 修复指南 §3.1）：本脚本自己也走唯一 RunResult 口径——零条检查是 ERROR（例如
// RUNNERS 列表被清空时，`failed===0` 曾经会打印 OK），异常是 ERROR，都退出非 0。
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJudge, guardCrashes, positionalArgs } from './lib/run-result.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// 参数：`[outDir] [deadPort]`，也接受 `--out <dir>`。
// 不能只按位置取：用了 `--out` 之后位置参数整体前移，`--out` 自己会被当成输出目录
// （实测在仓库根下真建了一个 `--out/`，里面还躺着子 runner 的证据——"结果看着有、其实放错地方"）。
const { argv: rest, outDir: forcedOut } = positionalArgs()
const deadPort = String(rest.find((a) => /^\d+$/.test(a)) || '59999')
const outDir = resolve(forcedOut || rest.find((a) => !/^\d+$/.test(a)) || join(repoRoot, 'docs', 'artifacts', 'runner-negative'))
const deadUrl = `http://127.0.0.1:${deadPort}`

const RUNNERS = [
  { name: 'preview-resource-check', script: 'scripts/preview-resource-check.mjs' },
  { name: 'prep-contract-check', script: 'scripts/prep-contract-check.mjs' },
  { name: 'repair-flow-check', script: 'scripts/repair-flow-check.mjs' },
]

let failed = 0
const lines = []
// plannedCases：每个受测运行器都必须至少产出一条结论（它的 6 条断言是成组出现的）
const judge = createJudge({
  script: 'runner-negative-check',
  outDir,
  plannedCases: RUNNERS.map((r) => `${r.name}：`),
})
guardCrashes(judge)
const check = (name, ok, extra = '') => {
  const line = `${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`
  console.log('  ' + line)
  lines.push(line)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

const results = []
for (const r of RUNNERS) {
  const sub = join(outDir, r.name)
  mkdirSync(sub, { recursive: true })
  const child = spawnSync(process.execPath, [join(repoRoot, r.script), sub, deadUrl], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 180000,
    env: process.env,
  })
  const exitCode = child.status === null ? 'null' : child.status
  let result = null
  const resultFile = join(sub, 'run-result.json')
  if (existsSync(resultFile)) {
    try {
      result = JSON.parse(readFileSync(resultFile, 'utf8'))
    } catch {
      result = null
    }
  }
  writeFileSync(join(sub, 'stdout.log'), String(child.stdout || '') + '\n--- stderr ---\n' + String(child.stderr || ''), 'utf8')

  const row = {
    runner: r.name,
    deadUrl,
    exitCode,
    hasResultFile: Boolean(result),
    status: result ? result.status : null,
    executionComplete: result ? result.executionComplete : null,
    executedCases: result ? (result.executedCases || []).length : null,
    passChecks: result ? (result.checks || []).filter((c) => c.pass).length : null,
    totalChecks: result ? (result.checks || []).length : null,
    errors: result ? (result.errors || []).map((e) => `[${e.stage}] ${e.message}`) : null,
    stdoutTail: String(child.stdout || '').trim().split('\n').slice(-3).join(' | '),
  }
  results.push(row)
  console.log(`\n[${r.name} @ ${deadUrl}] ${JSON.stringify(row)}`)

  check(`${r.name}：错误端口下退出码非 0`, exitCode !== 0 && exitCode !== 'null', `exit=${exitCode}`)
  check(`${r.name}：产出了唯一判定结果文件`, Boolean(result))
  check(
    `${r.name}：状态是 ERROR 或 BLOCKED（不是 PASS/FAIL）`,
    Boolean(result) && (result.status === 'ERROR' || result.status === 'BLOCKED'),
    `status=${result && result.status}`,
  )
  check(`${r.name}：executionComplete 不为 true`, !result || result.executionComplete !== true, `executionComplete=${result && result.executionComplete}`)
  check(
    `${r.name}：没有任何"全部 PASS"式的结论行`,
    !/全(部|绿)\s*PASS|ALL PASS/i.test(String(child.stdout || '')),
    'stdout 里不得出现全通过字样',
  )
  check(
    `${r.name}：报告里写明了具体错误（不是静默失败）`,
    Boolean(result) && Array.isArray(result.errors) && result.errors.length > 0,
    result && result.errors && result.errors.length ? `[${result.errors[0].stage}] ${result.errors[0].message}` : '（无 errors）',
  )
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'result.json'), JSON.stringify({ deadUrl, results }, null, 2) + '\n')
const report =
  `# 运行器判定器负向回归\n\n时间：${new Date().toISOString()}\n入口：\`node scripts/runner-negative-check.mjs ${outDir} ${deadPort}\`\n` +
  `场景：让每个运行器连一个**没有服务在听**的本机端口，断言它"退出非 0 + 状态 ERROR/BLOCKED + 不产出全通过结论"。\n\n` +
  `**结果：${judge.statusOf()}**（检查 ${judge.run.checks.filter((c) => c.pass).length}/${judge.run.checks.length} 通过，${failed} 条红）\n\n` +
  `${lines.map((l) => '- ' + l).join('\n')}\n`
writeFileSync(join(outDir, 'result.md'), report, 'utf8')
judge.finish({ label: 'RUNNER-NEGATIVE', extraFiles: { 'result.md': report } })
