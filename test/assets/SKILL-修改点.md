# SKILL.md 修改点清单（v10.3 → v11 模拟）

> 转正时按此清单逐处修改 `skills/wechat-mp-bootstrap/SKILL.md`（唯一权威源码）。行号为 2026-08-29 快照，转正前先 grep 核对。
> 第 2 轮更新（2026-08-29）：追加 8 个组合模板复合资产（`combo-*`，SVG 内渐变+明暗分层，装饰长在组件结构上）。
> 第 3 轮更新（2026-08-29）：再追加 21 个第二批 combo 资产（复杂度基准：渐变≥2段/装饰≥2处/珍珠叶脉细节）——资产总数 **39 → 106**（25 纯色 + 14 插画 + 38 小标题单资产 + 29 复合资产）。
> 第 12 轮更新（2026-08-29）：**行内装饰与文字协调修复**——`inline()` 的 art:// 分支从"整幅居中 56%"改为"行内小图标模式"（`art://名称[:px]` 语法），新增 6 个紧裁底部锚点行内资产（inline-*），资产总数 **106 → 112**。

| # | 位置（快照行号） | 改什么 |
|---|---|---|
| 1 | L1 版本史标题 | v10.3 描述后追加 "+ v11 标题装饰资产：38 个单色精致版·8 大类 + 29 个组合模板复合资产（combo-*，两批：8 基础组合 + 21 复杂度基准版，渐变明暗分层、装饰长在组件结构上）" |
| 2 | L10 知识库指针 | knowledge 路由表已含新条目（index-copy/index-module 注册 + design-logic-components 顶层），无需改文案 |
| 3 | L79 资产总述 | "内置 39 个" → "内置 112 个"；分级描述加"三级：v11 标题装饰 38 个（纯色平面）+ 29 个组合模板复合资产（渐变明暗分层，复杂度基准：渐变≥2段/装饰≥2处/珍珠叶脉）" |
| 4 | L81-107 资产表 | 追加 38 + 29 行（名称/用途/尺寸，内容同 `test/assets/module-art-assets.md` 表格） |
| 5 | L111 面板文案 | "美术资产区（9 资产渲染并上传）" → 数量 39（面板区渲染按钮随 ARTS 数组自动扩展，文案同步） |
| 6 | Client 块 ARTS 数组 | 追加 `test/assets/ARTS-subheading-add.mjs` 的 38 个对象 + `ARTS-subheading-combo.mjs` 的 8 个 + `ARTS-subheading-combo2.mjs` 的 21 个（在现有 39 个之后） |
| 7 | Client 块 ARTS 总述注释 | 39 → 112；版本标注 v11 |
| 8 | Host 块工具描述（L1084） | 语法说明追加"标题装饰资产：`![说明](art://badge-num-circle)` 等 38 个 + `combo-*` 组合模板 29 个（详见 module-subheading）" |
| 9 | L1333 面板 placeholder | 示例追加一个 `![夹线](art://clamp-line)` 用法 |
| 10 | 自举步骤段 | 版本号 v10.3 → v11；资产数 39 → 112 |

## 第 12 轮新增修改点（行内装饰与文字协调）

| # | 位置 | 改什么 |
|---|---|---|
| 12-1 | Host 块 `inline()` 的 `![](...)` 分支（L313-319） | art:// 分支改为：解析 `art://名称[:px]`（px 缺省 16）→ `<img src="art://名称" style="display:inline-block;height:{px}px;width:auto;vertical-align:baseline;border-radius:0;margin:0 3px 0 0">`；本地/外链内容图保持全宽 `display:block` 不变。**整行 art:// 图片路径（L789-794）保持居中 56% 不变**（独立成行的整幅装饰） |
| 12-2 | Host 块 `inline()` 之前 | 新增小函数 `inlineArt(alt, name, px)` 输出上述行内图 HTML（含 art:// 占位 src，统一由 L823 的 art:// 替换逻辑换 URL） |
| 12-3 | 语法表（L56 附近） | `![说明](art://名称)` 行追加说明："行内装饰用 `art://名称:显示高px`（如 `![花](art://inline-flower:16)`，缺省 16px，12-20px 为宜）——行内小图按高度渲染并基线对齐；不加 px 且独立成行时按整幅装饰居中 ≤56%" |
| 12-4 | Client 块 ARTS 数组 | 追加 `test/inline-deco/ARTS-inline-deco.mjs` 的 6 个对象（inline-flower/sprig/leaf/star/ball/seal，120×120，紧裁+底部锚点）——资产总数 **106 → 112** |
| 12-5 | 知识库 | `module-inline-deco.md` 转正（test/knowledge/ → knowledge/module/）；module-badge/module-list 行内 art 引用补 module-inline-deco 指针；index-module 注册 |
| 12-6 | 自举/版本段 | 版本号 v11（+6 行内装饰资产）；资产数 39 → 112 |

