'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const fn=source.match(/function cameraViewControlsLocked\(\)\{[^}]+\}/)[0];
test('view controls unlock on ordinary pause and stay locked throughout opening and warp',()=>{
 const context={openingActive:false,openingReplayLocked:false,renderer:{animationPaused:true,cameraTween:null}};vm.createContext(context);vm.runInContext(fn,context);
 const locked=()=>vm.runInContext('cameraViewControlsLocked()',context);
 assert.equal(!!locked(),false);context.renderer.cameraTween={interactive:true,timing:'smooth'};assert.equal(!!locked(),false);
 context.openingActive=true;assert.equal(!!locked(),true);context.openingActive=false;
 context.renderer.cameraTween={timing:'opening'};assert.equal(!!locked(),true);
 context.renderer.cameraTween={replay:{}};assert.equal(!!locked(),true);
 context.renderer.cameraTween=null;context.openingReplayLocked=true;assert.equal(!!locked(),true);
});
test('shortcut guard runs before opening completion and buttons use the same guard',()=>{
 const handler=source.slice(source.indexOf("window.addEventListener('keydown',event=>{"));
 assert.ok(handler.indexOf("cameraViewControlsLocked()&&")<handler.indexOf('if(openingActive)finishOpening()'));
 for(const name of ['recallPreset(index)','openPresetDialog(index,event)'])assert.ok(source.includes('function '+name+' {\n        if(cameraViewControlsLocked())'));
 assert.ok(source.includes('function reset() {if(cameraViewControlsLocked())return;'));
});

test('paused warp exits before any state change and T cannot finish an opening first',()=>{
 const start=source.indexOf('      function replayOpening('),end=source.indexOf('      function claimOpeningControl',start);
 const body=source.slice(start,end);const clock={paused:true},context={clock,openingMode:'default',performance:{now:()=>90000}};
 vm.createContext(context);vm.runInContext(source.match(/function warpControlsLocked\(\)\{[^}]+\}/)[0]+body,context);assert.equal(vm.runInContext('replayOpening()',context),false);assert.equal(clock.paused,true);
 const handler=source.slice(source.indexOf("window.addEventListener('keydown',event=>{"));
 assert.ok(handler.indexOf("if((key==='w'||key==='t')&&clock.paused)")<handler.indexOf('if(openingActive)finishOpening()'));
});
