// app-message-grounding-check.mjs —— F1「全入口遵守材料依据边界」的**真实 App 实参**截获
//
// 用法：
//   node scripts/app-message-grounding-check.mjs [outDir] [URL]
//     outDir 缺省 %TEMP%/wxmp-f1-<时间戳>/（不覆盖历史证据）
//     URL    缺省 http://127.0.0.1:1420（需先起 dev server）
//
// 为什么必须这样打：任务卡第 3 节明确要求「用零模型替身截获**真实 App 实际发出**的消息……
// 不能以常量匹配或源码字符串断言代替」。`prep-contract-check` 打的是真实 `runPrep`（覆盖 prep 两个入口），
// 但 compose 的 WRITE、candidate/compose 之后的自动 REVISE 是 **App 自己的组装**——
// 只断言源码常量，抓不住"规则写在文件里、忘了接进实际发出的消息"。
//
// 做法：把真实 App 原样跑起来（真实 React 组件、真实 `turn()`、真实交付门禁），
// 在 `src/lib/chat.ts` 模块末尾注入替身，把 Rust 侧通道换成受控实现；
// 协议加载故障用例另外包裹 retrieval 的加载函数，App 的 turn() 与消息构造不改：
//   · `prep_turn` 按剧本返回（夹具，不是原响应回放）；
//   · `chat_stream` 记录**实参**再按剧本回放增量；
//   · 其余命令返回最小可用的固定值。
// 页面里 `window.__TAURI_INTERNALS__` 因此为真 → App 走的就是桌面端的组装路径（digest、baseMsgs、revise 追加）。
// 不联网、不调模型、不写真实工作区。
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { EDITORIAL_QUALITY_RULE, LANGUAGE_COMPOSITION_RULE, MANUSCRIPT_EDIT_RULE, MATERIAL_GROUNDING_RULE } from '../src/lib/persona.ts'

import { parseRunnerArgs, tempOutDir, writeFileAtomic } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const CONFIG_HINT = `配置方法（与 verify-ui.mjs 同一口径）：
  export VERIFY_PLAYWRIGHT="D:/path/to/node_modules/playwright"
  export VERIFY_CHROMIUM="C:/Users/<你>/AppData/Local/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe"`

// ---- 断言目标文本 ----
// 都是"共同规则单一来源"在**实际发出的消息**里的可识别片段。它们不是源码常量匹配：
// 断言对象是页面里真实 App 组装并交给 `chat_stream` / `prep_turn` 的 `messages` 实参。
const MARK = {
  /** 共同材料依据边界：必须出现在 system（persona）与各入口追加指令里 */
  ground: '材料依据边界',
  /** compose 的 digest 头：旧文案「冲突以库为准」必须已被收窄 */
  digestOld: '作为本次创作依据，冲突以库为准',
  /** compose 的 digest 头：按资料身份区分写作规范与明确产品事实 */
  digestNew: '已取用写作知识',
  /** 自动修订：只修所列问题、不新增运营规则 */
  reviseNoNewRules: '不新增运营规则',
  /** 自动修订：保留对象限定为用户材料 / 明确确认的事实 */
  reviseKeep: '用户材料或明确确认',
  /** 续改：当前正式稿已注入 */
  priorDocHeading: '当前正式文稿',
  /** 续改：「权威」的范围限定（只指版本与素材引用，不是逐句事实认证） */
  priorAuthorityLimit: '只指**当前保存的版本与素材引用**',
  /** 续改：既有素材保持约束仍在 */
  priorAssetKeep: '不要给已有素材加 |new',
  /** G3 过度阻断对照：规则里必须保留正向授权（连接语与明确标识的普通建议照常写） */
  g3PositiveAllowed: '可以写连接语和明确标识的普通建议',
  /** G3 过度阻断对照：规则里**不得**出现"见到承诺就删/封"这类口径（一组，不是单串） */
  g3KeywordHack: ['一律删', '全部删除', '一律不写', '不得出现', '禁止提及'],
  /** G3 过度阻断对照：规则要明确"不要因为缺一个非必要字段就反复追问" */
  g3NoEndlessAsking: '不要因为缺一个非必要字段就反复追问',
  /** G3 过度阻断对照：材料没给的非必要细节**可以省略**（而不是必须问） */
  g3OmitAllowed: '可以省略',
  /** prep 指令本身的识别串（用它把断言钉在那条消息上，而不是 system） */
  prepInstruction: '创作类请求的处理方式',
  /** 末轮预算提醒的识别串 */
  prepLastRound: '最后一次请求',
  /** 末轮提醒里必须带上的依据边界句（时间紧也不能补事实） */
  prepLastRoundGround: '时间紧也不要把没材料依据的规则写进去',
}

const run = {
  script: 'app-message-grounding-check',
  startedAt: new Date().toISOString(),
  status: 'BLOCKED',
  executionComplete: false,
  plannedCases: [],
  executedCases: [],
  checks: [],
  errors: [],
  sourceHashes: {},
}
const SRC = ['src/App.tsx', 'src/lib/chat.ts', 'src/lib/editorial.ts', 'src/lib/persona.ts', 'src/lib/prep.ts', 'src/lib/revise.ts', 'src/lib/retrieval.ts', 'src/knowledge/排版引擎/engine-write-protocol.md', 'src/knowledge/产品/zhixu-product-facts.md', 'src/knowledge/文本/写作/writing-purpose.md', 'src/knowledge/文本/写作/writing-language.md']
for (const rel of SRC) run.sourceHashes[rel] = createHash('sha256').update(readFileSync(join(repoRoot, rel))).digest('hex')
const ENGINE_PROTOCOL = readFileSync(join(repoRoot, 'src/knowledge/排版引擎/engine-write-protocol.md'), 'utf8')
const PRODUCT_FACTS = readFileSync(join(repoRoot, 'src/knowledge/产品/zhixu-product-facts.md'), 'utf8')
const WRITING_EXCERPT = readFileSync(join(repoRoot, 'src/knowledge/文本/写作/writing-purpose.md'), 'utf8').slice(0, 6000)

const check = (id, pass, ...evidence) => {
  run.checks.push({ id, pass: Boolean(pass), evidence: evidence.map((e) => String(e ?? '')) })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} - ${id}${evidence.filter(Boolean).length ? ' (' + evidence.filter(Boolean).join(' / ') + ')' : ''}`)
}
const fail = (stage, message) => {
  run.errors.push({ stage, message: String(message) })
  console.error(`[app-message-grounding-check] ERROR@${stage}: ${message}`)
}

function resolvePlaywright() {
  try {
    return require('playwright')
  } catch (e) {
    const p = process.env.VERIFY_PLAYWRIGHT
    if (!p) dieBlocked(`解析不到 playwright：require 失败（${String(e.message || e).split('\n')[0]}），且未设置 VERIFY_PLAYWRIGHT`)
    const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
    try {
      return require(target)
    } catch (e2) {
      dieBlocked(`VERIFY_PLAYWRIGHT=${target} 仍解析失败：${String(e2.message || e2).split('\n')[0]}`)
    }
  }
}
function resolveChromium() {
  const p = process.env.VERIFY_CHROMIUM
  if (!p) return null
  const target = isAbsolute(p) ? p : resolve(process.cwd(), p)
  if (!existsSync(target)) dieBlocked(`VERIFY_CHROMIUM 指向的文件不存在：${target}`)
  return target
}
function dieBlocked(msg) {
  fail('deps', msg)
  run.blockedReason = msg
  console.error(`\n${CONFIG_HINT}\n`)
  finalize()
  process.exit(2)
}

const { outDir: outDirArg, base } = parseRunnerArgs()
// 2026-10-09：默认输出走 tempOutDir（项目内 .local/runs/），不再散到系统临时目录
const outDir = outDirArg || tempOutDir('f1')

const { chromium } = resolvePlaywright()
const chromiumExe = resolveChromium()

// ---------------------------------------------------------------------------
// 夹具脚本（受控响应；**不是**原响应回放）
// ---------------------------------------------------------------------------

/**
 * 一份**带阻断项**的草稿：含 emoji → `html.emoji` 阻断（质量模块 v10 零 emoji 铁律），
 * 且 `repairKind` 属于"可改写法修复" → 必然触发一次自动修订。
 * 这正是 `repair-flow-check` 用来进修订环的那条既有触发路径，不是为本卡新造的。
 */
const BAD_V2 = '```v2\n# 周末到馆提醒 🎉\n\n各位读者：\n\n10月10日（周六）9:00-17:00 开放；10月11日（周日）全天闭馆。\n\n咨询电话：010-55556666。\n```'

