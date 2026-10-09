// compose.ts —— v2 排版语法 → 微信合法内联 HTML 确定性转换器（第 14 轮移植）
// 来源：wechat-mp preset「wechat-mp-bootstrap」SKILL.md Host 源码（已验证 pkg-8，勿随意改动）
// 移植为桌面纯 TS：去掉微信 API/上传/资产渲染依赖；DESIGNS text/promo 双色系、间距 v5、
// 平面化 v10 全量保留；art:// 资产桌面不提供 → 引用被移除并记入 warnings（与 DSH 未上传行为一致）。
// 第 15 轮：::: art 素材容器（现场 SVG，元素 ≥6 校验）。第 17 轮：风格主题（palettes 色板覆盖 + 正文底色）。

import { parsePaletteDirective, resolveTheme, themeDeclaration } from './palettes.ts'
import type { StylePalette } from './palettes.ts'
import { checkSvgQuality } from './svg-quality.ts'

export interface ComposeDesign {
  key: 'text' | 'promo'
  label: string
  /** 组件语言（R17）：由 `[[boxes:名]]` 或主题映射决定，见 `resolveBoxScheme` */
  scheme: string
  [k: string]: string
}

const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

const DESIGNS: Record<'text' | 'promo', ComposeDesign> = {
  text: {
    key: 'text', label: '文字类', scheme: 'editorial',
    accent: '#2f6fed', accentDark: '#1f4fc4',
    heading: '#1f2d3d', text: '#3f3f3f', sub: '#8a94a6',
    bg: '#ffffff', soft: '#eef3fb', soft2: '#f7f9fc', border: '#e3e8ef',
    tip: '#0e9f6e', tipBg: '#ecfaf3', warn: '#b26a00', warnBg: '#fff7e6',
    danger: '#c0392b', dangerBg: '#fdeeee', gold: '#b08d3e',
    hl: '#fff3c4', codeBg: '#f6f8fa', codeText: '#24292e',
  },
  promo: {
    key: 'promo', label: '宣传类', scheme: 'editorial',
    // v10 平面化色板：低饱和陶土橙/雾青/墨，去高饱和撞色；全部纯色，无渐变无阴影
    deep: '#2f3640', purple: '#5f8d8a', pink: '#b08d8d',
    orange: '#c96f4a', amber: '#d9a35f', teal: '#5f8d8a',
    ink: '#2f3640', text: '#4a4a52', sub: '#94949e',
    bg: '#ffffff', soft: '#f7f3ee', border: '#e5ddd3',
    tip: '#3d8f74', tipBg: '#eef7f2', warn: '#a06a2c', warnBg: '#faf4e8',
    danger: '#b3453c', dangerBg: '#f9efed',
    hl: '#f2e3c2', codeBg: '#2f3640', codeText: '#f2ede6',
    // R16（2026-10-09）：补齐与 text 模式同名的语义键。
    // 缺失时消费方会写出 `border-left:4px solid undefined; color:undefined`——
    // 浏览器直接丢弃这两条声明，NOTE 气泡退化成"没有竖条、标题没有颜色"的纯色块。
    // 触发面很宽：`detectMode()` 只要见到 `> [!` 就判为宣传类，任何带气泡的文章都中招。
    accent: '#c96f4a', accentDark: '#a85736', heading: '#2f3640',
    soft2: '#fbf8f3',
  },
}

// 按主题覆盖设计键（第 17 轮：风格色板落地；未选主题返回默认双色系）
// 第 23 轮：正文 [[palette]] 自定义色板可覆盖预置色板或独立配色（风格不限预置）
const THEME_TEXT_KEYS = ['accent', 'accentDark', 'heading', 'soft', 'soft2', 'border', 'hl']
const THEME_PROMO_KEYS = ['orange', 'amber', 'teal', 'ink', 'soft', 'soft2', 'border', 'hl']

function makeDesign(modeKey: 'text' | 'promo', pal?: StylePalette, custom?: Record<string, string>): ComposeDesign {
  const base = DESIGNS[modeKey]
  const d: ComposeDesign = { ...base }
  if (pal) {
    d.bg = pal.bg
    if (modeKey === 'text') {
      d.accent = pal.accent
      d.accentDark = pal.accentDark
      d.heading = pal.heading
      d.soft = pal.soft
      d.soft2 = pal.soft2
      d.border = pal.border
      d.hl = pal.hl
    } else {
      d.orange = pal.orange
      d.amber = pal.amber
      d.teal = pal.teal
      d.ink = pal.ink
      d.soft = pal.soft
      d.soft2 = pal.soft2
      d.border = pal.border
      d.hl = pal.hl
    }
  }
  if (custom) {
    const keys = modeKey === 'text' ? ['bg', ...THEME_TEXT_KEYS] : ['bg', ...THEME_PROMO_KEYS]
    for (const k of keys) if (custom[k]) d[k] = custom[k]
  }
  return d
}

