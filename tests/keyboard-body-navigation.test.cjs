'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.resolve(__dirname,'..','src','app.js'),'utf8');

test('left and right arrows follow the visible footer body order with wraparound',()=>{
  assert.match(app,/const bodies=\[A\.SUN,\.\.\.A\.BODIES\.flatMap\(body=>\[body,\.\.\.satellites\.filter\(satellite=>satellite\.parent===body\.id\)\]\)\]/);
  assert.match(app,/available=bodies\.filter\(body=>!navButtons\.get\(body\.id\)\?\.hidden\)/);
  assert.match(app,/currentIndex<0\?\(direction>0\?0:available\.length-1\):\(currentIndex\+direction\+available\.length\)%available\.length/);
  assert.match(app,/key==='arrowleft'\|\|key==='arrowright'/);
  assert.match(app,/navigateBody\(key==='arrowright'\?1:-1\)/);
});

test('keyboard body navigation preserves an active tracking camera',()=>{
  assert.match(app,/trackedBodyId\(\)\{return renderer\.cameraTween\?\.to\?\.focus\|\|renderer\.camera\.focus\|\|null;\}/);
  assert.match(app,/keepTracking=!!trackedBodyId\(\)/);
  assert.match(app,/if\(keepTracking\)focusBody\(next\.id\)/);
  assert.match(app,/if\(UI\.topDialog\(\)\)return;\s*if\(key==='arrowleft'\|\|key==='arrowright'\)/);
  assert.ok(app.indexOf("if(key==='arrowleft'||key==='arrowright')")<app.indexOf("if(event.target.closest?.('button,a'))return"));
});
