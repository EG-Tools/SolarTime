'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Tooltips stay compact; the separate ARIA labels retain operating guidance.
test('right camera toolbar uses short translated tooltips',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
  assert.ok(app.includes("mode.title=t(actual?'normalMode':'actualScaleShortcut')+' · +'"));
  assert.ok(app.includes("b.title=t('savedViews')+' · '+(i+1)"));
  assert.ok(app.includes('b.title=label;'));
  assert.ok(app.includes("randomButton.title=t('randomRotate');"));
});
const A=require('../src/astro.js'),read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function renderer(seed=.127694){
 let now=0;const M=Object.create(Math);M.random=()=>typeof seed==='function'?seed():seed;
 const window={SolarAstro:A},sandbox={window,performance:{now:()=>now},Math:M};
 for(const file of ['src/surface-style.js','src/renderer.js','src/ring-tour.js'])vm.runInNewContext(read(file),sandbox);const R=window.SolarRenderer,r=Object.create(R.prototype);
 Object.assign(r,{w:1280,h:800,fitScale:.25,presentationUntil:0,options:{pluto:true,moon:true,dollyZoom:false},camera:r.defaultCameraSnapshot(),cameraTween:null,autoRotation:null,pendingAutoRotation:null,rotationGeneration:0,bodyScales:{earth:5.05},actualScaleMix:0,clearLabels(){},surface:{invalidate(){},pause(){}},sky:{pause(){}},projected:[]});
 r.frameItems=new Map();
 return {r,R,sandbox,now:value=>{now=value;}};
}
const ms=Date.parse('2026-09-19T12:00:00Z');

test('T follows the side-view bend and coasts into the opening',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const move=r.cameraTween,p=move.replay;
 assert.equal(p.flightPath.locator,'WARP');assert.equal(p.flightPath.warp,true);assert.equal(p.particleAt,0);
 const before=r.openingReplayPose(move,4000),after=r.openingReplayPose(move,4500);
 assert.ok(Math.abs(after.look.yaw-before.look.yaw)+Math.abs(after.look.pitch-before.look.pitch)>.001);
 const body={body:{id:'sun'},r:20,screen:{x:640,y:400}};
 r.checkReplayClearance(5000,[body]);assert.equal(p.resetAt,Infinity);
 body.screen.x=-1000;r.checkReplayClearance(6000,[body]);r.checkReplayClearance(6250,[body]);
 assert.equal(p.brakeAt,6250);assert.equal(p.resetAt,8950);
 const opening=r.replayOpeningAt(p);
 for(const t of [6250,8000,p.resetAt,p.resetAt+1000,opening,opening+1000]){
  assert.equal(r.replayPresentation(t).cover,0);if(t<opening+p.inbound-300)assert.equal(r.openingParticleFrame(t).replay,p);else assert.equal(r.openingParticleFrame(t),null);
 }
 for(const t of [0,2500,5000,8000,opening,opening+2000,move.duration])close(r.replayPresentation(t).fov,60.8);
 assert.equal(r.openingOrbitStart,opening+4500);
 r.advanceCamera(move.duration);assert.equal(r.cameraTween,null);
 for(const k of ['azimuth','elevation','zoom','dolly','panX','panY'])close(r.camera[k],target[k]);
});

test('T reuses Saturn departure annotation fading and restores the opening reveal',()=>{
 const {r,sandbox}=renderer(),target=r.cameraSnapshot();
 r.animateOpeningReplay(target,r.openingCameraSnapshot(target),100,6500);
 const p=r.cameraTween.replay;
 for(const elapsed of [0,500,1000,2000,3000,3999]){
  const alpha=sandbox.window.SolarRingTour.departureAnnotationOpacity(elapsed/1000);
  for(const id of [null,'sun','earth','moon','saturn']){
   close(r.openingLabelOpacity(100+elapsed,id),alpha);
   close(r.openingOrbitOpacity(100+elapsed,id)*r.ringTourReturnOpacity(100+elapsed),alpha);
  }
 }
 for(const time of [4100,4400,7000]){close(r.openingLabelOpacity(time),0);close(r.openingOrbitOpacity(time),0);}
 p.brakeAt=4300;p.resetAt=7000;r.scheduleOpeningAnnotations(9100,6500);
 const delay=r.openingOrbitDelays.get('earth');
 close(r.openingOrbitOpacity(13600+delay,'earth'),0);
 close(r.openingOrbitOpacity(14100+delay,'earth'),.5);
 close(r.openingLabelOpacity(15350+delay,'earth'),.5);
});

test('large nearby bodies add a smooth clearance retreat in the same warp coordinates',()=>{
 const {r}=renderer(),target=r.cameraSnapshot(),body=A.BODIES.find(p=>p.id==='jupiter');
 const world={x:0,y:0,z:0};r.frameBodies=[{body,world,r:400,screen:{x:r.w/2,y:r.h/2,behind:false}}];
 const departure=r.warpDeparture(0),ring=r.warpRingGeometry(departure);
 assert.ok(ring?.retreat?.every(Number.isFinite));
 assert.ok(ring.retreat.reduce((sum,value,i)=>sum+value*departure.from.forward[i],0)<0,'retreat moves away from the incoming view');
 r.warpRingGeometry=()=>ring;assert.ok(r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500));
 const p=r.cameraTween.replay;
 for(let i=0;i<3;i++)close(p.path.ring.retreat[i],ring.retreat[i]/5000);
 const start=r.openingReplayPose(r.cameraTween,0),next=r.openingReplayPose(r.cameraTween,.01);
 assert.ok(Math.hypot(...start.eye.map((value,i)=>value-next.eye[i]))<1e-8,'no initial camera jump');
});

test('warp Canvas orbits preserve GPU brightness and fade after saturation',()=>{
 const {r}=renderer();r.gpu={dpr:2};r.flightLook={};r.scale=1;r.cx=r.cy=0;
 r.projectOrbit=()=>({xyz:new Float32Array([0,0,-1,1,1,1,2,2,-1])});
 const path={body:A.BODIES.find(body=>body.id==='earth'),points:[{x:0,y:0},{x:1,y:1},{x:2,y:2}]};
 const strokes=[],stack=[],c={globalAlpha:1,lineWidth:0,strokeStyle:'',save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},translate(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){const opacity=Number(this.strokeStyle.match(/,([.0-9]+)\)$/)[1]);strokes.push({alpha:opacity*this.globalAlpha,width:this.lineWidth});}};
 for(const selected of [false,true])for(const fade of [1,.75,.5,0]){
  strokes.length=0;r.orbit(c,path,selected,1,3,fade);
  assert.ok(strokes.length>0);
  for(const stroke of strokes){close(stroke.alpha,Math.min(1,(selected?.64:.22)*3)*fade);close(stroke.width,.5);}
 }
});

test('T does not reveal annotations that were hidden when it started',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.scheduleOpeningAnnotations(0,6500);
 r.animateOpeningReplay(target,r.openingCameraSnapshot(target),100,6500);
 for(const time of [100,1000,3000]){close(r.openingLabelOpacity(time),0);close(r.openingOrbitOpacity(time),0);}
});

test('virtual warp is chosen from the current view and frozen until the jump ends',()=>{
 const {r}=renderer();
 for(const actual of [0,1])for(const focus of [null,'sun','earth','moon','saturn']){
  r.actualScaleMix=actual;r.camera.focus=focus;
  const target=r.cameraSnapshot();assert.ok(r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500));
  const p=r.cameraTween.replay,ring=p.ring,center=[...ring.center];
  assert.equal(ring.virtual,true);assert.equal(ring.orbit,'virtual');
  assert.ok(Number.isFinite(ring.radius)&&ring.radius>0);
  for(const t of [1000,3000,5000])r.openingReplayPose(r.cameraTween,t);
  assert.equal(p.ring,ring);assert.deepEqual(plain(ring.center),center);
  r.cameraTween=null;
 }
});

test('normal-view warp preserves the transported frame through a vertical 180-degree turn',()=>{
 const {r}=renderer(),target=r.cameraSnapshot(),ring=r.warpRingGeometry();ring.turnAngle=Math.PI;r.warpRingGeometry=()=>ring;
 r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 let previous=null;
 for(let ms=0;ms<=5000;ms+=10){
  r.advanceCamera(ms);const axes=r.bankedSkyCamera().viewAxes;
  if(previous)for(const key of ['right','down','forward'])assert.ok(axes[key].reduce((s,x,i)=>s+x*previous[key][i],0)>.995,'no normal-view horizon flip');
  previous=axes;
 }
});

test('no safe virtual route leaves the camera and travel state unchanged',()=>{
 const {r,sandbox}=renderer(),before=r.cameraSnapshot();
 sandbox.window.SolarRingTour.planWarp=()=>null;
 assert.equal(r.animateOpeningReplay(before,r.openingCameraSnapshot(before),0,6500),false);
 assert.equal(r.cameraTween,null);assert.deepEqual(r.cameraSnapshot(),before);
});

test('T uses one bounded particle pool through start, loop, reset and end',()=>{
 for(const [width,quality,count] of [[1280,'auto',960],[390,'auto',520],[1280,'low',320]]){
  const {r}=renderer();r.w=width;r.options.quality=quality;const target=r.cameraSnapshot();
  r.animateOpeningCamera(target,0,6500);assert.equal(r.openingParticles.replay.openingMove,r.cameraTween);
  r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
  const pool=r.openingParticles,points=pool.points,birth=JSON.stringify(points),p=r.cameraTween.replay;
  assert.equal(points.length,count);assert.equal(pool.replay,p);
  p.brakeAt=4300;p.resetAt=7000;
  for(const time of [0,1000,1499,1500,2000,4300,6999,7000,8999,9000,9400,15199]){
   assert.equal(r.openingParticleFrame(time),pool);assert.equal(pool.points,points);
   assert.equal(JSON.stringify(points),birth,'only projection changes, never particle birth state');
   const projected=points.map(p=>({...r.projectOpeningParticle(p,pool,{})}));
   assert.ok(projected.every(q=>[q.x,q.y,q.size,q.tail,q.alpha].every(Number.isFinite)));
   if(time===0)assert.equal(pool.alpha,0);
   if(time<=1500)assert.ok(projected.every(q=>q.alpha===0),'first 1.5 seconds stay clear');
  }
  assert.equal(r.openingParticleFrame(15200),null);assert.equal(points.length,0);
  assert.ok(r.cameraTween,'the camera continues after particles disappear');
  r.advanceCamera(15500);assert.equal(r.cameraTween,null);
 }
});

test('warp particles preserve positions across camera handoffs and sampling rates',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const p=r.cameraTween.replay;p.brakeAt=4300;p.resetAt=7000;
 const probe={...r.openingParticles.points[0],life:3000,speed:0,depth:2,brightness:1,formationAt:0};
 const sample=time=>{const f=r.openingParticles;r.replayDustMotion(p,time,f);f.elapsed=time;f.alpha=r.replayParticleAlpha(time,p,f.velocity);return {travel:f.travel,velocity:f.velocity,alpha:f.alpha,fadedAlpha:r.projectOpeningParticle(probe,f,{}).alpha,x:f.flowX,y:f.flowY,tail:f.tailScale};};
 for(const boundary of [4300,4750,7000,9000,9450]){
  const a=sample(boundary-.001),b=sample(boundary+.001);
  for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<.01,key+' remains continuous');
 }
 const direct=sample(14500);
 for(let time=0;time<14500;time+=17)sample(time);
 assert.deepEqual(sample(14500),direct,'animation is independent of frame count');
 assert.ok(sample(8000).velocity>sample(14500).velocity);
 assert.ok(sample(9200).fadedAlpha>sample(10300).fadedAlpha);
 // Dimming follows actual speed; arrival has its own brighter, slower target.
 close(sample(7000).velocity,1.44*1.2);close(sample(7000).alpha,.736*.8*.7);
 let previousAlpha=Infinity;
 for(const time of [2000,3500,5500,7000]){
  const alpha=sample(time).alpha;assert.ok(alpha<=previousAlpha,'faster particles become dimmer');previousAlpha=alpha;
 }
 close(sample(9000).velocity,.72*.5);assert.ok(sample(10000).velocity<sample(9000).velocity);
 for(const time of [9000,10000,12000,14500]){
  close(sample(time).alpha,.736*.8*1.2);
 }
 for(const time of [1000,7000,7500,8500,9000,10000,11600,13000,15400,15500,16500]){
  const rate=(sample(time+.01).travel-sample(time-.01).travel)/.00002;
  close(rate,sample(time).velocity,1e-6);
 }
 for(const time of [12000,13000,14500]){
  const u=(time-9000)/6500,eased=u*u*u*(u*(u*6-15)+10);
  close(sample(time).velocity,.72*.5*(1-eased)+.06*eased);
 }
 close(sample(3000).tail,.4);close(sample(8000).tail,.8);close(sample(10000).tail,.8);
 // Every speed after the seven-second deadline decreases toward rest.
 for(const inbound of [6500,8500])for(const acceleration of [5,7.5]){
  p.inbound=inbound;p.ring.accelerationDuration=acceleration;
  const field={},end=9000+inbound;let previous=Infinity;
  for(let time=7000;time<=end;time+=50){
   r.replayDustMotion(p,time,field);
   assert.ok(field.velocity>=0&&field.velocity<=previous+1e-12,'no reacceleration after seven seconds');previous=field.velocity;
  }
  close(field.velocity,.06);
  const distance=field.travel;r.replayDustMotion(p,end+1000,field);close(field.travel,distance+.06);
 }
 // Late camera clearance cannot change the particle clock or restart it.
 p.inbound=6500;p.ring.accelerationDuration=7.5;p.brakeAt=p.resetAt=Infinity;
 const pool=r.openingParticles,before=sample(8500),at=sample(60000);close(at.velocity,.06);
 p.brakeAt=12000;p.resetAt=14700;
 const after=sample(8500);close(after.travel,before.travel);close(after.velocity,before.velocity);
 assert.equal(r.openingParticles,pool);assert.equal(pool.points.length,960);
});

