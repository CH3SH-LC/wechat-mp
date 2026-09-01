// ============================================================
// 分割线（module-divider）美术资产 10 个 —— 类型 × 风格 模型（divider）
// 类型 = 8 种组合方式中的 7 种骨架（①②③④⑤⑥⑦，⑧留白分节为纯 CSS 无需整图）；
//       ①细线 ×1 / ②圆点 ×2 / ③短横条 ×2 / ④art花边 ×2 / ⑤色带 ×1 / ⑥双条 ×1 / ⑦章节组合 ×1
// 风格 = 内容填充（线体颜色 + 端点/中心装饰图案：花草/印章回纹/球类星星/几何端点/珍珠）
// 严格遵循 knowledge/module-divider.md §五 5.0 整图资产构建规范：
//   无文字型：画布 750×90、exempt zone（zone:null）、线体主轴 y45、装饰洁净带 y10..80、
//             装饰长在水平结构线上（线端/中心装饰位）、不做纵向堆叠
//   章节组合式（⑦）：画布 750×150、zone 设计高 ≥110px（y20..130）、宽 ≥650px（x50..700）、标题 ≤10 字
//   PNG ≤1MB：无背景底图（透明）、线体/色带纯色平面化、小面积装饰用 4-6 stop 渐变（体积安全）
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变 + 珍珠/叶脉/多层花瓣/回纹细节
// 显示尺寸铁律：端点/中心装饰设计 ≥35px（显示 ≥16px@0.4573）；线体视觉 ≥2.5px 显示（设计 ≥5.5px）
// 全部 probe 像素验证（落纯色部件：线体/圆点/短条/色带/印章实底）
// 洁净带设计：无文字型所有前景像素严格落在 y10..80；章节组合式 y10..80 必须为空、
//   装饰只出现在 bar 附近（y>80），zone 文字区（y20..80 ∩ x50..700）无任何形状
// 洁净带扫描器见 divider-scan.mjs（严格版：parts/mainRuns 精确比较，不放宽容差）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

const LINEGRAY = [208, 208, 208]   // #d0d0d0 细线
const SLATE = [58, 74, 107]        // #3a4a6b 极简短条主色
const TEAL = [95, 141, 138]        // #5f8d8a 自然花草主绿
const GOLD = [212, 162, 76]        // #d4a24c 色带/国潮金
const ORANGE = [232, 134, 63]      // #e8863f 品牌橙
const BLUE = [47, 111, 237]        // #2f6fed 科技冷蓝
const CAMPUS_GREEN = [11, 168, 155] // #0ba89b 校园薄荷绿
const CRIMSON = [154, 40, 31]      // #9a281f 国潮朱红

// userSpaceOnUse 线性渐变（小面积装饰用，垂直方向为主，符合 PNG 体积铁律）
const gU = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

// 显示缩放：375 壳内容宽 343px → 750 设计 → scale ≈ 0.4573（设计 ≥35px ⇒ 显示 ≥16px）
export const DIVIDER_SCALE = 343 / 750

