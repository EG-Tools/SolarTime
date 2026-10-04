'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const window={SolarAstro:require('../src/astro.js')};
for(const file of ['surface-style','renderer','ring-tour'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/'+file+'.js'),'utf8'),{window,performance:{now:()=>0}});
const R=window.SolarRenderer.prototype;
const frame={u:{x:1,y:0,z:0},pole:{x:0,y:-.8,z:.6},v:{x:0,y:-.6,z:-.8}};
function create(seed=123,extra={}){return new window.SolarRingTour({seed,frame,radius:180,width:1280,height:800,screen:{x:640,y:400},grainStyle:rand=>R.flightParticleStyle(rand),...extra});}
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,a+' != '+b);
const vectorNear=(a,b,tolerance)=>a.forEach((v,i)=>near(v,b[i],tolerance));

test('virtual locator search avoids bodies along both the circle and the swept approach',()=>{
 const T=window.SolarRingTour;
 for(const scale of [.0001,1,100000])for(const side of [-1,1]){
  const from={eye:[0,-8,3*side].map(x=>x*scale),forward:[0,1,0],right:[1,0,0],up:[0,0,1]},velocity=[0,.6*scale,0];
  const bodies=[{center:[0,0,0],radius:2*scale}];
  const original=T.planWarp(from,velocity,bodies),point=T.warpPosition(T.warpPath(from,velocity,original),2);
  bodies.push({center:point,radius:.3*scale});
  const ring=T.planWarp(from,velocity,bodies);assert.ok(ring,'safe alternative must be found');assert.equal(ring.virtual,true);
  assert.notDeepEqual(ring.center,original.center,'blocked preferred route must be rejected');
  assert.deepEqual(T.planWarp(from,velocity,bodies),ring,'same snapshot gives one deterministic plan');
  const path=T.warpPath(from,velocity,ring),h=.00001;
  vectorNear(T.warpPosition(path,0),from.eye,scale*1e-8);
  vectorNear(T.warpPosition(path,h).map((x,i)=>(x-from.eye[i])/h),velocity,scale*.001);
  for(const body of bodies){
   const p=body.center.map((x,i)=>x-ring.center[i]);
   const height=p.reduce((s,x,i)=>s+x*ring.normal[i],0),radial=Math.sqrt(Math.max(0,p.reduce((s,x)=>s+x*x,0)-height*height));
   assert.ok(Math.hypot(radial-ring.radius,height)>=body.radius*1.18,'locator ring clears body');
   for(let t=0;t<=20;t+=.01){const at=T.warpPosition(path,t);assert.ok(Math.hypot(...at.map((x,i)=>x-body.center[i]))>body.radius*1.17,'swept path clears body');}
  }
 }
});

test('a populated solar view keeps all eight safe warp directions selectable',()=>{
 const T=window.SolarRingTour,from={eye:[0,-3444,891],forward:[0,.968,-.251],right:[-1,0,0],up:[0,.251,.968]};
 const obstacles=[[500,968,43],[-635,618,11],[36,639,22],[-522,593,43],[923,179,43],[470,133,6],[482,88,22],[1239,57,43],[0,0,87],[340,-11,22],[18,-189,22],[780,-1146,6]].map(([x,y,radius])=>({center:[x,y,0],radius}));
 let seed=93617;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const counts=Array(8).fill(0);
 for(let i=0;i<128;i++){const ring=T.planWarp(from,[0,0,0],obstacles,4.3,random);assert.ok(ring);counts[ring.direction]++;}
 assert.ok(counts.every(n=>n>0),JSON.stringify(counts));
 assert.ok(Math.max(...counts)<64,'no direction monopolizes repeated departures');
});

test('warp planner respects the orbital-disc direction filter',()=>{
 const T=window.SolarRingTour,from={eye:[0,-8,3],forward:[0,1,0],right:[-1,0,0],up:[0,0,1]};
 let seed=912;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const allowed=[0,1,7],seen=new Set();
 for(let i=0;i<64;i++){const plan=T.planWarp(from,[0,0,0],[{center:[0,0,0],radius:2}],4.3,random,allowed);assert.ok(plan);assert.ok(allowed.includes(plan.direction));seen.add(plan.direction);}
 assert.equal(seen.size,3);
});

test('nearby warp retreat keeps initial velocity and clears the actual swept path',()=>{
 const T=window.SolarRingTour,from={eye:[0,-2.2,0],forward:[0,1,0],right:[-1,0,0],up:[0,0,1],retreat:[0,-6,0]},velocity=[0,0,0],body={center:[0,0,0],radius:1};
 const ring=T.planWarp(from,velocity,[body],4.3);assert.ok(ring);
 const path=T.warpPath(from,velocity,ring),h=1e-5;
 vectorNear(T.warpPosition(path,0),from.eye);
 vectorNear(T.warpPosition(path,h).map((value,i)=>(value-from.eye[i])/h),velocity,.001);
 for(let age=0;age<=20;age+=.025)assert.ok(Math.hypot(...T.warpPosition(path,age))>body.radius*1.17);
 const around=T.warpPosition(path,1.8);assert.ok(around[1]<from.eye[1]-5,'clearance is established before the turn completes');
});

test('virtual departure tries lateral quarter turns when vertical exits are blocked',()=>{
 const T=window.SolarRingTour,from={eye:[0,-8,3],forward:[0,1,0],right:[-1,0,0],up:[0,0,1]},velocity=[0,.6,0],bodies=[{center:[0,0,0],radius:2}];
 const first=T.planWarp(from,velocity,bodies);assert.equal(first.turnAngle,Math.PI/2);
 for(const radius of [8,16,32])for(const side of [-1,1]){
  const ring={...first,radius,side};
  bodies.push({center:T.warpPosition(T.warpPath(from,velocity,ring),7),radius:.5});
 }
 const next=T.planWarp(from,velocity,bodies);assert.ok(next);assert.equal(next.turnAngle,Math.PI/2);assert.notEqual(next.direction%4,0);
});

test('virtual locator pitch plane inherits camera roll and remains frozen',()=>{
 const T=window.SolarRingTour;
 for(const roll of [-.6,.4,1.2]){
  const from={eye:[0,0,0],forward:[0,1,0],up:[-Math.sin(roll),0,Math.cos(roll)],right:[-Math.cos(roll),0,-Math.sin(roll)]};
  const ring=T.planWarp(from,[0,.5,0]);vectorNear(ring.entryUp,from.up);vectorNear(ring.normal,from.right);
  vectorNear(ring.center.map((x,i)=>(x-from.eye[i])/(ring.radius*ring.side)),from.up);
  const path=T.warpPath(from,[0,.5,0],ring),before=JSON.stringify(ring);
  vectorNear(T.jumpPose(path,5).forward,from.forward.map((x,i)=>x*.5+from.up[i]*ring.side*Math.sqrt(.75)),1e-8);
  T.jumpPose(path,10);assert.equal(JSON.stringify(ring),before);
 }
});

test('virtual locator inherits actual velocity, speed and projected camera tilt',()=>{
 const T=window.SolarRingTour,from={eye:[0,0,0],forward:[0,1,0],up:[-.5,0,Math.sqrt(.75)],right:[-Math.sqrt(.75),0,-.5]};
 const velocity=[.3,.4,.1],speed=Math.hypot(...velocity),forward=velocity.map(x=>x/speed);
 const d=from.up.reduce((s,x,i)=>s+x*forward[i],0),up=from.up.map((x,i)=>x-forward[i]*d),n=Math.hypot(...up);
 const ring=T.planWarp(from,velocity);vectorNear(ring.entryForward,forward);vectorNear(ring.viewUp,up.map(x=>x/n));
 const fast=T.planWarp(from,velocity.map(x=>x*4));assert.ok(fast.radius>ring.radius);
 const p=T.warpPath(from,velocity,ring),h=1e-5;
 vectorNear(T.warpPosition(p,h).map((x,i)=>(x-from.eye[i])/h),velocity,.001);
 vectorNear(T.planWarp(from,[0,0,0]).entryForward,from.forward);
});

test('all eight warp departures limit visible heading to 60 degrees with opposite scene parallax',()=>{
 const T=window.SolarRingTour,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const from={eye:[0,0,0],forward:[0,1,0],up:[0,0,1],right:[-1,0,0]};
 const selected=new Set();
 for(let wanted=0;wanted<8;wanted++){
  let choice=0;const ring=T.planWarp(from,[0,0,0],[],4.3,()=>choice++===wanted?0:1);
  selected.add(ring.direction);near(ring.viewTurnAngle,Math.PI/3);
  const path=T.warpPath(from,[0,0,0],ring),steering=ring.viewTurnUp.map(x=>x*ring.side);
  let previous=0;
  for(let t=0;t<12;t+=.02){
   const pose=T.jumpPose(path,t),angle=Math.acos(Math.max(-1,Math.min(1,dot(pose.forward,from.forward))));
   assert.ok(angle<=Math.PI/3+1e-8);assert.ok(angle>=previous-1e-8);
   assert.ok(angle-previous<.01,'smooth turn, under 29 degrees per second');previous=angle;
  }
  const end=T.jumpPose(path,4.3);near(dot(end.forward,from.forward),.5);
  const scene=T.warpSceneEye(path,4.3);vectorNear(scene,end.eye.map((x,i)=>from.eye[i]+2*(x-from.eye[i])));
  assert.ok(dot(end.eye,steering)>0,'camera translation adds opposite scene parallax');
  vectorNear(from.eye,[0,0,0]);vectorNear(from.forward,[0,1,0]);
 }
 assert.equal(selected.size,8);
});

test('resting warp accelerates for 7.5 seconds while an already fast camera peaks earlier',()=>{
 const T=window.SolarRingTour,from={eye:[0,0,0],forward:[0,1,0],up:[0,0,1],right:[-1,0,0]};
 const rest=T.planWarp(from,[0,0,0]),fast=T.planWarp(from,[0,2,0]);
 near(rest.accelerationDuration,7.5);near(fast.accelerationDuration,5);
 const path=T.warpPath(from,[0,0,0],rest),h=1e-4;
 const speed=t=>Math.hypot(...T.warpPosition(path,t+h).map((x,i)=>(x-T.warpPosition(path,t-h)[i])/(2*h)));
 assert.ok(speed(1)<speed(3)&&speed(3)<speed(5)&&speed(5)<speed(7));
 near(speed(7.5),speed(8),1e-5);assert.ok(speed(5)<speed(8)*.85);
});

test('vertical quarter/half turns carry speed, gradually bank to thirty degrees and never flip at the pole',()=>{
 const T=window.SolarRingTour,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const from={eye:[0,0,0],forward:[0,1,0],up:[0,0,1],right:[-1,0,0]},velocity=[0,.5,0];
 for(const angle of [Math.PI/2,Math.PI])for(const side of [-1,1]){
  const ring={virtual:true,center:[0,0,10*side],normal:[-1,0,0],u:[0,1,0],entryForward:from.forward,entryUp:from.up,radius:10,side,turnAngle:angle,speed:.5};
  const path=T.warpPath(from,velocity,ring),h=.00001,start=T.jumpPose(path,0);
  vectorNear(start.eye,from.eye);vectorNear(start.forward,from.forward);
  vectorNear(T.jumpPose(path,h).eye.map((x,i)=>(x-start.eye[i])/h),velocity,.001);
  let previous=start;
  for(let t=1/120;t<=8;t+=1/120){const pose=T.jumpPose(path,t);
   assert.ok(dot(pose.up,previous.up)>.998,'continuous pitch, including the vertical crossing');
   const bank=Math.acos(Math.max(-1,Math.min(1,dot(pose.right,from.right))));
   assert.ok(bank<=30*Math.PI/180+1e-8,'additional warp bank stays within thirty degrees');previous=pose;
  }
  vectorNear(T.jumpPose(path,5).forward,angle===Math.PI/2?[0,0,side]:[0,-1,0],1e-8);
  const cruise=T.jumpPose(path,8),tailAngle=Math.acos(Math.max(-1,Math.min(1,dot(T.jumpPose(path,5).forward,cruise.forward))));
  assert.ok(tailAngle>.02&&tailAngle<.1,'subtle continuous curvature keeps the warp sky moving');
  const next=T.jumpPose(path,8+h),velocityAt=next.eye.map((x,i)=>(x-cruise.eye[i])/h),length=Math.hypot(...velocityAt);
  assert.ok(dot(cruise.forward,velocityAt.map(x=>x/length))>.9999,'view follows the ongoing curve');
  const roll=t=>Math.acos(Math.max(-1,Math.min(1,dot(T.jumpPose(path,t).right,from.right))));
  assert.ok(roll(2)<roll(5)&&roll(5)<roll(8));near(roll(10),30*Math.PI/180);
  const a=T.jumpPose(path,5-h),b=T.jumpPose(path,5),c=T.jumpPose(path,5+h);
  vectorNear(b.eye.map((x,i)=>(x-a.eye[i])/h),c.eye.map((x,i)=>(x-b.eye[i])/h),.001);
  vectorNear(b.forward.map((x,i)=>(x-a.forward[i])/h),c.forward.map((x,i)=>(x-b.forward[i])/h),.001);
 }
});

test('virtual bank starts blending on T without resetting the captured tilt',()=>{
 const T=window.SolarRingTour,roll=15*Math.PI/180;
 const from={eye:[0,0,0],forward:[0,1,0],up:[-Math.sin(roll),0,Math.cos(roll)],right:[-Math.cos(roll),0,-Math.sin(roll)]};
 const ring={virtual:true,center:[0,0,10],normal:[-1,0,0],u:[0,1,0],entryForward:[0,1,0],entryUp:[0,0,1],radius:10,side:1,turnAngle:Math.PI/2,speed:.5};
 const path=T.warpPath(from,[0,.5,0],ring),start=T.jumpPose(path,0),next=T.jumpPose(path,.00001);
 vectorNear(start.up,from.up);vectorNear(start.right,from.right);
 vectorNear(next.up,start.up,1e-7);vectorNear(next.right,start.right,1e-7);
});

test('warp bank follows incoming roll rate before tilt or locator side',()=>{
 const T=window.SolarRingTour,angle=.25;
 for(const rate of [-.02,.02,0]){
  const from={eye:[0,0,0],forward:[0,1,0],right:[-Math.cos(angle),0,-Math.sin(angle)],up:[-Math.sin(angle),0,Math.cos(angle)],bankRate:rate};
  const ring=T.planWarp(from,[0,.5,0]);assert.equal(ring.bankSide,rate?Math.sign(rate):1);
  const path=T.warpPath(from,[0,.5,0],ring),a=T.jumpPose(path,0),b=T.jumpPose(path,.1);
  vectorNear(a.up,from.up);assert.ok(Math.hypot(...b.up.map((x,i)=>x-a.up[i]))>1e-5,'bank begins during first tenth of a second');
 }
});

test('takeoff differentiates matching control samples without inventing pan velocity',()=>{
 const tour=create();tour.age=18;tour.state='cruising';tour.pose=tour.cameraPose();
 const shown=[...tour.pose.eye];tour.pan=[.3,-.2];tour.yaw+=1.8;
 const current=tour.cameraPose(),before=tour.cameraPose(tour.age-.001),clean=p=>p.eye.map((x,i)=>x-p.right[i]*p.drift[0]-p.up[i]*p.drift[1]);
 const expected=clean(current).map((x,i)=>(x-clean(before)[i])/.001),start=tour.takeoffStart();
 vectorNear(start.velocity,expected);assert.ok(Math.hypot(...start.velocity)<20,'no one-millisecond pan impulse');
 vectorNear(tour.pose.eye,shown);assert.ok(Number.isFinite(start.from.bankRate));
});

test('warp shares the polar boarding curve and joins a moving ring with continuous velocity',()=>{
 const T=window.SolarRingTour;
 for(const radius of [2,20,2000])for(const sign of [-1,1]){
  const ring={center:[0,4,0],u:[1,0,0],normal:[0,1,0],radius,speed:.8};
  const from={eye:[radius*2,12,0],forward:[0,0,sign],right:[sign,0,0],up:[0,1,0]},velocity=[0,0,sign*.2];
  const p=T.warpPath(from,velocity,ring,4),h=.00001,sample=t=>T.jumpPose(p,t);
  vectorNear(sample(0).eye,from.eye);vectorNear(sample(0).forward,from.forward);
  vectorNear(sample(h).eye.map((x,i)=>(x-from.eye[i])/h),velocity,.001);
  const a=sample(4-h),b=sample(4),c=sample(4+h);
  vectorNear(b.eye.map((x,i)=>(x-a.eye[i])/h),c.eye.map((x,i)=>(x-b.eye[i])/h),.003);
  near(Math.hypot(b.eye[0],b.eye[2]),radius,1e-6);
  assert.ok(Math.hypot(...sample(5).forward.map((x,i)=>x-b.forward[i]))>0);
  assert.ok(Math.abs(p.omega)<=.08);near(Math.abs(p.omega),Math.min(.08,.8/radius));
 }
});
test('warp takeoff retains both linear and angular cruise momentum, including early boarding',()=>{
 for(const age of [.5,6,22]){
  const tour=create(123);tour.age=age;tour.state=age<10?'entering':'cruising';tour.pose=tour.cameraPose();
  const clean=p=>({...p,eye:p.eye.map((x,i)=>x-p.right[i]*(p.drift?.[0]||0)-p.up[i]*(p.drift?.[1]||0))});
  const from=clean(tour.pose),previous=clean(tour.cameraPose(age-.001)),velocity=from.eye.map((x,i)=>(x-previous.eye[i])/.001);
  tour.startTakeoff(0,Infinity,0,[0,1,0],null,[],{center:[0,8,0],u:[1,0,0],normal:[0,1,0],side:1,radius:10,speed:.8,duration:5});
  const start=tour.takeoffPose(0),next=tour.takeoffPose(.00001);
  vectorNear(start.eye,from.eye);vectorNear(start.forward,from.forward);
  vectorNear(next.eye.map((x,i)=>(x-start.eye[i])/.00001),velocity,.002);
  vectorNear(next.forward.map((x,i)=>(x-start.forward[i])/.00001),from.forward.map((x,i)=>(x-previous.forward[i])/.001),.003);
  near(tour.replayBridge.takeoff.path.speed,Math.hypot(...velocity));
  near(tour.takeoffPose(5).perspective,1);vectorNear(tour.takeoffPose(5).offset,[0,0]);
 }
});

test('warp heading follows motion without horizon flips or excess bank',()=>{
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(x=>x/(Math.hypot(...a)||1));
 for(const back of [0,Math.PI])for(const side of [-1,1]){
  const tour=create();tour.age=22;tour.state='cruising';tour.look(back,.12);tour.pose=tour.cameraPose();
  const normal=[0,.6,-.8];
  tour.startTakeoff(0,Infinity,0,normal,null,[],{center:[-25,8*side,4],u:[1,0,0],normal,side,radius:20,speed:.8,duration:5});
  let previous=tour.takeoffPose(0);
  for(let i=1;i<=1200;i++){
   const time=i/120,p= tour.takeoffPose(time),levelRight=unit(cross(normal,p.forward)),levelUp=cross(p.forward,levelRight);
   const roll=Math.abs(Math.atan2(dot(p.up,levelRight),dot(p.up,levelUp)));
   if(time>=2.5)assert.ok(roll<=window.SolarRingTour.bankLimit+1e-6,'shared bank cap');
   const step=Math.acos(Math.max(-1,Math.min(1,dot(previous.up,p.up))));
   assert.ok(step<.04,'no abrupt orientation flip at '+time);
   if(time>=7){const ahead=tour.takeoffPose(time+.001),velocity=unit(ahead.eye.map((x,j)=>x-p.eye[j]));assert.ok(dot(p.forward,velocity)>.995,'must face motion, not outward/up');}
   previous=p;
  }
  const path=tour.replayBridge.takeoff.path,later=tour.takeoffPose(9),count=path.views.length;
  tour.takeoffPose(2);vectorNear(tour.takeoffPose(9).forward,later.forward);assert.equal(path.views.length,count,'reuse deterministic heading samples');
 }
});

test('travel Saturn participates once in the shared far-to-near planet order',()=>{
 const ms=Date.UTC(2026,9,3),astro=window.SolarAstro;
 const view={right:[1,0,0],down:[0,1,0],forward:[0,0,1]};
 for(const state of ['entering','cruising','returning'])for(const saturnZ of [-100,-15,-5,10])for(const showOthers of [true,false]){
  const calls=[],bodies=['earth','saturn','sun','neptune'].map((id,i)=>({
   body:id==='sun'?astro.SUN:astro.BODIES.find(b=>b.id===id),
   world:{x:0,y:0,z:id==='saturn'?saturnZ:[-10,0,-20,-30][i]},
   physical:{x:1,y:0,z:0},screen:{},r:10,directJob:{}}));
  const saturn=bodies[1],r=Object.create(R),tour={state,job:{},pose:{fov:72},draw:()=>calls.push('saturn')};
  Object.assign(r,{lastPathMs:ms,pathYear:astro.modelYear(ms),w:1280,h:800,scale:10,options:{activity:true},compatSurfaceJobs:[],directBodies:[],
   updateFrameBodies:()=>({bodies}),currentFrameItem:()=>saturn,updateProjectionAnchor(){},updateRingTourTracking(){},prepareRingTourReturn:()=>state==='returning',
   bodyRadiusAtZoom:()=>10,prepareRingTourProjection:p=>p,
   projectRingTourPoint(p,world,out,r,normal){Object.assign(out,{z:world.z,radius:r,localX:0,localY:0,localZ:world.z});normal.perspective=1;},
   visible:()=>showOthers,surfaceJob:(b,p,r,ms,s,d,job)=>job,coronaSource:()=>null,
   gpu:{prepare(){},corona:()=>calls.push('corona'),planet:(job,body)=>calls.push(body.id)}});
  r.drawRingTourBodies(tour,frame,view,ms,0,0);
  const expected=(showOthers?bodies:[saturn]).slice().sort((a,b)=>a.world.z-b.world.z).flatMap(b=>b.body.id==='sun'?['corona','sun']:[b.body.id]);
  assert.deepEqual(calls,expected,state+' at '+saturnZ);assert.equal(calls.filter(id=>id==='saturn').length,1);
  assert.deepEqual(tour.visibleBodies,showOthers?['neptune','sun','earth']:[]);
 }
});

test('card and ring entry share readiness and reject invalid or duplicate starts',()=>{
 const r=Object.create(R),p={r:80,screen:{x:640,y:400},directJob:{}},texture={texture:{}};
 Object.assign(r,{currentFrameItem:()=>p,gpu:{textures:new Map([['saturn',texture],['saturn-ring',texture]]),gl:{isContextLost:()=>false,getExtension:()=>({})}}});
 assert.equal(r.canStartRingTour(),true);
 for(const [object,key,value] of [[r,'ringTour',{}],[r,'cameraTween',{}],[r.gpu,'contextLost',true],
  [p,'r',0],[p,'r',NaN],[p,'r',Infinity],[p,'directJob',null],[p.screen,'behind',true],[p.screen,'x',NaN],[p.screen,'y',Infinity],
  [r.gpu.gl,'isContextLost',()=>true],[r.gpu.gl,'getExtension',()=>null]]){
  const before=object[key];object[key]=value;
  assert.equal(r.canStartRingTour(),false,key);assert.equal(r.startRingTour(),false,key);object[key]=before;
 }
 for(const id of ['saturn','saturn-ring']){r.gpu.textures.delete(id);assert.equal(r.canStartRingTour(),false,id);r.gpu.textures.set(id,texture);}
 r.currentFrameItem=()=>null;assert.equal(r.canStartRingTour(),false);
});
function step(t,start,end){for(let ms=start;ms<=end;ms+=16)t.advance(ms);if(t.lastMono<end)t.advance(end);}

test('T leaves on a short arc with retained velocity, steady cruise and smooth braking',()=>{
 for(const age of [2,22])for(const side of [-1,1])for(const turnChoice of [0,1,2,3]){
  const t=create(123);t.age=age;t.direction=side;t.state=age<10?'entering':'cruising';t.pose=t.cameraPose();
  const from=t.pose,pool=t.points,dt=.00001,cleanEye=from.eye.map((v,i)=>v-from.right[i]*from.drift[0]-from.up[i]*from.drift[1]);
  t.startTakeoff(0,Infinity,turnChoice);const takeoff=t.replayBridge.takeoff;
  vectorNear(t.returnPose(0).eye,cleanEye,1e-8);
  const initial=t.returnPose(dt);vectorNear(initial.eye.map((v,i)=>(v-cleanEye[i])/dt),takeoff.velocity,.001);
  let previous=t.returnPose(0),turn=0;
  for(let s=.016;s<7;s+=.016){
   const pose=t.returnPose(s);assert.ok([...pose.eye,...pose.forward,...pose.up,pose.fov,pose.orthoScale].every(Number.isFinite));
   turn+=Math.acos(Math.max(-1,Math.min(1,pose.forward.reduce((v,x,i)=>v+x*previous.forward[i],0))));previous=pose;
   assert.ok(Math.hypot(...pose.eye)>1,'takeoff stays outside Saturn');
  }
  assert.ok(turn<Math.PI*2,'bounded spiral, not repeated view revolutions');
  vectorNear(t.returnPose(6).forward,t.returnPose(5).forward);
  const speed=s=>Math.hypot(...t.returnPose(s+dt).eye.map((v,i)=>(v-t.returnPose(s).eye[i])/dt));
  assert.ok(speed(6)>0);assert.ok(speed(3)>speed(1));
  takeoff.brakeAt=7;
  const atStop=t.returnPose(15),hold=t.returnPose(15.9);
  vectorNear(atStop.eye,hold.eye);vectorNear(atStop.forward,hold.forward);
  assert.ok(speed(14.9)<speed(7)*.01,'brake eases into a full stop');
  assert.equal(t.points,pool);t.dispose();
 }
});

test('T settles its gentle spiral in four seconds with continuous velocity and acceleration',()=>{
 const Tour=window.SolarRingTour,from={eye:[0,0,4],forward:[0,0,-1],up:[0,1,0],right:[1,0,0]},h=.0001;
 for(const turn of [0,1,2,3]){
  const path=Tour.jumpPath(from,[.2,0,0],turn,8),pose=t=>Tour.jumpPose(path,t);
  const speed=t=>pose(t+h).eye.map((v,i)=>(v-pose(t-h).eye[i])/(2*h));
  const acceleration=t=>pose(t+h).eye.map((v,i)=>(v-2*pose(t).eye[i]+pose(t-h).eye[i])/(h*h));
  vectorNear(pose(0).eye,from.eye);vectorNear(pose(0).forward,from.forward);
  for(let t=0;t<=6;t+=.05){const p=pose(t),angle=Math.acos(Math.max(-1,Math.min(1,p.forward.reduce((n,v,i)=>n+v*from.forward[i],0))));assert.ok(angle<=Math.PI/4+1e-8);}
  near(Math.acos(pose(4).forward.reduce((n,v,i)=>n+v*from.forward[i],0)),Math.PI/4);
  vectorNear(pose(4).forward,pose(6).forward);vectorNear(speed(4-h),speed(4+h),.0001);
  vectorNear(acceleration(4-h),acceleration(4+h),.001);
  assert.ok(Math.abs(pose(2).eye[0]-from.eye[0])>.1,'translation follows a non-planar spiral');
 }
});

test('T departure directions follow the solar plane, not camera roll, including polar views',()=>{
 const Tour=window.SolarRingTour,solarUp=[0,.6,.8];
 for(const forward of [[0,0,-1],solarUp,solarUp.map(v=>-v)])for(const turn of [0,1,2,3]){
  const from={eye:[0,0,4],forward,up:[0,1,0],right:[1,0,0]};
  const a=Tour.jumpPath(from,[0,0,0],turn,8,solarUp),b=Tour.jumpPath({...from,up:[1,0,0],right:[0,-1,0]},[0,0,0],turn,8,solarUp);
  const pose=Tour.jumpPose(a,3);assert.ok([...pose.eye,...pose.forward].every(Number.isFinite));
  vectorNear(pose.eye,Tour.jumpPose(b,3).eye);vectorNear(pose.forward,Tour.jumpPose(b,3).forward);
 }
});

test('T previews only up/down departures once and chooses the least obstructed view without moving its start',()=>{
 const t=create(321),samples=[];t.age=22;t.state='cruising';t.pose=t.cameraPose();
 const from=t.pose,pool=t.points;
 t.startTakeoff(0,Infinity,0,[0,.6,.8],pose=>{samples.push(pose);return pose.forward[0];});
 assert.equal(samples.length,4);assert.equal(t.points,pool);
 near(t.returnPose(4).forward[0],Math.min(...samples.map(p=>p.forward[0])));
 vectorNear(t.returnPose(0).eye,from.eye.map((v,i)=>v-from.right[i]*from.drift[0]-from.up[i]*from.drift[1]));
 t.returnPose(20);assert.equal(samples.length,4,'no path search in the animation loop');t.dispose();
});

test('a named sky locator is the actual straight-flight heading, with a gentle angular speed',()=>{
 const Tour=window.SolarRingTour,angle=50*Math.PI/180,from={eye:[0,0,4],forward:[0,0,-1],up:[0,1,0],right:[1,0,0]};
 const locator={id:'A1',direction:[0,Math.sin(angle),-Math.cos(angle)]};
 const path=Tour.jumpPath(from,[0,0,0],0,8,[0,1,0],locator);
 assert.equal(path.locator,'A1');near(path.duration,4);
 vectorNear(Tour.jumpPose(path,path.duration).forward,locator.direction);
 vectorNear(Tour.jumpPose(path,path.duration+5).forward,locator.direction);
 vectorNear(Tour.jumpPose(path,0).forward,from.forward);
});

test('T chooses the angularly nearest A and faces it after exactly four seconds',()=>{
 const t=create(123);t.age=22;t.state='cruising';t.pose=t.cameraPose();
 const from=t.pose,make=(id,angle,axis)=>({id,direction:from.forward.map((v,i)=>v*Math.cos(angle)+axis[i]*Math.sin(angle))});
 const targets=[make('A-far',.5,from.up),make('A-near',.2,from.right),make('A-middle',.3,from.up)];
 let previews=0;t.startTakeoff(0,Infinity,0,[0,1,0],()=>{previews++;return 1e9;},targets);
 assert.equal(previews,0);assert.equal(t.replayBridge.takeoff.path.locator,'A-near');
 near(t.replayBridge.takeoff.path.duration,4);vectorNear(t.returnPose(4).forward,targets[1].direction);
 for(let age=0;age<=4;age+=.02)assert.ok(Math.hypot(...t.returnPose(age).eye)>1,'spiral never crosses Saturn');
 t.dispose();
});

test('prepared opening tour transfers its existing pools without rebuilding or double disposal',()=>{
 const prepared=create(123),points=prepared.points,field=prepared.flightField,layers=prepared.instanceLayers;
 const t=create(456,{prepared,openingVelocity:{eye:[0,0,-1]}});
 assert.equal(t.points,points);assert.equal(t.flightField,field);assert.equal(t.instanceLayers,layers);
 assert.ok(prepared.disposed);prepared.dispose();assert.equal(t.points.length,30000*5);
 assert.notDeepEqual(t.startPose,t.locatorPose(10));t.dispose();assert.equal(field.points.length,0);assert.equal(t.points.length,0);
});
test('completed replay resources are retained once and fade in afresh on the next tour',()=>{
 const prepared=create(123);prepared.age=25;prepared.visualAge=25;prepared.state='cruising';prepared.pose=prepared.cameraPose();prepared.prepareGrainRoute();
 prepared.stop();prepared.prepareGrainRoute();prepared.state='complete';
 const pool=prepared.flightField.points,positions=pool.map(p=>[...p.world]),height=prepared.height;
 const r=Object.assign(Object.create(R),{ringTour:prepared,invalidatePresentation(){}});
 assert.ok(r.endRingTour(true));assert.equal(r.ringTour,null);assert.equal(r.preparedRingTour,prepared);assert.ok(!prepared.disposed);
 const t=create(456,{prepared:r.preparedRingTour});r.preparedRingTour=null;
 assert.equal(t.flightField.points,pool);assert.equal(t.flightField.alpha,0);assert.ok(!t.flightField.exit);
 for(let i=0;i<pool.length;i++){near(pool[i].world[1],positions[i][1]+t.height-height);assert.equal(pool[i].exitFade,undefined);assert.equal(pool[i].born,Infinity);}
 t.age=10;t.visualAge=10;t.pose=t.cameraPose();t.prepareGrainRoute();
 assert.ok(pool.every(p=>Number.isFinite(p.born)));t.dispose();assert.equal(pool.length,0);
});

test('automatic opening handoff keeps incoming velocity and suppresses departure annotations',()=>{
 const openingVelocity={eye:[.1,-.2,-1.3],offset:[.03,-.02],orthoScale:-1.3};
 const t=create(123,{openingVelocity}),a=t.entryPose(0),b=t.entryPose(.00001);
 for(const key of ['eye','offset'])a[key].forEach((v,i)=>near((b[key][i]-v)/.00001,openingVelocity[key][i],.005));
 near((b.orthoScale-a.orthoScale)/.00001,openingVelocity.orthoScale,.005);
 near((b.perspective-a.perspective)/.00001,0,.005);
 vectorNear(t.entryPose(2.5).eye,t.rawEntryPose(2.5).eye);
 vectorNear(t.entryPose(10).eye,t.locatorPose(10).eye);
 for(const age of [0,1,4,10]){t.visualAge=age;assert.equal(t.annotationOpacity(),0);}
 const r={ringTour:t};assert.equal(R.ringTourReturnOpacity.call(r),0);
 t.annotationReveal=true;assert.equal(R.ringTourReturnOpacity.call(r),1);
});
test('opening momentum releases without a sudden acceleration at either blend endpoint',()=>{
 const t=create(123,{openingVelocity:{eye:[.1,-.2,-1.3],offset:[.03,-.02],orthoScale:-1.3}}),dt=.0001;
 const correction=age=>t.entryPose(age).eye.map((v,i)=>v-t.rawEntryPose(age).eye[i]);
 for(const times of [[0,dt,2*dt],[2.5-2*dt,2.5-dt,2.5]]){
  const [a,b,c]=times.map(correction);
  for(let i=0;i<3;i++)near((c[i]-2*b[i]+a[i])/(dt*dt),0,.01);
 }
});

test('shared bank is bounded, scale independent and smooth through a curve reversal',()=>{
 const bank=window.SolarRingTour.smoothBank,right=[1,0,0];
 for(const sign of [-1,1]){
  const path=t=>[sign*Math.sin(t),0,Math.cos(t)];
  assert.equal(Math.sign(bank(path,.8,right)),-sign);
  for(let t=0;t<5;t+=.01){
   const a=bank(path,t,right),b=bank(path,t+.001,right);
   assert.ok(Math.abs(a)<=20*Math.PI/180);assert.ok(Math.abs(a-b)<.005);
   near(a,bank(u=>path(u).map(v=>v*1000),t,right),1e-8);
  }
 }
});

test('handoff bank follows the velocity-bridged camera path, with no opening roll jump',()=>{
 const t=create(123,{openingVelocity:{eye:[3,-1,-4],offset:[0,0],orthoScale:-1}});
 const original=t.cruiseBank;let measured;
 t.cruiseBank=(age,angle)=>{measured=angle;return 0;};
 let difference=0;
 for(const age of [.25,.5,1,1.5,2,2.5,2.7,3,4,6]){
  const pose=t.entryPose(age),actual=measured,u=Math.max(0,Math.min((age-2.5)/3.5,1)),ramp=u*u*u*(u*(u*6-15)+10);
  if(age<=2.5)near(actual,0);
  const expected=window.SolarRingTour.smoothBank(s=>t.entryPose(s).eye,age,pose.right)*ramp;
  near(actual,expected,1e-8);
  difference=Math.max(difference,Math.abs(actual-window.SolarRingTour.smoothBank(s=>t.entryPosition(s),age,pose.right)*ramp));
 }
 assert.ok(difference>1e-7,'bank still samples the bridged path at its transition edge');
 t.cruiseBank=original;
 vectorNear(t.entryPose(0).right,t.startPose.right);
 vectorNear(t.entryPose(0).up,t.startPose.up);
 for(const age of [0,2.5]){
  const a=t.entryPose(age),b=t.entryPose(age+.0001);
  assert.ok(Math.hypot(...b.up.map((v,i)=>v-a.up[i]))<.001);
 }
});

test('automatic S entry selects the requested opposite curvature without altering manual click rules',()=>{
 for(const turnSign of [-1,1]){
  const t=create(123,{openingVelocity:{eye:[.1,-.2,-1.3],offset:[0,0],orthoScale:0},target:{side:1,turnSign}});
  const value=window.SolarRingTour.smoothBank(age=>t.entryPosition(age),1,t.startPose.right);
  assert.equal(Math.sign(value),turnSign);
 }
});

test('random bank starts only after first X80 arrival and shares the X/Y cycle',()=>{
 const t=create(),start=10+t.period;
 for(const age of [0,5,10,start])near(t.cruiseBank(age,.2),.2);
 near(t.cruiseBank(start+.001,.2),.2,1e-8);
 let previous=null;
 for(let lap=2;lap<=12;lap++){
  const age=10+lap*t.period,angle=t.cruiseBank(age,0);
  assert.ok(Math.abs(angle)<=20*Math.PI/180);assert.ok(Math.abs(angle)>=.58*20*Math.PI/180);
  if(previous!==null)assert.ok(Math.abs(angle-previous)>20*Math.PI/180);
  near(t.cruiseBank(age-.001,0),angle,1e-8);near(t.cruiseBank(age+.001,0),angle,1e-8);
  previous=angle;
 }
});

test('cruise wave starts at the sampled outer landing and smoothly selects new bounded targets every lap',()=>{
 for(const side of [-1,1])for(const direction of [-1,1]){
  const t=create();t.height=side*Math.abs(t.height);t.direction=direction;
  const start=t.cruiseWave(10),one=t.cruiseWave(10+t.period),two=t.cruiseWave(10+2*t.period);
  near(start.radius,t.radius);near(start.height,t.height);
  near(one.radius,2.26-(2.26-1.35)*.8);near(one.height,-t.height);
  assert.notEqual(one.radius,two.radius);assert.notEqual(one.height,two.height);
  for(let lap=0;lap<30;lap+=.1){const wave=t.cruiseWave(10+lap*t.period);
   assert.ok(wave.radius>=2.26-(2.26-1.35)*.8&&wave.radius<=2.26);
   assert.ok(Math.abs(wave.height)<=Math.abs(t.height));
  }
  for(const age of [10+t.period,10+2*t.period]){
   vectorNear(t.entryPosition(age),t.locatorPose(age).eye);
   const a=t.cruiseWave(age-.0001),b=t.cruiseWave(age+.0001);
   near(a.radius,b.radius,1e-7);near(a.height,b.height,1e-7);
  }
 }
});

test('random cruise targets keep large X/Y excursions and are independent of sampling order',()=>{
 const prototype=window.SolarRingTour.prototype;
 for(let seed=0;seed<100;seed++){
  const t=Object.create(prototype);t.seed=seed;
  let previous=t.cruiseTarget(1);
  for(let lap=2;lap<200;lap++){
   const target=t.cruiseTarget(lap);
   assert.ok(target.x>=0&&target.x<=.8);assert.ok(target.y>=0&&target.y<=1);
   assert.ok(Math.abs(target.x-previous.x)>.5,'X must move more than 50 percentage points');
   assert.ok(Math.abs(target.y-previous.y)>=.6-1e-12,'Y must move at least 60 percentage points');
   t.cruiseTarget(lap+123);assert.deepEqual(t.cruiseTarget(lap),target);
   previous=target;
  }
 }
});
test('camera drift is continuous, smooth and strictly screen-plane translation',()=>{
 const t=create();t.state='cruising';t.look(.7,.3);t.move(.02,.01);
 const controls=[t.yaw,t.pitch,...t.pan],route=t.locatorPose(25).eye;
 const centre={eye:[1.77,0,0]};
 for(let age=10;age<30;age+=.5){
  let movement=0;
  for(let time=age;time<age+.5;time+=.01){
   const drift=t.cameraDrift(time,centre),next=t.cameraDrift(time+.001,centre);
   assert.deepEqual(t.cameraDrift(time,centre),drift);
   drift.forEach((v,i)=>{assert.ok(Math.abs(v)<=.0011119804416);assert.ok(Math.abs(next[i]-v)<.000123);});
   movement+=Math.hypot(...drift);
  }
  assert.ok(movement>.001,'no skipped half-second noise windows in the ring centre');
 }
 const age=25,shaken=t.cameraPose(age),strength=t.driftStrength;t.driftStrength=()=>0;
 const still=t.cameraPose(age);t.driftStrength=strength;
 for(const key of ['right','up','forward'])vectorNear(shaken[key],still[key]);
 near(shaken.eye.reduce((sum,v,i)=>sum+(v-still.eye[i])*still.forward[i],0),0,1e-12);
 vectorNear(t.locatorPose(25).eye,route);assert.deepEqual([t.yaw,t.pitch,...t.pan],controls);
});

test('five shuffled noise patterns blend continuously and decay throughout retreat',()=>{
 const t=create();
 for(let cycle=0;cycle<12;cycle++){
  const bag=Array.from({length:5},(_,i)=>t.driftPattern(cycle*5+i));
  assert.equal(new Set(bag).size,5);
  if(cycle)assert.notEqual(bag[0],t.driftPattern(cycle*5-1));
 }
 for(let age=4;age<80;age+=4){
  const before=t.driftWave(age-.00001),at=t.driftWave(age),after=t.driftWave(age+.00001);
  vectorNear(before,at,.001);vectorNear(after,at,.001);
  vectorNear(at,t.driftWave(age));
 }
 t.age=25;t.state='cruising';t.pose=t.cameraPose();const old=t.pose;t.stop();vectorNear(old.eye,t.pose.eye);
 for(const p of [0,.25,.5,.75,1]){
  const seconds=p*t.returnDuration,expected=t.driftWave(t.returnNoise.age+seconds);
  const weight=1-(p*p*p*(p*(p*6-15)+10));
  vectorNear(t.cameraDrift(t.age,t.pose,true,seconds),expected.map(v=>v*t.returnNoise.strength*weight));
 }
});

test('automatic opening handoff has no vibration before the ring detail approach',()=>{
 const t=create(123,{openingVelocity:{eye:[.1,-.2,-1.3],offset:[0,0],orthoScale:0}});
 for(let age=0;age<=2.5;age+=.1)vectorNear(t.cameraDrift(age),[0,0]);
});

test('noise strength fades into the ring and peaks centrally on every pass',()=>{
 const t=create(),centre=[1.77,0,0],peak=t.driftStrength(12,centre);
 near(peak,.001235533824*.9);near(t.driftStrength(0,centre),0);
 const start=t.detailStart,middle=(start+10)/2;
 near(t.driftStrength(start,centre),0);
 assert.ok(t.driftStrength(middle,centre)>0&&t.driftStrength(middle,centre)<peak);
 near(t.driftStrength(12,[3,0,0]),0);near(t.driftStrength(12,[1.77,.3,0]),0);
 for(const side of [-1,1]){
  let previous=peak;
  for(const distance of [.1,.3,.49,.65,.8]){
   const value=t.driftStrength(12,[1.77+side*distance,0,0]);
   assert.ok(value<=previous);previous=value;
  }
 }
 for(const age of [6,8,12,25]){
  t.age=age;t.state=age<10?'entering':'cruising';t.look(.2,.1);t.pose=t.cameraPose();
  const before=t.pose,previous=t.cameraPose(age-.0001);t.stop();
  vectorNear(t.pose.eye,before.eye);vectorNear(t.pose.forward,before.forward);
  const after=t.cameraPose(age,.0001);
  vectorNear(after.eye.map((v,i)=>(v-before.eye[i])/.0001),before.eye.map((v,i)=>(v-previous.eye[i])/.0001),.02);
  assert.ok(t.returnNoise.strength>=0);vectorNear(t.cameraDrift(age,t.pose,true,t.returnDuration),[0,0]);
  // Each next case starts a new entry/cruise state without redirecting an exit.
  delete t.returnMotion;delete t.returnRedirect;t.returnAge=0;
 }
});

test('ring flight has a fixed, deterministic pool and random route per seed',()=>{
 const a=create(),b=create(),c=create(567);assert.deepEqual(a.points,b.points);assert.equal(a.radius,b.radius);assert.notEqual(a.height,c.height);
 const pool=a.points,grains=a.flightField.points;step(a,0,20000);
 assert.equal(a.points,pool);assert.equal(a.flightField.points,grains);assert.equal(pool.length,30000*5);assert.equal(grains.length,5000);
 assert.equal(a.state,'cruising');assert.ok(Math.hypot(...a.pose.eye)>1.3);
});
test('locator races immediately while the camera takes ten seconds to board',()=>{
 const t=create();let seed=123,sample;
 for(let i=0;i<3;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;sample=seed/4294967296;}
 const previousPeriod=(115+sample*55)/4;
 assert.equal(t.period,previousPeriod/1.5);
 step(t,0,9992);assert.equal(t.state,'entering');t.advance(10000);assert.equal(t.state,'cruising');
 const angle=t.angle,start=t.lastMono;
 step(t,start+16,start+1024);
 const expected=t.direction*Math.PI*3/previousPeriod*1.024;
 assert.ok(Math.abs(t.angle-angle-expected)<1e-10);
 t.stop();const stoppedAt=t.lastMono;
 step(t,stoppedAt+16,stoppedAt+2096);assert.equal(t.state,'returning');
 t.advance(stoppedAt+2112);assert.equal(t.state,'returning');
});
test('looking and lens changes leave path and original camera independent',()=>{
 const t=create();t.driftStrength=()=>0;step(t,0,10000);const eye=[...t.pose.eye],angle=t.angle,dir=[...t.pose.forward];
 t.look(.7,.2);t.zoom(1.2);t.advance(t.lastMono);
 assert.equal(t.angle,angle);assert.deepEqual([...t.pose.eye],eye);assert.notDeepEqual([...t.pose.forward],dir);
 for(const v of [t.pose.up,t.pose.right,t.pose.forward])assert.ok(Math.abs(Math.hypot(...v)-1)<1e-8);
});
test('one Escape spirals out within seven seconds; repeat Escape never restarts or cuts',()=>{
 const t=create();step(t,0,10000);t.stop();
 for(let ms=10016;ms<12300;ms+=16){t.advance(ms);assert.ok(Number.isFinite(t.speed)&&t.speed>=0);}
 assert.equal(t.state,'returning');assert.equal(t.stop(),false);
 assert.ok(t.returnDuration<=7);
 t.returnAge=t.returnDuration*.7;let prev=Infinity;
 while(t.returnAge<t.returnDuration-.02){t.advance(t.lastMono+16);assert.ok(t.speed<=prev);prev=t.speed;}
 t.returnAge=t.returnDuration-.016;t.advance(t.lastMono+16);
 assert.equal(t.state,'complete');vectorNear(t.pose.eye,t.startPose.eye);vectorNear(t.pose.forward,t.startPose.forward);
 near(t.pose.fov,t.startPose.fov);near(t.pose.perspective,0);
 const q=t.projectGrain(t.flightField.points[0],t.flightField,{},1280,800);assert.equal(q.alpha,0);
 t.dispose();t.dispose();assert.equal(t.points.length,0);assert.equal(t.flightField.points.length,0);assert.equal(t.resources,null);
});
test('clicked angle seeds the locator in the outer twenty percent, then camera boards it',()=>{
 const renderer={w:1280,camera:{focus:'saturn'},gpu:{},bodyFrame:()=>frame,currentFrameItem:()=>({body:{},r:180,screen:{x:640,y:400}})};
 const target=[-1.9,0,.2],x=640+(frame.u.x*target[0]+frame.v.x*target[2])*180,y=400+(frame.u.y*target[0]+frame.v.y*target[2])*180;
 const hit=R.ringTourHit.call(renderer,x,y);assert.ok(hit);vectorNear(hit.point,target);
 assert.equal(hit.side,-1);const t=create(123,{target:hit});t.driftStrength=()=>0;
 near(Math.atan2(t.locatorStart.eye[2],t.locatorStart.eye[0]),Math.atan2(target[2],target[0]));
 step(t,0,10000);vectorNear(t.pose.eye,t.locatorPose().eye);vectorNear(t.pose.forward,t.locatorPose().forward);
 assert.ok(t.radius>=2.26-(2.26-1.28)*.2&&t.radius<=2.26);
 assert.equal(R.ringTourHit.call(renderer,640,400),false);
});
test('ring hover and picking start at the visible inner band, not transparent map padding',()=>{
 const f={u:{x:1,y:0,z:0},v:{x:0,y:1,z:0},pole:{x:0,y:0,z:1}};
 const r={camera:{},gpu:{},ringTourHover:true,bodyFrame:()=>f,currentFrameItem:()=>({body:{},r:100,screen:{x:640,y:400}})};
 assert.equal(R.ringTourHit.call(r,640+1.31*100,400),false);
 assert.ok(R.ringTourHit.call(r,640+1.36*100,400));
 const starts=[],c={save(){},restore(){},beginPath(){},moveTo(x,y){starts.push([x,y]);},lineTo(){},stroke(){}};
 R.drawRingTourHover.call(r,c);
 assert.equal(starts.length,2);near(starts[0][0],640+1.35*100);near(starts[1][0],640+2.26*100);
});

test('distant untracked ring can be selected and boards in ten seconds regardless of distance',()=>{
 for(const radius of [.5,2,10,180]){
  const renderer={camera:{focus:null},gpu:{},bodyFrame:()=>frame,currentFrameItem:()=>({body:{},r:radius,screen:{x:640,y:400}})};
  const hit=R.ringTourHit.call(renderer,640-1.8*radius,400-.2*radius);assert.ok(hit);
  const t=create(123,{radius,target:hit});t.driftStrength=()=>0;step(t,0,9992);assert.equal(t.state,'entering');t.advance(10000);
  assert.equal(t.state,'cruising');vectorNear(t.pose.eye,t.locatorPose().eye);t.dispose();
 }
});

test('tilted Saturn axis selects left/right independently of viewport centre and landing hemisphere',()=>{
 for(const roll of [-1.2,-.6,0,.9,1.9])for(const hemisphere of [-1,1])for(const side of [-1,1]){
  const base={u:{x:1,y:0,z:0},pole:{x:0,y:-.8,z:.6*hemisphere},v:{x:0,y:-.6*hemisphere,z:-.8}},c=Math.cos(roll),s=Math.sin(roll);
  const f=Object.fromEntries(Object.entries(base).map(([key,v])=>[key,{x:c*v.x-s*v.y,y:s*v.x+c*v.y,z:v.z}]));
  const axis=window.SolarRingTour.screenAxis(f),sign=Math.sign(f.u.x*axis[0]+f.u.y*axis[1]);
  const target=[side*sign*1.75,0,.5],centre={x:1100,y:400};
  const dx=f.u.x*target[0]+f.v.x*target[2],dy=f.u.y*target[0]+f.v.y*target[2];
  const renderer={w:1280,camera:{focus:'saturn'},gpu:{},bodyFrame:()=>f,currentFrameItem:()=>({body:{},r:80,screen:centre})};
  const x=centre.x+dx*80,y=centre.y+dy*80;assert.ok(x>640,'both clicks are on the same viewport half');
  const hit=R.ringTourHit.call(renderer,x,y);assert.ok(hit);assert.equal(hit.side,side);vectorNear(hit.point,target);
  const t=create(456,{frame:f,target:hit,screen:centre}),a=t.startAngle;
  const vx=(-Math.sin(a)*f.u.x+Math.cos(a)*f.v.x)*t.direction;
  const vy=(-Math.sin(a)*f.u.y+Math.cos(a)*f.v.y)*t.direction;
  assert.equal(Math.sign(vx*axis[0]+vy*axis[1]),side);assert.equal(t.landingSide,hemisphere);
  t.dispose();
 }
});

test('handoff projection preserves off-centre tracking view, orientation and sky roll',()=>{
 const t=create(123,{screen:{x:790,y:440}}),p=t.pose,f=800/(2*Math.tan(p.fov*Math.PI/360)),point=[.3,.5,-.4],delta=point.map((v,i)=>v-p.eye[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
 near(640+(dot(delta,p.right)/t.orthoScale+p.offset[0])*f,790+180*(point[0]*frame.u.x+point[1]*frame.pole.x+point[2]*frame.v.x));
 near(400-(dot(delta,p.up)/t.orthoScale+p.offset[1])*f,440+180*(point[0]*frame.u.y+point[1]*frame.pole.y+point[2]*frame.v.y));
 vectorNear(p.right,[1,0,0]);near(dot(p.right,p.up),0);near(dot(p.up,p.forward),0);
 const sky=t.skyCamera({u:{x:1,y:0,z:0},pole:{x:0,y:0,z:1},v:{x:0,y:1,z:0}},{});
 assert.ok(sky.viewAxes);near(Math.hypot(...sky.viewAxes.right),1);
});
test('entry and return remain continuous after free look, pan and lens changes, including early Escape',()=>{
 for(const stopAt of [400,2200,5000,12000])for(const target of [[-1.8,0,0],[1.8,0,0],[0,0,-1.8]]){
  const t=create(321,{target:{point:target}});step(t,0,stopAt);
  t.look(2.1,.8);t.move(.07,.04);t.zoom(1.4);t.advance(t.lastMono);
  const before=t.pose;t.stop();t.advance(t.lastMono);vectorNear(t.pose.eye,before.eye);vectorNear(t.pose.forward,before.forward);
  let last=t.pose;
  for(let ms=t.lastMono+8;ms<stopAt+5800;ms+=8){
   t.advance(ms);assert.equal(t.stop(),false);
   assert.ok(Math.hypot(...t.pose.eye)>1.05);
   assert.ok(Math.hypot(...t.pose.eye.map((v,i)=>v-last.eye[i]))<.12);
   assert.ok(Math.hypot(...t.pose.forward.map((v,i)=>v-last.forward[i]))<.06);
   for(const key of ['forward','up','right'])near(Math.hypot(...t.pose[key]),1);
   last=t.pose;
  }
  t.returnAge=t.returnDuration;t.advance(t.lastMono);
  assert.equal(t.state,'complete');vectorNear(t.pose.eye,t.startPose.eye);vectorNear(t.pose.up,t.startPose.up);near(t.pose.fov,72);
 }
});
test('home at five seconds backs out directly to a distinct home pose without a second tween',()=>{
 const t=create();step(t,0,5000);const pose=t.pose;
 const r=Object.create(R);Object.assign(r,{ringTour:t,gpu:{resetBindings(){},gl:{isContextLost:()=>false}},invalidatePresentation(){},camera:r.defaultCameraSnapshot(),cameraTween:null,options:{dollyZoom:true}});
 assert.equal(r.animateHome(5000,1100),true);assert.equal(t.state,'returning');vectorNear(t.pose.eye,pose.eye);assert.equal(r.cameraTween,null);
 t.advance(5100);const returnAge=t.returnAge;r.animateHome(5100,1100);near(t.returnAge,returnAge);
 step(t,5116,7500);assert.equal(t.state,'returning');const before=t.pose;
 const home=window.SolarRingTour.viewPose({frame,radius:12,width:1280,height:800,screen:{x:820,y:510}});
 t.setReturnView(home);t.returnTargetApplied=true;vectorNear(t.pose.eye,before.eye);vectorNear(t.pose.forward,before.forward);
 assert.ok(t.returnDuration>=5);t.returnAge=t.returnDuration-.01;t.advance(7516);
 assert.equal(t.state,'complete');vectorNear(t.pose.eye,home.eye);vectorNear(t.pose.offset,home.offset);near(t.pose.orthoScale,home.orthoScale);
 assert.equal(r.drawRingTour(0,0,12500),false);assert.equal(r.ringTour,null);assert.equal(r.cameraTween,null);
 assert.equal(r.drawRingTour(0,0,12516),false);assert.equal(r.cameraTween,null);
});

test('boarding carries inward velocity through the sampled landing instead of stopping and accelerating again',()=>{
 for(const radius of [.5,10,180]){
  const t=create(123,{radius}),radial=age=>Math.hypot(...t.entryPosition(age).filter((_,i)=>i!==1)),dt=.0001;
  const before=(radial(10)-radial(10-dt))/dt,after=(radial(10+dt)-radial(10))/dt;
  assert.ok(before<-.005&&after<-.005,'landing must be a through-point');
  near(before,after,.0001);near(after,-t.boardingSpeed(),.0001);
  const a=t.entryPosition(10-dt),b=t.entryPosition(10),c=t.entryPosition(10+dt);
  vectorNear(b.map((v,i)=>(v-a[i])/dt),c.map((v,i)=>(v-b[i])/dt),.001);
 }
});

test('entry flows into orbit without a zero-velocity junction, and suspend does not catch up',()=>{
 const t=create(123,{target:{point:[1.8,0,0]}});
 const at=age=>{t.age=age;return t.cameraPose().eye;};
 const before=at(9.999),end=at(10),after=at(10.001);
 vectorNear(end.map((v,i)=>(v-before[i])/.001),after.map((v,i)=>(v-end[i])/.001),.002);
 t.advance(10000);const age=t.age;t.lastMono=null;t.advance(1000000);near(t.age,age);
});

test('ESC and home spirals preserve initial motion and direction and arrive within seven seconds',()=>{
 for(const side of [-1,1])for(const age of [7,8,10,12,26])for(const home of [false,true]){
  const t=create(123,{radius:home?10:180,target:{point:[1.7*side,0,.4],side}});
  t.age=age;t.look(.5,.2);t.move(.04,.02);t.pose=t.cameraPose();
  const before=t.cameraPose(age-.001),from=t.pose;t.stop();
  if(home){t.returnTarget={};t.setReturnView(window.SolarRingTour.viewPose({frame,radius:12,width:1280,height:800,screen:{x:790,y:440}}));}
  const start=t.cameraPose(age,0),next=t.cameraPose(age,.001),goal=t.returnTo;
  near(t.returnMotion.rotationTime,Math.min(7,2*t.returnMotion.turn/t.returnMotion.angularVelocity/1.1));
  assert.ok(t.returnDuration<=7);assert.ok(!t.returnMotion.rewind);
  vectorNear(start.eye,from.eye);vectorNear(start.forward,from.forward);
  if(!home){
   for(const key of ['eye','forward']){
    const incoming=from[key].map((v,i)=>(v-before[key][i])/.001),outgoing=next[key].map((v,i)=>(v-start[key][i])/.001);
    vectorNear(incoming,outgoing,.025*Math.max(1,Math.hypot(...incoming)));
   }
  }
  let previousSpeed=t.returnMotion.angularVelocity;
  for(let i=0;i<100;i++){
   const elapsed=t.returnDuration*i/100,dt=.0001,a=t.returnPose(elapsed),b=t.returnPose(elapsed+dt);
   const angle=Math.atan2(b.eye[2],b.eye[0])-Math.atan2(a.eye[2],a.eye[0]);
   const speed=Math.atan2(Math.sin(angle),Math.cos(angle))*t.direction/dt;
   assert.ok(speed>=-1e-8,'no reverse');
   if(t.returnMotion.rotationTime<7)assert.ok(speed<=previousSpeed+1e-5,'uncapped spiral only decelerates');
   previousSpeed=speed;
   assert.ok(Math.hypot(...a.eye)>1.05,'never cross Saturn');
  }
  const end=t.returnPose(t.returnDuration);vectorNear(end.eye,goal.eye);vectorNear(end.forward,goal.forward);vectorNear(end.up,goal.up);
  const penultimate=t.returnPose(t.returnDuration-.001),angle=Math.atan2(end.eye[2],end.eye[0])-Math.atan2(penultimate.eye[2],penultimate.eye[0]);
  assert.ok(Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle))/.001)<.0001,'arrival angular speed is zero');
 }
});

