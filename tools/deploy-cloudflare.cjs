'use strict';
const path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const args of [[path.join(root,'tools','run-tests.cjs')],[path.join(root,'tools','build-cloudflare.cjs')],[path.join(root,'node_modules','wrangler','bin','wrangler.js'),'deploy']]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
