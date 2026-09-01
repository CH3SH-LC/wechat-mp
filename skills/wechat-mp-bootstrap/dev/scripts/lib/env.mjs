// dev/scripts/lib/env.mjs —— 开发脚本公共环境：路径自适应 + playwright/chromium 探测
// 位置：<skillRoot>/dev/scripts/lib/env.mjs，所有脚本从本模块取路径，机器无关
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'

// 路径常量（相对本文件自动定位，脚本放哪都能跑）
export const skillRoot = fileURLToPath(new URL('../../../', import.meta.url)) // 上级：dev/scripts/lib -> skill 根
export const devDir = fileURLToPath(new URL('../../', import.meta.url)) // dev/
export const scriptsDir = fileURLToPath(new URL('../', import.meta.url)) // dev/scripts/
export const artifactsDir = fileURLToPath(new URL('../../artifacts/', import.meta.url)) // dev/artifacts/
export const skillMd = fileURLToPath(new URL('../../../SKILL.md', import.meta.url)) // 唯一权威源码
export const knowledgeDir = fileURLToPath(new URL('../../../knowledge/', import.meta.url))

// 动态加载 playwright（静态 import 无法探测路径）
export async function loadPlaywright() {
  const candidates = []
  const pnpmRoots = [
    'D:/deepseek-harness/deepseek-harness/node_modules/.pnpm',
    'C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/.pnpm',
  ]
  for (const r of pnpmRoots) {
    try {
      for (const d of readdirSync(r)) {
        if (d.startsWith('playwright@')) {
          candidates.push(r + '/' + d + '/node_modules/playwright/index.mjs')
          candidates.push(r + '/' + d + '/playwright/index.mjs')
        }
      }
    } catch (_) { /* 该 pnpm 根不存在则跳过 */ }
  }
  candidates.push('D:/deepseek-harness/deepseek-harness/node_modules/playwright/index.mjs')
  candidates.push('C:/Users/Lenovo/.dsh/deepseek-harness/node_modules/playwright/index.mjs')
  for (const c of candidates) {
    try {
      if (existsSync(c)) return await import(pathToFileURL(c).href)
    } catch (_) { /* 尝试下一个 */ }
  }
  throw new Error('找不到 playwright：请在 dev/scripts/lib/env.mjs 的 loadPlaywright() 候选列表里补充安装路径')
}

// 探测本机 ms-playwright chromium 可执行文件
export function findChromium() {
  const base = 'C:/Users/Lenovo/AppData/Local/ms-playwright'
  try {
    for (const d of readdirSync(base)) {
      if (d.startsWith('chromium-')) {
        const exe = base + '/' + d + '/chrome-win64/chrome.exe'
        if (existsSync(exe)) return exe
      }
    }
  } catch (_) { /* 目录不存在 */ }
  return undefined
}

// 输出文件统一写 dev/artifacts/，返回完整路径
export function artifact(name) {
  return artifactsDir + name
}