/** 修订轮回放稿：去掉 emoji，让循环收口（与"依据"无关，只看接线）。 */
const REVISED_V2 = '```v2\n# 周末到馆提醒\n\n各位读者：\n\n10月10日（周六）9:00-17:00 开放；10月11日（周日）全天闭馆。\n\n咨询电话：010-55556666。\n```'

// 两个剧本都走满 **3 次** prep 请求（前两轮取资料、第 3 轮才声明）——这不是为了好看：
// `PREP_LAST_ROUND_REMINDER` 只在 `callNo === MAX_PREP_CALLS - 1`（第 3 次）追加，
// 2 轮的剧本**永远触不到它**，会让"末轮提醒真的发出去了吗"变成空头覆盖（独立复核 2026-10-03 抓到过）。
const PREP_COMPOSE = [
  { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
  { text: null, calls: [{ id: 'k2', name: 'load_knowledge', args: '{"name":"writing-campus"}' }] },
  { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"modify"}' }] },
]
const PREP_CANDIDATE = [
  { text: null, calls: [{ id: 'k1', name: 'load_knowledge', args: '{"name":"engine-write-protocol"}' }] },
  { text: null, calls: [{ id: 'k2', name: 'load_knowledge', args: '{"name":"writing-campus"}' }] },
  {
    text: null,
    calls: [
      {
        id: 'f1',
        name: 'finish_preparation',
        args: JSON.stringify({ outcome: 'candidate', source: BAD_V2.replace(/^```v2\n|\n```$/g, ''), assetPolicy: 'modify' }),
      },
    ],
  },
]

/**
 * G2b 用的既有正式稿：内容**故意**含一条材料未给的规则（"续借不受影响"），
 * 用来核对续改时"权威只指版本"的限定确实随实际消息发给模型（保留原文 ≠ 认证原文事实）。
 */
const PRIOR_SOURCE =
  '# 校园图书馆开放通知\n\n[[asset:art-wide|as-1790955979624508100|开篇横图插画：暖色台灯照亮蓝色书本]]\n\n' +
  '10 月 10 日（周六）9:00–17:00 开放；10 月 11 日（周日）全天闭馆。自习区在一楼，咨询电话 010-55556666。\n\n' +
  '闭馆当天线上查询、续借不受影响。\n'
const PRIOR_DOC = {
  id: 'doc-fixture-prior-1',
  title: '校园图书馆开放通知',
  updated_at: '2026-10-02T15:44:31+08:00',
  source: PRIOR_SOURCE,
  html: '<p>夹具正文</p>',
  warnings: [],
  snapshots: {},
  bindings: [
    { slot: '[[asset:art-wide|as-1790955979624508100|开篇横图插画：暖色台灯照亮蓝色书本]]', slotId: 'slot-0', id: 'as-1790955979624508100', source: 'asset', reason: '夹具' },
  ],
  revision_id: 'rev-fixture-1',
  accepted_revision_id: 'rev-fixture-1',
  generation: 1,
  validation: 'verified',
  quality: null,
  run_id: 'run-fixture-1',
}

const LOCAL_IMAGE = {
  assetId: 'li-' + '1'.repeat(64), name: '活动 原图.png', mime: 'image/png', width: 1, height: 1, byteLength: 68,
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS8AAAAASUVORK5CYII=',
  modelDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS8AAAAASUVORK5CYII=',
}
const LOCAL_REF = `![活动照片](local-image://${LOCAL_IMAGE.assetId})`
const withLocalImage = (source) => source.replace('\n```', `\n\n${LOCAL_REF}\n\`\`\``)
const bareV2 = source => source.replace(/^```v2\n|\n```$/g, '')
const HISTORY_MATERIAL = '历史用户材料：活动由青禾书屋举办，原话“带上自己的书”，没有收费或报名截止要求。'
const OLD_ASSISTANT_NOISE = '旧助手流程噪音_不得作为新一轮审稿指令'
const EDITORIAL_PRIOR = { ...PRIOR_DOC, source: '# 原先的标题\n\n此前正式正文。\n\n' + LOCAL_REF, html: '<section><p>此前正式正文必须保持</p></section>', bindings: [] }
// R33：只为触发真实组装、复核与修订链路的受控草稿，不是文案质量样本。
const PRODUCT_DRAFT = '# 从需求到预览\n\n智序接受自然语言需求。文章生成后，可以在手机宽度预览中查看文案，再通过对话修改。\n\nAI 创作需要联网；成稿可以保存在本机，导出后由用户手动发布。'
const PRODUCT_BAD_V2 = '```v2\n' + PRODUCT_DRAFT.replace('从需求到预览', '从需求到预览 🎉') + '\n```'
const PRODUCT_REVISED_V2 = '```v2\n' + PRODUCT_DRAFT + '\n```'

const CASES = [
  // R36：相同产品关键词不能在本地自动取事实或绕过准备阶段；只有模型实际读取才提供产品背景。
  ...['compose', 'candidate'].map((kind) => ({
    name: `r36-product-keywords-without-knowledge-${kind}`,
    prompt: '写一篇介绍智序的公众号文章。',
    prep: [{ text: null, calls: [{ id: 'product-without-knowledge', name: 'finish_preparation', args: JSON.stringify({
      outcome: kind, assetPolicy: 'preserve',
      ...(kind === 'candidate' ? { source: bareV2(PRODUCT_BAD_V2) } : {}),
    }) }] }],
    write: kind === 'compose' ? PRODUCT_BAD_V2 : null,
    revise: PRODUCT_REVISED_V2,
    productWithoutKnowledge: true,
  })),
  ...['compose', 'candidate'].map((kind) => ({
    name: `r33-product-facts-and-writing-examples-${kind}`,
    prompt: '写一篇介绍智序的公众号文章。',
    prep: [
      { text: null, calls: [
        { id: 'product-facts', name: 'load_knowledge', args: '{"name":"zhixu-product-facts"}' },
        { id: 'writing-example', name: 'load_knowledge', args: '{"name":"writing-purpose"}' },
      ] },
      { text: null, calls: [{ id: 'product-finish', name: 'finish_preparation', args: JSON.stringify({
        outcome: kind, assetPolicy: 'preserve',
        ...(kind === 'candidate' ? { source: bareV2(PRODUCT_BAD_V2) } : {}),
      }) }] },
    ],
    write: kind === 'compose' ? PRODUCT_BAD_V2 : null,
    revise: PRODUCT_REVISED_V2,
    productKnowledge: true,
  })),
  {
    name: 'editorial-ordinary-reply', prompt: '你好，先聊聊。',
    prep: [{ text: null, calls: [{ id: 'reply', name: 'finish_preparation', args: '{"outcome":"reply","text":"你好，可以直接说你的需求。"}' }] }],
    write: null, revise: null, ordinaryReply: true,
  },
  ...['null', 'empty', 'throw', 'hold'].map(fault => ({
    name: `editorial-protocol-${fault}-preserves-prior`, prompt: '只改开头，照片和其它内容保持不动。',
    prep: [PREP_COMPOSE[2]], write: withLocalImage(BAD_V2), revise: withLocalImage(REVISED_V2),
    priorDoc: EDITORIAL_PRIOR, localImage: LOCAL_IMAGE, preloadPrior: true,
    editorialProtocolFault: fault, editorialFailure: fault !== 'hold',
  })),
  {
    name: 'editorial-failure-preserves-prior', prompt: '只把标题改成「读书会预告」，其他内容和照片不动。',
    prep: [{ text: null, calls: [{ id: 'candidate', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: bareV2(withLocalImage(BAD_V2)), assetPolicy: 'preserve' }) }] }],
    write: null, revise: withLocalImage(REVISED_V2), priorDoc: EDITORIAL_PRIOR, localImage: LOCAL_IMAGE,
    preloadPrior: true, editorialError: '隔离测试：复核服务不可用', editorialFailure: true,
  },
  {
    name: 'editorial-missing-material-lock-preserves-prior', prompt: '只改开头，原照片和其他正文保持不动。',
    prep: [{ text: null, calls: [{ id: 'candidate', name: 'finish_preparation', args: JSON.stringify({ outcome: 'candidate', source: bareV2(withLocalImage(BAD_V2)), assetPolicy: 'preserve' }) }] }],
    write: null, revise: withLocalImage(REVISED_V2), priorDoc: EDITORIAL_PRIOR, localImage: LOCAL_IMAGE,
    preloadPrior: true, editorialDropLock: true, editorialFailure: true,
  },
  {
    name: 'editorial-stop-ignores-late-response', prompt: '只改开头，照片和其它内容保持不动。',
    prep: [PREP_COMPOSE[2]], write: withLocalImage(BAD_V2), revise: withLocalImage(REVISED_V2),
    priorDoc: EDITORIAL_PRIOR, localImage: LOCAL_IMAGE, preloadPrior: true, editorialHold: true,
  },
  {
    name: 'editorial-reviewed-source-is-committed', prompt: '写一篇周末到馆提醒。',
    prep: [PREP_CANDIDATE[2]], write: null, revise: REVISED_V2,
    editorialOutput: bareV2(REVISED_V2).replace('周末到馆提醒', '经文案复核的到馆提醒'), editorialReplaces: true,
  },
  {
    name: 'local-image-nine-photo-visual-window',
    prompt: '这篇文章还能继续改吗？', prep: [{ text: null, calls: [{ id: 'reply', name: 'finish_preparation', args: '{"outcome":"reply","text":"可以继续修改，原图引用仍保留。"}' }] }], write: null, revise: null, imageWindow: true,
    priorDoc: { ...PRIOR_DOC, source: '# 已有多图文章\n\n' + Array.from({ length: 9 }, (_, i) => `![图](local-image://li-${String(i + 1).repeat(64)})`).join('\n\n') },
  },
  {
    name: 'local-image-import-lock-then-clear',
    prompt: '帮我写一篇周末到馆提醒的通知。', prep: PREP_COMPOSE,
    write: BAD_V2, revise: REVISED_V2, clearAfterImportImage: LOCAL_IMAGE,
  },
  {
    name: 'candidate-first-turn-then-revise',
    prompt: '帮我写一篇周末到馆提醒的通知，直接出稿。',
    prep: [PREP_CANDIDATE[2]],
    write: null,
    revise: REVISED_V2,
  },
  {
    name: 'compose-name-only-digest',
    prompt: '帮我写一篇周末到馆提醒的通知。',
    prep: [
      { text: null, calls: [{ id: 'k1', name: 'search_knowledge', args: '{"query":"engine-write-protocol"}' }] },
      PREP_COMPOSE[1],
      PREP_COMPOSE[2],
    ],
    write: BAD_V2,
    revise: REVISED_V2,
    nameOnlyDigest: true,
  },
  {
    name: 'compose-write-and-revise',
    prompt: '帮我写一篇周末到馆提醒的通知。',
    prep: PREP_COMPOSE,
    write: BAD_V2,
    revise: REVISED_V2,
  },
  {
    name: 'candidate-then-revise',
    prompt: '帮我写一篇周末到馆提醒的通知，直接出稿。',
    prep: PREP_CANDIDATE,
    write: null, // candidate 路径不发起撰写
    revise: REVISED_V2,
  },
  {
    name: 'local-image-prior-document',
    prompt: '只改标题，照片保持原样。',
    prep: [PREP_COMPOSE[0], PREP_COMPOSE[1], { text: null, calls: [{ id: 'f1', name: 'finish_preparation', args: '{"outcome":"compose","assetPolicy":"preserve"}' }] }],
    write: withLocalImage(BAD_V2), revise: withLocalImage(REVISED_V2),
    priorDoc: { ...PRIOR_DOC, source: '```v2\n' + PRIOR_SOURCE + '\n' + LOCAL_REF + '\n```' },
    localImage: LOCAL_IMAGE,
  },
  {
    name: 'local-image-tool-import-callback',
    prompt: '用这张本地照片写活动回顾：C:\\照片 空格\\活动 原图.png',
    prep: [
      { text: null, calls: [{ id: 'im1', name: 'read_local_image', args: JSON.stringify({ path: 'C:\\照片 空格\\活动 原图.png' }) }] },
      PREP_COMPOSE[0], PREP_COMPOSE[2],
    ],
    write: withLocalImage(BAD_V2), revise: withLocalImage(REVISED_V2),
    localImage: LOCAL_IMAGE, importedImage: true,
  },
  {
    // G2b：已有 accepted 正式稿 + 用户**只改标题**。核对的是"续改实参里带没带
    // ① 当前正式稿本身 ② 权威只指版本的限定 ③ 素材保持约束"。
    name: 'prior-doc-title-only',
    prompt: '只把标题改成「冬季开馆时间调整」，其他内容一律不动。',
    prep: PREP_COMPOSE,
    write: BAD_V2,
    revise: REVISED_V2,
    priorDoc: PRIOR_DOC,
  },
]
run.plannedCases = CASES.map((c) => c.name)

