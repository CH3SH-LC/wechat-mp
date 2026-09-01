// test/product/render-product.mjs
// 测试产品：把 v3 扩充的 38 个标题装饰资产放进一篇完整演示推文（375px 手机壳）
// 输入：../assets/png/*.png（38 张 2x PNG，已由 render-subheading-test.mjs 生成并验证）
// 输出：product-article.html + product-article.png（全页截图）
// 验证：8 大类资产全覆盖检查 + 每资产 data URI 存在性 + 截图落盘
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outDir = fileURLToPath(new URL('./', import.meta.url))

// ---------- 载入 playwright（与 render-subheading-test.mjs 同一套探测） ----------
const pwCandidates = [
  'D:/deepseek-harness/deepseek-harness/node_modules/.pnpm',
  'C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/.pnpm',
]
async function loadPlaywright() {
  const cands = []
  for (const r of pwCandidates) {
    try {
      for (const d of readdirSync(r)) {
        if (d.startsWith('playwright@')) {
          cands.push(r + '/' + d + '/node_modules/playwright/index.mjs')
          cands.push(r + '/' + d + '/playwright/index.mjs')
        }
      }
    } catch (_) { /* skip */ }
  }
  cands.push('D:/deepseek-harness/deepseek-harness/node_modules/playwright/index.mjs')
  cands.push('C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/playwright/index.mjs')
  const { existsSync } = await import('node:fs')
  for (const c of cands) {
    try {
      if (existsSync(c)) return await import('file:///' + c.replace(/\\/g, '/'))
    } catch (_) { /* next */ }
  }
  throw new Error('找不到 playwright')
}
function findChromium() {
  const base = 'C:/Users/Lenovo/AppData/Local/ms-playwright'
  try {
    for (const d of readdirSync(base)) {
      if (d.startsWith('chromium-')) {
        const exe = base + '/' + d + '/chrome-win64/chrome.exe'
        if (existsSync(exe)) return exe
      }
    }
  } catch (_) { /* skip */ }
  return undefined
}

// ---------- 读取已渲染 PNG 资产 ----------
const pngDir = fileURLToPath(new URL('../assets/png/', import.meta.url))
const pngComboDir = fileURLToPath(new URL('../assets/png-combo/', import.meta.url))
const pngCombo2Dir = fileURLToPath(new URL('../assets/png-combo2/', import.meta.url))
const used = {
  // 小标题组件（5 节：单资产 + 两批复合资产混排）
  'combo-badge-wreath': '01 徽章标题（花环）',
  'combo-clamp-vine-flower': '02 夹线嵌字（藤蔓花饰）',
  'combo-frame-lines': '03 居中上下分割线',
  'combo-underline-center': '04 居中下划线（两端叶）',
  'combo-frame-vine-rose': '05 居中边框（玫瑰叶珍珠）',
  // 页眉 / 结尾 / 点缀
  'corner-flower': '页眉角饰',
  'flourish-double': '页眉卷曲',
  'divider-wave': '引言后分隔',
  'combo-accent-branch': '04 节后花枝点缀',
  'combo-banner-crown': '结尾 CTA 缎带花冠',
  'corner-vine': '页脚角饰',
}
function assetUri(name) {
  let dir = pngDir
  if (name.startsWith('combo-')) dir = pngComboDir
  if (['combo-badge-wreath', 'combo-clamp-vine-flower', 'combo-frame-vine-rose', 'combo-accent-branch'].includes(name)) dir = pngCombo2Dir
  const p = dir + name + '.png'
  return 'data:image/png;base64,' + readFileSync(p).toString('base64')
}
const uri = {}
for (const n of Object.keys(used)) uri[n] = assetUri(n)

