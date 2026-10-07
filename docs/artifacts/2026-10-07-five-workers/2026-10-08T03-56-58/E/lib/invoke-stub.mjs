// E 独立复核：受控传输替身。
// 只替换 Rust 侧 `invoke` 通道（本机不可能在 Node 里执行 Tauri 命令），
// 生产模块（src/lib/prep.ts 及其依赖）原样加载，不做任何改写。
// 处理的请求全部由调用方脚本按剧本给出 —— 这是受控返回值，**不是**真实模型行为。
export function invoke(cmd, args) {
  const h = globalThis.__E_INVOKE_HANDLER__
  if (!h) return Promise.reject(new Error(`E 复核：没有为 ${cmd} 注册受控返回值`))
  return Promise.resolve(h(cmd, args))
}

export function transformCallback(cb) { return cb }
export const Channel = class Channel { }
