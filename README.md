# wechat-mp — 微信公众号推文助手

> 创作型 Agent（DeepSeek Harness 插件预设）：基于调研方法论（选题/标题/结构/排版规范）产出微信合法 HTML，可直连草稿箱/发布/状态查询。内置**类型 × 风格组件体系**与 **SVG → PNG 美术资产渲染管线**。

## 特性

- **类型 × 风格组件体系**：8 个组件类型（小标题/气泡/卡片/分割线/花纹色带/步骤/列表/徽章），每个含 4-8 种组合方式（骨架模板）+ 风格词汇表填充规则——"类型决定骨架、风格决定内容"
- **80+ 美术资产**：v5 精细度（×4）SVG 源 + 4x PNG 渲染产物，覆盖校园/国潮/科技/极简/自然花草等风格
- **三层验证渲染管线**：playwright canvas SVG→PNG（4x）→ probe 像素验证 → zone 洁净扫描 → 375px 手机壳叠字 DOM 实测
- **13 维度知识库**：选题/标题/结构/文案/排版/风格/图片/合规/发布/增长/复盘等 100+ 条目（含官方文档实证的微信兼容约束）
- **微信兼容实证**：SVG 上传限制、T/CASME 1609—2024 白名单、CSS 内联约束等（见 `research/2026-08-29-research-subheading.md`）

## 目录

| 路径 | 说明 |
|---|---|
| `skills/wechat-mp-bootstrap/SKILL.md` | ★ 唯一权威源码：Host/Client 两个 JS 代码块 + 自举步骤 + 语法表 |
| `skills/wechat-mp-bootstrap/knowledge/` | 知识库（00-GUIDE 路由 + 13 维度索引 + 条目文件；legacy/ 为历史归档） |
| `skills/wechat-mp-bootstrap/dev/` | ★ 开发端：`DEV.md` 开发指南 + `scripts/` 验证渲染脚本（自包含）+ `artifacts/` 素材与产物 |
| `test/` | 组件类型×风格知识文件 + 美术资产生成产物（60+ 资产与预览页）+ 测试推文 |
| `research/` | 深度调研报告（小标题情景：文案写法/SVG 素材/微信兼容性） |
| `agent.cordis.yml` / `preset.yml` | DSH 预设挂载配置 |

## 快速开始

**作为 DSH 插件使用**：
1. 将本仓库挂载为 agent preset（`~/.dsh/.agent-presets/wechat-mp`）
2. 新会话发起推文任务，agent 自动加载 skill 自举（详见 SKILL.md 自举步骤）
3. 运行期需配置微信公众号 AppID/AppSecret（运行时表单填写，不落盘）

**本地渲染资产**：
```bash
node skills/wechat-mp-bootstrap/dev/scripts/<验证脚本>   # 或 test/assets/<组件>/render-<组件>-test.mjs
```
依赖：Node ≥ 18 + 本机 ms-playwright chromium（脚本自动探测）。

**开发**：先读 `skills/wechat-mp-bootstrap/dev/DEV.md`——4 步闭环：改 SKILL.md → dev/scripts 脚本验证 → 重新 define/update 激活 → PROGRESS 同步。

## 开发历史

| 里程碑 | 内容 |
|---|---|
| v0-v10.3 | 基础推文生成（选题/标题/结构/排版），39 美术资产（25 纯色 + 14 插画） |
| 2026-08-29 | 小标题深度调研（4 路并行 80+ 来源）；类型×风格模型确立；8 组件知识体系；80+ 资产 v5 精细度升级；三层验证管线 |

详见 `REQUIREMENTS.md`（需求登记册，逐轮记录）与各组件知识文件。

## 许可证

MIT License（见 LICENSE）。
