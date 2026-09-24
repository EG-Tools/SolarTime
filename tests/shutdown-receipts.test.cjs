'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../cloudflare/worker.js'),'utf8');
function fixture(){
 const values=new Map(),wait=[];
 const bucket={
  async put(key,body,options={}){if(options.onlyIf&&values.has(key))return null;values.set(key,{body,uploaded:new Date()});return {key};},
  async get(key){const v=values.get(key);return v?{json:async()=>JSON.parse(v.body)}:null;},
  async head(key){return values.has(key)?{}:null;},
  async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])values.delete(key);},
  async list({prefix}){return {objects:[...values].filter(([k])=>k.startsWith(prefix)).map(([key,v])=>({key,uploaded:v.uploaded})),truncated:false};}
 };
 const worker=new Function(source.replace('export default','return'))(),env={SOLAR_TIME_MEDIA:bucket,ASSETS:{fetch:()=>new Response('asset')}},ctx={waitUntil:p=>wait.push(p)};
 return {values,bucket,worker,env,ctx,request:(route,opts)=>worker.fetch(new Request('https://solar.test'+route,opts),env,ctx),settle:()=>Promise.all(wait)};
}
const token='1234567890abcdef1234567890abcdef',base='/api/windows-helper/',status=base+'operation-status?token='+token,complete=base+'operation-complete?token='+token;
const receipt=(action='schedule',extra={})=>({protocol:2,action,ok:true,code:0,revision:'A'.repeat(64),at:Date.now(),deadline:action==='schedule'?Date.now()+60000:0,...extra});
const post=value=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
test('receipts survive retries and are never served through the public media cache',async()=>{
 const f=fixture(),value=receipt();assert.deepEqual(await (await f.request(status)).json(),{result:null});
 assert.equal((await f.request(complete,post(value))).status,204);
 for(let i=0;i<2;i++){const response=await f.request(status);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).result,value);}
 assert.equal((await f.request(complete,post(value))).status,204);
 assert.equal((await f.request(complete,post({...value,ok:false,code:5,deadline:0}))).status,409);
 assert.equal((await f.request('/media/releases/runtime/windows-helper-v2/operation/'+token)).status,404);
});
test('invalid and oversized payloads, forged origins, wrong methods and tokens are rejected',async()=>{
 const f=fixture();for(const value of [{},receipt('exec'),receipt('schedule',{code:5}),receipt('cancel',{deadline:1}),receipt('schedule',{revision:'bad'})])assert.equal((await f.request(complete,post(value))).status,400);
 assert.equal((await f.request(complete,{...post(receipt()),headers:{'content-type':'application/json','origin':'https://untrusted.test'}})).status,403);
 assert.equal((await f.request(complete,{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(1100)})).status,413);
 assert.equal((await f.request(complete,{method:'GET'})).status,405);
 assert.equal((await f.request(status.replace(token,'bad'))).status,400);
 assert.equal((await f.request(complete,{method:'OPTIONS'})).status,204);
});
test('installation reports the actual helper revision; old clients remain compatible',async()=>{
 const f=fixture(),url=base+'install-complete?token='+token,get=base+'install-status?token='+token;
 assert.equal((await f.request(url,{method:'POST'})).status,204);assert.deepEqual(await (await f.request(get)).json(),{installed:true});await f.settle();
 const value=receipt('install');assert.equal((await f.request(url,post(value))).status,204);
 assert.deepEqual(await (await f.request(get)).json(),{installed:true,protocol:2,revision:value.revision});
});
test('expired results disappear and hourly cleanup cannot delete real media',async()=>{
 const f=fixture();await f.request(complete,post(receipt()));const key=[...f.values.keys()][0],record=JSON.parse(f.values.get(key).body);record.receivedAt=Date.now()-4*60000;f.values.get(key).body=JSON.stringify(record);
 assert.deepEqual(await (await f.request(status)).json(),{result:null});await f.settle();assert.equal(f.values.has(key),false);
 await f.bucket.put(key,'{}');f.values.get(key).uploaded=new Date(Date.now()-2*3600000);
 await f.bucket.put('releases/content/windows/installer.cmd','real content');f.values.get('releases/content/windows/installer.cmd').uploaded=new Date(0);
 await f.worker.scheduled({},f.env,f.ctx);await f.settle();assert.equal(f.values.has(key),false);assert.equal(f.values.has('releases/content/windows/installer.cmd'),true);
});
