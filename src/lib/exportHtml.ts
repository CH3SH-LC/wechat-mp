// exportHtml.ts —— 导出推文 HTML：Tauri 走 Rust 命令（文档/wechat-mp-exports），浏览器走 <a download>

import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function suggestName(date = new Date()): string {
  return `tuiwen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.html`
}

export interface ExportResult {
  ok: boolean
  msg: string
}

export async function exportHtml(html: string): Promise<ExportResult> {
  if (inTauri()) {
    try {
      const path = await invoke<string>('export_html', { html, name: null })
      return { ok: true, msg: path }
    } catch (e) {
      return { ok: false, msg: String(e) }
    }
  }
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = suggestName()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return { ok: true, msg: a.download }
  } catch (e) {
    return { ok: false, msg: String(e) }
  }
}
