'use strict';
const fs=require('node:fs'),path=require('node:path'),{atomicWrite,buildMedia,projectConfig,runtimeScripts}=require('./asset-pipeline.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const runtimeOnly=process.argv.includes('--runtime-only');
 for(const arg of process.argv.slice(2))if(arg!=='--runtime-only')throw Error('Unknown build-assets option: '+arg);
 const existing=()=>({manifest:JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8')),deployment:projectConfig(root).deployment});
 const {manifest,deployment}=runtimeOnly?existing():await buildMedia(root,path.join(root,'.cloudflare/media'));
 const scripts=runtimeScripts(root,manifest,deployment);
 atomicWrite(path.join(root,'src/assets.js'),scripts.assets);atomicWrite(path.join(root,'src/sky-asset.js'),scripts.sky);
 if(runtimeOnly){console.log('Regenerated lightweight runtime manifests for '+manifest.revision+'.');return;}
 const textureBytes=Object.values(manifest.materials).flatMap(item=>item.tiers).reduce((sum,item)=>sum+item.bytes,0),musicBytes=Object.values(manifest.music).reduce((sum,item)=>sum+item.bytes,0);
 console.log(`Prepared ${manifest.revision}: ${(textureBytes/1048576).toFixed(2)} MiB texture tiers + ${(musicBytes/1048576).toFixed(2)} MiB music.`);
})().catch(error=>{console.error('Asset build failed: '+error.message);process.exitCode=1;});
