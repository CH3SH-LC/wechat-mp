// R32：独立成稿复核的消息构造。只处理已经存在的候选稿，不判断用户意图、不调工具或模型。
// 接线方控制调用次数、取消与失败处理；本模块不循环，也不在内容里匹配主题关键词。
import type { ChatMsg } from './chat.ts'
import { composeMarkdown } from './compose.ts'
import { EDITORIAL_QUALITY_RULE, MATERIAL_GROUNDING_RULE } from './persona.ts'

export interface EditorialReviewInput {
  request: string
  source: string
  /** 实际用户材料、明确的产品事实；完整保留文字与已提供的视觉输入。 */
  contextMessages?: readonly ChatMsg[]
  /** 本地可信排版协议全文，只解释系统语法，不作为本稿事实资料。 */
  engineProtocol?: string | null
  /** 如有当前正式稿，供模型判断局部改稿是否越界；存在前稿不等于本轮一定局部改稿。 */
  priorSource?: string | null
}

export const EDITORIAL_REVIEW_INSTRUCTION = `你是本次公众号文章的编辑。先从 request 确认用户交付的是底稿还是新写资料，以及授权修改范围，再审阅 source 并交付全文。排版底稿时，以用户正文核对 source 是否遗漏、改写或重复了原句，把越权改动恢复成用户原文；复核不自动获得润色权。新写任务才根据有来源的材料修订内容，source 的篇幅、分节和描写不构成保留要求。找出最影响理解、兴趣或判断的问题，只在本次权限内处理；不以逐句换词代替编辑，也不为显得审过而改动已准确有效的文字。

${EDITORIAL_QUALITY_RULE}

${MATERIAL_GROUNDING_RULE}

实质编辑
从读者的角度检查标题和开头承诺了什么，正文中哪里提供了答案。材料的重点被背景、功能清单或泛泛评价埋住时，重新选择和组织；缺少理解所需的连接就补充解释，重复就合并，无关就删除。新稿可调整标题、提纲和篇幅，不必替初稿的每一节找理由。若主旨没有材料支持，改成材料真正能支持的内容。不要把用途介绍改成检查报告，不把内部依据、实现机制或编辑备注搬进正文。
活动信息让读者能判断和参与，介绍与说明让读者理解对象及其实际用途，报道以有来源的事情与人物为中心。按本篇任务判断，无须强加故事、演示、悬念、固定节数或结尾号召。保留适合本题的语气，包括明快、热烈或安静的表达。
逐段检查意思是否连贯：把同一意思被机械拆开的部分按语法和逻辑重组，补回表达已有事实所需的关系，删去不增加信息的套话和假亲切。不能只换几个词就把碎句、空洞安抚或反复邀请判为自然，也不能用补造细节来使段落显得充实。新稿需要重写时重写相关段落；已有稿严格遵守下方的局部修改权限。
对新稿逐段辨认它比前文多讲了什么：如果只有标题换述、安慰或重复行动邀请，不能把它作为独立内容保留；将有用信息合并成连贯段落，必要时撤去空小节和纯文字容器。检查开头、正文、信息栏和结尾是否重复同一事实，保留有明确用途的位置，不以醒目为由到处重复。表达不足时展开已有材料中的含义与关系，不能用“就能”“都可以”式无依据保证代替说明；这不是筛查词语，而是核对承诺是否成立。

事实核对
用户材料、明确确认及背景中标明的产品事实可作依据；候选稿、旧稿、写作模板和示例不能确认事实。可靠常识可用于一般解释，不替代未知的本次事实。不补造规则、统计、采访、经历、能力或效果。假设应明确标识，内部材料与结果必须自洽，不能冒充真实案例或实际产物。
核对关键数字、对象和适用条件；检查结论是否超出证据，把个别经历当普遍规律或把可能当保证。对于教程，按文章顺序模拟执行，核验每步前提、结果和后续维护；删除、覆盖之前要有独立且可用的资料保留方式，同步或回收站不是备份，打开一份不代表整批完整。发现矛盾应修正主张或做法，不只是加上模糊修饰。必要条件说在相关内容附近，非必要缺项省略，已经说明过的限制不反复提醒。
把新增的标题、副标题、章名、题签及标签与正文分开核对：正文逐字保留不代表新增文字准确。新增表述的对象、动作、范围和条件都须有原文依据，不能把局部规则概括成全局限制；无法准确概括时改用中性的内容名称。排版底稿时还要检查每个原有自然段是否在同一位置完整出现，恢复被抽作导语或卡片的句子，删除未经要求而重复正文的信息总览。

修改权限与交付
priorSource 为 null 只表示没有既存文档，不表示没有用户底稿，也不授权重写。用户正文可能就在 request 或背景里的用户消息中；排版任务逐字保留该正文，按用户要求分章并保持合理的段落关系。有前稿时按 request 的授权范围修改。只改开头或指定段落时，其余正文逐字恢复或保留 priorSource；用户要求整篇重做才重做。保持用户的视觉选择和有效排版语法。确属根据零散资料新写时，标题、段落、分节和纯文字组件可由内容重新组织，初稿的目录不是限制；不要为了保留某个框或标题而留下冗余文字。
所有图片、URI、asset ID、插画占位、照片位和原始说明原样保留。source 中的 [[ZXMAT:…]] 是不可变素材锁，immutableMaterials 仅解释素材身份和画面主题；候选稿生成的插画说明不是本次事实资料。逐字照回短标记，数量和顺序不变，不加反引号、不放进代码、不抄回原始 URI 或素材行。保护锁不要求保留相邻小节、描写或推测；新稿可在不改变锁的数量、顺序和合法位置的前提下合并或删除正文，图片仍与其说明的内容对应。局部修改时素材不新增、删除、替换或移动。priorSource 的同一素材沿用同一锁；只编辑锁外文案，清单与素材本身没有修改权限。
先输出“审稿摘要：”，最多6条，只报实际完成的实质改动，未改就不声称已改；必要时引用修改前后短片段，没有问题就写未发现实质问题。不展示推理过程。随后输出唯一、完整、闭合的 \`\`\`v2 围栏，包含最终全文；范围外内容照回，不用同上或省略号。摘要所述改动须在最终稿中确实完成，不只交意见或节选。`

