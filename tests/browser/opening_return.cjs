'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
module.exports=async({evaluate,send,session,until})=>{
 const home=await evaluate('SolarTime.renderer.defaultCameraSnapshot()'),reports=[];
 for(const key of ['0','Escape']){
  const source=`localStorage.setItem('eg.solar-time.v0.01',JSON.stringify({camera:${JSON.stringify({...home,dolly:.001})},cameraControlVersion:4,actualScale:${process.argv.includes('--handoff-actual')}}));localStorage.setItem('solar-time.opening-mode.v1',JSON.stringify('saturn'));`;
  const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source},session);
  await send('Page.reload',{ignoreCache:true},session);
  await until('window.SolarTime?.renderer.ringTour?.state==="cruising"',45000);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier},session);
  await evaluate(`(()=>{const r=SolarTime.renderer,draw=r.draw;window.__samples=[];r.draw=function(...args){const result=draw.apply(this,args),t=this.ringTour,p=t?.projection;window.__samples.push({at:args[2],age:t?.returnAge,duration:t?.returnDuration,pose:t?.pose,to:t?.returnTo,unit:t?.startPose.orthoScale,correction:p?.correction,weight:t?.projectionCorrectionWeight,body:this.frameBodies.map(b=>({id:b.body.id,x:b.screen.x,y:b.screen.y,r:b.r}))});return result;};document.activeElement?.blur();})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key==='0'?'Digit0':'Escape'},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key==='0'?'Digit0':'Escape'},session);
  await until('SolarTime.renderer.ringTour?.returnAge>SolarTime.renderer.ringTour?.returnDuration*.45');
  const image=await send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(path.join(os.tmpdir(),'solar-opening-return-'+key+'.png'),Buffer.from(image.data,'base64'));
  await until('!SolarTime.renderer.ringTour&&!SolarTime.renderer.cameraTween',45000);
  const samples=await evaluate('window.__samples'),file=path.join(os.tmpdir(),'solar-opening-return-'+key+'.json');fs.writeFileSync(file,JSON.stringify(samples));
  const end=samples.findIndex((f,i)=>i>0&&!f.pose&&samples[i-1].pose);assert.ok(end>0);
  for(const id of ['sun','saturn','neptune']){
   const a=samples[end-1].body.find(b=>b.id===id),b=samples[end].body.find(b=>b.id===id);
   assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<.25,`${key}: ${id} final position`);assert.ok(Math.abs(b.r/a.r-1)<.01,`${key}: ${id} final radius`);
  }
  const checkpoints=[.1,.3,.5,.7,.9,.999].map(p=>{const f=samples.find(f=>f.age/f.duration>=p)||samples.at(-1);return {p,age:f.age,unit:f.unit,ortho:f.pose?.orthoScale,perspective:f.pose?.perspective,body:f.body.filter(b=>['sun','saturn','neptune'].includes(b.id))};});
  reports.push({key,file,checkpoints});
 }
 return reports;
};
