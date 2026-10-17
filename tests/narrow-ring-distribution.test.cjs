'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const style=require('../src/surface-style.js');
test('narrow ring sampling concentrates the fixed budget in shared bands and favours the outer band',()=>{
 let seed=17;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const counts=style.narrowRingBands.map(()=>0);let gaps=0;
 for(let i=0;i<30000;i++){
  const radius=style.sampleNarrowRingRadius(rand,1.58,1.94),f=(radius-1.58)/.36;
  assert.ok(radius>=1.58&&radius<=1.94);
  const index=style.narrowRingBands.findIndex(b=>Math.abs(f-b.center)<=b.width+1e-6);
  if(index<0)gaps++;else counts[index]++;
 }
 assert.ok(gaps>3300&&gaps<4500,'gaps remain sparse but not completely empty');
 assert.ok(counts[7]>Math.max(...counts.slice(0,7))*1.5,'outer band is the strongest concentration');
 for(const b of style.narrowRingBands)assert.ok(style.narrowRingGLSL.includes('lineBand(f,'+b.center));
});
test('banded debris keeps the requested pool counts and thinner vertical extent',()=>{
 const window={SolarSurfaceStyle:style};vm.runInNewContext(fs.readFileSync(require.resolve('../src/ring-tour.js'),'utf8'),{window,performance});
 const t=new window.SolarRingTour({frame:{u:{x:1,y:0,z:0},v:{x:0,y:0,z:1},pole:{x:0,y:1,z:0}},radius:100,width:800,height:600,screen:{x:400,y:300},seed:17,narrowRing:true,ringBounds:[1.58,1.94],debrisDensity:.6,debrisHeight:.7,particleCapacity:1});
 assert.deepEqual([t.points.length/5,t.fogPoints.length/5,t.chipPoints.length/5],[18000,6000,6000]);
 for(const pool of [t.points,t.fogPoints,t.chipPoints]){
  let inBands=0;
  for(let i=0;i<pool.length;i+=5){
   const f=(Math.hypot(pool[i],pool[i+2])-1.58)/.36;
   if(style.narrowRingBands.some(b=>Math.abs(f-b.center)<b.width+1e-5))inBands++;
   assert.ok(Math.abs(pool[i+1])<=.055*1.5*.7*.5+1e-7);
  }
  assert.ok(inBands/(pool.length/5)>.84);
 }
 t.dispose();
});
