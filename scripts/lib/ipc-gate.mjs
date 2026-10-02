// ipc-gate.mjs —— 页面侧「派发前预算门禁」的**唯一**实现（DS 修复指南 §0.0 A）
//
// 为什么单独成一个模块：这段源码原来是 `live-acceptance.mjs` 里的一串字符串字面量，
// 而它正是 2026-10-02 晚间复核抓到的那个缺口的所在——
//   · 只挂了 `window.fetch`，但本机锁定的 tauri 2.11.5 在**任意一次** IPC fetch 失败之后，
//     会把 `customProtocolIpcFailed` 置真，此后所有命令改走 `window.ipc.postMessage`；
//   · 那条通道我们**拦不住**：wry 0.55.1 在 Windows 上把它冻成了
//     `Object.defineProperty(window, 'ipc', { value: Object.freeze({postMessage: …}) })`
//     （见 wry-0.55.1/src/webview2/mod.rs:885），属性不可写、对象已冻结。
// 所以修法不是"再去挂一个通道"，而是：**让协议永远不切通道** + **证明当前通道确实受控**。
//
// 三段防线（每一段都有独立的反例，见 `scripts/ipc-gate-check.mjs`）：
//   1. **永不 reject**：门口 `window.fetch` 的返回值在任何失败下都转换成协议合法的错误响应。
//      协议切通道的唯一触发点是它自己那条 `fetch(...).then(…).then(ok, reject)` 的 reject，
//      所以"永不 reject"等于"永不切通道"。响应体也先读干再重建，因为协议对
//      `response.json()` 的解码失败同样算 reject——这条也一并挡在门禁这一侧。
//      **解码判定必须按协议真实分支做，不能按 HTTP status 跳过**：`tauri-2.11.5/scripts/
//      ipc-protocol.js:42-53` 按 `content-type` 选 `json()/text()/arrayBuffer()`，**不看 status**。
//      204/205/304 只要 content-type 是 `application/json`，它照样 `json()` → 空体解析抛错 →
//      永久切到 postMessage。2026-10-02 复核用真实协议源码复现了这条（额度 0 却经 postMessage
//      到达假后端 2 次）；本文件对空体状态的旧短路正是缺口所在，现已并入同一条解码判定。
//   2. **一旦真出故障就停发**：`fallbackLatched` 之后本回合所有付费命令一律拒绝，
//      不让协议"悄悄换个通道继续花钱"。
//   3. **覆盖率自证**：装好后主动发一条**非付费**命令，确认它确实经过本门禁。没经过，
//      说明自定义协议通道已经不在使用中（回退在安装之前就激活了），驱动必须拒绝开测——
//      这时候任何页面侧补丁都够不着付费请求。
//      **复用也必须重新自证**：旧实现在 `reused` 分支直接回上一次的 coverage 结论，
//      等于拿"上一回合的"证据证明"这一回合"安全（晚间复核反例：重装仍报 coverageProven=true）。
//
// 付费命令表**从 `dispatch-budget.mjs` 生成**，不手工维护第二份（两处漂移过就等于漏记一次费用）。

import { PAID_COMMANDS } from './dispatch-budget.mjs'

