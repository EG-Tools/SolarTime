'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until,esc,delay,mouse})=>{
 const key=async(code='Space',key=' ',extra={})=>{
  await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,...extra},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',code,key},session);
 };
 const click=async id=>{
  const point=await evaluate(`(()=>{const n=document.getElementById("${id}"),r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:n.contains(document.elementFromPoint(x,y))};})()`);
  assert.equal(point.hit,true,id+' must receive pointer input');
  await mouse('mouseMoved',point.x,point.y);await mouse('mousePressed',point.x,point.y,'left',1);await mouse('mouseReleased',point.x,point.y,'left',0);
 };
 const lockedIds=['eclipse-previous','eclipse-next','alignment-previous','alignment-next','show-alignment','actual-scale','camera-mode-toggle','reset-defaults','reset-defaults-yes','focus-body','overview-orbit-gap'];
 const checkLocks=async locked=>{
  await until(`document.getElementById("actual-scale").disabled===${locked}`);
  const controls=await evaluate(`(${JSON.stringify(lockedIds)}).map(id=>[id,document.getElementById(id).disabled])`);
  for(const [id,disabled] of controls)assert.equal(disabled,locked,id);
  assert.deepEqual(await evaluate('(()=>{const n=document.getElementById("timezone-button");return [n.getAttribute("aria-disabled"),n.tabIndex]})()'),[String(locked),locked?-1:0]);
  if(!locked)return;
  // Dispatch directly as well: blocked commands must not depend only on button styling.
  assert.equal(await evaluate(`(()=>{
   const r=SolarTime.renderer, before=JSON.stringify(r.options), tween=r.cameraTween,tour=r.ringTour,rate=SolarTime.clock.rate;
   for(const id of ['eclipse-next','alignment-next','reset-defaults','reset-defaults-yes','focus-body','timezone-button'])document.getElementById(id).dispatchEvent(new MouseEvent('click',{bubbles:true}));
   for(const id of ['actual-scale','show-alignment']){const n=document.getElementById(id);n.checked=!n.checked;n.dispatchEvent(new Event('change'));}
   const gap=document.getElementById('overview-orbit-gap');gap.value='99';gap.dispatchEvent(new Event('input'));
   return JSON.stringify(r.options)===before&&r.cameraTween===tween&&r.ringTour===tour&&SolarTime.clock.rate===rate&&!document.getElementById('reset-defaults-dialog').open;
  })()`),true,'disabled commands preserve travel and scene settings');
  const mode=await evaluate('SolarTime.renderer.options.actualScale');
  await evaluate('document.activeElement?.blur()');await key('Equal','+');
  assert.equal(await evaluate('SolarTime.renderer.options.actualScale'),mode,'plus shortcut stays locked');
 };
 const checkTravelUi=async()=>{
  await evaluate('window.__uiTravelTween=SolarTime.renderer.cameraTween');
  await click('settings-button');await until('document.getElementById("settings-button").getAttribute("aria-expanded")==="true"');
  await delay(1100);await click('settings-close');await delay(1100);
  await click('language-toggle');await until('document.getElementById("language-toggle").getAttribute("aria-expanded")==="true"');await click('language-toggle');await delay(1100);
  await click('help-button');await until('document.getElementById("help-dialog").open');await esc();await until('!document.getElementById("help-dialog").open');
  assert.equal(await evaluate('SolarTime.renderer.cameraTween===window.__uiTravelTween&&SolarTime.getState().openingLocked'),true);
  await evaluate('document.activeElement?.blur()');
 };
 const choose=mode=>evaluate(`document.getElementById('opening-toggle').click();document.querySelector('[data-opening="${mode}"]').click();document.activeElement?.blur()`);
 const state=()=>evaluate(`(()=>{const r=SolarTime.renderer,s=SolarTime.getState();return {camera:r.cameraSnapshot(),age:r.ringTour?.age,visualAge:r.ringTour?.visualAge,pose:r.ringTour?.pose,elapsed:r.cameraTween?r.animationMono()-r.cameraTween.start:null,simulation:s.simulationMs,effect:s.effectTime,wall:s.wallMs,clock:document.getElementById("wall-clock").dateTime,paused:s.paused}})()`);
 const drag=async()=>{await mouse('mousePressed',600,400,'left',1);await mouse('mouseMoved',780,460,'left',1);await mouse('mouseReleased',780,460,'left',0);};
 await evaluate('document.getElementById("show-seconds").checked=true;document.getElementById("show-seconds").dispatchEvent(new Event("change"));SolarTime.renderer.setAutoRotate(1);document.activeElement?.blur()');await delay(300);
 await key();await until('SolarTime.renderer.animationPaused');await delay(100);
 const a=await state();await key('Space',' ',{autoRepeat:true});await delay(1100);const b=await state();
 assert.equal(b.paused,true);assert.deepEqual(b.camera,a.camera);assert.equal(b.simulation,a.simulation);assert.equal(b.effect,a.effect);assert.ok(b.wall-a.wall>=1000);assert.notEqual(b.clock,a.clock);
 await key();await until('!SolarTime.renderer.animationPaused');await delay(400);assert.notDeepEqual((await state()).camera,a.camera);
 await evaluate("SolarTime.renderer.stopAutoRotate();SolarTime.renderer.animateFocus('saturn')");
 await until('SolarTime.renderer.canStartRingTour()');await evaluate('SolarTime.renderer.startRingTour()');await until('SolarTime.renderer.ringTour?.state==="cruising"');
 await key();await until('SolarTime.renderer.animationPaused');await delay(100);const ring=await state();await checkLocks(true);await drag();await delay(400);const looked=await state();
 assert.equal(looked.age,ring.age);assert.equal(looked.visualAge,ring.visualAge);assert.deepEqual(looked.pose.eye,ring.pose.eye);assert.notDeepEqual(looked.pose.forward,ring.pose.forward);
 await key();await delay(400);assert.ok((await state()).age>ring.age);await esc();await until('!SolarTime.renderer.ringTour&&!SolarTime.renderer.cameraTween');
 await checkLocks(false);await choose('default');await key('KeyT','t');await until('SolarTime.getState().openingLocked&&!!SolarTime.renderer.cameraTween');await delay(2000);
 await key();await until('SolarTime.renderer.animationPaused');await delay(100);const warp=await state();await drag();await delay(1000);const locked=await state();
 assert.equal(locked.elapsed,warp.elapsed);assert.deepEqual(locked.camera,warp.camera);assert.equal(await evaluate('SolarTime.getState().openingLocked'),true);
 await checkLocks(true);await checkTravelUi();await key();await delay(300);assert.ok((await state()).elapsed>warp.elapsed);await until('!SolarTime.getState().opening');
 await evaluate('window.__oldPauseDocument=true');await send('Page.reload',{},session);await until('!window.__oldPauseDocument&&!!window.SolarTime?.renderer&&!!SolarTime.renderer.cameraTween');
 await key();await until('SolarTime.renderer.animationPaused');await delay(100);const boot=await state();await delay(1200);assert.equal((await state()).elapsed,boot.elapsed);
 await checkLocks(true);await checkTravelUi();await key();await until('!SolarTime.getState().opening');await checkLocks(false);
 await evaluate('SolarTime.setLanguage("kor")');
 const help=await evaluate(`[...document.querySelectorAll('[data-i18n="music"],[data-i18n="ringTravel"]')].filter(n=>n.previousElementSibling?.tagName==='KBD').map(n=>[n.previousElementSibling.textContent,n.textContent])`);
 assert.deepEqual(help,[['M','배경 음악'],['T','여행']]);
 return {pauseAutoRotation:true,wallClockContinues:true,ringFreeLook:true,warpInputLocked:true,bootResume:true,travelUiClickable:true,travelSettingsLockedAndRestored:true,help};
};
