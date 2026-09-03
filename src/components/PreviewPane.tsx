import { useState } from 'react'
import type { QualityResult } from '../lib/quality'

interface Props {
  html: string | null
  quality: QualityResult | null
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
  body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;width:375px;max-width:100%;margin:0 auto;padding:14px 16px 40px;box-sizing:border-box;}
</style>
</head>
<body>
${html}
</body>
</html>`
}

export default function PreviewPane({ html, quality, onClear }: Props) {
  const [copied, setCopied] = useState(false)
  const [zoom, setZoom] = useState(1)

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
          <button className="mini mini-danger" onClick={onClear} disabled={!html}>
            清空
          </button>
        </div>
      </div>

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