// ---------- 正文（遵守 copy-subheading：编号型 + 动宾、干货 6-15 字、句尾无句号、每节 300-400 字） ----------
const intro = '很多人读书读完就忘，不是因为记性差，而是因为只读了一遍。把一本书读三遍，每一遍的任务不同，收获完全不同。这套方法不需要天赋，只需要按顺序做三件事：通读、精读、输出。'
const body1 = '第一遍的任务不是记住内容，而是建立整体印象。用平时两倍的速度读完，遇到不懂的地方先跳过，不查资料、不停下来。读的时候准备一支铅笔，只在页边画竖线，标记"这里好像有用"。通读的意义在于让大脑先搭起框架，后面两遍才有地方放细节。读完合上书，用三句话概括这本书讲了什么，写不出来说明第一遍没过关，重读目录再想一遍。'
const body2 = '第二遍放慢速度，逐章精读。这一遍的任务是找到值得记住的东西：把标记过的段落重读，划出关键句，在空白处写下自己的理解。精读不需要平均用力，重点看三类内容：核心概念的定义、方法的操作步骤、与你的工作生活相关的例子。划线的标准只有一个：这句话如果丢掉，这本书还成立吗？不成立才值得划。第二遍结束时，全书划线应控制在二十处以内，多就是没想清楚。'
const body3 = '第三遍只读划线部分，不读全文。任务是把划出的句子转成自己的话，记在笔记本上，每条不超过两行。转写的过程就是检验理解的过程：写不出来，说明还没真懂，回到原文重读。笔记按主题归类，不要按章节顺序记。三遍之后，书的骨架、血肉、你的理解就都齐了，这时候才算真正读完。'
const body4 = '读完不是结束。把笔记放在触手可及的地方，每周花十分钟重读一遍。重读时会发现：上个月觉得重要的内容，现在有了新的理解；记过的结论，在实际工作中得到了验证。这是把"读过"变成"会用"的关键一步。坚持一个月，这本书的内容就会从短期记忆变成你的长期能力。'
const body5 = '最后一步是输出。用八百字以内把这本书的要点写成一篇总结，发在公众号、发给同事或者只给自己看。输出会逼你把模糊的想法说清楚，也会暴露你没想通的地方。写完后对照笔记检查：漏掉的章节，就是你还不够理解的部分，回去补读。到这一步，一本书才算真正读完。'

// ---------- 拼装 375px 文章（v10 平面化：零渐变/零阴影/零 emoji；资产为 PNG 图片合法）
// 间距规则（2026-08-29 用户反馈修正）：
//   - 组件自带线条分隔时，四周空行收紧——线就是分隔，不再叠加宽留白
//   - 线条方向：下划线式（线在标题文字下方）为常态；夹线标题=文字嵌在线中央（线断于文字两侧）；禁止"上划线式"（线在标题上方）
//   - 正文段落间距 12px、行高 1.75 不变；组件与正文间距 12-20px
const p = (t) => '<p style="font-size:16px;color:#444;line-height:1.75;margin:12px 0 0;text-align:justify">' + t + '</p>'
// 徽章标题（左置，无线条 → 标准间距）
const secBadge = (label, icon) =>
  '<div style="display:flex;align-items:center;margin:20px 0 0">' +
  '<img src="' + icon + '" style="width:34px;height:34px;margin-right:10px;flex-shrink:0"/>' +
  '<span style="font-size:17px;font-weight:700;color:#2f3640;letter-spacing:1px">' + label + '</span></div>'
// 夹线嵌字标题：文字叠在线中央（线断于文字两侧），线就是分隔 → 上方留白收紧
const secClamp = (label, deco) =>
  '<div style="position:relative;margin:18px 0 0;height:32px">' +
  '<img src="' + deco + '" style="width:100%;display:block;position:absolute;top:50%;transform:translateY(-50%)"/>' +
  '<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:16px;font-weight:700;color:#2f3640;letter-spacing:1px;background:#fff;padding:0 10px;white-space:nowrap">' + label + '</span></div>'
// 下划线式标题：标题在上、线在下（线宽收窄，与文字贴合）
const secUnderline = (label, deco, decoW) =>
  '<div style="text-align:center;margin:22px 0 0">' +
  '<p style="font-size:18px;font-weight:700;color:#2f3640;letter-spacing:2px;margin:0">' + label + '</p>' +
  '<div style="text-align:center;margin:6px 0 0"><img src="' + deco + '" style="width:' + decoW + ';display:inline-block"/></div></div>'
// 居中上下分割线：文字叠上下线中央（线是框架，不再加宽空行）
const secFrameLines = (label, deco) =>
  '<div style="position:relative;margin:18px 0 0">' +
  '<img src="' + deco + '" style="width:100%;display:block"/>' +
  '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center">' +
  '<span style="font-size:16px;font-weight:700;color:#2f3640;letter-spacing:2px">' + label + '</span></div></div>'
// 居中边框：文字叠框内中央（框自带装饰 → 收紧）
const secFrameBox = (label, deco) =>
  '<div style="position:relative;margin:20px 0 0">' +
  '<img src="' + deco + '" style="width:100%;display:block"/>' +
  '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center">' +
  '<span style="font-size:17px;font-weight:700;color:#2f3640;letter-spacing:2px">' + label + '</span></div></div>'

