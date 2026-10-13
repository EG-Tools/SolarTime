'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={SolarAstro:require('../src/astro.js'),SolarSky:class{},SolarSurface:{Service:class{}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),{window,performance:{now:()=>0}});
const R=window.SolarRenderer.prototype;

function clipContext(){
 const calls=[];
 return {calls,save(){calls.push(['save']);},restore(){calls.push(['restore']);},beginPath(){},rect(...v){calls.push(['rect',...v]);},moveTo(){},arc(...v){calls.push(['arc',...v]);},ellipse(...v){calls.push(['ellipse',...v]);},clip(rule){calls.push(['clip',rule]);}};
}

test('every visible solid planet cuts its full disc out of the particle pass',()=>{
 const r=Object.assign(Object.create(R),{w:800,h:600,ringTour:null,frameBodies:[
  {body:{id:'earth'},screen:{x:300,y:240,behind:false},r:45},
  {body:{id:'uranus'},screen:{x:520,y:330,behind:false},r:18}
 ],replayPresentation:()=>({solar:1}),visible:()=>true});
 const c=clipContext();r.clipParticleBodies(c,0);
 const arcs=c.calls.filter(row=>row[0]==='arc'),clips=c.calls.filter(row=>row[0]==='clip');
 assert.deepEqual(arcs.map(row=>row[3]),[45.5,18.5]);
 assert.deepEqual(clips,[['clip','evenodd'],['clip','evenodd']]);
 r.replayPresentation=()=>({solar:0});r.clipParticleBodies(c,1);
 assert.equal(c.calls.filter(row=>row[0]==='clip').length,2,'a hidden solar scene must not leave dark particle holes');
});

test('Saturn travel uses its exact camera-space sphere mask and leaves the ring material out',()=>{
 const pose={fov:72,perspective:1,orthoScale:1,offset:[0,0],eye:[0,0,10],right:[1,0,0],up:[0,1,0],forward:[0,0,-1]};
 const r=Object.assign(Object.create(R),{w:800,h:600,ringTour:{pose},frameBodies:[
  {body:{id:'saturn'},screen:{x:400,y:300,behind:false},r:90},
  {body:{id:'earth'},screen:{x:620,y:320,behind:false},r:20}
 ],replayPresentation:()=>({solar:1}),visible:()=>true});
 const c=clipContext();r.clipParticleBodies(c,0);
 assert.equal(c.calls.filter(row=>row[0]==='ellipse').length,1,'Saturn sphere uses the travel camera silhouette');
 assert.deepEqual(c.calls.filter(row=>row[0]==='arc').map(row=>row[3]),[20.5],'Saturn is not clipped again as a flat disc');
 assert.equal(c.calls.filter(row=>row[0]==='clip').length,2);
});

test('opening, Saturn entry and ring-flight particles all share the body clipping owner',()=>{
 const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8');
 assert.match(source,/drawOpeningParticles[\s\S]*?this\.drawParticlePass\(c,mono/);
 assert.match(source,/drawFlightParticles\(c,field,project\)[\s\S]*?this\.isSaturnEntryParticleField\(field\)\?this\.drawSaturnFlightParticles/);
 assert.match(source,/tour\.flightField\.alpha>0[\s\S]*?this\.drawParticlePass\(this\.ctx,mono/);
 const r=Object.assign(Object.create(R),{w:1,h:1,replayPresentation:()=>({solar:1}),frameBodies:[],visible:()=>true});
 const c=clipContext();let drawn=false;r.drawParticlePass(c,0,()=>{drawn=true;});
 assert.equal(drawn,true);assert.deepEqual(c.calls.map(row=>row[0]),['save','restore']);
});

test('planet layer follows the continuous scene envelope and restores styles',()=>{
 const style={opacity:'.8',transition:'opacity .4s',visibility:''},r=Object.assign(Object.create(R),{gpu:{canvas:{style}}});
 for(let step=0;step<100;step++){const alpha=step/100;r.setReplaySolarOpacity(alpha);assert.ok(Math.abs(Number(style.opacity)-alpha*.8)<1e-12);assert.equal(style.visibility,step?'':'hidden');assert.equal(style.transition,'none');}
 r.setReplaySolarOpacity(1);assert.deepEqual(style,{opacity:'.8',transition:'opacity .4s',visibility:''});
 for(let step=100;step>=0;step--){r.setReplaySolarOpacity(step/100);assert.ok(Math.abs(Number(style.opacity)-step/100*.8)<1e-12);}
 r.setReplaySolarOpacity(1);assert.equal(style.opacity,'.8');
});

test('GPU surface masks share scene opacity without abruptly erasing point cores',()=>{
 const r=Object.assign(Object.create(R),{dpr:2}),values=[];const c={globalAlpha:1,save(){this.before=this.globalAlpha;},restore(){this.globalAlpha=this.before;},beginPath(){},arc(){},fill(){values.push(this.globalAlpha);}};
 for(const a of [0,.01,.25,.5,.75,1])r.occludeDirectBodies(c,[{screen:{x:10,y:10},r:4}],a);
 assert.deepEqual(values,[0,.01,.25,.5,.75,1]);assert.equal(c.globalAlpha,1);
});
