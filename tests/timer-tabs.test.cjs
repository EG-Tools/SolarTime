'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,flush}=require('./helpers/timer-harness.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
test('custom alarm filename opens the picker and remove clears the stored sound',async()=>{
 const f=fixture({prepare:async()=>({buffer:{length:48000,numberOfChannels:2,duration:1},dispose(){}})});try{
  let picks=0;f.get('alarm-sound-file').addEventListener('click',()=>picks++);
  await f.get('alarm-sound-name').click();assert.equal(picks,1);
  await f.choose('custom.wav');assert.equal(f.timer.getState().soundMode,'custom');assert.match(f.get('alarm-sound-choose').textContent,/removeFile/);
  await f.get('alarm-sound-choose').click();assert.equal(picks,1);assert.equal(f.stored(),null);
  assert.equal(f.timer.getState().soundMode,'default');assert.equal(f.timer.getState().soundName,'');
  await f.get('alarm-sound-choose').click();assert.equal(picks,2);
 }finally{f.dispose();}
});

test('removal waits for an in-flight sound write before deleting it',async()=>{
 const {deferred}=require('./helpers/timer-harness.cjs'),pending=deferred();let block=false;
 const f=fixture({prepare:async()=>({buffer:{length:48000,numberOfChannels:2,duration:1},dispose(){}}),putRecord:()=>block?pending.promise:null});try{
  await f.choose('first.wav');block=true;const replacing=f.choose('second.wav');
  for(let i=0;i<5;i++)await flush();const removing=f.get('alarm-sound-choose').click();
  pending.resolve();await replacing;await removing;
  assert.equal(f.stored(),null);assert.equal(f.timer.getState().soundMode,'default');assert.equal(f.timer.getState().soundName,'');
 }finally{f.dispose();}
});

function shared({fallback=false}={}){
 let saved={helperEnabled:true,helperConfirmed:true,helperProgress:100,helperRevision:"A".repeat(64)},held=false;const tabs=[];
 const locks={request(_name,_options,fn){if(held)return Promise.resolve(fn(null));held=true;return Promise.resolve(fn({})).finally(()=>{held=false;});}};
 function make(){let tab;const preferences={read:()=>copy(saved),write(key,value){saved=copy(value);for(const peer of tabs)if(peer!==tab)queueMicrotask(()=>{for(const fn of peer.window.listeners.storage||[])fn({key});});return true;}};
 tab=fixture({preferences,locks:fallback?false:locks,installed:true});tabs.push(tab);return tab;}
 return {make,saved:()=>copy(saved),dispose:()=>tabs.forEach(t=>t.dispose())};
}
test('cancel and deadline changes reach every tab without resurrecting an old alarm',async()=>{
 const h=shared(),a=h.make(),b=h.make();try{
 await a.arm();await flush();assert.equal(b.timer.getState().alarm.enabled,true);
 await a.cancel();await flush();assert.equal(b.timer.getState().alarm.enabled,false);await b.advance(60000);assert.equal(b.get('alarm-dialog').open,false);
 a.setNow(b.now());await a.arm();await flush();await a.arm('alarm',5);await flush();assert.equal(b.timer.getState().alarm.deadline,a.timer.getState().alarm.deadline);
 await b.advance(60000);assert.equal(b.get('alarm-dialog').open,false);assert.equal(h.saved().alarm.enabled,true);
 }finally{h.dispose();}
});
test('one tab rings; cancellation elsewhere stops it; reload can recover a ringing alarm',async()=>{
 const h=shared(),a=h.make(),b=h.make();try{
 await a.arm();await flush();a.setNow(a.now()+60000);b.setNow(b.now()+60000);a.timer.check();b.timer.check();await flush();
 assert.equal(Number(a.get('alarm-dialog').open)+Number(b.get('alarm-dialog').open),1);assert.equal(h.saved().alarm.ringing,true);
 a.dispose();await flush();b.timer.check();await flush();assert.equal(b.get('alarm-dialog').open,true);
 const c=h.make();await c.cancel();await flush();assert.equal(b.get('alarm-dialog').open,false);assert.equal(h.saved().alarm.ringing,false);
 }finally{h.dispose();}
});
test('sound edits do not overwrite a newer alarm or confirmed shutdown',async()=>{
 const h=shared(),a=h.make(),b=h.make();try{
 await a.arm('alarm',5);await a.arm('shutdown',5);await flush();
 assert.equal(b.timer.getState().shutdown.status,'confirmed');
 // Suppress notifications to mimic a suspended tab.
 b.window.listeners.storage=[];
 await a.cancel();await a.cancel('shutdown');await b.get('alarm-sound-default').fire('change');assert.equal(h.saved().alarm.enabled,false);assert.equal(h.saved().shutdown.enabled,false);
 }finally{h.dispose();}
});
test('fallback ownership starts only one alarm and cancelled claims never ring',async()=>{
 const h=shared({fallback:true}),a=h.make(),b=h.make();try{
 await a.arm();await flush();a.setNow(a.now()+60000);b.setNow(b.now()+60000);a.timer.check();b.timer.check();await a.advance(31);await b.advance(31);await flush();
 assert.equal(Number(a.get('alarm-dialog').open)+Number(b.get('alarm-dialog').open),1);
 await b.cancel();await flush();assert.equal(a.get('alarm-dialog').open,false);
 }finally{h.dispose();}
});
