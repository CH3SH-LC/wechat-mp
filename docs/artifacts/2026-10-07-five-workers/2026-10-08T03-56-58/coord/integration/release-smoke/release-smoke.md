# release 冒烟（隔离启动）

状态：**PASS**（检查 7/7 通过）
时间：2026-10-07T20:25:26.783Z → 2026-10-07T20:25:45.847Z
 exe：`D:\deepseek-harness\wechat-mp-desktop\src-tauri\target\release\wechat-mp-desktop.exe`
 sha256：`e0fb3addd2766a8bb6174c63efae4a9a177fbc011229038bc97dda4a0abe45d6`
隔离目录：`C:\Users\Lenovo\AppData\Local\Temp\wxmp-isolated-smoke-muyk4dmo`（profile / webview / evidence 三处都不在真实工作区内）

窗口标题（OS 读取）：`智序 · 公众号推文助手`
CDP 可用性：**unavailable**（CDP http://127.0.0.1:49294/json/list 在 8000ms 内没有可用页面）

> CDP 不可用 ≠ 冒烟失败。它只影响"驱动真实界面"的真机验收（包 F），不影响本轮的启动冒烟结论。
> 本机已实测：`--remote-debugging-port` 确实传到了 WebView2 浏览器进程的命令行，但没有任何 TCP 端口在监听、
> 也没有 `DevToolsActivePort` 文件；同一台机器上普通 Edge 用同一开关可以正常监听。

```
PASS - 进程在冒烟期间一直活着
PASS - 窗口标题是「智序 · 公众号推文助手」（操作系统读取，不依赖 CDP） (title=智序 · 公众号推文助手)
PASS - 隔离工作区已由应用自动建立（说明写的是隔离目录） (C:\Users\Lenovo\AppData\Local\Temp\wxmp-isolated-smoke-muyk4dmo\profile\Documents\wechat-mp-workspace)
PASS - 隔离工作区的会话/文档目录为空（新 profile，没有真实数据） (["sessions/s1791404728669267300.json","state.json"])
PASS - 真实工作区逐文件哈希未变（不靠"计数相同"声称没变） (新增 0 / 删除 0 / 修改 0：)
PASS - 本轮自有 PID 已按启动身份核验关闭（closed=true，且不是"身份不符被拒绝关闭"） (closed=true refused=false via=wm-close)
PASS - 关闭走的是应用自身的退出路径（forced 单独记，不再"异常关闭也算通过"） (forced=false exitedBeforeRequest=false via=wm-close)
```