## 配套文件同步（非 SKILL.md）

| 文件 | 改什么 |
|---|---|
| `dev/DEV.md` | 版本速记：v10.3 → v11（+38 小标题装饰资产 + 29 组合模板 + 6 行内装饰）；脚本清单追加 `render-subheading.mjs` / `render-combo.mjs` / `render-combo2.mjs` / `render-inline-demo.mjs` |
| `knowledge/00-GUIDE.md` | 审美硬规范第 3 条资产数 39 → 49；新增条目无需改路由表（小标题归 copy/module 维度） |
| `knowledge/module/module-art-assets.md` | 追加第四节（内容见 `test/assets/module-art-assets.md`，含 ⑨⑩ 复合资产小节 + 复杂度铁律） |
| `knowledge/index-copy.md` / `index-module.md` | 注册新条目（完整改版见 `test/knowledge/` 同名文件） |
| `knowledge/copy/`、`module/` 等 12 处 | 按 `test/knowledge/交叉更新清单.md` 加互指指针 |
| `README.md` / `REQUIREMENTS.md` | 版本号与第 1/2/3/12 轮状态 |

## 转正后验证（dev/scripts）

1. `node check-client-v103.mjs` — 改版：ARTS 数量断言 39 → 112、名称唯一性、新资产 w/h/svg 合法性（可 import 三个 validate + 行内资产 validate）
2. `node syntax-all-v10.mjs` — Host 编译 + 双模式零违规（正文 CSS 零渐变/零 emoji 不受新资产影响——资产是图片；combo 资产渐变在图片内合法）
3. 新增 `node render-subheading.mjs` — 渲染 38 新资产 PNG + 小标题 demo 推文（375px 壳）
4. 新增 `node render-combo.mjs` / `render-combo2.mjs` — 渲染 29 复合资产 PNG + 组合模板演示（375px 壳，验证叠字/融合布局）
5. 新增 `node render-inline-demo.mjs` + `verify-inline-deco.mjs` — 行内装饰 before/after 对比 + 独立验收（资产级 probe/紧裁/锚点 + 375px 壳基线对齐）
6. `node scan-kb-v10.mjs` — 知识库全库残留扫描（新条目零 emoji/零渐变/零开发术语）
7. 全绿 → 重新 define + update wxmp-1（Host+Client 同包）→ `cordis_inspect_self` 确认 currentPackageId 切换 + 双半区齐全

## 第 13 轮新增修改点（知识库三层重组——文本/视觉/插图/其它）

> 本轮的 SKILL.md 代码本身不改，改的是**知识库结构**（转正步骤详见 `test/knowledge/迁移说明.md`）。

| # | 位置 | 改什么 |
|---|---|---|
| 13-1 | knowledge/ 目录结构 | 13 维度平铺 → 三层：`文本/`（内容类型/文案/合规）、`视觉/`（模块/风格）、`插图/`（图片/视频）、`其它/`（封面/可读性）；根级 index-*.md 退役 → 各方向内 00-索引.md；00-GUIDE.md 改为三层路由总表 |
| 13-2 | knowledge/ 排除维度 | topic / positioning / publish / growth / review / legacy 共 41 文件移出 → `skills/wechat-mp-bootstrap/ops-knowledge/`（新归档目录），knowledge/ 内留归档指针 |
| 13-3 | knowledge 条目替换/新增 | module-badge/band/bubble/card/divider/list/steps 用 test 八节草稿版替换真实旧版；module-subheading、module-inline-deco 入 视觉/模块；copy-subheading 入 文本/文案；design-logic-components.md 定位根级"先读" |
| 13-4 | knowledge/image 维度 | image/ → 插图/图片/：img-* 4 文件定位链条化（获取→授权→处理→插入→替代）+ 新增 img-insert.md；legacy/05 引用移除、交叉行改新路径 |
| 13-5 | 插图/视频（新方向） | video-prepare.md / video-insert.md + 00-索引（提纲 2026-08-29 确认，已落盘 test/knowledge/插图/视频/） |
| 13-6 | SKILL.md「知识库（先读再写）」节 | 知识库路径/结构描述同步三层（转正时按镜像 00-GUIDE 改） |
| 13-7 | 配套文件 | `agent.cordis.yml` persona「知识调用指南」旧 legacy 编号引用（07-design-text 等）→ 改三层路径；`dev/scripts/scan-kb-v10.mjs` 目录假设 13 维度 → 三层；README/REQUIREMENTS 同步 |
