// ============================================================
// 重点气泡（module-bubble）美术资产 第一批 10 个 —— 类型 × 风格 模型
// 类型 = 7 种组合方式（骨架模板）；风格 = 图案词汇表（标记图案与色板）
// 整图资产 + 中央嵌字模式：SVG 画布模拟气泡容器 + 标记/装饰长在结构上，
//   中央留空 zone ≥620px 宽 × ≥120px 高（显示 ≥280×55px，够两行字）——见
//   knowledge/module-bubble.md §五 5.0 整图资产构建规范（画布 750×215 / zone 容量 /
//   PNG ≤1MB / 三层验证闭环：probe + zone 洁净扫描 + 375px 壳叠字 DOM 实测）
// v2（375px 壳叠字实测修正）：画布 750×150 → 750×215（显示 343×98px），
//   容器 y10 h130 → y10 h195，底部装饰整体下移 +65 贴底，ZONE 扩为 y50..170
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变 + 珍珠/叶脉/多层花瓣
// 全部 probe 像素验证（选纯色部件：竖条实段/标记实心/框线/实色底）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from './ARTS-fine-utils.mjs'

const WHITE = [255, 255, 255]
const ORANGE = [201, 111, 74]    // #c96f4a
const ORANGE_D = [160, 78, 46]   // #a04e2e
const ORANGE_L = [242, 201, 168] // #f2c9a8
const TEAL = [95, 141, 138]      // #5f8d8a
const TEAL_D = [63, 107, 104]    // #3f6b68
const TEAL_L = [207, 224, 218]   // #cfe0da
const GOLD = [184, 134, 11]      // #b8860b
const GOLD_D = [138, 106, 16]    // #8a6a10
const GOLD_L = [245, 236, 217]   // #f5ecd9
const CRIMSON = [154, 40, 31]    // 朱红 #9a281f
const SAND = [212, 162, 76]      // 沙金 #d4a24c
const BLUE = [47, 111, 237]      // 冷蓝 #2f6fed
const DEEPBLUE = [22, 58, 143]   // 科技深蓝 #163a8f
const CAMPUS_GREEN = [92, 143, 78]  // 球场绿 #5c8f4e
const CAMPUS_ORANGE = [224, 123, 57] // 校徽橙 #e07b39

// 通用文字区（单泡 750×215）：x 110..730，y 50..170（≥620px 宽 × 120px 高，够两行字）
const ZONE = { x0: 110, y0: 50, x1: 730, y1: 170 }

// userSpaceOnUse 线性渐变（线/面渐变跨画布用绝对坐标，符合铁律）
const gU = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

