'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const A=require('../src/astro.js');
function fixture(){
 const window={SolarAstro:A},created=[],gradients=[];
 const document={createElement(){const canvas={getContext:()=>({createRadialGradient:()=>{const stops=[];gradients.push(stops);return {addColorStop(offset,color){stops.push([offset,color]);}};},fillRect(){}})};created.push(canvas);return canvas;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),{window,document,performance:{now:()=>0}});
 const r=Object.create(window.SolarRenderer.prototype);Object.assign(r,{w:200,h:120,dpr:1,camera:{zoom:1,dolly:.001},presentationUntil:0,presentationDirty:false,openingPointReveal:null});
 const calls=[],c={globalAlpha:.4,fillStyle:'',save(){this.saved=this.globalAlpha;},restore(){this.globalAlpha=this.saved;},beginPath(){},rect(){},moveTo(){},arc(){},fill(){calls.push(['fill',this.globalAlpha,this.fillStyle]);},clip(rule){calls.push(['clip',rule]);},drawImage(...args){calls.push(['draw',this.globalAlpha,...args.slice(1)]);}};
 return {r,c,calls,created,gradients};
}
const item=(id='earth',r=.01,z=0)=>({body:{id,color:'#4499ff'},r,screen:{x:100,y:60,z,behind:false}});

test('retreat and opening never reverse parent-child depth or point occlusion',()=>{
 const {r,c,calls}=fixture();
 Object.assign(r,{cx:100,cy:60,scale:.25,overviewFitScale:.25,fitScale:.25,options:{overviewOrbitGap:100},bodyScales:{},satelliteOrbitScales:{sun:.01,earth:.01,jupiter:.01}});
 for(const [parent,child] of [[A.SUN,A.BODIES[0]],...A.SATELLITES.map(s=>[A.BODIES.find(b=>b.id===s.parent),s])]){
  for(const dolly of [.001,.1,.99,1,1.01,2])for(const side of [-1,1]){
   r.camera={azimuth:0,elevation:0,zoom:1,dolly};r.scale=r.fitScale*dolly;
   const radius=r.localOrbitRadius(parent,child,0)/r.scale;
   const p=item(child.id,.1),host=item(parent.id,12);
   p.screen=r.project({x:0,y:side*radius,z:0});host.screen=r.project({x:0,y:0,z:0});
   assert.equal(Math.sign(r.bodyDepthOrder(p,host)),-side,`${parent.id}/${child.id}, dolly=${dolly}: physical depth order`);
   calls.length=0;r.drawBodyPoint(c,p,[host]);
   assert.equal(calls.some(call=>call[0]==='clip'),side===1,`${parent.id}/${child.id}, dolly=${dolly}: rear points are masked, front points remain visible`);
  }
 }
});
test('all bodies approach their size floor smoothly and fade only behind a larger disc',()=>{
 const {r}=fixture();
 for(const id of ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon','europa','pluto']){
  const body={id},floor=r.bodyPointLod(body,Number.MIN_VALUE);let previous=floor,previousDelta=0;
  assert.ok(floor.size>0&&floor.alpha>0);
  for(let radius=.001;radius<=20;radius+=.01){
   const point=r.bodyPointLod(body,radius),delta=point.size-previous.size;
   assert.ok(delta>=0,'zooming in must never shrink any body marker');
   assert.ok(Math.abs(delta-previousDelta)<.001,'size slope must remain smooth');
   assert.ok(point.alpha>=0&&point.alpha<=1);
   if(point.alpha<previous.alpha-1e-10)assert.ok(radius*2>=point.size*3.6,'surface covers the entire halo before fade');
   previous=point;previousDelta=delta;
  }
  assert.equal(previous.alpha,0,'large resolved bodies no longer draw a point');
  for(const radius of [-1,0,NaN,Infinity])assert.equal(r.bodyPointLod(body,radius).alpha,0);
 }
 for(const radius of [.0001,.1,1,5])assert.deepEqual(r.bodyPointLod({id:'moon'},radius),r.bodyPointLod({id:'europa'},radius));
 const before=r.bodyPointLod({id:'earth'},.2);r.camera={zoom:2048,dolly:1e8};r.dpr=3;
 assert.deepEqual(r.bodyPointLod({id:'earth'},.2),before,'appearance is in CSS pixels');
});

