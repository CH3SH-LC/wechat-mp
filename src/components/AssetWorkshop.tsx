import { useEffect, useRef, useState } from 'react'
import {
  ASSET_CATEGORIES,
  categoryLabel,
  deleteAsset,
  getAsset,
  listAssets,
  updateAsset,
} from '../lib/asset-library'
import type { AssetMetaL, AssetRecordL, RefDocL } from '../lib/asset-library'
import { makeWorkshopAsset } from '../lib/asset-agent'
import { openDocument, saveDocument } from '../lib/documents'
import { splitAssistant } from '../lib/extract'
import { composeMarkdown } from '../lib/compose'
import { renderArtPlaceholders } from '../lib/artRender'
import { themeDeclaration } from '../lib/palettes'
import { hasPlaceholders, materializePlaceholders } from '../lib/image-agent'
import type { MaterializeInfo } from '../lib/image-agent'

// V3-R2 素材工坊工作区：顶栏「素材工坊」进入（决策 D1——本工作区由对应分类的素材智能体服务）。
// 一个工坊 + 库内分类（口径 3）：选分类 → 描述素材 → 素材智能体制作 → 入库（语义 desc 由用户描述即元数据）；
// 管理：检索（按分类 + 描述/名称/标签子串）、改名/改描述/改标签、替换 SVG 源（version+1 + 影响扫描，D5）。
function svgPreviewUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export default function AssetWorkshop() {
  const [activeCat, setActiveCat] = useState<string>('bubble')
  const [items, setItems] = useState<AssetMetaL[]>([])
  const [q, setQ] = useState('')
  const [makeDesc, setMakeDesc] = useState('')
  const [making, setMaking] = useState(false)
  const [msg, setMsg] = useState('')
  const [record, setRecord] = useState<AssetRecordL | null>(null)
  const [refDocs, setRefDocs] = useState<RefDocL[]>([])
  const msgTimer = useRef<number | null>(null)
  const [busySave, setBusySave] = useState(false)

  const flash = (text: string, ms = 6000) => {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setMsg(text)
    msgTimer.current = window.setTimeout(() => {
      setMsg('')
      msgTimer.current = null
    }, ms)
  }

  const refresh = async () => {
    const all = await listAssets()
    setItems(all)
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
    const r = await getAsset(id)
    setRecord(r)
    setRefDocs([])
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

  const doReplaceSvg = async () => {
    if (!record) return
    setBusySave(true)
    const r = await updateAsset(record.meta.id, {}, record.svg)
    setBusySave(false)
    if (r) {
      await refresh()
      const fresh = await getAsset(record.meta.id)
      if (fresh) setRecord(fresh)
      setRefDocs(r.references)
      if (r.references.length) {
        flash(`源已替换（version ${r.meta.version}）。正被 ${r.references.length} 篇文档引用——点下方「更新」才会把老文档换成新版（不点则保留其固化旧版）`, 12000)
      } else {
        flash(`源已替换（version ${r.meta.version}），暂无文档引用`)
      }
    } else {
      flash('替换失败', 6000)
    }
  }

  // D5：被引用文档逐篇"用新版素材重渲染"（重跑该文档的素材解析 + compose + 素材 PNG 渲染，就地刷新）
  const rerenderDocWithCurrentAssets = async (docId: string) => {
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
    const info: MaterializeInfo = { used: {}, residual: 0, storedFallback: 0 }
    const matured = hasPlaceholders(v2) ? await materializePlaceholders(v2, themeDeclaration(v2), info) : v2
    const comp = composeMarkdown(matured, {})
    const html = comp.arts.length ? await renderArtPlaceholders(comp.html, comp.arts) : comp.html
    const snaps: Record<string, { svg: string; ver: number }> = {}
    for (const id of Object.keys(info.used)) {
      const rec = await getAsset(id)
      if (rec) snaps[id] = { svg: rec.svg, ver: rec.meta.version }
    }
    await saveDocument(docId, {
      title: doc.title,
      source: doc.source,
      html,
      warnings: comp.warnings,
      snapshots: snaps,
    })
    flash(`已用新版素材重渲染「${doc.title || docId}」并就地刷新文档`)
  }

  const doDelete = async (id: string) => {
    await deleteAsset(id)
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
        <span className="hint">个人素材库：选分类 → 由该分类素材智能体制作入库；推文创作时主智能体直接检索复用</span>
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
            <div className="ws-make-title">制作{cat?.label ?? ''}素材（{cat?.hint ?? ''}）</div>
            <textarea
              className="ws-desc"
              rows={3}
              placeholder="用自然语言描述素材长什么样、适合放哪：对象/形状/位置/配色都写清楚，例如：右下角一朵小花的气泡角饰，浅暖色五瓣小花、花心一点金黄，用于 KEY 气泡右下角…"
              value={makeDesc}
              onChange={(e) => setMakeDesc(e.target.value)}
            />
            <div className="ws-make-row">
              <span className="ws-note">入库时即带语义描述（以后主智能体按它检索）；可随后在右侧修改</span>
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
            {visible.length === 0 && <div className="ws-empty">该分类还没有素材。用上方描述制作第一个素材入库吧。</div>}
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
            <div className="ws-empty-right">点选左侧素材查看/编辑；制作完成后会自动选中</div>
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
                  名称（机器引用名，小写字母数字中划线）
                  <input className="ws-name" value={rec.meta.name} onChange={(e) => patchMeta({ name: e.target.value })} />
                </label>
                <label>
                  标题
                  <input className="ws-title" value={rec.meta.title} onChange={(e) => patchMeta({ title: e.target.value })} />
                </label>
                <label>
                  语义描述（越具体，主智能体越容易检索命中——写清这是什么/长什么样/适合放哪）
                  <textarea className="ws-desc-editor" rows={3} value={rec.meta.desc} onChange={(e) => patchMeta({ desc: e.target.value })} />
                </label>
                <label>
                  标签（逗号分隔）
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
                  <div className="ws-refs-title">被引用文档（引用时已固化旧版快照；改版是否扩散由你逐篇决定）</div>
                  {refDocs.map((d) => (
                    <div key={d.id} className="ws-ref-row" data-id={d.id}>
                      <span className="ws-ref-title">{d.title || d.id}</span>
                      <button className="mini ws-ref-update" onClick={() => void rerenderDocWithCurrentAssets(d.id)}>
                        用新版更新
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="ws-svg-editor-label">
                SVG 源（可编辑后点「替换源」入库新版本；替换会检查引用它的老文档）
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
