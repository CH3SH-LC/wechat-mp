// edit-contract-check.mjs —— **改稿回合的契约与度量**回归（R25）
//
// 用法：node scripts/edit-contract-check.mjs
//
// 用户判词："要求用户在使用过程中修改某些地方也完全可以，而不是只有第一遍直出才有高质量"。
// 这条链上有三样东西必须**可断言**，否则"改一处不掉质量"只是愿望：
//   ① **写入指令**：有前稿时带上"只改他指出的那处、其余逐字保留、仍输出完整正文"的改稿契约；
//      没有前稿时不带（别把新写也约束成改稿）。
//   ② **自动修订**：改稿回合里，质检触发的修订不许借机重写全文（`preserveRest`）。
//   ③ **改动范围可测**：`structureDiff` 能把"改了多少 / 素材引用与设计轴动没动"量出来——
//      真实验收与回合 trace 都靠它，不然只能"看着差不多"。
//
// 本脚本**零模型、零网络**。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
// 注意：从 `edit-contract.ts` 直接取——`prep.ts` 会连带 `retrieval.ts` 的 `import.meta.glob`（Vite 专属），
// 在纯 Node 下起不来。这正是把改稿契约单独立模块的原因。
import { writeInstruction } from '../src/lib/edit-contract.ts'
import { buildReviseContent } from '../src/lib/revise.ts'
import { structureDiff } from '../src/lib/edit-diff.ts'

const MIN_CHECKS = 21
const judge = createJudge({ script: 'edit-contract-check', outDir: resolveOutDir('edit-contract-check'), minChecks: MIN_CHECKS })
guardCrashes(judge)
let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}
const observe = (name, detail) => judge.observe(name, detail)

const EDIT_CLAUSE = '这一轮是"改稿"'
const KEEP_CLAUSE = '逐字保留'
const FULL_DOC = '仍要输出完整正文'

// ── ① 写入指令 ────────────────────────────────────────────────────────────────
console.log('\n[1. 写入指令：有前稿才带改稿契约]')
const withPrior = writeInstruction(true)
const fresh = writeInstruction(false)
check('有前稿 → 带改稿契约（"只改指出的那处 / 其余逐字保留 / 仍输出完整正文"）',
  withPrior.includes(EDIT_CLAUSE) && withPrior.includes(KEEP_CLAUSE) && withPrior.includes(FULL_DOC),
  withPrior.includes(KEEP_CLAUSE) ? '三条都在' : '缺条款')
check('没有前稿 → **不带**改稿契约（新写不该被约束成改稿）',
  !fresh.includes(EDIT_CLAUSE) && !fresh.includes(KEEP_CLAUSE),
  fresh.includes(EDIT_CLAUSE) ? '误带' : '干净')
check('两版都保留撰写基线与材料依据边界（不能为了改稿把旧的边界弄丢）',
  [withPrior, fresh].every((t) => t.includes('```v2') && t.includes('知识摘要仍适用') && t.includes('材料')),
  '')
check('改稿契约是**条件式**措辞（"若用户是在要求修改…若是在要求重做…"），不替模型分流',
  withPrior.includes('若用户是在要求**重做 / 换方向**') && !/^这一轮必须改稿/.test(withPrior),
  '')
// 兼容旧导出仍在（别把别处引用弄断）
check('旧的 `WRITE_INSTRUCTION` 常量仍导出且等价于"新写"', typeof fresh === 'string' && fresh.length > 20)

// ── ② 自动修订：改稿回合不许重写全文 ──────────────────────────────────────────
console.log('\n[2. 自动修订：preserveRest 只在改稿回合生效]')
const wholeDocIssues = ['组件化不足：正文缺少容器组件']
const localIssues = ['气泡角饰 blossom 未定义：请在气泡前用 [[asset:bubble|素材ID|用途]] 引用库素材']
const v2 = '::: art deco blossom\n<svg/>\n:::\n\n> [!KEY|blossom] 标题\n> 正文。\n'
const wholePlain = buildReviseContent(v2, wholeDocIssues)
const wholeKeep = buildReviseContent(v2, wholeDocIssues, { preserveRest: true })
const localPlain = buildReviseContent(v2, localIssues)
const localKeep = buildReviseContent(v2, localIssues, { preserveRest: true })
check('整篇修订分支：默认不带整篇改稿保留范围（原图自身仍须保护）',
  !wholePlain.includes('**这一轮是在改稿**') && !wholePlain.includes('**其余内容逐字保留**'), '')
check('整篇修订分支：改稿回合**带上**"只改问题所指、其余逐字保留"', wholeKeep.includes(KEEP_CLAUSE) && wholeKeep.includes('不许借机'), '')
check('定点修订分支：改稿回合同样带上（两个分支都要，不能只改一处）', localKeep.includes(KEEP_CLAUSE), '')
check('两个分支的默认口径都没被改坏（仍带素材规则与完整正文要求）',
  [wholePlain, localPlain].every((t) => t.includes('```v2') && t.includes('[[asset:')), '')