test('distant bodies settle into the approved background-star size hierarchy',()=>{
 const {r}=fixture();
 const projected={sun:.00001,jupiter:.00001,saturn:.00001,neptune:.00001,uranus:.00001,earth:.00001,moon:.00001,europa:.00001,pluto:.00001};
 const point=Object.fromEntries(Object.entries(projected).map(([id,radius])=>[id,r.bodyPointLod({id},radius).size]));
 assert.ok(point.sun>point.jupiter&&point.jupiter>point.earth&&point.earth>point.moon);
 assert.ok(Math.abs(point.sun*3.6-10.08)<1e-10,'the far true-scale Sun retains the full established point footprint');
 assert.ok(Math.abs(point.jupiter*3.6-4.68)<1e-10);assert.ok(Math.abs(point.earth*3.6-3.78)<1e-10);assert.ok(Math.abs(point.moon*3.6-3.06)<1e-10);
 for(const id of ['saturn','uranus','neptune'])assert.equal(point[id],point.jupiter);
 assert.equal(point.moon,point.europa,'major moons share the level-1 point size');assert.equal(point.pluto,point.moon,'Pluto shares level 1 with the satellites');
});
test('point rendering shares the projected position and parent alpha, without mutating the body',()=>{
 const {r,c,calls,created}=fixture(),p=item(),before=JSON.stringify(p);
 assert.equal(r.drawBodyPoint(c,p),true);const draw=calls[0];
 assert.equal(draw[0],'draw');assert.ok(draw[1]>.0&&draw[1]<=.4);
 assert.equal(draw[2]+draw[4]/2,p.screen.x);assert.equal(draw[3]+draw[5]/2,p.screen.y);
 assert.deepEqual(calls[1],['fill',.4*r.bodyPointLod(p.body,p.r).alpha,p.body.color],'unresolved planet core shares the continuous LOD alpha');
 assert.equal(c.globalAlpha,.4);assert.equal(JSON.stringify(p),before);
 for(let i=0;i<100;i++)r.drawBodyPoint(c,p);assert.equal(created.length,1);
 p.screen.behind=true;assert.equal(r.drawBodyPoint(c,p),false);
 p.screen.behind=false;p.screen.x=Infinity;assert.equal(r.drawBodyPoint(c,p),false);
});
test('the far Sun keeps the approved footprint and reads as warm gold instead of white',()=>{
 const {r,c,gradients}=fixture(),sun=item('sun',.00001);sun.body.color=A.SUN.color;
 assert.equal(r.drawBodyPoint(c,sun),true);
 assert.ok(Math.abs(r.bodyPointLod(sun.body,sun.r).size*3.6-10.08)<1e-10,'the approved golden footprint stays unchanged');
 assert.deepEqual(gradients[0].slice(0,2),[[0,'rgba(255,226,150,.98)'],[.12,'rgba(255,190,83,.95)']]);
 assert.ok(gradients[0].every(([,color])=>!color.includes('255,255,255')),'the Sun sprite has no neutral-white centre');
});
test('small bodies expose their default-view textures and keep dimmer particle floors',()=>{
 const {r,c,calls}=fixture();
 for(const id of ['moon','europa','pluto']){
  assert.equal(r.bodyPointLod({id},2.25).alpha,0,'default-size texture is not covered by a solid particle core');
  calls.length=0;r.drawBodyPoint(c,item(id,.001));
  assert.ok(Math.abs(calls.find(row=>row[0]==='fill')[1]-.4*.8)<1e-10);
  let previous=1;for(let radius=1.9;radius<2.3;radius+=.001){const alpha=r.bodyPointLod({id},radius).alpha;assert.ok(alpha<=previous);assert.ok(previous-alpha<.02);previous=alpha;}
 }
});

test('unresolved planets merge into gold smoothly without dimming separated or resolved bodies',()=>{
 const {r}=fixture(),sun=item('sun',.001),planet=item('jupiter',.001);
 assert.ok(r.bodyPointSeparation(planet,[sun])<.001);
 assert.equal(r.bodyPointSeparation(sun,[planet]),1);
 let previous=0;
 for(let distance=0;distance<12;distance+=.05){planet.screen.x=sun.screen.x+distance;const alpha=r.bodyPointSeparation(planet,[sun]);assert.ok(alpha>=previous-1e-12);assert.ok(alpha-previous<.03);previous=alpha;}
 assert.equal(previous,1);
 planet.screen.x=sun.screen.x;planet.r=1;assert.equal(r.bodyPointSeparation(planet,[sun]),1);
 planet.r=.001;sun.screen.behind=true;assert.equal(r.bodyPointSeparation(planet,[sun]),1);
 sun.screen.behind=false;sun.r=30;assert.equal(r.bodyPointSeparation(planet,[sun]),1);
});

