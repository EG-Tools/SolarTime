'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Earth card places one persisted cloud amount slider above night lights',()=>{
  const html=read('index.html'),app=read('src/app.js'),renderer=read('src/renderer.js');
  const options=html.slice(html.indexOf('id="body-card-options"'),html.indexOf('id="view-controls"'));
  assert.ok(options.indexOf('id="earth-cloud-control"')<options.indexOf('id="earth-night-lights-control"'));
  assert.match(options,/id="earth-cloud-control"[^>]*hidden/);
  assert.match(options,/id="earth-cloud-amount"[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*value="100"/);
  assert.match(app,/FACTORY_OPTIONS=Object\.freeze\([^\n]*earthCloudAmount:1/);
  assert.match(renderer,/this\.options=\{[^\n]*earthCloudAmount:1/);
  assert.match(app,/saved\.earthCloudAmount/);
  assert.doesNotMatch(app,/saved\.earthCloudSeed/);
  assert.match(app,/cloudValue=Math\.round\(A\.clamp\(Number\(renderer\.options\.earthCloudAmount\) \|\| 0,0,1\)\*100\)/);
  assert.match(app,/setOption\('earthCloudAmount',value\/100\)/);
  assert.match(app,/if\(value>0&&previous<=0\)renderer\.setOption\('earthCloudSeed',randomCloudSeed\(renderer\.options\.earthCloudSeed\)\)/);
  assert.match(renderer,/screenDiameter=Math\.max\(32,r\*2\*this\.dpr\),apparentDiameter=Math\.max\(16,r\*2\)/);
  assert.match(renderer,/const cloudVisibilityRaw=clamp\(\(apparentDiameter-16\)\/80,0,1\)/);
  assert.match(renderer,/const cloudVisibility=\.16\+\.84\*\(cloudVisibilityRaw\*cloudVisibilityRaw\*\(3-2\*cloudVisibilityRaw\)\)/);
  assert.match(renderer,/job\.cloudAmount=body\.id==='earth'\?clamp\(Number\(this\.options\.earthCloudAmount\),0,1\)\*cloudVisibility:0/);
  assert.match(renderer,/job\.cloudTextureWidth=job\.cloudAmount>0\?Math\.min\(SURFACE\.detailWidth,cloudTextureWidth\):0/);
  assert.match(renderer,/job\.cloudSeed=body\.id==='earth'\?this\.options\.earthCloudSeed:0/);
});

test('cloud amount blends complete source maps with continuous simulation drift',()=>{
  const surface=read('src/surface.js'),renderer=read('src/renderer.js'),performance=read('src/performance.js');
  assert.equal((surface.match(/uniform float [^;]*cloudAmount/g)||[]).length,2);
  assert.match(surface,/atmosphericCloudCoverage\(vec2 uv,float amount\)/);
  assert.match(surface,/vec2 weatherUv=vec2\(fract\(uv\.x\),clamp\(uv\.y,0\.,1\.\)\)/);
  assert.match(surface,/vec2 mapUv=vec2\(fract\(weatherUv\.x\+cloudDrift\.x\),weatherUv\.y\)/);
  assert.match(surface,/float sourceCloud=texture2D\(cloudsMap,mapUv\)\.r/);
  assert.match(surface,/sourceCloud\*=sqrt\(sourceCloud\)/);
  assert.match(surface,/smoothstep\(rank\*\.80,\.42\+\.58\*rank,clamp\(amount,0\.,1\.\)\)/);
  assert.match(surface,/float combined=primary\+\(\.92-primary\)\*\(alternate\*weight\/\.92\)/);
  assert.match(surface,/float fade=envelope\*mix\(envelope,1\.,smoothstep\(\.12,\.80,source\)\)/);
  assert.doesNotMatch(surface,/float erosion=|erosion=smooth/);
  assert.doesNotMatch(surface,/secondaryUv|fullMap|markerMask|breakupUv|atmosphericCloudRegion|atmosphericCloudTexture|shapeRadius|branchCount|birthFade|patchScale/);
  assert.match(surface,/vec2 atmosphericShellUv\(vec3 viewNormal,float shellRadius\)/);
  assert.match(surface,/vec3 shellNormal=vec3\(viewNormal\.xy\/shellRadius,sqrt\(max\(0\.,1\.-dot\(viewNormal\.xy,viewNormal\.xy\)\/shellSq\)\)\)/);
  assert.match(surface,/const atmosphericTexture=/);
  assert.match(surface,/mapU=fract\(cloudU\+cloudState\.drift\[0\]\)/);
  assert.match(renderer,/job\.weatherDay=body\.id==='earth'\?ms\/86400000:0/);
  assert.equal((surface.match(/vec2 cloudUv=atmosphericShellUv\(n,1\.007\)/g)||[]).length,2);
  assert.equal((surface.match(/if\(cloudAmount>0\.\)\{\s*vec2 cloudUv=atmosphericShellUv\(n,1\.007\);\s*cloud=atmosphericCloudCoverage\(cloudUv,cloudAmount\)/g)||[]).length,2);
  assert.match(surface,/const shellRadius=1\.007/);
  assert.match(surface,/uniform1f\(u\.cloudAmount,cloudAmount\)/);
  assert.match(surface,/uniform1f\(p\.u\.cloudAmount,clouds\?cloudAmount:0\)/);
  assert.match(surface,/weather\?\.update\(cloudSeed,weatherDay,this\.gl,job\.cloudSpinDays\)/);
  assert.match(surface,/weather\?\.update\(job\.cloudSeed,job\.weatherDay,this\.gl,job\.cloudSpinDays,true\)/);
  assert.match(renderer,/job\.cloudSpinDays=body\.id==='earth'\?body\.spinSeconds\/86400:1/);
  assert.match(surface,/uniform2fv\(u\.cloudDrift,cloudState\.drift\)/);
  assert.match(surface,/uniform2fv\(p\.u\.cloudDrift,cloudState\.drift\)/);
  assert.match(surface,/cloudAmount>0\?await this\.texture\('clouds'/);
  assert.match(surface,/cloudAmount>0\?this\.texture\('clouds'/);
  assert.equal((surface.match(/this\.texture\('clouds',Math\.min\(4096,/g)||[]).length,2);
  assert.match(surface,/cloudTextureWidth\|\|width/);
  assert.match(surface,/job\.cloudTextureWidth\|\|job\.textureWidth/);
  assert.match(performance,/add\('clouds',Math\.min\(4096,job\.cloudTextureWidth\|\|job\.textureWidth\),job\.priority\|\|0\)/);
  assert.match(performance,/job\.id==='earth'&&job\.cloudAmount!==0/);
  assert.match(performance,/\(name==='clouds'\|\|name==='clouds-alt'\)&&desired\?\.has\('earth'\)&&desired\.get\('earth'\)\.cloudAmount!==0/);
});

test('cloud visibility and texture LOD follow the apparent Earth diameter',()=>{
  const visibility=diameter=>{const raw=Math.max(0,Math.min(1,(diameter-16)/80));return .16+.84*(raw*raw*(3-2*raw));};
  const tiers=[256,512,1024,2048,4096],lod=diameter=>tiers.find(width=>width>=Math.max(256,diameter*4))||4096;
  assert.equal(visibility(16),.16);
  assert.ok(visibility(64)>.7&&visibility(64)<.8);
  assert.equal(visibility(96),1);
  assert.equal(lod(64),256);
  assert.equal(lod(128),512);
  assert.equal(lod(1024),4096);
});

test('zero cloud amount skips every cloud source and clouded lights are softened',()=>{
  const surface=read('src/surface.js');
  assert.match(surface,/if\(cloudAmount>0\)\{/);
  assert.match(surface,/if\(cloud<=\.01\)return clear/);
  assert.match(surface,/return mix\(clear,softened,cloud\*\.48\*blurDetail\)\*\(1\.-cloud\*\.42\)/);
  assert.match(surface,/if\(blurDetail<=0\.\)return clear\*\(1\.-cloud\*\.42\)/);
  assert.equal((surface.match(/if\(nightSide>0\.&&nightLimb>0\.\)col\+=cloudVeiledNight/g)||[]).length,2,'do not sample invisible city lights');
  assert.equal((surface.match(/cloudVeiledNight\(uv,n\.z,cloud\)/g)||[]).length,2);
});

test('cloud label is translated in every generated locale',()=>{
  for(const file of fs.readdirSync(path.join(root,'src','locales')).filter(name=>name.endsWith('.json'))){
    const copy=JSON.parse(read(path.join('src','locales',file))).copy;
    assert.ok(copy.atmosphericClouds,`${file}: atmosphericClouds`);
  }
});
