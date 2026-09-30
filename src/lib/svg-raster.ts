// svg-raster.ts —— 素材 SVG 的栅格质量检查 Tier 2（P1，2026-09-24 调查 §3；
//                   真实显示尺寸与对比度：修复计划阶段 5，2026-09-28）
// Tier 1（svg-quality.ts）是纯解析度量，看不出"渲染出来到底有没有东西"；本层把 SVG 真的画到
// canvas 上数像素，补上 Tier 1 无法判定的问题：
// - 渲染后整幅透明（元素存在但画不出可见像素）；
// - 照片位装饰框的"中间透明窗"是否存在（这是照片框角色的定义性要求）；
// - **阶段 5 新增**：按素材**真实显示尺寸**渲染（角饰最终只有 60px 宽），并计算主体实际
//   像素尺寸与「墨迹相对背景的对比度」。旧实现一律缩到 256px 再量——一张 60px 的角饰在
//   256px 下看起来很饱满，缩到实际尺寸可能只剩一个几乎看不见的浅色小点。
//   阈值来自一批可接受/不可接受样例的实测（见 scripts/raster-check.mjs 与校准记录），
//   只拦"浅色消失 / 主体不可辨"这类退化，不评价美感。
// 只在有 canvas 的环境可用（webview）；无 document 时返回 null，调用方跳过本层。

export interface RasterStats {
  w: number
  h: number
  /** 渲染时每个 CSS 像素对应多少个位图像素（用于把测量值折算回真实显示尺寸） */
  sampleScale: number
  /** 该素材位在文章里的真实显示宽度（CSS px） */
  targetWidth: number
  inkPixels: number
  nonTransparentRatio: number // 非透明像素 / 总像素
  inkBBox: { x: number; y: number; w: number; h: number } | null // 归一 0..1
  quadrants: [number, number, number, number] // 四象限墨迹占比（左上/右上/左下/右下）
  centerRatio: number // 中央 40%×40% 区域的墨迹占比
  /** 主体墨迹包围盒的短边，折算到**真实显示尺寸**下的像素值（阶段 5） */
  subjectPx: number
  /** 墨迹（按 alpha 合成到背景后）与背景的平均亮度差，0–255（阶段 5：浅色消失 → 趋近 0） */
  contrast: number
  /** 对比度最高的那部分墨迹（第 90 百分位）——避免个别深色像素掩盖整幅发虚 */
  contrastP90: number
  background: string
}

const ALPHA_MIN = 12
/** 渲染倍率：按真实显示宽度的 2 倍栅格化，再折算回去（近似高分屏下的实际观感） */
const SAMPLE_SCALE = 2
/** 目标宽度的合理区间：过小无法测量，过大浪费（且与真实显示无关） */
const MIN_TARGET_WIDTH = 24
const MAX_TARGET_WIDTH = 400

export interface RasterOptions {
  /** 该素材位在文章里的真实显示宽度（CSS px）；缺省 300 */
  targetWidth?: number
  /** 背景色（CSS 颜色，默认白色——推文正文底色） */
  background?: string
}

function canvasOf(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  try {
    return document.createElement('canvas')
  } catch {
    return null
  }
}

/** CSS 颜色 → [r,g,b]；只认 #rgb/#rrggbb/rgb()/常用色名，认不出按白色 */
export function parseBg(css: string): [number, number, number] {
  const s = String(css || '').trim().toLowerCase()
  const named: Record<string, [number, number, number]> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    '#fff': [255, 255, 255],
  }
  if (named[s]) return named[s]
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (hex) {
    const h = hex[1]
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return [255, 255, 255]
}

/** 相对亮度（0–255 的近似；不追求 WCAG 精确公式，只需在同类背景上可比） */
function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * 把 SVG 画到 canvas 上并统计墨迹分布；环境不支持或渲染失败返回 null。
 * 阶段 5 起按 `targetWidth`（该素材位的真实显示宽度）栅格化。
 */
