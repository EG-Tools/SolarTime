'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/surface.js'),'utf8'),style=require('../src/surface-style.js');
function context(extra={}){const window={SolarSurfaceStyle:style},ctx={window,performance,setTimeout,clearTimeout,...extra};vm.createContext(ctx);vm.runInContext(source,ctx);return window.SolarSurface;}
const {CloudWeather}=context().kernel();

test('spherical weather is deterministic, seed-dependent and bounded to one 32 KiB map',()=>{
  const a=new CloudWeather(),b=new CloudWeather();a.update(.123,20000);b.update(.123,20000);
  assert.equal(a.map.data.byteLength,32768);assert.deepEqual(a.map.data,b.map.data);
  const original=a.map;a.update(.123,21000);assert.equal(a.map,original);assert.equal(a.builds,1);
  b.update(.789,20000);assert.notDeepEqual(a.map.data,b.map.data);assert.equal(b.builds,2);
  a.dispose();assert.equal(a.map,null);assert.equal(a.update(.9,22000),null);
});

test('noise joins at the longitude seam and remains constant at both poles',()=>{
  const weather=new CloudWeather();weather.update(.317,20000);
  for(const v of [.05,.2,.5,.85,.95])assert.ok(Math.abs(weather.coverage(.5,1-1e-7,v,.5)-weather.coverage(.5,1e-7,v,.5))<1e-5);
  for(const v of [0,1])for(let x=0;x<100;x++)assert.ok(Math.abs(weather.coverage(.5,x/100,v,.5)-weather.coverage(.5,0,v,.5))<1e-12);
});

test('both map start angles are random per seed, separated and stable during time travel',()=>{
  const weather=new CloudWeather(),angles=[new Set(),new Set()],fract=n=>n-Math.floor(n);
  const distance=(a,b)=>Math.abs(fract(a-b+.5)-.5);
  for(const seed of [.003,.217,.789,.991]){
    weather.update(seed,20000);const starts=Array.from(weather.startTurns),rates=Array.from(weather.rotationRates),builds=weather.builds;
    assert.ok(starts.every(n=>n>=0&&n<1));assert.ok(distance(...starts)>=1/12);
    starts.forEach((n,i)=>angles[i].add(n.toFixed(8)));
    for(const day of [20000,20000+5/24,21000,0,-20000,20000]){
      weather.update(seed,day);
      assert.deepEqual(Array.from(weather.startTurns),starts);assert.deepEqual(Array.from(weather.rotationRates),rates);
      assert.ok(distance(weather.state.drift[0],fract(starts[0]+day*(1-rates[0])))<1e-6);
      assert.ok(distance(fract(weather.state.drift[0]+weather.state.altOffset),fract(starts[1]+day*(1-rates[1])))<1e-6);
    }
    assert.equal(weather.builds,builds,'pause/reverse/LOD must never reroll the source angles');
  }
  assert.equal(angles[0].size,4);assert.equal(angles[1].size,4);weather.dispose();
});

