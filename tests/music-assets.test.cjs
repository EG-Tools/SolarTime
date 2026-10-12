'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildMedia}=require('../tools/asset-pipeline.cjs');
test('music-only builds preserve texture metadata and files and remain deterministic',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'solar-music-'));
 try{
  const assets=path.join(root,'assets'),output=path.join(root,'.cloudflare/media');
  fs.mkdirSync(path.join(assets,'music'),{recursive:true});fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(assets,'revision.json'),JSON.stringify({version:'assetpack-test'}));
  fs.writeFileSync(path.join(assets,'deployment.json'),JSON.stringify({bucket:'solar-time-media',prefix:'releases',cdnBase:'https://example.com/media/'}));
  const previous={schema:1,revision:'assetpack-test',generatedAt:'old',materials:{sample:{remoteOnly:true,tiers:[]}},sky:{localPreview:{tiers:[]}},music:{}};
  fs.writeFileSync(path.join(assets,'manifest.json'),JSON.stringify(previous));
  fs.writeFileSync(path.join(output,'preserve.webp'),'existing texture');
  fs.writeFileSync(path.join(assets,'music','08 - Deep Space Journey.mp3'),'mp3 fixture');
  fs.writeFileSync(path.join(assets,'music','08 - Deep Space Journey.flac'),'master');
  const {manifest}=await buildMedia(root,output,{musicOnly:true});
  assert.deepEqual(manifest.materials,previous.materials);assert.deepEqual(manifest.sky,previous.sky);
  assert.equal(fs.readFileSync(path.join(output,'preserve.webp'),'utf8'),'existing texture');
  assert.deepEqual(Object.keys(manifest.music),['08 - Deep Space Journey.mp3']);
  const track=manifest.music['08 - Deep Space Journey.mp3'];
  assert.equal(fs.readFileSync(path.join(output,track.path),'utf8'),'mp3 fixture');
  assert.deepEqual((await buildMedia(root,output,{musicOnly:true})).manifest,manifest);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
