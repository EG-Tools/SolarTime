/* Component regressions. Uses analytic fixture bodies, not ephemeris assertions. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const earth={id:'earth',size:17.25,tilt:23.439,en:'EARTH'},moon={id:'moon',size:3.9,displayOrbit:30,tilt:6.68,en:'MOON'},sun={id:'sun',size:28,tilt:7.25,en:'SUN'};
let positionCalls=0;
const A={TAU:Math.PI*2,DEG:Math.PI/180,clamp,wrap:(v,m=Math.PI*2)=>(v%m+m)%m,BODIES:[earth,{id:'pluto',size:5,tilt:119.61,en:'PLUTO'}],SUN:sun,MOON:moon,
 rotationPoleTilt:b=>b.tilt,bodyAxes:b=>({u:{x:1,y:0,z:0},v:{x:0,y:Math.cos(b.tilt*.01),z:Math.sin(b.tilt*.01)},pole:{x:0,y:-Math.sin(b.tilt*.01),z:Math.cos(b.tilt*.01)}}),
 positionAt:()=>{positionCalls++;return {x:1,y:2,z:3};},moonAt:()=>({x:.001,y:-.001,z:.0005}),rotationAt:()=>.4};
class RecordingPath{constructor(){this.commands=[];}moveTo(x,y){this.commands.push(['M',x,y]);}lineTo(x,y){this.commands.push(['L',x,y]);}}
const ctx={window:{SolarAstro:A,SolarAssets:{}},performance:{now:()=>0},console,Path2D:RecordingPath};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'src/renderer.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'src/sky.js'),'utf8'),ctx);
const Renderer=ctx.window.SolarRenderer,Sky=ctx.window.SolarSky;
const fixture=()=>Object.assign(Object.create(Renderer.prototype),{camera:{azimuth:.4,elevation:.7,zoom:1,focus:null,panX:0,panY:0},lensStretch:1.6,w:1400,h:800,dpr:1.5,options:{pluto:true,quality:'auto'},scale:2,cx:300,cy:400,stats:{orbitPaths:0,orbitProjections:0},frameCache:new Map(),orbitCache:new WeakMap(),labelStates:new Map(),labelWidths:new Map()});
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const orbit={body:earth,points:Array.from({length:361},(_,i)=>({x:220*Math.cos(i*Math.PI/180),y:170*Math.sin(i*Math.PI/180),z:20*Math.sin(i*Math.PI/90)}))};
const drawContext=()=>({stack:[],paths:[],dx:0,dy:0,save(){this.stack.push([this.dx,this.dy]);},restore(){[this.dx,this.dy]=this.stack.pop();},translate(x,y){this.dx+=x;this.dy+=y;},setLineDash(){},stroke(p){this.paths.push(p.commands.map(([op,x,y])=>[op,x+this.dx,y+this.dy]));}});
test('cached camera transform matches the original orthographic formula',()=>{
 const r=fixture();for(const azimuth of [-3,.4,6])for(const elevation of [-Math.PI/2,0,Math.PI/2]){r.camera.azimuth=azimuth;r.camera.elevation=elevation;const p={x:3,y:7,z:-4},q=r.viewDirection(p),x=p.x*Math.cos(azimuth)-p.y*Math.sin(azimuth),y=p.x*Math.sin(azimuth)+p.y*Math.cos(azimuth);near(q.x,x);near(q.y,-(y*Math.sin(elevation)+p.z*Math.cos(elevation)));near(q.z,-y*Math.cos(elevation)+p.z*Math.sin(elevation));}
});
test('orbit cache eliminates repeat projections and invalidates on rotation or lens change',()=>{
 const r=fixture(),p=r.projectOrbit(orbit);assert.equal(r.stats.orbitProjections,361);assert.equal(r.projectOrbit(orbit),p);r.cx+=25;r.scale=3;assert.equal(r.projectOrbit(orbit),p);assert.equal(r.stats.orbitProjections,361);r.camera.azimuth+=.1;assert.notEqual(r.projectOrbit(orbit),p);assert.equal(r.stats.orbitProjections,722);r.lensStretch=1;assert.equal(r.projectOrbit(orbit).lens,1);
});
test('cached two-hemisphere paths match v0.13 point-by-point, including tracking translation',()=>{
 const r=fixture(),c=drawContext();r.orbit(c,orbit,false);
 for(let pass=0;pass<2;pass++){let active=false;const expected=[];for(const p of orbit.points){const q=r.project(p),front=q.z>=0;if(front===(pass===1)){expected.push([active?'L':'M',q.x,q.y]);active=true;}else{if(active)expected.push(['L',q.x,q.y]);active=false;}}
 assert.equal(c.paths[pass].length,expected.length);expected.forEach((p,i)=>{assert.equal(c.paths[pass][i][0],p[0]);near(c.paths[pass][i][1],p[1]);near(c.paths[pass][i][2],p[2]);});}
 const built=r.stats.orbitPaths;r.cx+=100;r.orbit(c,orbit,true);assert.equal(r.stats.orbitPaths,built);near(c.paths[2][0][1]-c.paths[0][0][1],100);
 r.scale*=2;r.orbit(c,orbit,false);assert.equal(r.stats.orbitPaths,built+2);
});
test('body frame is reused until the camera or body tilt changes',()=>{
 const r=fixture(),f=r.bodyFrame(earth);assert.equal(r.bodyFrame(earth),f);r.camera.elevation+=.2;assert.notEqual(r.bodyFrame(earth),f);const other={...earth,tilt:40};assert.notEqual(r.bodyFrame(other),f);
});
test('surface lighting shares Earth solve; Sun does not require an Earth solve',()=>{
 const r=fixture();positionCalls=0;const s=r.surfaceJob(sun,{},20,100,0,0);assert.equal(positionCalls,0);assert.ok(s.light.every(Number.isFinite));const e=r.surfaceJob(earth,{},20,100,0,0),m=r.surfaceJob(moon,{},10,100,0,0);assert.equal(positionCalls,1);assert.notDeepEqual(e.light,m.light);r.surfaceJob(moon,{},10,101,0,0);assert.equal(positionCalls,2);
});
test('close-up size limits and stored camera validation remain unchanged',()=>{
 const r=fixture();r.camera.focus='moon';r.camera.zoom=256;near(r.bodyRadiusAtZoom(moon),800*1.1);assert.equal(Renderer.validCamera(r.cameraSnapshot()),true);assert.equal(Renderer.validCamera({...r.camera,zoom:257}),false);r.camera.zoom=64;near(r.bodyRadiusAtZoom(moon),800*.34);
});
test('bilinear panorama sampling wraps longitude, including negative coordinates',()=>{
 const data=new Uint8ClampedArray(8*4*4);for(let i=0;i<data.length;i++)data[i]=(i*31)%256;const tex={width:8,height:4,data};
 for(const v of [-1,0,.12,.5,1,2]){const a=[],b=[],c=[];Sky.samplePanorama(tex,0,v,a);Sky.samplePanorama(tex,1,v,b);Sky.samplePanorama(tex,-1,v,c);assert.deepEqual(a,b);assert.deepEqual(a,c);}
 const a=[],b=[];Sky.samplePanorama(tex,1e-8,.4,a);Sky.samplePanorama(tex,1-1e-8,.4,b);a.forEach((n,i)=>near(n,b[i],.0001));
});
test('portrait and ultra-wide CPU sky rasters stay inside the pixel budget',()=>{
 for(const [w,h]of [[320,3000],[3000,320],[1,10000],[10000,1],[1920,1080]])for(const moving of [true,false]){const [x,y]=Sky.rasterSize(w,h,moving);assert.ok(x>=1&&y>=1);assert.ok(x*y<=(moving?90000:160000));}
});
test('sky ray/project transforms round-trip, including panorama poles and wrap',()=>{
 const s=Object.assign(Object.create(Sky.prototype),{w:1400,h:800,tanFov:Math.tan(38*Math.PI/180),offset:1.8});
 for(const azimuth of [0,Math.PI,-Math.PI,Math.PI*2])for(const elevation of [-Math.PI/2,0,Math.PI/2]){s.updateAxes({azimuth,elevation});for(const [x,y]of [[700,400],[0,0],[1400,800],[420,650]]){const p=s.project(s.toPanorama(s.ray(x,y)));assert.ok(p);near(x,p.x,1e-7);near(y,p.y,1e-7);}}
});
test('ray tables are reused and bounded to two geometries',()=>{
 const s=Object.assign(Object.create(Sky.prototype),{rayTables:new Map(),tanFov:.7});const a=s.rayTable(32,20,1.6);assert.equal(s.rayTable(32,20,1.6),a);s.rayTable(33,20,1.65);s.rayTable(34,20,1.7);assert.equal(s.rayTables.size,2);
});
test('camera auto-rotation, pan clamps and 1..3 camera schema are retained',()=>{
 const r=fixture();r.setPan(1,-1);near(r.camera.panX,.2);near(r.camera.panY,-.2);r.setAutoRotate(1,0);const before=r.camera.azimuth;r.advanceAutoRotate(1000);near(r.camera.azimuth-before,2*Math.PI/180);r.setOrbitView(0,Math.PI);assert.equal(r.autoRotateDirection,0);near(r.camera.elevation,Math.PI/2);
});
