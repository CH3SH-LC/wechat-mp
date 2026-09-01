// ============================================================
// 步骤条（module-steps）美术资产 10 个 —— 类型 × 风格 模型（steps）
// 类型 = 4 种组合方式（骨架模板）；风格 = 内容填充（数字圆图案与色板）
// 整图资产 + 右侧嵌字模式：SVG 画布模拟步骤条容器，数字圆徽章/连线装饰长在左列
//   （数字圆列 x 0..110），右侧 x 130..730 留文字 zone（每步一行）
// 严格遵循 knowledge/module-steps.md §五 5.0 整图资产构建规范：
//   纵向 4 步条 750×220（zone 设计高 ≥150，每步一行 14px ≤15 字）；
//   单步横向卡 750×120（zone 装一行文字）；
//   大面积背景渐变一律垂直 + gradientUnits="userSpaceOnUse" 绝对坐标（PNG ≤1MB 铁律）
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变 + 珍珠/叶脉/多层花瓣
// zone 洁净设计：所有装饰（圆徽/连线/花枝/卡边/网格刻度）落在 x<105 或 zone 行之外，
//   保证 x105..730 相邻像素突变扫描 = 0；卡式资产 zone 内缩于卡片实底内
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

// —— 色板（圆底一律深一档保证白字 ≥4.5:1；连线/卡底取浅档）——
const TEAL = '#007f74'        // 青深（圆底）      白字对比 ≈4.8
const TEAL_L = '#7fc0b2'      // 青浅（叶/线）
const TEAL_BG = '#e4f1ea'     // 青极浅（前提帽底）
const ORANGE = '#c94a20'      // 橙深（圆底）      白字对比 ≈4.7
const ORANGE_L = '#f2b28a'    // 橙浅（连线/卡边）
const ORANGE_CARD = '#fff7f2' // 浅橙卡底
const GOLD = '#b8892f'        // 沙金
const GOLD_L = '#e8c878'
const GOLD_BG = '#f7ecd2'     // 沙金浅（前提帽底）
const CRIMSON = '#9a281f'     // 朱红（圆底）      白字对比 ≈7.9
const CRIMSON_L = '#d97f6f'
const BLUE = '#2a63d9'        // 冷蓝（圆底）      白字对比 ≈5.4
const BLUE_L = '#8fb2ff'
const BLUE_CARD = '#eef3fd'   // 浅蓝卡底
const BLUE_GRID = '#c9d9f9'
const CAMPUS = '#4a7340'      // 球场绿（圆底）    白字对比 ≈5.5
const CAMPUS_ORANGE = '#e07b39' // 校徽橙（点缀）
const GRAY = '#5a6066'        // 深灰（极简圆底）  白字对比 ≈6.4
const GRAY_L = '#b7bcc2'

// —— 纵向 4 步条通用行位：行心 y = 50/94/138/182（步距 44），圆徽列 x 中心 62 ——
const ROWS = [50, 94, 138, 182]
// 普通式 zone（每步一行 14px，行高 ~1.2，zone 高 40 设计）
const ZONES4 = ROWS.map((c) => ({ x0: 130, y0: c - 20, x1: 730, y1: c + 20 }))
// 卡式 zone（内缩于卡片实底 [c-21, c+21]，zone 高 36）
const ZONES4_CARD = ROWS.map((c) => ({ x0: 130, y0: c - 18, x1: 730, y1: c + 18 }))
// ④ 前提行+步骤组式：帽 y 2..44（zone 6..42），步骤行心 66/110/154/198
const ROWS4 = [66, 110, 154, 198]
const ZONES_PREP = [{ x0: 130, y0: 6, x1: 730, y1: 42 }].concat(
  ROWS4.map((c) => ({ x0: 130, y0: c - 20, x1: 730, y1: c + 20 })))
// 单步卡 zone
const ZONE_SINGLE = { x0: 130, y0: 32, x1: 730, y1: 88 }
// ⑩ 单步卡（前提帽+单步）：帽 y 2..42（zone 6..40），步骤 zone 50..118
const ZONE_GUOCHAO_SINGLE = [{ x0: 130, y0: 6, x1: 730, y1: 40 }, { x0: 130, y0: 50, x1: 730, y1: 118 }]

