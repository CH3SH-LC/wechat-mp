// ipc-gate-check.mjs —— 页面侧「派发前预算门禁」的**离线**验收（DS 修复指南 §0.0 A）
//
// 测的是 `scripts/lib/ipc-gate.mjs` 的**生产源码**：把它连同**本机真实锁定的 tauri IPC 协议源码**
// 一起放进一个 `node:vm` 沙箱里跑，所有传输都是本地假通道（不联网、不起浏览器、不启动应用、
// 不读密钥、不调用模型）。
//
// 为什么必须用真实协议源码：这次的缺口不是"我们代码写错了"，而是**协议在任意一次 IPC 失败后会
// 把此后所有命令切到 `window.ipc.postMessage`**——那条通道 wry 冻成了
// `Object.freeze({postMessage: …})`，页面侧拦不住。用我们自己的模型去测，就测不出这件事。
// 所以协议源码从 Cargo registry 里按 `Cargo.lock` 锁定的版本现取；取不到就 BLOCKED，不伪造。
//
// 判定：唯一 RunResult（指南 §3.1）。零检查 / 异常 = ERROR，退出非 0。

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { PAID_COMMANDS, createBudget } from './lib/dispatch-budget.mjs'
import { gateCoverageProven, installProbeSource } from './lib/ipc-gate.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..')

const judge = createJudge({
  script: 'ipc-gate-check',
  outDir: resolveOutDir('ipc-gate-check'),
  plannedCases: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'],
  minChecks: 45,
})
guardCrashes(judge)
let failed = 0
const check = (id, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${id}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(id, ok, extra)
  if (!ok) failed++
}
const observe = (id, detail) => judge.observe(id, detail)

// =====================================================================================
// 0. 取本机真实锁定的 tauri IPC 协议源码（取不到就 BLOCKED，不用模型代替）
// =====================================================================================

function lockedTauriVersion() {
  const lock = readFileSync(join(repoRoot, 'src-tauri', 'Cargo.lock'), 'utf8')
  for (const block of lock.split('[[package]]')) {
    const name = /^\s*name = "([^"]+)"/m.exec(block)
    const ver = /^\s*version = "([^"]+)"/m.exec(block)
    if (name && name[1] === 'tauri' && ver) return ver[1]
  }
  return null
}

function findIpcProtocol(version) {
  const cargoHome = process.env.CARGO_HOME || join(homedir(), '.cargo')
  const srcRoot = join(cargoHome, 'registry', 'src')
  if (!existsSync(srcRoot)) return { ok: false, reason: `没有 ${srcRoot}` }
  const tried = []
  for (const dir of readdirSync(srcRoot)) {
    const p = join(srcRoot, dir, `tauri-${version}`, 'scripts', 'ipc-protocol.js')
    tried.push(p)
    if (existsSync(p)) return { ok: true, path: p }
  }
  return { ok: false, reason: `在 ${srcRoot} 下没找到 tauri-${version}/scripts/ipc-protocol.js；试过：${tried.join(' | ')}` }
}

