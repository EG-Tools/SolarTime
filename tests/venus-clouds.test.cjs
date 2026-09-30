'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const A=require('../src/astro.js'),style=require('../src/surface-style.js');
const window={SolarSurfaceStyle:style,SolarAstro:A};
const ctx={window,performance,setTimeout,clearTimeout};vm.createContext(ctx);
for(const file of ['src/surface.js','src/renderer.js','src/performance.js'])vm.runInContext(read(file),ctx);
const body=A.BODIES.find(b=>b.id==='venus');
function renderer(){const r=Object.create(window.SolarRenderer.prototype);Object.assign(r,{options:{venusCloudAmount:0,earthCloudAmount:.5},camera:{focus:'venus'},selected:'venus',dpr:1,bodyFrame:()=>({u:{x:1,y:0,z:0},v:{x:0,y:0,z:1},pole:{x:0,y:-1,z:0}}),viewDirection:v=>v});return r;}
function job(r,diameter){return r.surfaceJob(body,{x:1,y:0,z:1},diameter/2,Date.UTC(2026,8,30),0,true,{},0);}

test('Venus inverse LOD smoothly restores the saved amount near, always opaque far',()=>{
 const r=renderer();
 for(const saved of [0,.01,.5,1]){
  r.options.venusCloudAmount=saved;
  assert.equal(job(r,64).cloudAmount,1);assert.ok(Math.abs(job(r,200).cloudAmount-saved)<1e-12);
  let previous=1;for(let size=16;size<=220;size++){const j=job(r,size);assert.ok(j.cloudAmount<=previous+1e-12);previous=j.cloudAmount;assert.equal(r.options.venusCloudAmount,saved);assert.equal(j.cloudReveal,1);}
 }
 r.options.venusCloudAmount=0;assert.equal(job(r,112).cloudAmount,.5);
 assert.equal(job(r,200).cloudSeed,0);assert.equal(job(r,32).textureWidth,256,'distant focus does not demand 4K');
});

test('far Venus skips surface; near opaque Venus preloads only 256 and reveals request detail',()=>{
 const r=renderer(),assets={venus:{},'venus-surface':{}},p=window.SolarPerformance;
 assert.deepEqual([...p.planTextures([job(r,32)],assets).targets.keys()],['venus']);
 const close=job(r,600);assert.deepEqual([...p.planTextures([close],assets).targets.keys()],['venus-surface']);
 assert.equal(p.protectTexture({desired:new Map([['venus',job(r,32)]])},'venus-surface'),false);
 assert.equal(p.protectTexture({desired:new Map([['venus',close]])},'venus'),false);
 r.options.venusCloudAmount=.5;assert.deepEqual([...p.planTextures([job(r,600)],assets).targets.keys()],['venus-surface','venus']);
 r.options.venusCloudAmount=1;
 const near=job(r,600),plan=p.planTextures([near],assets);
 assert.equal(job(r,95).venusSurfacePreviewWidth,0);assert.equal(job(r,96).venusSurfacePreviewWidth,256);
 assert.equal(plan.targets.get('venus-surface'),256);assert.equal(plan.targets.get('venus'),4096);
 assert.equal(p.protectTexture({desired:new Map([['venus',near]])},'venus-surface'),true);
 const loading={desired:new Map([['venus',close]]),textures:new Map([['venus',{texture:{}}]])};
 assert.equal(p.protectTexture(loading,'venus'),true,'keep the displayed clouds while surface is missing');
 loading.textures.set('venus-surface',{texture:{}});assert.equal(p.protectTexture(loading,'venus'),false,'release the fallback after surface becomes drawable');
});

test('compatibility reveal keeps the last frame and schedules 256 before 1024 and 4096',()=>{
 const service=Object.create(window.SolarSurface.Service.prototype),posted=[];
 const visible={id:'venus',geometry:'opaque',cloudAmount:1,textureWidth:4096};
 const image={width:128,height:128},clear={...visible,geometry:'clear',cloudAmount:0};
 Object.assign(service,{frames:new Map([['venus',{image,job:visible}]]),desired:new Map([['venus',clear]]),pending:{jobs:[clear],mono:100},stats:{submitted:0},revision:0,epoch:0,worker:{postMessage:m=>posted.push(m)}});
 for(const expected of [256,1024,4096]){
  service.inflight=false;service.pending={jobs:[clear],mono:100};service.pump();
  assert.equal(posted.at(-1).jobs[0].textureWidth,expected);assert.equal(service.get('venus'),image);
  service.frames.set('venus',{image,job:posted.at(-1).jobs[0]});
 }
});