/** 页面内安装探针的源码。在页面里用 `new Function('arg', src)` 执行（避免 evaluate 的字符串求值歧义）。 */
export const installProbeSource = [
  'var T = window.__TAURI_INTERNALS__;',
  'if (!T || typeof T.invoke !== "function") return { ok: false, reason: "没有 __TAURI_INTERNALS__.invoke" };',
  'if (typeof window.__acceptanceReserve !== "function") return { ok: false, reason: "宿主没有暴露 __acceptanceReserve：预算门禁装不上，拒绝在无门禁状态下开测" };',
  `var PAID = ${JSON.stringify(PAID_COMMANDS)};`,
  // 复用必须核对**当前实际的拦截函数身份**，不能只看旧标记还在不在。
  //
  // ⚠️ 复用**不再提前返回**（2026-10-02 复核反例）：旧实现在这里直接回 `coverage: existing.coverage`，
  // 即"用上一次安装时的覆盖率结论证明本回合安全"。现在只有"当前拦截函数身份没变"这件事可以复用，
  // 覆盖率**每次都实发一条非付费命令重新自证**（见本源码末尾那段）。
  'var existing = T.__liveAcceptanceProbe;',
  'var sameGate = !!(existing && window.__acceptanceProbe === existing && existing.gate && existing.gate.wrappedFetch === window.fetch);',
  'var isNew = !(existing && typeof existing === "object" && window.__acceptanceProbe === existing);',
  'var probe = isNew ? { installedAt: Date.now(), calls: [], model: [], refused: [], transport: 0, transportDraw: 0, via: "fetch", customProtocolFailures: [], decodeFailures: [], fallbackLatched: false, fallbackReason: null, gateIdentityFailures: 0, rewrapCount: 0, gate: null, coverage: null, patched: true } : existing;',
  'probe.customProtocolFailures = probe.customProtocolFailures || [];',
  'probe.decodeFailures = probe.decodeFailures || [];',
  'probe.gateIdentityFailures = probe.gateIdentityFailures || 0;',
  'window.__acceptanceProbe = probe;',
  // 取"真正的原始 fetch"：当前挂着的可能还是我们自己上一次装的 wrapper，
  // 那种情况下要用它保存的原函数，否则一次调用会走两遍门禁、记两次。
  'var prevGate = probe.gate;',
  'var origFetch = (prevGate && prevGate.wrappedFetch === window.fetch) ? prevGate.origFetch : window.fetch.bind(window);',
  'if (prevGate && prevGate.wrappedFetch !== window.fetch) probe.rewrapCount += 1;',
  // 协议合法的**错误响应**：状态 200 + `Tauri-Response: error`，走 reject 分支的是 `error` 回调。
  'var errorResponse = function (msg) {',
  '  return new Response(JSON.stringify("[live-acceptance] " + msg), { status: 200, headers: { "Tauri-Response": "error", "content-type": "application/json" } });',
  '};',
  'var latch = function (kind, cmd, detail) {',
  '  probe.fallbackLatched = true;',
  '  if (!probe.fallbackReason) probe.fallbackReason = kind + "：" + detail;',
  '  return errorResponse(kind + "（已阻止协议回退到未受门禁覆盖的 postMessage 通道）：" + detail);',
  '};',
  // 把响应体读干并重建：协议随后会调 response.json()/text()/arrayBuffer()，
  // 那一步 reject 同样会切通道，所以解码失败也要在门禁这一侧拦下。
  //
  // 判定标准是"**协议**下一步会做的那次解码能不能成功"，逐字对齐 tauri-2.11.5/scripts/ipc-protocol.js:42-53：
  //   `content-type`（取逗号前第一段）== application/json → `response.json()`
  //   == text/plain → `response.text()`；其它 → `response.arrayBuffer()`
  // 它**完全不看 status**。所以 204/205/304 不是"安全跳过"的理由：
  // 空体 + application/json 一定让 `json()` 抛错，那次抛错就是协议永久切到 postMessage 的开关。
  // 只有空体状态**不能带 body 重建**这一条构造性限制保留（Response 构造函数会拒绝），
  // 而走到重建那一步时，json 分支已经在上面被判定并拦下了。
  'var isNullBodyStatus = function (s) { return s === 204 || s === 205 || s === 304; };',
  'var guardResponse = function (p, cmd) {',
  '  return Promise.resolve(p).then(function (res) {',
  '    var ct = "";',
  '    try { ct = String((res.headers.get("content-type") || "")).split(",")[0]; } catch (e) {}',
  '    return res.arrayBuffer().then(function (buf) {',
  '      if (ct === "application/json") {',
  '        var text = null;',
  '        var bad = null;',
  '        try { text = new TextDecoder().decode(new Uint8Array(buf)); } catch (e) { bad = "响应体解码失败：" + String(e); }',
  '        if (!bad) { try { JSON.parse(text); } catch (e) { bad = "响应不是合法 JSON：" + String(e); } }',
  '        if (bad) { probe.decodeFailures.push({ t: Date.now(), cmd: cmd, kind: "decode", error: bad }); return latch("IPC 响应解码失败", cmd, bad); }',
  '      }',
  '      try {',
  '        if (isNullBodyStatus(res.status)) return new Response(null, { status: res.status, headers: res.headers });',
  '        return new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });',
  '      } catch (e) {',
  '        var msg = String((e && e.message) || e);',
  '        probe.decodeFailures.push({ t: Date.now(), cmd: cmd, kind: "rebuild", error: msg });',
  '        return latch("IPC 响应重建失败", cmd, msg);',
  '      }',
  '    }, function (e) {',
  '      var msg = String((e && e.message) || e);',
  '      probe.decodeFailures.push({ t: Date.now(), cmd: cmd, kind: "body", error: msg });',
  '      return latch("IPC 响应体读取失败", cmd, msg);',
  '    });',
  '  }, function (e) {',
  '    var msg = String((e && e.message) || e);',
  '    probe.customProtocolFailures.push({ t: Date.now(), cmd: cmd, error: msg });',
  '    return latch("自定义协议 fetch 失败", cmd, msg);',
  '  });',
  '};',
  // 付费命令：先预留、后派发。
  'var dispatch = function (cmd, rec, call) {',
  '  if (probe.fallbackLatched) {',
  '    probe.refused.push({ t: Date.now(), cmd: cmd, slotId: (rec && rec.slotId) || null, kind: (rec && rec.kind) || null, reason: "协议回退已发生，本回合停发：" + (probe.fallbackReason || "") });',
  '    return errorResponse("协议回退已发生，本回合停发付费请求：" + (probe.fallbackReason || ""));',
  '  }',
  '  var p;',
  '  try { p = Promise.resolve(window.__acceptanceReserve(cmd, rec || null)); } catch (e) { p = Promise.reject(e); }',
  '  return p.then(function (r) {',
  '    if (!r || r.ok !== true) {',
  '      probe.refused.push({ t: Date.now(), cmd: cmd, slotId: (rec && rec.slotId) || null, kind: (rec && rec.kind) || null, reason: (r && r.reason) || "预留被拒" });',
  // 拒绝必须回**协议合法的错误响应**，绝不能 reject——fetch 一失败协议就切 postMessage 通道。
  '      return errorResponse("预算门禁拒绝派发：" + ((r && r.reason) || "unknown"));',
  '    }',
  // 身份核对比的是**已安装的那个**包装函数（`probe.gate.wrappedFetch`），不是本次闭包里新建的
  // `wrappedFetch`——复用路径不会重新赋值 window.fetch，拿新建的那个比会恒假、把正常派发全拒了。
  '    if (!(probe.gate && window.fetch === probe.gate.wrappedFetch)) {',
  '      probe.gateIdentityFailures += 1;',
  '      return errorResponse("门禁身份已失效（window.fetch 不再是受控函数）——拒绝派发");',
  '    }',
  '    probe.model.push(rec || { cmd: cmd, t: Date.now() });',
  '    probe.transport += 1;',
  '    if (r.kind === "draw") probe.transportDraw += 1;',
  '    return guardResponse(call(), cmd);',
  '  }, function (e) {',
  '    var msg = String((e && e.message) || e);',
  '    probe.refused.push({ t: Date.now(), cmd: cmd, reason: "宿主预留异常：" + msg });',
  '    return errorResponse("宿主预留异常：" + msg);',
  '  });',
  '};',
  'var wrappedFetch = function (input, init) {',
  '  var url = typeof input === "string" ? input : ((input && input.url) || "");',
  '  var m = /\\/\\/([^\\/]+)\\/([^\\/?#]+)/.exec(url);',
  '  var cmd = (m && m[1] === "ipc.localhost") ? decodeURIComponent(m[2]) : null;',
  '  if (!cmd) return origFetch(input, init);',
  '  var rec = { t: Date.now(), cmd: String(cmd) };',
  '  try {',
  '    if (init && typeof init.body === "string" && init.body.charAt(0) === "{") {',
  '      var b = JSON.parse(init.body);',
  '      if (b && b.slotId) rec.slotId = String(b.slotId);',
  '      if (b && b.kind) rec.kind = String(b.kind);',
  '      if (b && b.turn) rec.turn = String(b.turn);',
  '      if (b && typeof b.attempt === "number") rec.attempt = b.attempt;',
  '    }',
  '  } catch (e) {}',
  '  probe.calls.push(rec);',
  '  var call = function () { return origFetch(input, init); };',
  '  var paid = Object.prototype.hasOwnProperty.call(PAID, String(cmd));',
  // 非付费命令**也要**守卫：正是"一条非付费 IPC 的 fetch 失败"会把协议推进回退通道，
  // 之后所有付费命令就都不再经过这里了（2026-10-02 晚间用真实协议源码复现的那条）。
  '  return paid ? dispatch(rec.cmd, rec, call) : guardResponse(call(), rec.cmd);',
  '};',
  'var patched = false;',
  'if (sameGate) {',
  '  patched = true; // 当前 window.fetch 仍是上一次装的受控函数：不重装、不套第二层',
  '} else {',
  '  try { window.fetch = wrappedFetch; patched = (window.fetch === wrappedFetch); } catch (e) { patched = false; }',
  '}',
  'if (!patched) { return { ok: false, reason: "无法替换 window.fetch：派发前预算门禁装不上，拒绝在无门禁状态下开测" }; }',
  // 复用时不覆盖 gate：window.fetch 还是**旧**那个包装函数，把它记成新建的会在派发前身份核对时恒假。
  'if (!sameGate) probe.gate = { wrappedFetch: wrappedFetch, origFetch: origFetch, installedAt: Date.now() };',
  'probe.patched = true;',
  'T.__liveAcceptanceProbe = probe;',
  // 覆盖率自证：发一条**非付费**命令，看它有没有经过本门禁。**复用也照样重发**——
  // 上一次的 `coverage.viaFetch` 只说明"上一次装的时候通道是通的"，不能证明这一回合还通。
  'probe.coverage = { checked: true, at: Date.now(), before: probe.calls.length, after: null, viaFetch: false, error: null, reused: sameGate };',
  'var done = function () {',
  '  probe.coverage.after = probe.calls.length;',
  '  probe.coverage.viaFetch = probe.calls.length > probe.coverage.before;',
  '  return { ok: true, reused: !isNew, coverage: probe.coverage, probe: probe };',
  '};',
  'try {',
  '  return Promise.resolve(T.invoke("list_documents", {})).then(done, function (e) {',
  '    probe.coverage.error = String((e && e.message) || e);',
  '    return done();',
  '  });',
  '} catch (e) {',
  '  probe.coverage.error = String((e && e.message) || e);',
  '  return done();',
  '}',
].join('\n')

/**
 * 门禁覆盖率是否已被证明（驱动侧判定用）。
 * 没有证明就必须**拒绝开测**：此时候费命令不经过本门禁（协议已切到 postMessage 通道）。
 */
export function gateCoverageProven(installed) {
  return Boolean(installed && installed.ok === true && installed.coverage && installed.coverage.viaFetch === true)
}
