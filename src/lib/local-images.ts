// 用户原图与生成插画是两种资产。原图按内容哈希保存，成品嵌入原始字节；
// modelDataUrl 只供模型看图，永远不能拿缩略图替换成品原图。
import { invoke } from '@tauri-apps/api/core'
import { composeMarkdown } from './compose.ts'
import { extractHtml, splitAssistant } from './extract.ts'

export interface LocalImageMeta {
  assetId: string
  name: string
  mime: string
  width: number
  height: number
  byteLength: number
}

export interface LocalImageRecord extends LocalImageMeta {
  dataUrl: string
  modelDataUrl: string
}

export const LOCAL_IMAGE_ID = /^li-[a-f0-9]{64}$/
export const MAX_ATTACHED_IMAGES = 8
const imageReads = new Map<string, { promise: Promise<LocalImageRecord>; bytes: number }>()
const imageUpdates = new Set<(assetId: string) => void>()

export function onLocalImageImported(listener: (assetId: string) => void): () => void {
  imageUpdates.add(listener)
  return () => { imageUpdates.delete(listener) }
}
// 128MiB 是历史缓存目标，当前稿最多八张必须保留；每张原件另受32MiB与缩图上限约束。
// 否则三张32MiB原图的base64刚超过此目标，流式预览便会循环淘汰/重新读盘。
const CACHE_BYTES = 128 * 1024 * 1024

function cacheImage(assetId: string, promise: Promise<LocalImageRecord>): Promise<LocalImageRecord> {
  const entry = { promise, bytes: 0 }
  imageReads.set(assetId, entry)
  void promise.then((image) => {
    if (imageReads.get(assetId) !== entry) return
    entry.bytes = image.dataUrl.length + image.modelDataUrl.length
    let total = [...imageReads.values()].reduce((sum, item) => sum + item.bytes, 0)
    let completed = [...imageReads.values()].filter((item) => item.bytes > 0).length
    for (const [id, item] of imageReads) {
      if (completed <= MAX_ATTACHED_IMAGES || (imageReads.size <= 24 && total <= CACHE_BYTES)) break
      // 进行中的相同 ID 请求始终合并；不能因流式文本变化不断重新读盘。
      if (item.bytes && id !== assetId) { imageReads.delete(id); total -= item.bytes; completed-- }
    }
  }, () => { if (imageReads.get(assetId) === entry) imageReads.delete(assetId) })
  return promise
}

export function localImageMeta(image: LocalImageMeta): LocalImageMeta {
  return { assetId: image.assetId, name: image.name, mime: image.mime, width: image.width, height: image.height, byteLength: image.byteLength }
}

export async function importLocalImage(input: { dataUrl?: string; path?: string; name?: string }): Promise<LocalImageRecord> {
  const image = await invoke<LocalImageRecord>('import_local_image', input)
  const cached = cacheImage(image.assetId, Promise.resolve(image))
  for (const notify of imageUpdates) notify(image.assetId)
  return cached
}

export async function getLocalImage(assetId: string): Promise<LocalImageRecord> {
  if (!LOCAL_IMAGE_ID.test(assetId)) throw new Error('本地图片引用无效，请重新添加该图片。')
  const cached = imageReads.get(assetId)
  if (cached) {
    imageReads.delete(assetId)
    imageReads.set(assetId, cached)
    return cached.promise
  }
  return cacheImage(assetId, invoke<LocalImageRecord>('get_local_image', { assetId }))
}

export function localImageContext(images: LocalImageMeta[], visible = true): string {
  if (!images.length) return ''
  return '\n\n【用户提供的本地原图】\n' + images.map((image, i) =>
    `${i + 1}. ${JSON.stringify(image.name)}，${image.width}×${image.height}；原图引用：![图片说明](local-image://${image.assetId})`,
  ).join('\n') + (visible ? '\n所附图像按清单顺序对应这些原图。' : '\n这是已导入图片的历史清单，不代表本条消息附带了图像；需要重新看图时可按 assetId 调用 read_local_image。') + '请根据实际画面理解内容；用户要求使用照片时用以上引用插入正文，不能改画成插画或留下照片占位。无法辨认的文字或细节请如实说明。'
}

/** 顺序与重复次数均保留，用于检查“仅改文字”没有删图/偷换图。 */
export function localImageIds(source: string): string[] {
  return composeMarkdown(source).images.map((image) => /^local-image:\/\/(li-[a-f0-9]{64})$/i.exec(image.local)?.[1]).filter((id): id is string => Boolean(id))
}

export function localImageIdsFromHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return [...doc.querySelectorAll('img[src]')].map((image) => /^local-image:\/\/(li-[a-f0-9]{64})$/i.exec(image.getAttribute('src') || '')?.[1]).filter((id): id is string => Boolean(id))
}

/** 仅供已经保存的文稿读取：兼容历史“源文”误存了整份助手外层围栏的版本。 */
export function savedLocalImageIds(source: string): string[] {
  if (/^\s*```v2\b/m.test(source)) {
    const split = splitAssistant(source)
    if (split.v2 && !split.v2Ambiguous) return localImageIds(split.v2)
  }
  const html = extractHtml(source)
  return html ? localImageIdsFromHtml(html.html) : localImageIds(source)
}

export function missingPreservedLocalImages(before: string, after: string): string[] {
  return missingLocalImageIds(localImageIds(before), localImageIds(after))
}

export function missingLocalImageIds(before: string[], after: string[]): string[] {
  const counts = new Map<string, number>()
  for (const id of after) counts.set(id, (counts.get(id) || 0) + 1)
  return before.filter((id) => {
    const n = counts.get(id) || 0
    if (!n) return true
    counts.set(id, n - 1)
    return false
  })
}

/** 只解析明确的图片 src，不触碰正文、链接或代码示例，也不读取任意模型提供的磁盘路径。 */
export async function renderLocalImages(html: string): Promise<string> {
  if (!/local-image:/i.test(html)) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const refs = [...doc.querySelectorAll('img[src]')].filter((image) => /^local-image:/i.test(image.getAttribute('src') || ''))
  if (!refs.length) return html
  // 不通过DOM归一化悄悄移除原HTML里的非法文档头/脚本/样式，从而绕过原有质检。
  if (/<(?:html|head|body|style|script)\b/i.test(html)) throw new Error('带原图的文章必须是正文片段，不能含文档头、脚本或样式标签。')
  const records = new Map<string, LocalImageRecord>()
  for (const ref of refs) {
    const id = (ref.getAttribute('src') || '').slice('local-image://'.length)
    if (records.has(id)) continue
    const image = await getLocalImage(id)
    if (image.assetId !== id || !/^data:image\/(?:png|jpeg|webp|gif|bmp);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl)) {
      throw new Error('本地图片读取结果无效，未使用缩略图或生成图替代。请重新添加原图。')
    }
    records.set(id, image)
  }
  for (const ref of refs) ref.setAttribute('src', records.get((ref.getAttribute('src') || '').slice('local-image://'.length))!.dataUrl)
  return doc.body.innerHTML
}
