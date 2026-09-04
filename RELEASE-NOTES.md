# 发布说明（wechat-mp-desktop · 公众号推文助手桌面版）

> 版本 0.1.x · 2026-09-04 · 独立于 DSH 的本地桌面应用

## 这是什么

本地双栏创作工作台：**左侧与 AI 对话生成推文，右侧 375px 手机壳实时预览**。
底座为极简智能体（persona + 三层公众号知识语料检索 + DeepSeek 流式对话），
知识语料来自 wechat-mp 项目整理的三层知识库（文本 / 视觉 / 插图 / 其它，149 条目）。

## 功能（截至第 11 轮）

1. 多会话上下文（DSH 式）：**左侧常驻会话栏**——每个会话独立对话历史与内容，
   新建/切换/删除一步直达、当前高亮；顶栏「会话」按钮为折叠开关；
   自动保存并启动恢复；旧单会话存档自动迁移。文件在
   `文档/wechat-mp-workspace/sessions/<id>.json` + state.json（浏览器模式 localStorage）。
2. AI 对话生成：模式（自动 / 文字类 / 宣传类）+ 风格（校园/科技/国潮/日系/极简/商务/手账）
   选择随请求注入并参与知识检索；DeepSeek SSE 流式输出。
3. 需求澄清（req-clarify 落地）：收到请求先做需求评估（类型/风格/字数/调性/配图），
   缺 ≥2 项时弹出**澄清卡**——分维度选项补齐，点「确认并生成」才产出；
   说"直接写"或需求已清晰则直行，并在请求中**明确标注需求确认/默认假设**。
4. 对话流净化：气泡只显示 AI 说明文字，**不显示代码**；生成的 HTML 自动进入
   右侧预览；每条助手消息可点「查看 HTML 源码」展开（默认收起）。
5. 实时预览：回复中的 HTML 实时渲染为 375px 手机壳（可缩放 100-150%）。
6. 质量检查：v10 铁律客户端检查（零 emoji/零图标字符、无 style/script/文档级标签、
   无 linear-gradient/box-shadow、无外链图、无硬性宽度），通过/问题清单展示。
7. 导出：复制 HTML / 导出文件到 `文档/wechat-mp-workspace/exports/`。
8. 知识库懒加载：主包 <260KB（gzip <82KB），149 条目按需加载。

## 运行方式

- 源码运行：`pnpm tauri dev`（需 Rust + Node 工具链）
- 安装包：`pnpm tauri build --bundles nsis` → 产物在
  `src-tauri/target/release/bundle/nsis/*-setup.exe`（安装版）与
  `src-tauri/target/release/*.exe`（免安装版）

## 配置

- 应用内「设置」面板（顶栏按钮）：API Key（掩码输入）/ 接口地址 / 模型，
  保存到 `文档/wechat-mp-workspace/settings.json`（浏览器模式 localStorage）。
- 密钥优先级：环境变量 `DEEPSEEK_API_KEY` > 应用设置 > 旧版 `~/.dsh/.credentials.yaml`
  兼容读取（仅桌面模式，用于老机器平滑迁移）。
- 端点/模型：设置面板或 `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`（默认
  https://api.deepseek.com、deepseek-chat）。设置明文存本地，仅本机自用，不入库。

## 验证基线（第 1-5 轮全绿）

- playwright E2E：质量通过 / 违规检出 / 导出下载 / 刷新恢复+清空
- cargo 单测 13/13（SSE 解析、密钥解析、导出消毒、存档容错）
- live 冒烟 + 真实整篇抽样（3753 字 0 违规）
- 发布闭环：setup 静默安装 exit 0 → 安装版启动冒烟通过 → 静默卸载 exit 0 目录清理（2026-09-04）

## 已知边界（下一阶段候选）

- 未接入微信接口（发布/素材上传仍走 wechat-mp 插件预设链路）
- 单会话工作线（多会话草稿管理未做）
- 知识语料同步自 wechat-mp 三层镜像（转正后需重新同步真实库）
