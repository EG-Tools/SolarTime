'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/visual-effects.js'),'utf8');
function api(extra={}){const window={...extra};vm.runInNewContext(source,{window});return window.SolarVisualEffects;}
test('warm star shares drop 30 percent; the freed probability is shared equally by white and blue',()=>{
 const effects=api(),colors=[[1,.80,.74],[1,.93,.79],[.985,.99,1],[.77,.88,1]],counts=[0,0,0,0],n=100000;
 for(let i=0;i<n;i++){const color=effects.starColor((i+.5)/n),index=colors.findIndex(c=>c.every((v,k)=>v===color[k]));assert.ok(index>=0);counts[index]++;}
 assert.deepEqual(counts,[4900,2100,73500,19500]);
 assert.ok(Math.abs(counts[0]/7000-.7)<1e-12);assert.ok(Math.abs(counts[1]/3000-.7)<1e-12);
 assert.equal(counts[2]-72000,counts[3]-18000);
 const glsl=effects.starShaderSources('highp').fragment;
 for(const v of Object.values(effects.STAR_PALETTE))assert.ok(glsl.includes('tone'+(v===effects.STAR_PALETTE.blueStart?'>':'<')+v),String(v));
});
test('tiny-star pixel coverage conserves integrated light over two-dimensional subpixel movement',()=>{
 const effects=api();
 for(const ratio of [.5,.75,1,1.25,1.5,2,3])for(const size of [.1148,.3,.4,.5499]){
  const m=effects.tinyStarMetrics(size,ratio);
  for(const fx of [0,.125,.25,.499,.5,.75,.999])for(const fy of [0,.25,.5,.9]){
   let sum=0;const extent=Math.ceil(m.radius)+2;
   for(let y=-extent;y<=extent;y++)for(let x=-extent;x<=extent;x++)sum+=effects.tinyStarCoverage(x+.5-fx,y+.5-fy,size,ratio);
   assert.ok(Math.abs(sum/m.energy-1)<1e-11,JSON.stringify({ratio,size,fx,fy,sum,energy:m.energy}));
  }
 }
});
test('tiny point sprites have enough integer-sized support for the whole pixel-area filter',()=>{
 const effects=api();
 for(let i=0;i<100;i++)for(const ratio of [.5,.75,1,1.5,2,3]){
  const m=effects.tinyStarMetrics(.1148+i/100*.4351,ratio);
  assert.equal(m.pixels,Math.ceil(m.point));assert.ok(2*m.radius+1<=m.pixels+1e-12);assert.ok(m.point>=3);
 }
});
test('tiny stars bypass animation and alpha cutoff without removing large-star animation',()=>{
 const effects=api();
 for(const precision of ['highp','mediump']){
  const s=effects.starShaderSources(precision),tiny=s.fragment.slice(s.fragment.indexOf('if(tinyStar>.5)'),s.fragment.indexOf('vec2 q=gl_PointCoord'));
  assert.ok(s.vertex.startsWith('precision highp float;'));
  assert.ok(s.vertex.includes('if(tinyStar>.5){intensity=appearance.y;flarePulse=0.;}'));
  assert.ok(tiny.includes('covered.x*covered.y'));assert.doesNotMatch(tiny,/if\(alpha|discard;|sin\(/);
  assert.match(s.vertex,/twinklePeriod=mix\(5\.0,25\.0/);assert.match(s.fragment,/cross\*\.58\*flarePulse/);
 }
});
test('compatibility sprite cache is bounded and restores the caller alpha',()=>{
 const created=[];const document={createElement(){const canvas={width:0,height:0,getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}};created.push(canvas);return canvas;}};
 const effects=api({document}),calls=[],ctx={globalAlpha:.8,drawImage(...a){calls.push([this.globalAlpha,...a]);}};
 effects.drawTinyStar(ctx,10.125,20.75,.3,.5,1,1);assert.equal(ctx.globalAlpha,.8);assert.equal(calls[0][0],.4);
 effects.drawTinyStar(ctx,11.25,21.75,.3,.5,1,1);assert.equal(created.length,1,'moving stars reuse their filtered sprite');
 const unchanged=calls.length;effects.drawTinyStar(ctx,0,0,.3,0,1,1);assert.equal(calls.length,unchanged);
 // Exhaust the cache with more than 96 distinct native sizes, then request the first key.
 for(let i=0;i<110;i++)effects.drawTinyStar(ctx,0,0,.3,.5,1,1+i/10);
 effects.drawTinyStar(ctx,0,0,.3,.5,1,1);assert.equal(ctx.globalAlpha,.8);
});
