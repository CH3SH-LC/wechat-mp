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
//
// 2026-10-01 补（指南 §0.2 R1）：原 `finish()` 写盘失败只打印一行错误就**保持 PASS**并 exit 0
//   （审计用"把一个普通文件当输出目录"复现：EEXIST 之后照样打印 PASS、退出码 0、目录里根本没有
//   run-result.json）。"没落盘"与"全部通过"在归档里不可区分，等于证据可以凭空消失而无人发现。
//   现在：必需附件与主判定文件都**先写、后宣告**；任一写入失败 → 计入 persist 错误 →
//   PASS/FAIL 一律降级 ERROR、退出非 0、不打印 PASS、不打印"已留档"。
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
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
 * 原子写：先写同目录临时文件，成功后再改名。
 *
 * 为什么不能直接 `writeFileSync`：写到一半失败（磁盘满、被占用）会留下**半截文件**，
 * 而半截的 `run-result.json` 解析不出来，看起来像"没跑过"，与"跑过且失败"仍然不可区分。
 * 改名是原子的：要么旧文件原样、要么新文件完整。
 *
 * ⚠️ 清理残留临时文件用的是 `unlinkSync` + `try/catch`，**不是** `fs.rmSync(p, { force: true })`：
 * 本机实测（node v24.13.0 / Windows）`rmSync` 对**不存在的路径**在某些中文长路径下会让进程
 * **原生中止**（exit 3221226505 / 0xC0000409，stderr 只到调用前一行、stdout 全丢）——
 * 在一次"写证据"里调用它，等于"失败本身把失败证据也带走了"。同一路径换成
 * `unlinkSync`（捕获 ENOENT）正常退出，见 `runner-negative-check` 的判定器写盘场景。
 */
