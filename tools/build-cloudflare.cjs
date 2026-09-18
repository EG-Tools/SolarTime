'use strict';
const path=require('node:path'),{prepareSite}=require('./cloudflare-site.cjs');
(async()=>{
 try{
  const root=path.resolve(__dirname,'..'),{site,manifest}=await prepareSite(root,{cdnBase:'/media/'});
  console.log(`Cloudflare code site ${site} prepared for ${manifest.revision}.`);
 }catch(error){console.error('Cloudflare build failed: '+error.message);process.exitCode=1;}
})();
