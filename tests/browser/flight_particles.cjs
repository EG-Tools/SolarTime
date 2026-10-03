'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
module.exports=async({evaluate,until})=>{
 await until('SolarTime.renderer.openingParticleSprite===SolarTime.renderer.flightParticleImage&&SolarTime.renderer.flightParticleImage?.naturalWidth===512');
 const result=await evaluate(`(()=>{
  const r=SolarTime.renderer,image=r.flightParticleImage,home=r.defaultCameraSnapshot(),now=performance.now();
  let seed=123;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const field={points:Array.from({length:5000},()=>({...r.flightParticleStyle(rand),x:rand()*1280,y:rand()*800})),projected:{}};
  const project=(p,f,out)=>Object.assign(out,{visible:true,alpha:.45,x:p.x,y:p.y,size:p.size,glowSize:p.size*p.glow,tail:8,angle:Math.atan2(p.y-400,p.x-640)});
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;
  const c=canvas.getContext('2d'),draw=c.drawImage.bind(c);let calls=0;c.drawImage=(...args)=>{calls++;draw(...args);};
  const bench=()=>{const times=[];calls=0;for(let i=0;i<11;i++){c.clearRect(0,0,1280,800);const start=performance.now();r.drawFlightParticles(c,field,project);c.getImageData(0,0,1,1);if(i>2)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {draws:calls/11,medianMs:times[times.length>>1]};};
  const atlas=bench();r.openingParticleSprite=null;
  // Freeze only the test loader to benchmark its existing offline fallback.
  const loader=r.loadFlightParticleAtlas;r.loadFlightParticleAtlas=()=>{};
  const fallback=bench();r.loadFlightParticleAtlas=loader;r.openingParticleSprite=image;
  r.animateOpeningReplay(home,r.openingCameraSnapshot(home,()=>.23),now,5000);
  if(!r.openingParticles?.points.length)throw Error('Warp particle pool missing');
  const count=r.openingParticles.points.length;
  c.fillStyle='#02040a';c.fillRect(0,0,1280,800);calls=0;r.drawOpeningParticles(c,now+6000);
  if(calls!==0)throw Error('Warp still draws image textures');
  r.restoreCamera(home);
  r.animateOpeningCamera(home,now,6500);
  if(!r.openingParticles?.replay.openingMove)throw Error('Opening arrival particles missing');
  r.drawOpeningParticles(c,now+3500);
  if(calls!==0)throw Error('Opening arrival particles must use the warp stroke painter');
  const preview=canvas.toDataURL('image/png');r.restoreCamera(home);
  if(!r.startRingTour())throw Error('ring tour unavailable');const grains=r.ringTour.flightField.points;
  const report={atlas,fallback,bytes:r.memoryUsage().flightAtlas,warpCount:count,ringCount:grains.length,variants:new Set(grains.map(p=>p.tile)).size,angles:new Set(grains.map(p=>Math.round(p.rotation*100))).size,sharedImage:r.openingParticleSprite===image,requests:performance.getEntriesByType('resource').filter(e=>e.name.includes('flight-particles-atlas-v1.webp')).length,error:r.gpu.gl.getError(),preview};
  r.endRingTour();return report;
 })()`);
 assert.equal(result.atlas.draws,5000);assert.equal(result.fallback.draws,10000);
 assert.equal(result.bytes,1048576);assert.equal(result.ringCount,5000);assert.equal(result.variants,16);
 assert.ok(result.warpCount>0&&result.warpCount<=960);
 assert.ok(result.angles>500);assert.equal(result.sharedImage,true);assert.equal(result.requests,1);assert.equal(result.error,0);
 const file=path.join(os.tmpdir(),'solartime-flight-atlas-preview.png');fs.writeFileSync(file,Buffer.from(result.preview.split(',')[1],'base64'));delete result.preview;
 return {...result,file};
};
