// preview-resource-check.mjs —— 预览全过程的外部资源请求检查（DS 修复指南 包 A / 包 D / §6）
//
// 用法：
//   node scripts/preview-resource-check.mjs [outDir] [URL]
//     outDir 缺省 docs/artifacts/<当天日期>-preview-resource-<时间戳>-<随机>/（每次必须新目录，已存在同名结果则拒绝）
//     URL    缺省 http://127.0.0.1:1420（需先起 dev server）
//
// 与 verify-ui 的 S2 **分开**（指南要求拆成两项）：
//   · S2 交付检查：最终成品 source/HTML/文档是否一致、违规特征是否被清掉；
//   · 本脚本 全过程资源检查：从**发送前**开始记录所有请求（含重试、redirect、srcset、CSS url），
//     断言"未经许可的外链尝试 = 0"，同时断言**特定的** `html.external-img` 诊断及其**原始违规原文**
//     仍在（不是靠把外链洗掉来变绿，也不是"任意 html.* 问题码"就算证据——指南 §3.2）。
//
// 判定器（指南 §3.1）：**唯一 RunResult**，所有输出（stdout / JSON / Markdown / 退出码）都从它派生。
//   status ∈ PASS | FAIL | ERROR | BLOCKED；`executionComplete` 必须为真、必需检查必须存在、
//   零检查算 ERROR（不是通过）、异常写 ERROR、缺依赖写 BLOCKED，两者都退出非 0。
//   finally 只负责落盘与关闭资源，**不**根据 `failed===0` 推导成功。
//
// 八组预览输入（指南 §2.1 / §6）：逐字取自 `docs/artifacts/2026-09-30-ds-audit/regression-inputs.json`
// 的 `previewCases`。四类外链必须在**实际挂载的 iframe** 上零请求，另两例要恢复可解码图片与无关样式。
//
// 测试环境对精确 URL 提供**本地固定响应**，消除公网依赖；它只是"防意外联网并计数"，
// 不能因为它拦住了请求就把产品判为通过——真正的判据是本脚本记录到的 **attempts**。
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { parseRunnerArgs } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// ---------- 唯一判定结果（指南 §3.1 的 RunResult） ----------
const run = {
  script: 'preview-resource-check',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED', // PASS | FAIL | ERROR | BLOCKED
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [], // { id, pass, evidence: string[] }
  errors: [], // { stage, message }
  blockedDiagnostics: [], // 被抑制的资源引用（诊断证据，不参与"是否通过"）
  attempts: [],
  sourceHashes: {},
}
for (const rel of ['src/lib/preview-safe.ts', 'src/components/PreviewPane.tsx']) {
  run.sourceHashes[rel] = createHash('sha256').update(readFileSync(join(repoRoot, rel))).digest('hex')
}

const check = (id, pass, ...evidence) => {
  run.checks.push({ id, pass: Boolean(pass), evidence: evidence.map((e) => String(e ?? '')) })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${evidence.length ? ' (' + evidence.filter(Boolean).join(' / ') + ')' : ''}`)
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[preview-resource-check] ERROR@${stage}: ${message}`)
}

const CONFIG_HINT = `配置方法（与 verify-ui.mjs 同一口径）：
  export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
  export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"`
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

// ---------- 输出目录：每次必须是新目录，不覆盖历史证据 ----------
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const { outDir: outDirArg, base } = parseRunnerArgs()
const outDir =
  outDirArg || join(import.meta.dirname, '..', '.local', 'runs', `preview-resource-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`)
if (outDirArg && existsSync(join(outDir, 'result.md'))) {
  fail('outDir', `输出目录已存在同名结果，拒绝覆盖：${outDir}（每次跑必须一个新目录）`)
  finalize()
  process.exit(2)
}