test('saved-view commands share Home exit policy without disposing the tour or starting a second tween',()=>{
 for(const age of [5,8,12])for(const slot of [1,2,3]){
  const t=create();t.age=age;t.pose=t.cameraPose();const before=t.pose,r=Object.create(R);
  Object.assign(r,{ringTour:t,camera:r.defaultCameraSnapshot(),options:{moon:true,pluto:true,dollyZoom:true},cameraTween:null,prepareCloseup(){}});
  const target={...r.defaultCameraSnapshot(),azimuth:slot*.4,dolly:1+slot*.2,focus:slot===2?'earth':null};
  assert.equal(r.animateCamera(target,1000,1100),true);assert.equal(t.state,'returning');
  assert.equal(!!t.returnMotion.rewind,age===5);assert.equal(t.disposed,false);assert.equal(r.cameraTween,null);
  vectorNear(t.pose.eye,before.eye);vectorNear(t.pose.forward,before.forward);
  assert.equal(t.returnTarget.focus,target.focus);near(t.returnTarget.azimuth,target.azimuth);assert.ok(t.returnDuration<=7);
  t.returnAge=.2;t.returnTargetApplied=true;const previous=t.returnTarget;
  assert.equal(r.animateCamera(target,1200,1100),true);near(t.returnAge,.2);assert.equal(t.returnTarget,previous);assert.equal(t.returnTargetApplied,true);
  assert.equal(r.animateCamera({focus:'invalid'},1300),false);assert.equal(t.disposed,false);assert.equal(t.returnTarget,previous);
 }
});

