'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,send,session,until,esc,delay})=>{
 const key=async(code,letter,extra={})=>{
  await send('Input.dispatchKeyEvent',{type:'keyDown',code,key:letter,...extra},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',code,key:letter},session);
 };
 const choose=mode=>evaluate(`document.getElementById('opening-toggle').click();document.querySelector('[data-opening="${mode}"]').click();document.activeElement?.blur()`);
 // No speakers/network dependency: exercise the real player's commands while
 // recording whether T stops/restarts the already-playing media element.
 await evaluate(`window.__musicPlays=0;window.__musicPauses=0;HTMLMediaElement.prototype.play=function(){window.__musicPlays++;return Promise.resolve();};HTMLMediaElement.prototype.pause=function(){window.__musicPauses++;};`);
 assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 await choose('none');await key('KeyT','t');await until('!SolarTime.getState().opening');
 assert.equal(await evaluate('!!SolarTime.renderer.cameraTween||!!SolarTime.renderer.ringTour'),false);
 assert.equal(await evaluate('SolarTime.renderer.camera.focus'),null);
 assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 assert.equal(await evaluate('SolarTime.renderer.openingLabelOpacity(performance.now())'),0);
 await key('KeyM','m');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),true);
 const music=await evaluate('[window.__musicPlays,window.__musicPauses]');
 await choose('default');await key('KeyT','ㅅ');
 await until('SolarTime.getState().opening&&!!SolarTime.renderer.cameraTween');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:600,y:400},session);
 await until('document.body.classList.contains("travel-cursor-active")&&Number(document.getElementById("travel-cursor").style.opacity)===1');
 assert.equal(await evaluate('getComputedStyle(document.getElementById("loading")).cursor'),'none');
 const start=await evaluate('SolarTime.renderer.cameraTween.start');
 assert.equal(await evaluate('Number.isFinite(SolarTime.renderer.cameraTween.replay.resetAt)'),false);
 assert.equal(await evaluate('SolarTime.renderer.cameraTween.timing'),'opening');
 await evaluate('void (window.__replayPool=SolarTime.renderer.openingParticles)');
 assert.ok(await evaluate('SolarTime.renderer.openingParticles?.points.length>0'));
 await key('KeyT','t',{autoRepeat:true});
 assert.equal(await evaluate('SolarTime.renderer.cameraTween.start'),start);
 assert.equal(await evaluate('SolarTime.getState().musicEnabled'),true);
 assert.deepEqual(await evaluate('[window.__musicPlays,window.__musicPauses]'),music);
 await until('performance.now()-SolarTime.renderer.cameraTween?.start>7100');
 assert.equal(await evaluate('SolarTime.renderer.openingParticles===window.__replayPool'),true,'no particle replacement at the waypoint');
 assert.equal(await evaluate('SolarTime.renderer.cameraTween.start'),start,'one camera owner crosses the waypoint');
 await key('KeyM','m');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 assert.equal(await evaluate('SolarTime.getState().opening'),true,'M never cancels the opening');
 await key('KeyM','m');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),true);
 await until('!SolarTime.getState().opening');
 await key('KeyM','ㅡ');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 await evaluate(`const field=document.createElement('input');field.id='qa-edit';document.body.append(field);field.focus();`);
 await key('KeyT','t');await key('KeyM','m');
 assert.equal(await evaluate('!!SolarTime.renderer.cameraTween||SolarTime.getState().musicEnabled'),false);
 await evaluate(`document.getElementById('qa-edit').remove();document.activeElement?.blur();`);
 await key('KeyT','t',{ctrlKey:true,modifiers:2});assert.equal(await evaluate('!!SolarTime.renderer.cameraTween'),false);
 await choose('saturn');await key('KeyT','t');
 await until('!!SolarTime.renderer.ringTour?.openingResume');
 assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 assert.equal(await evaluate('SolarTime.renderer.ringTour.annotationOpacity()'),0);
 assert.equal(await evaluate('SolarTime.renderer.ringTour.homeAfterAge===SolarRingTour.settings.entry+SolarTime.renderer.ringTour.period'),true,'T uses the selected one-lap opening');
 // T keeps the old tour alive through its smooth forward takeoff.
 await evaluate('void (window.__priorTour=SolarTime.renderer.ringTour)');await key('KeyT','t');
 assert.equal(await evaluate('SolarTime.renderer.ringTour===window.__priorTour&&!window.__priorTour.disposed&&window.__priorTour.state==="returning"'),true);
 assert.ok(await evaluate('SolarTime.renderer.openingParticles?.points.length>0&&SolarTime.renderer.ringTour.replayBridge&&!Number.isFinite(SolarTime.renderer.cameraTween.replay.resetAt)'));
 await evaluate('window.__lockedTween=SolarTime.renderer.cameraTween;window.__lockedFov=SolarTime.renderer.ringTour.fov');
 for(const digit of ['0','1','2','3'])await key('Digit'+digit,digit);
 await esc();
 await evaluate(`(()=>{const c=document.getElementById('universe');c.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}));c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,button:0,buttons:1,clientX:400,clientY:300,bubbles:true,cancelable:true}));c.dispatchEvent(new PointerEvent('pointermove',{pointerId:41,buttons:1,clientX:700,clientY:500,bubbles:true}));c.dispatchEvent(new PointerEvent('pointerup',{pointerId:41,button:0,buttons:0,bubbles:true}));document.getElementById('fit-view').click();})()`);
 assert.equal(await evaluate('SolarTime.getState().openingLocked&&SolarTime.renderer.cameraTween===window.__lockedTween&&SolarTime.renderer.ringTour.fov===window.__lockedFov'),true);
 try{await until('!!SolarTime.renderer.ringTour?.openingResume&&SolarTime.renderer.ringTour!==window.__priorTour&&!SolarTime.getState().opening');}
 catch(error){throw Error(error.message+' '+JSON.stringify(await evaluate(`(()=>{const r=SolarTime.renderer,p=r.cameraTween?.replay;return {opening:SolarTime.getState().opening,age:r.ringTour?.age,state:r.ringTour?.state,pose:r.ringTour?.pose,elapsed:performance.now()-r.cameraTween?.start,brake:p?.brakeAt,reset:p?.resetAt,visible:r.projected.filter(x=>!x.screen.behind&&x.r>=.5&&r.visible(x.screen,x.r*5+24)).map(x=>({id:x.body.id,x:x.screen.x,y:x.screen.y,r:x.r}))}})()`)));}
 assert.equal(await evaluate('SolarTime.getState().openingLocked'),false);
 await esc();await until('!SolarTime.renderer.ringTour');
 await until('!SolarTime.renderer.cameraTween');
 assert.equal(await evaluate('SolarTime.renderer.camera.focus'),null);
 // T keeps the lock through an ordinary opening too; boot behaviour is separate.
 await choose('default');await key('KeyT','t');await until('SolarTime.renderer.cameraTween?.timing==="opening"');
 await esc();assert.equal(await evaluate('SolarTime.getState().opening&&SolarTime.getState().openingLocked'),true);
 await until('!SolarTime.getState().opening');
 assert.equal(await evaluate('SolarTime.getState().openingLocked'),false);
 await evaluate('document.getElementById("live-button").click();document.getElementById("live-button").focus()');
 await key('Digit0','0');
 assert.equal(await evaluate('document.activeElement.id==="live-button"'),false);
 assert.equal(await evaluate('document.getElementById("live-button").matches(":focus-visible")'),false);
 await until('!SolarTime.renderer.cameraTween');
 await evaluate('SolarTime.renderer.prepareOpeningTour()');
 await until('SolarTime.renderer.preparedRingTour?.preparationReady&&SolarTime.renderer.preparedRingTour.resources?.ready');
 const handoff=await evaluate(`(()=>{
  const r=SolarTime.renderer,ms=SolarTime.getState().simulationMs,now=performance.now(),home=r.defaultCameraSnapshot();
  r.prepareOpeningTour();if(!r.preparedRingTour?.resources)throw Error(r.preparedRingTourError||'preparation failed');const pool=r.preparedRingTour.points;
  r.restoreCamera({...home,dolly:.001});r.animateOpeningCamera(home,now,5000);r.cameraTween.flyThrough=true;r.cameraTween.rotationBlend=null;
  r.draw(ms,0,now+3984);r.captureOpeningFlight(now+3984);r.draw(ms,0,now+4000);r.captureOpeningFlight(now+4000);
  const before=r.frameBodies.filter(p=>!p.screen.behind).map(p=>({id:p.body.id,x:p.screen.x,y:p.screen.y,r:p.r}));
  const start=performance.now();if(!r.startRingTour(undefined,true,now+4000))throw Error('handoff unavailable');
  const allocationMs=performance.now()-start;if(r.ringTour.points!==pool)throw Error('pool was rebuilt');r.draw(ms,0,now+4000);
  const delta=Math.max(...before.map(p=>{const q=r.currentFrameItem(p.id);return Math.max(Math.abs(p.x-q.screen.x),Math.abs(p.y-q.screen.y),Math.abs(p.r-q.r));}));
  r.endRingTour();r.restoreCamera(home);return {delta,allocationMs};
 })()`);
 assert.ok(handoff.delta<.01,JSON.stringify(handoff));
 const replay=await evaluate(`(()=>{
  const r=SolarTime.renderer,ms=SolarTime.getState().simulationMs,now=performance.now(),home=r.defaultCameraSnapshot();
  r.draw(ms,0,now);if(!r.startRingTour())throw Error('replay tour unavailable');
  const t=r.ringTour;t.age=22;t.state='cruising';t.look(.7,.12);t.zoom(.9);t.lastMono=now;
  r.draw(ms,0,now);
  const before=r.frameBodies.filter(p=>!p.screen.behind).map(p=>({id:p.body.id,x:p.screen.x,y:p.screen.y,r:p.r}));
  r.animateOpeningReplay(home,r.openingCameraSnapshot(home,()=>.23),now,5000);
  const move=r.cameraTween,pool=r.openingParticles;
  r.draw(ms,0,now);
  const startDelta=Math.max(...before.map(p=>{const q=r.currentFrameItem(p.id);return Math.max(Math.abs(p.x-q.screen.x),Math.abs(p.y-q.screen.y),Math.abs(p.r-q.r));}));
  for(let elapsed=100;elapsed<40000&&!Number.isFinite(move.replay.resetAt);elapsed+=100){
   r.draw(ms,0,now+elapsed);
   if(r.cameraTween!==move||r.openingParticles!==pool)throw Error('replay owner replaced');
   if(!Number.isFinite(move.replay.resetAt)&&r.replayPresentation(now+elapsed).solar!==1)throw Error('visible planets faded prematurely');
  }
  const reset=move.replay.resetAt;if(!Number.isFinite(reset))throw Error('viewport never cleared');
   if(Math.abs(reset-move.replay.brakeAt-2700)>1e-6)throw Error('B must begin 2.7 seconds after the 4.7-second loop starts');
   r.draw(ms,0,now+reset-50);
   const retained=r.replayPresentation(now+reset-50);
   if(retained.solar!==0||retained.cover!==0||pool.alpha<=0)throw Error('retain one unfaded sky through reset');
   if(move.replay.skyFrom)throw Error('must not freeze the sky orientation before the reset frame');
  r.draw(ms,0,now+reset);
  if(!move.replay.skyFrom)throw Error('reset must retain the last visible sky orientation');
  if(r.ringTour||r.cameraTween!==move||r.openingParticles!==pool)throw Error('handoff changed owners');
  if(r.preparedRingTour!==t||t.disposed)throw Error('tour resources not retained');
  r.draw(ms,0,now+reset+2500);
  const incoming=r.replayPresentation(now+reset+2500);
   if(incoming.cover!==0)throw Error('shared galaxy must not fade');
   if(Math.abs(r.sky.tanFov-Math.tan(incoming.fov*Math.PI/360))>.0001)throw Error('shared lens does not match camera');
   const result={startDelta,hiddenReset:true,resetAt:reset,cover:incoming.cover,oneParticlePool:true,transitionFov:incoming.fov,error:r.gpu.gl.getError()};
  const arrival=now+r.replayOpeningAt(move.replay)+move.replay.inbound*.8;
  r.draw(ms,0,arrival);
  if(!r.startRingTour(undefined,true,arrival))throw Error('arrival ring handoff unavailable');
  if(r.openingParticles!==pool||pool.exitAt!==null)throw Error('arrival handoff cut particles before their deadline');
  const deadline=now+r.replayOpeningAt(move.replay)+move.replay.inbound-300;
  if(r.openingParticleFrame(deadline)!==null||pool.points.length!==0)throw Error('particles must finish 0.3 seconds before the opening camera');
  r.endRingTour();r.clearPreparedTour();r.restoreCamera(home);return result;
 })()`);
 assert.ok(replay.startDelta<.01,JSON.stringify(replay));assert.equal(replay.error,0);
 // Render genuine overlapping GPU discs, forcing only projected depths to
 // cover both sides of Saturn independently of the date's planet alignment.
 await evaluate(`SolarTime.renderer.animateFocus('saturn')`);await until('SolarTime.renderer.canStartRingTour()');
 const occlusion=await evaluate(`(()=>{
  const r=SolarTime.renderer,gpu=r.gpu,g=gpu.gl,s=SolarTime.getState(),ms=s.simulationMs;
  r.startRingTour();const t=r.ringTour;t.pose.offset=[0,0];
  const project=r.projectRingTourPoint,visible=r.visible,activity=r.options.activity;
  let depth=-1,drawSun=true;
  const pixel=()=>{const out=new Uint8Array(4);g.readPixels(g.drawingBufferWidth/2|0,g.drawingBufferHeight/2|0,1,1,g.RGBA,g.UNSIGNED_BYTE,out);return [...out];};
  const view=t.skyCamera(SolarAstro.bodyAxes(SolarAstro.BODIES.find(b=>b.id==='saturn')),r.camera).viewAxes;
  r.projectRingTourPoint=function(p,world,out,rad,normal){
   project.call(this,p,world,out,rad,normal);const body=this.frameBodies.find(b=>b.world===world);
   out.x=this.w/2;out.y=this.h/2;out.radius=40;out.z=body?.body.id==='saturn'?-10:depth;
   out.qaVisible=drawSun&&body?.body.id==='sun';return out;
  };
  r.visible=s=>!!s.qaVisible;r.options.activity=false;
  const axes=SolarAstro.bodyAxes(SolarAstro.BODIES.find(b=>b.id==='saturn'));
  const draw=()=>{gpu.begin();r.drawRingTourBodies(t,axes,view,ms,0,performance.now());gpu.end();return pixel();};
  try{
   drawSun=false;const saturn=draw();drawSun=true;depth=-100;const behind=draw();depth=-1;const front=draw();
   const sun=r.currentFrameItem('sun');gpu.begin();gpu.planet(sun.directJob,sun.body,sun.screen,sun.r,0,false);gpu.end();const sunOnly=pixel();
   return {saturn,behind,front,sunOnly,error:g.getError()};
  }finally{r.projectRingTourPoint=project;r.visible=visible;r.options.activity=activity;r.endRingTour();}
 })()`);
 assert.deepEqual(occlusion.behind,occlusion.saturn,'far Sun must be behind Saturn');
 assert.deepEqual(occlusion.front,occlusion.sunOnly,'near Sun must cover Saturn');
 assert.notDeepEqual(occlusion.front,occlusion.behind);assert.equal(occlusion.error,0);
 await choose('none');await key('KeyM','m');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),true);
 await send('Page.reload',{},session);await until('!!window.SolarTime?.renderer&&!SolarTime.getState().opening');
 assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 await key('KeyT','t');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
 return {shortcuts:'T/M',modes:3,musicIndependent:true,noAutoplay:true,handoff,replay,occlusion};
};
