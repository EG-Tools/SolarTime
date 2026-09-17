'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('v0.43 stays public version 0.43 while advancing the patch revision',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js');
  assert.match(html,/name="solar-time-version" content="0\.43"/);assert.match(html,/name="solar-time-revision" content="r2"/);
  assert.deepEqual(version,{version:'0.43',revision:'r2'});assert.match(html,/src\/assets\.js\?v=assetpack-20260917-r7/);assert.match(app,/version:'0\.43',revision:'r2'/);
});

test('language menu keeps the established order',()=>{
  const html=read('index.html'),order=[...html.matchAll(/data-language="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order.slice(0,9),['kor','en','chn','jpn','eu','hi','es','de','fr']);
});

test('star density defaults and factory reset use 200 percent with no divider',()=>{
  const html=read('index.html'),app=read('src/app.js'),css=read('src/runtime-optimizations.css');
  assert.ok(html.indexOf('id="orbit-brightness-control"')<html.indexOf('id="star-density-control"'));
  assert.match(html,/id="star-density-output" for="star-density">200%<\/output>/);
  assert.match(html,/id="star-density" class="solar-range" type="range" min="0" max="400" step="10" value="200"/);
  assert.match(app,/orbitBrightness:\.5,starDensity:2/);assert.match(app,/saved\.starDensity\)\)renderer\.options\.starDensity=A\.clamp\(saved\.starDensity,0,4\)/);
  assert.match(css,/#star-density-control\{border-top:0;margin-top:0;padding-top:5px\}/);
});

test('particle-star pool is uniform across every prefix and capped at 17600',()=>{
  const effects=read('src/visual-effects.js');
  assert.match(effects,/BASE_STAR_COUNT=4400,MAX_STAR_MULTIPLIER=4,MAX_STAR_COUNT=BASE_STAR_COUNT\*MAX_STAR_MULTIPLIER/);
  assert.match(effects,/function radicalInverse\(index\)/);assert.match(effects,/\(i\+1\)\*GOLDEN/);assert.match(effects,/uniformStarPool/);
  assert.match(effects,/Math\.round\(BASE_STAR_COUNT\*density\)/);assert.match(effects,/options\.starDensity\?\?2/);
});

test('Sun uses finer lower-amplitude motion without changing time speed',()=>{
  const effects=read('src/visual-effects.js');
  for(const token of ["['uv.y*49.','uv.y*130.']","['uv.x*PI*10.','uv.x*PI*48.']","['uv.x*PI*16.','uv.x*PI*64.']","['uv.y*31.','uv.y*150.']","['uv.x*PI*6.','uv.x*PI*48.']","['uv.y*11.','uv.y*126.']","['uv.x*PI*14.','uv.x*PI*64.']","['uv.y*19.','uv.y*176.']","['*.0015','*.00085']","['*.0011','*.00065']"])assert.ok(effects.includes(token),token);
  assert.doesNotMatch(effects,/\['effectTime\*\.24'/);assert.doesNotMatch(effects,/\['effectTime\*\.73'/);assert.doesNotMatch(effects,/\['effectTime\*\.41'/);
});

test('Jupiter receives a dedicated differential atmospheric flow shader',()=>{
  const effects=read('src/visual-effects.js');
  assert.match(effects,/job\.id==='jupiter'\?5/);assert.match(effects,/if\(kind==5\.\)/);
  assert.match(effects,/float jet=sin\(uv\.y\*PI\*14\.\)/);assert.match(effects,/float drift=effectTime\*\(\.000018\+jet\*\.000012\)/);
  assert.match(effects,/float eddy=sin\(uv\.x\*PI\*18\.\+uv\.y\*45\.-effectTime\*\.16\)/);
});
