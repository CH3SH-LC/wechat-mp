// fixtures.mjs —— 读取 scripts/fixtures 下的失败样例，灌进 localStorage 桩。
// 只读：夹具目录是回归样例，脚本任何情况下都不得写回。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LS_ASSETS, rawStore } from './ls-stub.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(here, '..', 'fixtures')

/** 样例目录绝对路径（不存在时抛错——静默跳过会让断言失去意义） */
export function fixtureDir(name) {
  const p = join(FIXTURES, name)
  if (!existsSync(p)) throw new Error(`样例目录不存在：${p}`)
  return p
}

/** 读失败稿正文（source.md） */
export function failingSource(name = '2026-09-28-basement') {
  return readFileSync(join(fixtureDir(name), 'failing-source.md'), 'utf8')
}

/** 读当时保存的告警与绑定（meta.json） */
export function failingDoc(name = '2026-09-28-basement') {
  return JSON.parse(readFileSync(join(fixtureDir(name), 'failing-doc.json'), 'utf8'))
}

/**
 * 读样例素材（原始 meta.json + source.svg，字段名转成前端 AssetMetaL 的驼峰口径）。
 * 返回 [{ meta, svg }]，id 保持真实库 id，方便断言"按 ID 绑定"。
 */
export function fixtureAssets(name = '2026-09-28-basement') {
  const root = join(fixtureDir(name), 'assets')
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dir = join(root, e.name)
      const raw = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
      return {
        meta: {
          id: String(raw.id ?? ''),
          category: String(raw.category ?? ''),
          name: String(raw.name ?? ''),
          title: String(raw.title ?? ''),
          desc: String(raw.desc ?? ''),
          tags: Array.isArray(raw.tags) ? raw.tags : [],
          usage: String(raw.usage ?? ''),
          placement: String(raw.placement ?? ''),
          style: Array.isArray(raw.style) ? raw.style : [],
          palette_note: String(raw.palette_note ?? ''),
          version: Number(raw.version ?? 1),
          origin: String(raw.origin ?? 'workshop'),
          createdAt: String(raw.created_at ?? ''),
          updatedAt: String(raw.updated_at ?? ''),
        },
        svg: readFileSync(join(dir, 'source.svg'), 'utf8'),
      }
    })
}

/** 把样例素材直接写进内存素材库（绕过 addAsset，保留真实 id 与版本） */
export function seedFixtureAssets(name = '2026-09-28-basement') {
  const items = {}
  for (const a of fixtureAssets(name)) items[a.meta.id] = { meta: a.meta, svg: a.svg }
  globalThis.localStorage.setItem(LS_ASSETS, JSON.stringify({ items }))
  const back = JSON.parse(rawStore(LS_ASSETS) || '{}')
  return Object.keys(back.items || {}).length
}
