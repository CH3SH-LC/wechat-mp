// ============================================================================
// 已废弃：**不要再把本脚本的输出当作签收依据**
//
// DS 修复指南（2026-09-30）§3.2 末段点名本脚本"未整改，不可直接作为本轮签收工具"，理由：
//   · 按 mtime 挑"最新 trace"，而不是绑定本轮 run（上一轮的 trace 会被当成这一轮的证据）；
//   · 硬编码 CDP 端口 9222 与作者机器上的 playwright 绝对路径，换机器/换端口即失效；
//   · 每条用例前**清空当前文档**，跑完不复原，证据与真实工作区状态脱钩；
//   · 只打印期望值、不做断言，且**恒 exit 0**——红绿都由人看，机器判定为零。
// 替代入口：`scripts/live-acceptance.mjs`（真实模型验收的唯一判定来源）。
// 本文件保留仅为历史对照；如果将来要复用其中某段驱动逻辑，请先按上面的四条整改。
// ============================================================================
// live-three-samples.mjs —— 真实模型三小样验收（修复计划阶段 6 第 3 条）
// 用法：node scripts/live-three-samples.mjs <1|2|3>   （先按下面说明启动桌面应用）
//
// 与其它脚本的最大区别：**这不是复刻链路，而是驱动真机**。
// 桌面应用是用 WebView2 跑的，加上 `--remote-debugging-port` 后 Playwright 可以经 CDP 直接
// 连上它的 webview，于是脚本点的是**真实按钮、走的是真实 TS 编排、调的是真实 Rust 命令、
// 打的是真实 DeepSeek 接口**。唯一的"模拟"是输入框里的那段用户话术——那本来就是人写的。
//
// 启动方式（另开一个终端）：
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" \
//     ./src-tauri/target/release/wechat-mp-desktop.exe
//
// 证据来源（两条互相独立）：
//   · `<workspace>/traces/<runId>.jsonl` —— Rust 侧写的请求与素材位决策（权威）
//   · 应用界面本身 —— 预览里的图片张数、未完成素材清单、工作气泡的阶段
//
// 三小样对应计划原文：①有库复用 ②仅缺一张新图 ③已有稿只改正文。
import { createRequire } from 'module'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const which = String(process.argv[2] || '').trim()
if (!['1', '2', '3'].includes(which)) {
  console.error('用法：node scripts/live-three-samples.mjs <1|2|3>')
  process.exit(2)
}

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222'
// 允许用 WXMP_HOME 指定隔离工作区的用户目录（真机验收时不动真实数据）
const HOME = process.env.WXMP_HOME || homedir()
const TRACES = join(HOME, 'Documents', 'wechat-mp-workspace', 'traces')
const SHOTS = process.env.WXMP_SHOTS || 'docs/artifacts/2026-09-28-repair'

// ---------- 题面（用户话术；刻意都写成短篇，既省钱也更像真实使用） ----------
const PROMPTS = {
  // ① 有库复用：明确点名库里已有的素材，要求不要重画
  1: '写一篇 300 字左右的短通知，主题是图书馆周末开放时间调整（周六日 9:00-17:00，周日晚闭馆）。' +
     '开篇配一张图，用我素材库里那张「浅蓝浅粉色系校园书桌」（inline-mtx761tr），不要重新画。直接写。',
  // ② 仅缺一张新图：一处复用 + 一处必须新画
  2: '写一篇 300 字左右的短通知，主题是体育馆开放时间调整（工作日 18:00-22:00）。' +
     '开篇的横幅插画库里没有，请新画一张（傍晚体育馆与灯光的场景）；' +
     '文末气泡的角饰用我素材库里那张「浅蓝小星与浅粉圆点」（star），不要重新画。直接写。',
  // ③ 已有稿只改正文：在第 ① 题产出的同一会话里继续改文字
  3: '把正文改短一点，压到 200 字以内。只改文字，配图保持不动、不要重新画。',
}

// ---------- 证据读取 ----------
function readAllTraces() {
  let files = []
  try {
    files = readdirSync(TRACES).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return []
  }
  return files.map((f) => {
    const path = join(TRACES, f)
    const recs = readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    return { file: f, mtime: statSync(path).mtimeMs, recs }
  })
}

/** 取"本次运行之后才出现/更新"的那份日志 */
function newestTraceSince(t0) {
  const all = readAllTraces().filter((t) => t.mtime >= t0 - 2000)
  all.sort((a, b) => b.mtime - a.mtime)
  return all[0] || null
}

function summarizeTrace(t) {
  if (!t) return { error: '没有找到本次运行的追踪日志' }
  const draws = t.recs.filter((r) => r.phase === 'gen_svg')
  const slots = t.recs.filter((r) => r.kind === 'slot')
  const byDecision = {}
  for (const s of slots) byDecision[s.decision] = (byDecision[s.decision] || 0) + 1
  const failures = {}
  for (const r of t.recs) if (r.failure) failures[r.failure] = (failures[r.failure] || 0) + 1
  return {
    file: t.file,
    records: t.recs.length,
    requests: t.recs.filter((r) => r.kind === 'request').length,
    drawCalls: draws.length,
    drawSlots: draws.map((d) => `${d.slotId || '-'}:${d.failure || 'ok'}`),
    slotDecisions: byDecision,
    slotDetail: slots.map((s) => ({ slotId: s.slotId, decision: s.decision, assetId: s.assetId || '', note: (s.note || '').slice(0, 60) })),
    failures,
    missingMs: t.recs.filter((r) => r.kind === 'request' && typeof r.ms !== 'number').length,
  }
}

