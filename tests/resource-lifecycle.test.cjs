'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function harness(extra={}){
 let now=0;const window={SolarSurfaceStyle:require('../src/surface-style.js')};
 const context={window,URL,Blob,atob,AbortController,DOMException,setTimeout,clearTimeout,performance:{now:()=>now},...extra};
 vm.createContext(context);vm.runInContext(read('src/surface.js'),context);
 return {window,context,time:value=>now=value};
}
function renderer(h){
 const r=Object.create(h.window.SolarSurface.DirectRenderer.prototype);
 Object.assign(r,{maxTextureSize:4096,textures:new Map(),textureSources:new Map(),frames:new Map(),desired:new Map(),loadQueue:[],pendingCount:0,activeLoads:0,textureToken:0,generation:0,stats:{texturePixels:0},gl:{deleteTexture(){}},queued:[]});
 const asset={base:'https://assets.test/',seamBaked:true,tiers:[128,256,512,1024,2048,4096].map(width=>({width,path:width+'.webp'}))};
 h.window.SolarAssets={materials:{earth:asset,jupiter:asset}};
 r.queueTexture=task=>r.queued.push(task);return r;
}
function finish(r,name,width){Object.assign(r.textures.get(name),{texture:{},width,height:width/2,pending:false});}
test('texture boundaries retain the larger map until the smaller demand settles',()=>{
 const h=harness(),r=renderer(h);r.textureFor('earth',1024);finish(r,'earth',256);
 r.textureFor('earth',1024);finish(r,'earth',1024);
 r.textureFor('earth',2048);finish(r,'earth',2048);
 for(let i=1;i<=8;i++){h.time(i*100);r.textureFor('earth',i%2?1024:2048);}
 assert.deepEqual(r.queued.map(q=>q.target),[256,1024,2048]);
 h.time(900);r.textureFor('earth',1024);h.time(1600);r.textureFor('earth',1024);
 assert.deepEqual(r.queued.map(q=>q.target),[256,1024,2048,1024]);
});
test('an asset revision bypasses the LOD delay',()=>{
 const h=harness(),r=renderer(h);r.textureFor('earth',2048);finish(r,'earth',256);r.textureFor('earth',2048);finish(r,'earth',2048);
 h.window.SolarAssets.materials.earth={...h.window.SolarAssets.materials.earth,base:'https://new.test/'};
 r.textureFor('earth',1024);assert.equal(r.queued.length,3);assert.match(r.queued[2].source.url,/new.test/);
});
test('cancelled downloads free the two slots; superseded jobs never upload',async()=>{
 const signals=[];const h=harness({fetch:(url,{signal})=>new Promise((resolve,reject)=>{signals.push(signal);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});})});
 const r=renderer(h);delete r.queueTexture;
 for(const name of ['earth','jupiter']){
  const asset=h.window.SolarAssets.materials[name],source=r.textureSource(name,asset,256);
  r.textures.set(name,{asset,source,texture:{},width:256,height:128,pending:false,token:0});
 }
 r.textureFor('earth',1024);r.textureFor('jupiter',1024);assert.equal(r.activeLoads,2);
 r.textureFor('earth',2048);assert.ok(signals[0].aborted);await turn();
 assert.equal(r.activeLoads,2);assert.equal(r.pendingCount,2);assert.equal(signals.length,3);
 r.pause();assert.ok(signals.every(s=>s.aborted));await turn();
 assert.equal(r.activeLoads,0);assert.equal(r.pendingCount,0);assert.equal(r.loadQueue.length,0);assert.equal(r.stats.error,undefined);
});
test('obsolete image decodes are closed before allocating a GPU texture',async()=>{
 let decode,closed=0,uploads=0;const h=harness({fetch:async()=>({ok:true,blob:async()=>new Blob()}),createImageBitmap:()=>new Promise(resolve=>decode=resolve)});
 const r=renderer(h);delete r.queueTexture;r.gl.createTexture=()=>{uploads++;return {};};
 r.textureFor('earth',1024);await turn();r.cancelTexture('earth');decode({width:1024,height:512,close(){closed++;}});await turn();
 assert.equal(closed,1);assert.equal(uploads,0);assert.equal(r.pendingCount,0);
});
test('hung primary downloads time out and try the distinct fallback once',async()=>{
 const urls=[],h=harness({fetch:(url,{signal})=>{urls.push(url);if(url.endsWith('ok'))return Promise.resolve({ok:true,blob:async()=>new Blob()});return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));},createImageBitmap:async()=>({width:256,height:128,close(){}})});
 const image=await h.window.SolarSurface.kernel().bitmapFor({url:'https://test/hang',fallback:'https://test/ok'},null,null,{timeoutMs:5});
 assert.equal(image.width,256);assert.deepEqual(urls,['https://test/hang','https://test/ok']);
});
test('a usable low-resolution fallback does not trigger a request every frame',async()=>{
 let requests=0;const h=harness({fetch:async()=>{requests++;return {ok:true,blob:async()=>new Blob()};},createImageBitmap:async()=>({width:256,height:128,close(){}})}),r=renderer(h);
 delete r.queueTexture;r.boundTextures=[];Object.assign(r.stats,{accepted:0,texturesLoaded:0});
 for(const method of ['activeTexture','bindTexture','pixelStorei','texImage2D','texParameteri'])r.gl[method]=()=>{};
 r.gl.createTexture=()=>({});r.textureFor('earth',2048);await turn();
 assert.equal(r.textures.get('earth').width,256);assert.equal(r.stats.accepted,1);
 r.textureFor('earth',2048);await turn();
 for(let i=0;i<100;i++)r.textureFor('earth',2048);
 assert.equal(requests,2);assert.ok(r.textures.get('earth').retryAt>Date.now());
});
test('visible bodies finish baseline textures before detailed upgrades',()=>{
 const h=harness(),r=renderer(h);r.desired.set('earth',{});r.desired.set('jupiter',{});
 r.textureFor('earth',2048);r.textureFor('jupiter',1024);
 assert.deepEqual(r.queued.map(q=>[q.name,q.target]),[['earth',256],['jupiter',256]]);
 assert.equal(r.visibleTexturesReady(),false);
 finish(r,'earth',256);assert.equal(r.visibleTexturesReady(),false);
 finish(r,'jupiter',256);assert.equal(r.visibleTexturesReady(),true);
 r.textureFor('earth',2048);r.textureFor('jupiter',1024);
 assert.deepEqual(r.queued.map(q=>[q.name,q.target]),[['earth',256],['jupiter',256],['earth',2048],['jupiter',1024]]);
});
test('visible texture plans fit the mobile budget while preserving tracked detail',()=>{
 const window={},context={window,navigator:{userAgent:'iPhone',maxTouchPoints:1},matchMedia:()=>({matches:true}),screen:{width:390,height:844},performance};
 vm.runInNewContext(read('src/performance.js'),context);const api=window.SolarPerformance;
 const jobs=['earth','sun','jupiter','saturn'].map((id,i)=>({id,textureWidth:4096,priority:i===0?2:0})),assets=Object.fromEntries([...jobs.map(j=>[j.id,{}]),['clouds',{}]]);
 const plan=api.planTextures(jobs,assets);assert.ok(plan.constrained);assert.ok(plan.bytes<=api.textureBudget()*.8);assert.equal(plan.targets.get('earth'),4096);
 const small=api.planTextures([{id:'earth',textureWidth:512,priority:0}],assets);assert.equal(small.constrained,false);assert.equal(small.targets.get('earth'),512);
});
function languageHarness(detected='kor',detectedCopy=detected){
 const requests={},messages=[],noop=()=>{},loads=[];
 const context={LANG_ORDER:['kor','en','jpn'],LANG_META:{kor:{copy:'kor'},en:{copy:'en'},jpn:{copy:'jpn'}},REGIONS:{kor:{timeZone:'Asia/Seoul'},en:{timeZone:'America/New_York'},jpn:{timeZone:'Asia/Tokyo'}},language:'kor',languageMode:'manual',activeCopyCode:'kor',autoTimeZone:'Asia/Seoul',detectedLanguage:()=>detected,detectedCopyLanguage:()=>detectedCopy,detectedTimeZone:()=>detected==='jpn'?'Asia/Tokyo':'Asia/Seoul',disposed:false,hydrateLanguage:(region,copy)=>new Promise((resolve,reject)=>{loads.push({region,copy});requests[region]={resolve,reject};}),toast:value=>messages.push(value),renderer:{setSite:noop},activeRegion:()=>context.REGIONS[context.language],translateStatic:noop,renderReleaseNotes:noop,refreshTimeFormats:noop,refreshNavLabels:noop,presetUi:noop,cameraUi:noop,syncSpeedUi:noop,presetAction:null,bodies:[],uiNow:noop,persist:noop,helpDialog:{open:false}};
 const code=read('src/app.js'),a=code.indexOf('      let languageRequest='),b=code.indexOf('      const languageControl=',a);
 vm.createContext(context);vm.runInContext(code.slice(a,b),context);return {context,requests,messages,loads};
}
test('last country selection wins even when earlier downloads finish later',async()=>{
 const {context:c,requests:r}=languageHarness(),first=c.setLanguage('en'),last=c.setLanguage('jpn');r.jpn.resolve();await last;r.en.resolve();await first;assert.equal(c.language,'jpn');
});
test('choosing the current country cancels pending switches; errors keep the scene',async()=>{
 const {context:c,requests:r,messages}=languageHarness(),old=c.setLanguage('en');await c.setLanguage('kor');r.en.reject(Error('stale'));await old;assert.equal(c.language,'kor');assert.equal(messages.length,0);
 const failed=c.setLanguage('jpn');r.jpn.reject(Error('offline'));await failed;assert.equal(c.language,'kor');assert.deepEqual(messages,['offline']);
 const disposed=c.setLanguage('en');c.disposed=true;r.en.resolve();await disposed;assert.equal(c.language,'kor');
});
test('automatic language follows browser detection and manual choices opt out',async()=>{
 const {context:c,requests:r}=languageHarness('jpn'),automatic=c.setLanguage('auto');r.jpn.resolve();await automatic;
 assert.equal(c.language,'jpn');assert.equal(c.languageMode,'auto');
 const manual=c.setLanguage('en');r.en.resolve();await manual;assert.equal(c.language,'en');assert.equal(c.languageMode,'manual');
});
test('automatic mode loads browser copy independently from the detected country',async()=>{
 const {context:c,requests:r,loads}=languageHarness('kor','en'),automatic=c.setLanguage('auto');r.kor.resolve();await automatic;
 assert.equal(c.language,'kor');assert.equal(c.languageMode,'auto');assert.deepEqual(loads,[{region:'kor',copy:'en'}]);
});
test('same AUTO country reloads changed browser copy and keeps the last successful language on failure',async()=>{
 const {context:c,requests:r,messages,loads}=languageHarness('kor','en');c.languageMode='auto';c.activeCopyCode='en';
 c.detectedCopyLanguage=()=> 'jpn';const changed=c.setLanguage('auto');r.kor.resolve();await changed;
 assert.equal(c.language,'kor');assert.equal(c.activeCopyCode,'jpn');assert.deepEqual(loads,[{region:'kor',copy:'jpn'}]);
 c.detectedCopyLanguage=()=> 'en';const failed=c.setLanguage('auto');r.kor.reject(Error('offline'));await failed;
 assert.equal(c.activeCopyCode,'jpn');assert.deepEqual(messages,['offline']);
});
