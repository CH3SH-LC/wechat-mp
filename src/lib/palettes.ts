// palettes.ts —— 风格主题色板表（第 17 轮：让显式风格真正落地到渲染）
// 色板取自知识库 src/knowledge/视觉/风格/*（style-japanese 等条目的色板节）；
// 知识未给出的"深档/近似"色按同色系合理近似（转换器只消费语义键，见 compose.ts makeDesign）。

export interface StylePalette {
  key: string
  label: string // 中文名（模型在正文 [[theme:名称]] 里可用中文或 key）
  bg: string // 正文底色
  // 文字类（text 模式）语义键
  accent: string
  accentDark: string
  heading: string
  soft: string
  soft2: string
  border: string
  hl: string
  // 宣传类（promo 模式）语义键
  orange: string
  amber: string
  teal: string
  ink: string
}

export const PALETTES: StylePalette[] = [
  {
    key: 'japanese', label: '日系', bg: '#faf3e3',
    accent: '#c29b6b', accentDark: '#a67c52', heading: '#4a4038',
    soft: '#f4ede2', soft2: '#efe6d5', border: '#cbbfa9', hl: '#f2e3c2',
    orange: '#c29b6b', amber: '#d9a97a', teal: '#8fa37a', ink: '#4a4038',
  },
  {
    key: 'guochao', label: '国潮', bg: '#fff9ef',
    accent: '#c03a2b', accentDark: '#7a1f16', heading: '#2b2118',
    soft: '#fff3de', soft2: '#fbf0e0', border: '#e3d5b5', hl: '#fff3de',
    orange: '#c03a2b', amber: '#d4af37', teal: '#7a1f16', ink: '#2b2118',
  },
  {
    key: 'campus', label: '校园', bg: '#ffffff',
    accent: '#2f6fed', accentDark: '#1f4fc4', heading: '#2b3a55',
    soft: '#f2f8ff', soft2: '#fff6f2', border: '#d6e4f5', hl: '#fff3c4',
    orange: '#2f6fed', amber: '#ffbe3d', teal: '#ff5e7a', ink: '#2b3a55',
  },
  {
    key: 'tech', label: '科技', bg: '#ffffff',
    accent: '#2f6fed', accentDark: '#3b4fc0', heading: '#111827',
    soft: '#f5f8ff', soft2: '#f0f4ff', border: '#d5dfee', hl: '#e6f0ff',
    orange: '#4f6df5', amber: '#00b8d9', teal: '#3b4fc0', ink: '#111827',
  },
  {
    key: 'minimal', label: '极简', bg: '#ffffff',
    accent: '#111111', accentDark: '#1a1a1a', heading: '#111111',
    soft: '#f7f7f7', soft2: '#efefef', border: '#e5e5e5', hl: '#efefef',
    orange: '#111111', amber: '#4b4b4b', teal: '#8a8a8a', ink: '#111111',
  },
  {
    key: 'business', label: '商务', bg: '#ffffff',
    accent: '#1b3a6b', accentDark: '#0f2a5e', heading: '#16233b',
    soft: '#f5f7fa', soft2: '#f0f4f8', border: '#d9e0ea', hl: '#e8eef8',
    orange: '#1b3a6b', amber: '#4f6df5', teal: '#3e4c6b', ink: '#0f2a5e',
  },
  {
    key: 'handbook', label: '手账', bg: '#ffffff',
    accent: '#e88aa0', accentDark: '#c26a85', heading: '#7a5a6a',
    soft: '#fcf5f9', soft2: '#f3f0fb', border: '#e8dce6', hl: '#fff7e0',
    orange: '#e88aa0', amber: '#a99ad9', teal: '#9fb8ad', ink: '#7a5a6a',
  },
  {
    key: 'forest', label: '森系', bg: '#ffffff',
    accent: '#6b8e6e', accentDark: '#4e7a56', heading: '#2f4a38',
    soft: '#f3f8f0', soft2: '#f6faf7', border: '#dce8d8', hl: '#eaf3e6',
    orange: '#6b8e6e', amber: '#8fa8a0', teal: '#5e8b66', ink: '#2f4a38',
  },
]

const BY_KEY = new Map(PALETTES.map((p) => [p.key, p]))
const BY_LABEL = new Map(PALETTES.map((p) => [p.label, p]))

// 解析主题：UI 显式选择（opts.theme，key）优先；否则取正文首个 [[theme:名称|key]] 声明
export function resolveTheme(md: string, optsTheme?: string): StylePalette | undefined {
  if (optsTheme) {
    const p = BY_KEY.get(optsTheme)
    if (p) return p
  }
  const m = /\[\[theme:([^\]]+)\]\]/.exec(String(md || ''))
  if (m) {
    const name = m[1].trim()
    return BY_KEY.get(name) || BY_LABEL.get(name)
  }
  return undefined
}
