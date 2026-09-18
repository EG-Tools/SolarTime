/* Inspection only: nothing is copied into assets/. */
'use strict';
const path=require('node:path'),{downloadMediaBundle}=require('./r2-media-bundle.cjs');
const root=path.resolve(__dirname,'..');
downloadMediaBundle(root,path.join(root,'.cloudflare/derived')).then(()=>console.log('Render tiers restored under .cloudflare/derived for inspection, not as originals.')).catch(error=>{console.error(error.message);process.exitCode=1;});
