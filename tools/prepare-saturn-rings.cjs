/* Preserve the supplied 8K original; build lightweight radial RGBA tiers.
   --publish adds only immutable ring objects, never deploys the site. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {atomicWrite,projectConfig,runtimeScripts,TEXTURE_WIDTHS}=require('./asset-pipeline.cjs');
const {putR2}=require('./r2-upload.cjs');
const root=path.resolve(__dirname,'..');
const SOURCE='https://www.solarsystemscope.com/textures/download/8k_saturn_ring_alpha.png';
const SHA256='f1f826933c9ff87d64ecf0518d6256b8ed990b003722794f67e96e3d2b876ae4';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function radialTier(original,width){
 // A ring is axisymmetric: average along the redundant strip height, not
 // around its radial edges. Sharp resizes RGBA with premultiplied alpha.
 // Never run the spherical longitude seam baker on inner/outer radii.
 return sharp(original).resize(width,1,{fit:'fill',kernel:sharp.kernel.lanczos3}).webp({lossless:true,effort:6}).toBuffer();
}
async function main(){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--publish'))throw Error('Unknown option');
 const publish=args.includes('--publish'),{deployment}=projectConfig(root);
 if(deployment.bucket!=='solar-time-media'||deployment.prefix!=='releases')throw Error('Unexpected R2 target');
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Source HTTP '+response.status);
 const original=Buffer.from(await response.arrayBuffer());if(hash(original)!==SHA256)throw Error('Source changed; inspect before replacing the approved ring map.');
 const meta=await sharp(original).metadata();if(meta.width!==8192||meta.height!==500||!meta.hasAlpha)throw Error('Unexpected ring source dimensions/alpha');
 const media=path.join(root,'.cloudflare/media'),objects=[];
 function stage(bytes,key,type){const row={path:key,bytes:bytes.length,sha256:hash(bytes)},file=path.join(media,key);atomicWrite(file,bytes);objects.push({...row,file,type});return row;}
 const archive=stage(original,'releases/content/originals/saturn-ring-8192.'+SHA256.slice(0,16)+'.png','image/png');
 const tiers=[];
 for(const width of TEXTURE_WIDTHS){
  const bytes=await radialTier(original,width),key='releases/content/textures/saturn-ring-'+width+'.'+hash(bytes).slice(0,16)+'.webp';
  tiers.push({width,height:1,...stage(bytes,key,'image/webp')});
 }
 if(publish)for(const object of objects){
  const url=new URL(object.path,deployment.cdnBase).href,prior=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(prior.ok){if(hash(Buffer.from(await prior.arrayBuffer()))!==object.sha256)throw Error('Immutable object mismatch: '+object.path);}
  else{
   if(prior.status!==404)throw Error('R2 preflight HTTP '+prior.status);
   putR2(root,{bucket:deployment.bucket,key:object.path,file:object.file,type:object.type});
  }
  const check=await fetch(url+'?verify='+object.sha256.slice(0,16),{signal:AbortSignal.timeout(20000)});
  if(!check.ok||hash(Buffer.from(await check.arrayBuffer()))!==object.sha256)throw Error('Public byte verification failed: '+object.path);
  if(check.headers.get('access-control-allow-origin')!=='*')throw Error('Public texture CORS missing');
  console.log('Verified '+object.path);
 }
 // Promote only after EVERY object verifies. Existing immutable assets and
 // unrelated local changes are retained; future full builds retain remoteOnly.
 const file=path.join(root,'assets/manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 manifest.materials['saturn-ring']={source:'8k_saturn_ring_alpha.png',sourceUrl:SOURCE,sourceSha256:SHA256,sourceArchive:archive,
  width:4096,height:1,layout:'radial',remoteOnly:true,seamBaked:false,...(!publish?{localPreview:true}:{}),tiers};
 atomicWrite(file,JSON.stringify(manifest,null,2)+'\n');
 atomicWrite(path.join(root,'src/assets.js'),runtimeScripts(root,manifest,deployment).assets);
 console.log('Saturn ring: 8K original + 256/512/1024/2048/4096 radial RGBA tiers. '+(publish?'R2 verified; local runtime uses CDN. Site not deployed.':'Local preview only.'));
}
module.exports={radialTier,SOURCE,SHA256};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
