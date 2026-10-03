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
 assert.equal(expected.zoom,.1);assert.equal(expected.dolly,.002);
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
 await evaluate('SolarTime.renderer.ringTour.homeAfterAge=SolarTime.renderer.ringTour.age');
 await until('SolarTime.renderer.ringTour?.state==="cruising"||SolarTime.renderer.ringTour?.state==="returning"');
 await check();
 return {extremeScale:true,orbitSpacing:1,zoom:expected.zoom,dolly:expected.dolly,directEsc:true,openingArrival:true,saturnOpeningEsc:true,refreshAndLapReturn:true};
};
