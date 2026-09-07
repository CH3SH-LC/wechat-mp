// prep.ts —— 创作前置"模型选知识"回合（第 25 轮）
// 本文件不是对话状态机：它是"模型发起 tool_calls → 前端机械执行本地工具 → 回传 tool 结果"的
// 确定性工具取用循环，仅在模型要求时发生，不改变用户可见的对话回合（用户消息不被阻挡）。
// 浏览器模式不调用（直接返回 { mode:'skip' }），E2E mock 语义不变。
import { invoke } from '@tauri-apps/api/core'
import { ChatMsg, ChatToolCall, inTauri } from './chat'
import { runKnowledgeTool } from './retrieval'

export interface PrepReply {
  text: string | null
  calls: { id: string; name: string; args: string }[]
}

export interface PrepOutcome {
  mode: 'skip' | 'prep'
  ready?: boolean // text === READY 标记（已取完知识、可进入创作）
  text?: string // READY，或模型输出的澄清问题/说明
  digest?: string // READY 分支：本轮实际取用的知识点摘要（工具结果），供流式撰写作上下文
  exhausted?: boolean // 第 28 轮：工具循环 3 轮未收敛但应直接撰写（勿把兜底话术当回复）
}

// prep 阶段对模型的约束：只允许澄清问题或 READY（是否明确完全由模型判断）
export const PREP_INSTRUCTION =
  '你的任务是：若创作需求尚不明确 → 仅输出你的澄清问题（一段话）并结束；' +
  '若已明确 → 先用知识工具（load_knowledge / search_knowledge）取用本次创作真正需要的点文件，' +
  '取完只输出 READY（仅此一词），不要撰写正文。稍后会另发指令让你开始撰写正文。'

// READY 后进入正文撰写的指令（由 App 在最终流式消息末尾追加）
export const WRITE_INSTRUCTION =
  '开始撰写正文：只输出一个 ```v2 或 ```html 代码块，不要清单、不要解释'

export function isReadinessMarker(text: string): boolean {
  return text.trim().toUpperCase() === 'READY'
}

async function prepInvoke(messages: ChatMsg[]): Promise<PrepReply> {
  return await invoke<PrepReply>('prep_turn', { messages })
}

/**
 * 创作前置工具循环（≤3 轮）。入参为 payload 形态：[system(注册表), ...history, user(raw)]。
 * 返回 {mode:'prep', ready:true, digest} 表示模型取完知识、输出 READY；
 * 返回 {mode:'prep', ready:false, text} 表示模型在澄清（无工具调用或未收敛）。
 *
 * 注意：最终撰写不再透传 assistant tool_calls / tool 消息（DeepSeek 对"带工具历史但不带 tools"
 * 的续写请求有 400 风险），改为把实际取用结果拼成"知识摘要（digest）"随撰写指令进上下文。
 */
export async function runPrep(messages: ChatMsg[]): Promise<PrepOutcome> {
  if (!inTauri()) return { mode: 'skip' }

  const last = messages[messages.length - 1]
  const rawUser = last && last.role === 'user' ? (last.content ?? '') : ''
  const system = messages.find((m) => m.role === 'system')
  const prior = messages.filter(
    (m) => m !== last && m.role !== 'system' && (m.role === 'user' || m.role === 'assistant'),
  )

  // 注册表系统提示 + 历史 + 原始请求 + prep 规约（原始请求供模型判断需求是否已明确）
  const convo: ChatMsg[] = [
    ...(system ? [system] : []),
    ...prior,
    { role: 'user', content: rawUser },
    { role: 'user', content: PREP_INSTRUCTION },
  ]
  // 实际取用知识点摘要（每轮追加，READY 时随上下文给撰写阶段）
  const digestParts: string[] = []

  for (let round = 0; round < 3; round++) {
    const reply = await prepInvoke(convo)

    if (reply.calls.length) {
      const assistantCall: ChatMsg = {
        role: 'assistant',
        content: null,
        tool_calls: reply.calls.map(
          (c): ChatToolCall => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.args },
          }),
        ),
      }
      convo.push(assistantCall)
      // 逐个机械执行本地知识工具（读取内存知识库，不抛错——失败返回提示串）
      for (const c of reply.calls) {
        const result = await runKnowledgeTool({ name: c.name, args: c.args })
        const toolMsg: ChatMsg = { role: 'tool', tool_call_id: c.id, content: result }
        convo.push(toolMsg)
        digestParts.push(`【${c.name} ${c.args}】\n${result}`)
      }
      continue
    }

    const text = reply.text?.trim() ?? ''
    if (isReadinessMarker(text)) {
      return { mode: 'prep', ready: true, text: 'READY', digest: digestParts.length ? digestParts.join('\n\n') : undefined }
    }
    // 无工具调用且非 READY → 模型在澄清/说明，直接回传给用户可见消息流
    return { mode: 'prep', ready: false, text: text || '（请补充需求，我再开始创作）' }
  }

  // 超过 3 轮仍在请求工具（无 READY 也无澄清文字）→ 视为"知识收集未完但应尽快成稿"：
  // 降级为直接撰写（ready:true，带上已取知识摘要），不再把兜底话术当正式回复（第 28 轮）。
  return {
    mode: 'prep',
    ready: true,
    text: undefined,
    exhausted: true,
    digest: digestParts.length ? digestParts.join('\n\n') : undefined,
  }
}