// R32：检查实际生成的两类修订消息，防止旧“三种素材”提示把原图当非法语法移除。
const originalPhoto = `![照片说明保持原文](local-image://li-${'a'.repeat(64)})`
const photoSource = `${originalPhoto}\n\n[[asset:art-inline|missing-fixture|需要修复的库素材]]\n\n原图后的正文。`
const photoRepairs = [
  buildReviseContent(photoSource, wholeDocIssues),
  buildReviseContent(photoSource, ['库素材引用缺失'], { preserveRest: true }),
]
check('整体与定点修订都完整携带原图引用及候选全文，不在提示构造时改写',
  photoRepairs.every((t) => t.includes('```v2\n' + photoSource + '\n```')), '')
check('两类修订都明确支持真实local-image URI并要求原图整行逐字保留',
  photoRepairs.every((t) => t.includes('![画面说明](local-image://li-<SHA256>)') && t.includes('已有原图引用整行逐字保留') && t.includes('不编造 ID')), '')
check('两类修订都限制照片位仅用于尚缺照片，禁止将原图换成占位或生成图',
  photoRepairs.every((t) => t.includes('明确稍后提供、当前仍缺失') && t.includes('不能把原图替换为照片占位、生成插画') && !t.includes('素材写法只用这三种')), '')

// ── ③ 改动范围度量 ────────────────────────────────────────────────────────────
console.log('\n[3. structureDiff：改了多少能量出来]')
const A = [
  '[[theme:校园]]',
  '[[boxes:frame=line;shape=rail]]',
  '第一段：开学典礼在九月一日。',
  '第二段：家长休息区在体育馆二层。',
  '[[asset:art-inline|as-1|开篇插画]]',
  '::: card 提示',
  '- 带好证件',
  ':::',
  '> [!TIP] 早点到',
  '> 提前十五分钟。',
].join('\n')
const SAME = A
const ONE_LINE = A.replace('第二段：家长休息区在体育馆二层。', '第二段：家长休息区在体育馆二层，开到十点半。')
const REWRITTEN = [
  '[[theme:国潮]]',
  '[[boxes:frame=stack;shape=medal]]',
  '全新的第一段。',
  '全新的第二段。',
  '[[asset:art-wide|as-9|换场花饰]]',
  '> [!KEY] 新结论',
  '> 全部重写。',
].join('\n')

const dSame = structureDiff(A, SAME)
const dOne = structureDiff(A, ONE_LINE)
const dRe = structureDiff(A, REWRITTEN)
check('同一份 → 改动 0、素材与组件都没变', dSame.sameText && dSame.textChangedRatio === 0 && dSame.assets.added.length === 0 && dSame.assets.removed.length === 0 && !dSame.boxesChanged, dSame.summary)
check('只改一行 → 改动比例小（≤0.2）且素材/设计轴/组件清单都不动',
  dOne.textChangedRatio > 0 && dOne.textChangedRatio <= 0.2 && !dOne.boxesChanged && dOne.assets.added.length === 0 && dOne.assets.removed.length === 0 &&
    dOne.components.added.length === 0 && dOne.components.removed.length === 0,
  dOne.summary)
check('整篇重写 → 改动比例大（≥0.5）、且**报出**主题/设计轴/素材引用的变化',
  dRe.textChangedRatio >= 0.5 && dRe.themeChanged && dRe.boxesChanged && dRe.assets.added.length === 1 && dRe.assets.removed.length === 1,
  dRe.summary)
observe('三种情形的摘要', `同一份「${dSame.summary}」｜改一行「${dOne.summary}」｜整篇重写「${dRe.summary}」`)
check('summary 是可读中文（能直接进 trace）', /正文改动约 \d+%/.test(dOne.summary) && dOne.summary.includes('素材引用未变'), dOne.summary)

// ── ④ 接线：契约确实挂在"有前稿"这个**事实**上，不是前端路由 ────────────────────
console.log('\n[4. 接线（源码结构断言）]')
const appSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'App.tsx'), 'utf8')
check('App 用 `writeInstruction(hasPriorDoc)` 组装撰写指令', /writeInstruction\(hasPriorDoc\)/.test(appSrc), '')
check('`hasPriorDoc` 由**已验收前稿是否存在**推出（事实判断，不是对用户话术的分类）',
  /const hasPriorDoc = Boolean\(priorIsAccepted && priorAccepted && priorAccepted\.source\)/.test(appSrc), '')
check('自动修订把 `preserveRest: hasPriorDoc` 传下去', /preserveRest:\s*hasPriorDoc/.test(appSrc), '')
check('改稿回合把"改动范围"记进 trace（事后可查这次改了多大）',
  /structureDiff\(priorAccepted\.source, cand\.source\)/.test(appSrc) && /改稿改动范围/.test(appSrc), '')
check('没有引入"用户消息→是否改稿"的前端分类（铁律 6：不做对话状态机）',
  !/isEditRequest|expectEdit|pendingEdit/i.test(appSrc), '')

judge.finish({ exitCode: failed ? 1 : 0, label: 'EDIT-CONTRACT' })
