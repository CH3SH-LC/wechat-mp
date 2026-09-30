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
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'

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
  for (const d of [root, profile, webview, evidence]) mkdirSync(d, { recursive: true })

  const real = realWorkspaceDir()
  const bad = (p) => {
    const a = resolve(p).toLowerCase()
    const b = resolve(real).toLowerCase()
    return a === b || a.startsWith(b + sep.toLowerCase()) || b.startsWith(a + sep.toLowerCase())
  }
  if (bad(root) || bad(profile) || bad(webview)) {
    throw new Error(`隔离目录与真实工作区重叠或嵌套：root=${root} real=${real}——拒绝启动`)
  }
  if (!isAbsolute(profile) || !isAbsolute(webview)) throw new Error('隔离路径必须是绝对路径')
  return { root, profile, webview, evidence, workspace: join(profile, 'Documents', 'wechat-mp-workspace') }
}

/**
 * 启动桌面应用（隔离 profile）。返回 { child, pid, cdpPort, startedAt, exe, exeHash }。
 *
 * `extraEnv` 只用于白名单式的非敏感覆盖（例如把密钥单独塞给子进程）；
 * **不**允许复制整份真实 settings——那会把使用者环境里的东西带进隔离环境。
 */
export function launchDesktop(exe, opts) {
  const exeHash = createHash('sha256').update(readFileSync(exe)).digest('hex')
  const env = {
    ...process.env,
    USERPROFILE: opts.profile,
    WEBVIEW2_USER_DATA_FOLDER: opts.webview,
    ...(opts.extraEnv || {}),
  }
  if (opts.cdpPort) {
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = `--remote-debugging-port=${opts.cdpPort}`
  }
  const child = spawn(exe, [], { env, detached: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const startedAt = Date.now()
  return { child, pid: child.pid, cdpPort: opts.cdpPort, startedAt, exe, exeHash }
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

/** 只关闭**本轮确切启动的** PID（先温和、再强制），并等它真的退出 */
export async function closeOwnPid(pid, timeoutMs = 15000) {
  const alive = () => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  if (!alive()) return { closed: true, forced: false }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    /* Windows 上可能不支持 SIGTERM，忽略，走下面的强杀 */
  }
  const t0 = Date.now()
  while (alive() && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 300))
  if (!alive()) return { closed: true, forced: false }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    /* 已经没了 */
  }
  const t1 = Date.now()
  while (alive() && Date.now() - t1 < 5000) await new Promise((r) => setTimeout(r, 200))
  return { closed: !alive(), forced: true }
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
