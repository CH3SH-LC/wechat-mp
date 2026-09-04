# 发布说明（wechat-mp-desktop · 公众号推文助手桌面版）

> 版本 0.1.x · 2026-09-05 · 独立于 DSH 的本地桌面应用

## 这是什么

本地双栏创作工作台：**左侧与 AI 对话生成推文，右侧 375px 手机壳实时预览**。
底座为极简智能体（persona + 三层公众号知识语料检索 + DeepSeek 流式对话），
知识语料来自 wechat-mp 项目整理的三层知识库（文本 / 视觉 / 插图 / 其它，149 条目）。

## 功能（截至第 15 轮）

1. 模型与 DSH 对齐：默认 **deepseek-v4-flash** + `reasoning_effort: max`（与 DeepSeek Harness 相同配置；
   设置面板可改端点/模型），请求带 max_tokens 16000（防推理吃光输出预算）。
2. 现场生成美术素材：每篇推文强制包含 **::: art** 素材——AI 按知识库规范现场绘制 SVG
   （带 viewBox、图形元素 ≥6 才会被接受，不足自动拦截提示），前端渲染为图片内嵌
   预览与导出（自包含，微信后台粘贴可转存）；植物/器物意象、零文字零 emoji、
   低饱和同色系 ≤4 色、密度每屏 ≤1。
3. v2 排版引擎（移植 DSH 完整工艺）：AI 创作时输出 **v2 语法正文**（Markdown + `[[banner]]`/`[[title]]`/`[[badge]]`/
   `> [!KEY]` 气泡/`::: steps|cols|band|frame|timeline`/`[[lace]]`/分割线变体/引用/加粗/高亮 等），
   由本地确定性转换器渲染为 375px 微信合法内联 HTML（间距 v5、平面化 v10、文字/宣传双色系）——
   与 wechat-mp 预设同源工艺；气泡显示说明文字，「查看正文」可展开 v2 原文；
   预览区提示转换器警告（本地图/表格/素材未达标/超长）。
4. 模型自主对话：闲聊、公众号写作答疑、创作请求全部由模型自主判断——信息不足时 AI 在对话流里
   自然反问（最多 1 个关键问题），回答后直接产出；说"算了"停止创作回对话；无卡片、无按钮框、
   无本地规则路由。
5. 多会话上下文（DSH 式）：**左侧常驻会话栏**——每个会话独立对话历史与内容，
   新建/切换/删除一步直达、当前高亮；顶栏「会话」按钮为折叠开关；
   自动保存并启动恢复；旧单会话存档自动迁移。文件在
   `文档/wechat-mp-workspace/sessions/<id>.json` + state.json（浏览器模式 localStorage）。
6. AI 创作生成：模式（自动 / 文字类 / 宣传类）+ 风格（校园/科技/国潮/日系/极简/商务/手账）
   选择随请求注入并参与知识检索；DeepSeek SSE 流式输出（含推理）。
7. 对话流净化：气泡只显示 AI 说明文字，**不显示代码**；生成的 HTML 自动进入
   右侧预览；每条助手消息可点「查看正文」/「查看 HTML 源码」展开（默认收起）。
8. 实时预览：v2 正文与素材实时渲染为 375px 手机壳（可缩放 100-150%）。
9. 质量检查：v10 铁律客户端检查（零 emoji/零图标字符、无 style/script/文档级标签、
   无 linear-gradient/box-shadow、无外链图、无硬性宽度），通过/问题清单展示。
10. 导出：复制 HTML / 导出文件到 `文档/wechat-mp-workspace/exports/`。
11. 知识库懒加载：主包 <260KB（gzip <82KB），149 条目按需加载。

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
  https://api.deepseek.com、deepseek-v4-flash；请求固定带 reasoning_effort: max 与 max_tokens 16000，与 DSH 一致）。设置明文存本地，仅本机自用，不入库。

## 验证基线（第 1-5 轮全绿）

- playwright E2E：质量通过 / 违规检出 / 导出下载 / 刷新恢复+清空
- cargo 单测 13/13（SSE 解析、密钥解析、导出消毒、存档容错）
- live 冒烟 + 真实整篇抽样（3753 字 0 违规）
- 发布闭环：setup 静默安装 exit 0 → 安装版启动冒烟通过 → 静默卸载 exit 0 目录清理（2026-09-04）

## 已知边界（下一阶段候选）

- 未接入微信接口（发布/素材上传仍走 wechat-mp 插件预设链路）
- 单会话工作线（多会话草稿管理未做）
- 知识语料同步自 wechat-mp 三层镜像（转正后需重新同步真实库）
