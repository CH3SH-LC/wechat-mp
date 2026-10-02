// desktop-harness.mjs —— 桌面真机验收的**隔离启动器**（DS 修复指南 §8.2）
//
// 为什么单独做成一个模块：真机验收最难的部分不是点按钮，而是"确保这一轮跑的**不是**使用者的
// 真实工作区"。2026-09-29 出过一次真实事故——某个子任务没设 `USERPROFILE`，直接启动了真实应用
// 跑了一个创作回合，真实工作区因此多出 3 枚素材、2 个会话被改写，消耗了真实额度且无法还原。
// 所以隔离相关的判据（路径非嵌套、进程树、启动后的 profiling 目录、空会话/空文稿）都收敛在这里，
// 由启动器统一断言；调用方拿不到"忘了设 USERPROFILE"这条路。
//
// 隔离四件套（缺一不可）：
//   1. 子进程专属 `USERPROFILE` → 应用据此拼出 `<profile>/Documents/wechat-mp-workspace`；
//   2. 子进程专属 `WEBVIEW2_USER_DATA_FOLDER` → WebView2 的 profile 与真实实例分开；
//      **注意**：只设 USERPROFILE 不够，WebView2 的 profile 仍可能落在真实用户目录下；
//      `WXMP_HOME` 更不能替代应用隔离（它只影响脚本读哪个目录，不影响应用写哪里）。
//   3. 全新空闲回环 CDP 端口；
//   4. 背景 helper 用隐藏窗口（Windows 上给 exe 传 `--window-position=-32000,-32000` 不适用，
//      这里改用 CREATE_NO_WINDOW 的等价做法：spawn 时 `windowsHide: true`）。
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'

/** 真实工作区（**只读核对用**，本模块从不往里写） */
export function realWorkspaceDir() {
  return join(homedir(), 'Documents', 'wechat-mp-workspace')
}

/** 取一个空闲回环端口（不占用历史端口，避免与别的实例撞车） */
export function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', rej)
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => res(port))
    })
  })
}

/**
 * 组装隔离目录并做**硬性断言**。
 *
 * 断言而不是"约定"：把"绝对路径解析后 ≠ 真实目录、且不嵌套在真实作品目录内"写进代码，
 * 这样调用方写错也起不来。
 */
export function prepareIsolation(tag, baseDir) {
  const root = resolve(baseDir || join(process.env.TEMP || process.env.TMP || '.', `wxmp-isolated-${tag}`))
  const profile = join(root, 'profile')
  const webview = join(root, 'webview')
  const evidence = join(root, 'evidence')

  // ⚠️ 重叠检查必须在**任何 mkdir 之前**（指南 §0.4 末段）。
  // 原顺序是先建目录再断言：一旦 `--root` 落到真实作品目录里，四个 mkdir 已经把
  // `profile/ webview/ evidence/` 建进用户的真实数据里了——断言随后抛错也来不及。
  // 一个"拒绝启动"的看门人，不该在拒绝之前先动手。
  const real = realWorkspaceDir()
  const bad = (p) => {
    const a = resolve(p).toLowerCase()
    const b = resolve(real).toLowerCase()
    return a === b || a.startsWith(b + sep.toLowerCase()) || b.startsWith(a + sep.toLowerCase())
  }
  if (bad(root) || bad(profile) || bad(webview)) {
    throw new Error(`隔离目录与真实工作区重叠或嵌套：root=${root} real=${real}——拒绝启动（本次未创建任何目录）`)
  }
  if (!isAbsolute(profile) || !isAbsolute(webview)) throw new Error('隔离路径必须是绝对路径')

  for (const d of [root, profile, webview, evidence]) mkdirSync(d, { recursive: true })
  return { root, profile, webview, evidence, workspace: join(profile, 'Documents', 'wechat-mp-workspace') }
}

