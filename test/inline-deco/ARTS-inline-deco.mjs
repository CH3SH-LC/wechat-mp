// test/inline-deco/ARTS-inline-deco.mjs
// 行内装饰资产（inline-deco）· 第 12 轮：svg 资产与文字协调问题
// 设计规范（详见 test/knowledge/module-inline-deco.md §五 5.0）：
//   ① 画布 120×120（设计），显示高 14-24px（默认 16px），4x 渲染 480×480
//   ② 紧裁：主图案包围盒 ≥70% 画布（宽高都 ≥84px）
//   ③ 底部锚点：图案底部贴画布底边（底边留白 ≤5px）——行内 vertical-align:baseline 时图案"站在"文字基线上
//   ④ 纯色平面（零渐变/零 emoji/零字符），2-3 层扁平形状即可（小尺寸下渐变不可见且增体积）
//   ⑤ 语法：![说明](art://名称[:显示高px])，缺省 16px
// 本文件只定义资产与 probe；渲染与验证见 render-inline-demo.mjs / verify-inline-deco.mjs

export const INLINE_DECO_ARTS = [
  {
    name: 'inline-flower', label: '行内小花（橙·五瓣）', w: 120, h: 120,
    probes: [
      { x: 60, y: 30, c: [201, 111, 74], note: '上花瓣' },
      { x: 60, y: 60, c: [217, 163, 95], note: '花心' },
      { x: 45, y: 110, c: [111, 158, 120], note: '左叶' },
    ],
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<g fill="#c96f4a">' +
      '<circle cx="60" cy="30" r="17"/><circle cx="88" cy="51" r="17"/><circle cx="78" cy="81" r="17"/>' +
      '<circle cx="42" cy="81" r="17"/><circle cx="32" cy="51" r="17"/></g>' +
      '<circle cx="60" cy="60" r="8" fill="#d9a35f"/>' +
      '<g fill="#6f9e78"><ellipse cx="45" cy="110" rx="15" ry="7" transform="rotate(-30 45 110)"/>' +
      '<ellipse cx="75" cy="110" rx="15" ry="7" transform="rotate(30 75 110)"/></g></svg>',
  },
  {
    name: 'inline-sprig', label: '行内小草（绿·三叶）', w: 120, h: 120,
    probes: [
      { x: 60, y: 26, c: [217, 163, 95], note: '顶芽' },
      { x: 42, y: 92, c: [111, 158, 120], note: '左叶' },
      { x: 80, y: 94, c: [111, 158, 120], note: '右叶' },
    ],
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<g fill="none" stroke="#4a7c59" stroke-width="8" stroke-linecap="round">' +
      '<path d="M60 115 Q 50 64 14 38"/><path d="M60 115 Q 70 64 106 38"/><path d="M60 115 Q 60 75 60 32"/></g>' +
      '<g fill="#6f9e78"><ellipse cx="42" cy="92" rx="10" ry="6" transform="rotate(-30 42 92)"/>' +
      '<ellipse cx="80" cy="94" rx="10" ry="6" transform="rotate(30 80 94)"/></g>' +
      '<circle cx="60" cy="26" r="7" fill="#d9a35f"/></svg>',
  },
  {
    name: 'inline-leaf', label: '行内青叶（青·单叶）', w: 120, h: 120,
    probes: [
      { x: 40, y: 70, c: [95, 141, 138], note: '左叶肉' },
      { x: 80, y: 70, c: [95, 141, 138], note: '右叶肉' },
      { x: 60, y: 70, c: [63, 107, 104], note: '主脉' },
    ],
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<path d="M60 116 C 120 92 120 40 60 14 C 0 40 0 92 60 116 Z" fill="#5f8d8a"/>' +
      '<path d="M60 116 L 60 34" stroke="#3f6b68" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M60 84 Q 46 76 34 72" stroke="#3f6b68" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M60 84 Q 74 76 86 72" stroke="#3f6b68" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  },
  {
    name: 'inline-star', label: '行内金星（金·四角星）', w: 120, h: 120,
    probes: [
      { x: 60, y: 60, c: [212, 162, 76], note: '星心' },
      { x: 30, y: 60, c: [212, 162, 76], note: '左臂' },
      { x: 60, y: 30, c: [212, 162, 76], note: '上臂' },
    ],
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<path d="M60 14 L 74 46 L 106 60 L 74 74 L 60 116 L 46 74 L 14 60 L 46 46 Z" fill="#d4a24c"/>' +
      '<path d="M60 34 L 65 52 L 60 57 L 55 52 Z" fill="#f5ecd9" opacity="0.9"/></svg>',
  },
  {
    name: 'inline-ball', label: '行内足球（球场绿·白缝线）', w: 120, h: 120,
    probes: [
      { x: 60, y: 67, c: [245, 248, 242], note: '中心白块' },
      { x: 30, y: 67, c: [92, 143, 78], note: '球面绿' },
      { x: 60, y: 100, c: [92, 143, 78], note: '下球面绿' },
    ],
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="67" r="48" fill="#5c8f4e"/>' +
      '<polygon points="60,55 71,62 67,75 53,75 49,62" fill="#f5f8f2"/>' +
      '<g stroke="#f5f8f2" stroke-width="3" fill="none" stroke-linecap="round">' +
      '<path d="M60 55 L 60 25"/><path d="M71 62 L 102 50"/><path d="M67 75 L 92 98"/>' +
      '<path d="M53 75 L 28 98"/><path d="M49 62 L 18 50"/></g></svg>',
  },
  {
    name: 'inline-seal', label: '行内朱印（朱红·回纹方章）', w: 120, h: 120,
    probes: [
      { x: 60, y: 40, c: [154, 40, 31], note: '章面' },
      { x: 60, y: 68, c: [245, 230, 211], note: '中心纹' },
      { x: 30, y: 60, c: [154, 40, 31], note: '左章面' },
    ],
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<rect x="16" y="20" width="88" height="96" rx="10" fill="#9a281f"/>' +
      '<rect x="32" y="32" width="56" height="68" rx="4" fill="none" stroke="#f5e6d3" stroke-width="3"/>' +
      '<circle cx="60" cy="68" r="8" fill="#f5e6d3"/>' +
      '<circle cx="44" cy="51" r="4" fill="#f5e6d3"/><circle cx="76" cy="85" r="4" fill="#f5e6d3"/></svg>',
  },
]

// 渲染全部行内资产为 4x PNG（480×480），供 render-inline-demo.mjs 使用
export async function renderInlinePngs(playwright, chromiumPath, outDir) {
  const { chromium } = playwright
  const browser = await chromium.launch({ executablePath: chromiumPath })
  try {
    const page = await browser.newPage()
    await page.setContent('<html><body></body></html>')
    for (const a of INLINE_DECO_ARTS) {
      const b64 = await page.evaluate(async ({ svg, w, h }) => {
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        try {
          const img = new Image()
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
          const canvas = document.createElement('canvas')
          canvas.width = w * 4
          canvas.height = h * 4
          const cx = canvas.getContext('2d')
          cx.scale(4, 4)
          cx.drawImage(img, 0, 0, w, h)
          return canvas.toDataURL('image/png').split(',')[1]
        } finally { URL.revokeObjectURL(url) }
      }, { svg: a.svg, w: a.w, h: a.h })
      const { writeFileSync } = await import('node:fs')
      writeFileSync(outDir + a.name + '.png', Buffer.from(b64, 'base64'))
    }
  } finally {
    await browser.close()
  }
}

// 供独立验证脚本复用：画布 120 → 480（4x）
export const INLINE_SCALE = 4
