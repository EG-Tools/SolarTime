/* Read-only by default. Explicit deployment round trip uses only a diagnostic probe record. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/windows-shutdown.js'),'utf8');
const constant=name=>new RegExp("const "+name+"='([^']+)'").exec(source)?.[1];
const API='https://solar-time.keg0320.workers.dev/api/windows-helper/';
async function receiptRoundTrip({fetchFn=fetch,revision=constant('HELPER_SHA256')}={}){
 const token=crypto.randomBytes(16).toString('hex'),complete=API+'diagnostic-complete?token='+token,status=API+'diagnostic-status?token='+token;
 const value={protocol:2,action:'probe',ok:true,code:0,revision,at:Date.now(),deadline:0};
 const call=(url,options={})=>fetchFn(url,{cache:'no-store',signal:AbortSignal.timeout(15000),...options});
 let posted=false;
 try{
  // This route accepts probe-only diagnostic records. There is no native URI,
  // no schedule request, and no access to another user's receipt namespace.
  const saved=await call(complete,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  if(saved.status!==204)throw Error('Diagnostic write HTTP '+saved.status);posted=true;
  const found=await call(status);if(!found.ok)throw Error('Diagnostic read HTTP '+found.status);
  if(JSON.stringify((await found.json()).result)!==JSON.stringify(value))throw Error('Diagnostic receipt mismatch');
 }finally{
  if(posted){const removed=await call(status,{method:'DELETE'});if(removed.status!==204)throw Error('Diagnostic cleanup HTTP '+removed.status);}
 }
 const removed=await call(status);if(!removed.ok||(await removed.json()).result!==null)throw Error('Diagnostic record was not removed');
 return {write:true,read:true,delete:true,checkedAt:new Date().toISOString(),nativeCommandExecuted:false};
}
async function verifyShutdown({health=true,roundtrip=false,fetchFn=fetch}={}){
 const expected=constant('HELPER_SHA256'),files=[];
 for(const name of ['HELPER_URL','HELPER_SOURCE_URL']){
  const url=constant(name),response=await fetchFn(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(name+' HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer()),sha256=crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if(sha256!==expected)throw Error(name+' SHA-256 mismatch');
  if(name==='HELPER_URL'&&!/attachment/i.test(response.headers.get('content-disposition')||''))throw Error('Helper is not delivered as an attachment');
  files.push({url,sha256,bytes:bytes.length});
 }
 let api=null;
 if(health){const response=await fetchFn(API+'health',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Receipt API HTTP '+response.status);api=await response.json();if(api.protocol!==2||api.receipts!==true)throw Error('Receipt API protocol mismatch');}
 if(roundtrip&&(!api?.diagnostics||!api?.rateLimits))throw Error('Diagnostic API or rate-limit bindings missing');
 const storage=roundtrip?await receiptRoundTrip({fetchFn,revision:expected}):null;
 return {checkedAt:new Date().toISOString(),files,api,storage,limitation:'Delivery/API verification only; no real PC shutdown is performed.'};
}
module.exports={verifyShutdown,receiptRoundTrip};
if(require.main===module){const args=process.argv.slice(2);if(args.some(a=>a!=='--roundtrip'))throw Error('Unknown verification option.');verifyShutdown({roundtrip:args.includes('--roundtrip')}).then(report=>{fs.mkdirSync(path.join(root,'.cloudflare'),{recursive:true});fs.writeFileSync(path.join(root,'.cloudflare/shutdown-verification.json'),JSON.stringify(report,null,2)+'\n');console.log('VERIFIED Windows helper bytes and receipt API'+(report.storage?' including R2 write/read/delete.':'.'));}).catch(error=>{console.error(error.message);process.exitCode=1;});}
