/* v0.17 camera/playback regression checks. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('pan range is forty percent',()=>{const s=read('src/renderer.js');assert.match(s,/minPanY:-\.4,maxPanY:\.4,minPanX:-\.4,maxPanX:\.4/);});
test('focus uses straight destination screen path',()=>{const s=read('src/renderer.js');assert.match(s,/targetStartScreen/);assert.match(s,/desiredX=mix\(start\.x,baseX,blend\)/);assert.match(s,/desiredY=mix\(start\.y,baseY,blend\)/);});
test('manual camera controls are immediate again',()=>{const s=read('src/app.js');assert.match(s,/renderer\.setPan\(/);assert.match(s,/renderer\.setOrbitView\(/);assert.match(s,/renderer\.setZoom\(/);});
test('playback ranges and single mode button',()=>{const s=read('src/app.js'),h=read('index.html');assert.match(s,/hour:\{min:1,max:1440,step:1/);assert.match(s,/day:\{min:1,max:365,step:1/);assert.match(s,/year:\{min:1,max:20,step:1/);assert.match(h,/id="speed-mode-button"/);assert.doesNotMatch(h,/speed-range/);assert.doesNotMatch(h,/playback-hint/);});
test('app exposes v0.17',()=>assert.match(read('src/app.js'),/version:'0\.17'/));
