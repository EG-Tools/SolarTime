'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(gpu=false){
 const stars=[[.2,0,1,1,1,0]],window={SolarVisualEffects:{drawCount:()=>1,starsFor:()=>stars}},calls=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/sky.js'),'utf8'),{window,performance:{now:()=>1000}});
 const sky=Object.create(window.SolarSky.prototype);
 Object.assign(sky,{ready:true,w:1000,h:600,canvas:{width:1000,height:600},offset:0,lastEffect:null,stats:{skipped:0,frames:0,starProjections:0},rayTables:new Map(),softwarePump(){}});
 if(gpu){
  sky.gl=new Proxy({isContextLost:()=>false,uniform1f:(key,value)=>calls.push([key,value])},{get:(o,k)=>k in o?o[k]:()=>{}});
  sky.u={fov:'panorama',drift:'drift'};sky.starU={fov:'stars'};sky.starA={};sky.starProgram={};
 }
 return {sky,calls};
}
const camera={azimuth:0,elevation:0},options={twinkle:true,skyMotion:false};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('a repeated T cannot rewind the previous sky momentum clock',()=>{
 const {sky}=fixture(true);
 sky.draw(0,{...camera,replaySky:{clock:0}},options);
 sky.draw(0,{...camera,azimuth:.004,replaySky:{clock:20}},options);
 const from=sky.captureReplayBackground(),reset={azimuth:2,elevation:.7};
 sky.draw(0,{...reset,replaySky:{from,reveal:true,carry:0,clock:40}},options);
 sky.draw(0,{...reset,replaySky:{from,reveal:true,carry:4,clock:4040}},options);
 const before=JSON.stringify(sky.starAxes);
 for(const clock of [4040,4050,4100]){
  sky.draw(0,{...reset,replaySky:{reveal:false,carry:-Infinity,clock}},options);
  assert.equal(JSON.stringify(sky.starAxes),before,'starting T must not reset the retained star/galaxy orientation');
 }
});

test('galaxy and stars carry angular momentum while the opening camera prepares',()=>{
 const {sky}=fixture(true);
 sky.draw(0,{...camera,replaySky:{clock:0}},options);
 sky.draw(0,{...camera,azimuth:.001,replaySky:{clock:20}},options);
 const from=sky.captureReplayBackground();assert.ok(Math.hypot(...from.spin)>.01);
 const reset={azimuth:2,elevation:.7,replaySky:{from,reveal:true,carry:0,clock:40}};
 sky.draw(0,reset,options);
 for(const k of ['right','down','forward'])for(let i=0;i<3;i++)close(sky.starAxes[k][i],from.stars[k][i]);
 const atReset=JSON.stringify(sky.starAxes);
 sky.draw(0,{...reset,replaySky:{...reset.replaySky,carry:1,clock:1040}},options);
 assert.notEqual(JSON.stringify(sky.starAxes),atReset,'held camera must not freeze the shared sky');
 for(const t of [2,3,4])sky.draw(0,{...reset,replaySky:{...reset.replaySky,carry:t,clock:40+t*1000}},options);
 const end=JSON.stringify(sky.starAxes);sky.draw(0,{...reset,replaySky:null},options);
 assert.equal(JSON.stringify(sky.starAxes),end,'momentum release must not snap back');
});

