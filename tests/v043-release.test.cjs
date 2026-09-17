'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

function visualApi(){
  const context={window:{SolarAssets:{stars:[]}}};vm.createContext(context);vm.runInContext(read('src/visual-effects.js'),context);return context.window.SolarVisualEffects;
}

test('v0.43 stays public version 0.43 while advancing only the patch revision',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js');
  assert.match(html,/name="solar-time-version" content="0\.43"/);assert.match(html,/name="solar-time-revision" content="r3"/);
  assert.deepEqual(version,{version:'0.43',revision:'r3'});assert.match(html,/src\/assets\.js\?v=assetpack-20260917-r7/);assert.match(app,/version:'0\.43',revision:'r3'/);
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

test('particle stars use true random sphere positions with independent size and brightness',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi(),stars=api.buildNaturalStarPool([],8800);
  assert.equal(stars.length,8800);assert.equal(api.MAX_STAR_COUNT,17600);
  assert.match(effects,/const z=random\(\)\*2-1,angle=random\(\)\*TAU/);
  assert.doesNotMatch(effects,/GOLDEN|radicalInverse/);
  const octants=Array(8).fill(0);let minSize=Infinity,maxSize=0,minBrightness=Infinity,maxBrightness=0;
  for(const star of stars){const oct=(star[0]>=0?1:0)+(star[1]>=0?2:0)+(star[2]>=0?4:0);octants[oct]++;minSize=Math.min(minSize,star[3]);maxSize=Math.max(maxSize,star[3]);minBrightness=Math.min(minBrightness,star[4]);maxBrightness=Math.max(maxBrightness,star[4]);}
  assert.ok(Math.max(...octants)-Math.min(...octants)<160,octants.join(','));
  assert.ok(maxSize-minSize>1);assert.ok(maxBrightness-minBrightness>.7);
});

test('star shader randomizes colour and twinkle period and keeps cross flares rare',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi();
  assert.match(effects,/mix\(2\.4,18\.0/);assert.match(effects,/step\(\.9975/);
  assert.match(effects,/vec3\(1\.,\.79,\.72\)/);assert.match(effects,/vec3\(1\.,\.92,\.76\)/);assert.match(effects,/vec3\(\.76,\.87,1\.\)/);
  const vertex='attribute vec3 position,appearance;uniform vec3 right,down,forward;uniform vec2 size;uniform float fov,pointScale,seconds; varying float intensity; void main(){float z=dot(position,forward),phase=appearance.z;float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);intensity=appearance.y*(.55+pulse*.65);gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);}';
  const fragment='precision mediump float;varying float intensity;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float halo=1.-smoothstep(.08,.5,d),core=1.-smoothstep(.015,.21,d);float cross=(1.-smoothstep(.012,.042,min(abs(q.x),abs(q.y))))*(1.-smoothstep(.12,.5,max(abs(q.x),abs(q.y))));float alpha=(halo*.24+core*.94+cross*.14)*intensity;if(alpha<.002)discard;vec3 color=mix(vec3(.45,.66,.94),vec3(1.,.99,.96),core);gl_FragColor=vec4(color,alpha);}';
  assert.match(api.transformStarShader(vertex),/period=mix\(2\.4,18\.0/);assert.match(api.transformStarShader(fragment),/starTone<\.08/);assert.match(api.transformStarShader(fragment),/cross\*\.62\*flarePulse/);
});

test('Sun uses stronger fine-scale motion while preserving the original time coefficients',()=>{
  const effects=read('src/visual-effects.js');
  for(const token of ["['uv.y*49.','uv.y*150.']","['uv.x*PI*10.','uv.x*PI*56.']","['uv.x*PI*16.','uv.x*PI*48.']","['uv.y*31.','uv.y*138.']","['*.0015','*.00255']","['*.0011','*.00190']"])assert.ok(effects.includes(token),token);
  assert.doesNotMatch(effects,/\['effectTime\*\.24'/);assert.doesNotMatch(effects,/\['effectTime\*\.73'/);assert.doesNotMatch(effects,/\['effectTime\*\.41'/);
});

test('Jupiter has visible differential jets plus a slow local Great Red Spot vortex',()=>{
  const effects=read('src/visual-effects.js');
  assert.match(effects,/job\.id==='jupiter'\?5/);assert.match(effects,/const float GRS_U=\.6944444444/);assert.match(effects,/const float GRS_V=\.6222222222/);
  assert.match(effects,/grsAngle=-effectTime\*\.022\*grsMask/);assert.match(effects,/jetSpeed=\.00042\+jetA\*\.00031\+jetB\*\.00016/);
  assert.match(effects,/eddy=.*\*\.00145/);assert.match(effects,/base\*=\.964\+\.060/);
});
