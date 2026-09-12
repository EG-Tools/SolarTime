'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const A=require('../src/astro.js');
const sandbox={window:{SolarAstro:A},performance:{now:()=>0}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),sandbox);
const Renderer=sandbox.window.SolarRenderer;
function harness() {
  const r=Object.create(Renderer.prototype);
  Object.assign(r,{w:1000,h:800,options:{avoidLabels:true},labelStates:new Map(),lastLabelMono:null,hitTargets:[],selected:null});
  const c={letterSpacing:'',measureText:t=>({width:t.length*7}),beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(t,x,y){this.drawn.push({t,x,y});},drawn:[]};
  return {r,c,step(bodies,t){r.hitTargets=[];c.drawn=[];r.labels(c,bodies,t);return r.hitTargets.map(b=>({...b}));}};
}
const body=b=>({body:b,screen:{x:200,y:200,z:0},r:16});
const blocker=(x=500,y=236)=>({body:{id:'obstacle'},screen:{x,y,z:1},r:14});
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('Sun, Moon and every planet use the SAME smooth avoidance path',()=>{
 for(const b of [A.SUN,...A.BODIES,A.MOON]) {
  const h=harness(),p=body(b),o=blocker();h.step([p,o],0);
  const before=h.r.labelStates.get(b.id).dy;
  o.screen.x=200;let previous=before,changed=false,largestStep=0;
  for(let t=16;t<=1408;t+=16) {
   h.step([p,o],t);const current=h.r.labelStates.get(b.id).dy;
   largestStep=Math.max(largestStep,Math.abs(current-previous));changed ||= current!==before;previous=current;
  }
  assert.ok(changed,b.id);assert.ok(largestStep<8,`${b.id}: ${largestStep}px discontinuity`);
  assert.notEqual(h.r.labelStates.get(b.id).slot,0,b.id);
 }
});
test('Brief boundary collisions do not repeatedly flip candidate slots',()=>{
 const h=harness(),p=body(A.BODIES[2]),o=blocker();h.step([p,o],0);
 for(let t=20;t<=2000;t+=20) {o.screen.x=t%200<100?200:500;h.step([p,o],t);}
 assert.equal(h.r.labelStates.get('earth').slot,0);
});
test('Depth sorting and reversed caller order do not change label placement',()=>{
 const a=harness(),b=harness();
 const items=[body(A.SUN),{...body(A.BODIES[2]),screen:{x:245,y:235,z:2}}, {...body(A.MOON),screen:{x:255,y:248,z:3}}];
 for(let t=0;t<=1000;t+=20) {
  const one=a.step(items,t),two=b.step([...items].reverse(),t);
  assert.deepEqual(one,two);
 }
});
test('Planet movement is followed immediately; only avoidance offsets are eased',()=>{
 const h=harness(),p=body(A.BODIES[4]);const initial=h.step([p],0)[0];
 p.screen.x+=100;p.screen.y+=30;const moved=h.step([p],16)[0];
 near(moved.x-initial.x,100);near(moved.y-initial.y,30);
});
test('Visible text, connector destination and hit boxes use the interpolated position',()=>{
 const h=harness(),p=body(A.BODIES[2]),o=blocker();h.step([p,o],0);o.screen.x=200;
 for(let t=20;t<=280;t+=20) {
  const [box]=h.step([p,o],t),draw=h.c.drawn[0];
  near(box.x+box.w/2,draw.x);near(box.y,draw.y);
  assert.equal(h.r.hit(draw.x,draw.y+4),'earth');
 }
});
test('Label easing is independent of frame rate',()=>{
 const run=step=>{
  const h=harness(),p=body(A.BODIES[3]),o=blocker();h.step([p,o],0);o.screen.x=200;
  // Same request and switch times, different sampling intervals after the switch.
  h.step([p,o],20);h.step([p,o],160);
  for(let t=160+step;t<=560;t+=step)h.step([p,o],t);
  return h.r.labelStates.get('mars');
 };
 const a=run(10),b=run(20);near(a.dy,b.dy);near(a.dx,b.dx);
});
test('Hidden and culled labels are pruned; the owner stays bounded',()=>{
 const h=harness(),items=[A.SUN,...A.BODIES,A.MOON].map((b,i)=>({...body(b),screen:{x:30+i*85,y:300,z:0}}));
 h.step(items,0);assert.equal(h.r.labelStates.size,11);
 h.step([items[0]],16);assert.equal(h.r.labelStates.size,1);assert.equal(h.r.labelStates.has('sun'),true);
 h.r.clearLabels();assert.equal(h.r.labelStates.size,0);assert.equal(h.r.lastLabelMono,null);
});
test('Returning from a long inactive interval does not jump to the avoidance target',()=>{
 const h=harness(),p=body(A.SUN),o=blocker();h.step([p,o],0);o.screen.x=200;h.step([p,o],20);
 const before=h.r.labelStates.get('sun').dy;h.step([p,o],60000);
 const after=h.r.labelStates.get('sun').dy;
 assert.ok(Math.abs(after-before)<20);assert.notEqual(before,after);
});
