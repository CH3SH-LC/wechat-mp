// preview-safe.ts —— 预览显示层的**外部资源抑制**（DS 修复指南 包 D）
//
// 背景（真实观测）：流式候选在通过质量门禁**之前**就进了 iframe，`<img src="https://example.com/x.jpg">`
// 当场发出请求。`sandbox="allow-same-origin"` 并不阻止外链图片请求，环境把它拒掉，
// 于是"最终成品合格"与"中间过程请求失败"同时成立，浏览器总线判为失败。
//
// 口径（指南 §6 三条必须分开）：
//   1. **原始候选 source/HTML**：保留违规外链 → 交给质量检查、失败草稿与诊断（**本模块不参与**）；
//   2. **实时显示版本**：不得发起被禁止的 HTTP(S) 资源请求 → 本模块把它换成稳定占位；
//   3. **合格正式版本**：经统一门禁后才用于成品与导出（导出走原始 HTML，同样**不经**本模块）。
//
// 实现方式（2026-09-30 重写，指南 §6 第一条）：
// 旧版是几条"针对已知字符串形状"的正则，实测四类**合法 HTML/CSS 写法**照样漏放外链：
//   `src=https://…`（无引号）、`src="https:&#x2f;&#x2f;…"`（实体编码）、
//   `<style>@import "https://…"</style>`（CSS 字符串 @import）、`style="…url(&quot;https://…&quot;)"`（实体 CSS URL）。
// 同时两类**正常内容被改坏**：往 style 属性里插双引号会截断外层双引号属性（后面的颜色失效）；
// 按逗号切 srcset 会把 data URI 自身带的逗号切断（正常 2×2 PNG 变成 0 宽）。
// 因此改为**用浏览器的解析语义**：交给 `DOMParser` 解析成惰性文档（无浏览上下文、不加载资源），
// 在 DOM 上按"这个属性在浏览器里到底会不会发起加载"逐项处理，再序列化回来。
// 实体、引号、大小写属性名、srcset 的 URL 边界都由解析器按规范给出，不再靠"猜字符串形状"。
//
// 明确不做的（防止用"让测试变绿"代替"问题不存在"）：
//   · 不关闭所有图片（合法 data:/blob: 图必须照常显示）；
//   · 不吞 console 错误；
//   · 不修改传入门禁的那份 HTML（诊断证据必须完整）；
//   · 不靠 CSP 把请求挡住来假装"资源引用已处理"——真正的处理发生在引用本身。

/** 外链判定：`http://`、`https://`、协议相对 `//host/...`（DOMParser 已解码实体，这里拿到的是最终 URL） */
const EXTERNAL = /^(?:https?:)?\/\//i

/**
 * 1×1 透明占位（内联 SVG，不产生任何网络请求）。
 *
 * 值里**不含引号**：`xmlns='…'` 的单引号统一写成 `%27`。虽然本版改由 DOM 序列化（会自动转义），
 * 但占位符在 CSS `url("…")` 与 `srcset` 里也要用，保持"不含裸引号"这个不变量最省心。
 */
export const PLACEHOLDER_IMG =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E'

/**
 * 各标签上**会真的发起资源加载**的属性（按标签限定）。
 *
 * 为什么按标签限定而不是"全局扫 src/href"：`<a href>` 是"点了才走"的导航，不是资源加载，
 * 把它换成占位图会白白破坏预览里的链接。这里只处理浏览器会**主动去取**的那些。
 * `xlink:href` 用 `getAttribute('xlink:href')` 取（HTML 解析器保留该限定名）。
 */
