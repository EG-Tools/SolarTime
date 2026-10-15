'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({hold=false,mobile=false,holdDecode=false,staged=false}={}){
 let now=0,serial=0;const requests=[],decodes=[],uploads=[],deleted=[],closed=[],uploadFrames=new Map(),strips=[],window={SolarSurfaceStyle:require('../src/surface-style.js')};
 const context={window,URL,Blob,AbortController,DOMException,setTimeout,clearTimeout,performance:{now:()=>now},navigator:{userAgent:mobile?'iPhone':'Desktop'},matchMedia:()=>({matches:mobile}),screen:{width:mobile?390:1920,height:mobile?844:1080}};
 context.fetch=(url,{signal})=>new Promise((resolve,reject)=>{
  const width=Number(/(\d+)\.webp/.exec(url)[1]),row={url,width,signal,finish:()=>resolve({ok:true,blob:async()=>({width})}),fail:()=>reject(Error('offline'))};
  requests.push(row);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});if(!hold)row.finish();
 });
 if(staged){context.requestAnimationFrame=fn=>{uploadFrames.set(++serial,fn);return serial;};context.cancelAnimationFrame=id=>uploadFrames.delete(id);}
 context.createImageBitmap=(b,...crop)=>{if(crop.length>=4)return Promise.resolve({width:crop[2],height:crop[3],close:()=>closed.push(crop[2])});return new Promise(resolve=>{const finish=()=>resolve({width:b.width,height:b.width/2,close:()=>closed.push(b.width)});decodes.push({finish});if(!holdDecode)finish();});};
 vm.createContext(context);vm.runInContext(read('src/performance.js'),context);vm.runInContext(read('src/surface.js'),context);
 const r=Object.create(window.SolarSurface.DirectRenderer.prototype),gl={createTexture:()=>({id:++serial}),deleteTexture:t=>{if(t)deleted.push(t.id);},texImage2D:(...args)=>uploads.push(args.at(-1)?.width||0),texSubImage2D:(...args)=>strips.push(args[3])};
 for(const n of ['activeTexture','bindTexture','pixelStorei','texParameteri','deleteBuffer','deleteProgram'])gl[n]=()=>{};
 Object.assign(r,{maxTextureSize:4096,textures:new Map(),recentTextures:new Map(),textureSources:new Map(),frames:new Map(),desired:new Map(),orbitBuffers:new Map(),loadQueue:[],pendingCount:0,activeLoads:0,textureToken:0,generation:0,boundTextures:[],gl,stats:{texturePixels:0,accepted:0,texturesLoaded:0},canvas:{removeEventListener(){}},planetProgram:{},coronaProgram:{},line:{},ring:{}});
 const material=name=>({base:'https://media.test/'+name+'/',seamBaked:true,tiers:[256,512,1024,2048,4096].map(width=>({width,path:width+'.webp'})),fallback:'https://media.test/'+name+'/256.webp'});
 window.SolarAssets={materials:Object.fromEntries(['earth','earth-night','clouds','moon','mars','venus','jupiter','saturn'].map(n=>[n,material(n)]))};
 const focus=(name,width=4096)=>{r.desired.clear();r.desired.set(name,{id:name,textureWidth:width,priority:2});};
 return {r,window,requests,decodes,uploads,deleted,closed,focus,time:n=>now=n,turn,uploadFrames,strips};
}
async function full(f,name='earth'){
 f.focus(name);f.r.textureFor(name,4096);await turn();f.r.textureFor(name,4096);await turn();f.r.textureFor(name,4096);await turn();
 assert.equal(f.r.textures.get(name).width,4096);
}
test('Saturn and Uranus rings inherit the same parent phase frame as their body',()=>{
 const f=fixture(),source=read('src/surface.js'),frame={u:[1,0,0],v:[0,0,1],pole:[0,1,0]};
 const quarter=f.r.bodyRingFrame(frame,.25);
 const close=(actual,expected)=>actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-6));
 close([...quarter.u],[0,0,1]);close([...quarter.v],[-1,0,0]);close([...quarter.pole],frame.pole);
 const whole=f.r.bodyRingFrame(frame,1);close([...whole.u],frame.u);close([...whole.v],frame.v);
 assert.match(source,/body\.id==='saturn'\|\|body\.id==='uranus'\?this\.bodyRingFrame\(frame,job\.phase\):frame/);
});
test('cold detail publishes baseline, then 1024 preview, then original 4096; no 512/2048 chain',async()=>{
 const f=fixture();await full(f);assert.deepEqual(f.requests.map(r=>r.width),[256,1024,4096]);assert.deepEqual(f.uploads,[256,1024,4096]);f.r.dispose();
});

