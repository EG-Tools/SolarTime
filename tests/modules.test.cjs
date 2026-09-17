'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('runtime concerns load as modules before the application coordinator',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,2);
  assert.match(html,/href="styles\.css\?v=0\.43"/);
  assert.match(html,/href="src\/runtime-optimizations\.css\?v=0\.43-r2"/);
  assert.doesNotMatch(html,/styles-v016/);
  assert.match(html,/src\/performance\.js\?v=0\.43-r1/);
  assert.ok(html.indexOf('src/performance.js')<html.indexOf('src/app.js'),'performance');
  assert.match(html,/src\/visual-effects\.js\?v=0\.43-r2/);
  assert.ok(html.indexOf('src/visual-effects.js')<html.indexOf('src/renderer.js'),'visual-effects');
  for(const name of ['language-data','localization','preferences','ui-runtime','music-player']){
    assert.match(html,new RegExp(`src/${name}\\.js\\?v=0\\.43`));
    assert.ok(html.indexOf(`src/${name}.js`)<html.indexOf('src/app.js'),name);
  }
  assert.match(app,/Localization=Modules\.Localization,LanguageData=Modules\.LanguageData,Preferences=Modules\.Preferences,UI=Modules\.UI/);
  assert.match(app,/Preferences\.read\(STORAGE_KEY\)/);
  assert.match(app,/Preferences\.write\(STORAGE_KEY/);
  assert.match(app,/Modules\.MusicPlayer\.create/);
});