test('cancelling before departure does not force a many-minute full orbit',()=>{
 for(const home of [false,true]){
  const t=create();t.age=.4;t.pose=t.cameraPose();if(home)t.returnTarget={};t.stop();
  assert.ok(t.returnMotion.rewind);assert.ok(t.returnDuration<=5);
  vectorNear(t.returnPose(t.returnDuration).eye,t.startPose.eye);
 }
});
test('screen side selects the approach direction on both near and far halves; departure has no roll flip',()=>{
 for(const z of [-.8,.8])for(const side of [-1,1]){
  const t=create(123,{target:{point:[-1.8,0,z],side}}),initial=t.entryAngle;
  t.driftStrength=()=>0; // This test measures the path, not the visual vibration.
  assert.equal(Math.sign(-Math.sin(t.startAngle)*t.direction),side);
  const curved=t.entryPosition(2.5);assert.equal(Math.sign(curved[0]-t.startEye[0]),side);
  step(t,0,1000);near(t.angle,initial+t.direction*Math.PI*2/t.period);
  const departure=Math.hypot(...t.pose.eye.map((v,i)=>v-t.startEye[i]));
  step(t,1016,2000);near(t.angle,initial+t.direction*Math.PI*4/t.period);
  const later=Math.hypot(...t.pose.eye.map((v,i)=>v-t.startEye[i]));
  assert.ok(departure<later*.5);
  let previous=t.pose;
  for(let ms=2016;ms<=11000;ms+=16){t.advance(ms);assert.ok(t.pose.up[1]>0);assert.ok(t.pose.forward.reduce((n,v,i)=>n+v*previous.forward[i],0)>.995);previous=t.pose;}
  vectorNear(t.pose.eye,t.locatorPose().eye);
 }
});
test('immutable debris passes share one bounded upload array and keep each solid subset sorted',()=>{
 const t=create();step(t,0,11000);
 const members=new Set(),data=t.instanceData;let count=0;
 for(const layer of t.instanceLayers.slice(0,3)){
  assert.equal(layer.points,t.points);for(const i of layer.indices){assert.ok(!members.has(i));members.add(i);assert.equal(!!layer.mesh,t.points[i+3]>=.0025);}
  const n=t.visibleInstances(layer.points,2.92,data,t.instanceOrder,layer.indices);assert.equal(t.instanceOrder.length,n);
  if(layer.mesh)count+=n;
  for(let i=1;i<n;i++)assert.ok(t.depths[t.instanceOrder[i-1]/5]>=t.depths[t.instanceOrder[i]/5]);
 }
 assert.equal(members.size,30000);assert.ok(count>0&&count<7500);assert.ok(data.length<t.points.length);
 assert.equal(t.fogPoints.length,10000*5);t.dispose();assert.equal(t.instanceData.length,0);assert.equal(t.instanceLayers.length,0);assert.equal(t.memoryUsage(),0);
});
test('rounded geometry LOD submits each visible rock once and retains detail near the camera',()=>{
 const t=create(),data=t.instanceData,indices=t.instanceLayers[1].indices;
 step(t,0,12000);const focal=800/(2*Math.tan(t.pose.fov*Math.PI/360));
 const visible=t.visibleInstances(t.points,5,data,t.instanceOrder,indices),all=new Set(t.instanceOrder);
 const high=t.visibleInstances(t.points,5,data,t.instanceOrder,indices,true,null,{level:1,focal}),members=new Set(t.instanceOrder);
 const low=t.visibleInstances(t.points,5,data,t.instanceOrder,indices,true,null,{level:0,focal});
 for(const i of t.instanceOrder){assert.ok(!members.has(i));members.add(i);}
 assert.equal(high+low,visible);assert.deepEqual(members,all);assert.ok(low>0&&high>0);
 t.pose={eye:[0,0,0],forward:[0,0,1],perspective:1,orthoScale:1};
 const p=new Float32Array([0,0,1,.004,.15]),sample=pixels=>{
   p[2]=7*p[3]*100/pixels;
   return t.visibleInstances(p,10,data,[],[0],false,null,{level:1,focal:100});
 };
 assert.equal(sample(8),1);assert.equal(sample(5),1);assert.equal(sample(3),0);
 assert.equal(sample(5),0);assert.equal(sample(8),1);
 t.dispose();assert.equal(t.meshDetail.length,0);
});
test('dust removes only fixed spatial clumps, retaining coverage and palette diversity',()=>{
 const t=create(),other=create(),layer=t.instanceLayers.find(l=>l.fog),p=t.fogPoints;
 assert.deepEqual(layer.indices,other.instanceLayers.find(l=>l.fog).indices);
 // A denser candidate pool removes a larger fraction of close neighbours;
 // coverage, fixed membership and actual spacing remain the invariants.
 assert.ok(layer.indices.length<10000&&layer.indices.length>1800,layer.indices.length);
 const sectors=Array(12).fill(0);let warm=0;
 for(const i of layer.indices){
   sectors[Math.floor((Math.atan2(p[i+2],p[i])+Math.PI)/(Math.PI*2)*12)%12]++;
   if((p[i+4]*127.1)%1<.7)warm++;
   for(const j of layer.indices){if(j<=i)continue;
     assert.ok(Math.hypot(p[i]-p[j],p[i+1]-p[j+1],p[i+2]-p[j+2])>=.35/.75*(p[i+3]+p[j+3]));
   }
 }
 assert.ok(sectors.every(n=>n>40));assert.ok(warm/layer.indices.length>.65&&warm/layer.indices.length<.75);
 const before=[...layer.indices];step(t,0,25000);assert.deepEqual([...layer.indices],before);
 let warmRocks=0;for(let i=4;i<t.points.length;i+=5)if((t.points[i]*127.1)%1<.7)warmRocks++;
 assert.ok(warmRocks/30000>.68&&warmRocks/30000<.72);
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.equal((source.match(/float warm=/g)||[]).length,1);
 assert.equal((source.match(/\$\{DEBRIS_TINT\}/g)||[]).length,2);
});
test('opening and ring travel call exactly one shared particle painter and style owner',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
 assert.equal((source.match(/drawFlightParticles\(c,field,project\)/g)||[]).length,1);
 assert.ok(source.includes('this.drawFlightParticles(c,field,'));
 assert.ok(source.includes('this.drawFlightParticles(this.ctx,tour.flightField,'));
 assert.ok(source.includes('...this.flightParticleStyle(rand)'));
 assert.ok(source.includes('grainStyle:rand=>this.flightParticleStyle(rand)'));
});
test('near disk fade and billboard reveal use the same distance helper',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.equal((source.match(/float ringDetail\(/g)||[]).length,1);
 const thresholds=source.match(/float ringDetail\(float distance\)\{return 1\.-smoothstep\(([\d.]+),([\d.]+),distance\);\}/);
 assert.ok(thresholds);const start=Number(thresholds[1]),end=Number(thresholds[2]);
 near(start,1.2);near(end,2.8);
 const disk=d=>{const t=Math.max(0,Math.min(1,(d-start)/(end-start)));return t*t*(3-2*t);};
 near(disk(1.2),0);near(disk(2),.5);near(disk(2.8),1);
 assert.ok(!source.includes('fogPass)*(1.-smoothstep(.9,1.8,length(d)))'),'rocks must not disappear before the distant disk appears');
 assert.ok(source.includes('1.-ringTransition(p,debrisReady)'));assert.ok(source.includes('occlusion*ringTransition(world,debrisReady)'));
 assert.ok(source.includes('fade*ringTransition(world,debrisReady)'));
 assert.equal((source.match(/float ringTransition\(/g)||[]).length,1);
 // At every loading/entry stage the disappearing disk and appearing debris
 // are complementary. No separate timeout/alpha loop removes a flying rock.
 for(const ready of [0,.2,.5,.8,1])for(let d=1;d<=5;d+=.025){
  const detail=(1-disk(d))*ready;near((1-detail)+detail,1);
  if(d>=end)assert.equal(detail,0,'distant original ring stays intact throughout entry');
 }
 assert.ok(source.includes('vec3(point.x,0.,point.z)-detailEye'));
 assert.ok(source.includes('ringDetail(distance)*ready'));
 assert.ok(!source.includes('float grazing='),'view angle must not expand the local fade over the distant ring');
 assert.ok(source.includes('drawArraysInstancedANGLE'));assert.ok(!source.includes('gl_PointCoord'));
 assert.ok(!source.includes('gravel'),'discarded gravel planes leave no shader or uniform work');
});

test('ring handoff expands locally from the nearest point, equally above and below',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(source.includes('delta.y*=5.'));
 assert.ok(!source.includes('ringProximity'));
 const fade=(horizontal,height)=>{const d=Math.hypot(horizontal,height*5),p=Math.max(0,Math.min(1,(d-1.2)/1.6));return 1-p*p*(3-2*p);};
 for(const side of [-1,1]){
  near(fade(0,side*.6),0);near(fade(0,side*.24),1);
  near(fade(0,side*.4),.5);
  assert.ok(fade(.1,side*.4)>fade(1,side*.4),'nearby debris appears before distant debris');
  assert.equal(fade(2.8,side*.04),0,'far ring is retained');
 }
 assert.ok(source.includes('const proximity=this.preparationReady&&r.ready?detail.amount:0'));
 assert.ok(source.includes('smooth((this.visualAge-r.atlasAge)/.8)*layers.debris'));
 assert.ok(source.includes('smooth(this.visualAge/1.2)*(fog?layers.dust:layers.debris)'));
});