// ---------- 驱动 ----------
const browser = await chromium.connectOverCDP(CDP)
const ctx = browser.contexts()[0]
const page = ctx.pages().find((p) => p.url().includes('tauri.localhost')) || ctx.pages()[0]
if (!page) {
  console.error('没找到应用页面；确认应用已启动且开了远程调试端口')
  process.exit(2)
}

const say = (s) => console.log(s)
const inTauri = await page.evaluate(() => '__TAURI_INTERNALS__' in window)
if (!inTauri) {
  console.error('连上的页面不是桌面应用（inTauri=false）——本脚本只做真机验收')
  process.exit(2)
}

const clearChat = async () => {
  if ((await page.locator('.msg-user').count()) > 0) {
    await page.locator('.mini', { hasText: '清空' }).first().click()
    await page.waitForSelector('.chat-empty', { timeout: 15000 })
  }
}

/** 等这一回合结束：工作气泡消失且最后一条助手消息有内容 */
const waitTurn = async (timeout = 300000) => {
  await page.waitForFunction(
    () => {
      const all = document.querySelectorAll('.msg-assistant-text')
      const t = all[all.length - 1]
      return !!t && t.textContent.trim().length > 3 && !document.querySelector('.work-bubble')
    },
    null,
    { timeout },
  )
  await page.waitForTimeout(500)
}

const snapshot = async () => {
  const state = await page.evaluate(() => {
    const f = document.querySelector('.preview-body iframe')
    const doc = f && f.contentDocument
    return {
      imgs: doc ? doc.querySelectorAll('img[src^="data:image/"]').length : 0,
      textLen: doc ? (doc.body.innerText || '').length : 0,
      quality: document.querySelector('.quality-strip')?.textContent?.trim()?.slice(0, 60) || '',
      warnings: [...document.querySelectorAll('.compose-warn div')].map((d) => d.textContent.trim()).slice(0, 4),
      issues: document.querySelectorAll('.asset-issues .ai-list li').length,
      busy: !!document.querySelector('.work-bubble'),
    }
  })
  return state
}

say(`\n=== 三小样 · 第 ${which} 题 ===`)
say(`题面：${PROMPTS[which]}`)

if (which !== '3') {
  // ① ② 各自从干净状态开始
  await clearChat()
}
const t0 = Date.now()

// 逐段观察工作气泡（既验证阶段推进，也让人工能看到"在画第几张"）
const seenStages = []
let watching = true
const watcher = (async () => {
  for (let i = 0; i < 600 && watching; i++) {
    const s = await page
      .evaluate(() => {
        const b = document.querySelector('.work-bubble')
        if (!b) return null
        return { phase: b.getAttribute('data-phase'), text: b.querySelector('.wb-detail')?.textContent || '', time: b.querySelector('.wb-time')?.textContent || '' }
      })
      .catch(() => null)
    if (s) {
      const tag = `${s.phase}|${s.text}`
      if (seenStages[seenStages.length - 1] !== tag) seenStages.push(tag)
    }
    await page.waitForTimeout(700)
  }
})()

await page.locator('textarea').fill(PROMPTS[which])
await page.locator('textarea').press('Enter')
await waitTurn()
await page
  .waitForFunction(() => !document.querySelector('.work-bubble'), null, { timeout: 600000 })
  .catch(() => {})
watching = false
await watcher.catch(() => {})

const shot = `${SHOTS}/live-sample-${which}.png`
await page.screenshot({ path: shot }).catch(() => {})

const state = await snapshot()
const trace = summarizeTrace(newestTraceSince(t0))

say('\n--- 工作气泡经过的阶段 ---')
for (const s of seenStages) say(`  ${s}`)
say('\n--- 界面状态 ---')
say(`  预览内联图片：${state.imgs} 张｜正文长度：${state.textLen} 字`)
say(`  质检条：${state.quality || '（无）'}`)
say(`  未完成素材：${state.issues} 项`)
say(`  警告：${state.warnings.length ? state.warnings.join(' ｜ ') : '（无）'}`)
say('\n--- 请求证据（traces/*.jsonl）---')
say(`  日志：${trace.file || trace.error}`)
if (trace.file) {
  say(`  记录 ${trace.records} 条｜其中 request ${trace.requests} 条（缺耗时 ${trace.missingMs} 条）`)
  say(`  **绘图调用（gen_svg）：${trace.drawCalls} 次**  ${trace.drawSlots.join(' ') || ''}`)
  say(`  素材位决策：${JSON.stringify(trace.slotDecisions)}`)
  for (const d of trace.slotDetail) say(`    - ${d.slotId} → ${d.decision}${d.assetId ? '（' + d.assetId + '）' : ''}｜${d.note}`)
  say(`  失败分类：${Object.keys(trace.failures).length ? JSON.stringify(trace.failures) : '（无）'}`)
}

// ---------- 判定 ----------
const expect = {
  1: '★ 期望：素材位全部复用（0 次绘图），预览里出现该素材',
  2: '★ 期望：恰好 1 次绘图（新横幅）+ 1 处复用（star 角饰）',
  3: '★ 期望：0 次绘图（只改文字，配图不动），且素材绑定不变',
}[which]
say(`\n${expect}`)
say(`截图：${shot}`)

await browser.close()