/** 注入到 chat.ts 末尾的替身：只替换 Rust 侧通道，App 组装一行不改。 */
function stubSource(c) {
  return `
// ---- F1 夹具注入（仅测试）：把 Tauri 通道换成受控替身 ----
;(function () {
  const w = window
  w.__wxmp = { calls: [], prep: ${JSON.stringify(c.prep)}, write: ${JSON.stringify(c.write)}, revise: ${JSON.stringify(c.revise)}, openDoc: ${JSON.stringify(c.priorDoc ?? null)}, events: {} }
  let cbSeq = 0
  let evSeq = 0
  const handlers = {}
  // **必须在调用时刻深拷贝**：runPrep 传进来的 convo 是**同一个数组引用**，它在后续轮次里还会被 push
  // 工具结果——按引用存下来，读回的"第 1 次请求"其实是最后一次的最终形态（三份记录逐字节相同）。
  // 独立复核 2026-10-03 抓到过这一点：那样记录的实参**不是**当时真正发出去的那份。
  const call = (cmd, args) => {
    let snap = null
    try { snap = args === undefined ? null : JSON.parse(JSON.stringify(args)) } catch (e) { snap = { __unserializable: String(e) } }
    w.__wxmp.calls.push({ cmd, args: snap })
    return args
  }
  const SVGSAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200"><rect width="640" height="200" fill="#e8e2d6"/><circle cx="160" cy="100" r="52" fill="#c8a06a"/><text x="240" y="112" font-size="28" fill="#3b3630">FIXTURE</text></svg>'
  const emitDelta = (runId, delta) => {
    const all = Object.values(handlers).filter((x) => x.event === 'chat-delta')
    w.__wxmp.emitProbe = (w.__wxmp.emitProbe || []).concat([{ listeners: all.length }])
    const h = all[all.length - 1]
    if (!h) return false
    const fn = w['_' + h.handlerId]
    if (typeof fn !== 'function') return false
    fn({ event: 'chat-delta', id: h.eventId, payload: { runId: runId ?? null, delta } })
    return true
  }
  const invoke = async (cmd, args) => {
    call(cmd, args)
    if (cmd === 'plugin:event|listen') {
      const eventId = ++evSeq
      handlers[eventId] = { event: args && args.event, handlerId: args && args.handler, eventId }
      return eventId
    }
    if (cmd === 'plugin:event|unlisten') return null
    if (cmd === 'prep_turn') {
      const n = w.__wxmp.calls.filter((x) => x.cmd === 'prep_turn').length
      return w.__wxmp.prep[Math.min(n - 1, w.__wxmp.prep.length - 1)]
    }
    if (cmd === 'editorial_review') {
      const last = String(args.messages.at(-1)?.content || '')
      const input = JSON.parse(last.slice(last.indexOf(String.fromCharCode(10)) + 1))
      if (${Boolean(c.editorialHold)}) await new Promise(resolve => { w.__releaseEditorial = resolve })
      if (${Boolean(c.editorialError)}) throw new Error(${JSON.stringify(c.editorialError || '')})
      w.__wxmp.editorialResolved = true
      // Keep intentional emoji blockers: the reviewer fixture is identity, not a
      // shortcut that hides whether App still runs the original REVISE pipeline.
      // The fixture copies the actual locked source. The negative case removes
      // one received lock and must fail in production restoration before saving.
      let reviewed = ${JSON.stringify(c.editorialOutput ?? null)} ?? input.source
      if (${Boolean(c.editorialDropLock)}) reviewed = reviewed.replace(input.immutableMaterials[0].marker, '')
      return ${JSON.stringify('```v2\n')} + reviewed + ${JSON.stringify('\n```')}
    }
    if (cmd === 'chat_stream') {
      const turn = (args && args.turn) || 'chat'
      const body = turn === 'revise' ? w.__wxmp.revise : turn === 'write' ? w.__wxmp.write : null
      w.__wxmp.streamTurns = (w.__wxmp.streamTurns || []).concat([turn])
      if (body) {
        // 分两段回放：真实流式也是多段增量
        emitDelta(args && args.runId, body.slice(0, Math.ceil(body.length / 2)))
        emitDelta(args && args.runId, body.slice(Math.ceil(body.length / 2)))
      }
      return null
    }
    switch (cmd) {
      case 'cancel_run':
      case 'cancel_reset':
      case 'trace_start':
      case 'trace_write':
      case 'rename_session':
      case 'delete_document':
      case 'delete_asset':
      case 'save_settings':
      case 'open_manual':
        return null
      case 'list_sessions': return ${c.preloadPrior ? JSON.stringify({ items: [{ id: 's-fixture-0001', title: '已有推文', updated_at: '', count: 2 }], current: 's-fixture-0001' }) : '{ items: [] }'}
      case 'create_session': return 's-fixture-0001'
      case 'open_session': return ${c.preloadPrior ? JSON.stringify({ id: 's-fixture-0001', title: '已有推文', updated_at: '', mode: 'auto', style: 'auto', messages: [{ id: 901, role: 'user', content: HISTORY_MATERIAL }, { id: 902, role: 'assistant', content: OLD_ASSISTANT_NOISE }] }) : 'null'}
      case 'save_session': return { ok: true }
      case 'delete_session': return { items: [] }
      case 'list_documents': return { items: [] }
      case 'open_document': return w.__wxmp.openDoc || null
      case 'save_document': return w.__wxmp.saveDocResult || null
      case 'load_settings':
        return { api_key: '', base_url: '', model: '', wx_appid: null, wx_secret: null, model_vision: null, vision_review: null, load_error: null }
      case 'model_lock_state': return { locked: false, model: '' }
      case 'list_assets_report': return { items: [] }
      case 'search_assets': return { items: [] }
      case 'get_asset': return null
      case 'get_local_image': return ${c.imageWindow ? `{...${JSON.stringify(LOCAL_IMAGE)},assetId:args.assetId,name:'已保存原图'}` : JSON.stringify(c.localImage ?? c.clearAfterImportImage ?? null)}
      case 'import_local_image':
        if (w.__holdImport) await new Promise((resolve) => { w.__releaseImport = resolve })
        return ${JSON.stringify(c.localImage ?? c.clearAfterImportImage ?? null)}
      case 'add_asset': return { id: 'as-fixture' }
      case 'review_assets': return { ok: false, reason: '夹具：不做视觉复核' }
      case 'gen_svg': return SVGSAMPLE
      case 'export_html': return 'C:/fixture/out.html'
      case 'export_images': return 'C:/fixture/out.png'
      default: return null
    }
  }
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
  w.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback: (cb, once) => { const id = ++cbSeq; w['_' + id] = (p) => { if (once) delete w['_' + id]; cb(p) }; return id },
    convertFileSrc: (p) => p,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  }
})();
`
}

