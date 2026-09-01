# wechat-mp 开发指南（DEV.md）

> 本目录是 **wechat-mp 预设的完整开发端**：源码唯一权威是上级 `SKILL.md`，本 `dev/` 提供验证脚本、测试素材、产物快照与开发流程。任何会话（包括新窗口）想继续开发，先读本文件。

## 一、目录结构

```
wechat-mp-bootstrap/            # skill 根（预设随 .agent-presets 常驻）
├── SKILL.md                    # ★ 唯一权威源码：两个 `````js 代码块（Host 块在前、Client 块在后）
│                               #   L1 标题 = 版本史；L12-18 自举步骤；L20+ 使用说明与语法表
├── knowledge/                  # 知识库（00-GUIDE 路由 + index-* 索引 + 条目文件，legacy/ 为历史归档）
└── dev/                        # ★ 开发端（本目录）
    ├── DEV.md                  # 本文件
    ├── scripts/                # 全部验证与渲染脚本（自包含，路径经 lib/env.mjs 自适应）
    │   ├── lib/env.mjs         # 路径常量 + playwright/chromium 探测（机器无关）
    │   ├── syntax-all-v10.mjs  # 双模式全语法覆盖（零 emoji/零渐变/零阴影）
    │   ├── check-client-v103.mjs # Client 源码语法 + ARTS 数量/唯一性
    │   ├── scan-kb-v10.mjs     # 知识库全库扫描（emoji/图标字符/渐变残留）
    │   ├── render-arts-v103.mjs # 渲染 14 个 v10.3 资产 → PNG + 预览页
    │   ├── check-gradient-v103.mjs # 像素抽样验证渐变真实渲染
    │   ├── gen-10lian.mjs      # 军训十连推文（带图案）渲染 375px HTML + 截图
    │   ├── check-run-art.mjs   # v10.2 装饰图 13 项断言（读 gen-10lian 产物）
    │   ├── layout-art-v102.mjs # Playwright 实测装饰元素尺寸/位置
    │   └── gen-v103-demo.mjs   # v10.3 新资产上稿 demo 推文
    └── artifacts/              # 测试素材与产物快照
        ├── 10lian-tuiwen.md    # 十连推文源稿（gen-10lian 输入）
        ├── *.png               # 10lian-run-art / preview-v103 / v103-demo 截图快照
        └── assets-v103/        # 14 个新资产 PNG
```

## 二、版本与结构速记

- 当前版本 **v10.3**（39 个美术资产 = 25 纯色平面 + 14 复杂渐变插画；SVG 内渐变合法，因为资产渲染为 PNG 图片，正文 CSS 平面化铁律不受影响）
- 版本史：v2 设计系统 → v5 间距硬规范 → v6/v7 高级模板与花纹 → v8 主题色板（已弃）→ v9 去内置主题（配色从知识库风格条目读取）→ v10 平面化（零渐变/零阴影/零 emoji）→ v10.1 段落容器化 + 资产扩到 25 → v10.2 装饰图独立居中/角饰 60px/vine 花边标题 → v10.3 复杂插画
- Host 块：DESIGNS 骨架色 + markdownToWechatHtml 转换器 + 5 个 wechat_mp_* 工具 + renderArt
- Client 块：ARTS 数组（39 个，每个 `{name,label,w,h,svg}`）+ svgToPng（canvas 2x）+ Panel（表单 + 39 个「渲染并上传」按钮）

## 三、完整开发闭环（改任何东西都走这 4 步）

### 1. 改源码
编辑 `../SKILL.md`（唯一权威）。改的是 Client 资产 → 编辑 ARTS 数组；改的是排版/工具 → 编辑 Host 块；改的是知识 → 编辑 `../knowledge/`。

### 2. 本地验证（dev/scripts/ 下执行，全部 `node <脚本>`）
```powershell
cd dev/scripts
node check-client-v103.mjs      # 必跑：Client 语法 + ARTS 数量（改资产后）
node syntax-all-v10.mjs         # 必跑：Host 编译 + 双模式零违规（改 Host 后）
node scan-kb-v10.mjs            # 改知识库后：全库残留扫描（☐ 表单占位为已知保留）
# 渲染与回归（改装饰/布局后）：
node gen-10lian.mjs             # 重新渲染十连推文（带图案）→ artifacts/
node check-run-art.mjs          # 13 项断言（读上面产物）
node layout-art-v102.mjs        # 装饰元素尺寸实测
# v10.3 资产相关：
node render-arts-v103.mjs       # 重新渲染 14 资产 + 预览页
node check-gradient-v103.mjs    # 渐变像素抽样
node gen-v103-demo.mjs          # 新资产上稿 demo
```
> 运行依赖：Node ≥18、本机 ms-playwright chromium（env.mjs 自动探测）。产物统一写 `dev/artifacts/`。

### 3. 重新 define + 激活运行插件
```text
cordis_inspect_self            # 查 pluginId（通常 wxmp-1）与 currentPackageId
cordis_define                  # kind: existing + pluginId，code.host / code.client 从 SKILL.md 两个块逐字粘贴
                               #   （可先提取到文件再读；转写时小心正则引号，见「坑」）