test('whole cloud maps rotate at opposite 0.97/1.03 planet rates and reroll only on a new seed',()=>{
  const A=require('../src/astro.js'),earth=A.BODIES.find(body=>body.id==='earth'),spinDays=earth.spinSeconds/86400;
  const weather=new CloudWeather(),assignments=new Set(),fract=n=>n-Math.floor(n),signed=n=>fract(n+.5)-.5;
  const phases=day=>{const s=weather.update(weather.seed,day,null,spinDays);return [s.drift[0],fract(s.drift[0]+s.altOffset)];};
  for(const seed of [.003,.217,.789,.991]){
    weather.update(seed,20000,null,spinDays);const rates=Array.from(weather.rotationRates),builds=weather.builds;
    assert.deepEqual([...rates].sort(),[.97,1.03]);assignments.add(rates[0]);
    // Actual rotation model, including phase wrap, pause, reverse, coarse
    // seeks and fine playback reaching the same timestamp.
    const anchor=Date.UTC(2026,8,30),phaseWrap=anchor+(1-A.rotationAt(earth,anchor)/A.TAU)*spinDays*A.DAY-1000;
    for(const ms of [A.J2000-60000,phaseWrap,Date.UTC(2999,0,1)]){
      const day=ms/A.DAY,step=spinDays/48,initial=phases(day),next=phases(day+step);
      const planetStep=signed((A.rotationAt(earth,ms+step*A.DAY)-A.rotationAt(earth,ms))/A.TAU);
      for(let i=0;i<2;i++){
        const cloudStep=planetStep-signed(next[i]-initial[i]);
        assert.ok(Math.abs(cloudStep/planetStep-rates[i])<1e-5,`map ${i}: true world-space rate ${rates[i]}`);
      }
      assert.deepEqual(phases(day),initial,'reverse restores the same angles');
      assert.deepEqual(phases(day),initial,'paused rotation stays fixed');
      const target=day+5/24,direct=phases(target);
      for(let tick=0;tick<30;tick++)phases(day+tick/30*5/24);
      assert.deepEqual(phases(target),direct,'five-hour travel is independent of frame count');
    }
    const wrapDay=(1-weather.startTurns[0])/(1-rates[0])*spinDays;
    // Cloud-relative rotation must not inherit the astronomy model's yearly
    // reference recalibration: it uses one continuous, unwrapped day count.
    for(const boundary of [wrapDay,Date.UTC(2027,0,1)/A.DAY]){
      const before=phases(boundary-1e-5),after=phases(boundary+1e-5);
      for(let i=0;i<2;i++)assert.ok(Math.abs(signed(after[i]-before[i]))<1e-6,'UV/year wrap has no extra cloud rotation tick');
    }
    assert.equal(weather.builds,builds);assert.deepEqual(Array.from(weather.rotationRates),rates);
  }
  assert.equal(assignments.size,2,'either map can be the slow one after regeneration');weather.dispose();
});

test('cloud alpha evolves smoothly, supports reverse time, and preserves the amount range',()=>{
  const weather=new CloudWeather(),sample=day=>{weather.update(.217,day);return weather.coverage(.6,.37,.46,1);};
  const initial=sample(20000),next=sample(20001);assert.ok(Math.abs(initial-next)>.001);
  assert.equal(sample(20000),initial);
  for(const day of [-20000,-7.1,0,3.7,5.3,7.1,20000,300000])assert.ok(Math.abs(sample(day-1e-5)-sample(day+1e-5))<.0001);
  for(let day=20000;day<20010;day+=.04){weather.update(.217,day);for(const source of [0,.05,.3,.8,1]){
    const low=weather.coverage(source,.37,.46,.25),normal=weather.coverage(source,.37,.46,.5),high=weather.coverage(source,.37,.46,1);
    assert.ok(low<=normal&&normal<=high&&high<=.92);
    assert.equal(weather.coverage(source,.37,.46,0),0);
    if(source===0)assert.equal(high,0);
  }}
  assert.equal(weather.builds,1);
});

test('birth and death reach dense clouds across the whole map without globally fading out',()=>{
  for(const seed of [.003,.217,.789]){
    const weather=new CloudWeather(),minimum=new Float64Array(288).fill(1),maximum=new Float64Array(288);
    let previous=null,opposingChanges=0;
    // Sample every hemisphere and latitude band over twelve simulated days.
    for(let tick=0;tick<144;tick++){
      weather.update(seed,20000+tick/12);const current=new Float64Array(288);
      let mean=0,growing=0,fading=0;
      for(let y=0;y<12;y++)for(let x=0;x<24;x++){
        const i=y*24+x,value=weather.coverage(1,(x+.5)/24,(y+.5)/12,1);
        current[i]=value;minimum[i]=Math.min(minimum[i],value);maximum[i]=Math.max(maximum[i],value);mean+=value/288;
        if(previous){if(value-previous[i]>.01)growing++;if(previous[i]-value>.01)fading++;}
      }
      assert.ok(mean>.25&&mean<.8,`seed ${seed}, tick ${tick}: no whole-map disappearance/flash`);
      if(growing>20&&fading>20)opposingChanges++;
      previous=current;
    }
    for(let i=0;i<288;i++)assert.ok(minimum[i]<.01&&maximum[i]>.5,`seed ${seed}, region ${i}: complete local birth/death`);
    assert.ok(opposingChanges>120,'many regions grow while others fade');
    assert.equal(weather.builds,1,'no regeneration or GPU upload on each lifecycle');
    weather.dispose();
  }
});

