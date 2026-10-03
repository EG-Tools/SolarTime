'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
module.exports=async({evaluate,delay})=>{
 // Private test page only; drive the same real renderer with a deterministic clock.
 await evaluate('window.requestAnimationFrame=()=>0');await delay(100);
 const result=await evaluate(`(()=>{
  const r=SolarTime.renderer,home=r.defaultCameraSnapshot(),ms=SolarTime.getState().simulationMs,results=[];
  const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=1200;const c=sheet.getContext('2d');
  const capture=(index,title)=>{const x=(index%2)*640,y=Math.floor(index/2)*400;c.fillStyle='black';c.fillRect(x,y,640,400);
   c.globalAlpha=1;c.drawImage(r.sky.canvas,x,y,640,400);
   c.globalAlpha=Number(r.gpu.canvas.style.opacity||1);c.drawImage(r.gpu.canvas,x,y,640,400);
   c.globalAlpha=1;c.drawImage(r.ctx.canvas,x,y,640,400);c.fillStyle='white';c.font='16px sans-serif';c.fillText(title,x+12,y+24);
  };
  r.endRingTour();r.restoreCamera(r.openingCameraSnapshot(home));
  const bootStart=performance.now();r.animateOpeningCamera(home,bootStart,6500);
  const bootPool=r.openingParticles;
  const bootEnergy=time=>{r.draw(ms,0,bootStart+time);const f=r.openingParticleFrame(bootStart+time);return f.points.reduce((sum,p)=>sum+r.projectOpeningParticle(p,f,{}).alpha,0);};
  if(bootEnergy(0)!==0)throw Error('Boot grains are already visible on the first frame');
  if(!(bootEnergy(500)>0))throw Error('Boot grains did not fade in while moving');
  if(r.openingParticles!==bootPool)throw Error('Boot replaced the particle pool');
  r.restoreCamera(home);
  const closeups=[];
  for(const id of ['earth','jupiter','saturn','sun'])for(const side of [-1,1]){
   r.endRingTour();r.clearPreparedTour();r.restoreCamera(home);r.stopAutoRotate();r.options.actualScale=false;r.actualScaleMix=0;r.actualScaleTween=null;
   let start=performance.now();r.draw(ms,0,start);
   const target=r.trackingMoveState(id);target.dolly*=4;target.panX=.5*side;target.elevation*=side;
   r.restoreCamera(target);r.draw(ms,0,start);
   const initial=r.currentFrameItem(id).r;
   if(!r.animateOpeningReplay(home,r.openingCameraSnapshot(home),start,6500))throw Error('nearby '+id+' has no safe exit');
   if(!r.cameraTween.replay.ring.retreat)throw Error('close-up exit has no clearance');
   let previousVisible=false,maxVisibleRadius=0;
   for(let elapsed=0;elapsed<=3600;elapsed+=100){
    r.draw(ms,0,start+elapsed);const body=r.currentFrameItem(id),visible=r.visible(body.screen,body.r);
    if(body.screen.behind&&previousVisible)throw Error('nearby '+id+' clipped while its disc was visible');
    if(visible)maxVisibleRadius=Math.max(maxVisibleRadius,body.r);
    if(r.replayPresentation(start+elapsed).solar!==1)throw Error('close-up exit hides the planet layer');
    previousVisible=visible;
   }
   if(maxVisibleRadius>initial*1.1)throw Error('close-up disc expands across the camera');
   closeups.push({id,side,maxVisibleRadius,error:r.gpu.gl.getError()});
  }
  for(const actual of [false,true])for(const touring of [false,true])for(const turn of [0,1,2,3]){
   r.endRingTour();r.clearPreparedTour();r.restoreCamera(home);r.stopAutoRotate();r.options.actualScale=actual;r.actualScaleMix=actual?1:0;r.actualScaleTween=null;r.dirty=true;let now=performance.now();r.draw(ms,0,now);
   if(touring){if(!r.startRingTour())throw Error('ring not ready');const t=r.ringTour;t.age=22;t.state='cruising';t.look(Math.PI,.12);t.lastMono=now;r.draw(ms,0,now);}
   const oldRandom=Math.random;Math.random=()=> (turn+.5)/4;
   try{r.animateOpeningReplay(home,r.openingCameraSnapshot(home),now,6500);}finally{Math.random=oldRandom;}
   const move=r.cameraTween;
   const pool=r.openingParticles;if(!pool?.points.length)throw Error('warp has no particles');
   for(let elapsed=0;elapsed<45000&&!Number.isFinite(move.replay.resetAt);elapsed+=200){
    r.draw(ms,0,now+elapsed);
    if(!Number.isFinite(move.replay.resetAt)&&r.replayPresentation(now+elapsed).solar!==1)throw Error('early body fade');
   }
   const p=move.replay;if(!Number.isFinite(p.resetAt))throw Error('clearance stalled: '+JSON.stringify({actual,touring,turn,ring:p.ring,pose:r.ringTour?.pose,visible:r.projected.filter(x=>!x.screen.behind&&r.visible(x.screen,x.r*3+24)).map(x=>({id:x.body.id,x:x.screen.x,y:x.screen.y,r:x.r}))}));
   if(p.flightPath.locator!=='WARP'||!p.flightPath.warp)throw Error('missing physical warp ring');
   if(!p.ring.virtual||p.ring.orbit!=='virtual')throw Error('warp must use a camera-relative virtual locator');
   const ready=r.openingReplayPose(move,p.resetAt).state;
   if(JSON.stringify(ready)!==JSON.stringify(r.openingReplayPose(move,p.resetAt+1999).state))throw Error('B camera moved before the two-second preparation ended');
   if(JSON.stringify(ready)===JSON.stringify(r.openingReplayPose(move,p.resetAt+2500).state))throw Error('opening did not start after preparation');
   if(p.particleAt!==0||p.flightPath.duration!==4.3||r.replayOpeningAt(p)-p.brakeAt!==4700)throw Error('warp must use 4.3s departure / immediate particles / 4.7s warp');
   const samples=[0,2500,2700,3700,5200,7700];
   for(let i=0;i<samples.length;i++){
    const elapsed=p.brakeAt+samples[i];r.draw(ms,0,now+elapsed);
    if(elapsed<r.replayOpeningAt(p)+p.inbound-300?r.openingParticles!==pool:r.openingParticles!==null)throw Error('incorrect warp particle lifetime');
    const lens=r.sky.gl.getUniform(r.sky.program,r.sky.u.fov);
    if(Math.abs(lens-r.sky.tanFov)>1e-5)throw Error('GPU lens mismatch');
    if(r.sky.camera.hideStars||!r.sky.lastPose.drawStars)throw Error('one shared star field must remain lit through both skies');
    if(Math.abs(r.sky.gl.getUniform(r.sky.starProgram,r.sky.starU.fov)-Math.tan(30.4*Math.PI/180))>1e-5)throw Error('stars must not inherit the background zoom');
    if(samples[i]>=2700&&samples[i]<7700&&r.replayPresentation(now+elapsed).cover>.1)throw Error('overlap must keep A visible without black');
    if(samples[i]===2700&&!p.skyFrom)throw Error('next scene has no retained sky basis');
    if(p.skySnapshot)throw Error('GPU transition must not capture stars or allocate a second sky bitmap');
    if(Math.abs(lens-Math.tan(30.4*Math.PI/180))>1e-5)throw Error('warp must keep the background at 60.8 degrees');
    if(samples[i]===7700&&Math.abs(lens-Math.tan(30.4*Math.PI/180))>1e-5)throw Error('lens must return to 60.8 degrees');
    if(touring&&turn===0&&!actual)capture(i,['Warp ring cruise','Fixed lens +2.5s','Shared galaxy reset','Galaxy momentum +1s','Opening +0.5s','Opening +3s'][i]);
   }
   results.push({actual,touring,turn,orbit:p.ring.orbit,particleAt:p.particleAt,clearAt:p.brakeAt,resetAt:p.resetAt,error:r.gpu.gl.getError()});
  }
  return {cases:results,closeups,image:sheet.toDataURL('image/png')};
 })()`);
 assert.equal(result.cases.length,16);assert.ok(result.cases.every(p=>p.error===0&&Math.abs(p.resetAt-p.clearAt-2700)<1e-6));
 const file=path.join(os.tmpdir(),'solartime-replay-transition.png');fs.writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));
 delete result.image;return {...result,screenshot:file};
};
