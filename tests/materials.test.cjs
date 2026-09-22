'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {catalog,revision,valid}=require('../src/materials.js');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
const asset=()=>({base:'https://assets.example/',fallback:'https://assets.example/release/earth.webp',tiers:[{width:512,path:'release/earth.webp'}]});
test('Packaged catalog covers every visual body without third-party runtime downloads',()=>{
 assert.deepEqual(catalog.map(e=>e.id),['sun','mercury','venus','earth','earth-night','mars','jupiter','saturn','uranus','neptune','pluto','moon','europa','clouds']);
 assert.equal(revision,'unavailable');
 const source=fs.readFileSync(path.join(root,'src/materials.js'),'utf8');assert.doesNotMatch(source,/fetch\(|indexedDB|8k_/);
});
test('Manifest assets require bounded resolution tiers and a cloud fallback',()=>{
 assert.ok(valid(asset()));assert.ok(valid('data:image/webp;base64,dGVzdA=='));
 for(const bad of [{...asset(),fallback:''},{...asset(),tiers:[]},{...asset(),tiers:[{width:128,path:'tiny.webp'}]},{...asset(),tiers:[{width:512,path:7}]},'https://example.org/map.webp'])assert.equal(valid(bad),false);
 for(const entry of Object.values(manifest.materials)){assert.ok(valid({base:'https://assets.example/',fallback:new URL(entry.tiers[0].path,'https://assets.example/').href,tiers:entry.tiers}));assert.ok(entry.tiers.length>=3);for(const tier of entry.tiers){assert.equal(tier.height,tier.width/2);assert.match(tier.path,/\.[a-f0-9]{16}\.webp$/);}}
});
test('Background comet is a bounded curved cubic, with exact endpoint directions',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/sky.js'),'utf8'),sandbox);
 const at=sandbox.window.SolarSky.cometPoint;
 const path={start:{x:-1,y:0,z:-1},control1:{x:-.5,y:.8,z:-1},control2:{x:.5,y:.8,z:-1},end:{x:1,y:0,z:-1}};
 for(const t of [-1,0,.2,.5,.9,1,2])assert.ok(Math.abs(Math.hypot(...Object.values(at(path,t)))-1)<1e-12);
 assert.ok(at(path,.5).y>.4);assert.equal(at(path,0).y,0);assert.equal(at(path,1).y,0);
});
test('Sky and planet maps stage a complete baseline before detail LODs',()=>{
 const sky=fs.readFileSync(require.resolve('../src/sky.js'),'utf8'),surface=fs.readFileSync(require.resolve('../src/surface.js'),'utf8'),app=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
 assert.match(sky,/loadSkyImage\(root\.SolarAssets\?\.sky,512\)/);
 assert.match(sky,/for\(const width of \[1024,2048\]\)/);
 assert.match(surface,/BASELINE_TEXTURE_WIDTH=256/);
 assert.match(surface,/visibleTexturesReady\(\)/);
 assert.match(app,/renderer\.sky\?\.startDetailUpgrade\?\.\(\)/);
});
test('Surface raster is limited to 1024 independently of detailed input maps',()=>{
 const renderer=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),surface=fs.readFileSync(require.resolve('../src/surface.js'),'utf8');
 assert.ok(renderer.includes('detailWidth:4096,maxRaster:1024'));assert.ok(surface.includes('Math.min(1024,job.diam)'));
 assert.ok(renderer.includes('materialRevision'));assert.ok(surface.includes('t.source!==source.key'));
});
test('Viewing mode exposes the single complete toolbar only while awake',()=>{
 const css=fs.readFileSync(require.resolve('../styles.css'),'utf8');
 assert.ok(css.includes('body.zen button'));
 assert.ok(css.includes('body.zen.pointer-awake #view-controls button'));
 assert.ok(css.includes('body.zen dialog[open] :is(button,input,select,a)'));
 assert.ok(!css.includes('#view-controls>:not(#fit-view):not(#show-ui)'));
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),app=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
 assert.ok(!html.includes('id="focus-reset"'));assert.ok(!app.includes("$('focus-reset')"));
 assert.equal((html.match(/id="fit-view"/g)||[]).length,1);
 assert.equal((html.match(/id="zen-toggle"/g)||[]).length,1);
 assert.ok(app.includes('viewControls.inert=zen&&!awake'));
});
