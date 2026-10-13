// R36: real Vite-loaded retrieval, registry and tool readback. No model, App or native workspace.
// Usage: node scripts/writing-retirement-check.mjs [outDir] [http://127.0.0.1:<port>]
// The caller owns the Vite server, as with the other browser contract checks.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJudge, guardCrashes, parseRunnerArgs } from './lib/run-result.mjs'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { outDir, base } = parseRunnerArgs()
const writingNames = ['00-索引', 'writing-purpose', 'writing-language', 'writing-structure', 'writing-campus', 'writing-product', 'writing-explain', 'writing-story', 'writing-review']
const toolNames = writingNames.filter(name => name.startsWith('writing-'))
// The two retired 00-索引 files are checked by path: active directions intentionally share that short name.
const retiredNames = [
  'copy-end', 'copy-guide-checklist', 'copy-guide-from-topic', 'copy-guide-length', 'copy-guide-platform',
  'copy-guide-principles', 'copy-guide-vivid-news', 'copy-layout', 'copy-open', 'copy-points', 'copy-quote',
  'copy-redline', 'copy-style-basics', 'copy-style-rhythm', 'copy-style-vivid', 'copy-subheading', 'copy-tags',
  'copy-title', 'copy-tpl-brand', 'copy-tpl-emotion', 'copy-tpl-news', 'copy-tpl-person', 'copy-tpl-promo',
  'copy-tpl-soft', 'copy-tpl-tutorial', 'copy-transition',
  'type-announcement', 'type-brand-story', 'type-catalog', 'type-choose', 'type-emotion', 'type-list',
  'type-mix', 'type-news', 'type-person-story', 'type-promo', 'type-science', 'type-serial', 'type-soft', 'type-tutorial',
]
const searches = [
  ['写作', ['writing-purpose', 'writing-structure']],
  ['开头', ['writing-purpose', 'writing-structure']],
  ['标题', ['writing-purpose', 'writing-structure']],
  ['结尾', ['writing-structure', 'writing-review']],
  ['审稿', ['writing-review']],
  ['语言', ['writing-language', 'writing-review']],
  ['碎句', ['writing-language']],
  ['润色', ['writing-language', 'writing-review']],
  ['校园活动', ['writing-campus']],
  ['大学生社团招新', ['writing-campus']],
  ['产品介绍', ['writing-product']],
  ['软文', ['writing-product']],
  ['科普', ['writing-explain']],
  ['教程', ['writing-explain']],
  ['人物故事', ['writing-story']],
  ['更花一点，更精致一点', ['module-bubble', 'style-campus', 'style-guide-choose']],
  ['校园推文有几个章节，气泡精致些', ['module-bubble', 'module-heading', 'style-campus']],
  ['花笺票笺缎带', ['module-bubble', 'module-heading', 'module-divider-page']],
  ['极简，气泡精致但少装饰', ['style-minimal', 'module-bubble']],
]
const planned = [
  'manifest-files', 'manifest-runtime', 'active-no-retired-paths', 'active-no-retired-names',
  'active-no-retired-links', 'registry-no-retired', 'registry-has-writing', 'writing-exact-current-set',
  ...writingNames.map(name => `readback:${name}`),
  ...toolNames.map(name => `load:${name}`),
  ...retiredNames.map(name => `retired:${name}`),
  ...searches.map(([query]) => `search:${query}`),
  'no-external-requests', 'no-native-invocations', 'no-page-errors', 'source-stable',
]
const judge = createJudge({ script: 'writing-retirement-check', outDir, plannedCases: planned, minChecks: planned.length })
guardCrashes(judge)
const check = (id, ok, evidence = []) => {
  judge.check(id, ok, evidence)
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${id}`)
}
const sha = text => createHash('sha256').update(text).digest('hex')
const knowledgeRoot = join(repoRoot, 'src', 'knowledge')
function diskEntries(dir = knowledgeRoot) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const path = join(dir, item.name)
    if (item.isDirectory()) return diskEntries(path)
    if (!item.isFile() || !item.name.endsWith('.md')) return []
    return [{ path: '/' + path.slice(repoRoot.length + 1).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }]
  }).sort((a, b) => a.path.localeCompare(b.path))
}
const manifest = entries => Object.fromEntries(entries.map(entry => [entry.path, sha(entry.text)]))
const retiredPath = path => /\/文本\/(文案|内容类型)\//.test(path)
const retiredToken = /\b(?:copy|type)-[a-z][a-z0-9-]*/g
const links = text => [...String(text).matchAll(retiredToken)].map(match => match[0])
let browser = null
let evidence = null
try {
  let chromium
  try {
    const requested = process.env.VERIFY_PLAYWRIGHT
    chromium = (requested ? require(isAbsolute(requested) ? requested : resolve(requested)) : require('playwright')).chromium
    if (process.env.VERIFY_CHROMIUM && !existsSync(process.env.VERIFY_CHROMIUM)) throw new Error('VERIFY_CHROMIUM does not exist')
  } catch (error) {
    judge.block(`Playwright/Chromium dependency: ${error.message}`)
  }
  if (!judge.run.blockedReason) {
    const url = new URL(base)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('This check requires a loopback Vite URL')
    const before = diskEntries()
    judge.run.sourceHashes = { ...manifest(before), '/src/lib/retrieval.ts': sha(readFileSync(join(repoRoot, 'src/lib/retrieval.ts'))) }
    browser = await chromium.launch({ headless: true, ...(process.env.VERIFY_CHROMIUM ? { executablePath: resolve(process.env.VERIFY_CHROMIUM) } : {}) })
    const page = await browser.newPage()
    const offsite = []
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(String(error)))
    await page.route('**/*', route => {
      const requested = route.request().url()
      if (new URL(requested).origin === url.origin) return route.fallback()
      offsite.push(requested)
      return route.abort('blockedbyclient')
    })
    // A blank same-origin page avoids loading App or any model transport; only retrieval is imported.
    await page.route('**/__writing_retirement_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Writing retrieval contract</title>' }))
    await page.goto(new URL('/__writing_retirement_probe__', url).href, { waitUntil: 'domcontentloaded' })
    evidence = await page.evaluate(async ({ toolNames, retiredNames, queries }) => {
      let nativeCalls = 0
      window.__TAURI_INTERNALS__ = { invoke: async () => { nativeCalls++; throw new Error('Native transport is forbidden in this check') } }
      const retrieval = await import('/src/lib/retrieval.ts')
      const entries = await retrieval.ensureKnowledgeLoaded()
      const registry = await retrieval.buildRegistry()
      const load = async name => [name, await retrieval.runKnowledgeTool({ name: 'load_knowledge', args: JSON.stringify({ name }) })]
      const loaded = Object.fromEntries(await Promise.all(toolNames.map(load)))
      const retired = Object.fromEntries(await Promise.all(retiredNames.map(load)))
      const searched = Object.fromEntries(await Promise.all(queries.map(async query => [query, await retrieval.runKnowledgeTool({ name: 'search_knowledge', args: JSON.stringify({ query }) })])))
      return { entries, registry, loaded, retired, searched, nativeCalls }
    }, { toolNames, retiredNames, queries: searches.map(([query]) => query) })
    const runtime = [...evidence.entries].sort((a, b) => a.path.localeCompare(b.path))
    check('manifest-files', before.length >= writingNames.length && new Set(before.map(entry => entry.path)).size === before.length, `files=${before.length}`)
    check('manifest-runtime', JSON.stringify(manifest(runtime)) === JSON.stringify(manifest(before)), `runtime=${runtime.length}, disk=${before.length}`)
    check('active-no-retired-paths', !before.some(entry => retiredPath(entry.path)) && !runtime.some(entry => retiredPath(entry.path)))
    check('active-no-retired-names', !runtime.some(entry => /^(copy|type)-/.test(entry.name)))
    const staleLinks = runtime.flatMap(entry => links(entry.text).map(token => `${entry.path}: ${token}`))
    check('active-no-retired-links', staleLinks.length === 0, staleLinks)
    check('registry-no-retired', !evidence.registry.includes('文本/文案') && !evidence.registry.includes('文本/内容类型') && links(evidence.registry).length === 0)
    check('registry-has-writing', evidence.registry.includes('【文本/写作】') && toolNames.every(name => evidence.registry.includes(`- ${name}｜`)))
    const writingEntries = runtime.filter(entry => entry.path.startsWith('/src/knowledge/文本/写作/'))
    check('writing-exact-current-set', writingEntries.length === writingNames.length && writingNames.every(name => writingEntries.some(entry => entry.name === name)))
    for (const name of writingNames) {
      const path = `/src/knowledge/文本/写作/${name}.md`
      const disk = before.find(entry => entry.path === path)
      const actual = runtime.find(entry => entry.path === path)
      check(`readback:${name}`, Boolean(disk?.text) && actual?.text === disk.text, actual ? sha(actual.text) : 'missing runtime entry')
    }
    for (const name of toolNames) {
      const disk = before.find(entry => entry.path === `/src/knowledge/文本/写作/${name}.md`)
      check(`load:${name}`, Boolean(disk?.text) && disk.text.length <= 6000 && evidence.loaded[name] === `# ${name}（文本）\n${disk.text}`, `characters=${disk?.text.length ?? 0}`)
    }
    for (const name of retiredNames) {
      check(`retired:${name}`, evidence.retired[name] === `未找到知识文件「${name}」。可在注册表查看点文件名，或改用 search_knowledge 检索。`, evidence.retired[name])
    }
    for (const [query, expected] of searches) {
      const result = evidence.searched[query]
      const returned = [...result.matchAll(/^- ([^｜\n]+)｜/gm)].map(match => match[1])
      check(`search:${query}`, expected.every(name => returned.includes(name)) && returned.every(name => runtime.some(entry => entry.name === name)) && links(result).length === 0, result)
    }
    check('no-external-requests', offsite.length === 0, offsite)
    check('no-native-invocations', evidence.nativeCalls === 0, evidence.nativeCalls)
    check('no-page-errors', pageErrors.length === 0, pageErrors)
    const after = { ...manifest(diskEntries()), '/src/lib/retrieval.ts': sha(readFileSync(join(repoRoot, 'src/lib/retrieval.ts'))) }
    check('source-stable', JSON.stringify(after) === JSON.stringify(judge.run.sourceHashes))
    judge.observe('boundary', 'Real knowledge module and tool results only; no model output quality, build or desktop acceptance claimed.')
  }
} catch (error) {
  judge.error('runtime', error.stack || error.message || error)
} finally {
  if (browser) await browser.close().catch(error => judge.error('close-browser', error.message))
  judge.finish({ label: 'WRITING-RETIREMENT', extraFiles: evidence ? { 'retrieval-readback.json': JSON.stringify(evidence, null, 2) + '\n' } : {} })
}