cordis_run                     # mode: update + 新 packageId；Client 激活需页面确认（client-pending → running）
cordis_inspect_self            # 确认 currentPackageId 已切换 + 双半区 hasHostHalf/ClientHalf=true
```
> **Host+Client 必须同包**：拆成两个包分别激活会丢失另一半（见「坑」）。

### 4. 文档同步
编辑后必须更新：`D:\deepseek-harness\PROGRESS.md`（详细条目，含根因）+ `PROGRESS-LITE.md`（一行精简）+ 本文件（如有结构变化）。

## 四、常见坑（血的教训）

1. **cordis_run 一次只激活一个 Package**：Host-only 与 Client-only 拆包时，激活任一个另一半消失（Tool.listTools 无 wechat_mp_*）。永远定义 Host+Client 同包并 update。
2. **转写源码的转义错误**：SKILL.md 源码块里正则 `$/)` 在手工转写时易写成 `$/'`，define 报 `missing ) after argument list`。从文件提取→逐字粘贴；define 失败先查正则与括号。
3. **PowerShell 限制**：`$host` 是保留变量（用 `$h`）；node -e 内联长代码易被 PowerShell 转义破坏（写 .mjs 文件更稳）；UTF-8 计数用 `[IO.File]::ReadAllText`。
4. **art:// 缓存是进程内 state**：新窗口/重启后需在面板重新「渲染并上传」（微信 URL 永久有效，仅重建缓存）；未上传的引用会被移除并告警。
5. **v10 铁律 vs 资产渐变**：正文 CSS 零渐变/零阴影/零 emoji 是硬铁律；SVG 资产是图片，渐变明暗合法——检查脚本只验正文 HTML，不验资产 SVG。
6. **emoji 正则**：`\u{1F000}-\u{1FAFF}` 必须 `/u` 标志且范围从小到大，否则 Range out of order。
7. **知识库 legacy/** 是历史归档：回查可以，不要当活跃内容改。

## 五、自举与新窗口恢复

SKILL.md L12-18 有完整 3 步自举（define → run → 验证）。新窗口 `wechat_mp_*` 工具不可用 = 插件随进程重启消失，按自举步骤重建即可；本 dev/ 目录与 knowledge/ 均随 preset 常驻，不随插件消失。恢复后记得重新填 appid/secret 与重传资产。

## 六、开发历史

工作区级 `D:\deepseek-harness\PROGRESS.md`（搜 `wxmp`）与 `PROGRESS-LITE.md` 记录全部版本迭代；旧版测试脚本与实测产物已于 2026-08-29 清理（本 dev/ 为唯一现行工具链）；历史调研文档在 preset 根 `research/`。
