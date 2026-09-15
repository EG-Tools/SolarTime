'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('runtime concerns load as modules before the application coordinator',()=>{
  const html=read('index.html'),app=read('src/app.js'),build=read('tools/build.cjs');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1);
  assert.doesNotMatch(html,/styles-v016/);
  for(const name of ['localization','preferences','ui-runtime','music-player']){
    assert.match(html,new RegExp(`src/${name}\\.js\\?v=0\\.39`));
    assert.ok(html.indexOf(`src/${name}.js`)<html.indexOf('src/app.js'),name);
    assert.ok(build.includes(`'${name}'`),name);
  }
  assert.match(app,/Localization=Modules\.Localization,Preferences=Modules\.Preferences,UI=Modules\.UI/);
  assert.match(app,/Preferences\.read\(STORAGE_KEY\)/);
  assert.match(app,/Preferences\.write\(STORAGE_KEY/);
  assert.match(app,/Modules\.MusicPlayer\.create/);
});
