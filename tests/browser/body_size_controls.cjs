'use strict';
const assert=require('node:assert/strict');

// Runs in the existing app fixture; no extra server, browser or state owner.
module.exports=async({evaluate,send,session,ready,waitFor})=>{
 const control=async(id,value=null,sliderId='body-size-slider')=>evaluate(`(()=>{
  const r=SolarTime.renderer,id=${JSON.stringify(id)};
  if(r.selected!==id)document.querySelector('#planet-nav [data-body="'+id+'"]').click();
  const slider=document.getElementById(${JSON.stringify(sliderId)});
  if(${value!==null}){slider.value=${JSON.stringify(value)};slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));}
  const input=document.getElementById('body-size-slider'),orbit=document.getElementById('satellite-orbit-slider');
  return {id,min:+input.min,max:+input.max,value:+input.value,step:+input.step,valid:input.validity.valid,
   label:document.getElementById('body-size-output').textContent,resetDisabled:document.getElementById('body-size-reset').disabled,
   scale:r.bodySizeScale(id),saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).bodyScales,
   orbit:{min:+orbit.min,value:+orbit.value,scale:r.satelliteOrbitScale(id)}};
 })()`);
 const expected={sun:[100,300],mercury:[25,400],venus:[25,400],earth:[25,400],mars:[25,400],jupiter:[12.5,200],saturn:[12.5,200],uranus:[12.5,200],neptune:[12.5,200],pluto:[100,1600],moon:[100,400],europa:[50,400]};
 const ranges=[];
 for(const [id,[min,max]] of Object.entries(expected)){
  const row=await control(id);assert.equal(row.min,min,id);assert.equal(row.max,max,id);assert.equal(row.value,100,id);assert.equal(row.valid,true,id);assert.equal(row.step,.1);ranges.push({id,min,max});
 }
 await control('earth',400);assert.equal((await control('moon')).max,1600);
 const moon=await control('moon',1600);assert.equal(moon.scale,16);assert.equal(moon.saved.moon,16);assert.equal(moon.saved.earth,4);
 await send('Page.reload',{},session);await ready();
 const restored=await control('moon');assert.equal(restored.max,1600);assert.equal(restored.value,1600);assert.equal(restored.valid,true);
 await control('earth',100);assert.equal((await control('moon')).value,400);
 await control('earth',25);const smallest=await control('moon');assert.equal(smallest.value,100);assert.equal(smallest.max,100);
 await control('jupiter',200);assert.equal((await control('europa')).max,800);await control('europa',800);
 await control('jupiter',12.5);const europa=await control('europa');
 assert.equal(europa.min,50);assert.equal(europa.max,50);assert.equal(europa.value,50);assert.equal(europa.resetDisabled,true);assert.equal(europa.valid,true);
 await control('sun',200);assert.equal((await control('mercury')).max,800);assert.equal((await control('saturn')).max,400);
 await control('earth',800);assert.equal((await control('moon')).max,3200);await control('moon',3200);
 await control('sun',100);const clamp=await control('moon');assert.equal(clamp.max,1600);assert.equal(clamp.value,1600);assert.equal(clamp.saved.earth,4);assert.equal(clamp.saved.moon,16);
 await control('sun',300);await control('earth',1200);await control('moon',4800);await control('mercury',1200);await control('jupiter',600);await control('europa',2400);
 for(const id of ['sun','earth','jupiter']){
  const row=await control(id,1,'satellite-orbit-slider');assert.equal(row.orbit.min,1);assert.equal(row.orbit.value,1);assert.equal(row.orbit.scale,.01);
 }
 // Use the same real reset confirmation as the main app test, not direct state.
 await evaluate(`document.getElementById('settings-button').click();document.getElementById('reset-defaults').click();document.getElementById('reset-defaults-yes').click();`);
 await waitFor(`Object.values(SolarTime.renderer.getBodyScales()).every(value=>value===1)`);
 await send('Page.reload',{},session);await ready();
 const reset=await evaluate(`({sizes:SolarTime.renderer.getBodyScales(),gap:SolarTime.renderer.options.overviewOrbitGap})`);
 assert.ok(Object.values(reset.sizes).every(value=>value===1));assert.equal(reset.gap,100);
 return {ranges,reload:true,parentClamping:true,fractionalFloor:true,localOrbitMinimum:1,reset:true};
};
