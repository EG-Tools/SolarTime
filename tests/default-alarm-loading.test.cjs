'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture:timerFixture,flush,deferred,Element}=require('./helpers/timer-harness.cjs');
function fixture({duration=120,fetchFn,decodeFn,metadata='ok'}={}){
 let clock=0,id=0,fetches=0,decodes=0;const pending=new Map(),media=[];
 class Audio{constructor(){this.duration=duration;media.push(this);}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){if(this.src&&metadata!=='hang')queueMicrotask(()=>metadata==='error'?this.onerror?.():this.onloadedmetadata?.());}}
 const window={SolarModules:{},Audio,AbortController,URL,setTimeout(fn,ms){pending.set(++id,{fn,at:clock+ms});return id;},clearTimeout:n=>pending.delete(n),fetch:(...args)=>{fetches++;return fetchFn?fetchFn(...args):Promise.resolve(new Response(new Blob(['audio'],{type:'audio/wav'})));}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/alarm-sound.js'),'utf8'),{window,Blob});
 const context={decodeAudioData(bytes){decodes++;return decodeFn?decodeFn(bytes):Promise.resolve({duration,length:duration*48000,numberOfChannels:2});}};
 return {api:window.SolarModules.AlarmSound,window,media,pending,fetches:()=>fetches,decodes:()=>decodes,context,async advance(ms){const end=clock+ms;while(true){const e=[...pending].sort((a,b)=>a[1].at-b[1].at)[0];if(!e||e[1].at>end)break;clock=e[1].at;pending.delete(e[0]);e[1].fn();await flush();}clock=end;await flush();},prepare(signal){return this.api.prepareDefault(['https://example.test/default.mp3'],{getContext:()=>context,signal});}};
}
test('long default alarms retain only a media URL, never fetch the entire file or allocate a decoded buffer',async()=>{
 const f=fixture(),r=await f.prepare();assert.equal(r.buffer,null);assert.match(r.url,/default.mp3$/);assert.equal(f.fetches(),0);assert.equal(f.decodes(),0);assert.equal(f.pending.size,0);assert.ok(f.media.every(m=>m.src===''&&m.paused));r.dispose();assert.equal(r.url,'');
});
test('short default audio keeps Web Audio with the existing gain path and releases retained PCM',async()=>{
 const f=fixture({duration:4}),r=await f.prepare();assert.equal(r.url,'');assert.equal(r.buffer.duration,4);assert.equal(f.fetches(),1);assert.equal(f.decodes(),1);assert.equal(f.pending.size,0);r.dispose();assert.equal(r.buffer,null);
});
test('oversized declared response and oversized chunked response do not enter the decoder',async()=>{
 const declared=fixture({duration:3,fetchFn:async()=>new Response('audio',{headers:{'content-length':String(5*1024*1024)}})});assert.ok((await declared.prepare()).url);assert.equal(declared.decodes(),0);
 let cancelled=false;const chunked=fixture({duration:3,fetchFn:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(4*1024*1024+1));},cancel(){cancelled=true;}}))});assert.ok((await chunked.prepare()).url);assert.equal(chunked.decodes(),0);assert.equal(cancelled,true);
});
test('decoded default exceeding 16MiB or 45s is not retained; streaming remains available',async()=>{
 for(const buffer of [{duration:10,length:3*1024*1024,numberOfChannels:2},{duration:46,length:100,numberOfChannels:2}]){const f=fixture({duration:3,decodeFn:async()=>buffer}),r=await f.prepare();assert.equal(r.buffer,null);assert.ok(r.url);assert.equal(f.pending.size,0);}
});
test('overall twelve-second preparation deadline covers a hung fetch and a hung decoder',async()=>{
 for(const step of ['fetch','decode']){const d=deferred(),f=fixture({duration:3,...(step==='fetch'?{fetchFn:()=>d.promise}:{decodeFn:()=>d.promise})});const task=f.prepare();const check=assert.rejects(task,/timed out/);await flush();await f.advance(12000);await check;assert.equal(f.pending.size,0);d.resolve(step==='fetch'?new Response('late'):{duration:1,length:48000,numberOfChannels:2});await flush();}
});
test('metadata timeout, external abort and early cancellation clean their media and all timers',async()=>{
 const hang=fixture({metadata:'hang'}),task=hang.prepare();await hang.advance(4000);assert.equal(await task,null);assert.equal(hang.pending.size,0);assert.equal(hang.media[0].src,'');
 const f=fixture({metadata:'hang'}),abort=new AbortController(),p=f.prepare(abort.signal),check=assert.rejects(p,/cancelled/);abort.abort();await check;assert.equal(f.pending.size,0);assert.equal(f.media[0].src,'');
 const early=fixture(),a=new AbortController();a.abort();await assert.rejects(early.prepare(a.signal),/cancelled/);assert.equal(early.media.length,0);assert.equal(early.fetches(),0);assert.equal(early.pending.size,0);
});
test('default URL failover is finite and a failed decoder falls back to streaming',async()=>{
 const f=fixture({metadata:'error'});assert.equal(await f.api.prepareDefault(['a','a','b'],{getContext:()=>f.context}),null);assert.equal(f.media.length,2);assert.equal(f.fetches(),0);
 const decode=fixture({duration:2,decodeFn:()=>Promise.reject(Error('codec'))});assert.ok((await decode.prepare()).url);assert.equal(decode.pending.size,0);
});
test('default stream playback preserves alarm/preview gains, restores fallback on error, and stops cleanly',async()=>{
 const f=timerFixture(),instances=[];class Audio extends Element{constructor(url){super();this.src=url;this.currentTime=0;instances.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}}
 f.window.Audio=Audio;f.window.SolarModules.AlarmSound={...f.window.SolarModules.AlarmSound,prepareDefault:async()=>({buffer:null,url:'https://example.test/default.mp3',dispose(){this.url='';}})};
 await f.arm();await flush();assert.equal(f.timer.getDiagnostics().defaultStreaming,true);assert.equal(f.counts.decodes,0);await f.advance(60000);assert.equal(instances.at(-1).volume,.864);assert.equal(instances.at(-1).loop,true);await instances.at(-1).fire('error');assert.ok(f.ramps.includes(.192));await f.get('alarm-stop').fire('click');assert.equal(f.timer.getDiagnostics().defaultStreaming,false);assert.equal(f.pending.size,0);
 await f.get('alarm-preview-default').fire('click');await flush();assert.equal(instances.at(-1).volume,.696);await f.get('alarm-preview-default').fire('click');assert.equal(instances.at(-1).paused,true);assert.equal(f.pending.size,0);f.dispose();
});
test('a late default resource cannot revive a cancelled alarm or preview',async()=>{
 for(const kind of ['alarm','preview']){const f=timerFixture(),d=deferred();let disposed=0;f.window.SolarModules.AlarmSound={...f.window.SolarModules.AlarmSound,prepareDefault:()=>d.promise};const task=kind==='alarm'?f.arm():f.get('alarm-preview-default').fire('click');await flush();kind==='alarm'?await f.cancel():f.timer.close();d.resolve({url:'remote',buffer:null,dispose(){disposed++;}});await task;await flush();assert.equal(disposed,1);assert.equal(f.timer.getDiagnostics().defaultStreaming,false);assert.equal(f.pending.size,0);f.dispose();}
});

test('a stalled response body is cancelled at the overall deadline',async()=>{
 let cancelled=false;const f=fixture({duration:3,fetchFn:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}}))});const task=f.prepare(),check=assert.rejects(task,/timed out/);await flush();await f.advance(12000);await check;assert.equal(cancelled,true);assert.equal(f.pending.size,0);
});
test('default streaming readiness timeout restores the fallback tone and cannot restart after stop',async()=>{
 const f=timerFixture(),d=deferred();class Audio extends Element{constructor(url){super();this.src=url;this.currentTime=0;}play(){return d.promise;}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}}
 f.window.Audio=Audio;f.window.SolarModules.AlarmSound={...f.window.SolarModules.AlarmSound,prepareDefault:async()=>({buffer:null,url:'remote',dispose(){this.url='';}})};await f.arm();await f.advance(60000);await f.advance(3000);assert.ok(f.ramps.includes(.192));await f.get('alarm-stop').fire('click');d.resolve();await flush();assert.equal(f.timer.getDiagnostics().defaultStreaming,false);assert.equal(f.pending.size,0);f.dispose();
});
