'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={SolarAstro:require('../src/astro.js')};
for(const name of ['surface-style','surface','renderer'])vm.runInNewContext(fs.readFileSync('src/'+name+'.js','utf8'),{window,performance});
test('warp warms one baseline body per hidden frame, retries unavailable maps, and stops on reveal',()=>{
 const calls=[],prepared=[],r=Object.assign(Object.create(window.SolarRenderer.prototype),{
  cameraTween:{replay:{}},options:{activity:true},surfaceJob(body,p,size,ms,seconds,direct,target){return Object.assign(target||{},{id:body.id,textureWidth:4096,cloudTextureWidth:2048,nightTextureWidth:4096});},
  gpu:{prepare(jobs){prepared.push(jobs.map(j=>({...j})));},warmPlanet(job,body){calls.push(body.id);return calls.length>1;}}
 });
 const bodies=['sun','earth','jupiter'].map(id=>({body:{id},physical:{}})),hidden={solar:0,reveal:true};
 r.prepareReplaySurfaces(bodies,0,0,0,{solar:0,reveal:false});assert.equal(calls.length,0);
 for(let i=0;i<4;i++){const count=calls.length;r.prepareReplaySurfaces(bodies,0,0,i,hidden);assert.equal(calls.length,count+1);}
 assert.deepEqual(calls,['sun','earth','jupiter','sun']);
 r.prepareReplaySurfaces(bodies,0,0,5,hidden);assert.equal(calls.length,4);
 assert.ok(prepared.flat().every(j=>j.textureWidth===256&&j.nightTextureWidth===256&&j.cloudTextureWidth===256));
 const count=prepared.length;r.prepareReplaySurfaces(bodies,0,0,6,{solar:.001,reveal:true});assert.equal(prepared.length,count);
 r.cameraTween=null;r.prepareReplaySurfaces(bodies,0,0,7,hidden);assert.equal(prepared.length,count);
});
test('hidden material draw restores scissor and color mask even when rendering throws',()=>{
 for(const enabled of [true,false])for(const fail of [true,false]){
  const state={enabled,box:[3,4,5,6],mask:[true,false,true,false]},original=JSON.stringify(state);let resets=0;
  const gl={SCISSOR_TEST:1,SCISSOR_BOX:2,COLOR_WRITEMASK:3,isEnabled:()=>state.enabled,getParameter:k=>k===2?state.box:state.mask,
   enable(){state.enabled=true;},disable(){state.enabled=false;},scissor(...v){state.box=v;},colorMask(...v){state.mask=v;}};
  const gpu=Object.assign(Object.create(window.SolarSurface.DirectRenderer.prototype),{gl,height:600,dpr:2,resetBindings(){resets++;},planet(){assert.deepEqual(state.mask,[false,false,false,false]);assert.deepEqual(state.box,[0,0,1,1]);if(fail)throw Error('draw failed');return true;}});
  if(fail)assert.throws(()=>gpu.warmPlanet({}, {},0,true),/draw failed/);else assert.equal(gpu.warmPlanet({}, {},0,true),true);
  assert.equal(JSON.stringify(state),original);assert.equal(resets,1);
 }
});
