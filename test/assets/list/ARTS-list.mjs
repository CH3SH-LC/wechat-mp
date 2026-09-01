// ============================================================
// 列表（module-list）美术资产 10 个 —— 类型 × 风格 模型（list）
// 类型 = 6 种组合方式（骨架模板）；风格 = 内容填充（标记图案与色板）
// 整图资产：整组列表 750×200（5 行均匀 · zone 设计高 ≥140px）/
//           衬底强调式单条 750×100（单条 · zone ≥60px）
// 严格遵循 knowledge/module-list.md §五 5.0 整图资产构建规范：
//   标记装饰贴左、随行居中；文字区整体右移留出标记位（zone x100..730 / x80..730）；
//   大面积背景渐变一律垂直 + gradientUnits="userSpaceOnUse" 绝对坐标（PNG ≤1MB 铁律）
//   zone 洁净设计：任何形状的竖向/横向边界不得落在 zone 文字区（扫描区域 = zone 自身 x 范围），
//     装饰只放标记位左侧（x<100 / x<80）与行尾右侧（x>730），保证相邻像素突变扫描 = 0
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变 + 珍珠/叶脉/多层花瓣
// 全部 probe 像素验证（选纯色部件：实心圆点/菱形/编号竖线/衬底/网格块/印章心/足球五边形）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

const ORANGE = [255, 107, 53]       // #ff6b35
const BLUE = [39, 119, 255]         // #2777ff 品牌蓝
const LINED_BG = [255, 247, 242]    // #fff7f2 衬底浅橙
const GRAY_BAR = [224, 224, 224]    // #e0e0e0 编号竖线
const TECH_GRID = [219, 230, 253]   // #dbe6fd 科技网格块
const BALL_BLACK = [61, 61, 61]     // #3d3d3d 迷你足球五边形
const SEAL_CREAM = [245, 236, 217]  // #f5ecd9 印章内心
const WHITE = [255, 255, 255]

// 整组 750×200：5 行均匀（行高 36 design · 总高 180 ≥140），zone x100..730
const GROUP_ROWS = [0, 1, 2, 3, 4].map((i) => ({ x0: 100, y0: 10 + i * 36, x1: 730, y1: 46 + i * 36 }))
// 衬底强调式整组：5 条浅橙衬底（行高 36 · 条间距 4 · 总高 180 ≥140），zone = 各条衬底内部
const LINED_ROWS = [0, 1, 2, 3, 4].map((i) => ({ x0: 100, y0: 4 + i * 40, x1: 730, y1: 40 + i * 40 }))
// 单条 750×100：单行文字 + 上下 padding（zone 高 92 ≥60），zone x80..730
const STRIP_ZONE = { x0: 80, y0: 4, x1: 730, y1: 96 }

// userSpaceOnUse 线性渐变（大面积背景一律垂直，符合 PNG 体积铁律）
const gU = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

// 实心标记圆点（纯色可 probe + 珍珠式双高光），cx,cy 中心；r=9 → 显示 ≈8.2px（≥8 铁律）
const orangeDot = (cx, cy) =>
  `<circle cx="${cx}" cy="${cy}" r="9" fill="#ff6b35"/>` +
  `<circle cx="${cx - 2.5}" cy="${cy - 2.7}" r="2.9" fill="#ffffff" opacity="0.75"/>` +
  `<circle cx="${cx + 1.8}" cy="${cy + 2.25}" r="1.3" fill="#ffffff" opacity="0.4"/>`

const blueDot = (cx, cy) =>
  `<circle cx="${cx}" cy="${cy}" r="9" fill="#2777ff"/>` +
  `<circle cx="${cx - 2.5}" cy="${cy - 2.7}" r="2.9" fill="#ffffff" opacity="0.75"/>` +
  `<circle cx="${cx + 1.8}" cy="${cy + 2.25}" r="1.3" fill="#ffffff" opacity="0.4"/>`

const grayDot = (cx, cy) =>
  `<circle cx="${cx}" cy="${cy}" r="9" fill="url(#l5dg)"/>` +
  `<circle cx="${cx - 2.5}" cy="${cy - 2.7}" r="2.9" fill="#ffffff" opacity="0.7"/>` +
  `<circle cx="${cx + 1.8}" cy="${cy + 2.25}" r="1.3" fill="#ffffff" opacity="0.35"/>`