function rgba(hex: string, a: number): string {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return hex
  const n = parseInt(h, 16)
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string, d: ComposeDesign): string {
  let t = String(s)
  t = t.replace(/==([^=]+)==/g, '<span style="background:' + d.hl + ';padding:0 2px;border-radius:2px">$1</span>')
  t = t.replace(/`([^`]+)`/g, (_m, c: string) => {
    return '<span style="background-color:' + d.codeBg + ';border-radius:3px;padding:1px 5px;font-family:Consolas,Menlo,monospace;font-size:14px;color:' + d.accent + '">' + c + '</span>'
  })
  t = t.replace(/\[\[badge:([^\]]+)\]\]/g, (_m, text: string) => {
    if (d.key === 'promo') {
      return '<span style="display:inline-block;background:' + d.orange + ';color:#ffffff;border-radius:20px;padding:2px 12px;font-size:13px;font-weight:700;margin:0 2px">' + text + '</span>'
    }
    return '<span style="display:inline-block;background:' + d.soft + ';color:' + d.accentDark + ';border-radius:4px;padding:2px 9px;font-size:13px;font-weight:600;margin:0 2px">' + text + '</span>'
  })
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, src: string) => {
    // v10.2：art:// 装饰图统一居中收窄（≤56% 宽、小尺寸），本地/外链内容图保持全宽
    if (/^art:\/\//.test(src)) {
      return '<img src="' + src + '" alt="' + alt + '" style="max-width:56%;height:auto;display:inline-block;vertical-align:middle;border-radius:0;margin:12px auto" />'
    }
    return '<img src="' + src + '" alt="' + alt + '" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />'
  })
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, text: string, url: string) => {
    return '<a href="' + url + '" style="color:' + d.accent + ';text-decoration:none">' + text + '</a>'
  })
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  return t
}

function P(d: ComposeDesign, extra?: string): string {
  return '<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:' + d.text + ';word-break:break-word;letter-spacing:0.5px' + (extra || '') + '">'
}

// v10.1：宣传类普通段落也进"文字容器"（消除裸文字）；**容器长相跟随设计轴**（R18）
function paraBlock(d: ComposeDesign, innerHtml: string): string {
  if (d.key !== 'promo') return P(d) + innerHtml + '</p>'
  const t = faceOf(d)
  const c = d.orange
  const inner = '<p style="margin:0;font-size:16px;line-height:1.75;color:' + d.text + ';word-break:break-word;letter-spacing:0.5px">' + innerHtml + '</p>'
  return surface({ t, s: shellFor(t, 'flat'), c, solid: false, solidColor: '', fill: fillOf(t, c, false, d), bottom: 15, decoImg: '', quote: false, inner })
}

function timelineBlock(d: ComposeDesign, items: string[]): string {
  const t = faceOf(d)
  const c = d.key === 'promo' ? d.orange : d.accent
  const rail = t.frame === 'line' || t.frame === 'edge' ? t.barW : 2
  // 节点也走 `surface()`——否则它是唯一"不跟随设计轴"的容器（虚线/双线语言在它身上不生效）
  return '<section style="margin:0 0 16px;padding-left:22px;border-left:' + rail + 'px solid ' + c + '">' + items.map((it, idx) => {
    const inner = '<span style="position:absolute;left:-27px;top:15px;width:10px;height:10px;border-radius:50%;background:' + c + '"></span>' +
      '<span style="display:inline-block;color:' + c + ';font-size:13px;font-weight:700;margin-bottom:4px' + FACE_FONT_CSS[t.title] + '">' + (idx + 1) + '</span>' +
      '<p style="margin:0;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</p>'
    return surface({
      t, s: shellFor(t, 'flat'), c, solid: false, solidColor: '', fill: fillOf(t, c, false, d),
      bottom: 11, decoImg: '', quote: false, inner, margin: '0 0 14px',
    })
  }).join('') + '</section>'
}

function laceDivider(d: ComposeDesign): string {
  const c = d.key === 'promo' ? d.orange : '#c3ccd8'
  return '<section style="display:flex;align-items:center;margin:24px 0">' +
    '<span style="flex:1;height:1px;background:' + c + ';opacity:.5"></span>' +
    '<span style="display:inline-block;width:7px;height:7px;background:' + c + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
    '<span style="flex:1;height:1px;background:' + c + ';opacity:.5"></span></section>'
}

function titleBlockStyled(d: ComposeDesign, text: string, style: string, artUrls: Record<string, string>): string {
  const h = escapeHtml(text)
  if (style === 'box') {
    if (d.key === 'promo') {
      return '<section style="margin:28px 0 16px;padding:2px;border:2px solid ' + d.orange + ';border-radius:14px;text-align:center"><section style="background:#ffffff;border-radius:12px;padding:12px 22px"><span style="font-size:20px;font-weight:700;color:' + d.ink + ';letter-spacing:2px">' + h + '</span></section></section>'
    }
    return '<section style="margin:28px 0 16px;text-align:center;padding:12px 22px;border:2px solid ' + d.accent + ';border-radius:12px;background:' + d.soft2 + '"><span style="font-size:20px;font-weight:700;color:' + d.heading + ';letter-spacing:2px">' + h + '</span></section>'
  }
  if (style === 'vine') {
    // v10.2：藤蔓编织边框改为「标题上下各一条 vine-divider 花边」（窄、不高），不再用整幅 vine-frame 背景图
    const c = d.key === 'promo' ? d.orange : '#2f6fed'
    if (artUrls && artUrls['vine-divider']) {
      const vd = artUrls['vine-divider']
      return '<section style="margin:28px 0 16px;text-align:center">' +
        '<img src="' + vd + '" alt="" style="width:46%;height:auto;display:block;margin:0 auto 4px" />' +
        '<span style="display:inline-block;font-size:20px;font-weight:700;color:' + (d.key === 'promo' ? d.ink : d.heading) + ';letter-spacing:2px">' + h + '</span>' +
        '<img src="' + vd + '" alt="" style="width:46%;height:auto;display:block;margin:4px auto 0" /></section>'
    }
    return '<section style="margin:28px 0 16px;text-align:center"><span style="display:inline-block;width:8px;height:8px;background:' + c + ';transform:rotate(45deg);margin:0 8px;border-radius:1px"></span>' +
      '<span style="display:inline-block;height:2px;width:56px;background:' + c + ';vertical-align:4px"></span>' +
      '<span style="font-size:20px;font-weight:700;color:' + (d.key === 'promo' ? d.ink : d.heading) + ';letter-spacing:2px;margin:0 6px">' + h + '</span>' +
      '<span style="display:inline-block;height:2px;width:56px;background:' + c + ';vertical-align:4px"></span>' +
      '<span style="display:inline-block;width:8px;height:8px;background:' + c + ';transform:rotate(45deg);margin:0 8px;border-radius:1px"></span></section>'
  }
  return titleBlock(d, text)
}

function titleBlock(d: ComposeDesign, text: string): string {
  const h = escapeHtml(text)
  if (d.key === 'promo') {
    return '<section style="margin:28px 0 16px;display:flex;align-items:center;justify-content:center">' +
      '<span style="flex:0 0 52px;height:2px;background:' + d.border + '"></span>' +
      '<span style="display:inline-block;width:8px;height:8px;background:' + d.orange + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
      '<span style="font-size:20px;font-weight:700;color:' + d.ink + ';letter-spacing:2px">' + h + '</span>' +
      '<span style="display:inline-block;width:8px;height:8px;background:' + d.orange + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
      '<span style="flex:0 0 52px;height:2px;background:' + d.border + '"></span></section>'
  }
  return '<section style="margin:28px 0 16px;display:flex;align-items:center;justify-content:center">' +
    '<span style="flex:0 0 52px;height:2px;background:#e3e8ef"></span>' +
    '<span style="display:inline-block;width:8px;height:8px;background:#2f6fed;transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
    '<span style="font-size:20px;font-weight:700;color:' + d.heading + ';letter-spacing:2px">' + h + '</span>' +
    '<span style="display:inline-block;width:8px;height:8px;background:#2f6fed;transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
    '<span style="flex:0 0 52px;height:2px;background:#e3e8ef"></span></section>'
}

function colsBlock(d: ComposeDesign, items: string[]): string {
  const t = faceOf(d)
  const n = items.length
  const pct = n >= 3 ? '33.3%' : '50%'
  const c = d.key === 'promo' ? d.orange : d.accent
  return '<section style="margin:0 0 16px;display:flex;align-items:stretch">' + items.map((it, idx) => {
    const mr = idx === n - 1 ? '' : 'margin-right:12px;'
    const inner = '<p style="margin:0;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</p>'
    return surface({
      t, s: shellFor(t, 'flat'), c, solid: false, solidColor: '', fill: fillOf(t, c, false, d),
      bottom: 11, decoImg: '', quote: false, inner,
      margin: '0', extraStyle: 'flex:1;width:' + pct + ';' + mr,
    })
  }).join('') + '</section>'
}

function imgrowBlock(_d: ComposeDesign, items: { src: string; alt: string }[]): string {
  const n = items.length
  const pct = n >= 3 ? '33.3%' : '50%'
  return '<section style="margin:0 0 16px;display:flex;align-items:flex-start">' + items.map((it, idx) => {
    const mr = idx === n - 1 ? '' : 'margin-right:8px;'
    return '<img src="' + it.src + '" alt="' + it.alt + '" style="width:' + pct + ';max-width:100%;border-radius:8px;' + mr + 'display:block" />'
  }).join('') + '</section>'
}

function imgcardBlock(d: ComposeDesign, img: { src: string; alt: string }, captions: string[]): string {
  const cap = captions.map((l) => escapeHtml(l)).join('<br/>')
  return '<section style="margin:0 0 16px;background:#ffffff;border:1px solid ' + d.border + ';border-radius:12px;overflow:hidden">' +
    '<img src="' + img.src + '" alt="' + img.alt + '" style="width:100%;max-width:100%;display:block" />' +
    (cap ? '<section style="padding:8px 12px;font-size:13px;line-height:1.5;color:' + d.sub + ';background:' + d.soft2 + '">' + cap + '</section>' : '') +
    '</section>'
}

// v10 气泡：纯色底、无渐变、无 emoji 图标、无装饰圆；图案角饰走 art:// 资产（`> [!KEY|grass]`）
// 第 21 轮：支持正文现场定义装饰素材（::: art deco 名称）并在此类气泡语法 `> [!KEY|名称]` 中引用角饰
const DECO_MAP: Record<string, string> = { grass: 'sprig-grass', blossom: 'blossom-branch', leaf: 'leaf-corner' }

/**
 * R16（2026-10-09）：气泡的语义标签。
 *
 * 知识库（module-bubble）用"形状即情绪"表达语义——NOTE 空心圆 / TIP 实心圆 / WARN 旋转方块 /
 * DANGER 方形边框 / KEY 菱形。但**微信端拿不到这些形状标记**：纯靠宽高 + 背景撑起的空元素
 * 会被编辑器剥掉，`position:absolute` 官方列为"不推荐"（另有实测称整条被删）。
 * 因此本项目的"形状即情绪"改由**文字语义标签**承担——11px 字距标签始终在场，
 * 读者凭"这是哪一类提示"而不是凭形状辨认。
 */
export type BubbleKind = 'note' | 'tip' | 'warn' | 'danger' | 'key'

const BUBBLE_LABEL: Record<BubbleKind, string> = {
  note: '提示', tip: '技巧', warn: '注意', danger: '警示', key: '重点',
}

// ============ 设计轴（face tokens）—— "固定方案"升级为"可组合的设计词汇" ============
//
// 用户判词（R18）："你要做的不是补充几套固定语言，而是让模型能自主推断出这种风格的气泡应该怎么做。"
//
// R17 的形态是"引擎给菜单、模型挑一个"（`[[boxes:soft]]`）——能力上限就是菜单。这里**反过来**：
// 模型给出一组**正交设计轴的取值**（它从风格推断出的**设计意图**），引擎负责把意图**确定性**地
// 渲染成微信安全的 HTML。模型依旧不写 CSS / HTML / SVG（那是安全边界——写了会源码泄漏），
// 但它能组合出引擎**从未内置过**的长相。R17 的五个方案因此降级为轴组合的**别名**：预置是示例，不是上限。
//
// 轴（11 个取值域都不大，组合空间足够表达"这种风格该长什么样"）：
//   radius 圆角性格 0/4/8/14 ｜ frame 框架语言（见下）｜ bar 竖线粗细 2–5
//   fill 底色 none/tint/wash/paper ｜ label 语义标签形态 eyebrow/chip/mono/none
//   title 标题字体 sans/serif/mono ｜ size 标题字号 15/17/19
//   deco 装饰词汇 brackets/tape/quote（可多选）｜ pad 内距 tight/normal/loose
//
// **冲突消解必须留在引擎里**：模型没有义务记住"圆角会连坐 border-left 端点"这类实现细节，
// 它只需要说"我要左竖线"，引擎自己把圆角夹到 0。
export type FaceFrame = 'line' | 'edge' | 'plane' | 'dash' | 'rules' | 'stack' | 'none'
export type FaceFill = 'none' | 'tint' | 'wash' | 'paper'
export type FaceLabel = 'eyebrow' | 'chip' | 'mono' | 'none'
export type FaceFont = 'sans' | 'serif' | 'mono'
export type FacePad = 'tight' | 'normal' | 'loose'
export type FaceDeco = 'brackets' | 'tape' | 'quote'

export interface FaceTokens {
  radius: number
  frame: FaceFrame
  barW: number
  fill: FaceFill
  label: FaceLabel
  title: FaceFont
  size: number
  deco: FaceDeco[]
  pad: FacePad
}

const FACE_DEFAULT: FaceTokens = {
  radius: 0, frame: 'line', barW: 3, fill: 'tint',
  label: 'eyebrow', title: 'sans', size: 15, deco: ['brackets', 'quote'], pad: 'normal',
}

/** R17 的五个"固定语言"= 轴组合的**别名**（预置是示例，不是上限） */
export const FACE_PRESETS: Record<string, FaceTokens> = {
  editorial: FACE_DEFAULT,
  soft: { ...FACE_DEFAULT, radius: 14, frame: 'plane', fill: 'wash', label: 'chip', deco: [] },
  magazine: { ...FACE_DEFAULT, frame: 'stack', fill: 'none', title: 'serif', size: 17, deco: ['quote'] },
  sticker: { ...FACE_DEFAULT, radius: 14, frame: 'dash', fill: 'tint', label: 'chip', deco: ['tape'] },
  tech: { ...FACE_DEFAULT, frame: 'edge', fill: 'tint', label: 'mono', deco: [] },
}

/** 预置名（英文键 / 中文名 / 常见同义）→ 英文键 */
const FACE_PRESET_ALIAS: Record<string, string> = {
  editorial: 'editorial', 编辑感: 'editorial', 编辑: 'editorial', 杂志感: 'editorial',
  soft: 'soft', 亲和: 'soft', 柔和: 'soft', 圆润: 'soft',
  magazine: 'magazine', 杂志: 'magazine', 版式: 'magazine',
  sticker: 'sticker', 手账: 'sticker', 手帳: 'sticker', 贴纸: 'sticker',
  tech: 'tech', 科技: 'tech', 极客: 'tech',
}

/** 轴值的中文同义（模型用中文写值也认——与 [[theme:名称]] 同口径，避免静默落空） */
const FACE_VALUE_ALIAS: Record<string, string> = {
  直角: '0', 小圆角: '4', 圆角: '8', 大圆角: '14', 胶囊: '14',
  竖线: 'line', 竖条: 'line', 线: 'line', 底色: 'plane', 面: 'plane',
  虚线: 'dash', 夹线: 'rules', 双线: 'stack', 细边: 'edge', 无: 'none',
  浅: 'tint', 更浅: 'tint', 淡: 'tint', 深: 'wash', 纸: 'paper',
  字距标签: 'eyebrow', 小标签: 'eyebrow', 胶囊标签: 'chip', 等宽: 'mono',
  衬线: 'serif', 无衬线: 'sans', 角括号: 'brackets', 胶带: 'tape', 引号: 'quote',
  紧: 'tight', 常规: 'normal', 松: 'loose',
}

const FACE_AXES: Record<string, { pick: string[]; apply: (t: FaceTokens, vals: string[]) => boolean }> = {
  radius: { pick: ['0', '4', '8', '14'], apply: (t, v) => { t.radius = Number(v[0]); return true } },
  frame: { pick: ['line', 'edge', 'plane', 'dash', 'rules', 'stack', 'none'], apply: (t, v) => { t.frame = v[0] as FaceFrame; return true } },
  bar: { pick: ['2', '3', '4', '5'], apply: (t, v) => { t.barW = Number(v[0]); return true } },
  fill: { pick: ['none', 'tint', 'wash', 'paper'], apply: (t, v) => { t.fill = v[0] as FaceFill; return true } },
  label: { pick: ['eyebrow', 'chip', 'mono', 'none'], apply: (t, v) => { t.label = v[0] as FaceLabel; return true } },
  title: { pick: ['sans', 'serif', 'mono'], apply: (t, v) => { t.title = v[0] as FaceFont; return true } },
  size: { pick: ['15', '17', '19'], apply: (t, v) => { t.size = Number(v[0]); return true } },
  pad: { pick: ['tight', 'normal', 'loose'], apply: (t, v) => { t.pad = v[0] as FacePad; return true } },
  deco: { pick: ['none', 'brackets', 'tape', 'quote'], apply: (t, v) => { t.deco = (v[0] === 'none' ? [] : (v as FaceDeco[])); return true } },
}

/** 把 `[[boxes:]]` 的**载荷**解析成轴取值（载荷形如 `soft;radius=4;label=chip`） */
export function faceFromSpec(spec: string): { tokens: FaceTokens; preset: string; unknown: string[]; applied: number } {
  const tokens: FaceTokens = { ...FACE_DEFAULT, deco: [...FACE_DEFAULT.deco] }
  const unknown: string[] = []
  let preset = 'custom'
  let applied = 0
  const segs = String(spec || '').split(/[;；]/)
  for (const raw of segs) {
    const s0 = raw.trim()
    if (!s0) continue
    const eq = s0.indexOf('=')
    if (eq < 0) {
      const key = FACE_PRESET_ALIAS[s0] || FACE_PRESET_ALIAS[s0.toLowerCase()]
      if (!key) { unknown.push(s0); continue }
      Object.assign(tokens, FACE_PRESETS[key])
      tokens.deco = [...FACE_PRESETS[key].deco]
      preset = key
      applied++
      continue
    }
    const axis = s0.slice(0, eq).trim().toLowerCase()
    const def = FACE_AXES[axis]
    if (!def) { unknown.push(s0); continue }
    const vals = s0.slice(eq + 1).split(/[,，]/).map((v) => v.trim()).filter(Boolean).map((v) => VALUE_ALIAS_LOOKUP(v))
    if (!vals.length || !vals.every((v) => def.pick.includes(v))) { unknown.push(s0); continue }
    def.apply(tokens, vals)
    applied++
  }
  return { tokens, preset, unknown, applied }
}

function VALUE_ALIAS_LOOKUP(v: string): string {
  return FACE_VALUE_ALIAS[v] || v.toLowerCase()
}

/** 主题（palettes key）→ 预置别名 的默认映射；正文 `[[boxes:]]` 显式声明优先于它 */
const SCHEME_BY_THEME: Record<string, string> = {
  minimal: 'editorial', business: 'editorial',
  japanese: 'magazine', guochao: 'magazine',
  campus: 'soft', forest: 'soft',
  handbook: 'sticker', tech: 'tech',
}

/**
 * 正文声明优先，其次主题映射，最后 editorial。返回的是"载荷"字符串，直接喂 `faceFromSpec`。
 *
 * **声明整条都不认识时不能静默降级到默认语言**——那会让主题映射白设：`[[boxes:typo]]`
 * 应该"报错 + 用主题该有的语言"，而不是"报错 + 悄悄变成编辑感"。所以按 `applied` 计数判定：
 * 一个有效段都没有 ⇒ 当作没声明，回退主题映射。
 */
export function resolveFaceSpec(md: string, themeKey?: string): { spec: string; unknown: string[] } {
  const preset = (themeKey && SCHEME_BY_THEME[themeKey]) || 'editorial'
  const m = /\[\[boxes:\s*([^\]]+?)\s*\]\]/.exec(String(md || ''))
  if (m) {
    const raw = m[1].trim()
    const r = faceFromSpec(raw)
    if (r.applied > 0) return { spec: raw, unknown: r.unknown }
    return { spec: preset, unknown: r.unknown }
  }
  return { spec: preset, unknown: [] }
}

/** 兼容 R17 的断言口径：返回解析出来的**预置名**（纯轴组合时为 'custom'） */
export function resolveBoxScheme(md: string, themeKey?: string): string {
  return faceFromSpec(resolveFaceSpec(md, themeKey).spec).preset
}

/** 从设计对象取当前轴取值（`d.scheme` 存的是载荷字符串） */
export function faceOf(d: ComposeDesign): FaceTokens {
  return faceFromSpec(d.scheme || '').tokens
}

export interface DecoSpec {
  svg: string
  alt: string
  idx: number // arts 列表占位编号（@@ARTn@@）
  hAt60: number // P0：按 viewBox 宽高比折算的"60px 宽时显示高度"，供气泡预留避让空间
}

// 角饰显示尺寸与避让（P0，2026-09-24 调查 §3）：角饰按 60px 宽显示，但气泡原本只留固定内边距，
// 高角饰会压字；vivid 气泡还有 overflow:hidden，超高部分直接被裁掉。这里按实际高度预留底部空间。
const DECO_W = 60
const DECO_MAX_H = 56

/** 由 viewBox 宽高比折算指定显示宽度下的高度（无法解析时按正方形估） */
function heightAtWidth(svg: string, width: number): number {
  const m = /viewBox="\s*[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)"/.exec(svg)
  if (!m) return width
  const w = parseFloat(m[1])
  const h = parseFloat(m[2])
  if (!w || w <= 0 || !h || h <= 0) return width
  return Math.round((h / w) * width)
}

/** 气泡为右下角饰预留的底部内边距（含角饰贴底 10px 与 4px 缓冲，上限 76px） */
function decoReserve(spec: DecoSpec | null | undefined): number {
  if (!spec) return 0
  const h = Math.min(spec.hAt60, DECO_MAX_H)
  return Math.min(10 + h + 4, 76)
}

// ---------- 壳（shell）：**唯一**写圆角/边框/底色/内距的地方 ----------
//
// 各容器只声明"我要哪种壳 + 什么语义"，由这里合成 HTML。这样"容器 × 设计轴"不是乘法——
// 加一个容器只要调一次 `surface()`，加一个轴只要改这里一处。

type ShellKind = 'bar' | 'box' | 'edge' | 'rules' | 'stack' | 'dash' | 'none'
interface Shell {
  kind: ShellKind
  barW: number
  strong: boolean   // 竖线用满色（而非 55%）
  bracket: boolean  // 对角两个 2px 角括号
}

/**
 * 由「框架轴 + 语义档位」求出具体壳。**语义阶梯（越重越封闭）在这里落地**——
 * 模型只需要说"frame=line"，不需要自己记得 warn 该用框、key 该用夹线。
 */
/**
 * `flat` = 卡片 / 段落 / 分栏 / 时间线这类**非强调容器**用的壳。
 * 它们不借"强调竖线"（否则每段一根竖线就成了噪音），而是取该框架语言里**中性的容器形态**：
 * line→细框、edge→细框+左粗线、plane→只底色、dash→虚线、stack→双线、rules/none→无框。
 */
const FLAT_SHELL: Record<FaceFrame, ShellKind> = {
  line: 'box', edge: 'edge', plane: 'none', dash: 'dash', rules: 'box', stack: 'stack', none: 'none',
}

function shellFor(t: FaceTokens, k: BubbleKind | 'flat'): Shell {
  const brackets = t.deco.includes('brackets')
  const heavy = k === 'warn' || k === 'danger'
  if (k === 'flat') return { kind: FLAT_SHELL[t.frame], barW: t.barW, strong: true, bracket: false }
  switch (t.frame) {
    case 'line':
      if (k === 'key') return { kind: 'rules', barW: t.barW, strong: false, bracket: false }
      if (heavy) return { kind: 'box', barW: t.barW, strong: false, bracket: brackets && k === 'danger' }
      return { kind: 'bar', barW: k === 'tip' ? t.barW + 1 : t.barW, strong: k === 'tip', bracket: false }
    case 'edge': return { kind: 'edge', barW: t.barW, strong: true, bracket: brackets && k === 'danger' }
    case 'dash': return { kind: 'dash', barW: t.barW, strong: false, bracket: false }
    case 'rules': return { kind: 'rules', barW: t.barW, strong: false, bracket: false }
    case 'stack': return { kind: 'stack', barW: t.barW, strong: false, bracket: brackets && k === 'danger' }
    default: return { kind: 'none', barW: t.barW, strong: false, bracket: false }
  }
}

/** 底色轴 → 实际颜色（实色反白由调用方另行给） */
function fillOf(t: FaceTokens, c: string, heavy: boolean, d: ComposeDesign): string {
  switch (t.fill) {
    case 'none': return ''
    case 'paper': return d.soft2 || d.soft
    case 'wash': return rgba(c, heavy ? 0.14 : 0.1)
    default: return rgba(c, heavy ? 0.09 : 0.07)
  }
}

const FACE_FONT_CSS: Record<FaceFont, string> = {
  sans: '',
  serif: ";font-family:Georgia,'Songti SC','SimSun',serif;letter-spacing:.5px",
  mono: ';font-family:Consolas,Menlo,monospace',
}

/** 语义标签轴 → 实际形态 */
function labelHtml(t: FaceTokens, text: string, c: string, solid: boolean): string {
  if (!text || t.label === 'none') return ''
  const col = solid ? rgba('#ffffff', 0.78) : c
  if (t.label === 'chip') {
    return '<p style="margin:0 0 7px;line-height:1.4"><span style="display:inline-block;background:' +
      (solid ? rgba('#ffffff', 0.22) : rgba(c, 0.16)) + ';color:' + (solid ? '#ffffff' : c) +
      ';border-radius:10px;padding:2px 10px;font-size:12px;font-weight:700">' + text + '</span></p>'
  }
  if (t.label === 'mono') {
    return '<p style="margin:0 0 7px;font-size:11px;font-weight:700;letter-spacing:1px;line-height:1.4;font-family:Consolas,Menlo,monospace;color:' + col + '">// ' + text + '</p>'
  }
  return '<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;line-height:1.4;color:' + col + '">' + text + '</p>'
}

function faceTitle(t: FaceTokens, ttl: string, color: string): string {
  return ttl
    ? '<p style="margin:0 0 6px;font-size:' + t.size + 'px;font-weight:700;line-height:1.5;color:' + color + FACE_FONT_CSS[t.title] + '">' + escapeHtml(ttl) + '</p>'
    : ''
}

function faceBody(html: string, color: string): string {
  return html ? '<p style="margin:0;font-size:14px;line-height:1.75;color:' + color + '">' + html + '</p>' : ''
}

interface SurfaceOpts {
  t: FaceTokens
  s: Shell
  c: string            // 语义色（竖线 / 边框 / 标签 / 引号）
  solid: boolean       // 实色反白（宣传类 key/tip/danger）
  solidColor: string
  fill: string
  bottom: number       // 底部内距（角饰避让）
  decoImg: string      // 绝对定位角饰图（气泡专用，其它容器传 ''）
  quote: boolean       // KEY 的出血大引号
  inner: string        // 标签 + 标题 + 正文
  /** 覆盖默认块距（并排容器要在 flex 里用别的边距） */
  margin?: string
  /** 额外内联样式（并排容器的 flex 尺寸等） */
  extraStyle?: string
}

function secBox(margin: string, style: string, inner: string): string {
  return '<section style="' + (margin ? 'margin:' + margin + ';' : '') + style + '">' + inner + '</section>'
}

/**
 * 把「壳 + 轴」合成一段微信安全 HTML。
 *
 * **冲突消解在这里，不在模型那边**——模型没有义务记住"圆角会连坐 border-left 端点"这类实现细节：
 * 它说 `frame=line`（要左竖线），这里就把圆角夹到 0；它说实色反白，这里就换成嵌套 shell 加内衬亮边。
 */
function surface(o: SurfaceOpts): string {
  const { t, s, c, solid, fill, bottom, decoImg, inner } = o
  const minBottom = t.pad === 'tight' ? 12 : t.pad === 'loose' ? 18 : 15
  const pad = (t.pad === 'tight' ? 11 : t.pad === 'loose' ? 17 : 13) + 'px 16px ' + Math.max(minBottom, bottom) + 'px'
  const tape = t.deco.includes('tape')
    ? '<span style="position:absolute;left:20px;top:-8px;width:52px;height:15px;background:' +
      (solid ? rgba('#ffffff', 0.4) : rgba(c, 0.5)) + ';transform:rotate(-4deg);border-radius:1px"></span>'
    : ''
  const brackets = s.bracket
    ? '<span style="position:absolute;left:-1px;top:-1px;width:16px;height:16px;border-left:2px solid ' + c + ';border-top:2px solid ' + c + '"></span>' +
      '<span style="position:absolute;right:-1px;bottom:-1px;width:16px;height:16px;border-right:2px solid ' + c + ';border-bottom:2px solid ' + c + '"></span>'
    : ''
  const quote = o.quote && t.deco.includes('quote')
    ? '<p style="margin:0 0 -14px;font-size:46px;line-height:1;font-family:Georgia,serif;color:' + rgba(c, solid ? 0.5 : 0.3) + '">“</p>'
    : ''
  const body = tape + brackets + quote + inner + decoImg
  const margin = o.margin !== undefined ? o.margin : (tape ? '14px 0 16px' : '0 0 16px')
  const extra = o.extraStyle || ''

  // 实色反白**只改底色与线条色，框架语言照常**——否则"整篇一套设计语言"会在宣传类的
  // key/tip/danger 上断掉（双线、虚线这些签名特征会整条消失）。夹线在实色下退化为整圈框
  // （夹线没有底色，撑不住一块实色）。
  const bg = solid ? o.solidColor : fill
  const kind: ShellKind = solid && s.kind === 'rules' ? 'box' : s.kind
  const line = (a: number) => (solid ? rgba('#ffffff', a) : rgba(c, a))
  const strong = solid ? '#ffffff' : c
  if (solid && kind === 'none') {
    // 实色 + 无框架 = 大面积死色，补一圈内衬亮边把它撑起来
    const ring = secBox('', 'border:1px solid ' + rgba('#ffffff', 0.32) + ';border-radius:' + Math.max(0, t.radius - 2) +
      'px;padding:' + pad + ';position:relative', body)
    return secBox(margin, extra + 'border-radius:' + (t.radius ? t.radius + 'px' : '0') + ';background:' + o.solidColor + ';padding:2px;overflow:hidden', ring)
  }

  switch (kind) {
    case 'bar':
      // 左竖线必须直角——圆角会把竖条两头一起圆掉（"圆角与硬直竖线语言冲突"的具体形态）
      return secBox(margin, extra + 'background:' + bg + ';border-left:' + s.barW + 'px solid ' + (s.strong ? strong : line(0.55)) +
        ';padding:' + pad + ';position:relative', body)
    case 'box':
      return secBox(margin, extra + 'background:' + bg + ';border:1px solid ' + line(0.42) + ';border-radius:' + t.radius +
        'px;padding:' + pad + ';position:relative', body)
    case 'edge':
      return secBox(margin, extra + 'background:' + bg + ';border:1px solid ' + line(0.4) + ';border-left:' + s.barW +
        'px solid ' + strong + ';padding:' + pad + ';position:relative', body)
    case 'dash':
      return secBox(margin, extra + 'border:1px dashed ' + line(0.55) + ';border-radius:' + t.radius + 'px;background:' + bg +
        ';padding:' + pad + ';position:relative', body)
    case 'rules':
      return secBox(margin, extra + 'border-top:2px solid ' + line(0.5) + ';border-bottom:2px solid ' + line(0.5) +
        ';padding:' + pad + ';position:relative', body)
    case 'stack': {
      // 双线用嵌套 section（`border-style:double` 在 1–2px 下看不出，且不在微信白名单）。
      // 外圈圆角 = 内圈 + 3px 的衬距，两层同心才不"别着"。
      const rr = t.radius ? ';border-radius:' + t.radius + 'px' : ''
      const innerBox = secBox('', 'border:1px solid ' + line(0.24) + ';background:' + bg + rr + ';padding:' + pad +
        ';position:relative', body)
      return secBox(margin, extra + 'border:1px solid ' + line(0.55) + (t.radius ? ';border-radius:' + (t.radius + 3) + 'px' : '') + ';padding:3px', innerBox)
    }
    default:
      // 无边框的壳**更要带上圆角**——`plane`（靠底色成块）这一族语言里，圆角就是它的"形"
      return secBox(margin, extra + (bg ? 'background:' + bg + ';' : '') + (t.radius ? 'border-radius:' + t.radius + 'px;' : '') +
        'padding:' + pad + ';position:relative', body)
  }
}

function bubble(
  d: ComposeDesign,
  kind: string,
  title: string,
  body: string[],
  decoName: string,
  artUrls: Record<string, string>,
  decoMap: Record<string, DecoSpec>,
): string {
  const t = faceOf(d)
  const k: BubbleKind = (BUBBLE_LABEL as Record<string, string>)[kind] ? (kind as BubbleKind) : 'note'
  const meta = {
    note: { label: BUBBLE_LABEL.note, c: d.sub },
    tip: { label: BUBBLE_LABEL.tip, c: d.tip },
    warn: { label: BUBBLE_LABEL.warn, c: d.warn },
    danger: { label: BUBBLE_LABEL.danger, c: d.danger },
    key: { label: BUBBLE_LABEL.key, c: d.accentDark },
  }[k]
  const ttl = title && title !== meta.label ? title : ''
  const bodyText = body.length ? body.map((l) => inline(l, d)).join('<br/>') : ''
  const solid = d.key === 'promo' && (k === 'key' || k === 'tip' || k === 'danger')
  const solidColor = k === 'danger' ? d.danger : k === 'tip' ? d.tip : d.orange
  const heavy = k === 'warn' || k === 'danger'
  const artName = DECO_MAP[decoName] || decoName
  // 角饰来源：预置资产 URL（artUrls）> 现场装饰素材（::: art deco 定义，第 21 轮）
  let src = artName && artUrls && artUrls[artName] ? artUrls[artName] : null
  const spec = decoMap ? decoMap[decoName] : undefined
  if (!src && spec) src = '@@ART' + spec.idx + '@@'
  // P0：角饰按实际高度预留底部内边距（实色气泡还有 overflow:hidden，不留就会裁切）
  const reserve = decoReserve(spec)
  const decoImg = src
    ? '<img src="' + src + '" alt="" style="position:absolute;right:12px;bottom:10px;width:' + DECO_W + 'px;height:auto;max-height:' + DECO_MAX_H + 'px;pointer-events:none;opacity:.9;display:block" />' : ''

  const inner = labelHtml(t, meta.label, meta.c, solid) +
    faceTitle(t, ttl, solid ? '#ffffff' : d.heading) +
    faceBody(bodyText, solid ? rgba('#ffffff', 0.92) : d.text)
  return surface({
    t, s: shellFor(t, k), c: meta.c, solid, solidColor,
    fill: fillOf(t, meta.c, heavy, d),
    bottom: solid ? Math.max(12, reserve - 2) : reserve,
    decoImg, quote: k === 'key', inner,
  })
}

function divider(d: ComposeDesign, kind: string): string {
  if (d.key === 'promo') {
    if (kind === '***') {
      return '<section style="text-align:center;margin:24px 0"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.orange + ';margin:0 4px"></span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.amber + ';margin:0 4px"></span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.teal + ';margin:0 4px"></span></section>'
    }
    if (kind === '___') {
      return '<section style="margin:24px 0;display:flex;align-items:center"><span style="flex:1;height:2px;background:' + d.border + '"></span><span style="display:inline-block;width:8px;height:8px;background:' + d.orange + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span><span style="flex:1;height:2px;background:' + d.border + '"></span></section>'
    }
    if (kind === '~~~') {
      return '<section style="margin:24px 0"><section style="height:6px;border-radius:3px;background:' + d.orange + '"></section><section style="height:3px;border-radius:2px;background:' + d.amber + ';margin-top:3px;opacity:.7"></section></section>'
    }
    return '<section style="height:1px;background:' + d.border + ';margin:24px 0"></section>'
  }
  if (kind === '***') {
    return '<section style="text-align:center;margin:24px 0"><span style="display:inline-block;color:#c3ccd8;letter-spacing:8px;font-size:14px">· · ·</span></section>'
  }
  if (kind === '___') {
    return '<section style="height:3px;border-radius:2px;background:#c9d8ef;margin:24px 0"></section>'
  }
  return '<section style="height:1px;background:#e8edf3;margin:24px 0"></section>'
}

function heading(d: ComposeDesign, level: number, text: string, counter: number | null): string {
  const h = escapeHtml(text)
  if (d.key === 'promo') {
    if (level === 1) {
      return '<section style="margin:28px 0 16px;text-align:center"><span style="display:inline-block;font-size:22px;font-weight:800;color:' + d.ink + ';border-bottom:4px solid ' + d.hl + ';padding:0 6px 2px">' + h + '</span></section>'
    }
    if (level === 2) {
      const n = typeof counter === 'number' ? counter : ''
      return '<section style="margin:28px 0 12px;display:flex;align-items:center"><span style="display:inline-block;min-width:26px;height:26px;border-radius:8px 8px 8px 2px;background:' + d.orange + ';color:#ffffff;font-size:15px;font-weight:800;text-align:center;line-height:26px;margin-right:8px">' + n + '</span><span style="font-size:20px;font-weight:700;color:' + d.ink + '">' + h + '</span></section>'
    }
    return '<section style="margin:24px 0 10px;font-size:17px;font-weight:700;color:' + d.purple + ';border-left:4px solid ' + d.orange + ';padding-left:10px">' + h + '</section>'
  }
  const sizes: Record<number, number> = { 1: 22, 2: 20, 3: 18, 4: 17, 5: 16, 6: 15 }
  const bar = level <= 2 ? 'border-left:4px solid ' + d.accent + ';padding-left:10px;' : ''
  return '<h' + level + ' style="margin:28px 0 12px;font-size:' + sizes[level] + 'px;font-weight:bold;line-height:1.5;color:' + d.heading + ';' + bar + '">' + h + '</h' + level + '>'
}

/**
 * 普通引用——**跟随设计轴**（R18）。
 *
 * 引用的结构语言由 `frame` 决定：`line` 左竖线 + 缩进（编辑设计里最经典的引用手法）、
 * `plane` 圆角色块、`dash` 虚线框、`stack` 双线、`rules` 上下夹线居中、`edge` 细框 + 左粗线。
 * 圆角由 `radius` 给；左竖线分支**不带圆角**（圆角会把竖条两头一起圆掉）。
 */
function quoteBlock(d: ComposeDesign, lines: string[]): string {
  const t = faceOf(d)
  const body = lines.map((l) => inline(l, d)).join('<br/>')
  const c = d.key === 'promo' ? d.orange : d.accent
  const color = d.key === 'promo' ? d.text : '#5a6472' // 白底上 5.99:1，守住 ≥4.5:1
  const base = 'margin:0 0 16px;line-height:1.75;color:' + color
  const fill = rgba(c, 0.06)
  switch (t.frame) {
    case 'plane':
      return '<blockquote style="' + base + ';background:' + fill + ';border-radius:' + t.radius + 'px;padding:14px 16px;font-size:15px">' + body + '</blockquote>'
    case 'dash':
      return '<blockquote style="' + base + ';border:1px dashed ' + rgba(c, 0.55) + ';border-radius:' + t.radius + 'px;background:' + fill + ';padding:13px 15px;font-size:15px">' + body + '</blockquote>'
    case 'stack':
      return '<blockquote style="' + base + ';border:1px solid ' + rgba(c, 0.5) + ';padding:3px"><blockquote style="margin:0;border:1px solid ' + rgba(c, 0.22) + ';background:' + fill + ';padding:12px 14px;font-size:15px">' + body + '</blockquote></blockquote>'
    case 'rules':
      return '<blockquote style="' + base + ';border-top:1px solid ' + rgba(c, 0.5) + ';border-bottom:1px solid ' + rgba(c, 0.5) + ';padding:12px 4px;text-align:center;font-size:16px">' + body + '</blockquote>'
    case 'edge':
      return '<blockquote style="' + base + ';border:1px solid ' + rgba(c, 0.4) + ';border-left:' + t.barW + 'px solid ' + c + ';background:' + fill + ';padding:12px 14px;font-size:15px">' + body + '</blockquote>'
    case 'none':
      return '<blockquote style="' + base + ';padding:2px 0 2px 14px;font-size:15px">' + body + '</blockquote>'
    default:
      return '<blockquote style="' + base + ';border-left:' + t.barW + 'px solid ' + rgba(c, 0.55) +
        ';padding:2px 0 2px 14px;font-size:15px' + (t.title === 'mono' ? ';font-family:Consolas,Menlo,monospace' : '') + '">' + body + '</blockquote>'
  }
}

function card(d: ComposeDesign, title: string, lines: string[]): string {
  const t = faceOf(d)
  const c = d.key === 'promo' ? d.orange : d.accent
  const body = lines.map((l) => '<p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(l, d) + '</p>').join('')
  const head = '<p style="margin:0 0 9px;font-size:' + t.size + 'px;font-weight:700;line-height:1.5;color:' + d.heading + FACE_FONT_CSS[t.title] + '">' + inline(escapeHtml(title), d) + '</p>'
  return surface({ t, s: shellFor(t, 'flat'), c, solid: false, solidColor: '', fill: fillOf(t, c, false, d), bottom: 12, decoImg: '', quote: false, inner: head + body })
}

function steps(d: ComposeDesign, items: string[]): string {
  const t = faceOf(d)
  const bg = d.key === 'promo' ? d.orange : d.accent
  // 序号徽章的形状跟随圆角轴：圆润语言给圆泡，直角语言给方泡
  const badgeR = t.radius >= 8 ? '50%' : t.radius + 'px'
  return items.map((it, idx) => {
    return '<section style="margin:0 0 16px;display:flex;align-items:flex-start">' +
      '<span style="display:inline-block;width:24px;height:24px;border-radius:' + badgeR + ';background:' + bg + ';color:#ffffff;font-size:14px;font-weight:700;text-align:center;line-height:24px;flex-shrink:0;margin-right:10px' + FACE_FONT_CSS[t.title] + '">' + (idx + 1) + '</span>' +
      '<span style="font-size:16px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</span></section>'
  }).join('')
}

function banner(d: ComposeDesign, title: string, sub: string): string {
  const t = escapeHtml(title)
  const s = escapeHtml(sub || '')
  if (d.key === 'promo') {
    return '<section style="margin:0 0 16px;border-radius:14px;background:' + d.orange + ';padding:24px 18px;text-align:center">' +
      '<p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:1px">' + t + '</p>' +
      (s ? '<p style="margin:0;font-size:14px;color:rgba(255,255,255,.92)">' + s + '</p>' : '') + '</section>'
  }
  return '<section style="margin:28px 0 16px;text-align:center"><span style="display:inline-block;font-size:20px;font-weight:700;color:' + d.heading + ';border-bottom:2px solid ' + d.accent + ';padding-bottom:4px">' + t + '</span>' +
    (s ? '<p style="margin:6px 0 0;font-size:14px;color:' + d.sub + '">' + s + '</p>' : '') + '</section>'
}

function bandBlock(d: ComposeDesign, items: string[], pattern: string): string {
  const t = faceOf(d)
  const body = items.map((l) => inline(l, d)).join('<br/>')
  const c = d.key === 'promo' ? d.orange : d.accent
  // v10：band 花纹全部用纯色几何 span 拼装（零渐变零阴影），花纹种类只影响装饰形状
  const patMap: Record<string, string> = { 斜纹: 'diagonal', 波点: 'dots', 棋盘: 'checker', 条纹: 'stripe', 圆环: 'ring' }
  const pat = patMap[pattern] || 'diagonal'
  const unitStyle = pat === 'dots' ? 'width:6px;height:6px;border-radius:50%;background:' + rgba(c, 0.35)
    : pat === 'checker' ? 'width:7px;height:7px;border-radius:2px;background:' + rgba(c, 0.28)
    : pat === 'ring' ? 'width:9px;height:9px;border-radius:50%;border:2px solid ' + rgba(c, 0.45) + ';box-sizing:border-box'
    : pat === 'stripe' ? 'width:12px;height:4px;border-radius:2px;background:' + rgba(c, 0.4)
    : 'width:6px;height:6px;background:' + rgba(c, 0.35) + ';transform:rotate(45deg);border-radius:1px'
  let deco = ''
  for (let k = 0; k < 10; k++) {
    deco += '<span style="display:inline-block;margin:0 5px 6px 0;' + unitStyle + '"></span>'
  }
  const inner = '<section style="margin:0 0 8px;line-height:0">' + deco + '</section>' +
    '<p style="margin:0;font-size:15px;line-height:1.75;color:' + d.text + '">' + body + '</p>'
  return surface({
    t, s: shellFor(t, 'flat'), c, solid: false, solidColor: '',
    fill: fillOf(t, c, false, d) || rgba(c, 0.06), bottom: 13, decoImg: '', quote: false, inner,
  })
}

function frameBlock(d: ComposeDesign, items: string[]): string {
  const t = faceOf(d)
  const c = d.key === 'promo' ? d.orange : d.accent
  const body = items.map((l) => '<p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(l, d) + '</p>').join('')
  // 边框容器额外允许角括号装饰（`deco` 里有 brackets 就挂对角两个）
  const s: Shell = { ...shellFor(t, 'flat'), bracket: t.deco.includes('brackets') }
  return surface({ t, s, c, solid: false, solidColor: '', fill: fillOf(t, c, false, d), bottom: 13, decoImg: '', quote: false, inner: body })
}

function listBlock(d: ComposeDesign, ordered: boolean, items: string[]): string {
  if (d.key === 'promo') {
    const t = faceOf(d)
    const c = d.orange
    const bulletR = t.radius >= 8 ? '50%' : '1px'
    const rows = items.map((it) => {
      return '<section style="margin:0 0 10px;display:flex;align-items:flex-start">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:' + bulletR + ';background:' + c + ';margin:9px 10px 0 0;flex-shrink:0"></span>' +
        '<span style="font-size:16px;line-height:1.75;color:' + d.text + '">' + it + '</span></section>'
    }).join('')
    return surface({ t, s: shellFor(t, 'flat'), c, solid: false, solidColor: '', fill: fillOf(t, c, false, d), bottom: 11, decoImg: '', quote: false, inner: rows })
  }
  const tag = ordered ? 'ol' : 'ul'
  const ls = ordered ? 'decimal' : 'disc'
  return '<' + tag + ' style="margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.75;color:' + d.text + ';list-style:' + ls + '">' +
    items.map((it) => '<li style="margin:4px 0">' + it + '</li>').join('') + '</' + tag + '>'
}

function tableBlock(d: ComposeDesign, rows: string[]): string {
  const cells = (row: string) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const thStyle = d.key === 'promo'
    ? 'border:1px solid ' + d.border + ';padding:6px 10px;background:' + d.orange + ';color:#ffffff;font-weight:bold;text-align:left'
    : 'border:1px solid #e3e8ef;padding:6px 10px;background:#f7f9fc;font-weight:bold;text-align:left'
  const tdStyle = 'border:1px solid ' + d.border + ';padding:6px 10px'
  let out = '<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:15px;line-height:1.6;color:' + d.text + '">'
  for (let r = 0; r < rows.length; r++) {
    if (r === 1) continue
    const tag = r === 0 ? 'th' : 'td'
    const style = r === 0 ? thStyle : tdStyle
    out += '<tr>'
    for (const c of cells(rows[r])) out += '<' + tag + ' style="' + style + '">' + inline(c, d) + '</' + tag + '>'
    out += '</tr>'
  }
  return out + '</table>'
}

function codeBlock(d: ComposeDesign, code: string[]): string {
  return '<section style="background:' + d.codeBg + ';border-radius:8px;padding:12px 16px;margin:0 0 16px;overflow-x:auto">' +
    '<p style="margin:0;font-size:14px;line-height:1.6;color:' + d.codeText + ';font-family:Consolas,Menlo,monospace;white-space:pre-wrap">' +
    code.map((l) => escapeHtml(l)).join('<br/>') + '</p></section>'
}

export function detectMode(md: string, explicit?: string): 'text' | 'promo' {
  if (explicit === 'text' || explicit === 'promo') return explicit
  const s = String(md || '')
  if (/:::\s*(card|steps)/.test(s) || /^>\s*\[!/m.test(s) || /\[\[banner/.test(s) || /\[\[badge/.test(s) || /art:\/\//.test(s) || /^~{3,}$/m.test(s)) return 'promo'
  return 'text'
}

export interface ComposeOptions {
  mode?: 'auto' | 'text' | 'promo'
  theme?: string // UI 显式风格选择（palettes key，优先于正文 [[theme:名称]] 声明）
}

export interface ComposeImage {
  local: string
  alt: string
}

export interface ArtSpec {
  svg: string
  alt: string
  wide: boolean // true=整行全宽；false=居中 ≤56%（行内装饰）
}

/**
 * 解析阶段的**结构化问题**（2026-09-29 质量恢复计划 §3.2）。
 *
 * 为什么要有它：这一轮真实故障里，照片位把后面的素材块整段吞掉、把 SVG 源码转义成可见文字，
 * 而产出只有一个 `warnings: string[]`——调用方只能靠 `includes('某个中文子串')` 反推发生了什么，
 * 既定位不到源文位置，也没法判定"这算不算阻断成品"。中文文案只该负责展示，不该当分支条件。
 *
 * 每条问题带足够的**机器可读**信息：稳定代码、严重度、源文行范围、关联的素材标识。
 */
export interface ComposeIssue {
  /** 稳定代码（分支只认它，不认中文文案）：如 `parse.unclosed-block`、`parse.leak`、`asset.rejected` */
  code: string
  severity: 'blocking' | 'warning' | 'info'
  /** 面向用户的说明（可展示，但不作为判定依据） */
  message: string
  /** 源文行号，1-based、闭区间 */
  line: number
  endLine: number
  /** 关联的素材标识（`::: art …` 头里的别名/ID 候选，用于把问题映射回素材位台账） */
  assetRefs?: string[]
  /** 证据摘要（可核对的片段/数值，供界面与日志展示；不参与分支判定） */
  evidence?: string
}

/** `::: art …` 被本地质检拒收的记录：素材位据此**回写台账**，不再"读到了就算完成" */
export interface RejectedArt {
  /** 头部的别名/ID 候选（空格分隔的整段，逐个与台账比对） */
  refs: string[]
  line: number
  reason: string
  /** 拒收发生在预扫描的 `::: art deco <名称>` 定义里（气泡角饰），否则是整行图 */
  deco: boolean
}

export interface ComposeResult {
  html: string
  plainText: string
  images: ComposeImage[]
  arts: ArtSpec[]
  warnings: string[]
  /** 结构化解析问题（与 warnings 并存：warnings 继续负责展示，issues 负责判定与定位） */
  issues: ComposeIssue[]
  /** 被质检拒收的现场素材块（供调用方回写素材位台账并计入交付门禁） */
  rejectedArts: RejectedArt[]
  /**
   * **作者节点**（带源文行号）-：正文投影与事实保护的输入（DS 修复指南 §4.2）。
   * 由 `emit` 的元信息直接产出，不再靠对渲染后 HTML 做正则去猜"哪些字是作者写的"。
   * 用 `projectionOf(result.authorUnits)` 取三态投影。
   */
  authorUnits: AuthorUnit[]
  mode: 'text' | 'promo'
  modeLabel: string
}

// 统计 SVG 的图形元素数（circle/rect/ellipse/line/path/polygon/polyline/image；剥离 defs/渐变/注释）
export function svgElementCount(svg: string): number {
  const body = String(svg || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(defs|clipPath|mask|filter|linearGradient|radialGradient|pattern|stop|style|desc|title|metadata)[\s\S]*?<\/\1>/gi, '')
  const m = body.match(/<(circle|rect|ellipse|line|path|polygon|polyline|image)\b/gi)
  return m ? m.length : 0
}

// ---------- 有边界的块收集（2026-09-29 质量恢复计划 §3.1/§3.2） ----------

/**
 * 是否是"块起点"（`::: <kind>`）。与单独一行的结束标记 `:::` 区分开——
 * 这个区别就是本轮事故的分水岭：旧解析器把**后面某个块的结束符**当成了本块的结束符。
 */
function isBlockStart(t: string): boolean {
  return /^:::\s*\S/.test(t)
}

interface BlockScan {
  /** 块体行（原样保留，调用方按需 trim） */
  body: string[]
  /** 主循环应移动到的下一个索引（已消费的位置之后） */
  end: number
  /** 是否找到本块的结束标记（单独一行的 `:::`） */
  closed: boolean
}

/**
 * 有边界的块体收集：从 `start` 起向后收集，**遇到下一个块起点即停止**，不跨越块边界。
 *
 * 旧实现是"一路扫到下一个 `:::`"——可那个 `:::` 很可能是后面某个块的结束符。真实故障
 * `s1790565874610554000` 正是如此：`::: photo …` 后面跟着普通段落与一个 `::: art` 素材块，
 * `:::` 只在**素材块**末尾出现，于是照片位把段落、素材块头与整段 SVG 全部吞进自己的"说明"里，
 * 再转义输出成可见文字（3 处源码泄漏，成品里 0 个 art）。本函数是这条根因的确定性修复：
 * 程序错误用程序修，不让模型反复重写文章去补偿。
 */
function collectBlockBody(lines: string[], start: number): BlockScan {
  const body: string[] = []
  for (let k = start; k < lines.length; k++) {
    const t = lines[k].trim()
    if (t === ':::') return { body, end: k + 1, closed: true }
    if (isBlockStart(t)) return { body, end: k, closed: false }
    body.push(lines[k])
  }
  return { body, end: lines.length, closed: false }
}

/**
 * 历史多行照片块（`::: photo 说明` + 若干纯文本说明行 + `:::`）的兼容识别。
 *
 * 正式协议里 `::: photo 说明` 是**单行指令**，正文从下一行开始（引擎协议 §三.3）。但历史产物
 * 里确实存在多行块写法，所以要兼容——**兼容的条件必须收紧**：
 *
 * 候选范围内只允许纯文本行，且必须真的存在闭合标记。空行、标题、块起点、任何 `[[…]]` 行、
 * 引用/气泡、列表、表格、围栏、分割线都构成**正文边界** → 判定为"不是旧块"，
 * 该行按单行指令解析，其余行照常作为正文渲染。
 *
 * 歧义输入（例如"单行照片位 + 空行 + 段落 + 后面某个块的 `:::`"）一律按单行处理——
 * 宁可少吞，也不静默吞掉正文。返回闭合行号；返回 null 表示不是合法旧块。
 */
function scanLegacyPhotoBody(lines: string[], start: number): number | null {
  for (let k = start; k < lines.length; k++) {
    const t = lines[k].trim()
    if (t === ':::') return k
    if (t === '') return null
    if (isBlockStart(t)) return null
    if (/^#{1,6}\s/.test(t)) return null
    if (t.startsWith('[[')) return null
    if (t.startsWith('>')) return null
    if (t.startsWith('```')) return null
    if (t.startsWith('|')) return null
    if (/^\s*[-*+]\s+/.test(t) || /^\s*\d+\.\s+/.test(t)) return null
    if (/^(-{3,}|\*{3,}|_{3,}|~{3,})$/.test(t)) return null
  }
  return null
}

