'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),ms=Date.parse('2026-10-01T00:00:00Z');
const window={SolarAstro:A};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),{window,performance:{now:()=>0}});
const paths=A.BODIES.map(body=>({body,points:A.orbitAt(body,ms,360)}));
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function fixture(w,h,sun=1,pluto=true){
 const r=Object.create(window.SolarRenderer.prototype),camera=r.defaultCameraSnapshot();
 const mobile=w<680,compact=h<630,top=compact?100:mobile?192:190,bottom=h-(compact?105:mobile?195:190),baseY=(top+bottom)/2+h*.05;
 Object.assign(r,{w,h,camera,bodyScales:{sun},satelliteOrbitScales:{},options:{pluto,moon:true,overviewOrbitGap:86},actualScaleMix:1,lensStretch:1.6,overviewFitScale:.25,paths:paths.filter(p=>pluto||p.body.id!=='pluto'),cx:w/2,cy:baseY+h*camera.panY,projectionAnchor:null,stats:{orbitBufferBuilds:0},orbitModelCache:new WeakMap()});
 r.fitScale=r.actualFitScale=r.actualScaleFit();r.scale=r.fitScale*camera.zoom;return {r};
}
// Decode the fixed endpoints with the same two independent shader weights.
function gpuPoint(r,model,i){
 const m=r.gpuOrbitCamera().solarMorph,ratio=model[i*4+3],out={};
 for(const [j,k] of ['x','y','z'].entries()){
  out[k]=model[i*4+j]*(m[0]+ratio*m[1]);
  out['depth'+k.toUpperCase()]=model[i*4+j]*(m[2]+ratio*m[3]);
 }
 return out;
}

test('100% actual distances retain a visible Sun and put the outer planets beyond the default viewport',()=>{
 for(const [w,h] of [[1280,800],[1920,1080],[390,844],[844,390]])for(const sun of [1,1.54,3])for(const pluto of [true,false]){
  const {r}=fixture(w,h,sun,pluto),outer=pluto?'pluto':'neptune',sunRadius=r.bodyRadiusAtZoom(A.SUN);
  let mercuryClearance=Infinity,outerMinimum=Infinity;
  for(const path of r.paths)for(const point of path.points){
   const world=r.displaySolarPoint(point),p=r.project(world);
   close(Math.hypot(world.x,world.y,world.z)*r.scale/sunRadius,point.physicalDistance*A.AU_KM/A.BODY_RADIUS_KM.sun);
   if(path.body.id===outer)outerMinimum=Math.min(outerMinimum,Math.hypot(p.x-r.cx,p.y-r.cy));
   if(path.body.id==='mercury')mercuryClearance=Math.min(mercuryClearance,Math.hypot(p.x-r.cx,p.y-r.cy));
  }
  assert.ok(outerMinimum>Math.hypot(w,h));
  assert.ok(mercuryClearance>sunRadius+r.bodyRadiusAtZoom(A.BODIES[0]));
  close(sunRadius,A.SUN.size*sun*r.bodyScaleForZoom(r.camera.zoom));
 }
});

test('actual-scale orbits expand monotonically instead of overshooting during the mode transition',()=>{
 const {r}=fixture(1280,800),normal=r.overviewFitScale,actual=r.actualFitScale;
 for(const au of [.3,1,5,30,50]){
  const start=A.displayDistance(au,0,86)*normal,end=au*A.TRUE_SCALE_UNITS_PER_AU*actual;
  let previous=start;
  for(let i=0;i<=100;i++){
   const p=i/100;r.actualScaleMix=p;r.fitScale=normal+(actual-normal)*p;
   const distance=r.displaySolarRadius(au)*r.fitScale;
   close(distance,start+(end-start)*p);assert.ok(distance>=previous-1e-6);previous=distance;
  }
 }
});

test('actual-scale body positions and GPU orbit buffers share one physical distance mapping',()=>{
 const {r}=fixture(1280,800);
 for(const path of r.paths){
  const model=r.orbitModel(path);
  for(let i=0;i<path.points.length;i++){
   const p=path.points[i],world=r.displaySolarPoint(p),gpu=gpuPoint(r,model,i),length=Math.hypot(p.x,p.y,p.z);
   const physical={x:p.x/length*p.physicalDistance,y:p.y/length*p.physicalDistance,z:p.z/length*p.physicalDistance},display={};r.displayPhysicalPoint(physical,display);
   for(const key of ['x','y','z']){close(world[key],display[key]);close(gpu[key],world[key],.001);}
  }
 }
 const before=r.orbitModel(r.paths[0]);r.camera.zoom=250;r.fitScale=r.actualFitScale=r.actualScaleFit();
 assert.equal(r.orbitModel(r.paths[0]),before,'lens changes scale, not physical orbit buffers');
 r.actualScaleMix=0;
 for(const au of [.3,1,5,30,50])close(r.displaySolarRadius(au),A.displayDistance(au,0,86)*r.solarOrbitHierarchyScale());
});

