/* Camera controller regressions. Analytic fixture bodies, not ephemeris validation. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),TAU=Math.PI*2,DEG=Math.PI/180;
const A={TAU,DEG,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),wrap:(v,m=TAU)=>(v%m+m)%m,
 BODIES:[{id:'earth',size:17.25},{id:'jupiter',size:29},{id:'pluto',size:5}],SUN:{id:'sun',size:28},MOON:{id:'moon',size:3.9},
 surfaceDirection:()=>({x:.3,y:-.4,z:Math.sqrt(.75)})};
const scope={window:{SolarAstro:A},performance:{now:()=>0},console};vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root,'src/renderer.js'),'utf8'),scope);
const Renderer=scope.window.SolarRenderer,plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){return Object.assign(Object.create(Renderer.prototype),{w:1400,h:800,options:{moon:true,pluto:true},camera:{azimuth:.4,elevation:.7,zoom:1,focus:null,panX:0,panY:0},cameraTween:null,autoRotation:null,labelStates:new Map(),surface:{invalidate(){}}});}
const near=(x,y,eps=1e-8)=>assert.ok(Math.abs(x-y)<eps,`${x} != ${y}`);
test('overview -> focus starts without changing the displayed camera',()=>{
 const r=fixture(),before=plain(r.camera);assert.equal(r.animateFocus('earth',100),true);assert.deepEqual(plain(r.camera),before);assert.equal(r.cameraTween.bridge,false);
 r.advanceCamera(650);assert.ok(r.camera.zoom>1&&r.camera.zoom<r.cameraTween.to.zoom);assert.equal(r.camera.focus,'earth');r.advanceCamera(1200);assert.equal(r.cameraTween,null);near(r.bodyRadiusAtZoom(A.BODIES[0]),200);
});
test('home transition retains tracking until scale is one, then commits exact home',()=>{
 const r=fixture();r.camera={...r.camera,focus:'earth',zoom:64};r.animateHome(0);near(r.camera.zoom,64);r.advanceCamera(550);assert.equal(r.camera.focus,'earth');assert.ok(r.camera.zoom>1&&r.camera.zoom<64);r.advanceCamera(1100);assert.equal(r.camera.focus,null);near(r.camera.zoom,1);near(r.camera.azimuth,25*DEG);
});
test('different closeups switch focus only at overview scale',()=>{
 const r=fixture();r.camera={...r.camera,focus:'earth',zoom:64};r.animateFocus('moon',0);assert.equal(r.cameraTween.bridge,true);const half=r.cameraTween.duration/2;
 r.advanceCamera(half-1);assert.equal(r.camera.focus,'earth');assert.ok(r.camera.zoom<1.001);r.advanceCamera(half);near(r.camera.zoom,1);r.advanceCamera(half+1);assert.equal(r.camera.focus,'moon');
});
test('interrupting a transition restarts at its visible position',()=>{
 const r=fixture();r.animateFocus('earth',0);r.advanceCamera(410);const before=plain(r.camera);r.animateFocus('jupiter',410);assert.deepEqual(plain(r.camera),before);assert.deepEqual(plain(r.cameraTween.from),before);
});
test('wheel targets accumulate without losing deltas during interpolation',()=>{
 const r=fixture();for(let i=0;i<3;i++)r.smoothZoom(r.cameraInputState(i*10).zoom*1.2,'earth',i*10);
 near(r.cameraTween.to.zoom,1.2**3);assert.ok(r.camera.zoom<r.cameraTween.to.zoom);r.advanceCamera(170);near(r.camera.zoom,1.2**3);
});
test('pan and drag targets clamp but do not snap',()=>{
 const r=fixture();r.smoothCamera({panX:2,panY:-2,elevation:3},0);near(r.camera.panX,0);near(r.cameraTween.to.panX,.2);near(r.cameraTween.to.panY,-.2);near(r.cameraTween.to.elevation,Math.PI/2);r.advanceCamera(130);near(r.camera.panX,.2);
});
test('yaw chooses shortest arc across the wrap',()=>{
 const r=fixture();r.camera.azimuth=TAU-.05;r.smoothCamera({azimuth:.05},0,100);r.advanceCamera(50);assert.ok(r.camera.azimuth<.05||r.camera.azimuth>TAU-.05);r.advanceCamera(100);near(r.camera.azimuth,.05);
});
test('feature view uses the same tween rather than immediate focus + orbit setters',()=>{
 const r=fixture(),before=plain(r.camera);assert.ok(r.animateFeature('earth',37,126,10000,0));assert.deepEqual(plain(r.camera),before);assert.equal(r.cameraTween.to.focus,'earth');assert.ok(Number.isFinite(r.cameraTween.to.azimuth));
});
test('animation result is independent of frame cadence',()=>{
 const a=fixture(),b=fixture();a.animateFocus('moon',0);b.animateFocus('moon',0);for(let t=0;t<1100;t+=8)a.advanceCamera(t);a.advanceCamera(1100);b.advanceCamera(1100);assert.deepEqual(plain(a.camera),plain(b.camera));
});
test('nonfinite input and nonexistent focus leave current camera untouched',()=>{
 const r=fixture(),before=plain(r.camera);assert.equal(r.smoothCamera({panX:NaN}),false);assert.equal(r.smoothZoom(Infinity),false);assert.equal(r.animateFocus('missing'),false);assert.deepEqual(plain(r.camera),before);
});
test('numeric preset data schema and old localStorage keys remain compatible',()=>{
 const r=fixture();assert.ok(Renderer.validCamera(r.camera));const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');assert.match(app,/eg\.solar-time\.v0\.01/);assert.match(app,/solar-time\.camera-presets\.v1/);assert.match(app,/version:'0\.15'/);
});
test('drop-in sky payload equals distributed WebP and leaves planet data untouched',()=>{
 const planets={earth:'preserved'},stars=[[1,2,3]],g={window:{SolarAssets:{materials:planets,stars,sky:'old'}}};vm.createContext(g);vm.runInContext(fs.readFileSync(path.join(root,'src/sky-asset.js'),'utf8'),g);
 assert.equal(g.window.SolarAssets.materials,planets);assert.equal(g.window.SolarAssets.stars,stars);assert.deepEqual(Buffer.from(g.window.SolarAssets.sky.split(',')[1],'base64'),fs.readFileSync(path.join(root,'assets/universe.webp')));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(html.indexOf('src/assets.js')<html.indexOf('src/sky-asset.js'));assert.ok(html.indexOf('src/sky-asset.js')<html.indexOf('src/app.js'));
});
