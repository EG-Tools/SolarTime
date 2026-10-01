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
 vm.runInNewContext(read('src/renderer.js'),sandbox);const R=window.SolarRenderer,r=Object.create(R.prototype);
 Object.assign(r,{w:1280,h:800,fitScale:.25,presentationUntil:0,options:{pluto:true,moon:true,dollyZoom:false},camera:r.defaultCameraSnapshot(),cameraTween:null,autoRotation:null,pendingAutoRotation:null,rotationGeneration:0,bodyScales:{earth:5.05},actualScaleMix:0,clearLabels(){},surface:{invalidate(){},pause(){}},sky:{pause(){}},projected:[]});
 return {r,R,sandbox,now:value=>{now=value;}};
}
const ms=Date.parse('2026-09-19T12:00:00Z');
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
test('opening uses a different random departure without changing its destination',()=>{
 const {r}=renderer(),target=r.defaultCameraSnapshot(),a=r.openingCameraSnapshot(target,()=>.1),b=r.openingCameraSnapshot(target,()=>.9);
 assert.notEqual(a.azimuth,b.azimuth);assert.notEqual(a.elevation,b.elevation);
 for(const state of [a,b]){assert.equal(state.zoom,target.zoom);assert.equal(state.dolly,.001);assert.equal(state.focus,null);}
 assert.deepEqual(plain(target),plain(r.defaultCameraSnapshot()));
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
 r.projectionAnchor={x:0,y:0,z:0};r.lensStretch=1;
 for(const moonDepth of [-400,0,400]){
  let previous=0;
  for(const dolly of [1,2,4,6]){
   r.camera={...base,azimuth:0,elevation:0,focus:'earth',dolly};
   const moon=r.projectView({x:80,y:-moonDepth,z:0}),perspective=moon.perspective??1;
   const expected=dolly*5000/(5000-moonDepth*(dolly-1));
   const baseline=r.bodyRadiusForState(A.MOON,{...base,dolly:1}),visibleRadius=r.bodyRadiusAtZoom(A.MOON)*perspective;
   close(visibleRadius/baseline,expected);assert.ok(visibleRadius>previous);previous=visibleRadius;
   if(moonDepth===0)close(visibleRadius/r.bodyRadiusAtZoom(earth),baseline/r.bodyRadiusForState(earth,base));
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
  r.frameItems=new Map([[targetId,{world,frameSerial:1}]]);r.frameSerial=1;r.fitScale=.25;r.lensStretch=1.6;
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
 close(r.cameraTween.duration,7000);
 for(let mono=0;mono<7000;mono+=10){
  r.advanceCamera(mono);const move=r.cameraTween,p=move.progress;
  close((r.camera.dolly-move.from.dolly)/(move.to.dolly-move.from.dolly),p);
  assert.ok(r.camera.dolly>=previous);previous=r.camera.dolly;
 }
 r.advanceCamera(7000);assert.equal(r.cameraTween,null);close(r.camera.dolly,target.dolly);
 close(r.openingLabelOpacity(6750),.5);assert.equal(r.openingLabelOpacity(7500),1);
});

test('opening duration follows arrival coverage and annotations follow its actual end',()=>{
 const {r}=renderer(),base=r.defaultCameraSnapshot(),body=A.BODIES.find(body=>body.id==='earth');
 const radius=r.bodyRadiusForState(body,base);
 assert.equal(r.openingCameraDuration(base),5000);
 for(const [coverage,duration] of [[.02,5000],[.1,5000],[.2,6000],[.3,7000],[.5,7000],[3,7000]]){
  const target={...base,focus:'earth',dolly:coverage*r.h/(2*radius)};
  close(r.openingCameraDuration(target),duration);
  r.restoreCamera(r.openingCameraSnapshot(target,()=>.3));r.animateOpeningCamera(target,100);
  close(r.cameraTween.duration,duration);r.advanceCamera(100+duration-1);assert.ok(r.cameraTween);
  r.advanceCamera(100+duration);assert.equal(r.cameraTween,null);close(r.camera.dolly,target.dolly);
  assert.equal(r.openingLabelOpacity(100+duration-1000),0);close(r.openingLabelOpacity(100+duration-250),.5);assert.equal(r.openingOrbitOpacity(100+duration),1);
  assert.ok(r.presentationUntil>=100+duration+1500,'a paused scene keeps rendering through the staggered name fade');
 }
});

test('opening duration drives orbit drawing first, then names, including a custom 10s opening',()=>{
 const {r}=renderer();
 for(const duration of [5000,7000,10000])for(const target of [r.defaultCameraSnapshot(),r.trackingMoveState('earth')]){
  r.restoreCamera(r.openingCameraSnapshot(target));r.animateOpeningCamera(target,250,duration);
  assert.equal(r.cameraTween.duration,duration);assert.equal(r.openingParticles.duration,duration);
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

test('opening particles use one bounded pool with no arrival spawns or layout reassignment',()=>{
 const {r}=renderer();
 for(const [width,quality,count] of [[1280,'auto',510],[390,'auto',318],[1280,'low',204]]){
  r.w=width;r.options.quality=quality;r.animateOpeningCamera(r.defaultCameraSnapshot(),0,5000);
  const points=r.openingParticles.points,snapshot=plain(points);
  assert.equal(points.length,count);
  assert.equal(new Set(points.map(p=>p.color)).size,4);
  assert.ok(points.every(p=>p.life>=1000&&p.life<5000&&p.glow>=.8&&p.glow<=2.6));
  assert.ok(new Set(points.map(p=>p.life)).size>count*.9);
  let previous=count;
  for(const time of [350,2500,4900,5000,5500]){
   const field=r.openingParticleFrame(time);
   const visible=points.filter(p=>r.projectOpeningParticle(p,field,{}).visible).length;
   assert.ok(visible<=previous,'grains only leave; none respawn');previous=visible;
   assert.equal(field.points,points);
   if(time<5000)assert.deepEqual(plain(points),snapshot,'positions and lifetimes are immutable');
   else assert.ok(points.every(p=>snapshot.some(q=>JSON.stringify(p)===JSON.stringify(q))),'arrival only removes particles, never repositions them');
  }
  assert.ok(previous>0&&previous<count*.2,'a few originally distant grains remain');
  assert.equal(r.openingParticleFrame(10000),null);
 }
});

test('extra departure grains increase early density but are all gone at deceleration',()=>{
 for(const seed of [.127694,.4,.81])for(const duration of [5000,7000]){
  const {r}=renderer(seed);r.animateOpeningCamera(r.defaultCameraSnapshot(),0,duration);
  const points=r.openingParticles.points,extras=points.slice(378);
  assert.equal(extras.length,132);
  const early=r.openingParticleFrame(duration*.07),visible=p=>r.projectOpeningParticle(p,early,{}).visible;
  assert.ok(extras.filter(visible).length>70,'more grains are visible early');
  assert.equal(points.filter(p=>p.depth>4).length,9,'the narrow corridor keeps the arrival sparse');
  for(const fraction of [.4,.7,1]){
   const frame=r.openingParticleFrame(duration*fraction);
   assert.ok(extras.every(p=>!r.projectOpeningParticle(p,frame,{}).visible),'extra grains have already passed, without a late fade or respawn');
  }
 }
});

test('the random opening path owns a fixed-width particle corridor and releases it after arrival',()=>{
 const {r}=renderer();r.animateOpeningCamera(r.defaultCameraSnapshot(),0,5000);
 const path=r.cameraTween.openingPath,field=r.openingParticles,points=path.points;
 assert.equal(field.path,path);assert.equal(field.points,points);
 assert.equal(path.from,r.cameraTween.from);assert.equal(path.to,r.cameraTween.to);
 for(const p of points)assert.ok(Math.hypot(p.x,p.y)>=.08&&Math.hypot(p.x,p.y)<=.6,'offset is bounded around the path, independently of depth');
 const sample=points[100],f={...r.openingParticleFrame(1200)},bent=r.projectOpeningParticle(sample,f,{});
 const straight=r.projectOpeningParticle(sample,{...f,path:{arc:null}},{});
 assert.ok(Math.hypot(bent.x-straight.x,bent.y-straight.y)>.01,'camera and particles consume the same parent bend');
 const expected=points.filter(p=>r.projectOpeningParticle(p,{...f,travel:1,velocity:0,progress:1,elapsed:5000,alpha:1},{}).visible);
 r.advanceCamera(5000);assert.equal(r.cameraTween,null);
 r.openingParticleFrame(5000);assert.equal(path.points,points);assert.deepEqual(points,expected);
 assert.ok(points.length>0&&points.length<=9);
 const removed=new Set(expected);r.camera.azimuth+=Math.PI;r.camera.zoom=250;
 r.openingParticleFrame(5500);assert.ok(points.every(p=>removed.has(p)),'rotating the camera cannot rediscover removed particles');
 // Even a still-live grain is removed permanently once it leaves the viewport.
 points[0].x=100;const outside=points[0];r.openingParticleFrame(5600);assert.ok(!points.includes(outside));
 r.openingParticleFrame(10000);assert.equal(points.length,0);assert.equal(r.openingParticles,null);
});

test('particle positions and slowdown follow the opening camera for 5, 7 and 10 seconds',()=>{
 const {r}=renderer();
 for(const duration of [5000,7000,10000]){
  r.animateOpeningCamera(r.defaultCameraSnapshot(),0,duration);
  close(r.openingParticleFrame(0).alpha,0);close(r.openingParticleFrame(duration*.07).alpha,1);
  let previous=2;
  for(const fraction of [.4,.6,.8,.95,.999]){
   const mono=duration*fraction;r.advanceCamera(mono);const f={...r.openingParticleFrame(mono)};
   close(f.travel,r.cameraTween.progress);
   assert.ok(f.velocity<=previous);previous=f.velocity;
   const a=r.openingParticleFrame(mono-.5).travel,b=r.openingParticleFrame(mono+.5).travel;
   close((b-a)*duration,f.velocity,1e-6);
  }
  const end=r.openingParticleFrame(duration);close(end.travel,1);close(end.velocity,0);
 }
});

test('remaining particles fade independently over 1–5 seconds, with no arrival snap',()=>{
 const {r}=renderer(),duration=7000;r.animateOpeningCamera(r.defaultCameraSnapshot(),0,duration);
 const field={...r.openingParticleFrame(duration)};
 const remaining=field.points.filter(p=>r.projectOpeningParticle(p,field,{}).visible);
 assert.ok(remaining.length>5);
 for(const p of remaining){
  const end=r.projectOpeningParticle(p,field,{}),before=r.projectOpeningParticle(p,{...field,elapsed:duration-1,travel:1},{});
  assert.ok(Math.hypot(end.x-before.x,end.y-before.y)<.001);
  const half=r.projectOpeningParticle(p,{...field,elapsed:duration+p.life/2},{});
  assert.ok(half.size>=end.size&&half.size<end.size*1.08);
  close(half.tail,0);close(half.alpha,end.alpha*.5);
  const gone=r.projectOpeningParticle(p,{...field,elapsed:duration+p.life},{});
  close(gone.alpha,0);assert.equal(gone.visible,false);
 }
 r.cancelCameraTween(duration+500);assert.equal(r.openingParticles.exitAt,null);
 assert.equal(r.openingParticleFrame(duration+5000),null);
});

test('particle projection is time-based, repeatable and independent of camera magnification',()=>{
 const {r}=renderer();r.animateOpeningCamera(r.defaultCameraSnapshot(),0,5000);
 const p=r.openingParticles.points[0],f={...r.openingParticleFrame(2000)},first=r.projectOpeningParticle(p,f,{});
 r.camera.zoom=250;r.camera.dolly=100;r.camera.panX=.3;
 assert.deepEqual(r.projectOpeningParticle(p,f,{}),first);
 for(const fps of [30,60,144]){
  for(let t=0;t<2000;t+=1000/fps)r.openingParticleFrame(t);
  assert.deepEqual(r.projectOpeningParticle(p,r.openingParticleFrame(2000),{}),first);
 }
 const grain={x:.1,y:.05,depth:3,size:3,glow:1.5,life:15000};
 const near=r.projectOpeningParticle(grain,{...f,travel:.5,velocity:1},{}),far=r.projectOpeningParticle(grain,{...f,travel:0,velocity:1},{});
 assert.ok(near.size>far.size);assert.ok(near.x>far.x);
 assert.equal(r.projectOpeningParticle(grain,{...f,travel:1},{}).visible,false);
});

test('opening dust exits softly on input, clears on suspend and respects reduced motion',()=>{
 const {r,sandbox}=renderer(),target=r.defaultCameraSnapshot();
 r.animateOpeningCamera(target,0,4000);const alpha=r.openingParticleFrame(1400).alpha;
 r.smoothDolly(2,null,1400);close(r.openingParticleFrame(1400).alpha,alpha);
 assert.ok(r.openingParticleFrame(1510).alpha<alpha);
 r.cancelCameraTween(1510);assert.equal(r.openingParticles.exitAt,1400);
 assert.equal(r.openingParticleFrame(1620),null);
 r.animateOpeningCamera(target,2000);r.suspend();assert.equal(r.openingParticles,null);
 sandbox.matchMedia=()=>({matches:true});r.animateOpeningCamera(target,3000);assert.equal(r.openingParticles,null);
});

test('one cached sprite draws all opening particles and releases activity after their lifetimes',()=>{
 const {r}=renderer(),calls=[];r.openingParticleSprite={};
 const c={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},drawImage(sprite,sx,sy,sw,sh,x,y,w,h){
  assert.equal(sprite,r.openingParticleSprite);assert.equal(sw,32);assert.equal(sh,32);assert.ok([0,32,64,96].includes(sx));
  calls.push([x,y,w,h,this.globalAlpha]);
 }};
 r.animateOpeningCamera(r.defaultCameraSnapshot(),0,5000);r.drawOpeningParticles(c,350);
 assert.ok(calls.length>450&&calls.length<=1020);assert.ok(calls.every(v=>v.every(Number.isFinite)));
 calls.length=0;r.drawOpeningParticles(c,5000);assert.ok(calls.length>0&&calls.length<216);
 calls.length=0;r.drawOpeningParticles(c,10000);assert.equal(calls.length,0);assert.equal(r.openingParticles,null);
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
   close(r.openingCameraDuration(target),7000);
  }
 }
});

test('actual mode keeps physical diameter ratios and moon proportions on the same distance scale',()=>{
 const {r,R}=renderer(),base=r.defaultCameraSnapshot(),bodies=[A.SUN,...A.BODIES,...A.SATELLITES];
 r.actualScaleMix=1;r.lensStretch=1.72;r.satelliteOrbitScales={sun:10,earth:9,jupiter:7};r.bodyScales.moon=8;
 for(const zoom of [.1,1,4,250])for(const dolly of [.002,1,12,1e6]){
  r.camera={...base,zoom,dolly};r.fitScale=r.actualScaleFit();r.scale=r.fitScale*zoom*dolly;r.bodyScale=r.bodyScaleAtZoom();
  for(const body of bodies){
   close(r.bodyRadiusAtZoom(body)/r.bodyRadiusAtZoom(A.SUN),A.BODY_RADIUS_KM[body.id]/A.BODY_RADIUS_KM.sun);
   close(r.bodyRadiusAtZoom(body)/r.scale,A.BODY_RADIUS_KM[body.id]/A.AU_KM*A.TRUE_SCALE_UNITS_PER_AU);
  }
  for(const body of A.BODIES){
   const p=A.positionAt(body,ms),world={};r.displayPhysicalPoint(p,world);
   const factor=r.displaySolarRadius(Math.hypot(p.x,p.y,p.z))/Math.hypot(p.x,p.y,p.z);
   for(const key of ['x','y','z'])close(world[key],p[key]*factor,1e-9);
  }
  for(const moon of A.SATELLITES){
   const parent=A.BODIES.find(body=>body.id===moon.parent),pr=r.bodyRadiusAtZoom(parent),mr=r.bodyRadiusAtZoom(moon);
   const orbit=r.satelliteOrbitRadius(pr,mr,moon,parent);
   close(orbit*r.scale/(2*pr),A.SATELLITE_MEAN_AU[moon.id]*A.AU_KM/(2*A.BODY_RADIUS_KM[parent.id]));
  }
  assert.equal(r.projectionLensStretch(),1);assert.equal(r.gpuOrbitCamera().lens,1);
 }
 for(const body of bodies){
  const to=r.trackingMoveState(body.id,base);assert.ok(R.validCamera(to));
  close(r.bodyRadiusForState(body,to),r.h*.25,1e-7);
 }
});

test('actual-scale transitions invalidate frame scale and restoring overview preserves user preferences',()=>{
 const {r,now}=renderer(),before=plain(r.bodyScales),state=r.cameraSnapshot();r.lensStretch=1.72;
 r.dirty=false;now(0);r.setOption('actualScale',true);r.dirty=false;r.advanceActualScale(1000);
 assert.equal(r.dirty,true);close(r.actualScaleMix,.5);close(r.projectionLensStretch(),1.36);
 r.advanceActualScale(2000);assert.equal(r.actualScaleMix,1);assert.equal(r.actualScaleTween,null);
 now(2000);r.setOption('actualScale',false);r.advanceActualScale(4000);
 assert.equal(r.actualScaleMix,0);assert.deepEqual(plain(r.bodyScales),before);assert.deepEqual(plain(r.cameraSnapshot()),plain(state));
 close(r.projectionLensStretch(),1.72);
});

test('true-scale close-ups do not inflate distant bodies with a minimum perspective multiplier',()=>{
 const {r}=renderer();r.actualScaleMix=1;r.lensStretch=1.72;r.projectionAnchor={x:0,y:0,z:0};
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
test('ordinary planet focus and Jupiter feature view do not inherit the country zoom',()=>{
 const {r}=renderer();r.animateFeature('jupiter',-22,70,ms,0,1000);assert.ok(r.cameraTween.to.zoom<=64);r.advanceCamera(1000);r.animateFocus('mars',1100,1000);assert.ok(r.cameraTween.to.zoom<=64);
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
   const parentRadius=r.bodyRadiusAtZoom(parent),satelliteRadius=r.bodyRadiusAtZoom(satellite);
   spacing.push(r.satelliteOrbitRadius(parentRadius,satelliteRadius,satellite,parent));
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
