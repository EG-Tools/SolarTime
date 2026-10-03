'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/preferences.js'),'utf8'),DAY=86400000;
function setup(blocked=false){
 const data=new Map();let time=100*DAY,writes=0;
 const window={localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return data.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');writes++;data.set(k,v);}}};
 vm.runInNewContext(source,{window});const P=window.SolarModules.Preferences;
 return {data,P,create:()=>P.createHelpReminder(()=>time),add:n=>time+=n,writes:()=>writes};
}
test('first visit and fourteen-day return show once, recent use never repeats',()=>{
 const h=setup();let r=h.create();assert.equal(r.visit(),true);r.seen();assert.equal(r.pending(),false);
 h.add(14*DAY-1);r=h.create();assert.equal(r.visit(),false);
 h.add(14*DAY);r=h.create();assert.equal(r.visit(),true);r.seen();assert.equal(h.create().visit(),false);
});
test('last activity, not last help display, controls the absence window',()=>{
 const h=setup(),r=h.create();r.visit();r.seen();
 for(let day=0;day<30;day++){h.add(DAY);r.touch();}
 h.add(DAY);assert.equal(h.create().visit(),false);
});
test('pending reminder survives reload and reading in another tab satisfies it',()=>{
 const h=setup(),a=h.create();a.visit();a.seen();h.add(15*DAY);
 assert.equal(a.visit(),true);const b=h.create();assert.equal(b.visit(),true);
 b.seen();assert.equal(a.pending(),false);a.touch(true);assert.equal(h.create().visit(),false);
});
test('legacy seen users get a baseline; invalid timestamps and clock rollback do not trigger',()=>{
 const h=setup();h.P.write('solar-time.help-seen.v1',true);assert.equal(h.create().visit(),false);
 h.add(-DAY);assert.equal(h.create().visit(),false);
 h.P.write('solar-time.help-visit.v1',{lastActive:'bad',pending:false});assert.equal(h.create().visit(),false);
});
test('visible heartbeat is throttled and storage denial is safe within the session',()=>{
 const h=setup(),r=h.create();r.visit();const count=h.writes();
 for(let i=0;i<100;i++){h.add(200);r.touch();}assert.equal(h.writes(),count);
 h.add(60000);r.touch();assert.equal(h.writes(),count+1);
 const privateMode=setup(true),p=privateMode.create();assert.equal(p.visit(),true);p.seen();assert.equal(p.pending(),false);
 p.touch(true);assert.equal(p.pending(),false);assert.equal(p.visit(),false);
});