const LOADING_ATTRS: Record<string, { attr: string; kind: 'url' | 'srcset' }[]> = {
  IMG: [
    { attr: 'src', kind: 'url' },
    { attr: 'srcset', kind: 'srcset' },
    { attr: 'lowsrc', kind: 'url' },
  ],
  SOURCE: [
    { attr: 'src', kind: 'url' },
    { attr: 'srcset', kind: 'srcset' },
    { attr: 'imagesrcset', kind: 'srcset' },
  ],
  VIDEO: [
    { attr: 'src', kind: 'url' },
    { attr: 'poster', kind: 'url' },
  ],
  AUDIO: [{ attr: 'src', kind: 'url' }],
  TRACK: [{ attr: 'src', kind: 'url' }],
  INPUT: [{ attr: 'src', kind: 'url' }], // <input type=image src>
  EMBED: [{ attr: 'src', kind: 'url' }],
  IFRAME: [{ attr: 'src', kind: 'url' }],
  FRAME: [{ attr: 'src', kind: 'url' }],
  SCRIPT: [{ attr: 'src', kind: 'url' }],
  LINK: [{ attr: 'href', kind: 'url' }], // rel=stylesheet / icon / preload
  OBJECT: [{ attr: 'data', kind: 'url' }],
  IMAGE: [
    { attr: 'href', kind: 'url' },
    { attr: 'xlink:href', kind: 'url' },
  ], // SVG <image>
  USE: [
    { attr: 'href', kind: 'url' },
    { attr: 'xlink:href', kind: 'url' },
  ], // SVG <use>
  BODY: [{ attr: 'background', kind: 'url' }],
  TABLE: [{ attr: 'background', kind: 'url' }],
  TD: [{ attr: 'background', kind: 'url' }],
  TH: [{ attr: 'background', kind: 'url' }],
  TR: [{ attr: 'background', kind: 'url' }],
}

/** `srcset` 的**规范**边界：URL 以空白结束，末尾逗号只是分隔符——data URI 里自带的逗号必须留下 */
function parseSrcset(value: string): { url: string; desc: string }[] {
  const out: { url: string; desc: string }[] = []
  const s = String(value || '')
  let i = 0
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++
    if (i >= s.length) break
    const start = i
    while (i < s.length && !/\s/.test(s[i])) i++
    let url = s.slice(start, i)
    // 尾随逗号是"候选项结束"标记，不属于 URL（这正是 data URI 尾部 `=` 后可能出现的形态）
    while (url.endsWith(',')) url = url.slice(0, -1)
    const dStart = i
    while (i < s.length && s[i] !== ',') i++
    const desc = s.slice(dStart, i).trim()
    if (i < s.length) i++
    if (url) out.push({ url, desc })
  }
  return out
}

function joinSrcset(items: { url: string; desc: string }[]): string {
  return items.map((x) => (x.desc ? `${x.url} ${x.desc}` : x.url)).join(', ')
}

/**
 * 过滤 srcset：只剔除外链候选项，保留 data:/blob:/相对路径。
 * 全被剔光时退化为占位图——空的 `srcset=""` 是无效值，浏览器会忽略它并回退到 `src`，
 * 那样"拦住了外链"就只是行话，实际仍可能按另一条路径发请求。
 */
function sanitizeSrcset(value: string, blocked: string[]): string {
  const kept: { url: string; desc: string }[] = []
  for (const it of parseSrcset(value)) {
    if (EXTERNAL.test(it.url)) {
      blocked.push(it.url)
      continue
    }
    kept.push(it)
  }
  return kept.length ? joinSrcset(kept) : PLACEHOLDER_IMG
}

/** CSS 里的 `@import <外部地址>;` —— 整条移除（保留一条空的 @import 也仍然是一次样式表取用尝试） */
const CSS_IMPORT = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*?))\s*\)|"([^"]*)"|'([^']*)')\s*[^;]*;?/gi
/** CSS 里的 `url(...)`（含引号/无引号/实体已由 HTML 解析器解码后的形态） */
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*?))\s*\)/gi

/** 对内联样式 / `<style>` 文本做同一套 CSS 级处理（@import 先于 url()，避免被 url 规则先吃掉） */
function sanitizeCss(css: string, blocked: string[]): string {
  let out = String(css || '')
  out = out.replace(CSS_IMPORT, (m, dq?: string, sq?: string, bare?: string, dq2?: string, sq2?: string) => {
    const val = String(dq ?? sq ?? bare ?? dq2 ?? sq2 ?? '').trim()
    if (!EXTERNAL.test(val)) return m
    blocked.push(val)
    return ''
  })
  out = out.replace(CSS_URL, (m, dq?: string, sq?: string, bare?: string) => {
    const val = String(dq ?? sq ?? bare ?? '').trim()
    if (!EXTERNAL.test(val)) return m
    blocked.push(val)
    return `url("${PLACEHOLDER_IMG}")`
  })
  return out
}

/**
 * 在已解析的惰性文档上做资源抑制。返回被拦下的 URL 清单（供日志/诊断引用，不参与流程判断）。
 *
 * `blocked` 是**证据**：原始引用长什么样、被换成什么，都由它回答；
 * 但"预览里没有外链请求"这件事的判据始终是**实际网络事件**，不是这个数组的长度。
 */
