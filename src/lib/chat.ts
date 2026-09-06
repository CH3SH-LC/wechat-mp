// chat.ts —— 对话通道：Tauri 下走 Rust 流式 LLM；浏览器(纯 vite)下走本地模拟
import { invoke } from '@tauri-apps/api/core'
import { evaluate, isCancel, isCreateRequest, isDemoTopic } from './needs'

// 消息可承载工具回合（第 25 轮）：assistant 带 tool_calls（content 为空）、tool 结果带 tool_call_id
export interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: ChatToolCall[]
}

export interface ChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ---------- Rust 通道 ----------
export async function sendChatRust(messages: ChatMsg[]): Promise<void> {
  await invoke('chat_stream', { messages })
}

// ---------- 本地模拟（无 Tauri / 无密钥时演示链路） ----------
export interface MockTopic {
  label: string
  prompt: string
  v2?: string
  html?: string // 直通演示样本（违规输出检测等）
}

// v2 正文样例（第 24 轮：素材用图位占位——插画 [[img:wide|说明]] / [[img:inline|说明]]、
// 气泡角饰先 [[deco:名称|说明]] 再由 > [!KEY|名称] 引用；SVG 由图像子智能体生成）
const SAMPLE_V2 = `[[theme:校园]]

[[banner:新生开学典礼|9 月 1 日上午 8 点 · 东区操场]]

[[img:wide|晨光中的升旗台与旗帜，开学典礼横幅场景插画，暖色调]]

九月第一天，典礼如约而至。这篇清单把当天安排一次看明白。

## 典礼流程

::: steps
- 8:00 集合入场：按班级通道入场，新生从东门进，家长休息区在体育馆二层
- 9:00 典礼开始：校长致辞、新生代表发言、佩戴校徽，全程约 40 分钟
- 9:50 班级班会：典礼后各班回教室，班主任交代入学安排
:::

[[img:inline|节奏小花与书本，典礼前的小物件插画]]

[[deco:blossom|花簇小角饰]]

> [!KEY|blossom] 记得带
> 录取通知书与身份证、水杯与防晒（户外排队用）

## 你需要准备

- 提前 15 分钟到集合点，找本班引导牌
- 手机调静音，典礼中保持安静
- 带一件薄外套，室内空调较凉

## 提前一晚要做的事

- 把录取通知书、身份证和一张一寸照片装进同一个文件袋，睡前放在门口鞋柜上
- 校服提前熨好挂起，书包只装当天要用的东西，太重反而手忙脚乱
- 设好两个闹钟，间隔十分钟——典礼日早上八点前要站到本班集合点
- 熟悉一遍从校门到东区操场的路，家长可以从体育馆二层入场

这些都做完了，就早睡。典礼日的精神头，一半在前一晚的睡眠里。

## 给家长的话

送完孩子不必急着走。体育馆二层的家长休息区开放到十点半，有饮水与座椅；班主任会在九点五十左右把班会安排发到班级群。如果孩子是第一次住校，可以趁典礼前把宿舍钥匙、水卡的位置再叮嘱一遍——大部分紧张，都在"东西放在哪"上。

开学第一周是适应期，晚上九点后尽量别打电话，让孩子按自己的节奏收拾洗漱；真有急事，宿管老师的电话贴在每层楼梯口。

[[img:inline|书本与开始，翻开的新课本插画]]

::: band 斜纹
- 典礼后各班回教室开班会，记得把这份时间表转给同班同学。
:::

[[img:wide|典礼散场的花带与横幅插画，收尾场景]]

[[title:新的开始|box]]

第一堂课从典礼开始。愿你们在这里的每一天，都有新的收获。

[[badge:新生指南]] [[badge:开学典礼]]`

export const MOCK_TOPICS: MockTopic[] = [
  {
    label: '示例：开学典礼宣传',
    prompt: '写一篇新生入学典礼的宣传类推文，校园风，800 字左右，直接写',
    v2: SAMPLE_V2,
  },
]

