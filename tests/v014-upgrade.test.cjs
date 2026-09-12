'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),{upgrade}=require('../tools/upgrade-core.js');
const data={materials:{earth:'data:image/webp;base64,AA==',moon:'keep-me'},sky:'old-sky',stars:[[1,2,3,4,5,6]],materialInfo:{earth:{width:4096}},materialRevision:5};
const payload={skySource:fs.readFileSync(path.join(root,'src/sky.js'),'utf8'),rendererSource:fs.readFileSync(path.join(root,'src/renderer.js'),'utf8'),skyImage:'data:image/webp;base64,'+fs.readFileSync(path.join(root,'assets/universe.webp')).toString('base64')};
function fixture(version='0.13'){
 return `<!doctype html><html><head><title>Solar Time</title></head><body><p>Life User / v${version}</p><script id="solar-assets">window.SolarAssets=${JSON.stringify(data)};</script><script>/* sky */root.SolarSky=Sky;</script><script>/* Solar Time v${version} */window.SolarRenderer=Renderer;</script><script>const STORAGE_KEY='eg.solar-time.v0.01',PRESETS_KEY='solar-time.camera-presets.v1';const name='SolarTime_v${version}_photos.html';</script></body></html>`;
}
function embeddedAssets(html){return JSON.parse(html.match(/<script id="solar-assets">\s*window.SolarAssets=([\s\S]*?);\s*<\/script>/)[1]);}
test('offline upgrader preserves all planet/photo metadata, star data and storage keys',()=>{
 const input=fixture(),result=upgrade(input,payload),after=embeddedAssets(result.html);assert.equal(result.version,'0.14');assert.deepEqual(after,{...data,sky:payload.skyImage});assert.match(result.html,/SolarTime_v0\.14_photos\.html/);assert.match(result.html,/eg\.solar-time\.v0\.01/);assert.match(result.html,/solar-time\.camera-presets\.v1/);assert.match(result.html,/continuous spherical sky/);assert.equal(result.materials,2);assert.equal(input,fixture());
});
test('upgrader refuses source index, wrong versions, duplicates, and corrupt JSON',()=>{
 assert.throws(()=>upgrade('<script src="src/app.js"></script>',payload),/index\.html/);
 for(const version of ['0.12','0.14','0.15'])assert.throws(()=>upgrade(fixture(version),payload),/v0.13 전용/);
 assert.throws(()=>upgrade(fixture().replace('window.SolarAssets={','window.SolarAssets={INVALID'),payload),/JSON/);
 assert.throws(()=>upgrade(fixture()+'<script>root.SolarSky=Sky;</script>',payload),/우주 배경/);
});
test('upgrader never evaluates code in the selected HTML',()=>{
 const evil=fixture().replace('const STORAGE_KEY=', 'globalThis.__UPGRADE_EXECUTED=true;const STORAGE_KEY=');upgrade(evil,payload);assert.equal(globalThis.__UPGRADE_EXECUTED,undefined);
});
test('v0.14 builder uses existing assets and preserves the previous dist file',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'solar-build-'));
 try{
  for(const d of ['src','tools','assets','dist'])fs.mkdirSync(path.join(temp,d));
  fs.copyFileSync(path.join(root,'tools/build.cjs'),path.join(temp,'tools/build.cjs'));
  fs.copyFileSync(path.join(root,'package.json'),path.join(temp,'package.json'));
  fs.writeFileSync(path.join(temp,'assets/stars.json'),'[]');fs.writeFileSync(path.join(temp,'assets/universe.webp'),'fixture');
  fs.writeFileSync(path.join(temp,'tools/pack_assets.cjs'),`require('node:fs').writeFileSync(require('node:path').join(__dirname,'../src/assets.js'),'window.SolarAssets={materials:{},sky:"fixture",stars:[]};');`);
  const names=['assets','materials','astro','surface','sky','renderer','app'];
  fs.writeFileSync(path.join(temp,'index.html'),'<html><head><link rel="stylesheet" href="styles.css"></head><body>Life User v0.13'+names.map(n=>`<script${n==='assets'?' id="solar-assets"':''} src="src/${n}.js"></script>`).join('')+'</body></html>');
  fs.writeFileSync(path.join(temp,'styles.css'),'body{margin:0}');
  for(const n of names.filter(n=>n!=='assets'))fs.writeFileSync(path.join(temp,'src/'+n+'.js'),`/* Solar Time v0.13 */const ${n}='SolarTime_v0.13_photos.html';`);
  fs.writeFileSync(path.join(temp,'dist/Solar-Time_v0.13.html'),'UNCHANGED');
  let run=spawnSync(process.execPath,['tools/build.cjs'],{cwd:temp,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const output=fs.readFileSync(path.join(temp,'dist/Solar-Time_v0.14.html'),'utf8');assert.ok(output.includes('Life User v0.14'));assert.ok(!output.includes('src="src/'));assert.match(output,/SolarTime_v0\.14_photos\.html/);
  assert.equal(fs.readFileSync(path.join(temp,'dist/Solar-Time_v0.13.html'),'utf8'),'UNCHANGED');assert.match(fs.readFileSync(path.join(temp,'index.html'),'utf8'),/Life User v0\.14/);
  // Idempotent build, then malformed entrypoint must not overwrite good output.
  run=spawnSync(process.execPath,['tools/build.cjs'],{cwd:temp,encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(fs.readFileSync(path.join(temp,'dist/Solar-Time_v0.14.html'),'utf8'),output);
  fs.writeFileSync(path.join(temp,'index.html'),'<html>broken</html>');run=spawnSync(process.execPath,['tools/build.cjs'],{cwd:temp,encoding:'utf8'});assert.notEqual(run.status,0);assert.equal(fs.readFileSync(path.join(temp,'dist/Solar-Time_v0.14.html'),'utf8'),output);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
