// marks.ts —— 气泡**角标图案词汇表**（R22）
//
// 用户判词（2026-10-10）："没有角标（框线略去一部分换为一个小图标会不会更好？严禁 emojy，
// 小图标即为角标用 svg 画）""完全可以更复杂的小图标，比如一个秋季活动就可以画一个枫叶"。
//
// 为什么由**引擎**内置而不是让模型现场画 SVG：① 模型手写 SVG 在本项目有**已知缺陷**（待办 T5：
// 可见元素落在画布外，质检会拦下）；② 与 R18 立住的主线一致——**模型给意图（点名要"枫叶"）、
// 引擎确定性渲染**。需要词汇表里没有的图形时，走**已有的** `::: art deco` 通道，不开新口子。
//
// 零 emoji：这里是**可绘制图形**（path/circle/rect），不是 emoji 或图标字符；
// 单色（由调用方给色）、24×24 viewBox、输出 data-URI（与 artRender 同一条路，微信安全）。

export const MARK_KEYS = [
  'circle', 'dot', 'diamond', 'diamondSolid', 'square',
  'maple', 'sprout', 'star', 'drop', 'book', 'gear', 'seal', 'heart', 'bolt', 'clock',
] as const
export type MarkKey = (typeof MARK_KEYS)[number]

/** 规范键 → 中文名（也是 `[[boxes:mark=…]]` 最该用的写法） */
export const MARK_LABEL: Record<string, string> = {
  circle: '圆', dot: '实圆', diamond: '菱形', diamondSolid: '实菱形', square: '方框',
  maple: '枫叶', sprout: '叶芽', star: '星', drop: '水滴', book: '书页',
  gear: '齿轮', seal: '印章', heart: '心', bolt: '闪电', clock: '钟',
}

/** 同义写法 → 规范键（模型写中文、写英文、写口语都认；认不出才记 unknown） */
export const MARK_ALIAS: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const k of MARK_KEYS) { m[k] = k; m[k.toLowerCase()] = k; m[MARK_LABEL[k]] = k }
  Object.assign(m, {
    空心圆: 'circle', 圆圈: 'circle', 实心圆: 'dot', 圆点: 'dot',
    方块: 'square', 方: 'square', 中空菱形: 'diamond',
    枫: 'maple', 秋天: 'maple', 秋叶: 'maple', 落叶: 'maple',
    芽: 'sprout', 嫩芽: 'sprout', 小草: 'sprout', 叶片: 'sprout',
    星形: 'star', 星星: 'star', 水滴形: 'drop', 露珠: 'drop',
    书: 'book', 书本: 'book', 翻书: 'book', 册: 'book',
    齿: 'gear', 轮: 'gear',
    印: 'seal', 印章方框: 'seal', 戳: 'seal', 爱心: 'heart', 喜欢: 'heart', 推荐: 'heart',
    雷: 'bolt', 闪电形: 'bolt', 时间: 'clock', 钟表: 'clock', 表: 'clock',
  })
  return m
})()

/** 语义 → **默认角标**：沿用知识库既有的"形状即情绪"契约（NOTE 空心圆／TIP 实心圆／WARN 空心菱形／DANGER 方框／KEY 实心菱形） */
export const SEMANTIC_MARK: Record<string, string> = {
  note: 'circle', tip: 'dot', warn: 'diamond', danger: 'square', key: 'diamondSolid',
}

/**
 * 主题（风格）→ 角标词汇（知识库 `module-bubble` §三.1："每个风格条目应提供该风格的图案词汇表，
 * 填入模板的'风格可变内容'零件位"——这里就是那个零件位）。
 *
 * **只覆盖 note/tip 两个"日常"语义**：`warn`/`danger` 是警报、`key` 是结论，它们的形状本身就是信息
 * （方框=阻断、实菱形=压轴），换掉会让读者失去两个最该一眼认出的记号。日常语义换上风格图案，
 * 既让"森系文章长叶子、校园文章长星星"，又不牺牲警报与结论的可辨识度。
 *
 * 优先级：`[[boxes:mark=名]]` 显式 > 本表 > `SEMANTIC_MARK`。
 */
export const THEME_MARKS: Record<string, { note?: string; tip?: string }> = {
  campus: { note: 'star', tip: 'bolt' },
  forest: { note: 'sprout', tip: 'drop' },
  tech: { note: 'gear', tip: 'bolt' },
  magazine: { note: 'book', tip: 'star' },
  japanese: { note: 'book', tip: 'star' },
  guochao: { note: 'book', tip: 'star' },
  newspaper: { note: 'book', tip: 'star' },
  handbook: { note: 'heart', tip: 'star' },
  illustration: { note: 'heart', tip: 'star' },
  anime: { note: 'star', tip: 'heart' },
  'hk-retro': { note: 'seal', tip: 'star' },
  cyberpunk: { note: 'bolt', tip: 'gear' },
}