/** 成品可见文本里**不允许出现**的内部协议痕迹（2026-09-29 计划 §3.2"检查可见文本是否泄漏"） */
const LEAK_PATTERNS: { re: RegExp; what: string; hint: string }[] = [
  { re: /<svg\b/i, what: '转义的 SVG 源码', hint: '多半是照片位/素材块把后面的 SVG 吞进了自己的说明' },
  { re: /:::\s*art\b/, what: '内部素材容器标记 ::: art', hint: '`::: art` 是引擎内部格式，不该出现在正文里' },
  { re: /\[\[(?:asset|img|deco)\s*:/, what: '未解析的素材协议行', hint: '素材解析没有消费掉这条引用/占位' },
]

/** 行内代码 span（`inline()` 产出）：去掉后再查泄漏，合法代码示例不能被全局字符串规则误杀 */
const INLINE_CODE_SPAN = /<span style="background-color:[^"]*font-family:Consolas,Menlo,monospace[^"]*">[\s\S]*?<\/span>/g

function visibleTextOf(html: string): string {
  return html
    .replace(INLINE_CODE_SPAN, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 截断到 n 字符（证据摘要用）。刻意本地实现——compose 是零业务依赖的纯排版模块 */
function clip(s: string, n: number): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

export function composeMarkdown(md: string, opts?: ComposeOptions): ComposeResult {
  opts = opts || {}
  const modeKey = detectMode(md, opts.mode)
  // v9：不提供主题参数；排版语法模块使用 DESIGNS[modeKey] 基础色渲染骨架；
  // 第 17 轮：UI 风格选择或正文 [[theme:名称]] 声明 → 主题色板覆盖（含正文底色）
  const pal = resolveTheme(md, opts.theme)
  const custom = parsePaletteDirective(md)
  const themeName = themeDeclaration(md)
  const d = makeDesign(modeKey, pal, custom)
  // R17/R18：设计轴——正文 [[boxes:…]] 优先，其次主题映射，最后 editorial
  const faceSpec = resolveFaceSpec(md, pal && pal.key)
  d.scheme = faceSpec.spec
  const artUrls: Record<string, string> = {}
  const warnings: string[] = []
  // R18：轴名/取值不认识时**不生效并出声**——走既有修订回路让模型自己纠正，
  // 而不是静默按默认渲染（静默是"模型写了没效果、谁也不知道"的温床）。
  if (faceSpec.unknown.length) {
    warnings.push(
      '组件设计轴「' + faceSpec.unknown.join(' / ') + '」不认识，已忽略：可用轴 radius/frame/bar/fill/label/title/size/deco/pad，或预置名 编辑感/亲和/杂志/手账/科技',
    )
  }
  const images: ComposeImage[] = []
  const arts: ArtSpec[] = []
  const decoMap: Record<string, DecoSpec> = {}
  const lines = String(md || '').split(/\r?\n/)
  const out: string[] = []
  // 与 out 一一对应的元信息：该节点来自源文哪一行、是不是"代码节点"（泄漏检查要跳过代码）
  const outMeta: { line: number; code: boolean; system?: boolean }[] = []
  const issues: ComposeIssue[] = []
  const rejectedArts: RejectedArt[] = []
  let i = 0
  let h2Counter = 0

  /**
   * 产出一个节点；`line` = 该节点对应的源文起始行（1-based），供问题定位。
   *
   * `system` 标记"这段 HTML 是**系统自己写**的，不是作者写的"——目前只有两类：
   *   · 素材被本地质检拒收后的占位说明（"此处原为美术素材…未达标已略过"）；
   *   · 容器写法不合法时的报错句（"timeline 需至少 1 个节点"之类）。
   * 它们**必须**能从正文投影里排除（DS 指南 §4.2）：投影的用途是"作者到底改了什么事实"，
   * 而系统占位/报错会随解析状态自己出现或消失——把它们算进投影，就会出现
   * "用户一个字没改、投影却变了"（或反过来把系统文案当作者事实保护起来）。
   * 注意：排除的只是**投影**。这两类各自的 `issues` 照常进交付门禁，不会被藏起来。
   */
  function emit(html: string, line: number, opts2?: { code?: boolean; system?: boolean }): void {
    out.push(html)
    outMeta.push({ line, code: !!opts2?.code, system: !!opts2?.system })
  }

  /**
   * `::: art` 头部的别名/ID 候选（空格分隔）。素材解析层把「本文别名 / 气泡引用词 / 库名称 / 库 ID」
   * 一起写进头部，因此这里逐个取出，交给调用方与素材位台账比对——拒收的素材位据此回写。
   */
  function artRefs(head: string): string[] {
    return head.trim().split(/\s+/).filter(Boolean)
  }

  function noteRejected(refs: string[], line: number, reason: string, deco: boolean): void {
    rejectedArts.push({ refs, line, reason, deco })
    issues.push({
      code: 'asset.rejected',
      severity: 'blocking',
      message: `素材未通过本地质检（${reason}），该处已用占位文本代替：${refs[0] || '未知素材'}`,
      line,
      endLine: line,
      assetRefs: refs,
    })
  }

  // 预扫描：::: art deco 名称… 装饰素材定义（第 21 轮；P0 起支持多别名）——SVG 校验合格后注册供气泡角饰引用。
  // P0（2026-09-24 调查 §2）：素材解析器会同时写入"本文别名 / 气泡引用词 / 库名称 / 库 ID"，
  // 全部指向同一个 DecoSpec；**只占一个 arts 条目**（否则 @@ARTn@@ 索引与素材用量统计会错位）。
  {
    let j = 0
    while (j < lines.length) {
      const m = lines[j].match(/^:::\s*art\s+deco\s+([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*)(?:\s+\S.*)?$/)
      if (m) {
        const names = m[1].split(/\s+/).filter(Boolean)
        const label = names[0]
        const head = lines[j].replace(/^:::\s*art\s+deco\s*/, '')
        const startLine = j + 1
        const scan = collectBlockBody(lines, j + 1)
        j = scan.end
        const raw = scan.body
        const svgM = /<svg\b[^>]*viewBox="[^"]*"[\s\S]*<\/svg>/i.exec(raw.join('\n').trim())
        const verdict = svgM ? checkSvgQuality(svgM[0], 'deco') : null
        if (svgM && verdict && verdict.ok) {
          const idx = arts.length
          arts.push({ svg: svgM[0], alt: '气泡角饰:' + label, wide: false })
          const spec: DecoSpec = { svg: svgM[0], alt: label, idx, hAt60: heightAtWidth(svgM[0], DECO_W) }
          for (const nm of names) decoMap[nm] = spec
        } else {
          const why = verdict && verdict.failures.length ? verdict.failures[0] : '块内没有可用的 SVG'
          // 阶段 2：`::: art deco` 是**解析后的内部格式**，不该由主模型书写。走到这里说明
          // 素材解析层没能把它恢复成库素材——提示改写法，而不是引导模型继续写内部容器。
          warnings.push(
            '现场角饰定义 deco:' + label + ' 不可用（' + why + '），已忽略：角饰请用 [[asset:bubble|素材ID|用途]] 引用，或用 [[deco:名称|说明]] 占位',
          )
          // 计划 §6：库素材**读取成功不等于验收完成**——排版拒收必须回写台账，
          // 否则"库里读到了"会被当成交付成功，而正文里其实是个占位空框。
          noteRejected(artRefs(head), startLine, why, true)
        }
        continue
      }
      j++
    }
  }

  function collectList(): void {
    const ordered = /^\s*\d+\.\s+/.test(lines[i])
    const startLine = i + 1
    const items: string[] = []
    while (i < lines.length) {
      const line = lines[i]
      const m = ordered ? line.match(/^\s*\d+\.\s+(.*)$/) : line.match(/^\s*[-*+]\s+(.*)$/)
      if (!m) break
      items.push(inline(escapeHtml(m[1]), d))
      i++
    }
    emit(listBlock(d, ordered, items), startLine)
  }

  function collectTable(): boolean {
    const startLine = i + 1
    const rows: string[] = []
    while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
    if (rows.length < 2) { i -= rows.length; return false }
    if (!/^\|?[\s:|-]+\|?$/.test(rows[1].replace(/\s/g, ''))) { i -= rows.length; return false }
    emit(tableBlock(d, rows), startLine)
    warnings.push('检测到表格：微信后台对表格支持有限，建议截图转图片后使用')
    return true
  }

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()
    if (line === '') { i++; continue }

    // 围栏代码块
    if (line.startsWith('```')) {
      const fenceLine = i + 1
      i++
      const code: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++ }
      i++
      // code: true —— 代码块是**合法**展示内容，泄漏检查必须跳过它（否则正文里的代码示例会被误杀）
      emit(codeBlock(d, code), fenceLine, { code: true })
      continue
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      if (d.key === 'promo' && level === 2) h2Counter++
      emit(heading(d, level, h[2], d.key === 'promo' && level === 2 ? h2Counter : null), i + 1)
      i++
      continue
    }

    // 分割线变体
    const hr = line.match(/^(-{3,}|\*{3,}|_{3,}|~{3,})$/)
    if (hr) {
      emit(divider(d, hr[1].charAt(0) === '*' ? '***' : hr[1].charAt(0) === '_' ? '___' : hr[1].charAt(0) === '~' ? '~~~' : '---'), i + 1)
      i++
      continue
    }

    // 风格声明 [[theme:名称]] 与自定义色板 [[palette:...]]（第 23 轮：只影响配色，不产生输出）
    if (/^\[\[theme:[^\]]+\]\]$/.test(line)) { i++; continue }
    if (/^\[\[palette:[^\]]+\]\]$/.test(line)) { i++; continue }
    // R17：组件语言声明（同样只影响渲染，不产生输出）
    if (/^\[\[boxes:[^\]]+\]\]$/.test(line)) { i++; continue }

    // 横幅 [[banner:主|副]]
    const bn = line.match(/^\[\[banner:([^|\]]+)(?:\|([^\]]+))?\]\]$/)
    if (bn) { emit(banner(d, bn[1], bn[2] || ''), i + 1); i++; continue }

    // 装饰标题 [[title:文字]] / [[title:文字|box|vine]]
    const tt = line.match(/^\[\[title:([^\]|]+)(?:\|([a-z]+))?\]\]$/)
    if (tt) { emit(titleBlockStyled(d, tt[1], tt[2] || '', artUrls), i + 1); i++; continue }

    // 花边分隔线 [[lace]]
    if (/^\[\[lace\]\]$/.test(line)) { emit(laceDivider(d), i + 1); i++; continue }

    // 美术素材 ::: art [wide|inline] 说明 / ::: art deco 名称（第 21 轮：deco 为气泡角饰定义，预扫描已注册）
    const artC = line.match(/^:::\s*art(?:\s+(deco)\s+([a-zA-Z0-9_-]+))?(?:\s+(wide|inline))?\s*(.*)$/)
    if (artC) {
      const artLine = i + 1
      if (artC[1] === 'deco') {
        // 预扫描已消费并注册（合格）或已记入 rejectedArts（不合格）；主循环只需整体跳过。
        i = collectBlockBody(lines, i + 1).end
        continue
      }
      const wide = artC[3] === 'wide'
      const alt = artC[4].trim() || '美术素材'
      const artHead = line.replace(/^:::\s*art\s*(?:wide|inline)?\s*/, '')
      const scan = collectBlockBody(lines, i + 1)
      i = scan.end
      const svgRaw = scan.body.join('\n').trim()
      const svgM = /<svg\b[^>]*viewBox="[^"]*"[\s\S]*<\/svg>/i.exec(svgRaw)
      const verdict = svgM ? checkSvgQuality(svgM[0], wide ? 'wide' : 'inline') : null
      if (svgM && verdict && verdict.ok) {
        const idx = arts.length
        arts.push({ svg: svgM[0], alt, wide })
        const imgStyle = wide
          ? 'width:100%;height:auto;display:block;margin:12px 0;border-radius:8px'
          : 'max-width:56%;height:auto;display:inline-block;vertical-align:middle;border-radius:8px'
        const imgTag = '<img src="@@ART' + idx + '@@" alt="' + escapeHtml(alt) + '" style="' + imgStyle + '" />'
        emit(wide ? imgTag : '<section style="text-align:center;margin:12px 0">' + imgTag + '</section>', artLine)
      } else {
        const why = verdict && verdict.failures.length ? verdict.failures[0] : '需为带 viewBox 的 SVG'
        warnings.push('美术素材未达标（' + why + '），已用占位文本替换')
        // 计划 §6：`compose`/渲染器必须返回失败素材的 slotId，回写台账与候选问题清单——
        // 否则"库里读到了"会被当成交付成功，而正文里其实是个空框。
        noteRejected(artRefs(artHead), artLine, why, false)
        emit(P(d) + '（此处原为美术素材「' + escapeHtml(alt) + '」，未达标已略过）' + '</p>', artLine, { system: true })
      }
      continue
    }

    // 照片位（第 28 轮，口径 A）：用户提供真实照片时用可替换占位块，发布前在微信后台换真图。
    // 不计素材数、不触发插画相关警告（有 photo 位即视为"以照片配图"意图）。
    //
    // 2026-09-29 质量恢复计划 §3.1（真实故障根因）：`::: photo 说明` 是**单行指令**，正文从下一行开始。
    // 旧实现"一路扫到下一个 `:::`"造成的实际后果（文档 s1790565874610554000，3 处泄漏）：
    // 照片位后面跟着普通段落和一个 `::: art` 素材块，全文只在**素材块末尾**有一个 `:::`，
    // 于是照片位把段落、素材块头与整段 SVG 全吞进自己的"说明"，再 escapeHtml 成可见文字——
    // 正文里 0 个有效素材、3 处转义 SVG 与内部 `::: art` 文本。程序错误用程序修：
    // 这里改为**有边界**收集，且默认按单行解析；多行旧块只在无歧义时才兼容。
    const photoC = line.match(/^:::\s*photo(?:\s+(.*))?$/)
    if (photoC) {
      const head = (photoC[1] || '').trim()
      const startLine = i + 1
      const scan = collectBlockBody(lines, i + 1)
      const legacyEnd = scan.closed ? scanLegacyPhotoBody(lines, i + 1) : null
      if (legacyEnd !== null) {
        // 历史多行块：候选范围内**全是纯文本说明行**，且真的闭合。兼容读取，但记 info 级提示，
        // 让作者/模型知道这种写法正在被淘汰（正式协议是单行指令）。
        const notes = scan.body.map((l) => l.trim()).filter(Boolean)
        i = legacyEnd + 1
        const label = head || notes.shift() || '照片位'
        const note = notes.length ? notes.join(' / ') : '（发布前在微信后台替换为真实照片）'
        warnings.push('照片位使用了历史多行块写法（::: photo … :::）：仍可渲染，但正式写法是单行指令 `::: photo 说明`（下一行起即正文）')
        issues.push({
          code: 'parse.legacy-photo-block',
          severity: 'info',
          message: '照片位按历史多行块读取（正式写法是单行指令）',
          line: startLine,
          endLine: legacyEnd + 1,
        })
        emit(
          '<section style="margin:0 0 16px;border:2px dashed #cbd5e1;border-radius:12px;padding:12px 14px;background:#f8fafc;text-align:left">' +
            '<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1f2d3d;letter-spacing:0.5px">【照片位】' + escapeHtml(label) + '</p>' +
            '<p style="margin:0;font-size:12.5px;line-height:1.6;color:#8a94a6;letter-spacing:0.5px">' + escapeHtml(note) + '</p>' +
            '</section>',
          startLine,
        )
        continue
      }
      // 单行指令：说明只取行内头部；紧随其后的行一律**退回正文**，照片位不吞任何后续内容。
      i++
      if (!head) {
        // 头部没写说明：这不是错误，但要说清"未闭合也不会吞正文"的语义（旧实现正是在这里吃文末）。
        warnings.push('照片位 ::: photo 未写说明：请写成单行 `::: photo 说明`（说明写在同一行），下一行起即正文')
        issues.push({
          code: 'parse.photo-no-label',
          severity: 'warning',
          message: '照片位没有说明文字（单行指令应把说明写在同一行）',
          line: startLine,
          endLine: startLine,
        })
      }
      if (scan.closed) {
        // 存在一个孤立的 `:::`：旧的无界扫描会把它当成照片位的结束、并把中间内容当说明吞掉。
        // 现在中间内容由主循环按正文正常渲染，那个 `:::` 会在走到它时被"孤立标记"分支跳过并上报。
        // 这里只补一句协议说明——**不**把中间内容当说明，这是本次修复的关键。
        issues.push({
          code: 'parse.photo-trailing-close',
          severity: 'warning',
          message: '照片位是单行指令，后面不需要 `:::` 结尾；该标记将被跳过',
          line: scan.end,
          endLine: scan.end,
        })
      }
      emit(
        '<section style="margin:0 0 16px;border:2px dashed #cbd5e1;border-radius:12px;padding:12px 14px;background:#f8fafc;text-align:left">' +
          '<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1f2d3d;letter-spacing:0.5px">【照片位】' + escapeHtml(head || '照片位') + '</p>' +
          '<p style="margin:0;font-size:12.5px;line-height:1.6;color:#8a94a6;letter-spacing:0.5px">（发布前在微信后台替换为真实照片）</p>' +
          '</section>',
        startLine,
      )
      continue
    }

    // 容器 ::: card / ::: steps / ::: cols / ::: imgrow / ::: imgcard / ::: timeline / ::: band / ::: frame
    const cont = line.match(/^:::\s*(card|steps|cols|imgrow|imgcard|timeline|band|frame)\s*(.*)$/)
    if (cont) {
      const kind = cont[1]
      const title = cont[2].trim()
      const contLine = i + 1
      // 2026-09-29：改用**有边界**收集——遇到下一个块起点即停，不再"一路扫到下一个 `:::`"。
      // 旧实现会把后面某个块的结束符当成自己的结束符，把中间内容整段并进本容器（计划 §3.1）。
      const scan = collectBlockBody(lines, i + 1)
      const bodyLines: string[] = []
      const stepItems: string[] = []
      for (const rawLine of scan.body) {
        const l = rawLine.trim()
        if (kind === 'steps' && /^[-*+]\s+/.test(l)) stepItems.push(l.replace(/^[-*+]\s+/, ''))
        else if (l !== '') bodyLines.push(l)
      }
      i = scan.end
      if (!scan.closed) {
        // 未闭合：已收集到的内容照常渲染（容器语义不因缺一个 `:::` 而丢内容），
        // 但必须**说清楚**——其后正文可能被并入本容器。结构化问题带源文范围，供交付门禁定位。
        warnings.push('容器 ' + kind + ' 未闭合（缺少结尾的 :::）：已按收集到的内容渲染，其后正文可能被并入该容器，请补上结尾的 :::')
        issues.push({
          code: 'parse.unclosed-block',
          severity: 'blocking',
          message: `容器 ${kind} 未闭合（缺少结尾的 :::），其后内容可能被并入该容器`,
          line: contLine,
          endLine: scan.end,
        })
      }
      if (kind === 'steps') {
        emit(steps(d, stepItems.map((s) => escapeHtml(s))), contLine)
      } else if (kind === 'timeline') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (items.length >= 1) emit(timelineBlock(d, items), contLine)
        else emit(P(d) + 'timeline 需至少 1 个节点（- 内容）' + '</p>', contLine, { system: true })
      } else if (kind === 'band') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (items.length >= 1) emit(bandBlock(d, items, title), contLine)
        else emit(P(d) + 'band 需至少 1 行内容（- 文字）' + '</p>', contLine, { system: true })
      } else if (kind === 'frame') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (items.length >= 1) emit(frameBlock(d, items), contLine)
        else emit(P(d) + 'frame 需至少 1 行内容（- 文字）' + '</p>', contLine, { system: true })
      } else if (kind === 'cols') {
        const cols = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (cols.length >= 2) emit(colsBlock(d, cols), contLine)
        else emit(P(d) + bodyLines.map((l) => inline(escapeHtml(l.replace(/^[-*+]\s+/, '')), d)).join('<br/>') + '</p>', contLine)
      } else if (kind === 'imgrow') {
        const imgs = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => {
          const mm = l.replace(/^[-*+]\s+/, '').match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
          return mm ? { src: mm[2], alt: mm[1] } : null
        }).filter((x): x is { src: string; alt: string } => x !== null)
        if (imgs.length >= 2) emit(imgrowBlock(d, imgs), contLine)
        else emit(P(d) + 'imgrow 需至少 2 张图片（- ![说明](路径)）' + '</p>', contLine, { system: true })
      } else if (kind === 'imgcard') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => l.replace(/^[-*+]\s+/, ''))
        let img: { src: string; alt: string } | null = null
        const caps: string[] = []
        for (const it of items) {
          const mm = it.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
          if (mm && !img) { img = { src: mm[2], alt: mm[1] }; continue }
          caps.push(it)
        }
        if (img) emit(imgcardBlock(d, img, caps), contLine)
        else emit(P(d) + 'imgcard 需一张图片（第一项 - ![说明](路径)）' + '</p>', contLine, { system: true })
      } else {
        emit(card(d, title, bodyLines.map((s) => escapeHtml(s))), contLine)
      }
      continue
    }

    // 提示气泡框 > [!KIND|deco] 标题（v10：|grass 等图案角饰）
    // P0：角饰词放宽到大写字母与下划线，与 `::: art deco` 定义侧的口径一致——
    // 否则模型写 `> [!KEY|Blossom]` 时会静默丢掉角饰（既不加也不警告）。
    const alert = line.match(/^>\s*\[!(\w+)(?:\|([A-Za-z0-9_-]+))?\]\s*(.*)$/)
    if (alert) {
      const alertLine = i + 1
      const kind = alert[1].toLowerCase()
      const decoName = alert[2] || ''
      if (decoName && !(DECO_MAP[decoName] && artUrls[DECO_MAP[decoName]]) && !decoMap[decoName]) {
        warnings.push(
          '气泡角饰 ' +
            decoName +
            ' 未定义：请在气泡前用 [[asset:bubble|素材ID或名称|用途]] 引用库素材，或用 [[deco:名称|说明]] 占位让系统制作',
        )
      }
      const first = alert[3].trim()
      const body: string[] = []
      i++
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const l = lines[i].trim().replace(/^>\s?/, '')
        if (l !== '') body.push(l)
        i++
      }
      emit(bubble(d, kind, first, body.map((s) => escapeHtml(s)), decoName, artUrls, decoMap), alertLine)
      continue
    }

    // 普通引用
    if (line.startsWith('>')) {
      const quoteLine = i + 1
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const l = lines[i].trim().replace(/^>\s?/, '')
        if (l !== '') quote.push(l)
        i++
      }
      emit(quoteBlock(d, quote.map((s) => escapeHtml(s))), quoteLine)
      continue
    }

    // 整行图片：独立渲染，不包进段落卡片（v10.2：art:// 装饰图居中 56%，本地图全宽）
    const imgLine = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
    if (imgLine) {
      const alt = imgLine[1]
      const src = imgLine[2]
      if (/^art:\/\//.test(src)) {
        emit('<section style="text-align:center;margin:12px 0"><img src="' + src + '" alt="' + alt + '" style="max-width:56%;height:auto;display:inline-block;vertical-align:middle" /></section>', i + 1)
      } else {
        emit('<img src="' + src + '" alt="' + alt + '" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />', i + 1)
      }
      i++
      continue
    }

    // 孤立块标记 `:::`（2026-09-29 计划 §3.1）：没有对应块起点的结束标记。
    // 必须**显式**处理——不处理它会掉进下面"普通段落"分支：段落循环在 `l === ':::'` 处立刻 break，
    // 产出空段落却**不推进 i**，于是主循环原地打转（死循环）。这里是确定性修复，不是兜底装饰。
    if (line === ':::') {
      warnings.push('发现孤立的块结束标记 `:::`（前面没有对应的 `::: card/steps/…` 起点）：已跳过，请检查正文块是否成对')
      issues.push({
        code: 'parse.orphan-close',
        severity: 'warning',
        message: '孤立的块结束标记 `:::`（前面没有对应的块起点）',
        line: i + 1,
        endLine: i + 1,
      })
      i++
      continue
    }

    // 列表
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) { collectList(); continue }

    // 表格
    if (line.startsWith('|')) { if (collectTable()) continue }

    // 普通段落（合并连续行）
    const paraLine = i + 1
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i].trim()
      if (l === '' || /^(#{1,6})\s/.test(l) || /^(-{3,}|\*{3,}|_{3,}|~{3,})$/.test(l) || l.startsWith('```') ||
        l.startsWith('>') || /^\s*[-*+]\s+/.test(l) || /^\s*\d+\.\s+/.test(l) || l.startsWith('|') ||
        /^:::\s*(card|steps|cols|imgrow|imgcard|timeline|band|frame|art|photo)/.test(l) || l === ':::' || /^(\[\[banner:|\[\[title:|\[\[lace)/.test(l)) break
      para.push(inline(escapeHtml(l), d))
      i++
    }
    emit(paraBlock(d, para.join('<br/>')), paraLine)
  }

  // 美术资产占位 art:// 替换（桌面版无微信资产库 → 一律移除并警告）
  let html = out.join('')
  html = html.replace(/<img([^>]*)src="art:\/\/([a-z0-9-]+)"([^>]*)\/>/g, (_m, pre: string, name: string, post: string) => {
    const url = artUrls[name]
    if (url) {
      return '<img' + pre + 'src="' + url + '"' + post + '/>'
    }
    warnings.push('美术资产 art://' + name + ' 桌面版不提供，已从正文移除（如需配图请生成后手动添加图片位）')
    return ''
  })

  // 收集本地/外链图片（桌面版无上传通道：仅提示）
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g
  let m: RegExpExecArray | null
  while ((m = imgRe.exec(String(md || ''))) !== null) {
    const src = m[2]
    if (!/^(https?:|art:)/i.test(src)) images.push({ local: src, alt: m[1] })
  }
  for (const img of images) {
    warnings.push('本地图片 ' + img.local + '：桌面版无微信上传通道，请发布前手动替换为微信图片地址')
  }

  const wrapperBg = '' // v10：无顶部渐变；正文底色随主题（background:d.bg），纯白为默认
  const html2 = '<section style="' + wrapperBg + 'background:' + d.bg + ';padding:4px 16px;box-sizing:border-box;font-size:16px;line-height:1.75;color:' + d.text + ';font-family:' + FONT + ';letter-spacing:0.5px;word-break:break-word">' + html + '</section>'
  const plainText = html2
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()

  // ---- 内部源码泄漏检查（计划 §3.2；本次真实故障的**验收关键**） ----
  // 为什么逐节点做而不是对整篇做全局字符串匹配：全局规则会把**合法代码示例**误杀
  // （正文里贴一段 `<svg …>` 或 `::: art` 的代码是正当的）。所以：
  //   · 跳过 code:true 的节点（围栏代码块）；
  //   · 行内代码 span 在取可见文本时先剥掉。
  // 检查的是**可见文本**：剥标签 + 反转义之后再找 `<svg` / `::: art` / `[[asset:`，
  // 因为泄漏的形态正是"被 escapeHtml 转成可见文字的源码"。
  for (let k = 0; k < out.length; k++) {
    const meta = outMeta[k]
    if (!meta || meta.code) continue
    const text = visibleTextOf(out[k])
    for (const p of LEAK_PATTERNS) {
      const mm = p.re.exec(text)
      if (!mm) continue
      const at = meta.line
      const snippet = clip(text.slice(Math.max(0, mm.index - 40), mm.index + 80), 120)
      warnings.push(`正文出现内部源码泄漏（${p.what}）：${p.hint}`)
      issues.push({
        code: 'parse.leak',
        severity: 'blocking',
        message: `正文可见文字里泄漏了${p.what}——${p.hint}`,
        line: at,
        endLine: at,
        evidence: snippet,
      })
      break // 同一节点只报一次
    }
  }

  if (html2.length >= 20000) {
    // 计划 §4：这条长度规则**尚未在微信后台验证过计算口径**（源文 / 渲染 HTML / 内嵌图片数据
    // 与实际发布格式不是同一尺寸）。所以登记为明确的**长度风险**，不当作已验证的平台拒绝事实，
    // 也不擅自移除这层保护。severity 用 warning（不是 blocking），由交付门禁按目标格式规则决定是否阻断。
    warnings.push('正文超过 20000 字符限制（当前约 ' + html2.length + '），微信会拒绝保存')
    issues.push({
      code: 'limit.length-unverified',
      severity: 'warning',
      message: '渲染 HTML 超过 20000 字符（该口径未在真实发布格式上验证，先按长度风险登记）',
      line: 0,
      endLine: 0,
      evidence: `html ${html2.length} 字符`,
    })
  }
  // 未知风格名且无自定义色板 → 警告（第 23 轮：风格不限预置，缺色板回退默认双色系）
  if (themeName && !pal && !custom) {
    warnings.push('风格「' + themeName + '」未收录且正文未提供 [[palette]] 自定义色板，已回退默认双色系')
  }
  // 素材用量校验（第 16 轮：组件装饰全覆盖——数量下限提示，persona 负责产出）
  // 第 28 轮：照片位（::: photo）视为"真实照片配图"，不报"未包含美术素材"硬错。
  // 第 31 轮：照片位与装饰插画并存口径——纯照片位仍提示补组件装饰插画；有插画即不催数量。
  const photoUsed = /^:::\s*photo\b/m.test(String(md || ''))
  const src = String(md || '')
  const containers = (src.match(/^:::\s*(?:steps|cols|card|band|frame|timeline)\b/gm) || []).length
  const bubbles = (src.match(/^>\s*\[!/gm) || []).length
  const listOrQuote = (src.match(/^\s*[-*+]\s+/gm) || []).length + (src.match(/^>\s*(?!\[!)/gm) || []).length

  // P1（2026-09-24 调查 §5）：配额改为由**成品自身长度**分档（内容派生，不是前端意图判断）。
  // 短通知不再被强塞组件与素材——否则自动质检会把一条短通知反复推回"长篇模板"重写。
  // 注意：revise.fixableWarnings 是按 includes(key) 匹配 FIXABLE_KEYS 的，
  // 所以 short 档的提示文案**刻意不含**那些子串，从而不会触发整篇自动重写。
  // 分档阈值刻意偏低（350）：只有真正的短通知/快讯才免配额；一篇四五百字的成文仍按正常标准要求组件，
  // 否则"短文豁免"会顺带把"没有组件的普通成文"也放过。
  const scale: 'short' | 'mid' | 'long' = plainText.length < 350 ? 'short' : plainText.length < 1400 ? 'mid' : 'long'
  const artFloor = scale === 'mid' ? 3 : 4
  if (scale === 'short') {
    if (arts.length === 0 && !photoUsed) {
      warnings.push('短篇提示：未配插画素材（短通知可以不配；若要一点装饰，加 1 处 [[img:inline]] 即可）')
    }
    if (containers < 2 || bubbles < 1 || listOrQuote < 1) {
      warnings.push(
        '短篇提示：没有使用排版组件（容器 ' + containers + ' 个 / 气泡 ' + bubbles + ' 个 / 列表或引用 ' + listOrQuote + ' 处）；短通知保持现状即可，需要强调时加 1 个气泡或 1 处列表',
      )
    }
  } else {
    if (arts.length === 0 && !photoUsed) {
      warnings.push('正文未包含美术素材（::: art），请为 banner/小节/气泡/分隔等组件装饰位补充现场绘制素材')
      issues.push({
        code: 'quality.no-art',
        severity: 'warning',
        message: '正文未包含美术素材',
        line: 0,
        endLine: 0,
      })
    } else if (arts.length === 0 && photoUsed) {
      warnings.push('正文只有照片位、没有任何装饰插画（[[img]]/[[deco]]）：真实照片是信息画面，横幅/气泡/小节等组件装饰位仍应配生成插画，与照片位错开同屏')
      issues.push({
        code: 'quality.photo-only',
        severity: 'warning',
        message: '正文只有照片位、没有任何装饰插画',
        line: 0,
        endLine: 0,
      })
    } else if (arts.length < artFloor && !photoUsed) {
      warnings.push(
        '素材用量偏低（当前 ' + arts.length + ' 处，建议 ' + artFloor + '-8 处并覆盖各组件装饰位）',
      )
      issues.push({
        code: 'quality.low-art',
        severity: 'warning',
        message: `素材用量偏低（当前 ${arts.length} 处，建议 ${artFloor}-8 处）`,
        line: 0,
        endLine: 0,
      })
    }
    // 组件化校验（第 17 轮：结构规则——容器 ≥2 + 气泡 ≥1 + 列表/引用 ≥1）
    if (containers < 2 || bubbles < 1 || listOrQuote < 1) {
      warnings.push(
        '组件化不足（当前容器 ' + containers + ' 个 / 气泡 ' + bubbles + ' 个 / 列表或引用 ' + listOrQuote + ' 处；要求容器 ≥2 且气泡 ≥1 且列表或引用 ≥1）',
      )
      issues.push({
        code: 'quality.low-structure',
        severity: 'warning',
        message: `组件化不足（容器 ${containers} / 气泡 ${bubbles} / 列表或引用 ${listOrQuote}）`,
        line: 0,
        endLine: 0,
      })
    }
  }
  // 正文偏短提示（第 21 轮：默认应充实到 1500-2500 字）——有意短篇是正常态，只作 info 展示
  if (plainText.length < 600) {
    warnings.push('正文偏短（约 ' + plainText.length + ' 字），建议充实内容至 1500-2500 字（用户明确要求短篇除外）')
    issues.push({
      code: 'quality.short-body',
      severity: 'info',
      message: `正文偏短（约 ${plainText.length} 字）`,
      line: 0,
      endLine: 0,
    })
  }
  return {
    html: html2,
    plainText,
    images,
    arts,
    warnings,
    issues,
    rejectedArts,
    authorUnits: buildAuthorUnits(out, outMeta),
    mode: modeKey,
    modeLabel: d.label,
  }
}

// ---------- 作者节点投影（DS 修复指南 §4.2） ----------

/**
 * 一个**作者节点**的可比较单元：作者可见的文本 + 它在源文里的起始行。
 *
 * 为什么要从 `emit` 的元信息来、而不是对渲染后的 HTML 做正则：正则方式**猜不出边界**——
 * 它只能按"这些标签/这些字样大概不是作者写的"去筛。历史上正是这种猜法出过事：旧版
 * `bodyText` 用一条删代码 span 的正则，把作者可见的 `联系电话：`010-55556666`` 里的号码
 * 一起删掉，于是"删掉行内代码里的电话"整项不受保护（2026-09-30 复测的第三个反例）。
 * 之后那条正则被撤掉了，但**猜边界**这件事本身没解决，另外还缺三样东西，都是这一版补上的：
 *   · **来源范围**：出问题时能说清"在源文第几行"，而不是只有一段被我压平过的文本；
 *   · **三态**：分得开"解析成功但正文确实为空"与"根本建不出投影"；
 *   · **精确分类**：系统占位/报错句由 `emit` 打标排除，不再靠去匹配某个占位文案的形状。
 * 解析器本来就知道每个节点的边界与来源行，这个信息不该在渲染成 HTML 之后丢掉。
 */
export interface AuthorUnit {
  /** 作者可见文本（已解码实体、压缩空白；不含样式/坐标/SVG 实现） */
  text: string
  /** 源文起始行（1-based） */
  line: number
  /** 是不是代码节点（合法作者代码示例：**保留其可见文本**，只是泄漏检查要跳过它） */
  code: boolean
}

/** 投影结果的三态（§4.2）：成功 / 有效空内容 / 投影失败——三者不能互相顶替 */
export type ProjectionStatus = 'ok' | 'empty' | 'failed'

export interface BodyProjection {
  status: ProjectionStatus
  /** 供事实比较用的文本（units 的行文本按顺序拼接） */
  text: string
  units: AuthorUnit[]
  /** status !== 'ok' 时说明原因，直接进证据 */
  reason?: string
}

/**
 * 从作者节点建投影。
 *
 * 口径（逐条对应指南 §4.2）：
 *   · **保留**标题、段落、列表、引用、照片说明与**可见作者代码**（`<code>`/`<pre>` 的文本照收；
 *     "合法代码示例"与"泄漏的内部实现"在投影这一层不区分——泄漏由 `leakIssues` 另行判定并阻断，
 *     不能靠"把所有代码删掉"来消除泄漏）；
 *   · **排除** `<svg>` 整块（属性、坐标、路径数据）、系统拒收占位与容器报错句（`system` 标记）；
 *   · 只有**有效正文一个字都没有**时才是 `empty`（这不是失败：一篇没有数字/地名等受保护事实的
 *     短文是正常内容，不该因此被拦）；`failed` 留给"建不出投影"本身。
 */
export function buildAuthorUnits(
  out: string[],
  meta: { line: number; code: boolean; system?: boolean }[],
): AuthorUnit[] {
  const units: AuthorUnit[] = []
  for (let k = 0; k < out.length; k++) {
    const m = meta[k] || { line: 0, code: false }
    if (m.system) continue
    const text = authorTextOf(out[k])
    if (!text) continue
    units.push({ text, line: m.line, code: !!m.code })
  }
  return units
}

/**
 * 单个节点 HTML → 作者可见文本。
 *
 * 只做两件事：剔掉 `<svg>` 整块（含其属性与坐标），再把剩下的标签当**分隔**（不是当内容）并解码实体。
 * 所有作者文字——包括 `<code>` / `<pre>` / `<strong>` 里的——都原样留下。
 */
function authorTextOf(html: string): string {
  return String(html || '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 由作者节点建投影（`units` 为 null/空 → failed，带原因，便于调用方如实阻断而不是当成"通过"） */
export function projectionOf(units: AuthorUnit[] | null | undefined, reason?: string): BodyProjection {
  if (!units) {
    return { status: 'failed', text: '', units: [], reason: reason || '没有可用的作者节点（解析结果缺失）' }
  }
  const text = units.map((u) => u.text).join('\n').trim()
  if (!text) {
    // 解析成功、但作者确实没写任何可见正文——这是**有效空内容**，不是失败
    return { status: 'empty', text: '', units, reason: '解析成功，但正文没有任何作者可见文字' }
  }
  return { status: 'ok', text, units }
}
