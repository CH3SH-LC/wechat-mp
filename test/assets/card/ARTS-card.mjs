// ============================================================
// 卡片（module-card）美术资产 10 个 —— 类型 × 风格 模型（card）
// 类型 = 5 种组合方式（骨架模板）；风格 = 内容填充（顶条/标题装饰图案与色板）
// 整图资产 + 中央嵌字模式：SVG 画布模拟卡片容器 + 顶条/角块/标题装饰长在结构上，
//   中央留空 zone（单卡 620×240~330 设计，装标题 15px + 3-5 行条目 13px；分栏卡每格
//   标题 13px + 1-2 行条目 ≤10 字，格宽减半）
// 严格遵循 knowledge/module-card.md §五 5.0 整图资产构建规范：
//   条目 ≥3 行必须加高画布（不得硬塞）→ 画布 750×360（容器 y10 h340）；
//   顶部装饰贴顶（y≤50，实测 x≥105 侧 y<40）、底部装饰贴底（x≥105 侧 y>340 或 x<105 任意）；
//   大面积背景渐变一律垂直 + gradientUnits="userSpaceOnUse" 绝对坐标（PNG ≤1MB 铁律）
// v5 精细度：flower5X/leafX/pearlX/curlS + 4 stop 渐变 + 珍珠/叶脉/多层花瓣/回纹/菱形/球缝线
// 全部 probe 像素验证（选纯色部件：竖条/圆点/角块/印章/方块/五档条/顶条白圆点/奖杯座）
// zone 洁净设计：zone 矩形内任何形状/渐变边界不得出现（垂直渐变行内恒定 → 突变=0）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

const WHITE = [255, 255, 255]
const TEAL = [95, 141, 138]       // #5f8d8a
const ORANGE = [201, 111, 74]     // #c96f4a
const ORANGE_D = [160, 78, 46]    // #a04e2e
const GOLD = [184, 134, 11]       // #b8860b
const CRIMSON = [154, 40, 31]     // 朱红 #9a281f
const BLUE = [47, 111, 237]       // 冷蓝 #2f6fed
const GRAY = [200, 200, 200]      // #c8c8c8
const CAMPUS_ORANGE = [224, 123, 57] // #e07b39
const STAR_GOLD = [240, 193, 75]  // #f0c14b

// userSpaceOnUse 线性渐变（大面积背景一律垂直，符合 PNG 体积铁律）
const gU = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

// 单卡文字区（画布 750×360）：x 110..730，设计宽 620（显示 ≈283px ≥280 OK）
//   无顶条卡 y 40..340（300 设计高 ≥232 通过）；顶条卡 y 10..340（标题叠在顶条上）
//   双线卡 y 60..300（240 设计高，角块贴角）；分栏卡每格 y 60..300（240 ≥116 OK）
const ZONE_FULL = { x0: 110, y0: 40, x1: 730, y1: 340 }
const ZONE_TOPBAR = { x0: 110, y0: 10, x1: 730, y1: 340 }
const ZONE_DOUBLE = { x0: 110, y0: 60, x1: 730, y1: 300 }
const ZONE_SPLIT = [
  { x0: 122, y0: 60, x1: 403, y1: 300 },  // 左栏
  { x0: 437, y0: 60, x1: 718, y1: 300 },  // 右栏
]

