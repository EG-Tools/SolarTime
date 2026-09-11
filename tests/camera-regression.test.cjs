'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/astro.js');
const sandbox={window:{SolarAstro:A},performance:{now:()=>0}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),sandbox);
const R=sandbox.window.SolarRenderer,all=[A.SUN,...A.BODIES,A.MOON],near=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,`${x} != ${y}`);
function renderer(w=1648,h=928){
 const r=Object.create(R.prototype);
 Object.assign(r,{w,h,dpr:1,lensStretch:Math.min(w/h,1.72),options:{moon:true,pluto:true,orbits:false,labels:false,quality:'low'},
  camera:{azimuth:25*A.DEG,elevation:45*A.DEG,zoom:1,focus:null,panX:0,panY:0},
  ctx:{clearRect(){}},sky:{draw(){},decorate(){}},surface:{get(){},update(){},invalidate(){}},
  labelStates:new Map(),lastLabelMono:null,frameCount:0,dirty:true});
 r.drawBody=()=>{};return r;
}

test('Regression: Moon normalization never multiplies every body by 1 / Moon size',()=>{
 const r=renderer();r.camera.focus='moon';r.setZoom(40);
 near(r.bodyRadiusAtZoom(A.SUN),28*r.baseBodyScale()*Math.sqrt(40));
 assert.ok(r.bodyRadiusAtZoom(A.SUN)<210); // Formerly 1730.67px at 1648x928.
 assert.ok(r.bodyRadiusAtZoom(A.BODIES[4])<210); // Formerly 1792.47px.
 near(r.bodyRadiusAtZoom(A.MOON),3.9*928/820+(928*.34-3.9*928/820)*(Math.sqrt(40)-1)/7);
});

test('One ordinary magnifier depends only on zoom and viewport, not tracking identity',()=>{
 for(const [w,h] of [[1648,928],[1920,1080],[390,844],[320,568]])for(const z of [.6,1,1.01,6,14,40,64]){
  const r=renderer(w,h);r.setZoom(z);const expected=r.baseBodyScale()*Math.sqrt(z);
  for(const target of all){r.camera.focus=target.id;near(r.bodyScaleAtZoom(),expected);}
 }
});

test('Every unfocused planet has the same radius at the same zoom across all targets',()=>{
 for(const z of [1.001,6,14,40,64]){
  const r=renderer();r.setZoom(z);
  for(const body of all)for(const target of all.filter(b=>b!==body)){
   r.camera.focus=target.id;near(r.bodyRadiusAtZoom(body),body.size*r.baseBodyScale()*Math.sqrt(z));
  }
 }
});

test('Orbit rotation and bounded panning never change zoom or body radius',()=>{
 const r=renderer();r.focusBody('moon');r.setZoom(40);const expected=all.map(b=>r.bodyRadiusAtZoom(b));
 for(const e of [-90,-45,0,45,90])for(const a of [0,25,180,359.9]){
  r.setOrbitView(a*A.DEG,e*A.DEG);r.setPan(.1,-.17);r.rebuild(Date.UTC(2026,8,11));
  near(r.camera.zoom,40);all.forEach((b,i)=>near(r.bodyRadiusAtZoom(b),expected[i]));
 }
});

test('Snapshot, surface requests and picking share the same per-body radii',()=>{
 const r=renderer();r.focusBody('moon');r.setZoom(40);r.draw(Date.UTC(2026,8,11),0,10);
 for(const p of r.projected)near(p.r,r.bodyRadiusAtZoom(p.body));
 const moon=r.projected.find(b=>b.body.id==='moon');near(moon.screen.x,r.centerX);near(moon.screen.y,r.centerY);
 const hit=r.hitTargets.find(h=>h.id==='moon');near(hit.r,moon.r+6);
 const sun=r.projected.find(b=>b.body.id==='sun');assert.ok(sun.r<210);
});

test('Earth-Moon spacing has one local radius and does not alter the solar display scale',()=>{
 const r=renderer(),ms=Date.UTC(2026,8,11);
 for(const focus of ['moon','earth','sun']){
  r.focusBody(focus);r.setZoom(40);r.draw(ms,0,10);
  const earth=r.projected.find(p=>p.body.id==='earth'),moon=r.projected.find(p=>p.body.id==='moon');
  const radius=r.moonOrbitRadius(earth.r,moon.r);
  near(Math.hypot(moon.world.x-earth.world.x,moon.world.y-earth.world.y,moon.world.z-earth.world.z),radius);
  assert.ok(radius*r.scale>=earth.r+moon.r);
  near(r.bodyScale,r.baseBodyScale()*Math.sqrt(40));
 }
});