const tauriVersion = lockedTauriVersion()
const proto = tauriVersion ? findIpcProtocol(tauriVersion) : { ok: false, reason: 'Cargo.lock 里没找到 tauri 版本' }
if (!proto.ok) {
  judge.block(`无法取得本机锁定的 tauri IPC 协议源码：${proto.reason}`)
  console.log(`[ipc-gate-check] BLOCKED：${proto.reason}`)
  judge.finish({ label: 'IPC-GATE' })
} else {
  const rawProtocol = readFileSync(proto.path, 'utf8')
  const protocolSha = createHash('sha256').update(rawProtocol).digest('hex')
  console.log(`\n[0. 真实协议源码] tauri ${tauriVersion}：${proto.path}\n  sha256=${protocolSha}`)
  observe('协议源码', `${proto.path}（tauri ${tauriVersion}，sha256=${protocolSha}）`)

  // 构建期模板占位符（Rust 侧替换）：这里只填能跑的最小等价物，
  // 序列化细节与本轮要测的"切不切通道"无关。
  const protocolSrc = rawProtocol
    .replace('__TEMPLATE_invoke_key__', '"ipc-gate-check-key"')
    .replace('__RAW_process_ipc_message_fn__', 'function (payload) { return { contentType: "application/json", data: JSON.stringify(payload) } }')
    .replace('__TEMPLATE_os_name__', '"windows"')
    .replace('__TEMPLATE_fetch_channel_data_command__', '"__tauri_channel_data"')

  // ── 沙箱：一个最小的"页面 + 宿主"替身 ──────────────────────────────────────────────
  /**
   * @param mode      假后端的行为：'ok' | 'fetch-reject' | 'json-invalid' | 'body-reject'
   * @param reserve   `window.__acceptanceReserve` 的实现（宿主侧预算）
   */
  function makePage({ mode = 'ok', reserve, probeSource = installProbeSource } = {}) {
    const t = { total: 0, paid: 0, post: 0, postCmds: [], callCmds: [], mode, special: null }
    const sandbox = {}
    sandbox.window = sandbox
    sandbox.console = { warn() {}, log() {}, error() {}, info() {} }
    sandbox.Response = Response
    sandbox.Headers = Headers
    sandbox.TextDecoder = TextDecoder
    sandbox.setTimeout = setTimeout
    sandbox.clearTimeout = clearTimeout
    vm.createContext(sandbox)

    // 假后端：只有"真的到达后端"才计数（fetch 直接 reject 的那次没有到达，不计）。
    sandbox.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || ''
      const m = /\/\/([^\/]+)\/([^\/?#]+)/.exec(url)
      const cmd = m && m[1] === 'ipc.localhost' ? decodeURIComponent(m[2]) : null
      t.callCmds.push(cmd)
      const cur = t.mode
      if (cur === 'fetch-reject') return Promise.reject(new Error('模拟自定义协议 fetch 失败'))
      t.total += 1
      if (cmd && Object.prototype.hasOwnProperty.call(PAID_COMMANDS, cmd)) t.paid += 1
      if (cur === 'json-invalid') {
        return Promise.resolve(
          new Response('这不是合法 JSON', { status: 200, headers: { 'Tauri-Response': 'ok', 'content-type': 'application/json' } }),
        )
      }
      if (cur === 'body-reject') {
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          arrayBuffer: () => Promise.reject(new Error('模拟响应体读取失败')),
        })
      }
      // 「特殊状态响应」注入（一次性）：**空体** + `application/json` + `Tauri-Response: ok`。
      // 这是 2026-10-02 复核复现缺口 A 用的那一条（它对非付费命令注入）。
      // 真实协议不看 status、只看 content-type，于是空体 json() 抛错 → 永久切 postMessage。
      if (t.special) {
        const s = t.special
        t.special = null
        return Promise.resolve(new Response(null, { status: s.status, headers: { 'Tauri-Response': 'ok', 'content-type': 'application/json' } }))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, cmd }), {
          status: 200,
          headers: { 'Tauri-Response': 'ok', 'content-type': 'application/json' },
        }),
      )
    }

    const callbacks = new Map()
    let seq = 1000
    // `window.ipc.postMessage`：按 wry 0.55.1 的真实形状**冻死**（不可写、不可配置）。
    // 这条通道上的付费命令会**真的**到达后端，却完全绕过门禁——这正是本轮要防的事。
    // 回执也在这里模拟：真实实现由 Rust 侧回调 `runCallback`，这里直接兑现，好让 invoke 能 settle。
    Object.defineProperty(sandbox, 'ipc', {
      value: Object.freeze({
        postMessage: (data) => {
          t.post += 1
          let j = null
          try {
            j = JSON.parse(String(data))
          } catch {
            t.postCmds.push(null)
            return
          }
          t.postCmds.push(j && j.cmd ? j.cmd : null)
          if (j && Object.prototype.hasOwnProperty.call(PAID_COMMANDS, String(j.cmd))) t.paid += 1
          const f = j && callbacks.get(j.callback)
          if (f) f({ ok: true, via: 'postMessage', cmd: j.cmd })
        },
      }),
    })

    const internals = {
      convertFileSrc: (cmd) => `http://ipc.localhost/${cmd}`,
      runCallback: (id, data) => {
        const f = callbacks.get(id)
        if (f) f(data)
      },
    }
    sandbox.__TAURI_INTERNALS__ = internals
    vm.runInContext(protocolSrc, sandbox, { filename: proto.path })
    // `invoke` 由 Rust 侧初始化脚本定义；这里给一个最小等价物（回调 id 的分配方式不影响本组结论）。
    internals.invoke = (cmd, args) =>
      new Promise((res, rej) => {
        const cb = ++seq
        const er = ++seq
        callbacks.set(cb, res)
        callbacks.set(er, rej)
        internals.postMessage({ cmd, callback: cb, error: er, payload: args, options: {} })
      })

    sandbox.__acceptanceReserve = reserve || (() => ({ ok: true, paid: false, kind: null }))

    // 统一吞掉 IPC 错误：拒绝/故障都是**预期**结果，不能让未处理拒绝把整份判定带走。
    const invoke = (cmd, args) =>
      internals.invoke(cmd, args).then(
        (v) => ({ ok: true, value: v }),
        (e) => ({ ok: false, error: String((e && e.message) || e) }),
      )

    const run = (args) => vm.runInContext(`(function () { return new Function("arg", ${JSON.stringify(probeSource)}); })()`, sandbox)(args)
    return { sandbox, t, install: () => run(null), internals, invoke }
  }

  const budgetFor = ({ maxDispatches = 0, maxGenSvg = 0, phaseMaxDispatches = null, phaseMaxGenSvg = null }) => {
    const dir = mkdtempSync(join(tmpdir(), 'wxmp-ipc-gate-'))
    const b = createBudget({
      ledgerPath: join(dir, 'global.json'),
      maxDispatches,
      maxGenSvg,
      phaseMaxDispatches,
      phaseMaxGenSvg,
      // 本脚本测的是门禁与预算的接线；phase 生命周期屏障由 budget-check ⑬ 组单独覆盖。
      requirePhaseOpen: false,
    })
    b.open()
    return b
  }
  const reserveWith = (budget) => (cmd) => budget.reserve(cmd)

  // =====================================================================================
  console.log('\n[① 正常 IPC：额度 1，两次请求只放行一次]')
  {
    const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 1, maxGenSvg: 1 })) })
    const installed = await page.install()
    check('① 探针装上了，且**覆盖率自证通过**（那条 list_documents 经过了受控 fetch）', gateCoverageProven(installed), JSON.stringify(installed && installed.coverage))
    await page.invoke('prep_turn', {})
    await page.invoke('chat_stream', {})
    check('① 假后端付费传输**恰 1 次**（额度 1 不能放行 2 次）', page.t.paid === 1, `paid=${page.t.paid} total=${page.t.total} calls=${JSON.stringify(page.t.callCmds)}`)
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('① 被拒的那一次留下了明确理由（不是静默丢弃）', probe.refused.length === 1 && /上限|额度/.test(probe.refused[0].reason), JSON.stringify(probe.refused))
    check('① 拒绝**没有**把协议推进回退通道', page.t.post === 0, `post=${page.t.post}`)
  }

  console.log('\n[② 额度 0：付费传输为 0，且拒绝走协议合法的错误响应]')
  {
    const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 0, maxGenSvg: 0 })) })
    await page.install()
    await page.invoke('prep_turn', {})
    await page.invoke('gen_svg', {})
    check('② 额度 0 时假后端付费传输为 0', page.t.paid === 0, `paid=${page.t.paid}`)
    check('② 也没有从 postMessage 通道漏出去', page.t.post === 0, `post=${page.t.post}`)
    observe('② 反例对照', '2026-10-02 晚间实测的旧形状：同场景下非付费 IPC 先失败 → 协议切通道 → prep_turn/gen_svg 经 postMessage 到达假后端，假付费传输 2 次。见 ③/⑥。')
  }

  console.log('\n[③ 非付费 IPC 的 fetch 失败：门禁把它转成错误响应，协议**不切通道**]')
  {
    const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 0, maxGenSvg: 0 })) })
    await page.install()
    // 这就是原反例的第一步：任一条非付费命令的 fetch 失败，会把协议推进回退通道。
    page.t.mode = 'fetch-reject'
    await page.invoke('list_documents', {})
    page.t.mode = 'ok'
    await page.invoke('prep_turn', {})
    await page.invoke('gen_svg', {})
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('③ 失败被如实记下来（不是悄悄吞掉）', probe.customProtocolFailures.length >= 1, JSON.stringify(probe.customProtocolFailures.slice(0, 2)))
    check('③ 额度 0 时付费传输仍为 0（**没有**经 postMessage 漏出去）', page.t.paid === 0 && page.t.post === 0, `paid=${page.t.paid} post=${page.t.post}`)
    check('③ 后续付费命令仍在门禁链路上（探针看得到它们）', probe.calls.filter((c) => c.cmd === 'prep_turn' || c.cmd === 'gen_svg').length === 2, JSON.stringify(probe.calls.map((c) => c.cmd)))
  }

  console.log('\n[④ 响应解码失败：同样不切通道]')
  {
    for (const mode of ['json-invalid', 'body-reject']) {
      const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 0, maxGenSvg: 0 })) })
      await page.install()
      page.t.mode = mode
      await page.invoke('list_documents', {})
      page.t.mode = 'ok'
      await page.invoke('prep_turn', {})
      const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
      check(`④ ${mode}：解码失败被记下并阻止切通道`, probe.decodeFailures.length >= 1 && page.t.post === 0, `decodeFailures=${JSON.stringify(probe.decodeFailures.slice(0, 1))} post=${page.t.post}`)
      check(`④ ${mode}：额度 0 时付费传输为 0`, page.t.paid === 0, `paid=${page.t.paid}`)
    }
  }

  console.log('\n[⑤ 宿主预留 Promise reject：转成错误响应，不触发回退]')
  {
    const page = makePage({
      reserve: (cmd) => {
        if (cmd === 'prep_turn') throw new Error('模拟宿主绑定故障')
        return { ok: false, paid: true, kind: 'text', reason: '额度不足（模拟）' }
      },
    })
    await page.install()
    await page.invoke('prep_turn', {})
    await page.invoke('gen_svg', {})
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('⑤ 宿主预留异常被记下（含"宿主预留异常"字样）', probe.refused.some((r) => /宿主预留异常/.test(String(r.reason))), JSON.stringify(probe.refused.slice(0, 2)))
    check('⑤ 付费传输为 0，且没有从 postMessage 漏出去', page.t.paid === 0 && page.t.post === 0, `paid=${page.t.paid} post=${page.t.post}`)
    check('⑤ 后续请求仍在门禁链路上（协议没被推进回退）', probe.calls.some((c) => c.cmd === 'gen_svg'), JSON.stringify(probe.calls.map((c) => c.cmd)))
  }

  console.log('\n[⑥ 回退在安装之前就已激活：覆盖率探针必须检出，驱动据此零派发]')
  {
    // 先让协议**自己**把回退激活：不给门禁，直接打一次失败的 invoke。
    const page = makePage({ reserve: () => ({ ok: true, paid: false, kind: null }) })
    page.t.mode = 'fetch-reject'
    await page.invoke('list_documents', {}) // 协议**自己**把回退激活（这正是原反例的第一步）
    page.t.mode = 'ok'
    check('⑥ 前置条件成立：协议确实已经改走 postMessage', page.t.post >= 1 && page.t.postCmds.includes('list_documents'), `post=${page.t.post} postCmds=${JSON.stringify(page.t.postCmds)}`)
    const postBefore = page.t.post
    const paidBefore = page.t.paid
    const installed = await page.install()
    check('⑥ 覆盖率自证**没有**通过（付费命令已不经过本合同覆盖的 fetch）', installed.ok === true && gateCoverageProven(installed) === false, JSON.stringify(installed.coverage))
    // 对照：这时候如果照发不误，付费请求会经 postMessage 直达后端——一次都拦不住。
    await page.invoke('chat_stream', {})
    check('⑥ 对照：不检查覆盖率就会绕过去（经 postMessage 到达假后端）', page.t.paid - paidBefore === 1, `paid=${page.t.paid} postCmds=${JSON.stringify(page.t.postCmds)}`)
    check('⑥ 对照：那条付费请求确实走了 postMessage 通道', page.t.post - postBefore === 2 && page.t.postCmds.includes('chat_stream'), `post=${page.t.post - postBefore} postCmds=${JSON.stringify(page.t.postCmds)}`)
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('⑥ 而门禁侧**完全没有看到**这次付费请求（transport 仍是 0）', probe.transport === 0, `transport=${probe.transport}`)
    // 驱动侧的决定：覆盖率未获证 → 拒绝开测（`openAppOnce` 里就是这么写的，下方结构断言再钉一次）。
    const wouldSend = gateCoverageProven(installed)
    check('⑥ 驱动按覆盖率判定 → 拒绝发送（本 phase 付费传输 0）', wouldSend === false, `wouldSend=${wouldSend}`)
  }

  console.log('\n[⑦ 拦截函数脱落：重装必须核对当前函数身份，且派发前再核一次]')
  {
    const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 0, maxGenSvg: 0 })) })
    const savedFetch = page.sandbox.fetch
    const first = await page.install()
    check('⑦ 首次安装：覆盖率获证', gateCoverageProven(first), JSON.stringify(first.coverage))
    // 把拦截函数换回去（旧实现只看到旧标记还在，就回 ok/reused —— 这正是晚间的反例）
    page.sandbox.fetch = savedFetch
    const again = await page.install()
    check('⑦ 重装不再盲信旧标记：识别出拦截函数已脱落并重新包装', again.ok === true && gateCoverageProven(again), JSON.stringify(again.coverage))
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('⑦ 重装后门禁身份与当前 window.fetch 一致', probe.gate.wrappedFetch === page.sandbox.fetch, '')
    check('⑦ 重装没有把自己套两层（reWrap 计数为 1）', probe.rewrapCount === 1, `rewrapCount=${probe.rewrapCount}`)
    await page.invoke('chat_stream', {})
    check('⑦ 额度 0 时付费传输为 0', page.t.paid === 0, `paid=${page.t.paid}`)
  }

  console.log('\n[⑧ L5/L6 形状：本回合中止线为 0，一次模型派发都不许有]')
  {
    const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 20, maxGenSvg: 4, phaseMaxDispatches: 0, phaseMaxGenSvg: 0 })) })
    await page.install()
    for (const cmd of ['prep_turn', 'chat_stream', 'gen_svg', 'refine_brief', 'review_assets']) await page.invoke(cmd, {})
    check('⑧ 中止线 0 → 五条付费命令一条都没发出去', page.t.paid === 0, `paid=${page.t.paid} calls=${JSON.stringify(page.t.callCmds)}`)
    check('⑧ 也没有从 postMessage 漏出去', page.t.post === 0, `post=${page.t.post}`)
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('⑧ 五条都被记录为"被拒"（看得见，不是静默）', probe.refused.length === 5, `refused=${probe.refused.length}`)
    check('⑧ 被拒理由是"本回合中止线"', probe.refused.every((r) => /本回合/.test(String(r.reason))), JSON.stringify(probe.refused.map((r) => r.reason)))
  }

  console.log('\n[⑨ 特殊状态响应（204/205/304 + application/json）：按协议真实解码判定，不能让协议切通道]')
  {
    // 2026-10-02 复核反例 A 的原文（见 docs/artifacts/2026-10-02-readiness-review/budget/README.md「剩余反例 A」）：
    //   旧门禁对 204/205/304 **直接** `new Response(null, {status, headers})` 返回、跳过 JSON 校验；
    //   而锁定协议 `tauri-2.11.5/scripts/ipc-protocol.js:42-53` **不按 status 跳过** `response.json()`，
    //   于是空体解析抛错 → `customProtocolIpcFailed = true` → 此后所有命令改走 `window.ipc.postMessage`
    //   （wry 冻死、页面侧拦不住）→ 额度 0 下 prep_turn / gen_svg 各到达假后端 1 次。
    // 用例顺序刻意复刻复核探针：先正常 200 装起来（覆盖率获证）→ 注入特殊响应 → 重装 → 再尝试付费。
    for (const status of [204, 205, 304]) {
      const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 0, maxGenSvg: 0 })) })
      const first = await page.install()
      check(`⑨ 前置（${status}）：正常响应下覆盖率获证——反例必须建立在这个起点上`, gateCoverageProven(first), JSON.stringify(first.coverage))
      page.t.special = { status }
      await page.invoke('list_documents', {})
      const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
      check(`⑨ ${status}+application/json：判为解码不安全并如实记下（不是静默跳过）`, probe.decodeFailures.length >= 1, JSON.stringify(probe.decodeFailures.slice(0, 1)))
      check(`⑨ ${status}：本回合停发（fallbackLatched）并说明原因`, probe.fallbackLatched === true && /解码/.test(String(probe.fallbackReason)), String(probe.fallbackReason))
      check(`⑨ ${status}：协议**没有**被推进回退通道（postMessage 一次都没有）`, page.t.post === 0, `post=${page.t.post}`)
      // 回合前重装（复用路径）→ 再尝试两条付费命令
      const again = await page.install()
      check(`⑨ ${status}：重装走复用路径且覆盖率仍当场自证`, again.ok === true && again.coverage && again.coverage.reused === true && gateCoverageProven(again), JSON.stringify(again.coverage))
      await page.invoke('prep_turn', {})
      await page.invoke('gen_svg', {})
      check(`⑨ ${status}：额度 0 时假后端付费传输为 0`, page.t.paid === 0, `paid=${page.t.paid}`)
      check(`⑨ ${status}：也没有从 postMessage 漏出去（复核反例实测是 2 次）`, page.t.post === 0, `post=${page.t.post} postCmds=${JSON.stringify(page.t.postCmds)}`)
    }

    // 对照：把旧形状（按 status 短路）原样塞回生产源码，必须当场变红——否则上面那些 PASS 说明不了问题。
    const legacySource = installProbeSource.replace(
      '    return res.arrayBuffer().then(function (buf) {',
      '    if (res.status === 204 || res.status === 205 || res.status === 304) { return new Response(null, { status: res.status, headers: res.headers }); }\n    return res.arrayBuffer().then(function (buf) {',
    )
    check('⑨ 对照夹具确实注入成功了（否则下面的"红"不能算数）', legacySource !== installProbeSource, '')
    const legacy = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 0, maxGenSvg: 0 })), probeSource: legacySource })
    const legacyFirst = await legacy.install()
    check('⑨ 旧形状对照：正常响应下覆盖率同样获证（红不是环境差异造成的）', gateCoverageProven(legacyFirst), '')
    legacy.t.special = { status: 204 }
    await legacy.invoke('list_documents', {})
    await legacy.invoke('prep_turn', {})
    await legacy.invoke('gen_svg', {})
    check('⑨ 旧形状对照：额度 0 却经 postMessage 到达假后端（≥2 次付费）——这就是被修掉的反例', legacy.t.paid >= 2 && legacy.t.post >= 2, `paid=${legacy.t.paid} post=${legacy.t.post} postCmds=${JSON.stringify(legacy.t.postCmds)}`)
  }

  console.log('\n[⑩ 复用必须重新自证覆盖率：不能拿上一次安装的结论证明这一回合]')
  {
    // 复核反例原文：「回合前重装仍返回 ok=true/reused=true/coverageProven=true」。
    // 复用能省的只有"重新包装 window.fetch"，**省不掉**"通道现在还通不通"这件事的验证。
    const page = makePage({ reserve: reserveWith(budgetFor({ maxDispatches: 1, maxGenSvg: 0 })) })
    const first = await page.install()
    const listAfterFirst = page.t.callCmds.filter((c) => c === 'list_documents').length
    const again = await page.install()
    const listAfterSecond = page.t.callCmds.filter((c) => c === 'list_documents').length
    const probe = vm.runInContext('window.__acceptanceProbe', page.sandbox)
    check('⑩ 第二次安装确实走复用路径（reused=true）', again.reused === true, JSON.stringify({ reused: again.reused }))
    check('⑩ 复用时**没有**再套一层包装（rewrapCount 仍为 0）', probe.rewrapCount === 0, `rewrapCount=${probe.rewrapCount}`)
    check('⑩ 复用**也重发了那条非付费自证命令**（不是直接回上次的结论）', listAfterSecond === listAfterFirst + 1, `第一次安装后 ${listAfterFirst} 次，第二次安装后 ${listAfterSecond} 次`)
    check('⑩ 返回的是**新**一份覆盖率记录（before 推进、时间戳不早于上次）', again.coverage.before > first.coverage.before && again.coverage.at >= first.coverage.at, `${JSON.stringify({ first: first.coverage, again: again.coverage })}`)
    check('⑩ 两次自证命令都不占额度（此刻付费传输仍为 0）', page.t.paid === 0, `paid=${page.t.paid}`)
    await page.invoke('prep_turn', {})
    await page.invoke('chat_stream', {})
    check('⑩ 复用后门禁仍真的在拦：额度 1，两条付费只放行 1 条', page.t.paid === 1, `paid=${page.t.paid}`)
    check('⑩ 被拒的那条留下了理由（不是静默丢弃）', probe.refused.length === 1 && /上限|额度/.test(String(probe.refused[0].reason)), JSON.stringify(probe.refused))
  }

  console.log('\n[结构断言：live-acceptance 必须接住"覆盖率未获证"这条判定]')
  {
    const src = readFileSync(join(repoRoot, 'scripts', 'live-acceptance.mjs'), 'utf8')
    check('live-acceptance 用模块化的门禁源码（不再自己内嵌一份）', src.includes("from './lib/ipc-gate.mjs'") && !src.includes('var wrappedFetch = function'), '应 import installProbeSource')
    check('live-acceptance 在 openAppOnce 里按覆盖率拒绝开测', /gateCoverageProven\(probeInstalled\)/.test(src) && /门禁覆盖率未获证明/.test(src), '')
    check('live-acceptance 在回合开始前也要求覆盖率获证', /gateCoverageProven\(ensured\)/.test(src), '')
    check('live-acceptance 监控"回合中途门禁失效/回退激活"并停手', /s\.gateLive === false \|\| s\.fallbackLatched === true/.test(src), '')
    check('探针 readRun 会回传门禁健康度（gateLive / fallbackLatched）', /gateLive:/.test(src) && /fallbackLatched:/.test(src), '')
  }
}

console.log('')
if (failed) console.log(`（其中 ${failed} 条断言未通过，最终判定见下方统一结果行）`)
judge.finish({ label: 'IPC-GATE' })
