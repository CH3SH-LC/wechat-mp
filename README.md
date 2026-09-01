# wechat-mp — 微信公众号推文助手（插件项目）

> 本目录是 **wechat-mp 预设的完整项目根**：工作区路径 `D:\deepseek-harness\wechat-mp` 与运行时路径 `C:\Users\Lenovo\.dsh\.agent-presets\wechat-mp` 为 **NTFS Junction 同一物理位置**——改哪边都一样，永远同步。

## 目录

| 路径 | 说明 |
|---|---|
| `skills/wechat-mp-bootstrap/SKILL.md` | ★ 唯一权威源码：Host/Client 两个 ````js` 代码块 + 自举步骤 + 语法表 |
| `skills/wechat-mp-bootstrap/knowledge/` | 知识库（00-GUIDE 路由 + 13 维度索引 + 条目文件；legacy/ 为历史归档） |
| `skills/wechat-mp-bootstrap/dev/` | ★ 开发端：`DEV.md` 开发指南 + `scripts/` 验证渲染脚本（自包含）+ `artifacts/` 素材与产物 |
| `test/` | 实现阶段模拟（小标题知识库/素材库改动预演，2026-08-29；转正后清理） |
| `agent.cordis.yml` / `preset.yml` | 预设挂载配置 |

## 快速开始

- **使用**：新会话直接发起推文任务，agent 自动加载 skill 自举（详见 SKILL.md 自举步骤）
- **开发**：先读 `skills/wechat-mp-bootstrap/dev/DEV.md`——4 步闭环：改 SKILL.md → dev/scripts 脚本验证 → 重新 define/update 激活 → PROGRESS 同步
- **版本**：当前 v10.3（39 个美术资产 = 25 纯色平面 + 14 复杂渐变插画）

## 开发历史

工作区级 `D:\deepseek-harness\PROGRESS.md`（搜 `wxmp`）+ `PROGRESS-LITE.md`；历史调研收拢在 `research/`（`wechat-mp-article.md` 前期调研 / `style-inventory.md` 风格草案 / `wechat-design/` 设计调研 / `2026-08-29-research-subheading.md` 小标题情景细化调研）。
