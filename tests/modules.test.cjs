'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('runtime concerns load as modules before the application coordinator',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,2);
  assert.ok(html.includes('href="styles.css?v=0.45-r13"'));
  assert.ok(html.includes('href="src/runtime-optimizations.css?v=0.45-r1"'));
  assert.doesNotMatch(html,/styles-v016/);
  assert.ok(html.includes('src/performance.js?v=0.45-r9'));
  assert.ok(html.indexOf('src/performance.js')<html.indexOf('src/app.js'),'performance');
  assert.ok(html.includes('src/visual-effects.js?v=0.45-r10'));
  assert.ok(html.indexOf('src/visual-effects.js')<html.indexOf('src/renderer.js'),'visual-effects');
  assert.ok(!html.includes('src/star-layer.js'),'r10 returns stars to the existing sky WebGL context');
  for(const name of ['preferences','ui-runtime','music-player']){
    assert.ok(html.includes('src/'+name+'.js?v=0.45'));
    assert.ok(html.indexOf('src/'+name+'.js')<html.indexOf('src/app.js'),name);
  }
  assert.ok(html.includes('src/language-data.js?v=0.45-r10'));
  assert.ok(html.includes('src/localization.js?v=0.45-r11'));
  assert.match(app,/Localization=Modules\.Localization,LanguageData=Modules\.LanguageData,Preferences=Modules\.Preferences,UI=Modules\.UI/);
  assert.match(app,/Preferences\.read\(STORAGE_KEY\)/);
  assert.match(app,/Preferences\.write\(STORAGE_KEY/);
  assert.match(app,/Modules\.MusicPlayer\.create/);
});
