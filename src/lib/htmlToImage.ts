// htmlToImage.ts —— 把正文 HTML 渲染成图片（第 34 轮：替代微信草稿箱 API，改为用户手动上传）
// 思路：375px 版式（与预览一致）挂进隐藏容器量高 → SVG <foreignObject> 光栅化到 2x 画布（750 宽）
// → 整篇长图 + 分页各一张 PNG（data URL 返回，由 exportImages 决定落盘/下载）。
// 依赖 WebView2/Chromium 对 foreignObject 的支持；正文为内联样式 + data:image，无外链，可离线渲染。
//
// 2026-10-07（B 路 · 安全分页）：旧实现是**等高硬切**——`for (y = 0; y < h; y += PAGE_CSS_H)`，
// 切口落在 1000 CSS px 的整数倍上，不问内容边界，于是**文字行与插画会被拦腰切断**（2026-10-03
// 分页深研已用旧原图证实：第 2 页底部「台人工办理」与第 3 页顶部残留是同一行）。
// 现在改为「先量保护区，再选切点」：目标页高仍是 1000 CSS px，但每一刀都退到**不穿过普通内容**
// 的位置，因而**页高可以不同**；长图、375px 版式、2x 输出（750px 宽）一律不变。
// 方案与边界见 docs/research/2026-10-03-strategy/pagination-deep-dive.md §3。

export interface RenderedImages {
  cssH: number
  long: string // data:image/png;base64,…
  pages: string[] // 每屏一图（2x），data URL
  /** 分页切点（**设备像素**，整数）：首 0、末 canvasPx，严格递增，长度 = pages.length + 1 */
  cutsPx: number[]
  /** 超高页（切点间距 > 目标页高）：为保持整块完整而输出的一张较高页 */
  oversize: OversizePage[]
  /** 受保护区间的合并结果（设备像素），供诊断与复核 */
  protectedRanges: { top: number; bottom: number; kinds: string[] }[]
}

export interface OversizePage {
  /** 该页起止切点（设备像素） */
  startPx: number
  endPx: number
  /** 页高（设备像素） */
  hPx: number
  /** 目标页高（设备像素），用于对比 */
  targetPx: number
  reason: 'oversize-unbreakable'
}

/** 目标页高（CSS px）；实际页高允许不同 */
const PAGE_CSS_H = 1000 // 每屏约一手机屏高的 CSS 高度（2x 后为 PAGE_CSS_H*2 px）
const WIDTH = 375
const SCALE = 2
const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
/** 目标页高（设备像素） */
const TARGET_PX = PAGE_CSS_H * SCALE
/**
 * 保护区上下各外扩的余量（设备像素）。Range 返回的是**行盒**矩形，不是字形轮廓：
 * 上/下标的墨迹、斜体伸出、加粗压边都可能落在行盒边缘外一点点，留 1 个图片像素挡掉。
 */
const PROTECT_PAD_PX = 1
/** 末页小尾巴阈值（设备像素）：末页不足这么多就并入上一页，避免"末页近空" */
const MIN_TAIL_PX = 8
/** 一页的最小高度（设备像素）：更窄的"页"是退化的碎片，并入相邻页 */
const MIN_PAGE_PX = 40
/**
 * 单张画布的高度上限（设备像素）。**实测量得**（本机 Chromium 1234，宽 750）：
 * 65535 仍能正常 `toDataURL` 出图，65536 起 `toDataURL()` 不抛异常、只返回 `"data:,"`
 * ——画布是**空的**。也就是说超限是"静默失败"，旧实现的 `> 200000` CSS px 上限
 * （= 400000 设备像素）根本挡不住它，会悄悄导出一张空长图。所以这里按**真实能力**设限并报错。
 */
const MAX_CANVAS_PX = 65535