/**
 * 继承环境里与 CDP / WebView2 运行时相关的覆盖。**A 对照格必须显式清掉它们**，
 * 否则"没有监听"可能只是父进程遗留的 CDP 覆盖带出来的假对照（`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`
 * 若被父进程带着，子进程也会开调试端口，"没给参数"就不成立了）。
 */
export const CDP_ENV_KEYS = [
  'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS',
  'WEBVIEW2_USER_DATA_FOLDER',
  'WEBVIEW2_BROWSER_EXECUTABLE_FOLDER',
  'WEBVIEW2_USER_DATA_DIR',
  'WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER',
  'WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER_TIMEOUT',
  'WXMP_CDP_PORT',
]

/**
 * 启动桌面应用（隔离 profile）。
 * 返回 `{ child, pid, cdpPort, startedAt, exe, exeHash, clearedCdpEnv, envOverrides }`。
 *
 * `isolateCdpEnv: true` 时先**删除**继承环境里的 CDP/runtime 覆盖（`CDP_ENV_KEYS`），供 A 对照格
 * 得到干净基线；`envOverrides` 记录本次实际生效的覆盖键（白名单，不含密钥）。
 *
 * `extraEnv` 只用于白名单式的非敏感覆盖（例如把密钥单独塞给子进程）；
 * **不**允许复制整份真实 settings——那会把使用者环境里的东西带进隔离环境。
 */
export function launchDesktop(exe, opts) {
  const exeHash = createHash('sha256').update(readFileSync(exe)).digest('hex')
  const env = { ...process.env }
  const clearedCdpEnv = []
  if (opts.isolateCdpEnv) {
    for (const k of CDP_ENV_KEYS) {
      if (Object.prototype.hasOwnProperty.call(env, k)) {
        delete env[k]
        clearedCdpEnv.push(k)
      }
    }
  }
  env.USERPROFILE = opts.profile
  env.WEBVIEW2_USER_DATA_FOLDER = opts.webview
  Object.assign(env, opts.extraEnv || {})
  if (opts.cdpPort) {
    // WXMP_CDP_PORT 是**真正生效**的那个（应用侧在 `src-tauri/src/lib.rs` 里读它，再用 Tauri 的
    // builder 把 `--remote-debugging-port` 传给 wry）。
    //
    // 关于 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS：本机 wry 0.55.1 会调用 setter 设置 options 参数，
    // 但"调用了 setter"**不能**推出"环境变量被覆盖"。微软 API 明确写明环境变量里的附加参数会
    // **追加**到 options 参数；提升权限的宿主会忽略 `WEBVIEW2_*` 环境覆盖（这一点需单独核实）。
    // 所以这里保留它只是显式入口的补充，**不要**再把"CDP 起不来"归因到"setter 覆盖了环境变量"。
    env.WXMP_CDP_PORT = String(opts.cdpPort)
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = `--remote-debugging-port=${opts.cdpPort}`
  }
  const envOverrides = {}
  for (const k of ['USERPROFILE', 'WEBVIEW2_USER_DATA_FOLDER', ...CDP_ENV_KEYS]) {
    if (k in env) envOverrides[k] = env[k]
  }
  const child = spawn(exe, [], { env, detached: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const startedAt = Date.now()
  return { child, pid: child.pid, cdpPort: opts.cdpPort, startedAt, exe, exeHash, clearedCdpEnv, envOverrides }
}

/** 等 CDP 端点可用，并核对 pages 里确实有我们的 webview */
export async function waitForCdp(cdpPort, timeoutMs = 40000) {
  const url = `http://127.0.0.1:${cdpPort}/json/list`
  const t0 = Date.now()
  for (;;) {
    try {
      const r = await fetch(url)
      const list = await r.json()
      if (Array.isArray(list) && list.length) return list
    } catch {
      /* 还没起来 */
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`CDP ${url} 在 ${timeoutMs}ms 内没有可用页面`)
    await new Promise((r) => setTimeout(r, 400))
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const alivePid = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * `tasklist` 兜底：只拿映像名（`Get-Process` 不可用时用）。取不到返回 null。
 */
export function procImageName(pid) {
  try {
    const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
    })
    const m = /^"([^"]+)"/.exec(out.trim())
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * 取一个 PID 的**进程身份**：映像名 + 完整可执行路径 + 创建时刻（epoch ms）。
 *
 * 按序尝试：
 *   1. `powershell -NoProfile -NonInteractive -Command Get-Process -Id <pid>`：
 *      能拿到 `Path`（完整路径）与 `StartTime`（创建时刻）。本机 `Get-CimInstance Win32_Process`
 *      曾返回拒绝访问，故这里**允许失败**并如实标记；
 *   2. 失败退回 `tasklist`：只有映像名，路径/创建时刻为 null（**不是**"没问题"，是 UNKNOWN）。
 *
 * 返回值 `{ ok, via, image, path, startTime, error }`；`ok:false` 表示两者都拿不到。
 */
export function probeProcessIdentity(pid, opts = {}) {
  const powershell = opts.powershell || 'powershell'
  let psError = null
  try {
    const cmd =
      `$ErrorActionPreference='Stop'; $p=Get-Process -Id ${Number(pid)}; $path=$null; $start=$null; ` +
      `try{$path=$p.Path}catch{}; ` +
      `try{$start=[long]($p.StartTime.ToUniversalTime() - [datetime]'1970-01-01T00:00:00Z').TotalMilliseconds}catch{}; ` +
      `[pscustomobject]@{image=$p.ProcessName;path=$path;start=$start}|ConvertTo-Json -Compress`
    const out = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
    })
    const j = JSON.parse(String(out).trim())
    return {
      ok: true,
      via: 'powershell',
      image: j && j.image ? String(j.image) : null,
      path: j && j.path ? String(j.path) : null,
      startTime: j && j.start != null ? Number(j.start) : null,
      error: null,
    }
  } catch (e) {
    psError = String((e && e.message) || e).split('\n')[0]
  }
  const img = procImageName(pid)
  if (img) return { ok: true, via: 'tasklist', image: img, path: null, startTime: null, error: `powershell 失败：${psError}` }
  return { ok: false, via: null, image: null, path: null, startTime: null, error: `powershell 失败：${psError}；tasklist 也取不到` }
}

