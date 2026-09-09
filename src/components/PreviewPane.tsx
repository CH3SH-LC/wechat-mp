import { useRef, useState } from 'react'
import type { QualityResult } from '../lib/quality'
import { exportHtml } from '../lib/exportHtml'
import { exportArticleImages } from '../lib/exportImages'

interface Props {
  html: string | null
  quality: QualityResult | null
  warnings?: string[]
  onClear: () => void
}

function wrapSrcDoc(html: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  html,body{margin:0;padding:0;background:#ffffff;}
  body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;width:375px;max-width:100%;margin:0 auto;padding:0 0 40px;box-sizing:border-box;}
</style>
</head>
<body>
${html}
</body>
</html>`
}

export default function PreviewPane({ html, quality, warnings = [], onClear }: Props) {
  const [copied, setCopied] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [exportMsg, setExportMsg] = useState('')
  const [exportingImg, setExportingImg] = useState(false)
  const msgTimer = useRef<number | null>(null)

  const flashMsg = (setter: (v: string) => void, text: string, ms = 8000) => {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setter(text)
    msgTimer.current = window.setTimeout(() => {
      setter('')
      msgTimer.current = null
    }, ms)
  }

  const copy = async () => {
    if (!html) return
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const doExport = async () => {
    if (!html) return
    const r = await exportHtml(html)
    flashMsg(setExportMsg, r.ok ? `已导出：${r.msg}` : `导出失败：${r.msg}`)
  }

  // 第 34 轮：HTML → 图片（长图 + 分页），替代微信 API 发草稿箱，由用户手动上传
  const doExportImg = async () => {
    if (!html) return
    setExportingImg(true)
    flashMsg(setExportMsg, '正在把正文渲染为图片（长图 + 分页）…')
    try {
      const r = await exportArticleImages(html)
      flashMsg(setExportMsg, r.ok ? r.msg : `导出图片失败：${r.msg}`, 20000)
    } catch (e) {
      flashMsg(setExportMsg, `导出图片失败：${String(e)}`, 20000)
    } finally {
      setExportingImg(false)
    }
  }

  return (
    <div className="preview-pane">
      <div className="preview-head">
        <span className="dot dot-green" />
        推文预览 · 375px
        <div className="preview-actions">
          <button className="mini" onClick={() => setZoom((z) => (z >= 1.5 ? 1 : z + 0.25))}>
            {Math.round(zoom * 100)}%
          </button>
          <button className="mini" onClick={copy} disabled={!html}>
            {copied ? '已复制' : '复制 HTML'}
          </button>
          <button className="mini" onClick={() => void doExportImg()} disabled={!html || exportingImg} title="把当前正文渲染成图片（长图+分页 2x 高清），导出后手动上传使用">
            {exportingImg ? '转图中…' : '导出图片'}
          </button>
          <button className="mini" onClick={() => void doExport()} disabled={!html}>
            导出 HTML
          </button>
          <button className="mini mini-danger" onClick={onClear} disabled={!html}>
            清空
          </button>
        </div>
      </div>

      {exportMsg && <div className="export-msg">{exportMsg}</div>}
      {warnings.length > 0 && (
        <div className="compose-warn">
          {warnings.slice(0, 3).map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {html && quality && (
        <div className={`quality-strip ${quality.ok ? 'q-ok' : 'q-fail'}`}>
          <span className="q-title">{quality.ok ? '质量检查 · 通过' : `质量检查 · ${quality.issues.length} 项问题`}</span>
          {!quality.ok && (
            <ul className="q-list">
              {quality.issues.slice(0, 5).map((it, i) => (
                <li key={i}>
                  {it.kind}: {it.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="preview-body">
        {!html ? (
          <div className="preview-empty">
            <div className="phone-hint">对话生成后，正文 HTML 会实时渲染在这里</div>
          </div>
        ) : (
          <div className="preview-stage">
            <div className="phone" style={{ transform: `scale(${zoom})` }}>
              <div className="phone-notch" />
              <iframe
                title="推文预览"
                srcDoc={wrapSrcDoc(html)}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
