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
import { fileURLToPath, pathToFileURL } from 'node:url'
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
// 第二段的判定器写盘场景按 `判定器写盘：` 前缀登记——某组一条检查都没出现 = 执行不完整 = ERROR。
// 「浏览器可执行文件不存在」这条只在能解析到 playwright 时才有意义（否则子进程会先死在缺依赖上，
// 测不到 launch 那一步）。有 playwright 就把它算进计划场景——缺了就是执行不完整。
const BROWSER_CASE = 'repair-flow-check（缺浏览器）：'
const judge = createJudge({
  script: 'runner-negative-check',
  outDir,
  plannedCases: [
    ...RUNNERS.map((r) => `${r.name}：`),
    ...(process.env.VERIFY_PLAYWRIGHT ? [BROWSER_CASE] : []),
    '判定器写盘：',
  ],
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

// =====================================================================================
// 第一段补：**浏览器可执行文件不存在**（2026-10-02 复核实测）
//
// 复测的原话是："repair-flow 在启动异常后无判定文件"——`chromium.launch()` 在模块顶层抛出，
// 归档里只剩一段栈，看起来像"压根没跑过"。它和"错误端口"是两回事：错误端口能走到导航失败，
// 这一条连浏览器都起不来。这里给出**可用的 playwright 模块 + 不存在的浏览器路径**复现它。
// =====================================================================================
if (process.env.VERIFY_PLAYWRIGHT) {
  // 两个变体，分别覆盖两条不同的失败路径：
  //   v1「显式给了一个不存在的可执行文件」→ 运行器自己的存在性检查就该拦下；
  //   v2「不给 VERIFY_CHROMIUM」（Playwright 用自己的默认浏览器，本机实测默认 headless shell 1228 不存在）
  //      → 正是审计复现的那条：`chromium.launch()` 在模块顶层抛，过去**没有任何判定文件**留档。
  const variants = [
    { tag: 'missing-exe', env: { VERIFY_CHROMIUM: join(repoRoot, 'scripts', 'fixtures', 'no-such-browser', 'chrome.exe') } },
    { tag: 'no-exe-env', env: { VERIFY_CHROMIUM: undefined } },
  ]
  for (const v of variants) {
    const sub = join(outDir, `repair-flow-${v.tag}`)
    mkdirSync(sub, { recursive: true })
    const env = { ...process.env, ...v.env }
    if (v.env.VERIFY_CHROMIUM === undefined) delete env.VERIFY_CHROMIUM
    const child = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'repair-flow-check.mjs'), sub, deadUrl], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 180000,
      env,
    })
    writeFileSync(join(sub, 'stdout.log'), String(child.stdout || '') + '\n--- stderr ---\n' + String(child.stderr || ''), 'utf8')
    let result = null
    try {
      result = JSON.parse(readFileSync(join(sub, 'run-result.json'), 'utf8'))
    } catch {
      result = null
    }
    const text = `${child.stdout || ''}${child.stderr || ''}`
    const label = `${BROWSER_CASE}${v.tag} `
    check(`${label}起不来时也留下了判定文件（不是裸异常退出）`, Boolean(result), `run-result.json 存在=${Boolean(result)}；exit=${child.status}`)
    check(
      `${label}状态是 BLOCKED/ERROR 且不打印 PASS`,
      Boolean(result) && (result.status === 'BLOCKED' || result.status === 'ERROR') && !/REPAIR-FLOW PASS\b/.test(text),
      `status=${result && result.status}；exit=${child.status}`,
    )
    check(
      `${label}说明可定位（写明浏览器启动失败 / 缺依赖 / 导航失败，而不是一句"未知错误"）`,
      /浏览器启动失败|executablePath|deps|navigate|ERR_CONNECTION_REFUSED/i.test(JSON.stringify(result ? result.errors : [])) ||
        /浏览器启动失败|Unable to open|Executable doesn't exist/i.test(text),
      `errors=${JSON.stringify(result ? (result.errors || []).map((e) => `[${e.stage}] ${e.message}`) : null)}`,
    )
  }
}

// =====================================================================================
// 第二段：判定器**写盘失败**负向回归（指南 §0.2 R1）
//
// 审计复现的真实缺陷：`finish()` 里写盘抛异常只 `console.error` 一行，然后**照旧 PASS、exit 0**，
// 目录里连 `run-result.json` 都没有。后果是"证据全丢了"与"全部通过"在归档里长得一模一样。
//
// 这里每个场景都用一个子进程导入**真实生产模块**（`scripts/lib/run-result.mjs`），
// 不复制判定实现——复制一份就等于测的是复制品。子进程只碰本次新建的临时目录，不联网、不调模型。
// =====================================================================================

