'use strict';
module.exports=async function suite({evaluate,until,esc}){
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
 const dir=process.env.SOLAR_TRAVEL_BASELINE;
 for(const [file,name] of [['ring-tour.js','SolarRingTour'],['renderer.js','SolarRenderer']]){
  const source=fs.readFileSync(path.join(dir,file),'utf8');
  await evaluate('(()=>{const current=window.'+name+';try{(0,eval)('+JSON.stringify(source)+');window.__before'+name+'=window.'+name+';}finally{window.'+name+'=current;}})()');
 }
 const result=await evaluate(`(()=>{
 const r=SolarTime.renderer,Old=__beforeSolarRenderer.prototype,home=r.cameraSnapshot();
 const bench=fn=>{for(let i=0;i<4;i++)fn();const values=[];for(let n=0;n<5;n++){const at=performance.now();for(let j=0;j<20;j++)fn();values.push((performance.now()-at)/20);}return values.sort((a,b)=>a-b)[2];};
 const copy=Object.assign(Object.create(Object.getPrototypeOf(r)),r,{camera:{...r.camera},cameraTween:null,openingParticles:null,ringTour:null,travelParticleBudget:{value:1},dpr:1});
 const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;const c=canvas.getContext('2d');
 copy.animateOpeningReplay(copy.defaultCameraSnapshot(),copy.openingCameraSnapshot(copy.defaultCameraSnapshot()),0,6500);
 Object.assign(copy.cameraTween.replay,{brakeAt:4300,resetAt:7000,particleAt:0});
 const field=copy.openingParticleFrame(8000),constants=copy.openingParticleProjection(field),project=(p,f,out)=>copy.projectOpeningParticle(p,f,out,true,constants);
 const glow={count:field.points.length,completedBeforeMs:bench(()=>{c.clearRect(0,0,r.w,r.h);Old.drawFlightParticles.call(copy,c,field,project);c.getImageData(0,0,1,1);}),completedPaintMs:bench(()=>{c.clearRect(0,0,r.w,r.h);copy.drawFlightParticles(c,field,project);c.getImageData(0,0,1,1);}),projectionMs:bench(()=>{for(const p of field.points)project(p,field,field.projected);}),
 paintBeforeMs:bench(()=>{c.clearRect(0,0,r.w,r.h);Old.drawFlightParticles.call(copy,c,field,project);}),
 paintAfterMs:bench(()=>{c.clearRect(0,0,r.w,r.h);copy.drawFlightParticles(c,field,project);})};

 const pixels=before=>{c.globalCompositeOperation='source-over';c.fillStyle='#02040a';c.fillRect(0,0,r.w,r.h);if(before)Old.drawFlightParticles.call(copy,c,field,project);else copy.drawFlightParticles(c,field,project);return {pixels:c.getImageData(0,0,r.w,r.h).data,preview:canvas.toDataURL()};};
 const a=pixels(true),b=pixels(false);let delta=0,max=0,changed=0,energyA=0,energyB=0;
 for(let i=0;i<a.pixels.length;i++){if(i%4===3)continue;const d=Math.abs(a.pixels[i]-b.pixels[i]);delta+=d;max=Math.max(max,d);if(d>8)changed++;energyA+=a.pixels[i];energyB+=b.pixels[i];}
 Object.assign(glow,{meanDifference:delta/(r.w*r.h*3),maxDifference:max,changedFraction:changed/(r.w*r.h*3),energyRatio:energyB/energyA,beforeImage:a.preview,afterImage:b.preview});

 const saturn=r.currentFrameItem('saturn'),options={frame:r.bodyFrame(saturn.body),radius:200,width:r.w,height:r.h,screen:{x:r.w/2,y:r.h/2},seed:123},oldTour=new __beforeSolarRingTour(options),newTour=new SolarRingTour(options);let stamp=0;
 const solve=(tour,shared)=>{tour.age=18;tour.pose=tour.cameraPose();const planes=tour.instanceFrustum(r.w,r.h),focal=r.h/(2*Math.tan(tour.pose.fov*Math.PI/360));let checks=0;stamp++;
 for(const layer of tour.instanceLayers){tour.visibleInstances(layer.points,layer.fog?1.85:2.92,tour.instanceData,tour.instanceOrder,layer.indices,!!layer.mesh||!!layer.fog||!!layer.chips,planes,layer.lod===undefined?null:{level:layer.lod,focal},shared?stamp:0);checks+=tour.instanceChecks;}return checks;};
 const lod={beforeChecks:solve(oldTour,false),afterChecks:solve(newTour,true),beforeMs:bench(()=>solve(oldTour,false)),afterMs:bench(()=>solve(newTour,true))};oldTour.dispose();newTour.dispose();
 const windowBudget=window.SolarPerformance,saveBudget=r.updateTravelParticleBudget;
 let jobs=0,prepares=0,clearance=0;
 const job=r.surfaceJob,prepare=r.gpu.prepare,check=r.checkReplayClearance;
 try{
  r.updateTravelParticleBudget=()=>{r.travelParticleBudget={value:1};return 1;};
  r.surfaceJob=function(...args){jobs++;return job.apply(this,args);};
  r.gpu.prepare=function(...args){prepares++;return prepare.apply(this,args);};
  r.checkReplayClearance=function(...args){clearance++;return check.apply(this,args);};
  const now=performance.now();r.animateOpeningReplay(r.defaultCameraSnapshot(),r.openingCameraSnapshot(r.defaultCameraSnapshot()),now,6500);
  Object.assign(r.cameraTween.replay,{brakeAt:4300,resetAt:7000,particleAt:0});
  r.cameraTween.duration=15500;
  const ms=SolarTime.getState().simulationMs;
  r.draw(ms,0,now+5000);const hidden={jobs,prepares,clearance,projected:r.projected.length};
  jobs=prepares=0;r.draw(ms,0,now+7200);const arrived={jobs,prepares};
  return {glow,lod,hidden,arrived,error:r.gpu.gl.getError()};
 }finally{r.surfaceJob=job;r.gpu.prepare=prepare;r.checkReplayClearance=check;r.updateTravelParticleBudget=saveBudget;r.cancelCameraTween();r.restoreCamera(home);window.SolarPerformance=windowBudget;}
 })()`);
 for(const name of ['before','after']){const file=path.join(require('node:os').tmpdir(),'solartime-glow-'+name+'.png');fs.writeFileSync(file,Buffer.from(result.glow[name+'Image'].split(',')[1],'base64'));delete result.glow[name+'Image'];result.glow[name+'Image']=file;}
 assert.equal(result.glow.maxDifference,0);
 assert.equal(result.hidden.jobs,0);assert.equal(result.hidden.prepares,0);assert.ok(result.hidden.clearance>0&&result.hidden.projected>0);
 assert.ok(result.arrived.prepares>0);assert.equal(result.error,0);
 await evaluate("SolarTime.renderer.animateFocus('saturn')");await until('SolarTime.renderer.canStartRingTour()');
 await evaluate('SolarTime.renderer.startRingTour()');await until('SolarTime.renderer.ringTour?.resources?.ready&&SolarTime.renderer.ringTour.resources.atlas');
 const ring=await evaluate(`(()=>{
 const t=SolarTime.renderer.ringTour,gpu=SolarTime.renderer.gpu;
 t.age=18;t.visualAge=20;t.state='cruising';t.pose=t.cameraPose();t.particleBudget=1;
 gpu.begin();t.draw(gpu,1280,800);const first=t.instanceUploadBytes,visible=t.submittedInstances;
 t.draw(gpu,1280,800);const unchanged=t.instanceUploadBytes;
 t.particleBudget=.45;t.draw(gpu,1280,800);const reduced=t.submittedInstances,changed=t.instanceUploadBytes;
 t.particleBudget=1;t.draw(gpu,1280,800);const restored=t.submittedInstances;
 gpu.end();return {first,unchanged,visible,reduced,changed,restored,error:gpu.gl.getError()};
 })()`);
 assert.ok(ring.first>0);assert.equal(ring.unchanged,0);assert.ok(ring.reduced<ring.visible);assert.equal(ring.restored,ring.visible);assert.equal(ring.error,0);
 await esc();await until('!SolarTime.renderer.ringTour');
 return { ...result,ring };
};
