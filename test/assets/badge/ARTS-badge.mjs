// ============================================================
// 徽章/高亮（module-badge）美术资产 10 个 —— 类型 × 风格 模型（badge）
// 类型 = 5 种组合方式（骨架模板）；风格 = 内容填充（图案词汇表与色板）
// 整图资产 + 中央嵌字模式：SVG 画布模拟徽章形状 + 图案长在结构上，
//   中央留空 zone（x40..260 × y35..85 = 220×50 设计，够 ≤4 字 12px 单行）
// 严格遵循 knowledge/module-badge.md §五 5.0 整图资产构建规范：
//   画布 300×120（375px 壳显示 ≈137×55，缩放比 ≈0.457）/ 徽章主体 y10 h100 /
//   图案贴边（顶部/两侧），中央 40..260 × 35..85 为文字区 /
//   大面积背景渐变一律垂直 + gradientUnits="userSpaceOnUse" 绝对坐标（PNG ≤1MB 铁律）
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变 + 珍珠/叶脉/多层花瓣
// 全部 probe 像素验证（选纯色部件：花心/印章方块/实心圆点/描边中心/菱形核心）
// zone 洁净设计：任何装饰的边界不得落在 x35..265 ∩ y35..85（保证相邻像素突变扫描 = 0）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

const WHITE = [255, 255, 255]
const GOLD = [184, 134, 11]     // #b8860b 沙金深
const GOLD_SAND = [212, 162, 76] // #d4a24c 沙金
const CRIMSON = [154, 40, 31]    // 朱红 #9a281f
const BLUE = [33, 102, 255]      // 冷蓝 #2166ff
const GRAY = [217, 217, 217]     // 极简灰 #d9d9d9
const GREEN = [24, 160, 88]      // 状态绿 #18a058
const TEAL = [63, 107, 104]      // 深青绿 #3f6b68
const RED_HOT = [192, 57, 43]    // 宣传红 #c0392b
const PENTA = [74, 74, 82]       // 球皮深色 #4a4a52
const SPARK_GOLD = [245, 197, 24] // 星芒金 #f5c518

// 通用文字区（300×120）：x 40..260，y 35..85（≥220px 宽 × 50px 高，够 ≤4 字 12px 单行）
const ZONE = { x0: 40, y0: 35, x1: 260, y1: 85 }

