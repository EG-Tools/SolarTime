'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../src/astro.js');
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);

test('J2000 is noon UTC, not local midnight',()=>{assert.equal(A.J2000,946728000000);assert.equal(new Date(A.J2000).toISOString(),'2000-01-01T12:00:00.000Z');});
test('Kepler solver converges across eccentricities and negative mean anomalies',()=>{
  for(const e of [0,.0167,.2056,.2488,.7,.95])for(let i=-150;i<=150;i++){
    const M=i*.17,E=A.eccentricAnomaly(M,e),normalized=A.wrap(M+Math.PI)-Math.PI;
    close(E-e*Math.sin(E),normalized,1e-10);
  }
});
test('All modeled positions are finite throughout the supported interval',()=>{
  for(const y of [1800,1900,2000,2026,2050,2300,2999])for(const b of A.BODIES){
    const p=A.positionAt(b,Date.UTC(y,5,15));for(const k of ['x','y','z','E'])assert.ok(Number.isFinite(p[k]),b.id+' '+k);
    assert.ok(p.elements.e>=0&&p.elements.e<1);assert.ok(p.elements.a>0);
    const r=Math.hypot(p.x,p.y,p.z);assert.ok(r>=p.elements.a*(1-p.elements.e)-1e-9&&r<=p.elements.a*(1+p.elements.e)+1e-9);
  }
});
test('Earth J2000 position agrees with the published element solution at display precision',()=>{
  const e=A.positionAt(A.BODIES.find(b=>b.id==='earth'),A.J2000);
  close(e.x,-.17717,.0001);close(e.y,.96721,.0001);close(e.z,0,.00002);
});
test('Rendered planet centers and orbit curves share precisely the same transform',()=>{
  for(const ms of [A.J2000,Date.UTC(2026,8,11),Date.UTC(2200,3,20)])for(const b of A.BODIES){
    const p=A.positionAt(b,ms,true),on=A.pointOnOrbit(p.elements,p.E,b.orbit),physical=A.positionAt(b,ms);
    for(const key of ['x','y','z']){close(p[key],on[key]);close(p[key],physical[key]*b.orbit/p.elements.a,1e-9);}
  }
});
test('All orbit paths close without a visible seam',()=>{for(const b of A.BODIES){const p=A.orbitAt(b,A.J2000);for(const k of ['x','y','z'])close(p[0][k],p.at(-1)[k],1e-9);}});
test('Perihelion and aphelion radii follow a(1±e)',()=>{
  for(const b of A.BODIES){const el=A.elementsAt(b,A.J2000);for(const [E,sign] of [[0,-1],[Math.PI,1]]){const p=A.pointOnOrbit(el,E);close(Math.hypot(p.x,p.y,p.z),el.a*(1+sign*el.e));}}
});
test('Mean lunar model preserves geocentric radius and its ~27.32-day sidereal cycle',()=>{
  const ms=Date.UTC(2026,8,11),r=38,a=A.moonAt(ms,r),b=A.moonAt(ms+A.MOON.period*A.DAY,r);
  close(Math.hypot(a.x,a.y,a.z),r);close(Math.hypot(b.x,b.y,b.z),r);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<r*.008);
});
test('Lunar illuminated fraction always lies in [0,1]',()=>{for(let d=0;d<365;d++){const p=A.moonPhase(A.J2000+d*A.DAY);assert.ok(p.fraction>=0&&p.fraction<=1);assert.ok(p.phase>=0&&p.phase<1);assert.ok(p.name.length>0);}});
test('Invalid timestamps do not silently produce NaN orbits',()=>assert.throws(()=>A.elementsAt(A.BODIES[0],NaN),TypeError));
test('Live clock is tied to wall time and ignores elapsed frame count',()=>{const c=new A.SimulationClock(A.J2000,0);close(c.value(100,A.J2000+5321),A.J2000+5321);close(c.value(900000,A.J2000+5321),A.J2000+5321);});
test('Timelapse progresses correctly even when no frames are rendered',()=>{const c=new A.SimulationClock(A.J2000,0);c.setRate(86400,0,A.J2000);close(c.value(1000,A.J2000),A.J2000+A.DAY);close(c.value(60000,A.J2000),A.J2000+60*A.DAY);});
test('Speed changes have no discontinuity in simulation time',()=>{const c=new A.SimulationClock(A.J2000,0);c.setRate(86400,0,A.J2000);const before=c.value(3210,A.J2000);c.setRate(604800,3210,A.J2000);close(c.value(3210,A.J2000),before);close(c.value(4210,A.J2000),before+7*A.DAY);});
test('Pausing and resuming accelerated time excludes paused duration',()=>{const c=new A.SimulationClock(A.J2000,0);c.setRate(86400,0,A.J2000);c.toggle(2000,A.J2000);const paused=c.value(2000);close(c.value(9000),paused);c.toggle(9000,A.J2000);close(c.value(10000),paused+A.DAY);});
test('Resuming a paused LIVE clock resynchronizes to actual wall time',()=>{const c=new A.SimulationClock(A.J2000,0);c.toggle(2000,A.J2000+2000);close(c.value(9000,A.J2000+9000),A.J2000+2000);c.toggle(9000,A.J2000+9000);close(c.value(10000,A.J2000+10000),A.J2000+10000);});
test('Selecting a date pauses and detaches the simulation from real time',()=>{const c=new A.SimulationClock(A.J2000,0);c.setDate(Date.UTC(2040,0,1),40);assert.equal(c.live,false);assert.equal(c.paused,true);close(c.value(9000),Date.UTC(2040,0,1));});
test('NOW restores actual time, normal speed and playing state',()=>{const c=new A.SimulationClock(A.J2000,0);c.setRate(31557600,0,A.J2000);c.toggle(1000,A.J2000);c.now(5000,A.J2000+5000);assert.equal(c.live,true);assert.equal(c.paused,false);assert.equal(c.rate,1);close(c.value(6000,A.J2000+6000),A.J2000+6000);});
test('Simulation time is bounded and invalid commands are rejected',()=>{
  const c=new A.SimulationClock(A.MAX_TIME-5000,0);c.setRate(86400,0,A.MAX_TIME-5000);close(c.value(10000),A.MAX_TIME);
  for(const v of [0,-1,NaN,Infinity])assert.throws(()=>c.setRate(v,0),RangeError);
  for(const v of [A.MIN_TIME-1,A.MAX_TIME+1,NaN,Infinity])assert.throws(()=>c.setDate(v,0),RangeError);
});
