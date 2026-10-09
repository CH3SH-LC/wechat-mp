// prep-contract-check.mjs —— 准备阶段结果契约的回归（DS 修复指南 包 A / 包 C）
//
// 用法：
//   node scripts/prep-contract-check.mjs [outDir] [URL]
//
// 打的是**真实 `runPrep`**（经本地 Vite 引入生产模块），只把 Rust 侧 `prep_turn` 的返回 stub 掉。
// 不走浏览器 `mode:'skip'` 那条捷径——那条路径什么都不会验证。
//
// 覆盖（DS 指南 §5.2 / §5.3 / §5.5）：
//   · 合法终结工具 reply / compose / candidate 各自被机械执行；
//   · **当前入口只认合法终结结果**：历史创作布尔值不再参与授权（`runPrep` 已无此入参）；
//     READY / 说明+READY / 自由围栏 / 无回执的完成宣称 → 预算内请模型规范声明，
//     拿不到就 protocol/exhausted 失败，**不自行授权**，也不丢弃原文（`failed.raw`）；
//   · 第三次合法终结仍要执行（不会因为纠偏就少一次机会），无第 4 次请求；
//   · 严格参数：顶层非对象 / outcome 非字符串 / reply 缺 text / compose|candidate 缺 assetPolicy /
//     assetPolicy 非法 / candidate source 非字符串或为空 / 互斥字段 → 全部 protocol 失败，
//     **不做类型转换、不补默认值**；
//   · 一份响应**只接受知识工具集合或一次终结**：混用与多终结都判协议错误；
//   · 回合内重复的知识读取复用缓存（同一工具+参数只执行一次）；
//   · 本回合用户 images 随 prep 消息一并送出（不被重建消息丢掉）；
//   · 全程不联网、不调模型、不写真实工作区。
//
// 判定器（指南 §3.1）：唯一 RunResult，stdout / JSON / Markdown / 退出码都由它派生；
// 异常 → ERROR，缺依赖 → BLOCKED，零检查 → ERROR；finally 只落盘与关资源。
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { parseRunnerArgs } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const CONFIG_HINT = `配置方法（与 verify-ui.mjs 同一口径）：
  export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
  export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"`

