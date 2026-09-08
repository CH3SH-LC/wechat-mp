# 公众号推文助手桌面版 开发进度记录

> 本文件记录每次代码变更的完整过程。精简版见 PROGRESS-LITE.md。
> 新条目追加位置：在 `---` 分隔线之后、已有最新条目之前。

---

## 2026-09-08

### [New Feature] 第 32 轮：自动质检自检（检出即自动重写至合格）+ 修"叠两篇、预览取差稿"（用户口径确认驱动）

背景 / 变更原因：用户报「目前能检测到组件不足，就是不做」。真实会话审计（`s1788872582600968000`，21:20，军训+照片+"不全"补插画）定位：同一助手回合**叠了两篇 ```v2 正文**（半稿 + 终稿），预览只取**首个**围栏 → 差稿（容器 1、触发"组件化不足"）进预览、好稿（容器 2+timeline+角饰、无组件化不足）被吞；且质检 warning 只进 UI、从不驱动模型修正。用户口径确认（AskUserQuestion）：**自动重写到合格**——引擎检出可修复质量项就自动喂回模型重写，不再只亮红灯。

根因分析：
- **技术层（数据选错）**：`splitAssistant` 只取**首个** ```v2 围栏渲染/落库。修订/补全回合模型常"先写半稿、再写终稿"（末个围栏才是最终意图，证据：msg46 fence#1 容器 1 → 组件化不足；fence#2 容器 2+无组件化不足）——首个围栏契约在"一稿流"时代成立，多稿叠出后把最差那篇当正文。
- **流程层（无反馈回路）**：compose 的"组件化不足/素材缺失"等 warning 只显示在质量条，从不驱动模型改进；用户只能口头命令（"不全"），而口头命令又触发叠稿 → 死循环。
- **历史污染**：叠稿原文原样进会话历史，后续回合把多篇旧文都当上下文，越叠越乱。

修改文件：
- Modify: `src/lib/extract.ts` — `splitAssistant.v2` 改取**末个** ```v2 围栏（并加 `v2Count`）；新增 `collapseAssistantDraft(raw)`（>1 篇 v2 时归一为"说明文字 + 末稿单围栏"，防历史污染）；4 个使用点（renderV2/applySession/流尾/ChatPane 源码视图）自动生效
- Add: `src/lib/revise.ts` — `REVISE_MARKER='【自动质检】'`、`MAX_AUTO_REVISES=2`、`fixableWarnings(warnings)`（仅 组件化不足/未包含美术素材/素材用量偏低/照片位无装饰插画/气泡角饰 五类"改写法即可修"项触发；风格未收录/正文偏短/本地图不触发）、`buildReviseContent(v2, issues)`
- Modify: `src/App.tsx` — turn 尾段重构为**有界自检回路**：候选稿 materialize→compose → fixableWarnings → 空=终稿预览展示；非空且未达上限=清空气泡与预览、把质检问题清单喂回模型重写同一气泡（busy 保持、可手动停止）→ 重新质检；无 v2(对话)/达上限/用户停止即结束；落库前 collapse 归一。纯产物质量门禁，无任何对话状态机（不加澄清/路由/expectRef 态）
- Modify: `src/lib/chat.ts`（浏览器 mock 测试桩）— 末消息含 `REVISE_MARKER` → 返回合规 SAMPLE_V2；含"自检缺组件" → 返回 DEFICIENT_V2（容器 0、无素材、无气泡的缺组件样稿）
- Modify: `scripts/verify-ui.mjs` — 新增 S10：新建会话 → 发"军训慰问（自检缺组件）直接写" → mock 首稿不达标 → 自动重写 → 断言收敛到 q-ok、同一气泡（user=1/asst=1）、末稿为合规单稿
- Modify: `REQUIREMENTS.md` — 第 32 轮登记（口径确认后开发）

验证：
- `npx tsc --noEmit` / `pnpm build`：exit 0。
- extract/revise 单测（tmp 脚本）：splitAssistant 取末围栏（v2Count=2）、collapse 多稿→单稿/单稿不变、fixableWarnings 只取可修复项、revise 提示含标记/问题/单围栏指令 —— 全 PASS。
- `node scripts/compose-check.mjs`：COMPOSE OK。
- `cargo test --lib`：42 passed / 0 failed / 4 ignored（纯回归）。
- `node scripts/verify-ui.mjs docs/artifacts`（vite:1420）：VERIFY OK —— **S1-S10 全绿**，含 S10 自动质检自检（首稿缺组件→自动重写→q-ok 收敛/同气泡/合规单稿）；修复期间 S8 曾因"note 用闭包旧值把'注册表就绪'擦掉"回归、S10 曾因预览 HTML 为空致"清空"按钮 disabled，均已修（note 改 sessionNote 变量；S10 改新建会话）。
- 真实模型 `scripts/tmp-live-revise.mjs`（验证后删除）：把缺组件样稿 + 质检问题经 `buildReviseContent` 喂给真实 DeepSeek → **单 v2 围栏、组件化不足消除（容器 3）、风格/事实保留** LIVE-REVISE OK。
- release 重建：`pnpm tauri build --bundles nsis`（先停掉用户运行中的桌面实例解除 exe 占用）——release exe 14.9MB + setup 4.3MB；exe 启动冒烟存活后关闭 SMOKE OK。
- 文档：REQUIREMENTS（第 32 轮）/PROGRESS/PROGRESS-LITE/STRUCTURE 同步。待提交。

### [Debug] 第 31 轮：修复"依旧无法生成美术资产"——照片位与装饰插画并存口径（真实会话审计 + 用户口径确认驱动）

背景 / 变更原因：用户报「这一轮问题是，依旧无法生成美术资产。解决问题」。此为第 3 次同类复发（28/30/31 轮均指向"素材/美术生成"）。审计真实持久化会话：4 个同为"军训慰问+插入不少照片"的会话跨 28/29/30 三代构建，产出分别是【照片位N】纯文本 / 模型手写 `::: art` SVG / 正确 `::: photo` ×9（30 轮修复后）。**关键发现**：30 轮协议注入修复后模型已能稳定产出合规 `::: photo`，但凡是"用户要照片"的推文，全文只有空虚线照片占位框、零装饰插画——预览只见大片空框 → 用户感知"依旧无法生成美术资产"。用户口径确认（AskUserQuestion）：**"照片位 + 装饰插画都要"**。

根因分析（为什么 3 次复发、为什么之前没暴露）：
- **技术层（口径缺陷）**：第 28 轮口径 A 过度一刀切——engine-write-protocol §三.3 原文"用户会提供真实照片 → 用照片位 `::: photo`，**不再生成插画、不写 `[[img]]`**"。把"插照片"话意路由成全空照片位文章，装饰美术归零。第 30 轮的修复只解决了"协议缺失 → 写不出 `::: photo`"，没有动"有照片 → 不写插画"这条口径，所以合规占位越稳定，空框文章越多。
- **流程层（闸门盲区）**：live-conformance 场景 A 只断言"photo≥1 + 无兜底泄漏 + 无'未收录'回退"，从未断言"照片文章也应含装饰插画"；compose photoUsed 逻辑还全量抑制了"无素材"警告（28 轮为防误报加的）——于是"照片→零插画"从未被任何闸门拦下，反而被当成合规通过。28/30 两轮都验证了"占位语法正确"，却没人问"这推文到底有没有实际可见的图"。

修改文件：
- Modify: `src/knowledge/排版引擎/engine-write-protocol.md` — §二"图片"条：删除"确需真实配图用文字说明'此处建议配图：…'"，改指向 §三.3 并明令禁止文字说明占位；§三.3 配图来源分支重写为**并存口径**：用户给照片 → 真实画面用 `::: photo` 照片位（信息画面），**同时**用 `[[img]]/[[deco]]` 覆盖横幅/小节/气泡/分隔等组件装饰位（版面装饰）；照片多时插画 2-5 处即够、纯无照片才按 §三.1 的 5-8 处；照片位与插画同屏（约 120-150 字）不并存；"无照片严禁 ::: photo"反面约束保留
- Modify: `src/lib/persona.ts` — 需求澄清维度"配图来源"同步并存措辞（问清会不会给真实照片：会给 → 照片处留位 + 装饰插画照配；不会 → 全由系统生成插画）
- Modify: `src/lib/compose.ts` — 素材用量告警去 photoUsed 全量抑制：纯照片位且 arts=0 软提示"正文只有照片位、没有任何装饰插画（[[img]]/[[deco]]）"；照片+已落地插画并存时素材告警清零；无照片路径不变
- Modify: `scripts/live-conformance.mjs` — 场景 A 断言升级为"照片位 ≥1 且 [[img]]/[[deco]] ≥1"（并存）；场景 B（无照片零照片位）不变；头注释同步
- Modify: `scripts/compose-check.mjs` — photo 断言更新：纯照片位不报"未包含美术素材"硬错但软提示装饰插画；照片位 + 已落地 `::: art` → 素材告警清零（新增 2 项断言）
- Modify: `REQUIREMENTS.md` — 第 31 轮登记（先记录后开发补记）

验证：
- `npx tsc --noEmit` / `pnpm build`：exit 0。
- `node scripts/compose-check.mjs`：COMPOSE OK（新增 photo-only 软提示 + photo+art 并存零告警断言通过）。
- `cargo test --lib`：42 passed / 0 failed / 4 ignored（本轮无 Rust 改动，纯回归）。
- `node scripts/verify-ui.mjs docs/artifacts`（vite:1420 浏览器 mock）：VERIFY OK（S1-S9 全绿，含 S1.8 素材物料化渲染 data 图——预览链路未破坏）。
- 真实模型 `node scripts/live-conformance.mjs`：**CONFORM OK**——场景 A（用户给照片，复刻真实军训需求）产出 **photo=6 + [[img]]=4 + [[deco]]=1**，照片位与装饰插画并存、0 文字说明占位、风格命中校园、虚线照片位正常渲染；场景 B（无照片）[[img]]=4/[[deco]]=1、零照片位，语义保持。
- release 重建：`pnpm tauri build --bundles nsis`（首跑因用户桌面端实例仍在运行占用 exe os error 5，停进程后重跑成功）——release exe 14.9MB + setup 4.3MB；exe 启动冒烟存活后关闭 SMOKE OK。
- 文档：REQUIREMENTS（第 31 轮，状态完成）/PROGRESS/PROGRESS-LITE/STRUCTURE 同步。待提交。

### [Debug] 第 30 轮：修复"又生成不了美术素材"（真实持久化会话审计驱动）+ SSE 中文乱码

背景 / 变更原因：用户报「能不能读取本地记录，为什么又生成不了美术素材了？修复这个问题」。读取本地记录定位：PROGRESS 第 15/24/28 轮均处理过"素材生成"回归，本轮"又"复发。审计最新真实持久化会话（`Documents/wechat-mp-workspace/sessions/s1788797870699219000.json`，2026-09-08 01:40 军训慰问多轮会话）定位 4 根因：

1. **SSE 流式中文乱码（数据损坏，代码层面确凿）**：`chat.rs` stream_chat 对每个网络 chunk 独立 `String::from_utf8_lossy`（`buf.push_str(&String::from_utf8_lossy(&chunk))`）——reqwest/TCP chunk 边界若把多字节 UTF-8 中文（3 字节）劈成两半，两半各自解码都产生 U+FFFD。真实会话跨历史存在（4/15/31 处乱码），本轮最新稿 15 处，标题"训练场�"即成残字。
2. **prep 空回复→兜底话术泄漏（msg24/28 症状）**：多轮澄清会话中 prep_turn（v4-flash + max_tokens 1200）偶发空 content（推理吃光预算，第 13-16 轮同族问题）→ `prep.ts` runPrep 旧逻辑 `text || '（请补充需求，我再开始创作）'` 把它当 ready:false 文本返回 → App 当助手消息展示给用户。该兜底话术无"？"→ 下一回合 needPrep 判定 `lastAssistant.content.includes('？')` 失效 → 衍生根因 3。
3. **引擎协议注入空洞（素材/照片位灭失主因）**：第 29 轮 persona 精简后，v2 语法/`::: photo`/`[[img]]`/`[[theme]]` 占位全部只存在于知识文件 engine-write-protocol.md，且 App 仅在 `prep.ready` 分支强制附加。创作会话内"延续句"（msg29"哪里缺乏内容了"，isCreateRequest=false 且上一条兜底无"？" → needPrep=false）走 baseMsgs 直接流式、上下文无引擎协议 → 模型不知照片位语法 → 最终成稿（msg30）写【照片位N｜建议画面…】纯文本而非 `::: photo`，美术素材/照片位全灭。
4. **gen_svg 瞬态空结果（防御）**：live 首跑 36s 无 SVG 无 CLARIFY（重跑成功）→ 真实链路偶发素材标失败。

实现：
1. Modify `src-tauri/src/chat.rs` — 重构 stream_chat：字符串逐块解码改为**字节缓冲 `feed_sse_bytes(buf:&mut Vec<u8>, chunk:&[u8], on_delta)`**，只对以 `\n` 结尾的完整行一次性 `from_utf8_lossy` 解码（行内绝不含 0x0A，不会劈字符）；EOF 残留仍冲刷。新增 2 单测：`sse_multibyte_split_across_chunks_not_corrupted`（首块只含"你"首字节 E4、无换行不产出，第二块补齐后整行解出"你"、零 U+FFFD）、`sse_multiple_deltas_across_arbitrary_splits`（每 3 字节切一刀必劈到中文仍一致）。request_prep max_tokens 1200→3200（防推理吃光致 prep content 空）。
2. Modify `src/lib/prep.ts` — runPrep 循环：无 tool_calls 且正文为空（模型瞬时空回复/推理吃光）→ **continue 重试**（不返回兜底话术）；多轮仍未收敛 → exhausted 降级直接撰写（ready:true，带已取 digest）。非空澄清正文仍原样返回。兜底话术不再出现在任何用户可见助手消息。
3. Modify `src/App.tsx` — 新增 `creativeSession = history.some(user 且 isCreateRequest)` 判定；prep 分支之后、流式之前：`inTauri && creativeSession && !needPrep && 上下文无 engine-write-protocol` → 注入引擎协议 user 消息（标注"若本回合决定撰写 v2 正文围栏，按协议产出 v2 语法与美术占位/照片位"）。不打断澄清链、不新增对话状态机（纯上下文注入，消息直通模型）。
4. Modify `src/lib/image-agent.ts` — generateSvg 重构为 callOnce 二次：CLARIFY→refine_brief→重试逻辑保留；结果非法（无 viewBox/<6 元素/空）或 invoke 失败 → **原样重试一次**再判失败（瞬态防御）。浏览器 mock 路径不变。

验证：
- `npx tsc --noEmit` / `pnpm build`：exit 0。
- `cargo test --lib`：42 passed / 0 failed / 4 ignored（新增 2 SSE 跨 chunk 单测确认运行）。
- `node scripts/compose-check.mjs`：COMPOSE OK。
- `node scripts/verify-ui.mjs docs/artifacts`（vite:1420 浏览器 mock）：VERIFY OK（S1-S9 全绿，App.tsx 改动不破坏回归；creativeSession 注入仅 inTauri 生效，浏览器路径跳过）。
- 真实模型 `node scripts/live-conformance.mjs`：CONFORM OK（A 校园 7 `::: photo` 0 泄漏 / B [[img]]4+[[deco]]1 0 照片位 0 泄漏；首跑 A 偶发 fenceV2=false 为模型 flaky，重跑通过）。
- 真实链路复刻 `scripts/tmp-regress-reg.mjs`（针对两处绕过 live-conformance 的修复，验证后删除）：
  - 场景 C（多轮澄清链 + prep 空回复逻辑）：兜底话术未泄漏进任何助手回复，prep 最终收敛到 ready（rounds=3）——根因 2 修复生效。
  - 场景 D（创作会话延续句注入引擎协议）：产出 7 个 `::: photo` 照片位、0 兜底泄漏、0 U+FFFD、compose 渲染虚线占位——根因 3 修复生效（此前该链路产出【照片位N】纯文本）。
  - REGRESSION OK。
- 文档：REQUIREMENTS（第 30 轮）/PROGRESS/PROGRESS-LITE/STRUCTURE 同步。待提交。
- [Build 补记] 第 30 轮后 release 重建——`pnpm tauri build --bundles nsis`：release exe 14.2MB + setup 4.1MB（2026-09-08 02:22，含 30 轮全部改动）；release exe 启动冒烟存活后关闭 OK。首跑因第 29 轮 00:15 冒烟遗留的旧 exe 仍在运行（文件占用 os error 5）失败，停进程后重跑成功。



背景 / 变更原因：用户审阅 `docs/ai-context/` 四份「注入给模型的内容」清单后给出意见并拍板三项路线（AskUserQuestion）：①persona 大幅精简至 ~30%、定位从"纯公众号排版专家"改为"通用 AI 助手 + 少量公众号能力"，工艺细则**迁知识库按需取用**（不就地删除靠引擎兜底）；②输出像正常助手——不再"只输出代码块不要解释"，允许正文前自然说明；③澄清是"真正理解"而非"按维度收问卷"，可跨轮追问；④图像子智能体 SVG 复杂度要求大幅上调（现要求只是地板）；⑤子智能体要向主智能体反要更清晰 brief，走**有界回问回路**；⑥不需要 mock——只删**用户可见演示**，内部测试桩保留。

根因分析（既有设计与用户取向的落差）：
- persona 与 round 25"注册表+按需取用"理念不一致——仍把 v2 语法表/素材铁律 v5/间距审美 v10/风格选型整套常驻 system，既占 token 又让 persona 读起来是"排版专家手册"而非通用助手；
- WRITE_INSTRUCTION「只输出代码块、不要解释」压过 persona 允许的 ≤2 行说明，成稿观感机器化（splitAssistant 早已支持 prose+```v2 共存，技术上无必要禁说明）；
- 澄清虽是 persona 层面允许多轮，但 PREP 的"不明确→问一轮即结束 / 明确→READY"二元措辞促成"一轮就开工"，未真正理解就出稿；
- SVG_SYSTEM_PROMPT 只写 ≥6 元素等最低门槛，把"能通过"当"该达到"，无构图/明暗/材质/细节密度要求；
- gen_svg 是单向一次性调用，说明不足只能硬画/画歪，子智能体无任何通道向"写了这行占位的主模型"追问；
- 浏览器 mock（示例/违规按钮、SAMPLE/BAD、样例池）在桌面产品中无用户价值，还让 E2E 语义依赖点按钮。