test('warp grains approach immediately from zero speed without a stationary hold',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const path=r.cameraTween.replay;path.brakeAt=4300;path.resetAt=7000;
 const first=r.openingParticleFrame(0);close(first.velocity,0);close(first.travel,0);
 let previous=0;
 for(const time of [1,100,200,400,600,1000,2000,4300]){
  const f=r.openingParticleFrame(time);assert.ok(f.velocity>previous);assert.ok(f.travel>0);previous=f.velocity;
  if(time>=2000)assert.ok(f.points.some(p=>{const q=r.projectOpeningParticle(p,f,{});return q.visible&&q.alpha>.0001;}));
 }
 assert.ok(r.openingParticleFrame(600).velocity<.05,'initial acceleration remains gentle');
 close(r.openingParticleFrame(7000).velocity,1.728);
});

test('warp perspective and trails follow camera travel upward, downward and sideways',()=>{
 const {r,sandbox}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const path=r.cameraTween.replay;path.brakeAt=4300;path.resetAt=7000;
 const base={right:[1,0,0],up:[0,1,0],forward:[0,0,1]};
 const particle={...r.openingParticles.points[0],x:0,y:0,depth:3,speed:.1,formationAt:0};
 for(const [vx,vy] of [[0,1],[0,-1],[1,0],[-1,0]]){
  sandbox.window.SolarRingTour.jumpPose=(_,t)=>({...base,eye:[vx*t,vy*t,t]});
  const f=r.openingParticleFrame(2000),q={...r.projectOpeningParticle(particle,f,{})};
  close(f.headingX,vx);close(f.headingY,-vy);
  if(vy){assert.ok((q.y-r.h*.5)*vy>0,'vertical camera travel produces opposite screen flow');assert.ok(Math.sin(q.angle)*vy>0,'tail follows the same flow');}
  if(vx){assert.ok((q.x-r.w*.5)*vx<0,'lateral camera travel produces opposite screen flow');assert.ok(Math.cos(q.angle)*vx<0,'tail follows the same flow');}
  const near=r.projectOpeningParticle(particle,r.openingParticleFrame(2100),{});
  assert.ok(Math.hypot(near.x-r.w*.5,near.y-r.h*.5)>Math.hypot(q.x-r.w*.5,q.y-r.h*.5));
 }
 // A rolled camera uses its own up/right, rather than world vertical.
 sandbox.window.SolarRingTour.jumpPose=(_,t)=>({right:[0,1,0],up:[-1,0,0],forward:[0,0,1],eye:[0,t,t]});
 const rolled=r.openingParticleFrame(2000);close(rolled.headingX,1);close(rolled.headingY,0);
});

test('warp appearance alpha uses stable random delays and fade durations',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const pool=r.openingParticles,probes=[0,.5,1].map(n=>({...pool.points[0],life:1000+4000*n,rotation:n*Math.PI*2,brightness:1,formationAt:0,x:.2,y:.1,depth:2,speed:0}));
 const alpha=(p,time)=>r.projectOpeningParticle(p,r.openingParticleFrame(time+1500),{}).alpha;
 close(alpha(probes[2],200),0);assert.ok(alpha(probes[0],200)>alpha(probes[1],200));assert.ok(alpha(probes[1],200)>0);
 assert.ok(alpha(probes[0],400)>alpha(probes[1],400));assert.ok(alpha(probes[1],400)>alpha(probes[2],400));
 const direct=alpha(probes[1],400);for(let time=0;time<400;time+=17)alpha(probes[1],time);close(alpha(probes[1],400),direct);
 for(const p of probes)close(alpha(p,1000),alpha(probes[0],1000));
});

test('warp arrival tails retain staggered contraction and boot grains fade at different times',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningCamera(target,9000,6500);
 const pool=r.openingParticles,probes=[0,.5,1].map(n=>({...pool.points[0],life:1000+4000*n,rotation:n*Math.PI*2,x:.2,y:.1,depth:2,speed:1,brightness:1,formationAt:0}));
 // Hold perspective/speed fixed to measure only the requested tail envelope.
 const tail=(p,time)=>{const f=r.openingParticleFrame(time);return r.projectOpeningParticle(p,{...f,replay:{...f.replay,openingMove:null},travel:0,velocity:.36,headingX:0,headingY:0,flowX:0,flowY:0,bendX:0,bendY:0},{}).tail;};
 for(const p of probes){
  const initial=tail(p,9000);let previous=initial;
  for(let time=9000;time<=11000;time+=20){const value=tail(p,time);assert.ok(value<=previous+1e-10);assert.ok(previous-value<initial*.03);previous=value;}
  assert.ok(tail(p,9450)>initial*.65,'no abrupt shared 450ms contraction');
  close(tail(p,11000),initial*.25);
 }
 close(tail(probes[0],10000)/tail(probes[0],9000),.25);
 assert.ok(tail(probes[2],10000)/tail(probes[2],9000)>.7,'other grains retain longer tails');
 const alpha=(p,time)=>r.projectOpeningParticle({...p,speed:0},r.openingParticleFrame(time),{}).alpha;
 for(const p of probes){let previous=Infinity;for(let time=12000;time<17500;time+=25){const value=alpha(p,time);assert.ok(value<=previous+1e-10);previous=value;}}
 close(alpha(probes[0],10000),0);assert.ok(alpha(probes[1],12000)>0);assert.ok(alpha(probes[2],12000)>0);
 close(alpha(probes[1],14000),0);assert.ok(alpha(probes[2],17000)>0);
 assert.equal(r.openingParticleFrame(17500),null);
});

test('first second caps at 200 and arrival progressively retires both halves',()=>{
 for(const [width,quality,count] of [[1280,'auto',960],[390,'auto',520],[1280,'low',320]]){
  const {r}=renderer();r.w=width;r.options.quality=quality;const target=r.cameraSnapshot();
  r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
  const path=r.cameraTween.replay;path.brakeAt=4300;path.resetAt=7000;
  const points=r.openingParticles.points;
  const alphas=time=>{const f=r.openingParticleFrame(time);if(!f)return Array(count).fill(0);return points.map(p=>r.projectOpeningParticle({...p,speed:0,depth:2,brightness:1,formationAt:0},f,{}).alpha);};
  for(const time of [100,400,1000,1500,1900,2200,2500])assert.ok(alphas(time).filter(a=>a>0).length<=200);
  assert.equal(alphas(2500).filter(a=>a>0).length,Math.min(200,count/2));
  assert.equal(alphas(3500).filter(a=>a>0).length,count/2);
  assert.equal(alphas(4300).filter(a=>a>0).length,count/2);
  const joining=alphas(4500),full=alphas(6500);
  assert.equal(full.filter(a=>a>0).length,count);
  assert.ok(joining.filter(a=>a>0).length>count/2);
  assert.ok(joining.filter(a=>a>0).length<count*.75,'only an early subset joins at first');
  let prior=count/2,steps=0;
  for(let time=4300;time<=6500;time+=100){
   const f=r.openingParticleFrame(time),values=alphas(time);
   const visible=values.filter(alpha=>alpha/f.alpha>.05).length;
   assert.ok(visible>=prior,'loop count increases in order');
   assert.ok(visible-prior<count*.1,'no single large population jump');
   if(visible>prior)steps++;prior=visible;
  }
  assert.ok(steps>=10,'additional grains appear over many separate steps');
  assert.equal(prior,count);
  for(let i=0;i<count;i++)if(!points[i].edgeKeep)assert.ok(joining[i]<full[i],'loop grains join softly');
  assert.equal(alphas(9000).filter(a=>a>0).length,count);
  const mid=alphas(9250),end=alphas(15199);
  assert.ok(end.filter(a=>a>0).length<count/2);
  let previous=count;
  for(const time of [9000,9100,9250,9400,9550,9650,15199]){
   const alive=alphas(time).filter(a=>a>0).length;
   assert.ok(alive<=previous,'population only decreases throughout arrival');previous=alive;
  }
  assert.ok(previous<count*.01,'both halves have retired at the end');
  assert.ok(mid.some((a,i)=>!points[i].edgeKeep&&a>0),'discarded grains fade gradually');
  assert.equal(r.openingParticleFrame(15200),null);
  assert.equal(points.length,0,'the same pool is released at the deadline');
 }
});

test('boot opening begins at warp arrival and preserves its camera and fade lifecycle',()=>{
 for(const duration of [6500,8500]){
  const {r,sandbox}=renderer(),target=r.cameraSnapshot();r.restoreCamera(r.openingCameraSnapshot(target));
  r.animateOpeningCamera(target,100,duration);
  const move=r.cameraTween,pool=r.openingParticles;assert.equal(move.replay,undefined);
  assert.equal(pool.replay.openingMove,move);assert.equal(move.duration,duration);
  const {r:warp}=renderer();warp.animateOpeningReplay(target,warp.openingCameraSnapshot(target),100,duration);
  warp.cameraTween.replay.brakeAt=4300;warp.cameraTween.replay.resetAt=7000;warp.cameraTween.replay.ring.accelerationDuration=4.3;
  for(const elapsed of [0,500,2000,duration-1,duration,duration+1500]){
   const boot=r.openingParticleFrame(100+elapsed),exit={};warp.replayDustMotion(warp.cameraTween.replay,9000+elapsed,exit);exit.alpha=warp.replayParticleAlpha(9000+elapsed,warp.cameraTween.replay,exit.velocity);
   for(const key of ['velocity','travel','formation','tailScale','alpha'])close(boot[key],exit[key]);
   const alphas=boot.points.map(p=>{const q=r.projectOpeningParticle(p,boot,{});assert.ok([q.x,q.y,q.tail,q.alpha].every(Number.isFinite));return q.alpha;});
   if(elapsed===0)assert.ok(alphas.every(alpha=>alpha===0));else assert.ok(alphas.some(alpha=>alpha>0));assert.equal(r.openingParticles,pool);
  }
  r.advanceCamera(100+duration);assert.equal(r.cameraTween,null);
  assert.equal(r.openingParticleFrame(100+duration+2000),null);
  sandbox.matchMedia=()=>({matches:true});r.animateOpeningCamera(target,20000,duration);assert.equal(r.openingParticles,null);
 }
});

test('boot fades grains in at staggered times without delaying arrival motion',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,100,6500);
 const pool=r.openingParticles,probes=[0,.5,1].map(n=>({...pool.points[0],rotation:n*Math.PI*2,life:4000,speed:0,depth:2,brightness:1,formationAt:0}));
 const appearance=(p,elapsed)=>{
  const f=r.openingParticleFrame(100+elapsed),q=r.projectOpeningParticle(p,f,{});
  return q.alpha/f.alpha;
 };
 for(const p of probes){
  close(appearance(p,0),0);let previous=0;
  for(let t=20;t<=1200;t+=20){const alpha=appearance(p,t);assert.ok(alpha>=previous-1e-10&&alpha-previous<.06,'gradual frame-independent appearance');previous=alpha;}
  close(appearance(p,1200),1);
 }
 assert.ok(appearance(probes[0],250)>appearance(probes[1],250));
 assert.ok(appearance(probes[1],250)>0);close(appearance(probes[2],250),0);
 const start={...r.openingParticleFrame(100)},later=r.openingParticleFrame(350);
 assert.ok(start.velocity>0&&later.travel>start.travel,'arrival keeps moving while fading in');
 assert.equal(r.openingParticles,pool);
});

test('T waits 1.5 seconds to appear and fades every grain 0.3 seconds before the arrival camera ends',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const path=r.cameraTween.replay;path.brakeAt=4300;path.resetAt=7000;
 const pool=r.openingParticles,points=pool.points;
 const alpha=time=>{const f=r.openingParticleFrame(time);return points.map(p=>r.projectOpeningParticle({...p,speed:0,depth:2,brightness:1,formationAt:0},f,{}).alpha);};
 for(const time of [0,1000,1499,1500])assert.ok(alpha(time).every(value=>value===0));
 assert.ok(alpha(1800).some(value=>value>0));
 let previous=alpha(9000),differentDeaths=false;
 for(let time=9025;time<15200;time+=25){
  const values=alpha(time);
  assert.ok(values.every((value,i)=>value<=previous[i]+1e-10));
  if(values.some(value=>value===0)&&values.some(value=>value>0))differentDeaths=true;
  previous=values;
 }
 assert.ok(differentDeaths,'grains disappear at different times');
 assert.ok(previous.every(value=>value<.001),'nothing bright is cut at cleanup');
 assert.equal(r.openingParticleFrame(15200),null);assert.equal(points.length,0);
});

