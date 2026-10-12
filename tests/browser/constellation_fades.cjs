'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
module.exports=async({evaluate,until})=>{
 await evaluate('SolarTime.renderer.restoreCamera(SolarTime.renderer.defaultCameraSnapshot());SolarTime.renderer.clearOpeningParticleFields()');
 await until('!SolarTime.renderer.dirty');
 const result=await evaluate(`(()=>{const r=SolarTime.renderer,state=SolarTime.getState(),camera=JSON.stringify(r.cameraSnapshot()),rows=[],preview=document.createElement('canvas');preview.width=r.w*3;preview.height=r.h;const p=preview.getContext('2d');
 for(const [i,amount] of [0,.5,1].entries()){
  r.skySolarMix=amount;r.ctx.clearRect(0,0,r.w,r.h);r.drawSolarScene(state.simulationMs,state.effectTime,performance.now());
  const picture=document.createElement('canvas');picture.width=r.w;picture.height=r.h;const c=picture.getContext('2d');
  if(r.gpu.canvas.style.visibility!=='hidden')c.drawImage(r.gpu.canvas,0,0,r.w,r.h);c.drawImage(r.canvas,0,0,r.w,r.h);
  const pixels=c.getImageData(0,0,r.w,r.h).data;let energy=0,visible=0;for(let n=3;n<pixels.length;n+=4){energy+=pixels[n];if(pixels[n]>4)visible++;}
  rows.push({amount,energy,visible,appearance:r.solarSceneAppearance(),camera:JSON.stringify(r.cameraSnapshot()),world:JSON.stringify(r.frameBodies.map(b=>[b.body.id,b.world,b.r]).sort((a,b)=>a[0].localeCompare(b[0]))),buffer:!!r.solarComposite});
  p.drawImage(picture,i*r.w,0);
 }
 r.skySolarMix=0;r.drawSolarScene(state.simulationMs,state.effectTime,performance.now());
 return {rows,camera,restoredVisibility:r.gpu.canvas.style.visibility,released:!r.solarComposite,error:r.gpu.gl.getError(),image:preview.toDataURL()};})()`);
 const image=path.join(os.tmpdir(),'solar-constellation-fade.png');fs.writeFileSync(image,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
 assert.equal(result.error,0);assert.ok(result.released);assert.notEqual(result.restoredVisibility,'hidden');
 const [full,half,compact]=result.rows;assert.ok(full.energy>half.energy&&half.energy>0);assert.ok(half.energy>compact.energy&&compact.energy>0);assert.ok(full.visible>half.visible&&half.visible>compact.visible);assert.ok(half.buffer&&compact.buffer);assert.equal(compact.appearance.scale,.1);assert.equal(compact.appearance.alpha,1);
 for(const row of result.rows){assert.equal(row.camera,result.camera);assert.equal(row.world,full.world);}
 const hidden=await evaluate(`(()=>{const r=SolarTime.renderer;r.setSkySolarDisplay(false);r.skySolarMix=1;r.ctx.clearRect(0,0,r.w,r.h);r.drawSolarScene(SolarTime.getState().simulationMs,SolarTime.getState().effectTime,performance.now());const value={hidden:r.solarSceneHidden(),target:r.skySolarTarget};r.setSkySolarDisplay(true);r.skySolarMix=0;return value;})()`);
 assert.deepEqual(hidden,{hidden:true,target:null});
 for(const row of result.rows){delete row.camera;delete row.world;}
 return {...result,image};
};
