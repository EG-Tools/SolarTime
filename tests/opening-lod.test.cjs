'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/astro.js'),window={SolarAstro:A,SolarSurfaceStyle:require('../src/surface-style.js')};
for(const name of ['surface','renderer'])vm.runInNewContext(fs.readFileSync('src/'+name+'.js','utf8'),{window,performance});

test('every planet and satellite requests its arrival detail while its opening disc is still tiny',()=>{
 const r=Object.assign(Object.create(window.SolarRenderer.prototype),{options:{earthCloudAmount:1,venusCloudAmount:.8},camera:{focus:null},dpr:1,
  bodyRadiusForState:()=>100,bodyFrame:()=>({u:{x:1,y:0,z:0},v:{x:0,y:1,z:0},pole:{x:0,y:0,z:1}}),viewDirection:v=>v,invalidatePresentation(){}});
 const bodies=[...A.BODIES,...A.SATELLITES];
 assert.ok(bodies.some(b=>b.id==='mercury'));assert.ok(bodies.some(b=>b.id==='moon'));assert.ok(bodies.some(b=>b.id==='europa'));
 for(const body of bodies){
  r.setOpeningPresentation(true,'opening',{zoom:1});
  const opening=r.surfaceJob(body,{x:1,y:1,z:1},.01,Date.UTC(2026,9,12),0,true);
  assert.equal(opening.openingPreview,true,body.id);assert.ok(opening.textureWidth>=1024,body.id);
  r.setOpeningPresentation(false);
  const tiny=r.surfaceJob(body,{x:1,y:1,z:1},.01,Date.UTC(2026,9,12),0,true);
  assert.equal(tiny.openingPreview,false);assert.ok(tiny.textureWidth<=256,body.id);
 }
});

test('initial readiness waits for every planet and visible auxiliary map',()=>{
 const r=Object.assign(Object.create(window.SolarSurface.DirectRenderer.prototype),{openingPreview:true,textures:new Map(),desired:new Map([
  ['mercury',{id:'mercury'}],['earth',{id:'earth',cloudAmount:1,nightLights:true}],['saturn',{id:'saturn'}]
 ])});
 for(const name of ['mercury','earth','saturn','clouds','earth-night']){r.textures.set(name,{texture:{}});assert.equal(r.visibleTexturesReady(),false);}
 r.textures.set('saturn-ring',{texture:{}});assert.equal(r.visibleTexturesReady(),true);
});

test('compact solar-system material demand follows its final displayed size',()=>{
 const earth=A.BODIES.find(body=>body.id==='earth');
 const r=Object.assign(Object.create(window.SolarRenderer.prototype),{options:{earthCloudAmount:1,earthCloudSeed:.2,earthNightLights:true,venusCloudAmount:.8},camera:{focus:'earth'},selected:'earth',dpr:2,sceneDpr:2,actualScaleMix:0,
  bodyRadiusForState:()=>200,bodyFrame:()=>({u:{x:1,y:0,z:0},v:{x:0,y:1,z:0},pole:{x:0,y:0,z:1}}),viewDirection:v=>v,cloudRevealProgress:()=>1,satelliteOrbitScale:()=>1});
 r.surfacePresentationScale=1;
 const full=r.surfaceJob(earth,{x:1,y:1,z:1},200,Date.UTC(2026,9,12),0,true);
 r.surfacePresentationScale=.05;
 const compact=r.surfaceJob(earth,{x:1,y:1,z:1},200,Date.UTC(2026,9,12),0,true);
 assert.equal(full.textureWidth,4096);assert.ok(compact.textureWidth<=256,compact.textureWidth);
 assert.ok(compact.cloudTextureWidth<=256,compact.cloudTextureWidth);assert.ok(compact.nightTextureWidth<=256,compact.nightTextureWidth);
});

test('one accepted texture cannot bypass a negative direct-renderer readiness result',async()=>{
 const source=fs.readFileSync('src/app.js','utf8'),code=source.slice(source.indexOf('      async function warmInitialScene('),source.indexOf('      let materialRefreshTimer'));
 let checks=0,now=0;
 const scope={openingActive:true,disposed:false,renderer:{sky:{ready:true},surface:{stats:{accepted:1},visibleTexturesReady:()=>++checks>=3}},performance:{now:()=>now},setTimeout:fn=>{now+=16;fn();}};
 assert.equal(await vm.runInNewContext(code+'warmInitialScene()',scope),true);assert.equal(checks,3);
});
