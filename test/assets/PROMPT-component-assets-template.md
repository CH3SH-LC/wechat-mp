# 组件资产生成任务 prompt 骨架（阶段 B 复用模板）

> 用途：6 个组件（卡片/分割线/色带/步骤/列表/徽章）各自开子智能体生成 10 个资产时的统一任务模板。
> 用法：复制本骨架，替换 {{组件名}} / {{组件英文}} / {{组合方式清单}} / {{画布尺寸}} / {{zone 要求}} / {{风格词汇}} 后注入子智能体。

## 任务

你是 wechat-mp 美术资产开发子智能体。任务：**生成 10 个不同的 {{组件名}} 素材（SVG → 4x PNG + 三层验证 + 预览页）**，一次做对，零返工。

## 知识文件（必读，唯一规范）

1. 先用 read 读取 `D:\deepseek-harness\wechat-mp\test\knowledge\module-{{组件英文}}.md` 全文 —— 本组件类型×风格知识文件，**§五 5.0 整图资产构建规范为强制要求**（画布 {{画布尺寸}}、zone 容量、PNG ≤1MB 且大面积背景渐变垂直、三层验证闭环）。
2. 参考资产：`D:\deepseek-harness\wechat-mp\test\assets\bubble2\ARTS-bubble2.mjs`（已验证的资产写法：gU 垂直渐变/zone 字段/probe 纯色部件/validate 函数）。
3. 渲染模板：`D:\deepseek-harness\wechat-mp\test\assets\bubble2\render-bubble2-test.mjs` + `verify-bubble2-375.mjs`（复制改造）。

## 产出（写入 test/assets/{{组件英文}}/ 子目录）

- `ARTS-{{组件英文}}.mjs` — 10 资产（命名 `{{组件英文}}-*`，覆盖组合方式：{{组合方式清单}}）+ validate 校验
- `render-{{组件英文}}-test.mjs` — 4x 渲染 + probe + 体积 + zone 洁净扫描 + 预览页
- `verify-{{组件英文}}-375.mjs` — 375px 壳叠字 DOM 实测（真实文案叠入 zone，10/10 界内）
- png/ + preview + demo 页

## 铁律（从知识文件继承）

- 复杂度：渐变 ≥2 段、装饰 ≥2 处且长在结构上、珍珠/叶脉/多层花瓣细节
- 精细度 v5×4：flower5X/leafX/pearlX/curlS + 4-6 stop 渐变（用 ARTS-fine-utils.mjs）
- 显示尺寸：主装饰显示 ≥16px（设计 = 显示 ÷ 缩放比 0.457）
- zone：{{zone 要求}}
- 零 emoji；probe 落纯色部件；PNG ≤1MB
- 风格词汇：{{风格词汇}}

## 验收（三层，全部 10/10 才交付）

a) 渲染+probe+体积 10/10；b) zone 洁净扫描 10/10（突变=0）；c) 375px 壳 DOM 10/10（文字全在 zone 内）

## 返回

资产清单 + 三层验证结果 + 文件路径 + 每个资产"风格决定内容"一句话。