/**
 * 进程身份核对（指南 §0.4 第 4 条："不能只复用数字 PID"）。
 *
 * PID 会被回收：只凭"这个数字还活着"就认为它还是我们启动的那个实例，等于把身份判断交给操作系统。
 * 这里取回该 PID 当前的**映像名 + 完整路径 + 创建时刻**，与启动时记录的身份比对：
 *   - `matchesExpected === true`：映像名一致，且（有数据的维度上）路径与创建时刻也一致；
 *   - `false`：至少一个维度**明确**不一致（映像名/路径/创建时刻不符 → PID 已被回收）；
 *   - `null`：**查不出来**（进程已退、探针不可用、没有预期映像名）——`null` **不**等于"没问题"。
 *
 * @param opts.probe  注入探针（默认 `probeProcessIdentity`），供故障注入测试
 * @param opts.alive  注入存活判定（默认 `alivePid`）
 * @param opts.expectedStartTime  启动时记录的创建时刻（epoch ms），有则参与比对
 *
 * 另返回 `identityComplete` / `missingFields`：前者只在存活、探针成功、映像名、完整路径、创建时刻
 * **全部读到**时为 true；后者列出缺项。调用方要用"齐备"而不是"映像名对不对"来决定
 * 能否关闭——只读到映像名时 `matchesExpected` 仍是 null，但 `identityComplete` 会是 false。
 */