test('GPU mask storage is reused and deleted by its owner',()=>{
  let uploads=0,creates=0,deletes=0;const gl={createTexture(){creates++;return {};},deleteTexture(){deletes++;},activeTexture(){},bindTexture(){},pixelStorei(){},texParameteri(){},texImage2D(){uploads++;}};
  const weather=new CloudWeather();weather.update(.1,0,gl);const texture=weather.texture;
  for(let day=1;day<100;day++)weather.update(.1,day,gl);
  assert.equal(uploads,1);weather.update(.2,100,gl);assert.equal(uploads,2);assert.equal(creates,1);assert.equal(weather.texture,texture);
  weather.dispose();weather.dispose();assert.equal(deletes,1);
});

test('slider sweeps activate regions at different levels and reverse without restarting weather',()=>{
  const weather=new CloudWeather();weather.update(.217,20000);const points=[];
  for(let y=0;y<24;y++)for(let x=0;x<48;x++){
    const u=(x+.5)/48,v=(y+.5)/24,maximum=weather.coverage(1,u,v,1);
    if(maximum>.15)points.push({u,v,maximum});
  }
  const visible=amount=>points.filter(p=>weather.coverage(1,p.u,p.v,amount)>.05).length;
  const counts=[0,.125,.25,.5,.75,1].map(visible);
  assert.equal(counts[0],0);assert.equal(counts[5],points.length);
  for(let i=1;i<counts.length;i++)assert.ok(counts[i]-counts[i-1]>points.length*.035,'new regions throughout the slider range');
  assert.ok(counts[1]<points.length*.3&&counts[4]<points.length*.9,'not a simultaneous global opacity fade');
  for(const p of points){let last=0;for(let tick=0;tick<=40;tick++){
    const amount=tick/40,value=weather.coverage(1,p.u,p.v,amount);
    assert.ok(value>=last);last=value;
    assert.equal(weather.coverage(1,p.u,p.v,amount),value);
  }}
  assert.equal(weather.builds,1);
});

test('a fast zero-to-maximum change reveals different regions at different times',()=>{
  const weather=new CloudWeather();weather.update(.217,20000);let early=0,waiting=0;
  for(let y=0;y<24;y++)for(let x=0;x<48;x++){
    const u=(x+.5)/48,v=(y+.5)/24,maximum=weather.coverage(1,u,v,1);
    assert.equal(weather.coverage(1,u,v,1,0),0);
    if(maximum<=.15)continue;
    const part=weather.coverage(1,u,v,1,.4)/maximum;
    if(part>.9)early++;if(part<.01)waiting++;
    assert.equal(weather.coverage(1,u,v,1,1),maximum);
  }
  assert.ok(early>80&&waiting>80,'some clouds formed while others have not started');
});

test('renderer owns the reveal clock, preserves it during a drag, and clears it at zero',()=>{
  const window={SolarAstro:{TAU:Math.PI*2,DEG:Math.PI/180,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),{window,performance});
  const r=Object.create(window.SolarRenderer.prototype);r.options={earthCloudAmount:0,earthCloudSeed:.2};r.presentationUntil=0;
  assert.equal(r.cloudRevealProgress(0),0);assert.equal(r.cloudRevealStart,undefined);
  r.setOption('earthCloudAmount',.2);assert.equal(r.cloudRevealProgress(100),0);
  r.setOption('earthCloudAmount',1);assert.equal(r.cloudRevealProgress(1000),.25);
  assert.equal(r.presentationUntil,3700);assert.equal(r.cloudRevealProgress(3700),1);
  r.setOption('earthCloudAmount',0);assert.equal(r.cloudRevealProgress(4000),0);
  r.setOption('earthCloudAmount',1);assert.equal(r.cloudRevealProgress(4100),0);
  r.setOption('earthCloudSeed',.7);assert.equal(r.cloudRevealProgress(4600),0);
  // Manual slider changes bypass the initial reveal in both directions,
  // including a new randomized seed after returning from zero.
  r.setOption('earthCloudAmount',0,false);assert.equal(r.cloudRevealProgress(4700),0);
  r.setOption('earthCloudSeed',.8);r.setOption('earthCloudAmount',.2,false);
  assert.equal(r.cloudRevealProgress(4700),1);assert.equal(r.options.earthCloudAmount,.2);
  r.setOption('earthCloudAmount',1,false);assert.equal(r.cloudRevealProgress(4701),1);
  r.setOption('earthCloudAmount',.2,false);assert.equal(r.cloudRevealProgress(4702),1);
  assert.equal(r.options.earthCloudAmount,.2);
});

