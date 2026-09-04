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

// 把 compose 输出中的 @@ARTn@@ 占位逐一替换为渲染结果
export async function renderArtPlaceholders(html: string, arts: { svg: string }[]): Promise<string> {
  let out = html
  for (let i = 0; i < arts.length; i++) {
    const uri = await svgToPngDataUri(arts[i].svg)
    out = out.split('@@ART' + i + '@@').join(uri)
  }
  return out
}