const run = {
  script: 'prep-contract-check',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED',
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [],
  errors: [],
  sourceHashes: {},
}
for (const rel of ['src/lib/prep.ts', 'src/App.tsx']) {
  run.sourceHashes[rel] = createHash('sha256').update(readFileSync(join(repoRoot, rel))).digest('hex')
}
const check = (id, pass, ...evidence) => {
  run.checks.push({ id, pass: Boolean(pass), evidence: evidence.map((e) => String(e ?? '')) })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${evidence.filter(Boolean).length ? ' (' + evidence.filter(Boolean).join(' / ') + ')' : ''}`)
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[prep-contract-check] ERROR@${stage}: ${message}`)
}
function dieBlocked(msg) {
  fail('deps', msg)
  run.blockedReason = msg
  console.error(`\n${CONFIG_HINT}\n`)
  finalize()
  process.exit(2)
}
function resolvePlaywright() {
  try {
    return require('playwright')
  } catch (e) {
    const p = process.env.VERIFY_PLAYWRIGHT
    if (!p) dieBlocked(`解析不到 playwright：require 失败（${String(e.message || e).split('\n')[0]}），且未设置 VERIFY_PLAYWRIGHT`)
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return require(target)
    } catch (e2) {
      dieBlocked(`VERIFY_PLAYWRIGHT=${target} 仍解析失败：${String(e2.message || e2).split('\n')[0]}`)
    }
  }
}
function resolveChromium() {
  const p = process.env.VERIFY_CHROMIUM
  if (!p) return null
  const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
  if (!existsSync(target)) dieBlocked(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
  return target
}
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const { outDir: outDirArg, base } = parseRunnerArgs()
const outDir = outDirArg || join(import.meta.dirname, '..', '.local', 'runs', `prep-contract-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)
if (outDirArg && existsSync(join(outDir, 'result.md'))) {
  fail('outDir', `输出目录已存在同名结果，拒绝覆盖：${outDir}`)
  finalize()
  process.exit(2)
}

// 依赖探测必须放在 outDir 初始化之后：解析不到 playwright 时 dieBlocked 会调 finalize()，
// 而 finalize() 要往 outDir 落 run-result.json；提前到这里之前会撞 TDZ
// （ReferenceError: Cannot access 'outDir' before initialization）——静默退出、不落判定文件。
const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromium()

const V2 = '[[theme:校园]]\n\n## 周末到馆提醒\n\n各位读者：\n\n- **10月10日（周六）**：9:00-17:00 开放。\n- **10月11日（周日）**：全天闭馆。\n\n咨询电话：**010-55556666**'
const FENCE = (s) => '```v2\n' + s + '\n```'

// ---- T3（2026-10-03 真实小样）受控夹具 ---------------------------------------------------------
//
// F1 报告第七节的真实失败形状是 `finish_preparation { outcome:"compose", text:…, assetPolicy:… }`。
// **原日志没有保存完整工具参数**（Rust 侧只存工具名），所以下面这串**不是真实响应回放**，
// 而是按该形状构造的**受控非法参数夹具**：只复现"合法 outcome + 越界 text"这一结构，
// 不声称它逐字等于模型当时发的原话。
const COMPOSE_WITH_TEXT = JSON.stringify({
  outcome: 'compose',
  text: '报名费和人数上限还没定下来，我先按常规写法出稿。',
  assetPolicy: 'preserve',
})
const CANDIDATE_WITH_TEXT = JSON.stringify({
  outcome: 'candidate',
  source: V2,
  text: '已按你的要求写好，报名费那项我留了空。',
  assetPolicy: 'modify',
})
// 纠偏轮的识别标记：**逐字硬编码**，不 import 源码常量——否则改了常量、断言跟着变，等于没断言。
// 它必须只出现在"终结参数被拒"的那条 tool 结果里（PREP_INSTRUCTION / 预算提醒里都没有这句话）。
const FINISH_REJECT_MARKER = 'finish_preparation 调用被拒绝'

/** 每个用例：一串「第 N 次 prep_turn 的返回」，按顺序消耗（超出后重复最后一条） */
const CASES = [
  {
    name: 'valid-compose',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'compose', assetPolicy: 'preserve', calls: 2, digestHasKnowledge: true },
  },
  {
    name: 'valid-reply',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":"请问面向哪类读者？"}' }] }],
    want: { kind: 'reply', calls: 1, textIncludes: '哪类读者' },
  },
  {
    name: 'valid-candidate',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: V2, assetPolicy: 'modify' }) }] },
    ],
    want: { kind: 'candidate', assetPolicy: 'modify', calls: 2, sourceIncludes: '周末到馆提醒' },
  },
  {
    // 旧协议：只回 READY → 纠偏后仍只回 READY → 协议失败，**不**自行升级成 compose。
    // 原文必须保留在 failed.raw 里（"旧完整稿不得丢弃"）。
    name: 'ready-only-no-longer-authorized',
    replies: [
      { text: '需要的信息已齐备，这就不再多问，进入撰写。\n\nREADY', calls: [] },
      { text: '需要的信息已齐备。\n\nREADY', calls: [] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, rawIncludes: 'READY', correctionSent: true },
  },
  {
    // 旧协议：只贴一段完整 v2 → 纠偏后仍不声明 → 协议失败，原文保留（不自行授权、不丢弃）
    name: 'fenced-v2-without-declaration',
    replies: [
      { text: '已按你的要求改好：标题换成「周末到馆提醒」。\n\n' + FENCE(V2), calls: [] },
      { text: FENCE(V2), calls: [] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, rawIncludes: '周末到馆提醒', correctionSent: true },
  },
  {
    // 纠偏之后的**合法终结**必须照常执行（模型学会新协议的那条路）
    name: 'fenced-v2-then-declares-candidate',
    replies: [
      { text: FENCE(V2), calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: V2, assetPolicy: 'preserve' }) }] },
    ],
    want: { kind: 'candidate', assetPolicy: 'preserve', calls: 2, sourceIncludes: '周末到馆提醒', correctionSent: true },
  },
  {
    // R2 场景（指南 §5.2）：历史里有创作请求，**本回合**只是问一句普通问题，
    // 模型回「NOT READY」。旧实现用历史布尔值把它判成创作请求 → 变成 compose。
    // 现在：不授权 → 协议失败（明确失败，不是偷偷写稿）。
    name: 'r2-history-creation-plain-question-not-ready',
    history: [
      { role: 'user', content: '帮我写一篇校园图书馆开放通知，直接出稿。' },
      { role: 'assistant', content: '好的，已写好。' },
    ],
    userText: '请解释 NOT READY 这个词是什么意思，暂时不要编辑文稿。',
    replies: [
      { text: 'NOT READY', calls: [] },
      { text: 'NOT READY 是旧协议里的"尚未就绪"标记。', calls: [] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, rawIncludes: 'NOT READY', correctionSent: true },
  },
  {
    // R2 的第二个形态：只要求看 v2 语法示例 → 不能把示例当稿子提交。
    // 纠偏后模型改成合法 reply → 正常答复，0 提交。
    name: 'r2-v2-example-then-declares-reply',
    history: [
      { role: 'user', content: '帮我写一篇校园图书馆开放通知，直接出稿。' },
      { role: 'assistant', content: '好的，已写好。' },
    ],
    userText: '给我看看 v2 语法长什么样，只是举例，不要改文稿。',
    replies: [
      { text: 'v2 语法大概是这样：\n\n' + FENCE(V2), calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":"上面就是 v2 的大致写法，只是举例。"}' }] },
    ],
    want: { kind: 'reply', calls: 2, correctionSent: true, textIncludes: '只是举例' },
  },
  {
    // 纯普通答复（既没有控制词也没有围栏）：一次请求、直接 reply
    name: 'plain-chat-answer',
    history: [
      { role: 'user', content: '帮我写一篇校园图书馆开放通知，直接出稿。' },
      { role: 'assistant', content: '好的，已写好。' },
    ],
    userText: '顺便说说公众号推文的开头怎么写比较好？',
    replies: [{ text: '开头三秒抓人，先给结论再给理由。', calls: [] }],
    want: { kind: 'reply', calls: 1, textIncludes: '三秒' },
  },
  {
    // 严格参数：compose 缺 assetPolicy → 协议失败（不补默认值）
    name: 'strict-missing-assetPolicy',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：assetPolicy 非法值 → 协议失败
    name: 'strict-bad-assetPolicy',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"keep"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：candidate 的 source 不是字符串 → 协议失败（不做 String() 硬转）
    name: 'strict-candidate-source-not-string',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"candidate","source":{"a":1},"assetPolicy":"preserve"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：candidate source 为空串 → 协议失败
    name: 'strict-candidate-source-blank',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"candidate","source":"   ","assetPolicy":"preserve"}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：reply 的 text 不是字符串（数值）→ 协议失败，不转成 "123"
    name: 'strict-reply-text-not-string',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":123}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：互斥字段（reply 同时给 source）
    name: 'strict-exclusive-fields',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'reply', text: '好的', source: V2 }) }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：顶层是数组 → 协议失败（不抛未分类异常）
    name: 'strict-top-level-array',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '[]' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：顶层是 null → 协议失败
    name: 'strict-top-level-null',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: 'null' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 严格参数：outcome 不是字符串
    name: 'strict-outcome-not-string',
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":3}' }] }],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 多个终结工具 → 协议错误，不从多份稿件里猜一个
    name: 'two-terminal-tools',
    replies: [
      {
        text: null,
        calls: [
          { id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' },
          { id: 'f2', name: 'finish_preparation', args: '{"outcome":"reply","text":"你好"}' },
        ],
      },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // 知识工具与终结工具**混用** → 协议错误（本轮明确采用的验收规则）
    name: 'knowledge-mixed-with-terminal',
    replies: [
      {
        text: null,
        calls: [
          { id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
          { id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' },
        ],
      },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1 },
  },
  {
    // ---- T3：可纠正的终结参数错误（compose 带 text）→ 一次有界纠偏后拿到合法终结 ----------------
    // 真实失败形状（F1 第七节）：模型想在声明 compose 的同时附一句话，把 text 塞进参数里被整条拒绝。
    // 现在：第 1 次请求被拒 → **不产出**，但把校验器的原错误串当 tool 结果播回给模型 → 第 2 次它重新声明。
    // 断言重点：① 纠偏只发一次 ② 回填的是**模型原样的 arguments**（没有替它删 text）
    //           ③ 纠偏后必须走真实的 parseFinishArgs，产出的是**模型自己重新声明的**合法结果。
    name: 't3-compose-text-then-declares-compose',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: COMPOSE_WITH_TEXT }] },
      { text: null, calls: [{ id: 'f2', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'compose', assetPolicy: 'preserve', calls: 2, correctionSent: false, finishArgsCorrectionSent: true, finishArgsCorrectionCount: 1 },
    expectEchoArgs: COMPOSE_WITH_TEXT,
  },
  {
    // 同族的 candidate + text（同一个"想在正文外补一句"的现象）→ 同样一次纠偏
    name: 't3-candidate-text-then-declares-candidate',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: CANDIDATE_WITH_TEXT }] },
      { text: null, calls: [{ id: 'f2', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: V2, assetPolicy: 'modify' }) }] },
    ],
    want: { kind: 'candidate', assetPolicy: 'modify', calls: 2, sourceIncludes: '周末到馆提醒', correctionSent: false, finishArgsCorrectionSent: true },
    expectEchoArgs: CANDIDATE_WITH_TEXT,
  },
  {
    // **最后一轮**（第 3 次请求）才出现这类非法参数 → **立即失败，不发第 4 个请求**。
    // 第 4 条返回是哨兵：真出现第 4 次请求就说明"有界纠偏"把预算放开了。
    name: 't3-last-round-illegal-no-fourth-request',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: '', calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: COMPOSE_WITH_TEXT }] },
      { text: null, calls: [{ id: 'sentinel', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 3, correctionSent: false, finishArgsCorrectionSent: false },
  },
  {
    // 纠偏一次之后**再次**非法 → 停止、不再追加（至多一次，且第 3 条是哨兵）。
    name: 't3-illegal-again-after-correction-stops',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: COMPOSE_WITH_TEXT }] },
      { text: null, calls: [{ id: 'f2', name: 'finish_preparation', args: COMPOSE_WITH_TEXT }] },
      { text: null, calls: [{ id: 'sentinel', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 2, correctionSent: false, finishArgsCorrectionSent: true, finishArgsCorrectionCount: 1 },
    expectEchoArgs: COMPOSE_WITH_TEXT,
  },
  {
    // 纠偏后模型改回普通答复（合法 reply）→ 正常答复，**0 提交**（纠偏不产生写作授权）
    name: 't3-compose-text-then-declares-reply',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: COMPOSE_WITH_TEXT }] },
      { text: null, calls: [{ id: 'f2', name: 'finish_preparation', args: '{"outcome":"reply","text":"报名费还没定，我先按常规写？"}' }] },
    ],
    want: { kind: 'reply', calls: 2, textIncludes: '报名费还没定', correctionSent: false, finishArgsCorrectionSent: true },
  },
  {
    // 窄面（1）：缺 assetPolicy **不属于**本类 → 仍是一次性协议失败（哨兵证明没有第 2 次请求）
    name: 't3-not-applied-to-missing-assetPolicy',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose"}' }] },
      { text: null, calls: [{ id: 'sentinel', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1, correctionSent: false, finishArgsCorrectionSent: false },
  },
  {
    // 窄面（2）：reply + source 互斥**不属于**本类（现象不同、无真实复现）→ 仍是一次性协议失败
    name: 't3-not-applied-to-reply-with-source',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: JSON.stringify({ outcome: 'reply', text: '好的', source: V2 }) }] },
      { text: null, calls: [{ id: 'sentinel', name: 'finish_preparation', args: '{"outcome":"reply","text":"好的"}' }] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1, correctionSent: false, finishArgsCorrectionSent: false },
  },
  {
    // 窄面（3）：未知 outcome **不属于**本类（任务卡禁止强转/猜测）→ 仍是一次性协议失败
    name: 't3-not-applied-to-unknown-outcome',
    replies: [
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"write","text":"随便写点"}' }] },
      { text: null, calls: [{ id: 'sentinel', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1, correctionSent: false, finishArgsCorrectionSent: false },
  },
  {
    // 窄面（4）：**混用**知识工具与终结工具（且终结参数正好是本类形状）→ 混用优先，仍一次性拒绝，
    // 不因为"顺带能纠偏"就把整条回复再接一轮。
    name: 't3-not-applied-to-mixed-tools',
    replies: [
      {
        text: null,
        calls: [
          { id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
          { id: 'f1', name: 'finish_preparation', args: COMPOSE_WITH_TEXT },
        ],
      },
      { text: null, calls: [{ id: 'sentinel', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'failed', failure: 'protocol', calls: 1, correctionSent: false, finishArgsCorrectionSent: false },
  },
  {
    // 取消 / 传输异常（用户停止、网络中断）：异常**上抛**，不产出任何结果对象 ——
    // 也就是"失败/取消时保留旧稿、不获得写作授权"在本层的可观测形态（App 侧 catch 后不提交任何文稿）。
    name: 'cancel-transport-error-throws-no-outcome',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { throw: '已取消（用户停止）' },
    ],
    want: { kind: 'throw', calls: 2, correctionSent: false, finishArgsCorrectionSent: false },
  },
  {
    // 第三次合法终结仍要执行（预算 3 次：知识 → 空回复 → 合法终结）
    name: 'third-call-legal-terminal-executes',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: '', calls: [] },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"modify"}' }] },
    ],
    want: { kind: 'compose', assetPolicy: 'modify', calls: 3 },
  },
  {
    // 三次空回复 → exhausted（没有第 4 次请求）
    name: 'exhausted-empty-replies',
    replies: [{ text: '', calls: [] }, { text: '', calls: [] }, { text: '', calls: [] }, { text: '', calls: [] }],
    want: { kind: 'failed', failure: 'exhausted', calls: 3 },
  },
  {
    // **2026-10-02 真机 L1 的失败形状**（默认发布 exe 实测）：三轮**全部**是知识工具调用，
    // 一次 finish_preparation 都没有 → 准备阶段按设计耗尽失败。第 4 条返回是断言"没有第 4 次请求"的哨兵：
    // 真出现第 4 次就说明预算被放开了。
    // 这条用例同时是"预算提醒真的发出去"的唯一非空样本（只有它走到最后一次请求）。
    name: 'exhausted-knowledge-only',
    replies: [
      { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
      { text: null, calls: [{ id: 'k2', name: 'search_knowledge', args: '{"query":"校园图书馆开放通知"}' }] },
      { text: null, calls: [{ id: 'k3', name: 'load_knowledge', args: '{"name":"type-notice"}' }] },
      { text: null, calls: [{ id: 'k4', name: 'load_knowledge', args: '{"name":"sentinel-must-not-be-called"}' }] },
    ],
    // 注意：exhausted 分支**不带** digest——没有撰写发生，知识摘要无处可用（有 digest 的是 reply/compose/candidate）。
    want: { kind: 'failed', failure: 'exhausted', calls: 3 },
  },
  {
    // 回合内重复读取同一份知识 → 只执行一次（缓存），但两次 tool 结果都要回给模型
    name: 'duplicate-knowledge-reads-cached',
    replies: [
      {
        text: null,
        calls: [
          { id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
          { id: 'k2', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' },
        ],
      },
      { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] },
    ],
    want: { kind: 'compose', calls: 2, prepProgressCount: 1 },
  },
  {
    // 本回合附带参考图 → 必须随用户消息进 prep（不被消息重建丢掉）
    name: 'images-preserved-into-prep',
    images: ['data:image/png;base64,iVBORw0KGgo='],
    replies: [{ text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"reply","text":"图我看到了。"}' }] }],
    want: { kind: 'reply', calls: 1, firstInvokeUserHasImages: true },
  },
]

run.plannedCases = CASES.map((c) => c.name)

let rows = []
const pageErrors = []
let browser = null
try {
  browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
  const page = await browser.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
  } catch (e) {
    fail('navigate', `打开 ${base} 失败：${String(e.message || e).split('\n')[0]}`)
  }
  if (!run.errors.length) {
    try {
      rows = await page.evaluate(
        async ({ cases, marker, fixtures }) => {
          const { runPrep, parseFinishArgs, extractV2Source, MAX_PREP_CALLS, isCorrectableFinishError } = await import('/src/lib/prep.ts')
          const out = []
          for (const c of cases) {
            const invokes = []
            const progress = []
            window.__TAURI_INTERNALS__ = {
              invoke: async (cmd, args) => {
                if (cmd !== 'prep_turn') throw new Error('Unexpected invoke: ' + cmd)
                // 先登记"这次请求已经发出"再决定抛不抛——取消场景断言的是"异常上抛"，不是"没发出去"
                invokes.push(args)
                const reply = c.replies[Math.min(invokes.length - 1, c.replies.length - 1)]
                if (reply && reply.throw) throw new Error(reply.throw)
                return reply ?? { text: '', calls: [] }
              },
            }
            const msgs = [
              { role: 'system', content: '离线契约检查。' },
              ...(c.history || []),
              { role: 'user', content: c.userText || '请只把正文缩到 180 字以内，标题改为「周末到馆提醒」。', ...(c.images ? { images: c.images } : {}) },
            ]
            let outcome
            let threw = null
            try {
              outcome = await runPrep(msgs, {
                runId: 'offline-prep-' + c.name,
                onProgress: (e) => progress.push(e),
                hasPriorBindings: true,
              })
            } catch (e) {
              threw = String(e)
              outcome = null
            }
            delete window.__TAURI_INTERNALS__
            out.push({
              name: c.name,
              invokeCount: invokes.length,
              secondHasToolResult: Boolean(invokes[1] && invokes[1].messages.some((m) => m.role === 'tool')),
              firstInvokeUserHasImages: Boolean(
                invokes[0] && invokes[0].messages.some((m) => m.role === 'user' && Array.isArray(m.images) && m.images.length),
              ),
              // 纠偏请求：必须识别**实际追加的纠偏轮**（内容为 PREP_CORRECTION），
              // 不能因为初始提示里也含 finish_preparation 就恒真（旧脚本的弱断言）。
              correctionSent: invokes.slice(1).some((i) => i.messages.some((m) => m.role === 'user' && String(m.content).includes('请改用 finish_preparation'))),
              // ---- T3：终结参数纠偏（tool 结果里的拒绝反馈）----
              // 只数 invokes[1..]：第 1 次请求不可能是纠偏轮。判据是**实际发出去的消息**里
              // 那条带拒绝标记的 tool 结果，不是源码文本。
              finishArgsCorrectionCount: invokes
                .slice(1)
                .filter((i) => i.messages.some((m) => m.role === 'tool' && String(m.content).includes(marker))).length,
              finishArgsCorrectionSent: invokes
                .slice(1)
                .some((i) => i.messages.some((m) => m.role === 'tool' && String(m.content).includes(marker))),
              // 纠偏轮必须带着**校验器自己的错误串**（不是另写一句含糊的"参数不对"）
              correctionCarriesValidatorError: invokes
                .slice(1)
                .some((i) => i.messages.some((m) => m.role === 'tool' && String(m.content).includes('与 text 互斥'))),
              // 模型那次非法调用必须**原样**回填（arguments 逐字符相同）——防的正是
              // "替模型删掉 text 再接受"这种修复方式。没给夹具的用例返回 null（不参与断言）。
              echoedIllegalArgsVerbatim: c.expectEchoArgs
                ? invokes.slice(1).some((i) =>
                    i.messages.some(
                      (m) =>
                        m.role === 'assistant' &&
                        Array.isArray(m.tool_calls) &&
                        m.tool_calls.some(
                          (tc) => tc.function && tc.function.name === 'finish_preparation' && tc.function.arguments === c.expectEchoArgs,
                        ),
                    ),
                  )
                : null,
              outcome,
              threw,
              progressPhases: progress.map((p) => p.phase),
              maxCalls: MAX_PREP_CALLS,
              // 预算提醒（2026-10-02 真机修复）：按**每次请求实际发出去的消息**数它出现几次。
              // 真机实测的失败形状是"模型三轮全取资料、一次没声明"——提醒必须真的随最后一次请求发出去，
              // 而不是只写在源码里（那种断言抓不住"忘了接线"）。
              reminderCounts: invokes.map(
                (i) => i.messages.filter((m) => m.role === 'user' && String(m.content).includes('最后一次请求')).length,
              ),
              // 首次请求就必须把"知识工具与终结工具不能同一条回复"这条规则发给模型。
              // 2026-10-02 真机实测：模型把 load_knowledge 与 finish_preparation 放在同一条回复，
              // 按契约整条判协议失败（L4 因此没有换图、没有提交）——而当时的指令里**没有**这条规则。
              // 这里断言的是"实际发出去的消息"里有没有它，不是源码文本。
              firstInvokeForbidsMixing: invokes[0].messages.some((m) => String(m.content).includes('不能出现在同一条回复里')),
            })
          }
          // 纯函数边界（严格参数逐条可证伪）
          const pure = {
            multipleFencesIsNull: extractV2Source('```v2\na\n```\n```v2\nb\n```') === null,
            singleFenceOk: extractV2Source('```v2\nA\n```') === 'A',
            unclosedFenceIsNull: extractV2Source('```v2\nA') === null,
            replyWithoutTextRejected: parseFinishArgs('{"outcome":"reply"}').ok === false,
            unknownOutcomeRejected: parseFinishArgs('{"outcome":"wat"}').ok === false,
            badJsonRejected: parseFinishArgs('{oops').ok === false,
            topLevelArrayRejected: parseFinishArgs('[]').ok === false,
            topLevelNullRejected: parseFinishArgs('null').ok === false,
            topLevelNumberRejected: parseFinishArgs('3').ok === false,
            emptyObjectRejected: parseFinishArgs('{}').ok === false,
            composeWithoutPolicyRejected: parseFinishArgs('{"outcome":"compose"}').ok === false,
            candidateNonStringSourceRejected: parseFinishArgs('{"outcome":"candidate","source":7,"assetPolicy":"preserve"}').ok === false,
            replyNumberTextRejected: parseFinishArgs('{"outcome":"reply","text":9}').ok === false,
            exclusiveFieldsRejected: parseFinishArgs('{"outcome":"reply","text":"a","source":"b"}').ok === false,
            composeAcceptsExplicitPolicy:
              (() => {
                const r = parseFinishArgs('{"outcome":"compose","assetPolicy":"preserve"}')
                return r.ok && r.kind === 'compose' && r.assetPolicy === 'preserve'
              })(),
            candidateAcceptsExplicitPolicy:
              (() => {
                const r = parseFinishArgs(JSON.stringify({ outcome: 'candidate', source: 'A', assetPolicy: 'modify' }))
                return r.ok && r.kind === 'candidate' && r.assetPolicy === 'modify'
              })(),
          }
          // ---- T3：可纠正类别的**分类器**边界（纯函数，逐条可证伪）-----------------------------
          // 「可纠正」= 合法 outcome（compose/candidate）+ 越界 text。
          // 分类器只回答"要不要再问一次"，**不产出结果**；合同仍由 parseFinishArgs 把关（见下面两条）。
          const classify = typeof isCorrectableFinishError === 'function' ? isCorrectableFinishError : null
          const classifies = (s) => (classify ? classify(s) === true : false)
          const pure2 = {
            t3_classifier_exported: classify !== null,
            t3_composeWithText_isCorrectable: classifies(fixtures.composeWithText),
            t3_candidateWithText_isCorrectable: classifies(fixtures.candidateWithText),
            t3_composeWithEmptyText_isCorrectable: classifies('{"outcome":"compose","text":"","assetPolicy":"preserve"}'),
            // 窄面：以下都**不**属于本类（不能因为"能纠偏"就把它们接进来）
            t3_composeWithoutText_notCorrectable: !classifies('{"outcome":"compose","assetPolicy":"preserve"}'),
            t3_composeMissingPolicy_notCorrectable: !classifies('{"outcome":"compose"}'),
            t3_replyWithText_notCorrectable: !classifies('{"outcome":"reply","text":"a"}'),
            t3_replyWithSource_notCorrectable: !classifies('{"outcome":"reply","text":"a","source":"b"}'),
            t3_unknownOutcome_notCorrectable: !classifies('{"outcome":"wat","text":"x"}'),
            t3_nullText_notCorrectable: !classifies('{"outcome":"compose","text":null,"assetPolicy":"preserve"}'),
            t3_nonObject_notCorrectable: !classifies('[]') && !classifies('null') && !classifies('{oops'),
            // **合同没被放松**：这两串非法参数照样被严格校验拒绝——"可纠偏"不等于"被接受"
            t3_composeWithText_stillRejected: parseFinishArgs(fixtures.composeWithText).ok === false,
            t3_candidateWithText_stillRejected: parseFinishArgs(fixtures.candidateWithText).ok === false,
          }
          return { rows: out, pure, pure2 }
        },
        { cases: CASES, marker: FINISH_REJECT_MARKER, fixtures: { composeWithText: COMPOSE_WITH_TEXT, candidateWithText: CANDIDATE_WITH_TEXT } },
      )
    } catch (e) {
      fail('evaluate', String(e.message || e).split('\n')[0])
    }
  }
} catch (e) {
  fail('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
} finally {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'raw.json'), JSON.stringify({ rows, pageErrors, run }, null, 2) + '\n')
  if (browser) await browser.close().catch(() => {})
}

