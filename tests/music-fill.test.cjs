'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const tasks=[],pending=[],context={Response,Request,Headers,URL,console:{warn(){}},Date};
 vm.runInNewContext(fs.readFileSync(require.resolve('../cloudflare/worker.js'),'utf8').replace('export default','globalThis.worker ='),context);
 let gets=0,puts=0,fail=false;
 const cache={match:async()=>undefined,put:async(_key,response)=>{puts++;await response.text();}},env={SOLAR_TIME_MEDIA:{get:async()=>{gets++;await new Promise((resolve,reject)=>pending.push(()=>fail?reject(Error('R2 unavailable')):resolve()));return {body:'music',size:5,httpEtag:'"music"',writeHttpMetadata(){}};}}},ctx={waitUntil:p=>tasks.push(p)};
 return {start:key=>context.fillMusic(cache,new Request('https://test/'+key),env,ctx,key),tasks,pending,gets:()=>gets,puts:()=>puts,setFail:v=>{fail=v;}};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('simultaneous music fills share one owner without sharing request I/O',async()=>{
 const h=harness();for(let i=0;i<30;i++)h.start('one.mp3');await flush();assert.equal(h.gets(),1);assert.equal(h.tasks.length,1);
 h.pending.splice(0).forEach(f=>f());await Promise.all(h.tasks);assert.equal(h.puts(),1);
 h.start('one.mp3');await flush();assert.equal(h.gets(),2);h.pending.splice(0).forEach(f=>f());await Promise.all(h.tasks);
});
test('failed fills release ownership and concurrent distinct fills are bounded',async()=>{
 const h=harness();h.setFail(true);h.start('broken.mp3');await flush();h.pending.splice(0).forEach(f=>f());await Promise.all(h.tasks);assert.equal(h.puts(),0);
 h.setFail(false);for(let i=0;i<20;i++)h.start(i+'.mp3');await flush();assert.equal(h.gets(),9);h.pending.splice(0).forEach(f=>f());await Promise.all(h.tasks);assert.equal(h.puts(),8);
 h.start('broken.mp3');await flush();h.pending.splice(0).forEach(f=>f());await Promise.all(h.tasks);assert.equal(h.puts(),9);
});