test('warp cleanup tracks the camera duration with a 0.3-second lead',()=>{
 for(const duration of [5000,6500,8500]){
  const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),100,duration);
  const path=r.cameraTween.replay;path.brakeAt=4300;path.resetAt=7000;
  const deadline=100+9000+duration-300;
  assert.ok(r.openingParticleFrame(deadline-1));assert.equal(r.openingParticleFrame(deadline),null);
  assert.ok(r.cameraTween);r.advanceCamera(100+9000+duration);assert.equal(r.cameraTween,null);
 }
});

test('boot and warp particles keep approaching while their random alpha fades',()=>{
 for(const boot of [false,true]){
  const {r}=renderer(),target=r.cameraSnapshot();
  if(boot){r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,0,6500);}
  else{r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);r.cameraTween.replay.brakeAt=4300;r.cameraTween.replay.resetAt=7000;}
  const end=boot?6500:9000,first={...r.openingParticleFrame(end)};
  const p={...first.points[0],life:5000,rotation:0,x:.25,y:.1,depth:((2+first.travel*.5-.04)%5)+.04,speed:.1};
  // Isolate forward perspective from the separate camera heading projection.
  const project=f=>r.projectOpeningParticle(p,{...f,headingX:0,headingY:0,flowX:0,flowY:0,bendX:0,bendY:0},{});
  const a=project(first),later={...r.openingParticleFrame(end+1000)},b=project(later);
  assert.ok(later.velocity>0&&later.travel>first.travel);
  assert.ok(Math.hypot(b.x-r.w*.5,b.y-r.h*.5)>Math.hypot(a.x-r.w*.5,a.y-r.h*.5),'grains continue approaching');
  assert.ok(b.alpha<a.alpha&&b.alpha>0,'the still-moving grain fades away');
  assert.equal(r.openingParticleFrame(boot?end+2000:15200),null);
 }
});

test('warp particle cancellation fades out and reduced motion skips allocation',()=>{
 const {r,sandbox}=renderer(),target=r.cameraSnapshot();
 r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const pool=r.openingParticles;r.cancelCameraTween(3000);
 const before=r.openingParticleFrame(3000).alpha,after=r.openingParticleFrame(3110).alpha;
 assert.ok(after<before);assert.equal(r.openingParticleFrame(3220),null);assert.equal(pool.points.length,0);
 r.animateOpeningCamera(target,0,6500);
 r.advanceCamera(6500);assert.equal(r.cameraTween,null);assert.ok(r.openingParticleFrame(7000));
 r.cancelCameraTween(7000);assert.equal(r.openingParticleFrame(7220),null);
 sandbox.matchMedia=()=>({matches:true});
 r.animateOpeningReplay(target,r.openingCameraSnapshot(target),4000,6500);
 assert.equal(r.openingParticles,null);assert.ok(r.cameraTween.replay);
});

test('warp clock uses 4.3-second departure then 4.7-second warp without a docking gate',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const p=r.cameraTween.replay;
 r.checkReplayClearance(100,[]);r.checkReplayClearance(500,[]);assert.equal(p.resetAt,Infinity);
 r.checkReplayClearance(p.particleAt,[]);r.checkReplayClearance(4299,[]);assert.equal(p.resetAt,Infinity);
 p.flightPath.duration=20; // The locator can remain ahead: docking is not a gate.
 r.checkReplayClearance(4300,[]);assert.equal(p.brakeAt,4300);assert.equal(r.replayOpeningAt(p),9000);
});

test('T captures only sky orientation once with no second sky bitmap',()=>{
 const {r,sandbox}=renderer();let captures=0;
 sandbox.document={createElement:()=>{throw Error('no bitmap allocation');}};
 const basis={stars:{right:[1,0,0],down:[0,1,0],forward:[0,0,1]},spin:[0,.05,0]};
 r.sky.canvas={width:3840,height:2160};r.sky.captureReplayBackground=()=>{captures++;return basis;};
 const p={};r.captureReplaySky(p);r.captureReplaySky(p);
 assert.equal(captures,1);assert.equal(p.skyFrom,basis);assert.equal(p.skySnapshot,undefined);
});



test('T restores the GPU layer style after hiding or cancelling without changing body sizes',()=>{
 const {r}=renderer(),style={opacity:'.8',transition:'opacity .4s'},sizes=JSON.stringify(r.bodyScales);
 r.gpu={canvas:{style}};
 r.setReplaySolarOpacity(.4);r.setReplaySolarOpacity(0);
 assert.equal(style.opacity,'0');assert.equal(style.transition,'none');
 r.setReplaySolarOpacity(1);
 assert.deepEqual(style,{opacity:'.8',transition:'opacity .4s'});assert.equal(r.replayLayerStyle,null);
 const target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,5000);
 r.setReplaySolarOpacity(0);r.cancelCameraTween(7000);
 assert.deepEqual(style,{opacity:'.8',transition:'opacity .4s'});
 assert.equal(JSON.stringify(r.bodyScales),sizes);
});

test('temporary forward look has identity projection and releases smoothly on Escape',()=>{
 const {r}=renderer();Object.assign(r,{scale:4,cx:660,cy:430,centerX:660,centerY:430});
 for(const dolly of [.001,1,4]){
  r.camera.dolly=dolly;r.flightLook=null;
  const point={x:20,y:30,z:40},before=r.projectView(point);
  r.flightLook=r.flightLookAt(0,0);const after=r.projectView(point);
  for(const k of ['x','y','z'])close(after[k],before[k]);
 }
 r.flightLook=null;const target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,5000);
 r.advanceCamera(3000);const look=r.flightLook;
 r.cancelCameraTween(3000);assert.equal(r.flightLook.yaw,look.yaw);
 r.advanceCamera(3500);close(r.flightLook.yaw,look.yaw+(A.wrap(r.camera.azimuth-look.yaw+Math.PI)-Math.PI)*.5);
 r.advanceCamera(4000);assert.equal(r.flightLook,null);
});
test('country inspection ends at 250x and removes inherited zoom/dolly/pan',()=>{
 const {r}=renderer();Object.assign(r.camera,{zoom:1800,dolly:12,panX:.5,panY:-.4});
 assert.equal(r.animateFeature('earth',37.5665,126.978,ms,0,1000),true);r.advanceCamera(1000);
 assert.equal(r.camera.zoom,250);assert.equal(r.camera.dolly,1);assert.equal(r.camera.focus,'earth');assert.equal(r.camera.panX,0);assert.equal(r.camera.panY,0);
 const n=A.surfaceDirection(A.BODIES.find(b=>b.id==='earth'),37.5665,126.978,ms),view=r.viewDirection(n);
 close(view.x,0);close(view.y,0);assert.ok(view.z>0);
 r.smoothZoom(500,null,1100);r.advanceCamera(1300);assert.equal(r.camera.zoom,500);
 r.smoothZoom(125,null,1400);r.advanceCamera(1600);assert.equal(r.camera.zoom,125);
 assert.equal(r.zoomLimits.maxZoom,2048);
});
test('lens zoom keeps 0.1x while camera travel retreats to a point-like 0.002x overview',()=>{
 const {r,R}=renderer();
 assert.equal(r.zoomLimits.minZoom,.1);assert.equal(r.zoomLimits.minDolly,.002);
 r.setZoom(.001);assert.equal(r.camera.zoom,.1);assert.ok(R.validCamera(r.cameraSnapshot()));
 r.setZoom(1);r.setDolly(.0001);assert.equal(r.camera.dolly,.002);assert.ok(R.validCamera(r.cameraSnapshot()));
 r.smoothZoom(.001,null,0);assert.equal(r.cameraTween.to.zoom,.1);r.advanceCamera(150);assert.equal(r.camera.zoom,.1);
 r.smoothDolly(.0001,null,200);assert.equal(r.cameraTween.to.dolly,.002);r.advanceCamera(350);assert.equal(r.camera.dolly,.002);
});
test('opening accelerates more gently over 40% and decelerates over 60% into the saved camera',()=>{
 const {r}=renderer(),target={...r.defaultCameraSnapshot(),azimuth:2.4,elevation:.31,zoom:7,dolly:1.6,panX:.2,panY:-.1};
 const values=[.25,.75],opening=r.openingCameraSnapshot(target,()=>values.shift());
 close(opening.azimuth,A.TAU*.25);close(opening.elevation,.425);assert.equal(opening.zoom,target.zoom);assert.equal(opening.dolly,.001);
 assert.equal(opening.focus,null);assert.equal(opening.panX,0);assert.equal(opening.panY,0);assert.equal(opening.mode,target.mode);
 r.restoreCamera(opening);assert.ok(r.animateOpeningCamera(target,0,3000));assert.equal(r.cameraTween.timing,'opening');
 assert.ok(r.cameraTween.openingPath.arc.amplitude>=.06&&r.cameraTween.openingPath.arc.amplitude<=.11);
 r.orbitRevealStart=NaN;
 assert.equal(r.openingLabelOpacity(0),0);assert.equal(r.openingLabelOpacity(2000),0);close(r.openingLabelOpacity(2750),.5);assert.equal(r.openingLabelOpacity(3500),1);
 assert.equal(r.openingOrbitOpacity(0),0);assert.equal(r.openingOrbitOpacity(1000),0);close(r.openingOrbitOpacity(1500),.5);assert.equal(r.openingOrbitOpacity(2000),1);
 r.advanceCamera(250);assert.ok(r.cameraTween.progress<.02,'departure starts gently');assert.equal(r.camera.zoom,opening.zoom);assert.ok(r.camera.dolly>opening.dolly,'travel starts immediately, without a delayed second phase');
 r.advanceCamera(1000);assert.ok(r.cameraTween.progress<1/3,'less early acceleration than the previous timing');
 r.advanceCamera(1200);close(r.cameraTween.progress,.4);assert.equal(r.camera.zoom,opening.zoom);close((r.camera.dolly-opening.dolly)/(target.dolly-opening.dolly),.4);
 r.advanceCamera(1500);const mid=r.cameraTween.progress,linearX=opening.panX+(target.panX-opening.panX)*mid,linearY=opening.panY+(target.panY-opening.panY)*mid;assert.ok(Math.hypot(r.camera.panX-linearX,r.camera.panY-linearY)>.02,'opening follows a visible curved path');
 r.advanceCamera(2000);close((r.camera.dolly-opening.dolly)/(target.dolly-opening.dolly),r.cameraTween.progress);
 r.advanceCamera(2800);const late=(target.dolly-r.camera.dolly)/(target.dolly-opening.dolly);assert.ok(late<.02,'arrival stops gently');
 r.advanceCamera(3000);for(const key of ['azimuth','elevation','zoom','dolly','panX','panY'])close(r.camera[key],target[key]);assert.equal(r.cameraTween,null);
});
test('opening ramps saved left/right/random rotation into arrival without an angular or velocity jump',()=>{
 for(const mode of [-1,1,'random']){
  const {r}=renderer(),target=r.cameraSnapshot();r.restoreCamera({...target,dolly:.001});
  if(mode==='random')r.setRandomRotate(true,0);else r.setAutoRotate(mode,0);
  r.animateOpeningCamera(target,0,5000);
  const difference=(a,b)=>A.wrap(a-b+Math.PI)-Math.PI;
  r.advanceCamera(3500);close(r.camera.azimuth,r.cameraTweenState(r.cameraTween,.7).state.azimuth);close(r.camera.elevation,target.elevation);
  r.advanceCamera(4000);const early=plain(r.camera),earlyBase=r.cameraTweenState(r.cameraTween,.8).state;
  r.advanceCamera(4999);const before=plain(r.camera),path=r.randomRotation;
  r.advanceCamera(5000);const at=plain(r.camera);
  assert.equal(r.cameraTween,null);assert.equal(r.pendingAutoRotation,null);assert.ok(r.autoRotation);
  const yaw=mode==='random'?path.yawRate:mode*1.8*A.DEG,pitch=mode==='random'?path.pitchRate:0;
  close(difference(at.azimuth,target.azimuth),yaw*.75);close(difference(at.elevation,target.elevation),pitch*.75);
  assert.ok(Math.hypot(difference(early.azimuth,earlyBase.azimuth),difference(early.elevation,earlyBase.elevation))<1.8*A.DEG*.2);
  r.advanceAutoRotate(5001);
  for(const key of ['azimuth','elevation'])close(difference(at[key],before[key])*1000,difference(r.camera[key],at[key])*1000,1e-6);
  if(mode==='random')assert.equal(r.randomRotation,path,'random heading survives the hand-off');
 }
});

