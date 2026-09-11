'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/astro.js'),sandbox={window:{SolarAstro:A},performance:{now:()=>0}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),sandbox);
const Renderer=sandbox.window.SolarRenderer,all=[A.SUN,...A.BODIES,A.MOON];
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function renderer(w=1648,h=928){const r=Object.create(Renderer.prototype);Object.assign(r,{w,h,lensStretch:1.72,options:{moon:true,pluto:true},camera:{azimuth:25*A.DEG,elevation:45*A.DEG,zoom:1,focus:null,panY:0},surfaceMaps:new Map(),mapPixels:0});return r;}

test('Camera angle owner permits both hemispheres and clamps at signed poles',()=>{
 const r=renderer();r.setOrbitView(7,-Math.PI/4);near(r.camera.elevation,-Math.PI/4);near(r.camera.azimuth,A.wrap(7));
 r.setOrbitView(0,-100);near(r.camera.elevation,-Math.PI/2);r.setOrbitView(0,100);near(r.camera.elevation,Math.PI/2);
 const prev={...r.camera};r.setOrbitView(NaN,0);assert.deepEqual(r.camera,prev);r.setOrbitView(0,NaN);assert.deepEqual(r.camera,prev);
});
test('Pointer, keyboard, slider and restored settings route through the same angle owner',()=>{
 const app=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
 assert.ok(app.includes('setOrbitView(renderer.camera.azimuth,saved.elevation*A.DEG)'));
 assert.ok(app.includes('setOrbitView(renderer.camera.azimuth,Number('));
 assert.ok(app.includes('setOrbitView(renderer.camera.azimuth+dx*.004,renderer.camera.elevation+dy*.003)'));
 assert.ok(app.includes('setOrbitView(renderer.camera.azimuth,renderer.camera.elevation)'));
 assert.ok(!app.includes('15*A.DEG,80*A.DEG'));
});
test('All surface frames stay orthonormal above, edge-on and below the orbital plane',()=>{
 const r=renderer();for(const e of [-90,-60,0,26.73,45,90])for(const a of [0,25,113,280])for(const body of all){
  r.setOrbitView(a*A.DEG,e*A.DEG);const {u,v,pole}=r.bodyFrame(body);
  near(dot(u,u),1);near(dot(v,v),1);near(dot(pole,pole),1);near(dot(u,v),0);near(dot(u,pole),0);near(dot(v,pole),0);
 }
});
test('Ring plane is perpendicular to the SAME body pole in every camera orientation',()=>{
 const r=renderer();for(const id of ['saturn','uranus'])for(const e of [-90,-40,0,50,90])for(const a of [0,1,2,3]){
  r.setOrbitView(a,e*A.DEG);const {u,v,pole}=r.bodyFrame(A.BODIES.find(b=>b.id===id));
  for(let i=0;i<16;i++){const theta=i/16*A.TAU,p={x:u.x*Math.cos(theta)+v.x*Math.sin(theta),y:u.y*Math.cos(theta)+v.y*Math.sin(theta),z:u.z*Math.cos(theta)+v.z*Math.sin(theta)};near(dot(p,pole),0);near(dot(p,p),1);}
 }
});
test('Ring projection changes with camera azimuth and elevation, not a billboard ellipse',()=>{
 const r=renderer(),b=A.BODIES.find(b=>b.id==='saturn');const f=r.bodyFrame(b);r.setOrbitView(1,-.6);const g=r.bodyFrame(b);
 assert.notEqual(f.u.x,g.u.x);assert.notEqual(f.v.y,g.v.y);
 // Exactly edge-on when the line of sight lies in Saturn's equatorial plane.
 r.setOrbitView(0,-A.rotationPoleTilt(b));const {u,v,pole}=r.bodyFrame(b);
 near(u.x*v.y-u.y*v.x,0);near(pole.z,0);
});
test('Front and back ring passes split at view-space depth, including underside views',()=>{
 const r=renderer();for(const body of A.BODIES.filter(b=>['saturn','uranus'].includes(b.id)))for(const e of [-80,-20,0,20,80]){
  r.setOrbitView(.5,e*A.DEG);const frame=r.bodyFrame(body);
  for(const front of [false,true]){
   const c={save(){},restore(){},transform(...v){this.matrix=v;},beginPath(){},arc(x,y,rr,a,b){this.arcs.push({a,b});},stroke(){},arcs:[]};
   r.rings(c,body,{x:300,y:400},70,front);near(c.matrix[0],frame.u.x);near(c.matrix[3],frame.v.y);near(c.matrix[4],300);
   for(const arc of c.arcs){const mid=(arc.a+arc.b)/2,z=frame.u.z*Math.cos(mid)+frame.v.z*Math.sin(mid);assert.ok(front?z>=-1e-8:z<=1e-8);near(arc.b-arc.a,Math.PI);}
  }
 }
});
test('Maximum zoom has the same on-screen radius for ALL bodies and both desktop/mobile',()=>{
 for(const [w,h] of [[1648,928],[1920,1080],[390,844],[320,568]])for(const body of all){
  const r=renderer(w,h);r.camera.focus=body.id;r.setZoom(64);near(r.bodyScaleAtZoom()*body.size,Math.min(w,h)*.34);
 }
});
test('Close-view command targets the same readable screen radius, including Moon and Pluto',()=>{
 for(const body of all){const r=renderer();r.focusBody(body.id);assert.equal(r.camera.focus,body.id);near(r.bodyScaleAtZoom()*body.size,Math.min(r.w,r.h)*.14);assert.ok(r.camera.zoom>3&&r.camera.zoom<64);}
});
test('Focus-size scale is continuous and increasing from overview to maximum',()=>{
 for(const body of all){const r=renderer();r.camera.focus=body.id;let prev=body.size*r.baseBodyScale();for(let z=1.01;z<=64;z+=.2){r.setZoom(z);const radius=r.bodyScaleAtZoom()*body.size;assert.ok(radius>=prev);prev=radius;}}
});
test('Illustrative zoom changes no physical sizes, lunar spacing, periods or time',()=>{
 const r=renderer(),t=Date.UTC(2026,8,11),before=all.map(b=>A.rotationAt(b,t));r.focusBody('moon');r.setZoom(64);
 assert.deepEqual(all.map(b=>A.rotationAt(b,t)),before);near(A.MOON.displayOrbit,30);near(A.MOON.size,3.9);near(A.BODIES[2].size,17.25);
});
test('Geometry cache remains bounded across repeated high-resolution camera changes',()=>{
 const r=renderer(),body=A.BODIES[4];for(let i=0;i<5;i++){r.setOrbitView(i*.1,-.3);r.surfaceMap(body,768);assert.ok(r.mapPixels<=768*768*2+65536);assert.ok(r.surfaceMaps.size<=2);}
});
test('One-minute rotations remain signed and correct for ALL bodies',()=>{
 const t=Date.UTC(2026,8,11,4,20);for(const b of all){const d=A.wrap(A.rotationAt(b,t+60000)-A.rotationAt(b,t)+Math.PI)-Math.PI;near(d,A.TAU*60000/(A.DAY*b.spin));assert.notEqual(d,0);}
});