/** 只在作者已交稿后模拟加载失败或迟到返回，前面的准备/撰写使用真实完整协议。 */
function protocolLoaderStub(c) {
  return `
const fixtureLoadEngineProtocol = loadEngineProtocol;
loadEngineProtocol = async function () {
  const protocol = await fixtureLoadEngineProtocol();
  const state = window.__wxmp;
  if (!state?.streamTurns?.includes('write')) return protocol;
  state.editorialProtocolRead = true;
  if (${c.editorialProtocolFault === 'hold'}) {
    await new Promise(resolve => { window.__releaseEditorialProtocol = resolve });
    state.editorialProtocolResolved = true;
    return protocol;
  }
  if (${c.editorialProtocolFault === 'throw'}) throw new Error('隔离测试：排版引擎协议读取失败');
  return ${c.editorialProtocolFault === 'null' ? 'null' : JSON.stringify('  \n')};
};
`
}

// ---------------------------------------------------------------------------
// 执行
// ---------------------------------------------------------------------------
let browser = null
const collected = []
try {
  browser = await chromium.launch({ headless: true, ...(chromiumExe ? { executablePath: chromiumExe } : {}) })
  for (const c of CASES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    const offsite = []
    await page.route('**/*', async (route) => {
      const u = route.request().url()
      if (u.startsWith(base + '/') || u.startsWith('data:') || u.startsWith('blob:')) return route.fallback()
      offsite.push(u)
      return route.abort('blockedbyclient')
    })
    await page.route('**/src/lib/chat.ts*', async (route) => {
      const response = await route.fetch()
      const actual = await response.text()
      await route.fulfill({ response, body: actual + stubSource(c), contentType: 'application/javascript' })
    })
    if (c.editorialProtocolFault) await page.route('**/src/lib/retrieval.ts*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + protocolLoaderStub(c), contentType: 'application/javascript' })
    })
    let turns = 0
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('.chat-input-row textarea', { timeout: 30000 })
      if (c.preloadPrior) await page.waitForFunction(() => document.querySelector('.preview-pane iframe')?.contentDocument?.body?.textContent?.includes('此前正式正文必须保持'), null, { timeout: 10000 })
      await page.locator('.chat-input-row textarea').fill(c.prompt)
      await page.locator('.chat-input-row textarea').press('Enter')
      // 等本回合收口：busy 气泡消失且不再有新调用
      await page.waitForFunction(() => (window.__wxmp || {}).calls && window.__wxmp.calls.length > 0, null, { timeout: 60000 })
      if (c.editorialHold) {
        await page.waitForFunction(() => typeof window.__releaseEditorial === 'function', null, { timeout: 20000 })
        await page.waitForFunction(() => document.body.innerText.includes('复核文案的内容、表达与事实'), null, { timeout: 5000 })
        await page.evaluate(() => { window.__wxmp.editorialProgress = document.body.innerText })
        await page.locator('.btn-stop').click()
        await page.waitForFunction(() => !document.querySelector('.btn-stop'))
        await page.evaluate(() => { window.__wxmp.afterStopCallCount = window.__wxmp.calls.length; window.__releaseEditorial() })
        await page.waitForFunction(() => window.__wxmp.editorialResolved === true)
      }
      if (c.editorialProtocolFault === 'hold') {
        await page.waitForFunction(() => typeof window.__releaseEditorialProtocol === 'function', null, { timeout: 20000 })
        await page.locator('.btn-stop').click()
        await page.waitForFunction(() => !document.querySelector('.btn-stop'))
        await page.evaluate(() => { window.__wxmp.afterStopCallCount = window.__wxmp.calls.length; window.__releaseEditorialProtocol() })
        await page.waitForFunction(() => window.__wxmp.editorialProtocolResolved === true)
      }
      await page.waitForFunction(() => !document.querySelector('.chat-input-row textarea[disabled]'), null, { timeout: 120000 })
      await page.waitForTimeout(1200)
      if (c.clearAfterImportImage) {
        const clearDialogs = []
        let allowClear = false
        const handleClearDialog = async (dialog) => {
          clearDialogs.push(dialog.message())
          if (allowClear) await dialog.accept()
          else await dialog.dismiss()
        }
        page.on('dialog', handleClearDialog)
        await page.locator('.chat-input-row textarea').fill('原图保存后再继续修改这篇文章')
        await page.evaluate(() => {
          const calls = window.__wxmp.calls
          window.__wxmp.importClear = { before: {
            sessionId: calls.filter(call => call.cmd === 'save_session').at(-1)?.args.id,
            callCount: calls.length,
            chatText: document.querySelector('.chat-body').textContent,
            draft: document.querySelector('.chat-input-row textarea').value,
            preview: document.querySelector('.preview-pane iframe')?.contentDocument?.body?.textContent || '',
          } }
          window.__holdImport = true
        })
        await page.locator('input[type=file]').setInputFiles({ name: '等待中的照片.png', mimeType: 'image/png', buffer: Buffer.from(c.clearAfterImportImage.dataUrl.split(',')[1], 'base64') })
        await page.waitForFunction(() => typeof window.__releaseImport === 'function')
        const clearDisabled = await page.locator('[data-act="clear"]').isDisabled()
        // HTMLElement.click() 尊重真实 disabled，不强行穿透禁用控件或调用内部处理函数。
        await page.locator('[data-act="clear"]').evaluate((button) => button.click())
        await page.locator('.chat-input-row textarea').press('Enter')
        await page.waitForTimeout(100)
        await page.evaluate((held) => { window.__wxmp.importClear.held = held }, { clearDisabled, dialogCount: clearDialogs.length })
        await page.evaluate(() => { window.__holdImport = false; window.__releaseImport() })
        await page.waitForFunction(() => document.querySelectorAll('.chat-pane > .attach-strip .attach-chip').length === 1 && !document.querySelector('[data-act="clear"]').disabled)
        await page.evaluate(() => {
          const state = window.__wxmp.importClear
          const sinceImport = window.__wxmp.calls.slice(state.before.callCount)
          const image = document.querySelector('.chat-pane > .attach-strip img')
          state.completed = {
            chatText: document.querySelector('.chat-body').textContent,
            draft: document.querySelector('.chat-input-row textarea').value,
            preview: document.querySelector('.preview-pane iframe')?.contentDocument?.body?.textContent || '',
            imageName: image?.alt, imageData: image?.getAttribute('src'),
            disruptiveCalls: sinceImport.filter(call => ['create_session', 'open_session', 'delete_session', 'delete_document', 'prep_turn', 'chat_stream'].includes(call.cmd)).map(call => call.cmd),
            clearedSession: sinceImport.some(call => call.cmd === 'save_session' && call.args.messages.length === 0),
          }
        })
        allowClear = true
        await page.locator('[data-act="clear"]').click()
        await page.locator('.chat-empty').waitFor()
        await page.waitForTimeout(1200)
        await page.evaluate((dialogs) => {
          const state = window.__wxmp.importClear
          state.after = { dialogs, finalSave: window.__wxmp.calls.filter(call => call.cmd === 'save_session').at(-1)?.args,
            attachedCount: document.querySelectorAll('.chat-pane > .attach-strip .attach-chip').length,
            empty: !!document.querySelector('.chat-empty'), previewCount: document.querySelectorAll('.preview-pane iframe').length }
        }, clearDialogs)
        page.off('dialog', handleClearDialog)
      }
      turns = await page.evaluate(() => window.__wxmp.calls.filter((x) => x.cmd === 'chat_stream').length)
    } catch (e) {
      fail(`case:${c.name}:drive`, String(e.message || e).split('\n')[0])
    }
    const snap = await page
      .evaluate(() => {
        const calls = window.__wxmp ? window.__wxmp.calls : []
        const streams = calls.filter((x) => x.cmd === 'chat_stream')
        const preps = calls.filter((x) => x.cmd === 'prep_turn')
        const slim = (m) => ({
          role: m.role,
          text: String(m.content || ''),
          images: Array.isArray(m.images) ? m.images.length : 0,
          imageData: Array.isArray(m.images) ? m.images : [],
        })
        return {
          prepSends: preps.map((p) => ({ count: (p.args.messages || []).length, messages: (p.args.messages || []).map(slim) })),
          prepRunIds: preps.map(p => p.args.runId),
          streams: streams.map((s) => ({ turn: s.args.turn, messages: (s.args.messages || []).map(slim) })),
          editorials: calls.filter((x) => x.cmd === 'editorial_review').map(x => ({ runId: x.args.runId, messages: (x.args.messages || []).map(slim) })),
          streamTurns: window.__wxmp.streamTurns || [],
          cmds: Array.from(new Set(calls.map((x) => x.cmd))).sort(),
          documentSends: calls.filter((x) => x.cmd === 'save_document').map((x) => x.args),
          sessionSends: calls.filter((x) => x.cmd === 'save_session').map((x) => x.args),
          imageReads: calls.filter((x) => x.cmd === 'get_local_image').map((x) => x.args.assetId),
          attachedCount: document.querySelectorAll('.chat-pane > .attach-strip .attach-chip').length,
          importClear: window.__wxmp.importClear || null,
          previewText: document.querySelector('.preview-pane iframe')?.contentDocument?.body?.textContent || '',
          bodyText: document.body.innerText,
          docState: document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state'),
          returnedDoc: window.__wxmp.openDoc,
          editorialResolved: window.__wxmp.editorialResolved || false,
          editorialProgress: window.__wxmp.editorialProgress || '',
          editorialProtocolRead: window.__wxmp.editorialProtocolRead || false,
          editorialProtocolResolved: window.__wxmp.editorialProtocolResolved || false,
          afterStopSaves: window.__wxmp.afterStopCallCount === undefined ? null : calls.slice(window.__wxmp.afterStopCallCount).filter(x => x.cmd === 'save_document').length,
        }
      })
      .catch((e) => ({ error: String(e) }))
    collected.push({ name: c.name, snap, pageErrors, offsite, turns })
    await context.close().catch(() => {})
  }
} catch (e) {
  fail('runner', String(e && e.stack ? e.stack.split('\n')[0] : e))
} finally {
  mkdirSync(outDir, { recursive: true })
  writeFileAtomic(join(outDir, 'raw.json'), JSON.stringify({ run, collected }, null, 2) + '\n')
  if (browser) await browser.close().catch(() => {})
}