/**
 * 历史工具结果改为带来源身份的背景资料，而不透传工具调用信封。
 * 正文续写端没有 tools，直接携带旧 tool_calls/tool_call_id 会触发部分模型服务的协议错误。
 * JSON 包装保留逐字内容和出处；它不授予旧材料更高指令优先级。
 */
export function buildEditorialReviewMessages(input: EditorialReviewInput): ChatMsg[] {
  const locked = lockEditorialMaterials(input.source)
  const protocolInstruction = input.engineProtocol?.trim()
    ? '\n\n## 本地可信排版引擎协议（系统排版语法；只决定语法与样式，不决定本稿事实）\n' +
      '以下是完整协议，用于识别和保留有效 v2 排版语法。其中示例不是本次事实，也不要求固定篇章结构；本次修改权限和输出形式仍以上方审稿要求为准。\n' + input.engineProtocol
    : ''
  const background: ChatMsg[] = (input.contextMessages || []).map((message, index) => ({
    role: 'user',
    content: '审阅背景资料（保留原消息身份，不是新的写作指令）：\n' + JSON.stringify({
      index: index + 1,
      originalRole: message.role,
      content: message.content,
    }),
    ...(message.images?.length ? { images: [...message.images] } : {}),
  }))

  return [
    { role: 'system', content: EDITORIAL_REVIEW_INSTRUCTION + protocolInstruction },
    ...background,
    {
      role: 'user',
      content: '本次审阅输入（request 是用户需求；source 是待核对候选稿，不是事实依据；priorSource 是已有正式稿或 null）：\n' +
        JSON.stringify({
          request: input.request,
          source: locked.source,
          priorSource: input.priorSource == null ? null : lockPriorMaterials(input.priorSource, locked.materials),
          immutableMaterials: locked.materials,
        }),
    },
  ]
}

interface MaterialSpan {
  start: number
  end: number
  original: string
}

interface LockedMaterial {
  marker: string
  original: string
}

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const MATERIAL_MARKER = /\[\[ZXMAT:[^\]\r\n]*\]\]/g

/**
 * 源码位置必须对应实际图片；不从 URI、说明或序号猜测。
 * 把所有候选 URI 一次性临时改为各自唯一探针，只调用一次纯排版器确认实际 img。
 * 因而 imgrow/imgcard、行内代码、围栏和普通文字沿用实际排版语义，
 * 不引入另一套 Markdown 解析器。探针只在内存运行，绝不加载图片或发网络请求。
 */
