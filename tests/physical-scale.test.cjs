'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),ms=Date.parse('2026-10-01T00:00:00Z');
const window={SolarAstro:A};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),{window,performance:{now:()=>0}});
const paths=A.BODIES.map(body=>({body,points:A.orbitAt(body,ms,360)}));
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const displayedRadius=(r,distance)=>r.displayPhysicalPoint({x:distance,y:0,z:0},{}).x;
function fixture(w,h,sun=1,pluto=true){
 const r=Object.create(window.SolarRenderer.prototype),camera=r.defaultCameraSnapshot();
 const mobile=w<680,compact=h<630,top=compact?100:mobile?192:190,bottom=h-(compact?105:mobile?195:190),baseY=(top+bottom)/2+h*.05;
 Object.assign(r,{w,h,camera,bodyScales:{sun},satelliteOrbitScales:{},options:{pluto,moon:true,overviewOrbitGap:86},actualScaleMix:1,overviewFitScale:.25,paths:paths.filter(p=>pluto||p.body.id!=='pluto'),cx:w/2,cy:baseY+h*camera.panY,projectionAnchor:null,stats:{orbitBufferBuilds:0},orbitModelCache:new WeakMap()});
 r.fitScale=r.actualFitScale=r.actualScaleFit();r.scale=r.fitScale*camera.zoom*camera.dolly;return {r};
}
// Decode the fixed endpoints with the same two independent shader weights.
function gpuPoint(r,model,i,body){
 const m=r.gpuOrbitCamera().solarMorph,ratio=model[i*4+3],out={},inclined=body?.id==='pluto';
 const flatten=inclined?1:Math.hypot(model[i*4],model[i*4+1],model[i*4+2])/Math.max(1e-12,Math.hypot(model[i*4],model[i*4+1]));
 for(const [j,k] of ['x','y','z'].entries()){
  const ordinary=k==='z'&&!inclined?0:flatten;
  out[k]=model[i*4+j]*(ordinary*m[0]+ratio*m[1]);
  out['depth'+k.toUpperCase()]=model[i*4+j]*(ordinary*m[2]+ratio*m[3]);
 }
 return out;
}

test('ordinary planets have equal 150%-scaled spacing, centered circles and only Pluto inclined',()=>{
 for(const gap of [50,86,100,173,300,400]){
  const {r}=fixture(1280,800);r.actualScaleMix=0;r.options.overviewOrbitGap=gap;
  let previous=0;
  for(const [index,path] of r.paths.entries()){
   const expected=A.OVERVIEW_ORBIT.start+gap*1.5*index;let maxZ=0;
   if(index)close(expected-previous,gap*1.5);previous=expected;
   for(const point of path.points){
    const world=r.displaySolarPoint(point,path.body);close(Math.hypot(world.x,world.y,world.z),expected);
    if(path.body.id!=='pluto')close(world.z,0);maxZ=Math.max(maxZ,Math.abs(world.z));
   }
   if(path.body.id==='pluto')assert.ok(maxZ>expected*.1,'Pluto keeps its inclined but centered circle');
   for(const days of [0,13,66,180,300]){
    const physical=A.positionAt(path.body,ms+days*A.DAY),world=r.displayPhysicalPoint(physical,{},path.body);
    close(Math.hypot(world.x,world.y,world.z),expected);
    const opposite=r.displayPhysicalPoint({x:-physical.x,y:-physical.y,z:-physical.z},{},path.body);
    for(const key of ['x','y','z'])close(world[key]+opposite[key],0);
   }
  }
 }
});

test('ordinary satellite paths and bodies are circles centered on their parent',()=>{
 const {r}=fixture(1280,800);r.actualScaleMix=0;r.fitScale=r.overviewFitScale;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
 r.satelliteOrbitCache=new Map();const origin={x:120,y:-45,z:30,depthX:140,depthY:-35,depthZ:20};
 for(const satellite of A.SATELLITES){
  const parent=A.BODIES.find(body=>body.id===satellite.parent),layout={};
  layout.orbitRadius=r.satelliteOrbitRadius(satellite,parent,layout);
  const points=r.satelliteOrbitPoints(satellite,ms).points,model=r.satelliteOrbitModel(satellite,ms);
  assert.equal(model.length,points.length*4);
  for(const point of [...points,A.satelliteAt(satellite,ms,1)]){
   const world=r.displaySatellitePoint(point,layout,origin);
   close(Math.hypot(world.x-origin.x,world.y-origin.y,world.z-origin.z),layout.orbitRadius);
   close(world.z,origin.z);close(world.depthZ,origin.depthZ);
  }
 }
});

