'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Earth card owns one persisted night-lights switch',()=>{
  const html=read('index.html'),app=read('src/app.js'),renderer=read('src/renderer.js');
  assert.match(html,/id="earth-night-lights-control"[^>]*hidden/);
  assert.match(html,/id="earth-night-lights"[^>]*role="switch"[^>]*checked/);
  assert.match(app,/earthNightLights:true/);
  assert.match(app,/earthNightLights:'earth-night-lights'/);
  assert.match(app,/earth-night-lights-control'\)\.hidden=body\.id!=='earth'/);
  assert.match(renderer,/job\.nightLights=body\.id==='earth'&&this\.options\.earthNightLights!==false/);
  assert.match(renderer,/const nightDemand=Math\.max\(128,screenDiameter\*2\)/);
  assert.match(renderer,/job\.nightTextureWidth=job\.nightLights\?Math\.min\(SURFACE\.detailWidth,nightTextureWidth\):0/);
});

test('Sun card owns the persisted shine switch instead of global settings',()=>{
  const html=read('index.html'),app=read('src/app.js');
  const settings=html.slice(html.indexOf('id="settings-panel"'),html.indexOf('id="body-panel"'));
  const bodyCard=html.slice(html.indexOf('id="body-panel"'),html.indexOf('id="view-controls"'));
  const options=bodyCard.indexOf('id="body-card-options"'),alignment=bodyCard.indexOf('id="alignment-control"');
  assert.doesNotMatch(settings,/id="show-activity"/);
  assert.ok(alignment>=0&&alignment<options,'body-specific switches must remain at the bottom of the card');
  assert.match(bodyCard,/id="sun-shine-control"[^>]*hidden/);
  assert.match(bodyCard,/id="show-activity"[^>]*checked[^>]*role="switch"/);
  assert.match(app,/activity:'show-activity'/);
  assert.match(app,/sun-shine-control'\)\.hidden=body\.id!=='sun'/);
});

test('night radiance is sampled only on Earth darkness and partially veiled by clouds',()=>{
  const surface=read('src/surface.js'),performance=read('src/performance.js');
  assert.match(surface,/sampler2D colorMap,bumpMap,cloudsMap,nightMap/);
  assert.match(surface,/nightSide=\(1\.-smoothstep\(-\.34,\.30,mu\)\)\*nightLights/);
  assert.match(surface,/vec3 stableNight\(vec2 uv,float facing\)/);
  assert.match(surface,/footprint=min\(nightTexel\*16\.,max\(nightTexel,1\.\/\(PI\*max\(diameter,1\.\)\*max\(facing,\.06\)\)\)\)/);
  assert.equal((surface.match(/stableNight\(uv,n\.z\)/g)||[]).length,2);
  assert.equal((surface.match(/smoothstep\(\.035,\.18,n\.z\)/g)||[]).length,2);
  assert.match(surface,/job\.id==='earth'&&job\.nightLights\?this\.texture\('earth-night',Math\.min\(4096,job\.nightTextureWidth\|\|job\.textureWidth\)\):null/);
  assert.match(surface,/stableNight\(uv,n\.z\)\*nightSide\*\(1\.-cloud\*\.68\)\*1\.05\*nightLimb/);
  assert.match(surface,/uniform1f\(p\.u\.nightTexel,1\/\(night\?\.width\|\|color\.width\)\)/);
  assert.match(surface,/nightSide=\(1-smooth\(-\.34,\.30,mu\)\)\*\(1-cover\*\.68\)\*1\.05\*nightLimb/);
  assert.match(performance,/name==='earth-night'&&desired\?\.get\('earth'\)\?\.nightLights/);
  assert.match(performance,/Math\.min\(4096,job\.nightTextureWidth\|\|job\.textureWidth\)/);
});

test('NASA-derived night map is tiered, credited and translated everywhere',()=>{
  const manifest=JSON.parse(read('assets/manifest.json')),entry=manifest.materials['earth-night'];
  assert.equal(entry.width,4096);assert.equal(entry.height,2048);assert.deepEqual(entry.tiers.map(row=>row.width),[256,512,1024,2048,4096]);
  const generator=read('tools/prepare-earth-night.cjs');
  assert.match(read('assets/CREDITS.md'),/(?:Black Marble[^\n]*2016|2016 Black Marble)/);assert.match(generator,/measured night lights/i);
  assert.match(generator,/BlackMarble_2016_3km_gray\.jpg/);assert.match(generator,/sharp\.kernel\.lanczos3/);
  assert.doesNotMatch(generator,/warmSignal|neutralSignal|\.blur\(|threshold\(/);
  for(const file of fs.readdirSync(path.join(root,'src','locales')).filter(name=>name.endsWith('.json'))){
    const copy=JSON.parse(read(path.join('src','locales',file))).copy;assert.ok(copy.earthNightLights,`${file}: earthNightLights`);
  }
});
