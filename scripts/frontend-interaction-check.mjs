// R27:真实 React 组件的浏览器交互回归；设置后端为受控桩，零模型调用、零真实配置写入。
// node scripts/frontend-interaction-check.mjs [outDir] [URL]
// 与 verify-ui 相同：VERIFY_PLAYWRIGHT / VERIFY_CHROMIUM 可指定现有运行依赖。
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createJudge, guardCrashes, parseRunnerArgs } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const { outDir, base } = parseRunnerArgs()
const judge = createJudge({ script: 'frontend-interaction-check', outDir, plannedCases: ['chat.', 'session.', 'docs.', 'settings.', 'app.'], minChecks: 67 })
guardCrashes(judge)
const check = (id, pass, evidence = '') => { judge.check(id, pass, evidence); console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${evidence ? ` (${evidence})` : ''}`) }
let browser
let playwright
try { playwright = require('playwright') } catch {
  try { playwright = require(process.env.VERIFY_PLAYWRIGHT || '') } catch { judge.block('找不到 Playwright；请设置 VERIFY_PLAYWRIGHT。'); judge.finish(); process.exit(2) }
}
try {
  browser = await playwright.chromium.launch(process.env.VERIFY_CHROMIUM ? { executablePath: process.env.VERIFY_CHROMIUM } : {})
} catch (e) { judge.block(`浏览器无法启动：${e.message}`); judge.finish(); process.exit(2) }
mkdirSync(outDir, { recursive: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => judge.error('page', e.message))
page.setDefaultTimeout(8000)
// Cold Vite module/knowledge loading can exceed 8s; interactions keep the tight
// timeout, while navigation gets a separate bounded startup allowance.
page.setDefaultNavigationTimeout(30000)
const dialogs = []
let acceptDialog = false
page.on('dialog', async (d) => { dialogs.push(d.message()); if (acceptDialog) await d.accept(); else await d.dismiss() })

async function mount(name, mode = '') {
  await page.evaluate(async ({ name, mode }) => {
    if (window.__fixture) window.__fixture.unmount()
    document.querySelector('#fixture')?.remove()
    delete window.__TAURI_INTERNALS__
    window.__actions = []
    const host = document.createElement('div')
    host.id = 'fixture'
    host.style.cssText = 'height:650px;width:900px;display:flex;flex-direction:column;position:relative'
    document.body.append(host)
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: Component } = await import(`/src/components/${name}.tsx`)
    const noop = () => {}
    let props
    if (name === 'ChatPane') props = { msgs: [], busy: false, status: '交互验证', onSend: (t) => window.__actions.push(t), onStop: noop }
    if (name === 'SessionRail') props = { items: [ { id: 'one', title: '秋日书市', count: 2, updatedAt: '2026-10-11T12:00:00Z' }, { id: 'two', title: '新品咖啡', count: 4, updatedAt: '2026-10-11T11:00:00Z' } ], currentId: 'one', error: null, unreadable: [], stateWarning: null, onRetry: noop, onNew: noop, onOpen: (id) => window.__actions.push(['open', id]), onDelete: (id) => window.__actions.push(['delete', id]), onRename: (id, title) => window.__actions.push(['rename', id, title]) }
    if (name === 'DocsPane') props = { items: [{ id: 'one', title: '秋日书市', updatedAt: '2026-10-11T12:00:00Z' }, { id: 'two', title: '新品咖啡', updatedAt: '2026-10-11T11:00:00Z' }], error: null, unreadable: [], onRetry: noop, onOpen: (id) => window.__actions.push(['open', id]), onDelete: noop }
    if (name === 'SettingsPanel') {
      window.__settingsMode = mode || 'normal'
      window.__settingsWrites = []
      window.__loadRelease = null
      window.__saveRelease = null
      window.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => {
        if (cmd === 'model_lock_state') return { locked: true, model: 'deepseek-flash' }
        if (cmd === 'load_settings') {
          if (window.__settingsMode === 'delayed') await new Promise((resolve) => { window.__loadRelease = resolve })
          if (window.__settingsMode === 'read-error') throw new Error('fixture read denied')
          return { api_key: 'fixture-key', base_url: 'https://api.deepseek.com', model: 'deepseek-flash', wx_appid: 'keep-appid', wx_secret: 'keep-secret', model_vision: 'deepseek-flash', vision_review: false, load_error: window.__settingsMode === 'corrupt' ? 'fixture invalid JSON' : null }
        }
        if (cmd === 'save_settings') {
          window.__settingsWrites.push(args.settings)
          if (window.__settingsMode === 'save-delayed') await new Promise((resolve) => { window.__saveRelease = resolve })
          return null
        }
        throw new Error(`unexpected command ${cmd}`)
      } }
      props = { onClose: () => { window.__actions.push('close'); window.__fixture.unmount() } }
    }
    window.__fixtureProps = props
    window.__fixture = createRoot(host)
    window.__renderFixture = (patch) => { window.__fixtureProps = { ...window.__fixtureProps, ...patch }; window.__fixture.render(React.createElement(Component, window.__fixtureProps)) }
    window.__renderFixture({})
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, { name, mode })
}
const render = async (props) => { await page.evaluate((p) => window.__renderFixture(p), props); await page.waitForTimeout(60) }

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('.rail-new').waitFor()
  await page.evaluate(() => { document.querySelector('#root').style.display = 'none'; const button = document.createElement('button'); button.id = 'fixture-opener'; button.textContent = '打开设置'; document.body.append(button) })
  await mount('ChatPane')
  const input = page.locator('#fixture .chat-input-row textarea')
  await input.fill('中文候选确认')
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  check('chat.IME确认不发送', await page.evaluate(() => window.__actions.length === 0) && await input.inputValue() === '中文候选确认')
  await input.press('Shift+Enter')
  check('chat.ShiftEnter只换行', await page.evaluate(() => window.__actions.length === 0) && (await input.inputValue()).includes('\n'))
  await input.press('Enter')
  check('chat.Enter发送完整文字', await page.evaluate(() => window.__actions[0] === '中文候选确认'))
  await render({ msgs: Array.from({ length: 35 }, (_, id) => ({ id, role: 'user', content: `历史消息 ${id}。保留滚动阅读位置。` })) })
  const bottom = () => page.locator('#fixture .chat-body').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)
  check('chat.新增消息自动跟到底部', await bottom() < 20)
  await page.locator('#fixture .chat-body').evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll', { bubbles: true })) })
  await page.evaluate(() => window.__renderFixture({ msgs: [...window.__fixtureProps.msgs, { id: 99, role: 'assistant', content: '新的回复仍在继续。' }] }))
  await page.locator('#fixture .chat-jump').waitFor()
  check('chat.上翻不被新回复拉回', await page.locator('#fixture .chat-body').evaluate((el) => el.scrollTop === 0))
  check('chat.新回复给回底部提示', (await page.locator('#fixture .chat-jump').textContent()).includes('有新内容'))
  await page.locator('#fixture .chat-jump').click()
  check('chat.回到底部按钮有效', await bottom() < 20)
  await render({ disabled: true })
  check('chat.文件忙碌禁发但不伪装模型工作', await input.isDisabled() && await page.locator('#fixture .work-bubble').count() === 0)
  await render({ disabled: false, busy: true })
  check('chat.模型忙碌允许停止', await page.locator('#fixture .btn-stop').isEnabled() && await input.isDisabled())

  await mount('SessionRail')
  await page.locator('#fixture .rail-query').fill('咖啡')
  check('session.标题搜索可定位会话', await page.locator('#fixture .sess-row').count() === 1 && await page.locator('#fixture .sess-row').getAttribute('data-id') === 'two')
  await page.locator('#fixture .sess-open').focus()
  await page.keyboard.press('Enter')
  check('session.键盘打开会话', await page.evaluate(() => window.__actions.some((a) => a[0] === 'open' && a[1] === 'two')))
  await page.locator('#fixture .sess-rename-action').click()
  await page.locator('#fixture .sess-rename').fill('改名完成')
  await page.locator('#fixture .sess-rename').dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  check('session.中文改名确认不提前提交', await page.locator('#fixture .sess-rename').count() === 1)
  await page.locator('#fixture .sess-rename').press('Enter')
  check('session.明确改名入口可提交', await page.evaluate(() => window.__actions.some((a) => a[0] === 'rename' && a[2] === '改名完成')))
  await render({ busy: true })
  check('session.忙碌禁切换改名删除新建', await page.locator('#fixture button:not(:disabled)').count() === 0)
  await page.locator('#fixture .rail-query').fill('不存在的关键词')
  check('session.搜索无结果不说会话消失', (await page.locator('#fixture .session-empty').textContent()).includes('匹配'))

  await mount('DocsPane')
  await page.locator('#fixture .docs-query').fill('书市')
  check('docs.标题搜索及结果数准确', await page.locator('#fixture .doc-row').count() === 1 && (await page.locator('#fixture .library-results').textContent()).includes('1'))
  await page.locator('#fixture .doc-open').focus()
  await page.keyboard.press('Enter')
  check('docs.键盘打开文档续改', await page.evaluate(() => window.__actions.some((a) => a[0] === 'open' && a[1] === 'one')))
  await render({ busy: true })
  check('docs.忙碌禁打开及删除', await page.locator('#fixture button:not(:disabled)').count() === 0)

  await page.locator('#fixture-opener').focus()
  await mount('SettingsPanel', 'delayed')
  check('settings.读取完成前不能空值保存', await page.locator('#fixture .settings-foot .btn-send').isDisabled() && await page.locator('#fixture .settings-foot .mini-danger').isDisabled())
  await page.evaluate(() => window.__loadRelease())
  await page.locator('#fixture .set-key').waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('#fixture .settings-foot .btn-send').disabled)
  check('settings.正常读取展示真实配置', await page.locator('#fixture .set-key').inputValue() === 'fixture-key')
  await page.locator('#fixture .settings-foot .btn-send').focus()
  await page.keyboard.press('Tab')
  check('settings.Tab不会穿过模态遮罩', await page.locator('#fixture .settings-head button').evaluate((el) => el === document.activeElement))
  await page.keyboard.press('Shift+Tab')
  check('settings.ShiftTab回到末项', await page.locator('#fixture .settings-foot .btn-send').evaluate((el) => el === document.activeElement))
  await page.keyboard.press('Escape')
  check('settings.Escape关闭并恢复入口焦点', await page.locator('#fixture .settings-panel').count() === 0 && await page.locator('#fixture-opener').evaluate((el) => el === document.activeElement))

  await mount('SettingsPanel', 'read-error')
  await page.locator('[data-settings-read-error="1"]').waitFor()
  check('settings.读取失败禁止覆盖或重置', await page.locator('#fixture .settings-foot .btn-send').isDisabled() && await page.locator('#fixture .settings-foot .mini-danger').isDisabled() && await page.evaluate(() => window.__settingsWrites.length === 0))
  await page.evaluate(() => { window.__settingsMode = 'normal' })
  await page.locator('#fixture .settings-retry').click()
  await page.waitForFunction(() => !document.querySelector('#fixture .settings-foot .btn-send').disabled)
  check('settings.失败后重读恢复真实配置', await page.locator('#fixture .set-key').inputValue() === 'fixture-key')
  await page.locator('#fixture .settings-foot .mini-danger').click()
  check('settings.取消恢复不写配置', dialogs.at(-1)?.includes('公众号凭据会保留') && await page.evaluate(() => window.__settingsWrites.length === 0))
  acceptDialog = true
  await page.locator('#fixture .settings-foot .mini-danger').click()
  check('settings.恢复默认保留隐藏公众号凭据', await page.evaluate(() => window.__settingsWrites.at(-1)?.wx_appid === 'keep-appid' && window.__settingsWrites.at(-1)?.wx_secret === 'keep-secret' && window.__settingsWrites.at(-1)?.api_key === ''))

  await mount('SettingsPanel', 'corrupt')
  await page.locator('[data-settings-load-error="1"]').waitFor()
  check('settings.损坏配置禁止普通保存', await page.locator('#fixture .settings-foot .btn-send').isDisabled())
  acceptDialog = false
  await page.locator('#fixture .settings-foot .mini-danger').click()
  check('settings.损坏配置重置有明确凭据风险确认', dialogs.at(-1)?.includes('清空其中的所有凭据') && await page.evaluate(() => window.__settingsWrites.length === 0))
  acceptDialog = true
  await page.locator('#fixture .settings-foot .mini-danger').click()
  check('settings.明确确认后可重置损坏配置', await page.evaluate(() => window.__settingsWrites.length === 1 && window.__settingsWrites[0].api_key === '') && await page.locator('#fixture .settings-foot .btn-send').isEnabled())

  await mount('SettingsPanel', 'save-delayed')
  await page.waitForFunction(() => !document.querySelector('#fixture .settings-foot .btn-send').disabled)
  await page.locator('#fixture .settings-foot .btn-send').click()
  check('settings.保存中禁重复保存及关闭', await page.locator('#fixture .settings-foot .btn-send').isDisabled() && await page.locator('#fixture .settings-head button').isDisabled())
  await page.keyboard.press('Escape')
  check('settings.保存中Escape不关闭', await page.locator('#fixture .settings-panel').count() === 1)
  await page.evaluate(() => window.__saveRelease())
  await page.waitForFunction(() => !document.querySelector('#fixture .settings-foot .btn-send').disabled)
  check('settings.保存完成只写一次', await page.evaluate(() => window.__settingsWrites.length === 1))

  await page.evaluate(() => { window.__fixture.unmount(); document.querySelector('#fixture').remove(); document.querySelector('#fixture-opener').remove(); delete window.__TAURI_INTERNALS__; document.querySelector('#root').style.display = '' })
  await page.locator('.chat-input-row textarea').fill('写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写')
  await page.locator('.chat-input-row textarea').press('Enter')
  await page.locator('.work-bubble').waitFor()
  check('app.生成中禁止会话切换与新建', await page.locator('.rail-new').isDisabled() && await page.locator('.sess-open:not(:disabled)').count() === 0)
  await page.waitForFunction(() => !document.querySelector('.work-bubble') && !!document.querySelector('iframe[title="推文预览"]'), null, { timeout: 60000 })
  const frame = page.frameLocator('iframe[title="推文预览"]')
  check('app.文章视口确为375像素', await frame.locator('body').evaluate(() => window.innerWidth) === 375)
  acceptDialog = false
  await page.locator('[data-act="clear"]').click()
  check('app.取消清空保留成稿', dialogs.at(-1)?.includes('清空') && await page.locator('iframe[title="推文预览"]').count() === 1)
  await page.locator('.chat-input-row textarea:visible').fill('切换工作区后仍保留的未发送草稿')
  await page.locator('[data-view="docs"]').click()
  await page.locator('[data-view="chat"]').click()
  check('app.工作区切换保留未发送草稿', await page.locator('.chat-input-row textarea:visible').inputValue() === '切换工作区后仍保留的未发送草稿')
  if (await page.locator('.sess-btn').getAttribute('data-open') === '1') await page.locator('.sess-btn').click()
  const views = [{ width: 1500, height: 900 }, { width: 1000, height: 760 }, { width: 780, height: 760 }, { width: 390, height: 844 }]
  for (const size of views) {
    await page.setViewportSize(size)
    for (const view of ['chat', 'docs', 'assets']) {
      await page.locator(`[data-view="${view}"]`).click()
      check(`app.${size.width}px.${view}.页面不横溢`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      const target = view === 'chat' ? '.chat-input-row textarea:visible' : view === 'docs' ? '.docs-query:visible' : '.ws-desc:visible'
      await page.locator(target).click({ trial: true })
      check(`app.${size.width}px.${view}.主操作可触达`, await page.locator(target).isVisible())
      if (size.width === 1000 && view === 'chat') {
        const widths = () => page.evaluate(() => ['.chat-pane', '.preview-pane'].map((selector) => document.querySelector(selector).getBoundingClientRect().width))
        const before = await widths()
        await page.locator('.sess-btn').click()
        const after = await widths()
        check('app.1000px.会话抽屉不挤压正文', before.every((w, i) => Math.abs(w - after[i]) < 1), JSON.stringify({ before, after }))
        await page.locator('.sess-btn').click()
      }
      if (size.width === 390 && view === 'chat') check('app.390px.长工作区在内部滚动', await page.evaluate(() => {
        const workspace = document.querySelector('.workspace:not([hidden])')
        return document.documentElement.scrollHeight <= document.documentElement.clientHeight && workspace.scrollHeight > workspace.clientHeight
      }))
    }
    await page.locator('.topbar-settings').click()
    await page.waitForFunction(() => !document.querySelector('.settings-foot .btn-send').disabled)
    await page.locator('.settings-foot .btn-send').click({ trial: true })
    check(`app.${size.width}px.settings.保存按钮可触达且页面不横溢`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await page.keyboard.press('Escape')
  }
  for (const view of ['chat', 'docs', 'assets']) {
    await page.locator(`[data-view="${view}"]`).click()
    await page.screenshot({ path: join(outDir, `${view}-375.png`), clip: { x: 7, y: 106, width: 375, height: 550 } })
  }
  await page.locator('.topbar-settings').click()
  await page.waitForFunction(() => !document.querySelector('.settings-foot .btn-send').disabled)
  await page.screenshot({ path: join(outDir, 'settings-375.png'), clip: { x: 7, y: 80, width: 375, height: 550 } })
  judge.observe('截图范围', '4张375×550、deviceScaleFactor1局部截图；未读图，不以截图存在代替视觉签收。')
  // 真实 App 恢复故障：B 无成品且素材库损坏，超过自动存档防抖后仍不可污染 A。
  const faultPage = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const recoveryErrors = []
  let recoveryExternal = 0
  faultPage.on('pageerror', (e) => recoveryErrors.push(e.message))
  await faultPage.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(base).origin && url.protocol.startsWith('http')) { recoveryExternal++; return route.abort() }
    return route.continue()
  })
  await faultPage.addInitScript(() => {
    localStorage.clear()
    const a = [{ id: 1, role: 'user', content: 'A 的原始消息必须保持' }]
    const b = [{ id: 2, role: 'assistant', content: 'B 文稿恢复记录\n```v2\n# B 文稿\n[[asset:deco|as-missing|缺失素材]]\n```' }]
    localStorage.setItem('wxmp-sessions-v1', JSON.stringify({ current: 's-a', items: {
      's-a': { title: '会话 A', updatedAt: '2026-10-11T00:00:00Z', mode: 'auto', style: 'auto', messages: a },
      's-b': { title: '会话 B', updatedAt: '2026-10-11T00:00:00Z', mode: 'auto', style: 'auto', messages: b },
    } }))
    localStorage.setItem('wxmp-assets-v1', '{ broken asset library')
    window.__expectedA = JSON.stringify(a)
    window.__expectedB = JSON.stringify(b)
  })
  await faultPage.goto(base, { waitUntil: 'networkidle' })
  await faultPage.locator('.sess-row[data-id="s-b"] .sess-open').click()
  await faultPage.waitForFunction(() => document.querySelector('[data-notice="1"]')?.textContent.includes('素材库读取失败'))
  await faultPage.waitForTimeout(1100)
  const recovered = await faultPage.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('wxmp-sessions-v1'))
    return {
      a: JSON.stringify(stored.items['s-a'].messages) === window.__expectedA,
      b: JSON.stringify(stored.items['s-b'].messages) === window.__expectedB,
      current: stored.current,
    active: document.querySelector('.sess-active')?.getAttribute('data-id'),
      text: document.querySelector('.chat-body')?.textContent,
      enabled: !document.querySelector('.chat-input-row textarea')?.disabled,
    }
  })
  check('app.恢复失败不把B消息存进A', recovered.a)
  check('app.恢复失败后持久化B仍属于B', recovered.b && recovered.current === 's-b')
  check('app.恢复失败后显示内容与会话归属一致', recovered.active === 's-b' && recovered.text.includes('B 文稿'))
  check('app.恢复失败后交互锁解除', recovered.enabled)
  check('app.恢复故障零外部调用且没有未处理异常', recoveryExternal === 0 && recoveryErrors.length === 0)
  await faultPage.close()
} catch (e) { judge.error('runner', e.stack || e.message); console.error(e) }
finally { await browser.close(); judge.finish() }