test('satellite circle-to-physical positions and depth interpolate without endpoint jumps',()=>{
 for(const spacing of [0,.1,.4,1])for(const satellite of A.SATELLITES){
  const {r}=fixture(1280,800),parent=A.BODIES.find(body=>body.id===satellite.parent),point=A.satelliteAt(satellite,ms,1),origin={x:0,y:0,z:0};
  r.options.actualOrbitSpacing=spacing;
  const sample=p=>{
   r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*r.orbitScaleMix();r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
   const layout={};layout.orbitRadius=r.satelliteOrbitRadius(satellite,parent,layout);
   return {world:r.displaySatellitePoint(point,layout,origin),scale:r.scale,layout};
  };
  const start=sample(0),end=sample(1);
  for(const key of ['x','y','z'])close(end.world[key],point[key]*end.layout.orbitRadius);
  for(const p of [1e-7,.01,.25,.5,.75,.99,1-1e-7]){
   const current=sample(p);
   for(const key of ['x','y','z']){
    close(current.world[key]*current.scale,start.world[key]*start.scale*(1-p)+end.world[key]*end.scale*p);
    const depth='depth'+key.toUpperCase();close(current.world[depth],start.world[depth]*(1-p)+end.world[depth]*p);
   }
  }
 }
});

test('100% actual distances retain a visible Sun and put the outer planets beyond the default viewport',()=>{
 for(const [w,h] of [[1280,800],[1920,1080],[390,844],[844,390]])for(const sun of [1,1.54,3])for(const pluto of [true,false]){
  const {r}=fixture(w,h,sun,pluto),outer=pluto?'pluto':'neptune',sunRadius=r.bodyRadiusAtZoom(A.SUN);
  let mercuryClearance=Infinity,outerMinimum=Infinity;
  for(const path of r.paths)for(const point of path.points){
   const world=r.displaySolarPoint(point,path.body),p=r.project(world);
   close(Math.hypot(world.x,world.y,world.z)*r.scale/sunRadius,point.physicalDistance*A.AU_KM/A.BODY_RADIUS_KM.sun);
   if(path.body.id===outer)outerMinimum=Math.min(outerMinimum,Math.hypot(p.x-r.cx,p.y-r.cy));
   if(path.body.id==='mercury')mercuryClearance=Math.min(mercuryClearance,Math.hypot(p.x-r.cx,p.y-r.cy));
  }
  assert.ok(outerMinimum>Math.hypot(w,h));
  assert.ok(mercuryClearance>sunRadius+r.bodyRadiusAtZoom(A.BODIES[0]));
  close(sunRadius,A.SUN.size*sun*r.bodyScaleForZoom(r.camera.zoom)*r.camera.dolly);
 }
});

test('actual-scale orbits expand monotonically instead of overshooting during the mode transition',()=>{
 const {r}=fixture(1280,800),normal=r.overviewFitScale,actual=r.actualFitScale;
 for(const au of [.3,1,5,30,50]){
  const start=A.displayDistance(au,0,86,1.5)*normal,end=au*A.TRUE_SCALE_UNITS_PER_AU*actual;
  let previous=start;
  for(let i=0;i<=100;i++){
   const p=i/100;r.actualScaleMix=p;r.fitScale=normal+(actual-normal)*p;
   const distance=displayedRadius(r,au)*r.fitScale;
   close(distance,start+(end-start)*p);assert.ok(distance>=previous-1e-6);previous=distance;
  }
 }
});

test('actual-scale body positions and GPU orbit buffers share one physical distance mapping',()=>{
 const {r}=fixture(1280,800);
 for(const path of r.paths){
  const model=r.orbitModel(path);
  for(let i=0;i<path.points.length;i++){
   const p=path.points[i],world=r.displaySolarPoint(p,path.body),gpu=gpuPoint(r,model,i,path.body),length=Math.hypot(p.x,p.y,p.z);
   const physical={x:p.x/length*p.physicalDistance,y:p.y/length*p.physicalDistance,z:p.z/length*p.physicalDistance},display={};r.displayPhysicalPoint(physical,display,path.body);
   for(const key of ['x','y','z']){close(world[key],display[key]);close(gpu[key],world[key],.001);}
  }
 }
 const before=r.orbitModel(r.paths[0]);r.camera.zoom=250;r.fitScale=r.actualFitScale=r.actualScaleFit();
 assert.equal(r.orbitModel(r.paths[0]),before,'lens changes scale, not physical orbit buffers');
 r.actualScaleMix=0;
 for(const au of [.3,1,5,30,50])close(displayedRadius(r,au),A.displayDistance(au,0,86,1.5)*r.solarOrbitHierarchyScale());
});

