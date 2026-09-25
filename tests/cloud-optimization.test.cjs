'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'cloudflare/worker.js'),'utf8');
const {receiptRoundTrip}=require('../tools/verify-shutdown.cjs');
const {helperPlan,uploadWindowsHelper}=require('../tools/upload-windows-helper.cjs');
function fixture(){
 const values=new Map(),wait=[],calls=[];
 const bucket={async put(key,body,options={}){if(options.onlyIf&&values.has(key))return null;calls.push(['put',key]);values.set(key,{body,uploaded:new Date()});return {key};},async get(key){calls.push(['get',key]);const v=values.get(key);return v?{json:async()=>JSON.parse(v.body)}:null;},async head(key){return values.has(key)?{}:null;},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys]){calls.push(['delete',key]);values.delete(key);}},async list({prefix}){return {objects:[...values].filter(([k])=>k.startsWith(prefix)).map(([key,v])=>({key,uploaded:v.uploaded})),truncated:false};}};
 const worker=new Function('crypto',source.replace('export default','return'))(require('node:crypto').webcrypto),env={SOLAR_TIME_MEDIA:bucket,ASSETS:{fetch:()=>new Response('asset')}},ctx={waitUntil:p=>wait.push(p)};
 const fetchFn=(url,options)=>worker.fetch(new Request(url,options),env,ctx);
 return {values,calls,worker,env,bucket,ctx,fetchFn,settle:()=>Promise.all(wait.splice(0))};
}
const token='a'.repeat(32),base='https://solar.test/api/windows-helper/',post=body=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const receipt=action=>({protocol:2,action,ok:true,code:0,revision:'A'.repeat(64),at:Date.now(),deadline:action==='schedule'?Date.now()+60000:0});
test('diagnostic roundtrip actually writes, reads and deletes a probe-only receipt',async()=>{
 const f=fixture(),report=await receiptRoundTrip({fetchFn:f.fetchFn,revision:'A'.repeat(64)});assert.equal(report.nativeCommandExecuted,false);assert.equal(f.values.size,0);assert.ok(f.calls.some(c=>c[0]==='put'));assert.ok(f.calls.some(c=>c[0]==='delete'));assert.ok(f.calls.every(c=>c[1].startsWith('releases/runtime/windows-helper-v2/diagnostic/')));
});
test('diagnostic route cannot schedule a PC or delete native operation and installation receipts',async()=>{
 const f=fixture();assert.equal((await f.fetchFn(base+'diagnostic-complete?token='+token,post(receipt('schedule')))).status,400);
 assert.equal((await f.fetchFn(base+'operation-complete?token='+token,post(receipt('cancel')))).status,204);
 assert.equal((await f.fetchFn(base+'operation-status?token='+token,{method:'DELETE'})).status,405);
 await f.fetchFn(base+'diagnostic-status?token='+token,{method:'DELETE'});assert.ok(f.values.has('releases/runtime/windows-helper-v2/operation/'+token));
});
test('receipt rate limits reject excess requests before accessing R2 and expose a retry delay',async()=>{
 const f=fixture();f.env.HELPER_TOKEN_LIMIT={limit:async()=>({success:false})};const response=await f.fetchFn(base+'operation-status?token='+token);assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');assert.equal(f.calls.length,0);
});
test('network safety counters hash addresses and separate reads from writes; fresh cancel IDs do not inherit schedule quota',async()=>{
 const f=fixture(),keys=[],read=[],write=[];f.env.HELPER_TOKEN_LIMIT={limit:async({key})=>{keys.push(key);return {success:!key.endsWith('a'.repeat(32))};}};f.env.HELPER_READ_LIMIT={limit:async({key})=>{read.push(key);return {success:true};}};f.env.HELPER_WRITE_LIMIT={limit:async({key})=>{write.push(key);return {success:true};}};
 const opts={headers:{'cf-connecting-ip':'192.0.2.1'}};assert.equal((await f.fetchFn(base+'operation-status?token='+token,opts)).status,429);
 const fresh='b'.repeat(32);assert.equal((await f.fetchFn(base+'operation-complete?token='+fresh,{...post(receipt('cancel')),headers:{...opts.headers,'content-type':'application/json'}})).status,204);
 assert.equal((await f.fetchFn(base+'operation-status?token='+fresh,opts)).status,200);assert.equal(read.length,1);assert.equal(write.length,1);assert.match(read[0],/^[0-9a-f]{64}$/);assert.equal(read[0],write[0]);assert.ok(!JSON.stringify(f.calls).includes('192.0.2.1'));
});
test('a failed rate-limit backend does not prevent native cancellation confirmations',async()=>{
 const f=fixture();f.env.HELPER_TOKEN_LIMIT={limit:async()=>{throw Error('unavailable');}};assert.equal((await f.fetchFn(base+'operation-complete?token='+token,post(receipt('cancel')))).status,204);
});
test('bounded cleanup resumes its cursor next time and never enumerates media prefixes',async()=>{
 const f=fixture(),requests=[],prefix='releases/runtime/windows-helper-v2/';f.bucket.list=async({prefix:p,cursor})=>{requests.push([p,cursor]);if(p!==prefix)return {objects:[],truncated:false};const page=Number(cursor||0);return {objects:[],truncated:page<11,cursor:String(page+1)};};
 await f.worker.scheduled({},f.env,f.ctx);await f.settle();
 const report=JSON.parse(f.values.get('releases/runtime/windows-helper-cleanup.json').body);assert.equal(report.cursors[prefix],'10');
 await f.worker.scheduled({},f.env,f.ctx);await f.settle();const second=JSON.parse(f.values.get('releases/runtime/windows-helper-cleanup.json').body);assert.equal(second.complete,true);assert.ok(requests.some(([p,c])=>p===prefix&&c==='10'));assert.ok(requests.every(([p])=>p.startsWith('releases/runtime/windows-helper')));
});
test('cleanup storage failures propagate rather than producing a success record',async()=>{
 const f=fixture();f.bucket.list=async()=>{throw Error('R2 unavailable');};await f.worker.scheduled({},f.env,f.ctx);await assert.rejects(f.settle(),/R2 unavailable/);assert.equal(f.values.has('releases/runtime/windows-helper-cleanup.json'),false);
});
function isolatedRoot(){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'solar-upload-test-'));for(const file of ['windows/SolarTimeShutdownHelper.cmd','src/windows-shutdown.js','assets/deployment.json','assets/revision.json']){fs.mkdirSync(path.dirname(path.join(tmp,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(tmp,file));}return tmp;}
function fakeUploads(tmp,missing=[]){const plan=helperPlan(tmp),objects=new Set([plan.url,plan.sourceUrl].filter(u=>!missing.includes(u))),writes=[];return {plan,writes,fetchFn:async url=>objects.has(url)?new Response(plan.payload,{headers:{'content-type':url.endsWith('.cmd')?'application/octet-stream':'text/plain','content-disposition':url.endsWith('.cmd')?'attachment; filename=helper.cmd':''}}):new Response(null,{status:404}),putFn:async(_,{key,file})=>{assert.deepEqual(fs.readFileSync(file),plan.payload);writes.push(key);objects.add(key===plan.key?plan.url:plan.sourceUrl);}};}
test('unchanged native helper skips both writes; missing source uploads exactly one verified object',async()=>{
 const tmp=isolatedRoot();try{const f=fakeUploads(tmp),r=await uploadWindowsHelper(tmp,{apply:true,...f});assert.equal(r.uploaded.length,0);assert.equal(r.skipped.length,2);assert.equal(f.writes.length,0);
 const g=fakeUploads(tmp,[f.plan.sourceUrl]),updated=await uploadWindowsHelper(tmp,{apply:true,...g});assert.deepEqual(updated.uploaded,[f.plan.sourceKey]);assert.equal(g.writes.length,1);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('helper dry-run makes no requests and immutable mismatches or HTTP failures cause no writes',async()=>{
 const tmp=isolatedRoot();try{let writes=0,calls=0;const r=await uploadWindowsHelper(tmp,{fetchFn:()=>{calls++;throw Error();},putFn:()=>writes++});assert.equal(r.writes,false);assert.equal(calls,0);
 for(const response of [()=>new Response('bad'),()=>new Response(null,{status:503})])await assert.rejects(uploadWindowsHelper(tmp,{apply:true,fetchFn:async()=>response(),putFn:()=>writes++}));assert.equal(writes,0);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
