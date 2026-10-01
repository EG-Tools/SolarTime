'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),window={SolarAstro:A};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),{window,performance:{now:()=>0}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(){
 const r=Object.create(window.SolarRenderer.prototype);
 Object.assign(r,{w:1280,h:800,options:{actualScale:false},actualScaleMix:0,bodyScales:{},camera:r.defaultCameraSnapshot(),clearLabels(){}});return r;
}
const plain=value=>JSON.parse(JSON.stringify(value));
const sizes=r=>Object.fromEntries(r.allBodies().map(body=>[body.id,body.size*r.bodySizeScale(body)]));

test('baseline slider ranges share the Moon/Pluto floor and the current parent ceiling',()=>{
 const r=fixture(),expected={sun:[1,3],mercury:[.25,4],venus:[.25,4],earth:[.25,4],mars:[.25,4],jupiter:[.125,2],saturn:[.125,2],uranus:[.125,2],neptune:[.125,2],pluto:[1,16],moon:[1,4],europa:[.5,4]};
 for(const [id,[min,max]] of Object.entries(expected))assert.deepEqual(plain(r.bodyScaleLimits(id)),{min,max},id);
});

test('every body reaches its exact limits and satellites never exceed their parent',()=>{
 for(const body of fixture().allBodies()){
  const r=fixture(),limits=r.bodyScaleLimits(body);
  assert.equal(r.setBodyScale(body.id,-100),true);close(r.bodySizeScale(body),limits.min);
  if(body.id!=='sun')close(sizes(r)[body.id],A.MOON.size);
  r.setBodyScale(body.id,10000);close(r.bodySizeScale(body),limits.max);
  if(body.id!=='sun')close(sizes(r)[body.id],sizes(r)[body.parent||'sun']);
 }
});

test('Earth enlarged to the Sun lets the Moon reach the same size; shrinking cascades',()=>{
 const r=fixture();r.setBodyScale('earth',4);close(r.bodyScaleLimits('moon').max,16);
 r.setBodyScale('moon',16);close(sizes(r).moon,sizes(r).earth);close(sizes(r).moon,sizes(r).sun);
 r.setBodyScale('earth',1);close(r.bodySizeScale('moon'),4);close(sizes(r).moon,sizes(r).earth);
 r.setBodyScale('earth',.25);close(r.bodySizeScale('moon'),1);close(r.bodyScaleLimits('moon').max,1);
});

test('Europa follows Jupiter including its 12.5% minimum and clamped per-body reset',()=>{
 const r=fixture();r.setBodyScale('jupiter',2);close(r.bodyScaleLimits('europa').max,8);
 r.setBodyScale('europa',8);close(sizes(r).europa,sizes(r).sun);
 r.setBodyScale('jupiter',.125);close(r.bodySizeScale('jupiter'),.125);close(r.bodySizeScale('europa'),.5);
 assert.deepEqual(plain(r.bodyScaleLimits('europa')),{min:.5,max:.5});
 r.resetBodyScale('europa');close(r.bodySizeScale('europa'),.5);
});

test('Sun resize updates all planetary ceilings and their satellites in one transaction',()=>{
 const r=fixture();r.setBodyScales({sun:3,earth:12,moon:48,jupiter:6,europa:24,pluto:48});
 for(const id of ['earth','moon','jupiter','europa','pluto'])close(sizes(r)[id],84);
 r.setBodyScale('sun',1);
 for(const id of ['earth','moon','jupiter','europa','pluto'])close(sizes(r)[id],28);
 close(r.bodyScaleLimits('earth').max,4);close(r.bodyScaleLimits('jupiter').max,2);
});

test('saved body size restoration is parent-first, independent of JSON property order',()=>{
 const entries=[['moon',48],['europa',24],['earth',12],['jupiter',6],['sun',3]],a=fixture(),b=fixture();
 a.setBodyScales(Object.fromEntries(entries));b.setBodyScales(Object.fromEntries([...entries].reverse()));
 assert.deepEqual(plain(a.getBodyScales()),plain(b.getBodyScales()));
 const c=fixture();c.setBodyScales(a.getBodyScales());assert.deepEqual(plain(c.getBodyScales()),plain(a.getBodyScales()));
 a.setBodyScales(Object.fromEntries(a.allBodies().map(body=>[body.id,1])));
 assert.ok(Object.values(a.getBodyScales()).every(value=>value===1));
});

test('fractional percent floors and dynamic maxima retain exact 0.1% precision',()=>{
 const r=fixture();r.setBodyScale('jupiter',.125);close(r.bodySizeScale('jupiter'),.125);
 r.setBodyScale('jupiter',.126);close(r.bodySizeScale('jupiter'),.126);
 r.setBodyScale('earth',1.337);close(r.bodyScaleLimits('moon').max,5.348);
 r.setBodyScale('moon',100);close(r.bodySizeScale('moon'),5.348);
 r.setBodyScale('moon',-1);close(r.bodySizeScale('moon'),1);r.setBodyScale('pluto',-1);close(r.bodySizeScale('pluto'),1);
});