test('0–10% blends normal orbits, and 10–100% remaps the former 1–100% without changing body sizes',()=>{
 const {r}=fixture(1280,800),sun=r.bodyRadiusAtZoom(A.SUN),earth=A.BODIES.find(b=>b.id==='earth');
 const earthRadius=r.bodyRadiusAtZoom(earth),moonRadius=r.bodyRadiusAtZoom(A.MOON),moonOrbit=r.satelliteOrbitRadius(A.MOON,earth);
 const initial=r.orbitModel(r.paths[0]);
 for(const [amount,weight] of [[0,0],[.01,.001],[.05,.005],[.1,.01],[.37,.307],[.55,.505],[.75,.725],[1,1]]){
  r.setOption('actualOrbitSpacing',amount);
  r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*weight;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
  close(r.actualOrbitSpacing(),amount);close(r.orbitScaleMix(),weight);
  for(const au of [.3,1,5,30,50]){
   const ordinary=A.displayDistance(au,0,86,1.5)*r.overviewFitScale,actual=au*A.TRUE_SCALE_UNITS_PER_AU*r.actualFitScale;
   close(displayedRadius(r,au)*r.fitScale,ordinary+(actual-ordinary)*weight);
  }
  close(r.bodyRadiusAtZoom(A.SUN),sun);close(r.bodyRadiusAtZoom(earth),earthRadius);
  close(r.satelliteOrbitRadius(A.MOON,earth)*r.scale,moonOrbit*r.actualFitScale*r.camera.zoom*r.camera.dolly);
  const model=r.orbitModel(r.paths[0]);
  assert.equal(model,initial,'spacing is a shader weight, not a vertex-buffer rebuild');
 }
 for(const [input,expected] of [[0,0],[-1,0],[2,1],[NaN,1],[Infinity,1]]){r.setOption('actualOrbitSpacing',input);close(r.actualOrbitSpacing(),expected);}
});

test('the 10% boundary is continuous and spacing never reverses through either band',()=>{
 const {r}=fixture(1280,800);let previous=-1;
 for(let i=0;i<=1000;i++){
  r.options.actualOrbitSpacing=i/1000;const weight=r.orbitScaleMix();
  assert.ok(weight>=previous&&weight<=1);previous=weight;
 }
 for(const value of [.1-1e-9,.1,.1+1e-9]){
  r.options.actualOrbitSpacing=value;close(r.orbitScaleMix(),.01,2e-9);
  r.actualScaleMix=.5;close(r.orbitScaleMix(),.005,1e-9);r.actualScaleMix=1;
 }
});

test('perspective depth blends independently of fit with no departure dip or return snap',()=>{
 const {r}=fixture(1707,790);r.options.overviewOrbitGap=145;r.options.actualOrbitSpacing=.02;
 Object.assign(r.camera,{azimuth:5.393597172693909,elevation:.620064911444322,zoom:1.1853048513203654,dolly:.6004955788122657});
 r.overviewFitScale=.2939258712396784;r.actualFitScale=r.actualScaleFit();
 const set=p=>{r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;};
 const path=r.paths.find(p=>p.body.id==='neptune'),point=path.points[90];
 for(const dolly of [.002,.6,1,2]){
  r.camera.dolly=dolly;
  set(0);const start=r.displaySolarPoint(point,path.body),v0=r.view(start),scale0=r.scale,w0=1-r.viewDepth(start)*(dolly-1)/5000;
  set(1);const end=r.displaySolarPoint(point,path.body),v1=r.view(end),scale1=r.scale,w1=1-r.viewDepth(end)*(dolly-1)/5000;
  for(const p of [0,1e-7,.0002,.001,.01,.1,.5,.9,.999,1,.999,.9,.5,.1,.001,0]){
   set(p);const world=r.displaySolarPoint(point,path.body),screen=r.project(world),w=w0+(w1-w0)*p;
   for(const key of ['depthX','depthY','depthZ'])close(world[key],start[key]+(end[key]-start[key])*p);
   if(w>.002)close(screen.y,r.cy+(v0.y*scale0+(v1.y*scale1-v0.y*scale0)*p)/w);
  }
 }
 r.camera.dolly=.6004955788122657;
 const middle=p=>{set(p);const ys=path.points.map(p=>r.project(r.displaySolarPoint(p,path.body)).y);return (Math.min(...ys)+Math.max(...ys))/2;};
 const early=(16/2000)**2*(3-2*16/2000);
 assert.ok(Math.abs(middle(early)-middle(0))<.1,'first frame must not drop the orbit center by pixels');
 assert.ok(Math.abs(middle(1-early)-middle(1))<.1,'last frame must not snap the orbit center');
});