实现：
1. **persona 精简**：`src/lib/persona.ts` PERSONA_RULES 重写为 ~30%——通用助手身份（"像任何好用的助手一样自然对话…由你自主判断"）+ 对话/创作判断 + 理解型澄清 + 创作细则指针 + 输出协议（允许 ```v2 前自然说明）；删除常驻的 v2 语法表/素材铁律/间距审美/结构/风格细则。兼容导出 buildSystemPrompt/KnowledgePick 保留（live 脚本引用）。
2. **工艺细则迁知识库**：新增 `src/knowledge/排版引擎/engine-write-protocol.md`（桌面 compose v2 引擎唯一权威协议：产出形态/语法表/美术图位与照片位/结构语气审美/风格声明）；`retrieval.ts` 注册表把「排版引擎」组置顶（防 3500 字截断吞掉）、新增 `loadEngineProtocol()`；`App.tsx` prep.ready 撰写路径若 digest 未含引擎协议则 `loadEngineProtocol` 强制附加（compose 正确性不依赖模型自觉 load）。
3. **输出/澄清（2.1/2.2）**：`prep.ts` PREP_INSTRUCTION 改为"必取 engine-write-protocol + 按需取 type/style/comp/copy；未理解可跨轮自然追问，理解或授权后 READY"；WRITE_INSTRUCTION 改为"正文 ```v2 围栏，正文前可自然说明"。
4. **SVG 复杂度契约（3.1）**：`chat.rs` SVG_SYSTEM_PROMPT 重写为复杂度契约（分层构图/物体结构轮廓与明暗体积/材质纹理/细节密度：横幅 20+/小图 10+，≥6 只是门槛）；补单测 `svg_prompt_requires_layered_complexity`。
5. **子问主有界回问（3.2）**：`chat.rs` SVG 提示第 10 条 CLARIFY 追问协议；`extract_clarify` 识别 `CLARIFY:`（单测 `clarify_extracted_from_image_agent_reply`）；gen_svg 重构为取全文→CLARIFY 优先返回/否则抽 SVG（删重复 complete_svg，svg_from_response 转 #[cfg(test)]）；新增 `refine_brief` 命令（主模型 cfg.model 把说明补成可作画 brief）+ 注册 lib.rs 14 命令；`image-agent.ts` generateSvg 检测 CLARIFY → invoke refine_brief → 重试 gen_svg 一次，仍追问则按失败处理。
6. **删用户可见 mock（4）**：`ChatPane.tsx` 移除「示例：开学典礼宣传」「演示：违规输出检测」按钮与 MOCK_TOPICS import；QUICK_PROMPTS 保留。`chat.ts` mock/SAMPLE/BAD、样例 SVG 池、`needs.ts` 保留为内部测试桩；`verify-ui.mjs` S1/S1.9/S2 触发从点 `.chip` 改为 `sendPrompt()` 输入框发文本。
7. **验证闸门**：`live-conformance.mjs` 注入 engine-write-protocol 全文进 system（等价 prep 已取用，否则精简 persona 下模型不知道 v2 语法）+ **修复既有历史累积 bug**（原 chatUntilArticle 第 2 轮用"请勿再澄清…"覆盖原始需求、丢 userA → 模型瞎选风格/无照片位；改累积对话历史）。

