import { useEffect, useState } from 'react'
import { DEFAULTS, loadAppSettings, resetAppSettings, saveAppSettings } from '../lib/settings'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULTS.baseUrl)
  const [model, setModel] = useState(DEFAULTS.model)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    loadAppSettings().then((s) => {
      setApiKey(s.apiKey)
      setBaseUrl(s.baseUrl)
      setModel(s.model)
    })
  }, [])

  const save = async () => {
    await saveAppSettings({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || DEFAULTS.baseUrl,
      model: model.trim() || DEFAULTS.model,
      wxAppid: '',
      wxSecret: '',
    })
    setMsg('已保存。新对话将使用该配置。')
    setTimeout(() => setMsg(''), 3000)
  }

  const reset = async () => {
    await resetAppSettings()
    setApiKey('')
    setBaseUrl(DEFAULTS.baseUrl)
    setModel(DEFAULTS.model)
    setMsg('已恢复默认。')
    setTimeout(() => setMsg(''), 3000)
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
          <label>
            API Key（DeepSeek）
            <input className="set-key" type="password" value={apiKey} placeholder="sk-…" onChange={(e) => setApiKey(e.target.value)} />
          </label>
          <label>
            接口地址
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
          <label>
            模型
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
          <p className="settings-note">
            优先级：环境变量 &gt; 此处设置 &gt; 旧版 ~/.dsh 兼容读取（仅桌面模式）。
            设置以本地文件明文保存（仅本机自用），不会上传、不会入库。正文导出用「导出 HTML / 导出图片」。
          </p>
          {msg && <div className="settings-msg">{msg}</div>}
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