const runResultUrl = pathToFileURL(join(repoRoot, 'scripts', 'lib', 'run-result.mjs')).href
const persistRoot = join(outDir, 'persist-failure')
mkdirSync(persistRoot, { recursive: true })

/**
 * 在子进程里跑一段用真实模块写的程序，返回 {exit, stdout, stderr}。
 *
 * **写进文件再跑，不用 `node -e`**：Windows 的命令行按当前代码页传参，程序里只要有一个中文
 * 就会被改写成乱码、Node 直接解析失败（实测：`-e` 版本 exit 3221226505、stdout 全空，
 * 看着像"被测模块崩了"，其实是测试脚手架自己把源码传坏了）。落成 .mjs 文件后编码由文件系统保证。
 */
function runJudgeProgram(program, dir, fileBase) {
  const programFile = join(persistRoot, `${fileBase}.mjs`)
  writeFileSync(programFile, program, 'utf8')
  const child = spawnSync(process.execPath, [programFile], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
    env: { ...process.env, WXMP_CASE_DIR: dir },
  })
  return { exit: child.status, stdout: String(child.stdout || ''), stderr: String(child.stderr || ''), error: child.error }
}

/** 每段子程序共用的开头：从真实的 run-result.mjs 取 createJudge / guardCrashes */
const PRELUDE = `import { createJudge, guardCrashes } from ${JSON.stringify(runResultUrl)};\nconst dir = process.env.WXMP_CASE_DIR;\n`

const readResultJson = (dir) => {
  try {
    return JSON.parse(readFileSync(join(dir, 'run-result.json'), 'utf8'))
  } catch {
    return null
  }
}

/**
 * 每个场景：`setup(dir)` 摆好坏输入 → `program` 在子进程里跑真实模块 → `assert(r)` 判定。
 * `assert` 返回 true=符合预期（坑被堵住了）。
 */
