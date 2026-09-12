/* v0.21 camera/playback regression checks. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('preset focus size is continuously blended',()=>{const s=read('src/renderer.js');assert.match(s,/bodyRadiusForState/);assert.match(s,/move\.progress\|\|0/);assert.match(s,/mix\(this\.bodyRadiusForState\(body,move\.from\),this\.bodyRadiusForState\(body,move\.to\)/);});
test('preset focus anchor is continuously blended',()=>{const s=read('src/renderer.js');assert.match(s,/anchor=\{x:mix\(a\.x,b\.x,p\),y:mix\(a\.y,b\.y,p\),z:mix\(a\.z,b\.z,p\)\}/);assert.doesNotMatch(s,/targetStartScreen/);});
test('rotation icons are visually swapped to match labels',()=>{const h=read('index.html');const left=h.match(/id="rotate-left"[\s\S]*?<\/button>/)[0],right=h.match(/id="rotate-right"[\s\S]*?<\/button>/)[0];assert.match(left,/transform="translate\(24 0\) scale\(-1 1\)"/);assert.doesNotMatch(right,/transform="translate\(24 0\) scale\(-1 1\)"/);});
test('live mode leaves speed unit off and first click activates current unit',()=>{const s=read('src/app.js');assert.match(s,/const active=!clock\.live/);assert.match(s,/if\(clock\.live\)\{applySpeed\(\);return;\}/);});
test('playback card is ten percent smaller',()=>assert.match(read('styles-v016.css'),/scale\(\.9\)/));
test('app exposes current release version',()=>assert.match(read('src/app.js'),/version:'0\.24'/));