test('opening rotation blend is frame-rate independent and preserves its angle when switched off',()=>{
 for(const mode of [-1,1,'random']){
  const results=[];
  for(const fps of [30,60,144]){
   const {r}=renderer(),target=r.cameraSnapshot();r.restoreCamera({...target,dolly:.001});
   if(mode==='random')r.setRandomRotate(true,0);else r.setAutoRotate(mode,0);
   r.animateOpeningCamera(target,0,5000);
   for(let i=1;i<=5*fps;i++)r.advanceCamera(i*1000/fps);
   results.push(plain(r.camera));
  }
  for(const camera of results.slice(1))for(const key of ['azimuth','elevation'])close(camera[key],results[0][key]);
  const {r}=renderer(),target=r.cameraSnapshot();r.restoreCamera({...target,dolly:.001});
  if(mode==='random')r.setRandomRotate(true,0);else r.setAutoRotate(mode,0);
  r.animateOpeningCamera(target,0,5000);r.advanceCamera(4400);const blend=plain(r.cameraTween.rotationBlend);
  r.setAutoRotate(0,4400);r.advanceCamera(5000);r.advanceAutoRotate(6000);
  close(r.camera.azimuth,A.wrap(target.azimuth+blend.yaw));close(r.camera.elevation,target.elevation+blend.pitch);assert.equal(r.rotationIntent,0);
 }
});

test('orbit spacing eases within 0–10% for 100ms and follows other changes in 70ms without jumping',()=>{
 const {r,now}=renderer();r.options.actualScale=true;r.actualScaleMix=1;
 r.setOption('actualOrbitSpacing',0,false);r.setOption('actualOrbitSpacing',.1);
 close(r.actualOrbitSpacing(),.1);close(r.orbitScaleMix(),0);
 r.advanceActualScale(25);close(r.orbitScaleMix(),.0015625);
 r.advanceActualScale(50);close(r.orbitScaleMix(),.005);
 r.advanceActualScale(99);assert.ok(r.orbitScaleMix()<.01);assert.ok(r.orbitSpacingTween);
 r.advanceActualScale(100);close(r.orbitScaleMix(),.01);assert.equal(r.orbitSpacingTween,null);
 now(1000);r.setOption('actualOrbitSpacing',0);r.advanceActualScale(1050);close(r.orbitScaleMix(),.005);
 now(1050);r.setOption('actualOrbitSpacing',.2);close(r.orbitScaleMix(),.005);
 now(1070);r.setOption('actualOrbitSpacing',.2);assert.equal(r.orbitSpacingTween.started,1050,'repeated input must not restart easing');
 r.advanceActualScale(1085);close(r.orbitScaleMix(),.0375);
 r.advanceActualScale(1120);close(r.orbitScaleMix(),.12);assert.equal(r.orbitSpacingTween,null);
 now(2500);r.setOption('actualOrbitSpacing',0);r.setOption('actualOrbitSpacing',1,false);
 close(r.orbitScaleMix(),1);assert.equal(r.orbitSpacingTween,null,'reset cancels the visual transition');
 r.setOption('actualOrbitSpacing',.1,false);r.setOption('actualOrbitSpacing',1);
 close(r.orbitScaleMix(),.01);r.advanceActualScale(2535);close(r.orbitScaleMix(),.505);
 r.advanceActualScale(2570);close(r.orbitScaleMix(),1);assert.equal(r.orbitSpacingTween,null);
 now(3500);r.setOption('actualOrbitSpacing',.4);r.advanceActualScale(3535);close(r.orbitScaleMix(),.67);
 r.advanceActualScale(3570);close(r.orbitScaleMix(),.34);assert.equal(r.orbitSpacingTween,null);
 for(const [from,to] of [[0,.01],[.04,.08],[.08,.04],[.1,.09]]){
  now(4000);r.setOption('actualOrbitSpacing',from,false);r.setOption('actualOrbitSpacing',to);
  assert.equal(r.orbitSpacingTween.duration,100);r.advanceActualScale(4050);close(r.orbitScaleMix(),(from+to)/20);
  r.advanceActualScale(4100);close(r.orbitScaleMix(),to/10);assert.equal(r.orbitSpacingTween,null);
 }
});

test('opening uses a different random departure without changing its destination',()=>{
 const {r}=renderer(),target=r.defaultCameraSnapshot(),a=r.openingCameraSnapshot(target,()=>.1),b=r.openingCameraSnapshot(target,()=>.9);
 assert.notEqual(a.azimuth,b.azimuth);assert.notEqual(a.elevation,b.elevation);
 for(const state of [a,b]){assert.equal(state.zoom,target.zoom);assert.equal(state.dolly,.001);assert.equal(state.focus,null);}
 assert.deepEqual(plain(target),plain(r.defaultCameraSnapshot()));
});
test('ordinary and travel openings stay level throughout, including tracked views',()=>{
 for(const seed of [.1,.9])for(const flyThrough of [false,true])for(const focus of [null,'earth']){
  const {r,sandbox}=renderer(seed);for(const file of ['surface-style','ring-tour'])vm.runInNewContext(read('src/'+file+'.js'),sandbox);
  const target={...r.cameraSnapshot(),focus};r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,0,5000);
  r.cameraTween.flyThrough=flyThrough;r.cameraTween.bankFrom=.2;
  for(let ms=0;ms<=5000;ms+=10){
   r.advanceCamera(ms);close(r.flightBank,0);close(r.cameraBasis().sr,0);assert.equal(r.bankedSkyCamera(),r.camera);
  }
  assert.deepEqual(plain(r.cameraSnapshot()),plain(target));
 }
});

test('opening still exposes curvature for the following S bend without applying roll',()=>{
 const {r,sandbox}=renderer();sandbox.window.SolarRingTour={smoothBank:()=>.2};
 const target=r.cameraSnapshot();r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,0,5000);
 const move=r.cameraTween;move.flyThrough=true;
 for(const t of [.75,.79,.8,.81,.85]){close(r.openingTurn(move,t),.2);r.advanceCamera(t*5000);close(r.flightBank,0);}
});

test('focus never changes a body size or overrides its user-set scale',()=>{
 const {r}=renderer(),bodies=[A.SUN,...A.BODIES,...A.SATELLITES],base=r.defaultCameraSnapshot();r.bodyScales.moon=8;
 for(const actual of [0,.5,1])for(const zoom of [.1,base.zoom,64,250,2048])for(const dolly of [.002,1,12]){
  r.actualScaleMix=actual;
  for(const body of bodies){
   const untracked=r.bodyRadiusForState(body,{...base,zoom,dolly,focus:null});
   for(const focus of ['earth','moon',body.id])close(r.bodyRadiusForState(body,{...base,zoom,dolly,focus}),untracked);
  }
 }
 r.actualScaleMix=0;
 for(const focus of [null,'earth','moon'])for(const dolly of [1,2,4]){
  const state={...base,focus,dolly},ordinary=r.bodyRadiusForState(A.MOON,state,1);
  close(r.bodyRadiusForState(A.MOON,state),ordinary*8);
 }
});

test('camera travel enlarges the Moon by its own depth instead of pinning it to overview size',()=>{
 const {r}=renderer(),earth=A.BODIES.find(body=>body.id==='earth'),base=r.defaultCameraSnapshot();
 r.projectionAnchor={x:0,y:0,z:0};
 for(const moonDepth of [-400,0,400]){
  let previous=0;
  for(const dolly of [1,2,4,6]){
   r.camera={...base,azimuth:0,elevation:0,focus:'earth',dolly};
   const moon=r.projectView({x:80,y:-moonDepth,z:0}),perspective=moon.perspective??1;
   const expected=dolly*5000/(5000-moonDepth*(dolly-1));
   const baseline=r.bodyRadiusForState(A.MOON,{...base,dolly:1}),visibleRadius=r.bodyRadiusAtZoom(A.MOON)*perspective;
   close(visibleRadius/baseline,expected);assert.ok(visibleRadius>previous);previous=visibleRadius;
   if(moonDepth===0)close(visibleRadius/r.bodyRadiusAtZoom(earth),baseline/r.bodyRadiusForState(earth,{...base,dolly:1}));
  }
 }
});

test('wheel and focus transitions share the current radius model without a first-frame size hand-off',()=>{
 const {r}=renderer(),base=r.defaultCameraSnapshot();r.camera={...base,dolly:3};
 const bodies=[A.SUN,...A.BODIES,...A.SATELLITES],before=bodies.map(body=>r.bodyRadiusAtZoom(body));
 r.animateFocus('earth',0,1000);r.advanceCamera(0);
 bodies.forEach((body,i)=>close(r.bodyRadiusAtZoom(body),before[i]));
 for(let mono=0;mono<=1000;mono+=10){r.advanceCamera(mono);for(const body of bodies)close(r.bodyRadiusAtZoom(body),r.bodyRadiusForState(body,r.camera));}
 const moonBefore=r.bodyRadiusAtZoom(A.MOON);r.smoothDolly(r.camera.dolly*1.5,'earth',1100);
 let previous=moonBefore;
 for(let mono=1100;mono<=1250;mono+=10){r.advanceCamera(mono);const radius=r.bodyRadiusAtZoom(A.MOON);assert.ok(radius>=previous);previous=radius;}
 close(previous,moonBefore*1.5);
 r.animateHome(1300,1000);r.advanceCamera(2300);
 for(const body of bodies)close(r.bodyRadiusAtZoom(body),r.bodyRadiusForState(body,base));
});
test('ordinary tracking preserves the lens and approaches its target with camera travel',()=>{
 const {r}=renderer(),before={...r.camera};r.options.dollyZoom=false;
 assert.ok(r.animateFocus('earth',0,1000));
 assert.equal(r.cameraTween.to.mode,'move');assert.equal(r.options.dollyZoom,true);
 close(r.cameraTween.to.zoom,before.zoom);assert.ok(r.cameraTween.to.dolly>1);assert.equal(r.cameraTween.to.focus,'earth');
 r.advanceCamera(1000);close(r.camera.zoom,before.zoom);assert.equal(r.camera.focus,'earth');
});
test('tracking follows the direct screen path without first pushing the destination away',()=>{
 for(const targetId of ['earth','moon'])for(const z of [-240,0,240])for(const sourceDolly of [.4,1,4]){
  const {r}=renderer(),world={x:180,y:-95,z};
  r.frameItems=new Map([[targetId,{world,frameSerial:1}]]);r.frameSerial=1;r.fitScale=.25;
  Object.assign(r.camera,{azimuth:.7,elevation:.4,panX:.12,panY:.08,dolly:sourceDolly});
  const project=()=>{
   const anchor=r.trackingAnchorForFrame(),active=Math.abs((r.camera.dolly??1)-1)>1e-8;
   r.scale=r.fitScale*r.camera.zoom*(r.camera.dolly??1);r.centerX=r.w*(.5+r.camera.panX);r.centerY=r.h*(.5+r.camera.panY);
   r.projectionAnchor=active?anchor:null;const offset=active?{x:0,y:0}:r.view(anchor);
   r.cx=r.centerX-offset.x*r.scale;r.cy=r.centerY-offset.y*r.scale;
   return r.project(world);
  };
  const start=project();r.animateFocus(targetId,0,1000);const destination={...r.cameraTween.to},end={x:r.w*(.5+destination.panX),y:r.h*(.5+destination.panY)};
  let priorDistance=Math.hypot(start.x-end.x,start.y-end.y);
  for(let mono=0;mono<1000;mono+=10){
   r.advanceCamera(mono);const p=r.cameraTween.progress,screen=project(),distance=Math.hypot(screen.x-end.x,screen.y-end.y);
   close(screen.x,start.x+(end.x-start.x)*p,1e-7);close(screen.y,start.y+(end.y-start.y)*p,1e-7);
   assert.ok(distance<=priorDistance+1e-7,`${targetId}: target reversed at ${mono}ms`);priorDistance=distance;
   // The GPU orbit transform must resolve to the same position as CPU bodies.
   const camera=r.gpuOrbitCamera(),a=camera.anchor,v=r.view({x:world.x-a.x,y:world.y-a.y,z:world.z-a.z});
   const perspective=Math.abs(camera.travel)>1e-8?5000/(5000-v.z*camera.travel):1;
   close(r.cx+v.x*perspective*r.scale,screen.x);close(r.cy+v.y*perspective*r.scale,screen.y);
  }
  r.advanceCamera(1000);const arrived=project();close(arrived.x,end.x);close(arrived.y,end.y);
 }
});
test('wheel-back and middle-pan tracking returns smoothly to home and free presets',()=>{
 for(const id of ['earth','moon'])for(const lens of [1.1853048513203654,2])for(const targetDolly of [1,.7,2]){
  const {r,now}=renderer(),world={x:367,y:48,z:-.004};
  r.frameItems=new Map([[id,{world,frameSerial:1}]]);r.frameSerial=1;
  r.restoreCamera(r.trackingMoveState(id));r.smoothDolly(r.camera.dolly*.85,id,0);r.advanceCamera(150);
  now(200);r.setPan(-.05,.02);
  const from=r.cameraSnapshot(),to={...r.defaultCameraSnapshot(),zoom:lens,dolly:targetDolly};
  const project=()=>{
   const anchor=r.trackingAnchorForFrame(),active=Math.abs(r.camera.dolly-1)>1e-8;
   r.scale=r.fitScale*r.camera.zoom*r.camera.dolly;r.centerX=r.w*(.5+r.camera.panX);r.centerY=r.h*(.5+r.camera.panY);
   r.projectionAnchor=active?anchor:null;const offset=active?{x:0,y:0}:r.view(anchor);
   r.cx=r.centerX-offset.x*r.scale;r.cy=r.centerY-offset.y*r.scale;
   return r.project(world);
  };
  const start=project();r.camera=to;const end=project();r.camera=from;
  r.animateCamera(to,300,1100);
  let previous=Infinity;
  for(let t=0;t<=1100;t+=10){
   r.advanceCamera(300+t);const p=r.cameraTween?.progress??1,q=project();
   close(q.x,mix(start.x,end.x,p),1e-7);close(q.y,mix(start.y,end.y,p),1e-7);
   const distance=Math.hypot(q.x-end.x,q.y-end.y);assert.ok(distance<=previous+1e-7);previous=distance;
  }
  assert.deepEqual(plain(r.cameraSnapshot()),plain(to));
 }
 function mix(a,b,t){return a+(b-a)*t;}
});

