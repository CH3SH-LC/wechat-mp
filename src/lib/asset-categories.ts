// asset-categories.ts —— 素材分类表（纯数据，零 import）
//
// 单独成文件的原因：分类表要同时被三处用到——
//   · asset-library.ts（工坊界面与库操作，会 import Tauri）
//   · asset-resolve.ts（纯解析层，node 断言脚本直接加载）
//   · prep.ts / image-agent.ts（模型上下文与解析）
// 放在 asset-library.ts 里会让纯解析层被迫拖进 Tauri 依赖，这里抽出来做成零依赖数据表。
//
// 修复计划阶段 2（2026-09-28）的根因之一：检索结果只给了**中文显示名**，模型于是照抄中文，
// 而解析器只认 `[a-z-]+` 的英文键——引用直接落空。现在两侧共用同一张表：
// 中文名、英文键都能被解析，且展示（中文名）与机器标识（英文键）各司其职。

export interface AssetCategory {
  /** 英文键：机器标识，写进 [[asset:<key>|…]]，也是库记录里的 category */
  key: string
  /** 中文显示名：给用户和模型看的名字 */
  label: string
  /** 该分类在引擎里的安放位（usage）——决定它能不能放进某个素材位 */
  defaultUsage: 'deco' | 'wide' | 'inline'
  hint: string
}

// 首版八类（决策 D4：bg/icon 后置）
export const ASSET_CATEGORIES: AssetCategory[] = [
  { key: 'bubble', label: '气泡（角饰）', defaultUsage: 'deco', hint: '气泡右下角的角饰/陪衬（如右下角一朵小花的气泡角饰）' },
  { key: 'divider', label: '分割线', defaultUsage: 'wide', hint: '横向窄条换场花饰/分割线素材' },
  { key: 'deco', label: '通用角饰', defaultUsage: 'deco', hint: '组件通用角落装饰，小巧精致' },
  { key: 'banner', label: '开篇横幅', defaultUsage: 'wide', hint: '文章开篇主视觉插画（宽幅）' },
  { key: 'heading', label: '小节装饰', defaultUsage: 'inline', hint: '小标题旁的横向装饰小图' },
  { key: 'art-inline', label: '正文内嵌插画', defaultUsage: 'inline', hint: '文中信息性小插画' },
  { key: 'art-wide', label: '宽幅插图', defaultUsage: 'wide', hint: '通栏插图/场景图' },
  { key: 'photo-frame', label: '照片位装饰框', defaultUsage: 'wide', hint: '与照片位并存的装饰画框' },
]

// 中文简称别名：模型和用户都写过这些叫法，统一收敛到英文键。
// 只收**无歧义**的简称——「装饰」既可能指角饰也可能指装饰框，故不收录。
const CATEGORY_ALIASES: Record<string, string> = {
  气泡: 'bubble',
  // F6（2026-09-28 只读审计）：persona / 协议 / compose 警告 / 工坊提示 / 知识语料**全项目**
  // 都用「气泡角饰」这个词，而别名表里只有「气泡」「角饰」——最常用的写法恰好不被识别，
  // 于是 `[[asset:气泡角饰|…]]` 判未知分类 → residual → 白跑一轮自动修订。
  气泡角饰: 'bubble',
  角饰: 'deco',
  通用角饰: 'deco',
  分割线: 'divider',
  开篇横幅: 'banner',
  横幅: 'banner',
  小节装饰: 'heading',
  正文内嵌插画: 'art-inline',
  内嵌插画: 'art-inline',
  插图: 'art-inline',
  宽幅插图: 'art-wide',
  照片位装饰框: 'photo-frame',
  照片框: 'photo-frame',
}

const byKey = new Map(ASSET_CATEGORIES.map((c) => [c.key, c]))
const byLabel = new Map(ASSET_CATEGORIES.map((c) => [c.label, c]))

/** 分类的中文显示名（未知键原样返回，便于把库里的历史值显示出来） */
export function categoryLabel(key: string): string {
  return byKey.get(key)?.label ?? key
}

/**
 * 把任意写法收敛成英文分类键：英文键、中文显示名（含全角括号形式）、中文简称都认。
 * 认不出来返回 undefined——调用方据此给出**明确错误**，而不是猜一个分类塞进去。
 */
export function categoryKey(raw: string): string | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  if (byKey.has(s)) return s
  const lower = s.toLowerCase()
  if (byKey.has(lower)) return lower
  if (byLabel.has(s)) return byLabel.get(s)!.key
  if (CATEGORY_ALIASES[s]) return CATEGORY_ALIASES[s]
  // 带括号的显示名（如「气泡（角饰）」）去掉括号内容再试一次
  const bare = s.replace(/[（(].*?[)）]/g, '').trim()
  if (byLabel.has(bare)) return byLabel.get(bare)!.key
  if (CATEGORY_ALIASES[bare]) return CATEGORY_ALIASES[bare]
  return undefined
}

/** 分类默认安放位（未知分类返回 undefined） */
export function usageForCategory(key: string): 'deco' | 'wide' | 'inline' | undefined {
  return byKey.get(key)?.defaultUsage
}

/**
 * 给模型看的分类写法提示（错误信息里用）。
 * F6（2026-09-28 只读审计）：显示名本身可能带括号（`bubble` 的显示名是「气泡（角饰）」），
 * 直接套一层括号会输出「bubble（气泡（角饰））」这种括号套括号——菜单里改用去括号的短名。
 * `categoryLabel('bubble')` 的显示名不受影响，仍是「气泡（角饰）」。
 */
export function categoryMenu(): string {
  return ASSET_CATEGORIES.map((c) => `${c.key}（${c.label.replace(/[（(].*?[)）]/g, '').trim()}）`).join(' / ')
}