test('entry and retreat reverse the same local alpha curve; retreat keeps its existing distance field',()=>{
 const t=create(),eye=[1.77,.36,0];
 near(t.ringDetailState(eye).amount,0);
 t.age=10;vectorNear(t.ringDetailState(eye).eye,eye);near(t.ringDetailState(eye).amount,1);
 assert.ok(!fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8').includes('smoothstep(0.,1.,ringDetail(distance)*ready)'));
 step(t,0,12000);t.stop();step(t,12016,14200);assert.equal(t.state,'returning');
 t.returnAge=0;const initial=t.ringDetailState();assert.ok(initial.amount>.99);
 for(const duration of [3.2,5]){
  t.returnDuration=duration;
  for(const fraction of [0,.1,.25,.5,.75,1]){
   t.returnAge=duration*fraction;t.pose=t.cameraPose();
   const current=t.ringDetailState();vectorNear(current.eye,initial.eye);
   near(current.amount,initial.amount*(1-t.returnProgress()));
  }
 }
});

test('tracked Saturn starts its local handoff at 2.5 seconds; distant starts wait for the same proximity',()=>{
 const close=create(123,{radius:200}),far=create(123,{radius:10});
 near(close.detailStart,2.5,.000001);assert.ok(far.detailStart>close.detailStart+2);
 for(const t of [close,far]){
  let previous=0;
  for(const time of [0,2.5,t.detailStart,t.detailStart+.5,t.detailStart+1,(t.detailStart+10)/2,10]){
   t.age=time;t.pose=t.cameraPose();const detail=t.ringDetailState();
   assert.ok(detail.amount>=previous-1e-9);previous=detail.amount;
   if(time<=t.detailStart)near(detail.amount,0);else assert.ok(detail.amount>0);
  }
  near(previous,1);
  t.age=6;t.pose=t.cameraPose();const entry=t.ringDetailState();t.stop();
  vectorNear(t.ringDetailState().eye,entry.eye);near(t.ringDetailState().amount,entry.amount);
 }
 close.age=12;close.state='cruising';close.pose=close.cameraPose();close.stop();
 for(const fraction of [0,.1,.25,.5,.75,.9,1]){
  far.state='entering';far.age=far.detailStart+(10-far.detailStart)*fraction;far.pose=far.cameraPose();
  close.returnAge=close.returnDuration*fraction;
  near(far.ringDetailState().amount+close.ringDetailState().amount,1);
 }
});

test('undocked ESC retraces the shared entry path after braking, including both sides and distant entry',()=>{
 for(const radius of [.5,10,200])for(const side of [-1,1])for(const age of [.4,2.5,5]){
  const t=create(123,{radius,target:{point:[1.7*side,0,.4],side}});t.age=age;t.pose=t.cameraPose();
  const from=t.pose,before=t.cameraPose(age-.0001);t.stop();assert.ok(t.returnMotion.rewind);
  vectorNear(t.returnPose(0).eye,from.eye);
  const next=t.returnPose(.0001);
  const incoming=from.eye.map((v,i)=>(v-before.eye[i])/.0001),outgoing=next.eye.map((v,i)=>(v-from.eye[i])/.0001);
  vectorNear(incoming,outgoing,.01*Math.max(1,Math.hypot(...incoming)));
  let previous=Infinity;
  for(let time=.5;time<=t.returnDuration;time+=.05){
   const sourceAge=t.rewindAge(time);assert.ok(sourceAge<previous);previous=sourceAge;
   const actual=t.returnPose(time),expected=t.entryPose(sourceAge);
   vectorNear(actual.eye,expected.eye);vectorNear(actual.forward,expected.forward);
   assert.ok(Math.hypot(...actual.eye)>1.05);
  }
  vectorNear(t.returnPose(t.returnDuration).eye,t.startPose.eye);
 }
});

test('home redirect while backing out preserves current pose and alpha and never crosses Saturn',()=>{
 for(const radius of [.5,10,200]){
  const t=create(123,{radius});t.age=5;t.pose=t.cameraPose();t.stop();t.returnAge=.5;t.pose=t.cameraPose();
  const before=t.pose,detail=t.ringDetailState();
  const home=window.SolarRingTour.viewPose({frame,radius:12,width:1280,height:800,screen:{x:820,y:510}});
  t.setReturnView(home);vectorNear(t.cameraPose().eye,before.eye);vectorNear(t.cameraPose().forward,before.forward);
  near(t.ringDetailState().amount,detail.amount);vectorNear(t.ringDetailState().eye,detail.eye);
  for(let time=.5;time<t.returnDuration;time+=.05)assert.ok(Math.hypot(...t.returnPose(time).eye)>1.05);
  vectorNear(t.returnPose(t.returnDuration).eye,home.eye);near(t.returnPose(t.returnDuration).orthoScale,home.orthoScale);
 }
});

test('return policy switches exactly at eighty percent boarding, not eighty percent elapsed time',()=>{
 for(const progress of [.799,.801])for(const side of [-1,1]){
  const t=create(123,{target:{point:[side*1.7,0,.4],side}});let low=0,high=10;
  for(let i=0;i<40;i++){const middle=(low+high)/2;if(t.entryMotion(middle).weight<progress)low=middle;else high=middle;}
  t.age=high;t.pose=t.cameraPose();const before=t.pose;t.stop();
  assert.equal(!!t.returnMotion.rewind,progress<.8);assert.ok(t.age<8);
  vectorNear(t.pose.eye,before.eye);vectorNear(t.pose.forward,before.forward);
  assert.ok(t.returnDuration<=7);
 }
});

test('grazing ring coverage preserves partial pixels rather than multiplying edge fades',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(source.includes('ringCoverage(r,aa*.98)'));
 assert.ok(source.includes('(min(2.26,radius+span*.5)-max(1.28,radius-span*.5))/span'));
 const coverage=(radius,span)=>Math.max(0,Math.min(1,(Math.min(2.26,radius+span/2)-Math.max(1.28,radius-span/2))/span));
 near(coverage(1.77,.1),1);near(coverage(1.28,.1),.5);near(coverage(2.26,.1),.5);
 for(const span of [1,2,5,10])near(coverage(1.77,span),.98/span);
 for(const radius of [1.3,1.5,1.77,2,2.24])assert.ok(coverage(radius,3)>.3);
});
test('debris representation stays fixed and invisible sprites cannot leave depth cutouts',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(source.includes('g.clear(g.DEPTH_BUFFER_BIT);g.enable(g.DEPTH_TEST)'));
 assert.ok(source.includes('g.depthMask(!fog)'));
 assert.ok(source.includes('g.depthMask(true);g.disable(g.DEPTH_TEST)'));
 assert.ok(!source.includes('debrisLod('),'representation is decided once on CPU, never duplicated on GPU');
 const tour=create(),layers=tour.instanceLayers;
 assert.equal(layers[0].mesh,'angularMesh');assert.equal(layers[1].mesh,'mesh');assert.ok(!layers[2].mesh);assert.equal(layers[3].mesh,'angularCoarseMesh');assert.equal(layers[4].mesh,'coarseMesh');assert.equal(layers[5].chips,true);assert.equal(layers[6].fog,true);
 assert.ok(source.includes('debrisFade(centerDepth,length(position-viewEye))'));
 assert.ok(source.includes('debrisFade(depth,length(position-viewEye))'));
 assert.equal((source.match(/\$\{DEBRIS_COLOR\}/g)||[]).length,2,'sprite and mesh share the same ivory tint');
 assert.ok(!source.includes('lodThreshold'));
 assert.ok(source.includes('if(alpha<.002)discard;'));
 assert.equal((source.match(/instances.drawArraysInstancedANGLE\(/g)||[]).length,1,'all debris passes use one rendering path');
 assert.ok(!source.includes('gl_FragCoord'),'LOD must not produce visible screen-door dots');
 assert.ok(source.includes('${root.SolarSurfaceStyle.ringShadowGLSL}'));
 assert.ok(!source.includes('float ringShadow('),'shadow belongs to the shared surface style');
 assert.ok(!source.includes('sphere(p+light*.002,light)>0.'));
});

