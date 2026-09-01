# wechat-mp-bootstrap：微信公众号推文动态插件自举（v2 设计系统 + v5 间距硬规范 + v6/v7 高级模板与花纹 + v9 去内置主题：配色一律从知识库风格条目读取以内联样式落地 + v10 平面化审美：零渐变/零阴影/零 emoji/零图标字符，植物图案资产 + 气泡/标题图案装饰语法 + v10.3 复杂 SVG 插画资产：场景横幅/植物插画/复杂边框/印章徽章，SVG 内渐变明暗，渲染为 PNG 图片上传，不违反正文平面化铁律）

## 触发

- 会话中 `wechat_mp_*` 工具（compose / draft / publish / status / art）不可用，而任务需要制作或发布公众号推文时。
- 动态插件 wxmp-1 随进程重启消失（动态插件不持久），任何新会话都可能需要本 skill。

## 知识库（先读再写）

排版/配色/布局/标题等设计知识已拆分为独立文件，入口：**`knowledge/00-GUIDE.md`**（任务→知识文件路由表 + 间距硬规范 + 工作流）。写正文前必须按路由表查阅对应知识文件；本文件只负责自举与工具说明。

## 自举步骤（3 步）

1. **cordis_define**（kind: new，idPrefix: `wxmp`）：粘贴下方「Host 源码」与「Client 源码」作为 `code.host` / `code.client`，name 取 `wechat-mp-article-tool`，purpose 写「微信推文排版工具 v10.3：39 个 SVG 美术资产（25 纯色平面 + 14 复杂渐变插画），Host+Client 同包」。
2. **cordis_run**（mode: run）：首次会返回 awaiting-approval，请用户在 GUI 批准；批准后 Host 半区注册 5 个工具，Client 半区在 run 卡片内渲染「微信公众号推文工具」面板。
3. **验证**：`cordis_inspect_query`（Tool.listTools）应能看到 5 个 `wechat_mp_*` 工具；或直接让用户确认面板出现（面板「美术资产」区应列出 39 个资产）。

> 若重复自举（插件已存在，如旧会话遗留的 wxmp-1），用 kind: existing + 原 pluginId（wxmp-1）追加 Package 后 update，不要另建新插件。
> 新窗口恢复：动态插件随进程重启消失，本 skill 常驻 preset——新会话中 `wechat_mp_*` 工具不可用时即按上述步骤重新自举；配色/排版知识一律从 `knowledge/` 读取（00-GUIDE 路由）。重启后 art:// 缓存（进程内 state）清空，需在面板重新「渲染并上传」资产（微信返回的图片 URL 永久有效，仅需重建缓存）。
> 开发端：修改与验证源码的完整闭环见 `dev/DEV.md`（改 SKILL.md → dev/scripts 脚本验证 → 重新 define/update 激活 → PROGRESS 文档同步；脚本路径自适应、产物统一入 dev/artifacts）。

## 间距硬规范（v5，所有排版必须遵守）

块间距 16px · 行高 1.75 · 气泡内边距 14px 16px（纯色气泡 16px 18px 14px）· 标题上 28px 下 12px · 分割线 24px · 图片上下 12px · 卡片内文 14px 16px 12px · 内容与边框 ≥12px。转换器已内置，粘贴模板时自行遵守。

## 使用说明

### 五个模型工具

| 工具 | 输入要点 | 返回要点 |
|---|---|---|
| `wechat_mp_compose` | title, markdown（必填）；mode（auto/text/promo，默认 auto）；author/digest/content_source_url/评论开关 可选 | ok, mode, modeLabel, html（微信合法内联样式 HTML）, chars, imageCount, warnings |
| `wechat_mp_draft` | 同 compose + appid/secret（必填）+ cover_path（封面本地路径，可选） | ok, media_id（草稿 id）, thumb_media_id, mode, note |
| `wechat_mp_publish` | appid/secret + media_id + wait_seconds（默认 60，最大 120） | ok, publish_id, publish_status, statusText, article_url |
| `wechat_mp_status` | appid/secret + publish_id | publish_status（0 成功/1 发布中/2 原创失败/3 常规失败/4 审核不通过/5 用户删除/6 系统封禁）, article_url |
| `wechat_mp_art` | appid/secret + name + png_base64（PNG 的 base64，不含 data: 前缀） | ok, name, url（微信永久图片地址，缓存供 art:// 引用） |

### 排版设计系统（v2）——写正文时的排版语法

**模式选择**：`mode: auto` 自动检测（正文含 `::: card/steps`、`> [!...]`、`[[banner/[[badge`、`art://`、`~~~` 任意一种即宣传类，否则文字类）；`text` 强制文字类；`promo` 强制宣传类。

| 语法 | 效果 | 文字类 | 宣传类 |
|---|---|---|---|
| `> [!NOTE] 标题` + `> 正文行…` | 提示气泡框 | 左竖条 + 浅底 | 浅底卡片 |
| `> [!TIP]` / `[!WARN]` / `[!DANGER]` / `[!KEY]` | 技巧/注意/警示/重点气泡 | 绿/琥珀/红/蓝左条 | KEY/TIP/DANGER 纯色气泡 |
| `> [!KEY\|grass]` 等 | 气泡右下角图案角饰（grass 小草 / blossom 花枝 / leaf 叶片） | 同左（图案可选） | 同左（图案可选） |
| `::: card 标题` … `:::` | 卡片容器 | 细边框 + 灰标题栏 | 白卡 + 顶部纯色条 |
| `::: steps` + `- 条目…` + `:::` | 编号步骤 | 蓝色数字圆 | 纯色数字圆 |
| `---` | 分割线 | 浅灰细线 | 橙红细线 |
| `***` | 分割线 | 居中 `· · ·` | 橙/琥珀/青三彩点 |
| `___` | 分割线 | 蓝色细条 | 双头细线 + 菱形 |
| `~~~` | 分割线 | 同 `---` | 三层纯色丝带 |
| `[[badge:文本]]` | 行内徽章 | 蓝底圆角小签 | 橙纯色胶囊 |
| `[[banner:主标题\|副标题]]` | 整行横幅 | 居中标题 + 下划线 | 纯色横幅 + 图案点缀 |
| `==文字==` | 荧光笔高亮 | 淡黄底 | 琥珀底 |
| `![说明](art://名称)` | 美术资产图片 | 需先在面板「渲染并上传」 | 同左 |
| `![说明](本地路径)` | 本地图片 | 草稿通道自动上传 | 同左 |
| `[[title:文字]]` | 装饰标题（居中+两侧线+菱形） | 灰线蓝菱 | 纯色线橙菱 |
| `::: cols` + `- 项…` + `:::` | 分栏卡片（2 项 50% / 3 项 33.3%） | 浅底细边框 | 白卡+纯色顶条 |
| `::: imgrow` + `- ![说明](图)` + `:::` | 多图并排（2-3 张） | 同左 | 同左 |
| `::: imgcard` + `- ![图](路径)` + `- 说明…` + `:::` | 图卡（图+底部说明条） | 白卡+浅底注 | 白卡+浅底注 |
| `::: timeline` + `- 节点…` + `:::` | 时间线（竖线+圆点节点） | 蓝线蓝点 | 橙线纯色点 |
| `::: band` + `- 文字…` + `:::` | 花纹色带（纯色几何装饰，`::: band 斜纹/波点/棋盘/条纹/圆环` 选装饰形状） | 蓝系纯色装饰 | 橙系纯色装饰 |
| `::: frame` + `- 内容…` + `:::` | 复杂边框容器（双线/角块） | 蓝双线+角块 | 纯色双层边框 |
| `[[lace]]` | 花边分隔线（纯 CSS 线+菱形，无字符图标） | 灰 | 橙 |
| `[[title:文字\|box]]` / `\|vine` | 标题风格：box 纯色边框（宣传）/实线框（文字）、vine 藤蔓花枝图案边框（art://vine-frame） | 实线框/藤蔓 | 纯色框/藤蔓 |
| 配色来源 | **无内置主题**：排版语法模块用基础色渲染骨架，风格化配色必须由调用方从知识库风格条目（如校园风/国潮/日系色板）读取，以**内联样式或模板 HTML** 显式落地 | 同左 | 同左 |
| 正文容器 | 左右页边距 16px（v7） | 同左 | 同左 |

**设计原则（创作时遵循）**：
- **平面化（v10 铁律）**：全文**禁止渐变**（linear-gradient）、**禁止阴影**（box-shadow）、**禁止 emoji 与图标字符**（✅⚠️🔥💡❀✦▸➤★☆ 等一律不得出现在正文）；需要装饰时用纯色块、细边框、几何形状（圆点/菱形/方块）或 **art:// 植物图案资产**（小草 sprig-grass、藤蔓花框 vine-frame、花枝 blossom-branch、叶角 leaf-corner）。
- 文字类：重内容、轻装饰——最多 1 个强调色（#2f6fed），标题左竖条，引用浅底，留白充足；正文 16px、行高 1.75、段距 16px。
- 宣传类：素材美观但**不凌乱**——全篇主色 ≤3（低饱和：陶土橙 #c96f4a / 雾青 #5f8d8a / 墨 #2f3640），纯色填充、无阴影、无渐变；每个版块用同一套圆角（12-14px）与留白节奏；图案装饰仅出现在气泡角落/标题边框，不铺满。
- 标题层级：宣传类 h2 自动编号（纯色序号块），h1 下划线，h3 左条；文字类 h1/h2 蓝色左竖条。
- 正文硬规则不变：<20000 字符、图片必须走 uploadimg、摘要 ≤120 字。

### 美术资产（Client 面板「渲染并上传」）

内置 39 个 SVG 美术资产（两级：v10/v10.1 纯色平面线条图案 25 个 + v10.3 复杂插画 14 个——场景横幅/植物插画/复杂边框/印章徽章/花饰分隔/卷草角饰，SVG 内可用渐变与明暗分层；资产经 canvas 渲染为 PNG 图片上传，渐变在图片内合法，正文 CSS 平面化铁律不受影响），面板一键「渲染并上传」→ 客户端 canvas 渲染 PNG（2x）→ `wechat_mp_art` 上传微信 → 得到永久 URL 并缓存 → 正文用 `![装饰](art://名称)` 引用，或用于气泡/标题的 `|grass` `|vine` 等装饰参数；compose/draft/export 时自动替换；未上传的引用会被移除并产生警告。

| 名称 | 用途 | 尺寸 |
|---|---|---|
| `sprig-grass` | 小草角饰（气泡右下角图案，绿色系） | 300×300 |
| `vine-frame` | 开花藤蔓编织边框（标题边框/整幅花框） | 750×300 |
| `blossom-branch` | 花枝（分隔/点缀，橙或粉花朵+绿枝） | 400×220 |
| `leaf-corner` | 叶角（气泡/卡片角落叶饰，雾青色） | 300×300 |
| `vine-divider` | 藤蔓花边分割线（两端花枝+中部留白） | 750×140 |
| `flower-band` | 花朵纹色带（重复小花+枝叶，低饱和） | 750×160 |
| `bird-line` | 飞鸟细线（点缀分割线，单色剪影） | 750×110 |
| `paper-frame` | 纸感描边框（四角圆角细线框，纯色） | 750×320 |
| `sunrise-arc` | 日出半圆（首屏/节庆装饰，橙黄） | 750×240 |
| `mount-line` | 山峦细线（自然/户外/旅行题材） | 750×200 |
| `leaf-wreath` | 叶环花环（节庆/纪念整幅装饰） | 750×300 |
| `branch-line` | 枝叶分割线（章节切换） | 750×130 |
| `bubble-flower` | 花团气泡（宣传焦点装饰图） | 300×300 |
| `ribbon-sash` | 丝带横幅（活动/促销标题底） | 750×220 |
| `frame-round` | 圆角粗框（内容框/证件照式框） | 750×320 |
| `cloud-line` | 云朵分隔（清新/天空题材） | 750×130 |
| `wavy-line` | 波浪细线（海/水/律动题材） | 750×100 |
| `sprig-bamboo` | 竹枝（国潮/文人/节气） | 300×300 |
| `flower-tiny` | 小花簇（柔和点缀） | 300×240 |
| `butterfly` | 蝴蝶（自然/春日点缀） | 300×240 |
| `sun-flower` | 向日葵（明快/活力） | 300×300 |
| `tulip` | 郁金香（春日/花艺） | 300×300 |
| `grass-field` | 草丛底纹（绿色氛围带） | 750×180 |
| `dot-band` | 圆点底纹带（双色错位圆点，低饱和） | 750×120 |
| `star-shine` | 星点闪烁（夜空/愿望/节庆） | 750×120 |

### 面板（Client）

cordis_run 卡片内的「微信公众号推文工具」：凭据（AppID/AppSecret）+ 标题/作者/摘要/封面路径/原文链接/评论开关 + **文章类型选择（自动/文字类/宣传类）** + 正文 Markdown 输入 + 按钮（生成预览 / 导出 HTML 文件 / 写入草稿箱 / 发布）+ **美术资产区**（9 资产渲染并上传）。预览为 iframe srcDoc 渲染。

### 关键事实（来自调研报告 research-wechat-mp-article.md，违反即失败）

- 正文 HTML：<20000 字符、<1MB；图片 src 必须来自 `uploadimg`（仅 jpg/png ≤1MB），外部图片 URL 被微信过滤。
- 封面必须为永久素材 media_id（add_material type=image，≤10MB，jpg/png/gif/bmp）。
- 摘要 ≤120 字；不填微信默认取正文前 54 字（尽量手填）。
- 发布是异步任务（PUBLISHJOBFINISH 事件）；插件内置轮询（3s×wait_seconds）。
- 权限：draft/add 公众号+服务号均可；freepublish/submit、sendall 仅认证账号；群发有管理员确认流程（错误码 89505）。
- 凭据：公众号后台「设置与开发 → 基本配置」的 AppID/AppSecret，需启用开发者模式并配置 IP 白名单。
- **SVG 策略**：微信对正文内联 SVG 无官方承诺、编辑器粘贴会丢样式，因此 SVG 一律客户端渲染为 PNG 后经 uploadimg 以图片插入；正文只产出内联样式 HTML（无 `<style>`/`<script>`/`<svg>` 标签）。
- **POST 注意**：所有 POST 接口（draft/add、freepublish/submit）经 curl stdin 发送 JSON body（pkg-2 曾漏传，pkg-4 已修复）。

### 常见微信错误码

40001 无效 access_token（重新获取/检查凭据）；40013 无效 appid；48001 接口未授权（账号类型/认证不足）；53503 草稿未通过发布检查；53504 需前往公众平台官网使用草稿；40009 图片太大。

## 自举后建议

- 提示用户：最终发布动作在 mp.weixin.qq.com 后台完成（秀米式工具也只写入草稿箱），插件返回的 article_url 才是永久链接。
- 若用户只有未认证订阅号：走「导出 HTML 文件」+ 后台 Ctrl+V 粘贴路径，勿调用发布接口。
- 生成正文时按文章类型选择排版语法：资讯/干货/随笔 → 文字类（> [!TIP] 气泡、::: steps、---）；活动/促销/推广 → 宣传类（> [!KEY] 纯色气泡、[[banner]]、[[badge]]、~~~ 丝带、植物图案资产）。

## Host 源码（已验证 pkg-8，勿随意改动）

