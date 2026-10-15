'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('src/app.js','utf8');

function block(start,end){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from);return source.slice(from,to);}

test('discarded display callbacks skip UI lock, pause and cursor work',()=>{
 const frame=block('      function frame(mono) {','      document.addEventListener(\'visibilitychange\'');
 const gate=frame.indexOf('if(!frameGate(');assert.ok(gate>0);
 for(const call of ['syncTravelControlLock();','syncAnimationPause(mono);','updateTravelCursor(mono);'])assert.ok(frame.indexOf(call)>gate,call);
});

test('clock fitting applies immediately, coalesces one correction and uses one-pass measurements',()=>{
 const fit=block('      function fitClockToViewport(){','      function scheduleClockFit(){');
 assert.equal((fit.match(/getBoundingClientRect\(\)/g)||[]).length,2,'clock and AM/PM are each measured once');
 assert.doesNotMatch(fit,/for\(let pass=/);assert.doesNotMatch(fit,/setProperty\('--clock-fit-scale','1'\)/);
 const schedule=block('      function scheduleClockFit(){','      function syncClockSizeControl(){');
 assert.match(schedule,/fitClockToViewport\(\);/);
 assert.match(schedule,/if\(!clockFitFrame\)clockFitFrame=requestAnimationFrame\(\(\)=>\{clockFitFrame=0;fitClockToViewport\(\);\}\)/);
});
