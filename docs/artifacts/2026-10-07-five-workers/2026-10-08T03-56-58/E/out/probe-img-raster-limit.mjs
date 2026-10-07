import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const pw = require(join(process.env.TEMP,'pw-deps','node_modules','playwright-core'))
const s = await createServer({root:'D:/deepseek-harness/wechat-mp-desktop',configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:1504,strictPort:true}})
await s.listen()
const b = await pw.chromium.launch({executablePath: join(process.env.LOCALAPPDATA,'ms-playwright','chromium-1234','chrome-win64','chrome.exe'), headless:true})
const p = await b.newPage({viewport:{width:900,height:900}})
await p.goto('http://127.0.0.1:1504/',{waitUntil:'commit',timeout:120000})
await p.waitForFunction(()=>document.readyState!=='loading'&&!!document.body,null,{timeout:120000})
const cases = {
  inline_svg: '<p>a</p><svg xmlns="http://www.w3.org/2000/svg" width="343" height="260" style="display:block"><rect width="343" height="260" fill="#eef7f6"/></svg>',
  div_block: '<p>a</p><div style="width:343px;height:260px;background:#eef7f6"></div>',
  png_img: '<p>a</p><img style="width:343px;height:260px;display:block" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">',
}
for (const [name,html] of Object.entries(cases)) {
  const r = await p.evaluate(async(html)=>{ try{ const m=await import('/src/lib/htmlToImage.ts'); const res=await m.renderArticleImages(html); return {ok:true,cssH:res.cssH} }catch(e){ return {ok:false,err:String(e).slice(0,120)} } }, html)
  console.log(name, JSON.stringify(r))
}
await b.close(); await s.close()
