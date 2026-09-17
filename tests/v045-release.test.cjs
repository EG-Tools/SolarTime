'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

function visualApi(){
  const context={window:{SolarAssets:{stars:[]}}};vm.createContext(context);vm.runInContext(read('src/visual-effects.js'),context);return context.window.SolarVisualEffects;
}

test('v0.45 exposes public version 0.45 with revision r1',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js'),pkg=JSON.parse(read('package.json'));
  assert.match(html,/name="solar-time-version" content="0\.45"/);assert.match(html,/name="solar-time-revision" content="r1"/);
  assert.deepEqual(version,{version:'0.45',revision:'r1'});assert.equal(pkg.version,'0.0.45');assert.match(app,/version:'0\.45',revision:'r1'/);
  assert.match(html,/src\/assets\.js\?v=assetpack-20260917-r7/);
});

test('language menu keeps the established order',()=>{
  const html=read('index.html'),order=[...html.matchAll(/data-language="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order.slice(0,9),['kor','en','chn','jpn','eu','hi','es','de','fr']);
});

test('star density remains 200 percent by default with no divider',()=>{
  const html=read('index.html'),app=read('src/app.js'),css=read('src/runtime-optimizations.css');
  assert.ok(html.indexOf('id="orbit-brightness-control"')<html.indexOf('id="star-density-control"'));
  assert.match(html,/id="star-density-output" for="star-density">200%<\/output>/);
  assert.match(html,/id="star-density" class="solar-range" type="range" min="0" max="400" step="10" value="200"/);
  assert.match(app,/orbitBrightness:\.5,starDensity:2/);assert.match(css,/#star-density-control\{border-top:0;margin-top:0;padding-top:5px\}/);
});

test('star pool uses random sphere positions plus independent size and brightness',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi(),stars=api.buildNaturalStarPool([],8800);
  assert.equal(stars.length,8800);assert.equal(api.MAX_STAR_COUNT,17600);assert.match(effects,/const z=random\(\)\*2-1,angle=random\(\)\*TAU/);
  let minSize=Infinity,maxSize=0,minBrightness=Infinity,maxBrightness=0;const octants=Array(8).fill(0);
  for(const star of stars){const oct=(star[0]>=0?1:0)+(star[1]>=0?2:0)+(star[2]>=0?4:0);octants[oct]++;minSize=Math.min(minSize,star[3]);maxSize=Math.max(maxSize,star[3]);minBrightness=Math.min(minBrightness,star[4]);maxBrightness=Math.max(maxBrightness,star[4]);}
  assert.ok(Math.max(...octants)-Math.min(...octants)<200,octants.join(','));assert.ok(maxSize-minSize>1);assert.ok(maxBrightness-minBrightness>.7);
});

test('stars use 5-25 second twinkle periods and independent 5-10 second hidden rests',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi();
  assert.match(effects,/visiblePeriod=mix\(5\.0,25\.0/);assert.match(effects,/hiddenPeriod=mix\(5\.0,10\.0/);assert.match(effects,/visible=1\.-step\(visiblePeriod,cycleTime\)/);
  assert.match(effects,/step\(\.9975/);assert.match(effects,/vec3\(1\.,\.79,\.72\)/);assert.match(effects,/vec3\(1\.,\.92,\.76\)/);assert.match(effects,/vec3\(\.76,\.87,1\.\)/);
  const vertex='attribute vec3 position,appearance;uniform vec3 right,down,forward;uniform vec2 size;uniform float fov,pointScale,seconds; varying float intensity; void main(){float z=dot(position,forward),phase=appearance.z;float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);intensity=appearance.y*(.55+pulse*.65);gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);}';
  const transformed=api.transformStarShader(vertex);assert.match(transformed,/visiblePeriod=mix\(5\.0,25\.0/);assert.match(transformed,/hiddenPeriod=mix\(5\.0,10\.0/);assert.match(transformed,/pulse=pow\(wave,sharp\)\*visible/);
});

test('Sun keeps fine spatial frequencies but halves the stronger v0.43 motion amplitude',()=>{
  const effects=read('src/visual-effects.js');
  for(const token of ["['uv.y*49.','uv.y*150.']","['uv.x*PI*10.','uv.x*PI*56.']","['uv.x*PI*16.','uv.x*PI*48.']","['uv.y*31.','uv.y*138.']","['*.0015','*.001275']","['*.0011','*.00095']"])assert.ok(effects.includes(token),token);
  assert.match(effects,/-.009\+\.0775\*brightCycle/);assert.match(effects,/-.015\+\.039\*darkCycle/);
});

test('Jupiter retains differential jets and Great Red Spot vortex at half the v0.43 strength',()=>{
  const effects=read('src/visual-effects.js');
  assert.match(effects,/job\.id==='jupiter'\?5/);assert.match(effects,/const float GRS_U=\.6944444444/);assert.match(effects,/const float GRS_V=\.6222222222/);
  assert.match(effects,/grsAngle=-effectTime\*\.011\*grsMask/);assert.match(effects,/jetSpeed=\.00021\+jetA\*\.000155\+jetB\*\.00008/);
  assert.match(effects,/eddy=.*\*\.000725/);assert.match(effects,/eddy2=.*\*\.00041/);assert.match(effects,/base\*=\.982\+\.030/);
});

test('v0.45 release notes describe star timing and moderated Sun/Jupiter effects',()=>{
  const app=read('src/app.js');
  assert.match(app,/CURRENT_RELEASE=Object\.freeze\(\{version:'0\.45'/);assert.match(app,/5~25초/);assert.match(app,/5~10초/);assert.match(app,/약 50% 낮춰/);
  assert.match(app,/PREVIOUS_RELEASE=Object\.freeze\(\{version:'0\.43'/);assert.match(app,/SECOND_PREVIOUS_RELEASE=Object\.freeze\(\{version:'0\.42'/);
});
