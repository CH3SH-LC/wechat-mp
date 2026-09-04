# 移植 DSH 完整创作工艺——v2 语法 → HTML 确定性转换器（第 14 轮报告）

日期：2026-09-05 ｜ 状态：已实施并验证

## 用户问题与检查结论

> 为什么现在产物的质量还留在最初的版本？我 test 内更新的大量内容都去哪里了

检查证据：
- **知识文件零丢失**：桌面 `src/knowledge`（149 个 md）与 wechat-mp `test/knowledge` 三层镜像
  逐文件 MD5 对比，149 个共有文件内容 0 差异；仅缺 `迁移说明.md`、`交叉更新清单.md` 两个
  开发文档（设计排除）。两份树最新写入同为 09/02 23:20（重组完成当日同步）。
- **根因在消费侧**：桌面 persona 的"可用排版语法"仍是最初精简版（基础 HTML 十行），
  test 体系里 47 模块/30 风格/27 文案/15 类型知识从未进入生成流程；模型每轮只写
  "段落+标题+少量气泡"的简单 HTML，所以产物观感停在最初版本。
- 用户选方案 **B：移植 DSH 完整工艺**（v2 语法 → HTML 确定性转换器）。

## 实施

1. **compose.ts**：从 wechat-mp preset「SKILL.md Host 源码（已验证 pkg-8）」转写
   `markdownToWechatHtml` 核心为桌面纯 TS（约 600 行）：DESIGNS text/promo 双色系、
   inline（高亮/代码/badge/图/链/粗斜体）、全部块函数（bubble/divider/heading/quote/card/
   steps/banner/cols/imgrow/imgcard/timeline/band/frame/list/table/code/title/lace）、
   detectMode 模式检测、主循环解析、wrapper+plainText。
   桌面化：无微信资产 → artUrls 恒空，`art://` 引用自动移除并警告；本地图/表格/超 20000 字符
   均有警告。与 DSH 行为一致（间距 v5、平面化 v10 由引擎保证）。
2. **创作协议**：persona 改为"输出 ```v2 围栏正文（Markdown+v2 语法），本地排版引擎渲染 HTML"，
   语法表 = v2 全集；不再让模型直接写 HTML。
3. **前端**：```v2 围栏 → composeMarkdown → 375px 预览 + 质量检查；```html 直通通道保留
   （违规演示与旧会话）；流中 v2 围栏闭合即实时预览；会话恢复对最后 v2 正文重放 compose；
   warnings（art/本地图/表格）展示在预览区。
4. **Rust 修复**：实测 `reasoning_effort: max` 下推理会吃光默认 token 预算导致正文为空
   （completion=7996 全为推理、content 空）→ 请求体补 `max_tokens: 16000`（实测 16000/20000
   均被 API 接受）。

## 验证

- pnpm build exit 0；compose-check 22/22（模式检测、banner/steps/band/badge/title/气泡渲染、
  art 移除与警告、本地图/表格警告、文字类结构、普通文本包裹）。
- E2E 31 项全绿零浏览器错误：S1.7 源码区=v2 正文；新增 S1.8 compose 渲染断言
  （预览含 banner 标题/小节/气泡文本）；S1.5 导出 7485B = compose HTML；S1.6 刷新恢复经 compose；
  S2 违规演示 html 直通检出不变；S9a-d 语义保持。
- 真实模型端到端：v4-flash（max 推理、16000 预算）按新协议产出 900 字日系风 v2 正文
  （banner/cols/steps/band/KEY 气泡/引用/badge 全语法、零 emoji、无图）→ composeMarkdown
  渲染 promo：755 纯文字、8188B、0 警告。
- cargo 17/17 + live 冒烟 OK。产物：verify-artifacts/compose-sample.html、compose-live.html。

## 遗留说明

- 风格化色板：转换器与 DSH 一致仅提供 text/promo 双骨架色；按风格定制的色板/资产（art://）
  桌面不提供（art 引用被移除并警告）。若后续需要按风格换色，可扩展 palette 覆盖层。
- 真实链路下 v2 正文由模型产出，语法正确率取决于模型；转换器对错误语法有兜底提示，
  建议用户验收真实生成效果后按需再调 persona 示例。
