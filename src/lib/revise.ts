// revise.ts —— 自动质检自检（第 32 轮；P1 2026-09-24 调查 §5 起区分"局部问题"与"结构问题"）：
// 成稿/修订稿产出后，本地排版引擎若仍检出"可修复质量项"（组件化不足 / 未包含美术素材 / 素材用量偏低 /
// 照片位却无装饰插画 / 气泡角饰未定义 / 库素材引用缺失），就自动把问题清单喂回模型重写一版，
// 有界最多 MAX_AUTO_REVISES 次，直到无此类问题或达到上限。
// 定位：这是"撰写产物的确定性质量门禁"，不是对话流程——不拦截用户回合、不做澄清/路由判断，
// 不加任何对话状态机；运行期间沿用同一助手气泡与 busy，用户仍可手动停止。
export const REVISE_MARKER = '【自动质检】'
export const MAX_AUTO_REVISES = 2

// 只有这些"改写法即可解决"的结构/素材形状问题会触发自动重写；
// 风格未收录（可能是用户自定义名）、正文偏短（可能是有意短篇）、本地图/art:///表格等不触发。
// P1：short 档（正文 <600 字）的提示文案刻意不含这些子串，故短通知不会被推回长篇重写。
//
// F9（2026-09-29 交付质量事故）：下面这些 key 是**中文告警子串**，靠 `includes` 匹配来当分支条件——
// 等于"用展示文案控制执行"：提示文案一改（换词、加前缀、调字数），自动修订就会静默失效，
// 而日志仍显示保存成功。该做法已被识别为待替换，正在被 `src/lib/delivery-quality.ts` 的稳定
// `code`（与 severity / repairKind 同源，文案只负责展示）取代。**本轮不改 FIXABLE_KEYS 的行为**，
// 接线由交付质量改造统一完成，此处仅登记待替换。
const FIXABLE_KEYS = [
  '组件化不足',
  '未包含美术素材',
  '素材用量偏低',
  '只有照片位、没有任何装饰插画',
  '气泡角饰',
  '库素材引用缺失',
]

// 可定位到具体行的"局部问题"：这类问题只该改那几行，不该整篇重写。
// 其余（组件化/素材用量/未包含素材）是结构问题，需要整体调整。
const LOCAL_KEYS = ['气泡角饰', '库素材引用缺失']

export function fixableWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => FIXABLE_KEYS.some((k) => w.includes(k)))
}