export async function rasterStats(svg: string, opts?: RasterOptions): Promise<RasterStats | null> {
  const vb = /viewBox\s*=\s*"([^"]*)"/i.exec(String(svg || ''))
  let w = 300
  let h = 300
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number)
    if (p.length === 4 && p[2] > 0 && p[3] > 0) {
      w = p[2]
      h = p[3]
    }
  }
  if (!w || !h) return null

  const background = opts?.background || '#ffffff'
  const targetWidth = Math.min(MAX_TARGET_WIDTH, Math.max(MIN_TARGET_WIDTH, Math.round(opts?.targetWidth ?? 300)))
  const cw = Math.max(8, Math.round(targetWidth * SAMPLE_SCALE))
  const ch = Math.max(8, Math.round(((targetWidth * h) / w) * SAMPLE_SCALE))

  const canvas = canvasOf()
  if (!canvas) return null
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  const img = new Image()
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
  if (!ok) return null
  ctx.clearRect(0, 0, cw, ch)
  ctx.drawImage(img, 0, 0, cw, ch)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, cw, ch).data
  } catch {
    return null // 跨源污染等
  }

  const bg = parseBg(background)
  const bgLuma = luma(bg[0], bg[1], bg[2])

  let ink = 0
  let minX = cw
  let minY = ch
  let maxX = -1
  let maxY = -1
  const quad = [0, 0, 0, 0]
  let centerInk = 0
  const cx0 = Math.floor(cw * 0.3)
  const cx1 = Math.ceil(cw * 0.7)
  const cy0 = Math.floor(ch * 0.3)
  const cy1 = Math.ceil(ch * 0.7)
  const contrasts: number[] = []
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4
      const a = data[i + 3] / 255
      if (data[i + 3] < ALPHA_MIN) continue
      ink++
      // 按 alpha 把墨迹合成到背景上，得到"用户实际看到的颜色"
      const cr = data[i] * a + bg[0] * (1 - a)
      const cg = data[i + 1] * a + bg[1] * (1 - a)
      const cb = data[i + 2] * a + bg[2] * (1 - a)
      contrasts.push(Math.abs(luma(cr, cg, cb) - bgLuma))
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      const qi = (y < ch / 2 ? 0 : 2) + (x < cw / 2 ? 0 : 1)
      quad[qi]++
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) centerInk++
    }
  }
  const total = cw * ch
  const bboxW = maxX < 0 ? 0 : maxX - minX + 1
  const bboxH = maxY < 0 ? 0 : maxY - minY + 1
  // 折算回真实显示尺寸：位图上是 SAMPLE_SCALE 倍
  const subjectPx = Math.min(bboxW, bboxH) / SAMPLE_SCALE
  contrasts.sort((a, b) => a - b)
  const mean = contrasts.length ? contrasts.reduce((s, v) => s + v, 0) / contrasts.length : 0
  const p90 = contrasts.length ? contrasts[Math.min(contrasts.length - 1, Math.floor(contrasts.length * 0.9))] : 0

  return {
    w: cw,
    h: ch,
    sampleScale: SAMPLE_SCALE,
    targetWidth,
    inkPixels: ink,
    nonTransparentRatio: ink / total,
    inkBBox: maxX < 0 ? null : { x: minX / cw, y: minY / ch, w: bboxW / cw, h: bboxH / ch },
    quadrants: [
      ink ? quad[0] / ink : 0,
      ink ? quad[1] / ink : 0,
      ink ? quad[2] / ink : 0,
      ink ? quad[3] / ink : 0,
    ],
    centerRatio: ink ? centerInk / ink : 0,
    subjectPx,
    contrast: mean,
    contrastP90: p90,
    background,
  }
}

// ---------- 阈值（阶段 5：在样例上校准，不凭感觉定） ----------
// 校准依据见 scripts/raster-check.mjs 的实测表（bud / star / 四叶草等真实库素材作薄弱样例）。
// 只拦"浅色消失 / 主体小到不可辨"这两类**退化**：
// - CONTRAST_P90_MIN 是主判据：**主体最清楚的那部分**与底色的亮度差。
//   不用平均对比度当主判据——平均值会被大面积极淡的氛围光斑（如 star 那圈 glow）拉低，
//   把"主体其实清楚、只是外圈很淡"的角饰误判成"看不见"（实测 star 均值 12.5 / P90 41.3）。
// - CONTRAST_MEAN_MIN 只作地板：整幅与底色几乎同色（连氛围都没画出来）才拦。
// - SUBJECT_MIN_PX：主体短边在真实显示尺寸下的下限（明显是"一个点"而不是"一个形"）。
export const DECO_MIN_CONTRAST_P90 = 24
export const DECO_MIN_CONTRAST_MEAN = 6
export const DECO_MIN_SUBJECT_PX = 12
/** 位图上的绝对墨迹像素下限：低于它说明"确实什么都没画出来"（不是"画得小"） */
export const MIN_INK_PIXELS = 24

