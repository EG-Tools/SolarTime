'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until,mouse})=>{
 const key=async(key,code)=>{await evaluate('document.activeElement?.blur()');for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code},session);};
 const enter=async()=>{await evaluate('SolarTime.renderer.requestSkyFeature("polaris",performance.now(),100)');await until('!SolarTime.renderer.cameraTween');assert.equal(await evaluate('SolarTime.renderer.skySolarMix'),1);};
 const home=await evaluate('SolarTime.renderer.defaultCameraSnapshot()');
 const assertHome=async()=>{const actual=await evaluate('SolarTime.renderer.cameraSnapshot()');for(const k of ['azimuth','elevation','zoom','dolly','panX','panY','focus'])assert.equal(actual[k],home[k],k);};
 await enter();await key('0','Digit0');
 assert.equal(await evaluate('SolarTime.getState().opening'),false,'0 returns directly, without warp');
 await until('!SolarTime.renderer.cameraTween');await assertHome();assert.equal(await evaluate('SolarTime.renderer.skySolarMix'),0);
 // ESC uses Home, even when tracking began from a non-default camera.
 await evaluate('SolarTime.renderer.restoreCamera({...SolarTime.renderer.defaultCameraSnapshot(),dolly:3,panX:.1,panY:.2})');
 await enter();await key('Escape','Escape');
 assert.equal(await evaluate('SolarTime.getState().opening'),false);
 await until('!SolarTime.renderer.cameraTween');await assertHome();
 assert.equal(await evaluate('SolarTime.renderer.solarSceneHidden()'),false);
 // W remains a real warp even with boot opening disabled; saved preference stays intact.
 await evaluate('document.querySelector("[data-opening=none]").click()');await enter();await key('w','KeyW');
 await until('!!SolarTime.renderer.cameraTween?.replay');
 assert.equal(await evaluate('SolarTime.renderer.skySolarMix'),1);
 await until('!SolarTime.getState().opening&&!SolarTime.renderer.cameraTween',45000);
 await assertHome();assert.equal(await evaluate('!!SolarTime.renderer.ringTour'),false);
 // The ordinary Saturn card routes through the same warp owner.
 await enter();await evaluate('document.querySelector("#planet-nav [data-body=saturn]").click()');
 await until('!document.getElementById("ring-tour-button").disabled');
 const button=await evaluate('(()=>{const el=document.getElementById("ring-tour-button");el.scrollIntoView({block:"center"});const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()');
 await mouse('mousePressed',button.x,button.y,'left',1);await mouse('mouseReleased',button.x,button.y,'left',0);
 await until('!!SolarTime.renderer.cameraTween?.replay');
 assert.equal(await evaluate('!!SolarTime.renderer.ringTour'),false,'travel must wait for warp and opening');
 assert.equal(await evaluate('SolarTime.renderer.skySolarMix'),1,'travel request must not immediately reveal the solar scene');
 assert.equal(await evaluate('SolarTime.renderer.cameraTween.flyThrough'),true);
 const target=await evaluate('SolarTime.renderer.cameraTween.to');for(const k of ['azimuth','elevation','zoom','dolly','panX','panY','focus'])assert.equal(target[k],home[k],k);
 await until('!!SolarTime.renderer.ringTour',45000);
 assert.equal(await evaluate('SolarTime.renderer.skySolarMix'),0,'solar presentation must finish before camera handoff');
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("solar-time.opening-mode.v1"))'),'none');
 await until('SolarTime.renderer.ringTour?.state==="cruising"',20000);
 assert.equal(await evaluate('SolarTime.renderer.gpu.gl.getError()'),0);
 return {homeKey:true,escapeHome:true,warpKeyWithOpeningDisabled:true,saturnViaWarpAndHomeOpening:true,noPrematureSolarReveal:true,normalPresentationAtHandoff:true,savedOpeningUnchanged:true};
};