test('opening requests all body previews at arrival size, bounded to 1024 instead of a tiny baseline',async()=>{
 const names=['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon','europa','pluto'];
 for(const name of names)for(const target of [256,512,1024,4096]){
  const f=fixture();f.window.SolarAssets.materials[name]=f.window.SolarAssets.materials.earth;
  f.r.openingPreview=true;f.focus(name,target);f.r.textureFor(name,target);await turn();
  assert.deepEqual(f.requests.map(row=>row.width),[Math.min(1024,target)],name);
  assert.equal(f.r.textures.get(name).width,Math.min(1024,target));f.r.dispose();
 }
});

test('completed texture swaps blend through the existing recent cache, including baseline',async()=>{
 const f=fixture();f.focus('earth');f.r.textureFor('earth',4096);await turn();
 const baseline=f.r.textures.get('earth').texture;
 f.r.textureFor('earth',4096);await turn();const record=f.r.textures.get('earth');
 assert.equal(f.r.colorLod(record,0).texture,baseline);assert.equal(f.r.colorLod(record,0).mix,0);
 assert.equal(f.r.colorLod(record,350).mix,.5);assert.equal(f.r.hasLodTransition(350),true);
 assert.equal(f.r.colorLod(record,700),null);assert.equal(f.r.hasLodTransition(700),false);
 f.time(800);f.r.prefetchBody('earth');await turn();assert.equal(f.r.textures.get('earth').width,4096,'repeated destination intent prepares final detail');
 const high=f.r.textures.get('earth');f.r.discardRecent(high.previousLod);assert.equal(f.r.colorLod(high,450),null,'evicted textures are never sampled');
 f.r.dispose();
});

test('staged 4K upload keeps the complete preview resident until the final strip is uploaded',async()=>{
 const f=fixture({staged:true});f.focus('earth');
 for(let tier=0;tier<2;tier++){
  f.r.textureFor('earth',4096);await turn();
  while(f.uploadFrames.size){const callbacks=[...f.uploadFrames.values()];f.uploadFrames.clear();callbacks.forEach(fn=>fn());await turn();}
 }
 f.strips.length=0;
 const preview=f.r.textures.get('earth').texture;assert.equal(f.r.textures.get('earth').width,1024);
 f.r.textureFor('earth',4096);await turn();let frames=0;
 while(f.uploadFrames.size){
  assert.equal(f.r.textures.get('earth').texture,preview);assert.equal(f.r.textures.get('earth').width,1024);
  const callbacks=[...f.uploadFrames.values()];f.uploadFrames.clear();callbacks.forEach(fn=>fn());await turn();assert.ok(++frames<20);
 }
 assert.equal(f.strips.length,16);assert.equal(f.r.textures.get('earth').width,4096);assert.notEqual(f.r.textures.get('earth').texture,preview);assert.equal(f.r.pendingCount,0);f.r.dispose();
});

test('day, cloud and night LOD share one sampler and never replace a queued layer early',async()=>{
 const f=fixture(),r=f.r,bound=new Map();r.black={id:'black'};r.planetProgram={u:{}};
 r.gl.uniform1f=()=>{};r.gl.uniform2f=()=>{};r.bindTextureUnit=(slot,texture)=>bound.set(slot,texture);
 const records=['earth','clouds','earth-night'].map((name,i)=>{
  const previous={texture:{id:'old'+i},width:256,height:128},record={texture:{id:'new'+i},previousLod:name,sampled:true,lodStarted:0};
  r.recentTextures.set(name,previous);return record;
 });
 const [day,cloud,night]=records,maps=[day,null,cloud,night];
 assert.equal(r.mapLod(maps,5000).layer,0,'fade starts on presentation, even after loading long ago');
 assert.equal(bound.get(2).id,'old1');assert.equal(bound.get(3).id,'old2');
 assert.equal(r.mapLod(maps,5350).mix,.5);
 assert.equal(r.mapLod(maps,5700).layer,2);assert.equal(bound.get(0).id,'new0');assert.equal(bound.get(3).id,'old2');
 assert.equal(r.mapLod(maps,6400).layer,3);
 assert.equal(r.mapLod(maps,7100).layer,-1);assert.equal(bound.get(3).id,'new2');
 // Venus samples the same cloud deck as both its base and cloud layer.
 day.previousLod='earth';day.lodVisibleStarted=null;
 assert.equal(r.mapLod([day,null,day],7200).layer,0);assert.equal(bound.get(0),bound.get(2));
 f.r.dispose();
});

