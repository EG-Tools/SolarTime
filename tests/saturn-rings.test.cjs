'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),sharp=require('sharp');
const {radialTier,SOURCE,SHA256}=require('../tools/prepare-saturn-rings.cjs');
const manifest=require('../assets/manifest.json');
test('Saturn radial tiers retain original provenance and use immutable one-row RGBA assets',()=>{
 const entry=manifest.materials['saturn-ring'];
 assert.equal(entry.sourceUrl,SOURCE);assert.equal(entry.sourceSha256,SHA256);
 assert.equal(entry.remoteOnly,true);assert.equal(entry.layout,'radial');assert.equal(entry.seamBaked,false);
 assert.deepEqual(entry.tiers.map(t=>t.width),[256,512,1024,2048,4096]);
 for(const t of entry.tiers){assert.equal(t.height,1);assert.ok(t.bytes<20000);assert.ok(t.path.includes(t.sha256.slice(0,16)));}
 assert.ok(entry.sourceArchive.path.endsWith(SHA256.slice(0,16)+'.png'));
});
test('radial conversion preserves separate inner/outer edges and transparent gaps',async()=>{
 const width=256,height=8,rgba=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;rgba[i]=x<128?220:30;rgba[i+1]=x<128?40:180;rgba[i+2]=70;rgba[i+3]=x>=100&&x<150?0:255;
 }
 const original=await sharp(rgba,{raw:{width,height,channels:4}}).png().toBuffer();
 const converted=await radialTier(original,256),{data,info}=await sharp(converted).raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([info.width,info.height,info.channels],[256,1,4]);
 assert.deepEqual([...data.subarray(0,4)],[220,40,70,255]);
 assert.deepEqual([...data.subarray(-4)],[30,180,70,255]);assert.equal(data[125*4+3],0);
});
test('ring texture follows Saturn visibility and contributes only 16 KiB at 4K',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../src/performance.js'),'utf8'),{window,performance});
 const p=window.SolarPerformance,job={id:'saturn',textureWidth:4096,priority:2},assets={saturn:{},'saturn-ring':{}};
 const plan=p.planTextures([job],assets);assert.equal(plan.targets.get('saturn-ring'),4096);
 assert.equal(plan.bytes,4096*2048*4+4096*4);
 assert.equal(p.planTextures([],assets).targets.size,0);
 assert.equal(p.protectTexture({desired:new Map([['saturn',job]])},'saturn-ring'),true);
 assert.equal(p.protectTexture({desired:new Map()},'saturn-ring'),false);
 const constrained=p.planTextures([job],assets,4096,p.textureBudget()-1024*1024);
 assert.equal(constrained.bytes,[...constrained.targets].reduce((n,[name,w])=>n+(name==='saturn-ring'?w*4:w*w*2),0));
});
