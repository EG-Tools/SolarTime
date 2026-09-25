'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Element,flush,deferred}=require('./helpers/timer-harness.cjs');
function fixture({count=2,fallback=false,failPlay=false}={}){
 let clock=0,id=0;const pending=new Map(),loads=[],notices=[],document=new Element();document.hidden=true;
 const audio=new Element();Object.assign(audio,{paused:true,ended:false,error:null,currentTime:0,duration:120,src:'',volume:.55,muted:true,
  load(){this.currentTime=0;this.error=null;this.ended=false;loads.push(this.src);},pause(){this.paused=true;},
  play(){this.paused=false;return typeof failPlay==='function'?failPlay():failPlay?Promise.reject(Error('network')):Promise.resolve();}});
 const button=new Element(),window={SolarModules:{},location:{href:'https://solartime.app/'},setTimeout(fn,ms){pending.set(++id,{fn,at:clock+ms});return id;},clearTimeout:n=>pending.delete(n)};
 const tracks=Array.from({length:count},(_,i)=>({file:i+'.mp3',title:'track '+i}));
 window.SolarAssets={music:Object.fromEntries(tracks.map(t=>[t.file,{base:'https://a.example/',path:t.file,fallback:'https://'+(fallback?'b':'a')+'.example/'+t.file}]))};
 const math=Object.create(Math);math.random=()=>.999;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/music-player.js'),'utf8'),{window,document,URL,Math:math,performance:{now:()=>clock},requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const music=window.SolarModules.MusicPlayer.create({audio,tracks,folder:'assets/',translate:x=>x,notify:x=>notices.push(x),button,previous:new Element(),next:new Element(),title:new Element(),now:new Element()});
 return {music,audio,loads,notices,pending,button,async advance(ms){const end=clock+ms;let loops=0;while(true){const entry=[...pending].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;if(++loops>100)throw Error('Unbounded recovery');clock=entry[1].at;pending.delete(entry[0]);entry[1].fn();await flush();}clock=end;await flush();},async error(){audio.error={code:2};await audio.fire('error');await flush();}};
}
test('mid-track error retries once, then skips; all failed tracks turn music and UI OFF',async()=>{
 const f=fixture();f.music.setEnabled(true);await flush();assert.equal(f.loads.length,1);
 await f.error();await f.error();await f.advance(999);assert.equal(f.loads.length,1);await f.advance(1);assert.equal(f.loads.length,2);assert.equal(f.music.track,'track 0');
 await f.error();await f.advance(1000);assert.equal(f.music.track,'track 1');await f.error();await f.advance(1000);await f.error();
 assert.equal(f.loads.length,4);assert.equal(f.music.enabled,false);assert.equal(f.audio.muted,true);assert.equal(f.button.getAttribute('aria-pressed'),'false');assert.deepEqual(f.notices,['musicUnavailable']);assert.equal(f.pending.size,0);f.music.dispose();
});
test('a distinct fallback has a bounded retry budget; identical URLs are not retried as new sources',async()=>{
 const f=fixture({count:1,fallback:true});f.music.setEnabled(true);await flush();
 for(let i=0;i<4;i++){await f.error();await f.advance(1000);}
 assert.deepEqual(f.loads,['https://a.example/0.mp3','https://a.example/0.mp3','https://b.example/0.mp3','https://b.example/0.mp3']);assert.equal(f.music.enabled,false);f.music.dispose();
});
test('rapid play-success/error cycles remain bounded instead of resetting on every play promise',async()=>{
 const f=fixture({count:1});f.music.setEnabled(true);await flush();await f.error();await f.advance(1000);await f.error();assert.equal(f.music.enabled,false);assert.equal(f.loads.length,2);f.music.dispose();
});
test('five seconds of real playback progress restores the transient retry budget',async()=>{
 const f=fixture({count:1});f.music.setEnabled(true);await flush();await f.error();await f.advance(1000);f.audio.currentTime=6;await f.audio.fire('timeupdate');await f.error();await f.advance(1000);assert.equal(f.loads.length,3);assert.equal(f.music.enabled,true);f.music.dispose();
});
test('user OFF, alarm OFF and disposal cancel queued recovery and detach media handlers',async()=>{
 for(const mode of ['off','alarm','dispose']){const f=fixture();f.music.setEnabled(true);await flush();await f.error();mode==='dispose'?f.music.dispose():f.music.setEnabled(false);await f.advance(30000);assert.equal(f.loads.length,1,mode);assert.equal(f.pending.size,0);assert.equal(f.music.enabled,false);for(const event of ['error','waiting','stalled','playing','timeupdate','ended'])assert.equal(f.audio.listeners[event].length,0,event);f.music.dispose();}
});
test('manual next overrides pending recovery and an old rejected play cannot select a fallback',async()=>{
 const d=deferred();let n=0;const f=fixture({fallback:true,failPlay:()=>++n===1?d.promise:Promise.resolve()});f.music.setEnabled(true);f.music.step(1);await flush();d.reject(Error('late network failure'));await f.advance(2000);assert.equal(f.music.track,'track 1');assert.equal(f.loads.length,2);f.music.dispose();
});
test('a stalled event with advancing buffered playback does not switch tracks',async()=>{
 const f=fixture();f.music.setEnabled(true);await flush();await f.audio.fire('stalled');f.audio.currentTime=3;await f.audio.fire('timeupdate');await f.advance(16000);assert.equal(f.loads.length,1);assert.equal(f.pending.size,0);f.music.dispose();
});
test('stalled playback and a play promise that never settles time out without infinite waiting',async()=>{
 for(const hang of [false,true]){const f=fixture({failPlay:hang?()=>new Promise(()=>{}):false});f.music.setEnabled(true);await flush();if(!hang)await f.audio.fire('waiting');await f.advance(14999);assert.equal(f.loads.length,1);await f.advance(1001);assert.equal(f.loads.length,2);f.music.dispose();assert.equal(f.pending.size,0);}
});
test('normal pause and intentional load abort do not trigger recovery; denied autoplay switches OFF',async()=>{
 const f=fixture();f.music.setEnabled(true);await flush();await f.audio.fire('abort');await f.audio.fire('pause');await f.advance(20000);assert.equal(f.loads.length,1);f.music.dispose();
 const denied=fixture({failPlay:()=>Promise.reject(Object.assign(Error('denied'),{name:'NotAllowedError'}))});denied.music.setEnabled(true);await flush();assert.equal(denied.music.enabled,false);assert.equal(denied.loads.length,1);assert.equal(denied.pending.size,0);denied.music.dispose();
});
test('an empty playlist fails cleanly and normal ended advances to the next track',async()=>{
 const empty=fixture({count:0});empty.music.setEnabled(true);assert.equal(empty.music.enabled,false);assert.equal(empty.loads.length,0);empty.music.dispose();
 const f=fixture();f.music.setEnabled(true);await flush();f.audio.ended=true;await f.audio.fire('ended');await flush();assert.equal(f.music.track,'track 1');f.music.dispose();
});

test('seeking to the saved position cannot mask a hung play promise during recovery',async()=>{
 const d=deferred();let n=0;const f=fixture({failPlay:()=>++n===1?Promise.resolve():d.promise});f.music.setEnabled(true);await flush();f.audio.currentTime=20;await f.error();await f.advance(1000);await f.audio.fire('loadedmetadata');assert.equal(f.audio.currentTime,20);await f.advance(15000);assert.ok(f.pending.size);await f.advance(1000);assert.equal(f.music.track,'track 1');f.music.dispose();d.resolve();await flush();assert.equal(f.music.enabled,false);
});
