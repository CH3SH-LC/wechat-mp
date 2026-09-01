// ============================================================
// 模拟 v11·组合模板复合资产 第二批（20 个，6 组）——v5 精细度 ×4 版（2026-08-29 第 5 轮）
// 复杂度铁律（用户确认）：未来一切美术资产复杂度不得低于本批标准——
//   渐变 ≥2 段（linear/radial）、装饰 ≥2 处且长在组件结构上、珍珠/叶脉/多层花瓣等细节、
//   嵌字区装饰必须避开文字区（中央留空 ≥260px，装饰放线端/角部）
// v5 精细度升级：flower5X（4 层花瓣+花蕊丝+高光月牙）、leafX（主体+主脉+侧脉+高光）、
//   渐变 4-6 stop、大圆点加高光点
// 全部 probe 像素验证（选纯色部件：花心/线/珍珠/叶主色）
// 转正：追加到 SKILL.md ARTS（v11 规划 39 → 106 资产）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from './ARTS-fine-utils.mjs'

const WHITE = [255, 255, 255]
const ORANGE = [201, 111, 74]   // #c96f4a
const ORANGE_D = [160, 78, 46]  // #a04e2e
const ORANGE_L = [242, 201, 168] // #f2c9a8
const TEAL = [95, 141, 138]     // #5f8d8a
const TEAL_D = [63, 107, 104]   // #3f6b68
const TEAL_L = [207, 224, 218]  // #cfe0da
const GOLD = [184, 134, 11]     // #b8860b
const GOLD_D = [138, 106, 16]   // #8a6a10
const GOLD_L = [245, 236, 217]  // #f5ecd9

// 五瓣花（径向渐变立体）+ 深色花心 —— 渐变 id 必须在 defs 已定义
const flower5 = (cx, cy, r, gradId, heart) =>
  `<g><g fill="url(#${gradId})"><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.52}" transform="rotate(-72 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.52}" transform="rotate(0 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.52}" transform="rotate(72 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.52}" transform="rotate(144 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.52}" transform="rotate(216 ${cx} ${cy})"/></g><circle cx="${cx}" cy="${cy}" r="${r * 0.38}" fill="${heart}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.15}" fill="#ffffff" opacity="0.85"/></g>`
// 叶片（渐变+叶脉）——渐变 id 必须在 defs 已定义
const leaf = (sx, sy, ex, ey, w, gradId) =>
  `<g><path d="M${sx} ${sy} Q ${(sx + ex) / 2} ${sy - w} ${ex} ${ey} Q ${(sx + ex) / 2} ${sy + w} ${sx} ${sy} Z" fill="url(#${gradId})"/><path d="M${sx} ${sy} Q ${(sx + ex) / 2} ${sy} ${ex} ${ey}" fill="none" stroke="#3f6b68" stroke-width="2.5" opacity="0.5"/></g>`