test('transition depth agrees across bodies, four-component GPU orbits and local satellite orbits',()=>{
 const {r}=fixture(1280,800);r.camera.dolly=.6;
 for(const p of [0,.0002,.15,.5,.99,1]){
  r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
  for(const path of r.paths){
   const model=r.orbitModel(path);
   for(let i=0;i<path.points.length;i+=30){
    const point=path.points[i],world=r.displaySolarPoint(point,path.body),gpu=gpuPoint(r,model,i,path.body),length=Math.hypot(point.x,point.y,point.z),physical={};
    const display=r.displayPhysicalPoint(Object.fromEntries(['x','y','z'].map(k=>[k,point[k]/length*point.physicalDistance])),physical,path.body);
    for(const k of ['X','Y','Z']){close(world['depth'+k],display['depth'+k]);close(gpu['depth'+k],world['depth'+k],.002);close(gpu[k.toLowerCase()],world[k.toLowerCase()],.002);}
   }
  }
 }
 for(const satellite of A.SATELLITES){
  const parent=A.BODIES.find(b=>b.id===satellite.parent),sample=p=>{
   r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
   const layout={};r.satelliteOrbitRadius(satellite,parent,layout);return layout.orbitDepthRadius;
  },start=sample(0),end=sample(1);
  for(const p of [1e-7,.01,.25,.5,.75,.999999])close(sample(p),start+(end-start)*p);
 }
});

test('61-frame scale transitions and camera changes reuse every solar endpoint buffer',()=>{
 const {r}=fixture(1280,800),models=r.paths.map(path=>r.orbitModel(path)),built=r.stats.orbitBufferBuilds;
 for(const direction of [1,-1])for(let i=0;i<=60;i++){
  const p=direction===1?i/60:1-i/60;r.actualScaleMix=p;
  r.camera.zoom=.1+i*.15;r.camera.dolly=.01+i*.1;r.camera.azimuth+=.01;
  r.overviewFitScale=.25+i*.001;r.actualFitScale=r.actualScaleFit();r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;
  for(const [j,path] of r.paths.entries())assert.equal(r.orbitModel(path),models[j]);
 }
 assert.equal(r.stats.orbitBufferBuilds,built,'no per-frame vertex rebuilds');
 assert.equal(built,r.paths.reduce((sum,path)=>sum+path.points.length,0));
});

test('endpoint buffers invalidate only for source or layout changes, not scale-mode toggles',()=>{
 const {r}=fixture(1280,800),path=r.paths[0];let before=r.orbitModel(path);
 for(const update of [()=>r.setOption('overviewOrbitGap',173),()=>{r.bodyScales.sun=3;},()=>{r.satelliteOrbitScales.sun=.3;}]){
  update();const after=r.orbitModel(path);assert.notEqual(after,before);assert.equal(r.orbitModel(path),after);before=after;
 }
 const changed={...path,points:path.points.slice()},first=r.orbitModel(changed);changed.points=changed.points.slice();
 assert.notEqual(r.orbitModel(changed),first);
 for(const enabled of [false,true,false]){r.setOption('actualScale',enabled,false);assert.equal(r.orbitModel(path),before);}
});

test('GPU endpoint interpolation matches tracked CPU projection across spacing and near-endpoint progress',()=>{
 const {r}=fixture(1707,790,3),earth=r.paths.find(path=>path.body.id==='earth');
 for(const gap of [50,145,400])for(const spacing of [0,.01,.05,.1-1e-7,.1,.1+1e-7,.37,1])for(const dolly of [.002,.6,1,2]){
  r.options.overviewOrbitGap=gap;r.options.actualOrbitSpacing=spacing;r.camera.dolly=dolly;
  for(const p of [0,1e-7,.0002,.25,.5,.75,.9999999,1]){
   r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*dolly;
   r.projectionAnchor=r.displaySolarPoint(earth.points[17],earth.body);
   for(const path of r.paths){
    const model=r.orbitModel(path);
    for(let i=0;i<path.points.length;i+=90){
     const world=r.displaySolarPoint(path.points[i],path.body),gpu=gpuPoint(r,model,i,path.body);
     for(const key of ['x','y','z','depthX','depthY','depthZ'])close(gpu[key],world[key],.002);
     const a=r.project(world),b=r.project(gpu);assert.equal(a.behind,b.behind);
     if(!a.behind&&Math.abs(a.x-r.cx)<1707&&Math.abs(a.y-r.cy)<790){close(a.x,b.x,.1);close(a.y,b.y,.1);}
    }
   }
  }
 }
});

