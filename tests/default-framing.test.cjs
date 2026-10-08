'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),window={SolarAstro:A};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),{window,performance:{now:()=>0}});
const ms=Date.parse('2026-10-08T00:00:00Z');
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function fixture(w=1280,h=800){
 const r=Object.create(window.SolarRenderer.prototype);
 Object.assign(r,{w,h,options:{pluto:true,overviewOrbitGap:100,actualOrbitSpacing:0},actualScaleMix:0,bodyScales:{},satelliteOrbitScales:{},precisionOrbitPathCache:new Map(),clearLabels(){}});
 r.camera=r.defaultCameraSnapshot(ms);return r;
}
function measure(r){
 r.rebuild(ms);r.projectionAnchor=null;
 const orbit=r.paths.find(p=>p.body.id==='neptune'),points=orbit.points.map(p=>r.project(r.displaySolarPoint(p,orbit.body)));
 assert.ok(points.every(p=>!p.behind&&Number.isFinite(p.x)),'the entire orbit must be in front of the camera');
 return {width:(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))/r.w,sun:r.project({x:0,y:0,z:0}).y/r.h};
}
test('home frames the rendered Neptune orbit at 75% and the Sun at 57% across viewports and orbit spacing',()=>{
 for(const [w,h] of [[1280,800],[390,844],[900,500],[2560,1080]])for(const gap of [50,100,400])for(const spacing of [null,0,.05,.1,.5,1]){
  const r=fixture(w,h);r.options.overviewOrbitGap=gap;r.options.actualOrbitSpacing=spacing??0;r.actualScaleMix=spacing===null?0:1;
  r.camera=r.defaultCameraSnapshot(ms);const actual=measure(r);close(actual.width,.75);close(actual.sun,.57);
 }
});
test('home uses body hierarchy and camera bank, without changing the live projection or caches',()=>{
 const r=fixture();r.bodyScales={sun:2,mercury:2};r.satelliteOrbitScales={sun:.5};r.flightBank=.17;r.rebuild(ms);
 Object.assign(r,{camera:{...r.camera,zoom:8,dolly:3,focus:'earth'},flightLook:{yaw:2},projectionAnchor:{x:1,y:2,z:3},trackingAnchor:{x:4,y:5,z:6},cameraTween:{replay:{arrivalProgress:.2}},frameCache:new Map([['keep',{}]]),solarMorph:[1,2,3,4]});
 const before={...r},keys=Object.keys(r),cache=[...r.precisionOrbitPathCache];
 const home=r.defaultCameraSnapshot(ms);
 assert.deepEqual(Object.keys(r),keys);for(const key of keys)assert.equal(r[key],before[key],key);
 assert.deepEqual([...r.precisionOrbitPathCache],cache);assert.deepEqual(r.solarMorph,[1,2,3,4]);assert.equal(r.frameCache.size,1);
 r.camera=home;r.flightLook=null;r.cameraTween=null;r.trackingAnchor=null;
 const actual=measure(r);close(actual.width,.75);close(actual.sun,.57);
});
test('home recalculates after resize and spacing changes instead of reusing stale geometry',()=>{
 const r=fixture();r.rebuild(ms);const first=r.defaultCameraSnapshot(ms);
 r.w=420;r.h=700;r.options.overviewOrbitGap=250;
 r.camera=r.defaultCameraSnapshot(ms);assert.notEqual(r.camera.dolly,first.dolly);
 const actual=measure(r);close(actual.width,.75);close(actual.sun,.57);
});
test('fresh home works before any draw and agrees with the same scene after drawing',()=>{
 const r=fixture();r.lastPathMs=NaN;
 assert.ok(window.SolarRenderer.validCamera(r.defaultCameraSnapshot()));
 const first=r.defaultCameraSnapshot(ms);assert.equal(r.paths,undefined);
 r.camera=first;r.rebuild(ms);const next=r.defaultCameraSnapshot(ms);
 close(first.dolly,next.dolly);close(first.panY,next.panY);
 r.camera={...next,azimuth:2,panY:.3};r.resetCamera();close(r.camera.dolly,next.dolly);close(r.camera.panY,next.panY);
});
