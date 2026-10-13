'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const window={SolarSurfaceStyle:require('../src/surface-style.js')};vm.runInNewContext(read('src/surface.js'),{window,performance});
const shade=window.SolarSurface.eclipseLight;
test('a satellite shadow is soft, capped and restricted to the sunlit receiving surface',()=>{
 const light=[0,0,1],caster=[0,0,10,.2];
 assert.ok(Math.abs(shade(0,0,1,light,caster,.001,1000)-.62)<1e-6);
 assert.equal(shade(0,0,1,light,[0,0,-10,.1],.001,1000),1);
 assert.equal(shade(0,0,-1,light,caster,.001,1000),1);
 assert.equal(shade(.5,0,Math.sqrt(.75),light,caster,.001,1000),1);
 const edge=shade(.1,0,Math.sqrt(.99),light,caster,.001,1000);assert.ok(edge>.62&&edge<1);
 assert.ok(shade(0,0,1,light,caster,.05,1000)>.9,'a small occulter cannot fully cover a larger solar disc');
 assert.equal(shade(0,0,1,light,[0,0,0,0],0,1000),1);
});
test('the presentation footprint doubles only the soft outer shadow, not its physical centre strength',()=>{
 const light=[0,0,1],caster=[0,0,10,.2];
 const center=shade(0,0,1,light,caster,.001,1000);
 const inner=shade(.1,0,Math.sqrt(.99),light,caster,.001,1000);
 const outer=shade(.18,0,Math.sqrt(1-.18**2),light,caster,.001,1000);
 assert.ok(Math.abs(center-.62)<1e-6);
 assert.ok(inner>center&&inner<1);
 assert.ok(outer>inner&&outer<1);
 assert.equal(shade(.25,0,Math.sqrt(1-.25**2),light,caster,.001,1000),1);
});
test('only the Moon/Earth and Europa/Jupiter pairs cast planet shadows',()=>{
 const source=read('src/renderer.js');assert.match(source,/ECLIPSE_CASTERS=Object\.freeze\(\{earth:'moon',jupiter:'europa'\}\)/);
 assert.match(source,/value\.id===ECLIPSE_CASTERS\[body\.id\]/);
 assert.match(source,/satelliteUnitAt\(satellite,ms\)/);
 assert.match(source,/A\.BODY_RADIUS_KM\[satellite\.id\]\/A\.BODY_RADIUS_KM\[body\.id\]/);
 assert.match(source,/ECLIPSE_FOOTPRINT_SCALE=2/);
 assert.match(source,/caster\[3\]=moonRadius\*ECLIPSE_FOOTPRINT_SCALE/);
 for(const shader of [window.SolarSurface.shaderSources.planet,window.SolarSurface.kernel().shaderSources.fragment])assert.match(shader,/col\*=eclipseLight\(n\)/);
});