function walk(doc: Document, blocked: string[]): void {
  const all = doc.querySelectorAll('*')
  for (let k = 0; k < all.length; k++) {
    const el = all[k] as Element
    const tag = el.tagName.toUpperCase()

    // <base href>：外链 base 会把相对路径整体抬成外链请求，直接去掉（相对路径预览照旧）
    if (tag === 'BASE') {
      const href = el.getAttribute('href') || ''
      if (EXTERNAL.test(href.trim())) {
        blocked.push(href.trim())
        el.removeAttribute('href')
      }
      continue
    }

    const specs = LOADING_ATTRS[tag] || []
    for (const spec of specs) {
      const raw = el.getAttribute(spec.attr)
      if (raw === null) continue
      if (spec.kind === 'srcset') {
        const next = sanitizeSrcset(raw, blocked)
        if (next !== raw) el.setAttribute(spec.attr, next)
        continue
      }
      const val = raw.trim()
      if (!EXTERNAL.test(val)) continue
      blocked.push(val)
      el.setAttribute(spec.attr, PLACEHOLDER_IMG)
    }

    // 内联样式：background-image / list-style-image / border-image / cursor / filter / @import 都在这里
    const style = el.getAttribute('style')
    if (style !== null && /url\(|@import/i.test(style)) {
      const next = sanitizeCss(style, blocked)
      if (next !== style) el.setAttribute('style', next)
    }
  }

  // <style> / <link rel=stylesheet>：
  for (const st of Array.from(doc.querySelectorAll('style'))) {
    const css = st.textContent || ''
    if (!/url\(|@import/i.test(css)) continue
    const next = sanitizeCss(css, blocked)
    if (next !== css) st.textContent = next
  }
}

/**
 * 没有 DOM 的环境（纯 node 断言）用的**保守**字符串兜底。
 *
 * 明确声明：这条路径**不是**被验收的那条（验收在本机 Chromium 里跑真实 `PreviewPane` + iframe）。
 * 它只保证"宁可多拦、绝不漏放"，因此对 `//` 出现的位置一律从严——不做精细的标签/属性判断。
 */
function fallback(html: string, blocked: string[]): string {
  return String(html || '')
    .replace(/(\s(?:src|href|poster|data|background|lowsrc)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (m, pre: string, dq, sq, bare) => {
      const val = String(dq ?? sq ?? bare ?? '').trim()
      if (!EXTERNAL.test(val)) return m
      blocked.push(val)
      return `${pre}"${PLACEHOLDER_IMG}"`
    })
    .replace(/(\ssrcset\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_m, pre: string, dq, sq, bare) =>
      `${pre}"${sanitizeSrcset(String(dq ?? sq ?? bare ?? ''), blocked)}"`,
    )
    .replace(/@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*?))\s*\)|"([^"]*)"|'([^']*)')\s*[^;]*;?/gi, (m, ...g) => {
      const val = String([g[0], g[1], g[2], g[3], g[4]].find((x) => x !== undefined) ?? '').trim()
      if (!EXTERNAL.test(val)) return m
      blocked.push(val)
      return ''
    })
    .replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*?))\s*\)/gi, (m, dq, sq, bare) => {
      const val = String(dq ?? sq ?? bare ?? '').trim()
      if (!EXTERNAL.test(val)) return m
      blocked.push(val)
      return `url("${PLACEHOLDER_IMG}")`
    })
}

/** 是否具备按解析语义处理的条件（验收脚本据此记录"走的是哪条路径"） */
export function hasDomParser(): boolean {
  return typeof DOMParser !== 'undefined'
}

/**
 * 去掉显示层的外链资源引用。返回替换后的 HTML 与被拦下的 URL 清单。
 *
 * **惰性解析**：`DOMParser` 产出的文档没有浏览上下文，解析阶段不会为任何节点发起加载
 * （这是"绝不先把未处理节点插进活动文档"的落点）。处理完再序列化回字符串。
 */
export function neutralizeExternalResources(html: string): { html: string; blocked: string[] } {
  const blocked: string[] = []
  const src = String(html || '')
  if (!src) return { html: src, blocked }
  if (typeof DOMParser === 'undefined') return { html: fallback(src, blocked), blocked }

  const doc = new DOMParser().parseFromString(`<body>${src}</body>`, 'text/html')
  walk(doc, blocked)
  return { html: doc.body ? doc.body.innerHTML : src, blocked }
}
