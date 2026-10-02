import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const out=fileURLToPath(new URL('.',import.meta.url)),repo=fileURLToPath(new URL('../../../../',import.meta.url))
const root=join(process.env.TEMP,'wxmp-pubver-1790940744'),old=join(process.env.TEMP,'wxmp-live-run1'),close=join(process.env.TEMP,'wxmp-closeout-20261002-192442-8591')
const sha=x=>createHash('sha256').update(x).digest('hex'), hashes=[]
const read=p=>{const b=readFileSync(p);hashes.push({path:p,bytes:b.length,sha256:sha(b)});return b},j=p=>JSON.parse(read(p))
const diff=(a,b)=>({added:Object.keys(b).filter(k=>!(k in a)),removed:Object.keys(a).filter(k=>!(k in b)),changed:Object.keys(a).filter(k=>k in b&&a[k]!==b[k])})
const files=(r)=>{const a={};const walk=p=>{for(const x of readdirSync(p,{withFileTypes:true})){const q=join(p,x.name);if(x.isDirectory())walk(q);else if(x.isFile())a[relative(r,q).replaceAll('\\','/')]=sha(readFileSync(q))}};walk(r);return a}
const a=j(join(close,'input-manifest-before.json')),b=j(join(close,'input-manifest-after.json'))
const am=Object.fromEntries(a.files.map(x=>[x.path,x.sha256])),bm=Object.fromEntries(b.files.map(x=>[x.path,x.sha256]))
const nowDrift=b.files.flatMap(x=>{const p=join(repo,x.path);return !existsSync(p)?[{path:x.path,state:'missing'}]:sha(readFileSync(p))!==x.sha256?[{path:x.path,state:'changed'}]:[]})
const input={before:{sha256:sha(readFileSync(join(close,'input-manifest-before.json'))),declared:a.fileCount,count:a.files.length,declaredBytes:a.totalBytes,sum:a.files.reduce((s,x)=>s+x.bytes,0)},after:{sha256:sha(readFileSync(join(close,'input-manifest-after.json'))),declared:b.fileCount,count:b.files.length,declaredBytes:b.totalBytes,sum:b.files.reduce((s,x)=>s+x.bytes,0)},beforeAfter:diff(am,bm),currentDrift:nowDrift,gitHead:a.gitHead}
const hashesDeclared=j(join(close,'release-hashes.json')), binaries=Object.entries(hashesDeclared).map(([name,x])=>({name,...x,currentSha256:sha(read(x.path)),matches:sha(readFileSync(x.path))===x.sha256}))
const ws=join(root,'profile/Documents/wechat-mp-workspace'),ows=join(old,'profile/Documents/wechat-mp-workspace')
const prior=j(join(repo,'docs/artifacts/2026-10-02-evening-review/live/sha256-manifest.json')).filter(x=>x.path.startsWith(old))
const originalProtected={previousManifestEntries:prior.length,changed:prior.filter(x=>!existsSync(x.path)||sha(readFileSync(x.path))!==x.sha256).map(x=>x.path),scope:'Only files hashed during previous independent review; not entire profile/webview.'}
const cloneComparison={documents:diff(files(join(ows,'documents')),files(join(ws,'documents'))),assets:diff(files(join(ows,'assets')),files(join(ws,'assets'))),traces:diff(files(join(ows,'traces')),files(join(ws,'traces'))),baselinesEqual:sha(read(join(old,'baselines.json')))===sha(read(join(root,'baselines.json')))}
const req=[]
for(const f of readdirSync(join(ws,'traces')).filter(x=>x.endsWith('.jsonl'))){for(const x of read(join(ws,'traces',f)).toString().trim().split('\n').map(JSON.parse)){if(x.kind==='request')req.push({...x,file:f})}}
const byStatus={},attempts=[],passes={}
for(const dir of readdirSync(join(root,'evidence'))){const base=join(root,'evidence',dir),r=j(join(base,'run-result.json')),e=j(join(base,'evidence.json'));byStatus[r.status]=(byStatus[r.status]||0)+1;attempts.push({dir,status:r.status,checks:r.checks.length,all:r.checks.every(x=>x.pass),errors:r.errors,exe:e.inputFingerprints.exe,ledgerBefore:e.ledgerBefore?.totals,ledgerAfter:e.ledgerAfter?.totals,rawRequestsDuringPhase:req.filter(x=>x.startedAt>=Date.parse(r.startedAt)&&x.startedAt<=Date.parse(r.finishedAt)).length});if(r.status==='PASS')passes[r.phase]={base,r,e};const cp=join(out,'original-results',dir);mkdirSync(cp,{recursive:true});for(const f of ['run-result.json','evidence.json'])copyFileSync(join(base,f),join(cp,f))}
const keys=['docId','generation','revisionId','runId','validation','sourceHash','htmlHash','qualityHash','bindingsHash','snapshotsHash','appSourceHash','appHtmlHash','appRevisionId','appGeneration'],eq=(x,y)=>Object.fromEntries(keys.map(k=>[k,JSON.stringify(x[k])===JSON.stringify(y[k])]))
const p5=passes.L5,bl5=j(join(p5.base,'L5-baseline.json')),bef=j(join(p5.base,'L5-before-shutdown.json')),aft=j(join(p5.base,'L5-after-reopen.json'))
const l5={baseline:{phase:bl5.phase,ok:bl5.ok,revisionId:bl5.revisionId,generation:bl5.generation},beforeEqual:eq(bef.stateA.view,bl5),afterEqual:eq(aft.stateB.view,bl5),differentPids:bef.pid!==aft.pidB,pids:[bef.pid,aft.pidB],probe:aft.probeB,closes:p5.e.launches.map(x=>x.closed)}
const p6=passes.L6,bl6=j(join(p6.base,'L6-baseline.json')),exp=j(join(p6.base,'L6-export.json')),hp=exp.htmlMsg.match(/已导出：(.+)$/)[1],pr=read(join(p6.base,'L6-preview-375.png'))
const l6={baselineMatchesL5:bl6.revisionId===bl5.revisionId,export:exp,htmlPath:hp,htmlHash:sha(read(hp)),htmlMatches:sha(readFileSync(hp))===bl6.htmlHash,htmlInAdded:exp.diff.added.includes(relative(exp.dir,hp).replaceAll('\\','/')),pngs:exp.diff.added.filter(x=>x.endsWith('.png')).map(rel=>{const buf=read(join(exp.dir,rel));return{path:join(exp.dir,rel),width:buf.readUInt32BE(16),height:buf.readUInt32BE(20),sha256:sha(buf)}}),preview:{path:join(p6.base,'L6-preview-375.png'),width:pr.readUInt32BE(16),height:pr.readUInt32BE(20)}}
const rev=join(ws,'documents',bl6.docId,'revisions',bl6.revisionId),meta=j(join(rev,'meta.json')),source=read(join(rev,'source.md')),html=read(join(rev,'article.html'))
const revision={manifest:j(join(ws,'documents',bl6.docId,'manifest.json')),sourceHash:sha(source),htmlHash:sha(html),sourceMatches:sha(source)===bl6.sourceHash&&sha(source)===meta.hashes.source,htmlMatches:sha(html)===bl6.htmlHash&&sha(html)===meta.hashes.html,snapshotsMatch:sha(Object.keys(meta.snapshots).sort().map(k=>`${k}@${meta.snapshots[k].ver}:${sha(meta.snapshots[k].svg)}`).join('\n'))===bl6.snapshotsHash,bindingsMatch:sha(meta.bindings.map(x=>`${x.slotId||''}|${x.slot||''}|${x.id||''}|${x.source||''}`).sort().join('\n'))===bl6.bindingsHash}
const inv=j(join(close,'attempt-inventory.json')),roots=inv.roots,actual=[]
for(const rt of roots){for(const dir of readdirSync(join(process.env.TEMP,rt,'evidence'))){const p=join(process.env.TEMP,rt,'evidence',dir,'run-result.json');actual.push(existsSync(p)?{root:rt,dir,status:j(p).status}:{root:rt,dir,status:'(无 run-result)'})}}
const counts=x=>x.reduce((a,v)=>(a[v.status]=(a[v.status]||0)+1,a),{})
const denominator={declaredCount:inv.rows.length,recounted:actual.length,counts:counts(actual),passes:actual.filter(x=>x.status==='PASS'),pubRootIncluded:roots.includes('wxmp-pubver-1790940744'),plusPubCount:actual.length+attempts.length,plusPubCounts:counts([...actual,...attempts])}
const led=j(join(process.env.TEMP,'wxmp-live-acceptance-budget.json'))
const interval=led.phases.filter(x=>x.at>='2026-10-02T10:14:00'&&x.at<'2026-10-02T10:17:20')
const deltaEvidence={totalsNow:led.totals,phaseRecordsInMissingL4Interval:interval,missingEvidenceStillAbsent:!existsSync(join(old,'evidence/L4-2026-10-02T10-14-12-2927b2d0/evidence.json')),caution:'Neighbor snapshots and available trace strongly associate delta with missing L4, but do not provide its own start/end or per-dispatch identity receipt.'}
const result={input,binaries,attempts,byStatus,originalProtected,cloneComparison,l5,l6,revision,denominator,deltaEvidence}
writeFileSync(join(out,'audit-summary.json'),JSON.stringify(result,null,2)+'\n');writeFileSync(join(out,'sha256-manifest.json'),JSON.stringify([...new Map(hashes.map(x=>[x.path,x])).values()],null,2)+'\n')
console.log(JSON.stringify({input,binaries:binaries.map(x=>({name:x.name,matches:x.matches,sha:x.currentSha256})),attempts:attempts.map(x=>({dir:x.dir,status:x.status,checks:x.checks,rawRequestsDuringPhase:x.rawRequestsDuringPhase})),originalProtected,cloneComparison,revision,denominator},null,2))