// userSpaceOnUse 线性渐变（大面积背景一律垂直）
const gU = (id, y1, y2, stops) =>
  `<linearGradient id="${id}" x1="0" y1="${y1}" x2="0" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

// 数字圆：实底圆 + 白字（probe 落实底，白字圆底对比 ≥4.5）
const numC = (cx, cy, r, fill, num, size) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>` +
  `<text x="${cx}" y="${cy + size * 0.36}" font-family="sans-serif" font-size="${size}" font-weight="700" fill="#ffffff" text-anchor="middle">${num}</text>`

// 球类缝线弧（校园风圆徽：圆底 + 白色缝线弧，避开 probe 点）
const seamArc = (cx, cy, r, a1d, a2d, w, c) => {
  const rad = (d) => (d * Math.PI) / 180
  const x1 = cx + r * Math.cos(rad(a1d)), y1 = cy + r * Math.sin(rad(a1d))
  const x2 = cx + r * Math.cos(rad(a2d)), y2 = cy + r * Math.sin(rad(a2d))
  const large = Math.abs(a2d - a1d) > 180 ? 1 : 0
  const sweep = a2d > a1d ? 1 : 0
  return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`
}

// 星芒（校园点缀）
const sparkle = (cx, cy, s, c) =>
  `<polygon points="${cx},${cy - s} ${cx + s * 0.36},${cy - s * 0.36} ${cx + s},${cy} ${cx + s * 0.36},${cy + s * 0.36} ${cx},${cy + s} ${cx - s * 0.36},${cy + s * 0.36} ${cx - s},${cy} ${cx - s * 0.36},${cy - s * 0.36}" fill="${c}"/>`

// 回纹小节（国潮连线装饰）
const huiwen = (cx, cy, s, c, c2) =>
  `<rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" fill="none" stroke="${c}" stroke-width="2"/>` +
  `<rect x="${cx - s * 0.4}" y="${cy - s * 0.4}" width="${s * 0.8}" height="${s * 0.8}" fill="${c2}"/>`

export const stepsArts = [
  // ========== 1 ① 单色数字圆式 · 自然花草——青圆 + 草叶环饰 ==========
  {
    name: 'steps-single', label: '步骤·单色数字圆·草叶青', type: '① 单色数字圆式', style: '自然花草',
    w: 750, h: 220, zone: ZONES4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s1bg', 0, 220, [[0, '#fffef8'], [0.35, '#f7fbf6'], [0.7, '#eef7f1'], [1, '#e4f1ea']])}${gradLinear('s1lf', 0, 0, 1, 1, [[0, '#a9d5c9'], [0.4, '#7fc0b2'], [0.7, '#4fa294'], [1, '#2e8778']])}${gradLinear('s1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e8f6f2'], [0.65, '#a9d5c9'], [1, '#4fa294']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s1bg)"/>
${numC(62, 50, 21, TEAL, 1, 22)}
${numC(62, 94, 21, TEAL, 2, 22)}
${numC(62, 138, 21, TEAL, 3, 22)}
${numC(62, 182, 21, TEAL, 4, 22)}
${leafX(82, 34, 100, 16, 8, 's1lf', 's1lf')}
${leafX(82, 32, 100, 48, 8, 's1lf', 's1lf')}
${leafX(84, 94, 101, 84, 6, 's1lf', 's1lf')}
${leafX(40, 138, 24, 130, 6, 's1lf', 's1lf')}
${pearlX(80, 200, 8, 's1pe')}
${curlS(54, 204, 16, 0.5, 2, TEAL_L)}
</svg>`,
    probe: [72, 38, [0, 127, 116]],
  },

  // ========== 2 ② 竖线贯穿式 · 自然花草——橙圆 + 花枝连线（轨道 + 间隙小花） ==========
  {
    name: 'steps-vertical', label: '步骤·竖线贯穿·花枝橙', type: '② 竖线贯穿式', style: '自然花草',
    w: 750, h: 220, zone: ZONES4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s2bg', 0, 220, [[0, '#fffdf7'], [0.35, '#fdf6ec'], [0.7, '#f8ecdc'], [1, '#f2e0ca']])}${gradRadial('s2fr', [[0, '#ffd9c0'], [0.4, '#f2b28a'], [0.7, '#cf7a3e'], [1, '#a83c16']])}${gradLinear('s2lf', 0, 0, 1, 1, [[0, '#a9d5c9'], [0.4, '#7fc0b2'], [0.7, '#4fa294'], [1, '#2e8778']])}${gradLinear('s2pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#fdeee3'], [0.65, '#f2b28a'], [1, '#cf7a3e']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s2bg)"/>
<rect x="60.5" y="32" width="3" height="178" rx="1.5" fill="${ORANGE_L}"/>
${numC(62, 52, 19.5, ORANGE, 1, 20)}
${numC(62, 98, 19.5, ORANGE, 2, 20)}
${numC(62, 144, 19.5, ORANGE, 3, 20)}
${numC(62, 190, 19.5, ORANGE, 4, 20)}
${flower5X(74, 75, 5.5, 's2fr', 's2fr', '#a83c16')}
${flower5X(74, 121, 5.5, 's2fr', 's2fr', '#a83c16')}
${flower5X(74, 167, 5.5, 's2fr', 's2fr', '#a83c16')}
${leafX(80, 74, 98, 66, 6, 's2lf', 's2lf')}
${leafX(80, 76, 98, 84, 6, 's2lf', 's2lf')}
${leafX(80, 120, 98, 112, 6, 's2lf', 's2lf')}
${leafX(80, 166, 98, 158, 6, 's2lf', 's2lf')}
${pearlX(62, 27, 6, 's2pe')}
</svg>`,
    probe: [72, 40, [201, 74, 32]],
  },

  // ========== 3 ③ 纯色圆+文字卡式 · 自然花草——橙圆 + 浅橙卡（花卡角 + 金点） ==========
  {
    name: 'steps-card', label: '步骤·纯色圆文字卡·橙卡', type: '③ 纯色圆+文字卡式', style: '自然花草',
    w: 750, h: 220, zone: ZONES4_CARD,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s3bg', 0, 220, [[0, '#fffdf7'], [0.35, '#fdf5ea'], [0.7, '#f8ebd8'], [1, '#f2e0c6']])}${gradRadial('s3fr', [[0, '#ffd9c0'], [0.4, '#f2b28a'], [0.7, '#cf7a3e'], [1, '#a83c16']])}${gradLinear('s3pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#fdeee3'], [0.65, '#f2b28a'], [1, '#cf7a3e']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s3bg)"/>
<rect x="60" y="29" width="680" height="42" rx="10" fill="${ORANGE_CARD}" stroke="#e8c9b4" stroke-width="1.5"/>
<rect x="60" y="73" width="680" height="42" rx="10" fill="${ORANGE_CARD}" stroke="#e8c9b4" stroke-width="1.5"/>
<rect x="60" y="117" width="680" height="42" rx="10" fill="${ORANGE_CARD}" stroke="#e8c9b4" stroke-width="1.5"/>
<rect x="60" y="161" width="680" height="42" rx="10" fill="${ORANGE_CARD}" stroke="#e8c9b4" stroke-width="1.5"/>
${numC(62, 50, 23, ORANGE, 1, 24)}
${numC(62, 94, 23, ORANGE, 2, 24)}
${numC(62, 138, 23, ORANGE, 3, 24)}
${numC(62, 182, 23, ORANGE, 4, 24)}
${flower5X(84, 30, 8, 's3fr', 's3fr', '#a83c16')}
${leafX(86, 96, 102, 86, 5, 's3fr', 's3fr')}
${pearlX(80, 200, 8, 's3pe')}
<circle cx="734" cy="34" r="3" fill="${GOLD}"/>
<circle cx="734" cy="198" r="3" fill="${GOLD}"/>
</svg>`,
    probe: [72, 38, [201, 74, 32]],
  },

  // ========== 4 ④ 前提行+步骤组式 · 自然花草——前提帽（青条浅底）+ 青圆 ==========
  {
    name: 'steps-prep', label: '步骤·前提行+步骤组·青', type: '④ 前提行+步骤组式', style: '自然花草',
    w: 750, h: 220, zone: ZONES_PREP,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s4bg', 0, 220, [[0, '#fffdf7'], [0.35, '#f4faf7'], [0.7, '#e9f4ee'], [1, '#ddecea']])}${gradLinear('s4lf', 0, 0, 1, 1, [[0, '#a9d5c9'], [0.4, '#7fc0b2'], [0.7, '#4fa294'], [1, '#2e8778']])}${gradLinear('s4pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e8f6f2'], [0.65, '#a9d5c9'], [1, '#4fa294']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s4bg)"/>
<rect x="60" y="2" width="680" height="42" rx="8" fill="${TEAL_BG}"/>
<rect x="60" y="2" width="8" height="42" fill="${TEAL}"/>
${leafX(76, 10, 92, 20, 6, 's4lf', 's4lf')}
${leafX(76, 36, 92, 26, 6, 's4lf', 's4lf')}
${numC(62, 66, 21, TEAL, 1, 22)}
${numC(62, 110, 21, TEAL, 2, 22)}
${numC(62, 154, 21, TEAL, 3, 22)}
${numC(62, 198, 21, TEAL, 4, 22)}
${leafX(84, 68, 100, 56, 6, 's4lf', 's4lf')}
${pearlX(62, 215, 4.5, 's4pe')}
</svg>`,
    probe: [72, 54, [0, 127, 116]],
  },

  // ========== 5 ① 单色数字圆式 · 阳光校园风——球类徽章数字圆（足球/篮球/网球/排球缝线） ==========
  {
    name: 'steps-campus', label: '步骤·单色数字圆·球类徽章', type: '① 单色数字圆式', style: '阳光校园风',
    w: 750, h: 220, zone: ZONES4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s5bg', 0, 220, [[0, '#fcfff6'], [0.35, '#f4fbe9'], [0.7, '#eaf4da'], [1, '#deecc8']])}${gradLinear('s5pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5e8'], [0.65, '#b5d4a4'], [1, '#4a7340']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s5bg)"/>
${sparkle(62, 24, 8, CAMPUS_ORANGE)}
${numC(62, 50, 21, CAMPUS, 1, 22)}
${seamArc(62, 50, 17, 25, 95, 2.2, '#d9e8d2')}
${seamArc(62, 50, 17, 95, 165, 2.2, '#d9e8d2')}
${numC(62, 94, 21, CAMPUS, 2, 22)}
${seamArc(62, 94, 17, 150, 30, 2.2, '#d9e8d2')}
${seamArc(62, 94, 17, 60, 120, 2.2, '#d9e8d2')}
${numC(62, 138, 21, CAMPUS, 3, 22)}
${seamArc(62, 138, 17, 0, 70, 2.2, '#d9e8d2')}
${seamArc(62, 138, 17, 180, 250, 2.2, '#d9e8d2')}
${numC(62, 182, 21, CAMPUS, 4, 22)}
${seamArc(62, 182, 17, 40, 105, 2.2, '#d9e8d2')}
${seamArc(62, 182, 17, 160, 225, 2.2, '#d9e8d2')}
${seamArc(62, 182, 17, 280, 345, 2.2, '#d9e8d2')}
<polygon points="84,160 102,166 84,172" fill="${CAMPUS_ORANGE}"/>
<line x1="84" y1="160" x2="84" y2="176" stroke="${CAMPUS_ORANGE}" stroke-width="2"/>
${pearlX(80, 198, 7, 's5pe')}
</svg>`,
    probe: [72, 38, [74, 115, 64]],
  },

  // ========== 6 ② 竖线贯穿式 · 国潮风——朱红圆 + 回纹连线（金轨道 + 回纹小节） ==========
  {
    name: 'steps-guochao', label: '步骤·竖线贯穿·回纹朱红', type: '② 竖线贯穿式', style: '国潮风',
    w: 750, h: 220, zone: ZONES4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s6bg', 0, 220, [[0, '#fdf9ec'], [0.35, '#f9f1d8'], [0.7, '#f2e4bd'], [1, '#ead9a6']])}${gradLinear('s6gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.35, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}${gradLinear('s6pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f4e5c2'], [0.65, '#e0bd77'], [1, '#b8892f']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s6bg)"/>
<rect x="60.5" y="30" width="3" height="180" rx="1.5" fill="${GOLD_L}"/>
${numC(62, 52, 19.5, CRIMSON, 1, 20)}
${numC(62, 98, 19.5, CRIMSON, 2, 20)}
${numC(62, 144, 19.5, CRIMSON, 3, 20)}
${numC(62, 190, 19.5, CRIMSON, 4, 20)}
${huiwen(62, 75, 3.5, GOLD, GOLD)}
${huiwen(62, 121, 3.5, GOLD, GOLD)}
${huiwen(62, 167, 3.5, GOLD, GOLD)}
${curlS(56, 24, 14, 2.6, 2, GOLD)}
${pearlX(84, 50, 5.5, 's6pe')}
${huiwen(62, 214, 3, CRIMSON, CRIMSON)}
</svg>`,
    probe: [72, 40, [154, 40, 31]],
  },

  // ========== 7 ③ 纯色圆+文字卡式 · 科技风——冷蓝圆 + 网格卡（左列网格 + 卡缘刻度） ==========
  {
    name: 'steps-tech', label: '步骤·纯色圆文字卡·网格蓝', type: '③ 纯色圆+文字卡式', style: '科技风',
    w: 750, h: 220, zone: ZONES4_CARD,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s7bg', 0, 220, [[0, '#f7faff'], [0.35, '#eef4fe'], [0.7, '#e3ecfc'], [1, '#d8e4fa']])}${gradLinear('s7dg', 0, 0, 1, 1, [[0, '#8fb2ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#2a63d9']])}${gradLinear('s7pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e8effd'], [0.65, '#a9c2f7'], [1, '#5f8df0']])}</defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s7bg)"/>
<rect x="60" y="29" width="680" height="42" rx="10" fill="${BLUE_CARD}" stroke="#bcd0f7" stroke-width="1.5"/>
<rect x="60" y="73" width="680" height="42" rx="10" fill="${BLUE_CARD}" stroke="#bcd0f7" stroke-width="1.5"/>
<rect x="60" y="117" width="680" height="42" rx="10" fill="${BLUE_CARD}" stroke="#bcd0f7" stroke-width="1.5"/>
<rect x="60" y="161" width="680" height="42" rx="10" fill="${BLUE_CARD}" stroke="#bcd0f7" stroke-width="1.5"/>
<g stroke="${BLUE_GRID}" stroke-width="1.5" opacity="0.9"><line x1="66" y1="29" x2="66" y2="71"/><line x1="73" y1="29" x2="73" y2="71"/><line x1="80" y1="29" x2="80" y2="71"/><line x1="87" y1="29" x2="87" y2="71"/><line x1="94" y1="29" x2="94" y2="71"/></g>
<g stroke="${BLUE_GRID}" stroke-width="1.5" opacity="0.9"><line x1="66" y1="73" x2="66" y2="115"/><line x1="73" y1="73" x2="73" y2="115"/><line x1="80" y1="73" x2="80" y2="115"/><line x1="87" y1="73" x2="87" y2="115"/><line x1="94" y1="73" x2="94" y2="115"/></g>
<g stroke="${BLUE_GRID}" stroke-width="1.5" opacity="0.9"><line x1="66" y1="117" x2="66" y2="159"/><line x1="73" y1="117" x2="73" y2="159"/><line x1="80" y1="117" x2="80" y2="159"/><line x1="87" y1="117" x2="87" y2="159"/><line x1="94" y1="117" x2="94" y2="159"/></g>
<g stroke="${BLUE_GRID}" stroke-width="1.5" opacity="0.9"><line x1="66" y1="161" x2="66" y2="203"/><line x1="73" y1="161" x2="73" y2="203"/><line x1="80" y1="161" x2="80" y2="203"/><line x1="87" y1="161" x2="87" y2="203"/><line x1="94" y1="161" x2="94" y2="203"/></g>
<g stroke="${BLUE_GRID}" stroke-width="2"><line x1="118" y1="30" x2="160" y2="30"/><line x1="676" y1="30" x2="722" y2="30"/><line x1="118" y1="70" x2="160" y2="70"/><line x1="676" y1="70" x2="722" y2="70"/></g>
<g stroke="${BLUE_GRID}" stroke-width="2"><line x1="118" y1="74" x2="160" y2="74"/><line x1="676" y1="74" x2="722" y2="74"/><line x1="118" y1="114" x2="160" y2="114"/><line x1="676" y1="114" x2="722" y2="114"/></g>
<g stroke="${BLUE_GRID}" stroke-width="2"><line x1="118" y1="118" x2="160" y2="118"/><line x1="676" y1="118" x2="722" y2="118"/><line x1="118" y1="158" x2="160" y2="158"/><line x1="676" y1="158" x2="722" y2="158"/></g>
<g stroke="${BLUE_GRID}" stroke-width="2"><line x1="118" y1="162" x2="160" y2="162"/><line x1="676" y1="162" x2="722" y2="162"/><line x1="118" y1="202" x2="160" y2="202"/><line x1="676" y1="202" x2="722" y2="202"/></g>
${numC(62, 50, 23, BLUE, 1, 24)}
${numC(62, 94, 23, BLUE, 2, 24)}
${numC(62, 138, 23, BLUE, 3, 24)}
${numC(62, 182, 23, BLUE, 4, 24)}
<polygon points="84,26 92,34 84,42 76,34" fill="${BLUE_L}"/>
<circle cx="84" cy="34" r="2" fill="#ffffff"/>
${pearlX(80, 200, 8, 's7pe')}
</svg>`,
    probe: [72, 38, [42, 99, 217]],
  },

  // ========== 8 ① 单色数字圆式 · 极简风——灰圆无连线（柔影 + 点饰） ==========
  {
    name: 'steps-minimal', label: '步骤·单色数字圆·极简灰', type: '① 单色数字圆式', style: '极简',
    w: 750, h: 220, zone: ZONES4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220">
<defs>${gU('s8bg', 0, 220, [[0, '#fbfbfc'], [0.35, '#f3f3f5'], [0.7, '#e9eaed'], [1, '#e0e1e5']])}<radialGradient id="s8sh" cx="0.5" cy="0.42" r="0.8"><stop offset="0" stop-color="#5a6066" stop-opacity="0.3"/><stop offset="0.55" stop-color="#5a6066" stop-opacity="0.14"/><stop offset="1" stop-color="#5a6066" stop-opacity="0"/></radialGradient></defs>
<rect x="0" y="0" width="750" height="220" fill="url(#s8bg)"/>
<ellipse cx="62" cy="77" rx="22" ry="4.5" fill="url(#s8sh)"/>
<ellipse cx="62" cy="121" rx="22" ry="4.5" fill="url(#s8sh)"/>
<ellipse cx="62" cy="165" rx="22" ry="4.5" fill="url(#s8sh)"/>
<ellipse cx="62" cy="209" rx="22" ry="4.5" fill="url(#s8sh)"/>
${numC(62, 50, 21, GRAY, 1, 22)}
${numC(62, 94, 21, GRAY, 2, 22)}
${numC(62, 138, 21, GRAY, 3, 22)}
${numC(62, 182, 21, GRAY, 4, 22)}
<circle cx="62" cy="27" r="2.5" fill="${GRAY_L}"/>
<circle cx="62" cy="205" r="2.5" fill="${GRAY_L}"/>
</svg>`,
    probe: [72, 38, [90, 96, 102]],
  },

  // ========== 9 ③ 纯色圆+文字卡式（单步卡）· 宣传——橙圆 + 白卡 ==========
  {
    name: 'steps-promo', label: '步骤·单步卡·宣传橙', type: '③ 纯色圆+文字卡式（单步卡）', style: '宣传',
    w: 750, h: 120, zone: ZONE_SINGLE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 120">
<defs>${gU('s9bg', 0, 120, [[0, '#fff7ef'], [0.35, '#ffedd9'], [0.7, '#fbe0c4'], [1, '#f5d2ae']])}${gradRadial('s9fr', [[0, '#ffd9c0'], [0.4, '#f2b28a'], [0.7, '#cf7a3e'], [1, '#a83c16']])}${gradLinear('s9pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#fdeee3'], [0.65, '#f2b28a'], [1, '#cf7a3e']])}</defs>
<rect x="0" y="0" width="750" height="120" fill="url(#s9bg)"/>
<rect x="60" y="22" width="680" height="76" rx="12" fill="#fffdf8" stroke="#e8b891" stroke-width="1.5"/>
${numC(68, 60, 35, ORANGE, 1, 32)}
${flower5X(88, 22, 8, 's9fr', 's9fr', '#a83c16')}
${leafX(94, 30, 102, 40, 5, 's9fr', 's9fr')}
${curlS(726, 94, 20, 2.9, 2, ORANGE_L)}
${pearlX(726, 100, 6.5, 's9pe')}
</svg>`,
    probe: [82, 44, [201, 74, 32]],
  },

  // ========== 10 ④ 前提行+步骤组式（单步卡）· 国潮——沙金前提帽 + 朱红圆 ==========
  {
    name: 'steps-single-guochao', label: '步骤·前提行单步卡·沙金朱红', type: '④ 前提行+步骤组式（单步卡）', style: '国潮',
    w: 750, h: 120, zone: ZONE_GUOCHAO_SINGLE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 120">
<defs>${gU('s10bg', 0, 120, [[0, '#fdf8ea'], [0.35, '#f9f0d6'], [0.7, '#f1e3bf'], [1, '#ead9a6']])}${gradLinear('s10gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.35, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}${gradLinear('s10pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f4e5c2'], [0.65, '#e0bd77'], [1, '#b8892f']])}</defs>
<rect x="0" y="0" width="750" height="120" fill="url(#s10bg)"/>
<rect x="60" y="2" width="680" height="40" rx="8" fill="${GOLD_BG}"/>
<rect x="60" y="2" width="8" height="40" fill="${GOLD}"/>
${huiwen(78, 16, 3.5, GOLD, GOLD)}
${huiwen(78, 30, 3.5, GOLD, GOLD)}
${numC(64, 84, 31, CRIMSON, 1, 28)}
${curlS(44, 106, 14, 2.6, 2, GOLD)}
${pearlX(92, 100, 5.5, 's10pe')}
</svg>`,
    probe: [77, 63, [154, 40, 31]],
  },
]

