'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const window={SolarAstro:require('../src/astro.js')};
for(const file of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/'+file+'.js'),'utf8'),{window,performance:{now:()=>0}});
const frame={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}};
function create(seed){return new window.SolarRingTour({seed,frame,radius:80,width:1280,height:800,screen:{x:640,y:400},deferPreparation:true});}
for(const returning of [false,true])test((returning?'return':'entry')+' plans smooth detours around blocking planets',()=>{
 for(let seed=1;seed<=6;seed++){
 const tour=create(seed);if(returning){tour.age=12;tour.state='cruising';tour.pose=tour.cameraPose();tour.setReturnView(tour.startPose);}
 const duration=returning?tour.returnDuration:window.SolarRingTour.settings.entry,pose=t=>returning?tour.returnPose(t):tour.entryPose(t);
 const original=pose(duration*.45).eye,obstacles=[{center:[0,0,0],radius:1},{center:[...original],radius:.4},{center:[...pose(duration*.62).eye],radius:.3},{center:[...pose(duration*.28).eye],radius:.25}],start=[...pose(0).eye],end=[...pose(duration).eye];
 const count=tour.planFlightClearance(obstacles,returning);assert.ok(count>0);assert.deepEqual(Array.from(pose(0).eye),Array.from(start));assert.deepEqual(Array.from(pose(duration).eye),Array.from(end));
 for(let i=0;i<=2000;i++){const eye=pose(i/2000*duration).eye;for(const b of obstacles)assert.ok(Math.hypot(...eye.map((v,k)=>v-b.center[k]))>b.radius*1.08,'seed '+seed+' t '+i/2000);}
 const h=1e-4,delta=tour.applyFlightDetours([0,0,0],h,returning?tour.returnDetours:tour.entryDetours);assert.ok(Math.hypot(...delta)/h<.01,'no departure velocity jump');
 }
});
