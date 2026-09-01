// ============================================================
// 模拟 v11·组合模板复合资产 第一批（8 个）——v5 精细度 ×4 版（2026-08-29 第 5 轮）
// 精细度升级：flower5X（4 层花瓣+花蕊丝+高光月牙）、leafX（主体+主脉+侧脉+高光）、
//   pearlX（径向渐变+双高光）、渐变 4-6 stop、S 形卷曲
// 尺寸规则不变（显示尺寸铁律）：主装饰花显示 ≥20px、叶 ≥16px、珍珠 ≥8px
// probe: 纯色部件（花心/线/框），避开白点与渐变中段
// 转正：追加到 SKILL.md ARTS（v11 规划 39 → 106 资产）
// ============================================================

import { flower5X, leafX, pearlX, gradLinear, gradRadial, curlS } from './ARTS-fine-utils.mjs'

const WHITE = [255, 255, 255]
const ORANGE = [201, 111, 74]
const ORANGE_D = [160, 78, 46]
const ORANGE_L = [242, 201, 168]
const TEAL = [95, 141, 138]
const TEAL_D = [63, 107, 104]
const TEAL_L = [207, 224, 218]
const GOLD = [184, 134, 11]
const GOLD_D = [138, 106, 16]
const GOLD_L = [245, 236, 217]

