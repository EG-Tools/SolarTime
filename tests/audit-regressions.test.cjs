'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('persisted restoration restarts an interrupted viewport settle',()=>{
  const app=read('src/app.js');
  assert.match(app,/pageshow',event=>\{[^}]*event\.persisted[^}]*refreshViewport\(\)/s);
  assert.match(app,/visibilitychange[^]*viewportLayers\.some\(layer=>layer\.classList\.contains\('viewport-resizing'\)\)\)refreshViewport\(\)/);
});

test('time-travel playback readout follows the actual clock rate',()=>{
  const app=read('src/app.js');
  assert.match(app,/clock\.live\|\|Math\.abs\(clock\.rate-1\)<1e-9\?'1 ×':speedText\(\)/);
  assert.match(app,/if\(signature===controlsUiSignature\)return;controlsUiSignature=signature/);
});

test('satellite orbit geometry is normalized and zoom is a draw transform',()=>{
  const renderer=read('src/renderer.js'),surface=read('src/surface.js');
  assert.match(renderer,/satelliteOrbitPoints\(body,ms\)/);
  assert.match(renderer,/A\.satelliteOrbit\(body,ms,1,90\)/);
  assert.doesNotMatch(renderer,/const key=Number\(radius\)/);
  assert.match(renderer,/satellite\.orbitRadius\);/);
  assert.match(surface,/vec3 p=a\*localScale\+worldOffset-anchor/);
  assert.match(surface,/uniform1f\(p\.u\.localScale,localScale\)/);
  const window={SolarAstro:A};vm.runInNewContext(renderer,{window,performance});
  const instance=Object.create(window.SolarRenderer.prototype);instance.satelliteOrbitCache=new Map();instance.stats={orbitBufferBuilds:0};
  const ms=Date.parse('2026-09-21T00:00:00Z'),first=instance.satelliteOrbitModel(A.MOON,ms),builds=instance.stats.orbitBufferBuilds;
  for(let i=0;i<40;i++)assert.equal(instance.satelliteOrbitModel(A.MOON,ms),first);
  assert.equal(instance.stats.orbitBufferBuilds,builds);
});

test('alignment dates use the selected clock zone without moving the physical event',()=>{
  const app=read('src/app.js'),astro=read('src/astro.js');
  assert.match(app,/output\.textContent=available&&alignmentTarget\?compactDay\(alignmentTarget\.ms\):'—'/);
  assert.match(app,/compactDate\(alignmentTarget\.ms\).*activeTimeZone\(\)/);
  assert.match(astro,/\['2048-05-28T00:00:00\.000Z'/);
});

test('Pluto display orbit reuses bounded five-year paths while its body position stays independent',()=>{
  const source=read('src/renderer.js'),pluto=A.BODIES.find(body=>body.id==='pluto');let builds=0;
  const fakeA={...A,orbitAt(body,ms,count){builds++;return Object.freeze([{x:ms,y:count,z:0}]);}},window={SolarAstro:null};window.SolarAstro=fakeA;
  vm.runInNewContext(source,{window,performance});
  const instance=Object.create(window.SolarRenderer.prototype);instance.precisionOrbitPathCache=new Map();
  const first=instance.orbitPath(pluto,Date.UTC(2080,0,1)),sameBucket=instance.orbitPath(pluto,Date.UTC(2084,11,31)),nextBucket=instance.orbitPath(pluto,Date.UTC(2085,0,1));
  assert.equal(first,sameBucket);assert.notEqual(first,nextBucket);assert.equal(builds,2);
  builds=0;instance.precisionOrbitPathCache.clear();for(let year=2080;year<2110;year++)instance.orbitPath(pluto,Date.UTC(year,0,1));
  assert.equal(builds,6,'thirty changing years build six display paths instead of thirty');
  for(let year=2100;year<2160;year+=5)instance.orbitPath(pluto,Date.UTC(year,0,1));
  assert.equal(instance.precisionOrbitPathCache.size,6);
  assert.match(source,/actual body position remains precision-evaluated every frame/);
});

test('inactive speed slider exposes its configured value as pending',()=>{
  const app=read('src/app.js');
  assert.match(app,/function selectedSpeedActive\(\)\{const cfg=SPEED_MODES\[speedMode\];return !clock\.live&&Math\.abs\(clock\.rate-cfg\.rate\(speedValues\[speedMode\]\)\)<1e-9;\}/);
  assert.match(app,/aria-valuetext',active\?selectedText:t\('speedUnitReady',\{unit:selectedText\}\)/);
  assert.match(app,/if\(!selectedSpeedActive\(\)\)\{applySpeed\(\);return;\}/);
});

test('a fully paused stable scene skips foreground draws but invalidations render immediately',()=>{
  const source=read('src/renderer.js'),app=read('src/app.js'),window={SolarAstro:A};
  vm.runInNewContext(source,{window,performance});
  const renderer=Object.create(window.SolarRenderer.prototype);
  Object.assign(renderer,{dirty:false,presentationDirty:false,presentationUntil:0,presentedResources:'stable',
    cameraTween:null,autoRotation:null,actualScaleTween:null,cameraChangeAt:-Infinity,
    resourceSignature:()=> 'stable',orbitRevealAlpha:()=>1});
  assert.equal(renderer.needsDraw(1000),false);
  renderer.invalidatePresentation();assert.equal(renderer.needsDraw(1000),true);
  renderer.presentationDirty=false;renderer.presentedResources='old';assert.equal(renderer.needsDraw(1000),true);
  assert.match(app,/const renderScene=!resizeFrame&&\(!clock\.paused\|\|activeMotion\|\|renderer\.needsDraw\(mono\)\)/);
  assert.match(app,/if\(renderScene\)\{\s*const renderStarted=/);
});

test('one simulation timestamp reuses planetary and satellite precision vectors',()=>{
  const source=read('src/renderer.js');let bodyCalls=0,satelliteCalls=0;
  const fakeA={...A,positionAt(body,ms){bodyCalls++;return A.positionAt(body,ms);},satelliteAt(body,ms,radius){satelliteCalls++;return A.satelliteAt(body,ms,radius);}};
  const window={SolarAstro:fakeA};vm.runInNewContext(source,{window,performance});
  const renderer=Object.create(window.SolarRenderer.prototype);
  Object.assign(renderer,{physicsMs:NaN,physicsBodies:new Map(),physicsSatellites:new Map()});
  const ms=Date.parse('2026-09-23T00:00:00Z'),earth=A.BODIES.find(body=>body.id==='earth');
  assert.equal(renderer.physicalAt(earth,ms),renderer.physicalAt(earth,ms));
  assert.equal(renderer.satelliteUnitAt(A.MOON,ms),renderer.satelliteUnitAt(A.MOON,ms));
  assert.equal(bodyCalls,1);assert.equal(satelliteCalls,1);
  renderer.physicalAt(earth,ms+1);renderer.satelliteUnitAt(A.MOON,ms+1);
  assert.equal(bodyCalls,2);assert.equal(satelliteCalls,2);
});
