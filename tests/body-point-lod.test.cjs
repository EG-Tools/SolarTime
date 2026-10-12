'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const A=require('../src/astro.js');
function fixture(){
 const window={SolarAstro:A},created=[];
 const document={createElement(){const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};created.push(canvas);return canvas;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),{window,document,performance:{now:()=>0}});
 const r=Object.create(window.SolarRenderer.prototype);Object.assign(r,{w:200,h:120,dpr:1,camera:{zoom:1,dolly:.001},presentationUntil:0,presentationDirty:false,openingPointReveal:null});
 const calls=[],c={globalAlpha:.4,fillStyle:'',save(){this.saved=this.globalAlpha;},restore(){this.globalAlpha=this.saved;},beginPath(){},rect(){},moveTo(){},arc(){},fill(){calls.push(['fill',this.globalAlpha,this.fillStyle]);},clip(rule){calls.push(['clip',rule]);},drawImage(...args){calls.push(['draw',this.globalAlpha,...args.slice(1)]);}};
 return {r,c,calls,created};
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
test('projected diameter alone drives the 1px point to 2px textured-disc transition',()=>{
 const {r}=fixture();
 const ids=['sun','earth','saturn','moon','europa','pluto'];
 const radii=[.00001,.001,.01,.1,.25,.5];
 for(const radius of radii){
  const reference=r.bodyPointLod({id:ids[0]},radius);
  for(const id of ids.slice(1))assert.deepEqual(r.bodyPointLod({id},radius),reference,`${id} must use the same projected-radius curve`);
 }
 let previousSize=0;
 for(const radius of radii){const point=r.bodyPointLod({id:'earth'},radius);assert.ok(point.size>previousSize);previousSize=point.size;}
 for(const id of ['sun','earth','saturn','moon','europa','pluto']){
  const body={id};let previous=r.bodyPointLod(body,.5).alpha;
  for(let radius=.501;radius<=1.001;radius+=.001){
   const point=r.bodyPointLod(body,radius);assert.ok(point.alpha>=0&&point.alpha<=previous+1e-10);assert.ok(previous-point.alpha<.004);previous=point.alpha;
  }
  assert.equal(r.bodyPointLod(body,1).alpha,0,'a 2px-diameter body is texture-only');
  const far=r.bodyPointLod(body,.00001);assert.ok(far.size>0&&far.alpha>0);assert.ok(far.size<2);
  for(const radius of [-1,0,NaN,Infinity])assert.equal(r.bodyPointLod(body,radius).alpha,0);
 }
 assert.equal(r.bodyPointLod({id:'earth'},1.01).alpha,0,'larger textured bodies never receive a point overlay');
 assert.equal(r.bodyPointLod({id:'earth'},.5).alpha,1,'a 1px-diameter body is fully pointified');
 assert.ok(r.bodyPointLod({id:'earth'},.99).alpha>0,'the 1px-to-2px diameter band crossfades continuously');
 const entering=r.bodyPointLod({id:'earth'},.99),middle=r.bodyPointLod({id:'earth'},.75),point=r.bodyPointLod({id:'earth'},.5);
 assert.ok(entering.size<middle.size&&middle.size<point.size,'the point halo grows continuously instead of appearing at full size');
 const before=r.bodyPointLod({id:'earth'},.2);r.camera={zoom:2048,dolly:1e8};r.dpr=3;
 assert.deepEqual(r.bodyPointLod({id:'earth'},.2),before);
});
test('distant bodies preserve projected-size order instead of switching to body-class ranks',()=>{
 const {r}=fixture();
 const projected={sun:.024102459,jupiter:.002401153,saturn:.002090016,neptune:.0009569,uranus:.000924};
 const point=Object.fromEntries(Object.entries(projected).map(([id,radius])=>[id,r.bodyPointLod({id},radius).size]));
 assert.ok(point.sun>point.jupiter&&point.jupiter>point.saturn&&point.saturn>point.neptune&&point.neptune>point.uranus);
 assert.ok(point.jupiter/point.saturn<1.05,'near-sized giant planets should remain near-sized as points');
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
 const {r,c,calls}=fixture();let peak=0;
 for(let radius=.99;radius>=.1;radius-=.01){calls.length=0;r.drawBodyPoint(c,item('earth',radius));const d=calls.find(call=>call[0]==='draw');peak=Math.max(peak,d[1]*d[4]*d[5]);}
 assert.ok(peak<1.8,'halo footprint growth must not amplify the shrinking disc into a flash');
});