// ---------------------------------------------------------------------------
// 断言
// ---------------------------------------------------------------------------
const has = (s, sub) => String(s || '').includes(sub)
const allText = (msgs) => (msgs || []).map((m) => m.text).join('\n\u0000\n')
const systemText = (msgs) => ((msgs || []).find((m) => m.role === 'system') || {}).text || ''
/**
 * **最后一条消息**＝ App 各入口**追加**的那段指令（WRITE 的 digest+撰写指令、REVISE 的修订清单）。
 * 断言必须打在这一条上：system 里本来就有共同规则，用 `allText` 会让"追加指令漏接"被 system 盖过去——
 * 那正是本卡要防的"规则写在文件里、忘了接进实际发出的消息"。
 */
const lastText = (msgs) => {
  const a = msgs || []
  return a.length ? a[a.length - 1].text : ''
}
/** 找出**包含着某个识别串的那条消息**（用于把断言钉在特定消息上，而不是整串文本） */
const pickMsg = (msgs, sub) => (msgs || []).find((m) => has(m.text, sub)) || null

if (!run.errors.length && collected.length === CASES.length) {
  for (const [i, c] of CASES.entries()) {
    const r = collected[i]
    const label = c.name
    run.executedCases.push(label)
    console.log(`\n[${label}] cmds=${JSON.stringify((r.snap || {}).cmds || (r.snap || {}).error)} streamTurns=${JSON.stringify((r.snap || {}).streamTurns || [])}`)
    check(`${label}：页面无异常`, r.pageErrors.length === 0, r.pageErrors.join(' / '))
    check(`${label}：没有外链请求`, r.offsite.length === 0, r.offsite.join(' / '))
    const editorialCalls = r.snap.editorials || []
    // These are actual App transport arguments, including the technical repair path.
    // This checks delivery of the rule; it makes no claim about prose quality.
    const languageSends = [...(r.snap.prepSends || []).map(send => ({ phase: 'prep', send })), ...(r.snap.streams || []).map(send => ({ phase: send.turn, send })), ...editorialCalls.map(send => ({ phase: 'editorial', send }))]
    check(`${label}：实际准备、撰写、复核和排版修订请求各收到一份完整语言规则`, LANGUAGE_COMPOSITION_RULE.trim().length > 0 && languageSends.length > 0 && languageSends.every(({ send }) => systemText(send.messages).split(LANGUAGE_COMPOSITION_RULE).length === 2), languageSends.map(({ phase, send }) => `${phase}:${systemText(send.messages).split(LANGUAGE_COMPOSITION_RULE).length - 1}`).join(', '))
    check(`${label}：实际准备、撰写、复核和排版修订共享一份完整材料依据边界`, MATERIAL_GROUNDING_RULE.trim().length > 0 && languageSends.length > 0 && languageSends.every(({ send }) => systemText(send.messages).split(MATERIAL_GROUNDING_RULE).length === 2), languageSends.map(({ phase, send }) => `${phase}:${systemText(send.messages).split(MATERIAL_GROUNDING_RULE).length - 1}`).join(', '))
    check(`${label}：实际准备、撰写、复核和修订共享一次用户底稿权限`, MANUSCRIPT_EDIT_RULE.trim().length > 0 && languageSends.length > 0 && languageSends.every(({ send }) => systemText(send.messages).split(MANUSCRIPT_EDIT_RULE).length === 2), languageSends.map(({ phase, send }) => `${phase}:${systemText(send.messages).split(MANUSCRIPT_EDIT_RULE).length - 1}`).join(', '))
    if (c.priorDoc) {
      const writingSends = (r.snap.streams || []).filter(send => send.turn === 'write')
      const repairs = (r.snap.streams || []).filter(send => send.turn === 'revise')
      check(`${label}：语言规则不覆盖实际续改与修订的局部权限`, writingSends.every(send => lastText(send.messages).includes('只改他指出的那处') && lastText(send.messages).includes('逐字保留')) && repairs.every(send => lastText(send.messages).includes('只改问题所指的地方') && lastText(send.messages).includes('其余内容逐字保留')) && editorialCalls.every(send => systemText(send.messages).includes('只改开头或指定段落时，其余正文逐字恢复或保留 priorSource')))
    }
    if (c.ordinaryReply || c.imageWindow) {
      check(`${label}：普通回复不触发文案复核`, editorialCalls.length === 0)
      if (c.ordinaryReply) {
        check(`${label}：普通回复不写正文或文档`, r.snap.streams.length === 0 && r.snap.documentSends.length === 0)
        check(`${label}：普通回复确实展示`, has(r.snap.bodyText, '你好，可以直接说你的需求。'))
        continue
      }
    } else if (c.editorialProtocolFault) {
      check(`${label}：已实际尝试加载复核协议，缺失或取消后不发起审稿请求`, r.snap.editorialProtocolRead && editorialCalls.length === 0)
      if (c.editorialProtocolFault !== 'hold') check(`${label}：明确报告协议不可用`, has(r.snap.bodyText, '排版引擎协议'))
    } else {
      check(`${label}：创作正文只进行一次独立复核`, editorialCalls.length === 1, `次数=${editorialCalls.length}`)
      const review = editorialCalls[0]
      if (review) {
        let input = null
        try { const text = lastText(review.messages); input = JSON.parse(text.slice(text.indexOf('\n') + 1)) } catch {}
        const declared = c.prep.flatMap(p => p.calls || []).filter(call => call.name === 'finish_preparation').map(call => JSON.parse(call.args)).find(x => x.outcome === 'candidate')
        const expectedSource = c.write ? bareV2(c.write) : declared?.source
        // Independent transport readback, not the production restoration helper:
        // each listed literal replaces only its actual short marker. The App's
        // own guard and final saved source are checked separately below.
        const materials = Array.isArray(input?.immutableMaterials) ? input.immutableMaterials : []
        const unlock = text => typeof text === 'string' ? materials.reduce((value, item) => value.replaceAll(item.marker, item.original), text) : text
        check(`${label}：复核收到本次原始需求和仅锁定素材的实际初稿`, input?.request === c.prompt && unlock(input?.source) === expectedSource)
        check(`${label}：复核前稿通过相同素材映射精确绑定当前正式源文`, unlock(input?.priorSource) === (c.priorDoc?.source ?? null))
        check(`${label}：锁清单逐项保留原材料且候选每个短锁恰好一次`, Array.isArray(input?.immutableMaterials) && new Set(materials.map(item => item.marker)).size === materials.length && materials.every(item => typeof item.original === 'string' && item.original.length > 0 && typeof item.marker === 'string' && item.marker.length < 40 && input.source.split(item.marker).length === 2))
        check(`${label}：复核与准备请求绑定同一运行ID`, Boolean(review.runId) && review.runId === r.snap.prepRunIds?.[0])
        const reviewText = allText(review.messages)
        const prepSystem = systemText(r.snap.prepSends[0]?.messages)
        const authoredSystems = [...r.snap.prepSends.map(send => systemText(send.messages)), ...r.snap.streams.filter(send => send.turn === 'write').map(send => systemText(send.messages))]
        check(`${label}：实际准备、撰写和唯一复核共享同一份完整编辑标准`, EDITORIAL_QUALITY_RULE.trim().length > 0 && [...authoredSystems, systemText(review.messages)].every(text => text.split(EDITORIAL_QUALITY_RULE).length === 2))
        check(`${label}：唯一复核在系统消息及整次请求中恰好携带一份完整可信协议`, systemText(review.messages).split(ENGINE_PROTOCOL).length - 1 === 1 && review.messages.reduce((count, message) => count + message.text.split(ENGINE_PROTOCOL).length - 1, 0) === 1)
        check(`${label}：复核协议仅作系统排版语法，不提供事实或固定篇章结构`, ['系统排版语法', '只决定语法与样式，不决定本稿事实', '示例不是本次事实，也不要求固定篇章结构', '本次修改权限和输出形式仍以上方审稿要求为准'].every(text => systemText(review.messages).includes(text)))
        check(`${label}：复核没有携带完整旧人设或旧助手流程噪音`, (!prepSystem || !reviewText.includes(prepSystem.slice(0, 600))) && !reviewText.includes(OLD_ASSISTANT_NOISE))
        const backgrounds = review.messages.slice(1, -1).map(message => { try { return JSON.parse(message.text.slice(message.text.indexOf('\n') + 1)) } catch { return null } })
        check(`${label}：完整协议没有混入事实背景，无关写作规范不进入复核`, !backgrounds.some(message => String(message?.content || '').includes(ENGINE_PROTOCOL)) && !reviewText.includes(WRITING_EXCERPT))
        if (c.productKnowledge) {
          check(`${label}：实际取用后复核保留完整产品事实及仅限本产品的依据身份`, backgrounds.filter(message => message?.originalRole === 'user' && message.content === '本应用已核实产品事实（仅在文中涉及本产品时作为事实依据）：\n' + PRODUCT_FACTS).length === 1)
          check(`${label}：复核没有把写作规范工具结果冒充事实背景`, !backgrounds.some(message => String(message?.content || '').includes(WRITING_EXCERPT)))
        } else {
          check(`${label}：未取用产品事实时复核不注入完整产品材料或其背景身份`, !reviewText.includes(PRODUCT_FACTS) && !backgrounds.some(message => String(message?.content || '').includes('本应用已核实产品事实')))
        }
        if (c.preloadPrior) {
          check(`${label}：历史用户原材料逐字保留`, backgrounds.some(message => message?.originalRole === 'user' && message.content === HISTORY_MATERIAL))
        }
        if (c.localImage) {
          check(`${label}：复核收到原图稳定引用及准确视觉副本`, reviewText.includes(c.localImage.assetId) && review.messages.some(message => message.imageData.includes(c.localImage.modelDataUrl)))
          check(`${label}：实际正文原图只以短锁运输，精确说明与URI留在不可变清单`, materials.some(item => item.original === LOCAL_REF) && !input.source.includes('local-image://' + c.localImage.assetId))
        }
      }
    }
    if (c.editorialFailure || c.editorialHold || c.editorialProtocolFault) {
      check(`${label}：复核未完成不提交任何文稿`, r.snap.documentSends.length === 0)
      check(`${label}：原正式稿与图片源文没有被改写`, JSON.stringify(r.snap.returnedDoc) === JSON.stringify(c.priorDoc))
      check(`${label}：预览仍显示已有正式稿`, r.snap.previewText.trim() === '此前正式正文必须保持', r.snap.previewText.slice(0, 120))
      check(`${label}：复核失败或停止不进入素材生成和自动修订`, !r.snap.cmds.includes('gen_svg') && !r.snap.streams.some(stream => stream.turn === 'revise'))
      if (c.editorialFailure) check(`${label}：失败透明告知且初稿保留在记录`, has(r.snap.bodyText, '文案复核未完成') && r.snap.sessionSends.some(send => (send.messages || []).some(message => has(message.content, '周末到馆提醒') && has(message.content, '文案复核未完成'))))
      if (c.editorialHold) {
        check(`${label}：复核进度准确说明内容、表达与事实三个目标`, has(r.snap.editorialProgress, '复核文案的内容、表达与事实'))
        check(`${label}：停止确实取消本回合`, r.snap.cmds.includes('cancel_run'))
        check(`${label}：迟到复核成功响应没有继续落盘`, r.snap.editorialResolved && r.snap.afterStopSaves === 0)
      }
      if (c.editorialProtocolFault === 'hold') check(`${label}：停止确实取消本回合，迟到协议不再发起复核或落盘`, r.snap.cmds.includes('cancel_run') && r.snap.editorialProtocolResolved && editorialCalls.length === 0 && r.snap.afterStopSaves === 0)
      continue
    }
    if (c.editorialReplaces) {
      check(`${label}：复核后的实际正文提交文档`, r.snap.documentSends.some(send => send.source === c.editorialOutput && !send.asDraft))
      check(`${label}：已修正初稿不再触发机械修订`, !r.snap.streams.some(stream => stream.turn === 'revise'))
      continue
    }
    if (c.imageWindow) {
      check(`${label}：九图旧稿仍能发起正常模型请求`, r.snap.prepSends.length === 1)
      const first = r.snap.prepSends[0]?.messages || []
      check(`${label}：实际每次请求只带八张视觉副本`, first.reduce((count, message) => count + message.images, 0) === 8 && r.snap.imageReads.length === 8)
      check(`${label}：第九张原图完整引用及未看图说明仍在`, allText(first).includes('li-' + '9'.repeat(64)) && allText(first).includes('本次未附视觉副本的原图清单'))
      check(`${label}：传输窗口不删除或改写已有文章`, r.snap.documentSends.length === 0)
      continue
    }
    if (c.clearAfterImportImage) {
      const state = r.snap.importClear
      check(`${label}：原图导入中清空禁用且不弹确认`, state?.held.clearDisabled === true && state.held.dialogCount === 0)
      check(`${label}：导入完成前没有清空、切会话或额外模型请求`, state?.completed.disruptiveCalls.length === 0 && state.completed.clearedSession === false)
      check(`${label}：原图保存完成后消息、草稿和既有成稿原样保留`, Boolean(state?.before.preview) && state.completed.chatText === state.before.chatText && state.completed.draft === state.before.draft && state.completed.preview === state.before.preview)
      check(`${label}：完成的原图实际回填当前消息附件`, state?.completed.imageName === c.clearAfterImportImage.name && state.completed.imageData === c.clearAfterImportImage.modelDataUrl)
      check(`${label}：导入完成后才确认清空原会话`, Boolean(state?.before.sessionId) && state.after.dialogs.length === 1 && state.after.dialogs[0].includes('清空') && state.after.finalSave?.id === state.before.sessionId && state.after.finalSave.messages.length === 0)
      check(`${label}：确认清空后没有迟到附件或残留成稿`, state?.after.empty === true && state.after.attachedCount === 0 && state.after.previewCount === 0 && r.snap.attachedCount === 0)
    }
    check(`${label}：本回合真的跑起来了（有 prep 往返）`, (r.snap.prepSends || []).length > 0, `prep 往返 ${(r.snap.prepSends || []).length} 次`)

    // prep 普通轮与末轮都在实参里带上共同依据规则。
    // ⚠️ 这里的第二条断言**必须钉在 PREP_INSTRUCTION 那条消息上**，不能用整串文本：
    // system 里本来就有共同规则（persona 展开），用整串会让这 6 条变成恒真、抓不住"prep 指令漏接"。
    const prepSends = r.snap.prepSends || []
    for (const [n, p] of prepSends.entries()) {
      const instr = pickMsg(p.messages, MARK.prepInstruction)
      check(`${label}：prep 第 ${n + 1} 次请求的系统提示含共同依据规则`, has(systemText(p.messages), MARK.ground), `system 长度 ${systemText(p.messages).length}`)
      check(`${label}：prep 第 ${n + 1} 次请求的指令消息本身含依据边界`, Boolean(instr) && has(instr.text, MARK.ground), instr ? `指令长度 ${instr.text.length}` : '没找到指令消息')
      check(`${label}：prep 第 ${n + 1} 次实际请求包含引擎协议全文`, (p.messages || []).some((m) => has(m.text, ENGINE_PROTOCOL)), `协议 ${ENGINE_PROTOCOL.length} 字符`)
    }
    // 末轮：预算提醒**真的随最后一次请求发出**，且带上了依据边界；
    // 前面的请求不得出现它（否则就变成"每轮都在催"）。
    {
      const counts = prepSends.map((p) => (p.messages || []).filter((m) => has(m.text, MARK.prepLastRound)).length)
      const expected = counts.map((_, i) => (i === 2 ? 1 : 0))
      check(
        `${label}：预算提醒只出现在第三次 prep 请求（共 ${prepSends.length} 次往返）`,
        prepSends.length === c.prep.length && JSON.stringify(counts) === JSON.stringify(expected),
        `各次提醒条数=${JSON.stringify(counts)}，期望=${JSON.stringify(expected)}`,
      )
      const lastReminder = pickMsg((prepSends[prepSends.length - 1] || {}).messages, MARK.prepLastRound)
      if (prepSends.length === 3) {
        check(`${label}：末轮提醒里也写了依据边界（时间紧不补事实）`, Boolean(lastReminder) && has(lastReminder.text, MARK.prepLastRoundGround), lastReminder ? `提醒长度 ${lastReminder.text.length}` : '没找到提醒')
      } else {
        check(`${label}：提前结束的 prep 没有伪造末轮提醒`, !lastReminder)
      }
    }

    // G3 过度阻断对照：共同规则必须是"生成合同"，不能退化成关键词封禁。
    // 边界（如实标注）：这仍是**文本层**的对照——它证明规则本身没有过度阻断口径，
    // **不证明**模型在正向材料下真的会保留承诺（那是语义，本轮未验）。
    {
      const sys0 = systemText((prepSends[0] || {}).messages)
      const hit = MARK.g3KeywordHack.filter((w) => has(sys0, w))
      check(`${label}：共同规则保留了正向授权（连接语与普通建议照常写）`, has(sys0, MARK.g3PositiveAllowed), '')
      check(`${label}：共同规则不是"见到承诺就删/封"式口径（查一组措辞）`, hit.length === 0, `命中=${JSON.stringify(hit)}`)
      check(`${label}：共同规则明确不要为缺项反复追问`, has(sys0, MARK.g3NoEndlessAsking), '')
      check(`${label}：共同规则允许省略非必要缺项（不是"缺任何字段都不成稿"）`, has(sys0, MARK.g3OmitAllowed), '')
    }

    // 续改（G2b）：正式稿回读、权威范围限定、素材保持约束都在**实际消息**里
    if (c.priorDoc) {
      const prepSys = systemText(((r.snap.prepSends || [])[0] || {}).messages)
      check(`${label}：续改实参带上了当前正式稿`, has(prepSys, MARK.priorDocHeading) && has(prepSys, c.priorDoc.source.split('\n')[0]), '')
      check(`${label}：续改实参限定了「权威」只指版本与素材引用`, has(prepSys, MARK.priorAuthorityLimit), '')
      check(`${label}：续改实参仍要求保持既有素材引用`, has(prepSys, MARK.priorAssetKeep), '')
      check(`${label}：续改实参把上一版的未给依据规则保留为原文（不静默删除、不加占位）`, has(prepSys, '续借不受影响') && !has(prepSys, '待确认'), '')
    }

    const streams = r.snap.streams || []
    if (c.productWithoutKnowledge) {
      check(`${label}：产品关键词仍按模型声明走准备阶段，没有本地知识路由`, prepSends.length === 1 && !prepSends[0].messages.some(message => message.role === 'tool') && streams.filter(send => send.turn === 'write').length === (c.write ? 1 : 0))
      check(`${label}：未经工具读取的完整产品事实未进入准备、撰写或修订消息`, [...prepSends, ...streams].every(send => !allText(send.messages).includes(PRODUCT_FACTS)))
    }
    if (c.productKnowledge) {
      const tools = prepSends.at(-1)?.messages.filter(message => message.role === 'tool') || []
      check(`${label}：产品事实与写作示例各自通过真实工具消息送达`, tools.some(message => has(message.text, PRODUCT_FACTS)) && tools.some(message => has(message.text, WRITING_EXCERPT)))
      check(`${label}：prep 指令没有否定明确产品事实，同时禁止示例和旧稿确证本稿事实`, prepSends.every(send => {
        const text = pickMsg(send.messages, MARK.prepInstruction)?.text || ''
        return has(text, '明确标注的应用产品事实可作为相应产品能力的依据') && has(text, '写作方法、风格与视觉规范里的例子以及旧稿不能确证本稿事实')
      }))
      const downstream = streams.filter(send => send.turn === 'write' || send.turn === 'revise')
      check(`${label}：WRITE或REVISE继续保留两类资料，并在摘要本身明确区分依据身份`, downstream.length > 0 && downstream.every(send => {
        const digest = pickMsg(send.messages, MARK.digestNew)?.text || ''
        return has(digest, PRODUCT_FACTS) && has(digest, WRITING_EXCERPT) && has(digest, '明确标注的应用产品事实可作为相应产品能力的依据') && has(digest, '其中的示例及旧稿不构成本稿事实') && !has(digest, MARK.digestOld)
      }))
    }
    if (c.localImage) {
      const imageId = c.localImage.assetId
      const prepWithImage = prepSends.filter((send) => send.messages.some((message) => message.images > 0))
      check(`${label}：原图缩图实际进入准备请求`, prepWithImage.length > 0)
      check(`${label}：原图稳定ID实际进入准备请求`, prepWithImage.some((send) => allText(send.messages).includes(imageId)))
      check(`${label}：WRITE与REVISE都保留视觉上下文`, streams.length >= 2 && streams.every((send) => send.messages.some((message) => message.role === 'user' && message.images > 0)))
      check(`${label}：文档提交入参包含原图字节及稳定源引用`, (r.snap.documentSends || []).some((send) => String(send.source || '').includes(imageId) && String(send.html || '').includes(c.localImage.dataUrl) && !String(send.html || '').includes('local-image://')))
      check(`${label}：保存源文不再混入助手外层v2围栏`, (r.snap.documentSends || []).some((send) => String(send.source || '').includes(imageId) && !String(send.source || '').includes('```v2')))
      if (c.importedImage) {
        check(`${label}：显式路径确实经过原图导入命令`, r.snap.cmds.includes('import_local_image'))
        check(`${label}：导入回调把原图ID写进会话存档入参`, (r.snap.sessionSends || []).some((send) => (send.messages || []).some((message) => message.role === 'user' && (message.localImages || []).some((image) => image.assetId === imageId))))
      }
    }
    const write = streams.find((s) => s.turn === 'write')
    const revise = streams.find((s) => s.turn === 'revise')
    if (c.write) {
      check(`${label}：compose 路径确实发出了 write 请求`, Boolean(write), `streamTurns=${JSON.stringify(r.snap.streamTurns || [])}`)
      if (write) {
        check(`${label}：WRITE 的系统提示含共同依据规则`, has(systemText(write.messages), MARK.ground), '')
        check(`${label}：WRITE 只在实际取用知识后附摘要，且不让知识覆盖材料`, !has(lastText(write.messages), MARK.digestOld) && has(lastText(write.messages), MARK.digestNew) === !c.productWithoutKnowledge, `追加指令 ${lastText(write.messages).length} 字符`)
        check(`${label}：WRITE 的追加指令（最后一条消息）含材料依据边界`, has(lastText(write.messages), MARK.ground), '')
        const writeText = lastText(write.messages)
        const protocolHeader = '## 排版引擎协议（必读：'
        const headerAt = writeText.indexOf(protocolHeader)
        const trustedPart = headerAt >= 0 ? writeText.slice(headerAt) : ''
        check(`${label}：WRITE 独立附加可信协议全文，不信任 digest 文件名`, has(trustedPart, ENGINE_PROTOCOL), `独立协议段 ${trustedPart.length} 字符`)
        check(`${label}：WRITE 只含一份协议全文`, writeText.split(ENGINE_PROTOCOL).length - 1 === 1, `全文份数 ${writeText.split(ENGINE_PROTOCOL).length - 1}`)
        if (c.nameOnlyDigest) {
          const digestPart = headerAt >= 0 ? writeText.slice(0, headerAt) : writeText
          check(`${label}：反例确为只提到名字而没有协议正文的 digest`, has(digestPart, 'engine-write-protocol') && !has(digestPart, ENGINE_PROTOCOL.slice(0, 100)), `摘要 ${digestPart.length} 字符`)
        }
      }
    } else {
      check(`${label}：candidate 路径不发起撰写请求`, !write, `streamTurns=${JSON.stringify(r.snap.streamTurns || [])}`)
    }
    if (revise) {
      check(`${label}：修订后的正文生效且不复用旧directSource`, streams.filter(stream => stream.turn === 'revise').length === 1 && r.snap.documentSends.some(send => !String(send.source).includes('🎉') && String(send.source).includes(bareV2(c.revise).split('\n')[0])))
      for (const [n, repair] of streams.filter((s) => s.turn === 'revise').entries()) {
        const protocolCopies = (repair.messages || []).reduce((count, m) => count + String(m.text || '').split(ENGINE_PROTOCOL).length - 1, 0)
        check(`${label}：REVISE 第 ${n + 1} 次实际请求继承一份完整可信协议`, protocolCopies === 1, `全文份数 ${protocolCopies}`)
        const protocolMsg = pickMsg(repair.messages, '## 排版引擎协议（必读：')
        check(`${label}：REVISE 协议上下文保持知识不决定事实的边界`, Boolean(protocolMsg) && has(protocolMsg.text, '本协议只决定语法与样式，不决定本稿事实'))
      }
      check(`${label}：REVISE 的系统提示含共同依据规则`, has(systemText(revise.messages), MARK.ground), '')
      check(`${label}：REVISE 的追加指令含"只修所列问题、不新增运营规则"`, has(lastText(revise.messages), MARK.reviseNoNewRules), '')
      check(`${label}：REVISE 的"保留已澄清事实"已限定为用户材料/确认`, has(lastText(revise.messages), MARK.reviseKeep), '')
    } else {
      check(`${label}：本回合确实进入了自动修订`, false, `streamTurns=${JSON.stringify(r.snap.streamTurns || [])}`)
    }
  }
  run.executionComplete = run.executedCases.length === run.plannedCases.length
}

