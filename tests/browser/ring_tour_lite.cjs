'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
// Optional before/after check against an explicitly supplied, local pre-edit source.
module.exports=async(evaluate,baselineFile)=>{
 const baseline=fs.readFileSync(baselineFile,'utf8');
 await evaluate(`(()=>{const current=window.SolarRingTour;try{(0,eval)(${JSON.stringify(baseline)});window.__ringBaseline=window.SolarRingTour;}finally{window.SolarRingTour=current;}})()`);
 try{
  const report=await evaluate(`(async()=>{
   const r=SolarTime.renderer,gpu=r.gpu,g=gpu.gl,p=r.currentFrameItem('saturn'),base=r.ringTour;
   const options={frame:r.bodyFrame(p.body),radius:200,width:r.w,height:r.h,screen:{x:r.w/2,y:r.h/2},seed:123,phase:base.phase};
   const old=new window.__ringBaseline(options),next=new SolarRingTour(options),samples=[];
   const ext=g.getExtension('ANGLE_instanced_arrays'),draw=ext.drawArraysInstancedANGLE;let instances=0;
   const ready=image=>image.complete&&image.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Comparison atlas failed'));});
   try{
    await Promise.all([old.atlasImage,old.fogImage,next.atlasImage,next.fogImage].map(ready));
    ext.drawArraysInstancedANGLE=function(...args){instances+=args[3];return draw.apply(ext,args);};
    const render=t=>{instances=0;gpu.begin();t.draw(gpu,r.w,r.h);gpu.end();const pixels=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,pixels);return {pixels,instances,bytes:t.memoryUsage()};};
    for(const t of [old,next]){render(t);t.resources.atlasAge=t.resources.fogAtlasAge=0;}
    for(const age of [0,2.5,5,8,10,16,35]){
     for(const t of [old,next]){t.age=age;t.visualAge=age+2;t.state=age<10?'entering':'cruising';t.pose=t.cameraPose();}
     const a=render(old),b=render(next);let total=0,covered=0,changed=0;
     for(let i=0;i<a.pixels.length;i+=4){let difference=0;for(let k=0;k<4;k++)difference+=Math.abs(a.pixels[i+k]-b.pixels[i+k]);total+=difference;
      if(a.pixels[i+3]>10||b.pixels[i+3]>10){covered++;if(difference>40)changed++;}}
     samples.push({age,meanError:total/a.pixels.length,changedCoverage:changed/Math.max(1,covered),before:a.instances,after:b.instances,bytesBefore:a.bytes,bytesAfter:b.bytes});
    }
    return {samples,error:g.getError()};
   }finally{ext.drawArraysInstancedANGLE=draw;old.dispose();next.dispose();gpu.resetBindings();r.invalidatePresentation();}
  })()`);
  assert.equal(report.error,0);
  for(const sample of report.samples){assert.ok(sample.meanError<2.55&&sample.changedCoverage<.1,JSON.stringify(sample));assert.ok(sample.bytesAfter<sample.bytesBefore);if(sample.age>=10)assert.ok(sample.after<sample.before*.75,JSON.stringify(sample));}
  return report;
 }finally{await evaluate('delete window.__ringBaseline');}
};
