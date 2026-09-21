'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../src/astro.js');

const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','horizons-reference.json'),'utf8'));
const bodies=Object.fromEntries(A.BODIES.map(body=>[body.id,body]));
const satellites=Object.fromEntries(A.SATELLITES.map(body=>[body.id,body]));
const satelliteRadius={moon:.00256955529,europa:.004485883};
const currentTolerance={
  mercury:{angle:.12,distance:.0015},venus:{angle:.12,distance:.0015},earth:{angle:.12,distance:.0015},mars:{angle:.15,distance:.002},
  jupiter:{angle:.25,distance:.004},saturn:{angle:.35,distance:.006},uranus:{angle:.35,distance:.006},neptune:{angle:.35,distance:.006},
  pluto:{angle:.08,distance:.001}
};

const norm=vector=>Math.hypot(vector.x,vector.y,vector.z);
function angularError(a,b){
  const cosine=(a.x*b.x+a.y*b.y+a.z*b.z)/(norm(a)*norm(b));
  return Math.acos(Math.max(-1,Math.min(1,cosine)))/A.DEG;
}
const plain=vector=>({x:vector.x,y:vector.y,z:vector.z});

test('Horizons fixture is an explicit, offline NASA/JPL reference set',()=>{
  assert.equal(fixture.source.name,'NASA/JPL Horizons');
  assert.equal(fixture.source.referenceFrame,'Ecliptic of J2000.0');
  assert.equal(fixture.source.units,'AU');
  assert.ok(fixture.dates.length>=5);
  for(const id of [...Object.keys(bodies),'moon','europa'])assert.ok(fixture.targets[id].vectors.length>=5,id);
});

test('the requested date ranges select the intended ephemeris tier',()=>{
  assert.equal(A.ephemerisTier(Date.UTC(1800,0,1)),'jpl-1800-2050');
  assert.equal(A.ephemerisTier(Date.UTC(2050,11,31,23,59,59)),'jpl-1800-2050');
  assert.equal(A.ephemerisTier(Date.UTC(2051,0,1)),'jpl-long-term');
  assert.equal(A.ephemerisTier(Date.UTC(2999,11,31)),'jpl-long-term');
});

test('the 2051 coefficient boundary is position-continuous',()=>{
  for(const body of A.BODIES){
    const before=A.positionAt(body,A.CURRENT_END-1),after=A.positionAt(body,A.CURRENT_END);
    assert.ok(angularError(before,after)<1e-5,`${body.id} direction`);
    assert.ok(Math.abs(norm(before)-norm(after))<1e-8,`${body.id} radius`);
  }
});

test('1800–2050 planetary positions stay within the documented approximate-ephemeris envelope',()=>{
  for(const [id,tolerance] of Object.entries(currentTolerance))for(const vector of fixture.targets[id].vectors){
    const ms=Date.parse(vector.iso);if(A.ephemerisTier(ms)!=='jpl-1800-2050')continue;
    const actual=A.positionAt(bodies[id],ms),expected=plain(vector);
    assert.ok(angularError(actual,expected)<=tolerance.angle,`${id} ${vector.iso} angular error`);
    assert.ok(Math.abs(norm(actual)-norm(expected))/norm(expected)<=tolerance.distance,`${id} ${vector.iso} radial error`);
  }
});

test('long-term 2050–2999 mode remains a bounded approximation against available Horizons dates',()=>{
  for(const id of Object.keys(bodies))for(const vector of fixture.targets[id].vectors){
    const ms=Date.parse(vector.iso);if(A.ephemerisTier(ms)!=='jpl-long-term')continue;
    const actual=A.positionAt(bodies[id],ms),expected=plain(vector);
    const angleLimit=id==='pluto'?4:1.5,distanceLimit=id==='pluto'?.08:.035;
    assert.ok(angularError(actual,expected)<=angleLimit,`${id} ${vector.iso} angular error`);
    assert.ok(Math.abs(norm(actual)-norm(expected))/norm(expected)<=distanceLimit,`${id} ${vector.iso} radial error`);
  }
});

test('Moon, Europa and Pluto use dedicated precision vectors instead of their display ellipses',()=>{
  for(const id of ['moon','europa'])for(const vector of fixture.targets[id].vectors){
    const ms=Date.parse(vector.iso),actual=A.satelliteAt(satellites[id],ms,satelliteRadius[id]),expected=plain(vector);
    const angleLimit=A.ephemerisTier(ms)==='jpl-1800-2050'?.12:(id==='moon'?.3:.6);
    assert.ok(angularError(actual,expected)<angleLimit,`${id} ${vector.iso} angular error`);
    assert.ok(Math.abs(norm(actual)-norm(expected))/norm(expected)<.006,`${id} ${vector.iso} radial error`);
  }
  const pluto=bodies.pluto,ms=Date.parse('2026-09-21T00:00:00.000Z'),precise=A.positionAt(pluto,ms),ellipse=A.pointOnOrbit(A.elementsAt(pluto,ms),A.eccentricAnomaly(A.elementsAt(pluto,ms).M,A.elementsAt(pluto,ms).e));
  assert.ok(Math.hypot(precise.x-ellipse.x,precise.y-ellipse.y,precise.z-ellipse.z)>1e-6);
});

test('eclipse navigation uses physical shadow events rather than the display orbit',()=>{
  const total=A.eclipseEvent('moon',Date.parse('2024-01-01T00:00:00Z'),1);
  assert.equal(total.precision,'shadow');assert.equal(total.kind,'total');
  assert.ok(Math.abs(total.ms-Date.parse('2024-04-08T18:17:19Z'))<60000);
  const europa=A.eclipseEvent('europa',Date.parse('2026-09-21T00:00:00Z'),1),geometry=A.europaShadowGeometry(europa.ms);
  assert.equal(europa.precision,'shadow');assert.equal(geometry.intersects,true);assert.ok(geometry.impact<=1);
});

test('repeated eclipse navigation always moves strictly beyond the current event',()=>{
  for(const id of ['moon','europa'])for(const direction of [-1,1]){
    let ms=Date.parse('2026-09-21T00:00:00Z');
    const count=id==='moon'?40:120;
    for(let i=0;i<count;i++){
      const event=A.eclipseEvent(id,ms,direction);assert.ok(event,`${id} ${direction} step ${i}`);
      assert.ok(direction>0?event.ms>ms:event.ms<ms,`${id} ${direction} repeated ${new Date(ms).toISOString()}`);
      ms=event.ms;
    }
  }
});
