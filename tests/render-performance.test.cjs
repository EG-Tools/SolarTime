'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),style=require('../src/surface-style.js'),root=path.resolve(__dirname,'..');
function fixture(astro=A){
 const timers=new Map();let serial=0,time=0;
 const window={SolarAstro:astro,SolarSurfaceStyle:style},context={window,Math,performance:{now:()=>++time},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),document:{createElement:()=>{const canvas={};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>canvas.image=image});return canvas;}}};
 for(const file of ['src/surface.js','src/renderer.js','src/sky.js','src/performance.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const r=Object.create(window.SolarRenderer.prototype);Object.assign(r,{physicsMs:NaN,physicsBodies:new Map(),physicsSatellites:new Map(),dpr:1,options:{quality:'auto'}});
 const step=()=>{const [id,fn]=timers.entries().next().value||[];if(fn){timers.delete(id);fn();}return !!fn;};
 return {r,window,timers,step,drain:()=>{let n=0;while(step()){if(++n>2000)throw Error('unbounded task');}return n;}};
}
test('subpixel surfaces retain texture demand without shader or weather work',()=>{
 const {window}=fixture(),direct=Object.create(window.SolarSurface.DirectRenderer.prototype),job={id:'earth',textureWidth:128};let reads=0;
 direct.desired=new Map();direct.texture=()=>{reads++;return {texture:{}};};
 assert.equal(direct.planet(job,{id:'earth'},{x:10,y:10},.1,0,true),true);
 assert.equal(reads,1);assert.equal(direct.desired.get('earth'),job);assert.equal(direct.cloudWeather,undefined);
 assert.doesNotThrow(()=>direct.corona({}, {x:10,y:10},.1,0));
 direct.texture=()=>null;assert.equal(direct.planet(job,{id:'earth'},{x:10,y:10},.1,0,true),false,'missing maps still use the existing fallback');
});

test('two seconds at 60fps reuse ephemeris endpoints without losing visible precision',()=>{
 let bodyCalls=0,moonCalls=0;
 const {r}=fixture({...A,positionAt:(b,t)=>{bodyCalls++;return A.positionAt(b,t);},satelliteAt:(b,t,s)=>{moonCalls++;return A.satelliteAt(b,t,s);}});
 const earth=A.BODIES.find(b=>b.id==='earth'),start=Date.parse('2026-10-01T00:00:00Z');
 let error=0;
 for(let i=0;i<120;i++){
  const ms=start+i*1000/60,p=r.physicalAt(earth,ms),m=r.satelliteUnitAt(A.MOON,ms),exact=A.positionAt(earth,ms),moon=A.satelliteAt(A.MOON,ms,1);
  for(const k of ['x','y','z'])error=Math.max(error,Math.abs(m[k]-moon[k]));
  assert.ok(Math.hypot(p.x-exact.x,p.y-exact.y,p.z-exact.z)<1e-9);
 }
 assert.ok(error<1e-8,error);assert.equal(bodyCalls,4);assert.equal(moonCalls,4);
 for(const ms of [start+A.DAY,start-A.DAY,start+10*A.DAY]){
  const old=bodyCalls,p=r.physicalAt(earth,ms);assert.deepEqual(p,A.positionAt(earth,ms));assert.equal(bodyCalls,old+1,'fast time travel uses one exact solve');
 }
});
test('interpolation crosses whole seconds smoothly in either direction and caches stay bounded',()=>{
 const {r}=fixture(),start=Date.parse('2080-01-01T00:00:00Z');
 for(const direction of [1,-1])for(let i=0;i<180;i++){
  const ms=start+direction*Math.round(i*1000/60); // Astronomy Engine's Date input has millisecond precision.
  for(const body of A.BODIES){const a=r.physicalAt(body,ms),b=A.positionAt(body,ms);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-8);}
  for(const body of A.SATELLITES){const a=r.satelliteUnitAt(body,ms),b=A.satelliteAt(body,ms,1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-8);}
 }
 assert.equal(r.physicsSamples.size,A.BODIES.length+A.SATELLITES.length);
});
test('cooperative weather is byte-identical, single-flight and cancels stale seeds/disposal',()=>{
 const f=fixture(),{CloudWeather}=f.window.SolarSurface.kernel(),weather=new CloudWeather(),reference=new CloudWeather();
 weather.prepare(.2);const pending=weather.pending;weather.prepare(.2);assert.equal(weather.pending,pending);assert.equal(weather.map,null);
 f.step();assert.equal(weather.map,null,'partial rows are never published');weather.prepare(.7);f.drain();reference.update(.7,20000);
 assert.equal(weather.builds,1);assert.deepEqual(weather.map.data,reference.map.data);assert.deepEqual(weather.startTurns,reference.startTurns);
 weather.prepare(.9);f.step();weather.cancelBuild();f.drain();assert.equal(weather.seed,.7);assert.equal(weather.builds,1);
 weather.prepare(.8);weather.dispose();f.drain();assert.equal(weather.map,null);assert.equal(f.timers.size,0);
});
test('far cloud LOD avoids all weather sampling and transitions continuously to full detail',()=>{
 const {window}=fixture(),{CloudWeather}=window.SolarSurface.kernel(),weather=new CloudWeather();weather.update(.2,20000);
 const field=weather.field;let reads=0;weather.field=function(...args){reads++;return field.apply(this,args);};
 const far=weather.coverage(.7,.3,.4,1,1,.5,1,0);assert.equal(reads,0);assert.equal(far,.7*.32);
 const full=weather.coverage(.7,.3,.4,1,1,.5,1,1);assert.equal(reads,2);
 for(const detail of [.001,.25,.5,.75,.999])assert.ok(Math.abs(weather.coverage(.7,.3,.4,1,1,.5,1,detail)-(far+(full-far)*detail))<1e-12);
 const plan=window.SolarPerformance.planTextures([{id:'earth',textureWidth:256,cloudAmount:1,cloudDetail:0}],{earth:{},clouds:{},'clouds-alt':{}});
 assert.ok(plan.targets.has('clouds'));assert.ok(!plan.targets.has('clouds-alt'));
});
test('corona immediately supplies a preview, refines identically and cancels on suspension',()=>{
 const f=fixture(),{r}=f,preview=r.coronaSource(20);assert.equal(preview.width,64);assert.equal(r.coronaTask.detail,384);
 const task=r.coronaTask;assert.equal(r.coronaSource(20),preview);assert.equal(r.coronaTask,task);
 const steps=f.drain();assert.ok(steps>10);assert.equal(r.coronaTexture.width,384);
 assert.deepEqual(r.coronaTexture.image.data,r.makeCoronaTexture(384).image.data);
 r.coronaSource(200);assert.equal(r.coronaTask.detail,768);f.step();r.cancelCoronaBuild();f.drain();assert.equal(r.coronaTexture.width,384);
});
test('memory counts resident/cached maps, auxiliary resources and all active canvases without double counting',()=>{
 const {r,window}=fixture(),surface=Object.create(window.SolarSurface.DirectRenderer.prototype),sky=Object.create(window.SolarSky.prototype);
 Object.assign(surface,{canvas:{width:100,height:80},stats:{texturePixels:1000},coronaTexture:{width:64,height:64},cloudWeather:{texture:{},map:{data:new Uint8Array(32768)}},orbitBufferBytes:4096,antialiasMemory:true,externalTextureBytes:8192});
 Object.assign(sky,{gl:{},ready:true,texture:{},buffer:{},starBuffer:{},starCount:100,canvas:{width:100,height:80},stats:{textureSize:[64,32]}});
 const active={memoryUsage:()=>5000},prepared={memoryUsage:()=>6000};
 r.gpu=surface;r.sky=sky;r.canvas={width:120,height:90};r.solarComposite={canvas:{width:50,height:40}};r.ringTour=active;r.preparedRingTour=prepared;
 const usage=r.memoryUsage();assert.equal(usage.surface.textures,4000);assert.equal(usage.sky.textures,8192*4/3);
 assert.equal(usage.main2D,120*90*4);assert.equal(usage.composite2D,50*40*4);assert.equal(usage.canvas2D,120*90*4+50*40*4);
 assert.equal(usage.ringTour,5000);assert.equal(usage.preparedRingTour,6000);
 assert.equal(usage.knownBytes,4000+64*64*4+32768+4096+48+4+8192*4/3+2400+48+5000+6000+120*90*4+50*40*4);
 assert.equal(usage.framebufferEstimate,100*80*4*6);assert.equal(usage.totalEstimate,usage.knownBytes+usage.framebufferEstimate);
 assert.equal(surface.auxiliaryTextureBytes(),64*64*4+32768+4+8192);
 r.preparedRingTour=active;assert.equal(r.memoryUsage().preparedRingTour,0,'shared active/prepared resources count once');
 surface.contextLost=true;sky.ready=false;r.canvas=null;r.solarComposite=null;r.ringTour=null;r.preparedRingTour=null;assert.equal(r.memoryUsage().totalEstimate,0);
});

