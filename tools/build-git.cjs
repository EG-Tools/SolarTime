'use strict';
const path=require('node:path'),{downloadMediaBundle}=require('./r2-media-bundle.cjs'),{prepareSite}=require('./cloudflare-site.cjs');
const root=path.resolve(__dirname,'..'),media=path.join(root,'.cloudflare','media');
(async()=>{
 await downloadMediaBundle(root,media);const {site,manifest}=prepareSite(root,media);console.log(`Prepared ${site} from verified R2 bundle ${manifest.revision}.`);
})().catch(error=>{console.error('Git build failed: '+error.message);process.exitCode=1;});
