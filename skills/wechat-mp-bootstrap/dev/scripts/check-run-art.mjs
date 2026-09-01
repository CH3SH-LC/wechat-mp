// v10.2 带图案版检查：装饰图修复验证（读取 dev/artifacts/10lian-run-art.html，先跑 gen-10lian.mjs 生成）
import { readFileSync } from 'node:fs'
import { artifact } from './lib/env.mjs'

const html = readFileSync(artifact('10lian-run-art.html'), 'utf8')
const checks = []
const check = (n, ok, detail) => checks.push([n, ok, detail])

// 1) 装饰图不进卡片容器（不再被 paraBlock 包裹）
const artImgSections = html.match(/<section style="text-align:center;margin:12px 0"><img[^>]*max-width:56%/g) || []
check('装饰图独立居中(56% 无卡片)', artImgSections.length >= 4, artImgSections.length + ' 处')
check('装饰图未被包进段落卡片', !/<section style="margin:0 0 16px;background:#f7f3ee[^>]*><img[^>]*max-width:56%/.test(html), '无嵌套')

// 2) 角饰 60px
const deco60 = html.match(/position:absolute;right:12px;bottom:10px;width:60px/g) || []
check('气泡角饰 60px ×2', deco60.length === 2, deco60.length + ' 个')

// 3) vine 标题改用 vine-divider 上下花边（不再有 object-fit:fill 整幅背景）
check('无整幅 vine-frame 背景', !/object-fit:fill/.test(html), '已移除')
const vineBands = html.match(/<img[^>]*style="width:46%;height:auto;display:block;margin:0 auto 4px"/g) || []
const vineBands2 = html.match(/<img[^>]*style="width:46%;height:auto;display:block;margin:4px auto 0"/g) || []
check('vine 标题上下花边各 1 条', vineBands.length === 1 && vineBands2.length === 1, '上 ' + vineBands.length + ' 下 ' + vineBands2.length)

// 4) 基本规范回归
check('零 emoji（正文纯文本）', !/[\u2600-\u27BF\uFE0F]|[\u{1F000}-\u{1FAFF}]/u.test(html.replace(/src="data:image\/png;base64,[^"]+"/g, '').replace(/<[^>]+>/g, ' ')), '')
check('零配色渐变', !/linear-gradient/.test(html.replace(/repeating-linear-gradient/g, 'R')), '')
check('零 box-shadow', !/box-shadow/.test(html), '')
check('段落卡片容器 >=5', (html.match(/background:#f7f3ee;border:1px solid #e5ddd3;border-radius:12px;padding:14px 16px/g) || []).length >= 5, '')
check('KEY 气泡(橙)', /首日战报/.test(html) && /background:#c96f4a/.test(html), '')
check('TIP 气泡(绿)', /background:#3d8f74/.test(html), '')
check('art:// 零残留(全替换)', !/art:\/\//.test(html), '')
check('零裸正文段落', !/<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#4a4a52[^"]*">/.test(html), '')

let pass = 0
for (const [n, ok, detail] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + n + (ok ? '' : (detail ? ' —— ' + detail : '')))
  if (ok) pass++
}
console.log('\n' + pass + '/' + checks.length + ' 通过')
process.exit(pass === checks.length ? 0 : 1)