export function procIdentity(pid, exe, opts = {}) {
  const probeFn = opts.probe || probeProcessIdentity
  const aliveFn = opts.alive || alivePid
  const expectedImage = exe ? basename(exe) : null
  const expectedPath = exe ? resolve(exe) : null
  const alive = aliveFn(pid)
  let probed = { ok: false, via: null, image: null, path: null, startTime: null, error: null }
  if (alive) {
    try {
      probed = probeFn(pid, opts) || probed
    } catch (e) {
      probed = { ok: false, via: null, image: null, path: null, startTime: null, error: String((e && e.message) || e) }
    }
  }
  const actualImage = alive && probed.ok ? probed.image : null
  const actualPath = alive && probed.ok ? probed.path : null
  const actualStartTime = alive && probed.ok ? probed.startTime : null
  const norm = (s) => String(s || '').trim().replace(/\.exe$/i, '').toLowerCase()
  const matchReasons = []
  let matchesExpected = null
  if (alive && expectedImage) {
    if (!probed.ok || !actualImage) {
      matchesExpected = null
      matchReasons.push('probe-unavailable')
    } else if (norm(expectedImage) !== norm(actualImage)) {
      matchesExpected = false
      matchReasons.push(`image-mismatch:${actualImage}!=${expectedImage}`)
    } else {
      matchesExpected = true
      // 路径：调用方给了预期路径（有 exe）就必须比到。**读不出来是 null（查不出来），不是 true**——
      // 只读到映像名（tasklist 回退）不能当"身份确认"，PID 回收恰恰要靠路径区分。
      if (expectedPath) {
        if (!actualPath) {
          matchesExpected = null
          matchReasons.push('actual-path-missing')
        } else {
          const a = resolve(String(actualPath)).toLowerCase().split('/').join('\\')
          const b = resolve(expectedPath).toLowerCase().split('/').join('\\')
          if (a !== b) {
            matchesExpected = false
            matchReasons.push('path-mismatch')
          }
        }
      }
      // 创建时刻：给了预期时刻就必须比到；同样地，读不出来是 null，不是 true。
      // 两边都没给该维度（如 verifyLaunch 只传 exe 的存活核对）时跳过，不因此变红。
      const expStart = opts.expectedStartTime != null ? Number(opts.expectedStartTime) : null
      if (matchesExpected !== false && expStart != null) {
        if (actualStartTime == null) {
          matchesExpected = null
          matchReasons.push('actual-start-time-missing')
        } else if (Math.abs(expStart - Number(actualStartTime)) > (opts.startTimeToleranceMs || 3000)) {
          matchesExpected = false
          matchReasons.push('start-time-mismatch')
        }
      }
    }
  } else if (alive && !expectedImage) {
    matchReasons.push('no-expected-image')
  }
  // 身份齐备：进程活着、探针成功，且映像名/完整路径/创建时刻三者**都真的读到了**。
  // 缺任一项就不算"已确认的身份"，只是"部分读到的推测"——不足以支撑关闭判断。
  const missingFields = []
  if (!alive) missingFields.push('alive')
  if (!probed.ok) missingFields.push('probe')
  if (actualImage == null) missingFields.push('actualImage')
  if (actualPath == null) missingFields.push('actualPath')
  if (actualStartTime == null) missingFields.push('actualStartTime')
  const identityComplete = alive === true && probed.ok === true && actualImage != null && actualPath != null && actualStartTime != null
  return {
    pid,
    expectedImage,
    expectedPath,
    actualImage,
    actualPath,
    actualStartTime,
    alive,
    /** true=身份确认；false=明确不一致；null=查不出来（**不**当作没问题） */
    matchesExpected,
    /** true 当且仅当 alive 且探针成功且映像名/路径/创建时刻三者都非 null（"身份已完整读到"） */
    identityComplete,
    /** identityComplete 为 false 时列出缺失维度：alive/probe/actualImage/actualPath/actualStartTime */
    missingFields,
    matchReasons,
    probe: { ok: Boolean(probed.ok), via: probed.via || null, error: probed.error || null },
  }
}

