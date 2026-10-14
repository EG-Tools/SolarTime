'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const window={SolarSurfaceStyle:require('../src/surface-style.js')};vm.runInNewContext(read('src/surface.js'),{window,performance});
const shade=window.SolarSurface.eclipseLight;
test('a satellite shadow is soft, capped and restricted to the sunlit receiving surface with a fully dark centre',()=>{
 const light=[0,0,1],caster=[0,0,10,.2];
 assert.ok(Math.abs(shade(0,0,1,light,caster,.001,1000))<1e-6);
 assert.equal(shade(0,0,1,light,[0,0,-10,.1],.001,1000),1);
 assert.equal(shade(0,0,-1,light,caster,.001,1000),1);
 assert.equal(shade(.5,0,Math.sqrt(.75),light,caster,.001,1000),1);
 const edge=shade(.1,0,Math.sqrt(.99),light,caster,.001,1000);assert.ok(edge>0&&edge<1);
 assert.equal(shade(0,0,1,light,caster,.05,1000),0,'solar spread does not weaken the presentation centre');
 assert.equal(shade(0,0,1,light,[0,0,0,0],0,1000),1);
});
test('the presentation footprint doubles only the soft outer shadow, not its shared centre strength',()=>{
 const light=[0,0,1],caster=[0,0,10,.2];
 const center=shade(0,0,1,light,caster,.001,1000);
 const inner=shade(.1,0,Math.sqrt(.99),light,caster,.001,1000);
 const outer=shade(.18,0,Math.sqrt(1-.18**2),light,caster,.001,1000);
 assert.ok(Math.abs(center)<1e-6);
 assert.ok(inner>center&&inner<1);
 assert.ok(outer>inner&&outer<1);
 assert.equal(shade(.25,0,Math.sqrt(1-.25**2),light,caster,.001,1000),1);
});
test('only the Moon/Earth and Europa/Jupiter pairs cast planet shadows',()=>{
 const source=read('src/renderer.js');assert.match(source,/ECLIPSE_CASTERS=Object\.freeze\(\{earth:'moon',jupiter:'europa'\}\)/);
 assert.match(source,/ECLIPSE_NORMAL_SHADOW_SCALE=Object\.freeze\(\{moon:3,europa:1\}\)/);
 assert.match(source,/eclipseCasterId=ECLIPSE_CASTERS\[body\.id\]/);
 assert.match(source,/value\.id===eclipseCasterId/);
 assert.match(source,/satelliteUnitAt\(satellite,ms\)/);
 assert.match(source,/moonRadius=mix\(displayRatio,physicalRatio,shadowPhysicalMix\)/);
 assert.match(source,/ECLIPSE_FOOTPRINT_SCALE=2/);
 assert.match(source,/caster\[3\]=moonRadius\*ECLIPSE_FOOTPRINT_SCALE/);
 for(const shader of [window.SolarSurface.shaderSources.planet,window.SolarSurface.kernel().shaderSources.fragment])assert.match(shader,/col\*=eclipseLight\(n\)/);
});

test('Earth-like and Jupiter-like solar spreads share full centre darkness and smooth edges',()=>{
 const light=[0,0,1],caster=[0,0,10,.5];
 for(const spread of [.293/9,.0075/9]){
  assert.equal(shade(0,0,1,light,caster,spread,1000),0);
  let previous=0;
  for(let i=0;i<=99;i++){
   const x=i/100,value=shade(x,0,Math.sqrt(1-x*x),light,caster,spread,1000);
   assert.ok(value>=previous-1e-9&&value<=1);previous=value;
  }
  assert.equal(previous,1);
 }
 for(const shader of [window.SolarSurface.shaderSources.planet,window.SolarSurface.kernel().shaderSources.fragment]){
  assert.match(shader,/return 1\.-coverage\*smoothstep/);
  assert.doesNotMatch(shader,/float peak=min/);
 }
});

test('half-size presentation contracts the complete shadow and keeps centre strength',()=>{
 const light=[0,0,1],caster=[0,0,10,.5];
 for(const scale of [.5,.75,1])assert.equal(shade(0,0,1,light,caster,.02,1000,scale),0);
 const x=.4,z=Math.sqrt(1-x*x);
 assert.ok(shade(x,0,z,light,caster,.02,1000,1)<1);
 assert.equal(shade(x,0,z,light,caster,.02,1000,.5),1);
});
