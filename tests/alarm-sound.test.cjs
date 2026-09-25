'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {flush,deferred,fixture,Element}=require('./helpers/timer-harness.cjs');
function audioFixture({duration=120,hang=false,broken=false}={}){
 const instances=[],revoked=[],timers=new Map();let decodes=0,n=0;
 class Audio{constructor(){this.duration=duration;instances.push(this);}load(){if(this.src&&!hang)queueMicrotask(()=>broken?this.onerror?.():this.onloadedmetadata?.());}pause(){}removeAttribute(){this.src='';}}
 const window={SolarModules:{},Audio,URL:{createObjectURL:()=> 'blob:'+ ++n,revokeObjectURL:u=>revoked.push(u)},setTimeout:(fn)=>{timers.set(n,fn);return n;},clearTimeout:n=>timers.delete(n)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/alarm-sound.js'),'utf8'),{window});
 const context={decodeAudioData:async()=>{decodes++;return {duration,length:duration*48000,numberOfChannels:2};}};
 return {api:window.SolarModules.AlarmSound,revoked,timers,decodes:()=>decodes,context,window};
}
test('long user audio stays streamed without allocating full-file PCM and its Blob URL is revoked once',async()=>{
 const f=audioFixture(),sound=await f.api.prepare(new Blob(['compressed']),{getContext:()=>f.context});assert.equal(sound.buffer,null);assert.ok(sound.url.startsWith('blob:'));assert.equal(f.decodes(),0);sound.dispose();sound.dispose();assert.equal(f.revoked.length,1);assert.equal(f.timers.size,0);
});
test('short user audio retains Web Audio playback and immediately revokes the temporary Blob URL',async()=>{
 const f=audioFixture({duration:4}),sound=await f.api.prepare(new Blob(['compressed']),{getContext:()=>f.context});assert.equal(sound.url,'');assert.equal(sound.buffer.duration,4);assert.equal(f.decodes(),1);assert.equal(f.revoked.length,1);sound.dispose();assert.equal(sound.buffer,null);
});
test('abort, invalid metadata and metadata timeout each clean up their temporary media resource',async()=>{
 const f=audioFixture({hang:true}),abort=new AbortController(),task=f.api.prepare(new Blob(['x']),{getContext:()=>f.context,signal:abort.signal});abort.abort();await assert.rejects(task,/cancelled/);assert.equal(f.revoked.length,1);assert.equal(f.timers.size,0);
 const bad=audioFixture({broken:true});await assert.rejects(bad.api.prepare(new Blob(['x'])),/Unsupported/);assert.equal(bad.revoked.length,1);
 const timeout=audioFixture({hang:true}),wait=timeout.api.prepare(new Blob(['x']));[...timeout.timers.values()][0]();await assert.rejects(wait,/timeout/);assert.equal(timeout.revoked.length,1);
});
test('compressed and decoded audio limits reject oversize data without retaining its buffer',async()=>{
 const f=audioFixture();await assert.rejects(f.api.prepare({size:31*1024*1024}),/compressed/);assert.equal(f.revoked.length,0);
 await assert.rejects(f.api.decodeBounded(new Blob(['x']),{decodeAudioData:async()=>({length:10*1024*1024,numberOfChannels:2})}),/streaming/);
});
test('streamed alarm and preview use the same raised base gains; stop revokes the retained resource',async()=>{
 const prepared={url:'blob:stream',buffer:null,disposed:0,dispose(){this.disposed++;}},f=fixture({prepare:async()=>prepared});f.timer.open(true);
 const media=[];class Audio extends Element{constructor(url){super();this.src=url;media.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}load(){}}
 f.window.Audio=Audio;await f.choose('long.wav');await f.get('alarm-preview-custom').fire('click');await flush();assert.equal(media.at(-1).volume,.696);assert.equal(f.timer.getDiagnostics().customStreaming,true);
 await f.arm();await f.advance(60000);assert.equal(media.at(-1).volume,.864);assert.equal(media.at(-1).loop,true);await f.get('alarm-stop').fire('click');assert.equal(media.at(-1).paused,true);assert.equal(prepared.disposed,1);f.dispose();
});
