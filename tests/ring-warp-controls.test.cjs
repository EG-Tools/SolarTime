const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
const guards=['cameraViewControlsLocked','warpControlsLocked','openingMenuLocked'].map(name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('}',start)+1)}).join('\n');
const start=source.indexOf('      function replayOpening('),end=source.indexOf('      function claimOpeningControl',start);
test('W replay permits both ring destinations and transfer states while keeping pause and replay locks',()=>{
 const reached=new Error('warp accepted');
 const c={clock:{paused:false},openingActive:false,openingReplayLocked:false,openingMode:'default',performance:{now:()=>100},renderer:{cameraTween:null},cancelGesture(){throw reached;}};
 vm.createContext(c);vm.runInContext(guards+'\n'+source.slice(start,end),c);
 for(const bodyId of ['saturn','uranus'])for(const state of ['entering','cruising','returning']){
  c.renderer.ringTour={bodyId,state,openingResume:true};
  assert.equal(vm.runInContext('!!openingMenuLocked()',c),true);
  assert.throws(()=>vm.runInContext('replayOpening()',c),e=>e===reached);
 }
 for(const change of [()=>c.clock.paused=true,()=>c.openingActive=true,()=>c.openingReplayLocked=true,()=>c.renderer.cameraTween={timing:'opening'},()=>c.renderer.cameraTween={replay:{}}]){
  c.clock.paused=false;c.openingActive=false;c.openingReplayLocked=false;c.renderer.cameraTween=null;change();
  assert.equal(vm.runInContext('replayOpening()',c),false);
 }
 assert.ok(source.includes("$('opening-play').disabled=warpControlsLocked();"));
});
