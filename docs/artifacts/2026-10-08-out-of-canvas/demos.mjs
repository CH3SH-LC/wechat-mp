import { analyzeSvg, checkSvgQuality } from '../../../src/lib/svg-quality.ts'
const R = (svg, slot) => { const m = analyzeSvg(svg, slot || {w:300,h:300}); return { el: m.elements, vis: m.visible, off: m.offCanvas, vb: m.viewBox } }
const show = (name, svg, slot) => console.log(name.padEnd(58), JSON.stringify(R(svg, slot)))
const NS = 'http://www.w3.org/2000/svg'

console.log('--- D1: 贴在画布边缘的「零厚度」元素（可见，但有整整一维为 0）---')
show('D1a 顶边横线 <line y1=0 y2=0> 实心描边', `<svg xmlns="${NS}" viewBox="0 0 750 220"><line x1="0" y1="0" x2="750" y2="0" stroke="#333" stroke-width="4"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D1b 底边横线 y=220', `<svg xmlns="${NS}" viewBox="0 0 750 220"><line x1="0" y1="220" x2="750" y2="220" stroke="#333" stroke-width="4"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D1c 左边竖线 x=0', `<svg xmlns="${NS}" viewBox="0 0 750 220"><line x1="0" y1="0" x2="0" y2="220" stroke="#333" stroke-width="4"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D1d 同一条线移到 y=1（不在边界）', `<svg xmlns="${NS}" viewBox="0 0 750 220"><line x1="0" y1="1" x2="750" y2="1" stroke="#333" stroke-width="4"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D1e path "M0 0 H750" 顶边', `<svg xmlns="${NS}" viewBox="0 0 750 220"><path d="M0 0 H750" stroke="#333" stroke-width="4" fill="none"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D1f 零尺寸 rect 在原点', `<svg xmlns="${NS}" viewBox="0 0 750 220"><rect x="0" y="0" width="0" height="220" fill="#333"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D1g <image> 无 x/y/w/h（默认 0）', `<svg xmlns="${NS}" viewBox="0 0 750 220"><image href="photo.png"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)

console.log('\n--- D2: 祖先 <g transform> 把子元素搬进画布，判定却按「变换前的原始坐标」---')
const inner = `<rect x="900" y="300" width="80" height="60" fill="#333"/>`
show('D2a 原始坐标 (900,300)：无祖先 transform', `<svg xmlns="${NS}" viewBox="0 0 750 220">${inner}<circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D2b 同一元素，祖先 <g translate(-880,-280)> 搬进画布', `<svg xmlns="${NS}" viewBox="0 0 750 220"><g transform="translate(-880,-280)">${inner}</g><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D2c 原始坐标在外的 10 个叶子，被祖先搬进画布', `<svg xmlns="${NS}" viewBox="0 0 750 220"><g transform="translate(-900,-300)">${Array.from({length:10},(_,i)=>`<circle cx="${910+i*5}" cy="${310+i*5}" r="6" fill="#333"/>`).join('')}</g><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)

console.log('\n--- D3: viewBox 原点非 0（解析时 min-x/min-y 被丢弃，负坐标内容被当成"画布外"）---')
show('D3a viewBox="-400 -200 750 220"，内容在 -400..350', `<svg xmlns="${NS}" viewBox="-400 -200 750 220"><rect x="-380" y="-180" width="100" height="100" fill="#333"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)
show('D3b 同一造型改成 viewBox="0 0 750 220"', `<svg xmlns="${NS}" viewBox="0 0 750 220"><rect x="-380" y="-180" width="100" height="100" fill="#333"/><circle cx="100" cy="100" r="30" fill="#333"/></svg>`)

console.log('\n--- D4: 完全落在画布外的元素＝渲染时被裁掉（不产生任何像素），不会被看见 ---')
show('D4a 画面完好 + 44 个完全在画布外的元素', `<svg xmlns="${NS}" viewBox="0 0 750 220"><rect x="0" y="0" width="750" height="220" fill="#eef"/><circle cx="375" cy="110" r="90" fill="#c33"/>${Array.from({length:44},(_,i)=>`<rect x="${760+i*3}" y="0" width="2" height="220" fill="#000"/>`).join('')}</svg>`)
console.log('   注：44 个黑色竖条在 x>=760，整体在画布外——渲染时被 viewBox 裁掉，屏幕上零像素。')
console.log('   checker 读到的 offCanvas =', R(`<svg xmlns="${NS}" viewBox="0 0 750 220">${Array.from({length:44},(_,i)=>`<rect x="${760+i*3}" y="0" width="2" height="220" fill="#000"/>`).join('')}<circle cx="375" cy="110" r="90" fill="#c33"/></svg>`).off)
