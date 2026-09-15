'use strict';
const path=require('node:path'),{prepareSite}=require('./cloudflare-site.cjs');
try{
 const root=path.resolve(__dirname,'..'),{site,manifest}=prepareSite(root);
 console.log(`Prepared lightweight Git site ${site} for ${manifest.revision}.`);
}catch(error){console.error('Git build failed: '+error.message);process.exitCode=1;}