// userSpaceOnUse 垂直线性渐变（大面积背景一律垂直，符合 PNG 体积铁律）
const gU = (id, y1, y2, stops) =>
  `<linearGradient id="${id}" x1="0" y1="${y1}" x2="0" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

export const badgeArts = [
  // ========== 1 ① 行内小标签式 · 自然花草——浅底 + 草叶点缀 ==========
  {
    name: 'badge-tag-new', label: '徽章·行内小标签·草叶', type: '① 行内小标签式', style: '自然花草',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a1bg', 10, 110, [[0, '#fffdf6'], [0.35, '#fbf4e4'], [0.7, '#f6ead0'], [1, '#efe0ba']])}${gradLinear('a1lf', 0, 0, 1, 1, [[0, '#b9d6d2'], [0.35, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradRadial('a1rf', [[0, '#cfe3dc'], [0.35, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('a1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="9" fill="url(#a1bg)"/>
<rect x="16" y="16" width="268" height="88" rx="5" fill="none" stroke="#5f8d8a" stroke-width="1.2" opacity="0.4"/>
${flower5X(24, 24, 11, 'a1rf', 'a1rf', '#3f6b68')}
${leafX(12, 40, 32, 56, 10, 'a1lf', 'a1lf')}
${leafX(30, 76, 14, 86, 8, 'a1lf', 'a1lf')}
${curlS(28, 90, 16, 0.7, 2.2, '#5f8d8a')}
${pearlX(282, 102, 8, 'a1pe')}
</svg>`,
    probe: [24, 24, TEAL],
  },

  // ========== 2 ① 行内小标签式 · 国潮——朱红底 + 沙金边 + 印章纹 ==========
  {
    name: 'badge-tag-gold', label: '徽章·行内小标签·印章', type: '① 行内小标签式', style: '国潮',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a2bg', 10, 110, [[0, '#a52e24'], [0.35, '#9c281e'], [0.7, '#8f2118'], [1, '#7e1a12']])}${gradLinear('a2gd', 0, 0, 0, 1, [[0, '#f0d48a'], [0.35, '#e0b95f'], [0.7, '#d4a24c'], [1, '#b8892f']])}${gradLinear('a2pe', 0, 0, 0, 1, [[0, '#fff8e6'], [0.3, '#f7e8c0'], [0.65, '#e8c878'], [1, '#b8892f']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="9" fill="url(#a2bg)"/>
<rect x="10" y="10" width="280" height="100" rx="9" fill="none" stroke="#d4a24c" stroke-width="2"/>
<rect x="16" y="16" width="268" height="88" rx="5" fill="none" stroke="#f0d48a" stroke-width="1" opacity="0.5"/>
<rect x="12" y="12" width="22" height="22" fill="#d4a24c"/>
<rect x="17" y="17" width="12" height="12" fill="none" stroke="#9c281e" stroke-width="1.2"/>
<circle cx="23" cy="23" r="1.8" fill="#9c281e"/>
<path d="M40 98 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6" stroke="#d4a24c" stroke-width="1.4" fill="none"/>
<circle cx="284" cy="24" r="3.5" fill="#d4a24c"/>
${pearlX(282, 102, 7, 'a2pe')}
</svg>`,
    probe: [20, 20, GOLD_SAND],
  },

  // ========== 3 ⑤ 描边胶囊式 · 科技——冷蓝描边 + 网格 ==========
  {
    name: 'badge-capsule-blue', label: '徽章·描边胶囊·科技', type: '⑤ 描边胶囊式', style: '科技',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gradLinear('a3dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#1a4fc4']])}${gradLinear('a3pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e8effd'], [0.65, '#a9c2f7'], [1, '#5f8df0']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="50" fill="none" stroke="#2166ff" stroke-width="2"/>
<g stroke="#7ba6ff" stroke-width="1" opacity="0.9">
<line x1="12" y1="46" x2="34" y2="46"/><line x1="12" y1="53" x2="34" y2="53"/><line x1="12" y1="60" x2="34" y2="60"/><line x1="12" y1="67" x2="34" y2="67"/><line x1="12" y1="74" x2="34" y2="74"/>
<line x1="18" y1="44" x2="18" y2="76"/><line x1="24" y1="44" x2="24" y2="76"/><line x1="30" y1="44" x2="30" y2="76"/>
</g>
<polygon points="280,48 289,60 280,72 271,60" fill="none" stroke="#2166ff" stroke-width="2"/>
<polygon points="280,56 285,60 280,64 275,60" fill="url(#a3dg)"/>
<circle cx="280" cy="60" r="2" fill="#ffffff"/>
<g stroke="#7ba6ff" stroke-width="1.4"><line x1="268" y1="96" x2="288" y2="96"/><line x1="272" y1="101" x2="284" y2="101"/></g>
${pearlX(282, 104, 6, 'a3pe')}
</svg>`,
    probe: [10, 60, BLUE],
  },

  // ========== 4 ⑤ 描边胶囊式 · 极简——灰描边 + 端部圆点 ==========
  {
    name: 'badge-capsule-min', label: '徽章·描边胶囊·极简', type: '⑤ 描边胶囊式', style: '极简',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gradLinear('a4pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f0f0f0'], [0.65, '#c9c9c9'], [1, '#9e9e9e']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="50" fill="none" stroke="#d9d9d9" stroke-width="2"/>
<rect x="18" y="18" width="264" height="84" rx="42" fill="none" stroke="#e8e8e8" stroke-width="1"/>
<circle cx="16" cy="60" r="4" fill="#d9d9d9"/>
<circle cx="284" cy="60" r="4" fill="#d9d9d9"/>
<line x1="40" y1="98" x2="260" y2="98" stroke="#d9d9d9" stroke-width="1.4"/>
<line x1="40" y1="104" x2="260" y2="104" stroke="#d9d9d9" stroke-width="1.4"/>
${pearlX(16, 100, 6, 'a4pe')}
</svg>`,
    probe: [284, 60, GRAY],
  },

  // ========== 5 ③ 高亮标记式 · 自然花草——浅黄底 + 花枝角 ==========
  {
    name: 'badge-highlight', label: '徽章·高亮标记·花枝', type: '③ 高亮标记式', style: '自然花草',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a5bg', 10, 110, [[0, '#fff8d8'], [0.35, '#fff3bf'], [0.7, '#fbe9a4'], [1, '#f5dc85']])}${gradLinear('a5lf', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#9c4527']])}${gradRadial('a5rf', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradLinear('a5pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#fdf3d8'], [0.65, '#e8cd90'], [1, '#b8892f']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="7" fill="url(#a5bg)"/>
<rect x="16" y="16" width="268" height="88" rx="4" fill="none" stroke="#c9a24c" stroke-width="1" opacity="0.45"/>
${flower5X(24, 24, 11, 'a5rf', 'a5rf', '#b8860b')}
${leafX(30, 74, 12, 84, 9, 'a5lf', 'a5lf')}
${curlS(272, 88, 14, 0.7, 2, '#b8860b')}
${pearlX(282, 102, 7, 'a5pe')}
</svg>`,
    probe: [24, 24, GOLD],
  },

  // ========== 6 ④ 圆点状态式 · 自然花草——绿点 + 叶 ==========
  {
    name: 'badge-status', label: '徽章·圆点状态·绿叶', type: '④ 圆点状态式', style: '自然花草',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a6bg', 10, 110, [[0, '#f4fbf6'], [0.35, '#e9f5ec'], [0.7, '#dceee0'], [1, '#cee5d4']])}${gradLinear('a6lf', 0, 0, 1, 1, [[0, '#9fc48f'], [0.35, '#7fb46c'], [0.7, '#5c8f4e'], [1, '#4a7340']])}${gradLinear('a6pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5e8'], [0.65, '#b5d4a4'], [1, '#5c8f4e']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="9" fill="url(#a6bg)"/>
<rect x="16" y="16" width="268" height="88" rx="5" fill="none" stroke="#5c8f4e" stroke-width="1" opacity="0.35"/>
<circle cx="22" cy="60" r="11" fill="#18a058"/>
<circle cx="18" cy="55" r="3.5" fill="#ffffff" opacity="0.7"/>
${leafX(30, 76, 14, 86, 8, 'a6lf', 'a6lf')}
${leafX(12, 44, 28, 32, 7, 'a6lf', 'a6lf')}
${pearlX(282, 102, 7, 'a6pe')}
</svg>`,
    probe: [22, 60, GREEN],
  },

  // ========== 7 ② 右上角角标式 · 宣传——红角标 + 星芒 ==========
  {
    name: 'badge-corner-hot', label: '徽章·右上角标·星芒', type: '② 右上角角标式', style: '宣传',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a7bg', 10, 110, [[0, '#c0392b'], [0.35, '#b52e23'], [0.7, '#a1251b'], [1, '#8a1a12']])}${gradLinear('a7pe', 0, 0, 0, 1, [[0, '#fff5f0'], [0.3, '#f7d9d0'], [0.65, '#e0a89b'], [1, '#b85c4e']])}</defs>
<path d="M10 10 H 232 L 290 50 V 110 H 10 Z" fill="url(#a7bg)"/>
<g transform="translate(24,100)">
<path d="M0 -11 L3 -2 L11 0 L3 2 L0 11 L-3 2 L-11 0 L-3 -2 Z" fill="#ffffff"/>
<circle cx="0" cy="0" r="2.2" fill="#f5c518"/>
</g>
<g transform="translate(26,24)">
<path d="M0 -7 L2 -1.5 L7 0 L2 1.5 L0 7 L-2 1.5 L-7 0 L-2 -1.5 Z" fill="#ffffff" opacity="0.9"/>
</g>
${pearlX(282, 102, 7, 'a7pe')}
</svg>`,
    probe: [24, 100, SPARK_GOLD],
  },

  // ========== 8 ① 行内小标签式 · 校园风——球类图案徽章底 ==========
  {
    name: 'badge-campus', label: '徽章·行内小标签·球类', type: '① 行内小标签式', style: '校园风',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a8bg', 10, 110, [[0, '#f4fbf4'], [0.35, '#e8f5e8'], [0.7, '#dcefdc'], [1, '#cfe6cf']])}${gradLinear('a8lf', 0, 0, 1, 1, [[0, '#9fc48f'], [0.35, '#7fb46c'], [0.7, '#5c8f4e'], [1, '#4a7340']])}${gradLinear('a8or', 0, 0, 1, 1, [[0, '#f8d3ae'], [0.4, '#ec954f'], [0.7, '#e07b39'], [1, '#b85c22']])}${gradLinear('a8pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5e8'], [0.65, '#b5d4a4'], [1, '#5c8f4e']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="9" fill="url(#a8bg)"/>
<rect x="16" y="16" width="268" height="88" rx="5" fill="none" stroke="#5c8f4e" stroke-width="1" opacity="0.35"/>
<circle cx="22" cy="60" r="12" fill="#ffffff" stroke="#4a7340" stroke-width="2"/>
<polygon points="22,55.5 25.9,57.6 24.7,62 19.3,62 18.1,57.6" fill="#4a4a52"/>
<path d="M22 55.5 L22 48 M25.9 57.6 L29.5 53.5 M24.7 62 L29 66 M19.3 62 L15 66 M18.1 57.6 L14.5 53.5" stroke="#9fc48f" stroke-width="1.4" fill="none"/>
<circle cx="278" cy="22" r="8" fill="url(#a8or)"/>
<path d="M278 14 Q 283 19 278 30 M271 19 Q 278 14 285 19" stroke="#b85c22" stroke-width="1.3" fill="none"/>
${leafX(10, 22, 26, 32, 7, 'a8lf', 'a8lf')}
${pearlX(282, 102, 7, 'a8pe')}
</svg>`,
    probe: [22, 60, PENTA],
  },

  // ========== 9 ⑤ 描边胶囊式 · 国潮——印章方块 + 回纹 ==========
  {
    name: 'badge-guochao-seal', label: '徽章·描边胶囊·印章', type: '⑤ 描边胶囊式', style: '国潮',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gradLinear('a9gd', 0, 0, 0, 1, [[0, '#f0d48a'], [0.35, '#e0b95f'], [0.7, '#d4a24c'], [1, '#b8892f']])}${gradLinear('a9pe', 0, 0, 0, 1, [[0, '#fff8e6'], [0.3, '#f7e8c0'], [0.65, '#e8c878'], [1, '#b8892f']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="50" fill="none" stroke="#9a281f" stroke-width="2"/>
<rect x="12" y="48" width="22" height="22" fill="#9a281f"/>
<rect x="17" y="53" width="12" height="12" fill="none" stroke="#f0d48a" stroke-width="1.4"/>
<circle cx="23" cy="59" r="2.2" fill="#f0d48a"/>
<path d="M40 98 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6" stroke="#d4a24c" stroke-width="1.4" fill="none"/>
<circle cx="284" cy="60" r="4" fill="#d4a24c"/>
${pearlX(282, 102, 6, 'a9pe')}
</svg>`,
    probe: [14, 68, CRIMSON],
  },

  // ========== 10 ③ 高亮标记式 · 科技——菱形高亮 + 网格 ==========
  {
    name: 'badge-tech-diamond', label: '徽章·高亮标记·菱形', type: '③ 高亮标记式', style: '科技',
    w: 300, h: 120, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<defs>${gU('a10bg', 10, 110, [[0, '#f0f6ff'], [0.35, '#e8f0fd'], [0.7, '#dfe9fb'], [1, '#d4e1f8']])}${gradLinear('a10dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#1a4fc4']])}${gradLinear('a10pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e8effd'], [0.65, '#a9c2f7'], [1, '#5f8df0']])}</defs>
