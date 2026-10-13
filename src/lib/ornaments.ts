// R39：内置装饰是确定性矢量图，不是文章图片素材，不进入资产队列。
// 每幅图都在独立的文流留白带显示；SVG 不含文字、滤镜、渐变或外部引用。
export type NativeOrnament = 'botanical' | 'ticket' | 'ribbon'
export type OrnamentRole = 'hero' | 'section' | 'divider' | 'footer' | 'paper' | 'edge' | 'fold'

export function isNativeOrnament(value: string): value is NativeOrnament {
  return value === 'botanical' || value === 'ticket' || value === 'ribbon'
}

export function ornamentDataUrl(kind: NativeOrnament, role: OrnamentRole, primary: string, secondary: string, leaf: string): string {
  // 色号来自可信主题；这里仍收口，不能借自定义 palette 注入 SVG 属性。
  const safe = (color: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
  const c = safe(primary, '#365b69'), c2 = safe(secondary, '#bc9460'), c3 = safe(leaf, c)
  const wide = role === 'hero' || role === 'divider' || role === 'paper' || role === 'edge' || (kind === 'ribbon' && role === 'footer')
  const width = role === 'fold' ? 40 : wide ? 300 : 150
  const height = role === 'fold' ? 12 : role === 'hero' ? (kind === 'botanical' ? 94 : kind === 'ticket' ? 32 : 48) : kind === 'ribbon' && role === 'paper' ? 24 : kind === 'ribbon' && role === 'footer' ? 22 : role === 'edge' ? 22 : role === 'divider' ? 30 : 34
  const path = (d: string, color = c, extra = '') => `<path d="${d}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
  const flower = (x: number, y: number, size = 1) => `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0 -3 C-13 -17 -21 -2 -6 4 C-20 11 -7 23 0 9 C8 24 21 11 7 4 C23 -3 12 -17 1 -3Z" fill="${c2}" fill-opacity=".25" stroke="${c2}" stroke-width="1.2"/><circle cy="4" r="3" fill="${c}"/></g>`
  const fullFlower = (x: number, y: number, size: number, petal: string, core: string) => `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0 -4C-15 -29 -34 -9 -13 3C-38 10 -21 34 -4 14C5 40 30 24 14 6C42 4 29 -25 9 -12C9 -34 -13 -32 0 -4Z" fill="${petal}"/><path d="M-11 0L-4 5M-3 -11L0 0M14 -8L5 1M17 11L7 7M1 19L2 10" stroke="${core}" stroke-opacity=".45" stroke-width="1"/><circle cx="2" cy="5" r="7" fill="${core}"/><circle cx="2" cy="5" r="2.2" fill="${petal}"/></g>`
  const twig = (flip = false) => `<g${flip ? ' transform="translate(300 0) scale(-1 1)"' : ''}>` +
    path('M26 54 C65 54 100 38 138 21', c3) +
    `<path d="M47 51 Q40 38 48 32 Q59 42 54 49 M66 45 Q58 28 67 24 Q79 33 75 41 M89 37 Q88 23 98 19 Q102 30 96 34 M109 29 Q112 12 122 13 Q125 24 116 26 M59 48 Q71 56 82 49 Q75 40 67 44 M87 38 Q98 46 111 37 Q104 29 96 34" fill="${c3}" fill-opacity=".24" stroke="${c3}" stroke-width="1"/>` + '</g>'
  let drawing = ''
  if (kind === 'botanical') {
    if (role === 'hero') drawing =
      `<path d="M14 58Q42 8 66 10Q65 47 35 62 M39 73Q48 38 84 40Q74 75 48 80 M98 50Q122 1 152 3Q148 37 115 55 M161 66Q163 23 199 18Q200 54 175 69 M217 59Q242 12 275 17Q263 57 239 67 M252 80Q272 47 298 53Q289 84 264 89" fill="${c3}"/>` +
      `<path d="M15 66Q8 40 23 32Q42 47 34 66 M63 42Q44 15 59 3Q87 20 80 42 M141 78Q118 55 127 39Q153 45 158 72 M194 46Q205 8 224 5Q233 28 214 51 M231 84Q231 59 252 53Q263 73 246 89" fill="${c}" fill-opacity=".74"/>` +
      path('M17 77Q84 56 146 64T288 72', c2) + fullFlower(84, 48, 1.25, c2, c3) + fullFlower(212, 50, 1.06, c, c2) + fullFlower(148, 70, .73, c2, c3) + flower(32, 74, .42) + flower(267, 31, .5)
    else if (role === 'edge') drawing = `<path d="M0 9C44 1 87 23 136 13S222 1 300 11V22H0Z" fill="${c}"/><path d="M0 5C44 -3 87 19 136 9S222 -3 300 7" stroke="${c2}" stroke-opacity=".65" stroke-width="1.2" fill="none"/>`
    else if (role === 'section') drawing = path('M2 17H50 M100 17H148', c3) + flower(75, 13, .8) + `<circle cx="43" cy="17" r="2" fill="${c2}"/><circle cx="107" cy="17" r="2" fill="${c2}"/>`
    else if (role === 'divider') drawing = path('M3 16 H126 M174 16 H297', c3) + flower(150, 12, .65)
    else if (role === 'paper') drawing = path('M.7 34V1H272L299.3 28V34', c, 'stroke-opacity=".45"') + `<path d="M272 1V28H299" fill="${c2}" fill-opacity=".2" stroke="${c}" stroke-opacity=".45"/>` + `<g transform="translate(11 -5) scale(.55)">${twig()}</g>`
    else drawing = path('M8 25Q68 27 136 7', c3) + `<path d="M39 23Q28 9 39 5Q50 14 47 22 M65 20Q57 6 68 3Q79 13 74 18 M93 14Q93 2 105 2Q106 11 102 12 M57 22Q70 34 83 25Q75 17 65 20 M89 15Q105 27 119 16Q108 10 101 13" fill="${c3}" fill-opacity=".22" stroke="${c3}" stroke-width="1"/>` + flower(18, 18, .48)
  } else if (kind === 'ticket') {
    const grid = (x: number, y: number, cols: number, rows: number) => [0, 1].map(group => {
      const d = Array.from({ length: cols * rows }, (_, i) => (i % 3 === 0 ? 0 : 1) === group ? `M${x + i % cols * 7} ${y + Math.floor(i / cols) * 7}h4v4h-4z` : '').join('')
      return `<path d="${d}" fill="${group ? c : c2}" fill-opacity="${group ? '.2' : '.7'}"/>`
    }).join('')
    const holes = (x: number, y: number, count: number) => `<path d="M${x} ${y}h${(count - 1) * 12}" stroke="${c}" stroke-width="4.4" stroke-linecap="round" stroke-dasharray=".1 11.9" stroke-opacity=".5"/>`
    if (role === 'hero') drawing = path('M.7 32V12H13V1H286V12H299.3V32', c, 'stroke-opacity=".55"') + `<path d="M27 0H119L110 23H18Z" fill="${c2}" fill-opacity=".78"/><path d="M34 5H105M28 15H100" stroke="${c}" stroke-opacity=".26"/>` + grid(246, 10, 6, 3)
    else if (role === 'paper') drawing = path('M.7 34V12Q12 12 12 1H288Q288 12 299.3 12V34', c, 'stroke-opacity=".55"') + `<path d="M24 7H101L96 18H19Z" fill="${c2}" fill-opacity=".38"/>` + holes(208, 18, 6)
    else if (role === 'divider') drawing = holes(7, 15, 25)
    else if (role === 'footer') drawing = `<path d="${[2, 3, 1, 4, 2, 1, 3, 1, 4, 2, 3, 1, 2, 1].map((w, i) => `M${8 + i * 5} 9h${w}v15h-${w}z`).join('')}" fill="${c}" fill-opacity=".55"/>` + grid(111, 8, 4, 3)
    else drawing = `<path d="M2 7 H105 L116 17 L105 27 H2 Z" fill="${c2}" fill-opacity=".35"/>` + holes(11, 17, 8) + grid(128, 8, 3, 3)
  } else {
    // 刊物的书页、书签与折页共用直线和细金线，不使用礼物结或独立徽章。
    const pageTab = (x: number, y: number, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 0H14V22L7 18L0 22Z" fill="${c2}" fill-opacity=".34" stroke="${c2}" stroke-width="1"/><path d="M4 3V13M10 3V13" stroke="${c}" stroke-width="1" stroke-opacity=".6"/></g>`
    if (role === 'hero') drawing = path('M8 26H99 M201 26H292', c) + path('M8 31H83 M217 31H292', c2) +
      `<path d="M150 12Q132 4 112 8V33Q133 29 150 38Q167 29 188 33V8Q168 4 150 12Z" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>` +
      path('M150 12V38 M117 37Q134 33 150 41Q166 33 183 37', c, 'stroke-opacity=".55"') +
      path('M120 14Q132 12 142 17 M120 20Q132 18 142 23 M120 26Q132 24 142 29 M178 17L181 17 M178 23L181 23 M157 29Q166 25 181 26', c2) + pageTab(161, 8, .8)
    else if (role === 'fold') drawing = `<path d="M.5 .5H39L29 9.5H.5Z" fill="${c2}" fill-opacity=".3" stroke="${c2}" stroke-width="1"/><path d="M6 .5V6H30" stroke="${c}" stroke-width="1" stroke-opacity=".65"/>`
    else if (role === 'paper') drawing = path('M.7 24V.7H275L299.3 23.3V24', c, 'stroke-opacity=".5"') +
      `<path d="M275 .7V23.3H299.3" fill="${c2}" fill-opacity=".18" stroke="${c2}" stroke-width="1"/>` + path('M12 7H95 M12 12H58', c2)
    else if (role === 'divider') drawing = path('M4 13H132 M168 13H296', c, 'stroke-opacity=".55"') + path('M4 18H114 M186 18H296', c2) + pageTab(145, 4, .72)
    else if (role === 'footer') drawing = path('M.7 0V21.3H280L299.3 3V0', c, 'stroke-opacity=".5"') +
      `<path d="M280 21.3V3H299.3" fill="${c2}" fill-opacity=".18" stroke="${c2}" stroke-width="1"/>` + path('M12 15H266', c2, 'stroke-opacity=".5"')
    else drawing = path('M3 16H59 M87 16H147', c2) + pageTab(68, 4, .9)
  }
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none">${drawing}</svg>`)
}