test('named dark and bright UV locators follow panorama rotation exactly',()=>{
 const {sky}=fixture();
 for(const offset of [0,.7,3,6]){
  sky.offset=offset;sky.updateAxes(camera);
  const dark=sky.jumpLocators('dark'),bright=sky.jumpLocators('bright');assert.equal(dark.length,12);assert.equal(bright.length,5);
  for(const p of [...dark,...bright]){
   assert.ok(p.id.startsWith(p.kind==='dark'?'A':'B'));
   const [x,y,z]=p.direction,cs=Math.cos(offset),sn=Math.sin(offset),rx=x*cs-y*sn,ry=x*sn+y*cs;
   close(rx,p.point.x);close(ry*Math.sqrt(.75)-z*.5,p.point.y);close(ry*.5+z*Math.sqrt(.75),p.point.z);
  }
 }
});
test('ordinary lens/zoom leaves the sky at 60.8 degrees; transition updates both GPU ray uniforms',()=>{
 const {sky,calls}=fixture(true);
 sky.draw(0,{...camera,zoom:12,fov:30},options);close(sky.tanFov,Math.tan(30.4*Math.PI/180));
 const frames=sky.stats.frames;
 sky.draw(0,{...camera,transitionFov:116},options);
 assert.equal(sky.stats.frames,frames+1,'FOV-only change must invalidate a retained frame');
 for(const key of ['panorama','stars'])close(calls.filter(p=>p[0]===key).at(-1)[1],Math.tan(58*Math.PI/180));
 sky.draw(0,camera,options);close(sky.tanFov,Math.tan(30.4*Math.PI/180));
});
test('telephoto transition narrows panorama and star rays without UV scaling',()=>{
 const {sky,calls}=fixture(true);sky.draw(0,camera,options);const normal=sky.tanFov;
 sky.draw(0,{...camera,transitionFov:42},options);
 close(sky.tanFov,Math.tan(21*Math.PI/180));assert.ok(sky.tanFov<normal);
 for(const key of ['panorama','stars'])close(calls.filter(p=>p[0]===key).at(-1)[1],sky.tanFov);
 sky.draw(0,camera,options);close(sky.tanFov,normal);
});
test('the same star projection survives A/B resets and never inherits the sky fade',()=>{
 const {sky,calls}=fixture(true);const start={...camera,replaySky:{cover:.1}};
 sky.draw(0,start,options);const from=sky.captureReplayBackground(),buffer=sky.starBuffer;
 const reset={azimuth:2,elevation:.7,transitionFov:82,replaySky:{from,reveal:true,blend:1,cover:.1,departureFov:60}};
 sky.draw(0,reset,options);
 for(const key of ['right','down','forward'])for(let i=0;i<3;i++)close(sky.starAxes[key][i],from.stars[key][i]);
 close(sky.starTanFov,Math.tan(30.4*Math.PI/180));assert.equal(sky.lastPose.drawStars,true);assert.equal(sky.starBuffer,buffer);
 const held=JSON.stringify(sky.starAxes);sky.draw(0,{...reset,replaySky:{...reset.replaySky,blend:.5,cover:.05}},options);
 assert.equal(JSON.stringify(sky.starAxes),held);assert.equal(sky.lastPose.drawStars,true);
 sky.draw(0,{...reset,replaySky:null,transitionFov:60.8},options);assert.equal(JSON.stringify(sky.starAxes),held,'no star reset after the dissolve');
 sky.draw(0,{...reset,azimuth:2.1,replaySky:null,transitionFov:60.8},options);assert.notEqual(JSON.stringify(sky.starAxes),held,'the retained stars still follow subsequent camera motion');
 const second=sky.captureReplayBackground();sky.draw(0,{...reset,azimuth:-1,replaySky:{...reset.replaySky,from:second}},options);
 for(const key of ['right','down','forward'])for(let i=0;i<3;i++)close(sky.starAxes[key][i],second.stars[key][i]);
 assert.equal(calls.filter(p=>p[0]==='stars').length,sky.stats.frames,'exactly one star pass per sky draw');
});
test('explicit star suppression invalidates retained frames without changing user preferences',()=>{
 const {sky,calls}=fixture(true);sky.draw(0,camera,options);const count=()=>calls.filter(p=>p[0]==='stars').length,stars=count(),frames=sky.stats.frames;
 sky.draw(0,{...camera,hideStars:true},options);assert.equal(count(),stars);assert.equal(sky.stats.frames,frames+1);
 sky.draw(0,camera,options);assert.equal(count(),stars+1);assert.equal(sky.stats.frames,frames+2);assert.equal(options.twinkle,true);
 const software=fixture().sky;software.nextComet=Infinity;const ctx={getTransform:()=>({a:1})};
 software.draw(0,{...camera,hideStars:true},options);software.decorate(ctx,0,options,()=>{});assert.equal(software.stats.starProjections,0);
 software.draw(0,camera,options);software.decorate(ctx,0,options,()=>{});assert.ok(software.stats.starProjections>0);
});
test('software requests snapshot the transition lens, including bounded ray cache and star projection',()=>{
 const {sky}=fixture();sky.draw(0,camera,options);const first=sky.softwareDesired;
 const original=sky.rayTable(8,8,1,.24,first.fov);
 sky.draw(0,{...camera,transitionFov:116},options);const next=sky.softwareDesired;
 assert.notEqual(first.key,next.key);assert.notEqual(first.fov,next.fov);
 assert.equal(sky.rayTable(8,8,1,.24,first.fov),original,'in-flight software frame uses its captured lens');
 const wide=sky.rayTable(8,8,1,.24,next.fov);assert.notEqual(original,wide);assert.ok(sky.rayTables.size<=2);
 const ctx={getTransform:()=>({a:1})},glow=()=>{};sky.nextComet=Infinity;
 sky.decorate(ctx,0,options,glow);const projected=sky.stats.starProjections;
 sky.draw(0,camera,options);sky.decorate(ctx,0,options,glow);
 assert.ok(sky.stats.starProjections>projected,'CPU stars follow the same changing ray projection');
});