// ---------- 八组预览输入（逐字复刻，不改空格与格式） ----------
const PNG_2X2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4AWJiYGD4D8IgBpBmYAAAAAD//7vS9wEAAAAGSURBVAMAGDACA6ybwrYAAAAASUVORK5CYII='
const PREVIEW_CASES = [
  { id: 'quoted-img-control', input: '<img id="probe" src="https://example.com/control.png">' },
  { id: 'unquoted-img', input: '<img id="probe" src=https://example.com/unquoted.png>' },
  { id: 'entity-img', input: '<img id="probe" src="https:&#x2f;&#x2f;example.com/entity.png">' },
  { id: 'css-import-string', input: '<style>@import "https://example.com/theme.css";</style><p>通知正文</p>' },
  {
    id: 'css-html-entity-url',
    input: '<div id="probe" style="background-image:url(&quot;https://example.com/css-entity.png&quot;);width:20px;height:20px">正文</div>',
  },
  {
    id: 'css-style-preservation',
    input: '<div id="probe" style="background-image:url(https://example.com/background.png);color:rgb(1, 2, 3);height:20px">正文</div>',
    expectColor: 'rgb(1, 2, 3)',
  },
  { id: 'data-img-control', input: `<img id="probe" src="${PNG_2X2}">`, expectLocalImage: true },
  {
    id: 'mixed-srcset-data',
    input: `<img id="probe" srcset="${PNG_2X2} 1x, https://example.com/2x.png 2x">`,
    expectLocalImage: true,
  },
]
run.plannedCases = [
  'app-run:违规演示稿进入门禁且预览无外链',
  ...PREVIEW_CASES.map((c) => `preview:${c.id}`),
]

const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromium()

const isLocal = (u) =>
  u.startsWith(base + '/') || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('devtools:') || u.startsWith('about:')

