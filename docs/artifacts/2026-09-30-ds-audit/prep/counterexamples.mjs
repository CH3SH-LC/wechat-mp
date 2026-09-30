import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')
const outDir = dirname(fileURLToPath(import.meta.url))
const repo = 'D:/deepseek-harness/wechat-mp-desktop'
const SCENERY = readFileSync(join(repo, 'scripts/asset-completion-check.mjs'),'utf8').match(/const SCENERY = `([\s\S]*?)`/)[1]
const browser = await chromium.launch({headless:true, executablePath:'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'})
const context = await browser.newContext()
const page = await context.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(String(e)))
await page.goto('http://127.0.0.1:1448',{waitUntil:'networkidle'})
const result = await page.evaluate(async ({SCENERY})=>{
  const {runPrep,parseFinishArgs}=await import('/src/lib/prep.ts')
  const {isCreateRequest}=await import('/src/lib/needs.ts')
  const {emptyMaterializeInfo,materializePlaceholders}=await import('/src/lib/image-agent.ts')
  const {createLedger}=await import('/src/lib/asset-ledger.ts')
  const V2='[[theme:校园]]\n\n## 周末到馆提醒\n\n- 周六 9:00—17:00 开放。\n- 周日全天闭馆。\n\n咨询电话：010-55556666'
  const rows=[]
  const terminal=(value)=>({text:null,calls:[{id:'finish',name:'finish_preparation',args:JSON.stringify(value)}]})
  async function prep(name,{history=[],raw='请解释下面的内容',images,replies,opts={},expect}){
    const invocations=[]
    window.__TAURI_INTERNALS__={invoke:async(cmd,args)=>{
      if(cmd!=='prep_turn') throw new Error('Unexpected invoke '+cmd)
      invocations.push(structuredClone(args))
      const r=replies[Math.min(invocations.length-1,replies.length-1)]
      if(r.throw) throw new Error(r.throw)
      return r
    }}
    // Same boolean expression as App.tsx:745,752; uses production isCreateRequest.
    const creationContract=isCreateRequest(raw)||history.some(m=>m.role==='user'&&isCreateRequest(m.content))
    let outcome=null,threw=null
    try{outcome=await runPrep([{role:'system',content:'离线审计'},...history,{role:'user',content:raw,...(images?{images}: {})}],{runId:'audit-'+name,creationContract,hasPriorBindings:true,...opts})}catch(e){threw=String(e)}
    const observed={outcome,threw,invokeCount:invocations.length,creationContract,invocations}
    rows.push({name,expected:expect.description,pass:expect.check(observed),...observed})
  }
  const creativeHistory=[{role:'user',content:'请写一篇校园通知，配一张图。'},{role:'assistant',content:'已生成通知。'}]
  const noWrite={description:'ordinary Q&A must remain reply, never compose/candidate',check:r=>r.outcome?.kind==='reply'}
  await prep('history-not-ready',{history:creativeHistory,raw:'请解释 NOT READY 的意思，暂时不要编辑文稿。',replies:[{text:'NOT READY',calls:[]}],expect:noWrite})
  await prep('history-v2-example',{history:creativeHistory,raw:'请给我展示 v2 语法示例，暂时不要编辑文稿。',replies:[{text:'这是一个语法示例：\n```v2\n'+V2+'\n```',calls:[]}],expect:noWrite})
  await prep('structured-candidate-missing-policy',{replies:[terminal({outcome:'candidate',source:V2})],expect:{description:'candidate must explicitly declare asset policy; missing policy must not silently authorize',check:r=>r.outcome?.kind==='failed'}})
  await prep('structured-compose-invalid-policy',{replies:[terminal({outcome:'compose',assetPolicy:'erase'})],expect:{description:'unknown assetPolicy enum must be protocol failure',check:r=>r.outcome?.kind==='failed'}})
  await prep('structured-candidate-numeric-source',{replies:[terminal({outcome:'candidate',source:42,assetPolicy:'modify'})],expect:{description:'non-string source must be protocol failure',check:r=>r.outcome?.kind==='failed'}})
  await prep('structured-conflicting-fields',{replies:[terminal({outcome:'reply',text:'只解释，不编辑',source:V2,assetPolicy:'modify'})],expect:{description:'conflicting terminal fields must be protocol failure',check:r=>r.outcome?.kind==='failed'}})
  await prep('latest-user-images',{images:['data:image/png;base64,AA=='],replies:[terminal({outcome:'reply',text:'请说明图片用途'})],expect:{description:'last user images must be retained in actual prep request',check:r=>r.invocations[0].messages.some(m=>m.role==='user'&&m.images?.[0]==='data:image/png;base64,AA==')}})
  await prep('knowledge-terminal-mixed',{replies:[{text:null,calls:[{id:'know',name:'load_knowledge',args:'{"name":"engine-write-protocol"}'},...terminal({outcome:'compose',assetPolicy:'preserve'}).calls]}],expect:{description:'mixed knowledge and terminal calls must be protocol failure',check:r=>r.outcome?.kind==='failed'}})
  await prep('third-call-valid-compose',{replies:[{text:'',calls:[]},{text:'',calls:[]},terminal({outcome:'compose',assetPolicy:'preserve'})],expect:{description:'third valid compose still executes, exactly 3 prep invocations',check:r=>r.outcome?.kind==='compose'&&r.invokeCount===3}})
  await prep('all-empty-budget',{replies:[{text:'',calls:[]}],expect:{description:'three empty responses fail exhausted, no fourth invocation',check:r=>r.outcome?.kind==='failed'&&r.outcome.failure==='exhausted'&&r.invokeCount===3}})
  await prep('network-no-retry',{replies:[{throw:'HTTP 401 Unauthorized'}],expect:{description:'network/auth error must not authorize write or correction retry',check:r=>!r.outcome&&r.threw?.includes('401')&&r.invokeCount===1}})
  await prep('cancel-no-retry',{replies:[{throw:'已取消'}],expect:{description:'cancel must not authorize write or correction retry',check:r=>!r.outcome&&r.threw?.includes('取消')&&r.invokeCount===1}})
  await prep('no-draft-false-success',{history:creativeHistory,raw:'把正文精简一些',replies:[{text:'已经改好并保存了。',calls:[]}],expect:{description:'unstructured completion claim without draft/receipt must not be successful reply',check:r=>r.outcome?.kind==='failed'}})
  const pure=[]
  for(const [name,args] of [['null-object','null'],['multi-v2-source',JSON.stringify({outcome:'candidate',assetPolicy:'preserve',source:'```v2\nA\n```\n```v2\nB\n```'})]]){
    let value,threw=null;try{value=parseFinishArgs(args)}catch(e){threw=String(e)}
    pure.push({name,args,value,threw,pass:!threw&&value?.ok===false})
  }
  const assetRows=[]
  const oldDesc='暖色台灯照亮桌面上的蓝色书本，无任何文字'
  const oldSlot='[[img:wide|'+oldDesc+'|new]]'
  const oldSvg=SCENERY
  const newSvg=SCENERY.replaceAll('#e8dcc8','#2244aa')
  function meta(id,version=2){return {id,category:'art-wide',name:'library-art',title:'库中当前版本',desc:oldDesc,tags:[],usage:'wide',placement:'',style:[],palette_note:'',version,origin:'workshop',created_at:'2026-09-30',updated_at:'2026-09-30'}}
  async function materialize(name,{source,bindings,items,records,snapshots,expect}){
    const calls=[]
    window.__TAURI_INTERNALS__={invoke:async(cmd,args)=>{
      calls.push({cmd,args})
      if(cmd==='list_assets_report')return {items,unreadable:[]}
      if(cmd==='get_asset')return records[args.id]??null
      if(cmd==='gen_svg')throw new Error('已取消：offline audit blocks every model call')
      throw new Error('Unexpected invoke '+cmd)
    }}
    const info=emptyMaterializeInfo(),ledger=createLedger('audit-'+name)
    let sourceOut=null,threw=null
    try{sourceOut=await materializePlaceholders(source,'校园',info,{persist:false,ledger,assetPolicy:'preserve',priorBindings:bindings,snapshots})}catch(e){threw=String(e)}
    const observed={sourceOut,threw,info,ledger,calls,genCalls:calls.filter(x=>x.cmd==='gen_svg').length}
    assetRows.push({name,expected:expect.description,pass:expect.check(observed),...observed})
  }
  await materialize('preserve-absent-binding-new-slot',{source:'## 通知\n\n[[img:wide|蓝色书本旁的一盏台灯照亮桌面，暖色调，无任何文字|new]]',bindings:[{slot:oldSlot,id:'old-art'}],items:[],records:{},snapshots:{'old-art':{svg:oldSvg,ver:1}},expect:{description:'preserve with no exact binding must block before any gen_svg',check:r=>r.genCalls===0&&r.info.errors.length>0}})
  await materialize('preserve-document-snapshot-vs-library-update',{source:'## 通知\n\n'+oldSlot,bindings:[{slot:oldSlot,id:'snapshot-art'}],items:[meta('snapshot-art')],records:{'snapshot-art':{meta:meta('snapshot-art'),svg:newSvg}},snapshots:{'snapshot-art':{svg:oldSvg,ver:1}},expect:{description:'preserve must keep document snapshot v1 even when library is now v2',check:r=>r.genCalls===0&&r.sourceOut?.includes('#e8dcc8')&&!r.sourceOut?.includes('#2244aa')&&Object.values(r.ledger.slots).every(x=>x.version===1)}})
  await materialize('preserve-ambiguous-exact-bindings',{source:'## 通知\n\n'+oldSlot,bindings:[{slot:oldSlot,id:'ambiguous-a'},{slot:oldSlot,id:'ambiguous-b'}],items:[meta('ambiguous-a',1),meta('ambiguous-b',1)],records:{'ambiguous-a':{meta:meta('ambiguous-a',1),svg:oldSvg},'ambiguous-b':{meta:meta('ambiguous-b',1),svg:newSvg}},snapshots:{'ambiguous-a':{svg:oldSvg,ver:1},'ambiguous-b':{svg:newSvg,ver:1}},expect:{description:'ambiguous prior bindings must block rather than silently choose first',check:r=>r.genCalls===0&&r.info.errors.length>0&&!Object.values(r.ledger.slots).some(x=>x.status==='ok')}})
  delete window.__TAURI_INTERNALS__
  return {rows,pure,assetRows}
},{SCENERY})
await browser.close()
const hashes={}
for(const f of ['src/lib/prep.ts','src/lib/image-agent.ts','src/lib/needs.ts','src/App.tsx','src-tauri/src/chat.rs','scripts/prep-contract-check.mjs'])hashes[f]=createHash('sha256').update(readFileSync(join(repo,f))).digest('hex')
const all=[...result.rows,...result.pure,...result.assetRows]
const summary={scope:'Offline production modules via Vite; only Tauri invoke responses stubbed. Not model quality or real desktop/storage end-to-end.',total:all.length,pass:all.filter(r=>r.pass).length,fail:all.filter(r=>!r.pass).length,pageErrors:errors}
writeFileSync(join(outDir,'counterexamples.json'),JSON.stringify({summary,hashes,...result},null,2)+'\n')
writeFileSync(join(outDir,'counterexamples.md'),'# Preparation/materialization contract audit\n\n'+summary.scope+'\n\n'+all.map(r=>'- '+(r.pass?'PASS':'FAIL')+' '+r.name+': '+(r.expected||'invalid args must return protocol failure without throwing')).join('\n')+'\n\n'+JSON.stringify(summary)+'\n')
console.log(JSON.stringify(summary,null,2))
for(const r of all)console.log((r.pass?'PASS':'FAIL')+' '+r.name+(r.outcome?' -> '+r.outcome.kind:'')+(r.genCalls!==undefined?' gen_svg='+r.genCalls:''))