test('Returning home restores exact initial center, body sizes and no focus',()=>{
 const r=renderer(),ms=Date.UTC(2026,8,11);r.draw(ms,0,0);
 const before=r.projected.map(p=>({id:p.body.id,r:p.r,x:p.screen.x,y:p.screen.y}));
 r.focusBody('moon');r.setZoom(64);r.setOrbitView(3,-1.2);r.setPan(.2,-.2);r.draw(ms,0,5);
 r.resetCamera();r.draw(ms,0,10);
 assert.equal(r.camera.focus,null);near(r.camera.zoom,1);
 for(const p of r.projected){const q=before.find(q=>q.id===p.body.id);near(p.r,q.r);near(p.screen.x,q.x);near(p.screen.y,q.y);}
});

test('Non-finite camera inputs do not corrupt a close-up or create giant radii',()=>{
 const r=renderer();r.focusBody('moon');const before={...r.camera};
 r.setZoom(NaN);r.setZoom(Infinity);r.setOrbitView(NaN,0);r.setPan(Infinity,0);
 assert.deepEqual({...r.camera},before);all.forEach(b=>assert.ok(Number.isFinite(r.bodyRadiusAtZoom(b))));
});

test('Saved camera is an independent snapshot with angle, zoom, pan and tracking',()=>{
 const r=renderer();r.setOrbitView(2.3,-.8);r.setPan(.18,-.12);r.focusBody('moon');r.setZoom(21);
 const saved=r.cameraSnapshot();assert.ok(R.validCamera(saved));const copy={...saved};
 r.resetCamera();assert.deepEqual({...saved},copy);assert.ok(r.restoreCamera(saved));assert.deepEqual({...r.camera},copy);
 r.camera.zoom=10;assert.equal(saved.zoom,21);
});

test('Camera presets reject malformed/out-of-range values without a partial camera change',()=>{
 const r=renderer(),valid=r.cameraSnapshot(),before={...r.camera};
 const invalid=[null,{},[],{...valid,azimuth:NaN},{...valid,elevation:Infinity},
  {...valid,elevation:2},{...valid,azimuth:-1},{...valid,zoom:100},{...valid,panX:.21},
  {...valid,panY:-.21},{...valid,focus:'bogus'},{...valid,zoom:'2'},{...valid,focus:'earth'}];
 for(const value of invalid){assert.equal(R.validCamera(value),false);assert.equal(r.restoreCamera(value),false);assert.deepEqual({...r.camera},before);}
});

test('Disabled tracked bodies are never secretly enabled by recalling a camera',()=>{
 const r=renderer();r.focusBody('moon');const saved=r.cameraSnapshot();r.resetCamera();r.options.moon=false;
 const before={...r.camera};assert.equal(r.restoreCamera(saved),false);assert.deepEqual({...r.camera},before);
 assert.equal(r.options.moon,false);r.options.moon=true;assert.equal(r.restoreCamera(saved),true);
});

test('Recalled camera and original camera produce identical geometry at the same time',()=>{
 const r=renderer();r.focusBody('jupiter');r.setZoom(19);r.setPan(-.12,.14);r.setOrbitView(4.1,-1.1);
 const ms=Date.UTC(2026,8,11);r.draw(ms,0,100);const saved=r.cameraSnapshot();
 const positions=r.projected.map(p=>({id:p.body.id,x:p.screen.x,y:p.screen.y,r:p.r}));
 r.resetCamera();r.draw(ms,0,200);r.restoreCamera(saved);r.draw(ms,0,300);
 for(const p of r.projected){const q=positions.find(q=>q.id===p.body.id);near(p.screen.x,q.x);near(p.screen.y,q.y);near(p.r,q.r);}
});

test('Per-body surface signatures cannot alias another planets frame',()=>{
 const r=renderer();r.cameraChangeAt=-Infinity;const ms=Date.UTC(2026,8,11);
 const j=A.BODIES.find(b=>b.id==='jupiter'),s=A.BODIES.find(b=>b.id==='saturn');
 const a=r.surfaceJob(j,{},16,ms,0,100),b=r.surfaceJob(s,{},16,ms,0,100);
 assert.ok(a.geometry.startsWith('jupiter:'));assert.ok(b.geometry.startsWith('saturn:'));
});
