import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync, copyFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { factChecks } from '../../../../scripts/lib/fact-assert.mjs'
const out = fileURLToPath(new URL('.', import.meta.url))
const root = join(process.env.TEMP, 'wxmp-live-run1')
const evRoot = join(root, 'evidence')
const ws = join(root, 'profile/Documents/wechat-mp-workspace')
const digest = x => createHash('sha256').update(x).digest('hex')
const hashes = []
const read = p => { const bytes=readFileSync(p); hashes.push({path:p,bytes:bytes.length,sha256:digest(bytes)});return bytes }
const json = p => JSON.parse(read(p))
const results = []
const pass = {}
for (const dir of readdirSync(evRoot)) {
  const base=join(evRoot,dir), resultPath=join(base,'run-result.json')
  if (!existsSync(resultPath)) { results.push({dir,status:'NO_RESULT',files:readdirSync(base)});for(const name of readdirSync(base)){read(join(base,name));const dest=join(out,'original-results',dir);mkdirSync(dest,{recursive:true});copyFileSync(join(base,name),join(dest,name))}continue }
  const run=json(resultPath), ev=json(join(base,'evidence.json'))
  results.push({dir,phase:run.phase,status:run.status,startedAt:run.startedAt,finishedAt:run.finishedAt,checks:run.checks.length,allChecksPass:run.checks.every(x=>x.pass),executionComplete:run.executionComplete,errors:run.errors,failed:run.checks.filter(x=>!x.pass),ledgerBefore:ev.ledgerBefore?.totals,ledgerAfter:ev.ledgerAfter?.totals,turns:ev.turns.map(t=>({startedAt:t.startedAt,t0:t.t0,dispatch:t.dispatchAfter,draw:t.genSvgAfter,transport:t.transportAfter,transportDraw:t.transportDrawAfter})),exe:ev.inputFingerprints.exe})
  if(run.status==='PASS') pass[run.phase]={base,run,ev}
  const copyDir=join(out,'original-results',dir);mkdirSync(copyDir,{recursive:true})
  for(const name of ['run-result.json','evidence.json'])copyFileSync(join(base,name),join(copyDir,name))
}
const traces=[]
for(const file of readdirSync(join(ws,'traces')).filter(x=>x.endsWith('.jsonl'))) {
  const bytes=read(join(ws,'traces',file)),records=String(bytes).trim().split('\n').map(JSON.parse)
  traces.push({file,requests:records.filter(x=>x.kind==='request'),ending:records.filter(x=>x.kind==='run').at(-1)||null})
  const cp=join(out,'original-traces');mkdirSync(cp,{recursive:true});writeFileSync(join(cp,file),bytes)
}
const phaseChecks={}
const allRequests=traces.flatMap(t=>t.requests.map(x=>({...x,file:t.file})))
const viewKeys=['docId','generation','revisionId','runId','validation','sourceHash','htmlHash','qualityHash','bindingsHash','snapshotsHash','appSourceHash','appHtmlHash','appRevisionId','appGeneration']
const equalFields=(a,b,keys=viewKeys)=>Object.fromEntries(keys.map(k=>[k,JSON.stringify(a[k])===JSON.stringify(b[k])]))
const diskFor=(view)=>{
  const rev=join(ws,'documents',view.docId,'revisions',view.revisionId)
  const meta=json(join(rev,'meta.json')),source=read(join(rev,'source.md')),html=read(join(rev,'article.html'))
  const snapRows=Object.keys(meta.snapshots||{}).sort().map(k=>`${k}@${meta.snapshots[k].ver}:${digest(meta.snapshots[k].svg||'')}`)
  const bindingRows=(meta.bindings||[]).map(b=>`${b.slotId||''}|${b.slot||''}|${b.id||''}|${b.source||''}`).sort()
  return {revisionId:view.revisionId,sourceHash:digest(source),htmlHash:digest(html),sourceMatch:digest(source)===view.sourceHash,htmlMatch:digest(html)===view.htmlHash,metaSourceMatch:digest(source)===meta.hashes.source,metaHtmlMatch:digest(html)===meta.hashes.html,snapshotsMatch:digest(snapRows.join('\n'))===view.snapshotsHash,bindingsMatch:digest(bindingRows.join('\n'))===view.bindingsHash,qualityMatch:digest(JSON.stringify(meta.quality))===view.qualityHash,snapshots:snapRows,bindings:meta.bindings,qualityOk:meta.quality.ok,qualityBlockers:meta.quality.blockers.length,qualityUnverified:meta.quality.unverified,qualityWarnings:meta.quality.warnings.map(x=>({code:x.code,message:x.message})),sourceText:source.toString()}
}
for(const phase of ['L1','L2','L3','L4']) {
  const p=pass[phase],s=json(join(p.base,phase+'-state.json')),after=s.state||s.after
  const raw=allRequests.filter(r=>s.recon.requests.some(x=>x.startedAt===r.startedAt && x.runId+'.jsonl'===r.file))
  const checked={recon:s.recon,rawRequestCount:raw.length,rawDrawCount:raw.filter(x=>x.phase==='gen_svg').length,allRawRequestsOk:raw.every(x=>x.ok===true),rawExactlyMatchesReconcile:raw.length===s.recon.requests.length,disk:diskFor(after.view),body:after.ui.article,independentFacts:factChecks(after.ui.article,after.ui.article.titleNodeText,{expectTitle:after.ui.article.titleNodeText,limit180:180}),baseline:s.baseline&&{phase:s.baseline.phase,ok:s.baseline.ok,revision:s.baseline.revisionId},beforeAfter:s.before?equalFields(s.before.view,after.view):null}
  if(phase==='L2')checked.preservedAssetIdentity=JSON.stringify(s.before.view.assetIdentity)===JSON.stringify(after.view.assetIdentity)
  if(phase==='L3'){checked.noDocumentWrites=s.thisTurnCalls.every(x=>!['save_document','save_document_draft','commit_document_revision'].includes(x));checked.models=s.thisTurnModels;checked.calls=s.thisTurnCalls;checked.sameBody=s.before.ui.article.counted===after.ui.article.counted}
  if(phase==='L4'){checked.sameText=s.before.ui.article.counted===after.ui.article.counted&&s.before.ui.article.titleNodeText===after.ui.article.titleNodeText;checked.newAsset=JSON.stringify(s.before.view.assetIdentity)!==JSON.stringify(after.view.assetIdentity);checked.sameTextAsL2=s.baseline.counted===after.ui.article.counted}
  phaseChecks[phase]=checked
}
const p5=pass.L5, b5=json(join(p5.base,'L5-baseline.json')), a5=json(join(p5.base,'L5-before-shutdown.json')), z5=json(join(p5.base,'L5-after-reopen.json'))
const rangeReq=p=>allRequests.filter(x=>x.startedAt>=Date.parse(p.run.startedAt)&&x.startedAt<=Date.parse(p.run.finishedAt))
phaseChecks.L5={baseline:{ok:b5.ok,phase:b5.phase,revisionId:b5.revisionId},beforeEqual:equalFields(a5.stateA.view,b5),afterEqual:equalFields(z5.stateB.view,b5),pidA:a5.pid,pidB:z5.pidB,differentPids:a5.pid!==z5.pidB,rawRequestsDuringWholePhase:rangeReq(p5),probe:z5.probeB,closes:p5.ev.launches.map(x=>({pid:x.pid,startedAt:x.startedAt,closed:x.closed}))}
const p6=pass.L6,b6=json(join(p6.base,'L6-baseline.json')),exp=json(join(p6.base,'L6-export.json')),htmlPath=exp.htmlMsg.match(/已导出：(.+)$/)[1]
const pngs=exp.diff.added.filter(x=>x.endsWith('.png')).map(rel=>{const b=read(join(exp.dir,rel));return{rel,sha256:digest(b),bytes:b.length,width:b.readUInt32BE(16),height:b.readUInt32BE(20)}})
const preview=read(join(p6.base,'L6-preview-375.png'))
phaseChecks.L6={baseline:{ok:b6.ok,phase:b6.phase,revisionId:b6.revisionId},sameBaselineAsL5:b5.revisionId===b6.revisionId,htmlPath,htmlPathInAdded:exp.diff.added.includes(relative(exp.dir,htmlPath).replaceAll('\\','/')),htmlHash:digest(read(htmlPath)),htmlMatchesBaseline:digest(readFileSync(htmlPath))===b6.htmlHash,exportInventory:exp,pngs,preview:{path:join(p6.base,'L6-preview-375.png'),width:preview.readUInt32BE(16),height:preview.readUInt32BE(20)},rawRequestsDuringWholePhase:rangeReq(p6)}
const manifest=json(join(ws,'documents',b6.docId,'manifest.json'))
const baselines=json(join(root,'baselines.json'))
for(const rel of ['scripts/live-acceptance.mjs','scripts/lib/fact-assert.mjs','scripts/lib/trace-read.mjs','scripts/live-driver-check.mjs','scripts/fact-assert-check.mjs','scripts/lib/desktop-harness.mjs'])read(fileURLToPath(new URL('../../../../'+rel,import.meta.url)))
const summary={root,workspace:ws,readOnly:true,results:results.sort((a,b)=>String(a.startedAt||a.dir).localeCompare(String(b.startedAt||b.dir))),phaseChecks,traceTotals:{requests:allRequests.length,genSvg:allRequests.filter(x=>x.phase==='gen_svg').length},manifest,currentBaseline:{latest:baselines.latest,byPhase:Object.fromEntries(Object.entries(baselines.byPhase).map(([k,v])=>[k,{ok:v.ok,revisionId:v.revisionId,at:v.at}]))},missingResultTrace:traces.find(t=>t.file==='rmuqt34d0-1.jsonl')}
writeFileSync(join(out,'audit-summary.json'),JSON.stringify(summary,null,2)+'\n')
writeFileSync(join(out,'sha256-manifest.json'),JSON.stringify([...new Map(hashes.map(x=>[x.path,x])).values()],null,2)+'\n')
console.log(JSON.stringify({results:results.map(x=>({dir:x.dir,status:x.status})),phases:Object.fromEntries(Object.entries(phaseChecks).map(([k,v])=>[k,{rawRequests:v.rawRequestCount,diskMatches:v.disk&&v.disk.sourceMatch&&v.disk.htmlMatch&&v.disk.snapshotsMatch,sameText:v.sameText,noDocumentWrites:v.noDocumentWrites,rawRequestsWholePhase:v.rawRequestsDuringWholePhase?.length,htmlMatchesBaseline:v.htmlMatchesBaseline}])),traceTotals:summary.traceTotals,manifest,output:out},null,2))