test('physical mode still locks planet controls and uses unchanged physical radii',()=>{
 const r=fixture();r.setBodyScales({earth:4,moon:16});r.options.actualScale=true;r.actualScaleMix=1;
 assert.equal(r.setBodyScale('earth',2),false);close(r.bodySizeScale('earth'),4);
 r.setBodyScale('sun',2);
 for(const body of r.allBodies())close(r.bodyRadiusAtZoom(body)/r.bodyRadiusAtZoom(A.SUN),A.BODY_RADIUS_KM[body.id]/A.BODY_RADIUS_KM.sun);
});

test('invalid size requests do not create arbitrary state or corrupt a valid hierarchy',()=>{
 const r=fixture();assert.equal(r.setBodyScale('unknown',2),false);assert.equal(r.setBodyScale('earth',NaN),false);
 const before=plain(r.getBodyScales());r.setBodyScales({unknown:999,moon:Infinity,earth:NaN});
 assert.deepEqual(plain(r.getBodyScales()),before);assert.equal(r.bodyScales.unknown,undefined);
});

function frame(r,zoom,dolly,mode,spacing=1){
 Object.assign(r.camera,{zoom,dolly});r.actualScaleMix=mode;r.options.actualOrbitSpacing=spacing;
 r.overviewFitScale=.25;r.actualFitScale=r.actualScaleFit();
 const mix=r.orbitScaleMix();r.fitScale=r.overviewFitScale*(1-mix)+r.actualFitScale*mix;r.scale=r.fitScale*zoom*dolly;
}

test('local orbit controls clamp and restore their 1–100% range',()=>{
 const r=fixture();r.setSatelliteOrbitScales({sun:0,earth:-5,jupiter:2});
 assert.deepEqual(plain(r.getSatelliteOrbitScales()),{sun:.01,earth:.01,jupiter:1});
 for(const id of ['sun','earth','jupiter']){
  assert.deepEqual(plain(r.satelliteOrbitScaleLimits(id)),{min:.01,max:1});
  r.setSatelliteOrbitScale(id,0);close(r.satelliteOrbitScale(id),.01);
 }
});

test('even at 1% Mercury and its orbit stay clear of an enlarged Sun through camera and scale changes',()=>{
 const mercury=A.BODIES[0],points=A.orbitAt(mercury,Date.parse('2026-10-01T00:00:00Z'),36);
 for(const sun of [1,3])for(const zoom of [.1,1.185,64])for(const dolly of [.002,1,15]){
  const r=fixture();r.setBodyScales({sun,mercury:sun*4});r.setSatelliteOrbitScale('sun',.01);
  for(const mode of [0,.25,.75,1])for(const spacing of [0,.01,.1,1]){
   frame(r,zoom,dolly,mode,spacing);
   const minimum=r.bodyRadiusAtZoom(A.SUN)+r.bodyRadiusAtZoom(mercury);
   for(const point of points){const world=r.displaySolarPoint(point,mercury);assert.ok(Math.hypot(world.x,world.y,world.z)*r.scale>minimum,'Mercury must clear both surfaces');}
  }
 }
});

test('Moon and Europa keep both surfaces clear at minimum spacing, even when as large as their parent',()=>{
 for(const satellite of A.SATELLITES){
  const parent=A.BODIES.find(body=>body.id===satellite.parent),points=A.satelliteOrbit(satellite,Date.parse('2026-10-01T00:00:00Z'),1,36);
  for(const zoom of [.1,1.185,64])for(const dolly of [.002,1,15]){
   const r=fixture();r.setBodyScales({sun:3,earth:12,moon:48,jupiter:6,europa:24});r.setSatelliteOrbitScale(parent.id,.01);
   for(const mode of [0,.25,.75,1])for(const spacing of [0,.01,1]){
    frame(r,zoom,dolly,mode,spacing);const layout={};r.satelliteOrbitRadius(satellite,parent,layout);
    const minimum=r.bodyRadiusAtZoom(parent)+r.bodyRadiusAtZoom(satellite);
    for(const point of points){const world=r.displaySatellitePoint(point,layout,{x:0,y:0,z:0});assert.ok(Math.hypot(world.x,world.y,world.z)*r.scale>minimum,satellite.id+' must clear both surfaces');}
   }
  }
 }
});

test('solar clearance changes only shared draw weights, not orbit buffers',()=>{
 const r=fixture(),body=A.BODIES[0],path={body,points:A.orbitAt(body,Date.parse('2026-10-01T00:00:00Z'),36)};
 Object.assign(r,{orbitModelCache:new WeakMap(),stats:{orbitBufferBuilds:0}});r.setBodyScales({sun:3,mercury:12});r.setSatelliteOrbitScale('sun',.01);
 frame(r,1,1,0);const before=r.orbitModel(path),builds=r.stats.orbitBufferBuilds;
 for(const zoom of [.1,.5,1,64]){
  frame(r,zoom,1,0);assert.equal(r.orbitModel(path),before);
  const weights=r.solarOrbitMorph();assert.ok(weights[0]>=1);close(weights[0],weights[2]);
  const world=r.displaySolarPoint(path.points[0],body);close(Math.hypot(world.x,world.y,world.z),r.overviewSolarRadius(body.base[0],body)*weights[0]);
 }
 assert.equal(r.stats.orbitBufferBuilds,builds);
});
