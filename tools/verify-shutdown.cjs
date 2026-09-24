/* Read-only verification; never schedules or cancels a real Windows shutdown. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/windows-shutdown.js'),'utf8');
const constant=name=>new RegExp("const "+name+"='([^']+)'").exec(source)?.[1];
async function verifyShutdown({health=true}={}){
 const expected=constant('HELPER_SHA256'),files=[];
 for(const name of ['HELPER_URL','HELPER_SOURCE_URL']){
  const url=constant(name),response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(name+' HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer()),sha256=crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if(sha256!==expected)throw Error(name+' SHA-256 mismatch');
  if(name==='HELPER_URL'&&!/attachment/i.test(response.headers.get('content-disposition')||''))throw Error('Helper is not delivered as an attachment');
  files.push({url,sha256,bytes:bytes.length});
 }
 let api=null;
 if(health){const response=await fetch('https://solar-time.keg0320.workers.dev/api/windows-helper/health',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Receipt API HTTP '+response.status);api=await response.json();if(api.protocol!==2||api.receipts!==true)throw Error('Receipt API protocol mismatch');}
 return {checkedAt:new Date().toISOString(),files,api,limitation:'Delivery/API verification only; no real PC shutdown is performed.'};
}
module.exports={verifyShutdown};
if(require.main===module)verifyShutdown().then(report=>{fs.mkdirSync(path.join(root,'.cloudflare'),{recursive:true});fs.writeFileSync(path.join(root,'.cloudflare/shutdown-verification.json'),JSON.stringify(report,null,2)+'\n');console.log('VERIFIED Windows helper bytes and receipt API.');}).catch(error=>{console.error(error.message);process.exitCode=1;});
