import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULTS, loadAppSettingsSafe, loadModelLock, resetAppSettings, saveAppSettings } from '../lib/settings.ts'

interface Props { onClose: () => void }

export default function SettingsPanel({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULTS.baseUrl)
  const [model, setModel] = useState(DEFAULTS.model)
  const [modelVision, setModelVision] = useState('')
  const [visionReview, setVisionReview] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgBad, setMsgBad] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'save' | 'reset' | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lock, setLock] = useState({ locked: true, model: DEFAULTS.model })
  const [wx, setWx] = useState({ wxAppid: '', wxSecret: '' })
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const msgTimer = useRef<number | null>(null)
  const requestId = useRef(0)
  const writePending = useRef(false)
  const canWrite = !loading && !saving && !readError && !loadError

  const flash = (text: string, ms = 5000, bad = false) => {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setMsg(text)
    setMsgBad(bad)
    msgTimer.current = window.setTimeout(() => { setMsg(''); msgTimer.current = null }, ms)
  }

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setReadError(null)
    setMsg('')
    const [nextLock, r] = await Promise.all([loadModelLock(), loadAppSettingsSafe()])
    if (id !== requestId.current) return
    setLock(nextLock)
    setLoading(false)
    if (!r.ok) { setReadError(r.error); return }
    setLoadError(r.loadError)
    const s = r.settings
    setApiKey(s.apiKey)
    setBaseUrl(s.baseUrl)
    setModel(s.model)
    setModelVision(s.modelVision)
    setVisionReview(s.visionReview)
    setWx({ wxAppid: s.wxAppid, wxSecret: s.wxSecret })
  }, [])

  useEffect(() => {
    void load()
    return () => { requestId.current++; if (msgTimer.current) window.clearTimeout(msgTimer.current) }
  }, [load])

  // 设置是模态窗口：键盘不能落到遮罩后的工作区；关闭后回到原入口。
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); if (!writePending.current) onCloseRef.current(); return }
      if (event.key !== 'Tab' || !panel) return
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter((el) => el.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); panel.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); if (opener?.isConnected) opener.focus() }
  }, [])

  const save = async () => {
    if (!canWrite || writePending.current) return
    const address = baseUrl.trim() || DEFAULTS.baseUrl
    try {
      const parsed = new URL(address)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol')
    } catch { flash('接口地址需为有效的 http:// 或 https:// 地址。', 6000, true); return }
    writePending.current = true
    setSaving('save')
    try {
      const ok = await saveAppSettings({ apiKey: apiKey.trim(), baseUrl: address, model: lock.locked ? lock.model : model.trim() || DEFAULTS.model, ...wx, modelVision: lock.locked ? lock.model : modelVision.trim(), visionReview })
      flash(ok ? '已保存，下次发送消息时生效。' : '保存失败：配置未写入本机，请重试。', 6000, !ok)
    } finally { writePending.current = false; setSaving(null) }
  }

  const reset = async () => {
    if (loading || saving || readError || writePending.current) return
    const confirmed = window.confirm(loadError
      ? '设置文件无法解析。恢复默认会替换原配置并清空其中的所有凭据，请确认已备份原文件。是否继续？'
      : '恢复默认模型设置并清空本机 API Key？已配置的公众号凭据会保留。')
    if (!confirmed) return
    writePending.current = true
    setSaving('reset')
    try {
      // 正常读取时保留本面板不展示的公众号配置；损坏文件只能在明确确认后重置全部字段。
      const ok = loadError ? await resetAppSettings() : await saveAppSettings({ ...DEFAULTS, ...wx })
      if (!ok) { flash('恢复默认失败：配置未写入本机，请重试。', 6000, true); return }
      setApiKey('')
      setBaseUrl(DEFAULTS.baseUrl)
      setModel(DEFAULTS.model)
      setModelVision(DEFAULTS.modelVision)
      setVisionReview(false)
      if (loadError) setWx({ wxAppid: '', wxSecret: '' })
      setLoadError(null)
      flash('已恢复默认设置。')
    } finally { writePending.current = false; setSaving(null) }
  }

  return (
    <div className="settings-overlay" onClick={() => { if (!writePending.current) onClose() }}>
      <div className="settings-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <b id="settings-title">AI 模型设置</b>
          <button className="mini" disabled={saving !== null} onClick={onClose}>关闭</button>
        </div>
        <div className="settings-body">
          <p className="settings-intro">配置仅保存在本机。设置将在下一次发送消息时使用。</p>
          {loading && <div className="settings-loading" role="status">正在读取本机设置…</div>}
          {readError && <div className="settings-msg settings-msg-bad" role="alert" data-settings-read-error="1">设置读取失败：{readError}。为保护原配置，暂不能保存或恢复默认。<button className="mini settings-retry" onClick={() => void load()}>重新读取</button></div>}
          {loadError && <div className="settings-msg settings-msg-bad" role="alert" data-settings-load-error="1">设置文件损坏，原文件已保留。请先备份并修复文件，然后重新读取；确认不需要旧配置后，也可恢复默认。<button className="mini settings-retry" disabled={loading || saving !== null} onClick={() => void load()}>重新读取</button></div>}
          <fieldset className="settings-fields" disabled={!canWrite}>
            <label>API Key（DeepSeek）<input className="set-key" type="password" value={apiKey} placeholder="填写 API Key，留空时使用本机环境配置" autoComplete="off" spellCheck={false} onChange={(e) => setApiKey(e.target.value)} /></label>
            <label>接口地址<input type="url" value={baseUrl} spellCheck={false} onChange={(e) => setBaseUrl(e.target.value)} /></label>
            <label>主模型（创作与对话）<input type="text" value={lock.locked ? lock.model : model} disabled={lock.locked} onChange={(e) => setModel(e.target.value)} /></label>
            {lock.locked && <p className="settings-help">当前版本统一使用 {lock.model}。</p>}
            <div className="settings-group">
              <label className="settings-check"><input type="checkbox" className="set-vision-on" checked={visionReview} onChange={(e) => setVisionReview(e.target.checked)} />开启视觉复核</label>
              <p className="settings-help">复核排版与插图，会额外调用模型。默认关闭。</p>
              <label>看图模型<input type="text" className="set-vision-model" value={lock.locked ? lock.model : modelVision} disabled={lock.locked} placeholder={lock.model || 'deepseek-flash'} onChange={(e) => setModelVision(e.target.value)} /></label>
            </div>
          </fieldset>
          {msg && <div className={`settings-msg${msgBad ? ' settings-msg-bad' : ''}`} role={msgBad ? 'alert' : 'status'}>{msg}</div>}
        </div>
        <div className="settings-foot">
          <button className="mini mini-danger" disabled={loading || saving !== null || !!readError} onClick={() => void reset()}>{saving === 'reset' ? '恢复中…' : '恢复默认'}</button>
          <button className="btn btn-send" disabled={!canWrite} onClick={() => void save()}>{saving === 'save' ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}
