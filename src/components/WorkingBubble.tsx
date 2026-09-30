import { useEffect, useState } from 'react'
import type { TaskPhase } from '../lib/progress.ts'
import { formatElapsed, phaseLabel } from '../lib/progress.ts'

interface Props {
  /** 当前阶段；null 表示不在工作中（组件不渲染任何东西） */
  phase: TaskPhase | null
  /** 阶段细节（读了哪份资料 / 画第几张素材 / 几个可修复问题） */
  detail: string
  /** 本轮开始的时间戳（Date.now()）；null 表示不显示计时 */
  startedAt: number | null
}

/**
 * 「AI 工作中」气泡：把原先分散的三处指示（`.typing` 的"正在思考…/正在生成…"、
 * `.task-progress` 的一行步骤、空气泡里的"…"）合并成一个助手侧气泡——
 * 左侧阶段标签（读取资料 / 思考中 / 撰写正文 / 素材任务 / 排版生成 / 质量检查 / 自动修订 / 保存文档），
 * 中间真实细节，右侧本轮已耗时。
 *
 * 纯展示：只读 props 与 Date.now()，不回调、不判断、不参与任何对话流程（项目铁律 6）。
 */
export default function WorkingBubble({ phase, detail, startedAt }: Props) {
  // 每秒重算一次已耗时。只影响这里显示的数字，与业务流程无关。
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  if (phase === null) return null

  return (
    <div className="msg msg-assistant work-msg">
      <div className="work-bubble" data-phase={phase}>
        <span className="wb-dot" aria-hidden="true" />
        <span className="wb-label">{phaseLabel(phase)}</span>
        {detail && <span className="wb-detail">{detail}</span>}
        {startedAt !== null && <span className="wb-time">{formatElapsed(now - startedAt)}</span>}
      </div>
    </div>
  )
}
