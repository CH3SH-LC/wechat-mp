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