export interface LocatedIssue {
  line: number // 1-based
  text: string
  issue: string // 该行对应的质检问题
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 把"局部问题"落到具体行号上。定位不到的返回空数组（调用方退回整篇重写口径）。
 * 只识别确定性的两种：气泡角饰未定义、库素材引用缺失。
 */
export function locateIssues(v2: string, issues: string[]): LocatedIssue[] {
  const lines = String(v2 || '').split(/\r?\n/)
  const hits = new Map<number, string>()
  for (const w of issues) {
    const deco = /气泡角饰\s+(\S+)\s*未定义/.exec(w)
    if (deco) {
      const re = new RegExp('^>\\s*\\[!\\w+\\|' + escapeRe(deco[1]) + '\\]')
      lines.forEach((l, i) => {
        if (re.test(l.trim())) hits.set(i, w)
      })
      continue
    }
    if (w.includes('库素材引用缺失')) {
      lines.forEach((l, i) => {
        if (/^\[\[asset:/.test(l.trim())) hits.set(i, w)
      })
    }
  }
  return [...hits.keys()].sort((a, b) => a - b).map((i) => ({ line: i + 1, text: lines[i], issue: hits.get(i)! }))
}

/** 问题是否全部属于"可定位到行"的局部问题 */
function allLocal(issues: string[]): boolean {
  return issues.length > 0 && issues.every((w) => LOCAL_KEYS.some((k) => w.includes(k)))
}

// 阶段 2（2026-09-28 修复计划）：修订提示**只能**指向主模型可写的素材协议。
// 历史故障根因之一就是旧提示写着"请先用 ::: art deco 名称 定义现场装饰素材"——
// `::: art deco` 是解析后的**内部格式**，模型照着写只会产出没有 SVG 的空块，
// 于是"按要求定义了，但仍然全部未定义"。内部编译结果与模型输出协议必须分开表述。
// F8（2026-09-28 只读审计）：原文写"只用这三种"，漏了照片位 `::: photo 说明`——
// 它与三种插画写法并列，是引擎协议 §三.3 的第四种（仅在用户会提供真实照片时写）。
// F9（2026-09-29 交付质量事故）：照片位曾被写成多行块（`::: photo` + 若干行 + `:::`），
// 被按正文解析后吞掉紧随的段落与 `::: art` 素材块，成品出现内部源码泄漏、素材全部落空。
// 故此处把口径写死为**单行指令**：说明在同一行，下一行起即正文，不许 `:::` 闭合。
export const MATERIAL_RULE =
  '素材写法只用这三种，别的都不要写：引用库素材 [[asset:分类|素材ID|用途说明]]、' +
  '新增插画占位 [[img:wide 或 inline|说明]]、新增角饰占位 [[deco:名称|说明]]（要重新画就在第三段加 |new）。' +
  '第四种只在用户明确会提供真实照片时写：照片位 `::: photo 说明` 是**单行指令**——' +
  '`::: photo` 与说明写在同一行，**下一行起就是正文**（照常写段落/组件/素材引用）；' +
  '**不要用 `:::` 闭合，也不要另起行写说明或写多行块**（写成"`::: photo` + 若干行 + `:::`"会被按正文解析，说明行会变成文章正文）。' +
  '用户没有真实照片、由系统配图时严禁使用，见引擎协议 §三.3。' +
  '**不要写 ::: art / ::: art deco 这类容器**（那是引擎解析素材后生成的内部格式，你写了不会被采用）。'

// 生成"自动修订"的追加用户消息。
// P1：全部是局部问题时走**定点修订**口径——附上具体行号与原文行，要求逐字保留其余内容；
// 否则退回整篇修订口径（保留已澄清方向与原文草稿，按问题清单修订并只输出一个 ```v2 围栏）。
export function buildReviseContent(v2: string, issues: string[]): string {
  const list = issues.map((w) => '- ' + w).join('\n')
  const located = allLocal(issues) ? locateIssues(v2, issues) : []
  const fence = '```v2\n' + v2 + '\n```'

  if (located.length) {
    const rows = located.map((h) => `- 第 ${h.line} 行：${h.text.trim()}\n  ⟵ ${h.issue}`).join('\n')
    return (
      `\n${REVISE_MARKER}本地排版引擎质检未通过，但**问题只出在下列个别行**。\n` +
      `请只修这些行，其余内容逐字保留：不要改写、不要调整段落顺序、不要新增或删减任何其他内容、不要重新起稿。\n` +
      `${MATERIAL_RULE}\n\n` +
      `需要修的行（行号按下面正文计）：\n${rows}\n\n` +
      `修好后仍输出**完整**正文（一个 \`\`\`v2 围栏，未改动的部分原样复制），围栏前可一两句说明：\n${fence}`
    )
  }

  return (
    `\n${REVISE_MARKER}本地排版引擎质检未通过，请把上一版正文按下列问题修订重写一遍：\n` +
    `（保留已澄清的主题 / 风格 / 事实 / 照片位设置与整体结构，补齐所缺项、纠正问题；不要新增无关内容；不要重复贴旧稿。）\n` +
    `${MATERIAL_RULE}\n` +
    `质检问题：\n${list}\n\n` +
    `以下为当前正文，请基于它修订并只输出一个 \`\`\`v2 围栏（围栏前可用一两句自然说明）：\n` +
    fence
  )
}