export const bubbleArts = [
  // ========== 1 ① 左竖条浅底式 · 自然花草（默认）——草叶 NOTE ==========
  {
    name: 'bubble-bar-note', label: '气泡·左竖条浅底·草叶 NOTE', type: '① 左竖条浅底式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b1bg', 0, 10, 0, 205, [[0, '#fffdf7'], [0.5, '#faf4e8'], [1, '#f5ecdc']])}${gradLinear('b1lf', 0, 0, 1, 1, [[0, '#7fa6a2'], [0.55, '#5f8d8a'], [1, '#3f6b68']])}${gradRadial('b1rf', [[0.2, '#9fc4c0'], [0.55, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('b1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.45, '#e6f0ee'], [1, '#8fb0ac']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#b1bg)"/>
<rect x="16" y="12" width="728" height="191" rx="13" fill="none" stroke="#5f8d8a" stroke-width="1.5" opacity="0.35"/>
<rect x="20" y="14" width="7" height="187" rx="3.5" fill="#5f8d8a"/>
${flower5X(28, 22, 11, 'b1rf', 'b1rf', '#3f6b68')}
${pearlX(28, 195, 9, 'b1pe')}
${leafX(46, 16, 72, 36, 11, 'b1lf', 'b1lf')}
<circle cx="70" cy="75" r="18" fill="none" stroke="#5f8d8a" stroke-width="4"/>
${leafX(62, 70, 78, 84, 8, 'b1lf', 'b1lf')}
${leafX(78, 70, 62, 84, 8, 'b1lf', 'b1lf')}
<circle cx="70" cy="75" r="3.5" fill="#3f6b68"/>
<circle cx="56" cy="177" r="4" fill="#c96f4a"/>
</svg>`,
    probe: [23, 75, TEAL],
  },

  // ========== 2 ② 整块实色式 · 自然花草（默认）——TIP 橙系 ==========
  {
    name: 'bubble-solid-tip', label: '气泡·整块实色·TIP 橙', type: '② 整块实色式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gradLinear('b2lf', 0, 0, 1, 1, [[0, '#e8b493'], [0.5, '#d1805e'], [1, '#b85c38']])}${gradRadial('b2rf', [[0.2, '#f5c9a8'], [0.5, '#c96f4a'], [1, '#a04e2e']])}${gradLinear('b2pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.5, '#f7ddca'], [1, '#d9a484']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="#c96f4a"/>
<rect x="18" y="18" width="714" height="179" rx="11" fill="none" stroke="#f2c9a8" stroke-width="1.5" opacity="0.5"/>
<circle cx="60" cy="77" r="19" fill="#000000" opacity="0.12"/>
<circle cx="58" cy="75" r="19" fill="#ffffff"/>
${leafX(74, 68, 92, 82, 9, 'b2lf', 'b2lf')}
${curlS(74, 86, 20, 0.5, 2.5, '#a04e2e')}
${flower5X(92, 169, 12, 'b2rf', 'b2rf', '#a04e2e')}
${pearlX(30, 193, 9, 'b2pe')}
${leafX(24, 12, 52, 32, 12, 'b2lf', 'b2lf')}
</svg>`,
    probe: [58, 75, WHITE],
  },

  // ========== 3 ③ 细边角标式 · 自然花草（默认）——右上 NEW 角标 ==========
  {
    name: 'bubble-corner-new', label: '气泡·细边角标·NEW', type: '③ 细边角标式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b3bg', 0, 10, 0, 205, [[0, '#fffdf8'], [0.5, '#faf3e4'], [1, '#f4e9d2']])}${gradLinear('b3lf', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.5, '#c96f4a'], [1, '#a04e2e']])}${gradRadial('b3rf', [[0.2, '#f5c9a8'], [0.55, '#c96f4a'], [1, '#a04e2e']])}${gradLinear('b3pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.5, '#f7ddca'], [1, '#d9a484']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="url(#b3bg)" stroke="#c96f4a" stroke-width="1.5"/>
<rect x="646" y="12" width="84" height="32" rx="16" fill="#b8860b"/>
<text x="688" y="33" font-family="sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">NEW</text>
<circle cx="70" cy="75" r="18" fill="none" stroke="#c96f4a" stroke-width="4"/>
${leafX(62, 70, 78, 84, 8, 'b3lf', 'b3lf')}
${leafX(78, 70, 62, 84, 8, 'b3lf', 'b3lf')}
<circle cx="70" cy="75" r="3" fill="#a04e2e"/>
${leafX(14, 14, 40, 34, 12, 'b3lf', 'b3lf')}
${curlS(28, 181, 26, 0.4, 2.5, '#c96f4a')}
${flower5X(712, 193, 10, 'b3rf', 'b3rf', '#a04e2e')}
${pearlX(98, 40, 9, 'b3pe')}
</svg>`,
    probe: [652, 28, GOLD],
  },

  // ========== 4 ④ 警示边框式 · 自然花草（默认）——WARN 旋转方块 ==========
  {
    name: 'bubble-warn-frame', label: '气泡·警示边框·WARN', type: '④ 警示边框式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b4bg', 0, 8, 0, 207, [[0, '#fdf6f2'], [0.5, '#faf0ea'], [1, '#f6e6dd']])}${gradLinear('b4lf', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.5, '#c96f4a'], [1, '#a04e2e']])}${gradRadial('b4rf', [[0.2, '#f5c9a8'], [0.55, '#c96f4a'], [1, '#a04e2e']])}</defs>
<rect x="8" y="8" width="734" height="199" rx="14" fill="url(#b4bg)"/>
<rect x="8" y="8" width="734" height="199" rx="14" fill="none" stroke="#a04e2e" stroke-width="3"/>
<rect x="20" y="20" width="710" height="175" rx="10" fill="none" stroke="#f2c9a8" stroke-width="1.5"/>
<polygon points="40.2,75 60,55.2 79.8,75 60,94.8" fill="#a04e2e"/>
<circle cx="55" cy="57" r="3" fill="#ffffff" opacity="0.8"/>
${leafX(14, 14, 40, 34, 12, 'b4lf', 'b4lf')}
${leafX(90, 183, 60, 199, 12, 'b4lf', 'b4lf')}
${leafX(66, 187, 96, 199, 10, 'b4lf', 'b4lf')}
${flower5X(720, 22, 11, 'b4rf', 'b4rf', '#a04e2e')}
</svg>`,
    probe: [8, 75, ORANGE_D],
  },

  // ========== 5 ⑤ 双层深浅式 · 自然花草（默认）——KEY 白菱形压轴 ==========
  {
    name: 'bubble-key-deep', label: '气泡·双层深浅·KEY', type: '⑤ 双层深浅式', style: '自然花草',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b5bg', 0, 10, 0, 205, [[0, '#7a6aa8'], [0.45, '#635293'], [0.8, '#52417f'], [1, '#45346d']])}${gradRadial('b5rf', [[0.2, '#8f7fbd'], [0.55, '#6b5a9e'], [1, '#4a3c72']])}${gradLinear('b5pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.5, '#d9d2ee'], [1, '#9b8fc4']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#b5bg)"/>
<rect x="10" y="10" width="730" height="195" rx="16" fill="none" stroke="#3d3160" stroke-width="2"/>
<rect x="24" y="24" width="702" height="167" rx="11" fill="#45346d" opacity="0.55"/>
<polygon points="60,52 81,75 60,98 39,75" fill="#ffffff"/>
<polygon points="60,62 70,75 60,88 50,75" fill="none" stroke="#635293" stroke-width="2.5"/>
${leafX(52, 44, 26, 30, 11, 'b5rf', 'b5rf')}
${leafX(68, 44, 94, 30, 11, 'b5rf', 'b5rf')}
${flower5X(712, 28, 11, 'b5rf', 'b5rf', '#4a3c72')}
${pearlX(712, 187, 8, 'b5pe')}
</svg>`,
    probe: [60, 58, WHITE],
  },

  // ========== 6 ⑥ 品牌单色五档式 · 极简科技——品牌蓝五档 + 几何菱形 ==========
  {
    name: 'bubble-brand-blue', label: '气泡·品牌蓝五档·菱形', type: '⑥ 品牌单色五档式', style: '极简科技',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b6bg', 0, 0, 0, 215, [[0, '#f6f9ff'], [0.5, '#eef3fe'], [1, '#e3ecfd']])}${gradLinear('b6dg', 0, 0, 1, 1, [[0, '#4d82f1'], [1, '#2f6fed']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="url(#b6bg)"/>
<rect x="10" y="10" width="730" height="195" rx="14" fill="none" stroke="#8db0f6" stroke-width="1.5"/>
<rect x="40" y="26" width="22" height="14" rx="4" fill="#dbe6fd"/>
<rect x="40" y="44" width="22" height="14" rx="4" fill="#b9cdfa"/>
<rect x="40" y="62" width="22" height="14" rx="4" fill="#8db0f6"/>
<rect x="40" y="80" width="22" height="14" rx="4" fill="#4d82f1"/>
<rect x="40" y="98" width="22" height="14" rx="4" fill="#2f6fed"/>
<polygon points="84,55 102,75 84,95 66,75" fill="none" stroke="#2f6fed" stroke-width="3"/>
<polygon points="84,64 93,75 84,86 75,75" fill="url(#b6dg)"/>
<circle cx="84" cy="75" r="2.5" fill="#ffffff"/>
<g stroke="#8db0f6" stroke-width="1.5" opacity="0.8"><line x1="668" y1="14" x2="730" y2="14"/><line x1="668" y1="22" x2="730" y2="22"/><line x1="676" y1="10" x2="676" y2="26"/><line x1="688" y1="10" x2="688" y2="26"/><line x1="700" y1="10" x2="700" y2="26"/><line x1="712" y1="10" x2="712" y2="26"/><line x1="724" y1="10" x2="724" y2="26"/></g>
</svg>`,
    probe: [60, 105, BLUE],
  },

  // ========== 7 ⑦ 对照双泡式 · 自然花草（默认）——上红(反例) 下青(正例) ==========
  {
    name: 'bubble-compare', label: '气泡·对照双泡·反/正', type: '⑦ 对照双泡式', style: '自然花草',
    w: 750, h: 215,
    zone: [{ x0: 105, y0: 16, x1: 720, y1: 88 }, { x0: 105, y0: 122, x1: 720, y1: 194 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b7rbg', 0, 8, 0, 96, [[0, '#fdf3ef'], [0.5, '#faece4'], [1, '#f5e0d4']])}${gU('b7tbg', 0, 114, 0, 202, [[0, '#f2f8f6'], [0.5, '#e9f2ef'], [1, '#dcebe6']])}${gradLinear('b7lf', 0, 0, 1, 1, [[0, '#7fa6a2'], [0.55, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('b7lf2', 0, 0, 1, 1, [[0, '#f2c9a8'], [0.5, '#c96f4a'], [1, '#a04e2e']])}${gradRadial('b7rf', [[0.2, '#f5c9a8'], [0.55, '#c96f4a'], [1, '#a04e2e']])}</defs>
<rect x="10" y="8" width="730" height="88" rx="12" fill="url(#b7rbg)"/>
<rect x="10" y="8" width="730" height="88" rx="12" fill="none" stroke="#c96f4a" stroke-width="1.5"/>
<circle cx="55" cy="40" r="18" fill="#c96f4a"/>
<circle cx="49" cy="33" r="5" fill="#ffffff" opacity="0.7"/>
${leafX(36, 14, 60, 28, 10, 'b7lf2', 'b7lf2')}
${leafX(40, 86, 62, 78, 9, 'b7lf2', 'b7lf2')}
<polygon points="60,101.5 64.5,105 60,108.5 55.5,105" fill="#5f8d8a"/>
${curlS(84, 105, 18, 0.2, 2, '#c96f4a')}
<rect x="10" y="114" width="730" height="88" rx="12" fill="url(#b7tbg)"/>
<rect x="10" y="114" width="730" height="88" rx="12" fill="none" stroke="#5f8d8a" stroke-width="1.5"/>
<circle cx="55" cy="158" r="18" fill="#5f8d8a"/>
<circle cx="49" cy="151" r="5" fill="#ffffff" opacity="0.7"/>
${leafX(36, 120, 60, 134, 10, 'b7lf', 'b7lf')}
${leafX(40, 192, 62, 184, 9, 'b7lf', 'b7lf')}
</svg>`,
    probe: [55, 40, ORANGE],
  },

  // ========== 8 ① 左竖条浅底式 · 阳光校园风——球类标记（足球/篮球/网球） ==========
  {
    name: 'bubble-campus-ball', label: '气泡·左竖条·球类标记', type: '① 左竖条浅底式', style: '阳光校园风',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b8bg', 0, 10, 0, 205, [[0, '#fbfdf7'], [0.5, '#f5f9ee'], [1, '#eef5e2']])}${gradLinear('b8lf', 0, 0, 1, 1, [[0, '#8fbf82'], [0.5, '#6a994e'], [1, '#4e7d3c']])}${gradRadial('b8rf', [[0.2, '#f5c79b'], [0.5, '#e07b39'], [1, '#b85c22']])}${gradLinear('b8pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.5, '#e6f0e2'], [1, '#9fc48f']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="16" fill="url(#b8bg)"/>
<rect x="20" y="14" width="7" height="187" rx="3.5" fill="#5c8f4e"/>
<polygon points="27,13 42,16 27,19" fill="#e07b39"/>
<circle cx="27" cy="12" r="2.5" fill="#e07b39"/>
${leafX(40, 20, 62, 34, 10, 'b8lf', 'b8lf')}
<circle cx="56" cy="75" r="19" fill="#ffffff" stroke="#5c8f4e" stroke-width="2"/>
<polygon points="62,68 55.3,77.2 57.9,69.3 66.1,69.3 68.7,77.2" fill="#3d3d3d"/>
<path d="M62 68 L62 57 M55.3 77.2 L44.9 80.6 M57.9 69.3 L51.4 60.4 M66.1 69.3 L72.6 60.4 M68.7 77.2 L79.1 80.6" stroke="#b8b8b8" stroke-width="1.2" fill="none"/>
<circle cx="90" cy="56" r="11" fill="#e07b39"/>
<path d="M90 45 C 94 50 94 62 90 67 M83 52 C 90 55 94 55 101 52 M83 60 C 90 57 94 57 101 60" stroke="#8a3c14" stroke-width="1.5" fill="none"/>
<circle cx="90" cy="96" r="11" fill="#cdd93c"/>
<path d="M90 85 C 94 89 94 103 90 107 M81 92 C 87 90 93 90 99 92 M81 100 C 87 102 93 102 99 100" stroke="#7d8a24" stroke-width="1.5" fill="none"/>
${pearlX(30, 191, 7, 'b8pe')}
</svg>`,
    probe: [23, 75, CAMPUS_GREEN],
  },

  // ========== 9 ① 左竖条浅底式 · 国潮风——印章方块 + 回纹，朱红×沙金 ==========
  {
    name: 'bubble-guochao-seal', label: '气泡·左竖条·印章回纹', type: '① 左竖条浅底式', style: '国潮风',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gU('b9bg', 0, 10, 0, 205, [[0, '#fdf8ec'], [0.5, '#f8f0dc'], [1, '#f2e6c8']])}${gradLinear('b9gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.5, '#d4a24c'], [1, '#b8892f']])}${gradLinear('b9pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.5, '#f0ddb4'], [1, '#d4a24c']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="url(#b9bg)"/>
<rect x="18" y="18" width="714" height="179" rx="10" fill="none" stroke="#d4a24c" stroke-width="1.5"/>
<rect x="22" y="14" width="7" height="187" rx="3.5" fill="#9a281f"/>
<rect x="22" y="14" width="7" height="16" rx="3.5" fill="url(#b9gd)"/>
<rect x="22" y="185" width="7" height="16" rx="3.5" fill="url(#b9gd)"/>
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
${pearlX(88, 193, 7, 'b9pe')}
</svg>`,
    probe: [46, 90, CRIMSON],
  },

  // ========== 10 ② 整块实色式 · 科技风——实色深蓝 + 白色几何菱形/网格 ==========
  {
    name: 'bubble-tech-diamond', label: '气泡·实色深蓝·菱形网格', type: '② 整块实色式', style: '科技风',
    w: 750, h: 215, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 215">
<defs>${gradLinear('b10dg', 0, 0, 1, 1, [[0, '#7ba6ff'], [0.5, '#2f6fed'], [1, '#1a4fc4']])}${gradLinear('b10pg', 0, 0, 0, 1, [[0, '#ffffff'], [0.5, '#cfe0ff'], [1, '#5f8df0']])}${gradRadial('b10rg', [[0.2, '#8fb2ff'], [0.6, '#2f6fed'], [1, '#1a4fc4']])}</defs>
<rect x="10" y="10" width="730" height="195" rx="14" fill="#163a8f"/>
<rect x="18" y="18" width="714" height="179" rx="10" fill="none" stroke="#5f8df0" stroke-width="1.5" opacity="0.5"/>
<polygon points="58,50 82,75 58,100 34,75" fill="#ffffff"/>
<polygon points="58,62 70,75 58,88 46,75" fill="url(#b10dg)"/>
<circle cx="58" cy="75" r="2.5" fill="#ffffff"/>
<g stroke="#8fb2ff" stroke-width="1.2" opacity="0.8"><line x1="668" y1="16" x2="730" y2="16"/><line x1="668" y1="26" x2="730" y2="26"/><line x1="668" y1="36" x2="730" y2="36"/><line x1="678" y1="12" x2="678" y2="40"/><line x1="692" y1="12" x2="692" y2="40"/><line x1="706" y1="12" x2="706" y2="40"/><line x1="720" y1="12" x2="720" y2="40"/></g>
<polygon points="34,181 54,181 34,201" fill="none" stroke="#8fb2ff" stroke-width="2"/>
${pearlX(88, 185, 7, 'b10pg')}
</svg>`,
    probe: [30, 75, DEEPBLUE],
  },
]

// 校验：count=10 / dupName / name 以 bubble- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / type+style 存在
export function validateBubbleArts() {
  const names = bubbleArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = bubbleArts.filter((a) => {
    if (!/^bubble-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w > 0 && a.h > 0) || !/^<svg/.test(a.svg)) return true
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
    return false
  })
  return { count: bubbleArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
