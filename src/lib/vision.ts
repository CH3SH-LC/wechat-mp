// vision.ts —— 视觉复核（P2，2026-09-24 调查 §8）：只在"排序含糊"时让模型看一眼候选素材。
//
// 定位与边界（重要）：
// - 确定性检索给出强命中时**不调用**——省费用，也避免模型推翻已成立的结论；
// - 只在"有近邻候选、但没到可复用阈值"时启用，帮助判断"能不能凑合用"还是"该重画"；
// - 用户没在设置里开启时完全不走这条路（默认关闭：视觉调用有费用）；
// - 任何失败都回退为"新建"，并把原因带出来给用户看，绝不因为看不了图就把旧素材硬塞进去；
// - 费用控制：每篇文章有限次预算 + 按 `id@version` 缓存（同一素材同一版本只问一次）+ 只发缩略图。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat.ts'
import { getAssetSafe } from './asset-library.ts'
import type { AssetMetaL } from './asset-library.ts'
import { svgToThumbDataUri } from './artRender.ts'
import { loadAppSettings } from './settings.ts'

/** 单篇文章最多允许的视觉复核次数（费用上限） */
export const MAX_VISION_CALLS_PER_ARTICLE = 3
/** 单次最多送看的候选数 */
export const MAX_CANDIDATES = 4

export interface VisionDecisionL {
  pick: number | null
  reason: string
}

interface CachedDecision {
  pick: number | null
  reason: string
}

// 按 `id@version` 缓存：同一素材同一版本在本次会话内只问一次
const cache = new Map<string, CachedDecision>()
let budget = MAX_VISION_CALLS_PER_ARTICLE

/** 每篇文章开始时调用，重置调用预算（缓存保留——同一素材不必重复问） */
export function resetVisionBudget(): void {
  budget = MAX_VISION_CALLS_PER_ARTICLE
}

export function visionBudgetLeft(): number {
  return budget
}

/** 清空会话内缓存（改素材版本/切换用户偏好时用） */
export function clearVisionCache(): void {
  cache.clear()
}

async function enabled(): Promise<boolean> {
  if (!inTauri()) return false
  try {
    const s = await loadAppSettings()
    return !!s.visionReview
  } catch {
    return false
  }
}

/**
 * 让模型看一眼候选，判断哪一张能直接用作该素材位。
 * 返回 null 表示"不可用/未启用/无预算/调用失败"——调用方一律按"新建"处理。
 */
export async function reviewCandidates(
  kind: string,
  desc: string,
  candidates: AssetMetaL[],
): Promise<VisionDecisionL | null> {
  if (!candidates.length) return null
  if (!(await enabled())) return null
  if (budget <= 0) return null

  const pick = candidates.slice(0, MAX_CANDIDATES)
  const keys = pick.map((m) => `${m.id}@${m.version}`)
  // 全部命中缓存时直接复用结论，不消耗预算
  if (keys.every((k) => cache.has(k))) {
    const idx = pick.findIndex((_m, i) => cache.get(keys[i])?.pick === i)
    if (idx >= 0) return cache.get(keys[idx])!
  }

  const thumbs: string[] = []
  const ordered: AssetMetaL[] = []
  // W6（2026-09-29 接线）：用 getAssetSafe，不是 getAsset——后者的 null 同时表示"素材不存在"
  // 与"存在但读不出来"，两种成因说不清；而 reason 是给用户看的说明，必须说真话。
  const skipped: string[] = []
  for (const m of pick) {
    const rec = await getAssetSafe(m.id)
    if (!rec.ok) {
      skipped.push(`${m.title || m.name}：${rec.notFound ? '素材不存在' : `读取失败（${rec.error}）`}`)
      continue
    }
    if (!rec.record.svg.trim()) {
      skipped.push(`${m.title || m.name}：素材内容为空`)
      continue
    }
    const uri = await svgToThumbDataUri(rec.record.svg)
    if (!uri.startsWith('data:image/')) {
      skipped.push(`${m.title || m.name}：缩略图生成失败`)
      continue
    }
    thumbs.push(uri)
    ordered.push(m)
  }
  if (!thumbs.length) {
    // 一张也看不了 ≠ "都看过了、都不合适"：把真实原因说出去，调用方按重新绘制处理。
    // 这里不消耗预算（没有发生模型调用），也不回 null（null 会把原因丢掉）。
    return skipped.length ? { pick: null, reason: `候选素材都没有可看的图，按重新绘制处理：${skipped.slice(0, 2).join('；').slice(0, 120)}` } : null
  }

  budget--
  try {
    const d = await invoke<VisionDecisionL>('review_assets', { kind, desc, candidates: thumbs })
    // 落到"候选顺序"上；越界或未选中都算新建
    const idx = d.pick === null || d.pick === undefined ? null : d.pick
    const chosen = idx !== null && idx >= 0 && idx < ordered.length ? idx : null
    const result: VisionDecisionL = { pick: chosen, reason: d.reason || '' }
    ordered.forEach((m, i) => {
      cache.set(`${m.id}@${m.version}`, { pick: chosen === i ? i : null, reason: result.reason })
    })
    return result
  } catch (e) {
    // 看不了图不等于素材合适：记录原因并回退"新建"
    return { pick: null, reason: `视觉复核失败，按重新绘制处理：${String(e).slice(0, 80)}` }
  }
}

/** 把决策下标翻回素材条目（供调用方复用） */
export function candidateAt(candidates: AssetMetaL[], decision: VisionDecisionL | null): AssetMetaL | null {
  if (!decision || decision.pick === null) return null
  return candidates[decision.pick] ?? null
}
