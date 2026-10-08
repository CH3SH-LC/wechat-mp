// l6-html-open-red.mjs —— 证明 L6 新增的「导出的 .html 用浏览器打开后内容完整」**可证伪**
// （2026-10-08 R7）
//
// 用法：
//   VERIFY_PLAYWRIGHT=<playwright 模块目录> node docs/artifacts/2026-10-08-commercial-grade-r2/l6-html-open-red.mjs [--file <导出的 .html>]
//
// 为什么要它：一条断言如果在任何输入下都成立，它就不是断言。L6 上这条在真机上返回
// "图 1 张（解码 0 失败）、标题可见=true、可见字数与预览一致"，必须回答"那它到底会不会红"。
//
// 做法：拿**真机导出的那个 .html 文件**，在浏览器里照 L6 的同一套量法量三次——
// ① 原样；② 把正文标题改掉（模拟"内容不完整/打开是别的稿"）；③ 把图片 src 打断（模拟"图全裂"）。
// 量法与 L6 的页面内取值一致：`document.images` 的 naturalWidth、`body.innerText`。
// 断言条件（`imgs>0 && broken===0 && 标题可见 && 字数与预览相差 ≤10%`）直接由这三个量导出，
// 所以只要这三个量会变，那条断言就会红。
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..', '..')

const args = process.argv.slice(2)
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
const DEFAULT_FILE = join(
  process.env.TEMP || '',
  'wxmp-r5/flow/profile/Documents/wechat-mp-workspace/exports/tuiwen-1791471950.html',
)
const file = fileArg || DEFAULT_FILE
if (!existsSync(file)) {
  console.error(`[l6-html-open-red] 找不到导出文件：${file}\n（用 --file 指定一个导出的 .html）`)
  process.exit(2)
}
const src = readFileSync(file, 'utf8')
console.log(`[输入] ${file}（${src.length} 字节）`)

const pwPath = process.env.VERIFY_PLAYWRIGHT || 'playwright'
let chromium
try {
  ;({ chromium } = require(pwPath))
} catch (e) {
  console.error(`[l6-html-open-red] 解析不到 playwright：${String(e).slice(0, 160)}`)
  process.exit(2)
}
const chromExe = (() => {
  const env = process.env.VERIFY_CHROMIUM
  if (env) {
    const t = resolve(env)
    if (existsSync(t)) return t
  }
  const hard = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
  return existsSync(hard) ? hard : null
})()

const dir = mkdtempSync(join(tmpdir(), 'l6-html-open-'))
const write = (name, html) => {
  const p = join(dir, name)
  writeFileSync(p, html, 'utf8')
  return pathToFileURL(p).href
}

// —— 与 L6 页面内取值**同一套量法** ——
const MEASURE = () => {
  const imgs = Array.from(document.images)
  return {
    charset: document.characterSet,
    imgs: imgs.length,
    broken: imgs.filter((i) => !i.naturalWidth).length,
    chars: ((document.body && document.body.innerText) || '').replace(/\s+/g, '').length,
    text: ((document.body && document.body.innerText) || '').slice(0, 300),
  }
}

const browser = await chromium.launch({ headless: true, ...(chromExe ? { executablePath: chromExe } : {}) })
const page = await browser.newPage()
const measure = async (url) => {
  await page.goto(url)
  return page.evaluate(MEASURE)
}

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` (${extra})` : ''}`)
  if (!ok) failed++
}

// 标题取自正文第一行（与 L6 用 baseline 的 titleNodeText 同一个东西）
const title = (src.replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '').slice(0, 20)
console.log(`[推断标题] 「${title}」`)

console.log('\n[对照 1：真机导出原样 —— L6 的那条断言应当成立]')
const base = await measure(write('ok.html', src))
{
  const ok = base.imgs > 0 && base.broken === 0 && base.text.includes(title) && base.chars > 0
  check('原样：图全部解码 + 标题可见 + 有正文', ok, `imgs=${base.imgs} broken=${base.broken} chars=${base.chars} 字符集=${base.charset}`)
}

console.log('\n[反证 A：把正文标题改掉（模拟"打开是别的稿/内容不完整"）—— 必须红]')
{
  const mutated = src.replace(title, '')
  const m = await measure(write('other-title.html', mutated))
  check('标题不可见 ⇒ 断言不成立', !m.text.includes(title), `标题可见=${m.text.includes(title)}；渲染开头=${JSON.stringify(m.text.slice(0, 40))}`)
}

console.log('\n[反证 B：把图片 src 打断（模拟"图全裂"）—— 必须红]')
{
  const mutated = src.replace(/(<img[^>]*\ssrc=")data:image\/png;base64,[^"]*(")/g, '$1data:image/png;base64,AAAA$2')
  // 先确认这一刀真的切到了（切不到就等于拿原文件在比，那样的"反证"是假的）
  const cut = (src.match(/<img[^>]*\ssrc="data:image\/png;base64,/g) || []).length
  const cutAfter = mutated === src
  check('断图这一刀确实改动了文件（否则下面的反证是空转）', cut > 0 && !cutAfter, `原文件里 base64 图 ${cut} 张；文件被改动=${!cutAfter}`)
  const m = await measure(write('broken-img.html', mutated))
  check('图全部解码失败 ⇒ 断言不成立', m.broken > 0, `imgs=${m.imgs} broken=${m.broken}`)
}

await browser.close()
console.log(failed === 0 ? '\nL6-HTML-OPEN-RED PASS（量法可证伪：原样成立、改标题/断图必红）' : `\nL6-HTML-OPEN-RED FAIL（${failed} 条）`)
process.exit(failed === 0 ? 0 : 1)
