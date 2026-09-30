import { useEffect, useRef, useState } from 'react'
import {
  ASSET_CATEGORIES,
  categoryLabel,
  deleteAsset,
  getAsset,
  getAssetSafe,
  listAssetsSafe,
  updateAsset,
} from '../lib/asset-library.ts'
import type { AssetMetaL, AssetRecordL, RefDocL } from '../lib/asset-library.ts'
import type { UnreadableItemL } from '../lib/sessions.ts'
import { generateAssetSvg, makeWorkshopAsset } from '../lib/asset-agent.ts'
import { openDocument, saveDocument } from '../lib/documents.ts'
import { splitAssistant } from '../lib/extract.ts'
import { composeMarkdown } from '../lib/compose.ts'
import { renderArtPlaceholders, svgToThumbDataUri } from '../lib/artRender.ts'
import { themeDeclaration } from '../lib/palettes.ts'
import { emptyMaterializeInfo, materializePlaceholders, needsMaterialize } from '../lib/image-agent.ts'
import { resetVisionBudget } from '../lib/vision.ts'
import type { MaterializeInfo } from '../lib/image-agent.ts'
import { bodyIntegrity, bodyText, collectDeliveryIssues, deliveryVerdict } from '../lib/delivery-quality.ts'
import { checkHtml } from '../lib/quality.ts'

// V3-R2 素材工坊工作区：顶栏「素材工坊」进入（决策 D1——本工作区由对应分类的素材智能体服务）。
// 一个工坊 + 库内分类（口径 3）：选分类 → 描述素材 → 素材智能体制作 → 入库（语义 desc 由用户描述即元数据）；
// 管理：检索（按分类 + 描述/名称/标签子串）、改名/改描述/改标签、替换 SVG 源（version+1 + 影响扫描，D5）。
function svgPreviewUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('读取图片失败'))
    r.readAsDataURL(file)
  })
}