test('compatibility preview is bounded, cached, abortable and backs off after failure',async()=>{
 const win={SolarSurfaceStyle:style},local={window:win,performance,setTimeout,clearTimeout,AbortController};
 vm.createContext(local);vm.runInContext(read('src/surface.js'),local);
 const kernel=win.SolarSurface.kernel();kernel.setAssets({'venus-surface':'preview.webp'});
 const engine=Object.create(kernel.Engine.prototype);engine.textures=new Map();
 let count=0,finish,signal;
 engine.texture=(_id,width,s)=>{count++;assert.equal(width,256);signal=s;return new Promise(resolve=>{finish=()=>{engine.textures.set('venus-surface:256',{source:'preview.webp'});resolve();};});};
 engine.preloadVenusSurface();const pending=engine.venusSurfacePreview.promise;
 engine.preloadVenusSurface();assert.equal(count,1);assert.equal(signal.aborted,false);
 finish();await pending;engine.preloadVenusSurface();assert.equal(count,1);
 engine.textures.clear();engine.texture=async()=>{count++;throw Error('offline');};
 engine.preloadVenusSurface();await engine.venusSurfacePreview.promise;engine.preloadVenusSurface();assert.equal(count,2);
 engine.venusSurfacePreviewRetryAt=0;engine.texture=(_id,_width,s)=>new Promise(resolve=>{signal=s;s.addEventListener('abort',resolve,{once:true});});
 engine.cpuMaps=new Map();engine.preloadVenusSurface();const last=engine.venusSurfacePreview.promise;
 engine.clear();assert.equal(signal.aborted,true);await last;assert.equal(engine.venusSurfacePreview,null);
});

test('both GPU paths use plain Venus alpha and the same raised shell as CPU',()=>{
 for(const shader of [window.SolarSurface.shaderSources.planet,window.SolarSurface.kernel().shaderSources.fragment]){
  const layer=shader.match(/vec4 venusCloudLayer\([^]*?\n  \}/)[0];
  assert.match(layer,/atmosphericShellUv\(normal,1\.02\)/);
  assert.match(layer,/return vec4\(color,amount\)/);
  assert.doesNotMatch(layer,/cloudDrift|cloudWeather|CloudGate|CloudDensity|cloudLife/);
 }
 const source=read('src/surface.js');assert.match(source,/const radius=1\.02,sx=nx\/radius/);
 assert.doesNotMatch(source,/venusWeather|venusOpacity|profile==='venus'/);
 assert.equal(job(renderer(),200).weatherDay,0);
});

test('Venus CPU opacity is linear and stable across time and re-enable without weather allocations',async()=>{
 class Canvas{constructor(w,h){this.width=w;this.height=h;}getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>{this.pixels=im.data;}};}}
 const win={SolarSurfaceStyle:style},local={window:win,performance,setTimeout,clearTimeout,OffscreenCanvas:Canvas};
 vm.createContext(local);vm.runInContext(read('src/surface.js'),local);
 const engine=new (win.SolarSurface.kernel().Engine)({gpu:false}),demand=[];
 engine.texture=async id=>{demand.push(id);return {width:4,height:2,data:Uint8Array.from({length:32},(_,i)=>i%4===3?255:(id==='venus'?150:40)+i)};};
 const base={id:'venus',diam:16,textureWidth:4,phase:.47,frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[0,0,1],weatherDay:20000,cloudSeed:0};
 const render=async amount=>{demand.length=0;await engine.render({...base,cloudAmount:amount});assert.equal(engine.cloudWeather,undefined);assert.equal(engine.venusWeather,undefined);return [...engine.canvas.pixels];};
 try{
  const clear=await render(0);assert.deepEqual(demand,['venus-surface']);
  const opaque=await render(1);assert.deepEqual(demand,['venus']);
  for(const amount of [.01,.25,.5,.75,.99]){
   const partial=await render(amount);
   for(let i=0;i<partial.length;i++)if(i%4!==3)assert.ok(Math.abs(partial[i]-(clear[i]*(1-amount)+opaque[i]*amount))<=1,`linear alpha at ${amount}, channel ${i}`);
  }
  const half=await render(.5);await render(0);
  for(const day of [-20000,0,21000]){base.weatherDay=day;base.cloudSeed=.9;assert.deepEqual(await render(.5),half);}
 }finally{engine.clear();}
});

test('Venus amount is independent, persisted, translated and clamped without new random seeds',()=>{
 const app=read('src/app.js'),html=read('index.html'),r=renderer();
 assert.match(html,/id="venus-cloud-amount"[^>]+min="0"[^>]+max="100"[^>]+value="80"[^>]+data-i18n-aria="atmosphericClouds"/);
 assert.match(app,/saved\.venusCloudAmount/);
 assert.match(app,/FACTORY_OPTIONS=Object\.freeze\([^\n]*venusCloudAmount:\.8/);
 assert.match(read('src/renderer.js'),/this\.options=\{[^\n]*venusCloudAmount:\.8/);
 const handler=app.match(/\$\('venus-cloud-amount'\)\.addEventListener\('input',\(\)=>\{([\s\S]*?)\n      \}\);/)[1];
 assert.doesNotMatch(handler,/random|Seed/);assert.match(handler,/setOption\('venusCloudAmount',value\/100\)/);
 r.setOption('venusCloudAmount',2);assert.equal(r.options.venusCloudAmount,1);r.setOption('venusCloudAmount',-1);assert.equal(r.options.venusCloudAmount,0);
 r.setOption('venusCloudAmount',NaN);assert.equal(r.options.venusCloudAmount,.8);
 assert.equal(r.options.earthCloudAmount,.5);
});
