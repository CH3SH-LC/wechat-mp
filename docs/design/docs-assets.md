# 文档库与素材库：V3 决策记录

决策日期：2026-09-09；整理核对：2026-09-24。本文保留用户已确认目标；源码实现与目标有差异时明确列出，不用文档整理替代功能验收。

## 用户已确认决策

| 编号 | 决策 |
| --- | --- |
| D1 | 顶栏切换文档库/素材工坊；分别由主文档智能体或对应分类素材智能体服务 |
| D2 | 文稿与对话分离；文档默认自动保存，除非主动删除 |
| D3 | 素材库单机单用户私有，不做多账号/profile |
| D4 | 首版八类：bubble / divider / deco / banner / heading / art-inline / art-wide / photo-frame；bg/icon 后置 |
| D5 | 引用时固化素材副本；改库素材后扫描旧文档，由用户逐篇决定是否用新版更新 |
| D6 | 会话内修改就地更新默认文档，不堆叠多版 |
| D7 | 缺料自动委托并提示；由主智能体调用素材智能体（设计名 request_asset），主智能体绝不手写 SVG |

## 当前实现地图

- 文档保存源文 `source.md`、渲染产物 `article.html` 和元数据；默认文档与来源会话关联。当前删除文档连带删除来源会话，避免恢复时再生文档。
- 素材为 `assets/items/<id>/` 下的元数据和 SVG；逐目录扫描，不维护早期草案提议的 `index.json`。
- 主模型用 `search_assets` 查询，并产出 `[[asset:分类|名称或id|用途]]`；占位解析器优先复用，缺料调用 `gen_svg`，桌面补做素材自动入库。
- 文档 `assetSnapshots` 固化 SVG 与版本；替换源增加版本，工坊提供影响扫描和逐篇更新。
- 代码入口：[documents.ts](../../src/lib/documents.ts)、[documents.rs](../../src-tauri/src/documents.rs)、[asset-library.ts](../../src/lib/asset-library.ts)、[assets.rs](../../src-tauri/src/assets.rs)、[AssetWorkshop.tsx](../../src/components/AssetWorkshop.tsx)。

## 目标与实现差异

原草案含 `request_asset` 主模型工具、批量委托、文档读写工具及成本打点，不能仅凭 V3-R1/R2/R3 历史完成状态认定这些契约全部实现。当前缺料由 [image-agent.ts](../../src/lib/image-agent.ts) 调用 `gen_svg`；后续严格验收需逐项比对。原草案“仅删文档保留会话”与当前联动删除行为不同；此处仅记录实现差异，不把当前行为视为新增用户决策。

未完成或需复核的事项统一记在 [需求基线](../../REQUIREMENTS.md)。原长设计稿连同历次开发记录已完整保存在仓库外清理备份。