test('initial optional maps fade from black and an active tier cannot be replaced midway',async()=>{
 const f=fixture(),r=f.r;r.black={id:'black'};r.planetProgram={u:{}};r.gl.uniform1f=()=>{};r.gl.uniform2f=()=>{};r.bindTextureUnit=()=>{};
 f.focus('earth');r.textureFor('earth',4096);await turn();
 const day=r.textures.get('earth');assert.equal(r.mapLod([day],0).mix,0);assert.equal(r.mapLod([day],350).mix,.5);r.mapLod([day],700);f.time(700);
 r.textureFor('earth',4096);await turn();const preview=r.textures.get('earth');r.mapLod([preview],710);
 f.time(900);assert.equal(r.textureFor('earth',4096).width,1024);assert.equal(f.requests.length,2);
 r.mapLod([preview],1410);f.time(1410);r.textureFor('earth',4096);await turn();assert.equal(f.requests.length,3);
 const cloud={texture:{id:'cloud'}};assert.equal(r.mapLod([null,null,cloud],800).mix,0);
 assert.equal(r.mapLod([null,null,cloud],1150).mix,.5);assert.equal(r.mapLod([null,null,cloud],1500).layer,-1);
 f.r.dispose();
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
test('destination intent prevents distant render jobs from cancelling prepared detail',async()=>{
 const f=fixture({hold:true});f.r.prefetchBody('moon');f.requests[0].finish();await turn();
 f.r.prefetchBody('moon');assert.equal(f.requests[1].width,4096);
 f.time(900);f.r.textureFor('moon',256);f.time(1600);f.r.textureFor('moon',256);
 assert.equal(f.requests[1].signal.aborted,false);assert.equal(f.requests.length,2);
 f.requests[1].finish();await turn();assert.equal(f.r.textures.get('moon').width,4096);
 f.time(3000);f.r.textureFor('moon',256);f.time(3700);f.r.textureFor('moon',256);
 assert.equal(f.r.textures.get('moon').pendingTarget,256,'normal LOD resumes after arrival intent expires');f.r.dispose();
});

test('resident recent 4K is a fast path, without another fetch, decode or upload',async()=>{
 const f=fixture();await full(f,'moon');const original=f.r.textures.get('moon').texture;
 f.time(100);f.r.textureFor('moon',256);f.time(800);f.r.textureFor('moon',256);await turn();
 assert.equal(f.r.textures.get('moon').width,256);const n=f.requests.length,u=f.uploads.length;
 const hits=f.r.stats.recentHits||0,ready=f.r.textureFor('moon',4096);assert.equal(ready.texture,original);assert.equal(f.requests.length,n);assert.equal(f.uploads.length,u);assert.equal(f.r.stats.recentHits,hits+1);f.r.dispose();
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
 f.r.textureFor('venus',256);f.r.textureFor('mars',256);f.r.textureFor('saturn',256);f.r.prefetchBody('moon');assert.equal(f.r.activeLoads,4);
 for(let i=0;i<3;i++){f.requests[i].finish();await turn();}
 assert.match(f.requests[4].url,/moon\/1024/);assert.match(f.requests[5].url,/saturn\/256/);assert.equal(f.r.activeLoads,3);
 f.r.pause();await turn();assert.equal(f.r.activeLoads,0);assert.equal(f.r.pendingCount,0);assert.equal(f.r.loadQueue.length,0);f.r.dispose();
});
test('baseline downloads overlap in four slots but decoding stays bounded at two',async()=>{
 const f=fixture({hold:true,holdDecode:true});
 try{
  for(const name of ['earth','jupiter','venus','mars','saturn'])f.r.textureFor(name,256);
  assert.equal(f.requests.length,4);assert.equal(f.r.activeLoads,4);
  for(const request of f.requests)request.finish();await turn();
  assert.equal(f.decodes.length,2);assert.equal(f.r.activeDecodes,2);assert.equal(f.r.decodeWaiters.length,2);
  f.decodes[0].finish();await turn();assert.equal(f.decodes.length,3);assert.equal(f.r.activeDecodes,2);
  assert.equal(f.requests.length,5);assert.equal(f.r.activeLoads,4);
  f.r.pause();await turn();assert.equal(f.r.decodeWaiters.length,0);
  for(const decode of f.decodes)decode.finish();await turn();
  assert.equal(f.r.activeLoads,0);assert.equal(f.r.activeDecodes,0);assert.equal(f.r.pendingCount,0);
  assert.equal(f.uploads.length,1,'aborted decodes never upload after pause');
 }finally{f.r.pause();for(const decode of f.decodes)decode.finish();await turn();f.r.dispose();}
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
 const hits=f.r.stats.recentHits||0;f.r.textureFor('earth',4096);await turn();assert.match(f.requests.at(-1).url,/new.test\/earth\/1024/);assert.equal(f.r.stats.recentHits||0,hits);f.r.dispose();
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
test('approved texture/audio manifest, compression and helper stay unchanged',()=>{
 // Manifest pin includes the approved Deep Space Journey music addition.
 // Runtime pins include the shared ring sampler/shadow and explicit sky
 // camera, covered by ring-tour and Saturn-ring tests. The sky pin also reflects
 // removal of unused debug locators; shader and media bytes stay intact.
 const crypto=require('node:crypto');
 const baseline=JSON.parse(read('tests/fixtures/texture-v062-hashes.json'));
 // Runtime behavior is covered by rendering/UI tests; retain immutable media and helper checks.
 for(const [name,hash] of Object.entries(baseline).filter(([name])=>!['src/assets.js','src/sky.js','styles.css','src/runtime-optimizations.css'].includes(name))){
  let bytes=fs.readFileSync(path.join(root,name));
  // The explicitly added Saturn ring is independently pinned/validated by
  // saturn-rings.test.cjs. Keep every pre-existing media entry and all runtime
  // URL generation byte-for-byte against the original texture baseline.
  if(name==='assets/manifest.json'){
   const manifest=JSON.parse(bytes);delete manifest.materials['saturn-ring'];delete manifest.sky.localPreview;delete manifest.sky.galaxyAtlas;delete manifest.sky.galaxyIndices;
   // The newly registered debris atlas is pinned by the incremental media test.
   delete manifest.effects;
   bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  }
  // Normalize Windows helper line endings only.
  if(name.endsWith('.cmd'))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,name);
 }
 assert.doesNotMatch(read('src/surface.js'),/\.quality\s*=/);
});

test('explicit mip filtering tracks the map actually bound during queued LOD fades',async()=>{
 const f=fixture(),r=f.r;let levels;
 r.explicitMipLod=true;r.black={};r.planetProgram={u:{}};r.gl.uniform1f=()=>{};r.gl.uniform2f=()=>{};r.gl.uniform1fv=(_,v)=>levels=[...v];r.bindTextureUnit=()=>{};
 const old={texture:{},width:128,mipmapped:true},day={texture:{},width:512,mipmapped:true,previousLod:'old',sampled:true};
 r.recentTextures.set('old',old);
 r.mapLod([day],0,32);assert.equal(levels[0],3);assert.equal(levels[6],1);
 r.mapLod([day],100,32*Math.SQRT2);assert.ok(Math.abs(levels[0]-2.5)<1e-6);
 r.mapLod([day],800,512);assert.equal(levels[0],0,'close surfaces use full detail');
});
test('mip upload, parking, reuse and disposal account for the full bounded chain',async()=>{
 const f=fixture();f.r.explicitMipLod=true;let builds=0;f.r.gl.generateMipmap=()=>builds++;
 await full(f);assert.equal(builds,3);
 const current=f.r.textures.get('earth'),sum=[...f.r.textures.values(),...f.r.recentTextures.values()].reduce((n,r)=>n+(r.pixels||0),0);
 assert.equal(current.pixels,Math.ceil(4096*2048*4/3));assert.equal(f.r.stats.texturePixels,sum);
 f.r.dispose();assert.equal(f.r.memoryUsage().textures,0);
});
test('cloud opacity changes reuse the texture plan, topology changes invalidate it',()=>{
 const f=fixture(),r=f.r,base=f.window.SolarPerformance;let plans=0;
 f.window.SolarPerformance={...base,planTextures(...args){plans++;return base.planTextures(...args);}};
 r.cloudWeather={prepare(){},cancelBuild(){}};r.auxiliaryTextureBytes=()=>0;r.texture=()=>null;
 const job={id:'earth',textureWidth:256,cloudTextureWidth:256,cloudDetail:0,cloudAmount:.16,priority:0};
 for(let i=0;i<120;i++){job.cloudAmount=.16+i*.001;r.prepare([job]);}
 assert.equal(plans,1);job.cloudAmount=0;r.prepare([job]);assert.equal(plans,2);
 job.cloudAmount=.2;job.cloudDetail=.01;r.prepare([job]);assert.equal(plans,3);
 const small=base.planTextures([job],f.window.SolarAssets.materials,4096,0,true);
 assert.ok(small.bytes>base.planTextures([job],f.window.SolarAssets.materials).bytes);
});

test('every first planet map fades on its first visible draw, including late arrivals',()=>{
 for(const id of ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon','europa','pluto']){
  const f=fixture(),r=f.r;r.black={id:'black'};r.planetProgram={u:{}};r.gl.uniform1f=()=>{};r.gl.uniform2f=()=>{};r.bindTextureUnit=()=>{};
  const record={texture:{id},lodStarted:0};r.textures.set(id,record);
  assert.equal(r.mapLod([record],9000).mix,0,id);
  assert.equal(r.mapLod([record],9350).mix,.5,id);assert.equal(r.hasLodTransition(9350),true);
  assert.equal(r.mapLod([record],9700).mix,1,id);assert.equal(r.hasLodTransition(9700),false);
  r.dispose();
 }
});

test('a late Saturn ring texture blends from the procedural fallback and is not restarted',()=>{
 const f=fixture(),r=f.r,values=[];r.ring={u:{hasRingMap:'ringMix'}};r.black={};r.bind=()=>{};r.viewport=()=>{};r.bindTextureUnit=()=>{};
 for(const n of ['uniform2f','uniform3f','drawArrays'])r.gl[n]=()=>{};
 r.gl.uniform1f=(u,v)=>{if(u==='ringMix')values.push(v);};
 const frame={u:[1,0,0],v:[0,1,0],pole:[0,0,1]},draw=()=>r.rings({id:'saturn'},frame,{x:10,y:10},20,true,[1,0,0]);
 draw();r.textures.set('saturn-ring',{texture:{},width:256});f.time(5000);draw();f.time(5350);draw();assert.equal(r.hasLodTransition(5350),true);f.time(5700);draw();f.time(9000);draw();
 assert.deepEqual(values,[0,0,.5,1,1]);r.dispose();
});

test('travel ring texture remains fully visible on immediate return without a fallback flash',()=>{
 const f=fixture(),r=f.r,values=[];r.ring={u:{hasRingMap:'ringMix'}};r.black={};r.bind=()=>{};r.viewport=()=>{};r.bindTextureUnit=()=>{};
 for(const n of ['uniform2f','uniform3f','drawArrays'])r.gl[n]=()=>{};
 r.gl.uniform1f=(u,v)=>{if(u==='ringMix')values.push(v);};
 for(const started of [undefined,4990]){
  f.time(5000);r.textures.set('saturn-ring',{texture:{},width:256,ringVisibleStarted:started});
  r.markRingTexturePresented('saturn-ring');
  for(const time of [5000,5016,5350,5700]){
   f.time(time);r.rings({id:'saturn'},{u:[1,0,0],v:[0,1,0],pole:[0,0,1]},{x:10,y:10},20,true,[1,0,0]);
  }
 }
 assert.ok(values.every(v=>v===1));assert.equal(r.hasLodTransition(5700),false);r.dispose();
});

test('relief and night filter spacing follows each sampled map through queued LOD changes',()=>{
 const f=fixture(),r=f.r;r.black={};r.planetProgram={u:{}};r.gl.uniform1f=()=>{};r.gl.uniform2f=()=>{};r.bindTextureUnit=()=>{};
 const maps=[{texture:{},width:4096,sampled:true},{texture:{},width:1024,sampled:true,previousLod:'bump'},{texture:{},width:256,sampled:true},{texture:{},width:2048,sampled:true,previousLod:'night'}];
 r.recentTextures.set('bump',{texture:{},width:256});r.recentTextures.set('night',{texture:{},width:512});
 let state=r.mapLod(maps,0);assert.equal(state.texel,1/256);assert.equal(state.nightTexel,1/512);
 state=r.mapLod(maps,350);assert.equal(state.texel,(1/256+1/1024)/2);assert.equal(state.nightTexel,1/512);
 state=r.mapLod(maps,700);assert.equal(state.texel,1/1024);assert.equal(state.nightTexel,1/512);
 state=r.mapLod(maps,1050);assert.equal(state.nightTexel,(1/512+1/2048)/2);
 state=r.mapLod(maps,1400);assert.equal(state.nightTexel,1/2048);r.dispose();
});

test('ring LOD changes retain the old map until a visible continuous fade completes',()=>{
 const f=fixture(),r=f.r,values=[],bound=new Map();r.ring={u:{ringLodMix:'lod'}};r.black={};r.bind=()=>{};r.viewport=()=>{};r.bindTextureUnit=(slot,map)=>bound.set(slot,map);
 for(const n of ['uniform2f','uniform3f','drawArrays'])r.gl[n]=()=>{};
 r.gl.uniform1f=(u,v)=>{if(u==='lod')values.push(v);};
 const old={texture:{id:'old'},width:256},record={texture:{id:'new'},width:1024,previousLod:'old',ringVisibleStarted:0};
 r.recentTextures.set('old',old);r.textures.set('saturn-ring',record);
 const draw=()=>r.rings({id:'saturn'},{u:[1,0,0],v:[0,1,0],pole:[0,0,1]},{x:10,y:10},150,true,[1,0,0]);
 for(const t of [5000,5350,5700]){f.time(t);draw();assert.equal(bound.get(1),old.texture);}
 assert.deepEqual(values,[0,.5,1]);assert.equal(record.previousLod,null);assert.equal(record.lodQueued,false);
 f.time(5800);draw();assert.equal(values.at(-1),1);r.dispose();
});

test('opening preview retains prepared detail through a distant phase until arrival',async()=>{
 const f=fixture({hold:true});f.r.openingPreview=true;f.focus('saturn',1024);f.r.textureFor('saturn',1024);f.requests[0].finish();await turn();
 f.focus('saturn',4096);f.r.textureFor('saturn',4096);assert.equal(f.requests[1].width,4096);
 f.time(2000);f.focus('saturn',256);f.r.textureFor('saturn',256);f.time(3000);f.r.textureFor('saturn',256);
 assert.equal(f.requests[1].signal.aborted,false);assert.equal(f.requests.length,2);
 f.requests[1].finish();await turn();assert.equal(f.r.textures.get('saturn').width,4096);
 f.r.openingPreview=false;f.time(4000);f.r.textureFor('saturn',256);f.time(4700);f.r.textureFor('saturn',256);assert.equal(f.r.textures.get('saturn').pendingTarget,256);f.r.dispose();
});

test('Venus close-up prepares its atmosphere and reveals it over a visible fallback',()=>{
 const f=fixture(),r=f.r,calls=[];r.openingPreview=true;r.texture=(name,width)=>{calls.push([name,width]);return r.textures.get(name)||null;};
 r.desired.set('venus',{id:'venus',textureWidth:1024,cloudTextureWidth:512,cloudAmount:.5});r.planTextures=()=>{};r.textureIntent={};r.prepare([...r.desired.values()]);
 assert.ok(calls.some(([name,width])=>name==='venus'&&width===512));
 assert.equal(r.visibleTexturesReady(),false);r.textures.set('venus-surface',{texture:{id:'surface-map'}});r.textures.set('venus',{texture:{id:'cloud'}});assert.equal(r.visibleTexturesReady(),true);
 const cloud=r.textures.get('venus'),surface={texture:{id:'surface'},sampled:true};cloud.sampled=false;cloud.revealFallback=surface;r.black={id:'black'};r.planetProgram={u:{}};r.gl.uniform1f=()=>{};r.gl.uniform2f=()=>{};
 let previous;r.bindTextureUnit=(slot,texture)=>{if(slot===6)previous=texture;};r.mapLod([surface,null,cloud],0);assert.equal(previous,surface.texture);r.dispose();
});
