# 公众号推文助手桌面版 开发进度（精简版）

> 标签：[New Feature] 新功能 / [Debug] 修复 / [Change] 变更 / [Build] 构建
> 详细记录见 PROGRESS.md

---
## 2026-08-29
- [New Feature] 第 1 轮：桌面双栏骨架 + 极简智能体链路——Tauri2+React19 脚手架（1380x880「公众号推文助手」）、src/lib（persona/知识检索/双通道 chat/HTML 提取）、ChatPane+PreviewPane(375px 手机壳 iframe)、Rust chat.rs（env/.dsh 密钥解析+SSE 流式+chat-delta 事件，6 单测+live 冒烟 OK）、知识语料 src/knowledge 三层 149 文件、verify-ui.mjs E2E 4/4 PASS（截图 verify-artifacts/wxmp-desktop-ui.png）；tauri dev 窗口启动确认
- [Build] 第 0 轮：项目初始化——create-tauri-app react-ts、四文件体系+REQUIREMENTS+README+.gitignore、pnpm11 esbuild 许可、git init；踩坑：pnpm 只读 pnpm-workspace.yaml、playwright/chromium 版本不匹配用 executablePath、验证条件误用按钮禁用态