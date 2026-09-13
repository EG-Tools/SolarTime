/* Serialization/build smoke tests. Tiny test assets never ship as runtime assets. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function fixture(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'solar-v017-'));
 for(const dir of ['src','assets','tools'])fs.mkdirSync(path.join(temp,dir));
 for(const file of ['index.html','styles-v016.css','package.json','tools/build.cjs','tools/pack_assets.cjs','src/app.js','src/renderer.js','src/sky.js','src/materials.js','src/sky-asset.js','assets/universe.webp','assets/universe-optimized.webp','assets/material-info.json'])fs.copyFileSync(path.join(root,file),path.join(temp,file));
 for(const file of ['src/astro.js','src/surface.js','src/assets.js'])fs.writeFileSync(path.join(temp,file),'/* isolated build fixture */');
 fs.writeFileSync(path.join(temp,'styles.css'),'body{margin:0}');
 for(const id of ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','europa','clouds'])fs.writeFileSync(path.join(temp,'assets',id+'.webp'),Buffer.from('TEST-ONLY-BINARY'));
 fs.writeFileSync(path.join(temp,'assets/stars.json'),'[]');return temp;
}
function build(temp){return cp.spawnSync(process.execPath,['tools/build.cjs'],{cwd:temp,encoding:'utf8'});}
test('build embeds revised sky once and all script tags, leaving website index unchanged',()=>{
 const temp=fixture();try{
 const index=fs.readFileSync(path.join(temp,'index.html'),'utf8'),result=build(temp);assert.equal(result.status,0,result.stderr);
 const pkg=JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8')),v=pkg.version.split('.').slice(1).join('.');
 const html=fs.readFileSync(path.join(temp,'dist/Solar-Time_v'+v+'.html'),'utf8');assert.doesNotMatch(html,/<script\b[^>]*\bsrc=/i);assert.doesNotMatch(html,/styles-v016\.css/);assert.doesNotMatch(html,/src\/sky-asset\.js/);
 assert.match(html,new RegExp(`version:'${v.replace('.', '\\.')}'`));assert.equal(fs.readFileSync(path.join(temp,'index.html'),'utf8'),index);
 const sky=fs.readFileSync(path.join(temp,'assets/universe-optimized.webp')).toString('base64');assert.equal(html.split(sky).length,2,'sky should occur exactly once');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('packing regenerates the website sky override from the current image',()=>{
 const temp=fixture();try{assert.equal(build(temp).status,0);const payload=fs.readFileSync(path.join(temp,'src/sky-asset.js'),'utf8');assert.ok(payload.includes(fs.readFileSync(path.join(temp,'assets/universe-optimized.webp')).toString('base64')));const pkg=JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8')),v=pkg.version.split('.').slice(1).join('.');assert.ok(payload.includes(v));}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('build fails clearly if an original planet asset is missing, without publishing output',()=>{
 const temp=fixture();try{fs.unlinkSync(path.join(temp,'assets/earth.webp'));const result=build(temp);assert.notEqual(result.status,0);assert.match(result.stderr,/Missing original asset/);const pkg=JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8')),v=pkg.version.split('.').slice(1).join('.');assert.ok(!fs.existsSync(path.join(temp,'dist/Solar-Time_v'+v+'.html')));}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
