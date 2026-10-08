'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

module.exports=async({root,evaluate,send,session})=>{
 const server=http.createServer((req,res)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/',delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function waitFor(expression){const end=Date.now()+40000;while(!await evaluate(expression)){if(Date.now()>end)throw Error('Timed out: '+expression);await delay(50);}}
 const ready=()=>waitFor('!!window.SolarTime&&!SolarTime.getState().opening');
 const settled=()=>waitFor('!SolarTime.renderer.actualScaleTween&&!SolarTime.renderer.cameraTween&&!SolarTime.renderer.orbitSpacingTween');
 const snapshot=()=>evaluate(`(()=>{const r=SolarTime.renderer,input=document.getElementById('overview-orbit-gap');return {actual:r.options.actualScale,lens:r.gpuOrbitCamera().lens,spacing:r.actualOrbitSpacing(),ordinary:r.options.overviewOrbitGap,min:input.min,max:input.max,value:input.value,output:document.getElementById('overview-orbit-gap-output').textContent,saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01'))?.actualOrbitSpacing};})()`);
 const setGap=value=>evaluate(`(()=>{const input=document.getElementById('overview-orbit-gap');input.value=${Number(value)};input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return {value:SolarTime.renderer.displayedOrbitSpacing(),duration:SolarTime.renderer.orbitSpacingTween?.duration};})()`);
 const layout=()=>evaluate(`(()=>{const r=SolarTime.renderer;return r.paths.map(path=>path.points.filter((_,i)=>i%90===0).map(p=>{const q=r.project(r.displaySolarPoint(p,path.body));return {x:q.x,y:q.y,behind:q.behind};}));})()`);
 try{
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},session);
  await send('Page.navigate',{url},session);await ready();
  await evaluate(`(async()=>{await SolarTime.setLanguage('kor');SolarTime.renderer.stopAutoRotate();document.getElementById('cookie-reject').click();document.getElementById('settings-button').click();})()`);
  assert.equal((await snapshot()).spacing,0,'new users start at 0% actual orbit spacing');
  assert.equal((await snapshot()).ordinary,100);assert.equal((await snapshot()).output,'100%');
  const defaultSizes=await evaluate('SolarTime.renderer.getBodyScales()');
  assert.equal(Object.keys(defaultSizes).length,12);assert.ok(Object.values(defaultSizes).every(value=>value===1),'new users start with all bodies at 100%');
  assert.equal((await snapshot()).lens,1,'normal view must not stretch the horizontal axis');
  await setGap(173);await delay(100);const ordinaryUndistorted=await layout();
  const normalFile=path.join(os.tmpdir(),'solartime-normal-circular-orbits.png'),normalImage=await send('Page.captureScreenshot',{format:'png'},session);
  fs.writeFileSync(normalFile,Buffer.from(normalImage.data,'base64'));
  await evaluate(`document.getElementById('actual-scale').click()`);await settled();
  const full=await snapshot();assert.equal(full.min,'0');assert.equal(full.max,'100');assert.equal(full.value,'0');assert.equal(full.lens,1);
  await setGap(0);await settled();const zero=await snapshot(),actual=await layout();
  assert.equal(zero.spacing,0);assert.equal(zero.saved,0);assert.equal(zero.output,'0%');assert.equal(zero.lens,1);
  let error=0;for(let i=0;i<actual.length;i++)for(let j=0;j<actual[i].length;j++){
   const a=actual[i][j],b=ordinaryUndistorted[i][j];assert.equal(a.behind,b.behind);if(!a.behind)error=Math.max(error,Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  }
  assert.ok(error<.01,'0% must retain normal orbit distances without horizontal lens stretch: '+error);
  // The UI/persisted target changes immediately; the rendered spacing follows.
  const easing=await setGap(10);
  assert.equal(easing.duration,100);assert.ok(easing.value<.1);assert.equal((await snapshot()).saved,.1);
  await settled();assert.equal(await evaluate('SolarTime.renderer.displayedOrbitSpacing()'),.1);
  assert.ok(Math.abs(await evaluate('SolarTime.renderer.orbitScaleMix()')-.01)<1e-9);
  for(const percent of [5,0,10]){
   await setGap(percent);await settled();
   assert.ok(Math.abs(await evaluate('SolarTime.renderer.orbitScaleMix()')-percent/1000)<1e-9);
   assert.equal((await snapshot()).lens,1);
  }
  for(const percent of [100,40]){
   const transition=await evaluate(`(()=>{const r=SolarTime.renderer,before=r.displayedOrbitSpacing(),input=document.getElementById('overview-orbit-gap');input.value=${percent};input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return {before,value:r.displayedOrbitSpacing(),duration:r.orbitSpacingTween?.duration};})()`);
   assert.equal(transition.duration,70);assert.ok(Math.abs(transition.value-percent/100)>1e-5);
   assert.ok(Math.abs(transition.value-transition.before)<Math.abs(percent/100-transition.before));
   await settled();assert.equal(await evaluate('SolarTime.renderer.displayedOrbitSpacing()'),percent/100);assert.equal((await snapshot()).lens,1);
  }
  await setGap(0);await settled();
  await send('Page.reload',{},session);await ready();const restored=await snapshot();
  assert.equal(restored.actual,true);assert.equal(restored.spacing,0);assert.equal(restored.value,'0');assert.equal(restored.ordinary,173);
  await evaluate(`document.getElementById('settings-button').click();document.getElementById('actual-scale').click()`);await settled();
  assert.equal((await snapshot()).value,'173');assert.equal((await snapshot()).output,'173%');
  await evaluate(`document.getElementById('actual-scale').click()`);await settled();assert.equal((await snapshot()).value,'0');
  const rotationRoundTrips=[];
  for(const mode of [0,-1,1,'random']){
   await evaluate(`(()=>{const r=SolarTime.renderer;r.stopAutoRotate();r.setOption('actualScale',false,false);r.restoreCamera({...r.defaultCameraSnapshot(),zoom:1.4,dolly:1.7,panX:.06,panY:.1});if(${JSON.stringify(mode)}==='random')r.setRandomRotate(true);else r.setAutoRotate(${JSON.stringify(mode)});})()`);
   for(let i=0;i<3;i++){
    await evaluate(`document.getElementById('camera-mode-toggle').click()`);
    await delay(150);
    const report=await evaluate(`(()=>{const r=SolarTime.renderer,before=r.cameraSnapshot(),motion=r.autoRotation;document.getElementById('camera-mode-toggle').click();return {before,after:r.cameraSnapshot(),sameMotion:r.autoRotation===motion,tween:!!r.cameraTween,rotation:r.rotationIntent};})()`);
    assert.deepEqual(report.after,report.before,'scale toggle must not change any camera coordinate');
    assert.equal(report.sameMotion,true,'scale toggle must keep the existing rotation timeline');
    assert.equal(report.tween,false,'no camera return/rewind for a scale-only round trip');
   }
   rotationRoundTrips.push(mode);
  }
  const manualCameraPreserved=[];
  for(const control of ['toolbar','settings','keyboard']){
   const report=await evaluate(`(()=>{
    const r=SolarTime.renderer,button=document.getElementById('camera-mode-toggle');r.stopAutoRotate();r.setOption('actualScale',false,false);
    const normal={...r.defaultCameraSnapshot(),azimuth:2.1,elevation:.51,zoom:1.4,dolly:1.7,panX:.06,panY:.1};
    r.restoreCamera(normal);button.click();
    r.restoreCamera({...normal,azimuth:1.8,elevation:.63,zoom:.8,dolly:.002,panX:.3,panY:-.1,focus:${JSON.stringify(control==='settings'?'earth':null)}});
    const moved=r.cameraSnapshot();
    if(${JSON.stringify(control)}==='toolbar')button.click();
    else if(${JSON.stringify(control)}==='settings')document.getElementById('actual-scale').click();
    else document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'+',code:'Equal',bubbles:true,cancelable:true}));
    const saved=JSON.parse(localStorage.getItem('eg.solar-time.v0.01'));
    return {moved,after:r.cameraSnapshot(),saved:saved.camera,actual:r.options.actualScale,tween:!!r.cameraTween,obsoleteSavedCamera:'normalViewCamera' in saved};
   })()`);
   assert.equal(report.actual,false,control+' must switch to normal');assert.equal(report.tween,false);assert.equal(report.obsoleteSavedCamera,false);
   assert.deepEqual(report.after,report.moved,control+' must preserve the moved camera, including focus');
   assert.deepEqual(report.saved,report.moved,control+' must persist the moved camera');
   await settled();assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),report.moved);
   manualCameraPreserved.push(control);
  }
  // Toggling the layout mid-wheel motion must not replace its current tween.
  const inputMotion=await evaluate(`(()=>{
   const r=SolarTime.renderer,button=document.getElementById('camera-mode-toggle');button.click();
   const destination={...r.cameraSnapshot(),dolly:.004};r.animateCamera(destination,performance.now(),250,true);
   const tween=r.cameraTween,before=r.cameraSnapshot();button.click();
   return {before,after:r.cameraSnapshot(),destination,sameTween:r.cameraTween===tween,saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).camera};
  })()`);
  assert.equal(inputMotion.sameTween,true);assert.deepEqual(inputMotion.after,inputMotion.before);assert.deepEqual(inputMotion.saved,inputMotion.destination);
  await settled();assert.deepEqual(await evaluate('SolarTime.renderer.cameraSnapshot()'),inputMotion.destination);
  await send('Page.reload',{},session);await ready();
  const reloadCamera=await evaluate('SolarTime.renderer.cameraSnapshot()');
  for(const key of ['azimuth','elevation','zoom','dolly','panX','panY'])assert.ok(Math.abs(reloadCamera[key]-inputMotion.destination[key])<1e-8,key+' must survive reload');
  assert.equal(reloadCamera.focus,inputMotion.destination.focus);assert.equal(reloadCamera.mode,inputMotion.destination.mode);
  // Restore only the test's framing for a useful UI screenshot.
  await evaluate(`SolarTime.renderer.restoreCamera(SolarTime.renderer.defaultCameraSnapshot());document.getElementById('settings-button').click();document.getElementById('camera-mode-toggle').click()`);await settled();
  // Capture both the readable footer and the 0% control in a private test tab.
  const footer=await evaluate(`(()=>{const children=[...document.querySelector('.signature').children];return children.map(e=>({text:e.textContent.trim(),y:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}));})()`);
  const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version;
  assert.equal(footer[0].text,'Solar Time v'+version);assert.equal(footer[1].text,'Lyrikey@Naver.com');assert.ok(footer[footer.length-1].text.startsWith('©'));
  for(let i=1;i<footer.length;i++)assert.ok(footer[i].y>=footer[i-1].bottom-1,'footer lines overlap');
  const file=path.join(os.tmpdir(),'solartime-local-orbit-spacing.png');
  const image=await send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(file,Buffer.from(image.data,'base64'));
  // Use the real confirmation flow after changing every body (including Sun,
  // Pluto and moons). Reset works from actual mode, which locks size sliders.
  await evaluate(`(()=>{const r=SolarTime.renderer;r.setBodyScales(Object.fromEntries(r.allBodies().map((body,i)=>[body.id,1.2+i*.04])));document.getElementById('reset-defaults').click();document.getElementById('reset-defaults-yes').click();})()`);
  await waitFor(`Object.values(SolarTime.renderer.getBodyScales()).every(value=>value===1)&&Object.values(JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).bodyScales).every(value=>value===1)`);
  const resetSpacing=await snapshot();assert.equal(resetSpacing.spacing,0);assert.equal(resetSpacing.saved,0);assert.equal(resetSpacing.actual,false);assert.equal(resetSpacing.ordinary,100);assert.equal(resetSpacing.value,'100');assert.equal(resetSpacing.output,'100%');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).overviewOrbitGap`),100);
  const resetSizes=await evaluate(`(()=>{const r=SolarTime.renderer,rows=[],sun=r.bodyRadiusAtZoom(SolarAstro.SUN);for(const body of r.allBodies()){document.querySelector('#planet-nav [data-body="'+body.id+'"]').click();rows.push({id:body.id,scale:r.bodySizeScale(body),ratio:r.bodyRadiusAtZoom(body)/sun,value:document.getElementById('body-size-slider').value,label:document.getElementById('body-size-output').textContent});}return rows;})()`);
  const sizeRatios={sun:1,mercury:.25,venus:.25,earth:.25,mars:.25,jupiter:.5,saturn:.5,uranus:.5,neptune:.5,moon:.0625,pluto:.0625,europa:.125};
  assert.equal(resetSizes.length,12);for(const row of resetSizes){assert.equal(row.scale,1,row.id);assert.equal(row.value,'100',row.id);assert.equal(row.label,'100%',row.id);assert.ok(Math.abs(row.ratio-sizeRatios[row.id])<1e-8,row.id+' reset ratio');}
  const resetOrbitRadii=await evaluate(`SolarAstro.BODIES.map(body=>SolarTime.renderer.overviewSolarRadius(body.base[0],body))`);
  for(let i=1;i<resetOrbitRadii.length;i++)assert.ok(Math.abs(resetOrbitRadii[i]-resetOrbitRadii[i-1]-150)<1e-8,'100% reset spacing is the previous 150%');
  await send('Page.reload',{},session);await ready();assert.deepEqual(await evaluate('SolarTime.renderer.getBodyScales()'),defaultSizes,'reset sizes survive reload');
  assert.equal((await snapshot()).ordinary,100);assert.equal((await snapshot()).output,'100%');
  const bodySizeControls=await require('./body_size_controls.cjs')({evaluate,send,session,ready,waitFor});
  return {default:full.spacing,minimum:zero.value,restored:restored.value,ordinary:restored.ordinary,projectionError:error,rotationRoundTrips,manualCameraPreserved,inputMotionPreserved:true,movedCameraRestoredAfterReload:true,resetSizes,bodySizeControls,footer:footer.map(v=>v.text),normalFile,file};
 }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
};