test('1–100% spacing scales solar orbits only, preserving body sizes and local moon spacing',()=>{
 const {r}=fixture(1280,800),sun=r.bodyRadiusAtZoom(A.SUN),earth=A.BODIES.find(b=>b.id==='earth');
 const earthRadius=r.bodyRadiusAtZoom(earth),moonRadius=r.bodyRadiusAtZoom(A.MOON),moonOrbit=r.satelliteOrbitRadius(earthRadius,moonRadius,A.MOON,earth);
 const initial=r.orbitModel(r.paths[0]);
 for(const amount of [.01,.1,.37,.75,1]){
  r.setOption('actualOrbitSpacing',amount);
  const distanceScale=.02+(amount-.01)/.99*.98;
  close(r.actualOrbitSpacing(),amount);close(r.actualOrbitDistanceScale(),distanceScale);
  for(const au of [.3,1,5,30,50])close(r.displaySolarRadius(au),au*A.TRUE_SCALE_UNITS_PER_AU*distanceScale);
  close(r.bodyRadiusAtZoom(A.SUN),sun);close(r.bodyRadiusAtZoom(earth),earthRadius);
  close(r.satelliteOrbitRadius(earthRadius,moonRadius,A.MOON,earth),moonOrbit);
  const model=r.orbitModel(r.paths[0]);
  for(let i=0;i<model.length;i++)close(model[i],i%4===3?initial[i]*distanceScale:initial[i],.001);
 }
 for(const [input,expected] of [[0,.01],[-1,.01],[2,1],[NaN,1],[Infinity,1]]){r.setOption('actualOrbitSpacing',input);close(r.actualOrbitSpacing(),expected);}
});

test('perspective depth blends independently of fit with no departure dip or return snap',()=>{
 const {r}=fixture(1707,790);r.options.overviewOrbitGap=145;r.options.actualOrbitSpacing=.02;
 Object.assign(r.camera,{azimuth:5.393597172693909,elevation:.620064911444322,zoom:1.1853048513203654,dolly:.6004955788122657});
 r.overviewFitScale=.2939258712396784;r.actualFitScale=r.actualScaleFit();
 const set=p=>{r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;};
 const point=r.paths.find(p=>p.body.id==='neptune').points[90];
 for(const dolly of [.002,.6,1,2]){
  r.camera.dolly=dolly;
  set(0);const start=r.displaySolarPoint(point),v0=r.view(start),scale0=r.scale,w0=1-r.viewDepth(start)*(dolly-1)/5000;
  set(1);const end=r.displaySolarPoint(point),v1=r.view(end),scale1=r.scale,w1=1-r.viewDepth(end)*(dolly-1)/5000;
  for(const p of [0,1e-7,.0002,.001,.01,.1,.5,.9,.999,1,.999,.9,.5,.1,.001,0]){
   set(p);const world=r.displaySolarPoint(point),screen=r.project(world),w=w0+(w1-w0)*p;
   for(const key of ['depthX','depthY','depthZ'])close(world[key],start[key]+(end[key]-start[key])*p);
   if(w>.002)close(screen.y,r.cy+(v0.y*scale0+(v1.y*scale1-v0.y*scale0)*p)/w);
  }
 }
 r.camera.dolly=.6004955788122657;
 const middle=p=>{set(p);const ys=r.paths.find(p=>p.body.id==='neptune').points.map(p=>r.project(r.displaySolarPoint(p)).y);return (Math.min(...ys)+Math.max(...ys))/2;};
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
    const point=path.points[i],world=r.displaySolarPoint(point),gpu=gpuPoint(r,model,i),length=Math.hypot(point.x,point.y,point.z),physical={};
    const display=r.displayPhysicalPoint(Object.fromEntries(['x','y','z'].map(k=>[k,point[k]/length*point.physicalDistance])),physical);
    for(const k of ['X','Y','Z']){close(world['depth'+k],display['depth'+k]);close(gpu['depth'+k],world['depth'+k],.002);close(gpu[k.toLowerCase()],world[k.toLowerCase()],.002);}
   }
  }
 }
 for(const satellite of A.SATELLITES){
  const parent=A.BODIES.find(b=>b.id===satellite.parent),sample=p=>{
   r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;
   const layout={};r.satelliteOrbitRadius(1,1,satellite,parent,layout);return layout.orbitDepthRadius;
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
 for(const update of [()=>r.setOption('overviewOrbitGap',173),()=>r.setOption('actualOrbitSpacing',.15),()=>{r.bodyScales.sun=3;},()=>{r.satelliteOrbitScales.sun=.3;}]){
  update();const after=r.orbitModel(path);assert.notEqual(after,before);assert.equal(r.orbitModel(path),after);before=after;
 }
 const changed={...path,points:path.points.slice()},first=r.orbitModel(changed);changed.points=changed.points.slice();
 assert.notEqual(r.orbitModel(changed),first);
 for(const enabled of [false,true,false]){r.setOption('actualScale',enabled,false);assert.equal(r.orbitModel(path),before);}
});

