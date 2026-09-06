// settings.ts —— 应用内 API 设置：Tauri → settings.json（文档/wechat-mp-workspace/）；浏览器 → localStorage
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat'

export interface AppSettings {
  apiKey: string
  baseUrl: string
  model: string
  // 公众号草稿箱发布（可选；留空 = 未配置/清空）
  wxAppid: string
  wxSecret: string
}

export const DEFAULTS: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  wxAppid: '',
  wxSecret: '',
}

const LS_KEY = 'wxmp-settings-v1'

export async function loadAppSettings(): Promise<AppSettings> {
  if (inTauri()) {
    try {
      const s = await invoke<{
        api_key: string
        base_url: string
        model: string
        wx_appid: string | null
        wx_secret: string | null
      }>('load_settings')
      return {
        apiKey: s.api_key || '',
        baseUrl: s.base_url || DEFAULTS.baseUrl,
        model: s.model || DEFAULTS.model,
        wxAppid: s.wx_appid || '',
        wxSecret: s.wx_secret || '',
      }
    } catch {
      return { ...DEFAULTS }
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    const d = JSON.parse(raw) as Partial<AppSettings>
    return {
      apiKey: d.apiKey || '',
      baseUrl: d.baseUrl || DEFAULTS.baseUrl,
      model: d.model || DEFAULTS.model,
      wxAppid: d.wxAppid || '',
      wxSecret: d.wxSecret || '',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveAppSettings(s: AppSettings): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('save_settings', {
        settings: {
          api_key: s.apiKey,
          base_url: s.baseUrl,
          model: s.model,
          wx_appid: s.wxAppid,
          wx_secret: s.wxSecret,
        },
      })
    } catch {
      // ignore
    }
    return
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

export async function resetAppSettings(): Promise<void> {
  if (inTauri()) {
    try {
      await invoke('save_settings', {
        settings: { api_key: '', base_url: '', model: '', wx_appid: '', wx_secret: '' },
      })
    } catch {
      // ignore
    }
    return
  }
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}
