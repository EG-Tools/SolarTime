'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('ring dependencies survive eviction and share one budget entry',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'),{window});
 const perf=window.SolarPerformance,job={id:'uranus',textureWidth:1024,requiredTextures:['saturn-ring']};
 const renderer={desired:new Map([['uranus',job]]),textures:new Map(['uranus','saturn-ring','earth'].map(name=>[name,{texture:{name},pixels:64,lastUsed:1}])),stats:{texturePixels:192},gl:{deleteTexture(){}}};
 perf.trimTextures(renderer,perf.textureBudget());
 assert.ok(renderer.textures.get('uranus').texture);assert.ok(renderer.textures.get('saturn-ring').texture);assert.equal(renderer.textures.get('earth').texture,null);
 const plan=perf.planTextures([job,{id:'saturn',textureWidth:1024,requiredTextures:['saturn-ring']}],{uranus:{},saturn:{},'saturn-ring':{}});
 assert.equal(plan.targets.get('saturn-ring'),1024);assert.equal(plan.bytes,1024*1024*4+1024*4);
});
test('constellation navigation visits every target once in either direction',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/sky.js'),'utf8'),{window});
 const source=fs.readFileSync(path.join(root,'src/app.js'),'utf8'),start=source.indexOf('const SKY_FEATURE_DIRECTIONS='),end=source.indexOf('const phaseCopy=',start);
 vm.runInNewContext(source.slice(start,end)+';window.testNeighbor=skyFeatureNeighbor;',{window});
 for(const direction of [-1,1]){const seen=new Set();let id='big-dipper';for(let i=0;i<Object.keys(window.SolarSky.FEATURES).length;i++){assert.ok(!seen.has(id));seen.add(id);const next=window.testNeighbor(id,direction);assert.equal(window.testNeighbor(next,-direction),id);id=next;}assert.equal(id,'big-dipper');assert.equal(seen.size,29);}
});