验证：
- `npx tsc --noEmit` / `pnpm build`：exit 0。
- `cargo test --lib`：40 passed / 0 failed / 4 ignored（+2：SVG 复杂度契约、CLARIFY 提取）。
- `node scripts/compose-check.mjs`：COMPOSE OK。
- `node scripts/verify-ui.mjs docs/artifacts`（vite:1420 纯浏览器 mock）：VERIFY OK（S1/S1.9/S2 已走 sendPrompt 文本驱动；S1.8 五 data 素材、S2 检出 4 问题、S7/S8/S9 全绿）。
- 真实模型 `node scripts/live-conformance.mjs`：**CONFORM OK**——A（军训慰问，校园 7 照片位，无兜底泄漏，无"未收录"回退，虚线占位渲染）；B（咖啡上新，[[img]]=4/[[deco]]=1、0 照片位、0 泄漏、风格被识别）。证明精简 persona + 引擎协议注入下产物仍合规。
- 修复 live-conformance 历史 bug 后该脚本现能正确模拟多轮（此前第 28 轮场景 A 因模型首轮直出而掩盖此缺陷）。
- REQUIREMENTS/STRUCTURE/PROGRESS/PROGRESS-LITE/docs(ai-context 四份+inventory) 已同步。待提交。
- [Build 补记 2026-09-08 00:15] 第 29 轮后全功能 release 重建——`pnpm tauri build --bundles nsis`：release exe 14.9MB + setup 4.3MB（含 29 轮 persona 精简/引擎协议知识/refine_brief/复杂度契约/mock 删按钮改动）；release exe 启动冒烟存活后关闭 OK（libpng iCCP sRGB 警告为图标元数据无害）。
- [规则] 用户 2026-09-08 明确"每次更新都需要更新这里的桌面版"——新增 **CLAUDE.md 铁律 7 + REQUIREMENTS 〇节 2（永久禁令）**：凡代码变更验证通过后必须 `pnpm tauri build --bundles nsis` 重建 release + 启动冒烟，target/release 始终与代码同步（第 29 轮曾漏建，用户指出后补建）。

### [New Feature] 第 28 轮：真实产物合格性修复 + 验收闸门（用户实机审计驱动）

背景 / 变更原因：用户在 release 实机反馈"基本什么都不符合要求"。审计真实持久化输出（Documents/wechat-mp-workspace/sessions）定位 4 根因：①风格别名不识别（真实输出 `[[theme:校园风]]` 匹配不上 → 静默回退默认色）；②prep 工具循环 3 轮不收敛把兜底话术「（请补充需求，我再开始创作）」当正式回复、导致多轮 `？` 后乱出稿；③配图来源未澄清——用户"要真实照片/留占位"时产物既无素材也无照片位；④验证体系盲区：E2E 只跑浏览器 mock、live 只证能力不证产物合规、release 冒烟只验进程存活。
口径确认（用户）：照片占位 = A（正文放可替换照片位，发布前换真图），非自动生成插画。

实现：
- Modify: `src/lib/palettes.ts` — 风格名归一 normalizeStyleName（去尾缀 风格/风/風 再匹配），resolveTheme 走 paletteByName；`校园风/国潮风/日系风` 不再落空
- Modify: `src/lib/compose.ts` — 新增 `::: photo 说明\n…\n:::` 照片位块（虚线占位框【照片位】+ 提示文字）；正文含 photo 位时抑制"未包含美术素材/用量偏低"误报
- Modify: `src/lib/persona.ts` — 美术素材铁律 v5 补第 5 条"配图来源分支"：真实照片→`::: photo` 占位（不生成插画）；无照片→`[[img]]/[[deco]]` 插画；可混用但同屏不并存；附**反面约束**：用户无照片时严禁 `::: photo`
- Modify: `src/lib/prep.ts` — 工具循环 3 轮不收敛改为降级 `ready:true+exhausted`（带已取知识摘要直接撰写），不再把兜底话术当正式回复
- Add: `scripts/live-conformance.mjs` — 真实模型 → 排版引擎 → 规范断言验收闸门（场景 A 真实照片 / 场景 B 无照片走插画；断言：无兜底话术泄漏、photo/[[img]] 分支正确、声明风格被识别渲染、无"无素材"误报）
- Modify: `scripts/compose-check.mjs` — 新增断言：校园风→校园色板无回退警告、photo 块渲染、photo 抑制无素材误报

验证：
- compose-check 全绿（含 alias/photo 新增 4 项）；pnpm build exit 0；cargo 38/38；E2E 全绿（S1-S9 语义不变）
- live-conformance 真实 DeepSeek：A 场景产出 7 个 ::: photo、0 文字说明、theme 命中 campus、无泄漏；B 场景产出 [[img]]=3/[[deco]]=1、0 照片位、无泄漏 → CONFORM OK（先于本轮，模型偶发先澄清 1 轮——脚本已按真实多轮模拟到出稿）
- 文档：STRUCTURE（live-conformance/compose photo）、REQUIREMENTS/PROGRESS-LITE 同步

---

## 2026-09-06

### [Build] 第 27 轮后全功能 release 重建（用户「我的桌面端入口呢 / 重建」）

背景 / 变更原因：既有桌面可执行/安装产物停留在第 8 轮（2026-09-05），第 9-27 轮全部功能未进入；用户需要最新桌面端入口。

实现：
- `pnpm tauri build --bundles nsis`：前端 build → Rust release（1m43s）→ makensis 打包

验证：
- release exe：`src-tauri/target/release/wechat-mp-desktop.exe`（14,840,320 B，2026-09-06 23:46）
- setup：`src-tauri/target/release/bundle/nsis/wechat-mp-desktop_0.1.0_x64-setup.exe`（4,314,395 B）
- 启动冒烟：release exe 拉起存活 5s 后正常停止（SMOKE OK）；产物不入库

### [Change] 第 27 轮：全项目结构重构（技术债清理，零行为变化）

背景 / 变更原因：用户「重构整个项目」。经评估界定为可审计、零行为变化的全项目结构与技术债清理（不重写产品语义）——第 25 轮知识工具化后，旧"请求前条件注入"整段成为死代码；UI 去控件后遗留样式与休眠监听仍在；O-8 SSE EOF 残留不解析。

实现：
- Modify: `src/lib/retrieval.ts` — 删除第 20-21 轮整段死代码：retrieve()/RetrievalResult/TYPE_FILE/TPL_FILE/AD_TYPES 及其 assess、isCreateRequest 导入；头注释更新为"注册表 + 工具"语义（保留懒加载缓存、TOPIC_MAP/bigrams——runKnowledgeTool 的 search 仍用）
- Modify: `src/App.tsx` — 删除休眠 chat-error 监听（Rust 从不 emit，错误经 sendChatRust 抛错→catch→fail；O-3）
- Modify: `src/App.css` — 删除第 23 轮移除控件后遗留的模式/风格控制条样式块（chat-controls/ctrl-*/seg/style-select）
- Modify: `src-tauri/src/chat.rs` — O-8 修复：SSE 流结束后残留 buffer（末块无尾换行）现被冲刷解析；抽出纯函数 sse_tail_delta + 单测

验证：
- cargo 38/38（新增 sse_tail_delta 1 项）；pnpm build exit 0；compose-check OK；verify-ui E2E 全绿（S1-S9 语义不变，无 .style-select/.seg-btn 引用残留）；cargo build 桌面 app 编译通过
- 文档：STRUCTURE retrieval 注释、REQUIREMENTS/PROGRESS-LITE 同步

### [New Feature] 第 26 轮：微信草稿箱发布（需求文档 v2 修订 1 落地，本地门禁全绿，真实接口 LIVE-PENDING）

背景 / 变更原因：成稿除复制/导出外需能直达公众号草稿箱——应用内配置 AppID/AppSecret，正文 data 图上传为微信永久素材并替换引用，再 draft/add 入草稿箱。当前环境无微信测试号/外网授权，真实接口链路无法验证；网络层按官方接口实现，逻辑层做成纯函数并用单测覆盖。

实现：
- Add: `src-tauri/src/publish.rs` — WeChatClient（默认 api.weixin.qq.com）；纯函数 parse_token/extract_data_image/build_draft_json/resolve_title/urlencode/plain_text；get_token（GET cgi-bin/token，urlencode）→ upload_material（multipart POST material/add_material?type=image，字段 media、.png、image/png）→ draft_add（POST draft/add）→ media_id；access_token 缓存（Tauri Mutex + Instant，提前 60s 过期；40001/42001 清缓存重试一次）；data 图按偏移重建正文（成功换微信 url，失败保留并告警）；command `publish_draft(html,title)`（读 wx_appid/wx_secret，缺失给可读中文 Err）；9 纯函数单测
- Modify: `src-tauri/src/settings.rs` — AppSettings 增 wx_appid/wx_secret（Option+default，旧文件兼容；空=未配置）；lib.rs 注册 publish_draft + setup manage WxTokenState（命令共 13）
- Modify: `src-tauri/Cargo.toml` — reqwest 加 "multipart"，加 base64 0.22
- Modify: `src/lib/settings.ts`、`src/components/SettingsPanel.tsx` — AppSettings 增 wxAppid/wxSecret，设置面板加"公众号配置（草稿箱发布）"区块（AppID/AppSecret 掩码，随保存/恢复默认）
- Modify: `src/App.tsx`/`src/components/PreviewPane.tsx` — App 提供 publishDraft（invoke publish_draft，非 Tauri 报"发布需桌面模式"）；PreviewPane 桌面模式渲染「发布到草稿箱」按钮（disabled 无 html/发布中），结果 pub-ok/pub-fail 显示、失败不丢产物
- Modify: `src/App.css` — .settings-sep/.mini-publish/.publish-msg 样式

验证：
- cargo 37 passed（26 旧 + publish 9 + settings 1 + 本地假微信服务器端到端契约单测 1）+ 2 live ignored（既有 chat 冒烟联网通过）；pnpm build exit 0；compose-check OK；verify-ui E2E 全绿（浏览器 mock 不渲染发布按钮，其余场景回归）；`cargo build`（桌面 app 二进制）编译通过
- LIVE-PENDING（见 publish.rs 注释）：封面 thumb_media_id 待用户公众平台填；multipart data 图子类型/文件名；token 过期整体重试幂等；draft/add 返回体与字段以微信测试号核对；未 git 提交

### [Change] 第 23-25 轮真实模型 live 闭环（联网验证）+ gen_svg 图像模型修正

背景 / 变更原因：补上 23-25 轮"真实模型 live 待联网验证"。用真实 DeepSeek 直跑：①persona v5 模糊创作→澄清；②明确创作→知识工具自选→digest 续写（验证被指出的"带工具历史但不带 tools 流式 400"风险路径）；③gen_svg 真实画图。

