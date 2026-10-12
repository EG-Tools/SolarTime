'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
module.exports=async({evaluate,send,session,until})=>{
 if(process.argv.includes('--opening-return'))return require('./opening_return.cjs')({evaluate,send,session,until});
 const results=[];
 if(process.argv.includes('--handoff-actual'))await evaluate('SolarTime.renderer.setOption("actualScale",true,false)');
 if(process.argv.includes('--handoff-far'))await evaluate('SolarTime.renderer.restoreCamera({...SolarTime.renderer.cameraSnapshot(),zoom:.8,dolly:.001,mode:"move",focus:null})');
 for(const key of ['Escape','0']){
  await evaluate(`(()=>{const r=SolarTime.renderer,draw=r.draw,decorate=r.sky.decorate;window.__skyFrames=[];let count=0;r.sky.decorate=function(...args){count++;return decorate.apply(this,args);};r.draw=function(...args){count=0;const value=draw.apply(this,args);window.__skyFrames.push({tour:!!this.ringTour,state:this.ringTour?.state,count});return value;};window.__restoreSkyProbe=()=>{r.draw=draw;r.sky.decorate=decorate;};})()`);
  await until('SolarTime.renderer.canStartRingTour()');await evaluate('SolarTime.renderer.startRingTour()');
  await until(process.argv.includes('--return-early')?'SolarTime.renderer.ringTour?.age>2':'SolarTime.renderer.ringTour?.state==="cruising"');
  if(process.argv.includes('--return-profile'))await evaluate(`(()=>{
   const r=SolarTime.renderer,restore=[],events=[];window.__returnWork=events;
   for(const [owner,names] of [[r,['rebuild','prepareRingTourReturn','endRingTour','drawSolarScene','drawRingTourBodies','drawRingTourAnnotations','drawParticlePass']],[r.sky,['draw','decorate']],[r.gpu,['prepareOrbit','prepare','planet','begin']],[r.ringTour,['dispose','draw','visibleInstances','instanceCandidates','uploadInstances','prepareGrainRoute']]])for(const name of names){
    const fn=owner[name];if(typeof fn!=='function')continue;owner[name]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{const cost=performance.now()-start;if(cost>1)events.push({name,start,cost,age:r.ringTour?.returnAge});}};restore.push(()=>owner[name]=fn);
   }
   const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())events.push({name:'longtask',start:e.startTime,cost:e.duration});});observer.observe({type:'longtask'});
   window.__restoreReturnWork=()=>{observer.disconnect();restore.forEach(fn=>fn());};
  })()`);
  await evaluate(`(()=>{const r=SolarTime.renderer,draw=r.draw;window.__returnFrames=[];r.draw=function(...args){const at=performance.now(),result=draw.apply(this,args),t=this.ringTour;window.__returnFrames.push({at:args[2],cost:performance.now()-at,tour:!!t,age:t?.returnAge,pose:t?.pose,to:t?.returnTo,correction:t?.projection?.correction,correctionWeight:t?.projectionCorrectionWeight,sky:this.sky.axesNow,body:['sun','saturn','neptune'].map(id=>{const p=this.currentFrameItem(id);return {id,x:p.screen.x,y:p.screen.y,r:p.r};})});return result;};window.__restoreReturnProbe=()=>r.draw=draw;document.activeElement?.blur();})()`);
  try{
   await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key==='0'?'Digit0':'Escape'},session);
   await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key==='0'?'Digit0':'Escape'},session);
   await until('!SolarTime.renderer.ringTour&&!SolarTime.renderer.cameraTween');
   const frames=await evaluate('window.__returnFrames'),i=frames.findIndex(f=>!f.tour);
   const skyFrames=await evaluate('window.__skyFrames');
   for(const phase of ['entering','returning',undefined]){
    const samples=skyFrames.filter(f=>f.state===phase);assert.ok(samples.length,`capture ${phase||'normal'} sky`);
    assert.ok(samples.every(f=>f.count===1),`${key} ${phase||'normal'} must draw the same sky decoration exactly once each frame`);
   }
   assert.ok(i>0,'capture the final travel frame and first normal frame');
   const before=frames[i-1],after=frames[i],jumps=before.body.map((b,n)=>({id:b.id,pixels:Math.hypot(after.body[n].x-b.x,after.body[n].y-b.y),sizeRatio:after.body[n].r/b.r}));
   for(const jump of jumps){assert.ok(jump.pixels<.25,`${key} ${jump.id} moved ${jump.pixels}px at handoff`);assert.ok(Math.abs(jump.sizeRatio-1)<.01,`${key} ${jump.id} changed scale: ${jump.sizeRatio}`);}
   const artifact=path.join(os.tmpdir(),'solartime-return-'+key+(process.argv.includes('--handoff-far')?'-far':'')+'.json');fs.writeFileSync(artifact,JSON.stringify(frames));
   const work=process.argv.includes('--return-profile')?await evaluate('window.__returnWork'):[];
   fs.writeFileSync(artifact.replace('.json','-work.json'),JSON.stringify(work));
   const gaps=frames.slice(1).map((f,n)=>({gap:f.at-frames[n].at,age:f.age,cost:f.cost})).sort((a,b)=>b.gap-a.gap).slice(0,5);
   results.push({key,frames:frames.length,jumps,maxCost:Math.max(...frames.map(f=>f.cost)),gaps,slowWork:work.sort((a,b)=>b.cost-a.cost).slice(0,15),artifact});
  }finally{await evaluate('window.__restoreReturnProbe();window.__restoreSkyProbe();window.__restoreReturnWork?.()');}
 }
 return results;
};
