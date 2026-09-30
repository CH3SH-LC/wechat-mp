import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const out=dirname(fileURLToPath(import.meta.url));
const repo='D:/deepseek-harness/wechat-mp-desktop';
const base=process.argv[2]||'http://127.0.0.1:1448';
const require=createRequire(import.meta.url);
const {chromium}=require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const q=await import('file:///'+repo+'/src/lib/delivery-quality.ts');
const facts='活动于9 月 1 日上午8 点 30 分在东区操场举行，负责接待的是张老师，预计100名新生参加。';
const title='[[theme:校园]]\n\n## 新生见面会\n\n';
const emoji='\n\n欢迎同学参加活动🎉，请提前了解集合安排。';
const noEmoji=emoji.replace('🎉','');
const cases=[
 {name:'place-only-loss',before:title+facts+emoji,after:title+facts.replace('在东区操场','')+noEmoji,wantAccepted:false},
 {name:'ampm-changed',before:title+facts+emoji,after:title+facts.replace('上午','下午')+noEmoji,wantAccepted:false},
 {name:'inline-phone-loss',before:title+'联系电话：`010-55556666`。'+emoji,after:title+'联系电话请见后续通知。'+noEmoji,wantAccepted:false},
 {name:'inline-phone-preserved',before:title+'联系电话：`010-55556666`。'+emoji,after:title+'联系电话：`010-55556666`。'+noEmoji,wantAccepted:true},
 {name:'standalone-emoji-preserved',before:title+facts+'\n\n🎉',after:title+facts,wantAccepted:true},
];
const wrap=s=>'已按要求写好。\n\n```v2\n'+s+'\n```';
const hashes=Object.fromEntries(['src/App.tsx','src/lib/delivery-quality.ts','src/lib/compose.ts','scripts/repair-integrity-check.mjs','scripts/repair-flow-check.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(join(repo,p))).digest('hex')]));
const result={createdAt:new Date().toISOString(),base,scope:'Current App, isolated browser localStorage. Only sendChatMock replaced. All compose, projection, matching, gate, candidate loop and persistence are production. No real model or desktop.',hashes,cases:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});
let failures=0;
try {
 for(const c of cases){
  const dir=join(out,c.name);mkdirSync(dir,{recursive:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:1024}});const page=await ctx.newPage();
  const errors=[],offsite=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith(base+'/')||u.startsWith('data:')||u.startsWith('blob:'))return route.fallback();offsite.push(u);return route.abort('blockedbyclient')});
  await page.route('**/src/lib/chat.ts*',async route=>{const r=await route.fetch();const js=await r.text();await route.fulfill({response:r,contentType:'application/javascript',body:js+`\nsendChatMock=function(messages,onDelta,onDone){const last=[...messages].reverse().find(x=>x.role==='user');const phase=String(last?.content||'').includes('【自动质检】')?'revise':'write';const response=phase==='revise'?${JSON.stringify(wrap(c.after))}:${JSON.stringify(wrap(c.before))};(window.__auditCalls||=[]).push({phase,response,lastUser:last?.content});let stopped=false;const timer=setTimeout(()=>{if(!stopped){onDelta(response);setTimeout(()=>{if(!stopped)onDone?.()},30)}},30);return{cancel:()=>{stopped=true;clearTimeout(timer)}}};`})});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('textarea').fill('直接写一篇校园风的新生见面会通知，不需要配图。');await page.locator('textarea').press('Enter');
  await page.waitForFunction(()=>window.__auditCalls?.length>=2&&!document.querySelector('.work-bubble')&&document.querySelector('[data-doc-state]'),null,{timeout:30000});
  await page.waitForTimeout(300);
  const state=await page.evaluate(async({before,after})=>{
   const q=await import('/src/lib/delivery-quality.ts');const {composeMarkdown}=await import('/src/lib/compose.ts');const {traceBuffer}=await import('/src/lib/trace.ts');
   const bh=composeMarkdown(before,{}).html,ah=composeMarkdown(after,{}).html;const bp=q.bodyText(bh),ap=q.bodyText(ah);const body=q.bodyIntegrity(bp,ap);const verdict=q.deliveryVerdict(q.issuesFromBody(body),{htmlOk:true,body,bodyApplicability:'applied'});
   const sessions=JSON.parse(localStorage.getItem('wxmp-sessions-v1')||'{}'),docs=JSON.parse(localStorage.getItem('wxmp-docs-v1')||'{}');
   return{calls:window.__auditCalls,trace:traceBuffer(),doc:docs.docs?.[sessions.current]||null,docState:document.querySelector('[data-doc-state]')?.getAttribute('data-doc-state'),control:{beforeHtml:bh,afterHtml:ah,beforeProjection:bp,afterProjection:ap,beforeFacts:q.extractFacts(bp),afterFacts:q.extractFacts(ap),body,verdict}};
  },c);
  const observed=state.doc?.accepted===true;const ok=observed===c.wantAccepted&&errors.length===0&&offsite.length===0;if(!ok)failures++;
  const summary={name:c.name,wantAccepted:c.wantAccepted,accepted:observed,expectationMet:ok,calls:state.calls.map(x=>x.phase),bodyApplied:state.trace.filter(x=>x.bodyApplicability==='applied').length,missingFacts:state.control.body.factsMissing,beforeFacts:state.control.beforeFacts,offsite,errors};
  result.cases.push(summary);writeFileSync(join(dir,'evidence.json'),JSON.stringify({fixture:c,...state,offsite,errors},null,2)+'\n');writeFileSync(join(dir,'saved-source.md'),state.doc?.source||'');await page.screenshot({path:join(dir,'final.png'),fullPage:true});console.log(JSON.stringify(summary));await ctx.close();
 }
}finally{await browser.close();writeFileSync(join(out,'boundary-summary.json'),JSON.stringify({...result,failedExpectations:failures},null,2)+'\n')}
process.exitCode=failures?1:0;
