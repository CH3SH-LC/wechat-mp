// svg-quality.ts —— 素材 SVG 的确定性质量检查 Tier 1（P1，2026-09-24 调查 §3）
// 纯函数、无 IO、无 DOM：可在 node 脚本里直接断言，也可在 webview 里跑。
// 解决的旧缺陷：`viewBox + 元素数 >= 6` 会把「六个落在画布外、fill=none 的圆」判为合格。
// 现在的门槛按**角色**给（小角饰看轮廓与占比，大插画保持密度要求），并且只做"退化拦截"——
// 「60px 下的可读性」这类视觉判断交给提示词契约与视觉复核，不在确定层硬判，避免误杀好插画。

export interface SvgKindSpec {
  minVisible: number
  minCoverage: number // 可见元素并集包围盒 / viewBox 面积（拦"主体缩成一个小点"）
  /** 可选宽高比窗口 [min,max]（几何即语义的角色才设：分割线必须横贯、照片框必须方正） */
  ratio?: [number, number]
  /** 角饰禁止铺满画布（必须留出透气与文字避让空间） */
  forbidFullBleed?: boolean
  /** 分割线必须横向贯穿 */
  mustSpanWidth?: boolean
}

// 插槽显示尺寸（CSS px），用于把 viewBox 单位折算成实际显示像素
export const SLOT_PX: Record<string, { w: number; h: number }> = {
  wide: { w: 343, h: 220 },
  inline: { w: 210, h: 160 },
  deco: { w: 60, h: 60 },
  divider: { w: 343, h: 60 },
  heading: { w: 158, h: 70 },
  'photo-frame': { w: 343, h: 343 },
}

// minVisible 沿用历史上"≥6 元素"的地板口径（只是不再是**唯一**检查）。
// minCoverage 是**退化地板**而非构图评分：只拦"整幅大画布上一个小点"这类显然画坏的情况，
// 留出充足余量——一张 300x260、主体占 59%×38% 的正常插画不应被判不达标。
// 元素密度的高要求放在提示词契约（大图 20+）与视觉复核里，不在这里硬判。
export const KIND_SPECS: Record<string, SvgKindSpec> = {
  wide: { minVisible: 6, minCoverage: 0.1 },
  inline: { minVisible: 6, minCoverage: 0.08 },
  deco: { minVisible: 4, minCoverage: 0.05, ratio: [0, 2.4], forbidFullBleed: true },
  divider: { minVisible: 4, minCoverage: 0.03, ratio: [3, 20], mustSpanWidth: true },
  heading: { minVisible: 4, minCoverage: 0.05 },
  'photo-frame': { minVisible: 6, minCoverage: 0.15, ratio: [0.8, 1.25] },
}

const DEFAULT_SPEC: SvgKindSpec = { minVisible: 4, minCoverage: 0.1 }

export interface SvgBox {
  x: number
  y: number
  w: number
  h: number
}

export interface SvgMetrics {
  viewBox: { w: number; h: number } | null
  elements: number
  visible: number
  offCanvas: number
  /** 是否有元素提供了可解析的几何——几何未知时跳过所有"位置/占比"类判定 */
  geometryKnown: boolean
  coverage: number
  centroid: { x: number; y: number } | null // 归一 0..1，面积加权
  inkXRatio: number // 可见墨迹包围盒宽 / 画布宽
  inkYRatio: number
  /**
   * 墨迹包围盒的短边在插槽实际显示尺寸下的像素值。
   * 仅作报告与视觉复核的输入，**不参与自动判定**——"60px 下是否看得清"是视觉判断，
   * 用元素级尺寸或像素阈值硬判会误杀合理的小角饰（见调查 §3：确定性层只拦渲染为空/越界/透明/占位）。
   */
  motifPx: number
  slotPx: { w: number; h: number }
  unsafe: string[]
}

// 与 compose.svgElementCount 相同的剥离口径：注释与 defs/渐变/滤镜等非绘制块
function stripNonDrawing(svg: string): string {
  return String(svg || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(defs|clipPath|mask|filter|linearGradient|radialGradient|pattern|stop|style|desc|title|metadata)[\s\S]*?<\/\1>/gi, '')
}

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag)) !== null) out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3]
  return out
}

