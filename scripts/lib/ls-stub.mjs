// ls-stub.mjs —— 无头环境下驱动 src/lib 素材链路的 localStorage 桩。
// 用法：在 import 目标模块之前先 import 本文件（ESM import 提升，故写成顶层副作用模块）。
// 原理：src/lib/chat.ts 的 inTauri() 依赖 window.__TAURI_INTERNALS__；无 window 时为 false
// → asset-library.ts 走 localStorage 浏览器分支 → 本桩即可完整模拟个人素材库。
const store = new Map()

if (typeof globalThis.window === 'undefined') {
  // 只补素材链路用得到的部分：inTauri() 读 window、asset-library 读写 localStorage。
  // 不定义 __TAURI_INTERNALS__，保持浏览器分支。
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => void store.set(k, String(v)),
      removeItem: (k) => void store.delete(k),
      clear: () => store.clear(),
    },
  }
  globalThis.localStorage = globalThis.window.localStorage
}

/** 清空内存素材库/文档库（每个用例开始前调用，保证隔离） */
export function resetStub() {
  store.clear()
}

/** 直接读回原始 JSON（断言用） */
export function rawStore(key) {
  return store.get(key) ?? null
}

export const LS_ASSETS = 'wxmp-assets-v1'
export const LS_DOCS = 'wxmp-docs-v1'
