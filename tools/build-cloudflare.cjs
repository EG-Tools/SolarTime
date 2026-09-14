'use strict';
const path=require('node:path'),{buildMedia}=require('./asset-pipeline.cjs'),{prepareSite}=require('./cloudflare-site.cjs');
const root=path.resolve(__dirname,'..'),media=path.join(root,'.cloudflare/media');
(async()=>{
 const {manifest,deployment}=await buildMedia(root,media);
 prepareSite(root,media,{manifest,deployment});
 console.log(`Cloudflare site and R2 media prepared for ${manifest.revision}.`);
})().catch(error=>{console.error('Cloudflare build failed: '+error.message);process.exitCode=1;});