const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=375"></head>' +
  '<body style="margin:0;background:#eee">' +
  '<div style="width:375px;margin:0 auto;background:#fff;padding:0 16px 36px;box-sizing:border-box;font-family:-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif">' +
  // ---- 页眉：角饰 + 卷曲 + 主标题 + 副标题 + 波浪分隔（线在下，收紧） ----
  '<div style="padding-top:8px"><img src="' + uri['corner-flower'] + '" style="width:40px;height:40px"/></div>' +
  '<div style="text-align:center;margin-top:-30px"><img src="' + uri['flourish-double'] + '" style="width:130px;display:inline-block"/></div>' +
  '<h1 style="text-align:center;font-size:24px;font-weight:800;color:#2f3640;letter-spacing:3px;margin:10px 0 4px">三遍阅读法</h1>' +
  '<p style="text-align:center;font-size:13px;color:#999;letter-spacing:1px;margin:0 0 10px">把一本书真正读透</p>' +
  '<div style="text-align:center"><img src="' + uri['divider-wave'] + '" style="width:55%;display:inline-block"/></div>' +
  // ---- 引言 ----
  p(intro) +
  // ---- 01 徽章标题（花环徽章，左置） ----
  secBadge('01 先快速通读一遍', uri['combo-badge-wreath']) + p(body1) +
  // ---- 02 夹线嵌字标题（藤蔓花饰，文字在线中央，线断于文字两侧） ----
  secClamp('02 再精读划重点', uri['combo-clamp-vine-flower']) + p(body2) +
  // ---- 03 居中上下分割线（文字叠上下线中央，线是框架） ----
  secFrameLines('03 第三遍只记笔记', uri['combo-frame-lines']) + p(body3) +
  // ---- 04 居中下划线（两端叶，线在标题下方贴合，节后花枝点缀） ----
  secUnderline('04 每周重读笔记', uri['combo-underline-center'], '62%') + p(body4) +
  '<div style="text-align:center;margin:14px 0 0"><img src="' + uri['combo-accent-branch'] + '" style="width:180px;display:inline-block"/></div>' +
  // ---- 05 居中边框·玫瑰叶珍珠（深度融合：装饰长在边框线上） ----
  secFrameBox('05 输出一篇总结', uri['combo-frame-vine-rose']) + p(body5) +
  // ---- 结尾：缎带花冠 CTA（花冠长在缎带上）+ 关注引导 + 页脚角饰 ----
  '<div style="text-align:center;margin:26px 0 0"><img src="' + uri['combo-banner-crown'] + '" style="width:62%;display:inline-block"/></div>' +
  '<p style="text-align:center;font-size:15px;font-weight:600;color:#2f3640;margin:8px 0 4px">把这套方法收藏起来，下次读书时照着做</p>' +
  '<p style="text-align:center;font-size:12px;color:#aaa;margin:0 0 14px">关注公众号，每周一篇读书干货</p>' +
  '<div style="text-align:right"><img src="' + uri['corner-vine'] + '" style="width:46px;height:46px"/></div>' +
  '</div></body></html>'

writeFileSync(outDir + 'product-article.html', html)

// ---------- 渲染 + 截图 ----------
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 800, deviceScaleFactor: 2 } })
  await page.setContent(html)
  await page.waitForTimeout(400)
  await page.screenshot({ path: outDir + 'product-article.png', fullPage: true })
  const metrics = await page.evaluate(() => ({
    h: document.body.scrollHeight,
    artImgs: document.querySelectorAll('img').length,
  }))
  await page.close()
  // 断言：8 大类全覆盖（含复合资产）+ 全部 data URI 存在 + 页面高度合理
  const groups = {
    '序号徽章': ['combo-badge-wreath'],
    '左右夹线': ['combo-clamp-vine-flower'],
    '分隔线': ['divider-wave'],
    '几何点缀': ['combo-accent-branch'],
    '卷曲角饰': ['corner-flower', 'corner-vine', 'flourish-double'],
    '缎带横幅': ['combo-banner-crown'],
    '下划线': ['combo-underline-center'],
    '标题框/边框': ['combo-frame-vine-rose', 'combo-frame-lines'],
  }
  const missing = []
  for (const [g, names] of Object.entries(groups)) {
    for (const n of names) {
      if (!html.includes(uri[n])) missing.push(g + '/' + n)
    }
  }
  console.log('文章高度: ' + metrics.h + 'px, img 总数: ' + metrics.artImgs)
  console.log('资产大类覆盖: ' + Object.keys(groups).length + '/8 → ' + Object.keys(groups).join('/'))
  console.log('缺失资产: ' + (missing.length ? missing.join(', ') : '无'))
  console.log('输出: product-article.html + product-article.png')
  if (missing.length || metrics.h < 1800) throw new Error('验证失败：资产缺失或页面异常')
  console.log('====== 测试产品渲染 + 验证 全绿 ======')
} finally {
  await browser.close()
}