````js
return {
  inject: ['timer'],
  apply(ctx) {
    const state = {
      token: null,
      tokenAt: 0,
      creds: { appid: '', secret: '' },
      artUrls: {},
    }

    const sleep = (ms) => ctx.timer.timeout(ms)

    // ---------- shell / network ----------
    async function shellRun(command, opts = {}) {
      const shell = ctx.get('shell')
      if (shell === undefined) throw new Error('shell 服务不可用：无法调用微信接口')
      let policy
      const sp = ctx.get('sandboxPolicy')
      if (sp !== undefined) {
        try { policy = sp.resolve({}) } catch (_) { policy = undefined }
      }
      const spec = shell.resolve({
        command,
        timeoutMs: opts.timeoutMs || 30000,
        stdoutMaxBytes: opts.stdoutMaxBytes || 2 * 1024 * 1024,
        sandboxPolicy: policy,
        ...(opts.stdin !== undefined ? { stdin: opts.stdin } : {}),
      })
      const res = await shell.run(spec)
      const stdout = res.stdout && res.stdout.text ? res.stdout.text : ''
      const stderr = res.stderr && res.stderr.text ? res.stderr.text : ''
      if (res.exitCode !== 0) {
        throw new Error('命令执行失败（exit ' + res.exitCode + '）：' + stderr.slice(0, 400))
      }
      return stdout
    }

    // pwsh 单引号安全包裹：仅含安全字符的参数不包，其余用单引号并双写内部单引号
    function q(arg) {
      const s = String(arg)
      if (/^[A-Za-z0-9_\-./:=@]+$/.test(s)) return s
      return "'" + s.replace(/'/g, "''") + "'"
    }

    async function getToken(appid, secret) {
      if (state.token && Date.now() - state.tokenAt < 7000 * 1000) return state.token
      const url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' +
        encodeURIComponent(appid) + '&secret=' + encodeURIComponent(secret)
      const out = await shellRun('curl.exe -sS ' + q(url))
      let j
      try { j = JSON.parse(out) } catch (_) { throw new Error('获取 access_token 失败（非 JSON 响应）：' + out.slice(0, 200)) }
      if (!j.access_token) throw new Error('获取 access_token 失败：' + (j.errmsg || out.slice(0, 200)))
      state.token = j.access_token
      state.tokenAt = Date.now()
      return state.token
    }

    async function wxJson(method, path, opts = {}) {
      const token = opts.token || (await getToken(opts.appid, opts.secret))
      const sep = path.indexOf('?') >= 0 ? '&' : '?'
      const url = 'https://api.weixin.qq.com' + path + sep + 'access_token=' + encodeURIComponent(token) +
        (opts.query ? '&' + opts.query : '')
      let cmd
      let stdin
      if (method === 'POST') {
        cmd = 'curl.exe -sS -X POST -H ' + q('Content-Type: application/json') + ' --data-binary @- ' + q(url)
        stdin = opts.body === undefined ? '' : opts.body
      } else {
        cmd = 'curl.exe -sS ' + q(url)
      }
      const out = await shellRun(cmd, { ...opts, stdin })
      let j
      try { j = JSON.parse(out) } catch (_) { throw new Error('微信接口响应非 JSON：' + out.slice(0, 300)) }
      if (j && typeof j.errcode === 'number' && j.errcode !== 0) {
        throw new Error('微信接口错误 ' + j.errcode + '：' + (j.errmsg || ''))
      }
      return j
    }

    async function checkImage(path, maxBytes, label) {
      const fs = ctx.get('fs')
      if (fs === undefined) return
      const target = await fs.resolve(path)
      const info = await fs.stat(target)
      if (!info || info.type !== 'file') throw new Error(label + '文件不存在或不可读：' + path)
      if (typeof info.size === 'number' && info.size > maxBytes) {
        throw new Error(label + '超过大小限制（' + maxBytes + ' 字节，实际 ' + info.size + '）：' + path)
      }
    }

    async function uploadBodyImage(path, token) {
      const ext = (path.split('.').pop() || '').toLowerCase()
      if (ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png') {
        throw new Error('正文插图仅支持 jpg/png（当前 .' + ext + '）：' + path)
      }
      await checkImage(path, 1024 * 1024, '正文插图')
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      const cmd = 'curl.exe -sS -F ' + q('media=@' + path + ';type=' + mime) + ' ' +
        q('https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=' + token)
      const out = await shellRun(cmd)
      let j
      try { j = JSON.parse(out) } catch (_) { throw new Error('上传图片失败（非 JSON）：' + out.slice(0, 200)) }
      if (!j.url) throw new Error('上传图片失败：' + (j.errmsg || out.slice(0, 200)))
      return j.url
    }

    async function uploadCover(path, token) {
      const ext = (path.split('.').pop() || '').toLowerCase()
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].indexOf(ext) < 0) {
        throw new Error('封面图格式不支持：.' + ext + '（支持 jpg/png/gif/bmp）')
      }
      await checkImage(path, 10 * 1024 * 1024, '封面图')
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : 'image/jpeg'
      const cmd = 'curl.exe -sS -F ' + q('media=@' + path + ';type=' + mime) + ' ' +
        q('https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=' + token + '&type=image')
      const out = await shellRun(cmd)
      let j
      try { j = JSON.parse(out) } catch (_) { throw new Error('上传封面失败（非 JSON）：' + out.slice(0, 200)) }
      if (!j.media_id) throw new Error('上传封面失败：' + (j.errmsg || out.slice(0, 200)))
      return j.media_id
    }

    // ---------- 设计系统 v2 ----------
    // ---------- 间距硬规范（v5）：全部块统一——段距/块距 16px、行高 1.75、气泡内边距 14px 16px（纯色气泡 16px 18px 14px）、标题上 28px 下 12px、分割线 24px、卡片内文 14px 16px 12px、图片上下 12px、引用 12px 16px ----------
    const FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

    const DESIGNS = {
      text: {
        key: 'text', label: '文字类',
        accent: '#2f6fed', accentDark: '#1f4fc4',
        heading: '#1f2d3d', text: '#3f3f3f', sub: '#8a94a6',
        bg: '#ffffff', soft: '#eef3fb', soft2: '#f7f9fc', border: '#e3e8ef',
        tip: '#0e9f6e', tipBg: '#ecfaf3', warn: '#b26a00', warnBg: '#fff7e6',
        danger: '#c0392b', dangerBg: '#fdeeee', gold: '#b08d3e',
        hl: '#fff3c4', codeBg: '#f6f8fa', codeText: '#24292e',
      },
      promo: {
        key: 'promo', label: '宣传类',
        // v10 平面化色板：低饱和陶土橙/雾青/墨，去高饱和撞色；全部纯色，无渐变无阴影
        deep: '#2f3640', purple: '#5f8d8a', pink: '#b08d8d',
        orange: '#c96f4a', amber: '#d9a35f', teal: '#5f8d8a',
        ink: '#2f3640', text: '#4a4a52', sub: '#94949e',
        bg: '#ffffff', soft: '#f7f3ee', border: '#e5ddd3',
        tip: '#3d8f74', tipBg: '#eef7f2', warn: '#a06a2c', warnBg: '#faf4e8',
        danger: '#b3453c', dangerBg: '#f9efed',
        hl: '#f2e3c2', codeBg: '#2f3640', codeText: '#f2ede6',
      },
    }

    function rgba(hex, a) {
      const h = String(hex || '').replace('#', '')
      if (h.length !== 6) return hex
      const n = parseInt(h, 16)
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
    }

    // ---------- 风格配色策略（v9）：不提供内置主题参数，配色一律由调用方从知识库风格条目读取色板后以内联样式/模板落地 ----------
    // 内置 DESIGNS.text/promo 仅作为排版语法模块的基础色（模块骨架色），不代表风格；风格化配色必须在 markdown 中显式给出。


    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    function inline(s, d) {
      let t = String(s)
      t = t.replace(/==([^=]+)==/g, '<span style="background:' + d.hl + ';padding:0 2px;border-radius:2px">$1</span>')
      t = t.replace(/`([^`]+)`/g, function (_, c) {
        return '<span style="background-color:' + d.codeBg + ';border-radius:3px;padding:1px 5px;font-family:Consolas,Menlo,monospace;font-size:14px;color:' + d.accent + '">' + c + '</span>'
      })
      t = t.replace(/\[\[badge:([^\]]+)\]\]/g, function (_, text) {
        if (d.key === 'promo') {
          return '<span style="display:inline-block;background:' + d.orange + ';color:#ffffff;border-radius:20px;padding:2px 12px;font-size:13px;font-weight:700;margin:0 2px">' + text + '</span>'
        }
        return '<span style="display:inline-block;background:' + d.soft + ';color:' + d.accentDark + ';border-radius:4px;padding:2px 9px;font-size:13px;font-weight:600;margin:0 2px">' + text + '</span>'
      })
      t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, alt, src) {
        // v10.2：art:// 装饰图统一居中收窄（≤56% 宽、小尺寸），本地/外链内容图保持全宽
        if (/^art:\/\//.test(src)) {
          return '<img src="' + src + '" alt="' + alt + '" style="max-width:56%;height:auto;display:inline-block;vertical-align:middle;border-radius:0;margin:12px auto" />'
        }
        return '<img src="' + src + '" alt="' + alt + '" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />'
      })
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, text, url) {
        return '<a href="' + url + '" style="color:' + d.accent + ';text-decoration:none">' + text + '</a>'
      })
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      return t
    }

    function P(d, extra) {
      return '<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:' + d.text + ';word-break:break-word;letter-spacing:0.5px' + (extra || '') + '">'
    }

    // v10.1：宣传类普通段落也进"文字卡片"容器（消除裸文字），文字类保持裸段落（重内容轻装饰）
    function paraBlock(d, innerHtml) {
      if (d.key === 'promo') {
        return '<section style="margin:0 0 16px;background:' + d.soft + ';border:1px solid ' + d.border + ';border-radius:12px;padding:14px 16px;font-size:16px;line-height:1.75;color:' + d.text + ';word-break:break-word;letter-spacing:0.5px">' + innerHtml + '</section>'
      }
      return P(d) + innerHtml + '</p>'
    }

    // ---------- v6 高级模板（调研知识落地：装饰标题/分栏/多图行/图卡） ----------
    // ---------- v7 复杂结构与花纹（时间线/花纹色带/花边/标题风格） ----------
    // ---------- v10 平面化：全部纯色，无渐变/阴影/emoji/图标字符；图案走 art:// 植物资产 ----------
    function timelineBlock(d, items) {
      return '<section style="margin:0 0 16px;padding-left:22px;border-left:2px solid ' + (d.key === 'promo' ? d.orange : d.accent) + '">' + items.map(function (it, idx) {
        return '<section style="position:relative;margin:0 0 14px;background:' + (d.key === 'promo' ? d.soft : d.soft2) + ';border-radius:10px;padding:12px 14px">' +
          '<span style="position:absolute;left:-27px;top:15px;width:10px;height:10px;border-radius:50%;background:' + (d.key === 'promo' ? d.orange : d.accent) + '"></span>' +
          '<span style="display:inline-block;color:' + (d.key === 'promo' ? d.orange : d.accent) + ';font-size:13px;font-weight:700;margin-bottom:4px">' + (idx + 1) + '</span>' +
          '<p style="margin:0;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</p></section>'
      }).join('') + '</section>'
    }


    function laceDivider(d) {
      const c = d.key === 'promo' ? d.orange : '#c3ccd8'
      return '<section style="display:flex;align-items:center;margin:24px 0">' +
        '<span style="flex:1;height:1px;background:' + c + ';opacity:.5"></span>' +
        '<span style="display:inline-block;width:7px;height:7px;background:' + c + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
        '<span style="flex:1;height:1px;background:' + c + ';opacity:.5"></span></section>'
    }

    function titleBlockStyled(d, text, style, artUrls) {
      const h = escapeHtml(text)
      if (style === 'box') {
        if (d.key === 'promo') {
          return '<section style="margin:28px 0 16px;padding:2px;border:2px solid ' + d.orange + ';border-radius:14px;text-align:center"><section style="background:#ffffff;border-radius:12px;padding:12px 22px"><span style="font-size:20px;font-weight:700;color:' + d.ink + ';letter-spacing:2px">' + h + '</span></section></section>'
        }
        return '<section style="margin:28px 0 16px;text-align:center;padding:12px 22px;border:2px solid ' + d.accent + ';border-radius:12px;background:' + d.soft2 + '"><span style="font-size:20px;font-weight:700;color:' + d.heading + ';letter-spacing:2px">' + h + '</span></section>'
      }
      if (style === 'vine') {
        // v10.2：藤蔓编织边框改为「标题上下各一条 vine-divider 花边」（窄、不高），不再用整幅 vine-frame 背景图
        const c = d.key === 'promo' ? d.orange : '#2f6fed'
        if (artUrls && artUrls['vine-divider']) {
          const vd = artUrls['vine-divider']
          return '<section style="margin:28px 0 16px;text-align:center">' +
            '<img src="' + vd + '" alt="" style="width:46%;height:auto;display:block;margin:0 auto 4px" />' +
            '<span style="display:inline-block;font-size:20px;font-weight:700;color:' + (d.key === 'promo' ? d.ink : d.heading) + ';letter-spacing:2px">' + h + '</span>' +
            '<img src="' + vd + '" alt="" style="width:46%;height:auto;display:block;margin:4px auto 0" /></section>'
        }
        return '<section style="margin:28px 0 16px;text-align:center"><span style="display:inline-block;width:8px;height:8px;background:' + c + ';transform:rotate(45deg);margin:0 8px;border-radius:1px"></span>' +
          '<span style="display:inline-block;height:2px;width:56px;background:' + c + ';vertical-align:4px"></span>' +
          '<span style="font-size:20px;font-weight:700;color:' + (d.key === 'promo' ? d.ink : d.heading) + ';letter-spacing:2px;margin:0 6px">' + h + '</span>' +
          '<span style="display:inline-block;height:2px;width:56px;background:' + c + ';vertical-align:4px"></span>' +
          '<span style="display:inline-block;width:8px;height:8px;background:' + c + ';transform:rotate(45deg);margin:0 8px;border-radius:1px"></span></section>'
      }
      return titleBlock(d, text)
    }

    function titleBlock(d, text) {
      const h = escapeHtml(text)
      if (d.key === 'promo') {
        return '<section style="margin:28px 0 16px;display:flex;align-items:center;justify-content:center">' +
          '<span style="flex:0 0 52px;height:2px;background:' + d.border + '"></span>' +
          '<span style="display:inline-block;width:8px;height:8px;background:' + d.orange + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
          '<span style="font-size:20px;font-weight:700;color:' + d.ink + ';letter-spacing:2px">' + h + '</span>' +
          '<span style="display:inline-block;width:8px;height:8px;background:' + d.orange + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
          '<span style="flex:0 0 52px;height:2px;background:' + d.border + '"></span></section>'
      }
      return '<section style="margin:28px 0 16px;display:flex;align-items:center;justify-content:center">' +
        '<span style="flex:0 0 52px;height:2px;background:#e3e8ef"></span>' +
        '<span style="display:inline-block;width:8px;height:8px;background:#2f6fed;transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
        '<span style="font-size:20px;font-weight:700;color:' + d.heading + ';letter-spacing:2px">' + h + '</span>' +
        '<span style="display:inline-block;width:8px;height:8px;background:#2f6fed;transform:rotate(45deg);margin:0 10px;border-radius:1px"></span>' +
        '<span style="flex:0 0 52px;height:2px;background:#e3e8ef"></span></section>'
    }

    function colsBlock(d, items) {
      const n = items.length
      const pct = n >= 3 ? '33.3%' : '50%'
      return '<section style="margin:0 0 16px;display:flex;align-items:stretch">' + items.map(function (it, idx) {
        const mr = idx === n - 1 ? '' : 'margin-right:12px;'
        if (d.key === 'promo') {
          return '<section style="flex:1;width:' + pct + ';' + mr + 'background:#ffffff;border:1px solid ' + d.border + ';border-radius:12px;overflow:hidden">' +
            '<section style="height:5px;background:' + d.orange + '"></section>' +
            '<section style="padding:12px 14px 10px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</section></section>'
        }
        return '<section style="flex:1;width:' + pct + ';' + mr + 'background:' + d.soft2 + ';border:1px solid ' + d.border + ';border-radius:10px;padding:12px 14px 10px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</section>'
      }).join('') + '</section>'
    }

    function imgrowBlock(d, items) {
      const n = items.length
      const pct = n >= 3 ? '33.3%' : '50%'
      return '<section style="margin:0 0 16px;display:flex;align-items:flex-start">' + items.map(function (it, idx) {
        const mr = idx === n - 1 ? '' : 'margin-right:8px;'
        return '<img src="' + it.src + '" alt="' + it.alt + '" style="width:' + pct + ';max-width:100%;border-radius:8px;' + mr + 'display:block" />'
      }).join('') + '</section>'
    }

    function imgcardBlock(d, img, captions) {
      const cap = captions.map((l) => escapeHtml(l)).join('<br/>')
      return '<section style="margin:0 0 16px;background:#ffffff;border:1px solid ' + d.border + ';border-radius:12px;overflow:hidden">' +
        '<img src="' + img.src + '" alt="' + img.alt + '" style="width:100%;max-width:100%;display:block" />' +
        (cap ? '<section style="padding:8px 12px;font-size:13px;line-height:1.5;color:' + d.sub + ';background:' + d.soft2 + '">' + cap + '</section>' : '') +
        '</section>'
    }

    // v10 气泡：纯色底、无渐变、无 emoji 图标、无装饰圆；图案角饰走 art:// 资产（`> [!KEY|grass]`）
    // 气泡角饰用小尺寸图案：grass 小草 / blossom 花枝 / leaf 叶角；vine 是整幅花框，用于 [[title:...|vine]]
    const DECO_MAP = { grass: 'sprig-grass', blossom: 'blossom-branch', leaf: 'leaf-corner' }
    function bubble(d, kind, title, body, decoName, artUrls) {
      const meta = {
        note: { label: '提示', c: d.accent, bg: d.soft, bd: d.border },
        tip: { label: '技巧', c: d.tip, bg: d.tipBg, bd: d.tipBg },
        warn: { label: '注意', c: d.warn, bg: d.warnBg, bd: d.warnBg },
        danger: { label: '警示', c: d.danger, bg: d.dangerBg, bd: d.dangerBg },
        key: { label: '重点', c: d.accentDark, bg: d.soft, bd: d.soft },
      }[kind] || { label: '提示', c: d.accent, bg: d.soft, bd: d.border }
      const ttl = title || meta.label
      const bodyHtml = body.length ? body.map((l) => inline(l, d)).join('<br/>') : null
      const vivid = d.key === 'promo' && (kind === 'key' || kind === 'tip' || kind === 'danger')
      const bodyP = bodyHtml ? '<p style="margin:0;font-size:15px;line-height:1.75;color:' + (vivid ? '#ffffff' : d.text) + '">' + bodyHtml + '</p>' : ''
      const artName = DECO_MAP[decoName] || decoName
      // v10.2：角饰 60px 显示（46px 时 SVG 缩小 6.5 倍线条几乎不可见），位置贴右下角
      const decoImg = artName && artUrls && artUrls[artName]
        ? '<img src="' + artUrls[artName] + '" alt="" style="position:absolute;right:12px;bottom:10px;width:60px;height:auto;pointer-events:none;opacity:.9;display:block" />' : ''
      if (vivid) {
        const bg = kind === 'danger' ? d.danger : kind === 'tip' ? d.tip : d.orange
        return '<section style="margin:0 0 16px;border-radius:14px;padding:16px 18px 14px;background:' + bg + ';position:relative;overflow:hidden">' +
          '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#ffffff">' + ttl + '</p>' +
          bodyP + decoImg + '</section>'
      }
      return '<section style="margin:0 0 16px;background:' + meta.bg + ';border-left:4px solid ' + meta.c + ';border-radius:6px;padding:14px 16px;position:relative">' +
        '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:' + meta.c + '">' + ttl + '</p>' +
        bodyP + decoImg + '</section>'
    }

    function divider(d, kind) {
      if (d.key === 'promo') {
        if (kind === '***') {
          return '<section style="text-align:center;margin:24px 0"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.orange + ';margin:0 4px"></span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.amber + ';margin:0 4px"></span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.teal + ';margin:0 4px"></span></section>'
        }
        if (kind === '___') {
          return '<section style="margin:24px 0;display:flex;align-items:center"><span style="flex:1;height:2px;background:' + d.border + '"></span><span style="display:inline-block;width:8px;height:8px;background:' + d.orange + ';transform:rotate(45deg);margin:0 10px;border-radius:1px"></span><span style="flex:1;height:2px;background:' + d.border + '"></span></section>'
        }
        if (kind === '~~~') {
          return '<section style="margin:24px 0"><section style="height:6px;border-radius:3px;background:' + d.orange + '"></section><section style="height:3px;border-radius:2px;background:' + d.amber + ';margin-top:3px;opacity:.7"></section></section>'
        }
        return '<section style="height:1px;background:' + d.border + ';margin:24px 0"></section>'
      }
      if (kind === '***') {
        return '<section style="text-align:center;margin:24px 0"><span style="display:inline-block;color:#c3ccd8;letter-spacing:8px;font-size:14px">· · ·</span></section>'
      }
      if (kind === '___') {
        return '<section style="height:3px;border-radius:2px;background:#c9d8ef;margin:24px 0"></section>'
      }
      return '<section style="height:1px;background:#e8edf3;margin:24px 0"></section>'
    }

    function heading(d, level, text, counter) {
      const h = escapeHtml(text)
      if (d.key === 'promo') {
        if (level === 1) {
          return '<section style="margin:28px 0 16px;text-align:center"><span style="display:inline-block;font-size:22px;font-weight:800;color:' + d.ink + ';border-bottom:4px solid ' + d.hl + ';padding:0 6px 2px">' + h + '</span></section>'
        }
        if (level === 2) {
          const n = typeof counter === 'number' ? counter : ''
          return '<section style="margin:28px 0 12px;display:flex;align-items:center"><span style="display:inline-block;min-width:26px;height:26px;border-radius:8px 8px 8px 2px;background:' + d.orange + ';color:#ffffff;font-size:15px;font-weight:800;text-align:center;line-height:26px;margin-right:8px">' + n + '</span><span style="font-size:20px;font-weight:700;color:' + d.ink + '">' + h + '</span></section>'
        }
        return '<section style="margin:24px 0 10px;font-size:17px;font-weight:700;color:' + d.purple + ';border-left:4px solid ' + d.orange + ';padding-left:10px">' + h + '</section>'
      }
      const sizes = { 1: 22, 2: 20, 3: 18, 4: 17, 5: 16, 6: 15 }
      const bar = level <= 2 ? 'border-left:4px solid ' + d.accent + ';padding-left:10px;' : ''
      return '<h' + level + ' style="margin:28px 0 12px;font-size:' + sizes[level] + 'px;font-weight:bold;line-height:1.5;color:' + d.heading + ';' + bar + '">' + h + '</h' + level + '>'
    }

    function quoteBlock(d, lines) {
      const body = lines.map((l) => inline(l, d)).join('<br/>')
      if (d.key === 'promo') {
        return '<blockquote style="margin:0 0 16px;background:' + d.soft + ';border-radius:0 10px 10px 0;padding:12px 16px;border-left:5px solid ' + d.orange + ';color:' + d.sub + '">' +
          '<span style="color:' + d.orange + ';font-size:22px;font-family:Georgia,serif;line-height:1">“</span>' + body + '</blockquote>'
      }
      return '<blockquote style="margin:0 0 16px;border-left:4px solid ' + d.accent + ';background:' + d.soft2 + ';border-radius:0 6px 6px 0;padding:12px 16px;color:#5a6472">' + body + '</blockquote>'
    }

    function card(d, title, lines) {
      const body = lines.map((l) => '<p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(l, d) + '</p>').join('')
      if (d.key === 'promo') {
        return '<section style="margin:0 0 16px;background:#ffffff;border:1px solid ' + d.border + ';border-radius:12px;overflow:hidden">' +
          '<section style="height:6px;background:' + d.orange + '"></section>' +
          '<section style="padding:14px 16px 12px"><p style="margin:0 0 8px;font-size:16px;font-weight:700;color:' + d.ink + '">' + inline(escapeHtml(title), d) + '</p>' + body + '</section></section>'
      }
      return '<section style="margin:0 0 16px;border:1px solid ' + d.border + ';border-radius:10px;overflow:hidden">' +
        '<section style="padding:8px 16px;background:' + d.soft2 + ';font-size:15px;font-weight:700;color:' + d.heading + ';border-bottom:1px solid ' + d.border + '">' + inline(escapeHtml(title), d) + '</section>' +
        '<section style="padding:14px 16px 12px">' + body + '</section></section>'
    }

    function steps(d, items) {
      return items.map(function (it, idx) {
        const bg = d.key === 'promo' ? d.orange : d.accent
        return '<section style="margin:0 0 16px;display:flex;align-items:flex-start">' +
          '<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:' + bg + ';color:#ffffff;font-size:14px;font-weight:700;text-align:center;line-height:24px;flex-shrink:0;margin-right:10px">' + (idx + 1) + '</span>' +
          '<span style="font-size:16px;line-height:1.75;color:' + d.text + '">' + inline(it, d) + '</span></section>'
      }).join('')
    }

    function banner(d, title, sub) {
      const t = escapeHtml(title)
      const s = escapeHtml(sub || '')
      if (d.key === 'promo') {
        return '<section style="margin:0 0 16px;border-radius:14px;background:' + d.orange + ';padding:24px 18px;text-align:center">' +
          '<p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:1px">' + t + '</p>' +
          (s ? '<p style="margin:0;font-size:14px;color:rgba(255,255,255,.92)">' + s + '</p>' : '') + '</section>'
      }
      return '<section style="margin:28px 0 16px;text-align:center"><span style="display:inline-block;font-size:20px;font-weight:700;color:' + d.heading + ';border-bottom:2px solid ' + d.accent + ';padding-bottom:4px">' + t + '</span>' +
        (s ? '<p style="margin:6px 0 0;font-size:14px;color:' + d.sub + '">' + s + '</p>' : '') + '</section>'
    }

    function bandBlock(d, items, pattern) {
      const body = items.map((l) => inline(l, d)).join('<br/>')
      const c = d.key === 'promo' ? d.orange : d.accent
      // v10：band 花纹全部用纯色几何 span 拼装（零渐变零阴影），花纹种类只影响装饰形状
      const patMap = { 斜纹: 'diagonal', 波点: 'dots', 棋盘: 'checker', 条纹: 'stripe', 圆环: 'ring' }
      const pat = patMap[pattern] || 'diagonal'
      // 纯色装饰单元：dots=圆点 / checker=方块 / ring=空心圆 / stripe=细条 / diagonal=菱形
      const unitStyle = pat === 'dots' ? 'width:6px;height:6px;border-radius:50%;background:' + rgba(c, 0.35)
        : pat === 'checker' ? 'width:7px;height:7px;border-radius:2px;background:' + rgba(c, 0.28)
        : pat === 'ring' ? 'width:9px;height:9px;border-radius:50%;border:2px solid ' + rgba(c, 0.45) + ';box-sizing:border-box'
        : pat === 'stripe' ? 'width:12px;height:4px;border-radius:2px;background:' + rgba(c, 0.4)
        : 'width:6px;height:6px;background:' + rgba(c, 0.35) + ';transform:rotate(45deg);border-radius:1px'
      let deco = ''
      for (let k = 0; k < 10; k++) {
        deco += '<span style="display:inline-block;margin:0 5px 6px 0;' + unitStyle + '"></span>'
      }
      return '<section style="margin:0 0 16px;border-radius:12px;padding:14px 16px;background:' + rgba(c, 0.06) + ';border:1px solid ' + rgba(c, 0.25) + ';font-size:15px;line-height:1.75;color:' + d.text + '">' +
        '<section style="margin:0 0 8px;line-height:0">' + deco + '</section>' + body + '</section>'
    }

    function frameBlock(d, items) {
      const body = items.map((l) => '<p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:' + d.text + '">' + inline(l, d) + '</p>').join('')
      if (d.key === 'promo') {
        return '<section style="margin:0 0 16px;padding:3px;border:2px solid ' + d.orange + ';border-radius:14px"><section style="background:#ffffff;border:1px solid ' + d.border + ';border-radius:10px;padding:13px 15px">' + body + '</section></section>'
      }
      return '<section style="margin:0 0 16px;border:1px solid ' + d.accent + ';border-radius:12px;padding:13px 15px;position:relative"><span style="position:absolute;top:-1px;left:-1px;width:26px;height:4px;background:' + d.accent + ';border-radius:12px 0 0 0"></span><span style="position:absolute;bottom:-1px;right:-1px;width:26px;height:4px;background:' + d.accent + ';border-radius:0 0 12px 0"></span>' + body + '</section>'
    }

    function listBlock(d, ordered, items) {
      if (d.key === 'promo') {
        const rows = items.map(function (it) {
          return '<section style="margin:0 0 10px;display:flex;align-items:flex-start">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + d.orange + ';margin:9px 10px 0 0;flex-shrink:0"></span>' +
            '<span style="font-size:16px;line-height:1.75;color:' + d.text + '">' + it + '</span></section>'
        }).join('')
        return '<section style="margin:0 0 16px;background:' + d.soft + ';border:1px solid ' + d.border + ';border-radius:12px;padding:12px 16px">' + rows + '</section>'
      }
      const tag = ordered ? 'ol' : 'ul'
      const ls = ordered ? 'decimal' : 'disc'
      return '<' + tag + ' style="margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.75;color:' + d.text + ';list-style:' + ls + '">' +
        items.map(function (it) { return '<li style="margin:4px 0">' + it + '</li>' }).join('') + '</' + tag + '>'
    }

    function tableBlock(d, rows) {
      const cells = function (row) { return row.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim() }) }
      const thStyle = d.key === 'promo'
        ? 'border:1px solid ' + d.border + ';padding:6px 10px;background:' + d.orange + ';color:#ffffff;font-weight:bold;text-align:left'
        : 'border:1px solid #e3e8ef;padding:6px 10px;background:#f7f9fc;font-weight:bold;text-align:left'
      const tdStyle = 'border:1px solid ' + d.border + ';padding:6px 10px'
      let out = '<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:15px;line-height:1.6;color:' + d.text + '">'
      for (let r = 0; r < rows.length; r++) {
        if (r === 1) continue
        const tag = r === 0 ? 'th' : 'td'
        const style = r === 0 ? thStyle : tdStyle
        out += '<tr>'
        for (const c of cells(rows[r])) out += '<' + tag + ' style="' + style + '">' + inline(c, d) + '</' + tag + '>'
        out += '</tr>'
      }
      return out + '</table>'
    }

    function codeBlock(d, code) {
      return '<section style="background:' + d.codeBg + ';border-radius:8px;padding:12px 16px;margin:0 0 16px;overflow-x:auto">' +
        '<p style="margin:0;font-size:14px;line-height:1.6;color:' + d.codeText + ';font-family:Consolas,Menlo,monospace;white-space:pre-wrap">' +
        code.map((l) => escapeHtml(l)).join('<br/>') + '</p></section>'
    }

    function detectMode(md, explicit) {
      if (explicit === 'text' || explicit === 'promo') return explicit
      const s = String(md || '')
      if (/:::\s*(card|steps)/.test(s) || /^>\s*\[!/m.test(s) || /\[\[banner/.test(s) || /\[\[badge/.test(s) || /art:\/\//.test(s) || /^~{3,}$/m.test(s)) return 'promo'
      return 'text'
    }

    function markdownToWechatHtml(md, opts) {
      opts = opts || {}
      const modeKey = detectMode(md, opts.mode)
      // v9：不提供主题参数；排版语法模块使用 DESIGNS[modeKey] 基础色渲染骨架，风格化配色由 markdown 内联样式落地
      const d = DESIGNS[modeKey]
      const artUrls = opts.artUrls || {}
      const warnings = []
      const images = []
      const lines = String(md || '').split(/\r?\n/)
      const out = []
      let i = 0
      let h2Counter = 0

      function collectList() {
        const ordered = /^\s*\d+\.\s+/.test(lines[i])
        const items = []
        while (i < lines.length) {
          const line = lines[i]
          const m = ordered ? line.match(/^\s*\d+\.\s+(.*)$/) : line.match(/^\s*[-*+]\s+(.*)$/)
          if (!m) break
          items.push(inline(escapeHtml(m[1]), d))
          i++
        }
        out.push(listBlock(d, ordered, items))
      }

      function collectTable() {
        const rows = []
        while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
        if (rows.length < 2) { i -= rows.length; return false }
        if (!/^\|?[\s:|-]+\|?$/.test(rows[1].replace(/\s/g, ''))) { i -= rows.length; return false }
        out.push(tableBlock(d, rows))
        warnings.push('检测到表格：微信后台对表格支持有限，建议截图转图片后使用')
        return true
      }

      while (i < lines.length) {
        const raw = lines[i]
        const line = raw.trim()
        if (line === '') { i++; continue }

        // 围栏代码块
        if (line.startsWith('```')) {
          i++
          const code = []
          while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++ }
          i++
          out.push(codeBlock(d, code))
          continue
        }

        // 标题
        const h = line.match(/^(#{1,6})\s+(.*)$/)
        if (h) {
          const level = h[1].length
          if (d.key === 'promo' && level === 2) h2Counter++
          out.push(heading(d, level, h[2], d.key === 'promo' && level === 2 ? h2Counter : null))
          i++
          continue
        }

        // 分割线变体
        const hr = line.match(/^(-{3,}|\*{3,}|_{3,}|~{3,})$/)
        if (hr) {
          out.push(divider(d, hr[1].charAt(0) === '*' ? '***' : hr[1].charAt(0) === '_' ? '___' : hr[1].charAt(0) === '~' ? '~~~' : '---'))
          i++
          continue
        }

        // 横幅 [[banner:主|副]]
        const bn = line.match(/^\[\[banner:([^|\]]+)(?:\|([^\]]+))?\]\]$/)
        if (bn) { out.push(banner(d, bn[1], bn[2] || '')); i++; continue }

        // 装饰标题 [[title:文字]] / [[title:文字|box|vine]]
        const tt = line.match(/^\[\[title:([^\]|]+)(?:\|([a-z]+))?\]\]$/)
        if (tt) { out.push(titleBlockStyled(d, tt[1], tt[2] || '', artUrls)); i++; continue }

        // 花边分隔线 [[lace]]
        if (/^\[\[lace\]\]$/.test(line)) { out.push(laceDivider(d)); i++; continue }

        // 容器 ::: card / ::: steps / ::: cols / ::: imgrow / ::: imgcard / ::: timeline / ::: band / ::: frame
        const cont = line.match(/^:::\s*(card|steps|cols|imgrow|imgcard|timeline|band|frame)\s*(.*)$/)
        if (cont) {
          const kind = cont[1]
          const title = cont[2].trim()
          i++
          const bodyLines = []
          const stepItems = []
          while (i < lines.length && lines[i].trim() !== ':::') {
            const l = lines[i].trim()
            if (kind === 'steps' && /^[-*+]\s+/.test(l)) stepItems.push(l.replace(/^[-*+]\s+/, ''))
            else if (l !== '') bodyLines.push(l)
            i++
          }
          i++ // 跳过 :::
          if (kind === 'steps') {
            out.push(steps(d, stepItems.map((s) => escapeHtml(s))))
          } else if (kind === 'timeline') {
            const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
            if (items.length >= 1) out.push(timelineBlock(d, items))
            else out.push(P(d) + 'timeline 需至少 1 个节点（- 内容）' + '</p>')
          } else if (kind === 'band') {
            const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
            if (items.length >= 1) out.push(bandBlock(d, items, title))
            else out.push(P(d) + 'band 需至少 1 行内容（- 文字）' + '</p>')
          } else if (kind === 'frame') {
            const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
            if (items.length >= 1) out.push(frameBlock(d, items))
            else out.push(P(d) + 'frame 需至少 1 行内容（- 文字）' + '</p>')
          } else if (kind === 'cols') {
            const cols = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => escapeHtml(l.replace(/^[-*+]\s+/, '')))
            if (cols.length >= 2) out.push(colsBlock(d, cols))
            else out.push(P(d) + bodyLines.map((l) => inline(escapeHtml(l.replace(/^[-*+]\s+/, '')), d)).join('<br/>') + '</p>')
          } else if (kind === 'imgrow') {
            const imgs = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => {
              const mm = l.replace(/^[-*+]\s+/, '').match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
              return mm ? { src: mm[2], alt: mm[1] } : null
            }).filter(Boolean)
            if (imgs.length >= 2) out.push(imgrowBlock(d, imgs))
            else out.push(P(d) + 'imgrow 需至少 2 张图片（- ![说明](路径)）' + '</p>')
          } else if (kind === 'imgcard') {
            const items = bodyLines.filter((l) => /^[-*+]\s+/.test(l)).map((l) => l.replace(/^[-*+]\s+/, ''))
            let img = null
            const caps = []
            for (const it of items) {
              const mm = it.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
              if (mm && !img) { img = { src: mm[2], alt: mm[1] }; continue }
              caps.push(it)
            }
            if (img) out.push(imgcardBlock(d, img, caps))
            else out.push(P(d) + 'imgcard 需一张图片（第一项 - ![说明](路径)）' + '</p>')
          } else {
            out.push(card(d, title, bodyLines.map((s) => escapeHtml(s))))
          }
          continue
        }

        // 提示气泡框 > [!KIND|deco] 标题（v10：|grass 等图案角饰）
        const alert = line.match(/^>\s*\[!(\w+)(?:\|([a-z0-9-]+))?\]\s*(.*)$/)
        if (alert) {
          const kind = alert[1].toLowerCase()
          const decoName = alert[2] || ''
          const first = alert[3].trim()
          const body = []
          i++
          while (i < lines.length && lines[i].trim().startsWith('>')) {
            const l = lines[i].trim().replace(/^>\s?/, '')
            if (l !== '') body.push(l)
            i++
          }
          out.push(bubble(d, kind, first, body.map((s) => escapeHtml(s)), decoName, artUrls))
          continue
        }

        // 普通引用
        if (line.startsWith('>')) {
          const quote = []
          while (i < lines.length && lines[i].trim().startsWith('>')) {
            const l = lines[i].trim().replace(/^>\s?/, '')
            if (l !== '') quote.push(l)
            i++
          }
          out.push(quoteBlock(d, quote.map((s) => escapeHtml(s))))
          continue
        }

        // 整行图片：独立渲染，不包进段落卡片（v10.2：art:// 装饰图居中 56%，本地图全宽）
        const imgLine = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
        if (imgLine) {
          const alt = imgLine[1]
          const src = imgLine[2]
          if (/^art:\/\//.test(src)) {
            out.push('<section style="text-align:center;margin:12px 0"><img src="' + src + '" alt="' + alt + '" style="max-width:56%;height:auto;display:inline-block;vertical-align:middle" /></section>')
          } else {
            out.push('<img src="' + src + '" alt="' + alt + '" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />')
          }
          i++
          continue
        }

        // 列表
        if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) { collectList(); continue }

        // 表格
        if (line.startsWith('|')) { if (collectTable()) continue }

        // 普通段落（合并连续行）
        const para = []
        while (i < lines.length) {
          const l = lines[i].trim()
          if (l === '' || /^(#{1,6})\s/.test(l) || /^(-{3,}|\*{3,}|_{3,}|~{3,})$/.test(l) || l.startsWith('```') ||
            l.startsWith('>') || /^\s*[-*+]\s+/.test(l) || /^\s*\d+\.\s+/.test(l) || l.startsWith('|') ||
            /^:::\s*(card|steps|cols|imgrow|imgcard|timeline|band|frame)/.test(l) || l === ':::' || /^(\[\[banner:|\[\[title:)/.test(l)) break
          para.push(inline(escapeHtml(l), d))
          i++
        }
        out.push(paraBlock(d, para.join('<br/>')))
      }

      // 美术资产占位 art:// 替换
      let html = out.join('')
      html = html.replace(/<img([^>]*)src="art:\/\/([a-z0-9-]+)"([^>]*)\/>/g, function (_m, pre, name, post) {
        const url = artUrls[name]
        if (url) {
          return '<img' + pre + 'src="' + url + '"' + post + '/>'
        }
        warnings.push('美术资产 art://' + name + ' 尚未渲染上传，已从正文移除（在面板「美术资产」渲染并上传，或用 wechat_mp_art 工具）')
        return ''
      })

      // 提取本地图片
      const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g
      let m
      while ((m = imgRe.exec(String(md || ''))) !== null) {
        const src = m[2]
        if (!/^(https?:|art:)/i.test(src)) images.push({ local: src, alt: m[1] })
      }

      const wrapperBg = '' // v10：无顶部渐变，正文保持纯白底
      const html2 = '<section style="' + wrapperBg + 'padding:4px 16px;box-sizing:border-box;font-size:16px;line-height:1.75;color:' + d.text + ';font-family:' + FONT + ';letter-spacing:0.5px;word-break:break-word">' + html + '</section>'
      const plainText = html2
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim()
      if (html2.length >= 20000) warnings.push('正文超过 20000 字符限制（当前约 ' + html2.length + '），微信会拒绝保存')
      return { html: html2, plainText, images, warnings, mode: d.key, modeLabel: d.label }
    }

    function buildArticle(meta, html) {
      const article = {
        title: meta.title || '',
        author: meta.author || '',
        digest: meta.digest || '',
        content: html,
        content_source_url: meta.content_source_url || '',
        thumb_media_id: meta.thumb_media_id || '',
        need_open_comment: meta.need_open_comment ? 1 : 0,
        only_fans_can_comment: meta.only_fans_can_comment ? 1 : 0,
      }
      if (meta.thumb_media_id) {
        article.cover_info = {
          crop_percent_list: [
            { ratio: '2.35_1', x1: '0', y1: '0', x2: '1', y2: '1' },
            { ratio: '1_1', x1: '0', y1: '0', x2: '1', y2: '1' },
          ],
        }
      }
      return article
    }

    async function uploadArticleImages(html, images, token) {
      let html2 = html
      const uploaded = {}
      const seen = {}
      for (const img of images) {
        if (seen[img.local]) { html2 = html2.split(img.local).join(uploaded[img.local]); continue }
        seen[img.local] = true
        const url = await uploadBodyImage(img.local, token)
        uploaded[img.local] = url
        html2 = html2.split(img.local).join(url)
      }
      return html2
    }

    function requireCreds(args) {
      const appid = args.appid || state.creds.appid
      const secret = args.secret || state.creds.secret
      if (!appid || !secret) throw new Error('缺少微信公众号凭据：请提供 appid/secret（公众号后台「设置与开发→基本配置」获取）')
      return { appid, secret }
    }

    // ---------- 美术资产：base64 PNG → 临时文件 → uploadimg → 缓存 ----------
    async function renderArt(args) {
      const creds = requireCreds(args)
      const name = String(args.name || '').replace(/[^a-z0-9-]/gi, '').toLowerCase()
      if (!name) throw new Error('美术资产 name 非法')
      const b64 = String(args.png_base64 || '')
      if (!b64) throw new Error('缺少 png_base64 数据')
      const fs = ctx.get('fs')
      if (fs === undefined) throw new Error('fs 服务不可用')
      const token = await getToken(creds.appid, creds.secret)
      const fname = 'wxmp-art-' + name + '.png'
      const target = await fs.resolve(fname)
      const tp = String(target && target.path ? target.path : fname)
      const b64file = tp + '.b64'
      try {
        await fs.writeText(b64file, b64)
        const dec = 'powershell.exe -NoProfile -Command [IO.File]::WriteAllBytes(' + q(tp) + ',[Convert]::FromBase64String([IO.File]::ReadAllText(' + q(b64file) + ')))'
        await shellRun(dec)
        const url = await uploadBodyImage(tp, token)
        state.artUrls[name] = url
        return { ok: true, name, url, note: '已在正文中用 ![说明](art://' + name + ') 引用；compose/draft 时会自动替换为该图片地址' }
      } finally {
        try { await shellRun('powershell.exe -NoProfile -Command Remove-Item ' + q(b64file) + ' -Force') } catch (_) {}
        try { await shellRun('powershell.exe -NoProfile -Command Remove-Item ' + q(tp) + ' -Force') } catch (_) {}
      }
    }

    function toolArgs(extra, required) {
      const base = {
        type: 'object',
        properties: {
          title: { type: 'string', description: '文章标题' },
          markdown: { type: 'string', description: '正文（Markdown + 排版语法）' },
          mode: { type: 'string', enum: ['auto', 'text', 'promo'], description: '排版模式：auto 自动检测（含宣传语法即宣传类）；text 文字类（简洁清晰）；promo 宣传类（生动层次）' },
          author: { type: 'string', description: '作者（可选）' },
          digest: { type: 'string', description: '摘要（可选，≤120 字；留空微信默认取正文前 54 字）' },
          content_source_url: { type: 'string', description: '阅读原文链接（可选）' },
          need_open_comment: { type: 'boolean', description: '是否打开评论（默认 false）' },
          only_fans_can_comment: { type: 'boolean', description: '是否仅粉丝可评论（默认 false）' },
        },
        required: required || ['title', 'markdown'],
      }
      for (const k of Object.keys(extra)) base.properties[k] = extra[k]
      return base
    }

    // ---------- 业务动作 ----------
    async function composeOnly(args) {
      const artUrls = { ...state.artUrls, ...(args.artUrls || {}) } // artUrls 仅供本地预览注入（工具 schema 不含此字段，模型不可用）
      const composed = markdownToWechatHtml(args.markdown || '', { mode: args.mode, artUrls })
      return {
        ok: true,
        title: args.title || '',
        mode: composed.mode,
        modeLabel: composed.modeLabel,
        html: composed.html,
        plainText: composed.plainText.slice(0, 200),
        chars: composed.plainText.length,
        imageCount: composed.images.length,
        warnings: composed.warnings,
      }
    }

    async function createDraft(args) {
      const creds = requireCreds(args)
      const composed = markdownToWechatHtml(args.markdown || '', { mode: args.mode, artUrls: state.artUrls })
      const token = await getToken(creds.appid, creds.secret)
      const html2 = await uploadArticleImages(composed.html, composed.images, token)
      let thumb = ''
      if (args.cover_path) thumb = await uploadCover(args.cover_path, token)
      const article = buildArticle({ ...args, thumb_media_id: thumb }, html2)
      const res = await wxJson('POST', '/cgi-bin/draft/add', {
        token,
        body: JSON.stringify({ articles: [article] }),
      })
      return {
        ok: true,
        media_id: res.media_id,
        title: article.title,
        mode: composed.mode,
        digest: article.digest || '(默认取正文前 54 字)',
        thumb_media_id: thumb || '(未设置封面)',
        imageCount: composed.images.length,
        warnings: composed.warnings,
        note: '草稿已写入公众号草稿箱，可在 mp.weixin.qq.com「草稿箱」查看并最终发布',
      }
    }

    async function submitPublish(args) {
      const creds = requireCreds(args)
      const token = await getToken(creds.appid, creds.secret)
      const res = await wxJson('POST', '/cgi-bin/freepublish/submit', {
        token,
        body: JSON.stringify({ media_id: args.media_id }),
      })
      return { ok: true, publish_id: res.publish_id, note: '发布任务已提交，正在异步处理；可稍后查询状态' }
    }

    async function publishAndWait(args) {
      const creds = requireCreds(args)
      const token = await getToken(creds.appid, creds.secret)
      const res = await wxJson('POST', '/cgi-bin/freepublish/submit', {
        token,
        body: JSON.stringify({ media_id: args.media_id }),
      })
      const publish_id = String(res.publish_id)
      const deadline = Date.now() + Math.min(120000, Math.max(0, (args.wait_seconds || 60)) * 1000)
      let last = null
      while (Date.now() < deadline) {
        await sleep(3000)
        last = await queryStatus({ ...creds, token, publish_id })
        if (last.publish_status !== 1) break
      }
      if (!last) last = await queryStatus({ ...creds, token, publish_id })
      return { ok: true, publish_id, ...last }
    }

    async function queryStatus(args) {
      const creds = requireCreds(args)
      const token = args.token || (await getToken(creds.appid, creds.secret))
      const res = await wxJson('GET', '/cgi-bin/freepublish/get', {
        token,
        query: 'publish_id=' + encodeURIComponent(args.publish_id),
      })
      const map = {
        0: '发布成功',
        1: '发布中',
        2: '原创声明失败',
        3: '常规失败',
        4: '平台审核不通过',
        5: '成功后用户删除所有文章',
        6: '成功后系统封禁所有文章',
      }
      const status = typeof res.publish_status === 'number' ? res.publish_status : 1
      let article_url = ''
      const detail = res.article_detail
      if (detail && detail.item && detail.item.length && detail.item[0].article_url) {
        article_url = detail.item[0].article_url
      }
      return {
        ok: true,
        publish_id: args.publish_id,
        publish_status: status,
        statusText: map[status] || ('未知状态 ' + status),
        article_url,
      }
    }

    async function exportHtml(args) {
      const artUrls = { ...state.artUrls, ...(args.artUrls || {}) } // artUrls 仅供本地预览注入（工具 schema 不含此字段，模型不可用）
      const composed = markdownToWechatHtml(args.markdown || '', { mode: args.mode, artUrls })
      const fs = ctx.get('fs')
      if (fs === undefined) throw new Error('fs 服务不可用')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const name = 'wechat-mp-' + stamp + '.html'
      const doc = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' +
        escapeHtml(args.title || 'wechat-article') + '</title></head><body style="max-width:375px;margin:0 auto;padding:12px;background:#ffffff">' +
        composed.html + '</body></html>'
      const target = await fs.resolve(name)
      await fs.writeText(target, doc)
      return {
        ok: true,
        path: name,
        mode: composed.mode,
        html: composed.html,
        warnings: composed.warnings,
        note: '已导出可粘贴 HTML 文件（微信后台「新建图文」中 Ctrl+V 粘贴；本地图片需手动上传或走草稿箱通道）',
      }
    }

    // ---------- Client RPC ----------
    harness.handle('compose', async (args) => composeOnly(args || {}))
    harness.handle('draft', async (args) => createDraft(args || {}))
    harness.handle('publish', async (args) => publishAndWait(args || {}))
    harness.handle('status', async (args) => queryStatus(args || {}))
    harness.handle('export', async (args) => exportHtml(args || {}))
    harness.handle('render-art', async (args) => renderArt(args || {}))
    harness.handle('art-urls', async () => ({ ok: true, artUrls: state.artUrls }))
    harness.handle('set-creds', async (args) => {
      state.creds.appid = (args && args.appid) || ''
      state.creds.secret = (args && args.secret) || ''
      state.token = null
      return { ok: true, appid: state.creds.appid }
    })
    harness.handle('get-creds', async () => ({ ok: true, appid: state.creds.appid, hasSecret: !!state.creds.secret }))
    harness.handle('ping', async () => ({ ok: true }))

    // ---------- 动态 Tools（必须经 harness.defineTool 包装） ----------
    const tools = [
      {
        name: 'wechat_mp_compose',
        description: '把 Markdown 正文转换为微信公众号合法 HTML（v2 设计系统 + v10 平面化：零渐变/零阴影/零 emoji/零图标字符；文字类简洁/宣传类生动，支持 > [!NOTE|TIP|WARN|DANGER|KEY] 气泡框（可加 |grass|blossom|leaf 图案角饰）、::: card / ::: steps 容器、---/***/___/~~~ 分割线、[[badge:文本]]、[[banner:主|副]]、==高亮==、[[title:文字]] 装饰标题、::: cols 分栏、::: imgrow 多图行、::: imgcard 图卡、::: timeline 时间线、::: band 花纹色带（band 后跟斜纹/波点/棋盘/条纹/圆环）、::: frame 复杂边框、[[lace]] 花边分隔、[[title:文字|box|vine]] 标题风格、![说明](art://名称) 植物图案资产）。不联网。',
        parameters: toolArgs({}, ['title', 'markdown']),
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
          },
        },
        async execute(args) {
          return composeOnly(args || {})
        },
      },
      {
        name: 'wechat_mp_draft',
        description: '生成推文并直连微信：上传正文图片与封面，写入公众号草稿箱。需要 appid/secret（认证公众号开发者凭据）。',
        parameters: toolArgs({
          appid: { type: 'string', description: '公众号 AppID' },
          secret: { type: 'string', description: '公众号 AppSecret' },
          cover_path: { type: 'string', description: '封面图本地路径（jpg/png/gif/bmp ≤10MB，可选）' },
        }, ['title', 'markdown']),
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
          },
        },
        async execute(args) {
          return createDraft(args || {})
        },
      },
      {
        name: 'wechat_mp_publish',
        description: '发布草稿箱中的图文（提交发布任务并等待结果，最长 120 秒），返回永久链接。需要认证公众号。',
        parameters: toolArgs({
          appid: { type: 'string', description: '公众号 AppID' },
          secret: { type: 'string', description: '公众号 AppSecret' },
          media_id: { type: 'string', description: '草稿箱 media_id（来自 wechat_mp_draft 或后台）' },
          wait_seconds: { type: 'number', description: '等待秒数，默认 60，最大 120' },
        }, ['media_id']),
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
          },
        },
        async execute(args) {
          return publishAndWait(args || {})
        },
      },
      {
        name: 'wechat_mp_status',
        description: '查询微信发布任务状态（0 成功/1 发布中/2 原创失败/3 常规失败/4 审核不通过），成功时返回 article_url。',
        parameters: toolArgs({
          appid: { type: 'string', description: '公众号 AppID' },
          secret: { type: 'string', description: '公众号 AppSecret' },
          publish_id: { type: 'string', description: '发布任务 id（来自 wechat_mp_publish）' },
        }, ['publish_id']),
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
          },
        },
        async execute(args) {
          return queryStatus(args || {})
        },
      },
      {
        name: 'wechat_mp_art',
        description: '把客户端渲染的 SVG 美术资产（PNG base64）上传到微信并获得永久图片 URL，缓存供正文 art:// 引用。需要 appid/secret。',
        parameters: toolArgs({
          appid: { type: 'string', description: '公众号 AppID' },
          secret: { type: 'string', description: '公众号 AppSecret' },
          name: { type: 'string', description: '美术资产名（小写字母/数字/中划线，如 sprig-grass）' },
          png_base64: { type: 'string', description: 'PNG 图片的 base64 数据（不含 data: 前缀）' },
        }, ['name', 'png_base64']),
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
          },
        },
        async execute(args) {
          return renderArt(args || {})
        },
      },
    ]
    for (const tool of tools) {
      harness.registerTool(ctx, harness.defineTool(tool))
    }
  },
}
````

