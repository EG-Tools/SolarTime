'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/app.js','utf8'),start=source.indexOf("window.addEventListener('keydown',event=>{"),end=source.indexOf('},{capture:true});',start);
function run(key,extra={},locked=true){
 const calls=[],scope={disposed:false,selectedSkyFeature:null,openingControlsLocked:locked,openingActive:true,zen:false,
  UI:{topDialog:()=>null},fullscreen:()=>calls.push('fullscreen'),setZen:v=>calls.push(['zen',v]),finishOpening:()=>calls.push('finish'),
  window:{addEventListener(name,handler){scope.handler=handler;}}};
 vm.runInNewContext(source.slice(start,end+'},{capture:true});'.length),scope);
 scope.handler({key,code:'Key'+key.toUpperCase(),target:{closest:()=>null},preventDefault:()=>calls.push('prevent'),stopPropagation:()=>calls.push('stop'),stopImmediatePropagation:()=>calls.push('locked'),...extra});
 return calls;
}
test('H and F use toolbar actions during opening and warp without ending the camera sequence',()=>{
 for(const locked of [false,true]){
  assert.deepEqual(run('h',{},locked),['prevent','stop',['zen',true]]);
  assert.deepEqual(run('f',{},locked),['prevent','stop','fullscreen']);
 }
 assert.deepEqual(run('t'),['prevent','locked'],'other scene shortcuts retain the opening lock');
});
test('UI shortcuts preserve text input, browser modifiers, IME and repeat protection',()=>{
 for(const key of ['h','f']){
  for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{target:{closest:()=>({})}}])assert.deepEqual(run(key,extra),[]);
  assert.deepEqual(run(key,{repeat:true}),['prevent','stop']);
 }
});

test('Escape cancels opening handoff and starts orbit reveal now, with controls unlocked',()=>{
 const calls=[],scope={clock:{paused:false},performance:{now:()=>250},openingActive:true,openingReplayLocked:false,openingStartedAt:0,openingDeparture:true,resumeTravel:true,openingCameraTarget:{zoom:1},
  renderer:{setOpeningPresentation:v=>calls.push(['presentation',v]),prepareRingTourResources(){},animateCamera:(...a)=>calls.push(['camera',...a]),animationMono:t=>t,scheduleOpeningAnnotations:(...a)=>calls.push(['annotations',...a])},
  unlockOpeningControls:()=>calls.push('unlock'),syncTravelControlLock:()=>calls.push('controls'),cameraUi(){}};
 const finish=source.slice(source.indexOf('      function finishOpening(){'),source.indexOf('      function beginOpening('));
 const escape=source.slice(source.indexOf('      function handleEscape() {'),source.indexOf('      // A single idle owner'));
 vm.runInNewContext(finish+escape+'handleEscape();',scope);
 assert.equal(scope.openingActive,false);assert.equal(scope.resumeTravel,false);assert.equal(scope.openingDeparture,false);
 assert.ok(calls.includes('unlock'));assert.ok(calls.includes('controls'));
 assert.deepEqual(calls.find(c=>c[0]==='annotations'),['annotations',250,0]);
 assert.deepEqual(calls.find(c=>c[0]==='camera'),['camera',scope.openingCameraTarget,250]);
});

test('late initial asset completion cannot restart a cancelled opening',async()=>{
 const calls=[],scope={disposed:false,openingActive:true,openingRunMode:'saturn',performance:{now:()=>500},clock:{value:t=>t},
  renderer:{draw:()=>calls.push('draw'),sky:{startDetailUpgrade:()=>calls.push('detail')}},
  warmInitialScene:async()=>{scope.openingActive=false;},beginOpening:()=>{throw Error('cancelled opening restarted');},scheduleMaterialRefresh:()=>calls.push('materials')};
 const boot=source.slice(source.indexOf('      await warmInitialScene();'),source.indexOf('      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);'));
 await vm.runInNewContext('(async()=>{'+boot+'})()',scope);
 assert.deepEqual(calls,['draw','detail','materials']);
});