function sleepFrame(n = 2): Promise<void> {
  return new Promise((resolve) => {
    let k = 0
    const step = () => {
      k++
      if (k >= n) resolve()
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

// ── 保护区测量 ──────────────────────────────────────────────────────────────────────

/** host 内坐标（CSS px）上的一个待保护区间 */
interface CssRange {
  top: number
  bottom: number
  kind: string
}

function isInvisible(cs: CSSStyleDeclaration): boolean {
  return cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0
}

function transparentColor(v: string): boolean {
  const s = (v || '').trim().toLowerCase()
  return !s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)'
}

function hasVisibleBorder(cs: CSSStyleDeclaration): boolean {
  for (const side of ['top', 'right', 'bottom', 'left']) {
    if (parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0) return true
  }
  return false
}

/**
 * 收集"切点不得穿过"的内容区间（host 内 CSS 坐标）。四类对象，与分页深研 §3/§9 一致：
 *   ① 文字行：逐个**文本节点**用 `Range` 取每行矩形（不是整块元素的包围框——多行 span 的包围框
 *      含行间空白，用它判断会既漏切又误判）；
 *   ② 图片 / 内联 SVG / canvas / video：整块保护（不识别图内内容）；
 *   ③ 表格行 `tr`：整行保护（不拆行、不重复表头）；
 *   ④ **非文本可见叶子**：没有文字、但真有背景色/背景图/边框的叶子元素（`compose` 产出的花边
 *      分隔线、时间线圆点、菱形角饰等）。只取叶子，**不**把带背景的祖先 section 整块保护——
 *      否则大卡片会把整段正文变成不可分割区，动辄产出超高页。
 */
function collectProtected(host: HTMLElement, top0: number, hostH: number): CssRange[] {
  const out: CssRange[] = []
  const push = (r: DOMRect, kind: string) => {
    const top = r.top - top0
    const bottom = r.bottom - top0
    if (!(r.width > 0) || !(r.height > 0)) return
    if (bottom <= 0 || top >= hostH) return // 完全在画布外的装饰不计
    out.push({ top, bottom, kind })
  }

  // ① 文字行
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const tn = node as Text
    if (!tn.nodeValue || !tn.nodeValue.trim()) continue
    const parent = tn.parentElement
    if (!parent) continue
    const cs = getComputedStyle(parent)
    if (isInvisible(cs)) continue
    range.selectNodeContents(tn)
    // `getClientRects` 每行一个矩形（换行/`<br/>` 都算），这正是"文字行"的定义。
    for (const r of Array.from(range.getClientRects())) push(r, 'text')
  }

  // ② 图片 / 内联 SVG / canvas / video
  for (const el of Array.from(host.querySelectorAll('img,svg,canvas,video'))) {
    const cs = getComputedStyle(el)
    if (isInvisible(cs)) continue
    const tag = el.tagName.toLowerCase()
    push(el.getBoundingClientRect(), tag === 'img' ? 'img' : tag)
  }

  // ③ 表格行
  for (const el of Array.from(host.querySelectorAll('tr'))) {
    if (isInvisible(getComputedStyle(el))) continue
    push(el.getBoundingClientRect(), 'tr')
  }

  // ④ 非文本可见叶子（装饰）
  for (const el of Array.from(host.querySelectorAll('*'))) {
    if (el.children.length) continue // 只取叶子
    if (el.closest('svg')) continue // SVG 内部已由 ② 整体保护
    const text = el.textContent
    if (text && text.trim()) continue // 有文字 → ① 已按行覆盖
    const cs = getComputedStyle(el)
    if (isInvisible(cs)) continue
    if (cs.position === 'fixed') continue
    const filled = !transparentColor(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== 'none')
    if (!filled && !hasVisibleBorder(cs)) continue
    // 变换后矩形（rotate 等以真实包围框为准，不从 style.width/height 推）
    push(el.getBoundingClientRect(), 'deco')
  }

  return out
}

/** CSS 区间 → 整数设备像素区间（上缘向下取整、下缘向上取整 + 余量），并合并相交/相接的区间 */
function toDeviceRanges(ranges: CssRange[], canvasPx: number): { top: number; bottom: number; kinds: string[] }[] {
  const dev = ranges
    .map((r) => ({
      top: Math.max(0, Math.floor(r.top * SCALE) - PROTECT_PAD_PX),
      bottom: Math.min(canvasPx, Math.ceil(r.bottom * SCALE) + PROTECT_PAD_PX),
      kind: r.kind,
    }))
    .filter((r) => r.bottom > r.top)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom)

  const merged: { top: number; bottom: number; kinds: string[] }[] = []
  for (const r of dev) {
    const last = merged[merged.length - 1]
    if (last && r.top <= last.bottom) {
      last.bottom = Math.max(last.bottom, r.bottom)
      if (!last.kinds.includes(r.kind)) last.kinds.push(r.kind)
    } else {
      merged.push({ top: r.top, bottom: r.bottom, kinds: [r.kind] })
    }
  }
  return merged
}

/**
 * 安全切点计划（设备像素，整数）。
 *
 * 目标：从当前切点 `cur` 出发，尽量前进 `TARGET_PX`（= 1000 CSS × 2），但**绝不落在保护区内部**。
 *   · 目标点若在保护区里 → 退到该保护区**之前**最后一个合法点（`iv.top`），页高随之变短；
 *   · 若退无可退（保护区从 `cur` 就开始、一路盖过目标点）→ 说明这段内容**高于目标页高且不可分割**：
 *     向前找到该保护区**之后**第一个合法点（`iv.bottom`），输出一张**超高页**并记录原因。
 *     原地循环、静默切字、整体缩小字号都在禁止之列。
 *   · 末页不足 `MIN_TAIL_PX` 时并入上一页，保证末页不是一条空缝。
 *
 * 结果严格递增：`cuts[0] === 0`、`cuts[n] === canvasPx`、相邻差 > 0。
 */
function planCuts(
  canvasPx: number,
  merged: { top: number; bottom: number; kinds: string[] }[],
  target: number,
): { cutsPx: number[]; oversize: OversizePage[] } {
  const cutsPx = [0]
  const oversize: OversizePage[] = []
  let cur = 0
  let guard = 0
  while (cur < canvasPx) {
    if (guard++ > 100000) throw new Error('分页切点计划未收敛（内部错误）')
    const aim = cur + target
    let next = canvasPx
    if (aim < canvasPx) {
      // 向后（取值变小）退到 target 之前最近的一个合法点
      let back = aim
      for (let i = merged.length - 1; i >= 0; i--) {
        const iv = merged[i]
        if (iv.top < back && back < iv.bottom) back = iv.top
      }
      if (back > cur) {
        next = back
      } else {
        // 退不动了：保护区盖住了整段目标。向前跳到该保护区之后，形成超高页。
        let fwd = aim
        for (let i = 0; i < merged.length; i++) {
          const iv = merged[i]
          if (iv.top < fwd && fwd < iv.bottom) fwd = iv.bottom
        }
        next = Math.min(Math.max(fwd, cur + 1), canvasPx)
        oversize.push({ startPx: cur, endPx: next, hPx: next - cur, targetPx: target, reason: 'oversize-unbreakable' })
      }
    }
    if (canvasPx - next < MIN_TAIL_PX) next = canvasPx // 末页尾巴并入上一页
    cutsPx.push(next)
    cur = next
  }
  for (let i = 1; i < cutsPx.length; i++) {
    if (cutsPx[i] <= cutsPx[i - 1]) {
      throw new Error(`分页切点非严格递增（第 ${i} 点 ${cutsPx[i]} ≤ ${cutsPx[i - 1]}），已中止导出`)
    }
  }
  if (cutsPx[cutsPx.length - 1] !== canvasPx) {
    throw new Error(`分页未覆盖到画布末尾（末切点 ${cutsPx[cutsPx.length - 1]} ≠ ${canvasPx}），已中止导出`)
  }
  return { cutsPx, oversize }
}

// ── 主流程 ─────────────────────────────────────────────────────────────────────────

/** 把 compose 输出的正文 html（与预览同款 375px 版式）光栅化为 2x PNG data URL。 */
export async function renderArticleImages(html: string): Promise<RenderedImages> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;font-family:${FONT};`
  host.innerHTML = `<div style="width:${WIDTH}px;box-sizing:border-box">${html}</div>`
  document.body.appendChild(host)
  try {
    // 等内嵌 data 图解码 + 字体/布局稳定后再量高
    await Promise.all([...host.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())))
    await sleepFrame(2)
    const h = Math.ceil(host.getBoundingClientRect().height)
    if (!h) throw new Error('正文为空，无法转图')

    const W2 = WIDTH * SCALE
    const H2 = h * SCALE
    if (H2 > MAX_CANVAS_PX) {
      throw new Error(
        `正文高 ${h} CSS px（${H2} 设备像素）超出画布能力上限 ${MAX_CANVAS_PX} 设备像素，无法转图：请缩短正文`,
      )
    }

    // 量保护区（必须在 host 仍挂在文档里时量——脱离文档后 getBoundingClientRect 全为 0）
    const top0 = host.getBoundingClientRect().top
    const protectedRanges = toDeviceRanges(collectProtected(host, top0, h), H2)

    const inner = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${WIDTH}px;box-sizing:border-box;font-family:${FONT}">${html}</div>`
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}">` +
      `<g transform="scale(${SCALE})"><foreignObject width="${WIDTH}" height="${h}">${inner}</foreignObject></g></svg>`
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await img.decode()

    const cv = document.createElement('canvas')
    cv.width = W2
    cv.height = H2
    const ctx = cv.getContext('2d')
    if (!ctx) throw new Error('无法创建 2D 画布')
    ctx.drawImage(img, 0, 0)
    const long = cv.toDataURL('image/png')
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{100,}/.test(long)) {
      // 超限时 canvas.toDataURL 会静默返回 "data:,"（不抛异常）——那等于一张空图，必须报错
      throw new Error(`长图画布导出失败（${W2}×${H2} 设备像素未产出有效 PNG），无法导出`)
    }

    // 切点计划：把"碎片页 / 空白页"并入相邻页，保证没有空页、也没有窄到看不见的页。
    // 合并不丢像素（页区间始终连续覆盖 [0, canvasPx)），只是让相邻两页变成一页。
    const plan = planCuts(H2, protectedRanges, TARGET_PX)
    const blank = (y0: number, y1: number): boolean => {
      if (y1 - y0 <= 0) return true
      const d = ctx.getImageData(0, y0, W2, y1 - y0).data
      for (let i = 0; i < d.length; i += 16) {
        if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return false
      }
      return true
    }
    let mergeGuard = 0
    for (;;) {
      if (mergeGuard++ > 1000) throw new Error('分页合并未收敛（内部错误）')
      const n = plan.cutsPx.length - 1
      if (n <= 1) break
      let bad = -1
      for (let i = 0; i < n; i++) {
        const hgt = plan.cutsPx[i + 1] - plan.cutsPx[i]
        if (hgt < MIN_PAGE_PX || blank(plan.cutsPx[i], plan.cutsPx[i + 1])) {
          bad = i
          break
        }
      }
      if (bad < 0) break
      // 第 0 页没有上一页可并，改为把它并进第 1 页（去掉 0 之后的那个切点）
      plan.cutsPx.splice(bad === 0 ? 1 : bad, 1)
    }
    if (plan.cutsPx.length < 2) throw new Error('分页计划为空（内部错误）')

    // 分页：按切点连续区间 [cuts[i], cuts[i+1]) 裁图，页高可不同
    const pages: string[] = []
    for (let i = 0; i < plan.cutsPx.length - 1; i++) {
      const y = plan.cutsPx[i]
      const ph = plan.cutsPx[i + 1] - y
      if (ph <= 0) throw new Error(`第 ${i + 1} 页高度非正（${ph} 设备像素），已中止导出`)
      if (ph > MAX_CANVAS_PX) {
        throw new Error(
          `第 ${i + 1} 页高 ${ph} 设备像素超出画布能力上限 ${MAX_CANVAS_PX}（不可分割块过高），无法导出该页`,
        )
      }
      const pc = document.createElement('canvas')
      pc.width = W2
      pc.height = ph
      const pctx = pc.getContext('2d')
      if (!pctx) throw new Error('无法创建分页画布')
      pctx.drawImage(cv, 0, y, W2, ph, 0, 0, W2, ph)
      const url = pc.toDataURL('image/png')
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{100,}/.test(url)) {
        throw new Error(`第 ${i + 1} 页（${W2}×${ph}）未产出有效 PNG，无法导出`)
      }
      pages.push(url)
    }
    return { cssH: h, long, pages, cutsPx: plan.cutsPx, oversize: plan.oversize, protectedRanges }
  } finally {
    host.remove()
  }
}