export const dividerArts = [
  // ========== 1 ① 细线式 · 极简 —— 浅灰细线 + 两端菱形小装饰 ==========
  {
    name: 'divider-line', label: '分割线·细线·端点菱形', type: '① 细线式', style: '极简',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 1, mainRuns: 1, maxRuns: 2 },
    lineCheck: { axisY: 45, thickness: 6, span: [[0, 750]] },
    decorChecks: [{ cx: 55, cy: 45, he: 18 }, { cx: 695, cy: 45, he: 18 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gU('ln-dg', 0, 27, 0, 63, [[0, '#e0e0e0'], [0.5, '#c8c8c8'], [1, '#b0b0b0']])}</defs>
<rect x="0" y="42" width="750" height="6" fill="#d0d0d0"/>
<polygon points="55,27 73,45 55,63 37,45" fill="url(#ln-dg)" stroke="#a8a8a8" stroke-width="1.5"/>
<polygon points="695,27 713,45 695,63 677,45" fill="url(#ln-dg)" stroke="#a8a8a8" stroke-width="1.5"/>
<circle cx="55" cy="45" r="2.2" fill="#ffffff" opacity="0.75"/>
<circle cx="695" cy="45" r="2.2" fill="#ffffff" opacity="0.75"/>
</svg>`,
    probe: [200, 45, LINEGRAY],
  },

  // ========== 2 ② 圆点分隔式 · 自然花草 —— 三点 + 中点下垂双叶点缀（叶体不触外点/带内） ==========
  {
    name: 'divider-dots', label: '分割线·圆点·叶点缀', type: '② 圆点分隔式', style: '自然花草',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 3, mainRuns: 3, maxRuns: 6 }, // maxRuns 6：3 点 + 2 叶身 + leafX 侧脉尖（脉尖戳出叶面 ≤1.5px 设计，属叶脉细节）
    lineCheck: { axisY: 45, thickness: 14, span: [[347, 359], [369, 381], [391, 403]] },
    decorChecks: [{ cx: 360, cy: 64, he: 18.5 }, { cx: 390, cy: 64, he: 18.5 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gradLinear('dp-lf', 0, 0, 1, 1, [[0, '#aecbc0'], [0.3, '#8fb0ac'], [0.65, '#6f9c97'], [1, '#4a706d']])}</defs>
<circle cx="353" cy="45" r="7" fill="#5f8d8a"/>
<circle cx="375" cy="45" r="7" fill="#5f8d8a"/>
<circle cx="397" cy="45" r="7" fill="#5f8d8a"/>
${leafX(372, 50, 348, 78, 12, 'dp-lf', 'dp-lf')}
${leafX(378, 50, 402, 78, 12, 'dp-lf', 'dp-lf')}
</svg>`,
    probe: [353, 45, TEAL],
  },

  // ========== 3 ③ 短横条式 · 极简 —— 主色短条（圆头）+ 两端浅色圆点 ==========
  {
    name: 'divider-bar', label: '分割线·短横条·圆头', type: '③ 短横条式', style: '极简',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 1, mainRuns: 1, maxRuns: 2 },
    lineCheck: { axisY: 45, thickness: 6.5, span: [[288.5, 461.5]] },
    decorChecks: [{ cx: 278, cy: 45, he: 17.5 }, { cx: 472, cy: 45, he: 17.5 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gU('br-cg', 0, 27, 0, 63, [[0, '#a8b8d8'], [0.5, '#8fa0c0'], [1, '#6f81a8']])}</defs>
<rect x="287.5" y="41.75" width="175" height="6.5" rx="3.25" fill="#3a4a6b"/>
<circle cx="278" cy="45" r="17.5" fill="url(#br-cg)"/>
<circle cx="472" cy="45" r="17.5" fill="url(#br-cg)"/>
<circle cx="278" cy="45" r="4" fill="#ffffff" opacity="0.55"/>
<circle cx="472" cy="45" r="4" fill="#ffffff" opacity="0.55"/>
</svg>`,
    probe: [375, 45, SLATE],
  },

  // ========== 4 ④ art花边式 · 自然花草 —— 藤蔓枝（叶簇×4 双叶 + 花×3 + 珍珠×2 + 卷须×2） ==========
  {
    name: 'divider-vine', label: '分割线·花枝藤蔓', type: '④ art花边式', style: '自然花草',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 1, mainRuns: 1, maxRuns: 16 },
    lineCheck: { axisY: 45, thickness: 6, span: [[102, 648]] },
    decorChecks: [
      { cx: 225, cy: 45, he: 17.5 }, { cx: 375, cy: 45, he: 20 }, { cx: 525, cy: 45, he: 17.5 },
      { cx: 128, cy: 29, he: 26 }, { cx: 580, cy: 31, he: 26 },
    ],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gradRadial('vn-f1', [[0, '#f9e0cc'], [0.35, '#f2b98f'], [0.65, '#e88a5e'], [1, '#cf7040']])}${gradRadial('vn-f2', [[0, '#f5c9a8'], [0.4, '#e88a5e'], [0.7, '#c96a3e'], [1, '#a8502f']])}${gradLinear('vn-lf', 0, 0, 1, 1, [[0, '#aecbc0'], [0.3, '#8fb0ac'], [0.65, '#6f9c97'], [1, '#4a706d']])}${gradRadial('vn-pe', [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="100" y="42" width="550" height="6" fill="#5f8d8a"/>
${pearlX(104, 45, 8, 'vn-pe')}
${pearlX(646, 45, 8, 'vn-pe')}
${leafX(150, 43, 106, 14, 12, 'vn-lf', 'vn-lf')}
${leafX(150, 47, 106, 76, 12, 'vn-lf', 'vn-lf')}
${leafX(300, 43, 256, 14, 12, 'vn-lf', 'vn-lf')}
${leafX(300, 47, 256, 76, 12, 'vn-lf', 'vn-lf')}
${leafX(450, 43, 406, 14, 12, 'vn-lf', 'vn-lf')}
${leafX(450, 47, 406, 76, 12, 'vn-lf', 'vn-lf')}
${leafX(600, 43, 556, 14, 12, 'vn-lf', 'vn-lf')}
${leafX(600, 47, 556, 76, 12, 'vn-lf', 'vn-lf')}
${flower5X(225, 45, 17.5, 'vn-f1', 'vn-f2', '#9c4527')}
${flower5X(375, 45, 20, 'vn-f1', 'vn-f2', '#9c4527')}
${flower5X(525, 45, 17.5, 'vn-f1', 'vn-f2', '#9c4527')}
${curlS(115, 44, 12, -1.5, 3, '#4a706d')}
${curlS(635, 46, 12, 1.5, 3, '#4a706d')}
</svg>`,
    probe: [200, 45, TEAL],
  },

  // ========== 5 ⑤ 横条色带式 · 宣传 —— 金色全宽色带 + 两端珍珠 + 中心菱形 ==========
  {
    name: 'divider-ribbon', label: '分割线·金色色带·珍珠', type: '⑤ 横条色带式', style: '宣传',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 1, mainRuns: 1, maxRuns: 3 },
    lineCheck: { axisY: 45, thickness: 8, span: [[0, 750]] },
    decorChecks: [{ cx: 45, cy: 45, he: 17.5 }, { cx: 705, cy: 45, he: 17.5 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gradRadial('rb-pe', [[0, '#fff9ec'], [0.3, '#f7e3bd'], [0.6, '#e0bd77'], [1, '#b8892f']])}</defs>
<rect x="0" y="41" width="750" height="8" fill="#d4a24c"/>
<rect x="0" y="41" width="750" height="1.5" fill="#f5e0b4"/>
<rect x="0" y="47.5" width="750" height="1.5" fill="#b8892f" opacity="0.85"/>
${pearlX(45, 45, 17.5, 'rb-pe')}
${pearlX(705, 45, 17.5, 'rb-pe')}
<polygon points="375,37 383,45 375,53 367,45" fill="#fff6e0" opacity="0.9"/>
</svg>`,
    probe: [200, 45, GOLD],
  },

  // ========== 6 ⑥ 双条拼色式 · 品牌双色 —— 橙条 + 青条（留缝）+ 外端渐变大菱形 ==========
  {
    name: 'divider-dual', label: '分割线·双条拼色·橙青', type: '⑥ 双条拼色式', style: '品牌双色',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 2, mainRuns: 2, maxRuns: 4 },
    lineCheck: { axisY: 45, thickness: 9, span: [[262, 366], [384, 487]] },
    decorChecks: [{ cx: 244, cy: 45, he: 20 }, { cx: 506, cy: 45, he: 20 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gU('du-o', 0, 25, 0, 65, [[0, '#f5b48a'], [0.4, '#e8863f'], [0.7, '#d06f2c'], [1, '#b85c22']])}${gU('du-t', 0, 25, 0, 65, [[0, '#8fd8d2'], [0.4, '#2fa8a0'], [0.7, '#238a84'], [1, '#1a6f6a']])}</defs>
<rect x="261.25" y="40.5" width="105" height="9" rx="4.5" fill="#e8863f"/>
<rect x="383.75" y="40.5" width="105" height="9" rx="4.5" fill="#2fa8a0"/>
<polygon points="244,25 264,45 244,65 224,45" fill="url(#du-o)"/>
<polygon points="506,25 526,45 506,65 486,45" fill="url(#du-t)"/>
</svg>`,
    probe: [310, 45, ORANGE],
  },

  // ========== 7 ⑦ 章节组合式 · 自然花草 —— 标题 zone + 下方短横条（两端花/下叶/中心珍珠） ==========
  {
    name: 'divider-section', label: '分割线·章节组合', type: '⑦ 章节组合式', style: '自然花草',
    w: 750, h: 150,
    zone: { x0: 50, y0: 20, x1: 700, y1: 130 },
    band: { mode: 'empty', y0: 10, y1: 80, parts: 1, mainRuns: 1, maxRuns: 12 },
    lineCheck: { axisY: 104, thickness: 7, span: [[311, 439]] },
    decorChecks: [],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 150">
<defs>${gradRadial('se-f1', [[0, '#f9e0cc'], [0.35, '#f2b98f'], [0.65, '#e88a5e'], [1, '#cf7040']])}${gradRadial('se-f2', [[0, '#f5c9a8'], [0.4, '#e88a5e'], [0.7, '#c96a3e'], [1, '#a8502f']])}${gradLinear('se-lf', 0, 0, 1, 1, [[0, '#aecbc0'], [0.3, '#8fb0ac'], [0.65, '#6f9c97'], [1, '#4a706d']])}${gradRadial('se-pe', [[0, '#ffffff'], [0.3, '#eef5f3'], [0.65, '#b9d0cc'], [1, '#6f9c97']])}</defs>
<rect x="310" y="101" width="130" height="7" rx="3.5" fill="#5f8d8a"/>
${flower5X(300, 104, 11, 'se-f1', 'se-f2', '#9c4527')}
${flower5X(450, 104, 11, 'se-f1', 'se-f2', '#9c4527')}
${leafX(335, 105, 318, 128, 9, 'se-lf', 'se-lf')}
${leafX(405, 105, 422, 128, 9, 'se-lf', 'se-lf')}
${pearlX(375, 104, 6, 'se-pe')}
</svg>`,
    probe: [360, 104, TEAL],
  },

  // ========== 8 ④ art花边式 · 国潮风 —— 印章（回纹格）+ 双金条 + 实心金菱形端饰，朱红×沙金 ==========
  {
    name: 'divider-guochao', label: '分割线·国潮印章回纹', type: '④ art花边式', style: '国潮风',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 3, mainRuns: 3, maxRuns: 3 },
    lineCheck: { axisY: 45, thickness: 6, span: [[233, 337], [413, 517]] },
    decorChecks: [{ cx: 219, cy: 45, he: 17.5 }, { cx: 375, cy: 45, he: 18 }, { cx: 531, cy: 45, he: 17.5 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gU('gc-g', 0, 42, 0, 48, [[0, '#e8c878'], [0.4, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}</defs>
<rect x="232" y="42" width="106" height="6" fill="url(#gc-g)"/>
<rect x="412" y="42" width="106" height="6" fill="url(#gc-g)"/>
<rect x="357" y="27" width="36" height="36" fill="#9a281f"/>
<rect x="357" y="27" width="36" height="36" fill="none" stroke="#d4a24c" stroke-width="2"/>
<rect x="365" y="35" width="20" height="20" fill="none" stroke="#d4a24c" stroke-width="1.5"/>
<line x1="365" y1="35" x2="385" y2="55" stroke="#d4a24c" stroke-width="1.2" opacity="0.85"/>
<line x1="385" y1="35" x2="365" y2="55" stroke="#d4a24c" stroke-width="1.2" opacity="0.85"/>
<polygon points="375,42 378,45 375,48 372,45" fill="#d4a24c"/>
<polygon points="219,27.5 236.5,45 219,62.5 201.5,45" fill="url(#gc-g)" stroke="#b8892f" stroke-width="1.5"/>
<polygon points="531,27.5 548.5,45 531,62.5 513.5,45" fill="url(#gc-g)" stroke="#b8892f" stroke-width="1.5"/>
<polygon points="219,41 223,45 219,49 215,45" fill="#9a281f"/>
<polygon points="531,41 535,45 531,49 527,45" fill="#9a281f"/>
</svg>`,
    probe: [375, 32, CRIMSON],
  },

  // ========== 9 ② 圆点分隔式 · 校园风 —— 三点 + 篮球/网球/星星（星与右点重叠合并） ==========
  {
    name: 'divider-campus', label: '分割线·校园球类星星', type: '② 圆点分隔式', style: '校园风',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 3, mainRuns: 3, maxRuns: 5 }, // maxRuns 5：3 点 + 3 装饰，圆点顶/底尖点与装饰在部分行并排（真实结构，≤0.5px 设计间隙）
    lineCheck: { axisY: 45, thickness: 14, span: [[347, 359], [369, 381], [391, 403]] },
    decorChecks: [{ cx: 331, cy: 45, he: 17.5 }, { cx: 375, cy: 62, he: 17.5 }, { cx: 414, cy: 45, he: 20 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gradRadial('cm-pe', [[0, '#ffffff'], [0.3, '#d9f6f2'], [0.65, '#7fd9cf'], [1, '#0ba89b']])}${gradRadial('cm-ball', [[0, '#f8c08a'], [0.4, '#ec954f'], [0.7, '#e07b39'], [1, '#c2621f']])}${gradRadial('cm-tennis', [[0, '#e8ef5a'], [0.35, '#d3de45'], [0.7, '#b9c62f'], [1, '#93a11f']])}${gradRadial('cm-star', [[0, '#ffe9a8'], [0.35, '#f4cf6e'], [0.7, '#e8b64c'], [1, '#c9902e']])}</defs>
<circle cx="353" cy="45" r="7" fill="#0ba89b"/>
<circle cx="397" cy="45" r="7" fill="#0ba89b"/>
${pearlX(375, 45, 7, 'cm-pe')}
<circle cx="331" cy="45" r="17.5" fill="url(#cm-ball)"/>
<path d="M331 27.5 L331 62.5" stroke="#8a4a1f" stroke-width="1.6" fill="none" opacity="0.85"/>
<path d="M313.5 45 C 320 51.5 342 51.5 348.5 45" stroke="#8a4a1f" stroke-width="1.6" fill="none" opacity="0.85"/>
<circle cx="375" cy="62" r="17.5" fill="url(#cm-tennis)"/>
<path d="M375 45.5 C 368.5 53 368.5 71 375 78.5" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.9"/>
<path d="M357.5 62 C 365.5 58 384.5 58 392.5 62" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.9"/>
<polygon points="414,25 422,37 434,45 422,53 414,65 406,53 394,45 406,37" fill="url(#cm-star)"/>
<circle cx="414" cy="38" r="3" fill="#ffffff" opacity="0.65"/>
</svg>`,
    probe: [353, 45, CAMPUS_GREEN],
  },

  // ========== 10 ③ 短横条式 · 科技风 —— 冷蓝短条 + 渐变几何菱形端点 + 中心亮菱形 ==========
  {
    name: 'divider-tech', label: '分割线·科技几何端点', type: '③ 短横条式', style: '科技风',
    w: 750, h: 90, zone: null,
    band: { mode: 'contain', y0: 10, y1: 80, parts: 1, mainRuns: 1, maxRuns: 3 },
    lineCheck: { axisY: 45, thickness: 6.5, span: [[288.5, 461.5]] },
    decorChecks: [{ cx: 270, cy: 45, he: 17.5 }, { cx: 480, cy: 45, he: 17.5 }],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gU('tc-dg', 0, 27.5, 0, 62.5, [[0, '#a8c4ff'], [0.35, '#6f9bff'], [0.7, '#3f78ef'], [1, '#1a4fc4']])}</defs>
<rect x="287.5" y="41.75" width="175" height="6.5" rx="3.25" fill="#2f6fed" stroke="#9fb8f5" stroke-width="1"/>
<polygon points="270,27.5 287.5,45 270,62.5 252.5,45" fill="url(#tc-dg)"/>
<polygon points="480,27.5 497.5,45 480,62.5 462.5,45" fill="url(#tc-dg)"/>
<circle cx="270" cy="45" r="3.5" fill="#ffffff" opacity="0.85"/>
<circle cx="480" cy="45" r="3.5" fill="#ffffff" opacity="0.85"/>
<polygon points="375,37 383,45 375,53 367,45" fill="#9fb8f5" opacity="0.9"/>
</svg>`,
    probe: [400, 45, BLUE],
  },
]

