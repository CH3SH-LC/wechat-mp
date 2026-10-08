import { analyzeSvg } from '../../../src/lib/svg-quality.ts'
const R = s => { const m = analyzeSvg(s, {w:300,h:300}); return `vb=${m.viewBox.w}x${m.viewBox.h} el=${m.elements} off=${m.offCanvas} cov=${m.coverage.toFixed(2)} inkX=${m.inkXRatio.toFixed(2)}` }
const NS='http://www.w3.org/2000/svg'
// 画布原点被平移：viewBox 覆盖 x∈[-400,350]，元素放在 x∈[-300,-200] —— 应当可见
console.log('D3a  viewBox="-400 -200 750 220"，内容 x=-300..-200（在画布内）')
console.log('    ', R(`<svg xmlns="${NS}" viewBox="-400 -200 750 220"><rect x="-300" y="-150" width="100" height="100" fill="#333"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`))
console.log('D3b  同一批绝对坐标，若画布真是 0..750 —— 这才是"确实画布外"')
console.log('    ', R(`<svg xmlns="${NS}" viewBox="0 0 750 220"><rect x="-300" y="-150" width="100" height="100" fill="#333"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`))
console.log('    → 两者判定完全相同：解析 viewBox 时 min-x/min-y 被丢弃，画布永远被当成 [0,w]x[0,h]')
