'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function visualApi(){const context={window:{SolarAssets:{stars:[]}}};vm.createContext(context);vm.runInContext(read('src/visual-effects.js'),context);return context.window.SolarVisualEffects;}

test('v0.45 r3 exposes the same public version with a new patch revision',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js'),pkg=JSON.parse(read('package.json'));
  assert.match(html,/name="solar-time-version" content="0\.45"/);assert.match(html,/name="solar-time-revision" content="r3"/);
  assert.deepEqual(version,{version:'0.45',revision:'r3'});assert.equal(pkg.version,'0.0.45');assert.match(app,/version:'0\.45',revision:'r3'/);
  assert.match(html,/src\/visual-effects\.js\?v=0\.45-r3/);assert.match(html,/src\/app\.js\?v=0\.45-r3/);
});

test('language menu keeps the established order and star density defaults to 100 percent',()=>{
  const html=read('index.html'),app=read('src/app.js'),order=[...html.matchAll(/data-language="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order.slice(0,9),['kor','en','chn','jpn','eu','hi','es','de','fr']);
  assert.match(html,/id="star-density-output" for="star-density">100%<\/output>/);assert.match(html,/id="star-density" class="solar-range" type="range" min="0" max="400" step="10" value="100"/);assert.match(app,/orbitBrightness:\.5,starDensity:1/);
});

test('star positions get a fresh runtime seed on launch and factory reset rebuilds the sky',()=>{
  const effects=read('src/visual-effects.js'),app=read('src/app.js'),api=visualApi();
  assert.match(effects,/function runtimeSeed\(\)/);assert.match(effects,/getRandomValues/);assert.match(effects,/function regenerateStars\(sky\)/);
  const a=api.buildNaturalStarPool([],32,12345),b=api.buildNaturalStarPool([],32,54321);assert.notDeepEqual(a,b);
  assert.match(app,/SolarVisualEffects\?\.regenerateStars\?\.\(renderer\.sky\)/);
});

test('star pool keeps random sphere positions with independent size and brightness',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi(),stars=api.buildNaturalStarPool([],8800);assert.equal(stars.length,8800);assert.equal(api.MAX_STAR_COUNT,17600);assert.match(effects,/const z=random\(\)\*2-1,angle=random\(\)\*TAU/);
  let minSize=Infinity,maxSize=0,minBrightness=Infinity,maxBrightness=0;for(const star of stars){minSize=Math.min(minSize,star[3]);maxSize=Math.max(maxSize,star[3]);minBrightness=Math.min(minBrightness,star[4]);maxBrightness=Math.max(maxBrightness,star[4]);}
  assert.ok(maxSize-minSize>1);assert.ok(maxBrightness-minBrightness>.7);
});

test('most stars stay steady while only some twinkle and very few enter a 5-10 second rest',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi();
  assert.match(effects,/twinklePeriod=mix\(5\.0,25\.0/);assert.match(effects,/twinkles=step\(\.70,behavior\)/);assert.match(effects,/rests=step\(\.972,behavior\)/);assert.match(effects,/restHidden=mix\(5\.0,10\.0/);assert.match(effects,/restVisible=mix\(42\.0,105\.0/);
  const vertex='attribute vec3 position,appearance;uniform vec3 right,down,forward;uniform vec2 size;uniform float fov,pointScale,seconds; varying float intensity; void main(){float z=dot(position,forward),phase=appearance.z;float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);intensity=appearance.y*(.55+pulse*.65);gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);}';
  const transformed=api.transformStarShader(vertex);assert.match(transformed,/variation=mix\(\.96\+\.04\*irregular,\.58\+\.42\*irregular,twinkles\)/);assert.match(transformed,/intensity=appearance\.y\*variation\*visible/);
});

test('yellow stars are rare while red, white and blue-white remain available',()=>{
  const effects=read('src/visual-effects.js');assert.match(effects,/starTone<\.07/);assert.match(effects,/starTone<\.10/);assert.match(effects,/starTone>\.82/);assert.match(effects,/step\(\.9985/);
});

test('Sun keeps fine frequencies but softens v0.45 r1 motion another five percent',()=>{
  const effects=read('src/visual-effects.js');
  for(const token of ["['uv.y*49.','uv.y*150.']","['uv.x*PI*10.','uv.x*PI*56.']","['*.0015','*.00121125']","['*.0011','*.0009025']","-.00855+.073625*brightCycle","-.01425+.03705*darkCycle","vec3(.08075,.0247,.0019)"])assert.ok(effects.includes(token),token);
});

test('Jupiter experimental shader is removed so the stock gas-giant path is used',()=>{
  const effects=read('src/visual-effects.js');assert.doesNotMatch(effects,/JUPITER_WARP|JUPITER_COLOR|kind==5\.|job\.id==='jupiter'\?5|GRS_U|__solarJupiterFlowInstalled/);
  assert.match(effects,/Jupiter deliberately receives no override/);
});

test('v0.45 release notes match the calmer stars, softer Sun and restored Jupiter shader',()=>{
  const app=read('src/app.js');assert.match(app,/CURRENT_RELEASE=Object\.freeze\(\{version:'0\.45'/);assert.match(app,/황색 별 비중을 줄였습니다/);assert.match(app,/5~25초/);assert.match(app,/5~10초/);assert.match(app,/약 5% 더 낮춰/);assert.match(app,/기본 가스행성 셰이더로 완전히 복원/);
});
