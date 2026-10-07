// runner-wordlimit-check.mjs —— 离线核对 `live-acceptance.mjs` 的 G2B 字数口径修正是否生效。
// 零模型、不启动应用：只调 scripts/lib/fact-assert.mjs 的 factChecks，复现 runWritePhase 的口径选择。
// 用法：node <此文件>   （退出码 0 = 修正生效）

const libUrl = new URL('file:///D:/deepseek-harness/wechat-mp-desktop/scripts/lib/fact-assert.mjs')
const { factChecks } = await import(libUrl.href)

// 与 scripts/fact-assert-check.mjs 的 art() 同形
const art = (bodyText, title = '图书馆开放时间调整通知') => ({
  bodyText,
  firstHeadingText: title,
  titleNodeText: title,
  titleNodeMatched: true,
  bodyChars: bodyText.replace(/\s+/g, '').length,
  counted: bodyText.replace(/\s+/g, ''),
})

// 与 runWritePhase 完全相同的口径选择（live-acceptance.mjs:1856）
const pick = (opts) => (opts.wordLimit === undefined ? 180 : opts.wordLimit)

const body = '正文'.repeat(500) // 1000 字，远超 180
const TITLE = '图书馆开放时间调整通知'

const cases = [
  { label: 'G2B（live-acceptance.mjs:2898 传 { wordLimit: null }）', opts: { wordLimit: null } },
  { label: 'L8（live-acceptance.mjs:2891 传 { wordLimit: 500 }）', opts: { wordLimit: 500 } },
  { label: 'L1（live-acceptance.mjs:2886 传 { wordLimit: 180 }）', opts: { wordLimit: 180 } },
  { label: '未传 wordLimit（默认 180）', opts: {} },
]

let allGood = true
for (const c of cases) {
  const limit180 = pick(c.opts)
  const checks = factChecks(art(body, TITLE), TITLE, { expectTitle: TITLE, limit180, tag: '' })
  const wordChecks = checks.filter((x) => /≤\s*\d+\s*字/.test(x.id))
  const expectation =
    limit180 === null
      ? wordChecks.length === 0
        ? 'OK：没有生成字数判据（不适用，跳过）'
        : 'BAD：不该生成字数判据'
      : wordChecks.length === 1
        ? `OK：生成 1 条「≤ ${limit180} 字」判据`
        : 'BAD：字数判据数量异常'
  if (expectation.startsWith('BAD')) allGood = false
  console.log(`- ${c.label}`)
  console.log(`    wordLimit 解析值 = ${JSON.stringify(limit180)}；字数判据 = ${JSON.stringify(wordChecks.map((x) => x.id))}`)
  console.log(`    ${expectation}`)
}

console.log(allGood ? '\n结论：修正生效——G2B（wordLimit=null）不再生成 180 字上限判据。' : '\n结论：修正未生效。')
process.exit(allGood ? 0 : 1)
