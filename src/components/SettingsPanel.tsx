import { useEffect, useRef, useState } from 'react'
import { DEFAULTS, loadAppSettingsSafe, loadModelLock, resetAppSettings, saveAppSettings } from '../lib/settings.ts'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULTS.baseUrl)
  const [model, setModel] = useState(DEFAULTS.model)
  const [modelVision, setModelVision] = useState('')
  const [visionReview, setVisionReview] = useState(false)
  const [msg, setMsg] = useState('')
  // 提示是成功还是失败：失败文案必须用红系修饰类，不能继承 `.settings-msg` 的绿字（那会让人以为成功了）
  const [msgBad, setMsgBad] = useState(false)
  // 设置文件损坏（存在但解析失败）：非空时提示"当前显示的是默认值（原文件已保留）"，
  // 并明确劝阻直接保存——否则用户一点保存就把损坏但可恢复的原配置覆盖掉了
  const [loadError, setLoadError] = useState<string | null>(null)
  // 模型锁定状态（用户 2026-09-24：所有模型暂时固定为 deepseek-flash）
  const [lock, setLock] = useState({ locked: false, model: '' })
  // 本面板不展示公众号字段，但保存时必须原样带回——否则一次「保存」会把已配置的凭据清空
  const [wx, setWx] = useState({ wxAppid: '', wxSecret: '' })
  const msgTimer = useRef<number | null>(null)

  // 提示只用于展示结果（成功/失败各说各的），不参与任何流程判断
  const flash = (text: string, ms = 3000, bad = false) => {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setMsg(text)
    setMsgBad(bad)
    msgTimer.current = window.setTimeout(() => {
      setMsg('')
      msgTimer.current = null
    }, ms)
  }

  useEffect(() => {
    loadModelLock().then(setLock)
    void loadAppSettingsSafe().then((r) => {
      if (!r.ok) {
        // 读不出来就说读不出来——不能把界面留成"配置是空的"，那等于谎报配置丢了
        flash(`设置读取失败：${r.error}。当前显示的不是本机已保存的配置。`, 8000, true)
        return
      }
      // 文件存在但解析失败：拿到的是默认值，原文件仍在磁盘上。这一点必须说清楚，
      // 并劝阻"直接点保存"——那会把损坏但可修复的原配置覆盖成默认值。
      setLoadError(r.loadError)
      const s = r.settings
      setApiKey(s.apiKey)
      setBaseUrl(s.baseUrl)
      setModel(s.model)
      setModelVision(s.modelVision)
      setVisionReview(s.visionReview)
      setWx({ wxAppid: s.wxAppid, wxSecret: s.wxSecret })
    })
    return () => {
      if (msgTimer.current) window.clearTimeout(msgTimer.current)
    }
  }, [])

  const save = async () => {
    const ok = await saveAppSettings({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || DEFAULTS.baseUrl,
      // 锁定期间不把界面上显示的值当作可配置项写回，避免存下一个实际不会被使用的模型名
      model: lock.locked ? lock.model : model.trim() || DEFAULTS.model,
      wxAppid: wx.wxAppid,
      wxSecret: wx.wxSecret,
      modelVision: lock.locked ? lock.model : modelVision.trim(),
      visionReview,
    })
    // 只有真的写入本机才说"已保存"——设置没落盘而显示成功，用户会带着错的配置继续用
    if (!ok) {
      flash('保存失败：配置未写入本机，请重试。', 6000, true)
      return
    }
    flash('已保存。新对话将使用该配置。')
  }

  const reset = async () => {
    const ok = await resetAppSettings()
    if (!ok) {
      flash('恢复默认失败：配置未写入本机，请重试。', 6000, true)
      return
    }
    setApiKey('')
    setBaseUrl(DEFAULTS.baseUrl)
    setModel(DEFAULTS.model)
    setModelVision(DEFAULTS.modelVision)
    setVisionReview(false)
    setWx({ wxAppid: '', wxSecret: '' })
    flash('已恢复默认。')
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <b>AI 模型设置</b>
          <button className="mini" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="settings-body">
          {loadError && (
            <div className="settings-msg settings-msg-bad" data-settings-load-error="1">
              设置文件损坏（原文件已保留），当前显示的是默认值。请先备份并修复该文件，不要直接点保存——那会用默认值覆盖掉原配置。
            </div>
          )}
          <label>
            API Key（DeepSeek）
            <input className="set-key" type="password" value={apiKey} placeholder="sk-…" onChange={(e) => setApiKey(e.target.value)} />
          </label>
          <label>
            接口地址
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>

          <label>
            主模型（创作与对话）
            <input
              type="text"
              value={lock.locked ? lock.model : model}
              disabled={lock.locked}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>

          <div className="settings-group">
            <label className="settings-check">
              <input type="checkbox" className="set-vision-on" checked={visionReview} onChange={(e) => setVisionReview(e.target.checked)} />
              开启视觉复核
            </label>
            <label>
              看图模型
              <input
                type="text"
                className="set-vision-model"
                value={lock.locked ? lock.model : modelVision}
                disabled={lock.locked}
                placeholder={lock.model || 'deepseek-flash'}
                onChange={(e) => setModelVision(e.target.value)}
              />
            </label>
          </div>

          {msg && <div className={`settings-msg${msgBad ? ' settings-msg-bad' : ''}`}>{msg}</div>}
        </div>
        <div className="settings-foot">
          <button className="mini mini-danger" onClick={() => void reset()}>
            恢复默认
          </button>
          <button className="btn btn-send" onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
