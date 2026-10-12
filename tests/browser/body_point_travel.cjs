'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,until})=>{
 await evaluate('SolarTime.renderer.setOption("actualScale",true,false)');
 await until('SolarTime.renderer.canStartRingTour()');
 await evaluate('SolarTime.renderer.startRingTour()');
 await until('!!SolarTime.renderer.ringTour?.resources');
 const report=await evaluate(`(()=>{
  const r=SolarTime.renderer,t=r.ringTour,state=SolarTime.getState(),mono=performance.now();
  const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;const c=canvas.getContext('2d');
  const rows=[];r.setAnimationPaused(true,mono);
  for(const age of [8,10,14,24,50,100,200,400,800]){
   t.age=age;t.visualAge=age;t.state=age<10?'entering':'cruising';t.yaw=0;t.pitch=0;t.pose=t.cameraPose();
   const d=t.pose.eye.map(v=>-v),dot=v=>v.reduce((n,x,i)=>n+x*d[i],0),x=dot(t.pose.right),y=dot(t.pose.up),z=dot(t.pose.forward);
   t.look(Math.atan2(x,z),Math.atan2(y,Math.hypot(x,z)));t.pose=t.cameraPose();
   r.draw(state.simulationMs,state.effectTime,mono);
   const saturn=r.currentFrameItem('saturn'),mask=r.particleSphereMask(t.pose),points=[];
   for(const item of r.frameBodies){
    const s=item.screen;if(item===saturn||s.behind||r.bodyPointLod(item.body,item.r).alpha<=0||!r.visible(s,0))continue;
    if(!(s.occlusionDepth<saturn.screen.occlusionDepth))continue;
    // Sample only the interior, outside the antialiased limb.
    if(mask.empty)continue;
    const e=mask.ellipse;
    if(e){const dx=s.x-e.x,dy=s.y-e.y,cos=Math.cos(e.angle),sin=Math.sin(e.angle);
     if(((dx*cos+dy*sin)/(e.rx-3))**2+((-dx*sin+dy*cos)/(e.ry-3))**2<1)points.push(item);
    }else if(r.particleSphereRow(mask,s.y).some(([left,right])=>s.x>left+3&&s.x<right-3))points.push(item);
   }
   c.clearRect(0,0,r.w,r.h);for(const item of points)r.drawBodyPoint(c,item,r.frameBodies);
   const pixels=c.getImageData(0,0,r.w,r.h).data;
   const leaked=points.filter(({screen:s})=>pixels[(Math.floor(s.y)*r.w+Math.floor(s.x))*4+3]>0).map(item=>item.body.id);
   if(!Number.isFinite(t.pose.eye[0]))throw Error('Non-finite test camera at '+age);
   rows.push({age,hidden:points.map(item=>item.body.id),leaked});
  }
  r.setAnimationPaused(false,mono);r.endRingTour();
  return {actualScale:r.options.actualScale,rows,error:r.gpu.gl.getError()};
 })()`);
 assert.equal(report.actualScale,true);assert.equal(report.error,0);
 assert.ok(report.rows.some(row=>row.hidden.length),'real ephemeris points must overlap the travel sphere: '+JSON.stringify(report));
 for(const row of report.rows)assert.deepEqual(row.leaked,[],JSON.stringify(row));
 return report;
};
