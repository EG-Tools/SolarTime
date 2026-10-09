'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('paused coordinator sleeps between wall-clock ticks and wakes on input or resource changes',()=>{
 const source=fs.readFileSync(require.resolve('../src/app.js'),'utf8');const code=source.slice(source.indexOf('      let pausedWake=0;'),source.indexOf('      const wakeEvents='));
 let clockUpdates=0,frames=0,dirty=false;const timers=new Map();let id=0;
 const ctx={clearTimeout:i=>timers.delete(i),setTimeout:fn=>{timers.set(++id,fn);return id;},cancelAnimationFrame(){},requestAnimationFrame:()=>{frames++;return frames;},disposed:false,document:{hidden:false},raf:1,lastFrame:500,frame(){},performance:{now:()=>1000},Date,clock:{paused:true,value:()=>123},renderer:{needsDraw:()=>dirty},syncTemporaryRegion(){},updateWall:()=>clockUpdates++,updateControls(){},helpReminder:{touch(){}}};
 vm.runInNewContext(code+';globalThis.sleep=sleepPausedFrames;globalThis.wake=wakeFrames;',ctx);
 ctx.sleep();assert.equal(ctx.raf,0);assert.equal(timers.size,1);
 for(let i=0;i<5;i++){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();}
 assert.equal(clockUpdates,5);assert.equal(frames,0);assert.equal(timers.size,1);
 ctx.wake();assert.equal(frames,1);assert.equal(timers.size,0);ctx.wake();assert.equal(frames,1);
 ctx.sleep();dirty=true;const [key,fn]=timers.entries().next().value;timers.delete(key);fn();assert.equal(frames,2);assert.equal(timers.size,0);
 ctx.sleep();ctx.document.hidden=true;const [hiddenKey,hiddenTick]=timers.entries().next().value;timers.delete(hiddenKey);hiddenTick();assert.equal(timers.size,0);
});
