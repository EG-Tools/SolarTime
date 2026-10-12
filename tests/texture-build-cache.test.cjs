'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {textureVariants}=require('../tools/asset-pipeline.cjs');
test('texture cache preserves output and rebuilds changed or corrupted inputs',async()=>{
 sharp.cache(false);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'solar-texture-cache-'));
 try{
  fs.mkdirSync(path.join(root,'assets'));
  const master=path.join(root,'assets','sample.webp'),output=path.join(root,'.cloudflare/media');
  const write=color=>sharp({create:{width:512,height:256,channels:3,background:color}}).webp({lossless:true}).toFile(master);
  await write('#123456');
  const start=performance.now(),first=await textureVariants(root,output,'releases','sample.webp'),cold=performance.now()-start;
  const cache=path.join(root,'.cloudflare/texture-cache'),files=fs.readdirSync(cache),times=files.map(f=>fs.statSync(path.join(cache,f)).mtimeMs);
  fs.rmSync(output,{recursive:true,force:true});
  const warmStart=performance.now(),second=await textureVariants(root,output,'releases','sample.webp'),warm=performance.now()-warmStart;
  assert.deepEqual(second,first);
  assert.deepEqual(files.map(f=>fs.statSync(path.join(cache,f)).mtimeMs),times,'cache hits do not re-encode');
  fs.writeFileSync(path.join(cache,files.find(f=>f.endsWith('.webp'))),'corrupted');
  assert.deepEqual(await textureVariants(root,output,'releases','sample.webp'),first,'corrupt cache repaired');
  await write('#abcdef');
  const changed=await textureVariants(root,output,'releases','sample.webp');
  assert.notEqual(changed.tiers[0].sha256,first.tiers[0].sha256);
  const background=await textureVariants(root,output,'releases','sample.webp','backgrounds');
  assert.equal(background.seamBaked,false);assert.notEqual(background.tiers[0].path,changed.tiers[0].path);
  console.log('Texture fixture build ms:',JSON.stringify({cold,warm}));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