test('both four-sprite sources contribute exactly half; all eight sizes and spin directions vary',()=>{
 const t=create(),counts=Array(8).fill(0),sizes=new Set(),angles=new Set(),speeds=[];
 for(let i=0;i<t.points.length;i+=5){
  const seed=t.points[i+4],slot=Math.floor(seed*8);counts[slot]++;sizes.add(t.points[i+3]);
  const fract=v=>v-Math.floor(v);angles.add(fract(seed*353.17));speeds.push((fract(seed*7919.37)*2-1)*90);
  const scale=window.SolarRingTour.spriteSize[slot];
  assert.ok(t.points[i+3]>=.001*scale*.35-1e-9&&t.points[i+3]<=.009*.8*scale+1e-9);
 }
 assert.deepEqual(counts,Array(8).fill(3750));
 assert.deepEqual([...window.SolarRingTour.spriteSize],[.5,1,.5,.5,1,.5,1,.5]);
 assert.equal([0,1,4,5].reduce((n,i)=>n+counts[i],0),15000);
 assert.equal([2,3,6,7].reduce((n,i)=>n+counts[i],0),15000);
 assert.ok(sizes.size>10000&&angles.size>10000);
 assert.ok(Math.min(...speeds)>-90&&Math.max(...speeds)<90);
 assert.ok(speeds.some(v=>v< -89)&&speeds.some(v=>v>89)&&speeds.some(v=>Math.abs(v)<.01));
 let angular=0;for(let i=4;i<t.points.length;i+=5)if((t.points[i]*8)%1<.7)angular++;
 assert.ok(angular>t.points.length/5*.68&&angular<t.points.length/5*.72,'roughly seventy percent are angular shards, independent of the atlas source');
 const meshes=t.instanceLayers.filter(l=>l.mesh&&l.lod!==0),angularMeshes=meshes.find(l=>l.mesh==='angularMesh').indices.length;
 const meshCount=meshes.reduce((n,l)=>n+l.indices.length,0);
 assert.ok(angularMeshes/meshCount>.68&&angularMeshes/meshCount<.72);
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.equal((source.match(/float debrisAngle\(/g)||[]).length,1);
 assert.equal((source.match(/\$\{DEBRIS_ROTATION\}/g)||[]).length,2);
 assert.ok(!source.includes('gravelSample'));
 assert.ok(!source.includes('(length(world.xz)-1.28)'),'density must never cut through sprite/mesh pixels');
 assert.equal((source.match(/ringRadius=length\(position.xz\)/g)||[]).length,2);
});

test('fog is culled only after its distance fade reaches zero',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(source.includes('smoothstep(.001,.018,depth)*(1.-smoothstep(.9,1.8,length(d)))'));
 const fade=z=>{const t=Math.max(0,Math.min(1,(z-.001)/.017));return t*t*(3-2*t);};
 near(fade(.04),1);near(fade(.018),1);near(fade(.001),0);
 assert.ok(fade(.0095)>0&&fade(.0095)<1);
 assert.ok(source.includes('visibleInstances(points,fog?1.85:range'));
 assert.ok(source.includes('mix(.02,.001,fogPass)'));
});

test('rocks chips fog and particles have flattened elliptical sections and smaller edges',()=>{
 const t=create();
 for(const [pool,inner,outer,height] of [[t.points,1.28,2.26,.055*1.5],[t.chipPoints,1.28,2.26,.055*1.5],[t.fogPoints,1.3,2.24,.055*1.5*.7]]){
  let edge=0,centre=0,ne=0,nc=0;
  for(let i=0;i<pool.length;i+=5){
   const r=Math.hypot(pool[i],pool[i+2]),x=(2*r-inner-outer)/(outer-inner),y=pool[i+1]/(height*.5);
   assert.ok(x*x+y*y<=1.00001,'no rectangular cross-section corners');
   if(Math.abs(x)>.9){edge+=pool[i+3];ne++;}else if(Math.abs(x)<.25){centre+=pool[i+3];nc++;}
  }
  assert.ok(edge/ne<centre/nc*.65,'edge fragments must be smaller than central fragments');
 }
 const centre=2.26-(2.26-1.35)*.4,halfWidth=.9*.7/2,halfHeight=.7*.8*.7*.7*.8*1.5/2;
 assert.ok(halfWidth>halfHeight,'cross-section is flattened horizontally');
 for(const p of t.flightField.points){
  const x=(Math.hypot(p.world[0],p.world[2])-centre)/halfWidth,y=(p.world[1]-t.height)/halfHeight;
  assert.ok(x*x+y*y<=1.00001);
 }
});