function styleMap(a: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  const s = a['style']
  if (!s) return out
  for (const part of s.split(';')) {
    const i = part.indexOf(':')
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim()
  }
  return out
}

function nums(s: string): number[] {
  const out: number[] = []
  const re = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(String(s || ''))) !== null) {
    const n = parseFloat(m[0])
    if (!Number.isNaN(n)) out.push(n)
  }
  return out
}

function emptyBox(): SvgBox {
  return { x: Infinity, y: Infinity, w: -Infinity, h: -Infinity }
}

/**
 * path 的包围盒：必须按命令语义解析绝对/相对坐标。
 * 朴素做法（把 d 里所有数字两两当坐标）在相对命令（q/h/v/l/c…）下会得到完全错误的框——
 * 既可能误判"铺满画布"，也会让覆盖率失真。这里做一次轻量命令遍历。
 * 无法解析（如含 arc）时返回 null，调用方按"几何未知"处理，绝不据此拒绝。
 */
function pathBox(d: string): SvgBox | null {
  const tokens = String(d || '').match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)
  if (!tokens || tokens.length < 3) return null
  let i = 0
  let cmd = ''
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const box = emptyBox()
  const push = (x: number, y: number) => {
    if (x < box.x) box.x = x
    if (y < box.y) box.y = y
    if (x > box.x + box.w) box.w = x - box.x
    if (y > box.y + box.h) box.h = y - box.y
  }
  const take = (n: number): number[] => {
    const out: number[] = []
    for (let k = 0; k < n; k++) out.push(parseFloat(tokens[i + k]))
    i += n
    return out
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i]
      i++
      if (cmd === 'Z' || cmd === 'z') {
        cx = sx
        cy = sy
        push(cx, cy)
      }
      continue
    }
    if (!cmd) return null
    const up = cmd.toUpperCase()
    const rel = cmd !== up
    if (up === 'A') return null // 弧线含紧凑标志位，易歧义 → 交给"几何未知"兜底
    if (up === 'M' || up === 'L' || up === 'T') {
      const [x, y] = take(2)
      if (Number.isNaN(x) || Number.isNaN(y)) return null
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      if (up === 'M') {
        sx = cx
        sy = cy
      }
      push(cx, cy)
    } else if (up === 'H') {
      const [x] = take(1)
      if (Number.isNaN(x)) return null
      cx = rel ? cx + x : x
      push(cx, cy)
    } else if (up === 'V') {
      const [y] = take(1)
      if (Number.isNaN(y)) return null
      cy = rel ? cy + y : y
      push(cx, cy)
    } else if (up === 'C') {
      const [x1, y1, x2, y2, x, y] = take(6)
      if ([x1, y1, x2, y2, x, y].some((v) => Number.isNaN(v))) return null
      push(rel ? cx + x1 : x1, rel ? cy + y1 : y1)
      push(rel ? cx + x2 : x2, rel ? cy + y2 : y2)
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      push(cx, cy)
    } else if (up === 'S' || up === 'Q') {
      const [x1, y1, x, y] = take(4)
      if ([x1, y1, x, y].some((v) => Number.isNaN(v))) return null
      push(rel ? cx + x1 : x1, rel ? cy + y1 : y1)
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      push(cx, cy)
    } else {
      return null // 未知命令 → 几何未知
    }
  }
  if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || box.w < 0 || box.h < 0) return null
  return box
}

const NONE_VALUES = new Set(['none', 'transparent', ''])

/** 元素是否真的会画出可见像素：fill 或 stroke 有效，且未整体隐藏 */
function isPaintable(a: Record<string, string>, st: Record<string, string>, svgFill: string | undefined): boolean {
  const fillRaw = a['fill'] ?? st['fill'] ?? svgFill ?? 'black' // SVG 默认填充为黑
  const strokeRaw = a['stroke'] ?? st['stroke'] ?? 'none'
  const fill = String(fillRaw).trim().toLowerCase()
  const stroke = String(strokeRaw).trim().toLowerCase()
  const hasFill = !NONE_VALUES.has(fill)
  const hasStroke = !NONE_VALUES.has(stroke)
  if (!hasFill && !hasStroke) return false
  const disp = String(a['display'] ?? st['display'] ?? '').trim().toLowerCase()
  if (disp === 'none') return false
  const vis = String(a['visibility'] ?? st['visibility'] ?? '').trim().toLowerCase()
  if (vis === 'hidden' || vis === 'collapse') return false
  const op = parseFloat(a['opacity'] ?? st['opacity'] ?? '1')
  if (!Number.isNaN(op) && op === 0) return false
  if (hasFill) {
    const fo = parseFloat(a['fill-opacity'] ?? st['fill-opacity'] ?? '1')
    if (!Number.isNaN(fo) && fo === 0) return false
  }
  if (hasStroke) {
    const so = parseFloat(a['stroke-opacity'] ?? st['stroke-opacity'] ?? '1')
    if (!Number.isNaN(so) && so === 0) return false
  }
  return true
}