export default function AssetWorkshop() {
  const [activeCat, setActiveCat] = useState<string>('bubble')
  const [items, setItems] = useState<AssetMetaL[]>([])
  // 素材库**读取失败**的原因（null = 未失败）。读不出来与"这个分类还没有素材"是两件事：
  // 前者保留上一次的 items 并说明原因 + 给重试，后者才是真的空。**纯展示**，不参与任何流程判断（铁律 6）。
  const [listError, setListError] = useState<string | null>(null)
  // 整体读得出来、但个别素材目录坏了（R2）：不在 items 里，只给一条简短提示
  const [unreadable, setUnreadable] = useState<UnreadableItemL[]>([])
  const [q, setQ] = useState('')
  const [makeDesc, setMakeDesc] = useState('')
  const [making, setMaking] = useState(false)
  const [msg, setMsg] = useState('')
  const [record, setRecord] = useState<AssetRecordL | null>(null)
  const [refDocs, setRefDocs] = useState<RefDocL[]>([])
  const msgTimer = useRef<number | null>(null)
  const [busySave, setBusySave] = useState(false)
  // P2 连续修改：修改指令 / 参考图 / 生成中的候选（先对比再采纳）
  const [editDesc, setEditDesc] = useState('')
  const [editRefs, setEditRefs] = useState<string[]>([])
  const [busyEdit, setBusyEdit] = useState(false)
  const [candidate, setCandidate] = useState<string | null>(null)
  const editFileRef = useRef<HTMLInputElement | null>(null)
  // D5 单篇重渲染的忙碌态（仅展示，不参与任何流程判断）：记录正在更新的文档 id
  const [busyRefDoc, setBusyRefDoc] = useState<string | null>(null)
  const refUpdateBusy = useRef<string | null>(null)

  const flash = (text: string, ms = 6000) => {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setMsg(text)
    msgTimer.current = window.setTimeout(() => {
      setMsg('')
      msgTimer.current = null
    }, ms)
  }

  const refresh = async () => {
    const r = await listAssetsSafe()
    if (!r.ok) {
      // 读不出来 ≠ 库里没有素材：保留上一次的 items（清空会让用户以为素材全被删了），
      // 只把原因放进 listError，由列表区显示"读取失败 + 重试"。
      setListError(r.error)
      return
    }
    setItems(r.items)
    setUnreadable(r.unreadable)
    setListError(null)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const visible = items.filter((m) => {
    if (m.category !== activeCat) return false
    const s = q.trim().toLowerCase()
    if (!s) return true
    const hay = `${m.name} ${m.title} ${m.desc} ${m.tags.join(' ')} ${categoryLabel(m.category)}`.toLowerCase()
    return hay.includes(s)
  })

  const openDetail = async (id: string) => {
    // 单体读取：区分"确实不存在"与"存在但读不出来"——两者文案不同，不能都显示成空详情
    const r = await getAssetSafe(id)
    setRecord(r.ok ? r.record : null)
    if (!r.ok) flash(r.notFound ? '素材不存在，可能已被删除' : `素材读取失败：${r.error}`, 6000)
    setRefDocs([])
    // 切换素材时清掉上一件素材的改版候选，避免"看的是 A、采纳到 B"
    setCandidate(null)
    setEditDesc('')
    setEditRefs([])
  }

  const doMake = async () => {
    if (making || !makeDesc.trim()) return
    setMaking(true)
    flash('素材智能体正在绘制…')
    const r = await makeWorkshopAsset(activeCat, makeDesc)
    setMaking(false)
    if (r.ok && r.meta) {
      setMakeDesc('')
      await refresh()
      await openDetail(r.meta.id)
      flash(`已入库（${r.msg}）。可在右侧修改名称/描述/标签；描述越具体，以后推文主智能体越容易检索到它`)
    } else {
      flash(r.msg, 8000)
    }
  }

  const doSaveMeta = async () => {
    if (!record) return
    setBusySave(true)
    const tags = record.meta.tags
    const r = await updateAsset(
      record.meta.id,
      {
        name: record.meta.name,
        title: record.meta.title,
        desc: record.meta.desc,
        tags,
      },
      undefined,
    )
    setBusySave(false)
    if (r) {
      await refresh()
      setRecord({ meta: r.meta, svg: record.svg })
      flash('元数据已保存')
    } else {
      flash('保存失败', 6000)
    }
  }

  // 用一段新 SVG 入库新版本（version+1）并做影响扫描——「替换源」与「连续修改」共用
  const applySvg = async (svg: string, what: string) => {
    if (!record) return
    setBusySave(true)
    const r = await updateAsset(record.meta.id, {}, svg)
    setBusySave(false)
    if (r) {
      await refresh()
      const fresh = await getAsset(record.meta.id)
      if (fresh) setRecord(fresh)
      setRefDocs(r.references)
      // 影响扫描不完整时必须说出来：把"某篇文档读不出来"当成"没有引用"会让人以为可以安全覆盖
      const scan = r.scanWarning ? `。注意：影响扫描不完整——${r.scanWarning}` : ''
      if (r.references.length) {
        flash(`${what}（version ${r.meta.version}）。正被 ${r.references.length} 篇文档引用——点下方「更新」才会把老文档换成新版（不点则保留其固化旧版）${scan}`, 12000)
      } else {
        flash(`${what}（version ${r.meta.version}），暂无文档引用${scan}`)
      }
    } else {
      flash('入库失败', 6000)
    }
  }

  const doReplaceSvg = async () => {
    if (!record) return
    await applySvg(record.svg, '源已替换')
  }

  // P2：把"当前素材 + 用户上传的参考图"一起交给素材智能体，生成改版候选（先看前后对比，再决定是否采纳）。
  // 当前素材由 webview 栅格化成 PNG 参考图（Rust 不做 SVG 光栅化），因此模型能真的"看着它改"。
  const doEdit = async () => {
    if (!record || busyEdit || !editDesc.trim()) return
    setBusyEdit(true)
    setCandidate(null)
    try {
      const refs: string[] = []
      const base = await svgToThumbDataUri(record.svg)
      if (base.startsWith('data:image/')) refs.push(base)
      refs.push(...editRefs)
      const brief = record.meta.desc ? `${record.meta.desc}；在此基础上修改：${editDesc.trim()}` : editDesc.trim()
      const g = await generateAssetSvg(record.meta.category, brief, undefined, { refImages: refs })
      if (g.ok && g.svg) setCandidate(g.svg)
      else flash(g.msg, 8000)
    } finally {
      setBusyEdit(false)
    }
  }

  const acceptCandidate = async () => {
    if (!candidate) return
    await applySvg(candidate, '已采纳新版本')
    setCandidate(null)
    setEditDesc('')
    setEditRefs([])
  }

  const pickEditRefs = async (files: FileList | null) => {
    if (!files || !files.length) return
    const urls: string[] = []
    for (const f of Array.from(files).slice(0, 3)) {
      if (!/^image\//.test(f.type)) continue
      if (f.size > 8 * 1024 * 1024) continue
      try {
        urls.push(await readAsDataUrl(f))
      } catch {
        // 跳过读不出的文件
      }
    }
    if (urls.length) setEditRefs((prev) => [...prev, ...urls].slice(0, 3))
    if (editFileRef.current) editFileRef.current.value = ''
  }

  // D5：被引用文档逐篇"用新版素材重渲染"（重跑该文档的素材解析 + compose + 素材 PNG 渲染，就地刷新）
  // 可能耗时（读素材 + 栅格化），故带忙碌态：进行中该按钮 disabled，且入口守卫避免重复触发。
  const rerenderDocWithCurrentAssets = async (docId: string) => {
    if (refUpdateBusy.current) return
    refUpdateBusy.current = docId
    setBusyRefDoc(docId)
    try {
      const doc = await openDocument(docId)
      if (!doc) {
        flash('文档不存在，可能已被删除', 6000)
        return
      }
      const { v2 } = splitAssistant(doc.source)
      if (!v2) {
        flash(`「${doc.title || docId}」没有可重渲染的 v2 正文`, 6000)
        return
      }
      resetVisionBudget()
      const info: MaterializeInfo = emptyMaterializeInfo()
      // W3（2026-09-29）：判定用 needsMaterialize——只含遗留纯文字 `::: art deco` 块的正文
      // 同样需要走恢复路径，否则会被当成"没有素材位"直接 compose。
      const matured = needsMaterialize(v2) ? await materializePlaceholders(v2, themeDeclaration(v2), info) : v2
      const comp = composeMarkdown(matured, {})
      const html = comp.arts.length ? await renderArtPlaceholders(comp.html, comp.arts) : comp.html
      const snaps: Record<string, { svg: string; ver: number }> = {}
      for (const id of Object.keys(info.used)) {
        const rec = await getAsset(id)
        if (rec) snaps[id] = { svg: rec.svg, ver: rec.meta.version }
      }
      // ---- 与其他入口同一条交付门禁（DS 修复指南 §6 末条）----
      // 这里过去是**唯一不经门禁就写文档库的入口**：直接把新 HTML 落盘，而且没传 accepted，
      // 于是 documents.ts 把它写成"草稿 + validation=failed"。三个后果：
      //   ① 提示条说"已就地刷新文档"，但 open_document 返回的仍是**已验收的旧版**——说刷新了其实没刷新；
      //   ② 凭空在该文档上留下一次"未通过门禁"的记录；
      //   ③ 下次打开会话还会显示"上次未通过交付门禁…草稿保留在对话里"——原因和位置都是编造的。
      // 现在的口径：跑同一套判定；通过才提交为成品，不通过就只存草稿并**如实说明**。
      const beforeText = bodyText(doc.html || '')
      const afterText = bodyText(html)
      const body = beforeText && afterText ? bodyIntegrity(beforeText, afterText) : null
      const bodyApplicability = beforeText && afterText ? ('applied' as const) : ('not-applicable' as const)
      const issues = collectDeliveryIssues({
        source: matured,
        html,
        plainText: afterText,
        composeIssues: comp.issues,
        rejectedArts: comp.rejectedArts,
        body,
      })
      const verdict = deliveryVerdict(issues, {
        // 真的调 `checkHtml`，不用"没有 html 类问题就算过"的等价写法——
        // 那样等于让调用方自证清白（这正是"checkHtml 失败却照常提交"的老路）。
        htmlOk: checkHtml(html).ok,
        body,
        bodyApplicability,
        // 只声明本轮真的查过的阶段（素材重渲染不涉及容量/版本核验）
        stagesChecked: ['parse', 'material', 'raster', 'html', 'body'],
        hasAcceptedHistory: Boolean(doc.acceptedRevisionId ?? doc.revisionId),
      })
      const saved = await saveDocument(docId, {
        title: doc.title,
        source: matured,
        html,
        warnings: comp.warnings,
        snapshots: snaps,
        bindings: info.bindings,
        accepted: verdict.ok,
        quality: verdict,
        validationVersion: 'dq-2026-09-29',
      })
      // saveDocument 内部会吞掉 Tauri 异常并返回 null——**必须查返回值**，
      // 否则保存失败也会说"已重渲染"，给用户一个假成功（比不提示更糟）。
      if (!saved) {
        flash('重渲染完成但保存失败，文档未更新，请稍后重试', 8000)
        return
      }
      if (verdict.ok) {
        flash(`已用新版素材重渲染「${doc.title || docId}」并提交为成品`)
      } else {
        const why = verdict.blockers.slice(0, 2).map((b) => b.message).join('；')
        flash(`重渲染结果未通过交付门禁，已存为草稿、成品保持原样：${why}`, 10000)
      }
    } catch (err) {
      console.warn('用新版素材重渲染文档失败', err)
      flash('重渲染失败，请稍后重试', 8000)
    } finally {
      refUpdateBusy.current = null
      setBusyRefDoc(null)
    }
  }

  const doDelete = async (id: string) => {
    // deleteAsset 返回是否真的删掉：失败时绝不清空详情、也不说"已删除"
    const ok = await deleteAsset(id)
    if (!ok) {
      flash('删除失败：素材未删除，请重试', 6000)
      return
    }
    if (record?.meta.id === id) {
      setRecord(null)
      setRefDocs([])
    }
    await refresh()
    flash('素材已删除')
  }

  const patchMeta = (p: Partial<AssetMetaL>) => {
    setRecord((prev) => (prev ? { meta: { ...prev.meta, ...p }, svg: prev.svg } : prev))
  }

  const cat = ASSET_CATEGORIES.find((c) => c.key === activeCat)
  const rec = record

  return (
    <div className="ws-pane" data-ws="1">
      <div className="ws-head">
        <span className="dot dot-green" />
        素材工坊
      </div>
      <div className="ws-body">
        <div className="ws-left">
          <div className="ws-cats">
            {ASSET_CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`ws-cat ${c.key === activeCat ? 'ws-cat-active' : ''}`}
                data-cat={c.key}
                title={c.hint}
                onClick={() => {
                  setActiveCat(c.key)
                  setQ('')
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="ws-make">
            <div className="ws-make-title">制作{cat?.label ?? ''}素材</div>
            <textarea
              className="ws-desc"
              rows={3}
              placeholder="用自然语言描述素材长什么样、适合放哪：对象/形状/位置/配色都写清楚，例如：右下角一朵小花的气泡角饰，浅暖色五瓣小花、花心一点金黄，用于 KEY 气泡右下角…"
              value={makeDesc}
              onChange={(e) => setMakeDesc(e.target.value)}
            />
            <div className="ws-make-row">
              <button className="btn btn-send ws-make-btn" disabled={making || !makeDesc.trim()} onClick={() => void doMake()}>
                {making ? '绘制中…' : '制作并入库'}
              </button>
            </div>
          </div>
          <div className="ws-search">
            <input
              className="ws-q"
              placeholder="在此分类内检索：按描述/名称/标签模糊匹配…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="ws-note">共 {visible.length} 条</span>
          </div>
          <div className="ws-list">
            {/* 读失败与"这个分类还没有素材"分开：前者保留上一次的条目并给原因 + 重试，
                后者才是真的空。data-list-error="1" 只在真失败时出现。 */}
            {listError && (
              <div className="ws-error" data-list-error="1">
                <span className="ws-error-text">素材库读取失败：{listError}</span>
                <button className="mini" onClick={() => void refresh()}>
                  重试
                </button>
              </div>
            )}
            {unreadable.length > 0 && (
              <div className="ws-unreadable" data-unreadable="1">
                有 {unreadable.length} 个素材无法读取
              </div>
            )}
            {visible.length === 0 && !listError && <div className="ws-empty">该分类还没有素材。</div>}
            {visible.map((m) => (
              <div
                key={m.id}
                className={`ws-row ${rec?.meta.id === m.id ? 'ws-row-active' : ''}`}
                data-id={m.id}
                onClick={() => void openDetail(m.id)}
              >
                <div className="ws-row-main">
                  <div className="ws-row-title">{m.title || m.name}</div>
                  <div className="ws-row-desc">{m.desc}</div>
                  <div className="ws-row-meta">
                    {m.name} · v{m.version} · 入库 {m.createdAt.slice(5, 16).replace('T', ' ')}
                  </div>
                </div>
                <button
                  className="mini mini-danger ws-del"
                  title="删除此素材"
                  onClick={(e) => {
                    e.stopPropagation()
                    void doDelete(m.id)
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="ws-right">
          {!rec ? (
            <div className="ws-empty-right" />
          ) : (
            <div className="ws-detail">
              <div className="ws-detail-head">
                <span className="ws-ver">素材详情 · v{rec.meta.version}</span>
                <span className="ws-ver-tag">{categoryLabel(rec.meta.category)} · usage={rec.meta.usage} · {rec.meta.origin === 'workshop' ? '工坊制作' : '推文现场补做'}</span>
              </div>
              <div className="ws-preview">
                <img src={svgPreviewUri(rec.svg)} alt="素材预览" />
              </div>
              <div className="ws-fields">
                <label>
                  名称
                  <input className="ws-name" value={rec.meta.name} onChange={(e) => patchMeta({ name: e.target.value })} />
                </label>
                <label>
                  标题
                  <input className="ws-title" value={rec.meta.title} onChange={(e) => patchMeta({ title: e.target.value })} />
                </label>
                <label>
                  语义描述
                  <textarea className="ws-desc-editor" rows={3} value={rec.meta.desc} onChange={(e) => patchMeta({ desc: e.target.value })} />
                </label>
                <label>
                  标签
                  <input
                    className="ws-tags"
                    value={rec.meta.tags.join('，')}
                    onChange={(e) =>
                      patchMeta({ tags: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })
                    }
                  />
                </label>
              </div>
              <div className="ws-actions">
                <button className="btn btn-send ws-save" disabled={busySave} onClick={() => void doSaveMeta()}>
                  保存修改
                </button>
                <button className="mini ws-replace" disabled={busySave || !rec.svg.trim()} title="用当前 SVG 源替换库中版本（version+1）" onClick={() => void doReplaceSvg()}>
                  替换源（{rec.meta.version + 1}）
                </button>
              </div>
              {refDocs.length > 0 && (
                <div className="ws-refs">
                  <div className="ws-refs-title">被引用文档</div>
                  {refDocs.map((d) => (
                    <div key={d.id} className="ws-ref-row" data-id={d.id}>
                      <span className="ws-ref-title">{d.title || d.id}</span>
                      {/* 忙碌期间**所有**重渲染按钮都禁用：入口守卫虽然能防住重复触发，
                          但"点了没反应"是比"禁用"更糟的反馈（用户分不清是没点到还是在忙）。
                          `data-busy="1"` 只标在真正在跑的那一个上。 */}
                      <button
                        className="mini ws-ref-update"
                        data-ref-update={d.id}
                        data-busy={busyRefDoc === d.id ? '1' : '0'}
                        disabled={busyRefDoc !== null}
                        onClick={() => void rerenderDocWithCurrentAssets(d.id)}
                      >
                        {busyRefDoc === d.id ? '更新中…' : '用新版更新'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* P2（2026-09-24 调查 §6）：连续修改——不用手写 SVG，用自然语言在当前素材上继续改 */}
              <div className="ws-edit">
                <div className="ws-edit-title">连续修改</div>
                <textarea
                  className="ws-edit-desc"
                  rows={2}
                  placeholder="例如：花心改成金黄一点，右下角再加一片小叶子；配色再淡一些…"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
                <div className="ws-edit-row">
                  <input ref={editFileRef} type="file" accept="image/*" multiple className="attach-input" onChange={(e) => void pickEditRefs(e.target.files)} />
                  <button className="mini ws-edit-ref" disabled={busyEdit} onClick={() => editFileRef.current?.click()}>
                    参考图
                  </button>
                  {editRefs.map((u, i) => (
                    <img key={i} className="ws-edit-ref-thumb" src={u} alt={`参考图 ${i + 1}`} />
                  ))}
                  <button
                    className="btn btn-send ws-edit-go"
                    disabled={busyEdit || !editDesc.trim()}
                    onClick={() => void doEdit()}
                  >
                    {busyEdit ? '绘制中…' : '生成新版'}
                  </button>
                </div>
                {candidate && (
                  <div className="ws-cmp" data-cmp="1">
                    <div className="ws-cmp-col">
                      <div className="ws-cmp-label">当前 v{rec.meta.version}</div>
                      <img src={svgPreviewUri(rec.svg)} alt="当前素材" />
                    </div>
                    <div className="ws-cmp-col">
                      <div className="ws-cmp-label">新版预览</div>
                      <img src={svgPreviewUri(candidate)} alt="新版素材" />
                    </div>
                  </div>
                )}
                {candidate && (
                  <div className="ws-edit-row">
                    <button className="btn btn-send ws-edit-accept" disabled={busySave} onClick={() => void acceptCandidate()}>
                      采纳为新版本（v{rec.meta.version + 1}）
                    </button>
                    <button className="mini ws-edit-drop" onClick={() => setCandidate(null)}>
                      放弃
                    </button>
                  </div>
                )}
              </div>

              <label className="ws-svg-editor-label">
                SVG 源
                <textarea
                  className="ws-svg"
                  rows={4}
                  value={rec.svg}
                  onChange={(e) => setRecord({ meta: rec.meta, svg: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      </div>
      {msg && <div className="ws-msg">{msg}</div>}
    </div>
  )
}
