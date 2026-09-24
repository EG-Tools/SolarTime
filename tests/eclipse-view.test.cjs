'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Moon and Europa cards expose shared, accessible eclipse navigation',()=>{
  const html=read('index.html'),focus=html.indexOf('id="focus-body"'),eclipse=html.indexOf('id="eclipse-control"'),feature=html.indexOf('id="feature-view"');
  assert.ok(focus>=0&&focus<eclipse&&eclipse<feature);
  assert.match(html,/id="eclipse-previous" class="step-previous"/);
  assert.match(html,/id="eclipse-next" class="step-next"/);
  assert.match(html,/release-notes-navigation step-navigation/);
});

test('Eclipse travel is limited to the two satellites, preserves the current camera and real time clears it',()=>{
  const app=read('src/app.js');
  assert.match(app,/bodyId==='moon'\|\|bodyId==='europa'/);
  assert.match(app,/A\.eclipseEvent\(id,base,direction\)/);
  const travel=app.slice(app.indexOf('function travelToEclipse'),app.indexOf("$('eclipse-previous')"));
  assert.match(travel,/clock\.travelTo\(event\.ms,mono/);
  assert.doesNotMatch(travel,/animateFocus|animateHome|restoreCamera|setCamera/);
  assert.doesNotMatch(app,/selectBody\(body\.parent/);
  assert.match(app,/clock\.now\(mono\);eclipseTargets\.clear\(\)/);
});

test('Locale requests use the current revision so eclipse labels bypass old cached copy',()=>{
  assert.match(read('index.html'),/src\/language-data\.js\?v=0\.57-r1/);
});

test('Every locale includes eclipse controls and fallback copy',()=>{
  const files=fs.readdirSync(path.join(root,'src','locales')).filter(file=>file.endsWith('.json'));
  for(const file of files){
    const copy=JSON.parse(read(path.join('src','locales',file))).copy;
    for(const key of ['eclipseView','eclipsePrevious','eclipseNext','eclipseUnavailable'])assert.ok(copy[key],`${file}: ${key}`);
  }
});

test('Direct file launches overlay current eclipse copy on older public locale bundles',async()=>{
  const source=read('src/language-data.js'),files=fs.readdirSync(path.join(root,'src','locales')).filter(file=>file.endsWith('.json'));
  for(const file of files){
 const code=path.basename(file,'.json'),window={SolarModules:{}},location={protocol:'file:',href:'file:///D:/_Program/SolarTime/index.html'},document={currentScript:{src:'file:///D:/_Program/SolarTime/src/language-data.js?v=0.57-r1'}};
    vm.runInNewContext(source,{window,location,document,URL,AbortSignal,fetch:async()=>({ok:true,json:async()=>({copy:{},bodies:{},phases:{}})})});
    const copy=(await window.SolarModules.LanguageData.load(code)).copy,expected=JSON.parse(read(path.join('src','locales',file))).copy;
    for(const key of ['eclipseView','eclipsePrevious','eclipseNext','eclipseUnavailable'])assert.equal(copy[key],expected[key],`${file}: ${key}`);
  }
});
