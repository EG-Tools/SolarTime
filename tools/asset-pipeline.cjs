'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');

const TEXTURE_WIDTHS=Object.freeze([256,512,1024,2048,4096]);
const SKY_FILE='universe-optimized.webp';
const REQUIRED=Object.freeze(['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','europa','clouds']);
// High-resolution colour maps already carry their photographed surface detail.
// Reapplying the older synthetic relief maps would exaggerate the same craters.
const EXCLUDED=new Set(['universe.webp',SKY_FILE,'pluto-relief.webp','mercury-relief.webp','moon-relief.webp','mars-relief.webp']);

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const slash=value=>value.split(path.sep).join('/');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function atomicWrite(file,value){
 const temporary=file+'.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});
 try{fs.writeFileSync(temporary,value);fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function projectConfig(root){
 const revision=readJson(path.join(root,'assets/revision.json')).version;
 if(!/^assetpack-[a-z0-9-]+$/i.test(revision))throw Error('Invalid assets/revision.json version.');
 const deployment=readJson(path.join(root,'assets/deployment.json'));
 if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/i.test(deployment.bucket))throw Error('Invalid R2 bucket name.');
 deployment.prefix=String(deployment.prefix||'releases').replace(/^\/+|\/+$/g,'');
 deployment.cdnBase=String(deployment.cdnBase||'').trim();
 return {revision,deployment};
}
function sourceFiles(root){
 for(const id of REQUIRED)if(!fs.existsSync(path.join(root,'assets',id+'.webp')))throw Error('Missing original asset: assets/'+id+'.webp');
 return fs.readdirSync(path.join(root,'assets')).filter(name=>name.endsWith('.webp')&&!EXCLUDED.has(name)).sort();
}
async function seamBakedVariant(source,width,height){
 const image=sharp(source).resize(width,height,{fit:'fill',kernel:sharp.kernel.lanczos3});
 const {data,info}=await image.raw().toBuffer({resolveWithObject:true}),channels=info.channels;
 const band=Math.max(2,Math.min(32,Math.round(width*.012)));
 for(let y=0;y<height;y++)for(let x=0;x<band;x++){
  const t=1-x/(band-1),weight=t*t*(3-2*t),leftPixel=y*width+x,rightPixel=y*width+(width-1-x);
  for(let k=0;k<channels;k++){
   const a=leftPixel*channels+k,b=rightPixel*channels+k,left=data[a],right=data[b],middle=(left+right)*.5;
   data[a]=Math.round(left+(middle-left)*weight);data[b]=Math.round(right+(middle-right)*weight);
  }
 }
 return sharp(data,{raw:{width,height,channels}}).webp({quality:95,effort:6,smartSubsample:true}).toBuffer();
}
async function textureVariants(root,output,prefix,file,group='textures'){
 const source=path.join(root,'assets',file),metadata=await sharp(source).metadata();
 if(!metadata.width||!metadata.height||Math.abs(metadata.width/metadata.height-2)>.03)throw Error(file+' must be a 2:1 texture.');
 const widths=TEXTURE_WIDTHS.filter(width=>width<=metadata.width);if(!widths.includes(metadata.width))widths.push(metadata.width);widths.sort((a,b)=>a-b);
 const tiers=[];
 for(const width of widths){
  const seamBaked=group==='textures',bytes=seamBaked?await seamBakedVariant(source,width,width/2):(width===metadata.width?fs.readFileSync(source):await sharp(source).resize(width,width/2,{fit:'fill',kernel:sharp.kernel.lanczos3}).webp({quality:88,effort:6,smartSubsample:true}).toBuffer());
  const hash=digest(bytes).slice(0,16),stem=path.basename(file,'.webp'),relative=slash(path.join(prefix,'content',group,`${stem}-${width}.${hash}.webp`));
  const destination=path.join(output,...relative.split('/'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
  tiers.push({width,height:width/2,path:relative,bytes:bytes.length,sha256:digest(bytes)});
 }
 return {source:file,width:metadata.width,height:metadata.height,seamBaked:group==='textures',tiers};
}
async function buildMedia(root,output){
 const {revision,deployment}=projectConfig(root),resolved=path.resolve(output),cloudflareRoot=path.resolve(root,'.cloudflare');
 if(resolved!==cloudflareRoot&&!resolved.startsWith(cloudflareRoot+path.sep))throw Error('Generated media must stay inside .cloudflare.');
 fs.rmSync(resolved,{recursive:true,force:true});fs.mkdirSync(resolved,{recursive:true});
 const materials={};
 for(const file of sourceFiles(root))materials[path.basename(file,'.webp')]=await textureVariants(root,resolved,deployment.prefix,file);
 const sky=await textureVariants(root,resolved,deployment.prefix,SKY_FILE,'backgrounds');
 const music={};const musicDir=path.join(root,'assets/music');
 if(fs.existsSync(musicDir))for(const file of fs.readdirSync(musicDir).filter(name=>name.toLowerCase().endsWith('.mp3')).sort()){
  const source=path.join(musicDir,file),bytes=fs.readFileSync(source),hash=digest(bytes),relative=slash(path.join(deployment.prefix,'content','music',`${path.basename(file,'.mp3')}.${hash.slice(0,16)}.mp3`));
  const destination=path.join(resolved,...relative.split('/'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
  music[file]={source:'music/'+file,path:relative,bytes:bytes.length,sha256:hash};
 }
 const manifestFile=path.join(root,'assets/manifest.json'),body={schema:1,revision,materials,sky,music};let generatedAt=new Date().toISOString();
 if(fs.existsSync(manifestFile))try{const previous=readJson(manifestFile),previousBody={schema:previous.schema,revision:previous.revision,materials:previous.materials,sky:previous.sky,music:previous.music};if(JSON.stringify(previousBody)===JSON.stringify(body)&&typeof previous.generatedAt==='string')generatedAt=previous.generatedAt;}catch(_){/* Regenerate invalid metadata. */}
 const manifest={schema:body.schema,revision:body.revision,generatedAt,materials,sky,music};
 const text=JSON.stringify(manifest,null,2)+'\n';atomicWrite(manifestFile,text);
 atomicWrite(path.join(resolved,deployment.prefix,'manifests',revision+'.json'),text);
 return {manifest,deployment};
}
function runtimeScripts(root,manifest,deployment,{cdnBase=deployment.cdnBase}={}){
 const stars=readJson(path.join(root,'assets/stars.json'));if(!Array.isArray(stars))throw Error('assets/stars.json must be an array.');
 const materialInfo=readJson(path.join(root,'assets/material-info.json'));
 const compact={revision:manifest.revision,materials:manifest.materials,sky:manifest.sky,music:manifest.music};
 const prelude=`/* Generated by tools/build-assets.cjs; cloud URL manifest only, no media bytes. */\n(function(root){'use strict';\nconst manifest=${JSON.stringify(compact)},configuredBase=${JSON.stringify(String(cdnBase||''))};\nconst base=configuredBase?new URL(configuredBase,location.href).href.replace(/\\/?$/,'/'):'';\nif(!base)throw Error('Solar Time media service is not configured.');\nconst remote=path=>new URL(path,base).href;\nconst asset=entry=>Object.freeze({base,seamBaked:!!entry.seamBaked,tiers:Object.freeze(entry.tiers.map(row=>Object.freeze({width:row.width,path:row.path}))),fallback:remote(entry.tiers[0].path)});\nconst materials={};for(const [id,entry] of Object.entries(manifest.materials))materials[id]=asset(entry);\nconst music={};for(const [file,entry] of Object.entries(manifest.music))music[file]=Object.freeze({base,path:entry.path,fallback:remote(entry.path)});\nroot.SolarAssets={materials:Object.freeze(materials),materialInfo:${JSON.stringify(materialInfo)},materialRevision:manifest.revision,music:Object.freeze(music),stars:${JSON.stringify(stars)},sky:null,skyVersion:manifest.revision};\nroot.SolarAssetManifest=Object.freeze(manifest);\n})(window);\n`;
 const sky=`/* Generated sky URL payload; load after src/assets.js. */\n(function(root){'use strict';if(!root.SolarAssets)throw Error('SolarAssets must load before sky-asset.js');const entry=root.SolarAssetManifest.sky,base=Object.values(root.SolarAssets.materials)[0]?.base||'';if(!base)throw Error('Solar Time media service is not configured.');root.SolarAssets.sky=Object.freeze({base,tiers:Object.freeze(entry.tiers.map(row=>Object.freeze({width:row.width,path:row.path}))),fallback:new URL(entry.tiers[0].path,base).href});})(window);\n`;
 return {assets:prelude,sky};
}
module.exports={TEXTURE_WIDTHS,SKY_FILE,REQUIRED,atomicWrite,buildMedia,projectConfig,runtimeScripts};