const BAD_HTML = `<section style="margin:0 0 16px;"><p style="font-size:15px;color:#333;line-height:1.75;">这是违规演示：包含 emoji 与渐变，应被质量检查检出。✅🎉</p></section>
<section style="background:linear-gradient(135deg,#ff9a9e,#fecfef);border-radius:12px;padding:14px 16px;margin:0 0 16px;"><p style="font-size:15px;color:#333;line-height:1.75;margin:0;">渐变底色 + box-shadow:0 2px 8px rgba(0,0,0,.2)，全都不允许。</p></section>
<section style="margin:0 0 16px;"><p style="font-size:15px;color:#333;line-height:1.75;margin:0;"><img src="https://example.com/x.jpg" style="width:100%;"></p></section>`

export const MOCK_BAD: MockTopic = {
  label: '演示：违规输出检测',
  prompt: '演示质量检查：请故意输出包含 emoji、渐变与外链图的推文',
  html: BAD_HTML,
}

// 模拟文案（浏览器演示：闲聊 / 反问澄清 / 成文 / 取消）
const CLARIFY_QUESTION = '好的，先把要求问清楚再写：这篇推文是什么类型（活动宣传还是资讯介绍）？想要什么风格？大概多少字？需要配图吗？还有发布到哪里（导出/草稿箱）？你逐项告诉我即可。'
const CANCEL_REPLY = '好的，那先不写了。需要的时候随时告诉我主题就行。'
const CHAT_GREET = '你好，我是公众号推文助手。你可以像用通用助手一样和我聊天：问公众号写作的问题、聊选题想法都行；说「写一篇…推文」，我会先把要求问清楚再帮你产出可直接发布的推文并实时预览。'
const CHAT_QA = '可以。公众号写作的通用要点：开头三秒抓住读者，正文短段落加小标题分层，重点加粗，结尾留行动号召，全文不用 emoji 和花哨装饰（演示环境为本地模拟回复）。需要针对具体场景展开，或直接写一篇，告诉我就行。'
const CHAT_DEFAULT = '明白。想继续聊公众号写作，还是让我写一篇推文？告诉我主题、目标读者、风格倾向即可。'

export interface StreamHandle {
  cancel: () => void
}

// 模拟流式：近似"模型自主判断"（第 13 轮起 App 不再本地路由，模拟端用启发式近似）：
// 上一条助手反问过且本条非取消 → 视为创作回答直接成文；取消 → 停止；
// 演示/创作意图 → 按需求充分度反问或成文；其余 → 闲聊文案。
export function sendChatMock(
  messages: ChatMsg[],
  onDelta: (delta: string) => void,
  onDone?: () => void,
): StreamHandle {
  const user = [...messages].reverse().find((m) => m.role === 'user')
  const u = user?.content ?? ''
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const asked = (lastAssistant?.content ?? '').includes('？')
  const article = `好的，需求已明确，按所选风格直接产出（v2 正文，素材交给图像子智能体生成）：\n\n\`\`\`v2\n${SAMPLE_V2}\n\`\`\``
  const badArticle = `好的，按要求演示违规输出：\n\n\`\`\`html\n${MOCK_BAD.html}\n\`\`\``
  let full: string
  if (isCancel(u)) {
    full = CANCEL_REPLY
  } else if (asked) {
    // 对上一条澄清问题的回答：直接进入创作
    full = article
  } else if (isDemoTopic(u) || u.includes('违规')) {
    full = badArticle
  } else if (isCreateRequest(u)) {
    full = evaluate(u).needsClarify ? CLARIFY_QUESTION : article
  } else {
    full = /你好|嗨|hello|在吗|hi/i.test(u)
      ? CHAT_GREET
      : /[?？]|怎么|如何|什么|为什么|吗/.test(u)
        ? CHAT_QA
        : CHAT_DEFAULT
  }
  let i = 0
  const timer = window.setInterval(() => {
    if (i >= full.length) {
      window.clearInterval(timer)
      onDone?.()
      return
    }
    const step = 6 + Math.floor(Math.random() * 14)
    const next = Math.min(i + step, full.length)
    onDelta(full.slice(i, next))
    i = next
  }, 24)
  return { cancel: () => window.clearInterval(timer) }
}
