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
test('projected radius alone drives the continuous point-to-disc transition',()=>{
 const {r}=fixture();
 const ids=['sun','earth','saturn','moon','europa','pluto'];
 const radii=[.00001,.001,.01,.1,1,2.2];
 for(const radius of radii){
  const reference=r.bodyPointLod({id:ids[0]},radius);
  for(const id of ids.slice(1))assert.deepEqual(r.bodyPointLod({id},radius),reference,`${id} must use the same projected-radius curve`);
 }
 let previousSize=0;
 for(const radius of radii){const point=r.bodyPointLod({id:'earth'},radius);assert.ok(point.size>previousSize);previousSize=point.size;}
 for(const id of ['sun','earth','saturn','moon','europa','pluto']){
  const body={id};let previous=r.bodyPointLod(body,2.2).alpha;
  for(let radius=2.201;radius<=5.201;radius+=.001){
   const point=r.bodyPointLod(body,radius);assert.ok(point.alpha>=0&&point.alpha<=previous+1e-10);assert.ok(previous-point.alpha<.001);previous=point.alpha;
  }
  assert.equal(r.bodyPointLod(body,5.2).alpha,0);
  const far=r.bodyPointLod(body,.00001);assert.ok(far.size>0&&far.alpha>0);assert.ok(far.size<2);
  for(const radius of [-1,0,NaN,Infinity])assert.equal(r.bodyPointLod(body,radius).alpha,0);
 }
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
 assert.deepEqual(calls[1],['fill',.4,p.body.color],'unresolved planet core inherits only the parent layer alpha');
 assert.equal(c.globalAlpha,.4);assert.equal(JSON.stringify(p),before);
 for(let i=0;i<100;i++)r.drawBodyPoint(c,p);assert.equal(created.length,1);
 p.screen.behind=true;assert.equal(r.drawBodyPoint(c,p),false);
 p.screen.behind=false;p.screen.x=Infinity;assert.equal(r.drawBodyPoint(c,p),false);
});
test('opening and warp arrival fade the distant point presentation without fading planet surfaces',()=>{
 const {r,c,calls}=fixture(),p=item();
 assert.equal(r.drawBodyPoint(c,p,[],.25),true);
 assert.equal(calls[0][0],'draw');assert.ok(calls[0][1]>0&&calls[0][1]<.1);
 assert.deepEqual(calls[1],['fill',.1,p.body.color]);
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
 assert.match(source,/renderer\.sky\?\.ready&&\(openingRunMode!==['"]none['"]\|\|surfacesReady\)/,'point openings must not wait for unused planet textures');
 assert.match(source,/bootMono=performance\.now\(\),bootMs=clock\.value\(bootMono\);if\(openingRunMode!==['"]none['"]\)renderer\.startOpeningPointReveal\(bootMono\);renderer\.draw/);
 assert.match(source,/revealMono=performance\.now\(\);if\(openingRunMode!==['"]none['"]\)renderer\.startOpeningPointReveal\(revealMono\);renderer\.startOrbitReveal/);
});
test('overlapping foreground discs clip independently; background discs do not hide points',()=>{
 const {r,c,calls}=fixture(),p=item(),front=item('saturn',20,1),second=item('jupiter',30,2),back=item('sun',40,-1);
 r.drawBodyPoint(c,p,[p,front,second,back]);
 assert.deepEqual(calls.slice(0,2),[['clip','evenodd'],['clip','evenodd']]);assert.equal(calls[2][0],'draw');
});
