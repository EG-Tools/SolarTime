/* v0.16 direct-camera and playback regressions. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),TAU=Math.PI*2,DEG=Math.PI/180;
const A={TAU,DEG,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),wrap:(v,m=TAU)=>(v%m+m)%m,
 BODIES:[{id:'earth',size:17.25},{id:'jupiter',size:29},{id:'pluto',size:5}],SUN:{id:'sun',size:28},MOON:{id:'moon',size:3.9},
 surfaceDirection:()=>({x:.3,y:-.4,z:Math.sqrt(.75)})};
const scope={window:{SolarAstro:A},performance:{now:()=>0},console};vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root,'src/renderer.js'),'utf8'),scope);
const Renderer=scope.window.SolarRenderer;
const near=(x,y,eps=1e-8)=>assert.ok(Math.abs(x-y)<eps,`${x} != ${y}`);
function fixture(){return Object.assign(Object.create(Renderer.prototype),{w:1400,h:800,options:{moon:true,pluto:true},camera:{azimuth:.4,elevation:.7,zoom:1,focus:null,panX:0,panY:0},cameraTween:null,autoRotation:null,pendingAutoRotation:null,rotationGeneration:0,labelStates:new Map(),surface:{invalidate(){}}});}
test('focus destination always clears pan',()=>{const r=fixture();r.camera.panX=.2;r.camera.panY=-.15;assert.ok(r.animateFocus('earth',0));near(r.cameraTween.to.panX,0);near(r.cameraTween.to.panY,0);});
test('wheel-style smooth zoom never creates a hidden focus',()=>{const r=fixture();assert.ok(r.smoothZoom(2,'earth',0));assert.equal(r.cameraTween.to.focus,null);});
test('planet-to-planet focus no longer uses an overview bridge',()=>{const r=fixture();r.camera={...r.camera,focus:'earth',zoom:64};assert.ok(r.animateFocus('jupiter',0));assert.equal('bridge' in r.cameraTween,false);r.advanceCamera(550);assert.equal(r.camera.focus,'jupiter');assert.ok(r.camera.zoom>1);});
test('earth feature view reaches close inspection zoom',()=>{const r=fixture();assert.ok(r.animateFeature('earth',37.5665,126.978,1000,0));assert.ok(r.cameraTween.to.zoom>=1800);near(r.cameraTween.to.panX,0);near(r.cameraTween.to.panY,0);});
test('auto rotate preserves current pan and starts immediately',()=>{const r=fixture();r.camera.panX=.12;r.camera.panY=.05;assert.ok(r.setAutoRotate(1,0));assert.equal(r.autoRotation.direction,1);assert.equal(r.cameraTween,null);near(r.camera.panX,.12);near(r.camera.panY,.05);});
test('app exposes current version',()=>{const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');assert.match(app,/version:'0\.20'/);});

test('camera uses angle-invariant fit and direct linear zoom with eased endpoints',()=>{const src=fs.readFileSync(path.join(root,'src/renderer.js'),'utf8');assert.match(src,/this\.fitScale\*this\.camera\.zoom/);assert.match(src,/zoom:mix\(from\.zoom,to\.zoom,p\)/);assert.doesNotMatch(src,/Math\.exp\(mix\(Math\.log\(from\.zoom\)/);});
test('playback slider exposes requested ranges',()=>{const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(app,/hour:\{min:1,max:1440,step:1/);assert.match(app,/day:\{min:1,max:365,step:1/);assert.match(app,/year:\{min:1,max:20,step:1/);assert.match(html,/id="speed-slider"/);});
