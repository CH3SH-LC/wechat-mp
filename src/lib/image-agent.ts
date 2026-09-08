// image-agent.ts —— 图像子智能体（第 24 轮）：主模型只写图位占位，本模块把占位交给
// "画图"子智能体生成 SVG 并回填为 ::: art / ::: art deco 块，再由 compose 排版 + PNG 渲染。
// 桌面：invoke Rust 命令 gen_svg（独立 DeepSeek 调用，专用画图 persona）；
// 浏览器：本地样例池近似（演示链路确定性）。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'
import { svgElementCount } from './compose'

// ---------- 浏览器演示用的样例 SVG（均带 viewBox、可见图形元素 ≥6，纯色无文字） ----------
const POOL: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 210" fill="none">
<rect x="60" y="140" width="5" height="62" fill="#c96f4a"/>
<path d="M65 142 h170 l-24 16 24 16 h-170 z" fill="#e8b48a"/>
<circle cx="628" cy="64" r="36" fill="#f2c76e"/>
<circle cx="640" cy="52" r="5" fill="#ffffff"/>
<path d="M0 210 L160 148 L280 186 L430 112 L570 170 L750 96 V210 Z" fill="#d9a35f" opacity="0.35"/>
<path d="M0 210 L230 158 L390 190 L560 134 L750 172 V210 Z" fill="#c96f4a" opacity="0.22"/>
<path d="M560 40 q12 -20 30 -20 q-4 -14 -22 -14 q-20 0 -26 14 q-8 14 4 22 q10 -6 14 -2z" fill="#5f8d8a" opacity="0.5"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" fill="none">
<path d="M150 250 C140 180 120 140 90 110" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<path d="M150 250 C165 190 195 150 230 130" stroke="#5f8d8a" stroke-width="4" fill="none"/>
<circle cx="90" cy="104" r="16" fill="#e8b48a"/>
<circle cx="236" cy="124" r="14" fill="#d9a35f"/>
<circle cx="150" cy="150" r="20" fill="#c96f4a"/>
<path d="M120 130 q-26 -8 -34 -30 q28 2 40 18z" fill="#8fb8a4"/>
<path d="M188 170 q24 -14 44 -6 q-10 24 -38 18z" fill="#8fb8a4"/>
<circle cx="90" cy="104" r="6" fill="#f2c76e"/>
</svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 220" fill="none">
<rect x="70" y="152" width="610" height="6" rx="3" fill="#c9a86a"/>
<path d="M180 152 v-70 h110 v70 z" fill="#8a5f3a"/>
<path d="M180 82 c-6 -20 8 -30 30 -28 l-4 30 c-12 2 -20 4 -26 10 z" fill="#a97c50"/>
<path d="M300 96 h140 v56 h-140 z" fill="#b98a5e"/>
<circle cx="235" cy="120" r="12" fill="#f2c76e"/>
<path d="M320 62 q12 -18 28 -18 q-2 -16 -20 -18 q-18 2 -22 18 q-4 18 16 22 q6 -8 12 -4z" fill="#6b8e6e" opacity="0.55"/>
<path d="M360 66 q12 -14 26 -14 q2 -12 -12 -16 q-14 -2 -20 10 q-4 12 8 20 q6 -6 10 -2z" fill="#6b8e6e" opacity="0.45"/>
<path d="M470 96 c32 -36 128 -36 160 0 v56 h-160 z" fill="#e8dcc8"/>
<circle cx="548" cy="120" r="10" fill="#f2c76e"/>
</svg>`,
]

let poolIdx = 0
function mockSvg(): string {
  const s = POOL[poolIdx % POOL.length]
  poolIdx++
  return s
}

// 占位行是否存在于 v2 正文（主模型未内联 SVG，仅写图位）
export function hasPlaceholders(v2: string): boolean {
  return /\[\[img:(?:wide|inline)\|[^\]]+\]\]/.test(v2) || /\[\[deco:[A-Za-z0-9_-]+\|[^\]]+\]\]/.test(v2)
}

// 第 29 轮 3.2：子智能体 CLARIFY 追问前缀（Rust gen_svg 识别 SVG_SYSTEM_PROMPT 第 10 条后返回）
const CLARIFY_PREFIX = 'CLARIFY:'

/**
 * 桌面调 gen_svg：子智能体对说明要素不足时返回 "CLARIFY:<问题>" —— 先交回主模型 refine_brief 补 brief，
 * 用补全后的说明重试一次（有界：每占位最多 1 次回问）；仍失败返回 null。
 * 第 31 轮：gen_svg 偶发瞬态空结果（无 SVG 也非 CLARIFY，重跑即好）→ 对"结果非法"再原样重试一次。
 * 浏览器模式不调 refine（演示链路），直接返回本地样例池 SVG。
 */
async function generateSvg(kind: 'wide' | 'inline' | 'deco', desc: string, theme?: string): Promise<string | null> {
  if (!inTauri()) {
    await new Promise((r) => setTimeout(r, 40))
    const s = mockSvg()
    return /<svg\b[^>]*viewBox="[^"]*"/.test(s) && svgElementCount(s) >= 6 ? s : null
  }

  const callOnce = async (d: string): Promise<string | null> => {
    try {
      const svg = await invoke<string>('gen_svg', { kind, desc: d, theme: theme || null })
      if (svg.startsWith(CLARIFY_PREFIX)) {
        const question = svg.slice(CLARIFY_PREFIX.length).trim()
        const refined = await invoke<string>('refine_brief', { desc: d, question, theme: theme || null })
        if (refined && refined.trim()) {
          const svg2 = await invoke<string>('gen_svg', { kind, desc: refined.trim(), theme: theme || null })
          if (svg2.startsWith(CLARIFY_PREFIX)) return null // 回问后仍追问 → 不强画
          return svg2 && /<svg\b[^>]*viewBox="[^"]*"/.test(svg2) && svgElementCount(svg2) >= 6 ? svg2 : null
        }
        return null
      }
      return svg && /<svg\b[^>]*viewBox="[^"]*"/.test(svg) && svgElementCount(svg) >= 6 ? svg : null
    } catch (e) {
      console.warn('gen_svg 失败：', e)
      return null
    }
  }

  let svg = await callOnce(desc)
  if (!svg) {
    // 瞬态空/失败重试一次（第 31 轮防御）；仍无则交给占位失败文案
    svg = await callOnce(desc)
  }
  return svg
}

// 把 v2 正文里的图位占位逐个换成完整的 ::: art / ::: art deco 块。
// theme：正文 [[theme:名称]] 声明的风格名（用于给子智能体配色提示）。
export async function materializePlaceholders(v2: string, theme?: string): Promise<string> {
  const lines = String(v2 || '').split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const imgM = line.match(/^\[\[img:(wide|inline)\|([^\]]+)\]\]$/)
    const decoM = line.match(/^\[\[deco:([A-Za-z0-9_-]+)\|([^\]]+)\]\]$/)
    if (imgM) {
      const svg = await generateSvg(imgM[1] as 'wide' | 'inline', imgM[2], theme)
      out.push(svg ? `::: art ${imgM[1]} ${imgM[2]}\n${svg}\n:::` : `（此美术素材生成失败：${imgM[2]}）`)
      continue
    }
    if (decoM) {
      const svg = await generateSvg('deco', decoM[2], theme)
      out.push(svg ? `::: art deco ${decoM[1]}\n${svg}\n:::` : `（此角饰素材生成失败：${decoM[1]}）`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}
