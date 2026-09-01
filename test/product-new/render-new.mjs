// test/product-new/render-new.mjs
// 新生入学典礼推文 · 375px 手机壳渲染 + 内置像素验证
// 组件 = 美术资产（PNG base64）+ 文字（absolute 叠字，按知识库 zone 坐标）
// 输入：../assets/<组件>/png-<组件>/*.png（4x 渲染成品）
// 输出：demo-new.html + demo-new.png（全页截图）
// 内置验证：① 每张资产图 naturalWidth>0 ② 文字元素全部落在对应 zone 矩形内（DOM 实测）
//           ③ 全文非白占比 ≥10% ④ 每张资产包围盒非白内容 >0.5%
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outDir = fileURLToPath(new URL('./', import.meta.url))
const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url))

// ---------- 载入 playwright（与参考管线同一套探测） ----------
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
  for (const c of cands) {
    try { if (existsSync(c)) return await import('file:///' + c.replace(/\\/g, '/')) } catch (_) { /* next */ }
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

// ---------- 资产读取（全部 4x 渲染好的 PNG，直接 base64 引用） ----------
const assetDirs = {
  'combo-frame-lines': 'png-combo/',
  'combo-underline-center': 'png-combo/',
  'combo-banner-crown': 'png-combo/',
  'bubble-campus-ball': 'bubble2/png-bubble2/',
  'bubble-solid-tip': 'bubble2/png-bubble2/',
  'bubble-key-deep': 'bubble2/png-bubble2/',
  'card-campus': 'card/png-card/',
  'band-campus': 'band/png-band/',
  'band-dots': 'band/png-band/',
  'divider-campus': 'divider/png-divider/',
  'divider-dots': 'divider/png-divider/',
  'steps-campus': 'steps/png-steps/',
  'steps-prep': 'steps/png-steps/',
  'list-lined': 'list/png-list/',
  'list-arrow': 'list/png-list/',
  'badge-campus': 'badge/png-badge/',
  'badge-tag-new': 'badge/png-badge/',
  'badge-capsule-blue': 'badge/png-badge/',
}
const uriCache = {}
function uri(name) {
  if (uriCache[name]) return uriCache[name]
  const p = ASSETS + assetDirs[name] + name + '.png'
  uriCache[name] = 'data:image/png;base64,' + readFileSync(p).toString('base64')
  return uriCache[name]
}

// ---------- 显示换算 ----------
const S = 343 / 750    // 750 设计 → 343 显示（内容宽，375 壳 - 32 padding）
const SB = 137 / 300   // 徽章 300 设计 → 137 显示

// ---------- 正文段落（14-15px / 行高 1.75 / 段距 12px，组件铁律） ----------
const p = (t) =>
  '<p style="font-size:15px;color:#3d4650;line-height:1.75;margin:12px 0 0;text-align:justify">' + t + '</p>'
const note = (t) =>
  '<p style="font-size:13px;color:#8a94a6;line-height:1.75;margin:12px 0 0;text-align:justify">' + t + '</p>'

// ---------- 组件块容器（图片 + absolute 叠字层，携带 zone 元数据供验证） ----------
function block(name, { w = 343, dw, dh, zones, margin = '0 0 16px' }, layerHtml) {
  const h = Math.round(dh * (w / dw))
  return (
    '<div data-name="' + name + '" data-dw="' + dw + '" data-dh="' + dh + '"' +
    " data-zones='" + JSON.stringify(zones) + "'" +
    ' style="position:relative;width:' + w + 'px;height:' + h + 'px;margin:' + margin + ';">' +
    '<img src="' + uri(name) + '" style="width:' + w + 'px;height:' + h + 'px;display:block;"/>' +
    layerHtml +
    '</div>'
  )
}

// ---------- ① 小标题 A：上下分割线式（combo-frame-lines，文字叠上下线中央） ----------
const titleFrameLines = (label) => block('combo-frame-lines', {
  dw: 750, dh: 130, margin: '18px 0 0',
  zones: [{ x0: 60, y0: 30, x1: 690, y1: 110 }],
},
  '<div data-zone="0" data-line="title" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:16px;font-weight:700;color:#2f3640;letter-spacing:2px;white-space:nowrap;">' + label + '</div>')

// ---------- ② 小标题 B：下划线式（combo-underline-center，标题在上、线在下贴合） ----------
const titleUnderline = (label) =>
  '<div style="margin:18px 0 0;text-align:center;">' +
  '<p style="font-size:17px;font-weight:700;color:#2f3640;letter-spacing:2px;margin:0 0 8px;">' + label + '</p>' +
  '<img src="' + uri('combo-underline-center') + '" style="width:62%;display:inline-block;"/>' +
  '</div>'

// ---------- ③ 气泡（750×215，zone 110..730 × 50..170：标题 + 内容两行） ----------
const BUBBLE_ZONE = [{ x0: 110, y0: 50, x1: 730, y1: 170 }]
function bubble(name, title, body, titleColor, bodyColor) {
  // 内容句右边界收到 zone 右缘（x1=730 → 显示 333.9，留 6px 内缩 → right:15px），保证 18 字单行不换行
  const layer =
    '<div data-zone="0" data-line="title" style="position:absolute;left:56px;right:15px;top:27px;font-size:15px;font-weight:700;color:' + titleColor + ';line-height:1.4;">' + title + '</div>' +
    '<div data-zone="0" data-line="body" style="position:absolute;left:56px;right:15px;top:53px;font-size:14px;color:' + bodyColor + ';line-height:1.5;">' + body + '</div>'
  return block(name, { dw: 750, dh: 215, zones: BUBBLE_ZONE }, layer)
}

// ---------- ④ 卡片（card-campus 白卡细边框，一种样式到底：标题 + 3-5 条） ----------
const CARD_ZONE = [{ x0: 110, y0: 40, x1: 730, y1: 340 }]
function cardCampus(title, entries) {
  const items = entries.map((e, i) =>
    '<div data-zone="0" data-line="item' + i + '" style="margin:0 0 5px;font-size:14px;color:#555;line-height:1.5;">· ' + e + '</div>').join('')
  const layer =
    '<div data-zone="0" data-line="title" style="position:absolute;left:56px;right:56px;top:20px;font-size:15px;font-weight:700;color:#333;line-height:1.4;">' + title + '</div>' +
    '<div data-zone="0" data-line="items" style="position:absolute;left:56px;right:56px;top:51px;">' + items + '</div>'
  return block('card-campus', { dw: 750, dh: 360, zones: CARD_ZONE }, layer)
}

// ---------- ⑤ 花纹色带（750×160，zone 90..660 × 45..115：衬底文字 + 实色浅底） ----------
const BAND_ZONE = [{ x0: 90, y0: 45, x1: 660, y1: 115 }]
function band(name, text, pillBg, pillColor) {
  const layer =
    '<div data-zone="0" data-line="band" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:' + pillBg + ';border-radius:6px;padding:3px 16px;font-size:15px;font-weight:700;color:' + pillColor + ';line-height:1.4;white-space:nowrap;">' + text + '</div>'
  return block(name, { dw: 750, dh: 160, zones: BAND_ZONE }, layer)
}

// ---------- ⑥ 步骤 · 单色数字圆（steps-campus，4 行，zone x130..730 每行 ±20） ----------
const STEP_ROWS = [50, 94, 138, 182]
function stepsCampus(rows) {
  const zones = STEP_ROWS.map((c) => ({ x0: 130, y0: c - 20, x1: 730, y1: c + 20 }))
  const layer = STEP_ROWS.map((c, i) =>
    '<div data-zone="' + i + '" data-line="step' + i + '" style="position:absolute;left:64px;right:8px;top:' + Math.round((c - 20) * S + 1) + 'px;font-size:14px;color:#333;line-height:1.25;">' + rows[i] + '</div>').join('')
  return block('steps-campus', { dw: 750, dh: 220, zones }, layer)
}

// ---------- ⑦ 步骤 · 前提行+步骤组（steps-prep：前提帽 + 4 步） ----------
const PREP_ROWS = [66, 110, 154, 198]
function stepsPrep(hat, rows) {
  const zones = [{ x0: 130, y0: 6, x1: 730, y1: 42 }].concat(PREP_ROWS.map((c) => ({ x0: 130, y0: c - 20, x1: 730, y1: c + 20 })))
  const layer =
    '<div data-zone="0" data-line="hat" style="position:absolute;left:64px;right:8px;top:' + Math.round(6 * S) + 'px;font-size:13px;color:#1a4a66;line-height:1.25;">' + hat + '</div>' +
    PREP_ROWS.map((c, i) =>
      '<div data-zone="' + (i + 1) + '" data-line="step' + i + '" style="position:absolute;left:64px;right:8px;top:' + Math.round((c - 20) * S + 1) + 'px;font-size:14px;color:#333;line-height:1.25;">' + rows[i] + '</div>').join('')
  return block('steps-prep', { dw: 750, dh: 220, zones }, layer)
}

// ---------- ⑧ 列表 · 衬底强调式（list-lined，5 行） ----------
function listLined(items) {
  const zones = [0, 1, 2, 3, 4].map((i) => ({ x0: 100, y0: 4 + i * 40, x1: 730, y1: 40 + i * 40 }))
  const layer = zones.map((z, i) =>
    '<div data-zone="' + i + '" data-line="item' + i + '" style="position:absolute;left:50px;right:8px;top:' + Math.round(z.y0 * S) + 'px;font-size:14px;color:#333;line-height:1.2;">' + (items[i] || '') + '</div>').join('')
  return block('list-lined', { dw: 750, dh: 200, zones }, layer)
}

// ---------- ⑨ 列表 · 菱形引导式（list-arrow，4-5 行） ----------
function listArrow(items) {
  const zones = items.map((_, i) => ({ x0: 100, y0: 10 + i * 36, x1: 730, y1: 46 + i * 36 }))
  const layer = zones.map((z, i) =>
    '<div data-zone="' + i + '" data-line="item' + i + '" style="position:absolute;left:50px;right:8px;top:' + Math.round(z.y0 * S) + 'px;font-size:14px;color:#333;line-height:1.2;">' + items[i] + '</div>').join('')
  return block('list-arrow', { dw: 750, dh: 200, zones }, layer)
}

// ---------- ⑩ 徽章（300×120 → 137×55，zone 40..260 × 35..85：中央叠字 ≤4 字） ----------
const BADGE_ZONE = [{ x0: 40, y0: 35, x1: 260, y1: 85 }]
function badge(name, text, color, margin) {
  const layer =
    '<div data-zone="0" data-line="badge" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px;font-weight:700;color:' + color + ';line-height:1.2;white-space:nowrap;">' + text + '</div>'
  return block(name, { w: 137, dw: 300, dh: 120, margin: margin || '0 auto 16px', zones: BADGE_ZONE }, layer)
}

// ---------- ⑪ 分割线（750×90 纯装饰，上下 24px 停顿） ----------
const divider = (name) =>
  '<div style="margin:24px 0 0;"><img src="' + uri(name) + '" style="width:100%;display:block;"/></div>'

// ---------- ⑫ 缎带横幅 CTA（combo-banner-crown，340×110 → 213 宽，文字叠缎带中央） ----------
function banner(text) {
  const w = 213
  // 文字叠缎带体中央（缎带 y58..106 设计 → 显示 36.3..66.4；文字 19.5 高 → top 42）
  const layer =
    '<div data-zone="0" data-line="banner" style="position:absolute;left:50%;transform:translateX(-50%);top:42px;font-size:15px;font-weight:700;color:#ffffff;line-height:1.3;white-space:nowrap;">' + text + '</div>'
  return block('combo-banner-crown', { w, dw: 340, dh: 110, margin: '20px auto 16px', zones: [{ x0: 30, y0: 58, x1: 310, y1: 106 }] }, layer)
}

// ================= 正文拼装（新生入学典礼 · 校园风 · 阳光氛围） =================
const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=375"></head>' +
  '<body style="margin:0;background:#e9e6e0;padding:28px 0 56px;">' +
  '<div style="width:375px;margin:0 auto;background:#ffffff;border-radius:20px;box-shadow:0 6px 24px rgba(0,0,0,.08);overflow:hidden;">' +
  '<div style="padding:24px 16px 40px;box-sizing:border-box;font-family:-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">' +
  // ---- 开篇：大标题 + 副标题 + 徽章 + 花纹色带 + 引言 + 分割线 ----
  '<h1 style="text-align:center;font-size:26px;font-weight:800;color:#2f3640;letter-spacing:4px;margin:0 0 6px;">新生入学典礼</h1>' +
  '<p style="text-align:center;font-size:13px;color:#8a94a6;letter-spacing:2px;margin:0 0 14px;">欢迎来到阳光校园</p>' +
  badge('badge-campus', '新生驾到', '#2f5a20', '0 auto 16px') +
  band('band-campus', '以心迎新 · 逐梦启航', '#f2f8e8', '#2f4a1f') +
  p('九月将至，阳光正好。欢迎新同学加入阳光校园大家庭，从踏进校门的那一刻起，这里就是你们的新起点。新生入学典礼定于 9 月 1 日上午举行，这篇推文为你备齐时间、地点、流程与须知，报到当天照着走，轻松又从容。') +
  divider('divider-campus') +
  // ---- 01 典礼时间与地点（小标题样式 A + 步骤） ----
  titleFrameLines('01 典礼时间与地点') +
  p('典礼将于 9 月 1 日（周日）上午 8 点 30 分在中心操场准时开始，全程约两小时，请提前规划出行时间。操场入口设有签到台与引导牌，找不到位置随时向志愿者求助。四个环节环环相扣，跟着节奏走完即可：') +
  stepsCampus(['凭录取通知书入场签到', '按班级落座主会场', '观看授徽与宣誓仪式', '合影后领取新生礼包']) +
  // ---- 02 三大亮点（小标题样式 A + 卡片 ×3，一种样式到底） ----
  titleFrameLines('02 三大亮点抢先看') +
  p('典礼不只是仪式，更是你们大学生活的第一场嘉年华。今年特别准备了三大亮点环节，每一项都值得期待：') +
  cardCampus('授徽仪式', ['校领导为新生逐一佩戴校徽', '全体新生面向国旗集体宣誓', '家长可在观礼区全程观礼']) +
  cardCampus('社团巡礼', ['四十余个社团现场招新', '球场开放篮球足球体验赛', '手作坊可现场参与体验']) +
  cardCampus('迎新晚会', ['操场露天舞台晚间开演', '老生乐队与舞蹈队串场', '现场抽奖环节惊喜不断']) +
  band('band-dots', '新生报到 · 看这一篇', '#f3f7ea', '#3a4a26') +
  // ---- 03 新生须知（小标题样式 A + 列表 + 气泡 NOTE） ----
  titleFrameLines('03 新生须知提前确认') +
  p('报到前请逐一核对以下材料与事项，缺一不可：') +
  listLined(['录取通知书与身份证原件', '一寸免冠证件照六张', '党团组织关系转接材料', '学费已按通知线上缴清', '宿舍分配结果可自助查询']) +
  p('以上材料建议统一装入文件袋随身携带，报到当天按清单核对，避免现场翻找耽误时间。') +
  bubble('bubble-campus-ball', '小提示：', '报到当天人流集中，建议 10 点前到校。', '#3f5a2a', '#3f5a2a') +
  divider('divider-campus') +
  // ---- 04 报到流程（小标题样式 B + 步骤 + 徽章 + 列表） ----
  titleUnderline('04 报到流程四步走') +
  p('报到流程环环相扣，按下面四步依次走完，当天即可完成注册并入住宿舍：') +
  stepsPrep('准备：录取通知书 / 身份证 / 证件照', ['到东门报到点核验身份', '前往学院完成注册缴费', '领取校园卡与宿舍钥匙', '入住宿舍整理行李物品']) +
  badge('badge-tag-new', '报到指南', '#2e5a4f', '8px auto 16px') +
  p('当天日程速览，先到先安排：') +
  listArrow(['8:30 入学典礼开场', '10:30 班级见面会', '14:00 校园导览活动', '19:00 迎新晚会']) +
  // ---- 05 温馨提示（小标题样式 B + 气泡 TIP） ----
  titleUnderline('05 温馨提示看这里') +
  p('最后几条贴心提示，助你从容开启大学生活。典礼当天正值周末，校园周边车位有限，建议优先选择公共交通出行，绿色又省心。') +
  bubble('bubble-solid-tip', '温馨提示', '请提前 30 分钟到场，按班级指引入座。', '#ffffff', '#fff7f0') +
  // ---- 结尾：KEY 压轴 + 分割线 + 缎带 CTA + 祝福 + 关注引导 + 徽章 ----
  bubble('bubble-key-deep', '一句话记住', '9 月 1 日上午 8:30，中心操场不见不散。', '#ffffff', '#f4efff') +
  divider('divider-dots') +
  banner('我们在校园等你') +
  p('新的旅程即将开启，愿你们在阳光校园里，遇见更好的自己。典礼见！') +
  badge('badge-capsule-blue', '官方发布', '#2166ff', '8px auto 16px') +
  note('关注校园官方公众号，第一时间获取报到与典礼的最新资讯。') +
  '</div></div></body></html>'

writeFileSync(outDir + 'demo-new.html', html)

// ================= 渲染 + 截图 + 内置像素验证 =================
const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
let fail = 0
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 900, deviceScaleFactor: 2 } })
  await page.setContent(html)
  await page.waitForTimeout(600)

  // —— 验证 1：每张资产图 naturalWidth>0 ——
  // —— 验证 2：叠字文字元素边界全部落在 zone 矩形内（DOM getBoundingClientRect 实测）——
  const domCheck = await page.evaluate(() => {
    const TOL = 1.5
    const imgs = [...document.querySelectorAll('img')]
    const imgBad = imgs.filter((im) => !(im.complete && im.naturalWidth > 0)).map((im) => (im.src || '').slice(0, 60))
    const cards = [...document.querySelectorAll('[data-name]')]
    const out = []
    for (const card of cards) {
      const name = card.getAttribute('data-name')
      const dw = +card.getAttribute('data-dw')
      const dh = +card.getAttribute('data-dh')
      const zones = JSON.parse(card.getAttribute('data-zones'))
      const ir = card.querySelector('img').getBoundingClientRect()
      const texts = [...card.querySelectorAll('[data-zone]')]
      const violations = []
      for (const t of texts) {
        const zi = +t.getAttribute('data-zone')
        const r = t.getBoundingClientRect()
        const z = zones[zi]
        const zr = {
          left: ir.left + z.x0 * (ir.width / dw),
          top: ir.top + z.y0 * (ir.height / dh),
          right: ir.left + z.x1 * (ir.width / dw),
          bottom: ir.top + z.y1 * (ir.height / dh),
        }
        const bad = []
        if (r.left < zr.left - TOL) bad.push('左溢' + (zr.left - r.left).toFixed(1))
        if (r.right > zr.right + TOL) bad.push('右溢' + (r.right - zr.right).toFixed(1))
        if (r.top < zr.top - TOL) bad.push('上溢' + (zr.top - r.top).toFixed(1))
        if (r.bottom > zr.bottom + TOL) bad.push('下溢' + (r.bottom - zr.bottom).toFixed(1))
        if (bad.length) violations.push((t.getAttribute('data-line') || '') + '[' + t.textContent.trim().slice(0, 14) + ']→' + bad.join('、'))
      }
      out.push({ name, zones: zones.length, texts: texts.length, violations })
    }
    return { imgTotal: imgs.length, imgBad, cards: out, pageH: document.body.scrollHeight }
  })

  console.log('======== 375px 壳渲染 + DOM 验证 ========')
  console.log('资产图总数: ' + domCheck.imgTotal + '，加载失败: ' + domCheck.imgBad.length + (domCheck.imgBad.length ? ' → ' + domCheck.imgBad.join(',') : '（全部 naturalWidth>0）'))
  let zonePass = 0, zoneFail = 0
  for (const c of domCheck.cards) {
    const ok = c.violations.length === 0 && c.texts > 0
    if (ok) zonePass++; else zoneFail++
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + c.name.padEnd(22) + ' zone×' + c.zones + ' 文字' + c.texts +
      (ok ? '' : ' 越界: ' + c.violations.join('; ')))
  }
  console.log('叠字界内通过: ' + zonePass + '/' + domCheck.cards.length)
  if (domCheck.imgBad.length || zoneFail > 0) fail++

  // —— 截图 ——
  await page.screenshot({ path: outDir + 'demo-new.png', fullPage: true })
  console.log('截图高度: ' + domCheck.pageH + 'px（2x 输出 ≈' + (domCheck.pageH * 2) + 'px）')

  // —— 验证 3：全文非白占比 ≥10% + 每资产包围盒非白内容 ——
  const pngPath = outDir + 'demo-new.png'
  const b64 = readFileSync(pngPath).toString('base64')
  const boxes = domCheck.cards.map((c) => c.name)
  const pixelCheck = await page.evaluate(({ b64, boxes }) => {
    const img = document.createElement('img')
    return new Promise((resolve) => {
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(img, 0, 0)
        const d = cx.getImageData(0, 0, c.width, c.height).data
        const sx = c.width / 375
        const sy = c.height / document.body.scrollHeight
        let nonWhite = 0, total = 0
        for (let y = 0; y < c.height; y += 6) {
          for (let x = 0; x < c.width; x += 6) {
            const i = (y * c.width + x) * 4
            if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) nonWhite++
            total++
          }
        }
        // 每张资产图（DOM 位置）包围盒非白占比
        const scans = [...document.querySelectorAll('[data-name]')].map((card) => {
          const r = card.querySelector('img').getBoundingClientRect()
          let colored = 0, n = 0
          for (let y = Math.round(r.top * sy); y < Math.round(r.bottom * sy); y += 3) {
            for (let x = Math.round(r.left * sx); x < Math.round(r.right * sx); x += 3) {
              const i = (y * c.width + x) * 4
              if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) colored++
              n++
            }
          }
          return { name: card.getAttribute('data-name'), pct: +(colored / n * 100).toFixed(1) }
        })
        resolve({ nonWhitePct: +(nonWhite / total * 100).toFixed(2), scans })
      }
      img.src = 'data:image/png;base64,' + b64
    })
  }, { b64, boxes })
  console.log('======== 像素验证 ========')
  console.log('全文非白占比: ' + pixelCheck.nonWhitePct + '%（要求 ≥10%）')
  const empty = pixelCheck.scans.filter((s) => s.pct < 0.5)
  for (const s of pixelCheck.scans) console.log('  ' + s.name.padEnd(22) + ' 有内容 ' + s.pct + '%')
  if (pixelCheck.nonWhitePct < 10) { console.log('FAIL 非白占比不足'); fail++ }
  if (empty.length) { console.log('FAIL 空白资产: ' + empty.map((e) => e.name).join(',')); fail++ }
  else console.log('全部 ' + pixelCheck.scans.length + ' 张资产包围盒有内容')

  console.log('======== ' + (fail ? '存在失败项，需修复' : '渲染 + 验证 全绿（demo-new.html + demo-new.png 已输出）') + ' ========')
  if (fail) process.exitCode = 1
} finally {
  await browser.close()
}
