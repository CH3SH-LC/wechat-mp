import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const out = process.argv[3] || path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(out,{recursive:true});
const base = process.argv[2] || 'http://127.0.0.1:1448';
const browser = await chromium.launch({ headless:true, executablePath:'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' });
const results = [];
try {
  const context = await browser.newContext({ viewport:{width:1100,height:800}, deviceScaleFactor:1 });
  const page = await context.newPage();
  let active = null;
  const attempts = [];
  const errors = [];
  page.on('request', r => {
    const u=r.url();
    if (active && /^https?:/.test(u) && (r.frame()?.url()==='about:srcdoc' || !u.startsWith(base+'/'))) {
      attempts.push({case:active,url:u,type:r.resourceType(),frame:r.frame()?.url()});
    }
  });
  page.on('pageerror', e => errors.push({case:active,error:String(e)}));
  await page.route('**/*', async route => {
    const r=route.request(), u=r.url();
    if (/^https?:/.test(u) && (r.frame()?.url()==='about:srcdoc' || !u.startsWith(base+'/'))) {
      return route.fulfill({status:200,contentType:r.resourceType()==='stylesheet'?'text/css':'image/png',body:r.resourceType()==='stylesheet'?'':Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')});
    }
    return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  const png = await page.evaluate(async () => {
    const source=await fetch('/src/components/PreviewPane.tsx').then(r=>r.text());
    const imports=[...source.matchAll(/from\s+["']([^"']+)["']/g)].map(m=>m[1]);
    const reactPath=imports.find(s=>s.includes('/react.js'));
    if(!reactPath) throw Error('React optimized dependency was not observed in module');
    const react=await import(reactPath);
    const domSource=await fetch('/src/main.tsx').then(r=>r.text());
    const domImports=[...domSource.matchAll(/from\s+["']([^"']+)["']/g)].map(m=>m[1]);
    const domPath=domImports.find(s=>s.includes('react-dom_client'));
    if(!domPath) throw Error('ReactDOM optimized dependency was not observed in entry module');
    const dom=await import(domPath);
    const pane=await import('/src/components/PreviewPane.tsx');
    const safe=await import('/src/lib/preview-safe.ts');
    const host=document.createElement('main');host.id='boundary-audit-root';document.body.replaceChildren(host);
    window.auditReact=react.createElement?react:react.default;window.auditPane=pane.default;window.auditRoot=(dom.createRoot?dom:dom.default).createRoot(host);window.auditSafe=safe.neutralizeExternalResources;
    const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/png');
  });
  const cases = [
    {id:'quoted-img-control',html:'<img id="probe" src="https://example.com/control.png">'},
    {id:'unquoted-img',html:'<img id="probe" src=https://example.com/unquoted.png>'},
    {id:'entity-img',html:'<img id="probe" src="https:&#x2f;&#x2f;example.com/entity.png">'},
    {id:'css-import-string',html:'<style>@import "https://example.com/theme.css";</style><p>通知正文</p>'},
    {id:'css-html-entity-url',html:'<div id="probe" style="background-image:url(&quot;https://example.com/css-entity.png&quot;);width:20px;height:20px">正文</div>'},
    {id:'css-style-preservation',html:'<div id="probe" style="background-image:url(https://example.com/background.png);color:rgb(1, 2, 3);height:20px">正文</div>', expectedColor:'rgb(1, 2, 3)'},
    {id:'data-img-control',html:`<img id="probe" src="${png}">`,localImage:true},
    {id:'mixed-srcset-data',html:`<img id="probe" srcset="${png} 1x, https://example.com/2x.png 2x">`,localImage:true},
  ];
  for(const test of cases) {
    active=test.id;
    const before=attempts.length;
    const sanitized=await page.evaluate(({html,id})=>{
      window.auditRoot.render(window.auditReact.createElement(window.auditPane,{key:id,html,quality:null,onClear:()=>{},busy:true,docState:{kind:'repairing',attempt:1}}));
      return window.auditSafe(html);
    },{html:test.html,id:test.id});
    await page.waitForFunction(()=>!!document.querySelector('#boundary-audit-root iframe')?.contentDocument?.body);
    await page.waitForTimeout(650);
    const dom=await page.evaluate(()=>{
      const f=document.querySelector('#boundary-audit-root iframe'),d=f.contentDocument,p=d.querySelector('#probe');
      return {body:d.body.innerHTML,srcdoc:f.srcdoc,tag:p?.tagName,attrs:p?Object.fromEntries([...p.attributes].map(a=>[a.name,a.value])):null,currentSrc:p?.currentSrc,naturalWidth:p?.naturalWidth,color:p?d.defaultView.getComputedStyle(p).color:null,background:p?d.defaultView.getComputedStyle(p).backgroundImage:null};
    });
    const caseAttempts=attempts.slice(before);
    const checks={noResourceRequests:caseAttempts.length===0,...(test.localImage?{localImageVisible:dom.naturalWidth===2,currentSrcPreserved:dom.currentSrc===png}:{}),...(test.expectedColor?{unrelatedStylePreserved:dom.color===test.expectedColor}:{})};
    results.push({id:test.id,input:test.html,sanitized,attempts:caseAttempts,dom,checks,pass:Object.values(checks).every(Boolean)});
    console.log(JSON.stringify({id:test.id,attempts:caseAttempts.map(a=>a.url),checks}));
  }
  await page.screenshot({path:path.join(out,'boundary-last-case.png')});
  const files=['src/lib/preview-safe.ts','src/components/PreviewPane.tsx'];
  const hashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join('D:/deepseek-harness/wechat-mp-desktop',f))).digest('hex')]));
  fs.writeFileSync(path.join(out,'boundary-results.json'),JSON.stringify({time:new Date().toISOString(),base,scope:'Fresh isolated Chromium context, actual PreviewPane component and srcdoc boundary. Routes fulfill resource attempts locally; no desktop or model started.',hashes,attempts,errors,results},null,2));
  process.exitCode=results.every(r=>r.pass)?0:1;
} finally { await browser.close(); }
