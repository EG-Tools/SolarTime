/* NASA master/LOD preparation. --publish uploads ONLY Venus surface tiers;
   never deploys a site or touches existing immutable cloud textures. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {atomicWrite,textureVariants,projectConfig,runtimeScripts}=require('./asset-pipeline.cjs');
const root=path.resolve(__dirname,'..');
const source='https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/venus/Venus.tif';
const expected='23f5ac6cf4423aab75d83db70c0474e3eefd01a86a684ea18748c4190955fed8';
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--publish'))throw Error('Unknown option');
 const publish=args.includes('--publish');
 const response=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('NASA HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('NASA source changed; inspect before replacing the approved master.');
 const meta=await sharp(bytes).metadata();if(meta.width!==1440||meta.height!==720)throw Error('Unexpected projection dimensions');
 // Power-of-two upload supports WebGL1 longitude repeat. Resizing does NOT
 // add measured detail: the source remains a 1440 x 720 radar visualization.
 const master=await sharp(bytes).resize(4096,2048).webp({lossless:true}).toBuffer();
 atomicWrite(path.join(root,'assets/venus-surface.webp'),master);
 const {deployment}=projectConfig(root),manifestFile=path.join(root,'assets/manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 manifest.materials['venus-surface']={...await textureVariants(root,path.join(root,'.cloudflare/media'),deployment.prefix,'venus-surface.webp'),localPreview:true};
 if(publish){
  if(deployment.bucket!=='solar-time-media'||deployment.prefix!=='releases')throw Error('Unexpected R2 target');
  const {spawnSync}=require('node:child_process'),entry=manifest.materials['venus-surface'];
  const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
  for(const tier of entry.tiers){
   if(!/^releases\/content\/textures\/venus-surface-\d+\.[a-f0-9]+\.webp$/.test(tier.path))throw Error('Unsafe object key');
   const url=new URL(tier.path,deployment.cdnBase).href;
   // Check exact content, not merely existence, before skipping an upload.
   const prior=await fetch(url,{signal:AbortSignal.timeout(15000)});
   if(prior.ok){if(hash(Buffer.from(await prior.arrayBuffer()))!==tier.sha256)throw Error('Immutable remote object differs');}
   else{
    if(prior.status!==404)throw Error('Remote preflight HTTP '+prior.status);
    const result=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'r2','object','put',deployment.bucket+'/'+tier.path,'--remote','--file',path.join(root,'.cloudflare/media',tier.path),'--content-type','image/webp','--cache-control','public, max-age=31536000, immutable','--force'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'4640527a19614f7b65a034f422704b64'}});
    if(result.error||result.status!==0)throw Error('Venus R2 upload failed; runtime not promoted.');
   }
   const response=await fetch(url+'?verify='+tier.sha256.slice(0,16),{signal:AbortSignal.timeout(20000)});
   if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==tier.sha256)throw Error('Public byte verification failed: '+tier.path);
   if(response.headers.get('access-control-allow-origin')!=='*')throw Error('Missing public texture CORS');
   console.log('Verified '+tier.width+' '+tier.path);
  }
  delete entry.localPreview;
 }
 atomicWrite(manifestFile,JSON.stringify(manifest,null,2)+'\n');
 atomicWrite(path.join(root,'src/assets.js'),runtimeScripts(root,manifest,deployment).assets);
 console.log('NASA Venus 1440x720 source -> 256/512/1024/2048/4096 LOD. '+(publish?'R2 verified; local runtime now uses CDN. Site not deployed.':'Local preview only.'));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
