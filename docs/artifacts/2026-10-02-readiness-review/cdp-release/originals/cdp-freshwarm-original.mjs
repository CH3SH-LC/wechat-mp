// 临时探针（仓库外）：default release exe × fresh/warm profile 的 CDP 对照（零模型、零密钥）
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { closeOwnPid, freePort, launchDesktop, prepareIsolation, procIdentity, waitForCdp } from 'file:///D:/deepseek-harness/wechat-mp-desktop/scripts/lib/desktop-harness.mjs'

const exe = 'D:/deepseek-harness/wechat-mp-desktop/src-tauri/target/release/wechat-mp-desktop.exe'
const iso = prepareIsolation('cdp-fw-' + Date.now().toString(36))
const marker = join(iso.webview, 'EBWebView', 'Local State')
const out = { iso, exe, runs: [] }
console.log('[iso]', JSON.stringify(iso))

for (const round of [1, 2]) {
  const cdpPort = await freePort()
  const launch = launchDesktop(exe, { profile: iso.profile, webview: iso.webview, cdpPort })
  const identity = procIdentity(launch.pid, exe)
  const rec = { round, cdpPort, pid: launch.pid, markerBeforeLaunch: existsSync(marker), identity, cdp: null, close: null }
  console.log(`[round ${round}] pid=${launch.pid} port=${cdpPort} markerBeforeLaunch=${rec.markerBeforeLaunch} identityComplete=${identity.identityComplete}`)
  const t0 = Date.now()
  let pages = null
  try {
    pages = await waitForCdp(cdpPort, 90000)
    rec.cdp = { ok: true, ms: Date.now() - t0, pages: pages.map((p) => ({ type: p.type, url: p.url, dbg: !!p.webSocketDebuggerUrl })) }
  } catch (e) {
    rec.cdp = { ok: false, ms: Date.now() - t0, error: String(e.message || e) }
  }
  console.log(`[round ${round}] cdp=${JSON.stringify(rec.cdp).slice(0, 300)}`)
  if (round === 1) { await new Promise((r) => setTimeout(r, 15000)) } // 预热沉降
  rec.close = await closeOwnPid(launch.pid, { exe, expectedIdentity: identity })
  console.log(`[round ${round}] close via=${rec.close.via} closed=${rec.close.closed} refused=${rec.close.refused}`)
  out.runs.push(rec)
}
console.log('RESULT ' + JSON.stringify(out, null, 1))