export function writeFileAtomic(abs, text) {
  const tmp = `${abs}.tmp-${process.pid}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
  try {
    writeFileSync(tmp, String(text), 'utf8')
    renameSync(tmp, abs)
  } finally {
    try {
      unlinkSync(tmp) // 改名成功后 tmp 已不存在 → ENOENT，下面吞掉
    } catch {
      /* ENOENT（正常）或清理失败：都不影响判定，真正的失败已经由上面的异常表达 */
    }
  }
}

/**
 * 把"必需附件 + 主判定文件"落盘，**顺序固定：先附件、后主判定文件**。
 *
 * 这个顺序不是随手定的：主判定文件是唯一被签收的东西，它一旦写着 PASS，
 * 同目录缺一个必需附件也没人会再看。先写附件意味着"PASS 被写出来的那一刻，附件已经都在了"。
 *
 * `verdict(errors)` 在附件写完之后、主判定文件写出之前调用——调用方据此把已发生的
 * persist 错误并进最终判定（例如把 status 降级成 ERROR），再序列化。**不传就不会有最终判定文件。**
 *
 * ⚠️ `verdict` 会被调用**多次**（见下面的两阶段写入）。所以它必须**只根据传入的 errors 重新推导**
 * （`run.errors = base.concat(...)`），不能 `push` 追加——追加会让第二轮多出一份重复错误，
 * 判定对象也就不可重复计算了。
 *
 * ── 为什么附件要按"最终判定"再写一遍（2026-10-02 复核 R1）────────────────────────────
 * 原实现只写一次附件：`report.md` / `evidence.json` 里的 `状态：PASS` 是在**附件错误还没产生**时
 * 算出来的。独立探针从一个"全部检查通过"的假运行实测到：exit 0、`run-result.json` 写着 PASS，
 * 同目录的 `report.md` 却写着 **BLOCKED**、`evidence.json` 里连 `status` 字段都没有——
 * 同一份归档里三份文件互相打脸，而唯一被签收的那份是 PASS。
 *
 * 现在：先按当前判定写附件 → 汇总附件错误 → 若判定因此变化，**按新的判定把附件重写一遍**
 * （`report.md` 与 `evidence.json` 的可变内容全部从 run 派生，所以重写是幂等的）→ 最后才写判定文件。
 * 重写本身还会失败时，只再补一轮（有界），并把这次失败同样并进判定。
 *
 * `files` 可以是对象，也可以是 `(run) => ({ name: content })`。**任何需要与状态保持一致的附件
 * 都必须用函数形式**——对象形式的内容是调用方在调用前算好的，没法跟着判定变。
 *
 * 返回 `{ ok, dir, errors, verdictWritten, run }`；`verdictWritten=false` 表示目录里**没有**
 * 本次的判定文件（可能留着上一次的，调用方需按"过时 PASS"处理）。
 */
export function persistRunResult({ dir, files = {}, verdict }) {
  const errors = []
  const seen = new Set()
  const record = (file, e) => {
    // 去重：附件可能被重写多轮，同一个失败不该在错误清单里出现两次
    const key = `${String(file)} ${String((e && e.message) || e)}`
    if (seen.has(key)) return
    seen.add(key)
    errors.push({ file: String(file), message: String((e && e.message) || e) })
  }
  let ready = true
  try {
    mkdirSync(dir, { recursive: true })
  } catch (e) {
    // 目录都建不出来，附件必然同样失败；只报一次，不刷屏。但**仍然**要走 verdict——
    // 这正是一条必须能改变判定的失败，跳过它等于"写盘失败还是 PASS"原地复活。
    record(dir, e)
    ready = false
  }
  const writeAttachments = (run) => {
    if (!ready) return
    let obj
    try {
      obj = typeof files === 'function' ? files(run) : files
    } catch (e) {
      record('(附件)', e)
      return
    }
    for (const [name, content] of Object.entries(obj || {})) {
      try {
        writeFileAtomic(join(dir, name), content)
      } catch (e) {
        record(name, e)
      }
    }
  }
  const computeRun = () => (typeof verdict === 'function' ? verdict(errors) : verdict)
  // 最多两轮：第一轮写入；若**判定文件自己**写失败，把这次失败并进 errors 后再写一轮。
  // 少了这一轮，"判定文件写失败"就成了唯一一个不影响判定的写盘错误（原缺陷正是这么漏的）。
  let run = null
  let written = false
  for (let attempt = 0; attempt < 2 && !written; attempt++) {
    run = computeRun()
    if (run == null) break
    writeAttachments(run)
    // 附件错误可能已经改变了判定：变了就按新判定重写附件，让三份文件说的是同一件事。
    //
    // ⚠️ 必须先把**状态字符串**取出来再重算：verdict 是"就地改 run 并返回同一个对象"的写法
    // （createJudge.finish 的 recompute 就是这样），拿两个对象引用比 `next.status !== run.status`
    // 永远相等——这个"重写"会静默失效（本用例第一次跑就是这么红的）。
    const statusBefore = run.status
    run = computeRun() || run
    if (run.status !== statusBefore) {
      writeAttachments(run)
      run = computeRun() || run
    }
    // 判定文件**最后**写：它写出来的那一刻，附件已经都是按同一判定写出来的
    try {
      writeFileAtomic(join(dir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
      written = true
    } catch (e) {
      record('run-result.json', e)
    }
  }
  // 最后一轮写入失败又记了一条错误：让返回的 run 也带上它（不再写盘，只是判定对象要自洽）
  if (!written && run != null && typeof verdict === 'function') run = verdict(errors)
  return { ok: errors.length === 0, dir, errors, verdictWritten: written, run }
}

/**
 * 目录里已经有上一次运行留下的 `run-result.json`，且本次判定文件没写成时，**尽力撤销**那份过时 PASS。
 *
 * 只在"本次主判定文件确实没写成功"且"旧文件自称 PASS"时才动手，所以：
 *   · 正常路径（新目录、或本次写成功）完全不走这里；
 *   · 旧文件是 FAIL/ERROR 时不动它——它不是能被误签收的东西，删了反而丢证据。
 * 先试覆盖（留下本次的失败判定），覆盖不了就改名挪走（文件还在，只是不再叫这个名字）。
 */
function retireStalePass(dir, run) {
  const verdictPath = join(dir, 'run-result.json')
  let stale = null
  try {
    stale = JSON.parse(readFileSync(verdictPath, 'utf8'))
  } catch {
    return null
  }
  if (!stale || stale.status !== 'PASS') return null
  try {
    writeFileAtomic(verdictPath, JSON.stringify(run, null, 2) + '\n')
    return `已用本次判定（${run.status}）覆盖目录里过时的 PASS`
  } catch {
    /* 落不下去，退而求其次把它挪开 */
  }
  const moved = `${verdictPath}.stale-${Date.now().toString(36)}`
  try {
    renameSync(verdictPath, moved)
    return `落盘失败，已把过时的 PASS 改名为 ${moved}`
  } catch (e) {
    return `落盘失败，且无法撤销目录里过时的 PASS（${String((e && e.message) || e)}）——该 PASS 不是本次结果，不要签收`
  }
}

/**
 * 创建唯一判定结果对象。
 *
 * @param script  脚本名（写进 run-result.json，便于负向回归与归档检索）
 * @param outDir  证据目录；不传则用一个新的系统临时目录
 * @param plannedCases 计划场景的前缀列表（按 `check()` 的 id 前缀匹配判定"执行到了没有"）。
 *                     计划里某个场景一条检查都没出现 → 执行不完整 → ERROR（不是跳过、不是通过）。
 * @param minChecks 必需检查条数的**下界**。给"没有可分场景前缀"的 runner 用：不写这个时，
 *                  一条检查也算执行完整（`checks.length > 0`），"98 条里只跑了 3 条"照样 PASS。
 *                  填了就必须至少这么多条，否则 ERROR。值应取实测的当前条数，删掉一条检查时
 *                  会立刻变红——这是**故意**的：检查被静默删掉正是它要防的事。
 */
export function createJudge({ script, outDir, plannedCases = [], minChecks = 0, label, extra = {} }) {
  const run = {
    script,
    label: label || script.toUpperCase(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'BLOCKED', // PASS | FAIL | ERROR | BLOCKED
    executionComplete: false,
    plannedCases: [...plannedCases],
    minChecks: Number(minChecks) || 0,
    executedCases: [],
    checks: [], // { id, pass, evidence[] }
    errors: [], // { stage, message }
    observations: [], // { id, detail } —— 只记录，不参与判定
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
    /** 记一条观测（不参与判定，只进归档） */
    observe(id, detail) {
      run.observations.push({ id: String(id), detail: String(detail) })
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
      if (run.minChecks && run.checks.length < run.minChecks) return 'ERROR'
      return run.checks.some((c) => !c.pass) ? 'FAIL' : 'PASS'
    },
    /**
     * 落盘 + 打印 + 置退出码。**只能调一次**；重复调用不重算、不重写，只把退出码再钉一遍
     * （否则一次失败的运行被后面某个 `finish()` 再调一次就可能翻绿）。
     * 不传 exitCode 时按 status 自动取 EXIT 表；**落盘失败时忽略传入的 exitCode**，一律非 0。
     */
    finish({ exitCode, extraFiles = {}, statusOverride, label } = {}) {
      if (finished) {
        process.exitCode = EXIT[run.status] ?? 1
        return run.status
      }
      finished = true
      if (label) run.label = String(label)
      run.finishedAt = new Date().toISOString()
      run.executedCases = run.plannedCases.filter(matched)
      const missing = run.plannedCases.filter((p) => !matched(p))
      run.executionComplete =
        run.errors.length === 0 && (run.plannedCases.length ? missing.length === 0 : run.checks.length > 0)
      if (run.checks.length === 0) api.error('checks', '零条检查：没有任何断言被执行，不能算通过（指南 §3.1）')
      if (run.minChecks && run.checks.length < run.minChecks) {
        api.error('completeness', `计划至少 ${run.minChecks} 条必需检查，实际只有 ${run.checks.length} 条——执行不完整，不能算通过`)
      }
      if (missing.length) {
        api.error('completeness', `计划 ${run.plannedCases.length} 个场景，实际执行 ${run.executedCases.length} 个，缺：${missing.join(' / ')}`)
      }
      run.status = statusOverride ? String(statusOverride) : api.statusOf()

      if (!outputDir) outputDir = tempOutDir(script)

      // 判定文件写出前把落盘失败并进判定；`baseErrors` 让这个推导**可重复**（persist 会回调两次）
      const baseErrors = run.errors.slice()
      const recompute = (errors) => {
        run.errors = baseErrors.concat(
          errors.map((e) => ({ stage: 'persist', message: `写 ${e.file} 失败：${e.message}` })),
        )
        const computed = statusOverride ? String(statusOverride) : api.statusOf()
        // BLOCKED 保留（它本来就不是"通过"，退出码也是非 0）；PASS/FAIL 一律降级 ERROR
        run.status = errors.length && computed !== 'BLOCKED' ? 'ERROR' : computed
        return run
      }
      let persist
      try {
        persist = persistRunResult({ dir: outputDir, files: extraFiles, verdict: recompute })
      } catch (e) {
        const msg = String((e && e.message) || e)
        recompute([{ file: '(未知)', message: msg }])
        persist = { ok: false, dir: outputDir, errors: [{ file: '(未知)', message: msg }], verdictWritten: false }
      }

      if (!persist.verdictWritten) {
        // 本次判定文件没写出去：目录里可能还留着上一次的 PASS，而它**不是**本次结果
        const retired = retireStalePass(persist.dir, run)
        if (retired) api.observe(`过时判定：${retired}`)
      }

      const passed = run.checks.filter((c) => c.pass).length
      console.log('')
      if (persist.ok) {
        console.log(`  产出留档：${persist.dir}`)
      } else {
        // 说清楚"哪些文件没写出去"，并且**不打印**"产出留档"——它不是一句可以照说的客气话
        console.error(`[${script}] 判定结果没有完整落盘（目标目录：${persist.dir}）：`)
        for (const e of persist.errors) console.error(`  · ${e.file}：${e.message}`)
        console.error('  上面这些文件没有写成功，归档里不会有它们——本次结果不可按"已留档"签收。')
      }
      console.log(
        `${run.label} ${run.status}（检查 ${passed}/${run.checks.length} 通过` +
          `${run.plannedCases.length ? `；计划 ${run.plannedCases.length} / 执行 ${run.executedCases.length}` : ''}` +
          `${run.errors.length ? `；错误 ${run.errors.length}` : ''}）`,
      )
      // 落盘失败时**不认**调用方传的 exitCode：失败就是失败，不能被一个乐观的常量盖过去
      process.exitCode = persist.ok && exitCode !== undefined ? exitCode : EXIT[run.status] ?? 1
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
