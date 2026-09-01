# SKILL.md 修改点清单（v10.3 → v11 模拟）

> 转正时按此清单逐处修改 `skills/wechat-mp-bootstrap/SKILL.md`（唯一权威源码）。行号为 2026-08-29 快照，转正前先 grep 核对。
> 第 2 轮更新（2026-08-29）：追加 8 个组合模板复合资产（`combo-*`，SVG 内渐变+明暗分层，装饰长在组件结构上）。
> 第 3 轮更新（2026-08-29）：再追加 21 个第二批 combo 资产（复杂度基准：渐变≥2段/装饰≥2处/珍珠叶脉细节）——资产总数 **39 → 106**（25 纯色 + 14 插画 + 38 小标题单资产 + 29 复合资产）。

| # | 位置（快照行号） | 改什么 |
|---|---|---|
| 1 | L1 版本史标题 | v10.3 描述后追加 "+ v11 标题装饰资产：38 个单色精致版·8 大类 + 29 个组合模板复合资产（combo-*，两批：8 基础组合 + 21 复杂度基准版，渐变明暗分层、装饰长在组件结构上）" |
| 2 | L10 知识库指针 | knowledge 路由表已含新条目（index-copy/index-module 注册 + design-logic-components 顶层），无需改文案 |
| 3 | L79 资产总述 | "内置 39 个" → "内置 106 个"；分级描述加"三级：v11 标题装饰 38 个（纯色平面）+ 29 个组合模板复合资产（渐变明暗分层，复杂度基准：渐变≥2段/装饰≥2处/珍珠叶脉）" |
| 4 | L81-107 资产表 | 追加 38 + 29 行（名称/用途/尺寸，内容同 `test/assets/module-art-assets.md` 表格） |
| 5 | L111 面板文案 | "美术资产区（9 资产渲染并上传）" → 数量 39（面板区渲染按钮随 ARTS 数组自动扩展，文案同步） |
| 6 | Client 块 ARTS 数组 | 追加 `test/assets/ARTS-subheading-add.mjs` 的 38 个对象 + `ARTS-subheading-combo.mjs` 的 8 个 + `ARTS-subheading-combo2.mjs` 的 21 个（在现有 39 个之后） |
| 7 | Client 块 ARTS 总述注释 | 39 → 106；版本标注 v11 |
| 8 | Host 块工具描述（L1084） | 语法说明追加"标题装饰资产：`![说明](art://badge-num-circle)` 等 38 个 + `combo-*` 组合模板 29 个（详见 module-subheading）" |
| 9 | L1333 面板 placeholder | 示例追加一个 `![夹线](art://clamp-line)` 用法 |
| 10 | 自举步骤段 | 版本号 v10.3 → v11；资产数 39 → 106 |

## 配套文件同步（非 SKILL.md）

| 文件 | 改什么 |
|---|---|
| `dev/DEV.md` | 版本速记：v10.3 → v11（+38 小标题装饰资产 + 29 组合模板）；脚本清单追加 `render-subheading.mjs` / `render-combo.mjs` / `render-combo2.mjs` |
| `knowledge/00-GUIDE.md` | 审美硬规范第 3 条资产数 39 → 49；新增条目无需改路由表（小标题归 copy/module 维度） |
| `knowledge/module/module-art-assets.md` | 追加第四节（内容见 `test/assets/module-art-assets.md`，含 ⑨⑩ 复合资产小节 + 复杂度铁律） |
| `knowledge/index-copy.md` / `index-module.md` | 注册新条目（完整改版见 `test/knowledge/` 同名文件） |
| `knowledge/copy/`、`module/` 等 12 处 | 按 `test/knowledge/交叉更新清单.md` 加互指指针 |
| `README.md` / `REQUIREMENTS.md` | 版本号与第 1/2/3 轮状态 |

## 转正后验证（dev/scripts）

1. `node check-client-v103.mjs` — 改版：ARTS 数量断言 39 → 106、名称唯一性、新资产 w/h/svg 合法性（可 import 三个 validate）
2. `node syntax-all-v10.mjs` — Host 编译 + 双模式零违规（正文 CSS 零渐变/零 emoji 不受新资产影响——资产是图片；combo 资产渐变在图片内合法）
3. 新增 `node render-subheading.mjs` — 渲染 38 新资产 PNG + 小标题 demo 推文（375px 壳）
4. 新增 `node render-combo.mjs` / `render-combo2.mjs` — 渲染 29 复合资产 PNG + 组合模板演示（375px 壳，验证叠字/融合布局）
5. `node scan-kb-v10.mjs` — 知识库全库残留扫描（新条目零 emoji/零渐变/零开发术语）
6. 全绿 → 重新 define + update wxmp-1（Host+Client 同包）→ `cordis_inspect_self` 确认 currentPackageId 切换 + 双半区齐全
