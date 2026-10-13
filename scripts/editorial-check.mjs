// R32：独立审稿消息的输入与范围契约。零模型；不以这些检查证明文案质量。
import { assertEditorialImagesPreserved, buildEditorialReviewMessages, parseEditorialReview, restoreEditorialMaterials } from '../src/lib/editorial.ts'
import { buildRegistrySystem, EDITORIAL_QUALITY_RULE, LANGUAGE_COMPOSITION_RULE, MANUSCRIPT_EDIT_RULE, MATERIAL_GROUNDING_RULE, PERSONA_RULES } from '../src/lib/persona.ts'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'
import { readFileSync } from 'node:fs'

const judge = createJudge({ script: 'editorial-check', outDir: resolveOutDir('editorial-check'), minChecks: 60 })
guardCrashes(judge)
const check = (name, ok) => { judge.check(name, ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const payload = (message) => JSON.parse(message.content.slice(message.content.indexOf('\n') + 1))
const rejects = (fn) => { try { fn(); return false } catch (error) { return error instanceof Error && !!error.message } }
const preserves = (before, after) => !rejects(() => assertEditorialImagesPreserved(before, after))
const fenced = (body) => '```v2\n' + body + '\n```'

const originalImage = `![一张真实原图](local-image://li-${'a'.repeat(64)})`
const libraryImage = '[[asset:art-inline|as-existing|分类示意]]'
const priorSource = `[[theme:极简]]\n# 原标题\n\n原开头。\n\n${originalImage}\n${libraryImage}\n\n## 保留这一节\n\n已确认的正文。`
const source = priorSource.replace('原开头。', '候选开头，含 \"引号\"、反斜线 \\ 与 ``` 字面内容。')
const request = '只把开头改得口语一些，后面的文字和图不要改。'
const contexts = [
  { role: 'system', content: '当前引擎协议：正文使用 v2。' },
  { role: 'user', content: '用户事实：活动在周六下午，不收费用。', images: ['data:image/png;base64,fixture-only'] },
  { role: 'assistant', content: null, tool_calls: [{ id: 'old-call', type: 'function', function: { name: 'load_knowledge', arguments: '{"id":"example"}' } }] },
  { role: 'tool', content: '产品事实：AI 创作需要联网；发布由用户完成。', tool_call_id: 'old-call' },
]
const before = JSON.stringify({ request, source, priorSource, contexts })
const messages = buildEditorialReviewMessages({ request, source, priorSource, contextMessages: contexts })
const finalInput = payload(messages.at(-1))
const instruction = messages[0].content

check('原始需求逐字进入最后消息，候选仅锁素材且可无损还原', finalInput.request === request && restoreEditorialMaterials(source, finalInput.source) === source)
check('已有正式稿复用相同素材锁，原始两种引用保留为核对清单', finalInput.priorSource.replace('原开头。', '候选开头，含 \"引号\"、反斜线 \\ 与 ``` 字面内容。') === finalInput.source && finalInput.immutableMaterials.map((item) => item.original).join('\n') === originalImage + '\n' + libraryImage)
check('用户事实、产品事实与协议背景都保留原消息身份及完整文字', contexts.every((item, i) => { const retained = payload(messages[i + 1]); return retained.originalRole === item.role && retained.content === item.content }))
check('保留视觉输入而不透传旧工具协议信封', messages[2].images[0] === contexts[1].images[0] && messages.every((item) => !('tool_calls' in item) && !('tool_call_id' in item) && item.role !== 'tool'))
check('复核仍收到事实和教程执行条件，不以删掉旧文风规则丢失材料保护', [
  '按文章顺序模拟执行',
  '把个别经历当普遍规律或把可能当保证',
  '核验每步前提、结果和后续维护',
  '删除、覆盖之前要有独立且可用的资料保留方式',
  '同步或回收站不是备份',
  '打开一份不代表整批完整',
].every(part => instruction.includes(part)))
check('局部修改范围、恢复前稿和图片逐字保护进入实际系统消息', instruction.includes('只改开头或指定段落时') && instruction.includes('其余正文逐字恢复或保留 priorSource') && instruction.includes('所有图片、URI、asset ID、插画占位、照片位和原始说明原样保留'))
check('要求最多六条实质摘要和完整成稿，全文一致且不增改图片', [
  '最多6条', '唯一、完整、闭合的 ```v2 围栏', '不展示推理过程', '不新增、删除、替换或移动',
  '核对关键数字、对象和适用条件',
  '发现矛盾应修正主张或做法',
  '摘要所述改动须在最终稿中确实完成',
].every(part => instruction.includes(part)))
const fresh = buildEditorialReviewMessages({ request: '写篇观点文', source: '# 标题\n\n正文。' })
const engineProtocol = readFileSync(new URL('../src/knowledge/排版引擎/engine-write-protocol.md', import.meta.url), 'utf8')
const protocolInputs = [
  { request: '写篇观点文', source: '# 标题\n\n正文。' },
  { request, source, priorSource, contextMessages: contexts },
]
const protocolMessages = protocolInputs.map(input => buildEditorialReviewMessages({ ...input, engineProtocol }))
check('新稿和局部改稿复核各在系统消息中收到一份完整可信协议', engineProtocol.trim().length > 0 && protocolMessages.every(items => items[0].role === 'system' && items[0].content.split(engineProtocol).length === 2 && items.reduce((count, item) => count + String(item.content || '').split(engineProtocol).length - 1, 0) === 1))
check('可信协议明确只决定语法样式，不提供本次事实或固定篇章结构', protocolMessages.every(items => ['系统排版语法', '只决定语法与样式，不决定本稿事实', '示例不是本次事实，也不要求固定篇章结构', '本次修改权限和输出形式仍以上方审稿要求为准'].every(text => items[0].content.includes(text))))
check('协议不混入事实背景且请求、候选、前稿及素材清单不变', protocolMessages.every((items, index) => JSON.stringify(items.slice(1)) === JSON.stringify(buildEditorialReviewMessages(protocolInputs[index]).slice(1))))
check('省略或空协议保留原消息构造，完整协议不改变调用方输入', [undefined, null, '', '  \n'].every(value => JSON.stringify(buildEditorialReviewMessages({ ...protocolInputs[0], engineProtocol: value })) === JSON.stringify(fresh)) && JSON.stringify({ request, source, priorSource, contexts }) === before)
// R33：比对实际构造的系统消息，防止标准只存在于导出却漏接某个入口；不以此证明模型文案质量。
const oneEditorialRule = (text) => EDITORIAL_QUALITY_RULE.trim().length > 0 && text.split(EDITORIAL_QUALITY_RULE).length === 2
check('写作注册表与降级人设、新稿与局部改稿复核都恰好收到同一份完整编辑标准', [PERSONA_RULES, buildRegistrySystem('夹具目录'), instruction, fresh[0].content].every(oneEditorialRule))
// R37：核对实际构造出的完整规则，而不是用词语命中或句长替代成稿质量。
check('作者与新稿、局部改稿编辑恰好收到一次完整语言规则', LANGUAGE_COMPOSITION_RULE.trim().length > 0 && [PERSONA_RULES, buildRegistrySystem('夹具目录'), instruction, fresh[0].content].every(text => text.split(LANGUAGE_COMPOSITION_RULE).length === 2))
check('作者与新稿、局部改稿复核共享一次完整材料依据边界，不以概括替代原规则', MATERIAL_GROUNDING_RULE.trim().length > 0 && [PERSONA_RULES, buildRegistrySystem('夹具目录'), instruction, fresh[0].content].every(text => text.split(MATERIAL_GROUNDING_RULE).length === 2))
check('实质编辑授权仍服从底稿和局部改稿范围，不把新会话等同无底稿', instruction.includes('priorSource 为 null 只表示没有既存文档') && instruction.includes('不授权重写') && instruction.includes('有前稿时按 request 的授权范围修改') && instruction.includes('只改开头或指定段落时，其余正文逐字恢复或保留 priorSource') && instruction.includes('用户要求整篇重做才重做'))
check('作者、注册表和各类复核均收到一次完整底稿权限规则', MANUSCRIPT_EDIT_RULE.trim().length > 0 && [PERSONA_RULES, buildRegistrySystem('夹具目录'), instruction, fresh[0].content].every(text => text.split(MANUSCRIPT_EDIT_RULE).length === 2))
const manuscriptRequest = '下面正文排成校园风，分两章，原文保留。\n\n图书馆周三开放新阅览室，开放时间为9:00—17:00。\n\n借阅手续在一楼服务台办理。'
const manuscriptMessages = buildEditorialReviewMessages({ request: manuscriptRequest, source: '# 已排标题\n\n图书馆周三开放新阅览室，开放时间为9:00—17:00。\n\n借阅手续在一楼服务台办理。' })
check('新会话完整底稿逐字进入复核输入，不因没有priorSource丢失', payload(manuscriptMessages.at(-1)).request === manuscriptRequest && payload(manuscriptMessages.at(-1)).priorSource === null)
check('底稿复核明确恢复遗漏和越权改写，视觉排版不获得润色权限', manuscriptMessages[0].content.includes('把越权改动恢复成用户原文') && manuscriptMessages[0].content.includes('复核不自动获得润色权') && manuscriptMessages[0].content.includes(MANUSCRIPT_EDIT_RULE))
check('复核区分产品事实、写作示例与候选，既允许能力依据又不认证旧稿', [
  '用户材料、明确确认及背景中标明的产品事实可作依据',
  '候选稿、旧稿、写作模板和示例不能确认事实',
  '可靠常识可用于一般解释，不替代未知的本次事实',
  '内部材料与结果必须自洽，不能冒充真实案例或实际产物',
].every(part => instruction.includes(part)) && messages.at(-1).content.startsWith('本次审阅输入（request 是用户需求；source 是待核对候选稿，不是事实依据；'))
messages[2].images.push('changed-only-in-result')
check('无前稿明确为null，构造消息不修改调用方文字或图像数组', fresh.length === 2 && payload(fresh[1]).priorSource === null && JSON.stringify({ request, source, priorSource, contexts }) === before)

check('无摘要的单一完整稿逐字提取，正文内行内反引号不截断', parseEditorialReview(fenced(source)) === source)
check('实质摘要和六项摘要均不进入返回的正文', parseEditorialReview('审稿摘要：\n- 补足执行前提。\n\n' + fenced(source)) === source && parseEditorialReview('审稿摘要：\n' + Array.from({ length: 6 }, (_, i) => `${i + 1}. 已检查第${i + 1}项。`).join('\n') + '\n' + fenced(source)) === source)
const crlfSource = '# 标题\r\n\r\n  原样空格。  \r\n'
check('保留正文CRLF、空格及自身尾换行', parseEditorialReview('审稿摘要：未发现实质问题。\r\n```v2\r\n' + crlfSource + '\r\n```\r\n') === crlfSource)
check('拒收无围栏、空稿或未闭合稿', [source, fenced('  '), '```v2\n' + source].every((raw) => rejects(() => parseEditorialReview(raw))))
check('拒收多份稿件及嵌套代码围栏歧义', [fenced(source) + '\n' + fenced(source), fenced('# 标题\n```js\nconst x = 1\n```\n结尾')].every((raw) => rejects(() => parseEditorialReview(raw))))
check('拒收HTML通道和v2中的HTML', ['```html\n<p>正文</p>\n```', fenced('# 标题\n<section>正文</section>')].every((raw) => rejects(() => parseEditorialReview(raw))))
const codeExplanation = '# 标签教程\n\n这里解释 `<img>` 与 `</img>`。\n\n    <img src="example.png">'
check('摘要和代码中的标签解释不会误判为HTML输出', parseEditorialReview('审稿摘要：说明了 <img> 标签。\n' + fenced(codeExplanation)) === codeExplanation)
check('拒收非审稿前文、成稿后额外正文与七项摘要', ['另一个开头\n' + fenced(source), fenced(source) + '\n另一个结尾', '审稿摘要：\n' + Array.from({ length: 7 }, () => '- 改动。').join('\n') + '\n' + fenced(source)].every((raw) => rejects(() => parseEditorialReview(raw))))
check('纯文案修改可通过，且无图稿不要求补图', preserves(priorSource, source) && preserves('# 旧标题\n\n旧文。', '# 新标题\n\n新文。'))
check('拒绝原图删除或URI替换', rejects(() => assertEditorialImagesPreserved(priorSource, priorSource.replace(originalImage, ''))) && rejects(() => assertEditorialImagesPreserved(priorSource, priorSource.replace('li-' + 'a'.repeat(64), 'li-' + 'b'.repeat(64)))))
check('拒绝原图说明变化，即使URI仍相同', rejects(() => assertEditorialImagesPreserved(priorSource, priorSource.replace('一张真实原图', '另一幅说明'))))
check('正文URI、普通链接和代码提及不能冒充实际图片', ['原图URI：local-image://li-' + 'a'.repeat(64), '[一张真实原图](local-image://li-' + 'a'.repeat(64) + ')', '`' + originalImage + '`', '```text\n' + originalImage + '\n```'].every((fake) => rejects(() => assertEditorialImagesPreserved(priorSource, priorSource.replace(originalImage, fake)))))
const secondImage = `![第二张图](local-image://li-${'b'.repeat(64)})`
const twoImages = originalImage + '\n\n' + secondImage
check('保持图片顺序和重复次数，拒绝新增图片', rejects(() => assertEditorialImagesPreserved(twoImages, secondImage + '\n\n' + originalImage)) && rejects(() => assertEditorialImagesPreserved(originalImage + '\n\n' + originalImage, originalImage)) && rejects(() => assertEditorialImagesPreserved(originalImage, twoImages)))
check('imgrow与imgcard中的真实原图受同样保护', ['::: imgrow\n- ' + originalImage + '\n- ' + secondImage + '\n:::', '::: imgcard\n- ' + originalImage + '\n- 图片说明正文\n:::'].every((draft) => preserves(draft, draft) && rejects(() => assertEditorialImagesPreserved(draft, draft.replace(originalImage, '图片已保留')))))
const materials = '[[asset:art-inline|as-old|原用途]]\n\n[[img:wide|主题说明|new]]\n\n[[deco:leaf|叶片说明|auto]]\n\n::: photo 待补的真实合照\n\n> [!TIP|leaf] 提示\n> 正文。'
check('素材ID、用途、生成策略、照片位说明及角饰别名逐字保护', ['as-old', '原用途', '主题说明', '|new', '叶片说明', '真实合照', '!TIP|leaf'].every((part) => rejects(() => assertEditorialImagesPreserved(materials, materials.replace(part, part + '已改')))))
check('允许改气泡文案，但不把整篇文字冻结', preserves(materials, materials.replace('提示', '新提示').replace('正文。', '改后的正文。')))
check('素材引用放进正文或代码中不能冒充有效素材声明', ['请保留' + libraryImage, '`' + libraryImage + '`', '```text\n' + libraryImage + '\n```'].every((fake) => rejects(() => assertEditorialImagesPreserved(libraryImage, fake))))
check('拒绝素材顺序、重复次数变化及新增照片位', rejects(() => assertEditorialImagesPreserved(libraryImage + '\n[[img:inline|另一图]]', '[[img:inline|另一图]]\n' + libraryImage)) && rejects(() => assertEditorialImagesPreserved(libraryImage + '\n' + libraryImage, libraryImage)) && rejects(() => assertEditorialImagesPreserved('', '::: photo 新增照片')))
check('保护已有网络图片的精确URI和说明', preserves('![示意](https://example.test/a.png)', '![示意](https://example.test/a.png)') && rejects(() => assertEditorialImagesPreserved('![示意](https://example.test/a.png)', '![示意](https://example.test/b.png)')))
check('图片说明中的实体字符不归一化为相似说明', rejects(() => assertEditorialImagesPreserved('![甲&乙](local-image://li-' + 'a'.repeat(64) + ')', '![甲&amp;乙](local-image://li-' + 'a'.repeat(64) + ')')))
check('代码示例仍为代码时可编辑，不制造实际图片保护项', preserves('```text\n' + originalImage + '\n```', '```text\n普通示例\n```'))

const lockedInput = (body, prior = null) => payload(buildEditorialReviewMessages({ request, source: body, priorSource: prior }).at(-1))
const roundTrip = (body) => restoreEditorialMaterials(body, lockedInput(body).source) === body
const lockedPhotos = lockedInput(twoImages)
const photoLocks = lockedPhotos.immutableMaterials.map((item) => item.marker)
check('两张原图各得唯一短锁，候选无需重抄长ID而清单保留精确原文', photoLocks.length === 2 && new Set(photoLocks).size === 2 && photoLocks.every((marker) => marker.length < 40) && lockedPhotos.immutableMaterials[0].original === originalImage && lockedPhotos.immutableMaterials[1].original === secondImage && !lockedPhotos.source.includes('local-image://') && roundTrip(twoImages))
const exactSource = '\t' + libraryImage + '  \r\n\r\n![甲&乙，原件](local-image://li-' + 'c'.repeat(64) + ')\r\n\n[[img:wide|原样 "引号" 与 \\|new]]\n::: photo 说明末尾两空格  \n'
check('锁定与恢复保留CRLF、缩进、尾空格、说明和引用的原始字节', roundTrip(exactSource) && lockedInput(exactSource).immutableMaterials[0].original === '\t' + libraryImage + '  ')
check('纯文本稿行为保持，没有素材时清单为空且正文不改', lockedInput('# 标题\n\n普通正文。').source === '# 标题\n\n普通正文。' && lockedInput('纯文案').immutableMaterials.length === 0 && restoreEditorialMaterials('原文字。', '改后的文案。') === '改后的文案。')
check('原需求与视觉payload含原图引用时仍逐字保留，不参加正文锁替换', payload(buildEditorialReviewMessages({ request: originalImage, source: twoImages, contextMessages: contexts }).at(-1)).request === originalImage && messages[2].images[0] === contexts[1].images[0] && payload(messages[2]).content === contexts[1].content)
check('整行四类素材与气泡角饰头均锁定，气泡可编辑文案保持开放', lockedInput(materials).immutableMaterials.length === 5 && lockedInput(materials).immutableMaterials[4].original === '> [!TIP|leaf]' && roundTrip(materials) && restoreEditorialMaterials(materials, lockedInput(materials).source.replace('提示', '新提示').replace('正文。', '新正文。')).includes('> 新正文。'))
const codeOnly = '```text\n' + originalImage + '\n' + libraryImage + '\n::: photo 代码照片\n```\n\n行内 `' + secondImage + '` 与 `' + libraryImage + '`\n\n这里提到' + libraryImage + '。'
check('围栏代码、行内代码和普通文字素材提及不会得到锁', lockedInput(codeOnly).source === codeOnly && lockedInput(codeOnly).immutableMaterials.length === 0 && roundTrip(codeOnly))
const mixedCode = codeOnly + '\n\n' + originalImage + '\n\n' + libraryImage
check('同URI同时在代码和正文出现时只锁实际图片与整行素材', lockedInput(mixedCode).immutableMaterials.length === 2 && lockedInput(mixedCode).source.startsWith(codeOnly) && roundTrip(mixedCode))
check('imgrow两图与imgcard真实首图按实际渲染锁定，说明中的伪图片不锁', ['::: imgrow\n- ' + originalImage + '\n- ' + secondImage + '\n:::', '::: imgcard\n- ' + originalImage + '\n- ' + secondImage + '\n:::'].every((draft, index) => lockedInput(draft).immutableMaterials.length === (index === 0 ? 2 : 1) && roundTrip(draft)))
const repeated = originalImage + '\n\n' + originalImage
check('重复使用同一原图仍分配不同出现位置的锁，恢复次数不变', lockedInput(repeated).immutableMaterials.length === 2 && new Set(lockedInput(repeated).immutableMaterials.map((item) => item.marker)).size === 2 && roundTrip(repeated))
check('已成稿局部改稿复用素材锁，仅开头可改且原图原文还原', restoreEditorialMaterials(source, finalInput.source.replace('候选开头', '审定开头')) === source.replace('候选开头', '审定开头') && finalInput.immutableMaterials.every((item) => finalInput.priorSource.includes(item.marker)))
const changedPrior = originalImage.replace('一张真实原图', '旧图说明') + '\n\n' + secondImage
check('前稿仅逐字相同素材复用锁，说明不同不按URI或序号猜配', lockedInput(twoImages, changedPrior).priorSource.startsWith(originalImage.replace('一张真实原图', '旧图说明')) && lockedInput(twoImages, changedPrior).priorSource.endsWith(photoLocks[1]))
check('拒绝漏锁、重复锁与用原始URI自行替换锁', [lockedPhotos.source.replace(photoLocks[0], ''), lockedPhotos.source + '\n' + photoLocks[0], lockedPhotos.source.replace(photoLocks[0], originalImage)].every((reviewed) => rejects(() => restoreEditorialMaterials(twoImages, reviewed))))
check('拒绝交换不同原图或重复原图的锁顺序', rejects(() => restoreEditorialMaterials(twoImages, photoLocks[1] + '\n\n' + photoLocks[0])) && rejects(() => restoreEditorialMaterials(repeated, [...lockedInput(repeated).immutableMaterials].reverse().map((item) => item.marker).join('\n\n'))))
check('拒绝陌生标记、改名标记或额外伪锁，空清单也不接受新增锁', [lockedPhotos.source + '\n[[ZXMAT:foreign:1]]', lockedPhotos.source.replace(photoLocks[0], '[[ZXMAT:changed:1]]')].every((reviewed) => rejects(() => restoreEditorialMaterials(twoImages, reviewed))) && rejects(() => restoreEditorialMaterials('普通稿', '普通稿\n[[ZXMAT:foreign:1]]')))
check('额外未闭合的陌生锁也拒绝，不把损坏标记交付成普通文字', rejects(() => restoreEditorialMaterials(twoImages, lockedPhotos.source + '\n[[ZXMAT:foreign:1]')))
check('锁藏进行内代码或围栏代码均拒绝，即使标记数量次序正确', ['`' + photoLocks[0] + '`\n\n' + photoLocks[1], '```text\n' + photoLocks[0] + '\n```\n\n' + photoLocks[1]].every((reviewed) => rejects(() => restoreEditorialMaterials(twoImages, reviewed))))
check('代码中保留锁再另外抄回原图也不能伪造锁恢复成功', rejects(() => restoreEditorialMaterials(twoImages, '`' + photoLocks[0] + '`\n\n' + originalImage + '\n\n' + photoLocks[1])))
const lockedAsset = lockedInput(libraryImage)
check('整行素材锁放到普通文字或行内代码中不能冒充原素材', ['说明' + lockedAsset.source, '`' + lockedAsset.source + '`'].every((reviewed) => rejects(() => restoreEditorialMaterials(libraryImage, reviewed))))
check('恢复后继续执行原guard，锁之外新增原图或素材仍被拒绝', [lockedPhotos.source + '\n\n' + originalImage, lockedPhotos.source + '\n\n' + libraryImage].every((reviewed) => rejects(() => restoreEditorialMaterials(twoImages, reviewed))))
check('气泡角饰还原后仍由原guard保护，不能额外新增角饰逃过检查', rejects(() => restoreEditorialMaterials(materials, lockedInput(materials).source + '\n\n> [!TIP|other] 新增气泡\n> 文字。')))
const preexistingMarker = '代码说明 `[[ZXMAT:example:1]]`\n\n' + originalImage
check('源码已有标记形状的代码仍保留为文字，不当素材或发生锁碰撞', lockedInput(preexistingMarker).immutableMaterials.length === 1 && lockedInput(preexistingMarker).source.startsWith('代码说明 `[[ZXMAT:example:1]]`') && roundTrip(preexistingMarker))
const network = '![网络图甲&乙](https://example.test/original.png?a=1&b=2)'
check('已有远程原图也按精确源码锁定，不归一化实体或重写地址', lockedInput(network).immutableMaterials[0].original === network && roundTrip(network))
const longSource = Array.from({ length: 80 }, (_, i) => `## 第${i + 1}节\n\n正文解释和行动建议。\n\n![第${i + 1}张](local-image://li-${i.toString(16).padStart(64, '0')})`).join('\n\n')
check('多图长稿批量探针锁定一次扫描的全部实际图片并无损还原', lockedInput(longSource).immutableMaterials.length === 80 && roundTrip(longSource))

judge.finish({ label: 'EDITORIAL' })