/** 主题词汇 → 某个语义的角标；主题没配或该语义不在覆盖范围时返回 null（调用方回退语义默认） */
export function themeMark(themeKey: string | undefined, kind: string): string | null {
  const v = THEME_MARKS[String(themeKey || '')] || null
  const m = v ? (v as Record<string, string | undefined>)[kind] : undefined
  return m ? (MARK_ALIAS[m] || m) : null
}

/** 认得出的规范键；认不出返回 null（调用方据此记 warning，不静默落空） */
export function resolveMark(v: string): string | null {
  const s = String(v || '').trim()
  if (!s) return null
  return MARK_ALIAS[s] || MARK_ALIAS[s.toLowerCase()] || null
}

const S = (key: string): string => {
  const k = `__C__`
  // 注：角标实际只渲染 15px（24 单位视框 ≈ 0.63 缩放），所以**形状必须在 15px 下也认得出**：
  // 描边够粗、缺口够大、两枚图形不能几乎重叠。2026-10-10 经读图子智能体**三轮**实测，
  // 淘汰/重做如下——齿轮（虚线外圈碎成噪点 → 四枚大齿）、枫叶（三裂画法三次失败 → 改叶形轮廓+中脉）、
  // 书页（两页并成砖 → 两页在书脊相接、顶开 V）、闪电（细成发丝 → 加粗描边）、
  // 印章（细方环与"方框"同形 → 圆环+中心方印面）、钟（与印章同为"环+内容物" IoU 0.80 → 细环+针+顶铃）、
  // 叶芽（与枫叶同族 → 改对称双叶）、星/方框/水滴（描边加粗 / 越界内收）。
  // **圆球/云已删、花换成"心"**——15px 下分别与"圆""实圆"同构、或无论怎样都读不出本意。
  // 规则：**认不出的图形不入表，不为凑数保留**（这一条用 ASCII 逐像素打图判，不靠肉眼猜）。
  // 词汇表 15 枚：几何记号 5（圆/实圆/菱形/实菱形/方框）+ 具象 10。
  switch (key) {
    case 'circle': return `<circle cx="12" cy="12" r="7.6" fill="none" stroke="${k}" stroke-width="3.4"/>`
    case 'dot': return `<circle cx="12" cy="12" r="7.6" fill="${k}"/>`
    case 'diamond': return `<path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" fill="none" stroke="${k}" stroke-width="3.4" stroke-linejoin="round"/>`
    case 'diamondSolid': return `<path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" fill="${k}"/>`
    case 'square': return `<rect x="4.2" y="4.2" width="15.6" height="15.6" fill="none" stroke="${k}" stroke-width="3.8"/>`
    // 枫叶：**三裂 + 叶柄**，裂口必须**深到接近中心**（两个缺口各下切到 y≈10，深 9 单位 ≈ 5.6px）。
    // 反复实测的教训：缺口浅 ⇒ 15px 下裂口只剩抗锯齿像素，整枚糊成"团块 + 上下细柄"（用户点名要的图形，
    // 不能像"花"那样删，只能把缺口做深）。
    case 'maple':
      // **叶形轮廓 + 中脉**（尖顶椭圆描边 + 一条竖脉）。试过三种"三裂尖角"的画法全部失败：
      // 缺口浅 ⇒ 糊成团块；缺口深 ⇒ 裂片被削成 1px 细丝（缺口越深裂片越薄，两者互相打架），
      // 15px 下实测两侧裂片各只剩 1 个实心像素。判定：**三裂枫叶这个形状在 15px 下表达不出来**，
      // 改用同一语义的"叶片"——尖顶椭圆 + 中脉在 15px 下轮廓与内容都立得住，且与表内任何一枚都不撞。
      return `<path d="M12 1.6C17.2 5.6 20.2 10 20.2 14.2c0 4-3.7 7.2-8.2 7.2s-8.2-3.2-8.2-7.2C3.8 10 6.8 5.6 12 1.6Z" fill="none" stroke="${k}" stroke-width="3.2"/>` +
        `<rect x="11.2" y="2.2" width="1.6" height="15.8" fill="${k}"/>`
    // 叶芽：一根茎 + **左右对称**的两片叶（与不对称的三裂枫叶拉开形；两者在 15px 下都要能分开）
    case 'sprout':
      return `<path d="M12 22V11" stroke="${k}" stroke-width="2.6" fill="none"/>` +
        `<path d="M11.3 12.6C6.2 12.6 3.8 8.8 3.8 4 8.6 4 11.3 7.6 11.3 12.6Z" fill="${k}"/>` +
        `<path d="M12.7 12.6C17.8 12.6 20.2 8.8 20.2 4 15.4 4 12.7 7.6 12.7 12.6Z" fill="${k}"/>`
    case 'star':
      return `<path d="M12 2.2 14.9 9 22.2 9.8 16.8 14.6 18.4 21.8 12 18 5.6 21.8 7.2 14.6 1.8 9.8 9.1 9Z" fill="${k}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>`
    case 'drop':
      return `<path d="M12 2.6C12 2.6 4.9 11.8 4.9 15.8A7.1 7.1 0 0 0 19.1 15.8C19.1 11.8 12 2.6 12 2.6Z" fill="${k}" stroke="${k}" stroke-width="1.5" stroke-linejoin="round"/>`
    // 书页：两页在**书脊处相接**、顶部形成 V 形开口 ⇒ **单一连通轮廓 + 中心缺口**，
    // 才读得出"摊开"。分成两块（两页/书面+槽）在 15px 下都会被读成"两根竖条 / 暂停键"。
    case 'book':
      return `<path d="M2.4 4.8 12 12.6V19.8L2.4 20.6Z" fill="${k}" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M21.6 4.8 12 12.6V19.8L21.6 20.6Z" fill="${k}" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>`
    // 齿轮：厚圆环 + **四枚大齿**（首版六枚小齿只伸出 1.5px，15px 下四枚斜齿亚像素丢掉）
    case 'gear': {
      const teeth = [0, 90, 180, 270].map((a) =>
        `<rect x="10.3" y="0.4" width="3.4" height="4.8" rx="0.8" fill="${k}" transform="rotate(${a} 12 12)"/>`).join('')
      return `<circle cx="12" cy="12" r="6" fill="none" stroke="${k}" stroke-width="4.2"/>` + teeth
    }
    // 印章：**圆环 + 中心方印面**——ASCII 实测：细方环与"方框"同形；"印钮+印面"的剪影读成"小台座"；
    // 只有"圆 + 内部方"同时区别于"圆（纯环）""方框（方环）""齿轮（环+外齿）"，读得出是"印"。
    case 'seal':
      return `<circle cx="12" cy="12" r="8.6" fill="none" stroke="${k}" stroke-width="3.8"/>` +
        `<rect x="8.2" y="8.2" width="7.6" height="7.6" fill="${k}"/>`
    // 心：**取代原"花"**。ASCII 实测（15px 逐像素打图）：花无论怎么画——四瓣分离会碎成 4 段孤立碎片，
    // 花瓣相接又并成一个十字/团块，五瓣剪影则是一个圆疙瘩；且"团+柄"的形还会与枫叶/叶芽撞脸。
    // "心"在同一个尺寸下轮廓完整、且没有同类可混。
    case 'heart':
      return `<path d="M12 21C12 21 2.6 14.2 2.6 9A4.8 4.8 0 0 1 7.2 4.2c1.9 0 3.7 1.1 4.8 2.9 1.1-1.8 2.9-2.9 4.8-2.9A4.8 4.8 0 0 1 21.4 9c0 5.2-9.4 12-9.4 12Z" fill="${k}"/>`
    // 闪电：加粗描边，否则 15px 下细成一道发丝
    case 'bolt':
      return `<path d="M13.6 1.6 4.2 13.4h6.6l-2 9L19.8 9.6h-6.6Z" fill="${k}" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>`
    // 钟：**细环 + 细针 + 顶部铃**——与"印章（厚环 + 实心方）"必须拉开：两者都是"环 + 内部内容物"，
    // 15px 下实测 IoU 曾到 0.80（> 阈值 0.78）。加了顶部铃、环与针都收细后降到 0.48。
    case 'clock':
      return `<circle cx="12" cy="12" r="8.4" fill="none" stroke="${k}" stroke-width="2.3"/>` +
        `<path d="M12 6.4v5.6l3.4 2.2" fill="none" stroke="${k}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<rect x="8.6" y="1.4" width="6.8" height="2.6" rx="1.3" fill="${k}"/>`
    default: return `<circle cx="12" cy="12" r="7.6" fill="${k}"/>`
  }
}

/** 一枚角标图案的 SVG 源码（单色）。认不出的键退回实心圆，**不抛错**。 */
export function markSvg(key: string, color: string): string {
  const canon = MARK_ALIAS[key] || MARK_ALIAS[String(key || '').toLowerCase()] || 'dot'
  const body = S(canon).replace(/__C__/g, color)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`
}

/** 角标图案 → data-URI（微信安全：不外链、可被后台转存；与 artRender 同一路） */
export function markDataUrl(key: string, color: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markSvg(key, color))
}