test('paused compatibility frames continue updating until reveal finishes',()=>{
  const {Service}=context(),service=Object.create(Service.prototype);
  const job={id:'earth',geometry:'same',diam:128,textureWidth:256,phase:.3,seconds:0,weatherDay:20000,light:[0,0,1],cloudReveal:.2};
  service.epoch=1;service.frames=new Map([['earth',{epoch:1,job,mono:0}]]);
  assert.equal(service.needs({...job,cloudReveal:.5},130),true);
  assert.equal(service.needs({...job},130),false);
});

test('CPU engine skips cloud generation at zero amount and reuses weather while enabled',async()=>{
  class Canvas{constructor(w,h){this.width=w;this.height=h;}getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}}
  const {Engine}=context({OffscreenCanvas:Canvas}).kernel(),engine=new Engine({gpu:false}),requested=[];
  engine.texture=async id=>{requested.push(id);return {width:4,height:2,data:new Uint8Array(32).fill(160)};};
  const job={id:'earth',diam:8,textureWidth:4,phase:0,frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[0,0,1],cloudSeed:.2,weatherDay:20000,cloudAmount:0};
  await engine.render(job);assert.equal(engine.cloudWeather,undefined);assert.ok(!requested.includes('clouds'));
  await engine.render({...job,cloudAmount:.5});const weather=engine.cloudWeather;assert.equal(weather.builds,1);
  await engine.render({...job,cloudAmount:.5,weatherDay:20002});assert.equal(weather.builds,1);
  requested.length=0;await engine.render({...job,cloudSeed:.9});assert.equal(weather.seed,.2);assert.ok(!requested.includes('clouds'));
  await engine.render({...job,cloudAmount:.5,cloudSeed:.9});assert.equal(weather.builds,2);
  engine.clear();assert.equal(weather.map,null);assert.equal(engine.cloudWeather,null);
});

test('direct, worker and fallback share the spherical mask implementation',()=>{
  const api=context();assert.ok(api.shaderSources.planet.includes('texture2D(cloudWeatherMap'));
  assert.ok(api.kernel().shaderSources.fragment.includes('texture2D(cloudWeatherMap'));
  assert.match(source,/job\.id==='earth'&&cloudAmount>0\?\(this\.cloudWeather\|\|=new materialSource\.CloudWeather\(\)\):null/);
  assert.match(source,/this\.cloudWeather\?\.dispose\(\);this\.cloudWeather=null/);
  assert.match(source,/cover=weather\.coverage\(sourceCloud,mapU,cloudV,cloudAmount,cloudReveal,alternate,cloudsAlt\?1:0,job\.cloudDetail\?\?1\)/);
});

test('dual sources have independent life and a bounded, seamless alpha-over mix',()=>{
  const weather=new CloudWeather();let secondaryOnly=0,opposing=0;
  for(let tick=0;tick<24;tick++){
    weather.update(.217,20000+tick/12);
    assert.notDeepEqual(weather.state.life,weather.state.altLife);
    for(let y=1;y<8;y++)for(let x=0;x<16;x++){
      const u=(x+.5)/16,v=y/8;
      const primary=weather.coverage(1,u,v,1,1,0,1),secondary=weather.coverage(0,u,v,1,1,1,1);
      const both=weather.coverage(1,u,v,1,1,1,1);
      assert.equal(primary,weather.coverage(1,u,v,1),'an empty A source never dilutes B');
      assert.ok(Math.abs(both-(primary+(.92-primary)*secondary/.92))<1e-12,'normalized alpha-over, not averaging or additive brightness');
      assert.ok(both>=primary&&both>=secondary,'each source fills gaps without erasing the other');
      assert.ok(both>=0&&both<=.92);if(primary<.005&&secondary>.1)secondaryOnly++;
      if(primary>.2&&secondary<.005)opposing++;
      assert.equal(weather.coverage(1,u,v,0,1,1,1),0);
      assert.equal(weather.coverage(1,u,v,1,0,1,1),0);
      assert.ok(weather.coverage(1,u,v,.5,1,1,1)<=both);
    }
    for(const v of [0,.25,.5,.9,1]){
      const value=u=>weather.coverage(.6,u,v,1,1,.9,1);
      assert.equal(value(0),value(1),'exactly the same longitude');
      const near=Math.abs(value(1-1e-7)-value(1e-7)),closer=Math.abs(value(1-1e-8)-value(1e-8));
      // Fractal edge slopes converge to zero at the join rather than leaving
      // a finite seam jump as the two samples approach the same longitude.
      assert.ok(closer<=near*.11+1e-12,'continuous edge slope across the seam');
    }
  }
  assert.ok(secondaryOnly>100&&opposing>100);assert.equal(weather.builds,1);
});

