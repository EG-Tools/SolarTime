'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
module.exports=async({root,evaluate,send,session})=>{
 const server=http.createServer((req,res)=>{
  let f;try{f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(f===root)f=path.join(root,'index.html');
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function until(expression,ms=35000){const end=Date.now()+ms;while(!await evaluate(expression)){if(Date.now()>end)throw Error('Timed out: '+expression);await delay(100);}}
 const mouse=(type,x,y,button='none',buttons=0)=>send('Input.dispatchMouseEvent',{type,x,y,button,buttons,clickCount:button==='none'?0:1},session);
 const esc=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);};
 async function checkTravelCard(){
  const choose=id=>evaluate(`document.querySelector('#planet-nav [data-body="${id}"]').click()`);
  const button='document.getElementById("ring-tour-button")';
  for(const id of ['earth','jupiter','sun']){await choose(id);assert.equal(await evaluate(button+'.hidden'),true,id);}
  await choose('saturn');assert.equal(await evaluate(button+'.hidden'),false);
  assert.equal(await evaluate(button+'.previousElementSibling.id'),'focus-body');
  await evaluate('SolarTime.setLanguage("kor")');assert.equal(await evaluate(button+'.textContent'),'여행');
  await evaluate('SolarTime.setLanguage("en")');assert.equal(await evaluate(button+'.textContent'),'Travel');
  await evaluate('SolarTime.setLanguage("kor")');
  // Enter from the overview without forcing a separate tracking-camera tween.
  await until('!'+button+'.disabled');
  await until('getComputedStyle(document.getElementById("body-panel")).opacity==="1"');
  const saved=await evaluate('SolarTime.renderer.cameraSnapshot()');
  const point=await evaluate(`(()=>{const b=${button};b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const image=path.join(os.tmpdir(),'solartime-saturn-travel-card.png');
  const screenshot=await send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(image,Buffer.from(screenshot.data,'base64'));
  await mouse('mousePressed',point.x,point.y,'left',1);await mouse('mouseReleased',point.x,point.y,'left',0);
  await until('!!SolarTime.renderer.ringTour');
  assert.equal(await evaluate('SolarTime.renderer.ringTour.state'),'entering');
  assert.equal(await evaluate('SolarTime.renderer.selected'),null);
  assert.equal(await evaluate('SolarTime.renderer.canStartRingTour()'),false);
  assert.equal(await evaluate(`(()=>{const t=SolarTime.renderer.ringTour;${button}.click();return t===SolarTime.renderer.ringTour;})()`),true);
  await esc();await until('SolarTime.renderer.ringTour?.state==="returning"');
  await evaluate('SolarTime.renderer.ringTour.returnAge=SolarTime.renderer.ringTour.returnDuration-.05');
  await until('!SolarTime.renderer.ringTour');assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),saved);
  await choose('saturn');await evaluate('document.getElementById("focus-body").click()');
  await until(button+'.disabled');await until('!SolarTime.renderer.cameraTween&&!'+button+'.disabled');
  // Keyboard activation uses the same button command from tracking view.
  await evaluate(button+'.focus()');
  assert.equal(await evaluate('document.activeElement.id'),'ring-tour-button');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},session);
  await until('!!SolarTime.renderer.ringTour');await esc();
  await evaluate('SolarTime.renderer.ringTour.returnAge=SolarTime.renderer.ringTour.returnDuration-.05');
  await until('!SolarTime.renderer.ringTour');
  return {saturnOnly:true,sharedEntry:true,overviewAndTracking:true,keyboard:true,translations:true,image,error:await evaluate('SolarTime.renderer.gpu.gl.getError()')};
 }
 async function checkTourNavigation(){
  const choose=id=>evaluate(`document.querySelector('#planet-nav [data-body="${id}"]').click()`);
  const begin=async age=>{
   await evaluate('SolarTime.renderer.animateFocus("saturn")');await until('SolarTime.renderer.canStartRingTour()');
   await evaluate(`(()=>{const r=SolarTime.renderer;r.startRingTour();const t=r.ringTour;t.age=${age};t.visualAge=t.age;t.state=t.age>=10?'cruising':'entering';t.pose=t.cameraPose();window.__navigationTour=t;})()`);
  };
  await begin(12);
  const initial=await evaluate('SolarTime.renderer.cameraSnapshot()');
  const ids=await evaluate('Array.from(document.querySelectorAll("#planet-nav [data-body]")).filter(b=>!b.hidden).map(b=>b.dataset.body)');
  for(const id of ids){
   await choose(id);
   assert.equal(await evaluate(`SolarTime.renderer.selected===${JSON.stringify(id)}&&!document.getElementById('body-panel').hidden`),true);
   assert.equal(await evaluate('SolarTime.renderer.ringTour===window.__navigationTour&&!window.__navigationTour.disposed&&window.__navigationTour.state==="cruising"&&!SolarTime.renderer.cameraTween'),true,id);
  }
  assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),initial,'reading cards does not move the camera');
  await evaluate('document.getElementById("body-close").click()');
  assert.equal(await evaluate('SolarTime.renderer.ringTour===window.__navigationTour'),true,'closing cards keeps the flight');
  for(const [index,id] of ['earth','moon','uranus'].entries()){
   if(index)await begin(index===1?3:12);
   if(id==='uranus'){
    for(const [button,buttons,dx,dy] of [['right',2,0,-80],['left',1,170,70],['middle',4,0,-35]]){
     await mouse('mousePressed',500,350,button,buttons);
     await mouse('mouseMoved',500+dx,350+dy,button,buttons);
     await mouse('mouseReleased',500+dx,350+dy,button,0);
    }
   }
   await choose(id);await evaluate('document.getElementById("focus-body").click()');
   await until('SolarTime.renderer.ringTour?.returnTargetApplied');
   const transition=await evaluate('(()=>{const r=SolarTime.renderer,t=r.ringTour;return {same:t===window.__navigationTour,state:t.state,disposed:t.disposed,tween:!!r.cameraTween,target:t.returnTarget.focus,rewind:!!t.returnMotion.rewind,duration:t.returnDuration};})()');
   assert.deepEqual({...transition,duration:0},{same:true,state:'returning',disposed:false,tween:false,target:id,rewind:index===1,duration:0});
   if(id==='uranus'){
    const report=await evaluate(`(()=>{
     const r=SolarTime.renderer,t=r.ringTour,age=t.returnAge,samples=[];
     for(const fraction of [0,.1,.5,.9,.99,1]){
      t.returnAge=t.returnDuration*fraction;t.pose=t.cameraPose();
      const p=r.prepareRingTourProjection({...t.projection,focal:r.h/(2*Math.tan(t.pose.fov*Math.PI/360))});
      const finite=r.frameBodies.every(body=>{
       const s=r.projectRingTourPoint(p,body.world,{},r.bodyRadiusAtZoom(body.body));
       return ['clipX','clipY','clipW','clipRadius'].every(key=>Number.isFinite(s[key]))&&s.clipRadius>0;
      });
      const body=r.currentFrameItem('uranus'),s=r.projectRingTourPoint(p,body.world,{},r.bodyRadiusAtZoom(body.body)),normal=r.project(body.world);
      samples.push({fraction,finite,behind:s.behind,visible:r.visible(s,s.radius),error:Math.hypot(s.x-normal.x,s.y-normal.y),radiusError:Math.abs(s.radius-r.bodyRadiusAtZoom(body.body)*normal.perspective)});
     }
     t.returnAge=age;t.pose=t.cameraPose();
     return {saturnBehind:r.project(r.currentFrameItem('saturn').world).behind,controls:t.returnControls,samples};
    })()`);
    assert.ok(report.saturnBehind,'exercise the clipped Saturn reference, not only a visible Saturn');
    assert.ok(report.controls.yaw&&report.controls.pitch&&report.controls.pan[1]&&report.controls.fov!==72,'all three real mouse gestures applied');
    assert.ok(report.samples.every(s=>s.finite),'no NaN or flipped sizes anywhere during the return');
    const late=report.samples.at(-2),end=report.samples.at(-1);
    assert.ok(late.visible&&!late.behind&&late.error<2&&late.radiusError<1,JSON.stringify(late));
    assert.ok(end.error<.01&&end.radiusError<.01,'no endpoint position/size pop');
   }
   assert.ok(transition.duration<=7);
   // Reading a different card during return must not replace its destination.
   await choose('jupiter');assert.equal(await evaluate('SolarTime.renderer.ringTour.returnTarget.focus'),id);
   await evaluate('document.getElementById("body-close").click()');
   await evaluate('SolarTime.renderer.ringTour.returnAge=SolarTime.renderer.ringTour.returnDuration-.8');
   await until('SolarTime.renderer.ringTour?.annotationReveal');await until('!SolarTime.renderer.ringTour');
   assert.equal(await evaluate('SolarTime.renderer.camera.focus'),id);assert.equal(await evaluate('SolarTime.renderer.cameraTween'),null);
   const centre=await evaluate(`(()=>{const r=SolarTime.renderer,p=r.currentFrameItem('${id}');return {x:p.screen.x-r.cx,y:p.screen.y-r.cy};})()`);
   assert.ok(Math.hypot(centre.x,centre.y)<1,JSON.stringify(centre));
  }
  return {cards:ids.length,readWithoutExit:true,trackingViaSharedReturn:true,spiral:true,earlyCancel:true,moonTracking:true,uranusAfterMouseControls:true,error:await evaluate('SolarTime.renderer.gpu.gl.getError()')};
 }
 async function checkFullscreenEscape(){
  const origin=await evaluate('location.origin');
  // Permission is granted ONLY in this disposable test profile, never user settings.
  await send('Browser.setPermission',{permission:{name:'keyboard-lock'},setting:'granted',origin});
  const key=async(k,code,vk)=>{
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk},session);
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk},session);
  };
  const enterFullscreen=async()=>{
   await evaluate('document.activeElement?.blur()');await key('f','KeyF',70);
   await until('!!document.fullscreenElement&&SolarTime.getState().escapeLock==="locked"');
  };
  const start=async(cruising=false)=>{
   await until('SolarTime.renderer.canStartRingTour()');
   await evaluate('(()=>{const r=SolarTime.renderer;r.startRingTour();window.__fullscreenTour=r.ringTour;'+(cruising?'r.ringTour.age=12;r.ringTour.state="cruising";r.ringTour.pose=r.ringTour.cameraPose();':'')+'})()');
  };
  const finishReturn=async()=>{
   await evaluate('SolarTime.renderer.ringTour.returnAge=SolarTime.renderer.ringTour.returnDuration-.05');
   await until('!SolarTime.renderer.ringTour');
  };
  for(const cruising of [false,true]){
   await enterFullscreen();await start(cruising);await esc();
   await until('SolarTime.renderer.ringTour?.state==="returning"');
   assert.ok(await evaluate('!!document.fullscreenElement'),'first Escape retains fullscreen');
   // Holding the same press must not count as a second press.
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,autoRepeat:true},session);
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);
   assert.ok(await evaluate('!!document.fullscreenElement'));
   await esc();await until('!document.fullscreenElement');
   assert.equal(await evaluate('SolarTime.renderer.ringTour===window.__fullscreenTour&&SolarTime.renderer.ringTour.state==="returning"'),true);
   await until('SolarTime.getState().escapeLock==="native"');await finishReturn();
  }
  await enterFullscreen();await start(true);await key('f','KeyF',70);await until('!document.fullscreenElement');
  assert.equal(await evaluate('SolarTime.renderer.ringTour===window.__fullscreenTour&&SolarTime.renderer.ringTour.state==="cruising"'),true,'F only exits fullscreen');
  await esc();await finishReturn();
  await enterFullscreen();await esc();await until('!document.fullscreenElement');
  await until('SolarTime.getState().escapeLock==="native"');
  assert.equal(await evaluate('SolarTime.getState().escapeLock'),'native');
  assert.equal(await evaluate('document.getElementById("help-dialog").open'),false,'fullscreen exit must not also open help');
  return {entering:true,cruising:true,secondEscapeDuringReturn:true,repeatIgnored:true,fIndependent:true,ordinaryEscape:true};
 }
 async function checkSavedViews(){
  for(const slot of [1,2,3]){
   await evaluate('SolarTime.renderer.animateFocus("saturn")');await until('!SolarTime.renderer.cameraTween');
   await evaluate(`(()=>{const r=SolarTime.renderer;r.startRingTour();const t=r.ringTour;t.age=${[5,8,12][slot-1]};t.visualAge=t.age;t.state=t.age>=10?'cruising':'entering';t.zoom(2);t.pose=t.cameraPose();window.__presetTour=t;document.activeElement?.blur();})()`);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:String(slot),code:'Digit'+slot,windowsVirtualKeyCode:48+slot},session);
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:String(slot),code:'Digit'+slot,windowsVirtualKeyCode:48+slot},session);
   await until('SolarTime.renderer.ringTour?.returnTargetApplied');
   const exit=await evaluate('(()=>{const r=SolarTime.renderer,t=r.ringTour;return {same:t===window.__presetTour,disposed:t.disposed,tween:!!r.cameraTween,duration:t.returnDuration,rewind:!!t.returnMotion.rewind};})()');
   assert.ok(exit.same&&!exit.disposed&&!exit.tween&&exit.duration<=7);assert.equal(exit.rewind,slot===1);
   await evaluate('SolarTime.renderer.ringTour.returnAge=SolarTime.renderer.ringTour.returnDuration-.9');
   await until('SolarTime.renderer.ringTour?.annotationReveal');
   assert.ok(await evaluate('SolarTime.renderer.openingOrbitStart<performance.now()'),'orbit reveal starts before arrival');
   await until('!SolarTime.renderer.ringTour');
   assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),await evaluate('SolarTime.getPresets()['+(slot-1)+']'));
   assert.equal(await evaluate('document.getElementById("zoom-value").textContent'),(await evaluate('SolarTime.getPresets()['+(slot-1)+'].zoom')).toFixed(1)+'×');
   assert.equal(await evaluate('SolarTime.renderer.openingLabelOpacity(SolarTime.renderer.openingOrbitStart)'),0);
  }
  console.log('ring QA: keys 1/2/3 share the seven-second return and opening reveal, preserving saved lenses');
 }
 try{
  await send('Page.enable',{},session);
  if(!process.argv.includes('--help-onboarding'))await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('solar-time.help-seen.v1','true');}catch{}`},session);
  // Seed only this runner's disposable browser profile, never the user's tabs.
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('solar-time.camera-presets.v1',JSON.stringify({schema:2,slots:[1,2,3].map(n=>({azimuth:n*.4,elevation:.25,zoom:1.1*n,dolly:1+n*.2,focus:n===2?'earth':null,panX:.03,panY:0,mode:'move'}))}));}catch{}`},session);
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'},session);
  if(process.argv.includes('--help-onboarding'))return await require('./help_onboarding.cjs')({evaluate,send,session,until,esc,delay,mouse});
  await until('!!window.SolarTime?.renderer&&!SolarTime.getState().opening');
  console.log('ring QA: app ready');
  assert.ok((await evaluate('SolarTime.getPresets()')).every(Boolean),'all three test presets must be seeded before app initialization');
  await evaluate("SolarTime.renderer.stopAutoRotate();document.getElementById('cookie-reject').click()");
  if(process.argv.includes('--ring-tour-card'))return await checkTravelCard();
  if(process.argv.includes('--travel-optimization'))return await require('./travel_optimization.cjs')({root,evaluate,until,esc});
  if(process.argv.includes('--focus-input'))return await require('./focus_input.cjs')({evaluate,send,session,until,esc,delay,mouse});
  if(process.argv.includes('--travel-return'))return await require('./travel_return.cjs')({evaluate,send,session,until,esc,delay,mouse});
  if(process.argv.includes('--travel-pause'))return await require('./travel_pause.cjs')({evaluate,send,session,until,esc,delay,mouse});
  if(process.argv.includes('--travel-controls'))return await require('./travel_controls.cjs')({evaluate,send,session,until,esc,delay});
  if(process.argv.includes('--replay-transition'))return await require('./replay_transition.cjs')({evaluate,delay});
  if(process.argv.includes('--flight-atlas'))return await require('./flight_particles.cjs')({evaluate,until});
  if(process.argv.includes('--opening-settings')){
    await evaluate('SolarTime.setLanguage("kor")');
    assert.equal(await evaluate('document.getElementById("language-control").nextElementSibling.id'),'opening-control');
    assert.equal(await evaluate('document.getElementById("opening-toggle").title'),'오프닝 여행 · 기본 오프닝 · T');
    const pressH=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'},session);};
    assert.equal(await evaluate('SolarTime.getState().zen'),false);
    assert.equal(await evaluate('getComputedStyle(document.getElementById("universe")).cursor'),'grab');
    await mouse('mouseMoved',600,400);await pressH();
    await until('SolarTime.getState().zen&&document.body.classList.contains("pointer-awake")');
    assert.equal(await evaluate('document.body.classList.contains("travel-cursor-active")'),false);
    assert.equal(await evaluate('getComputedStyle(document.getElementById("universe")).cursor'),'grab');
    await until('!document.body.classList.contains("pointer-awake")');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("universe")).cursor'),'none');
    await mouse('mouseMoved',620,420);
    assert.equal(await evaluate('getComputedStyle(document.getElementById("universe")).cursor'),'grab');
    await pressH();await until('!SolarTime.getState().zen');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("universe")).cursor'),'grab');
    const choose=async mode=>{await evaluate(`document.getElementById('opening-toggle').click()`);await delay(100);await evaluate(`document.querySelector('[data-opening="${mode}"]').click()`);};
    await choose('none');
    assert.match(await evaluate('document.getElementById("toast").textContent'),/T/);
    assert.equal(await evaluate('document.getElementById("opening-toggle").title'),'오프닝 여행 · 없음 · T');
    const reload=async()=>{await evaluate('window.__oldOpeningDocument=true');await send('Page.reload',{},session);await until('!window.__oldOpeningDocument&&!!window.SolarTime?.renderer');};
    const savedOpeningView=await evaluate('SolarTime.renderer.cameraSnapshot()');
    await evaluate("localStorage.setItem('solar-time.ring-travel-resume.v1','true')");await reload();
    await until('!SolarTime.getState().opening');
    const none=await evaluate('(()=>{const r=SolarTime.renderer;return {tween:!!r.cameraTween,tour:!!r.ringTour,focus:r.camera.focus,dolly:r.camera.dolly,home:r.defaultCameraSnapshot().dolly,start:r.openingOrbitStart};})()');
    assert.equal(none.tween,false);assert.equal(none.tour,false);assert.equal(none.focus,null);assert.equal(none.dolly,savedOpeningView.dolly);assert.ok(Number.isFinite(none.start));
    await until('SolarTime.renderer.openingLabelOpacity(performance.now())===1');
    await choose('saturn');assert.equal(await evaluate('document.getElementById("opening-toggle").title'),'오프닝 여행 · 토성 · T');
    await reload();await until('SolarTime.getState().openingLocked');
    await mouse('mouseMoved',600,400);
    await until('Number(document.getElementById("travel-cursor").style.opacity)>0&&Number(document.getElementById("travel-cursor").style.opacity)<1');
    await until('Number(document.getElementById("travel-cursor").style.opacity)===1');
    assert.equal(await evaluate('document.getElementById("travel-cursor").style.backgroundImage===SolarRingTour.cursorImage'),true);
    const fade=await evaluate("new Promise(resolve=>{const start=performance.now(),samples=[];function sample(now){samples.push({elapsed:now-start,alpha:Number(document.getElementById('travel-cursor').style.opacity)});if(now-start<2750)requestAnimationFrame(sample);else resolve(samples);}requestAnimationFrame(sample);})");
    assert.ok(fade.some(p=>p.elapsed>1500&&p.elapsed<1850&&p.alpha===1),'UFO stays visible before two idle seconds');
    assert.ok(fade.some(p=>p.elapsed>2000&&p.alpha>0&&p.alpha<1),'UFO fades gradually');
    assert.equal(fade.at(-1).alpha,0);
    await mouse('mouseMoved',610,410);
    await until('Number(document.getElementById("travel-cursor").style.opacity)>0&&Number(document.getElementById("travel-cursor").style.opacity)<1');
    await until('Number(document.getElementById("travel-cursor").style.opacity)===1');
    await until('!!SolarTime.renderer.ringTour?.openingResume');
    await until('!document.body.classList.contains("travel-cursor-active")');
    const lapReturn=await evaluate('SolarTime.renderer.ringTour.returnTarget');
    const lap=await evaluate('(()=>{const t=SolarTime.renderer.ringTour;return {deadline:t.homeAfterAge,entry:SolarRingTour.settings.entry,period:t.period};})()');
    assert.equal(lap.deadline,lap.entry+lap.period,'one full cruise lap follows boarding');
    await evaluate('(()=>{const t=SolarTime.renderer.ringTour;t.age=t.homeAfterAge-.5;t.state="cruising";t.lastMono=performance.now();})()');
    assert.equal(await evaluate('SolarTime.renderer.ringTour.state'),'cruising');
    await until('SolarTime.renderer.ringTour?.state==="returning"');
    assert.deepEqual(await evaluate('SolarTime.renderer.ringTour.returnTarget'),lapReturn);
    await until('!SolarTime.renderer.ringTour');
    assert.equal(await evaluate("localStorage.getItem('solar-time.ring-travel-resume.v1')"),'false');
    await choose('default');await reload();await until('!SolarTime.getState().opening');
    assert.equal(await evaluate('!!SolarTime.renderer.ringTour'),false);
    await evaluate('document.getElementById("music-toggle").click()');
    assert.equal(await evaluate("localStorage.getItem('solar-time.music-enabled.v1')"),'true');
    await reload();await until('!SolarTime.getState().opening');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
    assert.equal(await evaluate("localStorage.getItem('solar-time.music-enabled.v1')"),'true','page teardown retains ON');
    await until('!SolarTime.getState().opening');
    await reload();await until('!SolarTime.getState().opening');assert.equal(await evaluate('SolarTime.getState().musicEnabled'),false);
    await evaluate('document.getElementById("opening-toggle").click()');await delay(1100);
    const screenshot=path.join(os.tmpdir(),'solartime-opening-settings.png'),shot=await send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
    return {modes:true,noneKeepsView:true,noneKeepsAnnotations:true,saturn:true,oneLapReturn:true,travelCursorFade:true,nativeZenCursor:true,replayNotice:true,musicAutoplayDisabled:true,screenshot};
  }
  if(process.argv.includes('--ring-tour-resume')){
    await evaluate("SolarTime.renderer.animateFocus('saturn')");await until('SolarTime.renderer.canStartRingTour()');
    const savedTravelView=await evaluate('SolarTime.renderer.cameraSnapshot()');
    await evaluate("(()=>{const r=SolarTime.renderer;r.startRingTour();r.ringTour.age=10;r.ringTour.state='cruising';})()");
    await until("localStorage.getItem('solar-time.ring-travel-resume.v1')==='true'");
    await send('Page.reload',{},session);
    await until('!!window.SolarTime?.renderer&&SolarTime.getState().opening');
    await until('!!SolarTime.renderer.cameraTween');
    assert.equal(await evaluate('SolarTime.renderer.openingOrbitOpacity(performance.now())'),0);
    try{await until('!!SolarTime.renderer.ringTour?.openingResume');}catch(error){console.log(await evaluate(`(()=>{const r=SolarTime.renderer,p=r.currentFrameItem('saturn');return {state:SolarTime.getState(),ready:r.canStartRingTour(true),p:p&&{r:p.r,screen:p.screen,job:!!p.directJob},textures:[...r.gpu.textures.keys()],tour:!!r.ringTour,error:r.ringTourError};})()`));throw error;}
    assert.equal(await evaluate('SolarTime.getState().opening'),false);
    assert.equal(await evaluate('SolarTime.renderer.openingLabelOpacity(performance.now())'),0);
    assert.equal(await evaluate('SolarTime.renderer.ringTour.annotationOpacity()'),0,'travel overlay must not resurrect hidden opening orbits');
    assert.equal(await evaluate('!!SolarTime.renderer.ringTour.openingMomentum'),true,'handoff retains the sampled opening velocity');
    await esc();await until("SolarTime.renderer.ringTour?.state==='returning'");
    assert.deepEqual(await evaluate('SolarTime.renderer.ringTour.returnTarget'),savedTravelView);
    await until('!SolarTime.renderer.ringTour');
    assert.equal(await evaluate("localStorage.getItem('solar-time.ring-travel-resume.v1')"),'false');
    await send('Page.reload',{},session);
    await until('!!window.SolarTime?.renderer&&SolarTime.getState().opening');
    await until('!SolarTime.getState().opening');
    assert.equal(await evaluate('!!SolarTime.renderer.ringTour'),false);
    return {resume:true,escapeReturnsPreviousView:true,noResumeAfterExit:true};
  }
  await evaluate("SolarTime.renderer.animateFocus('saturn');document.activeElement?.blur()");
  await until("!SolarTime.renderer.cameraTween&&!!SolarTime.renderer.gpu.textures.get('saturn-ring')?.texture");
  if(process.argv.includes('--ring-tour-navigation'))return await checkTourNavigation();
  if(process.argv.includes('--ring-tour-fullscreen'))return await checkFullscreenEscape();
  if(process.argv.includes('--ring-tour-shortcuts')){await checkSavedViews();return {shortcuts:true,error:await evaluate('SolarTime.renderer.gpu.gl.getError()')};}
  const point=await evaluate("(()=>{const r=SolarTime.renderer;for(let y=270;y<650;y+=5)for(let x=300;x<1000;x+=5)if(r.ringTourHit(x,y))return {x,y};throw Error('No ring hit');})()");
  await mouse('mouseMoved',point.x,point.y);
  assert.equal(await evaluate('SolarTime.renderer.ringTourHover'),true);
  assert.ok((await evaluate("document.getElementById('universe').style.cursor")).includes('svg'));
  const saved=await evaluate('SolarTime.renderer.cameraSnapshot()');
  // Compare the actual orthographic tracking disc against the first tour frame, not just pose numbers.
  const handoff=await evaluate(`(()=>{
    const r=SolarTime.renderer,s=SolarTime.getState(),mono=performance.now();r.draw(s.simulationMs,s.effectTime,mono);
    const p=r.currentFrameItem('saturn'),gl=r.gpu.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const normal=new Uint8Array(w*h*4),tourPixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,normal);
    r.startRingTour(r.ringTourHit(${point.x},${point.y}));r.ringTour.advance(mono);r.gpu.begin();r.ringTour.draw(r.gpu,r.w,r.h);r.gpu.end();
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,tourPixels);
    let difference=0,count=0,coverage=0;const scale=w/r.w,cx=p.screen.x*scale,cy=h-p.screen.y*scale,radius=p.r*scale;
    for(let y=Math.max(0,Math.floor(cy-radius*.7));y<Math.min(h,cy+radius*.7);y++)for(let x=Math.max(0,Math.floor(cx-radius*.7));x<Math.min(w,cx+radius*.7);x++){
      if(Math.hypot(x-cx,y-cy)>radius*.7)continue;const i=(y*w+x)*4;
      for(let c=0;c<3;c++){difference+=Math.abs(normal[i+c]-tourPixels[i+c]);count++;}
      coverage+=Math.abs(normal[i+3]-tourPixels[i+3]);
    }
    let ringDifference=0,ringCount=0,ringAlpha=0;const frame=r.bodyFrame(p.body),det=frame.u.x*frame.v.y-frame.u.y*frame.v.x;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const dx=(x-cx)/radius,dy=(cy-y)/radius;if(Math.hypot(dx,dy)<1.08)continue;
      const radial=Math.hypot((dx*frame.v.y-dy*frame.v.x)/det,(dy*frame.u.x-dx*frame.u.y)/det);
      if(radial<1.3||radial>2.24)continue;const i=(y*w+x)*4;
      for(let c=0;c<3;c++){ringDifference+=Math.abs(normal[i+c]-tourPixels[i+c]);ringCount++;}
      ringAlpha+=Math.abs(normal[i+3]-tourPixels[i+3]);
    }
    const error=gl.getError();r.endRingTour();r.draw(s.simulationMs,s.effectTime,mono);
    return {difference:difference/count,coverage:coverage/(count/3),ringDifference:ringDifference/ringCount,ringAlpha:ringAlpha/(ringCount/3),error};
  })()`);
  assert.equal(handoff.error,0);assert.ok(handoff.difference<8,JSON.stringify(handoff));assert.ok(handoff.ringDifference<8,JSON.stringify(handoff));
  console.log('ring QA: camera handoff checked');
  await mouse('mousePressed',point.x,point.y,'left',1);await mouse('mouseReleased',point.x,point.y,'left',0);
  await until('SolarTime.renderer.ringTour?.visualAge>=.75');
  const hide=await evaluate('(()=>{const r=SolarTime.renderer,t=r.ringTour;return {age:t.visualAge,opacity:t.annotationOpacity(),shared:r.ringTourReturnOpacity(),labels:r.labelStates.size};})()');
  assert.ok(hide.age<2&&hide.opacity>0&&hide.opacity<1);assert.equal(hide.opacity,hide.shared);assert.ok(hide.labels>0);
  await until('SolarTime.renderer.ringTour?.visualAge>=4');assert.equal(await evaluate('SolarTime.renderer.ringTour.annotationOpacity()'),0);
  console.log('ring QA: names and orbits fade out together over four seconds');
  await until("!!SolarTime.renderer.ringTour?.resources?.atlas");
  await until("SolarTime.renderer.ringTour?.state==='cruising'");
  console.log('ring QA: locator boarded');
  // Orbit-only particles start their soft reveal AFTER boarding.
  await until('SolarTime.renderer.ringTour?.age>=12');
  const grainFrames=await evaluate(`(()=>{
    const r=SolarTime.renderer,t=r.ringTour,canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;
    const context=canvas.getContext('2d'),age=t.age,pose=t.pose,counts=[];
    try{for(let lap=0;lap<=2;lap+=.25){
      t.age=age+lap*t.period;t.pose=t.cameraPose();context.clearRect(0,0,r.w,r.h);
      r.drawFlightParticles(context,t.flightField,(p,f,out)=>t.projectGrain(p,f,out,r.w,r.h));
      const pixels=context.getImageData(0,0,r.w,r.h).data;let lit=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>8)lit++;counts.push(lit);
    }}finally{t.age=age;t.pose=pose;}
    return counts;
  })()`);
  assert.ok(grainFrames.every(n=>n>50),JSON.stringify(grainFrames));
  console.log('ring QA: particles painted throughout two orbit laps',JSON.stringify(grainFrames));
  const report=await evaluate("(()=>{const r=SolarTime.renderer,t=r.ringTour;return {state:t.state,bytes:t.memoryUsage(),count:t.points.length/5,grains:t.flightField.points.length,near:t.nearCount,fog:t.fogCount,fogPool:t.fogPoints.length/5,period:t.period,sharedSprite:!!r.openingParticleSprite,drawCalls:t.drawCalls,sceneCalls:r.gpu.stats.drawCalls,visibleBodies:t.visibleBodies,error:r.gpu.gl.getError(),atlas:[t.atlasImage.naturalWidth,t.atlasImage.naturalHeight],proceduralDust:!t.fogImage&&!t.resources.fogAtlas,routeGrains:t.flightField.points.filter(p=>p.world&&!p.cameraLocal).length,pose:t.pose};})()");
  assert.equal(report.error,0);assert.equal(report.count,30000);assert.equal(report.grains,5000);assert.ok(report.drawCalls>=5&&report.drawCalls<=8);assert.deepEqual(report.atlas,[1024,512]);assert.equal(report.proceduralDust,true);assert.equal(report.routeGrains,5000);assert.equal(report.fogPool,10000);assert.ok(report.sharedSprite);
  const chips=await evaluate('(()=>{const t=SolarTime.renderer.ringTour;return {pool:t.chipPoints.length/5,visible:t.chipCount,triangles:t.resources.chipVertices/3};})()');
  assert.equal(chips.pool,10000);assert.equal(chips.triangles,6);assert.ok(chips.visible>0&&chips.visible<=10000);
  console.log('ring QA: procedural chip pool',JSON.stringify(chips));
  console.log('ring QA: visible instance budget',JSON.stringify({near:report.near,fog:report.fog}));
  const baselineArg=process.argv.indexOf('--ring-tour-baseline');
  if(baselineArg>=0)console.log('ring QA: simplified comparison',JSON.stringify(await require('./ring_tour_lite.cjs')(evaluate,process.argv[baselineArg+1])));
  assert.ok(report.near>0&&report.near<7500);assert.ok(report.fog>0&&report.fog<=10000);assert.ok(report.period>=115/6&&report.period<=170/6);
  assert.equal(await evaluate('SolarTime.renderer.ringTour.resources.meshVertices'),120);
  assert.equal(await evaluate('SolarTime.renderer.ringTour.resources.angularMeshVertices'),60);
  assert.equal(await evaluate('SolarTime.renderer.ringTour.resources.coarseMeshVertices'),30);
  assert.equal(await evaluate('SolarTime.renderer.ringTour.resources.angularCoarseMeshVertices'),30);
  const solidCounts=await evaluate('SolarTime.renderer.ringTour.instanceLayers.filter(layer=>layer.mesh).map(layer=>({angular:layer.mesh.startsWith("angular"),count:layer.count}))');
  const angularRatio=solidCounts.filter(l=>l.angular).reduce((n,l)=>n+l.count,0)/solidCounts.reduce((n,l)=>n+l.count,0);assert.ok(angularRatio>.6&&angularRatio<.8);
  assert.deepEqual(await evaluate('(()=>{const g=SolarTime.renderer.gpu.gl;return [g.getContextAttributes().depth,g.isEnabled(g.DEPTH_TEST),g.getParameter(g.DEPTH_WRITEMASK)];})()'),[true,false,true]);
  const atlasCounts=await evaluate('(()=>{const a=SolarTime.renderer.ringTour.points,c=Array(8).fill(0);for(let i=4;i<a.length;i+=5)c[Math.floor(a[i]*8)]++;return c;})()');
  assert.deepEqual(atlasCounts,Array(8).fill(3750));
  const image=path.join(os.tmpdir(),'solartime-ring-tour-local.png');
  const screen=await send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(image,Buffer.from(screen.data,'base64'));
  if(process.argv.includes('--ring-tour-lap')){
   const lap=await evaluate(`(()=>{
    const r=SolarTime.renderer,t=r.ringTour,g=r.gpu.gl,ext=t.resources.instances,draw=ext.drawArraysInstancedANGLE;
    const saved={age:t.age,angle:t.angle,pose:t.pose},sheet=document.createElement('canvas');sheet.width=1920;sheet.height=600;const c=sheet.getContext('2d');
    let first,last;try{
     ext.drawArraysInstancedANGLE=()=>{};
     for(let i=0;i<=8;i++){
      t.age=10+t.period*i/8;t.angle=t.entryAngle+t.age*Math.PI*2/t.period*t.direction;t.pose=t.cameraPose();
      r.gpu.begin();t.draw(r.gpu,r.w,r.h);r.gpu.end();
      if(i===0||i===8){const bytes=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,bytes);if(i===0)first=bytes;else last=bytes;}
      if(i<8){const x=(i%4)*480,y=Math.floor(i/4)*300;c.fillStyle='#080b10';c.fillRect(x,y,480,300);c.drawImage(g.canvas,x,y,480,300);c.fillStyle='white';c.font='16px sans-serif';c.fillText((i*45)+' degrees',x+12,y+24);}
     }
     let max=0,changed=0;for(let i=0;i<first.length;i++){const d=Math.abs(first[i]-last[i]);max=Math.max(max,d);if(d>1)changed++;}
     return {max,changed,image:sheet.toDataURL('image/png')};
    }finally{Object.assign(t,saved);ext.drawArraysInstancedANGLE=draw;}
   })()`);
   const lapFile=path.join(os.tmpdir(),'solartime-ring-lap.png');fs.writeFileSync(lapFile,Buffer.from(lap.image.split(',')[1],'base64'));
   console.log('ring QA: full lap',JSON.stringify({max:lap.max,changed:lap.changed,lapFile}));assert.ok(lap.changed<20);
  }
  const debris=await evaluate(fs.readFileSync(path.join(root,'tests/browser/ring_debris.js'),'utf8'));
  console.log('ring QA: debris depth and entry',JSON.stringify(debris));
  assert.equal(debris.error,0);assert.equal(debris.maxDifference,0);assert.ok(debris.minVisible>100);assert.ok(debris.entryVisible>100);
  for(const point of debris.lodOpacity)assert.ok(point.maximum>=200,'solid LOD must not blink while approaching or retreating: '+JSON.stringify(point));
  for(const band of debris.farBand){assert.ok(band.before>10,JSON.stringify(band));assert.equal(band.after,band.before,'entry must preserve distant ring opacity: '+JSON.stringify(band));}
  assert.ok(debris.nearBand.before>100);assert.equal(debris.nearBand.after,0,'only the near band hands off completely to debris');
  let previous=1;for(const band of debris.approachBand){
   assert.ok(band.before>100);const opacity=band.after/band.before;assert.ok(opacity<=previous);previous=opacity;
   if(band.height>=.6)assert.equal(band.after,band.before,'original ring waits for final approach');
  }
  assert.equal(previous,0);
  let restored=0;for(const band of debris.retreatBand){assert.ok(band.before>100);const opacity=band.after/band.before;assert.ok(opacity>=restored);restored=opacity;}
  assert.equal(debris.retreatBand[0].after,0);assert.equal(restored,1);
  assert.ok(debris.retreatBand[1].after<debris.retreatBand[1].before*.2,'retreat must not fill the disk immediately');
  const yaw=await evaluate('SolarTime.renderer.ringTour.yaw');
  await mouse('mousePressed',600,420,'left',1);await mouse('mouseMoved',680,450,'left',1);await mouse('mouseReleased',680,450,'left',0);
  assert.notEqual(await evaluate('SolarTime.renderer.ringTour.yaw'),yaw);
  const fov=await evaluate('SolarTime.renderer.ringTour.fov');
  await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:650,y:450,deltaX:0,deltaY:-80},session);
  assert.notEqual(await evaluate('SolarTime.renderer.ringTour.fov'),fov);
  assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),saved,'tour inputs do not mutate persisted overview pose');
  const surroundings=await evaluate(`(()=>{
    const r=SolarTime.renderer,t=r.ringTour,s=SolarTime.getState(),results={},saved={yaw:t.yaw,pitch:t.pitch};
    for(const id of ['sun','earth','jupiter','neptune']){
      t.yaw=0;t.pitch=0;t.advance(t.lastMono);
      const item=r.currentFrameItem(id),d=item.tourLocal.map((v,i)=>v-t.pose.eye[i]),dot=v=>v.reduce((n,x,i)=>n+x*d[i],0),x=dot(t.pose.right),y=dot(t.pose.up),z=dot(t.pose.forward);
      t.look(Math.atan2(x,z),Math.atan2(y,Math.hypot(x,z)));
      r.draw(s.simulationMs,s.effectTime,t.lastMono);results[id]=t.visibleBodies.includes(id);
    }
    t.yaw=saved.yaw;t.pitch=saved.pitch;r.draw(s.simulationMs,s.effectTime,t.lastMono);return results;
  })()`);
  assert.ok(Object.values(surroundings).every(Boolean),JSON.stringify(surroundings));
  console.log('ring QA: look controls checked');
  await evaluate('window.__lastTour=SolarTime.renderer.ringTour;void 0');
  await esc();await delay(300);
  assert.equal(await evaluate('SolarTime.renderer.ringTour.returnPrepared'),true,'normal view is prepared as soon as spiral retreat starts');
  assert.equal(await evaluate('SolarTime.renderer.physicsInterval'),1000);
  assert.ok(await evaluate('SolarTime.renderer.labelWidths.size>0&&SolarTime.renderer.gpu.orbitBuffers.has("satellite:moon")'));
  console.log('ring QA: return resources ready');
  await esc();await until("SolarTime.renderer.ringTour?.state==='returning'",6000);
  const angle=await evaluate('(()=>{const t=SolarTime.renderer.ringTour;return Math.atan2(t.pose.eye[2],t.pose.eye[0]);})()');await delay(250);
  assert.ok(await evaluate(`(()=>{const t=SolarTime.renderer.ringTour,a=Math.atan2(t.pose.eye[2],t.pose.eye[0])-${angle};return Math.atan2(Math.sin(a),Math.cos(a))*t.direction>0;})()`),'camera keeps rotating in the same direction during retreat');
  assert.ok(await evaluate('SolarTime.renderer.ringTour.returnDuration<=7'));
  await evaluate('SolarTime.renderer.ringTour.returnAge=Math.max(SolarTime.renderer.ringTour.returnAge,SolarTime.renderer.ringTour.returnDuration-.6)');
  await until('SolarTime.renderer.ringTour?.annotationReveal');
  const beforeArrival=await evaluate('(()=>{const r=SolarTime.renderer,t=r.ringTour;window.__revealDelays=r.openingOrbitDelays;return {remaining:t.returnDuration-t.returnAge,orbit:r.openingOrbitOpacity(performance.now()),name:r.openingLabelOpacity(performance.now()),alpha:r.ringTourReturnOpacity()};})()');
  assert.ok(beforeArrival.remaining>0&&beforeArrival.remaining<1&&beforeArrival.orbit>0);assert.equal(beforeArrival.name,0);assert.equal(beforeArrival.alpha,1);
  await esc();await until('!SolarTime.renderer.ringTour',10000);
  assert.equal(await evaluate('!!SolarTime.renderer.ringTour'),false);
  assert.equal(await evaluate('window.__lastTour.resources'),null);
  assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),saved,'automatic return restores original tracked Saturn view');
  assert.equal(await evaluate('SolarTime.renderer.camera.focus'),'saturn');
  const reveal=await evaluate('(()=>{const r=SolarTime.renderer;return [r.ringTourReturnOpacity(),r.openingLabelOpacity(performance.now())];})()');
  assert.equal(reveal[0],1);assert.ok(reveal[1]<.05,'names only start after their sweep');
  assert.equal(await evaluate('SolarTime.renderer.openingOrbitDelays===window.__revealDelays'),true,'arrival must not restart reveal');
  await until('SolarTime.renderer.openingLabelOpacity(performance.now(),"saturn")>.2');
  const fading=await evaluate('(()=>{const r=SolarTime.renderer;return {state:r.ringTour?"tour":"returned",opacity:r.openingLabelOpacity(performance.now(),"saturn"),orbit:r.openingOrbitOpacity(performance.now(),"saturn"),labels:r.labelStates.size,error:r.gpu.gl.getError()};})()');
  assert.equal(fading.state,'returned');assert.ok(fading.opacity>0&&fading.opacity<1);assert.equal(fading.orbit,1);assert.ok(fading.labels>0);assert.equal(fading.error,0);
  await until('performance.now()>=SolarTime.renderer.openingAnnotationStart+2500');
  console.log('ring QA: sweep begins before return arrival, then names fade in');
  await until("SolarTime.renderer.gpu.stats.drawCalls>2");assert.equal(await evaluate('SolarTime.renderer.gpu.gl.getError()'),0);
  for(let i=0;i<3;i++){
   await evaluate('SolarTime.renderer.startRingTour()');await until('!!SolarTime.renderer.ringTour?.resources?.atlas');
   await evaluate('SolarTime.renderer.endRingTour()');
  }
  await evaluate('(()=>{const r=SolarTime.renderer,home=r.defaultCameraSnapshot();r.restoreCamera({...home,zoom:.8,dolly:home.dolly*.35/.8});})()');await delay(250);
  const farPoint=await evaluate("(()=>{const r=SolarTime.renderer,p=r.currentFrameItem('saturn'),f=r.bodyFrame(p.body);for(let i=0;i<32;i++){const a=i*Math.PI/16,x=p.screen.x+p.r*1.77*(f.u.x*Math.cos(a)+f.v.x*Math.sin(a)),y=p.screen.y+p.r*1.77*(f.u.y*Math.cos(a)+f.v.y*Math.sin(a));if(r.ringTourHit(x,y))return {x,y,radius:p.r,focus:r.camera.focus};}throw Error('No distant ring hit');})()");
  assert.equal(farPoint.focus,null);assert.ok(farPoint.radius<20);
  await mouse('mouseMoved',farPoint.x,farPoint.y);assert.equal(await evaluate('SolarTime.renderer.ringTourHover'),true);
  await mouse('mousePressed',farPoint.x,farPoint.y,'left',1);await mouse('mouseReleased',farPoint.x,farPoint.y,'left',0);
  await until('!!SolarTime.renderer.ringTour');
  const directApproach=await evaluate('(()=>{const r=SolarTime.renderer,t=r.ringTour;return {local:!!t,tween:!!r.cameraTween,state:t?.state,entry:SolarRingTour.settings.entry,startDistance:t?.startDistance,eye:t?.pose.eye};})()');
  assert.equal(directApproach.local,true);assert.equal(directApproach.tween,false);assert.equal(directApproach.state,'entering');assert.equal(directApproach.entry,10);
  assert.ok(directApproach.startDistance>4,'the distant camera must follow the same full S route instead of centring Saturn first');
  await until('SolarTime.renderer.ringTour?.age>=5');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',code:'Digit0',windowsVirtualKeyCode:48},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'0',code:'Digit0',windowsVirtualKeyCode:48},session);
  assert.equal(await evaluate('SolarTime.renderer.ringTour?.state'),'returning');
  await until('SolarTime.renderer.ringTour?.returnTargetApplied');
  assert.equal(await evaluate('SolarTime.renderer.ringTour.returnMotion.rewind'),true,'cancel before docking retraces entry');
  const directHome=await evaluate('(()=>{const r=SolarTime.renderer,t=r.ringTour;return {focus:r.camera.focus,tween:!!r.cameraTween,direct:!!t.returnTo,different:Math.abs(t.returnTo.orthoScale-t.startPose.orthoScale)>.1,duration:t.returnDuration};})()');
  assert.ok(directHome.duration>=5);assert.deepEqual({...directHome,duration:5},{focus:null,tween:false,direct:true,different:true,duration:5});
  await evaluate('SolarTime.renderer.ringTour.returnAge=SolarTime.renderer.ringTour.returnDuration-.5');
  await until('!SolarTime.renderer.ringTour&&!SolarTime.renderer.cameraTween',15000);
  assert.equal(await evaluate('SolarTime.renderer.camera.focus'),null);
  console.log('ring QA: 0 during five-second entry backs out directly home');
  await checkSavedViews();
  await evaluate('SolarTime.renderer.animateFocus("saturn")');await until('!SolarTime.renderer.cameraTween');
  await evaluate('SolarTime.renderer.startRingTour()');await until('!!SolarTime.renderer.ringTour?.resources?.atlas');
  await evaluate('window.__lossExtension=SolarTime.renderer.gpu.gl.getExtension("WEBGL_lose_context");window.__lossExtension.loseContext()');
  await until('!SolarTime.renderer.ringTour');
  await evaluate('window.__lossExtension.restoreContext()');
  await until('!SolarTime.renderer.gpu.contextLost');assert.equal(await evaluate('SolarTime.renderer.gpu.gl.getError()'),0);
  return {...report,handoff,surroundings,fading,reveal,image,checks:['clicked ring target','shared opening painter + world-fixed route particles','eight sprite types split 50:50','fixed mesh/sprite representations','texture-free instanced dust','shared planet renderer + free look','GL state','mouse look + wheel','overview persistence','seven-second return + repeated ESC','opening sweep starts one second before arrival','saved-view keys 1/2/3 share Home exit and preserve lenses','3 repeated allocations/disposals']};
 }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});await new Promise(resolve=>server.close(resolve));}
};
