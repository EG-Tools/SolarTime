'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,until,esc,delay,send,session})=>{
 const key=async()=>{await evaluate('document.activeElement?.blur()');await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyT',key:'t'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyT',key:'t'},session);};
 const mode=value=>evaluate(`document.getElementById('opening-toggle').click();document.querySelector('[data-opening="${value}"]').click();document.activeElement?.blur()`);
 await evaluate(`(()=>{
  const r=SolarTime.renderer;r.stopAutoRotate();
  const scale=document.getElementById('actual-scale');scale.checked=true;scale.dispatchEvent(new Event('change'));
  const gap=document.getElementById('overview-orbit-gap');gap.value='100';gap.dispatchEvent(new Event('input'));gap.dispatchEvent(new Event('change'));
  r.restoreCamera({...r.cameraSnapshot(),zoom:r.zoomLimits.minZoom,dolly:r.zoomLimits.minDolly,azimuth:1.3,elevation:-.35,panX:.2,panY:-.1,focus:null,mode:'move'});
 })()`);
 await delay(1600);
 const expected=await evaluate('SolarTime.renderer.cameraSnapshot()');
 assert.equal(expected.zoom,.8);assert.equal(expected.dolly,.001);
 const sameCamera=value=>{for(const [key,wanted]of Object.entries(expected)){if(typeof wanted==='number')assert.ok(Math.abs(value[key]-wanted)<1e-12,key+': '+value[key]+' != '+wanted);else assert.equal(value[key],wanted,key);}};
 const check=async()=>{await until('!SolarTime.getState().opening&&!SolarTime.renderer.ringTour&&!SolarTime.renderer.cameraTween');sameCamera(await evaluate('SolarTime.renderer.cameraSnapshot()'));assert.deepEqual(await evaluate('[SolarTime.renderer.options.actualScale,SolarTime.renderer.options.actualOrbitSpacing]'),[true,1]);};
 // Direct Saturn trip, then Esc, including the farthest and widest manual settings.
 await until('SolarTime.renderer.canStartRingTour()');assert.equal(await evaluate('SolarTime.renderer.startRingTour()'),true);
 await until('SolarTime.renderer.ringTour?.state==="cruising"');await esc();await check();
 // Ordinary opening replays arrive at the same custom camera.
 await mode('default');await key();await until('!!SolarTime.renderer.cameraTween?.replay');
 sameCamera(await evaluate('SolarTime.renderer.cameraTween.to'));await check();
 // Saturn opening must remember the destination before its early boarding handoff.
 await mode('saturn');await key();await until('!!SolarTime.renderer.cameraTween?.replay');
 sameCamera(await evaluate('SolarTime.renderer.cameraTween.to'));
 await until('!!SolarTime.renderer.ringTour&&!SolarTime.getState().opening',55000);
 sameCamera(await evaluate('SolarTime.renderer.ringTour.returnTarget'));
 await esc();await check();
 // Refresh preserves the last view as the Saturn opening's eventual return.
 await evaluate('window.__returnOldDocument=true');await send('Page.reload',{},session);
 await until('!window.__returnOldDocument&&!!window.SolarTime?.renderer.cameraTween',55000);
 sameCamera(await evaluate('SolarTime.renderer.cameraTween.to'));
 await until('!!SolarTime.renderer.ringTour&&!SolarTime.getState().opening',55000);
 sameCamera(await evaluate('SolarTime.renderer.ringTour.returnTarget'));
 await until('SolarTime.renderer.ringTour?.state==="cruising"',55000);
 const home=await evaluate('SolarTime.renderer.defaultCameraSnapshot()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',code:'Digit0',windowsVirtualKeyCode:48,text:'0'},session);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'0',code:'Digit0',windowsVirtualKeyCode:48},session);
 await until('SolarTime.renderer.ringTour?.returnTargetApplied===true');
 assert.equal(await evaluate('SolarTime.renderer.ringTour.returnNormalFrom'),null,'a landed tour must not reuse the stale pre-entry overview map');
 await until('!SolarTime.renderer.ringTour&&!SolarTime.renderer.cameraTween');
 const returned=await evaluate('SolarTime.renderer.cameraSnapshot()');
 for(const [name,wanted] of Object.entries(home)){if(typeof wanted==='number')assert.ok(Math.abs(returned[name]-wanted)<1e-12,name);else assert.equal(returned[name],wanted,name);}
 return {extremeScale:true,orbitSpacing:1,zoom:expected.zoom,dolly:expected.dolly,directEsc:true,openingArrival:true,saturnOpeningEsc:true,refreshAndHomeReturn:true};
};
