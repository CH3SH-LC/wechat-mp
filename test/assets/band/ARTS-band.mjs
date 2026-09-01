// ============================================================
// 花纹色带（module-band）美术资产 10 个 —— 类型 × 风格 模型（band）
// 类型 = 8 种组合方式（骨架模板）；风格 = 内容填充（花纹单元图案与色板）
// 整图资产 + 中央嵌字模式：SVG 画布模拟色带容器，花纹装饰区贴顶（y≤40）贴底（y≥120），
//   中央 90..660 × 45..115 留作文字衬底层（zone，设计高 70px = 显示 ≈32px）
// 严格遵循 knowledge/module-band.md §五 5.0 整图资产构建规范：
//   画布 750×160（375px 壳显示 343×73px，缩放比 ≈0.457）/ 容器圆角矩形 y10 h140 /
//   大面积背景渐变一律垂直 + gradientUnits="userSpaceOnUse" 绝对坐标（PNG ≤1MB 铁律）/
//   zone 设计高 ≥70px（y 45..115）、设计宽 ≥550px（x 90..660）/
//   zone 洁净设计：花纹装饰一律裁进 顶部带(10..40)/底部带(120..150) clip，
//   中部侧饰只放在 x<90 / x>660（扫描区外），保证相邻像素突变扫描 = 0
// v5 精细度：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变 + 珍珠/叶脉/多层花瓣/球类缝线
// 全部 probe 像素验证（选纯色部件：斜纹实条/实心圆点/棋盘实格/竖条实段/圆环花心/彩条实段/印章实块/星芒实心/球类圆点/交叉斜纹实条）
// 颜色铁律：每资产 ≤2 主色（各带浅深档）；分段彩条式按类型语义用橙青金三段
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from '../ARTS-fine-utils.mjs'

// 通用文字区（750×160）：x 90..660，y 45..115（设计 570×70，显示 ≈261×32）
const ZONE = { x0: 90, y0: 45, x1: 660, y1: 115 }

// userSpaceOnUse 垂直线性渐变（大面积背景一律垂直，符合 PNG 体积铁律）
const gU = (id, y1, y2, stops) =>
  `<linearGradient id="${id}" x1="0" y1="${y1}" x2="0" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`

// 容器圆角裁切（防花纹溢出圆角外）
const clipAll = `<clipPath id="bandclip"><rect x="10" y="10" width="730" height="140" rx="12"/></clipPath>`
// 顶部带 y10..40 / 底部带 y120..150（花纹只允许落在这里；嵌套 clip 保 zone 洁净）
const clipTop = (id) => `<clipPath id="${id}"><rect x="10" y="10" width="730" height="30"/></clipPath>`
const clipBottom = (id) => `<clipPath id="${id}"><rect x="10" y="120" width="730" height="30"/></clipPath>`

