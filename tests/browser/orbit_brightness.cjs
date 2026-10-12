'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate,until,mouse})=>{
 await evaluate(`(()=>{const r=SolarTime.renderer;r.restoreCamera(r.defaultCameraSnapshot());window.__orbitProbe={errors:[],frames:0,alpha:[]};addEventListener('error',e=>__orbitProbe.errors.push(e.message));const orbit=r.gpu.orbit;r.gpu.orbit=function(...args){__orbitProbe.alpha.push(args[8]);return orbit.apply(this,args);};const draw=r.drawSolarScene;r.drawSolarScene=function(...args){__orbitProbe.frames++;__orbitProbe.alpha=[];return draw.apply(this,args);};})()`);
 await until('!SolarTime.renderer.cameraTween&&!SolarTime.renderer.dirty');
 const rows=[];
 for(const value of [0,25,50,100,0]){
  const frame=await evaluate(`(()=>{const el=document.getElementById('orbit-brightness');el.value=${value};el.dispatchEvent(new Event('input',{bubbles:true}));return __orbitProbe.frames;})()`);
  await until(`__orbitProbe.frames>${frame}`);
  rows.push(await evaluate(`({value:${value},option:SolarTime.renderer.options.orbitBrightness,output:document.getElementById('orbit-brightness-output').textContent,alpha:__orbitProbe.alpha.slice(),errors:__orbitProbe.errors})`));
 }
 console.log(JSON.stringify({orbitBrightness:rows}));
 for(const row of rows){assert.equal(row.option,row.value/100);assert.equal(row.output,row.value+'%');assert.deepEqual(row.errors,[]);if(row.value===0)assert.equal(row.alpha.length,0);else assert.ok(row.alpha.length>0);}
 assert.ok(rows[1].alpha[0]<rows[2].alpha[0]&&rows[2].alpha[0]<rows[3].alpha[0]);
 await evaluate('document.getElementById("settings-button").click();document.getElementById("pause-button").click()');
 await until('SolarTime.getState().paused&&!SolarTime.renderer.needsDraw(performance.now())');
 const slider=await evaluate(`(()=>{const el=document.getElementById('orbit-brightness');el.scrollIntoView({block:'center'});const b=el.getBoundingClientRect();return {x:b.x,y:b.y+b.height/2,w:b.width};})()`);
 const paused=[];
 for(const fraction of [.25,.75,0]){
  const frame=await evaluate('__orbitProbe.frames');
  const x=fraction===0?slider.x+1:slider.x+8+(slider.w-16)*fraction;
  await mouse('mousePressed',x,slider.y,'left',1);await mouse('mouseReleased',x,slider.y,'left',0);
  await until(`__orbitProbe.frames>${frame}&&!SolarTime.renderer.dirty`);
  paused.push(await evaluate('({value:Number(document.getElementById("orbit-brightness").value),option:SolarTime.renderer.options.orbitBrightness,alpha:__orbitProbe.alpha.slice(),errors:__orbitProbe.errors})'));
 }
 console.log(JSON.stringify({pausedMouseBrightness:paused}));
 for(const row of paused){assert.equal(row.option,row.value/100);assert.deepEqual(row.errors,[]);}
 assert.ok(paused[1].alpha[0]>paused[0].alpha[0]);assert.equal(paused[2].value,0);assert.equal(paused[2].alpha.length,0);
 return rows;
};
