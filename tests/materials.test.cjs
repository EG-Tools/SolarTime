'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {catalog,revision,valid}=require('../src/materials.js');
const entry=catalog.find(e=>e.id==='saturn');
const row=()=>({id:entry.id,revision,url:entry.urls[0],width:2048,height:1024,created:Date.now(),data:'data:image/webp;base64,dGVzdA=='});
test('Public photo catalog covers requested Saturn, Neptune, Venus, Moon and other planets with credits',()=>{
 assert.deepEqual(catalog.map(e=>e.id),['saturn','neptune','venus','moon','jupiter','mars','mercury','uranus']);
 for(const e of catalog){assert.ok(e.credit);assert.ok(e.urls.length<=3);for(const url of e.urls)assert.ok(url.startsWith('https://'));}
 assert.ok(!catalog.some(e=>e.id==='earth'));
});
test('Cache rejects old revisions, alien sources, malformed dimensions, future dates and expired rows',()=>{
 assert.ok(valid(row(),entry));
 for(const change of [{revision:'old'},{url:'https://example.org/tracker.jpg'},{width:8192},{height:24},{id:'earth'},{created:Date.now()+86400000},{created:Date.now()-366*86400000},{data:'data:text/javascript;base64,test'}])assert.ok(!valid({...row(),...change},entry),JSON.stringify(change));
});
test('Background comet is a bounded curved cubic, with exact endpoint directions',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/sky.js'),'utf8'),sandbox);
 const at=sandbox.window.SolarSky.cometPoint;
 const path={start:{x:-1,y:0,z:-1},control1:{x:-.5,y:.8,z:-1},control2:{x:.5,y:.8,z:-1},end:{x:1,y:0,z:-1}};
 for(const t of [-1,0,.2,.5,.9,1,2])assert.ok(Math.abs(Math.hypot(...Object.values(at(path,t)))-1)<1e-12);
 assert.ok(at(path,.5).y>.4);assert.equal(at(path,0).y,0);assert.equal(at(path,1).y,0);
});
test('Surface raster is limited to 1024 independently of detailed input maps',()=>{
 const renderer=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),surface=fs.readFileSync(require.resolve('../src/surface.js'),'utf8');
 assert.ok(renderer.includes('detailWidth:4096,maxRaster:1024'));assert.ok(surface.includes('Math.min(1024,job.diam)'));
 assert.ok(renderer.includes('materialRevision'));assert.ok(surface.includes('t.source!==source'));
});
test('Viewing mode exposes the single complete toolbar only while awake',()=>{
 const css=fs.readFileSync(require.resolve('../styles.css'),'utf8');
 assert.ok(css.includes('body.zen button'));
 assert.ok(css.includes('body.zen.pointer-awake #view-controls button'));
 assert.ok(css.includes('body.zen #preset-dialog[open] button'));
 assert.ok(!css.includes('#view-controls>:not(#fit-view):not(#show-ui)'));
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),app=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
 assert.ok(!html.includes('id="focus-reset"'));assert.ok(!app.includes("$('focus-reset')"));
 assert.equal((html.match(/id="fit-view"/g)||[]).length,1);
 assert.equal((html.match(/id="show-ui"/g)||[]).length,1);
 assert.ok(app.includes('viewControls.inert=zen&&!awake'));
});
