# 公众号推文助手 · 桌面工作台

<https://github.com/CH3SH-LC/wechat-mp> 知识体系的独立桌面版：左侧与 AI 对话生成推文，右侧 375px 手机壳实时预览。底座参考 DSH 极简智能体（persona + 知识检索 + 流式对话），不依赖 DSH/Cordis 运行时。

## 开发

```bash
pnpm install
pnpm dev          # 纯浏览器模式（本地模拟对话，演示双栏链路）
pnpm tauri dev    # 桌面模式（Rust 流式调用 DeepSeek）
```

密钥：环境变量 `DEEPSEEK_API_KEY`；未设置时自动读取 `~/.dsh/.credentials.yaml` 的 `DEEPSEEK_API_KEY`。端点/模型可用 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 覆盖（默认 `https://api.deepseek.com`、`deepseek-chat`）。

知识库：`src/knowledge/`（三层结构：文本/视觉/插图/其它，149 个条目）随前端打包，对话前按主题检索节选注入提示词。
