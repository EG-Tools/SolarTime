'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../src/astro.js');
const earth=A.BODIES.find(b=>b.id==='earth');
const all=[...A.BODIES,A.MOON,A.SUN];
const close=(x,y,eps=1e-8)=>assert.ok(Math.abs(x-y)<eps,`${x} != ${y}`);
const signed=x=>A.wrap(x+Math.PI)-Math.PI;

test('Earth display radius is exactly 1.5x; other sizes and orbit stay unchanged',()=>{
 close(earth.size,11.5*1.5);close(earth.orbit,198);
 const original={mercury:6.5,venus:10.5,mars:8.5,jupiter:29,saturn:24,uranus:16.5,neptune:16,pluto:5};
 for(const b of A.BODIES)if(b.id!=='earth')close(b.size,original[b.id]);
 close(A.MOON.size,3.9);close(A.SUN.size,28);
});
test('Every body completes one turn per its own sidereal period, not a display loop',()=>{
 for(const b of all)for(const t of [A.J2000,Date.UTC(2026,8,11),A.MIN_TIME,A.MAX_TIME-300*A.DAY]) {
  const before=A.rotationAt(b,t),period=Math.abs(b.spin)*A.DAY;
  close(signed(A.rotationAt(b,t+period)-before),0);
  close(signed(A.rotationAt(b,t+period/4)-before),Math.sign(b.spin)*Math.PI/2);
 }
});
test('Earth takes about 86164 seconds per turn and has no 20-second acceleration',()=>{
 close(earth.spin*86400,86164.100352,1e-6);
 close(A.rotationAt(earth,A.J2000+20000),A.TAU*20/86164.100352);
 assert.ok(A.rotationAt(earth,A.J2000+20000)<.002);
});
test('Rotation derives only from timestamp and never from frame count or visit history',()=>{
 const t=A.J2000+43210000,expected=all.map(b=>A.rotationAt(b,t));
 for(let i=0;i<123;i++)for(const b of all)A.rotationAt(b,t+i*1000);
 all.forEach((b,i)=>close(A.rotationAt(b,t),expected[i]));
});
test('Retrograde direction is applied exactly once to Venus, Uranus and Pluto',()=>{
 for(const b of all) {
  const rateSign=Math.sign(signed(A.rotationAt(b,A.J2000+1000)-A.rotationAt(b,A.J2000)));
  assert.equal(rateSign,Math.sign(b.spin),b.id);
  close(Math.sign(b.spin)*Math.cos(A.rotationPoleTilt(b)),Math.cos(b.tilt*A.DEG));
 }
 assert.deepEqual(A.BODIES.filter(b=>b.spin<0).map(b=>b.id),['venus','uranus','pluto']);
});
test('Rotation stays normalized before the epoch and across the supported date range',()=>{
 for(const b of all)for(const t of [A.MIN_TIME,A.J2000-1000,A.J2000,A.MAX_TIME]) {
  const angle=A.rotationAt(b,t);assert.ok(angle>=0&&angle<A.TAU,b.id);
 }
});
test('Invalid rotation inputs fail explicitly',()=>{
 for(const t of [NaN,Infinity,-Infinity])assert.throws(()=>A.rotationAt(earth,t),RangeError);
 for(const spin of [0,NaN,Infinity])assert.throws(()=>A.rotationAt({spin},A.J2000),RangeError);
});
test('The same live clock timestamp drives rotation and orbit',()=>{
 const c=new A.SimulationClock(A.J2000,0),wall=A.J2000+6*3600000,ms=c.value(1000,wall);
 close(A.rotationAt(earth,ms),A.TAU*6/24/earth.spin);
 assert.deepEqual(A.positionAt(earth,ms),A.positionAt(earth,wall));
});
test('Timelapse advances rotation at the selected orbital rate without phase resets',()=>{
 const c=new A.SimulationClock(A.J2000,0);c.setRate(86400,0,A.J2000);
 close(A.rotationAt(earth,c.value(250)),A.TAU*.25/earth.spin);
 const at=c.value(250),angle=A.rotationAt(earth,at);c.setRate(604800,250,A.J2000);
 close(A.rotationAt(earth,c.value(250)),angle);
 close(A.rotationAt(earth,c.value(350)),A.rotationAt(earth,at+.7*A.DAY));
});
test('Pause, resume, date changes and NOW preserve one authoritative rotation time',()=>{
 const c=new A.SimulationClock(A.J2000,0);c.setRate(86400,0,A.J2000);c.toggle(500,A.J2000);
 const paused=all.map(b=>A.rotationAt(b,c.value(500)));
 all.forEach((b,i)=>close(A.rotationAt(b,c.value(9999)),paused[i]));
 c.toggle(9999,A.J2000);close(c.value(10999),A.J2000+1.5*A.DAY);
 c.setDate(Date.UTC(2040,0,1),11000);
 all.forEach(b=>close(A.rotationAt(b,c.value(99999)),A.rotationAt(b,Date.UTC(2040,0,1))));
 c.now(100000,A.J2000+20000);close(A.rotationAt(earth,c.value(100001,A.J2000+21000)),A.rotationAt(earth,A.J2000+21000));
});
test('Saturn and Uranus use the documented Cassini/Hubble representative periods',()=>{
 close(A.BODIES.find(b=>b.id==='saturn').spin*86400,38018,1e-7);
 close(A.BODIES.find(b=>b.id==='uranus').spin*86400,-62092,1e-7);
});

test('Lunar display orbit stays compact and independent of the 1.5x Earth size',()=>{
 close(A.MOON.displayOrbit,30);
 assert.ok(A.MOON.displayOrbit/(earth.size*2.6)<.67);
 close(A.MOON.period,27.321661);close(earth.size,17.25);
 for(const t of [A.J2000,A.J2000+7*A.DAY,A.MAX_TIME]) {
  const p=A.moonAt(t,A.MOON.displayOrbit);
  close(Math.hypot(p.x,p.y,p.z),30);
  const el=A.moonElements(t),path=A.pointOnOrbit(el,el.M,30);
  assert.deepEqual(p,path);
 }
});
test('One-day playback preserves the actual Jupiter/Saturn spin ratios',()=>{
 const c=new A.SimulationClock(A.J2000,0);c.setRate(86400,0,A.J2000);
 for(const b of all)close(A.rotationAt(b,c.value(1000)),A.rotationAt(b,A.J2000+A.DAY));
 close(1/A.BODIES.find(b=>b.id==='jupiter').spin,2.418145765827731,1e-10);
 close(1/A.BODIES.find(b=>b.id==='saturn').spin,86400/38018);
});
