/* Explicit R2 transport. No implicit recovery or downloads. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function putR2(root,{bucket,key,file,type,cacheControl='public, max-age=31536000, immutable',contentDisposition=''}){
 const bin=path.join(root,'node_modules/wrangler/bin/wrangler.js');
 if(!fs.existsSync(bin))throw Error('Install locked dependencies before uploading.');
 if(!fs.statSync(file).isFile())throw Error('Upload source is not a file.');
 if(!key||key.startsWith('/')||key.includes('\\')||key.split('/').some(p=>!p||p==='..'))throw Error('Invalid R2 object key.');
 const args=[bin,'r2','object','put',bucket+'/'+key,'--remote','--file',file,'--content-type',type,'--cache-control',cacheControl,'--force'];
 if(contentDisposition)args.push('--content-disposition',contentDisposition);
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)throw Error('R2 upload failed: '+key+' (exit '+result.status+')');
}
module.exports={putR2};
