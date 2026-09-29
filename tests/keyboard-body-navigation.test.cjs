'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),app=read('src/app.js');

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

test('Enter follows the selected or nearest visible planet and restores the prior camera',()=>{
  assert.match(app,/function nearestAvailablePlanet\(available\)/);
  assert.match(app,/const visible=candidates\.filter\(item=>renderer\.visible\(item\.screen,item\.r\|\|0\)\)/);
  assert.match(app,/if\(keyboardTrackingReturn\)\{[^]*renderer\.animateCamera\(previous,mono,900\)/);
  assert.match(app,/keyboardTrackingReturn=\{\.\.\.renderer\.cameraInputState\(mono\)\};focusBody\(id\)/);
  assert.match(app,/if\(key==='enter'\)[^]*toggleKeyboardTracking\(\)/);
});

test('Help uses three keyboard columns, four mouse columns and two columns on phones',()=>{
  const html=read('index.html'),css=read('styles.css');
  assert.match(html,/← →[^]*↑ ↓[^]*<kbd>Enter<\/kbd><span data-i18n="trackBody">천체 추적/);
  assert.match(html,/shortcut-row shortcut-mouse-row[^]*cameraRotate[^]*cameraTravel[^]*screenPan[^]*zoomInOut/);
  assert.match(css,/\.shortcut-row\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.shortcut-mouse-row\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:520px\)[^]*\.shortcut-row\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('up and down arrows use the shared camera path continuously while held',()=>{
  assert.match(app,/if\(key==='arrowup'\|\|key==='arrowdown'\)\{/);
  assert.match(app,/heldZoomKeys\.add\(key\)/);
  assert.match(app,/keyboardZoom\(key==='arrowup'\?1\.04:1\/1\.04\)/);
  assert.match(app,/addEventListener\('keyup',[^]*heldZoomKeys\.delete\(key\)/);
  assert.match(app,/heldZoom!==0\|\|mono-/);
  assert.match(app,/if\(heldZoom&&dt>0\)keyboardZoom\(Math\.exp\(heldZoom\*1\.35\*dt\),mono\)/);
  assert.match(app,/function keyboardZoom\(factor,mono=performance\.now\(\)\)[^]*renderer\.set(?:Dolly|Zoom)/);
  assert.match(app,/document\.hidden\)\{clearKeyboardZoom\(\)/);
  assert.doesNotMatch(app,/event\.target===canvas&&\(key==='arrowup'\|\|key==='arrowdown'\)/);
  assert.ok(app.indexOf("if(key==='arrowup'||key==='arrowdown')")<app.indexOf("if(event.target.closest?.('button,a'))return"));
});