/** 按角色判定栅格指标（返回具体不达标原因；空数组 = 通过） */
export function checkRaster(s: RasterStats, kind: string): string[] {
  const out: string[] = []
  // "画不出东西"用**绝对像素数**判定，不用占全画布的比例：
  // 角饰在真实尺寸下本来就只占画布一小块（实测合格样例约占 2%），用比例会把正常的
  // 小主体一并判成"全透明"。这里只拦"确实什么都没画出来"。
  if (s.inkPixels < MIN_INK_PIXELS) {
    out.push('渲染后几乎没有可见像素（元素虽在但画不出东西）')
    return out
  }
  if (kind === 'deco') {
    if (s.quadrants[3] < 0.55) {
      out.push(`角饰主体未集中在右下（右下象墨迹仅占 ${Math.round(s.quadrants[3] * 100)}%，应 ≥55%）`)
    }
    if (s.nonTransparentRatio > 0.7) {
      out.push(`角饰涂满整幅（墨迹占 ${Math.round(s.nonTransparentRatio * 100)}%，应 ≤70%），缩小后挤作一团`)
    }
    // 阶段 5：按真实显示尺寸判定"看不看得见"——浅色主体在浅底上会消失，缩到 60px 会糊成一个点
    if (s.contrastP90 < DECO_MIN_CONTRAST_P90) {
      out.push(
        `角饰在 ${s.targetWidth}px 显示尺寸下几乎看不见：主体最清楚的墨迹与底色「${s.background}」的对比度也只有 ${Math.round(s.contrastP90)}（应 ≥${DECO_MIN_CONTRAST_P90}），主体颜色太浅`,
      )
    } else if (s.contrast < DECO_MIN_CONTRAST_MEAN) {
      out.push(
        `角饰整幅与底色几乎同色（平均对比度仅 ${Math.round(s.contrast)}，应 ≥${DECO_MIN_CONTRAST_MEAN}）`,
      )
    }
    if (s.subjectPx < DECO_MIN_SUBJECT_PX) {
      out.push(
        `角饰主体在 ${s.targetWidth}px 显示尺寸下仅约 ${s.subjectPx.toFixed(1)}px（应 ≥${DECO_MIN_SUBJECT_PX}px），缩小后认不出是什么`,
      )
    }
    return out
  }
  if (kind === 'divider') {
    if (!s.inkBBox || s.inkBBox.w < 0.85) {
      out.push(`分割线未横向贯穿（墨迹仅占宽 ${s.inkBBox ? Math.round(s.inkBBox.w * 100) : 0}%）`)
    }
    return out
  }
  if (kind === 'photo-frame') {
    if (s.centerRatio > 0.02) {
      out.push(`照片框中央不是透明窗（中央区域墨迹占 ${Math.round(s.centerRatio * 100)}%，应 ≤2%）`)
    }
    const borderBand = 1 - s.centerRatio
    if (borderBand < 0.15 && s.quadrants.some((q) => q > 0)) {
      // 边框带过窄：墨迹几乎都在中央
      out.push('照片框缺少可辨认的边框（墨迹集中在中央，四周没有画框）')
    }
    return out
  }
  // wide / inline / heading 及未知角色：只拦"一个点"式的退化
  if (!s.inkBBox || s.inkBBox.w * s.inkBBox.h < 0.25) {
    out.push(`画面过于稀薄（墨迹包围盒仅占画布 ${Math.round((s.inkBBox ? s.inkBBox.w * s.inkBBox.h : 0) * 100)}%，至少 25%）`)
  }
  return out
}