function finalize() {
  const hasFail = run.checks.some((c) => !c.pass)
  if (run.blockedReason) run.status = 'BLOCKED'
  else if (run.errors.length) run.status = 'ERROR'
  else if (!run.executionComplete || run.executedCases.length !== run.plannedCases.length) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'completeness', message: `计划 ${run.plannedCases.length} 个用例，实际执行 ${run.executedCases.length} 个` })
  } else if (run.checks.length === 0) {
    run.status = 'ERROR'
    run.errors.push({ stage: 'checks', message: '零条检查：不能算通过' })
  } else if (hasFail) run.status = 'FAIL'
  else run.status = 'PASS'
  run.finishedAt = new Date().toISOString()
  mkdirSync(outDir, { recursive: true })
  const passed = run.checks.filter((c) => c.pass).length
  writeFileAtomic(join(outDir, 'run-result.json'), JSON.stringify(run, null, 2) + '\n')
  writeFileAtomic(
    join(outDir, 'result.md'),
    `# 真实 App 实参截获（F1 材料依据边界）\n\n状态：**${run.status}**（executionComplete=${run.executionComplete}，检查 ${passed}/${run.checks.length} 通过）\n` +
      `时间：${run.startedAt} → ${run.finishedAt}\n入口：\`node scripts/app-message-grounding-check.mjs ${outDirArg || '(默认)'} ${base}\`\n` +
      `被测：真实 App（React 组件 + \`turn()\` + 交付门禁）+ \`src/lib/chat.ts\` 通道替身（受控夹具，非原响应回放）\n` +
      `源码哈希：\`${JSON.stringify(run.sourceHashes)}\`\n\n` +
      (run.errors.length ? `## 错误\n\n${run.errors.map((e) => `- [${e.stage}] ${e.message}`).join('\n')}\n\n` : '') +
      `\`\`\`\n${run.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} - ${c.id}${c.evidence.filter(Boolean).length ? ' (' + c.evidence.filter(Boolean).join(' / ') + ')' : ''}`).join('\n')}\n\`\`\`\n`,
  )
  console.log('')
  console.log(`  产出留档：${outDir}`)
  console.log(`APP-MESSAGE-GROUNDING ${run.status}`)
  process.exitCode = run.status === 'PASS' ? 0 : run.status === 'BLOCKED' ? 2 : 1
}

finalize()