export const cardArts = [
  // ========== 1 ① 白卡细边框式 · 自然花草（默认）——花竖条标题装饰 ==========
  {
    name: 'card-white-frame', label: '卡片·白卡细边框·花草', type: '① 白卡细边框式', style: '自然花草（默认）',
    w: 750, h: 360, zone: ZONE_FULL,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a1bg', 0, 10, 0, 350, [[0, '#fffefb'], [0.35, '#fcfaf5'], [0.7, '#f7f3ea'], [1, '#f1ece0']])}${gradLinear('a1lf', 0, 0, 1, 1, [[0, '#a8c8c0'], [0.4, '#7faaa4'], [0.7, '#5f8d8a'], [1, '#466b68']])}${gradRadial('a1rf', [[0, '#cfe0da'], [0.4, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('a1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a1bg)"/>
<rect x="10" y="10" width="730" height="340" rx="24" fill="none" stroke="#f0f0f0" stroke-width="2"/>
<rect x="86" y="70" width="8" height="110" rx="4" fill="#5f8d8a"/>
${flower5X(86, 62, 18, 'a1rf', 'a1rf', '#3f6b68')}
${leafX(640, 14, 668, 32, 10, 'a1lf', 'a1lf')}
${leafX(670, 18, 698, 34, 9, 'a1lf', 'a1lf')}
<circle cx="712" cy="24" r="3" fill="#c96f4a"/>
${pearlX(30, 332, 9, 'a1pe')}
${leafX(40, 330, 66, 346, 9, 'a1lf', 'a1lf')}
${curlS(86, 328, 14, 0.6, 2, '#5f8d8a')}
</svg>`,
    probe: [90, 125, TEAL],
  },

  // ========== 2 ② 浅底圆角式 · 自然花草（默认）——浅灰蓝底浮起 ==========
  {
    name: 'card-light-round', label: '卡片·浅底圆角·花草', type: '② 浅底圆角式', style: '自然花草（默认）',
    w: 750, h: 360, zone: ZONE_FULL,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a2bg', 0, 10, 0, 350, [[0, '#fbfdff'], [0.35, '#f4f8fd'], [0.7, '#edf2fa'], [1, '#e5ecf6']])}${gradLinear('a2lf', 0, 0, 1, 1, [[0, '#a8c8c0'], [0.4, '#7faaa4'], [0.7, '#5f8d8a'], [1, '#466b68']])}${gradRadial('a2rf', [[0, '#cfe0da'], [0.4, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('a2pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a2bg)"/>
<rect x="86" y="72" width="8" height="100" rx="4" fill="#5f8d8a"/>
${flower5X(86, 64, 17, 'a2rf', 'a2rf', '#3f6b68')}
${leafX(646, 14, 674, 32, 10, 'a2lf', 'a2lf')}
${leafX(676, 18, 704, 34, 9, 'a2lf', 'a2lf')}
<circle cx="716" cy="24" r="3.5" fill="#c96f4a"/>
${pearlX(30, 334, 9, 'a2pe')}
${curlS(34, 330, 26, 0.5, 2, '#6f9c97')}
</svg>`,
    probe: [90, 122, TEAL],
  },

  // ========== 3 ③ 实色顶条式 · 自然花草（默认）——橙顶条 #e56b2f + 白圆点 ==========
  {
    name: 'card-solid-topbar', label: '卡片·实色顶条·橙', type: '③ 实色顶条式', style: '自然花草（默认）',
    w: 750, h: 360, zone: ZONE_TOPBAR,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a3bg', 0, 10, 0, 350, [[0, '#ffffff'], [0.4, '#fdfbf7'], [0.8, '#faf6ee'], [1, '#f6f0e5']])}${gU('a3bar', 0, 10, 0, 66, [[0, '#eb7a30'], [0.35, '#e56b2f'], [0.7, '#d5541d'], [1, '#c04a18']])}${gradLinear('a3lf', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#9c4527']])}${gradRadial('a3rf', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradLinear('a3pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f7ddca'], [0.65, '#e0a884'], [1, '#b85c38']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a3bg)"/>
<rect x="10" y="10" width="730" height="340" rx="24" fill="none" stroke="#f0f0f0" stroke-width="2"/>
<path d="M10 34 Q10 10 34 10 H716 Q730 10 730 34 V66 H10 Z" fill="url(#a3bar)"/>
<circle cx="36" cy="38" r="8" fill="#ffffff"/>
${flower5X(78, 42, 11, 'a3rf', 'a3rf', '#8f4226')}
${leafX(50, 22, 70, 36, 8, 'a3lf', 'a3lf')}
<rect x="96" y="84" width="6" height="140" rx="3" fill="#f2c9a8"/>
${pearlX(30, 350, 9, 'a3pe')}
${pearlX(720, 350, 9, 'a3pe')}
</svg>`,
    probe: [36, 38, WHITE],
  },

  // ========== 4 ④ 双线角块式 · 自然花草（默认）——外深内浅双框 + 角块 ==========
  {
    name: 'card-double-line', label: '卡片·双线角块·花草', type: '④ 双线角块式', style: '自然花草（默认）',
    w: 750, h: 360, zone: ZONE_DOUBLE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a4bg', 0, 10, 0, 350, [[0, '#fffefc'], [0.4, '#fcfaf5'], [0.8, '#f7f3ec'], [1, '#f1ece2']])}${gradLinear('a4lf', 0, 0, 1, 1, [[0, '#a8c8c0'], [0.4, '#7faaa4'], [0.7, '#5f8d8a'], [1, '#466b68']])}${gradRadial('a4rf', [[0, '#cfe0da'], [0.4, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('a4pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a4bg)"/>
<rect x="10" y="10" width="730" height="340" rx="24" fill="none" stroke="#c8c8c8" stroke-width="3"/>
<rect x="18" y="18" width="714" height="324" rx="16" fill="none" stroke="#f0f0f0" stroke-width="2"/>
<rect x="26" y="26" width="16" height="16" rx="3" fill="#cfd8d4"/>
<rect x="708" y="26" width="16" height="16" rx="3" fill="#cfd8d4"/>
<rect x="26" y="318" width="16" height="16" rx="3" fill="#cfd8d4"/>
<rect x="708" y="318" width="16" height="16" rx="3" fill="#cfd8d4"/>
<polygon points="46,84 64,102 46,120 28,102" fill="#a04e2e"/>
${flower5X(30, 180, 12, 'a4rf', 'a4rf', '#8f4226')}
${leafX(640, 24, 668, 42, 9, 'a4lf', 'a4lf')}
${leafX(672, 28, 698, 44, 8, 'a4lf', 'a4lf')}
${pearlX(30, 334, 9, 'a4pe')}
</svg>`,
    probe: [46, 102, ORANGE_D],
  },

  // ========== 5 ⑤ 分栏卡式 · 自然花草（默认）——青优点 × 橙注意 左右两栏 ==========
  {
    name: 'card-split-columns', label: '卡片·分栏·青优点橙注意', type: '⑤ 分栏卡式', style: '自然花草（默认）',
    w: 750, h: 360, zone: ZONE_SPLIT,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a5bg1', 0, 30, 0, 330, [[0, '#f4fbf9'], [0.4, '#eaf6f2'], [0.8, '#dfefe9'], [1, '#d4e9e1']])}${gU('a5bg2', 0, 30, 0, 330, [[0, '#fdf6ef'], [0.4, '#f9ecdd'], [0.8, '#f4e2cc'], [1, '#eed7bd']])}${gradRadial('a5rf', [[0, '#cfe0da'], [0.4, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradRadial('a5rt', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradLinear('a5pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}${gradLinear('a5pe2', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f7ddca'], [0.65, '#e0a884'], [1, '#b85c38']])}</defs>
<rect x="110" y="30" width="305" height="300" rx="20" fill="url(#a5bg1)"/>
<rect x="110" y="30" width="305" height="300" rx="20" fill="none" stroke="#b8dcd4" stroke-width="2"/>
<rect x="425" y="30" width="305" height="300" rx="20" fill="url(#a5bg2)"/>
<rect x="425" y="30" width="305" height="300" rx="20" fill="none" stroke="#ecc9a8" stroke-width="2"/>
<rect x="134" y="38" width="56" height="5" rx="2.5" fill="#5f8d8a" opacity="0.7"/>
<rect x="460" y="38" width="56" height="5" rx="2.5" fill="#c96f4a" opacity="0.7"/>
${flower5X(262, 46, 10, 'a5rf', 'a5rf', '#3f6b68')}
${flower5X(577, 46, 10, 'a5rt', 'a5rt', '#8f4226')}
<circle cx="134" cy="48" r="3.5" fill="#5f8d8a"/>
<circle cx="574" cy="48" r="3.5" fill="#c96f4a"/>
${pearlX(134, 330, 8, 'a5pe')}
${pearlX(574, 330, 8, 'a5pe2')}
</svg>`,
    probe: [134, 48, TEAL],
  },

  // ========== 6 ① 白卡细边框式 · 阳光校园风——奖杯标题装饰 + 足球/篮球 ==========
  {
    name: 'card-campus', label: '卡片·白卡细边框·校园球类', type: '① 白卡细边框式', style: '阳光校园风',
    w: 750, h: 360, zone: ZONE_FULL,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a6bg', 0, 10, 0, 350, [[0, '#fdfef9'], [0.35, '#f8fbf2'], [0.7, '#f2f7e9'], [1, '#eaf2dd']])}${gradLinear('a6lf', 0, 0, 1, 1, [[0, '#9fc48f'], [0.4, '#7fb46c'], [0.7, '#5c8f4e'], [1, '#4a7340']])}${gradRadial('a6rf', [[0, '#f8d3ae'], [0.4, '#ec954f'], [0.7, '#e07b39'], [1, '#b85c22']])}${gradLinear('a6pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5e8'], [0.65, '#b5d4a4'], [1, '#5c8f4e']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a6bg)"/>
<rect x="10" y="10" width="730" height="340" rx="24" fill="none" stroke="#f0f0f0" stroke-width="2"/>
<path d="M66 68 Q66 60 74 60 H82 Q90 60 90 68 L90 78 Q90 86 82 86 H74 Q66 86 66 78 Z" fill="url(#a6rf)"/>
<path d="M66 68 C 60 66 58 70 62 74 M90 68 C 96 66 98 70 94 74" stroke="#b85c22" stroke-width="2.5" fill="none"/>
<rect x="76" y="86" width="4" height="8" fill="#b85c22"/>
<rect x="68" y="94" width="20" height="5" rx="2" fill="#e07b39"/>
<rect x="72" y="99" width="12" height="4" rx="2" fill="#e07b39"/>
<circle cx="64" cy="330" r="20" fill="#ffffff" stroke="#5c8f4e" stroke-width="2.5"/>
<polygon points="64,321 70.2,326.9 68.1,334.4 59.9,334.4 57.8,326.9" fill="#3d3d3d"/>
<path d="M64 321 L64 310 M70.2 326.9 L80.6 323.5 M68.1 334.4 L72.6 343.2 M59.9 334.4 L55.4 343.2 M57.8 326.9 L47.4 323.5" stroke="#b8b8b8" stroke-width="1.2" fill="none"/>
<circle cx="700" cy="25" r="12" fill="#e07b39"/>
<path d="M700 13 C 705 19 705 31 700 37 M691 19 C 699 22 704 22 712 19 M691 31 C 699 28 704 28 712 31" stroke="#8a3c14" stroke-width="1.6" fill="none"/>
${pearlX(30, 334, 8.5, 'a6pe')}
${leafX(24, 316, 42, 330, 7, 'a6lf', 'a6lf')}
</svg>`,
    probe: [78, 97, CAMPUS_ORANGE],
  },

  // ========== 7 ② 浅底圆角式 · 国潮风——朱红印章 + 沙金回纹 ==========
  {
    name: 'card-guochao', label: '卡片·浅底圆角·印章回纹', type: '② 浅底圆角式', style: '国潮风',
    w: 750, h: 360, zone: ZONE_FULL,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a7bg', 0, 10, 0, 350, [[0, '#fefaf0'], [0.35, '#faf2dd'], [0.7, '#f4e8c8'], [1, '#eee0b4']])}${gradLinear('a7gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.35, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}${gradLinear('a7pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f4e5c2'], [0.65, '#e0bd77'], [1, '#b8892f']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a7bg)"/>
<rect x="18" y="18" width="714" height="324" rx="16" fill="none" stroke="#d4a24c" stroke-width="1.5"/>
<rect x="62" y="70" width="40" height="40" fill="#9a281f"/>
<rect x="70" y="78" width="24" height="24" fill="none" stroke="#f5ecd9" stroke-width="2"/>
<path d="M62 70 L70 78 M102 70 L94 78 M62 110 L70 102 M102 110 L94 102" stroke="#f5ecd9" stroke-width="1.5" fill="none"/>
<circle cx="82" cy="90" r="3" fill="#f5ecd9" opacity="0.9"/>
<rect x="100" y="66" width="3" height="120" fill="#b8892f"/>
<g stroke="#9a281f" stroke-width="1.5" fill="none"><rect x="646" y="14" width="12" height="12"/><rect x="662" y="14" width="12" height="12"/><rect x="678" y="14" width="12" height="12"/><rect x="694" y="14" width="12" height="12"/><rect x="646" y="344" width="12" height="12"/><rect x="662" y="344" width="12" height="12"/><rect x="678" y="344" width="12" height="12"/><rect x="694" y="344" width="12" height="12"/></g>
${curlS(30, 322, 30, 0.5, 2.5, '#b8892f')}
${pearlX(30, 348, 8, 'a7pe')}
<circle cx="96" cy="330" r="3" fill="#b8892f"/>
</svg>`,
    probe: [64, 90, CRIMSON],
  },

  // ========== 8 ③ 实色顶条式 · 科技风——冷蓝顶条 + 菱形 + 五档蓝 ==========
  {
    name: 'card-tech', label: '卡片·实色顶条·冷蓝菱形', type: '③ 实色顶条式', style: '科技风',
    w: 750, h: 360, zone: ZONE_TOPBAR,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a8bg', 0, 10, 0, 350, [[0, '#ffffff'], [0.4, '#fbfcff'], [0.8, '#f5f8fe'], [1, '#eef2fc']])}${gU('a8bar', 0, 10, 0, 66, [[0, '#2f6fed'], [0.35, '#2459d9'], [0.7, '#1a4fc4'], [1, '#143a99']])}${gradLinear('a8dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#1a4fc4']])}${gradLinear('a8pg', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#dbe7ff'], [0.65, '#9fb8f5'], [1, '#4d82f1']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a8bg)"/>
<rect x="10" y="10" width="730" height="340" rx="24" fill="none" stroke="#f0f0f0" stroke-width="2"/>
<path d="M10 34 Q10 10 34 10 H716 Q730 10 730 34 V66 H10 Z" fill="url(#a8bar)"/>
<polygon points="60,20 86,39 60,58 34,39" fill="#ffffff"/>
<polygon points="60,28 76,39 60,50 44,39" fill="url(#a8dg)"/>
<circle cx="60" cy="39" r="2.5" fill="#ffffff"/>
<rect x="34" y="86" width="22" height="14" rx="4" fill="#dbe6fd"/>
<rect x="34" y="104" width="22" height="14" rx="4" fill="#b9cdfa"/>
<rect x="34" y="122" width="22" height="14" rx="4" fill="#8db0f6"/>
<rect x="34" y="140" width="22" height="14" rx="4" fill="#4d82f1"/>
<rect x="34" y="158" width="22" height="14" rx="4" fill="#2f6fed"/>
<g stroke="#8db0f6" stroke-width="1.2" opacity="0.7"><line x1="24" y1="200" x2="96" y2="200"/><line x1="24" y1="214" x2="96" y2="214"/><line x1="24" y1="228" x2="96" y2="228"/><line x1="36" y1="192" x2="36" y2="236"/><line x1="52" y1="192" x2="52" y2="236"/><line x1="68" y1="192" x2="68" y2="236"/><line x1="84" y1="192" x2="84" y2="236"/></g>
<polygon points="688,344 730,344 730,356" fill="none" stroke="#8fb2ff" stroke-width="2"/>
${pearlX(30, 348, 8, 'a8pg')}
</svg>`,
    probe: [45, 165, BLUE],
  },

  // ========== 9 ④ 双线角块式 · 极简商务——灰细线 + 角括号 ==========
  {
    name: 'card-minimal', label: '卡片·双线角块·极简灰', type: '④ 双线角块式', style: '极简商务',
    w: 750, h: 360, zone: ZONE_DOUBLE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a9bg', 0, 10, 0, 350, [[0, '#ffffff'], [0.4, '#fdfdfc'], [0.8, '#fafaf8'], [1, '#f6f6f3']])}</defs>
<rect x="10" y="10" width="730" height="340" rx="24" fill="url(#a9bg)"/>
<rect x="10" y="10" width="730" height="340" rx="24" fill="none" stroke="#c8c8c8" stroke-width="2.5"/>
<rect x="18" y="18" width="714" height="324" rx="16" fill="none" stroke="#efefef" stroke-width="1.5"/>
<path d="M20 64 V20 H64" stroke="#999" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M730 58 V22 H696" stroke="#c8c8c8" stroke-width="3" fill="none" stroke-linecap="round"/>
<rect x="24" y="24" width="14" height="14" fill="#c8c8c8"/>
<rect x="712" y="24" width="14" height="14" fill="#c8c8c8"/>
<rect x="24" y="322" width="14" height="14" fill="#c8c8c8"/>
<rect x="712" y="322" width="14" height="14" fill="#c8c8c8"/>
<rect x="96" y="70" width="4" height="96" fill="#999"/>
<rect x="88" y="66" width="10" height="10" fill="#c8c8c8"/>
<rect x="20" y="318" width="56" height="3" fill="#e0e0e0"/>
</svg>`,
    probe: [31, 31, GRAY],
  },

  // ========== 10 ⑤ 分栏卡式 · 电商促销风——右栏推荐高亮（橙顶条 + 五星徽） ==========
  {
    name: 'card-promo', label: '卡片·分栏·推荐高亮', type: '⑤ 分栏卡式', style: '电商促销',
    w: 750, h: 360, zone: ZONE_SPLIT,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 360">
<defs>${gU('a10bg1', 0, 30, 0, 330, [[0, '#f8f9f6'], [0.4, '#f1f3ed'], [0.8, '#e9ece4'], [1, '#e1e5da']])}${gU('a10bar', 0, 30, 0, 110, [[0, '#eb7a30'], [0.35, '#e56b2f'], [0.7, '#d5541d'], [1, '#c04a18']])}${gradLinear('a10pg', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#fdeeda'], [0.65, '#f4cf9a'], [1, '#d98a3e']])}</defs>
<rect x="110" y="30" width="305" height="300" rx="20" fill="url(#a10bg1)"/>
<rect x="110" y="30" width="305" height="300" rx="20" fill="none" stroke="#dfe3da" stroke-width="1.5"/>
<rect x="425" y="30" width="305" height="300" rx="20" fill="#ffffff"/>
<rect x="425" y="30" width="305" height="300" rx="20" fill="none" stroke="#e56b2f" stroke-width="4"/>
<path d="M425 50 Q425 30 445 30 H710 Q730 30 730 50 V110 H425 Z" fill="url(#a10bar)"/>
<polygon points="577,6 582,19.1 596,19.8 585.1,28.6 588.8,42.2 577,34.5 565.2,42.2 568.9,28.6 558,19.8 572,19.1" fill="#f0c14b"/>
<rect x="444" y="36" width="4" height="22" rx="2" fill="#fff3df" opacity="0.85"/>
<polygon points="200,34 212,46 200,58 188,46" fill="none" stroke="#c96f4a" stroke-width="2"/>
<rect x="134" y="38" width="56" height="5" rx="2.5" fill="#a8b09a" opacity="0.6"/>
<circle cx="170" cy="48" r="3" fill="#c96f4a"/>
${pearlX(136, 330, 8, 'a10pg')}
</svg>`,
    probe: [577, 26, STAR_GOLD],
  },
]

