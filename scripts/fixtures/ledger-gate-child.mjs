// ledger-gate-child.mjs —— 「下一个进程」的替身，供 `scripts/ledger-finalize-check.mjs` 以
// **真正的新子进程**调用（不是同进程里 new 一个实例）。
//
// 为什么必须真的是新进程：2026-10-02 复核明确指出，同进程新实例只能证明"盘上持久状态与检查接线
// 有缺口"，而本轮要封住的是"下一个进程读旧账本会不会直接继续花钱"——那件事的边界就是进程边界。
//
// 它做的事与 `live-acceptance.mjs::main()` 启动阶段**同一套生产门槛**（同一个
// `preflightLedgerGate()`），随后走真实的 `beginPhase` → `reserve` → `closePhase`：
// 只要门槛没把它拦下，它就会**真的预留一次**（`transported=1`）——这就是"假传输"计数。
//
// 用法：node scripts/fixtures/ledger-gate-child.mjs <ledgerPath> [--resume "<理由>"]
// 输出：一行 JSON（stdout），字段见下方 out。
import { readFileSync } from 'node:fs'
import { createBudget } from '../lib/dispatch-budget.mjs'
import { preflightLedgerGate } from '../lib/ledger-finalize.mjs'

const [ledgerPath, ...rest] = process.argv.slice(2)
const ri = rest.indexOf('--resume')
const resume = ri >= 0 && rest[ri + 1] ? rest[ri + 1] : null

const out = {
  pid: process.pid,
  ledgerPath,
  resume,
  opened: false,
  openReason: null,
  unresolved: null,
  priorFailure: null,
  gateBlock: null,
  phaseOpened: false,
  transported: 0,
  reserveReason: null,
  totals: null,
}

const budget = createBudget({ ledgerPath })
const opened = budget.open()
out.opened = opened.ok === true
out.openReason = opened.reason || null

if (out.opened) {
  // 与生产 main() 同序：先看未闭合 phase，闭合/解除之后再看业务失败标记。
  let gate = preflightLedgerGate({ budget, needsPaid: true })
  out.unresolved = gate.unresolved
  if (gate.unresolved) {
    if (!resume) out.gateBlock = gate.block
    else {
      budget.resolveUnresolved(resume)
      gate = preflightLedgerGate({ budget, needsPaid: true })
    }
  }
  if (!out.gateBlock && gate.priorFailure) {
    out.priorFailure = gate.priorFailure
    if (!resume) out.gateBlock = gate.block
    else {
      budget.clearBusinessFailure(resume)
      gate = preflightLedgerGate({ budget, needsPaid: true })
    }
  }
  if (!out.gateBlock) {
    out.priorFailure = out.priorFailure || gate.priorFailure || null
    const began = budget.beginPhase({ name: 'child' })
    out.phaseOpened = began.ok === true
    if (out.phaseOpened) {
      const r = budget.reserve('prep_turn') // 假传输：放行才算"真的发出去了"
      out.transported = r.ok ? 1 : 0
      out.reserveReason = r.reason || null
      budget.closePhase({ outcome: out.transported ? 'pass' : 'fail', note: '子进程自检收尾' })
    }
  }
}

try {
  out.totals = JSON.parse(readFileSync(ledgerPath, 'utf8')).totals
} catch {
  out.totals = null
}
process.stdout.write(JSON.stringify(out) + '\n')