const thin = (o) =>
  o
    ? {
        mode: o.mode,
        kind: o.kind,
        failure: o.failure,
        assetPolicy: o.assetPolicy,
        text: o.text,
        raw: o.raw ? o.raw.slice(0, 40) + '…' : undefined,
        source: o.source ? o.source.slice(0, 40) + '…' : undefined,
        digest: o.digest ? '[有知识摘要]' : undefined,
      }
    : null

if (!run.errors.length && rows.rows) {
  for (const [i, c] of CASES.entries()) {
    const r = rows.rows[i]
    if (!r) {
      fail(`case:${c.name}`, '没有采集到该用例的结果')
      continue
    }
    const o = r.outcome
    run.executedCases.push(c.name)
    console.log(`\n[${c.name}] ${JSON.stringify({ invokes: r.invokeCount, outcome: thin(o), threw: r.threw })}`)
    if (c.want.kind === 'throw') {
      // 取消 / 传输异常：runPrep **不**吞掉异常，也不把失败降级成"直接撰写"——异常上抛，结果对象为空。
      // 这就是"失败/取消时保留旧稿、不获得写作授权"在本层的可观测形态（App 侧 catch 后不提交任何文稿）。
      check(
        `${c.name}：传输异常（取消/网络中断）原样上抛，不产出任何结果对象`,
        Boolean(r.threw) && r.outcome === null,
        `threw=${r.threw || '(空)'} outcome=${r.outcome ? JSON.stringify(r.outcome) : 'null'}`,
      )
    } else {
      check(`${c.name}：没有抛异常`, !r.threw, r.threw || '')
      check(`${c.name}：结果类型 = ${c.want.kind}`, o && o.mode === 'prep' && o.kind === c.want.kind, `实测 ${o ? o.mode + '/' + o.kind : 'null'}`)
    }
    check(`${c.name}：请求次数等于预期（无第 4 次准备请求）`, r.invokeCount === c.want.calls, `实测 ${r.invokeCount}（期望 ${c.want.calls}，上限 ${r.maxCalls}）`)
    if (c.want.kind !== 'throw') {
      if (c.want.failure) check(`${c.name}：失败分类 = ${c.want.failure}`, o && o.failure === c.want.failure, `实测 ${o && o.failure}`)
      if (c.want.assetPolicy) check(`${c.name}：assetPolicy = ${c.want.assetPolicy}`, o && o.assetPolicy === c.want.assetPolicy, `实测 ${o && o.assetPolicy}`)
      if (c.want.textIncludes) check(`${c.name}：答复文本已带出`, o && String(o.text || '').includes(c.want.textIncludes), o && o.text)
      if (c.want.sourceIncludes) check(`${c.name}：正文进入交付（不是只存聊天）`, o && String(o.source || '').includes(c.want.sourceIncludes), o && String(o.source || '').slice(0, 40))
      if (c.want.rawIncludes) check(`${c.name}：未形成合法终结的原文被保留（failed.raw）`, o && String(o.raw || '').includes(c.want.rawIncludes), o && String(o.raw || '').slice(0, 40))
      if (c.want.digestHasKnowledge) check(`${c.name}：知识摘要随结果带出`, o && Boolean(o.digest), '')
      // 失败/取消一律不带写作授权：没有 source（新正文）、没有 assetPolicy（素材操作）。
      // 这条对所有 failed 用例都成立，包含纠偏之后仍然失败的形状。
      if (o && o.mode === 'prep' && o.kind === 'failed') {
        check(
          `${c.name}：失败不产生写作授权（无 source / 无 assetPolicy）`,
          !o.source && !o.assetPolicy,
          `字段=${Object.keys(o).join(',')}`,
        )
      }
    }
    if (c.want.correctionSent !== undefined) {
      check(
        `${c.name}：${c.want.correctionSent ? '确实追加过一次旧协议文本纠偏请求' : '没有发旧协议文本纠偏（不是这一类）'}`,
        r.correctionSent === c.want.correctionSent,
        `纠偏请求已发出=${r.correctionSent}`,
      )
    } else {
      check(`${c.name}：不该发纠偏时没有发`, !r.correctionSent, `纠偏请求已发出=${r.correctionSent}`)
    }
    // ---- T3：终结参数纠偏 ----
    if (c.want.finishArgsCorrectionSent !== undefined) {
      check(
        `${c.name}：${c.want.finishArgsCorrectionSent ? '终结参数被拒后确实发过一次带拒绝反馈的纠偏轮' : '没有发终结参数纠偏'}`,
        r.finishArgsCorrectionSent === c.want.finishArgsCorrectionSent,
        `实测 finishArgsCorrectionSent=${r.finishArgsCorrectionSent}`,
      )
    } else {
      check(
        `${c.name}：不属于可纠偏类别时没有发终结参数纠偏`,
        !r.finishArgsCorrectionSent,
        `实测 finishArgsCorrectionSent=${r.finishArgsCorrectionSent}`,
      )
    }
    if (c.want.finishArgsCorrectionCount !== undefined) {
      check(
        `${c.name}：纠偏轮次数恰好 ${c.want.finishArgsCorrectionCount}（至多一次）`,
        r.finishArgsCorrectionCount === c.want.finishArgsCorrectionCount,
        `实测 ${r.finishArgsCorrectionCount}`,
      )
    }
    if (c.want.finishArgsCorrectionSent) {
      check(`${c.name}：纠偏轮带回了校验器自己的错误串`, r.correctionCarriesValidatorError, `实测 ${r.correctionCarriesValidatorError}`)
    }
    if (c.expectEchoArgs) {
      check(
        `${c.name}：非法调用被**原样**回填给模型（arguments 逐字符相同，没有被替改）`,
        r.echoedIllegalArgsVerbatim === true,
        `实测 echoedIllegalArgsVerbatim=${r.echoedIllegalArgsVerbatim}`,
      )
    }
    if (c.want.prepProgressCount !== undefined) {
      const prepCount = r.progressPhases.filter((x) => x === 'prep').length
      check(`${c.name}：知识工具只执行一次（重复读取复用回合内缓存）`, prepCount === c.want.prepProgressCount, `prep 上报 ${prepCount} 次（期望 ${c.want.prepProgressCount}）`)
    }
    if (c.want.firstInvokeUserHasImages) check(`${c.name}：本回合参考图随用户消息送到了模型`, r.firstInvokeUserHasImages, `首次请求含 images=${r.firstInvokeUserHasImages}`)
    check(
      `${c.name}：首次请求就声明了"知识工具与 finish_preparation 不能同一条回复"`,
      r.firstInvokeForbidsMixing === true,
      `首次请求含该规则=${r.firstInvokeForbidsMixing}`,
    )
    // 预算提醒必须**真的发出去**、且只出现在最后一次准备请求里（指南 §5.3 的 3 次总额不变）
    {
      const counts = r.reminderCounts || []
      const expected = counts.map((_, i) => (i === r.maxCalls - 1 ? 1 : 0))
      check(
        `${c.name}：最后一次准备请求真的带上了预算提醒（且只在最后一次）`,
        counts.length === r.invokeCount && JSON.stringify(counts) === JSON.stringify(expected),
        `各次提醒条数=${JSON.stringify(counts)}，期望=${JSON.stringify(expected)}（往返 ${r.invokeCount} 次，上限 ${r.maxCalls}）`,
      )
    }
    const thinkCount = r.progressPhases.filter((x) => x === 'think').length
    check(`${c.name}：每次模型往返恰好一次 think 阶段上报`, thinkCount === r.invokeCount, `think×${thinkCount}，往返 ${r.invokeCount} 次`)
    const firstHasKnowledge = Boolean(c.replies[0] && c.replies[0].calls.some((x) => x.name !== 'finish_preparation'))
    if (firstHasKnowledge && r.invokeCount > 1 && o && o.kind !== 'failed') {
      check(`${c.name}：前一轮的知识工具结果确实回传给了模型`, r.secondHasToolResult, `第二次请求含 tool 消息=${r.secondHasToolResult}`)
    }
  }

  const pure = rows.pure
  console.log('')
  for (const [k, v] of Object.entries(pure || {})) check(`纯函数边界：${k}`, v === true, String(v))
  for (const [k, v] of Object.entries(rows.pure2 || {})) check(`可纠正类别边界：${k}`, v === true, String(v))

  // ---- 接线断言（App 侧）：指南 §5.2"移除历史创作布尔值对兼容授权的作用" ----
  // 这是结构断言，不是行为断言：行为断言在 prep-contract-check 的 runPrep 层（R2 两个用例），
  // 这里只钉住"那两条入参不会被人重新接回来"。
  const appSrc = readFileSync(join(repoRoot, 'src/App.tsx'), 'utf8')
  check('接线：App 不再有 creationContract 入参（历史创作布尔值不参与授权）', !/creationContract/.test(appSrc))
  check('接线：App 不再有 creativeSession 历史创作态变量', !/creativeSession/.test(appSrc))
  check('接线：App 调用 runPrep 时不传任何授权开关', /runPrep\(baseMsgs, \{/.test(appSrc) && !/runPrep\(baseMsgs, \{[\s\S]{0,200}creationContract/.test(appSrc))
  check('接线：读取当前文稿失败会终止本轮（不是 console.warn 后继续）', !/当前文稿读取失败，本轮按"没有已验收旧稿"处理/.test(appSrc))

  check('全程无页面异常', pageErrors.length === 0, pageErrors.join(' / '))
  run.executionComplete = run.executedCases.length === run.plannedCases.length
}

function finalize() {
  const hasFail = run.checks.some((c) => !c.pass)
  if (run.blockedReason) run.status = 'BLOCKED'
  else if (run.errors.length) run.status = 'ERROR'
  else if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'completeness', message: `计划 ${run.plannedCases.length} 个用例，实际执行 ${run.executedCases.length} 个` })
  } else if (run.checks.length === 0) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'checks', message: '零条检查：不能算通过' })
  } else if (hasFail) run.status = 'FAIL'
  else run.status = 'PASS'
  run.finishedAt = new Date().toISOString()
  mkdirSync(outDir, { recursive: true })
  const passed = run.checks.filter((c) => c.pass).length
  writeFileSync(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  writeFileSync(
    join(outDir, 'result.md'),
    `# 准备阶段结果契约 —— 回归\n\n状态：**${run.status}**（executionComplete=${run.executionComplete}，检查 ${passed}/${run.checks.length} 通过）\n` +
      `时间：${run.startedAt} → ${run.finishedAt}\n入口：\`node scripts/prep-contract-check.mjs ${outDirArg || '(默认)'} ${base}\`\n` +
      `被测：\`src/lib/prep.ts\`（真实 runPrep，仅 stub Rust 侧 prep_turn 返回）+ \`src/App.tsx\` 接线断言\n` +
      `源码哈希：\`${JSON.stringify(run.sourceHashes)}\`\n\n` +
      (run.errors.length ? `## 错误\n\n${run.errors.map((e) => `- [${e.stage}] ${e.message}`).join('\n')}\n\n` : '') +
      `\`\`\`\n${run.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} - ${c.id}${c.evidence.filter(Boolean).length ? ' (' + c.evidence.filter(Boolean).join(' / ') + ')' : ''}`).join('\n')}\n\`\`\`\n`,
    'utf8',
  )
  console.log('')
  console.log(`  产出留档：${outDir}`)
  console.log(`PREP-CONTRACT ${run.status}`)
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}

finalize()
