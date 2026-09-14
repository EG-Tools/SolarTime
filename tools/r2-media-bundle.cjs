'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process'),{atomicWrite,projectConfig}=require('./asset-pipeline.cjs');

async function downloadMediaBundle(root,target){
 const cloudflareRoot=path.resolve(root,'.cloudflare'),resolved=path.resolve(target);if(resolved!==cloudflareRoot&&!resolved.startsWith(cloudflareRoot+path.sep))throw Error('Downloaded media must stay inside .cloudflare.');
 const {deployment}=projectConfig(root),bundle=deployment.bundle;if(!bundle?.path||!bundle.sha256)throw Error('Run npm run publish:media once before downloading media.');
 const url=new URL(bundle.path,deployment.cdnBase).href,response=await fetch(url,{headers:{'user-agent':'SolarTime-Cloudflare-Build/1.0'}});if(!response.ok)throw Error(`Media bundle download failed: ${response.status} ${response.statusText}`);
 const bytes=Buffer.from(await response.arrayBuffer()),sha256=crypto.createHash('sha256').update(bytes).digest('hex');if(sha256!==bundle.sha256)throw Error('Media bundle checksum mismatch.');
 fs.mkdirSync(cloudflareRoot,{recursive:true});const archive=path.join(cloudflareRoot,`media-${process.pid}.tar.gz`);atomicWrite(archive,bytes);fs.rmSync(resolved,{recursive:true,force:true});fs.mkdirSync(resolved,{recursive:true});
 try{const result=spawnSync('tar',['-xzf',archive,'-C',resolved],{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Media bundle extraction failed.');}finally{if(fs.existsSync(archive))fs.unlinkSync(archive);}
 return {deployment,bundle,url};
}
module.exports={downloadMediaBundle};
