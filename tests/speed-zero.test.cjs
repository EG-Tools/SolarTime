'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),A=require('../src/astro.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
const config=source.slice(source.indexOf('      const SPEED_MODES='),source.indexOf('      function speedText'));
const apply=source.slice(source.indexOf('      function selectedSpeedActive()'),source.indexOf("      let controlsUiSignature="));
for(const mode of ['hour','day','year'])test(mode+' zero freezes the selected date and a positive value resumes there',()=>{
 let mono=1000;const clock=new A.SimulationClock(Date.parse('2027-12-27T00:00:00Z'),0);clock.setRate(86400,0);
 const sync=[],context={A,clock,speedMode:mode,speedValues:{hour:1,day:1,year:1},performance:{now:()=>mono},renderer:{invalidateSurfaces(){}},syncAnimationPause:()=>sync.push(clock.paused),syncSpeedUi(){},uiNow(){},persist(){}};
 vm.createContext(context);vm.runInContext(config+apply,context);
 const at=clock.value(mono);vm.runInContext('applySpeed(0)',context);assert.equal(clock.paused,true);assert.equal(clock.value(900000),at);assert.equal(vm.runInContext('selectedSpeedActive()',context),true);
 mono=2000;vm.runInContext('applySpeed(0)',context);assert.equal(clock.paused,true);assert.equal(clock.value(mono),at);
 mono=3000;vm.runInContext('applySpeed(2)',context);assert.equal(clock.paused,false);assert.equal(clock.value(mono),at);assert.ok(clock.value(mono+1000)>at);assert.deepEqual(sync,[true,true,false]);
});
