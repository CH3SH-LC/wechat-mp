// ============================================================
// v5 精细度 ×4 辅助函数库（2026-08-29 第 5 轮，用户要求"所有 svg 精细度优化到当前 4 倍"）
// 精细度标准（相对旧版 ×4）：
//   花瓣 1 层 → 4 层（外瓣渐变 + 中层深色 + 内层浅色 + 高光月牙）+ 花蕊丝
//   渐变 2-3 stop → 4-6 stop（径向/线性，明→中→暗→深）
//   每装饰部件 1-2 → 3-5（主体 + 内层 + 高光 + 纹理 + 附属）
//   叶子：渐变主体 + 主脉 + 侧脉×2 + 边缘高光
//   珍珠：径向渐变（白→浅→主色）+ 偏移高光点
//   曲线：S 形双弧 + 端点渐变
// 注：SVG 仅本地渲染为 PNG（4x），正文 CSS 平面化铁律不受影响
// ============================================================

// —— 4 层花瓣花：cx,cy 中心；r 外瓣半径；g1 外瓣渐变 id；g2 中层渐变 id；heart 花心色
// 输出：外瓣(渐变) + 中层瓣(深色 0.8) + 内层瓣(浅色 0.9) + 花蕊丝 + 花心 + 高光月牙
export function flower5X(cx, cy, r, g1, g2, heart) {
  const p = (rr, gid, op) =>
    `<g fill="${gid}" opacity="${op}"><ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * 0.52}" transform="rotate(-72 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * 0.52}" transform="rotate(0 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * 0.52}" transform="rotate(72 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * 0.52}" transform="rotate(144 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * 0.52}" transform="rotate(216 ${cx} ${cy})"/></g>`
  const stamen = (a) => {
    const x = cx + Math.cos(a) * r * 0.62, y = cy + Math.sin(a) * r * 0.62
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${heart}" stroke-width="1" opacity="0.7"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.2" fill="${heart}"/>`
  }
  return p(r, `url(#${g1})`, 1) +
    p(r * 0.68, `url(#${g2})`, 0.85) +
    p(r * 0.4, `url(#${g1})`, 0.9) +
    stamen(-90 * Math.PI / 180) + stamen(150 * Math.PI / 180) + stamen(30 * Math.PI / 180) +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="${heart}"/>` +
    `<circle cx="${cx - r * 0.1}" cy="${cy - r * 0.1}" r="${r * 0.12}" fill="#ffffff" opacity="0.75"/>`
}

// —— 高精细叶片：sx,sy 起点；ex,ey 终点；w 叶宽；g1 叶面渐变；g2 侧脉渐变
// 输出：主体(渐变) + 主脉 + 侧脉×2 + 边缘高光
export function leafX(sx, sy, ex, ey, w, g1, g2) {
  const mx = (sx + ex) / 2, my = (sy + ey) / 2
  // 法线方向（垂直叶轴）
  const dx = ex - sx, dy = ey - sy
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / len * w, ny = dx / len * w
  const qx1 = mx + nx * 0.6, qy1 = my + ny * 0.6  // 上弧控制点
  const qx2 = mx - nx * 0.6, qy2 = my - ny * 0.6  // 下弧控制点
  // 侧脉点
  const t1x = sx + dx * 0.3, t1y = sy + dy * 0.3
  const t2x = sx + dx * 0.62, t2y = sy + dy * 0.62
  const s1x = t1x + nx * 0.38, s1y = t1y + ny * 0.38
  const s2x = t2x + nx * 0.42, s2y = t2y + ny * 0.42
  const s3x = t1x - nx * 0.38, s3y = t1y - ny * 0.38
  const s4x = t2x - nx * 0.42, s4y = t2y - ny * 0.42
  return `<g><path d="M${sx} ${sy} Q ${qx1.toFixed(1)} ${qy1.toFixed(1)} ${ex} ${ey} Q ${qx2.toFixed(1)} ${qy2.toFixed(1)} ${sx} ${sy} Z" fill="url(#${g1})"/>` +
    `<path d="M${sx} ${sy} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex} ${ey}" fill="none" stroke="#3f6b68" stroke-width="1.6" opacity="0.55"/>` +
    `<path d="M${t1x.toFixed(1)} ${t1y.toFixed(1)} L ${s1x.toFixed(1)} ${s1y.toFixed(1)}" stroke="#3f6b68" stroke-width="1" opacity="0.4"/>` +
    `<path d="M${t2x.toFixed(1)} ${t2y.toFixed(1)} L ${s2x.toFixed(1)} ${s2y.toFixed(1)}" stroke="#3f6b68" stroke-width="1" opacity="0.4"/>` +
    `<path d="M${t1x.toFixed(1)} ${t1y.toFixed(1)} L ${s3x.toFixed(1)} ${s3y.toFixed(1)}" stroke="#3f6b68" stroke-width="1" opacity="0.4"/>` +
    `<path d="M${t2x.toFixed(1)} ${t2y.toFixed(1)} L ${s4x.toFixed(1)} ${s4y.toFixed(1)}" stroke="#3f6b68" stroke-width="1" opacity="0.4"/>` +
    `<path d="M${sx} ${sy} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex} ${ey}" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.25" transform="translate(${(-nx * 0.12).toFixed(1)} ${(-ny * 0.12).toFixed(1)})"/>` +
    `</g>`
}

// —— 高精细珍珠：cx,cy 中心；r 半径；g 渐变 id（白→浅→主色）；主色
export function pearlX(cx, cy, r, g) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})"/>` +
    `<circle cx="${cx - r * 0.28}" cy="${cy - r * 0.3}" r="${r * 0.32}" fill="#ffffff" opacity="0.85"/>` +
    `<circle cx="${cx + r * 0.2}" cy="${cy + r * 0.25}" r="${r * 0.14}" fill="#ffffff" opacity="0.4"/>`
}

// —— 渐变定义生成器：linear/radial + 4-6 stop
export function gradLinear(id, x1, y1, x2, y2, stops) {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</linearGradient>`
}
export function gradRadial(id, stops) {
  return `<radialGradient id="${id}" cx="0.5" cy="0.38" r="0.72">` +
    stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + `</radialGradient>`
}

// —— S 形卷曲（藤蔓/卷草）：x,y 起点；l 长度；a 角度（弧度）；w 线宽；c 色
export function curlS(x, y, l, a, w, c) {
  const ax = Math.cos(a), ay = Math.sin(a)
  const p1x = x + l * ax * 0.35, p1y = y + l * ay * 0.35
  const p2x = x + l * ax * 0.55 - l * 0.25 * ay, p2y = y + l * ay * 0.55 + l * 0.25 * ax
  const p3x = x + l * ax * 0.75 + l * 0.1 * ay, p3y = y + l * ay * 0.75 - l * 0.1 * ax
  const ex = x + l * ax * 0.95, ey = y + l * ay * 0.95
  return `<path d="M${x} ${y} C ${p1x.toFixed(1)} ${p1y.toFixed(1)}, ${p2x.toFixed(1)} ${p2y.toFixed(1)}, ${p3x.toFixed(1)} ${p3y.toFixed(1)} S ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`
}
