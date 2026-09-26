'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {fixture,flush,deferred}=require('./helpers/timer-harness.cjs');
const resource=(name,stream=false)=>({name,buffer:stream?null:{length:48000,numberOfChannels:2,duration:1},url:stream?'blob:'+name:'',disposed:0,dispose(){this.disposed++;this.buffer=null;}});
const helperState={helperConfirmed:true,helperEnabled:true,helperProgress:100,helperRevision:'A'.repeat(64)};
test('unused timers schedule no repeated work and do not load a saved custom sound',async()=>{
 const f=fixture({saved:{soundMode:'custom',soundName:'long.mp3'},record:{blob:new Blob(['audio']),name:'long.mp3'}});await f.advance(600000);
 assert.equal(f.pending.size,0);assert.equal(f.counts.reads,0);assert.equal(f.counts.contexts,0);assert.equal(f.timer.getDiagnostics().wakes,0);assert.equal(f.counts.intervals,0);f.dispose();
});
test('hidden alarm still rings at its wall-clock deadline without per-second output writes',async()=>{
 const f=fixture({hidden:true});await f.arm();await flush();const before=f.timer.getDiagnostics();await f.advance(59999);assert.equal(f.get('alarm-dialog').open,false);assert.equal(f.timer.getDiagnostics().outputWrites,before.outputWrites);
 await f.advance(1);assert.equal(f.get('alarm-dialog').open,true);assert.equal(f.timer.getState().alarm.enabled,false);assert.ok(f.timer.getDiagnostics().wakes<=1);f.dispose();
});
test('visible countdown reuses one date formatter, and cancellation removes its wake',async()=>{
 const f=fixture();f.timer.open(true);await f.arm();await f.advance(5000);assert.equal(f.timer.getDiagnostics().formatters,1);const writes=f.timer.getDiagnostics().outputWrites;f.timer.check();assert.equal(f.timer.getDiagnostics().outputWrites,writes);await f.cancel();assert.equal(f.pending.size,0);f.dispose();
});
test('native confirmed shutdown wakes for the last ten seconds and remains cancellable',async()=>{
 const f=fixture({installed:true,saved:helperState,hidden:true});await f.arm('shutdown');await f.advance(49999);assert.equal(f.get('shutdown-dialog').open,false);await f.advance(1);assert.equal(f.get('shutdown-dialog').open,true);assert.equal(f.get('shutdown-countdown').textContent,'10');await f.cancel('shutdown');assert.equal(f.pending.size,0);assert.equal(f.timer.getState().shutdown.status,'idle');f.dispose();
});
test('unknown native result retains the cancel switch without a polling loop',async()=>{
 const f=fixture({installed:true,saved:{...helperState,shutdown:{enabled:true,status:'unknown',deadline:0,hours:0,minutes:1}}});assert.equal(f.pending.size,0);assert.equal(f.get('shutdown-enabled').disabled,false);await f.cancel('shutdown');assert.equal(f.timer.getState().shutdown.enabled,false);f.dispose();
});
test('ten-minute installation wait backs off and expires without orphan polling',async()=>{
 const start=1790290000000,f=fixture({installed:true,saved:{helperProgress:50,helperInstallToken:'a'.repeat(32),helperInstallDeadline:start+600000}});await f.advance(600000);
 assert.ok(f.counts.probes>=70&&f.counts.probes<=90,String(f.counts.probes));assert.equal(f.timer.getState().helperInstallToken,'');assert.equal(f.pending.size,0);f.dispose();
});
test('returning to the foreground checks an installation immediately; late results after disposal are ignored',async()=>{
 const f=fixture({installed:true,hidden:true,saved:{helperProgress:50,helperInstallToken:'a'.repeat(32),helperInstallDeadline:1790290600000}});await f.advance(100);const old=f.counts.probes;f.document.hidden=false;await f.document.fire('visibilitychange');await flush();assert.equal(f.counts.probes,old+1);
 const pending=deferred();f.bridge.installStatus=()=>pending.promise;await f.window.fire('focus');f.dispose();pending.resolve(true);await flush();assert.equal(f.timer.getState().helperConfirmed,false);assert.equal(f.pending.size,0);
});
test('all base alarm gains increase exactly 20 percent, including preview and emergency tone',async()=>{
 const f=fixture();const api=f.window.SolarModules.TimerController;
 for(const [old,current] of [[.72,api.ALARM_VOLUME],[.58,api.PREVIEW_VOLUME],[.16,api.FALLBACK_VOLUME]])assert.ok(Math.abs(current/old-1.2)<1e-12);
 await f.arm();await flush();await f.advance(60000);assert.ok(f.nodes.some(n=>n.kind==='gain'&&n.gain.value===.864));await f.get('alarm-stop').fire('click');assert.equal(f.timer.getDiagnostics().retainedDecodedBytes,0);f.dispose();
 const fallback=fixture({fetchFn:()=>new Promise(()=>{})});await fallback.arm();await fallback.advance(60000);assert.ok(fallback.ramps.includes(.192));fallback.dispose();
});
test('last audio choice wins when earlier preparations complete later',async()=>{
 const tasks=new Map(),f=fixture({prepare:blob=>{const d=deferred();tasks.set(blob.name,d);return d.promise;}});f.timer.open(true);
 const a=f.choose('first.wav'),b=f.choose('last.wav');const rb=resource('b');tasks.get('last.wav').resolve(rb);await b;const ra=resource('a');tasks.get('first.wav').resolve(ra);await a;
 assert.equal(f.timer.getState().soundName,'last.wav');assert.deepEqual(f.writes,['last.wav']);assert.equal(ra.disposed,1);assert.equal(rb.disposed,0);f.timer.close();assert.equal(rb.disposed,1);f.dispose();
});
test('serial IndexedDB commits cannot leave an older choice on disk',async()=>{
 const firstWrite=deferred();let n=0;const f=fixture({prepare:async blob=>resource(blob.name),putRecord:()=>++n===1?firstWrite.promise:Promise.resolve()});f.timer.open(true);
 const first=f.choose('first.wav');await flush();const second=f.choose('second.wav');await flush();assert.equal(f.counts.puts,1);firstWrite.resolve();await Promise.all([first,second]);assert.deepEqual(f.writes,['first.wav','second.wav']);assert.equal(f.stored().name,'second.wav');assert.equal(f.timer.getState().soundName,'second.wav');f.dispose();
});
test('switching back to default prevents an outstanding file choice from selecting itself',async()=>{
 const d=deferred(),r=resource('old'),f=fixture({prepare:()=>d.promise});f.timer.open(true);const task=f.choose('old.wav');f.get('alarm-sound-default').checked=true;await f.get('alarm-sound-default').fire('change');d.resolve(r);await task;assert.equal(f.timer.getState().soundMode,'default');assert.equal(f.counts.puts,0);assert.equal(r.disposed,1);f.dispose();
});
test('cancelling before stored sound preparation finishes cannot retain its decoded memory',async()=>{
 const d=deferred(),r=resource('stored'),f=fixture({saved:{soundMode:'custom',soundName:'stored.wav'},record:{blob:new Blob(['x']),name:'stored.wav'},prepare:()=>d.promise});await f.arm();await flush();await f.cancel();d.resolve(r);await flush();assert.equal(r.disposed,1);assert.equal(f.timer.getDiagnostics().retainedDecodedBytes,0);f.dispose();
});
test('idle controller cannot be revived by a late default decode after cancellation',async()=>{
 const d=deferred(),f=fixture({decode:()=>d.promise});await f.arm();await flush();await f.cancel();d.resolve({length:48000,numberOfChannels:2});await flush();assert.equal(f.timer.getDiagnostics().retainedDecodedBytes,0);assert.equal(f.pending.size,0);f.dispose();
});
test('timer translations keep the approved effective copy in all compiled language bundles',()=>{
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/timer-copy-sha256.json'),'utf8'));
 const keys=Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'../i18n/locales/en.json'),'utf8')).timer).sort();
 for(const [code,digest] of Object.entries(expected)){
  const copy=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/'+code+'.json'),'utf8')).copy;
  const text=JSON.stringify(Object.fromEntries(keys.map(k=>[k,copy[k]])));
  assert.equal(crypto.createHash('sha256').update(text).digest('hex'),digest,code);
 }
 assert.equal(fs.existsSync(path.join(__dirname,'../src/timer-copy.js')),false);
});
