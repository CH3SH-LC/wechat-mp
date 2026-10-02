import { closeOwnPid } from '../../../../scripts/lib/desktop-harness.mjs';
import { writeFileSync } from 'node:fs';
const exe = 'C:\\apps\\wechat-mp-desktop.exe';
const expectedIdentity = { pid:987654, actualImage:'wechat-mp-desktop.exe', actualPath:exe, actualStartTime:100000 };
const cases=[];
for (const kind of ['explicit-mismatch','unknown-all','unknown-path-and-time','force-after-identity-changes']) {
  let alive=true, probeCount=0; const calls=[];
  const probe=()=>{ probeCount++; if(kind==='explicit-mismatch') return {ok:true,image:'other.exe',path:'C:\\other.exe',startTime:200000}; if(kind==='unknown-all') return {ok:false}; if(kind==='unknown-path-and-time') return {ok:true,image:'wechat-mp-desktop.exe',path:null,startTime:null}; return calls.length===0 ? {ok:true,image:'wechat-mp-desktop.exe',path:exe,startTime:100000} : {ok:true,image:'other.exe',path:'C:\\other.exe',startTime:200000}; };
  const runner=args=>{ calls.push(args); if(kind!=='force-after-identity-changes') alive=false; return {ok:true}; };
  const result=await closeOwnPid(987654,{exe,expectedIdentity,probe,alive:()=>alive,runner,gracefulMs:0,forceMs:0});
  cases.push({kind,calls,probeCount,result,allOsOperationsMocked:true});
}
const result={checkedAt:new Date().toISOString(),cases,noRealProcessOperations:true,noNetwork:true,noModels:true};
writeFileSync(new URL('./identity-probe-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
