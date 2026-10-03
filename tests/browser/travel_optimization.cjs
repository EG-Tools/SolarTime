'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({root,evaluate,until,esc})=>{
 if(process.argv.includes('--optimization58'))return require('./travel_optimization58.cjs')({root,evaluate,until,esc});
 const baseline=process.env.SOLAR_TRAVEL_BASELINE;
 if(!baseline)throw Error('Set SOLAR_TRAVEL_BASELINE to the local pre-edit source directory.');
 for(const [file,name] of [['ring-tour.js','SolarRingTour'],['renderer.js','SolarRenderer']]){
  const source=fs.readFileSync(path.join(baseline,file),'utf8');
  await evaluate('(()=>{const current=window.'+name+';try{(0,eval)('+JSON.stringify(source)+');window.__before'+name+'=window.'+name+';}finally{window.'+name+'=current;}})()');
 }
 await evaluate("SolarTime.renderer.animateFocus('saturn')");
 await until('SolarTime.renderer.canStartRingTour()');
 const start=await evaluate("(()=>{const r=SolarTime.renderer,at=performance.now();if(!r.startRingTour())throw Error('start failed');return {ms:performance.now()-at,deferred:!r.ringTour.preparationReady};})()");
 assert.ok(start.deferred);
 await until('SolarTime.renderer.ringTour?.preparationReady&&SolarTime.renderer.ringTour.resources?.ready');
 assert.equal(await evaluate('SolarTime.renderer.gpu.gl.getError()'),0);
 await esc();await until('!SolarTime.renderer.ringTour');
 await evaluate('SolarTime.renderer.prepareOpeningTour()');
 assert.equal(await evaluate('!!SolarTime.renderer.preparedRingTour&&!SolarTime.renderer.preparedRingTour.preparationReady'),true);
 // Prepared opening resources progress on the app frame loop while the scene is idle.
 await until('SolarTime.renderer.preparedRingTour?.preparationReady&&SolarTime.renderer.preparedRingTour.resources?.ready');
 const preparation=await evaluate('(async()=>{const r=SolarTime.renderer,p=r.currentFrameItem("saturn"),options={frame:r.bodyFrame(p.body),radius:p.r,width:r.w,height:r.h,screen:p.screen,seed:123,grainStyle:rand=>r.flightParticleStyle(rand)},times=[];let old;const at=performance.now();old=new __beforeSolarRingTour(options);const before=performance.now()-at;const next=new SolarRingTour({...options,deferPreparation:true});const begun=performance.now();while(!next.preparationReady){const t=performance.now();next.advancePreparation(3);times.push(performance.now()-t);await new Promise(requestAnimationFrame);}const elapsed=performance.now()-begun;const stats={beforeBlockingMs:before,maxChunkMs:Math.max(...times),medianChunkMs:[...times].sort((a,b)=>a-b)[Math.floor(times.length/2)],chunks:times.length,elapsedMs:elapsed};old.dispose();next.dispose();return stats;})()');
 const report=await evaluate('('+measure.toString()+')()');
 assert.ok(report.ring.every(s=>s.same));assert.ok(report.warp.every(s=>s.same));
 assert.ok(report.ring.some(s=>s.checksAfter<s.checksBefore*.5));
 assert.equal(report.error,0);
 // Cancelling before the first preparation slice releases the pending generator.
 const cancel=await evaluate('(()=>{const r=SolarTime.renderer;r.clearPreparedTour();if(!r.startRingTour())throw Error("cancel start failed");const t=r.ringTour;r.endRingTour();return t.disposed&&t.preparation===null&&t.points.length===0;})()');
 assert.ok(cancel);
 return {manualStart:start,preparation,...report,cancelledPreparation:true};
};
function measure(){
 const r=SolarTime.renderer,T=SolarRingTour,Old=__beforeSolarRingTour,p=r.currentFrameItem('saturn');
 const options={frame:r.bodyFrame(p.body),radius:200,width:r.w,height:r.h,screen:{x:r.w/2,y:r.h/2},seed:123,grainStyle:rand=>r.flightParticleStyle(rand)};
 const old=new Old(options),next=new T(options),near=(a,b)=>Math.abs(a-b)<1e-7;
 const bench=fn=>{for(let i=0;i<5;i++)fn();const samples=[];for(let s=0;s<5;s++){const at=performance.now();for(let i=0;i<20;i++)fn();samples.push((performance.now()-at)/20);}return samples.sort((a,b)=>a-b)[2];};
 const frame=(t,optimized)=>{
  t.pose=t.cameraPose();t.prepareGrainRoute();
  const frustum=t.instanceFrustum(r.w,r.h),focal=r.h/(2*Math.tan(t.pose.fov*Math.PI/360));
  let checks=0,visible=0;
  for(const layer of t.instanceLayers){
   const count=t.visibleInstances(layer.points,layer.fog?1.85:2.92,t.instanceData,t.instanceOrder,layer.indices,!!layer.mesh||!!layer.fog||!!layer.chips,frustum,layer.lod===undefined?null:{level:layer.lod,focal});
   visible+=count;checks+=optimized?t.instanceChecks:layer.indices.length;
  }
  const cache=optimized?t.grainProjection(r.w,r.h):undefined,out={};
  if(t.flightField.alpha>0)for(const particle of t.flightField.points)t.projectGrain(particle,t.flightField,out,r.w,r.h,cache);
  return {checks,visible};
 };
 const ring=[];
 for(const [name,age] of [['start',1],['landing',10],['cruise',18],['exit',24]]){
  for(const t of [old,next]){
   t.age=age;t.visualAge=age;t.state='cruising';t.pose=t.cameraPose();t.prepareGrainRoute();
   if(name==='exit'){t.stop();t.returnAge=t.returnDuration*.5;t.pose=t.cameraPose();}
  }
  const a=frame(old,false),b=frame(next,true);let same=a.visible===b.visible;
  const cache=next.grainProjection(r.w,r.h);
  for(let i=0;i<old.flightField.points.length;i++){
   const x=old.projectGrain(old.flightField.points[i],old.flightField,{},r.w,r.h),y=next.projectGrain(next.flightField.points[i],next.flightField,{},r.w,r.h,cache);
   if(x.visible!==y.visible||!near(x.alpha,y.alpha))same=false;
   if(x.visible)for(const key of ['x','y','tail','size'])if(!near(x[key],y[key]))same=false;
  }
  ring.push({stage:name,beforeMs:bench(()=>frame(old,false)),afterMs:bench(()=>frame(next,true)),checksBefore:a.checks,checksAfter:b.checks,same});
 }
 const warp=[],copy=Object.assign(Object.create(Object.getPrototypeOf(r)),r,{camera:{...r.camera},cameraTween:null,openingParticles:null,ringTour:null});
 for(const boot of [true,false]){
  const home=copy.defaultCameraSnapshot();
  if(boot){copy.restoreCamera(copy.openingCameraSnapshot(home));copy.animateOpeningCamera(home,0,6500);}
  else{copy.animateOpeningReplay(home,copy.openingCameraSnapshot(home),0,6500);copy.cameraTween.replay.brakeAt=4300;copy.cameraTween.replay.resetAt=7000;}
  for(const [stage,time] of boot?[['start',100],['middle',3000],['exit',7000]]:[['start',1000],['acceleration',3500],['loop',8000],['exit',14000]]){
   const field=copy.openingParticleFrame(time),out={};let same=true,drawn=0;
   for(const p of field.points){
    const a=__beforeSolarRenderer.prototype.projectOpeningParticle.call(copy,p,field,{}),b=copy.projectOpeningParticle(p,field,{},true);
    if(a.visible&&a.alpha>=1e-4){drawn++;if(!b.visible)same=false;for(const key of ['x','y','tail','size','alpha'])if(!near(a[key],b[key]))same=false;}
    else if(b.visible&&b.alpha>=1e-4)same=false;
   }
   const before=()=>{for(const p of field.points)__beforeSolarRenderer.prototype.projectOpeningParticle.call(copy,p,field,out);};
   const after=()=>{const frame=copy.openingParticleProjection(field);for(const p of field.points)copy.projectOpeningParticle(p,field,out,true,frame);};
   warp.push({mode:boot?'opening':'warp',stage,beforeMs:bench(before),afterMs:bench(after),drawn,same});
  }
 }
 old.dispose();next.dispose();return {ring,warp,error:r.gpu.gl.getError()};
}