发现与修复：
- Modify: `src/lib/prep.ts`/`src/App.tsx` — 最终撰写从"透传 prep 的 assistant tool_calls/tool 消息给 stream_chat"改为"把实际取用结果拼成知识摘要 digest，随撰写指令作为普通 user 消息进上下文"（DeepSeek 对"含工具历史但请求不带 tools"的续写有 400 风险；digest 方案彻底规避，且不影响用户可见回合）
- Modify: `src-tauri/src/chat.rs` — ①新增 2 个 `#[ignore]` live 测试（live_clarify_tools_then_digest_write / live_gen_svg_draws_concrete_illustration）；②**图像子智能体改专用模型 `deepseek-chat`**（可用 DEEPSEEK_IMAGE_MODEL 覆盖）——实测 deepseek-v4-flash（reasoning_effort max/low）画 SVG 会推理失控吃光预算、content 为空；deepseek-chat 11s 直出 53 元素完整 SVG；③svg 无结果错误附响应片段便于定位

验证（真实 DeepSeek，4/4 live 通过）：
- live 澄清：模糊"新书上市"→模型输出多维度澄清问句（含问号、无正文/工具）——第 23 轮"需求未齐不产出"成立
- live 工具：明确"咖啡开业·日系·800字"→模型主动调用 load_knowledge（style-japanese / type-promo / copy-tpl-promo / comp-banned 4 个点）——第 25 轮"注册表+模型自选工具"成立
- live digest 续写：不带工具历史的流式请求 200，产出 3422 字符 ```v2 正文、首行声明 [[theme]]——400 风险路径已闭环
- live gen_svg：deepseek-chat 产出 viewBox=0 0 750 220、53 个可见图形元素的咖啡店门头 SVG（10.99s）
- 全量：cargo 36/36 + live 4/4；pnpm build + compose-check + E2E 全绿

### [New Feature] 第 25 轮：知识注册表 + 模型按需工具取用（DeepSeek function-calling，替代请求前 topK 大段注入）

背景 / 变更原因：需求文档 v2 修订 7（▲）落地——原实现是"请求前 `retrieve()` 一次性拼 topK 点文件大段节选注入 system"（内容/风格/合规一次全塞、越写越臃肿）。改为 system 只注入 ≤3500 字符的**知识注册表（目录）**；创作前置由 DeepSeek function-calling 让模型自行决定读取哪些点文件（load_knowledge / search_knowledge），取完输出 READY，再携带工具结果流式成稿。属"模型发起 tool_calls → 前端机械执行本地知识工具 → 回传 tool 结果"的确定性循环，非对话路由，不违反铁律 6。

实现：
- Modify: `src-tauri/src/chat.rs` — ChatMsg 扩展：content 改 Option<String>，新增 tool_call_id/tool_calls（OpenAI 兼容，可承载 tool 回合）；新增非流式命令 `prep_turn`（复用 resolve_config；POST /chat/completions body 顶层带 tools、stream:false、max_tokens=1200、省略 reasoning_effort）；`parse_prep_reply` 纯函数解析 choices[0].message 的 content 与 tool_calls；新增 PrepReply/ToolCall/ToolCallWire serde；既有 ChatMsg 构造点改 Some(...)；新增 5 个单测（工具调用解析/纯文本解析/READY 标记/非法 JSON/消息序列化往返）
- Modify: `src-tauri/src/lib.rs` — 注册 prep_turn（命令共 12 个）
- Modify: `src/lib/retrieval.ts` — 新增 `buildRegistry()`（缓存条目按子方向分组压缩成"name｜短标"目录、总量 ≤3500、超长截断注记）与 `runKnowledgeTool()`（load_knowledge→点文件全文截 6000 字符；search_knowledge→TOPIC_MAP + 二元组近似返回 ≤6 命中；参数去引号/大小写容错、执行不抛错）；保留 ensureKnowledgeLoaded 缓存与旧 retrieve 导出
- Modify: `src/lib/persona.ts` — PERSONA_RULES 末尾"知识库参考（按任务路由注入）"改写为"知识工具（创作前按需取用）"用法说明；新增 `buildRegistrySystem(registry)`
- Add: `src/lib/prep.ts` — `runPrep(messages)`：桌面工具取用循环 ≤3 轮（tool_calls→本地执行→回传 tool 结果；无 calls 输出 READY 或澄清文字）；浏览器直接 `{mode:'skip'}`；导出 PREP_INSTRUCTION / WRITE_INSTRUCTION / PrepOutcome
- Modify: `src/App.tsx` — turn 去掉 retrieve/buildSystemPrompt 大段注入，改 system=`buildRegistrySystem(buildRegistry())`；`needPrep=isCreateRequest(raw)||历史上一条 assistant 含 '？'`，桌面 needPrep 走 runPrep——READY→把实际取用知识拼成 digest + WRITE_INSTRUCTION 一起流式（不透传工具回合，规避 DeepSeek 工具历史 400）；澄清→追加 assistant 消息并结束本回合（不做预览）；prep/工具失败→退化无 prep 流式；知识注记改"注册表就绪 · N 字符目录"
- Modify: `src/lib/chat.ts` — ChatMsg 支持 role 'tool' / content nullable / tool_calls；sendChatMock 对空 content 加守卫（浏览器语义不变）
- Modify: `scripts/verify-ui.mjs` — S8 知识注记断言由"3 层路由命中（内容类型:promo/合规红线/风格速查）"改为"注册表就绪"（路由命中注记已随注入机制退役）

验证：
- cargo test 26 通过（21 旧 + 5 新 prep 单测；2 live ignored 未联网）
- pnpm build exit 0；compose-check 全绿；verify-ui E2E 全绿（S1/S1.5-S1.9/S2/S7/S8/S9）
- buildRegistry 实际输出 3495 字符（≤3500 预算）
- 真实模型桌面 live（联网）建议验证见最后一段；未 git 提交

### [Change] 第 24 轮：美术素材改图像子智能体产出（需求文档 v2 修订 8 落地）

背景 / 变更原因：把"画 SVG"从主模型剥离——主模型只写**图位占位**，正文产出后由**图像子智能体**按占位清单逐个独立生成具体插画 SVG（校验 ≥6 元素 + viewBox），经 artRender 转 PNG data URI 回填后 compose 渲染。降低主模型输出量与中途跑题/超长风险（busy 素材生成期维持"正在生成…"）。

实现：
- Modify: `src/lib/persona.ts` — 素材铁律 v4→v5：主模型不内联 SVG，改整行占位 `[[img:wide|说明]]`/`[[img:inline|说明]]`、气泡角饰 `[[deco:名称|说明]]`+`> [!KEY|名称]`；占位说明=给画图子智能体的可执行描述（对象/用途/意象/风格）；画图约束（具体插画/≥2 层明暗/零文字零 emoji/低饱和 ≤4 色/元素≥6）留给子智能体
- Add: `src/lib/image-agent.ts` — `hasPlaceholders`/`materializePlaceholders(v2,theme)`：扫占位→逐个 `generateSvg`（桌面 invoke Rust `gen_svg`；浏览器用 3 张本地样例池+短延迟近似）→ 校验 → 替换为完整 `::: art`/`::: art deco` 块
- Add: `src-tauri/src/chat.rs` — 非流式命令 `gen_svg(kind,desc,theme)`：专用"图像子智能体"系统提示（一次一幅具体插画、viewBox、可见元素≥6、SVG 零文字、只输出 <svg>…</svg>）；complete_svg 非流式调用（stream:false、max_tokens=4000、不带 reasoning_effort）；extract_svg 抽 SVG；新增 4 单测
- Modify: `src-tauri/src/lib.rs` — 注册 gen_svg；`src-tauri/Cargo.toml` — 加 regex 依赖
- Modify: `src/App.tsx` — 流中 resolvePreview 对含占位正文返回 null（不渲染字面量）；turn 收尾先 materializePlaceholders 再 compose+终检，busy 保持到素材生成完；applySession 恢复含占位会话同样先 materialize
- Modify: `src/lib/chat.ts` — 演示样本改图位占位写法（去掉内联 SVG 常量）

验证：
- pnpm build exit 0；compose-check 全绿；verify-ui E2E 全绿（新增 S1.8 placeholders materialized、S1.9 无控件+busy 生成文案）
- cargo 26 通过（21 旧 + gen_svg 4 + prep 1 后续合并前为 21+4）
- 真实模型桌面 live（素材来自图位 + gen_svg 联网画图）待联网验证；未 git 提交

### [Change] 第 23 轮：界面去控件 + LLM 自决 + busy 两档 + persona v5（需求文档 v2 修订 3/4/5/6 落地）

背景 / 变更原因：需求文档 v2 修订落地第一批——界面删除"模式三段按钮与风格下拉"（类型与风格交 LLM 自决）；创作前"需求全澄清、未决不产出"（非只问 1 个）；风格不限预置（非预置可用 [[palette]] 自定义色板渲染）；busy 分"思考/澄清中"与"生成中"两档；统一 persona 字数口径（修 O-1）。

实现：
- Modify: `src/components/ChatPane.tsx` — 删除模式/风格控件及类型导出；busy 两档文案（think='正在思考…'/gen='正在生成…'，以当前在途消息是否已打开 ``` 围栏派生，仅展示非状态机）；空态文案更新
- Modify: `src/App.tsx` — 移除 mode/style 状态与 decoratePrompt/STYLE_PHRASE/VALID_*；resolvePreview 不再传 UI 主题（主题只来自正文声明）；保存恒为 mode/style='auto'（旧会话仍兼容）
- Modify: `src/lib/persona.ts` — 对话判断改 v5：创作先澄清，逐维度问清（一次可问多要点、可小结再补问），任一相关维度未明确且未获"你定"授权不得产出；风格规则改自决+声明 [[theme]]、非预置须自带 [[palette]]；输出默认字数口径统一 1500-2500（删 800-2000 旧口径）
- Modify: `src/lib/palettes.ts` — 新增 themeDeclaration()/parsePaletteDirective()（自定义色板解析，#rgb/#rrggbb 校验）
- Modify: `src/lib/compose.ts` — makeDesign 支持 custom 色板覆盖（text/promo 各自键集 + bg）；跳过 [[palette:…]] 行；未知风格名且无自定义色板 → 警告并回退默认双色系
- Modify: `scripts/compose-check.mjs` — 新增 palette 渲染 / 未知风格警告断言；`scripts/verify-ui.mjs` — 新增 S1.9（无控件 + busy 生成文案）

验证：
- pnpm build exit 0；compose-check 全绿（含 5 项新增 palette/未知风格断言）；verify-ui E2E 全绿（含 S1.9）
- 真实模型桌面 live（自决风格声明/非预置色板/澄清多轮）待联网验证；未 git 提交

### [Change] 撰写按理解还原的需求文件 docs/REQUIREMENTS-understanding.md（文档轮，无代码变更）

背景 / 变更原因：用户「阅读整个文件夹，搞清楚这个项目，生成一份按你理解的需求文件」。项目已有 REQUIREMENTS.md（轮次登记册，记录"历次改了什么"），缺一份"截至第 22 轮后产品现状"的完整需求规格。产物定位为按理解重建的需求文件，供对照/校错/后续迭代引用，与登记册并存。

