'use strict';
const path=require('node:path'),{prepareSite}=require('./cloudflare-site.cjs');
try{
 const root=path.resolve(__dirname,'..'),{site,manifest}=prepareSite(root,{cdnBase:'/media/'});
 console.log(`Cloudflare code site ${site} prepared for ${manifest.revision}.`);
}catch(error){console.error('Cloudflare build failed: '+error.message);process.exitCode=1;}