test('GPU endpoint interpolation matches tracked CPU projection across spacing and near-endpoint progress',()=>{
 const {r}=fixture(1707,790,3),earth=r.paths.find(path=>path.body.id==='earth');
 for(const gap of [50,145,400])for(const spacing of [.01,.37,1])for(const dolly of [.002,.6,1,2]){
  r.options.overviewOrbitGap=gap;r.options.actualOrbitSpacing=spacing;r.camera.dolly=dolly;
  for(const p of [0,1e-7,.0002,.25,.5,.75,.9999999,1]){
   r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;r.scale=r.fitScale*r.camera.zoom*dolly;
   r.projectionAnchor=r.displaySolarPoint(earth.points[17]);
   for(const path of r.paths){
    const model=r.orbitModel(path);
    for(let i=0;i<path.points.length;i+=90){
     const world=r.displaySolarPoint(path.points[i]),gpu=gpuPoint(r,model,i);
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
  r.setOption('actualScale',false,false);close(r.displaySolarRadius(1),A.displayDistance(1,0,173)*r.solarOrbitHierarchyScale());
  r.setOption('actualScale',true,false);close(r.displaySolarRadius(1),20*(.02+(.37-.01)/.99*.98));
  assert.equal(r.options.overviewOrbitGap,173);close(r.options.actualOrbitSpacing,.37);
 }
});

test('displayed 1% keeps Mercury outside the Sun at every orbital position',()=>{
 for(const sunScale of [1,2,3]){
  const {r}=fixture(1280,800,sunScale);r.setOption('actualOrbitSpacing',.01);
  close(r.actualOrbitSpacing(),.01);close(r.actualOrbitDistanceScale(),.02);
  const mercury=r.paths.find(p=>p.body.id==='mercury'),clearance=r.bodyRadiusAtZoom(A.SUN)+r.bodyRadiusAtZoom(mercury.body);
  for(const point of mercury.points){const world=r.displaySolarPoint(point);assert.ok(Math.hypot(world.x,world.y,world.z)*r.scale>clearance);}
 }
});

test('Moon and Europa blend their independent orbit endpoints without a first-frame jump',()=>{
 for(const zoom of [.1,1.185,64])for(const dolly of [.002,1,15])for(const satellite of A.SATELLITES){
  const {r}=fixture(1280,800),parent=A.BODIES.find(b=>b.id===satellite.parent);
  r.bodyScales[parent.id]=3.5;r.satelliteOrbitScales[parent.id]=.6;r.camera.zoom=zoom;r.camera.dolly=dolly;
  const normalFit=r.overviewFitScale,actualFit=r.actualScaleFit();
  const radius=p=>{r.actualScaleMix=p;r.fitScale=normalFit+(actualFit-normalFit)*p;r.scale=r.fitScale*zoom*dolly;return r.satelliteOrbitRadius(r.bodyRadiusAtZoom(parent),r.bodyRadiusAtZoom(satellite),satellite,parent)*r.scale;};
  const start=radius(0),end=radius(1);
  for(const p of [1e-7,.0001,.01,.1,.25,.5,.75,.99,1])close(radius(p),start+(end-start)*p);
  for(const p of [.99,.75,.5,.25,.1,.01,.0001,0])close(radius(p),start+(end-start)*p);
 }
});