实现：
- 通读四文件体系（CLAUDE/STRUCTURE/PROGRESS-LITE/REQUIREMENTS 0-22 轮全史）+ README
- 派 3 个并行子智能体精读三层源码（前端组件与传输层、compose/theme/art/quality 管线、Rust 后端与配置），自读产品中枢 App.tsx/persona.ts/retrieval.ts
- 撰写 docs/REQUIREMENTS-understanding.md：项目定位（目标/非目标/铁律）、双形态架构与数据流、FR-A 工作台对话 / B 生成引擎 / C 知识检索 / D 多会话 / E 预览导出设置 / F 质量护栏、领域模型、NFR、技术决策、10 条代码读后观察待议（O-1…O-10）、验证方法
- 观察要点摘录：O-1 persona 字数口径 800-2000 vs 1500-2500 不一致；O-2 桌面停止非真取消；O-3 chat-error 休眠；O-4 rename_session 未用；O-5 DECO_MAP 预置冲突；O-6 Documents 硬编码

验证：产物即文档（无代码变更）；STRUCTURE 登记新文件；PROGRESS-LITE 同步

### [Change] 需求文档修订为目标态（v2）——依用户 8 项意见，仅改文档不改代码

背景 / 变更原因：用户 2026-09-06 对需求文件提出 8 项修正（定位/澄清策略/界面控件/知识注入/素材机制等），明确「先不要修改代码」。将 docs/REQUIREMENTS-understanding.md 由"现状还原"重写为"目标需求"，被改条目统一标 ▲（代码尚未实现），并加「附录 A：修订对照」。

修订要点（8 项 → 落点）：
1. 定位：产物经微信官方接口直达**公众号草稿箱**（非仅粘贴）→ 新增 FR-E4 发布、publish 模块、§5 素材上传
2. 有创作需求 ≠ 直接生成：必须先**逐项澄清用户要求**才产出 HTML → FR-A2 阶段 A
3. 澄清非"只问 1 个就停"：保证所有相关维度明确（给定或授权"由你定"）才开写 → FR-A2 + O-11（收束判据待定）
4. 界面删**模式三段按钮与风格下拉**，类型/风格由 LLM 自决 → FR-A3
5. 风格**不局限于已探索风格**（预置 8 色板之外的任意风格可由模型自带 token 渲染）→ FR-A3/O-12
6. busy 分**"思考/澄清"与"生成中"两档** → FR-A5（依赖桌面真取消，O-2）
7. 知识注入改 **注册表 + 知识工具按需取用**（参考 skill 机制），不再一股脑/启发式条件注入 → FR-C2/O-13
8. 美术素材改**图像子智能体**产出（SVG→PNG 回填），减主智能体负担 → FR-B2/O-14

验证：本文档为纯文档修订（无代码变更）；STRUCTURE 注释、PROGRESS-LITE 同步；「附录 A」8 行对照表与 ▲ 待迭代清单留在文中供后续轮次引用

---

## 2026-09-05

### [Change] 第 22 轮：整理散落验证产物归档到项目 docs/artifacts（整理轮）

背景 / 变更原因：用户「整理所有散落在外的文件到 wechat-mp-desktop 内」。按 file-organize skill 只读盘点 + 归类提议 + 用户确认：A 组 19 个本项目验证产物移入项目；B 组 14 个 askkp/dsh-desktop 历史产物与工作区杂项/TEMP 残留保留原位（只整理不删除）。

实现：
- 新建 docs/artifacts/，从工作区 verify-artifacts 移入 19 个：E2E 截图 8（wxmp-desktop-*.png）、compose/注入样例 9（compose-sample/compose-live*/compose-probe*.html、probe-injected.md）、风格选型 3（style-choice-*.md）
- verify-ui.mjs / compose-check.mjs 默认输出路径改为项目内 docs/artifacts（今后验证截图与样例自动落项目内）
- STRUCTURE docs 树登记 artifacts；REQUIREMENTS 第 22 轮登记

验证：docs/artifacts 19 个产物齐；verify-artifacts 剩余 14 个非本项目文件；产物入库作为验证证据

---

### [Change] 第 12 轮：通用对话模式——去掉固定澄清卡，像通用智能体一样正常对话

背景 / 变更原因：
用户验收第 11 轮后强烈反馈「这不是一个可用的智能体，为什么会有该死的固定框，为什么不是跟一个通用智能体一样正常对话」。经 1 问确认形态 = 通用对话模式：AI 像 DeepSeek/ChatGPT 一样正常聊天（闲聊、公众号写作答疑都自然回复）；只有明确说「写/生成推文」时才产出推文；创作信息不足时由 AI 在对话流里用自然语言反问，用户直接在输入框回答，不再有任何卡片/按钮框。

实现：
- 删除 components/ClarifyCard.tsx、.clarify-* 样式、App pendingClarify 挂卡分流与需求注注入（第 11 轮"需求确认/默认"注取消——对话即契约，按默认推进时由模型在正文前一句话说明默认）
- App 对话路由：isCreateRequest/isDemoTopic → 创作模式 turn('gen')；其余（闲聊/答疑）→ 通用对话 turn('chat')；expectRef 创作上下文标记（模型未产出 HTML=先反问时，下一条消息仍走创作模式；产出推文或用户说"算了"后复位回对话）；知识检索失败回退纯 persona
- lib/needs.ts 重写为请求分类器：CREATE_VERB_NOUN/CREATE_IMPERATIVE/CREATE_HELP 创作判定、isCancel 取消判定；evaluate 保留供模拟端判断反问；删除卡片相关选项/标注导出
- lib/persona.ts：新增 buildChatSystem 通用对话人设（含「对话模式」标记供模拟端识别）；PERSONA_RULES 创作流程补「模糊→最多问 1 个关键问题并停下等待回答；本条若是对澄清的回答→直接产出；按默认推进先一句话说明默认」
- lib/chat.ts：模拟端三类回复（对话人设→闲聊文案；创作且需求不足且上一条未反问→反问问题；否则成文样本）
- ChatPane：移除卡片槽与相关 props；空态/占位/示例 chips 改对话式（新增"帮我写一篇推文，主题是新书上市"演示反问、"公众号推文怎么起标题？"演示答疑）；typing 文案"正在思考…"

验证：
- pnpm build exit 0；cargo test 17/17（Rust 零改动）
- E2E 全绿 28 项 + 零浏览器错误：S9a 模糊创作→对话反问且无预览→回答"日系风格，800字左右"→成文 + 质量通过；S9b 直接写→不问直出单回合；S9c "你好"→自然回复且不产出预览；S9d 反问后"算了"→取消不生成；S1/S1.5/S1.6/S1.7/S2/S7/S8 全回归；截图 verify-artifacts/wxmp-desktop-S9*.png

---

## 2026-09-05

### [Change] 第 13 轮：与 DSH 全面对齐——模型/推理配置 + 模型自主对话

背景 / 变更原因：
用户问「为什么和我用在 deepseek harness 里的差这么多」。差异检查定位：①DSH 用 deepseek-v4-flash + reasoningEffort max，桌面端默认 deepseek-chat 且请求体无推理参数（同 key 官方端点实测：v4-flash 带内部推理、输出更自然；reasoning_effort max 对 deepseek-chat 与 v4-flash 均兼容 HTTP 200）；②DSH 模型完全自主，桌面端仍是本地正则路由 + expectRef 状态机；③DSH persona 对话与创作一体。用户确认「全面对齐优化」。

