// 浏览器存储分支的生产调用回归：零模型、零浏览器、仅内存 localStorage。
import { resetStub, LS_DOCS, LS_ASSETS } from './lib/ls-stub.mjs'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { addAsset, getAsset, updateAsset } from '../src/lib/asset-library.ts'
import { saveDocument, openDocumentSafe, deleteDocument } from '../src/lib/documents.ts'

const judge = createJudge({ script: 'browser-asset-reference-check', outDir: resolveOutDir('browser-asset-reference-check'), minChecks: 8 })
guardCrashes(judge)
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`); judge.check(name, ok) }
resetStub()
const asset = await addAsset({ category: 'deco', name: 'reference', desc: '测试素材', svg: '<svg>old</svg>' })
if (!asset) throw new Error('素材夹具创建失败')
const ref = `[[asset:deco|${asset.id}|角饰]]`
const payload = (source, accepted) => ({ title: '测试文档', source, html: `<section>${source}</section>`, accepted })
await saveDocument('s-current', payload(ref, true))
await saveDocument('s-current', payload('更晚草稿没有引用，但成品仍有', false))
await saveDocument('s-draft-only', payload(ref, false))
await saveDocument('s-unused', payload('无引用的成品', true))
let result = await updateAsset(asset.id, {}, '<svg>new</svg>')
check('当前成品引用被找到且只有草稿的文档不在更新列表', result?.references.length === 1 && result.references[0].id === 's-current')
check('完整扫描不报错且更新只递增一次版本', result?.scanWarning === null && result?.meta.version === 2)

localStorage.setItem(LS_DOCS, '{ broken')
result = await updateAsset(asset.id, {}, '<svg>newer</svg>')
check('文档 JSON 损坏时扫描明确告警', result?.references.length === 0 && !!result?.scanWarning)
check('扫描失败不会谎报素材保存失败', result?.meta.version === 3 && (await getAsset(asset.id))?.svg === '<svg>newer</svg>')
check('损坏文档原件未被覆盖', localStorage.getItem(LS_DOCS) === '{ broken')

localStorage.setItem(LS_DOCS, JSON.stringify({ unrelated: true }))
result = await updateAsset(asset.id, {})
check('可解析但结构损坏的文档存储也会告警', !!result?.scanWarning)

localStorage.setItem(LS_DOCS, JSON.stringify({ docs: {
  's-good': { title: '好文档', source: ref, html: '<section/>', accepted: true },
  's-bad': { title: '缺源文', source: null, html: '<section/>', accepted: true },
} }))
result = await updateAsset(asset.id, {})
check('部分文档无法判定时保留有效引用并报告不完整', result?.references.length === 1 && result.references[0].id === 's-good' && !!result.scanWarning?.includes('1 篇'))

localStorage.removeItem(LS_DOCS)
result = await updateAsset(asset.id, {})
check('真正没有文档时可明确给出空清单', result?.references.length === 0 && result.scanWarning === null)
localStorage.setItem(LS_ASSETS, '{ broken asset')
check('素材库读取失败返回 null，不抛未处理异常', await updateAsset(asset.id, {}) === null)
localStorage.removeItem(LS_DOCS)
const first = await saveDocument('s-cas', payload('第一版', true))
const second = await saveDocument('s-cas', { ...payload('第二版', true), baseRevisionId: first.revisionId })
check('浏览器每次提交获得独立非空版本号', !!first.revisionId && !!second.revisionId && first.revisionId !== second.revisionId)
const beforeStale = localStorage.getItem(LS_DOCS)
const stale = await saveDocument('s-cas', { ...payload('迟到旧稿', true), baseRevisionId: first.revisionId })
check('迟到旧稿不能覆盖较新提交且存储字节不变', stale === null && localStorage.getItem(LS_DOCS) === beforeStale)
await deleteDocument('s-cas')
const deleted = localStorage.getItem(LS_DOCS)
check('带旧基准的迟到操作不能重建已删除文档', await saveDocument('s-cas', { ...payload('复活旧稿', true), baseRevisionId: second.revisionId }) === null && localStorage.getItem(LS_DOCS) === deleted)
localStorage.setItem(LS_DOCS, JSON.stringify({ docs: { 's-legacy': { ...payload('旧存档', true), updatedAt: 'old', warnings: [], snapshots: {}, bindings: [] } } }))
const legacy = await openDocumentSafe('s-legacy')
const legacyAgain = await openDocumentSafe('s-legacy')
check('旧存档补版本号后重读稳定且内容不变', legacy.ok && legacyAgain.ok && !!legacy.doc.revisionId && legacy.doc.revisionId === legacyAgain.doc.revisionId && legacy.doc.source === '旧存档')
const candidate = await saveDocument('s-legacy', { ...payload('候选草稿', false), baseRevisionId: legacy.doc.revisionId })
const kept = await openDocumentSafe('s-legacy')
check('草稿拥有独立版本且不改变成品基准和内容', candidate.revisionId !== legacy.doc.revisionId && kept.ok && kept.doc.revisionId === legacy.doc.revisionId && kept.doc.source === '旧存档' && kept.doc.draftRevisionId === candidate.revisionId)
judge.finish({ label: 'BROWSER-ASSET-REFERENCE' })
