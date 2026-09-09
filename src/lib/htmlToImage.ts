// htmlToImage.ts —— 把正文 HTML 渲染成图片（第 34 轮：替代微信草稿箱 API，改为用户手动上传）
// 思路：375px 版式（与预览一致）挂进隐藏容器量高 → SVG <foreignObject> 光栅化到 2x 画布（750 宽）
// → 整篇长图 + 按屏分页各一张 PNG（data URL 返回，由 exportImages 决定落盘/下载）。
// 依赖 WebView2/Chromium 对 foreignObject 的支持；正文为内联样式 + data:image，无外链，可离线渲染。

export interface RenderedImages {
  cssH: number
  long: string // data:image/png;base64,…
  pages: string[] // 每屏一图（2x），data URL
}

const PAGE_CSS_H = 1000 // 每屏约一手机屏高的 CSS 高度（2x 后为 PAGE_CSS_H*2 px）
const WIDTH = 375
const SCALE = 2
const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"

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
    if (!h || h > 200000) throw new Error(h ? `正文高度异常（${h}px），无法转图` : '正文为空，无法转图')

    const inner = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${WIDTH}px;box-sizing:border-box;font-family:${FONT}">${html}</div>`
    const W2 = WIDTH * SCALE
    const H2 = h * SCALE
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

    // 分页：每 PAGE_CSS_H 一切（末页不足也保留）
    const pages: string[] = []
    for (let y = 0; y < h; y += PAGE_CSS_H) {
      const ph = Math.min(PAGE_CSS_H, h - y) * SCALE
      const pc = document.createElement('canvas')
      pc.width = W2
      pc.height = ph
      const pctx = pc.getContext('2d')
      if (!pctx) throw new Error('无法创建分页画布')
      pctx.drawImage(cv, 0, y * SCALE, W2, ph, 0, 0, W2, ph)
      pages.push(pc.toDataURL('image/png'))
    }
    return { cssH: h, long, pages }
  } finally {
    host.remove()
  }
}