/**
 * 关闭**本轮确切启动的**那个 PID。两段式，且**分开报告**是哪一段起的作用（指南 §0.4 第 4 条）：
 *
 *   0. **启动身份齐备（先于任何关闭操作）**：`opts.expectedIdentity` 必须带上本轮启动时记录的
 *      三项——预期映像名、完整路径、创建时刻（epoch ms，`actualStartTime ?? expectedStartTime`）。
 *      为空或缺任一必要字段 → **零关闭操作**（`runner` 一次都不调用），返回
 *      `{ closed:false, refused:true, via:'incomplete-identity', reason, missingFields }`。
 *      为什么这么严：只读到映像名（tasklist 回退，路径/创建时刻为 null）骗得过"名字对不对"，
 *      但在 PID 被回收后完全无法区分，所以**给不齐就不许关**。
 *   1. **身份闭锁**：关闭前重新核验。`matchesExpected !== true`（false 或 null，含"查不出来"）→
 *      **零关闭操作**，返回 `{ closed:false, refused:true, reason, identity }`。也**绝不允许**用应用
 *      路径去核验 Edge，调用方必须传该进程**自己的** exe（错误的 exe → 身份不匹配 → 拒绝关闭）。
 *   2. 先走**应用自己的退出路径**：Windows 上 `taskkill /PID <n>`（**不带 `/F`**）会向该进程的
 *      顶层窗口投递 WM_CLOSE，也就是点窗口右上角关闭——app 正常收尾后自行退出。这算"正常关闭"。
 *      原来用 Node 的 `process.kill(pid,'SIGTERM')`：Windows 上**没有**对应优雅语义
 *      （越界直接 TerminateProcess），所以"方法名叫 SIGTERM"并不等于"应用正常退出"。
 *   3. 优雅路径没退成（比如应用无响应）才 `/F` 强杀，并**如实标 `forced:true`**——
 *      L5 的"正常重开"只认 `forced === false` 的那一次。**但强杀之前会再核验一次身份**：
 *      等待期内进程自己退了 → `via:'wm-close-late'`（走的仍是应用退出路径，只是慢）；
 *      身份变了（PID 被回收）→ `via:'identity-changed-before-force'` + refused，**绝不发 `/F`**。
 *
 * 只有在真正**观测到进程消失之后**才回 `closed:true`；一直没退就回 `closed:false`。
 *
 * ⚠️ "进程已不在"**不**自动等于"正常关闭"：该路径回 `via:'already-exited'` 且带
 * `exitedBeforeRequest:true`，调用方据此**必须**把它当"非正常退出路径"处理——它只能证明"现在是关闭
 * 状态"，**不能**证明走过应用自身的退出路径（例如崩溃退出、被别的进程结束都会落在这里）。
 *
 * 可注入项（供故障注入回归）：`runner`（假 killer）、`probe`（假身份探针）、`alive`（假存活判定）。
 */
