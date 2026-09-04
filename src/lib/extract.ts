// extract.ts —— 从助手回复中提取可预览内容
// 协议（第 14 轮）：创作回复 = 可选说明文字 + ```v2 围栏（Markdown+v2 语法正文，由 compose 渲染）；
// 兼容通道 ```html 围栏直通（旧会话/演示）；无围栏 = 普通对话。

export interface ExtractResult {
  html: string
  fromFence: boolean
}

// 优先取 ```html 围栏；无围栏但整段像 HTML 片段时兜底（旧直通通道）
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
  code: string | null // 首个 ```html 围栏内容（直通通道）
  v2: string | null // 首个 ```v2 围栏内容（v2 语法正文，需 compose）
}

// 把助手回复拆成"说明文字 + 源码"：围栏从 prose 剥离；code/v2 取各自首个围栏。
// 处理流中未闭合围栏：其前文字进 prose，代码段不完整时不作为 code/v2。
export function splitAssistant(raw: string): SplitResult {
  const lines = raw.split('\n')
  const prose: string[] = []
  let code: string | null = null
  let v2: string | null = null
  let cur: string[] = []
  let lang = ''
  let inFence = false
  const close = (target: 'code' | 'v2') => {
    const c = cur.join('\n').trim()
    if (!c) return
    if (target === 'code' && code === null) code = c
    if (target === 'v2' && v2 === null) v2 = c
  }
  for (const ln of lines) {
    const t = ln.trim()
    if (t.startsWith('```')) {
      if (!inFence) {
        inFence = true
        lang = t.slice(3).trim().toLowerCase()
        cur = []
        continue
      }
      inFence = false
      if (lang === 'html') close('code')
      else if (lang === 'v2' || lang === 'markdown' || lang === 'md') close('v2')
      lang = ''
      continue
    }
    if (inFence) cur.push(ln)
    else prose.push(ln)
  }
  return { prose: prose.join('\n').trim(), code, v2 }
}
