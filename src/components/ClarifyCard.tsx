import { useState } from 'react'
import {
  ClarifySelections,
  STYLE_OPTIONS,
  TONE_OPTIONS,
  TYPE_LABELS,
  WORDS_OPTIONS,
} from '../lib/needs'

interface Props {
  text: string
  missing: (keyof ClarifySelections)[]
  onConfirm: (s: ClarifySelections) => void
  onSkip: () => void
}

function RowGroup(props: {
  title: string
  options: { v: string; label: string }[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="clarify-row">
      <span className="clarify-label">{props.title}</span>
      <div className="clarify-opts">
        {props.options.map((o) => (
          <button
            key={o.v}
            className={`chip chip-sm ${props.value === o.v ? 'chip-on' : ''}`}
            onClick={() => props.onChange(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const AUTO_TYPE = { v: 'auto', label: '自动判断' }

export default function ClarifyCard({ text, missing, onConfirm, onSkip }: Props) {
  const [sel, setSel] = useState<ClarifySelections>({ type: null, style: null, words: null, tone: null, image: null })

  return (
    <div className="clarify-card">
      <div className="clarify-head">
        <b>生成前先对齐需求（需求澄清）</b>
        <span className="clarify-tip">以下项未明确，请选择或保留默认；确认后一次性生成。</span>
      </div>
      <div className="clarify-req">需求：{text}</div>
      <div className="clarify-body">
        {missing.includes('type') && (
          <RowGroup
            title="类型"
            options={[AUTO_TYPE, ...TYPE_LABELS]}
            value={sel.type}
            onChange={(v) => setSel((p) => ({ ...p, type: v }))}
          />
        )}
        {missing.includes('style') && (
          <RowGroup
            title="风格"
            options={STYLE_OPTIONS}
            value={sel.style}
            onChange={(v) => setSel((p) => ({ ...p, style: v }))}
          />
        )}
        {missing.includes('words') && (
          <RowGroup
            title="字数"
            options={WORDS_OPTIONS}
            value={sel.words}
            onChange={(v) => setSel((p) => ({ ...p, words: v }))}
          />
        )}
        {missing.includes('tone') && (
          <RowGroup
            title="调性"
            options={TONE_OPTIONS}
            value={sel.tone}
            onChange={(v) => setSel((p) => ({ ...p, tone: v }))}
          />
        )}
        {missing.includes('image') && (
          <RowGroup
            title="配图"
            options={[
              { v: 'no', label: '暂不配图' },
              { v: 'yes', label: '需要配图位' },
            ]}
            value={sel.image === null ? null : sel.image ? 'yes' : 'no'}
            onChange={(v) => setSel((p) => ({ ...p, image: v === 'yes' }))}
          />
        )}
        <div className="clarify-note">未点选的项将采用默认（类型自动 / 风格自动 / 800-1200 字 / 口语化 / 不配图），并在生成时明确标注。</div>
      </div>
      <div className="clarify-foot">
        <button className="mini" onClick={onSkip}>
          跳过，直接生成
        </button>
        <button className="btn btn-send" onClick={() => onConfirm(sel)}>
          确认并生成
        </button>
      </div>
    </div>
  )
}
