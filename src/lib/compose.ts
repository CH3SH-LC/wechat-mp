// compose.ts —— v2 排版语法 → 微信合法内联 HTML 确定性转换器（第 14 轮移植）
// 来源：wechat-mp preset「wechat-mp-bootstrap」SKILL.md Host 源码（已验证 pkg-8，勿随意改动）
// 移植为桌面纯 TS：去掉微信 API/上传/资产渲染依赖；DESIGNS text/promo 双色系、间距 v5、
// 平面化 v10 全量保留；art:// 资产桌面不提供 → 引用被移除并记入 warnings（与 DSH 未上传行为一致）。
// 协议：正文以 Markdown + v2 语法书写，composeMarkdown(md, { mode }) 输出 HTML。

export interface ComposeDesign {
  key: 'text' | 'promo'
  label: string
  [k: string]: string
}

const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

const DESIGNS: Record<'text' | 'promo', ComposeDesign> = {
  text: {
    key: 'text', label: '文字类',
    accent: '#2f6fed', accentDark: '#1f4fc4',
    heading: '#1f2d3d', text: '#3f3f3f', sub: '#8a94a6',
    bg: '#ffffff', soft: '#eef3fb', soft2: '#f7f9fc', border: '#e3e8ef',
    tip: '#0e9f6e', tipBg: '#ecfaf3', warn: '#b26a00', warnBg: '#fff7e6',
    danger: '#c0392b', dangerBg: '#fdeeee', gold: '#b08d3e',
    hl: '#fff3c4', codeBg: '#f6f8fa', codeText: '#24292e',
  },
  promo: {
    key: 'promo', label: '宣传类',
    // v10 平面化色板：低饱和陶土橙/雾青/墨，去高饱和撞色；全部纯色，无渐变无阴影
    deep: '#2f3640', purple: '#5f8d8a', pink: '#b08d8d',
    orange: '#c96f4a', amber: '#d9a35f', teal: '#5f8d8a',
    ink: '#2f3640', text: '#4a4a52', sub: '#94949e',
    bg: '#ffffff', soft: '#f7f3ee', border: '#e5ddd3',
    tip: '#3d8f74', tipBg: '#eef7f2', warn: '#a06a2c', warnBg: '#faf4e8',
    danger: '#b3453c', dangerBg: '#f9efed',
    hl: '#f2e3c2', codeBg: '#2f3640', codeText: '#f2ede6',
  },
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

// v10.1：宣传类普通段落也进"文字卡片"容器（消除裸文字），文字类保持裸段落（重内容轻装饰）
function paraBlock(d: ComposeDesign, innerHtml: string): string {
  if (d.key === 'promo') {
    return '<section style="margin:0 0 16px;background:' + d.soft + ';border:1px solid ' + d.border + ';border-radius:12px;padding:14px 16px;font-size:16px;line-height:1.75;color:' + d.text + ';word-break:break-word;letter-spacing:0.5px">' + innerHtml + '</section>'
  }
  return P(d) + innerHtml + '</p>'
}

function timelineBlock(d: ComposeDesign, items: string[]): string {
  return '<section style="margin:0 0 16px;padding-left:22px;border-left:2px solid ' + (d.key === 'promo' ? d.orange : d.accent) + '">' + items.map((it, idx) => {
    return '<section style="position:relative;margin:0 0 14px;background:' + (d.key === 'promo' ? d.soft : d.soft2) + ';border-radius:10px;padding:12px 14px">' +
      '<span style="position:absolute;left:-27px;top:15px;width:10px;height:10px;border-radius:50%;background:' + (d.key === 'promo' ? d.orange : d.accent) + '"></span>' +
      '<span style="display:inline-block;color:' + (d.key === 'promo' ? d.orange : d.accent) + ';font-size:13px;font-weight:700;margin-bottom:4px">' + (idx + 1) + '</span>' +
      '<p style="margin:0;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</p></section>'
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
  const n = items.length
  const pct = n >= 3 ? '33.3%' : '50%'
  return '<section style="margin:0 0 16px;display:flex;align-items:stretch">' + items.map((it, idx) => {
    const mr = idx === n - 1 ? '' : 'margin-right:12px;'
    if (d.key === 'promo') {
      return '<section style="flex:1;width:' + pct + ';' + mr + 'background:#ffffff;border:1px solid ' + d.border + ';border-radius:12px;overflow:hidden">' +
        '<section style="height:5px;background:' + d.orange + '"></section>' +
        '<section style="padding:12px 14px 10px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</section></section>'
    }
    return '<section style="flex:1;width:' + pct + ';' + mr + 'background:' + d.soft2 + ';border:1px solid ' + d.border + ';border-radius:10px;padding:12px 14px 10px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</section>'
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
const DECO_MAP: Record<string, string> = { grass: 'sprig-grass', blossom: 'blossom-branch', leaf: 'leaf-corner' }

function bubble(d: ComposeDesign, kind: string, title: string, body: string[], decoName: string, artUrls: Record<string, string>): string {
  const meta = ({
    note: { label: '提示', c: d.accent, bg: d.soft, bd: d.border },
    tip: { label: '技巧', c: d.tip, bg: d.tipBg, bd: d.tipBg },
    warn: { label: '注意', c: d.warn, bg: d.warnBg, bd: d.warnBg },
    danger: { label: '警示', c: d.danger, bg: d.dangerBg, bd: d.dangerBg },
    key: { label: '重点', c: d.accentDark, bg: d.soft, bd: d.soft },
  } as Record<string, { label: string; c: string; bg: string; bd: string }>)[kind] || { label: '提示', c: d.accent, bg: d.soft, bd: d.border }
  const ttl = title || meta.label
  const bodyHtml = body.length ? body.map((l) => inline(l, d)).join('<br/>') : null
  const vivid = d.key === 'promo' && (kind === 'key' || kind === 'tip' || kind === 'danger')
  const bodyP = bodyHtml ? '<p style="margin:0;font-size:15px;line-height:1.75;color:' + (vivid ? '#ffffff' : d.text) + '">' + bodyHtml + '</p>' : ''
  const artName = DECO_MAP[decoName] || decoName
  // v10.2：角饰 60px 显示，位置贴右下角
  const decoImg = artName && artUrls && artUrls[artName]
    ? '<img src="' + artUrls[artName] + '" alt="" style="position:absolute;right:12px;bottom:10px;width:60px;height:auto;pointer-events:none;opacity:.9;display:block" />' : ''
  if (vivid) {
    const bg = kind === 'danger' ? d.danger : kind === 'tip' ? d.tip : d.orange
    return '<section style="margin:0 0 16px;border-radius:14px;padding:16px 18px 14px;background:' + bg + ';position:relative;overflow:hidden">' +
      '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#ffffff">' + ttl + '</p>' +
      bodyP + decoImg + '</section>'
  }
  return '<section style="margin:0 0 16px;background:' + meta.bg + ';border-left:4px solid ' + meta.c + ';border-radius:6px;padding:14px 16px;position:relative">' +
    '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:' + meta.c + '">' + ttl + '</p>' +
    bodyP + decoImg + '</section>'
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

function quoteBlock(d: ComposeDesign, lines: string[]): string {
  const body = lines.map((l) => inline(l, d)).join('<br/>')
  if (d.key === 'promo') {
    return '<blockquote style="margin:0 0 16px;background:' + d.soft + ';border-radius:0 10px 10px 0;padding:12px 16px;border-left:5px solid ' + d.orange + ';color:' + d.sub + '">' +
      '<span style="color:' + d.orange + ';font-size:22px;font-family:Georgia,serif;line-height:1">“</span>' + body + '</blockquote>'
  }
  return '<blockquote style="margin:0 0 16px;border-left:4px solid ' + d.accent + ';background:' + d.soft2 + ';border-radius:0 6px 6px 0;padding:12px 16px;color:#5a6472">' + body + '</blockquote>'
}

function card(d: ComposeDesign, title: string, lines: string[]): string {
  const body = lines.map((l) => '<p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(l, d) + '</p>').join('')
  if (d.key === 'promo') {
    return '<section style="margin:0 0 16px;background:#ffffff;border:1px solid ' + d.border + ';border-radius:12px;overflow:hidden">' +
      '<section style="height:6px;background:' + d.orange + '"></section>' +
      '<section style="padding:14px 16px 12px"><p style="margin:0 0 8px;font-size:16px;font-weight:700;color:' + d.ink + '">' + inline(escapeHtml(title), d) + '</p>' + body + '</section></section>'
  }
  return '<section style="margin:0 0 16px;border:1px solid ' + d.border + ';border-radius:10px;overflow:hidden">' +
    '<section style="padding:8px 16px;background:' + d.soft2 + ';font-size:15px;font-weight:700;color:' + d.heading + ';border-bottom:1px solid ' + d.border + '">' + inline(escapeHtml(title), d) + '</section>' +
    '<section style="padding:14px 16px 12px">' + body + '</section></section>'
}

function steps(d: ComposeDesign, items: string[]): string {
  return items.map((it, idx) => {
    const bg = d.key === 'promo' ? d.orange : d.accent
    return '<section style="margin:0 0 16px;display:flex;align-items:flex-start">' +
      '<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:' + bg + ';color:#ffffff;font-size:14px;font-weight:700;text-align:center;line-height:24px;flex-shrink:0;margin-right:10px">' + (idx + 1) + '</span>' +
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
  return '<section style="margin:0 0 16px;border-radius:12px;padding:14px 16px;background:' + rgba(c, 0.06) + ';border:1px solid ' + rgba(c, 0.25) + ';font-size:15px;line-height:1.75;color:' + d.text + '">' +
    '<section style="margin:0 0 8px;line-height:0">' + deco + '</section>' + body + '</section>'
}

function frameBlock(d: ComposeDesign, items: string[]): string {
  const body = items.map((l) => '<p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(l, d) + '</p>').join('')
  if (d.key === 'promo') {
    return '<section style="margin:0 0 16px;padding:3px;border:2px solid ' + d.orange + ';border-radius:14px"><section style="background:#ffffff;border:1px solid ' + d.border + ';border-radius:10px;padding:13px 15px">' + body + '</section></section>'
  }
  return '<section style="margin:0 0 16px;border:1px solid ' + d.accent + ';border-radius:12px;padding:13px 15px;position:relative"><span style="position:absolute;top:-1px;left:-1px;width:26px;height:4px;background:' + d.accent + ';border-radius:12px 0 0 0"></span><span style="position:absolute;bottom:-1px;right:-1px;width:26px;height:4px;background:' + d.accent + ';border-radius:0 0 12px 0"></span>' + body + '</section>'
}

function listBlock(d: ComposeDesign, ordered: boolean, items: string[]): string {
  if (d.key === 'promo') {
    const rows = items.map((it) => {
      return '<section style="margin:0 0 10px;display:flex;align-items:flex-start">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.orange + ';margin:9px 10px 0 0;flex-shrink:0"></span>' +
        '<span style="font-size:16px;line-height:1.75;color:' + d.text + '">' + it + '</span></section>'
    }).join('')
    return '<section style="margin:0 0 16px;background:' + d.soft + ';border:1px solid ' + d.border + ';border-radius:12px;padding:12px 16px">' + rows + '</section>'
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

export interface ComposeResult {
  html: string
  plainText: string
  images: ComposeImage[]
  arts: ArtSpec[]
  warnings: string[]
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

export function composeMarkdown(md: string, opts?: ComposeOptions): ComposeResult {
  opts = opts || {}
  const modeKey = detectMode(md, opts.mode)
  // v9：不提供主题参数；排版语法模块使用 DESIGNS[modeKey] 基础色渲染骨架
  const d = DESIGNS[modeKey]
  const artUrls: Record<string, string> = {}
  const warnings: string[] = []
  const images: ComposeImage[] = []
  const arts: ArtSpec[] = []
  const lines = String(md || '').split(/\r?\n/)
  const out: string[] = []
  let i = 0
  let h2Counter = 0

  function collectList(): void {
    const ordered = /^\s*\d+\.\s+/.test(lines[i])
    const items: string[] = []
    while (i < lines.length) {
      const line = lines[i]
      const m = ordered ? line.match(/^\s*\d+\.\s+(.*)$/) : line.match(/^\s*[-*+]\s+(.*)$/)
      if (!m) break
      items.push(inline(escapeHtml(m[1]), d))
      i++
    }
    out.push(listBlock(d, ordered, items))
  }

  function collectTable(): boolean {
    const rows: string[] = []
    while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
    if (rows.length < 2) { i -= rows.length; return false }
    if (!/^\|?[\s:|-]+\|?$/.test(rows[1].replace(/\s/g, ''))) { i -= rows.length; return false }
    out.push(tableBlock(d, rows))
    warnings.push('检测到表格：微信后台对表格支持有限，建议截图转图片后使用')
    return true
  }

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()
    if (line === '') { i++; continue }

    // 围栏代码块
    if (line.startsWith('```')) {
      i++
      const code: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++ }
      i++
      out.push(codeBlock(d, code))
      continue
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      if (d.key === 'promo' && level === 2) h2Counter++
      out.push(heading(d, level, h[2], d.key === 'promo' && level === 2 ? h2Counter : null))
      i++
      continue
    }

    // 分割线变体
    const hr = line.match(/^(-{3,}|\*{3,}|_{3,}|~{3,})$/)
    if (hr) {
      out.push(divider(d, hr[1].charAt(0) === '*' ? '***' : hr[1].charAt(0) === '_' ? '___' : hr[1].charAt(0) === '~' ? '~~~' : '---'))
      i++
      continue
    }

    // 横幅 [[banner:主|副]]
    const bn = line.match(/^\[\[banner:([^|\]]+)(?:\|([^\]]+))?\]\]$/)
    if (bn) { out.push(banner(d, bn[1], bn[2] || '')); i++; continue }

    // 装饰标题 [[title:文字]] / [[title:文字|box|vine]]
    const tt = line.match(/^\[\[title:([^\]|]+)(?:\|([a-z]+))?\]\]$/)
    if (tt) { out.push(titleBlockStyled(d, tt[1], tt[2] || '', artUrls)); i++; continue }

    // 花边分隔线 [[lace]]
    if (/^\[\[lace\]\]$/.test(line)) { out.push(laceDivider(d)); i++; continue }

    // 美术素材 ::: art [wide|inline] 说明（第 15 轮：原样收集 SVG，图形元素 ≥6 才渲染）
    const artC = line.match(/^:::\s*art(?:\s+(wide|inline))?\s*(.*)$/)
    if (artC) {
      const wide = artC[1] === 'wide'
      const alt = artC[2].trim() || '美术素材'
      i++
      const rawLines: string[] = []
      while (i < lines.length && lines[i].trim() !== ':::') {
        rawLines.push(lines[i])
        i++
      }
      i++
      const svgRaw = rawLines.join('\n').trim()
      const svgM = /<svg\b[^>]*viewBox="[^"]*"[\s\S]*<\/svg>/i.exec(svgRaw)
      const n = svgM ? svgElementCount(svgM[0]) : 0
      if (svgM && n >= 6) {
        const idx = arts.length
        arts.push({ svg: svgM[0], alt, wide })
        const imgStyle = wide
          ? 'width:100%;height:auto;display:block;margin:12px 0;border-radius:8px'
          : 'max-width:56%;height:auto;display:inline-block;vertical-align:middle;border-radius:8px'
        const imgTag = '<img src="@@ART' + idx + '@@" alt="' + escapeHtml(alt) + '" style="' + imgStyle + '" />'
        out.push(wide ? imgTag : '<section style="text-align:center;margin:12px 0">' + imgTag + '</section>')
      } else {
        warnings.push('美术素材未达标（需为带 viewBox 的 SVG 且图形元素 ≥6 个），已用占位文本替换')
        out.push(P(d) + '（此处原为美术素材「' + escapeHtml(alt) + '」，未达标已略过）' + '</p>')
      }
      continue
    }

    // 容器 ::: card / ::: steps / ::: cols / ::: imgrow / ::: imgcard / ::: timeline / ::: band / ::: frame
    const cont = line.match(/^:::\s*(card|steps|cols|imgrow|imgcard|timeline|band|frame)\s*(.*)$/)
    if (cont) {
      const kind = cont[1]
      const title = cont[2].trim()
      i++
      const bodyLines: string[] = []
      const stepItems: string[] = []
      while (i < lines.length && lines[i].trim() !== ':::') {
        const l = lines[i].trim()
        if (kind === 'steps' && /^[-*+]\s+/.test(l)) stepItems.push(l.replace(/^[-*+]\s+/, ''))
        else if (l !== '') bodyLines.push(l)
        i++
      }
      i++ // 跳过 :::
      if (kind === 'steps') {
        out.push(steps(d, stepItems.map((s) => escapeHtml(s))))
      } else if (kind === 'timeline') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (items.length >= 1) out.push(timelineBlock(d, items))
        else out.push(P(d) + 'timeline 需至少 1 个节点（- 内容）' + '</p>')
      } else if (kind === 'band') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (items.length >= 1) out.push(bandBlock(d, items, title))
        else out.push(P(d) + 'band 需至少 1 行内容（- 文字）' + '</p>')
      } else if (kind === 'frame') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (items.length >= 1) out.push(frameBlock(d, items))
        else out.push(P(d) + 'frame 需至少 1 行内容（- 文字）' + '</p>')
      } else if (kind === 'cols') {
        const cols = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
        if (cols.length >= 2) out.push(colsBlock(d, cols))
        else out.push(P(d) + bodyLines.map((l) => inline(escapeHtml(l.replace(/^[-*+]\s+/, '')), d)).join('<br/>') + '</p>')
      } else if (kind === 'imgrow') {
        const imgs = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => {
          const mm = l.replace(/^[-*+]\s+/, '').match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
          return mm ? { src: mm[2], alt: mm[1] } : null
        }).filter((x): x is { src: string; alt: string } => x !== null)
        if (imgs.length >= 2) out.push(imgrowBlock(d, imgs))
        else out.push(P(d) + 'imgrow 需至少 2 张图片（- ![说明](路径)）' + '</p>')
      } else if (kind === 'imgcard') {
        const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => l.replace(/^[-*+]\s+/, ''))
        let img: { src: string; alt: string } | null = null
        const caps: string[] = []
        for (const it of items) {
          const mm = it.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
          if (mm && !img) { img = { src: mm[2], alt: mm[1] }; continue }
          caps.push(it)
        }
        if (img) out.push(imgcardBlock(d, img, caps))
        else out.push(P(d) + 'imgcard 需一张图片（第一项 - ![说明](路径)）' + '</p>')
      } else {
        out.push(card(d, title, bodyLines.map((s) => escapeHtml(s))))
      }
      continue
    }

    // 提示气泡框 > [!KIND|deco] 标题（v10：|grass 等图案角饰）
    const alert = line.match(/^>\s*\[!(\w+)(?:\|([a-z0-9-]+))?\]\s*(.*)$/)
    if (alert) {
      const kind = alert[1].toLowerCase()
      const decoName = alert[2] || ''
      const first = alert[3].trim()
      const body: string[] = []
      i++
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const l = lines[i].trim().replace(/^>\s?/, '')
        if (l !== '') body.push(l)
        i++
      }
      out.push(bubble(d, kind, first, body.map((s) => escapeHtml(s)), decoName, artUrls))
      continue
    }

    // 普通引用
    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const l = lines[i].trim().replace(/^>\s?/, '')
        if (l !== '') quote.push(l)
        i++
      }
      out.push(quoteBlock(d, quote.map((s) => escapeHtml(s))))
      continue
    }

    // 整行图片：独立渲染，不包进段落卡片（v10.2：art:// 装饰图居中 56%，本地图全宽）
    const imgLine = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
    if (imgLine) {
      const alt = imgLine[1]
      const src = imgLine[2]
      if (/^art:\/\//.test(src)) {
        out.push('<section style="text-align:center;margin:12px 0"><img src="' + src + '" alt="' + alt + '" style="max-width:56%;height:auto;display:inline-block;vertical-align:middle" /></section>')
      } else {
        out.push('<img src="' + src + '" alt="' + alt + '" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />')
      }
      i++
      continue
    }

    // 列表
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) { collectList(); continue }

    // 表格
    if (line.startsWith('|')) { if (collectTable()) continue }

    // 普通段落（合并连续行）
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i].trim()
      if (l === '' || /^(#{1,6})\s/.test(l) || /^(-{3,}|\*{3,}|_{3,}|~{3,})$/.test(l) || l.startsWith('```') ||
        l.startsWith('>') || /^\s*[-*+]\s+/.test(l) || /^\s*\d+\.\s+/.test(l) || l.startsWith('|') ||
        /^:::\s*(card|steps|cols|imgrow|imgcard|timeline|band|frame|art)/.test(l) || l === ':::' || /^(\[\[banner:|\[\[title:)/.test(l)) break
      para.push(inline(escapeHtml(l), d))
      i++
    }
    out.push(paraBlock(d, para.join('<br/>')))
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

  const wrapperBg = '' // v10：无顶部渐变，正文保持纯白底
  const html2 = '<section style="' + wrapperBg + 'padding:4px 16px;box-sizing:border-box;font-size:16px;line-height:1.75;color:' + d.text + ';font-family:' + FONT + ';letter-spacing:0.5px;word-break:break-word">' + html + '</section>'
  const plainText = html2
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
  if (html2.length >= 20000) warnings.push('正文超过 20000 字符限制（当前约 ' + html2.length + '），微信会拒绝保存')
  return { html: html2, plainText, images, arts, warnings, mode: modeKey, modeLabel: d.label }
}
