// test/assets/divider/divider-scan.mjs
// 装饰洁净带扫描器（严格版）——§5.0 ② 验证闭环第二层
// 纯浏览器端可执行（不依赖 Node API）。k：坐标缩放（4x 渲染 k=4；375 显示 k=DIVIDER_SCALE）
// d 为 ImageData.data（RGBA）。判定项（全部通过 = 洁净带突变 0）：
//   parts    —— 前景连通部件数 == 声明（精确比较，抓浮动装饰/断线/装饰互叠合并）
//   cont     —— 线体主轴行（axisY）上 lineSpan 各区间像素全部为前景（线体连贯）
//   mainRuns —— 主轴行 run 数 == 声明（精确比较）
//   maxRuns  —— 任何一行 run 数 ≤ 上限（行碎片/装饰拥挤）
//   specks   —— 无面积 < speckArea 的小杂点
//   contain  —— contain 模式：所有前景严格落在 y10..80；empty 模式：y10..80 必须为空
// 铁律：probe/洁净带校准坐标不放宽容差——精确比较保证声明与实测一致，任何不符即判违规。
export function scanCleanBand(art, d, cw, ch, k, speckArea) {
  const fg = new Uint8Array(cw * ch)
  for (let i = 0; i < cw * ch; i++) fg[i] = d[i * 4 + 3] >= 60 ? 1 : 0
  // 连通部件（4-邻接 BFS）
  const comp = new Int32Array(cw * ch).fill(-1)
  let ncomp = 0
  const areas = []
  const stack = []
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const idx = y * cw + x
      if (!fg[idx] || comp[idx] !== -1) continue
      let area = 0
      stack.length = 0
      stack.push(idx)
      comp[idx] = ncomp
      while (stack.length) {
        const p = stack.pop()
        area++
        const px = p % cw, py = (p / cw) | 0
        if (px + 1 < cw && fg[p + 1] && comp[p + 1] === -1) { comp[p + 1] = ncomp; stack.push(p + 1) }
        if (px - 1 >= 0 && fg[p - 1] && comp[p - 1] === -1) { comp[p - 1] = ncomp; stack.push(p - 1) }
        if (py + 1 < ch && fg[p + cw] && comp[p + cw] === -1) { comp[p + cw] = ncomp; stack.push(p + cw) }
        if (py - 1 >= 0 && fg[p - cw] && comp[p - cw] === -1) { comp[p - cw] = ncomp; stack.push(p - cw) }
      }
      areas.push(area)
      ncomp++
    }
  }
  // 每行 run 数
  const runsRow = new Int32Array(ch)
  for (let y = 0; y < ch; y++) {
    let runs = 0, prev = 0
    for (let x = 0; x < cw; x++) {
      const f = fg[y * cw + x]
      if (f && !prev) runs++
      prev = f
    }
    runsRow[y] = runs
  }
  const bandY0 = Math.round(art.band.y0 * k), bandY1 = Math.round(art.band.y1 * k)
  const axisY = Math.round(art.lineCheck.axisY * k)
  const violations = []
  // 1. 部件数（精确）
  if (ncomp !== art.band.parts) violations.push('parts:' + ncomp + '≠' + art.band.parts)
  // 2. 线体连贯（主轴行 span 全覆盖，边界夹取到画布内）
  for (const [a, b] of art.lineCheck.span) {
    const xa = Math.max(Math.ceil(a * k), 0), xb = Math.min(Math.floor(b * k), cw - 1)
    for (let x = xa; x <= xb; x++) {
      if (!fg[axisY * cw + x]) { violations.push('gap@x' + (x / k).toFixed(1)); break }
    }
  }
  // 3. 主轴行 run 数（精确）
  if (runsRow[axisY] !== art.band.mainRuns) violations.push('mainRuns:' + runsRow[axisY] + '≠' + art.band.mainRuns)
  // 4. 行碎片上限
  let maxR = 0
  for (let y = 0; y < ch; y++) if (runsRow[y] > maxR) maxR = runsRow[y]
  if (maxR > art.band.maxRuns) violations.push('maxRuns:' + maxR + '>' + art.band.maxRuns)
  // 5. 杂点
  const specks = areas.filter((a) => a < speckArea).length
  if (specks > 0) violations.push('specks:' + specks)
  // 6. 带内带外约束
  if (art.band.mode === 'contain') {
    let out = 0
    for (let y = 0; y < bandY0; y++) for (let x = 0; x < cw; x++) if (fg[y * cw + x]) out++
    for (let y = bandY1; y < ch; y++) for (let x = 0; x < cw; x++) if (fg[y * cw + x]) out++
    if (out > 0) violations.push('outsideBand:' + out)
  } else {
    let inside = 0
    for (let y = bandY0; y < bandY1; y++) for (let x = 0; x < cw; x++) if (fg[y * cw + x]) inside++
    if (inside > 0) violations.push('insideBand:' + inside)
  }
  // 线体显示厚度：主轴行上沿首个 span 均匀取 5 点，测各点纵向连续前景高度，取中位数（设计 px）
  const s0 = art.lineCheck.span[0]
  const xs = []
  for (let i = 0; i < 5; i++) xs.push(s0[0] + (s0[1] - s0[0]) * (i + 0.5) / 5)
  const runs = []
  for (const x0 of xs) {
    const x = Math.round(x0 * k)
    if (!fg[axisY * cw + x]) { runs.push(0); continue }
    let up = axisY, down = axisY
    while (up > 0 && fg[(up - 1) * cw + x]) up--
    while (down < ch - 1 && fg[(down + 1) * cw + x]) down++
    runs.push((down - up + 1) / k)
  }
  runs.sort((a, b) => a - b)
  const thick = runs.length ? runs[2] : 0
  return { violations, ncomp, maxR, thick, runsRowAxis: runsRow[axisY] }
}

// 浏览器注入用源码（页面内 eval 还原，避免 Playwright 参数序列化限制）
export const scanCleanBandSrc = scanCleanBand.toString()
