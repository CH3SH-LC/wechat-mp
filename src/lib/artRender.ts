// artRender.ts —— SVG 美术素材 → 图片 data URI（第 15 轮）
// 优先 canvas 2x 渲染为 PNG（微信后台粘贴可转存）；canvas 不可用/加载失败时回退 svg data URI。

function svgDataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export async function svgToPngDataUri(svg: string): Promise<string> {
  const viewBox = /viewBox="\s*[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)"/.exec(svg)
  const w = viewBox ? parseFloat(viewBox[1]) : 300
  const h = viewBox ? parseFloat(viewBox[2]) : 300
  if (!w || !h || w <= 0 || h <= 0 || w > 2000 || h > 2000) return svgDataUri(svg)
  try {
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return svgDataUri(svg)
    const img = new Image()
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    const ok = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    })
    if (!ok) return svgDataUri(svg)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return svgDataUri(svg)
  }
}

/**
 * SVG → 小尺寸 PNG data URL（P2 视觉复核用）。
 * 视觉接口按图计费且有单边像素上限，所以先缩到 max 边长再送去"看"；
 * 渲染失败时退回原尺寸 PNG，再不行退回 SVG data URI（调用方据此跳过该候选）。
 */
export async function svgToThumbDataUri(svg: string, max = 256): Promise<string> {
  const viewBox = /viewBox="\s*[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)"/.exec(svg)
  const w = viewBox ? parseFloat(viewBox[1]) : 300
  const h = viewBox ? parseFloat(viewBox[2]) : 300
  if (!w || !h || w <= 0 || h <= 0) return svgDataUri(svg)
  const scale = Math.min(1, max / Math.max(w, h))
  const cw = Math.max(8, Math.round(w * scale))
  const ch = Math.max(8, Math.round(h * scale))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return svgDataUri(svg)
    const img = new Image()
    const ok = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })
    if (!ok) return svgToPngDataUri(svg)
    ctx.drawImage(img, 0, 0, cw, ch)
    return canvas.toDataURL('image/png')
  } catch {
    return svgToPngDataUri(svg)
  }
}

// 把 compose 输出中的 @@ARTn@@ 占位逐一替换为渲染结果
export async function renderArtPlaceholders(html: string, arts: { svg: string }[]): Promise<string> {
  let out = html
  for (let i = 0; i < arts.length; i++) {
    const uri = await svgToPngDataUri(arts[i].svg)
    out = out.split('@@ART' + i + '@@').join(uri)
  }
  return out
}
