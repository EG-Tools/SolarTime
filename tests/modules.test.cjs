'use strict';
const cacheUrl=file=>require('../tools/code-revisions.cjs').urlFor(require('node:path').resolve(__dirname,'..'),file);
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('runtime concerns load as modules before the application coordinator',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,2);
 assert.ok(html.includes('href="'+cacheUrl('styles.css')+'"'));
  const runtimeStyle=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>match[1]).find(href=>href.startsWith('src/runtime-optimizations.css?'));
  assert.ok(runtimeStyle,'The runtime layout stylesheet must be loaded');
  const runtimeUrl=new URL(runtimeStyle,'https://local.example/');
  assert.match(runtimeUrl.searchParams.get('v'),/^[a-f0-9]{12}$/i,'The runtime stylesheet must have a versioned cache key');
  assert.doesNotMatch(html,/styles-v016/);
 assert.ok(html.includes(cacheUrl('src/surface.js')));
 assert.ok(html.includes(cacheUrl('src/renderer.js')));
 assert.ok(html.includes(cacheUrl('src/performance.js')));
  assert.ok(html.indexOf('src/performance.js')<html.indexOf('src/app.js'),'performance');assert.ok(html.indexOf('src/surface-style.js')<html.indexOf('src/surface.js'));
  assert.ok(html.includes(cacheUrl('src/visual-effects.js')));
  assert.ok(html.indexOf('src/visual-effects.js')<html.indexOf('src/renderer.js'),'visual-effects');
  assert.ok(!html.includes('src/star-layer.js'),'r10 returns stars to the existing sky WebGL context');
  for(const name of ['preferences','ui-runtime','music-player']){
  assert.ok(html.includes(cacheUrl('src/'+name+'.js')));
    assert.ok(html.indexOf('src/'+name+'.js')<html.indexOf('src/app.js'),name);
  }
 assert.ok(html.includes(cacheUrl('src/language-data.js')));
 assert.ok(html.includes(cacheUrl('src/localization.js')));
  assert.match(app,/Localization=Modules\.Localization,LanguageData=Modules\.LanguageData,Preferences=Modules\.Preferences,UI=Modules\.UI/);
  assert.match(app,/Preferences\.read\(STORAGE_KEY\)/);
  assert.match(app,/Preferences\.write\(STORAGE_KEY/);
  assert.match(app,/Modules\.MusicPlayer\.create/);
});


test('phone layout shares an explicit standalone-aware flag with the sky renderer',()=>{
  const css=read('src/runtime-optimizations.css'),page=read('src/page-runtime.js'),sky=read('src/sky.js');
  const mobile=css.slice(css.indexOf('/* v0.46 r4:'));
  assert.ok(mobile.includes('html.solar-phone-layout .edge-shade{display:none}'));
  assert.ok(mobile.includes('html.solar-phone-layout .planet-nav{padding-top:0;padding-bottom:0}'));
  assert.ok(mobile.includes('html.solar-phone-layout .playback{bottom:calc(max(8px,var(--solar-safe-bottom)) + 32px)}'));
  assert.ok(page.includes('root.navigator?.standalone===true'));
  assert.ok(page.includes("(any-pointer:coarse)"));
  assert.ok(sky.includes("classList?.contains('solar-phone-layout')?0:.24"));
 assert.ok(read('index.html').includes(cacheUrl('src/runtime-optimizations.css')));
 assert.ok(read('index.html').includes(cacheUrl('src/page-runtime.js')));
});

test('phone layout refinement leaves the approved top boundary and home-indicator safety intact',()=>{
  const css=read('src/runtime-optimizations.css');
  const mobile=css.slice(css.indexOf('/* v0.46 r4:'));
  assert.doesNotMatch(mobile,/\.(?:masthead|clock-face|scene-status|footer)\s*\{/);
  assert.match(css,/--solar-safe-bottom:env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/\.footer\{\s*bottom:max\(8px,var\(--solar-safe-bottom\)\)/);
  assert.match(css,/top:max\(19px,calc\(var\(--solar-safe-top\) \+ 6px\)\)/);
});
