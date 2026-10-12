'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until,mouse})=>{
 if(process.argv.includes('--constellation-fades'))return require('./constellation_fades.cjs')({evaluate,until});
 if(process.argv.includes('--orbit-brightness'))return require('./orbit_brightness.cjs')({evaluate,until,mouse});
 if(process.argv.includes('--body-pick')){
  await evaluate('SolarTime.renderer.restoreCamera(SolarTime.renderer.defaultCameraSnapshot());SolarTime.renderer.setOption("pluto",true)');
  await until('!SolarTime.renderer.dirty');
  const report=[];
  for(const [width,height] of [[1280,800],[1920,900],[3840,1800]])for(const actual of [false,true]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
   await evaluate(`SolarTime.renderer.setOption('actualScale',${actual});SolarTime.renderer.restoreCamera(SolarTime.renderer.defaultCameraSnapshot());`);
   await until('!SolarTime.renderer.actualScaleTween&&!SolarTime.renderer.dirty');
   const result=await evaluate(`(()=>{const r=SolarTime.renderer;return r.frameBodies.filter(p=>['pluto','moon'].includes(p.body.id)).map(p=>({id:p.body.id,r:p.r,screen:p.screen,hit:r.hit(p.screen.x,p.screen.y),ring:r.ringTourHit(p.screen.x,p.screen.y),targets:r.hitTargets.filter(t=>t.id===p.body.id),element:document.elementFromPoint(p.screen.x,p.screen.y)?.outerHTML.slice(0,240)}));})()`);
   report.push({width,height,actual,result});
   for(const p of result){if(p.screen.x<480)continue;assert.equal(p.hit,p.id);await mouse('mousePressed',p.screen.x,p.screen.y,'left',1);await mouse('mouseReleased',p.screen.x,p.screen.y,'left',0);p.selected=await evaluate('SolarTime.renderer.selected');assert.equal(p.selected,p.id,'visible point must receive the pointer through empty footer space');await evaluate('document.getElementById("body-close").click()');}
   if(width>1280)assert.equal(await evaluate(`(()=>{const el=document.querySelector('.footer a[href="guide.html"]'),b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===el;})()`),true,'visible footer links retain their pointer targets');
  }
  console.log(JSON.stringify({bodyPick:report}));
  return report;
 }
 if(process.argv.includes('--constellation-exits'))return require('./constellation_exits.cjs')({evaluate,send,session,until,mouse});
 if(process.argv.includes('--constellation-opening'))return require('./constellation_opening.cjs')({evaluate,send,session,until});
 if(process.argv.includes('--constellation-profile'))return require('./constellation_performance.cjs')({evaluate,until,send,session});
 if(process.argv.includes('--constellation-warp')){
  await evaluate('document.querySelector("[data-opening=default]").click();SolarTime.renderer.requestSkyFeature("polaris",performance.now(),100)');
  await until('!SolarTime.renderer.cameraTween');
  const home=await evaluate('SolarTime.renderer.skyFeatureTrack.returnState');
  await evaluate(`(()=>{const r=SolarTime.renderer,draw=r.drawFlightParticles;window.__warpParticleDraws=0;r.drawFlightParticles=function(c,...args){const originals={drawImage:c.drawImage,stroke:c.stroke,fill:c.fill};for(const key of Object.keys(originals))c[key]=function(...a){if(c.globalAlpha>0)window.__warpParticleDraws++;return originals[key].apply(this,a);};try{return draw.call(this,c,...args);}finally{Object.assign(c,originals);}};document.activeElement?.blur();})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'t',code:'KeyT'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'t',code:'KeyT'},session);
  await until('!!SolarTime.renderer.cameraTween?.replay');
  assert.equal(await evaluate('SolarTime.renderer.solarSceneHidden()'),true,'warp must retain solar hiding through departure');
  assert.equal(await evaluate('SolarTime.renderer.skyFeatureShortcutMode'),0,'warp releases constellation-only rendering');
  assert.deepEqual(await evaluate('SolarTime.renderer.cameraTween.to'),home);
  await until('window.__warpParticleDraws>100',25000);
  assert.equal(await evaluate('SolarTime.renderer.solarSceneHidden()'),true,'particles start without restoring hidden planets');
  return {warpFromConstellation:true,particleDraws:await evaluate('window.__warpParticleDraws'),returnToSolarView:true};
 }
 async function checkPolaris(){
  const point=await evaluate('SolarTime.renderer.sky.updateSkyFeatures().find(e=>e.feature.id==="polaris").points[0]');
  await mouse('mouseMoved',point.x,point.y,'none',0);
  await until('SolarTime.renderer.sky.featureHoverVisual("polaris").opacity>.9',3000);
  const circle=await evaluate(`(()=>{const r=SolarTime.renderer,c=document.createElement('canvas').getContext('2d'),arc=c.arc,glow=()=>{};glow.extent=r.boundStarGlow.extent;let radii=[];c.arc=function(x,y,r,...args){radii.push(r);return arc.call(this,x,y,r,...args);};r.sky.drawSkyFeatures(c,0,glow);return {radii,hover:r.sky.featureHover};})()`);
  assert.equal(circle.hover,'polaris');assert.ok(circle.radii.some(r=>r>8),'hover guide surrounds the visible halo');
  await evaluate('SolarTime.renderer.setSkyFeatureDisplay("polaris",true);SolarTime.renderer.setSkyFeatureHover(null)');
  await until('SolarTime.renderer.sky.featurePinnedVisual("polaris").opacity>.99');
  const pinned=await evaluate(`(()=>{const r=SolarTime.renderer,c=document.createElement('canvas').getContext('2d'),glow=()=>{};glow.extent=r.boundStarGlow.extent;let circles=0;c.arc=()=>circles++;r.sky.drawSkyFeatures(c,0,glow);return circles;})()`);
  assert.ok(pinned>0,'explicit display ON keeps the circle without a hovered pointer');
  await evaluate('SolarTime.renderer.setSkyFeatureDisplay("polaris",false)');
 }
 const ids=await evaluate('Object.keys(SolarSky.FEATURES)');assert.equal(ids.length,22);
 // Viewing mode hides the surrounding interface but keeps intentional scene cards.
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'},session);
 await until('document.body.classList.contains("zen")');await until('SolarTime.renderer.hitTargets.length>0');
 const bodyPoint=await evaluate(`(()=>{const r=SolarTime.renderer;return r.hitTargets.find(p=>p.x>20&&p.x<r.w-20&&p.y>20&&p.y<r.h-20&&r.hit(p.x,p.y)===p.id);})()`);
 assert.ok(bodyPoint,'viewing mode needs a visible planet target');
 await mouse('mousePressed',bodyPoint.x,bodyPoint.y,'left',1);await mouse('mouseReleased',bodyPoint.x,bodyPoint.y,'left',0);
 await until('!document.getElementById("body-panel").hidden');
 assert.equal(await evaluate('document.getElementById("body-panel").classList.contains("sky-feature")'),false);
 const zenOption=await evaluate(`(()=>{const r=SolarTime.renderer,s=document.getElementById('body-size-slider'),id=r.selected,before=r.bodySizeScale(id),target=Number(s.value)===Number(s.max)?Number(s.min):Number(s.max);s.value=String(target);s.dispatchEvent(new Event('input',{bubbles:true}));const after=r.bodySizeScale(id),visible=getComputedStyle(s).visibility;s.value=String(before*100);s.dispatchEvent(new Event('input',{bubbles:true}));return {visible,disabled:s.disabled,changed:after!==before};})()`);
 assert.deepEqual(zenOption,{visible:'visible',disabled:false,changed:true});
 await evaluate('document.getElementById("body-close").click()');
 await evaluate('(()=>{const r=SolarTime.renderer;r.animateCamera({...r.camera,...r.sky.featureCameraPose("big-dipper",.5,.5)},performance.now(),100);r.setSkyFeatureDisplay("big-dipper",true);})()');
 await until('!SolarTime.renderer.cameraTween');await until('SolarTime.renderer.sky.featureLineVisual("big-dipper").trace===1');
 const zenFeaturePoint=await evaluate(`(()=>{const r=SolarTime.renderer,e=r.sky.updateSkyFeatures().find(e=>e.feature.id==='big-dipper');return e.feature.edges.map(([a,b])=>e.points[a]&&e.points[b]?{x:(e.points[a].x+e.points[b].x)/2,y:(e.points[a].y+e.points[b].y)/2}:null).find(p=>p&&p.x>20&&p.x<r.w-20&&p.y>20&&p.y<r.h-20&&r.skyFeatureHit(p.x,p.y)==='big-dipper');})()`);
 assert.ok(zenFeaturePoint,'viewing mode needs a visible constellation target');
 await mouse('mousePressed',zenFeaturePoint.x,zenFeaturePoint.y,'left',1);await mouse('mouseReleased',zenFeaturePoint.x,zenFeaturePoint.y,'left',0);
 await until('document.getElementById("body-panel").classList.contains("sky-feature")');
 await evaluate('document.getElementById("body-close").click()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'},session);
 await until('!document.body.classList.contains("zen")');
 const beforeToggle=await evaluate('SolarTime.renderer.cameraSnapshot()');
 await evaluate('SolarTime.renderer.setSkyFeatureDisplay("big-dipper",true)');
 for(const expected of [22,0]){
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'*',code:'NumpadMultiply'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'*',code:'NumpadMultiply'},session);
  assert.equal(await evaluate('SolarTime.renderer.skyFeatureDisplayPreferences().length'),expected);
  assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),beforeToggle);assert.equal(await evaluate('SolarTime.renderer.skyFeatureShortcutMode'),0);
 }

 await evaluate('(()=>{const r=SolarTime.renderer;r.animateCamera({...r.camera,...r.sky.featureCameraPose("big-dipper",.5,.5)},performance.now(),100);})()');
 await until('!SolarTime.renderer.cameraTween');
 await evaluate('SolarTime.renderer.setSkyFeatureDisplay("big-dipper",true)');
 await until('SolarTime.renderer.sky.featureLineVisual("big-dipper").trace===1');
 const point=await evaluate(`(()=>{const r=SolarTime.renderer,e=r.sky.updateSkyFeatures().find(e=>e.feature.id==='big-dipper');return e.feature.edges.map(([a,b])=>e.points[a]&&e.points[b]?{x:(e.points[a].x+e.points[b].x)/2,y:(e.points[a].y+e.points[b].y)/2}:null).find(p=>p&&p.x>480&&p.x<1100&&p.y>100&&p.y<700&&r.skyFeatureHit(p.x,p.y)==='big-dipper');})()`);
 assert.ok(point,'a visible guide segment must open its card through the real pointer path');
 await mouse('mousePressed',point.x,point.y,'left',1);await mouse('mouseReleased',point.x,point.y,'left',0);
 await until('document.getElementById("body-panel").classList.contains("sky-feature")');
 assert.equal(await evaluate('document.getElementById("body-name").textContent'),'북두칠성');
 assert.equal(await evaluate('SolarTime.renderer.skyFeatureShortcutMode'),0,'selecting the card must not start tracking');
 await mouse('mousePressed',point.x,point.y,'left',1,2);await mouse('mouseReleased',point.x,point.y,'left',0,2);
 await until('SolarTime.renderer.skySolarMix>0&&SolarTime.renderer.skySolarMix<1');
 assert.equal(await evaluate('SolarTime.renderer.solarSceneHidden()'),false,'the solar scene fades before it is fully hidden');
 await until('SolarTime.renderer.skyFeatureShortcutMode===2&&!SolarTime.renderer.cameraTween');
 const trackedCamera=await evaluate('SolarTime.renderer.cameraSnapshot()');
 for(const expected of [22,0]){
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'*',code:'NumpadMultiply'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'*',code:'NumpadMultiply'},session);
  assert.equal(await evaluate('SolarTime.renderer.skyFeatureDisplayPreferences().length'),expected);
  assert.equal(await evaluate('document.getElementById("show-sky-feature").checked'),expected>0);
  assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),trackedCamera);
 }
 await evaluate('(()=>{const input=document.getElementById("show-sky-feature");input.focus();input.click();})()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'},session);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'},session);
 assert.equal(await evaluate('SolarTime.renderer.skyFeatureShortcutId'),'ursa-major','display-switch focus must not swallow nearest-sky navigation');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'},session);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'},session);
 await until('!SolarTime.renderer.cameraTween');
 await evaluate('SolarTime.renderer.setSkyFeatureDisplay("big-dipper",false);document.activeElement.blur()');
 await mouse('mouseMoved',point.x,point.y,'none',0);
 await until('SolarTime.renderer.sky.featureHover==="big-dipper"');
 await until('SolarTime.renderer.sky.featureHoverVisual("big-dipper").opacity>.9');
 const names=[],visited=new Set();
 for(let index=0;index<ids.length;index++){
  const item=await evaluate(`(()=>{const r=SolarTime.renderer;return {id:r.skyFeatureShortcutId,mode:r.skyFeatureShortcutMode,name:document.getElementById('body-name').textContent,expected:SolarSky.FEATURES[r.skyFeatureShortcutId].card.name,zoom:r.camera.zoom};})()`);
  assert.equal(item.mode,2);assert.equal(item.name,item.expected);assert.equal(visited.has(item.id),false,'nearest route must visit each feature once');visited.add(item.id);names.push(item.name);
  if(item.id==='polaris')await checkPolaris();
  await evaluate('document.getElementById("region-next").click()');await until('!SolarTime.renderer.cameraTween');
 }
 assert.equal(visited.size,ids.length);
 assert.equal(await evaluate('SolarTime.renderer.skyFeatureShortcutId'),'big-dipper');
 await until('!SolarTime.renderer.sky.featureTransientTransitions.size',12000);
 const guides=await evaluate(`(()=>{const sky=SolarTime.renderer.sky;return Object.keys(SolarSky.FEATURES).map(id=>({id,pinned:sky.isFeaturePinned(id),alpha:sky.featureLineVisual(id).opacity,hover:sky.featureHover}));})()`);
 assert.ok(guides.every(g=>g.pinned||g.alpha===0),'navigation must release the old pointer hover; unpinned guides must finish fading: '+JSON.stringify(guides));
 for(const id of ids){
  await evaluate(`SolarTime.renderer.requestSkyFeatureNavigation(${JSON.stringify(id)},performance.now(),50)`);await until('!SolarTime.renderer.cameraTween');
  const view=await evaluate('({mode:SolarTime.renderer.skyFeatureShortcutMode,zoom:SolarTime.renderer.camera.zoom})');
  assert.equal(view.mode,2);assert.equal(view.zoom,1.2);
 }
 assert.equal(await evaluate('SolarTime.renderer.gpu.gl.getError()'),0);
 await evaluate('SolarTime.renderer.requestSkyFeatureNavigation("polaris",performance.now(),50)');await until('!SolarTime.renderer.cameraTween');
 await checkPolaris();
 const image=await send('Page.captureScreenshot',{format:'png'},session);require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'solartime-polaris-hover.png'),Buffer.from(image.data,'base64'));
 // The constellation camera keeps one coherent, pickable five-percent solar system.
 await evaluate('(()=>{const r=SolarTime.renderer;r.camera={...r.camera,azimuth:0,elevation:Math.PI/2};r.flightBank=0;r.dirty=true;r.invalidatePresentation();})()');
 await until('!SolarTime.renderer.dirty');
 const pointMode=await evaluate(`(()=>{const r=SolarTime.renderer,state=SolarTime.getState(),planet=r.gpu.planet,drawPoint=r.drawBodyPoint,pointBodies=[];let surfaces=0;r.drawBodyPoint=function(c,item,...args){pointBodies.push(item.body.id);return drawPoint.call(this,c,item,...args);};r.gpu.planet=function(...args){surfaces++;return planet.apply(this,args);};try{r.draw(state.simulationMs,state.effectTime,performance.now());return {surfaces,pointBodies,point:r.bodyPointLod({id:'sun'},100),options:JSON.stringify(r.options),saved:r.skyFeatureTrack.returnState};}finally{r.gpu.planet=planet;r.drawBodyPoint=drawPoint;}})()`);
 assert.ok(pointMode.surfaces>0);assert.ok(pointMode.pointBodies.length>0,'compact solar viewing reuses the normal body pass');
 assert.equal(await evaluate('SolarTime.renderer.hitTargets.length'),0,'individual planets are not separate targets in constellation mode');
 const solarTarget=await evaluate('SolarTime.renderer.skySolarTarget');assert.ok(solarTarget&&solarTarget.r>0);assert.equal(await evaluate('SolarTime.renderer.solarSceneAppearance().scale'),.05);assert.equal(await evaluate(`SolarTime.renderer.skySolarHit(${solarTarget.x},${solarTarget.y})`),true);
 await mouse('mouseMoved',solarTarget.x,solarTarget.y,'none',0);await until('SolarTime.renderer.skySolarHoverOpacity()>.9');
 await mouse('mousePressed',solarTarget.x,solarTarget.y,'left',1);await mouse('mouseReleased',solarTarget.x,solarTarget.y,'left',0);
 await mouse('mousePressed',solarTarget.x,solarTarget.y,'left',1,2);await mouse('mouseReleased',solarTarget.x,solarTarget.y,'left',0,2);
 await until('SolarTime.renderer.skySolarMix<1');await until('!SolarTime.renderer.cameraTween');assert.equal(await evaluate('SolarTime.renderer.skyFeatureShortcutMode'),0,'double-clicking the compact solar system returns to solar mode');
 await evaluate('document.activeElement?.blur()');
 assert.equal(await evaluate('SolarTime.renderer.solarSceneHidden()'),false);
 assert.equal(await evaluate('JSON.stringify(SolarTime.renderer.options)'),pointMode.options);
 return {names,cyclicNavigation:true,unpinnedGuidesFade:true,fixedTrackingZoom:1.2,solarScale:.05,homeKey:true,gpuError:0};
};
