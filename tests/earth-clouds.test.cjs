'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Earth card places one persisted cloud amount slider below night lights',()=>{
  const html=read('index.html'),app=read('src/app.js'),renderer=read('src/renderer.js');
  const options=html.slice(html.indexOf('id="body-card-options"'),html.indexOf('id="view-controls"'));
  assert.ok(options.indexOf('id="earth-night-lights-control"')<options.indexOf('id="earth-cloud-control"'));
  assert.match(options,/id="earth-cloud-control"[^>]*hidden/);
  assert.match(options,/id="earth-cloud-amount"[^>]*type="range"[^>]*min="0"[^>]*max="200"[^>]*value="100"/);
  assert.match(app,/FACTORY_OPTIONS=Object\.freeze\([^\n]*earthCloudAmount:\.5/);
  assert.match(renderer,/this\.options=\{[^\n]*earthCloudAmount:\.5/);
  assert.match(app,/saved\.earthCloudAmount/);
  assert.doesNotMatch(app,/saved\.earthCloudSeed/);
  assert.match(app,/cloudValue=Math\.round\(A\.clamp\(Number\(renderer\.options\.earthCloudAmount\) \|\| 0,0,1\)\*200\)/);
  assert.match(app,/setOption\('earthCloudAmount',value\/200\)/);
  assert.match(app,/if\(value>0&&previous<=0\)renderer\.setOption\('earthCloudSeed',randomCloudSeed\(renderer\.options\.earthCloudSeed\)\)/);
  assert.match(renderer,/screenDiameter=Math\.max\(32,r\*2\*this\.dpr\),apparentDiameter=Math\.max\(16,r\*2\)/);
  assert.match(renderer,/const cloudVisibilityRaw=clamp\(\(apparentDiameter-64\)\/32,0,1\)/);
  assert.match(renderer,/const cloudVisibility=cloudVisibilityRaw\*cloudVisibilityRaw\*\(3-2\*cloudVisibilityRaw\)/);
  assert.match(renderer,/job\.cloudAmount=body\.id==='earth'\?clamp\(Number\(this\.options\.earthCloudAmount\),0,1\)\*cloudVisibility:0/);
  assert.match(renderer,/job\.cloudTextureWidth=job\.cloudAmount>0\?Math\.min\(SURFACE\.detailWidth,cloudTextureWidth\):0/);
  assert.match(renderer,/job\.cloudSeed=body\.id==='earth'\?this\.options\.earthCloudSeed:0/);
});

test('cloud amount controls deterministic regional systems tied to simulation days',()=>{
  const surface=read('src/surface.js'),renderer=read('src/renderer.js'),performance=read('src/performance.js');
  assert.equal((surface.match(/uniform float [^;]*cloudAmount/g)||[]).length,2);
  assert.match(surface,/float target=clamp\(amount,0\.,1\.\)\*16\./);
  assert.match(surface,/for\(int i=0;i<16;i\+\+\)/);
  assert.match(surface,/float rank=variant\*4\.\+slot/);
  assert.match(surface,/float lifetime=\.5\+4\.5\*cloudHash/);
  assert.match(surface,/atmosphericCloudCoverage\(vec2 uv,float amount,float day,float userSeed\)/);
  assert.match(surface,/vec2 weatherUv=vec2\(fract\(uv\.x\),clamp\(uv\.y,0\.,1\.\)\)/);
  assert.match(surface,/float birthDuration=min\(1\.5,lifetime\*\.40\)/);
  assert.match(surface,/float deathDuration=min\(1\.15,lifetime\*\.40\)/);
  assert.match(surface,/float birthFade=smoothstep\(0\.,birthDuration,age\)/);
  assert.match(surface,/smoothstep\(lifetime-deathDuration,lifetime,age\)/);
  assert.match(surface,/float deathMode=cloudHash\(seed\+43\.2\)/);
  assert.match(surface,/float growScale=1\.12\+\.58\*cloudHash\(seed\+47\.9\)/);
  assert.match(surface,/float shrinkScale=\.20\+\.50\*cloudHash\(seed\+51\.7\)/);
  assert.match(surface,/float scatter=max\(1\.-birthFade,deathFade\)/);
  assert.match(surface,/float branchCount=3\.\+floor\(cloudHash\(seed\+55\.1\)\*10\.\)/);
  assert.match(surface,/float spread=radius\*\(\.35\+\.55\*cloudHash\(seed\+58\.4\)\)\*scatter/);
  assert.match(surface,/atan\(delta\.y,delta\.x\)\*branchCount/);
  assert.match(surface,/particleKeep=smoothstep\(scatter\*\.65,\.96,sprayNoise\)/);
  assert.match(surface,/atmosphericCloudRegion\(vec2 delta,float radius\)\{return 1\.-smoothstep\(radius\*\.04,radius,length\(delta\)\)/);
  assert.match(surface,/float atmosphericCloudTexture\(vec2 sampleUv,float seed\)/);
  assert.match(surface,/vec2 atmosphericShellUv\(vec3 viewNormal,float shellRadius\)/);
  assert.match(surface,/vec3 shellNormal=vec3\(viewNormal\.xy\/shellRadius,sqrt\(max\(0\.,1\.-dot\(viewNormal\.xy,viewNormal\.xy\)\/shellSq\)\)\)/);
  assert.match(surface,/return sourceCloud\*\(\.78\+\.32\*fineCloud\)\*\.72/);
  assert.match(surface,/return min\(\.92,cover\*2\.25\)/);
  assert.match(surface,/cover=Math\.min\(\.92,cover\*2\.25\)/);
  assert.match(surface,/const atmosphericRegion=/);
  assert.match(surface,/const atmosphericTexture=/);
  assert.match(surface,/vec2 direction=vec2\(cos\(angle\),sin\(angle\)\)/);
  assert.match(surface,/float latitude=abs\(origin\.y-\.5\)\*2\./);
  assert.match(surface,/float tropical=1\.-smoothstep\(\.28,\.42,latitude\)/);
  assert.match(surface,/float polar=smoothstep\(\.65,\.78,latitude\)/);
  assert.match(surface,/float zonalSpeed=-\.05\*tropical\+\.05\*midLatitude/);
  assert.match(surface,/vec2 center=origin\+drift\*age/);
  assert.match(renderer,/job\.weatherDay=body\.id==='earth'\?ms\/86400000:0/);
  assert.equal((surface.match(/vec2 cloudUv=atmosphericShellUv\(n,1\.007\)/g)||[]).length,2);
  assert.equal((surface.match(/if\(cloudAmount>0\.\)cloud=atmosphericCloudCoverage\(cloudUv,cloudAmount,weatherDay,cloudSeed\)/g)||[]).length,2);
  assert.match(surface,/const shellRadius=1\.007/);
  assert.match(surface,/const weatherU=\(\(cloudU%1\)\+1\)%1,weatherV=cloudV/);
  assert.match(surface,/uniform1f\(u\.cloudAmount,cloudAmount\)/);
  assert.match(surface,/uniform1f\(p\.u\.cloudAmount,cloudAmount\)/);
  assert.match(surface,/uniform1f\(u\.cloudSeed,cloudSeed\)/);
  assert.match(surface,/uniform1f\(p\.u\.cloudSeed,Number\.isFinite\(job\.cloudSeed\)\?job\.cloudSeed:0\)/);
  assert.match(surface,/uniform1f\(u\.weatherDay,weatherDay\)/);
  assert.match(surface,/uniform1f\(p\.u\.weatherDay,Number\.isFinite\(job\.weatherDay\)\?job\.weatherDay:0\)/);
  assert.match(surface,/cloudAmount>0\?await this\.texture\('clouds'/);
  assert.match(surface,/cloudAmount>0\?this\.texture\('clouds'/);
  assert.equal((surface.match(/this\.texture\('clouds',Math\.min\(4096,/g)||[]).length,2);
  assert.match(surface,/cloudTextureWidth\|\|width/);
  assert.match(surface,/job\.cloudTextureWidth\|\|job\.textureWidth/);
  assert.match(performance,/add\('clouds',Math\.min\(4096,job\.cloudTextureWidth\|\|job\.textureWidth\),job\.priority\|\|0\)/);
  assert.match(performance,/job\.id==='earth'&&job\.cloudAmount!==0/);
  assert.match(performance,/name==='clouds'&&desired\?\.has\('earth'\)&&desired\.get\('earth'\)\.cloudAmount!==0/);
});

test('zonal wind is slower in the tropics, faster at mid-latitudes and continuous',()=>{
  const smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
  const wind=latitude=>{const tropical=1-smooth(.28,.42,latitude),polar=smooth(.65,.78,latitude),mid=(1-tropical)*(1-polar);return -.05*tropical+.05*mid;};
  assert.equal(wind(0),-.05);
  assert.equal(wind(.5),.05);
  assert.equal(wind(.9),0);
  for(let latitude=.001;latitude<=1;latitude+=.001)assert.ok(Math.abs(wind(latitude)-wind(latitude-.001))<.0022);
});

test('cloud visibility and texture LOD follow the apparent Earth diameter',()=>{
  const visibility=diameter=>{const raw=Math.max(0,Math.min(1,(diameter-64)/32));return raw*raw*(3-2*raw);};
  const tiers=[256,512,1024,2048,4096],lod=diameter=>tiers.find(width=>width>=Math.max(256,diameter*4))||4096;
  assert.equal(visibility(64),0);
  assert.equal(visibility(80),.5);
  assert.equal(visibility(96),1);
  assert.equal(lod(64),256);
  assert.equal(lod(128),512);
  assert.equal(lod(1024),4096);
});

test('zero cloud amount skips every cloud source and clouded lights are softened',()=>{
  const surface=read('src/surface.js');
  assert.match(surface,/if\(cloudAmount>0\)\{/);
  assert.match(surface,/if\(cloud<=\.01\)return clear/);
  assert.match(surface,/return mix\(clear,softened,cloud\*\.48\)\*\(1\.-cloud\*\.42\)/);
  assert.equal((surface.match(/cloudVeiledNight\(uv,n\.z,cloud\)/g)||[]).length,2);
});

test('cloud birth stays gradual across five-hour time-travel steps',()=>{
  const smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
  let previous=0,maxStep=0;
  for(let age=5/24;age<=1.5+5/24;age+=5/24){
    const opacity=smooth(0,1.5,age);
    maxStep=Math.max(maxStep,opacity-previous);
    previous=opacity;
  }
  assert.ok(maxStep<.22,`largest five-hour opacity step was ${maxStep}`);
});

test('a twelve-hour cloud uses approximately five-hour fades',()=>{
  const lifetime=.5;
  const birthHours=Math.min(1.5,lifetime*.40)*24;
  const deathHours=Math.min(1.15,lifetime*.40)*24;
  assert.equal(birthHours,4.800000000000001);
  assert.equal(deathHours,4.800000000000001);
  assert.ok(birthHours+deathHours<lifetime*24);
});

test('cloud label is translated in every generated locale',()=>{
  for(const file of fs.readdirSync(path.join(root,'src','locales')).filter(name=>name.endsWith('.json'))){
    const copy=JSON.parse(read(path.join('src','locales',file))).copy;
    assert.ok(copy.atmosphericClouds,`${file}: atmosphericClouds`);
  }
});
