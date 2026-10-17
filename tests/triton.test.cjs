'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../src/astro.js');
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
test('Triton shares the satellite catalog and Pluto display size but has its measured true radius',()=>{
assert.equal(A.TRITON.parent,'neptune');assert.ok(A.SATELLITES.includes(A.TRITON));assert.equal(A.TRITON.size,A.BODIES.find(b=>b.id==='pluto').size);
assert.ok(Math.abs(A.BODY_RADIUS_KM.triton/A.BODY_RADIUS_KM.pluto-1.138938)<.00001);assert.ok(Math.abs(A.SATELLITE_MEAN_AU.triton*A.AU_KM-354800)<1e-8);
});
test('Triton mean orbit is finite, retrograde and preserves its orbital radius across dates',()=>{
const ra=299.8*A.DEG,dec=43.1*A.DEG,eps=23.4392911*A.DEG;
const eq={x:Math.cos(dec)*Math.cos(ra),y:Math.cos(dec)*Math.sin(ra),z:Math.sin(dec)},pole={x:eq.x,y:eq.y*Math.cos(eps)+eq.z*Math.sin(eps),z:-eq.y*Math.sin(eps)+eq.z*Math.cos(eps)};
for(const ms of [A.J2000,Date.UTC(2026,9,17),Date.UTC(2100,0,1)]){
const a=A.satelliteAt(A.TRITON,ms,354800),b=A.satelliteAt(A.TRITON,ms+60000,354800),h=cross(a,b);assert.ok(Math.abs(Math.hypot(a.x,a.y,a.z)-354800)<1e-6);assert.ok(h.x*pole.x+h.y*pole.y+h.z*pole.z<0);
const path=A.satelliteOrbit(A.TRITON,ms,1);assert.equal(path.length,91);assert.ok(path.every(p=>Object.values(p).every(Number.isFinite)));
}
});


test('satellite visibility is independent for each parent system',()=>{
const fs=require('fs'),vm=require('vm'),window={SolarAstro:A};vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),{window});const r=Object.create(window.SolarRenderer.prototype);r.options={moon:true,europa:true,triton:true};r.getBodies=()=>A.BODIES;
for(const body of A.SATELLITES){r.options[body.id]=false;const ids=r.sceneBodies().map(b=>b.id);assert.ok(!ids.includes(body.id));for(const other of A.SATELLITES.filter(b=>b!==body))assert.ok(ids.includes(other.id));r.options[body.id]=true;}
});

test('all satellite display positions preserve orbital inclination at every scale mix',()=>{
 const fs=require('fs'),vm=require('vm'),window={SolarAstro:A};vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),{window});const r=Object.create(window.SolarRenderer.prototype);r.bodyScales={};
 assert.equal(r.bodyScaleLimits(A.TRITON).min,.5);assert.equal(r.bodySizeScale(A.TRITON),1);
 for(const body of A.SATELLITES)for(const mix of [0,.2,.5,1]){
  const p=A.satelliteAt(body,A.J2000,1),length=Math.hypot(p.x,p.y,p.z),parent={x:10,y:20,z:30};
  const result=r.displaySatellitePoint(p,{orbitShape:[(1-mix)*10,mix*20,(1-mix)*10,mix*20]},parent);
  const scale=(1-mix)*10/length+mix*20;
  for(const k of ['x','y','z'])assert.ok(Math.abs(result[k]-parent[k]-p[k]*scale)<1e-9);
 }
});