export async function closeOwnPid(pid, opts = {}) {
  const gracefulMs = opts.gracefulMs != null ? opts.gracefulMs : 20000
  const forceMs = opts.forceMs != null ? opts.forceMs : 8000
  const exe = opts.exe || null
  const expectedIdentity = opts.expectedIdentity || null
  const run = opts.runner || ((args) => {
    try {
      execFileSync('taskkill', args, { encoding: 'utf8', windowsHide: true, timeout: 20000 })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e).split('\n')[0] }
    }
  })
  const aliveFn = opts.alive || alivePid
  // `typeof` 守卫让"从源码抽取该函数"的旧探针（reproduce.mjs）仍可运行：提取环境里没有这个标识符。
  const probeFn = opts.probe || (typeof probeProcessIdentity === 'function' ? probeProcessIdentity : null)
  // 启动身份的**三个必要字段**：映像名、完整路径、创建时刻（epoch ms）。
  // 命名兼容两种写法：expected*（调用方自己的记录）与 actual*（procIdentity() 的输出）。
  const lockImage = expectedIdentity ? (expectedIdentity.expectedImage != null ? expectedIdentity.expectedImage : expectedIdentity.actualImage) : null
  const lockPath = expectedIdentity ? (expectedIdentity.expectedPath != null ? expectedIdentity.expectedPath : expectedIdentity.actualPath) : null
  const lockStart = expectedIdentity ? (expectedIdentity.actualStartTime != null ? expectedIdentity.actualStartTime : expectedIdentity.expectedStartTime) : null
  const idOpts = {
    probe: probeFn,
    alive: aliveFn,
    expectedStartTime: lockStart,
  }

  // 0. 身份闭锁：任何关闭操作之前
  const before = procIdentity(pid, exe, idOpts)
  const expectedRecord = expectedIdentity || (before.expectedImage ? { pid, expectedImage: before.expectedImage, expectedPath: before.expectedPath } : null)
  if (!before.alive) {
    return {
      closed: true,
      forced: false,
      refused: false,
      exitedBeforeRequest: true,
      via: 'already-exited',
      expectedIdentity: expectedRecord,
      reverifiedIdentity: before,
      identity: before,
      note: '进程在收到关闭请求前已不在。closed=true 只表示"现在是关闭状态"，**不能**证明走过应用自身的退出路径——调用方必须按非正常退出路径处理。',
    }
  }

  // 0b. 启动身份**齐备**门槛：expectedIdentity 为空或缺任一必要字段 → 零关闭操作（runner 一次不调）。
  //   为什么单独立一条：只读到映像名（tasklist 回退）能骗过"名字对不对"，但 PID 回收后无法区分，
  //   所以不是"尽量给"，是"给不齐就不许关"。放在任何关闭动作之前，也放在比对分支之前。
  const lockMissing = []
  if (!expectedIdentity) lockMissing.push('expectedIdentity')
  else {
    if (lockImage == null) lockMissing.push('expectedImage')
    if (lockPath == null) lockMissing.push('expectedPath')
    if (lockStart == null) lockMissing.push('expectedStartTime')
  }
  if (lockMissing.length) {
    return {
      closed: false,
      forced: false,
      refused: true,
      exitedBeforeRequest: false,
      via: 'incomplete-identity',
      expectedIdentity: expectedRecord,
      reverifiedIdentity: before,
      identity: before,
      missingFields: lockMissing,
      reason: `启动身份不齐备（缺 ${lockMissing.join(',')}）——未执行任何关闭操作；调用方必须传入本轮启动时记下的 PID + 映像名 + 完整路径 + 创建时刻`,
    }
  }

  if (before.matchesExpected !== true) {
    return {
      closed: false,
      forced: false,
      refused: true,
      exitedBeforeRequest: false,
      via: 'identity-mismatch',
      expectedIdentity: expectedRecord,
      reverifiedIdentity: before,
      identity: before,
      reason: `关闭前身份核验未通过（matchesExpected=${before.matchesExpected}）：${((before.matchReasons || []).join(',')) || 'unknown'}——未执行任何关闭操作`,
    }
  }

  // 1. 正常关闭：WM_CLOSE（不带 /F）
  const g = run(['/PID', String(pid)])
  const t0 = Date.now()
  while (aliveFn(pid) && Date.now() - t0 < gracefulMs) await sleep(300)
  if (!aliveFn(pid)) {
    return {
      closed: true,
      forced: false,
      refused: false,
      exitedBeforeRequest: false,
      via: 'wm-close',
      gracefulCmd: g,
      expectedIdentity: expectedRecord,
      reverifiedIdentity: before,
      identity: before,
      afterMs: Date.now() - t0,
    }
  }

  // 1b. 强杀之前**再核验**一次身份：温和关闭等待期内 PID 可能已被回收/复用，
  //     那时这个数字已经不是我们启动的进程了，绝不能再对它发 /F。
  //     先看 alive：等待期内它自己退掉（只是退得慢）→ 走的仍是应用的退出路径，记 wm-close-late。
  const reverifiedBeforeForce = procIdentity(pid, exe, idOpts)
  if (!reverifiedBeforeForce.alive) {
    return {
      closed: true,
      forced: false,
      refused: false,
      exitedBeforeRequest: false,
      via: 'wm-close-late',
      gracefulCmd: g,
      expectedIdentity: expectedRecord,
      reverifiedBeforeForce,
      reverifiedIdentity: reverifiedBeforeForce,
      identity: reverifiedBeforeForce,
      afterMs: Date.now() - t0,
    }
  }
  if (reverifiedBeforeForce.matchesExpected !== true) {
    return {
      closed: false,
      forced: false,
      refused: true,
      exitedBeforeRequest: false,
      via: 'identity-changed-before-force',
      gracefulCmd: g,
      expectedIdentity: expectedRecord,
      reverifiedBeforeForce,
      reverifiedIdentity: reverifiedBeforeForce,
      identity: reverifiedBeforeForce,
      reason: `温和关闭等待后、强杀之前身份核验未通过（matchesExpected=${reverifiedBeforeForce.matchesExpected}）：${((reverifiedBeforeForce.matchReasons || []).join(',')) || 'unknown'}——未执行强杀`,
    }
  }

  // 2. 强杀（单独标明，不计入"正常关闭"）
  const f = run(['/PID', String(pid), '/F'])
  const t1 = Date.now()
  while (aliveFn(pid) && Date.now() - t1 < forceMs) await sleep(200)
  const stillAlive = aliveFn(pid)
  return {
    closed: !stillAlive,
    forced: true,
    refused: false,
    exitedBeforeRequest: false,
    via: 'taskkill-force',
    gracefulCmd: g,
    forceCmd: f,
    expectedIdentity: expectedRecord,
    reverifiedBeforeForce,
    reverifiedIdentity: procIdentity(pid, exe, idOpts),
    identity: procIdentity(pid, exe, idOpts),
    afterMs: Date.now() - t1,
  }
}

