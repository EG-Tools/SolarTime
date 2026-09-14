'use strict';
const fs=require('node:fs'),path=require('node:path'),{downloadMediaBundle}=require('./r2-media-bundle.cjs');
const root=path.resolve(__dirname,'..'),media=path.join(root,'.cloudflare','source-media'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets','manifest.json'),'utf8'));
function restore(entry){const tier=entry.tiers?.at(-1);if(!tier)throw Error('Missing source tier for '+entry.source);const source=path.join(media,...tier.path.split('/')),destination=path.join(root,'assets',...entry.source.split('/'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);}
(async()=>{
 await downloadMediaBundle(root,media);for(const entry of Object.values(manifest.materials))restore(entry);restore(manifest.sky);
 for(const entry of Object.values(manifest.music)){const source=path.join(media,...entry.path.split('/')),destination=path.join(root,'assets',...entry.source.split('/'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);}
 fs.rmSync(media,{recursive:true,force:true});console.log(`Restored ${Object.keys(manifest.materials).length+1} textures and ${Object.keys(manifest.music).length} tracks from R2.`);
})().catch(error=>{console.error('Asset restore failed: '+error.message);process.exitCode=1;});
