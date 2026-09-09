// asset-agent.ts —— V3-R2 素材子智能体编排（素材工坊：制作 → 校验 → 语义元数据 → 入库）
// 桌面：invoke gen_svg（素材智能体专用模型，按分类 kind 传语境）；浏览器：本地样例池近似。
// V3 口径：主文档智能体绝不自己画图——这里与 image-agent 是"素材智能体"的唯二调用点；
// 产出 SVG 由素材智能体书写，本模块负责校验（viewBox + 元素 ≥6）与入库（含语义 desc）。
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'
import { svgElementCount } from './compose'
import { addAsset, categoryLabel, sanitizeName } from './asset-library'
import type { AssetMetaL } from './asset-library'
import { mockArtSvg } from './image-agent'

// 素材分类 → 素材智能体作画 kind（R2 起 gen_svg 支持 wide/inline/deco/divider/heading）
export function kindForCategory(category: string): string {
  switch (category) {
    case 'bubble':
    case 'deco':
      return 'deco'
    case 'divider':
      return 'divider'
    case 'heading':
      return 'heading'
    case 'banner':
    case 'art-wide':
    case 'photo-frame':
      return 'wide'
    default:
      return 'inline' // art-inline
  }
}

function validSvg(svg: string): boolean {
  return /<svg\b[^>]*viewBox="[^"]*"/.test(svg) && svgElementCount(svg) >= 6
}

/** 调用素材智能体画一个 SVG（分类 kind + 描述）。CLARIFY（要素不足回问）或失败 → 返回提示文案。 */
export async function generateAssetSvg(
  category: string,
  desc: string,
  theme?: string,
): Promise<{ ok: boolean; svg?: string; msg: string }> {
  const kind = kindForCategory(category)
  const d = String(desc || '').trim()
  if (!d) return { ok: false, msg: '请先描述素材长什么样（写清对象/形状/位置/配色）' }
  if (!inTauri()) {
    await new Promise((r) => setTimeout(r, 40))
    const s = mockArtSvg()
    return validSvg(s) ? { ok: true, svg: s, msg: '' } : { ok: false, msg: '本地样例素材生成失败' }
  }
  try {
    const svg = await invoke<string>('gen_svg', { kind, desc: d, theme: theme || null })
    if (svg.startsWith('CLARIFY:')) {
      return { ok: false, msg: `素材智能体需要补充：${svg.slice('CLARIFY:'.length).trim()}（请把画面说得更具体再试一次）` }
    }
    if (!validSvg(svg)) return { ok: false, msg: '素材智能体返回的 SVG 未达标（需带 viewBox 且图形元素 ≥6），请重试或换描述' }
    return { ok: true, svg, msg: '' }
  } catch (e) {
    return { ok: false, msg: `素材智能体调用失败：${String(e)}` }
  }
}

/**
 * 素材工坊制作并入库（origin=workshop）：SVG 校验通过后写入素材库，
 * desc 以用户描述为语义化自描述（用户随后可在编辑面板继续改 title/name/desc/tags）。
 */
export async function makeWorkshopAsset(
  category: string,
  desc: string,
  opts?: { title?: string },
): Promise<{ ok: boolean; meta?: AssetMetaL; msg: string }> {
  const g = await generateAssetSvg(category, desc)
  if (!g.ok || !g.svg) return { ok: false, msg: g.msg }
  const title = (opts?.title || '').trim() || `${categoryLabel(category)}（${desc.slice(0, 12)}${desc.length > 12 ? '…' : ''}）`
  const meta = await addAsset({
    category,
    name: sanitizeName(`${category}-${Date.now().toString(36)}`),
    title,
    desc: desc.trim(),
    usage: '', // 入库按分类默认推导
    origin: 'workshop',
    svg: g.svg,
  })
  if (!meta) return { ok: false, msg: '素材入库失败（写入本地素材库出错）' }
  return { ok: true, meta, msg: `已入库：${title}` }
}
