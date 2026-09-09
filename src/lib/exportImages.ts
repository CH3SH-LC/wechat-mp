// exportImages.ts —— 把当前正文导出为图片（第 34 轮：替代微信 API 发草稿箱，用户手动上传）
// 产出：长图 1 张 + 按屏分页 N 张（2x 高清）。Tauri 经 Rust export_images 写入本地并打开目录；
// 浏览器模式逐个 <a download> 下载。

import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'
import { renderArticleImages } from './htmlToImage'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function suggestImageName(date = new Date()): string {
  return `tuiwen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export interface ExportResult {
  ok: boolean
  msg: string
}

function download(name: string, dataUrl: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 渲染并把 长图+分页 交给 Tauri 落盘 / 浏览器下载。返回提示文案。 */
export async function exportArticleImages(html: string): Promise<ExportResult> {
  let imgs
  try {
    imgs = await renderArticleImages(html)
  } catch (e) {
    return { ok: false, msg: `转图失败：${String(e)}` }
  }
  const base = suggestImageName()
  const files = [{ name: `${base}-长图.png`, data: imgs.long }]
  imgs.pages.forEach((d, i) => files.push({ name: `${base}-${pad(i + 1)}.png`, data: d }))

  if (inTauri()) {
    try {
      const path = await invoke<string>('export_images', { name: base, files })
      return { ok: true, msg: path }
    } catch (e) {
      return { ok: false, msg: String(e) }
    }
  }
  try {
    for (const f of files) {
      download(f.name, f.data)
      await new Promise((r) => setTimeout(r, 260)) // 逐张触发，避免浏览器拦"多个下载"
    }
    return { ok: true, msg: `已下载 ${files.length} 张 PNG（长图 1 + 分页 ${imgs.pages.length}），请手动上传使用` }
  } catch (e) {
    return { ok: false, msg: `下载失败：${String(e)}` }
  }
}
