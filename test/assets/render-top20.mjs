// test/assets/render-top20.mjs
// 最终精选：20 种小标题 SVG（从 67 个 v5 资产中精选，覆盖全部组合方式）
// 每种 = 完整小标题组件（资产 + 叠字方式 + 尺寸），375px 壳总览页
// 输出：test/assets/preview-top20.html/.png
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('./', import.meta.url))
const pngDirs = [here + 'png/', here + 'png-combo/', here + 'png-combo2/']
function uri(name) {
  for (const dir of pngDirs) {
    if (existsSync(dir + name + '.png')) {
      return 'data:image/png;base64,' + readFileSync(dir + name + '.png').toString('base64')
    }
  }
  throw new Error('找不到资产 PNG: ' + name)
}

// 20 种小标题 SVG（最终精选）
// 结构：{ name, label, asset, w(显示宽px), type: 叠字方式, usage }
const TOP20 = [
  // ---- 一、序号徽章式（4 种）----
  { name: 's01', label: '圆徽章·左置', asset: 'badge-num-circle', w: 34, type: 'badge', usage: '教程/干货编号标题' },
  { name: 's02', label: '花环徽章·左置', asset: 'combo-badge-wreath', w: 48, type: 'badge', usage: '特辑/活动编号标题' },
  { name: 's03', label: '桂冠徽章·左置', asset: 'combo-badge-laurel', w: 48, type: 'badge', usage: '权威/荣誉感标题' },
  { name: 's04', label: '旗形徽章·左置', asset: 'badge-num-banner', w: 34, type: 'badge', usage: '清单/挑战类标题' },
  // ---- 二、夹线嵌字式（4 种）----
  { name: 's05', label: '夹线嵌字·卷草', asset: 'clamp-line', w: 343, type: 'clamp', usage: '观点/居中标题' },
  { name: 's06', label: '夹线嵌字·藤蔓花', asset: 'combo-clamp-vine-flower', w: 343, type: 'clamp', usage: '文艺/自然风标题' },
  { name: 's07', label: '夹线嵌字·珍珠', asset: 'combo-clamp-pearl', w: 343, type: 'clamp', usage: '轻奢/极简标题' },
  { name: 's08', label: '夹线嵌字·中心花', asset: 'combo-clamp-flower', w: 343, type: 'clamp', usage: '金典/仪式感标题' },
  // ---- 三、上下分割线式（3 种）----
  { name: 's09', label: '上下分割线·中心花', asset: 'combo-frame-lines', w: 343, type: 'frame-lines', usage: '章节框架标题' },
  { name: 's10', label: '上下分割线·中心玫瑰', asset: 'combo-lines-rose', w: 343, type: 'frame-lines', usage: '精致/优雅标题' },
  { name: 's11', label: '上下分割线·藤蔓', asset: 'combo-lines-double-vine', w: 343, type: 'frame-lines', usage: '自然/国风标题' },
  // ---- 四、下划线式（3 种）----
  { name: 's12', label: '居中下划线·两端叶', asset: 'combo-underline-center', w: 213, type: 'underline', usage: '观点/金句标题' },
  { name: 's13', label: '居中下划线·双线花', asset: 'combo-underline-double-flower', w: 213, type: 'underline', usage: '步骤/说明标题' },
  { name: 's14', label: '居中下划线·金枝', asset: 'combo-underline-branch', w: 213, type: 'underline', usage: '轻奢/质感标题' },
  // ---- 五、居中边框式（3 种）----
  { name: 's15', label: '居中边框·左上花右下叶', asset: 'combo-frame-corner-flower', w: 343, type: 'frame', usage: '精致框式标题' },
  { name: 's16', label: '居中边框·玫瑰叶珍珠', asset: 'combo-frame-vine-rose', w: 343, type: 'frame', usage: '华丽框式标题' },
  { name: 's17', label: '居中边框·金珍珠链', asset: 'combo-frame-gold-band', w: 343, type: 'frame', usage: '尊贵/庆典标题' },
  // ---- 六、左对齐式（1 种）----
  { name: 's18', label: '左对齐·左下划线花锚', asset: 'combo-underline-left', w: 180, type: 'underline-left', usage: '清单/左对齐标题' },
  // ---- 七、缎带横幅式（2 种）----
  { name: 's19', label: '缎带·花冠 CTA', asset: 'combo-banner-crown', w: 213, type: 'banner', usage: '活动/CTA 标题' },
  { name: 's20', label: '缎带·双侧花', asset: 'combo-banner-twin-flower', w: 213, type: 'banner', usage: '庆祝/节日标题' },
]

