// chat.ts —— 对话通道：Tauri 下走 Rust 流式 LLM；浏览器(纯 vite)下走本地模拟
import { invoke } from '@tauri-apps/api/core'

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

export interface StreamHandle {
  cancel: () => void
}

// 模拟流式：先输出说明文本，再吐 ```html 围栏
export function sendChatMock(
  messages: ChatMsg[],
  onDelta: (delta: string) => void,
  onDone?: () => void,
): StreamHandle {
  const user = [...messages].reverse().find((m) => m.role === 'user')
  const bad = user?.content.includes('违规') ?? false
  const topic = bad ? MOCK_BAD : (MOCK_TOPICS.find((t) => user?.content.includes(t.label.slice(4))) ?? MOCK_TOPICS[0])
  const full = `好的，按宣传类 + 校园风直接产出（375px 微信排版，零 emoji 零渐变）：\n\n\`\`\`html\n${topic.html}\n\`\`\``
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