test('tracked opening has one movement timeline and no lateral arc or arrival hand-off',()=>{
 const {r}=renderer(),target={...r.trackingMoveState('earth'),azimuth:2.2,elevation:.4};
 r.restoreCamera(r.openingCameraSnapshot(target,()=>.6));r.animateOpeningCamera(target,0);
 assert.equal(r.cameraTween.openingPath.arc,null);
 let previous=r.camera.dolly;
 close(r.cameraTween.duration,8500);
 for(let mono=0;mono<8500;mono+=10){
  r.advanceCamera(mono);const move=r.cameraTween,p=move.progress;
  close((r.camera.dolly-move.from.dolly)/(move.to.dolly-move.from.dolly),p);
  assert.ok(r.camera.dolly>=previous);previous=r.camera.dolly;
 }
 r.advanceCamera(8500);assert.equal(r.cameraTween,null);close(r.camera.dolly,target.dolly);
 close(r.openingLabelOpacity(8250),.5);assert.equal(r.openingLabelOpacity(9000),1);
});

test('opening duration follows arrival coverage and annotations follow its actual end',()=>{
 const {r}=renderer(),base={...r.defaultCameraSnapshot(),dolly:1},body=A.BODIES.find(body=>body.id==='earth');
 const radius=r.bodyRadiusForState(body,base);
 assert.equal(r.openingCameraDuration(base),6500);
 for(const [coverage,duration] of [[.02,6500],[.1,6500],[.2,7500],[.3,8500],[.5,8500],[3,8500]]){
  const target={...base,focus:'earth',dolly:coverage*r.h/(2*radius)};
  close(r.openingCameraDuration(target),duration);
  r.restoreCamera(r.openingCameraSnapshot(target,()=>.3));r.animateOpeningCamera(target,100);
  close(r.cameraTween.duration,duration);r.advanceCamera(100+duration-1);assert.ok(r.cameraTween);
  r.advanceCamera(100+duration);assert.equal(r.cameraTween,null);close(r.camera.dolly,target.dolly);
  assert.equal(r.openingLabelOpacity(100+duration-1000),0);close(r.openingLabelOpacity(100+duration-250),.5);assert.equal(r.openingOrbitOpacity(100+duration),1);
  assert.ok(r.presentationUntil>=100+duration+1500,'a paused scene keeps rendering through the staggered name fade');
 }
});

test('T uses new 6.5 and 8.5 second openings without arming the arrival clock early',()=>{
 const {r}=renderer();r.bodyScales={};
 for(const [target,duration] of [[r.defaultCameraSnapshot(),6500],[r.trackingMoveState('earth'),8500]]){
  r.animateOpeningReplay(target,r.openingCameraSnapshot(target),100);
  assert.equal(r.cameraTween.replay.resetAt,Infinity);
  assert.equal(r.cameraTween.replay.inbound,duration);assert.equal(r.cameraTween.duration,9000+duration);
  assert.equal(r.openingParticles.replay,r.cameraTween.replay);assert.equal(r.openingOrbitStart,Infinity);
 }
});

test('opening duration drives orbit drawing first, then names, including a custom 10s opening',()=>{
 const {r}=renderer();
 for(const duration of [5000,6500,7000,8500,10000])for(const target of [r.defaultCameraSnapshot(),r.trackingMoveState('earth')]){
  r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,250,duration);
  assert.equal(r.cameraTween.duration,duration);assert.equal(r.openingParticles.replay.openingMove,r.cameraTween);
  assert.equal(r.openingOrbitStart,250+duration-2000);
  assert.equal(r.openingAnnotationStart,250+duration-1000);
  for(const offset of [-2000,-1500,-1000]){
   const mono=250+duration+offset;
   assert.equal(r.openingLabelOpacity(mono),0,'names wait until the complete orbit is drawn');
  }
  assert.equal(r.openingOrbitOpacity(250+duration-2000),0);
  close(r.openingOrbitOpacity(250+duration-1500),.5);
  assert.equal(r.openingOrbitOpacity(250+duration),1);
  assert.equal(r.orbitInk('earth',r.openingOrbitOpacity(250+duration)),null);
  close(r.openingLabelOpacity(250+duration-250),.5);
  assert.equal(r.openingLabelOpacity(250+duration+500),1);
  r.advanceCamera(250+duration);assert.equal(r.cameraTween,null);
  assert.ok(r.presentationUntil>=250+duration+1500);
 }
 assert.equal(r.animateOpeningCamera(null,0),false);
});

test('orbit ink draws one long lap from the body with a feathered tip',()=>{
 const {r,sandbox}=renderer(),ids=['earth','mars','saturn','moon','europa'];
 for(const angle of [-3,-1,0,1,3]){
  const origin={x:Math.cos(angle)*120,y:Math.sin(angle)*120};
  for(const id of ids){
   const ink=r.orbitInk(id,.20,origin);close(ink.phase,((angle/A.TAU)%1+1)%1);
   const tail=angle+.15*A.TAU;
   assert.ok(r.orbitInkAlpha(Math.cos(tail),Math.sin(tail),ink)>.37,'first lap carries a continuous fading long trail');
   assert.ok(r.orbitInkAlpha(origin.x,origin.y,r.orbitInk(id,.75,origin))<.02,'oldest trail fades rather than starting a second lap');
   const ahead=angle+.75*A.TAU;assert.equal(r.orbitInkAlpha(Math.cos(ahead),Math.sin(ahead),ink),0,'unwritten arc stays hidden');
  }
 }
 for(const id of ids){
  const ink=r.orbitInk(id,.75);assert.deepEqual(plain(ink),plain(r.orbitInk(id,.75)));
  for(const progress of [0,.6,.75,.95,.999999,1]){
   const shape=r.orbitInk(id,progress);let count=0;
   for(let i=0;i<1000;i++){const a=i/1000*A.TAU,alpha=r.orbitInkAlpha(Math.cos(a),Math.sin(a),shape);assert.ok(Number.isFinite(alpha));if(alpha>.01)count++;}
   if(progress===0)assert.equal(count,0);else assert.ok(count>0);if(progress===1)assert.equal(count,1000);
  }
  const edge=.75*1.06,angle=(ink.phase+edge-.03)*A.TAU;
  const alpha=r.orbitInkAlpha(Math.cos(angle),Math.sin(angle),ink);assert.ok(alpha>0&&alpha<1,'pen tip has a soft edge');
  assert.equal(r.orbitInk(id,1),null,'completed orbits use the original fast draw path');
 }
 sandbox.matchMedia=()=>({matches:true});assert.equal(r.orbitInk('earth',.5),null,'reduced motion uses opacity only');
});

test('each opening randomizes a bounded stable orbit delay and names wait for that body',()=>{
 let seed=0;const {r}=renderer(()=>((seed+=.173)%1));
 for(const duration of [5000,7000,10000]){
  r.scheduleOpeningAnnotations(100,duration);
  const offsets=[...r.openingOrbitDelays.values()];
  assert.equal(offsets.length,A.BODIES.length+A.SATELLITES.length);
  assert.ok(offsets.every(n=>n>=0&&n<1000));
  assert.equal(new Set(offsets).size,offsets.length);
  const styles=[...r.openingOrbitStyles.values()];
  assert.deepEqual([...new Set(styles.map(s=>s.direction))].sort(),[-1,1]);
  const previous=r.openingOrbitDelays;
  for(const [id,delay] of previous){
   const start=100+duration-2000+delay,end=start+1000;
   close(r.openingOrbitOpacity(start,id),0);
   close(r.openingOrbitOpacity(start+500,id),.50);
   close(r.openingOrbitOpacity(end,id),1);
   close(r.openingLabelOpacity(end,id),0);
   close(r.openingLabelOpacity(end+750,id),.5);
   close(r.openingLabelOpacity(end+1500,id),1);
   assert.equal(r.openingOrbitDelays.get(id),delay);
  }
  assert.ok(r.presentationUntil>=100+duration+1500);
  r.scheduleOpeningAnnotations(100,duration);
  assert.notEqual(r.openingOrbitDelays,previous);
  assert.notDeepEqual([...r.openingOrbitDelays.values()],[...previous.values()]);
 }
});

test('Earth region text and pin share its staggered name fade and restore canvas alpha',()=>{
 const {r}=renderer(),body=A.BODIES.find(b=>b.id==='earth');
 const earth={body,r:200,screen:{x:640,y:400},physical:{x:1,y:0,z:0}};
 r.camera.focus='earth';r.site={label:'Korea',latitude:37.5,longitude:127};r.viewDirection=()=>({x:0,y:0,z:1});
 const draws=[],stack=[],c={globalAlpha:.6,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},beginPath(){},arc(){},fill(){draws.push(['pin',this.globalAlpha]);},stroke(){draws.push(['ring',this.globalAlpha]);},fillText(text){draws.push([text,this.globalAlpha]);}};
 for(const duration of [5000,7000,10000])for(const delay of [0,800]){
  r.scheduleOpeningAnnotations(100,duration);r.openingOrbitDelays.set('earth',delay);
  const start=r.openingAnnotationStart+delay;
  for(const offset of [-1,0,750,1500]){
   draws.length=0;r.drawSiteMarker(c,earth,ms,start+offset);
   close(c.globalAlpha,.6);assert.equal(stack.length,0);
   if(offset<=0)assert.equal(draws.length,0,'no early region label or pin');
   else{
    assert.equal(draws.length,3);assert.match(draws[2][0],/^Korea · (DAY|NIGHT)$/);
    for(const [,alpha] of draws)close(alpha,.6*r.openingLabelOpacity(start+offset,'earth'));
   }
  }
 }
 r.openingAnnotationStart=NaN;draws.length=0;r.drawSiteMarker(c,earth,ms,0);assert.equal(draws.length,3);
 r.camera.focus=null;draws.length=0;r.drawSiteMarker(c,earth,ms,0);assert.equal(draws.length,0);
 r.camera.focus='earth';r.viewDirection=()=>({x:0,y:0,z:-1});r.drawSiteMarker(c,earth,ms,0);assert.equal(draws.length,0);
});

test('the only lap fades oldest-first and never reverses',()=>{
 const {r}=renderer();
 for(const direction of [-1,1]){
  r.openingOrbitStyles=new Map([['earth',{direction}]]);
  const alpha=(progress,turns)=>{const a=direction*turns*A.TAU;return r.orbitInkAlpha(Math.cos(a),Math.sin(a),r.orbitInk('earth',progress));};
  assert.ok(alpha(.5,.4)>.37);assert.equal(alpha(.5,.8),0,'lap travels forward');
  assert.ok(alpha(.8,.1)<alpha(.8,.4)&&alpha(.8,.4)<alpha(.8,.7),'older trail is progressively more transparent');
  assert.ok(alpha(.99,0)>.99&&alpha(.99,.95)>.99,'tail completes within the lap instead of an extra settling second');
  assert.equal(alpha(.7,.8),0,'no reverse-filling head');
  for(let i=0;i<100;i++)close(alpha(1,i/100),1);
  assert.equal(r.orbitInk('earth',1),null);
 }
});

test('single lap obeys current user brightness and finishes without a settling stage',()=>{
 const {r}=renderer();r.scheduleOpeningAnnotations(100,5000);r.openingOrbitDelays.set('earth',350);
 r.openingOrbitStyles.set('earth',{direction:1});
 const end=r.openingAnnotationStart+350;
 const first=r.orbitInk('earth',.5);
 const sample=(turn,ink,target)=>r.orbitInkOpacity(Math.cos(turn*A.TAU),Math.sin(turn*A.TAU),ink,target);
 for(const target of [0,.1,.33,.8,1]){
  close(sample(.46,first,target),target);
  for(const progress of [0,.25,.5,.85,.999999,1]){
   const ink=r.orbitInk('earth',progress);
   for(const turn of [0,.2,.7,.95]){
    const opacity=sample(turn,ink,target);assert.ok(opacity>=0&&opacity<=target);
    if(progress>=.999999)close(opacity,target,1e-7);
   }
  }
  for(const offset of [0,500,1000]){
   const ink=r.orbitInk('earth',r.openingOrbitOpacity(end+offset,'earth'));
   assert.equal(ink,null);close(sample(.3,ink,target),target);
  }
 }
 assert.equal(r.openingOrbitSettle,undefined,'obsolete settling timer is removed');
});
















