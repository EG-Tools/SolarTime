'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until})=>{
 const source=`(()=>{
 const key='eg.solar-time.v0.01',saved=JSON.parse(localStorage.getItem(key)||'{}');saved.skyFeatureDisplay=['big-dipper'];localStorage.setItem(key,JSON.stringify(saved));localStorage.setItem('solar-time.opening-mode.v1',JSON.stringify('default'));
 window.__guideFrames=[];let Sky;
 Object.defineProperty(window,'SolarSky',{configurable:true,get:()=>Sky,set(value){Sky=value;const draw=value.prototype.draw;value.prototype.draw=function(...args){const result=draw.apply(this,args);if(this.camera)window.__guideFrames.push({hidden:!!this.camera.hideFeatureLines,opening:!!this.camera.openingGuides,axes:this.featureAxes,replay:!!this.camera.replaySky,at:performance.now(),...this.featureLineVisual('big-dipper'),pinned:this.isFeaturePinned('big-dipper'),features:this.updateSkyFeatures().length});return result;};}});
 })()`;
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source},session);
 try{
  await send('Page.reload',{ignoreCache:true},session);
  await until('!!window.SolarTime&&!SolarTime.getState().opening&&window.__guideFrames.some(r=>r.opening)&&window.__guideFrames.at(-1)?.trace===1',45000);
  const boot=await evaluate('window.__guideFrames'),first=boot.findIndex(r=>r.opening);
  assert.ok(first>=0);assert.ok(boot[first].pinned);assert.ok(boot[first].opacity<.1);assert.ok(boot[first].trace<.01);
  assert.ok(boot.some(r=>r.opening&&r.trace>0&&r.trace<1));
  await evaluate('SolarTime.renderer.stopAutoRotate()');
  const before=await evaluate('({camera:SolarTime.renderer.cameraSnapshot(),axes:SolarTime.renderer.sky.axesNow})');
  await evaluate('window.__guideFrames=[];document.activeElement?.blur()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'},session);
  await until('window.__guideFrames.some(r=>r.replay)',10000);
  await until('!SolarTime.getState().opening&&!SolarTime.renderer.cameraTween',45000);
  const warp=await evaluate('window.__guideFrames'),during=warp.filter(r=>r.replay);
  assert.ok(during.length>10);assert.ok(during.every(r=>!r.hidden&&r.pinned&&r.opacity===1&&r.trace===1&&r.features>0),'warp must preserve the existing guides throughout departure, loop and arrival');
  const after=await evaluate('({camera:SolarTime.renderer.cameraSnapshot(),axes:SolarTime.renderer.sky.axesNow})');
  const changes=warp.slice(1).map((r,i)=>({at:r.at,replay:r.replay,delta:Math.hypot(...r.axes.forward.map((v,j)=>v-warp[i].axes.forward[j]))})).sort((a,b)=>b.delta-a.delta).slice(0,4);
  assert.deepEqual(after.camera,before.camera);assert.ok(changes[0].delta<.15,'no discontinuity at warp reset: '+changes[0].delta);
  return {before,after,changes,openingStartsAtZero:true,openingTracesSequentially:true,warpGuidesKept:true,warpFrames:during.length};
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier},session);}
};
