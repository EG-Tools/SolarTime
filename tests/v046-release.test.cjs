'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function notesApi(){return require('../src/release-notes.js');}
const notesFor=version=>{const api=notesApi();return api.itemsFor(api.RELEASES.find(r=>r.version===version),'kor').join(' ');};
function visualApi(){const context={window:{SolarAssets:{stars:[]}}};vm.createContext(context);vm.runInContext(read('src/visual-effects.js'),context);return context.window.SolarVisualEffects;}

test('v0.46 page build stays consistent while unchanged coordinator keeps its bundle revision',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js'),pkg=JSON.parse(read('package.json'));
  assert.ok(html.includes('name="solar-time-version" content="0.47"'));
  assert.ok(html.includes('name="solar-time-revision" content="'+version.revision+'"'));
  assert.match(version.revision,/^r[1-9]\d*$/);
  assert.equal(version.version,'0.47');
  assert.equal(pkg.version,'0.0.47');
  assert.ok(app.includes("version:'0.47',revision:'r2'"));
  assert.ok(html.includes('src/app.js?v=0.47-r2'));
  assert.ok(html.includes('src/localization.js?v=0.47-r1'));
});
test('language menu keeps the established order and star density defaults to 100 percent',()=>{
  const html=read('index.html'),app=read('src/app.js'),order=[...html.matchAll(/data-language="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order,['kor','en','chn','ao','ar','au','at','br','ca','cl','co','cr','ec','fr','de','hi','id','ie','it','jpn','mx','mz','nz','pa','pe','pt','sg','es','eu','uy','ve']);
  assert.match(html,/id="star-density-output" for="star-density">100%<\/output>/);assert.match(html,/id="star-density" class="solar-range" type="range" min="0" max="300" step="10" value="100"/);assert.match(app,/orbitBrightness:\.5,starDensity:1/);
});

test('star positions get a fresh runtime seed on launch and factory reset rebuilds the sky',()=>{
  const effects=read('src/visual-effects.js'),app=read('src/app.js'),api=visualApi();
  assert.match(effects,/function runtimeSeed\(\)/);assert.match(effects,/getRandomValues/);assert.match(effects,/function regenerateStars\(sky\)/);
  const a=api.buildNaturalStarPool([],32,12345),b=api.buildNaturalStarPool([],32,54321);assert.notDeepEqual(a,b);
  assert.match(app,/SolarVisualEffects\?\.regenerateStars\?\.\(renderer\.sky\)/);
});

test('star pool keeps random sphere positions with independent size and brightness',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi(),stars=api.buildNaturalStarPool([],8800);assert.equal(stars.length,8800);assert.equal(api.BASE_STAR_COUNT,10000);assert.equal(api.MAX_STAR_MULTIPLIER,3);assert.equal(api.MAX_STAR_COUNT,30000);assert.match(effects,/const z=random\(\)\*2-1,angle=random\(\)\*TAU/);
  let minSize=Infinity,maxSize=0,minBrightness=Infinity,maxBrightness=0;for(const star of stars){minSize=Math.min(minSize,star[3]);maxSize=Math.max(maxSize,star[3]);minBrightness=Math.min(minBrightness,star[4]);maxBrightness=Math.max(maxBrightness,star[4]);}
  assert.ok(maxSize-minSize>1);assert.ok(maxBrightness-minBrightness>.7);
});

test('most stars stay steady while only some twinkle and very few enter a 5-10 second rest',()=>{
  const effects=read('src/visual-effects.js'),api=visualApi();
  assert.match(effects,/twinklePeriod=mix\(5\.0,25\.0/);assert.match(effects,/twinkles=step\(\.70,behavior\)/);assert.match(effects,/rests=step\(\.972,behavior\)/);assert.match(effects,/restHidden=mix\(5\.0,10\.0/);assert.match(effects,/restVisible=mix\(42\.0,105\.0/);
  const vertex='attribute vec3 position,appearance;uniform vec3 right,down,forward;uniform vec2 size;uniform float fov,pointScale,seconds; varying float intensity; void main(){float z=dot(position,forward),phase=appearance.z;float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);intensity=appearance.y*(.55+pulse*.65);gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);}';
  const transformed=api.starShaderSources('highp').vertex;assert.match(transformed,/variation=mix\(\.96\+\.04\*irregular,\.58\+\.42\*irregular,twinkles\)/);assert.match(transformed,/lively=step\(\.55,appearance\.x\)/);
});

test('yellow stars are rare while red, white and blue-white remain available',()=>{
  const api=visualApi(),p=api.STAR_PALETTE;assert.equal(p.redEnd,.049);assert.ok(Math.abs(p.warmEnd-p.redEnd-.021)<1e-12);assert.equal(p.blueStart,.805);assert.match(read('src/visual-effects.js'),/step\(\.9985/);
});

test('Sun keeps approved fine frequencies and softened motion parameters',()=>{const {sun}=require('../src/surface-style.js');assert.equal(sun.warpY,150);assert.equal(sun.warpX,56);assert.equal(sun.warpAmountX,.00121125);assert.equal(sun.warpAmountY,.0009025);assert.equal(sun.brightBase,-.00855);assert.equal(sun.brightAmount,.073625);assert.equal(sun.darkBase,-.01425);assert.equal(sun.darkAmount,.03705);assert.deepEqual(sun.glow,[.08075,.0247,.0019]);});

test('Jupiter experimental shader is removed so the stock gas-giant path is used',()=>{
  const effects=read('src/visual-effects.js');assert.doesNotMatch(effects,/JUPITER_WARP|JUPITER_COLOR|kind==5\.|job\.id==='jupiter'\?5|GRS_U|__solarJupiterFlowInstalled/);
  assert.doesNotMatch(read('src/surface-style.js'),/jupiter|kind==5/);
});

test('v0.45 release notes match the calmer stars, softer Sun and restored Jupiter shader',()=>{
  const notes=notesFor('0.45');for(const text of ['황색 별 비중을 줄였습니다','5~25초','5~10초','약 5% 더 낮춰','기본 가스행성 셰이더로 완전히 복원'])assert.ok(notes.includes(text),text);
});

test('right mouse drag temporarily dollies the camera without changing the wheel mode',()=>{
  const app=read('src/app.js');
  assert.match(app,/event\.button!==0&&event\.button!==1&&event\.button!==2/);
  assert.match(app,/dolly=event\.pointerType==='mouse'&&event\.button===2/);
  assert.match(app,/startDolly:renderer\.camera\.dolly\?\?1/);
  assert.match(app,/drag\.mode==='dolly'\)renderer\.setDolly\(drag\.startDolly\*Math\.exp\(\(drag\.startY-p\.y\)\*\.006\),renderer\.selected\)/);
  assert.match(app,/canvas\.addEventListener\('contextmenu',event=>event\.preventDefault\(\)\)/);
  assert.doesNotMatch(app,/drag\.mode==='dolly'[\s\S]{0,200}setDollyMode/);
});

test('v0.43 notes no longer advertise the discarded Jupiter shader experiment',()=>{
  const api=notesApi(),release=api.RELEASES.find(r=>r.version==='0.43');for(const code of ['kor','en','chn','jpn','es','de','fr'])assert.doesNotMatch(api.itemsFor(release,code).join(' '),/대적점|Great Red Spot|大红斑|大赤斑|Gran Mancha Roja|Großen Roten Fleck|Grande Tache rouge/);assert.match(notesFor('0.43'),/GPU에 한 번 올린 뒤 슬라이더 값에 따라 그리는 개수만 바꾸도록/);
});

test('v0.45 notes include the right-drag dolly control',()=>{
  assert.match(notesFor('0.45'),/마우스 오른쪽 버튼을 누른 채 위아래로 드래그/);
});


test('r6 pushes the starfield farther away without slowing the background drift',()=>{
  const effects=read('src/visual-effects.js'),sky=read('src/sky.js'),renderer=read('src/renderer.js'),html=read('index.html');
  assert.match(effects,/size=clamp\(size,\.14,1\.52\)\*\.82/);
  assert.match(effects,/lively=step\(\.55,appearance\.x\)/);
  assert.match(effects,/flarePulse\*13\.12/);
  assert.match(sky,/DRIFT=\.22\*Math\.PI\/180/);
  assert.match(sky,/pow\(haze,vec3\(\.95\)\)\*\.5984/);
  assert.match(sky,/255\*\.5896/);
  assert.match(renderer,/AUTO_ROTATE_SPEED=1\.8\*DEG/);
  assert.match(html,/src\/sky\.js\?v=0\.47-r2/);
  assert.ok(html.includes('src/renderer.js?v='));
});
test('tiny-star stability uses pixel-area filtering, not just the former r7 footprint clamp',()=>{
  const effects=read('src/visual-effects.js'),sky=read('src/sky.js'),renderer=read('src/renderer.js'),html=read('index.html'),api=visualApi();
  assert.match(effects,/tinyStar=1\.-lively/);
  assert.match(effects,/max\(basePoint,3\.0\)/);
  assert.match(effects,/tinyEnergy\*covered\.x\*covered\.y\*intensity/);
  assert.match(api.starShaderSources("highp").fragment,/varying highp float intensity,starTone,flarePulse,tinyStar/);
  assert.match(sky,/Math\.sqrt\(8388608\/\(w\*h\)\)/);
  assert.doesNotMatch(sky,/pulse=Math\.max\(0,Math\.sin\(t\*TAU\)\)\*\*16/);
  assert.match(sky,/if\(r<\.55\)\{root\.SolarVisualEffects\.drawTinyStar/);
  assert.match(sky,/DRIFT=\.22\*Math\.PI\/180/);
  assert.match(renderer,/AUTO_ROTATE_SPEED=1\.8\*DEG/);
  assert.match(html,/src\/sky\.js\?v=0\.47-r2/);
  assert.match(html,/src\/visual-effects\.js\?v=0\.47-r2/);
});
test('r8 maps 100 200 and 300 percent to 10000 20000 and 30000 stars',()=>{
  const effects=read('src/visual-effects.js'),html=read('index.html'),app=read('src/app.js'),api=visualApi();
  assert.equal(api.BASE_STAR_COUNT,10000);assert.equal(api.MAX_STAR_MULTIPLIER,3);assert.equal(api.MAX_STAR_COUNT,30000);
  assert.match(effects,/Math\.round\(BASE_STAR_COUNT\*density\)/);
  assert.match(html,/id=\"star-density\" class=\"solar-range\" type=\"range\" min=\"0\" max=\"300\" step=\"10\" value=\"100\"/);
  assert.match(app,/A\.clamp\(saved\.starDensity,0,3\)/);
});

test('r10 adds Indonesia and keeps every country on the existing regional-time path',()=>{
  const html=read('index.html'),app=read('src/app.js'),localization=read('src/localization.js'),loader=read('src/language-data.js');
  assert.ok(app.includes("LANG_ORDER=['kor','en','chn','ao','ar','au','at','br','ca','cl','co','cr','ec','fr','de','hi','id','ie','it','jpn','mx','mz','nz','pa','pe','pt','sg','es','eu','uy','ve']"));
  assert.ok(app.includes("id:{code:'ID',name:'Indonesia',locale:'id-ID',html:'id',copy:'id'}"));
  assert.ok(app.includes("id:{label:'INDONESIA',timeZone:'Asia/Jakarta'"));
  assert.ok(app.includes("eu:{code:'UK',name:'United Kingdom',locale:'en-GB',html:'en-GB',copy:'en'}"));
  assert.ok(app.includes("eu:{label:'UNITED KINGDOM',timeZone:'Europe/London'"));
  assert.match(app,/language=next;renderer\.setSite\(activeRegion\(\)\);translateStatic\(\);renderReleaseNotes\(\);refreshTimeFormats\(\)/);
  assert.match(localization,/jakarta\|pontianak\|makassar\|ujung_pandang\|jayapura/);
  assert.ok(loader.includes("'pt','it','id'"));
  for(const code of ['pt','br','it','mx','id'])assert.ok(html.includes('data-language="'+code+'"'));
  const en=JSON.parse(read('src/locales/en.json')),ind=JSON.parse(read('src/locales/id.json'));
  assert.deepEqual(Object.keys(ind.copy).sort(),Object.keys(en.copy).sort());
  assert.deepEqual(Object.keys(ind.bodies).sort(),Object.keys(en.bodies).sort());
  assert.deepEqual(Object.keys(ind.phases).sort(),Object.keys(en.phases).sort());
});
test('r10 language card keeps the same size and shared scroll-cue system',()=>{
  const html=read('index.html'),css=read('styles.css'),app=read('src/app.js');
  assert.match(html,/id="language-scroll" class="language-scroll"/);assert.match(html,/language-menu[\s\S]*scroll-cue-up[\s\S]*scroll-cue-down/);
  assert.match(css,/height:min\(318px,calc\(100vh - 95px\)\)/);assert.match(css,/\.language-scroll\{height:100%;overflow-x:hidden;overflow-y:auto/);
  assert.match(app,/updateLanguageScrollCues=bindScrollCues\(languageMenu,languageScroll\)/);
});

test('r10 removes the extra WebGL star canvas while keeping the safe r9 optimizations',()=>{
  const html=read('index.html'),effects=read('src/visual-effects.js'),sky=read('src/sky.js'),surface=read('src/surface.js'),performance=read('src/performance.js');
  assert.ok(!html.includes('src/star-layer.js'));
  assert.ok(!fs.existsSync(path.join(root,'src/star-layer.js')));
  assert.ok(html.includes('src/sky.js?v=0.47-r2'));
  assert.match(sky,/Math\.sqrt\(8388608\/\(w\*h\)\)/);
  assert.match(sky,/g\.drawArrays\(g\.POINTS,0,drawCount\)/);
  assert.match(effects,/function buildNaturalStarData/);
  assert.match(effects,/SolarAssets\.starData=data/);
  assert.match(sky,/source instanceof Float32Array/);
  assert.match(surface,/materialCanvas\(bitmap,w,h,readPixels=false,seamBaked=false\)/);
  assert.match(surface,/this\.attribute=g\.getAttribLocation\(program,'a'\)/);
  assert.match(performance,/stats\?\.texturePixels\|\|0\)\*4/);
  assert.match(performance,/__solarLastTextureTrim/);
});


test('r11 reuses existing language bundles for additional countries',()=>{
  const html=read('index.html'),app=read('src/app.js'),localization=read('src/localization.js');
  const expected=['kor','en','chn','ao','ar','au','at','br','ca','cl','co','cr','ec','fr','de','hi','id','ie','it','jpn','mx','mz','nz','pa','pe','pt','sg','es','eu','uy','ve'];
  const order=[...html.matchAll(/data-language="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order,expected);

  const bundleMap={
    ao:'pt',ar:'es',au:'en',at:'de',ca:'en',cl:'es',co:'es',cr:'es',ec:'es',
    ie:'en',mz:'pt',nz:'en',pa:'es',pe:'es',uy:'es',ve:'es'
  };
  for(const [code,bundle] of Object.entries(bundleMap)){
    assert.ok(html.includes('data-language="'+code+'"'),code+' menu');
    assert.ok(app.includes(code+':{code:"'),code+' meta');
    const start=app.indexOf(code+':{code:"');
    const end=app.indexOf('}',start);
    const block=app.slice(start,end+1);
    assert.ok(block.includes('copy:"'+bundle+'"'),code+' bundle');
  }

  const zones={
    ca:'America/Toronto',
    ar:'America/Argentina/Buenos_Aires',
    au:'Australia/Sydney',
    nz:'Pacific/Auckland',
    ao:'Africa/Luanda',
    mz:'Africa/Maputo',
    at:'Europe/Vienna'
  };
  for(const [code,zone] of Object.entries(zones)){
    const start=app.indexOf(code+':{label:"');
    const end=app.indexOf('}',start);
    const block=app.slice(start,end+1);
    assert.ok(start>=0,code+' region');
    assert.ok(block.includes('timeZone:"'+zone+'"'),code+' timezone');
  }

  assert.match(app,/STAR_DENSITY_COPY\[copyLanguage\(\)\]/);
  for(const token of ["['en-ca','ca']","['es-ar','ar']","['pt-ao','ao']","['de-at','at']"])
    assert.ok(localization.includes(token),token);
});


test('r12 simplifies and reorders the right-side view controls',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.ok(!html.includes('id="zoom-in"'));
  assert.ok(!html.includes('id="zoom-out"'));
  assert.ok(!app.includes("'zoom-in'"));
  assert.ok(!app.includes("'zoom-out'"));
  const start=html.indexOf('<div id="view-controls"'),end=html.indexOf('<section class="playback ui"',start),block=html.slice(start,end);
  assert.ok(block.includes('id="zoom-value"'));
  const ordered=['id="fit-view"','id="camera-preset-1"','id="camera-preset-2"','id="camera-preset-3"','id="camera-mode-toggle"','id="rotate-left"','id="rotate-right"','id="zen-toggle"'];
  let cursor=-1;
  for(const token of ordered){const next=block.indexOf(token);assert.ok(next>cursor,token+' order');cursor=next;}
  assert.ok(app.includes("key==='+'||key==='='"));
  assert.ok(app.includes("key==='-'"));
});
test('v0.46 r3 keeps install icons on R2 and forces PNG MIME delivery',()=>{
  const html=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest')),site=read('tools/cloudflare-site.cjs'),worker=read('cloudflare/worker.js'),wrangler=JSON.parse(read('wrangler.jsonc'));
  assert.ok(html.includes('https://solar-time.keg0320.workers.dev/media/releases/content/ui/apple-touch-icon.png?v=0.46-r3'));
  assert.equal((html.match(/data-life-user-watermark/g)||[]).length,2);
  assert.ok(read('src/app.js').includes("releases/content/ui/life-user-watermark.webp"));
  assert.deepEqual(manifest.icons.map(icon=>icon.src),[
    'https://solar-time.keg0320.workers.dev/media/releases/content/ui/app-icon-192.png?v=0.46-r3',
    'https://solar-time.keg0320.workers.dev/media/releases/content/ui/app-icon-512.png?v=0.46-r3'
  ]);
  for(const name of ['apple-touch-icon.png','app-icon-192.png','app-icon-512.png','life-user-watermark.webp'])assert.ok(!site.includes("'"+name+"'"),name);
  assert.match(worker,/if\(value\.endsWith\('\.png'\)\)return 'image\/png'/);
  assert.match(worker,/headers=mediaHeaders\(object,status,key\)/);
  assert.deepEqual(wrangler.assets.run_worker_first,['/media/*']);
});


test('r13 uses the rotate-button gap for every right-side control interval',()=>{
  const css=read('styles.css');
  assert.match(css,/\.view-controls\{[^}]*--tool-gap:5px;gap:var\(--tool-gap\)/);
  assert.match(css,/\.camera-presets\{[^}]*gap:var\(--tool-gap\);margin:0/);
  assert.match(css,/\.view-controls #zoom-value\{padding:0;[^}]*line-height:1/);
  assert.doesNotMatch(css,/\.camera-presets\{gap:0;margin:1px 0\}/);
  assert.doesNotMatch(css,/\.view-controls #zoom-value\{padding:1px 0/);
});
test('r13 removes unused sky reference images from the repository',()=>{
  assert.ok(!fs.existsSync(path.join(root,'assets/sky/dust-reference.webp')));
  assert.ok(!fs.existsSync(path.join(root,'assets/sky/galaxy-reference.webp')));
  const ignore=read('.gitignore');
  assert.ok(ignore.split(/\r?\n/).includes('assets/sky/*.webp'));
});


test('r14 moves the scale readout to the top and enlarges it by one pixel',()=>{
  const html=read('index.html'),css=read('styles.css');
  const start=html.indexOf('<div id="view-controls"'),end=html.indexOf('<section class="playback ui"',start),block=html.slice(start,end);
  const ordered=['id="zoom-value"','id="fit-view"','id="camera-preset-1"','id="camera-preset-2"','id="camera-preset-3"','id="camera-mode-toggle"','id="rotate-left"','id="rotate-right"','id="zen-toggle"'];
  let cursor=-1;
  for(const token of ordered){const next=block.indexOf(token);assert.ok(next>cursor,token+' order');cursor=next;}
  assert.match(css,/\.view-controls #zoom-value\{padding:0;min-width:0;font-size:9px;line-height:1(?:;margin-bottom:5px)?\}/);
});


test('r15 adds one extra pixel only between the scale readout and home',()=>{
  const html=read('index.html'),css=read('styles.css');
  assert.ok(html.includes('href="styles.css?v=0.47-r1"'));
  assert.match(css,/\.view-controls #zoom-value\{padding:0;min-width:0;font-size:9px;line-height:1;margin-bottom:5px\}/);
  assert.match(css,/\.view-controls\{[^}]*--tool-gap:5px;gap:var\(--tool-gap\)/);
  assert.match(css,/\.camera-presets\{[^}]*gap:var\(--tool-gap\);margin:0/);
});


test('r16 removes avoidable renderer hot-path work and restores the watermark',()=>{
  const html=read('index.html'),app=read('src/app.js'),renderer=read('src/renderer.js'),surface=read('src/surface.js'),performance=read('src/performance.js');
  for(const file of ['surface','renderer','performance','app'])assert.ok(html.includes('src/'+file+'.js?v='),file);
  assert.equal((html.match(/data-life-user-watermark/g)||[]).length,2);
  assert.ok(app.includes('releases/content/ui/life-user-watermark.webp'));
  assert.ok(app.includes("window.SolarAssets?.materials?.earth?.base"));
  assert.match(renderer,/this\.frameBodies=\[\];this\.surfaceBodies=\[\];this\.directBodies=\[\];this\.labelBodies=\[\]/);
  assert.match(renderer,/displayPhysicalPoint\(physical,out\)/);
  assert.match(renderer,/surfaceJob\(body,physical,r,ms,seconds,direct=false,target=null\)/);
  assert.match(renderer,/if\(direct\)return job/);
  assert.doesNotMatch(renderer,/directJobs=new Map/);
  assert.doesNotMatch(renderer,/surfaceBodies\.map\(p=>this\.surfaceJob/);
  assert.match(renderer,/this\.project\(body\.world,body\.screen\)/);
  assert.match(surface,/this\.textureSources=new Map\(\)/);
  assert.match(surface,/textureSource\(name,asset,target\)/);
  assert.match(surface,/bindTextureUnit\(unit,texture\)/);
  assert.match(surface,/if\(this\.boundProgram!==program\.program\)/);
  assert.match(surface,/program\.viewportWidth===this\.width&&program\.viewportHeight===this\.height/);
  assert.doesNotMatch(surface,/for\(const \[unit,texture,uniform\] of/);
  assert.match(performance,/__solarTextureUseSerial/);
  assert.doesNotMatch(performance,/record\.lastUsed=performance\.now\(\)/);
});


test('v0.46 r3 keeps compact LIVE status separate and treats iPhone safe areas as boundaries',()=>{
  const html=read('index.html'),css=read('src/runtime-optimizations.css');
  assert.ok(html.includes('src/runtime-optimizations.css?v=0.47-'+JSON.parse(read('version.json')).revision));
  assert.match(css,/--solar-safe-left:env\(safe-area-inset-left,0px\)/);
  assert.match(css,/--solar-safe-right:env\(safe-area-inset-right,0px\)/);
  assert.match(css,/body\.zen \.clock-face\{top:max\(56px,calc\(var\(--solar-safe-top\) \+ 8px\)\)\}/);
  assert.match(css,/\.footer\{[\s\S]*bottom:max\(8px,var\(--solar-safe-bottom\)\)/);
  assert.match(css,/@media\(max-height:630px\) and \(min-width:681px\)\{[\s\S]*body\.zen \.clock-face\{top:max\(17px,calc\(var\(--solar-safe-top\) \+ 4px\)\)\}[\s\S]*\.scene-status\{top:max\(104px,calc\(var\(--solar-safe-top\) \+ 91px\)\)\}/);
});

test('v0.46 keeps the runtime and asset-pipeline optimizations',()=>{
  const html=read('index.html'),app=read('src/app.js'),renderer=read('src/renderer.js'),surface=read('src/surface.js'),performance=read('src/performance.js'),pipeline=read('tools/asset-pipeline.cjs');
  const assetRevision=JSON.parse(read('assets/revision.json')),manifest=JSON.parse(read('assets/manifest.json'));
  const notes=notesApi();assert.equal(notes.RELEASES[0].version,'0.47');assert.deepEqual(notes.RELEASES.slice(0,5).map(r=>r.version),['0.47','0.46','0.45','0.43','0.42']);
  for(const code of ['kor','en','chn','jpn','hi','es','de','fr','pt','it','id'])assert.ok(notes.itemsFor(notes.RELEASES[0],code).length>0,code);
  assert.ok(app.includes('src/release-notes.js?v=0.47-r2'));assert.ok(html.includes('<h3 id="release-notes-version">v0.47</h3>'));assert.doesNotMatch(app,/CURRENT_RELEASE_ITEMS|withCurrentRelease|releaseByVersion/);

  assert.ok(html.includes('src/assets.js?v=assetpack-20260918-r1'));
  assert.ok(html.includes('src/sky-asset.js?v=assetpack-20260918-r1'));
  for(const file of ['surface','renderer','performance'])assert.ok(html.includes('src/'+file+'.js?v=0.47-r1'),file);
  assert.match(html,/src\/app\.js\?v=0\.47-r\d+(?:-[^\"']+)?/);
  assert.deepEqual(assetRevision,{version:'assetpack-20260918-r1'});
  assert.equal(manifest.revision,'assetpack-20260918-r1');
  for(const entry of Object.values(manifest.materials))assert.equal(entry.seamBaked,true,entry.source);
  assert.match(pipeline,/async function seamBakedVariant/);
  assert.match(pipeline,/seamBaked:group==='textures'/);
  assert.match(pipeline,/rightPixel=y\*width\+\(width-1-x\)/);
  assert.match(surface,/seamBaked:!!asset\.seamBaked/);
  assert.match(surface,/if\(!source\.seamBaked\|\|bitmap\.width!==width\|\|bitmap\.height!==height\)/);
  assert.match(surface,/g\.pixelStorei\(g\.UNPACK_FLIP_Y_WEBGL,false\)/);
  assert.match(surface,/this\.orbitState=\{valid:false\}/);
  assert.match(surface,/if\(!s\.valid\|\|s\.centerX!==centerX/);
  assert.match(renderer,/this\.labelObstacleMap=new Map\(\)/);
  assert.match(renderer,/this\.labelCandidateMap=new Map\(\)/);
  assert.match(renderer,/byId\.clear\(\);ordered\.length=0;reserved\.length=0;active\.clear\(\)/);
  assert.match(renderer,/const camera=direct\?this\.gpuOrbitCamera\(\):null/);
  assert.match(app,/let cameraUiSignature=''/);
  assert.match(app,/const activeMotion=!!drag\|\|pointers\.size>0/);
  assert.match(performance,/function reportFrameTiming\(elapsed,target\)/);
  assert.match(performance,/constrained\|\|!active\?1000\/30:1000\/60/);
});