/* v0.21 clock-layout/font/warmup regression checks. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('zen mode preserves the complete clock block layout',()=>{
 const css=read('styles-v016.css'),app=read('src/app.js');
 assert.match(css,/\.clock-face,body\.zen \.clock-face\{top:56px\}/);
 assert.match(css,/body\.zen \.clock-face \.eyebrow\{color:#8d918f\}/);
 assert.match(app,/\$\('timezone-button'\)\.hidden=false;\$\('timezone-readout'\)\.hidden=true/);
});

test('simulation status is moved upward',()=>assert.match(read('styles-v016.css'),/\.scene-status\{top:214px\}/));

test('clock font is selectable and persisted',()=>{
 const html=read('index.html'),app=read('src/app.js'),css=read('styles-v016.css');
 assert.match(html,/id="clock-font"/);for(const name of ['Aptos Display','Segoe UI Light','Bahnschrift Light','Arial','Consolas'])assert.match(html,new RegExp(name));
 assert.match(app,/const CLOCK_FONTS=Object\.freeze/);assert.match(app,/clockFont/);assert.match(app,/--clock-font/);
 assert.match(css,/\.wall-clock\{font-family:var\(--clock-font\)\}/);
});

test('initial surface cache warms before loading cover leaves',()=>{
 const app=read('src/app.js');
 assert.match(app,/async function warmInitialScene/);assert.match(app,/surface\?\.stats\?\.accepted>0&&!surface\.inflight/);
 assert.match(app,/await warmInitialScene\(\)/);assert.match(app,/scheduleMaterialRefresh\(\)/);
});

test('optional public material refresh is deferred',()=>{
 const app=read('src/app.js');assert.match(app,/setTimeout\(\(\)=>\{[\s\S]*requestIdleCallback/);assert.match(app,/,2200\)/);
});

test('v0.21 version is consistent',()=>{
 const pkg=JSON.parse(read('package.json')),html=read('index.html'),app=read('src/app.js'),build=read('tools/build.cjs');
 assert.equal(pkg.version,'0.0.21');assert.match(html,/Solar Time v0\.21/);assert.match(app,/version:'0\.21'/);assert.match(build,/0\.0\.21/);
});