test('opening boarding owns a copied return target and preserves its live tween',()=>{
 const {r}=fixture(),target={azimuth:1,dolly:2};assert.equal(r.prepareOpeningBoarding(target),false);
 const tween={duration:2000,rotationBlend:{},replay:{}};r.cameraTween=tween;r.openingFlight={};r.openingParticles={replay:{},exitAt:null};
 assert.equal(r.prepareOpeningBoarding(target),true);target.dolly=3;
 assert.equal(r.cameraTween,tween);assert.equal(tween.duration,2000);assert.equal(tween.ringReturnTarget.dolly,2);assert.equal(tween.flyThrough,true);
 assert.equal(r.openingParticles.awaitingSaturn,true);assert.equal(r.openingFlight,null);assert.equal(tween.rotationBlend,null);
});

test('the approved golden Sun is an absolute point floor at any retreat distance',()=>{
 const {r,c,calls}=fixture(),body={id:'sun',color:A.SUN.color};
 for(const radius of [1e-4,1e-8,1e-40,Number.MIN_VALUE]){
  const point=r.bodyPointLod(body,radius);
  assert.ok(Math.abs(point.size-2.8)<1e-9);assert.equal(point.alpha,1,'retreat cannot make the minimum footprint visually thinner');
 }
 const sun=item('sun',Number.MIN_VALUE);sun.body.color=A.SUN.color;r.drawBodyPoint(c,sun);
 const draw=calls.find(call=>call[0]==='draw');
 assert.ok(Math.abs(draw[4]-10.08)<1e-10);assert.ok(Math.abs(draw[5]-10.08)<1e-10,'the final canvas footprint stays at the captured minimum');
});
test('opening and warp arrival fade the distant point presentation without fading planet surfaces',()=>{
 const {r,c,calls}=fixture(),p=item();
 assert.equal(r.drawBodyPoint(c,p,[],.25),true);
 assert.equal(calls[0][0],'draw');assert.ok(calls[0][1]>0&&calls[0][1]<.1);
 assert.deepEqual(calls[1],['fill',.1*r.bodyPointLod(p.body,p.r).alpha,p.body.color]);
 assert.equal(c.globalAlpha,.4);
 assert.equal(r.drawBodyPoint(c,p,[],0),false);
});
test('a pointified opening begins transparent and reaches full alpha over 1.5 seconds',()=>{
 const {r}=fixture();r.startOpeningPointReveal(1000);
 assert.equal(r.openingPointOpacity(1000,1),0);
 const middle=r.openingPointOpacity(1600,1);assert.ok(middle>0&&middle<1);
 assert.ok(r.openingPointOpacity(2200,1)<1);
 assert.equal(r.openingPointOpacity(2500,1),1);assert.equal(r.openingPointReveal,null);
 assert.equal(r.openingPointOpacity(2600,.4),.4,'ordinary scene opacity remains the upper bound');
});
test('boot arms point opacity before both the warm-up and visible opening frames',()=>{
 const source=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
 assert.match(source,/renderer\.sky\?\.ready&&surfacesReady/,'opening prepares bounded arrival maps before bodies become resolved');
 assert.match(source,/bootMono=performance\.now\(\),bootMs=clock\.value\(bootMono\);if\(openingRunMode!==['"]none['"]\)renderer\.startOpeningPointReveal\(bootMono\);renderer\.draw/);
 assert.match(source,/if\(openingActive\)\{\s*if\(openingRunMode!==['"]none['"]\)renderer\.startOpeningPointReveal\(revealMono\);\s*renderer\.startOrbitReveal/);
});
test('overlapping foreground discs clip independently; background discs do not hide points',()=>{
 const {r,c,calls}=fixture(),p=item(),front=item('saturn',20,1),second=item('jupiter',30,2),back=item('sun',40,-1);
 r.drawBodyPoint(c,p,[p,front,second,back]);
 assert.deepEqual(calls.slice(0,2),[['clip','evenodd'],['clip','evenodd']]);assert.equal(calls[2][0],'draw');
});
test('actual-size travel points use physical camera depth over handoff-corrected W for solid-body occlusion',()=>{
 const {r,c,calls}=fixture(),p=item('earth',.1,-5),front=item('saturn',20,-10),back=item('sun',30,10);
 p.screen.clipW=1;front.screen.clipW=2;back.screen.clipW=.5;
 p.screen.occlusionDepth=-10;front.screen.occlusionDepth=-2;back.screen.occlusionDepth=-20;
 r.drawBodyPoint(c,p,[front,back]);
 assert.deepEqual(calls[0],['clip','evenodd'],'the nearer solid clips the point even when corrected W and display Z say otherwise');
 assert.equal(calls[1][0],'draw');
});
test('GPU travel bodies use physical camera depth before corrected W for far-to-near compositing',()=>{
 const {r}=fixture(),far=item('earth',.1,20),middle=item('saturn',20,0),near=item('jupiter',.1,-20);
 far.screen.clipW=.5;middle.screen.clipW=8;near.screen.clipW=4;
 far.screen.occlusionDepth=-20;middle.screen.occlusionDepth=-10;near.screen.occlusionDepth=-2;
 const ordered=[near,far,middle].sort((a,b)=>r.bodyDepthOrder(a,b));
 assert.deepEqual(ordered.map(value=>value.body.id),['earth','saturn','jupiter']);
 delete far.screen.occlusionDepth;delete middle.screen.occlusionDepth;delete near.screen.occlusionDepth;
 assert.deepEqual([near,far,middle].sort((a,b)=>r.bodyDepthOrder(a,b)).map(value=>value.body.id),['saturn','jupiter','earth']);
 delete far.screen.clipW;delete middle.screen.clipW;delete near.screen.clipW;
 assert.deepEqual([near,far,middle].sort((a,b)=>r.bodyDepthOrder(a,b)).map(value=>value.body.id),['jupiter','saturn','earth']);
});

test('travel point occlusion shares the raycast sphere silhouette even outside its centre circle',()=>{
 const {r,c,calls}=fixture(),p=item('sun',.1,-100),saturn=item('saturn',10,-2);
 r.ringTour={job:{id:'saturn'},pose:{fov:72,perspective:1,orthoScale:2,offset:[0,0],eye:[1.25,0,-1.6],right:[1,0,0],up:[0,1,0],forward:[0,0,1]}};
 p.screen.occlusionDepth=-100;saturn.screen.occlusionDepth=-1.6;
 saturn.screen.x=-30;saturn.screen.behind=true;
 c.ellipse=(...args)=>calls.push(['ellipse',...args]);
 r.drawBodyPoint(c,p,[saturn]);
 assert.equal(calls[0][0],'ellipse','the projected centre and visibility flag do not bound the near sphere limb');
 assert.deepEqual(calls[1],['clip','evenodd']);assert.equal(calls[2][0],'draw');
 calls.length=0;p.screen.occlusionDepth=-.1;
 r.drawBodyPoint(c,p,[saturn]);assert.equal(calls[0][0],'draw','foreground point stays visible');
});


test('point core and integrated halo light stay continuous at the 1px boundary',()=>{
 const samples=[.5001,.5,.4999].map(radius=>{
  const {r,c,calls}=fixture();r.drawBodyPoint(c,item('earth',radius));
  const draw=calls.find(call=>call[0]==='draw'),core=calls.find(call=>call[0]==='fill');
  assert.ok(core,'the core must fade in before crossing the boundary');
  return {core:core[1],light:draw[1]*draw[4]*draw[5]};
 });
 for(let i=1;i<samples.length;i++){
  assert.ok(Math.abs(samples[i].core-samples[i-1].core)<.001);
  assert.ok(Math.abs(samples[i].light-samples[i-1].light)<.002);
 }
 const {r,c,calls}=fixture();let previous=Infinity;
 for(let radius=.99;radius>=.1;radius-=.01){
  calls.length=0;r.drawBodyPoint(c,item('earth',radius));const d=calls.find(call=>call[0]==='draw'),light=d[1]*d[4]*d[5];
  assert.ok(light<=previous,'retreat must not increase light into a flash');previous=light;
 }
});

test('distant Sun retains visible halo opacity across further retreat without a handoff flash',()=>{
 const {r,c,calls}=fixture();
 for(const radius of [.1,.029,1e-8,Number.MIN_VALUE]){
  calls.length=0;r.drawBodyPoint(c,item('sun',radius));
  const draw=calls.find(call=>call[0]==='draw');
  assert.ok(Math.abs(draw[1]-.36)<1e-10);
  assert.ok(Math.abs(draw[4]-10.08)<.001);
 }
 let previous;
 for(let radius=.501;radius>=.09;radius-=.001){
  calls.length=0;r.drawBodyPoint(c,item('sun',radius));
  const draw=calls.find(call=>call[0]==='draw');
  if(previous!==undefined)assert.ok(Math.abs(draw[1]-previous)<.002);
  previous=draw[1];
 }
});

test('Sun smoothly approaches its floor and hands over only to a larger disc',()=>{
 const {r,c,calls}=fixture();let previous=0,previousDelta=0;
 for(let radius=.001;radius<=20;radius+=.01){
  const p=r.bodyPointLod({id:'sun'},radius);
  assert.ok(p.size>=previous,'point size must grow monotonically');
  if(p.alpha<1)assert.ok(radius*2>=p.size*3.6,'disc covers even the growing halo before fade');
  if(previous){const delta=p.size-previous;assert.ok(Math.abs(delta-previousDelta)<.001);previousDelta=delta;}
  previous=p.size;
 }
 assert.equal(r.bodyPointLod({id:'sun'},20).alpha,0);
});

test('all body classes keep a visible light floor in normal and actual scale modes',()=>{
 const {r,c,calls}=fixture();
 for(const actualScale of [false,true])for(const body of [A.SUN,...A.BODIES,...A.SATELLITES]){
  r.options={actualScale,overviewOrbitGap:100};
  for(const radius of [Number.MIN_VALUE,.00005,.001,.03]){
   const p={...item(body.id,radius),body};calls.length=0;
   assert.equal(r.drawBodyPoint(c,p),true);
   const d=calls.find(call=>call[0]==='draw');
   const brightness=['moon','europa','pluto'].includes(body.id)?.8:1;
   assert.ok(Math.abs(d[1]-.36*brightness)<1e-10,body.id+' retains its approved marker brightness');
   assert.equal(r.bodyPointLod(body,radius).alpha,1);
  }
 }
});

test('bright point cores follow the shrinking disc instead of collapsing to a half pixel',()=>{
 const {r,c,calls}=fixture();const arcs=[];c.arc=(x,y,radius)=>arcs.push(radius);
 for(const id of ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon','europa','pluto']){
  let previous=Infinity;
  for(let radius=20;radius>.001;radius-=.01){
   const point=r.bodyPointLod({id},radius);
   assert.ok(point.coreRadius<=previous,'core shrinks continuously with the disc');
   if(point.alpha>0&&point.alpha<1)assert.ok(point.coreRadius>=radius*.75&&point.coreRadius<=radius,'core matches the disc throughout the crossfade');
   previous=point.coreRadius;
  }
  arcs.length=0;r.drawBodyPoint(c,item(id,1));assert.ok(arcs[0]>.8,'final drawing must use the graduated core, not the old 0.5px cap');
  assert.ok(r.bodyPointLod({id},Number.MIN_VALUE).coreRadius<=.5,'approved distant core remains small');
 }
});

test('point lighting gradually reveals phase while distant markers and the Sun stay readable',()=>{
 const {r,c,calls}=fixture();
 const alpha=(id,radius,z)=>{calls.length=0;r.drawBodyPoint(c,{...item(id,radius),directJob:{light:[0,0,z]}});return calls.find(x=>x[0]==='fill')?.[1]||0;};
 for(const id of ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon','europa','pluto']){
  assert.equal(alpha(id,.001,-1),alpha(id,.001,1));
  let previous=alpha(id,.001,-1);
  for(let radius=.002;radius<=2;radius+=.002){const current=alpha(id,radius,-1);assert.ok(current<=previous+1e-9);assert.ok(previous-current<.01);previous=current;}
  assert.ok(alpha(id,.75,-1)<alpha(id,.75,1)*.2,'night-side lighting must apply before the surface resolves: '+id);
  assert.ok(alpha(id,1.5,-1)<alpha(id,1.5,1)*.6);
 }
 for(const radius of [.001,1,4])assert.equal(alpha('sun',radius,-1),alpha('sun',radius,1),'emissive Sun ignores reflected-light phase');
});
