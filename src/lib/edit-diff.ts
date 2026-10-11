// edit-diff.ts —— **改稿回合的"改动范围"度量**（R25）
//
// 为什么需要它：用户判词"要求用户在使用过程中修改某些地方也完全可以，而不是只有第一遍直出才有高质量"。
// 要证明"改一处就只动那一处"，就得**能测**——否则只能靠"看着差不多"。这里给出一个确定性、
// 可断言的度量：把两版正文比出"文本改动比例 / 素材引用增减 / 骨架声明变化 / 组件清单变化"。
//
// 用途：
//   ① 真实验收（`scripts/live-edit-acceptance.mjs`）：改一处后断言"其余没被大改"；
//   ② 回合 trace：每轮改稿都记一条，事后可查"这次改动的爆炸半径"。
// **不用它做路由或门禁**——它只描述"改了多少"，不判断"该不该改"（那是模型的判断，见铁律 6）。

export interface StructureDiff {
  /** 0 = 完全相同；1 = 完全换掉。按"非空行的集合差异"折算，不追求字级精度 */
  textChangedRatio: number
  sameText: boolean
  /** 素材稳定引用（`[[asset:分类|ID|用途]]` 的 `分类|ID`）的增删 */
  assets: { added: string[]; removed: string[] }
  /** 出现过的容器种类（`::: card` / `> [!TIP]` …），用于看"组件结构有没有被动过" */
  components: { added: string[]; removed: string[] }
  /** `[[boxes:…]]` 声明序列：变了就说明设计语言被改过 */
  boxesChanged: boolean
  themeChanged: boolean
  summary: string
}

const normLines = (s: string): string[] =>
  String(s || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')

const assetsOf = (s: string): Set<string> =>
  new Set([...String(s || '').matchAll(/\[\[asset:\s*([^|\]]+)\|([^|\]]+)\|/g)].map((m) => `${m[1]}|${m[2]}`))

const componentsOf = (s: string): Set<string> => {
  const out = new Set<string>()
  for (const m of String(s || '').matchAll(/^:::\s*([a-z]+)/gm)) out.add(':::' + m[1])
  for (const m of String(s || '').matchAll(/^>\s*\[!(\w+)/gm)) out.add('[!' + m[1].toUpperCase() + ']')
  for (const m of String(s || '').matchAll(/^\[\[(banner|title|lace|img|deco|badge|asset):?/gm)) out.add('[[' + m[1] + ']]')
  return out
}

const boxesOf = (s: string): string => [...String(s || '').matchAll(/\[\[boxes:\s*([^\]]+?)\s*\]\]/g)].map((m) => m[1]).join(' ; ')
const themeOf = (s: string): string => (/\[\[theme:\s*([^\]]+?)\s*\]\]/.exec(String(s || '')) || [])[1] || ''

function setDelta(a: Set<string>, b: Set<string>): { added: string[]; removed: string[] } {
  return {
    added: [...b].filter((x) => !a.has(x)),
    removed: [...a].filter((x) => !b.has(x)),
  }
}

export function structureDiff(before: string, after: string): StructureDiff {
  const a = normLines(before)
  const b = normLines(after)
  const sa = new Set(a)
  const sb = new Set(b)
  const removed = a.filter((l) => !sb.has(l)).length
  const added = b.filter((l) => !sa.has(l)).length
  const denom = Math.max(a.length, b.length, 1)
  const textChangedRatio = Math.min(1, Math.max(removed, added) / denom)

  const assets = setDelta(assetsOf(before), assetsOf(after))
  const components = setDelta(componentsOf(before), componentsOf(after))
  const boxesChanged = boxesOf(before) !== boxesOf(after)
  const themeChanged = themeOf(before) !== themeOf(after)

  const bits = [`正文改动约 ${Math.round(textChangedRatio * 100)}%`]
  if (assets.added.length || assets.removed.length) bits.push(`素材引用 +${assets.added.length}/-${assets.removed.length}`)
  else bits.push('素材引用未变')
  if (components.added.length || components.removed.length) bits.push(`组件 +${components.added.join(',')}/-${components.removed.join(',')}`)
  if (boxesChanged) bits.push('设计轴声明有变')
  if (themeChanged) bits.push('主题有变')

  return {
    textChangedRatio,
    sameText: before === after,
    assets,
    components,
    boxesChanged,
    themeChanged,
    summary: bits.join('；'),
  }
}