test('sixteen flight variants keep fixed random birth angles and the existing random budget',()=>{
 const {r}=renderer(),counts=Array(16).fill(0),angles=new Set();
 for(let i=0;i<10000;i++){
  const inputs=[.5,.5,(i+.5)/10000,.5];let calls=0;
  const p=r.flightParticleStyle(()=>inputs[calls++]);
  assert.equal(calls,4);assert.ok(p.rotation>=0&&p.rotation<A.TAU);
  counts[p.tile]++;angles.add(Math.round(p.rotation*100));
 }
 assert.equal(counts.slice(0,8).reduce((a,b)=>a+b),7000);
 assert.equal(counts.slice(8,12).reduce((a,b)=>a+b),2000);
 assert.equal(counts.slice(12).reduce((a,b)=>a+b),1000);assert.ok(angles.size>500);
});



test('warp draws continuous additive trails with stable halos and no texture requests',()=>{
 const {r}=renderer();r.loadFlightParticleAtlas=()=>{throw Error('warp cannot request an atlas');};
 let head,strokes=[];const c={save(){},restore(){},beginPath(){},moveTo(x,y){head=[x,y];},
  lineTo(x,y){assert.ok(Number.isFinite(x+y));},stroke(){strokes.push([this.globalAlpha,this.lineWidth,this.strokeStyle,this.globalCompositeOperation]);},
  drawImage(){throw Error('warp cannot draw a texture');}};
 const field={replay:{},points:[0,1,2,3].map(color=>({color,glow:.8+color*.6,sizeScale:1.5+color*2.5/3})),projected:{}};
 const project=p=>({visible:true,alpha:.5,x:50,y:50,size:4,tail:p.color?25:0,angle:.6});
 r.drawFlightParticles(c,field,project);assert.equal(strokes.length,12);
 field.points.forEach((p,i)=>close(strokes[i*3+2][1],.92*p.sizeScale));
 assert.ok(strokes.every(s=>s[3]==='lighter'));
 assert.ok(strokes.filter((_,i)=>i%3===0).every(s=>s[0]<.05));
 assert.ok(strokes.filter((_,i)=>i%3===2).every(s=>s[0]===.5&&s[2]==='#edf7ff'));
 const first=strokes;strokes=[];r.drawFlightParticles(c,field,project);assert.deepEqual(strokes,first);
});

test('flight atlas is loaded once, falls back on error, and ignores late completion after disposal',()=>{
 const {r,sandbox}=renderer(),images=[];sandbox.Image=class {constructor(){images.push(this);}};
 r.openingParticleSprite={fallback:true};r.loadFlightParticleAtlas();r.loadFlightParticleAtlas();
 assert.equal(images.length,1);const image=images[0];assert.match(image.src,/flight-particles-atlas-v1.webp$/);
 image.onerror();assert.ok(r.openingParticleSprite.fallback);
 Object.assign(image,{naturalWidth:512,naturalHeight:512});image.onload();assert.equal(r.openingParticleSprite,image);
 assert.equal(r.memoryUsage().flightAtlas,512*512*4);
 const onload=image.onload;r.releaseFlightParticleAtlas();onload();
 assert.equal(r.flightParticleImage,null);assert.equal(r.openingParticleSprite,null);assert.equal(image.onload,null);
});

test('atlas painter uses one draw per grain with stable rotation and flow-aligned tails',()=>{
 const {r}=renderer(),sprite={},calls=[],rotations=[];
 r.openingParticleSprite=r.flightParticleImage=sprite;
 const field={points:Array.from({length:16},(_,tile)=>({tile,rotation:tile*.37})),projected:{}};
 const c={save(){},restore(){},translate(){},scale(x,y){assert.ok(x>=1);assert.equal(y,1);},rotate(a){rotations.push(a);},drawImage(image,sx,sy,sw,sh,...rect){
  assert.equal(image,sprite);assert.equal(sw,96);assert.equal(sh,96);assert.equal(sx%128,16);assert.equal(sy%128,16);assert.ok(rect.every(Number.isFinite));calls.push([sx,sy]);
 }};
 const project=(p,f,out)=>Object.assign(out,{visible:true,alpha:.5,x:40,y:40,size:3,glowSize:2,tail:p.tile%2?12:0,angle:.4});
 const before=JSON.stringify(field.points);r.drawFlightParticles(c,field,project);
 assert.equal(calls.length,16);assert.equal(new Set(calls.map(v=>v.join(','))).size,16);
 for(const p of field.points)assert.ok(rotations.includes(p.rotation));
 r.drawFlightParticles(c,field,project);assert.equal(calls.length,32);assert.equal(JSON.stringify(field.points),before);
});

test('packed flight atlas has sixteen separated alpha sprites and is included in local release inputs',async()=>{
 const file=path.join(__dirname,'../assets/effects/flight-particles-atlas-v1.webp'),sharp=require('sharp');
 assert.ok(fs.statSync(file).size<50000);
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,512);assert.equal(info.height,512);const cells=Array(16).fill(0);let translucent=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const a=data[(y*512+x)*4+3];cells[(y>>7)*4+(x>>7)]+=a;if(a>0&&a<255)translucent++;
  if(x%128<8||x%128>=120||y%128<8||y%128>=120)assert.ok(a<=1,'transparent gutters prevent tile bleed');
  if(x%128<16||x%128>=112||y%128<16||y%128>=112)assert.ok(a<=2,'discarded gutter has no visible ink');
 }
 assert.ok(cells.every(a=>a>80000));assert.ok(translucent>10000);
 assert.ok(require('../tools/release-files.cjs').releaseFiles(path.join(__dirname,'..')).includes('assets/effects/flight-particles-atlas-v1.webp'));
});

test('actual size mode keeps the 100–300% Sun and preserves real body diameter ratios',()=>{
 const {r}=renderer(),earth=A.BODIES.find(body=>body.id==='earth');r.options.actualScale=true;r.actualScaleMix=1;
 assert.deepEqual(plain(r.bodyScaleLimits('sun')),{min:1,max:3});
 assert.equal(r.setBodyScale('earth',2),false);
 const radii=[];
 for(const scale of [1,2,3]){
  assert.equal(r.setBodyScale('sun',scale),true);
  const sun=r.bodyRadiusForState(A.SUN,r.camera),earthRadius=r.bodyRadiusForState(earth,r.camera);
  close(sun/earthRadius,A.BODY_RADIUS_KM.sun/A.BODY_RADIUS_KM.earth);
  close(sun,A.SUN.size*r.bodyScaleForZoom(r.camera.zoom)*scale*r.camera.dolly);radii.push(sun);
 }
 close(radii[1],radii[0]*2);close(radii[2],radii[0]*3);
 r.setBodyScale('sun',.2);assert.equal(r.bodySizeScale('sun'),1);
 r.setBodyScales({sun:.4});assert.equal(r.bodySizeScale('sun'),1);
 r.setBodyScale('sun',5);assert.equal(r.bodySizeScale('sun'),3);
});
test('switching to actual scale never collapses the default-view Sun during the transition',()=>{
 const {r}=renderer();r.bodyScales.sun=1.54;
 const before=r.bodyRadiusAtZoom(A.SUN);r.setOption('actualScale',true);
 for(let mono=0;mono<=2000;mono+=20){r.advanceActualScale(mono);assert.ok(r.bodyRadiusAtZoom(A.SUN)>=before-1e-8);}
});
test('even the smallest enabled planet and major moons can be inspected at true scale',()=>{
 for(const pluto of [true,false])for(const sunScale of [1,3]){
  const {r,R}=renderer();r.options.pluto=pluto;r.options.actualScale=true;r.actualScaleMix=1;r.setBodyScale('sun',sunScale);
  const smallest=r.getBodies().reduce((a,b)=>A.BODY_RADIUS_KM[a.id]<A.BODY_RADIUS_KM[b.id]?a:b);
  assert.equal(smallest.id,pluto?'pluto':'mercury');
  for(const id of [smallest.id,'moon','europa']){
   const body=r.sceneBodies().find(body=>body.id===id),target=r.trackingMoveState(id);
   assert.ok(R.validCamera(target));assert.ok(target.dolly<r.zoomLimits.maxDolly/2,'wheel still has room to move closer');
   close(r.bodyRadiusForState(body,target)*2/r.h,.5);
   close(r.openingCameraDuration(target),8500);
  }
 }
});

test('actual mode keeps physical diameter ratios and moon proportions on the same distance scale',()=>{
 const {r,R}=renderer(),base=r.defaultCameraSnapshot(),bodies=[A.SUN,...A.BODIES,...A.SATELLITES];
 r.actualScaleMix=1;r.options.actualOrbitSpacing=1;r.satelliteOrbitScales={sun:10,earth:9,jupiter:7};r.bodyScales.moon=8;
 for(const zoom of [.1,1,4,250])for(const dolly of [.002,1,12,1e6]){
  r.camera={...base,zoom,dolly};r.fitScale=r.actualScaleFit();r.scale=r.fitScale*zoom*dolly;r.bodyScale=r.bodyScaleAtZoom();
  for(const body of bodies){
   close(r.bodyRadiusAtZoom(body)/r.bodyRadiusAtZoom(A.SUN),A.BODY_RADIUS_KM[body.id]/A.BODY_RADIUS_KM.sun);
   close(r.bodyRadiusAtZoom(body)/r.scale,A.BODY_RADIUS_KM[body.id]/A.AU_KM*A.TRUE_SCALE_UNITS_PER_AU);
  }
  for(const body of A.BODIES){
   const p=A.positionAt(body,ms),world={};r.displayPhysicalPoint(p,world,body);
   const factor=A.TRUE_SCALE_UNITS_PER_AU;
   for(const key of ['x','y','z'])close(world[key],p[key]*factor,1e-9);
  }
  for(const moon of A.SATELLITES){
   const parent=A.BODIES.find(body=>body.id===moon.parent),pr=r.bodyRadiusAtZoom(parent);
   const orbit=r.satelliteOrbitRadius(moon,parent);
   close(orbit*r.scale/(2*pr),A.SATELLITE_MEAN_AU[moon.id]*A.AU_KM/(2*A.BODY_RADIUS_KM[parent.id]));
  }
  assert.equal(r.gpuOrbitCamera().lens,1);
 }
 for(const body of bodies){
  const to=r.trackingMoveState(body.id,base);assert.ok(R.validCamera(to));
  close(r.bodyRadiusForState(body,to),r.h*.25,1e-7);
 }
});

test('actual-scale transitions invalidate frame scale and restoring overview preserves user preferences',()=>{
 const {r,now}=renderer(),before=plain(r.bodyScales),state=r.cameraSnapshot();
 r.dirty=false;now(0);r.setOption('actualScale',true);r.dirty=false;r.advanceActualScale(1000);
 assert.equal(r.dirty,true);close(r.actualScaleMix,.5);close(r.gpuOrbitCamera().lens,1);
 r.advanceActualScale(2000);assert.equal(r.actualScaleMix,1);assert.equal(r.actualScaleTween,null);
 now(2000);r.setOption('actualScale',false);r.advanceActualScale(4000);
 assert.equal(r.actualScaleMix,0);assert.deepEqual(plain(r.bodyScales),before);assert.deepEqual(plain(r.cameraSnapshot()),plain(state));
 close(r.gpuOrbitCamera().lens,1);
});

test('true-scale close-ups do not inflate distant bodies with a minimum perspective multiplier',()=>{
 const {r}=renderer();r.actualScaleMix=1;r.projectionAnchor={x:0,y:0,z:0};
 r.camera={...r.defaultCameraSnapshot(),azimuth:0,elevation:0,focus:'earth',dolly:1e6};
 const distant=r.projectView({x:5,y:20,z:0});
 assert.ok(distant.perspective<.002);close(distant.perspective,5000/(5000+20*(1e6-1)));
 assert.equal(distant.behind,false);
 const shader=read('src/surface.js');assert.match(shader,/1\.-v\.z\*travel\/5000\./);assert.match(shader,/gl_Position=vec4\(origin\*w\+projected,\.004-w,w\)/);assert.doesNotMatch(shader,/gl_Position=vec4\(2\.,2\.,2\.,-1\.\)/);
});
test('Move country inspection preserves wheel mode and matches the 250x Earth radius',()=>{
 const {r,R}=renderer(),earth=A.BODIES.find(b=>b.id==='earth');
 r.options.dollyZoom=true;Object.assign(r.camera,{zoom:1700,dolly:12});
 const targetRadius=r.bodyRadiusForState(earth,{...r.camera,focus:'earth',zoom:250,dolly:1});
 assert.ok(r.animateFeature('earth',1.2833333,103.85,ms,0,1000));assert.ok(R.validCamera(r.cameraTween.to));r.advanceCamera(1000);
 assert.equal(r.options.dollyZoom,true);assert.equal(r.camera.zoom,1);close(r.bodyRadiusForState(earth,r.camera),targetRadius);
 const d=r.camera.dolly;r.smoothDolly(d*1.5,'earth',1100);r.advanceCamera(1300);close(r.camera.dolly,d*1.5);
});
test('all supported country coordinates use the same 250x camera command',()=>{
 const app=read('src/app.js'),start=app.indexOf('  const REGIONS='),end=app.indexOf('  const FACTORY_OPTIONS=',start);
 const regions=vm.runInNewContext(app.slice(start,end)+';REGIONS');
 for(const region of Object.values(regions)) {const {r}=renderer();assert.ok(r.animateFeature('earth',region.latitude,region.longitude,ms,0,1000),region.label);assert.equal(r.cameraTween.to.zoom,250);}
});
test('ordinary planet focus and Jupiter feature view derive framing from the current baseline sizes',()=>{
 const {r}=renderer(),jupiter=A.BODIES.find(b=>b.id==='jupiter'),mars=A.BODIES.find(b=>b.id==='mars'),radius=Math.min(r.w,r.h)*.25;
 r.animateFeature('jupiter',-22,70,ms,0,1000);const feature=r.cameraTween.to;
 close(r.bodyRadiusForState(jupiter,feature),radius,1e-4);assert.notEqual(feature.zoom,250,'country inspection zoom is Earth-only');
 r.advanceCamera(1000);r.animateFocus('mars',1100,1000);const follow=r.cameraTween.to;
 close(follow.zoom,feature.zoom);assert.equal(follow.mode,'move');close(r.bodyRadiusForState(mars,follow),radius);
});

