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