<rect x="10" y="10" width="280" height="100" rx="7" fill="url(#a10bg)"/>
<rect x="16" y="16" width="268" height="88" rx="4" fill="none" stroke="#8db0f6" stroke-width="1" opacity="0.5"/>
<polygon points="22,48 33,60 22,72 11,60" fill="none" stroke="#2166ff" stroke-width="2"/>
<polygon points="22,55 29,60 22,65 15,60" fill="url(#a10dg)"/>
<circle cx="22" cy="60" r="2" fill="#ffffff"/>
<g stroke="#7ba6ff" stroke-width="1">
<line x1="270" y1="14" x2="288" y2="14"/><line x1="270" y1="19" x2="288" y2="19"/><line x1="270" y1="24" x2="288" y2="24"/>
<line x1="275" y1="12" x2="275" y2="26"/><line x1="280" y1="12" x2="280" y2="26"/>
</g>
<line x1="40" y1="102" x2="260" y2="102" stroke="#7ba6ff" stroke-width="1.2"/>
${pearlX(282, 102, 7, 'a10pe')}
</svg>`,
    probe: [22, 60, WHITE],
  },
]

// 校验：count=10 / dupName / name 以 badge- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone 存在且满足 §5.0 容量（设计宽 ≥220、高 ≥40）
export function validateBadgeArts() {
  const names = badgeArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = badgeArts.filter((a) => {
    if (!/^badge-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 300 && a.h === 120) || !/^<svg/.test(a.svg)) return true
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
    const z = a.zone
    if (!z || !(z.x0 < z.x1 && z.y0 < z.y1)) return true
    const w = z.x1 - z.x0, h = z.y1 - z.y0
    if (w < 220 || h < 40) return true
    return false
  })
  return { count: badgeArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
