// v10 全语法覆盖测试：text + promo 双模式，验证零 emoji/零渐变/零阴影/无异常
import { readFileSync, writeFileSync } from 'node:fs'
import { skillMd, artifact } from './lib/env.mjs'

const skill = readFileSync(skillMd, 'utf8')
const hostSrc = [...skill.matchAll(/````js\n([\s\S]*?)````/g)][0][1]

const tools = {}
globalThis.harness = { defineTool: (t) => t, registerTool: (_c, t) => { tools[t.name] = t }, handle: () => {} }
const ctxStub = { timer: { timeout: (ms) => new Promise((r) => setTimeout(r, ms)) }, get: (n) => (n === 'shell' ? { resolve: (r) => r, run: async () => { throw new Error('stub') } } : undefined) }
new Function(hostSrc)().apply(ctxStub)

const md = `# 全语法覆盖测试标题

[[banner:主标题|副标题]]

> [!NOTE] 提示气泡
> 这是说明文字。

> [!TIP|grass] 技巧气泡带小草
> 这是技巧内容。

> [!WARN] 注意气泡
> 注意这里。

> [!DANGER|vine] 警示气泡带藤蔓
> 危险内容。

> [!KEY|blossom] 重点气泡带花朵
> 重点内容。

::: card 卡片标题
- 卡片内容一
- 卡片内容二
:::

::: steps
- 步骤一
- 步骤二
- 步骤三
:::

---

***

___

~~~

[[badge:徽章一]] 正文中的徽章

==高亮文字==

[[title:装饰标题]]

[[title:方框标题|box]]

[[title:藤蔓标题|vine]]

::: cols
- 列一内容
- 列二内容
- 列三内容
:::

::: timeline
- 时间节点一
- 时间节点二
- 时间节点三
:::

::: band 斜纹
- 花纹色带文字
:::

::: band 波点
- 波点花纹文字
:::

::: frame
- 边框内容
:::

[[lace]]

普通列表：
- 列表项一
- 列表项二

有序列表：
1. 第一项
2. 第二项

| 表头一 | 表头二 |
| --- | --- |
| 内容一 | 内容二 |

> 普通引用文字。

\`\`\`
代码块内容
\`\`\`

结尾段落，包含 **加粗**、*斜体*、\`代码\` 和 [链接](https://example.com)。

[[badge:底部徽章]] 完成
`

const emojiRe = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2190-\u21FF]|❀|✦|▸|➤|★|☆|◆|●|▲|✓|✗|💡|✨|⚠|🚫|⭐|🎉|🎯|🏃|🤝|💪|📌|🔥|✅/u

for (const mode of ['promo', 'text']) {
  const res = await tools.wechat_mp_compose.execute({ title: '测试', mode, markdown: md })
  const html = res.html
  const fails = []
  if (emojiRe.test(html)) fails.push('含 emoji/图标字符')
  if (/linear-gradient/.test(html.replace(/repeating-linear-gradient/g, 'R'))) fails.push('含配色渐变')
  if (/box-shadow/.test(html)) fails.push('含阴影')
  if (res.warnings.some((w) => /iconlist|flower|❀/.test(w))) fails.push('警告含旧语法')
  console.log(mode + ': HTML ' + html.length + ' 字符 | ' + res.chars + ' 字 | 警告: ' + (res.warnings.length ? res.warnings.join(' | ') : '无') + (fails.length ? ' | 失败: ' + fails.join(', ') : ' | 全过'))
  writeFileSync(artifact('syntax-' + mode + '.html'), html, 'utf8')
}
console.log('完成')