// ---------------------------------------------------------------------------------------------
// 诊断纯函数（CDP preflight 用；都可在无进程、无网络下做故障注入回归）
// ---------------------------------------------------------------------------------------------

/** TCP 连接错误分类：把"拒绝 / 超时 / 其它"分开，不折叠成一个 false */
export function classifyTcpError(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return 'unknown'
  const known = {
    ECONNREFUSED: 'econnrefused',
    ETIMEDOUT: 'etimedout',
    ECONNRESET: 'econnreset',
    EHOSTUNREACH: 'ehostunreach',
    ENETUNREACH: 'enetunreach',
  }
  return known[c] || `error:${c}`
}

/** HTTP 探测结果分类：区分"有响应但状态非 200 / JSON 坏 / 正常取到 JSON" */
export function classifyHttpProbe(r) {
  if (!r) return 'not-probed'
  if (!r.ok) return r.errorKind === 'timeout' ? 'http-timeout' : `http-error:${r.errorKind || 'unknown'}`
  if (r.status !== 200) return `http-status-${r.status}`
  if (r.json === null || r.json === undefined) return 'http-json-invalid'
  return 'http-json-ok'
}

/** `/json/list` 目标列表分类：非 200 / JSON 坏 / 结构不符 / 空 / 有效 */
export function classifyTargetList(r) {
  const base = classifyHttpProbe(r)
  if (base !== 'http-json-ok') return base
  if (!Array.isArray(r.json)) return 'target-list-not-array'
  if (r.json.length === 0) return 'targets-empty'
  const malformed = r.json.some((t) => !t || typeof t !== 'object' || (typeof t.id === 'undefined' && typeof t.targetId === 'undefined'))
  return malformed ? 'targets-malformed' : 'targets-valid'
}

/**
 * 采样序列归类：**以最新一次采样为准**，并把整个序列保留在调用方的记录里。
 * 这样"先空 target、后来出现有效 target"不会被历史空 target 误判成"没有 target"。
 */