export const comboArts2 = [
  // ========== A 组：边框系列（4 个，深度融合装饰长在框线上） ==========
  // A1 圆角框+左上玫瑰+右下叶+框线珍珠
  {
    name: 'combo-frame-vine-rose', label: '边框·玫瑰叶珍珠', w: 600, h: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150">
<defs><radialGradient id="a1r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.275" stop-color="#de9c79"/><stop offset="0.525" stop-color="#ca7e5b"/><stop offset="0.775" stop-color="#b55f3c"/></radialGradient><linearGradient id="a1l" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#97b7b2"/></linearGradient></defs>
<rect x="22" y="22" width="556" height="106" rx="18" fill="none" stroke="#a04e2e" stroke-width="3"/>
<rect x="34" y="34" width="532" height="82" rx="12" fill="none" stroke="#f2c9a8" stroke-width="1.5"/>
<g fill="#f2c9a8"><circle cx="96" cy="22" r="7"/><circle cx="170" cy="22" r="7"/><circle cx="244" cy="22" r="7"/><circle cx="430" cy="22" r="7"/><circle cx="504" cy="22" r="7"/><circle cx="96" cy="128" r="7"/><circle cx="170" cy="128" r="7"/><circle cx="430" cy="128" r="7"/><circle cx="504" cy="128" r="7"/></g>
${flower5X(22, 22, 24, 'a1r', 'a1r', '#a04e2e')}
<g fill="#a04e2e"><ellipse cx="22" cy="22" rx="9" ry="4.5" transform="rotate(-30 22 22)"/><ellipse cx="30" cy="30" rx="9" ry="4.5" transform="rotate(30 30 30)"/></g>
${leafX(578, 128, 560, 108, 18, 'a1l', 'a1l')}
<path d="M578 128 C 594 116 592 100 578 92" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="34" cy="116" r="3" fill="#a04e2e"/><circle cx="566" cy="34" r="3" fill="#a04e2e"/>
</svg>`,
    probe: [22, 22, ORANGE_D],
  },
  // A2 双线框+四角花（对称克制）
  {
    name: 'combo-frame-quad-flower', label: '边框·四角花', w: 600, h: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150">
<defs><radialGradient id="a2r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient></defs>
<rect x="20" y="20" width="560" height="110" rx="16" fill="none" stroke="#c96f4a" stroke-width="3"/>
<rect x="32" y="32" width="536" height="86" rx="10" fill="none" stroke="#c96f4a" stroke-width="1.5"/>
${flower5X(20, 20, 17, 'a2r', 'a2r', '#a04e2e')}
${flower5X(580, 20, 17, 'a2r', 'a2r', '#a04e2e')}
${flower5X(20, 130, 17, 'a2r', 'a2r', '#a04e2e')}
${flower5X(580, 130, 17, 'a2r', 'a2r', '#a04e2e')}
<circle cx="32" cy="32" r="2.5" fill="#f2c9a8"/><circle cx="568" cy="32" r="2.5" fill="#f2c9a8"/><circle cx="32" cy="118" r="2.5" fill="#f2c9a8"/><circle cx="568" cy="118" r="2.5" fill="#f2c9a8"/>
</svg>`,
    probe: [20, 75, ORANGE],
  },
  // A3 金框+顶部珍珠链+底部小花
  {
    name: 'combo-frame-gold-band', label: '边框·金珍珠链', w: 600, h: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150">
<defs><linearGradient id="a3g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="#d7b972"/><stop offset="0.5" stop-color="#bc9940"/><stop offset="0.75" stop-color="#a1780e"/></linearGradient></defs>
<rect x="20" y="20" width="560" height="110" rx="16" fill="none" stroke="#8a6a10" stroke-width="3"/>
<rect x="34" y="34" width="532" height="82" rx="10" fill="none" stroke="#b8860b" stroke-width="1.5"/>
<g fill="#f5ecd9"><circle cx="60" cy="20" r="8"/><circle cx="100" cy="20" r="10"/><circle cx="145" cy="20" r="8"/><circle cx="185" cy="20" r="10"/><circle cx="230" cy="20" r="8"/><circle cx="270" cy="20" r="10"/><circle cx="315" cy="20" r="8"/><circle cx="355" cy="20" r="10"/><circle cx="400" cy="20" r="8"/><circle cx="440" cy="20" r="10"/><circle cx="485" cy="20" r="8"/><circle cx="525" cy="20" r="10"/><circle cx="570" cy="20" r="8"/></g>
${flower5X(300, 130, 22, 'a3g', 'a3g', '#8a6a10')}
<g fill="#f5ecd9"><circle cx="100" cy="130" r="6"/><circle cx="500" cy="130" r="6"/></g>
</svg>`,
    probe: [306, 130, GOLD_D],
  },
  // A4 圆角框+左上花枝+右下叶枝（S 形花枝）
  {
    name: 'combo-frame-corner-branch', label: '边框·花枝叶枝', w: 600, h: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150">
<defs><linearGradient id="a4o" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#de9c79"/></linearGradient><linearGradient id="a4t" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient></defs>
<rect x="22" y="22" width="556" height="106" rx="18" fill="none" stroke="#a04e2e" stroke-width="3"/>
<path d="M34 40 C 56 30 74 44 92 34" fill="none" stroke="#a04e2e" stroke-width="2" stroke-linecap="round"/>
${flower5X(22, 22, 21, 'a4o', 'a4o', '#a04e2e')}
${leafX(96, 30, 112, 44, 14, 'a4t', 'a4t')}
<path d="M578 128 C 556 136 540 122 522 132" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
${leafX(566, 128, 548, 114, 16, 'a4t', 'a4t')}
${leafX(588, 112, 570, 100, 14, 'a4t', 'a4t')}
</svg>`,
    probe: [22, 75, ORANGE_D],
  },

  // ========== B 组：上下分割线系列（3 个） ==========
  // B1 上下线+中心玫瑰+两侧小花
  {
    name: 'combo-lines-rose', label: '上下线·中心玫瑰', w: 750, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 130">
<defs><radialGradient id="b1r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.275" stop-color="#de9c79"/><stop offset="0.525" stop-color="#ca7e5b"/><stop offset="0.775" stop-color="#b55f3c"/></radialGradient><linearGradient id="b1l" x1="0" y1="0" x2="1" y2="0"><stop offset="0.5" stop-color="#de9c79"/></linearGradient></defs>
<line x1="60" y1="22" x2="300" y2="22" stroke="url(#b1l)" stroke-width="2.5"/><line x1="450" y1="22" x2="690" y2="22" stroke="url(#b1l)" stroke-width="2.5"/>
<line x1="60" y1="108" x2="300" y2="108" stroke="url(#b1l)" stroke-width="2.5"/><line x1="450" y1="108" x2="690" y2="108" stroke="url(#b1l)" stroke-width="2.5"/>
${flower5X(375, 22, 24, 'b1r', 'b1r', '#a04e2e')}
${flower5X(375, 108, 15, 'b1r', 'b1r', '#a04e2e')}
${flower5X(300, 22, 10, 'b1r', 'b1r', '#a04e2e')}
${flower5X(450, 22, 10, 'b1r', 'b1r', '#a04e2e')}
<circle cx="60" cy="22" r="8" fill="#c96f4a"/><circle cx="57.8" cy="19.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="57.8" cy="19.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="690" cy="22" r="8" fill="#c96f4a"/><circle cx="687.8" cy="19.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="687.8" cy="19.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="60" cy="108" r="8" fill="#c96f4a"/><circle cx="57.8" cy="105.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="57.8" cy="105.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="690" cy="108" r="8" fill="#c96f4a"/><circle cx="687.8" cy="105.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="687.8" cy="105.6" r="2.6" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [381, 22, ORANGE_D],
  },
  // B2 上下双线+左右藤蔓带叶（金线青叶）
  {
    name: 'combo-lines-double-vine', label: '上下双线·藤蔓', w: 750, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 130">
<defs><linearGradient id="b2t" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient></defs>
<line x1="40" y1="18" x2="300" y2="18" stroke="#b8860b" stroke-width="1.5"/><line x1="40" y1="30" x2="300" y2="30" stroke="#b8860b" stroke-width="2.5"/>
<line x1="450" y1="18" x2="710" y2="18" stroke="#b8860b" stroke-width="1.5"/><line x1="450" y1="30" x2="710" y2="30" stroke="#b8860b" stroke-width="2.5"/>
<line x1="40" y1="100" x2="300" y2="100" stroke="#b8860b" stroke-width="1.5"/><line x1="40" y1="112" x2="300" y2="112" stroke="#b8860b" stroke-width="2.5"/>
<line x1="450" y1="100" x2="710" y2="100" stroke="#b8860b" stroke-width="1.5"/><line x1="450" y1="112" x2="710" y2="112" stroke="#b8860b" stroke-width="2.5"/>
<path d="M60 18 C 36 6 20 20 28 40" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
${leafX(44, 22, 58, 36, 14, 'b2t', 'b2t')}
${leafX(36, 34, 48, 48, 12, 'b2t', 'b2t')}
<path d="M690 18 C 714 6 730 20 722 40" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
${leafX(706, 22, 692, 36, 14, 'b2t', 'b2t')}
${leafX(714, 34, 702, 48, 12, 'b2t', 'b2t')}
<path d="M60 112 C 36 124 20 110 28 90" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
<path d="M690 112 C 714 124 730 110 722 90" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="300" cy="18" r="6" fill="#b8860b"/><circle cx="298.3" cy="16.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="298.3" cy="16.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="300" cy="30" r="6" fill="#b8860b"/><circle cx="298.3" cy="28.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="298.3" cy="28.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="450" cy="18" r="6" fill="#b8860b"/><circle cx="448.3" cy="16.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="448.3" cy="16.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="450" cy="30" r="6" fill="#b8860b"/><circle cx="448.3" cy="28.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="448.3" cy="28.2" r="1.9" fill="#ffffff" opacity="0.8"/>
<circle cx="300" cy="100" r="6" fill="#b8860b"/><circle cx="298.3" cy="98.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="298.3" cy="98.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="300" cy="112" r="6" fill="#b8860b"/><circle cx="298.3" cy="110.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="298.3" cy="110.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="450" cy="100" r="6" fill="#b8860b"/><circle cx="448.3" cy="98.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="448.3" cy="98.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="450" cy="112" r="6" fill="#b8860b"/><circle cx="448.3" cy="110.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="448.3" cy="110.2" r="1.9" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [300, 18, GOLD],
  },
  // B3 上下波浪线+中心花+两端点
  {
    name: 'combo-lines-wave', label: '上下波浪线·花', w: 750, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 130">
<defs><radialGradient id="b3r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#87a6a1"/></radialGradient></defs>
<path d="M60 24 Q 120 12 180 24 T 300 24" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
<path d="M450 24 Q 510 12 570 24 T 690 24" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
<path d="M60 106 Q 120 118 180 106 T 300 106" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
<path d="M450 106 Q 510 118 570 106 T 690 106" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
${flower5X(375, 24, 22, 'b3r', 'b3r', '#3f6b68')}
${flower5X(375, 106, 14, 'b3r', 'b3r', '#3f6b68')}
<circle cx="60" cy="24" r="8" fill="#5f8d8a"/><circle cx="57.8" cy="21.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="57.8" cy="21.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="690" cy="24" r="8" fill="#5f8d8a"/><circle cx="687.8" cy="21.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="687.8" cy="21.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="60" cy="106" r="8" fill="#5f8d8a"/><circle cx="57.8" cy="103.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="57.8" cy="103.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="690" cy="106" r="8" fill="#5f8d8a"/><circle cx="687.8" cy="103.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="687.8" cy="103.6" r="2.6" fill="#ffffff" opacity="0.8"/>
<circle cx="300" cy="24" r="6" fill="#5f8d8a"/><circle cx="298.3" cy="22.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="298.3" cy="22.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="450" cy="24" r="6" fill="#5f8d8a"/><circle cx="448.3" cy="22.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="448.3" cy="22.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="300" cy="106" r="6" fill="#5f8d8a"/><circle cx="298.3" cy="104.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="298.3" cy="104.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="450" cy="106" r="6" fill="#5f8d8a"/><circle cx="448.3" cy="104.2" r="1.9" fill="#ffffff" opacity="0.8"/><circle cx="448.3" cy="104.2" r="1.9" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [381, 24, TEAL_D],
  },

  // ========== C 组：下划线系列（3 个） ==========
  // C1 藤蔓下划线+两端叶+中心小花（装饰避开文字区）
  {
    name: 'combo-underline-vine', label: '下划线·藤蔓叶花', w: 520, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 80">
<defs><radialGradient id="c1r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#87a6a1"/></radialGradient></defs>
<path d="M20 52 Q 140 42 260 52 T 500 52" fill="none" stroke="#5f8d8a" stroke-width="3.5" stroke-linecap="round"/>
${leafX(30, 62, 2, 24, 18, 'c1r', 'c1r')}
${leafX(6, 42, 40, 76, 18, 'c1r', 'c1r')}
${leafX(490, 62, 518, 24, 18, 'c1r', 'c1r')}
${leafX(514, 42, 480, 76, 18, 'c1r', 'c1r')}
${flower5X(160, 50, 11, 'c1r', 'c1r', '#3f6b68')}
${flower5X(360, 50, 11, 'c1r', 'c1r', '#3f6b68')}
</svg>`,
    probe: [300, 56, TEAL],
  },
  // C2 双线下划线+中心花+端圆点
  {
    name: 'combo-underline-double-flower', label: '下划线·双线花', w: 520, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 80">
<defs><radialGradient id="c2r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient></defs>
<line x1="40" y1="48" x2="480" y2="48" stroke="#c96f4a" stroke-width="2.5"/>
<line x1="60" y1="60" x2="460" y2="60" stroke="#c96f4a" stroke-width="1.5"/>
${flower5X(260, 52, 18, 'c2r', 'c2r', '#a04e2e')}
<circle cx="40" cy="48" r="7" fill="#c96f4a"/><circle cx="38.0" cy="45.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="38.0" cy="45.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="480" cy="48" r="7" fill="#c96f4a"/><circle cx="478.0" cy="45.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="478.0" cy="45.9" r="2.2" fill="#ffffff" opacity="0.8"/>
<circle cx="120" cy="60" r="5" fill="#f2c9a8"/><circle cx="118.6" cy="58.5" r="1.6" fill="#ffffff" opacity="0.8"/><circle cx="118.6" cy="58.5" r="1.6" fill="#ffffff" opacity="0.8"/><circle cx="400" cy="60" r="5" fill="#f2c9a8"/><circle cx="398.6" cy="58.5" r="1.6" fill="#ffffff" opacity="0.8"/><circle cx="398.6" cy="58.5" r="1.6" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [40, 48, ORANGE],
  },
  // C3 金枝下划线（树枝形态+两端叶）
  {
    name: 'combo-underline-branch', label: '下划线·金枝', w: 520, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 80">
<defs><linearGradient id="c3g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.35" stop-color="#e0c67e"/><stop offset="0.7" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></linearGradient></defs>
<path d="M30 52 C 160 44 360 44 490 52" fill="none" stroke="#8a6a10" stroke-width="3.5" stroke-linecap="round"/>
<path d="M140 48 L 160 34" stroke="#8a6a10" stroke-width="2.5" stroke-linecap="round"/>
<path d="M380 48 L 360 34" stroke="#8a6a10" stroke-width="2.5" stroke-linecap="round"/>
${leafX(152, 42, 190, 16, 17, 'c3g', 'c3g')}
${leafX(168, 42, 138, 16, 15, 'c3g', 'c3g')}
${leafX(368, 42, 330, 16, 17, 'c3g', 'c3g')}
${leafX(352, 42, 382, 16, 15, 'c3g', 'c3g')}
<circle cx="30" cy="52" r="7" fill="#b8860b"/><circle cx="28.0" cy="49.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="490" cy="52" r="7" fill="#b8860b"/><circle cx="488.0" cy="49.9" r="2.2" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [300, 46, GOLD_D],
  },

  // ========== D 组：夹线嵌字系列（3 个，装饰全在嵌字区外） ==========
  // D1 夹线+两端藤蔓花饰（中央 230-520 留空嵌字）
  {
    name: 'combo-clamp-vine-flower', label: '夹线·藤蔓花饰', w: 750, h: 90,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs><linearGradient id="d1t" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient><radialGradient id="d1r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient></defs>
<line x1="14" y1="45" x2="230" y2="45" stroke="#5f8d8a" stroke-width="2.5"/>
<line x1="520" y1="45" x2="736" y2="45" stroke="#5f8d8a" stroke-width="2.5"/>
<path d="M14 45 C 34 22 60 68 84 45" fill="none" stroke="#5f8d8a" stroke-width="3" stroke-linecap="round"/>
${leafX(20, 18, 58, 56, 16, 'd1t', 'd1t')}
${leafX(46, 72, 82, 34, 14, 'd1t', 'd1t')}
<path d="M736 45 C 716 22 690 68 666 45" fill="none" stroke="#5f8d8a" stroke-width="3" stroke-linecap="round"/>
${leafX(730, 18, 692, 56, 16, 'd1t', 'd1t')}
${leafX(704, 72, 668, 34, 14, 'd1t', 'd1t')}
${flower5X(230, 45, 17, 'd1r', 'd1r', '#a04e2e')}
${flower5X(520, 45, 17, 'd1r', 'd1r', '#a04e2e')}
</svg>`,
    probe: [100, 45, TEAL],
  },
  // D2 夹线+珍珠点线（线上珍珠圆点，中央留空嵌字）
  {
    name: 'combo-clamp-pearl', label: '夹线·珍珠点', w: 750, h: 90,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs><linearGradient id="d2p" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#d7b972"/></linearGradient></defs>
<line x1="10" y1="45" x2="230" y2="45" stroke="#b8860b" stroke-width="2"/>
<line x1="520" y1="45" x2="740" y2="45" stroke="#b8860b" stroke-width="2"/>
<g fill="url(#d2p)"><circle cx="50" cy="45" r="11"/><circle cx="90" cy="45" r="9"/><circle cx="130" cy="45" r="11"/><circle cx="170" cy="45" r="9"/><circle cx="210" cy="45" r="11"/><circle cx="540" cy="45" r="11"/><circle cx="580" cy="45" r="9"/><circle cx="620" cy="45" r="11"/><circle cx="660" cy="45" r="9"/><circle cx="700" cy="45" r="11"/></g>
<circle cx="230" cy="45" r="9" fill="#8a6a10"/><circle cx="227.5" cy="42.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="227.5" cy="42.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="520" cy="45" r="9" fill="#8a6a10"/><circle cx="517.5" cy="42.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="517.5" cy="42.3" r="2.9" fill="#ffffff" opacity="0.8"/>
<circle cx="10" cy="45" r="8" fill="#b8860b"/><circle cx="7.8" cy="42.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="7.8" cy="42.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="740" cy="45" r="8" fill="#b8860b"/><circle cx="737.8" cy="42.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="737.8" cy="42.6" r="2.6" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [10, 45, GOLD],
  },
  // D3 夹线+内端菱形+端点花
  {
    name: 'combo-clamp-diamond-flower', label: '夹线·菱形花', w: 750, h: 90,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs><radialGradient id="d3r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#dfae92"/></radialGradient></defs>
<line x1="14" y1="45" x2="230" y2="45" stroke="#c96f4a" stroke-width="2.5"/>
<line x1="520" y1="45" x2="736" y2="45" stroke="#c96f4a" stroke-width="2.5"/>
<polygon points="230,32 250,45 230,58 210,45" fill="#a04e2e"/>
<polygon points="520,32 540,45 520,58 500,45" fill="#a04e2e"/>
${flower5X(14, 45, 17, 'd3r', 'd3r', '#a04e2e')}
${flower5X(736, 45, 17, 'd3r', 'd3r', '#a04e2e')}
</svg>`,
    probe: [230, 45, ORANGE_D],
  },

  // ========== E 组：徽章系列（3 个，融合装饰） ==========
  // E1 徽章+桂冠（两侧月桂叶，经典）
  {
    name: 'combo-badge-laurel', label: '徽章·桂冠', w: 130, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
<defs><linearGradient id="e1b" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#c98c6b"/></linearGradient><linearGradient id="e1l" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient></defs>
<circle cx="65" cy="65" r="38" fill="url(#e1b)"/>
<circle cx="65" cy="65" r="30" fill="none" stroke="#f2c9a8" stroke-width="2.5"/>
<text x="65" y="68" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text>
${leafX(22, 34, 50, 56, 16, 'e1l', 'e1l')}
${leafX(12, 56, 42, 66, 16, 'e1l', 'e1l')}
${leafX(14, 74, 44, 74, 16, 'e1l', 'e1l')}
${leafX(108, 34, 80, 56, 16, 'e1l', 'e1l')}
${leafX(118, 56, 88, 66, 16, 'e1l', 'e1l')}
${leafX(116, 74, 86, 74, 16, 'e1l', 'e1l')}
<path d="M28 52 C 24 66 24 76 30 88" fill="none" stroke="#5f8d8a" stroke-width="2" stroke-linecap="round"/>
<path d="M102 52 C 106 66 106 76 100 88" fill="none" stroke="#5f8d8a" stroke-width="2" stroke-linecap="round"/>
</svg>`,
    probe: [65, 35, ORANGE_L],
  },
  // E2 徽章+花环（一圈小花围绕）
  {
    name: 'combo-badge-wreath', label: '徽章·花环', w: 130, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
<defs><radialGradient id="e2r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient><linearGradient id="e2b" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient></defs>
<circle cx="65" cy="65" r="36" fill="url(#e2b)"/>
<circle cx="65" cy="65" r="28" fill="none" stroke="#cfe0da" stroke-width="2" stroke-dasharray="4 5"/>
<text x="65" y="68" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text>
${flower5X(65, 14, 14, 'e2r', 'e2r', '#a04e2e')}
${flower5X(112, 42, 14, 'e2r', 'e2r', '#a04e2e')}
${flower5X(112, 88, 14, 'e2r', 'e2r', '#a04e2e')}
${flower5X(65, 116, 14, 'e2r', 'e2r', '#a04e2e')}
${flower5X(18, 88, 14, 'e2r', 'e2r', '#a04e2e')}
${flower5X(18, 42, 14, 'e2r', 'e2r', '#a04e2e')}
</svg>`,
    probe: [66, 15, ORANGE_D],
  },
  // E3 徽章+底部缎带（双尾缎带从徽章下方伸出）
  {
    name: 'combo-badge-ribbon', label: '徽章·缎带尾', w: 130, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
<defs><linearGradient id="e3b" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#c98c6b"/></linearGradient><linearGradient id="e3r" x1="0" y1="0" x2="1" y2="0"><stop offset="0.5" stop-color="#aa6d2d"/></linearGradient></defs>
<circle cx="65" cy="58" r="36" fill="url(#e3b)"/>
<circle cx="65" cy="58" r="28" fill="none" stroke="#f2c9a8" stroke-width="2" stroke-dasharray="4 5"/>
<text x="65" y="61" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text>
<path d="M50 92 L 34 120 L 48 116 L 58 128 L 62 98 Z" fill="#a04e2e"/>
<path d="M80 92 L 96 120 L 82 116 L 72 128 L 68 98 Z" fill="#a04e2e"/>
<path d="M44 94 L 56 110" stroke="#f5ecd9" stroke-width="1.5"/>
<path d="M86 94 L 74 110" stroke="#f5ecd9" stroke-width="1.5"/>
</svg>`,
    probe: [62, 86, ORANGE_L],
  },

  // ========== F 组：缎带/分隔/点缀系列（4 个） ==========
  // F1 卷轴横幅+藤蔓花饰（花长在卷轴上）
  {
    name: 'combo-banner-scroll-vine', label: '卷轴·藤蔓花', w: 340, h: 110,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 110">
<defs><linearGradient id="f1s" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="#d7b972"/><stop offset="0.5" stop-color="#bc9940"/><stop offset="0.75" stop-color="#a1780e"/></linearGradient><radialGradient id="f1r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient></defs>
<rect x="52" y="14" width="12" height="56" rx="6" fill="#8a6a10"/>
<rect x="276" y="14" width="12" height="56" rx="6" fill="#8a6a10"/>
<rect x="64" y="22" width="212" height="40" rx="4" fill="url(#f1s)"/>
<line x1="84" y1="42" x2="256" y2="42" stroke="#f5ecd9" stroke-width="2" stroke-dasharray="6 5"/>
<path d="M64 22 C 52 6 24 10 20 28" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
${leafX(54, 6, 26, 34, 14, 'f1r', 'f1r')}
${flower5X(20, 28, 15, 'f1r', 'f1r', '#a04e2e')}
<path d="M276 22 C 288 6 316 10 320 28" fill="none" stroke="#5f8d8a" stroke-width="2.5" stroke-linecap="round"/>
${leafX(286, 6, 314, 34, 14, 'f1r', 'f1r')}
${flower5X(320, 28, 15, 'f1r', 'f1r', '#a04e2e')}
</svg>`,
    probe: [58, 42, GOLD_D],
  },
  // F2 缎带+双侧花（花在缎带两端）
  {
    name: 'combo-banner-twin-flower', label: '缎带·双侧花', w: 340, h: 110,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 110">
<defs><linearGradient id="f2n" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#b55f3c"/></linearGradient><radialGradient id="f2r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient></defs>
<path d="M30 58 L 310 58 L 290 82 L 310 106 L 30 106 L 50 82 Z" fill="url(#f2n)"/>
<line x1="60" y1="82" x2="280" y2="82" stroke="#f2c9a8" stroke-width="2" stroke-dasharray="6 6"/>
${flower5X(16, 40, 17, 'f2r', 'f2r', '#a04e2e')}
${flower5X(324, 40, 17, 'f2r', 'f2r', '#a04e2e')}
<path d="M30 58 C 16 50 14 66 30 70" fill="none" stroke="#a04e2e" stroke-width="2.5" stroke-linecap="round"/>
<path d="M310 58 C 324 50 326 66 310 70" fill="none" stroke="#a04e2e" stroke-width="2.5" stroke-linecap="round"/>
</svg>`,
    probe: [18, 41, ORANGE_D],
  },
  // F3 三角旗串+顶部花（花长在串线上）
  {
    name: 'combo-banner-flag-crown', label: '旗串·顶花', w: 300, h: 90,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90">
<defs><linearGradient id="f3f" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient><radialGradient id="f3r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient></defs>
<path d="M0 28 Q 150 16 300 28" fill="none" stroke="#5f8d8a" stroke-width="2"/>
<polygon points="30,28 78,28 54,62" fill="url(#f3f)"/>
<polygon points="118,24 166,24 142,58" fill="#3f6b68"/>
<polygon points="206,28 254,28 230,62" fill="url(#f3f)"/>
${flower5X(150, 12, 16, 'f3r', 'f3r', '#a04e2e')}
<circle cx="12" cy="27" r="8" fill="#5f8d8a"/><circle cx="9.8" cy="24.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="9.8" cy="24.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="288" cy="27" r="8" fill="#5f8d8a"/><circle cx="285.8" cy="24.6" r="2.6" fill="#ffffff" opacity="0.8"/><circle cx="285.8" cy="24.6" r="2.6" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [151, 13, ORANGE_D],
  },
  // F4 花枝点缀（中心花+对称花枝，S 形）
  {
    name: 'combo-accent-branch', label: '花枝点缀·对称', w: 300, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80">
<defs><radialGradient id="f4r" cx="0.5" cy="0.38" r="0.72"><stop offset="0.5" stop-color="#de9c79"/></radialGradient><linearGradient id="f4t" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#87a6a1"/></linearGradient></defs>
<line x1="16" y1="40" x2="108" y2="40" stroke="#c96f4a" stroke-width="2"/>
<line x1="192" y1="40" x2="284" y2="40" stroke="#c96f4a" stroke-width="2"/>
<path d="M108 40 C 120 24 136 28 144 20" fill="none" stroke="#5f8d8a" stroke-width="2" stroke-linecap="round"/>
${leafX(120, 14, 142, 44, 14, 'f4t', 'f4t')}
<path d="M192 40 C 180 24 164 28 156 20" fill="none" stroke="#5f8d8a" stroke-width="2" stroke-linecap="round"/>
${leafX(180, 14, 158, 44, 14, 'f4t', 'f4t')}
${flower5X(150, 40, 22, 'f4r', 'f4r', '#a04e2e')}
<circle cx="108" cy="40" r="7" fill="#c96f4a"/><circle cx="106.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="106.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="192" cy="40" r="7" fill="#c96f4a"/><circle cx="190.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="190.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [188, 40, ORANGE],
  },
  // F5 丝带分隔（中心蝴蝶结丝带+左右线）
  {
    name: 'combo-divider-ribbon', label: '分隔·丝带结', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80">
<defs><linearGradient id="f5n" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#c98c6b"/></linearGradient></defs>
<line x1="60" y1="40" x2="310" y2="40" stroke="#c96f4a" stroke-width="2"/>
<line x1="440" y1="40" x2="690" y2="40" stroke="#c96f4a" stroke-width="2"/>
<path d="M375 24 L 345 40 L 375 56 L 405 40 Z" fill="url(#f5n)"/>
<path d="M345 40 C 320 22 300 58 310 44 Z" fill="#a04e2e"/>
<path d="M405 40 C 430 22 450 58 440 44 Z" fill="#a04e2e"/>
<circle cx="375" cy="40" r="9" fill="#f2c9a8"/><circle cx="372.5" cy="37.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="372.5" cy="37.3" r="2.9" fill="#ffffff" opacity="0.8"/>
<circle cx="310" cy="40" r="7" fill="#c96f4a"/><circle cx="308.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="308.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="440" cy="40" r="7" fill="#c96f4a"/><circle cx="438.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/><circle cx="438.0" cy="37.9" r="2.2" fill="#ffffff" opacity="0.8"/>
<circle cx="60" cy="40" r="9" fill="#c96f4a"/><circle cx="57.5" cy="37.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="57.5" cy="37.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="690" cy="40" r="9" fill="#c96f4a"/><circle cx="687.5" cy="37.3" r="2.9" fill="#ffffff" opacity="0.8"/><circle cx="687.5" cy="37.3" r="2.9" fill="#ffffff" opacity="0.8"/>
</svg>`,
    probe: [375, 40, ORANGE_L],
  },
]

// 校验：名称唯一 / label 唯一 / w h 正整数 / svg 含 <svg 且闭合 / defs 闭合 / url(#id) 引用必须有对应定义 / probe 完整
export function validateComboArts2() {
  const names = comboArts2.map((a) => a.name)
  const labels = comboArts2.map((a) => a.label)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const dupLabel = labels.filter((l, i) => labels.indexOf(l) !== i)
  const bad = comboArts2.filter((a) => {
    if (!(a.w > 0 && a.h > 0) || !/^<svg/.test(a.svg)) return true
    const open = (a.svg.match(/<svg/g) || []).length
    const close = (a.svg.match(/<\/svg>/g) || []).length
    if (open !== 1 || close !== 1) return true
    const gOpen = (a.svg.match(/<defs>/g) || []).length
    const gClose = (a.svg.match(/<\/defs>/g) || []).length
    if (gOpen !== gClose) return true
    // 每个 url(#id) 引用必须有 id 定义
    const defIds = new Set([...a.svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    const refs = [...a.svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1])
    for (const r of refs) if (!defIds.has(r)) return true
    if (!Array.isArray(a.probe) || a.probe.length !== 3 || !Array.isArray(a.probe[2]) || a.probe[2].length !== 3) return true
    return false
  })
  return {
    count: comboArts2.length,
    dupName, dupLabel, bad,
    ok: dupName.length === 0 && dupLabel.length === 0 && bad.length === 0,
  }
}
