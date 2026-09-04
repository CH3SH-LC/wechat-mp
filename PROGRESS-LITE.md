# 公众号推文助手桌面版 开发进度（精简版）

> 标签：[New Feature] 新功能 / [Debug] 修复 / [Change] 变更 / [Build] 构建
> 详细记录见 PROGRESS.md

---
## 2026-09-04
- [New Feature] 第 11 轮：结构化需求澄清卡（req-clarify 落地）——五维度需求评估（类型/风格/字数/调性/配图），缺≥2 弹卡选项补齐、确认后生成；直接写/演示话题跳过但附需求默认注；修会话恢复 React key 冲突（idSeq 提升）；E2E 21 项全绿含 S9a/S9b；Rust 零改动
- [Change] 第 10 轮：常驻会话栏 + 对话流净化（需求报告驱动）——SessionRail 左侧栏（顶栏按钮=折叠开关，SessionMenu 退役）；气泡只显说明文字（splitAssistant），HTML 收进「查看 HTML 源码」展开（默认收起）；E2E 全绿含新 S1.7 三项断言 + S8 侧栏 1→2→1；Rust 零改动
- [New Feature] 第 9 轮：多会话上下文窗口（像 DSH）——sessions.rs（sessions/<id>.json + state.json，旧 draft.json 自动迁移不丢稿）+ 会话菜单（新建/切换/删除/当前高亮）+ App currentId 状态机（自动保存绑定当前会话）；修 StrictMode 双跑引导；Rust 17/17；E2E 全绿含 S8 1→2→1；release 重建
- [Build] 第 8 轮：全功能 release 重建（含 1-7 轮功能，32s）+ 安装闭环复验（装/启/卸 exit 0）；清理 dead_code；cargo 16/16 无警告——最终交付产物 setup.exe
- [New Feature] 第 7 轮：应用内 API 设置——顶栏设置面板（Key 掩码/端点/模型，settings.json/localStorage），密钥解析 env>设置>~/.dsh 兼容回退（pick_key 纯函数）；Rust 16/16；E2E 七场景全绿含 S7 保存→刷新持久→恢复默认
- [Build] 第 6 轮：安装器真实验证——setup 静默安装 exit 0 → 安装版启动存活 → 卸载 exit 0 目录清理，发布闭环完成
- [Build] 第 5 轮：发布打包——tauri build --bundles nsis 成功（release exe 12.2MB + setup 3.7MB），release exe 启动冒烟通过；RELEASE-NOTES.md 发布说明；清理 dead_code；回归 13/13
- [New Feature] 第 4 轮：会话自动存档/恢复（draft.rs→文档/wechat-mp-workspace/draft.json 损坏容错，浏览器 localStorage；防抖自动保存+流结束即存+顶栏已自动保存；E2E S1.6 刷新恢复/清空清存储通过）+ 导出目录统一 workspace/exports + live_article_sample 真实整篇抽样（3753 字 0 issues）；Rust 13/13
- [New Feature] 第 3 轮：导出 HTML（Rust export.rs 写 文档/wechat-mp-exports/ 文件名消毒，10/10 单测；浏览器 <a download>；E2E S1.5 下载 2254B 通过）+ 知识库懒加载减包（主包 2388kB→236kB gzip 75kB，149 懒加载 chunk）；E2E 三场景全绿，窗口自动重启含新命令
- [New Feature] 第 2 轮：生成体验产品化——模式/风格选择注入提示词并参与检索 + 输出质量检查护栏（quality.ts：零 emoji/零渐变/零阴影/无 style-script-外链图检查）；预览栏质量条 q-ok/q-fail；E2E 双向全绿（S1 通过 / S2 违规样本检出 4 项问题），截图 wxmp-desktop-ok.png/-fail.png
## 2026-08-29
- [New Feature] 第 1 轮：桌面双栏骨架 + 极简智能体链路——Tauri2+React19 脚手架（1380x880「公众号推文助手」）、src/lib（persona/知识检索/双通道 chat/HTML 提取）、ChatPane+PreviewPane(375px 手机壳 iframe)、Rust chat.rs（env/.dsh 密钥解析+SSE 流式+chat-delta 事件，6 单测+live 冒烟 OK）、知识语料 src/knowledge 三层 149 文件、verify-ui.mjs E2E 4/4 PASS（截图 verify-artifacts/wxmp-desktop-ui.png）；tauri dev 窗口启动确认
- [Build] 第 0 轮：项目初始化——create-tauri-app react-ts、四文件体系+REQUIREMENTS+README+.gitignore、pnpm11 esbuild 许可、git init；踩坑：pnpm 只读 pnpm-workspace.yaml、playwright/chromium 版本不匹配用 executablePath、验证条件误用按钮禁用态