## Client 源码（已验证 pkg-8，勿随意改动）

````js
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    // ---------- SVG 美术资产库（v10/v10.1 纯色平面植物图案 25 个 + v10.3 复杂插画 14 个；资产渲染为 PNG 图片，SVG 内渐变明暗合法，正文 CSS 平面化铁律不受影响） ----------
    const ARTS = [
      { name: 'sprig-grass', label: '小草角饰', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><g fill="none" stroke="#4a7c59" stroke-width="11" stroke-linecap="round"><path d="M60 250 Q 90 190 150 180"/><path d="M150 250 Q 165 200 190 175"/><path d="M230 250 Q 225 205 245 185"/><path d="M118 250 Q 120 215 110 195"/></g><g fill="#6f9e78"><ellipse cx="168" cy="196" rx="17" ry="10" transform="rotate(-35 168 196)"/><ellipse cx="128" cy="208" rx="15" ry="9" transform="rotate(25 128 208)"/><ellipse cx="232" cy="206" rx="15" ry="9" transform="rotate(30 232 206)"/></g><circle cx="150" cy="176" r="9" fill="#d9a35f"/></svg>' },
      { name: 'vine-frame', label: '开花藤蔓花框', w: 750, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="300" viewBox="0 0 750 300"><g fill="none" stroke="#4a7c59" stroke-width="7" stroke-linecap="round"><path d="M40 60 Q 120 20 200 60 Q 280 100 360 60"/><path d="M710 60 Q 630 20 550 60 Q 470 100 390 60"/><path d="M40 240 Q 120 280 200 240 Q 280 200 360 240"/><path d="M710 240 Q 630 280 550 240 Q 470 200 390 240"/></g><g fill="#6f9e78"><ellipse cx="120" cy="34" rx="16" ry="9" transform="rotate(-30 120 34)"/><ellipse cx="240" cy="46" rx="14" ry="8" transform="rotate(20 240 46)"/><ellipse cx="630" cy="34" rx="16" ry="9" transform="rotate(30 630 34)"/><ellipse cx="510" cy="46" rx="14" ry="8" transform="rotate(-20 510 46)"/><ellipse cx="120" cy="266" rx="16" ry="9" transform="rotate(30 120 266)"/><ellipse cx="630" cy="266" rx="16" ry="9" transform="rotate(-30 630 266)"/></g><g fill="#c96f4a"><circle cx="300" cy="52" r="10"/><circle cx="450" cy="52" r="10"/><circle cx="300" cy="248" r="10"/><circle cx="450" cy="248" r="10"/></g><g fill="#d9a35f"><circle cx="330" cy="52" r="6"/><circle cx="420" cy="52" r="6"/><circle cx="330" cy="248" r="6"/><circle cx="420" cy="248" r="6"/></g></svg>' },
      { name: 'blossom-branch', label: '花枝', w: 400, h: 220, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><path d="M30 200 Q 140 160 250 110 Q 330 70 370 30" fill="none" stroke="#6b5b4a" stroke-width="6" stroke-linecap="round"/><g fill="#c96f4a"><circle cx="120" cy="168" r="16"/><circle cx="120" cy="168" r="8" fill="#e8b48c"/><circle cx="216" cy="126" r="18"/><circle cx="216" cy="126" r="9" fill="#e8b48c"/><circle cx="310" cy="86" r="20"/><circle cx="310" cy="86" r="10" fill="#e8b48c"/><circle cx="370" cy="30" r="14"/><circle cx="370" cy="30" r="7" fill="#e8b48c"/></g><g fill="#6f9e78"><ellipse cx="180" cy="150" rx="14" ry="8" transform="rotate(-40 180 150)"/><ellipse cx="280" cy="102" rx="14" ry="8" transform="rotate(30 280 102)"/><ellipse cx="345" cy="60" rx="12" ry="7" transform="rotate(-25 345 60)"/></g></svg>' },
      { name: 'leaf-corner', label: '叶角', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><g fill="#5f8d8a"><path d="M40 260 Q 30 190 90 150 Q 120 180 110 230 Q 90 255 40 260 Z"/><path d="M110 200 Q 140 150 180 140 Q 175 175 145 200 Q 130 205 110 200 Z"/><path d="M170 165 Q 205 120 240 118 Q 232 150 202 172 Q 185 178 170 165 Z"/></g><path d="M60 240 Q 70 200 100 180" fill="none" stroke="#3f6b68" stroke-width="8" stroke-linecap="round"/><path d="M140 175 Q 165 155 185 152" fill="none" stroke="#3f6b68" stroke-width="8" stroke-linecap="round"/></svg>' },
      { name: 'vine-divider', label: '藤蔓花边分割线', w: 750, h: 140, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="140" viewBox="0 0 750 140"><path d="M0 70 Q 100 40 200 70 Q 300 100 375 70 Q 450 40 550 70 Q 650 100 750 70" fill="none" stroke="#c96f4a" stroke-width="4" stroke-linecap="round"/><g fill="#6f9e78"><ellipse cx="80" cy="58" rx="12" ry="7" transform="rotate(-35 80 58)"/><ellipse cx="180" cy="84" rx="12" ry="7" transform="rotate(30 180 84)"/><ellipse cx="570" cy="58" rx="12" ry="7" transform="rotate(35 570 58)"/><ellipse cx="670" cy="84" rx="12" ry="7" transform="rotate(-30 670 84)"/></g><g fill="#d9a35f"><circle cx="375" cy="70" r="8"/><circle cx="150" cy="72" r="5"/><circle cx="600" cy="72" r="5"/></g></svg>' },
      { name: 'flower-band', label: '花朵纹色带', w: 750, h: 160, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="160" viewBox="0 0 750 160"><rect width="750" height="160" fill="#f7f3ee"/><g fill="#c96f4a"><circle cx="80" cy="80" r="14"/><circle cx="230" cy="80" r="18"/><circle cx="380" cy="80" r="14"/><circle cx="530" cy="80" r="18"/><circle cx="680" cy="80" r="14"/></g><g fill="#d9a35f"><circle cx="80" cy="80" r="6"/><circle cx="230" cy="80" r="8"/><circle cx="380" cy="80" r="6"/><circle cx="530" cy="80" r="8"/><circle cx="680" cy="80" r="6"/></g><g fill="none" stroke="#6f9e78" stroke-width="4" stroke-linecap="round"><path d="M30 118 Q 155 100 280 118 Q 405 136 530 118 Q 655 100 720 118"/></g><g fill="#6f9e78"><ellipse cx="150" cy="110" rx="10" ry="6" transform="rotate(-30 150 110)"/><ellipse cx="460" cy="110" rx="10" ry="6" transform="rotate(30 460 110)"/></g></svg>' },
      { name: 'bird-line', label: '飞鸟细线', w: 750, h: 110, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="110" viewBox="0 0 750 110"><path d="M120 55 Q 135 38 150 55 Q 165 38 180 55" fill="none" stroke="#5f8d8a" stroke-width="4" stroke-linecap="round"/><path d="M290 40 Q 305 23 320 40 Q 335 23 350 40" fill="none" stroke="#5f8d8a" stroke-width="4" stroke-linecap="round"/><path d="M560 55 Q 575 38 590 55 Q 605 38 620 55" fill="none" stroke="#5f8d8a" stroke-width="4" stroke-linecap="round"/><line x1="60" y1="55" x2="108" y2="55" stroke="#c96f4a" stroke-width="3" stroke-linecap="round"/><line x1="192" y1="55" x2="278" y2="55" stroke="#c96f4a" stroke-width="3" stroke-linecap="round"/><line x1="362" y1="55" x2="548" y2="55" stroke="#c96f4a" stroke-width="3" stroke-linecap="round"/><line x1="632" y1="55" x2="700" y2="55" stroke="#c96f4a" stroke-width="3" stroke-linecap="round"/></svg>' },
      { name: 'paper-frame', label: '纸感描边框', w: 750, h: 320, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="320" viewBox="0 0 750 320"><g fill="none" stroke="#c96f4a" stroke-width="6"><rect x="30" y="30" width="690" height="260" rx="18"/><rect x="48" y="48" width="654" height="224" rx="12" stroke-width="2" stroke="#d9a35f"/></g><g fill="#c96f4a"><circle cx="30" cy="30" r="10"/><circle cx="720" cy="30" r="10"/><circle cx="30" cy="290" r="10"/><circle cx="720" cy="290" r="10"/></g><g fill="#6f9e78"><ellipse cx="375" cy="160" rx="16" ry="9" transform="rotate(-20 375 160)"/><ellipse cx="60" cy="160" rx="10" ry="6" transform="rotate(25 60 160)"/><ellipse cx="690" cy="160" rx="10" ry="6" transform="rotate(-25 690 160)"/></g></svg>' },
      // ---------- v10.1 扩充：更多纯色植物/自然/边框/分隔/纹理资产（全部无渐变无阴影） ----------
      { name: 'sunrise-arc', label: '日出半圆', w: 750, h: 240, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="240" viewBox="0 0 750 240"><g fill="none" stroke="#c96f4a" stroke-width="5" stroke-linecap="round"><path d="M90 190 Q 130 150 170 190"/><path d="M230 190 Q 270 150 310 190"/><path d="M370 190 Q 410 150 450 190"/><path d="M510 190 Q 550 150 590 190"/><path d="M640 190 Q 670 165 700 190"/></g><circle cx="375" cy="110" r="46" fill="#d9a35f"/><path d="M375 150 L 375 176" stroke="#d9a35f" stroke-width="5" stroke-linecap="round"/><path d="M375 64 L 375 42" stroke="#d9a35f" stroke-width="5" stroke-linecap="round"/><path d="M338 92 L 322 78" stroke="#d9a35f" stroke-width="5" stroke-linecap="round"/><path d="M412 92 L 428 78" stroke="#d9a35f" stroke-width="5" stroke-linecap="round"/><path d="M329 128 L 312 140" stroke="#d9a35f" stroke-width="5" stroke-linecap="round"/><path d="M421 128 L 438 140" stroke="#d9a35f" stroke-width="5" stroke-linecap="round"/></svg>' },
      { name: 'mount-line', label: '山峦细线', w: 750, h: 200, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="200" viewBox="0 0 750 200"><g fill="none" stroke="#5f8d8a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M0 170 L 120 90 L 210 150 L 330 60 L 450 150 L 560 100 L 660 150 L 750 120 L 750 200 L 0 200 Z" fill="#eef5f2"/></g><circle cx="560" cy="60" r="20" fill="#d9a35f"/></svg>' },
      { name: 'leaf-wreath', label: '叶环花环', w: 750, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="300" viewBox="0 0 750 300"><g fill="#6f9e78"><ellipse cx="150" cy="120" rx="26" ry="13" transform="rotate(-35 150 120)"/><ellipse cx="210" cy="80" rx="26" ry="13" transform="rotate(20 210 80)"/><ellipse cx="285" cy="55" rx="26" ry="13" transform="rotate(-15 285 55)"/><ellipse cx="365" cy="42" rx="26" ry="13" transform="rotate(5 365 42)"/><ellipse cx="445" cy="52" rx="26" ry="13" transform="rotate(25 445 52)"/><ellipse cx="515" cy="80" rx="26" ry="13" transform="rotate(-20 515 80)"/><ellipse cx="570" cy="125" rx="26" ry="13" transform="rotate(35 570 125)"/><ellipse cx="180" cy="185" rx="26" ry="13" transform="rotate(35 180 185)"/><ellipse cx="245" cy="220" rx="26" ry="13" transform="rotate(-20 245 220)"/><ellipse cx="320" cy="242" rx="26" ry="13" transform="rotate(15 320 242)"/><ellipse cx="400" cy="252" rx="26" ry="13" transform="rotate(-5 400 252)"/><ellipse cx="480" cy="238" rx="26" ry="13" transform="rotate(-25 480 238)"/><ellipse cx="545" cy="205" rx="26" ry="13" transform="rotate(20 545 205)"/><ellipse cx="595" cy="165" rx="26" ry="13" transform="rotate(-35 595 165)"/></g><g fill="#c96f4a"><circle cx="375" cy="150" r="20"/><circle cx="300" cy="120" r="9"/><circle cx="450" cy="120" r="9"/><circle cx="260" cy="165" r="8"/><circle cx="490" cy="165" r="8"/><circle cx="330" cy="200" r="8"/><circle cx="420" cy="200" r="8"/></g><g fill="#d9a35f"><circle cx="375" cy="150" r="9"/><circle cx="300" cy="120" r="4"/><circle cx="450" cy="120" r="4"/><circle cx="260" cy="165" r="4"/><circle cx="490" cy="165" r="4"/><circle cx="330" cy="200" r="4"/><circle cx="420" cy="200" r="4"/></g></svg>' },
      { name: 'branch-line', label: '枝叶分割线', w: 750, h: 130, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="130" viewBox="0 0 750 130"><path d="M30 65 Q 130 40 230 65 Q 330 90 430 65 Q 530 40 630 65 Q 700 78 730 65" fill="none" stroke="#5f8d8a" stroke-width="4" stroke-linecap="round"/><g fill="#6f9e78"><ellipse cx="110" cy="52" rx="12" ry="7" transform="rotate(-35 110 52)"/><ellipse cx="210" cy="78" rx="12" ry="7" transform="rotate(30 210 78)"/><ellipse cx="420" cy="78" rx="12" ry="7" transform="rotate(30 420 78)"/><ellipse cx="540" cy="52" rx="12" ry="7" transform="rotate(-35 540 52)"/><ellipse cx="650" cy="52" rx="10" ry="6" transform="rotate(-30 650 52)"/></g><circle cx="375" cy="65" r="7" fill="#c96f4a"/></svg>' },
      { name: 'bubble-flower', label: '花团气泡', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><g fill="#f7f3ee"><path d="M150 40 C 215 40 265 90 265 155 C 265 220 215 265 150 265 C 85 265 35 220 35 155 C 35 90 85 40 150 40 Z" stroke="#c96f4a" stroke-width="5"/></g><g fill="#c96f4a"><circle cx="105" cy="120" r="22"/><circle cx="195" cy="120" r="22"/><circle cx="150" cy="175" r="24"/><circle cx="105" cy="210" r="16"/><circle cx="195" cy="210" r="16"/></g><g fill="#d9a35f"><circle cx="150" cy="175" r="11"/></g><g fill="#6f9e78"><ellipse cx="60" cy="230" rx="16" ry="9" transform="rotate(-35 60 230)"/><ellipse cx="240" cy="230" rx="16" ry="9" transform="rotate(35 240 230)"/></g></svg>' },
      { name: 'ribbon-sash', label: '丝带横幅', w: 750, h: 220, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="220" viewBox="0 0 750 220"><path d="M0 70 L 90 45 L 660 45 L 750 70 L 750 150 L 660 175 L 90 175 L 0 150 Z" fill="#c96f4a"/><path d="M0 70 L 90 45 L 90 175 L 0 150 Z" fill="#b35f3a"/><path d="M750 70 L 660 45 L 660 175 L 750 150 Z" fill="#b35f3a"/><path d="M90 45 L 90 175 L 660 175 L 660 45 Z" fill="none" stroke="#f7f3ee" stroke-width="2" stroke-dasharray="10 8"/></svg>' },
      { name: 'frame-round', label: '圆角粗框', w: 750, h: 320, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="320" viewBox="0 0 750 320"><rect x="26" y="26" width="698" height="268" rx="26" fill="none" stroke="#c96f4a" stroke-width="10"/><rect x="50" y="50" width="650" height="220" rx="18" fill="none" stroke="#d9a35f" stroke-width="3" stroke-dasharray="12 10"/><g fill="#6f9e78"><ellipse cx="52" cy="160" rx="12" ry="7" transform="rotate(25 52 160)"/><ellipse cx="698" cy="160" rx="12" ry="7" transform="rotate(-25 698 160)"/></g></svg>' },
      { name: 'cloud-line', label: '云朵分隔', w: 750, h: 130, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="130" viewBox="0 0 750 130"><g fill="#5f8d8a" opacity="0.85"><circle cx="300" cy="75" r="26"/><circle cx="340" cy="58" r="34"/><circle cx="395" cy="72" r="28"/><path d="M270 98 Q 340 100 425 98 L 425 98 A 30 30 0 0 1 395 126 L 300 126 A 30 30 0 0 1 270 98 Z" /></g><g fill="#c96f4a"><circle cx="540" cy="82" r="16"/><circle cx="620" cy="82" r="12"/><circle cx="700" cy="82" r="8"/></g></svg>' },
      { name: 'wavy-line', label: '波浪细线', w: 750, h: 100, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="100" viewBox="0 0 750 100"><path d="M0 50 Q 62.5 10 125 50 T 250 50 T 375 50 T 500 50 T 625 50 T 750 50" fill="none" stroke="#c96f4a" stroke-width="4" stroke-linecap="round"/><path d="M0 62 Q 62.5 102 125 62 T 250 62 T 375 62 T 500 62 T 625 62 T 750 62" fill="none" stroke="#5f8d8a" stroke-width="3" stroke-linecap="round" opacity="0.7"/></svg>' },
      { name: 'sprig-bamboo', label: '竹枝', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><g fill="none" stroke="#4a7c59" stroke-width="7" stroke-linecap="round"><path d="M90 270 L 90 90"/><path d="M170 270 L 170 60"/><path d="M240 270 L 240 110"/></g><g fill="#6f9e78"><path d="M90 120 L 130 110 L 130 150 Z"/><path d="M170 100 L 210 88 L 210 132 Z"/><path d="M240 150 L 280 140 L 280 178 Z"/><path d="M90 200 L 50 192 L 52 232 Z"/><path d="M170 180 L 130 170 L 132 212 Z"/><path d="M240 230 L 200 220 L 202 262 Z"/></g></svg>' },
      { name: 'flower-tiny', label: '小花簇', w: 300, h: 240, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="240" viewBox="0 0 300 240"><g fill="none" stroke="#5f8d8a" stroke-width="4" stroke-linecap="round"><path d="M60 210 Q 110 170 160 150 Q 200 132 245 120"/></g><g fill="#c96f4a"><circle cx="110" cy="168" r="13"/><circle cx="180" cy="138" r="16"/><circle cx="245" cy="120" r="12"/></g><g fill="#d9a35f"><circle cx="110" cy="168" r="6"/><circle cx="180" cy="138" r="7"/><circle cx="245" cy="120" r="5"/></g><g fill="#6f9e78"><ellipse cx="140" cy="152" rx="12" ry="7" transform="rotate(-35 140 152)"/><ellipse cx="215" cy="128" rx="12" ry="7" transform="rotate(25 215 128)"/><ellipse cx="60" cy="205" rx="14" ry="8" transform="rotate(30 60 205)"/></g></svg>' },
      { name: 'butterfly', label: '蝴蝶', w: 300, h: 240, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="240" viewBox="0 0 300 240"><path d="M150 130 Q 150 100 130 80 Q 100 62 92 88 Q 86 110 118 128 Q 134 134 150 130 Z" fill="#c96f4a"/><path d="M150 130 Q 150 100 170 80 Q 200 62 208 88 Q 214 110 182 128 Q 166 134 150 130 Z" fill="#b35f3a"/><path d="M150 132 Q 150 160 132 178 Q 104 194 96 172 Q 90 152 120 136 Q 135 129 150 132 Z" fill="#d9a35f"/><path d="M150 132 Q 150 160 168 178 Q 196 194 204 172 Q 210 152 180 136 Q 165 129 150 132 Z" fill="#e8b48c"/><line x1="150" y1="128" x2="150" y2="180" stroke="#2f3640" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="122" r="5" fill="#2f3640"/><path d="M150 126 Q 140 112 128 108" fill="none" stroke="#2f3640" stroke-width="3" stroke-linecap="round"/><path d="M150 126 Q 160 112 172 108" fill="none" stroke="#2f3640" stroke-width="3" stroke-linecap="round"/></svg>' },
      { name: 'sun-flower', label: '向日葵', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><g fill="none" stroke="#5f8d8a" stroke-width="7" stroke-linecap="round"><path d="M150 190 L 150 265"/><path d="M150 210 Q 120 240 90 255"/><path d="M150 210 Q 180 240 210 255"/></g><g fill="#6f9e78"><ellipse cx="120" cy="245" rx="16" ry="9" transform="rotate(30 120 245)"/><ellipse cx="180" cy="245" rx="16" ry="9" transform="rotate(-30 180 245)"/></g><g fill="#d9a35f"><ellipse cx="150" cy="150" rx="66" ry="66"/></g><g fill="#c96f4a"><circle cx="150" cy="150" r="34"/></g><g fill="#d9a35f"><circle cx="150" cy="150" r="14"/></g></svg>' },
      { name: 'tulip', label: '郁金香', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><path d="M150 120 L 150 250" stroke="#4a7c59" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M150 165 Q 115 195 92 215" stroke="#4a7c59" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M150 165 Q 185 195 208 215" stroke="#4a7c59" stroke-width="6" stroke-linecap="round" fill="none"/><g fill="#6f9e78"><ellipse cx="105" cy="205" rx="15" ry="9" transform="rotate(-35 105 205)"/><ellipse cx="195" cy="205" rx="15" ry="9" transform="rotate(35 195 205)"/></g><path d="M150 130 C 125 100 130 72 150 66 C 170 72 175 100 150 130 Z" fill="#c96f4a"/><path d="M128 112 C 118 120 112 118 112 110 C 112 100 122 94 132 100 Z" fill="#d96b4a"/><path d="M172 112 C 182 120 188 118 188 110 C 188 100 178 94 168 100 Z" fill="#d96b4a"/></svg>' },
      { name: 'grass-field', label: '草丛底纹', w: 750, h: 180, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="180" viewBox="0 0 750 180"><g fill="none" stroke="#4a7c59" stroke-width="4" stroke-linecap="round"><path d="M30 160 Q 45 120 55 90"/><path d="M70 160 Q 85 120 92 96"/><path d="M110 160 Q 125 125 130 102"/><path d="M150 160 Q 165 120 175 92"/><path d="M190 160 Q 205 125 212 100"/><path d="M230 160 Q 245 118 252 94"/><path d="M270 160 Q 285 125 295 100"/><path d="M310 160 Q 325 120 332 94"/><path d="M350 160 Q 365 125 375 102"/><path d="M390 160 Q 405 120 412 94"/><path d="M430 160 Q 445 125 452 100"/><path d="M470 160 Q 485 120 495 94"/><path d="M510 160 Q 525 125 532 102"/><path d="M550 160 Q 565 120 575 92"/><path d="M590 160 Q 605 125 612 100"/><path d="M630 160 Q 645 120 652 94"/><path d="M670 160 Q 685 122 695 96"/><path d="M710 160 Q 722 125 728 102"/></g><g fill="#6f9e78"><ellipse cx="92" cy="102" rx="8" ry="5" transform="rotate(-25 92 102)"/><ellipse cx="252" cy="100" rx="8" ry="5" transform="rotate(25 252 100)"/><ellipse cx="412" cy="100" rx="8" ry="5" transform="rotate(-25 412 100)"/><ellipse cx="575" cy="98" rx="8" ry="5" transform="rotate(25 575 98)"/><ellipse cx="728" cy="104" rx="8" ry="5" transform="rotate(-20 728 104)"/></g><circle cx="150" cy="90" r="5" fill="#d9a35f"/><circle cx="330" cy="94" r="5" fill="#d9a35f"/><circle cx="490" cy="92" r="5" fill="#d9a35f"/><circle cx="650" cy="96" r="5" fill="#d9a35f"/></svg>' },
      { name: 'dot-band', label: '圆点底纹带', w: 750, h: 120, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="120" viewBox="0 0 750 120"><rect width="750" height="120" fill="#f7f3ee"/><g fill="#c96f4a" opacity="0.55"><circle cx="40" cy="40" r="5"/><circle cx="120" cy="40" r="5"/><circle cx="200" cy="40" r="5"/><circle cx="280" cy="40" r="5"/><circle cx="360" cy="40" r="5"/><circle cx="440" cy="40" r="5"/><circle cx="520" cy="40" r="5"/><circle cx="600" cy="40" r="5"/><circle cx="680" cy="40" r="5"/><circle cx="80" cy="80" r="5"/><circle cx="160" cy="80" r="5"/><circle cx="240" cy="80" r="5"/><circle cx="320" cy="80" r="5"/><circle cx="400" cy="80" r="5"/><circle cx="480" cy="80" r="5"/><circle cx="560" cy="80" r="5"/><circle cx="640" cy="80" r="5"/><circle cx="720" cy="80" r="5"/></g><g fill="#5f8d8a" opacity="0.4"><circle cx="40" cy="80" r="5"/><circle cx="120" cy="80" r="5"/><circle cx="200" cy="80" r="5"/><circle cx="280" cy="80" r="5"/><circle cx="360" cy="80" r="5"/><circle cx="440" cy="80" r="5"/><circle cx="520" cy="80" r="5"/><circle cx="600" cy="80" r="5"/><circle cx="680" cy="80" r="5"/><circle cx="80" cy="40" r="5"/><circle cx="160" cy="40" r="5"/><circle cx="240" cy="40" r="5"/><circle cx="320" cy="40" r="5"/><circle cx="400" cy="40" r="5"/><circle cx="480" cy="40" r="5"/><circle cx="560" cy="40" r="5"/><circle cx="640" cy="40" r="5"/><circle cx="720" cy="40" r="5"/></g></svg>' },
      { name: 'star-shine', label: '星点闪烁', w: 750, h: 120, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="120" viewBox="0 0 750 120"><path d="M375 20 L380 40 L400 45 L380 50 L375 70 L370 50 L350 45 L370 40 Z" fill="#d9a35f"/><path d="M150 55 L153 65 L163 68 L153 71 L150 81 L147 71 L137 68 L147 65 Z" fill="#c96f4a"/><path d="M600 45 L603 55 L613 58 L603 61 L600 71 L597 61 L587 58 L597 55 Z" fill="#c96f4a"/><path d="M240 90 L242 97 L249 99 L242 101 L240 108 L238 101 L231 99 L238 97 Z" fill="#5f8d8a"/><path d="M520 85 L522 92 L529 94 L522 96 L520 103 L518 96 L511 94 L518 92 Z" fill="#5f8d8a"/><line x1="60" y1="60" x2="120" y2="60" stroke="#e5ddd3" stroke-width="3" stroke-linecap="round"/><line x1="200" y1="60" x2="330" y2="60" stroke="#e5ddd3" stroke-width="3" stroke-linecap="round"/><line x1="420" y1="60" x2="560" y2="60" stroke="#e5ddd3" stroke-width="3" stroke-linecap="round"/><line x1="630" y1="60" x2="700" y2="60" stroke="#e5ddd3" stroke-width="3" stroke-linecap="round"/></svg>' },
      // ---------- v10.3 复杂插画资产：SVG 内可用渐变/明暗分层（资产渲染为 PNG 图片上传，渐变在图片内合法；正文 CSS 平面化铁律不受影响；色板仍低饱和同色系） ----------
      { name: 'sunrise-panorama', label: '日出山水横幅', w: 750, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="300" viewBox="0 0 750 300"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfaf5"/><stop offset="0.55" stop-color="#f5e6d3"/><stop offset="1" stop-color="#f0d2ae"/></linearGradient><radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#e8b48c"/><stop offset="0.7" stop-color="#d9a35f"/><stop offset="1" stop-color="#c98d4e"/></radialGradient><linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa8a4"/><stop offset="1" stop-color="#5f8d8a"/></linearGradient><linearGradient id="near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f8d8a"/><stop offset="1" stop-color="#4a746f"/></linearGradient><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d2ae"/><stop offset="1" stop-color="#d9b894"/></linearGradient></defs><rect width="750" height="300" fill="url(#sky)"/><circle cx="375" cy="116" r="70" fill="#d9a35f" opacity="0.16"/><circle cx="375" cy="116" r="42" fill="url(#sun)"/><path d="M0 172 L 130 92 L 250 162 L 400 70 L 540 166 L 650 122 L 750 176 L 750 214 L 0 214 Z" fill="url(#far)"/><path d="M0 214 L 180 152 L 320 214 L 470 162 L 610 216 L 750 186 L 750 232 L 0 232 Z" fill="url(#near)"/><rect x="0" y="232" width="750" height="68" fill="url(#water)"/><path d="M375 232 L 375 300" stroke="#c98d4e" stroke-width="3" opacity="0.45"/><ellipse cx="375" cy="262" rx="22" ry="5" fill="#c98d4e" opacity="0.35"/><path d="M120 60 Q 135 45 150 60 Q 165 45 180 60" fill="none" stroke="#5f8d8a" stroke-width="3" stroke-linecap="round"/><path d="M565 72 Q 580 57 595 72 Q 610 57 625 72" fill="none" stroke="#5f8d8a" stroke-width="3" stroke-linecap="round"/></svg>' },
      { name: 'moon-night', label: '月夜星空', w: 750, h: 280, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="280" viewBox="0 0 750 280"><defs><linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f3640"/><stop offset="1" stop-color="#4b5563"/></linearGradient><radialGradient id="moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f5ecd9"/><stop offset="0.75" stop-color="#e6d5b3"/><stop offset="1" stop-color="#cfb98e"/></radialGradient><linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a444f"/><stop offset="1" stop-color="#232a33"/></linearGradient></defs><rect width="750" height="280" fill="url(#night)"/><g fill="#f5ecd9"><circle cx="90" cy="58" r="2.5" opacity="0.8"/><circle cx="160" cy="120" r="2" opacity="0.55"/><circle cx="240" cy="46" r="2" opacity="0.7"/><circle cx="330" cy="96" r="2.5" opacity="0.5"/><circle cx="420" cy="52" r="2" opacity="0.65"/><circle cx="660" cy="70" r="2.5" opacity="0.7"/><circle cx="710" cy="140" r="2" opacity="0.5"/><circle cx="520" cy="150" r="2" opacity="0.45"/></g><circle cx="540" cy="84" r="44" fill="url(#moon)"/><circle cx="524" cy="72" r="8" fill="#d9c9a8" opacity="0.5"/><circle cx="556" cy="98" r="5" fill="#d9c9a8" opacity="0.45"/><circle cx="550" cy="68" r="4" fill="#d9c9a8" opacity="0.4"/><path d="M0 214 L 150 168 L 280 214 L 430 160 L 560 214 L 660 178 L 750 206 L 750 280 L 0 280 Z" fill="url(#h1)" opacity="0.85"/><path d="M0 236 L 190 196 L 340 240 L 500 202 L 640 242 L 750 216 L 750 280 L 0 280 Z" fill="#1c222a" opacity="0.9"/></svg>' },
      { name: 'bamboo-mist', label: '竹林晨雾', w: 750, h: 260, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="260" viewBox="0 0 750 260"><defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f7f4"/><stop offset="1" stop-color="#d8e8df"/></linearGradient><linearGradient id="stalk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fae87"/><stop offset="1" stop-color="#4a7c59"/></linearGradient></defs><rect width="750" height="260" fill="url(#mist)"/><g stroke-linecap="round"><path d="M120 260 L 120 40" stroke="url(#stalk)" stroke-width="10" opacity="0.75"/><path d="M150 260 L 150 20" stroke="url(#stalk)" stroke-width="7" opacity="0.55"/><path d="M340 260 L 340 30" stroke="url(#stalk)" stroke-width="12" opacity="0.8"/><path d="M380 260 L 380 10" stroke="url(#stalk)" stroke-width="8" opacity="0.6"/><path d="M600 260 L 600 50" stroke="url(#stalk)" stroke-width="10" opacity="0.7"/><path d="M635 260 L 635 24" stroke="url(#stalk)" stroke-width="7" opacity="0.5"/></g><g stroke="#3f6b68" stroke-width="2.5" opacity="0.8" fill="none" stroke-linecap="round"><path d="M120 190 Q 168 176 180 130"/><path d="M150 160 Q 196 150 210 106"/><path d="M340 200 Q 292 186 282 142"/><path d="M380 170 Q 328 158 316 112"/><path d="M600 214 Q 648 202 662 158"/><path d="M120 96 Q 76 84 64 40"/><path d="M340 110 Q 392 100 406 56"/><path d="M600 130 Q 552 118 540 74"/></g><rect x="0" y="208" width="750" height="52" fill="#ffffff" opacity="0.55"/><rect x="0" y="236" width="750" height="24" fill="#ffffff" opacity="0.6"/></svg>' },
      { name: 'spring-branch', label: '春花枝', w: 500, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><defs><radialGradient id="petal" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="1" stop-color="#c96f4a"/></radialGradient><linearGradient id="twig" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a7460"/><stop offset="1" stop-color="#6b5b4a"/></linearGradient></defs><path d="M40 280 Q 160 230 260 150 Q 330 95 470 40" fill="none" stroke="url(#twig)" stroke-width="7" stroke-linecap="round"/><path d="M260 150 Q 300 110 350 120" fill="none" stroke="url(#twig)" stroke-width="4" stroke-linecap="round"/><path d="M210 205 Q 150 190 120 150" fill="none" stroke="url(#twig)" stroke-width="4" stroke-linecap="round"/><g fill="url(#petal)"><ellipse cx="250" cy="142" rx="17" ry="9" transform="rotate(-72 250 142)"/><ellipse cx="250" cy="142" rx="17" ry="9" transform="rotate(0 250 142)"/><ellipse cx="250" cy="142" rx="17" ry="9" transform="rotate(72 250 142)"/><ellipse cx="250" cy="142" rx="17" ry="9" transform="rotate(144 250 142)"/><ellipse cx="250" cy="142" rx="17" ry="9" transform="rotate(216 250 142)"/></g><circle cx="250" cy="142" r="8" fill="#d9a35f"/><g fill="url(#petal)"><ellipse cx="350" cy="120" rx="13" ry="7" transform="rotate(-72 350 120)"/><ellipse cx="350" cy="120" rx="13" ry="7" transform="rotate(0 350 120)"/><ellipse cx="350" cy="120" rx="13" ry="7" transform="rotate(72 350 120)"/><ellipse cx="350" cy="120" rx="13" ry="7" transform="rotate(144 350 120)"/><ellipse cx="350" cy="120" rx="13" ry="7" transform="rotate(216 350 120)"/></g><circle cx="350" cy="120" r="6" fill="#d9a35f"/><g fill="url(#petal)"><ellipse cx="155" cy="152" rx="12" ry="6.5" transform="rotate(-72 155 152)"/><ellipse cx="155" cy="152" rx="12" ry="6.5" transform="rotate(0 155 152)"/><ellipse cx="155" cy="152" rx="12" ry="6.5" transform="rotate(72 155 152)"/><ellipse cx="155" cy="152" rx="12" ry="6.5" transform="rotate(144 155 152)"/><ellipse cx="155" cy="152" rx="12" ry="6.5" transform="rotate(216 155 152)"/></g><circle cx="155" cy="152" r="5.5" fill="#d9a35f"/><g fill="#c96f4a"><circle cx="120" cy="150" r="7"/><circle cx="436" cy="62" r="8"/><circle cx="300" cy="110" r="6"/><circle cx="188" cy="212" r="6"/></g><g fill="#6f9e78"><ellipse cx="230" cy="186" rx="15" ry="8" transform="rotate(-30 230 186)"/><ellipse cx="310" cy="95" rx="14" ry="7" transform="rotate(25 310 95)"/><ellipse cx="420" cy="66" rx="14" ry="7" transform="rotate(-25 420 66)"/><ellipse cx="150" cy="120" rx="12" ry="6" transform="rotate(35 150 120)"/></g></svg>' },
      { name: 'rose-branch', label: '玫瑰枝', w: 400, h: 320, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320"><defs><radialGradient id="rose" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#e08a6a"/><stop offset="0.55" stop-color="#c96f4a"/><stop offset="1" stop-color="#a04e2e"/></radialGradient><linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fae87"/><stop offset="1" stop-color="#4a7c59"/></linearGradient></defs><path d="M70 310 Q 160 250 210 170 Q 250 100 340 40" fill="none" stroke="#4a7c59" stroke-width="6" stroke-linecap="round"/><path d="M210 170 Q 260 190 300 230" fill="none" stroke="#4a7c59" stroke-width="4" stroke-linecap="round"/><g fill="url(#rose)"><path d="M210 150 C 186 128 182 96 210 84 C 238 96 234 128 210 150 Z"/><path d="M210 150 C 160 160 134 190 150 214 C 178 222 200 192 210 150 Z" opacity="0.9"/><path d="M210 150 C 260 160 286 190 270 214 C 242 222 220 192 210 150 Z" opacity="0.9"/><path d="M210 150 C 200 196 176 224 154 222 C 148 194 178 170 210 150 Z" opacity="0.85"/><path d="M210 150 C 220 196 244 224 266 222 C 272 194 242 170 210 150 Z" opacity="0.85"/></g><circle cx="210" cy="150" r="16" fill="#a04e2e"/><circle cx="210" cy="150" r="8" fill="#d9a35f"/><g fill="url(#rose)"><path d="M330 60 C 314 46 312 26 330 18 C 348 26 346 46 330 60 Z"/><path d="M330 60 C 306 72 292 96 304 112 C 322 116 336 94 330 60 Z" opacity="0.9"/><path d="M330 60 C 354 72 368 96 356 112 C 338 116 324 94 330 60 Z" opacity="0.9"/></g><circle cx="330" cy="60" r="11" fill="#a04e2e"/><circle cx="330" cy="60" r="5.5" fill="#d9a35f"/><g fill="url(#leaf)"><ellipse cx="140" cy="250" rx="24" ry="12" transform="rotate(-35 140 250)"/><ellipse cx="268" cy="150" rx="22" ry="11" transform="rotate(40 268 150)"/><ellipse cx="300" cy="232" rx="20" ry="10" transform="rotate(-25 300 232)"/><ellipse cx="90" cy="290" rx="18" ry="9" transform="rotate(30 90 290)"/></g><g stroke="#3f6b68" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"><path d="M140 250 L 155 238"/><path d="M268 150 L 250 140"/><path d="M300 232 L 312 222"/></g></svg>' },
      { name: 'lotus', label: '莲花荷叶', w: 500, h: 320, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320" viewBox="0 0 500 320"><defs><radialGradient id="lpetal" cx="0.5" cy="0.15" r="0.95"><stop offset="0" stop-color="#f5ddc9"/><stop offset="0.6" stop-color="#e8b48c"/><stop offset="1" stop-color="#c98d4e"/></radialGradient><radialGradient id="pad" cx="0.35" cy="0.35" r="0.85"><stop offset="0" stop-color="#7fae87"/><stop offset="1" stop-color="#4a7c59"/></radialGradient></defs><path d="M120 260 C 70 260 30 220 30 180 C 30 140 70 100 120 100 C 170 100 210 140 210 180 C 210 220 170 260 120 260 Z" fill="url(#pad)" opacity="0.92"/><g stroke="#3f6b68" stroke-width="2.5" opacity="0.75" fill="none"><path d="M120 120 L 120 240"/><path d="M120 130 L 60 180"/><path d="M120 130 L 180 180"/><path d="M120 140 L 84 210"/><path d="M120 140 L 156 210"/></g><g transform="translate(300 132)"><path d="M0 -78 C 22 -54 22 -20 0 0 C -22 -20 -22 -54 0 -78 Z" fill="url(#lpetal)"/><path d="M0 -78 C 22 -54 22 -20 0 0 C -22 -20 -22 -54 0 -78 Z" fill="url(#lpetal)" transform="rotate(45)"/><path d="M0 -78 C 22 -54 22 -20 0 0 C -22 -20 -22 -54 0 -78 Z" fill="url(#lpetal)" transform="rotate(-45)"/><path d="M0 -78 C 22 -54 22 -20 0 0 C -22 -20 -22 -54 0 -78 Z" fill="url(#lpetal)" transform="rotate(90)"/><path d="M0 -78 C 22 -54 22 -20 0 0 C -22 -20 -22 -54 0 -78 Z" fill="url(#lpetal)" transform="rotate(-90)"/><path d="M0 -60 C 18 -42 18 -14 0 0 C -18 -14 -18 -42 0 -60 Z" fill="url(#lpetal)" transform="rotate(22)"/><path d="M0 -60 C 18 -42 18 -14 0 0 C -18 -14 -18 -42 0 -60 Z" fill="url(#lpetal)" transform="rotate(-22)"/><path d="M0 -60 C 18 -42 18 -14 0 0 C -18 -14 -18 -42 0 -60 Z" fill="url(#lpetal)" transform="rotate(68)"/><path d="M0 -60 C 18 -42 18 -14 0 0 C -18 -14 -18 -42 0 -60 Z" fill="url(#lpetal)" transform="rotate(-68)"/><circle cx="0" cy="0" r="13" fill="#d9a35f"/><circle cx="0" cy="0" r="6" fill="#c98d4e"/></g><path d="M200 300 Q 320 288 440 300" fill="none" stroke="#5f8d8a" stroke-width="3" stroke-linecap="round" opacity="0.6"/><path d="M230 312 Q 330 302 430 312" fill="none" stroke="#5f8d8a" stroke-width="2" stroke-linecap="round" opacity="0.45"/></svg>' },
      { name: 'plum-branch', label: '梅花枝', w: 500, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><defs><radialGradient id="plum" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#e08a7a"/><stop offset="1" stop-color="#b3572f"/></radialGradient></defs><path d="M30 290 Q 130 220 190 140 Q 235 80 320 60" fill="none" stroke="#2f3640" stroke-width="8" stroke-linecap="round"/><path d="M190 140 Q 170 70 230 30" fill="none" stroke="#2f3640" stroke-width="5" stroke-linecap="round"/><path d="M250 100 Q 330 110 400 70" fill="none" stroke="#2f3640" stroke-width="4" stroke-linecap="round"/><path d="M120 220 Q 70 190 50 130" fill="none" stroke="#2f3640" stroke-width="4" stroke-linecap="round"/><g fill="url(#plum)"><circle cx="190" cy="150" r="13" transform="translate(-5.8 0)"/><circle cx="190" cy="150" r="13" transform="translate(-1.8 5.5)"/><circle cx="190" cy="150" r="13" transform="translate(4.7 3.4)"/><circle cx="190" cy="150" r="13" transform="translate(4.7 -3.4)"/><circle cx="190" cy="150" r="13" transform="translate(-1.8 -5.5)"/></g><circle cx="190" cy="150" r="6" fill="#d9a35f"/><g fill="url(#plum)"><circle cx="330" cy="70" r="11" transform="translate(-4.9 0)"/><circle cx="330" cy="70" r="11" transform="translate(-1.5 4.7)"/><circle cx="330" cy="70" r="11" transform="translate(4 2.9)"/><circle cx="330" cy="70" r="11" transform="translate(4 -2.9)"/><circle cx="330" cy="70" r="11" transform="translate(-1.5 -4.7)"/></g><circle cx="330" cy="70" r="5" fill="#d9a35f"/><g fill="url(#plum)"><circle cx="245" cy="35" r="10" transform="translate(-4.5 0)"/><circle cx="245" cy="35" r="10" transform="translate(-1.4 4.3)"/><circle cx="245" cy="35" r="10" transform="translate(3.6 2.6)"/><circle cx="245" cy="35" r="10" transform="translate(3.6 -2.6)"/><circle cx="245" cy="35" r="10" transform="translate(-1.4 -4.3)"/></g><circle cx="245" cy="35" r="4.5" fill="#d9a35f"/><g fill="url(#plum)"><circle cx="100" cy="230" r="12" transform="translate(-5.4 0)"/><circle cx="100" cy="230" r="12" transform="translate(-1.7 5.1)"/><circle cx="100" cy="230" r="12" transform="translate(4.3 3.1)"/><circle cx="100" cy="230" r="12" transform="translate(4.3 -3.1)"/><circle cx="100" cy="230" r="12" transform="translate(-1.7 -5.1)"/></g><circle cx="100" cy="230" r="5.5" fill="#d9a35f"/><g fill="url(#plum)"><circle cx="412" cy="75" r="10" transform="translate(-4.5 0)"/><circle cx="412" cy="75" r="10" transform="translate(-1.4 4.3)"/><circle cx="412" cy="75" r="10" transform="translate(3.6 2.6)"/><circle cx="412" cy="75" r="10" transform="translate(3.6 -2.6)"/><circle cx="412" cy="75" r="10" transform="translate(-1.4 -4.3)"/></g><circle cx="412" cy="75" r="4.5" fill="#d9a35f"/><g fill="#b3572f"><circle cx="60" cy="120" r="6"/><circle cx="272" cy="70" r="5"/><circle cx="170" cy="92" r="5"/><circle cx="360" cy="110" r="5"/></g></svg>' },
      { name: 'pine-sprig', label: '松枝', w: 400, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs><linearGradient id="pine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a7c59"/><stop offset="1" stop-color="#3f6b68"/></linearGradient><radialGradient id="cone" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#8a7460"/><stop offset="1" stop-color="#4a4038"/></radialGradient></defs><path d="M60 290 Q 170 240 220 150 Q 260 80 340 30" fill="none" stroke="#6b5b4a" stroke-width="7" stroke-linecap="round"/><path d="M220 150 Q 150 120 90 90" fill="none" stroke="#6b5b4a" stroke-width="5" stroke-linecap="round"/><path d="M255 110 Q 330 100 380 130" fill="none" stroke="#6b5b4a" stroke-width="4" stroke-linecap="round"/><g stroke="url(#pine)" stroke-width="3.5" stroke-linecap="round"><path d="M140 200 L 96 168 M140 200 L 100 190 M140 200 L 104 206 M140 200 L 118 168 M140 200 L 122 210 M140 200 L 132 172"/><path d="M190 170 L 152 132 M190 170 L 154 154 M190 170 L 160 170 M190 170 L 168 134 M190 170 L 172 176 M190 170 L 182 140"/><path d="M250 120 L 288 84 M250 120 L 288 106 M250 120 L 282 122 M250 120 L 268 86 M250 120 L 264 128 M250 120 L 240 90"/><path d="M310 60 L 348 26 M310 60 L 348 48 M310 60 L 340 62 M310 60 L 326 28 M310 60 L 322 68 M310 60 L 300 32"/><path d="M90 90 L 48 60 M90 90 L 52 84 M90 90 L 60 92 M90 90 L 70 62 M90 90 L 74 98 M90 90 L 84 66"/><path d="M360 130 L 398 100 M360 130 L 396 118 M360 130 L 388 132 M360 130 L 374 102 M360 130 L 370 138 M360 130 L 350 104"/><path d="M205 140 L 170 112 M205 140 L 172 132 M205 140 L 180 142 M205 140 L 188 114 M205 140 L 192 148 M205 140 L 200 118"/></g><ellipse cx="252" cy="150" rx="13" ry="17" fill="url(#cone)"/><g stroke="#2f3640" stroke-width="1.5" opacity="0.6" fill="none"><path d="M243 138 L 261 138"/><path d="M241 146 L 263 146"/><path d="M242 154 L 262 154"/><path d="M244 162 L 260 162"/></g></svg>' },
      { name: 'arch-garden', label: '拱门花框', w: 750, h: 420, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="420" viewBox="0 0 750 420"><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8c58a"/><stop offset="0.5" stop-color="#d9a35f"/><stop offset="1" stop-color="#c98d4e"/></linearGradient><radialGradient id="fpetal" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="1" stop-color="#c96f4a"/></radialGradient></defs><path d="M105 400 L 105 140 A 270 270 0 0 1 645 140 L 645 400" fill="none" stroke="url(#gold)" stroke-width="12" stroke-linecap="round"/><path d="M125 400 L 125 148 A 250 250 0 0 1 625 148 L 625 400" fill="none" stroke="#d9a35f" stroke-width="4" stroke-linecap="round" opacity="0.7" stroke-dasharray="14 10"/><rect x="78" y="380" width="70" height="40" rx="8" fill="url(#gold)" opacity="0.9"/><rect x="602" y="380" width="70" height="40" rx="8" fill="url(#gold)" opacity="0.9"/><g fill="url(#fpetal)"><ellipse cx="375" cy="52" rx="15" ry="8" transform="rotate(-72 375 52)"/><ellipse cx="375" cy="52" rx="15" ry="8" transform="rotate(0 375 52)"/><ellipse cx="375" cy="52" rx="15" ry="8" transform="rotate(72 375 52)"/><ellipse cx="375" cy="52" rx="15" ry="8" transform="rotate(144 375 52)"/><ellipse cx="375" cy="52" rx="15" ry="8" transform="rotate(216 375 52)"/></g><circle cx="375" cy="52" r="7" fill="#d9a35f"/><g fill="url(#fpetal)"><ellipse cx="278" cy="84" rx="13" ry="7" transform="rotate(-72 278 84)"/><ellipse cx="278" cy="84" rx="13" ry="7" transform="rotate(0 278 84)"/><ellipse cx="278" cy="84" rx="13" ry="7" transform="rotate(72 278 84)"/><ellipse cx="278" cy="84" rx="13" ry="7" transform="rotate(144 278 84)"/><ellipse cx="278" cy="84" rx="13" ry="7" transform="rotate(216 278 84)"/></g><circle cx="278" cy="84" r="6" fill="#d9a35f"/><g fill="url(#fpetal)"><ellipse cx="472" cy="84" rx="13" ry="7" transform="rotate(-72 472 84)"/><ellipse cx="472" cy="84" rx="13" ry="7" transform="rotate(0 472 84)"/><ellipse cx="472" cy="84" rx="13" ry="7" transform="rotate(72 472 84)"/><ellipse cx="472" cy="84" rx="13" ry="7" transform="rotate(144 472 84)"/><ellipse cx="472" cy="84" rx="13" ry="7" transform="rotate(216 472 84)"/></g><circle cx="472" cy="84" r="6" fill="#d9a35f"/><g fill="url(#fpetal)"><ellipse cx="200" cy="140" rx="12" ry="6.5" transform="rotate(-72 200 140)"/><ellipse cx="200" cy="140" rx="12" ry="6.5" transform="rotate(0 200 140)"/><ellipse cx="200" cy="140" rx="12" ry="6.5" transform="rotate(72 200 140)"/><ellipse cx="200" cy="140" rx="12" ry="6.5" transform="rotate(144 200 140)"/><ellipse cx="200" cy="140" rx="12" ry="6.5" transform="rotate(216 200 140)"/></g><circle cx="200" cy="140" r="5.5" fill="#d9a35f"/><g fill="url(#fpetal)"><ellipse cx="550" cy="140" rx="12" ry="6.5" transform="rotate(-72 550 140)"/><ellipse cx="550" cy="140" rx="12" ry="6.5" transform="rotate(0 550 140)"/><ellipse cx="550" cy="140" rx="12" ry="6.5" transform="rotate(72 550 140)"/><ellipse cx="550" cy="140" rx="12" ry="6.5" transform="rotate(144 550 140)"/><ellipse cx="550" cy="140" rx="12" ry="6.5" transform="rotate(216 550 140)"/></g><circle cx="550" cy="140" r="5.5" fill="#d9a35f"/><g fill="url(#fpetal)"><ellipse cx="150" cy="250" rx="11" ry="6" transform="rotate(-72 150 250)"/><ellipse cx="150" cy="250" rx="11" ry="6" transform="rotate(0 150 250)"/><ellipse cx="150" cy="250" rx="11" ry="6" transform="rotate(72 150 250)"/><ellipse cx="150" cy="250" rx="11" ry="6" transform="rotate(144 150 250)"/><ellipse cx="150" cy="250" rx="11" ry="6" transform="rotate(216 150 250)"/></g><circle cx="150" cy="250" r="5" fill="#d9a35f"/><g fill="url(#fpetal)"><ellipse cx="600" cy="250" rx="11" ry="6" transform="rotate(-72 600 250)"/><ellipse cx="600" cy="250" rx="11" ry="6" transform="rotate(0 600 250)"/><ellipse cx="600" cy="250" rx="11" ry="6" transform="rotate(72 600 250)"/><ellipse cx="600" cy="250" rx="11" ry="6" transform="rotate(144 600 250)"/><ellipse cx="600" cy="250" rx="11" ry="6" transform="rotate(216 600 250)"/></g><circle cx="600" cy="250" r="5" fill="#d9a35f"/><g fill="#6f9e78"><ellipse cx="330" cy="66" rx="12" ry="6" transform="rotate(-30 330 66)"/><ellipse cx="420" cy="66" rx="12" ry="6" transform="rotate(30 420 66)"/><ellipse cx="235" cy="112" rx="10" ry="5.5" transform="rotate(25 235 112)"/><ellipse cx="515" cy="112" rx="10" ry="5.5" transform="rotate(-25 515 112)"/><ellipse cx="178" cy="196" rx="10" ry="5.5" transform="rotate(-35 178 196)"/><ellipse cx="572" cy="196" rx="10" ry="5.5" transform="rotate(35 572 196)"/></g></svg>' },
      { name: 'frame-gilt', label: '描金双线框', w: 750, h: 320, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="320" viewBox="0 0 750 320"><defs><linearGradient id="goldv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8c58a"/><stop offset="0.5" stop-color="#d9a35f"/><stop offset="1" stop-color="#c98d4e"/></linearGradient><radialGradient id="cpetal" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="1" stop-color="#c96f4a"/></radialGradient></defs><rect x="28" y="28" width="694" height="264" rx="22" fill="none" stroke="url(#goldv)" stroke-width="12"/><rect x="54" y="54" width="642" height="212" rx="14" fill="none" stroke="#d9a35f" stroke-width="3" stroke-dasharray="14 10" opacity="0.85"/><g fill="url(#cpetal)"><ellipse cx="40" cy="40" rx="11" ry="6" transform="rotate(-72 40 40)"/><ellipse cx="40" cy="40" rx="11" ry="6" transform="rotate(0 40 40)"/><ellipse cx="40" cy="40" rx="11" ry="6" transform="rotate(72 40 40)"/><ellipse cx="40" cy="40" rx="11" ry="6" transform="rotate(144 40 40)"/><ellipse cx="40" cy="40" rx="11" ry="6" transform="rotate(216 40 40)"/></g><circle cx="40" cy="40" r="5" fill="#d9a35f"/><g fill="url(#cpetal)"><ellipse cx="710" cy="40" rx="11" ry="6" transform="rotate(-72 710 40)"/><ellipse cx="710" cy="40" rx="11" ry="6" transform="rotate(0 710 40)"/><ellipse cx="710" cy="40" rx="11" ry="6" transform="rotate(72 710 40)"/><ellipse cx="710" cy="40" rx="11" ry="6" transform="rotate(144 710 40)"/><ellipse cx="710" cy="40" rx="11" ry="6" transform="rotate(216 710 40)"/></g><circle cx="710" cy="40" r="5" fill="#d9a35f"/><g fill="url(#cpetal)"><ellipse cx="40" cy="280" rx="11" ry="6" transform="rotate(-72 40 280)"/><ellipse cx="40" cy="280" rx="11" ry="6" transform="rotate(0 40 280)"/><ellipse cx="40" cy="280" rx="11" ry="6" transform="rotate(72 40 280)"/><ellipse cx="40" cy="280" rx="11" ry="6" transform="rotate(144 40 280)"/><ellipse cx="40" cy="280" rx="11" ry="6" transform="rotate(216 40 280)"/></g><circle cx="40" cy="280" r="5" fill="#d9a35f"/><g fill="url(#cpetal)"><ellipse cx="710" cy="280" rx="11" ry="6" transform="rotate(-72 710 280)"/><ellipse cx="710" cy="280" rx="11" ry="6" transform="rotate(0 710 280)"/><ellipse cx="710" cy="280" rx="11" ry="6" transform="rotate(72 710 280)"/><ellipse cx="710" cy="280" rx="11" ry="6" transform="rotate(144 710 280)"/><ellipse cx="710" cy="280" rx="11" ry="6" transform="rotate(216 710 280)"/></g><circle cx="710" cy="280" r="5" fill="#d9a35f"/><g fill="none" stroke="#c98d4e" stroke-width="4" stroke-linecap="round"><path d="M96 28 Q 66 28 52 52"/><path d="M654 28 Q 684 28 698 52"/><path d="M96 292 Q 66 292 52 268"/><path d="M654 292 Q 684 292 698 268"/></g></svg>' },
      { name: 'seal-red', label: '朱印圆章', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><radialGradient id="seal" cx="0.42" cy="0.38" r="0.75"><stop offset="0" stop-color="#d96b4a"/><stop offset="1" stop-color="#9a3b22"/></radialGradient></defs><circle cx="150" cy="150" r="130" fill="none" stroke="#8f3b24" stroke-width="9"/><circle cx="150" cy="150" r="118" fill="url(#seal)"/><circle cx="150" cy="150" r="100" fill="none" stroke="#f5e6d3" stroke-width="2.5" opacity="0.85"/><g fill="#f5e6d3" opacity="0.85"><path d="M150 96 L 162 140 L 150 154 L 138 140 Z"/><circle cx="150" cy="172" r="5"/><circle cx="126" cy="120" r="4"/><circle cx="174" cy="120" r="4"/><path d="M84 176 Q 96 158 116 152 Q 100 168 98 184 Z"/><path d="M216 176 Q 204 158 184 152 Q 200 168 202 184 Z"/><path d="M120 214 Q 140 226 150 222 Q 160 226 180 214 Q 162 232 150 232 Q 138 232 120 214 Z"/></g><circle cx="150" cy="150" r="90" fill="none" stroke="#f5e6d3" stroke-width="1.5" opacity="0.4" stroke-dasharray="4 6"/></svg>' },
      { name: 'laurel-badge', label: '桂冠徽章', w: 400, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs><linearGradient id="leafg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fae87"/><stop offset="1" stop-color="#4a7c59"/></linearGradient><radialGradient id="medal" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#f5ecd9"/><stop offset="1" stop-color="#d9c9a8"/></radialGradient></defs><g fill="url(#leafg)"><ellipse cx="150" cy="120" rx="26" ry="11" transform="rotate(-55 150 120)"/><ellipse cx="116" cy="150" rx="26" ry="11" transform="rotate(-25 116 150)"/><ellipse cx="108" cy="190" rx="26" ry="11" transform="rotate(15 108 190)"/><ellipse cx="130" cy="222" rx="26" ry="11" transform="rotate(50 130 222)"/><ellipse cx="170" cy="112" rx="24" ry="10" transform="rotate(-70 170 112)"/><ellipse cx="128" cy="176" rx="24" ry="10" transform="rotate(0 128 176)"/><ellipse cx="250" cy="120" rx="26" ry="11" transform="rotate(55 250 120)"/><ellipse cx="284" cy="150" rx="26" ry="11" transform="rotate(25 284 150)"/><ellipse cx="292" cy="190" rx="26" ry="11" transform="rotate(-15 292 190)"/><ellipse cx="270" cy="222" rx="26" ry="11" transform="rotate(-50 270 222)"/><ellipse cx="230" cy="112" rx="24" ry="10" transform="rotate(70 230 112)"/><ellipse cx="272" cy="176" rx="24" ry="10" transform="rotate(0 272 176)"/></g><g fill="none" stroke="#6b5b4a" stroke-width="4" stroke-linecap="round"><path d="M158 116 Q 140 150 140 176"/><path d="M242 116 Q 260 150 260 176"/></g><circle cx="200" cy="152" r="62" fill="url(#medal)" stroke="#c98d4e" stroke-width="5"/><circle cx="200" cy="152" r="50" fill="none" stroke="#c98d4e" stroke-width="2" opacity="0.7" stroke-dasharray="3 5"/><path d="M200 112 L 200 192" stroke="#c98d4e" stroke-width="3" opacity="0.8"/><path d="M160 152 L 240 152" stroke="#c98d4e" stroke-width="3" opacity="0.8"/><circle cx="200" cy="152" r="8" fill="#c96f4a"/><path d="M148 236 Q 200 252 252 236 L 244 252 Q 200 264 156 252 Z" fill="#c96f4a"/><path d="M160 244 L 166 266 L 178 252" fill="none" stroke="#b35f3a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M240 244 L 234 266 L 222 252" fill="none" stroke="#b35f3a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
      { name: 'divider-ornate', label: '中心花饰分隔', w: 750, h: 160, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="750" height="160" viewBox="0 0 750 160"><defs><radialGradient id="of" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#f2c9a8"/><stop offset="1" stop-color="#c96f4a"/></radialGradient><linearGradient id="ovine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a7c59"/><stop offset="1" stop-color="#5f8d8a"/></linearGradient></defs><g fill="none" stroke="url(#ovine)" stroke-width="5" stroke-linecap="round"><path d="M375 80 L 300 80 Q 240 80 210 60 Q 180 40 120 48 Q 60 56 30 80"/><path d="M375 80 L 450 80 Q 510 80 540 60 Q 570 40 630 48 Q 690 56 720 80"/><path d="M300 80 Q 260 108 240 128"/><path d="M450 80 Q 490 108 510 128"/></g><g fill="url(#of)"><ellipse cx="375" cy="80" rx="19" ry="10" transform="rotate(-72 375 80)"/><ellipse cx="375" cy="80" rx="19" ry="10" transform="rotate(0 375 80)"/><ellipse cx="375" cy="80" rx="19" ry="10" transform="rotate(72 375 80)"/><ellipse cx="375" cy="80" rx="19" ry="10" transform="rotate(144 375 80)"/><ellipse cx="375" cy="80" rx="19" ry="10" transform="rotate(216 375 80)"/></g><circle cx="375" cy="80" r="9" fill="#d9a35f"/><g fill="#c96f4a"><circle cx="210" cy="60" r="5"/><circle cx="540" cy="60" r="5"/><circle cx="120" cy="48" r="4"/><circle cx="630" cy="48" r="4"/></g><g fill="#6f9e78"><ellipse cx="250" cy="118" rx="11" ry="6" transform="rotate(-30 250 118)"/><ellipse cx="500" cy="118" rx="11" ry="6" transform="rotate(30 500 118)"/></g></svg>' },
      { name: 'corner-flourish', label: '卷草角饰', w: 300, h: 300, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="cf" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#4a7c59"/><stop offset="1" stop-color="#5f8d8a"/></linearGradient></defs><g fill="none" stroke="url(#cf)" stroke-linecap="round"><path d="M62 262 C 62 160 150 70 252 62" stroke-width="16"/><path d="M66 266 C 80 180 150 110 230 100" stroke-width="8" opacity="0.7"/><path d="M252 62 Q 268 60 276 70" stroke-width="10"/><path d="M62 262 Q 58 246 70 240" stroke-width="10"/></g><g fill="#6f9e78"><ellipse cx="244" cy="90" rx="14" ry="7" transform="rotate(-40 244 90)"/><ellipse cx="80" cy="244" rx="14" ry="7" transform="rotate(35 80 244)"/></g><g fill="url(#cf)"><ellipse cx="276" cy="74" rx="12" ry="6" transform="rotate(-72 276 74)"/><ellipse cx="276" cy="74" rx="12" ry="6" transform="rotate(0 276 74)"/><ellipse cx="276" cy="74" rx="12" ry="6" transform="rotate(72 276 74)"/><ellipse cx="276" cy="74" rx="12" ry="6" transform="rotate(144 276 74)"/><ellipse cx="276" cy="74" rx="12" ry="6" transform="rotate(216 276 74)"/></g><circle cx="276" cy="74" r="6" fill="#d9a35f"/><g fill="#c96f4a"><circle cx="120" cy="90" r="7"/><circle cx="90" cy="120" r="5"/><circle cx="160" cy="70" r="4"/></g></svg>' },
    ]

    async function svgToPng(svg, w, h) {
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      try {
        const img = new Image()
        await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = url })
        const canvas = document.createElement('canvas')
        canvas.width = w * 2
        canvas.height = h * 2
        const cx = canvas.getContext('2d')
        cx.scale(2, 2)
        cx.drawImage(img, 0, 0, w, h)
        return canvas.toDataURL('image/png')
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    function Panel() {
      const [form, setForm] = React.useState({
        appid: '', secret: '', title: '', author: '', digest: '',
        markdown: '', cover_path: '', content_source_url: '', mode: 'auto',
        need_open_comment: false, only_fans_can_comment: false,
      })
      const [busy, setBusy] = React.useState('')
      const [result, setResult] = React.useState(null)
      const [html, setHtml] = React.useState('')
      const [showPreview, setShowPreview] = React.useState(false)
      const [artResult, setArtResult] = React.useState(null)

      const set = (k) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setForm({ ...form, [k]: v })
      }

      const call = async (method, extra) => {
        setBusy(method)
        setResult(null)
        try {
          const res = await host.call(method, { ...form, ...(extra || {}) })
          setResult(res)
          if (res && res.html) setHtml(res.html)
        } catch (e) {
          setResult({ ok: false, error: String((e && e.message) || e) })
        } finally {
          setBusy('')
        }
      }

      const renderArt = async (art) => {
        setBusy('art:' + art.name)
        setArtResult(null)
        try {
          const dataUrl = await svgToPng(art.svg, art.w, art.h)
          const res = await host.call('render-art', {
            ...form, name: art.name, png_base64: dataUrl.split(',')[1],
          })
          setArtResult({ ok: true, art: art, ...res })
        } catch (e) {
          setArtResult({ ok: false, error: String((e && e.message) || e) })
        } finally {
          setBusy('')
        }
      }

      const input = (k, label, ph, type) => React.createElement('div', { className: 'wxmp-row' },
        React.createElement('label', { className: 'wxmp-label' }, label),
        React.createElement('input', {
          className: 'wxmp-input', type: type || 'text', placeholder: ph || '',
          value: form[k], onChange: set(k),
        }))

      return React.createElement('div', { className: 'wxmp-panel' },
        React.createElement('div', { className: 'wxmp-title' }, '微信公众号推文工具'),
        React.createElement('div', { className: 'wxmp-grid' },
          input('appid', 'AppID', '公众号 AppID'),
          input('secret', 'AppSecret', '公众号 AppSecret', 'password'),
          input('title', '标题', '文章标题'),
          input('author', '作者', '可选'),
          input('digest', '摘要', '可选，≤120 字'),
          input('cover_path', '封面图路径', '本地图片路径，可选'),
          input('content_source_url', '原文链接', '阅读原文 URL，可选'),
        ),
        React.createElement('div', { className: 'wxmp-row' },
          React.createElement('label', { className: 'wxmp-label' }, '文章类型（排版设计）'),
          React.createElement('select', { className: 'wxmp-input', value: form.mode, onChange: set('mode') },
            React.createElement('option', { value: 'auto' }, '自动检测（推荐）'),
            React.createElement('option', { value: 'text' }, '文字类 · 简洁清晰'),
            React.createElement('option', { value: 'promo' }, '宣传类 · 生动层次'),
          ),
        ),
        React.createElement('div', { className: 'wxmp-row' },
          React.createElement('label', { className: 'wxmp-label' }, '评论设置'),
          React.createElement('label', { className: 'wxmp-check' },
            React.createElement('input', { type: 'checkbox', checked: form.need_open_comment, onChange: set('need_open_comment') }), ' 打开评论'),
          React.createElement('label', { className: 'wxmp-check' },
            React.createElement('input', { type: 'checkbox', checked: form.only_fans_can_comment, onChange: set('only_fans_can_comment') }), ' 仅粉丝可评论'),
        ),
        React.createElement('div', { className: 'wxmp-row' },
          React.createElement('label', { className: 'wxmp-label' }, '正文 Markdown'),
          React.createElement('textarea', {
            className: 'wxmp-textarea', rows: 8,
            placeholder: '# 标题\n\n排版语法：> [!TIP] 气泡框、::: card 标题/::: steps、---/***/___/~~~ 分割线、[[badge:文本]]、[[banner:主|副]]、==高亮==、![装饰](art://sprig-grass)\n\n**加粗**、*斜体*、`代码`、[链接](https://...)、列表、表格、``` 代码块 ```、![图片说明](C:/path/img.jpg)',
            value: form.markdown, onChange: set('markdown'),
          }),
        ),
        React.createElement('div', { className: 'wxmp-actions' },
          React.createElement('button', { className: 'wxmp-btn', disabled: !!busy, onClick: () => call('compose') }, '生成预览'),
          React.createElement('button', { className: 'wxmp-btn', disabled: !!busy, onClick: () => call('export') }, '导出 HTML 文件'),
          React.createElement('button', { className: 'wxmp-btn wxmp-primary', disabled: !!busy, onClick: () => call('draft') }, '写入草稿箱'),
          React.createElement('button', { className: 'wxmp-btn wxmp-primary', disabled: !!busy, onClick: () => call('publish') }, '发布（等待结果）'),
        ),
        React.createElement('div', { className: 'wxmp-row' },
          React.createElement('label', { className: 'wxmp-label' }, '美术资产（SVG→PNG 渲染并上传；正文用 ![说明](art://名称) 引用）'),
          React.createElement('div', { className: 'wxmp-arts' },
            ARTS.map((a) => React.createElement('div', { className: 'wxmp-artrow', key: a.name },
              React.createElement('span', { className: 'wxmp-artname' }, a.label),
              React.createElement('button', { className: 'wxmp-btn', disabled: !!busy, onClick: () => renderArt(a) }, busy === 'art:' + a.name ? '上传中…' : '渲染并上传'),
            )),
          ),
          artResult ? React.createElement('pre', { className: 'wxmp-result' },
            artResult.ok ? '[成功] ' + artResult.art.label + ' 已上传：\n' + artResult.url + '\n正文引用：![说明](art://' + artResult.name + ')' :
              '[失败] ' + (artResult.error || '上传失败')) : null,
        ),
        result ? React.createElement('pre', { className: 'wxmp-result' },
          typeof result === 'string' ? result : JSON.stringify(result, null, 2)) : null,
        html && React.createElement('div', { className: 'wxmp-row' },
          React.createElement('button', { className: 'wxmp-btn', onClick: () => setShowPreview(!showPreview) },
            showPreview ? '收起预览' : '显示 HTML 预览'),
        ),
        showPreview && html ? React.createElement('iframe', {
          className: 'wxmp-preview', srcDoc: html, title: '微信推文预览',
        }) : null,
      )
    }

    slots.inject('tool.view.cordis', () => slots.register(
      { name: 'tool.view.cordis', key: 'self' },
      () => React.createElement(Panel, null),
    ))

    styles.insert('.wxmp-panel{font-size:13px;color:var(--color-text, #333);max-height:560px;overflow:auto}.wxmp-title{font-weight:600;font-size:14px;margin-bottom:8px}.wxmp-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.wxmp-row{margin:6px 0;display:flex;flex-direction:column;gap:3px}.wxmp-label{font-weight:500;color:var(--color-text-secondary, #888)}.wxmp-input,.wxmp-textarea{width:100%;box-sizing:border-box;border:1px solid var(--color-border, #ddd);border-radius:4px;padding:5px 8px;font-size:13px;background:var(--color-background, #fff);color:var(--color-text, #333)}.wxmp-textarea{font-family:Consolas,Menlo,monospace;resize:vertical}.wxmp-check{display:inline-flex;align-items:center;gap:3px;margin-right:12px;color:var(--color-text, #333)}.wxmp-actions{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}.wxmp-btn{border:1px solid var(--color-border, #ccc);background:var(--color-background, #fff);color:var(--color-text, #333);border-radius:4px;padding:5px 12px;font-size:13px;cursor:pointer}.wxmp-btn:disabled{opacity:.5;cursor:not-allowed}.wxmp-primary{background:#07c160;border-color:#07c160;color:#fff}.wxmp-result{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:4px;padding:8px 10px;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:240px;overflow:auto;margin:8px 0}.wxmp-preview{width:100%;height:420px;border:1px solid #e1e4e8;border-radius:4px;margin-top:6px;background:#fff}.wxmp-arts{display:flex;flex-wrap:wrap;gap:6px}.wxmp-artrow{display:flex;align-items:center;gap:8px;border:1px solid var(--color-border, #eee);border-radius:6px;padding:4px 8px;background:var(--color-background, #fafafa)}.wxmp-artname{font-size:12px;color:var(--color-text-secondary, #666)}')
  },
}
````