test('normal and actual orbit spacing retain separate values when switching modes',()=>{
 const {r}=fixture(1280,800);r.setOption('overviewOrbitGap',173);r.setOption('actualOrbitSpacing',.37);
 for(let i=0;i<4;i++){
  r.setOption('actualScale',false,false);r.fitScale=r.overviewFitScale;close(displayedRadius(r,1),A.displayDistance(1,0,173,1.5)*r.solarOrbitHierarchyScale());
  r.setOption('actualScale',true,false);r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*.307;
  close(displayedRadius(r,1)*r.fitScale,A.displayDistance(1,0,173,1.5)*r.overviewFitScale*.693+20*r.actualFitScale*.307);
  assert.equal(r.options.overviewOrbitGap,173);close(r.options.actualOrbitSpacing,.37);
 }
});

test('both modes keep an undistorted projection at every spacing and viewport aspect ratio',()=>{
 for(const [w,h] of [[390,844],[1280,800],[2560,1080]])for(const mode of [0,.0001,.25,.5,.99,1])for(const spacing of [0,.01,.05,.1,.41,1]){
  const {r}=fixture(w,h);r.actualScaleMix=mode;r.options.actualOrbitSpacing=spacing;
  for(const displayed of [null,0,.003,.27,.73,1]){
   r.orbitSpacingTween=displayed===null?null:{value:displayed};
   close(r.gpuOrbitCamera().lens,1);
   const point={x:30,y:60,z:10},view=r.view(point),direction=r.viewDirection(point);
   for(const key of ['x','y','z'])close(view[key],direction[key]);
  }
 }
});

test('face-on circles stay round while inclination still produces natural foreshortening',()=>{
 for(const mode of [0,.5,1]){
  const {r}=fixture(2560,1080);r.actualScaleMix=mode;r.camera.azimuth=0;
  for(const elevation of [Math.PI/2,Math.PI/6]){
   r.camera.elevation=elevation;
   const horizontal=r.view({x:100,y:0,z:0}),vertical=r.view({x:0,y:100,z:0});
   close(horizontal.x,100);close(-vertical.y,100*Math.sin(elevation));
  }
 }
});

test('0% keeps normal solar distances with undistorted projection and physical bodies',()=>{
 for(const gap of [50,145,400])for(const zoom of [.1,1,64])for(const dolly of [.002,1,5]){
  const {r}=fixture(1280,800,3);r.options.overviewOrbitGap=gap;r.camera.zoom=zoom;r.camera.dolly=dolly;
  r.actualFitScale=r.actualScaleFit();r.fitScale=r.overviewFitScale;r.scale=r.fitScale*zoom*dolly;r.actualScaleMix=0;
  const world=r.paths.map(path=>path.points.filter((_,i)=>i%90===0).map(point=>r.displaySolarPoint(point,path.body)));
  const normal=world.map(points=>points.map(point=>r.project(point)));
  r.options.actualOrbitSpacing=0;r.actualScaleMix=1;
  for(const [i,path] of r.paths.entries())for(const [j,point] of path.points.filter((_,i)=>i%90===0).entries()){
   const position=r.displaySolarPoint(point,path.body);
   for(const key of ['x','y','z','depthX','depthY','depthZ'])close(position[key],world[i][j][key]);
   const actual=r.project(position);assert.equal(actual.behind,normal[i][j].behind);
   for(const key of actual.behind?['z']:['x','y','z'])close(actual[key],normal[i][j][key]);
  }
  close(r.bodyRadiusAtZoom(A.BODIES[2])/r.bodyRadiusAtZoom(A.SUN),A.BODY_RADIUS_KM.earth/A.BODY_RADIUS_KM.sun);
 }
});