test('default view, reset and home share the user-framed camera captured on 2026-10-02',()=>{
 const {r}=renderer(),home=r.defaultCameraSnapshot();
 assert.deepEqual(plain(home),{azimuth:6.24870825667827,elevation:.25293208858658467,zoom:1.1853048513203654,dolly:1.4049475905635938,focus:null,panY:.033915866075961185,panX:0,mode:'move'});
 r.bodyScales={};assert.equal(r.openingCameraDuration(home),6500);
 Object.assign(r.camera,{elevation:1,zoom:5,dolly:3,focus:'earth'});
 assert.ok(r.animateHome(0,1100));assert.deepEqual(plain(r.cameraTween.to),plain(home));
 r.advanceCamera(1100);assert.deepEqual(plain(r.cameraSnapshot()),plain(home));
 r.restoreCamera({...home,azimuth:2,elevation:1,dolly:3});r.resetCamera();assert.deepEqual(plain(r.cameraSnapshot()),plain(home));
});
test('repeated satellite focus always keeps the same close-up framing',()=>{
 for(const dollyZoom of [false,true]){
  const {r}=renderer();r.options.dollyZoom=dollyZoom;
  assert.ok(r.animateFocus('moon',0,350));const first=plain(r.cameraTween.to);
  r.advanceCamera(175);assert.ok(r.animateFocus('moon',175,350));const during=plain(r.cameraTween.to);
  r.advanceCamera(525);assert.ok(r.animateFocus('moon',600,350));const after=plain(r.cameraTween.to);
  for(const target of [during,after]){
   assert.equal(target.focus,'moon');assert.equal(target.mode,first.mode);
   close(target.zoom,first.zoom);close(target.dolly,first.dolly);
   assert.equal(target.panX,0);assert.equal(target.panY,0);
  }
 }
});
test('rapid tracked-body retargeting keeps the last rendered anchor',()=>{
 const {r}=renderer();
 assert.ok(r.animateFocus('earth',0,1000));
 r.advanceCamera(350);r.trackingAnchor={x:12,y:-8,z:3};
 assert.ok(r.animateFocus('mars',350,1000));
 assert.deepEqual(plain(r.cameraTween.fromAnchor),{x:12,y:-8,z:3});
 r.trackingAnchor.x=99;
 assert.deepEqual(plain(r.cameraTween.fromAnchor),{x:12,y:-8,z:3},'the transition owns a stable anchor snapshot');
});
test('Moon and Europa display size never changes their orbital spacing',()=>{
 for(const satellite of A.SATELLITES){
  const {r}=renderer(),parent=A.BODIES.find(body=>body.id===satellite.parent);
  r.bodyScales={};r.bodyScale=1;r.scale=10;Object.assign(r.camera,{focus:satellite.id,zoom:64,dolly:1});
  const spacing=[];
  for(const scale of [1,2,8]){
   r.bodyScales[satellite.id]=scale;
   spacing.push(r.satelliteOrbitRadius(satellite,parent));
  }
  close(spacing[1],spacing[0]);close(spacing[2],spacing[0]);
 }
});
test('random mode is opt-in, exclusive with left/right and does not change framing',()=>{
 const {r}=renderer(),before=plain(r.camera);assert.equal(r.randomRotateEnabled,false);
 r.setAutoRotate(1,0);r.setRandomRotate(true,0);assert.equal(r.autoRotateDirection,0);assert.equal(r.randomRotateEnabled,true);assert.deepEqual(plain(r.camera),before);
 for(let i=1;i<=1800;i++)r.advanceAutoRotate(i*1000/60);
 assert.notEqual(r.camera.azimuth,before.azimuth);assert.notEqual(r.camera.elevation,before.elevation);
 for(const k of ['focus','zoom','dolly','panX','panY'])assert.equal(r.camera[k],before[k],k);
 r.setAutoRotate(-1,30000);assert.equal(r.randomRotateEnabled,false);assert.equal(r.autoRotateDirection,-1);
 r.setRandomRotate(false,30000);assert.equal(r.autoRotateDirection,-1,'OFF must not disable ordinary rotation');
});
test('fixed random direction is frame-rate independent across multiple full revolutions',()=>{
 const results=[];for(const fps of [30,60,90,144,165]){const {r}=renderer();r.setRandomRotate(true,0);for(let i=1;i<=fps*120;i++)r.advanceAutoRotate(i*1000/fps);results.push(r.camera);}
 for(const value of results.slice(1)){close(value.azimuth,results[0].azimuth);close(value.elevation,results[0].elevation);}
});
test('fixed random angular speed remains identical to left/right over long runs',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);let prior=plain(r.camera),velocity=null;
 for(let i=1;i<=7200;i++){
  r.advanceAutoRotate(i*1000/60);const v=[(A.wrap(r.camera.azimuth-prior.azimuth+Math.PI)-Math.PI)*60,(A.wrap(r.camera.elevation-prior.elevation+Math.PI)-Math.PI)*60];
  assert.ok(Math.abs(Math.hypot(...v)/A.DEG-1.8)<.0001,'random rotation must keep left/right speed, not merely stay below it');
  if(velocity){assert.ok(Math.abs(v[0]-velocity[0])<.001);assert.ok(Math.abs(v[1]-velocity[1])<.001);}
  prior=plain(r.camera);velocity=v;
 }
});
test('random OFF freezes current angles without resetting view',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(200);r.setRandomRotate(false,200);const before=plain(r.camera);r.advanceAutoRotate(10000);assert.deepEqual(plain(r.camera),before);assert.equal(r.randomRotateEnabled,false);
});
test('random rotation survives wheel, preset and home tweens without duplicate motion owners',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(200);const path=r.randomRotation;
 r.smoothZoom(300,null,200);assert.equal(r.autoRotation,null);assert.equal(r.randomRotateEnabled,true);r.advanceCamera(400);
 assert.equal(r.randomRotation,path);assert.equal(r.camera.zoom,300);assert.equal(r.pendingAutoRotation,null);assert.equal(r.randomRotateEnabled,true);
 const saved={...r.camera,azimuth:2,elevation:.3,zoom:500,panX:.2};r.animateCamera(saved,500,1000);r.advanceCamera(1500);assert.equal(r.camera.zoom,500);assert.equal(r.randomRotateEnabled,true);
 r.animateHome(1600,1000);r.advanceCamera(2600);assert.equal(r.randomRotateEnabled,true);assert.equal(r.camera.zoom,r.defaultCameraSnapshot().zoom);
});
test('interrupted tween and manual orbit retain random mode just like left/right',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.animateFocus('earth',0,1100);r.cancelCameraTween(500);
 assert.equal(r.randomRotateEnabled,true);assert.ok(r.autoRotation);assert.equal(r.pendingAutoRotation,null);
 const path=r.randomRotation;r.setOrbitView(.8,.2,500);assert.equal(r.randomRotateEnabled,true);assert.equal(r.randomRotation,path);close(r.camera.azimuth,.8);close(r.camera.elevation,.2);r.advanceAutoRotate(600);assert.notEqual(r.camera.azimuth,.8);
 r.setAutoRotate(1,500);r.setOrbitView(.9,.3);assert.equal(r.autoRotateDirection,1);
});
test('tab suspension and large stalls do not catch up random motion in a jump',()=>{
 const {r,now}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(200);now(200);r.suspend();const before=plain(r.camera);
 r.advanceAutoRotate(100000);assert.deepEqual(plain(r.camera),before);r.advanceAutoRotate(100100);
 assert.ok(Math.abs(r.camera.azimuth-before.azimuth)<.004);
 const at=r.camera.azimuth;r.advanceAutoRotate(400000);assert.ok(Math.abs(r.camera.azimuth-at)<1.8*A.DEG*.251);
});
test('invalid random commands are rejected and repeated ON is idempotent',()=>{
 const {r}=renderer();assert.equal(r.setRandomRotate('yes',0),false);assert.equal(r.setRandomRotate(true,NaN),false);assert.equal(r.setAutoRotate(2,0),false);
 r.setRandomRotate(true,0);const motion=r.autoRotation;r.setRandomRotate(true,300);assert.equal(r.autoRotation,motion);
});
test('random button is below the displayed left-turn button and uses shared toggle styling',()=>{
 const html=read('index.html');assert.match(html,/id="rotate-right"[\s\S]*id="random-rotate"[\s\S]*id="zen-toggle"/);assert.match(html,/id="random-rotate" class="icon-button rotate-button"/);
 const icon=html.split('id="random-rotate"')[1].split('</button>')[0];assert.equal((icon.match(/<ellipse /g)||[]).length,2);assert.match(icon,/aria-pressed="false"/);
 for(const f of fs.readdirSync(path.join(__dirname,'../src/locales'))){const data=JSON.parse(read('src/locales/'+f));assert.ok(data.copy.randomRotate,f);}
});
test('random rotation mode is persisted and restored with legacy direction compatibility',()=>{
 const app=read('src/app.js');
 assert.match(app,/rotationMode=renderer\.randomRotateEnabled\?'random':renderer\.autoRotateDirection/);
 assert.match(app,/rotationMode,autoRotateDirection:renderer\.autoRotateDirection/);
 assert.match(app,/if\(savedRotationMode==='random'\)renderer\.setRandomRotate\(true,performance\.now\(\)\)/);
 assert.match(app,/else if\(\[-1,0,1\]\.includes\(saved\.autoRotateDirection\)\)savedRotationMode=saved\.autoRotateDirection/);
});
test('frame deadline accumulation reaches requested 60/30 fps on 60..165 Hz displays',()=>{
 const window={};vm.runInNewContext(read('src/performance.js'),{window,performance});
 for(const hz of [60,75,90,120,144,165])for(const fps of [30,60]){
  const gate=window.SolarPerformance.createFrameGate();let count=0;
  for(let i=0;i<hz*60;i++)if(gate(i*1000/hz,1000/fps))count++;
  assert.ok(Math.abs(count-fps*60)<=1,`${hz} Hz ${fps} fps: ${count}`);
 }
});
test('frame deadlines reset across suspension, changed targets and invalid inputs',()=>{
 const window={};vm.runInNewContext(read('src/performance.js'),{window,performance});const gate=window.SolarPerformance.createFrameGate();
 assert.equal(gate(NaN,16),false);assert.equal(gate(0,0),false);assert.equal(gate(0,1000/60),true);assert.equal(gate(5,1000/60),false);assert.equal(gate(100000,1000/60),true);assert.equal(gate(100001,1000/60),false);assert.equal(gate(100002,1000/30),true);assert.equal(gate(100003,1000/30,true),true);
});
test('stat text and unit nodes are reused and unchanged values do not replace children',()=>{
 const app=read('src/app.js'),start=app.indexOf('      const statNodes='),end=app.indexOf('      function updateBody',start),nodes=new Map();let replacements=0;
 const context={$:id=>{if(!nodes.has(id))nodes.set(id,{replaceChildren(...children){this.children=children;replacements++;}});return nodes.get(id);},document:{createTextNode:value=>({nodeValue:value}),createElement:()=>({textContent:'',hidden:false})}};
 vm.runInNewContext(app.slice(start,end)+';this.setStat=setStat;',context);
 context.setStat('value','27.32','days');const original=nodes.get('value').children;for(let i=0;i<100;i++)context.setStat('value','27.32','days');assert.equal(replacements,1);assert.equal(nodes.get('value').children,original);
 context.setStat('value','27.33','days');assert.equal(replacements,1);assert.equal(original[0].nodeValue,'27.33 ');
 context.setStat('value','Sun','');assert.equal(original[1].hidden,true);context.setStat('value','28','hours');assert.equal(original[1].hidden,false);
});
test('each new page generates fresh stars; camera controls never call regeneration',()=>{
 const samples=[];for(let seed=1;seed<=2;seed++){
  const window={SolarAssets:{},crypto:{getRandomValues:array=>array[0]=seed}},M=Object.create(Math);M.random=()=>.5;
  vm.runInNewContext(read('src/visual-effects.js'),{window,Math:M,Date:{now:()=>123456789}});samples.push(Array.from(window.SolarAssets.starData.slice(0,30)));
 }
 assert.notDeepEqual(samples[0],samples[1]);assert.doesNotMatch(read('src/renderer.js'),/regenerateStars/);
});
const wrapDelta=(a,b)=>A.wrap(a-b+Math.PI)-Math.PI;
test('manual angular deltas extend the running pose after idle and retain every rotation mode',()=>{
 for(const mode of [-1,1,2])for(const elevation of [89.99,90.01,120,179.99,-89.99,-90.01,-120,-179.99]){
  const {r,R}=renderer(),ref=renderer().r;
  for(const v of [r,ref]){v.camera.elevation=elevation*A.DEG;v.camera.azimuth=6.27;mode===2?v.setRandomRotate(true,0):v.setAutoRotate(mode,0);}
  const randomPath=r.randomRotation;
  // Pointer is held still while automatic rotation keeps changing both angles.
  for(let i=1;i<=600;i++){r.advanceAutoRotate(i*1000/60);ref.advanceAutoRotate(i*1000/60);}
  ref.advanceAutoRotate(10008);r.rotateViewBy(.012,.006,10008);
  close(wrapDelta(r.camera.azimuth,ref.camera.azimuth),.012);close(wrapDelta(r.camera.elevation,ref.camera.elevation),.006);
  assert.equal(r.rotationIntent,mode);assert.equal(r.randomRotation,randomPath);assert.ok(R.validCamera(r.cameraSnapshot()));
  const before=plain(r.camera);r.advanceAutoRotate(10024);
  assert.notEqual(r.camera.azimuth,before.azimuth);assert.equal(r.rotationIntent,mode);
  for(const key of ['zoom','dolly','panX','panY','focus'])assert.equal(r.camera[key],before[key]);
 }
});
test('vertical manual rotation is physically continuous through both poles and full turns',()=>{
 const {r,R}=renderer();
 for(const start of [Math.PI/2,-Math.PI/2,Math.PI,-Math.PI])for(const sign of [-1,1]){
  r.setOrbitView(.3,start-sign*.002,0);const before=r.viewDirection({x:1,y:2,z:3});
  assert.ok(r.rotateViewBy(0,sign*.004,0));const after=r.viewDirection({x:1,y:2,z:3});
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)<.02);assert.ok(R.validCamera(r.cameraSnapshot()));
 }
 r.setOrbitView(.3,0,0);const before=r.viewDirection({x:1,y:2,z:3});
 for(let i=0;i<1000;i++)r.rotateViewBy(0,Math.PI*8/1000,0);
 const after=r.viewDirection({x:1,y:2,z:3});close(after.x,before.x);close(after.y,before.y);close(after.z,before.z);
});
test('manual takeover of a feature tween retains random intent and the interpolated pose',()=>{
 const {r}=renderer(),ref=renderer().r;
 for(const v of [r,ref]){v.setRandomRotate(true,0);v.animateFeature('earth',37.56,126.98,ms,0,1100);}
 ref.cancelCameraTween(400);ref.advanceAutoRotate(400);r.rotateViewBy(.02,-.01,400);
 close(wrapDelta(r.camera.azimuth,ref.camera.azimuth),.02);close(wrapDelta(r.camera.elevation,ref.camera.elevation),-.01);
 assert.equal(r.cameraTween,null);assert.equal(r.pendingAutoRotation,null);assert.equal(r.randomRotateEnabled,true);
 const state=plain(r.camera);r.advanceAutoRotate(450);assert.notEqual(r.camera.elevation,state.elevation);
});
test('invalid relative input cannot advance the camera or alter the active rotation intent',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);const before=plain(r.camera);
 for(const values of [[NaN,0,100],[0,Infinity,100],[0,0,NaN]])assert.equal(r.rotateViewBy(...values),false);
 assert.deepEqual(plain(r.camera),before);assert.equal(r.randomRotateEnabled,true);
});
test('pointer input uses current deltas rather than saved start angles; small clicks still have a dead zone',()=>{
 const app=read('src/app.js');assert.doesNotMatch(app,/startAzimuth|startElevation/);
 assert.match(app,/renderer\.rotateViewBy\(\(wasMoved\?dx:p\.x-drag\.startX\)/);
 assert.match(app,/Math\.hypot\(p\.x-drag\.startX,p\.y-drag\.startY\)>4/);
});

// A nonzero floating-point delta is not proof of visible motion: compare the
// actual angular distance against ordinary auto rotation from the first frame.
test('random rotation starts at full left/right speed for varied seeds and update rates',()=>{
 for(const seed of [0,.001,.127694,.25,.5,.75,.999999])for(const fps of [4,30,60,90,144,165]){
  const {r}=renderer(seed),left=renderer(seed).r;r.setRandomRotate(true,0);left.setAutoRotate(1,0);
  let travel=0,leftTravel=0;
  for(let i=1;i<=fps;i++){
   const before=plain(r.camera),leftBefore=left.camera.azimuth;
   r.advanceAutoRotate(i*1000/fps);left.advanceAutoRotate(i*1000/fps);
   const d=Math.hypot(wrapDelta(r.camera.azimuth,before.azimuth),wrapDelta(r.camera.elevation,before.elevation));
   const expected=Math.abs(wrapDelta(left.camera.azimuth,leftBefore));
   assert.ok(Math.abs(d/expected-1)<1e-5,`seed ${seed} fps ${fps} frame ${i}: ${d/expected}`);
   travel+=d;leftTravel+=expected;
  }
  close(travel/A.DEG,1.8,.00001);close(travel,leftTravel,.000001);
 }
});
test('one sampled direction stays fixed for ten minutes, across the former 8-16 second turns',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);const path=r.randomRotation,beforePath=plain(path);
 assert.ok(Object.isFrozen(path));close(Math.hypot(path.yawRate,path.pitchRate)/A.DEG,1.8);
 let previous=plain(r.camera);
 for(let i=1;i<=600*60;i++){
  r.advanceAutoRotate(i*1000/60);
  close(wrapDelta(r.camera.azimuth,previous.azimuth)*60,path.yawRate);
  close(wrapDelta(r.camera.elevation,previous.elevation)*60,path.pitchRate);
  previous=plain(r.camera);
 }
 assert.equal(r.randomRotation,path);assert.deepEqual(plain(path),beforePath);
});
test('only a fresh activation samples another direction; frames and repeated ON do not',()=>{
 let samples=0;const seeds=[.127694,.75,.25];const {r}=renderer(()=>seeds[samples++]);
 r.setRandomRotate(true,0);const first=r.randomRotation;assert.equal(samples,1);
 for(let i=1;i<=1200;i++)r.advanceAutoRotate(i*1000/60);
 r.setRandomRotate(true,20000);r.rotateViewBy(.02,-.04,20000);
 r.animateHome(20000,1000);r.advanceCamera(21000);
 assert.equal(samples,1);assert.equal(r.randomRotation,first);
 r.setRandomRotate(false,21000);const stopped=plain(r.camera);r.advanceAutoRotate(30000);
 assert.deepEqual(plain(r.camera),stopped);
 r.setRandomRotate(true,30000);assert.equal(samples,2);assert.notEqual(r.randomRotation.heading,first.heading);
 const second=r.randomRotation;r.setAutoRotate(1,30000);assert.equal(samples,2);
 r.setRandomRotate(true,30000);assert.equal(samples,3);assert.notEqual(r.randomRotation.heading,second.heading);
});
test('manual drag, zoom, presets and tab suspension retain the same signed yaw/pitch rates',()=>{
 const {r,now}=renderer();r.setRandomRotate(true,0);const path=r.randomRotation;
 const advance=mono=>{const before=plain(r.camera);r.advanceAutoRotate(mono+20);close(wrapDelta(r.camera.azimuth,before.azimuth),path.yawRate*.02);close(wrapDelta(r.camera.elevation,before.elevation),path.pitchRate*.02);assert.equal(r.randomRotation,path);};
 r.rotateViewBy(.1,2,100);advance(100);
 r.smoothZoom(350,null,200);r.advanceCamera(400);advance(400);
 r.animateHome(500,1000);r.advanceCamera(1500);advance(1500);
 now(1520);r.suspend();r.advanceAutoRotate(60000);advance(60000);
});
test('manual release and tween completion resume random rotation at unchanged speed',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);r.advanceAutoRotate(100);
 const path=r.randomRotation;r.rotateViewBy(.01,.01,100);let before=plain(r.camera);r.advanceAutoRotate(100+1000/60);
 close(Math.hypot(wrapDelta(r.camera.azimuth,before.azimuth),wrapDelta(r.camera.elevation,before.elevation))/A.DEG,.03,1e-6);
 r.animateHome(200,1000);r.advanceCamera(1200);assert.equal(r.randomRotation,path);
 before=plain(r.camera);r.advanceAutoRotate(1200+1000/60);
 close(Math.hypot(wrapDelta(r.camera.azimuth,before.azimuth),wrapDelta(r.camera.elevation,before.elevation))/A.DEG,.03,1e-6);
});