test('A fills remaining cloud opacity monotonically without dimming B during fade-in',()=>{
  const weather=new CloudWeather();
  // Isolate the compositor from weather so the full opacity domain, including
  // completely formed clouds, can be tested without adding random fixtures.
  weather.field=(_u,_v,out)=>{out.fill(.5);return out;};
  weather.density=value=>value;weather.gate=(_field,_rank,amount,reveal)=>Math.min(amount,reveal);
  for(const b of [0,.001,.2,.6,.92])for(const a of [0,.001,.2,.6,.92]){
    let previous=b;
    for(let step=0;step<=100;step++){
      const mix=step/100,value=weather.coverage(b,.2,.4,1,1,a,mix);
      assert.ok(value>=b&&value>=previous&&value<=.92,'bounded monotone loading/formation');
      assert.ok(Math.abs(value-(b+(.92-b)*(a*.32*mix/.92)))<1e-12);
      if(a===0||mix===0||b===.92)assert.equal(value,b,'empty A or saturated B is unchanged');
      assert.ok(value-previous<=.003,'no hard cutoff or fade-in brightness jump');previous=value;
    }
    assert.equal(weather.coverage(b,.2,.4,0,1,a,1),0);
    assert.equal(weather.coverage(b,.2,.4,1,0,a,1),0);
  }
  assert.equal(weather.builds,0,'no extra noise, source textures or allocations for compositing');
  weather.dispose();
});

test('dissolving edges keep translucent tails instead of cutting the source away',()=>{
  const weather=new CloudWeather();weather.update(.217,0);
  const field=[.8,.4,.5,.5],life=[-.4,0,0,0],full=[4,0,0,0];
  const thin=weather.density(.2,field,life)/weather.density(.2,field,full);
  const dense=weather.density(.9,field,life)/weather.density(.9,field,full);
  assert.ok(thin>.05&&thin<dense&&dense<1,'thin edges fade first but are not erased');
  for(const source of [.001,.01,.05,.2,.5,1]){
    assert.ok(weather.density(source,field,life)>0,'every source retains its feathered tail');
    assert.equal(weather.density(source,field,[-4,0,0,0]),0,'fully dissipated regions leave no residue');
  }
  assert.equal(weather.density(0,field,life),0);weather.dispose();
});

test('birth and death have a broad monotone opacity gradient without an eraser contour',()=>{
  const weather=new CloudWeather();weather.state.blend.set([.5,.5,.3]);
  const field=[.8,.4,.5,.5],sample=(source,score)=>weather.density(source,field,[score/.3,0,0,0]);
  for(const source of [.05,.2,.6,.9]){
    const full=sample(source,1),profile=[];let start=null,end=null,previous=0;
    for(let tick=0;tick<=1000;tick++){
      const score=-1+tick*.002,opacity=sample(source,score)/full;
      assert.ok(opacity>=previous&&opacity<=1,'monotone formation');
      assert.ok(opacity-previous<.01,'no abrupt boundary jump');
      if(start===null&&opacity>=.1)start=score;
      if(end===null&&opacity>=.9)end=score;
      profile.push(opacity);previous=opacity;
    }
    assert.ok(end-start>.35,'10% to 90% occupies a broad feather, not a thin cutoff');
    for(let tick=1000;tick>=0;tick--)assert.equal(sample(source,-1+tick*.002)/full,profile[tick],'dissipation follows the same smooth gradient in reverse');
  }
  assert.equal(weather.builds,0,'no new texture, blur passes or per-pixel noise');weather.dispose();
});