test('the remapped minimum actual spacing keeps Mercury outside the Sun at every orbital position',()=>{
 for(const sunScale of [1,2,3]){
  const {r}=fixture(1280,800,sunScale);r.setOption('actualOrbitSpacing',.1);
  close(r.actualOrbitSpacing(),.1);close(r.orbitScaleMix(),.01);
  r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*.01;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
  const mercury=r.paths.find(p=>p.body.id==='mercury'),clearance=r.bodyRadiusAtZoom(A.SUN)+r.bodyRadiusAtZoom(mercury.body);
  for(const point of mercury.points){const world=r.displaySolarPoint(point,mercury.body);assert.ok(Math.hypot(world.x,world.y,world.z)*r.scale>clearance);}
 }
});

test('ordinary 100% size ratios stay fixed across zoom, travel, tracking and viewport sizes',()=>{
 const ratios={sun:1,mercury:.25,venus:.25,earth:.25,mars:.25,jupiter:.5,saturn:.5,uranus:.5,neptune:.5,moon:.0625,pluto:.0625,europa:.125};
 for(const [w,h] of [[1280,800],[390,844]])for(const zoom of [.1,1,4,64,2048])for(const dolly of [.002,1,12])for(const focus of [null,'earth','moon']){
  const {r}=fixture(w,h);r.actualScaleMix=0;Object.assign(r.camera,{zoom,dolly,focus});
  const sun=r.bodyRadiusAtZoom(A.SUN);
  for(const body of r.allBodies()){
   close(r.bodyRadiusAtZoom(body)/sun,ratios[body.id]);
   const limits=r.bodyScaleLimits(body);assert.ok(limits.min<=1&&limits.max>=1,body.id+' supports 100%');
   r.bodyScales[body.id]=1.5;close(r.bodyRadiusAtZoom(body)/sun,ratios[body.id]*1.5);delete r.bodyScales[body.id];
  }
 }
});

test('Moon and Europa retain expanded 100% spacing unless current body clearance requires more',()=>{
 for(const satellite of A.SATELLITES)for(const custom of [1,2,3.5])for(const zoom of [.1,1.185,64]){
  const {r}=fixture(1280,800),parent=A.BODIES.find(b=>b.id===satellite.parent);
  r.actualScaleMix=0;r.bodyScales[parent.id]=custom;r.camera.zoom=zoom;
  r.fitScale=r.overviewFitScale;r.scale=r.fitScale*zoom*r.camera.dolly;
  const radius=value=>{r.satelliteOrbitScales[parent.id]=value;return r.satelliteOrbitRadius(satellite,parent);};
  const minimum=r.ordinaryOrbitClearance(parent,satellite)/r.scale;
  // Isolate the pre-clearance layout to verify the new safety floor does not
  // change the expanded 100% endpoint or intermediate requests unnecessarily.
  const clearance=r.ordinaryOrbitClearance;
  r.ordinaryOrbitClearance=(...args)=>args.length===2?0:clearance.apply(r,args);
  const base=radius(0),expandedFull=base*custom*2;delete r.ordinaryOrbitClearance;
  close(radius(1),Math.max(expandedFull,minimum));
  for(const value of [.01,.1,.43,.5,.75])close(radius(value),Math.max(base+(expandedFull-base)*value,minimum));
  r.actualScaleMix=1;r.fitScale=r.actualFitScale=r.actualScaleFit();r.scale=r.fitScale*zoom*r.camera.dolly;
  const physical=A.SATELLITE_MEAN_AU[satellite.id]*A.TRUE_SCALE_UNITS_PER_AU;
  for(const value of [.01,.43,1])close(radius(value),physical);
 }
});

test('Moon and Europa blend their independent orbit endpoints without a first-frame jump',()=>{
 for(const zoom of [.1,1.185,64])for(const dolly of [.002,1,15])for(const satellite of A.SATELLITES){
  const {r}=fixture(1280,800),parent=A.BODIES.find(b=>b.id===satellite.parent);
  r.bodyScales[parent.id]=3.5;r.satelliteOrbitScales[parent.id]=.6;r.camera.zoom=zoom;r.camera.dolly=dolly;
  const normalFit=r.overviewFitScale,actualFit=r.actualScaleFit();
  const radius=p=>{r.actualScaleMix=p;r.fitScale=normalFit+(actualFit-normalFit)*p;r.scale=r.fitScale*zoom*dolly;return r.satelliteOrbitRadius(satellite,parent)*r.scale;};
  const start=radius(0),end=radius(1);
  for(const p of [1e-7,.0001,.01,.1,.25,.5,.75,.99,1])close(radius(p),start+(end-start)*p);
  for(const p of [.99,.75,.5,.25,.1,.01,.0001,0])close(radius(p),start+(end-start)*p);
 }
});