test('dust centres stay inside seventy percent of the debris height, on both sides of the ring',()=>{
 const t=create(),dust=t.instanceLayers.find(l=>l.fog),bins=[0,0,0,0];
 for(const i of dust.indices){
   const y=t.fogPoints[i+1];assert.ok(Math.abs(y)<=.0275*1.5*.7+1e-8);
   bins[Math.min(3,Math.floor((y+.0275*1.5*.7)/(.055*1.5*.7)*4))]++;
 }
 assert.ok(bins.every(n=>n>dust.indices.length*.15),'dust remains distributed through the layer, not flattened to a single plane');
 for(let i=1;i<t.points.length;i+=5)assert.ok(Math.abs(t.points[i])<=.0275*1.5+1e-8);
 assert.equal(t.points.length/5,30000);assert.equal(t.fogPoints.length/5,10000);
});
test('five thousand route grains are world-fixed through free look, lens, pan and movement',()=>{
 const t=create(),particles=t.flightField.points;
 assert.equal(particles.length,5000);assert.ok(particles.every(p=>p.world&&!p.cameraLocal));
 const positions=particles.map(p=>[...p.world]);t.look(1,.2);t.zoom(1.1);t.move(.03,.005);step(t,0,3000);
 assert.deepEqual(particles.map(p=>[...p.world]),positions);
 assert.equal(t.flightField.routeKind,'orbit');assert.equal(t.flightField.revision,1);near(t.flightField.alpha,t.entryLayers().particles);
});
function settleGrainRoute(t){
 const pose=t.pose;t.pose={...pose,eye:[10000,10000,10000]};
 for(let i=0;i<2;i++){t.visualAge+=20;t.flightField.points.forEach(p=>t.grainFade(p));}
 t.pose=pose;
}
test('orbit grains surround locator camera height without detached layers and remain world-fixed',()=>{
 const t=create();t.age=12;t.visualAge=12;t.state='cruising';t.pose=t.cameraPose();t.prepareGrainRoute();
 settleGrainRoute(t);const counts=[0,0];let centre=0,sum=0;
 for(const p of t.flightField.points){const y=p.world[1]-t.height;
  assert.ok(Math.abs(y)<=.196);counts[y<0?0:1]++;sum+=y;if(Math.abs(y)<.05)centre++;
  assert.ok(Math.abs(Math.hypot(p.world[0],p.world[2])-(2.26-(2.26-1.35)*.4))<=.45*.7);
 }
 assert.ok(counts.every(n=>n>2200&&n<2800));
 assert.ok(centre>550);assert.ok(Math.abs(sum/t.flightField.points.length)<.01);
 const positions=t.flightField.points.map(p=>[...p.world]);t.look(Math.PI,.3);t.move(.1,.02);t.prepareGrainRoute();
 assert.deepEqual(t.flightField.points.map(p=>[...p.world]),positions);
});
test('orbit grains remain visible from boarding through two laps on both landing sides',()=>{
 for(const seed of [123,456]){
  const t=create(seed);t.age=8;t.visualAge=8;t.pose=t.cameraPose();t.prepareGrainRoute();
  assert.equal(t.state,'entering');assert.equal(t.flightField.routeKind,'orbit');near(t.flightField.alpha,t.entryLayers().particles);
  t.age=10;t.visualAge=10;t.state='cruising';t.prepareGrainRoute();
  const revision=t.flightField.revision;
  for(const side of [-1,1]){
   t.height=side*Math.abs(t.height);t.landingSide=side;t.landingElevation=Math.atan2(t.height,t.radius);
   for(let time=12;time<=10+2*t.period;time+=1){
    t.age=time;t.visualAge=time;t.state='cruising';t.pose=t.cameraPose();t.prepareGrainRoute();
    const visible=t.flightField.points.map(p=>t.projectGrain(p,t.flightField,{},1280,800)).filter(q=>q.visible&&q.alpha>.05);
    assert.ok(visible.length>60,`seed ${seed}, side ${side}, time ${time}: ${visible.length}`);
    assert.equal(t.flightField.revision,revision);
   }
  }
 }
});
test('return clears remaining orbit grains in a short fade without a return field',()=>{
 const t=create();t.age=12;t.visualAge=12;t.state='cruising';t.pose=t.cameraPose();t.prepareGrainRoute();settleGrainRoute(t);
 const p=t.flightField.points.find(p=>{const q=t.projectGrain(p,t.flightField,{},1280,800);return q.visible&&q.alpha>.05;});
 assert.ok(p);const position=[...p.world],before=t.grainFade(p);
 t.stop();t.prepareGrainRoute();assert.equal(p.pending,undefined);assert.deepEqual([...p.world],position);
 near(t.grainFade(p,t.visualAge+.5),before);assert.deepEqual([...p.world],position);
 const start=t.visualAge,duration=.6;let previous=1;
 for(const f of [0,.1,.25,.5,.75,1]){t.visualAge=start+duration*f;t.prepareGrainRoute();
  assert.ok(t.flightField.alpha<=previous);if(f>0)assert.ok(t.flightField.alpha<previous);previous=t.flightField.alpha;
  assert.deepEqual([...p.world],position);assert.ok(t.flightField.points.every(p=>!p.pending));}
 near(t.flightField.alpha,0);
});
test('procedural dust has ten thousand candidates, 25 percent smaller size and 30 percent lower opacity',()=>{
 const t=create(),sizes=[];for(let i=3;i<t.fogPoints.length;i+=5)sizes.push(t.fogPoints[i]);
 assert.equal(sizes.length,10000);assert.ok(Math.min(...sizes)>=.035*.75*.35-1e-8);
 assert.ok(Math.max(...sizes)<=.045*.8*2*.75+1e-8);assert.ok(Math.max(...sizes)>.071*.75);
 assert.equal(t.fogImage,undefined);assert.equal(window.SolarRingTour.dustUrl,undefined);
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(source.includes('}else rock=texture2D(atlas,st);'));
 assert.ok(source.includes('mix(1.,.091*band.a,fogPass)'));
});
test('mottled chips have their own ten thousand small, signed-spin instances and shared six-triangle geometry',()=>{
 const t=create(),layer=t.instanceLayers.find(l=>l.chips),pool=t.chipPoints,speeds=[];
 assert.equal(pool.length,10000*5);assert.equal(layer.indices.length,10000);assert.equal(layer.points,pool);
 let small=0;
 for(let i=0;i<pool.length;i+=5){
  assert.ok(pool[i+3]>=.0006*.35-1e-9&&pool[i+3]<=.0036+1e-9);
  if(pool[i+3]<.002)small++;
  const v=pool[i+4]*7919.37;speeds.push(((v-Math.floor(v))*2-1)*90);
 }
 assert.ok(small>7500);assert.ok(Math.min(...speeds)>=-90&&Math.max(...speeds)<=90);
 assert.ok(speeds.filter(s=>s<0).length>4500&&speeds.filter(s=>s>0).length>4500);
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(source.includes('function chipGeometry()'));assert.ok(source.includes('chipPass>.5'));
 assert.equal((source.match(/float debrisAngle\(/g)||[]).length,1);
 step(t,0,11000);assert.equal(t.chipPoints,pool);t.dispose();assert.equal(t.chipPoints.length,0);
});

test('route grains do not inflate subpixel distant specks or reveal a far return cloud',()=>{
 const t=create(),field=t.flightField;field.alpha=1;t.visualAge=2;
 t.pose={eye:[0,2,0],forward:[0,0,1],right:[1,0,0],up:[0,1,0],fov:72,perspective:0,orthoScale:50,offset:[0,0]};
 const p={world:[0,2,.5],range:1,size:2,glow:1,born:0,reveal:1};
 const far=t.projectGrain(p,field,{},1280,800);assert.equal(far.alpha,0);assert.ok(far.size<1.2);
 t.pose.perspective=1;const near=t.projectGrain(p,field,{},1280,800);assert.ok(near.alpha>0);
 assert.equal(near.glowSize,near.size*p.glow*.0625);
 p.world=[0,2,20];p.range=100;assert.equal(t.projectGrain(p,field,{},1280,800).alpha,0);
});

test('early cancellation and redirected exits never restart particle generation or brighten the fade',()=>{
 for(const age of [0,5,8.5,12]){
  const t=create(),pool=t.flightField.points;t.age=age;t.visualAge=age;t.state=age<10?'entering':'cruising';t.pose=t.cameraPose();t.prepareGrainRoute();
  pool.forEach(p=>t.grainFade(p));const oldPositions=pool.map(p=>[...p.world]),fades=pool.map(p=>t.grainFade(p));
  t.stop();t.prepareGrainRoute();assert.equal(t.flightField.routeKind,'orbit');assert.equal(t.flightField.points,pool);
  assert.deepEqual(pool.map(p=>[...p.world]),oldPositions);assert.deepEqual(pool.map(p=>p.exitFade),fades);
  t.returnAge=t.returnDuration*.3;t.visualAge+=t.returnAge;t.pose=t.cameraPose();t.prepareGrainRoute();const alpha=t.flightField.alpha;
  const revision=t.flightField.revision;
  const home=window.SolarRingTour.viewPose({frame,radius:12,width:1280,height:800,screen:{x:640,y:400}});
  t.setReturnView(home);t.prepareGrainRoute();assert.equal(t.flightField.revision,revision);near(t.flightField.alpha,alpha);
  assert.deepEqual(pool.map(p=>[...p.world]),oldPositions);assert.deepEqual(pool.map(p=>t.grainFade(p,t.visualAge+100)),fades);
  t.state='complete';t.prepareGrainRoute();assert.equal(t.flightField.alpha,0);
  assert.equal(t.projectGrain(pool[0],t.flightField,{},1280,800).alpha,0);t.dispose();assert.equal(pool.length,0);
 }
});
test('one proximity clock blends the ring layers together without staged switches',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 assert.ok(!source.includes('cameraLocal'));assert.ok(!source.includes('grainTravel'));
 const t=create();assert.equal(t.flightField.routeKind,'orbit');assert.equal(t.ringDetailState().amount,0);
 for(const progress of [0,.1,.25,.4,.5,.7,.75,1]){
  const v=t.entryLayers(progress);near(v.particles,.45*progress);near(v.debris,progress);near(v.dust,.65*progress);
 }
 const a=t.entryLayers(0),b=t.entryLayers(1);near(a.particles+a.debris+a.dust,0);near(b.debris,1);
 for(const age of [0,2,5,8,9.99]){t.age=age;t.visualAge=age;t.pose=t.cameraPose();t.prepareGrainRoute();near(t.flightField.alpha,t.entryLayers().particles);}
 t.age=10;t.visualAge=10;t.state='cruising';t.prepareGrainRoute();
 for(const p of t.flightField.points){near(t.grainFade(p,p.born),0);near(t.grainFade(p,p.born+p.reveal),1);}
 assert.ok(source.includes('const proximity=this.preparationReady&&r.ready?detail.amount:0'));
});

test('instance frustum retains every possibly visible rotated corner through mixed lenses',()=>{
 const t=create(),out=new Float32Array(5),order=[],point=new Float32Array(5);
 for(const perspective of [0,.2,.7,1])for(const fov of [35,72,100])for(const ratio of [.5,1,2]){
  t.pose={eye:[0,0,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1],perspective,orthoScale:.2,offset:[.3,-.2],fov};
  const frustum=t.instanceFrustum(800*ratio,800),tan=Math.tan(fov*Math.PI/360),lens=[tan*ratio,tan];
  for(const z of [-.1,.001,.2,1])for(const size of [.001,.03])for(const side of [-1,1]){
   const depth=.2*(1-perspective)+z*perspective;
   for(const axis of [0,1])for(const delta of [-.5,.5,2]){
    const position=[0,0,z];position[axis]=(side*lens[axis]-t.pose.offset[axis])*depth+side*size*delta;
    point.set([...position,size,.1]);
    const count=t.visibleInstances(point,10,out,order,[0],false,frustum);
    // Test all sphere-bound extremal and diagonal directions, not just centre.
    for(let a=0;a<32;a++)for(const v of [-.8,0,.8]){
     const angle=a*Math.PI/16,r=size*3.49,d=[Math.cos(angle)*Math.sqrt(1-v*v)*r,v*r,Math.sin(angle)*Math.sqrt(1-v*v)*r];
     const w=depth+d[2]*perspective,x=position[0]+d[0]+t.pose.offset[0]*w,y=position[1]+d[1]+t.pose.offset[1]*w;
     if(w>.001&&Math.abs(x)<=lens[0]*w&&Math.abs(y)<=lens[1]*w)assert.equal(count,1,'a visible corner must survive culling');
    }
   }
  }
  point.set([100,100,1,.01,.1]);assert.equal(t.visibleInstances(point,1000,out,order,[0],false,frustum),0);
 }
});
test('entry below the ring keeps screen-up rather than turning upside down',()=>{
 const below={u:{x:1,y:0,z:0},pole:{x:0,y:-.8,z:-.6},v:{x:0,y:.6,z:-.8}};
 for(const target of [[1.8,0,0],[-1.8,0,0],[0,0,-1.8]]){
  const t=create(123,{frame:below,target:{point:target}});
  assert.ok(t.startEye[1]<0&&t.startPose.up[1]>0);assert.equal(t.upSign,1);
  assert.equal(t.landingSide,-1);assert.ok(t.height<0&&t.locatorStart.forward[1]>0);
  let prev=t.pose.up;
  for(let ms=0;ms<=12000;ms+=16){t.advance(ms);assert.ok(t.pose.up[1]>0);assert.ok(t.pose.up.reduce((s,v,i)=>s+v*prev[i],0)>.999);prev=t.pose.up;}
 }
});
test('left/right and above/below approaches all board the outer-edge route',()=>{
 for(const above of [true,false])for(const side of [-1,1])for(const radius of [1.3,2.24]){
  const f=above?frame:{u:{x:1,y:0,z:0},pole:{x:0,y:-.8,z:-.6},v:{x:0,y:.6,z:-.8}};
  const t=create(456,{frame:f,target:{point:[radius*.8,0,radius*.6],side}});t.driftStrength=()=>0;
  assert.ok(t.radius>=2.26-(2.26-1.28)*.2&&t.radius<=2.26);assert.equal(t.landingSide,above?1:-1);assert.equal(Math.sign(t.height),t.landingSide);
  step(t,0,10000);vectorNear(t.pose.eye,t.locatorPose().eye);near(Math.hypot(t.pose.eye[0],t.pose.eye[2]),t.radius);
  assert.ok(t.pose.up[1]>0);
 }
});
test('landing side follows camera height, not screen roll or clicked ring side',()=>{
 for(const hemisphere of [-1,1])for(const roll of [-1,1])for(const side of [-1,1]){
  const f={u:{x:roll,y:0,z:0},pole:{x:0,y:-.8*roll,z:.6*hemisphere},v:{x:0,y:-.6*hemisphere*roll,z:-.8}};
  const t=create(456,{frame:f,target:{point:[1.77,0,0],side}});
  assert.equal(t.landingSide,hemisphere);assert.equal(Math.sign(t.height),hemisphere);
  for(let age=0;age<=10;age+=.05)assert.equal(Math.sign(t.entryPosition(age)[1]),hemisphere);
 }
});

test('entry curves from departure and never detours outward or crosses Saturn',()=>{
 for(const side of [-1,1])for(const seed of [3,7,91]){
  const t=create(seed,{target:{point:[-1.5,0,.8],side}});let last=Math.atan2(t.startEye[2],t.startEye[0]);
  const minDistance=Math.min(t.startDistance,t.landingDistance);
  for(let age=0;age<=10;age+=.01){
   const eye=t.entryPosition(age),angle=Math.atan2(eye[2],eye[0]);
   assert.ok(Math.hypot(...eye)>=minDistance-1e-8);
   assert.ok(Math.hypot(...eye)<=Math.max(t.startDistance,t.landingDistance)+1e-8);
   if(age>0)assert.ok(t.entryMotion(age).curve>0,'there is no straight-only departure interval');
   assert.ok(Math.atan2(Math.sin(angle-last),Math.cos(angle-last))*t.direction>=-1e-8);last=angle;
  }
  vectorNear(t.entryPosition(10),t.locatorPose(10).eye);
  assert.ok(Math.hypot(...t.entryPosition(5))<t.startDistance);
  // No special corner at the former two-second straight/curved junction.
  const a=t.entryPosition(1.999),b=t.entryPosition(2),c=t.entryPosition(2.001);
  vectorNear(b.map((v,i)=>(v-a[i])/.001),c.map((v,i)=>(v-b[i])/.001),.002);
 }
});

test('far entries spiral immediately without a distance-suppressed straight phase and match arrival velocity',()=>{
 for(const radius of [.5,2,10])for(const side of [-1,1]){
  const t=create(123,{radius,target:{point:[1.7*side,0,.5],side}});let farFrames=0;
  for(let age=0;age<10;age+=.025){
   const motion=t.entryMotion(age),eye=t.entryPosition(age,motion);
   if(motion.distance>=3.6){
    if(age>0)assert.ok(motion.curve>0);
    near(motion.curve,motion.weight);farFrames++;
   }
  }
  assert.ok(farFrames>100);
  assert.ok(t.entryMotion(1).curve>.01,'a distant departure must not suppress the turn');
  const a=t.entryPosition(9.999),b=t.entryPosition(10),c=t.locatorPose(10.001).eye;
  vectorNear(b.map((v,i)=>(v-a[i])/.001),c.map((v,i)=>(v-b[i])/.001),.002);
 }
});
test('cruise shares coarse physics interpolation; Escape resumes full cadence even when paused',()=>{
 const earth=window.SolarAstro.BODIES.find(b=>b.id==='earth'),ms=Date.UTC(2026,9,2,1,2,3,456);
 const r=Object.create(R);Object.assign(r,{physicsBodies:new Map(),physicsSatellites:new Map(),physicsMs:ms-16,ringTour:{state:'cruising'}});
 const p=r.physicalAt(earth,ms),sample=r.physicsSamples.get('p:earth');assert.equal(sample.end-sample.start,60000);
 assert.equal(r.physicalAt(earth,ms),p);
 r.ringTour.state='returning';const full=r.physicalAt(earth,ms);assert.notEqual(full,p);
 const fresh=r.physicsSamples.get('p:earth');assert.equal(fresh.end-fresh.start,1000);
 assert.ok(Math.hypot(full.x-p.x,full.y-p.y,full.z-p.z)<1e-6);
});
test('departure annotations stay hidden; the renderer owns their return reveal',()=>{
 const t=create(),settings=window.SolarRingTour.settings;
 t.visualAge=settings.annotationHide;
 assert.equal(t.annotationOpacity(),0);step(t,0,12000);t.stop();assert.ok(t.returnDuration>5);
 for(const fraction of [0,.25,.5,.75,1]){t.returnAge=t.returnDuration*fraction;near(t.annotationOpacity(),0);}
 const renderer={ringTour:t};near(R.ringTourReturnOpacity.call(renderer),0);
 renderer.ringTour=null;near(R.ringTourReturnOpacity.call(renderer),1);
});

test('ESC and home share one opening sweep starting a second before arrival without restarting it',()=>{
 for(const home of [false,true]){
  const t=create(),r=Object.create(R),mono=30000;step(t,0,12000);t.stop();
  if(home){t.returnTarget={};t.returnTargetApplied=true;t.setReturnView(window.SolarRingTour.viewPose({frame,radius:12,width:1280,height:800,screen:{x:640,y:400}}));}
  Object.assign(r,{ringTour:t,gpu:{resetBindings(){},gl:{isContextLost:()=>false}},presentationUntil:0,cameraTween:null,openingParticles:null});
  t.returnAge=t.returnDuration-1.001;r.syncRingTourAnnotations(t,mono-1001);assert.ok(!t.annotationReveal);
  t.returnAge=t.returnDuration-1;r.syncRingTourAnnotations(t,mono-1000);assert.equal(t.annotationReveal,true);
  const delays=r.openingOrbitDelays,styles=r.openingOrbitStyles;
  t.returnAge=t.returnDuration-.4;r.syncRingTourAnnotations(t,mono-400);near(r.ringTourReturnOpacity(),1);
  near(r.openingOrbitOpacity(mono-400),.648);near(r.openingLabelOpacity(mono-400),0);
  t.returnAge=t.returnDuration;t.advance(t.lastMono);assert.equal(t.state,'complete');
  assert.equal(r.drawRingTour(0,0,mono),false);assert.equal(r.ringTour,null);assert.equal(t.resources,null);
  near(r.openingOrbitStart,mono-1000);near(r.openingAnnotationStart,mono);
  assert.equal(r.cameraTween,null);assert.equal(r.openingParticles,null);
  assert.equal(r.openingOrbitDelays,delays);assert.equal(r.openingOrbitStyles,styles);
  assert.ok(delays.size>8);assert.ok(r.presentationUntil>=mono+2500);
  for(const [id,delay] of delays){
   assert.ok(delay>=0&&delay<1000);assert.ok([-1,1].includes(r.openingOrbitStyles.get(id).direction));
   const start=mono-1000+delay,end=start+1000;
   near(r.openingOrbitOpacity(start,id),0);near(r.openingOrbitOpacity(start+500,id),.5);near(r.openingOrbitOpacity(end,id),1);
   near(r.openingLabelOpacity(end,id),0);near(r.openingLabelOpacity(end+750,id),.5);near(r.openingLabelOpacity(end+1500,id),1);
   const ink=r.orbitInk(id,.5,{x:0,y:1});near(ink.phase,.25);near(r.orbitInkOpacity(0,1,ink,0),0);
  }
  assert.equal(r.drawRingTour(0,0,mono+16),false);assert.equal(r.openingOrbitDelays,delays);
 }
});

test('return annotation timing follows the flight clock through throttling and retargeting',()=>{
 const t=create(),r=Object.create(R);step(t,0,12000);t.stop();
 Object.assign(r,{ringTour:t,presentationUntil:0});
 t.returnAge=t.returnDuration-.5;r.syncRingTourAnnotations(t,20000);
 const delays=r.openingOrbitDelays,styles=r.openingOrbitStyles;
 t.returnAge+=.05;r.syncRingTourAnnotations(t,80000);
 near(r.openingOrbitStart,79450);near(r.openingAnnotationStart,80450);
 near(r.openingOrbitOpacity(80000),.57475);near(r.openingLabelOpacity(80000),0);
 t.returnAge=0;t.returnDuration=7;r.syncRingTourAnnotations(t,81000);
 near(r.openingOrbitStart,87000);near(r.openingOrbitOpacity(81000),0);
 assert.equal(r.openingOrbitDelays,delays);assert.equal(r.openingOrbitStyles,styles);
});

