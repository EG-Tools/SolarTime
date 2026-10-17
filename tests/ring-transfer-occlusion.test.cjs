const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={SolarAstro:require('../src/astro.js')};vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),{window,performance:{now:()=>0}});
test('both transfer directions mask the exact rendered silhouettes even behind the camera',()=>{
 for(const [target,source] of [['saturn','uranus'],['uranus','saturn']]){
 const activePose={id:'active'},departedPose={id:'departed'},masks=[],r=Object.assign(Object.create(window.SolarRenderer.prototype),{w:800,h:600,ringTour:{bodyId:target,pose:{id:'uncorrected'},renderedSurfacePose:activePose},departedRingTour:{bodyId:source,pose:{id:'old'},renderedSurfacePose:departedPose},frameBodies:[{body:{id:target},screen:{behind:true},r:0},{body:{id:source},screen:{behind:true},r:0}],replayPresentation:()=>({solar:1}),particleSphereMask:pose=>{masks.push(pose);return {empty:false};},traceSphereMask(){}});
 let clips=0;const c={beginPath(){},rect(){},clip(rule){assert.equal(rule,'evenodd');clips++;}};
 r.clipParticleBodies(c,0);assert.deepEqual(masks,[activePose,departedPose]);assert.equal(clips,2);
 r.ringTour=null;assert.equal(r.ringBodySurfacePose(source),null,'retained geometry cannot mask ordinary view');
 }
});
