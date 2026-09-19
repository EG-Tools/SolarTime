'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function renderer(seed=.127694){
 let now=0;const M=Object.create(Math);M.random=()=>seed;
 const window={SolarAstro:A},sandbox={window,performance:{now:()=>now},Math:M};
 vm.runInNewContext(read('src/renderer.js'),sandbox);const R=window.SolarRenderer,r=Object.create(R.prototype);
 Object.assign(r,{w:1280,h:800,options:{pluto:true,moon:true,dollyZoom:false},camera:r.defaultCameraSnapshot(),cameraTween:null,autoRotation:null,pendingAutoRotation:null,rotationGeneration:0,bodyScales:{earth:5.05},actualScaleMix:0,clearLabels(){},surface:{invalidate(){},pause(){}},sky:{pause(){}},projected:[]});
 return {r,R,now:value=>{now=value;}};
}
const ms=Date.parse('2026-09-19T12:00:00Z');
test('country inspection ends at 250x and removes inherited zoom/dolly/pan',()=>{
 const {r}=renderer();Object.assign(r.camera,{zoom:1800,dolly:12,panX:.5,panY:-.4});
 assert.equal(r.animateFeature('earth',37.5665,126.978,ms,0,1000),true);r.advanceCamera(1000);
 assert.equal(r.camera.zoom,250);assert.equal(r.camera.dolly,1);assert.equal(r.camera.focus,'earth');assert.equal(r.camera.panX,0);assert.equal(r.camera.panY,0);
 const n=A.surfaceDirection(A.BODIES.find(b=>b.id==='earth'),37.5665,126.978,ms),view=r.viewDirection(n);
 close(view.x,0);close(view.y,0);assert.ok(view.z>0);
 r.smoothZoom(500,null,1100);r.advanceCamera(1300);assert.equal(r.camera.zoom,500);
 r.smoothZoom(125,null,1400);r.advanceCamera(1600);assert.equal(r.camera.zoom,125);
 assert.equal(r.zoomLimits.maxZoom,2048);
});
test('Move country inspection preserves wheel mode and matches the 250x Earth radius',()=>{
 const {r,R}=renderer(),earth=A.BODIES.find(b=>b.id==='earth');
 r.options.dollyZoom=true;Object.assign(r.camera,{zoom:1700,dolly:12});
 const targetRadius=r.bodyRadiusForState(earth,{...r.camera,focus:'earth',zoom:250,dolly:1});
 assert.ok(r.animateFeature('earth',1.2833333,103.85,ms,0,1000));assert.ok(R.validCamera(r.cameraTween.to));r.advanceCamera(1000);
 assert.equal(r.options.dollyZoom,true);assert.equal(r.camera.zoom,1);close(r.bodyRadiusForState(earth,r.camera),targetRadius);
 const d=r.camera.dolly;r.smoothDolly(d*1.5,'earth',1100);r.advanceCamera(1300);close(r.camera.dolly,d*1.5);
});
test('all supported country coordinates use the same 250x camera command',()=>{
 const app=read('src/app.js'),start=app.indexOf('  const REGIONS='),end=app.indexOf('  const STAR_DENSITY_COPY=',start);
 const regions=vm.runInNewContext(app.slice(start,end)+';REGIONS');
 for(const region of Object.values(regions)) {const {r}=renderer();assert.ok(r.animateFeature('earth',region.latitude,region.longitude,ms,0,1000),region.label);assert.equal(r.cameraTween.to.zoom,250);}
});
test('ordinary planet focus and Jupiter feature view do not inherit the country zoom',()=>{
 const {r}=renderer();r.animateFeature('jupiter',-22,70,ms,0,1000);assert.ok(r.cameraTween.to.zoom<=64);r.advanceCamera(1000);r.animateFocus('mars',1100,1000);assert.ok(r.cameraTween.to.zoom<=64);
});
test('random mode is opt-in, exclusive with left/right and does not change framing',()=>{
 const {r}=renderer(),before=plain(r.camera);assert.equal(r.randomRotateEnabled,false);
 r.setAutoRotate(1,0);r.setRandomRotate(true,0);assert.equal(r.autoRotateDirection,0);assert.equal(r.randomRotateEnabled,true);assert.deepEqual(plain(r.camera),before);
 for(let i=1;i<=1800;i++)r.advanceAutoRotate(i*1000/60);
 assert.notEqual(r.camera.azimuth,before.azimuth);assert.notEqual(r.camera.elevation,before.elevation);
 for(const k of ['focus','zoom','dolly','panX','panY'])assert.equal(r.camera[k],before[k],k);
 r.setAutoRotate(-1,30000);assert.equal(r.randomRotateEnabled,false);assert.equal(r.autoRotateDirection,-1);
 r.setRandomRotate(false,30000);assert.equal(r.autoRotateDirection,-1,'OFF must not disable ordinary rotation');
});
test('random angles are frame-rate independent across many segment boundaries',()=>{
 const results=[];for(const fps of [30,60,90,144,165]){const {r}=renderer();r.setRandomRotate(true,0);for(let i=1;i<=fps*120;i++)r.advanceAutoRotate(i*1000/fps);results.push(r.camera);}
 for(const value of results.slice(1)){close(value.azimuth,results[0].azimuth);close(value.elevation,results[0].elevation);}
});
test('random angular speeds remain bounded and continuous at direction changes',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);let prior=plain(r.camera),velocity=null;
 for(let i=1;i<=7200;i++){
  r.advanceAutoRotate(i*1000/60);const v=[(A.wrap(r.camera.azimuth-prior.azimuth+Math.PI)-Math.PI)*60,(A.wrap(r.camera.elevation-prior.elevation+Math.PI)-Math.PI)*60];
  assert.ok(Math.abs(Math.hypot(...v)/A.DEG-1.8)<.0001,'random rotation must keep left/right speed, not merely stay below it');
  if(velocity){assert.ok(Math.abs(v[0]-velocity[0])<.001);assert.ok(Math.abs(v[1]-velocity[1])<.001);}
  prior=plain(r.camera);velocity=v;
 }
});
test('random OFF freezes current angles without resetting view',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(200);r.setRandomRotate(false,200);const before=plain(r.camera);r.advanceAutoRotate(10000);assert.deepEqual(plain(r.camera),before);assert.equal(r.randomRotateEnabled,false);
});
test('random rotation survives wheel, preset and home tweens without duplicate motion owners',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(200);const path=r.randomRotation;
 r.smoothZoom(300,null,200);assert.equal(r.autoRotation,null);assert.equal(r.randomRotateEnabled,true);r.advanceCamera(400);
 assert.equal(r.randomRotation,path);assert.equal(r.camera.zoom,300);assert.equal(r.pendingAutoRotation,null);assert.equal(r.randomRotateEnabled,true);
 const saved={...r.camera,azimuth:2,elevation:.3,zoom:500,panX:.2};r.animateCamera(saved,500,1000);r.advanceCamera(1500);assert.equal(r.camera.zoom,500);assert.equal(r.randomRotateEnabled,true);
 r.animateHome(1600,1000);r.advanceCamera(2600);assert.equal(r.randomRotateEnabled,true);assert.equal(r.camera.zoom,r.defaultCameraSnapshot().zoom);
});
test('interrupted tween and manual orbit retain random mode just like left/right',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.animateFocus('earth',0,1100);r.cancelCameraTween(500);
 assert.equal(r.randomRotateEnabled,true);assert.ok(r.autoRotation);assert.equal(r.pendingAutoRotation,null);
 const path=r.randomRotation;r.setOrbitView(.8,.2,500);assert.equal(r.randomRotateEnabled,true);assert.equal(r.randomRotation,path);close(r.camera.azimuth,.8);close(r.camera.elevation,.2);r.advanceAutoRotate(600);assert.notEqual(r.camera.azimuth,.8);
 r.setAutoRotate(1,500);r.setOrbitView(.9,.3);assert.equal(r.autoRotateDirection,1);
});
test('tab suspension and large stalls do not catch up random motion in a jump',()=>{
 const {r,now}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(200);now(200);r.suspend();const before=plain(r.camera);
 r.advanceAutoRotate(100000);assert.deepEqual(plain(r.camera),before);r.advanceAutoRotate(100100);
 assert.ok(Math.abs(r.camera.azimuth-before.azimuth)<.004);
 const at=r.camera.azimuth;r.advanceAutoRotate(400000);assert.ok(Math.abs(r.camera.azimuth-at)<1.8*A.DEG*.251);
});
test('invalid random commands are rejected and repeated ON is idempotent',()=>{
 const {r}=renderer();assert.equal(r.setRandomRotate('yes',0),false);assert.equal(r.setRandomRotate(true,NaN),false);assert.equal(r.setAutoRotate(2,0),false);
 r.setRandomRotate(true,0);const motion=r.autoRotation;r.setRandomRotate(true,300);assert.equal(r.autoRotation,motion);
});
test('random button is below the displayed left-turn button and uses shared toggle styling',()=>{
 const html=read('index.html');assert.match(html,/id="rotate-right"[\s\S]*id="random-rotate"[\s\S]*id="zen-toggle"/);assert.match(html,/id="random-rotate" class="icon-button rotate-button"/);
 const icon=html.split('id="random-rotate"')[1].split('</button>')[0];assert.equal((icon.match(/<ellipse /g)||[]).length,2);assert.match(icon,/aria-pressed="false"/);
 for(const f of fs.readdirSync(path.join(__dirname,'../src/locales'))){const data=JSON.parse(read('src/locales/'+f));assert.ok(data.copy.randomRotate,f);}
});
test('frame deadline accumulation reaches requested 60/30 fps on 60..165 Hz displays',()=>{
 const window={};vm.runInNewContext(read('src/performance.js'),{window,performance});
 for(const hz of [60,75,90,120,144,165])for(const fps of [30,60]){
  const gate=window.SolarPerformance.createFrameGate();let count=0;
  for(let i=0;i<hz*60;i++)if(gate(i*1000/hz,1000/fps))count++;
  assert.ok(Math.abs(count-fps*60)<=1,`${hz} Hz ${fps} fps: ${count}`);
 }
});
test('frame deadlines reset across suspension, changed targets and invalid inputs',()=>{
 const window={};vm.runInNewContext(read('src/performance.js'),{window,performance});const gate=window.SolarPerformance.createFrameGate();
 assert.equal(gate(NaN,16),false);assert.equal(gate(0,0),false);assert.equal(gate(0,1000/60),true);assert.equal(gate(5,1000/60),false);assert.equal(gate(100000,1000/60),true);assert.equal(gate(100001,1000/60),false);assert.equal(gate(100002,1000/30),true);assert.equal(gate(100003,1000/30,true),true);
});
test('stat text and unit nodes are reused and unchanged values do not replace children',()=>{
 const app=read('src/app.js'),start=app.indexOf('      const statNodes='),end=app.indexOf('      function updateBody',start),nodes=new Map();let replacements=0;
 const context={$:id=>{if(!nodes.has(id))nodes.set(id,{replaceChildren(...children){this.children=children;replacements++;}});return nodes.get(id);},document:{createTextNode:value=>({nodeValue:value}),createElement:()=>({textContent:'',hidden:false})}};
 vm.runInNewContext(app.slice(start,end)+';this.setStat=setStat;',context);
 context.setStat('value','27.32','days');const original=nodes.get('value').children;for(let i=0;i<100;i++)context.setStat('value','27.32','days');assert.equal(replacements,1);assert.equal(nodes.get('value').children,original);
 context.setStat('value','27.33','days');assert.equal(replacements,1);assert.equal(original[0].nodeValue,'27.33 ');
 context.setStat('value','Sun','');assert.equal(original[1].hidden,true);context.setStat('value','28','hours');assert.equal(original[1].hidden,false);
});
test('each new page generates fresh stars; camera controls never call regeneration',()=>{
 const samples=[];for(let seed=1;seed<=2;seed++){
  const window={SolarAssets:{},crypto:{getRandomValues:array=>array[0]=seed}},M=Object.create(Math);M.random=()=>.5;
  vm.runInNewContext(read('src/visual-effects.js'),{window,Math:M,Date:{now:()=>123456789}});samples.push(Array.from(window.SolarAssets.starData.slice(0,30)));
 }
 assert.notDeepEqual(samples[0],samples[1]);assert.doesNotMatch(read('src/renderer.js'),/regenerateStars/);
});
const wrapDelta=(a,b)=>A.wrap(a-b+Math.PI)-Math.PI;
test('manual angular deltas extend the running pose after idle and retain every rotation mode',()=>{
 for(const mode of [-1,1,2])for(const elevation of [89.99,90.01,120,179.99,-89.99,-90.01,-120,-179.99]){
  const {r,R}=renderer(),ref=renderer().r;
  for(const v of [r,ref]){v.camera.elevation=elevation*A.DEG;v.camera.azimuth=6.27;mode===2?v.setRandomRotate(true,0):v.setAutoRotate(mode,0);}
  const randomPath=r.randomRotation;
  // Pointer is held still while automatic rotation keeps changing both angles.
  for(let i=1;i<=600;i++){r.advanceAutoRotate(i*1000/60);ref.advanceAutoRotate(i*1000/60);}
  ref.advanceAutoRotate(10008);r.rotateViewBy(.012,.006,10008);
  close(wrapDelta(r.camera.azimuth,ref.camera.azimuth),.012);close(wrapDelta(r.camera.elevation,ref.camera.elevation),.006);
  assert.equal(r.rotationIntent,mode);assert.equal(r.randomRotation,randomPath);assert.ok(R.validCamera(r.cameraSnapshot()));
  const before=plain(r.camera);r.advanceAutoRotate(10024);
  assert.notEqual(r.camera.azimuth,before.azimuth);assert.equal(r.rotationIntent,mode);
  for(const key of ['zoom','dolly','panX','panY','focus'])assert.equal(r.camera[key],before[key]);
 }
});
test('vertical manual rotation is physically continuous through both poles and full turns',()=>{
 const {r,R}=renderer();
 for(const start of [Math.PI/2,-Math.PI/2,Math.PI,-Math.PI])for(const sign of [-1,1]){
  r.setOrbitView(.3,start-sign*.002,0);const before=r.viewDirection({x:1,y:2,z:3});
  assert.ok(r.rotateViewBy(0,sign*.004,0));const after=r.viewDirection({x:1,y:2,z:3});
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)<.02);assert.ok(R.validCamera(r.cameraSnapshot()));
 }
 r.setOrbitView(.3,0,0);const before=r.viewDirection({x:1,y:2,z:3});
 for(let i=0;i<1000;i++)r.rotateViewBy(0,Math.PI*8/1000,0);
 const after=r.viewDirection({x:1,y:2,z:3});close(after.x,before.x);close(after.y,before.y);close(after.z,before.z);
});
test('manual takeover of a feature tween retains random intent and the interpolated pose',()=>{
 const {r}=renderer(),ref=renderer().r;
 for(const v of [r,ref]){v.setRandomRotate(true,0);v.animateFeature('earth',37.56,126.98,ms,0,1100);}
 ref.cancelCameraTween(400);ref.advanceAutoRotate(400);r.rotateViewBy(.02,-.01,400);
 close(wrapDelta(r.camera.azimuth,ref.camera.azimuth),.02);close(wrapDelta(r.camera.elevation,ref.camera.elevation),-.01);
 assert.equal(r.cameraTween,null);assert.equal(r.pendingAutoRotation,null);assert.equal(r.randomRotateEnabled,true);
 const state=plain(r.camera);r.advanceAutoRotate(450);assert.notEqual(r.camera.elevation,state.elevation);
});
test('invalid relative input cannot advance the camera or alter the active rotation intent',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);const before=plain(r.camera);
 for(const values of [[NaN,0,100],[0,Infinity,100],[0,0,NaN]])assert.equal(r.rotateViewBy(...values),false);
 assert.deepEqual(plain(r.camera),before);assert.equal(r.randomRotateEnabled,true);
});
test('pointer input uses current deltas rather than saved start angles; small clicks still have a dead zone',()=>{
 const app=read('src/app.js');assert.doesNotMatch(app,/startAzimuth|startElevation/);
 assert.match(app,/renderer\.rotateViewBy\(\(wasMoved\?dx:p\.x-drag\.startX\)/);
 assert.match(app,/Math\.hypot\(p\.x-drag\.startX,p\.y-drag\.startY\)>4/);
});

// A nonzero floating-point delta is not proof of visible motion: compare the
// actual angular distance against ordinary auto rotation from the first frame.
test('random rotation starts at full left/right speed for varied seeds and update rates',()=>{
 for(const seed of [0,.001,.127694,.25,.5,.75,.999999])for(const fps of [4,30,60,90,144,165]){
  const {r}=renderer(seed),left=renderer(seed).r;r.setRandomRotate(true,0);left.setAutoRotate(1,0);
  let travel=0,leftTravel=0;
  for(let i=1;i<=fps;i++){
   const before=plain(r.camera),leftBefore=left.camera.azimuth;
   r.advanceAutoRotate(i*1000/fps);left.advanceAutoRotate(i*1000/fps);
   const d=Math.hypot(wrapDelta(r.camera.azimuth,before.azimuth),wrapDelta(r.camera.elevation,before.elevation));
   const expected=Math.abs(wrapDelta(left.camera.azimuth,leftBefore));
   assert.ok(Math.abs(d/expected-1)<1e-5,`seed ${seed} fps ${fps} frame ${i}: ${d/expected}`);
   travel+=d;leftTravel+=expected;
  }
  close(travel/A.DEG,1.8,.00001);close(travel,leftTravel,.000001);
 }
});
test('random heading turns through an opposite direction without slowing through zero',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);
 Object.assign(r.randomRotation,{heading:0,turn:Math.PI,duration:8,elapsed:0});
 let previous=plain(r.camera),total=0;
 for(let i=1;i<=8*60;i++){
  r.advanceAutoRotate(i*1000/60);
  const d=Math.hypot(wrapDelta(r.camera.azimuth,previous.azimuth),wrapDelta(r.camera.elevation,previous.elevation));
  assert.ok(Math.abs(d*60/A.DEG-1.8)<.0001);total+=d;previous=plain(r.camera);
 }
 close(total/A.DEG,14.4,.0001);
});
test('manual release and tween completion resume random rotation at unchanged speed',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(100);
 const path=r.randomRotation;r.rotateViewBy(.01,.01,100);let before=plain(r.camera);r.advanceAutoRotate(100+1000/60);
 close(Math.hypot(wrapDelta(r.camera.azimuth,before.azimuth),wrapDelta(r.camera.elevation,before.elevation))/A.DEG,.03,1e-6);
 r.animateHome(200,1000);r.advanceCamera(1200);assert.equal(r.randomRotation,path);
 before=plain(r.camera);r.advanceAutoRotate(1200+1000/60);
 close(Math.hypot(wrapDelta(r.camera.azimuth,before.azimuth),wrapDelta(r.camera.elevation,before.elevation))/A.DEG,.03,1e-6);
});
