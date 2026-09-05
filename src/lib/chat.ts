// chat.ts —— 对话通道：Tauri 下走 Rust 流式 LLM；浏览器(纯 vite)下走本地模拟
import { invoke } from '@tauri-apps/api/core'
import { evaluate, isCancel, isCreateRequest, isDemoTopic } from './needs'

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
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

// 演示素材 SVG（第 16 轮：组件装饰全覆盖，一篇 5 处素材；图形元素均 ≥6）
const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210" fill="none">
<rect x="60" y="140" width="5" height="62" fill="#c96f4a"/>
<path d="M65 142 h170 l-24 16 24 16 h-170 z" fill="#e8b48a"/>
<circle cx="628" cy="64" r="36" fill="#f2c76e"/>
<circle cx="640" cy="52" r="5" fill="#ffffff"/>
<path d="M0 210 L160 148 L280 186 L430 112 L570 170 L750 96 V210 Z" fill="#d9a35f" opacity="0.35"/>
<path d="M0 210 L230 158 L390 190 L560 134 L750 172 V210 Z" fill="#c96f4a" opacity="0.22"/>
<path d="M560 40 q12 -20 30 -20 q-4 -14 -22 -14 q-20 0 -26 14 q-8 14 4 22 q10 -6 14 -2z" fill="#5f8d8a" opacity="0.5"/>
</svg>`

const FLOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" fill="none">
<path d="M150 250 C140 180 120 140 90 110" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M150 250 C165 190 195 150 230 130" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="90" cy="104" r="16" fill="#e8b48a"/>
<circle cx="236" cy="124" r="14" fill="#d9a35f"/>
<circle cx="150" cy="150" r="20" fill="#c96f4a"/>
<path d="M120 130 q-26 -8 -34 -30 q28 2 40 18z" fill="#8fb8a4"/>
<path d="M188 170 q24 -14 44 -6 q-10 24 -38 18z" fill="#8fb8a4"/>
<circle cx="90" cy="104" r="6" fill="#f2c76e"/>
</svg>`

// v2 语法正文样例（第 16 轮：组件装饰全覆盖——banner/小节/气泡/分隔均配素材，共 5 处；第 17 轮：声明校园主题）
const SAMPLE_V2 = `[[theme:校园]]

[[banner:新生开学典礼|9 月 1 日上午 8 点 · 东区操场]]

::: art wide 晨光里的旗帜
${FLAG_SVG}
:::

九月第一天，典礼如约而至。这篇清单把当天安排一次看明白。

## 典礼流程

::: steps
- 8:00 集合入场：按班级通道入场，新生从东门进，家长休息区在体育馆二层
- 9:00 典礼开始：校长致辞、新生代表发言、佩戴校徽，全程约 40 分钟
- 9:50 班级班会：典礼后各班回教室，班主任交代入学安排
:::

::: art inline 节奏与小花
${FLOWER_SVG}
:::

> [!KEY] 记得带
> 录取通知书与身份证、水杯与防晒（户外排队用）

::: art inline 行囊与准备
${FLOWER_SVG}
:::

## 你需要准备

- 提前 15 分钟到集合点，找本班引导牌
- 手机调静音，典礼中保持安静
- 带一件薄外套，室内空调较凉

::: art inline 书本与开始
${FLOWER_SVG}
:::

::: band 斜纹
- 典礼后各班回教室开班会，记得把这份时间表转给同班同学。
:::

::: art wide 花带收尾
${FLOWER_SVG}
:::

[[title:新的开始|box]]

第一堂课从典礼开始。愿你们在这里的每一天，都有新的收获。

[[badge:新生指南]] [[badge:开学典礼]]`

export const MOCK_TOPICS: MockTopic[] = [
  {
    label: '示例：开学典礼宣传',
    prompt: '写一篇新生入学典礼的宣传类推文，校园风格，800 字左右，直接写',
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
const CLARIFY_QUESTION = '好的，先确认一下再写：这篇推文你希望是什么类型（比如活动宣传还是资讯介绍）？想要什么风格？大概多少字？需要配图吗？回复我后马上出稿。'
const CANCEL_REPLY = '好的，那先不写了。需要的时候随时告诉我主题就行。'
const CHAT_GREET = '你好，我是公众号推文助手。你可以像用通用助手一样和我聊天：问公众号写作的问题、聊选题想法都行；明确说「写一篇…推文」，我就帮你产出可直接发布的推文并实时预览。'
const CHAT_QA = '可以。公众号写作的通用要点：开头三秒抓住读者，正文短段落加小标题分层，重点加粗，结尾留行动号召，全文不用 emoji 和花哨装饰（演示环境为本地模拟回复）。需要针对具体场景展开，或直接写一篇，告诉我就行。'
const CHAT_DEFAULT = '明白。想继续聊公众号写作，还是让我直接写一篇推文？告诉我主题、风格、大概字数即可。'

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
  const asked = lastAssistant?.content.includes('？') ?? false
  const article = `好的，按宣传类 + 校园风直接产出（v2 正文，本地排版引擎渲染）：\n\n\`\`\`v2\n${SAMPLE_V2}\n\`\`\``
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
