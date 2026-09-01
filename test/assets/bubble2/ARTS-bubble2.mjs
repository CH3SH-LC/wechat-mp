// ============================================================
// 重点气泡（module-bubble）美术资产 第二批 10 个 —— 类型 × 风格 模型（bubble2）
// 类型 = 7 种组合方式（骨架模板）；风格 = 内容填充（标记图案与色板）
// 整图资产 + 中央嵌字模式：SVG 画布模拟气泡容器 + 标记/装饰长在结构上，
//   中央留空 zone（单泡 110..730 × 50..170 = 620×120 设计，够两行字；双泡每泡 74 高，各一行）
// 严格遵循 knowledge/module-bubble.md §五 5.0 整图资产构建规范：
//   画布 750×215 / 容器 y10 h195 / 顶部装饰贴顶 y≤50 / 底部装饰贴底 y≥170 /
//   大面积背景渐变一律垂直 + gradientUnits="userSpaceOnUse" 绝对坐标（PNG ≤1MB 铁律）
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-5 stop 渐变 + 珍珠/叶脉/多层花瓣
// 全部 probe 像素验证（选纯色部件：竖条实段/标记实心/框线/实色底）
// zone 洁净设计：任何形状的竖向边界不得落在 x105..730 ∩ 区 y 范围（保证相邻像素突变扫描 = 0）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

const WHITE = [255, 255, 255]
const ORANGE = [201, 111, 74]    // #c96f4a
const ORANGE_D = [160, 78, 46]   // #a04e2e
const TEAL = [95, 141, 138]      // #5f8d8a
const GOLD = [184, 134, 11]      // #b8860b
const CRIMSON = [154, 40, 31]    // 朱红 #9a281f
const BLUE = [47, 111, 237]      // 冷蓝 #2f6fed
const DEEPBLUE = [22, 58, 143]   // 科技深蓝 #163a8f
const CAMPUS_GREEN = [92, 143, 78]  // 球场绿 #5c8f4e

// 通用文字区（单泡 750×215）：x 110..730，y 50..170（≥620px 宽 × 120px 高，够两行字）
const ZONE = { x0: 110, y0: 50, x1: 730, y1: 170 }

// userSpaceOnUse 线性渐变（大面积背景一律垂直，符合 PNG 体积铁律）
const gU = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