test('return overlay draws the shared partial sweep for solar and parent-local moon paths',()=>{
 const t=create(),r=Object.create(R);step(t,0,12000);t.stop();
 const points=Array.from({length:65},(_,i)=>({x:Math.cos(i*Math.PI/32),y:Math.sin(i*Math.PI/32),z:0}));
 const earth={id:'earth'},moon={id:'moon'},strokes=[],phases=[];
 const c={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes.push(this.globalAlpha);}};
 Object.assign(r,{ringTour:t,presentationUntil:0,ctx:c,options:{orbitBrightness:.5,labels:true},paths:[{body:earth,points}],
  satelliteLayouts:[{body:moon,world:{x:2,y:4},parent:{world:{x:2,y:3}}}],frameBodies:[],hitTargets:[],
  currentFrameItem:()=>({world:{x:0,y:1}}),displaySolarPoint:p=>p,displaySatellitePoint:p=>p,satelliteOrbitPoints:()=>({points}),
  projectRingTourPoint:(_projection,p,out)=>Object.assign(out,p),occludeDirectBodies(){},
  labels(){near(this.openingLabelOpacity(19500,'earth'),0);},
  orbitInk(id,progress,origin){const ink=R.orbitInk.call(this,id,progress,origin);phases.push(ink.phase);return ink;}});
 t.projection={};t.returnAge=t.returnDuration-1;r.syncRingTourAnnotations(t,19000);
 r.openingOrbitDelays=new Map([['earth',0],['moon',0]]);
 r.drawRingTourAnnotations(t,0,19000);assert.equal(strokes.length,0);
 t.returnAge+=.5;r.syncRingTourAnnotations(t,19500);phases.length=0;r.drawRingTourAnnotations(t,0,19500);
 assert.ok(strokes.length>0&&strokes.length<128);assert.ok(strokes.some(alpha=>alpha>0&&alpha<.2));
 assert.deepEqual(phases,[.25,.25]);
});

test('early cancellation keeps annotation opacity continuous, and forced disposal does not replay opening',()=>{
 const t=create();step(t,0,500);const initial=t.annotationOpacity();t.stop();near(t.annotationOpacity(),initial);
 let previous=initial;
 for(let i=0;i<=100;i++){t.returnAge=t.returnDuration*i/100;const alpha=t.annotationOpacity();assert.ok(alpha<=previous);previous=alpha;}
 near(previous,0);t.returnAge=t.returnDuration-window.SolarRingTour.settings.annotationLead;near(t.annotationOpacity(),0);
 const r=Object.create(R);Object.assign(r,{ringTour:t,presentationUntil:0,openingOrbitStart:123});
 r.endRingTour();near(r.openingOrbitStart,123);
});

test('names and orbit lines share the same four-second departure fade',()=>{
 const t=create(),renderer={ringTour:t};near(window.SolarRingTour.settings.annotationHide,4);
 for(const [time,expected] of [[0,1],[1,.84375],[2,.5],[3,.15625],[4,0],[5,0]]){
  t.visualAge=time;near(t.annotationOpacity(),expected);near(R.ringTourReturnOpacity.call(renderer),expected);
 }
 const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
 const start=source.slice(source.indexOf('    startRingTour(target)'),source.indexOf('    drawRingTourHover(c)'));
 assert.ok(!start.includes('clearLabels()'),'retain label placements instead of resetting on the click');
});

test('entry starts a little faster without changing the ten-second path endpoints',()=>{
 const t=create(),ease=p=>p*p*p*(p*(p*6-15)+10);
 for(const seconds of [.5,1,2,3]){
  const p=seconds/10,current=t.entryMotion(seconds).weight,previous=ease(p);
  assert.ok(current>previous);assert.ok(current<previous*1.35);
 }
 near(t.entryMotion(0).weight,0);near(t.entryMotion(10).weight,1);
 vectorNear(t.entryPosition(0),t.startEye);vectorNear(t.entryPosition(10),t.locatorPose(10).eye);
});

test('distant returns use a five-second baseline without revealing annotations before arrival',()=>{
 for(const radius of [.5,2,10,180]){
  const t=create(123,{radius});assert.ok(t.returnDuration>=3.2&&t.returnDuration<=5);
  if(radius<=10)near(t.returnDuration,5);
  t.state='returning';t.returnAge=t.returnDuration-1.5;near(t.annotationOpacity(),0);
  t.returnAge=t.returnDuration-.75;near(t.annotationOpacity(),0);
  t.returnAge=t.returnDuration;near(t.annotationOpacity(),0);
 }
});

test('hybrid projection keeps foreground instances until they cross the actual blended near plane',()=>{
 const t=create(),out=new Float32Array(5),order=[];
 t.pose={eye:[3,0,0],forward:[0,0,1],orthoScale:10,perspective:.5};
 const point=new Float32Array([3,0,-.1,.02,.1]);
 assert.equal(t.visibleInstances(point,1,out,order,[0]),1);
 t.pose.perspective=1;assert.equal(t.visibleInstances(point,1,out,order,[0]),0);
});

test('other planets do not reset position or size when tour-space depth crosses zero',()=>{
 const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:640,cy:400,scale:4,camera:{azimuth:0,elevation:.3,dolly:1.4},projectionAnchor:null});
 const t=create();t.pose={eye:[0,0,0],forward:[0,0,1],right:[1,0,0],up:[0,1,0],offset:[0,0],orthoScale:4,perspective:.5};
 const axes={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}};
 const p={tour:t,axes,saturn:{x:0,y:0,z:0},saturnRadius:100,units:1,focal:550};
 r.prepareRingTourProjection(p);
 const a=r.projectRingTourPoint(p,{x:1,y:1,z:-.00001},{},25),b=r.projectRingTourPoint(p,{x:1,y:1,z:.00001},{},25);
 assert.ok(!a.behind&&!b.behind);near(a.x,b.x,.02);near(a.y,b.y,.02);near(a.radius,b.radius,.002);
 t.pose=t.startPose;p.focal=r.h/(2*Math.tan(t.pose.fov*Math.PI/360));
 r.prepareRingTourProjection(p);
 const world={x:2,y:-3,z:1},actual=r.projectRingTourPoint(p,world,{},25),normal=r.project(world);
 near(actual.x,normal.x);near(actual.y,normal.y);near(actual.radius,25*normal.perspective);
});

test('opening handoff keeps the rendered projection when its tween anchor is released',()=>{
 const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:620,cy:430,scale:4,camera:{azimuth:.2,elevation:.3,dolly:1.4},projectionAnchor:{x:20,y:30,z:5},bodyRadiusAtZoom:()=>100});
 const t=create(),axes={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}},saturn={x:2,y:3,z:1};
 const p={tour:t,axes,saturn,saturnRadius:100,units:2,focal:r.h/(2*Math.tan(t.pose.fov*Math.PI/360))};
 const points=[saturn,{x:12,y:3,z:-8},{x:-2,y:13,z:9}];
 r.prepareRingTourProjection(p);const before=points.map(v=>r.projectRingTourPoint(p,v,{},25));
 t.entryNormalProjection=r.ringTourNormalProjection();r.projectionAnchor={x:200,y:-60,z:0};
 r.prepareRingTourProjection(p);const after=points.map(v=>r.projectRingTourPoint(p,v,{},25));
 before.forEach((a,i)=>{for(const k of ['x','y','radius'])near(a[k],after[i][k]);});
});

test('Saturn and all other bodies share the moving camera immediately, without a second motion blend',()=>{
 const f={u:{x:1,y:0,z:0},pole:{x:0,y:-1,z:0},v:{x:0,y:0,z:-1}};
 const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:640,cy:400,scale:10,
  projectView:p=>({x:p.x,y:-p.y,z:-p.z})});
 const t=create(123,{radius:10,frame:f}),axes={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}};
 const p={tour:t,axes,saturn:{x:0,y:0,z:0},saturnRadius:10,units:1,focal:800/(2*Math.tan(72*Math.PI/360))};
 for(const age of [0,.5,1,2,3,4,6,9,10]){
  t.age=age;t.pose=t.cameraPose();const pose=t.pose;
  r.prepareRingTourProjection(p);
  for(const world of [{x:0,y:0,z:0},{x:3,y:.5,z:-2},{x:-4,y:1,z:8}]){
   const out=r.projectRingTourPoint(p,world,{},5),d=[world.x-pose.eye[0],world.y-pose.eye[1],world.z-pose.eye[2]];
   const dot=v=>v.reduce((sum,n,i)=>sum+n*d[i],0),depth=pose.orthoScale*(1-pose.perspective)+dot(pose.forward)*pose.perspective;
   if(depth<=.0001)continue;
   near(out.x,640+(dot(pose.right)/depth+pose.offset[0])*p.focal,1e-6);
   near(out.y,400-(dot(pose.up)/depth+pose.offset[1])*p.focal,1e-6);
   near(out.radius,.5*p.focal/depth,1e-6);
  }
 }
});

test('moving Saturn keeps its live departure position and size while tracking blends into the ring',()=>{
 const A=window.SolarAstro,body=A.BODIES.find(b=>b.id==='saturn'),axes=A.bodyAxes(body);
 for(const dolly of [1,3]){
  const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:640,cy:400,scale:4,camera:{azimuth:.2,elevation:.3,dolly},projectionAnchor:null,bodyRadiusAtZoom:()=>20});
  const item={body,r:20,world:{x:15,y:20,z:2}},screen=r.project(item.world);
  const t=create(123,{frame:r.bodyFrame(body),radius:item.r*screen.perspective,screen,deferPreparation:true});
  const baseline=create(123,{frame:r.bodyFrame(body),radius:item.r*screen.perspective,screen,deferPreparation:true});
  const focal=r.h/(2*Math.tan(72*Math.PI/360));
  for(const age of [0,.01,.5,2,5,9.9,10]){
   // Five simulated years per second: retain a moving target throughout entry.
   const angle=age*5/29.46*Math.PI*2;
   item.world={x:15+200*Math.sin(angle),y:20+200*(Math.cos(angle)-1),z:2};
   t.age=age;r.updateRingTourTracking(t,item);
   const pose=t.pose,delta=pose.eye.map(v=>-v),dot=v=>v.reduce((sum,n,i)=>sum+n*delta[i],0);
   const depth=pose.orthoScale*(1-pose.perspective)+dot(pose.forward)*pose.perspective;
   const dedicated={x:640+(dot(pose.right)/depth+pose.offset[0])*focal,y:400-(dot(pose.up)/depth+pose.offset[1])*focal,radius:focal/depth};
   const projection=r.prepareRingTourProjection({tour:t,axes,saturn:item.world,saturnRadius:20,units:5,focal});
   const shared=r.projectRingTourPoint(projection,item.world,{},20);
   for(const key of ['x','y','radius'])near(shared[key],dedicated[key],1e-6);
   if(age===0){const normal=r.project(item.world);near(dedicated.x,normal.x);near(dedicated.y,normal.y);near(dedicated.radius,20*normal.perspective);}
   if(age===.01)assert.ok(dedicated.x>screen.x+.1,'Saturn continues moving instead of freezing on selection');
   if(age===10){baseline.age=age;const expected=baseline.cameraPose();vectorNear(pose.eye,expected.eye);vectorNear(pose.offset,expected.offset);near(pose.orthoScale,expected.orthoScale);}
   assert.ok(Object.values(dedicated).every(Number.isFinite));
  }
  t.stop();const before=t.pose;r.updateRingTourTracking(t,{...item,world:{x:999,y:0,z:0}});assert.deepEqual(t.pose,before,'refreshing the destination preserves the first return frame');
 }
});

test('live Saturn entry tracking does not alter opening handoffs or warp bridges',()=>{
 const r=Object.create(R);r.ringTourReturnView=()=>{throw Error('unexpected retarget');};
 for(const extra of [{openingResume:true},{replayBridge:{}}])r.updateRingTourTracking({state:'entering',...extra},{});
});

test('accelerated Saturn return reaches the live normal projection without a final position or size jump',()=>{
 const A=window.SolarAstro,body=A.BODIES.find(b=>b.id==='saturn'),axes=A.bodyAxes(body);
 for(const age of [2,12])for(const dolly of [1,3])for(const direction of [-1,1]){
  const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:640,cy:400,scale:4,camera:{azimuth:.2,elevation:.3,dolly},projectionAnchor:null,bodyRadiusAtZoom:()=>20});
  const item={body,r:20,world:{x:15,y:20,z:2}},screen=r.project(item.world);
  const t=create(123,{frame:r.bodyFrame(body),radius:20*screen.perspective,screen,deferPreparation:true});
  t.age=Math.min(age,9);r.updateRingTourTracking(t,item);t.age=age;t.pose=t.cameraPose();t.stop();
  t.returnNormalFrom=r.ringTourNormalProjection(20);t.setReturnView(r.ringTourReturnView(item));
  const duration=t.returnDuration,start=t.returnAge;
  for(const fraction of [0,.1,.5,.9,.99999,1]){
   t.returnAge=duration*fraction;
   const angle=direction*t.returnAge*5/29.46*Math.PI*2;
   item.world={x:15+200*Math.sin(angle),y:20+200*(Math.cos(angle)-1),z:2};
   r.updateRingTourTracking(t,item);
   near(t.returnDuration,duration);near(t.returnAge,duration*fraction);
   const p=t.pose,focal=r.h/(2*Math.tan(p.fov*Math.PI/360)),delta=p.eye.map(v=>-v),dot=v=>v.reduce((sum,n,i)=>sum+n*delta[i],0);
   const depth=p.orthoScale*(1-p.perspective)+dot(p.forward)*p.perspective;
   const dedicated={x:640+(dot(p.right)/depth+p.offset[0])*focal,y:400-(dot(p.up)/depth+p.offset[1])*focal,radius:focal/depth};
   const projection=r.prepareRingTourProjection({tour:t,axes,saturn:item.world,saturnRadius:20,units:5,focal});
   const shared=r.projectRingTourPoint(projection,item.world,{},20);
   for(const key of ['x','y','radius'])near(shared[key],dedicated[key],1e-6);
   if(fraction>=.99999){const normal=r.project(item.world);near(dedicated.x,normal.x,.02);near(dedicated.y,normal.y,.02);near(dedicated.radius,20*normal.perspective,.002);}
  }
  assert.equal(start,0);
 }
});

test('compiled frame projection matches the old solver across entry, free look, true-depth and retargeted exits',()=>{
 const reference=require('./fixtures/ring-tour-projection-reference.cjs'),r=Object.create(R);
 Object.assign(r,{w:1280,h:800,cx:620,cy:430,scale:4,camera:{azimuth:.2,elevation:.3,dolly:1.4},projectionAnchor:null,bodyRadiusAtZoom:()=>100});
 const t=create(),axes={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}},saturn={x:2,y:3,z:1,depthX:.4,depthY:.6,depthZ:.2};
 let calls=0;const projectView=r.projectView;r.projectView=function(...args){calls++;return projectView.apply(this,args);};
 for(const age of [0,2.5,5,8,10,25])for(const exit of [false,true]){
  t.age=age;t.state=age<10?'entering':'cruising';t.look(.02,.01);t.pose=t.cameraPose();
  t.returnNormalFrom=null;t.returnTo=null;
  if(exit){t.stop();t.returnNormalFrom=r.ringTourNormalProjection();t.returnAge=t.returnDuration*.7;t.pose=t.cameraPose();}
  const p={tour:t,axes,saturn,saturnRadius:100,units:2,focal:r.h/(2*Math.tan(t.pose.fov*Math.PI/360))};
  calls=0;r.prepareRingTourProjection(p);const preparedCalls=calls;assert.equal(preparedCalls,7);
  const points=Array.from({length:128},(_,i)=>({x:Math.sin(i*.71)*30,y:Math.cos(i*.41)*25,z:Math.sin(i*.23)*20,depthX:i*.3,depthY:i*-.4,depthZ:i*.1}));
  const actual=points.map(world=>r.projectRingTourPoint(p,world,{},25));assert.equal(calls,preparedCalls,'no normal projection per orbit point');
  points.forEach((world,i)=>{const expected=reference.call(r,p,world,{},25);for(const key of ['clipX','clipY','clipW','clipRadius','localX','localY','localZ'])near(actual[i][key],expected[key],1e-7);});
 }
});

test('retargeting across Saturn near plane keeps finite coordinates, positive scale and exact arrival',()=>{
 const saturnBody=window.SolarAstro.BODIES.find(b=>b.id==='saturn'),axes=window.SolarAstro.bodyAxes(saturnBody);
 for(const age of [3,12])for(const denominator of [2,.2,.002,0,-.002,-.5,-4]){
  const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:640,cy:400,scale:4,camera:{azimuth:0,elevation:0,dolly:1},projectionAnchor:null});
  const world={x:20,y:(denominator-1)*5000,z:10},item={world,body:saturnBody,r:100},t=create();
  t.age=age;t.state=age<10?'entering':'cruising';t.look(-.68,.21);t.zoom(1.6);t.move(0,-.04);t.pose=t.cameraPose();
  t.stop();t.returnNormalFrom=r.ringTourNormalProjection(100);r.camera={azimuth:0,elevation:0,dolly:2};
  const view=r.ringTourReturnView(item);assert.ok([...view.eye,...view.offset,view.orthoScale].every(Number.isFinite));
  assert.ok(view.orthoScale>0);t.setReturnView(view);
  for(let i=0;i<=30;i++){
   t.returnAge=t.returnDuration*i/30;t.pose=t.cameraPose();
   const projection=r.prepareRingTourProjection({tour:t,axes,saturn:world,saturnRadius:100,units:25,focal:r.h/(2*Math.tan(t.pose.fov*Math.PI/360))});
   for(const point of [world,{x:0,y:0,z:0},{x:2,y:10,z:-1}]){
    const s=r.projectRingTourPoint(projection,point,{},25);
    for(const key of ['clipX','clipY','clipW','clipRadius'])assert.ok(Number.isFinite(s[key]),`${age}/${denominator}/${i}/${key}`);
    assert.ok(s.clipRadius>0,'homogeneous normalization must never flip radius or visibility');
    if(i===30){const normal=r.project(point);
     if(normal.behind){if(denominator<0)assert.ok(s.behind);}
     else {assert.equal(s.behind,false);near(s.x,normal.x,1e-5);near(s.y,normal.y,1e-5);near(s.radius,25*normal.perspective,1e-5);}
    }
   }
  }
 }
});

