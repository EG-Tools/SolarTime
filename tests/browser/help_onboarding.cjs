'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until,esc,delay,mouse})=>{
 const ready='!!window.SolarTime?.renderer';
 const revealed=`(()=>{const r=window.SolarTime?.renderer;return r&&!SolarTime.getState().opening&&!r.cameraTween&&r.openingLabelOpacity()===1&&Array.from(r.openingOrbitDelays.keys()).every(id=>r.openingOrbitOpacity(undefined,id)===1&&r.openingLabelOpacity(undefined,id)===1);})()`;
 const help='document.getElementById("help-dialog")';
 await until(ready);
 assert.equal(await evaluate(help+'.open'),false,'help must not cover the opening');
 await evaluate(`(()=>{const d=${help};window.__helpOpens=[];new MutationObserver(()=>{if(d.open){const r=SolarTime.renderer;window.__helpOpens.push({opening:SolarTime.getState().opening,labels:Array.from(r.openingOrbitDelays.keys()).map(id=>r.openingLabelOpacity(undefined,id)),orbits:Array.from(r.openingOrbitDelays.keys()).map(id=>r.openingOrbitOpacity(undefined,id))});}}).observe(d,{attributes:true,attributeFilter:['open']});})()`);
 await until(help+'.open');
 const automatic=await evaluate('window.__helpOpens');
 assert.equal(automatic.length,1);assert.equal(automatic[0].opening,false);
 assert.ok(automatic[0].labels.every(v=>v===1)&&automatic[0].orbits.every(v=>v===1));
 assert.equal(await evaluate('localStorage.getItem("solar-time.help-seen.v1")'),'true');
 await esc();await until('!'+help+'.open');
 await evaluate('document.getElementById("cookie-reject").click()');
 assert.equal(await evaluate('document.querySelector(".top-actions #help-button")'),null);
 assert.equal(await evaluate('document.querySelectorAll(".brand #help-button").length'),1);
 const point=await evaluate('(()=>{const r=document.getElementById("help-button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await mouse('mousePressed',point.x,point.y,'left',1);await mouse('mouseReleased',point.x,point.y,'left',0);
 await until(help+'.open');await esc();await until('!'+help+'.open');
 for(const [button,panel] of [['settings-button','settings-panel'],['timer-button','timer-panel']]){
  await evaluate(`document.getElementById('${button}').click()`);await until(`!document.getElementById('${panel}').hidden`);
  await esc();await until(`document.getElementById('${panel}').hidden`);assert.equal(await evaluate(help+'.open'),false);
 }
 await evaluate('document.querySelector("#planet-nav [data-body=earth]").click()');await esc();await until('document.getElementById("body-panel").hidden');assert.equal(await evaluate(help+'.open'),false);
 await esc();await until(help+'.open');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,autoRepeat:true},session);
 assert.equal(await evaluate(help+'.open'),true,'held Escape cannot toggle repeatedly');
 await esc();await until('!'+help+'.open');
 const origin=await evaluate('performance.timeOrigin');await send('Page.reload',{},session);
 await until(`performance.timeOrigin!==${origin}&&${ready}`);await until(revealed);await delay(500);
 assert.equal(await evaluate(help+'.open'),false,'refresh never repeats automatic help');
 // Keyboard activation works on the logo, without adding another toolbar icon.
 await evaluate('document.getElementById("help-button").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},session);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},session);
 await until(help+'.open');await esc();await until('!'+help+'.open');
 // Manually reading it before names finish also satisfies the one-time guide.
 await evaluate('localStorage.removeItem("solar-time.help-seen.v1")');const second=await evaluate('performance.timeOrigin');
 await send('Page.reload',{},session);await until(`performance.timeOrigin!==${second}&&${ready}&&!SolarTime.getState().openingLocked`);
 await evaluate('document.getElementById("help-button").click()');await until(help+'.open');await esc();await until('!'+help+'.open');
 await until(revealed);await delay(500);assert.equal(await evaluate(help+'.open'),false);
 // Seed the old activity record AFTER unload persistence, before app boot.
 const seed=await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("solar-time.help-visit.v1",JSON.stringify({lastActive:Date.now()-14*86400000-1000,pending:false}));'},session);
 const previous=await evaluate('performance.timeOrigin');await send('Page.reload',{},session);
 await until(`performance.timeOrigin!==${previous}&&${ready}`);
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier},session);
 assert.equal(await evaluate(help+'.open'),false,'return reminder must wait for opening');
 await until(help+'.open');assert.equal(await evaluate(revealed),true);
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("solar-time.help-visit.v1")).pending'),false);
 await esc();await until('!'+help+'.open');
 const returned=await evaluate('performance.timeOrigin');await send('Page.reload',{},session);
 await until(`performance.timeOrigin!==${returned}&&${ready}`);await until(revealed);await delay(500);
 assert.equal(await evaluate(help+'.open'),false,'return reminder is only shown once');
 return {automaticAfterAllReveals:true,onceAcrossReload:true,returnAfterFourteenDays:true,returnReminderOnce:true,brandClick:true,keyboard:true,escapePriority:true,manualReadSuppressesAuto:true,error:await evaluate('SolarTime.renderer.gpu.gl.getError()')};
};
