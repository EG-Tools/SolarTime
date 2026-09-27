'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({hold=false,mobile=false}={}){
 let now=0,serial=0;const requests=[],uploads=[],deleted=[],closed=[],window={SolarSurfaceStyle:require('../src/surface-style.js')};
 const context={window,URL,Blob,AbortController,DOMException,setTimeout,clearTimeout,performance:{now:()=>now},navigator:{userAgent:mobile?'iPhone':'Desktop'},matchMedia:()=>({matches:mobile}),screen:{width:mobile?390:1920,height:mobile?844:1080}};
 context.fetch=(url,{signal})=>new Promise((resolve,reject)=>{
  const width=Number(/(\d+)\.webp/.exec(url)[1]),row={url,width,signal,finish:()=>resolve({ok:true,blob:async()=>({width})}),fail:()=>reject(Error('offline'))};
  requests.push(row);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});if(!hold)row.finish();
 });
 context.createImageBitmap=async b=>({width:b.width,height:b.width/2,close:()=>closed.push(b.width)});
 vm.createContext(context);vm.runInContext(read('src/performance.js'),context);vm.runInContext(read('src/surface.js'),context);
 const r=Object.create(window.SolarSurface.DirectRenderer.prototype),gl={createTexture:()=>({id:++serial}),deleteTexture:t=>{if(t)deleted.push(t.id);},texImage2D:(...args)=>uploads.push(args.at(-1).width)};
 for(const n of ['activeTexture','bindTexture','pixelStorei','texParameteri','deleteBuffer','deleteProgram'])gl[n]=()=>{};
 Object.assign(r,{maxTextureSize:4096,textures:new Map(),recentTextures:new Map(),textureSources:new Map(),frames:new Map(),desired:new Map(),orbitBuffers:new Map(),loadQueue:[],pendingCount:0,activeLoads:0,textureToken:0,generation:0,boundTextures:[],gl,stats:{texturePixels:0,accepted:0,texturesLoaded:0},canvas:{removeEventListener(){}},planetProgram:{},coronaProgram:{},line:{},ring:{}});
 const material=name=>({base:'https://media.test/'+name+'/',seamBaked:true,tiers:[256,512,1024,2048,4096].map(width=>({width,path:width+'.webp'})),fallback:'https://media.test/'+name+'/256.webp'});
 window.SolarAssets={materials:Object.fromEntries(['earth','earth-night','clouds','moon','mars','venus','jupiter','saturn'].map(n=>[n,material(n)]))};
 const focus=(name,width=4096)=>{r.desired.clear();r.desired.set(name,{id:name,textureWidth:width,priority:2});};
 return {r,window,requests,uploads,deleted,closed,focus,time:n=>now=n,turn};
}
async function full(f,name='earth'){
 f.focus(name);f.r.textureFor(name,4096);await turn();f.r.textureFor(name,4096);await turn();f.r.textureFor(name,4096);await turn();
 assert.equal(f.r.textures.get(name).width,4096);
}
test('cold detail publishes baseline, then 1024 preview, then original 4096; no 512/2048 chain',async()=>{
 const f=fixture();await full(f);assert.deepEqual(f.requests.map(r=>r.width),[256,1024,4096]);assert.deepEqual(f.uploads,[256,1024,4096]);f.r.dispose();
});
test('4K cannot occupy a slot until the preview has been published',async()=>{
 const f=fixture({hold:true});f.focus('earth');f.r.textureFor('earth',4096);f.requests[0].finish();await turn();
 const baseline=f.r.textures.get('earth').texture;f.r.textureFor('earth',4096);
 for(let i=0;i<20;i++)f.r.textureFor('earth',4096);
 assert.deepEqual(f.requests.map(r=>r.width),[256,1024]);assert.equal(f.r.textures.get('earth').texture,baseline);
 f.requests[1].finish();await turn();const preview=f.r.textures.get('earth').texture;
 assert.equal(f.r.textureFor('earth',4096).texture,preview);assert.equal(f.r.textures.get('earth').width,1024);
 f.requests[2].finish();await turn();assert.equal(f.r.textures.get('earth').width,4096);f.r.dispose();
});
test('selection intent uses the same loader and starts medium resolution before any render tick',async()=>{
 const f=fixture({hold:true});f.r.prefetchBody('moon');assert.deepEqual(f.requests.map(r=>r.width),[1024]);
 f.focus('moon');f.r.textureFor('moon',4096);assert.equal(f.requests.length,1);assert.equal(f.requests[0].signal.aborted,false);
 f.requests[0].finish();await turn();f.r.textureFor('moon',4096);assert.equal(f.requests[1].width,4096);f.r.pause();await turn();
});
test('resident recent 4K is a fast path, without another fetch, decode or upload',async()=>{
 const f=fixture();await full(f,'moon');const original=f.r.textures.get('moon').texture;
 f.time(100);f.r.textureFor('moon',256);f.time(800);f.r.textureFor('moon',256);await turn();
 assert.equal(f.r.textures.get('moon').width,256);const n=f.requests.length,u=f.uploads.length;
 const ready=f.r.textureFor('moon',4096);assert.equal(ready.texture,original);assert.equal(f.requests.length,n);assert.equal(f.uploads.length,u);assert.equal(f.r.stats.recentHits,1);f.r.dispose();
});
test('cached lower LOD still respects hysteresis and night lights select their requested tier',async()=>{
 const f=fixture();await full(f,'earth-night');const high=f.r.textures.get('earth-night').texture;
 f.time(100);f.r.textureFor('earth-night',1024);assert.equal(f.r.textures.get('earth-night').texture,high);
 f.time(800);f.r.textureFor('earth-night',1024);assert.equal(f.r.textures.get('earth-night').width,1024);
 assert.equal(f.requests.length,3);f.r.dispose();
});
test('failed high tier and its coarse fallback cannot replace an already good preview',async()=>{
 const f=fixture({hold:true});f.focus('earth');f.r.prefetchBody('earth');f.requests[0].finish();await turn();
 const preview=f.r.textures.get('earth').texture;f.r.textureFor('earth',4096);f.requests[1].fail();await turn();
 assert.equal(f.requests[2].width,256);f.requests[2].finish();await turn();
 for(let i=0;i<100;i++)f.r.textureFor('earth',4096);
 assert.equal(f.r.textures.get('earth').width,1024);assert.equal(f.r.textures.get('earth').texture,preview);assert.equal(f.requests.length,3);assert.deepEqual(f.uploads,[1024]);f.r.dispose();
});
test('latest focus preview overtakes unrelated queued high-detail requests; slots remain bounded',async()=>{
 const f=fixture({hold:true});f.focus('earth');f.r.textureFor('earth',256);f.r.textureFor('jupiter',256);
 f.r.textureFor('venus',256);f.r.textureFor('mars',256);f.r.prefetchBody('moon');assert.equal(f.r.activeLoads,2);
 f.requests[0].finish();await turn();assert.match(f.requests[2].url,/moon\/1024/);assert.equal(f.r.activeLoads,2);
 f.r.pause();await turn();assert.equal(f.r.activeLoads,0);assert.equal(f.r.pendingCount,0);assert.equal(f.r.loadQueue.length,0);f.r.dispose();
});
test('obsolete waiting textures are cancelled, while current preview stays protected',async()=>{
 const f=fixture({hold:true});f.focus('earth');f.r.textureFor('earth',256);f.r.textureFor('jupiter',256);f.r.textureFor('venus',256);
 f.focus('moon');f.r.prefetchBody('moon');f.r.pruneTextureQueue();await turn();
 assert.equal(f.r.loadQueue.some(t=>t.name==='venus'),false);assert.equal(f.r.textures.get('venus').pending,false);
 assert.ok(f.requests.slice(0,2).every(q=>q.signal.aborted));assert.ok(f.requests.some(q=>q.url.includes('/moon/')));
 f.r.pause();await turn();assert.equal(f.r.pendingCount,0);f.r.dispose();
});
test('recent cache and active maps share existing mobile and desktop memory budgets',async()=>{
 for(const mobile of [false,true]){
  const f=fixture({mobile});
  for(const name of ['earth','moon','mars','jupiter']){await full(f,name);f.time(100);f.r.textureFor(name,256);f.time(800);f.r.textureFor(name,256);await turn();f.time(0);}
  f.r.trimRecent();assert.ok(f.r.stats.texturePixels*4<=f.window.SolarPerformance.textureBudget());
  assert.ok(f.r.stats.recentTextureBytes<= (mobile?32:64)*1024*1024);assert.ok(f.r.stats.recentEvictions>0);
  const live=[...f.r.textures.values(),...f.r.recentTextures.values()].filter(r=>r.texture);
  assert.equal(f.r.stats.texturePixels,live.reduce((n,r)=>n+r.width*r.height,0));
  const ids=live.map(r=>r.texture.id);f.r.dispose();assert.ok(ids.every(id=>f.deleted.includes(id)));
 }
});
test('asset replacement cannot resurrect previous-source cache entries',async()=>{
 const f=fixture();await full(f);f.time(100);f.r.textureFor('earth',256);f.time(800);f.r.textureFor('earth',256);await turn();
 f.window.SolarAssets.materials.earth={...f.window.SolarAssets.materials.earth,base:'https://new.test/earth/'};
 f.r.textureFor('earth',4096);await turn();assert.match(f.requests.at(-1).url,/new.test\/earth\/1024/);assert.equal(f.r.stats.recentHits||0,0);f.r.dispose();
});
test('pause and late decode cannot publish stale 4K or leak slots',async()=>{
 const f=fixture({hold:true});f.focus('earth');f.r.prefetchBody('earth');f.requests[0].finish();await turn();
 const preview=f.r.textures.get('earth').texture;f.r.textureFor('earth',4096);f.r.pause();f.requests[1].finish();await turn();
 assert.equal(f.r.textures.get('earth').texture,preview);assert.equal(f.r.pendingCount,0);assert.equal(f.r.activeLoads,0);f.r.dispose();
});
test('compatibility surface publishes 1024 first and still schedules final detail for a static scene',()=>{
 const f=fixture(),Service=f.window.SolarSurface.Service,s=Object.create(Service.prototype),sent=[];
 Object.assign(s,{frames:new Map(),desired:new Map(),pending:null,inflight:false,disposed:false,paused:false,epoch:0,revision:0,worker:{postMessage:m=>sent.push(m)},stats:{submitted:0,accepted:0,discarded:0}});
 const job={id:'earth',geometry:'same',textureWidth:4096,diam:512,phase:0,seconds:0,light:[1,0,0]};
 s.update([job],0);assert.equal(sent[0].jobs[0].textureWidth,1024);
 let message=sent[0];s.receive({kind:'frame',revision:message.revision,epoch:message.epoch,job:message.jobs[0],bitmap:{width:512,height:512,close(){}}});s.receive({kind:'done',revision:message.revision,epoch:message.epoch,ms:1});
 s.update([job],1);assert.equal(sent[1].jobs[0].textureWidth,4096);
});
test('texture payload bytes, compression, shader and helper stay unchanged',()=>{
 const crypto=require('node:crypto');
 const baseline=JSON.parse(read('tests/fixtures/texture-v062-hashes.json'));
 for(const [name,hash] of Object.entries(baseline)){
  let bytes=fs.readFileSync(path.join(root,name));
  // Windows checks out CMD as CRLF; compare its canonical source, while
  // every texture manifest, shader and web runtime remains byte-for-byte.
  if(name.endsWith('.cmd'))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,name);
 }
 assert.doesNotMatch(read('src/surface.js'),/\.quality\s*=|generateMipmap\(/);
});
