// run-result.mjs —— 运行器统一判定器（DS 修复指南 2026-09-30 §3.1）
//
// 为什么单独做成一个模块：审计抓到的原缺陷是**每个脚本各自用 `failed === 0` 推导成功**。
// 这条推导有两处致命性质：
//   ① 零条检查（用例列表空了、循环没进去、断言被条件跳过）与"全部通过"不可区分 → 打印 OK、exit 0；
//   ② 基础设施错误（缺依赖、导航失败、脚本半路抛异常）如果被 catch 成"打印一行 + failed++"，
//      而 failed 又恰好在别的分支被清掉/没加上，同样会变成 OK。
// `preview-resource-check.mjs` 与 `repair-flow-check.mjs` 已经改用"唯一 RunResult"口径，本模块把
// 同一套口径抽出来给其余运行器复用，避免每个脚本自己再写一遍（写歪一处就漏一处）。
//
// 统一口径（与那两个脚本逐字一致）：
//   status ∈ PASS | FAIL | ERROR | BLOCKED；
//   PASS 必须**同时**满足：计划场景执行完整、必需检查存在（>0）、没有失败或基础设施错误；
//   零检查 → ERROR，异常 → ERROR，缺依赖/无法开始 → BLOCKED；三者都退出非 0（PASS=0，FAIL/ERROR=1，BLOCKED=2）。
//   finally/finish **不**根据 `failed === 0` 推导成功。
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** 退出码：PASS=0；FAIL/ERROR 有判定结果但没通过=1；BLOCKED 连跑都没跑起来=2 */
export const EXIT = { PASS: 0, FAIL: 1, ERROR: 1, BLOCKED: 2 }