test('Vertical translation uses one finite, bounded owner and preserves angle/zoom',()=>{
 const r=renderer(),before={...r.camera};r.setPanY(.12);near(r.camera.panY,.12);
 r.setPanY(2);near(r.camera.panY,.2);r.setPanY(-2);near(r.camera.panY,-.2);
 r.setPanY(NaN);near(r.camera.panY,-.2);r.setPanY(Infinity);near(r.camera.panY,-.2);
 near(r.camera.azimuth,before.azimuth);near(r.camera.elevation,before.elevation);near(r.camera.zoom,before.zoom);
 r.resetCamera();near(r.camera.panY,0);
});
test('Overview center is 5% lower than center (5% higher than v0.03), with +/-20% pan',()=>{
 const r=renderer(),t=Date.UTC(2026,8,11);r.rebuild(t);near(r.centerY,r.h*.55);
 for(const p of [-.2,.2,0]){r.setPanY(p);r.rebuild(t);near(r.centerY,r.h*(.55+p));}
});
test('Pan is a viewport-height fraction across resized windows and tracking',()=>{
 const r=renderer();r.setPanY(.15);r.camera.focus='moon';r.camera.zoom=64;r.rebuild(A.J2000);near(r.centerY,r.h*.7);
 r.w=1920;r.h=1080;r.rebuild(A.J2000);near(r.centerY,1080*.7);near(r.camera.panY,.15);
});

test('Shine timing is exactly 3x, independent of physical rotation, star time and pause',()=>{
 const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8');
 const SlowSandbox={window:{SolarAstro:A},performance:{now:()=>0}};
 vm.runInNewContext(source.replace('seconds*3:0','seconds:0'),SlowSandbox);
 const trace=(R,seconds,activity=true)=>{
  const r=Object.create(R.prototype);r.options={activity,quality:'low'};r.dpr=1;r.coronaTexture={width:384};
  const calls=[],c=new Proxy({}, {get(_,key){if(key==='createRadialGradient')return()=>({addColorStop(){}});return(...args)=>calls.push([key,...args]);},set(_,key,value){calls.push([key,value]);return true;}});
  r.corona(c,0,0,30,seconds);return calls;
 };
 assert.equal(JSON.stringify(trace(Renderer,5)),JSON.stringify(trace(SlowSandbox.window.SolarRenderer,15)));
 assert.equal(JSON.stringify(trace(Renderer,999,false)),JSON.stringify(trace(Renderer,0,false)));
 assert.equal(JSON.stringify(trace(Renderer,5)),JSON.stringify(trace(Renderer,5)));
 assert.ok(source.includes('const spin=A.rotationAt(body,ms)'));
 assert.ok(source.includes('this.starGlow(c,s.x,s.y,s.r,alpha)'));
});
