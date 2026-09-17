'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('v0.43 exposes the new public version without changing the asset pack',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js');
  assert.match(html,/name="solar-time-version" content="0\.43"/);
  assert.match(html,/name="solar-time-revision" content="r1"/);
  assert.deepEqual(version,{version:'0.43',revision:'r1'});
  assert.match(html,/src\/assets\.js\?v=assetpack-20260917-r7/);
  assert.match(app,/version:'0\.43',revision:'r1'/);
});

test('language menu keeps the established order',()=>{
  const html=read('index.html');
  const order=[...html.matchAll(/data-language="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order.slice(0,9),['kor','en','chn','jpn','eu','hi','es','de','fr']);
});

test('star density slider defaults to the previous sky and persists from 0 to 400 percent',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.ok(html.indexOf('id="orbit-brightness-control"')<html.indexOf('id="star-density-control"'));
  assert.match(html,/id="star-density" class="solar-range" type="range" min="0" max="400" step="10" value="100"/);
  assert.match(app,/orbitBrightness:\.5,starDensity:1/);
  assert.match(app,/saved\.starDensity\)\)renderer\.options\.starDensity=A\.clamp\(saved\.starDensity,0,4\)/);
  assert.match(app,/setOption\('starDensity',Number\(\$\('star-density'\)\.value\)\/100\)/);
  assert.match(app,/syncStarDensityControl\(\)/);
});

test('particle-star pool is fixed at 17600 while the draw count follows density',()=>{
  const effects=read('src/visual-effects.js');
  assert.match(effects,/BASE_STAR_COUNT=4400,MAX_STAR_MULTIPLIER=4,MAX_STAR_COUNT=BASE_STAR_COUNT\*MAX_STAR_MULTIPLIER/);
  assert.match(effects,/randomGenerator\(204031\)/);
  assert.match(effects,/Math\.round\(BASE_STAR_COUNT\*density\)/);
  assert.match(effects,/this\.starCount=drawCount/);
  assert.match(effects,/source\.slice\(0,count\)/);
});

test('Sun shader detail is doubled spatially without changing its time coefficients',()=>{
  const effects=read('src/visual-effects.js'),surface=read('src/surface.js');
  for(const [from,to] of [['uv.y*49.','uv.y*98.'],['uv.x*PI*10.','uv.x*PI*20.'],['uv.x*PI*16.','uv.x*PI*32.'],['uv.y*31.','uv.y*62.'],['uv.x*PI*6.','uv.x*PI*12.'],['uv.y*11.','uv.y*22.'],['uv.x*PI*14.','uv.x*PI*28.'],['uv.y*19.','uv.y*38.']]){
    assert.ok(effects.includes(`['${from}','${to}']`),`${from} -> ${to}`);
  }
  assert.match(surface,/effectTime\*\.24/);
  assert.match(surface,/effectTime\*\.73/);
  assert.match(surface,/effectTime\*\.41/);
  assert.match(effects,/!source\.includes\('sunActivity'\)\|\|!source\.includes\('kind==2\.'\)/);
});