/** 每次运行一个新目录（不覆盖历史证据）；判定结果写在这里 */
export function tempOutDir(script) {
  return join(tmpdir(), `wxmp-oracle-${script}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)
}

/** 输出目录：`--out <dir>` > `WXMP_RUNNER_OUTDIR` > fallbackDir > 系统临时目录（每次新目录） */
export function resolveOutDir(script, fallbackDir) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--out')
  const dir = (i >= 0 && argv[i + 1]) || process.env.WXMP_RUNNER_OUTDIR || fallbackDir || ''
  return dir ? resolve(dir) : tempOutDir(script)
}

/**
 * 取出**位置参数**，并把 `--out <dir>` / `--out=<dir>` 摘掉。
 *
 * 为什么必须有：几套 runner 的参数约定不一致——`verify-ui` 认 `--out`，
 * 而 `prep-contract-check` / `preview-resource-check` / `repair-flow-check` 用**位置参数**
 * （argv[0]=输出目录、argv[1]=baseURL）。一旦用错约定，`--out` 会被当成**输出目录的名字**、
 * 真正的目录被当成 baseURL：**不报错**，而且证据写进一个叫 `--out` 的目录里
 * （实测踩过一次，仓库根下真出现了一个 `--out/`）。这属于"结论看起来有、其实放错地方"，
 * 所以两种写法都要认，别让使用者靠记住哪套是哪个来避免。
 *
 * 返回 `{ argv, outDir }`：`argv` 是摘掉 `--out` 之后的位置参数，`outDir` 为空串表示没给。
 */
export function positionalArgs() {
  const raw = process.argv.slice(2)
  const argv = []
  let outDir = ''
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    if (a === '--out') {
      const v = raw[i + 1]
      if (v !== undefined && !v.startsWith('--')) {
        outDir = v
        i++
      }
      continue
    }
    if (a.startsWith('--out=')) {
      outDir = a.slice('--out='.length)
      continue
    }
    argv.push(a)
  }
  return { argv, outDir }
}

/**
 * 解析"输出目录 + baseURL"这一对参数，两种写法都能用：
 *   `node <runner> [outDir] [URL]`、`node <runner> --out <outDir> [URL]`、只给其中一个。
 *
 * 为什么不能简单取 `argv[0]`/`argv[1]`：用了 `--out` 之后位置参数**整体前移一位**，
 * 此时 `argv[0]` 是 URL——再按位置取就会把 URL 当成输出目录、baseURL 悄悄退回默认的 1420 端口，
 * 于是脚本连到没在跑的服务上、报一个看起来像"产品坏了"的 ERROR（实测踩过一次）。
 * 判据是"长得像不像 http(s) URL"，而不是数位置。
 */
export function parseRunnerArgs(defaultBase = 'http://127.0.0.1:1420') {
  const { argv, outDir } = positionalArgs()
  const isUrl = (s) => /^https?:\/\//i.test(String(s || ''))
  return {
    outDir: outDir || argv.find((a) => !isUrl(a)) || '',
    base: argv.find(isUrl) || defaultBase,
    rest: argv,
  }
}

/**
 * 创建唯一判定结果对象。
 *
 * @param script  脚本名（写进 run-result.json，便于负向回归与归档检索）
 * @param outDir  证据目录；不传则用一个新的系统临时目录
 * @param plannedCases 计划场景的前缀列表（按 `check()` 的 id 前缀匹配判定"执行到了没有"）。
 *                     计划里某个场景一条检查都没出现 → 执行不完整 → ERROR（不是跳过、不是通过）。
 */
export function createJudge({ script, outDir, plannedCases = [], label, extra = {} }) {
  const run = {
    script,
    label: label || script.toUpperCase(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'BLOCKED', // PASS | FAIL | ERROR | BLOCKED
    executionComplete: false,
    plannedCases: [...plannedCases],
    executedCases: [],
    checks: [], // { id, pass, evidence[] }
    errors: [], // { stage, message }
    blockedReason: null,
    ...extra,
  }
  let outputDir = outDir || ''
  let finished = false

  const matched = (p) => run.checks.some((c) => c.id === p || c.id.startsWith(p))

  const api = {
    run,
    /** 记一条检查。ok 为假 → 最终 FAIL；返回 ok，便于 `if (!judge.check(...)) {...}` */
    check(id, ok, evidence = []) {
      const ev = (Array.isArray(evidence) ? evidence : [evidence])
        .filter((x) => x !== undefined && x !== null && x !== '')
        .map(String)
      run.checks.push({ id: String(id), pass: Boolean(ok), evidence: ev })
      return Boolean(ok)
    },
    /** 记一条基础设施/执行错误（stage: deps | navigate | runner | persist | crash | …） */
    error(stage, message) {
      run.errors.push({ stage: String(stage), message: String(message).split('\n')[0] })
    },
    /** 缺依赖/无法开始：BLOCKED，退出码 2 */
    block(reason) {
      run.blockedReason = String(reason)
      api.error('deps', reason)
    },
    setPlanned(cases) {
      run.plannedCases = [...cases]
    },
    /** 与 preview-resource-check / repair-flow-check 的 statusOf() 同口径 */
    statusOf() {
      if (run.blockedReason) return 'BLOCKED'
      if (run.errors.length) return 'ERROR'
      if (run.plannedCases.length && run.plannedCases.some((p) => !matched(p))) return 'ERROR'
      if (run.checks.length === 0) return 'ERROR'
      return run.checks.some((c) => !c.pass) ? 'FAIL' : 'PASS'
    },
    /**
     * 落盘 + 打印 + 置退出码。**只能调一次**（重复调用直接返回首次结果）。
     * 不传 exitCode 时按 status 自动取 EXIT 表。
     */
    finish({ exitCode, extraFiles = {}, statusOverride, label } = {}) {
      if (finished) return run.status
      finished = true
      if (label) run.label = String(label)
      run.finishedAt = new Date().toISOString()
      run.executedCases = run.plannedCases.filter(matched)
      const missing = run.plannedCases.filter((p) => !matched(p))
      run.executionComplete =
        run.errors.length === 0 && (run.plannedCases.length ? missing.length === 0 : run.checks.length > 0)
      if (run.checks.length === 0) api.error('checks', '零条检查：没有任何断言被执行，不能算通过（指南 §3.1）')
      if (missing.length) {
        api.error('completeness', `计划 ${run.plannedCases.length} 个场景，实际执行 ${run.executedCases.length} 个，缺：${missing.join(' / ')}`)
      }
      run.status = statusOverride ? String(statusOverride) : api.statusOf()

      if (!outputDir) outputDir = tempOutDir(script)
      try {
        mkdirSync(outputDir, { recursive: true })
        writeFileSync(join(outputDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
        for (const [name, content] of Object.entries(extraFiles)) writeFileSync(join(outputDir, name), String(content), 'utf8')
      } catch (e) {
        // 落盘失败不改变判定语义：仍然按 status 决定退出码（宁可报错也不要静默通过）
        console.error(`[${script}] 判定结果落盘失败：${String(e.message || e)}`)
      }
      const passed = run.checks.filter((c) => c.pass).length
      console.log('')
      console.log(`  产出留档：${outputDir}`)
      console.log(
        `${run.label} ${run.status}（检查 ${passed}/${run.checks.length} 通过` +
          `${run.plannedCases.length ? `；计划 ${run.plannedCases.length} / 执行 ${run.executedCases.length}` : ''}` +
          `${run.errors.length ? `；错误 ${run.errors.length}` : ''}）`,
      )
      process.exitCode = exitCode !== undefined ? exitCode : EXIT[run.status] ?? 1
      return run.status
    },
  }
  return api
}

/**
 * 未捕获异常 / 未处理的 Promise 拒绝 → ERROR 且落盘。
 *
 * 没有这个守卫时，崩在半路的脚本既不会打印 OK（这点没问题），也**不会产出判定结果**——
 * 归档里只剩一段栈，事后无法区分"跑了一半崩了"和"压根没跑"。
 *
 * 落盘之后**强制退出**：崩掉时浏览器/连接通常还开着，事件循环不会自己空转结束，进程会一直挂着
 * （实测：verify-ui 连错误端口 → run-result.json 已写成 ERROR，但进程不退出）。判定结果用的是
 * 同步写盘，强制退出不会丢证据。
 */
export function guardCrashes(judge) {
  const onCrash = (e) => {
    judge.error('crash', e && e.stack ? String(e.stack).split('\n')[0] : String(e))
    const status = judge.finish()
    process.exit(EXIT[status] ?? 1)
  }
  process.on('uncaughtException', onCrash)
  process.on('unhandledRejection', onCrash)
}

/**
 * 把逐条打印的 `  PASS - xxx` / `  FAIL - xxx` 结论行接进判定器。
 *
 * 给 verify-ui.mjs 这种有 60 多处内联 `console.log(\`  ${ok?'PASS':'FAIL'} - …\`)` 的历史脚本用：
 * 与其改 60 处调用点（改错一处就少统计一条），不如按**实际打印出来的结论行**计数——
 * 零条结论行因此必然等价于"没有断言被执行"，而不是"全部通过"。
 */
export function tapCheckLines(judge) {
  const orig = console.log.bind(console)
  console.log = (...args) => {
    orig(...args)
    const m = /^\s{2}(PASS|FAIL) - (.+)$/.exec(String(args[0] ?? ''))
    if (m) judge.check(m[2], m[1] === 'PASS')
  }
  return () => {
    console.log = orig
  }
}