// 每种类型对应的叠字 HTML
function badgeHtml(u, text) {
  return '<p style="display:flex;align-items:center;margin:10px 0 14px">' +
    '<img src="' + uri(u.asset) + '" style="width:' + u.w + 'px;height:' + u.w + 'px;margin-right:10px;flex-shrink:0"/>' +
    '<span style="font-size:17px;font-weight:700;color:#2f3640;letter-spacing:1px">' + text + '</span></p>'
}
function clampHtml(u, text) {
  return '<div style="position:relative;margin:12px 0 14px;height:34px">' +
    '<img src="' + uri(u.asset) + '" style="width:100%;display:block;position:absolute;top:50%;transform:translateY(-50%)"/>' +
    '<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:16px;font-weight:700;color:#2f3640;letter-spacing:1px;background:#fff;padding:0 12px;white-space:nowrap">' + text + '</span></div>'
}
function frameLinesHtml(u, text) {
  return '<div style="position:relative;margin:12px 0 14px">' +
    '<img src="' + uri(u.asset) + '" style="width:100%;display:block"/>' +
    '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center">' +
    '<span style="font-size:16px;font-weight:700;color:#2f3640;letter-spacing:2px">' + text + '</span></div></div>'
}
function underlineHtml(u, text) {
  return '<div style="text-align:center;margin:12px 0 14px">' +
    '<p style="font-size:17px;font-weight:700;color:#2f3640;letter-spacing:2px;margin:0 0 6px">' + text + '</p>' +
    '<img src="' + uri(u.asset) + '" style="width:' + u.w + 'px;display:inline-block"/></div>'
}
function frameHtml(u, text) {
  return '<div style="position:relative;margin:12px 0 14px">' +
    '<img src="' + uri(u.asset) + '" style="width:100%;display:block"/>' +
    '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center">' +
    '<span style="font-size:16px;font-weight:700;color:#2f3640;letter-spacing:2px">' + text + '</span></div></div>'
}
function underlineLeftHtml(u, text) {
  return '<div style="position:relative;margin:12px 0 14px">' +
    '<img src="' + uri(u.asset) + '" style="width:' + u.w + 'px;display:block"/>' +
    '<p style="position:absolute;left:8px;top:2px;margin:0;font-size:16px;font-weight:700;color:#2f3640;letter-spacing:1px">' + text + '</p></div>'
}
function bannerHtml(u, text) {
  return '<div style="position:relative;text-align:center;margin:12px 0 14px">' +
    '<img src="' + uri(u.asset) + '" style="width:' + u.w + 'px;display:inline-block"/>' +
    '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center">' +
    '<span style="font-size:15px;font-weight:700;color:#fff;letter-spacing:1px">' + text + '</span></div></div>'
}

// 每个场景的示例标题文字
const TEXTS = {
  s01: '01 先快速通读一遍', s02: '01 本周精选特辑', s03: '01 年度荣誉时刻', s04: '01 三十天挑战计划',
  s05: '把日子过成手账', s06: '在山野里找回自己', s07: '一份轻奢生活清单', s08: '值得纪念的一天',
  s09: '第三章 阅读的方法', s10: '把一本书真正读透', s11: '一、先解决这个误区',
  s12: '清单化是整理的第一步', s13: '第二步：批量归档文件', s14: '让每一天都有质感',
  s15: '把日子过成手账', s16: '一周读一本书', s17: '年度总结与展望',
  s18: '先做这 1 件事', s19: '收藏这套方法', s20: '新年快乐',
}

const renderHtml = {
  badge: badgeHtml, clamp: clampHtml, 'frame-lines': frameLinesHtml, underline: underlineHtml,
  frame: frameHtml, 'underline-left': underlineLeftHtml, banner: bannerHtml,
}

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

// 总览页：20 个 375px 场景（每个含标题组件 + 正文示例段）
const scene = (u) => {
  const text = TEXTS[u.name]
  const body = '<p style="font-size:14px;color:#999;line-height:1.6;margin:0 0 6px">' + u.label + ' · ' + u.usage + '</p>'
  return '<div style="width:375px;margin:14px 10px;background:#fff;border:1px solid #eee;border-radius:12px;display:inline-block;vertical-align:top;overflow:hidden">' +
    '<div style="padding:0 16px 10px;font-family:sans-serif">' + body + renderHtml[u.type](u, text) +
    '<p style="font-size:14px;color:#555;line-height:1.7;margin:0">正文示例：这里是本节内容的第一句话，与标题呼应……</p></div></div>'
}

const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f7f7f5;padding:16px;font-family:sans-serif}h2{font-size:18px;color:#2f3640;margin:8px 12px}h3{font-size:14px;color:#888;margin:4px 12px}</style></head><body>' +
  '<h2>最终精选：20 种小标题 SVG（v5 精细版 · 375px 壳实测）</h2>' +
  '<h3>一、序号徽章式（4）｜二、夹线嵌字式（4）｜三、上下分割线式（3）｜四、下划线式（3）｜五、居中边框式（3）｜六、左对齐式（1）｜七、缎带横幅式（2）</h3>' +
  '<div style="white-space:nowrap;overflow-x:auto">' + TOP20.map(scene).join('') + '</div>' +
  '</body></html>'
writeFileSync(here + 'preview-top20.html', html)

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ executablePath: findChromium() })
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.setContent(html)
  await page.waitForTimeout(500)
  await page.screenshot({ path: here + 'preview-top20.png', fullPage: true })
  // 验证：20 个场景全部渲染（img 数量 = 20）
  const cnt = await page.evaluate(() => document.querySelectorAll('img').length)
  await page.close()
  console.log('总览页 img 数: ' + cnt + '（期望 20）')
  if (cnt !== 20) throw new Error('场景数不符')
  console.log('====== 20 种小标题 SVG 总览 渲染全绿 ======')
} finally {
  await browser.close()
}
