// ============================================================
// 模拟 v3（大量扩充）：SKILL.md Client 块 ARTS 数组将新增的 38 个标题装饰资产
// —— 8 大类全覆盖：序号徽章(7) / 左右夹线(6) / 分隔线(7) / 几何点缀(5)
//    / 卷曲角饰(4) / 缎带横幅(3) / 下划线(3) / 标题框(3)
// 设计原则：
//   - 每资产单色系深浅两档（主色 + 深档/浅档），可程序化换品牌色
//   - 资产是 PNG 图片：SVG 内允许同色相明暗分层（正文 CSS 平面化铁律不受影响）
//   - 数字徽章：数字为 <text> 占位"01"，改编号需改 SVG 源文本后重渲染
//   - probe: [x, y, [r,g,b]] —— 渲染后自动像素验证点（设计坐标×2，容差 ±12）
// 转正方式：追加到 SKILL.md 的 ARTS 数组（现有 39 个之后），版本 v10.3→v11
// ============================================================

const WHITE = [255, 255, 255]
const ORANGE = [201, 111, 74]   // #c96f4a 陶土橙
const ORANGE_D = [160, 78, 46]  // #a04e2e
const ORANGE_L = [242, 201, 168] // #f2c9a8
const TEAL = [95, 141, 138]     // #5f8d8a 雾青
const TEAL_D = [63, 107, 104]   // #3f6b68
const TEAL_L = [207, 224, 218]  // #cfe0da
const GOLD = [184, 134, 11]     // #b8860b 沙金
const GOLD_D = [138, 106, 16]   // #8a6a10
const GOLD_L = [245, 236, 217]  // #f5ecd9