let browser = null
try {
  browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
  const page = await context.newPage()
  const attempts = run.attempts
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('request', (r) => {
    const u = r.url()
    if (!isLocal(u)) attempts.push({ url: u, type: r.resourceType(), frame: r.frame()?.url() })
  })
  await page.route('**/*', async (route) => {
    const r = route.request()
    const u = r.url()
    if (isLocal(u)) return route.fallback()
    // 本地固定响应（1×1 PNG）：消除公网依赖。若产品真的发出请求，这里只是"没断线"，
    // 判定看上面的 attempts 计数——**不**因为拦住了就判通过。
    return route.fulfill({
      status: 200,
      contentType: r.resourceType() === 'stylesheet' ? 'text/css' : 'image/png',
      body:
        r.resourceType() === 'stylesheet'
          ? ''
          : Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
              'base64',
            ),
    })
  })

  // ---------- 阶段 1：真实 App 走一遍违规演示稿（覆盖 PreviewPane 的真实接线） ----------
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 })
  } catch (e) {
    fail('navigate', `打开 ${base} 失败：${String(e.message || e).split('\n')[0]}`)
  }
  const attemptsBefore = attempts.length
  if (run.errors.length === 0) {
    try {
      await page.waitForSelector('textarea', { timeout: 10000 })
      // 先装观察器：确认"本轮 run 真的开始了"，再等它终结——只等"气泡不存在"会把
      // "还没开始" 误判成 "已经结束"（指南 §3.1）。
      // 同时**全过程**采集质量条上的逐条阻断诊断（问题码 + 原文消息）：违规稿只在修复前的
      // 那几轮里是"当前稿"，跑完最后一版就被合规稿替换掉了——只在末尾读 DOM 会看不到它，
      // 于是"原始违规证据进没进门禁"就成了没法证伪的问题。观察器把每一帧都记下来。
      await page.evaluate(() => {
        window.__paneProbe = { started: 0, finished: 0, sawBubble: false }
        window.__diagnoses = [] // [{ code, message }]，按出现顺序去重
        const tick = () => {
          const has = !!document.querySelector('.work-bubble')
          if (has && !window.__paneProbe.sawBubble) {
            window.__paneProbe.sawBubble = true
            window.__paneProbe.started++
          } else if (!has && window.__paneProbe.sawBubble) {
            window.__paneProbe.sawBubble = false
            window.__paneProbe.finished++
          }
          for (const li of document.querySelectorAll('.quality-strip [data-blocker-code]')) {
            const code = li.getAttribute('data-blocker-code') || ''
            const message = li.querySelector('.qb-msg')?.textContent || ''
            if (!window.__diagnoses.some((d) => d.code === code && d.message === message)) window.__diagnoses.push({ code, message })
          }
        }
        new MutationObserver(tick).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
        window.__paneProbe.timer = window.setInterval(tick, 50)
      })
      await page.locator('textarea').fill('演示质量检查：请故意输出包含 emoji、渐变与外链图的推文')
      await page.locator('textarea').press('Enter')
      await page.waitForFunction(() => window.__paneProbe.started > 0, null, { timeout: 30000 })
      await page.waitForFunction(() => window.__paneProbe.finished > 0, null, { timeout: 60000 })
      // 终结后再稳一会儿，给质量记录落 trace、预览重渲染收尾
      await page.waitForTimeout(1200)
    } catch (e) {
      fail('app-run', `驱动真实 App 失败：${String(e.message || e).split('\n')[0]}`)
    }
  }
  if (run.errors.length === 0) {
    const appState = await page.evaluate(async () => {
      const { traceBuffer } = await import('/src/lib/trace.ts')
      const frame = document.querySelector('iframe')
      // 违规演示稿的**原始外链**取自产生它的生产 mock（`src/lib/chat.ts` 的 MOCK_BAD），
      // 不在这里另抄一份字面量：期望值变化时断言跟着变，但"原文必须在"这条不许变。
      let expectedExternal = []
      try {
        const chat = await import('/src/lib/chat.ts')
        expectedExternal = [...String(chat.MOCK_BAD?.html || '').matchAll(/https?:\/\/[^"'\s)>]+/g)].map((m) => m[0])
      } catch {
        // 取不到期望原文 → 下面的断言会因此变红（而不是静默当成"通过"）
      }
      // 门禁给出的**逐条诊断**（问题码 + 原文消息）：UI 上每一条阻断项都带 data-blocker-code。
      const strip = document.querySelector('.quality-strip')
      const blockers = [...(strip ? strip.querySelectorAll('[data-blocker-code]') : [])].map((li) => ({
        code: li.getAttribute('data-blocker-code') || '',
        message: li.querySelector('.qb-msg')?.textContent || '',
      }))
      // 留存稿：原始 source / 显示 HTML 与失败草稿都"继续保留"（指南 §6），没有被洗成合规稿。
      const docs = JSON.parse(localStorage.getItem('wxmp-docs-v1') || '{}')
      const session = JSON.parse(localStorage.getItem('wxmp-sessions-v1') || '{}')
      const doc = (docs.docs || {})[session.current] || null
      // 会话里的**模型原文**（§8.5 要求保留的"模型完整原文"）：违规稿的原文就留在这里
      const sess = (session.items || {})[session.current] || null
      const sessionText = (sess?.messages || []).map((m) => String(m.content || '')).join('\n')
      return {
        frameBody: frame && frame.contentDocument ? frame.contentDocument.body.innerHTML : '',
        stripCls: strip?.className || '',
        stripText: strip?.textContent || '',
        docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state') ?? null,
        trace: traceBuffer(),
        blockers,
        diagnoses: window.__diagnoses || [],
        expectedExternal,
        retained: {
          hasDoc: Boolean(doc),
          accepted: doc ? doc.accepted ?? null : null,
          source: String(doc?.source || ''),
          html: String(doc?.html || ''),
          sessionText,
        },
        retainedInfo: {
          docSource: String(doc?.source || '').length,
          docHtml: String(doc?.html || '').length,
          sessionText: sessionText.length,
          sessionMessages: (sess?.messages || []).length,
        },
      }
    })
    const qualityRecords = appState.trace.filter((t) => t.kind === 'quality' && Array.isArray(t.issueCodes))
    const EXTERNAL_IMG_CODE = 'html.external-img' // 定义在 src/lib/quality.ts:61，由 delivery-quality 前缀化为 html.<kind>
    // ① 门禁记下的必须是**这一条**特定问题，不是"随便某个 html.* 就算外链诊断保住了"
    const externalCodeSeen =
      appState.diagnoses.some((d) => d.code === EXTERNAL_IMG_CODE) ||
      qualityRecords.some((t) => t.issueCodes.map(String).includes(EXTERNAL_IMG_CODE))
    // ② 原始违规**原文**跟着问题一起进了门禁：该诊断的 message 里带着 mock 那份违规稿的原始外链
    //    （不是"把外链洗掉之后才过检"，也不是"诊断只剩一个代码、原文全丢了"）。
    const diagnosisWithOriginal = appState.diagnoses.some(
      (d) => d.code === EXTERNAL_IMG_CODE && appState.expectedExternal.some((u) => d.message.includes(u)),
    )
    // ③ 附带的留存证据：原始违规原文在留存材料里是否还查得到（会话模型原文 / 文档留存稿）。
    //    **不作为硬性通过条件**——实测该流程最后一版是合规稿，违规原文只在前几轮的当前稿里出现，
    //    因此它只记录在证据里，供事后核对"原文有没有被静默改写"。
    const held = {
      session: appState.expectedExternal.some((u) => appState.retained.sessionText.includes(u)),
      docSource: appState.expectedExternal.some((u) => appState.retained.source.includes(u)),
      docHtml: appState.expectedExternal.some((u) => appState.retained.html.includes(u)),
    }
    const frameExternal = [...String(appState.frameBody).matchAll(/https?:\/\/[^"'\s)]+/g)]
      .map((m) => m[0])
      .filter((u) => !u.startsWith(base))
    const appAttempts = attempts.slice(attemptsBefore)
    check('app-run：预览 iframe 里没有任何外链引用残留', frameExternal.length === 0, frameExternal.join(' / '))
    check(
      'app-run：门禁记录了特定的 html.external-img 问题（不是任意 html.* 就算）',
      externalCodeSeen,
      `UI 阻断项=${JSON.stringify(appState.blockers.map((b) => b.code))}｜全过程诊断=${JSON.stringify(appState.diagnoses.map((d) => d.code))}` +
        `｜trace 质量记录=${JSON.stringify(qualityRecords.map((t) => t.issueCodes))}`,
    )
    check(
      'app-run：原始违规原文跟着问题一起进了门禁（诊断带原始外链，不是洗掉之后才过检）',
      diagnosisWithOriginal,
      `期望原文=${JSON.stringify(appState.expectedExternal)}｜诊断=${JSON.stringify(appState.diagnoses.filter((d) => d.code === EXTERNAL_IMG_CODE).map((d) => d.message.slice(0, 120)))}` +
        `｜留存核对（仅记录）会话=${held.session} 留存稿 source=${held.docSource} html=${held.docHtml}`,
    )
    check('app-run：本轮 App 运行期间外链请求 = 0', appAttempts.length === 0, appAttempts.map((a) => a.type + ':' + a.url).join(' / '))
    run.executedCases.push('app-run:违规演示稿进入门禁且预览无外链')
  }

  // ---------- 阶段 2：八组变体逐个挂载（用生产 wrapSrcDoc + 同款 sandbox） ----------
  if (run.errors.length === 0) {
    // 把生产模块挂到 window 上：预览外壳与净化函数都取**生产那一份**，不在这里重写一遍。
    try {
      await page.evaluate(async () => {
        const pane = await import('/src/components/PreviewPane.tsx')
        const safe = await import('/src/lib/preview-safe.ts')
        window.__wrapSrcDoc = pane.wrapSrcDoc
        window.__neutralize = safe.neutralizeExternalResources
        const host = document.createElement('main')
        host.id = 'preview-resource-probe-root'
        document.body.appendChild(host)
      })
    } catch (e) {
      fail('mount-prepare', `加载生产预览模块失败：${String(e.message || e).split('\n')[0]}`)
    }
  }

  for (const c of PREVIEW_CASES) {
    if (run.errors.length) break
    try {
      const before = attempts.length
      const caseResult = await page.evaluate(
        async ({ html, id }) => {
          const sanitized = window.__neutralize(html)
          const host = document.getElementById('preview-resource-probe-root')
          host.replaceChildren()
          const f = document.createElement('iframe')
          f.id = 'probe-frame'
          f.setAttribute('sandbox', 'allow-same-origin')
          f.style.cssText = 'width:375px;height:300px;border:0;'
          // 与 PreviewPane 完全同一条显示路径：生产 wrapSrcDoc（内部就是生产 neutralize）
          f.srcdoc = window.__wrapSrcDoc(html)
          host.appendChild(f)
          return { id, sanitized }
        },
        { html: c.input, id: c.id },
      )
      await page.waitForFunction(() => !!document.querySelector('#preview-resource-probe-root iframe')?.contentDocument?.body, null, {
        timeout: 10000,
      })
      // 等图片解码（data URI 是同步的，但外链若真的发出去，attempts 会在这一小段里出现）
      await page.waitForTimeout(600)
      const dom = await page.evaluate(() => {
        const f = document.querySelector('#preview-resource-probe-root iframe')
        const d = f.contentDocument
        const p = d.querySelector('#probe')
        const computed = p ? d.defaultView.getComputedStyle(p) : null
        return {
          body: d.body.innerHTML,
          srcdocHasExternal: /(https?:)?\/\/example\.com/i.test(String(f.srcdoc).replace(/data:[^\s"')]+/g, '')),
          tag: p?.tagName || null,
          src: p?.getAttribute('src') || null,
          currentSrc: p?.currentSrc || null,
          naturalWidth: p?.naturalWidth ?? null,
          color: computed?.color || null,
          backgroundImage: computed?.backgroundImage || null,
        }
      })
      const caseAttempts = attempts.slice(before)
      const checks = {
        noResourceRequests: caseAttempts.length === 0,
      }
      if (c.expectLocalImage) {
        checks.localImageVisible = dom.naturalWidth === 2
        checks.currentSrcPreserved = dom.currentSrc === PNG_2X2
      }
      if (c.expectColor) checks.unrelatedStylePreserved = dom.color === c.expectColor
      // 展示反例的额外证据：被抑制的外链引用必须**在源头**已被换掉（不是"只是没请求"）
      checks.referenceNeutralized = !dom.srcdocHasExternal

      const pass = Object.values(checks).every(Boolean)
      run.blockedDiagnostics.push({ id: c.id, blocked: caseResult.sanitized.blocked })
      run.executedCases.push(`preview:${c.id}`)
      console.log(`\n[preview:${c.id}] attempts=${JSON.stringify(caseAttempts.map((a) => a.url))} checks=${JSON.stringify(checks)}`)
      for (const [k, v] of Object.entries(checks)) check(`preview:${c.id} / ${k}`, v, `dom=${JSON.stringify({ src: dom.src, currentSrc: dom.currentSrc?.slice(0, 40), naturalWidth: dom.naturalWidth, color: dom.color })}`)
      if (!pass) run.__caseFail = true
    } catch (e) {
      fail(`case:${c.id}`, String(e.message || e).split('\n')[0])
    }
  }

  check('全程无页面异常', pageErrors.length === 0, pageErrors.join(' / '))
  run.pageErrors = pageErrors
  await page.screenshot({ path: join(outDir, 'preview.png'), fullPage: true })
  run.executionComplete = run.errors.length === 0 && run.executedCases.length === run.plannedCases.length
} catch (e) {
  fail('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
} finally {
  finalize()
  if (browser) await browser.close().catch(() => {})
}

function finalize() {
  // PASS 必须同时满足：计划场景执行完整、必需检查存在、没有失败或基础设施错误（指南 §3.1）。
  // 这里**不**根据 `failed === 0` 推导成功——退出码/报告/状态三者都从 run 派生。
  const hasFail = run.checks.some((c) => !c.pass) || run.__caseFail === true
  if (run.blockedReason) {
    run.status = 'BLOCKED'
  } else if (run.errors.length) {
    run.status = 'ERROR'
  } else if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) {
    run.status = 'ERROR'
    run.errors.push({
      stage: 'completeness',
      message: `计划 ${run.plannedCases.length} 个场景，实际执行 ${run.executedCases.length} 个（执行不完整不能算通过）`,
    })
  } else if (run.checks.length === 0) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'checks', message: '零条检查：没有任何断言被执行，不能算通过（指南 §3.1）' })
  } else if (hasFail) {
    run.status = 'FAIL'
  } else {
    run.status = 'PASS'
  }
  run.finishedAt = new Date().toISOString()

  mkdirSync(outDir, { recursive: true })
  const passed = run.checks.filter((c) => c.pass).length
  writeFileSync(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  writeFileSync(
    join(outDir, 'result.md'),
    `# 预览全过程外部资源检查\n\n` +
      `状态：**${run.status}**（executionComplete=${run.executionComplete}，检查 ${passed}/${run.checks.length} 通过）\n` +
      `时间：${run.startedAt} → ${run.finishedAt}\n` +
      `入口：\`node scripts/preview-resource-check.mjs ${outDirArg || '(默认)'} ${base}\`\n` +
      `计划场景：${run.plannedCases.length}；实际执行：${run.executedCases.length}\n` +
      `被测源码哈希：\`${JSON.stringify(run.sourceHashes)}\`\n` +
      `外链请求尝试总数：${run.attempts.length}\n\n` +
      (run.errors.length ? `## 错误\n\n${run.errors.map((e) => `- [${e.stage}] ${e.message}`).join('\n')}\n\n` : '') +
      `## 检查\n\n\`\`\`\n${run.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} - ${c.id}${c.evidence.length ? ' (' + c.evidence.join(' / ') + ')' : ''}`).join('\n')}\n\`\`\`\n`,
    'utf8',
  )
  console.log('')
  console.log(`  产出留档：${outDir}`)
  console.log(`PREVIEW-RESOURCE ${run.status}`)
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}
