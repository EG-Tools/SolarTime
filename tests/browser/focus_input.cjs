'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until,esc,delay,mouse})=>{
 const key=async(code,key,extra={})=>{
  await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,...extra},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',code,key},session);
 };
 const click=async(id,fraction=.5)=>{
  const p=await evaluate(`(()=>{const n=document.getElementById("${id}");n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return {x:r.x+r.width*${fraction},y:r.y+r.height/2}})()`);
  await mouse('mouseMoved',p.x,p.y);await mouse('mousePressed',p.x,p.y,'left',1);await mouse('mouseReleased',p.x,p.y,'left',0);
 };
 const focus=()=>evaluate(`(()=>{const n=document.activeElement,s=getComputedStyle(n);return {id:n.id,outline:s.outlineStyle,mode:document.documentElement.dataset.focusInput,native:n.matches(':focus-visible'),value:n.value}})()`);
 const results=[];
 for(const id of ['speed-slider','speed-mode-button','live-button']){
  await click(id,.65);const before=await focus();assert.equal(before.id,id);
  await key('KeyZ','z');const after=await focus();assert.equal(after.id,id);assert.equal(after.outline,'none');assert.equal(after.mode,'pointer');results.push({id,native:after.native,outline:after.outline});
 }
 await click('settings-button');await delay(1100);await click('clock-size',.6);
 await key('KeyZ','z');assert.equal((await focus()).outline,'none');
 const beforeArrow=Number((await focus()).value);await key('ArrowRight','ArrowRight');assert.ok(Number((await focus()).value)>beforeArrow,'native slider keyboard editing remains available');
 await click('settings-close');await delay(1100);await key('KeyZ','z');assert.equal((await focus()).outline,'none','mouse focus restoration');
 await key('Tab','Tab');let tab=await focus();assert.equal(tab.mode,'keyboard');assert.notEqual(tab.outline,'none','Tab navigation retains its visible marker');
 await click('help-button');await until('document.getElementById("help-dialog").open');await key('KeyZ','z');assert.equal((await focus()).outline,'none');
 await key('Tab','Tab');assert.notEqual((await focus()).outline,'none','dialog Tab focus remains visible');
 await esc();await until('!document.getElementById("help-dialog").open');assert.notEqual((await focus()).outline,'none','keyboard dismissal restores visible focus');
 await click('opening-toggle');await delay(1100);await key('KeyZ','z');assert.equal((await focus()).outline,'none','menu programmatic focus follows mouse input');
 await click('opening-toggle');await delay(1100);await click('pause-button');await key('KeyZ','z');assert.equal((await focus()).outline,'none');
 return {controls:results,settingsSlider:true,menuAndDialog:true,tabFocusPreserved:true,nativeRangeEditing:true};
};