实现：
- src-tauri/chat.rs：默认模型 deepseek-chat → deepseek-v4-flash；请求体加 reasoning_effort: max（流式）
- src/lib/settings.ts：DEFAULTS.model → deepseek-v4-flash；settings.rs 测试 fixture 同步
- src/lib/persona.ts：PERSONA_RULES 重写为「对话+创作一体」——身份含通用对话能力；行为判断由模型自主（闲聊/答疑直接回复不输出代码；创作模糊→自然问 1 个关键问题后等待；本条是对澄清的回答→直接产出；"算了"→停止创作回对话）；创作硬规范（间距/审美 v10/排版语法/```html 输出协议）保留；删除 buildChatSystem（不再有独立对话人设）
- src/App.tsx：删除本地创作/对话路由与 expectRef 状态机、kind 分支；统一为单回合 turn（统一 persona + 知识节选，兜底无节选 persona）；回复含 HTML 才更新预览（纯对话不触碰预览）
- src/lib/needs.ts：降级为「仅供浏览器模拟端近似模型自主判断」（注释声明）
- src/lib/chat.ts：模拟端不再依赖系统"对话模式"标记，按 isCancel → isDemoTopic → isCreateRequest+需求评估 → 闲聊 启发式近似模型自主（上一条反问过且非取消 → 直接成文）
- 知识库结构不动（第 13 轮 wechat-mp 设计已排除发布/复盘类，desktop 三层即创作知识面）

验证：
- pnpm build exit 0；E2E 全绿 28 项零浏览器错误（S9a 反问成文/S9b 直接写/S9c 闲聊/S9d 反问后"算了"取消 语义保持；S1-S8 回归）
- cargo 17/17；live 冒烟 OK（v4-flash 流式回复）；live_article_sample OK（16.7s、6919 字、0 issues）

---

## 2026-09-05

### [New Feature] 第 14 轮：移植 DSH 完整创作工艺——v2 语法 → HTML 确定性转换器（方案 B）

背景 / 变更原因：
用户质疑「为什么现在产物的质量还留在最初的版本？我 test 内更新的大量内容都去哪里了」。差异检查结论：知识文件零丢失（桌面 149 文件与 test 三层镜像逐字节一致，仅差 2 个开发文档），根因是消费侧——persona 创作协议仍是最初精简版，test 的 47 模块/30 风格/27 文案知识从未进入生成流程。1 问确认方案 B：移植 DSH 完整工艺（wechat-mp preset SKILL.md Host 源码的 compose 转换器）。

实现：
- src/lib/compose.ts（新）：转写 SKILL.md markdownToWechatHtml 核心（DESIGNS text/promo 双色系、inline/paraBlock/bubble/divider/heading/quote/card/steps/banner/cols/imgrow/imgcard/timeline/band/frame/list/table/code/title/lace、detectMode、主循环、art:// 移除+警告、本地图/表格/20000 字符警告、wrapper+plainText），桌面无微信资产 → artUrls 恒空
- 创作协议：persona 改为「输出 ```v2 围栏正文（Markdown+v2 语法），本地排版引擎渲染为微信合法内联 HTML」，语法表 = v2 全集；不再直接写 HTML
- extract.ts：splitAssistant 返回 { prose, code(html), v2 }，识别围栏语言；```html 直通通道保留（违规演示/旧会话）
- App：resolvePreview（html 直通 or v2 compose）；流中 v2 围栏闭合即实时预览；流末终检质量；applySession 恢复时对最后 v2 正文重放 compose；warnings state 展示在预览（art:///本地图/表格提示）
- PreviewPane：body padding 归零（compose wrapper 自带 16px 页边距）+ compose-warn 样式
- ChatPane：源码区按内容显示「查看正文（v2）」或「查看 HTML 源码」
- chat.ts：mock 成文改为 v2 语法正文样例（校园宣传，参照 dev/artifacts/10lian-tuiwen.md 风格）；BAD 演示仍 html 直通
- chat.rs：请求体补 max_tokens 16000（实测 reasoning_effort max 下推理会吃光默认预算导致正文为空）
- scripts/compose-check.mjs（22 项断言）+ compose-cli.mjs（命令行渲染）

验证：
- pnpm build exit 0；compose-check 22/22（模式检测/banner/steps/band/badge/title/气泡/art 移除/本地图与表格警告/文字类结构）
- E2E 31 项全绿零浏览器错误（S1.7 源码区=v2 正文、新增 S1.8 compose 渲染断言：预览含 banner 标题/小节/气泡文本；S1.5 导出 7485B 为 compose HTML；S9a-d 语义保持；S2 直通检出）
- 真实模型 live：v4-flash 按 v2 协议产出 900 字日系风正文（cols/steps/band/KEY 气泡/引用/badge 全语法）→ compose 渲染 promo 755 纯文字、8188B、0 警告
- cargo 17/17 + live 冒烟；产物 compose-live.html/compose-sample.html 落 verify-artifacts

---

## 2026-09-05

### [New Feature] 第 15 轮：现场生成美术素材——按知识库每次创作 SVG + 强制使用 + 结构 ≥6

背景 / 变更原因：
用户问「为什么现在没有生成素材了？我希望根据知识库每次现场生成需要的 svg 素材；强制规定要使用美术素材，且每个 svg 内部结构不得少于 6」。根因：第 14 轮按 DSH"未上传即移除"把 art:// 移除（桌面无微信上传）。方案：桌面本地素材管线——模型按知识库（module-art-assets 规范 + 风格色板）现场绘制 SVG，引擎校验元素 ≥6 后 canvas 渲染 PNG data URI 内嵌（自包含，微信后台粘贴可转存）。

实现：
- src/lib/compose.ts：新增 `::: art [wide|inline] 说明` 容器——原样收集 SVG 内容，校验带 viewBox 且图形元素 ≥6（svgElementCount：circle/rect/ellipse/line/path/polygon/polyline，剥离 defs/渐变/注释），达标输出 @@ARTn@@ 占位并收集 arts，不达标输出占位文本 + 警告；段落合并 break 条件补 art
- src/lib/artRender.ts（新）：svgToPngDataUri（canvas 2x → PNG data URI；尺寸超界/canvas 失败回退 svg data URI）+ renderArtPlaceholders（@@ARTn@@ 逐位替换）
- App：resolvePreview 返回 arts；流中/流末/会话恢复异步渲染替换（artSeqRef 序号防旧渲染覆盖）；质量检查针对渲染后 HTML（data 图不触发外链检查）
- persona：美术素材铁律（每篇必须 ≥1 素材；现场绘制 SVG：viewBox 建议 750x220/300x300、图形元素 ≥6、植物/自然/器物意象、零文字零 emoji、透明底、低饱和同色系 ≤4 色按知识色板、SVG 内允许轻量明暗渐变、每屏 ≤1、wide/inline 用法示例）
- chat.ts mock 样例加 art 块（朝阳旗帜横幅 SVG 7 元素）；compose-check/compose-cli 增 art 断言与摘要
- E2E S1.8 增"素材渲染为 data 图片"断言

验证：
- pnpm build exit 0；compose-check 全绿（art 收集/占位/元素计数/weak svg 拦截/inline 居中）
- E2E 32 项全绿零浏览器错误（S1.8 art svg rendered to data image=1；S1.5 导出 64KB 含 data PNG；S9a-d/S2 语义保持）
- 真实模型 live：v4-flash 产出 2606 字日系咖啡开业 v2 正文，素材块"日式手冲与一颗豆子的香气"SVG（渐变陶杯/拉花涡纹/蒸汽/豆子）15 图形元素 ≥6，compose 渲染 promo 603 字 0 警告
- cargo 17/17（Rust 零改动）；产物 compose-live-art.html 落 verify-artifacts

---

## 2026-09-05

### [Change] 第 16 轮：素材用量升级——组件装饰全覆盖（每篇 5-8 处、单屏 ≤1）

背景 / 变更原因：
用户反馈「强制使用美术素材不够，量太少，每个组件都必须使用美术素材」。经 1 问确认口径 = 组件装饰全覆盖：所有组件装饰位用素材（banner 配主题插画、每个 ## 小节标题下配小插画、气泡邻接 inline 素材、换场分隔花饰、容器按需），单篇 5-8 处、单屏 ≤1。

实现：
- persona 美术素材铁律 v2：素材用量 5-8 处/篇（短篇 ≥4）+ 组件全覆盖映射 + 每处 SVG 元素 ≥6 + 意象呼应 + 单屏 ≤1
- compose.ts：素材用量校验——arts 0 处 →「未包含美术素材」警告；<4 处 →「素材用量偏低」警告（展示在预览区）
- chat.ts mock 样例扩到 5 处素材（FLAG/FLOWER 两变体交替：banner 宽幅、小节 inline×3、收尾宽幅）
- chat.rs：max_tokens 16000 → 32000（实测 reasoning_effort max 下复杂创作推理会吃光 16k 预算致正文为空；32000 为 API 接受上限内）
- compose-check/E2E 断言更新（zero-art/low-art 警告、S1.8 five art assets rendered）

验证：
- pnpm build exit 0；compose-check 30 项全绿
- E2E 33 项全绿零浏览器错误（重跑确认；S1.8 five art assets rendered to data images=5；S1.5 导出 195KB 含 5 张内嵌 PNG；S9a-d/S2 语义保持）
- 真实模型 live：日系咖啡开业 5876 字正文，**6 处素材**（目标 5-8；元素 8-13 全 ≥6；banner 暖帘/小节拉花/豆子旅程/托盘四季/手冲壶/收尾横幅），compose 渲染 promo 767 字 0 警告；产物 compose-live-art5.html
- cargo 17/17（Rust 仅 max_tokens 数值调整）

---

## 2026-09-05

### [Change] 第 17 轮：四项质量修复——文案克制 / 组件必用 / 强制询问 / 风格真正落地

背景 / 变更原因：
用户反馈四项：①文案用力过猛；②只有 SVG 插图、没有各种组件（如修饰的小气泡）；③依旧不询问清楚；④完全没有考虑风格（显式风格按钮在渲染层不生效）。

实现：
- src/lib/palettes.ts（新）：按知识库视觉/风格条目提取 8 风格主题表（日系/国潮/校园/科技/极简/商务/手账/森系；bg 正文底色 + 文字类 accent/accentDark/heading/soft/soft2/border/hl + 宣传类 orange/amber/teal/ink；深档近似色按同色系）
- compose.ts：resolveTheme（UI opts.theme 优先，否则正文 [[theme:名称]] 首个声明）；makeDesign 主题键覆盖；wrapper 加 background（主题底色）；theme 行不渲染；组件化校验警告（容器 ≥2 + 气泡 ≥1 + 列表/引用 ≥1）
- persona 新增三段：文案语气规则（禁夸张营销词/感叹号 ≤1/具体细节/平实号召）；结构规则（正文必须组件化，纯文字 ≤2 连段）；风格规则（界面选择优先；自动时正文顶部 [[theme:名称]] 声明；素材配色同步）
- App：强制询问状态机——创作请求且 evaluate 缺 ≥2（无"直接写"/演示）→ 澄清回合（CLARIFY_SYSTEM 只问 1 个精简问题、不产出）→ 回答后创作；askRef 恢复/清空复位；UI style → compose theme 注入；恢复会话按 item.style 上色
- mock 样例声明 [[theme:校园]]；compose-check 36 项 + E2E 断言更新（主题色渲染、UI 优先、组件化警告、S9 强制询问语义）

验证：
- pnpm build exit 0；compose-check 36 项全绿
- E2E 37 项全绿零浏览器错误（S1.8 campus theme colors applied；S1.7/1.5/1.6/S2/S7/S8/S9a-d 回归）
- 真实模型 live：国潮茶饮 5474 字正文——[[theme:国潮]] 声明 → 宣纸米底 #fff9ef + 朱红 #c03a2b 主色落地、SVG 素材配色贴合（鎏金/朱红/宣纸米）、文案自然克制（"菜单不大，是手抄的…"）；素材 5 处元素 9-12 全达标；产物 compose-live-guochao.html（模型示例语法导致 alt 换行，非产品缺陷）
- cargo 17/17（Rust 零改动）

---

## 2026-09-05

### [Change] 第 18 轮：撤销前端对话状态机（用户永久禁令，立即执行）

背景 / 变更原因：
用户明确「记下来绝对禁止前端状态机，绝对禁止」。第 17 轮实现的"强制询问状态机"（askRef 澄清回合：创作且需求缺 ≥2 → 前端拦截走澄清人设）属于被禁止的前端对话流程状态机，立即撤销；询问与否完全交还模型自主（persona 保留"需求模糊 → 问 1 个关键问题并停下等待"条款作为约束）。

实现：
- App.tsx：删除 askRef/CLARIFY_SYSTEM/澄清回合分支与 needs 前端导入（evaluate/isCreateRequest/isDemoTopic），send 恢复直通统一回合；保留 UI/数据状态（busy/currentId/artSeqRef 等非对话流程状态）
- 禁令落盘：项目 CLAUDE.md 铁律新增第 6 条「绝对禁止前端对话状态机」；REQUIREMENTS.md 新增「〇、永久禁令」节并登记第 18 轮；第 17 轮状态加注说明 askRef 部分已撤销
- 第 17 轮其余三项（文案克制/组件化/风格落地）保留

验证：
- pnpm build exit 0；E2E 全绿（VERIFY OK：S9a-d 语义由模拟端自主近似保持，真实链路交模型自主；S1-S8 回归）

---

## 2026-09-05

### [Change] 第 19 轮：三层数据库按任务路由注入——让最终三层库真正驱动创作

背景 / 变更原因：
用户「我需要的就是最终的三层数据库，为什么没能体现出这个性能」。根因：桌面端只做关键词检索 + ≤6 条 4500 字截断节选，三层库的 46 模块/30 风格/内容类型/模板/合规红线绝大部分从不进入生成上下文；DSH 侧 agent 按 00-GUIDE「路由→索引→点文件」读全文。桌面无工具调用 → 由前端在单次请求内执行同一路由逻辑（非对话状态机，不违永久禁令）。

实现：
- retrieval.ts：任务路由注入——needs.assess 判内容类型 → 文本/内容类型/type-<key> + 文本/文案/copy-tpl-<key>（模板）；风格 → 视觉/风格/style-<key> 全文；营销类（promo/soft/brand）→ 文本/合规/comp-banned 红线（命中提示加"合规红线"）；主题词命中优先、相似度兜底补足 topK；路由点文件截断放宽 8000（其余 4500）
- persona：知识库参考段改为「按任务路由注入，注入内容即该任务权威细则，冲突以库为准」；风格规则强化 auto 场景必须在 v2 正文第一行声明 [[theme:名称]]
- scripts/live-knowledge-probe.mjs（真实注入对比：读库内 4 点文件 → buildSystemPrompt → 模型 → compose）

验证：
- pnpm build exit 0；E2E 39 项全绿零浏览器错误（新增 S8 三层路由注入断言：知识命中含"内容类型:promo / 合规红线"）
- 真实注入对比 live-knowledge-probe：注入 type-promo + copy-tpl-promo + style-guochao + comp-banned（23.6KB）→ 模型产出 6814 字：促销 banner（前三天八折利益点）、5 处素材全部国潮库色（#C03A2B 朱红/#D4AF37 鎏金/#FFF3DE 绢黄/#2B2118 墨）且 alt 具象（开张横幅圆窗杯盏山影红灯笼/桂花枝瓷杯/宣纸灯竹影/金线水云纹/杯垫红印）、0 警告；产物 probe-injected.md / compose-probe-injected.html
- cargo 17/17（Rust 零改动）

---

## 2026-09-05

### [Change] 第 20 轮：风格选型教程注入 + 反模板化——风格按内容选，禁止全国潮模板

背景 / 变更原因：
用户反馈「目前只有风格参考，没有风格选择的教程，全都是成国潮模板了」。根因：①auto 场景从不注入风格选型教程（风格 00-索引"内容类型→首选/备选风格"速查、style-guide-choose 决策流），模型无选型依据 → 瞎选/偏爱国潮；②注入的 style-* 文件（含标题层级/模块表现/文案调性示例）被整篇当模板套 → 每篇都"成国潮模板"。

实现：
- retrieval.ts：ensureKnowledgeLoaded 不再过滤 00-*（相似度兜底排除 00-*/design-logic-components）；auto（assess 无风格）且创作请求 → 注入 视觉/风格/00-索引（内容类型→首选/备选风格速查，路径定位避开各方向同名 00-索引），命中提示加"风格速查"；用户点名风格仍注入 style-<key>；路由条目按原对象输出（避免同名索引错取）
- persona 风格规则 v3：auto 先按注入速查与读者/情绪匹配选风格再声明 [[theme:名称]]，拿不准宁可不声明（默认双色系）；风格=皮肤（色板/气质/装饰），正文结构文案由内容类型模板与主题决定；注入文件中的标题/模块/文案示例仅说明规范，禁止照搬骨架句式；同风格不同主题不得雷同
- scripts/live-style-choice.mjs（三主题同质注入选型验证）

验证：
- pnpm build exit 0；E2E 40 项全绿零浏览器错误（S8 断言补"风格速查"命中：知识命中 活动/内容类型:promo/风格速查/合规红线）
- 真实模型三场景（同质注入：风格速查+type-promo+comp-banned；auto 不指定风格）：咖啡店开业 → [[theme:日系]]（米纸底、木牌窗台意象、拟人 banner"树下咖啡·滨江店，开了"）；科技新品 → [[theme:科技]]（深蓝表带、参数利益点 banner）；中秋国货礼盒 → [[theme:guochao]]（朱红鎏金桂花满月、文化意象 banner）——三篇风格/配色/意象/banner 文案/结构全部差异化，不再是全国潮模板；产物 style-choice-{coffee,gadget,festival}.md
- cargo 17/17（Rust 零改动）

---

## 2026-09-05

### [Change] 第 21 轮：素材具体插画化 + 正文加长 + 气泡角饰修饰

背景 / 变更原因：
用户反馈三项：①SVG 插图过于抽象没有具体图像（根因：persona 素材铁律"线条意象+平面克制"导致几何剪影；"具体插画"引导缺失）；②文案太短（默认长度与充实度要求不足）；③所有气泡缺修饰（组件内装饰素材未实现）。

实现：
- persona 素材铁律 v4：素材必须"看得懂的具体插画"（明确对象结构与前后关系、≥2 层明暗（渐变或深浅色块）、细节纹理、禁止几何剪影冒充；自查标准=读者一眼说出画的是什么）；正文默认 1500-2500 字、每小节展开细节/场景/数据（短文 <600 会被引擎提示）；气泡 KEY/TIP/DANGER 必带角饰（::: art deco 名称 定义 + > [!KEY|名称] 引用，示例给出）；移除 v2 内普通代码块语法（防围栏嵌套干扰提取）；风格规则改为"采用风格必声明 theme（重复声明无害）"
- compose.ts：::: art deco 预扫描注册（SVG ≥6 元素 + viewBox 校验，未达标警告）；bubble 支持现场角饰（60px 右下 data uri 渲染）；引用未定义角饰产生警告；正文偏短（<600 字）警告
- chat.rs：max_tokens 32000 → 64000（实测 1800 字+素材+deco 的长创作在 max 推理下仍吃光 32k 预算）
- mock 样例加长（1500 字级正文）并演示 KEY 气泡角饰；compose-check/E2E 断言更新

验证：
- pnpm build exit 0；compose-check 41 项全绿（deco 渲染/未定义警告/偏短警告/长文无警告）
- E2E 41 项全绿零浏览器错误（S1.8 素材+角饰渲染；S8 路由注入；S9a-d 语义保持）
- 真实模型 live：有闲茶咖开业（信息齐全、1800-2200 字指令）→ 产出 1518 字正文、2 个气泡分别带 keyflower/tipdessert 角饰（定义+引用）、素材 7 处全部具体插画（朱红门前第一盏茶与咖/窗边小桌茶壶/一杯手冲与一盏热茶/一碗桂花茶冻/桂花枝下）元素 16-41、0 警告；产物 probe-injected.md / compose-probe-r21.html
- cargo 17/17（Rust 仅 max_tokens 数值）

---

## 2026-09-04

### [New Feature] 第 11 轮：结构化需求澄清卡——桌面端体现 req-clarify 能力

背景 / 变更原因：
用户批评"桌面端工具里没能体现出 req-clarify 的能力"。经 1 问确认形态 = 结构化澄清卡、确认后生成（不弹卡条件：需求清晰 / 含"直接写"指令 / 演示话题）。

实现：
- src/lib/needs.ts：需求评估（类型/风格/字数/调性/配图五维度关键词命中，缺 ≥2 且无"直接写/演示"触发澄清）+ 需求注组装（describeSelections 已知项 + assumptionNote 默认项：req-clarify"直接做也标注假设"）
- src/components/ClarifyCard.tsx：分维度选项行（每项可点选或保留默认）、需求原文、确认并生成 / 跳过直接生成
- App：send 分流（评估 → 挂卡不调 LLM / 直行附默认注）；confirm/skip 拼装最终 prompt（"需求确认/默认"标注）走原链路；ChatPane 顶部渲染卡片
- 修 React key 冲突：会话恢复（applySession）时把 idSeq 提升到最大消息 id+1，消除恢复后新增消息的重复 key 告警

验证：
- pnpm build exit 0（主包 251.7kB）
- E2E 全绿 21 项 + 零浏览器错误：S9a（模糊请求→弹卡且不流式→选日系/适中→确认→生成含"需求确认"注）；S9b（直接写→不弹卡→消息含默认注）；S1-S8 全回归

---

### [Change] 第 10 轮：界面体验修正——常驻会话栏 + 对话流净化（需求报告驱动）

背景 / 变更原因：
用户批评两点：①生成的代码被用户看到（气泡整段显示 ```html 原文）；②未澄清需求就开干。经 myworkflow-req-clarify 两轮澄清（上下文形态=常驻会话栏；代码展示=默认隐藏可展开），报告 `docs/information/2026-09-04-context-rail-clean-chat.md` 经用户"通过"后实施（方案 A）。