// 校验：count=10 / dupName / name 以 divider- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone（无文字型 null，章节组合式 ≥650×110）/
// band（mode/parts/mainRuns/maxRuns/y0/y1）/ lineCheck（axisY/thickness/span）/ decorChecks
export function validateDividerArts() {
  const names = dividerArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = dividerArts.filter((a) => {
    if (!/^divider-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 750 && (a.h === 90 || a.h === 150)) || !/^<svg/.test(a.svg)) return true
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
    // zone 规范：无文字型 750×90 → zone 必须为 null；章节组合式 750×150 → zone 容量 ≥650×110
    if (a.h === 90 && a.zone !== null) return true
    if (a.h === 150) {
      if (!a.zone || !(a.zone.x0 < a.zone.x1 && a.zone.y0 < a.zone.y1)) return true
      if (a.zone.x1 - a.zone.x0 < 650 || a.zone.y1 - a.zone.y0 < 110) return true
    }
    // band 洁净带声明
    const b = a.band
    if (!b || !b.mode || !['contain', 'empty'].includes(b.mode)) return true
    if (!(typeof b.y0 === 'number' && typeof b.y1 === 'number' && b.y0 < b.y1)) return true
    if (!(typeof b.parts === 'number' && typeof b.mainRuns === 'number' && typeof b.maxRuns === 'number')) return true
    // lineCheck / decorChecks
    const lc = a.lineCheck
    if (!lc || !(typeof lc.axisY === 'number') || !(typeof lc.thickness === 'number') || !Array.isArray(lc.span) || !lc.span.length) return true
    if (lc.thickness * DIVIDER_SCALE < 2.5) return true // 线体显示 ≥2.5px
    if (!Array.isArray(a.decorChecks)) return true
    for (const dc of a.decorChecks) {
      if (!(typeof dc.cx === 'number' && typeof dc.cy === 'number' && typeof dc.he === 'number')) return true
      if (dc.he * 2 * DIVIDER_SCALE < 16) return true // 装饰显示 ≥16px
    }
    return false
  })
  return { count: dividerArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