test('retargeting home blends the old normal projection without moving other planets on frame one',()=>{
 const r=Object.create(R);Object.assign(r,{w:1280,h:800,cx:620,cy:430,scale:4,camera:{azimuth:.2,elevation:.3,dolly:1.4},projectionAnchor:null,bodyRadiusAtZoom:()=>100});
 const t=create();t.pose={eye:[0,0,-3],forward:[0,0,1],right:[1,0,0],up:[0,1,0],offset:[0,0],orthoScale:4,perspective:.4};
 const axes={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}};
 const p={tour:t,axes,saturn:{x:0,y:0,z:0},saturnRadius:100,units:1,focal:550},world={x:2,y:-3,z:1};
 r.prepareRingTourProjection(p);const before=r.projectRingTourPoint(p,world,{},25);t.returnNormalFrom=r.ringTourNormalProjection();
 r.camera={azimuth:1.2,elevation:.6,dolly:1.1};r.scale=12;r.cx=710;r.cy=380;p.saturnRadius=300;
 r.prepareRingTourProjection(p);const after=r.projectRingTourPoint(p,world,{},75);
 near(before.x,after.x);near(before.y,after.y);near(before.radius,after.radius);
});

test('landing samples outer zero to twenty percent with continuous cruise entry',()=>{
 const landings=[];
 for(const seed of [1,23,123,456,789,9876,65535,0xffffffff]){
  const t=create(seed),depth=(2.26-t.radius)/(2.26-1.28);
  assert.ok(depth>=0&&depth<=.2);landings.push(depth);
  near(t.cruiseWave(10).radius,t.radius);
  const dt=.0001,a=t.entryPosition(10-dt),b=t.entryPosition(10),c=t.entryPosition(10+dt);
  vectorNear(b.map((v,i)=>(v-a[i])/dt),c.map((v,i)=>(v-b[i])/dt),.002);
 }
 assert.equal(new Set(landings).size,landings.length);
});
test('ring vertical spread grows fifty percent without changing horizontal positions sizes or counts',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ring-tour.js'),'utf8');
 const baseline=source.replace('const DEBRIS_LAYER_HEIGHT=.055*1.5;','const DEBRIS_LAYER_HEIGHT=.055;').replace('const GRAIN_HEIGHT=.7*.8*.7*.7*.8*1.5;','const GRAIN_HEIGHT=.7*.8*.7*.7*.8;');
 assert.notEqual(baseline,source);
 const oldWindow={SolarSurfaceStyle:window.SolarSurfaceStyle};vm.runInNewContext(baseline,{window:oldWindow,performance:{now:()=>0}});
 const before=new oldWindow.SolarRingTour({seed:123,frame,radius:180,width:1280,height:800,screen:{x:640,y:400},grainStyle:rand=>R.flightParticleStyle(rand)}),after=create();
 for(const key of ['points','fogPoints','chipPoints']){
  assert.equal(after[key].length,before[key].length);
  for(let i=0;i<before[key].length;i++)near(after[key][i],before[key][i]*(i%5===1?1.5:1),1e-8);
 }
 assert.equal(after.flightField.points.length,before.flightField.points.length);
 before.flightField.points.forEach((p,i)=>{
  const q=after.flightField.points[i];near(q.world[0],p.world[0]);near(q.world[2],p.world[2]);near(q.size,p.size);
  near(q.world[1]-after.height,(p.world[1]-before.height)*1.5);
 });
});

test('spatial broad phase exactly matches exhaustive visibility and LOD through entry cruise and return',()=>{
 const t=create(123),spatial=t.instanceSpatial;let checked=0,total=0;
 for(const age of [0,2.5,8,10,18,35]){
  t.age=age;t.visualAge=age;t.pose=t.cameraPose();
  for(const look of [false,true]){
   if(look){t.look(.9,.3);t.zoom(1.2);t.move(.03,.005);t.pose=t.cameraPose();}
   const frustum=t.instanceFrustum(1280,800),focal=800/(2*Math.tan(t.pose.fov*Math.PI/360));
   for(const layer of t.instanceLayers){
    const range=layer.fog?1.85:2.92,sorted=!!layer.mesh||!!layer.fog||!!layer.chips,lod=layer.lod===undefined?null:{level:layer.lod,focal};
    const detail=t.meshDetail.slice();t.instanceSpatial=spatial;
    const n=t.visibleInstances(layer.points,range,t.instanceData,t.instanceOrder,layer.indices,sorted,frustum,lod);
    const indices=[...t.instanceOrder],data=t.instanceData.slice(0,n*5);checked+=t.instanceChecks;total+=layer.indices.length;
    t.meshDetail.set(detail);t.instanceSpatial=null;
    const all=t.visibleInstances(layer.points,range,t.instanceData,t.instanceOrder,layer.indices,sorted,frustum,lod);
    assert.equal(n,all);assert.deepEqual([...t.instanceOrder],indices);assert.deepEqual(t.instanceData.slice(0,all*5),data);
   }
  }
 }
 t.instanceSpatial=spatial;t.stop();t.returnAge=t.returnDuration*.5;t.pose=t.cameraPose();
 for(const layer of t.instanceLayers){
  const frustum=t.instanceFrustum(1280,800);t.visibleInstances(layer.points,3,t.instanceData,t.instanceOrder,layer.indices,true,frustum);
  const indices=[...t.instanceOrder];t.instanceSpatial=null;t.visibleInstances(layer.points,3,t.instanceData,t.instanceOrder,layer.indices,true,frustum);
  assert.deepEqual([...t.instanceOrder],indices);t.instanceSpatial=spatial;
 }
 assert.ok(checked<total*.7,'broad phase should avoid most individual checks: '+checked+'/'+total);
 t.dispose();assert.equal(spatial.size,0);
});

test('incremental scene preparation preserves seeded pools and can be cancelled or transferred',()=>{
 const sync=create(456),staged=create(456,{deferPreparation:true});
 assert.equal(staged.preparationReady,false);assert.equal(staged.points.length,0);
 let steps=0;
 while(!staged.advancePreparation(0)){assert.ok(++steps<3000);staged.prepareGrainRoute();assert.equal(staged.flightField.alpha,0);}
 assert.ok(steps>100);
 for(const key of ['points','fogPoints','chipPoints','meshDetail','depths'])assert.deepEqual(staged[key],sync[key]);
 assert.deepEqual(staged.flightField.points,sync.flightField.points);
 assert.deepEqual(staged.instanceLayers.map(l=>l.indices),sync.instanceLayers.map(l=>l.indices));
 const pending=create(123,{deferPreparation:true});for(let i=0;i<4;i++)pending.advancePreparation(0);
 pending.dispose();assert.equal(pending.preparation,null);assert.equal(pending.advancePreparation(3),false);assert.equal(pending.points.length,0);
 const pool=staged.points,grid=staged.instanceSpatial,transferred=create(789,{prepared:staged});
 assert.equal(transferred.points,pool);assert.equal(transferred.instanceSpatial,grid);assert.ok(staged.disposed);transferred.dispose();
 const incomplete=create(123,{deferPreparation:true});incomplete.advancePreparation(0);
 const replacement=create(123,{prepared:incomplete,deferPreparation:true});assert.ok(incomplete.disposed);assert.equal(replacement.preparationReady,false);
 replacement.dispose();sync.dispose();
});

test('per-frame grain projection preserves results after camera look pan and lens changes',()=>{
 const t=create();
 for(const age of [2.5,10,19]){
  t.age=age;t.visualAge=age;t.look(.2,.05);t.move(.01,.002);t.zoom(1.1);t.pose=t.cameraPose();t.prepareGrainRoute();
  const frame=t.grainProjection(1280,800);
  for(const p of t.flightField.points)assert.deepEqual(t.projectGrain(p,t.flightField,{},1280,800,frame),t.projectGrain(p,t.flightField,{},1280,800));
 }
});

test('LOD passes share one visibility solve and preserve depth order across frames',()=>{
 const t=create(),reference=create();let totalChecks=0,sharedChecks=0,stamp=0;
 for(const age of [3,10,18,24])for(const fov of [35,72,100]){
  for(const tour of [t,reference]){tour.age=age;tour.visualAge=age;tour.fov=fov;tour.pose=tour.cameraPose();}
  const frustum=t.instanceFrustum(1280,800),focal=800/(2*Math.tan(fov*Math.PI/360));stamp++;
  for(const layer of t.instanceLayers){
   const counterpart=reference.instanceLayers[t.instanceLayers.indexOf(layer)],range=layer.fog?1.85:2.92;
   const lod=layer.lod===undefined?null:{level:layer.lod,focal},sorted=!!layer.mesh||!!layer.fog||!!layer.chips;
   const expected=reference.visibleInstances(counterpart.points,range,reference.instanceData,reference.instanceOrder,counterpart.indices,sorted,frustum,lod);
   totalChecks+=reference.instanceChecks;
   const actual=t.visibleInstances(layer.points,range,t.instanceData,t.instanceOrder,layer.indices,sorted,frustum,lod,stamp);
   sharedChecks+=t.instanceChecks;
   assert.equal(actual,expected);assert.deepEqual([...t.instanceOrder],[...reference.instanceOrder]);
   assert.deepEqual(t.instanceData.slice(0,actual*5),reference.instanceData.slice(0,expected*5));
  }
 }
 assert.ok(sharedChecks<totalChecks);t.dispose();reference.dispose();
});
test('immutable layer uploads skip unchanged membership and release every buffer',()=>{
 const t=create(),uploads=[],deleted=[];let serial=0;
 const gl={ARRAY_BUFFER:1,DYNAMIC_DRAW:2,createBuffer:()=>++serial,bindBuffer(){},bufferData(){},bufferSubData:(_,offset,data)=>uploads.push([...data]),deleteBuffer:id=>deleted.push(id)};
 t.resources={gl};const layer=t.instanceLayers[0];
 t.instanceOrder.push(...layer.indices.slice(0,3));t.instanceUploadBytes=0;
 t.uploadInstances(gl,layer,3);assert.equal(uploads.length,1);assert.equal(t.instanceUploadBytes,60);
 t.uploadInstances(gl,layer,3);assert.equal(uploads.length,1);
 t.instanceOrder.reverse();t.uploadInstances(gl,layer,3);assert.equal(uploads.length,2);
 t.instanceOrder.length=2;t.uploadInstances(gl,layer,2);assert.equal(uploads.length,3);
 t.dispose();assert.deepEqual(deleted,[1]);
});
test('device particle capacity bounds allocation and distance budgets fade monotonically',()=>{
 const full=create(),half=create(123,{particleCapacity:.5});
 assert.equal(half.points.length,full.points.length/2);assert.equal(half.fogPoints.length,full.fogPoints.length/2);
 assert.equal(half.chipPoints.length,full.chipPoints.length/2);assert.equal(half.flightField.points.length,full.flightField.points.length/2);
 half.particleBudget=.45;
 for(const seed of [.01,.25,.7]){
  assert.equal(half.particleDensity(0,seed),1);assert.equal(half.particleDensity(1,seed),0);
  let last=1;for(let distance=0;distance<=1;distance+=.01){const alpha=half.particleDensity(distance,seed);assert.ok(alpha<=last+1e-12);last=alpha;}
  let previous=0;for(let budget=.25;budget<=1;budget+=.001){half.particleBudget=budget;const alpha=half.particleDensity(.6,seed);assert.ok(alpha>=previous-1e-12);assert.ok(alpha-previous<.014);previous=alpha;}
  half.particleBudget=.45;
 }
 full.dispose();half.dispose();
});

test('all eight random warp directions preserve the initial view and continuous velocity',()=>{
 const T=window.SolarRingTour,from={eye:[0,0,0],forward:[0,1,0],up:[0,0,1],right:[-1,0,0]},velocity=[0,.3,0],directions=new Set();
 for(let chosen=0;chosen<8;chosen++){
  let sample=0;const ring=T.planWarp(from,velocity,[],4.3,()=>sample++===chosen?0:1);directions.add(ring.direction);
  const path=T.warpPath(from,velocity,ring,4.3);vectorNear(T.jumpPose(path,0).up,from.up);vectorNear(T.jumpPose(path,0).forward,from.forward);
  const h=.00001;vectorNear(T.warpPosition(path,h).map((v,i)=>(v-from.eye[i])/h),velocity,.001);
  const expected=from.up.map((v,i)=>v*Math.cos(chosen*Math.PI/4)+from.right[i]*Math.sin(chosen*Math.PI/4));
  vectorNear(ring.entryUp.map(v=>v*ring.side),expected);
 }
 assert.equal(directions.size,8);
});
test('upper-screen orbital disc restricts random warp selection to the lower three directions',()=>{
 const T=window.SolarRingTour,from={eye:[0,0,0],forward:[0,1,0],up:[0,0,1],right:[-1,0,0]};
 const obstacles=[-12,0,12].map(x=>({center:[x,30,20],radius:2}));
 const renderer=Object.assign(Object.create(R),{w:1280,h:800,projected:[{body:{id:'sun'},screen:{x:640,y:180,behind:false}}]});
 const allowed=renderer.warpExitDirections({from});assert.deepEqual([...allowed].sort(),[3,4,5]);
 for(let seed=1;seed<=12;seed++){let n=seed;const ring=T.planWarp(from,[0,0,0],obstacles,4.3,()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;},allowed);assert.ok([3,4,5].includes(ring.direction),ring.direction);}
});
test('paused Saturn travel keeps path time fixed while free look remains available',()=>{
 const t=create(),r=Object.create(R);r.ringTour=t;
 t.advance(0);for(let mono=50;mono<=12000;mono+=50)t.advance(mono);
 r.setAnimationPaused(true,12000);const age=t.age,visual=t.visualAge,eye=[...t.pose.eye],forward=[...t.pose.forward];
 t.look(.3,.2);t.advance(r.animationMono(17000));
 assert.equal(t.age,age);assert.equal(t.visualAge,visual);vectorNear(t.pose.eye,eye);assert.notDeepEqual([...t.pose.forward],forward);
 const shot=[...t.pose.forward];r.setAnimationPaused(false,19000);t.advance(19000);vectorNear(t.pose.forward,shot);
 t.advance(19050);assert.ok(t.age>age);t.dispose();
});

test('visible ring scene carries cruise velocity through the eight jump directions',()=>{
 const T=window.SolarRingTour;
 for(const age of [.5,6,22])for(let direction=0;direction<8;direction++){
  const tour=create(123);tour.age=age;tour.state=age<10?'entering':'cruising';tour.pose=tour.cameraPose();
  const {from,velocity}=tour.takeoffStart();
  const ring=T.planWarp({...from,cruiseDeparture:true},velocity,[],4.3,()=>.5,[direction]);assert.ok(ring);
  tour.startTakeoff(0,Infinity,0,[0,1,0],null,[],ring);
  const render=t=>{tour.pose=tour.takeoffPose(t);return R.replayRingScenePose.call({h:800},tour,{x:0,y:0});};
  const first=render(0),next=render(.00001);
  vectorNear(first.eye,from.eye);
  vectorNear(next.eye.map((x,i)=>(x-first.eye[i])/.00001),velocity,.003);
  const later=render(.5);assert.ok(Math.hypot(...later.eye.map((x,i)=>x-first.eye[i]))>0);
  vectorNear(later.eye,tour.pose.eye);
  const shifted=R.replayRingScenePose.call({h:800},tour,{x:90,y:-60});
  vectorNear(shifted.eye,later.eye);assert.ok(shifted.offset[0]>later.offset[0]);assert.ok(shifted.offset[1]>later.offset[1]);
 }
});

test('ring departure acceleration scales with cruise speed, without scene distance amplification',()=>{
 const T=window.SolarRingTour;
 for(const speed of [.01,.3,5])for(const radius of [10,10000]){
  const from={eye:[0,0,0],forward:[0,0,1],up:[0,1,0],right:[1,0,0],cruiseDeparture:true};
  const planned=T.planWarp(from,[0,0,speed],[],4.3,()=>.5,[0]);assert.equal(planned.cruiseDeparture,true);
  const path=T.warpPath(from,[0,0,speed],{...planned,radius});
  let previous=speed;
  for(const t of [0,.1,.25,.5,1,2,3,4,5,7]){
   const dt=.00001,a=T.warpSceneEye(path,t),b=T.warpSceneEye(path,t+dt);
   vectorNear(a,T.warpPosition(path,t));
   const actual=Math.hypot(...b.map((v,i)=>(v-a[i])/dt));
   assert.ok(actual>=previous-speed*.001);assert.ok(actual<=speed*3.001);
   if(t<=1)assert.ok(actual<=speed*1.12,'first second must stay close to cruise speed');
   previous=actual;
  }
 }
});
