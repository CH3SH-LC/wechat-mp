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
  html: string
}

const SAMPLE_HTML = `<section style="margin:0 0 16px;"><p style="font-size:15px;color:#333;line-height:1.75;letter-spacing:0.5px;margin:0 0 16px;">又是一年开学季，典礼定在 9 月 1 日上午 8 点。这篇清单帮你把当天安排一次看明白。</p></section>
<section style="margin:0 0 16px;"><p style="font-size:18px;font-weight:700;color:#2b5a8a;line-height:1.75;margin:0 0 12px;border-left:3px solid #2b5a8a;padding-left:10px;">典礼流程</p></section>
<section style="background:#f3f8fd;border:1px solid #d7e6f5;border-radius:12px;padding:14px 16px;margin:0 0 16px;"><p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#2b5a8a;line-height:1.75;">8:00 集合入场</p><p style="margin:0;font-size:14px;color:#4a555f;line-height:1.75;">按班级通道入场，新生从东门进，家长休息区在体育馆二层。</p></section>
<section style="background:#f3f8fd;border:1px solid #d7e6f5;border-radius:12px;padding:14px 16px;margin:0 0 16px;"><p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#2b5a8a;line-height:1.75;">9:00 开学典礼</p><p style="margin:0;font-size:14px;color:#4a555f;line-height:1.75;">校长致辞、新生代表发言、佩戴校徽环节，全程约 40 分钟。</p></section>
<div style="margin:0 0 16px;"><p style="font-size:14px;color:#333;line-height:1.75;margin:0 0 8px;">你需要带的：</p>
<div style="margin:0 0 6px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#2b5a8a;vertical-align:middle;margin:0 6px 2px 0;"></span><span style="font-size:15px;color:#333;line-height:1.75;">录取通知书与身份证</span></div>
<div style="margin:0 0 6px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#2b5a8a;vertical-align:middle;margin:0 6px 2px 0;"></span><span style="font-size:15px;color:#333;line-height:1.75;">水杯与防晒（户外排队用）</span></div>
</div>
<section style="border-top:1px solid #e0e0e0;padding-top:16px;margin:24px 0 0;"><p style="font-size:15px;font-weight:700;color:#333;line-height:1.75;margin:0 0 8px;">保存这张时间表</p><p style="font-size:14px;color:#777;line-height:1.75;margin:0;">典礼后各班回教室开班会，记得把本清单转发给同班同学。</p></section>`

export const MOCK_TOPICS: MockTopic[] = [
  {
    label: '示例：开学典礼宣传',
    prompt: '写一篇新生入学典礼的宣传类推文，校园风格，800 字左右，直接写',
    html: SAMPLE_HTML,
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
  const article = `好的，按宣传类 + 校园风直接产出（375px 微信排版，零 emoji 零渐变）：\n\n\`\`\`html\n${SAMPLE_HTML}\n\`\`\``
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