实现：
- SessionRail.tsx：左侧常驻会话栏（列表/新建/切换/删除/当前高亮），顶栏「会话」按钮改为折叠开关（收起/展开会话栏），≤1120px 初始折叠；SessionMenu 弹层退役删除
- 对话流净化：ChatPane 按 splitAssistant（lib/extract.ts 新增）只渲染 ```html 围栏外说明文字；无说明显示"已生成推文，见右侧预览"；每条助手消息带「查看 HTML 源码」展开区（默认收起、独立展开态，流中不显示按钮）
- App 三栏布局（rail-on/rail-off grid）；CSS（session-rail/src-area/src-view 等）
- E2E：S1.7 新增断言（气泡无代码文本/展开含源码/收起）、waitStreamDone/S1.6/S8 迁移到净化与侧栏语义

验证：
- pnpm build exit 0；E2E 全绿（S1 通过 / S1.7 三项 / S1.5 导出 / S1.6 恢复+清空 / S2 检出 / S7 设置 / S8 侧栏 1→2→1）
- Rust 零改动（会话存储沿用第 9 轮）

---

### [New Feature] 第 9 轮：多会话上下文窗口（像 DSH 的会话切换）

需求 / 变更原因：
用户反馈"没有项目的概念/上下文的概念，需要像 dsh 那样有不同的上下文窗口"——每会话独立上下文（历史/内容/模式/风格），新建/切换/删除/自动保存/启动恢复；旧单会话 draft.json 自动迁移首个会话（不丢稿）。

实现：
- Rust draft.rs → sessions.rs：workspace/sessions/<id>.json + state.json 当前指针；sessions_dir/state 注入 base 可测；标题规则（首条 user 消息 ≤16 字 / 自定义保留）；旧 draft.json 自动迁移（rename .migrated）；命令 list/create/open/save/rename/delete_session（10 命令总量）；export/settings 引用改 sessions::workspace_dir
- 前端 draft.ts → sessions.ts（Tauri invoke / localStorage wxmp-sessions-v1，旧 wxmp-draft-v1 迁移）；SessionMenu 组件（列表/新建/删除/当前高亮）；App 状态机 currentId（防抖自动保存绑定当前会话 + 流结束即存 + 切换先存后开 + 删除回退 + 清空=清当前内容）；顶栏「会话 · 标题」入口 + data-ready 就绪标记
- 修 dev StrictMode 双跑：bootRef 互斥 + 移除 alive 门控（cleanup 先于异步完成导致引导丢失）

验证：
- cargo test 17/17（sessions 4：create/list/roundtrip、标题规则、删除回退当前、legacy 迁移）
- pnpm build exit 0（主包 244.5kB）
- E2E 全绿：S1/S1.5/S1.6(新语义 清空=空当前会话)/S2/S7/**S8 多会话**（1→2 新建独立内容 毕业季 → 列表增长 → 切换 → 删 2→1 回退）
- release 重建含本功能

---

### [Build] 第 8 轮：发布刷新——全功能 release 重建 + 安装闭环复验

需求 / 变更原因：
第 5 轮安装包落后于第 6/7 轮功能（存档目录统一、应用内设置），重建交付最终产物并复验安装闭环。

产出 / 验证：
- pnpm tauri build --bundles nsis 重建（release 32s；exe + setup 覆盖）
- 复验：静默安装 exit 0 → 安装版启动存活 → 卸载 exit 0 目录删除
- 清理 resolve_api_key dead_code（release 无用）
- cargo 16/16 无警告
- 交付物：src-tauri/target/release/bundle/nsis/wechat-mp-desktop_0.1.0_x64-setup.exe（含 1-7 轮全部功能）

---

### [New Feature] 第 7 轮：应用内 API 设置——彻底脱离 ~/.dsh

需求 / 变更原因：
对外分发的桌面端不应依赖用户机器的 ~/.dsh 凭据——应用内提供 API 配置（Key/端点/模型），本地保存；密钥解析优先级 env > 应用设置 > 旧 ~/.dsh 兼容回退。

实现：
- src-tauri/src/settings.rs：AppSettings + read/save（损坏→默认不覆盖）+ save_settings/load_settings 命令（2 单测）
- chat.rs：LlmConfig + resolve_config（env > settings.json > ~/.dsh legacy）+ stream_chat 改收 &LlmConfig（修空白 env 处理，+1 优先级单测）
- 前端 lib/settings.ts（Tauri invoke / localStorage wxmp-settings-v1）+ SettingsPanel（Key 掩码/地址/模型/保存/恢复默认/优先级说明）+ 顶栏「设置」入口
- RELEASE-NOTES 配置段改写

验证：
- cargo test 16/16（2 ignored）
- pnpm build exit 0（主包 240.3kB）
- E2E 七场景全绿：S1 通过 / S1.5 导出 / S1.6 恢复+清空 / S2 检出 4 项 / **S7 设置保存→刷新持久(sk-e2e-123)→恢复默认清空**

---

### [Build] 第 6 轮：安装器真实验证——静默安装/启动/卸载闭环

需求 / 变更原因：
第 5 轮产出的 NSIS setup 尚未做真机安装验证；本轮补发布闭环：静默安装 → 安装版启动冒烟 → 静默卸载 → 目录清理。

产出 / 验证：
- setup.exe /S /D=… 静默安装 exit 0；安装目录出现 wechat-mp-desktop.exe
- 安装版启动冒烟：进程存活（6s）后关闭
- uninstall.exe /S 静默卸载 exit 0；安装目录已删除
- RELEASE-NOTES 验证基线补"发布闭环"一行
- 备注：dev 模式 tauri dev（pwsh-17）随之结束；后续开发可随时重启

---

### [Build] 第 5 轮：发布打包——独立安装版（tauri build + NSIS）

需求 / 变更原因：
把桌面端做成可脱离开发环境交付的独立安装版：release 编译 + NSIS 安装器；并冒烟验证发布产物可启动。

产出：
- `pnpm tauri build --bundles nsis`：release exe 12.2MB + NSIS setup 3.7MB（wechat-mp-desktop_0.1.0_x64-setup.exe，makensis 本地工具无需外网）
- RELEASE-NOTES.md：功能清单 / 运行与打包方式 / 配置 / 验证基线 / 已知边界
- 清理 draft.rs dead_code 警告（删除未用 draft_path）

验证：
- 产物存在：bundle/nsis/setup.exe 3.7MB、release/wechat-mp-desktop.exe 12.2MB
- release exe 启动冒烟：进程存活（78MB）→ 正常关闭
- 回归 cargo test 13/13（2 ignored）
- tauri build 整程 1m34s release + NSIS 完成（exit 1 为 pnpm/stderr 噪音，产物完整）

---

### [New Feature] 第 4 轮：会话自动存档/恢复 + 工作区目录统一 + 真实模型整篇抽样

需求 / 变更原因：
桌面创作要"断电不丢稿"：对话自动存档并在启动恢复；导出与存档统一到一个工作区目录；并对真实模型整篇输出做合规抽样（此前只冒烟过短回复）。

实现：
- src-tauri/src/draft.rs：Draft/DraftMsg 结构 + save_draft_to/load_draft_from（损坏存档改名 draft.json.corrupt 容错）+ save_draft/load_draft 命令（3 单测）
- 工作区统一：Documents/wechat-mp-workspace/{draft.json, exports/}（export.rs default_export_dir 改为 delegation 到 draft::exports_dir）
- src/lib/draft.ts：双通道存档（Tauri invoke / 浏览器 localStorage wxmp-draft-v1）+ fmtTime
- App：启动恢复（消息/模式/风格/预览与质量条）、变更防抖 700ms 自动存档、流结束立即存档、顶栏"已自动保存 HH:mm"、清空同时清存档
- chat.rs 新增 live_article_sample（#[ignore] 真实整篇生成 + 软断言）

验证：
- cargo test 13/13（draft 3 项：roundtrip/缺失 None/损坏容错）
- E2E 四场景全绿：S1 质量通过 / S1.5 导出下载 / S1.6 刷新恢复（userMsgs=1 预览恢复 + 顶栏已自动保存）→ 清空清存储 / S2 违规检出 4 项
- live_article_sample：LIVE ARTICLE len=3753 issues=[]（零 gradient/shadow/style/emoji）
- pnpm build exit 0（主包 237.7kB）；窗口 2:46:17 自动重启含 save_draft/load_draft 命令

---

### [New Feature] 第 3 轮：导出 HTML 文件 + 知识库懒加载减包

需求 / 变更原因：
生成结果要"能带走"：①导出按钮——Tauri 模式经 Rust 命令写入 文档/wechat-mp-exports/（文件名消毒、返回完整路径展示），浏览器模式走 <a download>；②知识库 eager 全量内联导致主包 2.4MB，改为懒加载按文件拆分。

实现：
- src-tauri/src/export.rs：default_export_dir/sanitize_name/with_html_ext/export_to_dir + export_html 命令（4 单测：非法字符消毒、htm/html 扩展、写盘内容一致、默认名前缀）
- src/lib/exportHtml.ts：双通道导出（invoke export_html / blob+a.download，文件名 tuiwen-yyyymmdd-hhmm.html）；PreviewPane「导出」按钮 + 结果提示条
- src/lib/retrieval.ts：import.meta.glob 改懒加载（ensureKnowledgeLoaded 缓存 Promise）；App 异步 await retrieve + 顶栏条目数动态显示（加载中…）

验证：
- cargo test 10/10（含 export 4 项；修测试预期：尾部 '_' 被 trim 属预期行为）
- pnpm build exit 0：主包 2388kB → 235.8kB（gzip 75.1kB），知识条目拆 149 个懒加载 chunk
- E2E 全绿：S1 质量通过 / S1.5 导出下载（tuiwen-20260904-0243.html 2254B，内容含 <section>）/ S2 违规检出 4 项
- tauri dev 自动重建重启窗口（PID 更替），export_html 命令已注册

---

### [New Feature] 第 2 轮：生成体验产品化——类型/风格选择注入 + 输出质量检查护栏

需求 / 变更原因：
把生成体验做成可调、结果可检查：①对话侧加「模式(自动/文字/宣传) + 风格(校园/科技/国潮/日系/极简/商务/手账)」快速选择，随请求注入提示词并参与知识检索；②对助手产出 HTML 做客户端质量检查（v10 铁律：零 emoji/零图标、无 style/script/文档级标签、无 linear-gradient/box-shadow、无外链图、无硬性宽），预览栏展示「质量检查:通过/问题清单」。

实现：
- src/lib/quality.ts：checkHtml → {ok, issues}（Extended_Pictographic + v10 图标字符显式集；style/script/html/head/body 标签；linear-gradient/box-shadow；http(s) img；≥100px 固定宽）
- ChatPane：控制条（seg 模式 + 风格下拉）+「演示：违规输出检测」chip；App：mode/style 状态 + decoratePrompt 注入 + 流结束后终检（checkHtml 只在结束时跑，避免流中抖动）；PreviewPane：质量条（q-ok/q-fail + 问题列表）
- chat.ts：新增违规演示样本（BAD_HTML：emoji+渐变+外链图），按提问含"违规"命中

验证：
- pnpm build（tsc+vite）exit 0
- E2E 双向全绿：S1 干净样本 → 质量检查通过（q-ok）；S2 违规样本 → 检出 4 项（emoji/gradient/shadow/external-img）并展示清单（q-fail）；截图 verify-artifacts/wxmp-desktop-ok.png / -fail.png

---

## 2026-08-29

### [New Feature] 第 1 轮：桌面双栏骨架 + 极简智能体链路（Tauri 2 + React 19 + DeepSeek 流式）

背景 / 需求：
用户要求把公众号推文助手做成**独立于 DSH 的桌面本地项目**：左侧与 AI 对话生成内容，右侧实时预览 AI 生成的推文；harness 底座参考 DSH 极简模式智能体（persona + 知识检索 + 流式对话），外附我整理的三层知识库；前端采用 Tauri。

设计决策：
1. **零依赖 DSH**：不引入 Cordis/DSH 运行时；Rust 侧 reqwest 直连 DeepSeek OpenAI 兼容接口（SSE 流式），密钥只从 env DEEPSEEK_API_KEY 或 `~/.dsh/.credentials.yaml` 读取，JS 永不见钥。
2. **双栏工作台**：左 ChatPane（消息流 + 快速示例 + 输入），右 PreviewPane（375px 手机壳 iframe，实时渲染 ```html 围栏内容）。
3. **极简智能体**：system prompt = persona（创作流程/间距 v5/v10 审美/输出协议）+ 按用户提问检索到的知识节选；知识语料 src/knowledge/（三层 149 文件，拷贝自 wechat-mp/test/knowledge，剔除迁移说明等开发文档）；检索 = 主题词映射（80+ 词 → 条目）+ 二元组相似度兜底。
4. **双通道对话**：Tauri 内 invoke chat_stream（Rust 流式，chat-delta 事件推送）；纯浏览器（vite dev）走本地模拟流，便于无壳演示。

