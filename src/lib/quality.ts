// quality.ts —— 推文 HTML 质量检查（对齐 persona v10 审美硬规范与微信内联约束）

export interface QualityIssue {
  kind: string
  detail: string
}

export interface QualityResult {
  ok: boolean
  issues: QualityIssue[]
}

// v10 禁止的装饰性图标字符（显式集合，配合 emoji 区段）
const ICON_CHARS = '✅⚠️🔥💡❀✦▸➤★☆◆●▲📌🎉❋❁❃✿❧➢◆◇■□●○→←↑↓①②③④⑤⑥⑦⑧⑨⑩'

function hasEmojiOrIcon(s: string): string[] {
  const found = new Set<string>()
  // emoji/符号图形区段
  const re = /[\p{Extended_Pictographic}]/gu
  for (const m of s.matchAll(re)) found.add(m[0])
  for (const ch of ICON_CHARS) if (s.includes(ch)) found.add(ch)
  return [...found]
}

export function checkHtml(html: string): QualityResult {
  const issues: QualityIssue[] = []

  if (!html.trim()) {
    return { ok: false, issues: [{ kind: 'empty', detail: '没有可检查的 HTML 内容' }] }
  }

  const emojis = hasEmojiOrIcon(html)
  if (emojis.length) {
    issues.push({ kind: 'emoji', detail: `发现 emoji/图标字符：${emojis.slice(0, 8).join(' ')}（零 emoji 零图标铁律）` })
  }

  if (/<style[\s>]/i.test(html) || /<\/style>/i.test(html)) {
    issues.push({ kind: 'style-tag', detail: '发现 <style> 标签（必须全部内联样式）' })
  }
  if (/<script[\s>]/i.test(html) || /<\/script>/i.test(html)) {
    issues.push({ kind: 'script-tag', detail: '发现 <script> 标签（微信会过滤，禁止）' })
  }
  if (/<html[\s>]|<head[\s>]|<body[\s>]/i.test(html)) {
    issues.push({ kind: 'doc-tags', detail: '发现 <html>/<head>/<body> 文档级标签（只需片段）' })
  }
  if (/linear-gradient/i.test(html)) {
    issues.push({ kind: 'gradient', detail: '发现 linear-gradient（零渐变铁律，底色一律低饱和纯色）' })
  }
  if (/box-shadow/i.test(html)) {
    issues.push({ kind: 'shadow', detail: '发现 box-shadow（零阴影铁律）' })
  }

  // 外链图片检查：src 指向 http(s) 视为外链（微信发布后失效）；art:// 占位与本地注释允许
  const external = new Set<string>()
  const srcRe = /<img[^>]*src=["']([^"']+)["']/gi
  for (const m of html.matchAll(srcRe)) {
    const src = m[1]
    if (/^https?:\/\//i.test(src)) external.add(src.slice(0, 60))
  }
  if (external.size) {
    issues.push({ kind: 'external-img', detail: `外链图片（发布后失效）：${[...external].slice(0, 3).join(' | ')}` })
  }

  // 硬性宽度越界（375 视口 + 左右留白）
  if (/width:\s*\d{3,}px/i.test(html)) {
    issues.push({ kind: 'fixed-width', detail: '发现 ≥100px 的固定像素宽度（应使用百分比/自适应）' })
  }

  return { ok: issues.length === 0, issues }
}