const PERSIST_CASES = [
  {
    id: '合法目录：正常通过并留下判定文件',
    setup: (dir) => mkdirSync(dir, { recursive: true }),
    program: PRELUDE + `const j = createJudge({ script: 'ok-dir', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish();\n`,
    assert: (r, dir) => {
      const res = readResultJson(dir)
      return r.exit === 0 && /OK-DIR PASS\b/.test(r.stdout) && res && res.status === 'PASS'
    },
    why: 'exit=0、打印 PASS、run-result.json 存在且状态 PASS',
  },
  {
    id: '输出路径是普通文件（mkdir EEXIST）',
    setup: (dir) => {
      mkdirSync(join(dir, '..'), { recursive: true })
      writeFileSync(dir, 'sentinel: 这是一个文件，不是目录\n', { flag: 'wx' }) // dir 本身就是那个文件
    },
    program: PRELUDE + `const j = createJudge({ script: 'out-is-file', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish();\n`,
    assert: (r) => r.exit !== 0 && !/OUT-IS-FILE PASS\b/.test(r.stdout) && /OUT-IS-FILE ERROR\b/.test(r.stdout),
    why: '退出非 0、不打印 PASS、打印 ERROR',
  },
  {
    id: '主判定文件写不出去（run-result.json 是目录）',
    setup: (dir) => {
      mkdirSync(join(dir, 'run-result.json'), { recursive: true })
    },
    program: PRELUDE + `const j = createJudge({ script: 'verdict-locked', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish();\n`,
    assert: (r, dir) => {
      // 判定路径下此刻是个**目录**，所以"能不能读到 PASS"要按"读不到或读到的是失败"判定
      let readable = null
      try {
        readable = readFileSync(join(dir, 'run-result.json'), 'utf8')
      } catch {
        readable = null
      }
      return (
        r.exit !== 0 &&
        !/VERDICT-LOCKED PASS\b/.test(r.stdout) &&
        /VERDICT-LOCKED ERROR\b/.test(r.stdout) &&
        (readable === null || !/"PASS"/.test(readable))
      )
    },
    why: '退出非 0、不打印 PASS、判定路径下没有写着 PASS 的文件',
  },
  {
    id: '必需附件写失败（report.md 是目录）',
    setup: (dir) => {
      mkdirSync(join(dir, 'report.md'), { recursive: true })
    },
    program:
      PRELUDE +
      `const j = createJudge({ script: 'attach-fail', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish({ extraFiles: { 'report.md': '报告正文\\n' } });\n`,
    assert: (r, dir) => {
      const res = readResultJson(dir)
      return r.exit !== 0 && !/ATTACH-FAIL PASS\b/.test(r.stdout) && res && res.status === 'ERROR' && (res.errors || []).some((e) => e.stage === 'persist')
    },
    why: '退出非 0、不打印 PASS、判定文件已写成 ERROR 并带 persist 错误',
  },
  {
    id: '目录里有过时 PASS 且本次附件失败 → 过时 PASS 必须被更新',
    setup: (dir) => {
      mkdirSync(join(dir, 'report.md'), { recursive: true })
      writeFileSync(join(dir, 'run-result.json'), JSON.stringify({ script: 'stale', status: 'PASS', checks: [] }, null, 2), 'utf8')
    },
    program:
      PRELUDE +
      `const j = createJudge({ script: 'stale-pass', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish({ extraFiles: { 'report.md': '报告正文\\n' } });\n`,
    assert: (r, dir) => {
      const raw = readFileSync(join(dir, 'run-result.json'), 'utf8')
      const res = JSON.parse(raw)
      return r.exit !== 0 && res.status === 'ERROR' && !/"PASS"/.test(raw)
    },
    why: '原先那份 PASS 不再留在原地，被本次 ERROR 判定取代',
  },
  {
    id: '重复调用 finish 不得把失败翻绿',
    setup: (dir) => {
      mkdirSync(join(dir, '..'), { recursive: true })
      writeFileSync(dir, 'sentinel\n', { flag: 'wx' })
    },
    program: PRELUDE + `const j = createJudge({ script: 'twice', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nconst a = j.finish();\nconst b = j.finish();\nconsole.log('STATUSES=' + a + ',' + b);\n`,
    assert: (r) => {
      const verdictLines = r.stdout.split('\n').filter((l) => /TWICE (PASS|FAIL|ERROR|BLOCKED)\b/.test(l))
      return r.exit !== 0 && verdictLines.length === 1 && /TWICE ERROR\b/.test(verdictLines[0]) && /STATUSES=ERROR,ERROR/.test(r.stdout)
    },
    why: '两次调用只产出一条判定行、两次返回值都是 ERROR、退出非 0',
  },
  {
    id: '未捕获异常经 guardCrashes 落成 ERROR（坏目录下也不假绿）',
    setup: (dir) => {
      mkdirSync(join(dir, '..'), { recursive: true })
      writeFileSync(dir, 'sentinel\n', { flag: 'wx' })
    },
    program: PRELUDE + `const j = createJudge({ script: 'crash', outDir: dir, plannedCases: ['case'] });\nguardCrashes(j);\nj.check('case', true);\nsetTimeout(() => { throw new Error('模拟半路崩溃'); }, 0);\n`,
    assert: (r) => r.exit !== 0 && !/CRASH PASS\b/.test(r.stdout) && /CRASH ERROR\b/.test(r.stdout),
    why: '退出非 0、判定为 ERROR、全程没有 PASS 字样',
  },
  {
    // 2026-10-02 复核实测的真缺陷：附件在"判定还没最终确定"时写出去，于是同一份归档里
    // 主判定写着 PASS、report.md 却写着别的状态（探针实测是 BLOCKED、evidence.json 连 status 都没有）。
    // 现在附件一律按**最终判定**重写一遍；这条用例就是钉住这件事。
    id: '附件写失败后，报告必须按最终判定重写（不能主判定 ERROR、报告还写着 PASS）',
    setup: (dir) => {
      mkdirSync(join(dir, 'evidence.json'), { recursive: true }) // 这个附件必然写不出去
    },
    program:
      PRELUDE +
      `const j = createJudge({ script: 'consistency', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish({ extraFiles: (run) => ({ 'report.md': '状态：' + run.status + '\\n', 'evidence.json': '{}\\n' }) });\n`,
    assert: (r, dir) => {
      const res = readResultJson(dir)
      let report = null
      try {
        report = readFileSync(join(dir, 'report.md'), 'utf8')
      } catch {
        report = null
      }
      return r.exit !== 0 && res && res.status === 'ERROR' && report !== null && /状态：ERROR/.test(report) && !/状态：PASS/.test(report)
    },
    why: '主判定 ERROR，同目录报告里也写着 ERROR（三份文件说的是同一件事）',
  },
  {
    id: '对照：没有落盘错误时报告与主判定都是 PASS（函数式附件不把正常路径判红）',
    setup: (dir) => mkdirSync(dir, { recursive: true }),
    program:
      PRELUDE +
      `const j = createJudge({ script: 'consistency-ok', outDir: dir, plannedCases: ['case'] });\nj.check('case', true);\nj.finish({ extraFiles: (run) => ({ 'report.md': '状态：' + run.status + '\\n' }) });\n`,
    assert: (r, dir) => {
      const res = readResultJson(dir)
      let report = null
      try {
        report = readFileSync(join(dir, 'report.md'), 'utf8')
      } catch {
        report = null
      }
      return r.exit === 0 && res && res.status === 'PASS' && report !== null && /状态：PASS/.test(report)
    },
    why: 'exit=0、主判定 PASS、报告也写着 PASS',
  },
  {
    id: '必需检查条数下界（minChecks）不足时不是 PASS',
    setup: (dir) => mkdirSync(dir, { recursive: true }),
    program: PRELUDE + `const j = createJudge({ script: 'min-checks', outDir: dir, plannedCases: [], minChecks: 3 });\nj.check('only-one', true);\nj.finish();\n`,
    assert: (r, dir) => {
      const res = readResultJson(dir)
      return r.exit !== 0 && res && res.status === 'ERROR' && (res.errors || []).some((e) => e.stage === 'completeness')
    },
    why: '只跑了 1 条而声明至少 3 条 → ERROR，不是"至少跑了一条就算过"',
  },
]