test('fractal boundary breakup is localized, continuous and monotone in both directions',()=>{
  const weather=new CloudWeather();
  for(const detail of [0,.15,.35,.5,.65,.85,1]){
    assert.equal(weather.edgeEnvelope(0,detail),0);
    assert.equal(weather.edgeEnvelope(1,detail),1);
    let previous=0;
    for(let step=0;step<=200;step++){
      const progress=step/200,value=weather.edgeEnvelope(progress,detail);
      assert.ok(value>=previous&&value>=0&&value<=1,'no popping, overshoot or shrinking backward');
      assert.ok(value-previous<.01,'bounded continuous transition');previous=value;
      assert.ok(Math.abs(value-(1-weather.edgeEnvelope(1-progress,1-detail)))<1e-12,'generation and dissipation are symmetric');
      assert.equal(weather.edgeEnvelope(progress,.5),progress,'neutral detail preserves the original curve');
    }
  }
  assert.ok(weather.edgeEnvelope(.5,.8)-weather.edgeEnvelope(.5,.2)>.4,'spatially different edges, not a global fade');
  assert.equal(weather.builds,0,'edge shaping does not allocate or regenerate noise');
});

test('A tiles twice per axis with one fetch while B and fractal gradients are preserved',()=>{
  const shader=context().shaderSources.planet;
  const cloudShader=shader.slice(shader.indexOf('uniform sampler2D cloudWeatherMap'),shader.indexOf('void main()')).replace(/vec4 venusCloudLayer\([\s\S]*?(?=float atmosphericCloudCoverage)/,'');
  assert.equal((cloudShader.match(/texture2D\(/g)||[]).length,4,'two source samples and two cached weather samples; seams need no extra fetch');
  assert.ok(cloudShader.includes('envelope=atmosphericCloudEdge(envelope,fine)'));
  assert.ok(cloudShader.includes('return activation*atmosphericCloudEdge(reveal,detail)'));
  assert.ok(cloudShader.includes('atmosphericCloudDensity(alternateSource,other,cloudAltLife)'));
  assert.equal((cloudShader.match(/texture2D\(cloudsMap,/g)||[]).length,1,'B remains a single whole map');
  assert.equal((cloudShader.match(/texture2D\(cloudAltMap,/g)||[]).length,1);
  assert.ok(cloudShader.includes('fract(vec2(mapUv.x+cloudAltOffset,mapUv.y)*2.)'));
  assert.ok(!cloudShader.includes('rotatedSource'));
});

test('settled cloud gate fast paths preserve the original fractal and gradient exactly',()=>{
  const weather=new CloudWeather(),clamp=n=>Math.max(0,Math.min(1,n));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const oldGate=(field,rank,amount,reveal)=>{
    const detail=field[2]+(field[3]-field[2])*weather.state.blend[1],delay=smooth(.15,.85,field[0])*.65;
    return weather.edgeEnvelope(smooth(rank*.8,.42+.58*rank,clamp(amount)),detail)*weather.edgeEnvelope(smooth(delay,delay+.2+.15*field[2],reveal),detail);
  };
  for(const blend of [0,.3,1]){weather.state.blend[1]=blend;
    for(const field of [[0,0,0,0],[1,1,1,1],[.6,.1,.7,.3]])for(const rank of [0,.2,.7,1]){
      for(const amount of [0,.1,.5,.999,1])for(const reveal of [0,.3,.99,1]){
        assert.equal(weather.gate(field,rank,amount,reveal),oldGate(field,rank,amount,reveal));
      }
    }
  }
  let calls=0;const edge=weather.edgeEnvelope.bind(weather);weather.edgeEnvelope=(...args)=>{calls++;return edge(...args);};
  weather.gate([.6,.1,.7,.3],.4,1,1);assert.equal(calls,0,'fully revealed max density bypasses both envelopes');
  weather.gate([.6,.1,.7,.3],.4,.5,1);assert.equal(calls,1,'settled normal density needs only activation');
  for(let i=0;i<=1000;i++){const source=i/1000;assert.ok(Math.abs(source**1.5-source*Math.sqrt(source))<2e-16,'sqrt preserves the source transfer curve');}
  weather.dispose();
});

test('optional CPU A map has a 2K cap, failure cooldown, and zero skips both maps',async()=>{
  class Canvas{constructor(w,h){this.width=w;this.height=h;}getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}}
  const kernel=context({OffscreenCanvas:Canvas}).kernel();kernel.setAssets({'clouds-alt':{}});
  const engine=new kernel.Engine({gpu:false}),requests=[];
  engine.texture=async(id,width)=>{requests.push([id,width]);if(id==='clouds-alt')throw Error('offline');return {width:4,height:2,data:new Uint8Array(32).fill(160)};};
  const job={id:'earth',diam:8,textureWidth:4096,cloudTextureWidth:4096,phase:0,frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[0,0,1],cloudSeed:.2,weatherDay:20000,cloudAmount:1};
  try{
    await engine.render(job);await engine.render(job);
    assert.deepEqual(requests.filter(r=>r[0]==='clouds-alt'),[['clouds-alt',2048]]);
    requests.length=0;await engine.render({...job,cloudAmount:0});
    assert.ok(!requests.some(r=>r[0].startsWith('clouds')));
  }finally{engine.clear();}
});

test('optional direct map fades in once and paused presentation stays awake only during blending',()=>{
  const {DirectRenderer}=context(),direct=Object.create(DirectRenderer.prototype);
  assert.equal(direct.cloudAlternativeMix(false,0),0);
  assert.equal(direct.cloudAlternativeMix(true,100),0);
  assert.equal(direct.cloudAlternativeMix(true,700),.5);
  assert.equal(direct.cloudAlternativeMix(true,1300),1);
  assert.equal(direct.cloudAlternativeMix(true,2500),1);
  assert.equal(direct.cloudAlternativeMix(false,3000),0);assert.equal(direct.cloudBlendUntil,0);
  assert.equal(direct.cloudAlternativeMix(true,3100),0);
  const window={SolarAstro:{TAU:Math.PI*2,DEG:Math.PI/180,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),{window,performance});
  const r=Object.create(window.SolarRenderer.prototype);Object.assign(r,{gpu:direct,presentationUntil:0,resourceSignature:()=>'',presentedResources:'',orbitRevealAlpha:()=>1});
  assert.equal(r.needsDraw(3500),true);assert.equal(r.needsDraw(4300),false);
});

test('secondary texture participates in the shared budget, cancellation and remote manifest',()=>{
  const window={},ctx={window,navigator:{userAgent:'desktop'},matchMedia:()=>({matches:false}),screen:{width:1280,height:800},performance};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/performance.js'),'utf8'),ctx);
  const api=window.SolarPerformance,assets={earth:{},clouds:{},'clouds-alt':{}};
  const job={id:'earth',textureWidth:4096,cloudTextureWidth:4096,cloudAmount:1,priority:2};
  const plan=api.planTextures([job],assets);assert.equal(plan.targets.get('clouds-alt'),2048);
  assert.equal(plan.targets.get('clouds'),4096);
  assert.equal(plan.bytes,(4096*4096*2+2048*2048)*2);
  const distant=api.planTextures([{...job,cloudTextureWidth:512}],assets);
  assert.equal(distant.targets.get('clouds'),512);assert.equal(distant.targets.get('clouds-alt'),512);
  assert.equal(api.protectTexture({desired:new Map([['earth',job]])},'clouds-alt'),true);
  assert.equal(api.protectTexture({desired:new Map([['earth',{...job,cloudAmount:0}]])},'clouds-alt'),false);
  const off=api.planTextures([{...job,cloudAmount:0}],assets);assert.ok(!off.targets.has('clouds')&&!off.targets.has('clouds-alt'));
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/manifest.json'),'utf8'));
  assert.equal(manifest.materials['clouds-alt'].remoteOnly,true);
  assert.equal(manifest.materials['clouds-alt'].tiers.at(-1).width,2048);
  assert.notEqual(manifest.materials.clouds.tiers[0].path,manifest.materials['clouds-alt'].tiers[0].path);
});
