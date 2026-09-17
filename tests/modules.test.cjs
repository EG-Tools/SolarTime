'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('runtime concerns load as modules before the application coordinator',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,2);
  assert.match(html,/href="styles\.css\?v=0\.45-r9"/);
  assert.match(html,/href="src\/runtime-optimizations\.css\?v=0\.45-r1"/);
  assert.doesNotMatch(html,/styles-v016/);
  assert.match(html,/src\/performance\.js\?v=0\.45-r9/);
  assert.ok(html.indexOf('src/performance.js')<html.indexOf('src/app.js'),'performance');
  assert.match(html,/src\/visual-effects\.js\?v=0\.45-r9/);
  assert.ok(html.indexOf('src/visual-effects.js')<html.indexOf('src/star-layer.js'),'visual-effects');
  assert.match(html,/src\/star-layer\.js\?v=0\.45-r9/);assert.ok(html.indexOf('src/star-layer.js')<html.indexOf('src/renderer.js'),'star-layer');
  for(const name of ['preferences','ui-runtime','music-player']){
    assert.match(html,new RegExp(`src/${name}\\.js\\?v=0\\.45`));
    assert.ok(html.indexOf(`src/${name}.js`)<html.indexOf('src/app.js'),name);
  }
  assert.match(html,/src\/language-data\.js\?v=0\.45-r9/);assert.match(html,/src\/localization\.js\?v=0\.45-r9/);
  assert.match(app,/Localization=Modules\.Localization,LanguageData=Modules\.LanguageData,Preferences=Modules\.Preferences,UI=Modules\.UI/);
  assert.match(app,/Preferences\.read\(STORAGE_KEY\)/);
  assert.match(app,/Preferences\.write\(STORAGE_KEY/);
  assert.match(app,/Modules\.MusicPlayer\.create/);
});