/** 每个场景先证红：同一段子程序配上**合法目录**必须 PASS；再换成坏输入必须变红。 */
const persistResults = []
for (const [i, c] of PERSIST_CASES.entries()) {
  const dir = join(persistRoot, `${String(i + 1).padStart(2, '0')}-${c.id.replace(/[^\w一-龥]+/g, '-').slice(0, 40)}`)
  let ok = false
  let detail = ''
  try {
    c.setup(dir)
    const r = runJudgeProgram(c.program, dir, `case-${String(i + 1).padStart(2, '0')}`)
    writeFileSync(join(persistRoot, `${i + 1}-stdout.log`), r.stdout + '\n--- stderr ---\n' + r.stderr, 'utf8')
    ok = Boolean(c.assert(r, dir))
    detail = `exit=${r.exit} 期望：${c.why}`
    if (!ok) {
      detail +=
        `；实际 stdout 尾=${JSON.stringify(r.stdout.trim().split('\n').slice(-2).join(' | '))}` +
        `；stderr=${JSON.stringify(String(r.stderr).trim().slice(-200))}` +
        `${r.error ? `；spawnError=${r.error.message}` : ''}` +
        `${r.signal ? `；signal=${r.signal}` : ''}`
    }
  } catch (e) {
    detail = `场景执行抛错：${String((e && e.message) || e)}`
  }
  persistResults.push({ id: c.id, ok, detail })
  check(`判定器写盘：${c.id}`, ok, detail)
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'result.json'), JSON.stringify({ deadUrl, results, persistResults }, null, 2) + '\n')
const report =
  `# 运行器判定器负向回归\n\n时间：${new Date().toISOString()}\n入口：\`node scripts/runner-negative-check.mjs ${outDir} ${deadPort}\`\n\n` +
  `## 一、错误端口（每个运行器连一个没有服务在听的本机端口）\n\n` +
  `断言"退出非 0 + 状态 ERROR/BLOCKED + 不产出全通过结论"。\n\n` +
  `## 二、判定器写盘失败（指南 §0.2 R1）\n\n` +
  `子进程导入**真实** \`scripts/lib/run-result.mjs\`，逐项断言"写盘失败 → 非 0 且不打印 PASS"。\n\n` +
  persistResults.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} — ${r.id}（${r.detail}）`).join('\n') +
  `\n\n**结果：${judge.statusOf()}**（检查 ${judge.run.checks.filter((c) => c.pass).length}/${judge.run.checks.length} 通过，${failed} 条红）\n\n` +
  `${lines.map((l) => '- ' + l).join('\n')}\n`
writeFileSync(join(outDir, 'result.md'), report, 'utf8')
judge.finish({ label: 'RUNNER-NEGATIVE', extraFiles: { 'result.md': report } })