文件：
- src/lib/persona.ts、retrieval.ts、chat.ts、extract.ts；components/ChatPane.tsx、PreviewPane.tsx；App.tsx/App.css/index.html
- src-tauri/src/chat.rs（密钥解析/SSE 解析/stream_chat 核心，6 单测 + live 冒烟 #[ignore]）、lib.rs、Cargo.toml（+reqwest rustls）、tauri.conf.json（1380x880「公众号推文助手」）
- scripts/verify-ui.mjs（playwright E2E）；四文件体系 + REQUIREMENTS（第 0/1 轮）

验证：
- pnpm build（tsc+vite）exit 0；E2E 全绿：模拟链路 4/4 PASS（状态徽标/围栏存在/预览非空/演示内容命中），截图 verify-artifacts/wxmp-desktop-ui.png；知识命中"校园/风格"
- cargo test 6/6 过（修 parse_credentials 循环内 `?` 提前返回 bug）；live DeepSeek 冒烟 `LIVE REPLY: 桌面链路测试通过`
- tauri dev 窗口启动确认（端口占用问题：先停 vite 再 tauri dev）

踩坑记录：
- pnpm 11 默认拦截 esbuild 构建脚本 → pnpm-workspace.yaml `allowBuilds: esbuild: true`
- 验证脚本首版等 `.btn-send:not(:disabled)` 误判（输入为空时按钮本就禁用）→ 改为等流结束标志（围栏完整 + typing 消失）
- playwright 版本与已装 chromium 不匹配 → executablePath 显式指 chromium-1234

---