// 校验：count=10 / dupName / name 以 steps- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone 存在且满足 §5.0 容量
// （纵向 4 步条：每 zone 设计宽 ≥600、高 ≥36；单步卡：zone 设计高 ≥55；带前提帽单步卡：步骤 zone ≥55、帽 zone ≥28）
export function validateStepsArts() {
  const names = stepsArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = stepsArts.filter((a) => {
    if (!/^steps-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 750 && (a.h === 220 || a.h === 120)) || !/^<svg/.test(a.svg)) return true
    const open = (a.svg.match(/<svg/g) || []).length
    const close = (a.svg.match(/<\/svg>/g) || []).length
    if (open !== 1 || close !== 1) return true
    const gOpen = (a.svg.match(/<defs>/g) || []).length
    const gClose = (a.svg.match(/<\/defs>/g) || []).length
    if (gOpen !== gClose) return true
    const defIds = new Set([...a.svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    const refs = [...a.svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1])
    for (const r of refs) if (!defIds.has(r)) return true
    if (!Array.isArray(a.probe) || a.probe.length !== 3 || !Array.isArray(a.probe[2]) || a.probe[2].length !== 3) return true
    const zs = Array.isArray(a.zone) ? a.zone : [a.zone]
    if (!zs.length) return true
    for (const z of zs) {
      if (!(z.x0 < z.x1 && z.y0 < z.y1)) return true
      const w = z.x1 - z.x0, h = z.y1 - z.y0
      if (w < 600) return true
    }
    if (a.h === 220) {
      // 纵向 4 步条：每 zone 高 ≥36（一行 14px 文字 + 留白）
      for (const z of zs) if (z.y1 - z.y0 < 36) return true
    } else {
      // 单步卡：1 zone 高 ≥55；2 zone（前提帽 + 步骤）步骤 zone ≥55、帽 zone ≥28
      if (zs.length === 1) {
        if (zs[0].y1 - zs[0].y0 < 55) return true
      } else if (zs.length === 2) {
        if (zs[1].y1 - zs[1].y0 < 55 || zs[0].y1 - zs[0].y0 < 28) return true
      } else return true
    }
    return false
  })
  return { count: stepsArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