function boxOf(tag: string, a: Record<string, string>): SvgBox | null {
  const n = (k: string, d = 0) => {
    const v = parseFloat(a[k])
    return Number.isNaN(v) ? d : v
  }
  switch (tag) {
    case 'rect':
    case 'image':
      return { x: n('x'), y: n('y'), w: Math.abs(n('width')), h: Math.abs(n('height')) }
    case 'circle': {
      const r = Math.abs(n('r'))
      return { x: n('cx') - r, y: n('cy') - r, w: r * 2, h: r * 2 }
    }
    case 'ellipse': {
      const rx = Math.abs(n('rx'))
      const ry = Math.abs(n('ry'))
      return { x: n('cx') - rx, y: n('cy') - ry, w: rx * 2, h: ry * 2 }
    }
    case 'line': {
      const x1 = n('x1')
      const y1 = n('y1')
      const x2 = n('x2')
      const y2 = n('y2')
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
    }
    case 'polygon':
    case 'polyline': {
      const p = nums(a['points'])
      if (p.length < 2) return null
      const xs: number[] = []
      const ys: number[] = []
      for (let i = 0; i + 1 < p.length; i += 2) {
        xs.push(p[i])
        ys.push(p[i + 1])
      }
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
    case 'path':
      return pathBox(a['d'])
    default:
      return null
  }
}

const EMOJI_RE = /[\p{Extended_Pictographic}]/u

/**
 * 解析并度量一段 SVG 素材。
 * 关键防退化规则：带 transform 的元素一律视为在画布内且包围盒不设限——
 * 好插画大量使用 transform，绝不能因此被拒。
 */
export function analyzeSvg(svg: string, slotPx?: { w: number; h: number }): SvgMetrics {
  const raw = String(svg || '')
  const body = stripNonDrawing(raw)
  const vb = /viewBox\s*=\s*"([^"]*)"/i.exec(body)
  let viewBox: { w: number; h: number } | null = null
  if (vb) {
    const p = nums(vb[1])
    if (p.length === 4 && p[2] > 0 && p[3] > 0) viewBox = { w: p[2], h: p[3] }
  }
  const rootTag = /<svg\b[^>]*>/i.exec(body)?.[0] || ''
  const rootFill = attrsOf(rootTag)['fill']

  const unsafe: string[] = []
  if (/<text\b/i.test(body)) unsafe.push('含 <text>（素材禁用文字）')
  if (/<script\b/i.test(body)) unsafe.push('含 <script>')
  if (/<image\b[^>]*(?:href|xlink:href)\s*=\s*["']https?:/i.test(body)) unsafe.push('含外链图片')
  const emoji = EMOJI_RE.exec(body)
  if (emoji) unsafe.push(`含 emoji 字符 ${emoji[0]}`)

  const re = /<(circle|rect|ellipse|line|path|polygon|polyline|image)\b([^>]*?)\/?>/gi
  let m: RegExpExecArray | null
  let elements = 0
  let visible = 0
  let offCanvas = 0
  const visBoxes: SvgBox[] = []
  while ((m = re.exec(body)) !== null) {
    elements++
    const tag = m[1].toLowerCase()
    const a = attrsOf(m[0])
    const st = styleMap(a)
    if (!isPaintable(a, st, rootFill)) continue
    visible++
    // 带 transform 或几何无法解析的元素：不可判位置，只计可见数、不参与包围盒，
    // 也绝不算"越界"——宁可放过，不能误杀（好插画大量使用 transform 与相对路径）。
    const box = a['transform'] ? null : boxOf(tag, a)
    if (!box || !viewBox) continue
    const inside = box.x + box.w > 0 && box.y + box.h > 0 && box.x < viewBox.w && box.y < viewBox.h
    if (!inside) {
      offCanvas++
      continue
    }
    visBoxes.push(box)
  }

  const slot = slotPx || { w: 300, h: 300 }
  let coverage = 0
  let inkXRatio = 0
  let inkYRatio = 0
  let motifPx = 0
  let centroid: { x: number; y: number } | null = null
  if (viewBox && visBoxes.length) {
    const x0 = Math.min(...visBoxes.map((b) => b.x))
    const y0 = Math.min(...visBoxes.map((b) => b.y))
    const x1 = Math.max(...visBoxes.map((b) => b.x + b.w))
    const y1 = Math.max(...visBoxes.map((b) => b.y + b.h))
    const w = Math.max(0, x1 - x0)
    const h = Math.max(0, y1 - y0)
    coverage = Math.min(1, (w * h) / (viewBox.w * viewBox.h))
    inkXRatio = Math.min(1, w / viewBox.w)
    inkYRatio = Math.min(1, h / viewBox.h)
    motifPx = Math.min(w, h) * Math.min(slot.w / viewBox.w, slot.h / viewBox.h)
    // 面积加权的墨迹中心（归一 0..1）
    let sa = 0
    let cx = 0
    let cy = 0
    for (const b of visBoxes) {
      const area = Math.max(b.w * b.h, 1)
      sa += area
      cx += (b.x + b.w / 2) * area
      cy += (b.y + b.h / 2) * area
    }
    if (sa > 0) centroid = { x: cx / sa / viewBox.w, y: cy / sa / viewBox.h }
  }

  return {
    viewBox,
    elements,
    visible,
    offCanvas,
    geometryKnown: visBoxes.length > 0,
    coverage,
    centroid,
    inkXRatio,
    inkYRatio,
    motifPx,
    slotPx: slot,
    unsafe,
  }
}

export interface SvgQualityResult {
  ok: boolean
  failures: string[]
  metrics: SvgMetrics
}

/** 按角色判定素材 SVG 是否达标（Tier 1，确定性） */
export function checkSvgQuality(svg: string, kind: string, slotPx?: { w: number; h: number }): SvgQualityResult {
  const spec = KIND_SPECS[kind] || DEFAULT_SPEC
  const metrics = analyzeSvg(svg, slotPx || SLOT_PX[kind])
  const failures: string[] = []
  if (!metrics.viewBox) {
    failures.push('缺少合法 viewBox')
    return { ok: false, failures, metrics }
  }
  if (metrics.elements === 0) failures.push('没有任何图形元素')
  if (metrics.unsafe.length) failures.push(...metrics.unsafe)
  if (metrics.visible < spec.minVisible) {
    failures.push(`可见元素仅 ${metrics.visible} 个（${kind} 至少 ${spec.minVisible} 个；fill=none 且无描边、或落在画布外的元素不计入）`)
  }
  if (metrics.offCanvas > 0) {
    failures.push(`有 ${metrics.offCanvas} 个可见元素完全落在画布外`)
  }
  // 以下判定都依赖"元素位置"，几何未知（全为 transform/弧线等）时一律跳过——宁可放过，不误杀
  if (metrics.geometryKnown) {
    if (metrics.coverage < spec.minCoverage) {
      failures.push(`主体占画布仅 ${Math.round(metrics.coverage * 100)}%（${kind} 至少 ${Math.round(spec.minCoverage * 100)}%）`)
    }
    const ratio = metrics.viewBox.w / metrics.viewBox.h
    if (spec.ratio && (ratio < spec.ratio[0] || ratio > spec.ratio[1])) {
      failures.push(`画布宽高比 ${ratio.toFixed(2)} 不符合该角色要求（应在 ${spec.ratio[0]}–${spec.ratio[1]} 之间）`)
    }
    if (spec.forbidFullBleed && (metrics.inkXRatio > 0.85 || metrics.inkYRatio > 0.85)) {
      failures.push('角饰铺满画布（应集中在一角，留出透气与文字避让空间）')
    }
    if (spec.mustSpanWidth && metrics.inkXRatio < 0.85) {
      failures.push(`横向贯穿不足（墨迹仅占画布宽 ${Math.round(metrics.inkXRatio * 100)}%）`)
    }
  }
  return { ok: failures.length === 0, failures, metrics }
}
