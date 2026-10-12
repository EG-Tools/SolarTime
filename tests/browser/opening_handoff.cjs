'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
module.exports=async({evaluate,send,session,until,coldUrl})=>{
 const camera=coldUrl?null:await evaluate('SolarTime.renderer.defaultCameraSnapshot()');
 if(camera&&process.argv.includes('--handoff-far'))camera.dolly=.001;
 const source=`(()=>{
 let seed=0x1a2b3c4d;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 localStorage.setItem('eg.solar-time.v0.01',JSON.stringify({actualScale:${process.argv.includes('--handoff-actual')},...(${JSON.stringify(camera)}?{camera:${JSON.stringify(camera)},overviewCamera:${JSON.stringify(camera)}}:{}),cameraControlVersion:4}));
 localStorage.setItem('solar-time.opening-mode.v1',JSON.stringify('saturn'));
 window.__handoffProbe={frames:[],handoff:null,tasks:[],gpu:[]};
 new PerformanceObserver(list=>{for(const e of list.getEntries())window.__handoffProbe.tasks.push({at:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
 for(const name of ['compileShader','linkProgram','texImage2D','texSubImage2D','generateMipmap']){const original=WebGLRenderingContext.prototype[name];WebGLRenderingContext.prototype[name]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{const duration=performance.now()-at;if(duration>1){const image=args.at(-1);window.__handoffProbe.gpu.push({name,at,duration,width:image?.width,height:image?.height,src:image?.src,stack:new Error().stack});}}};}
 const timer=setInterval(()=>{
  if(!window.SolarRenderer)return;clearInterval(timer);const R=SolarRenderer.prototype,p=window.__handoffProbe,draw=R.draw,start=R.startRingTourNow;
  R.startRingTourNow=function(...args){const began=performance.now();p.handoff={at:began,captured:this.openingFlight,prepared:!!this.preparedRingTour?.preparationReady,warmed:!!this.preparedRingTour?.resources?.warmed};const result=start.apply(this,args);p.handoff.cost=performance.now()-began;return result;};
  R.draw=function(...args){const begin=performance.now(),result=draw.apply(this,args);if(p.frames.length<1600){const t=this.ringTour,s=this.currentFrameItem('saturn'),n=this.currentFrameItem('neptune');p.frames.push({at:args[2],cost:performance.now()-begin,age:t?.age,eye:t?.pose.eye,saturn:s?{x:s.screen.x,y:s.screen.y,r:s.r}:null,neptune:n?{x:n.screen.x,y:n.screen.y,r:n.r}:null,pose:this.sky?.axesNow});}return result;};
 },0);
 })()`;
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source},session);
 try{
  if(coldUrl){await send('Network.clearBrowserCache',{},session);await send('Page.navigate',{url:coldUrl},session);}else
  await send('Page.reload',{ignoreCache:true},session);
  await until('!!window.SolarTime?.renderer?.ringTour&&SolarTime.renderer.ringTour.age>4.2',45000);
  const result=await evaluate('window.__handoffProbe');
  const i=result.frames.findIndex(f=>Number.isFinite(f.age));
  assert.ok(i>=2,'capture frames on both sides of the real app handoff');
  const before=result.frames[i-2],last=result.frames[i-1],after=result.frames[i];
  const rate=(a,b,key)=>b.pose[key].map((v,n)=>(v-a.pose[key][n])*1000/(b.at-a.at));
  const incoming=rate(before,last,'forward'),outgoing=rate(last,after,'forward');
  const impulse=Math.hypot(...outgoing.map((v,n)=>v-incoming[n]));
  assert.ok(impulse<Math.max(.03,Math.hypot(...incoming)*.25),`camera direction must retain incoming speed: ${impulse}`);
  const settled=await evaluate(`(()=>{const t=SolarTime.renderer.ringTour,a=t.openingPose(4.2),b=t.rawEntryPose(4.2);return ['eye','forward','up','offset'].every(key=>a[key].every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[key][i])<1e-9));})()`);
  assert.ok(settled,'opening carry must leave the ring approach untouched, even from maximum distance');
  const artifact=path.join(os.tmpdir(),'solartime-opening-handoff'+(coldUrl?'-cold':'')+(process.argv.includes('--handoff-actual')?'-actual':'')+(process.argv.includes('--handoff-far')?'-far':'')+'.json');
  fs.writeFileSync(artifact,JSON.stringify(result));
  assert.equal(await evaluate('SolarTime.renderer.gpu.gl.getError()'),0);
  const near=result.frames.filter(f=>Math.abs(f.at-result.handoff.at)<1200),maxGap=Math.max(...near.slice(1).map((f,i)=>f.at-near[i].at));
  return {cold:!!coldUrl,frames:result.frames.length,prepared:result.handoff.prepared,warmed:result.handoff.warmed,startCostMs:result.handoff.cost,maxGap,directionVelocityImpulse:impulse,settledBeforeRing: settled,slowGpu:result.gpu.filter(e=>Math.abs(e.at-result.handoff.at)<1200),tasks:result.tasks.filter(e=>Math.abs(e.at-result.handoff.at)<1200),artifact};
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier},session);}
};
