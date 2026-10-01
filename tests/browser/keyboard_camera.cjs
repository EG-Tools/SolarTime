'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

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
 async function ready(){
  const end=Date.now()+40000;let target=null;
  while(true){
   const state=await evaluate(`(()=>{const r=window.SolarTime?.renderer;return {ready:!!r&&!SolarTime.getState().opening,target:r?.cameraTween?.timing==='opening'?r.cameraTween.to:null};})()`);
   if(state.target)target=state.target;if(state.ready)return target;
   if(Date.now()>end)throw Error('Keyboard camera app did not become ready');await delay(50);
  }
 }
 const key=(key,type)=>send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:key==='ArrowUp'?38:40},session);
 const snapshot=()=>evaluate(`({camera:SolarTime.renderer.cameraSnapshot(),saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).camera})`);
 const equalCamera=(a,b)=>{for(const name of ['azimuth','elevation','zoom','dolly','panX','panY'])assert.ok(Math.abs(a[name]-b[name])<1e-8,name+': '+a[name]+' != '+b[name]);assert.equal(a.focus,b.focus);assert.equal(a.mode,b.mode);};
 async function reload(expected){await send('Page.reload',{},session);await ready();equalCamera((await snapshot()).camera,expected);}
 try{
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);
  await send('Page.navigate',{url},session);const firstTarget=await ready();
  const home=await evaluate('SolarTime.renderer.defaultCameraSnapshot()');
  equalCamera(firstTarget,home);assert.equal(await evaluate('SolarTime.renderer.rotationIntent'),1,'new users retain automatic rotation');
  await evaluate(`SolarTime.renderer.stopAutoRotate();document.getElementById('cookie-reject').click();document.activeElement?.blur()`);
  const cases=['first opening targets the user-framed home; automatic rotation remains on'];
  for(const control of ['0','toolbar']){
   await evaluate(`SolarTime.renderer.restoreCamera({...SolarTime.renderer.defaultCameraSnapshot(),azimuth:2,elevation:.7,dolly:3,focus:'earth'});document.activeElement?.blur()`);
   if(control==='0'){
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',code:'Digit0',windowsVirtualKeyCode:48},session);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'0',code:'Digit0',windowsVirtualKeyCode:48},session);
   }else await evaluate(`document.getElementById('fit-view').click()`);
   equalCamera(await evaluate('SolarTime.renderer.cameraTween.to'),home);
   const end=Date.now()+5000;while(await evaluate('!!SolarTime.renderer.cameraTween')){assert.ok(Date.now()<end,'home transition must finish');await delay(50);}
   equalCamera((await snapshot()).camera,home);cases.push(control+' returns to the shared home');
  }
  for(const direction of ['ArrowUp','ArrowDown']){
   const before=await snapshot();await key(direction,'keyDown');await delay(250);await key(direction,'keyUp');
   const after=await snapshot();assert.ok(direction==='ArrowUp'?after.camera.dolly>before.camera.dolly:after.camera.dolly<before.camera.dolly);
   equalCamera(after.saved,after.camera);await reload(after.camera);cases.push(direction+' release + reload');
  }
  // A quick tap must save even when no animation frame fits between key events.
  const tap=await evaluate(`(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',code:'ArrowUp',bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',code:'ArrowUp',bubbles:true}));return {camera:SolarTime.renderer.cameraSnapshot(),saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).camera};})()`);
  equalCamera(tap.saved,tap.camera);cases.push('quick tap');
  await key('ArrowDown','keyDown');await delay(150);await evaluate(`window.dispatchEvent(new Event('blur'))`);
  const blurred=await snapshot();equalCamera(blurred.saved,blurred.camera);await delay(100);equalCamera((await snapshot()).camera,blurred.camera);
  await key('ArrowDown','keyUp');await reload(blurred.camera);cases.push('blur without keyup + reload');
  // Record only the pose at departure, never save app preferences from the test.
  await evaluate(`window.addEventListener('pagehide',()=>sessionStorage.setItem('__keyboardCameraAtReload',JSON.stringify(SolarTime.renderer.cameraSnapshot())),{once:true})`);
  await key('ArrowUp','keyDown');await delay(150);await send('Page.reload',{},session);await ready();
  const departure=await evaluate(`JSON.parse(sessionStorage.getItem('__keyboardCameraAtReload'))`);
  assert.ok(departure.dolly>blurred.camera.dolly);equalCamera((await snapshot()).camera,departure);cases.push('reload while held');
  // Native range-input arrow keys must remain separate from camera travel.
  const beforeEditing=await snapshot();
  await evaluate(`document.getElementById('settings-button').click();document.getElementById('star-density').focus()`);
  await key('ArrowDown','keyDown');await key('ArrowDown','keyUp');equalCamera((await snapshot()).camera,beforeEditing.camera);cases.push('focused slider leaves camera unchanged');
  // Capture the synchronous reset pose at the shared renderer entry point,
  // before its intentionally enabled auto-rotation advances the next frame.
  await evaluate(`(()=>{const r=SolarTime.renderer,restore=r.restoreCamera;r.restoreCamera=function(pose){const result=restore.call(this,pose);window.__resetCameraPose=this.cameraSnapshot();return result;};document.getElementById('reset-defaults').click();document.getElementById('reset-defaults-yes').click();})()`);
  const resetEnd=Date.now()+10000;while(!await evaluate('!!window.__resetCameraPose')){assert.ok(Date.now()<resetEnd,'factory reset must complete');await delay(50);}
  equalCamera(await evaluate('window.__resetCameraPose'),home);assert.equal(await evaluate('SolarTime.renderer.rotationIntent'),1,'reset retains automatic rotation');
  equalCamera((await snapshot()).saved,home);cases.push('factory reset shares home and enables rotation');
  return {cases,home};
 }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
};
