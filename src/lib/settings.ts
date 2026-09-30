// settings.ts —— 应用内 API 设置：Tauri → settings.json（文档/wechat-mp-workspace/）；浏览器 → localStorage
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './chat.ts'

export interface AppSettings {
  apiKey: string
  baseUrl: string
  model: string
  // 公众号草稿箱发布（可选；留空 = 未配置/清空）
  wxAppid: string
  wxSecret: string
  // P2 视觉复核（2026-09-24 调查 §8）：看图选素材的第二个模型。
  // 默认关闭——视觉调用有费用，调查要求"先测效果再选默认"。
  modelVision: string
  visionReview: boolean
}

// 临时模型锁定（用户 2026-09-24）：主模型 / 画图 / 看图一律使用 deepseek-flash，禁止其它模型。
// Rust 侧 chat.rs 的 LOCKED_MODEL 是唯一权威；这里只用于界面提示与默认值，真正的收敛在 Rust。
export const LOCKED_MODEL = 'deepseek-flash'

export const DEFAULTS: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: LOCKED_MODEL,
  wxAppid: '',
  wxSecret: '',
  modelVision: LOCKED_MODEL,
  visionReview: false,
}

/** 读取当前锁定状态（桌面由 Rust 决定；浏览器模式同样遵循前端常量） */
export async function loadModelLock(): Promise<{ locked: boolean; model: string }> {
  if (inTauri()) {
    try {
      return await invoke<{ locked: boolean; model: string }>('model_lock_state')
    } catch {
      return { locked: true, model: LOCKED_MODEL }
    }
  }
  return { locked: true, model: LOCKED_MODEL }
}

const LS_KEY = 'wxmp-settings-v1'

/**
 * 读取结果：区分「读不出来」与「没配置」（后者返回 DEFAULTS 并 ok:true）。
 * `loadError`：桌面端 settings.json **存在但解析失败**——此时 ok:true 且拿到的是默认值，
 * 原文件仍在磁盘上。界面必须据此提示"设置文件损坏（原文件已保留）"并劝用户不要直接点保存，
 * 否则用户一点保存就把损坏但可修复的原配置覆盖掉了。
 */
export type SettingsLoadResult =
  | { ok: true; settings: AppSettings; loadError: string | null }
  | { ok: false; error: string }

/** 异常 → 一句话原因（只用于提示与日志，不改写异常语义） */
function brief(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

/** 读取（权威口径）：配置读不出来时**不能**静默当成"没配置"——那会让用户以为配置丢了 */
export async function loadAppSettingsSafe(): Promise<SettingsLoadResult> {
  if (inTauri()) {
    try {
      const s = await invoke<{
        api_key: string
        base_url: string
        model: string
        wx_appid: string | null
        wx_secret: string | null
        model_vision: string | null
        vision_review: boolean | null
        load_error: string | null
      }>('load_settings')
      // 锁定期间忽略设置里存的历史模型名，避免界面显示一个实际不会被使用的值
      const lock = await loadModelLock()
      return {
        ok: true,
        // load_error 非空 = 磁盘上的 settings.json 存在但解析失败，当前返回的是默认值（原文件已保留）
        loadError: s.load_error || null,
        settings: {
          apiKey: s.api_key || '',
          baseUrl: s.base_url || DEFAULTS.baseUrl,
          model: lock.locked ? lock.model : s.model || DEFAULTS.model,
          wxAppid: s.wx_appid || '',
          wxSecret: s.wx_secret || '',
          modelVision: lock.locked ? lock.model : s.model_vision || '',
          visionReview: !!s.vision_review,
        },
      }
    } catch (e) {
      console.warn('设置读取失败：', e)
      return { ok: false, error: brief(e) }
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ok: true, settings: { ...DEFAULTS }, loadError: null }
    const d = JSON.parse(raw) as Partial<AppSettings>
    return {
      ok: true,
      loadError: null,
      settings: {
        apiKey: d.apiKey || '',
        baseUrl: d.baseUrl || DEFAULTS.baseUrl,
        model: d.model || DEFAULTS.model,
        wxAppid: d.wxAppid || '',
        wxSecret: d.wxSecret || '',
        modelVision: d.modelVision || '',
        visionReview: !!d.visionReview,
      },
    }
  } catch (e) {
    console.warn('设置读取失败：', e)
    return { ok: false, error: brief(e) }
  }
}

/** 兼容包装：读失败时退回默认值（与"没配置"不可区分）。仅限仍按 AppSettings 取值的调用方。 */
export async function loadAppSettings(): Promise<AppSettings> {
  const r = await loadAppSettingsSafe()
  return r.ok ? r.settings : { ...DEFAULTS }
}

/** 保存：返回是否真的写入（false = 没落盘，界面不得显示"已保存"） */
export async function saveAppSettings(s: AppSettings): Promise<boolean> {
  if (inTauri()) {
    try {
      await invoke('save_settings', {
        settings: {
          api_key: s.apiKey,
          base_url: s.baseUrl,
          model: s.model,
          wx_appid: s.wxAppid,
          wx_secret: s.wxSecret,
          model_vision: s.modelVision,
          vision_review: s.visionReview,
        },
      })
      return true
    } catch (e) {
      console.warn('设置保存失败：', e)
      return false
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
    return true
  } catch (e) {
    console.warn('设置保存失败：', e)
    return false
  }
}

/** 恢复默认：返回是否真的写入（false = 没落盘，界面不得显示"已恢复默认"） */
export async function resetAppSettings(): Promise<boolean> {
  if (inTauri()) {
    try {
      await invoke('save_settings', {
        settings: {
          api_key: '',
          base_url: '',
          model: '',
          wx_appid: '',
          wx_secret: '',
          model_vision: '',
          vision_review: false,
        },
      })
      return true
    } catch (e) {
      console.warn('恢复默认失败：', e)
      return false
    }
  }
  try {
    localStorage.removeItem(LS_KEY)
    return true
  } catch (e) {
    console.warn('恢复默认失败：', e)
    return false
  }
}
