// progress.ts —— 任务进度事件（P2，2026-09-24 调查 §6；2026-09-28 升级为工作气泡）
// 目的：把"正在思考…/正在生成…"这种泛化状态，换成用户看得懂的真实步骤
// （读取资料 / 思考 / 撰写正文 / 素材任务 / 排版生成 / 质量检查 / 自动修订 / 保存文档）。
//
// 设计取舍：**进度由前端各步骤就地上报，不从 Rust 发事件**。原因是链路本身就在前端编排
// （prep → 素材解析 → compose → 质检 → 落库），前端已经知道每一步走到了哪里；
// 从 Rust 发事件反而要跨进程同步状态。Rust 只在真正需要时才发事件（视觉复核在途）。
// 这些事件纯展示，不参与任何流程判断（项目铁律 6）。

export type TaskPhase =
  | 'prep' // 读取资料：prep 阶段取用知识点 / 检索素材库
  | 'think' // 思考中：模型往返等待（prep 往返、主流式首字延迟）
  | 'write' // 撰写正文：主流式产出 v2 正文
  | 'asset' // 素材任务：检索 / 视觉复核 / 复用 / 绘制 / 入库
  | 'compose' // 排版与质检：compose + 素材 canvas 栅格 + 产物检查
  | 'revise' // 自动修订：把问题清单喂回模型重写
  | 'save' // 保存文档：写入文档库并刷新

export interface TaskEvent {
  phase: TaskPhase
  text: string
}

export type ProgressFn = (e: TaskEvent) => void

// 阶段 → 气泡左侧标签。用户可见文案，改动会改界面，被 scripts/progress-check.mjs 断言兜住。
// 注：原设计的独立「质量检查」阶段已并入 compose——产物质检是纯字符串检查（实测 <1ms），
// 浏览器根本没有机会把它绘制出来，做成独立阶段只会是从不出现的假状态。
const PHASE_LABEL: Record<TaskPhase, string> = {
  prep: '读取资料',
  think: '思考中',
  write: '撰写正文',
  asset: '素材任务',
  compose: '排版与质检',
  revise: '自动修订',
  save: '保存文档',
}

/** 气泡上的阶段标签；未知阶段给中性兜底，绝不把 undefined 渲染给用户 */
export function phaseLabel(phase: TaskPhase): string {
  return PHASE_LABEL[phase] || '处理中'
}

// prep 阶段的工具调用 → 「读取资料」细节文案。放在本模块是为了能离线断言（progress.ts 无任何依赖，
// 而 prep.ts 会经 retrieval.ts 引入 Vite 专属的 import.meta.glob，node 下无法加载）。
// 参数解析失败只降级文案，不影响工具执行。
export function prepToolLabel(name: string, args: unknown): string {
  let a: Record<string, unknown> = {}
  if (typeof args === 'string') {
    try {
      a = (JSON.parse(args || '{}') || {}) as Record<string, unknown>
    } catch {
      a = {}
    }
  } else if (args && typeof args === 'object') {
    a = args as Record<string, unknown>
  }
  const q = String(a.name ?? a.query ?? '').trim()
  // 28 是实测最长知识点文件名（design-logic-components，23 字符）+ 余量：
  // 点文件名不能被截断，否则用户看不出模型到底读了哪份资料。只有自由描述才需要裁。
  const short = q.length > 28 ? q.slice(0, 28) + '…' : q
  if (name === 'load_knowledge') return short ? `读取知识点：${short}` : '读取知识点…'
  if (name === 'search_knowledge') return short ? `检索知识：${short}` : '检索知识…'
  if (name === 'search_assets') return short ? `检索个人素材库：${short}` : '检索个人素材库…'
  return short ? `调用 ${name}：${short}` : `调用 ${name}…`
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 本轮已耗时（毫秒 → 短文案）。非法/非正值一律按 0 处理，保证气泡上永远有可读文本。 */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const total = Math.floor(ms / 1000)
  if (total < 60) return `${total}s`
  const s = total % 60
  const m = Math.floor(total / 60)
  if (m < 60) return `${m}分${pad2(s)}秒`
  return `${Math.floor(m / 60)}时${pad2(m % 60)}分${pad2(s)}秒`
}
