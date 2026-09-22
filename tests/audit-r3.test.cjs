'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('dynamic wall date is not owned by static translation',()=>{
  const html=read('index.html'),date=/<span id="wall-date"([^>]*)>/.exec(html)?.[1]||'';
  assert.doesNotMatch(date,/data-i18n/);assert.match(read('src/app.js'),/wall-date'\)\.textContent=dateFormatter/);
});

test('factory reset restores the authoritative live clock and clears event guides',()=>{
  const app=read('src/app.js'),block=/async function applyFactoryDefaults\(\)\{([\s\S]*?)\n      \}/.exec(app)?.[1]||'';
  assert.match(block,/clock\.now\(mono\)/);assert.match(block,/eclipseTargets\.clear\(\)/);assert.match(block,/alignmentTarget=null/);assert.match(block,/renderer\.setAlignmentGuide\(null\)/);
});

test('AUTO language refreshes country timezone on every foreground path',()=>{
  const app=read('src/app.js');
  assert.match(app,/const refreshAutomaticContext=\(\)=>\{if\(!disposed&&languageMode==='auto'\)setLanguage\('auto'\)/);
  assert.match(app,/visibilitychange[\s\S]*?renderer\.resume\(\);\s*refreshAutomaticContext\(\)/);
  assert.match(app,/pageshow'[\s\S]*?renderer\.resume\(\);refreshAutomaticContext\(\)/);
  assert.match(app,/addEventListener\('focus',refreshAutomaticContext/);
  assert.doesNotMatch(app,/targetTimeZone===autoTimeZone\)\)\{translateStatic\(\)/);
});