test('compact solar scene uses stable oversampled tiers and restores the viewport target',()=>{
 const {r,window}=fixture();let resizes=0;
 const direct=Object.assign(Object.create(window.SolarSurface.DirectRenderer.prototype),{canvas:{width:1,height:1},viewportLimit:[4096,4096],stats:{},applyCanvasViewport(){}});
 direct.resize(800,600,.25);assert.equal(direct.dpr,.25);assert.equal(direct.canvas.width,200);assert.equal(direct.canvas.height,150);
 r.w=800;r.h=600;r.dpr=2;r.sceneDpr=2;r.solarRenderRatio=1;r.gpu={width:800,height:600,dpr:2,resize(w,h,dpr){resizes++;this.width=w;this.height=h;this.dpr=dpr;}};
 assert.equal(r.solarCompositeRatio(.05),.25);assert.equal(r.solarCompositeRatio(.1),.5);assert.equal(r.solarCompositeRatio(.13),.75);assert.equal(r.solarCompositeRatio(.21),1);
 assert.equal(r.setSolarRenderRatio(.25),.5);assert.equal(resizes,1);assert.equal(r.setSolarRenderRatio(.25),.5);assert.equal(resizes,1);
 assert.equal(r.setSolarRenderRatio(1),2);assert.equal(resizes,2);
});