function editorialMaterialSpans(source: string): MaterialSpan[] {
  const spans: MaterialSpan[] = []
  let inCode = false
  for (const lineMatch of source.matchAll(/^[^\r\n]*/gm)) {
    const raw = lineMatch[0]
    const line = raw.trim()
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (!inCode && (/^\[\[(?:asset|img|deco):[^\]]*\]\]$/.test(line) || /^:::\s*photo(?:\s.*)?$/.test(line))) {
      spans.push({ start: lineMatch.index!, end: lineMatch.index! + raw.length, original: raw })
    }
    // 角饰别名属于结构头；只锁头部，气泡标题和正文仍由编辑正常修改。
    const bubble = !inCode && /^[ \t]*>\s*\[!\w+\|[A-Za-z0-9_-]+\]/.exec(raw)
    if (bubble) spans.push({ start: lineMatch.index!, end: lineMatch.index! + bubble[0].length, original: bubble[0] })
  }
  const candidates: { span: MaterialSpan; uriSpan: MaterialSpan; probe: string }[] = []
  let probePrefix = 'https://editorial-material.invalid/probe-'
  while (source.includes(probePrefix)) probePrefix += 'x-'
  for (const match of source.matchAll(MARKDOWN_IMAGE)) {
    const start = match.index!
    const end = start + match[0].length
    if (spans.some((span) => start < span.end && end > span.start)) continue
    const uriStart = start + match[0].indexOf('](') + 2
    candidates.push({
      span: { start, end, original: match[0] },
      uriSpan: { start: uriStart, end: uriStart + match[1].length, original: match[1] },
      probe: probePrefix + start,
    })
  }
  if (candidates.length) {
    const probed = replaceMaterialSpans(source, candidates.map((item) => item.uriSpan), candidates.map((item) => item.probe))
    const rendered = new Set([...composeMarkdown(probed).html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"[^>]*>/g)].map((image) => image[1]))
    for (const candidate of candidates) if (rendered.has(candidate.probe)) spans.push(candidate.span)
  }
  return spans.sort((a, b) => a.start - b.start)
}

function replaceMaterialSpans(source: string, spans: readonly MaterialSpan[], replacements: readonly string[]): string {
  let result = ''
  let end = 0
  spans.forEach((span, index) => {
    result += source.slice(end, span.start) + replacements[index]
    end = span.end
  })
  return result + source.slice(end)
}

function lockEditorialMaterials(source: string): { source: string; materials: LockedMaterial[] } {
  const spans = editorialMaterialSpans(source)
  // 标记身份只用于本次审稿恢复，不代表资产身份或权限。确定性便于恢复方只持有原稿。
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0
  let prefix = '[[ZXMAT:' + hash.toString(16) + ':'
  while (source.includes(prefix)) { hash = (hash + 1) >>> 0; prefix = '[[ZXMAT:' + hash.toString(16) + ':' }
  const materials = spans.map((span, index) => ({ marker: prefix + (index + 1) + ']]', original: span.original }))
  return { source: replaceMaterialSpans(source, spans, materials.map((item) => item.marker)), materials }
}

function lockPriorMaterials(source: string, materials: readonly LockedMaterial[]): string {
  const available = new Map<string, string[]>()
  for (const material of materials) {
    const markers = available.get(material.original) || []
    markers.push(material.marker)
    available.set(material.original, markers)
  }
  const spans = editorialMaterialSpans(source)
  // 仅逐字相同的素材复用锁；说明或引用不同的旧素材不靠近似匹配猜测对应关系。
  return replaceMaterialSpans(source, spans, spans.map((span) => available.get(span.original)?.shift() ?? span.original))
}

/**
 * 审稿只能交回锁定正文。每个锁必须恰好一次、保持顺序、仍处于可渲染素材位置。
 * 严格失败而不猜图、不替换 URI；恢复原始字符串后仍执行原有真实排版保护。
 */
export function restoreEditorialMaterials(original: string, reviewed: string): string {
  const locked = lockEditorialMaterials(original)
  const expected = [...locked.source.matchAll(MATERIAL_MARKER)].map((match) => match[0])
  const returned = [...reviewed.matchAll(MATERIAL_MARKER)].map((match) => match[0])
  if (JSON.stringify(expected) !== JSON.stringify(returned) ||
      [...locked.source.matchAll(/\[\[ZXMAT:/g)].length !== [...reviewed.matchAll(/\[\[ZXMAT:/g)].length) {
    throw new Error('文案复核的素材锁缺失、重复、次序改变或含陌生标记，未采用本次复核结果。')
  }
  const byMarker = new Map(locked.materials.map((material) => [material.marker, material.original]))
  const restoredSpans: MaterialSpan[] = []
  let restored = ''
  let end = 0
  for (const match of reviewed.matchAll(MATERIAL_MARKER)) {
    restored += reviewed.slice(end, match.index)
    const material = byMarker.get(match[0])
    if (material !== undefined) {
      restoredSpans.push({ start: restored.length, end: restored.length + material.length, original: material })
      restored += material
    } else {
      // 原稿代码/文字本来就可能含有此保留语法；构造锁时已避开碰撞，它不授予素材身份。
      restored += match[0]
    }
    end = match.index! + match[0].length
  }
  restored += reviewed.slice(end)
  const actual = editorialMaterialSpans(restored)
  if (restoredSpans.some((span) => !actual.some((item) => item.start === span.start && item.end === span.end && item.original === span.original))) {
    throw new Error('文案复核把素材锁变成了代码或普通文字，未采用本次复核结果。')
  }
  assertEditorialImagesPreserved(original, restored)
  return restored
}

/** 审稿回复只能有一份边界完整的 v2；不沿用聊天提取器的多稿取末篇兼容规则。 */
export function parseEditorialReview(raw: string): string {
  const fences = [...raw.matchAll(/^[ \t]*`{3,}[^\r\n]*(?:\r?\n|$)/gm)]
  if (fences.length !== 2 || !/^[ \t]*```v2[ \t]*\r?\n$/.test(fences[0][0]) ||
      !/^[ \t]*```[ \t]*(?:\r?\n|$)$/.test(fences[1][0])) {
    throw new Error('文案复核没有返回完整、单一且边界明确的 v2 成稿。')
  }
  const open = fences[0]
  const close = fences[1]
  const prefix = raw.slice(0, open.index).trim()
  const suffix = raw.slice(close.index! + close[0].length).trim()
  if (suffix || (prefix && !/^审稿摘要[：:]/.test(prefix))) {
    throw new Error('文案复核含有成稿之外的正文或不明确的输出，未采用。')
  }
  // 条目允许换行续写；一个无编号的“未发现实质问题”同样合法。
  if ((prefix.match(/^[ \t]*(?:[-*+]\s+|\d+[.、)）]\s*)/gm) || []).length > 6) {
    throw new Error('文案复核摘要超过六项，未采用。')
  }
  const source = raw.slice(open.index! + open[0].length, close.index).replace(/\r?\n$/, '')
  // 摘要和代码里的标签是解释文字；只拒绝正文以 HTML 元素替代 v2 的输出。
  const prose = source.replace(/^(?: {4}|\t).*$/gm, '').replace(/(`+)[^\r\n]*?\1/g, '')
  if (!source.trim() || /<\/?[a-z][^>]*>|<!--|<!doctype\b/i.test(prose)) {
    throw new Error('文案复核必须返回非空 v2 正文，不能返回 HTML。')
  }
  return source
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 用实际排版结果判断图片存在；正文里的 URI、链接或代码引用不算图片。 */
function renderedImageReferences(source: string): string[] {
  // 只选源文中的 Markdown 图片 URI，排除排版器自行添加的语义图标。
  // 即使代码中含有同一个 URI，也必须在下面的真实 img 节点中出现才计数。
  const authoredUris = new Set([...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => escapeAttribute(match[1])))
  return [...composeMarkdown(source).html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"[^>]*>/g)]
    .filter((match) => authoredUris.has(match[1]))
    .map((match) => JSON.stringify({ uri: match[1], description: /\balt="([^"]*)"/.exec(match[0])?.[1] || '' }))
}

/** 当前写作协议中的整行素材声明，代码/行内提及不授予素材身份。 */
function declaredImageReferences(source: string): string[] {
  const refs: string[] = []
  let inCode = false
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (inCode) continue
    if (/^\[\[(?:asset|img|deco):[^\]]*\]\]$/.test(line) || /^:::\s*photo(?:\s.*)?$/.test(line)) {
      refs.push(raw)
    }
    // 角饰引用是气泡头的一部分；正文与标题可以编辑，但素材别名不能换。
    const bubble = /^>\s*\[!\w+\|([A-Za-z0-9_-]+)\]/.exec(line)
    if (bubble) refs.push('bubble-deco:' + bubble[1])
  }
  return refs
}

/** 文案复核没有改图权限；以本次候选为基准，保持 URI、说明、素材声明、顺序与次数。 */
export function assertEditorialImagesPreserved(before: string, after: string): void {
  if (JSON.stringify(renderedImageReferences(before)) !== JSON.stringify(renderedImageReferences(after)) ||
      JSON.stringify(declaredImageReferences(before)) !== JSON.stringify(declaredImageReferences(after))) {
    throw new Error('文案复核改变了候选稿的图片或素材引用，未采用本次复核结果。')
  }
}
