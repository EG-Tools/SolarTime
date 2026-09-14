'use strict';
const path=require('node:path'),{atomicWrite,buildMedia,runtimeScripts}=require('./asset-pipeline.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {manifest,deployment}=await buildMedia(root,path.join(root,'.cloudflare/media'));
 const scripts=runtimeScripts(root,manifest,deployment);
 atomicWrite(path.join(root,'src/assets.js'),scripts.assets);atomicWrite(path.join(root,'src/sky-asset.js'),scripts.sky);
 const textureBytes=Object.values(manifest.materials).flatMap(item=>item.tiers).reduce((sum,item)=>sum+item.bytes,0),musicBytes=Object.values(manifest.music).reduce((sum,item)=>sum+item.bytes,0);
 console.log(`Prepared ${manifest.revision}: ${(textureBytes/1048576).toFixed(2)} MiB texture tiers + ${(musicBytes/1048576).toFixed(2)} MiB music.`);
})().catch(error=>{console.error('Asset build failed: '+error.message);process.exitCode=1;});
