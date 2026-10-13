// R32 原图链：真实 ChatPane / compose / session / export 模块，受控文件存储 IPC。
// 不调用模型、不碰真实作品；Rust 原始字节/路径导入另有单元与桌面验收。
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createJudge, guardCrashes, parseRunnerArgs } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const { outDir, base } = parseRunnerArgs()
const judge = createJudge({ script: 'local-image-check', outDir, plannedCases: ['input.', 'picker.', 'render.', 'persist.', 'failure.'], minChecks: 45 })
guardCrashes(judge)
const check = (id, pass, evidence = '') => { judge.check(id, pass, evidence); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${evidence}`) }
let browser
try {
  let pw
  try { pw = require('playwright') } catch { pw = require(process.env.VERIFY_PLAYWRIGHT || '') }
  browser = await pw.chromium.launch(process.env.VERIFY_CHROMIUM ? { executablePath: process.env.VERIFY_CHROMIUM } : {})
} catch (e) { judge.block(`浏览器依赖不可用：${e.message}`); judge.finish(); process.exit(2) }
mkdirSync(outDir, { recursive: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(10000)
page.on('pageerror', (e) => judge.error('page', e.message))
try {
  // 避免挂载 App 的后台启动；仅加载真实待测组件。
  await page.route('**/src/main.tsx*', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const fixture = await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: ChatPane } = await import('/src/components/ChatPane.tsx')
    const records = {}
    const imports = []
    window.__records = records
    window.__imports = imports
    window.__exports = []
    window.__sessions = {}
    window.__holdImport = false
    window.__insertionListing = { directory: 'C:\\Users\\中文用户\\Documents\\wechat-mp-workspace\\待插入图片', images: [], warnings: [] }
    window.__insertionOpens = 0
    window.__holdListing = false
    window.__listingError = ''
    window.__folderError = ''
    window.__imageReads = 0
    window.__eventCallbacks = {}; window.__eventListeners = {}; let callbackId = 0
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (event) => { delete window.__eventListeners[event] } }
    const make = (color) => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 50
      const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 80, 50)
      return canvas.toDataURL('image/png')
    }
    window.__red = make('#b33640'); window.__blue = make('#297699'); window.__green = make('#4d9168')
    window.__TAURI_INTERNALS__ = { transformCallback: (fn) => { const id = ++callbackId; window.__eventCallbacks[id] = fn; return id }, invoke: async (cmd, args) => {
      if (cmd === 'plugin:event|listen') { window.__eventListeners[args.event] = args.handler; return args.handler }
      if (cmd === 'plugin:event|unlisten') return null
      if (cmd === 'list_insertion_images') {
        if (window.__holdListing) await new Promise((resolve) => { window.__releaseListing = resolve })
        if (window.__listingError) throw new Error(window.__listingError)
        return structuredClone(window.__insertionListing)
      }
      if (cmd === 'open_insertion_image_folder') {
        if (window.__folderError) throw new Error(window.__folderError)
        window.__insertionOpens++; return window.__insertionListing.directory
      }
      if (cmd === 'import_local_image') {
        if (window.__holdImport) await new Promise((resolve) => { window.__releaseImport = resolve })
        if (args.name === 'broken.png') throw new Error('图片文件损坏，无法解码')
        if (args.path) { window.__nativeImportedPath = args.path; args.dataUrl = window.__red }
        const bytes = Uint8Array.from(atob(args.dataUrl.split(',')[1]), (v) => v.charCodeAt(0))
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
        const record = { assetId: `li-${hash}`, name: args.name, mime: 'image/png', width: 80, height: 50, byteLength: bytes.length, dataUrl: args.dataUrl, modelDataUrl: window.__blue }
        records[record.assetId] = record; imports.push(args.name); return record
      }
      if (cmd === 'get_local_image') {
        window.__imageReads++
        const record = records[args.assetId]
        if (!record) throw new Error('原图不存在')
        return record
      }
      if (cmd === 'save_session') { window.__sessions[args.id] = structuredClone(args); return null }
      if (cmd === 'open_session') return { ...window.__sessions[args.id], updated_at: '2026-10-12' }
      if (cmd === 'export_html') { window.__exports.push(args.html); return 'fixture/article.html' }
      throw new Error(`Unexpected IPC ${cmd}`)
    } }
    const host = document.querySelector('#root'); host.style.cssText = 'height:650px;width:800px'
    const root = createRoot(host)
    window.__attachments = []; window.__sent = []
    window.__chatActive = true
    window.__chatBusy = false
    window.__chatDisabled = false
    window.__importChanges = []
    window.__messages = []
    const render = () => root.render(React.createElement(ChatPane, { msgs: window.__messages, busy: window.__chatBusy, disabled: window.__chatDisabled, active: window.__chatActive, status: '原图检查', images: window.__attachments,
      onAttachImages: (items) => { window.__attachments.push(...items); render() }, onRemoveImage: (i) => { window.__attachments.splice(i, 1); render() },
      onImportingChange: (value) => { window.__importChanges.push(value) },
      onSend: (text) => window.__sent.push(text), onStop: () => {},
    }))
    window.__renderChat = render
    render()
    return { red: window.__red, blue: window.__blue, green: window.__green }
  })
  const redBytes = Buffer.from(fixture.red.split(',')[1], 'base64')
  const blueBytes = Buffer.from(fixture.blue.split(',')[1], 'base64')
  const chooser = page.locator('input[type=file]')
  await chooser.setInputFiles({ name: '中文 空格原图.png', mimeType: 'image/png', buffer: redBytes })
  await page.waitForFunction(() => window.__attachments.length === 1)
  check('input.file-picker-imports-before-send', await page.evaluate(() => window.__imports[0] === '中文 空格原图.png' && /^li-[a-f0-9]{64}$/.test(window.__attachments[0].assetId)))
  await page.locator('textarea').evaluate((el, data) => {
    const dt = new DataTransfer(); dt.items.add(new File([Uint8Array.from(atob(data.split(',')[1]), (v) => v.charCodeAt(0))], '粘贴图片.png', { type: 'image/png' }))
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
  }, fixture.blue)
  await page.waitForFunction(() => window.__attachments.length === 2)
  check('input.paste-imports-image', await page.evaluate(() => window.__imports[1] === '粘贴图片.png'))
  await page.locator('.chat-pane').evaluate((el, data) => {
    const dt = new DataTransfer(); dt.items.add(new File([Uint8Array.from(atob(data.split(',')[1]), (v) => v.charCodeAt(0))], '拖入图片.png', { type: 'image/png' }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, fixture.red)
  await page.waitForFunction(() => window.__attachments.length === 3)
  check('input.drop-imports-image', await page.evaluate(() => window.__imports[2] === '拖入图片.png'))
  await page.locator('textarea').fill('用这些照片写一篇活动回顾')
  await page.evaluate(() => { window.__holdImport = true })
  await chooser.setInputFiles({ name: '等待导入.png', mimeType: 'image/png', buffer: blueBytes })
  await page.waitForFunction(() => typeof window.__releaseImport === 'function')
  check('input.send-disabled-during-import', await page.getByRole('button', { name: '发送', exact: true }).isDisabled())
  await page.evaluate(() => { window.__holdImport = false; window.__releaseImport() })
  await page.waitForFunction(() => window.__attachments.length === 4)
  await chooser.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: redBytes })
  await page.getByRole('alert').waitFor()
  check('failure.import-error-visible', (await page.getByRole('alert').textContent()).includes('图片文件损坏'))
  check('failure.prior-attachments-preserved', await page.evaluate(() => window.__attachments.length === 4))
  await page.getByRole('button', { name: '发送', exact: true }).click()
  check('input.requirement-sent-unchanged', await page.evaluate(() => window.__sent[0] === '用这些照片写一篇活动回顾'))
  await page.evaluate(() => {
    const handler = window.__eventListeners['tauri://drag-drop']
    window.__eventCallbacks[handler]({ event: 'tauri://drag-drop', payload: { paths: ['C:\\照片 空格\\桌面拖入.png'], position: { x: 100, y: 100 } } })
  })
  await page.waitForFunction(() => window.__attachments.length === 5)
  check('input.native-tauri-drop-imports-exact-path', await page.evaluate(() => window.__nativeImportedPath === 'C:\\照片 空格\\桌面拖入.png'))
  await page.evaluate(() => { window.__chatActive = false; window.__renderChat() })
  await page.waitForTimeout(60)
  await page.evaluate(() => {
    const handler = window.__eventListeners['tauri://drag-drop']
    window.__eventCallbacks[handler]({ event: 'tauri://drag-drop', payload: { paths: ['C:\\照片 空格\\不应导入.png'] } })
  })
  await page.waitForTimeout(80)
  check('input.hidden-chat-ignores-native-drop', await page.evaluate(() => window.__attachments.length === 5 && window.__nativeImportedPath.endsWith('桌面拖入.png')))
  await page.evaluate(async () => {
    const bytes = Uint8Array.from(atob(window.__green.split(',')[1]), (v) => v.charCodeAt(0))
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('')
    window.__messages = [{ id: 1, role: 'user', content: '历史图片', localImages: [{ assetId: 'li-' + hash, name: '修复图片.png', mime: 'image/png', width: 80, height: 50, byteLength: bytes.length }] }]
    window.__chatActive = true; window.__renderChat()
  })
  await page.getByText('图片暂不可读：修复图片.png', { exact: true }).waitFor()
  await chooser.setInputFiles({ name: '修复图片.png', mimeType: 'image/png', buffer: Buffer.from(fixture.green.split(',')[1], 'base64') })
  await page.waitForFunction(() => window.__attachments.length === 6 && !document.body.innerText.includes('图片暂不可读：修复图片.png'))
  check('input.reimport-refreshes-old-failed-thumbnail', await page.locator('.msg-user img[alt="修复图片.png"]').count() === 1)

  const pickerButton = page.getByRole('button', { name: '待插入图片', exact: true })
  const picker = page.getByRole('dialog', { name: '待插入图片', exact: true })
  await pickerButton.click()
  await picker.getByText('这里还没有图片', { exact: true }).waitFor()
  check('picker.empty-three-steps-and-exact-directory', await picker.locator('ol li').count() === 3 && (await picker.textContent()).includes('C:\\Users\\中文用户\\Documents\\wechat-mp-workspace\\待插入图片'))
  check('picker.explains-direct-children-and-supported-formats', (await picker.textContent()).includes('仅显示此文件夹本层的 PNG、JPEG、WebP、GIF、BMP 图片'))
  await picker.getByRole('button', { name: '打开文件夹', exact: true }).click()
  check('picker.opens-dedicated-folder', await page.evaluate(() => window.__insertionOpens === 1))
  await page.keyboard.press('Escape')
  await picker.waitFor({ state: 'detached' })
  check('picker.escape-restores-opener-focus', await pickerButton.evaluate((el) => document.activeElement === el))
  await page.evaluate(() => {
    const longName = '校园秋日阅读活动现场照片中文长文件名'.repeat(5) + '.png'
    window.__insertionListing.images = [longName, 'broken.png', '第三张.jpg'].map((name, i) => ({ name, path: window.__insertionListing.directory + '\\' + name, byteLength: i ? 2048 : 12 * 1024 * 1024 }))
    window.__insertionListing.warnings = ['当前只显示前 500 张图片。']
    window.__importsBeforePicker = window.__imports.length
    window.__readsBeforePicker = window.__imageReads
  })
  await pickerButton.click()
  await picker.getByRole('checkbox').first().waitFor()
  check('picker.listing-does-not-read-images-or-send', await page.evaluate(() => window.__imports.length === window.__importsBeforePicker && window.__imageReads === window.__readsBeforePicker && window.__sent.length === 1) && await picker.locator('img').count() === 0)
  check('picker.shows-file-size-and-backend-warning', (await picker.textContent()).includes('12.0 MB') && (await picker.textContent()).includes('当前只显示前 500 张图片。'))
  await picker.getByRole('checkbox').nth(0).check()
  await picker.getByRole('checkbox').nth(1).check()
  check('picker.respects-existing-attachments-and-max-limit', await picker.getByRole('checkbox').nth(2).isDisabled() && (await picker.textContent()).includes('已选 2 张 · 当前消息还可添加 2 张'))
  await picker.getByRole('searchbox', { name: '查找文件名' }).fill('第三张')
  check('picker.search-keeps-selected-outside-filter', await picker.getByRole('checkbox').count() === 1 && (await picker.textContent()).includes('已选 2 张'))
  await picker.getByRole('searchbox', { name: '查找文件名' }).fill('')
  await picker.getByRole('button', { name: '刷新', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.insertion-picker-body')?.getAttribute('aria-busy') === 'false')
  check('picker.refresh-retains-still-present-selection', await picker.locator('input[type=checkbox]:checked').count() === 2)
  await page.setViewportSize({ width: 375, height: 640 })
  const narrowLayout = await picker.evaluate((el) => {
    const file = el.querySelector('.insertion-picker-filename')
    const body = el.querySelector('.insertion-picker-body')
    return { withinViewport: el.getBoundingClientRect().right <= innerWidth && el.getBoundingClientRect().left >= 0,
      noHorizontalOverflow: body.scrollWidth <= body.clientWidth, wraps: file.getBoundingClientRect().height > 40,
      scrolls: body.scrollHeight > body.clientHeight }
  })
  check('picker.narrow-long-name-wraps-and-scrolls', Object.values(narrowLayout).every(Boolean), JSON.stringify(narrowLayout))
  await picker.screenshot({ path: join(outDir, 'picker-narrow-light.png') })
  await page.emulateMedia({ colorScheme: 'dark' })
  check('picker.dark-theme-has-own-readable-surface', await picker.evaluate((el) => getComputedStyle(el).colorScheme === 'dark' && getComputedStyle(el).backgroundColor === 'rgb(29, 41, 41)'))
  await picker.screenshot({ path: join(outDir, 'picker-narrow-dark.png') })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.setViewportSize({ width: 1000, height: 700 })
  await picker.getByRole('button', { name: '添加到消息', exact: true }).focus()
  await page.keyboard.press('Tab')
  check('picker.keyboard-focus-stays-inside-modal', await picker.evaluate((el) => el.contains(document.activeElement)))
  await page.evaluate(() => { window.__holdImport = true })
  await picker.getByRole('button', { name: '添加到消息', exact: true }).click()
  await page.waitForFunction(() => window.__importChanges.at(-1) === true)
  check('picker.import-lock-disables-send-and-repeat-add', await picker.getByRole('button', { name: '添加中…', exact: true }).isDisabled() && await page.getByRole('button', { name: '发送', exact: true }).isDisabled())
  await page.keyboard.press('Escape')
  await picker.waitFor({ state: 'detached' })
  await page.evaluate(() => { window.__holdImport = false; window.__releaseImport() })
  await page.waitForFunction(() => window.__attachments.length === 7 && window.__importChanges.at(-1) === false)
  check('picker.selected-path-import-preserves-prior-and-does-not-send', await page.evaluate(() => window.__attachments[6].name.startsWith('校园秋日') && window.__nativeImportedPath.startsWith(window.__insertionListing.directory) && window.__attachments[0].name === '中文 空格原图.png' && window.__sent.length === 1))
  check('picker.partial-failure-shows-file-and-keeps-success', (await page.getByRole('alert').textContent()).includes('broken.png：图片文件损坏'))
  await pickerButton.click()
  await picker.getByRole('checkbox').first().waitFor()
  await picker.getByRole('checkbox').nth(2).check()
  await page.evaluate(() => { window.__insertionListing.images = window.__insertionListing.images.slice(0, 2) })
  await picker.getByRole('button', { name: '刷新', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.insertion-picker input[type=checkbox]').length === 2)
  check('picker.refresh-removes-deleted-file-selection', await picker.locator('input[type=checkbox]:checked').count() === 0 && await picker.getByRole('button', { name: '添加到消息', exact: true }).isDisabled())
  await page.evaluate(() => { window.__folderError = '文件夹不可访问' })
  await picker.getByRole('button', { name: '打开文件夹', exact: true }).click()
  await picker.getByRole('alert').waitFor()
  check('picker.open-folder-error-is-visible', (await picker.getByRole('alert').textContent()).includes('打开文件夹失败：文件夹不可访问'))
  await page.evaluate(() => { window.__folderError = ''; window.__listingError = '读取被拒绝' })
  await picker.getByRole('button', { name: '刷新', exact: true }).click()
  await picker.getByText('读取图片列表失败：读取被拒绝', { exact: true }).waitFor()
  check('picker.refresh-error-keeps-current-list-and-attachments', await picker.getByRole('checkbox').count() === 2 && await page.evaluate(() => window.__attachments.length === 7))
  await page.evaluate(() => { window.__chatBusy = true; window.__renderChat() })
  await picker.waitFor({ state: 'detached' })
  check('picker.busy-closes-picker-and-disables-entry', await pickerButton.isDisabled())
  await page.evaluate(() => { window.__chatBusy = false; window.__listingError = ''; window.__holdListing = true; window.__renderChat() })
  await pickerButton.click()
  await page.waitForFunction(() => typeof window.__releaseListing === 'function')
  await page.evaluate(() => { window.__chatDisabled = true; window.__renderChat() })
  await picker.waitFor({ state: 'detached' })
  await page.evaluate(() => { window.__holdListing = false; window.__releaseListing() })
  await page.waitForTimeout(40)
  check('picker.session-transition-discards-late-listing', await picker.count() === 0 && await pickerButton.isDisabled() && await page.evaluate(() => window.__attachments.length === 7))
  await page.evaluate(() => { window.__chatDisabled = false; window.__renderChat() })

  const result = await page.evaluate(async () => {
    const local = await import('/src/lib/local-images.ts')
    const { composeMarkdown } = await import('/src/lib/compose.ts')
    const { saveSession, openSession } = await import('/src/lib/sessions.ts')
    const { exportHtml } = await import('/src/lib/exportHtml.ts')
    const { checkHtml } = await import('/src/lib/quality.ts')
    const first = window.__attachments[0]; const second = window.__attachments[1]
    const source = `# 现场回顾\n\n![第一张原图](local-image://${first.assetId})\n\n当天留下的画面。\n\n![第二张原图](local-image://${second.assetId})`
    const composed = composeMarkdown(source)
    const html = await local.renderLocalImages(composed.html)
    const readsBefore = window.__imageReads
    await Promise.all([local.renderLocalImages(composed.html), local.renderLocalImages(composed.html)])
    const cacheReused = window.__imageReads === readsBefore
    const host = document.createElement('div'); host.innerHTML = html; host.style.width = '375px'; document.body.append(host)
    const imgs = [...host.querySelectorAll('img')]; await Promise.all(imgs.map((img) => img.decode()))
    const rendered = imgs.map((img) => ({ src: img.getAttribute('src'), width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, naturalWidth: img.naturalWidth }))
    const meta = [first, second].map(local.localImageMeta)
    await saveSession('local-images', { mode: 'auto', style: 'auto', messages: [{ id: 1, role: 'user', content: '用这些照片写回顾', localImages: meta }] })
    const reopened = await openSession('local-images')
    const context = local.localImageContext(meta)
    const edited = source.replace('当天留下的画面。', '这些现场照片记录了当天的活动。')
    const reference = `![照片](local-image://${first.assetId})`
    const codeOnly = `\`\`\`md\n${reference}\n\`\`\``
    const inlineCodeOnly = '`' + reference + '`'
    const nakedId = `这只是图片ID：local-image://${first.assetId}`
    const codeReferences = {
      fenced: local.localImageIds(codeOnly), inline: local.localImageIds(inlineCodeOnly), plain: local.localImageIds(nakedId),
      deletion: local.missingPreservedLocalImages(reference, nakedId + '\n\n' + codeOnly + '\n\n' + inlineCodeOnly),
      imgrow: local.localImageIds(`::: imgrow\n- ${reference}\n- ![第二张](local-image://${second.assetId})\n:::`),
      inlineHtml: composeMarkdown(inlineCodeOnly).html,
      historicalV2: local.savedLocalImageIds('```v2\n' + reference + '\n```'),
      historicalHtml: local.savedLocalImageIds('```html\n<section><img src="local-image://' + first.assetId + '" /></section>\n```'),
      comment: local.localImageIdsFromHtml('<!-- <img src="local-image://' + first.assetId + '"> -->'),
      unquoted: local.localImageIdsFromHtml('<section><IMG SRC=local-image://' + first.assetId + '></section>'),
      unquotedRendered: await local.renderLocalImages('<section><IMG SRC=local-image://' + first.assetId + '></section>'),
    }
    const editedHtml = await local.renderLocalImages(composeMarkdown(edited).html)
    await exportHtml(html)
    let missingRejected = false
    try { await local.renderLocalImages(`<img src="local-image://li-${'f'.repeat(64)}" />`) } catch { missingRejected = true }
    let malformedRejected = false
    try { await local.renderLocalImages('<img src="local-image://../../file" />') } catch { malformedRejected = true }
    const rawPath = composeMarkdown('![文件](C:\\照片\\活动.png)')
    const alt = composeMarkdown(`![说明\" onerror=\"alert(1)](local-image://${first.assetId})`).html
    const altHost = document.createElement('div'); altHost.innerHTML = alt
    return { source, html, rendered, cacheReused, codeReferences, composedWarnings: composed.warnings, quality: checkHtml(html), stored: window.__sessions['local-images'], reopened, context, editedHtml, exported: window.__exports[0], missingRejected, malformedRejected,
      preserved: local.missingPreservedLocalImages(source, edited), removed: local.missingPreservedLocalImages(source, '# 删除图片'), altSafe: !altHost.querySelector('img').hasAttribute('onerror'),
      rawPathBlocked: rawPath.issues.some((issue) => issue.code === 'asset.local-image-unimported' && issue.severity === 'blocking'), first, second }
  })
  check('render.two-images-actually-decode', result.rendered.length === 2 && result.rendered.every((item) => item.naturalWidth === 80))
  check('render.streaming-reuses-immutable-image-cache', result.cacheReused)
  check('render.original-bytes-not-model-thumbnail', result.rendered[0].src === fixture.red && result.rendered[0].src !== result.first.modelDataUrl)
  check('render.multi-image-identity-distinct', result.rendered[0].src !== result.rendered[1].src)
  check('render.fit-375px-with-original-aspect', result.rendered.every((item) => item.width <= 343 && Math.abs(item.width / item.height - 1.6) < 0.01))
  check('render.no-upload-or-placeholder-warning', !result.composedWarnings.some((s) => /手动替换|上传通道|照片位/.test(s)))
  check('render.standard-quality-check', result.quality.ok)
  check('render.alt-cannot-create-html-attribute', result.altSafe)
  check('persist.stable-reference-source', result.source.includes(result.first.assetId) && !result.source.includes('base64'))
  check('persist.session-keeps-two-stable-ids', result.reopened.ok && result.reopened.item.messages[0].localImages.length === 2 && result.reopened.item.messages[0].localImages[0].assetId === result.first.assetId)
  check('persist.session-does-not-save-base64', !JSON.stringify(result.stored).includes('base64'))
  check('persist.model-context-identifies-each-image', result.context.includes(result.first.assetId) && result.context.includes(result.second.assetId) && result.context.includes('中文 空格原图.png'))
  check('persist.text-only-edit-keeps-original-bytes', result.preserved.length === 0 && result.editedHtml.includes(fixture.red) && result.editedHtml.includes(fixture.blue))
  check('persist.deleted-images-detected', result.removed.length === 2)
  check('persist.code-and-plain-id-do-not-count-as-images', result.codeReferences.fenced.length === 0 && result.codeReferences.inline.length === 0 && result.codeReferences.plain.length === 0)
  check('persist.code-cannot-fake-preserved-photo', result.codeReferences.deletion.length === 1)
  check('render.inline-image-code-stays-literal', !/<img\b/.test(result.codeReferences.inlineHtml))
  check('persist.image-row-real-nodes-are-counted', result.codeReferences.imgrow.length === 2)
  check('persist.historical-v2-and-html-wrappers-restore-images', result.codeReferences.historicalV2.length === 1 && result.codeReferences.historicalHtml.length === 1)
  check('persist.html-comments-cannot-fake-preserved-photo', result.codeReferences.comment.length === 0)
  check('render.unquoted-uppercase-src-is-materialized', result.codeReferences.unquoted.length === 1 && result.codeReferences.unquotedRendered.includes(fixture.red) && !result.codeReferences.unquotedRendered.includes('local-image://'))
  check('persist.html-export-contains-original-bytes', result.exported.includes(fixture.red) && result.exported.includes(fixture.blue) && !result.exported.includes('local-image://'))
  check('failure.missing-id-is-not-silent-empty-image', result.missingRejected)
  check('failure.malformed-id-not-used-as-path', result.malformedRejected)
  check('failure.unimported-local-path-blocks-delivery', result.rawPathBlocked)
  const big = await page.evaluate(async () => {
    const { renderLocalImages } = await import('/src/lib/local-images.ts')
    const ids = ['a', 'b', 'c'].map((char) => 'li-' + char.repeat(64))
    for (let index = 0; index < ids.length; index++) {
      window.__records[ids[index]] = { assetId: ids[index], name: '大图缓存夹具', mime: 'image/png', width: 1000, height: 1000, byteLength: 32 * 1024 * 1024,
        dataUrl: 'data:image/png;base64,' + String.fromCharCode(65 + index).repeat(45 * 1024 * 1024), modelDataUrl: window.__blue }
    }
    const markup = ids.map((id) => `<img src="local-image://${id}" />`).join('')
    const before = window.__imageReads
    const firstLength = (await renderLocalImages(markup)).length
    const afterFirst = window.__imageReads
    const secondLength = (await renderLocalImages(markup)).length
    return { firstReads: afterFirst - before, repeatReads: window.__imageReads - afterFirst, sameLength: firstLength === secondLength }
  })
  check('render.three-large-images-do-not-thrash-cache', big.firstReads === 3 && big.repeatReads === 0 && big.sameLength, JSON.stringify(big))
  writeFileSync(join(outDir, 'rendered.html'), result.html)
  writeFileSync(join(outDir, 'source.md'), result.source)
} catch (e) { judge.error('runner', e.stack || e.message) }
finally { await browser.close(); judge.finish() }
