// progress-check.mjs —— 「AI 工作中」气泡的阶段/计时纯函数断言（2026-09-28）
// 用法：node scripts/progress-check.mjs [--out <目录>]
// 只测 progress.ts 的纯函数（阶段标签映射、耗时格式化），不碰 DOM、不调模型。
// 这些值直接决定气泡上展示什么文字，属于用户可见文案，必须有确定性断言兜住。
//
// 判定（DS 修复指南 §3.1）：唯一 RunResult（status/checks/errors）→ run-result.json + 退出码。
// 零条检查是 ERROR 而不是"通过"；异常由 guardCrashes 落成 ERROR。**不**用 `failed === 0` 推导成功。
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'

// minChecks：2026-10-01 实测 36 条（无分场景前缀，靠条数下界证明执行完整）
const judge = createJudge({ script: 'progress-check', outDir: resolveOutDir('progress-check'), minChecks: 36 })
guardCrashes(judge)

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`)
  judge.check(name, ok, extra)
  if (!ok) failed++
}

// 模块可能尚未导出目标函数（TDD 红阶段），用存在性判断替代直接调用崩溃
const progress = await import('../src/lib/progress.ts')
const { phaseLabel, formatElapsed, prepToolLabel } = progress

// 阶段清单：原设计的独立「质量检查」已并入 compose（<1ms 的纯字符串检查画不出来，见 progress.ts）
const PHASES = ['prep', 'think', 'write', 'asset', 'compose', 'revise', 'save']

console.log('[阶段标签]')
check('phaseLabel 已导出', typeof phaseLabel === 'function')
if (typeof phaseLabel === 'function') {
  const labels = PHASES.map((p) => phaseLabel(p))
  for (let i = 0; i < PHASES.length; i++) {
    check(
      `${PHASES[i]} → 有中文标签`,
      typeof labels[i] === 'string' && labels[i].length >= 2 && /[一-龥]/.test(labels[i]),
      labels[i],
    )
  }
  check('阶段标签两两不同', new Set(labels).size === PHASES.length, labels.join(' / '))
  // 排版与质检合并后，标签必须同时点明两件事（用户据此知道产物已经检查过）
  check('compose 标签点明排版与质检', phaseLabel('compose') === '排版与质检', phaseLabel('compose'))
  // 独立 quality 阶段已并入 compose：它不再是已知阶段，只能走兜底文案
  check('quality 不再是已知阶段', phaseLabel('quality') === '处理中', phaseLabel('quality'))
  // 未知阶段不能崩，也不能渲染成 undefined 给用户看
  const unknown = phaseLabel('nope')
  check('未知阶段有兜底文本', typeof unknown === 'string' && unknown.length > 0, String(unknown))
}

console.log('\n[耗时格式化]')
check('formatElapsed 已导出', typeof formatElapsed === 'function')
if (typeof formatElapsed === 'function') {
  const cases = [
    [0, '0s'],
    [999, '0s'],
    [1000, '1s'],
    [47300, '47s'],
    [59000, '59s'],
    [60000, '1分00秒'],
    [67000, '1分07秒'],
    [3599000, '59分59秒'],
    [3600000, '1时00分00秒'],
    [3661000, '1时01分01秒'],
    [-5, '0s'],
    [NaN, '0s'],
    [Infinity, '0s'],
  ]
  for (const [ms, want] of cases) {
    const got = formatElapsed(ms)
    check(`${String(ms)}ms → ${want}`, got === want, got)
  }
}

console.log('\n[读取资料：工具调用文案]')
check('prepToolLabel 已导出', typeof prepToolLabel === 'function')
if (typeof prepToolLabel === 'function') {
  const cases = [
    ['load_knowledge', '{"name":"engine-write-protocol"}', '读取知识点：engine-write-protocol'],
    // 实测最长的知识点文件名必须原样显示——截断了用户就看不出模型读的是哪份资料
    ['load_knowledge', '{"name":"design-logic-components"}', '读取知识点：design-logic-components'],
    ['search_knowledge', '{"query":"促销活动"}', '检索知识：促销活动'],
    ['search_assets', '{"query":"右下角小花"}', '检索个人素材库：右下角小花'],
    // 参数缺失/畸形：必须有兜底文案，不能把 undefined 或 JSON 片段泄漏到界面
    ['load_knowledge', '{}', '读取知识点…'],
    ['search_knowledge', '不是 JSON', '检索知识…'],
    ['unknown_tool', '{"query":"x"}', '调用 unknown_tool：x'],
  ]
  for (const [name, args, want] of cases) {
    const got = prepToolLabel(name, args)
    check(`${name} ${args} → ${want}`, got === want, got)
  }
  const longQuery = '很长的检索主题'.repeat(6)
  const long = prepToolLabel('search_knowledge', '{"query":"' + longQuery + '"}')
  check('超长自由描述被截断到 28 字并加省略号', long === `检索知识：${longQuery.slice(0, 28)}…`, `${long} (${long.length})`)
}

console.log('\n[死代码不得复活]')
check(
  'lastLine 已移除（气泡只显示当前阶段，不维护历史栈）',
  !('lastLine' in progress),
  Object.keys(progress).join(','),
)

judge.finish({ label: 'PROGRESS' })