export const bubbleArts2 = [
  // ========== 1 ① 左竖条浅底式 · 自然花草（默认）——草叶 NOTE ==========
  {
    name: 'bubble-bar-note', label: '气泡·左竖条浅底·草叶 NOTE', type: '① 左竖条浅底式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a1bg', 0, 10, 0, 205, [[0, '#fffdf7'], [0.35, '#fbf6ea'], [0.7, '#f6efdd'], [1, '#f0e6d2']])}${gradLinear('a1lf', 0, 0, 1, 1, [[0, '#8fb0ac'], [0.4, '#6f9c97'], [0.7, '#5f8d8a'], [1, '#4a706d']])}${gradRadial('a1rf', [[0, '#b9d6d2'], [0.4, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('a1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#a1bg)"/>
<rect x="16" y="12" width="728" height="191" rx="13" fill="none" stroke="#5f8d8a" stroke-width="1.5" opacity="0.35"/>
<rect x="20" y="14" width="7" height="187" rx="3.5" fill="#5f8d8a"/>
${flower5X(30, 24, 11, 'a1rf', 'a1rf', '#3f6b68')}
${pearlX(30, 193, 9, 'a1pe')}
${leafX(48, 16, 74, 38, 11, 'a1lf', 'a1lf')}
<circle cx="70" cy="75" r="18" fill="none" stroke="#5f8d8a" stroke-width="4"/>
${leafX(62, 70, 78, 84, 8, 'a1lf', 'a1lf')}
${leafX(78, 70, 62, 84, 8, 'a1lf', 'a1lf')}
<circle cx="70" cy="75" r="3.5" fill="#3f6b68"/>
<circle cx="56" cy="177" r="4" fill="#c96f4a"/>
</svg>`,
    probe: [23, 75, TEAL],
  },

  // ========== 2 ② 整块实色式 · 自然花草（默认）——TIP 橙系（深橙底保证白字 ≥4.5:1） ==========
  {
    name: 'bubble-solid-tip', label: '气泡·整块实色·TIP 橙', type: '② 整块实色式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a2bg', 0, 10, 0, 205, [[0, '#b2552f'], [0.4, '#a64a29'], [0.75, '#9a4527'], [1, '#8a3d22']])}${gradLinear('a2lf', 0, 0, 1, 1, [[0, '#e8b493'], [0.4, '#cf7f58'], [0.7, '#b85c38'], [1, '#9c4527']])}${gradRadial('a2rf', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradLinear('a2pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f7ddca'], [0.65, '#e0a884'], [1, '#b85c38']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#a2bg)"/>
<rect x="18" y="18" width="714" height="179" rx="11" fill="none" stroke="#f2c9a8" stroke-width="1.5" opacity="0.5"/>
<circle cx="60" cy="77" r="19" fill="#000000" opacity="0.12"/>
<circle cx="58" cy="75" r="19" fill="#ffffff"/>
${leafX(74, 66, 94, 82, 9, 'a2lf', 'a2lf')}
${curlS(74, 86, 20, 0.5, 2.5, '#8a3d22')}
${flower5X(92, 169, 12, 'a2rf', 'a2rf', '#8f4226')}
${pearlX(30, 193, 9, 'a2pe')}
${leafX(24, 12, 52, 32, 12, 'a2lf', 'a2lf')}
</svg>`,
    probe: [58, 75, WHITE],
  },

  // ========== 3 ③ 细边角标式 · 自然花草（默认）——右上 NEW 角标 ==========
  {
    name: 'bubble-corner-new', label: '气泡·细边角标·NEW', type: '③ 细边角标式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a3bg', 0, 10, 0, 205, [[0, '#fffdf8'], [0.35, '#faf3e4'], [0.7, '#f5ead2'], [1, '#efe1c2']])}${gradLinear('a3lf', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#9c4527']])}${gradRadial('a3rf', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradLinear('a3pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f7ddca'], [0.65, '#e0a884'], [1, '#b85c38']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="url(#a3bg)" stroke="#c96f4a" stroke-width="1.5"/>
<rect x="646" y="12" width="84" height="32" rx="16" fill="#b8860b"/>
<text x="688" y="33" font-family="sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">NEW</text>
<circle cx="70" cy="75" r="18" fill="none" stroke="#c96f4a" stroke-width="4"/>
${leafX(62, 70, 78, 84, 8, 'a3lf', 'a3lf')}
${leafX(78, 70, 62, 84, 8, 'a3lf', 'a3lf')}
<circle cx="70" cy="75" r="3" fill="#a04e2e"/>
${leafX(14, 14, 40, 34, 12, 'a3lf', 'a3lf')}
${curlS(28, 181, 26, 0.4, 2.5, '#c96f4a')}
${flower5X(712, 193, 10, 'a3rf', 'a3rf', '#a04e2e')}
${pearlX(98, 40, 9, 'a3pe')}
</svg>`,
    probe: [652, 28, GOLD],
  },

  // ========== 4 ④ 警示边框式 · 自然花草（默认）——WARN 旋转方块 + 四角饰 ==========
  {
    name: 'bubble-warn-frame', label: '气泡·警示边框·WARN', type: '④ 警示边框式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a4bg', 0, 8, 0, 207, [[0, '#fdf6f2'], [0.35, '#faf0ea'], [0.7, '#f6e7de'], [1, '#f0dcd0']])}${gradLinear('a4lf', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#9c4527']])}${gradRadial('a4rf', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradLinear('a4pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f7ddca'], [0.65, '#e0a884'], [1, '#b85c38']])}</defs>
<rect x="8" y="8" width="734" height="199" rx="14" fill="url(#a4bg)"/>
<rect x="8" y="8" width="734" height="199" rx="14" fill="none" stroke="#a04e2e" stroke-width="3"/>
<rect x="24" y="22" width="72" height="26" rx="4" fill="none" stroke="#f2c9a8" stroke-width="2"/>
<rect x="24" y="22" width="6" height="26" rx="3" fill="#f2c9a8"/>
<rect x="654" y="22" width="72" height="26" rx="4" fill="none" stroke="#f2c9a8" stroke-width="2"/>
<rect x="720" y="22" width="6" height="26" rx="3" fill="#f2c9a8"/>
<rect x="24" y="172" width="72" height="26" rx="4" fill="none" stroke="#f2c9a8" stroke-width="2"/>
<rect x="24" y="172" width="6" height="26" rx="3" fill="#f2c9a8"/>
<rect x="654" y="172" width="72" height="26" rx="4" fill="none" stroke="#f2c9a8" stroke-width="2"/>
<rect x="720" y="172" width="6" height="26" rx="3" fill="#f2c9a8"/>
<polygon points="40.2,75 60,55.2 79.8,75 60,94.8" fill="#a04e2e"/>
<circle cx="55" cy="57" r="3" fill="#ffffff" opacity="0.8"/>
${leafX(14, 14, 40, 34, 12, 'a4lf', 'a4lf')}
${leafX(90, 183, 60, 199, 12, 'a4lf', 'a4lf')}
${leafX(66, 187, 96, 199, 10, 'a4lf', 'a4lf')}
${pearlX(40, 190, 8.5, 'a4pe')}
${flower5X(720, 22, 11, 'a4rf', 'a4rf', '#a04e2e')}
</svg>`,
    probe: [60, 75, ORANGE_D],
  },

  // ========== 5 ⑤ 双层深浅式 · 自然花草（默认）——KEY 白菱形压轴 ==========
  {
    name: 'bubble-key-deep', label: '气泡·双层深浅·KEY', type: '⑤ 双层深浅式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a5bg', 0, 10, 0, 205, [[0, '#7a6aa8'], [0.35, '#6b5a9e'], [0.7, '#5b4a8c'], [1, '#4a3c72']])}${gradRadial('a5rf', [[0, '#9b8fc4'], [0.4, '#7a6aa8'], [0.7, '#5b4a8c'], [1, '#45346d']])}${gradLinear('a5pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e4dff4'], [0.65, '#b7aedd'], [1, '#7a6aa8']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#a5bg)"/>
<rect x="10" y="10" width="730" height="195" rx="16" fill="none" stroke="#3d3160" stroke-width="2"/>
<rect x="18" y="18" width="714" height="179" rx="11" fill="#45346d" opacity="0.5"/>
<polygon points="60,52 81,75 60,98 39,75" fill="#ffffff"/>
<polygon points="60,62 70,75 60,88 50,75" fill="none" stroke="#635293" stroke-width="2.5"/>
${leafX(52, 44, 26, 30, 11, 'a5rf', 'a5rf')}
${leafX(68, 44, 94, 30, 11, 'a5rf', 'a5rf')}
${flower5X(712, 28, 11, 'a5rf', 'a5rf', '#45346d')}
${pearlX(712, 187, 9, 'a5pe')}
</svg>`,
    probe: [60, 75, WHITE],
  },

  // ========== 6 ⑥ 品牌单色五档式 · 极简科技——品牌蓝五档 + 几何菱形 ==========
  {
    name: 'bubble-brand-blue', label: '气泡·品牌蓝五档·菱形', type: '⑥ 品牌单色五档式', style: '极简科技',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a6bg', 0, 0, 0, 215, [[0, '#f6f9ff'], [0.35, '#f0f5fe'], [0.7, '#e8f0fd'], [1, '#e0eafc']])}${gradLinear('a6dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#2f6fed']])}${gradLinear('a6pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e8effd'], [0.65, '#a9c2f7'], [1, '#5f8df0']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="url(#a6bg)"/>
<rect x="10" y="10" width="730" height="195" rx="14" fill="none" stroke="#8db0f6" stroke-width="1.5"/>
<rect x="40" y="26" width="22" height="14" rx="4" fill="#dbe6fd"/>
<rect x="40" y="44" width="22" height="14" rx="4" fill="#b9cdfa"/>
<rect x="40" y="62" width="22" height="14" rx="4" fill="#8db0f6"/>
<rect x="40" y="80" width="22" height="14" rx="4" fill="#4d82f1"/>
<rect x="40" y="98" width="22" height="14" rx="4" fill="#2f6fed"/>
<polygon points="84,55 102,75 84,95 66,75" fill="none" stroke="#2f6fed" stroke-width="3"/>
<polygon points="84,64 93,75 84,86 75,75" fill="url(#a6dg)"/>
<circle cx="84" cy="75" r="2.5" fill="#ffffff"/>
<g stroke="#8db0f6" stroke-width="1.5" opacity="0.8"><line x1="668" y1="14" x2="730" y2="14"/><line x1="668" y1="22" x2="730" y2="22"/><line x1="676" y1="10" x2="676" y2="26"/><line x1="688" y1="10" x2="688" y2="26"/><line x1="700" y1="10" x2="700" y2="26"/><line x1="712" y1="10" x2="712" y2="26"/><line x1="724" y1="10" x2="724" y2="26"/></g>
<polygon points="714,182 730,182 714,198" fill="none" stroke="#8db0f6" stroke-width="2"/>
${pearlX(88, 188, 9, 'a6pe')}
</svg>`,
    probe: [51, 105, BLUE],
  },

  // ========== 7 ⑦ 对照双泡式 · 自然花草（默认）——上红(反例) 下青(正例) ==========
  {
    name: 'bubble-compare', label: '气泡·对照双泡·反/正', type: '⑦ 对照双泡式', style: '自然花草',
    w: 750, h: 215,
    zone: [{ x0: 105, y0: 15, x1: 720, y1: 89 }, { x0: 105, y0: 121, x1: 720, y1: 195 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a7rbg', 0, 8, 0, 96, [[0, '#fdf3ef'], [0.35, '#faece4'], [0.7, '#f6e2d6'], [1, '#f0d6c6']])}${gU('a7tbg', 0, 114, 0, 202, [[0, '#f2f8f6'], [0.35, '#eaf3f0'], [0.7, '#e0ede9'], [1, '#d4e6e1']])}${gradLinear('a7lf', 0, 0, 1, 1, [[0, '#8fb0ac'], [0.4, '#6f9c97'], [0.7, '#5f8d8a'], [1, '#4a706d']])}${gradLinear('a7lf2', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#9c4527']])}${gradRadial('a7rf', [[0, '#f5c9a8'], [0.4, '#d1805e'], [0.7, '#b85c38'], [1, '#8f4226']])}${gradRadial('a7rt', [[0, '#cfe0da'], [0.4, '#8fb0ac'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}</defs>
<rect x="10" y="8" width="730" height="88" rx="12" fill="url(#a7rbg)"/>
<rect x="10" y="8" width="730" height="88" rx="12" fill="none" stroke="#c96f4a" stroke-width="1.5"/>
<circle cx="55" cy="40" r="18" fill="#c96f4a"/>
<circle cx="49" cy="33" r="5" fill="#ffffff" opacity="0.7"/>
${leafX(36, 14, 60, 28, 10, 'a7lf2', 'a7lf2')}
${leafX(40, 86, 62, 78, 9, 'a7lf2', 'a7lf2')}
<polygon points="60,101.5 64.5,105 60,108.5 55.5,105" fill="#5f8d8a"/>
${curlS(84, 105, 18, 0.2, 2, '#c96f4a')}
<rect x="10" y="114" width="730" height="88" rx="12" fill="url(#a7tbg)"/>
<rect x="10" y="114" width="730" height="88" rx="12" fill="none" stroke="#5f8d8a" stroke-width="1.5"/>
<circle cx="55" cy="158" r="18" fill="#5f8d8a"/>
<circle cx="49" cy="151" r="5" fill="#ffffff" opacity="0.7"/>
${leafX(36, 120, 60, 134, 10, 'a7lf', 'a7lf')}
${leafX(40, 192, 62, 184, 9, 'a7lf', 'a7lf')}
</svg>`,
    probe: [55, 40, ORANGE],
  },

  // ========== 8 ① 左竖条浅底式 · 阳光校园风——球类标记（足球/篮球/网球） ==========
  {
    name: 'bubble-campus-ball', label: '气泡·左竖条·球类标记', type: '① 左竖条浅底式', style: '阳光校园风',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a8bg', 0, 10, 0, 205, [[0, '#fbfdf7'], [0.35, '#f6faf0'], [0.7, '#f0f6e6'], [1, '#e8f1da']])}${gradLinear('a8lf', 0, 0, 1, 1, [[0, '#9fc48f'], [0.4, '#7fb46c'], [0.7, '#5c8f4e'], [1, '#4a7340']])}${gradRadial('a8rf', [[0, '#f8d3ae'], [0.4, '#ec954f'], [0.7, '#e07b39'], [1, '#b85c22']])}${gradLinear('a8pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef5e8'], [0.65, '#b5d4a4'], [1, '#5c8f4e']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#a8bg)"/>
<rect x="20" y="14" width="7" height="187" rx="3.5" fill="#5c8f4e"/>
<polygon points="27,13 42,16 27,19" fill="#e07b39"/>
<circle cx="27" cy="12" r="2.5" fill="#e07b39"/>
${leafX(40, 20, 62, 34, 10, 'a8lf', 'a8lf')}
<circle cx="56" cy="75" r="19" fill="#ffffff" stroke="#5c8f4e" stroke-width="2"/>
<polygon points="62,68 55.3,77.2 57.9,69.3 66.1,69.3 68.7,77.2" fill="#3d3d3d"/>
<path d="M62 68 L62 57 M55.3 77.2 L44.9 80.6 M57.9 69.3 L51.4 60.4 M66.1 69.3 L72.6 60.4 M68.7 77.2 L79.1 80.6" stroke="#b8b8b8" stroke-width="1.2" fill="none"/>
<circle cx="86" cy="52" r="14" fill="#e07b39"/>
<path d="M86 38 C 91 44 91 60 86 66 M77 46 C 85 49 90 49 98 46 M77 58 C 85 55 90 55 98 58" stroke="#8a3c14" stroke-width="1.6" fill="none"/>
<circle cx="88" cy="98" r="13" fill="#cdd93c"/>
<path d="M88 85 C 92 90 92 106 88 111 M78 94 C 85 92 91 92 98 94 M78 102 C 85 104 91 104 98 102" stroke="#7d8a24" stroke-width="1.5" fill="none"/>
${pearlX(30, 191, 8.5, 'a8pe')}
</svg>`,
    probe: [23, 75, CAMPUS_GREEN],
  },

  // ========== 9 ① 左竖条浅底式 · 国潮风——印章方块 + 回纹，朱红×沙金 ==========
  {
    name: 'bubble-guochao-seal', label: '气泡·左竖条·印章回纹', type: '① 左竖条浅底式', style: '国潮风',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('a9bg', 0, 10, 0, 205, [[0, '#fdf8ec'], [0.35, '#f9f1dd'], [0.7, '#f4e9cc'], [1, '#eedfb8']])}${gradLinear('a9gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.35, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}${gradLinear('a9pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f4e5c2'], [0.65, '#e0bd77'], [1, '#b8892f']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="url(#a9bg)"/>
<rect x="18" y="18" width="714" height="179" rx="10" fill="none" stroke="#d4a24c" stroke-width="1.5"/>
<rect x="22" y="14" width="7" height="187" rx="3.5" fill="#9a281f"/>
<rect x="22" y="14" width="7" height="16" rx="3.5" fill="url(#a9gd)"/>
<rect x="22" y="185" width="7" height="16" rx="3.5" fill="url(#a9gd)"/>
<rect x="44" y="55" width="40" height="40" fill="#9a281f"/>
<rect x="52" y="63" width="24" height="24" fill="none" stroke="#f5ecd9" stroke-width="2"/>
<path d="M44 55 L 52 63 M84 55 L 76 63 M44 95 L 52 87 M84 95 L 76 87" stroke="#f5ecd9" stroke-width="1.5" fill="none"/>
<circle cx="64" cy="75" r="3" fill="#f5ecd9" opacity="0.9"/>
<rect x="676" y="16" width="14" height="14" fill="none" stroke="#9a281f" stroke-width="1.5"/>
<rect x="680" y="20" width="6" height="6" fill="#9a281f"/>
<rect x="702" y="16" width="14" height="14" fill="none" stroke="#9a281f" stroke-width="1.5"/>
<rect x="706" y="20" width="6" height="6" fill="#9a281f"/>
<circle cx="670" cy="23" r="2.5" fill="#d4a24c"/>
<circle cx="728" cy="23" r="2.5" fill="#d4a24c"/>
${curlS(34, 185, 22, 0.5, 2, '#b8892f')}
${pearlX(88, 193, 8.5, 'a9pe')}
</svg>`,
    probe: [46, 90, CRIMSON],
  },

  // ========== 10 ② 整块实色式 · 科技风——实色深蓝 + 白色几何菱形/网格 ==========
  {
    name: 'bubble-tech-diamond', label: '气泡·实色深蓝·菱形网格', type: '② 整块实色式', style: '科技风',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gradLinear('a10dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.35, '#5f8df0'], [0.7, '#3f78ef'], [1, '#1a4fc4']])}${gradLinear('a10pg', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#dbe7ff'], [0.65, '#9fb8f5'], [1, '#4d82f1']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="#163a8f"/>
<rect x="18" y="18" width="714" height="179" rx="10" fill="none" stroke="#5f8df0" stroke-width="1.5" opacity="0.5"/>
<polygon points="58,50 82,75 58,100 34,75" fill="#ffffff"/>
<polygon points="58,62 70,75 58,88 46,75" fill="url(#a10dg)"/>
<circle cx="58" cy="75" r="2.5" fill="#ffffff"/>
<g stroke="#8fb2ff" stroke-width="1.2" opacity="0.8"><line x1="668" y1="16" x2="730" y2="16"/><line x1="668" y1="26" x2="730" y2="26"/><line x1="668" y1="36" x2="730" y2="36"/><line x1="678" y1="12" x2="678" y2="40"/><line x1="692" y1="12" x2="692" y2="40"/><line x1="706" y1="12" x2="706" y2="40"/><line x1="720" y1="12" x2="720" y2="40"/></g>
<polygon points="34,181 54,181 34,201" fill="none" stroke="#8fb2ff" stroke-width="2"/>
${pearlX(88, 185, 8.5, 'a10pg')}
</svg>`,
    probe: [30, 75, DEEPBLUE],
  },
]

// 校验：count=10 / dupName / name 以 bubble- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone 存在且满足 §5.0 容量（单泡 ≥620×120，双泡每泡 ≥455×72）
export function validateBubbleArts2() {
  const names = bubbleArts2.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = bubbleArts2.filter((a) => {
    if (!/^bubble-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 750 && a.h === 215) || !/^<svg/.test(a.svg)) return true
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
      const w = z.x1 - z.x0, h = z.y1 - z.y0
      if (Array.isArray(a.zone)) {
        // 双泡：每泡一行 ≤16 字 → 显示宽 ≥208px = 设计 ≥455；显示高 ≥33px = 设计 ≥72
        if (w < 455 || h < 72) return true
      } else {
        // 单泡：设计宽 ≥620、设计高 ≥120（§5.0 容量）
        if (w < 620 || h < 120) return true
      }
    }
    return false
  })
  return { count: bubbleArts2.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