test('mobile annotations use spare frame capacity only during reveal and respect overload recovery',()=>{
 let now=0;const window={},context={window,navigator:{userAgent:'Android Mobile'},matchMedia:()=>({matches:true}),screen:{width:390,height:844},performance:{now:()=>now}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'),context);
 const p=window.SolarPerformance;
 assert.equal(p.frameInterval(390,844,true),1000/30);
 assert.equal(p.frameInterval(390,844,false,true),1000/60);
 for(let n=0;n<40;n++)p.reportRenderCost(30);
 assert.equal(p.frameInterval(390,844,true,true),1000/30);
 for(let n=0;n<80;n++)p.reportRenderCost(1);
 assert.equal(p.frameInterval(390,844,true,true),1000/30);
 now=5000;assert.equal(p.frameInterval(390,844,true,true),1000/60);
 assert.equal(p.frameInterval(390,844,false,false),1000/30);
 for(let n=0;n<20;n++)p.reportFrameTiming(40,1000/60);
 assert.equal(p.frameInterval(390,844,true,true),1000/30);
});

test('particle policy reuses sustained load with recovery hold and renderer fades without jumps',()=>{
 let now=0;const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'),{window,performance:{now:()=>now}});
 const policy=window.SolarPerformance;
 assert.equal(policy.particleCapacity(),1);assert.equal(policy.particleCapacity('low'),.5);assert.equal(policy.particleBudget(),1);
 for(let n=0;n<40;n++)policy.reportRenderCost(30);
 assert.equal(policy.particleBudget(),.45);
 for(let n=0;n<80;n++)policy.reportRenderCost(1);
 assert.equal(policy.particleBudget(),.65);now=5000;assert.equal(policy.particleBudget(),1);
 const {r,window:host}=fixture();let target=1;host.SolarPerformance={particleBudget:()=>target};
 assert.equal(r.updateTravelParticleBudget(0),1);target=.45;
 assert.ok(r.updateTravelParticleBudget(100)>=.975);
 for(let n=2;n<=40;n++)r.updateTravelParticleBudget(n*100);
 assert.equal(r.travelParticleBudget.value,.45);target=1;r.updateTravelParticleBudget(1e7);
 assert.ok(r.travelParticleBudget.value<=.46+1e-9);
});

test('hidden warp retains only a bounded arrival preview and leaves clearance state intact',()=>{
 const {r}=fixture();let previews=0;r.prepareCloseup=id=>{assert.equal(id,'saturn');previews++;};
 const path={brakeAt:4300,resetAt:7000,particleAt:0,inbound:6500,clearSince:123};
 r.cameraTween={start:0,to:{focus:'saturn'},duration:15500,replay:path};r.sky=null;
 for(let mono=4400;mono<6800;mono+=100)r.prepareReplayFrame(mono);
 assert.equal(previews,3);assert.equal(path.clearSince,123);assert.equal(path.resetAt,7000);
 r.prepareReplayFrame(7200);assert.equal(previews,3);
});