export const comboArts = [
  // ========== 一、居中边框·左上花右下叶（600×150） ==========
  {
    name: 'combo-frame-corner-flower', label: '居中边框·左上花右下叶', w: 600, h: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150">
<defs>${gradRadial('f1a', [[0, '#fdf0e6'], [0.35, '#f2c9a8'], [0.7, '#c96f4a'], [1, '#a04e2e']])}${gradRadial('f1b', [[0, '#fdf0e6'], [0.4, '#c96f4a'], [1, '#8a3f2a']])}${gradLinear('f1c', 0, 0, 1, 1, [[0, '#e8f2ee'], [0.5, '#8fb5ad'], [1, '#4e7a72']])}</defs>
<rect x="22" y="22" width="556" height="106" rx="18" fill="none" stroke="#a04e2e" stroke-width="3"/>
<rect x="34" y="34" width="532" height="82" rx="12" fill="none" stroke="#f2c9a8" stroke-width="1.5"/>
${flower5X(22, 22, 24, 'f1a', 'f1b', '#a04e2e')}
${leafX(578, 128, 520, 92, 20, 'f1c', 'f1c')}
${curlS(578, 128, 34, -1.1, 3, '#5f8d8a')}
<g>${pearlX(96, 22, 8, 'f1c')}${pearlX(170, 22, 8, 'f1c')}${pearlX(244, 22, 8, 'f1c')}${pearlX(430, 22, 8, 'f1c')}${pearlX(504, 22, 8, 'f1c')}${pearlX(96, 128, 8, 'f1c')}${pearlX(170, 128, 8, 'f1c')}${pearlX(430, 128, 8, 'f1c')}${pearlX(504, 128, 8, 'f1c')}</g>
<circle cx="34" cy="116" r="4" fill="#a04e2e"/><circle cx="566" cy="34" r="4" fill="#a04e2e"/>
</svg>`,
    probe: [28, 22, ORANGE_D],
  },
  // ========== 二、居中上下分割线·中心花（750×130） ==========
  {
    name: 'combo-frame-lines', label: '居中上下分割线·中心花', w: 750, h: 130,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 130">
<defs>${gradLinear('f2a', 0, 0, 1, 0, [[0, '#fdf0e6'], [0.3, '#f2c9a8'], [0.7, '#c96f4a'], [1, '#a04e2e']])}${gradRadial('f2b', [[0, '#fdf0e6'], [0.4, '#f2c9a8'], [0.75, '#c96f4a'], [1, '#a04e2e']])}</defs>
<line x1="60" y1="22" x2="290" y2="22" stroke="url(#f2a)" stroke-width="3"/><line x1="460" y1="22" x2="690" y2="22" stroke="url(#f2a)" stroke-width="3"/>
<line x1="60" y1="108" x2="290" y2="108" stroke="url(#f2a)" stroke-width="3"/><line x1="460" y1="108" x2="690" y2="108" stroke="url(#f2a)" stroke-width="3"/>
${flower5X(375, 22, 22, 'f2b', 'f2b', '#a04e2e')}
${flower5X(375, 108, 14, 'f2b', 'f2b', '#a04e2e')}
${curlS(290, 22, 26, 1.2, 2.5, '#c96f4a')}${curlS(460, 22, 26, -1.2, 2.5, '#c96f4a')}
${curlS(290, 108, 26, -1.2, 2.5, '#c96f4a')}${curlS(460, 108, 26, 1.2, 2.5, '#c96f4a')}
<circle cx="60" cy="22" r="5" fill="#c96f4a"/><circle cx="690" cy="22" r="5" fill="#c96f4a"/><circle cx="60" cy="108" r="5" fill="#c96f4a"/><circle cx="690" cy="108" r="5" fill="#c96f4a"/>
</svg>`,
    probe: [381, 22, ORANGE_D],
  },
  // ========== 三、左对齐·左下划线花锚（520×100） ==========
  {
    name: 'combo-underline-left', label: '左对齐·左下划线花锚', w: 520, h: 100,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 100">
<defs>${gradRadial('f3a', [[0, '#fdf0e6'], [0.4, '#f2c9a8'], [0.75, '#c96f4a'], [1, '#a04e2e']])}${gradLinear('f3b', 0, 0, 1, 0, [[0, '#f2c9a8'], [0.5, '#c96f4a'], [1, '#a04e2e']])}</defs>
<line x1="14" y1="26" x2="74" y2="26" stroke="#c96f4a" stroke-width="3.5" stroke-linecap="round"/>
${flower5X(14, 26, 16, 'f3a', 'f3a', '#a04e2e')}
<line x1="14" y1="72" x2="506" y2="72" stroke="url(#f3b)" stroke-width="3.5" stroke-linecap="round"/>
${curlS(506, 72, 22, 1.4, 3, '#c96f4a')}
${pearlX(60, 72, 6, 'f3b')}${pearlX(120, 72, 5, 'f3b')}
</svg>`,
    probe: [14, 22, ORANGE_D],
  },
  // ========== 四、居中下划线·两端叶（520×70） ==========
  {
    name: 'combo-underline-center', label: '居中下划线·两端叶', w: 520, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 70">
<defs>${gradLinear('f4a', 0, 0, 1, 0, [[0, '#e8f2ee'], [0.5, '#7faaa2'], [1, '#4e7a72']])}${gradRadial('f4b', [[0, '#eef7f3'], [0.45, '#9cc0b8'], [0.8, '#5f8d8a'], [1, '#3f6b68']])}</defs>
<path d="M60 46 Q 170 36 260 46 T 460 46" fill="none" stroke="url(#f4a)" stroke-width="5" stroke-linecap="round"/>
<circle cx="60" cy="46" r="4" fill="#5f8d8a"/><circle cx="460" cy="46" r="4" fill="#5f8d8a"/>
${leafX(40, 46, 10, 30, 20, 'f4b', 'f4b')}
${leafX(480, 46, 510, 30, 20, 'f4b', 'f4b')}
${pearlX(104, 44, 5, 'f4b')}${pearlX(416, 44, 5, 'f4b')}
</svg>`,
    probe: [60, 46, TEAL],
  },
  // ========== 五、夹线嵌字·中心花饰（750×90） ==========
  {
    name: 'combo-clamp-flower', label: '夹线嵌字·中心花饰', w: 750, h: 90,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 90">
<defs>${gradLinear('f5a', 0, 0, 0, 1, [[0, '#fdf3e2'], [0.4, '#e8cd8a'], [0.75, '#b8860b'], [1, '#8a6a10']])}${gradRadial('f5b', [[0, '#fdf3e2'], [0.4, '#e8cd8a'], [0.75, '#b8860b'], [1, '#8a6a10']])}</defs>
<line x1="0" y1="45" x2="230" y2="45" stroke="url(#f5a)" stroke-width="3"/><line x1="520" y1="45" x2="750" y2="45" stroke="url(#f5a)" stroke-width="3"/>
${flower5X(375, 45, 20, 'f5b', 'f5b', '#8a6a10')}
${curlS(0, 45, 40, 0.35, 3, '#b8860b')}${curlS(750, 45, 40, -0.35, 3, '#b8860b')}
${pearlX(230, 45, 8, 'f5b')}${pearlX(520, 45, 8, 'f5b')}
</svg>`,
    probe: [375, 40, GOLD_D],
  },
  // ========== 六、双线分隔·中心花（750×80） ==========
  {
    name: 'combo-divider-double', label: '双线分隔·中心花', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80">
<defs>${gradLinear('f6a', 0, 0, 1, 0, [[0, '#e8f2ee'], [0.5, '#7faaa2'], [1, '#4e7a72']])}${gradRadial('f6b', [[0, '#eef7f3'], [0.45, '#9cc0b8'], [0.8, '#5f8d8a'], [1, '#3f6b68']])}</defs>
<line x1="40" y1="30" x2="710" y2="30" stroke="url(#f6a)" stroke-width="2"/>
<line x1="40" y1="50" x2="710" y2="50" stroke="url(#f6a)" stroke-width="3"/>
${flower5X(375, 40, 18, 'f6b', 'f6b', '#3f6b68')}
${pearlX(40, 30, 6, 'f6b')}${pearlX(710, 30, 6, 'f6b')}${pearlX(40, 50, 6, 'f6b')}${pearlX(710, 50, 6, 'f6b')}
</svg>`,
    probe: [375, 36, TEAL_D],
  },
  // ========== 七、徽章·藤蔓缠绕（120×120） ==========
  {
    name: 'combo-badge-vine', label: '徽章·藤蔓缠绕', w: 120, h: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs>${gradRadial('f7a', [[0, '#fdf0e6'], [0.35, '#f2c9a8'], [0.7, '#c96f4a'], [1, '#a04e2e']])}${gradLinear('f7b', 0, 0, 0, 1, [[0, '#e8f2ee'], [0.5, '#7faaa2'], [1, '#4e7a72']])}</defs>
<circle cx="60" cy="60" r="42" fill="url(#f7a)"/>
<circle cx="60" cy="60" r="33" fill="none" stroke="#f2c9a8" stroke-width="2.5" stroke-dasharray="5 6"/>
<circle cx="60" cy="60" r="26" fill="#a04e2e"/>
<text x="60" y="63" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text>
${curlS(22, 96, 38, -2.2, 3.5, '#5f8d8a')}
${leafX(30, 88, 8, 72, 16, 'f7b', 'f7b')}
${leafX(36, 70, 16, 56, 14, 'f7b', 'f7b')}
${curlS(98, 96, 38, -0.9, 3, '#5f8d8a')}
${leafX(90, 88, 112, 72, 16, 'f7b', 'f7b')}
${leafX(84, 70, 104, 56, 14, 'f7b', 'f7b')}
</svg>`,
    probe: [22, 96, TEAL],
  },
  // ========== 八、缎带横幅·花冠（340×110） ==========
  {
    name: 'combo-banner-crown', label: '缎带横幅·花冠', w: 340, h: 110,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 110">
<defs>${gradLinear('f8a', 0, 0, 0, 1, [[0, '#f2c9a8'], [0.35, '#c96f4a'], [0.7, '#a04e2e'], [1, '#8a3f2a']])}${gradRadial('f8b', [[0, '#fdf0e6'], [0.4, '#f2c9a8'], [0.75, '#c96f4a'], [1, '#a04e2e']])}${gradLinear('f8c', 0, 0, 0, 1, [[0, '#fdf0e6'], [0.5, '#c96f4a'], [1, '#a04e2e']])}</defs>
<path d="M30 58 L 310 58 L 290 82 L 310 106 L 30 106 L 50 82 Z" fill="url(#f8a)"/>
<line x1="60" y1="82" x2="280" y2="82" stroke="#f2c9a8" stroke-width="2" stroke-dasharray="7 6"/>
${flower5X(170, 26, 18, 'f8b', 'f8b', '#a04e2e')}
<path d="M170 44 L 170 58" stroke="#a04e2e" stroke-width="2.5" stroke-linecap="round"/>
${flower5X(112, 32, 11, 'f8c', 'f8c', '#a04e2e')}
${flower5X(228, 32, 11, 'f8c', 'f8c', '#a04e2e')}
${curlS(30, 58, 24, -0.6, 3, '#a04e2e')}${curlS(310, 58, 24, 0.6, 3, '#a04e2e')}
</svg>`,
    probe: [175, 26, ORANGE_D],
  },
]

export function validateComboArts() {
  const names = comboArts.map((a) => a.name)
  const labels = comboArts.map((a) => a.label)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const dupLabel = labels.filter((l, i) => labels.indexOf(l) !== i)
  const bad = comboArts.filter((a) => {
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
    return false
  })
  return { count: comboArts.length, dupName, dupLabel, bad, ok: dupName.length === 0 && dupLabel.length === 0 && bad.length === 0 }
}