export const bandArts = [
  // ========== 1 ① 斜纹式 · 自然花草——浅绿细斜纹 + 草叶点缀 ==========
  {
    name: 'band-stripe', label: '花纹色带·斜纹式·自然花草（浅绿细斜纹+草叶）', type: '① 斜纹式', style: '自然花草',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b1bg', 10, 150, [[0, '#f9fcf4'], [0.3, '#f2f8eb'], [0.65, '#eaf3e1'], [1, '#e0eed4']])}${gradLinear('b1lf', 0, 0, 1, 1, [[0, '#a3cba0'], [0.4, '#84b57f'], [0.7, '#6f9c7a'], [1, '#4f7a55']])}${gradRadial('b1rf', [[0, '#dcebd6'], [0.4, '#a3cba0'], [0.7, '#6f9c7a'], [1, '#4a734e']])}${gradLinear('b1pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eef6e8'], [0.65, '#c6ddc2'], [1, '#6f9c7a']])}${clipAll}${clipTop('b1top')}${clipBottom('b1bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b1bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#6f9c7a" stroke-width="1.5" opacity="0.35"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b1top)">
    <g transform="rotate(45 375 25)">
      <rect x="-160" y="19" width="1070" height="12" fill="#a9cba2"/>
      <rect x="-160" y="-29" width="1070" height="12" fill="#a9cba2"/>
      <rect x="-160" y="67" width="1070" height="12" fill="#a9cba2"/>
    </g>
    ${leafX(60, 12, 94, 32, 10, 'b1lf', 'b1lf')}
    ${leafX(668, 32, 634, 12, 10, 'b1lf', 'b1lf')}
    ${flower5X(140, 30, 9, 'b1rf', 'b1rf', '#4f7a55')}
  </g>
  <g clip-path="url(#b1bot)">
    <g transform="rotate(45 375 135)">
      <rect x="-160" y="129" width="1070" height="12" fill="#a9cba2"/>
      <rect x="-160" y="81" width="1070" height="12" fill="#a9cba2"/>
      <rect x="-160" y="177" width="1070" height="12" fill="#a9cba2"/>
    </g>
    ${leafX(640, 148, 606, 126, 10, 'b1lf', 'b1lf')}
    ${pearlX(96, 133, 8, 'b1pe')}
    ${curlS(700, 144, 22, 0.6, 2, '#6f9c7a')}
  </g>
</g>
</svg>`,
    probe: [375, 25, [169, 203, 162]], // #a9cba2 斜纹实条（旋转中心，远离叶/花）
  },

  // ========== 2 ② 波点式 · 自然花草——浅青圆点 + 花心 ==========
  {
    name: 'band-dots', label: '花纹色带·波点式·自然花草（浅青圆点+花心）', type: '② 波点式', style: '自然花草',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b2bg', 10, 150, [[0, '#f4faf8'], [0.3, '#eaf4f1'], [0.65, '#e0eeea'], [1, '#d5e7e2']])}${gradLinear('b2lf', 0, 0, 1, 1, [[0, '#86beb2'], [0.4, '#6fb3a8'], [0.7, '#54988d'], [1, '#3f7f76']])}${gradRadial('b2rf', [[0, '#d2ebe4'], [0.4, '#86beb2'], [0.7, '#54988d'], [1, '#3f7f76']])}${gradLinear('b2pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#e9f5f1'], [0.65, '#bfe0d8'], [1, '#54988d']])}${clipAll}${clipTop('b2top')}${clipBottom('b2bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b2bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#3f7f76" stroke-width="1.5" opacity="0.3"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b2top)">
    <circle cx="70" cy="26" r="12" fill="#6fb3a8"/>
    <circle cx="210" cy="26" r="12" fill="#6fb3a8"/>
    <circle cx="350" cy="26" r="12" fill="#6fb3a8"/>
    <circle cx="350" cy="26" r="7.5" fill="#cde8e0"/>
    <circle cx="350" cy="26" r="3" fill="#3f7f76"/>
    <circle cx="490" cy="26" r="12" fill="#6fb3a8"/>
    <circle cx="630" cy="26" r="12" fill="#6fb3a8"/>
    ${leafX(90, 34, 120, 16, 9, 'b2lf', 'b2lf')}
    ${flower5X(700, 28, 9, 'b2rf', 'b2rf', '#3f7f76')}
  </g>
  <g clip-path="url(#b2bot)">
    <circle cx="160" cy="134" r="9" fill="#6fb3a8"/>
    <circle cx="330" cy="134" r="9" fill="#6fb3a8"/>
    <circle cx="500" cy="134" r="9" fill="#6fb3a8"/>
    <circle cx="640" cy="134" r="9" fill="#6fb3a8"/>
    <circle cx="640" cy="134" r="5.5" fill="#cde8e0"/>
    <circle cx="640" cy="134" r="2.5" fill="#3f7f76"/>
    ${leafX(600, 148, 568, 128, 9, 'b2lf', 'b2lf')}
    ${pearlX(96, 134, 8, 'b2pe')}
  </g>
</g>
</svg>`,
    probe: [210, 26, [111, 179, 168]], // #6fb3a8 实心圆点中心（无花心点）
  },

  // ========== 3 ③ 棋盘式 · 极简——灰白棋盘 + 角饰 ==========
  {
    name: 'band-checker', label: '花纹色带·棋盘式·极简（灰白棋盘+角饰）', type: '③ 棋盘式', style: '极简',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b3bg', 10, 150, [[0, '#fcfdfe'], [0.5, '#f5f7f9'], [1, '#edf0f3']])}${gradLinear('b3gd', 0, 0, 0, 1, [[0, '#c8cdd4'], [0.4, '#aeb4bd'], [0.7, '#8a919c'], [1, '#5a616c']])}${clipAll}${clipTop('b3top')}${clipBottom('b3bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b3bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#aeb4bd" stroke-width="1.5" opacity="0.5"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b3top)">
    <rect x="18" y="13" width="22" height="22" fill="#aeb4bd"/><rect x="106" y="13" width="22" height="22" fill="#aeb4bd"/>
    <rect x="194" y="13" width="22" height="22" fill="#aeb4bd"/><rect x="282" y="13" width="22" height="22" fill="#aeb4bd"/>
    <rect x="370" y="13" width="22" height="22" fill="#aeb4bd"/><rect x="458" y="13" width="22" height="22" fill="#aeb4bd"/>
    <rect x="546" y="13" width="22" height="22" fill="#aeb4bd"/><rect x="634" y="13" width="22" height="22" fill="#aeb4bd"/>
  </g>
  <g clip-path="url(#b3bot)">
    <rect x="40" y="125" width="22" height="22" fill="#aeb4bd"/><rect x="128" y="125" width="22" height="22" fill="#aeb4bd"/>
    <rect x="216" y="125" width="22" height="22" fill="#aeb4bd"/><rect x="304" y="125" width="22" height="22" fill="#aeb4bd"/>
    <rect x="392" y="125" width="22" height="22" fill="#aeb4bd"/><rect x="480" y="125" width="22" height="22" fill="#aeb4bd"/>
    <rect x="568" y="125" width="22" height="22" fill="#aeb4bd"/><rect x="656" y="125" width="22" height="22" fill="#aeb4bd"/>
  </g>
  <rect x="14" y="50" width="5" height="56" fill="#5a616c"/>
  <rect x="14" y="50" width="20" height="4" fill="#5a616c"/>
  <rect x="14" y="102" width="20" height="4" fill="#5a616c"/>
  <rect x="24" y="62" width="4" height="32" fill="url(#b3gd)"/>
  <rect x="731" y="50" width="5" height="56" fill="#5a616c"/>
  <rect x="716" y="50" width="20" height="4" fill="#5a616c"/>
  <rect x="716" y="102" width="20" height="4" fill="#5a616c"/>
  <rect x="722" y="62" width="4" height="32" fill="url(#b3gd)"/>
  <rect x="716" y="12" width="8" height="8" fill="#5a616c"/>
</g>
</svg>`,
    probe: [29, 24, [174, 180, 189]], // #aeb4bd 棋盘实格中心
  },

  // ========== 4 ④ 条纹式 · 极简——浅蓝竖条 ==========
  {
    name: 'band-lines', label: '花纹色带·条纹式·极简（浅蓝竖条）', type: '④ 条纹式', style: '极简',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b4bg', 10, 150, [[0, '#f6f9fe'], [0.3, '#eef4fc'], [0.65, '#e6effa'], [1, '#dce8f8']])}${gradLinear('b4gd', 0, 0, 0, 1, [[0, '#a9c3ec'], [0.4, '#7fa3dd'], [0.7, '#5a8ccf'], [1, '#3f6ba8']])}${clipAll}${clipTop('b4top')}${clipBottom('b4bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b4bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#7fa3dd" stroke-width="1.5" opacity="0.35"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b4top)">
    <rect x="24" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="68" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="112" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="156" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="200" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="244" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="288" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="332" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="376" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="420" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="464" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="508" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="552" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="596" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="640" y="10" width="22" height="30" fill="#7fa3dd"/><rect x="684" y="10" width="22" height="30" fill="#7fa3dd"/>
    <rect x="72" y="12" width="8" height="5" fill="#3f6ba8"/><rect x="376" y="12" width="8" height="5" fill="#3f6ba8"/>
    <rect x="508" y="12" width="8" height="5" fill="#3f6ba8"/>
  </g>
  <g clip-path="url(#b4bot)">
    <rect x="44" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="88" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="132" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="176" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="220" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="264" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="308" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="352" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="396" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="440" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="484" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="528" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="572" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="616" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="660" y="120" width="22" height="30" fill="#7fa3dd"/><rect x="704" y="120" width="22" height="30" fill="#7fa3dd"/>
    <rect x="132" y="137" width="8" height="5" fill="#3f6ba8"/><rect x="440" y="137" width="8" height="5" fill="#3f6ba8"/>
  </g>
  <rect x="18" y="56" width="46" height="5" fill="#3f6ba8"/>
  <rect x="18" y="68" width="30" height="5" fill="#7fa3dd"/>
  <rect x="686" y="56" width="46" height="5" fill="#3f6ba8"/>
  <rect x="702" y="68" width="30" height="5" fill="#7fa3dd"/>
  <rect x="704" y="80" width="26" height="4" fill="url(#b4gd)"/>
</g>
</svg>`,
    probe: [32, 25, [127, 163, 221]], // #7fa3dd 竖条实段中心
  },

  // ========== 5 ⑤ 圆环式 · 自然花草——鱼鳞圆环 + 叶 ==========
  {
    name: 'band-rings', label: '花纹色带·圆环式·自然花草（鱼鳞圆环+叶）', type: '⑤ 圆环式', style: '自然花草',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b5bg', 10, 150, [[0, '#f4faf8'], [0.3, '#eaf3f0'], [0.65, '#e0ece8'], [1, '#d5e5e0']])}${gradLinear('b5lf', 0, 0, 1, 1, [[0, '#9cc4b8'], [0.4, '#7fb0a2'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradRadial('b5rf', [[0, '#d2e8e0'], [0.4, '#9cc4b8'], [0.7, '#5f8d8a'], [1, '#3f6b68']])}${gradLinear('b5pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#eaf5f0'], [0.65, '#bfdcd2'], [1, '#5f8d8a']])}${clipAll}${clipTop('b5top')}${clipBottom('b5bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b5bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#5f8d8a" stroke-width="1.5" opacity="0.35"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b5top)">
    <circle cx="100" cy="26" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="240" cy="26" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="240" cy="26" r="5" fill="#3f6b68"/>
    <circle cx="380" cy="26" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="520" cy="26" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="520" cy="26" r="5" fill="#3f6b68"/>
    <circle cx="660" cy="26" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="660" cy="26" r="5" fill="#3f6b68"/>
    ${leafX(60, 30, 88, 16, 9, 'b5lf', 'b5lf')}
  </g>
  <g clip-path="url(#b5bot)">
    <circle cx="170" cy="134" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="170" cy="134" r="5" fill="#3f6b68"/>
    <circle cx="310" cy="134" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="450" cy="134" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    <circle cx="450" cy="134" r="5" fill="#3f6b68"/>
    <circle cx="590" cy="134" r="13" fill="none" stroke="#5f8d8a" stroke-width="3"/>
    ${leafX(606, 148, 634, 132, 8, 'b5lf', 'b5lf')}
    ${pearlX(700, 132, 7, 'b5pe')}
  </g>
</g>
</svg>`,
    probe: [240, 26, [63, 107, 104]], // #3f6b68 圆环内花心实点（r5，与环内缘 11.5 不重叠）
  },

  // ========== 6 ⑥ 分段彩条式 · 品牌多色——橙青金三段 ==========
  {
    name: 'band-colorbar', label: '花纹色带·分段彩条式·品牌多色（橙青金三段）', type: '⑥ 分段彩条式', style: '品牌多色',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b6bg', 10, 150, [[0, '#fcfdfe'], [0.3, '#f6f9fb'], [0.65, '#f0f4f8'], [1, '#e8eef4']])}${gradLinear('b6dg', 0, 0, 0, 1, [[0, '#f2b98c'], [0.4, '#e07b39'], [0.7, '#c96422'], [1, '#a84c14']])}${gradLinear('b6dg2', 0, 0, 0, 1, [[0, '#ecd48a'], [0.4, '#c9a227'], [0.7, '#a8861d'], [1, '#8a6b14']])}${gradLinear('b6dg3', 0, 0, 0, 1, [[0, '#8fd0c8'], [0.4, '#3f9e9e'], [0.7, '#2f7f80'], [1, '#1f6160']])}${clipAll}${clipTop('b6top')}${clipBottom('b6bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b6bg)"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b6top)">
    <rect x="10" y="10" width="238" height="30" fill="#e07b39"/>
    <rect x="254" y="10" width="238" height="30" fill="#3f9e9e"/>
    <rect x="498" y="10" width="238" height="30" fill="#c9a227"/>
    <rect x="22" y="14" width="26" height="12" rx="3" fill="url(#b6dg)"/>
  </g>
  <g clip-path="url(#b6bot)">
    <rect x="10" y="120" width="238" height="30" fill="#c9a227"/>
    <rect x="254" y="120" width="238" height="30" fill="#e07b39"/>
    <rect x="498" y="120" width="238" height="30" fill="#3f9e9e"/>
    <rect x="690" y="128" width="26" height="12" rx="3" fill="url(#b6dg3)"/>
  </g>
</g>
</svg>`,
    probe: [130, 25, [224, 123, 57]], // #e07b39 橙色段实心中心（远离分段间隙与渐变角片）
  },

  // ========== 7 ⑦ 大理石式 · 国潮——米底 + 朱红沙金大色斑 ==========
  {
    name: 'band-marble', label: '花纹色带·大理石式·国潮（米底+朱红沙金色斑）', type: '⑦ 大理石式', style: '国潮',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b7bg', 10, 150, [[0, '#fdf9ef'], [0.3, '#f9f1e0'], [0.65, '#f4e9d2'], [1, '#eedfc2']])}${gradLinear('b7gd', 0, 0, 0, 1, [[0, '#e8c878'], [0.4, '#d9ab55'], [0.7, '#c99a3d'], [1, '#b8892f']])}${clipAll}${clipTop('b7top')}${clipBottom('b7bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b7bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#c9a227" stroke-width="1.5" opacity="0.35"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b7top)">
    <ellipse cx="200" cy="24" rx="150" ry="16" fill="rgba(154,40,31,0.12)"/>
    <ellipse cx="520" cy="27" rx="170" ry="14" fill="rgba(201,162,39,0.12)"/>
    <ellipse cx="640" cy="18" rx="120" ry="11" fill="rgba(154,40,31,0.08)"/>
  </g>
  <g clip-path="url(#b7bot)">
    <ellipse cx="180" cy="135" rx="160" ry="15" fill="rgba(201,162,39,0.12)"/>
    <ellipse cx="480" cy="139" rx="180" ry="14" fill="rgba(154,40,31,0.12)"/>
    <ellipse cx="690" cy="131" rx="120" ry="11" fill="rgba(201,162,39,0.10)"/>
  </g>
  <rect x="26" y="14" width="28" height="28" fill="#9a281f"/>
  <rect x="34" y="22" width="12" height="12" fill="none" stroke="#f5ecd9" stroke-width="2"/>
  <path d="M26 14 L34 22 M54 14 L46 22 M26 42 L34 34 M54 42 L46 34" stroke="#f5ecd9" stroke-width="1.5" fill="none"/>
  <rect x="660" y="12" width="20" height="20" fill="none" stroke="#c9a227" stroke-width="2"/>
  <rect x="666" y="18" width="8" height="8" fill="none" stroke="#c9a227" stroke-width="1.5"/>
  <rect x="60" y="122" width="22" height="22" fill="#c9a227"/>
  <rect x="66" y="128" width="10" height="10" fill="none" stroke="#fdf6e3" stroke-width="1.5"/>
  <rect x="676" y="128" width="18" height="18" fill="none" stroke="#9a281f" stroke-width="2"/>
  <rect x="682" y="134" width="6" height="6" fill="#9a281f"/>
  <rect x="700" y="120" width="24" height="5" fill="url(#b7gd)"/>
</g>
</svg>`,
    probe: [40, 28, [154, 40, 31]], // #9a281f 印章实块中心（回纹内框 stroke 不覆盖中心）
  },

  // ========== 8 ⑧ 星芒放射式 · 宣传——橙星芒十字 ==========
  {
    name: 'band-starburst', label: '花纹色带·星芒放射式·宣传（橙星芒十字）', type: '⑧ 星芒放射式', style: '宣传',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b8bg', 10, 150, [[0, '#fff7ef'], [0.3, '#fdf0e0'], [0.65, '#fae8d2'], [1, '#f6dfc2']])}${gradRadial('b8rf', [[0, '#f8d9b8'], [0.4, '#efb37f'], [0.7, '#e07b39'], [1, '#b85c22']])}${clipAll}${clipTop('b8top')}${clipBottom('b8bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b8bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#e07b39" stroke-width="1.5" opacity="0.4"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b8top)">
    <g transform="rotate(0 60 25)"><rect x="42" y="21" width="36" height="8" fill="#e07b39"/></g>
    <g transform="rotate(45 60 25)"><rect x="42" y="21" width="36" height="8" fill="#e07b39"/></g>
    <g transform="rotate(90 60 25)"><rect x="42" y="21" width="36" height="8" fill="#e07b39"/></g>
    <g transform="rotate(135 60 25)"><rect x="42" y="21" width="36" height="8" fill="#e07b39"/></g>
    <circle cx="60" cy="25" r="7" fill="#b85c22"/>
    <circle cx="57" cy="22" r="2.5" fill="#ffffff" opacity="0.7"/>
    <path d="M700 10 L702 14 L706 16 L702 18 L700 22 L698 18 L694 16 L698 14 Z" fill="#e07b39"/>
    <rect x="557" y="17" width="6" height="6" transform="rotate(45 560 20)" fill="#e07b39"/>
    <rect x="617" y="27" width="6" height="6" transform="rotate(45 620 30)" fill="#e07b39"/>
  </g>
  <g clip-path="url(#b8bot)">
    <g transform="rotate(0 690 135)"><rect x="672" y="131" width="36" height="8" fill="#e07b39"/></g>
    <g transform="rotate(45 690 135)"><rect x="672" y="131" width="36" height="8" fill="#e07b39"/></g>
    <g transform="rotate(90 690 135)"><rect x="672" y="131" width="36" height="8" fill="#e07b39"/></g>
    <g transform="rotate(135 690 135)"><rect x="672" y="131" width="36" height="8" fill="#e07b39"/></g>
    <circle cx="690" cy="135" r="6" fill="#b85c22"/>
    <circle cx="90" cy="134" r="4" fill="#e07b39"/>
    <circle cx="140" cy="138" r="2.5" fill="#b85c22"/>
  </g>
</g>
</svg>`,
    probe: [60, 25, [184, 92, 34]], // #b85c22 星芒实心中心（射线之后绘制覆盖）
  },

  // ========== 9 ② 波点式 · 校园风——迷你球类/星星圆点 ==========
  {
    name: 'band-campus', label: '花纹色带·波点式·校园风（迷你球类/星星圆点）', type: '② 波点式', style: '校园风',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gU('b9bg', 10, 150, [[0, '#fbfdf6'], [0.3, '#f5f9ec'], [0.65, '#eef6e2'], [1, '#e6f1d6']])}${gradLinear('b9lf', 0, 0, 1, 1, [[0, '#9fc48f'], [0.4, '#7fb46c'], [0.7, '#5c8f4e'], [1, '#4a7340']])}${gradRadial('b9rf', [[0, '#f8d3ae'], [0.4, '#ec954f'], [0.7, '#e07b39'], [1, '#b85c22']])}${gradLinear('b9pe', 0, 0, 0, 1, [[0, '#ffffff'], [0.3, '#f0f6e8'], [0.65, '#c2dcb4'], [1, '#5c8f4e']])}${clipAll}${clipTop('b9top')}${clipBottom('b9bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="url(#b9bg)"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#5c8f4e" stroke-width="1.5" opacity="0.3"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b9top)">
    <circle cx="150" cy="26" r="13" fill="#ffffff" stroke="#5c8f4e" stroke-width="2"/>
    <polygon points="150,21.5 154.3,24.6 152.6,29.6 147.4,29.6 145.7,24.6" fill="#3f5a2a"/>
    <path d="M150 21.5 L150 13 M154.3 24.6 L162.4 22 M152.6 29.6 L157.6 36.5 M147.4 29.6 L142.4 36.5 M145.7 24.6 L137.6 22" stroke="#8fae84" stroke-width="1.2" fill="none"/>
    <circle cx="300" cy="26" r="13" fill="#e07b39"/>
    <path d="M300 13 C 305 19 305 33 300 39 M291 19 C 299 22 304 22 312 19 M291 33 C 299 30 304 30 312 33" stroke="#a84c14" stroke-width="1.6" fill="none"/>
    <polygon points="450,12 453.3,21.5 463.3,21.7 455.3,27.7 458.2,37.3 450,31.6 441.8,37.3 444.7,27.7 436.7,21.7 446.7,21.5" fill="#5c8f4e"/>
    <circle cx="600" cy="26" r="10" fill="#5c8f4e"/>
    ${leafX(80, 32, 104, 16, 8, 'b9lf', 'b9lf')}
  </g>
  <g clip-path="url(#b9bot)">
    <circle cx="200" cy="134" r="11" fill="#e07b39"/>
    <path d="M200 123 C 204 128 204 140 200 145 M192 128 C 199 131 203 131 210 128 M192 140 C 199 137 203 137 210 140" stroke="#a84c14" stroke-width="1.4" fill="none"/>
    <polygon points="350,122 352.8,130.1 361.4,130.3 354.6,135.5 357.1,143.7 350,138.8 342.9,143.7 345.4,135.5 338.6,130.3 347.2,130.1" fill="#5c8f4e"/>
    <circle cx="500" cy="134" r="11" fill="#ffffff" stroke="#5c8f4e" stroke-width="2"/>
    <polygon points="500,130.2 503.6,132.8 502.2,137.1 497.8,137.1 496.4,132.8" fill="#3f5a2a"/>
    <path d="M500 130.2 L500 123 M503.6 132.8 L510.5 130.6 M502.2 137.1 L506.5 142.9 M497.8 137.1 L493.5 142.9 M496.4 132.8 L489.5 130.6" stroke="#8fae84" stroke-width="1" fill="none"/>
    <circle cx="640" cy="134" r="7" fill="#e07b39"/>
    ${pearlX(700, 134, 7, 'b9pe')}
  </g>
</g>
</svg>`,
    probe: [600, 26, [92, 143, 78]], // #5c8f4e 实心绿色圆点中心
  },

  // ========== 10 ① 斜纹式 · 科技风——冷蓝交叉斜纹 + 网格 ==========
  {
    name: 'band-tech', label: '花纹色带·斜纹式·科技风（冷蓝交叉斜纹+网格）', type: '① 斜纹式', style: '科技风',
    w: 750, h: 160, zone: ZONE,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 160">
<defs>${gradRadial('b10rg', [[0, '#a8c4f5'], [0.4, '#7ba3e8'], [0.7, '#4d7fd4'], [1, '#1a3f8f']])}${gradLinear('b10dg', 0, 0, 0, 1, [[0, '#7ba3e8'], [0.4, '#5c8cd8'], [0.7, '#4d7fd4'], [1, '#2f5cb8']])}${clipAll}${clipTop('b10top')}${clipBottom('b10bot')}</defs>
<rect x="10" y="10" width="730" height="140" rx="12" fill="#eaf1fb"/>
<rect x="12.5" y="12.5" width="725" height="135" rx="10" fill="none" stroke="#4d7fd4" stroke-width="1.5" opacity="0.3"/>
<g clip-path="url(#bandclip)">
  <g clip-path="url(#b10top)">
    <g transform="rotate(45 375 25)">
      <rect x="-160" y="22.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="58.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="-13.5" width="1070" height="5" fill="#9db8ec"/>
    </g>
    <g transform="rotate(-45 375 25)">
      <rect x="-160" y="22.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="58.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="-13.5" width="1070" height="5" fill="#9db8ec"/>
    </g>
    <rect x="36" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="68" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="100" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="132" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="164" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="196" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="228" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="260" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="292" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="324" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="356" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="388" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="420" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="452" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="484" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="516" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="548" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="580" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="612" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="644" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="676" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="708" y="33" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="700" y="12" width="28" height="10" rx="4" fill="url(#b10dg)"/>
  </g>
  <g clip-path="url(#b10bot)">
    <g transform="rotate(45 375 135)">
      <rect x="-160" y="132.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="168.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="96.5" width="1070" height="5" fill="#9db8ec"/>
    </g>
    <g transform="rotate(-45 375 135)">
      <rect x="-160" y="132.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="168.5" width="1070" height="5" fill="#9db8ec"/>
      <rect x="-160" y="96.5" width="1070" height="5" fill="#9db8ec"/>
    </g>
    <rect x="52" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="84" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="116" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="148" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="180" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="212" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="244" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="276" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="308" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="340" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="372" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="404" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="436" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="468" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="500" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="532" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="564" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="596" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="628" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="660" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
    <rect x="692" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/><rect x="724" y="123" width="4" height="4" fill="#4d7fd4" opacity="0.55"/>
  </g>
  <polygon points="55,66 69,80 55,94 41,80" fill="none" stroke="#4d7fd4" stroke-width="3"/>
  <polygon points="55,72 62,80 55,88 48,80" fill="url(#b10rg)"/>
  <g stroke="#4d7fd4" stroke-width="2" opacity="0.8">
    <line x1="700" y1="62" x2="730" y2="62"/><line x1="700" y1="72" x2="730" y2="72"/>
    <line x1="700" y1="82" x2="730" y2="82"/><line x1="700" y1="92" x2="730" y2="92"/>
    <line x1="710" y1="60" x2="710" y2="94"/><line x1="720" y1="60" x2="720" y2="94"/>
    <line x1="730" y1="60" x2="730" y2="94"/>
  </g>
</g>
</svg>`,
    probe: [375, 25, [157, 184, 236]], // #9db8ec 交叉斜纹交叉点（两组同色实条，叠后同色）
  },
]

// 校验：count=10 / dupName / name 以 band- 开头 / svg 非空且闭合 / defs 闭合 /
// url(#id) 引用有定义 / probe 完整 / zone 存在且满足 §5.0 容量（x90..660 × y45..115，宽≥550 高≥70）
export function validateBandArts() {
  const names = bandArts.map((a) => a.name)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const bad = bandArts.filter((a) => {
    if (!/^band-/.test(a.name)) return true
    if (!a.label || !a.type || !a.style) return true
    if (!(a.w === 750 && a.h === 160) || !/^<svg/.test(a.svg)) return true
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
    if (!a.zone) return true
    const z = a.zone
    if (!(z.x0 < z.x1 && z.y0 < z.y1)) return true
    const w = z.x1 - z.x0, h = z.y1 - z.y0
    // §5.0：zone 设计宽 ≥550（x 90..640）、设计高 ≥70（y 45..115）；扫描区 x90..660
    if (w < 550 || h < 70) return true
    if (z.y0 !== 45 || z.y1 !== 115) return true
    if (z.x0 > 90 || z.x1 < 660) return true
    // probe 必须落在画布内
    if (a.probe[0] < 0 || a.probe[0] >= a.w || a.probe[1] < 0 || a.probe[1] >= a.h) return true
    return false
  })
  return { count: bandArts.length, dupName, bad, ok: dupName.length === 0 && bad.length === 0 }
}
