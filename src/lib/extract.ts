// extract.ts —— 从助手回复中提取可预览的 HTML

export interface ExtractResult {
  html: string
  fromFence: boolean
}

// 优先取 ```html 围栏；无围栏但整段像 HTML 片段时兜底
export function extractHtml(text: string): ExtractResult | null {
  if (!text) return null
  const fence = /```html\s*([\s\S]*?)```/i.exec(text)
  if (fence) {
    const html = fence[1].trim()
    return html ? { html, fromFence: true } : null
  }
  const t = text.trim()
  if (/^\s*<(?:section|div|p|h[1-6]|blockquote|ul|ol)\b/i.test(t) && t.includes('</')) {
    return { html: t, fromFence: false }
  }
  return null
}

export interface SplitResult {
  prose: string // 围栏外的说明文字（净化后的展示文本）
  code: string | null // 首个 ```html 围栏内容（预览/查看源码用）
}

// 把助手回复拆成"说明文字 + 源码"：所有围栏从 prose 剥离；code 取首个围栏。
// 处理流中未闭合围栏：其前文字进 prose，代码段不完整时不作为 code（预览仍实时渲染）。
export function splitAssistant(raw: string): SplitResult {
  const lines = raw.split('\n')
  const prose: string[] = []
  let code: string | null = null
  let cur: string[] = []
  let inFence = false
  let codeTaken = false
  for (const ln of lines) {
    const t = ln.trim()
    if (t.startsWith('```')) {
      if (!inFence) {
        inFence = true
        cur = []
        continue
      }
      inFence = false
      if (!codeTaken) {
        const c = cur.join('\n').trim()
        if (c) {
          code = c
          codeTaken = true
        }
      }
      continue
    }
    if (inFence) cur.push(ln)
    else prose.push(ln)
  }
  return { prose: prose.join('\n').trim(), code }
}
