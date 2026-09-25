'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Element{
 constructor(){this.listeners={};this.attrs={};this.value='';this.hidden=true;this.open=false;this.checked=false;this.disabled=false;this.style={setProperty(){}};this.classList={toggle(){}};}
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn);}
 removeEventListener(t,fn){this.listeners[t]=(this.listeners[t]||[]).filter(f=>f!==fn);}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}
 focus(){}contains(e){return this===e;}closest(){return this;}querySelector(){return this;}
 showModal(){this.open=true;}close(){this.open=false;}click(){return this.fire('click');}
 fire(t){return Promise.all((this.listeners[t]||[]).map(fn=>fn({target:this,preventDefault(){},stopPropagation(){}})));}
}
function fixture({soundMode='default',hook='normal',pendingPlay=false,hidden=false}={}){
 let clock=1790290000000,hookCalls=0,resolvePlay;const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const document=new Element();Object.assign(document,{getElementById:get,documentElement:{lang:'en'},baseURI:'https://solartime.app/',hidden});
 const audio=new Element();Object.assign(audio,{paused:true,ended:false,error:null,currentTime:0,src:'',volume:.55,muted:true,load(){},pause(){this.paused=true;},play(){this.paused=false;return pendingPlay?new Promise(resolve=>{resolvePlay=resolve;}):Promise.resolve();}});
 const events=[],frames=new Map();let frameId=0;
 const requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame=id=>frames.delete(id);
 const node=()=>({gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{},connect(target){return target;},start(){events.push({type:'alarm',paused:audio.paused,muted:audio.muted,enabled:music.enabled});},stop(){}});
 class AudioContext{constructor(){this.currentTime=0;this.destination={};}resume(){return Promise.resolve();}close(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({decoded:true});}createBufferSource(){return node();}createGain(){return node();}createOscillator(){return node();}}
 const request=result=>{const r={result};queueMicrotask(()=>r.onsuccess?.());return r;};
 const blob={arrayBuffer:async()=>new ArrayBuffer(4)};
 const indexedDB={open:()=>request({transaction:()=>({objectStore:()=>({get:()=>request(soundMode==='custom'?{blob,name:'custom.wav'}:null),put:()=>request(null)})})})};
 const window={document,SolarModules:{},indexedDB,AudioContext,location:{href:'https://solartime.app/',protocol:'https:',hostname:'solartime.app'},console:{warn(){}},setInterval:()=>1,clearInterval(){},requestAnimationFrame,fetch:async()=>({ok:true,blob:async()=>blob})};
 class Clock extends Date{static now(){return clock;}}
 const context={window,document,Date:Clock,Intl,URL,performance:{now:()=>0},requestAnimationFrame,cancelAnimationFrame,clearInterval(){},setTimeout};
 for(const name of ['music-player','timer-copy','alarm-sound','timer-controller'])vm.runInNewContext(read('src/'+name+'.js'),context);
 const music=window.SolarModules.MusicPlayer.create({audio,tracks:[{file:'music.mp3',title:'Background music'}],folder:'assets/music/',translate:k=>k,notify(){},button:get('music-toggle'),previous:get('previous'),next:get('next'),title:get('title'),now:get('now')});
 const options={document,Preferences:{read:()=>({soundMode}),write(){}},translate:k=>k,shutdownBridge:{eligible:false},UI:{bindScrollCues:()=>({update(){},dispose(){}}),bindPopup(){},bindDialog(){},visible:el=>!el.hidden,show:(el,fn)=>{el.hidden=false;fn?.();},hide:(el,fn)=>{el.hidden=true;fn?.();}}};
 if(hook!=='omitted')options.onAlarmStart=()=>{hookCalls++;if(hook==='throw')throw Error('isolated hook error');music.setEnabled(false);};
 const timer=window.SolarModules.TimerController.create(options);
 return {music,timer,audio,get,events,hookCalls:()=>hookCalls,advance(ms){clock+=ms;timer.check();},async arm(){get('alarm-hours').value='0';get('alarm-minutes').value='1';get('alarm-enabled').checked=true;await get('alarm-enabled').fire('change');},finishPlay(){resolvePlay?.();},drainFrames(){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(1000);},dispose(){timer.dispose();music.dispose();}};
}
for(const soundMode of ['default','custom'])test(soundMode+' alarm turns music and its button OFF before the first tone and never auto-resumes',async()=>{
 const f=fixture({soundMode});await flush();f.music.setEnabled(true);await flush();await f.arm();await flush();
 assert.equal(f.music.enabled,true,'arming alone must not stop music');f.advance(60001);await flush();
 assert.equal(f.music.enabled,false);assert.equal(f.audio.paused,true);assert.equal(f.audio.muted,true);assert.equal(f.get('music-toggle').getAttribute('aria-pressed'),'false');assert.equal(f.get('music-toggle').getAttribute('aria-label'),'musicOn');assert.equal(f.get('now').hidden,true);assert.ok(f.events.length>0);
 assert.ok(f.events.every(e=>e.paused&&e.muted&&!e.enabled),'music must stop before alarm playback');
 await f.get('alarm-stop').fire('click');assert.equal(f.music.enabled,false);f.advance(60000);assert.equal(f.music.enabled,false);
 f.music.setEnabled(true);assert.equal(f.music.enabled,true,'manual restart remains available');f.dispose();
});
test('music already OFF stays OFF when the alarm rings',async()=>{const f=fixture();await f.arm();f.advance(60001);assert.equal(f.music.enabled,false);assert.equal(f.get('alarm-dialog').open,true);f.dispose();});
test('snooze stays silent and a second ring stops manually restarted music',async()=>{
 const f=fixture();await flush();f.music.setEnabled(true);await f.arm();f.advance(60001);await f.get('alarm-snooze').fire('click');assert.equal(f.music.enabled,false);
 f.music.setEnabled(true);f.advance(299000);assert.equal(f.music.enabled,true);f.advance(1001);assert.equal(f.music.enabled,false);assert.equal(f.hookCalls(),2);f.dispose();
});
test('cancelling an alarm and previewing its sound do not switch music OFF',async()=>{
 const f=fixture();await flush();f.music.setEnabled(true);await f.get('alarm-preview-default').fire('click');await flush();assert.equal(f.music.enabled,true);assert.equal(f.hookCalls(),0);
 await f.arm();f.get('alarm-enabled').checked=false;await f.get('alarm-enabled').fire('change');f.advance(60001);assert.equal(f.music.enabled,true);assert.equal(f.hookCalls(),0);f.dispose();
});
test('pending music play/fade cannot re-enable music after ringing in a hidden tab',async()=>{
 const f=fixture({pendingPlay:true,hidden:true});f.music.setEnabled(true);await f.arm();f.advance(60001);f.finishPlay();await flush();f.drainFrames();
 assert.equal(f.music.enabled,false);assert.equal(f.audio.paused,true);assert.equal(f.audio.muted,true);assert.equal(f.get('music-toggle').getAttribute('aria-pressed'),'false');f.dispose();
});
for(const hook of ['omitted','throw'])test('alarm still rings with '+hook+' optional start hook',async()=>{
 const f=fixture({hook});await f.arm();f.advance(60001);assert.equal(f.get('alarm-dialog').open,true);assert.ok(f.events.length>0);f.dispose();
});
test('app wires the alarm hook to the shared music OFF API, not to a toggle or volume workaround',()=>{
 assert.match(read('src/app.js'),/onAlarmStart:\(\)=>setMusicEnabled\(false\)/);
 assert.match(read('src/app.js'),/setMusicEnabled=value=>music\.setEnabled\(value\)/);
});
