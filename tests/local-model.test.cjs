'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../src/astro.js'),all=[A.SUN,...A.BODIES,A.MOON],signed=n=>A.wrap(n+Math.PI)-Math.PI;
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('Offline boot calibrates every body at current device time in under five seconds',()=>{
 const t=Date.UTC(2026,8,11,7,45,12),start=performance.now();const status=A.calibrateAt(t);
 for(const b of A.BODIES){const p=A.positionAt(b,t,true);assert.ok(Number.isFinite(p.x+p.y+p.z));}
 assert.ok(performance.now()-start<5000);assert.equal(status.epoch,t);assert.equal(status.source,'local');assert.equal(status.networkRequired,false);
});
test('Stored axial tilts preserve NASA precision and periods use seconds, not degrees per frame',()=>{
 for(const b of all){close(b.spinSeconds*100,Math.round(b.spinSeconds*100),1e-4);assert.notEqual(b.spinSeconds,0);close(b.tilt*1000,Math.round(b.tilt*1000),1e-9);
 if(b.periodSeconds)close(b.periodSeconds*100,Math.round(b.periodSeconds*100),1e-4);}
 close(A.BODIES[2].spinSeconds,86164.10,1e-9);
});
test('Planet obliquities and rendered J2000 pole vectors match NASA/NSSDCA data',()=>{
 assert.deepEqual(A.BODIES.map(b=>b.tilt),[.034,177.36,23.439,25.19,3.13,26.73,97.77,28.32,119.51]);
 for(const b of A.BODIES){
  const p=A.bodyAxes(b).pole,I=b.base[2]*A.DEG,O=b.base[5]*A.DEG;
  const orbitPole={x:Math.sin(O)*Math.sin(I),y:-Math.cos(O)*Math.sin(I),z:Math.cos(I)};
  const cosine=Math.sign(b.spin)*(p.x*orbitPole.x+p.y*orbitPole.y+p.z*orbitPole.z);
  const rendered=Math.acos(Math.max(-1,Math.min(1,cosine)))/A.DEG;
  assert.ok(Math.abs(rendered-b.tilt)<.11,`${b.id}: ${rendered} != ${b.tilt}`);
 }
});
test('References are reused throughout playback; no orbital-element rebuild on each frame',()=>{
 const t=Date.UTC(2026,8,11);A.calibrateAt(t);const before=A.modelStatus();
 for(let i=0;i<1200;i++)for(const b of A.BODIES){A.positionAt(b,t+i*16);A.rotationAt(b,t+i*16);}
 assert.equal(A.modelStatus().referenceEvaluations,before.referenceEvaluations);assert.equal(A.modelStatus().calibrations,before.calibrations);
});
test('The UTC year changes one cached reference, while elapsed-time loops continue',()=>{
 A.calibrateAt(Date.UTC(2026,11,31,23,59,59));const before=A.modelStatus();
 A.positionAt(A.BODIES[2],Date.UTC(2027,0,1));assert.equal(A.modelStatus().calibrations,before.calibrations+1);
 for(const b of all){const t=Date.UTC(2027,0,1,12);close(signed(A.rotationAt(b,t+1000)-A.rotationAt(b,t)),A.TAU/b.spinSeconds);}
});
test('Identical restart time produces identical positions and rotations without any saved cache',()=>{
 const t=Date.UTC(2026,8,11,12);A.calibrateAt(t);const first=all.map(b=>A.rotationAt(b,t));const p=A.BODIES.map(b=>A.positionAt(b,t));
 A.calibrateAt(Date.UTC(2029,4,5));A.calibrateAt(t);
 assert.deepEqual(all.map(b=>A.rotationAt(b,t)),first);assert.deepEqual(A.BODIES.map(b=>A.positionAt(b,t)),p);
});
test('Korean solar side is day near local noon and night near local midnight throughout the year',()=>{
 for(const month of [0,2,5,8,11]){const noon=Date.UTC(2026,month,15,3),midnight=Date.UTC(2026,month,15,15);
 A.calibrateAt(noon);assert.ok(A.siteSun(noon).altitude>10);assert.ok(A.siteSun(midnight).altitude< -10);}
});
test('Astronomy stays local while network access is limited to versioned visual assets',()=>{
 const root=path.resolve(__dirname,'..');
 for(const name of ['astro','app','renderer']){const s=fs.readFileSync(path.join(root,'src',name+'.js'),'utf8');assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|navigator\.onLine/);}
 const materials=fs.readFileSync(path.join(root,'src/materials.js'),'utf8');assert.doesNotMatch(materials,/\bfetch\s*\(|indexedDB|solarsystemscope|jsdelivr/);
 const surface=fs.readFileSync(path.join(root,'src/surface.js'),'utf8');assert.match(surface,/fetch\(url,\{mode:'cors',credentials:'omit',cache:'force-cache'\}\)/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/<(?:script|img)[^>]+src=["']https?:/);assert.doesNotMatch(html,/<link[^>]+href=["']https?:/);
});