export const subheadingArts = [
  // ================= 一、序号徽章（标题前置，96×96） =================
  {
    name: 'badge-num-circle', label: '圆徽章·双环星点', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient><radialGradient id="g2" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#c96f4a"/><stop offset="0.6" stop-color="#a04e2e"/><stop offset="1" stop-color="#7a3525"/></radialGradient></defs><circle cx="48" cy="48" r="46" fill="url(#g1)"/><circle cx="48" cy="48" r="38" fill="none" stroke="#f2c9a8" stroke-width="2" stroke-dasharray="4 5"/><circle cx="48" cy="48" r="31" fill="url(#g2)"/><g fill="#f2c9a8"><circle cx="48" cy="14" r="2.5"/><circle cx="82" cy="48" r="2.5"/><circle cx="48" cy="82" r="2.5"/><circle cx="14" cy="48" r="2.5"/></g><text x="48" y="50" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 48, [189, 102, 66]],
  },
  {
    name: 'badge-num-square', label: '方徽章·四角星标', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><rect x="4" y="4" width="88" height="88" rx="20" fill="url(#g1)"/><rect x="12" y="12" width="72" height="72" rx="14" fill="none" stroke="#cfe0da" stroke-width="2"/><g fill="#cfe0da"><path d="M24 24 L 34 24 L 24 34 Z"/><path d="M72 24 L 72 34 L 62 24 Z"/><path d="M72 72 L 62 72 L 72 62 Z"/><path d="M24 72 L 34 72 L 24 62 Z"/></g><text x="48" y="50" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 48, [160, 189, 184]],
  },
  {
    name: 'badge-num-hexagon', label: '六边徽章·双线描边', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><polygon points="48,2 86,25 86,71 48,94 10,71 10,25" fill="url(#g1)"/><polygon points="48,14 78,32 78,64 48,82 18,64 18,32" fill="none" stroke="#f5ecd9" stroke-width="2" stroke-dasharray="4 4"/><g fill="#f5ecd9"><circle cx="48" cy="8" r="2"/><circle cx="84" cy="48" r="2"/><circle cx="48" cy="88" r="2"/><circle cx="12" cy="48" r="2"/></g><text x="48" y="50" font-family="sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 48, [219, 193, 131]],
  },
  {
    name: 'badge-num-diamond', label: '菱形徽章·内虚线', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><rect x="30" y="30" width="52" height="52" rx="10" transform="rotate(45 48 48)" fill="url(#g1)"/><rect x="33" y="33" width="46" height="46" rx="8" transform="rotate(45 48 48)" fill="none" stroke="#cfe0da" stroke-width="2" stroke-dasharray="4 4"/><text x="48" y="50" font-family="sans-serif" font-size="30" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 48, [187, 209, 204]],
  },
  {
    name: 'badge-num-flower', label: '花形徽章·六瓣', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient><radialGradient id="g2" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#c96f4a"/><stop offset="0.6" stop-color="#a04e2e"/><stop offset="1" stop-color="#7a3525"/></radialGradient></defs><g fill="url(#g1)"><ellipse cx="48" cy="48" rx="20" ry="9" transform="rotate(0 48 48)"/><ellipse cx="48" cy="48" rx="20" ry="9" transform="rotate(60 48 48)"/><ellipse cx="48" cy="48" rx="20" ry="9" transform="rotate(120 48 48)"/><ellipse cx="48" cy="48" rx="20" ry="9" transform="rotate(180 48 48)"/><ellipse cx="48" cy="48" rx="20" ry="9" transform="rotate(240 48 48)"/><ellipse cx="48" cy="48" rx="20" ry="9" transform="rotate(300 48 48)"/></g><circle cx="48" cy="48" r="17" fill="url(#g2)"/><text x="48" y="50" font-family="sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 48, [189, 101, 66]],
  },
  {
    name: 'badge-num-ring', label: '环徽章·浅底金字', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f5ecd9"/><stop offset="1" stop-color="#e8d5a8"/></radialGradient></defs><circle cx="48" cy="48" r="44" fill="url(#g1)"/><circle cx="48" cy="48" r="38" fill="none" stroke="#b8860b" stroke-width="4"/><circle cx="48" cy="48" r="31" fill="none" stroke="#b8860b" stroke-width="1.5" stroke-dasharray="3 4"/><text x="48" y="50" font-family="sans-serif" font-size="30" font-weight="700" fill="#8a6a10" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 48, [250, 247, 239]],
  },
  {
    name: 'badge-num-banner', label: '旗形徽章·波浪下摆', w: 96, h: 96,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient><radialGradient id="g2" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#c96f4a"/><stop offset="0.6" stop-color="#a04e2e"/><stop offset="1" stop-color="#7a3525"/></radialGradient></defs><path d="M14 12 H82 V62 Q82 72 70 76 L48 86 L26 76 Q14 72 14 62 Z" fill="url(#g1)"/><path d="M14 12 H82 V22 H14 Z" fill="url(#g2)"/><text x="48" y="58" font-family="sans-serif" font-size="30" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">01</text></svg>`,
    probe: [48, 17, [188, 101, 65]],
  },

  // ================= 二、左右夹线（居中标题两侧，750×80；中央留空 ~300px 供嵌字） =================
  {
    name: 'clamp-line', label: '夹线·卷草端点', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="96" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><path d="M14 40 C 42 22, 74 58, 98 40" fill="none" stroke="url(#gL)" stroke-width="3" stroke-linecap="round"/><line x1="98" y1="40" x2="225" y2="40" stroke="url(#gL)" stroke-width="2"/><path d="M736 40 C 708 22, 676 58, 652 40" fill="none" stroke="url(#gL)" stroke-width="3" stroke-linecap="round"/><line x1="525" y1="40" x2="652" y2="40" stroke="url(#gL)" stroke-width="2"/><circle cx="14" cy="40" r="4" fill="url(#g1)"/><circle cx="12.8" cy="38.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="736" cy="40" r="4" fill="url(#g1)"/><circle cx="734.8" cy="38.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="98" cy="40" r="3" fill="url(#g1)"/><circle cx="97.1" cy="39.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="652" cy="40" r="3" fill="url(#g1)"/><circle cx="651.1" cy="39.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [200, 40, [242, 201, 168]]
  },
  {
    name: 'clamp-line-flower', label: '夹线·中心花饰', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><line x1="0" y1="40" x2="225" y2="40" stroke="url(#gL)" stroke-width="2"/><line x1="525" y1="40" x2="750" y2="40" stroke="url(#gL)" stroke-width="2"/><g fill="url(#g1)"><ellipse cx="375" cy="40" rx="9" ry="5" transform="rotate(-72 375 40)"/><ellipse cx="375" cy="40" rx="9" ry="5" transform="rotate(0 375 40)"/><ellipse cx="375" cy="40" rx="9" ry="5" transform="rotate(72 375 40)"/><ellipse cx="375" cy="40" rx="9" ry="5" transform="rotate(144 375 40)"/><ellipse cx="375" cy="40" rx="9" ry="5" transform="rotate(216 375 40)"/></g><circle cx="375" cy="40" r="4" fill="#cfe0da"/><path d="M225 40 Q 243 24 265 34" fill="none" stroke="url(#gL)" stroke-width="2" stroke-linecap="round"/><path d="M525 40 Q 507 24 485 34" fill="none" stroke="url(#gL)" stroke-width="2" stroke-linecap="round"/><g fill="url(#g1)"><circle cx="225" cy="40" r="2.5"/><circle cx="525" cy="40" r="2.5"/></g></svg>`,
    probe: [375, 33, [128, 165, 161]],
  },
  {
    name: 'clamp-line-double', label: '夹线·双线', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><line x1="0" y1="26" x2="225" y2="26" stroke="url(#gL)" stroke-width="2"/><line x1="0" y1="54" x2="225" y2="54" stroke="url(#gL)" stroke-width="2"/><line x1="525" y1="26" x2="750" y2="26" stroke="url(#gL)" stroke-width="2"/><line x1="525" y1="54" x2="750" y2="54" stroke="url(#gL)" stroke-width="2"/><circle cx="225" cy="26" r="3" fill="url(#g1)"/><circle cx="224.1" cy="25.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="225" cy="54" r="3" fill="url(#g1)"/><circle cx="224.1" cy="53.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="525" cy="26" r="3" fill="url(#g1)"/><circle cx="524.1" cy="25.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="525" cy="54" r="3" fill="url(#g1)"/><circle cx="524.1" cy="53.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [200, 26, [212, 181, 107]]
  },
  {
    name: 'clamp-vine', label: '夹线·藤蔓', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><path d="M4 40 C 44 16, 78 64, 118 40" fill="none" stroke="url(#gL)" stroke-width="3" stroke-linecap="round"/><path d="M746 40 C 706 16, 672 64, 632 40" fill="none" stroke="url(#gL)" stroke-width="3" stroke-linecap="round"/><line x1="118" y1="40" x2="225" y2="40" stroke="url(#gL)" stroke-width="2"/><line x1="525" y1="40" x2="632" y2="40" stroke="url(#gL)" stroke-width="2"/><g fill="url(#g1)"><ellipse cx="52" cy="26" rx="10" ry="5" transform="rotate(-35 52 26)"/><ellipse cx="86" cy="58" rx="9" ry="4.5" transform="rotate(30 86 58)"/><ellipse cx="698" cy="26" rx="10" ry="5" transform="rotate(35 698 26)"/><ellipse cx="664" cy="58" rx="9" ry="4.5" transform="rotate(-30 664 58)"/></g><circle cx="225" cy="40" r="3" fill="url(#g1)"/><circle cx="224.1" cy="39.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="525" cy="40" r="3" fill="url(#g1)"/><circle cx="524.1" cy="39.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [52, 26, [156, 186, 181]],
  },
  {
    name: 'clamp-dash', label: '夹线·虚线', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><line x1="0" y1="40" x2="225" y2="40" stroke="url(#gL)" stroke-width="3" stroke-dasharray="8 6"/><line x1="525" y1="40" x2="750" y2="40" stroke="url(#gL)" stroke-width="3" stroke-dasharray="8 6"/><circle cx="225" cy="40" r="5" fill="url(#g1)"/><circle cx="223.5" cy="38.4" r="1.5" fill="#ffffff" opacity="0.7"/><circle cx="525" cy="40" r="5" fill="url(#g1)"/><circle cx="523.5" cy="38.4" r="1.5" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [200, 40, [220, 152, 117]]
  },
  {
    name: 'clamp-arrow', label: '夹线·箭头', w: 750, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><line x1="0" y1="40" x2="225" y2="40" stroke="url(#gL)" stroke-width="2"/><line x1="525" y1="40" x2="750" y2="40" stroke="url(#gL)" stroke-width="2"/><polygon points="225,33 247,40 225,47" fill="url(#g1)"/><polygon points="525,33 503,40 525,47" fill="url(#g1)"/><circle cx="0" cy="40" r="4" fill="url(#g1)"/><circle cx="-1.2" cy="38.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="750" cy="40" r="4" fill="url(#g1)"/><circle cx="748.8" cy="38.7" r="1.2" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [150, 40, [220, 195, 134]]
  },

  // ================= 三、分隔线（标题上方/下方，750×70） =================
  {
    name: 'divider-ornate-single', label: '单线·中心菱形卷草', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><polygon points="375,18 392,35 375,52 358,35" fill="url(#g1)"/><line x1="392" y1="35" x2="640" y2="35" stroke="url(#gL)" stroke-width="2"/><line x1="358" y1="35" x2="110" y2="35" stroke="url(#gL)" stroke-width="2"/><path d="M110 35 Q 84 18 58 28 Q 40 35 30 35" fill="none" stroke="url(#gL)" stroke-width="2.5" stroke-linecap="round"/><path d="M640 35 Q 666 18 692 28 Q 710 35 720 35" fill="none" stroke="url(#gL)" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="35" r="3.5" fill="url(#g1)"/><circle cx="28.9" cy="33.9" r="1.1" fill="#ffffff" opacity="0.7"/><circle cx="720" cy="35" r="3.5" fill="url(#g1)"/><circle cx="719.0" cy="33.9" r="1.1" fill="#ffffff" opacity="0.7"/><circle cx="375" cy="17" r="2.5" fill="url(#g1)"/><circle cx="374.3" cy="16.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="375" cy="53" r="2.5" fill="url(#g1)"/><circle cx="374.3" cy="52.2" r="0.8" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [375, 35, [224, 162, 128]],
  },
  {
    name: 'divider-ornate-double', label: '双线·中心花形', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><line x1="60" y1="26" x2="690" y2="26" stroke="url(#gL)" stroke-width="1.5"/><line x1="60" y1="44" x2="690" y2="44" stroke="url(#gL)" stroke-width="1.5"/><g fill="url(#g1)"><ellipse cx="375" cy="35" rx="8" ry="4.5" transform="rotate(-72 375 35)"/><ellipse cx="375" cy="35" rx="8" ry="4.5" transform="rotate(0 375 35)"/><ellipse cx="375" cy="35" rx="8" ry="4.5" transform="rotate(72 375 35)"/><ellipse cx="375" cy="35" rx="8" ry="4.5" transform="rotate(144 375 35)"/><ellipse cx="375" cy="35" rx="8" ry="4.5" transform="rotate(216 375 35)"/></g><circle cx="375" cy="35" r="3.5" fill="#f5ecd9"/><circle cx="60" cy="26" r="2.5" fill="url(#g1)"/><circle cx="59.3" cy="25.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="690" cy="26" r="2.5" fill="url(#g1)"/><circle cx="689.3" cy="25.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="60" cy="44" r="2.5" fill="url(#g1)"/><circle cx="59.3" cy="43.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="690" cy="44" r="2.5" fill="url(#g1)"/><circle cx="689.3" cy="43.2" r="0.8" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [375, 29, [204, 168, 79]],
  },
  {
    name: 'divider-wave', label: '波浪分隔', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><path d="M0 44 Q 50 26 100 44 T 200 44 T 300 44 T 400 44 T 500 44 T 600 44 T 700 44" fill="none" stroke="url(#gL)" stroke-width="2.5" stroke-linecap="round"/><path d="M0 52 Q 50 38 100 52 T 200 52 T 300 52 T 400 52 T 500 52 T 600 52 T 700 52" fill="none" stroke="url(#gL)" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/><circle cx="0" cy="44" r="3" fill="url(#g1)"/><circle cx="-0.9" cy="43.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="750" cy="44" r="3" fill="url(#g1)"/><circle cx="749.1" cy="43.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [50, 35, [190, 212, 206]],
  },
  {
    name: 'divider-vine', label: '藤蔓花边分隔', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><path d="M150 35 C 118 16 88 54 56 35" fill="none" stroke="url(#gL)" stroke-width="2.5" stroke-linecap="round"/><path d="M600 35 C 632 16 662 54 694 35" fill="none" stroke="url(#gL)" stroke-width="2.5" stroke-linecap="round"/><line x1="150" y1="35" x2="320" y2="35" stroke="url(#gL)" stroke-width="2"/><line x1="430" y1="35" x2="600" y2="35" stroke="url(#gL)" stroke-width="2"/><g fill="url(#g1)"><ellipse cx="375" cy="35" rx="10" ry="5.5" transform="rotate(-72 375 35)"/><ellipse cx="375" cy="35" rx="10" ry="5.5" transform="rotate(0 375 35)"/><ellipse cx="375" cy="35" rx="10" ry="5.5" transform="rotate(72 375 35)"/><ellipse cx="375" cy="35" rx="10" ry="5.5" transform="rotate(144 375 35)"/><ellipse cx="375" cy="35" rx="10" ry="5.5" transform="rotate(216 375 35)"/></g><circle cx="375" cy="35" r="4.5" fill="#cfe0da"/><g fill="url(#g1)"><ellipse cx="105" cy="28" rx="9" ry="4.5" transform="rotate(-30 105 28)"/><ellipse cx="645" cy="28" rx="9" ry="4.5" transform="rotate(30 645 28)"/></g><circle cx="56" cy="35" r="3" fill="url(#g1)"/><circle cx="55.1" cy="34.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="694" cy="35" r="3" fill="url(#g1)"/><circle cx="693.1" cy="34.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [375, 28, [138, 173, 169]],
  },
  {
    name: 'divider-dash', label: '虚线点分隔', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><line x1="60" y1="35" x2="330" y2="35" stroke="url(#gL)" stroke-width="2.5" stroke-dasharray="10 8"/><line x1="420" y1="35" x2="690" y2="35" stroke="url(#gL)" stroke-width="2.5" stroke-dasharray="10 8"/><polygon points="375,22 386,35 375,48 364,35" fill="url(#g1)"/><circle cx="60" cy="35" r="4" fill="url(#g1)"/><circle cx="58.8" cy="33.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="690" cy="35" r="4" fill="url(#g1)"/><circle cx="688.8" cy="33.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="330" cy="35" r="3" fill="url(#g1)"/><circle cx="329.1" cy="34.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="420" cy="35" r="3" fill="url(#g1)"/><circle cx="419.1" cy="34.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [375, 35, [224, 162, 127]],
  },
  {
    name: 'divider-cloud', label: '云纹分隔', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><line x1="0" y1="40" x2="130" y2="40" stroke="url(#gL)" stroke-width="2"/><line x1="620" y1="40" x2="750" y2="40" stroke="url(#gL)" stroke-width="2"/><g fill="url(#g1)"><circle cx="178" cy="42" r="14"/><circle cx="204" cy="34" r="17"/><circle cx="232" cy="42" r="13"/><rect x="178" y="40" width="54" height="14" rx="7"/></g><g fill="url(#g1)"><circle cx="358" cy="42" r="14"/><circle cx="384" cy="34" r="17"/><circle cx="412" cy="42" r="13"/><rect x="358" y="40" width="54" height="14" rx="7"/></g><g fill="url(#g1)"><circle cx="538" cy="42" r="13"/><circle cx="560" cy="35" r="15"/><circle cx="584" cy="42" r="12"/><rect x="538" y="40" width="46" height="13" rx="6.5"/></g></svg>`,
    probe: [375, 40, [110, 152, 148]],
  },
  {
    name: 'divider-star', label: '星点分隔', w: 750, h: 70,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 70"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><path d="M375 16 L 380 30 L 394 35 L 380 40 L 375 54 L 370 40 L 356 35 L 370 30 Z" fill="url(#g1)"/><line x1="394" y1="35" x2="650" y2="35" stroke="url(#gL)" stroke-width="2"/><line x1="356" y1="35" x2="100" y2="35" stroke="url(#gL)" stroke-width="2"/><g fill="url(#g1)"><path d="M100 26 L 103 33 L 110 35 L 103 37 L 100 44 L 97 37 L 90 35 L 97 33 Z"/><path d="M650 26 L 653 33 L 660 35 L 653 37 L 650 44 L 647 37 L 640 35 L 647 33 Z"/><circle cx="60" cy="35" r="3"/><circle cx="690" cy="35" r="3"/></g></svg>`,
    probe: [375, 35, [219, 192, 129]],
  },

  // ================= 四、几何点缀（与标题组合/独立，300×64） =================
  {
    name: 'accent-sparkle', label: '星芒圆环组', w: 300, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><line x1="16" y1="32" x2="118" y2="32" stroke="url(#gL)" stroke-width="2"/><line x1="182" y1="32" x2="284" y2="32" stroke="url(#gL)" stroke-width="2"/><path d="M150 8 L 155 27 L 174 32 L 155 37 L 150 56 L 145 37 L 126 32 L 145 27 Z" fill="url(#g1)"/><circle cx="150" cy="32" r="18" fill="none" stroke="url(#gL)" stroke-width="2" stroke-dasharray="3 4"/><circle cx="118" cy="32" r="3" fill="url(#g1)"/><circle cx="117.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="182" cy="32" r="3" fill="url(#g1)"/><circle cx="181.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="70" cy="20" r="2.5" fill="url(#g1)"/><circle cx="69.3" cy="19.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="70" cy="44" r="2" fill="url(#g1)"/><circle cx="69.4" cy="43.4" r="0.6" fill="#ffffff" opacity="0.7"/><circle cx="230" cy="20" r="2.5" fill="url(#g1)"/><circle cx="229.3" cy="19.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="230" cy="44" r="2" fill="url(#g1)"/><circle cx="229.4" cy="43.4" r="0.6" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [150, 32, [224, 163, 128]],
  },
  {
    name: 'accent-leaf', label: '双叶脉组', w: 300, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><line x1="16" y1="32" x2="120" y2="32" stroke="url(#gL)" stroke-width="2"/><line x1="180" y1="32" x2="284" y2="32" stroke="url(#gL)" stroke-width="2"/><path d="M150 32 C 150 12, 172 8, 178 24 C 184 40, 168 56, 150 32 Z" fill="url(#g1)"/><path d="M150 32 C 150 12, 128 8, 122 24 C 116 40, 132 56, 150 32 Z" fill="url(#g1)"/><path d="M150 14 L 150 50" stroke="#cfe0da" stroke-width="1.5"/><circle cx="120" cy="32" r="3" fill="url(#g1)"/><circle cx="119.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="180" cy="32" r="3" fill="url(#g1)"/><circle cx="179.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [140, 20, [129, 166, 162]],
  },
  {
    name: 'accent-diamond-chain', label: '菱形链', w: 300, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><line x1="16" y1="32" x2="92" y2="32" stroke="url(#gL)" stroke-width="2"/><line x1="208" y1="32" x2="284" y2="32" stroke="url(#gL)" stroke-width="2"/><polygon points="150,18 163,32 150,46 137,32" fill="url(#g1)"/><polygon points="105,25 112,32 105,39 98,32" fill="url(#g1)"/><polygon points="195,25 202,32 195,39 188,32" fill="url(#g1)"/><circle cx="92" cy="32" r="3" fill="url(#g1)"/><circle cx="91.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="208" cy="32" r="3" fill="url(#g1)"/><circle cx="207.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [150, 32, [218, 192, 129]],
  },
  {
    name: 'accent-dots', label: '圆点组', w: 300, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><line x1="16" y1="32" x2="46" y2="32" stroke="url(#gL)" stroke-width="2"/><line x1="254" y1="32" x2="284" y2="32" stroke="url(#gL)" stroke-width="2"/><circle cx="62" cy="32" r="4" fill="url(#g1)"/><circle cx="60.8" cy="30.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="92" cy="32" r="6" fill="url(#g1)"/><circle cx="90.2" cy="30.1" r="1.8" fill="#ffffff" opacity="0.7"/><circle cx="128" cy="32" r="7.5" fill="url(#g1)"/><circle cx="125.8" cy="29.6" r="2.3" fill="#ffffff" opacity="0.7"/><circle cx="168" cy="32" r="7.5" fill="url(#g1)"/><circle cx="165.8" cy="29.6" r="2.3" fill="#ffffff" opacity="0.7"/><circle cx="204" cy="32" r="6" fill="url(#g1)"/><circle cx="202.2" cy="30.1" r="1.8" fill="#ffffff" opacity="0.7"/><circle cx="236" cy="32" r="4" fill="url(#g1)"/><circle cx="234.8" cy="30.7" r="1.2" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [128, 32, [157, 187, 182]],
  },
  {
    name: 'accent-triangle', label: '三角组', w: 300, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><line x1="16" y1="32" x2="120" y2="32" stroke="url(#gL)" stroke-width="2"/><line x1="180" y1="32" x2="284" y2="32" stroke="url(#gL)" stroke-width="2"/><polygon points="150,16 168,46 132,46" fill="url(#g1)"/><polygon points="122,26 130,42 114,42" fill="url(#g1)"/><polygon points="178,26 186,42 170,42" fill="url(#g1)"/><circle cx="120" cy="32" r="3" fill="url(#g1)"/><circle cx="119.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="180" cy="32" r="3" fill="url(#g1)"/><circle cx="179.1" cy="31.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [150, 32, [221, 156, 121]],
  },

  // ================= 五、卷曲与角饰（标题左锚点/角落） =================
  {
    name: 'flourish-double', label: '双卷曲·中菱形', w: 160, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="160" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><path d="M8 32 C 28 8, 60 52, 82 32 C 94 20, 104 24, 110 30" fill="none" stroke="url(#gL)" stroke-width="4" stroke-linecap="round"/><path d="M152 32 C 132 8, 100 52, 78 32 C 66 20, 56 24, 50 30" fill="none" stroke="url(#gL)" stroke-width="4" stroke-linecap="round"/><polygon points="80,26 86,32 80,38 74,32" fill="url(#g1)"/></svg>`,
    probe: [80, 32, [217, 190, 125]],
  },
  {
    name: 'flourish-single', label: '单卷曲·带叶', w: 120, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 64"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><path d="M8 32 C 26 10, 50 52, 70 32 C 82 20, 92 24, 98 30" fill="none" stroke="url(#gL)" stroke-width="4" stroke-linecap="round"/><ellipse cx="42" cy="26" rx="10" ry="5" fill="url(#g1)" transform="rotate(-40 42 26)"/><circle cx="98" cy="30" r="3.5" fill="url(#g1)"/><circle cx="97.0" cy="28.9" r="1.1" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [42, 26, [223, 160, 125]],
  },
  {
    name: 'corner-vine', label: '卷草角饰', w: 120, h: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><g fill="none" stroke="url(#gL)" stroke-linecap="round"><path d="M22 106 C 22 56 64 24 104 22" stroke-width="9"/><path d="M26 108 C 34 70 66 44 92 40" stroke-width="4" opacity="0.7"/><path d="M104 22 Q 116 20 118 32" stroke-width="6"/><path d="M22 106 Q 18 92 30 88" stroke-width="6"/></g><g fill="url(#g1)"><circle cx="92" cy="40" r="4"/><circle cx="56" cy="70" r="3"/><circle cx="40" cy="92" r="3"/></g></svg>`,
    probe: [56, 70, [153, 184, 179]],
  },
  {
    name: 'corner-flower', label: '花枝角饰', w: 120, h: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><path d="M24 108 C 24 62 62 24 108 24" fill="none" stroke="url(#gL)" stroke-width="8" stroke-linecap="round"/><g fill="url(#g1)"><ellipse cx="108" cy="24" rx="8" ry="4.5" transform="rotate(-72 108 24)"/><ellipse cx="108" cy="24" rx="8" ry="4.5" transform="rotate(0 108 24)"/><ellipse cx="108" cy="24" rx="8" ry="4.5" transform="rotate(72 108 24)"/><ellipse cx="108" cy="24" rx="8" ry="4.5" transform="rotate(144 108 24)"/><ellipse cx="108" cy="24" rx="8" ry="4.5" transform="rotate(216 108 24)"/></g><circle cx="108" cy="24" r="3.5" fill="url(#g1)"/><circle cx="107.0" cy="22.9" r="1.1" fill="#ffffff" opacity="0.7"/><g fill="url(#g1)"><circle cx="66" cy="52" r="5"/><circle cx="42" cy="80" r="4"/></g><ellipse cx="80" cy="74" rx="9" ry="4.5" fill="url(#g1)" transform="rotate(-45 80 74)"/></svg>`,
    probe: [30, 80, [221, 155, 120]]
  },

  // ================= 六、缎带横幅（标题上方/活动标识） =================
  {
    name: 'banner-mini', label: '小缎带横幅', w: 300, h: 90,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><path d="M40 12 L 260 12 L 240 45 L 260 78 L 40 78 L 60 45 Z" fill="url(#g1)"/><path d="M40 12 L 56 18 L 60 45 L 56 72 L 40 78 L 52 45 Z" fill="url(#g1)"/><path d="M260 12 L 244 18 L 240 45 L 244 72 L 260 78 L 248 45 Z" fill="url(#g1)"/><line x1="70" y1="45" x2="230" y2="45" stroke="#f2c9a8" stroke-width="2" stroke-dasharray="6 6"/><circle cx="56" cy="20" r="2" fill="#f2c9a8"/><circle cx="244" cy="20" r="2" fill="#f2c9a8"/></svg>`,
    probe: [150, 45, [224, 163, 128]],
  },
  {
    name: 'banner-flag', label: '三角旗串', w: 240, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><path d="M0 22 Q 120 12 240 22" fill="none" stroke="url(#gL)" stroke-width="2"/><polygon points="24,24 66,24 45,54" fill="url(#g1)"/><polygon points="100,22 142,22 121,52" fill="url(#g1)"/><polygon points="176,24 218,24 197,54" fill="url(#g1)"/><circle cx="12" cy="21" r="4" fill="url(#g1)"/><circle cx="10.8" cy="19.7" r="1.2" fill="#ffffff" opacity="0.7"/><circle cx="228" cy="21" r="4" fill="url(#g1)"/><circle cx="226.8" cy="19.7" r="1.2" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [121, 32, [184, 207, 201]],
  },
  {
    name: 'banner-scroll', label: '卷轴横幅', w: 300, h: 80,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><rect x="48" y="14" width="12" height="52" rx="6" fill="url(#g1)"/><rect x="240" y="14" width="12" height="52" rx="6" fill="url(#g1)"/><rect x="60" y="22" width="180" height="36" rx="4" fill="url(#g1)"/><line x1="80" y1="40" x2="220" y2="40" stroke="#f5ecd9" stroke-width="2" stroke-dasharray="6 5"/><circle cx="48" cy="18" r="3" fill="url(#g1)"/><circle cx="47.1" cy="17.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="252" cy="18" r="3" fill="url(#g1)"/><circle cx="251.1" cy="17.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [150, 30, [223, 199, 142]],
  },

  // ================= 七、下划线（标题文字下方，360×24） =================
  {
    name: 'underline-wave', label: '波浪下划线', w: 360, h: 24,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 24"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><path d="M4 14 Q 48 4 92 14 T 180 14 T 268 14 T 356 14" fill="none" stroke="url(#gL)" stroke-width="4" stroke-linecap="round"/><circle cx="4" cy="14" r="2.5" fill="url(#g1)"/><circle cx="3.3" cy="13.2" r="0.8" fill="#ffffff" opacity="0.7"/><circle cx="356" cy="14" r="2.5" fill="url(#g1)"/><circle cx="355.3" cy="13.2" r="0.8" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [48, 9, [177, 201, 196]]
  },
  {
    name: 'underline-double', label: '双线下划线', w: 360, h: 24,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 24"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><line x1="4" y1="9" x2="356" y2="9" stroke="url(#gL)" stroke-width="2.5"/><line x1="4" y1="17" x2="356" y2="17" stroke="url(#gL)" stroke-width="1.5"/><circle cx="4" cy="9" r="2" fill="url(#g1)"/><circle cx="3.4" cy="8.4" r="0.6" fill="#ffffff" opacity="0.7"/><circle cx="356" cy="9" r="2" fill="url(#g1)"/><circle cx="355.4" cy="8.4" r="0.6" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [180, 9, [201, 111, 74]]
  },
  {
    name: 'underline-scribble', label: '涂鸦下划线', w: 360, h: 24,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 24"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><path d="M4 15 C 70 5 120 20 180 12 C 240 4 290 18 356 11" fill="none" stroke="url(#gL)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    probe: [180, 12, [184, 134, 11]]
  },

  // ================= 八、标题框（标题整体套框，600×120） =================
  {
    name: 'frame-title-round', label: '圆角标题框', w: 600, h: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.5" stop-color="#c96f4a"/><stop offset="1" stop-color="#f2c9a8"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient></defs><rect x="20" y="20" width="560" height="80" rx="16" fill="none" stroke="url(#gL)" stroke-width="3"/><circle cx="20" cy="20" r="5" fill="url(#g1)"/><circle cx="18.5" cy="18.4" r="1.5" fill="#ffffff" opacity="0.7"/><circle cx="580" cy="20" r="5" fill="url(#g1)"/><circle cx="578.5" cy="18.4" r="1.5" fill="#ffffff" opacity="0.7"/><circle cx="20" cy="100" r="5" fill="url(#g1)"/><circle cx="18.5" cy="98.4" r="1.5" fill="#ffffff" opacity="0.7"/><circle cx="580" cy="100" r="5" fill="url(#g1)"/><circle cx="578.5" cy="98.4" r="1.5" fill="#ffffff" opacity="0.7"/><line x1="36" y1="20" x2="100" y2="20" stroke="url(#gL)" stroke-width="2"/><line x1="500" y1="20" x2="564" y2="20" stroke="url(#gL)" stroke-width="2"/><line x1="36" y1="100" x2="100" y2="100" stroke="url(#gL)" stroke-width="2"/><line x1="500" y1="100" x2="564" y2="100" stroke="url(#gL)" stroke-width="2"/></svg>`,
    probe: [20, 60, [241, 200, 167]],
  },
  {
    name: 'frame-title-double', label: '双线标题框', w: 600, h: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.5" stop-color="#5f8d8a"/><stop offset="1" stop-color="#cfe0da"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#cfe0da"/><stop offset="0.55" stop-color="#5f8d8a"/><stop offset="1" stop-color="#3f6b68"/></radialGradient></defs><rect x="18" y="18" width="564" height="84" rx="14" fill="none" stroke="url(#gL)" stroke-width="2.5"/><rect x="34" y="34" width="532" height="52" rx="10" fill="none" stroke="url(#gL)" stroke-width="1.5" stroke-dasharray="5 5"/><circle cx="34" cy="34" r="3" fill="url(#g1)"/><circle cx="33.1" cy="33.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="566" cy="34" r="3" fill="url(#g1)"/><circle cx="565.1" cy="33.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="34" cy="86" r="3" fill="url(#g1)"/><circle cx="33.1" cy="85.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="566" cy="86" r="3" fill="url(#g1)"/><circle cx="565.1" cy="85.0" r="0.9" fill="#ffffff" opacity="0.7"/></svg>`,
    probe: [18, 60, [206, 223, 217]],
  },
  {
    name: 'frame-title-corner', label: '四角花框', w: 600, h: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120"><defs><linearGradient id="gL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#f5ecd9"/></linearGradient><radialGradient id="g1" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.55" stop-color="#b8860b"/><stop offset="1" stop-color="#8a6a10"/></radialGradient></defs><g id="corner"><path d="M30 104 C 30 60 62 30 106 30" fill="none" stroke="url(#gL)" stroke-width="5" stroke-linecap="round"/><g fill="url(#g1)"><ellipse cx="106" cy="30" rx="7" ry="4" transform="rotate(-72 106 30)"/><ellipse cx="106" cy="30" rx="7" ry="4" transform="rotate(0 106 30)"/><ellipse cx="106" cy="30" rx="7" ry="4" transform="rotate(72 106 30)"/><ellipse cx="106" cy="30" rx="7" ry="4" transform="rotate(144 106 30)"/><ellipse cx="106" cy="30" rx="7" ry="4" transform="rotate(216 106 30)"/></g><circle cx="106" cy="30" r="3" fill="url(#g1)"/><circle cx="105.1" cy="29.0" r="0.9" fill="#ffffff" opacity="0.7"/><circle cx="64" cy="70" r="3.5" fill="url(#g1)"/><circle cx="63.0" cy="68.9" r="1.1" fill="#ffffff" opacity="0.7"/></g><use href="#corner" transform="scale(-1,1) translate(-600,0)"/><use href="#corner" transform="scale(1,-1) translate(0,-120)"/><use href="#corner" transform="scale(-1,-1) translate(-600,-120)"/></svg>`,
    probe: [64, 70, [216, 187, 119]],
  },
]

// 校验（转正前跑）：名称唯一 / label 唯一 / w h 为正整数 / svg 含 <svg 且标签闭合 / probe 完整
export function validateSubheadingArts() {
  const names = subheadingArts.map((a) => a.name)
  const labels = subheadingArts.map((a) => a.label)
  const dupName = names.filter((n, i) => names.indexOf(n) !== i)
  const dupLabel = labels.filter((l, i) => labels.indexOf(l) !== i)
  const bad = subheadingArts.filter((a) => {
    if (!(a.w > 0 && a.h > 0) || !/^<svg/.test(a.svg)) return true
    const open = (a.svg.match(/<svg/g) || []).length
    const close = (a.svg.match(/<\/svg>/g) || []).length
    if (open !== 1 || close !== 1) return true
    if (!Array.isArray(a.probe) || a.probe.length !== 3 || !Array.isArray(a.probe[2]) || a.probe[2].length !== 3) return true
    return false
  })
  return {
    count: subheadingArts.length,
    dupName, dupLabel, bad,
    ok: dupName.length === 0 && dupLabel.length === 0 && bad.length === 0,
  }
}
