'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function runtime(protocol,hostname){
 const window={},context={window,location:{protocol,hostname},URL};
 vm.runInNewContext(read('src/assets.js'),context);vm.runInNewContext(read('src/sky-asset.js'),context);return window.SolarAssets.sky;
}
test('local and public routing keep the same original sky and Andromeda decal',()=>{
 const published=runtime('https:','solartime.app');
 for(const [protocol,host] of [['file:',''],['http:','localhost'],['http:','127.0.0.1']]){
  const local=runtime(protocol,host);
  assert.equal(JSON.stringify(local.tiers),JSON.stringify(published.tiers));
  assert.match(local.tiers[0].path,/^releases\/content\/backgrounds\/universe-optimized-256\./);
  assert.equal(local.tiers.at(-1).width,2048);assert.match(local.galaxyAtlas,/galaxy-atlas\.e544896893ea889e\.webp$/);assert.deepEqual(Array.from(local.galaxyIndices),[0]);
 }
 assert.equal(published.galaxyAtlas,runtime('file:','').galaxyAtlas);assert.deepEqual(Array.from(published.galaxyIndices),[0]);
});

test('the released transparent Andromeda atlas matches its immutable URL',async()=>{
 const atlas=path.join(root,'assets/backgrounds/andromeda-atlas.webp'),metadata=await sharp(atlas).metadata(),hash=crypto.createHash('sha256').update(fs.readFileSync(atlas)).digest('hex');
 assert.equal(metadata.width,1024);assert.equal(metadata.height,1024);assert.equal(metadata.hasAlpha,true);assert.equal(hash,'e544896893ea889e22bc0c3f00327e34a6ebeb23d3eed7288cfb9c89fd79d9bf');
 assert.equal(JSON.parse(read('assets/manifest.json')).sky.galaxyAtlas.path,'releases/content/backgrounds/galaxy-atlas.'+hash.slice(0,16)+'.webp');
});
