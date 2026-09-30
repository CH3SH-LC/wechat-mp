// preview-pick.ts —— 预览组件拾取（P2，2026-09-24 调查 §6）
// 预览用 <iframe srcdoc sandbox="allow-same-origin">：同源，父页可直接读 contentDocument，
// 所以**不需要**开 allow-scripts、不需要 postMessage、更不需要往文章 HTML 里注入脚本
// （注入脚本会与 quality 的 <script> 禁令冲突，并污染 复制/导出/微信粘贴 路径）。
//
// 产物只是一段**文本锚点**：插进对话输入框，由用户自己补指令再发送。
// 它不是对话状态、不参与路由/澄清/工具可用性判断（项目铁律 6）。

/** compose 输出以单个 <section> 包裹正文，其直接子元素即"块"，顺序与 v2 源文一致 */
export function topLevelBlocks(doc: Document): Element[] {
  const body = doc.body
  if (!body) return []
  const wrapper = body.children.length === 1 && body.children[0].tagName === 'SECTION' ? body.children[0] : body
  return Array.from(wrapper.children)
}

/** 由 DOM 现场推导块类型——不依赖任何预置标记，因此不会泄漏进导出产物 */
export function blockKind(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const style = (el.getAttribute('style') || '').replace(/\s+/g, '')
  if (tag === 'img') return '插画'
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return '标题'
  if (tag === 'ul' || tag === 'ol') return '列表'
  if (tag === 'blockquote') return '引用'
  if (tag === 'table') return '表格'
  if (tag === 'p') return '段落'
  if (tag === 'section') {
    if (style.includes('border-left:4pxsolid') || style.includes('border-left:4px')) return '气泡'
    if (style.includes('dashed')) return '照片位'
    if (style.includes('border:2pxsolid') || style.includes('border:1pxsolid') || style.includes('border-radius')) return '容器'
    return '组件'
  }
  return tag
}

/** 块的可读摘要：优先文字，图片取 alt */
export function blockExcerpt(el: Element, max = 18): string {
  const tag = el.tagName.toLowerCase()
  let text = tag === 'img' ? el.getAttribute('alt') || '' : el.textContent || ''
  text = text.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** 生成给模型看的文本锚点，例如：预览第 3/8 块（气泡）「记得带」 */
export function blockRefLabel(el: Element, doc: Document): string {
  const blocks = topLevelBlocks(doc)
  const idx = blocks.indexOf(el)
  const n = idx >= 0 ? idx + 1 : 0
  const kind = blockKind(el)
  const text = blockExcerpt(el)
  return `预览第 ${n}/${blocks.length} 块（${kind}）${text ? '「' + text + '」' : ''}`
}

/** 从点击目标向上找到顶层块 */
export function nearestBlock(target: Element | null, doc: Document): Element | null {
  const blocks = topLevelBlocks(doc)
  let el: Element | null = target
  while (el && !blocks.includes(el)) el = el.parentElement
  return el
}

/** 悬停高亮样式：由父页注入到预览文档的 <head>，不进文章 HTML */
export const HOVER_STYLE_ID = '__wxmp-pick-style'
export const HOVER_CLASS = '__wxmp-pick-hover'

export function ensureHoverStyle(doc: Document): void {
  if (doc.getElementById(HOVER_STYLE_ID)) return
  const st = doc.createElement('style')
  st.id = HOVER_STYLE_ID
  st.textContent =
    '.' +
    HOVER_CLASS +
    '{outline:2px solid #2f6fed;outline-offset:2px;border-radius:2px;cursor:pointer;transition:outline-color .12s}'
  doc.head?.appendChild(st)
}