export function classifySamples(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { state: 'no-samples', detail: null, sampleCount: 0, latest: null }
  const latest = rows[rows.length - 1]
  let state = 'unknown'
  let detail = null
  if (latest.listening !== true) {
    const kind = latest.tcpKind || 'unknown'
    if (kind === 'econnrefused') state = 'tcp-econnrefused'
    else if (kind === 'etimedout') state = 'tcp-etimedout'
    else {
      state = 'tcp-error-other'
      detail = kind
    }
  } else {
    const cls = classifyTargetList(latest.http && latest.http.list)
    detail = cls
    if (cls === 'targets-valid') state = 'targets-present'
    else if (cls === 'targets-empty') state = 'http-reachable-no-target'
    else if (cls === 'targets-malformed') state = 'target-structure-mismatch'
    else if (cls === 'http-json-invalid') state = 'http-json-invalid'
    else if (cls === 'target-list-not-array') state = 'target-structure-mismatch'
    else if (typeof cls === 'string' && cls.startsWith('http-status-')) state = 'http-status-non-200'
    else if (cls === 'http-timeout') state = 'http-timeout'
    else state = 'http-error-other'
  }
  return { state, detail, sampleCount: rows.length, latest }
}

/** 从若干命令行里取出实际 `--user-data-dir`（去重、去尾斜杠） */
export function extractUserDataDirs(lines) {
  const dirs = []
  for (const line of lines || []) {
    const m = /--user-data-dir=(?:"([^"]+)"|'([^']+)'|(\S+))/i.exec(String(line))
    if (m) {
      const v = m[1] || m[2] || m[3]
      if (v) dirs.push(v.replace(/[\\/]+$/, ''))
    }
  }
  return [...new Set(dirs)]
}

/**
 * 在**实际的 `--user-data-dir`**（及其子目录，最多 maxDepth 层）里找 `DevToolsActivePort`。
 * 旧实现只看外层目录，而文件通常在下一层（`EBWebView/`）里，于是"不存在"是查错层导致的假结论。
 */
export function findDevToolsActivePort(userDataDir, opts = {}) {
  const maxDepth = opts.maxDepth != null ? opts.maxDepth : 3
  const searched = []
  const found = []
  if (!userDataDir) return { ok: false, present: false, searched, found, reason: 'no userDataDir' }
  const walk = (dir, depth) => {
    if (depth > maxDepth) return
    searched.push(dir)
    let names = []
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    if (names.includes('DevToolsActivePort')) found.push(join(dir, 'DevToolsActivePort'))
    for (const n of names) {
      const abs = join(dir, n)
      try {
        if (statSync(abs).isDirectory()) walk(abs, depth + 1)
      } catch {
        /* 读不到就跳过，不把它当"没有" */
      }
    }
  }
  walk(userDataDir, 0)
  return { ok: true, present: found.length > 0, searched, found }
}

/** 目录内容的完整哈希清单（逐文件 SHA-256；目录为空则空表） */
export function hashInventory(dir) {
  const out = {}
  const walk = (d) => {
    let names = []
    try {
      names = readdirSync(d)
    } catch {
      return
    }
    for (const n of names.sort()) {
      const abs = join(d, n)
      let st
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(abs)
        continue
      }
      try {
        out[relative(dir, abs).split(sep).join('/')] = createHash('sha256').update(readFileSync(abs)).digest('hex')
      } catch {
        out[relative(dir, abs).split(sep).join('/')] = '(unreadable)'
      }
    }
  }
  walk(dir)
  return out
}

/** 两份清单的差异（新增 / 修改 / 删除的**文件名**，不打印内容） */
export function diffInventory(before, after) {
  const added = Object.keys(after).filter((k) => !(k in before))
  const removed = Object.keys(before).filter((k) => !(k in after))
  const changed = Object.keys(after).filter((k) => k in before && before[k] !== after[k])
  return { added, removed, changed }
}

export function writeJson(path, obj) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

export function exists(p) {
  return existsSync(p)
}
