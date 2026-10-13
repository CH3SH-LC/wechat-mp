// 零模型，调用生产 documents.ts 与真实 Tauri invoke，只在 IPC 最外层提供 Rust 响应。
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { registerHooks } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// 可选证红只在子进程的模块装载层撤销映射，绝不改工作区源码。
if (process.argv.includes('--mutate-save-response')) {
  const target = new URL('../src/lib/documents.ts', import.meta.url).href
  registerHooks({ load(url, context, nextLoad) {
    const loaded = nextLoad(url, context)
    if (url !== target) return loaded
    const source = String(loaded.source)
    if (!source.includes('return fromRustContent(saved)')) throw new Error('未找到保存回执映射，证红无法执行')
    return { ...loaded, source: source.replace('return fromRustContent(saved)', 'return saved') }
  } })
}
const { saveDocument, openDocumentSafe } = await import('../src/lib/documents.ts')

const judge = createJudge({ script: 'document-wire-check', outDir: resolveOutDir('document-wire-check'), minChecks: 8 })
guardCrashes(judge)
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`)
  judge.check(name, ok)
}
const wire = {
  id: 's-wire', title: '版本回执', updated_at: '2026-10-11T00:00:00Z',
  source: '正文', html: '<section>正文</section>', warnings: ['提示'],
  snapshots: { 'as-1': { svg: '<svg/>', ver: 3 } },
  bindings: [{ id: 'as-1', slot: '图', slotId: 'slot-1', source: 'library', reason: 'reuse' }],
  revision_id: 'r-new', accepted_revision_id: 'r-new', draft_revision_id: null,
  generation: 4, validation: 'verified', quality: { ok: true }, run_id: 'run-wire',
}
let payload
globalThis.window = { __TAURI_INTERNALS__: { invoke: async (cmd, args) => {
  if (cmd === 'save_document') payload = args
  else if (cmd !== 'open_document') throw new Error(`意外命令：${cmd}`)
  return structuredClone(wire)
} } }
const saved = await saveDocument('s-wire', {
  title: wire.title, source: wire.source, html: wire.html,
  accepted: true, quality: wire.quality, baseRevisionId: 'r-old', runId: 'run-wire',
})
const opened = await openDocumentSafe('s-wire')
check('保存和读取都返回当前版本 ID', saved?.revisionId === 'r-new' && opened.ok && opened.doc.revisionId === 'r-new')
check('保存回执保留成品和草稿指针', saved?.acceptedRevisionId === 'r-new' && saved?.draftRevisionId === undefined)
check('保存回执映射更新时间和来源 runId', saved?.updatedAt === wire.updated_at && saved?.runId === 'run-wire')
check('保存回执保留代数、质量、快照及绑定', saved?.generation === 4 && saved?.quality?.ok && saved?.snapshots['as-1'].ver === 3 && saved?.bindings[0].slotId === 'slot-1')
check('保存与读取响应完全同形', opened.ok && JSON.stringify(saved) === JSON.stringify(opened.doc))
check('保存发送基准版本和成品契约', payload?.baseRevisionId === 'r-old' && payload?.asDraft === false && payload?.validation === 'verified')
wire.revision_id = 'r-draft'; wire.draft_revision_id = 'r-draft'; wire.validation = 'failed'
const draft = await saveDocument('s-wire', { title: wire.title, source: wire.source, html: wire.html, accepted: false })
check('草稿回执保留候选和原成品两个不同版本', draft?.revisionId === 'r-draft' && draft?.acceptedRevisionId === 'r-new' && draft?.draftRevisionId === 'r-draft' && payload?.asDraft)
check('旧形状对照确实无法提供 revisionId，判据可证伪', wire.revisionId === undefined && saved?.revisionId !== wire.revisionId)
globalThis.window.__TAURI_INTERNALS__.invoke = async () => { throw new Error('测试：拒绝保存') }
check('IPC 保存失败仍返回 null', await saveDocument('s-wire', { title: '', source: '', html: '' }) === null)
if (process.argv.includes('--prove-red')) {
  const red = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--mutate-save-response'], { encoding: 'utf8' })
  check('撤销保存映射后的生产调用实跑变红', red.status === 1 && red.stdout.includes('FAIL - 保存和读取都返回当前版本 ID') && red.stdout.includes('FAIL - 保存与读取响应完全同形'))
}
judge.finish({ label: 'DOCUMENT-WIRE' })