// 校验：count=10 / dupName / name 以 card- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone 存在且满足 §5.0 容量
//   （单卡设计宽 ≥620、高 ≥232；分栏每格设计宽 ≥200、高 ≥116；全部落在画布内）
export function validateCardArts() {
  const names = cardArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = cardArts.filter((a) => {
    if (!/^card-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 750 && a.h === 360) || !/^<svg/.test(a.svg)) return true
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
    if (a.zone === undefined) return true
    const zs = Array.isArray(a.zone) ? a.zone : [a.zone]
    if (!zs.length) return true
    for (const z of zs) {
      if (!(z.x0 < z.x1 && z.y0 < z.y1)) return true
      if (z.x0 < 0 || z.x1 > a.w || z.y0 < 0 || z.y1 > a.h) return true
      const w = z.x1 - z.x0, h = z.y1 - z.y0
      if (Array.isArray(a.zone)) {
        // 分栏：每格标题 + 1-2 行 ≤10 字 → 显示宽 ≥91px = 设计 ≥200；显示高 ≥53px = 设计 ≥116
        if (w < 200 || h < 116) return true
      } else {
        // 单卡：设计宽 ≥620（显示 ≥283 ≥280 OK）、设计高 ≥232（§5.0 完整归纳卡容量）
        if (w < 620 || h < 232) return true
      }
    }
    return false
  })
  return { count: cardArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