// 菱形引导标记（实心可 probe + 内白菱形描边），cx,cy 中心；边长对角 18 → 显示 ≈8.2px
const orangeDiamond = (cy) =>
  `<polygon points="45,${cy - 9} 54,${cy} 45,${cy + 9} 36,${cy}" fill="#ff6b35"/>` +
  `<polygon points="45,${cy - 4.5} 49.5,${cy} 45,${cy + 4.5} 40.5,${cy}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.85"/>`

export const listArts = [
  // ========== 1 ① 圆点式 · 自然花草（默认）——橙圆点 + 叶尾 ==========
  {
    name: 'list-dots', label: '列表·圆点式·自然花草（橙点+叶尾）', type: '① 圆点式', style: '自然花草',
    w: 750, h: 200, zone: GROUP_ROWS,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200">
<defs>${gU('l1bg', 0, 0, 0, 200, [[0, '#fffdf8'], [0.3, '#fbf3e3'], [0.65, '#f7ecd4'], [1, '#f1e2c4']])}${gradLinear('l1lf', 0, 0, 1, 1, [[0, '#b0cba8'], [0.35, '#93bb88'], [0.7, '#77a86a'], [1, '#5c8a4e']])}${gradRadial('l1rf', [[0, '#ffd2ae'], [0.35, '#ff945c'], [0.7, '#ff6b35'], [1, '#d9521e']])}${gradLinear('l1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#ffdfc6'], [0.7, '#ffa070'], [1, '#e85a22']])}</defs>
<rect x="0" y="0" width="750" height="200" fill="url(#l1bg)"/>
${orangeDot(45, 28)}${leafX(54, 22, 75, 35, 6.5, 'l1lf', 'l1lf')}
${orangeDot(45, 64)}${leafX(54, 58, 75, 71, 6.5, 'l1lf', 'l1lf')}
${orangeDot(45, 100)}${leafX(54, 94, 75, 107, 6.5, 'l1lf', 'l1lf')}
${orangeDot(45, 136)}${leafX(54, 130, 75, 143, 6.5, 'l1lf', 'l1lf')}
${orangeDot(45, 172)}${leafX(54, 166, 75, 179, 6.5, 'l1lf', 'l1lf')}
${pearlX(742, 28, 4.5, 'l1pe')}${pearlX(742, 64, 4.5, 'l1pe')}${pearlX(742, 100, 4.5, 'l1pe')}${pearlX(742, 136, 4.5, 'l1pe')}${pearlX(742, 172, 4.5, 'l1pe')}
${flower5X(24, 186, 10, 'l1rf', 'l1rf', '#d9521e')}
${curlS(737, 12, 14, 0.8, 2, '#e0a75c')}
</svg>`,
    probe: [45, 28, ORANGE],
  },

  // ========== 2 ② 菱形引导式 · 自然花草——橙色菱形 + 花枝 ==========
  {
    name: 'list-arrow', label: '列表·菱形引导式·自然花草（菱形+花枝）', type: '② 菱形引导式', style: '自然花草',
    w: 750, h: 200, zone: GROUP_ROWS,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200">
<defs>${gU('l2bg', 0, 0, 0, 200, [[0, '#fffdf6'], [0.3, '#fbf2df'], [0.65, '#f6e9cd'], [1, '#f0dfba']])}${gradLinear('l2lf', 0, 0, 1, 1, [[0, '#b0cba8'], [0.35, '#93bb88'], [0.7, '#77a86a'], [1, '#5c8a4e']])}${gradRadial('l2rf', [[0, '#ffd2ae'], [0.35, '#ff945c'], [0.7, '#ff6b35'], [1, '#d9521e']])}${gradLinear('l2pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#ffdfc6'], [0.7, '#ffa070'], [1, '#e85a22']])}</defs>
<rect x="0" y="0" width="750" height="200" fill="url(#l2bg)"/>
${[28, 64, 100, 136, 172].map((cy) => orangeDiamond(cy)).join('')}
${curlS(53, 28, 14, 0.1, 2, '#77a86a')}${leafX(56, 20, 68, 24, 4.5, 'l2lf', 'l2lf')}${flower5X(66, 29, 6.5, 'l2rf', 'l2rf', '#d9521e')}
${leafX(736, 24, 746, 32, 4.5, 'l2lf', 'l2lf')}${leafX(736, 60, 746, 68, 4.5, 'l2lf', 'l2lf')}${leafX(736, 96, 746, 104, 4.5, 'l2lf', 'l2lf')}${leafX(736, 132, 746, 140, 4.5, 'l2lf', 'l2lf')}${leafX(736, 168, 746, 176, 4.5, 'l2lf', 'l2lf')}
${flower5X(24, 186, 10, 'l2rf', 'l2rf', '#d9521e')}
${pearlX(736, 8, 6, 'l2pe')}
</svg>`,
    probe: [45, 28, ORANGE],
  },

  // ========== 3 ③ 编号式 · 极简——灰数字 + 细竖线 + 行尾细线 ==========
  {
    name: 'list-number', label: '列表·编号式·极简（灰数字+细线）', type: '③ 编号式', style: '极简',
    w: 750, h: 200, zone: GROUP_ROWS,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200">
<defs>${gU('l3bg', 0, 0, 0, 200, [[0, '#ffffff'], [0.3, '#fcfcfa'], [0.7, '#f7f7f4'], [1, '#f2f2ee']])}${gU('l3gl', 0, 10, 0, 190, [[0, '#f2f2ef'], [0.5, '#e6e6e2'], [1, '#dcdcd8']])}</defs>
<rect x="0" y="0" width="750" height="200" fill="url(#l3bg)"/>
<path d="M14 36 V8 H70 M736 36 V8 H670 M14 164 V192 H70 M736 164 V192 H670" fill="none" stroke="#e9e9e5" stroke-width="1.5"/>
<rect x="65.25" y="20" width="1.5" height="160" fill="#e0e0e0"/>
<text x="42" y="34" font-family="sans-serif" font-size="16" font-weight="700" fill="#a8a8a8" text-anchor="middle">1</text>
<text x="42" y="70" font-family="sans-serif" font-size="16" font-weight="700" fill="#a8a8a8" text-anchor="middle">2</text>
<text x="42" y="106" font-family="sans-serif" font-size="16" font-weight="700" fill="#a8a8a8" text-anchor="middle">3</text>
<text x="42" y="142" font-family="sans-serif" font-size="16" font-weight="700" fill="#a8a8a8" text-anchor="middle">4</text>
<text x="42" y="178" font-family="sans-serif" font-size="16" font-weight="700" fill="#a8a8a8" text-anchor="middle">5</text>
${[28, 64, 100, 136, 172].map((cy) => `<line x1="738" y1="${cy}" x2="748" y2="${cy}" stroke="url(#l3gl)" stroke-width="1.5"/>`).join('')}
</svg>`,
    probe: [66, 100, GRAY_BAR],
  },

  // ========== 4 ④ 衬底强调式 · 自然花草——浅橙衬底条 + 橙点 ==========
  {
    name: 'list-lined', label: '列表·衬底强调式·自然花草（浅橙底+橙点）', type: '④ 衬底强调式', style: '自然花草',
    w: 750, h: 200, zone: LINED_ROWS,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200">
<defs>${gU('l4bg', 0, 0, 0, 200, [[0, '#fdf7ec'], [0.3, '#faf0e0'], [0.65, '#f6e8d0'], [1, '#f1dfc0']])}${gradLinear('l4lf', 0, 0, 1, 1, [[0, '#b0cba8'], [0.35, '#93bb88'], [0.7, '#77a86a'], [1, '#5c8a4e']])}${gradRadial('l4rf', [[0, '#ffd2ae'], [0.35, '#ff945c'], [0.7, '#ff6b35'], [1, '#d9521e']])}${gradLinear('l4pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#ffdfc6'], [0.7, '#ffa070'], [1, '#e85a22']])}</defs>
<rect x="0" y="0" width="750" height="200" fill="url(#l4bg)"/>
<rect x="60" y="4" width="680" height="36" rx="8" fill="#fff7f2"/>
<rect x="60" y="44" width="680" height="36" rx="8" fill="#fff7f2"/>
<rect x="60" y="84" width="680" height="36" rx="8" fill="#fff7f2"/>
<rect x="60" y="124" width="680" height="36" rx="8" fill="#fff7f2"/>
<rect x="60" y="164" width="680" height="36" rx="8" fill="#fff7f2"/>
${orangeDot(45, 22)}${leafX(54, 16, 75, 29, 6.5, 'l4lf', 'l4lf')}
${orangeDot(45, 62)}${leafX(54, 56, 75, 69, 6.5, 'l4lf', 'l4lf')}
${orangeDot(45, 102)}${leafX(54, 96, 75, 109, 6.5, 'l4lf', 'l4lf')}
${orangeDot(45, 142)}${leafX(54, 136, 75, 149, 6.5, 'l4lf', 'l4lf')}
${orangeDot(45, 182)}${leafX(54, 176, 75, 189, 6.5, 'l4lf', 'l4lf')}
${pearlX(742, 22, 4.5, 'l4pe')}${pearlX(742, 62, 4.5, 'l4pe')}${pearlX(742, 102, 4.5, 'l4pe')}${pearlX(742, 142, 4.5, 'l4pe')}${pearlX(742, 182, 4.5, 'l4pe')}
${flower5X(24, 190, 10, 'l4rf', 'l4rf', '#d9521e')}
</svg>`,
    probe: [300, 26, LINED_BG],
  },

  // ========== 5 ⑤ 分组小标题式 · 极简——两组带小标题（橙方块=标题 · 灰圆点=条目） ==========
  {
    name: 'list-grouped', label: '列表·分组小标题式·极简（两组带小标题）', type: '⑤ 分组小标题式', style: '极简',
    w: 750, h: 200, zone: GROUP_ROWS,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200">
<defs>${gU('l5bg', 0, 0, 0, 200, [[0, '#ffffff'], [0.35, '#fbfbf8'], [0.7, '#f6f6f2'], [1, '#f1f1ec']])}${gradRadial('l5dg', [[0, '#e6e6e6'], [0.5, '#c6c6c6'], [1, '#9e9e9e']])}</defs>
<rect x="0" y="0" width="750" height="200" fill="url(#l5bg)"/>
<path d="M14 36 V8 H70 M736 36 V8 H670 M14 164 V192 H70 M736 164 V192 H670" fill="none" stroke="#eceae6" stroke-width="1.5"/>
<rect x="30" y="19" width="18" height="18" rx="4" fill="#ff6b35"/>
<rect x="30" y="127" width="18" height="18" rx="4" fill="#ff6b35"/>
${grayDot(45, 64)}${grayDot(45, 100)}${grayDot(45, 172)}
${[28, 64, 100, 136, 172].map((cy) => `<line x1="738" y1="${cy}" x2="748" y2="${cy}" stroke="#e9e9e5" stroke-width="1.5"/>`).join('')}
</svg>`,
    probe: [39, 28, ORANGE],
  },

  // ========== 6 ⑥ 品牌单色式 · 品牌蓝——唯一一枚蓝贯穿 ==========
  {
    name: 'list-brand', label: '列表·品牌单色式·品牌蓝（蓝点）', type: '⑥ 品牌单色式', style: '品牌蓝单色',
    w: 750, h: 200, zone: GROUP_ROWS,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200">
<defs>${gU('l6bg', 0, 0, 0, 200, [[0, '#f8fbff'], [0.3, '#f2f6fe'], [0.65, '#eaf0fd'], [1, '#e2eafc']])}${gradLinear('l6dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#2f6fed']])}${gradLinear('l6pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#dbe7ff'], [0.7, '#9db8f5'], [1, '#4d82f1']])}</defs>
<rect x="0" y="0" width="750" height="200" fill="url(#l6bg)"/>
${blueDot(45, 28)}${blueDot(45, 64)}${blueDot(45, 100)}${blueDot(45, 136)}${blueDot(45, 172)}
${[28, 64, 100, 136, 172].map((cy) => `<polygon points="740,${cy - 6} 746,${cy} 740,${cy + 6} 734,${cy}" fill="url(#l6dg)"/>`).join('')}
<polygon points="18,12 24,18 18,24 12,18" fill="none" stroke="#c7d8fb" stroke-width="2"/>
<polygon points="742,182 750,182 742,190" fill="none" stroke="#c7d8fb" stroke-width="2"/>
${pearlX(736, 8, 5, 'l6pe')}
</svg>`,
    probe: [45, 28, BLUE],
  },

  // ========== 7 ① 圆点式（单条）· 校园风——迷你足球标记 + 星星 ==========
  {
    name: 'list-campus', label: '列表·圆点式单条·校园风（迷你足球+星星）', type: '① 圆点式（单条）', style: '校园风',
    w: 750, h: 100, zone: STRIP_ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 100">
<defs>${gU('l7bg', 0, 0, 0, 100, [[0, '#fcfef8'], [0.3, '#f6faf0'], [0.65, '#f0f6e6'], [1, '#e9f2dc']])}${gradLinear('l7st', 0, 0, 0, 1, [[0, '#f8cf7e'], [0.35, '#eeb04e'], [0.7, '#e39a2e'], [1, '#c97f1d']])}${gradLinear('l7lf', 0, 0, 1, 1, [[0, '#9fc48f'], [0.35, '#7fb46c'], [0.7, '#5c8f4e'], [1, '#4a7340']])}${gradLinear('l7pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#e8f3e0'], [0.7, '#b5d4a4'], [1, '#5c8f4e']])}</defs>
<rect x="0" y="0" width="750" height="100" fill="url(#l7bg)"/>
<path d="M14 32 V2 H70 M736 32 V2 H670 M14 68 V98 H70 M736 68 V98 H670" fill="none" stroke="#bcd6a8" stroke-width="1.5"/>
<circle cx="45" cy="50" r="15" fill="#ffffff" stroke="#5c8f4e" stroke-width="1.5"/>
<polygon points="45,44.8 49.9,48.6 48.3,54.2 41.7,54.2 40.1,48.6" fill="#3d3d3d"/>
<path d="M45 44.8 L45 35 M49.9 48.6 L58 43 M48.3 54.2 L55 61 M41.7 54.2 L35 61 M40.1 48.6 L32 43" stroke="#b8b8b8" stroke-width="1.2" fill="none"/>
<polygon points="24,72 26.4,77.2 32,77.6 27.7,81.2 29.1,86.6 24,83.8 18.9,86.6 20.3,81.2 16,77.6 21.6,77.2" fill="url(#l7st)"/>
${leafX(64, 66, 78, 76, 5, 'l7lf', 'l7lf')}
<circle cx="742" cy="50" r="6" fill="url(#l7pe)"/>
${leafX(16, 84, 30, 94, 5, 'l7lf', 'l7lf')}
</svg>`,
    probe: [45, 50, BALL_BLACK],
  },

  // ========== 8 ② 菱形引导式（单条）· 国潮风——朱红印章菱形标记 ==========
  {
    name: 'list-guochao', label: '列表·菱形引导式单条·国潮风（朱红印章标记）', type: '② 菱形引导式（单条）', style: '国潮风',
    w: 750, h: 100, zone: STRIP_ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 100">
<defs>${gU('l8bg', 0, 0, 0, 100, [[0, '#fdf8ec'], [0.3, '#f9f1dd'], [0.65, '#f4e9cc'], [1, '#eedfb8']])}${gradLinear('l8gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.35, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}${gradLinear('l8pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#f4e5c2'], [0.7, '#e0bd77'], [1, '#b8892f']])}</defs>
<rect x="0" y="0" width="750" height="100" fill="url(#l8bg)"/>
<path d="M14 32 V2 H70 M736 32 V2 H670 M14 68 V98 H70 M736 68 V98 H670" fill="none" stroke="#d4a24c" stroke-width="1.5"/>
<g transform="rotate(45 45 50)">
<rect x="34" y="39" width="22" height="22" fill="#9a281f"/>
<rect x="38.5" y="43.5" width="13" height="13" fill="none" stroke="#f5ecd9" stroke-width="1.5"/>
</g>
<circle cx="45" cy="50" r="2.2" fill="#f5ecd9"/>
<path d="M20 78 h12 v-7 h-12 M25 71 h2" stroke="#9a281f" stroke-width="1.5" fill="none"/>
<circle cx="742" cy="40" r="3" fill="url(#l8gd)"/>
<circle cx="742" cy="60" r="3" fill="url(#l8gd)"/>
${curlS(28, 88, 14, 0.5, 2, '#b8892f')}
${pearlX(736, 8, 5, 'l8pe')}
</svg>`,
    probe: [45, 50, SEAL_CREAM],
  },

  // ========== 9 ④ 衬底强调式（单条）· 科技风——冷蓝网格衬底 + 渐变菱形 ==========
  {
    name: 'list-tech', label: '列表·衬底强调式单条·科技风（冷蓝网格衬底）', type: '④ 衬底强调式（单条）', style: '科技风',
    w: 750, h: 100, zone: STRIP_ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 100">
<defs>${gU('l9bg', 0, 0, 0, 100, [[0, '#f0f5fe'], [0.3, '#eaf1fd'], [0.65, '#e3ecfc'], [1, '#dbe6fb']])}${gradLinear('l9dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#1a4fc4']])}${gradLinear('l9pg', 0, 0, 0, 1, [[0, '#ffffff'], [0.35, '#e2ebff'], [0.7, '#a9c2f7'], [1, '#5f8df0']])}</defs>
<rect x="0" y="0" width="750" height="100" fill="url(#l9bg)"/>
<rect x="20" y="14" width="56" height="72" fill="#dbe6fd"/>
<g stroke="#c3d5fa" stroke-width="1"><line x1="20" y1="30" x2="76" y2="30"/><line x1="20" y1="46" x2="76" y2="46"/><line x1="20" y1="62" x2="76" y2="62"/><line x1="20" y1="78" x2="76" y2="78"/><line x1="34" y1="14" x2="34" y2="86"/><line x1="48" y1="14" x2="48" y2="86"/><line x1="62" y1="14" x2="62" y2="86"/></g>
<polygon points="45,38 57,50 45,62 33,50" fill="url(#l9dg)"/>
<circle cx="45" cy="50" r="2.5" fill="#ffffff"/>
<polygon points="14,14 30,14 14,30" fill="none" stroke="#9db8f5" stroke-width="2"/>
<rect x="734" y="14" width="14" height="72" fill="#dbe6fd"/>
<line x1="741" y1="14" x2="741" y2="86" stroke="#c3d5fa" stroke-width="1"/>
<polygon points="736,86 750,86 736,100" fill="none" stroke="#9db8f5" stroke-width="2"/>
${pearlX(736, 8, 5, 'l9pg')}
</svg>`,
    probe: [30, 50, TECH_GRID],
  },

  // ========== 10 ④ 衬底强调式（单条）· 宣传——橙底白字高亮 ==========
  {
    name: 'list-promo', label: '列表·衬底强调式单条·宣传（橙底白字高亮）', type: '④ 衬底强调式（单条）', style: '宣传',
    w: 750, h: 100, zone: STRIP_ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 100">
<defs>${gU('l10bg', 0, 0, 0, 100, [[0, '#f07b2e'], [0.3, '#e5691f'], [0.65, '#d8581a'], [1, '#c14a14']])}<linearGradient id="l10wg" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.05"/></linearGradient></defs>
<rect x="0" y="0" width="750" height="100" fill="url(#l10bg)"/>
<polygon points="0,100 0,50 62,100" fill="#ffffff" opacity="0.08"/>
<circle cx="45" cy="50" r="10" fill="#ffffff"/>
<circle cx="41.8" cy="46.5" r="3.2" fill="#ffdfc4" opacity="0.8"/>
<line x1="736" y1="38" x2="748" y2="38" stroke="#ffffff" stroke-width="2" opacity="0.6"/>
<line x1="736" y1="62" x2="748" y2="62" stroke="#ffffff" stroke-width="2" opacity="0.6"/>
<polygon points="742,4 750,4 750,12" fill="url(#l10wg)"/>
</svg>`,
    probe: [45, 50, WHITE],
  },
]

// 校验：count=10 / dupName / name 以 list- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone 满足 §5.0 容量（整组 5 行总高 ≥140，单条 ≥60，宽 ≥500）
export function validateListArts() {
  const names = listArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = listArts.filter((a) => {
    if (!/^list-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 750 && (a.h === 200 || a.h === 100)) || !/^<svg/.test(a.svg)) return true
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
    let totalH = 0
    for (const z of zs) {
      if (!(z.x0 < z.x1 && z.y0 < z.y1)) return true
      if (z.x1 - z.x0 < 500) return true
      totalH += z.y1 - z.y0
    }
    if (a.h === 200) {
      if (zs.length !== 5) return true
      if (totalH < 140) return true
    } else {
      if (zs.length !== 1) return true
      if (totalH < 60) return true
    }
    return false
  })
  return { count: listArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