test('visible-only opening projection preserves every drawn particle and skips hidden geometry',()=>{
 for(const boot of [false,true]){
  const {r}=renderer(),target=r.cameraSnapshot();
  if(boot){r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,0,6500);}
  else{r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);r.cameraTween.replay.brakeAt=4300;r.cameraTween.replay.resetAt=7000;}
  for(const time of boot?[0,100,1000,3500,6500,8400]:[0,1000,1499,1800,4300,7000,9000,12000,15000]){
   const field=r.openingParticleFrame(time);
   for(const p of field.points){
    const full=r.projectOpeningParticle(p,field,{}),fast=r.projectOpeningParticle(p,field,{},true);
    if(full.alpha>=1e-4)assert.deepEqual(fast,full);
    else assert.ok(!fast.visible||fast.alpha<1e-4);
   }
  }
 }
 const {r}=renderer(),target=r.cameraSnapshot();r.animateOpeningReplay(target,r.openingCameraSnapshot(target),0,6500);
 const field=r.openingParticleFrame(1000),p={...field.points[0]};
 Object.defineProperty(p,'x',{get(){throw Error('hidden grain should not project geometry');}});
 assert.equal(r.projectOpeningParticle(p,field,{},true).visible,false);
 r.drawFlightParticles({save(){throw Error('empty field should not draw');}},{alpha:0},()=>{throw Error('empty field should not project');});
});

test('Space playback freezes opening camera and particles and resumes without elapsed catchup',()=>{
 const {r}=renderer(),target=r.cameraSnapshot();r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,100,6500);
 r.advanceCamera(1100);const camera=plain(r.camera),field=r.openingParticleFrame(1100),elapsed=field.elapsed,start=r.cameraTween.start;
 r.setAnimationPaused(true,1100);
 for(const time of [2000,4000,9000]){r.advanceCamera(time);assert.deepEqual(plain(r.camera),camera);assert.equal(r.openingParticleFrame(time).elapsed,elapsed);}
 assert.equal(r.setAnimationPaused(false,10100),9000);assert.equal(r.cameraTween.start,start+9000);
 r.advanceCamera(10100);assert.deepEqual(plain(r.camera),camera);assert.equal(r.openingParticleFrame(10100).elapsed,elapsed);
 r.advanceCamera(10600);assert.notDeepEqual(plain(r.camera),camera);
});
test('paused auto rotation preserves manual framing and its configured direction on resume',()=>{
 for(const random of [false,true]){
  const {r}=renderer();if(random)r.setRandomRotate(true,0);else r.setAutoRotate(1,0);
  r.advanceAutoRotate(1000);r.setAnimationPaused(true,1000);const before=plain(r.camera),intent=r.rotationIntent;
  r.advanceAutoRotate(6000);assert.deepEqual(plain(r.camera),before);
  r.camera.azimuth+=.3;r.camera.elevation+=.1;const manually=plain(r.camera);
  r.setAnimationPaused(false,8000);r.advanceAutoRotate(8000);assert.deepEqual(plain(r.camera),manually);
  r.advanceAutoRotate(8100);assert.notDeepEqual(plain(r.camera),manually);assert.equal(r.rotationIntent,intent);
 }
});
test('boot has no tails and enlarges glow ten percent while warp keeps its original size range',()=>{
 const {r}=renderer(),home=r.cameraSnapshot();r.animateOpeningCamera(home,0,6500);
 for(const p of r.openingParticles.points)assert.ok(p.sizeScale>=1.65-1e-12&&p.sizeScale<=3.08);
 for(const time of [0,1000,3000,6000,7000]){const f=r.openingParticleFrame(time);for(const p of f.points)assert.equal(r.projectOpeningParticle(p,f,{}).tail,0);}
 r.animateOpeningReplay(home,r.openingCameraSnapshot(home),10000,6500);
 for(const p of r.openingParticles.points)assert.ok(p.sizeScale>=1&&p.sizeScale<=2);
});
